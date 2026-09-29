'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 4 — THE REFERRED-CLIENT CAPTURE BACKFILL
//
// Danny ruling 8, 2026-09-29: before launch, capture facts for every `pipeline_cache` client so
// that every referrer-visible stage is fact-derived from day one.
//
// ⚠ THE LOAD-BEARING GUARANTEE IS AN ABSENCE, AND AN ABSENCE NEEDS A FENCE RATHER THAN A CASE.
// "It writes facts only" cannot be proved by observing one run: a write that fires on some other
// fixture, or on a client shape this file never builds, would be invisible. So the job's own
// source is scanned for every forbidden write shape — stage, status, assignment, flag,
// conversion — and a guard-proof adds one to prove the scan fires.
//
// ⚠ AND THE FENCE IS PAIRED WITH A POSITIVE, because a scanner whose needles match nothing
// passes identically against a job that writes all five. It must SEE the capture call it expects.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET — contractors, tokens, pipeline_cache,
// jobber_clients, the five crm_* fact tables, client_sales, client_sale_jobs, error_log.
//
// ⚠ ONE POOL PER FILE, NOT PER describe — initTestDb() returns the server/db.js pool SINGLETON.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const backfill = require('../jobs/referredCaptureBackfill');
const {
  runReferredCaptureBackfill, selectReferredClients, countZeroFactClients, formatSummary,
  _setTestOverrides, _resetTestOverrides,
} = backfill;

const TENANT = 'referred-capture-tenant';
const REAL_A = 'Z2lkOi8vSm9iYmVyL0NsaWVudC83NzAwMDE=';
const REAL_B = 'Z2lkOi8vSm9iYmVyL0NsaWVudC83NzAwMDI=';
const PAGE = { hasNextPage: false, endCursor: null };

let pool;
let realAxiosPost;

const getToken = async () => 'backfill-test-token';

