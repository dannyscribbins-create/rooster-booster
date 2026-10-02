'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C2 — THE SYNC CREDITS, AND NOTHING OUTBOUND HAPPENS WHILE THE CONNECTION IS HELD
//
// Danny's instruction: the partition between "holds the lock's connection" and "sends email / calls
// Jobber" is the SINGLE SUBJECT OF REVIEW for this commit, proven by a fence and by a behavioural
// test. This file is both.
//
// ⚠ WHY THE PARTITION IS THE SUBJECT RATHER THAN THE CREDIT. `withClientLock` checks a connection
// out of the pool and holds it across BEGIN..COMMIT. An outbound HTTP call inside that extent does
// not delay one client — it holds a pooled connection for the duration of a network round trip, so a
// slow Resend or a slow Jobber exhausts the pool and stalls every other request. Commit 6b fixed
// exactly this defect INSIDE `withClientLock` itself: its rollback path awaited `logError`, which can
// send a Resend alert with two retries, and it was safe ONLY because that one call passed
// `alert: false`. **Pool safety resting on a flag is not pool safety.** C2 moves the sync's credit
// inside the lock, which is the first time this door has had anything money-shaped in there, so the
// partition is pinned rather than described.
//
// ⚠ AND THE TWO HALVES PROVE DIFFERENT THINGS, WHICH IS WHY BOTH ARE HERE. The fence reads SOURCE and
// answers "is an outbound call WRITTEN inside a locked extent" — it cannot follow a helper. The
// behavioural test answers "did an outbound call FIRE while a connection was held" — it cannot see a
// path its fixture does not drive. Neither alone is the property.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb, captureResend } = require('./setup');
captureResend();

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── THE LOCK-DEPTH PROBE, INSTALLED BEFORE pipelineSync IS REQUIRED ──────────
//
// ⚠ THE ORDER OF THESE TWO REQUIRES IS LOAD-BEARING AND IS THE WHOLE TRICK. `pipelineSync`
// destructures `withClientLock` at module load, which captures the function REFERENCE — so replacing
// the export after that import has happened would change nothing. Patching the module's export FIRST
// means the sync captures this wrapper instead.
// ⚠ AND IT KEEPS PRODUCTION UNTOUCHED. The alternative was adding an observability hook to
// `clientLock.js` for the test's benefit; this needs no production change at all, so the thing under
// test is the shipped code rather than a testability variant of it.
const clientLockModule = require('../utils/clientLock');
const realWithClientLock = clientLockModule.withClientLock;

let lockDepth = 0;
let maxLockDepth = 0;
clientLockModule.withClientLock = async function trackedWithClientLock(...args) {
  lockDepth += 1;
  if (lockDepth > maxLockDepth) maxLockDepth = lockDepth;
  try {
    return await realWithClientLock.apply(this, args);
  } finally {
    lockDepth -= 1;
  }
};

// Required AFTER the patch, so its destructured reference is the tracked wrapper.
const pipelineSync = require('../crm/pipelineSync');
const {
  syncSingleClient,
  _setPipelineSyncFetchForTest, _resetPipelineSyncFetch,
  _setPipelineSyncEmailsForTest, _resetPipelineSyncEmails,
  _setPipelineSyncHttpForTest, _resetPipelineSyncHttp,
} = pipelineSync;

const notifyModule = require('../utils/referralNotify');
const { JOBBER_CLIENT_GID_PREFIX } = require('../utils/derivableClient');

const {
  seedContractor, seedToken, seedEngagementSettings, seedReferralSchedule, seedUser,
} = require('./helpers');

const TENANT = 'c2-roofing';
const CLIENT = Buffer.from(`${JOBBER_CLIENT_GID_PREFIX}940001`).toString('base64');
const INVOICE = 'inv-node-c2';
const JOB = 'job-node-c2';
const WORK_CATEGORY_FIELD = Buffer.from('gid://Jobber/CustomFieldConfigurationDropdown/730114').toString('base64');
const REFERRER_FIELD = Buffer.from('gid://Jobber/CustomFieldConfigurationText/3655374').toString('base64');

const START_DATE = new Date('2026-01-01T00:00:00.000Z');
const CLIENT_CREATED_AT = '2026-03-01T00:00:00.000Z';
// ⚠ AN ODD AMOUNT. A round 250 is what a default or a speculative ladder would also produce, so an
// assertion on it could not tell the ledger from a coincidence.
const BONUS = 823;

