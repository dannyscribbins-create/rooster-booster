const crypto = require('crypto');
const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');

// ── CRON JOB LOCKING (owner-checked since 3d Phase 1a Commit 7a-3) ───────────
//
// ⚠ THE RELEASE USED TO BE UNCONDITIONAL, AND THAT MADE THE LOCK WORSE THAN NONE IN ONE CASE.
// The `finally` cleared the row by job_name alone, so a run that had already LOST its lock to the
// timeout still cleared it — releasing a lock a DIFFERENT run was holding. The sequence, which
// pipeline_sync could reach on any catch-up sweep:
//   T+0    sweep A acquires, timeout_at = T+10
//   T+10   A is still working; its lock is now takeable by anyone
//   T+30   tick fires, sweep B acquires (timeout_at < NOW() is true) — TWO SWEEPS RUNNING
//   T+35   A finishes and clears the row — B now holds nothing
//   T+60   tick fires, sweep C acquires while B still runs — and so on
// Two sweeps on one contractor both fetch and both write; nothing coordinates them, and
// pipelineSync's attribution engine is not inside the per-client advisory lock.
//
// ⚠ THE OWNER TOKEN IS THE LOAD-BEARING HALF, NOT THE LONGER EXPIRY. No expiry can be proven
// large enough — a catch-up sweep after an outage is unbounded in principle — so the number
// reduces how OFTEN a takeover happens while the owner check makes a takeover SAFE when it does.
// `locked_by` has existed on cron_job_locks since the table was created and was never written;
// this is what it was for.
//
// ⚠ IT APPLIES TO ALL EIGHT CRON JOBS, NOT JUST pipeline_sync. The defect is in the shared helper,
// so fixing it here fixes session_cleanup, admin_cache_expiry, engagement_cadence,
// dynamic_audiences, post_job_sequence, jobber_incremental_sync and rep_request_sweep too. Stated
// because a change to a shared utility has a blast radius, and this one is deliberate.

async function withLock(jobName, timeoutMinutes, fn) {
  // A per-run identity. Random rather than pid/hostname because a rolling deploy can run two
  // instances with the same image, and a restarted process must not inherit its own old identity.
  const owner = crypto.randomBytes(16).toString('hex');

  const result = await pool.query(`
    UPDATE cron_job_locks
    SET is_locked = TRUE,
        locked_at = NOW(),
        locked_by = $3,
        timeout_at = NOW() + ($2 || ' minutes')::interval
    WHERE job_name = $1
      AND (is_locked = FALSE OR timeout_at < NOW())
    RETURNING job_name
  `, [jobName, timeoutMinutes, owner]);

  if (result.rowCount === 0) {
    console.log(`[cron] ${jobName} skipped — already running`);
    return;
  }

  console.log(`[cron] ${jobName} started at ${new Date().toISOString()}`);

  try {
    await fn();
    console.log(`[cron] ${jobName} completed at ${new Date().toISOString()}`);
  } catch (err) {
    logError({ error: err, source: `cron:${jobName}` });
  } finally {
    // ⚠ `AND locked_by = $2` IS THE WHOLE FIX. A run that lost its lock to the timeout clears
    // NOTHING, so the run that took it over keeps it. A zero-row result here is therefore a
    // meaningful event rather than an anomaly: it means this run overran its own expiry and
    // something else is now the owner.
    const released = await pool.query(`
      UPDATE cron_job_locks
      SET is_locked = FALSE,
          locked_at = NULL,
          locked_by = NULL,
          timeout_at = NULL
      WHERE job_name = $1
        AND locked_by = $2
    `, [jobName, owner]);

    if (released.rowCount === 0) {
      // ⚠ LOGGED, BECAUSE AN OVERRUN THAT LEAVES NO TRACE IS HOW A 10-MINUTE EXPIRY SURVIVED ON A
      // 30-MINUTE TICK. This is the only signal that the expiry is too short for the real work,
      // and it is the number to read before changing the expiry again.
      await logError({
        req: null,
        error: new Error(`cron:${jobName} overran its lock expiry — another run owns the lock now, `
          + 'so this run released nothing. The expiry is too short for the work, or this run hung.'),
        source: `cron:${jobName} — lock overrun`,
        alert: false,
      }).catch(() => { /* never let the lock bookkeeping mask a job's own failure */ });
      console.warn(`[cron] ${jobName} overran its lock — released nothing`);
    }
  }
}

module.exports = { withLock };
