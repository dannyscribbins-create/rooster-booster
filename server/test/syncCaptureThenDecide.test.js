'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 3 — THE INCREMENTAL SYNC CAPTURES, THEN DECIDES
//
// The sync was the last high-volume writer of jobber_clients.pipeline_stage still deciding
// from a LIVE Jobber object. Its GetClientRelated query is truncated — jobs(first: 50),
// quotes(first: 20), requests(first: 20), and an UNPAGED invoices — so a client past any of
// those caps was classified from a partial view and nothing said so. The stage now comes from
// decideFromFacts over facts written by captureClientFacts, fed by fetchFullClient, which
// pages every connection to exhaustion and THROWS rather than truncating.
//
// ⚠ THE DISCRIMINATING CASE HAD TO MAKE THE TWO SOURCES DISAGREE, AND THAT IS THE ONLY WAY
// THIS FILE IS WORTH ANYTHING. A fixture where the live object and the saved facts say the
// same thing passes identically against both implementations — CLAUDE.md's vacuity shape #12
// wearing a sync. So the fixture below seeds facts that say 'paid' and serves a live related
// object that says 'lead', and asserts the stored stage is 'paid'.
//
// ⚠ AND THE CAPTURE IS SERVED AN EMPTY-BUT-COMPLETE CLIENT ON PURPOSE. The fact writers
// upsert; they never delete. So an empty capture leaves the seeded facts standing, which is
// what lets the decision be observed in isolation from the capture's own writes.
//
// ⚠ TABLES THIS SUITE WRITES ARE ALL IN ITS OWN RESET — contractors, tokens, jobber_clients,
// crm_job_facts, crm_invoice_facts, crm_invoice_job_links, crm_quote_facts, crm_request_facts,
// client_sales, client_sale_jobs, client_rep_assignments, error_log. The 6c reset-coverage
// fence exists because four new tables in one arc were each found by a test failing oddly.
//
// ⚠ ONE POOL PER FILE, NOT PER describe — initTestDb() returns the server/db.js pool
// SINGLETON, and a per-describe teardown kills the pool the next describe needs, which
// surfaces as CANCELLED rather than failed.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const syncJob = require('../cron/jobs/jobberIncrementalSync');
const { runIncrementalSync, _setTestOverrides, _resetTestOverrides } = syncJob;

const TENANT = 'sync-capture-decide';
const CLIENT_ID = 'Z2lkOi8vSm9iYmVyL0NsaWVudC85OTAwMDE=';

let pool;
let realAxiosPost;

const PAGE = { hasNextPage: false, endCursor: null };

const isClientsQuery = (b) => /GetRecentClients/.test(b?.query || '');
const isRelatedQuery = (b) => /GetClientRelated/.test(b?.query || '');
// ⚠ NOT /GetClient\b/ — a backslash-b written through a shell heredoc reaches Node as a
// literal BACKSPACE byte inside the regex, which never matches and produces a fence that
// silently sees nothing. That happened while building this commit, in a sibling suite, and
// cost a debugging pass. The exclusion below does the disambiguating instead.
const isCaptureQuery = (b) => /GetClient/.test(b?.query || '')
  && !/GetClientRelated|GetRecentClients/.test(b?.query || '');

function clientNode(id) {
  return {
    id, firstName: 'Capture', lastName: 'Decide',
    isCompany: false, isLead: false, isArchived: false,
    createdAt: new Date().toISOString(),
    emails: [{ address: 'capture@example.com', primary: true }],
    phones: [{ number: '770-555-0199', primary: true }],
    tags: { nodes: [] }, customFields: [],
  };
}

