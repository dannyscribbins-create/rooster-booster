'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE SERVER-SIDE FACE TABLE — family -> woff2 files, for the landing page
//
// ⚠ WHY THIS EXISTS AND IS NOT AN IMPORT. `src/constants/fontManifest.mjs` holds
// the same table for the SPA. It is ESM in the Vite tree; this file is CommonJS
// on the server, and `PAGE_CSS` is assembled at module load, so there is no
// synchronous require that reaches it. The established answer in this codebase
// is a MIRROR with a parity test — `brandingTheme.js`/`.mjs` and
// `themeTokens.js`/`.mjs` are the two precedents, and this is the third pair.
//
// ⚠ MIRRORS DRIFT, SO THE PARITY IS TESTED RATHER THAN TRUSTED.
// `server/test/landingContractorFonts.test.js` deep-equals this table against
// the app's by READING BOTH — it does not restate either. If you add a family
// here, add it there, and that test is what makes forgetting fail loudly.
//
// ── ⚠ THE URL BASE IS THE ONLY INTENTIONAL DIFFERENCE ───────────────────────
// The app's manifest serves from `/fonts/`, which is VERCEL's origin. The
// landing page is served by EXPRESS on Railway and narrows `font-src` to
// 'self', so it cannot reference Vercel at all. `server/app.js` mounts the
// repo's `public/fonts` at `/static/fonts` — the SAME files, on this origin.
//
// ⚠ NO SECOND COPY OF THE BINARIES. `public/fonts/` is tracked (40 files) and
// Railway's build is `npm install` over a full checkout, so those files are
// already on this filesystem. Duplicating 492 KB of woff2 into `server/public/`
// would have been the obvious move and would have created a second asset set
// with nothing keeping the two in step.
// ─────────────────────────────────────────────────────────────────────────────

// Where THIS origin serves the faces from. Not the app's '/fonts/'.
const LANDING_FONT_URL_BASE = '/static/fonts/';

// family -> the faces to declare. `weight` is a CSS font-weight descriptor:
// two numbers for a variable axis, one for a static cut.
// ⚠ MUST EQUAL src/constants/fontManifest.mjs's FONT_FACES, deep, key for key.
const FONT_FACES = Object.freeze({
  'Montserrat':       [{ file: 'montserrat-latin.woff2',       weight: '100 900' }],
  'Roboto':           [{ file: 'roboto-latin.woff2',           weight: '100 900' }],
  'Inter':            [{ file: 'inter-latin.woff2',            weight: '100 900' }],
  'Raleway':          [{ file: 'raleway-latin.woff2',          weight: '100 900' }],
  'Work Sans':        [{ file: 'work-sans-latin.woff2',        weight: '100 900' }],
  'DM Sans':          [{ file: 'dm-sans-latin.woff2',          weight: '100 900' }],
  'Nunito':           [{ file: 'nunito-latin.woff2',           weight: '200 900' }],
  'Open Sans':        [{ file: 'open-sans-latin.woff2',        weight: '300 800' }],
  'Playfair Display': [{ file: 'playfair-display-latin.woff2', weight: '400 900' }],
  'Oswald':           [{ file: 'oswald-latin.woff2',           weight: '400 700' }],
  'Roboto Mono':      [{ file: 'roboto-mono-latin.woff2',      weight: '400 700' }],
  'DM Serif Display': [{ file: 'dm-serif-display-latin-400.woff2', weight: '400' }],
  'Poppins': [
    { file: 'poppins-latin-400.woff2', weight: '400' },
    { file: 'poppins-latin-500.woff2', weight: '500' },
    { file: 'poppins-latin-600.woff2', weight: '600' },
    { file: 'poppins-latin-700.woff2', weight: '700' },
    { file: 'poppins-latin-800.woff2', weight: '800' },
    { file: 'poppins-latin-900.woff2', weight: '900' },
  ],
  'Lato': [
    { file: 'lato-latin-400.woff2', weight: '400' },
    { file: 'lato-latin-700.woff2', weight: '700' },
    { file: 'lato-latin-900.woff2', weight: '900' },
  ],
  'Source Sans Pro': [
    { file: 'source-sans-pro-latin-400.woff2', weight: '400' },
    { file: 'source-sans-pro-latin-600.woff2', weight: '600' },
    { file: 'source-sans-pro-latin-700.woff2', weight: '700' },
    { file: 'source-sans-pro-latin-900.woff2', weight: '900' },
  ],
});

// The latin subset the shipped files actually cover. A name carrying a
// latin-EXT glyph falls back to the system font FOR THAT CHARACTER ONLY —
// the same tradeoff the landing page already documents for its two faces.
const UNICODE_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,' +
  'U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

/**
 * Builds the @font-face CSS for one family, or '' when the family is unknown.
 *
 * ⚠ AN UNKNOWN FAMILY RETURNS '' RATHER THAN THROWING, and the caller only ever
 * passes a family that already came back from `resolveFont()` — so an off-list
 * value has become the platform default before it reaches here. This is the
 * second line of that defence, not the first.
 *
 * `font-display: swap` on every face. landing.js ruled it and the reason holds:
 * the alternative is a blank headline on the one screen that has to earn a
 * stranger's trust in two seconds.
 *
 * @param {string} family - a key of FONT_FACES.
 * @returns {string} CSS text, or '' for an unknown family.
 */
function fontFaceCss(family) {
  const faces = FONT_FACES[family];
  if (!faces) return '';
  return faces.map(({ file, weight }) =>
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
    `font-display:swap;src:url('${LANDING_FONT_URL_BASE}${file}') format('woff2');` +
    `unicode-range:${UNICODE_RANGE};}`
  ).join('');
}

/**
 * The @font-face block for a resolved theme: its heading and body families,
 * DEDUPLICATED — a contractor using one family for both must not declare it
 * twice.
 *
 * ⚠ ONLY THE FAMILIES THIS PAGE WILL ACTUALLY USE, AND THAT DIVERGES FROM THE
 * APP DELIBERATELY. The SPA declares all 14 because branding resolves in the
 * BROWSER, after the CSS is parsed — it cannot know which family it needs, so
 * it declares everything and lets the browser match. This page resolves
 * branding ON THE SERVER before it writes a byte, so it knows. Declaring the
 * other twelve would add ~1.5 KB of CSS that can never match, on the one page
 * in the product whose job is loading fast for a stranger.
 *
 * @param {{headingFont: string, bodyFont: string}} theme - a resolved theme.
 * @returns {string} CSS text.
 */
function themeFontFaces(theme) {
  const families = [theme && theme.headingFont, theme && theme.bodyFont]
    .filter((f) => typeof f === 'string' && f !== '');
  const seen = new Set();
  let css = '';
  for (const family of families) {
    if (seen.has(family)) continue;
    seen.add(family);
    css += fontFaceCss(family);
  }
  return css;
}

module.exports = { FONT_FACES, LANDING_FONT_URL_BASE, fontFaceCss, themeFontFaces };
