'use strict';

// Phase 3 (RED) of the tenant-resolution rebuild — the Q5 tripwire.
// TENANT_RESOLUTION_REBUILD_SPEC.md Section 2 Step 3 calls out that adding
// users.contractor_id NOT NULL breaks POST /api/admin/users (admin/referrers.js:69)
// and its founding-referrer COUNT(*) (admin/referrers.js:79) the instant it ships,
// unless both are fixed in the SAME deploy as the migration. This suite pins the
// END-STATE behavior (per-contractor scoping) so that fix can't be forgotten.
//
// Written FIRST, before the migration or the referrers.js fix exist — expected RED
// against today's schema (users has no contractor_id column at all, see Phase 0).

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor, seedUser } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';

function httpPost(port, path, bodyObj, token) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj || {}));
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': bodyBuf.length,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method: 'POST', headers },
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

// Seeds an Owner-tier team_member under contractorId plus an admin session for it.
// Owner tier short-circuits requirePermission() (permissions.js step 2a) — no JSONB
// flags needed. Same seeding shape as ownerParity.test.js / requirePermission.test.js.
async function seedOwnerAdminSession(pool, contractorId, emailTag) {
  const hash = await bcrypt.hash('TestAdmin123!', 4);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
     VALUES ($1, $2, $3, 'owner', '{}') RETURNING id`,
    [contractorId, `owner-${emailTag}@admin-creates-referrer-test.com`, hash]
  );
  const teamMemberId = rows[0].id;
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
     VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
    [token, contractorId, teamMemberId]
  );
  return token;
}

describe('admin-created referrer — per-contractor scoping (Q5, tenant-resolution rebuild)', () => {
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
    // FK-safe wipe order: sessions/user_badges/users depend on team_members/contractors;
    // team_members.title_id depends on titles; titles.contractor_id depends on contractors.
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractors');

    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);
  });

  it("admin-created referrer lands under the admin's own contractor", async () => {
    const token = await seedOwnerAdminSession(pool, TENANT_A, 'a1');
    const email = `referrer-a-${Date.now()}@test.com`;

    const res = await httpPost(port, '/api/admin/users', {
      full_name: 'Tenant A Referrer', email, pin: '1234', phone: '5551234567',
    }, token);

    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

    const { rows } = await pool.query('SELECT contractor_id FROM users WHERE email = $1', [email]);
    assert.equal(rows[0].contractor_id, TENANT_A);
  });

  it('two admins, two tenants: each creates under their own contractor, same email allowed across tenants', async () => {
    const tokenA = await seedOwnerAdminSession(pool, TENANT_A, 'a2');
    const tokenB = await seedOwnerAdminSession(pool, TENANT_B, 'b2');
    const sharedEmail = `shared-${Date.now()}@test.com`;

    const resA = await httpPost(port, '/api/admin/users', {
      full_name: 'Tenant A Shared-Email Referrer', email: sharedEmail, pin: '1234', phone: null,
    }, tokenA);
    const resB = await httpPost(port, '/api/admin/users', {
      full_name: 'Tenant B Shared-Email Referrer', email: sharedEmail, pin: '5678', phone: null,
    }, tokenB);

    assert.equal(resA.status, 200, `tenant A create failed: ${JSON.stringify(resA.body)}`);
    // Today (pre-migration) users.email carries a GLOBAL UNIQUE constraint, so this second
    // insert legitimately 400s ("Email already exists") — that IS today's bug, and Phase 4's
    // UNIQUE(contractor_id, email) is exactly what fixes it. Left un-special-cased on purpose:
    // this assertion should go red on the actual current behavior, not on a schema error.
    assert.equal(resB.status, 200, `tenant B create failed: ${JSON.stringify(resB.body)}`);

    const { rows } = await pool.query(
      'SELECT contractor_id FROM users WHERE email = $1 ORDER BY contractor_id',
      [sharedEmail]
    );
    assert.equal(rows.length, 2, 'expected one row per contractor for the shared email');
    assert.deepEqual(rows.map(r => r.contractor_id).sort(), [TENANT_A, TENANT_B]);
  });

  it('founding-referrer count is per-contractor', async () => {
    // Populate tenant-b past the 20-user founding window; tenant-a stays empty.
    // admin/referrers.js:79's COUNT(*) FROM users is GLOBAL today — this is the exact
    // MVP shortcut CLAUDE.md flags ("scope this count per contractorId at scale").
    for (let i = 0; i < 25; i++) {
      await seedUser(pool, {
        fullName: `Tenant B Filler ${i}`,
        email: `filler-${i}-${Date.now()}@test.com`,
        contractorId: TENANT_B,
      });
    }

    const token = await seedOwnerAdminSession(pool, TENANT_A, 'a3');
    const email = `founding-${Date.now()}@test.com`;

    const res = await httpPost(port, '/api/admin/users', {
      full_name: 'Tenant A Founding Referrer', email, pin: '1234', phone: null,
    }, token);

    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    const newUserId = res.body.id;

    const { rows } = await pool.query(
      `SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = 'founding_referrer'`,
      [newUserId]
    );
    assert.equal(
      rows.length,
      1,
      "tenant-a's founding-referrer count must be scoped to tenant-a — tenant-b's 25 filler users must not count against it"
    );
  });
});
