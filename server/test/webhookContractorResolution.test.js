'use strict';

// Covers cleanup item 2a: all five Jobber webhook handlers (disconnect, client-create,
// client-update, invoice-paid, job-update) must resolve contractor_id via
// resolveWebhookContractorId() — never a hardcoded literal, never a client-supplied
// req.query.contractorId / payload.contractor_id. Mirrors the rename-safety pattern
// from contractorResolution.test.js (referrer path) for the webhook path.
//
// Also covers 2d: every logError() call from this file must carry the resolved
// contractorId explicitly, not rely on errorLogger.js's own 'accent-roofing' fallback.
//
// REWRITTEN for tenant rebuild S3 (Batch C): getDefaultContractorId() and its 0-row/2-row
// tripwire have been retired from all 5 webhook handlers. Resolution is now
// resolveWebhookContractorId(payload, fallbackLookup) — payload.data.webHookEvent.accountId
// looked up against contractor_crm_settings.jobber_account_id, with a defensive local-data
// fallback for client-update only. The `contractors` table's row count is no longer
// consulted anywhere in this resolution path — the old "0 contractor rows" / "2 contractor
// rows" tripwire scenarios and their dedicated tests are retired along with the function
// that produced them. What replaces them: a single "unmatched accountId" fail-closed test
// per handler (below), since the new mechanism has exactly one failure trigger, not two.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;

const {
  seedToken,
  seedEngagementSettings,
  signJobberWebhook,
  httpPost,
  buildTestApp,
  startTestServer,
  stopTestServer,
  waitFor,
} = require('./helpers');

const RENAMED_ID = 'webhook-rename-safety-tenant';
const RENAMED_ACCOUNT_ID = 'JACCT_RENAME';

