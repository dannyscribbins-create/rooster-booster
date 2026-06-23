'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { request: _httpRequest } = require('node:http');
const bcrypt = require('bcrypt');
const { requirePermission } = require('../middleware/permissions');
const { startTestServer, stopTestServer } = require('./helpers');

// ── TEST APP ──────────────────────────────────────────────────────────────────
// Minimal Express app that mounts:
//   - Generic test routes for direct middleware unit testing
//   - The 3 sample-tagged admin routes to prove the middleware is wired correctly
function buildPermissionTestApp() {
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Generic test routes — each exercises one flag without side-effects from the real handler
  app.get( '/test/dashboard',        requirePermission('dashboard'),        (_req, res) => res.json({ ok: true }));
  app.get( '/test/cashouts',         requirePermission('cashouts'),         (_req, res) => res.json({ ok: true }));
  app.post('/test/cashout_approve',  requirePermission('cashout_approve'),  (_req, res) => res.json({ ok: true }));

  // Sample-tagged routes — mounted to prove requirePermission() is wired at route level
  app.use('/', require('../routes/admin/metrics'));
  app.use('/', require('../routes/admin/cashouts'));
  // Full admin index — needed for retention-settings and prize-settings wiring tests
  app.use('/', require('../routes/admin/index'));
  // Stripe admin routes — outside admin/ folder, Phase 4B gap fix
  app.use('/', require('../routes/stripe'));

  return app;
}

// ── HTTP HELPERS ──────────────────────────────────────────────────────────────

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

function httpMethod(port, method, path, bodyObj, token) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj || {}));
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': bodyBuf.length,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method, headers },
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
    req.write(bodyBuf);
    req.end();
  });
}

const CONTRACTOR_ID = 'accent-roofing';