/** A capture-shape client carrying one job and one PAID invoice linked to it. */
function captureClient(id, { withFacts = true } = {}) {
  const jobId = `job-${id}`;
  const invId = `inv-${id}`;
  return {
    id, firstName: 'Referred', lastName: 'Client',
    isCompany: false, isLead: false, isArchived: false,
    createdAt: new Date().toISOString(),
    emails: [], phones: [], tags: { nodes: [] }, customFields: [],
    quotes: { nodes: withFacts ? [{ id: `q-${id}`, quoteStatus: 'approved', client: { id }, createdAt: new Date().toISOString(), lastTransitioned: { approvedAt: new Date().toISOString() }, salesperson: null }] : [], pageInfo: PAGE },
    jobs: { nodes: withFacts ? [{ id: jobId, jobStatus: 'active', client: { id }, createdAt: new Date().toISOString() }] : [], pageInfo: PAGE },
    requests: { nodes: [], pageInfo: PAGE },
    invoices: {
      nodes: withFacts ? [{
        id: invId, invoiceStatus: 'paid', client: { id },
        amounts: { total: 1000, invoiceBalance: 0 },
        receivedDate: new Date().toISOString(),
        jobs: { nodes: [{ id: jobId }], pageInfo: { hasNextPage: false } },
        archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
      }] : [],
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

async function seedTenant() {
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  await pool.query(
    `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
     VALUES ($1, 'tok', 'ref', NOW() + INTERVAL '120 minutes')`, [TENANT]);
}

const addCacheRow = (id, status = 'lead') => pool.query(
  `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
   VALUES ($1, $2, 'Name', 'Referrer', $3)`, [TENANT, id, status]);

const countRows = async (table) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ${table} WHERE contractor_id = $1`, [TENANT]);
  return rows[0].n;
};

before(async () => { pool = await initTestDb(); realAxiosPost = axios.post; });
after(async () => { axios.post = realAxiosPost; _resetTestOverrides(); await pool.end(); });

beforeEach(async () => {
  // ⚠ `referral_conversions` IS IN THIS LIST BECAUSE THE 6c FENCE REQUIRED IT, AND THAT IS THE
  // FENCE WORKING RATHER THAN AN INCONVENIENCE. This suite only ever READS that table — the
  // facts-only case asserts the backfill wrote none — but a table a suite touches per-test must
  // be in its reset, or a prior case's rows leak into the next one and an absence assertion
  // starts measuring someone else's leftovers. The fence's message says explicitly not to widen
  // KNOWN_GAPS instead, which may only shrink.
  // ⚠ FK ORDER: children before parents. The fact tables and links go before their clients;
  // `referral_conversions` references `users`, which this suite never deletes.
  for (const t of [
    'crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts', 'crm_quote_facts',
    'crm_request_facts', 'client_sale_jobs', 'client_sales', 'client_rep_assignments',
    'flagged_assignments', 'referral_conversions', 'pipeline_cache', 'jobber_clients',
    'tokens', 'error_log',
  ]) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [TENANT]).catch(async () => {
      await pool.query(`DELETE FROM ${t}`);
    });
  }
  await pool.query(`DELETE FROM contractors WHERE id = $1`, [TENANT]);
  _resetTestOverrides();
  axios.post = async () => { throw new Error('harness: unexpected axios.post call'); };
  await seedTenant();
});

describe('N4 commit 4 — the population it selects', () => {
  it('admits real Jobber client ids and excludes the rest, with a reason', async () => {
    await addCacheRow(REAL_A);
    await addCacheRow('app_user_99', 'app_user');
    await addCacheRow('test-client-002', 'paid');

    const { admitted, excluded } = await selectReferredClients(pool, TENANT);
    assert.deepEqual(admitted, [REAL_A]);
    assert.deepEqual(excluded.map((e) => e.id).sort(), ['app_user_99', 'test-client-002']);
    for (const e of excluded) assert.match(e.reason, /no Jobber client/);
  });

  it('is scoped to one contractor', async () => {
    await addCacheRow(REAL_A);
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ('other-tenant','other','active')`);
    await pool.query(
      `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status)
       VALUES ('other-tenant', $1, 'X', 'Y', 'lead')`, [REAL_B]);
    const { admitted } = await selectReferredClients(pool, TENANT);
    assert.deepEqual(admitted, [REAL_A], 'another tenant\'s referred client must not be captured');
    await pool.query(`DELETE FROM pipeline_cache WHERE contractor_id = 'other-tenant'`);
    await pool.query(`DELETE FROM contractors WHERE id = 'other-tenant'`);
  });
});

