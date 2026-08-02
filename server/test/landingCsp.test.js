'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3d-1 RED SUITE — CSP SCOPED TO THE LANDING ROUTER
//
// server/app.js calls `helmet()` bare, at line 18, before every router. Phase 0
// read the defaults out of node_modules/helmet/index.cjs rather than from memory:
//
//   default-src      'self'
//   img-src          'self' data:
//   script-src       'self'
//   script-src-attr  'none'
//   style-src        'self' https: 'unsafe-inline'
//   form-action      'self'
//   base-uri         'self'
//   object-src       'none'
//
// TWO OF THOSE BREAK THE LANDING PAGE, and neither is negotiable:
//
//   img-src 'self' data:   BLOCKS THE CONTRACTOR LOGO. logo_url is written by the
//                          upload endpoint as a Backblaze B2 URL
//                          (server/utils/b2Media.js buildB2PublicUrl), which is a
//                          different origin. The logo is the entire point of a
//                          white-labeled page; a blocked one is a page showing
//                          the wrong brand, or none.
//
//   script-src 'self'      BLOCKS INLINE SCRIPT, and script-src-attr 'none'
//                          blocks inline handlers. THE PAGE CANNOT BE JS-FREE:
//                          the skip path must write the referral token to the
//                          clipboard inside the click handler, because
//                          navigator.clipboard.writeText requires user
//                          activation and a deferred call loses it. That needs a
//                          real handler, which needs either a same-origin script
//                          file or a per-request nonce.
//
// WHAT STAYS AS IT IS, and is worth stating because it is the reason this is a
// narrow widening rather than a rewrite: style-src already permits
// 'unsafe-inline', so server-injected theme variables — a <style> block or a
// style attribute carrying the contractor's colours — work under the defaults
// untouched. The CSP change is about images and script, nothing else.
//
// PROPOSED CONTRACT — this file defines it; the implementation phase satisfies it.
//
//   Re-apply helmet.contentSecurityPolicy() ON THE LANDING ROUTER ONLY, with
//   img-src widened to the configured B2 origin and a per-request script nonce.
//   Later middleware re-sets the header, so a scoped re-application wins over the
//   global one for those routes and leaves every other route alone.
//
// ── THE SECOND TEST IS THE IMPORTANT ONE ───────────────────────────────────
// 'the GLOBAL CSP is unchanged' exists to catch the cheap fix: widening
// helmet()'s options in app.js so the landing page works. That would hand
// img-src and a script nonce to every admin and API response in the product to
// solve a problem on one public page. It is the single most likely wrong turn
// here, it would make every other test in this file pass, and it is precisely
// what that test is pointed at.
//
// GUARD-PROOF SITE: during GREEN, delete the scoped contentSecurityPolicy call
// from the landing router and confirm the landing-route tests below go RED while
// the global-CSP test stays GREEN. Then widen the GLOBAL helmet() call instead
// and confirm the opposite — landing tests green, global test RED. Both
// directions must behave that way; either one alone can be satisfied by accident.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

const TENANT_A = 'test-tenant-csp-a';
const SLUG_A = 'alpharoofing';
const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;

// The landing path, per amendment A9. Not /r/ — that shape is void and appears
// nowhere in code.
const landingPath = slug => `/i/${slug}`;

// The B2 origin the CSP must permit, derived the same way production derives it
// (server/utils/b2Media.js buildB2PublicUrl) rather than hardcoded here, so a
// change of bucket or of B2_PUBLIC_URL_BASE does not silently invalidate the test.
function b2Origin() {
  const base = process.env.B2_PUBLIC_URL_BASE
    || `https://f005.backblazeb2.com/file/${process.env.B2_MEDIA_BUCKET_NAME || 'media'}`;
  return new URL(base).origin;
}

let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.88.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpGet(port, path, { host = null } = {}) {
  const headers = { 'X-Forwarded-For': nextIp() };
  if (host) headers.Host = host;
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method: 'GET', headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          csp: res.headers['content-security-policy'] || null,
          raw: Buffer.concat(chunks).toString(),
        }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// Pulls one directive out of a CSP header string. Returns null when absent, so
// "the directive is missing" and "the directive is empty" stay distinguishable.
function directive(csp, name) {
  if (!csp) return null;
  for (const part of csp.split(';')) {
    const trimmed = part.trim();
    if (trimmed === name || trimmed.startsWith(`${name} `)) {
      return trimmed.slice(name.length).trim();
    }
  }
  return null;
}

