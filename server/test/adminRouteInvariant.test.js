'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { collectAdminRoutes } = require('./helpers/adminRouterIntrospection');
const { createApp } = require('../app');

// ─────────────────────────────────────────────────────────────────────────────
// THE INVARIANT: every route carrying a permission gate must ALSO call a
// verify*Session. Wave 1.1-a.
//
// WHY IT MATTERS. server/middleware/permissions.js:49-51 returns next() for
// role='super_admin' on EVERY gated route, cash-out approval and the Stripe ACH
// transfer endpoint included. That bypass is latent for exactly one reason: all
// 130 gated routes independently call verifyAdminSession(), which filters
// role='admin', so a super-admin token clears the middleware and then 401s in
// the handler.
//
// ⚠ THE INVARIANT IS HELD BY REPETITION ACROSS 130 CALL SITES, NOT BY
// STRUCTURE. Nothing asserted it before this file. The day someone adds a gated
// route that omits the session call, the bypass goes live with a green suite.
//
// ── WHY THIS IS A SOURCE-TEXT TEST AND NOT A MIDDLEWARE-STACK WALK ──────────
// verifyAdminSession() is called INSIDE THE HANDLER BODY, not mounted as
// middleware:
//     router.get('/api/admin/x', requirePermission('y'), async (req, res) => {
//       const adminSession = await verifyAdminSession(req, res);
//       if (!adminSession) return;
// A stack walk sees requirePermission (a real layer) and the handler (one
// opaque function). It cannot see anything the handler DOES. So the only way to
// assert this invariant without rewriting 130 routes is to read the handler's
// source via fn.toString().
//
// Wave 0 priced exactly this tradeoff for T5 in the tag-wipe suite and chose
// source-text deliberately. Same reasoning, same conclusion, recorded here so
// the next reader does not "improve" this into a stack walk that cannot work.
//
// ⚠ WHAT A SOURCE-TEXT TEST COSTS, STATED SO IT IS NOT DISCOVERED LATER:
//   - It sees the handler as WRITTEN, not as executed. A route delegating its
//     auth to a helper (`await requireAdmin(req, res)`) would read as a
//     violation even though it is correct. None exist today; if one is added,
//     widen SESSION_VERIFIERS rather than deleting the assertion.
//   - It cannot tell a REACHED call from an unreachable one. A verify*Session
//     call behind `if (false)` would satisfy this test.
//   Both are narrower than the hole this closes, which is a call that is not
//   there at all.
// ─────────────────────────────────────────────────────────────────────────────

// ─── THE GATE LIST — ONE NAMED CONSTANT, AND THAT IS THE POINT ───────────────
// ⚠ ABR R8: a fence whose purpose has quietly narrowed is worse than no fence.
// adminRouteCoverage.test.js's hasPermissionGuard() hardcodes the two signals
// for requirePermission, so a future requireStepUp middleware would satisfy
// neither and be COMPLETELY INVISIBLE to it — routes behind the new gate would
// silently drop out of coverage with nothing failing.
//
// Adding a gate here is ONE LINE. requirePermission is the only requireX()
// middleware in the entire server today, so this list has one entry and looks
// like over-engineering; it is not. The step-up re-auth work
// (PRE_LAUNCH_CHECKLIST.md, "Step-up re-authentication on sensitive actions")
// is a queued second gate, and this is the seam it lands in.
//
// Each entry carries BOTH detection signals — a named function and a property
// marker — because either alone is fragile: minifiers rename functions, and a
// marker can be forgotten on a new middleware.
const GATE_MIDDLEWARES = [
  { label: 'requirePermission', fnName: 'permissionMiddleware', marker: 'permission' },
  // { label: 'requireStepUp',   fnName: 'stepUpMiddleware',     marker: 'stepUp' },
];