describe('N4 commit 4 — what a run does', () => {
  it('captures facts for every admitted client and reports the completeness check', async () => {
    await addCacheRow(REAL_A);
    await addCacheRow(REAL_B);
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A), [REAL_B]: captureClient(REAL_B) } });

    const before = await countZeroFactClients(pool, TENANT);
    assert.equal(before, 2, 'precondition: both admitted clients start with no facts');

    const s = await runReferredCaptureBackfill(pool, { contractorId: TENANT, getToken, logError: async () => {} });

    assert.equal(s.captured, 2);
    assert.deepEqual(s.failed, []);
    assert.equal(s.zeroFactBefore, 2);
    assert.equal(s.zeroFactAfter, 0, 'the completeness check must close');
    assert.equal(await countRows('crm_job_facts'), 2);
    assert.equal(await countRows('crm_invoice_facts'), 2);
    assert.equal(await countRows('crm_quote_facts'), 2);
  });

  it('WRITES NO STAGE, NO STATUS, NO ASSIGNMENT, NO FLAG AND NO CONVERSION', async () => {
    // The behavioural half of the guarantee. The structural half is the source fence below —
    // one run cannot prove an absence, but it can prove this run did not do it.
    await addCacheRow(REAL_A, 'lead');
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, pipeline_stage)
       VALUES ($1, $2, 'Before', 'inspection')`, [REAL_A, TENANT]);
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A) } });

    await runReferredCaptureBackfill(pool, { contractorId: TENANT, getToken, logError: async () => {} });

    const { rows: jc } = await pool.query(
      `SELECT pipeline_stage FROM jobber_clients WHERE jobber_client_id=$1 AND contractor_id=$2`, [REAL_A, TENANT]);
    assert.equal(jc[0].pipeline_stage, 'inspection', 'the stage must be untouched');
    const { rows: pc } = await pool.query(
      `SELECT pipeline_status FROM pipeline_cache WHERE jobber_client_id=$1 AND contractor_id=$2`, [REAL_A, TENANT]);
    assert.equal(pc[0].pipeline_status, 'lead', 'the referred status must be untouched');
    assert.equal(await countRows('client_rep_assignments'), 0);
    assert.equal(await countRows('flagged_assignments'), 0);
    const { rows: conv } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM referral_conversions WHERE contractor_id=$1`, [TENANT]);
    assert.equal(conv[0].n, 0, 'no conversion may be written by a capture job');
    // PAIRED POSITIVE: it really did run. Without this, a job that did nothing at all passes.
    assert.ok(await countRows('crm_job_facts') > 0, 'the capture DID happen');
  });

  it('IS IDEMPOTENT — a second run produces identical fact rows', async () => {
    await addCacheRow(REAL_A);
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A) } });

    await runReferredCaptureBackfill(pool, { contractorId: TENANT, getToken, logError: async () => {} });
    const snapshot = async () => {
      const { rows } = await pool.query(
        `SELECT jobber_job_id, jobber_client_id, job_status FROM crm_job_facts WHERE contractor_id=$1
          UNION ALL
         SELECT jobber_invoice_id, jobber_client_id, invoice_status FROM crm_invoice_facts WHERE contractor_id=$1
          UNION ALL
         SELECT jobber_quote_id, jobber_client_id, quote_status FROM crm_quote_facts WHERE contractor_id=$1
         ORDER BY 1,2,3`, [TENANT]);
      return rows;
    };
    const first = await snapshot();
    assert.ok(first.length >= 3, 'precondition: the first run wrote facts');

    await runReferredCaptureBackfill(pool, { contractorId: TENANT, getToken, logError: async () => {} });
    const second = await snapshot();

    // ⚠ THE ROWS, NOT THE COUNT. A count matching would also be satisfied by a run that deleted
    // one row and inserted a different one — which is exactly what a non-idempotent writer keyed
    // on something other than the Jobber id would do.
    assert.deepEqual(second, first, 're-running must leave the same fact rows');
  });

  it('one client\'s capture failure does not stop the run, and is recorded', async () => {
    await addCacheRow(REAL_A);
    await addCacheRow(REAL_B);
    installJobber({ clients: { [REAL_B]: captureClient(REAL_B) }, failFor: [REAL_A] });

    const logged = [];
    const s = await runReferredCaptureBackfill(pool, {
      contractorId: TENANT, getToken, logError: async (a) => { logged.push(a); },
    });

    assert.equal(s.captured, 1, 'the healthy client was still captured');
    assert.equal(s.failed.length, 1);
    assert.equal(s.failed[0].id, REAL_A);
    assert.equal(logged.length, 1, 'the failure reached logError');
    assert.equal(logged[0].source, 'referredCaptureBackfill — capture');
    // ⚠ AND THE COMPLETENESS CHECK MUST STILL REPORT THE GAP RATHER THAN ROUNDING IT AWAY.
    assert.equal(s.zeroFactAfter, 1, 'the failed client still has no facts and the summary says so');
  });

  it('paces against the RESERVATION, and does not pace a healthy bucket', async () => {
    await addCacheRow(REAL_A);
    const slept = [];
    _setTestOverrides({ sleep: async (ms) => { slept.push(ms); } });

    installJobber({
      clients: { [REAL_A]: captureClient(REAL_A) },
      cost: { requestedQueryCost: 3408, actualQueryCost: 46,
        throttleStatus: { currentlyAvailable: 900, maximumAvailable: 10000, restoreRate: 500 } },
    });
    const s = await runReferredCaptureBackfill(pool, { contractorId: TENANT, getToken, logError: async () => {} });
    // (3408 - 900) / 500 = 5.016s -> 5016ms, plus the 500ms buffer.
    assert.deepEqual(slept, [5516]);
    assert.equal(s.pacedMs, 5516);
  });

  it('a healthy bucket produces no pause — the paired positive', async () => {
    await addCacheRow(REAL_A);
    const slept = [];
    _setTestOverrides({ sleep: async (ms) => { slept.push(ms); } });
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A) } });
    const s = await runReferredCaptureBackfill(pool, { contractorId: TENANT, getToken, logError: async () => {} });
    assert.deepEqual(slept, [], 'a pacer that slept on every client would pass the case above');
    assert.equal(s.pacedMs, 0);
  });

  it('counts Jobber calls and cost from the figures Jobber returned', async () => {
    await addCacheRow(REAL_A);
    installJobber({ clients: { [REAL_A]: captureClient(REAL_A) } });
    const s = await runReferredCaptureBackfill(pool, { contractorId: TENANT, getToken, logError: async () => {} });
    assert.ok(s.jobberCalls >= 1, 'at least the GetClient call must be counted');
    assert.equal(s.actualCost, s.jobberCalls * 57, 'actual cost is summed from the response, not estimated');
    assert.equal(s.requestedCost, s.jobberCalls * 3515);
  });

  it('refuses to run without a contractor id', async () => {
    await assert.rejects(
      () => runReferredCaptureBackfill(pool, { getToken }),
      /contractorId is required/
    );
  });

  it('refuses to run without a token source', async () => {
    await assert.rejects(
      () => runReferredCaptureBackfill(pool, { contractorId: TENANT }),
      /getToken is required/
    );
  });

  it('the summary names the completeness result rather than leaving it to be inferred', async () => {
    const pass = formatSummary({
      contractorId: TENANT, found: 2, admitted: 2, excluded: [], captured: 2, failed: [],
      jobberCalls: 2, actualCost: 114, requestedCost: 7030, pacedMs: 0,
      zeroFactBefore: 2, zeroFactAfter: 0, elapsedMs: 10,
    }).join('\n');
    assert.match(pass, /RESULT\s+PASS/);
    const attention = formatSummary({
      contractorId: TENANT, found: 2, admitted: 2, excluded: [], captured: 1,
      failed: [{ id: REAL_A, message: 'boom' }],
      jobberCalls: 1, actualCost: 57, requestedCost: 3515, pacedMs: 0,
      zeroFactBefore: 2, zeroFactAfter: 1, elapsedMs: 10,
    }).join('\n');
    assert.match(attention, /RESULT\s+ATTENTION/);
    assert.match(attention, /boom/, 'the failed client must appear in the summary');
  });
});

