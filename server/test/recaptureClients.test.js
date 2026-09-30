'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// TARGETED RE-CAPTURE — facts plus the displayed stage, for a named list of clients
//
// Built for the 7 clients whose invoice-paid capture was rolled back by the `$3` parameter-type
// defect. Jobber does not redeliver those webhooks, so the facts have to be re-fetched on purpose.
//
// ⚠ THE LOAD-BEARING CASE IS A REFUSAL, NOT A CAPTURE. The job refuses any client that has a
// `pipeline_cache` row, because such a client has TWO stages and the referrer-visible one has
// exactly one owner. Writing the displayed stage alone would put the two surfaces out of step —
// the divergence the whole N4 arc exists to have closed. A run that happily captured such a
// client would look like a success and leave a defect, so that case is asserted directly.
//
// ⚠ AND THE OTHER GUARANTEE IS AN ABSENCE, WHICH NEEDS A FENCE RATHER THAN A CASE. "It writes no
// status, assignment, flag or conversion" cannot be proved by observing one run: a write that
// fires on some other fixture, or on a client shape this file never builds, would be invisible.
// So the job's own source is scanned, verb-anchored and comment-stripped, with a non-vacuity
// floor proving each needle CAN match and a paired negative proving a SELECT cannot trip it.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET — contractors, tokens, pipeline_cache,
// jobber_clients, the five crm_* fact tables, client_sales, client_sale_jobs, error_log, and
// referral_conversions / client_rep_assignments / flagged_assignments which it only READS (an
// absence assertion over an uncleared table starts measuring a prior case's leftovers).
//
// ⚠ ONE POOL PER FILE, NOT PER describe — initTestDb() returns the server/db.js pool SINGLETON,
// so a per-describe teardown would end the pool the next describe needs and CANCEL its cases
// under a green-looking `fail 0`.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const {
  runRecaptureClients, classifyRequested, snapshotClient, formatSummary,
  _resetTestOverrides,
} = require('../jobs/recaptureClients');
const { classifyPipelineStatus } = require('../crm/pipelineSync');

const TENANT = 'recapture-tenant';
const OTHER = 'recapture-other-tenant';
// Real Jobber EncodedIds — `isDerivableJobberClientId` rejects a synthetic id, so a fixture using
// one would be excluded before the job ever ran. That is the trap this arc has now hit twice.
const REAL_A = 'Z2lkOi8vSm9iYmVyL0NsaWVudC84ODAwMDE=';
const REAL_B = 'Z2lkOi8vSm9iYmVyL0NsaWVudC84ODAwMDI=';
const SYNTHETIC = 'jobber-c1';
const PAGE = { hasNextPage: false, endCursor: null };

let pool;
let realAxiosPost;

const getToken = async () => 'recapture-test-token';

/**
 * A capture-shape client. `paid` gives it a job AND a paid invoice, which is the state FURTHEST
 * from the classifier's 'lead' default and the only one reachable by walking the whole structure
 * — seeding 'lead' would make correct wiring and no wiring indistinguishable.
 */
function captureClient(id, { paid = true } = {}) {
  const jobId = `job-${id}`;
  const invId = `inv-${id}`;
  const now = new Date().toISOString();
  return {
    id, firstName: 'Recapture', lastName: 'Client',
    isCompany: false, isLead: false, isArchived: false, createdAt: now,
    emails: [], phones: [], tags: { nodes: [] }, customFields: [],
    quotes: { nodes: [{ id: `q-${id}`, quoteStatus: 'approved', client: { id }, createdAt: now, lastTransitioned: { approvedAt: now }, salesperson: null }], pageInfo: PAGE },
    jobs: { nodes: [{ id: jobId, jobStatus: 'active', client: { id }, createdAt: now }], pageInfo: PAGE },
    requests: { nodes: [{ id: `req-${id}`, client: { id }, createdAt: now, assessment: null }], pageInfo: PAGE },
    invoices: {
      nodes: [{
        id: invId, invoiceStatus: paid ? 'paid' : 'draft', client: { id },
        amounts: { total: 1000, invoiceBalance: paid ? 0 : 1000 },
        receivedDate: now,
        jobs: { nodes: [{ id: jobId }], pageInfo: { hasNextPage: false } },
        archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
      }],
      pageInfo: PAGE,
    },
  };
}

