'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 7a — THE PIPELINE CARD SHOWS THE BONUS ACTUALLY CREDITED
//
// Danny ruling 3b, 2026-09-29: the referrer's pipeline card shows the `referral_conversions`
// row's own `bonus_amount`, and NOTHING before a conversion exists. The speculative
// `500 + boostSchedule[paidCount]` ladder is retired in BOTH places that computed it —
// `fetchPipelineForReferrer` (server/crm/jobber.js) and the stale-cache fallback in
// `GET /api/pipeline` (server/routes/referrer.js), which also carried its own INLINE copy of
// `boostSchedule` instead of importing the shared constant.
//
// ⚠ WHY THIS IS 7a AND NOT 7c, WHICH IS THE ORDERING INSIGHT OF THE WHOLE COMMIT. The next
// commit makes the referred stage derive from saved facts, and two production clients then move
// to `'paid'`. With the ladder still in place they would each have shown `+$500` against no
// ledger row. Nobody would have seen it — neither referrer has a `users` row — but "no one can
// currently see it" is a coincidence with a comment beside it, which this repo already records
// as a defect class. Retiring the ladder FIRST means the window never opens.
//
// ⚠ AND THIS IS THE SAME DEFECT THE PAYOUT AUDIT SPENT FIVE COMMITS ON, ONE SURFACE ALONG.
// That arc made every BALANCE surface read one source; the CARD was never in its scope, so a
// referrer could see a total no ledger row supported — the "$500 on one screen, $0 on another"
// reading arriving by a different route.
//
// ⚠ THE RESIDENT NON-NEGOTIABLE IS UNCHANGED AND THIS FINALLY OBEYS IT: never display a bonus
// dollar amount at `'sold'`; the amount comes from `referral_conversions.bonus_amount`. The rule
// always said that — the ladder was the thing contradicting it.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET.
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { request: _httpRequest } = require('node:http');

const referrerRouter = require('../routes/referrer');
const {
  seedContractor, seedUser, seedSession, startTestServer, stopTestServer,
} = require('./helpers');

const CONTRACTOR = 'accent-roofing';
const TOKEN = 'card-credited-bonus-token';
const REFERRER = 'Card Referrer';

function buildApp() {
  const express = require('express');
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '5mb' }));
  app.use('/', referrerRouter);
  return app;
}

