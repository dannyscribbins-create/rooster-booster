'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SERVER-RENDERED LANDING PAGE — LP §2 STATES 0-3 (C/DL-2 Phase 3d-2)
//
// The page a homeowner reaches by scanning a QR or tapping a referral link
// without the app installed. Amendment A8 rules it SERVER-RENDERED FROM EXPRESS
// — not a Vercel deployment and not a route inside the CRA app. A9 fixes the
// path at /i/<slug>; /r/ is void and appears nowhere in code.
//
// Phase 3d-1 shipped the plumbing: the mount, the scoped CSP, the per-request
// nonce and a placeholder body. This phase replaces that body with LP §2's four
// states. What was NOT replaced is the escaping discipline or the CSP wiring —
// both are load-bearing and both are unchanged below.
//
// ── ONE DOCUMENT, THREE STATES ──────────────────────────────────────────────
// States 1, 2 and 3 all ship in a single response and are switched client-side.
// That is not an optimisation; it is forced. The page state carried across those
// transitions — the userId returned by the signup 201, plus the email and
// contractorId a resend needs — exists only in memory, so a full-page reload
// strands the homeowner on a verify screen with nothing to verify.
//
// State 0 is a DIFFERENT document. It has no signup, no state machine and no
// script, because there is nothing on it to interact with.
//
// ── WHY THE CSP IS RE-APPLIED HERE INSTEAD OF WIDENED GLOBALLY ──────────────
// server/app.js calls helmet() bare. Two of its defaults are incompatible with
// this page and with nothing else in the product:
//
//   img-src 'self' data:   blocks the contractor logo, which is a Backblaze B2
//                          URL on a different origin. A white-label page that
//                          cannot load the contractor's logo is the one failure
//                          this whole arc exists to prevent.
//
//   script-src 'self'      blocks inline script, and script-src-attr 'none'
//                          blocks inline handlers. THE PAGE CANNOT BE JS-FREE:
//                          the signup form must post JSON (there is no
//                          express.urlencoded parser, so a native form submit
//                          sends every field as undefined), the six-box code
//                          input auto-advances, and the skip path must write to
//                          the clipboard inside the click handler because
//                          navigator.clipboard.writeText requires user
//                          activation.
//
// Widening the GLOBAL helmet() call would hand an external image origin and a
// script nonce to every admin, API and webhook response in the product to solve
// a problem on one public page. Re-applying contentSecurityPolicy on this router
// works because the later middleware re-sets the header for these routes only —
// server/test/landingCsp.test.js fences both halves, and its two global-CSP
// regression tests are what catch the shortcut.
//
// STYLE-SRC IS DELIBERATELY NOT TOUCHED. helmet's default already carries
// 'unsafe-inline', which is what lets the contractor's colours be injected as a
// <style> block. There is nothing to do there, and doing something would be a
// regression.
//
// ── NO INLINE HANDLERS, ANYWHERE ────────────────────────────────────────────
// script-src-attr 'none' is inherited untouched, so onclick=, oninput= and every
// sibling silently never fire. Every listener below is attached with
// addEventListener from the one nonce'd script at the end of the body.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const crypto = require('crypto');
const helmet = require('helmet');
const router = express.Router();

const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');
const { resolveLanding } = require('../utils/landingResolve');
const { resolveDefaultMarketingToken } = require('../utils/inviteTokens');
const { b2PublicOrigin } = require('../utils/b2Media');
const { escapeHtml } = require('../utils/pendingReferral');
const { BRANDING_THEME_DEFAULTS } = require('../utils/brandingTheme');

// ── PER-REQUEST NONCE ────────────────────────────────────────────────────────
// base64url, NOT base64. Two reasons, both practical: standard base64 pads with
// '=' and can contain '+' and '/', and a '=' inside a CSP source token is
// awkward to match and to read. base64url of 16 bytes is 22 unpadded chars from
// [A-Za-z0-9_-] — 128 bits of entropy, which is far past what a nonce needs.
//
// REGENERATED PER REQUEST, which is the entire point. A nonce reused across
// responses is discoverable from any single page load and would then authorise
// injected script on every subsequent one — strictly worse than 'unsafe-inline',
// because it reads as though it were safe.
router.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64url');
  next();
});

// ── SCOPED CSP ───────────────────────────────────────────────────────────────
// Built per request because the nonce is. `useDefaults: true` keeps every
// directive helmet already sets — default-src, base-uri, object-src, form-action,
// frame-ancestors, style-src — and overrides exactly three: img-src and
// script-src are widened, font-src is narrowed.
//
// The B2 origin is read from the same helper that builds the URLs actually
// written into contractor_settings.logo_url, so the policy and the data cannot
// drift apart. When it is null (unparseable base URL) the source is simply
// omitted rather than the page failing to render.
router.use((req, res, next) => {
  const origin = b2PublicOrigin();
  const imgSrc = ["'self'", 'data:'];
  if (origin) imgSrc.push(origin);

  return helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      'img-src': imgSrc,
      // No 'unsafe-inline' fallback. This page interpolates contractor-controlled
      // company name, address and logo URL into markup; handing it back
      // 'unsafe-inline' would return the entire XSS surface the escaping above
      // exists to close.
      'script-src': ["'self'", `'nonce-${res.locals.cspNonce}'`],
      // font-src IS A TIGHTENING HERE, NOT A WIDENING — and that is the opposite
      // of what it looks like. helmet's default is `'self' https: data:`, so
      // 'self' was already permitted and self-hosted faces would have loaded
      // without this line. What this line removes is `https:` and `data:`: on the
      // one public page in the product that interpolates contractor-controlled
      // strings, a remote or inline font is an exfiltration channel and a
      // third-party dependency we have no reason to keep open. Every face this
      // page uses ships from server/public/fonts.
      //
      // The global default stays as helmet set it — server/test/landingFonts.test.js
      // fences both halves, the same shape as the img-src and script-src fences.
      'font-src': ["'self'"],
    },
  })(req, res, next);
});

// ── STORE-BADGE GATE (A14) ───────────────────────────────────────────────────
// The slot is built now and filled in the Capacitor session: the official Apple
// and Google artwork is unobtainable without a published app, and the store URLs
// it would point at do not exist either.
//
// GATED ON THE FLAG ALONE. The cited precedent (TWILIO_10DLC_ACTIVE) also
// requires NODE_ENV === 'production'; copying that clause would make the slot
// untestable on every non-production boot, which A14 rules out in terms. The
// strict !== 'true' compare is copied and nothing else — it fails closed when
// the variable is unset, which is its whole value.
//
// READ PER RENDER, not captured at module load, so the flag can be flipped
// without a restart and so the gate is reachable from a test.
function storeBadgesEnabled() {
  return process.env.STORE_BADGES_ACTIVE === 'true';
}

// ── STORE DESTINATIONS (A14, LP §2 skip-path interstitial) ───────────────────
// ⚠ THESE ARE PLACEHOLDERS AND THEY POINT AT NOTHING. There are no store
// listings yet; both the official badge artwork and these two destinations
// arrive together in the Capacitor session, behind the same gate.
//
// DELIBERATELY NOT PLAUSIBLE. A play.google.com or apps.apple.com URL with an
// invented package id would be worse than an obvious placeholder: it looks real,
// so it gets tapped, screenshotted for a contractor and pasted into printed
// material, and it lands on a store 404 with our branding on the referring page.
// `.invalid` is reserved by RFC 2606 and can never resolve, so a placeholder that
// escaped the gate would fail loudly instead of quietly.
//
// The Capacitor session replaces these two constants and nothing else.
const STORE_URL_ANDROID = 'https://store-placeholder.invalid/roofmiles/android';
const STORE_URL_IOS = 'https://store-placeholder.invalid/roofmiles/ios';

// Builds the two destinations for one token, or null while the gate is closed.
//
// THE ANDROID URL CARRIES THE TOKEN ON THE INSTALL-REFERRER PARAMETER, which is
// the only channel that survives the Play Store: Play hands `referrer` to the app
// on first launch through the install-referrer receiver (DL-B's half, not built
// here). iOS has no equivalent — the App Store strips everything — which is why
// the clipboard is not a convenience on that platform but the entire mechanism.
//
// Built through URL/searchParams rather than string concatenation so that the
// real destination, which will already carry an `?id=` package parameter, gets an
// `&` where this one gets a `?`. Concatenating would produce a second `?` and a
// silently malformed URL on the day the placeholder is replaced.
function storeUrlsFor(inviteSlug) {
  if (!storeBadgesEnabled()) return null;
  const android = new URL(STORE_URL_ANDROID);
  android.searchParams.set('referrer', inviteSlug);
  return { android: android.toString(), ios: STORE_URL_IOS };
}