describe('webhook contractor_id resolution — rename safety + fail-closed (all 5 handlers)', () => {
  let pool, server, port;

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
    await pool.query('DELETE FROM contact_tags');
    await pool.query('DELETE FROM jobber_clients');
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM engagement_settings');
    await pool.query('DELETE FROM tokens');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM error_log');
    // FK-safe order for the contractors wipe below (mirrors contractorResolution.test.js):
    // sessions/titles/team_members all reference contractors(id).
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM contractors');
  });

  // contractor_crm_settings.contractor_id has NO FK to contractors — seeded here only
  // AFTER seedSingleContractor() has inserted the matching contractors row, everywhere
  // this file does both, so no test ever creates an orphaned contractor_crm_settings row.
  async function seedSingleContractor(id = RENAMED_ID) {
    await pool.query(
      `INSERT INTO contractors (id, name, status) VALUES ($1, 'Renamed Tenant', 'active')`,
      [id]
    );
  }

  function post(path, payloadObject) {
    const { body, signature } = signJobberWebhook(payloadObject);
    return httpPost(port, path, body, { 'x-jobber-hmac-sha256': signature });
  }

  const HANDLERS = [
    { path: '/webhooks/jobber/disconnect', topic: 'disconnect' },
    { path: '/webhooks/jobber/client-create', topic: 'client-create' },
    { path: '/webhooks/jobber/client-update', topic: 'client-update' },
    { path: '/webhooks/jobber/invoice-paid', topic: 'invoice-paid' },
    { path: '/webhooks/jobber/job-update', topic: 'job-update' },
  ];

  // ── FAIL-CLOSED-BUT-200 — every handler, the new contract's one trigger ──────
  // No contractor_crm_settings row exists for any accountId (beforeEach wipes it), and no
  // jobber_clients row exists either — so client-update's defensive fallback also has
  // nothing to find. Every handler must still ack 200 and quarantine exactly once.
  for (const { path, topic } of HANDLERS) {
    it(`${topic}: unmatched accountId → 200 acked, quarantine error_log row, no processing`, async () => {
      const itemId = `item-${topic}-unmatched`;
      const resp = await post(path, { data: { webHookEvent: { itemId, accountId: 'JACCT_UNKNOWN' } } });
      assert.equal(resp.status, 200, `${topic}: must ack 200 even when resolution fails`);

      // resolveWebhookContractorId() throws synchronously (no internal logError of its own,
      // unlike the retired getDefaultContractorId()), so the quarantine row is the only
      // error_log write to wait for.
      await waitFor(async () => {
        const { rows } = await pool.query("SELECT * FROM error_log WHERE source LIKE '%contractor resolution%'");
        return rows.length > 0;
      });

      const { rows } = await pool.query("SELECT * FROM error_log WHERE source LIKE '%contractor resolution%'");
      assert.equal(rows.length, 1, `${topic}: exactly one quarantine error_log row`);
      const combined = `${rows[0].error_message} ${rows[0].stack_trace || ''}`;
      assert.match(combined, /resolveWebhookContractorId/, `${topic}: names the new resolution mechanism`);
      assert.match(combined, new RegExp(topic), `${topic}: quarantine context names the webhook topic`);
      if (topic !== 'disconnect') {
        assert.match(combined, new RegExp(itemId), `${topic}: quarantine context includes the Jobber item id`);
      }

      // No processing occurred — the resolution guard must short-circuit before any
      // handler-specific DB writes (pipeline_cache, jobber_clients, tokens, etc).
      const { rows: pcRows } = await pool.query('SELECT * FROM pipeline_cache');
      assert.equal(pcRows.length, 0, `${topic}: no pipeline_cache writes on resolution failure`);
    });
  }

  // ── RENAME-SAFETY — resolves via accountId against a non-default contractor id ───
  // "Renamed" here means: the contractor row's id is a distinctly non-default string
  // (not 'accent-roofing', not any hardcoded literal in the codebase) — proving
  // resolution comes entirely from the accountId -> contractor_crm_settings lookup,
  // never from a fallback literal. Order in every test below: seed the contractors row
  // FIRST, then contractor_crm_settings (no FK between them — reversing the order would
  // let contractor_crm_settings reference a contractor id that doesn't exist yet).

  it('disconnect: cleans up rows under the resolved contractor id, not a hardcoded literal', async () => {
    await seedSingleContractor();
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id, is_connected) VALUES ($1, $2, true)`,
      [RENAMED_ID, RENAMED_ACCOUNT_ID]
    );
    await seedToken(pool, { contractorId: RENAMED_ID });

    const resp = await post('/webhooks/jobber/disconnect', {
      data: { webHookEvent: { accountId: RENAMED_ACCOUNT_ID } },
    });
    assert.equal(resp.status, 200);

    await waitFor(async () => {
      const { rows } = await pool.query('SELECT * FROM tokens WHERE contractor_id = $1', [RENAMED_ID]);
      return rows.length === 0;
    });

    const { rows: settingsRows } = await pool.query(
      'SELECT is_connected FROM contractor_crm_settings WHERE contractor_id = $1',
      [RENAMED_ID]
    );
    assert.equal(settingsRows[0].is_connected, false, 'is_connected flipped under the resolved id');
  });

  it('client-create: writes pipeline_cache under the resolved contractor id', async () => {
    await seedSingleContractor();
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
      [RENAMED_ID, RENAMED_ACCOUNT_ID]
    );
    await seedToken(pool, { contractorId: RENAMED_ID });

    let relatedDataCalled = false;
    _setTestOverrides({
      fetchFullClient: async () => ({
        id: 'jc-rename-cc',
        firstName: 'Rename', lastName: 'Safety',
        createdAt: new Date().toISOString(),
        customFields: [{ label: 'Referred by', valueText: 'Some Referrer' }],
      }),
      fetchClientRelatedData: async () => { relatedDataCalled = true; return null; },
    });

    const resp = await post('/webhooks/jobber/client-create', {
      data: { webHookEvent: { itemId: 'jc-rename-cc', accountId: RENAMED_ACCOUNT_ID } },
    });
    assert.equal(resp.status, 200);

    await waitFor(async () => {
      const { rows } = await pool.query(
        'SELECT * FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2',
        [RENAMED_ID, 'jc-rename-cc']
      );
      return rows.length > 0;
    });
    // Wait past fetchClientRelatedData too — it's the last seamed call in this handler
    // (runContactMatchingPass afterward touches no test seam). Without this, the next
    // test's beforeEach can swap the seam mocks out from under this still-in-flight IIFE.
    await waitFor(() => relatedDataCalled, { timeout: 3000 });
  });

  it('client-update: writes pipeline_cache under the resolved contractor id', async () => {
    await seedSingleContractor();
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
      [RENAMED_ID, RENAMED_ACCOUNT_ID]
    );
    await seedToken(pool, { contractorId: RENAMED_ID });

    let relatedDataCalled = false;
    _setTestOverrides({
      fetchFullClient: async () => ({
        id: 'jc-rename-cu',
        firstName: 'Rename', lastName: 'Safety',
        createdAt: new Date().toISOString(),
        customFields: [{ label: 'Referred by', valueText: 'Some Referrer' }],
      }),
      fetchClientRelatedData: async () => { relatedDataCalled = true; return null; },
    });

    const resp = await post('/webhooks/jobber/client-update', {
      data: { webHookEvent: { itemId: 'jc-rename-cu', accountId: RENAMED_ACCOUNT_ID } },
    });
    assert.equal(resp.status, 200);

    await waitFor(async () => {
      const { rows } = await pool.query(
        'SELECT * FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2',
        [RENAMED_ID, 'jc-rename-cu']
      );
      return rows.length > 0;
    });
    await waitFor(() => relatedDataCalled, { timeout: 3000 });
  });

  it('invoice-paid: engagement_settings + tokens lookups resolve under the resolved contractor id', async () => {
    await seedSingleContractor();
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
      [RENAMED_ID, RENAMED_ACCOUNT_ID]
    );
    await seedToken(pool, { contractorId: RENAMED_ID });
    await seedEngagementSettings(pool, { contractorId: RENAMED_ID, experienceFlowEnabled: false });

    let fetchInvoiceCalled = false;
    _setTestOverrides({
      fetchInvoiceWithJobs: async () => { fetchInvoiceCalled = true; return { invoiceStatus: 'awaiting_payment' }; },
      fetchFullClient:        async () => { throw new Error('must not be called'); },
      fetchClientRelatedData: async () => { throw new Error('must not be called'); },
    });

    const resp = await post('/webhooks/jobber/invoice-paid', {
      data: { webHookEvent: { itemId: 'inv-rename-001', accountId: RENAMED_ACCOUNT_ID } },
    });
    assert.equal(resp.status, 200);

    // Reaching fetchInvoiceWithJobs proves both the engagement_settings lookup and the
    // tokens lookup succeeded under the resolved id — under a stale/wrong id, the tokens
    // lookup would find nothing and the handler would bail before this call.
    await waitFor(() => fetchInvoiceCalled, { timeout: 3000 });

    const { rows: errRows } = await pool.query('SELECT * FROM error_log');
    assert.equal(errRows.length, 0, 'no quarantine/error rows — resolution succeeded cleanly');
  });

  it('job-update: engagement_settings + tokens lookups resolve under the resolved contractor id', async () => {
    await seedSingleContractor();
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
      [RENAMED_ID, RENAMED_ACCOUNT_ID]
    );
    await seedToken(pool, { contractorId: RENAMED_ID });
    await seedEngagementSettings(pool, { contractorId: RENAMED_ID, experienceFlowEnabled: true });

    let fetchClientJobsCalled = false;
    _setTestOverrides({
      fetchClientJobsForJobUpdate: async () => { fetchClientJobsCalled = true; return []; },
    });

    const resp = await post('/webhooks/jobber/job-update', {
      data: {
        webHookEvent: { accountId: RENAMED_ACCOUNT_ID },
        job: { id: 'job-rename-001', client: { id: 'jc-rename-ju' } },
      },
    });
    assert.equal(resp.status, 200);

    // Reaching the client-jobs fetch proves the engagement_settings flag check and the
    // tokens lookup both resolved under the resolved id — under a stale/wrong id, either
    // lookup finding nothing would short-circuit before this call.
    await waitFor(() => fetchClientJobsCalled, { timeout: 3000 });

    const { rows: errRows } = await pool.query('SELECT * FROM error_log');
    assert.equal(errRows.length, 0, 'no quarantine/error rows — resolution succeeded cleanly');
  });

  // ── 2d — logError calls from this file carry the resolved contractorId ───────

  it('2d: an error logged mid-handler (not a resolution failure) carries the resolved contractorId, not the stale literal', async () => {
    await seedSingleContractor();
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
      [RENAMED_ID, RENAMED_ACCOUNT_ID]
    );
    await seedToken(pool, { contractorId: RENAMED_ID });

    // missing invoiceId triggers the existing "missing invoiceId" logError call —
    // a genuine mid-handler error, distinct from the resolution-failure quarantine path.
    _setTestOverrides({
      sendEmail: async () => ({ id: 'test-email' }),
    });

    const resp = await post('/webhooks/jobber/invoice-paid', {
      data: { webHookEvent: { accountId: RENAMED_ACCOUNT_ID } }, // no itemId
    });
    assert.equal(resp.status, 200);

    await waitFor(async () => {
      const { rows } = await pool.query("SELECT * FROM error_log WHERE error_message LIKE '%invoiceId%'");
      return rows.length > 0;
    });

    const { rows } = await pool.query("SELECT * FROM error_log WHERE error_message LIKE '%invoiceId%'");
    assert.equal(rows.length, 1);
    assert.equal(
      rows[0].contractor_id, RENAMED_ID,
      `error_log.contractor_id must be the resolved id (${RENAMED_ID}), not the stale 'accent-roofing' fallback`
    );
  });
});
