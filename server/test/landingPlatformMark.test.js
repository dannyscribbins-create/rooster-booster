'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — POLISH ITEMS 1+2 RED SUITE — THE PLATFORM MARK IN THE NEUTRAL HEADER
//
// The neutral/platform landing header must render the RoofMiles icon+wordmark as
// an IMAGE, not as the company name in styled text.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
// This surface is completely unfenced today. renderBrandMark (landing.js:513) has
// exactly two arms — the contractor logo via safeLogoUrl, and the company name as
// text — and the neutral theme falls into the second one, so the platform's own
// page introduces itself with the word "RoofMiles" set in Montserrat. Nothing
// asserts that either way. The two existing no-logo fences
// (landingStates.test.js:1181 and :1216) both drive REAL CONTRACTORS and say
// nothing about the neutral theme.
//
// ── THE TRAP THIS FILE IS POINTED AT ────────────────────────────────────────
// The obvious implementation is `if (theme.companyName === 'RoofMiles')`. It is
// wrong, and it is wrong in a way that looks entirely reasonable in review: a
// REAL CONTRACTOR can resolve to companyName 'RoofMiles' as the resolver's last
// resort, when neither contractor_settings.company_name nor contractors.name
// yields anything (landingStates.test.js:1216 pins exactly that, and requires it
// to render as TEXT). A name comparison would put the platform image in that
// contractor's header. Test 2 below is the guard; it must pass before AND after.
//
// The distinction therefore has to be a marker on the theme OBJECT —
// neutralTheme() gains isPlatform:true — not an inference from a value.
//
// ── WHY THESE ASSERT ON THE TAG, NEVER ON THE TEXT ──────────────────────────
// A text-level `includes('RoofMiles')` CANNOT test this. landingStates.test.js's
// renderedText() decodes entities and collapses whitespace but does NOT strip
// tags, so `alt="RoofMiles"` satisfies a text search just as well as
// `<div class="brand-name">RoofMiles</div>` does — and so does the word in the
// footer's "Powered by RoofMiles". Every assertion below is against the RAW
// markup: the <img> tag and its src attribute specifically.
//
// ── NON-VACUITY ─────────────────────────────────────────────────────────────
// Both tests assert 200 + text/html + the State 0 headline before touching the
// header, and Test 2 additionally proves it received the CONTRACTOR theme rather
// than the neutral one before asserting the platform image is absent — otherwise
// a trigger that silently produced a neutral page would satisfy its absence check
// for entirely the wrong reason and the guard would be worthless.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
//
// ── THIS FILE WRITES NOTHING TO PRODUCTION ──────────────────────────────────
// setup.js's safety interlock aborts the run unless DATABASE_URL is localhost.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

// ── FIXTURES ────────────────────────────────────────────────────────────────
// Two branded tenants (the mismatch that produces a neutral page needs two), plus
// one with every branding column NULL — the real contractor Test 2 drives.
const TENANT_A = 'test-tenant-mark-a';
const TENANT_B = 'test-tenant-mark-b';
const TENANT_BARE = 'test-tenant-mark-bare';

const SLUG_A = 'alphamark';
const SLUG_B = 'betamark';
const SLUG_BARE = 'gammamark';

const BARE_COMPANY = 'Gamma Mark Roofing Co';

const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;

// A9: the path is /i/<slug>. /r/ is void and appears nowhere in code.
const landingPath = slug => `/i/${slug}`;

// THE CONTRACT UNDER TEST. server/public/ is mounted at /static by
// server/app.js:45, so a file at server/public/roofmiles-logo.png is addressable
// here. Written as a literal rather than imported from the implementation — a
// test that derives its expectation from the code under test passes whatever
// that code does.
const PLATFORM_MARK_SRC = '/static/roofmiles-logo.png';

// State 0's headline, hand-transcribed, used as a BYTE OFFSET to bound the
// header region below. Rendered as a literal in renderInvalidPage — not passed
// through escapeHtml — so each matches the RAW markup byte for byte, straight
// apostrophes and all. That property is load-bearing here and survives A21: an
// escaped headline would arrive as "Let&#039;s" and indexOf would return -1,
// collapsing the header slice rather than failing an assertion honestly.
//
// ── TWO CONSTANTS SINCE A21, WHERE ONE USED TO DO ──────────────────────────
// RETIRED: `const INVALID_HEADLINE = "This link isn't active"`, which both tests
// below shared because both variants rendered it. State 0's copy now FORKS, and
// the two tests in this file deliberately drive DIFFERENT variants — Test 1 a
// MISMATCH (neutral), Test 2 a revoked token on a resolved subdomain (branded).
// A single constant would now silently fail to find its offset on one of them.
const NEUTRAL_HEADLINE = "You'll need a referral link";
const BRANDED_HEADLINE = "Let's get you the right link";

// The text arm of renderBrandMark. Matching the OPENING TAG rather than the class
// name alone, so this cannot be satisfied by the word appearing in a comment.
const BRAND_NAME_TAG = '<div class="brand-name">';

