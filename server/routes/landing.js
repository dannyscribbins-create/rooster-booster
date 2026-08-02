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
  check: 'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z',
};

// Renders one icon. aria-hidden throughout: every icon on this page sits beside
// the text it decorates, so announcing it would repeat that text to a screen
// reader rather than add to it.
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
    `--brand-primary:${theme.primaryColor};`,
    `--brand-secondary:${theme.secondaryColor};`,
    `--brand-accent:${theme.accentColor};`,
    `--brand-bg:${theme.backgroundColor};`,
    '}',
  ].join('');
}

// The RoofMiles token set, used when nothing resolved. Spread into a plain object
// because BRANDING_THEME_DEFAULTS is frozen and callers read optional keys
// (logoUrl, phone, programName) that it does not carry.
function neutralTheme() {
  return { ...BRANDING_THEME_DEFAULTS, programName: null, logoUrl: null, phone: null, email: null };
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
.brand-name{font-family:'Montserrat',ui-sans-serif,system-ui,'Segoe UI',Helvetica,Arial,sans-serif;
  font-size:21px;font-weight:700;color:var(--brand-primary);letter-spacing:-0.01em;}
.chip{display:inline-block;margin-top:12px;padding:7px 15px;border-radius:999px;
  background:var(--brand-accent);color:var(--brand-secondary);font-size:14px;font-weight:500;}
.hero{text-align:center;margin-bottom:26px;}
.hero p{margin-top:10px;font-size:16px;opacity:.78;}
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
function renderFooter(theme) {
  const rows = [];
  if (theme.phone) {
    rows.push(`<a href="tel:${escapeHtml(theme.phone)}">${icon('phone', 'ico', 15)}${escapeHtml(theme.phone)}</a>`);
  }
  if (theme.email) {
    rows.push(`<a href="mailto:${escapeHtml(theme.email)}">${icon('envelope', 'ico', 15)}${escapeHtml(theme.email)}</a>`);
  }
  if (theme.address) {
    rows.push(`<span>${icon('mapPin', 'ico', 15)}${escapeHtml(theme.address)}</span>`);
  }

  return `<footer class="foot">
  ${rows.length ? `<div class="contact">${rows.join('')}</div>` : ''}
  <div class="divider"></div>
  <p class="powered">Powered by <b>RoofMiles</b></p>
  <p class="legal"><a href="#privacy">Privacy</a> &middot; <a href="#terms">Terms</a></p>
</footer>`;
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
// TWO VARIANTS, and the difference is one sentence. When the subdomain resolved
// and nothing was in conflict, the page carries that contractor's branding and
// tells the visitor to contact them. When it did not — an unrecognised
// subdomain, or a token/subdomain MISMATCH — the page is neutral and the contact
// sentence is dropped, because there is nobody to contact and naming either
// party would confirm to a prober that they exist. The resolver decides which;
// see buildInvalidPayload in landingResolve.js.
function renderInvalidPage(payload) {
  const branded = Boolean(payload.contractor);
  const theme = branded ? payload.contractor : neutralTheme();

  const body = `<div class="stagger">
  <div class="brand">${renderBrandMark(theme)}</div>
  <div class="hero">
    <h1>This link isn't active</h1>
    <p>This referral link isn't valid or may have expired. If someone sent it to you, ask them for a fresh link${
      branded ? ` — or contact ${escapeHtml(theme.companyName)} directly.` : '.'
    }</p>
  </div>
  ${renderFooter(theme)}
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

  // A14: the slot ships, gated. When the flag is unset it renders nothing at all
  // — not a hidden element, not a broken image. The text placeholders below are
  // what the official Apple and Google artwork replaces in the Capacitor
  // session; neither the assets nor the store URLs they would link to exist yet,
  // so nothing here points at a destination.
  const badges = storeBadgesEnabled()
    ? `<div class="store-badge">Download on the App Store</div>
       <div class="store-badge">Get it on Google Play</div>`
    : '';

  return `<section class="state state-3" id="state-3">
  <div class="card">
    <div class="celebrate">
      <div class="ring"></div>
      <div class="confetti">${pieces}</div>
      ${icon('check', 'tick', 46)}
    </div>
    <h2>You're in, <span id="success-name"></span>!</h2>
    <p>Your account is ready. Download the app to track your referrals and rewards.</p>
    <div class="badges" data-store-badges>${badges}</div>
    <p class="hint">Sign in with the email and password you just created.</p>
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

  // ── SKIP PATH ─────────────────────────────────────────────────────────────
  // DELIBERATELY UNWIRED IN THIS PHASE. The interstitial — clipboard write inside
  // the click gesture, the ~1.5s confirmation, and the platform-detected store
  // redirect — is C/DL-3's, and the clipboard half is the reason it needs this
  // nonce'd handler at all: navigator.clipboard.writeText requires user
  // activation, so a deferred call has already lost it.
  //
  // ⚠ Until that lands, this button does nothing when tapped. Flagged rather than
  // hidden: LP §2 locks the copy as part of State 1, and shipping the label
  // without the behaviour is a visible gap, not an invisible one.
})();
</script>`;
}

// Assembles States 1-3 into the one document they have to share.
function renderLandingPage(payload, nonce) {
  const theme = payload.contractor || neutralTheme();

  const body = [
    renderHeader(payload, theme),
    renderState1(theme),
    renderState2(),
    renderState3(),
    renderFooter(theme),
    pageScript(nonce, {
      inviteSlug: payload.inviteSlug,
      contractorId: payload.contractorId,
    }),
  ].join('\n');

  return renderDocument({ theme, title: theme.companyName, body });
}

// ── GET /i/:slug — the invite landing page ───────────────────────────────────
// ONE resolution, shared with GET /api/invite/:slug. See landingResolve.js.
//
// AN INVALID TOKEN IS STILL A 200, not a 404. LP §2 State 0 is a PAGE — a
// homeowner holding a dead link should see a branded explanation and a way to
// reach the contractor, not a browser error. The distinction lives in the body,
// not the status code.
router.get('/i/:slug', async (req, res) => {
  try {
    const payload = await resolveLanding(pool, {
      host: req.hostname,
      slug: req.params.slug,
      req,
    });

    const html = payload.valid
      // The slug is threaded from the REQUEST rather than the payload: the page
      // has to post back the exact token it was served under, and the resolver
      // has no reason to echo it.
      ? renderLandingPage({ ...payload, inviteSlug: req.params.slug }, res.locals.cspNonce)
      : renderInvalidPage(payload);

    res.type('html').send(html);
  } catch (err) {
    await logError({ req, error: err, source: 'GET /i/:slug' });
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
});

module.exports = router;
