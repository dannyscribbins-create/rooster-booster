'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BRANDING THEME RESOLVER — CANONICAL COPY (C/DL-2 Phase 3b)
//
// ⚠ MIRRORED FILE. An identical copy lives at `src/utils/brandingTheme.mjs` for
// the admin BrandingPreview. THE TWO FILES MUST BE EDITED TOGETHER. This is the
// same arrangement WARMUP_ENTRIES / WARMUP_ENTRIES_SERVER already uses in this
// repo.
//
// ⚠ THE MIRROR IS ESM WITH A .mjs EXTENSION; THIS COPY IS CommonJS. That is the
// second intentional difference (see the 'use strict' note below for the first),
// and it is deliberate in both directions — do not "align" them.
//
// WHY A COPY RATHER THAN AN IMPORT — RATIONALE CORRECTED TWICE, most recently at
// the Vite dev pipeline fix. This header first said the preview "cannot reach
// outside src/ (CRA's ModuleScopePlugin)"; CRA is gone (Vite migration,
// 2026-08-04) and that constraint went with it. It then said the src/ copy must
// STAY CommonJS so the Node drift guard could require() it. THAT SECOND ANSWER
// WAS THE MISTAKE, AND IT COST SIX DAYS OF `npm start`.
//
// The Vite DEV SERVER serves source files essentially verbatim — it generates no
// export statements from a `module.exports =`, unlike the production build
// (rolldown + the commonjs plugin) and unlike Vitest (Node-side resolution). So a
// CommonJS mirror reached the browser as a module with ZERO exports and the
// preview's `import { resolveBrandingTheme }` failed AT LINK TIME, before any
// code ran: a blank page, with every gate green. The mirror is now ESM, and the
// drift guard uses `await import()`, which reads the artefact the browser
// actually links.
//
// THE LIVE REASON FOR A COPY IS THIS FILE'S OWN MODULE SYSTEM. It must stay
// CommonJS — a dozen server files require() it — and the dev server cannot serve
// a CommonJS source file to a browser at all. Importing this copy from a React
// component would reproduce the white screen, one directory further up.
//
// Covering test for the pipeline itself: src/devServerPipeline.test.js.
//
// THE OTHER INTENTIONAL DIFFERENCE: the `'use strict';` on line 1 below exists
// ONLY here — and it is now a RETAINED CONVENTION, NOT A BUILD REQUIREMENT (also
// corrected in Phase 3). The old note said CRA's eslint flagged it under src/
// and CRA turned warnings into build errors under CI, failing
// `CI=true npm run build`. Neither half survives the migration: ESLint is not
// part of the Vite build at all, and `eslint.config.mjs` enables only the two
// react-hooks rules, so nothing raises it. The asymmetry is kept because the
// mirrored files in this repo all follow it and one rule across all of them
// beats two that nearly agree. Everything AFTER the header comments is verbatim
// EXCEPT the final export line: `module.exports = { … }` here, `export { … }`
// there, same three names and same three values.
//
// What makes a mirror acceptable here rather than the first step of a drift is
// that a test fails when they disagree: server/test/brandingTheme.test.js
// compares the two copies' defaults AND their resolution behaviour across a
// table of inputs, and separately pins this file's defaults against
// referrer.js's exported ROOFMILES_DEFAULTS.
//
// That guard exists because the drift ALREADY HAPPENED once. Before this file,
// BrandingPreview.jsx fell back to #012854 / #CC0000 / #D3E3F0 — Accent
// Roofing's navy, red and light blue, the platform's original single-tenant
// palette — while the server fell back to RoofMiles' #F26A1B / #1C2D4D /
// #FFFFFF. A contractor who had saved no colours saw one brand in the admin
// preview and a different one on their live surface, and neither was theirs.
// Nothing failed. That is what this guard is for.
//
// ── WHAT THIS IS ─────────────────────────────────────────────────────────────
// One pure function resolving raw branding values into the token set that both
// the server-rendered landing page and the admin preview consume.
//
// PURE — no pool, no req, no network, no env, no clock. That is precisely what
// lets one function serve two very different callers:
//
//   the preview — unsaved form state, re-resolved on every keystroke
//   the page    — a contractor_settings row already read from the database
//
// ONE INPUT SHAPE, snake_case, because both callers already speak it: the admin
// form state IS the GET /api/admin/settings response object, and the page's
// input is the contractor_settings row those columns came from. Extra keys are
// ignored, so a full `SELECT *` row can be passed straight in.
//
// Output is camelCase and matches loadContractorBranding's existing block
// (server/routes/referrer.js) so the landing payload can adopt this resolver
// without a shape change.
// ─────────────────────────────────────────────────────────────────────────────

