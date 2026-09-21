'use strict';

// ── CANVASS-STAGE: jobber_clients.pipeline_stage — THE WRITERS ──────────────
//
// The point of the phase in one sentence: a client with no "Referred by" value in
// Jobber could never receive a pipeline stage from any path, because the only stage
// column lived on pipeline_cache and its only writer returns on its first line when
// there is no referrer. A rep's book is mostly such clients, so a rep could not see
// where most of their clients stood.
//
// ⚠ EVERY FIXTURE HERE CARRIES A JOB AND A PAID INVOICE, DELIBERATELY, AND A 'lead'
// FIXTURE WOULD HAVE PROVEN NOTHING. classifyPipelineStatus reads the GraphQL
// CONNECTION shape — client.jobs.nodes, client.quotes.nodes, job.invoices.nodes — and
// the shape these writers have nearest to hand is the FLATTENED one built for
// deriveAndSaveTags. Handing it the flattened object yields empty arrays for jobs and
// quotes, which is the classifier's first branch: 'lead'. So a test seeded with a lead
// passes identically against the correct wiring and against a build that reads nothing
// at all, and the column would fill with a plausible verdict for the entire book.
// 'paid' is only reachable by traversing jobs.nodes AND job.invoices.nodes, so it is
// the assertion a flattening regression cannot satisfy.
//
// ⚠ ONE POOL PER FILE, NOT PER describe — initTestDb() returns the server/db.js pool
// SINGLETON, and a per-describe teardown kills the pool the next describe needs,
// which surfaces as CANCELLED rather than failed.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const syncJob = require('../cron/jobs/jobberIncrementalSync');
const { runIncrementalSync, _setTestOverrides, _resetTestOverrides } = syncJob;

const TENANT = 'stage-writer-a';

let pool;
let realAxiosPost;

// ── FIXTURE BUILDERS ─────────────────────────────────────────────────────────

function clientNode(id, { customFields = [] } = {}) {
  return {
    id,
    firstName: 'Stage', lastName: id,
    isCompany: false, isLead: false, isArchived: false,
    createdAt: new Date().toISOString(),
    emails: [{ address: `${id}@example.com`, primary: true }],
    phones: [{ number: '770-555-0100', primary: true }],
    tags: { nodes: [] },
    customFields,
  };
}

// ⚠ THE CONNECTION SHAPE, WRITTEN OUT IN FULL RATHER THAN BUILT BY A HELPER THAT
// COULD DRIFT TOWARD THE FLATTENED ONE. This is exactly what Jobber's
// GetClientRelated query returns, and the nesting is the thing under test.
function relatedNode({ jobs = [], quotes = [], requests = [] } = {}) {
  return {
    isCompany: false,
    isLead: false,
    tags: { nodes: [] },
    customFields: [],
    jobs: { nodes: jobs },
    quotes: { nodes: quotes },
    requests: { nodes: requests },
  };
}

const jobWithPaidInvoice = () => ({
  id: 'job-1', jobStatus: 'active', jobType: 'ONE_OFF',
  completedAt: null, createdAt: new Date().toISOString(),
  invoices: { nodes: [{ id: 'inv-1', invoiceStatus: 'paid', createdAt: new Date().toISOString(), amounts: { total: 900 } }] },
  customFields: [],
});

const jobWithUnpaidInvoice = () => ({
  id: 'job-2', jobStatus: 'active', jobType: 'ONE_OFF',
  completedAt: null, createdAt: new Date().toISOString(),
  invoices: { nodes: [{ id: 'inv-2', invoiceStatus: 'draft', createdAt: new Date().toISOString(), amounts: { total: 400 } }] },
  customFields: [],
});

const activeQuote = () => ({ id: 'q-1', quoteStatus: 'awaiting_response', createdAt: new Date().toISOString() });

