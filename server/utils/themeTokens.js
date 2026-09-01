'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED THEME TOKENS — CANONICAL COPY (C/DL-3a Phase 3)
//
// ⚠ MIRRORED FILE. An identical copy lives at src/utils/themeTokens.mjs so the
// React side can consume the same derivation. THE TWO FILES MUST BE EDITED
// TOGETHER. Same arrangement as brandingTheme.js and as WARMUP_ENTRIES /
// WARMUP_ENTRIES_SERVER, and acceptable for the same reason: a test fails when
// they disagree. server/test/themeTokens.test.js loads both copies — this one by
// require(), the mirror by `await import()` — and compares their exported
// constants AND their derivation across a brand x mode table.
//
// ⚠ THE MIRROR IS ESM WITH A .mjs EXTENSION; THIS COPY IS CommonJS, AND BOTH
// HALVES OF THAT ARE DELIBERATE. The mirror was CommonJS until the Vite dev
// pipeline fix, on the since-retired argument that the drift guard had to
// require() it. The Vite DEV SERVER serves source files verbatim and generates no
// exports from a `module.exports =` — unlike the production build and unlike
// Vitest — so the CommonJS mirror reached the browser with ZERO exports and every
// named import of it failed AT LINK TIME: a blank page, with every gate green,
// for six days. Do not "align" the two copies' module systems. This one must stay
// CommonJS because the landing page and the server tests require() it; the mirror
// must stay ESM because a CommonJS file cannot be served to a browser at all.
// See brandingTheme.js's header for the full account and
// src/devServerPipeline.test.js for the test that now covers that pipeline.
//
// THE OTHER INTENTIONAL DIFFERENCE: the 'use strict' on line 1 exists ONLY here.
// See brandingTheme.js's header for why that asymmetry is a retained convention
// rather than a build requirement. Everything after the header is verbatim EXCEPT
// two lines in the mirror — its `import` of brandingTheme.mjs, and its `export`
// block — which carry the same names and values as this file's `require` and
// `module.exports`.
//
// ── WHAT THIS IS ─────────────────────────────────────────────────────────────
// One pure function turning a contractor's resolved brand colours plus a mode
// into the render tokens the mockup specifies (DECISION_C_DL_BUILD_SPEC.md
// section 5, plus onPrimary — see RENDER_TOKEN_KEYS), and a second turning those tokens into CSS custom properties.
//
//     deriveThemeTokens(resolveBrandingTheme(row), 'dark')  ->  { primary, ... }
//     themeCssVariables(tokens)                             ->  { '--rm-bg', ... }
//
// A SEPARATE LAYER, NOT AN EXTENSION OF resolveBrandingTheme. This is spec
// amendment A20's second option, taken deliberately. The base resolver keeps its
// four consumers and its whole-output deepEqual fences unchanged; this module
// composes on top of it. accentColor stays a BASE brand value and is
// deliberately not one of the render tokens — it paints soft washes, which is a
// different job from any of them.
//
// DARK MODE IS DERIVED, not stored. There is no second palette in the database
// and no dark-mode columns: one stored brand, two computed themes. That is what
// keeps a contractor from having to configure a dark palette they will never
// look at, and what keeps the two themes from drifting apart.
//
// PURE — no database, no request, no network, no environment, no clock. Same
// property brandingTheme.js argues for itself, and for the same two callers: a
// server render per request, and a React surface re-rendering on a toggle.
// ─────────────────────────────────────────────────────────────────────────────

const { BRANDING_THEME_DEFAULTS, BRANDING_HEX_RE } = require('./brandingTheme');

// ─── TUNABLE CONSTANTS ───────────────────────────────────────────────────────
// EVERYTHING IN THIS BLOCK IS VISUALLY TUNABLE except TEXT_CONTRAST_MIN. Move
// the others to taste — they change how the derived themes look, and no test
// asserts a specific hex. TEXT_CONTRAST_MIN is the one hard invariant: it is
// WCAG AA, several tests assert against it by name, and lowering it makes the
// product illegible for exactly the users least able to say so.

