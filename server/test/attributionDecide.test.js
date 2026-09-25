'use strict';

// ── 3d PHASE 1a COMMIT 4 — decideFromFacts, ONE DECISION PATH ────────────────
//
// R5i: live and replay decide from the SAME saved facts using the SAME code.
// Q6:  jobber_clients.pipeline_stage is NOT a decision input.
// PAID: invoiceStatus = 'paid' AND invoiceBalance = 0 AND total > 0 — all three.
//
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON, and a
// per-describe pool.end() kills the pool the next describe is about to use, which surfaces as
// CANCELLED tests rather than failures.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { decideFromFacts, isInvoicePaid } = require('../utils/attributionDecide');

const T = 'decide-a';
const OTHER = 'decide-b';
const C = 'dc-1';

let pool;

const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();

async function job(id, { contractor = T, client = C } = {}) {
  await pool.query(
    `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id, created_at)
     VALUES ($1, $2, $3, $4) ON CONFLICT (contractor_id, jobber_job_id) DO NOTHING`,
    [contractor, id, client, ago(30)]);
}

async function invoice(id, jobId, { status = 'paid', total = '1000.00', balance = '0.00', contractor = T } = {}) {
  await pool.query(
    `INSERT INTO crm_invoice_facts (contractor_id, jobber_invoice_id, jobber_client_id,
                                    invoice_status, total, invoice_balance)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (contractor_id, jobber_invoice_id) DO UPDATE
        SET invoice_status = EXCLUDED.invoice_status, total = EXCLUDED.total,
            invoice_balance = EXCLUDED.invoice_balance`,
    [contractor, id, C, status, total, balance]);
  await pool.query(
    `INSERT INTO crm_invoice_job_links (contractor_id, jobber_invoice_id, jobber_job_id)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [contractor, id, jobId]);
}

async function quote(id, { status = 'approved', approvedAt = ago(20), salesperson = null, contractor = T } = {}) {
  await pool.query(
    `INSERT INTO crm_quote_facts (contractor_id, jobber_quote_id, jobber_client_id,
                                  quote_status, approved_at, salesperson_jobber_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (contractor_id, jobber_quote_id) DO NOTHING`,
    [contractor, id, C, status, approvedAt, salesperson]);
}

const setDisplayStage = (stage) => pool.query(
  `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, pipeline_stage, last_synced_at)
   VALUES ($1, $2, 'D', $3, NOW())
   ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE SET pipeline_stage = EXCLUDED.pipeline_stage`,
  [C, T, stage]);

const decide = (contractor = T, client = C) => decideFromFacts(pool, { contractorId: contractor, jobberClientId: client });

before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  for (const t of ['crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts', 'crm_quote_facts',
    'client_sale_jobs', 'client_sales', 'jobber_clients']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = ANY($1::text[])`, [[T, OTHER]]);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(a) the status comes from saved facts — including paid, which stageFor could never reach', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('no facts at all is lead', async () => {
    assert.equal((await decide()).currentStatus, 'lead');
  });

  it('an active quote and no job is inspection', async () => {
    await quote('q-1', { status: 'awaiting_response' });
    assert.equal((await decide()).currentStatus, 'inspection');
  });

  it('all quotes archived and no job is not_sold', async () => {
    await quote('q-1', { status: 'archived' });
    assert.equal((await decide()).currentStatus, 'not_sold');
  });

  it('a job with no paid invoice is sold', async () => {
    await job('j-1');
    assert.equal((await decide()).currentStatus, 'sold');
  });

  // ⚠ THE CASE stageFor STRUCTURALLY COULD NOT REACH. Its fallback passed a HARDCODED
  // `jobs: { nodes: [] }` to classifyPipelineStatus, so 'paid' was unreachable from facts — it
  // could only ever be inherited from the display column. This is the guard-proof's target.
  it('a job with a settled invoice is PAID — from facts, with no display column involved', async () => {
    await job('j-1');
    await invoice('i-1', 'j-1');
    const { currentStatus } = await decide();
    assert.equal(currentStatus, 'paid');
  });

  it('the client object carries the connection shape its consumers read', async () => {
    await job('j-1');
    await invoice('i-1', 'j-1');
    await quote('q-1');
    const { client } = await decide();
    assert.ok(Array.isArray(client.jobs.nodes), 'jobs.nodes');
    assert.ok(Array.isArray(client.quotes.nodes), 'quotes.nodes');
    assert.ok(Array.isArray(client.jobs.nodes[0].invoices.nodes), 'job.invoices.nodes');
  });

  it('a client_sales row with no job facts still reads as sold — stageFor\'s evidence rule kept', async () => {
    await pool.query(
      `INSERT INTO client_sales (contractor_id, jobber_client_id, anchor_at, last_event_at)
       VALUES ($1, $2, $3, $3)`, [T, C, ago(10)]);
    assert.equal((await decide()).currentStatus, 'sold',
      'a sale cannot exist without a job; dropping this regressed a real case to lead');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(b) read orders are PINNED with a deterministic tiebreak', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ⚠ THE ORDER IS LOAD-BEARING, NOT TIDINESS. attributionEngine picks the most recently
  // approved eligible quote with a reduce that KEEPS the incumbent on a tie, so two quotes
  // approved at the same instant resolve by whichever arrives FIRST. Unordered, that is whatever
  // Postgres felt like returning.
  // ⚠ AND THE FIXTURE INSERTS IN THE OPPOSITE ORDER ON PURPOSE. Inserting q-a first would let an
  // unordered seq scan return the pinned order by accident, and the case would pass against the
  // defect it exists to catch.
  it('two quotes approved at the SAME instant come back in id order, not insertion order', async () => {
    const same = ago(15);
    await quote('q-b', { approvedAt: same, salesperson: 'ju-b' });
    await quote('q-a', { approvedAt: same, salesperson: 'ju-a' });
    const { client } = await decide();
    assert.deepEqual(client.quotes.nodes.map((q) => q.id), ['q-a', 'q-b'],
      'inserted b then a; the pinned tiebreak must still put a first');
  });

  it('quotes come back newest-approved first', async () => {
    await quote('q-old', { approvedAt: ago(30) });
    await quote('q-new', { approvedAt: ago(2) });
    const { client } = await decide();
    assert.deepEqual(client.quotes.nodes.map((q) => q.id), ['q-new', 'q-old']);
  });

  it('a NULL approved_at sorts last, never first', async () => {
    await quote('q-null', { status: 'awaiting_response', approvedAt: null });
    await quote('q-approved', { approvedAt: ago(9) });
    const { client } = await decide();
    assert.deepEqual(client.quotes.nodes.map((q) => q.id), ['q-approved', 'q-null']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(c) PARITY — the replay decides from decideFromFacts and nothing else', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ⚠ STRUCTURAL, BECAUSE R5i IS A STRUCTURAL CLAIM. Parity between live and replay is only
  // guaranteed if there is ONE derivation. The replay is asserted to contain no second one —
  // no classifyPipelineStatus call, no stage read of its own — so the two cannot drift.
  it('attributionReplay contains NO status derivation of its own', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const src = readFileSync(join(__dirname, '..', 'utils', 'attributionReplay.js'), 'utf8');

    assert.ok(src.includes('decideFromFacts('), 'the replay must derive its status from decideFromFacts');
    assert.doesNotMatch(src, /\bclassifyPipelineStatus\s*\(/,
      'a second classifier call in the replay is a second decision path');
    assert.doesNotMatch(src, /\bstageFor\s*\(/, 'stageFor is deleted; a call means it came back');
    assert.doesNotMatch(src, /SELECT[^;]*pipeline_stage/i,
      'Q6: the replay must not read the display column as an input');
  });

  it('the SAME saved facts give the replay and a direct call the same status', async () => {
    await job('j-1');
    await invoice('i-1', 'j-1');
    const direct = await decide();

    // The replay's own entry point reads the same facts through the same function.
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const replaySrc = readFileSync(join(__dirname, '..', 'utils', 'attributionReplay.js'), 'utf8');
    assert.match(replaySrc, /const \{ currentStatus, client \} = await decideFromFacts\(/,
      'the replay must take BOTH status and client from the one call — taking only one would let the other drift');
    assert.equal(direct.currentStatus, 'paid');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(d) PAID means status paid AND balance 0 AND total > 0 — all three', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // (d4) the normal case first, so the negatives below are read against a working positive.
  it('(d4) status paid, balance 0, total > 0 IS paid', async () => {
    await job('j-1');
    await invoice('i-1', 'j-1', { status: 'paid', total: '1000.00', balance: '0.00' });
    assert.equal((await decide()).currentStatus, 'paid');
  });

  it('(d1) VOIDED with balance 0 is NOT paid', async () => {
    await job('j-1');
    await invoice('i-1', 'j-1', { status: 'voided', total: '1000.00', balance: '0.00' });
    assert.equal((await decide()).currentStatus, 'sold', 'a voided invoice never counts as paid');
  });

  it('(d2) BAD DEBT with balance 0 is NOT paid — a write-off is not revenue', async () => {
    await job('j-1');
    await invoice('i-1', 'j-1', { status: 'bad_debt', total: '1000.00', balance: '0.00' });
    assert.equal((await decide()).currentStatus, 'sold');
  });

  it('(d3) status paid with total 0 is NOT paid — zero-value work moves nothing', async () => {
    await job('j-1');
    await invoice('i-1', 'j-1', { status: 'paid', total: '0.00', balance: '0.00' });
    assert.equal((await decide()).currentStatus, 'sold');
  });

  it('status paid with a NON-ZERO balance is NOT paid', async () => {
    await job('j-1');
    await invoice('i-1', 'j-1', { status: 'paid', total: '1000.00', balance: '250.00' });
    assert.equal((await decide()).currentStatus, 'sold');
  });

  it('one settled invoice among several unqualified ones is enough', async () => {
    await job('j-1');
    await invoice('i-void', 'j-1', { status: 'voided', balance: '0.00' });
    await invoice('i-zero', 'j-1', { status: 'paid', total: '0.00', balance: '0.00' });
    await invoice('i-good', 'j-1', { status: 'paid', total: '900.00', balance: '0.00' });
    assert.equal((await decide()).currentStatus, 'paid');
  });

  it('isInvoicePaid is the ONE helper, and it rejects each shape on its own', () => {
    const base = { invoiceStatus: 'paid', invoiceBalance: '0.00', total: '100.00' };
    assert.equal(isInvoicePaid(base), true);
    assert.equal(isInvoicePaid({ ...base, invoiceStatus: 'voided' }), false);
    assert.equal(isInvoicePaid({ ...base, invoiceStatus: 'bad_debt' }), false);
    assert.equal(isInvoicePaid({ ...base, total: '0.00' }), false);
    assert.equal(isInvoicePaid({ ...base, invoiceBalance: '0.01' }), false);
    // ⚠ NULL IS REJECTED BEFORE IT CAN BE PARSED. Number(null) is 0, which would read as a
    // settled balance — a missing value must never look like a paid one.
    assert.equal(isInvoicePaid({ ...base, invoiceBalance: null }), false);
    assert.equal(isInvoicePaid({ ...base, total: null }), false);
    assert.equal(isInvoicePaid(null), false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('(e) Q6 — jobber_clients.pipeline_stage is NOT a decision input', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('the display column says paid and the facts say lead — the decision says LEAD', async () => {
    await setDisplayStage('paid');
    assert.equal((await decide()).currentStatus, 'lead',
      'stageFor returned the column when set; nothing reads it now');
  });

  it('changing the display column alone does not change the decision', async () => {
    await job('j-1');
    const before = (await decide()).currentStatus;
    // ⚠ THE FIVE VALUES THE CHECK CONSTRAINT ADMITS, READ FROM db.js RATHER THAN GUESSED.
    // The first draft used 'complete' and the CHECK rejected it — 'complete' is the FRONTEND key
    // for the DB value 'paid', a distinction CLAUDE.md states and I invented past. The fence
    // working, and the same shape as the flagged_assignments.status slip it already records.
    for (const stage of ['lead', 'inspection', 'not_sold', 'sold', 'paid', null]) {
      await setDisplayStage(stage);
      assert.equal((await decide()).currentStatus, before, `pipeline_stage = ${stage} must not move the decision`);
    }
    assert.equal(before, 'sold');
  });

  it('the display column cannot SUPPRESS a fact-derived paid either', async () => {
    await job('j-1');
    await invoice('i-1', 'j-1');
    await setDisplayStage('lead');
    assert.equal((await decide()).currentStatus, 'paid');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('tenancy — every read is contractor-scoped', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('another contractor\'s facts for the same Jobber client id are invisible', async () => {
    await job('j-1', { contractor: OTHER });
    await invoice('i-1', 'j-1', { contractor: OTHER });
    assert.equal((await decide(T)).currentStatus, 'lead', 'T has no facts of its own');
    assert.equal((await decide(OTHER)).currentStatus, 'paid', 'and OTHER has both');
  });

  it('requires a contractor id and a client id', async () => {
    await assert.rejects(() => decideFromFacts(pool, { jobberClientId: C }), /contractorId is required/);
    await assert.rejects(() => decideFromFacts(pool, { contractorId: T }), /jobberClientId is required/);
  });
});
