'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C1 — THE CONVERSION CREDIT, FROM SAVED FACTS
//
// Danny's rulings, 2026-10-01. Before C1 a conversion could be written by exactly one thing: the
// invoice-paid webhook, evaluating a LIVE invoice object it had just fetched. A client that became
// paid by any other route — the sync, a stage webhook, the catch-up job, a re-capture — reached
// 'paid' on the referrer's own screen and was never credited at all.
//
// This suite covers the three things that make the credit trustworthy, and nothing else:
//   1. THE ONE START-DATE RULE, in both directions, on BOTH paths — the one that holds a stored
//      creation date and the one that cannot.
//   2. THE GATES ARE NOT RE-IMPLEMENTED. `creditReferralFromFacts` assembles an invoice from facts
//      and hands it to `evaluateReferral`; this suite proves the gates still bite through it.
//   3. EXACTLY ONCE, AND EXACTLY ONE EMAIL. A credit is money and an email is a promise about money.
//
// ⚠ EVERY FACT ROW THESE CASES READ IS WRITTEN BY THE REAL `captureClientFacts`, FROM A REAL
// CAPTURE SHAPE, THROUGH THE REAL WEBHOOK WHERE THE CASE IS ABOUT THE DOOR. Nothing pre-seeds
// `crm_custom_field_facts` or `crm_invoice_facts` for a case whose subject is whether the credit can
// find them. A test that inserts the rows it claims to read cannot discover that nothing upstream
// supplies them — the defect CLAUDE.md records from the font columns, and from `requests` on this
// very door. The unit-level cases that DO seed facts say so and are about the gate, not the supply.
//
// ⚠ AND THE EMAIL SEAM IS THE ROUTER'S, FORWARDED. `referralNotify` carries its own `_sendEmail`;
// the router's `_setTestOverrides` forwards into it (C1), which is what makes these email counts
// observable at all. The catch-up job does NOT go through the router, so its cases override the
// notify module directly — stated here because the asymmetry is easy to mistake for a mistake.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb, captureResend } = require('./setup');

// This suite drives real sends through a stub, and production code it does not control (errorLogger's
// first-occurrence alert) can fire its own. Recorded rather than delivered; no network either way.
captureResend();

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;

const notifyModule = require('../utils/referralNotify');
const { creditReferralFromFacts } = require('../utils/referralCredit');
const { runRedecideStaleClients, selectStaleClients } = require('../jobs/redecideStaleClients');
const { JOBBER_CLIENT_GID_PREFIX } = require('../utils/derivableClient');

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

const TENANT = 'c1-roofing';
const ACCOUNT = 'JACCT_C1';

// ⚠ A REAL JOBBER EncodedId, ASSEMBLED FROM THE EXPORTED PREFIX. `isDerivableJobberClientId` rejects
// a synthetic id, and the whole credit block sits behind it — so a fixture id like 'c1' would skip
// every case in this file silently rather than failing it.
const clientId = (n) => Buffer.from(`${JOBBER_CLIENT_GID_PREFIX}${n}`).toString('base64');
const CLIENT = clientId(930001);
const CLIENT_TWO = clientId(930002);

const INVOICE = 'inv-node-c1';
const JOB = 'job-node-c1';

// ⚠ TWO DISTINCT CONFIGURATION IDS. The referrer field and the category field are resolved by
// DIFFERENT mechanisms reading the SAME fact table; sharing one id would let a resolver match the
// wrong row and still look right.
const WORK_CATEGORY_FIELD = Buffer.from('gid://Jobber/CustomFieldConfigurationDropdown/730114').toString('base64');
const REFERRER_FIELD = Buffer.from('gid://Jobber/CustomFieldConfigurationText/3655374').toString('base64');

const START_DATE = '2026-01-01';
const AFTER_START = '2026-03-01T00:00:00.000Z';
const BEFORE_START = '2025-06-01T00:00:00.000Z';

// ⚠ AN ODD BONUS, NOT A ROUND ONE. A round 250 is the kind of number a speculative ladder or a
// default could also produce, so an assertion on it cannot tell the ledger from a coincidence.
const BONUS = 737;

