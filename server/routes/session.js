'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SESSION LIFECYCLE — C/DL-3b Phase 4, decisions D6 and D7.
//
// Two cross-surface endpoints:
//   GET  /api/session   validate a stored token and describe its owner
//   POST /api/logout    delete the session row server-side
//
// WHY ITS OWN ROUTER RATHER THAN referrer.js OR admin/. Both endpoints are
// ROLE-AGNOSTIC by construction — the whole point is that the caller does not
// yet know which surface the token belongs to. Filing them under either
// surface's router would misfile them and, worse, imply a scoping that does
// not exist. This follows the precedent branding.js set in Phase 1: a
// cross-cutting, self-contained concern gets its own file and its own mount.
//
// NO RATE LIMITER, DELIBERATELY. Both routes are keyed on a 64-character hex
// token: there is nothing to enumerate and nothing to guess in any practical
// number of attempts. GET /api/session fires once per app boot, so a limiter
// tight enough to matter would break legitimate use behind shared NAT — a
// support problem in exchange for no security gain.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const { pool } = require('../db');
const { verifyAnySession } = require('../middleware/auth');
const { logError } = require('../middleware/errorLogger');

const router = express.Router();

// ── GET /api/session — BOOT REHYDRATION (D7, piece 2) ────────────────────────
//
// Answers "is this stored token still good, and whose is it?" so the client can
// restore its session instead of dumping the person at the login screen on
// every refresh.
//
// THE RESPONSE NEVER ECHOES THE TOKEN. The caller already has it; sending it
// back only widens the number of places it can leak (logs, proxies, history).
//
// DELIBERATELY DOES NOT RETURN THE ANNOUNCEMENT PAYLOAD that POST /api/login
// does. Login happens once and a popup is welcome; rehydration happens on every
// refresh, and re-firing the announcement each time would turn a nice touch
// into a nuisance. Announcements stay a login-only concern.
router.get('/api/session', async (req, res) => {
  try {
    const session = await verifyAnySession(req, res);
    if (!session) return; // verifyAnySession already answered 401

    if (session.role === 'referrer') {
      return res.json({
        role: 'referrer',
        contractorId: session.contractorId,
        name: session.user.full_name,
        email: session.user.email,
      });
    }

    if (session.role === 'team') {
      return res.json({
        role: 'team',
        contractorId: session.contractorId,
        tier: session.member.tier,
        permissions: session.member.permissions || {},
      });
    }

    return res.json({ role: 'super_admin' });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/session' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/logout — THE ROW GOES (D6) ─────────────────────────────────────
//
// Before this route existed, all three surfaces "logged out" by removing a key
// from sessionStorage and the bearer token stayed valid server-side for its
// full lifetime. This deletes the row.
//
// NOT AN AUTH CHECK, AND SO NOT A verify*Session() CALL. Nothing is being
// authorised here — possessing the token is the entire claim, and the only
// thing it entitles the holder to is destroying it. Scoping the DELETE to the
// presented token is what keeps one device's logout from ending another's.
//
// ALWAYS 200, EVEN FOR AN UNKNOWN OR ABSENT TOKEN. A 404 on a token that does
// not exist would turn this route into an oracle: present a guess, read the
// status, learn whether it is real. Idempotent-200 says nothing either way.
//
// THE CLIENT PRESERVES rm_brand_hint (CD-24 R3) — see src/utils/authStorage.js.
// The hint is cosmetic, grants nothing, and is what lets a returning visitor
// see their contractor's brand before typing. Logging out is not a reason to
// forget which company the person belongs to.
router.post('/api/logout', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  try {
    if (token) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    }
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/logout' });
    // Still 200. A failed delete is this server's problem to fix, not a reason
    // to leave the client believing it is still signed in — the client clears
    // its stored token either way, so a 500 here would only strand the UI.
    res.json({ success: true });
  }
});

module.exports = router;