// ── ICONS (LP §4) ────────────────────────────────────────────────────────────
// Phosphor path data, regular weight, lifted verbatim from
// @phosphor-icons/react's own definitions so these ARE the specified icons.
//
// INLINED RATHER THAN IMPORTED, and that is not a preference. The installed
// package is `@phosphor-icons/react` — React components, and there is no React
// on a server-rendered document. Inlining also costs no extra request on a
// first-touch page, where a sprite fetch would be a round trip before the
// contractor's own branding finished painting.
const ICON_PATHS = {
  envelope: 'M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z',
  phone: 'M222.37,158.46l-47.11-21.11-.13-.06a16,16,0,0,0-15.17,1.4,8.12,8.12,0,0,0-.75.56L134.87,160c-15.42-7.49-31.34-23.29-38.83-38.51l20.78-24.71c.2-.25.39-.5.57-.77a16,16,0,0,0,1.32-15.06l0-.12L97.54,33.64a16,16,0,0,0-16.62-9.52A56.26,56.26,0,0,0,32,80c0,79.4,64.6,144,144,144a56.26,56.26,0,0,0,55.88-48.92A16,16,0,0,0,222.37,158.46ZM176,208A128.14,128.14,0,0,1,48,80,40.2,40.2,0,0,1,82.87,40a.61.61,0,0,0,0,.12l21,47L83.2,111.86a6.13,6.13,0,0,0-.57.77,16,16,0,0,0-1,15.7c9.06,18.53,27.73,37.06,46.46,46.11a16,16,0,0,0,15.75-1.14,8.44,8.44,0,0,0,.74-.56L168.89,152l47,21.05h0s.08,0,.11,0A40.21,40.21,0,0,1,176,208Z',
  mapPin: 'M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z',
  // ── SOCIAL GLYPHS (BR-2 Phase 2, A32(b)) ─────────────────────────────────
  // Lifted from the INSTALLED @phosphor-icons/react package's regular weight —
  // the same source the React side renders, so the two surfaces cannot drift to
  // different artwork. No new dependency, and no hand-drawn paths.
  // ⚠ NEXTDOOR HAS NO PHOSPHOR GLYPH. `house` is the stand-in this codebase had
  // ALREADY chosen — the admin editor labels that field with ph-house-line — so
  // reusing it keeps one answer rather than inventing a second. It is a generic
  // house, so the accessible name carries the word Nextdoor and the icon is
  // never asked to say it alone.
  facebook: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm8,191.63V152h24a8,8,0,0,0,0-16H136V112a16,16,0,0,1,16-16h16a8,8,0,0,0,0-16H152a32,32,0,0,0-32,32v24H96a8,8,0,0,0,0,16h24v63.63a88,88,0,1,1,16,0Z',
  instagram: 'M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160ZM176,24H80A56.06,56.06,0,0,0,24,80v96a56.06,56.06,0,0,0,56,56h96a56.06,56.06,0,0,0,56-56V80A56.06,56.06,0,0,0,176,24Zm40,152a40,40,0,0,1-40,40H80a40,40,0,0,1-40-40V80A40,40,0,0,1,80,40h96a40,40,0,0,1,40,40ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z',
  google: 'M224,128a96,96,0,1,1-21.95-61.09,8,8,0,1,1-12.33,10.18A80,80,0,1,0,207.6,136H128a8,8,0,0,1,0-16h88A8,8,0,0,1,224,128Z',
  house: 'M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z',
  check: 'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z',
  globe: 'M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z',
};

// Renders one icon. aria-hidden throughout: every icon on this page sits beside
// the text it decorates, so announcing it would repeat that text to a screen
// reader rather than add to it.
// Which ICON_PATHS entry each social key draws. Keyed on the resolver's own
// `key` values so a new social added there fails loudly here (falling through to
// the globe) rather than silently rendering nothing.
const SOCIAL_ICON = {
  facebook: 'facebook', instagram: 'instagram', google: 'google',
  nextdoor: 'house',    website: 'globe',
};

function icon(name, cls, size) {
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false"><path d="${ICON_PATHS[name]}"></path></svg>`;
}

// ── LOGO URL SAFETY ──────────────────────────────────────────────────────────
// Returns the URL only when it is https, else null.
//
// escapeHtml is NOT sufficient here and this is not defence in depth — it is a
// different control for a different hole. Escaping stops an attribute breakout;
// nothing in `javascript:alert(1)` needs escaping, so an escaped hostile scheme
// lands in src= perfectly intact. contractor_settings.logo_url is an
// unconstrained TEXT column, so the scheme has to be checked separately.
//
// PLAIN http IS ALSO REFUSED, and not only for that reason: a TLS page pulling
// its logo over http is mixed content, which browsers block outright — so the
// contractor's brand silently vanishes from the one surface it exists for.
//
// A refused URL falls through to the no-logo path, which renders the company
// NAME as styled text. It never falls back to the RoofMiles mark: the homeowner
// scanned a sign in a yard and the header has to say whose yard it was.
function safeLogoUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Not an absolute URL at all — a relative path, a bare hostname, or noise.
    return null;
  }
  // The ORIGINAL string is returned rather than parsed.href, which normalises
  // (a bare origin gains a trailing slash) and would no longer match the value
  // the upload pipeline wrote.
  return parsed.protocol === 'https:' ? trimmed : null;
}

// ── WEBSITE URL SAFETY ───────────────────────────────────────────────────────
// Returns { href, label } for a linkable contractor website, else null.
//
// A SIBLING OF safeLogoUrl RATHER THAN A WIDENING OF IT, and the split is the
// point. safeLogoUrl calls new URL() with no scheme handling, so a BARE DOMAIN
// throws and is refused — correct there, because for an img src a bare hostname
// is a broken relative path. Here the bare domain is the NORMAL case:
// contractor_settings.company_url is what the admin Company Details "Website
// URL" field writes, its placeholder asks for 'accentroofingservice.com', and
// nothing between that field and the column normalises anything. Relaxing the
// logo guard to accept it would weaken the guard on an unconstrained TEXT column
// to fix a different problem.
//
// THE SCHEME IS PREPENDED ONLY WHEN THERE IS NONE, which is what keeps a hostile
// scheme from being laundered into an https one. The two hostile shapes take
// different paths to the same answer, and both are deliberate:
//   javascript:alert(1)            no '://', so the prepend fires and
//                                  new URL('https://javascript:alert(1)') throws
//                                  on the invalid port — refused by the PARSE.
//   javascript://host/%0aalert(1)  has '://', so nothing is prepended, it parses
//                                  as protocol javascript: — refused by the
//                                  PROTOCOL CHECK.
//
// PLAIN http IS REFUSED for the reason safeLogoUrl states: a TLS page reaching
// out over http is the same mixed-content posture, and two sibling guards on the
// same page should not disagree about which schemes are acceptable.
//
// A HOSTNAME NEEDS A DOT. 'https://localhost' and 'https://foo' parse perfectly
// well, so the parse cannot catch them; a single-label host on a homeowner-facing
// page is a typo or an internal address, never the roofer's website.
//
// LABEL IS THE ORIGINAL, HREF IS THE NORMALISED FORM — the same distinction
// safeLogoUrl makes when it returns the original string instead of parsed.href.
// new URL() adds a trailing slash to a bare origin, so a page rendering the href
// as its own link text would show 'https://accentroofingservice.com/' to someone
// whose roofer's sign says 'accentroofingservice.com'.
function safeWebsiteUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    // Not parseable even with a scheme — free text, or a hostile scheme whose
    // remainder is not a valid host and port.
    return null;
  }

  if (parsed.protocol !== 'https:') return null;
  if (!parsed.hostname.includes('.')) return null;

  return { href: parsed.href, label: trimmed };
}

// ── THEME ────────────────────────────────────────────────────────────────────
// Every value is either a validated six-digit hex — the shared resolver refuses
// anything else, so no attacker-influenced string can reach a style context — or
// one of the frozen RoofMiles defaults.
//
// ALWAYS EMITTED, including on the neutral State 0 where there is no contractor
// at all. A page with no theme block paints against the browser's defaults, which
// on a public marketing surface reads as broken rather than as neutral.
function themeStyle(theme) {
  return [
    ':root{',
    // ⚠ ROUTED BY B-1 (2026-09-01), AND THE ASSIGNMENT LOOKS CROSSED ON PURPOSE.
    // This page does not use the render tokens; it emits its own --brand-*
    // variables straight from the resolver. Read the stylesheet below for what
    // each one paints: --brand-primary is `.submit`, `.step-num`, links and the
    // focus ring — the CALL TO ACTION, which after the ruling is stored in
    // secondary_color. --brand-secondary is `body{color:...}` — the BODY TEXT,
    // which is the dark neutral, stored in primary_color.
    // ⚠ SWAPPING ONLY THE APP'S DERIVATIONS WOULD HAVE LEFT THIS PAGE INVERTED,
    // and it is the public homeowner-facing surface — navy buttons and red body
    // text, where strangers see it. The variable NAMES are unchanged so the whole
    // stylesheet below is untouched.
    `--brand-primary:${theme.secondaryColor};`,
    `--brand-secondary:${theme.primaryColor};`,
    `--brand-accent:${theme.accentColor};`,
    `--brand-bg:${theme.backgroundColor};`,
    '}',
  ].join('');
}

