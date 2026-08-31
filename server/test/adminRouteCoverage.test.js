'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { collectAdminRoutes } = require('./helpers/adminRouterIntrospection');
const { createApp } = require('../app');

// ── PUBLIC-ROUTE ALLOWLIST ────────────────────────────────────────────────────
// Exhaustive list of /api/admin/* routes that intentionally carry NO
// requirePermission guard. The list is CLOSED: any /api/admin/* route not here
// AND not carrying the guard is a test failure. New intentionally-public admin
// routes must be added here with a justification comment.
const PUBLIC_ADMIN_ROUTES = [
  {
    method: 'POST',
    path: '/api/admin/login',
    // This endpoint IS the token issuer — it cannot authenticate itself.
  },
  {
    method: 'GET',
    path: '/api/admin/me',
    // Session-only identity endpoint — reads the caller's own team_members row live.
    // No permission flag by design (Decision A §5.2): a permission gate on self-read
    // would lock out newly-created accounts before any flags are assigned.
  },
  {
    method: 'GET',
    path: '/api/admin/notifications',
    // Session-only admin UI chrome (verifyAdminSession, no permission flag).
    // Phase 4B decision: notification bell is cross-section UX, not a feature area.
    // See notifications.js comment: "Intentionally session-only".
  },
  {
    method: 'PATCH',
    path: '/api/admin/notifications/:id/read',
    // Same rationale as GET /api/admin/notifications (Phase 4B decision).
  },
  {
    method: 'POST',
    path: '/api/admin/team/accept-invite',
    // public — invitee has no session yet; the single-use, time-limited token IS the authentication.
  },
  {
    method: 'GET',
    path: '/api/admin/titles',
    // Session-authed but intentionally ungated: any member (including a zero-permission General)
    // must read the title list to populate their self-select dropdown. Same rationale as
    // GET /api/admin/me — a permission gate here would block members from choosing their own title.
  },
  {
    method: 'PATCH',
    path: '/api/admin/me/title',
    // Session-authed but intentionally ungated — any member (incl. zero-permission General)
    // must be able to self-select their own title; the cross-tenant guard is enforced
    // inside the handler (titles ownership check), not by a permission gate.
  },
];

// Fast-lookup Set — 'METHOD /path'
const PUBLIC_ROUTE_KEYS = new Set(
  PUBLIC_ADMIN_ROUTES.map(r => `${r.method} ${r.path}`)
);

// ── GUARD DETECTION ───────────────────────────────────────────────────────────
// Returns true if the route's middleware chain contains the permission guard.
// Scans the WHOLE chain with .some() because the guard may not be at index 0:
//   - Rate limiters (e.g. resendInviteLimiter, backupRunLimiter) can precede it.
//   - Multer upload middleware (upload-image, upload-csv) can precede it.
// Two independent detection signals (belt + suspenders):
//   1. fn.name === 'permissionMiddleware'  — named function in permissions.js
//   2. typeof fn.permission === 'string'   — .permission marker added in Phase 5 Step 1
function hasPermissionGuard(middlewareStack) {
  return middlewareStack.some(
    rl =>
      rl.handle &&
      (rl.handle.name === 'permissionMiddleware' ||
        typeof rl.handle.permission === 'string')
  );
}

// collectAdminRoutes() imported from shared helper above.

// ── DRIFT GUARD — REMOVED (TENANT_RESOLUTION_REBUILD_SPEC.md Section 6) ───────
// The drift guard used to exist because this suite walked a hand-rolled mirror
// app that only mounted the route files it explicitly knew about — if server.js
// gained a new app.use() for a file registering /api/admin/* routes and the
// mirror wasn't updated, the walk would silently miss those routes (this is
// exactly how stripe.js was missed in Phase 4B). The guard parsed server.js's
// source text to catch that drift.
//
// Both problems this guard existed for are now structurally impossible:
//   1. The sweep below walks createApp()'s REAL router stack (server/app.js),
//      not a mirror — there is no second inventory that can fall out of sync.
//   2. server/test/createAppParity.test.js (Phase 1 of the tenant-resolution
//      rebuild) already pins that every one of createApp()'s nine app.use()
//      mounts is reachable, so a router silently failing to mount is caught
//      there, not here.
// A source-text drift guard against server.js is also no longer meaningful:
// server.js no longer constructs the app at all (see server/app.js) — mounting
// happens exclusively inside createApp().

// ── TEST SUITE ────────────────────────────────────────────────────────────────