const COST = {
  requestedQueryCost: 3515, actualQueryCost: 57,
  throttleStatus: { currentlyAvailable: 9900, maximumAvailable: 10000, restoreRate: 500 },
};

function installJobber({ clients = {}, cost = COST, failFor = [] } = {}) {
  axios.post = async (_url, body) => {
    const id = body?.variables?.id;
    if (failFor.includes(id)) {
      return { data: { data: { client: null }, errors: [{ message: 'Simulated capture failure' }] } };
    }
    if (!(id in clients)) throw new Error(`harness: no capture fixture for ${id}`);
    return { data: { data: { client: clients[id] }, extensions: { cost } } };
  };
}

async function seedTenant(id) {
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [id]);
  await pool.query(
    `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
     VALUES ($1, 'tok', 'ref', NOW() + INTERVAL '120 minutes')`, [id]);
}

const addClientRow = (id, { tenant = TENANT, stage = null } = {}) => pool.query(
  `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, pipeline_stage)
   VALUES ($1, $2, 'Seed', $3)`, [id, tenant, stage]);

const addCacheRow = (id, { tenant = TENANT } = {}) => pool.query(
  `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
   VALUES ($1, $2, 'Name', 'Referrer', 'lead')`, [tenant, id]);

const stageOf = async (id, tenant = TENANT) => {
  const { rows } = await pool.query(
    'SELECT pipeline_stage FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2',
    [tenant, id]);
  return rows[0]?.pipeline_stage ?? null;
};

const run = (clientIds, opts = {}) => runRecaptureClients(pool, {
  contractorId: TENANT, clientIds, getToken, logError: async () => {}, onLine: () => {}, ...opts,
});

before(async () => { pool = await initTestDb(); realAxiosPost = axios.post; });
after(async () => { axios.post = realAxiosPost; _resetTestOverrides(); await pool.end(); });

beforeEach(async () => {
  // FK order: children before parents.
  for (const t of [
    'crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts', 'crm_quote_facts',
    'crm_request_facts', 'client_sale_jobs', 'client_sales', 'client_rep_assignments',
    'flagged_assignments', 'referral_conversions', 'pipeline_cache', 'jobber_clients',
    'tokens', 'error_log',
  ]) {
    for (const t2 of [TENANT, OTHER]) {
      await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [t2]).catch(async () => {
        await pool.query(`DELETE FROM ${t}`);
      });
    }
  }
  await pool.query(`DELETE FROM contractors WHERE id = ANY($1::text[])`, [[TENANT, OTHER]]);
  _resetTestOverrides();
  axios.post = async () => { throw new Error('harness: unexpected axios.post call'); };
  await seedTenant(TENANT);
});

