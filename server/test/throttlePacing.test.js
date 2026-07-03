'use strict';

// setup.js must be first — sets env vars before db.js is loaded transitively.
require('./setup');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  computeThrottlePaceDelayMs,
  isThrottledError,
} = require('../crm/pipelineSync');

// ── console.warn SPY HELPER ─────────────────────────────────────────────────────
let warnCalls;
let originalWarn;
beforeEach(() => {
  warnCalls = [];
  originalWarn = console.warn;
  console.warn = (...args) => warnCalls.push(args);
});
afterEach(() => {
  console.warn = originalWarn;
});

describe('computeThrottlePaceDelayMs', () => {
  it('computes a delay from (requestedQueryCost - currentlyAvailable) / restoreRate plus buffer when available is short', () => {
    const delay = computeThrottlePaceDelayMs(
      { currentlyAvailable: 7859, restoreRate: 500 },
      8055
    );
    // (8055 - 7859) / 500 * 1000 = 392ms, + 500ms buffer = 892ms
    assert.equal(delay, 892);
  });

  it('returns 0 when currentlyAvailable already covers requestedQueryCost', () => {
    const delay = computeThrottlePaceDelayMs(
      { currentlyAvailable: 9000, restoreRate: 500 },
      8055
    );
    assert.equal(delay, 0);
  });

  it('returns 0 and logs a warning when throttleStatus is missing', () => {
    const delay = computeThrottlePaceDelayMs(undefined, 8055);
    assert.equal(delay, 0);
    assert.equal(warnCalls.length, 1, 'exactly one warning logged');
  });

  it('returns 0 and logs a warning when throttleStatus fields are malformed (non-numeric)', () => {
    const delay = computeThrottlePaceDelayMs(
      { currentlyAvailable: null, restoreRate: 500 },
      8055
    );
    assert.equal(delay, 0);
    assert.equal(warnCalls.length, 1, 'exactly one warning logged');
  });

  it('caps the computed delay at 60000ms and logs a loud warning when exceeded', () => {
    const delay = computeThrottlePaceDelayMs(
      { currentlyAvailable: 0, restoreRate: 1 },
      8055
    );
    assert.equal(delay, 60000);
    assert.equal(warnCalls.length, 1, 'exactly one warning logged for the cap');
  });
});

describe('isThrottledError', () => {
  it('returns true when graphqlErrors contains extensions.code === THROTTLED', () => {
    const err = { graphqlErrors: [{ extensions: { code: 'THROTTLED' } }] };
    assert.equal(isThrottledError(err), true);
  });

  it('returns true when graphqlErrors contains message === "Throttled" without an extensions code', () => {
    const err = { graphqlErrors: [{ message: 'Throttled' }] };
    assert.equal(isThrottledError(err), true);
  });

  it('returns false when graphqlErrors has neither the code nor the message variant', () => {
    const err = { graphqlErrors: [{ message: 'Some other error' }] };
    assert.equal(isThrottledError(err), false);
  });

  it('returns false when graphqlErrors is missing or not an array', () => {
    assert.equal(isThrottledError({}), false);
    assert.equal(isThrottledError({ graphqlErrors: 'not-an-array' }), false);
  });
});
