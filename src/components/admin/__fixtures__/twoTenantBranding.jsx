// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BRAND RETIREMENT — PHASE 3 — THE REACT TWO-TENANT FIXTURE
//
// Governing spec: ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md, D-N and Phase 4's first
// guard. Phase 0 found that the SERVER has a two-tenant fixture
// (adminSettingsBranding.test.js:53-77) and the REACT side has none. This is it.
//
// ⚠ NOTHING HERE ASSERTS ANYTHING ABOUT RENDERING, AND NOTHING SHOULD UNTIL
// PHASE 4. No admin surface reads branding yet — Phase 2B wired the seam and
// stopped deliberately. A render assertion written today would be asserting
// Phase 4's work and would fail for the right reason in the wrong phase.
//
// ── THE QUESTION THIS FIXTURE MAKES DECIDABLE ──────────────────────────────
// Not "did a hardcoded literal disappear". That one is already answered, by the
// walking sweep in adminBranding.test.jsx, and answering it twice would be
// worth nothing. The question here is the one a sweep structurally cannot
// reach:
//
//        DID TENANT A'S PANEL RENDER TENANT B'S BRAND?
//
// A single-tenant fixture cannot tell "reads the branding context" from
// "happens to be hardcoded to the value I chose" — and after Phase 4 the value
// most likely to be hardcoded is no longer Accent's, it is whichever tenant the
// test author typed first. That is why the server fixture keeps tenant B FULLY
// BRANDED as a permanent contamination source rather than as a second happy
// path, and why this mirrors it exactly.
//
// ── HOW TO USE IT IN PHASE 4 ───────────────────────────────────────────────
//   1. Render the component under `TENANT_A` and assert tenant A's value shows.
//   2. Re-render under `TENANT_B` and assert THE VALUE CHANGED. Asserting "a
//      logo renders" passes against a hardcoded one; asserting the src is
//      DIFFERENT between two tenants does not.
//   3. Render under `TENANT_A_NO_LOGO` and assert NO <img> and NO divider —
//      not "a fallback appears". Identity-bearing values get no defaults, and
//      D-D's lockup rule is that the divider goes with the logo.
//   4. Sweep `CONTAMINANTS` against the rendered output of steps 1 and 3. Every
//      one of them is a value ONLY tenant B holds, so a hit is a cross-tenant
//      leak by construction rather than by interpretation.
//
// ── WHY THIS FILE IS NOT A .test. FILE ─────────────────────────────────────
// It holds no tests. Its own properties are proven next door in
// twoTenantFixture.test.jsx — a fixture whose tenants accidentally agreed on a
// field would make every "A did not see B" assertion built on it vacuous, so
// the distinctness is asserted rather than eyeballed.
//
// It also imports NO test library. The provider below is production code and
// React is production code; the caller supplies `render`. That keeps a
// devDependency out of a module sitting inside src/components/.
//
// ⚠ AND IT IS DELIBERATELY INSIDE A SWEPT DIRECTORY. src/components/admin/ is
// walked by adminBranding.test.jsx, and this file is not named `.test.`, so it
// is swept like any other module. A fixture that quietly carried Accent's phone
// number would otherwise be the one place in the admin tree a literal could
// hide from the sweep that exists to find it.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveBrandingTheme } from '../../../utils/brandingTheme.mjs';
import BrandingProvider from '../../shared/BrandingProvider';

// ── THE TWO TENANTS ──────────────────────────────────────────────────────────
// Built through resolveBrandingTheme from raw contractor_settings-shaped input,
// NOT hand-written as resolved objects. The panel receives this exact shape from
// GET /api/admin/me, which resolves server-side through the same function — so a
// hand-written literal would be a second copy of the shape, free to drift from
// the one production uses. This is the mirror rule brandingTheme.mjs already
// lives under, applied to the fixture.
//
// ⚠ EVERY FIELD DIFFERS BETWEEN THE TWO, AND NONE MATCHES A PLATFORM DEFAULT.
// Both properties are asserted in twoTenantFixture.test.jsx, because either one
// silently failing turns "A rendered B's brand" or "A rendered nothing at all"
// into a passing test. `.test.invalid` hosts throughout: RFC 2606 reserves the
// TLD, so a URL that escapes into a real request resolves nowhere.
const RAW_A = Object.freeze({
  company_name:     'Alpha Roofing Co',
  app_display_name: 'Alpha Rewards',
  primary_color:    '#111AAA',
  secondary_color:  '#222BBB',
  accent_color:     '#333CCC',
  landing_bg_color: '#444DDD',
  logo_url:         'https://cdn.test.invalid/alpha/logo.png',
  company_phone:    '555-0101',
  company_email:    'owner@alpha.test.invalid',
  review_url:       'https://reviews.test.invalid/alpha',
});