// Strict six-digit hex only. The 3-digit CSS shorthand (#abc) is DELIBERATELY
// refused: BrandingPreview already enforced this exact form, and one regex
// shared across both surfaces is worth more than two that nearly agree.
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// Google's canonical write-review entry point. The Place ID is appended,
// URL-encoded. Named rather than inlined so the one place Google's URL shape
// lives is greppable if they ever change it.
const GOOGLE_WRITE_REVIEW_BASE = 'https://search.google.com/local/writereview?placeid=';

// The RoofMiles fallback tokens (LP §5). A brand-new contractor gets a decent
// page from these before uploading anything.
//
// THERE IS NO DEFAULT LOGO, deliberately, and it is not an omission: a
// placeholder logo borrowed from another contractor is a white-label breach,
// not a fallback. The page draws no logo slot when logoUrl is null.
//
// accentColor is a PALE TINT OF primaryColor, and that relationship is the whole
// reason for the value (ruling: C/DL-2 Phase 3c). The accent slot paints soft
// background washes — progress-bar tracks, avatar circles, section fills — so it
// has to sit quietly behind the primary rather than compete with it. A tint of
// the primary keeps the default palette internally coherent instead of
// introducing a fourth unrelated hue.
//
// IT IS NOT SOURCED FROM backgroundColor. The two slots do different jobs:
// backgroundColor is the page's own canvas, accentColor is a fill drawn ON that
// canvas, and collapsing them would make every wash invisible on a white page.
// ⚠ reviewButtonText / reviewMessage JOINED THIS BLOCK IN C/DL-3b PHASE 6A, AND
// THEIR VALUES ARE A RULING, NOT A CHOICE MADE HERE. Two spellings of the message
// existed: this one, from GET /api/admin/settings' zero-row block, and
// '…quick GOOGLE review!' in src/config/contractor.js and the admin placeholder.
//
// THE RULE, WHICH GENERALISES: WHEN A DEFAULT EXISTS IN TWO PLACES, THE ONE THAT
// REACHES PRODUCTION USERS IS CANONICAL — the other is a copy that drifted. This
// is the value a contractor who never touches the field actually receives, so
// changing it would silently alter live copy for every such contractor.
//
// admin/index.js's zero-row block now READS THESE rather than re-typing them, so
// the two cannot drift apart again.
//
// ── THE RULE, WHICH IS WHY THERE IS NO DEFAULT REVIEW URL ───────────────────
// IDENTITY-BEARING VALUES GET NO DEFAULTS. A logo, a review link, a phone
// number — anything that identifies WHO the contractor is — resolves to null
// when unset, and the consumer decides whether to draw the thing at all.
//
// The two failure modes a default would produce are both worse than an absent
// element: borrowing another contractor's value is a white-label breach, and
// fabricating one sends a homeowner somewhere that does not exist.
//
// GENERIC COPY IS THE OPPOSITE CASE and may be defaulted freely — reviewButtonText
// and reviewMessage above name nobody, so a platform default is honest for every
// contractor. That is the line: does the value say WHO, or does it say WHAT.
const BRANDING_THEME_DEFAULTS = Object.freeze({
  companyName:      'RoofMiles',
  // ⚠ SWAPPED BY B-1 (2026-09-01) AND THE PAIR MUST MOVE TOGETHER. primaryColor
  // is the DARK NEUTRAL (ground + body text); secondaryColor is the ACTION colour
  // (buttons). The routing swap fixes a contractor's stored palette and INVERTS
  // the platform's unless these move with it — an unbranded contractor would get
  // an orange page ground carrying navy buttons.
  primaryColor:     '#1C2D4D',
  secondaryColor:   '#F26A1B',
  accentColor:      '#FDF0E7',
  backgroundColor:  '#FFFFFF',
  reviewButtonText: 'Leave a Review',
  reviewMessage:    'Enjoying the rewards? Leave us a quick review!',
});

