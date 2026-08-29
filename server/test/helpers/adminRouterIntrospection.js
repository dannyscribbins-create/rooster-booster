'use strict';

/**
 * Shared Express router introspection helpers for route security tests.
 *
 * ⚠ THIS LINE USED TO SAY "imported by BOTH adminRouteCoverage.test.js and
 * registryReconciliation.test.js". That was already wrong before Wave 1.1-d2 —
 * there were four callers — and it understates the blast radius of a change
 * here, which is the direction that gets someone hurt. The five, as of
 * 2026-08-29: adminRouteCoverage, adminRouteInvariant, registryReconciliation,
 * crossTenantCredentialWrites (all via collectAdminRoutes) and
 * sessionAuthInvariant (via collectRoutes with the referrer prefix).
 *
 * IMPORTANT: Both callers must call initTestDb() in before() BEFORE calling
 * buildMirrorApp(). contacts.js fires a pg_trgm query at module-load time —
 * the test schema must exist before the route modules are require()-d.
 */

// Recursively walks an Express layer stack and collects every terminal Route
// whose path starts with `prefix` (default '/api/admin/'). Returns one object
// per method per route:
//   { method: 'GET', path: '/api/admin/...', middlewareStack: layer.route.stack }
//
// Express nesting in this codebase (confirmed Phase 0):
//   Level 1 — app._router.stack
//   Level 2 — sub-router layers from app.use('/', adminRouter) and
//              app.use('/', stripeRouter)
//   Level 3 — sub-sub-router layers from adminRouter.use(campaignsRouter) etc.
//
// A terminal Route layer has layer.route set. A Router layer has
// layer.handle with a .stack array — recurse into it.
//
// ─── THE PREFIX IS A PARAMETER (Wave 1.1-d2) ─────────────────────────────────
// It was the literal '/api/admin/' until 2026-08-29, and that literal is the
// entire reason the four inline-auth violations in server/routes/stripe.js
// survived: they served /api/referrer/stripe/*, so no guard in the suite could
// see them. adminRouteCoverage.test.js named that gap in its own limitations
// comment and was believed as coverage anyway. A second prefix is now one
// argument, not a fork.
//
// ⚠ ⚠ THE PREFIX IS MATCHED AGAINST A MOUNT-RELATIVE PATH, AND A WRONG PREFIX
// COLLECTS ZERO ROUTES RATHER THAN FAILING. layer.route.path is relative to the
// router's mount point, and this walk never accumulates the mount prefix as it
// recurses. '/api/admin/' and '/api/referrer/' work for ONE reason: adminRoutes,
// stripeRoutes and referrerRoutes are all mounted at '/' in createApp().
// accountRoutes is mounted at '/api/account', so its fifteen routes come out of
// this walk as 'GET /me', 'PUT /name', 'GET /sessions' — and a caller passing
// '/api/account/' would receive an EMPTY ARRAY and every assertion over it would
// pass vacuously. That is CLAUDE.md's "mechanism that reports health it cannot
// observe", pre-loaded rather than discovered.
//
// So: EVERY CALLER MUST ASSERT A NON-EMPTY RESULT. adminRouteInvariant.test.js
// and sessionAuthInvariant.test.js both do. Do not add a third prefix without
// one — an empty collection must fail loudly, because it cannot fail any other
// way.
//
// The real fix, when a non-'/'-mounted surface actually needs covering: thread
// the mount path down through the recursion (parse layer.regexp on the parent,
// or pass an accumulated prefix) so the walk yields absolute paths. Recorded in
// PRE_LAUNCH_CHECKLIST.md. Until then, only '/'-mounted routers may be given a
// prefix.
function collectRoutes(layerStack, prefix = '/api/admin/') {
  const routes = [];
  for (const layer of layerStack || []) {
    if (layer.route) {
      const routePath = layer.route.path;
      if (typeof routePath === 'string' && routePath.startsWith(prefix)) {
        for (const method of Object.keys(layer.route.methods)) {
          routes.push({
            method: method.toUpperCase(),
            path: routePath,
            middlewareStack: layer.route.stack,
          });
        }
      }
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      routes.push(...collectRoutes(layer.handle.stack, prefix));
    }
  }
  return routes;
}

// Bound alias, kept so the four existing callers are untouched by the
// parameterisation — adminRouteCoverage, adminRouteInvariant,
// crossTenantCredentialWrites and registryReconciliation. Not deprecated: an
// admin-only caller reads better naming the surface than passing a string.
const collectAdminRoutes = (layerStack) => collectRoutes(layerStack, '/api/admin/');

// Builds a minimal Express app that mirrors only the app.use() calls from
// server.js that contribute /api/admin/* routes. Does NOT call app.listen().
//
// The ONLY two files in server.js that register /api/admin/* paths:
//   - server/routes/admin/index   (aggregates 7 admin sub-routers via router.use())
//   - server/routes/stripe        (5 /api/admin/stripe/* routes — Phase 4B gap find)
//
// Paths are resolved relative to this helper file (server/test/helpers/).
function buildMirrorApp() {
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/', require('../../routes/admin/index'));
  app.use('/', require('../../routes/stripe'));
  return app;
}

module.exports = { buildMirrorApp, collectRoutes, collectAdminRoutes };
