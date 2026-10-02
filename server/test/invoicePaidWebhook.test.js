'use strict';

// setup.js MUST be required first — it sets JOBBER_CLIENT_SECRET and loads .env.test
// before db.js (required transitively below) creates its pool.
const { initTestDb, captureResend } = require('./setup');

// 7d-0 — THIS SUITE DRIVES A SEND ITS OWN STUB DOES NOT COVER, AND THAT IS WHY IT OPTS IN.
// Measured: an errorLogger first-occurrence alert, a notificationEmail contractor notice, or an
// unawaited signup verification mail — fired by production code this suite does not know it is
// reaching, in one case completing AFTER the test ended. Before the interlock those went to
// Resend with the real key. Recorded here instead; no network is touched in either state, and the
// interlock's default-deny still applies to every suite that has not written this line.
captureResend();
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

// ── C1 — WHY THESE FIXTURES MOVED, AND WHAT EACH PART OF THE MOVE IS FOR ──────
//
// The credit no longer reads the LIVE client's "Referred by" custom field. It reads SAVED CLIENT
// FACTS (Danny, ruling 1), inside the lock, from an invoice assembled out of `crm_invoice_facts`.
// Four cases in this file therefore went red on wip/c1, and every one of them needed the same
// three repairs — stated here once rather than three times:
//
// ⚠ 1. THE CLIENT ID HAD TO BECOME A REAL JOBBER EncodedId. It was `'jobber-c1'`, which
// `isDerivableJobberClientId` REJECTS, so the whole `alsoDeriveReferredStatus` block — the status
// write AND the credit — was skipped before it began. Assembled from the exported
// `JOBBER_CLIENT_GID_PREFIX` rather than from a literal typed twice: a fixture that hardcodes its
// own expectation cannot notice the production value changing underneath it.
//
// ⚠ 2. `fetchClientRelatedData` HAD TO RETURN A CAPTURE SHAPE INSTEAD OF `null`. It returned null,
// so NO CAPTURE RAN AT ALL and there were no facts to credit from. ⚠ THE FACTS ARE WRITTEN BY THE
// REAL `captureClientFacts` FROM THIS OBJECT — they are deliberately NOT pre-seeded. A test that
// inserts the fact rows itself cannot discover that nothing upstream supplies them, which is the
// defect CLAUDE.md records from the font columns and from `requests` on this very door.
//
// ⚠ 3. THE CONTRACTOR NEEDED A work_category MAPPING BY CONFIGURATION ID, plus the discovered-field
// rows the resolver walks. A legacy label-string mapping resolves `mapping_not_by_id` and credits
// NOTHING (7c-1, deliberately — "rather than being paid on a guess"), so a label-mapped fixture
// would have failed for a reason that has nothing to do with what these cases are about.
//
// ⚠ AND THE LIVE CUSTOM FIELD STAYS ON `FULL_CLIENT_WITH_REFERRAL` — it is NOT dead weight. The
// experience flow and the pending-referral matcher both still read `referredBy` off the live client;
// only the CREDIT moved to facts. Deleting it as an orphan would break two other paths silently.

const { JOBBER_CLIENT_GID_PREFIX } = require('../utils/derivableClient');

// A real Jobber client EncodedId, built from the production prefix.
const CLIENT_ID = Buffer.from(`${JOBBER_CLIENT_GID_PREFIX}910001`).toString('base64');

const INVOICE_ID = 'inv-node-ip1';
const JOB_ID = 'job-node-ip1';

// ⚠ TWO DISTINCT CONFIGURATION IDS, AND THEY MUST DIFFER FROM EACH OTHER FOR THE FIXTURE TO MEAN
// ANYTHING. The referrer field and the category field are resolved by DIFFERENT mechanisms reading
// the SAME fact table; one id for both would let a resolver match the wrong row and still look right.
const WORK_CATEGORY_FIELD_ID = Buffer.from('gid://Jobber/CustomFieldConfigurationDropdown/730114').toString('base64');
const REFERRER_FIELD_ID = Buffer.from('gid://Jobber/CustomFieldConfigurationText/3655374').toString('base64');

// The client's own Jobber creation date. ⚠ AFTER any programme start these cases set, so the one
// start-date rule ADMITS it — the refusing direction is pinned in c1Credit.test.js, not here.
const CLIENT_CREATED_AT = '2026-02-01T00:00:00.000Z';

