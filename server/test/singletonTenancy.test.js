'use strict';

// ST SESSION — RED-FIRST TESTS (Singleton Tables + cashout_requests Tenancy)
// Governing spec: SINGLETON_CASHOUT_TENANCY_SPEC.md, as amended by ST-1 (Option A —
// contractor_id becomes sole PK for announcement_settings) and ST-1A (admin_cache gets
// a COMPOSITE key: PRIMARY KEY (contractor_id, cache_key), cache_key normalized to
// 'dashboard_stats' / 'google_rating').
//
// Written FIRST, before any production code changes. Every test here is expected to go
// RED today — either because admin_cache/announcement_settings/cashout_requests have no
// contractor_id column yet (a real "column does not exist" failure), or because the
// current single-global-row / unscoped-query behavior genuinely leaks across tenants
// (a real assertion-mismatch failure). Both are honest REDs. No production code is
// touched in this file.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { createApp } = require('../app');
const {
  seedContractor,
  seedUser,
  seedSession,
  startTestServer,
  stopTestServer,
} = require('./helpers');

const TENANT_A = 'st-tenant-a';
const TENANT_B = 'st-tenant-b';

function httpReq(port, method, path, body, extraHeaders = {}) {
  const bodyBuf = body != null ? Buffer.from(JSON.stringify(body)) : null;
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      {
        hostname: 'localhost', port, path, method,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {}),
          ...extraHeaders,
        },
      },
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
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

