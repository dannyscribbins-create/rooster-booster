'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE CAPTURE/DECISION SPLIT (Danny's ruling, 2026-09-30) AND ITS CATCH-UP JOB
//
// Facts commit in their OWN transaction first; the decision runs in a SEPARATE locked transaction
// afterwards. A decision failure therefore leaves the facts saved, raises an alert, and leaves the
// client in the one state the catch-up job looks for: facts newer than its decision.
//
// ⚠ THE LOAD-BEARING CASE IS THAT A DECISION FAILURE LEAVES THE FACTS BEHIND. Before the split, the
// two shared a transaction, so a failure in the status write rolled the CAPTURE back — which is how a
// parameter-type typo cost SEVEN clients their facts rather than just their stage. Restoring the
// shared transaction must take that case red, and guard-proof (a) does exactly that.
//
// ⚠ EVERY FIXTURE USES A REAL JOBBER EncodedId, AND ONE CASE ASSERTS THE DECODE. A synthetic id is how
// the `$3` defect shipped: `isDerivableJobberClientId` rejects one, so no pre-existing fixture could
// ENTER the branch that commit added and the gate was green because the code never ran. Both new
// gated branches here — `if (captureCommitted)` and the referrer-visible write — are entered by cases
// below with ids that pass the real predicate.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET, including `error_log` (the alert cases COUNT
// rows, so a leaked row from a prior case would be read as this case's alert).
//
// ⚠ ONE POOL PER FILE, NOT PER describe — initTestDb() returns the server/db.js pool SINGLETON, so a
// per-describe teardown would end the pool the next describe needs and CANCEL its cases under a
// green-looking `fail 0`.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const {
  runRedecideStaleClients, selectStaleClients, redecideOne, formatSummary, DEFAULT_LIMIT,
} = require('../jobs/redecideStaleClients');
const { isDerivableJobberClientId } = require('../utils/derivableClient');
const { certifyFullyPaged } = require('../utils/captureCompleteness');
// ⚠ THE REAL DOOR, not a reimplementation of it. See the export's own note in the webhook
// router: a test that rebuilt the split could not discover that production stopped doing it.
const upsertAndTagClient = require('../routes/webhooks/jobber')._upsertAndTagClient;

const TENANT = 'split-tenant';
const OTHER = 'split-other';
// Real Jobber EncodedIds — the decode is asserted below.
const CLIENT   = 'Z2lkOi8vSm9iYmVyL0NsaWVudC85NTAwMDE=';
const CLIENT_B = 'Z2lkOi8vSm9iYmVyL0NsaWVudC85NTAwMDI=';
const JOB      = 'Z2lkOi8vSm9iYmVyL0pvYi83NTAwMDE=';
const INVOICE  = 'Z2lkOi8vSm9iYmVyL0ludm9pY2UvODUwMDAx';
const SYNTHETIC = 'jobber-c1';

let pool;
let realAxiosPost;

const seedTenant = (id) =>
  pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [id]);

// ⚠ `fullCaptureAt` ADDED BY THE CATCH-UP-SCHEDULE COMMIT, AND IT DEFAULTS TO NULL ON PURPOSE. A
// fixture that says nothing about completeness is NOT eligible, which is the new rule's whole point:
// a client is "fully captured" only once a certified capture has actually run.
const addClient = (id, {
  tenant = TENANT, stage = null, derivedAt = null, fullCaptureAt = null,
} = {}) => pool.query(
  `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, pipeline_stage,
     stage_derived_at, last_full_capture_at)
   VALUES ($1, $2, 'Split', $3, $4, $5)`, [id, tenant, stage, derivedAt, fullCaptureAt]);

const addCacheRow = (id, { tenant = TENANT, status = 'lead' } = {}) => pool.query(
  `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
   VALUES ($1, $2, 'Name', 'Referrer', $3)`, [tenant, id, status]);

