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
      // C/DL-3b Phase 2B — choice tokens sweep here rather than in a cron job of
      // their own: same job (expired auth artefacts), so no new lock row and no
      // new file. Their TTL is 2 minutes, so the table is near-empty by
      // construction and this is a cheap tail-tidy, not the thing keeping it
      // small. Consumed tokens are deleted by the same predicate — the burn
      // marker only needs to outlive the token's own window.
      const choiceResult = await pool.query(
        'DELETE FROM login_choice_tokens WHERE expires_at < NOW()'
      );
      console.log(`[cron] session_cleanup removed ${result.rowCount} expired rows, ${choiceResult.rowCount} expired choice tokens`);
    });
  });
}

module.exports = { register };