describe('ST — singleton tables + cashout_requests tenancy', () => {
  let pool, server, port;
  let ipCounter = 0;
  function nextIp() {
    ipCounter += 1;
    return `10.${Math.floor(ipCounter / 60000) % 250}.${Math.floor(ipCounter / 250) % 250}.${ipCounter % 250}`;
  }

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM payout_announcements');
    await pool.query('DELETE FROM cashout_requests');
    await pool.query('DELETE FROM referral_conversions');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM announcement_settings');
    await pool.query('DELETE FROM admin_cache');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query("DELETE FROM team_members WHERE email LIKE '%st-tenancy-test.com'");
    await pool.query('DELETE FROM users');
    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);
  });

  async function setupReferrer(contractorId, { email, fullName = 'Test Referrer' }) {
    const userId = await seedUser(pool, { fullName, email, contractorId });
    const token = crypto.randomBytes(32).toString('hex');
    await seedSession(pool, { userId, token, role: 'referrer', contractorId });
    return { userId, token };
  }

  async function setupAdmin(contractorId, emailSuffix) {
    const email = `admin-${emailSuffix}-${Date.now()}@st-tenancy-test.com`;
    const { rows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier)
       VALUES ($1, $2, 'placeholder', 'owner') RETURNING id`,
      [contractorId, email]
    );
    const teamMemberId = rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
      [token, contractorId, teamMemberId]
    );
    return { token, teamMemberId };
  }

  async function seedConversion(userId, contractorId, bonusAmount) {
    await pool.query(
      `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, bonus_amount)
       VALUES ($1, $2, $3, $4)`,
      [userId, contractorId, `jc-st-${Math.random().toString(36).slice(2)}`, bonusAmount]
    );
  }

  // ── GROUPS 1-3: admin_cache tenancy + key dimension + missing-row semantics ───
  describe('admin_cache tenancy (ST-1A composite key)', () => {
    it("writes for contractor A and B under the same cache_key coexist; A's read never returns B's blob (RED: admin_cache.contractor_id column does not exist yet)", async () => {
      await pool.query(
        `INSERT INTO admin_cache (contractor_id, cache_key, stats, cached_at) VALUES ($1, 'dashboard_stats', $2, NOW())
         ON CONFLICT (contractor_id, cache_key) DO UPDATE SET stats = $2, cached_at = NOW()`,
        [TENANT_A, JSON.stringify({ totalReferrers: 1 })]
      );
      await pool.query(
        `INSERT INTO admin_cache (contractor_id, cache_key, stats, cached_at) VALUES ($1, 'dashboard_stats', $2, NOW())
         ON CONFLICT (contractor_id, cache_key) DO UPDATE SET stats = $2, cached_at = NOW()`,
        [TENANT_B, JSON.stringify({ totalReferrers: 99 })]
      );
      const { rows } = await pool.query(
        `SELECT stats FROM admin_cache WHERE contractor_id = $1 AND cache_key = 'dashboard_stats'`,
        [TENANT_A]
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].stats.totalReferrers, 1, "A's read must never return B's cached blob");
    });

    it("one contractor can hold both a 'dashboard_stats' row and a 'google_rating' row without collision (RED: admin_cache.contractor_id column does not exist yet)", async () => {
      await pool.query(
        `INSERT INTO admin_cache (contractor_id, cache_key, stats, cached_at) VALUES ($1, 'dashboard_stats', $2, NOW())`,
        [TENANT_A, JSON.stringify({ totalReferrers: 5 })]
      );
      await pool.query(
        `INSERT INTO admin_cache (contractor_id, cache_key, data, cached_at) VALUES ($1, 'google_rating', $2, NOW())`,
        [TENANT_A, JSON.stringify({ rating: 4.8 })]
      );
      const { rows } = await pool.query(
        `SELECT cache_key FROM admin_cache WHERE contractor_id = $1 ORDER BY cache_key`,
        [TENANT_A]
      );
      assert.deepEqual(rows.map(r => r.cache_key), ['dashboard_stats', 'google_rating']);
    });

    it('a cache miss on GET /api/admin/stats triggers the recompute path and upserts a per-contractor dashboard_stats row (RED: admin_cache.contractor_id column does not exist yet)', async () => {
      await pool.query(
        `INSERT INTO contractor_crm_settings (contractor_id, is_connected) VALUES ($1, true)
         ON CONFLICT (contractor_id) DO UPDATE SET is_connected = true`,
        [TENANT_A]
      );
      const { token } = await setupAdmin(TENANT_A, 'stats-miss');
      // Zero users under TENANT_A — the per-referrer Jobber fetch loop is empty, so this
      // exercises the recompute-and-cache path without needing a CRM adapter mock.
      const resp = await httpReq(port, 'GET', '/api/admin/stats', null, { authorization: `Bearer ${token}` });
      assert.equal(resp.status, 200, `expected 200, got ${resp.status}: ${JSON.stringify(resp.body)}`);
      const { rows } = await pool.query(
        `SELECT contractor_id, cache_key FROM admin_cache WHERE contractor_id = $1 AND cache_key = 'dashboard_stats'`,
        [TENANT_A]
      );
      assert.equal(rows.length, 1, 'the recompute path must upsert a per-contractor dashboard_stats row');
    });
  });

  // ── GROUP 4: announcement_settings ────────────────────────────────────────────
  describe('announcement_settings tenancy (Option A — contractor_id sole PK)', () => {
    it("A's admin update does not change B's referrer-side read", async () => {
      const { token: adminAToken } = await setupAdmin(TENANT_A, 'announce-a');
      const postResp = await httpReq(port, 'POST', '/api/admin/announcement-settings',
        { enabled: false, mode: 'custom', customMessage: 'Tenant A only message' },
        { authorization: `Bearer ${adminAToken}` }
      );
      assert.equal(postResp.status, 200, `expected 200, got ${postResp.status}: ${JSON.stringify(postResp.body)}`);

      const bEmail = `announce-b-${Date.now()}@st-tenancy-test.com`;
      const hash = await bcrypt.hash('4444', 4);
      const { rows: bUserRows } = await pool.query(
        `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
         VALUES ('Tenant B Ref', $1, $2, TRUE, $3) RETURNING id`,
        [bEmail, hash, TENANT_B]
      );
      void bUserRows;

      const loginResp = await httpReq(port, 'POST', '/api/login',
        { email: bEmail, pin: '4444', contractorSlug: TENANT_B },
        { 'x-forwarded-for': nextIp() }
      );
      assert.equal(loginResp.status, 200, `expected 200, got ${loginResp.status}: ${JSON.stringify(loginResp.body)}`);
      assert.notEqual(
        loginResp.body.announcementSettings?.custom_message, 'Tenant A only message',
        "tenant B's referrer login must never see tenant A's announcement settings"
      );
    });

    it('a brand-new contractor with no announcement_settings row of its own gets a default/disabled config, not a crash', async () => {
      // Guard-rail test: may already pass today (the JS fallback fires whenever the
      // shared global row happens to be absent) — reported honestly either way in the
      // RED run rather than forced.
      const { token } = await setupAdmin(TENANT_B, 'announce-default');
      const resp = await httpReq(port, 'GET', '/api/admin/announcement-settings', null, { authorization: `Bearer ${token}` });
      assert.equal(resp.status, 200);
      assert.equal(typeof resp.body.enabled, 'boolean', 'missing row must still return a well-formed default config');
    });
  });

  // ── GROUP 5: cashout INSERT stamps session contractor_id (both creation sites) ─
  describe('cashout_requests INSERT stamps the session contractor_id', () => {
    it('referrer submit (POST /api/cashout) stamps contractor_id from the session, ignoring any contractor_id in the request body (RED: cashout_requests.contractor_id column does not exist yet)', async () => {
      const { userId, token } = await setupReferrer(TENANT_A, { email: `cashout-stamp-${Date.now()}@st-tenancy-test.com` });
      await seedConversion(userId, TENANT_A, 100);

      const resp = await httpReq(port, 'POST', '/api/cashout',
        { amount: 25, payout_method: 'venmo', contractor_id: TENANT_B },
        { authorization: `Bearer ${token}`, 'x-forwarded-for': nextIp() }
      );
      assert.equal(resp.status, 200, `expected 200, got ${resp.status}: ${JSON.stringify(resp.body)}`);

      const { rows } = await pool.query(
        `SELECT contractor_id FROM cashout_requests WHERE user_id = $1`,
        [userId]
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].contractor_id, TENANT_A, 'contractor_id must be server-derived from the session, never from the request body');
    });

    it('account-deletion final-payout INSERT (DELETE /api/account/me) stamps contractor_id from the session (RED: cashout_requests.contractor_id column does not exist yet)', async () => {
      const { userId, token } = await setupReferrer(TENANT_A, { email: `acct-delete-${Date.now()}@st-tenancy-test.com` });
      await seedConversion(userId, TENANT_A, 60);

      const resp = await httpReq(port, 'DELETE', '/api/account/me',
        { confirmation: 'DELETE' },
        { authorization: `Bearer ${token}` }
      );
      assert.equal(resp.status, 200, `expected 200, got ${resp.status}: ${JSON.stringify(resp.body)}`);

      const { rows } = await pool.query(
        `SELECT contractor_id, method FROM cashout_requests WHERE user_id = $1 AND method = 'account_deletion'`,
        [userId]
      );
      assert.equal(rows.length, 1, 'final-payout row must be created with the balance stamped to the session contractor');
      assert.equal(rows[0].contractor_id, TENANT_A);
    });
  });

  // ── GROUP 6: admin queue scoping ───────────────────────────────────────────────
  describe('admin cashout queue scoping', () => {
    it("admin queue list for A returns only A's cashouts", async () => {
      const { userId: userA, token: tokenA } = await setupReferrer(TENANT_A, { email: `queue-a-${Date.now()}@st-tenancy-test.com` });
      const { userId: userB, token: tokenB } = await setupReferrer(TENANT_B, { email: `queue-b-${Date.now()}@st-tenancy-test.com` });
      await seedConversion(userA, TENANT_A, 100);
      await seedConversion(userB, TENANT_B, 100);

      const submitA = await httpReq(port, 'POST', '/api/cashout', { amount: 25, payout_method: 'venmo' },
        { authorization: `Bearer ${tokenA}`, 'x-forwarded-for': nextIp() });
      const submitB = await httpReq(port, 'POST', '/api/cashout', { amount: 30, payout_method: 'venmo' },
        { authorization: `Bearer ${tokenB}`, 'x-forwarded-for': nextIp() });
      assert.equal(submitA.status, 200);
      assert.equal(submitB.status, 200);

      const { rows: bRows } = await pool.query(`SELECT id FROM cashout_requests WHERE user_id = $1`, [userB]);
      const bCashoutId = bRows[0].id;

      const { token: adminAToken } = await setupAdmin(TENANT_A, 'queue-a');
      const listResp = await httpReq(port, 'GET', '/api/admin/cashouts', null, { authorization: `Bearer ${adminAToken}` });
      assert.equal(listResp.status, 200);
      const idsSeenByA = listResp.body.map(r => r.id);
      assert.ok(!idsSeenByA.includes(bCashoutId), "admin A's cashout queue must never include tenant B's cashout requests");
    });
  });

  // ── GROUP 7: MONEY-PATH KILL-SHOT ─────────────────────────────────────────────
  describe('money-path kill-shot: cross-tenant approve must fail closed', () => {
    it("Admin A approving a cashout id belonging to B updates zero rows, returns 404-family, and creates no payout_announcements side effect", async () => {
      const { userId: userB, token: tokenB } = await setupReferrer(TENANT_B, { email: `killshot-b-${Date.now()}@st-tenancy-test.com` });
      await seedConversion(userB, TENANT_B, 100);
      const submitB = await httpReq(port, 'POST', '/api/cashout', { amount: 40, payout_method: 'venmo' },
        { authorization: `Bearer ${tokenB}`, 'x-forwarded-for': nextIp() });
      assert.equal(submitB.status, 200);

      const { rows: bRows } = await pool.query(`SELECT id, status FROM cashout_requests WHERE user_id = $1`, [userB]);
      const bCashoutId = bRows[0].id;

      const { token: adminAToken } = await setupAdmin(TENANT_A, 'killshot-a');
      const approveResp = await httpReq(port, 'PATCH', `/api/admin/cashouts/${bCashoutId}`,
        { status: 'approved' },
        { authorization: `Bearer ${adminAToken}` }
      );

      assert.ok(
        approveResp.status === 404,
        `admin A must not be able to touch tenant B's cashout — expected 404, got ${approveResp.status}: ${JSON.stringify(approveResp.body)}`
      );

      const { rows: afterRows } = await pool.query(`SELECT status FROM cashout_requests WHERE id = $1`, [bCashoutId]);
      assert.equal(afterRows[0].status, 'pending', "tenant B's cashout status must be unchanged after A's blocked attempt");

      const { rows: paRows } = await pool.query(`SELECT id FROM payout_announcements WHERE cashout_request_id = $1`, [bCashoutId]);
      assert.equal(paRows.length, 0, 'a blocked cross-tenant approve must create no payout_announcements side effect');
    });
  });

  // ── GROUP 8: MIGRATION GUARDS ──────────────────────────────────────────────────
  describe('migration guards: derived backfill + orphan fail-close', () => {
    // These two tests exercise the cashout_requests migration fragment (db.js §2.3)
    // directly via raw SQL rather than calling the full initDB() — re-invoking initDB()
    // once TENANT_A/TENANT_B already exist always trips the unrelated, pre-existing
    // users.contractor_id fail-closed guard (initDB() is only safely re-runnable while
    // exactly one contractors row exists — a structural limit that predates this
    // session). Running the migration's own SQL in isolation is the narrower, honest
    // way to pin this specific guard's behavior.
    it('derived backfill correctly stamps contractor_id from the owning user for a seeded two-user fixture (RED: cashout_requests.contractor_id column does not exist yet)', async () => {
      const { userId: userA } = await setupReferrer(TENANT_A, { email: `backfill-a-${Date.now()}@st-tenancy-test.com` });
      const { userId: userB } = await setupReferrer(TENANT_B, { email: `backfill-b-${Date.now()}@st-tenancy-test.com` });

      await pool.query(`ALTER TABLE cashout_requests ALTER COLUMN contractor_id DROP NOT NULL`);
      const { rows: rowsA } = await pool.query(
        `INSERT INTO cashout_requests (user_id, full_name, email, amount, status, contractor_id)
         VALUES ($1,'A','a@st-tenancy-test.com',25,'pending',NULL) RETURNING id`,
        [userA]
      );
      const { rows: rowsB } = await pool.query(
        `INSERT INTO cashout_requests (user_id, full_name, email, amount, status, contractor_id)
         VALUES ($1,'B','b@st-tenancy-test.com',30,'pending',NULL) RETURNING id`,
        [userB]
      );

      await pool.query(`
        UPDATE cashout_requests cr SET contractor_id = u.contractor_id
        FROM users u WHERE cr.user_id = u.id AND cr.contractor_id IS NULL
      `);

      const { rows } = await pool.query(
        `SELECT cr.id, cr.contractor_id, u.contractor_id AS owner_contractor_id
         FROM cashout_requests cr JOIN users u ON u.id = cr.user_id
         WHERE cr.id IN ($1,$2)`,
        [rowsA[0].id, rowsB[0].id]
      );
      assert.equal(rows.length, 2);
      for (const row of rows) {
        assert.equal(row.contractor_id, row.owner_contractor_id, 'derived backfill must stamp contractor_id from the owning user, not guess a single-tenant default');
      }
    });

    it('an orphan cashout row (user_id NULL) is caught by the fail-closed orphan guard, never silently guessing a value (RED: cashout_requests.contractor_id column does not exist yet)', async () => {
      await pool.query(`ALTER TABLE cashout_requests ALTER COLUMN contractor_id DROP NOT NULL`);
      await pool.query(
        `INSERT INTO cashout_requests (user_id, full_name, email, amount, status, contractor_id)
         VALUES (NULL,'Orphan','orphan@st-tenancy-test.com',40,'pending',NULL)`
      );
      await pool.query(`
        UPDATE cashout_requests cr SET contractor_id = u.contractor_id
        FROM users u WHERE cr.user_id = u.id AND cr.contractor_id IS NULL
      `);

      await assert.rejects(
        () => pool.query(`
          DO $$
          DECLARE
            orphan_count INTEGER;
          BEGIN
            SELECT COUNT(*) INTO orphan_count FROM cashout_requests WHERE contractor_id IS NULL;
            IF orphan_count > 0 THEN
              RAISE EXCEPTION 'cashout_requests.contractor_id backfill aborted: % row(s) have no resolvable owning user (contractor_id still NULL after derived backfill). Investigate before re-running — do not guess a value.', orphan_count;
            END IF;
          END $$;
        `),
        /contractor_id/i,
        'an unresolvable (user_id NULL) cashout row must fail-close the orphan guard, not silently proceed to NOT NULL'
      );
    });
  });
});
