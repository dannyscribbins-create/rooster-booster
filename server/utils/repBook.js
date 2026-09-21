'use strict';

// ─── THE OWN-BOOK PREDICATE, IN ONE PLACE (Canvass-6) ───────────────────────
//
// "Which clients belong to this rep" was written out THREE times in
// server/routes/rep.js before this file existed — the list, the list's count, and
// the detail route — and Home would have made it four or five.
//
// ⚠ THE RISK IS NOT REPETITION, IT IS DIVERGENCE. A fix landing in one copy and
// not the others produces a rep who sees one book on the Clients tab, a different
// count beside it, and a third answer when they tap a row. Every one of those
// screens would look correct on its own; only using two of them together reveals
// it, which is the kind of defect that ships.
//
// ⚠ PARAMETER POSITIONS ARE PART OF THE CONTRACT: $1 IS THE CONTRACTOR, $2 IS THE
// TEAM MEMBER, AND THE TABLE MUST BE ALIASED `cra`. Every existing call site already
// used exactly that shape, which is why this extraction changes no SQL semantics —
// it was verified by running the full suite before and after rather than assumed.
// A caller needing different positions must NOT re-order these; add a variant with
// its own name, so a silently mis-bound parameter is impossible.
//
// ── ⚠ AND THE CONDITION DANNY ATTACHED TO THIS EXTRACTION, RECORDED AT THE SITE ──
// Sharing a predicate means one bug in it passes every screen's tests AT ONCE — the
// "guards agreeing is not evidence when they share an input" failure, arriving as a
// refactor. So the tests deliberately do NOT all reduce to "the helper was called".
// **These assert the RESULT — this rep sees these clients and not those — per screen:**
//   · repClients.test.js  "a SAME-CONTRACTOR colleague's client is absent"        (list)
//   · repClients.test.js  "A34.8 — all THREE not-in-my-book cases … 404"          (detail)
//   · repClients.test.js  "Home — Today's Focus contains only this rep's clients" (home)
//   · repClients.test.js  "a MIS-TENANTED assignment row does not leak"           (tenancy)
// Each seeds a client belonging to someone else and asserts it is absent from that
// screen's own output. Do not collapse them into one shared assertion.
//
// ⚠ AND THE TWO HALVES OF THIS PREDICATE ARE FENCED BY DIFFERENT TESTS, WHICH WAS
// MEASURED RATHER THAN ASSERTED — THIS COMMENT FIRST CLAIMED ALL FOUR CASES CAUGHT
// BOTH HALVES, AND A GUARD-PROOF SHOWED THAT WAS FALSE.
//   · Breaking the **rep-id** half takes the list, detail and home result assertions
//     red INDEPENDENTLY — measured, 5 failures across three screens. That is the
//     per-screen coverage this extraction is conditioned on.
//   · Breaking the **contractor** half takes **only** the mis-tenanted case red —
//     measured, exactly 1 failure. The other three cannot see it, because
//     `team_members.id` is globally unique, so the rep-id filter ALREADY excludes an
//     ordinary cross-tenant row. The case that needs the contractor clause is a row
//     naming one tenant while pointing at another tenant's rep, which the schema
//     permits and Canvass-4b added a fixture for.
// **Both halves are covered; they are simply not covered by the same tests.** Deleting
// the mis-tenanted case would silently unfence the contractor clause.
const OWN_BOOK_PREDICATE = `cra.contractor_id = $1
         AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = $2`;

// ── THE PIPELINE ORDER, FOR "FURTHEST ALONG" (A34.5 / CD-10) ────────────────
//
// Ruling ④ (Danny, 2026-09-18): Today's Focus is TWO sections — "Furthest along"
// over clients that HAVE a stage, and "Recently assigned" over the rest. Neither
// label borrows the other's ordering, and neither implies the other.
//
// ⚠ THE RANK IS THE PIPELINE VOCABULARY'S OWN ORDER, NOT A JUDGEMENT ABOUT WHO IS
// WORTH CALLING. lead → inspection → sold → paid is the progression this codebase
// keeps resident; `not_sold` is a terminal negative and ranks LAST rather than being
// excluded, because the section's claim is "furthest along" and a not-sold client is
// least far along — excluding it would make the label true by hiding its counterexample.
// ⚠ 'paid' RANKS HIGHEST AND THAT IS THE LITERAL READING OF THE RULING. A completed
// client is arguably not a "focus" at all; that observation is FILED rather than acted
// on, because re-ordering the ruling's own words on a hunch is how a label stops
// matching its rows.
// ⚠ RE-POINTED AT jobber_clients IN CANVASS-STAGE (Ruling 1). It read
// `CASE pc.pipeline_status` — the referral-only table — which is why only referred
// clients could ever be ranked. The five values and their order are UNCHANGED; only
// the column moved. ⚠ The rank must be computed from the SAME column the payload
// ships as `stage`, or a row would sort by one value and display another.
const STAGE_RANK_SQL = `CASE jc.pipeline_stage
           WHEN 'paid'       THEN 4
           WHEN 'sold'       THEN 3
           WHEN 'inspection' THEN 2
           WHEN 'lead'       THEN 1
           WHEN 'not_sold'   THEN 0
           ELSE -1
         END`;