// ── HARNESS ──────────────────────────────────────────────────────────────────
//
// ⚠ TWO INTERCEPTION LAYERS, BOTH LOAD-BEARING — the same fence
// jobberSyncRepair.test.js documents. The module seam covers this module's own Jobber
// calls; global axios.post stays patched so anything the seam does not cover is caught
// rather than escaping to the network. .env is loaded alongside .env.test, so live
// credentials are present in this process.
const setBoth = (fn) => { axios.post = fn; _setTestOverrides({ axiosPost: fn }); };

const isClientsQuery = (body) => /GetRecentClients/.test(body?.query || '');
const isRelatedQuery = (body) => /GetClientRelated/.test(body?.query || '');

// Answers the two queries the sync makes per run: one page of clients, then one
// related-data fetch per client. `related` is keyed by client id.
function installJobber({ clients, related }) {
  setBoth(async (_url, body) => {
    if (isClientsQuery(body)) {
      return { data: { data: { clients: { nodes: clients, pageInfo: { hasNextPage: false, endCursor: null } } } } };
    }
    if (isRelatedQuery(body)) {
      const id = body?.variables?.id;
      // ⚠ RETURNS `undefined` FOR AN UNKNOWN ID RATHER THAN AN EMPTY CLIENT. A double
      // that can also stand in for "no answer" is indistinguishable from the failure
      // it is meant to represent — and here an empty client classifies as 'lead',
      // which is precisely the wrong answer this file exists to catch.
      if (!(id in related)) throw new Error(`harness: no related fixture for ${id}`);
      return { data: { data: { client: related[id] } } };
    }
    throw new Error(`harness: unexpected query ${String(body?.query).slice(0, 60)}`);
  });
}

async function seedTenant() {
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  await pool.query(
    `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
     VALUES ($1, 'stage-access-token', 'stage-refresh-token', NOW() + INTERVAL '120 minutes')`,
    [TENANT]
  );
}

const stageOf = async (id) => {
  const { rows } = await pool.query(
    `SELECT pipeline_stage FROM jobber_clients WHERE jobber_client_id = $1 AND contractor_id = $2`,
    [id, TENANT]
  );
  return rows.length ? rows[0].pipeline_stage : undefined;
};

