// ─────────────────────────────────────────────────────────────────────────────
// SELF-HOSTED FONT MANIFEST — Palette-13 Part B, R-B / B.5
//
// ⚠ WHY SELF-HOSTED RATHER THAN GOOGLE, AND IT IS NOT A PERFORMANCE ARGUMENT.
// `server/routes/landing.js` narrows its CSP to `font-src 'self'` and states the
// reason in terms: "on the one public page in the product that interpolates
// contractor-controlled strings, a remote or inline font is an exfiltration
// channel and a third-party dependency we have no reason to keep open." The
// referrer app interpolates the SAME contractor-controlled strings. Loading its
// faces from fonts.gstatic.com would mean the product holds two opposite
// positions on one question, decided by which file you happen to be reading.
//
// ⚠ AND THE COST ARGUMENT IS ABOUT DOWNLOADS, NOT DECLARATIONS. Declaring every
// family below costs ~2 KB of CSS; a browser fetches only the faces a USED
// `font-family` actually matches. A contractor on two families downloads two
// files, exactly as today. The real price is repo weight, paid once.
//
// ── WHERE THESE FILES LIVE, AND WHY NOT NEXT TO THE LANDING PAGE'S ──────────
// ⚠ `public/fonts/`, WHICH IS VITE'S PUBLIC DIR, NOT `server/public/fonts/`.
// The two are served by DIFFERENT DEPLOYMENTS: Vite's `public/` is copied into
// `dist/` and served by Vercel at the site root, while `server/public/` is
// served by Express on Railway under `/static`. The SPA cannot reach the
// latter without going cross-origin to the backend — which would need CORS on
// the font responses and would widen exactly the sourcing this whole decision
// narrows. So the landing page keeps its own two files and this is the SPA's
// set. Montserrat and Roboto are therefore duplicated across the two
// deployments, deliberately, and that is the honest cost of two servers.
//
// ── THE WEIGHT STORY, WHICH IS NOT UNIFORM ──────────────────────────────────
// ⚠ ELEVEN OF THE FIFTEEN FAMILIES ARE VARIABLE — one file covers a whole axis,
// and `weight` below is a RANGE. The other four are not, and they split two
// ways that matter:
//   - `DM Serif Display` genuinely publishes ONE weight. Google serves nothing
//     else, so a bold heading is synthetically emboldened by the browser
//     whatever we do. That is the typeface, not our packaging.
//   - `Poppins`, `Lato` and `Source Sans Pro` publish DISCRETE CUTS. Shipping a
//     single file for those would silently lose real 600/700/900 designs and
//     replace them with synthetic bolding. So they get one file per cut.
// ⚠ THE CUTS SHIPPED ARE THE WEIGHTS THE APP ACTUALLY USES — measured across the
// four in-scope trees: 400, 500, 600, 700, 800, 900. No 300. A weight the app
// never asks for is repo weight for nobody.
//
// ⚠ THIS IS WHY THE FILE COUNT IS 25 AND NOT 15. A reader who counts families
// and expects one file each will think something is duplicated.
// ─────────────────────────────────────────────────────────────────────────────

// Served from the site root by Vercel. Same string the preload links use.
export const FONT_URL_BASE = '/fonts/';

// family -> the faces to declare. `weight` is a CSS `font-weight` descriptor:
// two numbers for a variable axis, one for a static cut.
export const FONT_FACES = Object.freeze({
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
    // Google publishes 300/400/700/900 only — 500, 600 and 800 are synthetic
    // for this family whatever we ship.
    { file: 'lato-latin-400.woff2', weight: '400' },
    { file: 'lato-latin-700.woff2', weight: '700' },
    { file: 'lato-latin-900.woff2', weight: '900' },
  ],
  'Source Sans Pro': [
    // Google publishes 300/400/600/700/900 for this family; 500 and 800 are
    // synthetic. ⚠ AND THE FAMILY IS RETIRED UNDER THIS NAME — Google renamed it
    // to 'Source Sans 3'. The css2 API still serves the old name at v23 and
    // contractors have it SAVED, so the key stays. See FONT_STACKS.
    { file: 'source-sans-pro-latin-400.woff2', weight: '400' },
    { file: 'source-sans-pro-latin-600.woff2', weight: '600' },
    { file: 'source-sans-pro-latin-700.woff2', weight: '700' },
    { file: 'source-sans-pro-latin-900.woff2', weight: '900' },
  ],
});

/**
 * Builds the @font-face CSS for one family, or '' when the family is unknown.
 *
 * `font-display: swap` on every face — landing.js already ruled this and the
 * reason holds: the alternative is a blank headline while a face downloads.
 * ⚠ THE UNICODE RANGE IS THE LATIN SUBSET, matching the files actually fetched.
 * A name carrying a latin-EXT glyph falls back to the system font FOR THAT
 * CHARACTER ONLY, which is the same tradeoff the landing page documents.
 *
 * @param {string} family - a key of FONT_FACES.
 * @returns {string} CSS text, or '' for an unknown family.
 */
export function fontFaceCss(family) {
  const faces = FONT_FACES[family];
  if (!faces) return '';
  return faces.map(({ file, weight }) =>
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
    `font-display:swap;src:url('${FONT_URL_BASE}${file}') format('woff2');` +
    'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,' +
    'U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}'
  ).join('');
}

/**
 * The files to preload for a set of families — the first face of each, which is
 * the one a first paint is most likely to need.
 *
 * ⚠ PRELOAD IS WHAT MAKES SELF-HOSTING SHRINK THE FLASH RATHER THAN MANAGE IT.
 * A same-origin file can be fetched before the CSS that references it is
 * parsed; a per-contractor Google URL cannot be known until branding resolves,
 * so it can never be preloaded at all.
 *
 * @param {string[]} families
 * @returns {string[]} absolute URLs, deduplicated, unknown families skipped.
 */
export function preloadUrls(families) {
  const seen = new Set();
  for (const family of families) {
    const faces = FONT_FACES[family];
    if (faces && faces.length) seen.add(FONT_URL_BASE + faces[0].file);
  }
  return [...seen];
}
