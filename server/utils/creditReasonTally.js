'use strict';

// ── CREDIT VISIBILITY — ONE AGGREGATED LINE PER RUN (Danny, 2026-10-02) ───────
//
// ⚠ THE DEFECT THIS CLOSES: THE CREDIT WAS INVISIBLE IN PRODUCTION LOGS, IN BOTH DIRECTIONS.
// `runRedecideStaleClients` has maintained a `credited` counter since C1 and `formatSummary()` prints a
// `CREDITED` row — but the cron does not call `formatSummary`; it builds its own line, and C1 added the
// counter without adding it there. So a credit made by the catch-up left no log evidence at all.
// ⚠ AND NEITHER DID ITS ABSENCE. `creditReferralFromFacts` RETURNS a reason and no caller logged it, so
// a client persistently refused — `referrer_not_found`, `client_created_at_unknown`, `no_job_type_found`
// — was indistinguishable from a client nobody looked at. **That is the silent-gate shape on the money
// path, in the observability layer rather than in the logic**, and it is why the 2026-10-02 live check
// had to be answered from the database rather than from the logs.
//
// ⚠ ONE AGGREGATED LINE, NEVER ONE PER CLIENT, AND THAT IS THE WHOLE DESIGN CONSTRAINT. The catch-up is
// bounded at 200 clients a run and the full sync iterates ~19,600; a per-client line would bury the
// summary it is supposed to make visible, and this repo already records that a log nobody can read is
// the same as no log. A tally is O(distinct reasons), which is a handful.
//
// ⚠ AND IT IS A TALLY RATHER THAN A SAMPLE. "3 clients hit referrer_not_found" is actionable; "client
// X hit referrer_not_found" invites chasing one row and missing that it is thirty. Client ids are
// deliberately NOT logged: they are data about real people, and the aggregate answers the question.

/**
 * Accumulates credit outcomes into a reason tally.
 * Inputs: the tally object to mutate, and a credit outcome (or null).
 * Output: nothing — the tally is mutated in place.
 *
 * ⚠ A NULL OUTCOME IS NOT A REASON AND IS NOT COUNTED. The credit is not attempted at all for a client
 * with no contractor, or on a path that returned before reaching it; counting those as a refusal would
 * inflate every tally with clients the engine never saw and make the numbers mean nothing.
 * ⚠ AND A SUCCESSFUL CREDIT IS COUNTED UNDER `credited` RATHER THAN BEING LEFT OUT, so the tally's own
 * total reconciles against the number of clients the run actually put through the credit.
 */
function tallyCreditOutcome(tally, outcome) {
  if (!tally || !outcome) return;
  // ⚠ THE `outcome.credited` BRANCH IS REDUNDANT TODAY, AND A GUARD-PROOF MEASURED IT AT WIDTH 0.
  // `creditReferralFromFacts` sets `reason: conversion.inserted ? 'credited' : …`, so a successful
  // outcome's reason is ALREADY the literal `'credited'` and reading the reason alone reaches the same
  // key. **It is kept deliberately rather than simplified away**: it reads the field that MEANS "a row
  // was inserted" instead of depending on one reason string happening to spell it, so a reword of that
  // string cannot silently move successes into a refusal bucket.
  // ⚠ SAID HERE BECAUSE A READER WOULD OTHERWISE "TIDY" IT, and the width-0 measurement is exactly the
  // evidence that would make tidying look safe.
  const key = outcome.credited ? 'credited' : (outcome.reason || 'unknown');
  tally[key] = (tally[key] || 0) + 1;
}

/**
 * Formats a tally as one line's worth of text, or null when there is nothing to say.
 * Input: the tally object. Output: a string like `credited 1, referrer_not_found 3`, or null.
 *
 * ⚠ IT RETURNS null FOR AN EMPTY TALLY SO THE CALLER CAN SKIP THE LINE ENTIRELY. A run that put no
 * client through the credit should print nothing rather than an empty `credit outcomes:` line, which
 * reads as "the credit ran and found nothing" — a different and false claim.
 * ⚠ `credited` IS FORCED FIRST, then the refusals by DESCENDING count. The one number a reader is
 * looking for should not move around between runs depending on how the refusals happen to sort.
 */
function formatCreditTally(tally) {
  if (!tally) return null;
  const keys = Object.keys(tally);
  if (keys.length === 0) return null;
  const parts = [];
  if (tally.credited) parts.push(`credited ${tally.credited}`);
  const rest = keys.filter((k) => k !== 'credited')
    .sort((a, b) => (tally[b] - tally[a]) || a.localeCompare(b));
  for (const k of rest) parts.push(`${k} ${tally[k]}`);
  // ⚠ A ZERO `credited` IS STATED EXPLICITLY WHEN ANYTHING ELSE HAPPENED. "credited 0" is the answer
  // to the question a reader is actually asking, and leaving it out makes its absence ambiguous
  // between "nobody was credited" and "this line does not report credits".
  if (!tally.credited && parts.length > 0) parts.unshift('credited 0');
  return parts.join(', ');
}

module.exports = { tallyCreditOutcome, formatCreditTally };
