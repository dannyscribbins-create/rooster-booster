'use strict';

// RED tests for tenant rebuild Session 3, spec Section 7.2 (TENANT_RESOLUTION_REBUILD_SPEC.md,
// Section 4 Batch C). These pin the NEW webhook tenant-resolution mechanism BEFORE it exists:
// payload.data.webHookEvent.accountId looked up against a new contractor_crm_settings.jobber_account_id
// column, via a new resolveWebhookContractorId(payload, fallbackLookup) helper. Neither the column
// nor the helper exist yet — every test here is expected to fail for that reason (see the per-test
// RED note in each title). This file must stay green once Phase 2 (schema + resolveWebhookContractorId)
// ships; nothing here should be "loosened" to pass early.
//
// Extends the proven pattern from webhookContractorResolution.test.js: same signJobberWebhook /
// httpPost / buildTestApp harness, same _setTestOverrides seam for stubbing the Jobber GraphQL
// fetches (fetchFullClient, fetchClientRelatedData, fetchInvoiceWithJobs, fetchClientJobsForJobUpdate)
// so no live network call is ever made from these tests.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;

const {
  seedToken,
  seedEngagementSettings,
  seedJobberClient,
  signJobberWebhook,
  httpPost,
  buildTestApp,
  startTestServer,
  stopTestServer,
  waitFor,
} = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';