const countOf = async (table) => {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE contractor_id = $1`, [TENANT]);
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
  setBoth(async () => { throw new Error('harness: unexpected axios.post call'); });
  await pool.query('DELETE FROM contact_tags');
  await pool.query('DELETE FROM pipeline_cache');
  await pool.query('DELETE FROM jobber_clients');
  await pool.query('DELETE FROM pending_referrals');
  await pool.query('DELETE FROM contractor_crm_settings');
  await pool.query('DELETE FROM tokens');
  await pool.query('DELETE FROM error_log');
  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM contacts');
  // ⚠ titles AND team_members BEFORE contractors — both carry a contractor_id FK, and
  // deleting the parent first raises 23503 in the HOOK, which fails every case in the
  // file including ones that touch neither table. A hook fault and a subject fault look
  // different: a subject fault spares the cases that do not depend on it.
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM titles');
  await pool.query('DELETE FROM team_members');
  await pool.query('DELETE FROM contractors');
  await seedTenant();
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — the nightly sync stages a NON-REFERRED client', () => {

  it('[RED] a client with NO "Referred by" value, a job and a PAID invoice is staged "paid"', async () => {
    // ⚠ THE DISCRIMINATING CASE, AND EVERY WORD OF THE FIXTURE IS DOING WORK.
    // customFields is EMPTY — no "Referred by" — so this client can never enter the
    // referral pipeline. Before this phase it could receive no stage from any path,
    // and the assertion below was unreachable rather than merely failing.
    installJobber({
      clients: [clientNode('jc-nonref')],
      related: { 'jc-nonref': relatedNode({ jobs: [jobWithPaidInvoice()] }) },
    });

    await runIncrementalSync();

    assert.equal(await stageOf('jc-nonref'), 'paid');
  });

  it('[RED] and that stage is NOT a constant — an active quote with no job is "inspection"', async () => {
    // ⚠ THE PAIRED POSITIVE FOR THE CASE ABOVE. One client reading 'paid' is also what
    // a writer hardcoding 'paid' would produce. Two clients in one run resolving to
    // DIFFERENT values is what proves the classifier ran, and this one additionally
    // proves quotes.nodes is traversed rather than only jobs.nodes.
    installJobber({
      clients: [clientNode('jc-quote')],
      related: { 'jc-quote': relatedNode({ quotes: [activeQuote()] }) },
    });

    await runIncrementalSync();

    assert.equal(await stageOf('jc-quote'), 'inspection');
  });

  it('[RED] a job whose invoice is NOT paid is "sold", never "paid"', async () => {
    // ⚠ THE INVOICE-STATUS DISCRIMINATOR. Without this, "reads job.invoices.nodes at
    // all" and "reads invoiceStatus correctly" are indistinguishable — a writer that
    // returned 'paid' for any job with any invoice would pass the first case.
    installJobber({
      clients: [clientNode('jc-sold')],
      related: { 'jc-sold': relatedNode({ jobs: [jobWithUnpaidInvoice()] }) },
    });

    await runIncrementalSync();

    assert.equal(await stageOf('jc-sold'), 'sold');
  });

  it('[RED] three clients in ONE run each get their OWN stage', async () => {
    // The per-client guarantee. A writer computing one stage and applying it to the
    // batch passes all three cases above when they are run separately.
    installJobber({
      clients: [clientNode('jc-a'), clientNode('jc-b'), clientNode('jc-c')],
      related: {
        'jc-a': relatedNode({ jobs: [jobWithPaidInvoice()] }),
        'jc-b': relatedNode({ quotes: [activeQuote()] }),
        'jc-c': relatedNode({}),
      },
    });

    await runIncrementalSync();

    assert.equal(await stageOf('jc-a'), 'paid');
    assert.equal(await stageOf('jc-b'), 'inspection');
    assert.equal(await stageOf('jc-c'), 'lead');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — the referral pipeline is untouched by the stage write', () => {

  it('[RED] a REFERRED client is staged in jobber_clients too — the stage is not the referred slice', async () => {
    // ⚠ CARRIES A "Referred by" VALUE DELIBERATELY. The ruling is that the stage is
    // stored for EVERY client, not only for the non-referred ones: a referred client
    // whose "Referred by" value is later CLEARED in Jobber would otherwise have its
    // pipeline_cache stage frozen forever, and reading two sources would prefer the
    // frozen value over the correct daily-updated one.
    installJobber({
      clients: [clientNode('jc-referred', { customFields: [{ label: 'Referred by', valueText: 'Someone Who Referred' }] })],
      related: { 'jc-referred': relatedNode({ jobs: [jobWithPaidInvoice()] }) },
    });

    await runIncrementalSync();

    assert.equal(await stageOf('jc-referred'), 'paid');
  });

  it('[RED] and the nightly sync writes NO pipeline_cache row for it — this path is not the referral pipeline', async () => {
    // ⚠ THE SEPARATION, ASSERTED ON THE CLIENT MOST LIKELY TO BREACH IT. A client with
    // no referrer name would produce no pipeline_cache row because the referral gate
    // declined it — proving the gate works, not that the paths are separate. This
    // client WOULD produce one through syncSingleClient; it must not through this door.
    // jobberIncrementalSync calls syncSingleClient nowhere, and this is what says so.
    installJobber({
      clients: [clientNode('jc-referred-2', { customFields: [{ label: 'Referred by', valueText: 'Someone Who Referred' }] })],
      related: { 'jc-referred-2': relatedNode({ jobs: [jobWithPaidInvoice()] }) },
    });

    await runIncrementalSync();

    // The discriminator — without it this passes against a run that did nothing at all.
    assert.equal(await stageOf('jc-referred-2'), 'paid');
    assert.equal(await countOf('pipeline_cache'), 0, 'the nightly sync must not write the referral table');
    assert.equal(await countOf('pending_referrals'), 0, 'and must create no pending referral');
    assert.equal(await countOf('notifications'), 0, 'and must send nothing');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — a stage is never erased by a pass that could not observe one', () => {

  it('[RED] a related fetch that RESOLVES with a null client leaves the STORED stage intact', async () => {
    // ⚠ THIS TEST WAS WRITTEN WRONG FIRST, AND THE CORRECTION IS THE POINT OF KEEPING
    // THE NOTE. Its first form made the related fetch THROW, and it passed — but it
    // passed against a build with the COALESCE REMOVED too, which a guard-proof caught.
    // A thrown fetch aborts the per-client body before the upsert ever runs, so the
    // stored stage survived because NOTHING WAS WRITTEN, not because of the guard. The
    // assertion was about the right subject and still could not fail: the vacuity shape
    // where the observable is shared by the working and the broken build.
    //
    // ⚠ THE REACHABLE NULL PATH IS A RESOLVED 200 WITH `data.client === null`, AND IT IS
    // NOT HYPOTHETICAL — this repo already records that Jobber answers a GraphQL failure
    // with HTTP 200 plus an `errors` array, which is why `jobberShouldRetry` (reading
    // only error.response.status) lets it through and retryWithBackoff resolves happily.
    // That is the case the COALESCE exists for, and driving it is what makes this test
    // able to fail.
    installJobber({
      clients: [clientNode('jc-keep')],
      related: { 'jc-keep': relatedNode({ jobs: [jobWithPaidInvoice()] }) },
    });
    await runIncrementalSync();
    assert.equal(await stageOf('jc-keep'), 'paid', 'precondition: the stage was stored');

    // Second run: the client list still resolves, and the related query resolves 200
    // with a null client — the shape a GraphQL-level failure actually arrives in.
    setBoth(async (_url, body) => {
      if (isClientsQuery(body)) {
        return { data: { data: { clients: { nodes: [clientNode('jc-keep')], pageInfo: { hasNextPage: false, endCursor: null } } } } };
      }
      return { data: { data: { client: null }, errors: [{ message: 'Simulated GraphQL failure' }] } };
    });
    await runIncrementalSync();

    assert.equal(await stageOf('jc-keep'), 'paid', 'a pass that observed no stage must not erase the stored one');
  });

  it('[RED] and the row is still refreshed on that pass — the stage is preserved, not the whole row frozen', async () => {
    // ⚠ THE PAIRED POSITIVE, WITHOUT WHICH THE CASE ABOVE PASSES AGAINST AN UPSERT THAT
    // WAS SKIPPED ENTIRELY — which is precisely how its first form went wrong. "The
    // stage survived" and "nothing was written" are the same observation on that column
    // alone; a column the pass DID observe is what separates them.
    installJobber({
      clients: [clientNode('jc-both')],
      related: { 'jc-both': relatedNode({ jobs: [jobWithPaidInvoice()] }) },
    });
    await runIncrementalSync();
    assert.equal(await stageOf('jc-both'), 'paid', 'precondition: the stage was stored');

    const renamed = { ...clientNode('jc-both'), firstName: 'Renamed' };
    setBoth(async (_url, body) => {
      if (isClientsQuery(body)) {
        return { data: { data: { clients: { nodes: [renamed], pageInfo: { hasNextPage: false, endCursor: null } } } } };
      }
      return { data: { data: { client: null }, errors: [{ message: 'Simulated GraphQL failure' }] } };
    });
    await runIncrementalSync();

    const { rows } = await pool.query(
      `SELECT first_name, pipeline_stage FROM jobber_clients WHERE jobber_client_id = 'jc-both' AND contractor_id = $1`,
      [TENANT]
    );
    assert.equal(rows[0].first_name, 'Renamed', 'the upsert DID run on this pass');
    assert.equal(rows[0].pipeline_stage, 'paid', 'and it preserved the stage it could not observe');
  });
});
