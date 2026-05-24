const cron = require('node-cron');
const { withLock } = require('../withLock');

function register() {
  // Daily at 6am UTC — stub only, full logic built next session
  cron.schedule('0 6 * * *', () => {
    withLock('engagement_cadence', 20, async () => {
      // TODO: Session 71 — M1/M3/M6/M12 post-job engagement cadence
      console.log('[cron] engagement_cadence — stub, no-op');
    });
  });
}

module.exports = { register };