// The RoofMiles token set, used when nothing resolved. Spread into a plain object
// because BRANDING_THEME_DEFAULTS is frozen and callers read optional keys
// (logoUrl, phone, programName) that it does not carry.
// isPlatform IS THE ONLY HONEST MARKER, and it has to live on the object rather
// than be inferred from a value. The tempting shortcut — companyName ===
// 'RoofMiles' — is wrong: a REAL contractor resolves to that name as the
// resolver's last resort when neither contractor_settings.company_name nor
// contractors.name yields anything, and landingStates.test.js:1216 requires that
// contractor's header to stay styled TEXT. A name comparison would hand them the
// platform's mark. Set here and nowhere else — adding it to
// BRANDING_THEME_DEFAULTS or to resolveBrandingTheme would break
// brandingTheme.test.js's whole-output deepEqual and key-set assertions, and
// would force a paired edit to the src/ mirror.
function neutralTheme() {
  return { ...BRANDING_THEME_DEFAULTS, programName: null, logoUrl: null, phone: null, email: null, isPlatform: true };
}

// ── STYLES ───────────────────────────────────────────────────────────────────
// Inline, per CLAUDE.md: no CSS files anywhere in this product.
//
// ── SELF-HOSTED WEBFONTS ────────────────────────────────────────────────────
// LP names Montserrat (display) and Roboto (body). Both are served from
// server/public/fonts rather than from Google, for three reasons: an external
// request on the product's most important first paint, a third-party dependency
// on a page that must work on a bad mobile connection in a driveway, and
// `font-src 'self'` above, which is a deliberate tightening of helmet's default.
//
// woff2 ONLY. Every browser that can run this page supports it, and the older
// formats would double the payload to serve engines that no longer ship.
//
// THEY ARE VARIABLE FONTS, which is not a preference either — Google no longer
// publishes static instances of either family (v31/v51 are variable-only), so
// `font-weight: 100 900` is what the file actually contains. One file per family
// covers every weight the page uses and is smaller than the three static Roboto
// cuts it replaces.
//
// LATIN SUBSET ONLY. That covers U+0000-00FF, so é ñ ü ç ø å all render. A
// company name carrying a latin-EXT glyph — ł, ő, ș — falls back to the system
// font for THAT CHARACTER ONLY; the rest of the name still renders in Montserrat.
// Adding the ext subset is two more @font-face blocks and about 22 KB; it is
// deliberately not paid for on a first-touch mobile page until a contractor needs
// it.
//
// font-display: swap on both, so text paints immediately in the fallback face and
// re-renders when the webfont arrives. The alternative — blocking — is a blank
// headline on the one screen that has to earn a stranger's trust in two seconds.
//
// The stacks below keep naming both faces first and fall back to the SYSTEM UI
// font, never to a serif default: a face that fails to load must degrade to
// something chosen, not to Times New Roman.
//
// ANIMATION IS CSS (A15). framer-motion is not installed and will not be added;
// the visual intent — a rising entrance, a checkmark celebration with confetti in
// the brand colours — is unchanged, and prefers-reduced-motion turns all of it
// off rather than merely shortening it.
const FONT_FACE_CSS = `
@font-face{font-family:'Montserrat';font-style:normal;font-weight:100 900;font-display:swap;
  src:url('/static/fonts/montserrat-latin.woff2') format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}
@font-face{font-family:'Roboto';font-style:normal;font-weight:100 900;font-display:swap;
  src:url('/static/fonts/roboto-latin.woff2') format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}
`;