const RAW_B = Object.freeze({
  company_name:     'Beta Exteriors LLC',
  app_display_name: 'Beta Perks',
  primary_color:    '#999EEE',
  secondary_color:  '#888FFF',
  accent_color:     '#777ABC',
  landing_bg_color: '#666DEF',
  logo_url:         'https://cdn.test.invalid/beta/logo.png',
  company_phone:    '555-0202',
  company_email:    'owner@beta.test.invalid',
  review_url:       'https://reviews.test.invalid/beta',
});

/** Tenant A — the tenant under test. Fully branded. */
export const TENANT_A = Object.freeze(resolveBrandingTheme(RAW_A));

/**
 * Tenant B — THE CONTAMINATION SOURCE, never a second happy path.
 *
 * It exists so that "tenant A saw someone else's brand" is a question with a
 * yes-or-no answer, and it is fully branded for the same reason the server
 * fixture's tenant B is: a sparse contaminant leaks nothing detectable.
 */
export const TENANT_B = Object.freeze(resolveBrandingTheme(RAW_B));

/**
 * Tenant A with NO LOGO — and this is the PRIMARY fixture for the lockup, not
 * an edge case.
 *
 * `logoUrl` is deliberately allowed to be null (identity-bearing values get no
 * defaults), and C/DL-3b's fifth and only production-reaching vacuity instance
 * was a test that asserted a component's DEFAULTED fields while its
 * NON-DEFAULTED one rendered a dead `null` target. Every other field stays
 * populated so the absence is isolated to the one value under test.
 */
export const TENANT_A_NO_LOGO = Object.freeze(
  resolveBrandingTheme({ ...RAW_A, logo_url: null })
);

/**
 * The platform's own resolved theme — no contractor in it.
 *
 * Needed as a THIRD state: "tenant A's panel" and "an unbranded panel" are
 * different failures, and a test that only knows about A and B reports the
 * second one as the first.
 */
export const NEUTRAL = Object.freeze(resolveBrandingTheme(null));

/**
 * Every value that belongs to TENANT B AND TO NOBODY ELSE.
 *
 * Sweep this against output rendered under tenant A: a hit is a cross-tenant
 * leak, full stop. Enumerated exhaustively rather than sampled, because a
 * partial leak — the right name beside the wrong logo — is still a white-label
 * breach, and is the shape a half-wired component actually produces.
 *
 * @type {ReadonlyArray<string>}
 */
export const CONTAMINANTS = Object.freeze([
  TENANT_B.companyName,
  TENANT_B.programName,
  TENANT_B.primaryColor,
  TENANT_B.secondaryColor,
  TENANT_B.accentColor,
  TENANT_B.backgroundColor,
  TENANT_B.logoUrl,
  TENANT_B.phone,
  TENANT_B.email,
  TENANT_B.reviewUrl,
]);

/**
 * Wraps `children` in a BrandingProvider publishing exactly `branding`.
 *
 * ⚠ USES `supplied`, WHICH IS THE MODE THE PANEL ITSELF USES. The alternative —
 * letting the D4 chain resolve — would answer "who is this contractor" from the
 * URL, the hostname and a stored hint, none of which the admin panel consults
 * (D-H). A fixture that resolved differently from production would prove
 * something about a path the panel never takes.
 *
 * `source: 'session'` matches what Phase 2B publishes when /api/admin/me
 * answers, so a consumer branching on `source` sees the production value.
 *
 * @param {object} branding - one of TENANT_A / TENANT_B / TENANT_A_NO_LOGO /
 *        NEUTRAL, or any resolveBrandingTheme output.
 * @param {React.ReactNode} children
 * @returns {React.ReactElement} ready to hand to render().
 */
export function underTenant(branding, children) {
  return (
    <BrandingProvider supplied={{ branding, source: 'session' }}>
      {children}
    </BrandingProvider>
  );
}
