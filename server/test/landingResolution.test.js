'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 2a RED SUITE — PUBLIC LANDING RESOLUTION PAYLOAD
//
// The endpoint the landing page calls to learn who it is rendering for. Today it
// is GET /api/invite/:slug and it answers with a HARDCODED module constant
// (referrer.js CONTRACTOR_NAME, Phase 0 finding C9). This file pins the
// white-labeled replacement.
//
// THE ONE RULE EVERYTHING ELSE HANGS OFF:
//   The TOKEN is the tenancy authority. The SUBDOMAIN is cosmetic routing.
// Every contractor-scoped value in the payload is read server-side from the
// TOKEN ROW's contractor_id — never from the hostname, never from a client field.
// The hostname's only job is selecting which branding to show when there is no
// token at all, and being checked for agreement when there is one.
//
// PROPOSED CONTRACT — this file defines it; Phase 2b implements it.
//
//   GET /api/invite/:slug   token present  -> "invite" mode
//   GET /api/invite         no token       -> "marketing" mode (bare subdomain)
//
//   Both paths share one handler and one rate limiter. The second mount is what
//   makes a bare subdomain a first-class valid page rather than a 404.
//
//   VALID (invite mode):
//     {
//       valid: true,
//       mode: 'invite',
//       contractorId: '<internal id, from the TOKEN row>',
//       contractorName: '<company_name>',        // kept at top level: src/App.jsx:88
//       linkType: 'peer' | 'contractor' | 'rep', // reads it today
//       referrer: { displayName: 'Daniel Z.' },  // ABSENT for link_type 'contractor'
//       contractor: {
//         slug, companyName, programName, primaryColor, secondaryColor,
//         backgroundColor, logoUrl, phone, email,
//         address                                // ABSENT when company_address IS NULL
//       }
//     }
//
//   VALID (marketing mode): same, minus `linkType` and `referrer`, with
//     mode: 'marketing' and contractorId resolved from the HOST (there is no token
//     to derive it from, and nothing is written on this path).
//
//   INVALID: { valid: false }   — LP State 0. Unknown/expired/revoked token,
//     unrecognised subdomain, or token↔subdomain mismatch.
//
// WHY contractorName STAYS AT THE TOP LEVEL: src/App.jsx:88 reads `data.contractorName`
// today and Phase 3 owns the UI. Making that field DB-driven is the whole of the C9
// fix; moving it would break the live signup screen for a cosmetic gain.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS anywhere in this file (house rule).
// The one exception is the C9 regression guard, which must name the hardcoded
// COMPANY NAME string it exists to detect — that is a display string, not a
// contractor id, and the assertion is meaningless without it.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedUser } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';
const TENANT_BARE = 'test-tenant-bare';   // every branding column NULL

const SLUG_A = 'alpharoofing';
const SLUG_B = 'betaroofing';
const SLUG_BARE = 'gammaroofing';

const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;

// Branding fixtures. Deliberately garish and mutually exclusive so a bleed-through
// between tenants is unmistakable in a failure message.
const BRAND_A = {
  companyName: 'Alpha Roofing Co',
  programName: 'Alpha Rewards',
  primary: '#AA1111',
  secondary: '#AA2222',
  bg: '#AA3333',
  logo: 'https://cdn.test.invalid/alpha-logo.png',
  phone: '555-0100',
  email: 'hello@alpha.invalid',
  address: '1 Alpha Way, Atlanta GA',
};
const BRAND_B = {
  companyName: 'Beta Roofing Co',
  programName: 'Beta Rewards',
  primary: '#BB1111',
  secondary: '#BB2222',
  bg: '#BB3333',
  logo: 'https://cdn.test.invalid/beta-logo.png',
  phone: '555-0200',
  email: 'hello@beta.invalid',
  address: null,                            // drives the "address absent" assertion
};

// RoofMiles fallback tokens (LP §5). Any NULL branding column resolves to these so
// a brand-new contractor has a decent page before uploading anything.
// ⚠ SWAPPED WITH THE PLATFORM DEFAULTS IN B-1 (2026-09-01). These name the
// primary_color / secondary_color COLUMN defaults, and the ruling made
// primary_color the navy dark neutral and secondary_color the orange action
// colour. The assertions that use them are unchanged.
const FALLBACK_PRIMARY = '#1C2D4D';
const FALLBACK_SECONDARY = '#F26A1B';
const FALLBACK_BG = '#FFFFFF';

