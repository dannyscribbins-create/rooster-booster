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
  it('router walk: found a plausible number of /api/admin/* routes', () => {
    // Phase 0 confirmed ~114 /api/admin/* route/method combinations across the
    // 7 admin sub-routers + 5 stripe routes. A count below 60 means the recursive
    // walk is broken, not that routes are missing — the walk must be fixed before
    // any "all gated" result can be trusted.
    assert.ok(
      adminRoutes.length >= 60,
      `Router walk returned only ${adminRoutes.length} /api/admin/* routes — ` +
        `expected ≥ 60. The recursive walk in collectAdminRoutes() is likely broken. ` +
        `Do NOT interpret this as "all routes are gated" — many routes may be invisible.`
    );
  });

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
