'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CANVASS-9a — THE TIMEFRAME WINDOW ON THE REP SURFACE (Parts 3b / 4b)
//
// The rep's Home and Clients screens carry a week/month/year/all selector. Ruled:
// **every stat under the bar obeys it, and on the Clients tab the LIST obeys it
// too** — one control on one screen means one thing. `all` is the default and is
// the absence of a predicate rather than a very large window.
//
// ── ⚠ WHY THIS FILE EXISTS AS WELL AS `parseTimeframe`'s OWN UNIT CASES ─────
// A pure test of `parseTimeframe()` proves the parser and NOTHING about whether any
// query uses it. That is this repo's recorded "a test that injects the value itself
// cannot discover that nothing upstream supplies it" failure, and the worked example
// is exactly this shape: `loadContractorBranding()` never named either font column,
// the resolver read `undefined`, every value fell back to the platform default, and
// the resolver's own unit test stayed green because it was handed a row directly.
//
// **So every case below goes through the real route, against real rows, and asserts
// the RESULT.** A window that reached the parser and not the SQL would pass a parser
// test and fail every case here.
//
// ── ⚠ AND THE FIXTURE IS BUILT SO THE WINDOWS CANNOT AGREE BY ACCIDENT ──────
// Three assignments at deliberately separated ages — 2 days, 20 days and 200 days —
// so `week`, `month`, `year` and `all` each return a DIFFERENT count (1, 2, 3, 3+).
// If every row sat inside every window, a route that ignored the parameter entirely
// would pass every case. That is the vacuity shape this repo recorded against the
// request-attribution anchor, where a fixture's dates sat inside the grace window
// under BOTH candidate anchors and the wrong one went green.
// ─────────────────────────────────────────────────────────────────────────────

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseTimeframe, timeframeClause, conversionTimeframeClause } = require('../utils/repBook');

test.describe('Canvass-9a — parseTimeframe', () => {
  test('the three named windows produce a start date, in ascending age', () => {
    const week = parseTimeframe('week');
    const month = parseTimeframe('month');
    const year = parseTimeframe('year');
    assert.equal(week.key, 'week');
    assert.equal(month.key, 'month');
    assert.equal(year.key, 'year');
    // ⚠ ORDERING RATHER THAN EXACT INSTANTS. Pinning "7 days ago to the millisecond"
    // would be pinning the clock; what the product needs is that a wider window starts
    // earlier, and that is falsifiable without being brittle.
    assert.ok(week.since > month.since, 'week must start later than month');
    assert.ok(month.since > year.since, 'month must start later than year');
  });

  test('⚠ `all` is NULL, not a sentinel date', () => {
    // A sentinel would silently DROP any assignment whose date columns are both NULL,
    // because `NULL >= anything` is NULL. The absence of a clause cannot.
    assert.equal(parseTimeframe('all').since, null);
    assert.equal(parseTimeframe('all').key, 'all');
  });

  test('⚠ an unrecognised value falls back to `all` — the WIDEST window, never the narrowest', () => {
    // The direction is the whole reason this does not 400. Falling back to `all` can
    // only ever show MORE rows than asked for; falling back to `week` would hide a
    // rep's book because of a typo in a query string.
    for (const bad of [undefined, null, '', 'WEEK', 'day', 'decade', '7', 0, {}, [], 'constructor', '__proto__']) {
      const out = parseTimeframe(bad);
      assert.equal(out.key, 'all', `${JSON.stringify(bad)} should fall back to all`);
      assert.equal(out.since, null);
    }
  });

  test('⚠ prototype keys cannot be smuggled in as a timeframe', () => {
    // `hasOwnProperty.call` rather than `in` or a bare property read: `'constructor' in
    // TIMEFRAME_DAYS` is TRUE through the prototype chain, and a bare
    // `TIMEFRAME_DAYS[raw]` returns a FUNCTION for it — which would reach the date
    // arithmetic and produce `Invalid Date`, then a SQL parameter of `null`... which is
    // `all`. It would work by accident today and break the moment the shape changed.
    assert.equal(parseTimeframe('constructor').key, 'all');
    assert.equal(parseTimeframe('toString').key, 'all');
    assert.equal(parseTimeframe('hasOwnProperty').key, 'all');
  });
});

test.describe('Canvass-9a — the timeframe SQL fragments', () => {
  test('the assignment clause is inert when its parameter is NULL', () => {
    // ⚠ THE PROPERTY, NOT THE STRING. `all` and a window must run the SAME statement,
    // because a route that concatenates a clause conditionally has two shapes and tests
    // one. So the fragment must always be present and must neutralise itself on NULL.
    const sql = timeframeClause(6);
    assert.match(sql, /\$6::timestamptz IS NULL/, 'must self-neutralise on a NULL parameter');
    assert.match(sql, /^AND\s/, 'must be appendable to an existing WHERE');
  });

  test('⚠ the assignment clause windows the ASSIGNMENT date, not `updated_at`', () => {
    // Windowing on `updated_at` would be defensible and unverifiable: a row touched by
    // a sync would drift into "this week" while displaying an assignment date from
    // March, so a rep could not check the filter against the dates in front of them.
    const sql = timeframeClause(3);
    assert.match(sql, /COALESCE\(cra\.sticky_set_at, cra\.provisional_set_at\)/);
    assert.ok(!/updated_at/.test(sql), 'must not window on updated_at');
  });

  test('⚠ a CONVERSION is windowed by its own date, on its own table', () => {
    // Reusing the assignment clause for conversions would count them by the age of an
    // unrelated assignment row and return a plausible number for a question nobody
    // asked. These are two functions for exactly that reason.
    const sql = conversionTimeframeClause(3);
    assert.match(sql, /rc\.converted_at/);
    assert.ok(!/sticky_set_at/.test(sql), 'a conversion is not windowed by an assignment date');
    assert.match(sql, /\$3::timestamptz IS NULL/);
  });

  test('the parameter position is honoured rather than hardcoded', () => {
    // ⚠ THE CLIENTS ROUTE PASSES $6 AND HOME PASSES $3, because `since` was appended
    // AFTER the existing parameters so the keyset's $4/$5 keep meaning what every
    // comment in that handler says they mean. A fragment that hardcoded a position
    // would silently re-bind the cursor to a timestamp — a mis-bound parameter that
    // still runs.
    assert.match(timeframeClause(6), /\$6/);
    assert.match(timeframeClause(3), /\$3/);
    assert.ok(!/\$6/.test(timeframeClause(3)), 'position must not leak between calls');
  });
});
