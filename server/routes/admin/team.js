'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { verifyAdminSession } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const { logError } = require('../../middleware/errorLogger');
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { jobberShouldRetry, resendShouldRetry } = require('../../utils/retryHelpers');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const crypto = require('crypto');
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
              t.name AS title_name,
              EXISTS (
                SELECT 1 FROM team_member_invite_tokens tit
                WHERE tit.team_member_id = tm.id
                  AND tit.used_at IS NULL
                  AND tit.expires_at > NOW()
              ) AS invite_pending
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
//
// Auth flow (Decision A §9): no password is accepted from the client. The new member
// is created with a locked hash (bcrypt of random bytes — login always fails until the
// invite link is accepted). An invite token is issued and emailed immediately.
router.post('/api/admin/team', requirePermission('team.manage'), [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
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

    const { email, full_name, tier } = req.body;

    // Structural chain: Admin may only create General-tier members
    if (requesterTier === 'admin' && tier === 'admin') {
      return res.status(403).json({ error: 'Admins may only create General-tier members' });
    }

    // Locked hash: bcrypt of random bytes — nobody knows the plaintext, so login
    // always fails via bcrypt.compare → false until the invite link is accepted.
    const lockedHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    const result = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, full_name, tier)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, tier`,
      [contractorId, email, lockedHash, full_name, tier]
    );
    const newMember = result.rows[0];

    // Issue a 24-hour invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO team_member_invite_tokens (team_member_id, token, expires_at)
       VALUES ($1, $2, NOW() + interval '24 hours')`,
      [newMember.id, inviteToken]
    );

    // Send invite email — failure is surfaced to the caller (not swallowed) so the
    // Owner knows they need to resend. Member row already exists; it is still usable
    // once the Owner triggers a resend from the roster.
    let inviteSent = false;
    try {
      const frontendUrl = process.env.FRONTEND_URL || '';
      const inviteUrl = `${frontendUrl}/?admin_invite=${inviteToken}`;

      const csResult = await pool.query(
        `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
        [contractorId]
      );
      const cs = csResult.rows[0] || {};
      const fromName = (cs.email_sender_name || cs.company_name || 'RoofMiles').replace(/[<>]/g, '');

      await retryWithBackoff(
        () => resend.emails.send({
          from: `${fromName} <noreply@roofmiles.com>`,
          to: newMember.email,
          subject: `You've been invited to ${fromName} — set your password`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <p style="font-size:20px;font-weight:700;color:#012854;margin:0 0 8px;">${fromName}</p>
              <h1 style="font-size:24px;color:#012854;margin:0 0 16px;">You've been added to the team</h1>
              <p style="font-size:15px;color:#444;margin:0 0 24px;">
                ${full_name ? `Hi ${full_name},<br><br>` : ''}You've been invited to access the ${fromName} admin panel.
                Click the button below to set your password. This link expires in 24 hours.
              </p>
              <a href="${inviteUrl}" style="display:inline-block;background:#CC0000;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;margin-bottom:24px;">Set Your Password</a>
              <p style="font-size:13px;color:#888;margin:0;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </div>
          `,
        }),
        { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
      );
      inviteSent = true;
    } catch (emailErr) {
      await logError({ req, error: emailErr, source: 'POST /api/admin/team (invite email)' });
      // inviteSent stays false — caller sees invite_sent: false and can trigger a resend
    }

    res.status(201).json({ id: newMember.id, email: newMember.email, full_name: newMember.full_name, tier: newMember.tier, invite_sent: inviteSent });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A member with that email already exists' });
    }
    await logError({ req, error: err, source: 'POST /api/admin/team' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/team/accept-invite ────────────────────────────────────────
// PUBLIC — no session, no requirePermission.
// The invitee has no session yet; the single-use, time-limited token IS the
// authentication. Declared before /:id routes to prevent any pattern shadowing.
//
// Security hardening:
//   - Token validated in one query (used_at IS NULL AND expires_at > NOW()).
//   - password_hash update + used_at mark are TRANSACTIONAL — a failure leaves
//     neither half done (no usable password on a still-replayable token).
//   - Generic error response prevents leaking whether a token exists.
//   - Password min-length enforced server-side (not only in the frontend).
router.post('/api/admin/team/accept-invite', [
  body('token').notEmpty().isString().withMessage('Token required'),
  body('password').isString().isLength({ min: 8, max: 200 }).withMessage('Password must be 8–200 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid or expired invite' });

  const { token, password } = req.body;
  const GENERIC_INVALID = { error: 'Invalid or expired invite' };

  const client = await pool.connect();
  try {
    const tokenResult = await client.query(
      `SELECT t.id AS token_id, t.team_member_id
       FROM team_member_invite_tokens t
       WHERE t.token = $1 AND t.used_at IS NULL AND t.expires_at > NOW()`,
      [token]
    );
    if (!tokenResult.rows.length) {
      return res.status(400).json(GENERIC_INVALID);
    }
    const { token_id, team_member_id } = tokenResult.rows[0];

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query('BEGIN');
    try {
      await client.query(
        'UPDATE team_members SET password_hash = $1 WHERE id = $2',
        [passwordHash, team_member_id]
      );
      await client.query(
        'UPDATE team_member_invite_tokens SET used_at = NOW() WHERE id = $1',
        [token_id]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    }

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/admin/team/accept-invite' });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
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

// ── POST /api/admin/team/:id/resend-invite ────────────────────────────────────
// Re-issues an invite token and resends the invite email for a member who has not
// yet accepted (invite_pending). Expires all unused tokens first so only the new
// one is valid. Requires team.manage — this is NOT public (caller has a session).
router.post('/api/admin/team/:id/resend-invite', requirePermission('team.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const targetId = parseInt(req.params.id, 10);

  try {
    const targetResult = await pool.query(
      'SELECT id, email, full_name, contractor_id FROM team_members WHERE id = $1 AND active = true',
      [targetId]
    );
    if (!targetResult.rows.length) return res.status(404).json({ error: 'Member not found' });
    const target = targetResult.rows[0];
    if (target.contractor_id !== contractorId) return res.status(404).json({ error: 'Member not found' });

    // Expire all outstanding unused tokens so only the fresh one is valid
    await pool.query(
      `UPDATE team_member_invite_tokens SET expires_at = NOW()
       WHERE team_member_id = $1 AND used_at IS NULL`,
      [targetId]
    );

    const inviteToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO team_member_invite_tokens (team_member_id, token, expires_at)
       VALUES ($1, $2, NOW() + interval '24 hours')`,
      [targetId, inviteToken]
    );

    let inviteSent = false;
    try {
      const frontendUrl = process.env.FRONTEND_URL || '';
      const inviteUrl = `${frontendUrl}/?admin_invite=${inviteToken}`;

      const csResult = await pool.query(
        `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
        [contractorId]
      );
      const cs = csResult.rows[0] || {};
      const fromName = (cs.email_sender_name || cs.company_name || 'RoofMiles').replace(/[<>]/g, '');

      await retryWithBackoff(
        () => resend.emails.send({
          from: `${fromName} <noreply@roofmiles.com>`,
          to: target.email,
          subject: `You've been invited to ${fromName} — set your password`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <p style="font-size:20px;font-weight:700;color:#012854;margin:0 0 8px;">${fromName}</p>
              <h1 style="font-size:24px;color:#012854;margin:0 0 16px;">You've been added to the team</h1>
              <p style="font-size:15px;color:#444;margin:0 0 24px;">
                ${target.full_name ? `Hi ${target.full_name},<br><br>` : ''}You've been invited to access the ${fromName} admin panel.
                Click the button below to set your password. This link expires in 24 hours.
              </p>
              <a href="${inviteUrl}" style="display:inline-block;background:#CC0000;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;margin-bottom:24px;">Set Your Password</a>
              <p style="font-size:13px;color:#888;margin:0;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </div>
          `,
        }),
        { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
      );
      inviteSent = true;
    } catch (emailErr) {
      await logError({ req, error: emailErr, source: 'POST /api/admin/team/:id/resend-invite (invite email)' });
    }

    res.json({ success: true, invite_sent: inviteSent });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/admin/team/:id/resend-invite' });
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
