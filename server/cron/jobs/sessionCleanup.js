const cron = require('node-cron');
const { withLock } = require('../withLock');
const { pool } = require('../../db');

function register() {
  // Daily at 2am UTC
  cron.schedule('0 2 * * *', () => {
    withLock('session_cleanup', 5, async () => {
      const result = await pool.query(
        'DELETE FROM sessions WHERE expires_at < NOW()'
      );
      console.log(`[cron] session_cleanup removed ${result.rowCount} expired rows`);
    });
  });
}

module.exports = { register };
