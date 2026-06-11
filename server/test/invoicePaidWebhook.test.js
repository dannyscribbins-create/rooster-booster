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
  });

  // Signs and POSTs to /webhooks/jobber/invoice-paid. Returns { status, body }.
  function post(payloadObject) {
    const { body, signature } = signJobberWebhook(payloadObject);
    return httpPost(port, '/webhooks/jobber/invoice-paid', body, {
      'x-jobber-hmac-sha256': signature,
    });
  }

  // ── TEST 1 ──────────────────────────────────────────────────────────────────
  it('non-paid invoiceStatus in payload → 200, IIFE exits synchronously, no DB writes', async () => {
    // No seeds needed — the IIFE exits before any DB query.
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
    await seedContractor(pool, 'test-roofing');
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
    await seedContractor(pool, 'test-roofing');
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: false });
    await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@test.com' });
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

    await seedContractor(pool, 'test-roofing');
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: false });
    await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@test.com' });
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
    await seedContractor(pool, 'test-roofing');
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: true });
    // Seed app user whose email matches the client email returned by the stub.
    await seedUser(pool, { fullName: 'App User', email: 'app-user@example.com' });

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
    await seedContractor(pool, 'test-roofing');
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
    await seedContractor(pool, 'test-roofing');
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
});