// The render tokens. Exported so the CSS variable names cannot drift from the
// token set.
//
// ⚠ SIX SINCE C/DL-3c PHASE 1a, AND THE FIRST FIVE ARE ORDER-SENSITIVE.
// DECISION_C_DL_BUILD_SPEC.md amendment A23.1 rests on this list being spec
// section 5's token set "exactly, in section 5's order". `onPrimary` is
// APPENDED so that claim stays literally true of the prefix — reordering this
// list would falsify an amendment rather than merely churn a line.
//
// onPrimary is the readable foreground for a control filled with `primary`. It
// is a render token rather than a second registry because it is derived per
// brand and per mode exactly as the other five are, and spec section 5's rule
// is one theming system with no second implementation.
const RENDER_TOKEN_KEYS = Object.freeze(['primary', 'secondary', 'bg', 'surface', 'text', 'onPrimary']);

// camelCase token key -> kebab-case custom-property suffix. `onPrimary` becomes
// `on-primary`; the five original keys are single lowercase words and pass
// through untouched, which is what made this safe to introduce after the fact.
//
// ⚠ IT EXISTS BECAUSE CSS CUSTOM PROPERTIES ARE CASE-SENSITIVE, so `--rm-onPrimary`
// would be a perfectly valid property that simply is not the one anybody writes.
// Every hand-authored consumer in src/ reaches for kebab-case, because that is
// what STATUS_VARS already established (`--rm-danger-text`, `--rm-success-text`).
// A camelCase property would resolve to nothing in every component that used the
// obvious spelling, and would do it SILENTLY — var() falls back rather than
// erroring, so the fallback colour paints and nothing anywhere reports a miss.
function cssName(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// THE TOKEN KEY -> CUSTOM PROPERTY NAME MAP. Exactly the role STATUS_VARS plays
// for the status palette, and added for exactly the reason that one exists.
//
// ⚠ IT IS HERE BECAUSE A SECOND NAMING RULE ALREADY CAUSED A FAILURE. Consumers
// were reconstructing property names themselves with `\`--rm-${key}\`` —
// ThemeProvider.test.jsx and BrandingProvider.test.jsx both did. That is a
// SECOND implementation of the naming rule, and it agreed with this module only
// while every key happened to be a single lowercase word. `onPrimary` ended
// that: the tests derived `--rm-onPrimary`, the module emitted
// `--rm-on-primary`, and five assertions failed on a disagreement about
// spelling rather than about behaviour.
//
// So the names are PUBLISHED rather than derivable. A consumer that reads this
// map cannot spell a property differently from the one that gets mounted, which
// is the same guarantee STATUS_VARS gives and the same reason themeCssVariables
// builds from RENDER_TOKEN_KEYS instead of a hand-written list.
const RENDER_TOKEN_VARS = Object.freeze(
  Object.fromEntries(RENDER_TOKEN_KEYS.map((key) => [key, `--rm-${cssName(key)}`]))
);

// HARD INVARIANT — WCAG AA normal text. Not tunable.
const TEXT_CONTRAST_MIN = 4.5;

// Tunable. How readable a BRAND tone (primary, secondary) must be against the
// dark surface before the derivation stops brightening it. Deliberately a
// separate constant from TEXT_CONTRAST_MIN — one is an aesthetic threshold, the
// other is an accessibility floor — and as of the tightening below the two have
// in fact moved apart, which is exactly what that separation was for.
//
// RAISED 4.5 -> 5.25 (C/DL-3a Phase 3, pre-deploy tightening). At 4.5 the brand
// tones cleared the text floor only just: RoofMiles' dark secondary landed at
// 4.71:1. That is fine for decoration and thin for a tone that will carry text
// and controls, which is what secondary does on the rep surfaces.
//
// WHY 5.25 RATHER THAN THE 5.5 ACTUALLY WANTED. This constant is a FLOOR the
// nudge loop stops at, and the loop moves in NUDGE_STEP_L lightness increments,
// so the ACHIEVED ratio overshoots the floor and does so in jumps. For the
// RoofMiles secondary those jumps are 4.71 -> 5.08 -> 5.47 -> 5.90; 5.25 is the
// floor that lands on 5.47, the closest achievable to 5.5. A floor of 5.5 lands
// on 5.90 instead. Re-derive this if NUDGE_STEP_L ever changes — the mapping
// from floor to achieved ratio is a property of the step size, not a constant.
//
// IT GOVERNS primary TOO, unavoidably: it is one threshold for both brand tones.
// The raise left RoofMiles' primary untouched (#F26A1B already sat at 5.59:1)
// but does brighten a darker brand primary further. If the two tones ever need
// different headroom, that is a deliberate split into two constants, not a quiet
// edit to this one.
const BRAND_ON_DARK_MIN_CONTRAST = 5.25;

// ⚠ NOT TUNABLE BY TASTE, AND DELIBERATELY NOT TEXT_CONTRAST_MIN. This is the
// floor `primary` must clear against the LIGHT surface (C/DL-3c Phase 1a,
// Ruling 2). Before it existed, light mode had no floor on primary at all —
// dark had one and light did not, so light was the unguarded mode.
//
// WHY 3 AND NOT 4.5, WHICH IS THE OBVIOUS SYMMETRY AND IS WRONG HERE.
// `primary` is a FILL and a graphic — a button background, a border, a focus
// ring, a spinner arc. WCAG's number for that is SC 1.4.11 non-text contrast,
// which is 3:1. TEXT_CONTRAST_MIN (SC 1.4.3, 4.5:1) is the number for TEXT, and
// the text that sits on this fill has its own token: onPrimary. TWO NUMBERS FOR
// TWO DIFFERENT PAIRS, each applied to the thing it is the number for.
//
// ⚠ AND THE MEASUREMENT THAT SETTLED IT, because "tighten it to match the text
// floor" is a one-character edit that looks like an improvement. At 4.5 this
// loop repaints the platform's own #F26A1B (3.064:1 on white) to #C54F0B — a
// visibly browner orange, everywhere in light mode, applied silently by a
// derivation function. That is a REBRAND, not a contrast fix. At 3 it repaints
// nothing real: RoofMiles 3.06, an Accent-like red 5.62 and even the mid-grey
// pathological fixture 4.29 all pass through untouched, and the floor fires
// only on a palette that is genuinely invisible on a white card (a pale yellow
// #FFF176 at 1.16:1 becomes #9F8F00). A floor is for catching pathological
// input, not for adjusting good input.
//
// ⚠ ITS SIBLING GOVERNS BOTH BRAND TONES AND THIS ONE GOVERNS ONLY primary, and
// that asymmetry is deliberate rather than an oversight. BRAND_ON_DARK_MIN_CONTRAST
// has to move secondary too, because on a near-black canvas a dark brand tone is
// invisible and there is no way around it. In light mode secondary is not
// painted anywhere and `text` already derives from it with its own floor, so a
// second nudge would change a value nothing reads. See the forward-trap note at
// readableForegroundOn for what changes if that stops being true.
const BRAND_ON_LIGHT_MIN_CONTRAST = 3;

// Tunable. The light-mode card colour. See the light-mode note at
// deriveLightTokens for why this is not derived from the contractor's bg.
const LIGHT_SURFACE_HEX = '#FFFFFF';

// Tunable. HSL lightness targets for the dark theme, in [0,1]. The mockup's
// feasibility note is near-black surfaces rather than a grey inversion, so the
// canvas sits very low and the card lifts off it by a small step rather than by
// a border.
const DARK_BG_TARGET_L = 0.08;
const DARK_SURFACE_LIFT_L = 0.05;
const DARK_TEXT_TARGET_L = 0.96;

// Tunable. Caps how much of the brand's saturation survives into the dark
// canvas. Without it a vivid brand secondary produces a lurid coloured
// near-black rather than a near-neutral one carrying a hint of the brand.
const DARK_BG_MAX_SATURATION = 0.5;

// Tunable, but bounded ON PURPOSE. The nudge loop walks lightness in
// NUDGE_STEP_L increments and gives up after NUDGE_MAX_STEPS, so a pathological
// palette can never spin. The product of the two (1.2) exceeds the full [0,1]
// lightness range, so the loop always reaches an extreme before the cap.
const NUDGE_STEP_L = 0.02;
const NUDGE_MAX_STEPS = 60;

// ─── COLOUR MATH ─────────────────────────────────────────────────────────────
// Implemented inline rather than pulled from a package: six standard formulas,
// no dependency, and nothing in the repo already does this (verified by grep,
// Phase 3 Step 1).

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

// Parses a strict six-digit hex colour into 0-255 channels, or null.
// Reuses brandingTheme.js's regex rather than declaring a second one — the same
// argument its header makes: one regex across both surfaces beats two that
// nearly agree. The 3-digit CSS shorthand is refused there and therefore here.
function hexToRgb(hex) {
  if (typeof hex !== 'string' || !BRANDING_HEX_RE.test(hex)) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

// Emits canonical uppercase #RRGGBB. Channels are rounded and clamped, because
// every value reaching here came out of floating-point HSL math.
function rgbToHex({ r, g, b }) {
  const channel = (value) => Math.round(Math.min(255, Math.max(0, value)))
    .toString(16).padStart(2, '0').toUpperCase();
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

// Standard RGB -> HSL. Hue in degrees [0,360), saturation and lightness in [0,1].
// HSL is the working space for the whole derivation because every operation here
// is "same colour, different lightness" — which is one field in HSL and a
// three-channel problem in RGB.
function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn)      h = 60 * (((gn - bn) / delta) % 6);
  else if (max === gn) h = 60 * (((bn - rn) / delta) + 2);
  else                 h = 60 * (((rn - gn) / delta) + 4);
  if (h < 0) h += 360;

  return { h, s, l };
}

// Standard HSL -> RGB, channels rounded to 0-255.
function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;

  let rgb;
  if (hp < 1)      rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else             rgb = [c, 0, x];

  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

// WCAG 2.x relative luminance. Throws on an unparseable colour rather than
// returning 0 — a silent 0 would read as "pure black", which passes every
// contrast check against a light surface and would hide the fault.
function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) throw new Error(`themeTokens: relativeLuminance received ${JSON.stringify(hex)}, not a #RRGGBB colour`);
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

