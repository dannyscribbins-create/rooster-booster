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
// ── WHAT IT RETURNS, AND WHY EACH KEY IS OMITTED RATHER THAN NULLED ─────────
//   { branding: <resolveBrandingTheme output>, slug }  contractor, with a slug
//   { branding: <resolveBrandingTheme output> }        contractor, slug is NULL
//   {}                                                 no contractor (super admin)
//
// The same D-I convention GET /api/admin/me follows: the key's ABSENCE says
// "resolution did not happen", which is a different fact from "resolved to
// nothing". A super admin holds a real session and belongs to no contractor;
// that is neither an error nor a branding answer, and the chain reads the
// missing key as a non-answer and walks on to source 2.
//
// ── ⚠ THE SLUG IS RETURNED, AND THAT REVERSED IN BR-1 PHASE 1-B ────────────
// This paragraph read "NO SLUG, NO contractor_id, NO TOKEN ECHO … the same
// slug-dropping destructure GET /api/branding/:slug and GET /api/admin/me both
// perform, for the same CD-24 R1 reason." The contractor_id and token halves
// are unchanged and still binding. The slug half was wrong for THIS route, and
// the cost of it was a regression rather than a theoretical one.
//
// WHY PHASE 1 DROPPED IT: BR Phase 0 §3.7 established that resolution needs no
// slug, which is true, and Phase 1 concluded the response therefore should not
// carry one. But CD-24 R2 also requires an authenticated answer to REWRITE the
// stored hint — and THE HINT STORES A SLUG. With none in the payload the only
// faithful action was to REMOVE the hint, which closed the planted-hint hole
// and, in the same stroke, erased the legitimate value that made a returning
// signed-out visitor see their own contractor. The logged-out branding path was
// switched off as a side effect of fixing the logged-in one.
//
// WHY IT IS SAFE HERE AND STILL FORBIDDEN THERE. The non-enumerability posture
// exists so that nobody can DISCOVER OTHER contractors' slugs — that is what
// makes GET /api/branding/:slug refuse to say whether a slug resolved, and it is
// the whole of the concern. This route is authenticated and returns EXACTLY ONE
// slug: the caller's own, derived from the session row. It hands a signed-in
// person the label of the contractor they already reached the product through.
// Nothing is discoverable that was not already held.
// ⚠ THE SAFETY ARGUMENT IS "THEIR OWN SLUG AND NO OTHER", SO IT IS PINNED BY A
// TEST RATHER THAN LEFT AS REASONING — see the scope test in
// server/test/sessionBranding.test.js. A future edit that let any client-supplied
// value choose which slug comes back would keep this comment true-looking and
// reverse the posture for real.
//
// STILL NO contractor_id AND NO TOKEN ECHO.
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

    // ⚠ THE SLUG IS RETURNED, AND THIS LINE REVERSED IN BR-1 PHASE 1-B. It read
    // `const { slug: _slugNotReturned, ...theme } = branding;` with a note that
    // this route "must not return it", citing GET /api/branding/:slug and
    // GET /api/admin/me. See the header above for why that was wrong HERE and
    // stays right THERE — and note the slug is a SIBLING of `branding`, never a
    // field inside it: CD-24 R1 governs the branding object, and nothing about
    // this change puts an identity value where a consumer could mistake it for
    // a brand value.
    //
    // OMITTED WHEN THE CONTRACTOR HAS NO SLUG, never nulled and never ''. The
    // client's write-through reads truthiness: a slug means REWRITE the hint to
    // it, no slug means REMOVE the hint. An empty string would be written into
    // the hint as a value, and source 3 would then read a key that exists and
    // resolves to nothing — the one state neither branch intends.
    const { slug, ...theme } = branding;
    const hasSlug = typeof slug === 'string' && slug.trim() !== '';
    return res.json({ branding: theme, ...(hasSlug ? { slug } : {}) });
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
