'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3a RED SUITE — SHARED BRANDING THEME MAPPING
//
// THE PROBLEM THIS SOLVES. Three places currently decide what colour a
// contractor's surface is painted, and they do not agree:
//
//   server/routes/referrer.js:198   ROOFMILES_DEFAULTS  #F26A1B / #1C2D4D / #FFFFFF
//   src/components/admin/BrandingPreview.jsx:13-15      #012854 / #CC0000 / #D3E3F0
//   server/routes/admin/index.js:580-604 (zero-row)     Accent's literals
//
// BrandingPreview is ALREADY DRIFTED. Its three fallbacks are Accent Roofing's
// navy, red and light blue — the platform's original single-tenant palette,
// hardcoded before RoofMiles had a default of its own. A contractor who has
// saved no colours sees Accent's brand in the admin preview and RoofMiles' brand
// on the live surface. Neither is theirs, and the two disagree with each other.
//
// This file pins ONE pure resolver that the server-rendered landing page
// (Phase 3b) and the admin preview both call, and — the load-bearing test — a
// DRIFT GUARD that reads the server's own exported defaults rather than
// re-typing the hex values, so the mapping and referrer.js cannot silently
// diverge the way the preview already has.
//
// PROPOSED CONTRACT — this file defines it; the GREEN phase implements it.
//
//   server/utils/brandingTheme.js
//     resolveBrandingTheme(input) -> theme tokens
//     BRANDING_THEME_DEFAULTS      -> the frozen fallback set
//
//   PURE. No pool, no req, no network, no env. That is what lets the same
//   function serve the preview (unsaved form state, keystroke by keystroke) and
//   the page (a row already read from contractor_settings).
//
//   ONE INPUT SHAPE, snake_case, because both callers already speak it: the
//   admin form state IS the GET /api/admin/settings response object
//   (BrandingPreview reads formData.primary_color, formData.app_display_name),
//   and the page's input is the contractor_settings row those columns came from.
//
//   Recognised input keys:
//     company_name, contractor_name, app_display_name,
//     primary_color, secondary_color, landing_bg_color, logo_url,
//     company_phone, company_email, company_address
//
//   Output keys (camelCase, matching loadContractorBranding's existing block at
//   referrer.js:233-252 so the landing payload can adopt this resolver without
//   a shape change):
//     companyName, programName, primaryColor, secondaryColor, backgroundColor,
//     logoUrl, phone, email, and address ONLY WHEN SET.
//
// TWO DELIBERATE BEHAVIOUR ADDITIONS over today's loadContractorBranding, both
// flagged in the phase report rather than smuggled in:
//
//   1. HEX VALIDATION. loadContractorBranding does a bare `||`, so a malformed
//      value ('red', 'F26A1B', '#GGGGGG') is passed straight through to the
//      page and silently renders as nothing. The resolver validates and falls
//      back instead. BrandingPreview already validates with the strict
//      /^#[0-9A-Fa-f]{6}$/ form; this adopts that rule, not a looser one.
//
//   2. EMPTY STRING = UNSET. A DB column reads NULL; a form input the admin
//      cleared reads ''. Same intent, so the same answer.
//
// SLUG IS DELIBERATELY NOT A TOKEN HERE. loadContractorBranding returns it, but
// it is an identity value rather than a brand value, it has no counterpart in
// the admin form state, and the preview has no use for it. The page's loader
// keeps returning it alongside these tokens.
//
// NO PRODUCTION CONTRACTOR ID LITERALS (house rule) — tenant ids are
// fixture-local. The one exception is the drift comment above, which must name
// the hex values it exists to detect.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');

// LAZY LOAD, deliberately. A top-level `require` of a module that does not exist
// yet throws at file load, which node:test reports as one failed file with a
// MODULE_NOT_FOUND stack — every individual expectation below would be hidden
// behind it. Loading on first use makes each test fail on its own, with its own
// message, which is what a RED suite is for.
let _mod = null;
function mod() {
  if (_mod) return _mod;
  try {
    _mod = require('../utils/brandingTheme');
  } catch (err) {
    assert.fail(
      'server/utils/brandingTheme.js is not implemented yet — ' +
      'it must export { resolveBrandingTheme, BRANDING_THEME_DEFAULTS }. ' + err.message
    );
  }
  return _mod;
}
const resolveBrandingTheme = (...args) => mod().resolveBrandingTheme(...args);
const defaults = () => mod().BRANDING_THEME_DEFAULTS;