// WCAG contrast ratio, 1:1 to 21:1. Order-independent.
function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── DERIVATION HELPERS ──────────────────────────────────────────────────────

// Returns the colour at the given lightness, preserving hue and saturation.
// Saturation is optionally capped, which is how the dark canvas keeps a hint of
// the brand without taking all of it.
function atLightness(hex, lightness, maxSaturation = 1) {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb({
    h: hsl.h,
    s: Math.min(hsl.s, maxSaturation),
    l: clamp01(lightness),
  }));
}

// Walks lightness one NUDGE_STEP_L at a time in `direction` (-1 darker, +1
// lighter) until `passes(candidate)` is true, and returns that candidate.
//
// THIS IS WHAT MAKES THE CONTRAST FLOOR A GUARANTEE RATHER THAN A HOPE. A
// derivation that simply took the brand's own colour as its text token would be
// correct for most palettes and illegible for the rest, with nothing to say so.
//
// BOUNDED: at most NUDGE_MAX_STEPS iterations, and it stops early at either
// extreme. If it exhausts the range it returns pure black or pure white — the
// terminal value in the requested direction, which by construction satisfies
// every predicate this module uses (black on a near-white surface is 21:1;
// white on a near-black surface is around 17:1).
function nudgeLightnessUntil(hex, direction, passes) {
  if (passes(hex)) return hex;

  const hsl = rgbToHsl(hexToRgb(hex));
  let lightness = hsl.l;

  for (let step = 0; step < NUDGE_MAX_STEPS; step++) {
    lightness = clamp01(lightness + direction * NUDGE_STEP_L);
    const candidate = rgbToHex(hslToRgb({ h: hsl.h, s: hsl.s, l: lightness }));
    if (passes(candidate)) return candidate;
    if (lightness === 0 || lightness === 1) break;
  }
  return direction < 0 ? '#000000' : '#FFFFFF';
}

