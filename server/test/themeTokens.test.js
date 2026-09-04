'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3a PHASE 3 — RED SUITE — DERIVED LIGHT/DARK THEME TOKENS
//
// WHAT THIS PINS. A pure derivation layer: given a contractor's resolved brand
// colours and a mode ('light' | 'dark'), produce the render tokens for that
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
// stays a base brand value and is deliberately NOT one of the render tokens —
// it paints soft washes, which is a different job from any of them.
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

  it('returns exactly the render tokens, every value a valid #RRGGBB', async () => {
    const { deriveThemeTokens, RENDER_TOKEN_KEYS } = tt();

    // ⚠ HAND-WRITTEN ON PURPOSE, same reason as the CSS property list below:
    // it is the independent input that makes RENDER_TOKEN_KEYS falsifiable.
    // WAS THE FIVE OF SPEC §5 UNTIL C/DL-3c PHASE 1a, which appended `onPrimary`
    // under Ruling 1. The §5 claim now lives in the Phase 1a suite, which pins
    // the first five AND their order — amendment A23.1 depends on that prefix,
    // so it is asserted where it can be read next to its reason rather than
    // being silently absorbed into this sorted list.
    // ⚠ AND THE THREE PALETTE-1 KEYS WERE APPENDED, NOT INSERTED — same reason
    // `onPrimary` was. A23.1's claim is about the PREFIX, so `recess` sits at the
    // end rather than beside `surface` where it belongs semantically.
    assert.deepEqual(
      [...RENDER_TOKEN_KEYS].sort(),
      ['bg', 'onPrimary', 'primary', 'primaryDark', 'recess',
       'secondary', 'secondaryDark', 'surface', 'text'],
      'the exported token key list is not the render token set'
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
      // ⚠ THE SOURCES SWAPPED IN B-1; THE PASSTHROUGH PROPERTY DID NOT. What this
      // test pins is that light mode does not REPAINT a brand colour that already
      // clears its floor — unchanged. Which stored column each token passes
      // through from is what the route swap moved: the `primary` TOKEN is the
      // button and now comes from secondary_color, the `secondary` token is the
      // dark neutral and comes from primary_color.
      assert.equal(tokens.primary,   brand.secondaryColor,  `${label}: light primary was not a passthrough`);
      assert.equal(tokens.secondary, brand.primaryColor,    `${label}: light secondary was not a passthrough`);
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

  it('themeCssVariables emits every --rm-* property carrying the token values', async () => {
    // ⚠ THE NAME LIST STAYS HAND-WRITTEN, DELIBERATELY, and it is the only
    // hand-written copy of it in the suite. Everything else derives its
    // expectations from RENDER_TOKEN_KEYS, which means a typo'd or dropped key
    // would change both the code and its own assertion together and nothing
    // would fail. This list is the independent input that makes the set
    // falsifiable at all — the "guards agreeing is not evidence when they share
    // an input" rule. Adding a token is supposed to fail here and be updated on
    // purpose; that is what happened in C/DL-3c Phase 1a, which added
    // --rm-on-primary and was the first change to this list since it was written.
    const { deriveThemeTokens, themeCssVariables } = tt();

    for (const [label, brand] of BRANDS) {
      for (const mode of MODES) {
        const tokens = deriveThemeTokens(brand, mode);
        const vars = themeCssVariables(tokens);

        // ⚠ UPDATED ON PURPOSE BY PALETTE-1, which is what the note above says
        // this list is for. Three properties added: --rm-recess (a surface BELOW
        // surface — R-5), and --rm-primary-dark / --rm-secondary-dark (gradient
        // second stops — R-11). All three are derived #RRGGBB, which is why they
        // are render tokens rather than side-channel values.
        assert.deepEqual(
          Object.keys(vars).sort(),
          ['--rm-bg', '--rm-on-primary', '--rm-primary', '--rm-primary-dark', '--rm-recess',
           '--rm-secondary', '--rm-secondary-dark', '--rm-surface', '--rm-text'],
          `${label}/${mode}: wrong CSS custom property names`
        );
        assert.equal(vars['--rm-primary'],    tokens.primary,   `${label}/${mode}: --rm-primary`);
        assert.equal(vars['--rm-secondary'],  tokens.secondary, `${label}/${mode}: --rm-secondary`);
        assert.equal(vars['--rm-bg'],         tokens.bg,        `${label}/${mode}: --rm-bg`);
        assert.equal(vars['--rm-surface'],    tokens.surface,   `${label}/${mode}: --rm-surface`);
        assert.equal(vars['--rm-text'],       tokens.text,      `${label}/${mode}: --rm-text`);
        assert.equal(vars['--rm-on-primary'], tokens.onPrimary, `${label}/${mode}: --rm-on-primary`);
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
      'TEXT_CONTRAST_MIN', 'BRAND_ON_DARK_MIN_CONTRAST', 'BRAND_ON_LIGHT_MIN_CONTRAST',
      'LIGHT_SURFACE_HEX',
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
    assert.equal(tt().RENDER_TOKEN_KEYS.includes('accent'), false, 'accent is not one of the render tokens');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c PHASE 1a — RED SUITE — THE onPrimary TOKEN AND THE LIGHT-MODE FILL FLOOR
//
// TWO RULINGS, AND THEY ARE ONE DESIGN. Ruling 1 adds a SIXTH render token,
// `onPrimary`: the readable foreground for a control FILLED with `primary`.
// Ruling 2 adds a light-mode floor on `primary` ITSELF. They are separated on
// purpose, and each carries the number that belongs to it:
//
//     onPrimary IS TEXT    -> TEXT_CONTRAST_MIN (4.5)          WCAG SC 1.4.3
//     primary   IS A FILL  -> BRAND_ON_LIGHT_MIN_CONTRAST (3)  WCAG SC 1.4.11
//
// WHY A TOKEN RATHER THAN THE LOCAL WORKAROUND IT REPLACES. LoginScreen.jsx and
// ResetPinScreen.jsx each carried a private useMemo computing this value, and
// both said in a comment that a real token was owed. A per-file workaround does
// not generalise: `--rm-secondary` has ZERO paint consumers today, and white on
// the DARK-mode secondary measures about 3.05:1 (it is 13.71:1 in light, because
// dark BRIGHTENS the brand tones). The first component to paint text on a
// secondary fill inherits this identical defect, mode-flipped, and invisible
// until the toggle ships. A token is where that gets fixed once.
//
// EXPECTED RED TODAY, all for one documented reason: `onPrimary` is not in
// RENDER_TOKEN_KEYS and BRAND_ON_LIGHT_MIN_CONTRAST does not exist, so each test
// fails on its own assertion naming the missing piece.
// ─────────────────────────────────────────────────────────────────────────────

// A brand whose primary is EFFECTIVELY INVISIBLE on a light card — 1.16:1
// against #FFFFFF. THE THREE FIXTURES ABOVE CANNOT PROVE THE LIGHT FLOOR FIRES:
// measured, RoofMiles is 3.06:1, Accent-like 5.62:1 and the "pathological"
// mid-grey 4.29:1, so every one of them clears a 3:1 floor unchanged and a test
// run only against them would pass VACUOUSLY against a derivation that has no
// floor at all (CLAUDE.md vacuity shape 1 — a case row proves nothing until the
// condition it needs actually occurs).
//
// IT IS PATHOLOGICAL FOR A DIFFERENT REASON than PATHOLOGICAL above. That one is
// a mid-tone grey chosen to break the TEXT floor; this one is a pale yellow
// chosen to break the FILL floor. Two floors, two witnesses.
const INVISIBLE_PRIMARY = Object.freeze(resolveBrandingTheme({
  company_name:     'Pale Yellow Co',
  primary_color:    '#FFF176',
  secondary_color:  '#333333',
  accent_color:     '#FFFDE7',
  landing_bg_color: '#FFFFFF',
}));

describe('C/DL-3c Phase 1a — onPrimary and the light-mode fill floor', () => {

  // ── RULING 1 — THE SIXTH RENDER TOKEN ──────────────────────────────────────

  it('[RED] onPrimary is a render token, present and valid in every brand and mode', async () => {
    const { deriveThemeTokens, RENDER_TOKEN_KEYS } = tt();

    assert.ok(
      RENDER_TOKEN_KEYS.includes('onPrimary'),
      'RENDER_TOKEN_KEYS does not include onPrimary — the readable foreground for a ' +
      'primary-filled control is still every consumer private problem'
    );

    // THE FIRST FIVE KEEP THEIR IDENTITY AND THEIR ORDER. Amendment A23.1 rests
    // on RENDER_TOKEN_KEYS being spec section 5's set "exactly, in section 5's
    // order"; appending a sixth preserves that prefix, and reordering would
    // falsify an amendment rather than merely churn a list.
    assert.deepEqual(
      RENDER_TOKEN_KEYS.slice(0, 5),
      ['primary', 'secondary', 'bg', 'surface', 'text'],
      'the first five render tokens are no longer spec section 5 set in section 5 order'
    );

    for (const [label, brand] of [...BRANDS, ['invisible primary', INVISIBLE_PRIMARY]]) {
      for (const mode of MODES) {
        const tokens = deriveThemeTokens(brand, mode);
        assert.match(
          tokens.onPrimary ?? '', HEX_RE,
          `${label}/${mode}: onPrimary is ${JSON.stringify(tokens.onPrimary)}, not a valid #RRGGBB`
        );
      }
    }
  });

  it('[RED] onPrimary clears the WCAG AA text floor against its own mode primary', async () => {
    const { deriveThemeTokens, contrastRatio, TEXT_CONTRAST_MIN } = tt();

    // THE AUTHORITY, NOT RE-DERIVED HERE. The label this token carries is 15px/700
    // on the Sign In button, which is below WCAG's large-text threshold (18.66px
    // bold), so SC 1.4.3's 4.5:1 applies rather than 3:1. The same 15px/700
    // reasoning is written independently at AdminSetPasswordScreen.jsx's disabled
    // button comment and in campaigns.js's email-button comment; this cites them
    // rather than arguing it a third time.
    assert.equal(TEXT_CONTRAST_MIN, 4.5, 'the text floor must be WCAG AA 4.5:1');

    for (const [label, brand] of [...BRANDS, ['invisible primary', INVISIBLE_PRIMARY]]) {
      for (const mode of MODES) {
        const { primary, onPrimary } = deriveThemeTokens(brand, mode);
        const ratio = contrastRatio(onPrimary, primary);
        assert.ok(
          ratio >= TEXT_CONTRAST_MIN,
          `${label}/${mode}: onPrimary ${onPrimary} on primary ${primary} is ` +
          `${ratio.toFixed(2)}:1, below the ${TEXT_CONTRAST_MIN}:1 floor`
        );
      }
    }
  });

  it('[RED] onPrimary is DERIVED per brand — the two known palettes disagree about it', async () => {
    // NON-VACUITY, AND THE MEASUREMENT THAT DECIDED RULING 1. A hardcoded
    // foreground is wrong for one of the two brands this product actually has:
    // on #F26A1B white is 3.06:1 and black is 6.85:1, so the label must be dark;
    // on #C62828 white is 5.62:1 and black is 3.74:1, so it must be light.
    // Asserting only the floor above would go green against `return '#000000'`.
    const { deriveThemeTokens, contrastRatio } = tt();

    const roofmiles = deriveThemeTokens(ROOFMILES, 'light');
    const accent    = deriveThemeTokens(ACCENT_LIKE, 'light');

    // NAME THE MISSING PIECE BEFORE COMPARING. Without this, an absent token
    // makes the comparison below `notEqual(undefined, undefined)` — a correct
    // failure reporting "both brands got the same onPrimary", which is true and
    // is not the reason.
    for (const [label, t] of [['RoofMiles', roofmiles], ['Accent-like', accent]]) {
      assert.equal(
        typeof t.onPrimary, 'string',
        `${label}: onPrimary is ${JSON.stringify(t.onPrimary)} — the token is not derived at all`
      );
    }

    assert.notEqual(
      roofmiles.onPrimary, accent.onPrimary,
      'both brands got the same onPrimary — the token is a constant, not a derivation ' +
      `(RoofMiles primary ${roofmiles.primary}, Accent-like primary ${accent.primary})`
    );

    // And each one is on the correct side, so "different" cannot be satisfied by
    // two wrong answers.
    assert.ok(
      contrastRatio(roofmiles.onPrimary, roofmiles.primary) > contrastRatio('#FFFFFF', roofmiles.primary),
      'RoofMiles onPrimary is no better than white on its own primary'
    );
    assert.ok(
      contrastRatio(accent.onPrimary, accent.primary) > contrastRatio('#000000', accent.primary),
      'Accent-like onPrimary is no better than black on its own primary'
    );
  });

  it('[RED] onPrimary holds the floor for EVERY possible fill, not only the fixtures', async () => {
    // THE FIXTURES CANNOT PROVE THIS. Four brands is four samples of a function
    // whose input is any colour a contractor can type into Branding Settings.
    // Sweeping the space is what turns "passes for our palettes" into an
    // invariant — and the invariant is real: the best of pure white and pure
    // black is at worst 4.583:1 (at #5D60FF), which is why this token can
    // guarantee 4.5 without a nudge loop.
    const { deriveThemeTokens, contrastRatio, TEXT_CONTRAST_MIN } = tt();

    let worst = { ratio: Infinity, primary: null, onPrimary: null };
    for (let r = 0; r < 256; r += 17) {
      for (let g = 0; g < 256; g += 17) {
        for (let b = 0; b < 256; b += 17) {
          const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
          const { primary, onPrimary } = deriveThemeTokens(
            { primaryColor: hex, secondaryColor: '#1C2D4D', backgroundColor: '#FFFFFF' }, 'light'
          );
          const ratio = contrastRatio(onPrimary, primary);
          if (ratio < worst.ratio) worst = { ratio, primary, onPrimary };
        }
      }
    }

    assert.ok(
      worst.ratio >= TEXT_CONTRAST_MIN,
      `the worst fill in the sweep was ${worst.primary}, where onPrimary ` +
      `${worst.onPrimary} reaches only ${worst.ratio.toFixed(3)}:1 — below ${TEXT_CONTRAST_MIN}:1`
    );
  });

  it('[RED] onPrimary may not be softened to #111111 — that value cannot hold the floor', async () => {
    // A FENCE AROUND A REAL, MEASURED TRAP, and the reason the retired workaround
    // was not simply moved into the module. BOTH local copies of this computation
    // (LoginScreen.jsx and ResetPinScreen.jsx) chose between #FFFFFF and #111111,
    // and #111111 is the natural "softer than pure black" instinct.
    //
    // IT DOES NOT HOLD. Measured over the colour space, max(white, #111111)
    // bottoms out at 4.345:1 — below AA — and misses 4.5:1 on roughly 3.4% of
    // sampled colours where pure black would have cleared it. Blue fills are the
    // worst case, and a blue brand primary is entirely ordinary.
    //
    // ASSERTED ON THE WITNESS RATHER THAN ONLY ON THE SHIPPED VALUE, deliberately:
    // this must fail if someone re-softens the token, and it must keep saying WHY.
    const { deriveThemeTokens, contrastRatio, TEXT_CONTRAST_MIN } = tt();

    const WITNESS = '#7260FF';
    const soft = Math.max(contrastRatio('#FFFFFF', WITNESS), contrastRatio('#111111', WITNESS));
    const pure = Math.max(contrastRatio('#FFFFFF', WITNESS), contrastRatio('#000000', WITNESS));

    assert.ok(soft < TEXT_CONTRAST_MIN, `${WITNESS} no longer witnesses the #111111 shortfall`);
    assert.ok(pure >= TEXT_CONTRAST_MIN, `${WITNESS} is not reachable by pure black either`);

    // The shipped token must be on the right side of that.
    const { primary, onPrimary } = deriveThemeTokens(
      { primaryColor: WITNESS, secondaryColor: '#1C2D4D', backgroundColor: '#FFFFFF' }, 'light'
    );
    assert.ok(
      contrastRatio(onPrimary, primary) >= TEXT_CONTRAST_MIN,
      `onPrimary ${onPrimary} on ${primary} is below AA — it has been softened away from pure black`
    );
  });

  // ── RULING 2 — THE LIGHT-MODE FILL FLOOR ───────────────────────────────────

  it('[RED] the light-mode fill floor is 3:1 and is NOT the text floor', async () => {
    const { BRAND_ON_LIGHT_MIN_CONTRAST, TEXT_CONTRAST_MIN, BRAND_ON_DARK_MIN_CONTRAST } = tt();

    // THIS PINS A RULING, NOT AN IMPLEMENTATION DETAIL, and that is why it
    // asserts an exact number in a file that otherwise refuses to pin hexes.
    // MEASURED: a 4.5:1 floor here repaints the platform's own #F26A1B to
    // #C54F0B — a visibly browner orange, applied silently by a derivation
    // function, everywhere in light mode. That is a rebrand, not a contrast fix.
    // 3:1 leaves every real palette untouched and bites only where primary is
    // genuinely invisible. If this number is ever raised, it must be raised
    // deliberately, and this test is where that argument happens.
    assert.equal(
      BRAND_ON_LIGHT_MIN_CONTRAST, 3,
      'the light-mode fill floor is WCAG SC 1.4.11 non-text contrast (3:1) — raising it ' +
      'to the text floor repaints #F26A1B to #C54F0B across the whole light-mode app'
    );
    assert.notEqual(
      BRAND_ON_LIGHT_MIN_CONTRAST, TEXT_CONTRAST_MIN,
      'the fill floor and the text floor have been collapsed into one number — they are ' +
      'deliberately different: primary is a FILL (1.4.11), onPrimary is TEXT (1.4.3)'
    );
    // The dark floor is untouched by this ruling.
    assert.equal(
      BRAND_ON_DARK_MIN_CONTRAST, 5.25,
      'the dark brand floor moved — it is not this ruling subject'
    );
  });

  it('[RED] light mode nudges a primary that is invisible on its own surface', async () => {
    const { deriveThemeTokens, contrastRatio, BRAND_ON_LIGHT_MIN_CONTRAST } = tt();

    // THE FLOOR MUST EXIST BEFORE THE WITNESS CAN BE JUDGED AGAINST IT. Without
    // this line an absent constant makes `1.16 < undefined` false, and the
    // non-vacuity guard below reports "the witness no longer fails the floor" —
    // a message that blames the fixture for a missing export.
    assert.equal(
      typeof BRAND_ON_LIGHT_MIN_CONTRAST, 'number',
      'BRAND_ON_LIGHT_MIN_CONTRAST is not exported — the light-mode fill floor does not exist'
    );

    // NON-VACUITY: prove the RAW input actually fails, so that the pass below is
    // evidence the floor fired rather than evidence it was never needed.
    const raw = INVISIBLE_PRIMARY.primaryColor;
    const before = contrastRatio(raw, '#FFFFFF');
    assert.ok(
      before < BRAND_ON_LIGHT_MIN_CONTRAST,
      `the witness brand primary ${raw} is ${before.toFixed(2)}:1 on white — it no longer ` +
      'fails the floor, so this test proves nothing and needs a new witness'
    );

    const { primary, surface } = deriveThemeTokens(INVISIBLE_PRIMARY, 'light');
    assert.notEqual(primary, raw, 'the invisible primary was passed through unchanged — no floor fired');
    const after = contrastRatio(primary, surface);
    assert.ok(
      after >= BRAND_ON_LIGHT_MIN_CONTRAST,
      `light primary ${primary} on surface ${surface} is ${after.toFixed(2)}:1, below the ` +
      `${BRAND_ON_LIGHT_MIN_CONTRAST}:1 fill floor`
    );

    // And every other brand holds it too.
    for (const [label, brand] of BRANDS) {
      const t = deriveThemeTokens(brand, 'light');
      const ratio = contrastRatio(t.primary, t.surface);
      assert.ok(
        ratio >= BRAND_ON_LIGHT_MIN_CONTRAST,
        `${label}: light primary ${t.primary} on ${t.surface} is ${ratio.toFixed(2)}:1`
      );
    }
  });

  it('[RED] a primary that already clears the floor is still a strict passthrough', async () => {
    // THE ANTI-REBRAND FENCE — the positive half of Ruling 2, and the half that
    // would be silently lost if the floor were later "tidied" upward. Stated as
    // what the derivation DOES say (passthrough), not as what it must avoid.
    //
    // #F26A1B clears the fill floor by 0.064 — the tightest real case in the
    // product, which makes it the right witness: any raise of the floor at all
    // moves the platform's own brand colour and fails here first.
    const { deriveThemeTokens, contrastRatio, BRAND_ON_LIGHT_MIN_CONTRAST } = tt();

    // Same reason as the test above: without this, an absent constant makes the
    // per-brand guard blame each fixture instead of the missing export.
    assert.equal(
      typeof BRAND_ON_LIGHT_MIN_CONTRAST, 'number',
      'BRAND_ON_LIGHT_MIN_CONTRAST is not exported — the light-mode fill floor does not exist'
    );

    // ⚠ THE WITNESS IS secondary_color SINCE B-1, AND THE FENCE IS UNCHANGED. The
    // `primary` TOKEN is still the button fill and this still pins that a fill
    // clearing the floor is not repainted. Only the column feeding it moved.
    // #F26A1B is still that witness — it is the platform's ACTION colour now, and
    // it still clears the fill floor by 0.064, the tightest real case in the
    // product.
    for (const [label, brand] of BRANDS) {
      const ratio = contrastRatio(brand.secondaryColor, '#FFFFFF');
      assert.ok(
        ratio >= BRAND_ON_LIGHT_MIN_CONTRAST,
        `${label} no longer clears the floor on its own, so it cannot witness passthrough`
      );
      assert.equal(
        deriveThemeTokens(brand, 'light').primary, brand.secondaryColor,
        `${label}: light primary was repainted from ${brand.secondaryColor} even though it ` +
        `already measured ${ratio.toFixed(3)}:1 — the floor is catching good input`
      );
    }

    assert.equal(
      deriveThemeTokens(ROOFMILES, 'light').primary, '#F26A1B',
      'the platform brand orange has been repainted in light mode'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BRANDING RUN B-1 — RED SUITE — THE ROUTE SWAP (Danny's ruling, 2026-09-01)
//
// WHAT CHANGES, AND IT IS ONLY THE INPUTS. The two stored brand colours swap
// which render tokens they feed:
//
//   primary_color   -> the DARK NEUTRAL: dark-mode `bg` and `surface`, and the
//                      light-mode body `text`.
//   secondary_color -> BUTTONS AND CALLS TO ACTION: the `primary` render token.
//
// ⚠ NO RENDER TOKEN CHANGES MEANING, WHICH IS THE WHOLE POINT OF THIS SHAPE.
// `--rm-primary` is still the button fill everywhere in the app, so not one
// component moves and `onPrimary` — which is computed from the DERIVED primary
// token, never from brand.primaryColor — stays correct with no edit. Under the
// other candidate shape (renaming resolver keys so the `primary` TOKEN became
// the ground) every `var(--rm-primary)` button in the product would have
// inverted and onPrimary would compute against the page. That shape was
// rejected; case 3 below is what would catch a slip back toward it.
//
// ⚠ AND THE DARK `bg` DERIVATION ITSELF IS UNTOUCHED. Deriving the page ground
// from a dark brand colour is correct, and it is what EXPOSED the bad data:
// Accent's stored navy sat in `secondary_color`, so the ground came from their
// red and painted a burgundy page with a blue button. The mechanism was right;
// the input was wrong. Only the input moves.
//
// WHY THE STORED DATA IS SAFE. contractor_settings holds exactly one row
// (verified 2026-09-01): slug `accent`, primary #012854 navy, secondary #8c0000
// red. Under the swap those values become correct AS THEY STAND — navy is the
// ground and the text, red is the buttons. No contractor data changes.
// ─────────────────────────────────────────────────────────────────────────────

// A brand whose two inputs are UNAMBIGUOUSLY ordered: a near-black primary and a
// vivid secondary. Every assertion below reads the routing off this pair, so a
// derivation that swapped them back could not accidentally pass.
//
// ⚠ SHAPED AS THE RULING INTENDS, WHICH IS THE OPPOSITE OF ACCENT_LIKE ABOVE.
// That older fixture predates the ruling and stores its dark tone in `secondary`,
// which was the correct shape under the old routing. Both are kept: ACCENT_LIKE
// exercises the derivation's contrast machinery, ROUTED exercises the routing.
const ROUTED = Object.freeze(resolveBrandingTheme({
  company_name:     'Routed Roofing',
  primary_color:    '#101828',   // the dark neutral  -> ground + body text
  secondary_color:  '#E8452C',   // the action colour -> buttons
  accent_color:     '#FBE4E0',
  landing_bg_color: '#FFFFFF',
}));

// ⚠ THE MODULE'S OWN relativeLuminance, NOT A LOCAL REIMPLEMENTATION. A private
// copy here would be a second definition of the thing under test, and the two
// could agree on a wrong answer — the parallel-implementation failure this run
// is already cleaning up in BrandingPreview. Read at call time so the file still
// fails per-case rather than at load.
function luminance(hex) {
  return tt().relativeLuminance(hex);
}

// ⚠ HUE, NOT CONTRAST, AND THE FIRST DRAFT OF THIS SUITE GOT IT WRONG — RECORDED
// BECAUSE THE MISTAKE IS THE INSTRUCTIVE PART. "Which input did this token come
// from" was first asked with contrastRatio, and contrast measures LIGHTNESS
// distance. Two dark colours of completely different hues have a LOW ratio, so
// "the dark ground is close to the dark input" was TRUE whichever input it
// actually came from: the DARK case PASSED against the unswapped code and proved
// nothing. Hue is what survives the derivation — atLightness and
// nudgeLightnessUntil both move lightness and saturation and preserve hue — so
// hue is what identifies the source.
function hueOf(hex) {
  const { hexToRgb, rgbToHsl } = tt();
  return rgbToHsl(hexToRgb(hex)).h;
}

// Shortest distance around the 360-degree wheel.
function hueGap(a, b) {
  const d = Math.abs(hueOf(a) - hueOf(b)) % 360;
  return d > 180 ? 360 - d : d;
}

// Which of the two stored brand colours a derived token came from, by hue.
function derivedFrom(token, brand) {
  return hueGap(token, brand.primaryColor) <= hueGap(token, brand.secondaryColor)
    ? 'primary_color'
    : 'secondary_color';
}


describe('B-1 — the route swap: which stored colour feeds which token', () => {
  it('[RED] LIGHT: body text derives from primary_color, the button from secondary_color', () => {
    const { deriveThemeTokens } = tt();
    const t = deriveThemeTokens(ROUTED, 'light');

    // BY HUE, not by an exact hex: `text` is nudged until it clears the floor, so
    // pinning its output would pin the nudge loop instead of the routing.
    assert.equal(
      derivedFrom(t.text, ROUTED), 'primary_color',
      `light text (${t.text}) derives from secondary_color. Body text must come from the DARK ` +
      'NEUTRAL, which is primary_color after the ruling.'
    );
    assert.equal(
      derivedFrom(t.primary, ROUTED), 'secondary_color',
      `the light primary TOKEN (${t.primary}) derives from primary_color. That token is the ` +
      'button fill and must come from secondary_color, the action colour.'
    );
  });

  it('[RED] DARK: the page ground derives from primary_color, the button from secondary_color', () => {
    const { deriveThemeTokens } = tt();
    const t = deriveThemeTokens(ROUTED, 'dark');

    assert.equal(
      derivedFrom(t.bg, ROUTED), 'primary_color',
      `dark bg (${t.bg}) derives from secondary_color. This is the exact defect seen live: ` +
      'Accent stored navy in primary and red in secondary, so the ground came from the RED and ' +
      'painted a burgundy page. The ground must come from primary_color.'
    );
    assert.equal(
      derivedFrom(t.surface, ROUTED), 'primary_color',
      `dark surface (${t.surface}) derives from secondary_color — surface is lifted from bg and ` +
      'must follow it.'
    );
    assert.equal(
      derivedFrom(t.primary, ROUTED), 'secondary_color',
      `the dark primary TOKEN (${t.primary}) derives from primary_color. The button must come ` +
      'from secondary_color.'
    );
  });

  it('[RED] THE INVARIANT — the large-area token carries the hue of the DARKER input, both modes', () => {
    // ⚠ THE ONE TO INSIST ON, AND NOTHING IN THIS REPO ASSERTS ANY RELATIONSHIP
    // BETWEEN THE TWO STORED COLOURS TODAY. Every existing invariant checks a
    // token against a THRESHOLD; none checks the two inputs against EACH OTHER.
    // That gap is exactly what let a vivid red become the page ground.
    //
    // ⚠ AND ITS FIRST DRAFT WAS VACUOUS IN DARK MODE — recorded because the
    // mistake is worth more than the fix. It asserted luminance(bg) <
    // luminance(primary), which is STRUCTURALLY TRUE for every brand: bg is
    // produced by atLightness at a fixed dark target and the primary token is
    // brightened until it clears a floor ABOVE the surface. The assertion could
    // not fail, in either direction, for any input. Comparing HUE against the
    // darker INPUT is what makes it discriminate.
    const { deriveThemeTokens } = tt();

    for (const brand of [ROUTED, ROOFMILES]) {
      const darker = luminance(brand.primaryColor) <= luminance(brand.secondaryColor)
        ? 'primary_color' : 'secondary_color';

      const dark = deriveThemeTokens(brand, 'dark');
      assert.equal(
        derivedFrom(dark.bg, brand), darker,
        `${brand.companyName} dark: the page ground (${dark.bg}) does not carry the hue of the ` +
        `DARKER stored colour (${darker}). The colour covering the most pixels must be the ` +
        'darker of the two — "burgundy page, blue button" is this ordering inverted.'
      );

      const light = deriveThemeTokens(brand, 'light');
      assert.equal(
        derivedFrom(light.text, brand), darker,
        `${brand.companyName} light: body text (${light.text}) does not carry the hue of the ` +
        `DARKER stored colour (${darker}). A page of vivid body text is the light-mode face of ` +
        'the same inversion.'
      );
    }
  });

  it('[GREEN-by-design] onPrimary tracks the BUTTON TOKEN, not the ground — the shape-(a) guard', () => {
    // ⚠ GREEN TODAY, DELIBERATELY, AND LABELLED SO RATHER THAN CLAIMED AS RED.
    // onPrimary already derives from the `primary` RENDER TOKEN rather than from
    // brand.primaryColor, which is precisely why shape (a) needs no change here.
    // This case exists to FAIL LATER: under the rejected shape — where the token
    // itself became the dark neutral — every button label would be answering
    // about a colour it does not sit on. Guard-proofed below by making the token
    // the ground and watching it fire.
    const { deriveThemeTokens, contrastRatio, TEXT_CONTRAST_MIN } = tt();

    for (const brand of [ROUTED, ROOFMILES, ACCENT_LIKE, PATHOLOGICAL]) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(brand, mode);
        assert.ok(
          contrastRatio(t.onPrimary, t.primary) >= TEXT_CONTRAST_MIN,
          `${brand.companyName} ${mode}: onPrimary (${t.onPrimary}) fails ${TEXT_CONTRAST_MIN}:1 ` +
          `against the primary TOKEN (${t.primary}). onPrimary must track the button fill.`
        );
        // AND IT MUST NOT BE ANSWERING ABOUT THE GROUND. In dark mode the two are
        // different colours; a foreground chosen for the ground could still pass
        // the ratio above by luck, so the pairing is asserted directly.
        if (mode === 'dark') {
          assert.notEqual(
            t.primary, t.bg,
            `${brand.companyName}: the primary token equals the page ground — the button has ` +
            'become the neutral, which is the shape this run rejected.'
          );
        }
      }
    }
  });

  it('[RED] the PLATFORM DEFAULTS swap with the routing', () => {
    // ⚠ THE SWAP FIXES ACCENT AND BREAKS ROOFMILES UNLESS BOTH MOVE TOGETHER.
    // Routing swapped with the defaults left alone gives an unbranded contractor
    // an ORANGE page ground and NAVY buttons — the platform inverted, on every
    // surface that has no stored palette.
    assert.equal(
      BRANDING_THEME_DEFAULTS.primaryColor, '#1C2D4D',
      'the platform default primary_color must be the NAVY dark neutral after the ruling'
    );
    assert.equal(
      BRANDING_THEME_DEFAULTS.secondaryColor, '#F26A1B',
      'the platform default secondary_color must be the ORANGE action colour after the ruling'
    );

    // AND THE RENDERED RESULT, which is what a person actually sees: a navy
    // ground carrying orange buttons.
    const { deriveThemeTokens } = tt();
    const dark = deriveThemeTokens(ROOFMILES, 'dark');
    assert.equal(derivedFrom(dark.bg, ROOFMILES), 'primary_color',
      `the platform dark ground (${dark.bg}) is not derived from the navy`);
    assert.equal(derivedFrom(dark.primary, ROOFMILES), 'secondary_color',
      `the platform dark button (${dark.primary}) is not derived from the orange`);
  });
});