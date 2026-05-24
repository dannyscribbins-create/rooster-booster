const pipelineSyncJob = require('./jobs/pipelineSync');
const sessionCleanupJob = require('./jobs/sessionCleanup');
const adminCacheExpiryJob = require('./jobs/adminCacheExpiry');
const { startEngagementCadenceJob } = require('./jobs/engagementCadence');
const { startDynamicAudiencesJob } = require('./jobs/dynamicAudiences');

function startCronJobs() {
  console.log('[cron] Starting cron job scheduler...');
  pipelineSyncJob.register();
  sessionCleanupJob.register();
  adminCacheExpiryJob.register();
  startEngagementCadenceJob();
  startDynamicAudiencesJob();
  console.log('[cron] All cron jobs registered.');
}

module.exports = { startCronJobs };
