'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { request: _httpRequest } = require('node:http');
const { requirePermission } = require('../middleware/permissions');
const { SECTIONS } = require('../permissions/registry');
const { startTestServer, stopTestServer } = require('./helpers');

// ── PARITY TABLE ──────────────────────────────────────────────────────────────
// One entry per flag to probe. An Owner whose permissions JSONB is '{}' (empty)
// must be allowed through requirePermission for EVERY entry — proving the tier
// short-circuit in permissions.js fires BEFORE the JSONB flag read.
//
// mode: 'http'  — make a real HTTP request to the test server; assert status !== 403.
//                 The handler may return 200 / 404 / 500 depending on DB state — any
//                 non-403 proves the GUARD let it through. We are testing the GUARD,
//                 not the handler's business logic. Documented per entry below.
//
// mode: 'guard' — invoke the requirePermission middleware function directly with a
//                 mocked req/res/next; assert next() was called and no 403 was sent.
//                 Used for write/destructive endpoints to avoid triggering real side
//                 effects (Stripe transfers, Backblaze uploads, etc.). The middleware
//                 still performs a real DB read — the Owner session must be seeded.
const PARITY_TABLE = [
  { group: 'dashboard',        flag: 'dashboard',        method: 'GET',   path: '/api/admin/stats',              mode: 'http'  },
  { group: 'referrers',        flag: 'referrers',        method: 'GET',   path: '/api/admin/users',              mode: 'http'  },
  { group: 'contacts',         flag: 'contacts',         method: 'GET',   path: '/api/admin/contacts',           mode: 'http'  },
  { group: 'campaigns',        flag: 'campaigns',        method: 'GET',   path: '/api/admin/campaigns',          mode: 'http'  },
  { group: 'audiences',        flag: 'audiences',        method: 'GET',   path: '/api/admin/audiences',          mode: 'http'  },
  { group: 'experience',       flag: 'experience',       method: 'GET',   path: '/api/admin/retention-settings', mode: 'http'  },
  { group: 'referral_review',  flag: 'referral_review',  method: 'GET',   path: '/api/admin/pending-referrals',  mode: 'http'  },
  { group: 'cashouts',         flag: 'cashouts',         method: 'GET',   path: '/api/admin/cashouts',           mode: 'http'  },
  // guard-level: PATCH /cashouts/:id triggers real Stripe ACH payout logic if it reaches
  // the handler body — skip HTTP, invoke the guard directly to avoid side effects.
  // The General-tier defense-in-depth complement (General blocked even with flag=true)
  // is already covered by requirePermission.test.js tests 6 and 23.
  { group: 'cashout_approve',  flag: 'cashout_approve',  method: 'PATCH', path: '/api/admin/cashouts/:id',       mode: 'guard' },
  { group: 'finance_settings', flag: 'finance_settings', method: 'GET',   path: '/api/admin/payout-automation',  mode: 'http'  },
  { group: 'branding',         flag: 'branding',         method: 'GET',   path: '/api/admin/settings',           mode: 'http'  },
  { group: 'integrations',     flag: 'integrations',     method: 'GET',   path: '/api/admin/crm/status',         mode: 'http'  },
  // guard-level: POST /backup/run triggers a real Backblaze B2 upload if it reaches the
  // handler body — skip HTTP, invoke the guard directly to avoid triggering a real backup.
  { group: 'advanced',         flag: 'advanced',         method: 'POST',  path: '/api/admin/backup/run',         mode: 'guard' },
  { group: 'activity',         flag: 'activity',         method: 'GET',   path: '/api/admin/activity',           mode: 'http'  },
  // Synthetic routes — team and rep_assignment have no live routes until Phase 6.
  // These entries hit /test/* handlers mounted below, proving the Owner short-circuit
  // covers these flags before their real routes exist in production.
  { group: 'team',             flag: 'team',             method: 'GET',   path: '/test/team',                    mode: 'http'  },
  { group: 'team',             flag: 'team.manage',      method: 'GET',   path: '/test/team-manage',             mode: 'http'  },
  { group: 'rep_assignment',   flag: 'rep_assignment',   method: 'GET',   path: '/test/rep-assignment',          mode: 'http'  },
  // TODO: add billing to owner-parity coverage when billing routes land — genuinely future, no representative route yet
];

// ── APP ───────────────────────────────────────────────────────────────────────
// Local mirror app: mounts the same real admin route modules as buildMirrorApp()
// in adminRouterIntrospection.js, PLUS the three synthetic /test/* routes for
// flags that have no live endpoints yet. We build this locally rather than extending
// buildMirrorApp() because that helper returns a sealed express app with no
// extension point for adding synthetic routes.
function buildOwnerParityApp() {
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Real admin routes — mirrors the two app.use() calls in server.js that
  // register /api/admin/* paths (confirmed by adminRouteCoverage drift guard).
  app.use('/', require('../routes/admin/index'));
  app.use('/', require('../routes/stripe'));

  // Synthetic routes — trivial 200 handlers behind real requirePermission guards.
  // These prove the Owner short-circuit covers future flags before Phase 6 lands.
  app.get('/test/team',           requirePermission('team'),           (_req, res) => res.json({ ok: true }));
  app.get('/test/team-manage',    requirePermission('team.manage'),    (_req, res) => res.json({ ok: true }));
  app.get('/test/rep-assignment', requirePermission('rep_assignment'), (_req, res) => res.json({ ok: true }));

  return app;
}

// ── HTTP HELPER ───────────────────────────────────────────────────────────────

