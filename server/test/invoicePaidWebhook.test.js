'use strict';

// setup.js MUST be required first — it sets JOBBER_CLIENT_SECRET and loads .env.test
// before db.js (required transitively below) creates its pool.
const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

// Import seam functions from the webhook router.
// setup.js has already set JOBBER_CLIENT_SECRET, so this require is safe.
const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;

const {
  seedContractor,
  seedToken,
  seedEngagementSettings,
  seedReferralSchedule,
  seedUser,
  signJobberWebhook,
  httpPost,
  buildTestApp,
  startTestServer,
  stopTestServer,
  waitFor,
} = require('./helpers');

// ── SHARED STUBS ──────────────────────────────────────────────────────────────
// Both stubs are reused across tests that need a paid invoice + client.
// Tests that need specific variants define their own inline.

const PAID_INVOICE = {
  invoiceStatus: 'paid',
  invoiceNumber: 'INV-001',
  issuedDate: '2026-06-10',
  waitingForFinancedPayment: false,
  amounts: { total: 10000 },
  client: { id: 'jobber-c1', name: 'Test Client' },
  jobs: {
    nodes: [{ id: 'job-1', customFields: [{ label: 'Job Type', valueDropdown: 'Roof Replacement' }] }],
  },
  archivedJobs: { nodes: [] },
};

const FULL_CLIENT_WITH_REFERRAL = {
  id: 'jobber-c1',
  firstName: 'Test',
  lastName: 'Client',
  emails: [{ address: 'testclient@example.com' }],
  phones: [{ number: '5550001234' }],
  customFields: [{ label: 'Referred by', valueText: 'Jane Referrer' }],
  quotes: { nodes: [] },
  jobs: { nodes: [] },
};

const FULL_CLIENT_NO_REFERRAL = {
  ...FULL_CLIENT_WITH_REFERRAL,
  customFields: [],
};

// ── TEST SUITE ────────────────────────────────────────────────────────────────

