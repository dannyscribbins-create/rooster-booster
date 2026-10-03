'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE INVOICE-PAID DOOR CLAIMS ITS DELIVERY (Danny, ruled 2026-10-01, built after C2)
//
// ⚠ THIS DOOR WAS THE ONLY ONE THAT CLAIMED NOTHING, AND THAT IS HOW C1'S LAUNCH-GATE CAME TO BE
// ANSWERED FROM LOGS RATHER THAN FROM THE DATABASE. `claimWebhookDelivery` had exactly two call sites —
// the request and stage handlers — so `jobber_webhook_events` held **0 rows for `topic ILIKE
// '%INVOICE%'` across 5,379 events since 2026-09-18**. A zero from a table that structurally cannot
// hold the row is not an observation, and it was checked only because the figure looked too clean.
//
// ⚠ WHAT THIS COMMIT CHANGES, AND WHAT IT DOES NOT — the distinction is the whole point:
//   · IT ADDS a durable record that the door ran, and makes a duplicate skip EARLY: before the
//     engagement-settings read, before the invoice fetch, before the client fetch, before the capture,
//     before the decision, before the credit. The old behaviour re-ran two Jobber round trips and a
//     full re-capture for nothing.
//   · IT DOES NOT make the door exactly-once, and is NOT what prevents a double payout. That is
//     `referral_conversions`' UNIQUE constraint plus `evaluateReferral`'s STEP 8, with the email gated
//     on a row being INSERTED — all unchanged. **This is observability plus a cheaper idempotence.**
//
// ⚠ AND THE EXISTING `invoicePaidWebhook.test.js` DUPLICATE CASE DOES NOT EXERCISE ANY OF THIS, which
// is worth saying rather than leaving someone to assume it does: its payloads carry no
// `occurredAt`/`occuredAt`, so the claim fails OPEN there and that case remains a test of the
// UNIQUE-constraint path. Every case here supplies the timestamp deliberately.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb, captureResend } = require('./setup');
captureResend();

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;
const { JOBBER_CLIENT_GID_PREFIX } = require('../utils/derivableClient');

const {
  seedContractor, seedToken, seedEngagementSettings, seedReferralSchedule, seedUser,
  signJobberWebhook, httpPost, buildTestApp, startTestServer, stopTestServer, waitFor,
} = require('./helpers');

const TENANT = 'dc-roofing';
const ACCOUNT = 'JACCT_DC';
const CLIENT = Buffer.from(`${JOBBER_CLIENT_GID_PREFIX}970001`).toString('base64');
const INVOICE_ITEM = 'inv-item-dc1';
const INVOICE_NODE = 'inv-node-dc1';
const JOB = 'job-node-dc1';
const WORK_CATEGORY_FIELD = Buffer.from('gid://Jobber/CustomFieldConfigurationDropdown/730114').toString('base64');
const REFERRER_FIELD = Buffer.from('gid://Jobber/CustomFieldConfigurationText/3655374').toString('base64');
const CLIENT_CREATED_AT = '2026-03-01T00:00:00.000Z';
const OCCURRED_AT = '2026-10-02T12:00:00.000Z';

