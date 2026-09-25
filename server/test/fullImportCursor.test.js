'use strict';

// ── CANVASS-STAGE PART 2: THE IMPORT'S PER-CLIENT TRANSACTION AND CURSOR ────
//
// Steps H and I used to be two full passes over the client list: H upserted every
// jobber_clients row, then I derived every client's tags. A failure anywhere in the
// second pass therefore left EVERY client half-written — a mirror row with no tags —
// and a re-run began again from nothing, because the only progress record was a
// module-level object in memory that dies with the process.
//
// ⚠ THIS FILE IS THE FIRST TEST THIS MODULE HAS EVER HAD, AND THAT IS NOT INCIDENTAL.
// The partly-written defect survived because nothing here could be driven to failure:
// a mechanism whose failure mode has never been observed is a claim, not a check. The
// seam these tests use was added for exactly this reason, modelled on the one
// jobberIncrementalSync received in Wave 0.2 for the same argument.
//
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON, and a
// per-describe teardown kills the pool the next describe needs, surfacing as CANCELLED
// rather than failed.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const importJob = require('../jobs/fullJobberImport');
const { runFullJobberImport, importState, _setTestOverrides, _resetTestOverrides } = importJob;

const TENANT = 'import-cursor-a';

let pool, realAxiosPost;

// ── FIXTURES ─────────────────────────────────────────────────────────────────

const clientNode = (id) => ({
  id,
  firstName: 'Imp', lastName: id,
  isCompany: false, isLead: false, isArchived: false,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  emails: [{ address: `${id}@example.com`, primary: true }],
  phones: [{ number: '770-555-0111', primary: true }],
  customFields: [],
});

const jobFor = (clientId) => ({
  id: `job-${clientId}`, jobStatus: 'active', jobType: 'ONE_OFF',
  completedAt: null, createdAt: new Date().toISOString(),
  client: { id: clientId }, customFields: [],
});

const paidInvoiceFor = (clientId) => ({
  id: `inv-${clientId}`, invoiceStatus: 'paid',
  createdAt: new Date().toISOString(), amounts: { total: 1200, invoiceBalance: 0 },
  client: { id: clientId },
});

// Routes each bulk query to its fixture set. `page` names are matched on the query
// text because that is what fetchAllPages actually sends.
function installJobber({ clients = [], invoices = [], jobs = [], quotes = [], requests = [] } = {}) {
  const answer = (key, nodes) => ({
    data: { data: { [key]: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } } },
  });
  const fn = async (_url, body) => {
    const q = body?.query || '';
    if (/query GetClients\b/.test(q)) return answer('clients', clients);
    if (/query GetInvoices\b/.test(q)) return answer('invoices', invoices);
    if (/query GetJobs\b/.test(q)) return answer('jobs', jobs);
    if (/query GetQuotes\b/.test(q)) return answer('quotes', quotes);
    if (/query GetRequests\b/.test(q)) return answer('requests', requests);
    throw new Error(`harness: unexpected query ${q.slice(0, 60)}`);
  };
  axios.post = fn;
  _setTestOverrides({ axiosPost: fn, getFreshToken: async () => 'import-token', startupDelayMs: 0 });
}

const progress = async () => {
  const { rows } = await pool.query(`SELECT * FROM jobber_import_progress WHERE contractor_id = $1`, [TENANT]);
  return rows[0] || null;
};

const mirrorRows = async () => {
  const { rows } = await pool.query(
    `SELECT jobber_client_id, pipeline_stage FROM jobber_clients WHERE contractor_id = $1 ORDER BY jobber_client_id`,
    [TENANT]
  );
  return rows;
};

const tagCount = async (jobberClientId) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM contact_tags WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [TENANT, jobberClientId]
  );
  return rows[0].n;
};

before(async () => {
  pool = await initTestDb();
  realAxiosPost = axios.post;
});

after(async () => {
  axios.post = realAxiosPost;
  _resetTestOverrides();
  await pool.end();
});

