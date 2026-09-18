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
// value Jobber sent and hands it back. The label decision waits on a count of
// how Accent's 147 users actually distribute across the five — filed on
// `PRE_LAUNCH_CHECKLIST.md` with the query — because naming a bucket that turns
// out to be empty is how a UI acquires vocabulary nobody needed, and naming four
// different states "Retired" would be wrong about three of them.
//
// ⚠ DO NOT ADD A MAP FROM THESE VALUES TO FRIENDLIER WORDS UNTIL THOSE COUNTS
// EXIST. That is the decision this module is deliberately not making.

// The one value that means a live, working account. Everything else gets a
// marker — including values this enum may gain later, which is why the test is
// "is it ACTIVATED" and never "is it one of these four".
const ACTIVE_STATUS = 'ACTIVATED';

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
  if (raw.toUpperCase() === ACTIVE_STATUS) return null;

  // SCREAMING_SNAKE → Sentence case. A transformation, not a translation: the
  // value that reaches the screen is still the value Jobber sent, which is what
  // keeps this neutral to the copy decision.
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
