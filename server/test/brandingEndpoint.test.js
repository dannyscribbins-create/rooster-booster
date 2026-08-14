'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 1 STEP 2 RED SUITE — GET /api/branding/:slug
//
// WHY A NEW ENDPOINT RATHER THAN REUSING GET /api/invite/:slug (Ruling 3).
// Phase 0 recorded that endpoint as "the only bridge" from a slug to branding.
// Step 1 established it cannot do this job at all, for three independent reasons:
//
//   1. ITS :slug IS AN INVITE TOKEN SLUG, NOT A CONTRACTOR SLUG. resolveLanding
//      hands `slug` to resolveToken() — the contractor_invite_links lookup. The
//      CONTRACTOR slug enters that function only through `host`. So on
//      app.roofmiles.com, `?brand=accent` resolves to no token, the host resolves
//      to null ('app' is reserved), and the payload is a bare { valid: false }.
//      Two different namespaces must not share a URL shape.
//   2. IT RETURNS contractorId at the top level of its success payload
//      (landingResolve.js:232,285) — tenancy-bearing, which this endpoint forbids.
//   3. IT WRITES. recordScanEvent() fires on every token resolution
//      (landingResolve.js:275). A branding read must never record a scan.
//
// THE CONTRACT THIS FILE DEFINES:
//
//   GET /api/branding/:slug   →  200, body === resolveBrandingTheme output
//
//   Public. Read-only. GET only. Its own limiter. No tenancy-bearing field. No
//   write of any kind.
//
//   An unknown, malformed or RESERVED slug returns the neutral RoofMiles defaults
//   at 200 — never a 404, never an error, and INDISTINGUISHABLE from each other.
//   A 404 here would turn the endpoint into a contractor-slug oracle: walk the
//   slug space, keep the 200s, and you have the platform's tenant roster.
//
// NO SLUG IS ECHOED BACK. The caller already holds the slug it asked about — it
// is the thing it put in the URL — so echoing it buys the resolver chain nothing
// and costs a reflected-input surface plus a shape difference between the
// resolved and unresolved cases. Omitting it is what makes the unknown and
// reserved responses byte-identical, which is a far stronger assertion than
// "same keys, different values". See the INDISTINGUISHABLE test below.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS anywhere in this file (house rule).
// Two-tenant fixtures throughout.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');
const { BRANDING_THEME_DEFAULTS } = require('../utils/brandingTheme');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';

const SLUG_A = 'alpharoofing';
const SLUG_B = 'betaroofing';

// A well-formed slug that no contractor holds.
const SLUG_UNKNOWN = 'nosuchroofer';
// Reserved — server/utils/contractorSlug.js RESERVED_SLUGS. This is the exact
// label the React app is served from (app.roofmiles.com), which is why it is the
// named case in the spec (D4, source 2).
const SLUG_RESERVED = 'app';

const BRAND_A = {
  companyName: 'Alpha Roofing Co',
  programName: 'Alpha Rewards',
  primary: '#AA1111',
  secondary: '#AA2222',
  accent: '#AA4444',
  bg: '#AA3333',
  logo: 'https://cdn.test.invalid/alpha-logo.png',
  phone: '555-0100',
  email: 'hello@alpha.invalid',
  address: '1 Alpha Way, Atlanta GA',
  website: 'alpharoofing.invalid',
};

const BRAND_B = {
  companyName: 'Beta Roofing Co',
  programName: 'Beta Rewards',
  primary: '#BB1111',
  secondary: '#BB2222',
  accent: '#BB4444',
  bg: '#BB3333',
  logo: 'https://cdn.test.invalid/beta-logo.png',
  phone: '555-0200',
  email: 'hello@beta.invalid',
  address: null,
  website: null,
};

// LAZY REQUIRE, deliberately, and not a top-of-file import — the same reason
// landingResolve.test.js:106 gives. server/routes/branding.js does not exist yet;
// a top-level require would throw at module load, node:test would report ONE
// file-level error, and not a single test here would run.
function loadBrandingRouter() {
  let mod;
  try {
    mod = require('../routes/branding');
  } catch (err) {
    assert.fail(
      `server/routes/branding.js is not requirable yet (${err.code || err.message}). ` +
      'The endpoint has not been built.'
    );
  }
  return mod;
}

