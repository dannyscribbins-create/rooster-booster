'use strict';

// setup.js must be first — sets env vars before db.js is loaded transitively.
const { initTestDb } = require('./setup');
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  syncSingleClient,
  _setAttributionEngineForTest,
  _resetAttributionEngine,
  _setPipelineSyncEmailsForTest,
  _resetPipelineSyncEmails,
} = require('../crm/pipelineSync');
const { fetchAttributionData } = require('../crm/jobber');
const { seedContractor } = require('./helpers');

const CID = 'accent-roofing';
const REFERRAL_START_DATE = new Date('2026-01-01T00:00:00Z');

// A referred client with no quotes or jobs → classifyPipelineStatus returns 'lead'.
function makeReferredClient(id) {
  return {
    id,
    firstName: 'Test',
    lastName: 'Client',
    createdAt: '2026-06-15T00:00:00Z',
    customFields: [{ label: 'Referred by', valueText: 'Jane Referrer' }],
    quotes: { nodes: [] },
    jobs: { nodes: [] },
  };
}

// A client with no 'Referred by' field — syncSingleClient exits at line ~76.
function makeUnreferredClient(id) {
  return {
    id,
    firstName: 'Other',
    lastName: 'Client',
    createdAt: '2026-06-15T00:00:00Z',
    customFields: [],
    quotes: { nodes: [] },
    jobs: { nodes: [] },
  };
}

// Lightweight spy — records call count and the options object (2nd arg to engine).
function makeSpy() {
  const spy = {
    callCount: 0,
    lastCallOptions: null,
    fn: async (_pool, options) => {
      spy.callCount++;
      spy.lastCallOptions = options;
    },
  };
  return spy;
}

// ── SUITE ─────────────────────────────────────────────────────────────────────

