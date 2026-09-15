const express = require('express');
const path = require('path');
const cors = require('cors');
const oauthRoutes = require('./routes/oauth');
const landingRoutes = require('./routes/landing');
const referrerRoutes = require('./routes/referrer');
const brandingRoutes = require('./routes/branding');
const sessionRoutes = require('./routes/session');
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
  // ── THE FONT SET, MOUNTED FIRST AND FROM THE REPO'S OWN public/fonts ───────
  //
  // ⚠ THE LANDING PAGE CAN NOW PAINT A CONTRACTOR'S CHOSEN FAMILY, AND THIS
  // MOUNT IS WHAT MAKES THAT POSSIBLE UNDER ITS OWN CSP. That router narrows
  // `font-src` to 'self' deliberately — on the one public page that interpolates
  // contractor-controlled strings, a remote font is an exfiltration channel — so
  // a face MUST come from this origin. The app's 25 woff2 files are served to
  // the SPA by VERCEL at /fonts/, which is a different origin and unreachable
  // here. server/public/fonts holds only Montserrat and Roboto.
  //
  // ⚠ THE FILES ARE ALREADY ON THIS FILESYSTEM. `public/` is NOT gitignored —
  // only `/build` and `/dist` are — and its 40 font entries are tracked, so
  // Railway's `npm install` over a full checkout has them. This is a mount of a
  // directory that already exists, NOT a 492 KB duplication of binaries into
  // server/public with nothing keeping the two copies in step.
  //
  // ⚠ MOUNTED BEFORE THE /static MOUNT BELOW, AND THE ORDER IS THE POINT.
  // express.static falls through when a file is absent, so this serves all 14
  // families and server/public/fonts remains a fallback for the two it holds —
  // which are byte-identical to their namesakes here (asserted in the suite).
  // A missing directory therefore degrades to today's behaviour rather than
  // taking every face down with it.
  app.use('/static/fonts', express.static(path.join(__dirname, '..', 'public', 'fonts'), {
    maxAge: '1y',
    immutable: true,
    dotfiles: 'ignore',
  }));

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
  // Session lifecycle — GET /api/session, POST /api/logout (C/DL-3b Phase 4).
  // Role-agnostic by construction: the caller does not yet know which surface
  // its stored token belongs to, so these cannot live under referrer.js or
  // admin/. Mounted before adminRoutes for the same reason branding.js is —
  // it owns two exact paths and can shadow nothing.
  app.use('/', sessionRoutes);
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
