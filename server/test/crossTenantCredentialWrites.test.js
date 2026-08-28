'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 1.1-c — CROSS-TENANT CREDENTIAL AND MONEY WRITES — RED FIRST
//
// Six defects, all in routes an ordinary `referrers.manage` / `cashout_approve`
// admin session can reach at ANY contractor. No super-admin token, no bypass,
// no NULL contractor_id required.
//
//   D1  PATCH  /api/admin/users/:id/pin           admin/referrers.js  credential write
//   D2  DELETE /api/admin/users/:id               admin/referrers.js  hard delete + CASCADE
//   D3  POST   /api/admin/users/:id/match-jobber  admin/referrers.js  PII read + write
//   D5  GET    /api/admin/users                   admin/referrers.js  PII list, all tenants
//   D6  GET    /api/admin/referrer/:name          admin/referrers.js  name match, no tenancy
//   D4  POST   /api/admin/stripe/transfer         routes/stripe.js    money
//
// ⚠ NONE OF THIS IS VERIFIABLE IN PRODUCTION. Accent is the only contractor, so
// "cross-tenant" names an empty set and every one of these routes behaves
// correctly today by accident of there being nothing to leak to. This file
// MANUFACTURES the second contractor. It is the whole verification — the same
// position Wave 0.3's twelve tenant-scoping fixes were in.
//
// ⚠ EVERY NEGATIVE HAS A POSITIVE CONTROL, AND THE POSITIVE RUNS FIRST.
// A predicate that rejects everything passes all six negatives and is
// indistinguishable from a working one. Each pair below is ordered
// positive-then-negative for that reason, and the positive asserts an OBSERVED
// SUCCESS (a row actually changed / a row actually returned), never a bare 200.
//
// ⚠ FIXTURE IDS ARE DELIBERATELY NOT 'accent-roofing'. That literal is the
// pre-rename GHOST id: it has no `contractors` row, so any fixture using it
// finds zero rows and its test passes for the wrong reason. That is precisely
// the defect D4 is about, and reproducing it in the harness would make the
// harness agree with the bug. Both tenants below exist in the test database.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');

// ⚠ SET BEFORE ANY ROUTE MODULE IS REQUIRED, AND DELIBERATELY NOT FROM .env.
// executeStripeTransfer()'s first statement throws unless STRIPE_SECRET_KEY is
// set, which would abort every D4 test at step 1 and make all three of them
// pass vacuously against a defect they never reached. Pinning a known-dummy
// value here also guarantees that if a real key is ever present in the
// environment, these tests cannot use it.
process.env.STRIPE_SECRET_KEY = 'sk_test_wave11c_dummy_never_dispatched';

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { createApp } = require('../app');
const { encrypt } = require('../utils/encryption');
const { seedContractor, startTestServer, stopTestServer } = require('./helpers');
const { collectAdminRoutes } = require('./helpers/adminRouterIntrospection');

const TENANT_A = 'w11c-tenant-a';
const TENANT_B = 'w11c-tenant-b';

// Tenant A's Stripe connected account. Exists under TENANT_A and nowhere else,
// so reaching it is proof the SELECT resolved by the CALLER'S contractor and
// not by a literal.
const ACCT_A = 'acct_w11c_tenant_a';

// ⚠ EVERY D4 TEST USES A NEGATIVE AMOUNT, ON PURPOSE — SECOND SAFETY GUARD.
// executeStripeTransfer() throws 'invalid_amount' when amountInCents <= 0, and
// that check sits AFTER the connected-account resolution and BEFORE
// stripe.transfers.create — see server/utils/stripeTransfer.js.
// That ordering is what lets these tests observe the account resolution without
// any network call ever being dispatched to Stripe. The dummy key above is the
// first guard; this is the second, and they are independent.
const NEVER_DISPATCHED_AMOUNT = -1;

// ── HTTP TRANSPORT ────────────────────────────────────────────────────────────