describe('webhook tenant derivation via accountId — resolveWebhookContractorId (spec Section 7.2)', () => {
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
    // FK-safe order for the contractors wipe below (mirrors webhookContractorResolution.test.js):
    // sessions/titles/team_members all reference contractors(id).
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM contractors');
  });

  async function seedSingleContractor(id = TENANT_A) {
    await pool.query(
      `INSERT INTO contractors (id, name, status) VALUES ($1, 'Single Test Tenant', 'active')`,
      [id]
    );
  }

  // Seeds two contractor rows — with today's getDefaultContractorId() singleton, this
  // by itself is enough to make resolution fail closed (the "2 contractor rows" tripwire),
  // regardless of accountId. That's deliberate: several tests below use two rows so any
  // successful resolution they observe can only be explained by the NEW accountId-based
  // mechanism, never by the old singleton getting lucky.
  async function seedContractors() {
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, 'Test Tenant A', 'active')`, [TENANT_A]);
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, 'Test Tenant B', 'active')`, [TENANT_B]);
  }

  function post(path, payloadObject) {
    const { body, signature } = signJobberWebhook(payloadObject);
    return httpPost(port, path, body, { 'x-jobber-hmac-sha256': signature });
  }

  // Documented Jobber webhook envelope (confirmed 2026-07-07): every topic carries
  // data.webHookEvent.{topic,appId,accountId,itemId,occurredAt}. `extra` merges in any
  // topic-specific top-level data fields the CURRENT handler code still reads directly
  // (e.g. data.job for job-update) so today's field-extraction logic keeps working
  // alongside the new envelope fields these tests are pinning.
  function buildEnvelope({ topic, accountId, itemId, occurredAt = new Date().toISOString(), appId = 'test-app-id', extra = {} }) {
    return {
      data: {
        webHookEvent: { topic, appId, accountId, itemId, occurredAt },
        ...extra,
      },
    };
  }

  // ── C2 — client-create, accountId primary path ───────────────────────────────

  it('C2 client-create — accountId path resolves contractor A; new client lands under A ' +
     '(RED: contractor_crm_settings.jobber_account_id column does not exist yet)', async () => {
    await seedContractors();
    await seedToken(pool, { contractorId: TENANT_A });
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
      [TENANT_A, 'JACCT_A']
    );

    let relatedDataCalled = false;
    _setTestOverrides({
      fetchFullClient: async () => ({
        id: 'jc-c2-new',
        firstName: 'New', lastName: 'Client',
        createdAt: new Date().toISOString(),
        customFields: [{ label: 'Referred by', valueText: 'Some Referrer' }],
      }),
      fetchClientRelatedData: async () => { relatedDataCalled = true; return null; },
    });

    const resp = await post('/webhooks/jobber/client-create', buildEnvelope({
      topic: 'CLIENT_CREATE', accountId: 'JACCT_A', itemId: 'jc-c2-new',
    }));
    assert.equal(resp.status, 200, 'client-create must ack 200');

    await waitFor(async () => {
      const { rows } = await pool.query(
        'SELECT * FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2',
        [TENANT_A, 'jc-c2-new']
      );
      return rows.length > 0;
    });
    await waitFor(() => relatedDataCalled, { timeout: 3000 });

    // Inspect the real table the handler actually writes for a brand-new client.
    const { rows: clientRows } = await pool.query(
      'SELECT contractor_id FROM jobber_clients WHERE jobber_client_id = $1',
      ['jc-c2-new']
    );
    assert.equal(clientRows.length, 1, 'jobber_clients row must exist for the new client');
    assert.equal(clientRows[0].contractor_id, TENANT_A, 'jobber_clients row must be under contractor A, resolved via accountId');
  });

  // ── C3 — client-update, accountId primary path ───────────────────────────────

  it('C3 client-update — accountId primary path resolves and processes an existing client under A ' +
     '(RED: contractor_crm_settings.jobber_account_id column does not exist yet)', async () => {
    await seedContractors();
    await seedToken(pool, { contractorId: TENANT_A });
    await seedJobberClient(pool, { contractorId: TENANT_A, jobberClientId: 'jc-c3-existing', name: 'Existing Client' });
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
      [TENANT_A, 'JACCT_A']
    );

    let relatedDataCalled = false;
    _setTestOverrides({
      fetchFullClient: async () => ({
        id: 'jc-c3-existing',
        firstName: 'Existing', lastName: 'Client',
        createdAt: new Date().toISOString(),
        customFields: [{ label: 'Referred by', valueText: 'Some Referrer' }],
      }),
      fetchClientRelatedData: async () => { relatedDataCalled = true; return null; },
    });

    const resp = await post('/webhooks/jobber/client-update', buildEnvelope({
      topic: 'CLIENT_UPDATE', accountId: 'JACCT_A', itemId: 'jc-c3-existing',
    }));
    assert.equal(resp.status, 200, 'client-update must ack 200');

    await waitFor(async () => {
      const { rows } = await pool.query(
        'SELECT * FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2',
        [TENANT_A, 'jc-c3-existing']
      );
      return rows.length > 0;
    });
    await waitFor(() => relatedDataCalled, { timeout: 3000 });
  });

  // ── C3 — client-update, defensive local-data fallback (the ONE handler that keeps one) ──

  it('C3 client-update — defensive fallback resolves via the existing jobber_clients row when no ' +
     'accountId match exists (RED: resolveWebhookContractorId()/fallback do not exist yet — today ' +
     'the 2-contractor-row tripwire quarantines instead of consulting local data)', async () => {
    await seedContractors(); // 2 rows — makes today's getDefaultContractorId() fail closed regardless
    await seedToken(pool, { contractorId: TENANT_A });
    await seedJobberClient(pool, { contractorId: TENANT_A, jobberClientId: 'jc-c3-fallback', name: 'Fallback Client' });
    // Deliberately NO contractor_crm_settings row at all — accountId has nothing to match
    // against, so the only path to a correct resolution is C3's local-data fallback
    // (SELECT contractor_id FROM jobber_clients WHERE jobber_client_id = $1), which does
    // not exist in the handler yet.

    let relatedDataCalled = false;
    _setTestOverrides({
      fetchFullClient: async () => ({
        id: 'jc-c3-fallback',
        firstName: 'Fallback', lastName: 'Client',
        createdAt: new Date().toISOString(),
        customFields: [{ label: 'Referred by', valueText: 'Some Referrer' }],
      }),
      fetchClientRelatedData: async () => { relatedDataCalled = true; return null; },
    });

    const resp = await post('/webhooks/jobber/client-update', buildEnvelope({
      topic: 'CLIENT_UPDATE', accountId: 'JACCT_UNMAPPED', itemId: 'jc-c3-fallback',
    }));
    assert.equal(resp.status, 200, 'client-update must ack 200 regardless of resolution outcome');

    await waitFor(async () => {
      const { rows } = await pool.query(
        'SELECT * FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2',
        [TENANT_A, 'jc-c3-fallback']
      );
      return rows.length > 0;
    });
    await waitFor(() => relatedDataCalled, { timeout: 3000 });
  });

  // ── C4 — invoice-paid, accountId path ─────────────────────────────────────────

  it('C4 invoice-paid — accountId path resolves contractor A before any Jobber fetch, no quarantine ' +
     '(RED: contractor_crm_settings.jobber_account_id column does not exist yet)', async () => {
    await seedContractors();
    await seedToken(pool, { contractorId: TENANT_A });
    await seedEngagementSettings(pool, { contractorId: TENANT_A, experienceFlowEnabled: false });
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
      [TENANT_A, 'JACCT_A']
    );

    let fetchInvoiceCalled = false;
    _setTestOverrides({
      fetchInvoiceWithJobs: async () => { fetchInvoiceCalled = true; return { invoiceStatus: 'awaiting_payment' }; },
      fetchFullClient:        async () => { throw new Error('must not be called'); },
      fetchClientRelatedData: async () => { throw new Error('must not be called'); },
    });

    const resp = await post('/webhooks/jobber/invoice-paid', buildEnvelope({
      topic: 'INVOICE_UPDATE', accountId: 'JACCT_A', itemId: 'inv-c4-001',
    }));
    assert.equal(resp.status, 200);

    // Reaching fetchInvoiceWithJobs proves resolution succeeded (engagement_settings +
    // tokens lookups both need the correct contractorId) BEFORE any Jobber API call.
    await waitFor(() => fetchInvoiceCalled, { timeout: 3000 });

    const { rows: quarantineRows } = await pool.query(
      "SELECT * FROM error_log WHERE source LIKE '%contractor resolution%'"
    );
    assert.equal(quarantineRows.length, 0, 'resolution via accountId must not quarantine');
  });

  // ── C5 — job-update, accountId path ───────────────────────────────────────────

  it('C5 job-update — accountId path resolves contractor A before any Jobber fetch, no quarantine ' +
     '(RED: contractor_crm_settings.jobber_account_id column does not exist yet)', async () => {
    await seedContractors();
    await seedToken(pool, { contractorId: TENANT_A });
    await seedEngagementSettings(pool, { contractorId: TENANT_A, experienceFlowEnabled: true });
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
      [TENANT_A, 'JACCT_A']
    );

    let fetchClientJobsCalled = false;
    _setTestOverrides({
      fetchClientJobsForJobUpdate: async () => { fetchClientJobsCalled = true; return []; },
    });

    const resp = await post('/webhooks/jobber/job-update', buildEnvelope({
      topic: 'JOB_UPDATE', accountId: 'JACCT_A', itemId: 'job-c5-001',
      extra: { job: { id: 'job-c5-001', client: { id: 'jc-c5-001' } } },
    }));
    assert.equal(resp.status, 200);

    // Reaching fetchClientJobsForJobUpdate proves resolution succeeded (engagement_settings +
    // tokens lookups both need the correct contractorId) BEFORE any Jobber API call.
    await waitFor(() => fetchClientJobsCalled, { timeout: 3000 });

    const { rows: quarantineRows } = await pool.query(
      "SELECT * FROM error_log WHERE source LIKE '%contractor resolution%'"
    );
    assert.equal(quarantineRows.length, 0, 'resolution via accountId must not quarantine');
  });

  // ── Resolution-failure quarantine — pinned against the NEW mechanism only ────

  it('resolution-failure quarantine: an unmatched accountId must quarantine even when a single, ' +
     'otherwise-resolvable contractor row exists (RED: accountId is not consulted yet — today the ' +
     'single-row tripwire succeeds and no quarantine is written)', async () => {
    // Exactly ONE contractor row. Under today's getDefaultContractorId() singleton this
    // resolves successfully no matter what accountId says — proving that if this test
    // observes a quarantine row, it can ONLY be because the new accountId-matching logic
    // ran and failed to find 'JACCT_UNKNOWN', not because of the old row-count tripwire.
    await seedSingleContractor(TENANT_A);
    await seedToken(pool, { contractorId: TENANT_A });

    _setTestOverrides({
      fetchFullClient: async () => ({
        id: 'jc-c6-unknown',
        firstName: 'Unknown', lastName: 'Account',
        createdAt: new Date().toISOString(),
        customFields: [],
      }),
      fetchClientRelatedData: async () => null,
    });

    const resp = await post('/webhooks/jobber/client-create', buildEnvelope({
      topic: 'CLIENT_CREATE', accountId: 'JACCT_UNKNOWN', itemId: 'jc-c6-unknown',
    }));
    assert.equal(resp.status, 200, 'client-create must ack 200 even on resolution failure');

    await waitFor(async () => {
      const { rows } = await pool.query(
        "SELECT * FROM error_log WHERE source LIKE '%client-create%contractor resolution%'"
      );
      return rows.length > 0;
    });

    const { rows } = await pool.query(
      "SELECT * FROM error_log WHERE source LIKE '%client-create%contractor resolution%'"
    );
    assert.equal(rows.length, 1, 'exactly one quarantine row for the unmatched accountId');
  });
});