const TENANT_A_ID = 'tnt-r9xc-internal';

// A fully-populated brand, every value distinct from every default so a
// pass-through failure cannot hide behind a coincidental match.
const POPULATED = Object.freeze({
  company_name:     'Alpha Roofing Co',
  app_display_name: 'Alpha Rewards',
  primary_color:    '#123456',
  secondary_color:  '#654321',
  landing_bg_color: '#ABCDEF',
  logo_url:         'https://cdn.test.invalid/alpha/logo.png',
  company_phone:    '555-0100',
  company_email:    'hello@alpha.test.invalid',
  company_address:  '12 Ridge Line Rd',
});

// The hand-derived expected output for POPULATED. Written out as literals rather
// than built from POPULATED by a loop, so the mapping cannot satisfy it by
// construction.
//
// ⚠ accentColor WAS ADDED HERE IN C/DL-2 PHASE 3c, and it is the ONE edit that
// phase made to a pre-existing test file. It is not a weakening and not an
// accommodation: resolveBrandingTheme gained a fourth colour token by explicit
// ruling, so this hand-derived literal — which is the WHOLE resolved output,
// compared with deepEqual — had to gain it too or the test would assert a shape
// the resolver is no longer specified to produce.
//
// POPULATED deliberately carries NO accent_color, so the value below is the
// DEFAULT rather than a pass-through. accent_color pass-through is covered at
// 'populated form state is reflected verbatim' in
// src/components/admin/BrandingPreview.test.jsx, which feeds accent_color: '#ABCDEF'
// through the mirror and reads the painted result.
const POPULATED_EXPECTED = Object.freeze({
  companyName:     'Alpha Roofing Co',
  programName:     'Alpha Rewards',
  primaryColor:    '#123456',
  secondaryColor:  '#654321',
  accentColor:     '#FDF0E7',
  backgroundColor: '#ABCDEF',
  logoUrl:         'https://cdn.test.invalid/alpha/logo.png',
  phone:           '555-0100',
  email:           'hello@alpha.test.invalid',
  address:         '12 Ridge Line Rd',
});