function httpRequest(port, method, path, token, bodyObj) {
  const bodyBuf = bodyObj === undefined ? null : Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (bodyBuf) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = bodyBuf.length;
    }
    const req = _httpRequest({ hostname: 'localhost', port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

const httpGet    = (port, path, token)       => httpRequest(port, 'GET', path, token);
const httpPost   = (port, path, token, body) => httpRequest(port, 'POST', path, token, body || {});
const httpPatch  = (port, path, token, body) => httpRequest(port, 'PATCH', path, token, body || {});
const httpDelete = (port, path, token)       => httpRequest(port, 'DELETE', path, token, {});

// ── FIXTURE HELPERS ───────────────────────────────────────────────────────────

// Inserts a users row with a REAL bcrypt hash so PIN-change assertions can
// compare against the actual submitted value rather than a placeholder.
async function seedReferrer(pool, { contractorId, fullName, email, pin, bankToken = null }) {
  const hash = await bcrypt.hash(pin, 4);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, email_verified, contractor_id, stripe_bank_account_token)
     VALUES ($1, $2, $3, TRUE, $4, $5)
     RETURNING id`,
    [fullName, email, hash, contractorId, bankToken]
  );
  return rows[0].id;
}

async function seedCashout(pool, { contractorId, userId, fullName, email, amount }) {
  const { rows } = await pool.query(
    `INSERT INTO cashout_requests (user_id, full_name, email, amount, status, contractor_id)
     VALUES ($1, $2, $3, $4, 'approved', $5)
     RETURNING id`,
    [userId, fullName, email, amount, contractorId]
  );
  return rows[0].id;
}

async function readUser(pool, id) {
  const { rows } = await pool.query(
    'SELECT id, pin, jobber_client_id, contractor_id FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

// ── SUITE ─────────────────────────────────────────────────────────────────────

describe('Wave 1.1-c — cross-tenant credential and money writes (RED)', () => {
  // ⚠ ONE POOL PER FILE, NOT PER describe. initTestDb() returns the server/db.js
  // pool SINGLETON; a second describe calling pool.end() in its own after() kills
  // the pool the next suite is about to use, and the result is CANCELLED tests —
  // which contribute to neither the pass nor the fail column. See CLAUDE.md,
  // "CANCELLED and SKIPPED are FAILURES until explained".
  let pool, app, server, port;
  let tokenA, tokenB;
  let userA, userB, payoutA, payoutB, cashoutA, cashoutB;

  // Both referrers carry the SAME full_name on purpose. D3 and D6 both match on
  // name, so a cross-tenant collision is the condition under which they leak.
  const SHARED_NAME = 'Casey Cross';

  before(async () => {
    pool = await initTestDb();
    app = createApp();
    ({ server, port } = await startTestServer(app));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // FK-safe wipe order, DERIVED rather than copied. Eight tables reference
    // `contractors` with ON DELETE NO ACTION (admin_cache, announcement_settings,
    // cashout_requests, sessions, team_members, titles, user_preferences, users)
    // and three more reference users/team_members/cashout_requests the same way,
    // so each must be emptied before its parent. Read out of information_schema
    // against the test database rather than inferred from db.js, because a
    // hand-copied order is the thing that silently rots when a table is added.
    await pool.query('DELETE FROM payout_announcements');
    await pool.query('DELETE FROM cashout_requests');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_preferences');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM announcement_settings');
    await pool.query('DELETE FROM admin_cache');
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);

    // Tenant A has completed Stripe Connect. Tenant B has signed up and has NOT
    // — the not-configured case D4 must fail closed on.
    await pool.query(
      `UPDATE contractor_settings
          SET stripe_account_id = $2, stripe_connect_status = 'active'
        WHERE contractor_id = $1`,
      [TENANT_A, ACCT_A]
    );

    // Owner-tier members: requirePermission() short-circuits on tier='owner', so
    // every gate in this file is satisfied without enumerating flags. The
    // session, not the member, is what carries the tenant.
    const memberHash = await bcrypt.hash('W11cTest123!', 4);
    const { rows: mA } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'owner-a@w11c.test', $2, 'owner', '{}') RETURNING id`,
      [TENANT_A, memberHash]
    );
    const { rows: mB } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'owner-b@w11c.test', $2, 'owner', '{}') RETURNING id`,
      [TENANT_B, memberHash]
    );

    tokenA = 'a'.repeat(64);
    tokenB = 'b'.repeat(64);
    const expiresAt = new Date(Date.now() + 3_600_000);
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, $2, 'admin', $3, $4)`,
      [tokenA, expiresAt, TENANT_A, mA[0].id]
    );
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, $2, 'admin', $3, $4)`,
      [tokenB, expiresAt, TENANT_B, mB[0].id]
    );

    userA = await seedReferrer(pool, {
      contractorId: TENANT_A, fullName: SHARED_NAME, email: 'casey-a@w11c.test',
      pin: '1111', bankToken: encrypt('pm_w11c_tenant_a'),
    });
    userB = await seedReferrer(pool, {
      contractorId: TENANT_B, fullName: SHARED_NAME, email: 'casey-b@w11c.test',
      pin: '2222', bankToken: encrypt('pm_w11c_tenant_b'),
    });

    // ⚠ THE CASHOUTS HANG OFF THEIR OWN USERS, AND THAT IS LOAD-BEARING.
    // cashout_requests.user_id REFERENCES users(id) with ON DELETE NO ACTION, so
    // a referrer holding a cashout CANNOT be deleted at all — the DELETE raises a
    // foreign-key violation and the route 500s. Hanging cashoutB off userB made
    // D2's cross-tenant delete APPEAR to be refused: the row survived, the
    // assertion passed, and the reason had nothing to do with tenancy. Same shape
    // as the ghost id masking D4. Separate users keep D2 measuring D2.
    payoutA = await seedReferrer(pool, {
      contractorId: TENANT_A, fullName: 'Payout Alpha', email: 'payout-a@w11c.test',
      pin: '3333', bankToken: encrypt('pm_w11c_payout_a'),
    });
    payoutB = await seedReferrer(pool, {
      contractorId: TENANT_B, fullName: 'Payout Beta', email: 'payout-b@w11c.test',
      pin: '4444', bankToken: encrypt('pm_w11c_payout_b'),
    });

    cashoutA = await seedCashout(pool, {
      contractorId: TENANT_A, userId: payoutA, fullName: 'Payout Alpha',
      email: 'payout-a@w11c.test', amount: 250,
    });
    cashoutB = await seedCashout(pool, {
      contractorId: TENANT_B, userId: payoutB, fullName: 'Payout Beta',
      email: 'payout-b@w11c.test', amount: 250,
    });

    // Tenant A's pipeline holds a client whose name collides with tenant B's
    // referrer. This is what turns D3's untenanted SELECT into an untenanted
    // WRITE: A's admin calls match-jobber on B's user, the pipeline_cache lookup
    // (which IS correctly scoped to A) finds this row, and A's jobber_client_id
    // is stamped onto B's user.
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, pipeline_status)
       VALUES ($1, 'jc-a-cross', $2, 'lead')`,
      [TENANT_A, SHARED_NAME]
    );
  });

  // ── D5 — GET /api/admin/users ───────────────────────────────────────────────
  // admin/referrers.js, GET /api/admin/users. BEFORE THE FIX: the handler captured
  // contractorId and threaded it into the lifecycle_status pipeline_cache
  // subqueries, but the outer `FROM users u ... ${where}` had no u.contractor_id
  // predicate — correct-looking scoping directly beside the omission.
  // ⚠ ASSERT ON CONTENT, NOT STATUS. This route returns 200 either way; the
  // defect is which rows are in the array.

  describe('D5 — GET /api/admin/users', () => {
    it('POSITIVE CONTROL: tenant A\'s admin receives tenant A\'s own referrer', async () => {
      const res = await httpGet(port, '/api/admin/users', tokenA);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body), 'response is an array');
      const emails = res.body.map(r => r.email);
      assert.ok(
        emails.includes('casey-a@w11c.test'),
        'tenant A\'s own referrer must be returned — a predicate that returns nothing ' +
        'would satisfy the negative test below while breaking the feature'
      );
    });

    it('RED: tenant A\'s admin must NOT receive tenant B\'s referrer', async () => {
      const res = await httpGet(port, '/api/admin/users', tokenA);
      assert.equal(res.status, 200);
      const emails = res.body.map(r => r.email);
      assert.ok(
        !emails.includes('casey-b@w11c.test'),
        'tenant B\'s referrer leaked into tenant A\'s list — full_name, email, phone and ' +
        'signup provenance for every homeowner at every contractor'
      );
    });
  });

  // ── D1 — PATCH /api/admin/users/:id/pin ─────────────────────────────────────
  // admin/referrers.js, PATCH /api/admin/users/:id/pin. BEFORE THE FIX: the discard
  // form of verifyAdminSession, then `UPDATE users SET pin=$1 WHERE id=$2`. Sets a
  // homeowner's LOGIN CREDENTIAL by numeric id, at any contractor.

  describe('D1 — PATCH /api/admin/users/:id/pin', () => {
    it('POSITIVE CONTROL: tenant A\'s admin CAN reset tenant A\'s own referrer PIN', async () => {
      const res = await httpPatch(port, `/api/admin/users/${userA}/pin`, tokenA, { pin: '9999' });
      assert.equal(res.status, 200, 'same-tenant PIN reset must succeed');
      const row = await readUser(pool, userA);
      assert.ok(
        await bcrypt.compare('9999', row.pin),
        'the stored hash must verify against the NEW pin — observing the write, not the 200'
      );
    });

    it('RED: tenant A\'s admin must NOT reset tenant B\'s referrer PIN', async () => {
      const before = await readUser(pool, userB);
      const res = await httpPatch(port, `/api/admin/users/${userB}/pin`, tokenA, { pin: '9999' });

      const after = await readUser(pool, userB);
      assert.equal(
        after.pin, before.pin,
        'tenant B\'s PIN hash changed — tenant A set a homeowner login credential at another contractor'
      );
      assert.ok(
        !(await bcrypt.compare('9999', after.pin)),
        'tenant B\'s PIN now verifies against the value tenant A submitted'
      );
      assert.equal(res.status, 404, 'a cross-tenant target must not be found');
    });
  });

  // ── D2 — DELETE /api/admin/users/:id ────────────────────────────────────────
  // admin/referrers.js, DELETE /api/admin/users/:id. BEFORE THE FIX: the discard
  // form, then `DELETE FROM users WHERE id=$1`. sessions.user_id is ON DELETE
  // CASCADE, so this also destroys the victim's live sessions.

  describe('D2 — DELETE /api/admin/users/:id', () => {
    it('POSITIVE CONTROL: tenant A\'s admin CAN delete tenant A\'s own referrer', async () => {
      const res = await httpDelete(port, `/api/admin/users/${userA}`, tokenA);
      assert.equal(res.status, 200, 'same-tenant delete must succeed');
      assert.equal(await readUser(pool, userA), null, 'the row is actually gone');
    });

    it('RED: tenant A\'s admin must NOT delete tenant B\'s referrer', async () => {
      const res = await httpDelete(port, `/api/admin/users/${userB}`, tokenA);

      // ⚠ THE ROW ASSERTION IS THE PRIMARY ONE. A 403 with the row already gone
      // is not a pass — the response code says nothing about whether the DELETE ran.
      const survivor = await readUser(pool, userB);
      assert.ok(
        survivor,
        'tenant B\'s referrer was hard-deleted by tenant A — irreversible, and it CASCADEs to their sessions'
      );
      assert.equal(survivor.contractor_id, TENANT_B);
      assert.equal(res.status, 404, 'a cross-tenant target must not be found');
    });
  });

  // ── D3 — POST /api/admin/users/:id/match-jobber ─────────────────────────────
  // admin/referrers.js, POST /api/admin/users/:id/match-jobber. BEFORE THE FIX:
  // this one used the CAPTURE form — contractorId was in scope and WAS used for the
  // pipeline_cache lookup. The untenanted pair were the PII SELECT on users and the
  // `UPDATE users SET jobber_client_id` beside it, ten lines from a correct predicate.

  describe('D3 — POST /api/admin/users/:id/match-jobber', () => {
    it('POSITIVE CONTROL: tenant A\'s admin CAN match tenant A\'s own referrer', async () => {
      const res = await httpPost(port, `/api/admin/users/${userA}/match-jobber`, tokenA);
      assert.equal(res.status, 200, 'same-tenant match must succeed');
      assert.equal(res.body.matched, true, 'the match must actually be found');
      const row = await readUser(pool, userA);
      assert.equal(
        row.jobber_client_id, 'jc-a-cross',
        'the CRM id must actually be written — observing the write, not the 200'
      );
    });

    it('RED: tenant A\'s admin must NOT read or write tenant B\'s referrer', async () => {
      const res = await httpPost(port, `/api/admin/users/${userB}/match-jobber`, tokenA);

      const victim = await readUser(pool, userB);
      assert.equal(
        victim.jobber_client_id, null,
        'tenant A stamped one of ITS OWN Jobber client ids onto tenant B\'s referrer — ' +
        'a cross-tenant write, and it silently re-points that homeowner\'s CRM identity'
      );
      assert.equal(res.status, 404, 'a cross-tenant target must not be found');
    });
  });

  // ── D6 — GET /api/admin/referrer/:name ──────────────────────────────────────
  // admin/referrers.js, GET /api/admin/referrer/:name. BEFORE THE FIX:
  // `WHERE u.full_name = $1 LIMIT 1`, resolving a referrer by name with no tenancy.
  //
  // ⚠ THIS ONE IS A SOURCE-TEXT TEST AND THE REASON IS STRUCTURAL, NOT STYLISTIC.
  // The handler awaits getCRMAdapter(contractorId) BEFORE the Promise.all
  // that runs the users query. In the test environment no contractor has a
  // connected CRM, so getCRMAdapter throws (crm/index.js:17-19) and the route
  // returns 503 without ever reaching the query. Seeding a CRM does not help:
  // the acculynx and servicetitan adapters are stubs that throw
  // (server/crm/acculynx.js:7), and the jobber adapter makes a live network call.
  // There is NO input that produces a 200 from this route without contacting
  // Jobber, so the leak is not observable over HTTP here at all.
  //
  // Reading the shipped handler via fn.toString() is the precedent this codebase
  // already priced and chose deliberately for exactly this situation — see
  // server/test/adminRouteInvariant.test.js's header. Its recorded cost applies
  // in full: this sees the handler as WRITTEN, not as EXECUTED. If the scoping is
  // ever moved into a helper, widen this assertion rather than deleting it.

  describe('D6 — GET /api/admin/referrer/:name', () => {
    function referrerDetailHandlerSource() {
      const routes = collectAdminRoutes(app._router.stack);
      const match = routes.find(r => r.method === 'GET' && r.path === '/api/admin/referrer/:name');
      assert.ok(match, 'GET /api/admin/referrer/:name must exist — the assertion needs a subject');
      const last = match.middlewareStack[match.middlewareStack.length - 1];
      return last.handle.toString();
    }

    it('POSITIVE CONTROL: the fixture really does contain a cross-tenant name collision', async () => {
      // Without this, the source-text assertion below could be guarding a
      // condition that cannot arise. It can: two referrers at two contractors
      // share a full_name, which is exactly what `WHERE u.full_name = $1` matches on.
      const { rows } = await pool.query(
        'SELECT contractor_id FROM users WHERE full_name = $1 ORDER BY contractor_id',
        [SHARED_NAME]
      );
      assert.deepEqual(
        rows.map(r => r.contractor_id), [TENANT_A, TENANT_B],
        'two referrers at two contractors must share a name for this defect to be reachable'
      );
    });

    it('POSITIVE CONTROL: the handler still contains the users query being asserted on', () => {
      const src = referrerDetailHandlerSource();
      assert.match(
        src, /FROM users u\b/,
        'the users query must be present — otherwise the predicate assertion below ' +
        'would pass or fail for reasons unrelated to tenancy'
      );
    });

    it('RED: the referrer-detail users query must carry a contractor_id predicate', () => {
      const src = referrerDetailHandlerSource();
      // Anchored on the table ALIAS, not on the bare token. The handler already
      // contains `contractorId` (destructured from the session, passed to
      // getCRMAdapter), so a needle of `contractor_id` alone would be one edit from
      // matching the wrong thing — the substring trap in a different costume.
      assert.match(
        src, /u\.contractor_id\s*=\s*\$\d/,
        'GET /api/admin/referrer/:name resolves a referrer by name across every ' +
        'contractor — one tenant\'s admin can read another tenant\'s homeowner by guessing a name'
      );
    });
  });

  // ── D4 — POST /api/admin/stripe/transfer ────────────────────────────────────
  // routes/stripe.js:161. TWO defects asserted SEPARATELY below, because fixing
  // one and reporting green on the other is the failure mode here.
  //
  // ⚠ AND A THIRD THING, WHICH IS WHY THESE TESTS ARE SHAPED THE WAY THEY ARE.
  // executeStripeTransfer resolved the connected account from a hardcoded
  // `WHERE contractor_id = 'accent-roofing'` — the GHOST id, which has no row in
  // production or here. So TODAY every call down
  // this path terminates at that lookup with 400 no_stripe_account, regardless
  // of who called or whose money it is. That masks the tenancy defect behind a
  // plausible-looking error: a naive "cross-tenant request is rejected" test
  // would pass today, vacuously, against a route that performs no tenancy check
  // whatsoever. The pair below is built so the ghost id cannot supply the answer.
  //
  // ⚠ NO REQUEST BELOW CAN REACH STRIPE. See NEVER_DISPATCHED_AMOUNT above.
  // Nothing here asserts anything about `destination` or the missing second leg —
  // that is the filed Connect-architecture ruling, not this phase.

  describe('D4 — POST /api/admin/stripe/transfer', () => {
    it('RED + POSITIVE CONTROL: the connected account resolves from the CALLER\'S contractor', async () => {
      const res = await httpPost(port, '/api/admin/stripe/transfer', tokenA, {
        cashoutRequestId: cashoutA,
        userId: payoutA,
        bonusAmount: NEVER_DISPATCHED_AMOUNT,
      });

      // ⚠ THIS TEST WEARS TWO HATS, AND BOTH ARE NECESSARY.
      // As a RED it is the assertion for D4's SECOND defect: tenant A has
      // completed Connect, and the hardcoded literal in executeStripeTransfer
      // reported it as unconnected.
      // As a POSITIVE CONTROL it is the only thing that gives the fail-closed
      // test below any meaning — that one is green today purely because the
      // ghost id makes EVERY contractor look unconfigured, so without this pair
      // it would be a fence around nothing.
      //
      // Tenant A HAS a connected account (ACCT_A). Reaching the amount check
      // proves the contractor_settings SELECT returned tenant A's row — that is
      // the only way past getContractorStripeAccountId's no-account throw. A
      // literal cannot produce this
      // result, because ACCT_A exists under TENANT_A and under nothing else.
      assert.notEqual(
        res.body && res.body.error, 'no_stripe_account',
        'a contractor that HAS completed Stripe Connect was reported as not connected — ' +
        'the account is being resolved from a hardcoded literal, not from the caller'
      );
      assert.equal(res.status, 500, 'execution reached the amount check, downstream of the account lookup');
      assert.equal(res.body.error, 'transfer_failed');
    });

    it('FAIL CLOSED: a contractor with NO connected account is rejected explicitly', async () => {
      const res = await httpPost(port, '/api/admin/stripe/transfer', tokenB, {
        cashoutRequestId: cashoutB,
        userId: payoutB,
        bonusAmount: NEVER_DISPATCHED_AMOUNT,
      });

      // ⚠ THIS TEST IS GREEN TODAY, AND TODAY IT IS GREEN FOR THE WRONG REASON —
      // the ghost id makes EVERY caller look unconfigured. It is a fence, not a
      // RED. What gives it meaning is the positive control above: once that goes
      // green, this one can only stay green by genuinely distinguishing a
      // configured contractor from an unconfigured one.
      assert.equal(res.status, 400, 'not-configured must fail closed');
      assert.equal(
        res.body.error, 'no_stripe_account',
        'and fail LOUD — never silently onto a default, a literal, or another contractor\'s account'
      );
    });

    it('RED: tenant A\'s admin must NOT move money for tenant B\'s cashout and user', async () => {
      const res = await httpPost(port, '/api/admin/stripe/transfer', tokenA, {
        cashoutRequestId: cashoutB,
        userId: payoutB,
        bonusAmount: NEVER_DISPATCHED_AMOUNT,
      });

      // TODAY: 400 no_stripe_account. The route accepted another tenant's ids,
      // read tenant B's encrypted bank token and decrypted it
      // in executeStripeTransfer, and only failed later at the ghost-id lookup.
      // It was never rejected on tenancy — there is no tenancy check to reject it.
      assert.notEqual(
        res.status, 400,
        'the request was carried as far as the connected-account lookup before failing, ' +
        'which means tenant B\'s bank token was read and decrypted on tenant A\'s behalf'
      );
      assert.equal(res.status, 404, 'a cross-tenant cashout must not be found');
    });
  });
});