let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.93.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
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
          contentType: res.headers['content-type'] || '',
          headers: res.headers,
          raw: Buffer.concat(chunks).toString(),
        }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// Matches an <img> whose src is EXACTLY the platform mark. Anchored on the tag
// open and the quoted attribute value, so a substring of some longer path cannot
// satisfy it.
const PLATFORM_IMG_RE = new RegExp(
  `<img\\b[^>]*\\bsrc\\s*=\\s*["']${PLATFORM_MARK_SRC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
  'i'
);

describe('C/DL-2 polish 1+2 — the neutral/platform header renders the RoofMiles mark as an image', () => {
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
    // ORDER IS LOAD-BEARING — `titles` carries an FK to `contractors` and db.js's
    // startup seed creates title rows. Deleting contractors first raises 23503
    // inside this hook and fails the file for a reason unrelated to the header.
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedBranded(TENANT_A, SLUG_A, 'Alpha Mark Roofing Co', '#AA1111');
    await seedBranded(TENANT_B, SLUG_B, 'Beta Mark Roofing Co', '#BB1111');

    // logo_url is DELIBERATELY absent — this is the contractor that must keep
    // rendering its NAME as text after the platform branch lands.
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [TENANT_BARE, BARE_COMPANY, SLUG_BARE]
    );
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, $2)`,
      [TENANT_BARE, BARE_COMPANY]
    );
  });

  async function seedBranded(contractorId, slug, companyName, primary) {
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [contractorId, companyName, slug]
    );
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name, primary_color)
       VALUES ($1, $2, $3)`,
      [contractorId, companyName, primary]
    );
  }

  let _slugCounter = 0;
  async function mintToken({ contractorId, active = true }) {
    _slugCounter += 1;
    const slug = `tok-mark-${Date.now()}-${_slugCounter}`;
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', $3)`,
      [contractorId, slug, active]
    );
    return slug;
  }

  // Everything from <body> up to the State 0 headline. renderInvalidPage emits
  // the brand mark immediately inside <body> and the headline directly after it,
  // so this is the header region — the same slicing landingStates.test.js:1206
  // uses, and what keeps these assertions about the LOGO SLOT rather than about
  // the whole document (the footer's "Powered by RoofMiles" sits well below it).
  // `headline` IS A PARAMETER SINCE A21 rather than a file constant: the two
  // tests drive different State 0 variants and therefore different headlines, and
  // passing the wrong one collapses the slice to nothing instead of failing.
  function headerRegion(raw, label, headline) {
    const bodyStart = raw.indexOf('<body');
    assert.ok(bodyStart > 0, `${label}: precondition — the document must have a body`);
    const headlineAt = raw.indexOf(headline, bodyStart);
    assert.ok(
      headlineAt > bodyStart,
      `${label}: precondition — the State 0 headline "${headline}" must render, bounding the header region`
    );
    return raw.slice(bodyStart, headlineAt);
  }

  function assertStateZeroRendered(res, label, headline) {
    assert.equal(res.status, 200, `${label}: State 0 must render (got ${res.status})`);
    assert.match(res.contentType, /text\/html/i, `${label}: it must be HTML, not a JSON error body`);
    assert.ok(
      res.raw.includes(headline),
      `${label}: precondition — this must be the State 0 page (expected "${headline}")`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1 — THE NEUTRAL HEADER RENDERS THE PLATFORM IMAGE
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] the neutral/platform State 0 header renders the RoofMiles mark as an <img>, not as text', async () => {
    // A token↔subdomain MISMATCH is the neutral trigger: resolveLanding trusts
    // neither side, so the payload carries no contractor and renderInvalidPage
    // falls to neutralTheme() (landing.js:560). Mirrored from
    // landingStates.test.js:474.
    const token = await mintToken({ contractorId: TENANT_A });

    const res = await httpGet(port, landingPath(token), { host: hostFor(SLUG_B) });

    assertStateZeroRendered(res, 'neutral State 0', NEUTRAL_HEADLINE);
    const header = headerRegion(res.raw, 'neutral State 0', NEUTRAL_HEADLINE);

    // ── THE CLAIM ────────────────────────────────────────────────────────────
    // Asserted against the RAW markup and the src ATTRIBUTE. The word "RoofMiles"
    // is useless as a signal here: it is in the footer on every page, and it
    // would be in this header's alt= even when the image is correct.
    assert.match(
      header, PLATFORM_IMG_RE,
      'the platform header must render the RoofMiles icon+wordmark as an image served from ' +
      `${PLATFORM_MARK_SRC}. The platform page is the one surface where a mark IS the brand, and ` +
      'today it introduces itself with its own name set in Montserrat. ' +
      `Header region as served: ${header}`
    );

    // The other half of the same claim: it must have STOPPED taking the text arm.
    // Without this, an implementation that emitted both would pass the assertion
    // above while shipping a duplicated brand.
    assert.equal(
      header.includes(BRAND_NAME_TAG), false,
      'the platform header must take the image arm INSTEAD of the styled-text arm, not as well as it. ' +
      `Header region as served: ${header}`
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2 — A REAL CONTRACTOR WITH NO LOGO STILL RENDERS TEXT
  // ═══════════════════════════════════════════════════════════════════════════

  it('a real contractor with no logo renders its NAME as text, never the platform mark', async () => {
    // PRE-SATISFIED BY CONSTRUCTION, and deliberately so. Nothing renders a
    // platform image today, so this passes on arrival. Its job is to fail the
    // moment the isPlatform branch is implemented as a companyName comparison, or
    // is placed where a contractor theme can reach it — which is the single most
    // likely way to get this wrong. It must be green before AND after.
    //
    // A REVOKED token on a RESOLVED subdomain is the branded State 0 trigger
    // (landingStates.test.js:445): the subdomain resolves, nothing is in conflict,
    // so the page carries THAT contractor's theme. TENANT_BARE has logo_url NULL,
    // so renderBrandMark takes the no-logo arm with a real contractor theme.
    const revoked = await mintToken({ contractorId: TENANT_BARE, active: false });

    const res = await httpGet(port, landingPath(revoked), { host: hostFor(SLUG_BARE) });

    assertStateZeroRendered(res, 'branded State 0', BRANDED_HEADLINE);
    const header = headerRegion(res.raw, 'branded State 0', BRANDED_HEADLINE);

    // ── NON-VACUITY, AND THIS IS THE LOAD-BEARING PRECONDITION ───────────────
    // Proves this response carries the CONTRACTOR theme rather than the neutral
    // one. If the trigger silently produced a neutral page, the absence check
    // below would pass for entirely the wrong reason and this guard would be
    // worth nothing — which matters more here than usual, because a pre-satisfied
    // test gives no signal on the day it is written.
    assert.ok(
      header.includes(BARE_COMPANY),
      'precondition: this must be the BRANDED State 0 carrying the contractor theme — ' +
      `expected "${BARE_COMPANY}" in the header. Header region as served: ${header}`
    );
    assert.ok(
      header.includes(BRAND_NAME_TAG),
      'a contractor with no logo must render its name through the styled-text arm. ' +
      `Header region as served: ${header}`
    );

    // ── THE GUARD ────────────────────────────────────────────────────────────
    assert.equal(
      PLATFORM_IMG_RE.test(header), false,
      'the platform mark must never stand in for a contractor. A contractor with no logo already ' +
      'refuses to fall back to the RoofMiles NAME (landingStates.test.js:1181) — falling back to ' +
      'the RoofMiles IMAGE is the same white-label breach with better artwork. ' +
      `Header region as served: ${header}`
    );
    assert.equal(
      header.includes(PLATFORM_MARK_SRC), false,
      `no contractor header may reference ${PLATFORM_MARK_SRC} at all, in any element. ` +
      `Header region as served: ${header}`
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3 — THE FILE BEHIND THE SRC ACTUALLY RESOLVES
  // ═══════════════════════════════════════════════════════════════════════════

  it('the platform mark file actually resolves at /static/roofmiles-logo.png (200, image/png)', async () => {
    // THE SEAM THE OTHER TWO TESTS CANNOT SEE. Test 1 proves the TAG is emitted
    // with the right src; landingStaticAssets.test.js proves the /static MOUNT
    // serves files and never enumerates filenames. Neither proves THIS file is
    // reachable, so a one-character typo in the filename — or an asset that never
    // got committed — passes every other test in the repo and surfaces only as a
    // broken image in a homeowner's browser, on the platform's own front door.
    //
    // Asserted against the SAME literal Test 1 asserts the tag carries, so the two
    // cannot drift: if the src is renamed without moving the file, this goes red.
    const res = await httpGet(port, PLATFORM_MARK_SRC);

    assert.equal(
      res.status, 200,
      `${PLATFORM_MARK_SRC} must resolve. The file lives at server/public/roofmiles-logo.png and is ` +
      `served by the /static mount in server/app.js. Got ${res.status} — either the filename does not ` +
      'match the src rendered by renderBrandMark, or the asset is missing from server/public.'
    );

    // NON-VACUITY: the 200 above is what makes this meaningful — a 404 carries a
    // text/html body and would fail this for the wrong reason.
    assert.match(
      String(res.headers['content-type'] || ''), /^image\/png/,
      `${PLATFORM_MARK_SRC} must be served as image/png, got: ${res.headers['content-type']}`
    );

    // A zero-byte file would satisfy both assertions above and still render
    // nothing. express.static sets Content-Length from the file on disk.
    const contentLength = Number(res.headers['content-length']);
    assert.ok(
      Number.isFinite(contentLength) && contentLength > 0,
      `${PLATFORM_MARK_SRC} must have a non-zero body, got Content-Length: ${res.headers['content-length']}`
    );
  });
});
