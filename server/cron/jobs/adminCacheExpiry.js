const cron = require('node-cron');
const { withLock } = require('../withLock');
const { pool } = require('../../db');

function register() {
  // Every 20 minutes
  cron.schedule('0 */20 * * * *', () => {
    withLock('admin_cache_expiry', 5, async () => {
      const result = await pool.query(
        'DELETE FROM admin_cache WHERE expires_at < NOW()'
      );
      console.log(`[cron] admin_cache_expiry removed ${result.rowCount} stale rows`);
    });
  });
}

module.exports = { register };