describe('syncSingleClient — attribution engine wiring', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
    await seedContractor(pool, CID);

    // LIVE-SEND GUARD — RESEND_API_KEY is active in the test env; this suppresses all
    // Resend calls routed through pipelineSync.js's seam (_sendAdminNotification for
    // the #25 admin alert, and _psSendEmail for referrer notification emails #1–#6).
    // Un-seamed paths (sendPendingRewardEmail, checkAndCreatePendingReferral in
    // pendingReferral.js) are gated by status='paid' and non-null contact info
    // respectively — neither condition is met by current fixtures. If future fixtures
    // add paid status or contact info, those paths must also be seamed in pendingReferral.js.
    // NOTE: a RESEND_API_KEY env-swap was considered and rejected — all three Resend
    // instances (pipelineSync, notificationEmail, pendingReferral) are created at
    // require()-time; a post-require env mutation has no effect on them.
    _setPipelineSyncEmailsForTest({
      adminNotification: async () => {},
      email: async () => ({ data: null, error: null }),
    });
  });

  after(async () => {
    _resetPipelineSyncEmails();
    await pool.end();
  });

  beforeEach(async () => {
    // Clean pipeline_cache for CID rows and any empty-string rows from test (c).
    await pool.query(
      `DELETE FROM pipeline_cache WHERE contractor_id = $1 OR contractor_id = ''`,
      [CID]
    );
    _resetAttributionEngine();
  });

  afterEach(() => {
    _resetAttributionEngine();
  });

  it('(a) invokes the engine after the pipeline_cache upsert with the correct contractorId, jobberClientId, currentStatus, client object, real fetchAttributionData import, and the token passed into syncSingleClient', async () => {
    const spy = makeSpy();
    _setAttributionEngineForTest(spy.fn);
    const client = makeReferredClient('attr-wire-a');

    await syncSingleClient(CID, client, REFERRAL_START_DATE, [], 'test-token-abc');

    assert.equal(spy.callCount, 1, 'engine called exactly once');
    const opts = spy.lastCallOptions;
    assert.equal(opts.contractorId, CID, 'contractorId is the sync contractorId');
    assert.equal(opts.jobberClientId, 'attr-wire-a', 'jobberClientId equals client.id');
    assert.equal(opts.currentStatus, 'lead', 'currentStatus is the classified pipeline status');
    assert.strictEqual(opts.client, client, 'client object passed by reference');
    assert.strictEqual(
      opts.fetchAttributionData,
      fetchAttributionData,
      'fetchAttributionData is the real production import, not undefined'
    );
    assert.equal(opts.token, 'test-token-abc', 'token is the value passed into syncSingleClient');
    assert.ok(opts.referralAnchor, 'referralAnchor must be passed to the engine');
  });

  it('(a2) referralAnchor is the pipeline_cache row\'s own created_at, not last_synced_at/updated_at, and is preserved (not reset) on re-sync', async () => {
    const spy = makeSpy();
    _setAttributionEngineForTest(spy.fn);
    const client = makeReferredClient('attr-wire-a2');

    // First sync — creates the pipeline_cache row. Anchor should equal that first-seen moment.
    await syncSingleClient(CID, client, REFERRAL_START_DATE, [], 'test-token-abc');
    const firstAnchor = new Date(spy.lastCallOptions.referralAnchor).getTime();

    const { rows } = await pool.query(
      `SELECT created_at FROM pipeline_cache WHERE contractor_id=$1 AND jobber_client_id=$2`,
      [CID, 'attr-wire-a2']
    );
    assert.equal(firstAnchor, new Date(rows[0].created_at).getTime(), 'anchor equals the pipeline_cache row created_at on first sync');

    // Re-sync the same client later — created_at must not change, so the anchor passed to
    // the engine on the second call must equal the FIRST call's anchor, not "now".
    const clientAgain = makeReferredClient('attr-wire-a2');
    await syncSingleClient(CID, clientAgain, REFERRAL_START_DATE, [], 'test-token-abc');
    const secondAnchor = new Date(spy.lastCallOptions.referralAnchor).getTime();

    assert.equal(secondAnchor, firstAnchor, 'referralAnchor must be preserved across re-sync, not reset to the current sync time');
  });

  it('(b) an engine throw does NOT break syncSingleClient — pipeline_cache row exists and logError fires with source pipelineSync/attribution', async () => {
    // Unique message keeps the error_log dedup key (contractor_id, route, method, error_message) fresh.
    const uniqueMsg = `attr-wire-b-throw-${Date.now()}`;
    _setAttributionEngineForTest(async () => { throw new Error(uniqueMsg); });
    const client = makeReferredClient('attr-wire-b');

    // Must NOT throw — fail-safe wrapping must absorb the engine error.
    await syncSingleClient(CID, client, REFERRAL_START_DATE, [], 'test-token-abc');

    // Sync completed — pipeline_cache row must exist.
    const { rows: cacheRows } = await pool.query(
      `SELECT pipeline_status FROM pipeline_cache
       WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [CID, 'attr-wire-b']
    );
    assert.equal(cacheRows.length, 1, 'pipeline_cache row written — sync completed despite engine throw');

    // logError must have persisted the error with the attribution source.
    const { rows: errRows } = await pool.query(
      `SELECT source FROM error_log WHERE error_message = $1 LIMIT 1`,
      [uniqueMsg]
    );
    assert.equal(errRows.length, 1, 'error_log row written for the attribution error');
    assert.equal(errRows[0].source, 'pipelineSync/attribution', 'source is pipelineSync/attribution');
  });

  it('(c) engine is NOT invoked when contractorId is falsy — NOTE: trivially passes in RED because no engine call exists yet; becomes meaningful only at GREEN where (a) must also pass', async () => {
    const spy = makeSpy();
    _setAttributionEngineForTest(spy.fn);
    const client = makeReferredClient('attr-wire-c1');

    // Valid contractorId — engine MUST fire (this is the RED-breaking assertion alongside test (a)).
    await syncSingleClient(CID, client, REFERRAL_START_DATE, [], 'test-token-abc');
    assert.equal(spy.callCount, 1, 'engine called once for valid contractorId');

    // Falsy contractorId — engine must NOT be called again.
    // pipeline_cache.contractor_id has no FK — empty string upserts without error.
    const client2 = makeReferredClient('attr-wire-c2');
    await syncSingleClient('', client2, REFERRAL_START_DATE, [], 'test-token-abc');
    assert.equal(spy.callCount, 1, 'engine call count unchanged for empty contractorId');
  });

  it('(d) engine is NOT invoked for non-referred clients — attribution only runs for referred clients, consistent with the if (!referredBy) return guard at top of syncSingleClient', async () => {
    const spy = makeSpy();
    _setAttributionEngineForTest(spy.fn);

    // Referred client — engine MUST fire.
    const referred = makeReferredClient('attr-wire-d-ref');
    await syncSingleClient(CID, referred, REFERRAL_START_DATE, [], 'test-token-abc');
    assert.equal(spy.callCount, 1, 'engine called once for referred client');

    // Non-referred client — syncSingleClient returns at line ~76; engine must NOT fire again.
    const unreferred = makeUnreferredClient('attr-wire-d-unref');
    await syncSingleClient(CID, unreferred, REFERRAL_START_DATE, [], 'test-token-abc');
    assert.equal(spy.callCount, 1, 'engine call count unchanged for non-referred client');
  });
});
