const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');

async function withLock(jobName, timeoutMinutes, fn) {
  const result = await pool.query(`
    UPDATE cron_job_locks
    SET is_locked = TRUE,
        locked_at = NOW(),
        timeout_at = NOW() + ($2 || ' minutes')::interval
    WHERE job_name = $1
      AND (is_locked = FALSE OR timeout_at < NOW())
    RETURNING job_name
  `, [jobName, timeoutMinutes]);

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
    await pool.query(`
      UPDATE cron_job_locks
      SET is_locked = FALSE,
          locked_at = NULL,
          timeout_at = NULL
      WHERE job_name = $1
    `, [jobName]);
  }
}

module.exports = { withLock };
