'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// RULING 3 — THE IDENTITY ROW IS CREATED BEFORE THE CAPTURE
//
// Danny, 2026-10-02, after C1's live check measured the consequence in production.
//
// ⚠ THE DEFECT. `captureClientFacts` writes `jobber_created_at` and the full-capture marker with
// `UPDATE jobber_clients …`, and the identity upsert that CREATES that row ran AFTER both the capture
// and the decision. On a client's FIRST SIGHTING both writes therefore affected **0 rows**:
//   · the creation date stayed NULL even for a client that had just been credited — C1 had to work
//     around that by supplying the date from the live object;
//   · `last_full_capture_at` stayed NULL, so the catch-up could not see the client until its NEXT
//     full capture.
// ⚠ `factCapture.js` RECORDS THAT ORDERING FOR THE MARKER AND CALLS THE RESULT "the conservative
// direction". That is true of the marker and was NOT true of the creation date, which is why C1 needed
// a second mechanism for the same fact.
//
// ⚠ THE FIX IS A PRE-INSERT, NOT A MOVE, AND THE REASON IS STRUCTURAL: the real upsert writes
// `pipeline_stage` and `stage_derived_at` from the DECIDED stage, so it cannot run before the decision.
// Moving it would split one statement into two writers of one row.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb, captureResend } = require('./setup');
captureResend();

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;
const { selectStaleClients } = require('../jobs/redecideStaleClients');
const { JOBBER_CLIENT_GID_PREFIX } = require('../utils/derivableClient');

const {
  seedContractor, seedToken, seedEngagementSettings, signJobberWebhook, httpPost,
  buildTestApp, startTestServer, stopTestServer, waitFor,
} = require('./helpers');

const TENANT = 'ro-roofing';
const ACCOUNT = 'JACCT_RO';
const clientId = (n) => Buffer.from(`${JOBBER_CLIENT_GID_PREFIX}${n}`).toString('base64');
const CLIENT = clientId(960001);
const INVOICE = 'inv-node-ro';
const JOB = 'job-node-ro';
const CLIENT_CREATED_AT = '2026-03-01T00:00:00.000Z';

