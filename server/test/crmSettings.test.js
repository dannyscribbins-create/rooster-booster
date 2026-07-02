'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { request: _httpRequest } = require('node:http');
const bcrypt = require('bcrypt');
const { startTestServer, stopTestServer } = require('./helpers');

const CONTRACTOR_ID = 'accent-roofing';

function buildAdminTestApp() {
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/', require('../routes/admin/index'));
  return app;
}

function httpRequest(port, method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
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
    if (payload) req.write(payload);
    req.end();
  });
}

// Seeds an owner-tier team_member and a valid admin session. Returns the session token.
async function seedOwnerSession(pool) {
  const hash = await bcrypt.hash('test-password', 10);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier)
     VALUES ($1, 'crm-settings-owner@test.com', $2, 'owner')
     ON CONFLICT (email) DO UPDATE SET tier = 'owner'
     RETURNING id`,
    [CONTRACTOR_ID, hash]
  );
  const memberId = rows[0].id;
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
     VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
    [token, CONTRACTOR_ID, memberId]
  );
  return token;
}

// Upserts a contractor_crm_settings row with a known attribution_source for test isolation.
async function seedCrmSettings(pool, { attributionSource = 'assessment_assigned_users' } = {}) {
  await pool.query(
    `INSERT INTO contractor_crm_settings (contractor_id, attribution_source)
     VALUES ($1, $2)
     ON CONFLICT (contractor_id) DO UPDATE SET attribution_source = EXCLUDED.attribution_source`,
    [CONTRACTOR_ID, attributionSource]
  );
}

// ── SUITE ─────────────────────────────────────────────────────────────────────

describe('CRM settings — attribution_source PUT/GET', () => {
  let pool, server, port, token;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(buildAdminTestApp()));
    token = await seedOwnerSession(pool);
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // Reset to default before each test so tests are independent.
    await seedCrmSettings(pool, { attributionSource: 'assessment_assigned_users' });
  });

  // ── TEST 1 ────────────────────────────────────────────────────────────────────
  it('saves assessment_assigned_users and round-trips on GET', async () => {
    const put = await httpRequest(port, 'PUT', '/api/admin/crm/settings',
      { attribution_source: 'assessment_assigned_users' }, token);
    assert.equal(put.status, 200, `PUT returned ${put.status}: ${JSON.stringify(put.body)}`);
    assert.equal(put.body.success, true);

    const get = await httpRequest(port, 'GET', '/api/admin/crm/status', null, token);
    assert.equal(get.status, 200, `GET returned ${get.status}`);
    assert.equal(get.body.attributionSource, 'assessment_assigned_users',
      `Expected attributionSource 'assessment_assigned_users', got ${get.body.attributionSource}`);
  });

  // ── TEST 2 ────────────────────────────────────────────────────────────────────
  it('saves request_salesperson and round-trips on GET', async () => {
    const put = await httpRequest(port, 'PUT', '/api/admin/crm/settings',
      { attribution_source: 'request_salesperson' }, token);
    assert.equal(put.status, 200, `PUT returned ${put.status}: ${JSON.stringify(put.body)}`);
    assert.equal(put.body.success, true);

    const get = await httpRequest(port, 'GET', '/api/admin/crm/status', null, token);
    assert.equal(get.status, 200, `GET returned ${get.status}`);
    assert.equal(get.body.attributionSource, 'request_salesperson',
      `Expected attributionSource 'request_salesperson', got ${get.body.attributionSource}`);
  });

  // ── TEST 3 ────────────────────────────────────────────────────────────────────
  it('returns 400 for invalid attribution_source and does not change the stored value', async () => {
    const put = await httpRequest(port, 'PUT', '/api/admin/crm/settings',
      { attribution_source: 'bogus_mode' }, token);
    assert.equal(put.status, 400,
      `Expected 400 for invalid value, got ${put.status}: ${JSON.stringify(put.body)}`);
    assert.ok(put.body.error, 'response must include an error code');

    // Stored value must be unchanged (still the default seeded in beforeEach)
    const get = await httpRequest(port, 'GET', '/api/admin/crm/status', null, token);
    assert.equal(get.body.attributionSource, 'assessment_assigned_users',
      `Stored attribution_source must not change after 400, got ${get.body.attributionSource}`);
  });

  // ── TEST 4 ────────────────────────────────────────────────────────────────────
  it('COALESCE: PUT that omits attribution_source does not overwrite the stored value', async () => {
    // Seed a non-default value to detect an overwrite
    await seedCrmSettings(pool, { attributionSource: 'request_salesperson' });

    // PUT with a different field, no attribution_source in body
    const put = await httpRequest(port, 'PUT', '/api/admin/crm/settings',
      { referrerFieldName: 'Referred by Test' }, token);
    assert.equal(put.status, 200, `PUT returned ${put.status}: ${JSON.stringify(put.body)}`);

    // attribution_source must still be request_salesperson
    const get = await httpRequest(port, 'GET', '/api/admin/crm/status', null, token);
    assert.equal(get.body.attributionSource, 'request_salesperson',
      `COALESCE failed: attribution_source was overwritten, got ${get.body.attributionSource}`);
  });
});
