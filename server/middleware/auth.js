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
    // ── THE active DISJUNCT — R4, closed in Wave 1.1-b ───────────────────────
    // This function used to query `sessions` alone and never look at
    // team_members, so a DEACTIVATED member holding a live token kept working
    // on every session-only route. It was unreachable in practice only because
    // deactivation deletes sessions FIRST (server/routes/admin/team.js), which
    // is an ordering, not a guarantee — and the same Wave made that pair
    // transactional so the ordering can no longer half-apply.
    //
    // FOUR CASES, AND ONLY THE THIRD AND FOURTH ARE NEW BEHAVIOUR:
    //   team_member_id IS NULL   → ALLOWED. Deliberately unchanged; see below.
    //   member active = true     → allowed.
    //   member active = false    → DENIED. This is R4.
    //   member row deleted       → DENIED. See the three-valued note below.
    //
    // ⚠ THE DELETED-ROW DENIAL IS THREE-VALUED LOGIC, NOT A WRITTEN BRANCH.
    // On a LEFT JOIN miss `tm.active` is NULL, so `tm.active = true` evaluates
    // to NULL — not false — and the whole disjunct is NULL, which WHERE treats
    // as not-true and filters the row out. It fails closed, but nothing on this
    // line says so, which is exactly how a later reader "simplifies" it.
    // ⚠ DO NOT REWRITE THIS AS `tm.active IS NOT FALSE`. That reads as
    // equivalent and is not: NULL IS NOT FALSE is TRUE, so a session pointing
    // at a deleted member would be ALLOWED. server/test/adminSessionActive.test.js
    // fences both spellings.
    //
    // ⚠ AND THE NULL CASE DEPENDS ON A FOREIGN KEY THAT LIVES ELSEWHERE.
    // `sessions_team_member_id_fkey` is ON DELETE NO ACTION, which is what makes
    // a dangling team_member_id unreachable. If a migration ever changes it to
    // SET NULL, deleting a member NULLs their live session's team_member_id and
    // the legacy branch above ALLOWS it — a deleted employee keeps their access,
    // introduced by someone who never opened this file. There is a tripwire on
    // that FK in server/test/adminSessionActive.test.js; it exists for this line.
    //
    // ⚠ WHY LEFT JOIN AND NOT INNER, WHICH IS WHAT verifyReferrerSession USES.
    // A legacy admin session predating the team_member_id column carries NULL,
    // and rejecting those is a DIFFERENT change from R4. They are already failed
    // closed everywhere it matters — server/middleware/permissions.js:58-61 and
    // GET /api/admin/me's own `AND active = true`. An INNER JOIN would also
    // break server/test/contractorContext.test.js:202-207, which characterises
    // this exact behaviour, and would invalidate every admin session minted by
    // server/test/helpers.js's seedSession(), which does not set the column.
    // Tighten it deliberately, in its own change, or not at all.
    //
    // A super-admin session is NOT affected and cannot be: it carries
    // role='super_admin' and is filtered out by `s.role=$2` one clause below,
    // before the join is ever consulted.
    const result = await pool.query(
      `SELECT s.id, s.contractor_id, s.team_member_id, s.created_at, s.expires_at
         FROM sessions s
         LEFT JOIN team_members tm ON tm.id = s.team_member_id
        WHERE s.token=$1 AND s.role=$2 AND s.expires_at > NOW()
          AND (s.team_member_id IS NULL OR tm.active = true)`,
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
