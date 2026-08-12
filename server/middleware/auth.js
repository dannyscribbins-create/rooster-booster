'use strict';

const { pool } = require('../db');
const { logError } = require('./errorLogger');
const { computeSessionSlide } = require('../utils/sessionPolicy');

// ─────────────────────────────────────────────────────────────────────────────
// SLIDING EXPIRY — C/DL-3b Phase 4, decision D7.
//
// Every successful verify below is evidence the person is still using the app,
// and is therefore where the session's clock gets pushed forward. The policy
// itself lives in utils/sessionPolicy.js; this is only its application.
//
// THREE PROPERTIES THIS FUNCTION MUST KEEP:
//
//  1. It never fails the caller's request. A slide is bookkeeping — if the
//     write throws, the request the user actually made still succeeds. The
//     error is logged, not surfaced.
//  2. The UPDATE is guarded by `expires_at < $2`, so two concurrent requests
//     racing to slide the same session cannot move expiry BACKWARD. The guard
//     makes the write monotonic at the database rather than trusting the two
//     readers to have seen the same row.
//  3. created_at is never touched. It is the anchor the 90-day cap measures
//     from; rewriting it on each slide would make the ceiling unreachable and
//     turn every session immortal. sessionPersistence.test.js asserts this.
// ─────────────────────────────────────────────────────────────────────────────
async function applySessionSlide(req, { sessionId, createdAt, expiresAt }) {
  try {
    const decision = computeSessionSlide({ createdAt, expiresAt });
    if (!decision.shouldBump) return;
    await pool.query(
      'UPDATE sessions SET expires_at = $2 WHERE id = $1 AND expires_at < $2',
      [sessionId, decision.nextExpiresAt]
    );
  } catch (err) {
    await logError({ req, error: err, source: 'applySessionSlide' });
  }
}

/**
 * Verifies an admin session token.
 * @returns {{ contractorId: string, teamMemberId: number|null }} on success
 * @returns {null} on failure (also sends 401/500 response)
 */
async function verifyAdminSession(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authorized' }); return null; }
  try {
    const result = await pool.query(
      `SELECT s.id, s.contractor_id, s.team_member_id, s.created_at, s.expires_at
         FROM sessions s
        WHERE s.token=$1 AND s.role=$2 AND s.expires_at > NOW()`,
      [token, 'admin']
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return null;
    }
    const row = result.rows[0];
    await applySessionSlide(req, { sessionId: row.id, createdAt: row.created_at, expiresAt: row.expires_at });
    return {
      contractorId: row.contractor_id,
      teamMemberId: row.team_member_id,
    };
  } catch (err) {
    logError({ req, error: err, source: 'verifyAdminSession' });
    res.status(500).json({ error: 'Auth check failed' });
    return null;
  }
}

/**
 * Verifies a referrer session token.
 * Checks sessions table for a valid non-expired referrer session,
 * and confirms the user account has not been soft-deleted.
 * @returns {{ userId: number }} on success
 * @returns {null} on failure (also sends 401 response)
 */
async function verifyReferrerSession(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authorized' }); return null; }
  try {
    const result = await pool.query(
      `SELECT s.id AS session_id, s.user_id, s.contractor_id, s.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1
         AND s.role = $2
         AND s.expires_at > NOW()
         AND u.deleted_at IS NULL
         AND s.contractor_id IS NOT NULL`,
      [token, 'referrer']
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return null;
    }
    const row = result.rows[0];
    await applySessionSlide(req, { sessionId: row.session_id, createdAt: row.created_at, expiresAt: row.expires_at });
    return {
      userId: row.user_id,
      sessionId: row.session_id,
      contractorId: row.contractor_id,
    };
  } catch (err) {
    logError({ req, error: err, source: 'verifyReferrerSession' });
    res.status(500).json({ error: 'Auth check failed' });
    return null;
  }
}

/**
 * Verifies a super-admin session token.
 * Checks sessions table for a valid non-expired session with role='super_admin'.
 *
 * Future hook point (Phase 4 RBAC): super_admin role here bypasses any
 * requirePermission() check once that middleware is built. See Decision A spec.
 *
 * @returns {boolean} true on success, false on failure (also sends 401 response)
 */
