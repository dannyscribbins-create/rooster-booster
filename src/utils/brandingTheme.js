// ⚠ NO `'use strict';` HERE, AND ITS ABSENCE IS THE ONE INTENTIONAL DIFFERENCE
// FROM THE CANONICAL SERVER COPY. Do not "restore" it to make the two files
// match — that would break the production build.
//
// This file shipped with it in Phase 3b (5cac111). CRA's eslint config raises
// `'use strict' is unnecessary inside of modules` for anything under src/, and
// CRA turns warnings into errors whenever CI is set — so `CI=true npm run build`
// fails outright with `Failed to compile.`, while a bare `npm run build` exits 0
// having printed only a warning.
//
// DEPLOYS WERE NOT AFFECTED IN PRACTICE — this was a latent trap, not a live
// break. It is worth removing anyway: the failure is invisible in the ordinary
// local build, it would surface on any change to how CI is set, and it would then
// originate in a file nobody had touched. Removed in Phase 3c.
// Reproduce with: CI=true npm run build
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
// WHY A COPY AND NOT AN IMPORT. CRA's ModuleScopePlugin refuses any import that
// reaches outside src/, so an admin React component cannot require the server's
// module. Passing the resolution through an HTTP call instead was rejected: the
// preview's entire job is to re-render from UNSAVED form state on every
// keystroke, and there is nothing on the server to ask about a value the admin
// has not saved yet.
//
// WHAT MAKES THIS ACCEPTABLE rather than the first step of a drift is that a
// test fails when the two copies disagree. server/test/brandingTheme.test.js
// requires both files and compares their defaults AND their resolution
// behaviour across a table of inputs. Change one without the other and the
// suite goes red naming the diverged value.
//
// That guard exists because THIS DRIFT ALREADY HAPPENED ONCE. BrandingPreview.jsx
// falls back to #012854 / #CC0000 / #D3E3F0 — Accent Roofing's navy, red and
// light blue, the platform's original single-tenant palette — while the server
// falls back to RoofMiles' #F26A1B / #1C2D4D / #FFFFFF. A contractor who had
// saved no colours saw one brand in the admin preview and a different one on
// their live surface, and neither was theirs. Nothing failed. Wiring
// BrandingPreview onto this module and deleting those three constants is
// Phase 3c.
//
// WHY CommonJS IN AN OTHERWISE-ESM src/. The drift guard is a Node test, and
// Node resolves a bare `.js` file in this package as CommonJS (package.json
// declares no "type"), so an ESM copy here could not be loaded by the very test
// that polices it. Webpack consumes named imports from CommonJS without
// ceremony, so the preview's `import { resolveBrandingTheme } from` works
// unchanged.
//
// Everything below this line is a verbatim mirror. Do not edit it here alone.
// ─────────────────────────────────────────────────────────────────────────────

// Strict six-digit hex only. The 3-digit CSS shorthand (#abc) is DELIBERATELY
// refused: BrandingPreview already enforced this exact form, and one regex
// shared across both surfaces is worth more than two that nearly agree.
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

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
const BRANDING_THEME_DEFAULTS = Object.freeze({
  companyName:     'RoofMiles',
  primaryColor:    '#F26A1B',
  secondaryColor:  '#1C2D4D',
  accentColor:     '#FDF0E7',
  backgroundColor: '#FFFFFF',
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
