'use strict';

const { pool } = require('../db');
const { logError } = require('./errorLogger');
const { ALL_FLAGS } = require('../permissions/registry');

/**
 * Middleware factory — enforces permission flags on admin routes.
 *
 * Three-step chain (in this exact order):
 *   1. Super-admin check  — role='super_admin' session bypasses everything.
 *   2. Owner short-circuit — tier='owner' bypasses flag check for their tenant.
 *   3. Flag check          — live read of team_members.permissions JSONB; absent = denied.
 *
 * Always returns 403 (not 401) on permission failure — the session is valid,
 * the permission is missing. The error message never leaks flag names.
 *
 * @param {string} flag - A flag string from the permission registry (e.g. 'dashboard').
 */
function requirePermission(flag) {
  if (!ALL_FLAGS.has(flag)) {
    // Fail loudly at server startup / route registration time if the flag is unknown.
    throw new Error(`requirePermission: unknown flag '${flag}'. Check server/permissions/registry.js.`);
  }

  async function permissionMiddleware(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    try {
      // ── STEP 1: look up the session ──────────────────────────────────────────
      const sessionResult = await pool.query(
        `SELECT role, contractor_id, team_member_id
         FROM sessions
         WHERE token = $1 AND expires_at > NOW()`,
        [token]
      );

      if (!sessionResult.rows.length) {
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }

      const session = sessionResult.rows[0];

      // ── STEP 1a: super-admin short-circuit ───────────────────────────────────
      // Super-admin sessions bypass all permission checks across all tenants.
      if (session.role === 'super_admin') {
        return next();
      }

      // Only admin sessions proceed from here.
      if (session.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!session.team_member_id) {
        // Legacy session created before team_member_id column existed — fail closed.
        return res.status(403).json({ error: 'Access denied' });
      }

      // ── STEP 2: look up the team member (live read — never cached on session) ─
      const memberResult = await pool.query(
        `SELECT tier, permissions FROM team_members WHERE id = $1 AND active = true`,
        [session.team_member_id]
      );

      if (!memberResult.rows.length) {
        // Team member deactivated since session was issued — fail closed.
        return res.status(403).json({ error: 'Access denied' });
      }

      const member = memberResult.rows[0];

      // ── STEP 2a: Owner short-circuit ─────────────────────────────────────────
      // Owner tier has implicit access to every flag within their tenant.
      // The permissions JSONB is never consulted for Owners.
      if (member.tier === 'owner') {
        return next();
      }

      // ── STEP 3a: cashout_approve defense-in-depth ────────────────────────────
      // General-tier members can never satisfy cashout_approve, even if the flag
      // is somehow present and true in their JSONB (defense-in-depth: the
      // save-permissions endpoint is the first layer; this is the second).
      if (flag === 'cashout_approve' && member.tier === 'general') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // ── STEP 3b: flag check ──────────────────────────────────────────────────
      // Absent flag must read as denied — fail closed, not open.
      const permissions = member.permissions || {};
      if (permissions[flag] !== true) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return next();
    } catch (err) {
      await logError({ req, error: err, source: `requirePermission('${flag}')` });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  permissionMiddleware.permission = flag;
  return permissionMiddleware;
}

module.exports = { requirePermission };