async function verifySuperAdminSession(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authorized' }); return false; }
  try {
    const result = await pool.query(
      'SELECT id, created_at, expires_at FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'super_admin']
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return false;
    }
    const row = result.rows[0];
    await applySessionSlide(req, { sessionId: row.id, createdAt: row.created_at, expiresAt: row.expires_at });
    return true;
  } catch (err) {
    logError({ req, error: err, source: 'verifySuperAdminSession' });
    res.status(500).json({ error: 'Auth check failed' });
    return false;
  }
}

/**
 * ROLE-AGNOSTIC session verification — C/DL-3b Phase 4 (D7, boot rehydration).
 *
 * WHY THIS EXISTS RATHER THAN THE ROUTE CALLING ONE OF THE THREE ABOVE. On boot
 * the client holds a token and does NOT know what it is. Trying each of the
 * three verifiers in turn would send a 401 on the first miss (they write their
 * own responses), and picking one by guessing the surface would defeat the
 * point of a unified login. So the lookup runs once, role-agnostically, and
 * branches afterward — which also keeps every auth query inside this module
 * rather than inlining one in a route file.
 *
 * Resolves the IDENTITY too, not merely the session, because a session whose
 * owner is gone must not rehydrate: a soft-deleted homeowner and a deactivated
 * team member both land on 401 here.
 *
 * NOTE — THE `active` CHECK BELOW IS STRICTER THAN verifyAdminSession(). That
 * function does not join team_members at all (spec §10, PRE-LAUNCH item R4).
 * Closing R4 generally is out of Phase 4's scope, but this endpoint is new and
 * there is no reason to build the gap into it. The inconsistency runs in the
 * SAFE direction: a deactivated member fails to rehydrate and is shown the
 * login screen.
 *
 * @returns {object|null} a role-shaped descriptor, or null after sending 401.
 */
async function verifyAnySession(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const deny = () => { res.status(401).json({ error: 'Not authorized' }); return null; };
  if (!token) return deny();
  try {
    const { rows } = await pool.query(
      `SELECT id, role, user_id, team_member_id, contractor_id, created_at, expires_at
         FROM sessions
        WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (!rows.length) return deny();
    const s = rows[0];

    if (s.role === 'referrer') {
      const { rows: users } = await pool.query(
        `SELECT id, full_name, email FROM users
          WHERE id = $1 AND deleted_at IS NULL`,
        [s.user_id]
      );
      if (!users.length || !s.contractor_id) return deny();
      await applySessionSlide(req, { sessionId: s.id, createdAt: s.created_at, expiresAt: s.expires_at });
      return {
        role: 'referrer',
        sessionId: s.id,
        contractorId: s.contractor_id,
        user: users[0],
      };
    }

    if (s.role === 'admin') {
      // A legacy admin session with no team_member_id cannot be described, and
      // a deactivated member must not be restored — both are 401.
      if (!s.team_member_id) return deny();
      const { rows: members } = await pool.query(
        // is_field_rep is here for ROUTING on boot rehydration (C/DL-3b Phase 5),
        // never for authorisation. It must match what POST /api/login reported for
        // the same member, or a page refresh lands them on a different surface
        // than signing in did.
        `SELECT id, tier, permissions, active, is_field_rep FROM team_members WHERE id = $1`,
        [s.team_member_id]
      );
      if (!members.length || !members[0].active) return deny();
      await applySessionSlide(req, { sessionId: s.id, createdAt: s.created_at, expiresAt: s.expires_at });
      return {
        role: 'team',
        sessionId: s.id,
        contractorId: s.contractor_id,
        member: members[0],
      };
    }

    if (s.role === 'super_admin') {
      await applySessionSlide(req, { sessionId: s.id, createdAt: s.created_at, expiresAt: s.expires_at });
      return { role: 'super_admin', sessionId: s.id };
    }

    // An unrecognised role is not a session this build knows how to restore.
    return deny();
  } catch (err) {
    await logError({ req, error: err, source: 'verifyAnySession' });
    res.status(500).json({ error: 'Auth check failed' });
    return null;
  }
}

module.exports = {
  verifyAdminSession,
  verifyReferrerSession,
  verifySuperAdminSession,
  verifyAnySession,
  applySessionSlide,
};
