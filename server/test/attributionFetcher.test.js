'use strict';

// setup.js must be first — sets env vars before db.js is loaded transitively.
const { initTestDb } = require('./setup');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { fetchAttributionData } = require('../crm/jobber');

// ── REQUEST FIXTURES ──────────────────────────────────────────────────────────

const REQ_NEW = {
  id: 'req-1',
  createdAt: '2026-06-01T00:00:00Z',
  salesperson: { id: 'user-A' },
  assessment: {
    id: 'assess-1',
    assignedUsers: { nodes: [{ id: 'user-A' }, { id: 'user-B' }] },
  },
};

const REQ_MID = {
  id: 'req-2',
  createdAt: '2026-05-01T00:00:00Z',
  salesperson: { id: 'user-C' },
  assessment: null, // intentionally absent
};

const REQ_OLD = {
  id: 'req-3',
  createdAt: '2026-04-01T00:00:00Z',
  salesperson: null,
  assessment: {
    id: 'assess-2',
    assignedUsers: { nodes: [{ id: 'user-D' }] },
  },
};

// Builds a mock _httpPost that resolves with a successful Jobber response shape.
// Shape matches the TOP-LEVEL Query.requests field (data.requests.nodes), not the nested
// Client.requests connection — the nested connection accepts no sort/filter args at our
// pinned API version (2026-02-17), confirmed live; ATTRIBUTION_QUERY moved to the top-level
// field with a clientId filter instead. See jobber.js for the full verification history.
function successPost(requestNodes) {
  return async () => ({
    data: {
      data: { requests: { nodes: requestNodes } },
    },
  });
}

// ── SUITE ─────────────────────────────────────────────────────────────────────

describe('fetchAttributionData — transformation logic', () => {
  let pool;

  before(async () => {
    // initTestDb ensures error_log table exists for logError calls inside the function.
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  it('(a) maps a valid response to the correct { requests, assessments } shape', async () => {
    const result = await fetchAttributionData('client-1', 'tok', successPost([REQ_NEW]));
    assert.equal(result.requests.length, 1, 'requests has one entry');
    assert.equal(result.requests[0].id, 'req-1');
    assert.equal(result.assessments.length, 1, 'assessments derived from non-null request.assessment');
    assert.equal(result.assessments[0].id, 'assess-1');
    assert.equal(result.assessments[0].assignedUsers.nodes.length, 2, 'assignedUsers nodes preserved');
  });

  it('(b) JS sort places most-recent createdAt at index [0] regardless of API return order', async () => {
    // API returns oldest-first; sorted result must be newest-first.
    const result = await fetchAttributionData('client-1', 'tok', successPost([REQ_OLD, REQ_MID, REQ_NEW]));
    assert.equal(result.requests[0].id, 'req-1', 'most recent (2026-06) is index [0]');
    assert.equal(result.requests[1].id, 'req-2', 'middle (2026-05) is index [1]');
    assert.equal(result.requests[2].id, 'req-3', 'oldest (2026-04) is index [2]');
  });

  it('(c) null assessments excluded from assessments array; requests order preserved', async () => {
    // REQ_MID has assessment: null — must not appear in assessments; requests keeps all 3.
    const result = await fetchAttributionData('client-1', 'tok', successPost([REQ_OLD, REQ_MID, REQ_NEW]));
    assert.equal(result.requests.length, 3, 'all 3 requests preserved (including the one with null assessment)');
    assert.equal(result.assessments.length, 2, 'only 2 non-null assessments');
    // assessments follow sorted-requests order: req-1 (2026-06) before req-3 (2026-04)
    assert.equal(result.assessments[0].id, 'assess-1', 'most-recent assessment is index [0]');
    assert.equal(result.assessments[1].id, 'assess-2', 'older assessment is index [1]');
  });

  it('(d) throws when response.data.errors is present — must not return empty arrays', async () => {
    const errorsPost = async () => ({
      data: {
        data: null,
        errors: [{ message: 'Some GraphQL error', locations: [] }],
      },
    });
    await assert.rejects(
      () => fetchAttributionData('client-1', 'tok', errorsPost),
      (err) => {
        assert.ok(err instanceof Error, 'throws an Error instance');
        assert.ok(err.message.includes('client-1'), 'error message identifies the client');
        return true;
      },
      'must throw on GraphQL errors, not silently return empty arrays'
    );
  });

  it('(e) throws when requests field is null in response', async () => {
    const nullRequestsPost = async () => ({
      data: { data: { requests: null } },
    });
    await assert.rejects(
      () => fetchAttributionData('client-1', 'tok', nullRequestsPost),
      (err) => {
        assert.ok(err instanceof Error, 'throws an Error instance');
        assert.ok(err.message.includes('client-1'), 'error message identifies the client');
        return true;
      },
      'must throw on null requests field, not silently return empty arrays'
    );
  });
});
