const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initDB, pool } = require('./server/db');
const oauthRoutes = require('./server/routes/oauth');
const referrerRoutes = require('./server/routes/referrer');
const adminRoutes = require('./server/routes/admin');
const stripeRoutes = require('./server/routes/stripe');
const jobberWebhooks = require('./server/routes/webhooks/jobber');
const accountRoutes = require('./server/routes/account');
const { runIncrementalSync } = require('./server/crm/pipelineSync');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Token management moved to getCRMAdapter() — reads from DB per request.
// No startup token load needed.
initDB();

// Jobber webhook — no auth middleware, Jobber verifies via HMAC signature
app.use('/webhooks', jobberWebhooks);

app.use('/', oauthRoutes);
app.use('/', referrerRoutes);
app.use('/', adminRoutes);
app.use('/', stripeRoutes);
// Manage Account routes
app.use('/api/account', accountRoutes);

// ── BACKGROUND SYNC SCHEDULER ────────────────────────────────────────────────
// Runs runIncrementalSync() every 30 minutes for each contractor with a valid token.
// On deploy, waits 60 seconds before the first run to avoid startup pressure.
// A single contractor failure never stops the others.
async function runScheduledSync() {
  console.log('[scheduler] Starting scheduled incremental sync cycle');
  try {
    const result = await pool.query(
      'SELECT DISTINCT contractor_id FROM tokens WHERE access_token IS NOT NULL'
    );
    for (const row of result.rows) {
      try {
        await runIncrementalSync(row.contractor_id);
      } catch (err) {
        console.error(`[scheduler] Sync failed for contractor ${row.contractor_id}:`, err.message);
      }
    }
    console.log('[scheduler] Sync cycle complete');
  } catch (err) {
    console.error('[scheduler] Failed to query contractor list:', err.message);
  }
}

setTimeout(() => {
  runScheduledSync();
  setInterval(runScheduledSync, 30 * 60 * 1000); // every 30 minutes
}, 60 * 1000); // 60-second delay on startup

// ─────────────────────────────────────────────────────────────────────────────
app.listen(4000, () => console.log('Server running on port 4000'));
