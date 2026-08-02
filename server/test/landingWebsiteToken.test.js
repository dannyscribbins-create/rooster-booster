'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// POLISH ITEM 3 — PHASE 1 RED SUITE — THE WEBSITE TOKEN REACHES THE LOADER
//
// WHAT THIS PHASE DOES AND DELIBERATELY DOES NOT DO. Phase 1 makes the
// contractor's website AVAILABLE to the landing branding theme. Nothing renders
// it — the branded State 0 contact block is Phase 2. Splitting it this way keeps
// the data question ("does the value arrive?") separate from the markup question
// ("is the href safe, and where does the row sit?"), which are answered by
// different code and fail in different ways.
//
// ── WHY THIS FILE EXISTS SEPARATELY FROM brandingTheme.test.js ──────────────
// brandingTheme.test.js pins resolveBrandingTheme, which is PURE — it maps an
// input object to tokens and has no idea where that object came from. It can be
// fully green on `website` while the landing page still shows nothing, because
// the value never reaches it: loadContractorBranding's SELECT
// (server/utils/landingResolve.js:86-96) names its columns explicitly and
// company_url is not among them.
//
// That gap is invisible to a pure-function test by construction. It is exactly
// the shape of bug this repo has been bitten by before — every piece correct in
// isolation, the wire between them never connected, and nothing failing. So the
// wire gets its own assertion.
//
// ── WHY loadContractorBranding IS CALLED DIRECTLY ──────────────────────────
// Rather than through GET /api/invite/:slug or the rendered page. The claim
// under test is one line of SQL, and a direct call fails for exactly one reason.
// Routing it through HTTP would add app boot, host resolution, token resolution
// and a rate limiter to the failure surface — four more ways for this test to go
// red for a reason that is not the reason. The far-end proofs (the JSON payload,
// the rendered contact row) belong to Phase 2, where there is something to
// render.
//
// NO PRODUCTION CONTRACTOR ID, SLUG OR DOMAIN LITERALS (house rule) — the tenant
// id, subdomain slug and website below are fixture-local and .invalid.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');

const TENANT = 'test-tenant-website';
const SLUG = 'zetaroofing';

// A BARE DOMAIN, no scheme — the shape the admin Company Details "Website URL"
// field asks for (its placeholder is a bare domain) and the shape nothing
// between that field and the database normalises. If the loader ever starts
// editing this value, this fixture is what catches it.
const BRAND = {
  companyName: 'Zeta Roofing Co',
  phone:       '555-0700',
  website:     'zetaroofing.invalid',
};

// LAZY REQUIRE, matching landingResolve.test.js:113-128. A top-level require of
// a module that failed to load would report as one file-level error and hide the
// individual expectation, which is the opposite of what a RED suite is for.
function loadContractorBrandingFn() {
  let mod;
  try {
    mod = require('../utils/landingResolve');
  } catch (err) {
    assert.fail(
      `server/utils/landingResolve.js is not requirable (${err.code || err.message}).`
    );
  }
  assert.equal(
    typeof mod.loadContractorBranding, 'function',
    'server/utils/landingResolve.js must export loadContractorBranding'
  );
  return mod.loadContractorBranding;
}

describe('Polish item 3 Phase 1 — the website token reaches the landing branding theme', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  // FK-ordered, copied verbatim from landingBrandingResolver.test.js:148-155.
  // This file seeds only two of these tables, but the suites share one database
  // and run sequentially (--test-concurrency=1), so rows left by a previous file
  // would block DELETE FROM contractors on a foreign key.
  beforeEach(async () => {
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');
  });

  // company_phone is seeded ALONGSIDE company_url on purpose. It is a column the
  // SELECT already carries, so it is the control: if phone arrives and website
  // does not, the SELECT is the fault. If neither arrives, the fixture is.
  async function seedTenant() {
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [TENANT, BRAND.companyName, SLUG]
    );
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, company_phone, company_url)
       VALUES ($1, $2, $3, $4)`,
      [TENANT, BRAND.companyName, BRAND.phone, BRAND.website]
    );
  }

  it('[RED] loadContractorBranding carries company_url through to the theme as `website`', async () => {
    // FAILS TODAY FOR TWO REASONS AT ONCE, and both must be fixed for it to pass:
    // resolveBrandingTheme emits no website token, and the SELECT does not read
    // the column. That is correct for an integration assertion — it is the only
    // test in the phase that goes red if either half is done without the other,
    // which is precisely why the pure-resolver tests cannot stand in for it.
    const loadContractorBranding = loadContractorBrandingFn();

    await seedTenant();

    const theme = await loadContractorBranding(pool, TENANT);

    // ── NON-VACUITY, in order of what each rules out ──────────────────────────
    // Without these three, a null return or a mis-seeded row would produce the
    // same "website is undefined" failure as the missing column, and the RED
    // would prove nothing.
    assert.ok(theme, 'precondition: the loader returned nothing — the contractor row was not seeded');
    assert.equal(
      theme.companyName, BRAND.companyName,
      'precondition: the loader did not read the seeded contractor_settings row'
    );
    assert.equal(
      theme.phone, BRAND.phone,
      'precondition: company_phone — a column the SELECT ALREADY carries — did not arrive, ' +
      'so the fixture is at fault rather than the missing company_url'
    );

    assert.equal(
      theme.website, BRAND.website,
      'the resolved theme must carry the contractor website. loadContractorBranding\'s SELECT ' +
      '(server/utils/landingResolve.js:86-96) names its columns explicitly and company_url is ' +
      'not among them, so the value never reaches resolveBrandingTheme at all'
    );
  });
});
