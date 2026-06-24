'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { verifyAdminSession } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const { logError } = require('../../middleware/errorLogger');
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../../utils/retryHelpers');
const { refreshTokenIfNeeded } = require('../../crm/jobber');
const axios = require('axios');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

// Finance flags — only Owners may grant these to General-tier members (Decision A §5.3).
// cashout_approve carries an additional stricter wall (§5.4): it may NEVER be saved onto
// a General-tier row by anyone, including Owners. That wall is enforced separately below.
const FINANCE_FLAGS = new Set(['finance_settings', 'finance_settings.manage', 'cashout_approve']);

// ── GET /api/admin/team ───────────────────────────────────────────────────────
router.get('/api/admin/team', requirePermission('team'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT tm.id, tm.email, tm.full_name, tm.tier, tm.permissions,
              tm.is_field_rep, tm.is_attributable, tm.rep_revenue_visibility,
              tm.active, tm.last_login_at, tm.title_id, tm.jobber_user_id,
              t.name AS title_name
       FROM team_members tm
       LEFT JOIN titles t ON t.id = tm.title_id
       WHERE tm.contractor_id = $1
       ORDER BY tm.created_at ASC`,
      [contractorId]
    );
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/team' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/team ──────────────────────────────────────────────────────
// Structural creation chain (Decision A §1.3):
//   Owner may create Admin or General.
//   Admin may create General ONLY — creating another Admin is structurally rejected.
router.post('/api/admin/team', requirePermission('team.manage'), [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().isString().isLength({ min: 8, max: 200 }).withMessage('Password must be 8–200 characters'),
  body('full_name').notEmpty().isString().isLength({ max: 200 }).withMessage('Full name required'),
  body('tier').isIn(['admin', 'general']).withMessage('Tier must be admin or general'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId, teamMemberId } = adminSession;

  try {
    const requesterResult = await pool.query(
      'SELECT tier FROM team_members WHERE id = $1 AND active = true',
      [teamMemberId]
    );
    if (!requesterResult.rows.length) return res.status(403).json({ error: 'Access denied' });
    const requesterTier = requesterResult.rows[0].tier;

    const { email, password, full_name, tier } = req.body;

    // Structural chain: Admin may only create General-tier members
    if (requesterTier === 'admin' && tier === 'admin') {
      return res.status(403).json({ error: 'Admins may only create General-tier members' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, full_name, tier)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, tier`,
      [contractorId, email, passwordHash, full_name, tier]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A member with that email already exists' });
    }
    await logError({ req, error: err, source: 'POST /api/admin/team' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/admin/team/:id ─────────────────────────────────────────────────
// Update full_name, title_id, tier.
// Only Owner may edit Admin-tier rows or change tier (Decision A §9).
router.patch('/api/admin/team/:id', requirePermission('team.manage'), [
  body('full_name').optional().notEmpty().isString().isLength({ max: 200 }),
  body('title_id').optional({ nullable: true }).isInt(),
  body('tier').optional().isIn(['owner', 'admin', 'general']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId, teamMemberId } = adminSession;
  const targetId = parseInt(req.params.id, 10);

  try {
    const [requesterResult, targetResult] = await Promise.all([
      pool.query('SELECT tier FROM team_members WHERE id = $1 AND active = true', [teamMemberId]),
      pool.query('SELECT tier, contractor_id FROM team_members WHERE id = $1', [targetId]),
    ]);

    if (!requesterResult.rows.length) return res.status(403).json({ error: 'Access denied' });
    if (!targetResult.rows.length) return res.status(404).json({ error: 'Member not found' });

    const requesterTier = requesterResult.rows[0].tier;
    const target = targetResult.rows[0];

    if (target.contractor_id !== contractorId) return res.status(404).json({ error: 'Member not found' });

    // Only Owner may edit Admin-tier rows
    if (target.tier === 'admin' && requesterTier !== 'owner') {
      return res.status(403).json({ error: 'Only Owners may edit Admin-tier members' });
    }

    // Only Owner may change tier
    const { full_name, title_id, tier } = req.body;
    if (tier !== undefined && requesterTier !== 'owner') {
      return res.status(403).json({ error: 'Only Owners may change member tier' });
    }

    // Last-owner guard when demoting the Owner tier
    if (tier !== undefined && tier !== 'owner' && target.tier === 'owner') {
      const { rows: ownerRows } = await pool.query(
        `SELECT COUNT(*) AS count FROM team_members
         WHERE contractor_id = $1 AND tier = 'owner' AND active = true`,
        [contractorId]
      );
      if (parseInt(ownerRows[0].count, 10) <= 1) {
        return res.status(409).json({ error: 'Cannot demote the last active Owner' });
      }
    }

    const updates = [];
    const values = [];
    let i = 1;
    if (full_name !== undefined) { updates.push(`full_name = $${i++}`); values.push(full_name); }
    if (title_id !== undefined)  { updates.push(`title_id = $${i++}`);  values.push(title_id);  }
    if (tier !== undefined)      { updates.push(`tier = $${i++}`);      values.push(tier);      }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(targetId);
    const result = await pool.query(
      `UPDATE team_members SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, email, full_name, tier, title_id`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    await logError({ req, error: err, source: 'PATCH /api/admin/team/:id' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/team/:id/permissions ──────────────────────────────────────
// Save permissions JSONB. Two security walls enforced here (first layer);
// requirePermission middleware is the second layer on every guarded route.
//
// WALL 1 — Finance-grant asymmetry (§5.3): turning ON any finance flag for a
//   General-tier target requires Owner. An Admin cannot grant finance flags to
//   General members.
//
// WALL 2 — cashout_approve absolute wall (§5.4): cashout_approve may NEVER be
//   saved onto a General-tier row by anyone, including Owners.
//
// NOTE on cashouts.manage: this flag is reserved (route-less). See cashouts.js
//   PATCH comment for rationale — deny/mark-paid are not separated from
//   cashout_approve this phase; cashouts.manage is reserved for future bulk mgmt.
//
// Permission changes are logged on SAVE (§4.4) — one activity_log row per save,
// never per-toggle.
//
// NOTE: cashout approvals should stamp approved_by_team_member_id on the cashout_requests
//   row (§4.4) — this is NOT yet wired in cashouts.js. Follow-up required.
router.post('/api/admin/team/:id/permissions', requirePermission('team.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId, teamMemberId } = adminSession;
  const targetId = parseInt(req.params.id, 10);

  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return res.status(400).json({ error: 'permissions must be an object' });
  }

  try {
    const [requesterResult, targetResult] = await Promise.all([
      pool.query('SELECT tier FROM team_members WHERE id = $1 AND active = true', [teamMemberId]),
      pool.query('SELECT tier, permissions, contractor_id FROM team_members WHERE id = $1 AND active = true', [targetId]),
    ]);

    if (!requesterResult.rows.length) return res.status(403).json({ error: 'Access denied' });
    if (!targetResult.rows.length) return res.status(404).json({ error: 'Member not found' });

    const requesterTier = requesterResult.rows[0].tier;
    const target = targetResult.rows[0];

    if (target.contractor_id !== contractorId) return res.status(404).json({ error: 'Member not found' });

    // WALL 2: cashout_approve may never be on a General-tier row (absolute, even Owner)
    if (target.tier === 'general' && permissions.cashout_approve === true) {
      return res.status(403).json({ error: 'cashout_approve cannot be granted to General-tier members' });
    }

    // WALL 1: only Owners may grant finance flags to General-tier members
    if (target.tier === 'general' && requesterTier !== 'owner') {
      const existing = target.permissions || {};
      const newFinanceGrants = [...FINANCE_FLAGS].filter(
        f => permissions[f] === true && existing[f] !== true
      );
      if (newFinanceGrants.length > 0) {
        return res.status(403).json({ error: 'Only Owners may grant finance permissions to General-tier members' });
      }
    }

    await pool.query(
      `UPDATE team_members SET permissions = $1 WHERE id = $2`,
      [permissions, targetId]
    );

    // Log permission save — one row per save, never per-toggle (§4.4)
    await pool.query(
      `INSERT INTO activity_log (event_type, detail, category)
       VALUES ('admin', $1, 'admin_action')`,
      [`Permissions updated for team_member id=${targetId} by team_member id=${teamMemberId}`]
    );

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/admin/team/:id/permissions' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/admin/team/:id/deactivate ─────────────────────────────────────
// Soft deactivate: kills all sessions, sets active=false, keeps the row.
// Guards (Decision A §9):
//   - Cannot deactivate self
//   - LAST-OWNER GUARD: refuses to deactivate the last active Owner
router.patch('/api/admin/team/:id/deactivate', requirePermission('team.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId, teamMemberId } = adminSession;
  const targetId = parseInt(req.params.id, 10);

  if (targetId === teamMemberId) {
    return res.status(409).json({ error: 'You cannot deactivate your own account' });
  }

  try {
    const targetResult = await pool.query(
      'SELECT tier, contractor_id FROM team_members WHERE id = $1 AND active = true',
      [targetId]
    );
    if (!targetResult.rows.length) return res.status(404).json({ error: 'Member not found' });
    const target = targetResult.rows[0];

    if (target.contractor_id !== contractorId) return res.status(404).json({ error: 'Member not found' });

    // Last-owner guard
    if (target.tier === 'owner') {
      const { rows: ownerRows } = await pool.query(
        `SELECT COUNT(*) AS count FROM team_members
         WHERE contractor_id = $1 AND tier = 'owner' AND active = true`,
        [contractorId]
      );
      if (parseInt(ownerRows[0].count, 10) <= 1) {
        return res.status(409).json({ error: 'Cannot deactivate the last active Owner' });
      }
    }

    await pool.query(`DELETE FROM sessions WHERE team_member_id = $1`, [targetId]);
    await pool.query(`UPDATE team_members SET active = false WHERE id = $1`, [targetId]);

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'PATCH /api/admin/team/:id/deactivate' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/jobber-users ───────────────────────────────────────────────
// Proxies the Jobber user list for the Jobber User Mapping card in Team Settings.
// Source data for the mapping UI — Owner sets explicit mappings (source of truth).
// READ-ONLY list fetch. NOT the request-consumption/assignment engine.
//
// TODO (deferred): The consumption path — using request.salesperson as a secondary
//   hint to auto-suggest which rep closed a job — is NOT built here. When that path
//   lands, jobber_user_id on team_members is the primary key, not request.salesperson.
//   Open question: does Accent's workflow populate salesperson with the closer or the
//   scheduler? Must be confirmed before building the consumption engine.
router.get('/api/admin/jobber-users', requirePermission('team'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    await refreshTokenIfNeeded();
    const tokenResult = await pool.query(
      'SELECT access_token FROM tokens WHERE contractor_id = $1',
      [contractorId]
    );
    if (!tokenResult.rows.length || !tokenResult.rows[0].access_token) {
      return res.status(503).json({ error: 'Jobber not connected' });
    }
    const accessToken = tokenResult.rows[0].access_token;

    const allUsers = [];
    let cursor = null;
    let totalCount = null;

    do {
      const afterArg = cursor ? `, after: "${cursor}"` : '';
      const query = `{ users(first: 50${afterArg}) { nodes { id name { full } email { raw } } pageInfo { hasNextPage endCursor } totalCount } }`;

      const response = await retryWithBackoff(
        () => axios.post(
          'https://api.getjobber.com/api/graphql',
          { query },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
            },
          }
        ),
        { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
      );

      const usersData = response.data?.data?.users;
      if (!usersData) break;

      if (totalCount === null) totalCount = usersData.totalCount;
      allUsers.push(...(usersData.nodes || []));

      const pageInfo = usersData.pageInfo;
      cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
    } while (cursor);

    res.json({ users: allUsers, totalCount: totalCount ?? allUsers.length });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/jobber-users' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