describe('C1 — the conversion credit from saved facts', () => {
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

  // ⚠ FK-SAFE ORDER, AND EVERY TABLE THIS SUITE TOUCHES IS HERE. The 6c reset-coverage fence
  // requires it, and the reason is not tidiness: most cases below assert an ABSENCE — no second
  // conversion, no email, nothing credited — and an absence measured over an uncleared table is
  // measuring the previous case's leftovers.
  beforeEach(async () => {
    _resetTestOverrides();
    notifyModule._resetTestOverrides();
    for (const t of [
      'referral_conversions',
      'referral_schedule_job_types', 'referral_schedules',
      'category_mismatches',
      'crm_custom_field_facts', 'crm_invoice_job_links', 'crm_invoice_facts',
      'crm_job_facts', 'crm_quote_facts', 'crm_request_facts',
      'contact_tags', 'contacts',
      'pipeline_cache', 'jobber_clients',
      'experience_invite_tokens', 'experience_prompts',
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
  });

  // ── THE CAPTURE SHAPE ─────────────────────────────────────────────────────
  // ⚠ EVERY NODE CARRIES `client { id }` AND EVERY CUSTOM FIELD CARRIES
  // `customFieldConfiguration { id }`. Each fact writer FILTERS OUT a node missing either and
  // returns a count as though it had worked, so a fixture short of one writes nothing and reports
  // success — which is the silent shape this whole commit exists to close on the money path.
  const relatedClient = ({
    id = CLIENT,
    createdAt = AFTER_START,
    referred = true,
    referrerName = 'Jane Referrer',
    financed = false,
    invoiceStatus = 'paid',
    balance = 0,
    invoiceId = INVOICE,
    jobId = JOB,
    category = 'Roof Replacement',
  } = {}) => ({
    id,
    createdAt,
    isCompany: false,
    isLead: false,
    tags: { nodes: [] },
    customFields: referred
      ? [{
        label: 'Referred by',
        valueText: referrerName,
        valueDropdown: null,
        customFieldConfiguration: { id: REFERRER_FIELD },
      }]
      : [],
    quotes: { nodes: [] },
    requests: { nodes: [] },
    jobs: {
      nodes: [{
        id: jobId,
        jobNumber: 1,
        jobStatus: 'active',
        jobType: 'ONE_OFF',
        title: 'Roof',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T00:00:00.000Z',
        startAt: null, endAt: null, completedAt: null,
        total: 10000, invoicedTotal: 10000, uninvoicedTotal: 0,
        client: { id }, quote: null, request: null, salesperson: null,
        invoices: { nodes: [] },
        customFields: [{
          label: 'Job Type',
          valueDropdown: category,
          valueText: null,
          customFieldConfiguration: { id: WORK_CATEGORY_FIELD },
        }],
      }],
    },
    invoices: {
      nodes: [{
        id: invoiceId,
        client: { id },
        invoiceNumber: 'INV-C1',
        invoiceStatus,
        // ⚠ PASSED THROUGH EXACTLY AS GIVEN, INCLUDING `null`. `writeInvoiceFacts` stores a non-boolean
        // as NULL, which is how the "unknown is not permission" case below gets a genuinely NULL
        // column rather than a fixture pretending to have one.
        waitingForFinancedPayment: financed,
        amounts: { total: 10000, invoiceBalance: balance },
        issuedDate: '2026-06-10T00:00:00.000Z',
        dueDate: null,
        receivedDate: '2026-06-11T00:00:00.000Z',
        createdAt: '2026-06-10T00:00:00.000Z',
        updatedAt: '2026-06-11T00:00:00.000Z',
        customFields: [],
        jobs: { nodes: [{ id: jobId }], pageInfo: { hasNextPage: false } },
        archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
      }],
    },
  });

  // ── SEEDS ─────────────────────────────────────────────────────────────────

  async function seedWorld({
    startDate = START_DATE,
    referrer = 'Jane Referrer',
    mapping = 'by_id',
  } = {}) {
    await seedContractor(pool, TENANT);
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id, referral_start_date)
       VALUES ($1, $2, $3::date)
       ON CONFLICT (contractor_id) DO UPDATE
         SET jobber_account_id = EXCLUDED.jobber_account_id,
             referral_start_date = EXCLUDED.referral_start_date`,
      [TENANT, ACCOUNT, startDate]
    );
    await seedToken(pool, { contractorId: TENANT });
    await seedEngagementSettings(pool, { contractorId: TENANT, experienceFlowEnabled: false });
    if (referrer) {
      await seedUser(pool, { fullName: referrer, email: 'jane@c1.test', contractorId: TENANT });
    }
    await seedReferralSchedule(pool, {
      contractorId: TENANT, jobberLabel: 'Roof Replacement', flatAmount: BONUS,
    });

    // ⚠ BY CONFIGURATION ID, NEVER BY LABEL — and the legacy form is a case of its own below rather
    // than an accident. 7c-1: three live configurations share the label "Job Type", so the resolver
    // refuses to guess, and a label-mapped contractor resolves `mapping_not_by_id` and credits nothing.
    const mappingValue = mapping === 'legacy'
      ? 'Job Type'
      : { field_id: WORK_CATEGORY_FIELD, entity: 'ALL_JOBS', label: 'Job Type' };
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (contractor_id) DO UPDATE
         SET contractor_field_mappings = EXCLUDED.contractor_field_mappings`,
      [TENANT, JSON.stringify({ work_category: mappingValue })]
    );
    await pool.query(
      `INSERT INTO contractor_jobber_fields
         (contractor_id, jobber_field_id, label, field_type, entity, transferable, archived)
       VALUES ($1, $2, 'Job Type', 'DROPDOWN', 'ALL_JOBS', TRUE, FALSE),
              ($1, $3, 'Referred by', 'TEXT', 'ALL_CLIENTS', FALSE, FALSE)`,
      [TENANT, WORK_CATEGORY_FIELD, REFERRER_FIELD]
    );
  }

  // Facts, written by the REAL capture rather than by an INSERT here.
  // ⚠ IT GOES THROUGH `captureClientFacts`, so the fact rows these cases read are the rows
  // production would have written from the same object. The alternative — INSERTing them — would
  // make every case below unable to notice the capture breaking.
  async function captureFacts(related) {
    const { captureClientFacts } = require('../utils/factCapture');
    await captureClientFacts(pool, { contractorId: TENANT, client: related });
  }

  async function seedIdentityRow(id, jobberCreatedAt, { fullCapture = false } = {}) {
    await pool.query(
      `INSERT INTO jobber_clients
         (contractor_id, jobber_client_id, first_name, last_name, jobber_created_at,
          last_full_capture_at, stage_derived_at)
       VALUES ($1, $2, 'Test', 'Client', $3::timestamptz, $4, NULL)
       ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE
         SET jobber_created_at = EXCLUDED.jobber_created_at,
             last_full_capture_at = EXCLUDED.last_full_capture_at`,
      [TENANT, id, jobberCreatedAt, fullCapture ? new Date() : null]
    );
  }

  const conversions = async () =>
    (await pool.query('SELECT * FROM referral_conversions ORDER BY id')).rows;

  function post(payloadObject) {
    const withAccountId = {
      ...payloadObject,
      data: {
        ...payloadObject.data,
        webHookEvent: { ...payloadObject.data?.webHookEvent, accountId: ACCOUNT },
      },
    };
    const { body, signature } = signJobberWebhook(withAccountId);
    return httpPost(port, '/webhooks/jobber/invoice-paid', body, {
      'x-jobber-hmac-sha256': signature,
    });
  }

  // Drives the real invoice-paid door. Returns the array the email seam recorded into.
  async function fireInvoicePaid({ related, itemId = 'inv-c1-1' } = {}) {
    const emails = [];
    _setTestOverrides({
      fetchInvoiceWithJobs: async () => ({
        invoiceStatus: 'paid',
        invoiceNumber: 'INV-C1',
        issuedDate: '2026-06-10',
        waitingForFinancedPayment: false,
        amounts: { total: 10000, invoiceBalance: 0 },
        client: { id: related.id, name: 'Test Client' },
        jobs: { nodes: [{ id: JOB, customFields: [] }] },
        archivedJobs: { nodes: [] },
      }),
      fetchFullClient: async () => ({
        id: related.id,
        createdAt: related.createdAt,
        firstName: 'Test',
        lastName: 'Client',
        emails: [{ address: 'c1client@example.com' }],
        phones: [{ number: '5550007777' }],
        customFields: [],
        quotes: { nodes: [] },
        jobs: { nodes: [] },
      }),
      fetchClientRelatedData: async () => related,
      sendEmail: async (args) => { emails.push(args); return { id: 'c1-email' }; },
    });
    const resp = await post({ data: { webHookEvent: { itemId } }, contractor_id: TENANT });
    assert.equal(resp.status, 200, 'the door must ack 200');
    return emails;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1 — THE ONE START-DATE RULE, ON THE PATH THAT HOLDS NO STORED ROW
  //
  // ⚠ THIS IS THE DESCRIBE THAT FOUND A LIVE DEFECT, AND THE DEFECT WAS ORDERING RATHER THAN LOGIC.
  // On the invoice-paid door the `jobber_clients` identity upsert runs AFTER both the capture and the
  // decision, so on a FIRST SIGHTING `captureClientFacts`' write of `jobber_created_at` affects
  // **0 rows** — `factCapture.js` records exactly that ordering for the full-capture marker directly
  // above it. The gate then read no row, returned `client_created_at_unknown`, and the credit never
  // fired. Ruling 1 exists precisely so *"a first paid invoice is credited immediately rather than
  // waiting for the sync"*, so the one case the stored read cannot serve is the one the ruling names.
  // ⚠ THE PAIR IS WHAT MAKES IT A GUARD RATHER THAN A CONVENIENCE. A supplied date proven only in the
  // ADMITTING direction would be a money gate verified one way round.
  // ═══════════════════════════════════════════════════════════════════════════
  describe('the one start-date rule', () => {
    it('CREDITS a brand-new referred client whose creation date is AFTER the programme start — with no jobber_clients row in existence when the credit runs', async () => {
      await seedWorld();
      const emails = await fireInvoicePaid({ related: relatedClient({ createdAt: AFTER_START }) });
      await waitFor(async () => (await conversions()).length > 0, { timeout: 6000 });

      const rows = await conversions();
      assert.equal(rows.length, 1, 'exactly one conversion');
      assert.equal(rows[0].jobber_client_id, CLIENT);
      assert.equal(parseFloat(rows[0].bonus_amount), BONUS, 'the schedule amount, from the ledger');

      // ⚠ WAITED FOR EXPLICITLY, BECAUSE THE IDENTITY UPSERT RUNS *AFTER* THE NOTIFY. The first
      // writing of this case waited only on the conversion and the email and then read this row —
      // which passed once and failed on the next run. The whole door is a fire-and-forget IIFE, and
      // the identity upsert is the LAST thing in it, so an email is not evidence that it has happened.
      await waitFor(async () => (await pool.query(
        'SELECT 1 FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2',
        [TENANT, CLIENT]
      )).rows.length > 0, { timeout: 6000 });

      // ⚠ THE PRECONDITION, ASSERTED RATHER THAN ASSUMED, AND IT IS THE WHOLE POINT OF THIS CASE.
      // `jobber_clients.jobber_created_at` must still be NULL: that is the proof the credit did NOT
      // come from a stored read, and therefore that it came from the supplied live date. Without this
      // the case would pass identically on a tree where the ordering had been changed instead — which
      // is a different fix, and this case would then be silently testing something else.
      const { rows: jc } = await pool.query(
        'SELECT jobber_created_at FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2',
        [TENANT, CLIENT]
      );
      assert.equal(jc.length, 1, 'the identity row exists by now — it is written after the credit');
      assert.equal(
        jc[0].jobber_created_at, null,
        'the stored column is STILL NULL, so the credit cannot have read it — the supplied date is '
        + 'what admitted this client, which is exactly what this case exists to pin'
      );

      // And the referral record the credit created carries the date rather than a NULL.
      const { rows: pc } = await pool.query(
        'SELECT referred_by, jobber_created_at FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2',
        [TENANT, CLIENT]
      );
      assert.equal(pc.length, 1, 'ruling 1 creates the referral record in the same pass');
      assert.equal(pc[0].referred_by, 'Jane Referrer');
      assert.ok(pc[0].jobber_created_at, 'and it carries the creation date it was just credited on');

      assert.ok(emails.length >= 1, 'a new credit notifies');
    });

    it('REFUSES a brand-new referred client whose creation date is BEFORE the programme start — the paired negative, on the same path', async () => {
      await seedWorld();
      await fireInvoicePaid({ related: relatedClient({ createdAt: BEFORE_START }) });

      // ⚠ WAITING ON THE DOOR'S OWN TERMINAL SIGNAL RATHER THAN ON A TIMER. The identity upsert is
      // the last thing the door does, so a `jobber_clients` row means the whole IIFE has passed the
      // credit. An absence assertion needs a timing control or it is only measuring how fast it ran.
      await waitFor(async () => (await pool.query(
        'SELECT 1 FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2',
        [TENANT, CLIENT]
      )).rows.length > 0, { timeout: 6000 });

      assert.deepEqual(await conversions(), [], 'a pre-start client earns nothing');
    });

    it('REFUSES when the creation date is unknown — unknown is never permission', async () => {
      await seedWorld();
      // The fetch returned a client with no createdAt at all.
      await fireInvoicePaid({ related: relatedClient({ createdAt: null }) });
      await waitFor(async () => (await pool.query(
        'SELECT 1 FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2',
        [TENANT, CLIENT]
      )).rows.length > 0, { timeout: 6000 });

      assert.deepEqual(await conversions(), [], 'an unknown creation date earns nothing');
    });

    it('and it refuses an unknown date BY NAME — `client_created_at_unknown`, never a borrowed reason', async () => {
      // ⚠ THIS CASE EXISTS BECAUSE THE REFUSAL ABOVE IS NOT WHAT THE EXPLICIT CHECK BUYS, AND
      // MEASURING THAT WAS THE ONLY WAY TO FIND OUT. Delete the `if (!clientCreatedAt)` guard and an
      // unknown date is STILL refused — `null < aDate` coerces the null to the epoch, so the
      // start-date comparison catches it and returns `client_before_start_date`. Every "no conversion
      // was written" assertion stays green against that, so the guard's real value is the REASON.
      // ⚠ AND THE REASON IS OPERATIONAL, NOT COSMETIC: `client_created_at_unknown` means "this client
      // needs a capture and will then be credited", while `client_before_start_date` means "this
      // client is permanently out of the programme". Reporting the second for the first would send
      // someone looking for a client that was never in scope, and the credit would never be chased.
      await seedWorld();
      await captureFacts(relatedClient());
      await seedIdentityRow(CLIENT, null);

      const out = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(out.credited, false);
      assert.equal(out.reason, 'client_created_at_unknown', 'the reason must name what is actually wrong');
    });

    it('reads the STORED column when no caller supplies a date — the catch-up path, both directions', async () => {
      // ⚠ THIS IS THE CASE THAT KEEPS THE SUPPLIED DATE FROM BECOMING THE ONLY PATH. The catch-up
      // holds no live client, so if `evaluateReferral` ever stopped reading the column, the job would
      // silently credit nobody — and every case above would still pass.
      await seedWorld();
      await captureFacts(relatedClient());
      await seedIdentityRow(CLIENT, AFTER_START);

      const ok = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(ok.credited, true, 'the stored date admits it');
      assert.equal(parseFloat(ok.bonusAmount), BONUS);

      // The refusing direction, on the same stored path.
      await pool.query('DELETE FROM referral_conversions');
      await pool.query('DELETE FROM pipeline_cache');
      await seedIdentityRow(CLIENT, BEFORE_START);
      const no = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(no.credited, false);
      assert.equal(no.reason, 'client_before_start_date', 'the stored date refuses it, by name');
      assert.deepEqual(await conversions(), []);
    });

    it('a contractor with NO programme start date is not gated on a creation date at all', async () => {
      // ⚠ THE SKIP IS DELIBERATE AND IS ASSERTED, because the alternative reading — refuse everyone
      // for want of a setting — would be a worse answer than the one this rule replaces, and nothing
      // else in the suite would notice the gate had started firing unconditionally.
      await seedWorld({ startDate: null });
      await captureFacts(relatedClient());
      await seedIdentityRow(CLIENT, null);

      const out = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(out.credited, true, 'no start date means no start-date gate, on either half');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2 — THE GATES THE CREDIT DOES NOT RE-IMPLEMENT
  // ⚠ EVERY CASE HERE SEEDS ITS FACTS THROUGH THE REAL CAPTURE AND THEN CALLS THE CREDIT DIRECTLY.
  // The subject is whether a gate bites through the fact-assembled invoice, not whether the door
  // reaches the credit — which §1 and §3 cover end to end.
  // ═══════════════════════════════════════════════════════════════════════════
  describe('the gates, through a fact-assembled invoice', () => {
    it('a NULL financed flag does NOT convert — unknown is not permission', async () => {
      await seedWorld();
      // ⚠ `null`, NOT `false`. `writeInvoiceFacts` stores a non-boolean as NULL, so this produces a
      // genuinely NULL column — the state all 3,881 pre-column rows hold — rather than a fixture
      // asserting it has one.
      await captureFacts(relatedClient({ financed: null }));
      await seedIdentityRow(CLIENT, AFTER_START);

      // The precondition, asserted: the column really is NULL, or this case proves nothing.
      const { rows } = await pool.query(
        'SELECT waiting_for_financed_payment FROM crm_invoice_facts WHERE contractor_id = $1',
        [TENANT]
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].waiting_for_financed_payment, null, 'precondition: the flag is NULL');

      const out = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(out.credited, false);
      assert.equal(out.reason, 'waiting_for_financed_payment');
      assert.deepEqual(await conversions(), []);
    });

    it('an explicitly TRUE financed flag does NOT convert', async () => {
      await seedWorld();
      await captureFacts(relatedClient({ financed: true }));
      await seedIdentityRow(CLIENT, AFTER_START);
      const out = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(out.credited, false);
      assert.equal(out.reason, 'waiting_for_financed_payment');
    });

    it('PAIRED POSITIVE — an explicitly FALSE financed flag DOES convert', async () => {
      // ⚠ WITHOUT THIS, THE TWO CASES ABOVE PASS AGAINST A GATE THAT REFUSES EVERYTHING. That is the
      // whole difference between "TRUE or NULL is refused" and "nothing is ever credited".
      await seedWorld();
      await captureFacts(relatedClient({ financed: false }));
      await seedIdentityRow(CLIENT, AFTER_START);
      const out = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(out.credited, true);
      assert.equal(parseFloat(out.bonusAmount), BONUS);
    });

    it('a referrer with NO account is not credited, and nothing is written', async () => {
      await seedWorld({ referrer: null });
      await captureFacts(relatedClient());
      await seedIdentityRow(CLIENT, AFTER_START);

      // Precondition: there really is no matching user.
      const { rows: users } = await pool.query('SELECT id FROM users WHERE contractor_id = $1', [TENANT]);
      assert.deepEqual(users, [], 'precondition: no referrer account exists');

      const out = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(out.credited, false);
      assert.equal(out.reason, 'referrer_not_found');
      assert.deepEqual(await conversions(), []);
      // ⚠ AND THE REFERRAL RECORD IS STILL CREATED. The client IS referred; the referrer merely has no
      // account yet. Suppressing the record would hide a real referral from the contractor's own
      // screen, and the credit converges the day that person signs up.
      const { rows: pc } = await pool.query('SELECT referred_by FROM pipeline_cache WHERE contractor_id = $1', [TENANT]);
      assert.equal(pc.length, 1);
      assert.equal(pc[0].referred_by, 'Jane Referrer');
    });

    it('a client with no referrer in its facts is not credited, and the capture still ran', async () => {
      await seedWorld();
      await captureFacts(relatedClient({ referred: false }));
      await seedIdentityRow(CLIENT, AFTER_START);

      // ⚠ THE PRECONDITION THAT STOPS THIS BEING VACUOUS: the capture DID write facts, just no
      // referrer field. Without it, "no conversion" is satisfied by a capture that wrote nothing at
      // all — which is how the pre-C1 version of this assertion passed for the wrong reason.
      const { rows: inv } = await pool.query('SELECT 1 FROM crm_invoice_facts WHERE contractor_id = $1', [TENANT]);
      assert.equal(inv.length, 1, 'precondition: the capture wrote the invoice fact');

      const out = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(out.reason, 'not_referred');
      assert.deepEqual(await conversions(), []);
      const { rows: pc } = await pool.query('SELECT 1 FROM pipeline_cache WHERE contractor_id = $1', [TENANT]);
      assert.deepEqual(pc, [], 'and no referral record is invented for a client nobody referred');
    });

    it('a NON-DERIVABLE client id is never credited, even with facts and a referrer seeded under it', async () => {
      // ⚠ THIS CASE EXISTS BECAUSE A GUARD-PROOF MEASURED THE DERIVABLE-ID GUARD AT WIDTH 0, AND THAT
      // WAS A FINDING RATHER THAN A PASS. Removing `isDerivableJobberClientId` from the door changed
      // nothing across the whole suite — every other fixture uses a real EncodedId, so the guard was
      // never the thing excluding anything, and its failure mode had never been observed.
      // ⚠ AND IT IS NOT A HYPOTHETICAL POPULATION. `pipeline_cache` carries `app_user_<id>`
      // placeholders written at signup, plus synthetic ids from earlier testing — and CLAUDE.md records
      // that ONE PRODUCTION `referral_conversions` ROW IS ALREADY KEYED ON A NON-DERIVABLE ID
      // (`test-client-002`, $500). These ids reach the money table, so "they can have no facts by
      // construction" is an argument about today's data, not a guarantee.
      // ⚠ THE FIXTURE IS DELIBERATELY FULLY QUALIFYING EXCEPT FOR THE ID. Facts, a referrer with an
      // account, a mapped category, a paid invoice, a creation date after the start — everything the
      // credit needs. So the ONLY thing refusing it is the id, which is what makes the case
      // discriminating rather than another way of spelling "nothing qualified".
      const PLACEHOLDER = 'app_user_99';
      await seedWorld();
      await captureFacts(relatedClient({ id: PLACEHOLDER, invoiceId: 'inv-node-ph', jobId: 'job-node-ph' }));
      await seedIdentityRow(PLACEHOLDER, AFTER_START);

      // Precondition: this really is a fully qualifying world apart from the id. Proven by crediting
      // the SAME facts under a derivable id and seeing it succeed.
      await captureFacts(relatedClient());
      await seedIdentityRow(CLIENT, AFTER_START);
      const control = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(control.credited, true, 'precondition: the same world DOES credit a derivable id');

      const emails = await fireInvoicePaid({
        related: relatedClient({ id: PLACEHOLDER, invoiceId: 'inv-node-ph', jobId: 'job-node-ph' }),
        itemId: 'inv-c1-ph',
      });
      await waitFor(async () => (await pool.query(
        'SELECT 1 FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2',
        [TENANT, PLACEHOLDER]
      )).rows.length > 0, { timeout: 6000 });
      await new Promise((r) => setTimeout(r, 1200));

      const rows = await conversions();
      assert.equal(rows.length, 1, 'still only the control conversion');
      assert.equal(
        rows[0].jobber_client_id, CLIENT,
        'and it is the DERIVABLE client — the placeholder earned nothing'
      );
      assert.deepEqual(emails, [], 'and the placeholder triggered no email');

      // ⚠ AND IT IS SKIPPED CLEANLY RATHER THAN THROWN ON — THIS IS THE ASSERTION THAT MAKES THE
      // GUARD FALSIFIABLE, AND IT TOOK A MEASUREMENT TO FIND. Removing the door's
      // `isDerivableJobberClientId` check does NOT produce a wrongly-credited placeholder: it makes
      // `deriveReferredStatus` raise instead. That function carries a deliberate programmer-error
      // throw for a non-Jobber id, and its own comment says callers iterating a mixed population
      // "must filter FIRST" — the door's guard IS that filter.
      // ⚠ SO THE CONVERSION ASSERTIONS ABOVE CANNOT TELL THE TWO STATES APART: no conversion is
      // written either way, one by a clean skip and one by a thrown transaction. Measured: with the
      // guard removed this case stayed GREEN on every assertion above it, and the only observable
      // difference was an `error_log` row. Without this line the guard's failure mode had never been
      // observed, which makes it a claim rather than a check.
      // ⚠ AND THE CONSEQUENCE IS NOT COSMETIC: that throw aborts the decision transaction and alerts,
      // so an unfiltered door would alert on EVERY invoice-paid webhook for a placeholder client while
      // the referrer-visible status silently stopped being written.
      const { rows: decisionErrors } = await pool.query(
        "SELECT source FROM error_log WHERE source LIKE '%decision%'"
      );
      assert.deepEqual(
        decisionErrors, [],
        'a placeholder must be FILTERED OUT before the derivation, not discovered by its throw'
      );
    });

    it('an unpaid invoice is not credited, however the status reads', async () => {
      await seedWorld();
      // Status says paid, balance says otherwise — `isInvoicePaid` is the one definition and needs both.
      await captureFacts(relatedClient({ invoiceStatus: 'paid', balance: 2500 }));
      await seedIdentityRow(CLIENT, AFTER_START);
      const out = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(out.credited, false);
      assert.equal(out.reason, 'invoice_not_paid');
    });

    it('a category value sitting under an UNMAPPED configuration is NOT credited — the field is picked by id, never by label', async () => {
      // ⚠ THIS IS 7c-1's MONEY PROPERTY, AND IT IS THE ONE A LABEL SCAN CANNOT EXPRESS. On the live
      // tenant THREE configurations share the label "Job Type" — ALL_JOBS/730114 (19 options),
      // ALL_INVOICES/730115 (the same 19) and ALL_QUOTES/1573072 (a DIFFERENT seven). A resolver
      // matching by label can read quote vocabulary onto a job-reading schedule, which is a wrong
      // payout that looks like a right one.
      // ⚠ THE DECOY CARRIES THE SAME LABEL AND THE SAME VALUE, deliberately. If it differed in either,
      // the case would pass against a label matcher too and prove nothing about the id.
      const DECOY_FIELD = Buffer.from('gid://Jobber/CustomFieldConfigurationDropdown/1573072').toString('base64');
      await seedWorld();
      await captureFacts(relatedClient({ referred: true, category: 'Roof Replacement' }));
      await seedIdentityRow(CLIENT, AFTER_START);

      // Move the category fact onto the decoy configuration, leaving everything else identical.
      const moved = await pool.query(
        `UPDATE crm_custom_field_facts SET configuration_id = $3
          WHERE contractor_id = $1 AND entity = 'ALL_JOBS' AND configuration_id = $2`,
        [TENANT, WORK_CATEGORY_FIELD, DECOY_FIELD]
      );
      assert.equal(moved.rowCount, 1, 'precondition: the category fact moved onto the decoy');
      // ⚠ AND THE DECOY IS A REAL DISCOVERED FIELD WITH THE SAME LABEL, so nothing about this fixture
      // is distinguishable from the mapped one except the configuration id itself.
      await pool.query(
        `INSERT INTO contractor_jobber_fields
           (contractor_id, jobber_field_id, label, field_type, entity, transferable, archived)
         VALUES ($1, $2, 'Job Type', 'DROPDOWN', 'ALL_QUOTES', FALSE, FALSE)`,
        [TENANT, DECOY_FIELD]
      );

      const out = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(out.credited, false, 'an unmapped configuration must not decide a payout');
      assert.equal(out.reason, 'no_job_type_found');
      assert.deepEqual(await conversions(), []);
    });

    it('CURRENT STATE, AND IT IS A RULING RATHER THAN A BUG — a LEGACY label-string work_category mapping credits nothing', async () => {
      // ⚠ RECORDED AS A NAMED CASE SO IT READS AS KNOWN RATHER THAN AS THIS COMMIT DROPPING SOMETHING.
      // `resolveCategoryValue` returns `mapping_not_by_id` with a null value for the string form —
      // deliberately, per 7c-1, "rather than being paid on a guess", because three live configurations
      // share the label "Job Type". So `categoryValues` is `[]` and the engine reports
      // `no_job_type_found`. The RETIRED live path fell back to a label scan and paid.
      // ⚠ NO LIVE EFFECT: Accent is mapped by id, and Danny ruled 2026-10-01 that NO migration is
      // needed because every new contractor maps through the by-id picker. The cleanup commit removes
      // the legacy string handling once no admin path can still save it. Until then, a legacy mapping
      // correctly credits nothing — which is what this case pins.
      await seedWorld({ mapping: 'legacy' });
      await captureFacts(relatedClient());
      await seedIdentityRow(CLIENT, AFTER_START);

      const out = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(out.credited, false);
      assert.equal(out.reason, 'no_job_type_found', 'a legacy mapping resolves no category at all');
      assert.deepEqual(await conversions(), []);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3 — EXACTLY ONCE, AND EXACTLY ONE EMAIL
  // ═══════════════════════════════════════════════════════════════════════════
  describe('exactly once, and exactly one email', () => {
    it('a SECOND capture of the same client writes NO second conversion row', async () => {
      await seedWorld();
      await captureFacts(relatedClient());
      await seedIdentityRow(CLIENT, AFTER_START);

      const first = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });
      assert.equal(first.credited, true, 'precondition: the first credit landed');

      // The same capture again, exactly as a re-delivered webhook or a re-capture would.
      await captureFacts(relatedClient());
      const second = await creditReferralFromFacts(pool, { contractorId: TENANT, jobberClientId: CLIENT });

      assert.equal(second.credited, false, 'the second call credits nothing');
      assert.equal(second.inserted, false);
      // ⚠ THE REASON IS ASSERTED, AND THAT IS WHAT MAKES THIS CASE DISCRIMINATING RATHER THAN
      // DECORATIVE. "credited false and still one row" is ALSO what a writer whose INSERT threw
      // produces — the exception is swallowed, the outcome comes back `credit_failed`, and the row
      // count is unchanged because nothing was written. Only the reason separates "the duplicate was
      // recognised" from "the insert blew up and we got lucky".
      // ⚠ AND THE MEASUREMENT IS WORTH STATING EXACTLY, BECAUSE AN EARLIER WRITING OF THIS COMMENT
      // CLAIMED SOMETHING I HAD NOT MEASURED. A duplicate is refused by TWO independent mechanisms:
      // `evaluateReferral`'s STEP 8 returns `conversion_already_recorded` BEFORE the writer is reached,
      // and the writer's `ON CONFLICT DO NOTHING` behind `UNIQUE(user_id, jobber_client_id)` is the net
      // under it. Breaking EITHER ONE ALONE leaves this case green — and leaves the reason string
      // identical, because both paths produce the same words. It took a two-part injection (STEP 8
      // removed AND the ON CONFLICT dropped) to red it. That is defence in depth working, and it is
      // also why "this assertion is load-bearing" had to be demonstrated rather than asserted.
      assert.equal(
        second.reason, 'conversion_already_recorded',
        'the duplicate must be RECOGNISED, not merely survived'
      );
      assert.deepEqual(
        (await pool.query("SELECT 1 FROM error_log WHERE source = 'creditReferralFromFacts'")).rows, [],
        'and a recognised duplicate is not an error — nothing is logged and nobody is alerted'
      );
      const rows = await conversions();
      assert.equal(rows.length, 1, 'still exactly one conversion row');
      assert.equal(parseFloat(rows[0].bonus_amount), BONUS, 'and the amount was not rewritten');
    });

    it('a DUPLICATE delivery through the real door sends NO second email', async () => {
      await seedWorld();
      const related = relatedClient();

      const first = await fireInvoicePaid({ related, itemId: 'inv-c1-dup' });
      await waitFor(async () => (await conversions()).length > 0, { timeout: 6000 });
      await waitFor(() => first.length >= 1, { timeout: 6000 });
      const afterFirst = first.length;
      assert.ok(afterFirst >= 1, 'precondition: the first delivery notified');

      // Fire the identical delivery again.
      const second = await fireInvoicePaid({ related, itemId: 'inv-c1-dup' });
      await waitFor(async () => (await pool.query(
        'SELECT 1 FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2',
        [TENANT, CLIENT]
      )).rows.length > 0, { timeout: 6000 });
      // Give the second IIFE room to reach and pass the credit.
      await new Promise((r) => setTimeout(r, 1500));

      assert.equal((await conversions()).length, 1, 'no second conversion row');
      assert.deepEqual(
        second, [],
        'and NOT ONE email from the duplicate — the notify is gated on `inserted`, never on '
        + '`qualified`, and emailing on `qualified` is exactly how a referrer is told twice'
      );
    });

    it('the bonus email names the LEDGER amount, and the first credit also sends the milestone', async () => {
      await seedWorld();
      const emails = await fireInvoicePaid({ related: relatedClient() });
      await waitFor(() => emails.length >= 2, { timeout: 6000 });

      const subjects = emails.map((e) => e.subject);
      // ⚠ ANCHORED ON THE SURROUNDING PHRASE, NOT ON THE BARE NUMBER. `toContain('737')` would be
      // satisfied by `$7370` or `$1737`, which is the trap CLAUDE.md records for a wrapped value.
      assert.ok(
        subjects.some((s) => s.includes(`You just earned $${BONUS}.00`)),
        `the bonus email must name the ledger amount — got ${JSON.stringify(subjects)}`
      );
      assert.ok(
        subjects.some((s) => s.toLowerCase().includes('first reward')),
        'the first conversion also sends the milestone'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4 — THE CATCH-UP CREDITS FROM FACTS
  // ⚠ THIS IS THE HALF THAT MAKES C1 MORE THAN A WEBHOOK FIX. A client that becomes paid with no
  // webhook to carry it — the sync, a re-capture, a stage change — used to reach 'paid' on the
  // referrer's screen and never be credited.
  // ⚠ AND ITS NOTIFY SEAM IS THE MODULE'S OWN, not the router's: this job does not go through the
  // router at all, so overriding the router here would record nothing.
  // ═══════════════════════════════════════════════════════════════════════════
  describe('the catch-up job', () => {
    it('credits a referred client EXACTLY ONCE, with EXACTLY ONE bonus email, and reports it', async () => {
      await seedWorld();
      await captureFacts(relatedClient());
      // ⚠ `last_full_capture_at` SET AND `stage_derived_at` NULL is what the selector looks for.
      await seedIdentityRow(CLIENT, AFTER_START, { fullCapture: true });

      const emails = [];
      notifyModule._setTestOverrides({ sendEmail: async (a) => { emails.push(a); return { id: 'e' }; } });

      // Precondition: the client is actually selected. Without this the run below could be a no-op
      // and every assertion would hold.
      // ⚠ `selectStaleClients` RETURNS `{ candidates, remaining, skippedPartial }`, NOT A BARE ARRAY.
      // The first writing of this line called `.some` on the object and threw — worth the note only
      // because `skippedPartial` is the half that matters here: a client with no full-capture marker is
      // SKIPPED rather than selected, so asserting the candidate list alone would not distinguish
      // "selected" from "silently skipped as partial".
      const selected = await selectStaleClients(pool, { contractorId: TENANT });
      assert.ok(
        selected.candidates.some((c) => c.jobberClientId === CLIENT),
        'precondition: the catch-up selects this client'
      );
      assert.equal(selected.skippedPartial, 0, 'precondition: and does not skip it as partial');

      const summary = await runRedecideStaleClients(pool, { contractorId: TENANT });
      assert.equal(summary.credited, 1, 'the summary reports the credit');

      const rows = await conversions();
      assert.equal(rows.length, 1, 'exactly one conversion');
      assert.equal(parseFloat(rows[0].bonus_amount), BONUS);
      // ⚠ ANCHORED ON THE AMOUNT, NOT ON "You just earned" — AND MY OWN NEEDLE FELL INTO THE
      // SUBSTRING TRAP HERE FIRST. The milestone subject is "You just earned your first reward",
      // which CONTAINS "You just earned", so the loose needle counted 2 and read as a duplicate
      // bonus email. Exactly the shape CLAUDE.md records for a `toContain` on a bare value, in the
      // assertion written to prove a money path sends one email.
      const bonusEmails = emails.filter((e) => e.subject === `You just earned $${BONUS}.00`);
      const milestoneEmails = emails.filter((e) => String(e.subject).toLowerCase().includes('first reward'));
      assert.equal(bonusEmails.length, 1, 'exactly one BONUS email');
      assert.equal(milestoneEmails.length, 1, 'and exactly one first-milestone email');
      assert.equal(emails.length, 2, 'and nothing else was sent');

      // ── AND A SECOND RUN CREDITS NOTHING AND SENDS NOTHING ──
      emails.length = 0;
      const again = await runRedecideStaleClients(pool, { contractorId: TENANT });
      assert.equal(again.credited, 0, 'a second run credits nobody');
      assert.equal((await conversions()).length, 1, 'still one conversion');
      assert.deepEqual(emails, [], 'and sends no email at all');
    });

    it('does not credit a client whose facts show no referrer, and still re-decides it', async () => {
      await seedWorld();
      await captureFacts(relatedClient({ referred: false }));
      await seedIdentityRow(CLIENT, AFTER_START, { fullCapture: true });

      const summary = await runRedecideStaleClients(pool, { contractorId: TENANT });
      assert.equal(summary.redecided, 1, 'precondition: it did re-decide the client');
      assert.equal(summary.credited, 0);
      assert.deepEqual(await conversions(), []);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5 — PREVIEW AND REPLAY NEVER CREDIT AND NEVER NOTIFY
  //
  // ⚠ A SOURCE FENCE, AND ITS LIMIT IS STATED RATHER THAN IMPLIED: it proves these two files do not
  // NAME the credit, the notify or the referrer-visible status writer. It cannot prove a helper they
  // call does not reach one. The closure was checked by hand at this commit.
  // ⚠ IT EXISTS BECAUSE THE PREVIEW'S WHOLE PURPOSE IS TO BE SAFE TO RUN AGAINST REAL DATA. The
  // rebuild preview is gated shut until Danny has reviewed its output; a preview that credited a
  // referrer, or emailed one, would be an irreversible side effect of a dry run.
  // ═══════════════════════════════════════════════════════════════════════════
  describe('preview and replay never credit or notify', () => {
    const FORBIDDEN = ['creditReferralFromFacts', 'notifyReferralCredit', 'writeReferredStatus'];
    const FILES = ['assignmentPreview.js', 'attributionReplay.js'];

    // Comments are stripped line-preservingly, so a comment EXPLAINING that the preview must not
    // credit cannot satisfy — or trip — the fence. Blanks of equal length keep line numbers honest.
    function stripComments(src) {
      return src
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
    }

    for (const file of FILES) {
      it(`${file} names none of the credit, notify or referred-status writers`, () => {
        const full = path.join(__dirname, '..', 'utils', file);
        const raw = fs.readFileSync(full, 'utf8');
        // ⚠ A NON-VACUITY FLOOR. A fence over a file that has moved or been renamed would pass by
        // reading nothing at all, which is the shape that makes a green run meaningless.
        assert.ok(raw.length > 500, `harness: ${file} must exist and have content`);
        const src = stripComments(raw);
        for (const needle of FORBIDDEN) {
          assert.ok(
            !src.includes(needle),
            `${file} must not reference ${needle} — a dry run must have no money side effects`
          );
        }
      });
    }

    it('HARNESS — the needles DO match a file that legitimately calls them', () => {
      // ⚠ THE PAIRED POSITIVE, AND WITHOUT IT THE THREE NEEDLES COULD BE MISSPELLED AND THE FENCE
      // WOULD STILL BE GREEN. This is the "a check whose failure mode has never been observed is a
      // claim, not a check" rule applied to the fence's own strings.
      const src = stripComments(
        fs.readFileSync(path.join(__dirname, '..', 'jobs', 'redecideStaleClients.js'), 'utf8')
      );
      for (const needle of ['creditReferralFromFacts', 'notifyReferralCredit', 'writeReferredStatus']) {
        assert.ok(src.includes(needle), `harness: the catch-up really does call ${needle}`);
      }
    });
  });
});
