'use strict';

// Authorization short-circuit NOT tested in this phase — no protected routes exist yet
// for it to bypass. That assertion is deferred to Phase 4/5 RBAC enforcement tests,
// once requirePermission() middleware is built.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const bcrypt = require('bcrypt');
const superAdminRouter = require('../routes/superAdmin');
const { startTestServer, stopTestServer } = require('./helpers');

function buildSuperAdminTestApp() {
  const express = require('express');
  const app = express();
  // trust proxy so each test can pass a unique x-forwarded-for IP and stay
  // under superAdminLoginLimiter's 5-per-15min-per-IP cap.
  app.set('trust proxy', true);
  app.use(express.json({ limit: '5mb' }));
  app.use('/', superAdminRouter);
  return app;
}

function httpPost(port, path, body, extraHeaders = {}) {
  const bodyBuf = Buffer.from(JSON.stringify(body));
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

const TEST_EMAIL    = 'superadmin@test.com';
const TEST_PASSWORD = 'TestP@ssword123!';

describe('super-admin login', () => {
  let pool, server, port, testHash;

  before(async () => {
    pool = await initTestDb();
    // rounds=4 for test speed — validates bcrypt.compare logic without full production cost
    testHash = await bcrypt.hash(TEST_PASSWORD, 4);
    ({ server, port } = await startTestServer(buildSuperAdminTestApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM super_admins');
    await pool.query(
      'INSERT INTO super_admins (email, password_hash) VALUES ($1, $2)',
      [TEST_EMAIL, testHash]
    );
  });

  // ── TEST 1 ────────────────────────────────────────────────────────────────────
  it('correct credentials: login succeeds, session issued with role=super_admin', async () => {
    const resp = await httpPost(
      port, '/api/rm-control/login',
      { email: TEST_EMAIL, password: TEST_PASSWORD },
      { 'x-forwarded-for': '10.0.1.1' }
    );

    assert.equal(resp.status, 200);
    assert.equal(resp.body.success, true);
    assert.ok(resp.body.token, 'token present in response');
    assert.match(resp.body.token, /^[0-9a-f]{64}$/, 'token is 64-char hex');

    const { rows } = await pool.query(
      'SELECT role FROM sessions WHERE token = $1',
      [resp.body.token]
    );
    assert.equal(rows.length, 1, 'session row created');
    assert.equal(rows[0].role, 'super_admin');
  });

  // ── TEST 2 ────────────────────────────────────────────────────────────────────
  it('correct email + wrong password: login fails, no session issued', async () => {
    const resp = await httpPost(
      port, '/api/rm-control/login',
      { email: TEST_EMAIL, password: 'WrongPassword!' },
      { 'x-forwarded-for': '10.0.1.2' }
    );

    assert.equal(resp.status, 401);
    assert.ok(resp.body.error, 'error field present');

    const { rows } = await pool.query('SELECT id FROM sessions');
    assert.equal(rows.length, 0, 'no session created on wrong password');
  });

  // ── TEST 3 ────────────────────────────────────────────────────────────────────
  it('nonexistent email: login fails with same error shape as wrong password — no email enumeration', async () => {
    const noEmailResp = await httpPost(
      port, '/api/rm-control/login',
      { email: 'nobody@example.com', password: TEST_PASSWORD },
      { 'x-forwarded-for': '10.0.1.3' }
    );
    const wrongPwResp = await httpPost(
      port, '/api/rm-control/login',
      { email: TEST_EMAIL, password: 'WrongPassword!' },
      { 'x-forwarded-for': '10.0.1.3' }
    );

    assert.equal(noEmailResp.status, 401);
    assert.equal(wrongPwResp.status, 401);
    assert.equal(
      noEmailResp.body.error, wrongPwResp.body.error,
      'same error message for nonexistent email vs wrong password'
    );

    const { rows } = await pool.query('SELECT id FROM sessions');
    assert.equal(rows.length, 0, 'no session created on nonexistent email');
  });

  // ── TEST 4 ────────────────────────────────────────────────────────────────────
  it('issued session token: 64-char hex, role=super_admin, not already expired', async () => {
    const resp = await httpPost(
      port, '/api/rm-control/login',
      { email: TEST_EMAIL, password: TEST_PASSWORD },
      { 'x-forwarded-for': '10.0.1.4' }
    );

    assert.equal(resp.status, 200);
    const token = resp.body.token;
    assert.equal(typeof token, 'string', 'token is a string');
    assert.equal(token.length, 64, 'token is exactly 64 characters');
    assert.match(token, /^[0-9a-f]+$/, 'token contains only lowercase hex chars');

    const { rows } = await pool.query(
      'SELECT role, expires_at FROM sessions WHERE token = $1',
      [token]
    );
    assert.equal(rows[0].role, 'super_admin', 'role column is super_admin');
    assert.ok(new Date(rows[0].expires_at) > new Date(), 'session is not already expired');
  });
});
