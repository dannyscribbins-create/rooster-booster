'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT VISIBILITY — THE CREDIT AND ITS REFUSALS ARE VISIBLE IN PRODUCTION LOGS
//
// Danny, 2026-10-02, after a live check could not see its own subject.
//
// ⚠ THE DEFECT, IN BOTH DIRECTIONS. `runRedecideStaleClients` has maintained a `credited` counter since
// C1 and `formatSummary()` prints a CREDITED row — but the cron does not call `formatSummary`; it builds
// its own line, and C1 added the counter without adding it there. So a credit made by the catch-up left
// **no log evidence at all**. And `creditReferralFromFacts` RETURNS a reason that no caller logged, so a
// client persistently refused was indistinguishable from a client nobody looked at.
// ⚠ THAT IS THE SILENT-GATE SHAPE ON THE MONEY PATH, IN THE OBSERVABILITY LAYER RATHER THAN THE LOGIC —
// and it is why the 2026-10-02 live check had to be answered from the database instead of the logs. A
// live check that cannot see its subject is weak evidence however green it looks.
//
// ⚠ ONE AGGREGATED LINE PER RUN, NEVER ONE PER CLIENT, AND THAT IS ASSERTED RATHER THAN INTENDED. The
// catch-up is bounded at 200 clients and the full sync iterates ~19,600; per-client logging would bury
// the summary it exists to surface. Two cases below count the lines rather than merely checking content.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb, captureResend } = require('./setup');
captureResend();

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { tallyCreditOutcome, formatCreditTally } = require('../utils/creditReasonTally');
const { runRedecideStaleClients } = require('../jobs/redecideStaleClients');
const { runRedecideStaleClientsCron } = require('../cron/jobs/redecideStaleClients');
const notifyModule = require('../utils/referralNotify');
const { JOBBER_CLIENT_GID_PREFIX } = require('../utils/derivableClient');

const {
  seedContractor, seedToken, seedEngagementSettings, seedReferralSchedule, seedUser,
} = require('./helpers');

const TENANT = 'cv-roofing';
const clientId = (n) => Buffer.from(`${JOBBER_CLIENT_GID_PREFIX}${n}`).toString('base64');
const CLIENT_OK = clientId(950001);
const CLIENT_NO_REFERRER = clientId(950002);
const WORK_CATEGORY_FIELD = Buffer.from('gid://Jobber/CustomFieldConfigurationDropdown/730114').toString('base64');
const REFERRER_FIELD = Buffer.from('gid://Jobber/CustomFieldConfigurationText/3655374').toString('base64');
const AFTER_START = '2026-03-01T00:00:00.000Z';
const BONUS = 611;