describe('N4 commit 4 — the facts-only fence', () => {
  const JOB_PATH = path.join(__dirname, '..', 'jobs', 'referredCaptureBackfill.js');
  const strip = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  const lineOf = (src, i) => src.slice(0, i).split('\n').length;

  // Needles assembled from pieces so this file cannot report itself if the scan ever widens.
  const FORBIDDEN = [
    ['pipeline' + '_stage', 'a displayed stage'],
    ['pipeline' + '_status', 'a referred status'],
    ['client_rep' + '_assignments', 'a rep assignment'],
    ['flagged' + '_assignments', 'an assignment flag'],
    ['referral' + '_conversions', 'a money conversion'],
  ];

  /**
   * Forbidden WRITES in a source string.
   * ⚠ EXTRACTED SO THE DISCRIMINATOR CAN BE DRIVEN ON SYNTHETIC INPUT, AND THAT IS NOT
   * TIDINESS — IT IS A REPAIR. The first writing inlined this loop, and a guard-proof that
   * replaced the verb anchor with `true` came back GREEN at width 0: the job legitimately
   * mentions none of the five needles, so the loop never ran and the anchor was never
   * exercised. The fence still fired when a forbidden write was ADDED, but its discriminator
   * was untested — a check whose failure mode has never been observed is a claim, not a check.
   */
  function findForbiddenWrites(src) {
    const offenders = [];
    for (const [needle, what] of FORBIDDEN) {
      let i = src.indexOf(needle);
      while (i !== -1) {
        // Verb-anchored: the job MUST be able to READ these tables (it already reads
        // pipeline_cache, and a future summary might read pipeline_status). A needle that
        // flagged a SELECT would be carved out within a week.
        const span = src.slice(Math.max(0, i - 400), i + 200);
        if (/\bINSERT\s+INTO\b|\bUPDATE\s+[a-z_]+\s+SET\b|\bDELETE\s+FROM\b/i.test(span)) {
          offenders.push(`${needle} (${what}) near line ${lineOf(src, i)}`);
        }
        i = src.indexOf(needle, i + 1);
      }
    }
    return offenders;
  }

  it('the job never writes a stage, a status, an assignment, a flag or a conversion', () => {
    const offenders = findForbiddenWrites(strip(fs.readFileSync(JOB_PATH, 'utf8')));
    assert.deepEqual(
      offenders, [],
      'the backfill must write FACTS ONLY. Forbidden write(s) found:\n  ' + offenders.join('\n  ')
    );
  });

  it('DISCRIMINATOR: a synthetic WRITE of each forbidden table IS flagged', () => {
    // The first direction. Without it, a needle set that matched nothing would pass exactly as
    // the real job does — which is precisely the state the guard-proof found.
    for (const [needle] of FORBIDDEN) {
      const synthetic = `await tx.query('UPDATE ${needle} SET x = 1 WHERE id = $1', [id]);`;
      assert.equal(
        findForbiddenWrites(synthetic).length, 1,
        `a write to ${needle} must be flagged`
      );
    }
  });

  it('DISCRIMINATOR: a synthetic READ of each forbidden table is NOT flagged', () => {
    // The second direction, and the one the verb anchor exists for. A fence that reports a
    // correct SELECT gets switched off; CLAUDE.md records that as the fate of any check that
    // produces plausible findings.
    for (const [needle] of FORBIDDEN) {
      const synthetic = `const { rows } = await db.query('SELECT a, b FROM ${needle} WHERE contractor_id = $1', [c]);`;
      assert.deepEqual(
        findForbiddenWrites(synthetic), [],
        `a READ of ${needle} must not be flagged — the verb anchor has broken`
      );
    }
  });

  it('NON-VACUITY: the fence reads the real job file, and that file really is scannable', () => {
    const raw = fs.readFileSync(JOB_PATH, 'utf8');
    assert.ok(raw.length > 1000, 'harness: the job file must actually be read');
    const src = strip(raw);
    assert.ok(src.includes('captureClientFacts('), 'the job must call the fact capture');
    assert.ok(src.includes('withClientLock('), 'and take the per-client lock');
    // ⚠ NOT AN ASSERTION THAT A NEEDLE MATCHES. The job legitimately mentions none of the five,
    // and an earlier draft of this case asserted `pipeline_cache` was present as though that
    // proved the needles could fire — it is not one of them. The needles are exercised by the
    // two synthetic discriminators above instead, which is where that claim belongs.
    assert.ok(src.includes('pipeline_cache'), 'and read pipeline_cache to select its population');
  });

  it('the job never DECIDES — decideFromFacts is not reachable from it', () => {
    // ⚠ NOT MERELY "it does not write a stage". A job that derived a status and threw it away
    // would be one edit from writing it, and the ordering argument for commit 4 preceding
    // commit 7 is that capture and derivation are separate steps.
    const src = strip(fs.readFileSync(JOB_PATH, 'utf8'));
    assert.ok(!src.includes('decideFromFacts'), 'the backfill captures; it does not decide');
    assert.ok(!src.includes('classifyPipelineStatus'), 'and it does not classify either');
  });

  it('the runnable script takes one argument and has no flags or apply mode', () => {
    const script = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'captureReferredClients.js'), 'utf8');
    const s = strip(script);
    assert.ok(s.includes('usage('), 'it must have a usage path');
    assert.ok(/args\.length === 0/.test(s), 'it must refuse with no argument');
    assert.ok(/args\.length > 1/.test(s), 'and refuse with more than one');
    assert.ok(/startsWith\('-'\)/.test(s), 'and refuse a flag outright');
    for (const forbidden of ['--apply', 'dry-run', 'dryRun', 'router.', 'app.get', 'app.post']) {
      assert.ok(!s.includes(forbidden), `the script must not carry ${forbidden}`);
    }
  });
});
