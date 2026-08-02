'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SERVER-RENDERED LANDING PAGE — ROUTER + SCOPED CSP (C/DL-2 Phase 3d-1)
//
// The page a homeowner reaches by scanning a QR or tapping a referral link
// without the app installed. Amendment A8 rules it SERVER-RENDERED FROM EXPRESS
// — not a Vercel deployment and not a route inside the CRA app. A9 fixes the
// path at /i/<slug>; /r/ is void and appears nowhere in code.
//
// ── WHAT THIS FILE IS IN PHASE 3d-1 ─────────────────────────────────────────
// The PLUMBING: the mount, the scoped Content-Security-Policy, the per-request
// nonce, and a minimal document proving the whole pipe works end to end — theme
// variables injected server-side, the contractor's B2-hosted logo loading under
// the widened img-src, and a nonce'd script executing.
//
// THE PAGE ITSELF IS 3d-2. The markup below is deliberately minimal and is meant
// to be replaced wholesale by LP §2's States 0-3. What must NOT be replaced is
// the escaping discipline or the CSP wiring around it.
//
// ── WHY THE CSP IS RE-APPLIED HERE INSTEAD OF WIDENED GLOBALLY ──────────────
// server/app.js calls helmet() bare. Two of its defaults are incompatible with
// this page and with nothing else in the product:
//
//   img-src 'self' data:   blocks the contractor logo, which is a Backblaze B2
//                          URL on a different origin. A white-label page that
//                          cannot load the contractor's logo is the one failure
//                          this whole arc exists to prevent.
//
//   script-src 'self'      blocks inline script, and script-src-attr 'none'
//                          blocks inline handlers. THE PAGE CANNOT BE JS-FREE:
//                          the skip path must write the referral token to the
//                          clipboard inside the click handler, because
//                          navigator.clipboard.writeText requires user
//                          activation and a deferred call has already lost it.
//
// Widening the GLOBAL helmet() call would hand an external image origin and a
// script nonce to every admin, API and webhook response in the product to solve
// a problem on one public page. Re-applying contentSecurityPolicy on this router
// works because the later middleware re-sets the header for these routes only —
// server/test/landingCsp.test.js fences both halves, and its two global-CSP
// regression tests are what catch the shortcut.
//
// STYLE-SRC IS DELIBERATELY NOT TOUCHED. helmet's default already carries
// 'unsafe-inline', which is what lets the contractor's colours be injected as a
// <style> block. There is nothing to do there, and doing something would be a
// regression.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const crypto = require('crypto');
const helmet = require('helmet');
const router = express.Router();

const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');
const { resolveLanding } = require('../utils/landingResolve');
const { b2PublicOrigin } = require('../utils/b2Media');
const { escapeHtml } = require('../utils/pendingReferral');

// ── PER-REQUEST NONCE ────────────────────────────────────────────────────────
// base64url, NOT base64. Two reasons, both practical: standard base64 pads with
// '=' and can contain '+' and '/', and a '=' inside a CSP source token is
// awkward to match and to read. base64url of 16 bytes is 22 unpadded chars from
// [A-Za-z0-9_-] — 128 bits of entropy, which is far past what a nonce needs.
//
// REGENERATED PER REQUEST, which is the entire point. A nonce reused across
// responses is discoverable from any single page load and would then authorise
// injected script on every subsequent one — strictly worse than 'unsafe-inline',
// because it reads as though it were safe.
router.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64url');
  next();
});

// ── SCOPED CSP ───────────────────────────────────────────────────────────────
// Built per request because the nonce is. `useDefaults: true` keeps every
// directive helmet already sets — default-src, base-uri, object-src, form-action,
// frame-ancestors, style-src — and overrides exactly two.
//
// The B2 origin is read from the same helper that builds the URLs actually
// written into contractor_settings.logo_url, so the policy and the data cannot
// drift apart. When it is null (unparseable base URL) the source is simply
// omitted rather than the page failing to render.
router.use((req, res, next) => {
  const origin = b2PublicOrigin();
  const imgSrc = ["'self'", 'data:'];
  if (origin) imgSrc.push(origin);

  return helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      'img-src': imgSrc,
      // No 'unsafe-inline' fallback. This page interpolates contractor-controlled
      // company name, address and logo URL into markup; handing it back
      // 'unsafe-inline' would return the entire XSS surface the escaping above
      // exists to close.
      'script-src': ["'self'", `'nonce-${res.locals.cspNonce}'`],
    },
  })(req, res, next);
});