// Returns the first argument that is a non-empty string, else null.
//
// EMPTY STRING COUNTS AS UNSET, and that equivalence is the whole reason this
// helper exists. A database column reads NULL; a form field the admin cleared
// reads ''. Same intent, so the same answer — otherwise clearing a colour field
// in the admin panel would paint the live page with the literal empty string,
// which a browser renders as no colour at all.
function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

// Returns `value` when it is a well-formed six-digit hex colour, else `fallback`.
//
// Validating rather than passing through is a deliberate change from the bare
// `||` this replaces. The value arrives from a free-text admin field, so 'navy'
// and a pasted 'F26A1B' are ordinary typing mistakes; unvalidated they reach the
// page and render as nothing — a black-on-black header or an invisible CTA, with
// nothing logged anywhere. The same check also means no attacker-influenced
// string can be interpolated into a style context.
function resolveColor(value, fallback) {
  return typeof value === 'string' && HEX_RE.test(value) ? value : fallback;
}

/**
 * Resolves raw branding values plus defaults into the landing/preview token set.
 *
 * @param {object|null|undefined} input - A contractor_settings row, an admin
 *        branding form-state object, or nothing. Non-objects resolve to the
 *        full default set rather than throwing: the preview calls this against
 *        whatever the form currently holds, and the page calls it with whatever
 *        the row loader returned — including null for a contractor with no
 *        settings row at all. A throw here is a blank landing page.
 * @returns {{companyName: string, programName: string|null, primaryColor: string,
 *            secondaryColor: string, accentColor: string, backgroundColor: string, logoUrl: string|null,
 *            phone: string|null, email: string|null, address?: string, website?: string}}
 */
