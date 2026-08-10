// ─── Semantic Status Tokens ───────────────────────────────────────────────────
//
// WHY THIS FILE EXISTS AND WHY IT IS SEPARATE FROM THE FIVE BRAND TOKENS.
// The theme engine (src/utils/themeTokens.js) derives exactly five render tokens
// from a contractor's brand — primary, secondary, bg, surface, text. NONE of
// them is a status colour: there is no red, green or amber anywhere in that set,
// and there cannot be, because "danger" is not a thing a brand palette implies.
// Status is a SEMANTIC CONSTANT, not a derived value, so it deliberately does
// NOT go through deriveThemeTokens (ruling: C/DL-3a Phase 4A).
//
// THE PROBLEM THIS FILE SOLVES — measured, not assumed. The existing status
// colours in the codebase come in two incompatible sets: R (src/constants/
// theme.js) is tuned for LIGHT surfaces and AD (adminTheme.js) for DARK ones,
// and each set is unusable on the other's surface. Contrast ratios measured
// during Phase 4A Step 1, against #FFFFFF and against two genuinely derived dark
// surfaces (RoofMiles #121B31, a navy-brand contractor #112032):
//
//     R.greenText  #15803D   5.02:1 on white   |  3.41:1 on dark   FAIL
//     R.emeraldTxt #065F46   7.68:1 on white   |  2.23:1 on dark   FAIL
//     AD.greenText #7DD3AA   1.78:1 on white   |  9.59:1 on dark
//     AD.red2Text  #F87171   2.77:1 on white   |  6.19:1 on dark
//
// Not one candidate clears WCAG AA on both. So a single value per role is not
// available at any price, and the split below is forced rather than stylistic.
//
// THE CONTRACT. The LIGHT values are what ship as the hardcoded var() fallbacks
// inside the primitives; the DARK values are mounted by the theme provider in
// 3b/3c. This is the same fallback-is-light / dark-arrives-with-the-mount
// arrangement the five brand tokens already have — an unmounted page is a light
// page, so the light value is the correct thing to fall back to.
//
// ⚠ HONEST LIMITATION, STATED RATHER THAN BURIED. Unlike --rm-text, which the
// engine NUDGES until it provably clears TEXT_CONTRAST_MIN against that
// contractor's own surface, these are FIXED CONSTANTS while the dark surface is
// DERIVED PER CONTRACTOR. They therefore carry NO per-contractor AA guarantee.
// What makes that acceptable rather than reckless is how little room the derived
// dark surface has to move: it is saturation-capped (DARK_BG_MAX_SATURATION) and
// pinned near-black (DARK_BG_TARGET_L + DARK_SURFACE_LIFT_L), so across the two
// test brands above every candidate drifted by less than 0.25:1. Small, but not
// zero. If a contractor ever reports an unreadable status colour, this is the
// file that was wrong, and the fix is to derive these too — not to nudge a hex.

// Ships as the hardcoded var() fallback inside each primitive.
//
// ⚠ WITH ONE DELIBERATE EXCEPTION, warningText — see the LOCKEDSECTION INVERSION
// note below STATUS_VARS before "fixing" anything that looks inconsistent.
export const STATUS_LIGHT = Object.freeze({
  danger:      '#DC2626',   // fill/accent   — 4.83:1 on #FFFFFF
  dangerText:  '#B91C1C',   // text          — 6.47:1 on #FFFFFF
  success:     '#16A34A',   // fill/accent   — 3.30:1, graphic threshold only, never text
  successText: '#15803D',   // text          — 5.02:1 on #FFFFFF
  warning:     '#D97706',   // fill/accent   — 3.10:1, graphic threshold only, never text
  warningText: '#B45309',   // text          — 4.87:1 on #FFFFFF
});

