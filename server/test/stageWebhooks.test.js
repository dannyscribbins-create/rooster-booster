'use strict';

// ── CANVASS-STAGE: QUOTE_CREATE · QUOTE_UPDATE · JOB_CREATE ─────────────────
//
// Three webhooks that write a pipeline stage and nothing else.
//
// ⚠ WHY THEY ARE NOT A RESCUE. Measured live on Accent's account 2026-09-21: creating a
// quote, and converting it to a job, BOTH bump the client's updatedAt to the second — so
// jobberIncrementalSync's 25-hour filter already catches every transition within about a
// day. These take that lag to near-instant. ⚠ A REQUEST does NOT bump it (measured
// 2026-09-18). The behaviour is object-specific; do not generalise from either.
//
// ⚠ AND THE FENCE IS THE POINT OF THIS FILE, NOT THE STAGE. Widening attribution must not
// widen outreach (TWO PIPELINES, 2026-09-17). Three new webhook doors into a file that
// also owns syncSingleClient is exactly where that could go wrong, so the six zeros are
// asserted over each new topic BY NAME rather than assumed from the shared handler.
//
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;

const {
  seedToken,
  signJobberWebhook,
  httpPost,
  buildTestApp,
  startTestServer,
  stopTestServer,
  waitFor,
} = require('./helpers');

const TENANT = 'stage-wh-tenant';
const ACCT   = 'JACCT_STAGE';
const CLIENT = 'jc-stage-1';

let pool, server, port;

// ── FIXTURES ─────────────────────────────────────────────────────────────────

function envelope({ topic, accountId = ACCT, itemId, occurredAt = new Date().toISOString() }) {
  return { data: { webHookEvent: { topic, appId: 'test-app', accountId, itemId, occurredAt } } };
}

function post(path, payloadObject) {
  const { body, signature } = signJobberWebhook(payloadObject);
  return httpPost(port, path, body, { 'x-jobber-hmac-sha256': signature });
}

// ⚠ THE CONNECTION SHAPE, deliberately written out. classifyPipelineStatus reads
// jobs.nodes / quotes.nodes / job.invoices.nodes, and handing it the FLATTENED shape
// built elsewhere for tag derivation returns 'lead' for everything with no error.
// ⚠ THE FIXTURE MIRRORS WHAT THE QUERY SELECTS, AND COMMIT 5 MADE THAT BINDING.
// The door no longer classifies this object — it CAPTURES it into the fact tables and then
// decides from the rows. So a field the real query selects but this fixture omits is not a
// cosmetic gap: the writer filters the node out, the capture reports success having written
// nothing, and every stage reads 'lead'. Two were missing and both were found that way:
//   · `client { id }` on quotes, jobs and invoices — every writer keys the row on it;
//   · a TOP-LEVEL `invoices` connection — fetchClientRelatedData returns one, and
//     captureClientFacts reads client.invoices.nodes as the authoritative invoice set.
// Before Commit 5 neither mattered, because classifyPipelineStatus walked job.invoices.nodes
// and never looked at either.
function related({ jobs = [], quotes = [], invoices = [], requests = [] } = {}) {
  return {
    isCompany: false, isLead: false,
    tags: { nodes: [] }, customFields: [],
    jobs: { nodes: jobs }, quotes: { nodes: quotes }, requests: { nodes: requests },
    invoices: { nodes: invoices.length ? invoices : jobs.flatMap((j) => j.invoices?.nodes || []) },
  };
}

const OWNER = { id: CLIENT };
const activeQuote   = () => ({ id: 'q-1', quoteStatus: 'awaiting_response', createdAt: new Date().toISOString(), client: OWNER });
const archivedQuote = () => ({ id: 'q-2', quoteStatus: 'archived', createdAt: new Date().toISOString(), client: OWNER });
const plainJob      = () => ({
  id: 'job-1', jobStatus: 'active', jobType: 'ONE_OFF', completedAt: null,
  createdAt: new Date().toISOString(), invoices: { nodes: [] }, customFields: [], client: OWNER,
});
const paidInvoice = () => ({
  id: 'inv-1', invoiceStatus: 'paid', createdAt: new Date().toISOString(),
  amounts: { total: 500, invoiceBalance: 0 }, client: OWNER,
  jobs: { nodes: [{ id: 'job-1' }], pageInfo: { hasNextPage: false } },
  archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
});
const paidJob = () => ({
  ...plainJob(),
  invoices: { nodes: [paidInvoice()] },
});

