'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// POLISH ITEM 3 — PHASE 2 RED SUITE — THE VISIBLE STATE 0 CHANGE
//
// Phase 1 made contractor_settings.company_url AVAILABLE to the landing branding
// theme (landingWebsiteToken.test.js) and shipped safeWebsiteUrl as a validated,
// exported predicate (landingWebsiteUrl.test.js). Nothing renders either one.
// THIS phase is the part a homeowner can see:
//
//   1. State 0's copy forks and stops apologising. The branded page tells the
//      visitor how to get a working link from the company whose sign they
//      scanned; the neutral page explains what a RoofMiles referral link IS,
//      since a stranger who mistyped a subdomain has never heard of the platform.
//   2. A CONTACT BLOCK renders UP TOP, beside the message — phone and website —
//      because a dead link is the one screen where reaching a human IS the task,
//      and a footer is where a homeowner stops looking.
//   3. The footer's contact rows are SUPPRESSED on State 0 so the phone number
//      does not print twice on one short page.
//
// ── WHY A NEW FILE RATHER THAN AN EDIT TO landingStates.test.js ─────────────
// That file's COPY constants (:161-163) still hold the OLD State 0 strings, and
// three other files pin them too — landingMarketingMode.test.js:152-154 and
// landingPlatformMark.test.js:88, which uses the old headline as a BYTE OFFSET to
// bound the header region. Updating those constants is an open, deliberate GREEN
// step. Putting the new assertions here keeps the RED step additive: nothing
// existing is touched, and the old fences stay green until the copy actually
// changes.
//
// ── WHAT THESE ASSERT ON ───────────────────────────────────────────────────
// The served response body, for the reason landingStates.test.js states at
// length: this route's entire contract IS the document it emits. Copy assertions
// run against renderedText(), which decodes the five HTML entities and collapses
// whitespace, so they describe what the VISITOR READS — an apostrophe escaped to
// &#039; renders identically and must not fail a copy test. Structural assertions
// (hrefs, the <svg>, the block marker) run against the RAW markup, because that
// is where structure lives.
//
// ── NON-VACUITY ────────────────────────────────────────────────────────────
// Every absence assertion below states, at its site, what proves the page
// actually rendered first — and, where the distinction matters, what proves it
// rendered the BRANDED page rather than the neutral one. A 500 or an empty body
// satisfies "does not contain X" for entirely the wrong reason.
//
// Preconditions deliberately avoid State 0's HEADLINE, which is itself changing
// in this phase. A precondition that flips with the code under test makes every
// test in the file fail for the same single reason and hides the rest.
//
// ── THE TWO LABELS ─────────────────────────────────────────────────────────
// [RED]                    fails today; this phase's GREEN step makes it pass.
// [GUARD — pre-satisfied]  already true, kept because the natural implementation
//                          of the RED tests beside it would break it.
//
// NO PRODUCTION CONTRACTOR ID, SLUG OR DOMAIN LITERALS (house rule) — every
// tenant id, subdomain and website below is fixture-local and .invalid.
//
// ── THIS FILE WRITES NOTHING TO PRODUCTION ─────────────────────────────────
// setup.js's safety interlock aborts the run unless DATABASE_URL is localhost.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

// ── FIXTURES ────────────────────────────────────────────────────────────────
// Three tenants, one per contact shape. The shapes are the whole point: the
// block's rule is "each row renders only if its data exists", and a single
// fully-populated fixture cannot tell a correct implementation from one that
// hardcodes both rows.
const TENANT_FULL = 'test-tenant-contact-full';     // phone AND website
const TENANT_PHONE = 'test-tenant-contact-phone';   // phone only, company_url NULL
const TENANT_SILENT = 'test-tenant-contact-silent'; // neither

const SLUG_FULL = 'alphacontact';
const SLUG_PHONE = 'betacontact';
const SLUG_SILENT = 'gammacontact';

const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;

// A9: the path is /i/<slug>. /r/ is void and appears nowhere in code.
const landingPath = slug => `/i/${slug}`;

const BRAND_FULL = {
  companyName: 'Alpha Contact Roofing Co',
  primary: '#AA1111',
  phone: '555-0710',
  email: 'hello@alphacontact.invalid',
  address: '1 Alpha Way, Atlanta GA',
  // A BARE DOMAIN, no scheme — the shape the admin Company Details "Website URL"
  // field asks for and the shape nothing between that field and the column
  // normalises. Phase 1 proved it reaches the theme unchanged.
  website: 'alphacontact.invalid',
};