// The four sanctioned session verifiers (server/middleware/auth.js:233-239).
// ⚠ ANCHORED ON THE CALL, NOT THE NAME. The trailing `\s*\(` is what makes this
// evidence of an invocation rather than of the string appearing somewhere —
// CLAUDE.md's toContain-on-a-bare-value trap, in a different costume. A bare
// name matches an import line, a property, or a mention in a string.
const SESSION_VERIFIER_RE =
  /\b(?:verifyAdminSession|verifyReferrerSession|verifySuperAdminSession|verifyAnySession)\s*\(/;

// ─── stripComments(): a real scanner, not a regex ────────────────────────────
// ⚠ THIS IS LOAD-BEARING AND THERE IS A LIVE SUBJECT FOR IT.
// server/routes/admin/index.js:982 — inside the POST /api/admin/branding/logo
// handler — reads:
//     // TENANCY. contractorId comes from verifyAdminSession and from nowhere
// That comment is INSIDE the handler body, so fn.toString() returns it. Without
// stripping, a route could satisfy this test on a comment alone. That is
// precisely the shape Phase 0's first parser hit: it reported a false violation
// on POST /api/admin/login because it matched `requirePermission('branding')`
// in the comment at server/routes/admin/index.js:129.
//
// A regex cannot do this correctly. `'https://x'` contains `//`, and a naive
// line-comment strip would delete the rest of the line — which could delete a
// REAL call sitting after a URL. So this tracks string, template and comment
// state properly.
//
// Known limitation: a REGEX LITERAL containing `//` or `/*` would confuse it,
// because distinguishing `/` as division from `/` as a regex delimiter needs a
// real parser. No handler in this codebase contains one. If that changes, this
// fails toward reporting a violation (text gets eaten, the call disappears),
// which is the safe direction — a false alarm, never a false pass.
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    // line comment
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // block comment
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // string or template literal — copied through verbatim, including any
    // slashes inside it, so a URL in a string cannot start a fake comment.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i];
        if (src[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    out += c; i++;
  }
  return out;
}

// ─── the checker ─────────────────────────────────────────────────────────────
// gates is a PARAMETER, defaulting to the module constant, so a test can prove
// the parameterisation works by passing an extended list. Without that seam the
// ABR R8 control would have no way to construct its subject — requirePermission
// is the only real gate in the server today.
function isGated(middlewareStack, gates = GATE_MIDDLEWARES) {
  return middlewareStack.some((layer) => {
    const h = layer && layer.handle;
    if (!h) return false;
    return gates.some((g) => h.name === g.fnName || typeof h[g.marker] === 'string');
  });
}

// Returns the list of gated routes that never invoke a session verifier.
function findViolations(routes, gates = GATE_MIDDLEWARES) {
  const violations = [];
  for (const route of routes) {
    if (!isGated(route.middlewareStack, gates)) continue;
    const callsVerifier = route.middlewareStack.some((layer) => {
      const h = layer && layer.handle;
      if (typeof h !== 'function') return false;
      // Skip the gate itself — it is not where the session call lives, and
      // including it would be a way for the test to satisfy itself.
      if (gates.some((g) => h.name === g.fnName || typeof h[g.marker] === 'string')) return false;
      return SESSION_VERIFIER_RE.test(stripComments(h.toString()));
    });
    if (!callsVerifier) violations.push(`${route.method} ${route.path}`);
  }
  return violations;
}

// ─── a scratch app carrying deliberately-violating routes ────────────────────
// Built in-process so the controls below run on EVERY suite run rather than
// existing as a one-off manual probe. A control that only ran once, months ago,
// in someone's terminal, is a claim about the past.
function buildProbeApp({ gateMarker = 'permission', gateName = 'permissionMiddleware' } = {}) {
  const app = express();
  const router = express.Router();

  function makeGate() {
    const fn = function namedGate(req, res, next) { return next(); };
    Object.defineProperty(fn, 'name', { value: gateName });
    fn[gateMarker] = 'probe_flag';
    return fn;
  }

  // VIOLATION 1 — gated, and no session call anywhere.
  router.get('/api/admin/__probe_no_session', makeGate(), async (req, res) => {
    res.json({ ok: true });
  });

  // VIOLATION 2 — gated, and the ONLY mention of a verifier is in a COMMENT.
  // This is the live server/routes/admin/index.js:982 shape, isolated.
  router.get('/api/admin/__probe_comment_only', makeGate(), async (req, res) => {
    // contractorId would come from verifyAdminSession(req, res) here
    res.json({ ok: true });
  });

  // CLEAN — gated AND calls a verifier for real. If this one is ever reported
  // as a violation the checker is over-firing, which a violations-only
  // assertion would never reveal.
  //
  // ⚠ THIS PROBE WAS WRONG ON ITS FIRST WRITING AND THE ASSERTION CAUGHT IT.
  // It originally called a helper named `verifyAdminSessionStub`, which does
  // NOT match SESSION_VERIFIER_RE — the regex requires `\s*\(` immediately
  // after the verifier name, so `verifyAdminSessionStub(` is correctly not a
  // match. The probe therefore contained no verifier call and was flagged, the
  // over-firing assertion went RED, and a defective control was caught before
  // it could certify anything. The name below is exact for that reason.
  const verifyAdminSession = async () => ({ contractorId: 'probe' });
  router.get('/api/admin/__probe_clean', makeGate(), async (req, res) => {
    const s = await verifyAdminSession(req, res);
    if (!s) return;
    res.json({ ok: true });
  });

  app.use('/', router);
  return app;
}

describe('admin route invariant — every gated route also verifies a session', () => {
  let pool;
  let adminRoutes;

  before(async () => {
    pool = await initTestDb();
    const app = createApp();
    adminRoutes = collectAdminRoutes(app._router.stack);
  });

  after(async () => {
    await pool.end();
  });

  // ── NON-VACUITY 1: the walk found something ────────────────────────────────
  // A zero-length route list would make the main assertion below pass
  // trivially. CLAUDE.md: non-vacuity assertions belong in tests that look too
  // simple to need them.
  it('router walk: produced a non-empty set of gated routes', () => {
    const gated = adminRoutes.filter((r) => isGated(r.middlewareStack));
    assert.ok(
      adminRoutes.length > 0,
      'collectAdminRoutes() returned nothing — the walk is broken, not the routes.'
    );
    assert.ok(
      gated.length > 0,
      'No route was detected as gated. GATE_MIDDLEWARES no longer matches how ' +
        'gates are built — the main assertion below would pass vacuously.'
    );
  });

  // ── NON-VACUITY 2: stripComments actually strips ───────────────────────────
  it('stripComments: removes commented-out calls and preserves real ones', () => {
    assert.equal(
      SESSION_VERIFIER_RE.test(stripComments('// await verifyAdminSession(req, res)')),
      false,
      'a line-commented call survived stripping'
    );
    assert.equal(
      SESSION_VERIFIER_RE.test(stripComments('/* verifyAdminSession(req, res) */')),
      false,
      'a block-commented call survived stripping'
    );
    assert.equal(
      SESSION_VERIFIER_RE.test(stripComments('await verifyAdminSession(req, res);')),
      true,
      'a REAL call was destroyed by stripping — the checker would report false violations'
    );
    // The URL case: a naive line-comment strip eats everything after `//` and
    // would delete the real call that follows it.
    assert.equal(
      SESSION_VERIFIER_RE.test(stripComments("const u = 'https://x.test/a'; await verifyAdminSession(req, res);")),
      true,
      'a URL inside a string was treated as a comment start and ate the real call'
    );
  });

  // ── POSITIVE CONTROL: the checker fires on a deliberate violation ──────────
  // Runs every time. Without it, "zero violations" is indistinguishable from a
  // checker that cannot detect anything at all.
  it('positive control: a gated route with no session call IS reported', () => {
    const probe = collectAdminRoutes(buildProbeApp()._router.stack);
    assert.ok(probe.length >= 3, `probe app exposed ${probe.length} routes, expected 3+ — the probe did not inject`);

    const violations = findViolations(probe);
    assert.ok(
      violations.includes('GET /api/admin/__probe_no_session'),
      `checker did not flag a gated route with no session call. Got: ${JSON.stringify(violations)}`
    );
    assert.ok(
      violations.includes('GET /api/admin/__probe_comment_only'),
      'checker was satisfied by a verifier name appearing only in a COMMENT — ' +
        'stripComments() is not being applied. This is the live ' +
        'server/routes/admin/index.js:982 shape.'
    );
    assert.ok(
      !violations.includes('GET /api/admin/__probe_clean'),
      'checker flagged a route that DOES call a verifier — it is over-firing, ' +
        'and a violations-only assertion would never have shown this.'
    );
  });

  // ── POSITIVE CONTROL: the gate list is genuinely parameterised (ABR R8) ────
  // Nothing else in the suite covers this. requirePermission is the only
  // requireX() middleware in the server, so the subject has to be constructed.
  it('positive control: a route behind a DIFFERENT gate is still checked', () => {
    const STEP_UP = { label: 'requireStepUp', fnName: 'stepUpMiddleware', marker: 'stepUp' };
    const probe = collectAdminRoutes(
      buildProbeApp({ gateMarker: 'stepUp', gateName: 'stepUpMiddleware' })._router.stack
    );

    // With the production list, this gate is invisible — that IS the R8 hazard,
    // asserted rather than described.
    assert.deepEqual(
      findViolations(probe, GATE_MIDDLEWARES),
      [],
      'a gate absent from GATE_MIDDLEWARES was somehow detected — this control ' +
        'is not testing what it claims to test'
    );

    // Add the gate: the same routes become visible. One line, as designed.
    const violations = findViolations(probe, [...GATE_MIDDLEWARES, STEP_UP]);
    assert.ok(
      violations.includes('GET /api/admin/__probe_no_session') &&
        violations.includes('GET /api/admin/__probe_comment_only'),
      `adding a gate to GATE_MIDDLEWARES did not bring its routes into scope. ` +
        `Got: ${JSON.stringify(violations)}`
    );
  });

  // ── THE INVARIANT ──────────────────────────────────────────────────────────
  it('every /api/admin/* route carrying a permission gate also calls a verify*Session', () => {
    const violations = findViolations(adminRoutes);

    assert.deepEqual(
      violations,
      [],
      `The following gated /api/admin/* routes never call a verify*Session.\n` +
        `Each is a LIVE super-admin bypass: server/middleware/permissions.js:49-51 ` +
        `returns next() for role='super_admin', and nothing downstream rejects it.\n` +
        `Add "const s = await verifyAdminSession(req, res); if (!s) return;" to the handler.\n` +
        `Do NOT add the route to an allowlist and do NOT weaken this test.\n\n` +
        violations.map((v) => `  • ${v}`).join('\n')
    );
  });
});