describe('admin route enforcement coverage', () => {
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

  // ── Sanity: the router walk produced a meaningful result ──────────────────
  //
  // ⚠ THIS WAS A FLOOR OF 60 AND THE FLOOR COULD NEVER FIRE. Corrected in
  // Wave 1.1-a. The old assertion was `adminRoutes.length >= 60`, above a
  // comment claiming "~114 route/method combinations". Both numbers were
  // wrong: the true population is 137, and a floor at 60 sits UNDER HALF of
  // it — the walk could have lost 55% of the surface and still reported a
  // plausible-looking count. It is the fifth instance of CLAUDE.md's
  // "mechanism that reports health it cannot observe", and its failure
  // message made it worse by explicitly reassuring the reader.
  //
  // ⚠ AND THE FIX IS NOT A HIGHER FLOOR. Raising 60 to 130 recreates the same
  // defect one value up: still unfalsifiable in the direction that matters
  // (routes disappearing in ones and twos), still a hand-picked number with
  // no source. An EXACT match against a recorded constant is falsifiable in
  // BOTH directions and forces a deliberate decision on every change, which
  // is the architecture.js --check pattern.
  // ⚠ 137 → 138 IN C/DL-3c PHASE 2c, DELIBERATELY. One route was ADDED:
  // PATCH /api/admin/team/:id/reactivate (Decision E-min), gated on team.manage
  // exactly like its deactivate sibling. This is the one case the message below
  // says is correct — and it is also the reflex this constant exists to prevent,
  // so: the number moved because a route was added, not because a walk broke.
  const EXPECTED_ADMIN_ROUTE_COUNT = 138; // measured 2026-08-31, C/DL-3c Phase 2c
  it('router walk: /api/admin/* route count matches the recorded number exactly', () => {
    assert.equal(
      adminRoutes.length,
      EXPECTED_ADMIN_ROUTE_COUNT,
      `Router walk found ${adminRoutes.length} /api/admin/* route/method combinations; ` +
        `EXPECTED_ADMIN_ROUTE_COUNT is ${EXPECTED_ADMIN_ROUTE_COUNT}.\n` +
        `If you ADDED or REMOVED an admin route, this is correct and expected — update ` +
        `the constant in this file, deliberately, and say so in the commit.\n` +
        `If you did NOT change any route, the recursive walk in collectAdminRoutes() ` +
        `is broken. Fix the walk. Do NOT interpret a low number as "all routes are ` +
        `gated" — many routes may simply be invisible to the walk.`
    );
  });

  // ── ⚠ WHAT THIS GUARD DOES NOT OBSERVE ────────────────────────────────────
  // Stated here because the tripwire it replaced failed precisely by reporting
  // health it could not see, and a mechanism whose limits are undocumented
  // becomes a mechanism whose limits are unknown.
  //
  // An exact-match count guard sees DRIFT IN THE NUMBER OF ROUTES. It is blind
  // to every one of these:
  //   - A route whose GATE CHANGED. Swapping requirePermission('cashouts') for
  //     requirePermission('dashboard') keeps the count at 137. (The coverage
  //     assertion below sees only that SOME gate is present, never which one —
  //     that is server/test/registryReconciliation.test.js's job.)
  //   - A gate that stopped working. A requirePermission that returns next()
  //     unconditionally is still counted, still "present", still green here.
  //   - ONE ROUTE ADDED AND ANOTHER REMOVED IN THE SAME COMMIT. The count is
  //     unchanged and this guard says nothing. The coverage assertion below
  //     would still catch a new UNGATED route, but a new GATED one arrives
  //     completely silently.
  //   - Anything outside /api/admin/*. collectAdminRoutes() filters on that
  //     prefix, so the four /api/referrer/stripe/* routes that inline raw token
  //     checks are invisible to this entire file (PRE_LAUNCH_CHECKLIST.md).
  //   - Whether a gated route also verifies a session. That invariant lives in
  //     server/test/adminRouteInvariant.test.js and is deliberately a separate
  //     file, so one is caught disjointly from the other.

  // ── Sanity: allowlisted routes actually exist in the walk ─────────────────
  it('router walk: all allowlisted public routes are present in the collected set', () => {
    // If an allowlisted route was renamed or deleted, its allowlist entry becomes
    // a dead reference that could silently cover a newly-ungated replacement.
    for (const entry of PUBLIC_ADMIN_ROUTES) {
      const found = adminRoutes.some(
        r => r.method === entry.method && r.path === entry.path
      );
      assert.ok(
        found,
        `Allowlist entry '${entry.method} ${entry.path}' was not found in the router ` +
          `walk. The route may have been renamed or deleted. ` +
          `Remove or update this allowlist entry.`
      );
    }
  });

  // ── Main coverage assertion ───────────────────────────────────────────────
  it('every /api/admin/* route carries the permission guard or is on the allowlist', () => {
    const failures = [];

    for (const route of adminRoutes) {
      const key = `${route.method} ${route.path}`;

      if (PUBLIC_ROUTE_KEYS.has(key)) {
        continue; // intentionally ungated — skip
      }

      if (!hasPermissionGuard(route.middlewareStack)) {
        failures.push(key);
      }
    }

    assert.deepEqual(
      failures,
      [],
      `The following /api/admin/* routes are missing the permission guard AND are not ` +
        `on the allowlist.\n` +
        `Each must either receive requirePermission(<flag>) OR be added to ` +
        `PUBLIC_ADMIN_ROUTES with an explicit justification comment.\n` +
        `Do NOT modify this test to make it pass — fix the production route.\n\n` +
        failures.map(f => `  • ${f}`).join('\n')
    );
  });
});