describe('targeted re-capture — which clients it admits, and which it refuses', () => {
  it('admits a known, derivable client with no pipeline_cache row', async () => {
    await addClientRow(REAL_A);
    const { admitted, excluded } = await classifyRequested(pool, TENANT, [REAL_A]);
    assert.deepEqual(admitted, [REAL_A]);
    assert.deepEqual(excluded, []);
  });

  it('REFUSES a client that has a pipeline_cache row — the referrer-visible status has one owner', async () => {
    await addClientRow(REAL_A);
    await addCacheRow(REAL_A);

    const { admitted, excluded } = await classifyRequested(pool, TENANT, [REAL_A]);

    assert.deepEqual(admitted, [], 'a referred client must never be re-captured by this job');
    assert.equal(excluded.length, 1);
    assert.match(excluded[0].reason, /pipeline_cache/);
    // The reason has to name WHY, not merely that it was refused — an operator reading
    // "excluded: 1" with no cause cannot tell a safety refusal from a bug.
    assert.match(excluded[0].reason, /one owner/);
  });

  it('and that refusal is what keeps the two surfaces in step: a full run leaves the cached client untouched', async () => {
    await addClientRow(REAL_A, { stage: 'lead' });
    await addCacheRow(REAL_A);
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A) } });

    const s = await run([REAL_A]);

    assert.equal(s.captured, 0);
    assert.equal(s.jobberCalls, 0, 'a refused client must not even be fetched');
    assert.equal(await stageOf(REAL_A), 'lead', 'its displayed stage must not move');
    const snap = await snapshotClient(pool, { contractorId: TENANT, jobberClientId: REAL_A });
    assert.equal(snap.job_facts, 0, 'and no facts may be written for it');
  });

  it('excludes a synthetic client id, naming it', async () => {
    const { admitted, excluded } = await classifyRequested(pool, TENANT, [SYNTHETIC]);
    assert.deepEqual(admitted, []);
    assert.equal(excluded.length, 1);
    assert.match(excluded[0].reason, /not a Jobber client id/);
  });

  it('excludes a client this contractor has no row for — wrong tenant, or never synced', async () => {
    await seedTenant(OTHER);
    await addClientRow(REAL_B, { tenant: OTHER });

    const { admitted, excluded } = await classifyRequested(pool, TENANT, [REAL_B]);

    assert.deepEqual(admitted, []);
    assert.match(excluded[0].reason, /no jobber_clients row/);
  });

  it('refuses to run at all with no client ids — naming the list is the confirmation step', async () => {
    await assert.rejects(() => run([]), /at least one client id is required/);
    await assert.rejects(
      () => runRecaptureClients(pool, { clientIds: [REAL_A], getToken }),
      /contractorId is required/
    );
  });
});

