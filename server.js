require('dotenv').config();
const { initDB } = require('./server/db');
const { createApp } = require('./server/app');
const { startCronJobs } = require('./server/cron/index');
const { startRepNamesBackfill } = require('./server/jobs/repNamesBackfill');
const { startSaleRegroupBackfill } = require('./server/jobs/saleRegroupBackfill');
const { startAssignmentRebuildIfRequested } = require('./server/jobs/repAssignmentRebuild');
const { runBackup } = require('./server/utils/backup');
const cron = require('node-cron');

process.on('unhandledRejection', async (reason, promise) => {
  console.error('[server] Unhandled promise rejection:', reason)
  const { logError } = require('./server/middleware/errorLogger')
  await logError({ req: null, error: reason instanceof Error ? reason : new Error(String(reason)) })
})

process.on('uncaughtException', async (err) => {
  console.error('[server] Uncaught exception:', err)
  const { logError } = require('./server/middleware/errorLogger')
  await logError({ req: null, error: err })
})

const app = createApp();

// Token management moved to getCRMAdapter() — reads from DB per request.
// No startup token load needed.
;(async () => {
  try {
    await initDB();
    startCronJobs();
    // One-off: names rep-scope clients left rowless by an import that predates Rep Step 4.
    // Fire-and-forget, never throws; a no-op once claimed. See server/jobs/repNamesBackfill.js.
    startRepNamesBackfill();
    // One-off in effect, idempotent by construction: rewrites sales written under the old
    // ANCHORED grouping rule to the chained one. No Jobber call. See
    // server/jobs/saleRegroupBackfill.js for why a second run finds nothing to do.
    startSaleRegroupBackfill();
    // Operator-run support tool, NOT a feature: does nothing unless REP_ASSIGNMENT_REBUILD
    // names a contractor. See server/jobs/repAssignmentRebuild.js.
    startAssignmentRebuildIfRequested();
  } catch (err) {
    console.error('[server] initDB() failed — cron jobs will NOT start:', err);
    const { logError } = require('./server/middleware/errorLogger');
    logError({ req: null, error: err, source: 'startup' });
  }
})();

// Daily database backup — runs at 2:00am UTC
cron.schedule('0 2 * * *', async () => {
  console.log('[Backup] Scheduled daily backup starting...');
  try {
    await runBackup();
    console.log('[Backup] Scheduled daily backup completed successfully.');
  } catch (err) {
    console.error('[Backup] Scheduled daily backup FAILED:', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
app.listen(4000, () => console.log('Server running on port 4000'));