// Renders the theme block. Every value is either a validated six-digit hex (the
// shared resolver refuses anything else, so no attacker-influenced string can
// reach a style context) or run through escapeHtml.
//
// A NULL branding block means a contractor that resolved to nothing — the
// RoofMiles defaults are already baked into resolveBrandingTheme, so this only
// guards the State 0 case where there is no contractor at all.
function themeStyle(contractor) {
  if (!contractor) return '';
  return [
    ':root{',
    `--brand-primary:${contractor.primaryColor};`,
    `--brand-secondary:${contractor.secondaryColor};`,
    `--brand-accent:${contractor.accentColor};`,
    `--brand-bg:${contractor.backgroundColor};`,
    '}',
  ].join('');
}

// PHASE 3d-1 PLACEHOLDER BODY — replaced wholesale by LP §2 States 0-3 in 3d-2.
//
// EVERY interpolated value goes through escapeHtml, imported from
// server/utils/pendingReferral.js per CLAUDE.md. That import only became possible
// in this phase; the function was defined there and never exported, and it was
// also repaired in this phase to escape the single quote — without which
// `title='...'` below would be escapable.
function renderPage(payload, nonce) {
  const c = payload.contractor || null;
  const companyName = escapeHtml(c ? c.companyName : 'RoofMiles');
  const programName = c && c.programName ? escapeHtml(c.programName) : null;
  const chip = payload.referrer ? escapeHtml(payload.referrer.displayName) : null;

  // The logo is rendered ONLY when the resolver supplied one. There is no default
  // logo, deliberately: a placeholder borrowed from another contractor is a
  // white-label breach, not a fallback.
  const logo = c && c.logoUrl
    ? `<img class="logo" src="${escapeHtml(c.logoUrl)}" alt="${companyName}" title='${companyName}'>`
    : '';

  const heading = payload.valid
    ? `Join the ${programName || `${companyName} rewards`} program`
    : "This link isn't active";

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${companyName}</title>
<style>${themeStyle(c)}
body{margin:0;font-family:system-ui,sans-serif;background:var(--brand-bg,#fff);color:var(--brand-secondary,#1C2D4D);}
.wrap{max-width:430px;margin:0 auto;padding:32px 24px;text-align:center;}
.logo{max-width:180px;height:auto;}
.chip{display:inline-block;padding:6px 14px;border-radius:999px;background:var(--brand-accent,#FDF0E7);font-size:14px;}
.powered{margin-top:40px;font-size:13px;}.powered b{color:#F26A1B;}
</style>
</head><body>
<div class="wrap">
  ${logo}
  ${chip ? `<p><span class="chip">Invited by ${chip}</span></p>` : ''}
  <h1>${heading}</h1>
  ${payload.valid ? `<p>Earn cash for referring friends and neighbors to ${companyName}.</p>` : ''}
  <p class="powered">Powered by <b>RoofMiles</b></p>
</div>
<script nonce="${nonce}">
  // Phase 3d-1 proves the nonce authorises script at all. The skip path's
  // clipboard write (3d-3) is what actually needs it.
  document.documentElement.dataset.landingReady = '1';
</script>
</body></html>`;
}

// ── GET /i/:slug — the invite landing page ───────────────────────────────────
// ONE resolution, shared with GET /api/invite/:slug. See landingResolve.js.
//
// AN INVALID TOKEN IS STILL A 200, not a 404. LP §2 State 0 is a PAGE — a
// homeowner holding a dead link should see a branded explanation and a way to
// reach the contractor, not a browser error. The distinction lives in the body,
// not the status code.
router.get('/i/:slug', async (req, res) => {
  try {
    const payload = await resolveLanding(pool, {
      host: req.hostname,
      slug: req.params.slug,
      req,
    });
    res.type('html').send(renderPage(payload, res.locals.cspNonce));
  } catch (err) {
    await logError({ req, error: err, source: 'GET /i/:slug' });
    // A THROWN ERROR MUST STILL RENDER HTML. The global expressErrorHandler
    // answers JSON, which on this surface would show a homeowner a raw object.
    // Handled here so the failure mode is a plain page rather than a JSON blob,
    // and with no internal detail (Security Standards).
    res.status(500).type('html').send(
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<title>Something went wrong</title></head><body>' +
      "<p>Something went wrong. Please try again in a moment.</p></body></html>"
    );
  }
});

module.exports = router;
