const pipelineSyncJob = require('./jobs/pipelineSync');
const sessionCleanupJob = require('./jobs/sessionCleanup');
const adminCacheExpiryJob = require('./jobs/adminCacheExpiry');
const engagementCadenceJob = require('./jobs/engagementCadence');
const dynamicAudiencesJob = require('./jobs/dynamicAudiences');

function startCronJobs() {
  console.log('[cron] Starting cron job scheduler...');
  pipelineSyncJob.register();
  sessionCleanupJob.register();
  adminCacheExpiryJob.register();
  engagementCadenceJob.register();
  dynamicAudiencesJob.register();
  console.log('[cron] All cron jobs registered.');
}

module.exports = { startCronJobs };