const BRAND_PHONE = {
  companyName: 'Beta Contact Roofing Co',
  primary: '#BB1111',
  phone: '555-0720',
  email: 'hello@betacontact.invalid',
  address: '2 Beta Road, Athens GA',
  website: null,
};

const BRAND_SILENT = {
  companyName: 'Gamma Contact Roofing Co',
  primary: '#CC1111',
  phone: null,
  email: null,
  address: null,
  website: null,
};

// safeWebsiteUrl's contract, hand-written rather than imported. A test that
// derives its expectation from the code under test passes whatever that code
// does — the same rule landingStates.test.js applies to the RoofMiles tokens.
//
// THE TRAILING SLASH IS THE CONTRACT, not an accident: href is parsed.href, which
// normalises a bare origin, while label is the ORIGINAL string. That split exists
// precisely so a homeowner whose roofer's sign says 'alphacontact.invalid' does
// not read 'https://alphacontact.invalid/' as the link text.
const EXPECTED_WEBSITE_HREF = 'https://alphacontact.invalid/';
const EXPECTED_WEBSITE_LABEL = 'alphacontact.invalid';

// RoofMiles neutral token, hand-copied from BRANDING_THEME_DEFAULTS. Used as a
// non-vacuity proof that a response really is the NEUTRAL page.
const RM_SECONDARY = '#1C2D4D';

// ── THE NEW COPY ────────────────────────────────────────────────────────────
// Spec-amended, final. Braced tokens are interpolated by the helpers below.
const NEW_COPY = {
  brandedHeadline: "Let's get you the right link",
  brandedBody: company =>
    `To join ${company}'s referral program, use the link a neighbor or ${company} sent you. ` +
    "If it's expired, just ask them for a fresh one.",

  neutralHeadline: "You'll need a referral link",
  neutralBody:
    'RoofMiles referral links come from a contractor or a neighbor who referred you. ' +
    'Check your texts or email for the link they sent — that link is what connects you ' +
    'to the right company.',
};

// The string this phase RETIRES. Hand-transcribed from LANDING_PAGE_SPEC.md §2
// rather than imported from landingStates.test.js, so that file's constants stay
// untouched and this file's claim is self-contained.
const OLD_INVALID_HEADLINE = "This link isn't active";

// The platform's own site. LOCKED as NEUTRAL-ONLY: a branded page carrying a link
// to roofmiles.com invites a homeowner who came for their roofer to leave for a
// company they have no relationship with.
const PLATFORM_SITE = 'https://roofmiles.com';

// A stable hook for the contact block itself. B3 requires proving the block is
// ABSENT, and an absent block is invisible in the markup without one — the same
// problem A14's empty store-badge slot had, solved the same way
// (landingStates.test.js:154). This suite PROPOSES the attribute name; renaming
// it is a one-line change here and in the implementation. Nothing else in this
// file depends on it: every other assertion is written against hrefs, visible
// text and region slices, which no rename can invalidate.
const CONTACT_BLOCK_MARKER = 'data-contact-block';

// ── THE GLOBE ICON ──────────────────────────────────────────────────────────
// Phosphor's REGULAR-weight Globe, lifted verbatim from
// @phosphor-icons/react/dist/defs/Globe.es.js — the same provenance, and the same
// weight, as the four paths already in ICON_PATHS (landing.js:192).
//
// Written out in full rather than read from node_modules at test time,
// deliberately: a test that resolves its expectation from the same package the
// implementation copies from would pass if BOTH were the wrong icon, and would go
// red on a package bump that changed nothing about this page.
const GLOBE_PATH_D =
  'M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,' +
  '157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,' +
  '1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-2' +
  '4H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.2' +
  '7,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.' +
  '4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.' +
  '3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41' +
  ',213.6Z';

// ── HTTP TRANSPORT ──────────────────────────────────────────────────────────
// Per-request X-Forwarded-For: server/app.js sets `trust proxy 1`, so
// express-rate-limit keys on it. Without per-test IPs the whole file shares one
// bucket and starts 429ing the moment a limiter is added to this route — a suite
// that passes RED and then breaks on GREEN for an unrelated reason.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.95.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
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
          raw: Buffer.concat(chunks).toString(),
        }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── ASSERTION HELPERS ───────────────────────────────────────────────────────