const PAID_INVOICE = {
  invoiceStatus: 'paid',
  invoiceNumber: 'INV-001',
  issuedDate: '2026-06-10',
  waitingForFinancedPayment: false,
  amounts: { total: 10000, invoiceBalance: 0 },
  client: { id: CLIENT_ID, name: 'Test Client' },
  jobs: {
    nodes: [{ id: JOB_ID, customFields: [{ label: 'Job Type', valueDropdown: 'Roof Replacement' }] }],
  },
  archivedJobs: { nodes: [] },
};

const FULL_CLIENT_WITH_REFERRAL = {
  id: CLIENT_ID,
  createdAt: CLIENT_CREATED_AT,
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

// ── THE CAPTURE SHAPE `fetchClientRelatedData` RETURNS ───────────────────────
// ⚠ EVERY NODE CARRIES `client { id }`. Each fact writer keys its row on it and FILTERS OUT a node
// without one — so a missing `client` makes the capture report success having written nothing, which
// is the silent shape this file's reds were a symptom of.
// ⚠ AND EVERY CUSTOM FIELD CARRIES `customFieldConfiguration { id }`. `writeCustomFieldFacts` skips
// any field without one, so a fixture spelling only `label` would write ZERO custom-field facts and
// the credit would read `not_referred` — the exact defect Commit A closed on this door in production.
const relatedClient = ({ referred = true } = {}) => ({
  id: CLIENT_ID,
  createdAt: CLIENT_CREATED_AT,
  isCompany: false,
  isLead: false,
  tags: { nodes: [] },
  customFields: referred
    ? [{
      label: 'Referred by',
      valueText: 'Jane Referrer',
      valueDropdown: null,
      customFieldConfiguration: { id: REFERRER_FIELD_ID },
    }]
    : [],
  quotes: { nodes: [] },
  requests: { nodes: [] },
  jobs: {
    nodes: [{
      id: JOB_ID,
      jobNumber: 1,
      jobStatus: 'active',
      jobType: 'ONE_OFF',
      title: 'Roof',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      startAt: null, endAt: null, completedAt: null,
      total: 10000, invoicedTotal: 10000, uninvoicedTotal: 0,
      client: { id: CLIENT_ID },
      quote: null, request: null, salesperson: null,
      invoices: { nodes: [] },
      customFields: [{
        label: 'Job Type',
        valueDropdown: 'Roof Replacement',
        valueText: null,
        customFieldConfiguration: { id: WORK_CATEGORY_FIELD_ID },
      }],
    }],
  },
  invoices: {
    nodes: [{
      id: INVOICE_ID,
      client: { id: CLIENT_ID },
      invoiceNumber: 'INV-001',
      invoiceStatus: 'paid',
      // ⚠ EXPLICITLY `false`, NEVER OMITTED. The 7d gate blocks unless this is exactly false, and an
      // absent field is stored as NULL — which would make every one of these cases fail on
      // `waiting_for_financed_payment` rather than on their own subject.
      waitingForFinancedPayment: false,
      amounts: { total: 10000, invoiceBalance: 0 },
      issuedDate: '2026-06-10T00:00:00.000Z',
      dueDate: null, receivedDate: '2026-06-11T00:00:00.000Z',
      createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-11T00:00:00.000Z',
      customFields: [],
      jobs: { nodes: [{ id: JOB_ID }], pageInfo: { hasNextPage: false } },
      archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
    }],
  },
});

const RELATED_DATA = relatedClient();
const RELATED_DATA_NO_REFERRAL = relatedClient({ referred: false });

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
    // ── C1 — THE TABLES THE REAL CAPTURE NOW WRITES ───────────────────────────
    // ⚠ ADDED BECAUSE THE CAPTURE RUNS FOR REAL NOW, and the 6c reset-coverage fence requires every
    // table a suite touches to be cleared by its own reset. An uncleared fact table is worse than
    // untidy: the next case's "no conversion was written" would be measuring the previous case's
    // leftovers, which is the vacuity family wearing a fixture.
    await pool.query('DELETE FROM category_mismatches');
    await pool.query('DELETE FROM crm_custom_field_facts');
    await pool.query('DELETE FROM crm_invoice_job_links');
    await pool.query('DELETE FROM crm_invoice_facts');
    await pool.query('DELETE FROM crm_job_facts');
    await pool.query('DELETE FROM crm_quote_facts');
    await pool.query('DELETE FROM crm_request_facts');
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM contractor_jobber_fields');
    await pool.query('DELETE FROM contractor_settings');
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

  // ── C1 — THE work_category MAPPING, BY CONFIGURATION ID ─────────────────────
  // ⚠ BY ID, NEVER BY LABEL, AND THE DIFFERENCE IS THE WHOLE OF 7c-1. The legacy string form
  // (`{"work_category": "Job Type"}`) resolves `mapping_not_by_id` with a null value, so
  // `categoryValues` is `[]` and `evaluateReferral` returns `no_job_type_found` — a fixture mapped
  // that way credits nobody, and would have failed every case below for a reason unrelated to its
  // subject. Three live configurations share the label "Job Type", which is why the resolver refuses
  // to guess rather than picking one.
  // ⚠ THE DISCOVERED-FIELD ROWS ARE NOT DECORATION. `resolveAcceptableConfigurations` reads
  // `contractor_jobber_fields` to follow `transfered_from` links, and `resolveReferralSourceField`
  // reads it to confirm the picked field still exists. Seeding the mapping without them resolves a
  // field the contractor is not recorded as having.
  async function seedFieldMappingById() {
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (contractor_id) DO UPDATE
         SET contractor_field_mappings = EXCLUDED.contractor_field_mappings`,
      ['test-roofing', JSON.stringify({
        work_category: { field_id: WORK_CATEGORY_FIELD_ID, entity: 'ALL_JOBS', label: 'Job Type' },
      })]
    );
    await pool.query(
      `INSERT INTO contractor_jobber_fields
         (contractor_id, jobber_field_id, label, field_type, entity, transferable, archived)
       VALUES ($1, $2, 'Job Type', 'DROPDOWN', 'ALL_JOBS', TRUE, FALSE),
              ($1, $3, 'Referred by', 'TEXT', 'ALL_CLIENTS', FALSE, FALSE)`,
      ['test-roofing', WORK_CATEGORY_FIELD_ID, REFERRER_FIELD_ID]
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
  it('qualified referral → referral_conversions row + bonus + first-milestone emails, and paid_count untouched', async () => {
    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: false });
    await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@test.com', contractorId: 'test-roofing' });
    await seedReferralSchedule(pool, {
      contractorId: 'test-roofing',
      jobberLabel: 'Roof Replacement',
      flatAmount: 250,
    });
    await seedFieldMappingById();

    const emails = [];
    _setTestOverrides({
      fetchInvoiceWithJobs:   async () => PAID_INVOICE,
      fetchFullClient:        async () => FULL_CLIENT_WITH_REFERRAL,
      fetchClientRelatedData: async () => RELATED_DATA,
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
    assert.equal(rcRows[0].jobber_client_id, CLIENT_ID, 'jobber_client_id recorded');

    // ⚠ INVERTED BY A RULING, NOT BY A BUG (Danny, 2026-09-29). This asserted
    // `paid_count === 1` — the webhook's `paid_count + 1`. That increment is RETIRED:
    // `users.paid_count` now has exactly ONE writer, an absolute recompute in the pipeline sync
    // (server/utils/referrerProgress.js). An increment double-counts a redelivered delivery and
    // can never self-heal; a recompute is idempotent and corrects drift on every tick.
    // ⚠ SO THE WEBHOOK MUST NOW LEAVE IT ALONE, and that is what is asserted instead. The
    // absolute recompute has its own coverage in server/test/referrerProgressEarning.test.js.
    const { rows: userRows } = await pool.query(
      "SELECT paid_count FROM users WHERE LOWER(full_name) = 'jane referrer'"
    );
    assert.equal(userRows[0].paid_count, 0, 'the webhook must NOT touch paid_count — the sync owns it');

    const subjects = emails.map(e => e.subject);
    assert.ok(subjects.some(s => s.includes('250')), 'bonus email subject contains amount');
    assert.ok(subjects.some(s => s.toLowerCase().includes('first')), 'first-milestone email sent');
  });

  // ── N4 COMMIT 6 — THE EXTRACTION WROTE EXACTLY THE SAME ROW ─────────────────
  it('the conversion row is IDENTICAL after the writer was extracted — every column asserted', async () => {
    // ⚠ THE CASE ABOVE PROVES A ROW EXISTS WITH THE RIGHT BONUS AND CLIENT. That is three
    // columns out of eight, and a "pure extraction" claim needs more than three: a writer that
    // dropped `contractor_id`, stamped the wrong `payout_status`, or quietly stopped setting
    // `converted_at` would pass every assertion in it. This asserts the WHOLE row, so the claim
    // "no behaviour change" is checkable rather than asserted.
    // ⚠ AND THE EXPECTED VALUES ARE WRITTEN OUT RATHER THAN READ BACK FROM A CONSTANT. A fixture
    // that derived them from the same place the writer does could not notice the writer changing.
    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: false });
    await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@test.com', contractorId: 'test-roofing' });
    await seedReferralSchedule(pool, {
      contractorId: 'test-roofing',
      jobberLabel: 'Roof Replacement',
      flatAmount: 250,
    });
    await seedFieldMappingById();

    const emails = [];
    _setTestOverrides({
      fetchInvoiceWithJobs:   async () => PAID_INVOICE,
      fetchFullClient:        async () => FULL_CLIENT_WITH_REFERRAL,
      fetchClientRelatedData: async () => RELATED_DATA,
      sendEmail: async args => { emails.push(args); return { id: 'test-email' }; },
    });

    const before = new Date();
    const resp = await post({
      data: { webHookEvent: { itemId: 'inv-003' } },
      contractor_id: 'test-roofing',
    });
    assert.equal(resp.status, 200);
    await waitFor(() => emails.length >= 2, { timeout: 5000 });

    const { rows: userRows } = await pool.query(
      "SELECT id FROM users WHERE LOWER(full_name) = 'jane referrer'"
    );
    const expectedUserId = userRows[0].id;

    const { rows } = await pool.query('SELECT * FROM referral_conversions');
    assert.equal(rows.length, 1, 'exactly one conversion');
    const row = rows[0];

    assert.equal(row.user_id, expectedUserId, 'user_id is the matched referrer');
    assert.equal(row.contractor_id, 'test-roofing', 'contractor_id is carried — a conversion is tenant-scoped');
    assert.equal(row.jobber_client_id, CLIENT_ID, 'jobber_client_id is the invoice\'s client');
    assert.equal(parseFloat(row.bonus_amount), 250, 'bonus_amount is the schedule\'s flat amount');
    assert.equal(row.payout_status, 'pending_review', 'payout_status takes the column default — the writer must not set it');
    assert.ok(row.id, 'the row has an id');
    assert.ok(row.converted_at instanceof Date, 'converted_at is a timestamp, not a string');
    assert.ok(row.converted_at >= before, 'converted_at is NOW() at write time, not a fixture value');

    // ⚠ EVERY COLUMN IS ACCOUNTED FOR, so a column ADDED later cannot go silently unasserted —
    // which is how a writer starts filling something nobody checks.
    //
    // ⚠ AND THIS IS NOT A FIXED SET, BECAUSE THE TEST DATABASE AND PRODUCTION GENUINELY DIFFER.
    // `referral_conversions.job_type` EXISTS in the Railway database and does NOT exist here: its
    // migration was removed from `server/db.js` in Session 49 and must not be re-added, so a
    // fresh schema never grows it. A `deepEqual` against one fixed list therefore fails in one
    // environment or the other — which is what the first writing of this case did, asserting
    // `job_type === null` and getting `undefined`.
    // ⚠ THE PROPERTY THAT HOLDS IN BOTH is: the seven columns the writer is responsible for are
    // present, and anything else is a KNOWN divergence named here. A new unexpected column fails.
    const REQUIRED = ['bonus_amount', 'contractor_id', 'converted_at', 'id', 'jobber_client_id', 'payout_status', 'user_id'];
    const KNOWN_ENV_DIVERGENCE = ['job_type'];
    const present = Object.keys(row).sort();
    for (const col of REQUIRED) {
      assert.ok(present.includes(col), `the conversions row lost ${col}`);
    }
    assert.deepEqual(
      present.filter((c) => !REQUIRED.includes(c) && !KNOWN_ENV_DIVERGENCE.includes(c)),
      [],
      'the conversions table gained a column — assert it here deliberately rather than leaving '
      + 'it unchecked, and say whether the writer is meant to fill it'
    );
    // If the orphaned column IS present (production-shaped schema), the writer must leave it null.
    if (present.includes('job_type')) {
      assert.equal(row.job_type, null, 'this path does not write job_type');
    }
  });

  // ── TEST 5 ──────────────────────────────────────────────────────────────────
  it('duplicate webhook delivery — no second conversion row, and paid_count untouched throughout', async () => {
    // Fires the same invoice twice. The first records the conversion; the second is blocked by
    // evaluateReferral's dupe check (qualified:false) and by the rowCount guard.
    // ⚠ THIS CASE'S SUBJECT CHANGED WITH THE RULING. It was *"paid_count increments exactly
    // once"* — an assertion about an increment that no longer exists. The webhook does not touch
    // `paid_count` at all now, so what is worth pinning here is that the DUPLICATE writes no
    // second conversion row, and that `paid_count` stays where the sync left it either way.
    // ⚠ IDEMPOTENCE OF `paid_count` DID NOT STOP MATTERING — IT MOVED. It is proven where the
    // writer now lives: referrerProgressEarning.test.js asserts a re-run cannot double-count AND
    // that a wrong stored value self-heals, which an increment could never do.

    await seedTestContractor();
    await seedToken(pool, { contractorId: 'test-roofing' });
    await seedEngagementSettings(pool, { contractorId: 'test-roofing', experienceFlowEnabled: false });
    await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@test.com', contractorId: 'test-roofing' });
    await seedReferralSchedule(pool, {
      contractorId: 'test-roofing',
      jobberLabel: 'Roof Replacement',
      flatAmount: 250,
    });
    await seedFieldMappingById();

    const emails = [];
    let fetchRelatedCallCount = 0;
    _setTestOverrides({
      fetchInvoiceWithJobs:   async () => PAID_INVOICE,
      fetchFullClient:        async () => FULL_CLIENT_WITH_REFERRAL,
      fetchClientRelatedData: async () => { fetchRelatedCallCount++; return RELATED_DATA; },
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
    assert.equal(userRows1[0].paid_count, 0, 'the webhook leaves paid_count alone');

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
      userRows2[0].paid_count, 0,
      'and still untouched after a duplicate — the webhook is not a paid_count writer'
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
      fetchClientRelatedData: async () => { fetchRelatedCalled = true; return RELATED_DATA_NO_REFERRAL; },
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
    await seedFieldMappingById();

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
      fetchClientRelatedData: async () => RELATED_DATA,
      sendEmail: async () => ({ id: 'test-email' }),
      // TF session (CRM_TOKEN_FIX_SPEC.md v1.0 §6, TEST 8): pins the NEW refreshTokenIfNeeded
      // contract — contractorId as the first argument, { force } as the second. The seam
      // itself (_refreshTokenIfNeeded / _setTestOverrides) is fully wired today; what's
      // missing is production code at webhooks/jobber.js:699/727 actually calling it with
      // this shape instead of the old positional-force signature — that's why this test is
      // expected to fail (RED) until the BUILD phase lands.
      refreshTokenIfNeeded: async (contractorId, opts = {}) => {
        refreshCalls.push({ contractorId, force: !!opts.force });
        if (opts.force) {
          await pool.query(
            `UPDATE tokens SET access_token = 'refreshed-token' WHERE contractor_id = $1`,
            [contractorId]
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
    assert.ok(
      refreshCalls.some(c => c.force === true && c.contractorId === 'test-roofing'),
      'refreshTokenIfNeeded was called with contractorId="test-roofing" and force:true at least once'
    );
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
      refreshTokenIfNeeded: async (contractorId, opts = {}) => { refreshCalls.push({ contractorId, force: !!opts.force }); },
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
    assert.ok(!refreshCalls.some(c => c.force === true), 'forced refresh (force=true) is never triggered by a non-401 error');

    const { rows: errRows } = await pool.query("SELECT * FROM error_log WHERE source LIKE '%fetchInvoiceWithJobs%'");
    assert.equal(errRows.length, 1);
    assert.equal(
      errRows[0].contractor_id, 'test-roofing',
      'error_log.contractor_id is the resolved contractorId, not the stale fallback'
    );
  });
});
