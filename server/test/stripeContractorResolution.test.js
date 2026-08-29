'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 1.1-e — THE GHOST-ID SWEEP — RED FIRST
//
// server/routes/stripe.js carries a module-level literal:
//     const CONTRACTOR_ID = 'accent-roofing';
// That is the PRE-RENAME GHOST id. Production's only contractor row is
// 'accent-roofing-dev'. Five sites read it — three reads through
// getStripeRow(), one inline UPDATE predicate, one Stripe customer metadata
// stamp — and three of them WRITE.
//
// ⚠ THE READ HAZARD AND THE WRITE HAZARD ARE DIFFERENT DEFECTS.
//   READS  manufacture a plausible answer. getStripeRow()'s
//          `|| { stripe_connect_status: 'not_connected' }` is indistinguishable
//          from a real measurement, and the admin Banking Settings card has
//          been reporting NOT CONNECTED against a live, healthy connection
//          (acct_…N98EW, active since 2026-08-02) for weeks because of it.
//   WRITES land on the wrong row. contractor_settings.contractor_id is
//          UNIQUE NOT NULL with NO FOREIGN KEY to contractors
//          (server/db.js — the contractor_settings CREATE TABLE), so a row
//          under a non-existent contractor is perfectly legal. Pressing
//          "Connect Stripe" today runs
//          INSERT … ON CONFLICT (contractor_id) DO UPDATE keyed to the ghost.
//
// ── ⚠ THE GHOST ROW IS SEEDED HERE ON PURPOSE, AND IT IS THE POINT ───────────
// ⚠ PRODUCTION DOES NOT HAVE THIS ROW, AND THAT IS NOT A REASON TO SIMPLIFY
// THIS HARNESS. Measured 2026-08-29, ahead of the fix: contractor_settings
// holds exactly ONE row — the renamed tenant, acct_…N98EW, active. So the
// Banking Settings card's "not connected" was the MANUFACTURED FALLBACK (zero
// rows in, `|| { … 'not_connected' }` out), not a read of a phantom; and the
// Connect button would have INSERTed a phantom rather than updating one.
//
// (CLAUDE_REGISTRY.md Known Issues 2a recorded contractor_settings as
// SPLIT-BRAIN — one row under each id — and that claim is STALE. Its own
// "Pending: Danny to run a comparison SELECT" was completed and never written
// back. Closed in the registry as part of this wave.)
//
// A harness that simply omitted the ghost row would pass for the WEAKER reason
// — "the literal found nothing" — and would go green against literal-reading
// code the moment a ghost row exists. So every test below runs against a
// contractor_settings row under the ghost id carrying a DISTINCTIVE,
// impossible-to-confuse account id. Nothing may ever read it and nothing may
// ever write to it. **That makes this suite independent of production's data
// state, which is the whole design — "production is clean today" is not a
// reason to take it out later.** It also proved its worth immediately: in the
// RED state route 3 served admin A the string `...ritten`, catching the defect
// in the act rather than inferring it from an absence.
//
// ── ⚠ NO TEST MAY REACH STRIPE — THE PROPERTY, AND THE MECHANISM RE-DERIVED ──
// 1.1-c PINNED STRIPE_SECRET_KEY to a dummy so its tests could get PAST
// executeStripeTransfer()'s first statement. 1.1-d EMPTIED it. Neither is
// inherited here; the mechanism is re-derived against THESE five routes.
//
// getStripeClient() (server/routes/stripe.js) throws when the key is falsy.
// Measured against each route in this file:
//     Route 1 create-account-link   getStripeClient() is the FIRST statement
//                                   in the try — a dummy key would dial
//                                   accounts.create for real
//     Route 2 confirm-connection    getStripeClient() AFTER the row read — a
//                                   dummy key would dial accounts.retrieve
//     Route 3 connection-status     never constructs a client at all
//     Route 4 disconnect            never constructs a client at all
//     Route 6 create-financial-…    getStripeClient() before customers.create
//                                   — a dummy key would dial customers.create
// So an EMPTY key makes construction STRUCTURALLY IMPOSSIBLE on 1, 2 and 6,
// and 3 and 4 need no guard. A DUMMY KEY WOULD PERMIT THREE REAL NETWORK
// CALLS. Same instruction as 1.1-c, opposite effect — which is the rule.
// The guard is asserted below, not assumed.
//
// ── ⚠ WHAT THIS SUITE CANNOT OBSERVE, SAID NOW RATHER THAN DISCOVERED LATER ──
// Routes 1 and 2 reach Stripe on their SUCCESS paths, so neither is testable
// end-to-end without a network call:
//   · Route 1's contractor resolution is covered ONLY at the helper level
//     (getStripeRow / upsertStripeAccount, which this phase exports and gives
//     required arguments). There is no route-level assertion for it and this
//     comment is the record that it is absent, not overlooked.
//   · Route 2's UPDATE predicate is unreachable — accounts.retrieve() must
//     succeed first. It is covered by CONSTRUCTION rather than by a test:
//     deleting the module-level CONTRACTOR_ID makes the old predicate
//     unable to resolve at all. That is why deleting the const is a
//     requirement of the fix and not a tidy-up.
//   · Route 6's metadata VALUE is likewise unobservable — customers.create()
//     never runs. It is covered by a source-text assertion anchored on the
//     surrounding expression plus an execution test proving the handler still
//     runs to the Stripe boundary, per CLAUDE.md: any file a sweep touches
//     needs at least one test that proves the code still runs.
//
// ⚠ EVERY NEGATIVE HAS A POSITIVE CONTROL AND THE POSITIVE IS ORDERED FIRST.
// A predicate that resolves to nothing passes every cross-tenant test and is
// indistinguishable from a working one — which is exactly the defect here.
// Each positive asserts an OBSERVED READ or an OBSERVED WRITE, never a bare
// 200 and never "no error was thrown".
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');

