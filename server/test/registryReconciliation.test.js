'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildMirrorApp, collectAdminRoutes } = require('./helpers/adminRouterIntrospection');
const { SECTIONS, ALL_FLAGS } = require('../permissions/registry');

// Pre-compute: which flags belong to a forward-defined section?
// Forward sections are reserved namespace (not yet enforced) — a live route gating
// on a forward flag is suspicious and warrants review, though not a hard failure.
const FORWARD_FLAGS = new Set(
  SECTIONS
    .filter(s => s.forward)
    .flatMap(s => Object.values(s.flags).filter(Boolean))
);

// forward flag → section key, for clear console.warn messages in Test 2b.
const FORWARD_FLAG_SECTION = new Map();
for (const s of SECTIONS.filter(s => s.forward)) {
  for (const flag of Object.values(s.flags).filter(Boolean)) {
    FORWARD_FLAG_SECTION.set(flag, s.key);
  }
}

describe('permission registry reconciliation', () => {
  let pool;
  // Map<flag, string[]> — each flag string → list of 'METHOD /path' strings that use it.
  // Built in before() by reading .handle.permission off every guard in every route.
  let usedFlagsMap;

  before(async () => {
    pool = await initTestDb();
    const app = buildMirrorApp();
    const adminRoutes = collectAdminRoutes(app._router.stack);

    usedFlagsMap = new Map();
    for (const route of adminRoutes) {
      for (const rl of route.middlewareStack) {
        // .handle.permission is the flag string attached to permissionMiddleware
        // by requirePermission() in Phase 5 Step 1. Routes with no guard (the 3
        // allowlisted public routes) produce no .permission and are naturally skipped.
        if (rl.handle && typeof rl.handle.permission === 'string') {
          const flag = rl.handle.permission;
          if (!usedFlagsMap.has(flag)) usedFlagsMap.set(flag, []);
          usedFlagsMap.get(flag).push(`${route.method} ${route.path}`);
        }
      }
    }
  });

  after(async () => {
    await pool.end();
  });

  // ── Sanity: flag collection is working ───────────────────────────────────
  it('flag collection: found a plausible number of distinct permission flags (sanity)', () => {
    // Active non-forward sections = 17. Confirmed route-less active flags = 6:
    //   billing, billing.manage, team, team.manage, rep_assignment, cashouts.manage.
    // Rough floor: ~29 active flags minus 6 route-less = ~23 with live routes.
    // A count below 15 means .handle.permission is not being read correctly —
    // the walk is likely broken, not that routes use only a few flags.
    assert.ok(
      usedFlagsMap.size >= 15,
      `Flag collection found only ${usedFlagsMap.size} distinct flags used by ` +
        `/api/admin/* routes — expected ≥ 15. The .handle.permission collection ` +
        `in before() is likely broken. Do NOT interpret a low count as "routes use ` +
        `few flags" — diagnose the collection first.`
    );
  });

  // ── Test 2a — every used flag must exist in the registry ─────────────────
  it('every permission flag used by a route exists in the permission registry', () => {
    // Direction: routes → registry. Catches typos in requirePermission() calls
    // that point at phantom flags (e.g. 'campagins' instead of 'campaigns').
    // requirePermission() validates at registration time but this test catches it
    // at the suite level so a bad flag does not silently pass in CI.
    //
    // If this fails: the flag is a typo in a route's requirePermission() call.
    // Fix the route — do NOT change this test or add the phantom flag to the registry.
    const failures = [];
    for (const [flag, routes] of usedFlagsMap) {
      if (!ALL_FLAGS.has(flag)) {
        failures.push({ flag, routes });
      }
    }

    assert.deepEqual(
      failures,
      [],
      `The following routes reference a permission flag that does NOT exist in ` +
        `server/permissions/registry.js. This is almost certainly a typo in a ` +
        `requirePermission() call. Fix the route — do NOT adjust this test.\n\n` +
        failures
          .map(
            ({ flag, routes }) =>
              `  • Flag '${flag}' (not in registry) used by:\n` +
              routes.map(r => `      – ${r}`).join('\n')
          )
          .join('\n')
    );
  });

  // ── Test 2b — forward flags in use by live routes (warn only, never fails) ─
  it('forward-defined flags are not consumed by live routes (review signal, does not fail)', () => {
    // Forward sections are reserved namespace for not-yet-built features:
    //   points, client_portal, boost_campaign, account_keeping.
    // A live route gating on a forward flag is suspicious (the feature is not yet
    // built, but a route is already enforcing it). This is a review signal, not a
    // hard failure — it may be intentional (partially-built feature).
    //
    // Per Phase 5 Step 3 spec: "SAFER DEFAULT: report via console.warn and make the
    // test PASS." If you want this to fail, discuss with Danny first.
    const suspects = [];
    for (const [flag, routes] of usedFlagsMap) {
      if (FORWARD_FLAGS.has(flag)) {
        suspects.push({ flag, section: FORWARD_FLAG_SECTION.get(flag), routes });
      }
    }

    if (suspects.length > 0) {
      for (const { flag, section, routes } of suspects) {
        console.warn(
          `[registry-reconciliation] REVIEW: flag '${flag}' belongs to forward ` +
            `section '${section}' (not yet live) but is consumed by live route(s): ` +
            routes.join(', ')
        );
      }
    }
    // No assert — this test always passes.
  });

  // ── Test 2c — unconsumed flags (informational, never fails) ──────────────
  it('unconsumed registry flags listed for audit visibility (always passes)', () => {
    // ALL_FLAGS minus the set of flags actually used by routes.
    // Expected non-empty: includes the 8 forward flags + at least 6 known route-less
    // active flags (billing, billing.manage, team, team.manage, rep_assignment,
    // cashouts.manage). Useful for future audits — e.g. tracking cashouts.manage as
    // route-less for the Phase 6 Finance admin preset work.
    const unconsumed = [...ALL_FLAGS].filter(f => !usedFlagsMap.has(f)).sort();
    console.log(
      `[registry-reconciliation] Unconsumed flags (${unconsumed.length} total — ` +
        `forward-defined + known route-less active):`,
      unconsumed
    );
    // No assert — count will always be non-zero (forward flags alone guarantee it).
  });
});
