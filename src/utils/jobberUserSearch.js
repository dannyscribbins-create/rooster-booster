// ─── THE JOBBER USER PICKER'S SEARCH (Canvass-3.6) ───────────────────────────
//
// RULING (Danny, 2026-09-17): an admin must be able to select ANY existing
// Jobber user, including retired ones, and **the answer is SEARCH, not a longer
// dropdown** — 147 names, most of them former staff, is worse unpaged than
// paged.
//
// ⚠ THE BEHAVIOUR IS NOT NEW; THE FENCE IS. `AdminTeamSettings` already filtered
// on name and email with this exact expression, inline. It is extracted here for
// one reason: an inline ternary inside a 1200-line component is not something a
// test can reach without mounting the whole drawer, so the ruling's central
// property — *searchable by name AND by email* — had no assertion anywhere. A
// pure function has one. **No behaviour changed in the extraction**; the
// component now calls this instead of repeating it.
//
// ⚠ CLIENT-SIDE, AND THAT IS A DECISION MADE UNDER UNCERTAINTY RATHER THAN A
// PREFERENCE. Whether Jobber's `users` connection accepts a server-side search
// or filter argument **at our pinned version (2026-05-12)** could not be
// established: introspection needs a token, the local stack has zero, and
// calling the production account from a build environment is forbidden. The
// introspection query is filed on `PRE_LAUNCH_CHECKLIST.md` for a live run.
// Filtering a fully-paged list is the fallback the phase was told to take if
// server-side search is unavailable — and it is correct either way, because the
// route already fetches every user and caches them. If introspection later shows
// a search argument exists, this becomes an optimisation, not a correction.

/**
 * Filters a Jobber user list by a free-text query, matching NAME or EMAIL.
 *
 * @param {Array<{id: string, name?: {full?: string}, email?: {raw?: string}}>} users
 * @param {string} query - raw input; trimmed and lower-cased here, not by the caller.
 * @returns {Array} the matching users, in input order. An empty/blank query
 *          returns the list unchanged — the caller decides whether to render it.
 */
export function filterJobberUsers(users, query) {
  // ⚠ NOT `users || []` ALONE. A non-array (a failed fetch that set an object, a
  // null from a 502 body) would reach `.filter` and throw inside render, which
  // on this surface means a blank drawer rather than an error message.
  if (!Array.isArray(users)) return [];

  const q = String(query ?? '').trim().toLowerCase();
  if (q.length === 0) return users;

  return users.filter((u) => {
    // Both sides are optional in Jobber's payload — a user with no email is
    // real, and `u.email.raw` on such a row is undefined. Coercing to '' keeps
    // this a match question rather than a crash question.
    const name = (u?.name?.full || '').toLowerCase();
    const email = (u?.email?.raw || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });
}
