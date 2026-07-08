'use strict';

// Tenant-resolution rebuild S2, Phase H hotfix — RED-first test for restoring
// POST /api/signup, broken live since S1's users.contractor_id NOT NULL migration
// (the INSERT at referrer.js:241 never carried contractor_id; the duplicate-email
// check at referrer.js:229 is also global instead of per-tenant). Fix threads
// link.contractor_id — already SELECTed from contractor_invite_links at the
// invite-link lookup (referrer.js:218-222) — into both statements.
//
// Written FIRST, before the fix exists — expected RED against today's code:
// tests 1 and 2 fail on the signup 500 (NOT NULL violation surfacing through the
// route's generic catch block), test 3 fails on its first signup call for the
// same reason.

// Mock the 'resend' package BEFORE requiring app.js. POST /api/signup's
// verification-email send (referrer.js ~288) is NOT behind the route's
// _setTestOverrides seam (that seam only covers the cashout-section sends per
// its own comment) — and the real RESEND_API_KEY from .env leaks into the test
// process alongside .env.test (see attributionWiring.test.js's LIVE-SEND GUARD
// note: post-require env mutation has no effect since Resend instances are
// built at require()-time). Stubbing the module here is process-local to this
// test file and touches no production code.
const _resendPath = require.resolve('resend');
require.cache[_resendPath] = {
  id: _resendPath,
  filename: _resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = { send: async () => ({ data: { id: 'test-stub' }, error: null }) };
      }
    },
  },
};

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { seedContractor, startTestServer, stopTestServer } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';

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

async function seedInviteLink(pool, { contractorId, slug, linkType = 'contractor' }) {
  await pool.query(
    `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
     VALUES ($1, $2, $3, true)`,
    [contractorId, slug, linkType]
  );
}

function validSignupBody(overrides = {}) {
  return {
    firstName: 'Test',
    lastName: 'Referrer',
    phone: '555-123-4567',
    email: `signup-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    password: 'password123',
    inviteSlug: 'unset-slug',
    ...overrides,
  };
}

describe('POST /api/signup — stamps contractor_id from invite link (tenant rebuild S2 hotfix, Batch A1+A2)', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // FK-safe wipe order — adminCreatesReferrer.test.js's proven order (sessions,
    // user_badges, users, team_members, titles, contractors), extended at the front
    // with the signup-specific tables (no FK to contractors, safe to wipe anytime).
    await pool.query('DELETE FROM email_verifications');
    await pool.query('DELETE FROM contacts');
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractors');

    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);
  });

  it("invite-link signup stamps the link's contractor", async () => {
    const slug = `slug-a-${Date.now()}`;
    await seedInviteLink(pool, { contractorId: TENANT_A, slug });
    const email = `stamp-${Date.now()}@test.com`;

    const res = await httpPost(
      port, '/api/signup',
      validSignupBody({ email, inviteSlug: slug }),
      { 'X-Forwarded-For': '10.0.1.1' }
    );

    assert.equal(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);

    const { rows } = await pool.query('SELECT contractor_id FROM users WHERE email = $1', [email]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].contractor_id, TENANT_A);
  });

  it('same email can sign up under two different contractors via their respective links', async () => {
    const slugA = `slug-a-${Date.now()}`;
    const slugB = `slug-b-${Date.now()}`;
    await seedInviteLink(pool, { contractorId: TENANT_A, slug: slugA });
    await seedInviteLink(pool, { contractorId: TENANT_B, slug: slugB });
    const sharedEmail = `shared-${Date.now()}@test.com`;

    const resA = await httpPost(
      port, '/api/signup',
      validSignupBody({ email: sharedEmail, inviteSlug: slugA, phone: '555-000-0001' }),
      { 'X-Forwarded-For': '10.0.2.1' }
    );
    const resB = await httpPost(
      port, '/api/signup',
      validSignupBody({ email: sharedEmail, inviteSlug: slugB, phone: '555-000-0002' }),
      { 'X-Forwarded-For': '10.0.2.1' }
    );

    assert.equal(resA.status, 201, `tenant A signup failed: ${JSON.stringify(resA.body)}`);
    assert.equal(resB.status, 201, `tenant B signup failed: ${JSON.stringify(resB.body)}`);

    const { rows } = await pool.query(
      'SELECT contractor_id FROM users WHERE email = $1 ORDER BY contractor_id',
      [sharedEmail]
    );
    assert.equal(rows.length, 2, 'expected one row per contractor for the shared email');
    assert.deepEqual(rows.map(r => r.contractor_id).sort(), [TENANT_A, TENANT_B]);
  });

  it('duplicate email within the same contractor is still rejected', async () => {
    const slugA1 = `slug-a1-${Date.now()}`;
    const slugA2 = `slug-a2-${Date.now()}`;
    await seedInviteLink(pool, { contractorId: TENANT_A, slug: slugA1 });
    await seedInviteLink(pool, { contractorId: TENANT_A, slug: slugA2 });
    const email = `dup-${Date.now()}@test.com`;

    const first = await httpPost(
      port, '/api/signup',
      validSignupBody({ email, inviteSlug: slugA1, phone: '555-000-0003' }),
      { 'X-Forwarded-For': '10.0.3.1' }
    );
    assert.equal(first.status, 201, `first signup failed: ${JSON.stringify(first.body)}`);

    const second = await httpPost(
      port, '/api/signup',
      validSignupBody({ email, inviteSlug: slugA2, phone: '555-000-0004' }),
      { 'X-Forwarded-For': '10.0.3.1' }
    );

    assert.equal(second.status, 409, `expected 409, got ${second.status}: ${JSON.stringify(second.body)}`);
    assert.equal(second.body.error, 'An account with this email already exists.');

    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    assert.equal(rows.length, 1);
  });
});
