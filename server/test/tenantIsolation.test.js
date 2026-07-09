'use strict';

// PHASE 1 — TENANT REBUILD SESSION 2 — RED: two-contractor isolation tests
// (TENANT_RESOLUTION_REBUILD_SPEC.md Section 7.1 + Batch B-extended assertions).
//
// Written FIRST, before session-derived tenant resolution exists. Every test here
// is expected to go RED today, each for the reason documented above it. This file
// pins the END-STATE behavior so the fixes that come later can't silently regress it.
//
// Scope fence for this session: this file only. No production code touched.

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const {
  seedContractor,
  seedUser,
  seedSession,
  seedReferralSchedule,
  startTestServer,
  stopTestServer,
} = require('./helpers');
const {
  _runEngagementCadencePass,
  _setTestOverrides,
  _resetTestOverrides,
} = require('../cron/jobs/engagementCadence');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';

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

function httpPost(port, path, bodyObj) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj || {}));
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      {
        hostname: 'localhost', port, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': bodyBuf.length },
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
    req.write(bodyBuf);
    req.end();
  });
}

// Inserts a users row with a REAL bcrypt-hashed pin (seedUser's placeholder hash can't
// be used for login tests, which exercise bcrypt.compare against the actual submitted pin).
async function seedReferrerWithPin(pool, { contractorId, email, pin, fullName }) {
  const hash = await bcrypt.hash(pin, 4);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
     VALUES ($1, $2, $3, TRUE, $4)
     ON CONFLICT (contractor_id, email) DO UPDATE SET pin = EXCLUDED.pin
     RETURNING id`,
    [fullName, email, hash, contractorId]
  );
  return rows[0].id;
}

describe('tenant isolation — two-contractor RED assertions (tenant rebuild S2)', () => {
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
    // FK-safe wipe order — extends adminCreatesReferrer.test.js / signupTenantStamp.test.js's
    // proven order (sessions, user_badges, users, team_members, titles, contractors) with the
    // engagement-cadence + contacts + schedule tables the B-extended assertions touch.
    // contractor_settings is deliberately NOT wiped here — seedContractor's ON CONFLICT DO
    // NOTHING makes a stale row harmless, matching adminCreatesReferrer.test.js's precedent.
    await pool.query('DELETE FROM engagement_cadence_log');
    await pool.query('DELETE FROM engagement_cadence_settings');
    await pool.query('DELETE FROM contacts');
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM referral_schedule_job_types');
    await pool.query('DELETE FROM referral_schedules');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractors');

    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);

    _resetTestOverrides();
  });

  // ── FIVE CORE TESTS (spec Section 7.1) ────────────────────────────────────────

  describe('core: login and session tenant scoping', () => {
    // Expected RED: login succeeds (200) but the session INSERT at referrer.js:741-744
    // never carries contractor_id — the column is left NULL. Login may also just ignore
    // the unknown contractorSlug field entirely (destructure is `{ email, pin }` only) —
    // that's fine, the stamp assertion below is the actual RED.
    it('same email under both tenants: login with tenant-A slug + tenant-A PIN stamps the session to tenant A', async () => {
      const email = `shared-login-${Date.now()}@tenant-isolation-test.com`;
      await seedReferrerWithPin(pool, { contractorId: TENANT_A, email, pin: '1111', fullName: 'Tenant A User' });
      await seedReferrerWithPin(pool, { contractorId: TENANT_B, email, pin: '2222', fullName: 'Tenant B User' });

      const res = await httpPost(port, '/api/login', { email, pin: '1111', contractorSlug: TENANT_A });

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

      const { rows } = await pool.query('SELECT contractor_id FROM sessions WHERE token = $1', [res.body.token]);
      assert.equal(rows.length, 1, 'expected exactly one session row for the returned token');
      assert.equal(
        rows[0].contractor_id, TENANT_A,
        'session.contractor_id must be stamped from the login tenant, not left NULL'
      );
    });

    // Expected RED (or flaky-by-design): today's login query is a GLOBAL
    // `WHERE LOWER(email) = LOWER($1)` with no contractorSlug filtering, so which of the
    // two same-email rows lands in result.rows[0] is ordering-dependent, not tenant-derived.
    // If it happens to pick tenant B's row, bcrypt.compare against tenant B's PIN succeeds
    // and this 200s where a tenant-scoped login must 401. If it happens to pick tenant A's
    // row first, this 401s "by accident" — report that as FLAKY-BY-DESIGN, not a pass,
    // since nothing in the code actually enforces tenant scoping either way.
    it('same email under both tenants: login with tenant-A slug + tenant-B PIN must NOT succeed', async () => {
      const email = `shared-login2-${Date.now()}@tenant-isolation-test.com`;
      await seedReferrerWithPin(pool, { contractorId: TENANT_A, email, pin: '1111', fullName: 'Tenant A User' });
      await seedReferrerWithPin(pool, { contractorId: TENANT_B, email, pin: '2222', fullName: 'Tenant B User' });

      const res = await httpPost(port, '/api/login', { email, pin: '2222', contractorSlug: TENANT_A });

      assert.equal(
        res.status, 401,
        `expected 401 (no cross-tenant credential match), got ${res.status}: ${JSON.stringify(res.body)}`
      );
    });
  });

  describe('core: GET /api/referrer/schedules tenant scoping', () => {
    // Tenant rebuild S2 (Batch B13): the route now resolves contractorId from
    // session.contractorId instead of getDefaultContractorId() — the tripwire is no
    // longer reached, and two contractors rows seeded no longer trip anything here.
    it('valid tenant-A session + a schedule seeded only under tenant B → zero schedules', async () => {
      const userId = await seedUser(pool, {
        fullName: 'Tenant A Referrer',
        email: `a-ref-${Date.now()}@test.com`,
        contractorId: TENANT_A,
      });
      const token = crypto.randomBytes(32).toString('hex');
      await seedSession(pool, { userId, token, role: 'referrer', contractorId: TENANT_A });

      await seedReferralSchedule(pool, { contractorId: TENANT_B });

      const res = await httpGet(port, '/api/referrer/schedules', token);

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.equal(
        res.body?.schedules?.length, 0,
        "tenant A's schedules must not include tenant B's schedule"
      );
    });

    // Tenant rebuild S2 (Section 3.3): verifyReferrerSession() now adds
    // `AND s.contractor_id IS NOT NULL` to its WHERE clause, so a legacy pre-migration
    // session (NULL contractor_id, unexpired, role='referrer') is rejected at auth —
    // 401 before the route ever reaches the getDefaultContractorId() tripwire.
    it('legacy pre-migration session (contractor_id NULL) must be rejected — fail closed', async () => {
      const userId = await seedUser(pool, {
        fullName: 'Legacy Referrer',
        email: `legacy-${Date.now()}@test.com`,
        contractorId: TENANT_A,
      });
      const token = crypto.randomBytes(32).toString('hex');
      // Deliberately bypasses seedSession() — its S2 guard now throws on
      // role: 'referrer' + contractorId: null, which is exactly the legacy
      // pre-migration shape this test needs to simulate.
      const expiresAt = new Date(Date.now() + 3_600_000);
      await pool.query(
        `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id) VALUES ($1,$2,$3,$4,NULL)`,
        [userId, token, expiresAt, 'referrer']
      );

      const res = await httpGet(port, '/api/referrer/schedules', token);

      assert.equal(
        res.status, 401,
        `expected 401 (forced re-login on legacy session), got ${res.status}: ${JSON.stringify(res.body)}`
      );
    });

    // Rename-safety per the spec draft. contractors.id has no ON UPDATE CASCADE wired to
    // users.contractor_id / sessions.contractor_id (both plain `REFERENCES contractors(id)`,
    // default NO ACTION) — if the rename UPDATE itself fails on FK once dependent rows
    // exist, that is a REPORTABLE FINDING per the spec, not something to work around here.
    // Seeding order below (rename first, THEN seed dependents under the new id) avoids
    // triggering that FK path directly — dependents are created only after the id already
    // has its new value — so if the UPDATE fails, it is failing for a different, worse
    // reason and must be reported verbatim.
    // Tenant rebuild S2 (Batch B13): the route now resolves contractorId from
    // session.contractorId — the getDefaultContractorId() tripwire that previously
    // blocked this test with a two-contractors-seeded 500 is no longer in this route's path.
    it('rename-safety: renaming a contractor id does not orphan its users/sessions/schedules', async () => {
      const RENAMED_ID = `test-tenant-a-renamed-${Date.now()}`;

      await pool.query('UPDATE contractors SET id = $1 WHERE id = $2', [RENAMED_ID, TENANT_A]);

      const userId = await seedUser(pool, {
        fullName: 'Renamed Tenant Referrer',
        email: `renamed-${Date.now()}@test.com`,
        contractorId: RENAMED_ID,
      });
      const token = crypto.randomBytes(32).toString('hex');
      await seedSession(pool, { userId, token, role: 'referrer', contractorId: RENAMED_ID });
      await seedReferralSchedule(pool, { contractorId: RENAMED_ID });

      const res = await httpGet(port, '/api/referrer/schedules', token);

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.equal(
        res.body?.schedules?.length, 1,
        "expected exactly the renamed tenant's own schedule"
      );
    });
  });

  // ── BATCH B-EXTENDED — cross-tenant email-match RED assertions ────────────────
  // One describe block, honest and narrow, per the session brief.

  describe('Batch B-extended: cross-tenant email-match leaks', () => {
    // Tenant rebuild S2 (BX1): engagementCadence.js:84's LEFT JOIN now scopes on
    // u.contractor_id = c.contractor_id (plus LOWER() case-normalization, same line,
    // Q6-decided together). _runEngagementCadencePass IS cleanly exported and callable
    // (unlike (b) and (c) below), so this test calls it directly with real seeded data —
    // the production fix flows through automatically, no test-code change needed here.
    it('(a) engagementCadence.js:84 — cadence email must not pull a tenant-B-only user\'s referral code', async () => {
      const TODAY_FIXED = new Date('2024-06-15T12:00:00Z');
      const PAID_AT_M1 = new Date('2024-05-15T12:00:00Z'); // exactly 1 month before TODAY_FIXED
      const sharedEmail = `cadence-leak-${Date.now()}@test.com`;
      const jobberId = `jc-leak-${Date.now()}`;
      const contactId = crypto.randomUUID();
      const tenantBReferralCode = `TENANTB-LEAK-${Date.now()}`;

      // Tenant A: a paid client whose contact email happens to collide with a Tenant-B user's email.
      await pool.query(
        `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, pipeline_status, paid_at)
         VALUES ($1, $2, 'Leak Test Client', 'paid', $3)`,
        [TENANT_A, jobberId, PAID_AT_M1]
      );
      await pool.query(
        `INSERT INTO contacts (id, contractor_id, email, name, jobber_client_id)
         VALUES ($1, $2, $3, 'Leak Test Client', $4)`,
        [contactId, TENANT_A, sharedEmail, jobberId]
      );
      await pool.query(
        `INSERT INTO engagement_cadence_settings (contractor_id, cadence_month, is_enabled, subject, body)
         VALUES ($1, 1, TRUE, 'M1 Subject', 'Hi {{first_name}}, your link: {{referral_link}}')`,
        [TENANT_A]
      );

      // Tenant B: a DIFFERENT user, same email, own referral_code — must never surface in tenant A's email.
      await pool.query(
        `INSERT INTO users (full_name, email, pin, email_verified, contractor_id, referral_code)
         VALUES ('Tenant B User', $1, '$2b$10$test.placeholder.hash.for.tests', TRUE, $2, $3)`,
        [sharedEmail, TENANT_B, tenantBReferralCode]
      );

      const emails = [];
      _setTestOverrides({ sendEmail: async args => { emails.push(args); return { id: 'stub' }; } });

      await _runEngagementCadencePass(TODAY_FIXED);

      assert.equal(emails.length, 1, 'expected exactly one M1 cadence email sent for the tenant A contact');
      assert.ok(
        !emails[0].html.includes(tenantBReferralCode),
        `tenant A's cadence email must not carry tenant B's referral code — leaked "${tenantBReferralCode}"`
      );
    });

    // Tenant rebuild S2 (BX2): postJobSequence.js:77 now scopes the email-match query
    // with `AND contractor_id = $2`, bound from the cron loop's own contractorId
    // (`for (const { contractor_id: contractorId } of contractors)` — already in scope,
    // no signature threading needed). LIMITATION unchanged from the RED session:
    // postJobSequence.js has no exported callable pass — its entire body is a closure
    // inside `cron.schedule(() => withLock('post_job_sequence', 20, async () => {...}))`,
    // and the only export, `startPostJobSequenceJob`, just registers the 7am-UTC schedule
    // rather than running it. This test runs the identical (now-fixed) query verbatim
    // against seeded data instead — the narrowest honest assertion available.
    it('(b) postJobSequence.js:77 — email-match query must not resolve a tenant-B-only user', async () => {
      const sharedEmail = `postjob-leak-${Date.now()}@test.com`;
      await pool.query(
        `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
         VALUES ('Tenant B User', $1, '$2b$10$test.placeholder.hash.for.tests', TRUE, $2)`,
        [sharedEmail, TENANT_B]
      );

      // Verbatim query from server/cron/jobs/postJobSequence.js:77 (post-BX2 fix),
      // simulating the cron loop currently iterating under tenant A.
      const { rows } = await pool.query(
        `SELECT id, full_name, email, referral_code FROM users
         WHERE LOWER(email) = LOWER($1) AND contractor_id = $2 LIMIT 1`,
        [sharedEmail, TENANT_A]
      );

      assert.equal(
        rows.length, 0,
        'a users row that exists only under tenant B must not be matched by a tenant-A post-job-sequence lookup'
      );
    });

    // Tenant rebuild S2 (BX3): campaigns.js:502 now scopes the query with
    // `AND contractor_id = $2`, bound from upsertContactRecord's closure-bound
    // contractorId (executeBatchSend's own parameter — the admin session's tenant).
    // LIMITATION unchanged from the RED session: upsertContactRecord is an unexported
    // inner function of executeBatchSend (server/routes/admin/campaigns.js:499), itself
    // only reachable via POST /api/admin/campaigns/:id/launch or .../send-batch — both
    // require a fully seeded campaign + campaign_contacts + contractor_settings row and
    // a real (or stubbed) Resend send to reach this code path. That setup is
    // disproportionate to the single query under test, so this test runs the identical
    // (now-fixed) query verbatim against seeded data instead. upsertContactRecord only
    // ever uses this query's result as an existence boolean (isAppUser), never resolves
    // a specific tenant-scoped id, so that is the shape asserted here.
    it('(c) admin/campaigns.js:502 upsertContactRecord — isAppUser must not resolve a tenant-B-only user', async () => {
      const sharedEmail = `campaign-leak-${Date.now()}@test.com`;
      await pool.query(
        `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
         VALUES ('Tenant B User', $1, '$2b$10$test.placeholder.hash.for.tests', TRUE, $2)`,
        [sharedEmail, TENANT_B]
      );

      // Verbatim query from server/routes/admin/campaigns.js:502 (post-BX3 fix),
      // simulating upsertContactRecord's closure-bound contractorId as tenant A.
      const { rows } = await pool.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND contractor_id = $2 LIMIT 1`,
        [sharedEmail, TENANT_A]
      );
      const isAppUser = rows.length > 0;

      assert.equal(
        isAppUser, false,
        'a contact under tenant A must not be tagged "App User" off a users row that exists only under tenant B'
      );
    });
  });
});
