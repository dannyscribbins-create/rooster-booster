const cron = require('node-cron');
const { withLock } = require('../withLock');
const { runScheduledSync } = require('../../crm/pipelineSync');

function register() {
  // Every 30 minutes
  cron.schedule('0 */30 * * * *', () => {
    withLock('pipeline_sync', 10, async () => {
      await runScheduledSync();
    });
  });
  console.log('[cron] pipeline_sync registered (every 30 min)');
}

module.exports = { register };