// GUARD — must run before ../app (and therefore ../routes/stripe) is required.
// Empty string rather than `delete`: dotenv skips a key that is already an own
// property of process.env, so a later .env load cannot put a real key back.
process.env.STRIPE_SECRET_KEY = '';

const fs = require('fs');
const path = require('path');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { createApp } = require('../app');
const { seedContractor, startTestServer, stopTestServer } = require('./helpers');
const stripeRoutes = require('../routes/stripe');

const TENANT_A = 'w11e-tenant-a';
const TENANT_B = 'w11e-tenant-b';
// Signed up, no Stripe Connect. The not-configured case the write paths must
// fail closed on.
const TENANT_C = 'w11e-tenant-c';

// ⚠ THE GHOST. Never a valid answer to any question this suite asks.
const GHOST_ID = 'accent-roofing';
const ACCT_GHOST = 'acct_GHOST_must_never_be_read_or_written';

const ACCT_A = 'acct_w11e_tenantA_AAAAAA';
const ACCT_B = 'acct_w11e_tenantB_BBBBBB';

// ── HTTP TRANSPORT ────────────────────────────────────────────────────────────

function httpRequest(port, method, routePath, token, bodyObj) {
  const bodyBuf = bodyObj === undefined ? null : Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (bodyBuf) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = bodyBuf.length;
    }
    const req = _httpRequest({ hostname: 'localhost', port, path: routePath, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
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

const httpGet  = (port, p, token)       => httpRequest(port, 'GET', p, token);
const httpPost = (port, p, token, body) => httpRequest(port, 'POST', p, token, body || {});

// ── FIXTURE READBACK ──────────────────────────────────────────────────────────

async function settingsRow(pool, contractorId) {
  const { rows } = await pool.query(
    'SELECT contractor_id, stripe_account_id, stripe_connect_status FROM contractor_settings WHERE contractor_id = $1',
    [contractorId]
  );
  return rows[0] || null;
}

describe('Wave 1.1-e — the ghost contractor id on the Stripe surface (RED)', () => {
  let pool;
  let server;
  let port;
  let tokenA;
  let tokenB;
  let tokenC;
  let referrerTokenA;

  before(async () => {
    pool = await initTestDb();
    const app = createApp();
    ({ server, port } = await startTestServer(app));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_preferences');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM announcement_settings');
    await pool.query('DELETE FROM admin_cache');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);
    await seedContractor(pool, TENANT_C);

    await pool.query(
      `UPDATE contractor_settings SET stripe_account_id = $2, stripe_connect_status = 'active' WHERE contractor_id = $1`,
      [TENANT_A, ACCT_A]
    );
    await pool.query(
      `UPDATE contractor_settings SET stripe_account_id = $2, stripe_connect_status = 'pending' WHERE contractor_id = $1`,
      [TENANT_B, ACCT_B]
    );
    // TENANT_C keeps the seeded row's defaults: stripe_account_id NULL,
    // stripe_connect_status 'not_connected'.

    // ⚠ THE GHOST ROW — a contractor_settings row under an id with NO
    // contractors row, which the schema permits because there is no FK. This
    // reproduces production's recorded split-brain. Nothing may read it and
    // nothing may write it.
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name, stripe_account_id, stripe_connect_status)
       VALUES ($1, 'GHOST — no contractors row', $2, 'active')`,
      [GHOST_ID, ACCT_GHOST]
    );

    // Owner tier: requirePermission() short-circuits on tier='owner', so the
    // finance_settings / finance_settings.manage gates are satisfied without
    // enumerating flags. The SESSION, not the member, carries the tenant.
    const hash = await bcrypt.hash('W11eTest123!', 4);
    const mk = async (tenant, email) => {
      const { rows } = await pool.query(
        `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
         VALUES ($1, $2, $3, 'owner', '{}') RETURNING id`,
        [tenant, email, hash]
      );
      return rows[0].id;
    };
    const mA = await mk(TENANT_A, 'owner-a@w11e.test');
    const mB = await mk(TENANT_B, 'owner-b@w11e.test');
    const mC = await mk(TENANT_C, 'owner-c@w11e.test');

    tokenA = 'a'.repeat(64);
    tokenB = 'b'.repeat(64);
    tokenC = 'c'.repeat(64);
    referrerTokenA = 'd'.repeat(64);
    const expiresAt = new Date(Date.now() + 3_600_000);
    const mkSession = (tok, tenant, memberId) => pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, $2, 'admin', $3, $4)`,
      [tok, expiresAt, tenant, memberId]
    );
    await mkSession(tokenA, TENANT_A, mA);
    await mkSession(tokenB, TENANT_B, mB);
    await mkSession(tokenC, TENANT_C, mC);

    // A referrer at TENANT_A, for the route 6 execution test.
    const { rows: uRows } = await pool.query(
      `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
       VALUES ('Route Six Referrer', 'r6@w11e.test', $1, TRUE, $2) RETURNING id`,
      [hash, TENANT_A]
    );
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id)
       VALUES ($1, $2, $3, 'referrer', $4)`,
      [uRows[0].id, referrerTokenA, expiresAt, TENANT_A]
    );
  });

  // ── GUARD 0 — the no-Stripe mechanism, asserted rather than assumed ────────
  it('GUARD: STRIPE_SECRET_KEY is empty, so a Stripe client cannot be constructed', () => {
    assert.equal(
      process.env.STRIPE_SECRET_KEY,
      '',
      'STRIPE_SECRET_KEY is not empty. getStripeClient() would construct a REAL client and ' +
        'routes 1, 2 and 6 would dial api.stripe.com. Do not pin a dummy key here — that is ' +
        '1.1-c\'s mechanism and it is exactly wrong for these routes.'
    );
  });

  // ── GUARD 1 — the ghost row exists, so every test below is non-vacuous ────
  // ⚠ WITHOUT THIS, THE WHOLE SUITE COULD PASS FOR THE WEAKER REASON.
  it('GUARD: the ghost contractor_settings row exists and has no contractors row', async () => {
    const ghost = await settingsRow(pool, GHOST_ID);
    assert.ok(ghost, `the ghost row under '${GHOST_ID}' was not seeded — every assertion below would ` +
      'pass merely because the literal found nothing, which is the WEAK reason and would go ' +
      'green again the moment a ghost row exists.');
    assert.equal(ghost.stripe_account_id, ACCT_GHOST);
    const { rows } = await pool.query('SELECT 1 FROM contractors WHERE id = $1', [GHOST_ID]);
    assert.equal(rows.length, 0, 'the ghost must have NO contractors row — that is what makes it a ghost');
  });

  // ══ ROUTE 3 — GET /api/admin/stripe/connection-status ═════════════════════
  // The Banking Settings card. Read-only, never touches Stripe, fully testable.

  it('POSITIVE — route 3 returns TENANT A\'s OWN connected account', async () => {
    const res = await httpGet(port, '/api/admin/stripe/connection-status', tokenA);
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

    // ⚠ THE MASKED ID IS ASSERTED FIRST, AND DELIBERATELY, BECAUSE THE STATUS
    // FIELD CANNOT DISCRIMINATE HERE. The ghost row is seeded 'active' — the
    // realistic and more dangerous production shape, a phantom that LOOKS
    // connected — and tenant A is legitimately 'active' too. So a suite that
    // asserted only the status would go GREEN today against a read of the
    // ghost. That is CLAUDE.md's "a test asserting a component's DEFAULTED
    // fields cannot see a bug in its NON-DEFAULTED one", wearing a new costume:
    // the account id is the field that differs, so it is the primary assertion.
    assert.equal(
      res.body.stripe_account_id_masked,
      `...${ACCT_A.slice(-6)}`,
      'the masked id must be TENANT A\'s. An OBSERVED READ of a real row is the assertion — ' +
        '"no error was thrown" is not.'
    );
    assert.equal(
      res.body.stripe_connect_status,
      'active',
      'Tenant A has stripe_connect_status=active in contractor_settings. This is the Banking ' +
        'Settings card\'s field, and it is asserted second for the reason above.'
    );
  });

  it('NEGATIVE — route 3 never returns the GHOST row to anyone', async () => {
    for (const [label, tok] of [['A', tokenA], ['B', tokenB], ['C', tokenC]]) {
      const res = await httpGet(port, '/api/admin/stripe/connection-status', tok);
      assert.notEqual(
        res.body.stripe_account_id_masked,
        `...${ACCT_GHOST.slice(-6)}`,
        `admin ${label} was served the GHOST row's account id. The SELECT is keyed to the ` +
          'literal, not to the session.'
      );
    }
  });

  it('CROSS-TENANT — route 3 serves B its own row, never A\'s', async () => {
    const res = await httpGet(port, '/api/admin/stripe/connection-status', tokenB);
    assert.equal(res.status, 200);
    assert.equal(res.body.stripe_connect_status, 'pending', 'B\'s own status is pending');
    assert.equal(res.body.stripe_account_id_masked, `...${ACCT_B.slice(-6)}`);
    assert.notEqual(
      res.body.stripe_account_id_masked,
      `...${ACCT_A.slice(-6)}`,
      'admin B was served TENANT A\'s Stripe account id'
    );
  });

  it('NOT-CONFIGURED — route 3 reports C honestly, and does not borrow a row', async () => {
    const res = await httpGet(port, '/api/admin/stripe/connection-status', tokenC);
    assert.equal(res.status, 200);
    assert.equal(res.body.stripe_connect_status, 'not_connected');
    assert.equal(
      res.body.stripe_account_id_masked,
      null,
      'a contractor with no Stripe account must get null, never another tenant\'s or the ghost\'s'
    );
  });

  // ══ ROUTE 4 — POST /api/admin/stripe/disconnect ═══════════════════════════
  // Write path. Never touches Stripe, fully testable end-to-end.

  it('POSITIVE — route 4 clears TENANT A\'s OWN row, observed in the database', async () => {
    const before = await settingsRow(pool, TENANT_A);
    assert.equal(before.stripe_account_id, ACCT_A, 'precondition: A starts connected');

    const res = await httpPost(port, '/api/admin/stripe/disconnect', tokenA);
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);

    const after = await settingsRow(pool, TENANT_A);
    assert.equal(after.stripe_account_id, null, 'TENANT A\'s row was NOT cleared — the UPDATE landed elsewhere');
    assert.equal(after.stripe_connect_status, 'not_connected');
  });

  it('NEGATIVE — route 4 does not write to the GHOST row', async () => {
    await httpPost(port, '/api/admin/stripe/disconnect', tokenA);
    const ghost = await settingsRow(pool, GHOST_ID);
    assert.equal(
      ghost.stripe_account_id,
      ACCT_GHOST,
      'the disconnect UPDATE landed on the GHOST row. That is the write hazard: a phantom row ' +
        'mutated by a real admin action, with no FK to stop it.'
    );
  });

  // ⚠ GREEN IN THE RED STATE, ON PURPOSE — and here is why, so nobody reads it
  // as evidence the fix is unnecessary. Today the UPDATE lands on the GHOST, so
  // B is untouched for the WRONG reason. This test proves nothing about the
  // defect; it is a REGRESSION FENCE for after the fix, when the UPDATE becomes
  // a real per-caller write and B genuinely could be hit. Recorded rather than
  // deleted, because "it was green before too" is the question a reader will
  // ask.
  it('CROSS-TENANT — A disconnecting does not touch B', async () => {
    await httpPost(port, '/api/admin/stripe/disconnect', tokenA);
    const b = await settingsRow(pool, TENANT_B);
    assert.equal(b.stripe_account_id, ACCT_B, 'admin A\'s disconnect cleared TENANT B\'s Stripe account');
    assert.equal(b.stripe_connect_status, 'pending');
  });

  // ⚠ ALSO GREEN IN THE RED STATE. Today the UPDATE matches the ghost row,
  // which already exists, so no row is created — again the wrong reason. Its
  // job is post-fix: once the predicate is the caller's contractor, an UPDATE
  // that matched nothing must stay an UPDATE that matched nothing, and must
  // never be "helpfully" turned into an upsert.
  it('NOT-CONFIGURED — route 4 by C creates no row and borrows none', async () => {
    const res = await httpPost(port, '/api/admin/stripe/disconnect', tokenC);
    assert.equal(res.status, 200);
    const c = await settingsRow(pool, TENANT_C);
    assert.equal(c.stripe_account_id, null);
    const { rows } = await pool.query('SELECT contractor_id FROM contractor_settings ORDER BY contractor_id');
    assert.deepEqual(
      rows.map((r) => r.contractor_id).sort(),
      [GHOST_ID, TENANT_A, TENANT_B, TENANT_C].sort(),
      'a contractor_settings row was created or destroyed by a disconnect. The write paths must ' +
        'never silently manufacture a row under a wrong id.'
    );
  });

  // ══ ROUTE 2 — POST /api/admin/stripe/confirm-connection ═══════════════════
  // ⚠ THE ABSENT CASE IS THE PRIMARY TEST HERE. Route 2 answers 400 when the
  // caller's row has no stripe_account_id and only then constructs a Stripe
  // client, so the 400/500 split is what proves WHICH ROW was read — and under
  // the ghost, tenant C reads an account id it does not own and never 400s.

  it('NOT-CONFIGURED (primary) — route 2 tells C it has no Stripe account', async () => {
    const res = await httpPost(port, '/api/admin/stripe/confirm-connection', tokenC);
    assert.equal(
      res.status,
      400,
      `TENANT C has stripe_account_id NULL and must get 400. Got ${res.status}: ` +
        `${JSON.stringify(res.body)}. A 500 here means the row read found an account id C does ` +
        'not own — the GHOST\'s.'
    );
    assert.deepEqual(res.body, { error: 'No Stripe account linked' },
      'the exact body is pinned: a plausible-looking rejection is not the rejection under test');
  });

  // ⚠ VACUOUS IN THE RED STATE, AND THIS IS THE CLEAREST CASE IN THE FILE.
  // Today EVERY caller reads the ghost, the ghost HAS an account id, so every
  // caller gets past the 400 check and 500s — including A. This assertion is
  // green right now for a reason that has nothing to do with what it claims.
  // It is the paired positive control for the NOT-CONFIGURED test above, which
  // is the one that actually fires, and after the fix the pair discriminates:
  // A (has an id) → 500, C (has none) → 400. Neither alone would be evidence.
  it('POSITIVE — route 2 gets PAST the row check for A, proving it read A\'s account id', async () => {
    const res = await httpPost(port, '/api/admin/stripe/confirm-connection', tokenA);
    assert.equal(
      res.status,
      500,
      `TENANT A HAS an account id, so route 2 must pass the 400 check and then fail at ` +
        `getStripeClient() on the empty key. Got ${res.status}: ${JSON.stringify(res.body)}. ` +
        'A 400 would mean the read did not find A\'s row.'
    );
    assert.deepEqual(res.body, { error: 'Failed to confirm Stripe connection' },
      'the 500 must be the getStripeClient() failure, not some other 500');
  });

  // ⚠ GREEN BOTH WAYS — the UPDATE at the end of route 2 is unreachable under
  // an empty key, so this can only ever prove that the failure path writes
  // nothing. That IS worth pinning (a 500 that half-committed would be worse
  // than the defect), but it is not evidence about the ghost id.
  it('NEGATIVE — a failed confirm-connection leaves every row untouched', async () => {
    await httpPost(port, '/api/admin/stripe/confirm-connection', tokenA);
    assert.equal((await settingsRow(pool, GHOST_ID)).stripe_connect_status, 'active',
      'the GHOST row\'s status was mutated by a confirm-connection');
    assert.equal((await settingsRow(pool, TENANT_B)).stripe_connect_status, 'pending',
      'TENANT B\'s status was mutated by admin A\'s confirm-connection');
  });

  // ══ ROUTE 1's HELPERS — the only level at which route 1 is testable ═══════
  // ⚠ Route 1 calls getStripeClient() as its FIRST statement, so its success
  // path cannot be exercised without reaching Stripe. These are the assertions
  // that exist instead, and the header records that the route-level one is
  // absent rather than overlooked.

  it('POSITIVE — getStripeRow(contractorId) reads the NAMED contractor\'s row', async () => {
    assert.equal(
      typeof stripeRoutes.getStripeRow,
      'function',
      'server/routes/stripe.js does not export getStripeRow. It is module-private and takes no ' +
        'argument — it reads the module-level CONTRACTOR_ID literal, which is the defect.'
    );
    const rowA = await stripeRoutes.getStripeRow(TENANT_A);
    assert.equal(rowA.stripe_account_id, ACCT_A, 'an OBSERVED READ of TENANT A\'s real row');
    assert.equal(rowA.stripe_connect_status, 'active');
  });

  it('CROSS-TENANT — getStripeRow never returns another tenant\'s row or the ghost\'s', async () => {
    const rowB = await stripeRoutes.getStripeRow(TENANT_B);
    assert.equal(rowB.stripe_account_id, ACCT_B);
    assert.notEqual(rowB.stripe_account_id, ACCT_A);
    assert.notEqual(rowB.stripe_account_id, ACCT_GHOST);

    const rowC = await stripeRoutes.getStripeRow(TENANT_C);
    assert.equal(rowC.stripe_account_id, null,
      'a contractor with no account must read null, never the ghost\'s or another tenant\'s');
  });

  it('FAIL CLOSED — getStripeRow throws on a missing contractorId, it does not default', async () => {
    await assert.rejects(
      () => stripeRoutes.getStripeRow(undefined),
      /contractorId is required/,
      'getStripeRow must throw loudly on an unresolvable contractor. Falling back to a literal, ' +
        'an env var, or the first row in the table is what produced this whole defect — see ' +
        'getContractorStripeAccountId in server/utils/stripeTransfer.js.'
    );
  });

  it('POSITIVE — upsertStripeAccount writes to the NAMED contractor, observed', async () => {
    assert.equal(
      typeof stripeRoutes.upsertStripeAccount,
      'function',
      'server/routes/stripe.js does not export upsertStripeAccount'
    );
    await stripeRoutes.upsertStripeAccount(TENANT_C, 'acct_w11e_new_for_C', 'pending');
    const c = await settingsRow(pool, TENANT_C);
    assert.equal(c.stripe_account_id, 'acct_w11e_new_for_C', 'an OBSERVED WRITE to TENANT C\'s row');
    assert.equal(c.stripe_connect_status, 'pending');
  });

  it('NEGATIVE — upsertStripeAccount does not touch the ghost or other tenants', async () => {
    await stripeRoutes.upsertStripeAccount(TENANT_C, 'acct_w11e_new_for_C', 'pending');
    assert.equal((await settingsRow(pool, GHOST_ID)).stripe_account_id, ACCT_GHOST,
      'the upsert landed on the GHOST row — this is the phantom-row hazard, exactly as it would ' +
        'fire the first time anyone presses "Connect Stripe"');
    assert.equal((await settingsRow(pool, TENANT_A)).stripe_account_id, ACCT_A);
    assert.equal((await settingsRow(pool, TENANT_B)).stripe_account_id, ACCT_B);
  });

  it('FAIL CLOSED — upsertStripeAccount throws on a missing contractorId, writing nothing', async () => {
    const beforeCount = (await pool.query('SELECT COUNT(*)::int AS n FROM contractor_settings')).rows[0].n;
    await assert.rejects(
      () => stripeRoutes.upsertStripeAccount(undefined, 'acct_should_never_land', 'pending'),
      /contractorId is required/,
      'upsertStripeAccount must throw before it queries. A write path that defaults its tenant ' +
        'creates the phantom row this phase exists to make impossible.'
    );
    const afterCount = (await pool.query('SELECT COUNT(*)::int AS n FROM contractor_settings')).rows[0].n;
    assert.equal(afterCount, beforeCount, 'a row was written despite the throw');
    const { rows } = await pool.query(
      'SELECT 1 FROM contractor_settings WHERE stripe_account_id = $1', ['acct_should_never_land']
    );
    assert.equal(rows.length, 0, 'the rejected write still landed somewhere');
  });

  // ══ ROUTE 6 — the Stripe customer metadata stamp ══════════════════════════
  // ⚠ THE VALUE IS NOT OBSERVABLE — customers.create() never runs under an
  // empty key. Coverage is the pair below: the literal is gone from the file,
  // AND the handler still runs to the Stripe boundary. CLAUDE.md: a sweep
  // proves a string is ABSENT and proves NOTHING about whether the code still
  // runs, so any file a sweep touches needs at least one execution test.

  it('SOURCE — server/routes/stripe.js contains no ghost literal anywhere', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'stripe.js'), 'utf8');
    assert.equal(
      src.includes(`'${GHOST_ID}'`),
      false,
      `server/routes/stripe.js still contains the literal '${GHOST_ID}'. Both the module-level ` +
        'CONTRACTOR_ID const and the Stripe customer metadata stamp must resolve dynamically. ' +
        '⚠ AND THE FIX IS NOT A RENAME: do not replace it with \'accent-roofing-dev\'. A ' +
        'half-completed rename is what created this split-brain.'
    );
    assert.equal(
      src.includes('CONTRACTOR_ID'),
      false,
      'the module-level CONTRACTOR_ID const survives. Leaving it unused invites reuse; deleting ' +
        'it is what makes the defect unrepresentable.'
    );
  });

  it('SOURCE — the customer metadata stamps a resolved contractorId, in context', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'stripe.js'), 'utf8');
    assert.match(
      src,
      /metadata:\s*\{\s*roofmiles_user_id:\s*String\(user\.id\),\s*contractor_id:\s*contractorId\s*\}/,
      'the Stripe customer metadata must stamp the resolved contractorId. ⚠ ANCHORED ON THE ' +
        'SURROUNDING EXPRESSION, NOT ON THE BARE NAME — a bare `contractorId` needle matches the ' +
        'four other places this file already uses it and would pass against an unchanged ' +
        'metadata object.'
    );
  });

  // ⚠ GREEN IN THE RED STATE BY DESIGN — it is the CONTROL for the two source
  // sweeps above, not a test of the defect. AnnouncementPopup threw a
  // ReferenceError on every render while its literal sweep passed; the sweep
  // was correct, the component simply no longer ran. After the fix, route 6
  // destructures contractorId from the session — if that destructure is wrong,
  // both sweeps still pass and only this test moves.
  it('EXECUTION — route 6 still runs to the Stripe boundary for a real referrer', async () => {
    const res = await httpPost(port, '/api/referrer/stripe/create-financial-connections-session', referrerTokenA);
    assert.equal(
      res.status,
      500,
      `route 6 must get past auth and the users lookup and fail at getStripeClient() on the ` +
        `empty key. Got ${res.status}: ${JSON.stringify(res.body)}. A 401 means auth broke; a ` +
        '404 means the user lookup broke; a 200 means it reached Stripe, which must be impossible.'
    );
    assert.deepEqual(res.body, { error: 'Failed to create bank connection session' },
      'the sweep proves the literal is absent and proves nothing about whether the code runs — ' +
        'this is the execution half');
  });
});