describe('invoice-paid webhook (characterization suite)', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    // buildTestApp creates a minimal express instance that mirrors server.js middleware
    // order — in particular, express.raw() on /webhooks BEFORE express.json(), which is
    // load-bearing for HMAC verification.
    const app = buildTestApp();
    ({ server, port } = await startTestServer(app));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  // Wipe tables in FK-safe order before every test. users CASCADE to
  // referral_conversions and experience_prompts; contacts CASCADE to contact_tags.
  beforeEach(async () => {
    _resetTestOverrides();
    await pool.query('DELETE FROM referral_schedule_job_types');
    await pool.query('DELETE FROM referral_schedules');
    await pool.query('DELETE FROM contact_tags');
    await pool.query('DELETE FROM contacts');
    await pool.query('DELETE FROM jobber_clients');
    await pool.query('DELETE FROM experience_invite_tokens');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM tokens');
    await pool.query('DELETE FROM engagement_settings');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM users');   // cascades to referral_conversions + experience_prompts
    // FK-safe order for the contractors wipe below (mirrors contractorResolution.test.js):
    // sessions/titles/team_members all reference contractors(id).
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM team_members');
    // This suite's payloads resolve via accountId 'JACCT_TEST' → contractor_crm_settings
    // (tenant rebuild S3) — the contractors row itself is no longer load-bearing for
    // resolution, but each test still seeds one for FK/session-adjacent consistency with
    // the rest of the suite. Wiped here so leftover rows from other test files never leak in.
    await pool.query('DELETE FROM contractors');
  });

  // Signs and POSTs to /webhooks/jobber/invoice-paid. Returns { status, body }.
  // Tenant rebuild S3: every payload gets accountId 'JACCT_TEST' injected into
  // data.webHookEvent so resolveWebhookContractorId() resolves via the accountId ->
  // contractor_crm_settings.jobber_account_id path seeded by seedTestContractor() below,
  // instead of the retired getDefaultContractorId() singleton. Injected here (one seam)
  // rather than in each test's payload literal.
  function post(payloadObject) {
    const withAccountId = {
      ...payloadObject,
      data: {
        ...payloadObject.data,
        webHookEvent: { ...payloadObject.data?.webHookEvent, accountId: 'JACCT_TEST' },
      },
    };
    const { body, signature } = signJobberWebhook(withAccountId);
    return httpPost(port, '/webhooks/jobber/invoice-paid', body, {
      'x-jobber-hmac-sha256': signature,
    });
  }

  // Tenant rebuild S3: seeds both the contractors row (kept for consistency with the rest
  // of the suite) and the contractor_crm_settings row mapping accountId 'JACCT_TEST' to it.
  // ON CONFLICT DO UPDATE is required — contractor_crm_settings is not wiped in beforeEach
  // (unlike contractors), so a plain INSERT would collide once more than one test has run.
  async function seedTestContractor() {
    await seedContractor(pool, 'test-roofing');
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, 'JACCT_TEST')
       ON CONFLICT (contractor_id) DO UPDATE SET jobber_account_id = EXCLUDED.jobber_account_id`,
      ['test-roofing']
    );
  }

  // ── TEST 1 ──────────────────────────────────────────────────────────────────
  it('non-paid invoiceStatus in payload → 200, IIFE exits synchronously, no DB writes', async () => {
    // contractor_id resolution now runs before the invoiceStatus check, so a single
    // contractors row is required even though this test's own DB queries are otherwise minimal.
    await seedTestContractor();
    const resp = await post({
      data: { invoice: { invoiceStatus: 'draft' }, webHookEvent: { itemId: 'inv-001' } },
      contractor_id: 'test-roofing',
    });

    assert.equal(resp.status, 200);

    // setImmediate drains any microtasks the IIFE may have queued.
    await new Promise(r => setImmediate(r));

    const { rows: errRows } = await pool.query('SELECT * FROM error_log');
    assert.equal(errRows.length, 0, 'no error_log rows');
    const { rows: epRows } = await pool.query('SELECT * FROM experience_prompts');
    assert.equal(epRows.length, 0, 'no experience_prompts rows');
    const { rows: rcRows } = await pool.query('SELECT * FROM referral_conversions');
    assert.equal(rcRows.length, 0, 'no referral_conversions rows');
  });

  // ── TEST 2 ──────────────────────────────────────────────────────────────────
  it('missing invoiceId → 200, error_log row written, admin alert email sent via _sendEmail', async () => {
    await seedTestContractor();
    const emails = [];
    _setTestOverrides({
      fetchInvoiceWithJobs:   async () => { throw new Error('must not be called'); },
      fetchFullClient:        async () => { throw new Error('must not be called'); },
      fetchClientRelatedData: async () => { throw new Error('must not be called'); },
      sendEmail: async args => { emails.push(args); return { id: 'test-email' }; },
    });

    const resp = await post({
      data: { webHookEvent: {} },   // no itemId
      contractor_id: 'test-roofing',
    });

    assert.equal(resp.status, 200);

    // logError inserts into error_log — wait for that row before asserting.
    await waitFor(async () => {
      const { rows } = await pool.query("SELECT * FROM error_log WHERE source LIKE '%invoice-paid%'");
      return rows.length > 0;
    });

    // Admin alert email sent via _sendEmail (same code path as the HMAC-checked send).
    await waitFor(() => emails.length > 0);

    const { rows: errRows } = await pool.query("SELECT * FROM error_log WHERE source LIKE '%invoice-paid%'");
    assert.equal(errRows.length, 1, 'one error_log row');

    assert.equal(emails.length, 1, 'one admin alert email');
    assert.ok(
      emails[0].subject.toLowerCase().includes('itemid') ||
      emails[0].subject.toLowerCase().includes('missing') ||
      emails[0].subject.toLowerCase().includes('error'),
      `admin alert subject should mention the error — got: "${emails[0].subject}"`
    );
    assert.equal(emails[0].to, 'admin1@roofmiles.com', 'admin alert sent to admin1@roofmiles.com');
  });

  // ── TEST 3 ──────────────────────────────────────────────────────────────────
  it('Jobber API returns non-paid invoice → 200, no experience or referral writes', async () => {
    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing' });

    let fetchInvoiceCalled = false;
    _setTestOverrides({
      fetchInvoiceWithJobs: async () => {
        fetchInvoiceCalled = true;
        return { invoiceStatus: 'awaiting_payment' };
      },
      fetchFullClient:        async () => { throw new Error('must not be called'); },
      fetchClientRelatedData: async () => { throw new Error('must not be called'); },
      sendEmail: async ()    => { throw new Error('must not be called'); },
    });

    const resp = await post({
      data: { webHookEvent: { itemId: 'inv-002' } },
      contractor_id: 'test-roofing',
    });

    assert.equal(resp.status, 200);

    // When fetchInvoiceWithJobs is called, the handler has confirmed the token and reached
    // STEP 4b — the early return fires immediately after, with no DB writes.
    await waitFor(() => fetchInvoiceCalled, { timeout: 3000 });

    const { rows: rcRows } = await pool.query('SELECT * FROM referral_conversions');
    assert.equal(rcRows.length, 0, 'no referral_conversions when Jobber returns non-paid');
    const { rows: epRows } = await pool.query('SELECT * FROM experience_prompts');
    assert.equal(epRows.length, 0, 'no experience_prompts');
  });

  // ── TEST 4 ──────────────────────────────────────────────────────────────────
  it('qualified referral → referral_conversions row + paid_count increment + bonus + first-milestone emails', async () => {
    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: false });
    await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@test.com', contractorId: 'test-roofing' });
    await seedReferralSchedule(pool, {
      contractorId: 'test-roofing',
      jobberLabel: 'Roof Replacement',
      flatAmount: 250,
    });

    const emails = [];
    _setTestOverrides({
      fetchInvoiceWithJobs:   async () => PAID_INVOICE,
      fetchFullClient:        async () => FULL_CLIENT_WITH_REFERRAL,
      fetchClientRelatedData: async () => null,
      sendEmail: async args => { emails.push(args); return { id: 'test-email' }; },
    });

    const resp = await post({
      data: { webHookEvent: { itemId: 'inv-003' } },
      contractor_id: 'test-roofing',
    });

    assert.equal(resp.status, 200);

    // Both emails (#4 bonus + #13 first-milestone) fire AFTER all DB writes,
    // so emails.length >= 2 is the strongest terminal signal.
    await waitFor(() => emails.length >= 2, { timeout: 5000 });

    const { rows: rcRows } = await pool.query('SELECT * FROM referral_conversions');
    assert.equal(rcRows.length, 1, 'one referral_conversions row');
    assert.equal(parseFloat(rcRows[0].bonus_amount), 250, 'bonus_amount = 250');
    assert.equal(rcRows[0].jobber_client_id, 'jobber-c1', 'jobber_client_id recorded');

    const { rows: userRows } = await pool.query(
      "SELECT paid_count FROM users WHERE LOWER(full_name) = 'jane referrer'"
    );
    assert.equal(userRows[0].paid_count, 1, 'paid_count incremented to 1');

    const subjects = emails.map(e => e.subject);
    assert.ok(subjects.some(s => s.includes('250')), 'bonus email subject contains amount');
    assert.ok(subjects.some(s => s.toLowerCase().includes('first')), 'first-milestone email sent');
  });

  // ── TEST 5 ──────────────────────────────────────────────────────────────────
  it('duplicate webhook delivery — paid_count increments exactly once, no second conversion row', async () => {
    // Fires the same invoice twice. First delivery records the conversion and increments
    // paid_count. Second delivery is blocked by evaluateReferral's dupe check (qualified:false)
    // and by the rowCount guard added in Session 79.5 — paid_count stays at 1.

    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: false });
    await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@test.com', contractorId: 'test-roofing' });
    await seedReferralSchedule(pool, {
      contractorId: 'test-roofing',
      jobberLabel: 'Roof Replacement',
      flatAmount: 250,
    });

    const emails = [];
    let fetchRelatedCallCount = 0;
    _setTestOverrides({
      fetchInvoiceWithJobs:   async () => PAID_INVOICE,
      fetchFullClient:        async () => FULL_CLIENT_WITH_REFERRAL,
      fetchClientRelatedData: async () => { fetchRelatedCallCount++; return null; },
      sendEmail: async args => { emails.push(args); return { id: 'test-email' }; },
    });

    // First delivery — qualified referral, records conversion and increments paid_count.
    const resp1 = await post({
      data: { webHookEvent: { itemId: 'inv-004' } },
      contractor_id: 'test-roofing',
    });
    assert.equal(resp1.status, 200);

    // Both #4 bonus + #13 first-milestone emails signal first delivery is fully complete.
    await waitFor(() => emails.length >= 2, { timeout: 5000 });

    const { rows: rcRows1 } = await pool.query('SELECT * FROM referral_conversions');
    assert.equal(rcRows1.length, 1, 'one conversion row after first delivery');

    const { rows: userRows1 } = await pool.query(
      "SELECT paid_count FROM users WHERE LOWER(full_name) = 'jane referrer'"
    );
    assert.equal(userRows1[0].paid_count, 1, 'paid_count = 1 after first delivery');

    // Second delivery (same invoice) — evaluateReferral returns qualified:false.
    const resp2 = await post({
      data: { webHookEvent: { itemId: 'inv-004' } },
      contractor_id: 'test-roofing',
    });
    assert.equal(resp2.status, 200);

    // STEP 9A fires unconditionally on each delivery — fetchRelatedCallCount >= 2 is the
    // terminal signal that the second delivery's outer IIFE has reached and passed STEP 9A.
    await waitFor(() => fetchRelatedCallCount >= 2, { timeout: 3000 });

    const { rows: rcRows2 } = await pool.query('SELECT * FROM referral_conversions');
    assert.equal(rcRows2.length, 1, 'still exactly one conversion row after duplicate delivery');

    const { rows: userRows2 } = await pool.query(
      "SELECT paid_count FROM users WHERE LOWER(full_name) = 'jane referrer'"
    );
    assert.equal(
      userRows2[0].paid_count, 1,
      'paid_count still 1 — duplicate delivery did not double-increment'
    );

    assert.equal(emails.length, 2, 'no extra emails from duplicate delivery');
  });

  // ── TEST 6 ──────────────────────────────────────────────────────────────────
  it('experience flow enabled, app user matched by email → experience_prompts row, no invite token', async () => {
    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: true });
    // Seed app user whose email matches the client email returned by the stub.
    await seedUser(pool, { fullName: 'App User', email: 'app-user@example.com', contractorId: 'test-roofing' });

    // Client email matches the seeded user; no 'Referred by' → referral engine skipped.
    const fullClientAppUser = {
      ...FULL_CLIENT_NO_REFERRAL,
      emails: [{ address: 'app-user@example.com' }],
    };

    _setTestOverrides({
      fetchInvoiceWithJobs:   async () => PAID_INVOICE,
      fetchFullClient:        async () => fullClientAppUser,
      fetchClientRelatedData: async () => null,
      sendEmail: async () => ({ id: 'test-email' }),
    });

    const resp = await post({
      data: { webHookEvent: { itemId: 'inv-005' } },
      contractor_id: 'test-roofing',
    });

    assert.equal(resp.status, 200);

    await waitFor(async () => {
      const { rows } = await pool.query('SELECT * FROM experience_prompts');
      return rows.length > 0;
    }, { timeout: 5000 });

    const { rows: epRows } = await pool.query('SELECT * FROM experience_prompts');
    assert.equal(epRows.length, 1, 'one experience_prompts row');
    assert.equal(epRows[0].response_type, 'pending', "response_type = 'pending'");
    assert.equal(epRows[0].contractor_id, 'test-roofing');

    // App-user path: no invite token created.
    const { rows: eiRows } = await pool.query('SELECT * FROM experience_invite_tokens');
    assert.equal(eiRows.length, 0, 'no experience_invite_tokens for matched app user');
  });

  // ── TEST 7 ──────────────────────────────────────────────────────────────────
  it('experience flow enabled, no app user match → experience_invite_tokens row + invite email sent', async () => {
    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: true });
    // No app user seeded — no match possible via name, email, or phone.

    const fullClientNoAccount = {
      ...FULL_CLIENT_NO_REFERRAL,
      emails: [{ address: 'no-account@example.com' }],
    };

    const emails = [];
    _setTestOverrides({
      fetchInvoiceWithJobs:   async () => PAID_INVOICE,
      fetchFullClient:        async () => fullClientNoAccount,
      fetchClientRelatedData: async () => null,
      sendEmail: async args => { emails.push(args); return { id: 'test-email' }; },
    });

    const resp = await post({
      data: { webHookEvent: { itemId: 'inv-006' } },
      contractor_id: 'test-roofing',
    });

    assert.equal(resp.status, 200);

    // Invite email fires after the DB insert — emails.length > 0 is the terminal signal.
    await waitFor(() => emails.length > 0, { timeout: 5000 });

    const { rows: eiRows } = await pool.query('SELECT * FROM experience_invite_tokens');
    assert.equal(eiRows.length, 1, 'one experience_invite_tokens row');
    assert.equal(eiRows[0].jobber_client_email, 'no-account@example.com');
    assert.equal(eiRows[0].contractor_id, 'test-roofing');
    assert.ok(eiRows[0].token, 'token generated');
    assert.ok(eiRows[0].expires_at, 'expires_at set');

    assert.equal(emails.length, 1, 'one invite email sent');
    assert.ok(
      emails[0].subject.includes('Thank you for choosing us'),
      `invite email subject — got: "${emails[0].subject}"`
    );
    assert.equal(emails[0].to, 'no-account@example.com', 'invite email sent to client email');
  });

  // ── TEST 8 ──────────────────────────────────────────────────────────────────
  it('no referredBy on client → referral engine skipped, no referral_conversions row', async () => {
    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: false });

    let fetchRelatedCalled = false;
    _setTestOverrides({
      fetchInvoiceWithJobs:   async () => PAID_INVOICE,
      fetchFullClient:        async () => FULL_CLIENT_NO_REFERRAL,
      fetchClientRelatedData: async () => { fetchRelatedCalled = true; return null; },
      sendEmail: async () => { throw new Error('must not be called'); },
    });

    const resp = await post({
      data: { webHookEvent: { itemId: 'inv-007' } },
      contractor_id: 'test-roofing',
    });

    assert.equal(resp.status, 200);

    // STEP 9A (fetchClientRelatedData) fires after the referral engine section.
    // When the stub is called, all awaited work above it in the outer IIFE is complete.
    await waitFor(() => fetchRelatedCalled, { timeout: 3000 });

    const { rows: rcRows } = await pool.query('SELECT * FROM referral_conversions');
    assert.equal(rcRows.length, 0, 'no referral_conversions when client has no referredBy field');
  });

  // ── TEST 9 — 2c mitigation: 401 → forced refresh → retry once ───────────────
  it('401 from fetchInvoiceWithJobs → forced refresh → retry succeeds with the refreshed token', async () => {
    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing', accessToken: 'stale-token' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: false });
    await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@test.com', contractorId: 'test-roofing' });
    await seedReferralSchedule(pool, {
      contractorId: 'test-roofing',
      jobberLabel: 'Roof Replacement',
      flatAmount: 250,
    });

    let invoiceCallCount = 0;
    const invoiceCallTokens = [];
    let fullClientToken = null;
    const refreshCalls = [];

    _setTestOverrides({
      fetchInvoiceWithJobs: async (invoiceId, token) => {
        invoiceCallCount++;
        invoiceCallTokens.push(token);
        if (invoiceCallCount === 1) {
          const err = new Error('Request failed with status code 401');
          err.response = { status: 401 };
          throw err;
        }
        return PAID_INVOICE;
      },
      fetchFullClient: async (clientId, token) => {
        fullClientToken = token;
        return FULL_CLIENT_WITH_REFERRAL;
      },
      fetchClientRelatedData: async () => null,
      sendEmail: async () => ({ id: 'test-email' }),
      // Not yet wired into the seam system — this override is inert against today's
      // code (the real refreshTokenIfNeeded still runs), which is exactly why this
      // test is expected to fail before the 2c mitigation is implemented.
      refreshTokenIfNeeded: async (force) => {
        refreshCalls.push(!!force);
        if (force) {
          await pool.query(
            `UPDATE tokens SET access_token = 'refreshed-token' WHERE contractor_id = $1`,
            ['test-roofing']
          );
        }
      },
    });

    const resp = await post({
      data: { webHookEvent: { itemId: 'inv-401-001' } },
      contractor_id: 'test-roofing',
    });
    assert.equal(resp.status, 200);

    const { rows: rcRows } = await pool.query('SELECT * FROM referral_conversions');
    await waitFor(async () => {
      const { rows } = await pool.query('SELECT * FROM referral_conversions');
      return rows.length > 0;
    }, { timeout: 5000 });

    assert.equal(invoiceCallCount, 2, 'fetchInvoiceWithJobs called exactly twice (original + one retry)');
    assert.ok(refreshCalls.some(f => f === true), 'refreshTokenIfNeeded was called with force=true at least once');
    assert.equal(
      invoiceCallTokens[1], 'refreshed-token',
      'retry call re-reads the token from DB after forcing refresh — must not reuse the stale in-memory token'
    );
    assert.equal(
      fullClientToken, 'refreshed-token',
      'the subsequent fetchFullClient call reuses the refreshed token, not the original stale one'
    );

    const { rows: rcRowsAfter } = await pool.query('SELECT * FROM referral_conversions');
    assert.equal(rcRowsAfter.length, 1, 'referral engine completes normally after the retry succeeds');
  });

  // ── TEST 10 — non-401 errors must not trigger forced refresh ────────────────
  it('non-401 error from fetchInvoiceWithJobs → no retry, no forced refresh, error_log carries resolved contractorId', async () => {
    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: false });

    let invoiceCallCount = 0;
    const refreshCalls = [];
    _setTestOverrides({
      fetchInvoiceWithJobs: async () => {
        invoiceCallCount++;
        const err = new Error('Request failed with status code 500');
        err.response = { status: 500 };
        throw err;
      },
      fetchFullClient:        async () => { throw new Error('must not be called'); },
      fetchClientRelatedData: async () => { throw new Error('must not be called'); },
      refreshTokenIfNeeded: async (force) => { refreshCalls.push(!!force); },
    });

    const resp = await post({
      data: { webHookEvent: { itemId: 'inv-500-001' } },
      contractor_id: 'test-roofing',
    });
    assert.equal(resp.status, 200);

    await waitFor(async () => {
      const { rows } = await pool.query("SELECT * FROM error_log WHERE source LIKE '%fetchInvoiceWithJobs%'");
      return rows.length > 0;
    });

    assert.equal(invoiceCallCount, 1, 'no retry on a non-401 error');
    assert.ok(!refreshCalls.some(f => f === true), 'forced refresh (force=true) is never triggered by a non-401 error');

    const { rows: errRows } = await pool.query("SELECT * FROM error_log WHERE source LIKE '%fetchInvoiceWithJobs%'");
    assert.equal(errRows.length, 1);
    assert.equal(
      errRows[0].contractor_id, 'test-roofing',
      'error_log.contractor_id is the resolved contractorId, not the stale fallback'
    );
  });
});