const stageOf = async (id = CLIENT) => {
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

async function seedMirrorRow() {
  await pool.query(
    `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
     VALUES ($1, $2, 'Stage', NOW())`,
    [CLIENT, TENANT]
  );
}

// Answers the two fetches a stage handler makes, with no network.
function installStageFetches(relatedData, { clientId = CLIENT } = {}) {
  _setTestOverrides({
    getFreshContractorAccessToken: async () => 'tok',
    fetchStageSubjectClient: async () => clientId,
    fetchClientRelatedData: async () => relatedData,
  });
}

before(async () => {
  pool = await initTestDb();
  const app = buildTestApp();
  ({ server, port } = await startTestServer(app));
});

after(async () => {
  await stopTestServer(server);
  await pool.end();
});

beforeEach(async () => {
  _resetTestOverrides();
  // ⚠ THE FACT TABLES CLEAR FIRST, AND COMMIT 5 IS WHY THEY HAVE TO. The doors now DECIDE from
  // these rows, so a job fact left by an earlier case makes the next one read 'sold' no matter
  // what its own fixture says — which is exactly how this file first failed: an archived-quote
  // case asserting 'not_sold' read 'sold' from the previous case's job. Before Commit 5 the
  // decision came from the live fixture and no leak could reach it.
  await pool.query('DELETE FROM crm_invoice_job_links');
  await pool.query('DELETE FROM crm_invoice_facts');
  await pool.query('DELETE FROM crm_job_facts');
  await pool.query('DELETE FROM crm_quote_facts');
  await pool.query('DELETE FROM crm_request_facts');
  await pool.query('DELETE FROM jobber_webhook_events');
  await pool.query('DELETE FROM admin_messages');
  await pool.query('DELETE FROM client_rep_assignments');
  await pool.query('DELETE FROM pipeline_cache');
  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM jobber_clients');
  await pool.query('DELETE FROM contact_tags');
  await pool.query('DELETE FROM pending_referrals');
  await pool.query('DELETE FROM contractor_crm_settings');
  await pool.query('DELETE FROM tokens');
  await pool.query('DELETE FROM error_log');
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM titles');
  await pool.query('DELETE FROM team_members');
  await pool.query('DELETE FROM contractors');
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  await pool.query(
    `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
    [TENANT, ACCT]
  );
  await seedToken(pool, TENANT);
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — the three stage webhooks write a stage', () => {

  it('[RED] QUOTE_CREATE stages an otherwise-empty client as "inspection"', async () => {
    await seedMirrorRow();
    installStageFetches(related({ quotes: [activeQuote()] }));

    await post('/webhooks/jobber/quote-create', envelope({ topic: 'QUOTE_CREATE', itemId: 'q-1' }));
    await waitFor(async () => (await stageOf()) !== null);

    assert.equal(await stageOf(), 'inspection');
  });

  it('[RED] JOB_CREATE takes the same client to "sold"', async () => {
    await seedMirrorRow();
    installStageFetches(related({ jobs: [plainJob()], quotes: [activeQuote()] }));

    await post('/webhooks/jobber/job-create', envelope({ topic: 'JOB_CREATE', itemId: 'job-1' }));
    await waitFor(async () => (await stageOf()) !== null);

    // ⚠ A JOB BEATS AN ACTIVE QUOTE, and the quote is present deliberately. The
    // classifier returns 'sold' on jobs.length > 0 BEFORE it looks at quotes at all,
    // which is also why a Jobber quoteStatus of 'converted' resolves correctly: the job
    // it converted into is what decides the stage.
    assert.equal(await stageOf(), 'sold');
  });

  it('[RED] QUOTE_UPDATE takes a client whose quotes are ALL archived to "not_sold"', async () => {
    await seedMirrorRow();
    installStageFetches(related({ quotes: [archivedQuote()] }));

    await post('/webhooks/jobber/quote-update', envelope({ topic: 'QUOTE_UPDATE', itemId: 'q-2' }));
    await waitFor(async () => (await stageOf()) !== null);

    assert.equal(await stageOf(), 'not_sold');
  });

  it('[RED] and the stage is not a constant — a paid invoice reads "paid" through the same door', async () => {
    // The paired discriminator. One topic resolving to one value is also what a handler
    // writing a hardcoded stage would produce.
    await seedMirrorRow();
    installStageFetches(related({ jobs: [paidJob()] }));

    await post('/webhooks/jobber/job-create', envelope({ topic: 'JOB_CREATE', itemId: 'job-1' }));
    await waitFor(async () => (await stageOf()) !== null);

    assert.equal(await stageOf(), 'paid');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — the stage webhooks never CREATE a mirror row', () => {

  it('[RED] with no jobber_clients row, a stage webhook writes NOTHING', async () => {
    // ⚠ NO seedMirrorRow() — that is the case. Row CREATION belongs to the three writers
    // that carry a full client payload; these handlers know a quote id, not a client.
    installStageFetches(related({ quotes: [activeQuote()] }));

    await post('/webhooks/jobber/quote-create', envelope({ topic: 'QUOTE_CREATE', itemId: 'q-1' }));
    // Nothing to wait FOR, so wait for the delivery claim instead — that proves the
    // handler ran to completion rather than the assertion racing it.
    await waitFor(async () => (await countOf('jobber_webhook_events')) > 0);

    assert.equal(await countOf('jobber_clients'), 0, 'no mirror row may be conjured from a stage');
  });

  it('[RED] POSITIVE CONTROL — the same fixture WITH a row does get staged', async () => {
    // ⚠ WITHOUT THIS, the case above passes against a handler that does nothing at all,
    // and these handlers have several ways to quietly do nothing.
    await seedMirrorRow();
    installStageFetches(related({ quotes: [activeQuote()] }));

    await post('/webhooks/jobber/quote-create', envelope({ topic: 'QUOTE_CREATE', itemId: 'q-1' }));
    await waitFor(async () => (await stageOf()) !== null);

    assert.equal(await stageOf(), 'inspection');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — THE FENCE extended to the three stage topics', () => {

  // ⚠ ASSERTED PER TOPIC BY NAME. The three share one handler today, so a single case
  // would pass for two topics it never exercised — and "they share a handler" is a fact
  // about this commit, not a property the fence should depend on.
  for (const [topic, path, itemId] of [
    ['QUOTE_CREATE', '/webhooks/jobber/quote-create', 'q-1'],
    ['QUOTE_UPDATE', '/webhooks/jobber/quote-update', 'q-1'],
    ['JOB_CREATE',   '/webhooks/jobber/job-create',   'job-1'],
  ]) {
    it(`[RED] ${topic} creates no outreach, referrer record, pending invite or alert`, async () => {
      // ⚠ THE CLIENT CARRIES A "Referred by" VALUE, DELIBERATELY — the same construction
      // the Canvass-3.7 fence uses. Against a client with no referrer name the referral
      // pipeline's own gate would decline it, which proves the gate works rather than
      // that these paths are separate. This client WOULD produce outreach through
      // syncSingleClient; it must not through these doors.
      await seedMirrorRow();
      let emailsSent = 0;
      const withReferrer = related({ jobs: [plainJob()] });
      withReferrer.customFields = [{ label: 'Referred by', valueText: 'Someone Who Referred' }];
      _setTestOverrides({
        getFreshContractorAccessToken: async () => 'tok',
        fetchStageSubjectClient: async () => CLIENT,
        fetchClientRelatedData: async () => withReferrer,
        sendEmail: async () => { emailsSent += 1; return { data: { id: 'x' } }; },
      });

      await post(path, envelope({ topic, itemId }));
      await waitFor(async () => (await stageOf()) !== null);

      // The discriminator — without it every zero below passes against a pass that did
      // nothing at all.
      assert.equal(await stageOf(), 'sold', 'the stage write must have actually happened');
      assert.equal(await countOf('pipeline_cache'), 0, 'no pipeline_cache upsert');
      assert.equal(await countOf('notifications'), 0, 'no notifications row');
      assert.equal(await countOf('admin_messages'), 0, 'no admin alert');
      assert.equal(emailsSent, 0, 'no email sent');
      assert.equal(await countOf('pending_referrals'), 0, 'no pending referral record');
      assert.equal(await countOf('contact_tags'), 0, 'no tag pass');
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-stage — delivery semantics', () => {

  it('[RED] a duplicate delivery of the SAME event is swallowed', async () => {
    await seedMirrorRow();
    const occurredAt = new Date().toISOString();
    installStageFetches(related({ quotes: [activeQuote()] }));

    await post('/webhooks/jobber/quote-create', envelope({ topic: 'QUOTE_CREATE', itemId: 'q-1', occurredAt }));
    await waitFor(async () => (await stageOf()) !== null);

    // Second delivery, byte-identical. Jobber is at-least-once.
    await post('/webhooks/jobber/quote-create', envelope({ topic: 'QUOTE_CREATE', itemId: 'q-1', occurredAt }));
    await waitFor(async () => (await countOf('jobber_webhook_events')) > 0);

    assert.equal(await countOf('jobber_webhook_events'), 1, 'one claim row for one event');
  });

  it('[RED] ⚠ but a LATER update of the same quote is NOT swallowed', async () => {
    // ⚠ THE CASE THAT MAKES THE DEDUPE CORRECT RATHER THAN MERELY PRESENT. QUOTE_UPDATE
    // fires repeatedly for one quote id, and each firing can change the classification.
    // Deduping on (topic, itemId) alone would drop every transition after the first —
    // a quote going archived would never reach not_sold. occurred_at is what separates
    // "Jobber sent it twice" from "it genuinely happened again".
    await seedMirrorRow();
    installStageFetches(related({ quotes: [activeQuote()] }));
    await post('/webhooks/jobber/quote-update', envelope({
      topic: 'QUOTE_UPDATE', itemId: 'q-1', occurredAt: '2026-09-21T03:25:55.000Z',
    }));
    await waitFor(async () => (await stageOf()) === 'inspection');

    // The quote is archived a minute later — a genuine second event.
    // ⚠ THE SAME QUOTE ID, ARCHIVED — NOT A DIFFERENT ONE, AND COMMIT 5 IS WHY.
    // This used to install `archivedQuote()`, which is q-2. While the decision came from the
    // live fixture that read as "the client's quotes are now all archived". Under
    // capture-then-decide FACTS ACCUMULATE: capturing q-2 leaves q-1 on disk still ACTIVE, so
    // the client correctly reads 'inspection' forever and the case hung on its waitFor.
    // Archiving q-1 is what Jobber actually does, and the upsert updates the row in place.
    installStageFetches(related({ quotes: [{ ...activeQuote(), quoteStatus: 'archived' }] }));
    await post('/webhooks/jobber/quote-update', envelope({
      topic: 'QUOTE_UPDATE', itemId: 'q-1', occurredAt: '2026-09-21T03:26:55.000Z',
    }));
    await waitFor(async () => (await stageOf()) === 'not_sold');

    assert.equal(await stageOf(), 'not_sold', 'the second, genuine update must be processed');
    assert.equal(await countOf('jobber_webhook_events'), 2, 'and claimed as its own delivery');
  });

  it('[RED] an unknown accountId is refused and writes no stage', async () => {
    await seedMirrorRow();
    installStageFetches(related({ jobs: [plainJob()] }));

    await post('/webhooks/jobber/job-create', envelope({
      topic: 'JOB_CREATE', itemId: 'job-1', accountId: 'JACCT_SOMEONE_ELSE',
    }));
    // ⚠ COUNTED WITHOUT THE TENANT FILTER, AND THAT IS THE WHOLE POINT OF THE CASE.
    // countOf() scopes to contractor_id = TENANT; a resolution failure BY DEFINITION has
    // no contractor, so the quarantine row carries none and a tenant-scoped count can
    // never see it. The first draft of this test used countOf and timed out waiting for
    // a row that had already been written — the assertion was about the right subject
    // and was looking in a place the subject could not be.
    await waitFor(async () => {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM error_log WHERE source LIKE '%contractor resolution%'`
      );
      return rows[0].n > 0;
    });

    assert.equal(await stageOf(), null, 'an unresolvable tenant must write nothing');
  });

  it('[RED] a missing signature is rejected', async () => {
    await seedMirrorRow();
    installStageFetches(related({ jobs: [plainJob()] }));

    const { body } = signJobberWebhook(envelope({ topic: 'JOB_CREATE', itemId: 'job-1' }));
    const res = await httpPost(port, '/webhooks/jobber/job-create', body, {});

    assert.equal(res.status, 401);
    assert.equal(await stageOf(), null, 'and no stage is written');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3d PHASE 1a COMMIT 0 — QUOTE_APPROVED GETS ITS OWN ROUTE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠ THE DEFECT THIS CLOSES PRODUCED NO ERROR ANYWHERE. Danny subscribed QUOTE_APPROVED on
// 2026-09-24 at /webhooks/jobber/quote-approved before any route served it. Nothing in
// the webhook file dispatches on the payload's topic — routing is by URL — so this was an
// unmatched route, not an unhandled topic: 404 from Express's finalhandler, no HMAC check
// (the verifier is the first statement INSIDE each route body, never middleware), no
// claim row, and no error_log row (expressErrorHandler is a four-argument error handler an
// unmatched route never reaches). Every event was dropped silently and unrecoverably.
//
// ⚠ AND THE TOPIC LITERAL IS THE POINT, NOT THE PATH. jobber_webhook_events' key is
// (contractor_id, topic, item_id, occurred_at), and the topic stored is the ROUTE's
// hardcoded literal rather than the payload's. Reusing 'quote-update' would therefore make
// a real QUOTE_APPROVED and a real QUOTE_UPDATE for one quote at one instant collide, and
// the second would be discarded as a duplicate delivery. That is what the paired case
// below fires, and it is the guard-proof's target.
describe('3d Phase 1a Commit 0 — QUOTE_APPROVED has its own route and its own topic', () => {

  const APPROVED_PATH = '/webhooks/jobber/quote-approved';

  const topicsOf = async () => {
    const { rows } = await pool.query(
      `SELECT topic FROM jobber_webhook_events WHERE contractor_id = $1 ORDER BY topic`,
      [TENANT]
    );
    return rows.map((r) => r.topic);
  };

  it('[RED] a signed QUOTE_APPROVED delivery is accepted and writes the stage', async () => {
    // ⚠ THE STAGE ASSERTED IS 'inspection', NOT a value unique to this topic — an approved
    // quote moves no stage of its own, and the handler is shared. What this proves is that
    // the route EXISTS and reaches the same stage write, which is exactly what 404'd.
    await seedMirrorRow();
    installStageFetches(related({ quotes: [activeQuote()] }));

    const res = await post(APPROVED_PATH, envelope({ topic: 'QUOTE_APPROVED', itemId: 'q-1' }));
    await waitFor(async () => (await stageOf()) !== null);

    assert.equal(res.status, 200, 'the path that 404d in production must now answer 2xx');
    assert.equal(await stageOf(), 'inspection');
  });

  it('[RED] and the stage is not a constant — the same door reads "not_sold" on archived quotes', async () => {
    // The paired discriminator, the same one the three original topics carry: one topic
    // resolving to one value is also what a handler writing a hardcoded stage produces.
    await seedMirrorRow();
    installStageFetches(related({ quotes: [archivedQuote()] }));

    await post(APPROVED_PATH, envelope({ topic: 'QUOTE_APPROVED', itemId: 'q-2' }));
    await waitFor(async () => (await stageOf()) !== null);

    assert.equal(await stageOf(), 'not_sold');
  });

  it('[RED] its claim row carries topic "quote-approved", NOT "quote-update"', async () => {
    await seedMirrorRow();
    installStageFetches(related({ quotes: [activeQuote()] }));

    await post(APPROVED_PATH, envelope({ topic: 'QUOTE_APPROVED', itemId: 'q-1' }));
    await waitFor(async () => (await countOf('jobber_webhook_events')) > 0);

    // ⚠ ASSERTED AS THE WHOLE SET, NOT WITH A CONTAINS. A `includes('quote-approved')`
    // would stay green if the handler ALSO wrote a 'quote-update' row, which is half the
    // defect this route exists to prevent.
    assert.deepEqual(await topicsOf(), ['quote-approved']);
  });

  it('[RED] a duplicate delivery of the SAME QUOTE_APPROVED event is claimed once', async () => {
    await seedMirrorRow();
    const occurredAt = new Date().toISOString();
    installStageFetches(related({ quotes: [activeQuote()] }));

    await post(APPROVED_PATH, envelope({ topic: 'QUOTE_APPROVED', itemId: 'q-1', occurredAt }));
    await waitFor(async () => (await stageOf()) !== null);

    // Second delivery, byte-identical. Jobber is at-least-once.
    await post(APPROVED_PATH, envelope({ topic: 'QUOTE_APPROVED', itemId: 'q-1', occurredAt }));
    await waitFor(async () => (await countOf('jobber_webhook_events')) > 0);

    assert.equal(await countOf('jobber_webhook_events'), 1, 'one claim row for one event');
  });

  it('[RED] ⚠ QUOTE_UPDATE and QUOTE_APPROVED for the SAME quote at the SAME occurredAt are BOTH claimed', async () => {
    // ⚠ THE CASE THE SEPARATE ROUTE EXISTS FOR, AND THE GUARD-PROOF'S TARGET. Jobber
    // plausibly emits both for one approval. Sharing quote-update's topic literal makes
    // the two rows collide on (contractor_id, topic, item_id, occurred_at) and the second
    // is swallowed as a duplicate — a real event lost, with a log line calling it a dupe.
    await seedMirrorRow();
    const occurredAt = '2026-09-24T14:00:00.000Z';
    installStageFetches(related({ quotes: [activeQuote()] }));

    await post('/webhooks/jobber/quote-update', envelope({
      topic: 'QUOTE_UPDATE', itemId: 'q-1', occurredAt,
    }));
    await waitFor(async () => (await countOf('jobber_webhook_events')) >= 1);

    await post(APPROVED_PATH, envelope({ topic: 'QUOTE_APPROVED', itemId: 'q-1', occurredAt }));
    await waitFor(async () => (await countOf('jobber_webhook_events')) >= 2);

    assert.deepEqual(
      await topicsOf(),
      ['quote-approved', 'quote-update'],
      'both deliveries must be claimed under their own topic — neither swallowed'
    );
  });

  it('[RED] a bad signature to the new path is rejected exactly as quote-update rejects one', async () => {
    await seedMirrorRow();
    installStageFetches(related({ quotes: [activeQuote()] }));

    const { body } = signJobberWebhook(envelope({ topic: 'QUOTE_APPROVED', itemId: 'q-1' }));
    const bad = await httpPost(port, APPROVED_PATH, body, { 'x-jobber-hmac-sha256': 'not-the-signature' });

    assert.equal(bad.status, 401);
    assert.equal(await stageOf(), null, 'and no stage is written');
    assert.equal(await countOf('jobber_webhook_events'), 0, 'and no delivery is claimed');

    // ⚠ THE PARITY HALF, ON THE SAME FIXTURE. Without it this passes against a path that
    // rejects EVERYTHING — including a correctly signed request — which is the failure a
    // 401 assertion cannot tell apart from working verification.
    const good = await post(APPROVED_PATH, envelope({ topic: 'QUOTE_APPROVED', itemId: 'q-1' }));
    await waitFor(async () => (await stageOf()) !== null);
    assert.equal(good.status, 200);
    assert.equal(await stageOf(), 'inspection');
  });
});
