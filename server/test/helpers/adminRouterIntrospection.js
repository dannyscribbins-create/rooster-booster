'use strict';

/**
 * Shared Express router introspection helpers for admin route security tests.
 * Imported by both adminRouteCoverage.test.js and registryReconciliation.test.js.
 *
 * IMPORTANT: Both callers must call initTestDb() in before() BEFORE calling
 * buildMirrorApp(). contacts.js fires a pg_trgm query at module-load time —
 * the test schema must exist before the route modules are require()-d.
 */

// Recursively walks an Express layer stack and collects every terminal Route
// whose path starts with '/api/admin/'. Returns one object per method per route:
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
function collectAdminRoutes(layerStack) {
  const routes = [];
  for (const layer of layerStack || []) {
    if (layer.route) {
      const routePath = layer.route.path;
      if (typeof routePath === 'string' && routePath.startsWith('/api/admin/')) {
        for (const method of Object.keys(layer.route.methods)) {
          routes.push({
            method: method.toUpperCase(),
            path: routePath,
            middlewareStack: layer.route.stack,
          });
        }
      }
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      routes.push(...collectAdminRoutes(layer.handle.stack));
    }
  }
  return routes;
}

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

module.exports = { buildMirrorApp, collectAdminRoutes };
