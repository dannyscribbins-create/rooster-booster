'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3d-1 RED SUITE — resolveLanding() EXTRACTION
//
// WHAT THIS PHASE MOVES. Mode selection, the mismatch rule, chip privacy, the
// scan event and payload assembly currently live INSIDE the callback of
// `router.get(['/api/invite', '/api/invite/:slug'], ...)` in referrer.js, and the
// three helpers they lean on — loadContractorBranding, toChipName,
// loadReferrerChip — are module-private in that file. referrer.js exports only
// the router (plus LANDING_RESOLVE_LIMIT and ROOFMILES_DEFAULTS), so NONE of this
// is reachable in-process today.
//
// PROPOSED CONTRACT — this file defines it; the implementation phase satisfies it.
//
//   server/utils/landingResolve.js
//     async resolveLanding(db, { host, slug }) -> payload object
//
//   `db` may be a pool or a checked-out client, matching resolveToken,
//   isSlugMutable and resolveHostToContractor — every other shared util in this
//   family takes that shape and this one must not be the exception.
//
//   `host` is the raw Host header (or req.hostname). `slug` is the token slug, or
//   null/undefined for marketing mode.
//
//   The return value is EXACTLY the object the JSON endpoint sends today.
//
// WHY THIS IS THE WHOLE POINT OF THE PHASE. The HTML landing page (3d-2) needs
// the same resolution the JSON endpoint performs. The cheap way to get it is to
// write a second copy inside the HTML route. That would give the product TWO
// mismatch rules and TWO chip-privacy rules that agree on the day they are
// written and drift thereafter.
//
// That is not hypothetical here. server/utils/brandingTheme.js's own header
// documents this exact shape having ALREADY happened once in this codebase:
// BrandingPreview.jsx and the server fell back to different palettes, a
// contractor with no saved colours saw one brand in the admin preview and a
// different one on their live surface, neither of them theirs, and nothing
// failed. One implementation, called twice, is the only durable answer.
//
// THE LOAD-BEARING TEST IN THIS FILE is 'PARITY' below: for identical inputs,
// resolveLanding's return value and the HTTP endpoint's JSON body must be
// DEEP-EQUAL. Field-by-field assertions prove the payload is right; the parity
// test proves there is one implementation rather than two that currently agree.
// Every other test here would stay green against a copy-paste.
//
// THE EXISTING SUITES ARE THE OTHER HALF OF THE PROOF. landingResolution.test.js
// (27 tests), landingBrandingResolver.test.js and hostResolution.test.js are all
// pointed at the HTTP handler. They must stay green through the extraction
// WITHOUT modification — that is what makes it an extraction rather than a
// rewrite. If any of them needs editing to accommodate this work, STOP: the
// behaviour changed and that is a finding, not a merge conflict.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS anywhere in this file (house rule).
// Two-tenant fixtures throughout, because tenancy is exactly what the mismatch
// rule and the branding predicate exist to protect.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedUser } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';

const SLUG_A = 'alpharoofing';
const SLUG_B = 'betaroofing';

const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;

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
  address: null,
};

// Distinctive surnames — chosen so "the full last name never reaches the payload"
// is provable by a substring search that cannot collide with anything else.
const PEER_OWNER_NAME = 'Daniel Zylkiewicz';
const PEER_OWNER_SURNAME = 'Zylkiewicz';
const REP_OWNER_NAME = 'Marcus Vandenbergh';
const REP_OWNER_SURNAME = 'Vandenbergh';

// LAZY REQUIRE, deliberately, and not a top-of-file import.
//
// server/utils/landingResolve.js does not exist yet. A top-level require would
// throw at module load, node:test would report ONE file-level error, and not a
// single test in this file would run — including the ones that would still have
// something useful to say. Loading it per-test means every test reports its own
// honest RED.
function loadResolveLanding() {
  let mod;
  try {
    mod = require('../utils/landingResolve');
  } catch (err) {
    assert.fail(
      `server/utils/landingResolve.js is not requirable yet (${err.code || err.message}). ` +
      'The extraction has not happened.'
    );
  }
  assert.equal(
    typeof mod.resolveLanding, 'function',
    'server/utils/landingResolve.js must export an async function `resolveLanding`'
  );
  return mod.resolveLanding;
}

let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.91.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
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

