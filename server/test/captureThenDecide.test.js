'use strict';

// ── CAPTURE, THEN DECIDE, AT EVERY LIVE DOOR (3d Phase 1a Commit 5) ─────────
//
// Before this commit every live door decided by classifying the LIVE FETCH
// (`classifyPipelineStatus(relatedData)`), while the replay decided from SAVED FACTS. Two
// derivations of one question, and nothing held them together. R5i closes that: the doors now
// CAPTURE the fetched facts and then DECIDE from the rows, so live and replay run the same code
// over the same data.
//
// ⚠ THE ORDER IS THE MECHANISM. decideFromFacts reads saved rows, so a first-ever event must
// write its facts BEFORE deciding. Reversed, the decision runs against an empty fact set and
// returns 'lead' — which sits in the engine's GATE_EXCLUSIONS, so the sticky gate is SKIPPED
// and nothing is attributed. That failure is silent and self-consistent: the next event finds a
// stored answer and has no reason to look again.
//
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON, and a
// before/after pair inside each describe ends it for the next one. Recorded because this arc
// already paid for it once: a run reported `pass 8 · fail 0 · cancelled 4` with a whole describe
// that never executed.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;
const { attributeFromRequest } = require('../utils/requestAttribution');
const { decideFromFacts } = require('../utils/attributionDecide');
const { captureClientFacts } = require('../utils/factCapture');

const {
  seedToken,
  signJobberWebhook,
  httpPost,
  buildTestApp,
  startTestServer,
  stopTestServer,
  waitFor,
} = require('./helpers');

const TENANT = 'ctd-tenant';
const ACCT   = 'JACCT_CTD';
const CLIENT = 'jc-ctd-1';
const REP_USER = 'ju-ctd-rep';

// ⚠ THE STICKY STORES THE team_members ROW ID, NOT THE JOBBER USER ID, and asserting the latter
// is how this file first read `3 !== 'ju-ctd-rep'` against a sticky that had been written
// correctly. The id is a serial, so it differs per run and has to be captured, not hardcoded.
let repRowId;

let pool, server, port;

before(async () => {
  pool = await initTestDb();
  ({ server, port } = await startTestServer(buildTestApp()));
});

after(async () => {
  _resetTestOverrides();
  await stopTestServer(server);
  await pool.end();
});

// ── FIXTURES ─────────────────────────────────────────────────────────────────
const OWNER = { id: CLIENT };

const envelope = ({ topic, itemId, accountId = ACCT, occurredAt = new Date().toISOString() }) =>
  ({ data: { webHookEvent: { topic, appId: 'test-app', accountId, itemId, occurredAt } } });

function post(path, payloadObject) {
  const { body, signature } = signJobberWebhook(payloadObject);
  return httpPost(port, path, body, { 'x-jobber-hmac-sha256': signature });
}

// ⚠ THE CONNECTION SHAPE, AND EVERY NODE CARRIES `client { id }`. Each fact writer keys its row
// on it; a node without one is filtered out and the capture reports success having written
// nothing. Both capture queries select it as of Commit 5 — they did NOT before, which is the
// defect this file's first run found.
const approvedQuote = (over = {}) => ({
  id: 'q-ctd-1', quoteStatus: 'approved', createdAt: '2026-09-01T00:00:00.000Z',
  lastTransitioned: { approvedAt: '2026-09-02T00:00:00.000Z' },
  salesperson: { id: REP_USER }, client: OWNER, ...over,
});

const job = (over = {}) => ({
  id: 'job-ctd-1', jobNumber: 1, jobStatus: 'active', jobType: 'ONE_OFF', title: 'T',
  createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z',
  startAt: null, endAt: null, completedAt: null,
  total: 100, invoicedTotal: 0, uninvoicedTotal: 100,
  client: OWNER, quote: null, request: null, salesperson: { id: REP_USER },
  invoices: { nodes: [] }, customFields: [], ...over,
});

