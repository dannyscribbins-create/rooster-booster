'use strict';

const express = require('express');
const router = express.Router();

const { verifyAdminSession } = require('../middleware/auth');
const { isActiveFieldRep } = require('../utils/repAccess');
const { logError } = require('../middleware/errorLogger');

// ─── THE REP SURFACE'S OWN PREFIX (Canvass-3, amendment A34.3) ───────────────
//
// A34.3 rules the boundary: the rep app MAY keep calling the three session-only
// admin routes the server already allowlists deliberately — GET /api/admin/me,
// GET /api/admin/titles, PATCH /api/admin/me/title — and GENUINELY NEW rep data
// lives here instead. This file is "here".
//
// ⚠ MOUNTED AT '/' IN createApp(), AND THAT IS NOT A STYLE CHOICE — IT IS THE
// ONLY MOUNT UNDER WHICH THIS SURFACE CAN BE GUARDED AT ALL.
// `server/test/helpers/adminRouterIntrospection.js`'s collectRoutes() matches a
// MOUNT-RELATIVE path and never accumulates the mount prefix as it recurses. A
// router mounted at '/api/rep' surfaces from that walk as 'GET /me', so a
// '/api/rep/' prefix would collect ZERO routes and **every assertion over it
// would pass vacuously**. That is not hypothetical: `accountRoutes` is mounted
// at '/api/account' and its FIFTEEN routes have never been seen by any walk.
//
// ⚠ SO: DO NOT "TIDY" THIS TO app.use('/api/rep', repRoutes) AND DROP THE
// PREFIX FROM THE PATHS. It produces identical URLs, identical behaviour, and a
// silently unguarded surface — the guards would keep reporting green over
// nothing. The full path is written on every route here for exactly that
// reason.
//
// ── WHAT THIS PHASE DOES *NOT* BUILD ────────────────────────────────────────
// No client data, no catalogue, no detail view, no revenue. Canvass-4 onward
// own those, and A34.4/A34.6/A34.8 govern them. Canvass-3's product is the
// BOUNDARY: a counted, fenced, guarded prefix, so that Canvass-4's first real
// route lands inside a fence instead of outside one.
//
// ── ⚠ NO REGISTRY ENTRY, BY RULING (Danny, 2026-09-17) ──────────────────────
// The permission registry stays PERMISSION-ONLY. Rep routes get no flag,
// because they are guarded by IDENTITY — an active field rep, scoped to their
// own book — and not by a permission flag. A registry entry would be a second,
// weaker answer to a question identity already answers, and
// `registryReconciliation.test.js` collects only routes carrying
// `.handle.permission`, so these are structurally skipped exactly as the three
// public admin routes are. **Do not add requirePermission() here to "match the
// admin side".** It would make `ownerParity` and `registryReconciliation`
// applicable to a surface neither was written for, and it would gate a rep out
// of their own app on an empty permissions JSONB.

// ── GET /api/rep/me ─────────────────────────────────────────────────────────
//
// THE SMALLEST ROUTE THAT PROVES THE FENCE, AND IT IS A REAL ONE RATHER THAN A
// PING. It answers the one question the rep surface can honestly ask before any
// rep data exists: *who has this session verified me as, on which tenant?* That
// is precisely what the guard below established, so the route makes the guard's
// own output OBSERVABLE — a guard whose result nothing reads is a mechanism
// reporting a state nobody can check.
//
// ⚠ IT IS NOT A SECOND /api/admin/me AND MUST NOT GROW INTO ONE. That route
// returns branding, the permissions JSONB, the title and the capability flags,
// and A34.3 deliberately leaves the rep app calling it. This one returns ONLY
// the identity this prefix's own guard verified. If a field here starts
// duplicating one there, the duplicate is the bug.
//
// ⚠ AND IT CARRIES NO CAPABILITY FLAGS ON PURPOSE. `rep_revenue_visibility` is
// A34.6's subject and its response shape is ruled but not built; putting it
// here now would pre-commit Canvass-5's contract from a phase that ships no
// revenue path to test it against.
router.get('/api/rep/me', async (req, res) => {
  // ⚠ THE VERIFIER IS CALLED HERE, IN THE HANDLER, AND NOT HIDDEN BEHIND THE
  // PREDICATE BELOW. `sessionAuthInvariant`'s assertion A reads the handler's
  // OWN SOURCE TEXT (fn.toString(), comments stripped) for a verify*Session
  // call — its header records that "a route delegating auth to a helper would
  // read as a violation even though it is correct". Keeping the call visible
  // means this route satisfies that guard honestly, rather than by widening
  // SESSION_VERIFIER_RE, which that file calls a deliberate security decision.
  const session = await verifyAdminSession(req, res);
  if (!session) return;

  try {
    // ⚠ THE IDENTITY HALF IS A SEPARATE QUESTION FROM THE SESSION HALF.
    // verifyAdminSession proves "a live team session on this tenant". It knows
    // NOTHING about is_field_rep — an owner, an admin and an office-staff
    // general are all indistinguishable to it. This is what makes the surface
    // rep-only.
    //
    // ⚠ AND IT IS CALLED PER-ROUTE, NEVER AS router.use(). See repAccess.js's
    // header: prefix-mounting this predicate is the first of the three recorded
    // ways a rep-router build opens referrer dark mode.
    const allowed = await isActiveFieldRep({
      teamMemberId: session.teamMemberId,
      contractorId: session.contractorId,
    });

    // ⚠ NOT GENERAL-TIER-ONLY, AND THE ABSENCE OF A TIER PREDICATE IS THE RULE
    // RATHER THAN AN OVERSIGHT. A25 rules that a general-tier field rep is
    // switcher-eligible, and A34.3's surface is reached by owner-reps and
    // admin-reps THROUGH THE SWITCHER — `surfaceFor()` sends them to the admin
    // panel by default, and the switcher is how they cross. A `tier =
    // 'general'` predicate here would 403 exactly the people the switcher
    // exists to carry, and it would fail in the one direction nobody tests: the
    // owner who also sells.
    if (!allowed) {
      // A TYPED BODY, NOT EXPRESS'S OWN 404/HTML. C/DL-3c Phase 2c's lesson:
      // a negative test that accepts the framework's default page is asserting
      // that a route does not exist, which is true of every path in the world.
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      // Every value comes from the VERIFIED session or the guard's own read —
      // never from the request. CLAUDE.md, Security Standards.
      teamMemberId: session.teamMemberId,
      contractorId: session.contractorId,
      isFieldRep: true,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/rep/me' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
