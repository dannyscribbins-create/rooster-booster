'use strict';

// ── THE ASSIGNED DATE, IN ONE EXPRESSION (3d Phase 1b Commit 2) ──────────────
//
// R5f: `client_rep_assignments.assigned_at` means "when THIS rep first got this client". It
// changes IF AND ONLY IF the row's EFFECTIVE OWNER — COALESCE(sticky_rep_id,
// provisional_rep_id) — is a DIFFERENT rep after the statement than it was before it.
//
// ⚠ EVERY WRITER NEEDS THAT RULE AND NONE OF THEM MAY SPELL IT OUT. Six engine writes, two
// admin writes and the rebuild preview all have to agree; the repo's recorded failure is a
// fix landing in one copy. So the rule lives here, once, in two forms that a fence holds
// together — a SQL fragment the writers compose, and a JS predicate the preview uses.
//
// ⚠ TWO FORMS IS ONE MORE THAN I WANT, AND IT IS NOT REDUCIBLE. The writers decide inside a
// single INSERT ... ON CONFLICT, where the before-row is only reachable as
// `client_rep_assignments.*` against `EXCLUDED.*`; the preview decides in memory against a
// simulated row and must not touch the database at all. Neither can use the other's form.
// **What keeps them honest is assignedAtWriters.test.js's case table, which drives the SAME
// transitions through a real database write and through ownerWouldChange() and requires the
// same verdict.** Without that fence this file is two rules wearing one filename.

// ── THE FACT KINDS (R5h) ─────────────────────────────────────────────────────
// Each assignment records WHICH FACT produced it: the kind, the fact's own id, and that
// fact's own time.
//   'request'    — R5g. A Mode A or Mode B assignment, dated by the request's own created_at.
//                  ⚠ Mode A's real evidence is an ASSESSMENT, which has no stored timestamp
//                  anywhere; R5g rules the parent request's created_at and explicitly
//                  REJECTED storing the assessment time. The two can differ by hours on real
//                  data (see the measurement in routes/webhooks/jobber.js's request handler).
//                  That gap is accepted by the ruling, not overlooked.
//   'quote'      — dated by the quote's approved_at.
//   'manual'     — an admin's decision, whose own time IS the write time (Commit 3).
//   'write_time' — no stored fact time was available.
//
// ⚠ 'write_time' IS A KIND RATHER THAN A NULL BECAUSE THE BATCH RULING REQUIRES EVERY SUCH
// CASE "LISTED BY NAME". A column value IS that list, forever, with nobody maintaining a
// document: `WHERE assigned_fact_kind = 'write_time'` enumerates it.
// ⚠ AND NO REACHABLE WRITER NEEDS IT TODAY — stated here rather than discovered later. A
// quote is ineligible without an approvedAt (attributionEngine's isQuoteEligible), and
// crm_request_facts.created_at is NOT NULL, so every engine write has a fact time. The arm
// exists because the column is NOT NULL from Commit 4 and a future fact kind will need it.
// **An unreachable arm is an untested one; do not read a green suite as coverage of it.**
// Measured on production 2026-09-28: 0 rows carry 'write_time' and 0 rows are dateless.
const FACT_KINDS = Object.freeze({
  REQUEST: 'request',
  QUOTE: 'quote',
  MANUAL: 'manual',
  WRITE_TIME: 'write_time',
});

const ALL_FACT_KINDS = Object.freeze(Object.values(FACT_KINDS));

/**
 * Normalises a caller's fact into the four values a writer binds.
 * Input:  { kind, id, at } — any may be missing.
 * Output: { kind, id, at } where `at` null means "use the write clock".
 *
 * ⚠ A FACT WITH NO TIME BECOMES 'write_time', WHICH IS THE WHOLE SELF-ANNOUNCING MECHANISM.
 * A caller that passes a kind of 'request' but no time is not making a request-dated
 * assignment — it is making a write-time one, and the row must say so rather than claiming a
 * provenance it does not have. The id goes too: an id without its time cannot date anything.
 */
function normaliseFact(fact) {
  const at = fact && fact.at ? fact.at : null;
  if (!at) return { kind: FACT_KINDS.WRITE_TIME, id: null, at: null };
  const kind = fact.kind || FACT_KINDS.WRITE_TIME;
  if (!ALL_FACT_KINDS.includes(kind)) {
    // ⚠ THROWS RATHER THAN STORING AN UNKNOWN KIND. There is no CHECK constraint on the
    // column (a CHECK would have to admit NULL, and it cannot live in the migration file
    // that runs before the column exists), so this is the enforcement. A kind nobody
    // recognises in a provenance column is worse than no kind at all.
    throw new Error(`assignedAt: unknown fact kind '${kind}'`);
  }
  return { kind, id: fact.id != null ? String(fact.id) : null, at };
}