function httpGet(port, p, token) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path: p, method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(body); } catch { /* non-JSON body */ }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('N4 commit 7a — the card reads the ledger, not a ladder', () => {
  let pool, server, port, userId;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(buildApp()));
  });

  after(async () => {
    referrerRouter._resetTestOverrides();
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    referrerRouter._resetTestOverrides();
    for (const t of [
      'payout_announcements', 'cashout_requests', 'referral_conversions', 'pipeline_cache',
      'activity_log', 'error_log', 'sessions', 'users', 'sync_state',
      'contractor_crm_settings', 'contractor_settings',
    ]) {
      await pool.query(`DELETE FROM ${t}`);
    }
    await seedContractor(pool, CONTRACTOR);
    // ⚠ A CONNECTED CRM IS REQUIRED OR THE ROUTE 503s BEFORE ITS BODY RUNS, and both cases below
    // would then pass against a payload that was never assembled — CLAUDE.md's vacuity shape #9.
    // `api_key`, not `oauth`: the oauth branch calls refreshTokenIfNeeded, which reaches Jobber.
    await pool.query(
      `INSERT INTO contractor_crm_settings
         (contractor_id, crm_type, connection_method, api_key, is_connected)
       VALUES ($1, 'jobber', 'api_key', 'test-key-card', true)
       ON CONFLICT (contractor_id) DO UPDATE
         SET crm_type='jobber', connection_method='api_key', api_key='test-key-card', is_connected=true`,
      [CONTRACTOR]
    );
    userId = await seedUser(pool, {
      fullName: REFERRER, email: 'card@bonus.test', contractorId: CONTRACTOR,
    });
    await seedSession(pool, { userId, token: TOKEN, role: 'referrer', contractorId: CONTRACTOR });
  });

  const seedPaid = (clientId) => pool.query(
    `INSERT INTO pipeline_cache
       (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
        pre_start_date, last_synced_at, jobber_created_at)
     VALUES ($1, $2, 'Paid Client', $3, 'paid', false, NOW(), NOW())`,
    [CONTRACTOR, clientId, REFERRER]
  );

  const seedConversion = (clientId, amount) => pool.query(
    `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, converted_at, bonus_amount)
     VALUES ($1, $2, $3, NOW(), $4)`,
    [userId, CONTRACTOR, clientId, amount]
  );

  const cardFor = async (clientId) => {
    const res = await httpGet(port, '/api/pipeline', TOKEN);
    assert.equal(res.status, 200, 'the pipeline route must answer 200');
    return (res.body.pipeline || []).find((p) => p.id === clientId);
  };

  it('a PAID referral with NO conversion row shows no amount at all', async () => {
    // ⚠ THE CASE THE LADDER FAILED. It computed `500 + boost` from the status alone, so this row
    // showed `+$500` that no ledger row supported.
    await seedPaid('gid-card-noconv');
    const item = await cardFor('gid-card-noconv');
    assert.ok(item, 'the client must appear in the pipeline');
    assert.equal(item.status, 'complete', 'the STAGE is still reported — only the amount waits');
    assert.equal(item.bonusEarned, true, 'and it is still bonus-eligible');
    assert.equal(item.payout, null, 'but NO payout may be shown before a conversion exists');
    assert.equal(item.conversion_bonus, null, 'and no confirmed bonus either');
  });

  it('a PAID referral WITH a conversion shows that conversion\'s EXACT amount', async () => {
    // ⚠ THE PAIRED POSITIVE, AND IT ASSERTS AN EXACT ODD VALUE RATHER THAN "a number". 737 cannot
    // be produced by `500 + boost` for any tier, so this cannot pass against the ladder — and a
    // round 500 would have been satisfied by both, which is the trap.
    await seedPaid('gid-card-conv');
    await seedConversion('gid-card-conv', 737.00);
    const item = await cardFor('gid-card-conv');
    assert.ok(item, 'the client must appear');
    assert.equal(Number(item.payout), 737, 'the payout is the ledger amount');
    assert.equal(Number(item.conversion_bonus), 737, 'and the confirmed figure agrees');
  });

  it('the BALANCE sums only confirmed conversions', async () => {
    await seedPaid('gid-card-a');
    await seedPaid('gid-card-b');
    await seedConversion('gid-card-a', 300.00);

    const res = await httpGet(port, '/api/pipeline', TOKEN);
    assert.equal(res.status, 200);
    // ⚠ 300, NOT 300 + a guess for the second row. Under the ladder this was
    // `conversionBonus ?? payout`, so an unconverted paid referral added a speculative 500.
    assert.equal(Number(res.body.balance), 300, 'an unconverted paid referral adds nothing');
  });

  it('NON-NEGOTIABLE: a SOLD referral carries no amount, and the paid one still does', async () => {
    await pool.query(
      `INSERT INTO pipeline_cache
         (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
          pre_start_date, last_synced_at, jobber_created_at)
       VALUES ($1, 'gid-card-sold', 'Sold Client', $2, 'sold', false, NOW(), NOW())`,
      [CONTRACTOR, REFERRER]
    );
    await seedPaid('gid-card-paid2');
    await seedConversion('gid-card-paid2', 611.00);

    const res = await httpGet(port, '/api/pipeline', TOKEN);
    const sold = (res.body.pipeline || []).filter((p) => p.status === 'sold');
    assert.ok(sold.length >= 1, 'precondition: a sold row must be present or this proves nothing');
    for (const p of sold) {
      assert.equal(p.bonusEarned, false, 'a sold item reports no earned bonus');
      assert.equal(p.payout, null, 'and carries no payout');
      assert.equal(p.conversion_bonus, null, 'and no confirmed bonus');
    }
    // PAIRED POSITIVE on the same payload, so the absences above are not a payload that never
    // populates these fields at all.
    const paid = (res.body.pipeline || []).find((p) => p.id === 'gid-card-paid2');
    assert.equal(Number(paid.payout), 611, 'the complete item DOES carry its ledger amount');
  });

  it('a PRE-START-DATE paid referral still earns nothing — that gate is untouched', async () => {
    await pool.query(
      `INSERT INTO pipeline_cache
         (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
          pre_start_date, last_synced_at, jobber_created_at)
       VALUES ($1, 'gid-card-pre', 'Pre Client', $2, 'paid', true, NOW(), NOW())`,
      [CONTRACTOR, REFERRER]
    );
    // Even with a conversion row present, pre_start_date suppresses the bonus — this commit
    // changes WHERE the amount comes from, never WHO qualifies.
    await seedConversion('gid-card-pre', 999.00);
    const item = await cardFor('gid-card-pre');
    assert.equal(item.bonusEarned, false, 'pre-start-date is still not bonus-eligible');
    assert.equal(item.payout, null, 'and carries no amount');
  });

  it('the STALE-CACHE FALLBACK also shows only the credited amount', async () => {
    // ⚠ THE SECOND COPY OF THE LADDER LIVED HERE, AND THIS PATH RUNS PRECISELY WHEN THE ADAPTER
    // HAS JUST FAILED — the moment nobody is checking the figures. Driving it behaviourally
    // rather than trusting the source fence alone, because "the other copy is gone" is a claim
    // about text until a request actually travels this branch.
    //
    // ⚠ HOW THE BRANCH IS REACHED: the route falls back when the adapter throws ANYTHING that is
    // not "No CRM connected" — that exact message returns 503 instead. An `oauth` connection with
    // no `tokens` row throws a different error, so it lands here.
    await pool.query(
      `UPDATE contractor_crm_settings
          SET connection_method = 'oauth', api_key = NULL
        WHERE contractor_id = $1`, [CONTRACTOR]);
    await pool.query(`DELETE FROM tokens WHERE contractor_id = $1`, [CONTRACTOR]);

    await seedPaid('gid-stale-noconv');
    await seedPaid('gid-stale-conv');
    await seedConversion('gid-stale-conv', 823.00);

    const res = await httpGet(port, '/api/pipeline', TOKEN);
    assert.equal(res.status, 200, 'the fallback must still answer 200');
    const items = res.body.pipeline || [];

    // ⚠ PRECONDITION: this must really be the FALLBACK, not the live path. If the adapter did not
    // throw, this case would be a duplicate of the live-path cases and would prove nothing about
    // the second copy of the ladder.
    assert.equal(res.body.stale, true, 'precondition: the response must be the stale-cache fallback');

    const noConv = items.find((p) => p.id === 'gid-stale-noconv');
    const withConv = items.find((p) => p.id === 'gid-stale-conv');
    assert.ok(noConv && withConv, 'both seeded clients must appear');
    assert.equal(noConv.payout, null, 'no conversion means no amount, on this path too');
    assert.equal(
      Number(withConv.payout), 823,
      'and a real conversion shows its exact amount — 823 is unreachable by 500 + boost'
    );
    assert.equal(Number(res.body.balance), 823, 'the fallback balance sums only confirmed conversions');
  });

  it('another tenant\'s conversion is never read', async () => {
    await seedContractor(pool, 'other-card-tenant');
    const otherUser = await seedUser(pool, {
      fullName: REFERRER, email: 'other@card.test', contractorId: 'other-card-tenant',
    });
    await seedPaid('gid-card-shared');
    await pool.query(
      `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, converted_at, bonus_amount)
       VALUES ($1, 'other-card-tenant', 'gid-card-shared', NOW(), 4242.00)`,
      [otherUser]
    );
    const item = await cardFor('gid-card-shared');
    assert.equal(item.payout, null, 'a conversion belonging to another contractor must not appear');
    assert.equal(item.conversion_bonus, null);
  });
});

