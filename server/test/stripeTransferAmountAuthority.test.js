'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT AUDIT — COMMIT (2): THE TRANSFER AMOUNT COMES FROM THE APPROVED ROW
//
// Danny's ruling, 2026-09-28, on finding 2 of PAYOUT_AMOUNT_AUDIT.md:
//   · the amount is taken from the approved `cashout_requests` row, NEVER from the
//     request body;
//   · any request whose amount disagrees is REJECTED and LOGGED;
//   · the transfer happens only for a cashout in the APPROVED state, OWNED by the
//     caller, and AT MOST ONCE.
//
// WHAT WAS THERE BEFORE. `POST /api/admin/stripe/transfer` read `bonusAmount` from
// `req.body` and handed it to `executeStripeTransfer` unchanged. The route's own
// ownership gate already SELECTed the cashout row that holds the approved amount —
// and then discarded it. `executeStripeTransfer` applies `Math.round(x * 100)` and
// `> 0` and nothing else: no upper bound, no comparison against the row, no state
// check. Any well-formed request transferred whatever it named.
//
// ⚠ WHY NO TEST CAUGHT IT, BECAUSE THAT IS THE PART WORTH COPYING. Every existing
// test of this route could observe only WHICH ERROR came back — there was no seam on
// the one call that moves money, so "sent the approved amount" and "sent whatever the
// caller asked for" were indistinguishable outcomes. A route whose central value is
// unobservable cannot be fenced. This file installs a stub via
// `router._setStripeTransferForTest` and asserts on the amount the stub RECEIVES,
// which is the only assertion that can tell those two states apart.
//
// ⚠ TWO INDEPENDENT GUARANTEES THAT NO TEST HERE REACHES STRIPE, and they are
// independent on purpose — the property is "no test may reach Stripe", and this file
// must not rest that property on a single mechanism:
//   1. the stub REPLACES the transfer function, so there is nothing to dispatch; and
//   2. `STRIPE_SECRET_KEY` is pinned EMPTY for this file, so if the stub ever failed
//      to install, the real `executeStripeTransfer` throws on its FIRST statement
//      rather than calling out. The failure is then a loud red here, not a network
//      call.
// ⚠ IT IS PINNED IN `before()` AND RESTORED IN `after()`, NOT AT MODULE LOAD.
// `crossTenantCredentialWrites.test.js` pins a DUMMY key at module load because it
// needs to get PAST that first statement; this file needs the opposite. Both run in
// one process under `--test-concurrency=1`, so a module-load assignment here would
// leak into whichever file ran next. Scope it to this file's own lifetime.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { createApp } = require('../app');
const { encrypt } = require('../utils/encryption');
const { seedContractor, startTestServer, stopTestServer } = require('./helpers');

const stripeRouter = require('../routes/stripe');

const TENANT = 'pay2-tenant';
const OTHER = 'pay2-other';
const ACCT = 'acct_pay2_tenant';

// The approved amount every fixture is seeded at. Safe as a POSITIVE number here
// only because the stub cannot dispatch; see the header.
const APPROVED = 250;

function httpPost(port, path, token, bodyObj) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj || {}));
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', 'Content-Length': bodyBuf.length };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = _httpRequest({ hostname: 'localhost', port, path, method: 'POST', headers }, res => {
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