describe('C/DL-2 Phase 3d-1 — resolveLanding() extraction', () => {
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

  async function mintToken({
    contractorId, linkType = 'peer', createdByUserId = null, ownerTeamMemberId = null,
    active = true, expiresAt = null,
  }) {
    const slug = uniqueSlug(`tok-${linkType}`);
    await pool.query(
      `INSERT INTO contractor_invite_links
         (contractor_id, slug, link_type, created_by_user_id, owner_team_member_id, active, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [contractorId, slug, linkType, createdByUserId, ownerTeamMemberId, active, expiresAt]
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

  async function scannedAt(slug) {
    const { rows } = await pool.query(
      'SELECT scanned_at FROM contractor_invite_links WHERE slug = $1', [slug]
    );
    return rows[0] ? rows[0].scanned_at : undefined;
  }

  // ── 1. THE MODULE EXISTS AND IS CALLABLE IN-PROCESS ────────────────────────

  it('[RED] landingResolve.js exports resolveLanding and it is callable with a pool', async () => {
    // The bare existence check. Everything below assumes it; naming it separately
    // means a missing module reports as ONE clear failure rather than fifteen
    // confusing ones.
    const resolveLanding = loadResolveLanding();
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const payload = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.ok(payload && typeof payload === 'object', 'resolveLanding must return an object');
  });

  it('[RED] resolveLanding accepts a checked-out client, not only the pool', async () => {
    // Matches resolveToken / isSlugMutable / resolveHostToContractor, every one of
    // which documents "db may be a pool or a checked-out client". A resolver that
    // closes over the pool instead of taking it cannot be called inside a
    // transaction, and would be the one member of this family that is different.
    const resolveLanding = loadResolveLanding();
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const client = await pool.connect();
    try {
      const payload = await resolveLanding(client, { host: hostFor(SLUG_A), slug });
      assert.equal(payload.valid, true, 'resolution through a checked-out client must work identically');
      assert.equal(payload.contractorId, TENANT_A);
    } finally {
      client.release();
    }
  });

  // ── 2. INVITE MODE — FIELD-BY-FIELD ────────────────────────────────────────

  it('[RED] invite mode returns the full payload, field by field', async () => {
    // Deliberately NOT a loose shape check. Asserting `payload.contractor` is
    // truthy would pass against a block carrying the wrong tenant's colours.
    const resolveLanding = loadResolveLanding();
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.equal(p.valid, true);
    assert.equal(p.mode, 'invite');
    assert.equal(p.contractorId, TENANT_A, 'contractorId comes from the TOKEN row');
    assert.equal(p.contractorName, BRAND_A.companyName, 'contractorName stays at the top level (src/App.jsx reads it)');
    assert.equal(p.linkType, 'contractor');

    const c = p.contractor;
    assert.ok(c, 'invite payload must carry a `contractor` branding block');
    assert.equal(c.slug, SLUG_A, 'slug is re-attached explicitly — the resolver itself emits none');
    assert.equal(c.companyName, BRAND_A.companyName);
    assert.equal(c.programName, BRAND_A.programName);
    assert.equal(c.primaryColor, BRAND_A.primary);
    assert.equal(c.secondaryColor, BRAND_A.secondary);
    assert.equal(c.backgroundColor, BRAND_A.bg);
    assert.equal(c.logoUrl, BRAND_A.logo);
    assert.equal(c.phone, BRAND_A.phone);
    assert.equal(c.email, BRAND_A.email);
    assert.equal(c.address, BRAND_A.address);
    assert.equal(typeof c.accentColor, 'string', 'accentColor is part of the shipped token set');
  });

  it('[RED] the address key is ABSENT, not null, when company_address is unset', async () => {
    // NON-VACUITY: `valid === true` and the branding block's presence are asserted
    // first. Without them, a `{ valid: false }` payload — which has no `contractor`
    // key at all — would satisfy "address is absent" while proving nothing about
    // the omit-don't-null rule.
    const resolveLanding = loadResolveLanding();
    const slug = await mintToken({ contractorId: TENANT_B, linkType: 'contractor' });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_B), slug });

    assert.equal(p.valid, true, 'precondition: the resolution must succeed');
    assert.ok(p.contractor, 'precondition: the branding block must exist');
    assert.equal(
      Object.prototype.hasOwnProperty.call(p.contractor, 'address'), false,
      'address must be absent — the footer draws the contact row by the key\'s presence'
    );
  });

  // ── 3. MARKETING MODE ──────────────────────────────────────────────────────

  it('[RED] marketing mode resolves from the host with no token', async () => {
    const resolveLanding = loadResolveLanding();

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug: null });

    assert.equal(p.valid, true);
    assert.equal(p.mode, 'marketing');
    assert.equal(p.contractorId, TENANT_A);
    assert.equal(p.contractorName, BRAND_A.companyName);
    assert.ok(p.contractor, 'marketing payload must carry branding');
    assert.equal(p.contractor.primaryColor, BRAND_A.primary);
  });

  it('[RED] marketing mode carries no linkType and no chip', async () => {
    // NON-VACUITY: `valid === true` first. A `{ valid: false }` payload has neither
    // key either, and would pass both absence assertions while the marketing path
    // remained entirely unimplemented.
    const resolveLanding = loadResolveLanding();

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug: null });

    assert.equal(p.valid, true, 'precondition: marketing mode must succeed before its shape means anything');
    assert.equal(Object.prototype.hasOwnProperty.call(p, 'linkType'), false, 'no token, no link type');
    assert.equal(Object.prototype.hasOwnProperty.call(p, 'referrer'), false, 'no token owner, no chip');
  });

  it('[RED] marketing mode writes nothing', async () => {
    // The two modes share one function, and the easiest wiring mistake in an
    // extraction is one write too many on the path that has no token to write to.
    const resolveLanding = loadResolveLanding();
    const before = await pool.query('SELECT COUNT(*)::int AS n FROM contractor_invite_links');

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug: null });
    assert.equal(p.valid, true, 'precondition: a failed resolution also writes nothing');

    const after = await pool.query('SELECT COUNT(*)::int AS n FROM contractor_invite_links');
    assert.equal(after.rows[0].n, before.rows[0].n, 'marketing mode must stay a pure read');
  });

  it('[RED] an unrecognised subdomain with no token is neutral State 0', async () => {
    const resolveLanding = loadResolveLanding();

    const p = await resolveLanding(pool, { host: `nosuchtenant.${APEX}`, slug: null });

    assert.equal(p.valid, false);
    assert.equal(
      JSON.stringify(p).includes(BRAND_A.companyName), false,
      'a neutral State 0 names no contractor'
    );
  });

  // ── 4. INVALID PATHS ───────────────────────────────────────────────────────

  it('[RED] an unknown slug is State 0', async () => {
    const resolveLanding = loadResolveLanding();

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug: 'no-such-token-anywhere' });

    assert.equal(p.valid, false);
  });

  it('[RED] an EXPIRED token is State 0', async () => {
    // resolveToken's expiry predicate must survive the move. CD-14: an expired
    // token is never resurrected.
    const resolveLanding = loadResolveLanding();
    const slug = await mintToken({
      contractorId: TENANT_A, linkType: 'contractor',
      expiresAt: new Date(Date.now() - 60_000),
    });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.equal(p.valid, false, 'an expired token must not resolve');
  });

  it('[RED] an INACTIVE (revoked) token is State 0', async () => {
    const resolveLanding = loadResolveLanding();
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor', active: false });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.equal(p.valid, false, 'a revoked token must not resolve');
  });

  // ── 5. THE MISMATCH RULE SURVIVES THE EXTRACTION ───────────────────────────

  it('[RED] token contractor != host contractor is State 0', async () => {
    // GUARD-PROOF SITE — the mismatch predicate, now in landingResolve.js. During
    // GREEN: delete the `hostContractor.id !== token.contractor_id` comparison,
    // re-run, and confirm THIS test goes red while the rest of the file stays
    // green. Then restore. The same probe is documented at the HTTP layer in
    // landingResolution.test.js; both must go red, which is itself evidence there
    // is only one predicate to delete.
    const resolveLanding = loadResolveLanding();
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_B), slug: slugA });

    assert.equal(p.valid, false, 'token↔subdomain mismatch must be State 0');
  });

  it('[RED] a mismatch carries branding from NEITHER side', async () => {
    // NON-VACUITY: `valid === false` is asserted first, so these absence checks
    // describe a REJECTION that disclosed nothing — not an unimplemented function
    // returning undefined, whose serialisation contains no brand strings either.
    //
    // Both directions matter. Leaking the TOKEN's contractor tells a prober whose
    // link they hold; leaking the HOST's contractor confirms that subdomain
    // resolves to a real tenant. A mismatch happens only through tampering or
    // miswiring, so neither source is trusted.
    const resolveLanding = loadResolveLanding();
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_B), slug: slugA });
    assert.equal(p.valid, false, 'precondition: the resolution must actually have been rejected');

    const serialised = JSON.stringify(p);
    assert.equal(serialised.includes(BRAND_A.companyName), false, "leaked the TOKEN contractor's name");
    assert.equal(serialised.includes(BRAND_A.primary), false, "leaked the TOKEN contractor's colour");
    assert.equal(serialised.includes(BRAND_A.logo), false, "leaked the TOKEN contractor's logo");
    assert.equal(serialised.includes(TENANT_A), false, "leaked the TOKEN contractor's internal id");
    assert.equal(serialised.includes(BRAND_B.companyName), false, "leaked the HOST contractor's name");
    assert.equal(serialised.includes(TENANT_B), false, "leaked the HOST contractor's internal id");
    assert.equal(
      Object.prototype.hasOwnProperty.call(p, 'linkType'), false,
      'a rejected resolution must not describe the token at all'
    );
  });

  it('[RED] a token on its OWN subdomain is unaffected by the mismatch rule', async () => {
    // The counterweight. A predicate written too broadly — one that rejects
    // whenever a Host header is present, say — would satisfy every mismatch test
    // above while breaking the only path that matters.
    const resolveLanding = loadResolveLanding();
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug: slugA });

    assert.equal(p.valid, true, 'agreement must resolve normally');
    assert.equal(p.contractorId, TENANT_A);
  });

  it('[RED] a token on a neutral host still resolves — no subdomain is not a mismatch', async () => {
    // Amendment A7 keeps go.roofmiles.com in service as the neutral invite host.
    // "No contractor on the host" is the absence of a claim, not a conflicting one.
    const resolveLanding = loadResolveLanding();
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const p = await resolveLanding(pool, { host: APEX, slug: slugA });

    assert.equal(p.valid, true, 'a hostless-slug request resolves from the token alone');
    assert.equal(p.contractorId, TENANT_A);
  });

  // ── 6. CHIP PRIVACY SURVIVES THE EXTRACTION ────────────────────────────────

  it('[RED] a peer chip is first name + last initial only', async () => {
    const resolveLanding = loadResolveLanding();
    const userId = await seedUser(pool, {
      fullName: PEER_OWNER_NAME, email: 'peer-owner@alpha.invalid', contractorId: TENANT_A,
    });
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'peer', createdByUserId: userId });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.equal(p.valid, true);
    assert.equal(p.linkType, 'peer');
    assert.ok(p.referrer, 'a personally-owned token carries a chip');
    assert.equal(p.referrer.displayName, 'Daniel Z.');
  });

  it('[RED] the full surname never appears anywhere in the payload', async () => {
    // GUARD-PROOF SITE: during GREEN, return the owner's full_name unabbreviated
    // and confirm this goes RED.
    //
    // NON-VACUITY: the chip's presence is asserted FIRST. "No chip at all"
    // trivially satisfies "the surname is absent", so a resolver that dropped
    // owner data entirely would pass this test with the privacy rule
    // unimplemented. The chip must exist for its redaction to mean anything.
    //
    // Asserted against the serialised payload rather than referrer.displayName,
    // so a surname surviving in some other field cannot slip past.
    const resolveLanding = loadResolveLanding();
    const userId = await seedUser(pool, {
      fullName: PEER_OWNER_NAME, email: 'peer-owner@alpha.invalid', contractorId: TENANT_A,
    });
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'peer', createdByUserId: userId });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.ok(p.referrer?.displayName, 'precondition: the chip must be present for redaction to be provable');
    assert.equal(
      JSON.stringify(p).includes(PEER_OWNER_SURNAME), false,
      "the owner's full surname reached the payload — LP §7 requires it is never SENT, not merely never shown"
    );
  });

  it('[RED] a rep chip follows the same rule', async () => {
    const resolveLanding = loadResolveLanding();
    const repId = await seedTeamMember({
      contractorId: TENANT_A, fullName: REP_OWNER_NAME, email: 'rep-owner@alpha.invalid',
    });
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'rep', ownerTeamMemberId: repId });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.equal(p.valid, true);
    assert.equal(p.linkType, 'rep');
    assert.ok(p.referrer?.displayName, 'precondition: a rep token is personally owned — chip renders');
    assert.equal(p.referrer.displayName, 'Marcus V.');
    assert.equal(
      JSON.stringify(p).includes(REP_OWNER_SURNAME), false,
      "the rep's full surname reached the payload"
    );
  });

  it('[RED] a contractor marketing token renders NO chip', async () => {
    // NON-VACUITY: `valid === true` and `linkType === 'contractor'` are asserted
    // first, so "referrer is absent" describes a SUCCESSFUL contractor-token
    // resolution rather than a rejected one.
    //
    // PARTIAL COVERAGE, and this is inherited from landingResolution.test.js's
    // finding rather than a weakness introduced here: the chk_invite_links_owner
    // CHECK constraint makes a 'contractor' row structurally ownerless, so there
    // is no name for the resolver to leak whatever it does. What this DOES catch
    // is a chip key appearing where none belongs — `{ displayName: null }` instead
    // of an omitted key.
    const resolveLanding = loadResolveLanding();
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.equal(p.valid, true, 'precondition: the resolution must have succeeded');
    assert.equal(p.linkType, 'contractor');
    assert.equal(
      Object.prototype.hasOwnProperty.call(p, 'referrer'), false,
      'a contractor token has no personal owner — the chip key must be absent entirely'
    );
  });

  it('[RED] an ownerless peer token degrades to no chip, not a broken one', async () => {
    // created_by_user_id is ON DELETE SET NULL and production already carries peer
    // rows with a NULL owner — an ordinary case that must stay a valid link.
    const resolveLanding = loadResolveLanding();
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'peer', createdByUserId: null });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.equal(p.valid, true, 'precondition: an ownerless peer token is still valid');
    assert.equal(
      Object.prototype.hasOwnProperty.call(p, 'referrer'), false,
      'no owner row means no chip — never an empty or partial one'
    );
  });

  // ── 7. THE SCAN EVENT SURVIVES, IN THE RIGHT ORDER ─────────────────────────

  it('[RED] resolving a token through resolveLanding records the scan', async () => {
    const resolveLanding = loadResolveLanding();
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.equal(p.valid, true, 'precondition: the token must have resolved');
    assert.ok(await scannedAt(slug), 'CD-16 — resolution stamps scanned_at');
  });

  it('[RED] a MISMATCH records no scan — the check runs first', async () => {
    // ORDERING, asserted as behaviour rather than trusted from a code comment. The
    // scan write must sit AFTER the mismatch check so a tampering attempt never
    // writes to the roster. An extraction that reorders these two would leave every
    // other test in this file green.
    //
    // NON-VACUITY: `valid === false` is asserted first. If the function simply
    // failed to resolve anything, scanned_at would also be NULL and this test
    // would pass without the ordering rule existing.
    const resolveLanding = loadResolveLanding();
    const slugA = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const p = await resolveLanding(pool, { host: hostFor(SLUG_B), slug: slugA });
    assert.equal(p.valid, false, 'precondition: this must be the mismatch rejection path');

    assert.equal(
      await scannedAt(slugA), null,
      'a rejected mismatch must not write to the roster'
    );
  });

  it('[RED] a second resolution does not move scanned_at', async () => {
    const resolveLanding = loadResolveLanding();
    const slug = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    await resolveLanding(pool, { host: hostFor(SLUG_A), slug });
    const first = await scannedAt(slug);
    assert.ok(first, 'precondition: the first resolution must have stamped');

    await new Promise(r => setTimeout(r, 25));
    await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

    assert.deepEqual(await scannedAt(slug), first, 'first scan wins — the WHERE scanned_at IS NULL guard');
  });

  it('[RED] a failed scan write never gates the resolution', async () => {
    // FAULT INJECTION AT THE DATABASE, not through a mock: a BEFORE UPDATE trigger
    // makes the scan write raise, exercising the real swallow-and-log path rather
    // than a stubbed stand-in. A telemetry failure costs a roster row; letting it
    // throw would cost the homeowner their signup.
    //
    // HOW the swallowed error gets logged is an implementation choice — the
    // extracted function has no `req` to hand logError(). This test pins only the
    // behavioural contract: it does not throw, and the payload is unharmed.
    const resolveLanding = loadResolveLanding();
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
      const p = await resolveLanding(pool, { host: hostFor(SLUG_A), slug });

      assert.equal(p.valid, true, 'a telemetry failure must not become the visitor\'s failure');
      assert.equal(p.contractorId, TENANT_A, 'the payload is unaffected by the lost scan record');
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS test_block_scan_write_trg ON contractor_invite_links');
      await pool.query('DROP FUNCTION IF EXISTS test_block_scan_write()');
    }
  });

  // ── 8. PARITY — THE TEST THIS WHOLE FILE EXISTS FOR ────────────────────────

  it('[RED] PARITY — resolveLanding and the HTTP endpoint return deep-equal payloads', async () => {
    // THE LOAD-BEARING ASSERTION OF PHASE 3d-1.
    //
    // Every other test in this file would stay green if someone satisfied it by
    // writing a SECOND implementation inside landingResolve.js and leaving the
    // route callback untouched. Two implementations that agree today are exactly
    // the state brandingTheme.js's header describes as having already produced a
    // live white-label breach in this codebase.
    //
    // This test is what makes that shortcut fail — not immediately, but the moment
    // the two drift by a single field. Running it across five scenarios rather
    // than one is deliberate: a copy is most likely to diverge on the paths its
    // author thought about least, which are the rejections.
    //
    // assert.deepEqual from node:assert/strict is deepSTRICTEqual, which compares
    // own keys. That matters here: `{ address: undefined }` and an omitted
    // `address` are NOT equal under it, so the omit-don't-null rule is checked by
    // this test too, on both sides of the boundary at once.
    const resolveLanding = loadResolveLanding();

    const peerUserId = await seedUser(pool, {
      fullName: PEER_OWNER_NAME, email: 'parity-peer@alpha.invalid', contractorId: TENANT_A,
    });

    const scenarios = [
      {
        name: 'invite / contractor token on its own subdomain',
        slug: await mintToken({ contractorId: TENANT_A, linkType: 'contractor' }),
        host: hostFor(SLUG_A),
      },
      {
        name: 'invite / peer token with a chip',
        slug: await mintToken({ contractorId: TENANT_A, linkType: 'peer', createdByUserId: peerUserId }),
        host: hostFor(SLUG_A),
      },
      {
        name: 'invite / token on tenant B, whose address is NULL',
        slug: await mintToken({ contractorId: TENANT_B, linkType: 'contractor' }),
        host: hostFor(SLUG_B),
      },
      {
        name: 'marketing / bare subdomain',
        slug: null,
        host: hostFor(SLUG_A),
      },
      {
        name: 'State 0 / unknown slug',
        slug: 'no-such-token-anywhere',
        host: hostFor(SLUG_A),
      },
    ];

    for (const s of scenarios) {
      const direct = await resolveLanding(pool, { host: s.host, slug: s.slug });

      const path = s.slug ? `/api/invite/${s.slug}` : '/api/invite';
      const res = await httpGet(port, path, { host: s.host });

      // NON-VACUITY. Without this the comparison could be "undefined deep-equals
      // undefined" between an unimplemented function and a 404 body — two
      // nothings matching perfectly and proving less than nothing.
      assert.equal(res.status, 200, `[${s.name}] the HTTP endpoint must answer 200, got ${res.status}: ${res.raw}`);
      assert.ok(direct && typeof direct === 'object', `[${s.name}] resolveLanding returned no object`);
      assert.ok(res.body && typeof res.body === 'object', `[${s.name}] the endpoint returned no JSON object: ${res.raw}`);

      assert.deepEqual(
        direct, res.body,
        `[${s.name}] the in-process resolution and the HTTP body disagree — ` +
        'there are two implementations, not one.\n' +
        `  direct: ${JSON.stringify(direct)}\n` +
        `  http:   ${res.raw}`
      );
    }
  });

  it('[RED] PARITY — the route delegates rather than duplicating (no second resolution path)', async () => {
    // The structural half of the parity claim, and the reason it is separate from
    // the behavioural one above: two implementations can agree on every payload
    // and still be two implementations.
    //
    // Reads the route's own module for the private helpers that MUST have moved
    // out. If referrer.js still defines loadContractorBranding / toChipName /
    // loadReferrerChip, the extraction left a copy behind — which is the precise
    // failure mode this phase exists to prevent.
    const fs = require('fs');
    const path = require('path');
    const referrerSrc = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'referrer.js'), 'utf8'
    );

    assert.match(
      referrerSrc, /require\(['"]\.\.\/utils\/landingResolve['"]\)/,
      'referrer.js must require ../utils/landingResolve — the route delegates to the shared resolver'
    );

    for (const helper of ['function loadContractorBranding', 'function toChipName', 'function loadReferrerChip']) {
      assert.equal(
        referrerSrc.includes(helper), false,
        `referrer.js still defines \`${helper}\` — it moved to landingResolve.js, ` +
        'and a copy left behind is the drift this extraction exists to prevent'
      );
    }
  });
});
