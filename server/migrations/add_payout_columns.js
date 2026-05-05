const { pool } = require('../db');

const steps = [
  {
    name: 'contractor_settings.payout_automation',
    sql: `ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS payout_automation VARCHAR(20) NOT NULL DEFAULT 'manual_all'`,
  },
  {
    name: 'contractor_settings.payout_review_threshold',
    sql: `ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS payout_review_threshold NUMERIC(10,2)`,
  },
  {
    name: 'referral_conversions.payout_status',
    sql: `ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) NOT NULL DEFAULT 'pending_review'`,
  },
];

async function migrate() {
  for (const step of steps) {
    try {
      await pool.query(step.sql);
      console.log(`✓ ${step.name}`);
    } catch (err) {
      console.error(`✗ ${step.name}: ${err.message}`);
    }
  }
  await pool.end();
}

migrate();