// Distinctive owner surnames. Chosen so "the full last name never reaches the page"
// is provable by a substring search that cannot collide with anything else.
const PEER_OWNER_NAME = 'Daniel Zylkiewicz';
const PEER_OWNER_SURNAME = 'Zylkiewicz';
const REP_OWNER_NAME = 'Marcus Vandenbergh';
const REP_OWNER_SURNAME = 'Vandenbergh';

// ── HTTP TRANSPORT ───────────────────────────────────────────────────────────
// Returns { status, body, raw }. `raw` is the undecoded response text — the
// substring guards (C9, surname privacy, cross-tenant bleed) assert against it so
// a value buried in a nested field cannot slip past a shallow property check.
//
// EVERY REQUEST CARRIES ITS OWN X-Forwarded-For BY DEFAULT. server/app.js sets
// `trust proxy 1`, so express-rate-limit keys on that value. Without per-test IPs
// the whole file would share one limiter bucket and start 429ing the moment the
// limiter ships — a suite that passes RED and then breaks on GREEN for a reason
// unrelated to what it tests.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.90.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpGet(port, path, { host = null, ip = null } = {}) {
  const headers = { 'X-Forwarded-For': ip || nextIp() };
  if (host) headers.Host = host;
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method: 'GET', headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          let body = null;
          try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
          resolve({ status: res.statusCode, body, raw });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('C/DL-2 landing resolution — white-labeled payload, token-authoritative', () => {
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
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedTenant(TENANT_A, SLUG_A, BRAND_A);
    await seedTenant(TENANT_B, SLUG_B, BRAND_B);
    // Every branding column NULL — the fallback fixture.
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, 'Gamma Roofing Co', $2)`,
      [TENANT_BARE, SLUG_BARE]
    );
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, 'Gamma Roofing Co')`,
      [TENANT_BARE]
    );
  });

  async function seedTenant(contractorId, slug, brand) {
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [contractorId, brand.companyName, slug]
    );
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, app_display_name, primary_color, secondary_color,
          landing_bg_color, logo_url, company_phone, company_email, company_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        contractorId, brand.companyName, brand.programName, brand.primary, brand.secondary,
        brand.bg, brand.logo, brand.phone, brand.email, brand.address,
      ]
    );
  }

  let _slugCounter = 0;
  function uniqueSlug(prefix) {
    _slugCounter += 1;
    return `${prefix}-${Date.now()}-${_slugCounter}`;
  }

  // Mints a token row directly. link_type-appropriate owner columns only — the
  // chk_invite_links_owner CHECK rejects the wrong pairing, so this helper is also
  // a small proof that the fixtures are shaped like real rows.
  async function mintToken({ contractorId, linkType = 'peer', createdByUserId = null, ownerTeamMemberId = null }) {
    const slug = uniqueSlug(`tok-${linkType}`);
    await pool.query(
      `INSERT INTO contractor_invite_links
         (contractor_id, slug, link_type, created_by_user_id, owner_team_member_id, active)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [contractorId, slug, linkType, createdByUserId, ownerTeamMemberId]
    );
    return slug;
  }

  async function seedTeamMember({ contractorId, fullName, email }) {
    const { rows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, full_name, is_field_rep)
       VALUES ($1, $2, 'hash', 'staff', $3, true)
       RETURNING id`,
      [contractorId, email, fullName]
    );
    return rows[0].id;
  }

  // ── 2. TOKEN RESOLUTION PAYLOAD — WHITE-LABELED ────────────────────────────

  it('[RED] the payload carries branding read from contractor_settings, not a constant', async () => {
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.contractorId, TENANT_A, 'contractorId must come from the token row');
    assert.equal(res.body.contractorName, BRAND_A.companyName, 'contractorName must be DB-driven (C9)');

    const c = res.body.contractor;
    assert.ok(c, 'payload must carry a `contractor` branding block');
    assert.equal(c.slug, SLUG_A);
    assert.equal(c.companyName, BRAND_A.companyName);
    assert.equal(c.programName, BRAND_A.programName, 'programName <- app_display_name');
    assert.equal(c.primaryColor, BRAND_A.primary);
    assert.equal(c.secondaryColor, BRAND_A.secondary);
    assert.equal(c.backgroundColor, BRAND_A.bg, 'backgroundColor <- landing_bg_color');
    assert.equal(c.logoUrl, BRAND_A.logo, 'logoUrl <- logo_url (reused; brand_* columns do not exist)');
    assert.equal(c.phone, BRAND_A.phone);
    assert.equal(c.email, BRAND_A.email);
    assert.equal(c.address, BRAND_A.address, 'company_address is included when non-null');
  });

  it('[RED] C9 REGRESSION GUARD — the hardcoded contractor name never appears in the payload', async () => {
    // The single assertion this whole phase exists to make true. If this is ever
    // red again, someone has reintroduced a module-constant company name.
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });

    assert.equal(
      res.raw.includes('Accent Roofing Service'), false,
      'the payload still carries the hardcoded CONTRACTOR_NAME constant (Phase 0 finding C9)'
    );
  });

  it('[RED] two tenants, one endpoint — each gets its own name, colours and logo', async () => {
    // GUARD-PROOF SITE: during GREEN, change the branding lookup to select a
    // single row without the `WHERE contractor_id = <token's contractor>` predicate
    // and confirm this test goes RED on the bleed-through assertions below.
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });
    const slugB = await mintToken({ contractorId: TENANT_B, linkType: 'contractor' });

    const resA = await httpGet(port, `/api/invite/${slugA}`, { host: hostFor(SLUG_A) });
    const resB = await httpGet(port, `/api/invite/${slugB}`, { host: hostFor(SLUG_B) });

    assert.ok(resA.body.contractor && resB.body.contractor, 'both payloads must carry a `contractor` branding block');
    assert.equal(resA.body.contractor.companyName, BRAND_A.companyName);
    assert.equal(resA.body.contractor.primaryColor, BRAND_A.primary);
    assert.equal(resA.body.contractor.logoUrl, BRAND_A.logo);

    assert.equal(resB.body.contractor.companyName, BRAND_B.companyName);
    assert.equal(resB.body.contractor.primaryColor, BRAND_B.primary);
    assert.equal(resB.body.contractor.logoUrl, BRAND_B.logo);

    // No bleed-through, asserted on the raw text so a nested leak cannot hide.
    assert.equal(resA.raw.includes(BRAND_B.companyName), false, "tenant A's payload leaked tenant B's name");
    assert.equal(resA.raw.includes(BRAND_B.primary), false, "tenant A's payload leaked tenant B's colour");
    assert.equal(resB.raw.includes(BRAND_A.companyName), false, "tenant B's payload leaked tenant A's name");
    assert.equal(resB.raw.includes(BRAND_A.primary), false, "tenant B's payload leaked tenant A's colour");
  });

  it('[RED] the address row is absent when company_address is NULL', async () => {
    // LP-1: render the address row only when non-null. Absent, not empty string —
    // the page decides whether to draw the row by the key's presence.
    const slug = await mintToken({ contractorId: TENANT_B, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_B) });

    assert.equal(res.body.valid, true);
    assert.ok(res.body.contractor, 'payload must carry a `contractor` branding block');
    assert.equal(
      Object.prototype.hasOwnProperty.call(res.body.contractor, 'address'), false,
      'address must be absent — not null, not empty — when company_address IS NULL'
    );
  });

  // ── 3. BRANDING FALLBACK ───────────────────────────────────────────────────

  it('[RED] NULL branding columns resolve to the RoofMiles defaults', async () => {
    // Asserted on the RESOLVED VALUES, not on absence of the fields. A payload that
    // simply omits a NULL colour would pass an absence check and render an unstyled
    // page — which is the exact failure this rule exists to prevent.
    const slug = await mintToken({ contractorId: TENANT_BARE, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_BARE) });

    assert.equal(res.body.valid, true);
    const c = res.body.contractor;
    assert.ok(c, 'payload must carry a `contractor` branding block');
    assert.equal(String(c.primaryColor).toUpperCase(), FALLBACK_PRIMARY);
    assert.equal(String(c.secondaryColor).toUpperCase(), FALLBACK_SECONDARY);
    assert.equal(String(c.backgroundColor).toUpperCase(), FALLBACK_BG);
  });

  it('[RED] a NULL logo stays null rather than falling back to another brand mark', async () => {
    // There is no default logo, and there must not be one: a placeholder borrowed
    // from another contractor is a white-label breach, not a fallback.
    const slug = await mintToken({ contractorId: TENANT_BARE, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_BARE) });

    assert.ok(res.body.contractor, 'payload must carry a `contractor` branding block');
    assert.equal(res.body.contractor.logoUrl, null, 'a missing logo is null, never a substitute image');
  });

  // ── 4. MISMATCH RULE ───────────────────────────────────────────────────────

  it('[RED] a token from contractor A on contractor B\'s subdomain is State 0', async () => {
    // GUARD-PROOF SITE — the mismatch predicate. During GREEN: delete the
    // `tokenContractorId !== hostContractorId` comparison in the handler, re-run,
    // and confirm THIS test goes red (the request starts succeeding) while every
    // other test in the file stays green. Then restore.
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slugA}`, { host: hostFor(SLUG_B) });

    assert.equal(res.body.valid, false, 'token↔subdomain mismatch must be State 0');
  });

  it('[RED] a mismatch rejection leaks nothing about the token\'s contractor', async () => {
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slugA}`, { host: hostFor(SLUG_B) });

    assert.equal(res.raw.includes(BRAND_A.companyName), false, "leaked the token contractor's name");
    assert.equal(res.raw.includes(BRAND_A.primary), false, "leaked the token contractor's colours");
    assert.equal(res.raw.includes(BRAND_A.logo), false, "leaked the token contractor's logo");
    assert.equal(res.raw.includes(TENANT_A), false, "leaked the token contractor's internal id");
  });

  it('[RED] a mismatch does NOT silently fall back to trusting the token', async () => {
    // The failure mode this pins: an implementation that notices the disagreement,
    // shrugs, and renders the token's contractor anyway — which would make the
    // subdomain decorative in the one case where its disagreement is the signal.
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slugA}`, { host: hostFor(SLUG_B) });

    assert.notEqual(res.body.contractorId, TENANT_A, 'the token must not be silently preferred');
    assert.notEqual(res.body.contractorName, BRAND_A.companyName);
    assert.equal(
      Object.prototype.hasOwnProperty.call(res.body, 'linkType'), false,
      'a rejected resolution must not describe the token at all'
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(res.body, 'referrer'), false,
      'a rejected resolution must not carry a referrer chip'
    );
  });

  it('[VACUOUS-TODAY] a mismatch trusts NEITHER side — the subdomain\'s contractor is not rendered either', async () => {
    // LABEL: passes on arrival because today's payload names no contractor from the
    // host at all. It only becomes a real assertion once host branding exists, and
    // it is listed as green-on-arrival in the Phase 2a report rather than contorted
    // into a false RED.
    // RULED (C/DL-2 Phase 2a): the STRICT reading stands — a mismatch renders
    // NEITHER side. LP §2's "contractor branding if the slug resolved" was written
    // for the ORDINARY invalid case (expired or unknown token), where the subdomain
    // is the only signal present and nothing is in conflict. A mismatch is different
    // in kind: two sources of truth actively disagreeing, which happens only through
    // tampering or miswiring. Rendering the subdomain's branding there would confirm
    // to a prober that that subdomain resolves to a real contractor.
    // LP §2 State 0 is amended accordingly — contractor branding for a resolved-slug
    // invalid token, NEUTRAL branding for a mismatch.
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slugA}`, { host: hostFor(SLUG_B) });

    assert.equal(res.raw.includes(BRAND_B.companyName), false, "rendered the subdomain's contractor on a tampering signal");
    assert.equal(res.raw.includes(TENANT_B), false, "leaked the subdomain contractor's internal id");
  });

  it('[GREEN-by-design] a token on its OWN subdomain is unaffected by the mismatch rule', async () => {
    // The counterweight. A mismatch predicate written too broadly (for example one
    // that rejects whenever a Host header is present at all) would satisfy every
    // test above while breaking the only path that matters.
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slugA}`, { host: hostFor(SLUG_A) });

    assert.equal(res.body.valid, true, 'agreement between token and subdomain must resolve normally');
    assert.equal(res.body.contractorId, TENANT_A);
  });

  it('[RED] a token on a neutral host still resolves — no subdomain is not a mismatch', async () => {
    // Amendment A7 keeps a neutral fallback host (go.roofmiles.com) in service, and
    // the apex must not break a link either. "No contractor on the host" is the
    // absence of a claim, not a conflicting one, so the token alone decides.
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slugA}`, { host: APEX });

    assert.equal(res.body.valid, true, 'a hostless-slug request must still resolve from the token');
    assert.equal(res.body.contractorId, TENANT_A);
    assert.ok(res.body.contractor, 'payload must carry a `contractor` branding block');
    assert.equal(res.body.contractor.companyName, BRAND_A.companyName);
  });

  // ── 5. BARE SUBDOMAIN — VALID, NOT AN ERROR ────────────────────────────────

  it('[RED] a known subdomain with no token is a valid contractor-marketing page', async () => {
    const res = await httpGet(port, '/api/invite', { host: hostFor(SLUG_A) });

    assert.equal(res.status, 200, 'a bare subdomain is a page, not a 404');
    assert.equal(res.body.valid, true, 'THIS IS NOT STATE 0 — their subdomain is a marketing asset');
    assert.equal(res.body.mode, 'marketing');
    assert.equal(res.body.contractorId, TENANT_A);
    assert.equal(res.body.contractor.companyName, BRAND_A.companyName);
    assert.equal(res.body.contractor.primaryColor, BRAND_A.primary);
  });

  it('[RED] a bare subdomain carries no referrer chip and no link type', async () => {
    const res = await httpGet(port, '/api/invite', { host: hostFor(SLUG_A) });

    // PRECONDITION, not decoration. Without it the two absence assertions below are
    // satisfied by today's 404 HTML body — a string has neither key — and the test
    // passes green while proving nothing.
    assert.equal(res.status, 200, 'the marketing route must exist before its shape can be asserted');
    assert.equal(res.body.valid, true);
    assert.equal(
      Object.prototype.hasOwnProperty.call(res.body, 'referrer'), false,
      'there is no personal owner without a token — no chip'
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(res.body, 'linkType'), false,
      'there is no token, so there is no link type'
    );
  });

  it('[RED] an unrecognised subdomain with no token is neutral State 0', async () => {
    const res = await httpGet(port, '/api/invite', { host: `nosuchtenant.${APEX}` });

    assert.equal(res.body.valid, false, 'an unknown slug is State 0 (LP §6.4)');
    assert.equal(res.raw.includes(BRAND_A.companyName), false, 'a neutral page names no contractor');
  });

  it('[RED] a bare-subdomain visit writes nothing', async () => {
    // There is no token to scan, and marketing mode must stay a pure read. Pinned
    // because the token path DOES write (recordScanEvent) and the two paths share
    // a handler — the easiest wiring mistake here is one write too many.
    const before = await pool.query('SELECT COUNT(*)::int AS n FROM contractor_invite_links');

    const res = await httpGet(port, '/api/invite', { host: hostFor(SLUG_A) });
    // Same precondition as above — a 404 also writes nothing, and would pass this
    // test for a reason that has nothing to do with the rule under test.
    assert.equal(res.status, 200, 'the marketing route must exist before its writes can be asserted');

    const after = await pool.query('SELECT COUNT(*)::int AS n FROM contractor_invite_links');
    assert.equal(after.rows[0].n, before.rows[0].n, 'marketing mode must not create token rows');
  });

  // ── 6. CHIP PRIVACY AND link_type ──────────────────────────────────────────

  it('[RED] a peer token chip carries first name and last initial only', async () => {
    const userId = await seedUser(pool, {
      fullName: PEER_OWNER_NAME, email: 'peer-owner@alpha.invalid', contractorId: TENANT_A,
    });
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'peer', createdByUserId: userId });

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });

    assert.equal(res.body.valid, true);
    assert.equal(res.body.linkType, 'peer');
    assert.ok(res.body.referrer, 'a personally-owned token must carry a chip');
    assert.equal(res.body.referrer.displayName, 'Daniel Z.');
  });

  it('[RED] a full last name never reaches the page', async () => {
    // GUARD-PROOF SITE: during GREEN, return the owner's full_name unabbreviated
    // and confirm this test goes RED. LP §7 — the full name is never sent, not
    // merely never displayed; a page that receives it has already leaked it.
    const userId = await seedUser(pool, {
      fullName: PEER_OWNER_NAME, email: 'peer-owner@alpha.invalid', contractorId: TENANT_A,
    });
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'peer', createdByUserId: userId });

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });

    // PRECONDITION. "No chip at all" trivially satisfies "the surname is absent",
    // so a payload carrying no owner data would pass this test while the privacy
    // rule remained entirely unimplemented. The chip must exist for its redaction
    // to mean anything.
    assert.ok(res.body.referrer?.displayName, 'the chip must be present for redaction to be provable');
    assert.equal(
      res.raw.includes(PEER_OWNER_SURNAME), false,
      'the owner\'s full surname appeared in the payload'
    );
  });

  it('[RED] a rep token renders a chip, with the same privacy rule', async () => {
    const repId = await seedTeamMember({
      contractorId: TENANT_A, fullName: REP_OWNER_NAME, email: 'rep-owner@alpha.invalid',
    });
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'rep', ownerTeamMemberId: repId });

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });

    assert.equal(res.body.valid, true);
    assert.equal(res.body.linkType, 'rep');
    assert.ok(res.body.referrer, 'a rep token is personally owned — chip renders');
    assert.equal(res.body.referrer.displayName, 'Marcus V.');
    assert.equal(res.raw.includes(REP_OWNER_SURNAME), false, 'the rep\'s full surname appeared in the payload');
  });

  it('[PARTIAL-COVERAGE] a contractor marketing token renders NO chip', async () => {
    // READ THIS BEFORE TRUSTING THIS TEST. It does NOT cover removal of the
    // link_type gate in loadReferrerChip, and must not be mistaken for full
    // coverage of the "never a chip for a contractor token" rule.
    //
    // WHAT ENFORCES THE RULE IS THE SCHEMA, NOT THE CODE. The chk_invite_links_owner
    // CHECK constraint (db.js) requires that a 'contractor' row has BOTH
    // created_by_user_id and owner_team_member_id NULL, so a contractor token is
    // structurally ownerless — there is no name for the handler to leak no matter
    // what it does. Verified by probe during the Phase 2a GREEN phase: deleting the
    // `link_type === 'peer'` gate entirely left all 27 tests in this file green.
    //
    // WHAT IT DOES CATCH: a chip appearing where none belongs — for example a
    // handler that returned { displayName: null } instead of omitting the key.
    // Probed and confirmed RED against that mutation.
    //
    // If the CHECK constraint is ever widened to allow an owned contractor token,
    // this test becomes load-bearing and this comment should be deleted.
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });

    assert.equal(res.body.valid, true);
    assert.equal(res.body.linkType, 'contractor');
    assert.equal(
      Object.prototype.hasOwnProperty.call(res.body, 'referrer'), false,
      'a contractor token has no personal owner — the chip must be absent entirely'
    );
  });

  it('[VACUOUS-TODAY] a peer token whose owner row is gone degrades to no chip, not to a broken one', async () => {
    // created_by_user_id is ON DELETE SET NULL, and production already carries peer
    // rows with a NULL owner (noted at db.js chk_invite_links_owner). The page must
    // stay valid and simply drop the chip.
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'peer', createdByUserId: null });

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });

    assert.equal(res.body.valid, true, 'an ownerless peer token is still a valid link');
    assert.equal(
      Object.prototype.hasOwnProperty.call(res.body, 'referrer'), false,
      'no owner row means no chip — never an empty or partial chip'
    );
  });

  // ── 7. SCAN EVENT UNCHANGED (C/DL-1 behaviour — must not regress) ──────────
  // These pass on arrival and MUST STAY GREEN. They are not RED tests; they are the
  // regression fence around C/DL-1's CD-16 behaviour while Phase 2b rewrites the
  // handler around it.

  it('[GREEN-by-design] resolving a token still records the scan', async () => {
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });

    const { rows } = await pool.query(
      'SELECT scanned_at FROM contractor_invite_links WHERE slug = $1', [slug]
    );
    assert.ok(rows[0].scanned_at, 'resolution must stamp scanned_at');
  });

  it('[GREEN-by-design] a second resolution does not move scanned_at', async () => {
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });
    const first = await pool.query(
      'SELECT scanned_at FROM contractor_invite_links WHERE slug = $1', [slug]
    );
    await new Promise(r => setTimeout(r, 25));
    await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });

    const second = await pool.query(
      'SELECT scanned_at FROM contractor_invite_links WHERE slug = $1', [slug]
    );
    assert.deepEqual(
      second.rows[0].scanned_at, first.rows[0].scanned_at,
      'first scan wins — the WHERE scanned_at IS NULL guard'
    );
  });

  it('[GREEN-by-design] a failed scan write never gates the response', async () => {
    // FAULT INJECTION AT THE DATABASE, not through a mock: a BEFORE UPDATE trigger
    // makes the scan write raise. That exercises the real swallow-and-log path in
    // the handler rather than a stubbed stand-in for it. The trigger is dropped in
    // a finally block so a failure here cannot poison later tests.
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });
    await pool.query(`
      CREATE OR REPLACE FUNCTION test_block_scan_write() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'scan write blocked by test fixture'; END;
      $$ LANGUAGE plpgsql;
    `);
    await pool.query(`
      CREATE TRIGGER test_block_scan_write_trg
      BEFORE UPDATE ON contractor_invite_links
      FOR EACH ROW EXECUTE FUNCTION test_block_scan_write();
    `);

    try {
      const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A) });

      assert.equal(res.status, 200, 'a telemetry failure must not become the visitor\'s failure');
      assert.equal(res.body.valid, true, 'the link is still valid — only the scan record was lost');
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS test_block_scan_write_trg ON contractor_invite_links');
      await pool.query('DROP FUNCTION IF EXISTS test_block_scan_write()');
    }
  });

  // ── 8. RATE LIMITER ────────────────────────────────────────────────────────

  it('[RED] the public resolution endpoint exports a limiter configuration', async () => {
    // Read, never hardcoded. This endpoint takes unauthenticated internet traffic
    // AND performs a write, so it needs a limiter — but the exact numbers are
    // tuning, and a test that pins them would fail on every tune.
    const referrerRouter = require('../routes/referrer');
    const limit = referrerRouter.LANDING_RESOLVE_LIMIT;

    assert.ok(limit, 'referrer.js must export LANDING_RESOLVE_LIMIT so tests read the threshold');
    assert.ok(Number.isInteger(limit.max) && limit.max > 0, 'LANDING_RESOLVE_LIMIT.max must be a positive integer');
    assert.ok(Number.isInteger(limit.windowMs) && limit.windowMs > 0, 'LANDING_RESOLVE_LIMIT.windowMs must be a positive integer');
    assert.ok(
      limit.max <= 100,
      'a conservative limit is the point — a max above 100/window is not a limiter, it is a formality'
    );
  });

  it('[RED] requests beyond the limit are rejected with 429', async () => {
    const referrerRouter = require('../routes/referrer');
    const limit = referrerRouter.LANDING_RESOLVE_LIMIT;
    assert.ok(limit, 'LANDING_RESOLVE_LIMIT is not exported yet');

    // One dedicated IP for this test only — every other request in this file uses a
    // fresh one, so this bucket is untouched at entry.
    const ip = '10.250.250.250';
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    for (let i = 0; i < limit.max; i += 1) {
      const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A), ip });
      assert.notEqual(res.status, 429, `request ${i + 1} of ${limit.max} was limited before the threshold`);
    }

    const overLimit = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A), ip });
    assert.equal(overLimit.status, 429, 'the request past the threshold must be rejected');
  });

  it('[RED] the limiter is per-client, not global', async () => {
    // A limiter keyed on something shared would take the whole landing page down
    // for everyone the moment one scanner got enthusiastic.
    const referrerRouter = require('../routes/referrer');
    const limit = referrerRouter.LANDING_RESOLVE_LIMIT;
    assert.ok(limit, 'LANDING_RESOLVE_LIMIT is not exported yet');

    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });
    const noisyIp = '10.251.251.251';

    for (let i = 0; i <= limit.max; i += 1) {
      await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A), ip: noisyIp });
    }

    const innocent = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_A), ip: '10.252.252.252' });
    assert.notEqual(innocent.status, 429, 'one noisy client must not lock out every other visitor');
  });
});