// Coerces whatever a caller handed in into three usable brand colours.
//
// THIS IS THE UNUSABLE-SOURCE PATH. The intended input is
// resolveBrandingTheme's output, where all three are already validated hex — so
// in the normal case this is the identity. It exists because this function is
// exported and a caller may hand it a raw snake_case row, a half-built form
// object, or null, and every downstream step assumes a parseable colour. Falling
// back to the platform defaults rather than throwing matches the base resolver's
// own rule: a throw here is an unstyled surface.
function normalizeBrand(brand) {
  const src = (brand && typeof brand === 'object') ? brand : {};
  const usable = (value, fallback) =>
    (typeof value === 'string' && BRANDING_HEX_RE.test(value)) ? value : fallback;
  return {
    primaryColor:    usable(src.primaryColor,    BRANDING_THEME_DEFAULTS.primaryColor),
    secondaryColor:  usable(src.secondaryColor,  BRANDING_THEME_DEFAULTS.secondaryColor),
    backgroundColor: usable(src.backgroundColor, BRANDING_THEME_DEFAULTS.backgroundColor),
  };
}

// Returns the readable foreground for a control FILLED with `fill` — the value
// the onPrimary token carries.
//
// WHY THE TWO EXTREMES AND NOT A NUDGE LOOP, which is how every other floor in
// this file is met. Pure white and pure black are the endpoints of the contrast
// range, so max(white, black) is by construction the BEST foreground any colour
// can have. Its minimum over the whole colour space is 4.583:1, at #5D60FF —
// above TEXT_CONTRAST_MIN. So this is not "nudge until it passes"; it is
// "the best available always passes", which is a stronger property and needs no
// iteration, no step size and no give-up branch.
//
// ⚠ PURE BLACK, NOT #111111, AND THE DIFFERENCE IS NOT COSMETIC. Both retired
// local workarounds (LoginScreen.jsx, ResetPinScreen.jsx) chose between #FFFFFF
// and #111111, which is the natural softer-than-black instinct. MEASURED, that
// pair bottoms out at 4.345:1 — BELOW AA — and misses 4.5:1 on roughly 3.4% of
// sampled colours where pure black clears it. The failures are blues; a blue
// brand primary is entirely ordinary. The guarantee above holds only for the
// true extremes, so the extremes are what this returns. themeTokens.test.js
// fences this with #7260FF as the witness.
//
// ⚠ AND THIS IS THE ONE PLACE THAT DECISION IS MADE. The palette question the
// pre-launch checklist raises about the Sign In button — near-black on orange
// reading as a warning rather than a primary action — is a judgement about THIS
// function's output, for every brand at once. It belongs to the UI Overhaul
// arc; when it is ruled, this is the single site that changes.
function readableForegroundOn(fill) {
  return contrastRatio('#FFFFFF', fill) >= contrastRatio('#000000', fill)
    ? '#FFFFFF'
    : '#000000';
}

