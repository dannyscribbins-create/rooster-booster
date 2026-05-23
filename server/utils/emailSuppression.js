'use strict';
const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');

// Checks whether an email should be suppressed for a given trigger.
// Returns true (suppressed) if:
//   1. The recipient has opted out of all emails (email_opt_outs.opt_out_all)
//   2. The admin has disabled this trigger in notification_preferences
// Fails open — on any DB error, returns false so notifications are never silently dropped.
async function isEmailSuppressed(contractorId, recipientEmail, triggerKey) {
  try {
    const optOutResult = await pool.query(
      `SELECT opt_out_all FROM email_opt_outs WHERE contractor_id = $1 AND email = $2`,
      [contractorId, recipientEmail]
    );
    if (optOutResult.rows[0]?.opt_out_all) return true;

    const prefResult = await pool.query(
      `SELECT email_enabled FROM notification_preferences WHERE contractor_id = $1 AND trigger_key = $2`,
      [contractorId, triggerKey]
    );
    if (prefResult.rows.length > 0 && !prefResult.rows[0].email_enabled) return true;

    return false;
  } catch (err) {
    await logError({ req: null, error: err, source: 'isEmailSuppressed' });
    return false;
  }
}

module.exports = { isEmailSuppressed };