const PAGE_CSS = FONT_FACE_CSS + `
*,*::before,*::after{box-sizing:border-box;}
body{margin:0;background:var(--brand-bg);color:var(--brand-secondary);
  font-family:'Roboto',ui-sans-serif,system-ui,'Segoe UI',Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;line-height:1.5;}
.wrap{max-width:430px;margin:0 auto;
  padding:calc(28px + env(safe-area-inset-top)) 20px calc(32px + env(safe-area-inset-bottom));}
h1,h2,h3{font-family:'Montserrat',ui-sans-serif,system-ui,'Segoe UI',Helvetica,Arial,sans-serif;
  font-weight:700;margin:0;letter-spacing:-0.01em;}
h1{font-size:26px;line-height:1.25;}
p{margin:0;}
.brand{text-align:center;margin-bottom:18px;}
.brand-logo{max-width:180px;max-height:72px;height:auto;display:block;margin:0 auto;}
/* PLATFORM ONLY. A modifier, never a change to .brand-logo itself: that class is
   worn by every contractor logo, so widening it would resize every white-label
   header to suit the platform's own artwork. Overrides the two size caps and
   nothing else - display, height and centring are inherited. The mark is 400x120,
   so at 220px wide it draws about 66px tall, undistorted and inside the cap. */
.brand-logo--platform{max-width:220px;max-height:88px;}
.brand-name{font-family:'Montserrat',ui-sans-serif,system-ui,'Segoe UI',Helvetica,Arial,sans-serif;
  font-size:21px;font-weight:700;color:var(--brand-primary);letter-spacing:-0.01em;}
.chip{display:inline-block;margin-top:12px;padding:7px 15px;border-radius:999px;
  background:var(--brand-accent);color:var(--brand-secondary);font-size:14px;font-weight:500;}
.hero{text-align:center;margin-bottom:26px;}
.hero p{margin-top:10px;font-size:16px;opacity:.78;}
/* The neutral State 0's one onward door. Understated on purpose: a visitor who
   landed here wanted a contractor, and this is an explanation of what the
   platform is, not a competing call to action.
   ⚠ THE PLATFORM'S NAME IS DELIBERATELY NOT WRITTEN IN THIS COMMENT. PAGE_CSS is
   served inside the document head, and landingStates.test.js's no-logo fence
   slices its header region from byte 0 - so that word appearing anywhere in the
   stylesheet reads to it as the platform mark standing in for a contractor's.
   It caught exactly that when this rule was added. */
.hero-secondary{margin-top:16px;font-size:14px;}
.hero-secondary a{color:var(--brand-primary);font-weight:600;text-decoration:underline;
  text-underline-offset:3px;}
/* STATE 0 ONLY - the footer's contact rows promoted to the top of the page.
   A dead link is the one screen where reaching a human IS the task, and a footer
   is where a homeowner stops looking, so the same rows are drawn beside the
   message instead. Inherits .contact's grid, gap and centring and overrides only
   the three properties that make a footnote read as an action: size, weight and
   colour. The footer's own rows are suppressed on this page, so nothing is
   duplicated. (No backticks in this comment - PAGE_CSS is a template literal.) */
.contact--top{font-size:15px;margin:0 0 26px;}
.contact--top a{opacity:1;font-weight:600;color:var(--brand-primary);}
.steps{list-style:none;margin:0 0 26px;padding:0;display:grid;gap:16px;}
.step{display:flex;gap:14px;align-items:flex-start;}
.step-num{flex:0 0 32px;height:32px;border-radius:999px;background:var(--brand-primary);color:#fff;
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;
  font-family:'Montserrat',ui-sans-serif,system-ui,sans-serif;}
.step h3{font-size:15px;}
.step p{font-size:14px;opacity:.72;margin-top:2px;}
.card{background:#fff;border-radius:16px;padding:22px 18px;
  box-shadow:0 1px 2px rgba(16,24,40,.05),0 8px 26px rgba(16,24,40,.08);}
.card h2{font-size:18px;margin-bottom:16px;}
.field{margin-bottom:13px;}
.field label{display:block;font-size:13px;font-weight:600;margin-bottom:5px;opacity:.85;}
.field input{width:100%;padding:12px 13px;border:1px solid #d8dee7;border-radius:10px;
  font-size:16px;font-family:inherit;color:inherit;background:#fff;
  transition:border-color .16s ease,box-shadow .16s ease;}
.field input:focus{outline:0;border-color:var(--brand-primary);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--brand-primary) 22%,transparent);}
.row{display:flex;gap:11px;}
.row .field{flex:1;}
.hint{font-size:12px;opacity:.6;margin-top:5px;}
.btn{width:100%;padding:14px 16px;border:0;border-radius:11px;font-size:16px;font-weight:700;
  font-family:'Montserrat',ui-sans-serif,system-ui,sans-serif;color:#fff;
  background:var(--brand-primary);cursor:pointer;
  transition:transform .12s ease,opacity .16s ease;}
.btn:active{transform:scale(.985);}
.btn[disabled]{background:#c9d0da;color:#f4f6f9;cursor:default;}
.btn[disabled]:active{transform:none;}
.err{margin-top:11px;font-size:13.5px;color:#b3261e;display:none;}
.err.is-shown{display:block;}
.skip{margin-top:22px;text-align:center;}
.skip-link{background:none;border:0;padding:0;font:inherit;font-weight:600;font-size:15px;
  color:var(--brand-secondary);text-decoration:underline;text-underline-offset:3px;cursor:pointer;}
.skip p{margin-top:7px;font-size:12.5px;opacity:.62;}
/* The interstitial confirmation. Ships in the document and is revealed on click:
   the copy is LP-locked, and locked copy belongs in the markup alongside every
   other locked string on this page rather than in a JavaScript literal.
   ⚠ Note for anyone reading the skip tests: the confirmation's presence in the
   SERVED BYTES proves nothing about whether the button worked. It is in the
   document either way — and moving it into the script does not change that,
   because a JS string literal is served bytes too. Only the class mutation is
   evidence of the click. See the RED-report note on landingSkipPath's desktop
   assertion, which short-circuits on the wrong half of its or-expression.
   (No backticks in this comment: PAGE_CSS is a template literal, and a stray
   backtick here closes it and silently truncates the stylesheet.) */
.skip-note{display:none;margin-top:9px;font-size:13px;font-weight:600;
  color:var(--brand-primary);opacity:1;}
.skip-note.is-shown{display:block;}
.verify-icon{color:var(--brand-primary);display:block;margin:0 auto 12px;}
.code{display:flex;gap:8px;justify-content:center;margin:18px 0 4px;}
/* Roboto with tabular figures rather than Roboto Mono. CLAUDE.md's brand tokens
   name Roboto Mono for numbers, and this page deliberately does not ship it: the
   boxes hold ONE centred digit each at a fixed width, so a monospaced face buys
   no alignment here, and a third family is ~15 KB more on a first-touch mobile
   page. tabular-nums keeps the digits identically wide within the face we already
   load. Flagged as a deviation rather than made quietly. */
.code input{width:100%;aspect-ratio:1/1.15;min-width:0;text-align:center;font-size:22px;font-weight:700;
  font-family:'Roboto',ui-sans-serif,system-ui,'Segoe UI',Helvetica,Arial,sans-serif;
  font-variant-numeric:tabular-nums;
  border:1px solid #d8dee7;border-radius:10px;background:#fff;color:inherit;padding:0;}
.code input:focus{outline:0;border-color:var(--brand-primary);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--brand-primary) 22%,transparent);}
.verify-actions{display:flex;justify-content:space-between;align-items:center;margin-top:16px;}
.linkbtn{background:none;border:0;padding:0;font:inherit;font-size:14px;font-weight:600;
  color:var(--brand-secondary);opacity:.8;cursor:pointer;}
.linkbtn[disabled]{opacity:.45;cursor:default;}
.resend-note{display:none;margin-top:9px;font-size:13px;color:var(--brand-primary);font-weight:600;}
.resend-note.is-shown{display:block;}
.celebrate{position:relative;display:flex;align-items:center;justify-content:center;
  width:96px;height:96px;margin:4px auto 18px;}
.ring{position:absolute;inset:0;border-radius:999px;background:var(--brand-accent);}
.tick{position:relative;color:var(--brand-primary);}
.confetti{position:absolute;inset:-26px;pointer-events:none;}
.confetti i{position:absolute;top:50%;left:50%;width:7px;height:11px;border-radius:2px;display:block;}
.badges{display:grid;gap:11px;margin-top:20px;}
/* The gated slot collapses completely while empty (A14) rather than leaving a
   band of dead space above the sign-in line. */
.badges:empty{margin:0;}
.store-badge{display:flex;align-items:center;justify-content:center;height:52px;border-radius:9px;
  background:#000;color:#fff;font-size:14px;font-weight:600;letter-spacing:.01em;}
.foot{margin-top:34px;text-align:center;font-size:13px;}
.contact{display:grid;gap:8px;justify-content:center;margin-bottom:16px;}
/* The social row (A32(b)). Sits between the contact rows and the divider, so
   an absent row collapses its own gap rather than leaving a hole above the
   rule. Icons inherit currentColor from .foot, matching the contact icons. */
.socials{display:flex;justify-content:center;gap:18px;margin-bottom:16px;}
.socials a{display:inline-flex;opacity:.72;transition:opacity .16s ease;}
.socials a:hover{opacity:1;}
.contact a,.contact span{display:flex;align-items:center;gap:7px;justify-content:center;
  color:inherit;text-decoration:none;opacity:.78;}
.divider{height:1px;background:currentColor;opacity:.12;margin:0 auto 15px;max-width:180px;}
.powered b{color:#F26A1B;}
.legal{margin-top:9px;opacity:.6;}
.legal a{color:inherit;}
.state{display:none;}
.state.is-active{display:block;animation:rise .38s cubic-bezier(.16,1,.3,1) both;}
.stagger>*{animation:rise .42s cubic-bezier(.16,1,.3,1) both;}
.stagger>*:nth-child(1){animation-delay:.04s;}
.stagger>*:nth-child(2){animation-delay:.10s;}
.stagger>*:nth-child(3){animation-delay:.16s;}
.stagger>*:nth-child(4){animation-delay:.22s;}
@keyframes rise{from{opacity:0;transform:translateY(9px);}to{opacity:1;transform:translateY(0);}}
@keyframes ringpop{from{opacity:0;transform:scale(.55);}to{opacity:1;transform:scale(1);}}
@keyframes tickpop{from{opacity:0;transform:scale(.4) rotate(-12deg);}to{opacity:1;transform:scale(1) rotate(0);}}
@keyframes confetti{
  0%{opacity:0;transform:translate(-50%,-50%) rotate(0) scale(.6);}
  18%{opacity:1;}
  100%{opacity:0;transform:translate(var(--cx),var(--cy)) rotate(var(--cr)) scale(1);}}
.state-3.is-active .ring{animation:ringpop .52s cubic-bezier(.34,1.56,.64,1) both;}
.state-3.is-active .tick{animation:tickpop .46s cubic-bezier(.34,1.56,.64,1) .22s both;}
.state-3.is-active .confetti i{animation:confetti 1.1s cubic-bezier(.22,.68,.36,1) .18s both;}
/* ── DESKTOP VERTICAL CENTERING ──────────────────────────────────────────────
   The sparse states — State 0, the verify card, the success card, the desktop
   skip view — are short. On a desktop viewport they sat at the top of a 430px
   column with a tall band of --brand-bg below them, which reads as a page that
   failed to finish loading rather than as a deliberate layout.

   AUTO MARGINS, NOT align-items:center AND NOT justify-content:center. The flex
   centering keywords stop being safe the moment the item is TALLER than the
   container: they distribute the overflow to both sides, so the top of a long
   signup form ends up above the scroll origin and cannot be scrolled back to.
   An auto margin absorbs only POSITIVE free space and collapses to zero when
   there is none, so tall content falls back to exactly today's top-aligned,
   fully scrollable behaviour.

   flex-direction:column IS LOAD-BEARING, not tidiness. In the default row
   direction .wrap becomes a flex item sized to its CONTENT rather than to the
   container, so a state whose longest line happened to be under 430px would
   render in a narrower column on desktop than on mobile — a silent width
   regression driven by copy. In column direction the cross axis stretches it,
   max-width:430px caps it, and the base margin:0 auto still does the horizontal
   centering.

   MOBILE IS UNTOUCHED. Below 700px this block never applies, and the base body
   and .wrap rules are unchanged. 100vh is also a desktop-only value here, which
   sidesteps the mobile URL-bar viewport problem entirely.

   No backticks anywhere in this comment: PAGE_CSS is a template literal, and a
   stray backtick closes it and silently truncates every rule that follows. */
@media (min-width: 700px){
  body{min-height:100vh;display:flex;flex-direction:column;}
  .wrap{margin-top:auto;margin-bottom:auto;}
}
@media (prefers-reduced-motion:reduce){
  .state.is-active,.stagger>*,.state-3.is-active .ring,.state-3.is-active .tick,
  .state-3.is-active .confetti i{animation:none;opacity:1;transform:none;}
  .confetti{display:none;}
}
`;