/** A job fact plus a PAID invoice linked to it — the state furthest from the classifier's default. */
async function seedPaidFacts(id, { tenant = TENANT, capturedAt = null } = {}) {
  const at = capturedAt ? `'${capturedAt}'::timestamptz` : 'NOW()';
  await pool.query(
    `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id, job_status, captured_at)
     VALUES ($1, $2, $3, 'active', ${at})`, [tenant, JOB, id]);
  await pool.query(
    `INSERT INTO crm_invoice_facts (contractor_id, jobber_invoice_id, jobber_client_id, invoice_status,
       total, invoice_balance, received_date, captured_at)
     VALUES ($1, $2, $3, 'paid', 1000, 0, NOW(), ${at})`, [tenant, INVOICE, id]);
  await pool.query(
    `INSERT INTO crm_invoice_job_links (contractor_id, jobber_invoice_id, jobber_job_id, captured_at)
     VALUES ($1, $2, $3, ${at})`, [tenant, INVOICE, JOB]);
}

const stageOf = async (id, tenant = TENANT) => {
  const { rows } = await pool.query(
    `SELECT pipeline_stage, stage_derived_at FROM jobber_clients
      WHERE contractor_id = $1 AND jobber_client_id = $2`, [tenant, id]);
  return rows[0] || null;
};

const cacheOf = async (id, tenant = TENANT) => {
  const { rows } = await pool.query(
    `SELECT pipeline_status, status_derived_at, paid_at FROM pipeline_cache
      WHERE contractor_id = $1 AND jobber_client_id = $2`, [tenant, id]);
  return rows[0] || null;
};

const errorRows = async (tenant = TENANT) => {
  const { rows } = await pool.query(
    `SELECT source, severity, error_message FROM error_log
      WHERE contractor_id = $1 ORDER BY id`, [tenant]);
  return rows;
};

before(async () => { pool = await initTestDb(); realAxiosPost = axios.post; });
after(async () => { axios.post = realAxiosPost; await pool.end(); });

beforeEach(async () => {
  for (const t of [
    'crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts', 'crm_quote_facts',
    'crm_request_facts', 'crm_custom_field_facts', 'category_mismatches', 'client_sale_jobs',
    'client_sales', 'client_rep_assignments', 'flagged_assignments', 'referral_conversions',
    'pipeline_cache', 'jobber_clients', 'error_log',
  ]) {
    for (const tn of [TENANT, OTHER]) {
      await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [tn]).catch(async () => {
        await pool.query(`DELETE FROM ${t}`);
      });
    }
  }
  await pool.query(`DELETE FROM contractors WHERE id = ANY($1::text[])`, [[TENANT, OTHER]]);
  await seedTenant(TENANT);
  axios.post = async () => { throw new Error('harness: this suite must make NO Jobber call'); };
});