// ⚠ FORWARD TRAP, RECORDED WHERE THE NEXT PERSON TO HIT IT WILL BE STANDING.
// There is deliberately NO onSecondary token, because nothing paints on a
// secondary fill today — `--rm-secondary` has zero paint consumers in src/.
// THE MOMENT SOMETHING DOES, IT INHERITS onPrimary'S DEFECT, MODE-FLIPPED AND
// INVISIBLE IN TESTING: white on the light-mode secondary measures 13.71:1 for
// the platform brand, and white on the DARK-mode secondary measures ~3.05:1,
// because deriveDarkTokens BRIGHTENS the brand tones to survive the dark canvas.
// A component built and eyeballed in light mode is therefore built against the
// good half of that pair. The fix is `onSecondary: readableForegroundOn(secondary)`
// in both derivations plus the key in RENDER_TOKEN_KEYS — the same shape as
// onPrimary, which is why this helper takes the fill as an argument rather than
// hardcoding primary. It is NOT built now because a token with no consumer is a
// token nobody re-derives when it moves.

// LIGHT THEME. secondary and bg are the contractor's own values, unchanged —
// the light theme IS their brand, and inventing a tint of it would mean the
// colour they picked is not the colour they get.
//
// ⚠ primary IS NO LONGER AN UNCONDITIONAL PASSTHROUGH (C/DL-3c Phase 1a,
// Ruling 2), and the qualifier matters more than the change: it is a
// passthrough for every palette that clears BRAND_ON_LIGHT_MIN_CONTRAST, which
// measured is every real one. The floor exists for the palette that does not.
//
// KNOWN AND ACCEPTED CONSEQUENCE (ruled C/DL-3a Phase 3): because bg is a strict
// passthrough and its platform default is #FFFFFF, bg and surface can be the
// same colour. Light-mode cards are therefore defined by their EDGE — a border
// or shadow, owned by the card primitive — not by contrast against the canvas.
// The mockup got separation by making light bg a faint grey; deriving one here
// would override a value the contractor actually stored. If a faint-grey derived
// light canvas is ever wanted, that is a deliberate future decision, not a
// silent one taken here.
function deriveLightTokens(brand) {
  const surface = LIGHT_SURFACE_HEX;

  // ⚠ THE TWO BRAND INPUTS ARE ROUTED BY B-1's RULING (2026-09-01), AND THE
  // NAMES READ BACKWARDS UNTIL YOU KNOW WHY.
  //   brand.primaryColor   is the DARK NEUTRAL  -> the ground, and the body text
  //   brand.secondaryColor is the ACTION COLOUR -> the `primary` RENDER TOKEN
  // "Primary" names the contractor's PRIMARY BRAND COLOUR — usually the dark one
  // a roofing company puts on its trucks — not the primary ACTION colour. That is
  // the reading every contractor already had, and the mismatch is what produced a
  // live burgundy page with a blue button: Accent stored navy in primary and red
  // in secondary, and the ground came from the red.
  // ⚠ THE RENDER TOKENS DID NOT MOVE. `primary` is still the button fill for
  // every consumer of --rm-primary, which is why no component changed and why
  // onPrimary — computed from the token below, never from brand.primaryColor —
  // is correct without an edit. ⚠ DO NOT "TIDY" THIS BY SWAPPING THE TOKEN NAMES
  // BACK; that inverts every button in the product.

  // DARKENS, unlike the dark theme's brightening, because the surface it has to
  // survive is white. The predicate is BRAND_ON_LIGHT_MIN_CONTRAST and not
  // TEXT_CONTRAST_MIN on purpose — see that constant for why the two numbers
  // differ and why this one must not be raised to match its sibling.
  const primary = nudgeLightnessUntil(
    brand.secondaryColor, -1,
    (candidate) => contrastRatio(candidate, surface) >= BRAND_ON_LIGHT_MIN_CONTRAST
  );

  return {
    primary,
    secondary: brand.primaryColor,
    bg:        brand.backgroundColor,
    surface,
    // Text starts at the brand's own dark tone and DARKENS until it clears the
    // floor against the card it sits on.
    text: nudgeLightnessUntil(
      brand.primaryColor, -1,
      (candidate) => contrastRatio(candidate, surface) >= TEXT_CONTRAST_MIN
    ),
    // Against the FLOORED primary, for the same reason dark computes it against
    // the brightened one: the foreground must answer about the colour that is
    // actually painted.
    onPrimary: readableForegroundOn(primary),
  };
}