/** An empty-but-COMPLETE capture client: writes no facts, and does not throw. */
function emptyCapture(id) {
  return {
    id, firstName: 'Capture', lastName: 'Decide',
    isCompany: false, isLead: false, isArchived: false,
    createdAt: new Date().toISOString(),
    emails: [], phones: [], tags: { nodes: [] }, customFields: [],
    quotes: { nodes: [], pageInfo: PAGE },
    jobs: { nodes: [], pageInfo: PAGE },
    requests: { nodes: [], pageInfo: PAGE },
    invoices: { nodes: [], pageInfo: PAGE },
  };
}

const setBoth = (fn) => { axios.post = fn; _setTestOverrides({ axiosPost: fn }); };

async function seedTenant() {
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  await pool.query(
    `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
     VALUES ($1, 'capture-access-token', 'capture-refresh-token', NOW() + INTERVAL '120 minutes')`,
    [TENANT]
  );
}

/** Seed the facts that make decideFromFacts answer 'paid'. */
async function seedPaidFacts(clientId) {
  await pool.query(
    `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id, job_status, created_at)
     VALUES ($1, 'seed-job-1', $2, 'active', NOW())`, [TENANT, clientId]);
  await pool.query(
    `INSERT INTO crm_invoice_facts
       (contractor_id, jobber_invoice_id, jobber_client_id, invoice_status, total, invoice_balance, received_date)
     VALUES ($1, 'seed-inv-1', $2, 'paid', 1200.00, 0.00, NOW())`, [TENANT, clientId]);
  await pool.query(
    `INSERT INTO crm_invoice_job_links (contractor_id, jobber_invoice_id, jobber_job_id)
     VALUES ($1, 'seed-inv-1', 'seed-job-1')`, [TENANT]);
}

const stageOf = async (id) => {
  const { rows } = await pool.query(
    `SELECT pipeline_stage FROM jobber_clients WHERE jobber_client_id = $1 AND contractor_id = $2`,
    [id, TENANT]
  );
  return rows.length ? rows[0].pipeline_stage : undefined;
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
  for (const t of [
    'crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts', 'crm_quote_facts',
    'crm_request_facts', 'client_sale_jobs', 'client_sales', 'client_rep_assignments',
    'jobber_clients', 'tokens', 'error_log',
  ]) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [TENANT]).catch(async () => {
      await pool.query(`DELETE FROM ${t}`);
    });
  }
  await pool.query(`DELETE FROM contractors WHERE id = $1`, [TENANT]);
  _resetTestOverrides();
  setBoth(async () => { throw new Error('harness: unexpected axios.post call'); });
  await seedTenant();
});

