'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3c RED SUITE — loadContractorBranding ON THE SHARED RESOLVER
//
// WHAT IS ACTUALLY WRONG TODAY. Phase 3b made referrer.js and the resolver share
// their DEFAULTS (referrer.js:204-205 aliases BRANDING_THEME_DEFAULTS), but the
// RESOLUTION CODE is still two separate implementations. loadContractorBranding
// (referrer.js:235-254) resolves with a bare `||` per column; the resolver
// validates. Sharing a constant while duplicating the logic that consumes it is
// the same drift shape the Phase 3a/3b guards were built for, one level down: the
// two copies agree on WHAT the fallback is and disagree on WHEN to use it.
//
// THE BEHAVIOUR CHANGE THIS PHASE MAKES, stated plainly rather than smuggled in:
//
//   TODAY   `row.primary_color || DEFAULT` — 'navy', an unprefixed 'F26A1B', a
//           3-digit '#abc' and a whitespace-padded '  #F26A1B  ' are all TRUTHY,
//           so they reach the landing page untouched. The browser cannot parse
//           any of them, so it renders NO COLOUR: a header with no background, an
//           invisible CTA. Nothing throws, nothing is logged, and the contractor
//           sees a broken page with no way to find out why.
//
//   AFTER   the same value goes through resolveColor and lands on the RoofMiles
//           default. A brand-new contractor who typed 'navy' into a free-text
//           colour field gets a decent orange page instead of a broken one.
//
// The values arrive from a free-text admin field, so these are ordinary typing
// mistakes rather than attacks — though the same check also means no
// admin-influenced string is interpolated into a style context.
//
// PRE-WRITE COMPATIBILITY CHECK (required by the phase brief, recorded here so
// the next reader does not have to redo it). This surface already carries ~700
// lines of tests in landingResolution.test.js. Every colour fixture in that file
// (BRAND_A #AA1111/#AA2222/#AA3333, BRAND_B #BB1111/#BB2222/#BB3333) and in
// adminSettingsBranding.test.js (#B0B0B0/#BBBBBB) is a valid six-digit hex, and
// its fallback assertions pin NULL columns, which `||` and the resolver already
// answer identically. NO EXISTING TEST DEPENDS ON THE PERMISSIVE BEHAVIOUR, so
// nothing here contradicts anything already green.
//
// WHY THESE TESTS GO THROUGH THE HTTP ENDPOINT rather than calling the resolver
// directly. brandingTheme.test.js already proves resolveBrandingTheme validates
// hex — exhaustively, table-driven. Repeating that here would prove nothing new.
// What is unproven is that THE LANDING PAYLOAD IS PRODUCED BY IT: the whole
// change is a wiring change, and a wiring change is only observable at the far
// end of the wire.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule) — tenant ids and
// slugs are fixture-local.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

// TWO TENANTS AT MINIMUM WHEREVER TENANCY MATTERS. The malformed tenant and the
// valid tenant exist simultaneously and are always seeded together, so "fell back
// to the default" and "borrowed the neighbour's colour" are distinguishable
// outcomes rather than both reading as "not what was in my row".
const TENANT_BAD  = 'test-tenant-badhex';
const TENANT_GOOD = 'test-tenant-goodhex';

const SLUG_BAD  = 'deltaroofing';
const SLUG_GOOD = 'epsilonroofing';

const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;

// The RoofMiles fallback tokens (LP §5). Written as literals, hand-checked
// against server/utils/brandingTheme.js, NOT imported — an expectation imported
// from the module under test passes whatever that module does.
const FALLBACK_PRIMARY   = '#F26A1B';
const FALLBACK_SECONDARY = '#1C2D4D';
const FALLBACK_BG        = '#FFFFFF';

// Every one of these is TRUTHY, which is the entire point: `||` passes all four
// through and the browser renders none of them.
const BAD_BRAND = {
  companyName: 'Delta Roofing Co',
  primary:   'navy',        // a colour keyword, not a hex value
  secondary: 'F26A1B',      // missing the leading # — the classic paste
  bg:        '#abc',        // 3-digit shorthand: legal CSS, deliberately refused
};

// Deliberately garish and mutually exclusive from anything else in the file, so a
// bleed-through into the malformed tenant's payload is unmistakable in a failure
// message rather than a near-miss.
const GOOD_BRAND = {
  companyName: 'Epsilon Roofing Co',
  primary:   '#CE1111',
  secondary: '#CE2222',
  bg:        '#CE3333',
};