// DARK THEME. The canvas and the card are derived from the brand's dark tone
// (primaryColor after B-1; it was secondaryColor before the route swap) so the
// dark theme still reads as this contractor's, then the
// brand tones are brightened until they survive on it.
//
// secondary IS A BRAND TONE HERE, BRIGHTENED — deliberately not the mockup's
// dark-secondary hexes (#121E33 / #14171B), which are that theme's elevated
// panel tone and would make secondary a near-duplicate of surface, leaving four
// usable tokens instead of five. Ruled C/DL-3a Phase 3.
function deriveDarkTokens(brand) {
  // ⚠ THE TWO BRAND INPUTS ARE ROUTED BY B-1's RULING (2026-09-01), AND THE
  // NAMES READ BACKWARDS UNTIL YOU KNOW WHY.
  //   brand.primaryColor   is the DARK NEUTRAL  -> the ground, and the body text
  //   brand.secondaryColor is the ACTION COLOUR -> the `primary` RENDER TOKEN
  // "Primary" names the contractor's PRIMARY BRAND COLOUR — usually the dark one
  // a roofing company puts on its trucks — not the primary ACTION colour. That is
  // the reading every contractor already had, and the mismatch is what produced a
  // live burgundy page with a blue button: Accent stored navy in primary and red
  // in secondary, and the ground came from the red.
  // ⚠ THE RENDER TOKENS DID NOT MOVE. `primary` is still the button fill for
  // every consumer of --rm-primary, which is why no component changed and why
  // onPrimary — computed from the token below, never from brand.primaryColor —
  // is correct without an edit. ⚠ DO NOT "TIDY" THIS BY SWAPPING THE TOKEN NAMES
  // BACK; that inverts every button in the product.
  const bg = atLightness(brand.primaryColor, DARK_BG_TARGET_L, DARK_BG_MAX_SATURATION);
  const surface = atLightness(bg, DARK_BG_TARGET_L + DARK_SURFACE_LIFT_L, DARK_BG_MAX_SATURATION);

  const readableOnSurface = (candidate) => contrastRatio(candidate, surface) >= BRAND_ON_DARK_MIN_CONTRAST;

  const primary = nudgeLightnessUntil(brand.secondaryColor, 1, readableOnSurface);

  return {
    primary,
    secondary: nudgeLightnessUntil(brand.primaryColor, 1, readableOnSurface),
    bg,
    surface,
    // COMPUTED FROM THE BRIGHTENED primary, not from brand.primaryColor. In
    // dark mode the fill is not the colour the contractor stored, so a
    // foreground derived from the stored value would be answering about a
    // colour that never appears on screen.
    onPrimary: readableForegroundOn(primary),
    // Text starts as a light foreground carrying the brand's hue, then LIGHTENS
    // until it clears the floor. The starting point is already legible for any
    // ordinary palette; the loop is what covers the ones that are not.
    text: nudgeLightnessUntil(
      atLightness(brand.primaryColor, DARK_TEXT_TARGET_L), 1,
      (candidate) => contrastRatio(candidate, surface) >= TEXT_CONTRAST_MIN
    ),
  };
}

