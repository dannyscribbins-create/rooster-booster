const express = require('express');
const path = require('path');
const cors = require('cors');
const oauthRoutes = require('./routes/oauth');
const landingRoutes = require('./routes/landing');
const referrerRoutes = require('./routes/referrer');
const brandingRoutes = require('./routes/branding');
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

  // ── SERVER-OWNED STATIC ASSETS (C/DL-2 Phase 3d-1) ──────────────────────────
  // server/public/ is NOT CRA's public/. Railway never builds the frontend —
  // railway.json's buildCommand is `npm install`, not `npm run build`, and /build
  // is gitignored — so nothing from the CRA bundle exists on this filesystem.
  // Platform-owned artwork the server-rendered landing page needs (the RoofMiles
  // wordmark now, the store badges when A14's deferral lifts) lives here and is
  // committed to git. Per-contractor logos stay on B2: they are uploaded,
  // tenant-scoped and mutable, and putting them here would mean a deploy to
  // change a logo.
  //
  // MOUNTED AT /static, a prefix no router owns. Mounting at '/' instead would
  // make every unmatched API path a static-file lookup first — a quiet failure
  // where routes keep 404ing for a different reason than before.
  //
  // immutable + 1 year is safe because these filenames are stable platform
  // assets; a replacement ships under a new name rather than mutating one in
  // place. express.static's default is maxAge 0, i.e. no caching at all, on what
  // is a first-touch marketing page.
  app.use('/static', express.static(path.join(__dirname, 'public'), {
    maxAge: '1y',
    immutable: true,
    // Explicit rather than implied. This IS the default, and it is the difference
    // between a stray file under the static root being inert and being disclosed.
    dotfiles: 'ignore',
  }));

  // Jobber webhook — no auth middleware, Jobber verifies via HMAC signature
  app.use('/webhooks', jobberWebhooks);
  app.use('/api/webhooks', resendWebhookRouter);

  app.use('/', oauthRoutes);
  app.use('/', referrerRoutes);
  // Public branding resolution — GET /api/branding/:slug (C/DL-3b Phase 1).
  // Unauthenticated and read-only; it carries its own limiter rather than sharing
  // referrer.js's landingResolveLimiter. See server/routes/branding.js for why
  // this is a distinct path from /api/invite/:slug rather than a second mount.
  app.use('/', brandingRoutes);
  app.use('/', adminRoutes);
  app.use('/', superAdminRoutes);
  app.use('/', stripeRoutes);
  // Manage Account routes
  app.use('/api/account', accountRoutes);
  // Unsubscribe / email preferences — public, no auth middleware
  app.use('/', unsubscribeRoutes);

  // Server-rendered landing page (C/DL-2, amendment A8). Owns /i/:slug only.
  // Mounted AFTER the API routers so it can never shadow one, and it carries its
  // OWN Content-Security-Policy — see server/routes/landing.js for why that is
  // scoped here rather than widened in the global helmet() call above.
  app.use('/', landingRoutes);

  app.use(expressErrorHandler);

  return app;
}

module.exports = { createApp };
