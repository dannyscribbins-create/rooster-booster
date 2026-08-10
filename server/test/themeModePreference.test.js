'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 1 STEP 4 RED SUITE — GET /api/preferences/theme-mode
//
// WHY THIS ENDPOINT EXISTS AT ALL. Spec D8 requires the theme provider to read a
// stored light/dark preference when a session exists, and names it as
// user_preferences' FIRST PRODUCTION CALLER — the table and
// server/utils/userPreferences.js shipped in C/DL-3a with zero.
//
// There was no way to satisfy that without an HTTP surface: getPreference() is a
// server-side function and the provider runs in a browser. Verified in Phase 1
// Step 1 — every reference to userPreferences.js in the repo was a test, a spec
// or a comment.
//
// SCOPE, DELIBERATELY NARROW. READ ONLY. There is no writer, because the TOGGLE
// IS 3c (D8, explicit). An endpoint that could write a preference nothing can set
// would be dead surface with a tenancy predicate on it.
//
// REFERRER SESSION ONLY, and that is a scoping decision rather than an omission.
// The provider wraps the login screen and the referrer/rep tree; AdminPanel and
// the super-admin shell render OUTSIDE it (Ruling 5) and never read a --rm-*
// value, so an admin-session path would have no consumer. The team_member half —
// subjectType 'team_member', which userPreferences.js already routes — lands in
// 3c with the rep app.
//
// NO PRODUCTION CONTRACTOR ID LITERALS anywhere in this file (house rule).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor, seedUser, seedSession } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';

const THEME_MODE_KEY = 'theme_mode';

function httpGet(port, path, { token = null } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Promise((resolve, reject) => {
    const req = _httpRequest({ hostname: 'localhost', port, path, method: 'GET', headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let body = null;
        try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
        resolve({ status: res.statusCode, body, raw });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('C/DL-3b Phase 1 Step 4 — GET /api/preferences/theme-mode', () => {
  let pool, server, port;
  let userA, userB, tokenA, tokenB;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM user_preferences');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');

    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);

    userA = await seedUser(pool, { fullName: 'Ann Alpha', email: 'ann@alpha.invalid', contractorId: TENANT_A });
    userB = await seedUser(pool, { fullName: 'Ben Beta', email: 'ben@beta.invalid', contractorId: TENANT_B });

    tokenA = crypto.randomBytes(32).toString('hex');
    tokenB = crypto.randomBytes(32).toString('hex');
    await seedSession(pool, { userId: userA, token: tokenA, role: 'referrer', contractorId: TENANT_A });
    await seedSession(pool, { userId: userB, token: tokenB, role: 'referrer', contractorId: TENANT_B });
  });

  async function storeMode(userId, contractorId, value) {
    await pool.query(
      `INSERT INTO user_preferences (user_id, contractor_id, pref_key, pref_value)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [userId, contractorId, THEME_MODE_KEY, JSON.stringify(value)]
    );
  }

  it('[RED] returns null when the user has stored no preference', async () => {
    const res = await httpGet(port, '/api/preferences/theme-mode', { token: tokenA });

    assert.equal(res.status, 200);
    assert.equal(res.body.mode, null,
      'no stored preference must read as null so the provider applies its light default');
  });

  it('[RED] returns the stored mode', async () => {
    await storeMode(userA, TENANT_A, 'dark');
    const res = await httpGet(port, '/api/preferences/theme-mode', { token: tokenA });

    assert.equal(res.status, 200);
    assert.equal(res.body.mode, 'dark');
  });

  it('[RED] round-trips light as a real stored value, distinct from "unset"', async () => {
    // These must not collapse: a user who has deliberately chosen light is not the
    // same as a user who has chosen nothing. They agree today because light is the
    // default, and they stop agreeing the moment 3c adds a system-preference mode.
    await storeMode(userA, TENANT_A, 'light');
    const res = await httpGet(port, '/api/preferences/theme-mode', { token: tokenA });

    assert.equal(res.body.mode, 'light');
  });

  it('[RED] a junk stored value reads as null rather than reaching the client', async () => {
    // user_preferences.pref_value is JSONB with no CHECK — it will hold anything.
    // deriveThemeTokens THROWS on an unknown mode, so an unvalidated passthrough
    // would turn one bad row into a blank app for that user.
    for (const junk of ['sideways', '', 42, null, { mode: 'dark' }, ['dark']]) {
      await pool.query('DELETE FROM user_preferences');
      await storeMode(userA, TENANT_A, junk);

      const res = await httpGet(port, '/api/preferences/theme-mode', { token: tokenA });
      assert.equal(res.status, 200, `junk value ${JSON.stringify(junk)} must not 500`);
      assert.equal(res.body.mode, null,
        `junk value ${JSON.stringify(junk)} must be rejected server-side, not forwarded`);
    }
  });

  it('[RED] requires a session — no token is 401', async () => {
    const res = await httpGet(port, '/api/preferences/theme-mode');
    assert.equal(res.status, 401);
  });

  it('[RED] rejects a bogus token', async () => {
    const res = await httpGet(port, '/api/preferences/theme-mode', {
      token: crypto.randomBytes(32).toString('hex'),
    });
    assert.equal(res.status, 401);
  });

  it('[RED] rejects an ADMIN token — this is a referrer-session endpoint', async () => {
    const adminToken = crypto.randomBytes(32).toString('hex');
    await seedSession(pool, { userId: null, token: adminToken, role: 'admin', contractorId: TENANT_A });

    const res = await httpGet(port, '/api/preferences/theme-mode', { token: adminToken });
    assert.equal(res.status, 401,
      'role is part of the session predicate — an admin token must not satisfy a referrer route');
  });

  // ── TENANCY ────────────────────────────────────────────────────────────────

  it('[RED] one user cannot read another tenant\'s stored preference', async () => {
    // Tenant B stores dark; tenant A stores nothing. A's session must read null.
    await storeMode(userB, TENANT_B, 'dark');

    const res = await httpGet(port, '/api/preferences/theme-mode', { token: tokenA });
    assert.equal(res.body.mode, null,
      'the preference read must be scoped to the authenticated session\'s own subject and tenant');
  });

  it('[RED] each session reads its OWN stored preference', async () => {
    await storeMode(userA, TENANT_A, 'light');
    await storeMode(userB, TENANT_B, 'dark');

    const a = await httpGet(port, '/api/preferences/theme-mode', { token: tokenA });
    const b = await httpGet(port, '/api/preferences/theme-mode', { token: tokenB });

    assert.equal(a.body.mode, 'light');
    assert.equal(b.body.mode, 'dark');
  });

  it('[RED] the response carries nothing but the mode', async () => {
    // No user id, no contractor id, no session data. The provider needs one word.
    await storeMode(userA, TENANT_A, 'dark');
    const res = await httpGet(port, '/api/preferences/theme-mode', { token: tokenA });

    assert.deepEqual(Object.keys(res.body), ['mode']);
    assert.ok(!res.raw.includes(TENANT_A), 'the contractor id must not appear in the body');
  });

  // ── READ-ONLY ──────────────────────────────────────────────────────────────

  it('[RED] reading writes nothing — the toggle is 3c', async () => {
    const before = await pool.query('SELECT COUNT(*)::int AS n FROM user_preferences');
    await httpGet(port, '/api/preferences/theme-mode', { token: tokenA });
    await httpGet(port, '/api/preferences/theme-mode', { token: tokenB });
    const after = await pool.query('SELECT COUNT(*)::int AS n FROM user_preferences');

    assert.equal(after.rows[0].n, before.rows[0].n,
      'a preference READ must not create a row — there is no writer in this phase');
  });
});
