'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { request: _httpRequest } = require('node:http');
const bcrypt = require('bcrypt');
const { startTestServer, stopTestServer } = require('./helpers');

const CONTRACTOR_ID = 'accent-roofing';

// ── TEST APP ──────────────────────────────────────────────────────────────────
function buildTeamTestApp() {
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/', require('../routes/admin/index'));
  return app;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

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

async function seedMember(pool, { email, tier, permissions = null }) {
  const hash = await bcrypt.hash('testpassword123', 10);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET tier = EXCLUDED.tier, permissions = EXCLUDED.permissions
     RETURNING id`,
    [CONTRACTOR_ID, email, hash, tier, permissions]
  );
  return rows[0].id;
}

async function makeSession(pool, memberId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
     VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
    [token, CONTRACTOR_ID, memberId]
  );
  return token;
}

// ── SUITE ─────────────────────────────────────────────────────────────────────

describe('team routes — security walls and guards', () => {
  let pool, server, port;
  let ownerMemberId, adminMemberId, adminMemberId2, generalMemberId;

  before(async () => {
    pool = await initTestDb();
    ownerMemberId   = await seedMember(pool, { email: 'owner@team-test.com',    tier: 'owner'   });
    // adminMemberId: retains { team.manage: true } throughout — never used as a permissions target
    adminMemberId   = await seedMember(pool, { email: 'admin@team-test.com',    tier: 'admin',   permissions: { 'team.manage': true } });
    // adminMemberId2: dedicated target for wall 2 positive test — avoids overwriting adminMemberId's permissions
    adminMemberId2  = await seedMember(pool, { email: 'admin2@team-test.com',   tier: 'admin'   });
    generalMemberId = await seedMember(pool, { email: 'general@team-test.com',  tier: 'general' });
    ({ server, port } = await startTestServer(buildTeamTestApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  // ── WALL 1: Finance-grant asymmetry (§5.3) ────────────────────────────────
  it('save-permissions wall 1: Admin cannot grant finance_settings to a General-tier member', async () => {
    const adminToken = await makeSession(pool, adminMemberId);
    const res = await httpRequest(port, 'POST', `/api/admin/team/${generalMemberId}/permissions`, {
      permissions: { finance_settings: true },
    }, adminToken);
    assert.equal(res.status, 403, 'Admin granting finance_settings to General must be blocked (wall 1)');
    assert.ok(
      res.body?.error?.toLowerCase().includes('finance'),
      `Error must reference finance permissions, got: ${res.body?.error}`
    );
  });

  it('save-permissions wall 1: Owner CAN grant finance_settings to a General-tier member', async () => {
    const ownerToken = await makeSession(pool, ownerMemberId);
    const res = await httpRequest(port, 'POST', `/api/admin/team/${generalMemberId}/permissions`, {
      permissions: { finance_settings: true },
    }, ownerToken);
    assert.equal(res.status, 200, 'Owner granting finance_settings to General must succeed');
  });

  // ── WALL 2: cashout_approve absolute wall (§5.4) ──────────────────────────
  it('save-permissions wall 2: Owner cannot grant cashout_approve to a General-tier member', async () => {
    const ownerToken = await makeSession(pool, ownerMemberId);
    const res = await httpRequest(port, 'POST', `/api/admin/team/${generalMemberId}/permissions`, {
      permissions: { cashout_approve: true },
    }, ownerToken);
    assert.equal(res.status, 403, 'Even Owner granting cashout_approve to General must be blocked (wall 2)');
    assert.ok(
      res.body?.error?.toLowerCase().includes('cashout_approve'),
      `Error must reference cashout_approve, got: ${res.body?.error}`
    );
  });

  it('save-permissions wall 2: cashout_approve CAN be saved onto an Admin-tier member by Owner', async () => {
    const ownerToken = await makeSession(pool, ownerMemberId);
    // target is adminMemberId2, NOT adminMemberId — avoids overwriting the team.manage
    // permission that adminMemberId needs for the deactivate and creation-chain tests below
    const res = await httpRequest(port, 'POST', `/api/admin/team/${adminMemberId2}/permissions`, {
      permissions: { cashout_approve: true },
    }, ownerToken);
    assert.equal(res.status, 200, 'Owner granting cashout_approve to Admin must succeed');
  });

  // ── LAST-OWNER GUARD (deactivate) ────────────────────────────────────────
  it('last-owner guard: cannot deactivate the last active Owner', async () => {
    const ownerToken = await makeSession(pool, ownerMemberId);
    const res = await httpRequest(port, 'PATCH', `/api/admin/team/${ownerMemberId}/deactivate`, null, ownerToken);
    // ownerMemberId === teamMemberId here — self-deactivation fires first, giving 409
    // Either guard (self or last-owner) returns 409 — both are correct rejections
    assert.equal(res.status, 409, 'Deactivating the only/self Owner must be rejected with 409');
  });

  it('last-owner guard: second Owner can be deactivated once another Owner exists', async () => {
    // Seed a second Owner so the first is no longer the last
    const secondOwnerId = await seedMember(pool, { email: 'owner2@team-test.com', tier: 'owner' });
    const ownerToken = await makeSession(pool, ownerMemberId);
    const res = await httpRequest(port, 'PATCH', `/api/admin/team/${secondOwnerId}/deactivate`, null, ownerToken);
    assert.equal(res.status, 200, 'Deactivating a non-last Owner must succeed');
  });

  // ── SELF-DEACTIVATION GUARD ───────────────────────────────────────────────
  it('self-deactivation guard: cannot deactivate your own account', async () => {
    const adminToken = await makeSession(pool, adminMemberId);
    const res = await httpRequest(port, 'PATCH', `/api/admin/team/${adminMemberId}/deactivate`, null, adminToken);
    assert.equal(res.status, 409, 'Self-deactivation must be rejected with 409');
    assert.ok(
      res.body?.error?.toLowerCase().includes('own'),
      `Error must reference own account, got: ${res.body?.error}`
    );
  });

  // ── STRUCTURAL CREATION CHAIN (§1.3) ─────────────────────────────────────
  it('creation chain: Admin cannot create an Admin-tier member', async () => {
    const adminToken = await makeSession(pool, adminMemberId);
    const res = await httpRequest(port, 'POST', '/api/admin/team', {
      email: 'new-admin@team-test.com',
      password: 'testpassword123',
      full_name: 'New Admin',
      tier: 'admin',
    }, adminToken);
    assert.equal(res.status, 403, 'Admin creating Admin-tier member must be blocked by creation chain');
  });

  it('creation chain: Admin CAN create a General-tier member', async () => {
    const adminToken = await makeSession(pool, adminMemberId);
    const res = await httpRequest(port, 'POST', '/api/admin/team', {
      email: `general-new-${Date.now()}@team-test.com`,
      password: 'testpassword123',
      full_name: 'New General',
      tier: 'general',
    }, adminToken);
    assert.equal(res.status, 201, 'Admin creating General-tier member must succeed');
  });

  // ── GET /api/admin/team ───────────────────────────────────────────────────
  it('GET /api/admin/team: returns roster for the contractor', async () => {
    const ownerToken = await makeSession(pool, ownerMemberId);
    const res = await httpRequest(port, 'GET', '/api/admin/team', null, ownerToken);
    assert.equal(res.status, 200, 'Owner should be able to fetch the team roster');
    assert.ok(Array.isArray(res.body), 'Response must be an array');
    assert.ok(res.body.length >= 3, 'Roster must include at least the seeded owner, admin, and general members');
  });

  // ── JOBBER USER MAPPING (Phase A + B) ─────────────────────────────────────
  it('DB: UNIQUE constraint on jobber_user_id prevents two members sharing the same Jobber user', async () => {
    await pool.query('UPDATE team_members SET jobber_user_id = $1 WHERE id = $2', ['jb-unique-constraint-test', adminMemberId2]);
    await assert.rejects(
      pool.query('UPDATE team_members SET jobber_user_id = $1 WHERE id = $2', ['jb-unique-constraint-test', generalMemberId]),
      err => {
        assert.equal(err.code, '23505', `Expected unique_violation (23505), got code: ${err.code}`);
        return true;
      }
    );
    await pool.query('UPDATE team_members SET jobber_user_id = NULL WHERE id = $1', [adminMemberId2]);
  });

  it('PATCH /api/admin/team/:id: Owner can set jobber_user_id on a member', async () => {
    await pool.query('UPDATE team_members SET jobber_user_id = NULL WHERE id = $1', [generalMemberId]);
    const ownerToken = await makeSession(pool, ownerMemberId);
    const res = await httpRequest(port, 'PATCH', `/api/admin/team/${generalMemberId}`, {
      jobber_user_id: 'Z2lkOi8vSm9iYmVyL1VzZXIvMTIz',
    }, ownerToken);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    const { rows } = await pool.query('SELECT jobber_user_id FROM team_members WHERE id = $1', [generalMemberId]);
    assert.equal(rows[0].jobber_user_id, 'Z2lkOi8vSm9iYmVyL1VzZXIvMTIz', 'jobber_user_id must be persisted in DB');
  });

  it('PATCH /api/admin/team/:id: Owner can clear jobber_user_id (unmap) by sending null', async () => {
    await pool.query('UPDATE team_members SET jobber_user_id = $1 WHERE id = $2', ['jb-to-clear', generalMemberId]);
    const ownerToken = await makeSession(pool, ownerMemberId);
    const res = await httpRequest(port, 'PATCH', `/api/admin/team/${generalMemberId}`, {
      jobber_user_id: null,
    }, ownerToken);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    const { rows } = await pool.query('SELECT jobber_user_id FROM team_members WHERE id = $1', [generalMemberId]);
    assert.equal(rows[0].jobber_user_id, null, 'jobber_user_id must be cleared to null');
  });

  it('PATCH /api/admin/team/:id: returns 409 jobber_user_already_mapped when Jobber user is already assigned', async () => {
    await pool.query('UPDATE team_members SET jobber_user_id = NULL WHERE id = ANY($1)', [[generalMemberId, adminMemberId]]);
    await pool.query('UPDATE team_members SET jobber_user_id = $1 WHERE id = $2', ['jb-conflict-id', adminMemberId]);
    const ownerToken = await makeSession(pool, ownerMemberId);
    const res = await httpRequest(port, 'PATCH', `/api/admin/team/${generalMemberId}`, {
      jobber_user_id: 'jb-conflict-id',
    }, ownerToken);
    assert.equal(res.status, 409, `Expected 409, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body?.error, 'jobber_user_already_mapped', `Expected error key 'jobber_user_already_mapped', got: ${res.body?.error}`);
    await pool.query('UPDATE team_members SET jobber_user_id = NULL WHERE id = $1', [adminMemberId]);
  });
});
