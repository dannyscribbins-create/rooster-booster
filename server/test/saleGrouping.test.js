'use strict';

// ── CANVASS-STAGE: SALE GROUPING AND THE CONVERSIONS COUNT ──────────────────
//
// Ruling 1 (Danny, 2026-09-21): every individual sale is its own conversion, because
// the sale is what converts a client from not-sold to sold — but quotes and jobs
// within a short window are ONE sale.
//
// ⚠ THE ANCHOR IS JOB CREATED, and the window comes from the contractor's
// `invoice_window_days` so the admin control they can see means something.
//
// ⚠ THE WINDOW BECAME CHAINED ON 2026-09-22 (Danny), MEASURED FROM THE PREVIOUS JOB
// RATHER THAN THE SALE'S FIRST. One case in the first describe was INVERTED rather than
// added to, and says so in full. The last describe covers the one-off regroup that
// rewrites sales already stored under the old anchored rule — no Jobber call, because
// chaining can only ever merge them.
//
// ⚠ AND THE FENCE THIS FILE CARRIES IS THE ONE ABOUT MONEY: the grouping primitive is
// consumed by the REP CONVERSIONS path ONLY. Wiring it into evaluateReferral() would
// change how much referrers are PAID — its own ruling, never a side effect — so the
// last describe asserts evaluateReferral's behaviour is untouched.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { groupJobsIntoSales } = require('../utils/saleGrouping');
const { recomputeClientSales, windowDaysFor } = require('../utils/clientSales');

const TENANT = 'sale-group-a';
let pool;

const job = (id, iso) => ({ id, createdAt: iso });