describe('targeted re-capture — what a run writes', () => {
  it('captures facts that were not there, and reports before -> after', async () => {
    await addClientRow(REAL_A);
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A) } });

    const s = await run([REAL_A]);

    assert.equal(s.captured, 1);
    assert.equal(s.failed.length, 0);
    const [entry] = s.clients;
    assert.equal(entry.before.job_facts, 0, 'precondition: no facts before');
    assert.equal(entry.before.invoice_facts, 0);
    assert.ok(entry.after.job_facts > 0, 'jobs captured');
    assert.ok(entry.after.quote_facts > 0, 'quotes captured');
    assert.ok(entry.after.invoice_facts > 0, 'invoices captured');
    assert.ok(entry.after.request_facts > 0, 'requests captured');
    assert.ok(entry.after.invoice_job_links > 0, 'the invoice-to-job link captured');
  });

  it('writes the stage DECIDED FROM THE SAVED FACTS, not from the live object', async () => {
    // Seeded deliberately WRONG, and to a value the paid fixture cannot produce, so a run that
    // wrote nothing is distinguishable from a run that wrote the right answer.
    await addClientRow(REAL_A, { stage: 'lead' });
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A, { paid: true }) } });

    await run([REAL_A]);

    assert.equal(await stageOf(REAL_A), 'paid', 'a job plus a paid invoice derives paid');
  });

  it('a client whose invoice is NOT paid derives sold, so the fixture is discriminating', async () => {
    await addClientRow(REAL_A, { stage: 'lead' });
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A, { paid: false }) } });

    await run([REAL_A]);

    assert.equal(await stageOf(REAL_A), 'sold');
  });

  it('the decided stage is never null today — which is what the COALESCE guards against, and it is recorded rather than implied', () => {
    // ⚠ MEASURED, NOT ASSUMED. The job's stage write is COALESCEd, and its comment says that is a
    // guard against a value that cannot occur today rather than a live branch. This case is what
    // stops that claim rotting into a guess: every path of the classifier returns a string.
    const now = new Date().toISOString();
    const shapes = [
      { jobs: { nodes: [] }, quotes: { nodes: [] } },
      { jobs: { nodes: [] }, quotes: { nodes: [{ quoteStatus: 'approved' }] } },
      { jobs: { nodes: [{ id: 'j', invoices: { nodes: [] } }] }, quotes: { nodes: [] } },
      { jobs: { nodes: [{ id: 'j', invoices: { nodes: [{ invoiceStatus: 'paid', amounts: { total: 1, invoiceBalance: 0 }, receivedDate: now } ] } }] }, quotes: { nodes: [] } },
      { jobs: { nodes: [] }, quotes: { nodes: [{ quoteStatus: 'archived' }] } },
    ];
    const seen = new Set();
    for (const s of shapes) {
      const out = classifyPipelineStatus(s);
      assert.equal(typeof out, 'string', 'the classifier must never return a non-string');
      assert.notEqual(out, null);
      seen.add(out);
    }
    assert.ok(seen.size >= 3, `the shapes must reach several branches, saw ${[...seen].join(',')}`);
  });

  it('is idempotent — a second run leaves the same ROWS, not merely the same count', async () => {
    await addClientRow(REAL_A);
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A) } });

    await run([REAL_A]);
    const readRows = async () => {
      const { rows } = await pool.query(
        `SELECT jobber_job_id, job_status FROM crm_job_facts
          WHERE contractor_id = $1 AND jobber_client_id = $2 ORDER BY jobber_job_id`,
        [TENANT, REAL_A]);
      return rows;
    };
    const first = await readRows();
    assert.ok(first.length > 0, 'precondition: the first run wrote rows');

    await run([REAL_A]);
    // ⚠ THE ROWS, NOT THE COUNT. A count is also satisfied by a run that deleted one row and
    // inserted another, which is precisely what a non-idempotent writer would do.
    assert.deepEqual(await readRows(), first);
    assert.equal(await stageOf(REAL_A), 'paid');
  });

  it('one client failing never stops the run — the rest still capture, and the failure is named', async () => {
    await addClientRow(REAL_A);
    await addClientRow(REAL_B);
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A), [REAL_B]: captureClient(REAL_B) }, failFor: [REAL_A] });

    const s = await run([REAL_A, REAL_B]);

    assert.equal(s.failed.length, 1);
    assert.equal(s.failed[0].id, REAL_A);
    assert.equal(s.captured, 1, 'the healthy client is still captured');
    assert.equal(await stageOf(REAL_B), 'paid');
    assert.equal(await stageOf(REAL_A), null, 'the failed client keeps its (absent) stage');
  });

  it('is scoped to one contractor — another tenant with the same client id is untouched', async () => {
    await seedTenant(OTHER);
    await addClientRow(REAL_A);
    await addClientRow(REAL_A, { tenant: OTHER, stage: 'lead' });
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A) } });

    await run([REAL_A]);

    assert.equal(await stageOf(REAL_A, TENANT), 'paid');
    assert.equal(await stageOf(REAL_A, OTHER), 'lead', "the other tenant's stage must not move");
    const other = await snapshotClient(pool, { contractorId: OTHER, jobberClientId: REAL_A });
    assert.equal(other.job_facts, 0, "and no facts may land under the other tenant");
  });

  it('the summary formats per-client before -> after and flags a changed stage', async () => {
    await addClientRow(REAL_A, { stage: 'lead' });
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A) } });

    const text = formatSummary(await run([REAL_A])).join('\n');

    assert.match(text, /lead -> paid/);
    assert.match(text, /\*\* CHANGED \*\*/);
    assert.match(text, /invoices 0->1/);
  });
});