describe('ruling 3 — the identity row exists before the capture', () => {
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
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id)
       VALUES ($1, $2) ON CONFLICT (contractor_id) DO UPDATE SET jobber_account_id = EXCLUDED.jobber_account_id`,
      [TENANT, ACCOUNT]
    );
    await seedToken(pool, { contractorId: TENANT });
    await seedEngagementSettings(pool, { contractorId: TENANT, experienceFlowEnabled: false });
  });

  // ⚠ `certifyFullyPaged` IS CALLED ON THE FIXTURE, NOT FAKED. The full-capture marker is stamped from a
  // SYMBOL that `JSON.parse` cannot produce and a spread DROPS, so a literal property would prove
  // nothing — the mechanism fails closed by design and the fixture has to go through the real certifier.
  // ⚠ REQUIRED FROM `captureCompleteness`, WHICH IS WHERE IT LIVES — and the first writing of this
  // fixture required it from `jobberClientFetch` (which merely imports it) behind a
  // `typeof === 'function' ? … : shape` fallback. The export was `undefined`, the fallback returned an
  // UNCERTIFIED shape, and the marker was never stamped: the case failed for a harness reason that
  // looked exactly like the production defect. **A fallback that hides a missing export is the silent
  // shape this repo keeps recording** — so it asserts now instead of degrading.
  const { certifyFullyPaged } = require('../utils/captureCompleteness');

  function captureShape({ id = CLIENT, createdAt = CLIENT_CREATED_AT } = {}) {
    assert.equal(typeof certifyFullyPaged, 'function', 'harness: certifyFullyPaged must be importable');
    const shape = {
      id,
      createdAt,
      isCompany: false, isLead: false, isArchived: false,
      tags: { nodes: [] },
      customFields: [],
      quotes: { nodes: [] },
      requests: { nodes: [] },
      jobs: {
        nodes: [{
          id: JOB, jobNumber: 1, jobStatus: 'active', jobType: 'ONE_OFF', title: 'Roof',
          createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z',
          startAt: null, endAt: null, completedAt: null,
          total: 10000, invoicedTotal: 10000, uninvoicedTotal: 0,
          client: { id }, quote: null, request: null, salesperson: null,
          invoices: { nodes: [] }, customFields: [],
        }],
      },
      invoices: {
        nodes: [{
          id: INVOICE, client: { id }, invoiceNumber: 'INV-RO', invoiceStatus: 'paid',
          waitingForFinancedPayment: false,
          amounts: { total: 10000, invoiceBalance: 0 },
          issuedDate: '2026-06-10T00:00:00.000Z', dueDate: null,
          receivedDate: '2026-06-11T00:00:00.000Z',
          createdAt: '2026-06-10T00:00:00.000Z', updatedAt: '2026-06-11T00:00:00.000Z',
          customFields: [],
          jobs: { nodes: [{ id: JOB }], pageInfo: { hasNextPage: false } },
          archivedJobs: { nodes: [], pageInfo: { hasNextPage: false } },
        }],
      },
    };
    return certifyFullyPaged(shape);
  }

  function post(pathname, payloadObject) {
    const withAccountId = {
      ...payloadObject,
      data: {
        ...payloadObject.data,
        webHookEvent: { ...payloadObject.data?.webHookEvent, accountId: ACCOUNT },
      },
    };
    const { body, signature } = signJobberWebhook(withAccountId);
    return httpPost(port, pathname, body, { 'x-jobber-hmac-sha256': signature });
  }

  // Drives the client-create door, which is the plainest first-sighting path.
  async function fireClientCreate({ createdAt = CLIENT_CREATED_AT } = {}) {
    const related = captureShape({ createdAt });
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchFullClient: async () => ({
        id: CLIENT, createdAt,
        firstName: 'Brand', lastName: 'New',
        emails: [{ address: 'brandnew@example.com', isPrimary: true }],
        phones: [{ number: '5550002222', isPrimary: true }],
        customFields: [], quotes: { nodes: [] }, jobs: { nodes: [] },
      }),
      fetchClientRelatedData: async () => related,
      sendEmail: async () => ({ id: 'e' }),
    });
    const resp = await post('/webhooks/jobber/client-create', {
      data: { webHookEvent: { topic: 'CLIENT_CREATE', itemId: CLIENT } },
    });
    assert.equal(resp.status, 200, 'the door must ack 200');
    await waitFor(async () => (await pool.query(
      'SELECT 1 FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2',
      [TENANT, CLIENT]
    )).rows.length > 0, { timeout: 8000 });
    // The identity upsert is the last thing the door does; give it room to settle.
    await new Promise((r) => setTimeout(r, 800));
  }

  const row = async () => (await pool.query(
    `SELECT first_name, last_name, email, jobber_created_at, last_full_capture_at, stage_derived_at,
            pipeline_stage
       FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [TENANT, CLIENT]
  )).rows[0];

  // ═══════════════════════════════════════════════════════════════════════════
  it('a BRAND-NEW client gets its creation date on its FIRST capture', async () => {
    // ⚠ THE WHOLE POINT OF THE RULING, AND THE ASSERTION C1'S OWN CASE HAD TO BE RE-POINTED AGAINST.
    // Before this commit the capture's `UPDATE` affected 0 rows on a first sighting and this column was
    // NULL even for a client that had just been credited.
    const { rows: before } = await pool.query(
      'SELECT 1 FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2', [TENANT, CLIENT]);
    assert.deepEqual(before, [], 'precondition: this client has never been seen');

    await fireClientCreate();

    const r = await row();
    assert.ok(r, 'the identity row exists');
    assert.ok(
      r.jobber_created_at,
      'the creation date is stored on the FIRST capture — this is what the pre-insert buys'
    );
    assert.equal(
      new Date(r.jobber_created_at).toISOString(), CLIENT_CREATED_AT,
      "and it is the CLIENT's own Jobber date, not our insert time"
    );
  });

  it('and its FULL-CAPTURE MARKER on that same first capture', async () => {
    // ⚠ THE SECOND HALF OF THE SAME ORDERING DEFECT. `factCapture.js` called the old behaviour "the
    // conservative direction" — the client was simply not eligible for the catch-up until its next full
    // capture. That is now one cycle earlier, which is the effect this suite measures below.
    await fireClientCreate();
    const r = await row();
    assert.ok(r.last_full_capture_at, 'the marker is stamped on the first capture');
  });

  it('the pre-insert carries the SAME identity expressions as the real upsert — asserted from source', async () => {
    // ⚠ THIS CASE WAS BEHAVIOURAL AND VACUOUS, AND A GUARD-PROOF MEASURED IT AT WIDTH 0. It drove the
    // door and then asserted the row's name, email and phone — but the REAL upsert runs immediately
    // after the pre-insert and fills all three, so replacing every identity parameter in the pre-insert
    // with `null` left it GREEN. It was observing the final state, which the real upsert determines,
    // while claiming to test the pre-insert.
    // ⚠ AND THE WINDOW IT WOULD HAVE TO OBSERVE IS NOT REACHABLE FROM A TEST: the only moment a bare row
    // is visible is between the pre-insert and the real upsert, milliseconds apart inside one handler.
    // ⚠ SO THE PROPERTY IS PINNED FROM SOURCE INSTEAD, which is where it is actually decidable: the
    // pre-insert must bind the same identity expressions the real upsert binds. If someone writes `null`
    // there, this fires — and that is the defect the behavioural case was reaching for.
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
    const fnAt = src.indexOf('async function upsertAndTagClient');
    const preAt = src.indexOf('ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING', fnAt);
    assert.ok(preAt > 0, 'harness: the pre-insert must exist');
    // Its parameter array is the next `[` … `]` after the statement.
    const openAt = src.indexOf('[', preAt);
    const closeAt = src.indexOf(']', openAt);
    assert.ok(openAt > 0 && closeAt > openAt, 'harness: the pre-insert must bind parameters');
    const params = src.slice(openAt, closeAt);

    for (const expr of [
      'fullClient.firstName',
      'fullClient.lastName',
      'email',
      'phone',
      'isCompany',
      'isLead',
      'isArchived',
    ]) {
      assert.ok(
        params.includes(expr),
        `the pre-insert must bind ${expr} — a brand-new row created without it would be visible to the `
        + 'contact matcher with a NULL there, and would persist if the real upsert then failed'
      );
    }

    // And the behavioural half that IS observable: the row ends up correct.
    await fireClientCreate();
    const r = await row();
    assert.equal(r.first_name, 'Brand');
    assert.equal(r.last_name, 'New');
    assert.equal(r.email, 'brandnew@example.com');
  });

  it('an EXISTING row is untouched by the pre-insert — `ON CONFLICT DO NOTHING`, proven by a sentinel', async () => {
    // ⚠ THE BLAST-RADIUS CASE. Every client the system has already seen must be completely unaffected,
    // and the way to show it is a value the pre-insert would overwrite if it were an upsert.
    await pool.query(
      `INSERT INTO jobber_clients
         (contractor_id, jobber_client_id, first_name, last_name, email, jobber_created_at)
       VALUES ($1, $2, 'Sentinel', 'Existing', 'sentinel@example.com', $3::timestamptz)`,
      [TENANT, CLIENT, '2025-01-01T00:00:00.000Z']
    );

    await fireClientCreate();

    const r = await row();
    // The REAL upsert still refreshes identity, exactly as before — that is unchanged behaviour.
    assert.equal(r.first_name, 'Brand', 'the real upsert still refreshes identity');
    // ⚠ BUT THE CREATION DATE IS THE ONE THE PRE-INSERT MUST NOT HAVE TOUCHED. It was seeded at 2025 and
    // the capture overwrites it with COALESCE from the live client, so what this pins is that the
    // pre-insert did not CREATE a second row or clobber the column with a NULL.
    assert.ok(r.jobber_created_at, 'and the creation date is present, not nulled by a second insert');
    const { rows: count } = await pool.query(
      'SELECT count(*)::int AS n FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2',
      [TENANT, CLIENT]);
    assert.equal(count[0].n, 1, 'exactly one row — the pre-insert did not duplicate');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // THE CATCH-UP ELIGIBILITY EFFECT — MEASURED, NOT ASSERTED
  //
  // ⚠ THIS IS THE HALF DANNY ASKED TO HAVE MEASURED, AND THE ANSWER IS NARROWER THAN IT LOOKS. The
  // selector needs `last_full_capture_at IS NOT NULL` AND one of: `stage_derived_at IS NULL`, the marker
  // being NEWER than the decision, or the referrer-visible half. On this door the capture (which stamps
  // the marker) runs BEFORE the identity upsert (which stamps the decision), so after the reorder a
  // brand-new client whose decision SUCCEEDED has marker < decision and is NOT selected. Only a client
  // whose decision FAILED becomes newly eligible — which is exactly the recoverable state the catch-up
  // exists for.
  // ═══════════════════════════════════════════════════════════════════════════
  describe('the catch-up eligibility effect', () => {
    it('a brand-new client whose decision SUCCEEDED is NOT newly eligible — no flood', async () => {
      await fireClientCreate();
      const r = await row();
      assert.ok(r.last_full_capture_at, 'precondition: the marker is now set on a first sighting');
      assert.ok(r.stage_derived_at, 'precondition: and the decision succeeded, so it is stamped too');
      assert.ok(
        new Date(r.last_full_capture_at) <= new Date(r.stage_derived_at),
        'the capture precedes the decision, so the marker is not NEWER than it'
      );

      const selected = await selectStaleClients(pool, { contractorId: TENANT });
      assert.ok(
        !selected.candidates.some((c) => c.jobberClientId === CLIENT),
        'so the catch-up does NOT select it — the reorder adds no load for the ordinary case'
      );
    });

    it('MEASURED — the ONLY state the reorder newly makes eligible is marker-set-with-no-decision', async () => {
      // ⚠ THE FIRST WRITING OF THIS CASE TRIED TO DRIVE A FAILED DECISION THROUGH THE DOOR AND COULD
      // NOT, AND WHAT IT FOUND INSTEAD IS THE ENTRY WORTH KEEPING. It asserted `stage_derived_at` would
      // be NULL on `client-create`, on the strength of a checklist note saying those doors "stamp
      // last_full_capture_at and leave stage_derived_at alone". ⚠ MEASURED: that note is INVERTED for a
      // first sighting. `decideFromFacts` runs in transaction 2 regardless of
      // `alsoDeriveReferredStatus`, and the identity upsert's own INSERT stamps
      // `stage_derived_at` from its CASE — so on `client-create` the DECISION marker IS set
      // (observed: 2026-10-02T15:30:48Z) while, before this commit, `last_full_capture_at` was the one
      // left NULL. Exactly the opposite of the note, in both columns.
      //
      // ⚠ SO THE ELIGIBILITY EFFECT IS NARROWER THAN THE RULING FEARED, AND THIS IS THE ARITHMETIC:
      //   · BEFORE, any first sighting — marker NULL, so the first selector condition cannot be reached
      //     at all. NEVER selected until a later capture.
      //   · AFTER, decision recorded — marker set, decision set and NEWER (the capture commits in
      //     transaction 1, the stage is stamped by the upsert afterwards). NOT selected.
      //   · AFTER, decision ABSENT — marker set, `stage_derived_at IS NULL`. SELECTED.
      // So the newly-eligible population is exactly "a first sighting whose decision did not record",
      // which is the recoverable state the catch-up exists for. The ordinary case adds no load, and the
      // case above proves that end to end.
      //
      // ⚠ THIS CASE MEASURES THE SELECTOR PROPERTY DIRECTLY RATHER THAN FORCING A DECISION FAILURE
      // THROUGH THE DOOR, AND THE LIMIT IS STATED RATHER THAN HIDDEN. Transaction 2 only READS for this
      // door, so there is no write to fail with a trigger, and renaming a column mid-test to provoke a
      // read error would be schema surgery for a state the selector can be handed directly. What makes
      // the composition sound is that BOTH halves are measured: the marker now lands on a first sighting
      // (the case above), and the selector picks up marker-with-no-decision (here).
      await pool.query(
        `INSERT INTO jobber_clients
           (contractor_id, jobber_client_id, first_name, last_name,
            jobber_created_at, last_full_capture_at, stage_derived_at)
         VALUES ($1, $2, 'Brand', 'New', $3::timestamptz, NOW(), NULL)`,
        [TENANT, CLIENT, CLIENT_CREATED_AT]
      );

      const selected = await selectStaleClients(pool, { contractorId: TENANT });
      assert.ok(
        selected.candidates.some((c) => c.jobberClientId === CLIENT),
        'marker set and no decision recorded IS selected — this is the state the reorder newly reaches'
      );

      // ── AND THE PAIRED NEGATIVE: THE SAME ROW WITHOUT THE MARKER IS NOT SELECTED ──
      // ⚠ WITHOUT THIS, THE CASE ABOVE PASSES AGAINST A SELECTOR THAT SELECTS EVERYTHING, and the whole
      // claim is that the MARKER is what changed. This is the pre-reorder state of a first sighting.
      await pool.query(
        `UPDATE jobber_clients SET last_full_capture_at = NULL
          WHERE contractor_id = $1 AND jobber_client_id = $2`,
        [TENANT, CLIENT]
      );
      const without = await selectStaleClients(pool, { contractorId: TENANT });
      assert.ok(
        !without.candidates.some((c) => c.jobberClientId === CLIENT),
        'and with NO marker it is NOT selected — which is exactly what a first sighting looked like '
        + 'before the reorder, and why such a client was never retried'
      );
      assert.ok(
        without.skippedPartial >= 1,
        'it is COUNTED as skipped-partial rather than silently dropped — the job reports what it cannot reach'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  it('FENCE — the pre-insert is ON CONFLICT DO NOTHING and runs BEFORE the capture', () => {
    // ⚠ A POSITION CHECK, because the whole ruling is about ordering. The pre-insert must appear BEFORE
    // the first `withClientLock` in the function, and the real upsert AFTER it — otherwise the fix is
    // written and inert.
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));

    const fnAt = src.indexOf('async function upsertAndTagClient');
    assert.ok(fnAt > 0, 'harness: upsertAndTagClient must exist');
    const preAt = src.indexOf('ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING', fnAt);
    const lockAt = src.indexOf('withClientLock(', fnAt);
    const upsertAt = src.indexOf('ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE', fnAt);

    assert.ok(preAt > 0, 'the identity pre-insert must exist, with DO NOTHING');
    assert.ok(lockAt > 0, 'harness: the capture lock must exist');
    assert.ok(upsertAt > 0, 'harness: the real upsert must exist');
    assert.ok(preAt < lockAt, 'the pre-insert must run BEFORE the capture lock — otherwise it is inert');
    assert.ok(lockAt < upsertAt, 'and the real upsert still runs after, unchanged');
  });

  it('HARNESS — the fence\'s ORDER comparison is falsifiable, proven in both directions', () => {
    // ⚠ THIS EXISTS BECAUSE A GUARD-PROOF COULD NOT REACH THE ORDER ASSERTION, AND SAYING SO IS BETTER
    // THAN LEAVING IT UNPROVEN. The injection written for it added a SQL comment inside the statement
    // rather than MOVING the block, so it reintroduced no defect and reported width 0 — my mistake, not
    // a fence failure. Genuinely moving the pre-insert below the capture is a multi-line relocation,
    // which is not expressible as the kind of one-line injection the harness applies.
    // ⚠ SO THE DISCRIMINATOR IS EXERCISED ON SYNTHETIC INPUT INSTEAD. A fence whose comparison has never
    // been observed failing is a claim, not a check — and this is the half that could not otherwise be
    // observed at all.
    const order = (src) => {
      const fnAt = src.indexOf('async function upsertAndTagClient');
      return {
        pre: src.indexOf('ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING', fnAt),
        lock: src.indexOf('withClientLock(', fnAt),
      };
    };

    const correct = [
      'async function upsertAndTagClient() {',
      '  INSERT ... ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING',
      '  await withClientLock(pool, {}, async (tx) => {});',
      '}',
    ].join('\n');
    const o1 = order(correct);
    assert.ok(o1.pre > 0 && o1.lock > 0, 'harness: both markers found in the correct shape');
    assert.ok(o1.pre < o1.lock, 'the correct order passes');

    const inverted = [
      'async function upsertAndTagClient() {',
      '  await withClientLock(pool, {}, async (tx) => {});',
      '  INSERT ... ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING',
      '}',
    ].join('\n');
    const o2 = order(inverted);
    assert.ok(o2.pre > 0 && o2.lock > 0, 'harness: both markers found in the inverted shape');
    assert.ok(
      !(o2.pre < o2.lock),
      'and a pre-insert placed AFTER the capture lock FAILS the comparison — which is what makes the '
      + 'production assertion above mean something'
    );
  });
});