describe('C/DL-2 Phase 3a — resolveBrandingTheme', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
    await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $2)`,
      [TENANT_A_ID, 'Alpha Roofing Co']);
  });

  after(async () => {
    await pool.end();
  });

  // ── 1. PASS-THROUGH ────────────────────────────────────────────────────────

  it('passes populated values through unchanged', async () => {
    assert.deepEqual(resolveBrandingTheme(POPULATED), POPULATED_EXPECTED);
  });

  it('returns every token the page and the preview consume', async () => {
    // A missing key does not throw — it renders an unstyled surface or a blank
    // header, which is the failure mode that reaches a homeowner rather than a
    // log. Membership rather than exact-set equality, so the token set can grow
    // additively without this test firing on the growth.
    const theme = resolveBrandingTheme(POPULATED);
    for (const key of [
      'companyName', 'programName', 'primaryColor', 'secondaryColor',
      'backgroundColor', 'logoUrl', 'phone', 'email',
    ]) {
      assert.ok(key in theme, `resolveBrandingTheme omitted the '${key}' token`);
    }
  });

  // ── 2. THE TWO INPUT PATHS AGREE ───────────────────────────────────────────

  it('a real contractor_settings row and unsaved form state resolve identically', async () => {
    // THE POINT OF THE SHARED FUNCTION. The two callers hand it genuinely
    // different objects for the same brand:
    //
    //   the page  — a pg row: unset columns are null, and it carries a dozen
    //               columns the resolver has no interest in (contractor_id,
    //               font_heading, created_at, …)
    //   the preview — form state: unset fields are '' or simply absent
    //
    // Same brand, therefore same answer. Nothing is stubbed: the row leg reads a
    // row Postgres actually produced, because null-vs-'' and the extra columns
    // are exactly what a hand-built "row" fixture would quietly get wrong.
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, app_display_name,
          primary_color, secondary_color, landing_bg_color, logo_url,
          company_phone, company_email, company_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (contractor_id) DO UPDATE SET
         company_name = EXCLUDED.company_name`,
      [
        TENANT_A_ID, POPULATED.company_name, POPULATED.app_display_name,
        POPULATED.primary_color, POPULATED.secondary_color,
        POPULATED.landing_bg_color, POPULATED.logo_url,
        POPULATED.company_phone, POPULATED.company_email, POPULATED.company_address,
      ]
    );
    const { rows } = await pool.query(
      `SELECT * FROM contractor_settings WHERE contractor_id = $1`, [TENANT_A_ID]
    );

    // NON-VACUITY: prove the row leg produced the brand rather than the defaults
    // before comparing the two legs. Two identical default blocks would satisfy
    // deepEqual while proving the resolver reads nothing at all.
    const fromRow = resolveBrandingTheme(rows[0]);
    assert.equal(
      fromRow.primaryColor, '#123456',
      'the DB-row leg fell back to a default — the comparison below would compare two default blocks'
    );

    const fromForm = resolveBrandingTheme({ ...POPULATED });
    assert.deepEqual(
      fromRow, fromForm,
      'the same brand resolves differently depending on whether it arrived as a DB row or as form state'
    );
  });

  // ── 3. DEFAULTS ────────────────────────────────────────────────────────────

  it('null, undefined and empty-string colours all resolve to the RoofMiles defaults', async () => {
    // Three unset spellings, one meaning. A resolver that handles null but not
    // '' ships a page whose background is the literal empty string the moment an
    // admin clears the field — which the browser renders as no colour at all.
    const cases = [
      ['null',      { primary_color: null,      secondary_color: null,      landing_bg_color: null }],
      ['undefined', {}],
      ['empty',     { primary_color: '',        secondary_color: '',        landing_bg_color: '' }],
    ];
    for (const [label, input] of cases) {
      const theme = resolveBrandingTheme(input);
      assert.equal(theme.primaryColor,    '#F26A1B', `${label}: wrong primary default`);
      assert.equal(theme.secondaryColor,  '#1C2D4D', `${label}: wrong secondary default`);
      assert.equal(theme.backgroundColor, '#FFFFFF', `${label}: wrong background default`);
    }
  });

  it('never falls back to Accent Roofing\'s palette', async () => {
    // The specific regression. #012854 / #CC0000 / #D3E3F0 are the three values
    // BrandingPreview.jsx:13-15 falls back to today. If the shared resolver is
    // written by copying the preview's constants — the obvious shortcut, since
    // the preview is where the fallback code already exists — every unbranded
    // contractor's landing page renders in Accent's colours.
    //
    // NON-VACUITY: the resolver is proven to have produced a real colour block
    // first; an empty object would contain none of these strings either.
    const theme = resolveBrandingTheme({});
    assert.match(theme.primaryColor, /^#[0-9A-Fa-f]{6}$/, 'no usable primary colour was produced at all');

    const rendered = JSON.stringify(theme);
    for (const accent of ['#012854', '#CC0000', '#D3E3F0']) {
      assert.equal(
        rendered.includes(accent), false,
        `the default theme contains Accent Roofing's ${accent} — a white-label breach for every other contractor`
      );
    }
  });

  it('has no default logo', async () => {
    // Deliberate, and the same rule loadContractorBranding states at
    // referrer.js:245-247: a placeholder logo borrowed from another contractor is
    // a white-label breach, not a fallback. The page draws no logo slot when this
    // is null.
    assert.equal(resolveBrandingTheme({}).logoUrl, null);
    assert.equal(resolveBrandingTheme({ logo_url: '' }).logoUrl, null);
  });

  it('omits address entirely when unset, rather than nulling it', async () => {
    // LP-1: the footer decides whether to draw the contact row by the key's
    // presence. A null would render an empty row where no row belongs. Preserves
    // loadContractorBranding's existing behaviour (referrer.js:251).
    assert.equal('address' in resolveBrandingTheme({}), false, 'address must be absent, not null');
    assert.equal('address' in resolveBrandingTheme({ company_address: '' }), false);
    assert.equal(resolveBrandingTheme({ company_address: '12 Ridge Line Rd' }).address, '12 Ridge Line Rd');
  });

  // ── WEBSITE TOKEN (polish item 3, Phase 1) ─────────────────────────────────
  // Sits here rather than in a file of its own because `website` is the exact
  // sibling of `address` directly above: an optional contact value, carried when
  // set and OMITTED when not. The two rules have to be readable together or the
  // second one drifts from the first.

  it('[RED] carries the contractor website verbatim when company_url is set', async () => {
    // SOURCE COLUMN: contractor_settings.company_url — the "Website URL" field on
    // the admin Company Details page (CompanyDetailsSettings.jsx:341-346). NOT
    // social_website, which is a social-links row on the Branding page, and NOT
    // review_url.
    //
    // VERBATIM, and that is the whole assertion. The column is an unconstrained
    // VARCHAR(500) with no normalization anywhere between the admin form and the
    // database, so BOTH shapes below are real stored values — the Company Details
    // placeholder asks for a bare domain, the Branding page's sibling field asks
    // for a full URL. The resolver is pure and must not start editing user data:
    // deciding what is safe to put in an href is the RENDER layer's job (a
    // scheme-prepending sibling of safeLogoUrl, Phase 2), not this function's. A
    // resolver that "helpfully" prepended https:// here would be normalising the
    // value the page still has to validate anyway, in the one place that cannot
    // see whether it is about to become an href or plain text.
    assert.equal(
      resolveBrandingTheme({ company_url: 'accentroofingservice.com' }).website,
      'accentroofingservice.com',
      'a bare-domain company_url must reach the theme unchanged'
    );
    assert.equal(
      resolveBrandingTheme({ company_url: 'https://accentroofingservice.com' }).website,
      'https://accentroofingservice.com',
      'a scheme-carrying company_url must reach the theme unchanged too — both shapes are stored today'
    );
  });

  it('[GUARD — pre-satisfied today] omits website entirely when company_url is unset, rather than nulling it', async () => {
    // ⚠ THIS PASSES BEFORE THE FEATURE EXISTS, and that is stated rather than
    // hidden: no `website` key is emitted at all today, so "no website key" is
    // trivially true. It is NOT a red test and must not be counted as one.
    //
    // ITS VALUE IS ENTIRELY ON GREEN DAY. The obvious implementation —
    // `website: firstNonEmpty(src.company_url)` alongside phone and email — emits
    // `website: null` when unset and would fail here. That is the point: the page
    // draws each contact row by the KEY'S PRESENCE (LP-1, renderFooter:509-519),
    // so an always-present null renders an empty row, or the literal word "null",
    // at a homeowner. The address branch below it is the shape to copy.
    //
    // OWN-KEY, via Object.hasOwn rather than the `in` used for address above.
    // Own-key is the property that actually matters: assert.deepEqual in
    // node:assert/strict is deepSTRICTEqual, which compares own keys, so an
    // own-key `website: undefined` and an omitted `website` are NOT equal to it —
    // and brandingTheme.test.js:160 plus the parity deepEqual in
    // landingResolve.test.js:724 both depend on that distinction.
    assert.equal(
      Object.hasOwn(resolveBrandingTheme({}), 'website'), false,
      'website must be absent, not null, when nothing is stored'
    );
    assert.equal(
      Object.hasOwn(resolveBrandingTheme({ company_url: null }), 'website'), false,
      'a NULL column must omit the key — this is the shape a DB row has'
    );
    assert.equal(
      Object.hasOwn(resolveBrandingTheme({ company_url: '' }), 'website'), false,
      "an empty string must omit the key — this is the shape a CLEARED admin field has"
    );
    assert.equal(
      Object.hasOwn(resolveBrandingTheme({ company_url: '   ' }), 'website'), false,
      'whitespace-only is unset too — firstNonEmpty already trims for every other token'
    );
  });

  it('falls back to the contractor\'s own name before the platform name', async () => {
    // The middle step of the three-step chain at referrer.js:240, and it is
    // load-bearing rather than decorative: contractors.name is NOT NULL, so a
    // contractor who has never opened the Branding page still gets their own
    // name. 'RoofMiles' in its place on a homeowner-facing surface reads as a
    // phishing signal.
    assert.equal(
      resolveBrandingTheme({ company_name: null, contractor_name: 'Beta Roofing Co' }).companyName,
      'Beta Roofing Co'
    );
    assert.equal(
      resolveBrandingTheme({ company_name: 'Beta Roofing Co', contractor_name: 'Stale Legacy Name' }).companyName,
      'Beta Roofing Co',
      'the saved company name must win over the contractors.name fallback'
    );
    assert.equal(resolveBrandingTheme({}).companyName, 'RoofMiles');
  });

  it('leaves programName null rather than inventing one', async () => {
    // There is no sensible platform-level default for a contractor's program
    // name, and 'Rooster Booster' — the string the admin zero-row fallback
    // currently supplies — is this platform's own internal codename.
    assert.equal(resolveBrandingTheme({}).programName, null);
    assert.equal(resolveBrandingTheme({ app_display_name: '' }).programName, null);
    assert.equal(resolveBrandingTheme({ app_display_name: 'Alpha Rewards' }).programName, 'Alpha Rewards');
  });

  // ── 4. THE DRIFT GUARD ─────────────────────────────────────────────────────

  it('the mapping\'s defaults are the server\'s ROOFMILES_DEFAULTS, read from the server', async () => {
    // THE IMPORTANT ONE. The hex values are read from referrer.js's own export
    // rather than re-typed here, because a test that re-typed them would go on
    // passing while the two constants drifted apart — which is precisely how
    // BrandingPreview.jsx ended up three colours away from the server without
    // anything failing.
    //
    // The GREEN phase may satisfy this either by keeping two constants in step
    // or by making referrer.js import the resolver's. The second is the better
    // end state and makes this assertion trivially true; the behavioural
    // assertions above still pin the actual values, so the pairing is not
    // circular.
    const referrerRouter = require('../routes/referrer');
    const serverDefaults = referrerRouter.ROOFMILES_DEFAULTS;

    assert.ok(
      serverDefaults,
      'referrer.js must export ROOFMILES_DEFAULTS (same convention as LANDING_RESOLVE_LIMIT / ' +
      'RESEND_CODE_LIMIT at referrer.js:2794-2800) so this guard reads the real constant'
    );

    const mapped = defaults();
    assert.ok(mapped, 'brandingTheme.js must export BRANDING_THEME_DEFAULTS');
    assert.equal(mapped.primaryColor,    serverDefaults.primaryColor);
    assert.equal(mapped.secondaryColor,  serverDefaults.secondaryColor);
    assert.equal(mapped.backgroundColor, serverDefaults.backgroundColor);
    assert.equal(mapped.companyName,     serverDefaults.companyName);

    // And the resolver actually USES them — a defaults object that matched but
    // was never consulted would pass every assertion above this line.
    const theme = resolveBrandingTheme({});
    assert.equal(theme.primaryColor,    serverDefaults.primaryColor);
    assert.equal(theme.secondaryColor,  serverDefaults.secondaryColor);
    assert.equal(theme.backgroundColor, serverDefaults.backgroundColor);
    assert.equal(theme.companyName,     serverDefaults.companyName);
  });

  it('the src/ mirror has not diverged from the canonical server copy', async () => {
    // THE MIRROR GUARD (Phase 3b ruling). The canonical resolver is CommonJS
    // because a dozen server files require() it, and the Vite dev server cannot
    // serve a CommonJS source file to a browser at all; the resolver is therefore
    // duplicated at src/utils/brandingTheme.mjs, on the WARMUP_ENTRIES /
    // WARMUP_ENTRIES_SERVER precedent already in this repo.
    //
    // (The original wording here cited CRA's ModuleScopePlugin refusing imports
    // that reach outside src/. CRA went with the Vite migration on 2026-08-04;
    // the reason above is the one that is actually load-bearing today.)
    //
    // A mirror is only acceptable while something fails when the copies disagree.
    // This is that something. It compares the DEFAULTS and the RESOLUTION
    // BEHAVIOUR, because either can drift alone: identical defaults with a
    // different hex regex would still paint two different pages.
    //
    // THIS DRIFT ALREADY HAPPENED ONCE, which is why the guard is here rather
    // than in a comment. BrandingPreview.jsx:13-15 falls back to #012854 /
    // #CC0000 / #D3E3F0 — Accent Roofing's navy, red and light blue — while the
    // server falls back to RoofMiles' #F26A1B / #1C2D4D / #FFFFFF. A contractor
    // with no saved colours saw one brand in the preview and another on their
    // live surface, neither of them theirs, and nothing failed.
    //
    // ⚠ `await import()`, NOT `require()` — CHANGED AT THE VITE DEV PIPELINE FIX,
    // AND THE GUARD IS STRONGER FOR IT. The mirror used to be CommonJS solely so
    // this line could require() it, and that shape is exactly what white-screened
    // `npm start`: the Vite dev server serves source files verbatim, so a
    // `module.exports =` reached the browser as a module with no exports and every
    // named import of it failed at link time. The mirror is now ESM (.mjs), which
    // is the shape the browser actually receives — so this guard reads the real
    // artefact rather than a CommonJS twin of it. A namespace object from
    // `import()` also cannot be mutated after the fact, which a require() cache
    // entry can.
    let mirror;
    try {
      mirror = await import('../../src/utils/brandingTheme.mjs');
    } catch (err) {
      assert.fail(
        'src/utils/brandingTheme.mjs is missing or is not a loadable ES module — ' +
        'the admin preview has no copy to consume. ' + err.message
      );
    }

    // ── DEFAULTS ─────────────────────────────────────────────────────────────
    // Key by key rather than one deepEqual, so a failure names the value that
    // diverged instead of printing two objects to compare by eye.
    const canonical = defaults();
    for (const key of ['companyName', 'primaryColor', 'secondaryColor', 'backgroundColor']) {
      assert.equal(
        mirror.BRANDING_THEME_DEFAULTS[key], canonical[key],
        `MIRROR DRIFT on default '${key}': src/ has ${JSON.stringify(mirror.BRANDING_THEME_DEFAULTS[key])}, ` +
        `server/ has ${JSON.stringify(canonical[key])}. The two files must be edited together.`
      );
    }
    assert.deepEqual(
      Object.keys(mirror.BRANDING_THEME_DEFAULTS).sort(),
      Object.keys(canonical).sort(),
      'MIRROR DRIFT: the two copies declare different sets of default tokens'
    );

    // ── RESOLUTION BEHAVIOUR ─────────────────────────────────────────────────
    // Defaults matching is not enough — the copies could agree on the fallback
    // values and disagree on when to use them. Each case below is one branch of
    // the resolver.
    const cases = [
      ['fully populated',       { ...POPULATED }],
      ['everything unset',      {}],
      ['explicit nulls',        { company_name: null, primary_color: null, landing_bg_color: null, logo_url: null }],
      ['empty strings',         { company_name: '', primary_color: '', secondary_color: '', landing_bg_color: '', company_address: '' }],
      ['malformed hex',         { primary_color: 'navy', secondary_color: 'F26A1B', landing_bg_color: '#abc' }],
      ['valid lowercase hex',   { primary_color: '#abcdef' }],
      ['contractor_name only',  { contractor_name: 'Beta Roofing Co' }],
      ['address present',       { company_address: '12 Ridge Line Rd' }],
      // ⚠ PRE-SATISFIED TODAY (polish item 3, Phase 1) — neither copy emits a
      // website token, so both return the same object and this passes trivially.
      // It is here for GREEN day: the website token has to be added to BOTH
      // copies, and this row is what fails if only the server one is edited.
      ['website present',       { company_url: 'accentroofingservice.com' }],
      ['website unset',         { company_url: null }],
      ['non-string scalars',    { primary_color: 123456, secondary_color: true, landing_bg_color: [] }],
      ['null input',            null],
    ];
    for (const [label, input] of cases) {
      assert.deepEqual(
        mirror.resolveBrandingTheme(input),
        resolveBrandingTheme(input),
        `MIRROR DRIFT on resolution behaviour for '${label}' — the two copies resolve the same ` +
        'input differently. The two files must be edited together.'
      );
    }
  });

  // ── 5. MALFORMED INPUT ─────────────────────────────────────────────────────

  it('malformed hex resolves to the default instead of passing garbage through', async () => {
    // Today loadContractorBranding does a bare `||`, so every one of these
    // reaches the page and renders as no colour at all — a black-on-black header
    // or an invisible CTA, with nothing logged. The value arrives from a free-text
    // admin field, so 'navy' and a pasted 'F26A1B' are ordinary typing mistakes,
    // not attacks.
    //
    // Table-driven with hand-written literals. '#abc' is included deliberately:
    // the 3-digit shorthand is legal CSS but is NOT accepted, because the strict
    // /^#[0-9A-Fa-f]{6}$/ form is what BrandingPreview already enforces and one
    // regex across both surfaces beats two that nearly agree.
    const malformed = [
      'red',                    // a colour keyword, not a hex value
      'navy',
      'F26A1B',                 // missing the leading #
      '#GGGGGG',                // out-of-alphabet characters
      '#12345',                 // too short
      '#1234567',               // too long
      '#abc',                   // 3-digit shorthand — legal CSS, deliberately refused
      '  #F26A1B  ',            // untrimmed
      'javascript:alert(1)',    // the value is interpolated into a style context
      '#F26A1B; background:url(x)',
    ];
    for (const bad of malformed) {
      const theme = resolveBrandingTheme({
        primary_color: bad, secondary_color: bad, landing_bg_color: bad,
      });
      assert.equal(theme.primaryColor,    '#F26A1B', `primary accepted malformed input ${JSON.stringify(bad)}`);
      assert.equal(theme.secondaryColor,  '#1C2D4D', `secondary accepted malformed input ${JSON.stringify(bad)}`);
      assert.equal(theme.backgroundColor, '#FFFFFF', `background accepted malformed input ${JSON.stringify(bad)}`);
    }
  });

  it('accepts a valid hex in either case', async () => {
    // Guards the malformed-input test against over-reach: a resolver that
    // rejected everything would pass it. Admins paste colours out of design
    // tools in both cases.
    assert.equal(resolveBrandingTheme({ primary_color: '#abcdef' }).primaryColor, '#abcdef');
    assert.equal(resolveBrandingTheme({ primary_color: '#ABCDEF' }).primaryColor, '#ABCDEF');
  });

  it('survives non-object and non-string input without throwing', async () => {
    // The preview calls this on every keystroke against whatever the form holds,
    // and the page calls it with whatever the row loader returned — including
    // null when the contractor has no settings row at all. A throw here is a
    // blank landing page.
    for (const input of [null, undefined, {}]) {
      const theme = resolveBrandingTheme(input);
      assert.equal(theme.primaryColor, '#F26A1B', `input ${String(input)} did not resolve to defaults`);
    }
    // Non-string scalars in colour slots are the shape a mis-wired form sends.
    const theme = resolveBrandingTheme({ primary_color: 0xF26A1B, secondary_color: true, landing_bg_color: [] });
    assert.equal(theme.primaryColor,    '#F26A1B');
    assert.equal(theme.secondaryColor,  '#1C2D4D');
    assert.equal(theme.backgroundColor, '#FFFFFF');
  });

  it('is pure — the same input resolves the same way twice and the input is not mutated', async () => {
    // Purity is the whole reason this is a standalone function rather than a
    // method on the row loader: the preview must be able to call it on every
    // keystroke, and Phase 3b's server-rendered page must be able to call it
    // per-request without a DB round trip.
    const input = { ...POPULATED };
    const first = resolveBrandingTheme(input);
    const second = resolveBrandingTheme(input);
    assert.deepEqual(first, second);
    assert.deepEqual(input, POPULATED, 'resolveBrandingTheme mutated the object it was handed');
  });
});
