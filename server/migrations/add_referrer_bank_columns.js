const { pool } = require('../db');

// SECURITY: stripe_bank_account_token stores AES-256-GCM ciphertext written by the application layer.
// Never log this column's value in any console.log, error log, or Railway log output — ever.

const steps = [
  {
    name: 'users.stripe_customer_id',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)`,
  },
  {
    // application-level AES-256-GCM encrypted before write. Never log or expose this value.
    name: 'users.stripe_bank_account_token',
    sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_bank_account_token VARCHAR(500)`,
  },
  {
    name: 'cashout_requests.bank_connection_blocked_reason',
    sql: `ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS bank_connection_blocked_reason TEXT`,
  },
];

async function addReferrerBankColumns() {
  for (const step of steps) {
    try {
      await pool.query(step.sql);
      console.log(`✓ migration: ${step.name}`);
    } catch (err) {
      console.error(`✗ migration: ${step.name}: ${err.message}`);
    }
  }
  console.log('addReferrerBankColumns migration complete');
}

module.exports = addReferrerBankColumns;