beforeEach(async () => {
  axios.post = async () => { throw new Error('harness: unexpected axios.post call'); };
  _resetTestOverrides();
  importState.status = 'idle';
  await pool.query('DELETE FROM jobber_import_progress');
  await pool.query('DELETE FROM contact_tags');
  await pool.query('DELETE FROM jobber_clients');
  await pool.query('DELETE FROM contractor_settings');
  await pool.query('DELETE FROM tokens');
  await pool.query('DELETE FROM error_log');
  await pool.query('DELETE FROM contacts');
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM titles');
  await pool.query('DELETE FROM team_members');
  await pool.query('DELETE FROM contractors');
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  await pool.query(
    `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
     VALUES ($1, 'tok', 'refresh', NOW() + INTERVAL '120 minutes')`,
    [TENANT]
  );
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage Part 2 — the import stages every client it writes', () => {

  it('[RED] each client is upserted WITH its own pipeline stage', async () => {
    // ⚠ THE PAID INVOICE IS THE DISCRIMINATOR, HERE FOR THE SAME REASON AS IN
    // pipelineStageWriters.test.js. This file assembles its clients by joining four
    // separately-paged fetches onto a Map, so jobs/quotes/invoices are BARE ARRAYS —
    // the opposite of the connection shape classifyPipelineStatus reads. Passing the
    // Step F client straight in returns 'lead' for everyone with no error. 'paid' is
    // only reachable through jobs.nodes AND job.invoices.nodes, so it is the one
    // assertion a shape regression cannot satisfy.
    installJobber({
      clients: [clientNode('ic-1'), clientNode('ic-2')],
      jobs: [jobFor('ic-1')],
      invoices: [paidInvoiceFor('ic-1')],
    });

    await runFullJobberImport(TENANT, { mode: 'pull_all' });

    assert.deepEqual(await mirrorRows(), [
      { jobber_client_id: 'ic-1', pipeline_stage: 'paid' },
      { jobber_client_id: 'ic-2', pipeline_stage: 'lead' },
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage Part 2 — a client is whole or absent, never partly written', () => {

  it('[RED] a failure inside a client rolls that client back ENTIRELY — no orphan mirror row', async () => {
    // ⚠ THE DEFECT THIS REPLACED, DRIVEN DIRECTLY. Under Steps H and I, the mirror row
    // was committed in the first pass and the tags in the second, so a failure between
    // them left a jobber_clients row with no contact_tags — and nothing recorded that
    // the client was incomplete. One transaction per client makes the two inseparable.
    //
    // The failure is injected by breaking contact_tags for the duration of the run,
    // which is where the second half of a client's work lands.
    installJobber({
      clients: [clientNode('ic-1')],
      jobs: [jobFor('ic-1')],
      invoices: [paidInvoiceFor('ic-1')],
    });
    await pool.query(`ALTER TABLE contact_tags ADD CONSTRAINT tmp_block_tags CHECK (tag = '__never__')`);
    try {
      await runFullJobberImport(TENANT, { mode: 'pull_all' });
    } finally {
      await pool.query(`ALTER TABLE contact_tags DROP CONSTRAINT tmp_block_tags`);
    }

    // ⚠ BOTH HALVES ASSERTED. "No tags" alone would also be true of a run that never
    // started; "no mirror row" is what says the ROLLBACK happened rather than the work
    // simply not reaching this client.
    assert.deepEqual(await mirrorRows(), [], 'the mirror row must have rolled back with the tags');
    assert.equal(await tagCount('ic-1'), 0, 'and no tags survived');

    const p = await progress();
    assert.equal(p.failed, 1, 'the failure is counted');
    assert.equal(p.last_failed_concern, 'contact_tags', 'and the run says WHICH concern failed');
  });

  it('[RED] a mid-list failure leaves a clean PREFIX and the cursor names where it stopped', async () => {
    // ⚠ THE PROPERTY THE OLD CODE DID NOT HAVE. The list is sorted by id, so "stopped
    // at ic-2" is a statement about a total order rather than about whatever sequence
    // Jobber happened to page in — which is what makes the cursor resumable at all.
    installJobber({
      clients: [clientNode('ic-1'), clientNode('ic-2'), clientNode('ic-3')],
      jobs: [jobFor('ic-1')],
      invoices: [paidInvoiceFor('ic-1')],
    });

    // Fail every client from ic-2 onward by blocking their tag writes specifically.
    await pool.query(`ALTER TABLE contact_tags ADD CONSTRAINT tmp_block_tags CHECK (jobber_client_id = 'ic-1')`);
    try {
      await runFullJobberImport(TENANT, { mode: 'pull_all' });
    } finally {
      await pool.query(`ALTER TABLE contact_tags DROP CONSTRAINT tmp_block_tags`);
    }

    assert.deepEqual(
      (await mirrorRows()).map(r => r.jobber_client_id), ['ic-1'],
      'only the clients that completed are present — a clean prefix'
    );
    const p = await progress();
    assert.equal(p.last_client_id, 'ic-1', 'the cursor names the last COMPLETED client');
    assert.equal(p.clients_done, 1);
    assert.equal(p.failed, 2, 'and both failures are counted separately');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage Part 2 — resume', () => {

  it('[RED] the cursor does NOT advance past a failure, even when a LATER client succeeds', async () => {
    // ⚠ THE CASE THAT SEPARATES A CURSOR FROM A HIGH-WATER MARK, AND IT IS HERE
    // BECAUSE THE OTHER TESTS CANNOT SEE THE DIFFERENCE. Every other fixture in this
    // file fails ic-2 AND ic-3, so "stop advancing at the first failure" and "advance
    // on every success" produce an identical cursor — both leave it at ic-1. Only a
    // failure with a SUCCESS AFTER IT can tell them apart.
    //
    // If the cursor advanced to ic-3 here, the resumed run would start after ic-3 and
    // ic-2 would never be written by any future run. It would be skipped silently and
    // permanently, and every counter would look healthy.
    installJobber({
      clients: [clientNode('ic-1'), clientNode('ic-2'), clientNode('ic-3')],
      jobs: [jobFor('ic-1')],
      invoices: [paidInvoiceFor('ic-1')],
    });
    // ic-2 alone fails; ic-1 and ic-3 both succeed.
    await pool.query(`ALTER TABLE contact_tags ADD CONSTRAINT tmp_block_tags CHECK (jobber_client_id <> 'ic-2')`);
    try {
      await runFullJobberImport(TENANT, { mode: 'pull_all' });
    } finally {
      await pool.query(`ALTER TABLE contact_tags DROP CONSTRAINT tmp_block_tags`);
    }

    const p = await progress();
    assert.equal(p.last_client_id, 'ic-1', 'the cursor must hold at the last client before the failure');
    assert.equal(p.failed, 1, 'exactly one client failed');
    // The discriminator: ic-3 really did commit, so the cursor held for the right
    // reason rather than because nothing after ic-1 ever succeeded.
    assert.deepEqual(
      (await mirrorRows()).map(r => r.jobber_client_id), ['ic-1', 'ic-3'],
      'ic-3 was still written — the run carried on past the failure'
    );

    // And the resume re-covers ic-2 rather than stepping over it.
    importState.status = 'idle';
    await runFullJobberImport(TENANT, { mode: 'pull_all' });
    assert.deepEqual(
      (await mirrorRows()).map(r => r.jobber_client_id), ['ic-1', 'ic-2', 'ic-3'],
      'the resumed run picked up the client that had failed'
    );
  });

  it('[RED] a resumed run skips the clients already committed and finishes the rest', async () => {
    installJobber({
      clients: [clientNode('ic-1'), clientNode('ic-2'), clientNode('ic-3')],
      jobs: [jobFor('ic-1')],
      invoices: [paidInvoiceFor('ic-1')],
    });
    await pool.query(`ALTER TABLE contact_tags ADD CONSTRAINT tmp_block_tags CHECK (jobber_client_id = 'ic-1')`);
    try {
      await runFullJobberImport(TENANT, { mode: 'pull_all' });
    } finally {
      await pool.query(`ALTER TABLE contact_tags DROP CONSTRAINT tmp_block_tags`);
    }
    assert.equal((await progress()).last_client_id, 'ic-1', 'precondition: the first run stopped after ic-1');

    // ⚠ completed_at MUST STILL BE NULL FOR A RESUME TO HAPPEN AT ALL — the closure
    // half of the cursor. Without it, "stopped at ic-1" and "finished at ic-1" are the
    // same row and a resumed run could not tell them apart.
    assert.equal((await progress()).completed_at, null, 'precondition: the run is not marked complete');

    importState.status = 'idle';
    await runFullJobberImport(TENANT, { mode: 'pull_all' });

    assert.deepEqual(
      (await mirrorRows()).map(r => r.jobber_client_id), ['ic-1', 'ic-2', 'ic-3'],
      'the resumed run completed the remaining clients'
    );
    const p = await progress();
    assert.equal(p.failed, 0, 'the resumed run had no failures of its own');
    assert.ok(p.completed_at, 'and it closed the cursor');
  });

  it('[RED] the resumed run does NOT re-process the committed prefix', async () => {
    // ⚠ WITHOUT THIS, "resume" AND "start over" ARE INDISTINGUISHABLE. Both end with
    // all three clients present, because every write is an idempotent upsert — which is
    // exactly what makes the previous test unable to tell them apart on its own.
    //
    // ⚠ AND THE FIRST VERSION OF THIS TEST USED clients_done AS ITS DISCRIMINATOR AND
    // WAS VACUOUS. A guard-proof that disabled resume entirely left it GREEN: on a
    // non-resume the run resets clients_done to 0 and then counts all three, so both
    // paths arrive at 3 by different routes. The counter genuinely cannot separate
    // them, and no amount of anchoring on it would have helped.
    //
    // A SENTINEL ON THE PREFIX ROW CAN. ic-1's stored name is changed to something no
    // fixture produces; the upsert would overwrite it with 'Imp' if the client were
    // processed again. Its survival is direct evidence the row was not touched, which
    // is the property under test rather than a correlate of it.
    installJobber({
      clients: [clientNode('ic-1'), clientNode('ic-2'), clientNode('ic-3')],
      jobs: [jobFor('ic-1')],
      invoices: [paidInvoiceFor('ic-1')],
    });
    await pool.query(`ALTER TABLE contact_tags ADD CONSTRAINT tmp_block_tags CHECK (jobber_client_id = 'ic-1')`);
    try {
      await runFullJobberImport(TENANT, { mode: 'pull_all' });
    } finally {
      await pool.query(`ALTER TABLE contact_tags DROP CONSTRAINT tmp_block_tags`);
    }

    await pool.query(
      `UPDATE jobber_clients SET first_name = 'SENTINEL' WHERE contractor_id = $1 AND jobber_client_id = 'ic-1'`,
      [TENANT]
    );

    importState.status = 'idle';
    await runFullJobberImport(TENANT, { mode: 'pull_all' });

    const { rows } = await pool.query(
      `SELECT first_name FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = 'ic-1'`,
      [TENANT]
    );
    assert.equal(rows[0].first_name, 'SENTINEL', 'the committed prefix was skipped, not re-processed');
    // The paired positive — without it, "SENTINEL survived" is also what a run that
    // did nothing at all would produce.
    assert.deepEqual(
      (await mirrorRows()).map(r => r.jobber_client_id), ['ic-1', 'ic-2', 'ic-3'],
      'while the remaining clients WERE processed'
    );
  });
});