// Decodes the five entities escapeHtml produces and collapses whitespace runs, so
// copy assertions describe what the VISITOR READS. Ampersand is decoded LAST, the
// mirror of escapeHtml's order — decoding it first would turn a literal,
// correctly-escaped "&amp;lt;" into "<". Copied deliberately rather than
// exported from landingStates.test.js, which is a test file, not a helper module.
function renderedText(html) {
  return String(html)
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

// Decoded text with TAGS STRIPPED — what a homeowner actually reads, with no
// attribute values in it. Load-bearing for the phone-count assertion: a tel: href
// carries the number a second time, so counting the raw document would count a
// correct implementation twice.
function visibleText(html) {
  return renderedText(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(haystack, needle) {
  return String(haystack).split(needle).length - 1;
}

// Everything from <body> to the footer's opening tag. The contact block is
// specified to render UP TOP, beside the message, and "up top" is only a real
// claim if it is asserted POSITIONALLY — a block emitted inside the footer would
// satisfy a whole-document search perfectly.
function aboveFooter(raw, label) {
  const bodyStart = raw.indexOf('<body');
  assert.ok(bodyStart > 0, `${label}: precondition — the document must have a body`);
  const footerAt = raw.indexOf('<footer', bodyStart);
  assert.ok(
    footerAt > bodyStart,
    `${label}: precondition — the footer must render, bounding the region above it`
  );
  return raw.slice(bodyStart, footerAt);
}

function footerRegion(raw, label) {
  const footerAt = raw.indexOf('<footer');
  assert.ok(footerAt > 0, `${label}: precondition — the footer must render`);
  const end = raw.indexOf('</footer>', footerAt);
  assert.ok(end > footerAt, `${label}: precondition — the footer must be closed`);
  return raw.slice(footerAt, end + '</footer>'.length);
}

// Returns the full <a>...</a> element whose href is EXACTLY `href`, or null.
// Scoping icon assertions to the anchor is what makes "the WEBSITE ROW carries
// the globe" a real claim rather than "a globe appears somewhere on the page".
function anchorWithHref(raw, href) {
  const re = new RegExp(`<a\\b[^>]*href\\s*=\\s*["']${escapeRe(href)}["'][^>]*>[\\s\\S]*?<\\/a>`, 'i');
  const m = String(raw).match(re);
  return m ? m[0] : null;
}

// An <svg> whose single <path> is the Globe. Matches icon()'s exact emission
// shape (landing.js:203) rather than searching for the path data loose in the
// document, so this cannot be satisfied by the string appearing in a comment or a
// script literal.
const GLOBE_SVG_RE = new RegExp(`<svg\\b[^>]*>\\s*<path\\s+d\\s*=\\s*["']${escapeRe(GLOBE_PATH_D)}["']`, 'i');

// Any link pointing at the platform's own site, in any element.
const PLATFORM_SITE_RE = /href\s*=\s*["']https?:\/\/(?:www\.)?roofmiles\.com[^"']*["']/i;

describe('C/DL-2 polish 3 phase 2 — State 0 copy fork, contact block up top, footer suppression', () => {
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
    // inside this hook and fails every test in the file for a reason that has
    // nothing to do with the landing page.
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedTenant(TENANT_FULL, SLUG_FULL, BRAND_FULL);
    await seedTenant(TENANT_PHONE, SLUG_PHONE, BRAND_PHONE);
    await seedTenant(TENANT_SILENT, SLUG_SILENT, BRAND_SILENT);
  });

  async function seedTenant(contractorId, slug, brand) {
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [contractorId, brand.companyName, slug]
    );
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, primary_color,
          company_phone, company_email, company_address, company_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        contractorId, brand.companyName, brand.primary,
        brand.phone, brand.email, brand.address, brand.website,
      ]
    );
  }

  let _slugCounter = 0;
  async function mintToken({ contractorId, active = true }) {
    _slugCounter += 1;
    const slug = `tok-contact-${Date.now()}-${_slugCounter}`;
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', $3)`,
      [contractorId, slug, active]
    );
    return slug;
  }

  // THE BRANDED STATE 0 TRIGGER. A REVOKED token on a RESOLVED subdomain: the
  // subdomain resolves, nothing is in conflict, so the page carries THAT
  // contractor's theme (landingStates.test.js:445 pins this).
  async function getBrandedInvalid(contractorId, slug) {
    const revoked = await mintToken({ contractorId, active: false });
    return httpGet(port, landingPath(revoked), { host: hostFor(slug) });
  }

  // THE NEUTRAL STATE 0 TRIGGER. A token↔subdomain MISMATCH: resolveLanding
  // trusts neither source, so the payload carries no contractor at all
  // (landingStates.test.js:474).
  async function getNeutralInvalid() {
    const token = await mintToken({ contractorId: TENANT_FULL });
    return httpGet(port, landingPath(token), { host: hostFor(SLUG_PHONE) });
  }

  // A valid marketing token on its own subdomain — the ordinary States 1-3 page.
  async function getState1(contractorId = TENANT_FULL, slug = SLUG_FULL) {
    const token = await mintToken({ contractorId });
    return httpGet(port, landingPath(token), { host: hostFor(slug) });
  }

  // ── SHARED PRECONDITIONS ──────────────────────────────────────────────────
  // Deliberately NOT written against the State 0 headline, which is the very
  // thing this phase changes. A precondition that flips with the code under test
  // would make every test here fail identically and hide which claim broke.

  function assertBrandedStateZero(res, brand, label) {
    assert.equal(res.status, 200, `${label}: State 0 must render (got ${res.status})`);
    assert.match(res.contentType, /text\/html/i, `${label}: State 0 must be HTML, not a JSON error body`);
    assert.ok(
      renderedText(res.raw).includes(brand.companyName),
      `${label}: precondition — this must be the BRANDED State 0 carrying the contractor theme ` +
      `(expected "${brand.companyName}" on the page)`
    );
    assert.ok(
      res.raw.includes(brand.primary),
      `${label}: precondition — the contractor's own palette must be present, proving the ` +
      'subdomain resolved rather than falling through to the neutral theme'
    );
  }

  function assertNeutralStateZero(res, label) {
    assert.equal(res.status, 200, `${label}: State 0 must render (got ${res.status})`);
    assert.match(res.contentType, /text\/html/i, `${label}: State 0 must be HTML, not a JSON error body`);
    assert.ok(
      res.raw.includes(RM_SECONDARY),
      `${label}: precondition — a mismatch must render the NEUTRAL RoofMiles theme ` +
      `(expected ${RM_SECONDARY} in the served theme block)`
    );
    assert.equal(
      renderedText(res.raw).includes(BRAND_FULL.companyName), false,
      `${label}: precondition — a mismatch must name neither side; this response named the token's contractor`
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP A — THE COPY FORK
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] A1 — branded State 0 renders the new branded copy and retires the old apology', async () => {
    // The old copy leads with the failure ("This link isn't active") and ends by
    // telling a homeowner to go ask whoever sent it. The new copy leads with the
    // OUTCOME they came for and names the two places a working link comes from.
    // The company name is interpolated TWICE, which is the interesting half: an
    // implementation that interpolates the first token and hardcodes the second
    // renders a sentence that is subtly about the wrong company.
    const res = await getBrandedInvalid(TENANT_FULL, SLUG_FULL);
    assertBrandedStateZero(res, BRAND_FULL, 'A1 branded State 0');

    const text = renderedText(res.raw);

    assert.ok(
      text.includes(NEW_COPY.brandedHeadline),
      `the branded State 0 headline is locked: "${NEW_COPY.brandedHeadline}"`
    );
    assert.ok(
      text.includes(NEW_COPY.brandedBody(BRAND_FULL.companyName)),
      'the branded State 0 body copy is locked and missing. Expected to contain: ' +
      `"${NEW_COPY.brandedBody(BRAND_FULL.companyName)}"`
    );

    // NON-VACUITY for this absence check: the company name and palette are
    // asserted above, so this proves the old string was REPLACED rather than that
    // the page failed to render.
    assert.equal(
      text.includes(OLD_INVALID_HEADLINE), false,
      `"${OLD_INVALID_HEADLINE}" is retired — it must not appear anywhere in rendered State 0 output`
    );
  });

  it('[RED] A2 — neutral State 0 explains what a referral link IS and links to roofmiles.com', async () => {
    // A stranger who mistyped a subdomain has never heard of this platform. The
    // branded page can say "ask the company"; the neutral one has no company to
    // name — RULED at C/DL-2 Phase 2a, because naming either side of a mismatch
    // confirms to a prober that it resolves. So the neutral page explains the
    // MECHANISM instead, and offers exactly one onward door.
    const res = await getNeutralInvalid();
    assertNeutralStateZero(res, 'A2 neutral State 0');

    const text = renderedText(res.raw);

    assert.ok(
      text.includes(NEW_COPY.neutralHeadline),
      `the neutral State 0 headline is locked: "${NEW_COPY.neutralHeadline}"`
    );
    assert.ok(
      text.includes(NEW_COPY.neutralBody),
      `the neutral State 0 body copy is locked and missing. Expected to contain: "${NEW_COPY.neutralBody}"`
    );
    assert.equal(
      text.includes(OLD_INVALID_HEADLINE), false,
      `"${OLD_INVALID_HEADLINE}" is retired — it must not appear anywhere in rendered State 0 output`
    );

    // THE SOFT SECONDARY. The href is pinned; the wording is not — the spec says
    // "visible text like 'Learn more about RoofMiles'", so this asserts only that
    // the link HAS visible text. A naked URL or an empty anchor is a broken
    // affordance whatever it points at.
    const anchor = anchorWithHref(res.raw, PLATFORM_SITE) || anchorWithHref(res.raw, `${PLATFORM_SITE}/`);
    assert.ok(
      anchor,
      `the neutral State 0 must offer a link to ${PLATFORM_SITE} — the only onward door a visitor ` +
      'with no contractor and no working link has'
    );
    assert.ok(
      visibleText(anchor).trim().length > 0,
      `the ${PLATFORM_SITE} link must carry visible text, not render as an empty anchor. As served: ${anchor}`
    );
  });

  it('[GUARD — pre-satisfied today] A3 — the roofmiles.com link never leaks onto a branded page', async () => {
    // PRE-SATISFIED BY CONSTRUCTION: nothing links to roofmiles.com anywhere today,
    // so this passes on arrival. Its value is entirely post-GREEN. The natural way
    // to implement A2 is to add the link to the shared State 0 body and let the
    // branded variant inherit it — which would put "Learn more about RoofMiles" on
    // a white-labeled page and invite a homeowner who came for their roofer to
    // leave for a company they have no relationship with.
    //
    // NON-VACUITY: assertBrandedStateZero proves a rendered BRANDED page first, so
    // the absence below cannot pass because the response was neutral or empty.
    const res = await getBrandedInvalid(TENANT_FULL, SLUG_FULL);
    assertBrandedStateZero(res, BRAND_FULL, 'A3 branded State 0');

    assert.equal(
      PLATFORM_SITE_RE.test(res.raw), false,
      `${PLATFORM_SITE} is a NEUTRAL-only affordance. A branded page may keep the "Powered by ` +
      'RoofMiles" mark, which is attribution, but must not offer a link away to the platform.'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP B — THE CONTACT BLOCK, UP TOP
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] B1 — branded State 0 renders phone and website rows ABOVE the footer', async () => {
    // POSITION IS PART OF THE CLAIM. A dead link is the one screen where reaching
    // a human IS the task, and a footer is where a homeowner stops looking — so
    // the region is sliced at <footer> and both rows must land above it. A
    // whole-document search would be satisfied by a block emitted inside the
    // footer, which is the arrangement this phase exists to change.
    const res = await getBrandedInvalid(TENANT_FULL, SLUG_FULL);
    assertBrandedStateZero(res, BRAND_FULL, 'B1 branded State 0');

    const top = aboveFooter(res.raw, 'B1 branded State 0');

    assert.ok(
      res.raw.includes(CONTACT_BLOCK_MARKER),
      `the contact block needs a stable hook — expected a "${CONTACT_BLOCK_MARKER}" container ` +
      '(B3 proves the block is ABSENT when there is nothing to show, which is unprovable without one)'
    );

    // PHONE ROW — matches renderFooter's existing tel: pattern, per the decision.
    const telHref = `tel:${BRAND_FULL.phone}`;
    assert.ok(
      anchorWithHref(top, telHref),
      `the contact block must render the phone as a tel: link (expected href="${telHref}") above the footer. ` +
      `Region above the footer as served: ${top}`
    );
    assert.ok(
      visibleText(top).includes(BRAND_FULL.phone),
      `the phone must be READABLE, not only linkable — "${BRAND_FULL.phone}" must appear as visible text`
    );

    // WEBSITE ROW — href normalised by safeWebsiteUrl, label the bare domain the
    // admin typed. Both asserted, because an implementation that renders href as
    // its own link text passes a presence check and shows the homeowner a URL that
    // does not match the sign in their yard.
    const siteAnchor = anchorWithHref(top, EXPECTED_WEBSITE_HREF);
    assert.ok(
      siteAnchor,
      `the contact block must link the contractor website through safeWebsiteUrl — expected ` +
      `href="${EXPECTED_WEBSITE_HREF}" (from company_url "${BRAND_FULL.website}") above the footer. ` +
      `Region above the footer as served: ${top}`
    );
    assert.equal(
      visibleText(siteAnchor).trim(), EXPECTED_WEBSITE_LABEL,
      `the website link's visible label must be the bare domain "${EXPECTED_WEBSITE_LABEL}", not the ` +
      `normalised href. As served: ${siteAnchor}`
    );
  });

  it('[RED] B2 — a contractor with no website renders the phone row and no website row at all', async () => {
    // The rule is per-ROW, not per-block: each row renders only if its data
    // exists. The break this catches is a block that draws both rows structurally
    // and lets the website one come out empty — an anchor with no href, or an
    // href of "https://" with a bare globe beside it, which reads to a homeowner
    // as a link their roofer's site is broken behind.
    const res = await getBrandedInvalid(TENANT_PHONE, SLUG_PHONE);
    assertBrandedStateZero(res, BRAND_PHONE, 'B2 phone-only State 0');

    const top = aboveFooter(res.raw, 'B2 phone-only State 0');

    // NON-VACUITY, and it is the load-bearing half: the block must be PRESENT with
    // its phone row, so the website row's absence is a decision rather than a
    // missing block.
    assert.ok(
      res.raw.includes(CONTACT_BLOCK_MARKER),
      `precondition: the contact block must render for a contractor with a phone — expected ` +
      `"${CONTACT_BLOCK_MARKER}" in the document`
    );
    assert.ok(
      anchorWithHref(top, `tel:${BRAND_PHONE.phone}`),
      `precondition: the phone row must render (expected href="tel:${BRAND_PHONE.phone}" above the footer). ` +
      `Region above the footer as served: ${top}`
    );

    // No website row, and nothing left over from one.
    assert.equal(
      GLOBE_SVG_RE.test(res.raw), false,
      'the globe icon marks the website row; with company_url unset there is no website row to mark'
    );
    assert.equal(
      /href\s*=\s*["']https:\/\/["']/i.test(res.raw), false,
      'a bare "https://" href is a website row that rendered with nothing in it'
    );
    assert.equal(
      /<a\b[^>]*href\s*=\s*["']\s*["']/i.test(res.raw), false,
      'an empty href is a website row that rendered with nothing in it'
    );
    assert.equal(
      /\b(?:null|undefined)\b/.test(visibleText(top)), false,
      'an unset company_url was interpolated into visible copy'
    );
  });

  it('[GUARD — pre-satisfied today] B3 — no phone and no website means no contact block element', async () => {
    // PRE-SATISFIED BY CONSTRUCTION: no block exists today, so this passes on
    // arrival. Its value is post-GREEN — an implementation that emits the
    // container unconditionally and fills it conditionally leaves an empty bordered
    // card on the page of the one contractor who has given a homeowner no way to
    // reach them, which reads as a rendering bug rather than as an absence.
    //
    // The fixture has company_phone, company_email, company_address AND company_url
    // all NULL, so "neither phone nor website resolves" is unambiguous here and
    // this test says nothing about a shape the decision did not rule on.
    //
    // NON-VACUITY: assertBrandedStateZero proves a rendered BRANDED page first.
    const res = await getBrandedInvalid(TENANT_SILENT, SLUG_SILENT);
    assertBrandedStateZero(res, BRAND_SILENT, 'B3 silent State 0');

    assert.equal(
      res.raw.includes(CONTACT_BLOCK_MARKER), false,
      'with neither a phone nor a website there is no contact block to draw — not an empty one'
    );
    assert.equal(
      /href\s*=\s*["']tel:/i.test(res.raw), false,
      'a tel: link on a contractor with no phone can only be an empty row'
    );
    assert.equal(
      GLOBE_SVG_RE.test(res.raw), false,
      'a globe icon on a contractor with no website can only be an empty row'
    );
  });

  it('[RED] B4 — the website row carries the regular-weight Globe as an inline svg', async () => {
    // LP §4's icon set is Phosphor regular, inlined rather than fetched — the four
    // paths already in ICON_PATHS are lifted verbatim from the package's own
    // definitions, and the globe has to arrive the same way to sit correctly
    // beside the phone icon it pairs with.
    //
    // SCOPED TO THE ANCHOR. "A globe appears somewhere on the page" is not the
    // claim; "the website row is marked with one" is. The icon() emission shape
    // (<svg …><path d="…">) is matched exactly, so the path data appearing in a
    // comment or a script literal cannot satisfy this.
    const res = await getBrandedInvalid(TENANT_FULL, SLUG_FULL);
    assertBrandedStateZero(res, BRAND_FULL, 'B4 branded State 0');

    const siteAnchor = anchorWithHref(res.raw, EXPECTED_WEBSITE_HREF);
    assert.ok(
      siteAnchor,
      `precondition: the website row must render (expected href="${EXPECTED_WEBSITE_HREF}") before its ` +
      'icon can be asserted'
    );

    assert.match(
      siteAnchor, GLOBE_SVG_RE,
      'the website row must carry the Phosphor REGULAR Globe as an inline <svg>, emitted through the same ' +
      'ICON_PATHS mechanism as the phone icon beside it. As served: ' + siteAnchor
    );
  });

  it('[RED] B5 — phone and email render, and the missing website row leaves no gap between them', async () => {
    // THE THREE-ROW SHAPE, and the one B2 cannot test. B2 proves the website row
    // is absent when company_url is unset; it says nothing about the EMAIL row,
    // which sits AFTER the website row in the locked order (phone · website ·
    // email). That ordering is what makes this worth its own test: an
    // implementation that builds the rows positionally rather than by pushing
    // each present one — a three-slot template, an array with holes — renders the
    // phone and then loses the email with it, or leaves an empty middle row
    // between them. Both failures need all three columns considered at once, and
    // this fixture is the only one that has two of three set.
    const res = await getBrandedInvalid(TENANT_PHONE, SLUG_PHONE);
    assertBrandedStateZero(res, BRAND_PHONE, 'B5 phone+email State 0');

    const top = aboveFooter(res.raw, 'B5 phone+email State 0');

    // FACT 1 — the phone row.
    assert.ok(
      anchorWithHref(top, `tel:${BRAND_PHONE.phone}`),
      `the contact block must render the phone as a tel: link (expected href="tel:${BRAND_PHONE.phone}"). ` +
      `Region above the footer as served: ${top}`
    );

    // FACT 2 — the email row, as a mailto: link with the address readable.
    const mailAnchor = anchorWithHref(top, `mailto:${BRAND_PHONE.email}`);
    assert.ok(
      mailAnchor,
      `the contact block must render the email as a mailto: link (expected href="mailto:${BRAND_PHONE.email}"), ` +
      'and it must survive the website row above it being skipped. ' +
      `Region above the footer as served: ${top}`
    );
    assert.equal(
      visibleText(mailAnchor).trim(), BRAND_PHONE.email,
      `the email link's visible label must be the address itself. As served: ${mailAnchor}`
    );

    // FACT 3 — no website row, and nothing left where one would have been.
    assert.equal(
      GLOBE_SVG_RE.test(res.raw), false,
      'the globe marks the website row; with company_url unset there is no website row to mark'
    );
    assert.equal(
      /\b(?:null|undefined)\b/.test(visibleText(top)), false,
      'an unset company_url was interpolated into visible copy between the phone and email rows'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP C — FOOTER SUPPRESSION, AND NO DOUBLE PHONE
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] C1 — the phone renders in the contact block, not in the footer, and exactly once', async () => {
    // THE DECISION'S CORE. State 0 is one short page; a phone number printed twice
    // on it reads as a rendering fault, and the copy above the fold is the one the
    // visitor is meant to act on. So the block takes the number and the footer's
    // contact rows are suppressed.
    //
    // ⚠ THE COUNT ALONE IS ALREADY TRUE TODAY — today's footer prints the phone
    // exactly once, so a bare "exactly 1" assertion is green on arrival and proves
    // nothing. What makes this RED is WHERE: the number must be in the block and
    // ABSENT from the footer. The count is what pins the intended END state, and
    // it is what would catch the natural half-implementation — adding the block
    // and forgetting the suppression, which prints it twice.
    //
    // Counted on VISIBLE TEXT, not the raw document: a tel: href carries the
    // number a second time, so a raw count would report 2 for a correct page.
    const res = await getBrandedInvalid(TENANT_FULL, SLUG_FULL);
    assertBrandedStateZero(res, BRAND_FULL, 'C1 branded State 0');

    const top = aboveFooter(res.raw, 'C1 branded State 0');
    const foot = footerRegion(res.raw, 'C1 branded State 0');

    assert.ok(
      visibleText(top).includes(BRAND_FULL.phone),
      `the phone must render in the contact block above the footer ("${BRAND_FULL.phone}"). ` +
      `Region above the footer as served: ${top}`
    );
    assert.equal(
      foot.includes(BRAND_FULL.phone), false,
      'State 0 suppresses the footer contact rows so the phone does not print twice on one short page. ' +
      `Footer as served: ${foot}`
    );

    const seen = countOccurrences(visibleText(res.raw), BRAND_FULL.phone);
    assert.equal(
      seen, 1,
      `the phone must appear exactly once in the rendered page; found ${seen}. Two means the contact ` +
      'block was added without suppressing the footer rows.'
    );
  });

  it('[GUARD — pre-satisfied today] C2 — State 0 suppression removes the contact rows, not the whole footer', async () => {
    // PRE-SATISFIED TODAY, and pointed at the obvious over-correction: deleting
    // renderFooter's call on State 0 rather than its contact rows. "Powered by
    // RoofMiles" is the platform's attribution on every page it serves, and the
    // legal links are required by LP §2 — neither is a contact row and neither is
    // in scope for this suppression.
    const res = await getBrandedInvalid(TENANT_FULL, SLUG_FULL);
    assertBrandedStateZero(res, BRAND_FULL, 'C2 branded State 0');

    const foot = footerRegion(res.raw, 'C2 branded State 0');
    const footText = renderedText(foot);

    assert.ok(footText.includes('Powered by'), `the footer must keep its "Powered by RoofMiles" line. As served: ${foot}`);
    assert.ok(footText.includes('RoofMiles'), `the footer must keep the RoofMiles mark. As served: ${foot}`);
    assert.ok(footText.includes('Privacy'), `the footer must keep its Privacy link. As served: ${foot}`);
    assert.ok(footText.includes('Terms'), `the footer must keep its Terms link. As served: ${foot}`);
  });

  it('[GUARD — pre-satisfied today] C3 — States 1-3 keep their footer contact rows untouched', async () => {
    // THE LEAK GUARD, and the reason it matters more than most: the suppression
    // has exactly one correct home — renderInvalidPage's footer call — and exactly
    // one tempting wrong one, renderFooter itself, which States 1-3 share
    // (landing.js:1134). Moving the rule one function too far up strips the
    // contact card off every signup page in the product, and every existing fence
    // for that card (landingStates.test.js:793) drives State 1 — so it would go
    // red, but only after the change had already been reasoned about as correct.
    // This test is the one that says so in the same breath as the change.
    //
    // MUST BE GREEN BEFORE AND AFTER.
    const res = await getState1(TENANT_FULL, SLUG_FULL);

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    assert.match(res.contentType, /text\/html/i, 'precondition: State 1 must be HTML');
    assert.ok(
      renderedText(res.raw).includes(BRAND_FULL.companyName),
      'precondition: this must be a rendered State 1 page carrying the contractor theme'
    );

    const foot = footerRegion(res.raw, 'C3 State 1');
    const footText = renderedText(foot);

    assert.ok(
      footText.includes(BRAND_FULL.phone),
      `States 1-3 keep the footer contact card — expected the phone (${BRAND_FULL.phone}) in the footer. ` +
      `Footer as served: ${foot}`
    );
    assert.ok(
      footText.includes(BRAND_FULL.email),
      `States 1-3 keep the footer contact card — expected the email (${BRAND_FULL.email}) in the footer. ` +
      `Footer as served: ${foot}`
    );
    assert.ok(
      footText.includes(BRAND_FULL.address),
      `States 1-3 keep the footer contact card — expected the address (${BRAND_FULL.address}) in the footer. ` +
      `Footer as served: ${foot}`
    );
  });
});
