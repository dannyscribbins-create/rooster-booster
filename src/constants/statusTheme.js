// ─── Semantic Status Tokens ───────────────────────────────────────────────────
//
// WHY THIS FILE EXISTS AND WHY IT IS SEPARATE FROM THE BRAND TOKENS.
// The theme engine (src/utils/themeTokens.js) derives its render tokens from a
// contractor's brand — see RENDER_TOKEN_KEYS for the current set. NONE of them
// is a status colour: there is no red, green or amber anywhere in that set,
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
//     R.emeraldText #065F46  7.68:1 on white   |  2.23:1 on dark   FAIL
//     AD.greenText #7DD3AA   1.78:1 on white   |  9.59:1 on dark
//     AD.red2Text  #F87171   2.77:1 on white   |  6.19:1 on dark
//
// Not one candidate clears WCAG AA on both. So a single value per role is not
// available at any price, and the split below is forced rather than stylistic.
//
// THE CONTRACT. The LIGHT values are what ship as the hardcoded var() fallbacks
// inside the primitives; the DARK values are mounted by the theme provider in
// 3b/3c. This is the same fallback-is-light / dark-arrives-with-the-mount
// arrangement the brand tokens already have — an unmounted page is a light
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

// Ships as the hardcoded var() fallback inside each primitive, via statusVar().
// No exceptions — warningText was one until ABR 6B step 5; see THE LOCKEDSECTION
// INVERSION below STATUS_VARS for why it was and why it is not.
export const STATUS_LIGHT = Object.freeze({
  danger:      '#DC2626',   // fill/accent   — 4.83:1 on #FFFFFF
  dangerText:  '#B91C1C',   // text          — 6.47:1 on #FFFFFF
  success:     '#16A34A',   // fill/accent   — 3.30:1, graphic threshold only, never text
  successText: '#15803D',   // text          — 5.02:1 on #FFFFFF
  warning:     '#D97706',   // fill/accent   — 3.10:1, graphic threshold only, never text
  warningText: '#B45309',   // text          — 4.87:1 on #FFFFFF
});

