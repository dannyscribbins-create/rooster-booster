const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initDB } = require('./server/db');
const oauthRoutes = require('./server/routes/oauth');
const referrerRoutes = require('./server/routes/referrer');
const adminRoutes = require('./server/routes/admin');
const stripeRoutes = require('./server/routes/stripe');
const jobberWebhooks = require('./server/routes/webhooks/jobber');
const accountRoutes = require('./server/routes/account');
const { runScheduledSync } = require('./server/crm/pipelineSync');

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

// Background sync: 60s startup delay, then every 30 minutes. Logic in pipelineSync.js.
setTimeout(() => {
  runScheduledSync();
  setInterval(runScheduledSync, 30 * 60 * 1000);
}, 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
app.listen(4000, () => console.log('Server running on port 4000'));
