'use strict';

// setup.js must be first — sets env vars before db.js is loaded transitively.
const { initTestDb } = require('./setup');
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  runIncrementalSync,
  runFullSync,
  _setPipelineSyncHttpForTest,
  _resetPipelineSyncHttp,
  _setPipelineSyncEmailsForTest,
  _resetPipelineSyncEmails,
} = require('../crm/pipelineSync');
const { seedContractor, seedToken } = require('./helpers');

const CID = 'accent-roofing-throttle-test';

// ── LOCAL SEED HELPERS (no existing helper covers these tables) ────────────────
async function seedCrmSettings(pool, { referralStartDate = '2026-01-01T00:00:00Z' } = {}) {
  await pool.query(
    `INSERT INTO contractor_crm_settings (contractor_id, referral_start_date)
     VALUES ($1, $2)
     ON CONFLICT (contractor_id) DO UPDATE SET referral_start_date = EXCLUDED.referral_start_date`,
    [CID, referralStartDate]
  );
}

async function seedSyncState(pool, { lastSyncedAt, initialSyncComplete = true }) {
  await pool.query(
    `INSERT INTO sync_state (contractor_id, last_synced_at, initial_sync_complete, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (contractor_id) DO UPDATE SET
       last_synced_at = EXCLUDED.last_synced_at,
       initial_sync_complete = EXCLUDED.initial_sync_complete`,
    [CID, lastSyncedAt, initialSyncComplete]
  );
}

// Builds an empty-but-valid successful Jobber clients response with a full
// throttleStatus so pacing math never warns/misbehaves in tests that don't care about it.
function successResponse({ requestedQueryCost = 8055, currentlyAvailable = 9800, restoreRate = 500 } = {}) {
  return {
    data: {
      data: { clients: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
      extensions: {
        cost: {
          requestedQueryCost,
          actualQueryCost: 302,
          throttleStatus: { maximumAvailable: 10000, currentlyAvailable, restoreRate },
        },
      },
    },
  };
}

// Builds a THROTTLED response — HTTP-200-shaped, data: null, matching real Jobber shape.
function throttledResponse({ requestedQueryCost = 8055, currentlyAvailable = 7859, restoreRate = 500 } = {}) {
  return {
    data: {
      data: null,
      errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }],
      extensions: {
        cost: {
          requestedQueryCost,
          actualQueryCost: 0,
          throttleStatus: { maximumAvailable: 10000, currentlyAvailable, restoreRate },
        },
      },
    },
  };
}

// Extracts the updatedAt/createdAt date-filter window from a captured GraphQL query string.
function extractWindow(query) {
  const after = query.match(/after: "([^"]+)"/);
  const before = query.match(/before: "([^"]+)"/);
  return { after: after?.[1], before: before?.[1] };
}

describe('pipelineSync — throttle pacing and cost reduction', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
    await seedContractor(pool, CID);
    await seedToken(pool, { contractorId: CID, accessToken: 'test-throttle-token' });
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
    await pool.query(`DELETE FROM pipeline_cache WHERE contractor_id = $1`, [CID]);
    _resetPipelineSyncHttp();
  });

  it('paces the retry after a THROTTLED response instead of retrying instantly, and retries the SAME window before shrinking it', async () => {
    await seedCrmSettings(pool);
    // 48h ago (not 1h) — the window boundary lands well before "now", so a shrunk
    // window produces a genuinely different `before` timestamp instead of both
    // the 24h and 12h window sizes coincidentally clamping to the same "now".
    await seedSyncState(pool, { lastSyncedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) });

    const capturedQueries = [];
    const sleepCalls = [];
    let callCount = 0;

    _setPipelineSyncHttpForTest({
      axiosPost: async (url, body) => {
        capturedQueries.push(body.query);
        callCount++;
        if (callCount === 1) return throttledResponse({ requestedQueryCost: 8055, currentlyAvailable: 7859, restoreRate: 500 });
        return successResponse();
      },
      sleep: async (ms) => { sleepCalls.push(ms); },
    });

    await runIncrementalSync(CID);

    assert.ok(capturedQueries.length >= 2, 'at least a throttled call and a retry were made');
    assert.equal(sleepCalls.length, 1, 'exactly one paced delay was applied, for the single throttle event');
    // (8055 - 7859) / 500 * 1000 = 392ms, + 500ms buffer = 892ms — same formula as computeThrottlePaceDelayMs
    assert.equal(sleepCalls[0], 892, 'delay is computed from the THROTTLED response throttleStatus, not an instant retry');

    const [firstWindow, secondWindow] = capturedQueries.slice(0, 2).map(extractWindow);
    assert.equal(firstWindow.after, secondWindow.after, 'retry uses the SAME window start — not shrunk after a single throttle');
    assert.equal(firstWindow.before, secondWindow.before, 'retry uses the SAME window end — not shrunk after a single throttle');

    const { rows } = await pool.query(
      `SELECT last_synced_at FROM sync_state WHERE contractor_id = $1`,
      [CID]
    );
    assert.ok(rows[0].last_synced_at, 'sync_state was updated — the paced retry ultimately succeeded');
  });

  it('sends clients(first: 25 ...) in runIncrementalSync', async () => {
    await seedCrmSettings(pool);
    await seedSyncState(pool, { lastSyncedAt: new Date(Date.now() - 60 * 60 * 1000) });

    let capturedQuery = null;
    _setPipelineSyncHttpForTest({
      axiosPost: async (url, body) => {
        capturedQuery = body.query;
        return successResponse();
      },
      sleep: async () => {},
    });

    await runIncrementalSync(CID);

    assert.ok(capturedQuery, 'a query was captured');
    assert.match(capturedQuery, /clients\(first: 25/, 'incremental sync requests first: 25, not 50');
  });

  it('sends clients(first: 25 ...) in runFullSync', async () => {
    await seedCrmSettings(pool);

    let capturedQuery = null;
    _setPipelineSyncHttpForTest({
      axiosPost: async (url, body) => {
        capturedQuery = body.query;
        return successResponse();
      },
      sleep: async () => {},
    });

    await runFullSync(CID);

    assert.ok(capturedQuery, 'a query was captured');
    assert.match(capturedQuery, /clients\(first: 25/, 'full sync requests first: 25, not 50');
  });

  it('runFullSync attaches graphqlErrors to the thrown error when Jobber returns no clients data', async () => {
    await seedCrmSettings(pool);

    _setPipelineSyncHttpForTest({
      axiosPost: async () => throttledResponse(),
      sleep: async () => {},
    });

    await assert.rejects(
      () => runFullSync(CID),
      (err) => {
        assert.ok(Array.isArray(err.graphqlErrors), 'graphqlErrors is an array');
        assert.equal(err.graphqlErrors.length, 1, 'the THROTTLED error was attached');
        assert.equal(err.graphqlErrors[0].extensions.code, 'THROTTLED');
        return true;
      }
    );
  });
});