before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  await pool.query('DELETE FROM client_sale_jobs');
  await pool.query('DELETE FROM client_sales');
  await pool.query('DELETE FROM referral_schedule_job_types');
  await pool.query('DELETE FROM referral_schedules');
  await pool.query('DELETE FROM jobber_clients');
  // ⚠ titles AND team_members BEFORE contractors — both carry a contractor_id FK, and
  // deleting the parent first raises 23503 in the HOOK, which fails every case in the
  // file including the pure-arithmetic ones that touch no database at all. That whole-
  // file signature is how a hook fault announces itself: a SUBJECT fault spares the
  // cases that do not depend on it.
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM titles');
  await pool.query('DELETE FROM team_members');
  await pool.query('DELETE FROM contractors');
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — the grouping primitive', () => {

  it('[RED] ⚠ TWO JOBS INSIDE THE WINDOW ARE ONE CONVERSION', async () => {
    // Danny's first discriminating case.
    const sales = groupJobsIntoSales(
      [job('j1', '2026-06-02T10:00:00Z'), job('j2', '2026-06-12T10:00:00Z')], 20);
    assert.equal(sales.length, 1);
    assert.deepEqual(sales[0].jobIds, ['j1', 'j2']);
    // ⚠ THE ANCHOR IS THE FIRST JOB, NOT THE LAST. A group dated by its newest member
    // would drift forward every time a job joined it, so a sale could move between
    // timeframe windows after the fact.
    assert.equal(sales[0].anchorAt.toISOString(), '2026-06-02T10:00:00.000Z');
    assert.equal(sales[0].lastEventAt.toISOString(), '2026-06-12T10:00:00.000Z');
  });

  it('[RED] ⚠ TWO JOBS OUTSIDE THE WINDOW ARE TWO CONVERSIONS', async () => {
    // Danny's second discriminating case. 21 days apart against a 20-day window —
    // deliberately ONE day outside, so an off-by-one in the comparison shows up here
    // rather than in production. The pair above is 10 days apart, comfortably inside.
    const sales = groupJobsIntoSales(
      [job('j1', '2026-06-02T10:00:00Z'), job('j2', '2026-06-23T10:00:00Z')], 20);
    assert.equal(sales.length, 2);
    assert.deepEqual(sales.map((s) => s.jobIds), [['j1'], ['j2']]);
  });

  it('[RED] ⚠ the window is measured from the PREVIOUS JOB — an add-on to an add-on is one sale', async () => {
    // ⚠ INVERTED 2026-09-22, DELIBERATELY, AND THIS IS THE CASE THAT DECIDES THE RULE.
    // It read *"the window is measured from the ANCHOR, never from the previous job"* and
    // asserted TWO sales here. Danny ruled the opposite: a job within 20 days of the
    // PREVIOUS job is a minor add-on or addendum to the same project, and an add-on to an
    // add-on is still that project. Three jobs at day 0, 15 and 30 are ONE sale; under the
    // old anchored rule they were {0,15} and {30}.
    // ⚠ The old rule's objection is real and was ACCEPTED, not answered: a chain has no
    // ceiling, so a client with a job every 19 days is one sale indefinitely. Unrealistic
    // for a roofer, and superseded when "completion ends a sale" can be built.
    const sales = groupJobsIntoSales([
      job('j1', '2026-06-01T00:00:00Z'),
      job('j2', '2026-06-16T00:00:00Z'),
      job('j3', '2026-07-01T00:00:00Z'),
    ], 20);
    assert.equal(sales.length, 1, 'anchoring on the first job would give 2');
    assert.deepEqual(sales[0].jobIds, ['j1', 'j2', 'j3']);
    // The anchor is still the FIRST job, so a sale cannot drift between timeframes.
    assert.equal(sales[0].anchorAt.toISOString(), '2026-06-01T00:00:00.000Z');
    assert.equal(sales[0].lastEventAt.toISOString(), '2026-07-01T00:00:00.000Z');
  });

  it('[RED] ⚠ 21 days after the PREVIOUS job is a new sale, even inside the first job\'s window', async () => {
    // The paired negative, and it is the one that fails if the chain is measured from the
    // anchor: day 0, day 12, day 33. 33 is 21 days after 12 — a new sale — while an
    // anchored 20-day window would also split it, so the DISCRIMINATING half is the
    // second sale carrying j3 ALONE and the first carrying two.
    const sales = groupJobsIntoSales([
      job('j1', '2026-06-01T00:00:00Z'),
      job('j2', '2026-06-13T00:00:00Z'),
      job('j3', '2026-07-04T00:00:00Z'),
    ], 20);
    assert.equal(sales.length, 2);
    assert.deepEqual(sales.map((s) => s.jobIds), [['j1', 'j2'], ['j3']]);
  });

  it('[RED] input order does not change the answer', async () => {
    // The grouping sorts; a caller that paged newest-first must not get a different
    // number of sales from one that paged oldest-first.
    const forward = groupJobsIntoSales(
      [job('j1', '2026-06-02T10:00:00Z'), job('j2', '2026-06-12T10:00:00Z')], 20);
    const reverse = groupJobsIntoSales(
      [job('j2', '2026-06-12T10:00:00Z'), job('j1', '2026-06-02T10:00:00Z')], 20);
    assert.deepEqual(reverse.map((s) => s.jobIds), forward.map((s) => s.jobIds));
  });

  it('[RED] a job with no createdAt is dropped, not anchored at the epoch', async () => {
    // Defaulting an undated job to 0 would open a 1970 sale that groups nothing and
    // counts as one — a conversion the contractor never made.
    const sales = groupJobsIntoSales(
      [job('j1', '2026-06-02T10:00:00Z'), { id: 'j2', createdAt: null }], 20);
    assert.equal(sales.length, 1);
    assert.deepEqual(sales[0].jobIds, ['j1']);
  });

  it('[RED] ⚠ a window of 0 means every job is its own sale, and is NOT replaced by 20', async () => {
    // `|| 20` would silently apply a window the contractor did not choose to their
    // money. Only an unusable value falls back.
    const sales = groupJobsIntoSales(
      [job('j1', '2026-06-02T10:00:00Z'), job('j2', '2026-06-02T11:00:00Z')], 0);
    assert.equal(sales.length, 2, 'a 0-day window must group nothing');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — persisting sales', () => {

  const salesFor = async (clientId) => {
    const { rows } = await pool.query(
      `SELECT cs.id, cs.anchor_at, COUNT(csj.jobber_job_id)::int AS jobs
         FROM client_sales cs
         LEFT JOIN client_sale_jobs csj ON csj.sale_id = cs.id
        WHERE cs.contractor_id = $1 AND cs.jobber_client_id = $2
        GROUP BY cs.id ORDER BY cs.anchor_at`,
      [TENANT, clientId]);
    return rows;
  };

  it('[RED] a recompute writes one row per sale with its job membership', async () => {
    await recomputeClientSales(pool, {
      contractorId: TENANT, jobberClientId: 'c1', windowDays: 20,
      jobs: [job('j1', '2026-06-02T10:00:00Z'), job('j2', '2026-06-12T10:00:00Z'), job('j3', '2026-08-01T10:00:00Z')],
    });
    const rows = await salesFor('c1');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].jobs, 2);
    assert.equal(rows[1].jobs, 1);
  });

  it('[RED] ⚠ a recompute is IDEMPOTENT — running it twice does not double the sales', async () => {
    // Every JOB_CREATE webhook recomputes, and Jobber is at-least-once.
    const args = {
      contractorId: TENANT, jobberClientId: 'c1', windowDays: 20,
      jobs: [job('j1', '2026-06-02T10:00:00Z'), job('j2', '2026-08-01T10:00:00Z')],
    };
    await recomputeClientSales(pool, args);
    await recomputeClientSales(pool, args);
    assert.equal((await salesFor('c1')).length, 2);
  });

  it('[RED] ⚠ a new job inside an older window MERGES two sales rather than leaving three', async () => {
    // ⚠ THE CASE DELETE-THEN-INSERT EXISTS FOR, and a diff-based writer would get it
    // wrong. First pass: two jobs 40 days apart are two sales. Then a job lands between
    // them, inside the FIRST one's window — the middle job joins sale 1, and the count
    // must stay 2 rather than becoming 3.
    await recomputeClientSales(pool, {
      contractorId: TENANT, jobberClientId: 'c1', windowDays: 20,
      jobs: [job('j1', '2026-06-01T00:00:00Z'), job('j3', '2026-07-11T00:00:00Z')],
    });
    assert.equal((await salesFor('c1')).length, 2, 'precondition: two separate sales');

    await recomputeClientSales(pool, {
      contractorId: TENANT, jobberClientId: 'c1', windowDays: 20,
      jobs: [job('j1', '2026-06-01T00:00:00Z'), job('j2', '2026-06-10T00:00:00Z'), job('j3', '2026-07-11T00:00:00Z')],
    });
    const rows = await salesFor('c1');
    assert.equal(rows.length, 2, 'the new job joined an existing sale');
    assert.equal(rows[0].jobs, 2, 'and it joined the FIRST one');
  });

  it('[RED] the contractor\'s own invoice_window_days is what gets used', async () => {
    // ⚠ THE ADMIN CONTROL MUST MEAN SOMETHING. The same two jobs group differently
    // under two different contractor settings, which is the only way to prove the value
    // is read rather than a constant.
    await pool.query(
      `INSERT INTO referral_schedules (contractor_id, name, is_active, payout_model, invoice_window_days)
       VALUES ($1, 'S', true, 'flat', 45)`, [TENANT]);
    assert.equal(await windowDaysFor(pool, TENANT), 45);

    const under45 = groupJobsIntoSales(
      [job('j1', '2026-06-01T00:00:00Z'), job('j2', '2026-07-01T00:00:00Z')], 45);
    const under20 = groupJobsIntoSales(
      [job('j1', '2026-06-01T00:00:00Z'), job('j2', '2026-07-01T00:00:00Z')], 20);
    assert.equal(under45.length, 1, '30 days apart is ONE sale at a 45-day window');
    assert.equal(under20.length, 2, 'and TWO at a 20-day window');
  });

  it('[RED] with no schedule at all the window falls back to 20', async () => {
    assert.equal(await windowDaysFor(pool, TENANT), 20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — THE MONEY FENCE: evaluateReferral is untouched', () => {

  it('[RED] ⚠ evaluateReferral() does not consume the grouping primitive', async () => {
    // ⚠ THE RULING: the grouping primitive is consumed by the REP CONVERSIONS path
    // ONLY. Wiring it into evaluateReferral() changes how much referrers are PAID, and
    // that is its own ruling rather than a side effect of a rep feature.
    //
    // ⚠ A SOURCE-TEXT FENCE, BECAUSE A BEHAVIOURAL ONE CANNOT SEE THIS. evaluateReferral
    // would keep returning the same payouts for every fixture that does not straddle a
    // window, so a behavioural test would pass for a long time against a wired-in
    // grouping and then start paying differently on a case nobody seeded.
    const src = fs.readFileSync(path.join(__dirname, '..', 'referralRules.js'), 'utf8');
    assert.ok(!/saleGrouping|groupJobsIntoSales|clientSales|client_sales/.test(src),
      'referralRules must not import or read the sale-grouping primitive');
  });

  it('[RED] and referral_conversions keeps its one-per-person constraint', async () => {
    // ⚠ THE TWO NUMBERS MEASURE DIFFERENT THINGS, DELIBERATELY. A rep's conversions
    // count SALES, repeats included; a referrer's payouts count PEOPLE REFERRED — a
    // referred person's FIRST sale pays once and later sales pay nothing further.
    // This constraint is what enforces that, and it is in Never Break These Rules.
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'referral_conversions' AND c.contype = 'u'`);
    assert.ok(rows[0].n >= 1, 'referral_conversions must keep a UNIQUE constraint');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Chained regroup — rewriting sales written under the ANCHORED rule (2026-09-22)', () => {
  const regroup = require('../jobs/saleRegroupBackfill');
  const axios = require('axios');

  // Writes the rows the OLD anchored rule would have produced, without going through the
  // grouping primitive — which now chains, and so could never produce them again.
  // ⚠ THAT IS THE POINT: the fixture must be the PRE-CHANGE state, not today's output.
  async function seedAnchoredSales(clientId, groups) {
    for (const g of groups) {
      const { rows } = await pool.query(
        `INSERT INTO client_sales (contractor_id, jobber_client_id, anchor_at, last_event_at)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [TENANT, clientId, g.anchor, g.last]);
      for (const jobId of g.jobIds) {
        await pool.query(
          `INSERT INTO client_sale_jobs (sale_id, contractor_id, jobber_job_id) VALUES ($1, $2, $3)`,
          [rows[0].id, TENANT, jobId]);
      }
    }
  }
  const salesOf = async (clientId) => (await pool.query(
    `SELECT cs.anchor_at, cs.last_event_at,
            (SELECT COUNT(*)::int FROM client_sale_jobs j WHERE j.sale_id = cs.id) AS jobs
       FROM client_sales cs WHERE cs.contractor_id = $1 AND cs.jobber_client_id = $2
      ORDER BY cs.anchor_at`, [TENANT, clientId])).rows;

  it('[RED] ⚠ merges the day 0 / 15 / 30 split into ONE sale, keeping every job', async () => {
    // The anchored rule wrote {0,15} and {30}; chained-20 is one sale. This is the
    // production state on Accent, where 14 sales opened within 20 days of the previous
    // sale's last job.
    await seedAnchoredSales('c1', [
      { anchor: '2026-06-01T00:00:00Z', last: '2026-06-16T00:00:00Z', jobIds: ['j1', 'j2'] },
      { anchor: '2026-07-01T00:00:00Z', last: '2026-07-01T00:00:00Z', jobIds: ['j3'] },
    ]);
    const totals = await regroup.regroupContractor(pool, { contractorId: TENANT });
    assert.deepEqual({ clients: totals.clients, merged: totals.merged, failed: totals.failed },
      { clients: 1, merged: 1, failed: 0 });
    const rows = await salesOf('c1');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].jobs, 3, '⚠ the absorbed sale\'s jobs MOVED — the cascade did not eat them');
    assert.equal(rows[0].anchor_at.toISOString(), '2026-06-01T00:00:00.000Z', 'the earlier anchor survives');
    assert.equal(rows[0].last_event_at.toISOString(), '2026-07-01T00:00:00.000Z', 'and the later last_event');
  });

  it('[RED] ⚠ a REAL gap is left alone, and the run makes NO Jobber call', async () => {
    // The paired negative. 21 days after the previous sale's last job stays two sales —
    // without it, "merged everything" would pass the case above just as well.
    const realPost = axios.post;
    let jobberCalls = 0;
    axios.post = async (...args) => { jobberCalls += 1; return realPost(...args); };
    try {
      await seedAnchoredSales('c2', [
        { anchor: '2026-06-01T00:00:00Z', last: '2026-06-13T00:00:00Z', jobIds: ['k1', 'k2'] },
        { anchor: '2026-07-04T00:00:00Z', last: '2026-07-04T00:00:00Z', jobIds: ['k3'] },
      ]);
      const totals = await regroup.regroupContractor(pool, { contractorId: TENANT });
      assert.deepEqual({ clients: totals.clients, merged: totals.merged }, { clients: 0, merged: 0 });
      assert.deepEqual((await salesOf('c2')).map((r) => r.jobs), [2, 1]);
    } finally {
      axios.post = realPost;
    }
    assert.equal(jobberCalls, 0, 'the regroup reads stored sales only');
  });

  it('[RED] ⚠ a THREE-sale chain collapses to one — merging is transitive', async () => {
    // Each sale opens within 20 days of the previous one's last job, so the whole chain
    // is one project. A pairwise pass that did not carry the growing end forward would
    // leave two.
    await seedAnchoredSales('c3', [
      { anchor: '2026-06-01T00:00:00Z', last: '2026-06-05T00:00:00Z', jobIds: ['m1'] },
      { anchor: '2026-06-20T00:00:00Z', last: '2026-06-24T00:00:00Z', jobIds: ['m2'] },
      { anchor: '2026-07-10T00:00:00Z', last: '2026-07-10T00:00:00Z', jobIds: ['m3'] },
    ]);
    await regroup.regroupContractor(pool, { contractorId: TENANT });
    const rows = await salesOf('c3');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].jobs, 3);
    assert.equal(rows[0].last_event_at.toISOString(), '2026-07-10T00:00:00.000Z');
  });

  it('[RED] ⚠ IDEMPOTENT — a second run finds nothing, which is what makes it safe at every boot', async () => {
    await seedAnchoredSales('c4', [
      { anchor: '2026-06-01T00:00:00Z', last: '2026-06-16T00:00:00Z', jobIds: ['n1', 'n2'] },
      { anchor: '2026-07-01T00:00:00Z', last: '2026-07-01T00:00:00Z', jobIds: ['n3'] },
    ]);
    const first = await regroup.regroupContractor(pool, { contractorId: TENANT });
    const second = await regroup.regroupContractor(pool, { contractorId: TENANT });
    assert.equal(first.merged, 1);
    assert.deepEqual({ clients: second.clients, merged: second.merged }, { clients: 0, merged: 0 });
    assert.equal((await salesOf('c4')).length, 1, 'and the merged sale is not merged again');
  });

  it('[RED] ⚠ MIXED GAPS — the near pair merges and the far sale is LEFT, on one client', async () => {
    // ⚠ THE CASE THAT FOUND A VACUOUS NEGATIVE, AND IT IS WHY IT EXISTS. The "a REAL gap
    // is left alone" case above is decided ENTIRELY by the pre-filter query: that client
    // has no mergeable pair, so it is never selected and the per-sale condition never
    // runs. Making that condition merge unconditionally left the whole file GREEN.
    // Here the client IS selected (the first pair is near), so the per-sale condition has
    // to decide the third sale on its own — and merging everything fails here.
    await seedAnchoredSales('c7', [
      { anchor: '2026-06-01T00:00:00Z', last: '2026-06-06T00:00:00Z', jobIds: ['r1'] },
      { anchor: '2026-06-20T00:00:00Z', last: '2026-06-24T00:00:00Z', jobIds: ['r2'] },
      { anchor: '2026-09-01T00:00:00Z', last: '2026-09-01T00:00:00Z', jobIds: ['r3'] },
    ]);
    const totals = await regroup.regroupContractor(pool, { contractorId: TENANT });
    assert.equal(totals.merged, 1, 'exactly one merge — not two');
    const rows = await salesOf('c7');
    assert.deepEqual(rows.map((r) => r.jobs), [2, 1]);
    assert.equal(rows[1].anchor_at.toISOString(), '2026-09-01T00:00:00.000Z', 'the far sale kept its own anchor');
  });

  it('[RED] the contractor\'s own window decides the merge', async () => {
    // 30 days between the sales: untouched at 20, merged at 45. The only way to prove
    // the setting is read rather than a constant.
    await pool.query(
      `INSERT INTO referral_schedules (contractor_id, name, is_active, payout_model, invoice_window_days)
       VALUES ($1, 'S', true, 'flat', 45)`, [TENANT]);
    await seedAnchoredSales('c5', [
      { anchor: '2026-06-01T00:00:00Z', last: '2026-06-01T00:00:00Z', jobIds: ['p1'] },
      { anchor: '2026-07-01T00:00:00Z', last: '2026-07-01T00:00:00Z', jobIds: ['p2'] },
    ]);
    const totals = await regroup.regroupContractor(pool, { contractorId: TENANT });
    assert.equal(totals.windowDays, 45);
    assert.equal((await salesOf('c5')).length, 1, 'one sale at 45 days');
  });

  it('[RED] ⚠ THE MONEY FENCE — a regroup writes no referral row and touches no cashout', async () => {
    // The grouping change moves REP numbers only. If a later edit wired the regroup into
    // the payout path, this is where it shows up.
    const before = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM referral_conversions) AS conv,
              (SELECT COUNT(*)::int FROM cashout_requests) AS cash`);
    await seedAnchoredSales('c6', [
      { anchor: '2026-06-01T00:00:00Z', last: '2026-06-16T00:00:00Z', jobIds: ['q1', 'q2'] },
      { anchor: '2026-07-01T00:00:00Z', last: '2026-07-01T00:00:00Z', jobIds: ['q3'] },
    ]);
    await regroup.regroupContractor(pool, { contractorId: TENANT });
    const after = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM referral_conversions) AS conv,
              (SELECT COUNT(*)::int FROM cashout_requests) AS cash`);
    assert.deepEqual(after.rows[0], before.rows[0]);
  });
});
