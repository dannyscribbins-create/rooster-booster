'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3a PHASE 3 — RED SUITE — DERIVED LIGHT/DARK THEME TOKENS
//
// WHAT THIS PINS. A pure derivation layer: given a contractor's resolved brand
// colours and a mode ('light' | 'dark'), produce the five render tokens for that
// mode, plus the CSS custom properties that express them. Mounted nowhere this
// phase — the deliverable is the engine and its invariants.
//
// WHY A SEPARATE LAYER RATHER THAN EXTENDING resolveBrandingTheme. This closes
// DECISION_C_DL_BUILD_SPEC.md amendment A20 (§13), which flagged that the spec's
// five-token set (primary · secondary · bg · surface · text) and the shipped
// resolver's set (primaryColor · secondaryColor · accentColor · backgroundColor)
// do not match, and left the choice open. The ruling for this phase is the
// second option, taken deliberately: resolveBrandingTheme is LEFT UNTOUCHED and
// the derivation composes on top of it —
//
//     deriveThemeTokens(resolveBrandingTheme(row), mode)
//
// The base resolver keeps its four consumers (landingResolve.js, landing.js,
// referrer.js, BrandingPreview.jsx) and its whole-output deepEqual fences
// (brandingTheme.test.js:160, landingResolve.test.js:724) unchanged. accentColor
// stays a base brand value and is deliberately NOT one of the five render
// tokens — it paints soft washes, which is a different job from any of the five.
//
// THE HARD INVARIANT, and the only one whose constant is not tunable: the `text`
// token must clear WCAG AA (>= 4.5:1) against its own `surface` in BOTH modes,
// guaranteed by nudging until it passes rather than by trusting a naive value.
// Exact hex output is NOT pinned to the mockup — §5.6 says the derivation
// approximates. Every assertion below is an invariant or an anchored unit
// conversion; none is a mockup hex.
//
// NO DATABASE. Every function under test is pure, and requiring the module pulls
// in only brandingTheme.js, which touches nothing. This file therefore does not
// call initTestDb() — same shape as errorLogger/escapeHtmlExport/registryMirror/
// throttlePacing, the four other DB-free suites.
//
// EXPECTED RED TODAY, all for one documented reason: server/utils/themeTokens.js
// does not exist, so every test fails on MODULE_NOT_FOUND named at its own
// assertion. The mirror-drift test fails on src/utils/themeTokens.js for the
// same reason.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Resolved at CALL time rather than module load, per Phase 1's pattern
// (userPreferences.test.js:45) and brandingTheme.test.js:83-97. A top-level
// require of a module that does not exist yet throws while node:test is still
// LOADING this file, collapsing every expectation below into one opaque
// file-level MODULE_NOT_FOUND. Deferring it produces a clean per-test RED naming
// the missing module, and needs no edit once the module exists (require caches
// after the first success).
function tt() {
  return require('../utils/themeTokens');
}
// ⚠ ASYNC, and `await import()` rather than `require()` — CHANGED AT THE VITE DEV
// PIPELINE FIX. The mirror was CommonJS purely so this could require() it, and
// that shape is what white-screened `npm start`: Vite's dev server serves source
// files verbatim, so `module.exports =` reached the browser as a module with zero
// exports and every named import of it failed at link time. The mirror is ESM
// (.mjs) now, so this guard reads the exact artefact the browser links rather than
// a CommonJS twin of it. Same lazy-resolution property as before — the import
// happens at call time, inside a test, so a missing module fails one assertion
// with its own message instead of collapsing the file at load.
function mirror() {
  return import('../../src/utils/themeTokens.mjs');
}

const { BRANDING_THEME_DEFAULTS, resolveBrandingTheme } = require('../utils/brandingTheme');

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ── FIXTURE BRANDS ───────────────────────────────────────────────────────────
// Shape is resolveBrandingTheme's OUTPUT (camelCase), because that is what the
// derivation consumes. Built through the real resolver where possible so a
// fixture cannot drift from the shape the resolver actually emits.

// The RoofMiles platform defaults, read from the resolver rather than re-typed —
// the same rule brandingTheme.test.js's drift guard follows.
const ROOFMILES = Object.freeze(resolveBrandingTheme({}));