describe('the invoice-paid door claims its delivery', () => {
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

  beforeEach(async () => {
    _resetTestOverrides();
    for (const t of [
      'referral_conversions',
      'referral_schedule_job_types', 'referral_schedules',
      'category_mismatches',
      'crm_custom_field_facts', 'crm_invoice_job_links', 'crm_invoice_facts',
      'crm_job_facts', 'crm_quote_facts', 'crm_request_facts',
      'client_rep_assignments', 'flagged_assignments',
      'contact_tags', 'contacts',
      'pipeline_cache', 'jobber_clients',
      'experience_invite_tokens', 'experience_prompts',
      'jobber_webhook_events',
      'activity_log', 'error_log',
      'contractor_jobber_fields', 'contractor_settings',
      'tokens', 'engagement_settings',
      'user_badges', 'users',
      'sessions', 'titles', 'team_members',
      'contractor_crm_settings',
      'contractors',
    ]) {
      await pool.query(`DELETE FROM ${t}`);
    }
    await seedContractor(pool, TENANT);
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id, referral_start_date)
       VALUES ($1, $2, '2026-01-01'::date)
       ON CONFLICT (contractor_id) DO UPDATE
         SET jobber_account_id = EXCLUDED.jobber_account_id,
             referral_start_date = EXCLUDED.referral_start_date`,
      [TENANT, ACCOUNT]
    );
    await seedToken(pool, { contractorId: TENANT });
    await seedEngagementSettings(pool, { contractorId: TENANT, experienceFlowEnabled: false });
    await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@dc.test', contractorId: TENANT });
    await seedReferralSchedule(pool, { contractorId: TENANT, jobberLabel: 'Roof Replacement', flatAmount: 919 });
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (contractor_id) DO UPDATE
         SET contractor_field_mappings = EXCLUDED.contractor_field_mappings`,
      [TENANT, JSON.stringify({
        work_category: { field_id: WORK_CATEGORY_FIELD, entity: 'ALL_JOBS', label: 'Job Type' },
      })]
    );
    await pool.query(
      `INSERT INTO contractor_jobber_fields
         (contractor_id, jobber_field_id, label, field_type, entity, transferable, archived)
       VALUES ($1, $2, 'Job Type', 'DROPDOWN', 'ALL_JOBS', TRUE, FALSE),
              ($1, $3, 'Referred by', 'TEXT', 'ALL_CLIENTS', FALSE, FALSE)`,
      [TENANT, WORK_CATEGORY_FIELD, REFERRER_FIELD]
    );
  });

  const PAID_INVOICE = {
    invoiceStatus: 'paid', invoiceNumber: 'INV-DC', issuedDate: '2026-06-10',
    waitingForFinancedPayment: false,
    amounts: { total: 10000, invoiceBalance: 0 },
    client: { id: CLIENT, name: 'Test Client' },
    jobs: { nodes: [{ id: JOB, customFields: [] }] },
    archivedJobs: { nodes: [] },
  };

  const relatedClient = () => ({
    id: CLIENT, createdAt: CLIENT_CREATED_AT,
    isCompany: false, isLead: false, isArchived: false,
    tags: { nodes: [] },
    customFields: [{
      label: 'Referred by', valueText: 'Jane Referrer', valueDropdown: null,
      customFieldConfiguration: { id: REFERRER_FIELD },
    }],
    quotes: { nodes: [] }, requests: { nodes: [] },
    jobs: { nodes: [{
      id: JOB, jobNumber: 1, jobStatus: 'active', jobType: 'ONE_OFF', title: 'Roof',
      createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
      startAt: null, endAt: null, completedAt: null,
      total: 10000, invoicedTotal: 10000, uninvoicedTotal: 0,
      client: { id: CLIENT }, quote: null, request: null, salesperson: null,
      invoices: { nodes: [] },
      customFields: [{
        label: 'Job Type', valueDropdown: 'Roof Replacement', valueText: null,
        customFieldConfiguration: { id: WORK_CATEGORY_FIELD },
      }],
    }] },
    invoices: { nodes: [{
      id: INVOICE_NODE, client: { id: CLIENT }, invoiceNumber: 'INV-DC', invoiceStatus: 'paid',
      waitingForFinancedPayment: false,
      amounts: { total: 10000, invoiceBalance: 0 },
      issuedDate: '2026-06-10T00:00:00.000Z', dueDate: null,
      receivedDate: '2026-06-11T00:00:00.000Z',
      createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-11T00:00:00.000Z',
      customFields: [],
      jobs: { nodes: [{ id: JOB }], pageInfo: { hasNextPage: false } },
      archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
    }] },
  });

  // ⚠ `occurredAt` IS SUPPLIED DELIBERATELY. Without it `claimWebhookDelivery` returns
  // `{ claimed: true, keyed: false }` and the dedupe is inert — which is a real path, covered by its
  // own case below, and NOT the path these cases are about.
  function post({ itemId = INVOICE_ITEM, occurredAt = OCCURRED_AT, invoiceStatus } = {}) {
    const ev = { topic: 'INVOICE_UPDATE', itemId, accountId: ACCOUNT };
    if (occurredAt !== null) ev.occurredAt = occurredAt;
    const payload = {
      data: { webHookEvent: ev, ...(invoiceStatus ? { invoice: { invoiceStatus } } : {}) },
      contractor_id: TENANT,
    };
    const { body, signature } = signJobberWebhook(payload);
    return httpPost(port, '/webhooks/jobber/invoice-paid', body, { 'x-jobber-hmac-sha256': signature });
  }

  // Counts how many times the door reached Jobber, which is how "skipped BEFORE the capture" is observed.
  function armCounters() {
    const calls = { invoice: 0, fullClient: 0, related: 0 };
    _setTestOverrides({
      fetchInvoiceWithJobs: async () => { calls.invoice += 1; return PAID_INVOICE; },
      fetchFullClient: async () => {
        calls.fullClient += 1;
        return {
          id: CLIENT, createdAt: CLIENT_CREATED_AT, firstName: 'Test', lastName: 'Client',
          emails: [{ address: 'dc@example.com', isPrimary: true }],
          phones: [{ number: '5550003333', isPrimary: true }],
          customFields: [], quotes: { nodes: [] }, jobs: { nodes: [] },
        };
      },
      fetchClientRelatedData: async () => { calls.related += 1; return relatedClient(); },
      sendEmail: async () => ({ id: 'e' }),
    });
    return calls;
  }

  const events = async () => (await pool.query(
    'SELECT contractor_id, topic, item_id, occurred_at FROM jobber_webhook_events ORDER BY occurred_at'
  )).rows;

  const conversions = async () =>
    (await pool.query('SELECT * FROM referral_conversions ORDER BY id')).rows;

  // ═══════════════════════════════════════════════════════════════════════════

  it('the FIRST delivery is recorded in jobber_webhook_events, under this door\'s OWN topic', async () => {
    // ⚠ THE TOPIC LITERAL IS ASSERTED, NOT JUST THE ROW'S EXISTENCE. Pointing a new route's key at an
    // existing topic is a defect this repo has measured: the quote-approved commit aimed its literal at
    // `'quote-update'` and a real QUOTE_APPROVED was swallowed under a log line calling it a duplicate.
    const calls = armCounters();
    const resp = await post();
    assert.equal(resp.status, 200);
    await waitFor(() => calls.invoice > 0, { timeout: 6000 });
    await waitFor(async () => (await events()).length > 0, { timeout: 6000 });

    const rows = await events();
    assert.equal(rows.length, 1, 'exactly one delivery row');
    assert.equal(rows[0].topic, 'invoice-paid', "the row carries THIS door's topic, shared with nothing");
    assert.equal(rows[0].item_id, INVOICE_ITEM, 'and the invoice id from the payload');
    assert.equal(rows[0].contractor_id, TENANT, 'and it is tenant-scoped');
    assert.equal(
      new Date(rows[0].occurred_at).toISOString(), OCCURRED_AT,
      "and the event's own timestamp, which is what makes a genuine second event distinguishable"
    );
  });

  it('a DUPLICATE delivery runs the capture ONCE — skipped before any Jobber call', async () => {
    // ⚠ THIS IS THE CASE DANNY NAMED, AND THE OBSERVABLE IS THE JOBBER CALL COUNT RATHER THAN THE
    // CONVERSION COUNT. A conversion count of 1 was ALREADY true before this commit — the UNIQUE
    // constraint and STEP 8 made it so — so asserting that would pass against the pre-fix code and
    // prove nothing. What changed is that the duplicate no longer does the WORK: the claim returns
    // before the engagement-settings read, the invoice fetch, the client fetch and the capture.
    const calls = armCounters();

    const r1 = await post();
    assert.equal(r1.status, 200);
    await waitFor(() => calls.related > 0, { timeout: 6000 });
    await waitFor(async () => (await events()).length > 0, { timeout: 6000 });
    const afterFirst = { ...calls };
    assert.ok(afterFirst.invoice >= 1, 'precondition: the first delivery really did fetch the invoice');
    assert.ok(afterFirst.related >= 1, 'precondition: and really did capture');

    // The identical delivery again — same itemId, same occurredAt.
    const r2 = await post();
    assert.equal(r2.status, 200);
    // ⚠ A TIMING CONTROL IS REQUIRED FOR AN ABSENCE ASSERTION. The handler is a detached IIFE, so
    // "nothing happened" needs a window in which it could have. The claim is the FIRST await after the
    // status check, so this is generous by a wide margin.
    await new Promise((r) => setTimeout(r, 1500));

    assert.equal(calls.invoice, afterFirst.invoice, 'the duplicate made NO invoice fetch');
    assert.equal(calls.fullClient, afterFirst.fullClient, 'and NO client fetch');
    assert.equal(
      calls.related, afterFirst.related,
      'and NO capture — which is the whole change: the old behaviour re-ran two Jobber round trips '
      + 'and a full re-capture for a delivery it was always going to discard'
    );
    assert.equal((await events()).length, 1, 'and still exactly one delivery row');
    assert.equal((await conversions()).length, 1, 'and still exactly one conversion');
  });

  it('PAIRED POSITIVE — a GENUINE second event with a DIFFERENT occurredAt is NOT swallowed', async () => {
    // ⚠ WITHOUT THIS, THE CASE ABOVE PASSES AGAINST A DOOR THAT DISCARDS EVERY SECOND DELIVERY. The key
    // includes `occurred_at` precisely so a real later event still runs — the defect the quote-approved
    // commit measured, where a shared key swallowed a genuine QUOTE_APPROVED.
    const calls = armCounters();

    await post({ occurredAt: OCCURRED_AT });
    await waitFor(() => calls.related > 0, { timeout: 6000 });
    await waitFor(async () => (await events()).length > 0, { timeout: 6000 });
    const afterFirst = { ...calls };

    await post({ occurredAt: '2026-10-02T13:00:00.000Z' });
    await waitFor(() => calls.related > afterFirst.related, { timeout: 6000 });

    assert.ok(calls.invoice > afterFirst.invoice, 'the genuine second event DID fetch the invoice');
    assert.ok(calls.related > afterFirst.related, 'and DID capture again');
    const rows = await events();
    assert.equal(rows.length, 2, 'two delivery rows — one per real event');
    assert.equal(
      (await conversions()).length, 1,
      'and STILL one conversion — the money idempotence is the UNIQUE constraint, not this claim, '
      + 'which is exactly the distinction this commit must not blur'
    );
  });

  it('NO occurredAt → the dedupe is INERT, the work still runs, and that is LOGGED', async () => {
    // ⚠ IT FAILS OPEN DELIBERATELY: with no usable timestamp there is no key separating a duplicate
    // from a legitimate second event, and swallowing a real event is unrecoverable while processing
    // twice is idempotent by write shape. ⚠ AND THE INERT CASE IS LOGGED RATHER THAN SILENT — a
    // disabled mechanism that reports nothing is what this codebase files under "reports health it
    // cannot observe".
    const calls = armCounters();

    await post({ occurredAt: null });
    await waitFor(() => calls.related > 0, { timeout: 6000 });

    assert.deepEqual(await events(), [], 'nothing is claimed, because there is no key to claim with');
    await waitFor(async () => (await pool.query(
      "SELECT 1 FROM error_log WHERE source LIKE '%dedupe key%'"
    )).rows.length > 0, { timeout: 6000 });

    const { rows: logged } = await pool.query(
      "SELECT error_message, severity FROM error_log WHERE source LIKE '%dedupe key%'");
    assert.equal(logged.length, 1, 'the inert dedupe is recorded exactly once');
    assert.match(logged[0].error_message, /dedupe inert/, 'and says what is inert');

    // And the work proceeded, which is the fail-OPEN half.
    assert.equal((await conversions()).length, 1, 'the credit still happened');
  });

  it('a NON-PAID invoice update consumes NO claim row — the placement decision, asserted', async () => {
    // ⚠ THE CLAIM SITS AFTER THE CHEAP STATUS EXIT ON PURPOSE. Jobber sends INVOICE_UPDATE for every
    // status change, each with its own `occurred_at`, so claiming before the exit would write a row for
    // every draft, sent and awaiting-payment transition this door deliberately ignores. This pins the
    // placement rather than leaving it to a comment.
    const calls = armCounters();

    const resp = await post({ invoiceStatus: 'draft' });
    assert.equal(resp.status, 200);
    await new Promise((r) => setTimeout(r, 1200));

    assert.deepEqual(await events(), [], 'a non-actionable delivery writes no delivery row');
    assert.equal(calls.invoice, 0, 'and reaches Jobber not at all');
  });
});