// Mounted by the theme provider for dark mode. It is here rather than in the
// provider so the two halves of the ruling live in one place and cannot drift.
//
// ⚠ ThemeProvider IS THE ONLY READER. LockedSection read warningText out of this
// table directly from 4B until ABR 6B step 5 — that was the inversion, and it is
// over. A second direct consumer appearing here is worth a hard look.
export const STATUS_DARK = Object.freeze({
  danger:      '#EF4444',   // fill/accent   — 4.55:1 on #121B31
  dangerText:  '#F87171',   // text          — 6.19:1 on #121B31
  success:     '#16A34A',   // fill/accent   — 5.19:1 on #121B31 (same hex reads well in both)
  successText: '#7DD3AA',   // text          — 9.59:1 on #121B31
  warning:     '#D97706',   // fill/accent   — same hex both modes, as success is
  warningText: '#fbbf24',   // text/icon     — 10.4:1 on #121B31
  //   ⚠ NOT === AD.amberText. 5.1 moved that token to #92400E and the two
  //   decoupled; the identity is not a fact about this value any more.
  //   #121B31 is the REFERRER DARK SURFACE, which is the only place this value
  //   is used — ThemeProvider mounts it for dark mode. Nothing falls back to it.
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

// ─── THE LOCKEDSECTION INVERSION — CLOSED IN ABR 6B STEP 5 ──────────────────
//
// THERE IS NO EXCEPTION HERE ANY MORE. This note is kept because several files
// point at it by name, and because the rule it turns on is worth stating once.
//
// THE RULE: THE FALLBACK IS THE VALUE THAT IS CORRECT WHERE THE COMPONENT
// ACTUALLY RENDERS WITH NO VARIABLES MOUNTED. statusVar() encodes it as "the
// light value", because a primitive with nothing mounted over it is on a light
// surface, and every consumer now goes through statusVar().
//
// WHAT THE INVERSION WAS. LockedSection was the one component the rule was
// applied to differently: from C/DL-3a Phase 4B it declared the STATUS_DARK
// warningText (#fbbf24) directly, because its only live render path was the
// admin panel and the panel was dark. That was a correct application of the rule
// to the surface as it then stood.
//
// ⚠ WHAT MADE IT A DEFECT, AND THE REASON THIS NOTE EXISTS AT ALL. ABR Phase 5
// repainted the panel and 5.1 collapsed AD.bgCard, the lock card itself, to
// #FFFFFF — leaving the icon at 1.67:1, under the 3:1 GRAPHIC floor, for the
// whole of that interval. THE RULE DID NOT FAIL. IT WAS APPLIED ONCE AND NEVER
// RE-APPLIED WHEN THE SURFACE MOVED, and nothing announced that. Four separate
// records went on instructing the next session to keep the dark value.
//
// Step 5 routed the icon through statusVar() rather than hardcoding #B45309,
// which ends the exception instead of relocating it: the right value now falls
// out of the same helper the rest of the shelf uses, and keeps falling out if
// the light table moves.
//
// ⚠ STATUS_DARK.warningText ABOVE WAS NEVER THE PROBLEM AND IS UNCHANGED. It is
// correct at 10.4:1 where ThemeProvider mounts it for referrer dark mode, which
// is now its only consumer. Editing it would have fixed the panel by breaking
// the app; LockedSection.test.jsx's "adds warning to all three tables" case
// pins it against that.
//
// Not observed in a browser at any point — the ratios are arithmetic over the
// declared values. LockedSection.test.jsx's contrast case makes the same claim
// with the same limit, and guards the floor from here on.
// ─────────────────────────────────────────────────────────────────────────────

// ─── STATUS_BANNER — THE GROUND AN INLINE STATUS MESSAGE SITS ON (R-1) ──────
//
// ⚠ A STATUS FILL IS NOT A BACKGROUND FOR TEXT, AND THIS CONSTANT EXISTS BECAUSE
// THREE SCREENS ASSUMED IT WAS.
//
// LoginScreen, ResetPinScreen and ChoiceScreen each declared
// `backgroundColor: 'var(--rm-danger, #FEE2E2)'` with
// `color: 'var(--rm-danger-text, #B91C1C)'`. The FALLBACK pair is a pale tint
// under dark red — 5.30:1, perfectly sensible, and it never painted. The
// provider mounts --rm-danger as STATUS_LIGHT.danger (#DC2626), a SATURATED
// FILL, so what rendered was dark red on bright red: 1.34:1, on the login
// screen's failed-login message. The success banners rendered at 1.52:1.
//
// ⚠ THE DEFECT CLASS: A FALLBACK THAT IS CORRECT ONLY WHILE THE VARIABLE IS
// ABSENT. Same shape as LockedSection's scrim, which falls back to a navy and
// turns into a white veil over gated content the moment --rm-bg is mounted over
// it. In both cases the source reads correctly and the screen does not.
//
// THE FIX, AND WHY IT IS THIS AND NOT A TINT. The banner's ground is the
// SURFACE; the status colour becomes its EDGE, and the text keeps the *Text
// tone it already had. Every resulting ratio is a number statusTheme.js already
// records as that value's own design point:
//
//     light   dangerText  #B91C1C on surface #FFFFFF   6.47:1   (text, 4.5)
//             successText #15803D on surface #FFFFFF   5.02:1   (text, 4.5)
//             danger edge #DC2626 on surface #FFFFFF   4.83:1   (graphic, 3)
//             success edge #16A34A on surface #FFFFFF  3.30:1   (graphic, 3)
//     dark    dangerText  #F87171 on surface #121B31   6.19:1
//             successText #7DD3AA on surface #121B31   9.59:1
//
// ⚠ STATUS_TINT WAS TRIED FIRST AND MEASURED SHORT — RECORDED SO IT IS NOT
// RE-PROPOSED AS THE OBVIOUS ANSWER. Compositing STATUS_TINT.success (0.12
// alpha) over #FFFFFF gives #E3F4E9, and successText on it is 4.39:1 — under
// the 4.5 floor. STATUS_TINT is correct for what its two consumers actually do
// with it: it grounds a 44px ICON BADGE, which answers to the 3:1 graphic
// threshold. It has never carried body text, and it should not start.
//
// ⚠ AND THE FALLBACKS BELOW ARE THE MOUNTED VALUES, NOT DIFFERENT ONES. That is
// the whole rule this constant enforces: an unmounted page is a light page, so
// the fallback must be what the light mount would have produced. A fallback the
// mount contradicts is the bug, not a safety net.
export const STATUS_BANNER = Object.freeze({
  danger: Object.freeze({
    backgroundColor: 'var(--rm-surface, #FFFFFF)',
    border: `1px solid var(${STATUS_VARS.danger}, ${STATUS_LIGHT.danger})`,
  }),
  success: Object.freeze({
    backgroundColor: 'var(--rm-surface, #FFFFFF)',
    border: `1px solid var(${STATUS_VARS.success}, ${STATUS_LIGHT.success})`,
  }),
});

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