describe('C/DL-2 Phase 3d-1 — CSP scoped to the landing router', () => {
  let pool, server, port, tokenSlug;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // ORDER IS LOAD-BEARING — `titles` carries an FK to `contractors`, and db.js's
    // startup seed block creates title rows for the seeded contractor. Deleting
    // contractors first raises 23503 (titles_contractor_id_fkey) inside this hook,
    // which fails every test in the file for a reason that has nothing to do with
    // CSP. This sequence matches landingResolution.test.js's, which already had it
    // right; an abbreviated copy is how the dependency gets lost.
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [TENANT_A, 'Alpha Roofing Co', SLUG_A]
    );
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, primary_color, secondary_color, landing_bg_color, logo_url)
       VALUES ($1, $2, '#AA1111', '#AA2222', '#AA3333', $3)`,
      [TENANT_A, 'Alpha Roofing Co', `${b2Origin()}/file/media/alpha-logo.png`]
    );

    tokenSlug = `tok-csp-${Date.now()}`;
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', true)`,
      [TENANT_A, tokenSlug]
    );
  });

  // ── 1. THE LANDING ROUTE'S OWN CSP ─────────────────────────────────────────

  it('[RED] the landing route responds and carries a CSP header', async () => {
    // The precondition every other test in this file depends on, asserted once on
    // its own so a missing route reports clearly instead of as five confusing
    // header failures.
    //
    // NOTE ON RED SHAPE: today GET /i/:slug is unrouted, so Express answers 404 —
    // and helmet still stamps the GLOBAL CSP on that 404. Asserting the header
    // exists is therefore NOT sufficient on its own; the status gate is what makes
    // every assertion below describe the landing page rather than a 404 page.
    const res = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG_A) });

    assert.equal(
      res.status, 200,
      `GET /i/:slug must serve the landing page (got ${res.status}). ` +
      'Until it does, every CSP assertion in this file would be reading a 404\'s headers.'
    );
    assert.ok(res.csp, 'the landing response must carry a Content-Security-Policy header');
  });

  it('[RED] the landing CSP permits the B2 image host', async () => {
    // NON-VACUITY: status 200 and the header's presence are both asserted before
    // the directive is inspected. Without the status gate this would read the
    // global CSP off a 404 and report on the wrong response entirely.
    const res = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG_A) });

    assert.equal(res.status, 200, `precondition: the landing route must serve (got ${res.status})`);
    assert.ok(res.csp, 'precondition: a CSP header must be present');

    const imgSrc = directive(res.csp, 'img-src');
    assert.ok(imgSrc, `the landing CSP must carry an img-src directive, got: ${res.csp}`);

    const origin = b2Origin();
    assert.ok(
      imgSrc.includes(origin) || imgSrc.includes('https:'),
      `img-src must permit the B2 logo host (${origin}). Helmet's default is "'self' data:", ` +
      `which blocks every contractor logo. Got img-src: ${imgSrc}`
    );
    assert.ok(
      imgSrc.includes("'self'"),
      `img-src must still permit 'self' — the RoofMiles wordmark and store badges are served ` +
      `from server/public/. Got: ${imgSrc}`
    );
    assert.ok(
      imgSrc.includes('data:'),
      `img-src must still permit data: URIs. Got: ${imgSrc}`
    );
  });

  it('[RED] the landing CSP carries a script nonce', async () => {
    // The page needs a real click handler for the skip path's clipboard write.
    // A nonce is preferred over 'unsafe-inline' because 'unsafe-inline' on a page
    // that interpolates contractor-controlled strings is the whole XSS surface
    // handed back.
    const res = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG_A) });

    assert.equal(res.status, 200, `precondition: the landing route must serve (got ${res.status})`);
    assert.ok(res.csp, 'precondition: a CSP header must be present');

    const scriptSrc = directive(res.csp, 'script-src');
    assert.ok(scriptSrc, `the landing CSP must carry a script-src directive, got: ${res.csp}`);

    const nonceMatch = /'nonce-([A-Za-z0-9+/_-]{16,})'/.exec(scriptSrc);
    assert.ok(
      nonceMatch,
      `script-src must carry a per-request nonce of at least 16 chars. Got script-src: ${scriptSrc}`
    );

    assert.equal(
      scriptSrc.includes("'unsafe-inline'"), false,
      "script-src must NOT fall back to 'unsafe-inline' — a nonce is the point. " +
      'This page interpolates contractor-controlled company name, address and logo URL into markup.'
    );
  });

  it('[RED] the nonce is per-request, not a build-time constant', async () => {
    // A nonce reused across responses is not a nonce. It would be discoverable
    // from any single page load and would then authorise injected script on every
    // subsequent one, which is strictly worse than 'unsafe-inline' because it
    // reads as though it were safe.
    const first = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG_A) });
    const second = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG_A) });

    assert.equal(first.status, 200, `precondition: first request must serve (got ${first.status})`);
    assert.equal(second.status, 200, `precondition: second request must serve (got ${second.status})`);

    const n1 = /'nonce-([^']+)'/.exec(directive(first.csp, 'script-src') || '');
    const n2 = /'nonce-([^']+)'/.exec(directive(second.csp, 'script-src') || '');
    assert.ok(n1 && n2, 'precondition: both responses must carry a script nonce');

    assert.notEqual(
      n1[1], n2[1],
      'the same nonce was issued twice — it must be regenerated per request'
    );
  });

  it('[RED] the landing CSP keeps the restrictive directives it does not need to widen', async () => {
    // The counterweight to every widening test above. The cheapest way to make
    // them all pass is to disable CSP on this route, or to set default-src '*'.
    // That would satisfy "permits the B2 host" and "carries a nonce" while
    // removing the protection entirely from the one public, unauthenticated,
    // contractor-string-interpolating page in the product.
    const res = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG_A) });

    assert.equal(res.status, 200, `precondition: the landing route must serve (got ${res.status})`);
    assert.ok(res.csp, 'precondition: a CSP header must be present');

    assert.equal(
      directive(res.csp, 'object-src'), "'none'",
      "object-src must stay 'none' on the landing page"
    );
    assert.equal(
      directive(res.csp, 'base-uri'), "'self'",
      "base-uri must stay 'self' — a widened base-uri re-points every relative URL on the page"
    );
    const defaultSrc = directive(res.csp, 'default-src');
    assert.ok(defaultSrc, 'default-src must still be set');
    assert.equal(
      defaultSrc.includes('*'), false,
      `default-src must not be widened to a wildcard, got: ${defaultSrc}`
    );
  });

  // ── 2. THE GLOBAL CSP IS UNCHANGED — THE TEST THAT MATTERS MOST ────────────

  it('[GREEN-by-design] the GLOBAL CSP is untouched — API routes keep the strict defaults', async () => {
    // THIS IS THE TEST THAT CATCHES SOMEONE "FIXING" THE CSP GLOBALLY.
    //
    // Widening helmet()'s options in server/app.js would make every landing test
    // above pass. It would also hand a script nonce and an external image origin
    // to every admin panel response, every API response and every webhook
    // response in the product — solving a one-page problem everywhere.
    //
    // NON-VACUITY: the API response's status and the presence of its CSP header
    // are both asserted before the directives are inspected. A route that 404ed,
    // or a helmet that had been removed outright, would otherwise satisfy
    // "img-src does not include the B2 host" for entirely the wrong reason.
    const res = await httpGet(port, '/api/invite/zz-no-such-token', { host: hostFor(SLUG_A) });

    assert.equal(res.status, 200, `precondition: the API route must answer (got ${res.status}: ${res.raw})`);
    assert.ok(
      res.csp,
      'precondition: the API response must still carry a CSP header at all — if helmet were ' +
      'removed globally this assertion is what notices'
    );

    assert.equal(
      directive(res.csp, 'img-src'), "'self' data:",
      `the GLOBAL img-src was widened. It must stay at helmet's default "'self' data:" — ` +
      `the B2 host belongs on the landing router only. Got: ${res.csp}`
    );
    assert.equal(
      directive(res.csp, 'script-src'), "'self'",
      `the GLOBAL script-src was widened. It must stay at helmet's default "'self'" with no ` +
      `nonce — API responses have no script to authorise. Got: ${res.csp}`
    );
    assert.equal(
      res.csp.includes('nonce-'), false,
      'a script nonce is being issued on API responses — the scoped override has leaked globally'
    );
  });

  it('[GREEN-by-design] the global CSP is unchanged on a second, unrelated router too', async () => {
    // One route could keep the defaults by accident — for example if the widening
    // were applied to a router that happens not to serve it. Asserting on /health,
    // which is registered before every router in createApp(), makes the claim about
    // the app-level helmet() call rather than about one router's luck.
    const res = await httpGet(port, '/health');

    assert.equal(res.status, 200, `precondition: /health must answer 200 (got ${res.status})`);
    assert.ok(res.csp, 'precondition: /health must carry a CSP header');

    assert.equal(directive(res.csp, 'img-src'), "'self' data:", `global img-src drifted: ${res.csp}`);
    assert.equal(directive(res.csp, 'script-src'), "'self'", `global script-src drifted: ${res.csp}`);
  });

  it('[RED] style-src is NOT widened anywhere — the defaults already allow the theme block', async () => {
    // Recorded as an explicit non-change so nobody widens it "while they are in
    // there". helmet's default style-src already carries 'unsafe-inline', which is
    // what lets the server inject the contractor's colours as a <style> block or a
    // style attribute. There is nothing to do here, and doing something would be a
    // regression.
    const landing = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG_A) });
    assert.equal(landing.status, 200, `precondition: the landing route must serve (got ${landing.status})`);

    const styleSrc = directive(landing.csp, 'style-src');
    assert.ok(styleSrc, `the landing CSP must carry a style-src directive, got: ${landing.csp}`);
    assert.ok(
      styleSrc.includes("'unsafe-inline'"),
      `style-src must keep 'unsafe-inline' so server-injected theme variables render. Got: ${styleSrc}`
    );
    assert.equal(
      styleSrc.includes('*'), false,
      `style-src must not be widened to a wildcard, got: ${styleSrc}`
    );
  });
});