function resolveBrandingTheme(input) {
  const src = (input && typeof input === 'object') ? input : {};

  const theme = {
    // THREE-STEP CHAIN, and the middle step is load-bearing. contractors.name is
    // NOT NULL, so a contractor who has never opened the Branding settings page
    // still gets their OWN name rather than the platform's — which matters most
    // on homeowner-facing surfaces, where 'RoofMiles' in place of the roofer's
    // name reads as a phishing attempt to the person receiving it.
    companyName:     firstNonEmpty(src.company_name, src.contractor_name) || BRANDING_THEME_DEFAULTS.companyName,

    // No platform-level default. 'Rooster Booster' is this platform's internal
    // codename, not a program name any contractor would choose.
    programName:     firstNonEmpty(src.app_display_name),

    primaryColor:    resolveColor(src.primary_color,    BRANDING_THEME_DEFAULTS.primaryColor),
    secondaryColor:  resolveColor(src.secondary_color,  BRANDING_THEME_DEFAULTS.secondaryColor),
    // SOURCED FROM accent_color, deliberately, and not re-pointed at
    // landing_bg_color. accent_color is a real column that GET/PUT
    // /api/admin/settings already round-trips and that admins can already set;
    // re-sourcing the slot would silently ignore a value they had saved.
    accentColor:     resolveColor(src.accent_color,     BRANDING_THEME_DEFAULTS.accentColor),
    backgroundColor: resolveColor(src.landing_bg_color, BRANDING_THEME_DEFAULTS.backgroundColor),

    logoUrl:         firstNonEmpty(src.logo_url),
    phone:           firstNonEmpty(src.company_phone),
    email:           firstNonEmpty(src.company_email),

    // ── THE REVIEW TRIO (C/DL-3b Phase 6A) ─────────────────────────────────
    // Added because Phase 6's Phase 0 found a state the settings-backing gate had
    // no name for: all three had a column, admin UI and a PATCH whitelist entry,
    // and NO DELIVERY PATH — nothing carried them to the referrer app. Widening
    // this resolver was chosen over a second authenticated read, because a second
    // delivery path is a second shape that can drift from the first.
    //
    // PUBLIC BY CONSTRUCTION, all three: a Google review link is printed on yard
    // signs and invoices, and the button text and message are copy a homeowner
    // reads. Nothing here changes GET /api/branding/:slug's disclosure posture.
    //
    // NULL vs DEFAULTED IS THE SAME SPLIT logoUrl ALREADY MAKES — see the note on
    // BRANDING_THEME_DEFAULTS. The consumer decides whether to draw the review
    // card from reviewUrl's presence; the copy is always safe to render.
    // ── PRECEDENCE: OVERRIDE, THEN DERIVE, THEN NOTHING ────────────────────
    // review_url if set → else derive from google_place_id → else null.
    //
    // ⚠ THE PLACE ID IS CANONICAL AND review_url IS A GENUINE OVERRIDE, not a
    // courtesy. A Place ID is a stable identifier entered once; a write-review URL
    // is a formatted string whose shape Google controls. Deriving gives one input
    // and no way for the two to disagree.
    //
    // THE OVERRIDE IS LOAD-BEARING FOR A TECHNICAL REASON: a `g.page/r/…` short
    // link is CID-derived, NOT a Place ID. It cannot be regenerated from a Place
    // ID, and a Place ID cannot be recovered from it — so a contractor holding
    // one, or pointing at a non-Google destination entirely, must keep it.
    //
    // ⚠ NOT social_google, DELIBERATELY. That column is a Google Business PROFILE
    // link used in campaign email footers. A profile link and a write-review link
    // are different destinations; conflating them sends campaign readers to a
    // review form. Recorded as an explicit non-goal.
    //
    // ENCODED, never interpolated raw: the column is free text an admin pasted,
    // and this string is handed to window.open.
    reviewUrl:       firstNonEmpty(src.review_url)
                       || (firstNonEmpty(src.google_place_id)
                            ? `${GOOGLE_WRITE_REVIEW_BASE}${encodeURIComponent(src.google_place_id.trim())}`
                            : null),
    reviewButtonText: firstNonEmpty(src.review_button_text) || BRANDING_THEME_DEFAULTS.reviewButtonText,
    reviewMessage:   firstNonEmpty(src.review_message)     || BRANDING_THEME_DEFAULTS.reviewMessage,
  };

  // ADDRESS IS OMITTED, NOT NULLED (LP-1). The footer decides whether to draw
  // the contact row by the key's presence, so a null would render an empty row
  // where no row belongs.
  const address = firstNonEmpty(src.company_address);
  if (address) theme.address = address;

  // WEBSITE IS OMITTED, NOT NULLED, on the same rule as address directly above —
  // the page draws each contact row by the key's presence, so an always-present
  // null renders an empty row, or the literal word "null", at a homeowner.
  //
  // SOURCED FROM company_url: the admin Company Details "Website URL" field. NOT
  // social_website, which is a social-links row on the Branding page, and not
  // review_url.
  //
  // CARRIED VERBATIM, and deliberately not normalised here. The column is an
  // unconstrained VARCHAR(500) with nothing between the admin form and the
  // database, so both a bare domain and a full URL are real stored values. This
  // function is pure and cannot see whether the value is about to become an href
  // or plain text; deciding that — prepending a scheme, refusing a hostile one —
  // is the render layer's job, the same split safeLogoUrl already makes for
  // logoUrl.
  const website = firstNonEmpty(src.company_url);
  if (website) theme.website = website;

  return theme;
}

module.exports = { resolveBrandingTheme, BRANDING_THEME_DEFAULTS, BRANDING_HEX_RE: HEX_RE };
