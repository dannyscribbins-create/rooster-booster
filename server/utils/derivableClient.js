'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 2 — ONE PREDICATE FOR "MAY THIS CLIENT'S STATUS BE DERIVED FROM FACTS?"
//
// Danny ruling 9, 2026-09-29: `'app_user'` is excluded from derivation entirely.
//
// ⚠ THE RULING SAYS `'app_user'`, AND THE PREDICATE IS DELIBERATELY WIDER THAN THAT WORD.
// `pipeline_cache` holds rows for clients that have no Jobber client at all:
//   · `app_user_<userId>` placeholders, written at signup so an app user appears in a
//     referrer's network before the CRM has ever seen them;
//   · synthetic ids from earlier testing (`test-client-002` is live in production today).
// A predicate matching the literal `'app_user'` would let the second kind through, and a
// predicate matching the STATUS rather than the ID would miss a placeholder whose status had
// been changed by anything. **The question is not "what is this row's status" — it is
// "is there a Jobber client behind this id at all", and that is what is checked.**
//
// ⚠ WHY IT MATTERS, STATED AS THE FAILURE IT PREVENTS. A client with no Jobber id has no
// facts by construction, so `decideFromFacts` returns `'lead'` for it — the classifier's
// first branch, reached because every fact list is empty. That is not a derivation; it is
// the default wearing a derivation's clothes, and it is CLAUDE.md's vacuity shape #12
// arriving in production data rather than in a test. Measured 2026-09-29 on
// `accent-roofing-dev`: the four non-derivable `pipeline_cache` rows carry **zero rows in
// every one of `crm_quote_facts`, `crm_job_facts`, `crm_request_facts`, `client_sales` and
// `client_rep_assignments`** — so all four would derive `'lead'`, and three of them would
// lose the `'app_user'` status that is the only true thing known about them.
//
// ⚠ MEASURED AGAINST PRODUCTION BEFORE BEING WRITTEN, NOT AFTER. Every one of the **19,565**
// `jobber_clients` rows across both contractors satisfies this predicate — **zero** false
// negatives — and the only rows it rejects anywhere are the three `app_user_*` placeholders
// and the one synthetic test row. A predicate that silently excluded real clients would be
// the dangerous direction, so that is the direction that was measured.
//
// ⚠ AND IT MUST NEVER BE APPLIED TO THE LEDGER. One `referral_conversions` row in production
// is keyed on a non-derivable id (`test-client-002`, $500). This predicate answers "may a
// STATUS be derived", not "is this row real" — filtering money by it would silently drop a
// booked conversion. Use it on derivation paths only.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The prefix every Jobber client EncodedId decodes to.
 * ⚠ Exported so a test can assemble its fixtures from the real thing rather than from a
 * literal typed twice — a fixture that hardcodes its own expectation cannot notice the
 * production value changing underneath it.
 */
const JOBBER_CLIENT_GID_PREFIX = 'gid://Jobber/Client/';

/**
 * Is there a real Jobber client behind this id?
 * Input: anything. Output: boolean — never throws.
 *
 * ⚠ BOTH BASE64 ALPHABETS ARE ACCEPTED, AND THE DIRECTION OF THAT CHOICE IS THE POINT.
 * Jobber returns standard base64 (`+/` with `=` padding) today, verified against all 19,565
 * stored ids. Accepting the URL-safe alphabet (`-_`) as well can only ever admit MORE real
 * clients, never fewer — and the decisive check is the decoded prefix, which a non-client id
 * cannot satisfy by accident. **A predicate that excludes a real client is silent and
 * permanent; one that admits a stray string fails loudly at the next query.** Chosen for the
 * failure mode, not for strictness.
 *
 * ⚠ THE ROUND-TRIP CHECK IS NOT BELT-AND-BRACES. Node's base64 decoder is LENIENT: it
 * silently discards characters outside the alphabet rather than refusing, so
 * `Buffer.from('app_user_10', 'base64')` yields bytes rather than an error. Without the
 * round-trip, a malformed id could decode to something that happens to start with the
 * prefix. Re-encoding and comparing is what makes the answer canonical.
 */
function isDerivableJobberClientId(id) {
  if (typeof id !== 'string' || id.length === 0) return false;

  const normalised = id.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalised)) return false;
  if (normalised.length % 4 !== 0) return false;

  let decoded;
  try {
    decoded = Buffer.from(normalised, 'base64').toString('utf8');
  } catch {
    return false;
  }
  if (Buffer.from(decoded, 'utf8').toString('base64') !== normalised) return false;

  return decoded.startsWith(JOBBER_CLIENT_GID_PREFIX);
}

/**
 * Throw unless this id may have its status derived from saved facts.
 * Inputs: the id, and a short context string naming the caller for the message.
 * Output: nothing.
 *
 * ⚠ A THROW, NOT A QUIET SKIP, AND THAT IS DELIBERATE. This is a programmer-error guard in
 * the same family as `decideFromFacts`'s existing two preconditions: a caller that reaches it
 * has failed to filter, and returning `'lead'` instead would be the silent wrong answer this
 * whole module exists to prevent. **Callers that iterate a mixed population filter FIRST,
 * with `isDerivableJobberClientId` or the SQL below — they do not catch this.**
 */
function assertDerivableJobberClientId(id, context) {
  if (!isDerivableJobberClientId(id)) {
    throw new Error(
      `${context}: ${JSON.stringify(id)} is not a Jobber client id, so its status cannot be `
      + 'derived from saved facts. Filter the population with isDerivableJobberClientId() '
      + 'or derivableClientIdSql() before calling.'
    );
  }
}

/**
 * The same predicate as a SQL fragment, for filtering a population in the database.
 * Input: a column EXPRESSION (`'jobber_client_id'`, `'pc.jobber_client_id'`).
 * Output: a boolean SQL expression.
 *
 * ⚠ THE ARGUMENT IS AN IDENTIFIER AND IS VALIDATED AS ONE. It is interpolated, because a
 * column name cannot be a bound parameter — so it is checked against a strict pattern and
 * refused otherwise. **Never pass a user-supplied value here**; the validation exists so that
 * a mistake fails at the call site rather than becoming an injection point.
 *
 * ⚠ THE `length % 4` TEST COMES BEFORE `decode()` FOR A REASON. Postgres `decode(..., 'base64')`
 * RAISES on malformed input rather than returning null, so a row with a short id would abort
 * the whole statement. `AND` short-circuits left to right here, which keeps the filter a
 * filter instead of an error.
 */
function derivableClientIdSql(columnExpression) {
  if (typeof columnExpression !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(columnExpression)) {
    throw new Error(
      `derivableClientIdSql: ${JSON.stringify(columnExpression)} is not a plain column `
      + 'identifier. This value is interpolated into SQL and must never be user-supplied.'
    );
  }
  return `(${columnExpression} ~ '^[A-Za-z0-9+/]+={0,2}$'`
    + ` AND length(${columnExpression}) % 4 = 0`
    + ` AND convert_from(decode(${columnExpression}, 'base64'), 'UTF8')`
    + ` LIKE '${JOBBER_CLIENT_GID_PREFIX}%')`;
}

module.exports = {
  JOBBER_CLIENT_GID_PREFIX,
  isDerivableJobberClientId,
  assertDerivableJobberClientId,
  derivableClientIdSql,
};