// A request node in the shape BASE_QUERY selects as of 7a. TWO people on the assessment, because
// one is the Mode A "single match" case and two is the co-assignment case — and the pair is what
// proves assigned_jobber_user_ids is stored atomically rather than collapsed to a first winner.
const requestNode = (over = {}) => ({
  id: 'req-node-1', requestStatus: 'assessment_completed', createdAt: '2026-09-04T00:00:00.000Z',
  client: OWNER, salesperson: { id: REP_USER },
  assessment: { id: 'assess-1', assignedUsers: { nodes: [{ id: REP_USER }, { id: 'ju-second' }] } },
  ...over,
});

const relatedClient = ({ quotes = [], jobs = [], invoices = [], requests = [] } = {}) => ({
  isCompany: false, isLead: false, tags: { nodes: [] }, customFields: [],
  jobs: { nodes: jobs }, quotes: { nodes: quotes },
  requests: { nodes: requests }, invoices: { nodes: invoices },
});

const installStage = (relatedData, { clientId = CLIENT } = {}) => _setTestOverrides({
  getFreshContractorAccessToken: async () => 'tok',
  fetchStageSubjectClient: async () => clientId,
  fetchClientRelatedData: async () => relatedData,
  fetchAttributionData: async () => ({ requests: [], assessments: [] }),
});

const stageOf = async (id = CLIENT) => (await pool.query(
  `SELECT pipeline_stage FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2`,
  [TENANT, id])).rows[0]?.pipeline_stage ?? null;

