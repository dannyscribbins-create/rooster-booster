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
      console.log(
        `[redecideStaleClients] ${contractorId}: eligible ${summary.considered}, `
        + `decided ${summary.redecided}, changed ${summary.stageChanged}, `
        + `failed ${summary.failed.length}, skipped-partial ${summary.skippedPartial}, `
        + `beyond limit ${summary.remaining} (${summary.elapsedMs}ms)`
      );
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