// ─── THE TIMEFRAME WINDOW (Canvass-9a, Parts 3b / 4b) ───────────────────────
//
// The rep's Home and Clients screens carry a week/month/year/all selector. It lives
// here for the same reason OWN_BOOK_PREDICATE does: the window is applied by FIVE
// separate statements across two routes — Home's stats, Home's conversions, the
// list, the list's total, and the list's locked/provisional split — and five copies
// of "what does 'this week' mean" is five things to get out of step.
//
// ⚠ AND THE DIVERGENCE HERE WOULD BE INVISIBLE RATHER THAN LOUD: a stat card and the
// list beneath it computing slightly different windows both look completely correct
// on their own. Only adding them up reveals it, which nobody does.

// ⚠ `all` IS THE ABSENCE OF A PREDICATE, NOT A VERY LARGE WINDOW. A sentinel date —
// "1970", "100 years ago" — would silently DROP any assignment whose date columns are
// both NULL, because `NULL >= anything` is NULL. The absence of a clause cannot.
const TIMEFRAME_DAYS = Object.freeze({ week: 7, month: 30, year: 365 });

/**
 * Normalise the client's `?timeframe=` into a window start.
 *
 * ⚠ AN UNRECOGNISED VALUE FALLS BACK TO `all`, WHICH IS THE WIDEST WINDOW, AND THAT
 * DIRECTION IS THE WHOLE REASON THIS DOES NOT 400. A bad cursor DOES 400 on this
 * route, because silently restarting at page 1 would make a corrupted cursor look
 * like the end of the book — it HIDES rows. A bad timeframe falling back to `all`
 * can only ever show MORE rows than asked for, never fewer, so it cannot hide
 * anything; and it reproduces the pre-parameter behaviour exactly, which is what
 * keeps a client that sends nothing working unchanged.
 *
 * ⚠ ONE `Date` FOR THE WHOLE REQUEST, COMPUTED HERE AND PASSED TO EVERY STATEMENT —
 * deliberately NOT `NOW()` inside each query. Five statements each calling `NOW()`
 * would each get a different instant, so a row created mid-request could land inside
 * the list's window and outside the count's. The numbers would disagree, rarely and
 * unreproducibly, which is the worst kind.
 *
 * @param {unknown} raw - req.query.timeframe
 * @returns {{key: 'week'|'month'|'year'|'all', since: Date|null}}
 */
function parseTimeframe(raw) {
  const key = Object.prototype.hasOwnProperty.call(TIMEFRAME_DAYS, raw) ? raw : 'all';
  if (key === 'all') return { key: 'all', since: null };
  return { key, since: new Date(Date.now() - TIMEFRAME_DAYS[key] * 24 * 60 * 60 * 1000) };
}

// ── THE CLAUSE, OVER THE ASSIGNMENT DATE ────────────────────────────────────
//
// ⚠ IT WINDOWS ON WHEN THE ASSIGNMENT HAPPENED — `COALESCE(sticky_set_at,
// provisional_set_at)`, the same expression the list already sorts and displays as
// "Assigned Sep 15". So "this week" means what the row itself says, and a rep can
// check the filter against the dates in front of them. Windowing on `updated_at`
// instead would be defensible and unverifiable: a row touched by a sync would drift
// into "this week" while displaying an assignment date from March.
//
// ⚠ INERT WHEN THE PARAMETER IS NULL, exactly like the keyset clause above, so `all`
// and a window run the SAME statement rather than two assembled variants. A route
// that concatenates a clause conditionally has two shapes and tests one.
//
// ⚠ A ROW WITH NO ASSIGNMENT DATE AT ALL IS EXCLUDED FROM EVERY WINDOW AND INCLUDED
// IN `all`. That is correct rather than convenient: `NULL >= x` is NULL, and a row
// whose date we do not know cannot be claimed to fall inside a named window. It is
// also not hypothetical — the seeded fixture carries an assignment with no client
// mirror row, and the schema does not require either date column.
//
// @param {number} n - the 1-based parameter position holding the window start
// @returns {string} a SQL fragment beginning with AND
function timeframeClause(n) {
  return `AND ($${n}::timestamptz IS NULL
              OR COALESCE(cra.sticky_set_at, cra.provisional_set_at) >= $${n}::timestamptz)`;
}

module.exports = {
  OWN_BOOK_PREDICATE,
  STAGE_RANK_SQL,
  TIMEFRAME_DAYS,
  parseTimeframe,
  timeframeClause,
};