// The four columns the rule governs, in the order every writer binds them.
const ASSIGNED_COLUMNS = 'assigned_at, assigned_fact_kind, assigned_fact_id, assigned_fact_at';

/**
 * The SQL for the four assigned_* columns in an `ON CONFLICT ... DO UPDATE SET` list.
 *
 * `half` is which side the enclosing statement writes — 'sticky' or 'provisional'. That is
 * the ONLY thing that differs between the writers, and it differs in exactly one place: how
 * the owner AFTER the statement is spelled.
 *
 * ⚠ THE CONDITION IS BUILT ONCE AND EMITTED FOUR TIMES. SQL has no way to share it across
 * four assignments in one SET list, so the sharing happens here instead — which is the point
 * of the module. Four hand-written copies is four places for the rule to drift, inside the
 * one statement that is supposed to be its definition.
 *
 * ⚠ `IS NOT DISTINCT FROM`, NEVER `=`. `NULL = 5` is NULL, so an `=` comparison on a row
 * whose before-owner is NULL — a row left all-null by a rebuild, then re-assigned — makes the
 * CASE fall to ELSE. That happens to be the right answer in that one case and the wrong one
 * elsewhere, which is the "right for the wrong method" shape CLAUDE.md records: it would
 * survive every test that exercised only the case where it coincides.
 *
 * ⚠ THE PROVISIONAL FORM CONSULTS `sticky_rep_id`, AND THAT IS NOT DEFENSIVE PADDING. A row
 * with sticky A receiving a provisional B write has NOT changed hands — the sticky wins every
 * read (OWN_BOOK_PREDICATE is COALESCE(sticky, provisional)) — so its date must not move.
 * Comparing only the provisional halves would move it. The engine's step-3 short-circuit
 * makes that unreachable through the engine TODAY, and a writer that relies on its caller's
 * control flow is a guard resting on another function's current behaviour.
 */
function assignedAtSetClause(half) {
  if (half !== 'sticky' && half !== 'provisional') {
    throw new Error(`assignedAtSetClause: half must be 'sticky' or 'provisional', got '${half}'`);
  }
  const T = 'client_rep_assignments';
  const ownerBefore = `COALESCE(${T}.sticky_rep_id, ${T}.provisional_rep_id)`;
  const ownerAfter = half === 'sticky'
    ? `COALESCE(EXCLUDED.sticky_rep_id, ${T}.provisional_rep_id)`
    : `COALESCE(${T}.sticky_rep_id, EXCLUDED.provisional_rep_id)`;
  const sameOwner = `${ownerBefore} IS NOT DISTINCT FROM ${ownerAfter}`;

  const keepOrTake = (col) => `${col} = CASE WHEN ${sameOwner} THEN ${T}.${col} ELSE EXCLUDED.${col} END`;

  return [
    keepOrTake('assigned_at'),
    keepOrTake('assigned_fact_kind'),
    keepOrTake('assigned_fact_id'),
    keepOrTake('assigned_fact_at'),
  ].join(',\n       ');
}

/**
 * The JS twin of the condition above, for the rebuild preview, which decides in memory.
 * Inputs: the row as it stands (or null for no row), which half is being written, the
 *         incoming rep id.
 * Output: true when the effective owner CHANGES — i.e. when the date and the R5h triple move.
 *
 * ⚠ RETURNS TRUE FOR A ROW THAT DOES NOT EXIST, because none → somebody is a change and the
 * INSERT branch takes EXCLUDED unconditionally. Getting this wrong in the other direction
 * would make a preview report "no date change" for every newly-assigned client.
 */
function ownerWouldChange(beforeRow, half, newRepId) {
  if (half !== 'sticky' && half !== 'provisional') {
    throw new Error(`ownerWouldChange: half must be 'sticky' or 'provisional', got '${half}'`);
  }
  if (!beforeRow) return true;
  const sticky = beforeRow.sticky_rep_id == null ? null : beforeRow.sticky_rep_id;
  const provisional = beforeRow.provisional_rep_id == null ? null : beforeRow.provisional_rep_id;
  const incoming = newRepId == null ? null : newRepId;

  const before = sticky != null ? sticky : provisional;
  const after = half === 'sticky'
    ? (incoming != null ? incoming : provisional)
    : (sticky != null ? sticky : incoming);

  return before !== after;
}

module.exports = {
  FACT_KINDS,
  ALL_FACT_KINDS,
  ASSIGNED_COLUMNS,
  normaliseFact,
  assignedAtSetClause,
  ownerWouldChange,
};
