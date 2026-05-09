const steps = [
  {
    name: 'contractor_settings.notification_email_payouts',
    sql: `ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS notification_email_payouts VARCHAR(255)`,
  },
  {
    name: 'contractor_settings.notification_email_general',
    sql: `ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS notification_email_general VARCHAR(255)`,
  },
];

async function addNotificationEmailColumns(pool) {
  if (!pool) throw new Error('addNotificationEmailColumns: pool is required');
  for (const step of steps) {
    try {
      await pool.query(step.sql);
      console.log(`✓ migration: ${step.name}`);
    } catch (err) {
      console.error(`✗ migration: ${step.name}: ${err.message}`);
    }
  }
  console.log('addNotificationEmailColumns migration complete');
}

module.exports = addNotificationEmailColumns;
