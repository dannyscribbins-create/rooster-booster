// ⚠ NO `'use strict';` HERE, AND ITS ABSENCE IS THE ONE INTENTIONAL DIFFERENCE
// FROM THE CANONICAL SERVER COPY. It is a RETAINED CONVENTION, NOT A BUILD
// REQUIREMENT — rationale corrected in C/DL-3a Phase 3.
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
// WHY A COPY AND NOT AN IMPORT — CORRECTED, C/DL-3a Phase 3. This paragraph used
// to say CRA's ModuleScopePlugin refuses any import reaching outside src/, so an
// admin React component could not require the server's module. CRA is gone (Vite
// migration, 2026-08-04) and that barrier no longer exists; the live reason is
// the CommonJS one stated further down this header, which runs the other way
// round — the Node drift guard has to be able to require THIS copy.
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
// that polices it. THIS IS THE LIVE REASON THE COPY EXISTS. Vite consumes named
// imports from CommonJS without ceremony (Webpack did too — the bundler changed,
// the property did not), so the preview's `import { resolveBrandingTheme } from`
// works unchanged.
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
