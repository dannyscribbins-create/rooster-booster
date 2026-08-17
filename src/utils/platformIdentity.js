// ─────────────────────────────────────────────────────────────────────────────
// THE ADMIN PANEL'S IDENTITY LINE — "RoofMiles · Acme Roofing"
//
// Admin Brand Retirement Phase 4. Two headers carried the literal
// "Rooster Booster · Accent Roofing" — AdminDashboard's page header and
// AdminSettings' section header. They were the panel's two most-viewed strings
// and appeared on no inventory list, which is the finding that produced the
// walking sweep.
//
// ── THE DESIGN RULE THIS ENCODES (spec §1, verbatim) ───────────────────────
//   "RoofMiles is the environment. The contractor gets a subtle branded touch
//    that is personal to them."
//
// So the platform is named FIRST and always; the contractor is named BESIDE it,
// never INSTEAD of it. An admin logging into RoofMiles should know they are in
// RoofMiles — it is the product they pay for, and it will later carry billing,
// support and tier upgrades. Full white-label here would make the platform
// invisible to the person writing the cheque.
//
// ── ⚠ WHY THE PLATFORM NAME IS NOT WRITTEN HERE AS A LITERAL ───────────────
// It is read from resolveBrandingTheme's own defaults, which is where the
// platform's identity already lives and what every unbranded surface already
// resolves to. Writing 'RoofMiles' here would create a second copy of a name
// that is mid-migration away from a third one ("Rooster Booster") — and the
// canonical-default rule says the copy that reaches production users is
// canonical and the other is a copy that has drifted. There is no second copy.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveBrandingTheme } from './brandingTheme.mjs';

/** The platform's own name, from the one place that defines it. */
export const PLATFORM_NAME = resolveBrandingTheme(null).companyName;

/**
 * Builds the panel's identity line from resolved branding.
 *
 * ⚠ THE SUPPRESSION IS THE INTERESTING HALF. When branding has not arrived yet,
 * or the contractor genuinely has no name of their own, `companyName` IS the
 * platform default — and naively joining would render "RoofMiles · RoofMiles".
 * Returning the platform name alone is D-I's designed state, not a fallback:
 * the panel paints at once as "the RoofMiles admin panel" and the contractor
 * joins on the repaint /api/admin/me already causes. Never a wrong name, never
 * a spinner, never a doubled one.
 *
 * @param {{companyName?: string}|null|undefined} branding - useAdminBranding()'s
 *        branding object.
 * @returns {string} "RoofMiles · Acme Roofing", or "RoofMiles" alone.
 */
export function platformIdentityLine(branding) {
  const company = branding?.companyName;
  if (!company || company === PLATFORM_NAME) return PLATFORM_NAME;
  return `${PLATFORM_NAME} · ${company}`;
}