// An Accent-like palette: a real-world second brand, deliberately not the
// platform default, so a derivation that ignored its input would show up.
const ACCENT_LIKE = Object.freeze(resolveBrandingTheme({
  company_name:     'Accent-like Roofing',
  primary_color:    '#C62828',
  secondary_color:  '#2B3036',
  accent_color:     '#FBE9E9',
  landing_bg_color: '#F6F7F8',
}));

// THE PATHOLOGICAL PALETTE. Every colour is a mid-tone grey, chosen so that the
// NAIVE derivation — "text is just the brand's secondary" — lands at roughly
// 3.9:1 against a near-white surface and FAILS the floor. A derivation that
// trusts its input rather than nudging cannot pass the tests below.
const PATHOLOGICAL = Object.freeze(resolveBrandingTheme({
  company_name:     'Mid Tone Co',
  primary_color:    '#7A7A7A',
  secondary_color:  '#808080',
  accent_color:     '#C8C8C8',
  landing_bg_color: '#B0B0B0',
}));

const MODES = ['light', 'dark'];

// Every brand × every mode, for the invariants that must hold universally.
const BRANDS = Object.freeze([
  ['RoofMiles defaults', ROOFMILES],
  ['Accent-like',        ACCENT_LIKE],
  ['pathological',       PATHOLOGICAL],
]);