describe('N4 commit 7a — the ladder is gone from both places', () => {
  const REPO_ROOT = path.join(__dirname, '..', '..');
  const strip = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

  // Needles assembled from pieces so this file cannot report itself.
  const LADDER = '500 ' + '+ boost';
  const SCHEDULE = 'boost' + 'Schedule';

  const SITES = ['server/crm/jobber.js', 'server/routes/referrer.js'];

  it('neither pipeline-card site computes a speculative payout', () => {
    for (const rel of SITES) {
      const src = strip(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
      assert.ok(
        !src.includes(LADDER),
        `${rel} still computes a payout from the boost ladder — the card must read `
        + 'referral_conversions.bonus_amount'
      );
    }
  });

  it('neither site references the boost schedule at all any more', () => {
    // ⚠ WIDER THAN THE LADDER EXPRESSION ON PURPOSE. A site that imported the constant and
    // computed `base + boostSchedule[n]` by another spelling would pass the needle above. And
    // the fallback carried its own INLINE array literal rather than importing, so a
    // dead-import check alone would have missed it.
    for (const rel of SITES) {
      const src = strip(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
      assert.ok(
        !src.includes(SCHEDULE),
        `${rel} still references the boost schedule — neither card site may compute an amount`
      );
    }
  });

  it('NON-VACUITY: the needles match their own synthetic cases, and the files were really read', () => {
    // Without this, a typo in either needle passes identically against both defects.
    assert.ok(`const p = ${LADDER};`.includes(LADDER), 'harness: the ladder needle must match');
    assert.ok(`const x = ${SCHEDULE}[0];`.includes(SCHEDULE), 'harness: the schedule needle must match');
    for (const rel of SITES) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      assert.ok(src.length > 1000, `harness: ${rel} must actually be read`);
      assert.ok(
        strip(src).includes('conversion_bonus'),
        `harness: ${rel} must still assemble the card payload — otherwise these absences are `
        + 'about a file that no longer does the job'
      );
    }
  });

  it('the shared constant itself survives — it is the ladder\'s USE that is retired', () => {
    // ⚠ THE CONSTANT IS NOT DEAD CODE. `server/constants/boostSchedule.js` is still the canonical
    // definition for whatever genuinely decides a payout, and its frontend mirror is referenced
    // by name in its own header. Deleting it would be a different and larger change, and this
    // commit's subject is the CARD.
    const src = fs.readFileSync(path.join(REPO_ROOT, 'server', 'constants', 'boostSchedule.js'), 'utf8');
    assert.ok(src.includes('[0, 100, 200, 250, 300, 350, 400]'), 'the canonical schedule still exists');
  });
});