// Mounted by the theme provider in 3b/3c. Nothing reads this in Phase 4A — it is
// here so the two halves of the ruling live in one place and cannot drift apart.
//
// Phase 4B DOES read one value from this table directly: LockedSection's lock
// icon. Again — see the inversion note below.
export const STATUS_DARK = Object.freeze({
  danger:      '#EF4444',   // fill/accent   — 4.55:1 on #121B31
  dangerText:  '#F87171',   // text          — 6.19:1 on #121B31
  success:     '#16A34A',   // fill/accent   — 5.19:1 on #121B31 (same hex reads well in both)
  successText: '#7DD3AA',   // text          — 9.59:1 on #121B31
  warning:     '#D97706',   // fill/accent   — same hex both modes, as success is
  warningText: '#fbbf24',   // text/icon     — 10.4:1 on #121B31; === AD.amberText
});

// ONE VALUE FOR BOTH MODES, and the translucency is the whole reason. A solid
// tint has the same light/dark problem as the text tones above; an alpha wash
// composites against whatever surface it lands on — a pale pink on white, a dark
// maroon on near-black. So these need no split and no CSS variable at all.
// Same technique AD already uses for its own *Bg values.
export const STATUS_TINT = Object.freeze({
  danger:  'rgba(220,38,38,0.12)',
  success: 'rgba(22,163,74,0.12)',
});

// The custom-property names the provider will mount in 3b/3c. Named here rather
// than spelled inline in four components so the property set cannot drift from
// the token set — the same reason themeTokens.js builds its names from
// RENDER_TOKEN_KEYS.
export const STATUS_VARS = Object.freeze({
  danger:      '--rm-danger',
  dangerText:  '--rm-danger-text',
  success:     '--rm-success',
  successText: '--rm-success-text',
  warning:     '--rm-warning',
  warningText: '--rm-warning-text',
});

// ─── THE LOCKEDSECTION INVERSION — DELIBERATE, DO NOT "CORRECT" ──────────────
//
// The contract stated at the top of this file is that the LIGHT value ships as
// the hardcoded var() fallback, because an unmounted page is a light page. That
// reasoning is sound for every rep-side primitive on the shelf, and statusVar()
// below still encodes it for all of them.
//
// LockedSection (src/components/shared/LockedSection.jsx) is the one component
// for which the premise is FALSE. Its only live render path today is the ADMIN
// panel — a dark surface — where an admin without the `team` flag opens Manage
// Team. So its unmounted home is dark, and it declares its lock icon as
//
//     var(--rm-warning-text, #fbbf24)        i.e. the STATUS_DARK value
//
// rather than going through statusVar(), which would hand back the light #B45309
// and repaint a live admin screen with a tone that fails contrast on it.
//
// THIS IS NOT statusVar() BEING WRONG, and the fix is not to add a mode argument
// to it. The rule underneath both cases is the same one: THE FALLBACK IS THE
// VALUE THAT IS CORRECT WHERE THE COMPONENT ACTUALLY RENDERS WITH NO VARIABLES
// MOUNTED. For four rep primitives that is the light value; for this one admin
// primitive it is the dark one. If LockedSection is ever re-homed onto a light
// rep surface as its primary residence, that fallback flips with it — and
// src/components/shared/LockedSection.test.jsx fails the moment it does,
// naming this note.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the CSS value a primitive declares for one semantic status role:
 * the custom property, with the LIGHT value as its literal fallback.
 *
 * @param {'danger'|'dangerText'|'success'|'successText'} role
 * @returns {string} e.g. 'var(--rm-danger-text, #B91C1C)'
 * @throws on an unknown role. A silent '' would render as no colour at all —
 *         invisible text, nothing logged, exactly the failure mode
 *         themeCssVariables refuses for the same reason.
 */
export function statusVar(role) {
  const name = STATUS_VARS[role];
  const fallback = STATUS_LIGHT[role];
  if (!name || !fallback) {
    throw new Error(`statusTheme: unknown status role ${JSON.stringify(role)}`);
  }
  return `var(${name}, ${fallback})`;
}
