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
const { clearPreference, TEAM_ACCESS_REVOKED_SEEN_PREF_KEY } = require('../../utils/userPreferences');

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
//
// is_attributable was REMOVED from this endpoint in C/DL-3a Phase 2A. It is a rep
// flag, and every rep flag now has exactly one writer: POST /api/admin/team/:id/promote,
// which is the only place able to evaluate coherence across all three flags at once.
// A body carrying it is REJECTED rather than ignored — this endpoint could set
// is_attributable=true on a member with is_field_rep=false, which is precisely the
// write that produced Known Issue 13's production drift. A silent no-op would let a
// stale client believe the toggle worked; the explicit 422 names the replacement.
router.patch('/api/admin/team/:id', requirePermission('team.manage'), [
  body('full_name').optional().notEmpty().isString().isLength({ max: 200 }),
  body('title_id').optional({ nullable: true }).isInt(),
  body('tier').optional().isIn(['owner', 'admin', 'general']),
  body('jobber_user_id').optional({ nullable: true }).isString().isLength({ max: 200 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  // ── ALL THREE REP FLAGS ARE UNWRITABLE HERE (C/DL-3c Phase 2a) ─────────────
  // Guarded is_attributable ALONE from C/DL-3a Phase 2A until now; the other two
  // were silently discarded by the whitelist destructure below, or reported as
  // 'No fields to update' when sent alone. Both behaviours are MEASURED and
  // recorded once, in repPromotion.test.js's GROUP 3 header — not restated here.
  //
  // ⚠ `!== undefined`, NOT TRUTHINESS. `if (req.body[flag])` reads as equivalent
  // and would let `false` through to be discarded exactly as before — and `false`
  // is what a diff-based client save sends constantly, while `true` is what a
  // human sends by hand. That spelling would keep the defect in the half nobody
  // tests by accident; the [RED] false case in GROUP 3 is its fence.
  //
  // REFUSE, NEVER FORWARD. POST /:id/promote is the sole writer because it judges
  // coherence on the MERGED state, cascades dependents off on demotion, carries
  // its own rep_promotion permission, and writes the before→after audit row. A
  // PATCH that quietly wrote one flag bypasses all four.
  const UNWRITABLE_REP_FLAGS = ['is_field_rep', 'is_attributable', 'rep_revenue_visibility'];
  for (const flag of UNWRITABLE_REP_FLAGS) {
    if (req.body[flag] !== undefined) {
      return res.status(422).json({
        error: `${flag} is not writable here — use POST /api/admin/team/:id/promote`,
      });
    }
  }

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
    const { full_name, title_id, tier, jobber_user_id } = req.body;
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
    if (full_name !== undefined)     { updates.push(`full_name = $${i++}`);     values.push(full_name);     }
    if (title_id !== undefined)      { updates.push(`title_id = $${i++}`);      values.push(title_id);      }
    if (tier !== undefined)          { updates.push(`tier = $${i++}`);          values.push(tier);          }
    if (jobber_user_id !== undefined) { updates.push(`jobber_user_id = $${i++}`); values.push(jobber_user_id); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(targetId);
    const result = await pool.query(
      `UPDATE team_members SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, email, full_name, tier, title_id, jobber_user_id`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'team_members_jobber_user_id_unique') {
      return res.status(409).json({
        error: 'jobber_user_already_mapped',
        message: 'This Jobber user is already mapped to another team member.',
      });
    }
    await logError({ req, error: err, source: 'PATCH /api/admin/team/:id' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/team/:id/promote ──────────────────────────────────────────
// THE single write-path for the three rep flags (C/DL-3a Phase 2A). After this
// endpoint, nothing else in the system writes is_field_rep, is_attributable or
// rep_revenue_visibility — is_attributable was removed from the PATCH above
// specifically so this is the only writer.
//
// COHERENCE (locked): every rep ability requires is_field_rep. Enforced on the MERGED
// state (payload overlaid on the row's current values), not on the payload alone —
// sending is_attributable on a member who is ALREADY a field rep is legal. Turning
// is_field_rep off cascades: both dependent abilities are forced false in the same
// UPDATE. The team_members_rep_coherence CHECK (db.js) is the second, independent
// layer — a direct SQL write that bypasses this endpoint is still rejected.
//
// rep_revenue_visibility, when granted, exposes the rep's OWN revenue only.
//
// Its own permission flag by design: team.manage is deliberately NOT sufficient.
// Promotion mints attributable reps, and attribution drives payouts.
//
// Guard walls (D-b ruling): tenancy + Owner-edits-Admin. The last-owner guard is
// deliberately NOT applied — this endpoint writes neither `tier` nor `active`, and
// no invariant requires a minimum number of field reps.
router.post('/api/admin/team/:id/promote', requirePermission('rep_promotion'), async (req, res) => {
  // Strict boolean validation, manual for the reason documented on the PATCH above:
  // express-validator's isBoolean() lenient-mode accepts 'yes'/'no'/1/0. A coerced
  // truthy string silently granting attribution is exactly the failure to prevent.
  const REP_FLAGS = ['is_field_rep', 'is_attributable', 'rep_revenue_visibility'];
  for (const flag of REP_FLAGS) {
    if (req.body[flag] !== undefined && typeof req.body[flag] !== 'boolean') {
      return res.status(422).json({ error: `${flag} must be a boolean` });
    }
  }
  if (REP_FLAGS.every(f => req.body[f] === undefined)) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId, teamMemberId } = adminSession;
  const targetId = parseInt(req.params.id, 10);

  try {
    const [requesterResult, targetResult] = await Promise.all([
      pool.query('SELECT tier FROM team_members WHERE id = $1 AND active = true', [teamMemberId]),
      pool.query(
        `SELECT tier, contractor_id, is_field_rep, is_attributable, rep_revenue_visibility
         FROM team_members WHERE id = $1`,
        [targetId]
      ),
    ]);

    if (!requesterResult.rows.length) return res.status(403).json({ error: 'Access denied' });
    if (!targetResult.rows.length) return res.status(404).json({ error: 'Member not found' });

    const requesterTier = requesterResult.rows[0].tier;
    const target = targetResult.rows[0];

    // Tenancy — 404, never 403, so a cross-tenant probe cannot confirm an id exists.
    if (target.contractor_id !== contractorId) return res.status(404).json({ error: 'Member not found' });

    // Only Owner may edit Admin-tier rows (mirrors the PATCH's wall).
    if (target.tier === 'admin' && requesterTier !== 'owner') {
      return res.status(403).json({ error: 'Only Owners may edit Admin-tier members' });
    }

    // Merge payload over current state; coherence is judged on the result.
    const merged = {
      is_field_rep:           req.body.is_field_rep           ?? target.is_field_rep,
      is_attributable:        req.body.is_attributable        ?? target.is_attributable,
      rep_revenue_visibility: req.body.rep_revenue_visibility ?? target.rep_revenue_visibility,
    };

    if (!merged.is_field_rep) {
      // Explicitly asking to switch an ability ON for a non-field-rep is a contradiction.
      if (req.body.is_attributable === true || req.body.rep_revenue_visibility === true) {
        return res.status(422).json({
          error: 'is_attributable and rep_revenue_visibility require is_field_rep',
        });
      }
      // Otherwise this is a demotion: cascade both dependent abilities off.
      merged.is_attributable = false;
      merged.rep_revenue_visibility = false;
    }

    // contractor_id repeated on the write (defense-in-depth, ST money-path pattern):
    // a mis-routed id from any future UI bug hits zero rows, never another tenant's row.
    const result = await pool.query(
      `UPDATE team_members
       SET is_field_rep = $1, is_attributable = $2, rep_revenue_visibility = $3
       WHERE id = $4 AND contractor_id = $5
       RETURNING id, email, full_name, tier, is_field_rep, is_attributable, rep_revenue_visibility`,
      [merged.is_field_rep, merged.is_attributable, merged.rep_revenue_visibility, targetId, contractorId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Member not found' });

    // Audit — same shape as the permission-save entry below: one activity_log row
    // per save, event_type='admin'/category='admin_action', actor and target carried
    // in the free-text detail (this table has no actor, target or contractor_id
    // columns). Non-transactional, matching that endpoint.
    //
    // The before→after values are what make this an audit trail rather than a
    // timestamp: a request carrying is_field_rep:false ALONE zeroes both dependent
    // abilities via the cascade above, and nothing else in the system records that.
    await pool.query(
      `INSERT INTO activity_log (event_type, detail, category)
       VALUES ('admin', $1, 'admin_action')`,
      [`Rep flags updated for team_member id=${targetId} by team_member id=${teamMemberId}: `
        + `field_rep ${target.is_field_rep}→${merged.is_field_rep}, `
        + `attributable ${target.is_attributable}→${merged.is_attributable}, `
        + `revenue_visibility ${target.rep_revenue_visibility}→${merged.rep_revenue_visibility}`]
    );

    res.json(result.rows[0]);
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/admin/team/:id/promote' });
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

    // ── BOTH HALVES COMMIT OR NEITHER DOES (Wave 1.1-b) ──────────────────────
    // These were two bare pool.query() calls with no transaction. Each ran in
    // its own implicit commit, so a failure on the UPDATE left the sessions
    // ALREADY DELETED while the member was still active=true: the caller saw a
    // 500 and the member simply logged back in. The revocation looked like it
    // had happened and had not.
    //
    // ⚠ THE ORDER IS LOAD-BEARING AND SO IS THE ATOMICITY. Deleting sessions
    // BEFORE flipping the flag is what has kept R4 (a live session belonging to
    // an inactive member) off every product path — see the active disjunct in
    // server/middleware/auth.js. A half-applied pair is precisely that state,
    // manufactured by an error. The two defects are one defect seen twice, and
    // they were closed together.
    //
    // Pattern copied from POST /api/admin/team/accept-invite above (:183-220)
    // and server/routes/referrer.js:2026-2038 — checked-out client, explicit
    // BEGIN/COMMIT/ROLLBACK, released in finally. The rethrow hands the error to
    // this route's existing catch so it is logged exactly once.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM sessions WHERE team_member_id = $1`, [targetId]);
      await client.query(`UPDATE team_members SET active = false WHERE id = $1`, [targetId]);
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'PATCH /api/admin/team/:id/deactivate' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/admin/team/:id/reactivate ─────────────────────────────────────
// DECISION E-min (C/DL-3c Phase 2c). The undo for the handler directly above.
//
// THE STARTING TRUTH. Until this route existed, `SET active = false` inside the
// deactivate handler was the ONLY post-creation write to that column anywhere in
// the codebase, and `PATCH /api/admin/team/:id` builds its UPDATE from a
// four-field allowlist — full_name, title_id, tier, jobber_user_id — that
// `active` cannot reach. An Owner who deactivated the wrong person on a Friday
// could not undo it without a direct database edit.
//
// ── WHAT IT DOES NOT DO, AND SAYING SO HERE IS THE POINT ────────────────────
// ⚠ IT DOES NOT RESTORE SESSIONS, AND IT MUST NOT TRY. Deactivation DELETEs the
// member's session rows; those tokens are gone and un-recreatable — a "restored"
// session would be a new bearer credential nobody asked for, handed out on an
// admin's behalf. The member signs in again, normally. This paragraph exists so
// that "reactivation didn't restore my session" is read as the design rather
// than filed as a bug.
//
// ⚠ THERE IS NO SELF-GUARD, AND ITS ABSENCE IS DELIBERATE. Its sibling refuses
// `targetId === teamMemberId` because deactivating yourself is a coherent
// request with an incoherent result. Reactivating yourself is not reachable at
// all: verifyAdminSession, requirePermission and GET /api/admin/me each read
// `active = true` independently (R4, closed in 9ad52f2), so an inactive member
// holds no session that could call this.
//
// ⚠ AND THERE IS NO LAST-OWNER-EQUIVALENT INVARIANT. Its sibling refuses to
// remove the last active Owner because that state is unrecoverable. Reactivation
// only ever ADDS an active member, so there is no equivalent floor to defend and
// nothing here should be built to look like one.
//
// ── WHAT IT DOES SHARE WITH ITS SIBLING ─────────────────────────────────────
// The same tenancy 404 (never 403 — a 403 confirms the id exists), and the same
// Owner-edits-Admin wall the PATCH and the promote handler carry. Without that
// wall an Admin could reactivate an Admin-tier row they were never permitted to
// edit in the first place.
//
// ── REACTIVATION TAKES EFFECT IMMEDIATELY, WITH NOTHING TO INVALIDATE ───────
// All three readers of `active` query it live per request, so there is no cache,
// no session rebuild and no propagation delay. The member logs in and is in.
router.patch('/api/admin/team/:id/reactivate', requirePermission('team.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId, teamMemberId } = adminSession;
  const targetId = parseInt(req.params.id, 10);

  try {
    const [requesterResult, targetResult] = await Promise.all([
      pool.query('SELECT tier FROM team_members WHERE id = $1 AND active = true', [teamMemberId]),
      // ⚠ NO `AND active = true` ON THE TARGET, unlike the deactivate handler's
      // lookup. An inactive row is the only kind this route has any business
      // reading; inheriting that predicate would make the route 404 on precisely
      // the members it exists to serve.
      pool.query('SELECT tier, contractor_id, active FROM team_members WHERE id = $1', [targetId]),
    ]);

    if (!requesterResult.rows.length) return res.status(403).json({ error: 'Access denied' });
    if (!targetResult.rows.length) return res.status(404).json({ error: 'Member not found' });

    const requesterTier = requesterResult.rows[0].tier;
    const target = targetResult.rows[0];

    // Tenancy — 404, never 403, so a cross-tenant probe cannot confirm an id exists.
    if (target.contractor_id !== contractorId) return res.status(404).json({ error: 'Member not found' });

    // Only Owner may edit Admin-tier rows (mirrors the PATCH and promote walls).
    if (target.tier === 'admin' && requesterTier !== 'owner') {
      return res.status(403).json({ error: 'Only Owners may edit Admin-tier members' });
    }

    // ── BOTH HALVES COMMIT OR NEITHER DOES ───────────────────────────────────
    // Same shape as the deactivate handler above, and for a sharper reason than
    // symmetry. The second statement clears Ruling B's `team_access_revoked_seen`
    // key, which is what makes a member's NEXT freeze announceable. A
    // half-applied pair — `active = true` committed with the stale key surviving
    // — produces a member who is back in AND whose second deactivation would be
    // completely silent, which is the exact defect Ruling B exists to fix,
    // manufactured by an error. Nothing would report it.
    //
    // The clear is unconditional and matching zero rows is an ordinary outcome:
    // most reactivated members never saw the notice, because most were never
    // deactivated while holding a homeowner account.
    //
    // ⚠ THE UPDATE REPEATS contractor_id (defense-in-depth, ST money-path
    // pattern) even though tenancy was already checked above — a mis-routed id
    // from any future refactor hits zero rows rather than another tenant's row.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE team_members SET active = true WHERE id = $1 AND contractor_id = $2`,
        [targetId, contractorId]
      );
      await clearPreference({
        db: client,
        subjectType: 'team_member',
        subjectId: targetId,
        contractorId,
        key: TEAM_ACCESS_REVOKED_SEEN_PREF_KEY,
      });
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'PATCH /api/admin/team/:id/reactivate' });
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

// ── FLAGGED ASSIGNMENTS QUEUE (FA spec §4) ────────────────────────────────────
// Resolving a flag IS a rep assignment — gated under rep_assignment, not team.manage
// (FQ-2). GET is a single segment ('flagged-assignments'); no existing GET
// /api/admin/team/:id route exists to collide with it. PATCH is two segments
// ('flagged-assignments/:id'), which never collides with the existing one-segment
// PATCH /api/admin/team/:id regardless of registration order.

// ── GET /api/admin/team/flagged-assignments ───────────────────────────────────
// Defaults to status=open; ?status=resolved|dismissed|auto_resolved reaches history.
// Hydrates reps_involved (a plain JSONB array of team_member ids) into {id, full_name}
// objects for display — orphan flags carry no reps_involved and render as [].
router.get('/api/admin/team/flagged-assignments', requirePermission('rep_assignment'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const status = ['open', 'resolved', 'dismissed', 'auto_resolved'].includes(req.query.status)
    ? req.query.status
    : 'open';

  try {
    const { rows } = await pool.query(
      `SELECT id, jobber_client_id, flag_reason, reps_involved, status, resolution,
              resolved_by, resolved_at, created_at
       FROM flagged_assignments
       WHERE contractor_id = $1 AND status = $2
       ORDER BY created_at DESC`,
      [contractorId, status]
    );

    const repIds = new Set();
    for (const row of rows) {
      if (Array.isArray(row.reps_involved)) row.reps_involved.forEach(id => repIds.add(id));
    }
    let repMap = {};
    if (repIds.size > 0) {
      const { rows: reps } = await pool.query(
        `SELECT id, full_name FROM team_members WHERE contractor_id = $1 AND id = ANY($2::int[])`,
        [contractorId, [...repIds]]
      );
      repMap = Object.fromEntries(reps.map(r => [r.id, r]));
    }

    const flags = rows.map(row => ({
      ...row,
      reps_involved: Array.isArray(row.reps_involved)
        ? row.reps_involved.map(id => repMap[id] || { id, full_name: null })
        : [],
    }));

    res.json({ flags });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/team/flagged-assignments' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/admin/team/flagged-assignments/:id ─────────────────────────────
// action: 'assign' (rep_id required) or 'dismiss' (optional note).
// Assign IS an Owner/Admin manual assignment (Decision B rule #4) — always allowed to
// set/override sticky_source='manual', since that path supersedes sticky-by-design
// (see docs/ASSIGNMENT_RULES_LOCKED.md). No branch cascade: referral inheritance does
// not exist yet, so there are no inherited descendants to walk (vacuously faithful).
// Everything below is one transaction: the client_rep_assignments manual-sticky write,
// the flagged_assignments resolution, and the activity_log row all commit together.
router.patch('/api/admin/team/flagged-assignments/:id', requirePermission('rep_assignment'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId, teamMemberId } = adminSession;
  const flagId = parseInt(req.params.id, 10);
  const { action, rep_id, note } = req.body;

  if (!['assign', 'dismiss'].includes(action)) {
    return res.status(422).json({ error: "action must be 'assign' or 'dismiss'" });
  }
  if (action === 'assign' && !Number.isInteger(rep_id)) {
    return res.status(422).json({ error: 'rep_id is required for assign' });
  }

  const resolution = action === 'assign'
    ? { action: 'assign', rep_id }
    : { action: 'dismiss', note: typeof note === 'string' ? note : null };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // THE single authoritative guard for this whole action: tenant scope (contractor_id)
    // and state scope (status='open') both live on this one WHERE clause — claim-and-resolve
    // in one atomic statement, not a separate lookup followed by a separately-scoped write.
    // This predicate is the exact tenant boundary the cross-tenant kill-shot test proves is
    // load-bearing (Phase 4 drop-the-predicate RED check) — a second, redundant tenant check
    // elsewhere would let that proof pass for the wrong reason.
    const claim = await client.query(
      `UPDATE flagged_assignments
       SET status = $1, resolution = $2::jsonb, resolved_by = $3, resolved_at = NOW()
       WHERE id = $4 AND contractor_id = $5 AND status = 'open'
       RETURNING id, jobber_client_id`,
      [action === 'assign' ? 'resolved' : 'dismissed', JSON.stringify(resolution), teamMemberId, flagId, contractorId]
    );

    if (claim.rows.length === 0) {
      await client.query('ROLLBACK');
      // Tenant-scoped existence check purely to pick the response code (404 vs 409) —
      // does not participate in write authorization, so it can't mask a broken write guard.
      const existsForTenant = await pool.query(
        `SELECT 1 FROM flagged_assignments WHERE id = $1 AND contractor_id = $2`,
        [flagId, contractorId]
      );
      return res.status(existsForTenant.rows.length ? 409 : 404)
        .json({ error: existsForTenant.rows.length ? 'Flag is not open' : 'Flag not found' });
    }
    const jobberClientId = claim.rows[0].jobber_client_id;

    if (action === 'assign') {
      const repResult = await client.query(
        `SELECT id FROM team_members WHERE id = $1 AND contractor_id = $2 AND is_attributable = true`,
        [rep_id, contractorId]
      );
      if (repResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: 'rep_id is not a valid attributable rep for this contractor' });
      }

      // No WHERE sticky_rep_id IS NULL guard here — unlike the engine's writeSticky,
      // a manual resolve-assign always supersedes any existing sticky value (rule #4).
      await client.query(
        `INSERT INTO client_rep_assignments
           (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at)
         VALUES ($1, $2, $3, 'manual', NOW(), NOW())
         ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
           sticky_rep_id = EXCLUDED.sticky_rep_id,
           sticky_source = EXCLUDED.sticky_source,
           sticky_set_at = EXCLUDED.sticky_set_at,
           updated_at    = EXCLUDED.updated_at`,
        [contractorId, jobberClientId, rep_id]
      );
    }

    await client.query(
      `INSERT INTO activity_log (event_type, detail, category) VALUES ('admin', $1, 'admin_action')`,
      [action === 'assign'
        ? `Flagged assignment #${flagId} resolved: assigned rep ${rep_id} (by team_member #${teamMemberId})`
        : `Flagged assignment #${flagId} dismissed (by team_member #${teamMemberId})`]
    );

    await client.query('COMMIT');
    res.json({ id: flagId, status: action === 'assign' ? 'resolved' : 'dismissed' });
  } catch (err) {
    await client.query('ROLLBACK');
    await logError({ req, error: err, source: 'PATCH /api/admin/team/flagged-assignments/:id' });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── TITLES CRUD ──────────────────────────────────────────────────────────────
// Titles are organizational labels only — they confer zero permissions.
// Routes use the /api/admin/titles prefix, which does not shadow any existing
// /api/admin/team/* param routes.

// ── GET /api/admin/titles ─────────────────────────────────────────────────────
// Session-only, NO requirePermission: any authenticated member — including a
// zero-permission General member — must read the title list to populate their
// self-select dropdown. Same rationale as GET /api/admin/me.
router.get('/api/admin/titles', async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT id, name FROM titles WHERE contractor_id = $1 ORDER BY name ASC`,
      [contractorId]
    );
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/titles' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/titles ────────────────────────────────────────────────────
router.post('/api/admin/titles', requirePermission('team.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Title name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO titles (contractor_id, name) VALUES ($1, $2) RETURNING id, name`,
      [contractorId, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'duplicate_title' });
    await logError({ req, error: err, source: 'POST /api/admin/titles' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /api/admin/titles/:id ───────────────────────────────────────────────
router.patch('/api/admin/titles/:id', requirePermission('team.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const titleId = parseInt(req.params.id, 10);
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Title name is required' });
  try {
    const result = await pool.query(
      `UPDATE titles SET name = $1 WHERE id = $2 AND contractor_id = $3 RETURNING id, name`,
      [name, titleId, contractorId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Title not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'duplicate_title' });
    await logError({ req, error: err, source: 'PATCH /api/admin/titles/:id' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/admin/titles/:id ──────────────────────────────────────────────
// Without ?confirm=true:
//   0 members holding the title → delete immediately.
//   ≥1 member holding → 409 { error: 'title_in_use', members_affected: N }.
// With ?confirm=true:
//   Transactionally SET NULL on all holders, then delete.
router.delete('/api/admin/titles/:id', requirePermission('team.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const titleId    = parseInt(req.params.id, 10);
  const withConfirm = req.query.confirm === 'true';

  const client = await pool.connect();
  try {
    const titleCheck = await client.query(
      `SELECT id FROM titles WHERE id = $1 AND contractor_id = $2`,
      [titleId, contractorId]
    );
    if (!titleCheck.rows.length) return res.status(404).json({ error: 'Title not found' });

    const countResult = await client.query(
      `SELECT COUNT(*) AS count FROM team_members WHERE title_id = $1 AND contractor_id = $2`,
      [titleId, contractorId]
    );
    const membersHolding = parseInt(countResult.rows[0].count, 10);

    if (!withConfirm) {
      if (membersHolding > 0) {
        return res.status(409).json({ error: 'title_in_use', members_affected: membersHolding });
      }
      await client.query(
        `DELETE FROM titles WHERE id = $1 AND contractor_id = $2`,
        [titleId, contractorId]
      );
      return res.json({ deleted: true, members_cleared: 0 });
    }

    // confirm=true: atomically clear all holders, then delete
    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE team_members SET title_id = NULL WHERE title_id = $1 AND contractor_id = $2`,
        [titleId, contractorId]
      );
      await client.query(
        `DELETE FROM titles WHERE id = $1 AND contractor_id = $2`,
        [titleId, contractorId]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    }

    res.json({ deleted: true, members_cleared: membersHolding });
  } catch (err) {
    await logError({ req, error: err, source: 'DELETE /api/admin/titles/:id' });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
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
    await refreshTokenIfNeeded(contractorId);
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