const stickyOf = async (id = CLIENT) => (await pool.query(
  `SELECT sticky_rep_id FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
  [TENANT, id])).rows[0]?.sticky_rep_id ?? null;

const countFacts = async (table) => parseInt((await pool.query(
  `SELECT COUNT(*) c FROM ${table} WHERE contractor_id = $1`, [TENANT])).rows[0].c, 10);

beforeEach(async () => {
  _resetTestOverrides();
  // ⚠ FK-SAFE ORDER, AND EVERY TABLE HERE IS contractor-SCOPED. A silent catch-and-retry over
  // an unscoped DELETE was the first writing of this hook and it hid a real schema error.
  for (const t of ['crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts',
    'crm_quote_facts', 'crm_request_facts', 'client_rep_assignments', 'flagged_assignments',
    'admin_messages', 'contact_tags', 'jobber_webhook_events', 'jobber_clients',
    'error_log', 'sessions', 'team_members', 'titles',
    'contractor_crm_settings']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [TENANT]);
  }
  // ⚠ tokens IS CLEARED UNSCOPED, like every other suite that seeds one. Its PK is a sequence
  // id, and a contractor-scoped delete left the row behind — the second case then collided on
  // tokens_pkey inside the hook, which fails every case in the file including ones that never
  // touch a token.
  await pool.query('DELETE FROM tokens');
  await pool.query(`DELETE FROM contractors WHERE id = $1`, [TENANT]);
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  // ⚠ THE ACCOUNT MAPPING LIVES ON contractor_crm_settings, NOT ON contractors. Webhook tenant
  // resolution reads it off the envelope's accountId; without this row every delivery is
  // refused and quarantined, and every case in the file fails in the hook.
  await pool.query(
    `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
    [TENANT, ACCT]
  );
  await seedToken(pool, TENANT);
  await pool.query(
    `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
     VALUES ($1, $2, 'Ctd', NOW())`, [CLIENT, TENANT]
  );
  // An attributable, mapped rep so the sticky can actually be written.
  // ⚠ is_attributable IS WHAT THE ENGINE FILTERS ON, and `active` is the column name — not
  // `is_active`. Both were wrong in the first writing of this hook and the schema said so.
  const { rows: repRows } = await pool.query(
    `INSERT INTO team_members (contractor_id, full_name, email, tier, active, is_field_rep,
                               jobber_user_id, is_attributable, password_hash)
     VALUES ($1, 'Ctd Rep', $2, 'general', TRUE, TRUE, $3, TRUE, 'x')
     RETURNING id`,
    [TENANT, `rep-${TENANT}@ctd.test`, REP_USER]
  );
  repRowId = repRows[0].id;
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Commit 5 — the live doors capture before they decide', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ── (i) CAPTURE BEFORE DECIDE, ON A FIRST-EVER EVENT ──────────────────────
  it('a FIRST-EVER event decides from facts it captured in the same pass', async () => {
    // ⚠ THE CLIENT HAS NO FACTS AT ALL BEFOREHAND, WHICH IS WHAT MAKES THE ORDER OBSERVABLE.
    // Decide-then-capture reads an empty fact set here and yields 'lead'. This is guard-proof (i).
    assert.equal(await countFacts('crm_job_facts'), 0, 'precondition: no facts exist yet');

    installStage(relatedClient({ jobs: [job()] }));
    await post('/webhooks/jobber/job-create', envelope({ topic: 'JOB_CREATE', itemId: 'job-ctd-1' }));
    await waitFor(async () => (await stageOf()) !== null);

    assert.equal(await stageOf(), 'sold', 'a job makes it sold — and only a CAPTURED job can');
    assert.equal(await countFacts('crm_job_facts'), 1, 'and the fact is on disk');
  });

  it('the captured facts are what the decision read — not the live object', async () => {
    // The paired positive for the case above: the fact row exists for EVERY entity the fetch
    // carried, so the decision had a complete set to read rather than a lucky one.
    installStage(relatedClient({ quotes: [approvedQuote()], jobs: [job()] }));
    await post('/webhooks/jobber/quote-update', envelope({ topic: 'QUOTE_UPDATE', itemId: 'q-ctd-1' }));
    await waitFor(async () => (await countFacts('crm_quote_facts')) === 1);

    assert.equal(await countFacts('crm_quote_facts'), 1, 'quote facts captured');
    assert.equal(await countFacts('crm_job_facts'), 1, 'job facts captured');
  });

  // ── (ii) THE STICKY STILL FIRES ───────────────────────────────────────────
  it('STICKY — an approved quote plus a job, through a live door, writes the sticky', async () => {
    // ⚠ THE JOB IS WHAT TAKES THE CLIENT OUT OF GATE_EXCLUSIONS. 'lead', 'inspection' and
    // 'not_sold' are all excluded, so without a captured JOB the gate never opens and the
    // approved quote's salesperson is never made sticky. This is guard-proof (ii): make capture
    // skip job facts and the sticky stops being written while everything else still looks right.
    installStage(relatedClient({ quotes: [approvedQuote()], jobs: [job()] }));
    await post('/webhooks/jobber/quote-approved', envelope({ topic: 'QUOTE_APPROVED', itemId: 'q-ctd-1' }));
    await waitFor(async () => (await stickyOf()) !== null, { timeout: 5000 });

    assert.equal(await stickyOf(), repRowId, 'the approved quote\'s salesperson is sticky');
  });

  // ── (v) QUOTE-APPROVED RUNS THE ENGINE (R5j) ──────────────────────────────
  it('R5j — QUOTE_APPROVED runs the engine, not only the stage', async () => {
    // ⚠ BEFORE COMMIT 5 THIS TOPIC WAS STAGE-ONLY. An approval is the strongest signal a client
    // has a salesperson, and it moved a display column and nothing else. Guard-proof (v) routes
    // it back to stage-only and this case goes red while the stage assertion still passes —
    // which is exactly why both are asserted here.
    installStage(relatedClient({ quotes: [approvedQuote()], jobs: [job()] }));
    await post('/webhooks/jobber/quote-approved', envelope({ topic: 'QUOTE_APPROVED', itemId: 'q-ctd-1' }));
    await waitFor(async () => (await stickyOf()) !== null, { timeout: 5000 });

    assert.equal(await stageOf(), 'sold', 'the stage is still written');
    assert.equal(await stickyOf(), repRowId, 'AND the engine ran');
  });

  it('a NON-approval quote event does NOT run the engine', async () => {
    // The paired negative. Without it, "quote-approved runs the engine" would pass against a
    // handler that ran the engine on every quote topic — a different behaviour that happens to
    // satisfy the positive.
    installStage(relatedClient({ quotes: [approvedQuote()], jobs: [job()] }));
    await post('/webhooks/jobber/quote-update', envelope({ topic: 'QUOTE_UPDATE', itemId: 'q-ctd-1' }));
    await waitFor(async () => (await stageOf()) !== null);

    assert.equal(await stickyOf(), null, 'QUOTE_UPDATE stages, it does not attribute');
  });

  // ── (iii) A FAILED CAPTURE WRITES NO DECISION ─────────────────────────────
  it('CAPTURE FAILURE — a stage door writes no stage and logs an error_log row', async () => {
    // ⚠ A TRUNCATED INVOICE JOB SET IS A REAL CAPTURE FAILURE, NOT A SYNTHETIC ONE.
    // writeInvoiceJobLinks throws on it, because a dropped job id breaks the invoice-to-sale
    // link. Using the real failure rather than a stubbed throw is what makes this case about
    // the contract instead of about the mock.
    const truncated = {
      id: 'inv-ctd-1', invoiceNumber: 1, invoiceStatus: 'paid',
      createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z',
      issuedDate: null, dueDate: null, receivedDate: null, client: OWNER,
      amounts: { total: 100, subtotal: 100, invoiceBalance: 0, paymentsTotal: 100,
        depositAmount: 0, discountAmount: 0, taxAmount: 0 },
      jobs: { nodes: [{ id: 'job-ctd-1' }], pageInfo: { hasNextPage: true } },
      archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
    };
    installStage(relatedClient({ jobs: [job()], invoices: [truncated] }));

    await post('/webhooks/jobber/job-create', envelope({ topic: 'JOB_CREATE', itemId: 'job-ctd-1' }));
    await waitFor(async () => (await pool.query(
      `SELECT 1 FROM error_log WHERE contractor_id = $1 AND source LIKE '%capture%'`, [TENANT]
    )).rowCount > 0, { timeout: 5000 });

    assert.equal(await stageOf(), null, 'NO stage is decided from a failed capture');
  });

  it('CAPTURE FAILURE — the same fixture WITHOUT the truncation does decide', async () => {
    // The paired positive: the case above must fail because capture failed, not because the
    // fixture could never have produced a stage.
    const whole = {
      id: 'inv-ctd-1', invoiceNumber: 1, invoiceStatus: 'paid',
      createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z',
      issuedDate: null, dueDate: null, receivedDate: null, client: OWNER,
      amounts: { total: 100, subtotal: 100, invoiceBalance: 0, paymentsTotal: 100,
        depositAmount: 0, discountAmount: 0, taxAmount: 0 },
      jobs: { nodes: [{ id: 'job-ctd-1' }], pageInfo: { hasNextPage: false } },
      archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
    };
    installStage(relatedClient({ jobs: [job({ invoices: { nodes: [whole] } })], invoices: [whole] }));

    await post('/webhooks/jobber/job-create', envelope({ topic: 'JOB_CREATE', itemId: 'job-ctd-1' }));
    await waitFor(async () => (await stageOf()) !== null, { timeout: 5000 });

    assert.equal(await stageOf(), 'paid', 'a settled invoice reads paid through the same door');
  });

  // ── (vii) DANNY'S CONDITION — A FAILED FETCH TOUCHES NO TAGS ──────────────
  it('a FAILED FETCH leaves an existing paying_client tag untouched', async () => {
    // ⚠ DANNY'S RULING, 2026-09-25: identity and tags may be written only from a COMPLETE
    // fetch. Since 4b `paying_client` is REMOVED when no invoice qualifies, so deriving tags
    // from a partial or failed fetch could strip a real one — a silent downgrade of a paying
    // client, with nothing to notice it by.
    await pool.query(
      `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
       VALUES ($1, $2, 'paying_client', 'jobber_crm', NOW())`, [CLIENT, TENANT]
    );

    // The related fetch FAILS. Commit 2 made a GraphQL error throw; the caller catches to null.
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchFullClient: async () => ({
        id: CLIENT, firstName: 'Ctd', lastName: 'Client', emails: [], phones: [],
        isCompany: false, isLead: false, isArchived: false,
        quotes: { nodes: [] }, jobs: { nodes: [] }, invoices: { nodes: [] },
      }),
      fetchClientRelatedData: async () => { throw new Error('Jobber GraphQL error: boom'); },
    });

    await post('/webhooks/jobber/client-update', envelope({ topic: 'CLIENT_UPDATE', itemId: CLIENT }));
    // ⚠ AN ABSENCE NEEDS A TIMING CONTROL, AND TWO EARLIER WRITINGS OF THIS CASE DID NOT HAVE
    // ONE. The first waited on any error_log row — written by the FETCH failure, long before the
    // tag block. The second waited on last_synced_at — bumped by the UPSERT, which also precedes
    // it. Both read the tag before the code under test could have touched it, so the guard-proof
    // read GREEN against a build that derived tags from nothing.
    //
    // ⚠ THE OBSERVABLE IS `client_type:`, BECAUSE AN EMPTY DERIVATION STILL WRITES IT.
    // deriveAndSaveTags writes client_type:residential whenever isCompany is not true — so if the
    // tag block runs at all, even on an empty client, that tag appears. Waiting for it and
    // EXPECTING A TIMEOUT is the absence assertion; the paired positive below proves the same
    // wait is long enough to see it when the derivation does run.
    let derivationRan = true;
    try {
      await waitFor(async () => (await pool.query(
        `SELECT 1 FROM contact_tags
          WHERE contractor_id = $1 AND jobber_client_id = $2 AND tag LIKE 'client_type:%'`,
        [TENANT, CLIENT])).rowCount > 0, { timeout: 2000 });
    } catch {
      derivationRan = false;
    }
    assert.equal(derivationRan, false, 'no tag derivation may run off a failed fetch');

    const { rows } = await pool.query(
      `SELECT tag FROM contact_tags WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [TENANT, CLIENT]
    );
    assert.ok(rows.some((r) => r.tag === 'paying_client'),
      'a failed fetch must derive NO tags — it cannot know the client stopped paying');
  });

  it('PAIRED POSITIVE — a SUCCESSFUL fetch with no paid invoice DOES strip paying_client', async () => {
    // ⚠ WITHOUT THIS, THE CASE ABOVE PASSES AGAINST A BUILD THAT NEVER REMOVES THE TAG AT ALL.
    // The removal is 4b's behaviour and it must still work; what must not happen is removing on
    // the strength of a fetch that failed. This is the pair that separates those two states.
    await pool.query(
      `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
       VALUES ($1, $2, 'paying_client', 'jobber_crm', NOW())`, [CLIENT, TENANT]
    );
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchFullClient: async () => ({
        id: CLIENT, firstName: 'Ctd', lastName: 'Client', emails: [], phones: [],
        isCompany: false, isLead: false, isArchived: false,
        quotes: { nodes: [] }, jobs: { nodes: [] }, invoices: { nodes: [] },
      }),
      fetchClientRelatedData: async () => relatedClient({ jobs: [job()] }),
    });

    await post('/webhooks/jobber/client-update', envelope({ topic: 'CLIENT_UPDATE', itemId: CLIENT }));
    // ⚠ THE SAME NEEDLE AND A COMPARABLE WAIT AS THE CASE ABOVE — that pairing is what makes its
    // timeout mean "the derivation did not run" rather than "the derivation had not run yet".
    await waitFor(async () => (await pool.query(
      `SELECT 1 FROM contact_tags
        WHERE contractor_id = $1 AND jobber_client_id = $2 AND tag LIKE 'client_type:%'`,
      [TENANT, CLIENT])).rowCount > 0, { timeout: 2000 });

    const { rows } = await pool.query(
      `SELECT tag FROM contact_tags WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [TENANT, CLIENT]
    );
    assert.ok(!rows.some((r) => r.tag === 'paying_client'),
      'a complete fetch with no qualifying invoice removes it, exactly as 4b ruled');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Commit 5 — parity, and paging under the smaller page size', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ── (iv) PARITY — ONE SET OF FACTS, ONE DECISION ──────────────────────────
  it('PARITY — the same saved facts decide identically for a live door and a replay', async () => {
    // ⚠ THIS IS R5i STATED AS A TEST. Both sides call decideFromFacts over the same rows; the
    // point is that there is now only ONE derivation to disagree about. Guard-proof (iv) breaks
    // one side's input and the two answers diverge.
    // ⚠ THE FACTS AND THE LIVE OBJECT MUST DISAGREE, OR THIS CASE PROVES NOTHING.
    // Its first writing handed the door the SAME data it had captured, so deciding from the live
    // object and deciding from the facts gave the identical answer and the guard-proof stayed
    // GREEN. Here the client already HAS a saved job (so the facts say 'sold') while the live
    // fetch carries NO job (so the live object says 'inspection'). Only a door reading the facts
    // can answer 'sold'.
    await captureClientFacts(pool, {
      contractorId: TENANT,
      client: relatedClient({ jobs: [job()] }),
    });
    const viaReplay = await decideFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
    assert.equal(viaReplay.currentStatus, 'sold', 'precondition: the FACTS say sold');

    installStage(relatedClient({ quotes: [approvedQuote()] }));
    await post('/webhooks/jobber/quote-update', envelope({ topic: 'QUOTE_UPDATE', itemId: 'q-ctd-1' }));
    await waitFor(async () => (await countFacts('crm_quote_facts')) === 1);

    assert.equal(await stageOf(), viaReplay.currentStatus,
      'the door and the replay read the same facts through the same code — the live object, which '
      + 'carries no job, would have said inspection');
  });

  // ── THE WRITERS HANDLE MORE THAN ONE PAGE'S WORTH ─────────────────────────
  // ⚠ THESE TWO CASES ARE ABOUT THE WRITERS, NOT ABOUT PAGING, AND THE NAME USED TO CLAIM
  // OTHERWISE. They call captureClientFacts directly with an already-assembled node list, so
  // pageClientConnection never runs and guard-proof (vi) — stop after the first page — left them
  // GREEN. Renamed rather than deleted: "a 45-node set is written in full" is worth pinning now
  // that PAGE_SIZE is 20, because it is the writers that must not themselves cap.
  // ⚠ PAGING ITSELF IS FENCED IN server/test/captureFetchContract.test.js AND
  // crmJobInvoiceFacts.test.js — guard-proof (vi) takes 13 cases red there. A name that implied
  // this file covered it is the shape where a title occupies the space real coverage would go.
  it('the writers persist a 45-job set in full — more than two pages at the new PAGE_SIZE', async () => {
    const many = Array.from({ length: 45 }, (_, i) => job({ id: `job-ctd-p${i}` }));
    await captureClientFacts(pool, { contractorId: TENANT, client: relatedClient({ jobs: many }) });

    assert.equal(await countFacts('crm_job_facts'), 45,
      'all 45 written — a page-sized answer (20) would mean a writer capped its own input');
  });

  it('the writers persist 25 quotes and 25 invoices in full', async () => {
    const quotes = Array.from({ length: 25 }, (_, i) => approvedQuote({ id: `q-ctd-p${i}` }));
    const invoices = Array.from({ length: 25 }, (_, i) => ({
      id: `inv-ctd-p${i}`, invoiceNumber: i, invoiceStatus: 'paid',
      createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z',
      issuedDate: null, dueDate: null, receivedDate: null, client: OWNER,
      amounts: { total: 10, subtotal: 10, invoiceBalance: 0, paymentsTotal: 10,
        depositAmount: 0, discountAmount: 0, taxAmount: 0 },
      jobs: { nodes: [], pageInfo: { hasNextPage: false } },
      archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
    }));
    await captureClientFacts(pool, { contractorId: TENANT, client: relatedClient({ quotes, invoices }) });

    assert.equal(await countFacts('crm_quote_facts'), 25);
    assert.equal(await countFacts('crm_invoice_facts'), 25);
  });

  // ── Q6 AND TENANCY ────────────────────────────────────────────────────────
  it('Q6 — a stored pipeline_stage is NOT a decision input', async () => {
    // ⚠ THE COLUMN IS OUTPUT ONLY SINCE COMMIT 4. Seeding it to a value the facts contradict is
    // the only way to observe that: if it were still read, the answer would be 'paid'.
    await pool.query(
      `UPDATE jobber_clients SET pipeline_stage = 'paid' WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [TENANT, CLIENT]
    );
    await captureClientFacts(pool, { contractorId: TENANT, client: relatedClient({ jobs: [job()] }) });

    const decided = await decideFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
    assert.equal(decided.currentStatus, 'sold', 'decided from the facts, not from the display column');
  });

  it('TENANCY — capture and decide never cross a contractor boundary', async () => {
    const OTHER = 'ctd-other';
    await pool.query(`DELETE FROM contractors WHERE id = $1`, [OTHER]).catch(() => {});
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [OTHER]);

    await captureClientFacts(pool, { contractorId: TENANT, client: relatedClient({ jobs: [job()] }) });

    const mine = await decideFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
    const theirs = await decideFromFacts(pool, { contractorId: OTHER, jobberClientId: CLIENT });

    assert.equal(mine.currentStatus, 'sold');
    assert.equal(theirs.currentStatus, 'lead', 'the same client id under another tenant sees nothing');

    await pool.query(`DELETE FROM crm_job_facts WHERE contractor_id = $1`, [OTHER]);
    await pool.query(`DELETE FROM contractors WHERE id = $1`, [OTHER]);
  });

  // ── THE REQUEST DOOR, WHICH repRequestSweep ALSO USES ─────────────────────
  it('the request door captures before it decides, and the sweep shares that path', async () => {
    // ⚠ attributeFromRequest IS THE ONLY ATTRIBUTION ENTRY POINT FOR BOTH the request webhooks
    // and repRequestSweep, so proving it here proves the sweep too — the sweep calls this exact
    // function and injects the same fetch.
    const outcome = await attributeFromRequest(pool, {
      contractorId: TENANT,
      request: { id: 'req-ctd-1', createdAt: '2026-09-05T00:00:00.000Z', client: { id: CLIENT } },
      fetchFullClient: async () => ({
        id: CLIENT, createdAt: '2026-09-01T00:00:00.000Z', customFields: [],
        quotes: { nodes: [approvedQuote()] },
        jobs: { nodes: [job()] },
        invoices: { nodes: [] },
        // ⚠ THE FIXTURE MIRRORS WHAT BASE_QUERY SELECTS AS OF 7a. Before 7a it selected no
        // `requests` connection, so this key was absent here too — and its absence was the defect,
        // not the fixture's shape.
        requests: { nodes: [requestNode()] },
      }),
      fetchAttributionData: async () => ({ requests: [], assessments: [] }),
      token: 'tok',
    });

    assert.equal(outcome, 'attributed');
    assert.equal(await countFacts('crm_job_facts'), 1, 'the request door captured job facts');
    assert.equal(await countFacts('crm_quote_facts'), 1, 'and quote facts');
    assert.equal(await stageOf(), 'sold', 'and decided from them');
  });

  it('7a — the request door writes crm_request_facts, with the assessment and its people', async () => {
    // ⚠ THIS IS THE CASE 7a EXISTS FOR. Before it, fetchFullClient selected no `requests`
    // connection, captureClientFacts read client.requests?.nodes as undefined, and
    // writeRequestFacts wrote ZERO rows while reporting success — on the ONE door whose subject is
    // a request. Every request webhook and every repRequestSweep pass lost its facts silently.
    // ⚠ IT ASSERTS THE STORED COLUMNS, NOT A COUNT. A row count would pass against a row whose
    // assessment and assigned people were dropped, and those two are exactly what the engine's
    // Mode A reads — so the count alone would be the weaker half of the property.
    const outcome = await attributeFromRequest(pool, {
      contractorId: TENANT,
      request: { id: 'req-ctd-3', createdAt: '2026-09-05T00:00:00.000Z', client: { id: CLIENT } },
      fetchFullClient: async () => ({
        id: CLIENT, createdAt: '2026-09-01T00:00:00.000Z', customFields: [],
        quotes: { nodes: [] }, jobs: { nodes: [job()] }, invoices: { nodes: [] },
        requests: { nodes: [requestNode()] },
      }),
      fetchAttributionData: async () => ({ requests: [], assessments: [] }),
      token: 'tok',
    });
    assert.equal(outcome, 'attributed');

    const { rows } = await pool.query(
      `SELECT jobber_request_id, jobber_client_id, salesperson_jobber_user_id,
              assessment_id, assigned_jobber_user_ids
         FROM crm_request_facts WHERE contractor_id = $1`,
      [TENANT]
    );
    assert.equal(rows.length, 1, 'exactly one request fact');
    assert.equal(rows[0].jobber_request_id, 'req-node-1');
    assert.equal(rows[0].jobber_client_id, CLIENT, 'keyed to the right client');
    assert.equal(rows[0].salesperson_jobber_user_id, REP_USER);
    assert.equal(rows[0].assessment_id, 'assess-1', 'the assessment id is stored');
    assert.deepEqual(rows[0].assigned_jobber_user_ids, [REP_USER, 'ju-second'],
      'and the people on it, atomically — this is what Mode A reads to tell one rep from two');
  });

  it('7a — a request node missing client.id is DROPPED, not stored half-formed', async () => {
    // The paired negative. writeRequestFacts filters on id + createdAt + client.id, so a node
    // missing any of the three writes nothing — and `client { id }` is precisely the field the
    // quote and request selections were BOTH missing before Commit 5/7a. Without this case, the
    // positive above would pass against a writer that stored rows with a null client.
    await attributeFromRequest(pool, {
      contractorId: TENANT,
      request: { id: 'req-ctd-4', createdAt: '2026-09-05T00:00:00.000Z', client: { id: CLIENT } },
      fetchFullClient: async () => ({
        id: CLIENT, createdAt: '2026-09-01T00:00:00.000Z', customFields: [],
        quotes: { nodes: [] }, jobs: { nodes: [job()] }, invoices: { nodes: [] },
        requests: { nodes: [{ ...requestNode(), client: undefined }] },
      }),
      fetchAttributionData: async () => ({ requests: [], assessments: [] }),
      token: 'tok',
    });
    assert.equal(await countFacts('crm_request_facts'), 0,
      'a node with no client id cannot be keyed, so it is dropped rather than stored wrong');
  });

  it('the request door returns capture_failed and decides nothing when capture throws', async () => {
    const outcome = await attributeFromRequest(pool, {
      contractorId: TENANT,
      request: { id: 'req-ctd-2', createdAt: '2026-09-05T00:00:00.000Z', client: { id: CLIENT } },
      fetchFullClient: async () => ({
        id: CLIENT, createdAt: '2026-09-01T00:00:00.000Z', customFields: [],
        quotes: { nodes: [] }, jobs: { nodes: [job()] },
        invoices: { nodes: [{
          id: 'inv-bad', invoiceNumber: 1, invoiceStatus: 'paid',
          createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z',
          issuedDate: null, dueDate: null, receivedDate: null, client: OWNER,
          amounts: { total: 10, subtotal: 10, invoiceBalance: 0, paymentsTotal: 10,
            depositAmount: 0, discountAmount: 0, taxAmount: 0 },
          jobs: { nodes: [], pageInfo: { hasNextPage: true } },
          archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
        }] },
      }),
      fetchAttributionData: async () => ({ requests: [], assessments: [] }),
      token: 'tok',
    });

    assert.equal(outcome, 'capture_failed', 'the door names its own failure');
    assert.equal(await stageOf(), null, 'and writes no stage');
    const { rowCount } = await pool.query(
      `SELECT 1 FROM error_log WHERE contractor_id = $1 AND source = 'requestAttribution/capture'`,
      [TENANT]
    );
    assert.ok(rowCount > 0, 'and says why, under its own source');
  });
});