// EVERY REQUEST GETS ITS OWN SOURCE IP. server/app.js sets `trust proxy 1`, so
// without this the whole file shares one limiter bucket and starts 429ing partway
// through for a reason unrelated to what is being tested — the same hazard
// landingResolution.test.js:122 documents.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.93.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpRequest(port, path, { method = 'GET', ip = null } = {}) {
  const headers = { 'X-Forwarded-For': ip || nextIp() };
  return new Promise((resolve, reject) => {
    const req = _httpRequest({ hostname: 'localhost', port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let body = null;
        try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
        resolve({ status: res.statusCode, body, raw });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function seedBrandedContractor(pool, contractorId, slug, brand) {
  await seedContractor(pool, contractorId);
  await pool.query('UPDATE contractors SET slug = $2, name = $3 WHERE id = $1',
    [contractorId, slug, brand.companyName]);
  await pool.query(
    `UPDATE contractor_settings SET
       company_name = $2, app_display_name = $3,
       primary_color = $4, secondary_color = $5, accent_color = $6, landing_bg_color = $7,
       logo_url = $8, company_phone = $9, company_email = $10,
       company_address = $11, company_url = $12
     WHERE contractor_id = $1`,
    [contractorId, brand.companyName, brand.programName,
      brand.primary, brand.secondary, brand.accent, brand.bg,
      brand.logo, brand.phone, brand.email, brand.address, brand.website]
  );
}

describe('C/DL-3b Phase 1 Step 2 — GET /api/branding/:slug', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    await seedBrandedContractor(pool, TENANT_A, SLUG_A, BRAND_A);
    await seedBrandedContractor(pool, TENANT_B, SLUG_B, BRAND_B);
  });

  // ── RESOLUTION ─────────────────────────────────────────────────────────────

  it('[RED] a valid slug returns THAT contractor\'s palette', async () => {
    const res = await httpRequest(port, `/api/branding/${SLUG_A}`);

    assert.equal(res.status, 200, 'a known slug must resolve at 200');
    assert.equal(res.body.companyName, BRAND_A.companyName);
    assert.equal(res.body.programName, BRAND_A.programName);
    assert.equal(res.body.primaryColor, BRAND_A.primary);
    assert.equal(res.body.secondaryColor, BRAND_A.secondary);
    assert.equal(res.body.accentColor, BRAND_A.accent);
    assert.equal(res.body.backgroundColor, BRAND_A.bg);
    assert.equal(res.body.logoUrl, BRAND_A.logo);
  });

  // TENANCY PREDICATE PROOF. Two contractors exist with two palettes; each slug
  // must return its OWN. A handler that ignored the slug and took "the first
  // contractor row" would pass the single-tenant test above and fail this one.
  it('[RED] a second contractor\'s slug returns the SECOND contractor\'s palette', async () => {
    const a = await httpRequest(port, `/api/branding/${SLUG_A}`);
    const b = await httpRequest(port, `/api/branding/${SLUG_B}`);

    assert.equal(a.body.primaryColor, BRAND_A.primary);
    assert.equal(b.body.primaryColor, BRAND_B.primary);
    assert.notEqual(a.body.companyName, b.body.companyName,
      'the two contractors must not resolve to the same branding');
  });

  it('[RED] an unknown slug returns the neutral defaults at 200, not a 404', async () => {
    const res = await httpRequest(port, `/api/branding/${SLUG_UNKNOWN}`);

    assert.equal(res.status, 200,
      'an unknown slug must be 200 — a 404 makes this endpoint a contractor-slug oracle');
    assert.equal(res.body.companyName, BRANDING_THEME_DEFAULTS.companyName);
    assert.equal(res.body.primaryColor, BRANDING_THEME_DEFAULTS.primaryColor);
    assert.equal(res.body.secondaryColor, BRANDING_THEME_DEFAULTS.secondaryColor);
    assert.equal(res.body.backgroundColor, BRANDING_THEME_DEFAULTS.backgroundColor);
    assert.equal(res.body.logoUrl, null, 'there is deliberately no default logo');
  });

  it('[RED] the RESERVED slug \'app\' returns the neutral defaults at 200', async () => {
    // 'app' is where the React app itself is served from. Source 2 of the D4
    // chain resolves the host on every boot, so this is the single most-requested
    // slug the endpoint will ever see, and it must never resolve to a tenant.
    const res = await httpRequest(port, `/api/branding/${SLUG_RESERVED}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.companyName, BRANDING_THEME_DEFAULTS.companyName);
    assert.equal(res.body.primaryColor, BRANDING_THEME_DEFAULTS.primaryColor);
  });

  it('[RED] a reserved slug stays neutral even when a contractor row holds it', async () => {
    // contractors.slug has a UNIQUE index but NO CHECK constraint
    // (contractorSlug.js:198), so a hand-written statement CAN park a reserved
    // label there. The denylist is the enforcement seam, not the schema.
    await pool.query('UPDATE contractors SET slug = $2 WHERE id = $1', [TENANT_A, SLUG_RESERVED]);

    const res = await httpRequest(port, `/api/branding/${SLUG_RESERVED}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.companyName, BRANDING_THEME_DEFAULTS.companyName,
      'a reserved label must never resolve to a tenant, even one that holds it in the column');
  });

  it('[RED] unknown and reserved responses are INDISTINGUISHABLE — same status, byte-identical body', async () => {
    // THE ANTI-ORACLE ASSERTION. If these two ever differ, the endpoint tells a
    // prober which slugs the platform has reserved and, by elimination, narrows
    // which ones are real tenants.
    const unknown = await httpRequest(port, `/api/branding/${SLUG_UNKNOWN}`);
    const reserved = await httpRequest(port, `/api/branding/${SLUG_RESERVED}`);

    assert.equal(unknown.status, reserved.status, 'status codes must match');
    assert.deepEqual(unknown.body, reserved.body, 'bodies must be deep-equal');
    assert.equal(unknown.raw, reserved.raw,
      'bodies must be byte-identical — a differing key order is still a signal');
  });

  it('[RED] a malformed slug is neutral, not a 400 and not a crash', async () => {
    // Format violations arrive from hand-typed ?brand= values. Each must land on
    // the same neutral answer rather than a distinguishable rejection.
    for (const bogus of ['ab', '-leading', 'trailing-', 'UPPERCASE', 'has_underscore', 'x'.repeat(64)]) {
      const res = await httpRequest(port, `/api/branding/${encodeURIComponent(bogus)}`);
      assert.equal(res.status, 200, `'${bogus}' must resolve neutral at 200`);
      assert.equal(res.body.companyName, BRANDING_THEME_DEFAULTS.companyName,
        `'${bogus}' must resolve to the platform defaults`);
    }
  });

  // ── TENANCY DISCLOSURE ─────────────────────────────────────────────────────

  it('[RED] the response carries NO tenancy-bearing field — full key sweep, not a spot check', async () => {
    // A SWEEP, because the failure mode is an ADDED key, and a spot check only
    // ever catches the keys someone already thought of. The allowlist below is
    // exactly resolveBrandingTheme's output; anything else is a finding.
    //
    // ⚠ WIDENED IN C/DL-3b PHASE 6A BY EXPLICIT RULING, AND THE WIDENING WAS THE
    // DECISION — not an accommodation to make a red test green. The three review
    // fields had a column, admin UI and a PATCH whitelist entry but NO delivery
    // path to the referrer app; the ruling was to widen THIS payload rather than
    // add a second authenticated read, because a second delivery path is a second
    // shape that can drift from the first.
    //
    // WHY IT DOES NOT CHANGE THIS ENDPOINT'S DISCLOSURE POSTURE: all three are
    // public by construction. A review URL is a Google Business link printed on
    // yard signs and invoices; the button text and message are copy a homeowner
    // reads on the surface. None of it is private, none of it is tenancy-bearing,
    // and none of it helps walk the slug space — which is what this endpoint's
    // non-enumerability actually protects.
    //
    // THE SWEEP ITSELF IS UNWEAKENED. It is still an exact allowlist and still
    // fails on any key nobody added deliberately; three names were added to it,
    // and the two assertions below — no contractor id in any key OR VALUE, no slug
    // echoed — are untouched.
    const ALLOWED = new Set([
      'companyName', 'programName',
      'primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor',
      'logoUrl', 'phone', 'email', 'address', 'website',
      'reviewUrl', 'reviewButtonText', 'reviewMessage',
    ]);

    for (const slug of [SLUG_A, SLUG_B, SLUG_UNKNOWN, SLUG_RESERVED]) {
      const res = await httpRequest(port, `/api/branding/${slug}`);
      for (const key of Object.keys(res.body)) {
        assert.ok(ALLOWED.has(key),
          `'${slug}' response carries an unexpected key '${key}' — this endpoint is branding-only`);
      }
    }
  });

  it('[RED] the response never contains a contractor id, in any key or any value', async () => {
    // Value-level too, not only key-level: a contractor_id smuggled inside a
    // string field is the same leak wearing a different hat.
    const res = await httpRequest(port, `/api/branding/${SLUG_A}`);

    assert.ok(!('contractorId' in res.body), 'contractorId must not be present');
    assert.ok(!('contractor_id' in res.body), 'contractor_id must not be present');
    assert.ok(!('id' in res.body), 'id must not be present');
    assert.ok(!('slug' in res.body),
      'no slug is echoed — the caller already holds it, and omitting it is what makes ' +
      'the unknown and reserved bodies byte-identical');
    assert.ok(!res.raw.includes(TENANT_A),
      `the contractor id '${TENANT_A}' must not appear anywhere in the serialised body`);
  });

  // ── READ-ONLY ──────────────────────────────────────────────────────────────

  it('[RED] the endpoint WRITES NOTHING — no scan event, no row anywhere', async () => {
    // The named reason /api/invite/:slug was disqualified (landingResolve.js:275
    // calls recordScanEvent on every resolution). A branding read must never
    // record a scan, so this asserts the invite-link roster is untouched.
    await pool.query('DELETE FROM contractor_invite_links');
    const before = await pool.query('SELECT COUNT(*)::int AS n FROM contractor_invite_links');

    for (const slug of [SLUG_A, SLUG_B, SLUG_UNKNOWN, SLUG_RESERVED]) {
      await httpRequest(port, `/api/branding/${slug}`);
    }

    const after = await pool.query('SELECT COUNT(*)::int AS n FROM contractor_invite_links');
    assert.equal(after.rows[0].n, before.rows[0].n,
      'a branding read must not write to the invite-link roster');
  });

  it('[RED] the endpoint is GET-only — POST/PUT/DELETE do not resolve branding', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = await httpRequest(port, `/api/branding/${SLUG_A}`, { method });
      assert.notEqual(res.status, 200,
        `${method} must not be routed to the branding resolver`);
    }
  });

  // ── RATE LIMITER ───────────────────────────────────────────────────────────

  it('[RED] branding.js exports BRANDING_RESOLVE_LIMIT so the threshold is not hardcoded here', async () => {
    // Same convention referrer.js already uses for LANDING_RESOLVE_LIMIT and
    // RESEND_CODE_LIMIT: the numbers are tuning, and tuning must not break a test.
    const mod = loadBrandingRouter();
    const limit = mod.BRANDING_RESOLVE_LIMIT;

    assert.ok(limit, 'server/routes/branding.js must export BRANDING_RESOLVE_LIMIT');
    assert.ok(Number.isInteger(limit.max) && limit.max > 0, 'max must be a positive integer');
    assert.ok(Number.isInteger(limit.windowMs) && limit.windowMs > 0, 'windowMs must be a positive integer');
  });

  it('[RED] a rate limiter is attached — requests beyond the threshold are rejected with 429', async () => {
    const mod = loadBrandingRouter();
    const limit = mod.BRANDING_RESOLVE_LIMIT;
    assert.ok(limit, 'BRANDING_RESOLVE_LIMIT is not exported yet');

    // ONE fixed IP for this test only, so the burst lands in a single bucket.
    const ip = '10.94.7.7';
    for (let i = 0; i < limit.max; i++) {
      const res = await httpRequest(port, `/api/branding/${SLUG_A}`, { ip });
      assert.notEqual(res.status, 429,
        `request ${i + 1} of ${limit.max} was limited before the threshold`);
    }

    const overLimit = await httpRequest(port, `/api/branding/${SLUG_A}`, { ip });
    assert.equal(overLimit.status, 429, 'the request past the threshold must be rejected');
  });

  it('[RED] the limiter is per-client — one noisy caller does not lock out everyone', async () => {
    const mod = loadBrandingRouter();
    const limit = mod.BRANDING_RESOLVE_LIMIT;
    assert.ok(limit, 'BRANDING_RESOLVE_LIMIT is not exported yet');

    const noisy = '10.94.8.8';
    for (let i = 0; i <= limit.max; i++) {
      await httpRequest(port, `/api/branding/${SLUG_A}`, { ip: noisy });
    }

    const innocent = await httpRequest(port, `/api/branding/${SLUG_A}`, { ip: '10.94.9.9' });
    assert.notEqual(innocent.status, 429, 'one noisy client must not lock out every other visitor');
  });

  it('[RED] the branding limiter is NOT landingResolveLimiter', async () => {
    // Ruling 3, explicit. Sharing a bucket would mean a burst of branding reads
    // on the login screen rate-limits real QR-code scans arriving at
    // /api/invite/:slug — two unrelated surfaces sharing one failure.
    const branding = loadBrandingRouter().BRANDING_RESOLVE_LIMIT;
    const referrer = require('../routes/referrer');

    assert.ok(branding, 'BRANDING_RESOLVE_LIMIT is not exported yet');
    assert.notEqual(branding, referrer.LANDING_RESOLVE_LIMIT,
      'the branding endpoint must not reuse landingResolveLimiter');
  });
});
