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

  it('[RED] ⚠ the window is measured from the ANCHOR, never from the previous job', async () => {
    // ⚠ THE CASE THAT SEPARATES "a sale" FROM "a chain", AND NO OTHER CASE CAN SEE IT.
    // Three jobs at day 0, 15 and 30. Measured from the ANCHOR: {0,15} and {30} — two
    // sales. Measured from the PREVIOUS member: all three chain into one, because each
    // is within 20 days of the one before. A client who buys steadily would otherwise
    // show ONE conversion forever.
    const sales = groupJobsIntoSales([
      job('j1', '2026-06-01T00:00:00Z'),
      job('j2', '2026-06-16T00:00:00Z'),
      job('j3', '2026-07-01T00:00:00Z'),
    ], 20);
    assert.equal(sales.length, 2, 'chaining from the previous job would give 1');
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
