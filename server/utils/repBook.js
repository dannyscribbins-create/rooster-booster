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
const STAGE_RANK_SQL = `CASE pc.pipeline_status
           WHEN 'paid'       THEN 4
           WHEN 'sold'       THEN 3
           WHEN 'inspection' THEN 2
           WHEN 'lead'       THEN 1
           WHEN 'not_sold'   THEN 0
           ELSE -1
         END`;

module.exports = { OWN_BOOK_PREDICATE, STAGE_RANK_SQL };