/**
 * Derives the render tokens for one contractor in one mode.
 *
 * @param {object|null|undefined} brand - resolveBrandingTheme's output, or
 *        anything else; unusable values fall back to the platform defaults
 *        rather than throwing (see normalizeBrand).
 * @param {'light'|'dark'} mode - required. An unknown mode THROWS rather than
 *        defaulting: a silently-defaulted mode paints a dark-mode user a white
 *        surface and logs nothing anywhere.
 * @returns {{primary: string, secondary: string, bg: string, surface: string,
 *            text: string, onPrimary: string}}
 *          Every value a valid #RRGGBB. TWO GUARANTEES, AND THEY ARE MEASURED
 *          AGAINST DIFFERENT THINGS: `text` clears TEXT_CONTRAST_MIN against
 *          `surface`, and `onPrimary` clears TEXT_CONTRAST_MIN against
 *          `primary`. Both hold in both modes. `primary` itself clears only the
 *          weaker FILL floor — see BRAND_ON_LIGHT_MIN_CONTRAST.
 */
function deriveThemeTokens(brand, mode) {
  if (mode !== 'light' && mode !== 'dark') {
    throw new Error(`themeTokens: unknown mode ${JSON.stringify(mode)} — expected 'light' or 'dark'`);
  }
  const normalized = normalizeBrand(brand);
  return mode === 'light' ? deriveLightTokens(normalized) : deriveDarkTokens(normalized);
}

/**
 * Maps the render tokens onto their CSS custom properties.
 *
 * Names are built FROM RENDER_TOKEN_KEYS so the property set cannot drift from
 * the token set. Trivial and pure by design — the hybrid split is deliberate:
 * the derivation returns a plain object for the cases that need a raw colour in
 * JS, and this turns the same object into the variables a stylesheet consumes.
 *
 * @param {object} tokens - deriveThemeTokens' output.
 * @returns {object} e.g. { '--rm-primary': '#F26A1B', ... }
 * @throws if any token is missing or is not a #RRGGBB colour. An emitted
 *         "--rm-text: undefined" is a silent failure — no error anywhere and one
 *         invisible element on the page.
 */
function themeCssVariables(tokens) {
  const src = (tokens && typeof tokens === 'object') ? tokens : {};
  const vars = {};
  for (const key of RENDER_TOKEN_KEYS) {
    const value = src[key];
    if (typeof value !== 'string' || !BRANDING_HEX_RE.test(value)) {
      throw new Error(`themeTokens: token '${key}' is ${JSON.stringify(value)}, not a #RRGGBB colour`);
    }
    vars[RENDER_TOKEN_VARS[key]] = value;
  }
  return vars;
}

module.exports = {
  deriveThemeTokens,
  themeCssVariables,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  relativeLuminance,
  contrastRatio,
  RENDER_TOKEN_KEYS,
  RENDER_TOKEN_VARS,
  TEXT_CONTRAST_MIN,
  BRAND_ON_DARK_MIN_CONTRAST,
  BRAND_ON_LIGHT_MIN_CONTRAST,
  LIGHT_SURFACE_HEX,
  DARK_BG_TARGET_L,
  DARK_SURFACE_LIFT_L,
  DARK_TEXT_TARGET_L,
  DARK_BG_MAX_SATURATION,
  NUDGE_STEP_L,
  NUDGE_MAX_STEPS,
};
