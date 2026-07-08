const express = require('express');
const cors = require('cors');
const oauthRoutes = require('./routes/oauth');
const referrerRoutes = require('./routes/referrer');
const adminRoutes = require('./routes/admin/index');
const superAdminRoutes = require('./routes/superAdmin');
const stripeRoutes = require('./routes/stripe');
const jobberWebhooks = require('./routes/webhooks/jobber');
const resendWebhookRouter = require('./routes/resendWebhook');
const accountRoutes = require('./routes/account');
const unsubscribeRoutes = require('./routes/unsubscribe');
const { expressErrorHandler } = require('./middleware/errorLogger');
const helmet = require('helmet');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.get('/health', (req, res) => res.json({ status: 'ok', version: process.env.APP_VERSION || 'unknown', timestamp: new Date().toISOString() }));
  app.use(cors());
  app.use('/webhooks', express.raw({ type: 'application/json' }));
  app.use('/api/webhooks', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '5mb' }));

  // Jobber webhook — no auth middleware, Jobber verifies via HMAC signature
  app.use('/webhooks', jobberWebhooks);
  app.use('/api/webhooks', resendWebhookRouter);

  app.use('/', oauthRoutes);
  app.use('/', referrerRoutes);
  app.use('/', adminRoutes);
  app.use('/', superAdminRoutes);
  app.use('/', stripeRoutes);
  // Manage Account routes
  app.use('/api/account', accountRoutes);
  // Unsubscribe / email preferences — public, no auth middleware
  app.use('/', unsubscribeRoutes);

  app.use(expressErrorHandler);

  return app;
}

module.exports = { createApp };