describe('targeted re-capture — the fence on what it must never write', () => {
  const JOB = path.join(__dirname, '..', 'jobs', 'recaptureClients.js');

  // Comments are stripped, LINE-PRESERVINGLY, so a finding's line number stays true. Deleting
  // comment text shifts every line below it and a fence whose findings name the wrong line is
  // worse than none.
  const stripComments = (src) => src
    .split('\n')
    .map((line) => {
      const i = line.indexOf('//');
      return i === -1 ? line : line.slice(0, i) + ' '.repeat(line.length - i);
    })
    .join('\n');

  // Needles assembled from pieces, so this test file is not itself the offender a walk would
  // report. Verb-anchored, so a legitimate SELECT cannot trip them.
  //
  // ⚠ THE FIRST NEEDLE NAMES THE TABLE, NOT THE COLUMN, AND THAT CORRECTION CAME FROM A
  // GUARD-PROOF COMING BACK GREEN. It was first written as VERB + `pipeline_status` — and
  // `pipeline_status` is a COLUMN. The real write is `UPDATE pipeline_cache SET pipeline_status =
  // ...`, so the verb is followed by the TABLE name and the needle could never match the defect it
  // was named for. Injection (v) added exactly that statement and the whole file stayed green.
  // ⚠ AND MY FLOOR HID IT, WHICH IS THE PART WORTH KEEPING: it asserted the needle matched
  // `UPDATE pipeline_status SET x = 1` — a synthetic string that is not a statement anyone would
  // ever write. A floor built from the needle's own shape rather than from the DEFECT's shape
  // confirms the needle matches itself. Every floor below now uses a statement in the shape the
  // production code would really take.
  const VERB = '(INSERT INTO|UPDATE|DELETE FROM)\\s+';
  const forbidden = [
    ['pipeline' + '_cache', 'the referrer-visible status — one owner, and it is not this job'],
    ['client' + '_rep_assignments', 'a rep assignment'],
    ['flagged' + '_assignments', 'a co-assignment flag'],
    ['referral' + '_conversions', 'a money row'],
  ];
  // A second, independent needle on the ASSIGNMENT itself, so a write that reached the column
  // through an alias or a differently-named table is still caught.
  const STATUS_ASSIGN = new RegExp('SET[^;]*\\bpipeline' + '_status\\s*=', 'i');

  it('writes no status, no assignment, no flag and no conversion', () => {
    const src = stripComments(fs.readFileSync(JOB, 'utf8'));
    for (const [needle, what] of forbidden) {
      const re = new RegExp(VERB + needle, 'i');
      const m = re.exec(src);
      if (m) {
        const line = src.slice(0, m.index).split('\n').length;
        assert.fail(`recaptureClients.js:${line} writes ${what} (${m[0].trim()})`);
      }
    }
    const a = STATUS_ASSIGN.exec(src);
    if (a) {
      const line = src.slice(0, a.index).split('\n').length;
      assert.fail(`recaptureClients.js:${line} assigns the referrer-visible status (${a[0].trim()})`);
    }
  });

  it('HARNESS FLOOR — each needle catches a REAL write shape, and spares the read this job really does', () => {
    // ⚠ WITHOUT THIS, A NEEDLE MATCHING NOTHING PASSES IDENTICALLY TO A JOB THAT WRITES ALL FOUR.
    for (const [needle] of forbidden) {
      const re = new RegExp(VERB + needle, 'i');
      assert.ok(re.test(`UPDATE ${needle} SET a = $1 WHERE contractor_id = $2`),
        `needle ${needle} must catch an UPDATE of that table`);
      assert.ok(re.test(`INSERT INTO ${needle} (contractor_id) VALUES ($1)`),
        `needle ${needle} must catch an INSERT into that table`);
      assert.ok(!re.test(`SELECT 1 FROM ${needle} WHERE contractor_id = $1`),
        `needle ${needle} must SPARE a read`);
    }
    // The exact statement injection (v) adds — the shape that defeated the first writing.
    const realDefect = "UPDATE pipeline_cache SET pipeline_status = $3 WHERE contractor_id = $1";
    assert.ok(new RegExp(VERB + 'pipeline' + '_cache', 'i').test(realDefect),
      'the table needle must catch the real statement, not merely a synthetic one');
    assert.ok(STATUS_ASSIGN.test(realDefect), 'the assignment needle must catch it too');
    assert.ok(!STATUS_ASSIGN.test('SELECT pipeline_status FROM pipeline_cache WHERE id = $1'),
      'the assignment needle must SPARE a read of the same column');

    // ⚠ AND THE PAIRED NEGATIVE IS LIVE RATHER THAN SYNTHETIC: this job legitimately READS
    // pipeline_cache in classifyRequested, which is how it knows to refuse a referred client. A
    // needle that flagged that read would flag correct code and be carved out within a month, so
    // the verb anchor is load-bearing and the real source proves it.
    const src = stripComments(fs.readFileSync(JOB, 'utf8'));
    assert.match(src, /SELECT 1 FROM pipeline_cache/,
      'the job must still READ pipeline_cache, or the paired negative below proves nothing');
    assert.doesNotMatch(src, new RegExp(VERB + 'pipeline' + '_cache', 'i'),
      'and that read must not be flagged as a write');
  });

  it('its ONE stage write is jobber_clients.pipeline_stage, COALESCEd', () => {
    const src = stripComments(fs.readFileSync(JOB, 'utf8'));
    const writes = src.match(/UPDATE\s+jobber_clients/gi) || [];
    assert.equal(writes.length, 1, 'exactly one UPDATE of jobber_clients, or the claim above is stale');
    assert.match(src, /pipeline_stage\s*=\s*COALESCE\(\s*\$3::text\s*,\s*pipeline_stage\s*\)/,
      'the stage write must COALESCE, so a null decision cannot blank a real stage');
  });

  it('captures and decides INSIDE the per-client lock, and fetches OUTSIDE it', () => {
    // ⚠ THIS IS A STRUCTURAL FENCE BECAUSE THE BEHAVIOURAL WIDTH IS ZERO, MEASURED RATHER THAN
    // ASSUMED. Guard-proof (vi) replaced `withClientLock(...)` with a bare call passing the pool
    // and all 18 cases stayed GREEN — correctly, because every case in this file drives ONE
    // re-capture at a time and a single caller is serialised by definition. Nothing a
    // single-threaded test can assert distinguishes "locked" from "not locked"; the anomaly the
    // lock prevents is a LOST UPDATE between two concurrent units, which needs real concurrency to
    // observe (server/test/clientLock.test.js owns that property and pays for it with elapsed-time
    // assertions). So this case pins the POSITION, which is what an edit would actually break.
    const src = stripComments(fs.readFileSync(JOB, 'utf8'));

    const lockAt = src.indexOf('withClientLock(');
    assert.ok(lockAt > -1, 'the job must take the per-client lock');

    // Brace-match the callback so "inside the lock" is an extent rather than a guess.
    const openBrace = src.indexOf('{', src.indexOf('async (tx) =>', lockAt));
    assert.ok(openBrace > -1, 'harness: the locked callback must be found, or this case reads nothing');
    let depth = 0;
    let close = -1;
    for (let i = openBrace; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') { depth -= 1; if (depth === 0) { close = i; break; } }
    }
    assert.ok(close > -1, 'harness: the locked extent must terminate');
    const locked = src.slice(openBrace, close);

    assert.match(locked, /captureClientFacts\(/, 'the capture must happen inside the lock');
    assert.match(locked, /decideFromFacts\(/, 'and so must the decision');
    assert.match(locked, /UPDATE\s+jobber_clients/, 'and the stage write, or it is not atomic with them');

    // ⚠ AND THE FETCH MUST BE OUTSIDE IT — holding a pooled connection across a Jobber round trip
    // is what server/utils/clientLock.js forbids outright.
    assert.doesNotMatch(locked, /fetchFullClient\(/, 'the Jobber fetch must NOT be inside the lock');
    assert.ok(src.indexOf('fetchFullClient(') < openBrace, 'the fetch must precede the lock');
  });

  it('and it reads its client ids from its caller rather than discovering them', () => {
    const src = stripComments(fs.readFileSync(JOB, 'utf8'));
    // A job that selected its own population would be a sweep that writes, which is the shape
    // this repo gates behind a preview. The list must arrive as an argument.
    assert.ok(!/FROM\s+jobber_clients\s+WHERE\s+contractor_id\s*=\s*\$1\s*(ORDER|LIMIT|$)/im.test(src),
      'the job must not select a population of its own');
    assert.match(src, /clientIds/, 'the list arrives as an argument');
  });
});
