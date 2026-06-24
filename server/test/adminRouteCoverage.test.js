'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { buildMirrorApp, collectAdminRoutes } = require('./helpers/adminRouterIntrospection');

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

// collectAdminRoutes() and buildMirrorApp() imported from shared helper above.

// ── DRIFT GUARD ───────────────────────────────────────────────────────────────
// WHY THIS EXISTS:
// This test builds a mirror that only walks the route files it explicitly mounts.
// If server.js gains a NEW app.use() for a file that registers /api/admin/* routes
// but this test's mirror is not updated, the walk silently misses those routes —
// and the test passes on ungated routes it never saw. That is exactly how stripe.js
// was missed in Phase 4B (it was in server.js but outside the admin/ directory
// the manual sweep scanned). The drift guard closes that blind spot.
//
// Mechanism: parse server.js source, extract every require() path mounted via
// app.use(), and assert the set matches the declared complete inventory below.
// Any unclassified module makes the suite RED, forcing an explicit decision.

// Complete inventory of every route module that server.js mounts via app.use().
// Split into two groups:
//   ADMIN_CONTRIBUTING — mirrored in buildMirrorApp() above; their /api/admin/*
//                        routes are the ones this test coverage-checks.
//   NON_ADMIN          — confirmed to register no /api/admin/* routes; not mirrored.
const ADMIN_CONTRIBUTING_MODULES = new Set([
  './server/routes/admin/index', // aggregates all 8 admin sub-routers (incl. team.js added Phase 6)
  './server/routes/stripe',      // 5 /api/admin/stripe/* routes (Phase 4B find)
]);

const NON_ADMIN_MODULES = new Set([
  './server/routes/oauth',           // /auth/jobber, /callback — Jobber OAuth flow
  './server/routes/referrer',        // /api/* referrer-facing endpoints only
  './server/routes/superAdmin',      // /api/rm-control/login only
  './server/routes/webhooks/jobber', // /webhooks/* — Jobber HMAC webhooks
  './server/routes/resendWebhook',   // /api/webhooks/* — Resend delivery events
  './server/routes/account',         // /api/account/* — manage-account
  './server/routes/unsubscribe',     // /api/unsubscribe/* — public unsubscribe
]);

const ALL_KNOWN_MODULES = new Set([
  ...ADMIN_CONTRIBUTING_MODULES,
  ...NON_ADMIN_MODULES,
]);

// Parses server.js source text and returns the Set of require() paths that are
// actually passed to app.use() calls. Resolves them via the top-level const
// variable declarations.
//
// Deliberately excludes destructured imports (const { x } = require(...)) because
// those are middleware helpers (expressErrorHandler, logError), not route routers.
// They land in usedVars but have no varToPath entry and are silently skipped.
function extractMountedRouteModules(src) {
  // Step A: varName → requirePath from `const varName = require('path')` lines.
  const varToPath = {};
  const varDeclRe = /^const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/gm;
  let m;
  while ((m = varDeclRe.exec(src)) !== null) {
    varToPath[m[1]] = m[2];
  }

  // Step B: collect variable names from app.use() calls.
  // Handles both app.use('/prefix', varName) and app.use(varName).
  // Inline calls like app.use(helmet()) or app.use(express.json()) are NOT
  // captured because (\w+) stops before '(' and the closing \) then fails.
  const usedVars = new Set();
  const withPrefixRe = /app\.use\(\s*['"][^'"]*['"]\s*,\s*(\w+)\s*\)/g;
  const noPrefixRe = /app\.use\(\s*(\w+)\s*\)/g;
  while ((m = withPrefixRe.exec(src)) !== null) usedVars.add(m[1]);
  while ((m = noPrefixRe.exec(src)) !== null) usedVars.add(m[1]);

  // Step C: resolve var names → require paths (unknown vars are non-router middleware).
  const mounted = new Set();
  for (const v of usedVars) {
    if (varToPath[v]) mounted.add(varToPath[v]);
  }
  return mounted;
}

// ── TEST SUITE ────────────────────────────────────────────────────────────────

describe('admin route enforcement coverage', () => {
  let pool;
  let adminRoutes;

  before(async () => {
    pool = await initTestDb();
    const app = buildMirrorApp();
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
  it('router walk: all three allowlisted public routes are present in the collected set', () => {
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

  // ── Drift guard ───────────────────────────────────────────────────────────
  it('drift guard: server.js mounts no route module unclassified in this test', () => {
    // Parse server.js to discover every route module it actually mounts.
    const serverJsSrc = fs.readFileSync(
      path.resolve(__dirname, '../../server.js'),
      'utf8'
    );
    const mounted = extractMountedRouteModules(serverJsSrc);

    // Reverse-drift: verify each admin-contributing module is still in server.js.
    // Catches the mirror referencing a module that was removed from server.js —
    // the mirror would be walking phantom routes.
    for (const mod of ADMIN_CONTRIBUTING_MODULES) {
      assert.ok(
        mounted.has(mod),
        `Drift: ADMIN_CONTRIBUTING_MODULES declares '${mod}' but server.js no ` +
          `longer mounts it. Remove it from ADMIN_CONTRIBUTING_MODULES and from ` +
          `buildMirrorApp() in this test.`
      );
    }

    // Forward-drift: every module server.js mounts must be classified.
    // An unclassified module was added to server.js without updating this test —
    // if it registers /api/admin/* routes, those routes are invisible to coverage.
    for (const mod of mounted) {
      assert.ok(
        ALL_KNOWN_MODULES.has(mod),
        `Drift detected: server.js mounts '${mod}' which is not classified in this ` +
          `coverage test. ` +
          `If it registers /api/admin/* routes: add it to ADMIN_CONTRIBUTING_MODULES ` +
          `and to buildMirrorApp(). ` +
          `If it registers no /api/admin/* routes: add it to NON_ADMIN_MODULES with a ` +
          `comment confirming why. ` +
          `Leaving it unclassified means this coverage test may be blind to ungated ` +
          `routes in that file.`
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