describe('credit visibility', () => {
  let pool;

  before(async () => { pool = await initTestDb(); });
  after(async () => { notifyModule._resetTestOverrides(); await pool.end(); });

  beforeEach(async () => {
    notifyModule._resetTestOverrides();
    for (const t of [
      'referral_conversions',
      'referral_schedule_job_types', 'referral_schedules',
      'category_mismatches',
      'crm_custom_field_facts', 'crm_invoice_job_links', 'crm_invoice_facts',
      'crm_job_facts', 'crm_quote_facts', 'crm_request_facts',
      'client_rep_assignments', 'flagged_assignments',
      'contact_tags', 'contacts',
      'pipeline_cache', 'jobber_clients',
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

  // ── 1 — THE TALLY ITSELF, AS A UNIT ───────────────────────────────────────
  describe('the tally', () => {
    it('counts a credited outcome under `credited` and a refusal under its reason', () => {
      const t = {};
      tallyCreditOutcome(t, { credited: true, reason: 'credited' });
      tallyCreditOutcome(t, { credited: false, reason: 'referrer_not_found' });
      tallyCreditOutcome(t, { credited: false, reason: 'referrer_not_found' });
      tallyCreditOutcome(t, { credited: false, reason: 'invoice_not_paid' });
      assert.deepEqual(t, { credited: 1, referrer_not_found: 2, invoice_not_paid: 1 });
    });

    it('a NULL outcome is NOT counted — the credit was never attempted', () => {
      // ⚠ COUNTING THESE WOULD INFLATE EVERY TALLY WITH CLIENTS THE ENGINE NEVER SAW. A non-referred
      // client, or one on a path that returned before the credit, is not a refusal — and a tally whose
      // biggest number is "clients we did not look at" tells a reader nothing.
      const t = {};
      tallyCreditOutcome(t, null);
      tallyCreditOutcome(t, undefined);
      assert.deepEqual(t, {});
      assert.equal(formatCreditTally(t), null, 'and an empty tally formats to nothing at all');
    });

    it('`credited` is forced FIRST, then refusals by descending count', () => {
      // ⚠ THE ONE NUMBER A READER IS LOOKING FOR MUST NOT MOVE between runs depending on how the
      // refusals happen to sort.
      const line = formatCreditTally({
        invoice_not_paid: 3, credited: 1, referrer_not_found: 7, no_job_type_found: 3,
      });
      assert.equal(line, 'credited 1, referrer_not_found 7, invoice_not_paid 3, no_job_type_found 3');
    });

    it('a ZERO credited count is stated explicitly when anything else happened', () => {
      // ⚠ LEAVING IT OUT MAKES ITS ABSENCE AMBIGUOUS between "nobody was credited" and "this line does
      // not report credits" — and the second reading is exactly what made the pre-fix cron line useless.
      assert.equal(formatCreditTally({ referrer_not_found: 2 }), 'credited 0, referrer_not_found 2');
    });
  });

  // ── 2 — THE CATCH-UP RUN AND ITS CRON LINE ────────────────────────────────
  describe('the catch-up run', () => {
    const captureShape = ({ id, referred = true }) => ({
      id, createdAt: AFTER_START, isCompany: false, isLead: false, tags: { nodes: [] },
      customFields: referred
        ? [{ label: 'Referred by', valueText: 'Jane Referrer', valueDropdown: null,
          customFieldConfiguration: { id: REFERRER_FIELD } }]
        : [],
      quotes: { nodes: [] }, requests: { nodes: [] },
      jobs: { nodes: [{
        id: `job-${id.slice(-6)}`, jobNumber: 1, jobStatus: 'active', jobType: 'ONE_OFF', title: 'Roof',
        createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
        startAt: null, endAt: null, completedAt: null,
        total: 10000, invoicedTotal: 10000, uninvoicedTotal: 0,
        client: { id }, quote: null, request: null, salesperson: null, invoices: { nodes: [] },
        customFields: [{ label: 'Job Type', valueDropdown: 'Roof Replacement', valueText: null,
          customFieldConfiguration: { id: WORK_CATEGORY_FIELD } }],
      }] },
      invoices: { nodes: [{
        id: `inv-${id.slice(-6)}`, client: { id }, invoiceNumber: 'INV', invoiceStatus: 'paid',
        waitingForFinancedPayment: false,
        amounts: { total: 10000, invoiceBalance: 0 },
        issuedDate: '2026-06-10T00:00:00.000Z', dueDate: null,
        receivedDate: '2026-06-11T00:00:00.000Z',
        createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-11T00:00:00.000Z',
        customFields: [],
        jobs: { nodes: [{ id: `job-${id.slice(-6)}` }], pageInfo: { hasNextPage: false } },
        archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
      }] },
    });

    async function seedWorld({ withReferrerAccount = true } = {}) {
      await seedContractor(pool, TENANT);
      await pool.query(
        `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id, referral_start_date)
         VALUES ($1, 'JACCT_CV', '2026-01-01'::date)
         ON CONFLICT (contractor_id) DO UPDATE SET referral_start_date = EXCLUDED.referral_start_date`,
        [TENANT]
      );
      await seedToken(pool, { contractorId: TENANT });
      await seedEngagementSettings(pool, { contractorId: TENANT, experienceFlowEnabled: false });
      if (withReferrerAccount) {
        await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@cv.test', contractorId: TENANT });
      }
      await seedReferralSchedule(pool, {
        contractorId: TENANT, jobberLabel: 'Roof Replacement', flatAmount: BONUS,
      });
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
    }

    // Facts written by the REAL capture, so the fact rows are the rows production would write.
    async function captureFor(id, opts = {}) {
      const { captureClientFacts } = require('../utils/factCapture');
      await captureClientFacts(pool, { contractorId: TENANT, client: captureShape({ id, ...opts }) });
      await pool.query(
        `INSERT INTO jobber_clients
           (contractor_id, jobber_client_id, first_name, last_name, jobber_created_at,
            last_full_capture_at, stage_derived_at)
         VALUES ($1, $2, 'Test', 'Client', $3::timestamptz, NOW(), NULL)
         ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE
           SET jobber_created_at = EXCLUDED.jobber_created_at,
               last_full_capture_at = EXCLUDED.last_full_capture_at`,
        [TENANT, id, AFTER_START]
      );
    }

    it('the run tallies a CREDITED client, and the summary carries both the count and the reasons', async () => {
      await seedWorld();
      await captureFor(CLIENT_OK);
      notifyModule._setTestOverrides({ sendEmail: async () => ({ id: 'e' }) });

      const summary = await runRedecideStaleClients(pool, { contractorId: TENANT });

      assert.equal(summary.credited, 1, 'precondition: a client really was credited');
      assert.equal(
        summary.creditReasons.credited, 1,
        'and the tally counts it — this is the half that did not exist before'
      );
      assert.equal((await pool.query('SELECT 1 FROM referral_conversions')).rows.length, 1);
    });

    it('the run tallies a REFUSAL by its reason', async () => {
      await seedWorld({ withReferrerAccount: false });
      await captureFor(CLIENT_OK);

      const summary = await runRedecideStaleClients(pool, { contractorId: TENANT });

      assert.equal(summary.credited, 0);
      assert.equal(
        summary.creditReasons.referrer_not_found, 1,
        'the REASON is what turns `credited 0` into a diagnosis'
      );
      assert.equal(summary.creditReasons.credited, undefined, 'and nothing is counted as credited');
    });

    it('a client with no referrer in its facts is NOT counted as a refusal', async () => {
      // ⚠ `not_referred` IS A REAL REASON AND IS COUNTED, but a client the credit never looked at is
      // not. This case pins which of the two this is: the credit DOES run for every selected client
      // (ruling 1 requires the create path), so a non-referred client returns `not_referred` and that
      // is honest to report.
      await seedWorld();
      await captureFor(CLIENT_NO_REFERRER, { referred: false });

      const summary = await runRedecideStaleClients(pool, { contractorId: TENANT });
      assert.equal(summary.credited, 0);
      assert.equal(summary.creditReasons.not_referred, 1);
    });

    it('syncSingleClient RETURNS its credit outcome — the contract the bulk loops tally from', async () => {
      // ⚠ THIS IS THE SYNC HALF, AND IT EXISTS BECAUSE A GUARD-PROOF MEASURED WIDTH 0 WITHOUT IT. The
      // suite drove only the catch-up, so removing a tally call from the sync broke nothing observable.
      // ⚠ IT TESTS THE CONTRACT RATHER THAN STANDING UP A BULK SYNC: the loops tally whatever
      // `syncSingleClient` returns, so what must hold is that it returns an outcome at all, and the
      // right one. Before this commit it returned `undefined` and there was nothing to aggregate.
      const { syncSingleClient } = require('../crm/pipelineSync');
      await seedWorld();

      const live = {
        id: CLIENT_OK,
        firstName: 'Test', lastName: 'Client', createdAt: AFTER_START,
        emails: [{ address: 'cv@example.com', isPrimary: true }],
        phones: [{ number: '5550001111', isPrimary: true }],
        customFields: [{
          label: 'Referred by', valueText: 'Jane Referrer', valueDropdown: null,
          customFieldConfiguration: { id: REFERRER_FIELD },
        }],
      };
      notifyModule._setTestOverrides({ sendEmail: async () => ({ id: 'e' }) });

      const out = await syncSingleClient(
        TENANT, live, new Date('2026-01-01T00:00:00.000Z'), [], 'tok',
        { captureClient: captureShape({ id: CLIENT_OK }) }
      );

      assert.ok(out, 'it must return something for a run to aggregate');
      assert.ok(out.creditOutcome, 'and the credit outcome specifically');
      assert.equal(out.creditOutcome.credited, true, 'this fixture credits');
      // The tally then turns that into a count — proven here on the real return value.
      const t = {};
      tallyCreditOutcome(t, out.creditOutcome);
      assert.deepEqual(t, { credited: 1 });
    });

    it('syncSingleClient returns a NULL outcome for a NON-referred client, which the tally ignores', async () => {
      // ⚠ THE PAIRED NEGATIVE. Without it the case above passes against a function that returns a
      // credited outcome for everything, and the tally would count every client in the book.
      const { syncSingleClient } = require('../crm/pipelineSync');
      await seedWorld();

      const out = await syncSingleClient(
        TENANT,
        { id: CLIENT_NO_REFERRER, firstName: 'No', lastName: 'Referrer', createdAt: AFTER_START, customFields: [] },
        new Date('2026-01-01T00:00:00.000Z'), [], 'tok'
      );

      assert.ok(out, 'it still returns a shape');
      assert.equal(out.creditOutcome, null, 'but the credit was never attempted');
      const t = {};
      tallyCreditOutcome(t, out.creditOutcome);
      assert.deepEqual(t, {}, 'so nothing is tallied — a client the credit never saw is not a refusal');
    });

    it('the CRON prints `credited` on its summary line, and ONE aggregated reasons line', async () => {
      // ⚠ THIS IS THE CASE DANNY NAMED. The guard-proof is that removing `credited` from the cron's
      // line reds it.
      await seedWorld();
      await captureFor(CLIENT_OK);
      notifyModule._setTestOverrides({ sendEmail: async () => ({ id: 'e' }) });

      const lines = [];
      const realLog = console.log;
      console.log = (...args) => { lines.push(args.join(' ')); };
      try {
        await runRedecideStaleClientsCron();
      } finally {
        console.log = realLog;
      }

      const summaryLines = lines.filter((l) => l.includes('[redecideStaleClients]') && l.includes('eligible '));
      assert.equal(summaryLines.length, 1, 'exactly one summary line');
      assert.match(
        summaryLines[0], /credited 1/,
        `the cron's summary line must report the credit — got: ${summaryLines[0]}`
      );

      const creditLines = lines.filter((l) => l.includes('credit outcomes'));
      assert.equal(
        creditLines.length, 1,
        'ONE aggregated reasons line, never one per client — got ' + JSON.stringify(creditLines)
      );
      assert.match(creditLines[0], /credited 1/);
    });

    it('the aggregated line is ONE line for MANY clients, and names no client id', async () => {
      // ⚠ THE SHAPE THAT MATTERS AT SCALE, AND IT IS COUNTED RATHER THAN ASSUMED. Three clients with
      // three different outcomes must still produce exactly one line.
      // ⚠ AND NO CLIENT ID APPEARS IN IT. These are data about real people, and the aggregate answers
      // the question — "14 hit referrer_not_found" is actionable, one id invites chasing one row.
      await seedWorld({ withReferrerAccount: false });
      await captureFor(CLIENT_OK);
      await captureFor(CLIENT_NO_REFERRER, { referred: false });
      const third = clientId(950003);
      await captureFor(third);

      const lines = [];
      const realLog = console.log;
      console.log = (...args) => { lines.push(args.join(' ')); };
      try {
        await runRedecideStaleClientsCron();
      } finally {
        console.log = realLog;
      }

      const creditLines = lines.filter((l) => l.includes('credit outcomes'));
      assert.equal(creditLines.length, 1, 'still exactly ONE line for three clients');
      for (const id of [CLIENT_OK, CLIENT_NO_REFERRER, third]) {
        assert.ok(!creditLines[0].includes(id), 'no client id appears in the aggregated line');
      }
      assert.match(creditLines[0], /referrer_not_found 2/, 'and the counts aggregate');
      assert.match(creditLines[0], /not_referred 1/);
    });
  });

  // ── 3 — THE SOURCE FENCE ──────────────────────────────────────────────────
  describe('the fence', () => {
    // Comments become blanks of equal length, so a comment EXPLAINING the aggregation cannot satisfy
    // the fence, and reported line numbers stay honest.
    function strip(src) {
      return src
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
    }

    it('the cron summary line names `credited`', () => {
      const src = strip(fs.readFileSync(
        path.join(__dirname, '..', 'cron', 'jobs', 'redecideStaleClients.js'), 'utf8'));
      // ⚠ A NON-VACUITY FLOOR: the line this fence reads must still exist.
      assert.match(src, /eligible \$\{summary\.considered\}/, 'harness: the summary line must exist');
      assert.match(
        src, /credited \$\{summary\.credited\}/,
        'the cron summary line must print the credited count — a counter nothing prints is not observability'
      );
    });

    it('both the sync and the catch-up tally, and NEITHER logs per client', () => {
      const files = {
        sync: path.join(__dirname, '..', 'crm', 'pipelineSync.js'),
        job: path.join(__dirname, '..', 'jobs', 'redecideStaleClients.js'),
        cron: path.join(__dirname, '..', 'cron', 'jobs', 'redecideStaleClients.js'),
      };
      const src = {};
      for (const [k, f] of Object.entries(files)) src[k] = strip(fs.readFileSync(f, 'utf8'));

      // ⚠ BOTH OF THE SYNC'S BULK LOOPS, COUNTED — AND A GUARD-PROOF IS WHY. `runFullSync` and
      // `runIncrementalSync` each iterate clients and each must tally; removing ONE of the two left an
      // `includes()` check green, so the injection measured width 0 against a real regression. A count
      // is what separates "the sync tallies somewhere" from "both runs tally".
      const syncTallies = (src.sync.match(/tallyCreditOutcome\(/g) || []).length;
      assert.equal(
        syncTallies, 2,
        'both bulk sync loops (runFullSync and runIncrementalSync) must tally — found ' + syncTallies
      );
      assert.ok(src.job.includes('tallyCreditOutcome('), 'the catch-up tallies');
      assert.ok(src.cron.includes('formatCreditTally('), 'the cron formats one line');

      // ⚠ THE PER-CLIENT CHECK IS POSITIONAL, AND THAT IS THE POINT: `formatCreditTally` must not be
      // called from inside a loop over clients. Checked by requiring every call to sit OUTSIDE any
      // `for (const client` / `for (const c of` block in the same file.
      for (const [k, s] of Object.entries(src)) {
        let from = 0;
        for (;;) {
          const at = s.indexOf('formatCreditTally(', from);
          if (at === -1) break;
          from = at + 1;
          const before = s.slice(0, at);
          const lastLoop = Math.max(
            before.lastIndexOf('for (const client of'),
            before.lastIndexOf('for (const c of candidates')
          );
          if (lastLoop === -1) continue;
          // Count braces between the loop header and this call: if they balance, the call is outside.
          const between = s.slice(lastLoop, at);
          const depth = (between.match(/\{/g) || []).length - (between.match(/\}/g) || []).length;
          assert.ok(
            depth <= 0,
            `${k}: formatCreditTally is called INSIDE a per-client loop — the aggregated line must be `
            + 'one per RUN, not one per client'
          );
        }
      }
    });
  });
});