describe('C/DL-3a Phase 3 — theme token derivation', () => {

  // ── 1. COLOUR MATH ANCHORS ─────────────────────────────────────────────────
  // The derivation's invariants are all relative, so they would still hold if
  // every conversion below were subtly wrong in the same direction. These pin
  // the math itself against known values.

  it('hexToRgb and rgbToHex round-trip known values', async () => {
    const { hexToRgb, rgbToHex } = tt();

    assert.deepEqual(hexToRgb('#F26A1B'), { r: 242, g: 106, b: 27 });
    assert.deepEqual(hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
    assert.deepEqual(hexToRgb('#FFFFFF'), { r: 255, g: 255, b: 255 });

    // Lowercase in, canonical uppercase out. Admins paste colours out of design
    // tools in both cases (brandingTheme.test.js:531), so the parser must accept
    // both while the emitter picks one.
    assert.deepEqual(hexToRgb('#abcdef'), { r: 171, g: 205, b: 239 });
    assert.equal(rgbToHex({ r: 171, g: 205, b: 239 }), '#ABCDEF');
    assert.equal(rgbToHex({ r: 242, g: 106, b: 27 }), '#F26A1B');

    // Malformed input returns null rather than a garbage triple — the same
    // strict six-digit rule brandingTheme.js enforces, not a looser one.
    for (const bad of ['navy', 'F26A1B', '#GGGGGG', '#12345', '#1234567', '#abc', null, undefined, 42]) {
      assert.equal(hexToRgb(bad), null, `hexToRgb accepted ${JSON.stringify(bad)}`);
    }
  });

  it('rgbToHsl and hslToRgb agree with known conversions', async () => {
    const { rgbToHsl, hslToRgb } = tt();

    // Hue in degrees [0,360), saturation and lightness in [0,1].
    const red = rgbToHsl({ r: 255, g: 0, b: 0 });
    assert.equal(Math.round(red.h), 0);
    assert.ok(Math.abs(red.s - 1) < 1e-6, `pure red saturation was ${red.s}`);
    assert.ok(Math.abs(red.l - 0.5) < 1e-6, `pure red lightness was ${red.l}`);

    assert.equal(Math.round(rgbToHsl({ r: 0, g: 255, b: 0 }).h), 120);
    assert.equal(Math.round(rgbToHsl({ r: 0, g: 0, b: 255 }).h), 240);

    // Achromatic: saturation zero, lightness the grey level.
    const grey = rgbToHsl({ r: 128, g: 128, b: 128 });
    assert.equal(grey.s, 0);
    assert.ok(Math.abs(grey.l - 128 / 255) < 1e-6, `mid grey lightness was ${grey.l}`);

    assert.deepEqual(hslToRgb({ h: 240, s: 1, l: 0.5 }), { r: 0, g: 0, b: 255 });
    assert.deepEqual(hslToRgb({ h: 0, s: 0, l: 0 }), { r: 0, g: 0, b: 0 });
    assert.deepEqual(hslToRgb({ h: 0, s: 0, l: 1 }), { r: 255, g: 255, b: 255 });

    // Round trip through both directions returns the colour it started from.
    const { rgbToHex, hexToRgb } = tt();
    for (const hex of ['#F26A1B', '#1C2D4D', '#C62828', '#2B3036']) {
      const back = rgbToHex(hslToRgb(rgbToHsl(hexToRgb(hex))));
      assert.equal(back, hex.toUpperCase(), `round trip changed ${hex} into ${back}`);
    }
  });

  it('relativeLuminance and contrastRatio match the WCAG reference values', async () => {
    const { relativeLuminance, contrastRatio } = tt();

    assert.ok(Math.abs(relativeLuminance('#FFFFFF') - 1) < 1e-9, 'white must be luminance 1');
    assert.ok(Math.abs(relativeLuminance('#000000') - 0) < 1e-9, 'black must be luminance 0');

    // The extremes of the scale: 21:1 and 1:1.
    assert.ok(Math.abs(contrastRatio('#FFFFFF', '#000000') - 21) < 1e-6);
    assert.ok(Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) < 1e-6, 'the ratio must be order-independent');
    assert.ok(Math.abs(contrastRatio('#777777', '#777777') - 1) < 1e-9);

    // THE ANCHOR THAT MATTERS. #767676 on white is the canonical WCAG AA
    // boundary grey — 4.54:1, the darkest grey that still passes 4.5:1. If the
    // luminance curve is wrong anywhere, this is the value that moves.
    const boundary = contrastRatio('#767676', '#FFFFFF');
    assert.ok(
      Math.abs(boundary - 4.54) < 0.02,
      `#767676 on white must be ~4.54:1 (the WCAG AA boundary grey), got ${boundary}`
    );
    // And its neighbour one step lighter fails, so the anchor is not a
    // coincidence of a flat curve.
    assert.ok(contrastRatio('#777777', '#FFFFFF') < 4.5);
  });

  // ── 2. SHAPE ───────────────────────────────────────────────────────────────

  it('returns exactly the five render tokens, every value a valid #RRGGBB', async () => {
    const { deriveThemeTokens, RENDER_TOKEN_KEYS } = tt();

    assert.deepEqual(
      [...RENDER_TOKEN_KEYS].sort(),
      ['bg', 'primary', 'secondary', 'surface', 'text'],
      'the exported token key list is not the five tokens §5 specifies'
    );

    for (const [label, brand] of BRANDS) {
      for (const mode of MODES) {
        const tokens = deriveThemeTokens(brand, mode);
        assert.deepEqual(
          Object.keys(tokens).sort(), [...RENDER_TOKEN_KEYS].sort(),
          `${label}/${mode}: token key set is not exactly RENDER_TOKEN_KEYS`
        );
        for (const key of RENDER_TOKEN_KEYS) {
          assert.match(
            tokens[key], HEX_RE,
            `${label}/${mode}: token '${key}' is ${JSON.stringify(tokens[key])}, not a valid #RRGGBB`
          );
        }
      }
    }
  });

  it('rejects an unknown mode rather than defaulting to one', async () => {
    // Fail-closed, the same rule userPreferences.js applies to subjectType.
    // A silently-defaulted mode paints a dark-mode user a light surface and
    // logs nothing.
    const { deriveThemeTokens } = tt();
    for (const mode of ['LIGHT', 'Dark', '', null, undefined, 'auto']) {
      assert.throws(
        () => deriveThemeTokens(ROOFMILES, mode),
        /mode/i,
        `mode ${JSON.stringify(mode)} was accepted instead of throwing`
      );
    }
  });

  // ── 3. LIGHT MODE ──────────────────────────────────────────────────────────

  it('light mode passes primary, secondary and bg through unchanged', async () => {
    const { deriveThemeTokens } = tt();
    for (const [label, brand] of BRANDS) {
      const tokens = deriveThemeTokens(brand, 'light');
      assert.equal(tokens.primary,   brand.primaryColor,    `${label}: light primary was not a passthrough`);
      assert.equal(tokens.secondary, brand.secondaryColor,  `${label}: light secondary was not a passthrough`);
      assert.equal(tokens.bg,        brand.backgroundColor, `${label}: light bg was not a passthrough`);
    }

    // NON-VACUITY: the Accent-like fixture's three values are all distinct from
    // the platform defaults, so a derivation ignoring its input would fail here
    // rather than coincidentally matching.
    assert.notEqual(ACCENT_LIKE.primaryColor, ROOFMILES.primaryColor);
    assert.notEqual(ACCENT_LIKE.backgroundColor, ROOFMILES.backgroundColor);
  });

  it('light mode text clears the WCAG AA floor against its own surface', async () => {
    const { deriveThemeTokens, contrastRatio, TEXT_CONTRAST_MIN } = tt();
    assert.equal(TEXT_CONTRAST_MIN, 4.5, 'the legibility floor must be WCAG AA 4.5:1');

    for (const [label, brand] of BRANDS) {
      const { text, surface } = deriveThemeTokens(brand, 'light');
      const ratio = contrastRatio(text, surface);
      assert.ok(
        ratio >= TEXT_CONTRAST_MIN,
        `${label}: light text ${text} on surface ${surface} is ${ratio.toFixed(2)}:1, below the ${TEXT_CONTRAST_MIN}:1 floor`
      );
    }
  });

  // ── 4. DARK MODE ───────────────────────────────────────────────────────────

  it('dark mode lifts cards off the canvas — surface is lighter than bg', async () => {
    // The mockup's feasibility note: dark mode is near-black surfaces, not a
    // grey inversion, and depth comes from a small lift rather than a border.
    const { deriveThemeTokens, relativeLuminance } = tt();
    for (const [label, brand] of BRANDS) {
      const { bg, surface } = deriveThemeTokens(brand, 'dark');
      assert.ok(
        relativeLuminance(bg) < relativeLuminance(surface),
        `${label}: dark bg ${bg} is not darker than surface ${surface} — cards would not lift off the canvas`
      );
    }
  });

  it('dark mode is actually dark — low canvas luminance, high text luminance', async () => {
    // Guards the lift assertion above against over-reach: two nearly-white
    // values would satisfy "bg < surface" while being no kind of dark mode.
    const { deriveThemeTokens, relativeLuminance } = tt();
    for (const [label, brand] of BRANDS) {
      const { bg, text } = deriveThemeTokens(brand, 'dark');
      assert.ok(
        relativeLuminance(bg) < 0.05,
        `${label}: dark bg ${bg} has luminance ${relativeLuminance(bg).toFixed(4)} — not a near-black canvas`
      );
      assert.ok(
        relativeLuminance(text) > 0.5,
        `${label}: dark text ${text} has luminance ${relativeLuminance(text).toFixed(4)} — not a light foreground`
      );
    }
  });

  it('dark mode text clears the WCAG AA floor against its own surface', async () => {
    const { deriveThemeTokens, contrastRatio, TEXT_CONTRAST_MIN } = tt();
    for (const [label, brand] of BRANDS) {
      const { text, surface } = deriveThemeTokens(brand, 'dark');
      const ratio = contrastRatio(text, surface);
      assert.ok(
        ratio >= TEXT_CONTRAST_MIN,
        `${label}: dark text ${text} on surface ${surface} is ${ratio.toFixed(2)}:1, below the ${TEXT_CONTRAST_MIN}:1 floor`
      );
    }
  });

  it('dark mode brightens the brand tones enough to read on the canvas', async () => {
    // THE RULING (C/DL-3a Phase 3): in dark mode `secondary` stays a BRAND tone,
    // brightened until it reads — deliberately NOT the mockup's dark-secondary
    // hexes (#121E33 / #14171B), which are that theme's elevated panel tone and
    // would make `secondary` a near-duplicate of `surface`.
    const { deriveThemeTokens, contrastRatio, BRAND_ON_DARK_MIN_CONTRAST } = tt();
    assert.ok(BRAND_ON_DARK_MIN_CONTRAST > 1, 'the brand-on-dark threshold must be exported and meaningful');

    for (const [label, brand] of BRANDS) {
      const { primary, secondary, surface } = deriveThemeTokens(brand, 'dark');
      for (const [key, value] of [['primary', primary], ['secondary', secondary]]) {
        const ratio = contrastRatio(value, surface);
        assert.ok(
          ratio >= BRAND_ON_DARK_MIN_CONTRAST,
          `${label}: dark ${key} ${value} on surface ${surface} is ${ratio.toFixed(2)}:1, below the ` +
          `${BRAND_ON_DARK_MIN_CONTRAST}:1 brand-on-dark threshold`
        );
      }
      // NON-VACUITY for the ruling: a secondary that came back equal to the
      // surface would be the panel-tone reading, not the brand-tone one.
      assert.notEqual(
        secondary, surface,
        `${label}: dark secondary collapsed onto surface — that is the rejected panel-tone reading`
      );
    }
  });

  // ── 5. THE PATHOLOGICAL PALETTE ────────────────────────────────────────────

  it('nudges the text token rather than trusting a naive value that fails', async () => {
    const { deriveThemeTokens, contrastRatio, TEXT_CONTRAST_MIN } = tt();

    for (const mode of MODES) {
      const tokens = deriveThemeTokens(PATHOLOGICAL, mode);

      // NON-VACUITY, and this is the whole point of the fixture: prove the naive
      // derivation FAILS on this palette before asserting the real one passes.
      // Without this, a derivation that happened to be handed a legible brand
      // colour would pass the floor test while doing no work at all.
      const naive = contrastRatio(PATHOLOGICAL.secondaryColor, tokens.surface);
      assert.ok(
        naive < TEXT_CONTRAST_MIN,
        `the pathological fixture is no longer pathological in ${mode} mode: the naive ` +
        `text-from-secondary is ${naive.toFixed(2)}:1 against surface ${tokens.surface}, which already passes`
      );

      const ratio = contrastRatio(tokens.text, tokens.surface);
      assert.ok(
        ratio >= TEXT_CONTRAST_MIN,
        `${mode}: pathological palette produced text ${tokens.text} at ${ratio.toFixed(2)}:1 on ` +
        `surface ${tokens.surface} — the floor was not enforced`
      );
      assert.notEqual(
        tokens.text, PATHOLOGICAL.secondaryColor,
        `${mode}: text was passed through unchanged from a value that fails the floor`
      );
    }
  });

  // ── 6. PURITY ──────────────────────────────────────────────────────────────

  it('is deterministic and does not mutate its input', async () => {
    const { deriveThemeTokens } = tt();
    const input = { ...ACCENT_LIKE };
    const snapshot = { ...ACCENT_LIKE };

    for (const mode of MODES) {
      const first = deriveThemeTokens(input, mode);
      const second = deriveThemeTokens(input, mode);
      assert.deepEqual(first, second, `${mode}: two identical calls produced different tokens`);
      assert.deepEqual(first, deriveThemeTokens({ ...ACCENT_LIKE }, mode), `${mode}: a fresh equal input produced different tokens`);
    }
    assert.deepEqual(input, snapshot, 'deriveThemeTokens mutated the brand object it was handed');
  });

  it('references no database, request, environment or clock', async () => {
    // SOURCE-TEXT GUARD, on both copies. The invariants above would all still
    // hold if the module quietly read an env var or stamped a timestamp; purity
    // is what lets this run per-request on the server AND per-keystroke in the
    // admin preview, exactly as brandingTheme.mjs's header argues for itself.
    //
    // ⚠ THE TWO COPIES HAVE DIFFERENT EXTENSIONS. The canonical server copy is
    // CommonJS (.js, require()d across server/); the src/ mirror is ESM (.mjs) so
    // the Vite dev server can serve it to a browser at all. Spell both out —
    // pointing this at a .js in src/ silently ENOENTs into an assert.fail, which
    // is how this line read before the Vite dev pipeline fix.
    const files = [
      path.join(__dirname, '..', 'utils', 'themeTokens.js'),
      path.join(__dirname, '..', '..', 'src', 'utils', 'themeTokens.mjs'),
    ];
    const forbidden = ['process.env', 'Date.now', 'new Date', 'Math.random', 'require(\'../db\')', 'pool'];

    for (const file of files) {
      let source;
      try {
        source = fs.readFileSync(file, 'utf8');
      } catch (err) {
        assert.fail(`${file} does not exist yet — ${err.message}`);
      }
      for (const needle of forbidden) {
        assert.equal(
          source.includes(needle), false,
          // Named by the path segment that actually distinguishes the two copies.
          // `basename(dirname(file))` is 'utils' for BOTH of them, so the message
          // it produced never said which copy had drifted.
          `${file.includes('src') ? 'src' : 'server'}/utils/${path.basename(file)} references ` +
          `${needle} — the derivation must stay pure`
        );
      }
    }
  });

  // ── 7. CSS CUSTOM PROPERTIES ───────────────────────────────────────────────

  it('themeCssVariables emits the five --rm-* properties carrying the token values', async () => {
    const { deriveThemeTokens, themeCssVariables } = tt();

    for (const [label, brand] of BRANDS) {
      for (const mode of MODES) {
        const tokens = deriveThemeTokens(brand, mode);
        const vars = themeCssVariables(tokens);

        assert.deepEqual(
          Object.keys(vars).sort(),
          ['--rm-bg', '--rm-primary', '--rm-secondary', '--rm-surface', '--rm-text'],
          `${label}/${mode}: wrong CSS custom property names`
        );
        assert.equal(vars['--rm-primary'],   tokens.primary,   `${label}/${mode}: --rm-primary`);
        assert.equal(vars['--rm-secondary'], tokens.secondary, `${label}/${mode}: --rm-secondary`);
        assert.equal(vars['--rm-bg'],        tokens.bg,        `${label}/${mode}: --rm-bg`);
        assert.equal(vars['--rm-surface'],   tokens.surface,   `${label}/${mode}: --rm-surface`);
        assert.equal(vars['--rm-text'],      tokens.text,      `${label}/${mode}: --rm-text`);
      }
    }
  });

  it('themeCssVariables refuses an incomplete token object', async () => {
    // A missing token would emit `--rm-text: undefined` into a stylesheet, which
    // is the silent-failure class this repo has been bitten by before (the
    // backtick-in-a-template-literal rule in CLAUDE.md is the same shape): no
    // error anywhere, one invisible element on the page.
    const { themeCssVariables } = tt();
    assert.throws(() => themeCssVariables({ primary: '#F26A1B' }), /token/i);
    assert.throws(() => themeCssVariables(null), /token/i);
  });

  // ── 8. THE MIRROR DRIFT GUARD ──────────────────────────────────────────────

  it('the src/ mirror has not diverged from the canonical server copy', async () => {
    // Same arrangement, and the same justification, as brandingTheme.mjs's
    // mirror: the admin surfaces import from src/, the canonical copy is CommonJS
    // because the server require()s it, and a CommonJS file cannot be served to a
    // browser by the Vite dev server at all — so the src/ copy exists, and is ESM
    // with a .mjs extension so both the browser and this Node guard can load it.
    //
    // A mirror is only acceptable while something fails when the copies
    // disagree. This is that something, and it compares CONSTANTS and BEHAVIOUR
    // both: identical constants with a different nudge loop still paint two
    // different apps.
    const canonical = tt();
    let copy;
    try {
      copy = await mirror();
    } catch (err) {
      assert.fail(
        'src/utils/themeTokens.mjs is missing or is not a loadable ES module — ' +
        `the rep app has no copy to consume. ${err.message}`
      );
    }

    // ── EXPORTED CONSTANTS, key by key so a failure names the value ──────────
    assert.deepEqual(
      [...copy.RENDER_TOKEN_KEYS], [...canonical.RENDER_TOKEN_KEYS],
      'MIRROR DRIFT: the two copies declare different render token keys'
    );
    for (const key of [
      'TEXT_CONTRAST_MIN', 'BRAND_ON_DARK_MIN_CONTRAST', 'LIGHT_SURFACE_HEX',
      'DARK_BG_TARGET_L', 'DARK_SURFACE_LIFT_L', 'DARK_TEXT_TARGET_L',
      'DARK_BG_MAX_SATURATION', 'NUDGE_STEP_L', 'NUDGE_MAX_STEPS',
    ]) {
      assert.equal(
        copy[key], canonical[key],
        `MIRROR DRIFT on constant '${key}': src/ has ${JSON.stringify(copy[key])}, ` +
        `server/ has ${JSON.stringify(canonical[key])}. The two files must be edited together.`
      );
    }

    // ── DERIVATION BEHAVIOUR, across every brand × every mode ────────────────
    const cases = [
      ...BRANDS,
      ['malformed values',  { primaryColor: 'navy', secondaryColor: null, backgroundColor: '#abc' }],
      ['empty object',      {}],
      ['null input',        null],
      ['extreme white',     { primaryColor: '#FFFFFF', secondaryColor: '#FFFFFF', backgroundColor: '#FFFFFF' }],
      ['extreme black',     { primaryColor: '#000000', secondaryColor: '#000000', backgroundColor: '#000000' }],
      ['vivid',             { primaryColor: '#00FF00', secondaryColor: '#FF00FF', backgroundColor: '#FFFF00' }],
    ];
    for (const [label, brand] of cases) {
      for (const mode of MODES) {
        const fromCanonical = canonical.deriveThemeTokens(brand, mode);
        assert.deepEqual(
          copy.deriveThemeTokens(brand, mode), fromCanonical,
          `MIRROR DRIFT on derivation for '${label}' in ${mode} mode — the two copies derive the same ` +
          'brand differently. The two files must be edited together.'
        );
        assert.deepEqual(
          copy.themeCssVariables(fromCanonical), canonical.themeCssVariables(fromCanonical),
          `MIRROR DRIFT on themeCssVariables for '${label}' in ${mode} mode.`
        );
      }
    }

    // ── COLOUR MATH, the layer everything above is built on ──────────────────
    for (const hex of ['#F26A1B', '#1C2D4D', '#C62828', '#808080', '#FFFFFF', '#000000']) {
      assert.deepEqual(copy.hexToRgb(hex), canonical.hexToRgb(hex), `MIRROR DRIFT on hexToRgb('${hex}')`);
      assert.deepEqual(copy.rgbToHsl(canonical.hexToRgb(hex)), canonical.rgbToHsl(canonical.hexToRgb(hex)), `MIRROR DRIFT on rgbToHsl('${hex}')`);
      assert.equal(copy.relativeLuminance(hex), canonical.relativeLuminance(hex), `MIRROR DRIFT on relativeLuminance('${hex}')`);
      assert.equal(copy.contrastRatio(hex, '#FFFFFF'), canonical.contrastRatio(hex, '#FFFFFF'), `MIRROR DRIFT on contrastRatio('${hex}', white)`);
    }
  });

  // ── 9. THE BASE RESOLVER IS UNTOUCHED ──────────────────────────────────────

  it('leaves resolveBrandingTheme\'s own token set alone', async () => {
    // THE ARCHITECTURAL FENCE for A20's second option. If a later session
    // "simplifies" by folding surface/text back into the base resolver, four
    // consumers and two whole-output deepEqual fences change shape at once —
    // this fails first and says why.
    const base = resolveBrandingTheme({});
    for (const leaked of ['surface', 'text', 'bg', 'primary', 'secondary']) {
      assert.equal(
        Object.hasOwn(base, leaked), false,
        `resolveBrandingTheme now emits a '${leaked}' key — the derivation layer is supposed to own ` +
        'the render tokens, and the base resolver is supposed to stay untouched (spec amendment A20)'
      );
    }
    // And accentColor is still a base brand value, deliberately not a render token.
    assert.equal(base.accentColor, BRANDING_THEME_DEFAULTS.accentColor);
    assert.equal(tt().RENDER_TOKEN_KEYS.includes('accent'), false, 'accent is not one of the five render tokens');
  });
});