// ── FOOTER ───────────────────────────────────────────────────────────────────
// LP §2: contact card · divider · "Powered by RoofMiles" · Privacy · Terms.
//
// THE ROOFMILES MARK IS HARDCODED #F26A1B IN EVERY THEME. LP calls this out as a
// deliberate exception, and the natural-looking mistake — painting it with
// var(--brand-primary) — would render the platform's mark in the contractor's
// colour on every white-labeled page.
//
// EACH CONTACT ROW IS DRAWN BY THE KEY'S PRESENCE (LP-1). The resolver OMITS
// `address` rather than nulling it when company_address is unset, so a row that
// tested for a value instead would print an empty line, or the literal word
// "null", at a homeowner.
//
// ⚠ PRIVACY AND TERMS POINT AT PLACEHOLDERS, DELIBERATELY. LP §2 requires the
// links; the destinations do not exist. The repo's current legal pages also name
// Accent Roofing as the operating entity, which on a white-labeled page served
// for a different contractor would be wrong in a way that is a content and legal
// decision rather than a build one. Inventing URLs here would bury that.
// Whoever writes the platform legal pages replaces these two href values.
//
// ── contactRows: THE STATE 0 SUPPRESSION, AND WHY IT IS A PARAMETER ─────────
// State 0 draws its own contact block at the TOP of the page, so a footer card
// beneath it would print the same phone number twice on one short document —
// which reads as a rendering fault rather than as emphasis.
//
// A PARAMETER RATHER THAN A CHANGE TO THIS FUNCTION'S BEHAVIOUR. The rule is
// State 0's, not the footer's: States 1-3 share this same function
// (renderLandingPage) and their contact card is required by LP §2 and fenced by
// landingStates.test.js:793. Moving the suppression one level up — into the rows
// themselves, or into the resolver — would strip the card off every signup page
// in the product. DEFAULTS TO TRUE so every existing caller is unchanged and the
// opt-out has to be asked for explicitly.
//
// ADDRESS IS NOT RELOCATED. State 0's block carries phone, website and email —
// the three rows a homeowner can ACT on from a phone. A street address is a
// destination, not a contact method, and on a dead-link page it is the one line
// that cannot help; it stays on States 1-3 and is simply absent here.
function renderFooter(theme, { contactRows = true } = {}) {
  const rows = [];
  if (contactRows && theme.phone) {
    rows.push(`<a href="tel:${escapeHtml(theme.phone)}">${icon('phone', 'ico', 15)}${escapeHtml(theme.phone)}</a>`);
  }
  if (contactRows && theme.email) {
    rows.push(`<a href="mailto:${escapeHtml(theme.email)}">${icon('envelope', 'ico', 15)}${escapeHtml(theme.email)}</a>`);
  }
  if (contactRows && theme.address) {
    rows.push(`<span>${icon('mapPin', 'ico', 15)}${escapeHtml(theme.address)}</span>`);
  }

  // ── SOCIAL ROW (BR-2 Phase 2, A32(b)) ──────────────────────────────────────
  // ⚠ THE PREDICATE IS NOT RESTATED HERE. `theme.socials` is the collector the
  // branding resolver gained in BR-2 Phase 1: it treats empty string, null and
  // whitespace alike and OMITS the key entirely when nothing is set. So "which
  // links are populated" has one answer across this page, the About Us popup and
  // the campaign email footer, and a second copy cannot drift from the first.
  //
  // ⚠ GATED ON THE KEY'S PRESENCE, not on a length check — the same LP-1 form
  // the contact rows above use. With nothing set the container, its links and
  // its spacing are all absent rather than an empty div with a divider over it.
  //
  // safeWebsiteUrl RATHER THAN A TRUTHINESS CHECK, for the reason its own header
  // gives: these are unconstrained VARCHAR(500) columns an admin pasted into, so
  // a value that cannot become a safe https link must draw NO icon rather than a
  // broken one. escapeHtml alone is not sufficient — nothing in `javascript:`
  // needs escaping, so an escaped hostile scheme lands in href intact.
  const socialLinks = (theme.socials || [])
    // ⚠ safeWebsiteUrl RETURNS AN OBJECT `{href, label}`, NOT A STRING — the
    // href is normalised while the label stays as typed. Taking the return
    // value directly renders `href=""`, which is a link to the current page
    // rather than a visible failure.
    .map(s => ({ ...s, href: safeWebsiteUrl(s.url)?.href || null }))
    .filter(s => s.href)
    .map(s => `<a href="${escapeHtml(s.href)}" target="_blank" rel="noopener noreferrer" ` +
               `aria-label="${escapeHtml(theme.companyName)} on ${escapeHtml(s.label)}">` +
               `${icon(SOCIAL_ICON[s.key] || 'globe', 'ico', 18)}</a>`)
    .join('');

  return `<footer class="foot">
  ${rows.length ? `<div class="contact">${rows.join('')}</div>` : ''}
  ${socialLinks ? `<div class="socials">${socialLinks}</div>` : ''}
  <div class="divider"></div>
  <p class="powered">Powered by <b>RoofMiles</b></p>
  <p class="legal"><a href="#privacy">Privacy</a> &middot; <a href="#terms">Terms</a></p>
</footer>`;
}

// ── STATE 0 CONTACT BLOCK ────────────────────────────────────────────────────
// The contractor's phone, website and email, rendered UP TOP beside the message
// rather than in the footer. State 0 is the one page where reaching a human IS
// the task: the visitor came for this company, the link they were handed does
// not work, and the only useful thing this document can do is put a working
// route to that company in front of them before they close the tab.
//
// ROW ORDER IS PHONE, WEBSITE, EMAIL — fastest to slowest. A homeowner standing
// in a driveway taps the number; the website is where they go if they would
// rather look before they speak; email is the one that answers tomorrow.
//
// EACH ROW IS DRAWN BY ITS DATA RESOLVING, never structurally. The same
// presence rule the footer applies (LP-1), for the same reason: a row drawn from
// an unset column prints an empty line, or the literal word "null", at a
// homeowner. WEBSITE resolves through safeWebsiteUrl rather than through a
// truthiness check, so a stored value that cannot become a safe https link draws
// no row at all rather than a broken one — company_url is an unconstrained
// VARCHAR(500) and both bare domains and full URLs are real stored values.
//
// href IS NORMALISED, THE LABEL IS NOT. safeWebsiteUrl returns parsed.href for
// the link and the original string for the text, so a homeowner whose roofer's
// sign says 'accentroofingservice.com' reads exactly that rather than
// 'https://accentroofingservice.com/'.
//
// RETURNS AN EMPTY STRING WHEN NOTHING RESOLVES, and the container goes with it.
// An empty bordered block on the page of the one contractor who has given a
// visitor no way to reach them reads as a broken render, not as an absence.
//
// data-contact-block IS A TEST HOOK AND IS LOAD-BEARING AS ONE. Proving the
// block is ABSENT is not possible from the markup without a stable marker —
// the same problem A14's empty store-badge slot has, solved the same way.
// server/test/landingContactBlock.test.js asserts on this exact attribute.
function renderContactBlock(theme) {
  const rows = [];

  if (theme.phone) {
    rows.push(`<a href="tel:${escapeHtml(theme.phone)}">${icon('phone', 'ico', 15)}${escapeHtml(theme.phone)}</a>`);
  }

  const site = safeWebsiteUrl(theme.website);
  if (site) {
    rows.push(`<a href="${escapeHtml(site.href)}">${icon('globe', 'ico', 15)}${escapeHtml(site.label)}</a>`);
  }

  if (theme.email) {
    rows.push(`<a href="mailto:${escapeHtml(theme.email)}">${icon('envelope', 'ico', 15)}${escapeHtml(theme.email)}</a>`);
  }

  if (!rows.length) return '';
  return `<div class="contact contact--top" data-contact-block>${rows.join('')}</div>`;
}

// ── BRAND MARK ───────────────────────────────────────────────────────────────
// The contractor's logo, or their NAME as styled text when there is no usable
// logo. There is deliberately no default logo — a placeholder borrowed from
// another contractor is a white-label breach, not a fallback — and the name is
// what stands in, never the RoofMiles mark.
//
// `RoofMiles` reaches this slot only as the resolver's last resort, when neither
// contractor_settings.company_name nor contractors.name yields anything usable.
function renderBrandMark(theme) {
  const name = escapeHtml(theme.companyName);

  // THE PLATFORM'S OWN MARK, and the one place a logo is correct without a
  // contractor behind it. Reachable only from neutralTheme(), which is the sole
  // setter of isPlatform — a contractor theme can never carry it.
  //
  // The src DELIBERATELY DOES NOT GO THROUGH safeLogoUrl. That guard validates
  // contractor-supplied URLs out of an unconstrained TEXT column and must stay
  // https-only; a same-origin relative path is exactly what it is built to
  // refuse. This src is a literal in the template with no data reaching it, so
  // there is nothing to validate. Served from server/public via the /static mount
  // (server/app.js), which img-src 'self' already permits.
  if (theme.isPlatform) {
    return `<img class="brand-logo brand-logo--platform" src="/static/roofmiles-logo.png" alt="${name}">`;
  }

  const logo = safeLogoUrl(theme.logoUrl);
  return logo
    ? `<img class="brand-logo" src="${escapeHtml(logo)}" alt="${name}">`
    : `<div class="brand-name">${name}</div>`;
}

