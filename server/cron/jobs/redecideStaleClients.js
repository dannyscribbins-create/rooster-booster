'use strict';

// ── THE CATCH-UP CRON (Danny approved registering it, 2026-10-01) ─────────────
//
// Runs `server/jobs/redecideStaleClients.js` for every active contractor, every 30 minutes.
//
// ⚠ DANNY APPROVED REGISTRATION *BECAUSE* ELIGIBILITY IS 0 TODAY. `last_full_capture_at` is never
// backfilled, so on the day this ships the job finds nothing, and its population grows only as real
// full captures run. That is what makes scheduling it safe rather than a gamble: the first runs cannot
// move a stage because no client is yet certified complete.
//
// ⚠ NO JOBBER CALL, EVER — and that is fenced rather than promised. The underlying job reads saved
// facts and writes a derived stage; `server/test/` scans this file and the job for `axios` and for
// every Jobber fetcher by name. So the cost of a run is database work, not API budget, which is why a
// 30-minute cadence is affordable at all.
//
// ⚠ THE PER-RUN LIMIT IS 200, AND THE ARITHMETIC IS WRITTEN DOWN RATHER THAN ASSERTED:
//   · STEADY STATE. Measured on `accent-roofing-dev`: ~58 distinct clients receive a fact capture per
//     24 hours. At 48 runs a day that is ~1.2 newly-eligible clients per run, so 200 is ~166x the
//     expected load — the limit is a ceiling, not a throttle we sit against.
//   · COST PER CLIENT. Measured: 3,269 derivations took 130s at concurrency 8, i.e. ~0.32s of
//     database work each. 200 clients is therefore ~64s per run, serially.
//   · IT FITS INSIDE THE LOCK AND THE TICK. 64s is well under both the 25-minute lock expiry and the
//     30-minute interval, so a full run cannot still be holding the lock when the next tick arrives.
//   · AND IT DRAINS A BULK RE-CAPTURE IN DAYS, NOT WEEKS. 200 x 48 = 9,600 clients a day, so even if
//     every one of this tenant's 19,598 clients were fully captured at once, the backlog clears in
//     about two days — with each run reporting what it did not reach.
//
// ⚠ THE EXPIRY IS 25 MINUTES AGAINST A 30-MINUTE TICK, WHICH IS THE pipeline_sync PRECEDENT AND NOT A
// GUESS. An expiry LONGER than the interval lets a second run start while the first holds the lock;
// an expiry shorter than the interval means a crashed holder self-heals on the very next tick. That
// asymmetry is exactly what the cron-lock-owner commit was written for, and `withLock` already scopes
// its release to a per-run owner token so a slow run cannot release a lock it no longer holds.

const cron = require('node-cron');
const { withLock } = require('../withLock');
const { pool } = require('../../db');
const { logError } = require('../../middleware/errorLogger');
const { runRedecideStaleClients, DEFAULT_LIMIT } = require('../../jobs/redecideStaleClients');
const { formatCreditTally } = require('../../utils/creditReasonTally');

const PER_RUN_LIMIT = 200;
const LOCK_NAME = 'redecide_stale_clients';
const LOCK_EXPIRY_MINUTES = 25;

/**
 * Re-decides stale clients for every active contractor.
 * Inputs: none (reads the contractor list). Output: an array of per-contractor summaries.
 *
 * ⚠ ONE CONTRACTOR'S FAILURE NEVER STOPS THE OTHERS, and each failure ALERTS. A catch-up that goes
 * quiet is indistinguishable from a catch-up with nothing to do — which is the whole reason the
 * $3-cast regression ran for three hours at INFO.
 */
async function runRedecideStaleClientsCron() {
  const { rows: contractorRows } = await pool.query(
    'SELECT id FROM contractors WHERE status = $1',
    ['active']
  );

  const summaries = [];
  for (const { id: contractorId } of contractorRows) {
    try {
      const summary = await runRedecideStaleClients(pool, {
        contractorId,
        limit: PER_RUN_LIMIT,
      });
      summaries.push(summary);
      // diagnostic log — intentional
      //
      // ⚠ `credited` IS ON THIS LINE BECAUSE IT WAS MISSING AND THAT MADE THE CREDIT INVISIBLE. C1 added
      // `summary.credited` and `formatSummary()` prints a CREDITED row — but this cron does not call
      // `formatSummary`, it builds its own line, and the counter was never added here. So a credit made
      // by the catch-up left no log evidence at all, and the 2026-10-02 live check had to be answered
      // from the database instead. **A counter nothing prints is not observability.**
      console.log(
        `[redecideStaleClients] ${contractorId}: eligible ${summary.considered}, `
        + `decided ${summary.redecided}, changed ${summary.stageChanged}, `
        + `credited ${summary.credited}, `
        + `failed ${summary.failed.length}, skipped-partial ${summary.skippedPartial}, `
        + `beyond limit ${summary.remaining} (${summary.elapsedMs}ms)`
      );

      // ⚠ ONE AGGREGATED LINE, AND ONLY WHEN THERE IS SOMETHING TO SAY. The refusal reasons are what
      // turn "credited 0" from a number into a diagnosis — `referrer_not_found 14` and
      // `invoice_not_paid 3` call for completely different actions. Skipped entirely when no client
      // reached the credit, because an empty `credit outcomes:` line reads as "the credit ran and found
      // nothing", which is a different and false claim.
      // ⚠ NEVER ONE LINE PER CLIENT: the run is bounded at 200 and the full sync iterates ~19,600, so
      // per-client logging would bury the summary it exists to surface.
      const creditLine = formatCreditTally(summary.creditReasons);
      if (creditLine) {
        // diagnostic log — intentional
        console.log(`[redecideStaleClients] ${contractorId}: credit outcomes — ${creditLine}`);
      }
      // ⚠ A PER-CLIENT FAILURE ALERTS AT THE RUN LEVEL, not only in the job's own per-client log.
      // The job records each one with alert:false so one bad client cannot storm the inbox; this is
      // the single summary alert that makes a persistent problem visible.
      if (summary.failed.length > 0) {
        await logError({
          req: null,
          contractorId,
          error: new Error(
            `[redecideStaleClients] ${summary.failed.length} client(s) failed to re-decide: `
            + summary.failed.map((f) => f.id).join(', ')
          ),
          source: 'redecideStaleClients — run',
          alert: true,
        });
      }
    } catch (err) {
      await logError({
        req: null,
        contractorId,
        error: err,
        source: 'redecideStaleClients — contractor',
        alert: true,
      });
    }
  }
  return summaries;
}

function startRedecideStaleClientsJob() {
  // Every 30 minutes at :10 and :40 — deliberately off both the top of the hour (pipeline_sync) and
  // :20 (repRequestSweep), so three jobs do not contend for the same connections.
  cron.schedule('10,40 * * * *', () => withLock(LOCK_NAME, LOCK_EXPIRY_MINUTES, async () => {
    await runRedecideStaleClientsCron();
  }));
  // diagnostic log — intentional
  console.log('[cron] redecideStaleClients registered (every 30 min at :10 and :40)');
}

module.exports = {
  startRedecideStaleClientsJob,
  // test seams — inert in production, never called outside server/test/
  runRedecideStaleClientsCron,
  PER_RUN_LIMIT,
  LOCK_NAME,
  LOCK_EXPIRY_MINUTES,
  DEFAULT_LIMIT,
};