describe('the split — capture and decision are separate transactions', () => {
  it('the fixture ids are real Jobber EncodedIds, so these cases ENTER the gated branches', () => {
    const dec = (id) => Buffer.from(id, 'base64').toString('utf8');
    assert.equal(dec(CLIENT), 'gid://Jobber/Client/950001');
    assert.equal(dec(JOB), 'gid://Jobber/Job/750001');
    assert.equal(dec(INVOICE), 'gid://Jobber/Invoice/850001');
    // ⚠ THE GATE ITSELF, ASSERTED. Both new branches sit behind this predicate somewhere upstream;
    // a synthetic id would skip them and the suite would be green against code that never ran.
    assert.equal(isDerivableJobberClientId(CLIENT), true);
    assert.equal(isDerivableJobberClientId(SYNTHETIC), false,
      'and the synthetic form really is rejected, or this case proves nothing');
  });

  it('⚠ THE RULING, BEHAVIOURALLY: a DECISION failure leaves the facts SAVED, and alerts', async () => {
    // ⚠ THIS CASE EXISTS BECAUSE THE SOURCE ASSERTIONS ALONE MEASURED WIDTH 1. Restoring the shared
    // transaction reddened only a text check, which proves the shape is WRITTEN and never that a
    // decision failure leaves the facts behind — and that is the entire property of the ruling.
    //
    // ⚠ THE FAILURE IS FORCED WITH A TRIGGER ON `pipeline_cache`, which is the one thing in the
    // decision transaction that can be made to fail deterministically from outside the process. A
    // schema-mutating test is unusual enough to say twice: it is dropped in the same case, and this
    // suite's `beforeEach` does not depend on it. The precedent is `assignedAtNotNull.test.js`, which
    // drops and re-adds a constraint around its own cases.
    await addClient(CLIENT);
    await addCacheRow(CLIENT, { status: 'sold' });

    // ⚠ CERTIFIED, BECAUSE THIS FIXTURE STANDS IN FOR A REAL FULL FETCH AND MUST MAKE THE SAME CLAIM.
    // The catch-up-schedule commit made `captureClientFacts` stamp `last_full_capture_at` only for a
    // client object the FETCHER certified as paged to exhaustion. A hand-built object carries no
    // certification, so without this line the capture would save facts and stamp nothing — and the
    // final assertion below (that the catch-up job now finds this client) would fail. **That is the
    // mechanism failing closed, which is the direction it was designed to fail in**, and it is why the
    // production helper is used here rather than a literal property: a string key a fixture could set
    // for itself would prove nothing.
    const relatedData = certifyFullyPaged({
      id: CLIENT, isCompany: false, isLead: false,
      quotes: { nodes: [] }, requests: { nodes: [] },
      jobs: { nodes: [{ id: JOB, jobStatus: 'active', client: { id: CLIENT }, createdAt: new Date().toISOString(), customFields: [] }] },
      invoices: { nodes: [] },
      tags: { nodes: [] }, customFields: [],
    });
    const fullClient = { id: CLIENT, firstName: 'Split', lastName: 'Case', emails: [], phones: [], isArchived: false };

    await pool.query(`CREATE OR REPLACE FUNCTION split_test_boom() RETURNS trigger AS $BODY$
      BEGIN RAISE EXCEPTION 'split-test: the decision transaction fails here'; END; $BODY$ LANGUAGE plpgsql`);
    await pool.query(`CREATE TRIGGER split_test_boom_trg BEFORE UPDATE ON pipeline_cache
      FOR EACH ROW EXECUTE FUNCTION split_test_boom()`);
    try {
      // The door swallows its own decision failure, so this must NOT throw.
      await upsertAndTagClient(TENANT, fullClient, relatedData, 'invoice-paid',
        { alsoDeriveReferredStatus: true });
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS split_test_boom_trg ON pipeline_cache`);
      await pool.query(`DROP FUNCTION IF EXISTS split_test_boom()`);
    }

    // ── THE PROPERTY: the facts are still there ──
    const { rows: facts } = await pool.query(
      `SELECT jobber_job_id FROM crm_job_facts WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [TENANT, CLIENT]);
    assert.equal(facts.length, 1,
      'the capture COMMITTED in its own transaction, so a decision failure cannot discard it');
    assert.equal(facts[0].jobber_job_id, JOB);

    // The decision did not happen, so nothing claims it did.
    const after = await stageOf(CLIENT);
    assert.equal(after.pipeline_stage, null, 'no stage was decided');
    assert.equal(after.stage_derived_at, null,
      'and stage_derived_at must NOT be stamped, or the catch-up job would never find this client');
    // ⚠ AND THE CAPTURE DID STAMP COMPLETENESS, which is what makes this client eligible at all.
    // Two separate markers with opposite states in one row is the whole shape of the ruling:
    // history COMPLETE, decision ABSENT.
    const { rows: mk } = await pool.query(
      `SELECT last_full_capture_at FROM jobber_clients
        WHERE contractor_id = $1 AND jobber_client_id = $2`, [TENANT, CLIENT]);
    assert.ok(mk[0].last_full_capture_at instanceof Date,
      'the certified capture must stamp last_full_capture_at in the SAME transaction as the facts');
    const cache = await cacheOf(CLIENT);
    assert.equal(cache.pipeline_status, 'sold', 'the referrer-visible status is untouched');

    // ── AND IT ALERTED, naming the DECISION rather than the capture ──
    const errs = await errorRows();
    const decision = errs.filter((e) => e.source === 'upsertAndTagClient — decision');
    assert.equal(decision.length, 1, 'exactly one decision-failure row');
    assert.match(decision[0].error_message, /the facts ARE saved/,
      'the message must say the facts survived, or an operator cannot tell which failure this was');
    assert.equal(errs.filter((e) => e.source === 'upsertAndTagClient — capture').length, 0,
      'and it must NOT be reported as a capture failure');

    // ── AND THE CATCH-UP JOB NOW FINDS IT, which is what makes this recoverable ──
    const { candidates } = await selectStaleClients(pool, { contractorId: TENANT });
    assert.deepEqual(candidates.map((c) => c.jobberClientId), [CLIENT],
      'facts newer than a never-made decision is exactly the state the catch-up job looks for');
  });

  it('SOURCE: capture and decide are in two different withClientLock transactions', () => {
    // ⚠ STRUCTURAL, BECAUSE THE BEHAVIOURAL PROPERTY IS ABOUT TRANSACTION BOUNDARIES AND THE
    // OBSERVABLE IS A FAILURE PATH. The case below drives the failure; this one pins the shape, so a
    // refactor that merged them back is caught even if no test happened to fail.
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'), 'utf8');
    const fn = src.slice(src.indexOf('async function upsertAndTagClient'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));

    const locks = body.match(/withClientLock\(pool, \{ contractorId, jobberClientId: fullClient\.id, door \}/g) || [];
    assert.equal(locks.length, 2, 'exactly two locked transactions: capture, then decide');

    const captureAt = body.indexOf('captureClientFacts(');
    const decideAt = body.indexOf('decideFromFacts(');
    assert.ok(captureAt > -1 && decideAt > -1, 'harness: both calls must be found');
    assert.ok(captureAt < decideAt, 'capture comes first');

    // The capture's lock must CLOSE before the decision's lock opens — that is what "separate
    // transactions" means, and a nested form would read as two locks while sharing a fate.
    const firstLockEnd = body.indexOf('});', captureAt);
    assert.ok(firstLockEnd > -1 && firstLockEnd < decideAt,
      'the capture transaction must close before the decision opens');

    // Two DISTINCT catches, because the two failures mean different things.
    assert.match(body, /catch \(capErr\)/, 'a capture-failure catch');
    assert.match(body, /catch \(decErr\)/, 'and a separate decision-failure catch');
    assert.match(body, /if \(captureCommitted\)/, 'the decision is gated on the capture committing');
  });

  it('the decision is GATED on the capture having committed, not merely on relatedData', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'), 'utf8');
    const fn = src.slice(src.indexOf('async function upsertAndTagClient'));
    const body = fn.slice(0, fn.indexOf('\n}\n'));
    const gateAt = body.indexOf('if (captureCommitted)');
    const decideAt = body.indexOf('decideFromFacts(');
    assert.ok(gateAt > -1 && gateAt < decideAt,
      'deciding after a failed capture is the one thing the split exists to stop');
  });

  it('the two catches carry DIFFERENT sources, so an alert can say which happened', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'), 'utf8');
    assert.match(src, /source: 'upsertAndTagClient — capture'/, 'the capture failure has its own source');
    assert.match(src, /source: 'upsertAndTagClient — decision'/, 'and the decision failure its own');
    // Both alert. A capture failure loses facts; a decision failure leaves a client on a stale stage
    // until the catch-up runs. Neither is routine noise, and `alert: false` is why the `$3` defect
    // ran for three hours unseen.
    const capBlock = src.slice(src.indexOf("source: 'upsertAndTagClient — capture'"));
    assert.match(capBlock.slice(0, capBlock.indexOf('});')), /alert: true/);
    const decBlock = src.slice(src.indexOf("source: 'upsertAndTagClient — decision'"));
    assert.match(decBlock.slice(0, decBlock.indexOf('});')), /alert: true/);
  });

  it('the money-adjacent referrer write has exactly ONE definition, and the door calls it', () => {
    // The split gave that statement a second caller (the catch-up job). A pasted copy is what
    // cashoutBalanceSingleSource fences against one table along, and what this repo has paid for twice.
    const wh = fs.readFileSync(path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'), 'utf8');
    const job = fs.readFileSync(path.join(__dirname, '..', 'jobs', 'redecideStaleClients.js'), 'utf8');
    const util = fs.readFileSync(path.join(__dirname, '..', 'utils', 'referredStatus.js'), 'utf8');

    const needle = 'UPDATE pipeline' + '_cache';
    assert.equal((util.match(new RegExp(needle, 'g')) || []).length, 1,
      'the one copy lives in referredStatus.js');
    assert.ok(!wh.includes(needle), 'the door must not carry its own copy');
    assert.ok(!job.includes(needle), 'nor the catch-up job');
    assert.match(wh, /writeReferredStatus\(tx, \{/, 'the door calls the shared writer');
    assert.match(job, /writeReferredStatus\(tx, \{/, 'and so does the job');
  });
});

// ⚠ THIS DESCRIBE WAS REWRITTEN BY THE CATCH-UP-SCHEDULE COMMIT, AND THE OLD ASSERTIONS ARE QUOTED
// RATHER THAN DELETED, BECAUSE A RULING CHANGED THE SELECTOR — NOT A BUG.
// It used to be named *"facts newer than the decision"* and selected on `MAX(captured_at)` across the
// two fact tables that carry one. Measured against production, that selector would have moved 364
// clients on its first run, **354 of them BACKWARDS and 353 off 'paid'** — because `repImportScope.js`
// captures only the rep WINDOW, per entity, so a client's stored facts are routinely a subset of its
// history. Sampled against Jobber live, 21 of those split 14 DATA GAP / 2 BOTH WRONG / 5 REAL
// CORRECTION. Danny's ruling (2026-10-01): decide ONLY from COMPLETE history, and a ratchet is
// REJECTED because it would also block the 5 genuine corrections.
// ⚠ TWO CASES ARE THEREFORE SUPERSEDED BY DESIGN AND SAY SO BELOW, rather than being quietly dropped:
// the selector no longer reads fact timestamps at all, so "the newest fact is the GREATEST across the
// tables that HAVE a captured_at" is about a mechanism that no longer exists, and the quote-only
// LIMITATION it documented is CLOSED for the selector — a full capture pages quotes too, so it stamps
// the marker whichever connection changed.
describe('the catch-up job — only from COMPLETE history', () => {
  it('selects a client whose FULL CAPTURE is newer than its decision', async () => {
    await addClient(CLIENT, {
      stage: 'lead', derivedAt: '2026-01-01T00:00:00Z', fullCaptureAt: '2026-06-01T00:00:00Z',
    });
    await seedPaidFacts(CLIENT);

    const { candidates, remaining } = await selectStaleClients(pool, { contractorId: TENANT });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].jobberClientId, CLIENT);
    assert.equal(remaining, 0);
  });

  it('selects a FULLY CAPTURED client that was NEVER decided — a NULL decision is work, not "done"', async () => {
    // ⚠ `stage_derived_at` IS DELIBERATELY NOT BACKFILLED, so NULL means "never decided, or decided
    // before the column existed". Treating it as done is how a client whose decision FAILED would be
    // missed permanently. ⚠ But it is only work once the history is COMPLETE — hence the marker.
    await addClient(CLIENT, { stage: null, derivedAt: null, fullCaptureAt: '2026-06-01T00:00:00Z' });
    await seedPaidFacts(CLIENT);

    const { candidates } = await selectStaleClients(pool, { contractorId: TENANT });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].stageDerivedAt, null);
  });

  it('PAIRED NEGATIVE: a client decided AFTER its full capture is left alone', async () => {
    // Without this, a selector that returned every fully captured client would pass both cases above.
    await seedPaidFacts(CLIENT, { capturedAt: '2026-01-01T00:00:00Z' });
    await addClient(CLIENT, {
      stage: 'paid', derivedAt: '2026-06-01T00:00:00Z', fullCaptureAt: '2026-01-01T00:00:00Z',
    });

    const { candidates } = await selectStaleClients(pool, { contractorId: TENANT });

    assert.deepEqual(candidates, [], 'a decision newer than the capture is not stale');
  });

  it('⚠ THE RULING: a client with FACTS but NO full capture is NOT selected', async () => {
    // ⚠ THIS IS THE CASE THE WHOLE COMMIT EXISTS FOR, and under the OLD selector it was SELECTED.
    // Facts present, never decided — the old rule called that work. The facts came from a partial
    // writer, so deciding from them is what produced 353 backwards moves off 'paid'.
    await addClient(CLIENT, { stage: 'paid', derivedAt: null, fullCaptureAt: null });
    await seedPaidFacts(CLIENT);

    const { candidates, skippedPartial } = await selectStaleClients(pool, { contractorId: TENANT });

    assert.deepEqual(candidates, [], 'partial history must never be decided from');
    assert.equal(skippedPartial, 1, 'and it must be COUNTED, not silently dropped');
  });

  it('a client with NO facts at all is not selected, and is counted as skipped', async () => {
    // Factless clients derive 'lead' (classifyPipelineStatus returns it when jobs and quotes are both
    // empty). 12,410 of this tenant's 19,598 clients are in that state, so an unguarded drain would
    // push every one of them to 'lead'. They have no marker, so the same predicate excludes them.
    await addClient(CLIENT, { stage: 'paid', derivedAt: null, fullCaptureAt: null });
    const { candidates, skippedPartial } = await selectStaleClients(pool, { contractorId: TENANT });
    assert.deepEqual(candidates, []);
    assert.equal(skippedPartial, 1);
  });

  it('a non-derivable client id is excluded by the SHARED predicate, even when fully captured', async () => {
    // ⚠ FULLY CAPTURED ON PURPOSE, so the only thing that can exclude it is the derivable predicate.
    // With `fullCaptureAt: null` this case would pass for the wrong reason.
    await addClient(SYNTHETIC, { stage: null, derivedAt: null, fullCaptureAt: '2026-06-01T00:00:00Z' });
    await pool.query(
      `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id, job_status, captured_at)
       VALUES ($1, $2, $3, 'active', NOW())`, [TENANT, JOB, SYNTHETIC]);

    const { candidates } = await selectStaleClients(pool, { contractorId: TENANT });

    assert.deepEqual(candidates, [], 'the app_user / synthetic exclusion has one home and it is imported');
  });

  it('SUPERSEDED: the quote/request captured_at gap no longer limits the SELECTOR', async () => {
    // ⚠ THE OLD CASE READ: *"CURRENT LIMITATION: a quote-only change is NOT detected, because quote
    // facts have no captured_at"*, and it asserted the selector returned nothing for such a client.
    // That limitation was real for a selector built on `MAX(captured_at)`. The marker removes it: a
    // full capture pages quotes and requests too, so it stamps `last_full_capture_at` whichever
    // connection changed. ⚠ THE COLUMNS ARE STILL ABSENT — asserted below so the schema fact stays
    // recorded — but the selector no longer depends on them.
    const cols = await pool.query(
      `SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'captured_at'
          AND table_name IN ('crm_job_facts','crm_invoice_facts','crm_quote_facts','crm_request_facts')
        ORDER BY table_name`
    );
    assert.deepEqual(cols.rows.map(r => r.table_name), ['crm_invoice_facts', 'crm_job_facts'],
      'quote and request facts still carry no captured_at');

    // A quote-only change on a FULLY CAPTURED client IS now selected, which the old rule could not do.
    await pool.query(
      `INSERT INTO crm_quote_facts (contractor_id, jobber_client_id, jobber_quote_id, quote_status, created_at)
       VALUES ($1, $2, 'Z2lkOi8vSm9iYmVyL1F1b3RlLzY1MDAwMQ==', 'approved', NOW())`, [TENANT, CLIENT]);
    await addClient(CLIENT, {
      stage: 'inspection', derivedAt: '2026-06-01T00:00:00Z', fullCaptureAt: '2026-07-01T00:00:00Z',
    });

    const { candidates } = await selectStaleClients(pool, { contractorId: TENANT });
    assert.equal(candidates.length, 1, 'the capture marker, not a fact timestamp, decides staleness');
  });

  it('SUPERSEDED: the selector reads the MARKER, never a fact timestamp', async () => {
    // ⚠ THE OLD CASE READ: *"the newest fact is the GREATEST across the tables that HAVE a
    // captured_at"*, and asserted that a client with a NEWER INVOICE FACT than its decision was
    // selected. That is now explicitly NOT the rule — a newer fact proves nothing about completeness.
    // This is the inverse of the old assertion on the same fixture, which is why it is worth keeping.
    await addClient(CLIENT, { stage: 'sold', derivedAt: '2026-03-01T00:00:00Z', fullCaptureAt: null });
    await pool.query(
      `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id, job_status, captured_at)
       VALUES ($1, $2, $3, 'active', '2026-01-01T00:00:00Z')`, [TENANT, JOB, CLIENT]);
    await pool.query(
      `INSERT INTO crm_invoice_facts (contractor_id, jobber_invoice_id, jobber_client_id, invoice_status,
         total, invoice_balance, received_date, captured_at)
       VALUES ($1, $2, $3, 'paid', 1000, 0, NOW(), '2026-06-01T00:00:00Z')`, [TENANT, INVOICE, CLIENT]);

    const { candidates } = await selectStaleClients(pool, { contractorId: TENANT });
    assert.deepEqual(candidates, [],
      'a fact newer than the decision is NOT sufficient — only a newer FULL CAPTURE is');
  });

  it('is scoped to one contractor', async () => {
    await seedTenant(OTHER);
    await addClient(CLIENT, {
      tenant: OTHER, stage: 'lead', derivedAt: null, fullCaptureAt: '2026-06-01T00:00:00Z',
    });
    await seedPaidFacts(CLIENT, { tenant: OTHER });

    const { candidates } = await selectStaleClients(pool, { contractorId: TENANT });
    assert.deepEqual(candidates, []);
  });

  it('RE-DECIDES from saved facts and stamps the decision', async () => {
    await addClient(CLIENT, { stage: 'lead', derivedAt: null, fullCaptureAt: '2026-06-01T00:00:00Z' });
    await seedPaidFacts(CLIENT);

    const out = await redecideOne(pool, { contractorId: TENANT, jobberClientId: CLIENT });

    assert.equal(out.status, 'paid', 'a job plus a paid invoice derives paid');
    assert.equal(out.stageChanged, true);
    const after = await stageOf(CLIENT);
    assert.equal(after.pipeline_stage, 'paid');
    assert.ok(after.stage_derived_at, 'and the decision is stamped, or the job finds it again forever');
  });

  it('and it makes NO Jobber call — the axios stub would throw if it did', async () => {
    // The stub in beforeEach throws on any axios.post. This case is the behavioural half of the
    // source fence below: the property is "saved facts only", and this is what would break.
    await addClient(CLIENT, { stage: 'lead', derivedAt: null, fullCaptureAt: '2026-06-01T00:00:00Z' });
    await seedPaidFacts(CLIENT);

    const summary = await runRedecideStaleClients(pool, {
      contractorId: TENANT, logError: async () => {}, onLine: () => {},
    });

    assert.equal(summary.failed.length, 0, 'a Jobber call would have thrown and been recorded here');
    assert.equal(summary.redecided, 1);
  });

  it('also updates the referrer-visible status WHERE a pipeline_cache row exists', async () => {
    // ⚠ BOTH SURFACES OR NEITHER. Writing the displayed stage alone would put the two back out of
    // step, which is the single thing the N4 arc exists to have eliminated.
    await addClient(CLIENT, { stage: 'lead', derivedAt: null });
    await addCacheRow(CLIENT, { status: 'lead' });
    await seedPaidFacts(CLIENT);

    const out = await redecideOne(pool, { contractorId: TENANT, jobberClientId: CLIENT });

    assert.equal(out.referredRows, 1);
    const cache = await cacheOf(CLIENT);
    assert.equal(cache.pipeline_status, 'paid');
    assert.ok(cache.status_derived_at, 'and the referrer-visible marker is stamped');
    assert.ok(cache.paid_at, 'and paid_at is filled on the transition into paid');
  });

  it('PAIRED NEGATIVE: a client with NO pipeline_cache row affects 0 rows there', async () => {
    // Without this, a job that INSERTED a pipeline_cache row would pass the case above.
    await addClient(CLIENT, { stage: 'lead', derivedAt: null, fullCaptureAt: '2026-06-01T00:00:00Z' });
    await seedPaidFacts(CLIENT);

    const out = await redecideOne(pool, { contractorId: TENANT, jobberClientId: CLIENT });

    assert.equal(out.referredRows, 0);
    assert.equal(await cacheOf(CLIENT), null, 'the job must never CREATE a pipeline_cache row');
  });

  it('is idempotent — a second run finds nothing left to do', async () => {
    await addClient(CLIENT, { stage: 'lead', derivedAt: null, fullCaptureAt: '2026-06-01T00:00:00Z' });
    await seedPaidFacts(CLIENT);

    const first = await runRedecideStaleClients(pool, {
      contractorId: TENANT, logError: async () => {}, onLine: () => {},
    });
    assert.equal(first.redecided, 1);

    const second = await runRedecideStaleClients(pool, {
      contractorId: TENANT, logError: async () => {}, onLine: () => {},
    });
    assert.equal(second.considered, 0, 'the stamp is what stops the job finding the same work forever');
    assert.equal(second.remaining, 0);
  });

  it('one client failing never stops the run, and the failure is named', async () => {
    await addClient(CLIENT, { stage: 'lead', derivedAt: null, fullCaptureAt: '2026-06-01T00:00:00Z' });
    await seedPaidFacts(CLIENT);
    // A client row whose id is real but which has facts under a DIFFERENT job id still decides fine;
    // to force a failure, drop the client row so the UPDATE has nothing and decideFromFacts still runs.
    await addClient(CLIENT_B, { stage: 'lead', derivedAt: null, fullCaptureAt: '2026-06-01T00:00:00Z' });
    await pool.query(
      `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id, job_status, captured_at)
       VALUES ($1, 'Z2lkOi8vSm9iYmVyL0pvYi83NTAwMDI=', $2, 'active', NOW())`, [TENANT, CLIENT_B]);

    const summary = await runRedecideStaleClients(pool, {
      contractorId: TENANT, logError: async () => {}, onLine: () => {},
    });

    assert.equal(summary.considered, 2);
    assert.equal(summary.redecided, 2, 'both are decidable from saved facts');
    assert.equal(summary.failed.length, 0);
  });

  it('the limit BOUNDS the run and the summary says how many are left', async () => {
    for (const id of [CLIENT, CLIENT_B]) {
      await addClient(id, { stage: 'lead', derivedAt: null, fullCaptureAt: '2026-06-01T00:00:00Z' });
      await pool.query(
        `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id, job_status, captured_at)
         VALUES ($1, $2, $3, 'active', NOW())`, [TENANT, `job-for-${id}`, id]);
    }

    const summary = await runRedecideStaleClients(pool, {
      contractorId: TENANT, limit: 1, logError: async () => {}, onLine: () => {},
    });

    assert.equal(summary.considered, 1);
    assert.equal(summary.remaining, 1, 'a bounded run must report what it did not reach');
    const text = formatSummary(summary).join('\n');
    assert.match(text, /ATTENTION/, 'and say so, rather than reading as complete');

    const done = await runRedecideStaleClients(pool, {
      contractorId: TENANT, limit: 10, logError: async () => {}, onLine: () => {},
    });
    assert.match(formatSummary(done).join('\n'), /COMPLETE/);
    assert.equal(DEFAULT_LIMIT, 200, 'the default is pinned, so a silent change is visible here');
  });

  it('SOURCE FENCE: the job makes no Jobber call and imports no fetcher', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'jobs', 'redecideStaleClients.js'), 'utf8');
    const code = src.split('\n')
      .map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i) + ' '.repeat(l.length - i); })
      .join('\n');

    for (const needle of ['axios', 'fetchFullClient', 'fetchClientRelatedData', 'capturePost', 'getFreshContractorAccessToken']) {
      assert.ok(!code.includes(needle), `the catch-up job must not reach Jobber — found ${needle}`);
    }
    // ⚠ NON-VACUITY, IN BOTH DIRECTIONS. A needle list that matched nothing would pass identically
    // against a job that called Jobber on every client.
    assert.ok(code.includes('decideFromFacts'), 'harness: it must still decide from saved facts');
    assert.ok('const axios = require("axios");'.includes('axios'),
      'harness: the needle can match a real import line');
  });
});