describe('requirePermission middleware', () => {
  let pool, server, port;
  let ownerMemberId, adminMemberId, generalMemberId;

  before(async () => {
    pool = await initTestDb();

    // Create three test team members — one of each tier.
    // rounds=4 for test speed.
    const hash = await bcrypt.hash('TestPerm123!', 4);

    const ownerRow = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'owner@perm-test.com', $2, 'owner', '{}') RETURNING id`,
      [CONTRACTOR_ID, hash]
    );
    ownerMemberId = ownerRow.rows[0].id;

    const adminRow = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'admin@perm-test.com', $2, 'admin', '{}') RETURNING id`,
      [CONTRACTOR_ID, hash]
    );
    adminMemberId = adminRow.rows[0].id;

    const generalRow = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'general@perm-test.com', $2, 'general', '{}') RETURNING id`,
      [CONTRACTOR_ID, hash]
    );
    generalMemberId = generalRow.rows[0].id;

    ({ server, port } = await startTestServer(buildPermissionTestApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // Fresh sessions and cleared permissions before every test
    await pool.query('DELETE FROM sessions');
    await pool.query(
      `UPDATE team_members SET permissions = '{}' WHERE contractor_id = $1`,
      [CONTRACTOR_ID]
    );
  });

  // ── HELPERS ──────────────────────────────────────────────────────────────────

  async function makeAdminSession(teamMemberId) {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
      [token, CONTRACTOR_ID, teamMemberId]
    );
    return token;
  }

  async function makeSuperAdminSession() {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'super_admin')`,
      [token]
    );
    return token;
  }

  async function setPermissions(memberId, perms) {
    await pool.query(
      `UPDATE team_members SET permissions = $1 WHERE id = $2`,
      [JSON.stringify(perms), memberId]
    );
  }

  // ── TEST 1: super-admin bypasses all flags ────────────────────────────────
  it('super-admin session: allowed for any flag regardless of JSONB state', async () => {
    const token = await makeSuperAdminSession();

    const r1 = await httpGet(port, '/test/dashboard', token);
    assert.equal(r1.status, 200, 'super-admin passes dashboard');

    const r2 = await httpMethod(port, 'POST', '/test/cashout_approve', {}, token);
    assert.equal(r2.status, 200, 'super-admin passes cashout_approve');
  });

  // ── TEST 2: owner tier short-circuit — empty JSONB still allowed ──────────
  it('owner-tier session: allowed for any flag, even with completely empty permissions JSONB', async () => {
    const token = await makeAdminSession(ownerMemberId);
    await setPermissions(ownerMemberId, {}); // explicitly empty

    const r1 = await httpGet(port, '/test/dashboard', token);
    assert.equal(r1.status, 200, 'owner passes dashboard with empty JSONB');

    const r2 = await httpMethod(port, 'POST', '/test/cashout_approve', {}, token);
    assert.equal(r2.status, 200, 'owner passes cashout_approve with empty JSONB');

    const r3 = await httpGet(port, '/test/cashouts', token);
    assert.equal(r3.status, 200, 'owner passes cashouts with empty JSONB');
  });

  // ── TEST 3: admin tier with flag=true → allowed ───────────────────────────
  it('admin-tier session with flag=true → 200', async () => {
    await setPermissions(adminMemberId, { dashboard: true });
    const token = await makeAdminSession(adminMemberId);

    const res = await httpGet(port, '/test/dashboard', token);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  // ── TEST 4: admin tier with flag=false → 403 ─────────────────────────────
  it('admin-tier session with flag=false → 403', async () => {
    await setPermissions(adminMemberId, { dashboard: false });
    const token = await makeAdminSession(adminMemberId);

    const res = await httpGet(port, '/test/dashboard', token);
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Access denied');
  });

  // ── TEST 5: admin tier with flag absent → 403 (fail-closed default) ───────
  it('admin-tier session with flag absent entirely → 403 (fail-closed)', async () => {
    await setPermissions(adminMemberId, {}); // empty — flag not present
    const token = await makeAdminSession(adminMemberId);

    const res = await httpGet(port, '/test/cashouts', token);
    assert.equal(res.status, 403, 'absent flag must deny, not allow');
    assert.equal(res.body.error, 'Access denied');
  });

  // ── TEST 6: general tier + cashout_approve=true → 403 (defense-in-depth) ──
  it('general-tier session with cashout_approve=true → 403 (defense-in-depth rule)', async () => {
    // Simulate a bypassed save-permissions check — General member somehow has the flag
    await setPermissions(generalMemberId, { cashout_approve: true });
    const token = await makeAdminSession(generalMemberId);

    const res = await httpMethod(port, 'POST', '/test/cashout_approve', {}, token);
    assert.equal(res.status, 403, 'General must be denied cashout_approve even when flag=true in JSONB');
    assert.equal(res.body.error, 'Access denied');
  });

  // ── TEST 7: live reads — permission change takes effect on next request ────
  it('live reads: permission change reflects immediately without re-login', async () => {
    await setPermissions(adminMemberId, { dashboard: false });
    const token = await makeAdminSession(adminMemberId);

    const denied = await httpGet(port, '/test/dashboard', token);
    assert.equal(denied.status, 403, 'initially denied');

    // Change the flag in the DB — same token, no re-login
    await setPermissions(adminMemberId, { dashboard: true });

    const allowed = await httpGet(port, '/test/dashboard', token);
    assert.equal(allowed.status, 200, 'next request with same token sees updated permission immediately');
  });

  // ── TEST 8: GET /api/admin/stats enforces 'dashboard' flag ───────────────
  it('GET /api/admin/stats: wired to requirePermission(dashboard) — admin without flag → 403', async () => {
    await setPermissions(adminMemberId, {}); // no dashboard flag
    const token = await makeAdminSession(adminMemberId);

    const res = await httpGet(port, '/api/admin/stats', token);
    assert.equal(res.status, 403, 'stats route enforces dashboard permission');
  });

  // ── TEST 9: GET /api/admin/cashouts enforces 'cashouts' flag ─────────────
  it('GET /api/admin/cashouts: wired to requirePermission(cashouts) — admin without flag → 403', async () => {
    await setPermissions(adminMemberId, {});
    const token = await makeAdminSession(adminMemberId);

    const res = await httpGet(port, '/api/admin/cashouts', token);
    assert.equal(res.status, 403, 'cashouts route enforces cashouts permission');
  });

  // ── TEST 10: PATCH /api/admin/cashouts/:id enforces 'cashout_approve' flag ─
  it('PATCH /api/admin/cashouts/:id: wired to requirePermission(cashout_approve) — admin without flag → 403', async () => {
    await setPermissions(adminMemberId, {});
    const token = await makeAdminSession(adminMemberId);

    // Permission check fires before the handler body — cashout row need not exist
    const res = await httpMethod(port, 'PATCH', '/api/admin/cashouts/999', { status: 'approved' }, token);
    assert.equal(res.status, 403, 'cashout approval route enforces cashout_approve permission');
  });

  // ── TEST 11: no Authorization header → 401 ───────────────────────────────
  it('request with no Authorization header → 401', async () => {
    const res = await httpGet(port, '/test/dashboard', null);
    assert.equal(res.status, 401);
  });

  // ── TEST 12: expired session → 401 ───────────────────────────────────────
  it('expired session → 401', async () => {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() - INTERVAL '1 second', 'admin', $2, $3)`,
      [token, CONTRACTOR_ID, adminMemberId]
    );

    const res = await httpGet(port, '/test/dashboard', token);
    assert.equal(res.status, 401);
  });

  // ── TEST 13: admin session without team_member_id (legacy) → 403 ─────────
  it('admin session with team_member_id=null (legacy/pre-Phase-4A session) → 403 (fail-closed)', async () => {
    // Simulates a session that was created before team_member_id column existed
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2)`,
      [token, CONTRACTOR_ID]
    );

    const res = await httpGet(port, '/test/dashboard', token);
    assert.equal(res.status, 403, 'legacy session without team_member_id is denied — fail closed');
  });

  // ── TEST 14: GET /api/admin/retention-settings enforces 'experience' flag ───
  it('GET /api/admin/retention-settings: wired to requirePermission(experience) — admin without flag → 403', async () => {
    await setPermissions(adminMemberId, {}); // no experience flag
    const token = await makeAdminSession(adminMemberId);

    const res = await httpGet(port, '/api/admin/retention-settings', token);
    assert.equal(res.status, 403, 'retention-settings GET enforces experience permission');
  });

  // ── TEST 15: POST /api/admin/retention-settings enforces 'experience.manage' flag
  it('POST /api/admin/retention-settings: wired to requirePermission(experience.manage) — admin without flag → 403', async () => {
    await setPermissions(adminMemberId, { experience: true }); // view only, no manage
    const token = await makeAdminSession(adminMemberId);

    const res = await httpMethod(port, 'POST', '/api/admin/retention-settings', {
      leaderboard_enabled: true, warmup_mode_enabled: false, shouts_enabled: true,
      experience_flow_enabled: false, year_start_month: 1,
      quarter_1_start: 1, quarter_2_start: 4, quarter_3_start: 7, quarter_4_start: 10,
    }, token);
    assert.equal(res.status, 403, 'retention-settings POST enforces experience.manage permission');
  });

  // ── TEST 16: POST /api/admin/retention-settings rejects prize fields ─────────
  it('POST /api/admin/retention-settings: prize fields in body → 400 explicit rejection', async () => {
    await setPermissions(adminMemberId, { 'experience.manage': true });
    const token = await makeAdminSession(adminMemberId);

    const res = await httpMethod(port, 'POST', '/api/admin/retention-settings', {
      leaderboard_enabled: true, warmup_mode_enabled: false, shouts_enabled: true,
      experience_flow_enabled: false, year_start_month: 1,
      quarter_1_start: 1, quarter_2_start: 4, quarter_3_start: 7, quarter_4_start: 10,
      quarterly_prizes: [],  // prize field — must be rejected
    }, token);
    assert.equal(res.status, 400, 'engagement endpoint must reject prize fields with 400');
    assert.ok(
      res.body?.error?.includes('prize-settings'),
      `error message must reference prize-settings endpoint, got: ${res.body?.error}`
    );
  });

  // ── TEST 17: POST /api/admin/prize-settings enforces 'finance_settings.manage' flag
  it('POST /api/admin/prize-settings: wired to requirePermission(finance_settings.manage) — admin without flag → 403', async () => {
    await setPermissions(adminMemberId, { finance_settings: true }); // view only, no manage
    const token = await makeAdminSession(adminMemberId);

    const res = await httpMethod(port, 'POST', '/api/admin/prize-settings', {
      quarterly_prizes: [], yearly_prizes: [],
    }, token);
    assert.equal(res.status, 403, 'prize-settings POST enforces finance_settings.manage permission');
  });

  // ── TEST 18: GET /api/admin/stripe/connection-status enforces 'finance_settings' flag ──
  it('GET /api/admin/stripe/connection-status: wired to requirePermission(finance_settings) — admin without flag → 403', async () => {
    await setPermissions(adminMemberId, {}); // no finance_settings flag
    const token = await makeAdminSession(adminMemberId);

    const res = await httpGet(port, '/api/admin/stripe/connection-status', token);
    assert.equal(res.status, 403, 'connection-status GET enforces finance_settings permission');
  });

  // ── TEST 19: POST /api/admin/stripe/create-account-link enforces 'finance_settings.manage' flag ──
  it('POST /api/admin/stripe/create-account-link: wired to requirePermission(finance_settings.manage) — view-only flag → 403', async () => {
    await setPermissions(adminMemberId, { finance_settings: true }); // view only, no manage
    const token = await makeAdminSession(adminMemberId);

    const res = await httpMethod(port, 'POST', '/api/admin/stripe/create-account-link', {}, token);
    assert.equal(res.status, 403, 'create-account-link enforces finance_settings.manage permission');
  });

  // ── TEST 20: POST /api/admin/stripe/confirm-connection enforces 'finance_settings.manage' flag ──
  it('POST /api/admin/stripe/confirm-connection: wired to requirePermission(finance_settings.manage) — view-only flag → 403', async () => {
    await setPermissions(adminMemberId, { finance_settings: true }); // view only, no manage
    const token = await makeAdminSession(adminMemberId);

    const res = await httpMethod(port, 'POST', '/api/admin/stripe/confirm-connection', {}, token);
    assert.equal(res.status, 403, 'confirm-connection enforces finance_settings.manage permission');
  });

  // ── TEST 21: POST /api/admin/stripe/disconnect enforces 'finance_settings.manage' flag ──
  it('POST /api/admin/stripe/disconnect: wired to requirePermission(finance_settings.manage) — view-only flag → 403', async () => {
    await setPermissions(adminMemberId, { finance_settings: true }); // view only, no manage
    const token = await makeAdminSession(adminMemberId);

    const res = await httpMethod(port, 'POST', '/api/admin/stripe/disconnect', {}, token);
    assert.equal(res.status, 403, 'disconnect enforces finance_settings.manage permission');
  });

  // ── TEST 22: POST /api/admin/stripe/transfer enforces 'cashout_approve' flag ──
  it('POST /api/admin/stripe/transfer: wired to requirePermission(cashout_approve) — admin without flag → 403', async () => {
    await setPermissions(adminMemberId, {}); // no cashout_approve flag
    const token = await makeAdminSession(adminMemberId);

    const res = await httpMethod(port, 'POST', '/api/admin/stripe/transfer', { cashoutRequestId: 1, userId: 1, bonusAmount: 100 }, token);
    assert.equal(res.status, 403, 'transfer route enforces cashout_approve permission');
  });

  // ── TEST 23: POST /api/admin/stripe/transfer — General-tier defense-in-depth ──
  it('POST /api/admin/stripe/transfer: General-tier with cashout_approve=true → 403 (defense-in-depth)', async () => {
    // Simulate a bypassed save-permissions check — General member somehow has the flag
    await setPermissions(generalMemberId, { cashout_approve: true });
    const token = await makeAdminSession(generalMemberId);

    const res = await httpMethod(port, 'POST', '/api/admin/stripe/transfer', { cashoutRequestId: 1, userId: 1, bonusAmount: 100 }, token);
    assert.equal(res.status, 403, 'General must be denied cashout_approve on transfer even when flag=true in JSONB');
    assert.equal(res.body.error, 'Access denied');
  });
});