function httpGet(port, path, token) {
  return new Promise((resolve, reject) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method: 'GET', headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
          catch { resolve({ status: res.statusCode, body: text }); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── GUARD-LEVEL HELPER ────────────────────────────────────────────────────────
// Invokes requirePermission(flag) middleware directly — bypasses the HTTP layer
// and the real route handler, but still performs a live DB read for the session
// and team_member rows (same code path as in production, no mocking).
//
// We assert:
//   - next() was called (the guard let the request through)
//   - res.status(403) was NOT sent (the tier short-circuit fired before the flag check)
async function assertGuardPassesOwner(flag, token, groupLabel) {
  const guard = requirePermission(flag);

  let nextCalled = false;
  let sentStatus = null;

  const mockReq = { headers: { authorization: `Bearer ${token}` } };
  const mockRes = {
    status(code) {
      sentStatus = code;
      return { json() {} };
    },
  };
  const mockNext = () => { nextCalled = true; };

  await guard(mockReq, mockRes, mockNext);

  assert.ok(
    nextCalled,
    `Owner-parity FAILED for group '${groupLabel}' (${flag}) [guard-level]: ` +
    `next() was not called — Owner tier short-circuit did not fire. ` +
    `Actual status sent to mockRes: ${sentStatus}.`
  );
  assert.ok(
    sentStatus !== 403,
    `Owner-parity FAILED for group '${groupLabel}' (${flag}) [guard-level]: ` +
    `guard sent 403 — empty-permissions Owner should never be denied.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const CONTRACTOR_ID = 'accent-roofing';

describe('owner-parity smoke test', () => {
  let pool, server, port;
  let ownerToken;

  before(async () => {
    pool = await initTestDb();

    // Seed an Owner team_member with empty permissions JSONB.
    // No bcrypt hash is needed — we inject the session token directly and never
    // go through the login endpoint.
    // contractor_id 'accent-roofing' is seeded by initDB() into the contractors table.
    const { rows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'owner@parity-test.com', 'placeholder-hash-not-used-in-login', 'owner', '{}')
       RETURNING id`,
      [CONTRACTOR_ID]
    );
    const ownerMemberId = rows[0].id;

    // Seed a session with role='admin' (NOT 'super_admin').
    // Rationale: super_admin bypasses via step 1a in permissions.js (a DIFFERENT mechanism).
    // We are exercising step 2a — the Owner tier short-circuit — which only fires for
    // role='admin' sessions that have team_member_id pointing to a tier='owner' row.
    ownerToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
      [ownerToken, CONTRACTOR_ID, ownerMemberId]
    );

    ({ server, port } = await startTestServer(buildOwnerParityApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  // ── SANITY: table is not accidentally empty or truncated ──────────────────
  it('sanity: PARITY_TABLE covers >= 14 distinct section groups', () => {
    const coveredGroups = new Set(PARITY_TABLE.map(e => e.group));
    assert.ok(
      coveredGroups.size >= 14,
      `PARITY_TABLE covers only ${coveredGroups.size} distinct section groups — ` +
      `expected >= 14. The table may have been accidentally truncated. ` +
      `Do NOT make this pass by raising the threshold — fix the table.`
    );
  });

  // ── COVERAGE-OF-GROUPS: every active section is exercised ─────────────────
  // If a new active section appears in the registry with routes but is absent
  // from PARITY_TABLE, this test fails and tells the author to add it.
  // 'billing' is the only permitted omission — no representative route yet.
  it('coverage: PARITY_TABLE covers every active (non-forward) section — billing is the only permitted omission', () => {
    const activeKeys = SECTIONS
      .filter(s => !s.forward)
      .map(s => s.key);

    const coveredGroups = new Set(PARITY_TABLE.map(e => e.group));

    const uncovered = activeKeys.filter(key => key !== 'billing' && !coveredGroups.has(key));

    assert.deepEqual(
      uncovered,
      [],
      `PARITY_TABLE is missing Owner-parity coverage for these active sections:\n` +
      uncovered.map(k => `  • ${k}`).join('\n') + '\n\n' +
      `Add a table entry (real endpoint or synthetic route) for each missing section ` +
      `and re-run. 'billing' is the only permitted omission ` +
      `(no representative route yet — see TODO comment in PARITY_TABLE).`
    );
  });

  // ── MAIN PARITY ASSERTIONS ────────────────────────────────────────────────
  // Data-driven loop: one it() per PARITY_TABLE entry.
  //
  // HTTP mode:   real HTTP request; non-403 proves the guard let it through.
  //              The handler body may succeed or fail (200/404/500) — irrelevant.
  //              We assert the GUARD passed, not the handler's business logic.
  //
  // Guard mode:  middleware invoked directly; assert next() was called.
  //              The middleware still does a live DB read — Owner session is seeded.
  for (const entry of PARITY_TABLE) {
    const { group, flag, method, path, mode } = entry;
    const label = `group '${group}' (${flag}) [${method} ${path}]`;

    it(`Owner-parity: ${label}`, async () => {
      if (mode === 'guard') {
        await assertGuardPassesOwner(flag, ownerToken, group);
      } else {
        const res = await httpGet(port, path, ownerToken);
        assert.notEqual(
          res.status,
          403,
          `Owner-parity FAILED for ${label}: ` +
          `empty-permissions Owner got 403 — the tier short-circuit is not firing ` +
          `for this route. Check that requirePermission('${flag}') is wired correctly ` +
          `and that permissions.js step 2a (member.tier === 'owner') is reachable ` +
          `from this route's middleware chain.`
        );
      }
    });
  }
});