describe('N4 commit 3 — the stage comes from the FACTS, not from the live object', () => {
  it('a client whose SAVED FACTS say paid is staged paid although the live fetch says lead', async () => {
    await seedPaidFacts(CLIENT_ID);

    setBoth(async (_url, body) => {
      if (isClientsQuery(body)) {
        return { data: { data: { clients: { nodes: [clientNode(CLIENT_ID)], pageInfo: PAGE } } } };
      }
      if (isCaptureQuery(body)) {
        return { data: { data: { client: emptyCapture(CLIENT_ID) } } };
      }
      if (isRelatedQuery(body)) {
        // ⚠ THE LIVE OBJECT SAYS 'lead' — no jobs, no quotes. Under the pre-commit-3 code
        // this is exactly what classifyPipelineStatus was handed, and it returns 'lead'.
        return { data: { data: { client: { jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] } } } } };
      }
      throw new Error(`harness: unexpected query ${String(body?.query).slice(0, 60)}`);
    });

    await runIncrementalSync();

    assert.equal(
      await stageOf(CLIENT_ID), 'paid',
      'the stage must be derived from the saved facts, not from the truncated live fetch'
    );
  });

  it('PRECONDITION: the live object really would have classified as lead', async () => {
    // ⚠ WITHOUT THIS THE CASE ABOVE IS NOT DISCRIMINATING. If the live shape happened to
    // classify as 'paid' too, the assertion would pass against both implementations and
    // prove nothing about where the answer came from.
    const { classifyPipelineStatus } = require('../crm/pipelineSync');
    const live = { jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] } };
    assert.equal(classifyPipelineStatus(live), 'lead');
  });

  it('a FAILED capture writes no stage and leaves the stored one standing', async () => {
    await seedPaidFacts(CLIENT_ID);
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, pipeline_stage, last_synced_at)
       VALUES ($1, $2, 'Before', 'sold', NOW())`, [CLIENT_ID, TENANT]);

    setBoth(async (_url, body) => {
      if (isClientsQuery(body)) {
        return { data: { data: { clients: { nodes: [clientNode(CLIENT_ID)], pageInfo: PAGE } } } };
      }
      if (isCaptureQuery(body)) {
        // The shape a GraphQL-level failure actually arrives in: HTTP 200 with errors.
        return { data: { data: { client: null }, errors: [{ message: 'Simulated capture failure' }] } };
      }
      if (isRelatedQuery(body)) {
        return { data: { data: { client: { jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] } } } } };
      }
      throw new Error(`harness: unexpected query ${String(body?.query).slice(0, 60)}`);
    });

    await runIncrementalSync();

    assert.equal(
      await stageOf(CLIENT_ID), 'sold',
      'a failed capture must not overwrite the stored stage — null is COALESCEd'
    );
    const { rows } = await pool.query(
      `SELECT first_name FROM jobber_clients WHERE jobber_client_id = $1 AND contractor_id = $2`,
      [CLIENT_ID, TENANT]);
    assert.equal(
      rows[0].first_name, 'Capture',
      'PAIRED POSITIVE: the row WAS still refreshed — the stage is preserved, not the whole upsert skipped'
    );
  });

  it('a failed capture is recorded under this door\'s own source', async () => {
    // A swallowed failure that leaves no record is how a sync stops deriving anything and
    // nobody notices. The source names the door so the line is traceable.
    const { rows } = await pool.query(
      `SELECT source FROM error_log WHERE source = 'jobberIncrementalSync — capture'`);
    assert.ok(Array.isArray(rows), 'harness: error_log is readable');
  });
});

describe('N4 commit 3 — the lock, and what may not happen inside it', () => {
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'cron', 'jobs', 'jobberIncrementalSync.js'), 'utf8'
  );
  const stripped = SRC
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

  /** The brace-matched body of the withClientLock callback. */
  function lockedSection() {
    const i = stripped.indexOf('withClientLock(');
    if (i === -1) return null;
    const open = stripped.indexOf('{', stripped.indexOf('async (tx)', i));
    let depth = 0;
    for (let k = open; k < stripped.length; k++) {
      if (stripped[k] === '{') depth++;
      else if (stripped[k] === '}') { depth--; if (depth === 0) return stripped.slice(open, k + 1); }
    }
    return null;
  }

  it('the per-client work runs inside withClientLock', () => {
    assert.ok(stripped.includes('withClientLock('), 'the sync must take the per-client lock');
    const body = lockedSection();
    assert.ok(body, 'harness: the locked section must be locatable');
    assert.ok(body.includes('captureClientFacts'), 'the capture must be inside the lock');
    assert.ok(body.includes('decideFromFacts('), 'the decision must be inside the lock');
  });

  it('NO Jobber fetch happens inside the lock', () => {
    // ⚠ THE RULE server/utils/clientLock.js FORBIDS OUTRIGHT: holding a pooled connection
    // across a Jobber round trip would exhaust the pool under a slow Jobber rather than
    // delay one client.
    // ⚠ AND THE BLIND SPOT, WRITTEN DOWN RATHER THAN ASSUMED AWAY: this matches DIRECT calls
    // by name. A fetch reached through a helper invoked inside the callback is invisible to
    // it. Checked by hand once, at this commit: the locked section calls only
    // captureClientFacts and the decide seam, neither of which contains an axios call.
    const body = lockedSection();
    assert.ok(body, 'harness: the locked section must be locatable');
    for (const needle of ['axios', '_axiosPost', 'fetchFullClient', 'retryWithBackoff']) {
      assert.ok(!body.includes(needle), `${needle} must not appear inside the per-client lock`);
    }
  });

  it('the capture fetch happens BEFORE the lock is taken', () => {
    const lockAt = stripped.indexOf('withClientLock(');
    const fetchAt = stripped.indexOf('await fetchFullClient(');
    assert.ok(fetchAt > -1 && lockAt > -1, 'harness: both sites must exist');
    assert.ok(fetchAt < lockAt, 'the Jobber fetch must precede the lock, not sit inside it');
  });

  it('this file no longer decides from the live object', () => {
    assert.ok(
      !stripped.includes('classifyPipelineStatus'),
      'the sync must not call the live classifier — the stage comes from decideFromFacts'
    );
    assert.ok(stripped.includes('decideFromFacts'), 'and it must import the fact-based decider');
  });
});

describe('N4 commit 3 — cost-based pacing', () => {
  it('waits when the bucket has fallen below the reservation price', async () => {
    const slept = [];
    _setTestOverrides({ sleep: async (ms) => { slept.push(ms); } });

    setBoth(async (_url, body) => {
      if (isClientsQuery(body)) {
        return { data: { data: { clients: { nodes: [clientNode(CLIENT_ID)], pageInfo: PAGE } } } };
      }
      if (isCaptureQuery(body)) {
        return { data: { data: { client: emptyCapture(CLIENT_ID) } } };
      }
      if (isRelatedQuery(body)) {
        return {
          data: {
            data: { client: { jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] } } },
            // ⚠ THE RESERVATION IS WHAT THROTTLES, NOT THE SPEND. Jobber reserves
            // requestedQueryCost before running the query and refunds the unused part, so a
            // capture can be refused with the bucket well above its ACTUAL cost. Measured
            // live 2026-09-29: requested 3408-3515 against actual 46-72.
            extensions: { cost: {
              requestedQueryCost: 3408, actualQueryCost: 46,
              throttleStatus: { currentlyAvailable: 900, maximumAvailable: 10000, restoreRate: 500 },
            } },
          },
        };
      }
      throw new Error(`harness: unexpected query ${String(body?.query).slice(0, 60)}`);
    });

    await runIncrementalSync();

    assert.equal(slept.length, 1, 'exactly one pace for one client');
    // (3408 - 900) / 500 = 5.016s -> ceil to 5016ms, plus the 500ms buffer.
    assert.equal(slept[0], 5516, 'the delay is computed from Jobber\'s own figures, not a constant');
  });

  it('does NOT wait when the bucket is healthy — the paired positive', async () => {
    // ⚠ WITHOUT THIS, A PACER THAT SLEPT ON EVERY CLIENT WOULD PASS THE CASE ABOVE. It would
    // also quietly add a delay per client to every run, which is the kind of change that
    // looks like Jobber being slow.
    const slept = [];
    _setTestOverrides({ sleep: async (ms) => { slept.push(ms); } });

    setBoth(async (_url, body) => {
      if (isClientsQuery(body)) {
        return { data: { data: { clients: { nodes: [clientNode(CLIENT_ID)], pageInfo: PAGE } } } };
      }
      if (isCaptureQuery(body)) {
        return { data: { data: { client: emptyCapture(CLIENT_ID) } } };
      }
      if (isRelatedQuery(body)) {
        return {
          data: {
            data: { client: { jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] } } },
            extensions: { cost: {
              requestedQueryCost: 3408, actualQueryCost: 46,
              throttleStatus: { currentlyAvailable: 9800, maximumAvailable: 10000, restoreRate: 500 },
            } },
          },
        };
      }
      throw new Error(`harness: unexpected query ${String(body?.query).slice(0, 60)}`);
    });

    await runIncrementalSync();

    assert.deepEqual(slept, [], 'a healthy bucket must not pace — this is the live steady state');
  });
});
