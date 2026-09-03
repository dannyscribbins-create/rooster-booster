'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SESSION LIFECYCLE — C/DL-3b Phase 4, decisions D6 and D7.
//
// Three cross-surface endpoints:
//   GET  /api/session           validate a stored token and describe its owner
//   GET  /api/session/branding  resolve the session's contractor branding (BR-1)
//   POST /api/logout            delete the session row server-side
//
// WHY ITS OWN ROUTER RATHER THAN referrer.js OR admin/. All three are
// ROLE-AGNOSTIC by construction — the whole point is that the caller does not
// yet know which surface the token belongs to. Filing them under either
// surface's router would misfile them and, worse, imply a scoping that does
// not exist. This follows the precedent branding.js set in Phase 1: a
// cross-cutting, self-contained concern gets its own file and its own mount.
//
// NO RATE LIMITER ON ANY OF THEM, DELIBERATELY. All three are keyed on a
// 64-character hex token: there is nothing to enumerate and nothing to guess in
// any practical number of attempts. The two GETs fire once per app boot, so a
// limiter tight enough to matter would break legitimate use behind shared NAT —
// a support problem in exchange for no security gain.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const { pool } = require('../db');
const { verifyAnySession } = require('../middleware/auth');
const { logError } = require('../middleware/errorLogger');
// The ONE branding SELECT in the codebase (BR-1 Phase 1). See the route below
// for why it is reused rather than reimplemented here.
const { loadContractorBranding } = require('../utils/landingResolve');

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
        // ⚠ MUST AGREE WITH POST /api/login's team payload for the same member
        // (C/DL-3b Phase 5). Routing happens at two moments — fresh login and boot
        // rehydration — and if these two sources ever disagreed the symptom would
        // be a person landing on one surface when they sign in and another when
        // they refresh, with nothing failing. server/test/repRouting.test.js pins
        // the agreement rather than each value.
        is_field_rep: session.member.is_field_rep,
        permissions: session.member.permissions || {},
      });
    }

    return res.json({ role: 'super_admin' });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/session' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/session/branding — THE D4 CHAIN'S SOURCE 1 (BR-1 Phase 1) ───────
//
// Answers "whose brand is this?" for a caller who is already signed in, from the
// SESSION and from nothing else.
//
// ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────
// `resolveFromSession` in src/utils/brandingChain.js was `return null` — the
// whole body — because there was nothing for it to ask. BR Phase 0 §3.3
// enumerated every candidate and found no server-side branding source for an
// authenticated session outside the admin panel. Source 1 is FIRST in the chain,
// so while it declined, a logged-in user's branding was decided by a `?brand=`
// parameter, a localStorage hint, or nothing at all — never by who they are.
//
// ⚠ TENANCY. The contractor comes from `verifyAnySession()` and from NOWHERE
// ELSE — not the body, not a query parameter, not a header, not the hint. This
// is the shape POST /api/admin/branding/logo already follows for its own
// contractor_id, and it is what makes this source unspoofable where sources 2,
// 2.5 and 3 are cosmetic-by-necessity. A client-supplied channel here would turn
// a branding read into a tenancy input, which CD-24 R1 forbids outright.
//
// ROLE-AGNOSTIC, deliberately, and that is why it lives in this file rather than
// under referrer.js or admin/. The referrer app and the rep surface BOTH render
// inside ThemeProvider and hold different token keys; the caller does not know
// which surface its stored token belongs to, which is the exact condition
// `verifyAnySession()` exists for.
//
// ⚠ NOT MOUNTED AT /api/branding/session. `session` is NOT in RESERVED_SLUGS
// (server/utils/contractorSlug.js) and is a well-formed slug, so a contractor
// could legitimately be issued it. A literal segment sharing a prefix with
// `/api/branding/:slug` would collide, and which one won would depend on
// registration order — a silent dependency of exactly the kind this repo keeps
// finding. A distinct prefix has no ordering hazard at all.
//
// ── WHAT IT RETURNS, AND WHY THE KEY IS OMITTED RATHER THAN NULLED ──────────
//   { branding: <resolveBrandingTheme output> }   the session has a contractor
//   {}                                            it does not (a super admin)
//
// The same D-I convention GET /api/admin/me follows: the key's ABSENCE says
// "resolution did not happen", which is a different fact from "resolved to
// nothing". A super admin holds a real session and belongs to no contractor;
// that is neither an error nor a branding answer, and the chain reads the
// missing key as a non-answer and walks on to source 2.
//
// NO SLUG, NO contractor_id, NO TOKEN ECHO. The payload is a company name, a
// program name, four colours, a logo URL and the public contact details a
// contractor already prints on a yard sign — the same slug-dropping destructure
// GET /api/branding/:slug and GET /api/admin/me both perform, for the same
// CD-24 R1 reason.
//
// loadContractorBranding IS REUSED RATHER THAN REIMPLEMENTED. It is the one
// branding SELECT in the codebase; a second one here would be the drift that
// server/utils/landingResolve.js's header exists to prevent, and which has
// already happened once in this repo.
//
// NO RATE LIMITER, matching GET /api/session directly above: keyed on a
// 64-character hex token, nothing to enumerate, and it fires once per app boot,
// so a limiter tight enough to matter would break shared NAT for no gain.
//
// ⚠ IT SLIDES THE SESSION, because verifyAnySession() calls applySessionSlide().
// That is a WRITE, throttled to at most one per session per hour, and it is the
// same behaviour GET /api/session has. Stated here because "a branding read must
// never write" is the rule that kept this off GET /api/invite/:slug — the
// distinction is that a scan event is data ABOUT the read, while a slide is the
// session lifecycle doing what every authenticated request already does to it.
router.get('/api/session/branding', async (req, res) => {
  try {
    const session = await verifyAnySession(req, res);
    if (!session) return; // verifyAnySession already answered 401

    // A super admin is platform-level and belongs to no contractor. Not an error.
    if (!session.contractorId) return res.json({});

    const branding = await loadContractorBranding(pool, session.contractorId);
    if (!branding) return res.json({});

    // SLUG DROPPED, DELIBERATELY — the same line GET /api/branding/:slug and
    // GET /api/admin/me both perform. loadContractorBranding re-attaches it
    // because its landing-page callers need it; this route must not return it.
    // Destructured away rather than deleted so the omission is visible at the
    // one line that performs it.
    const { slug: _slugNotReturned, ...theme } = branding;
    return res.json({ branding: theme });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/session/branding' });
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
