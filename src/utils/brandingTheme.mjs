// ⚠ NO `'use strict';` HERE. It is one of the TWO intentional differences from
// the canonical server copy (the other is the module system — see below), and it
// is a RETAINED CONVENTION, NOT A BUILD REQUIREMENT — rationale corrected in
// C/DL-3a Phase 3. ESM is strict-mode by definition in any case, so as of the
// Vite dev pipeline fix this file is strict whether the line is present or not.
//
// WHAT THIS NOTE USED TO SAY, and why it is no longer true. The line shipped
// here in Phase 3b (5cac111) and was removed in Phase 3c because CRA's eslint
// config raised `'use strict' is unnecessary inside of modules` for anything
// under src/, and CRA turned warnings into errors whenever CI was set — so
// `CI=true npm run build` failed outright. Neither half of that survives the
// Vite migration (2026-08-04): ESLint is not part of the build at all any more,
// and `eslint.config.mjs` enables ONLY the two react-hooks rules with no
// recommended preset, so nothing raises the rule. Restoring the line here would
// not break anything today.
//
// IT STAYS OUT ANYWAY. The mirrored files in this repo all follow the same
// server-has-it / src-does-not arrangement, and one rule across all of them
// beats two that nearly agree — the whole point of a mirror is that the diff
// between the copies is a fixed, known quantity.
//
// Nothing here depends on strict-mode semantics, and the drift guard is
// unaffected: server/test/brandingTheme.test.js compares the two copies'
// BEHAVIOUR, not their text, and the mirrored region begins below this header.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// BRANDING THEME RESOLVER — MIRRORED COPY (C/DL-2 Phase 3b)
//
// ⚠ THIS FILE IS A MIRROR of `server/utils/brandingTheme.js`, which is the
// canonical copy. THE TWO FILES MUST BE EDITED TOGETHER. Same arrangement as
// WARMUP_ENTRIES (src/constants/shouts.js) and WARMUP_ENTRIES_SERVER.
//
// WHY A COPY AND NOT AN IMPORT — RESTATED AT THE VITE DEV PIPELINE FIX, because
// both of this paragraph's previous answers are now retired. It first said CRA's
// ModuleScopePlugin refuses any import reaching outside src/; CRA is gone (Vite
// migration, 2026-08-04) and that barrier went with it. It then said the Node
// drift guard has to be able to `require()` this copy; the guard uses
// `await import()` now and no longer cares.
//
// THE LIVE REASON IS THE SERVER COPY'S MODULE SYSTEM. server/utils/brandingTheme.js
// is CommonJS and has to stay that way — a dozen server files `require()` it
// under Node's CJS resolution — and the Vite dev server cannot serve a CommonJS
// source file to a browser at all. That is not a theoretical limit; it is the
// exact failure this whole header now documents. Importing the server copy
// directly from a React component would reproduce the white screen, one
// directory further up.
//
// Passing the resolution through an HTTP call instead was rejected, and that
// rejection is unaffected by the correction above: the preview's entire job is
// to re-render from UNSAVED form state on every keystroke, and there is nothing
// on the server to ask about a value the admin has not saved yet.
//
// WHAT MAKES THIS ACCEPTABLE rather than the first step of a drift is that a
// test fails when the two copies disagree. server/test/brandingTheme.test.js
// requires both files and compares their defaults AND their resolution
// behaviour across a table of inputs. Change one without the other and the
// suite goes red naming the diverged value.
//
// That guard exists because THIS DRIFT ALREADY HAPPENED ONCE. BrandingPreview.jsx
// carried its own three hardcoded fallbacks — THE FIRST TENANT'S navy, red and
// light blue, the platform's original single-tenant palette — while the server
// fell back to RoofMiles' #F26A1B / #1C2D4D / #FFFFFF. A contractor who had
// saved no colours saw one brand in the admin preview and a different one on
// their live surface, and neither was theirs. Nothing failed. C/DL-2 Phase 3c
// wired BrandingPreview onto this module and deleted those three constants;
// that file's own header records the correction and BrandingPreview.test.jsx
// pins it.
//
// WHY ESM, AND WHY THE .mjs EXTENSION — REWRITTEN AT THE VITE DEV PIPELINE FIX.
//
// ⚠ THIS FILE USED TO BE CommonJS, AND THE HEADER USED TO ARGUE THAT IT HAD TO
// BE. THAT RATIONALE IS RETIRED, NOT MERELY WRONG. It said: the drift guard is a
// Node test, `require()` cannot load ESM, therefore the mirror must be CJS so the
// guard can read it. The premise about `require()` was the mistake — a Node test
// can `await import()` an ES module perfectly well, and node:test supports async
// test bodies. The guard now does exactly that. DO NOT "RESTORE" THE CommonJS
// SHAPE: it is what broke the app.
//
// It broke it like this. There are three module pipelines in this repo and they
// disagree. The production build (rolldown + the commonjs plugin) interops CJS
// source files; Vitest, resolving Node-side, interops CJS source files; THE VITE
// DEV SERVER DOES NOT — it serves source files essentially verbatim, generating
// no export statements from a `module.exports =`. So the browser linked this
// module with ZERO exports and `import { resolveBrandingTheme }` failed AT LINK
// TIME, before any code ran, which is why the symptom was a blank page rather
// than a partial render. `npm start` was unusable for six days with every gate
// green, because the two pipelines that interop CJS were both tested and the one
// developers actually use was not.
//
// .mjs IS REQUIRED, NOT STYLISTIC. package.json declares no "type" field, so Node
// parses a bare `.js` in this package as CommonJS and `export` is a SyntaxError
// there. The extension is what makes the same bytes loadable by both consumers:
// the browser (via Vite, which needs the ESM syntax) and the Node drift guard
// (via `await import()`, which needs the extension).
//
// THE COVERING TEST for the pipeline itself is src/devServerPipeline.test.js,
// which boots a dev server, links its module graph the way a browser does, and
// asserts the app mounts. That is the gap this file's old shape sat in.
//
// Everything below this line is a verbatim mirror, WITH ONE EXCEPTION: the final
// export statement, which is `export { … }` here and `module.exports = { … }` in
// the server copy. Same names, same values, different module system — the two
// intentional differences ('use strict' and this one) are both stated in this
// header, and everything else must match. Do not edit it here alone.
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

// ⚠ THE ONE LINE THAT IS NOT A VERBATIM MIRROR. The server copy ends with
// `module.exports = { … }`; same three names, same three values. See the header.
export { resolveBrandingTheme, BRANDING_THEME_DEFAULTS, HEX_RE as BRANDING_HEX_RE };
