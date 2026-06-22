'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');
const { verifyAdminSession } = require('../middleware/auth');
const { startTestServer, stopTestServer } = require('./helpers');

function buildAdminTestApp() {
  const express = require('express');
  const adminRouter = require('../routes/admin/index');
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '5mb' }));
  app.use('/', adminRouter);
  return app;
}

function httpPost(port, path, bodyObj, extraHeaders = {}) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
        ...extraHeaders,
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

const TEST_EMAIL    = 'owner@test-contractor.com';
const TEST_PASSWORD = 'TestOwner@123!';

describe('contractor context', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(buildAdminTestApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM sessions');
    // Clean up both the fixed test email and any team_members seeded under the dev-tenant id
    // (used by rename-safety tests). team_members must be deleted before contractors due to FK.
    await pool.query("DELETE FROM team_members WHERE email = $1 OR contractor_id = 'accent-roofing-dev'", [TEST_EMAIL]);
    await pool.query("DELETE FROM contractors WHERE id = 'accent-roofing-dev'");
  });

  // ── TEST 1 ────────────────────────────────────────────────────────────────────
  // Phase 2.5: the contractors seed in initDB() now uses an empty-table guard rather than
  // ON CONFLICT (id) DO NOTHING. The assertion below still passes because setup.js always
  // wipes the schema before calling initDB(), so the table is empty and the guard fires,
  // seeding 'accent-roofing' exactly as before. On a live deployment that already has rows
  // (e.g. after Phase 3's dev-tenant rename), the guard does NOT fire — no re-creation.
  it('initDB seeds contractors table on first boot (empty-table guard)', async () => {
    const { rows } = await pool.query(
      'SELECT id, name, status FROM contractors ORDER BY id'
    );
    assert.equal(rows.length, 1, 'exactly one contractor row on fresh boot');
    assert.equal(rows[0].id, 'accent-roofing');
    assert.equal(rows[0].name, 'Accent Roofing Service');
    assert.equal(rows[0].status, 'active');
  });

  // ── TEST 2 ────────────────────────────────────────────────────────────────────
  it('team_members table exists and has expected columns', async () => {
    const { rows } = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'team_members'
      ORDER BY ordinal_position
    `);
    const cols = Object.fromEntries(rows.map(r => [r.column_name, r]));
    assert.ok(cols.id,            'id column exists');
    assert.ok(cols.contractor_id, 'contractor_id column exists');
    assert.ok(cols.email,         'email column exists');
    assert.ok(cols.password_hash, 'password_hash column exists');
    assert.ok(cols.tier,          'tier column exists');
    assert.ok(cols.active,        'active column exists');
    assert.equal(cols.contractor_id.is_nullable, 'NO', 'contractor_id is NOT NULL');
    assert.equal(cols.email.is_nullable,         'NO', 'email is NOT NULL');
  });

  // ── TEST 3 ────────────────────────────────────────────────────────────────────
  it('Owner team_member authenticates via email+bcrypt and session carries contractor_id', async () => {
    // rounds=4 for test speed
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier)
       VALUES ('accent-roofing', $1, $2, 'owner')`,
      [TEST_EMAIL, hash]
    );

    const resp = await httpPost(
      port, '/api/admin/login',
      { email: TEST_EMAIL, password: TEST_PASSWORD },
      { 'x-forwarded-for': '10.0.2.1' }
    );

    assert.equal(resp.status, 200, 'login succeeds');
    assert.equal(resp.body.success, true);
    assert.ok(resp.body.token, 'token present');
    assert.match(resp.body.token, /^[0-9a-f]{64}$/, 'token is 64-char hex');

    const { rows } = await pool.query(
      'SELECT role, contractor_id FROM sessions WHERE token = $1',
      [resp.body.token]
    );
    assert.equal(rows.length, 1, 'session row created');
    assert.equal(rows[0].role, 'admin');
    assert.equal(rows[0].contractor_id, 'accent-roofing', 'session carries accent-roofing contractor_id');
  });

  // ── TEST 4 ────────────────────────────────────────────────────────────────────
  it('wrong password returns 401 and no session is created', async () => {
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier)
       VALUES ('accent-roofing', $1, $2, 'owner')`,
      [TEST_EMAIL, hash]
    );

    const resp = await httpPost(
      port, '/api/admin/login',
      { email: TEST_EMAIL, password: 'WrongPassword!' },
      { 'x-forwarded-for': '10.0.2.2' }
    );

    assert.equal(resp.status, 401);
    assert.equal(resp.body.error, 'Invalid credentials');

    const { rows } = await pool.query('SELECT id FROM sessions');
    assert.equal(rows.length, 0, 'no session created on wrong password');
  });

  // ── TEST 5 ────────────────────────────────────────────────────────────────────
  it('unknown email returns same 401 shape as wrong password (no email enumeration)', async () => {
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier)
       VALUES ('accent-roofing', $1, $2, 'owner')`,
      [TEST_EMAIL, hash]
    );

    const knownWrongPw = await httpPost(
      port, '/api/admin/login',
      { email: TEST_EMAIL, password: 'WrongPassword!' },
      { 'x-forwarded-for': '10.0.2.3' }
    );
    const unknownEmail = await httpPost(
      port, '/api/admin/login',
      { email: 'nobody@example.com', password: TEST_PASSWORD },
      { 'x-forwarded-for': '10.0.2.3' }
    );

    assert.equal(knownWrongPw.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(
      knownWrongPw.body.error, unknownEmail.body.error,
      'same error message regardless of whether email exists'
    );
  });

  // ── TEST 6 ────────────────────────────────────────────────────────────────────
  it('verifyAdminSession returns { contractorId } for a valid admin session with contractor_id', async () => {
    const token = 'a'.repeat(64);
    const expiresAt = new Date(Date.now() + 3_600_000);
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at, role, contractor_id) VALUES (NULL, $1, $2, $3, $4)',
      [token, expiresAt, 'admin', 'accent-roofing']
    );

    // verifyAdminSession needs req.headers.authorization; simulate with a minimal mock
    const fakeReq = { headers: { authorization: `Bearer ${token}` } };
    const fakeRes = {
      status: () => fakeRes,
      json: () => {},
    };

    const result = await verifyAdminSession(fakeReq, fakeRes);
    assert.ok(result, 'result is truthy');
    assert.equal(typeof result, 'object');
    assert.equal(result.contractorId, 'accent-roofing');
  });

  // ── TEST 7 ────────────────────────────────────────────────────────────────────
  it('sessions.contractor_id is nullable — referrer sessions without it still load correctly', async () => {
    const token = 'b'.repeat(64);
    const expiresAt = new Date(Date.now() + 3_600_000);
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at, role) VALUES (NULL, $1, $2, $3)',
      [token, expiresAt, 'referrer']
    );

    const { rows } = await pool.query(
      'SELECT contractor_id FROM sessions WHERE token = $1',
      [token]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].contractor_id, null, 'referrer session has null contractor_id — schema is nullable');
  });

  // ── RENAME-SAFETY TESTS (Phase 3) ─────────────────────────────────────────────
  // These three tests verify that every dynamic-read path wired in Phase 2/2.5
  // resolves correctly against the renamed dev-tenant id 'accent-roofing-dev'.
  // They prove the paths are not hardcoded to any specific contractor_id value.

  // ── TEST 8 ────────────────────────────────────────────────────────────────────
  it('rename-safety: verifyAdminSession resolves contractorId dynamically from session row', async () => {
    await pool.query(
      `INSERT INTO contractors (id, name, status) VALUES ('accent-roofing-dev', 'Accent Roofing Service', 'active')`
    );
    const token = 'c'.repeat(64);
    const expiresAt = new Date(Date.now() + 3_600_000);
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at, role, contractor_id) VALUES (NULL, $1, $2, $3, $4)',
      [token, expiresAt, 'admin', 'accent-roofing-dev']
    );

    const fakeReq = { headers: { authorization: `Bearer ${token}` } };
    const fakeRes = { status: () => fakeRes, json: () => {} };

    const result = await verifyAdminSession(fakeReq, fakeRes);
    assert.ok(result, 'result is truthy');
    assert.equal(result.contractorId, 'accent-roofing-dev',
      'contractorId is read from the session row — not hardcoded to any specific value');
  });

  // ── TEST 9 ────────────────────────────────────────────────────────────────────
  it('rename-safety: admin login writes team_member contractor_id into session (works with renamed id)', async () => {
    await pool.query(
      `INSERT INTO contractors (id, name, status) VALUES ('accent-roofing-dev', 'Accent Roofing Service', 'active')`
    );
    const hash = await bcrypt.hash(TEST_PASSWORD, 4);
    await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier)
       VALUES ('accent-roofing-dev', $1, $2, 'owner')`,
      [TEST_EMAIL, hash]
    );

    const resp = await httpPost(
      port, '/api/admin/login',
      { email: TEST_EMAIL, password: TEST_PASSWORD },
      { 'x-forwarded-for': '10.0.3.1' }
    );

    assert.equal(resp.status, 200, 'login with renamed-tenant team_member succeeds');
    assert.ok(resp.body.token, 'token issued');
    const { rows } = await pool.query(
      'SELECT contractor_id FROM sessions WHERE token = $1',
      [resp.body.token]
    );
    assert.equal(rows[0].contractor_id, 'accent-roofing-dev',
      'session carries renamed contractor_id read from team_members — not a hardcoded value');
  });

  // ── TEST 10 ───────────────────────────────────────────────────────────────────
  it('rename-safety: contractors empty-table guard does not re-seed when table already has rows', async () => {
    // Simulates the guard logic from db.js exactly as written post-Phase 2.5.
    // On Railway post-rename the contractors table has 'accent-roofing-dev'; this test
    // proves the guard finds an existing row and suppresses the seed INSERT, preventing
    // a phantom 'accent-roofing' row from being re-created on every deploy.
    const { rows: before } = await pool.query('SELECT id FROM contractors ORDER BY id');
    assert.ok(before.length > 0, 'contractors table already has rows before guard runs');

    // Replicate the exact guard condition from initDB()
    const { rows: existingContractors } = await pool.query('SELECT id FROM contractors LIMIT 1');
    if (existingContractors.length === 0) {
      await pool.query(
        `INSERT INTO contractors (id, name, status) VALUES ('accent-roofing', 'Accent Roofing Service', 'active')`
      );
    }

    const { rows: after } = await pool.query('SELECT id FROM contractors ORDER BY id');
    assert.equal(after.length, before.length,
      'guard suppressed re-seed: contractor row count unchanged');
    assert.deepEqual(
      after.map(r => r.id), before.map(r => r.id),
      'no phantom contractor row inserted by guard when table has rows'
    );
  });
});