// Wraps a document. Shared by State 0 and States 1-3 so the theme block, the
// viewport and the stylesheet cannot drift between them.
function renderDocument({ theme, title, body }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>${themeStyle(theme)}${PAGE_CSS}</style>
</head><body>
<div class="wrap">
${body}
</div>
</body></html>`;
}

// ── STATE 0 — INVALID ────────────────────────────────────────────────────────
// A 200, never a 404: LP §2 State 0 is a PAGE. A homeowner holding a dead link
// should see a branded explanation and a way to reach the contractor, not a
// browser error. The distinction lives in the body, not the status code.
//
// TWO VARIANTS, and they are two different conversations rather than one
// sentence apart. The resolver decides which; see buildInvalidPayload in
// landingResolve.js.
//
// ── AMENDMENT A21 — THE COPY BELOW REPLACES LP §2 STATE 0's ────────────────
// LP §2 marks its copy final and requires an amendment to change it. A21 is that
// amendment, written into LANDING_PAGE_SPEC.md §2 in place and mirrored in
// DECISION_C_DL_BUILD_SPEC.md §14. The retired strings were:
//
//   "This link isn't active"
//   "This referral link isn't valid or may have expired. If someone sent it to
//    you, ask them for a fresh link — or contact {Company Name} directly."
//
// What was wrong with them is not tone. The headline states the platform's
// problem, not the visitor's, and the body asks a homeowner to relay a technical
// failure to whoever texted them. Neither tells them the one thing they need,
// which is where a WORKING link comes from.
//
// BRANDED names the company twice and asks for nothing technical: the visitor
// already trusts this roofer — they scanned their sign — so the page tells them
// which two places a link arrives from and that asking for a fresh one is normal.
// The contact block above it is the other half of that sentence.
//
// NEUTRAL cannot name anyone. A mismatch or an unrecognised subdomain means
// trusting neither source (C/DL-2 Phase 2a), so the page explains the MECHANISM
// instead — what a RoofMiles referral link is and who sends one — because a
// stranger who mistyped a subdomain has never heard of this platform and "ask
// them for a fresh link" is meaningless when there is no "them" on the page.
//
// THE roofmiles.com LINK IS NEUTRAL-ONLY, and that is a white-label rule rather
// than a layout one. On a branded page it would invite a homeowner who came for
// their roofer to leave for a company they have no relationship with. The
// "Powered by RoofMiles" mark in the footer stays on both: attribution is not an
// exit.
function renderInvalidPage(payload) {
  const branded = Boolean(payload.contractor);
  const theme = branded ? payload.contractor : neutralTheme();
  const company = escapeHtml(theme.companyName);

  const hero = branded
    ? `<h1>Let's get you the right link</h1>
    <p>To join ${company}'s referral program, use the link a neighbor or ${company} sent you. If it's expired, just ask them for a fresh one.</p>`
    : `<h1>You'll need a referral link</h1>
    <p>RoofMiles referral links come from a contractor or a neighbor who referred you. Check your texts or email for the link they sent — that link is what connects you to the right company.</p>
    <p class="hero-secondary"><a href="https://roofmiles.com">Learn more about RoofMiles</a></p>`;

  // NEUTRAL RENDERS NO CONTACT BLOCK, and the gate is explicit rather than left
  // to fall out of the theme being empty. neutralTheme() carries no phone, email
  // or website today, so this reads as belt-and-braces — but the value it
  // protects is the mismatch rule: a page that ever grew a contact row from a
  // half-trusted source would be confirming to a prober that that source
  // resolves. The rule belongs where the decision is, not in the shape of a
  // default object someone may later extend.
  const contact = branded ? renderContactBlock(theme) : '';

  // .stagger's delay ladder is defined for nth-child(1) through (4). The block
  // is a fourth child only when it renders and the footer follows it — brand,
  // hero, contact, footer — so every child on both variants still lands on a
  // defined rung. A fifth would animate with no delay and arrive ahead of the
  // one above it.
  const body = `<div class="stagger">
  <div class="brand">${renderBrandMark(theme)}</div>
  <div class="hero">
    ${hero}
  </div>
  ${contact}
  ${renderFooter(theme, { contactRows: false })}
</div>`;

  return renderDocument({ theme, title: theme.companyName, body });
}

// ── BRAND HEADER ─────────────────────────────────────────────────────────────
// The brand header, rendered ONCE ABOVE the three states rather than inside
// State 1. LP §2 State 2 requires "same header/branding (chip persists if
// present)", and a header living inside State 1 vanishes the instant State 1 is
// hidden — the homeowner would lose the contractor's mark at exactly the moment
// they are asked to trust an email from them.
//
// A12: the chip renders for `peer` and `rep` — the two link types with a
// personal owner — and NEVER for `contractor`. The resolver has already redacted
// the name to first name plus last initial server-side, so the full surname is
// never SENT to the page rather than merely never displayed.
function renderHeader(payload, theme) {
  const chip = payload.referrer
    ? `<div class="chip">Invited by ${escapeHtml(payload.referrer.displayName)}</div>`
    : '';
  return `<div class="brand">
  ${renderBrandMark(theme)}
  ${chip}
</div>`;
}

// ── STATE 1 — LANDING + SIGNUP ───────────────────────────────────────────────
// LP §2's copy is final as written. The FIELD LIST is not LP's: amendment A11
// voids it outright, because the live POST /api/signup requires `phone` and
// rejects any credential under 6 characters — LP's four-digit PIN with no phone
// would be refused at the door on every single submission.
function renderState1(theme) {
  const company = escapeHtml(theme.companyName);

  // LP's headline is "Join the {Program Name} rewards program". programName has
  // no platform default on purpose — 'Rooster Booster' is this platform's
  // internal codename, not a program name any contractor would choose — so an
  // unset one degrades to the company's own name rather than printing "null".
  const headlineSubject = theme.programName ? escapeHtml(theme.programName) : company;

  return `<section class="state state-1 is-active" id="state-1">
  <div class="stagger">
    <div class="hero">
      <h1>Join the ${headlineSubject} rewards program</h1>
      <p>Earn cash for referring friends and neighbors to ${company}.</p>
    </div>
    <ol class="steps">
      <li class="step"><div class="step-num">1</div><div>
        <h3>Share your personal link</h3>
        <p>Tell friends and neighbors about ${company}</p></div></li>
      <li class="step"><div class="step-num">2</div><div>
        <h3>They book a free inspection</h3>
        <p>We take care of them like family</p></div></li>
      <li class="step"><div class="step-num">3</div><div>
        <h3>You earn cash rewards</h3>
        <p>Get paid when their job completes</p></div></li>
    </ol>
    <div class="card">
      <h2>Create your account</h2>
      <form id="signup-form" novalidate>
        <div class="row">
          <div class="field">
            <label for="firstName">First name</label>
            <input id="firstName" name="firstName" type="text" autocomplete="given-name" required>
          </div>
          <div class="field">
            <label for="lastName">Last name</label>
            <input id="lastName" name="lastName" type="text" autocomplete="family-name" required>
          </div>
        </div>
        <div class="field">
          <label for="phone">Phone</label>
          <input id="phone" name="phone" type="tel" autocomplete="tel" required>
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="new-password" required>
          <p class="hint">At least 6 characters</p>
        </div>
        <button class="btn" type="submit" id="signup-btn">Create my account</button>
        <p class="err" id="signup-error"></p>
      </form>
    </div>
    <div class="skip">
      <button class="skip-link" type="button" id="skip-btn">Skip — just get the app</button>
      <p>We'll copy your referral code so the app can connect you automatically.</p>
      <p class="skip-note" id="skip-note">Your referral code is copied — see you in the app! ✓</p>
    </div>
  </div>
</section>`;
}

// ── STATE 2 — EMAIL VERIFICATION ─────────────────────────────────────────────
// The chip persists (LP §2) because the brand header above it is shared by all
// three states rather than re-rendered per state.
function renderState2() {
  return `<section class="state state-2" id="state-2">
  <div class="card">
    ${icon('envelope', 'verify-icon', 44)}
    <h2>Check your email</h2>
    <p>We sent a 6-digit code to <b id="verify-email"></b>.</p>
    <div class="code">
      <input class="code-box" type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Digit 1">
      <input class="code-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 2">
      <input class="code-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 3">
      <input class="code-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 4">
      <input class="code-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 5">
      <input class="code-box" type="text" inputmode="numeric" maxlength="1" aria-label="Digit 6">
    </div>
    <p class="err" id="verify-error">That code didn't match — try again.</p>
    <button class="btn" type="button" id="verify-btn" disabled>Verify</button>
    <div class="verify-actions">
      <button class="linkbtn" type="button" id="back-btn">&larr; Back</button>
      <button class="linkbtn" type="button" id="resend-btn">Resend code</button>
    </div>
    <p class="resend-note" id="resend-note">Code sent</p>
  </div>
</section>`;
}

// ── STATE 3 — SUCCESS + GET THE APP ──────────────────────────────────────────
// LP §7's "session created on verify success" is STRUCK: verify-email marks the
// row verified and returns a message, and sessions are bearer tokens minted only
// by POST /api/login. So this is a "you're in — now sign in" screen, and its
// reassurance line is literal rather than reassuring. Per A11 the credential is
// a password, not a PIN.
//
// The confetti pieces carry their vector as inline custom properties rather than
// as eight keyframe blocks — style="" is permitted under the CSP; only script is
// nonce-gated. Colours are the contractor's own, which is the whole point of
// "confetti accents in brand colors".
function renderState3() {
  const pieces = [
    ['-62px', '-46px', '-38deg', 'var(--brand-primary)'],
    ['58px', '-52px', '42deg', 'var(--brand-secondary)'],
    ['-74px', '18px', '-12deg', 'var(--brand-primary)'],
    ['70px', '26px', '24deg', 'var(--brand-accent)'],
    ['-30px', '-72px', '58deg', 'var(--brand-secondary)'],
    ['26px', '-78px', '-52deg', 'var(--brand-primary)'],
    ['-46px', '62px', '32deg', 'var(--brand-accent)'],
    ['44px', '58px', '-28deg', 'var(--brand-secondary)'],
  ].map(([cx, cy, cr, color], i) =>
    // toFixed, because 0.18 + 5 * 0.045 serialises as 0.40499999999999997 and
    // ships that into the markup.
    `<i style="--cx:${cx};--cy:${cy};--cr:${cr};background:${color};animation-delay:${(0.18 + i * 0.045).toFixed(3)}s"></i>`
  ).join('');

  return `<section class="state state-3" id="state-3">
  <div class="card">
    <div class="celebrate">
      <div class="ring"></div>
      <div class="confetti">${pieces}</div>
      ${icon('check', 'tick', 46)}
    </div>
    <h2>You're in, <span id="success-name"></span>!</h2>
    <p>Your account is ready. Download the app to track your referrals and rewards.</p>
    ${renderBadgeSlot()}
    <p class="hint">Sign in with the email and password you just created.</p>
  </div>
</section>`;
}

// ── THE STORE-BADGE SLOT (A14) ───────────────────────────────────────────────
// The slot ships, gated. When the flag is unset it renders as an EMPTY container
// — not a hidden element, not a broken image — and `.badges:empty` collapses its
// margin so there is no band of dead space. The text placeholders are what the
// official Apple and Google artwork replaces in the Capacitor session.
//
// SHARED by State 3 and the desktop skip view, so the two cannot drift into
// showing different badges for the same product.
function renderBadgeSlot() {
  const badges = storeBadgesEnabled()
    ? `<div class="store-badge">Download on the App Store</div>
       <div class="store-badge">Get it on Google Play</div>`
    : '';
  return `<div class="badges" data-store-badges>${badges}</div>`;
}

// ── THE DESKTOP SKIP VIEW ────────────────────────────────────────────────────
// LP §2's skip-path interstitial: "Desktop/unknown → State 3-style dual-badge
// view (no clipboard)."
//
// ⚠ THIS COPY IS NOT LP-LOCKED — LP specifies the VIEW for this branch and gives
// it no words. Written to be honest about the one thing that is true here and
// nowhere else on the skip path: the clipboard is deliberately untouched on
// desktop, so nothing carries the referral code to the phone, and the visitor's
// referral is lost unless they come back and sign up. Saying so, and giving them
// the way back, beats a cheerful dead end. Flagged for Danny rather than slipped
// in as though LP had blessed it.
//
// NO CLIPBOARD WRITE REACHES HERE, and that is a requirement rather than an
// omission: there is no app on a laptop to paste into, and silently taking over
// the clipboard of someone who is only reading is a hostile act.
function renderStateApp() {
  return `<section class="state state-app" id="state-app">
  <div class="card">
    <h2>Get the app</h2>
    <p>Install RoofMiles on your phone from the App Store or Google Play.</p>
    ${renderBadgeSlot()}
    <p class="hint">Your referral code stays on the device you opened this link on. To keep your referral connected, create your account here first.</p>
    <div class="verify-actions">
      <button class="linkbtn" type="button" id="app-back-btn">&larr; Back</button>
    </div>
  </div>
</section>`;
}

// ── THE PAGE SCRIPT ──────────────────────────────────────────────────────────
// Runs under the router's per-request nonce. No inline handlers anywhere —
// script-src-attr is 'none', so an onclick= would never fire and would fail
// silently, with a perfectly successful 200 on the server.
//
// THE SIGNUP POST IS JSON, AND THAT IS NOT A STYLE CHOICE. server/app.js mounts
// express.json() and NO express.urlencoded(), so a native <form method="post">
// would send a body no parser on this server reads: every field arrives
// undefined and POST /api/signup answers "All fields are required." on a form the
// homeowner filled in completely, with nothing thrown and nothing logged.
//
// PAGE STATE LIVES IN THIS CLOSURE — the userId from the signup 201, the email
// and the contractorId a resend needs. None of it survives a reload, which is
// why the three states are one document rather than three navigations.
function pageScript(nonce, bootstrap) {
  // JSON, with '<' escaped so a value containing '</script>' cannot close the
  // block it is embedded in. The bootstrap deliberately carries only the two
  // identifiers the API calls need; every display value is already in the markup.
  const boot = JSON.stringify(bootstrap).replace(/</g, '\\u003c');

  return `<script nonce="${nonce}">
(() => {
  'use strict';
  const boot = ${boot};
  const $ = (id) => document.getElementById(id);
  const page = { userId: 0, email: '', firstName: '' };

  const show = (n) => {
    for (const s of document.querySelectorAll('.state')) s.classList.remove('is-active');
    const target = $('state-' + n);
    if (target) target.classList.add('is-active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setError = (el, message) => {
    if (!el) return;
    if (message) el.textContent = message;
    el.classList.add('is-shown');
  };
  const clearError = (el) => { if (el) el.classList.remove('is-shown'); };

  const postJson = async (path, payload) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    return { ok: res.ok, data: data };
  };

  // ── SIGNUP ────────────────────────────────────────────────────────────────
  const form = $('signup-form');
  const signupBtn = $('signup-btn');
  const signupError = $('signup-error');

  if (form) form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearError(signupError);

    const body = {
      firstName: $('firstName').value.trim(),
      lastName: $('lastName').value.trim(),
      phone: $('phone').value.trim(),
      email: $('email').value.trim(),
      password: $('password').value,
      inviteSlug: boot.inviteSlug
    };

    signupBtn.disabled = true;
    try {
      const out = await postJson('/api/signup', body);
      if (!out.ok) {
        setError(signupError, out.data.error || 'Something went wrong. Please try again.');
        signupBtn.disabled = false;
        return;
      }
      page.userId = out.data.userId || 0;
      page.email = body.email;
      page.firstName = body.firstName;
      const emailEl = $('verify-email');
      if (emailEl) emailEl.textContent = page.email;
      show(2);
    } catch (err) {
      setError(signupError, 'Something went wrong. Please try again.');
    }
    signupBtn.disabled = false;
  });

  // ── SIX-BOX CODE INPUT ────────────────────────────────────────────────────
  const boxes = Array.prototype.slice.call(document.querySelectorAll('.code-box'));
  const verifyBtn = $('verify-btn');
  const verifyError = $('verify-error');
  const codeOf = () => boxes.map((b) => b.value).join('');
  const syncVerify = () => { if (verifyBtn) verifyBtn.disabled = codeOf().length !== 6; };

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (box.value && i + 1 !== boxes.length) boxes[i + 1].focus();
      syncVerify();
    });
    box.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace' && !box.value && i !== 0) boxes[i - 1].focus();
    });
  });

  if (boxes.length === 6) boxes[0].addEventListener('paste', (ev) => {
    const raw = ev.clipboardData ? ev.clipboardData.getData('text') : '';
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 6);
    if (!digits) return;
    ev.preventDefault();
    boxes.forEach((b, i) => { b.value = digits.charAt(i) || ''; });
    syncVerify();
    boxes[Math.min(digits.length, 5)].focus();
  });

  // ── VERIFY ────────────────────────────────────────────────────────────────
  if (verifyBtn) verifyBtn.addEventListener('click', async () => {
    clearError(verifyError);
    verifyBtn.disabled = true;
    try {
      const out = await postJson('/api/signup/verify-email', { userId: page.userId, code: codeOf() });
      if (!out.ok) {
        // LP §2: wrong code shows the inline error with the boxes CLEARED, so the
        // next attempt starts from an empty field rather than a wrong one.
        setError(verifyError, '');
        boxes.forEach((b) => { b.value = ''; });
        if (boxes.length) boxes[0].focus();
        syncVerify();
        return;
      }
      const nameEl = $('success-name');
      if (nameEl) nameEl.textContent = page.firstName;
      show(3);
    } catch (err) {
      setError(verifyError, '');
      syncVerify();
    }
  });

  const backBtn = $('back-btn');
  if (backBtn) backBtn.addEventListener('click', () => show(1));

  // ── RESEND ────────────────────────────────────────────────────────────────
  // THE CONFIRMATION AND THE COOLDOWN ARE OPTIMISTIC AND INDEPENDENT OF THE
  // RESPONSE, deliberately. POST /api/signup/resend-code returns the SAME generic
  // 200 whether the account exists, is already verified, or was mailed
  // successfully — precisely so nothing about an address leaks. Branching the UI
  // on that response would re-open the hole from the client side, so the request
  // is fired and its result is never inspected.
  const resendBtn = $('resend-btn');
  const resendNote = $('resend-note');
  if (resendBtn) resendBtn.addEventListener('click', () => {
    if (resendBtn.disabled) return;
    resendBtn.disabled = true;
    if (resendNote) resendNote.classList.add('is-shown');

    let left = 30;
    const tick = setInterval(() => {
      left -= 1;
      if (left > 0) { resendBtn.textContent = 'Resend code (' + left + 's)'; return; }
      clearInterval(tick);
      resendBtn.textContent = 'Resend code';
      resendBtn.disabled = false;
    }, 1000);

    // Fire-and-forget through an async IIFE rather than a .catch() chain — the
    // codebase's own non-blocking pattern (referrer.js), and CLAUDE.md rules out
    // promise chains. The rejection is swallowed on purpose: a failed network
    // call here must not contradict the optimistic confirmation above, which is
    // deliberately blind to the outcome.
    (async () => {
      try {
        await postJson('/api/signup/resend-code', {
          email: page.email,
          contractorId: boot.contractorId
        });
      } catch (err) { /* swallowed on purpose — see above */ }
    })();
  });

  // ── SKIP PATH (LP §2 skip-path interstitial) ──────────────────────────────
  // Copy the token in the same gesture -> show the confirmation -> redirect by
  // platform. This is the reason the page cannot be JS-free (A8, LP §6.5).
  const skipBtn = $('skip-btn');
  const skipNote = $('skip-note');

  // Copies the token. MUST be invoked synchronously from inside the click
  // handler. navigator.clipboard.writeText requires USER ACTIVATION, and a call
  // placed behind an await has already lost it — the copy is then refused,
  // silently, on a real phone, with the page looking perfectly healthy.
  //
  // THE PROPERTY ACCESS IS GUARDED, NOT ASSUMED. On an insecure context or an
  // older engine the clipboard API is absent, so reaching straight for
  // navigator.clipboard.writeText(...) throws a TypeError SYNCHRONOUSLY — before
  // the redirect line is ever reached. A try/catch around the awaited promise
  // does not help, because the throw is on the property access, not the promise.
  //
  // (Every comment in this block ships to the visitor's browser, so it avoids
  // the two words a footer bug would print at them — landingStates.test.js scans
  // the served document for those and cannot tell script text from copy.)
  const copyToken = () => {
    const clip = navigator.clipboard;
    if (!clip || typeof clip.writeText !== 'function') return;
    const pending = clip.writeText(boot.inviteSlug);
    // Fire-and-forget through an async IIFE — this file's own non-blocking
    // pattern (see resend above), and CLAUDE.md rules out promise chains. The
    // rejection is swallowed ON PURPOSE: a denied clipboard permission must
    // never take the redirect down with it. The visitor is then asked in the
    // app instead; what they must never get is a button that ate the tap.
    (async () => { try { await pending; } catch (err) { /* degrades — see above */ } })();
  };

  if (skipBtn) skipBtn.addEventListener('click', () => {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    // iPadOS 13+ reports a Macintosh UA, so touch points are what tell a modern
    // iPad from a desktop Safari. Without that clause an iPad takes the desktop
    // branch and never gets its code copied.
    const isIOS = /iPad|iPhone|iPod/.test(ua)
      || (/Macintosh/.test(ua) && Number(navigator.maxTouchPoints) > 1);
    const isMobile = isAndroid || isIOS;

    // DESKTOP FIRST, AND IT RETURNS BEFORE copyToken(). LP: desktop gets the
    // dual-badge view and NO clipboard write.
    if (!isMobile) { show('app'); return; }

    copyToken();
    // LP's interstitial confirmation, revealed rather than written: the copy is
    // server-rendered above with every other locked string on this page.
    if (skipNote) skipNote.classList.add('is-shown');

    // A14's gate governs the DESTINATION as well as the artwork. With the flag
    // unset there is no store to send anyone to, so the confirmation is where
    // this ends — the token is on the clipboard either way.
    const dest = boot.storeUrls && (isAndroid ? boot.storeUrls.android : boot.storeUrls.ios);
    if (!dest) return;

    // The dwell is the disclosure. It is the only moment the visitor is told
    // their code was copied, and a redirect fired in the same frame means nobody
    // reads it.
    setTimeout(() => { window.location.href = dest; }, 1500);
  });

  const appBackBtn = $('app-back-btn');
  if (appBackBtn) appBackBtn.addEventListener('click', () => show(1));
})();
</script>`;
}

// Assembles States 1-3 into the one document they have to share.
function renderLandingPage(payload, nonce) {
  const theme = payload.contractor || neutralTheme();
  const storeUrls = storeUrlsFor(payload.inviteSlug);

  const body = [
    renderHeader(payload, theme),
    renderState1(theme),
    renderState2(),
    renderState3(),
    renderStateApp(),
    renderFooter(theme),
    pageScript(nonce, {
      inviteSlug: payload.inviteSlug,
      contractorId: payload.contractorId,
      // OMITTED, NOT NULLED, while A14's gate is closed — the same
      // presence-rather-than-value rule the resolver applies to `address` (LP-1),
      // and for a second reason here: JSON.stringify would write the literal word
      // "null" into the served document, and landingStates.test.js pins that word
      // as a homeowner-visible failure because its tag-stripping cannot tell
      // script content from copy. `boot.storeUrls` reads as undefined either way,
      // which the guard at the redirect site already handles.
      ...(storeUrls ? { storeUrls } : {}),
    }),
  ].join('\n');

  return renderDocument({ theme, title: theme.companyName, body });
}

// ── THE TWO LANDING ROUTES ───────────────────────────────────────────────────
// One handler, two entry points, and the difference between them is one value:
//
//   GET /i/:slug   a token — LP's invite mode
//   GET /          no token — LP §6.4 / A17's MARKETING mode, a contractor's bare
//                  subdomain, which is the shortest URL we give them and the one
//                  that ends up on a truck wrap
//
// ONE resolution, shared with GET /api/invite/:slug. See landingResolve.js.
//
// AN INVALID TOKEN IS STILL A 200, not a 404. LP §2 State 0 is a PAGE — a
// homeowner holding a dead link should see a branded explanation and a way to
// reach the contractor, not a browser error. The distinction lives in the body,
// not the status code.
//
// ── WHY THE MARKETING MINT LIVES HERE AND NOT IN resolveLanding() ───────────
// A18's auto-mint is a PROVISIONING side effect, not a resolution rule, and the
// two callers of the shared resolver differ in kind rather than in detail:
//
//   THIS ROUTE serves a homeowner a page carrying a SIGNUP FORM, and that form
//     cannot submit without a token — POST /api/signup requires `inviteSlug` and
//     will keep requiring it, because the token is the tenancy authority. The
//     mint is what makes the page functional; it exists for the form.
//
//   GET /api/invite is the SPA's invite-VALIDATION call. Its marketing branch
//     exists only because the endpoint carries two mounts, and nothing signs up
//     through it in that mode. Minting there would provision a permanent database
//     row as a side effect of a read-only validation call, on a public endpoint.
//
// So the resolver stays the pure read it was built as, and three existing tests
// keep meaning what they say — landingResolve.test.js's "marketing mode writes
// nothing" and landingResolution.test.js's "a bare-subdomain visit writes
// nothing" are not obstacles that were worked around here, they are the reason
// the mint sits at this layer.
//
// The mint itself is NOT inlined: resolveDefaultMarketingToken lives in the token
// service with every other rule about this table, so a future surface that needs
// a contractor's marketing token has one call to make rather than a query to
// copy. That is the drift landingResolve.js's header is about, honoured at the
// layer where it actually applies.
async function serveLanding(req, res, slug, source) {
  try {
    const payload = await resolveLanding(pool, { host: req.hostname, slug, req });

    if (!payload.valid) {
      res.type('html').send(renderInvalidPage(payload));
      return;
    }

    // The slug is threaded from the REQUEST rather than the payload: the page has
    // to post back the exact token it was served under, and the resolver has no
    // reason to echo it. Marketing mode is the exception — there is no slug in
    // the request, which is the whole point of the mode.
    let inviteSlug = slug;
    let contractorId = payload.contractorId;

    if (payload.mode === 'marketing') {
      const token = await resolveDefaultMarketingToken(pool, payload.contractorId);
      if (!token) {
        // A branded page whose form cannot submit is worse than an honest dead
        // end, so this degrades to State 0 with the contractor's own branding
        // rather than rendering a signup card that would 400 on every attempt.
        res.type('html').send(renderInvalidPage({ contractor: payload.contractor }));
        return;
      }
      inviteSlug = token.slug;
      // READ BACK OFF THE TOKEN ROW, not left as the host-derived value. The two
      // are equal by construction here, and writing it this way is what keeps
      // that a provable property of the code rather than a comment: every
      // contractor-scoped value the page carries comes from the token.
      contractorId = token.contractor_id;
    }

    res.type('html').send(
      renderLandingPage({ ...payload, inviteSlug, contractorId }, res.locals.cspNonce)
    );
  } catch (err) {
    await logError({ req, error: err, source });
    // A THROWN ERROR MUST STILL RENDER HTML. The global expressErrorHandler
    // answers JSON, which on this surface would show a homeowner a raw object.
    // Handled here so the failure mode is a plain page rather than a JSON blob,
    // and with no internal detail (Security Standards).
    res.status(500).type('html').send(
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<title>Something went wrong</title></head><body>' +
      "<p>Something went wrong. Please try again in a moment.</p></body></html>"
    );
  }
}

router.get('/i/:slug', (req, res) => serveLanding(req, res, req.params.slug, 'GET /i/:slug'));

// MOUNTED LAST-ISH AND DELIBERATELY NARROW. server/app.js mounts this router
// after every API router, so this cannot shadow one; and on a host carrying no
// contractor subdomain it renders the neutral State 0 rather than claiming the
// apex, which per A7/A13 belongs to the marketing site and never reaches Express.
router.get('/', (req, res) => serveLanding(req, res, null, 'GET / — marketing mode'));

module.exports = router;

// ADDITIVE, AND DELIBERATELY NOT A NAMED-EXPORTS OBJECT. server/app.js requires
// this module and passes the result straight to app.use('/', landingRoutes), so
// replacing the line above with { router, safeWebsiteUrl } would unmount the
// landing page. A router is a function object, so a property hangs off it
// without disturbing what the module exports.
//
// Exposed for test only. safeWebsiteUrl is a security predicate with a large
// input space — schemes, hostnames, junk — and its sibling safeLogoUrl is
// covered only through rendered output, where a refusal is indistinguishable
// from a row that simply did not render. server/test/landingWebsiteUrl.test.js
// exercises it directly.
module.exports.safeWebsiteUrl = safeWebsiteUrl;

// ── TEST SEAM ────────────────────────────────────────────────────────────────
// renderFooter is exercised directly by server/test/landingSocialFooter.test.js.
// Exported under `__test__` rather than as a bare name so it reads as a seam
// rather than as part of this module's interface — nothing in production calls
// it from outside this file.
module.exports.__test__ = { renderFooter };