// ── HTTP TRANSPORT ───────────────────────────────────────────────────────────
// Same shape as landingResolution.test.js, including the per-request
// X-Forwarded-For. server/app.js sets `trust proxy 1` and the endpoint carries
// landingResolveLimiter, so without per-test IPs this file would share one
// limiter bucket with itself and start 429ing partway through — a failure that
// looks exactly like the failure under test and is not.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.94.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
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

describe('C/DL-2 Phase 3c — the landing payload resolves through the shared resolver', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  // Delete order copied verbatim from landingResolution.test.js — it is
  // FK-ordered and this file seeds the same tables.
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

  // Seeds one tenant. `settings` is spread straight into the INSERT so each test
  // can state exactly the row shape it is about — the malformed values, the
  // whitespace values, the NULLs — without a fixture helper quietly normalising
  // the very thing under test.
  async function seedTenant(contractorId, slug, contractorName, settings = {}) {
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [contractorId, contractorName, slug]
    );
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, primary_color, secondary_color,
          landing_bg_color, company_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        contractorId,
        'company_name' in settings ? settings.company_name : contractorName,
        settings.primary_color ?? null,
        settings.secondary_color ?? null,
        settings.landing_bg_color ?? null,
        settings.company_address ?? null,
      ]
    );
  }

  // The valid-brand tenant, present in every test as the contamination source.
  async function seedGoodTenant() {
    await seedTenant(TENANT_GOOD, SLUG_GOOD, GOOD_BRAND.companyName, {
      primary_color:    GOOD_BRAND.primary,
      secondary_color:  GOOD_BRAND.secondary,
      landing_bg_color: GOOD_BRAND.bg,
    });
  }

  let _slugCounter = 0;
  async function mintToken(contractorId) {
    _slugCounter += 1;
    const slug = `tok-3c-${Date.now()}-${_slugCounter}`;
    await pool.query(
      `INSERT INTO contractor_invite_links
         (contractor_id, slug, link_type, created_by_user_id, owner_team_member_id, active)
       VALUES ($1, $2, 'contractor', NULL, NULL, true)`,
      [contractorId, slug]
    );
    return slug;
  }

  // NON-VACUITY GATE, used by every test below. A { valid: false } body carries no
  // colours at all, so it would satisfy "the payload does not contain 'navy'" and
  // every other absence assertion in this file while proving nothing whatsoever.
  // Returns the branding block only once the response is provably a real,
  // resolved, correctly-tenanted payload.
  function brandingBlockOf(res, expectedContractorId, expectedCompanyName) {
    assert.equal(res.status, 200, `the landing resolution failed outright: ${res.raw}`);
    assert.equal(res.body && res.body.valid, true, `the payload is State 0, not a resolved page: ${res.raw}`);
    assert.equal(
      res.body.contractorId, expectedContractorId,
      `the payload belongs to a different contractor — nothing below would be about the tenant under test: ${res.raw}`
    );
    const c = res.body.contractor;
    assert.ok(c, `the payload carries no \`contractor\` branding block: ${res.raw}`);
    assert.equal(
      c.companyName, expectedCompanyName,
      `the branding block is not this tenant's — the colour assertions below would prove nothing: ${res.raw}`
    );
    return c;
  }

  // ── 1. MALFORMED HEX — THE BEHAVIOUR CHANGE ────────────────────────────────

  it('[RED] malformed hex in the DB resolves to the RoofMiles default in the landing payload', async () => {
    // THE CENTRAL TEST OF THIS PHASE. Today all three values are truthy, so `||`
    // hands 'navy' / 'F26A1B' / '#abc' straight to the page and the browser
    // renders no colour at all.
    //
    // Asserted on the RESOLVED VALUES, not on absence of the garbage. A payload
    // that simply OMITTED an unparseable colour would satisfy an absence check
    // and still ship an unstyled page — the exact failure this rule prevents.
    await seedGoodTenant();
    await seedTenant(TENANT_BAD, SLUG_BAD, BAD_BRAND.companyName, {
      primary_color:    BAD_BRAND.primary,
      secondary_color:  BAD_BRAND.secondary,
      landing_bg_color: BAD_BRAND.bg,
    });
    const slug = await mintToken(TENANT_BAD);

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_BAD) });
    const c = brandingBlockOf(res, TENANT_BAD, BAD_BRAND.companyName);

    assert.equal(
      String(c.primaryColor).toUpperCase(), FALLBACK_PRIMARY,
      `primaryColor is ${JSON.stringify(c.primaryColor)} — an unparseable value reached the page, ` +
      'where it renders as no colour at all'
    );
    assert.equal(
      String(c.secondaryColor).toUpperCase(), FALLBACK_SECONDARY,
      `secondaryColor is ${JSON.stringify(c.secondaryColor)} — an unprefixed hex reached the page`
    );
    assert.equal(
      String(c.backgroundColor).toUpperCase(), FALLBACK_BG,
      `backgroundColor is ${JSON.stringify(c.backgroundColor)} — the 3-digit shorthand is ` +
      'deliberately refused by the shared resolver, and this payload accepted it'
    );
  });

  it('[RED] a whitespace-padded hex resolves to the default rather than a value nothing can parse', async () => {
    // THE `||` DISCRIMINATOR, and the reason this test exists separately from the
    // one above. '  #F26A1B  ' is truthy AND it contains a well-formed hex, so a
    // half-fix — one that added a `.includes('#')` check, or trimmed on write —
    // would pass the malformed test above and fail here. The resolver's regex is
    // anchored; padding is not a colour.
    await seedGoodTenant();
    await seedTenant(TENANT_BAD, SLUG_BAD, BAD_BRAND.companyName, {
      primary_color: '  #CE1111  ',
    });
    const slug = await mintToken(TENANT_BAD);

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_BAD) });
    const c = brandingBlockOf(res, TENANT_BAD, BAD_BRAND.companyName);

    assert.equal(
      String(c.primaryColor).toUpperCase(), FALLBACK_PRIMARY,
      `primaryColor is ${JSON.stringify(c.primaryColor)} — an untrimmed value is not a colour a ` +
      'browser can parse, and trimming it silently would change the admin\'s saved value behind their back'
    );
  });

  it('[GREEN-by-design] a malformed colour falls back to the PLATFORM default, never to another tenant\'s', async () => {
    // ⚠ GREEN ON ARRIVAL, and the label was corrected after the first run rather
    // than the test being contorted into a false RED. It passes today for a reason
    // that has nothing to do with tenancy: `||` hands back the tenant's own
    // garbage, which is not the neighbour's colour either.
    //
    // It becomes LOAD-BEARING the moment a fallback exists at all. "This column is
    // unusable, find a usable value" is a sentence with an obvious wrong ending,
    // and the wrong ending — reading whichever contractor_settings row happens to
    // have a valid colour — would satisfy every other assertion in this file.
    // Tenant GOOD is fully and validly branded in the same table at the same
    // moment precisely so that ending is decidable.
    await seedGoodTenant();
    await seedTenant(TENANT_BAD, SLUG_BAD, BAD_BRAND.companyName, {
      primary_color:    BAD_BRAND.primary,
      secondary_color:  BAD_BRAND.secondary,
      landing_bg_color: BAD_BRAND.bg,
    });
    const slug = await mintToken(TENANT_BAD);

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_BAD) });
    brandingBlockOf(res, TENANT_BAD, BAD_BRAND.companyName);

    // Asserted on the raw text so a leak buried in a nested field cannot slip past
    // a shallow property check. Non-vacuous: the gate above has already proven
    // this is a populated branding block for tenant BAD.
    for (const [label, value] of Object.entries({
      primary: GOOD_BRAND.primary, secondary: GOOD_BRAND.secondary, background: GOOD_BRAND.bg,
      name: GOOD_BRAND.companyName,
    })) {
      assert.equal(
        res.raw.includes(value), false,
        `the malformed tenant's payload carries the OTHER tenant's ${label} (${value}) — ` +
        'a fallback that reads another contractor\'s row is a white-label breach, not a fallback'
      );
    }
  });

  // ── 2. NO OVER-REACH ───────────────────────────────────────────────────────

  it('[GREEN-by-design] valid values still pass through unchanged, in either case', async () => {
    // THE COUNTERWEIGHT. A resolver that rejected everything would satisfy every
    // assertion above this line and paint every contractor in the platform's
    // orange. Lowercase is included because admins paste out of design tools in
    // both cases and the strict regex accepts both.
    //
    // Green on arrival — `||` already passes valid values through. It is a
    // regression fence around the rewire, not a RED test, and is reported as such.
    await seedGoodTenant();
    await seedTenant(TENANT_BAD, SLUG_BAD, BAD_BRAND.companyName, {
      primary_color: '#a1b2c3',
    });
    const slugGood = await mintToken(TENANT_GOOD);
    const slugLower = await mintToken(TENANT_BAD);

    const good = await httpGet(port, `/api/invite/${slugGood}`, { host: hostFor(SLUG_GOOD) });
    const cGood = brandingBlockOf(good, TENANT_GOOD, GOOD_BRAND.companyName);
    assert.equal(cGood.primaryColor,    GOOD_BRAND.primary);
    assert.equal(cGood.secondaryColor,  GOOD_BRAND.secondary);
    assert.equal(cGood.backgroundColor, GOOD_BRAND.bg);

    const lower = await httpGet(port, `/api/invite/${slugLower}`, { host: hostFor(SLUG_BAD) });
    const cLower = brandingBlockOf(lower, TENANT_BAD, BAD_BRAND.companyName);
    assert.equal(
      cLower.primaryColor, '#a1b2c3',
      'a valid lowercase hex was rejected — the validation over-reached'
    );
  });

  it('[GREEN-by-design] NULL columns resolve to the RoofMiles defaults', async () => {
    // Green on arrival: `||` and the resolver answer NULL identically. Pinned
    // because the rewire must not lose it, and because the phase brief names it.
    await seedGoodTenant();
    await seedTenant(TENANT_BAD, SLUG_BAD, BAD_BRAND.companyName, {
      primary_color: null, secondary_color: null, landing_bg_color: null,
    });
    const slug = await mintToken(TENANT_BAD);

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_BAD) });
    const c = brandingBlockOf(res, TENANT_BAD, BAD_BRAND.companyName);

    assert.equal(String(c.primaryColor).toUpperCase(),    FALLBACK_PRIMARY);
    assert.equal(String(c.secondaryColor).toUpperCase(),  FALLBACK_SECONDARY);
    assert.equal(String(c.backgroundColor).toUpperCase(), FALLBACK_BG);
  });

  it('[GREEN-by-design] empty-string columns resolve to the RoofMiles defaults', async () => {
    // Also green on arrival — '' is falsy, so `||` already reaches the default.
    // A DB column reads NULL; a colour field the admin CLEARED reads ''. Same
    // intent, same answer. Without this the page would be painted with the
    // literal empty string, which a browser renders as no colour at all.
    await seedGoodTenant();
    await seedTenant(TENANT_BAD, SLUG_BAD, BAD_BRAND.companyName, {
      primary_color: '', secondary_color: '', landing_bg_color: '',
    });
    const slug = await mintToken(TENANT_BAD);

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_BAD) });
    const c = brandingBlockOf(res, TENANT_BAD, BAD_BRAND.companyName);

    assert.equal(String(c.primaryColor).toUpperCase(),    FALLBACK_PRIMARY);
    assert.equal(String(c.secondaryColor).toUpperCase(),  FALLBACK_SECONDARY);
    assert.equal(String(c.backgroundColor).toUpperCase(), FALLBACK_BG);
  });

  // ── 3. THE NON-COLOUR TOKENS GO THROUGH THE RESOLVER TOO ───────────────────

  it('[RED] a whitespace-only company_name falls through to the contractor\'s real name', async () => {
    // PROVES THE WHOLE FUNCTION MOVED, not just its three colour lines. The
    // cheapest way to make every colour test above pass is to wrap the three
    // colour expressions in a local hex check and leave the rest of
    // loadContractorBranding alone. This test fails under that fix.
    //
    // The resolver's firstNonEmpty TRIMS before deciding; `||` does not, so today
    // a company_name of '   ' is truthy and is sent to the page as the
    // contractor's name. LP §5's three-step chain exists so that a contractor who
    // has never opened the Branding page still shows THEIR OWN name — a blank
    // header on a homeowner-facing page defeats it just as completely as
    // 'RoofMiles' would.
    await seedGoodTenant();
    await seedTenant(TENANT_BAD, SLUG_BAD, BAD_BRAND.companyName, { company_name: '   ' });
    const slug = await mintToken(TENANT_BAD);

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_BAD) });

    // Cannot use brandingBlockOf here — companyName is the value under test.
    assert.equal(res.status, 200, `the landing resolution failed outright: ${res.raw}`);
    assert.equal(res.body.valid, true, `the payload is State 0, not a resolved page: ${res.raw}`);
    assert.equal(res.body.contractorId, TENANT_BAD, `wrong tenant: ${res.raw}`);
    const c = res.body.contractor;
    assert.ok(c, `the payload carries no \`contractor\` branding block: ${res.raw}`);

    assert.equal(
      c.companyName, BAD_BRAND.companyName,
      `companyName is ${JSON.stringify(c.companyName)} — a blank saved name must fall through to ` +
      'contractors.name (the middle step of the three-step chain), not be sent as the brand'
    );
    assert.equal(
      res.body.contractorName, BAD_BRAND.companyName,
      'the top-level contractorName — the field the SPA reads — was left blank'
    );
  });

  it('[RED] a whitespace-only company_address is omitted entirely, not rendered as a blank row', async () => {
    // Same discriminator, second surface. LP-1: the footer decides whether to draw
    // the contact row by the KEY'S PRESENCE. `if (row.company_address)` is truthy
    // for '   ', so today the key is present and the page draws an empty row.
    await seedGoodTenant();
    await seedTenant(TENANT_BAD, SLUG_BAD, BAD_BRAND.companyName, { company_address: '   ' });
    const slug = await mintToken(TENANT_BAD);

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_BAD) });
    const c = brandingBlockOf(res, TENANT_BAD, BAD_BRAND.companyName);

    assert.equal(
      Object.prototype.hasOwnProperty.call(c, 'address'), false,
      `address is present as ${JSON.stringify(c.address)} — a blank address must be absent, ` +
      'not null and not whitespace, or the footer draws a row with nothing in it'
    );
  });

  it('[GREEN-by-design] the rewire keeps `slug` in the branding block', async () => {
    // THE REGRESSION FENCE FOR THE REWIRE ITSELF, and the single most likely way
    // to break this phase. resolveBrandingTheme deliberately does NOT emit slug —
    // brandingTheme.test.js:63-66 records that as a decision: it is an identity
    // value, not a brand value, with no counterpart in the admin form state.
    // loadContractorBranding returns it anyway, because its callers need it.
    //
    // So `return resolveBrandingTheme(row)` — the obvious one-line rewire —
    // silently drops it. Green on arrival by construction; RED the moment the
    // rewire is done carelessly, which is exactly when it is worth having.
    await seedGoodTenant();
    const slug = await mintToken(TENANT_GOOD);

    const res = await httpGet(port, `/api/invite/${slug}`, { host: hostFor(SLUG_GOOD) });
    const c = brandingBlockOf(res, TENANT_GOOD, GOOD_BRAND.companyName);

    assert.equal(
      c.slug, SLUG_GOOD,
      'the branding block lost its `slug` — resolveBrandingTheme emits no slug token, so the ' +
      'rewire must add it back alongside the resolved tokens rather than returning the resolver\'s output raw'
    );
  });

  // ── 4. THE OTHER CALL SITE ─────────────────────────────────────────────────

  it('[RED] marketing mode resolves malformed hex the same way the token path does', async () => {
    // loadContractorBranding has FOUR call sites (referrer.js:382, 425, 593, 919).
    // Two of them render colours: the token path above and the bare-subdomain
    // marketing path here. They must not be able to disagree — a fix applied at
    // one call site instead of inside the function would leave a contractor's
    // marketing page broken while their invite page rendered correctly.
    await seedGoodTenant();
    await seedTenant(TENANT_BAD, SLUG_BAD, BAD_BRAND.companyName, {
      primary_color:    BAD_BRAND.primary,
      secondary_color:  BAD_BRAND.secondary,
      landing_bg_color: BAD_BRAND.bg,
    });

    const res = await httpGet(port, '/api/invite', { host: hostFor(SLUG_BAD) });
    const c = brandingBlockOf(res, TENANT_BAD, BAD_BRAND.companyName);

    assert.equal(res.body.mode, 'marketing', `expected marketing mode, got ${JSON.stringify(res.body.mode)}`);
    assert.equal(String(c.primaryColor).toUpperCase(),    FALLBACK_PRIMARY);
    assert.equal(String(c.secondaryColor).toUpperCase(),  FALLBACK_SECONDARY);
    assert.equal(String(c.backgroundColor).toUpperCase(), FALLBACK_BG);
  });
});