describe('payout commit (2) — the Stripe transfer amount is the approved row\'s', () => {
  let pool, server, port, token, otherToken, payee, otherPayee;
  let calls;              // every { bonusAmount, ... } the stub was handed
  let stubBehaviour;      // 'ok' | 'throw'
  let savedStripeKey;

  before(async () => {
    pool = await initTestDb();
    savedStripeKey = process.env.STRIPE_SECRET_KEY;
    // Guard 2 — see the header. Empty, not a dummy.
    process.env.STRIPE_SECRET_KEY = '';

    stripeRouter._setStripeTransferForTest(async (_pool, args) => {
      calls.push(args);
      if (stubBehaviour === 'throw') {
        const e = new Error('stubbed_transfer_failure');
        e.code = 'stubbed_transfer_failure';
        throw e;
      }
      return { success: true, transferId: 'tr_pay2_stub' };
    });

    const app = createApp();
    ({ server, port } = await startTestServer(app));
  });

  after(async () => {
    stripeRouter._resetStripeTransferForTest();
    if (savedStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = savedStripeKey;
    if (server) await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    calls = [];
    stubBehaviour = 'ok';

    // ⚠ FK ORDER IS LOAD-BEARING, AND `titles` IS THE ONE THAT BITES. The first
    // writing of this hook deleted `contractors` without clearing `titles` first and
    // every case failed inside setup on `titles_contractor_id_fkey` — which reads as a
    // broken suite rather than a broken fixture. CLAUDE.md records the identical hook
    // fault from the landing-fonts commit; the tell is that a hook fault fails cases
    // that cannot possibly depend on it.
    await pool.query('DELETE FROM payout_announcements');
    await pool.query('DELETE FROM cashout_requests');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM announcement_settings');
    await pool.query('DELETE FROM admin_cache');
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedContractor(pool, TENANT);
    await seedContractor(pool, OTHER);
    await pool.query(
      `UPDATE contractor_settings SET stripe_account_id = $2, stripe_connect_status = 'active'
        WHERE contractor_id = $1`,
      [TENANT, ACCT]
    );

    const hash = await bcrypt.hash('Pay2Test123!', 4);
    const { rows: m } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'owner@pay2.test', $2, 'owner', '{}') RETURNING id`,
      [TENANT, hash]
    );
    const { rows: mo } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'owner@pay2other.test', $2, 'owner', '{}') RETURNING id`,
      [OTHER, hash]
    );
    token = 'c'.repeat(64);
    otherToken = 'd'.repeat(64);
    const expiresAt = new Date(Date.now() + 3_600_000);
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, $2, 'admin', $3, $4)`,
      [token, expiresAt, TENANT, m[0].id]
    );
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, $2, 'admin', $3, $4)`,
      [otherToken, expiresAt, OTHER, mo[0].id]
    );

    const pinHash = await bcrypt.hash('1111', 4);
    const { rows: u } = await pool.query(
      `INSERT INTO users (full_name, email, pin, email_verified, contractor_id, stripe_bank_account_token)
       VALUES ('Payee One', 'payee@pay2.test', $1, TRUE, $2, $3) RETURNING id`,
      [pinHash, TENANT, encrypt('pm_pay2_payee')]
    );
    payee = u[0].id;
    const { rows: uo } = await pool.query(
      `INSERT INTO users (full_name, email, pin, email_verified, contractor_id, stripe_bank_account_token)
       VALUES ('Payee Other', 'payee@pay2other.test', $1, TRUE, $2, $3) RETURNING id`,
      [pinHash, OTHER, encrypt('pm_pay2_other')]
    );
    otherPayee = uo[0].id;
  });

  async function seedCashout(status, amount = APPROVED, userId = payee, contractorId = TENANT) {
    const { rows } = await pool.query(
      `INSERT INTO cashout_requests (user_id, full_name, email, amount, status, payout_method, contractor_id)
       VALUES ($1, 'Payee One', 'payee@pay2.test', $2, $3, 'stripe_ach', $4) RETURNING id`,
      [userId, amount, status, contractorId]
    );
    return rows[0].id;
  }

  const statusOf = async (id) => (
    await pool.query('SELECT status, paid_at FROM cashout_requests WHERE id = $1', [id])
  ).rows[0];

  // ── THE AMOUNT'S SOURCE ────────────────────────────────────────────────────

  it('sends the ROW\'s amount when the body names none at all', async () => {
    const id = await seedCashout('approved');
    const res = await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: payee,
    });

    assert.equal(res.status, 200, 'a well-formed transfer for an approved cashout must succeed');
    assert.equal(calls.length, 1, 'the transfer must be attempted exactly once');
    // ⚠ THIS IS THE CENTRAL ASSERTION OF THE COMMIT. `bonusAmount` was absent from the
    // request, so a route that trusts the body could only have sent undefined/NaN.
    assert.equal(calls[0].bonusAmount, APPROVED, 'the amount must come from the approved row');
    assert.equal(res.body.amount, APPROVED, 'and the response must report what was sent');
  });

  it('⚠ REFUSES a request asking for MORE than the approved amount, and sends nothing', async () => {
    const id = await seedCashout('approved');
    const res = await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: payee, bonusAmount: 99999,
    });

    assert.equal(res.status, 422, 'a disagreeing amount must be refused');
    assert.equal(res.body.error, 'amount_mismatch');
    assert.equal(calls.length, 0, 'NOTHING may be handed to Stripe when the amount disagrees');
    const row = await statusOf(id);
    assert.equal(row.status, 'approved', 'and the cashout must be left claimable');
    assert.equal(row.paid_at, null);
  });

  it('refuses a request asking for LESS than the approved amount too', async () => {
    // ⚠ THE UNDER-ASK CASE IS NOT REDUNDANT. A one-sided check written as
    // `requested > approved` would pass the over-ask test above and still let a
    // caller under-pay a referrer, which is a wrong amount in the other direction.
    const id = await seedCashout('approved');
    const res = await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: payee, bonusAmount: 1,
    });
    assert.equal(res.status, 422);
    assert.equal(calls.length, 0);
  });

  it('LOGS the mismatch — a disagreement on a money path is never silent', async () => {
    const id = await seedCashout('approved');
    await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: payee, bonusAmount: 99999,
    });
    // ⚠ THE COLUMNS ARE `error_message` AND `source`, NOT `message`. `logError` puts the
    // Error's text in `error_message` and its own `source` argument in `source`; `route`
    // holds the request path. Asserting on a column that does not exist throws rather
    // than failing an assertion, which reads as a harness fault — so both are named.
    const { rows } = await pool.query(
      `SELECT error_message, source FROM error_log WHERE error_message LIKE '%amount_mismatch%'`
    );
    assert.equal(rows.length, 1, 'the refusal must write exactly one error_log row');
    assert.match(rows[0].error_message, /99999/, 'and the log must name the amount that was asked for');
    assert.match(rows[0].error_message, /250/, 'and the amount that was approved');
  });

  it('accepts a body amount that AGREES, including the NUMERIC-string form', async () => {
    // ⚠ THE PAIRED POSITIVE FOR THE THREE REFUSALS ABOVE. Without it, a check that
    // refused EVERY request would pass all of them — and `amount` is NUMERIC, so
    // node-postgres returns the STRING '250.00'. A naive `!==` compare rejects the
    // correct request, which is a live outage rather than a test nicety.
    const id = await seedCashout('approved');
    const res = await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: payee, bonusAmount: 250,
    });
    assert.equal(res.status, 200, 'an agreeing amount must NOT be refused');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].bonusAmount, APPROVED);
  });

  // ── THE STATE GATE ─────────────────────────────────────────────────────────

  for (const state of ['pending', 'denied', 'paid']) {
    it(`refuses to transfer for a '${state}' cashout`, async () => {
      const id = await seedCashout(state);
      const res = await httpPost(port, '/api/admin/stripe/transfer', token, {
        cashoutRequestId: id, userId: payee, bonusAmount: APPROVED,
      });
      assert.equal(res.status, 409, `a '${state}' cashout must not be transferable`);
      assert.equal(res.body.error, 'not_approved');
      assert.equal(calls.length, 0, 'and nothing may be sent');
      assert.equal((await statusOf(id)).status, state, 'and its state must be untouched');
    });
  }

  // ── OWNERSHIP ──────────────────────────────────────────────────────────────

  it('refuses a cashout belonging to another tenant', async () => {
    const id = await seedCashout('approved', APPROVED, otherPayee, OTHER);
    const res = await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: otherPayee, bonusAmount: APPROVED,
    });
    assert.equal(res.status, 404, 'another tenant\'s cashout must not be visible');
    assert.equal(calls.length, 0);
    assert.equal((await statusOf(id)).status, 'approved', 'and must be left untouched');
  });

  it('refuses when the payee does not own the named cashout', async () => {
    const id = await seedCashout('approved');
    const res = await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: otherPayee, bonusAmount: APPROVED,
    });
    assert.equal(res.status, 404, 'the payee must be bound to the cashout');
    assert.equal(calls.length, 0);
  });

  // ── AT MOST ONCE ───────────────────────────────────────────────────────────

  it('⚠ AT MOST ONCE: a repeat request for an already-paid cashout is refused and sends nothing again', async () => {
    const id = await seedCashout('approved');

    const first = await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: payee, bonusAmount: APPROVED,
    });
    assert.equal(first.status, 200, 'the first transfer must succeed');
    assert.equal(calls.length, 1);
    assert.equal((await statusOf(id)).status, 'paid', 'and must claim the row');

    const second = await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: payee, bonusAmount: APPROVED,
    });
    assert.equal(second.status, 409, 'the repeat must be refused');
    assert.equal(
      calls.length, 1,
      'and the transfer function must have been called EXACTLY ONCE across both requests'
    );
  });

  it('two concurrent requests never both transfer', async () => {
    // ⚠ THIS TEST DOES NOT MEASURE THE COMPARE-AND-SWAP, AND ITS FIRST WRITING CLAIMED
    // IT DID. Measured, not reasoned: guard-proof (iii) removed `AND status = 'approved'`
    // from the claim UPDATE — the CAS itself — and this case stayed **GREEN**. Only the
    // source fence fired, so the injection's whole behavioural width was 0.
    // ⚠ THE REASON IS THAT THE STATE GATE GETS THERE FIRST. The claim runs BEFORE the
    // transfer, so request 1 flips the row to 'paid' and request 2's `status !== 'approved'`
    // check refuses it — whether or not the UPDATE is conditional. The window the CAS
    // actually protects is the few microseconds between the SELECT and the UPDATE, and
    // nothing this test can do from outside the process reliably lands two requests
    // inside it. Making the stub slow does not help: the claim has already happened by
    // the time the stub is entered.
    // ⚠ SO WHAT PROVES THE CAS? The source fence below, plus guard-proof (iv), which
    // removes the state gate AND the CAS together and takes this case red along with the
    // repeat. The CAS is a genuine second line of defence for an interleaving the gate
    // cannot catch — it is simply not observable from here, and saying so is better than
    // a name that claims otherwise.
    // ⚠ WHAT THIS CASE DOES STILL EARN: the PROPERTY that two simultaneous callers never
    // both get money, whichever mechanism enforces it. That is worth pinning, and (iv)
    // shows it can fail.
    const id = await seedCashout('approved');
    const both = await Promise.all([
      httpPost(port, '/api/admin/stripe/transfer', token, { cashoutRequestId: id, userId: payee }),
      httpPost(port, '/api/admin/stripe/transfer', token, { cashoutRequestId: id, userId: payee }),
    ]);
    const ok = both.filter(r => r.status === 200);
    assert.equal(ok.length, 1, 'exactly one of two concurrent transfers may succeed');
    assert.equal(calls.length, 1, 'and Stripe must be called exactly once');
    assert.equal((await statusOf(id)).status, 'paid');
  });

  // ── THE FAILURE PATH ───────────────────────────────────────────────────────

  it('a FAILED transfer releases its claim, so it can be retried', async () => {
    const id = await seedCashout('approved');
    stubBehaviour = 'throw';
    const failed = await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: payee, bonusAmount: APPROVED,
    });
    assert.equal(failed.status, 500, 'a transfer failure must surface');
    const afterFail = await statusOf(id);
    assert.equal(afterFail.status, 'approved', 'the claim must be RELEASED on failure');
    assert.equal(afterFail.paid_at, null, 'and paid_at must be cleared');

    stubBehaviour = 'ok';
    const retried = await httpPost(port, '/api/admin/stripe/transfer', token, {
      cashoutRequestId: id, userId: payee, bonusAmount: APPROVED,
    });
    assert.equal(retried.status, 200, 'and the retry must then succeed');
    assert.equal((await statusOf(id)).status, 'paid');
  });

  // ── STRUCTURAL FENCES ──────────────────────────────────────────────────────

  it('the route reads the amount from the row and claims it in one compare-and-swap', async () => {
    // ⚠ A SOURCE FENCE, BECAUSE THE BEHAVIOURAL TESTS ABOVE CANNOT SEE A REWRITE THAT
    // HAPPENS TO PASS THEM. Both needles are properties, not formatting: the claim must
    // be conditional on 'approved' (that is the whole at-most-once mechanism), and the
    // sent amount must come from the claim's own RETURNING.
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'stripe.js'), 'utf8');
    const stripped = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

    assert.match(
      stripped, /UPDATE cashout_requests SET status = 'paid'[\s\S]{0,200}?AND status = 'approved'/,
      'the claim must be a compare-and-swap conditional on the approved state'
    );
    assert.match(
      stripped, /RETURNING amount/,
      'and it must return the amount it claimed'
    );
    assert.match(
      stripped, /bonusAmount:\s*amountToSend/,
      'the amount handed to the transfer must be the claimed one, never req.body\'s'
    );
  });

  it('the route does NOT hand req.body\'s bonusAmount to the transfer', async () => {
    // ⚠ THE INVERSE NEEDLE, AND IT IS THE ONE THE DEFECT WOULD TRIP. The pre-fix line
    // was `executeStripeTransfer(pool, { userId, cashoutRequestId, bonusAmount, contractorId })`
    // — the destructured body value passed through by shorthand. Forbidding that exact
    // shorthand is what stops it being reintroduced by someone "simplifying" the call.
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'stripe.js'), 'utf8');
    const stripped = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const transferCalls = stripped.match(/_executeStripeTransfer\(pool,\s*\{[^}]*\}/g) || [];
    assert.ok(transferCalls.length >= 1, 'harness: the transfer call must be found at all');
    for (const call of transferCalls) {
      assert.ok(
        !/\bbonusAmount\s*,/.test(call) && !/\{\s*bonusAmount\s*\}/.test(call),
        `the transfer must not be passed req.body's bonusAmount by shorthand: ${call}`
      );
    }
  });
});
