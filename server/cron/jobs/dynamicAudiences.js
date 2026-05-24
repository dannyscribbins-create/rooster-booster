const cron = require('node-cron');
const { withLock } = require('../withLock');

function register() {
  // Daily at 6am UTC — stub only, full logic built next session
  cron.schedule('0 6 * * *', () => {
    withLock('dynamic_audiences', 20, async () => {
      // TODO: Session 71 — re-evaluate saved audience filter sets against contact_tags
      console.log('[cron] dynamic_audiences — stub, no-op');
    });
  });
}

module.exports = { register };