describe('C2 — the sync credits, and the lock holds no outbound call', () => {
  let pool;

  before(async () => { pool = await initTestDb(); });
  after(async () => {
    _resetPipelineSyncFetch();
    _resetPipelineSyncEmails();
    _resetPipelineSyncHttp();
    notifyModule._resetTestOverrides();
    // ⚠ RESTORED, so a suite running after this one gets the real lock rather than this probe.
    clientLockModule.withClientLock = realWithClientLock;
    await pool.end();
  });

  beforeEach(async () => {
    lockDepth = 0;
    maxLockDepth = 0;
    _resetPipelineSyncFetch();
    _resetPipelineSyncEmails();
    _resetPipelineSyncHttp();
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

  // ── FIXTURES ──────────────────────────────────────────────────────────────
  // ⚠ EVERY NODE CARRIES `client { id }` AND EVERY CUSTOM FIELD CARRIES
  // `customFieldConfiguration { id }`. Each fact writer filters out a node missing either and returns
  // a count as though it had worked, so a fixture short of one writes nothing and reports success.
  const captureShape = () => ({
    id: CLIENT,
    createdAt: CLIENT_CREATED_AT,
    isCompany: false, isLead: false,
    tags: { nodes: [] },
    customFields: [{
      label: 'Referred by', valueText: 'Jane Referrer', valueDropdown: null,
      customFieldConfiguration: { id: REFERRER_FIELD },
    }],
    quotes: { nodes: [] },
    requests: { nodes: [] },
    jobs: {
      nodes: [{
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
      }],
    },
    invoices: {
      nodes: [{
        id: INVOICE, client: { id: CLIENT }, invoiceNumber: 'INV-C2', invoiceStatus: 'paid',
        // ⚠ EXPLICITLY false — the 7d gate blocks on TRUE *or* NULL.
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
  });

  // The LIVE client the sync is handed. `getReferredByValue` reads `customFields` off THIS object, so
  // the referrer field must carry the configuration id here too — the resolver matches by id.
  const liveClient = () => ({
    id: CLIENT,
    firstName: 'Test', lastName: 'Client',
    createdAt: CLIENT_CREATED_AT,
    emails: [{ address: 'c2client@example.com', isPrimary: true }],
    phones: [{ number: '5550008888', isPrimary: true }],
    customFields: [{
      label: 'Referred by', valueText: 'Jane Referrer', valueDropdown: null,
      customFieldConfiguration: { id: REFERRER_FIELD },
    }],
  });

  async function seedWorld() {
    await seedContractor(pool, TENANT);
    await pool.query(
      `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id, referral_start_date)
       VALUES ($1, 'JACCT_C2', $2::date)
       ON CONFLICT (contractor_id) DO UPDATE
         SET referral_start_date = EXCLUDED.referral_start_date`,
      [TENANT, START_DATE.toISOString().slice(0, 10)]
    );
    await seedToken(pool, { contractorId: TENANT });
    await seedEngagementSettings(pool, { contractorId: TENANT, experienceFlowEnabled: false });
    await seedUser(pool, { fullName: 'Jane Referrer', email: 'jane@c2.test', contractorId: TENANT });
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

  // Records the lock depth at the moment each outbound call fires.
  function armOutboundRecorder() {
    const seen = [];
    const record = (what) => { seen.push({ what, depth: lockDepth }); };

    _setPipelineSyncFetchForTest(async () => { record('jobber-fetch'); return captureShape(); });
    _setPipelineSyncHttpForTest({
      axiosPost: async () => { record('axios-post'); return { data: { data: {} } }; },
      sleep: async () => {},
    });
    _setPipelineSyncEmailsForTest({
      email: async () => { record('sync-email'); return { id: 'e' }; },
      adminNotification: async () => { record('admin-notification'); return { id: 'a' }; },
    });
    notifyModule._setTestOverrides({
      sendEmail: async (a) => { record(`bonus-email:${a.subject}`); return { id: 'b' }; },
    });
    return seen;
  }

  const conversions = async () =>
    (await pool.query('SELECT * FROM referral_conversions ORDER BY id')).rows;

  // ═══════════════════════════════════════════════════════════════════════════
  // 1 — THE BEHAVIOURAL HALF
  // ═══════════════════════════════════════════════════════════════════════════

  it('the sync CREDITS a referred, paid client — instantly, without waiting for the catch-up', async () => {
    await seedWorld();
    const seen = armOutboundRecorder();

    await syncSingleClient(TENANT, liveClient(), START_DATE, [], 'tok', {
      captureClient: captureShape(),
    });

    const rows = await conversions();
    assert.equal(rows.length, 1, 'the sync wrote exactly one conversion');
    assert.equal(rows[0].jobber_client_id, CLIENT);
    assert.equal(parseFloat(rows[0].bonus_amount), BONUS, 'the schedule amount, from the ledger');
    assert.equal(rows[0].contractor_id, TENANT, 'a conversion is tenant-scoped');

    // And the referrer was told, once.
    const bonusEmails = seen.filter((s) => s.what.startsWith('bonus-email:'));
    assert.ok(
      bonusEmails.some((s) => s.what.includes(`You just earned $${BONUS}.00`)),
      `the bonus email must name the ledger amount — got ${JSON.stringify(bonusEmails.map((s) => s.what))}`
    );
  });

  it('NO outbound call fires while a pooled connection is held — the partition, measured', async () => {
    await seedWorld();
    const seen = armOutboundRecorder();

    await syncSingleClient(TENANT, liveClient(), START_DATE, [], 'tok', {
      captureClient: captureShape(),
    });

    // ⚠ TWO PRECONDITIONS FIRST, BECAUSE WITHOUT THEM THIS CASE IS SATISFIED BY A RUN THAT DID
    // NOTHING. "Every outbound call saw depth 0" is trivially true of a run that made no outbound
    // call, and equally true of a run that never took a lock.
    assert.ok(seen.length > 0, 'precondition: the sync really did make outbound calls');
    assert.ok(
      maxLockDepth >= 1,
      'precondition: the sync really did take a per-client lock — otherwise "nothing outbound while '
      + 'held" is a statement about a run with no lock in it'
    );
    assert.equal((await conversions()).length, 1, 'precondition: and it credited, so the credit ran inside that lock');

    const offenders = seen.filter((s) => s.depth > 0);
    assert.deepEqual(
      offenders, [],
      'an outbound call fired while a pooled connection was held. A connection held across a network '
      + 'round trip exhausts the pool rather than delaying one client — see commit 6b. Offenders: '
      + JSON.stringify(offenders)
    );
  });

  it('PAIRED POSITIVE — the probe CAN see a call made inside the lock, so the case above is falsifiable', async () => {
    // ⚠ WITHOUT THIS, THE CASE ABOVE PASSES AGAINST A BROKEN PROBE. If `lockDepth` never rose — a
    // mis-ordered require, a renamed export, a wrapper that silently stopped being called — every
    // recorded depth would be 0 and the partition would read as proven while nothing was observed.
    // That is the "a check whose failure mode has never been observed is a claim, not a check" rule
    // applied to this file's own instrument.
    const { withClientLock } = clientLockModule;
    const depths = [];
    await withClientLock(pool, { contractorId: TENANT, jobberClientId: CLIENT, door: 'c2-probe' },
      async () => { depths.push(lockDepth); });

    assert.deepEqual(depths, [1], 'the probe reports depth 1 inside a lock it is wrapping');
    assert.equal(lockDepth, 0, 'and returns to 0 once released');
    assert.ok(maxLockDepth >= 1, 'and the high-water mark records it');
  });

  it('a capture failure still writes the referral record, and credits nobody', async () => {
    // ⚠ THE FAIL-SAFE C2 HAD TO PRESERVE, AND THE REASON THE SPLIT IS 'capture+derive' /
    // 'record+attribute+credit' RATHER THAN ONE TRANSACTION. `oneEngineFromFacts` (v): the referral
    // record must still be written when a capture fails. If the upsert shared the capture's
    // transaction, a capture throw would roll the record back and a brand-new referred client would
    // simply not appear.
    await seedWorld();
    armOutboundRecorder();
    _setPipelineSyncFetchForTest(async () => { throw new Error('jobber exploded'); });

    // No captureClient, so the sync must fetch — and the fetch throws.
    await syncSingleClient(TENANT, liveClient(), START_DATE, [], 'tok');

    const { rows: pc } = await pool.query(
      'SELECT referred_by, pipeline_status, status_derived_at FROM pipeline_cache WHERE contractor_id = $1',
      [TENANT]
    );
    assert.equal(pc.length, 1, 'the referral record is STILL written');
    assert.equal(pc[0].referred_by, 'Jane Referrer');
    assert.equal(pc[0].pipeline_status, 'lead', 'a new row whose capture failed gets the entry stage');
    assert.equal(pc[0].status_derived_at, null, 'and is marked never-derived, so the catch-up picks it up');

    assert.deepEqual(await conversions(), [], 'and nobody is credited from facts that were not saved');
  });

  it('a SECOND sync of the same client credits nothing further and sends no second email', async () => {
    await seedWorld();
    const seen = armOutboundRecorder();

    await syncSingleClient(TENANT, liveClient(), START_DATE, [], 'tok', { captureClient: captureShape() });
    assert.equal((await conversions()).length, 1, 'precondition: the first sync credited');
    const bonusAfterFirst = seen.filter((s) => s.what.startsWith('bonus-email:')).length;
    assert.ok(bonusAfterFirst >= 1, 'precondition: and notified');

    await syncSingleClient(TENANT, liveClient(), START_DATE, [], 'tok', { captureClient: captureShape() });

    assert.equal((await conversions()).length, 1, 'still exactly one conversion');
    assert.equal(
      seen.filter((s) => s.what.startsWith('bonus-email:')).length, bonusAfterFirst,
      'and not one further bonus email — the notify is gated on a row being INSERTED, never on the '
      + 'engine merely qualifying'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2 — THE SOURCE FENCE
  //
  // ⚠ ITS LIMIT IS STATED RATHER THAN IMPLIED: it answers "is an outbound call WRITTEN inside a
  // locked extent", by brace-matching each `withClientLock(` call. It cannot follow a helper invoked
  // from inside the lock — the same blind spot `clientLock.test.js` and `oneEngineFromFacts` (iii)
  // both state about themselves. The behavioural half above is what covers the paths it cannot read.
  // ═══════════════════════════════════════════════════════════════════════════
  describe('the fence — no outbound call is written inside a locked extent', () => {
    const SYNC = path.join(__dirname, '..', 'crm', 'pipelineSync.js');

    // ⚠ ASSEMBLED FROM PIECES, because this file's own prose names every one of them — the comments
    // above say "notifyReferralCredit sends through Resend" in terms. A needle spelled plainly here
    // would make this test file match itself if the fence ever walked the tree, and stripping comments
    // from the SCANNED file does not help with the needles' own spelling.
    const OUTBOUND = [
      '_ps' + 'FetchFullClient(',
      'fetch' + 'FullClient(',
      'capture' + 'Post(',
      '_axios' + 'Post(',
      'axios' + '.post(',
      '_ps' + 'SendEmail(',
      '_send' + 'AdminNotification(',
      'notify' + 'ReferralCredit(',
      'resend' + '.emails.send(',
    ];

    // Comments become blanks of EQUAL LENGTH, so a line number reported by this fence is the real
    // one. Deleting comment text shifts every line below it, and a fence whose findings name the
    // wrong line is worse than none.
    function stripComments(src) {
      return src
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
    }

    // Every `withClientLock(` call's parenthesised extent — which, because the callback is the last
    // argument, is the whole locked section.
    function lockedExtents(src) {
      const out = [];
      let from = 0;
      for (;;) {
        const at = src.indexOf('withClientLock(', from);
        if (at === -1) break;
        from = at + 1;
        let depth = 0;
        let end = -1;
        for (let i = src.indexOf('(', at); i < src.length; i += 1) {
          if (src[i] === '(') depth += 1;
          else if (src[i] === ')') { depth -= 1; if (depth === 0) { end = i; break; } }
        }
        if (end !== -1) out.push([at, end]);
      }
      return out;
    }

    const lineOf = (src, at) => src.slice(0, at).split('\n').length;

    it('pipelineSync.js — no locked extent contains an outbound call', () => {
      const raw = fs.readFileSync(SYNC, 'utf8');
      const src = stripComments(raw);
      const extents = lockedExtents(src);

      // ⚠ NON-VACUITY FLOORS. A fence over a file whose locks it failed to find passes by reading
      // nothing, which is the shape that makes a green run meaningless.
      assert.ok(extents.length >= 2, `harness: expected at least two locked extents, found ${extents.length}`);
      assert.ok(
        src.includes('creditReferralFromFacts('),
        'harness: the sync must actually credit, or this fence is guarding a door with no money in it'
      );

      const offenders = [];
      for (const needle of OUTBOUND) {
        let k = 0;
        for (;;) {
          const at = src.indexOf(needle, k);
          if (at === -1) break;
          k = at + 1;
          if (extents.some(([a, b]) => at > a && at < b)) {
            offenders.push(`pipelineSync.js:${lineOf(src, at)} — ${needle} inside a locked extent`);
          }
        }
      }
      assert.deepEqual(
        offenders, [],
        'a pooled connection must never be held across an outbound call. Offenders: ' + JSON.stringify(offenders)
      );
    });

    it('the referral record, the attribution and the credit are called inside ONE locked extent', () => {
      // ⚠ THIS IS THE OTHER HALF OF C2's SUBJECT, AND THE FENCE ABOVE CANNOT EXPRESS IT. "No outbound
      // call inside the lock" says nothing about whether the things that MUST be atomic are in there
      // together. Before C2 the `pipeline_cache` upsert ran on the POOL while the attribution opened a
      // lock of its own, so a conversion could not be atomic with the referral record that justifies
      // it — which is exactly what 7d recorded as the blocker to the sync ever crediting.
      // ⚠ IT CHECKS THE CALL SITES, NOT THE SQL, AND THE REASON IS STRUCTURAL. The upsert's statement
      // lives in `upsertReferralRecord`, a named helper with two callers (the lock, and the pool path
      // for a falsy contractorId), so the SQL itself is never textually inside an extent. What is
      // checkable — and what actually matters — is that the CALL is.
      const src = stripComments(fs.readFileSync(SYNC, 'utf8'));
      const extents = lockedExtents(src);
      const MUST_SHARE = ['readPreUpsertState(', 'upsertReferralRecord(', 'creditReferralFromFacts('];

      // For each required call, every extent index it falls inside.
      const whichExtent = {};
      for (const needle of MUST_SHARE) {
        const inside = [];
        let k = 0;
        for (;;) {
          const at = src.indexOf(needle, k);
          if (at === -1) break;
          k = at + 1;
          extents.forEach(([a, b], idx) => { if (at > a && at < b) inside.push(idx); });
        }
        whichExtent[needle] = inside;
      }

      for (const needle of MUST_SHARE) {
        assert.ok(
          whichExtent[needle].length > 0,
          `${needle} must be called inside a locked extent — found no call site inside one`
        );
      }
      // ⚠ THE SAME extent, not merely "each inside some extent". Two of them in two different locks is
      // precisely the pre-C2 state this commit exists to end.
      const shared = whichExtent[MUST_SHARE[0]]
        .filter((i) => whichExtent[MUST_SHARE[1]].includes(i))
        .filter((i) => whichExtent[MUST_SHARE[2]].includes(i));
      assert.ok(
        shared.length >= 1,
        'the referral record, the attribution and the credit must share ONE locked extent — '
        + `found ${JSON.stringify(whichExtent)}`
      );
    });

    it('nothing inside a locked extent touches `pool` — every call takes the TRANSACTION', () => {
      // ⚠ THIS CASE EXISTS BECAUSE A GUARD-PROOF MEASURED WIDTH 0 AND THAT WAS A FINDING. Changing
      // `_runAttributionEngine(db, …)` to `_runAttributionEngine(pool, …)` INSIDE the lock broke
      // nothing any test could see — and it is a real defect: the engine's writes would commit on a
      // different connection, outside the transaction, so they would survive a rollback of the
      // referral record that justified them and would not be serialised by the lock at all.
      // ⚠ BOTH EXISTING FENCES ARE BLIND TO IT, AND FOR THE SAME REASON. This file's outbound fence
      // and `oneEngineFromFacts` (iii) both check a call's POSITION — whether it falls inside the
      // parenthesised extent. Neither reads which connection it was handed. A call can sit perfectly
      // inside the lock and still bypass it entirely through its first argument.
      // ⚠ SO THE PROPERTY IS SPELLED AS AN ABSENCE: inside a locked callback, the word `pool` should
      // not appear at all. The transaction is the only connection in scope there, and anything
      // reaching for the pool is reaching around the lock.
      const src = stripComments(fs.readFileSync(SYNC, 'utf8'));
      const extents = lockedExtents(src);
      assert.ok(extents.length >= 2, `harness: expected at least two locked extents, found ${extents.length}`);

      const offenders = [];
      for (const [a, b] of extents) {
        // ⚠ THE EXTENT STARTS AT `withClientLock(`, WHOSE OWN FIRST ARGUMENT IS LEGITIMATELY `pool`.
        // Skipping past the options object is what separates "the lock was given the pool", which is
        // correct and required, from "something inside the callback used the pool", which is the
        // defect. The callback begins after the options object closes.
        const optsEnd = src.indexOf('}', src.indexOf('{', a));
        const bodyStart = optsEnd === -1 ? a : optsEnd;
        const body = src.slice(bodyStart, b);
        const m = body.match(/\bpool\b/g);
        if (m) {
          offenders.push(`a locked callback near line ${lineOf(src, a)} references pool ${m.length} time(s)`);
        }
      }
      assert.deepEqual(
        offenders, [],
        'inside a lock, every call must take the transaction. A call that takes `pool` sits in the '
        + 'locked extent and bypasses the lock through its first argument. Offenders: '
        + JSON.stringify(offenders)
      );
    });

    it('HARNESS — the needles and the extent matcher both work, proven in BOTH directions', () => {
      // ⚠ A FENCE WHOSE NEEDLES MATCH NOTHING PASSES IDENTICALLY TO A CLEAN FILE. These two synthetic
      // cases are what separate the two, and they are checked in both directions: an outbound call
      // inside an extent IS flagged, and a database call inside one is NOT.
      const bad = [
        'withClientLock(pool, { contractorId, jobberClientId, door: "d" }, async (tx) => {',
        '  await ' + '_ps' + 'SendEmail({ to: "x" });',
        '});',
      ].join('\n');
      const badExtents = lockedExtents(bad);
      assert.equal(badExtents.length, 1, 'the matcher finds the synthetic extent');
      const hit = OUTBOUND.some((n) => {
        const at = bad.indexOf(n);
        return at !== -1 && badExtents.some(([a, b]) => at > a && at < b);
      });
      assert.ok(hit, 'a synthetic outbound call inside a lock IS flagged');

      // The paired negative: ordinary DB work inside a lock must not be flagged.
      const good = [
        'withClientLock(pool, { contractorId, jobberClientId, door: "d" }, async (tx) => {',
        '  await tx.query("SELECT 1");',
        '  await creditReferralFromFacts(tx, { contractorId });',
        '});',
      ].join('\n');
      const goodExtents = lockedExtents(good);
      assert.equal(goodExtents.length, 1);
      const falsePositive = OUTBOUND.some((n) => {
        const at = good.indexOf(n);
        return at !== -1 && goodExtents.some(([a, b]) => at > a && at < b);
      });
      assert.ok(!falsePositive, 'a query and the credit inside a lock are NOT flagged');
    });

    it('the notify and the fetch are written OUTSIDE every locked extent — asserted, not merely unflagged', () => {
      // ⚠ THE INVERSE OF THE FENCE, AND IT CATCHES A DIFFERENT FAILURE: a file that stopped calling
      // the notify at all would pass the fence above trivially. This asserts both calls EXIST and sit
      // outside every lock, so "outside" cannot be satisfied by "absent".
      const src = stripComments(fs.readFileSync(SYNC, 'utf8'));
      const extents = lockedExtents(src);

      for (const needle of ['notify' + 'ReferralCredit(', '_ps' + 'FetchFullClient(']) {
        const positions = [];
        let k = 0;
        for (;;) {
          const at = src.indexOf(needle, k);
          if (at === -1) break;
          k = at + 1;
          positions.push(at);
        }
        assert.ok(positions.length > 0, `${needle} must appear in the sync at all`);
        for (const at of positions) {
          assert.ok(
            !extents.some(([a, b]) => at > a && at < b),
            `${needle} at line ${lineOf(src, at)} must sit outside every locked extent`
          );
        }
      }
    });
  });
});
