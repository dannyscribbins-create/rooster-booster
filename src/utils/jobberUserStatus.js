// ─── THE JOBBER USER STATUS MARKER (Canvass-3.6b) ────────────────────────────
//
// RULING (Danny, 2026-09-17, Canvass-3.6): retired users must remain
// **SELECTABLE** — people leave, and their historical attribution still matters.
// **The marker informs; it never filters and never disables.** Nothing in this
// module returns a reason to hide or block a user, and nothing should be added
// that does.
//
// ── ⚠ NEUTRAL TO THE COPY, ON PURPOSE ──────────────────────────────────────
// Jobber's `UserStatusEnum` has FIVE values, introspected live 2026-09-17:
//   ACTIVATED · DEACTIVATED · NOT_INVITED · RESEND_INVITE · SEND_INVITE
// Only ACTIVATED means "a working account". ⚠ **THE OTHER FOUR ARE NOT ALL
// "RETIRED".** DEACTIVATED is a person who left; NOT_INVITED, SEND_INVITE and
// RESEND_INVITE describe someone who was never fully set up, which is a
// different fact about a different person.
//
// **So this module invents no buckets and collapses nothing.** It humanises the
// value Jobber sent and hands it back, except where a count has justified a
// friendlier word.
//
// ── ⚠ THE COUNTS LANDED (Danny, live account, 2026-09-17) ──────────────────
//   ACTIVATED 60 · DEACTIVATED 87 · sum 147 = totalCount.
// **ZERO users sit in NOT_INVITED, SEND_INVITE or RESEND_INVITE.** And Jobber's
// own `users` filter accepts **only** ACTIVATED and DEACTIVATED — the other
// three are rejected as invalid filter values, so **Jobber itself treats them as
// a different class**, which is independent corroboration rather than a second
// reading of the same fact.
//
// **So the standing note is discharged for DEACTIVATED ONLY**, which is now
// labelled in plain words. ⚠ **THE OTHER THREE KEEP THE PASSTHROUGH AND MUST NOT
// BE COLLAPSED INTO IT.** They are absent from *Accent's* account, not from
// *Jobber* — the moment another contractor has one, calling it "no longer
// active" would be wrong about a person who was never set up in the first place.
// ⚠ **AND THE TEST STAYS "IS IT ACTIVATED", NEVER "IS IT ONE OF THESE FOUR"**, so
// a value Jobber adds later is still marked rather than silently passing as a
// working account.

// The one value that means a live, working account. Everything else gets a
// marker — including values this enum may gain later, which is why the test is
// "is it ACTIVATED" and never "is it one of these four".
const ACTIVE_STATUS = 'ACTIVATED';

// ⚠ ONE ENTRY, AND THE SHAPE IS A MAP SO THE NEXT JUSTIFIED LABEL IS A LINE
// RATHER THAN A REWRITE — but an entry may only be added once a COUNT justifies
// it. DEACTIVATED earned its place: 87 of Accent's 147 users, the single largest
// bucket, and the state the retired-user ruling is actually about.
// ⚠ "No longer active" IS DELIBERATELY NEUTRAL. It says what Jobber says and
// nothing about why — not "retired" (which asserts a career event), not
// "removed" (which asserts someone did it to them). An admin mapping a former
// rep to historical work does not need an opinion, only a fact.
const FRIENDLY_LABELS = Object.freeze({
  DEACTIVATED: 'No longer active',
});

/**
 * The marker label for a Jobber user, or null when none should be drawn.
 *
 * @param {string|null|undefined} status - a raw `UserStatusEnum` value.
 * @returns {string|null} a humanised label, or null for an active user OR for a
 *          user whose status is unknown/absent.
 *
 * ⚠ ABSENT STATUS RETURNS null — "no marker", never "unknown". The route falls
 * back to a query WITHOUT `status` when the field is unavailable at our pinned
 * API version, so every user arrives status-less on that path. Rendering
 * "Unknown" against all 147 of them would be a UI full of noise describing our
 * own API version rather than anything about the people.
 */
export function jobberUserStatusLabel(status) {
  if (typeof status !== 'string') return null;
  const raw = status.trim();
  if (raw.length === 0) return null;
  const upper = raw.toUpperCase();
  if (upper === ACTIVE_STATUS) return null;

  // A justified label, where a count has earned one. Everything else falls
  // through to the passthrough below — which is what keeps the three
  // never-set-up values distinguishable instead of collapsed.
  if (FRIENDLY_LABELS[upper]) return FRIENDLY_LABELS[upper];

  // SCREAMING_SNAKE → Sentence case. A transformation, not a translation: the
  // value that reaches the screen is still the value Jobber sent, which is what
  // keeps this honest about states no count has spoken for.
  return raw
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Should this user carry a marker at all?
 *
 * ⚠ SEPARATE FROM THE LABEL BECAUSE "IS MARKED" AND "WHAT IT SAYS" ARE DIFFERENT
 * QUESTIONS, and the second is the one still open. A caller that only needs to
 * know whether to draw the pill should not have to reason about the string.
 */
export function isJobberUserMarked(status) {
  return jobberUserStatusLabel(status) !== null;
}
