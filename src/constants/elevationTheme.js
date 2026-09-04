// ─── Elevation and Typography Tokens — THE NON-COLOUR SIDE CHANNEL ───────────
//
// WHY THIS FILE EXISTS AND WHY IT IS NOT `RENDER_TOKEN_KEYS` (Palette-1, R-4).
//
// `themeCssVariables()` THROWS on any token that is not `#RRGGBB`, in both the
// canonical server copy and the src/ mirror. That is not an inconvenience to be
// routed around — it is the reason an emitted `--rm-text: undefined` cannot
// happen, and it was put there because a silently-missing colour is one
// invisible element on the page and nothing logged anywhere.
//
// The values this file publishes CANNOT satisfy it, by construction:
//     border  rgba(0,0,0,0.12)                       — an alpha, not a hex
//     shadow  0 1px 4px rgba(0,0,0,0.07), 0 1px 2px… — a multi-part CSS value
//     fonts   'Roboto', sans-serif                   — a string, not a colour
// So the choice was: loosen the validator, or run a second channel. Loosening it
// weakens the guarantee FOR COLOURS TOO — the validator cannot tell "this token
// is allowed to be a font" from "this token is undefined". The side channel
// keeps the colour contract strict and pays for it with one more module.
//
// ⚠ `statusTheme.js` IS THE PRECEDENT AND ITS ARGUMENT TRANSFERS EXACTLY. That
// file exists because "a single value per role is not available at any price"
// across light and dark. A BLACK-ALPHA BORDER HAS THAT PROPERTY BY
// CONSTRUCTION: composited on white it is a hairline; composited on #121B31 it
// is invisible — measured, `R.border` is 1.19:1 on the light surface and
// **1.02:1 on the dark one**, which is not a faint edge, it is no edge. The
// answer is the same answer statusTheme reached: two tables, one per mode,
// mounted by the provider, with the LIGHT value shipping as the literal
// fallback. This file deliberately copies that shape rather than inventing a
// second one — two mechanisms that work differently are two mechanisms to learn.
//
// ── ⚠ BORDERS AND FONTS DIVERGE, AND THE DIVERGENCE IS STATED RATHER THAN
// SMOOTHED OVER. Borders and shadows need a per-mode split and answer to a
// contrast floor. Fonts need NEITHER: a typeface has no mode variant and no
// contrast ratio. Forcing fonts into a light/dark table would invent a
// distinction that does not exist and imply a choice nobody makes. So FONT_VARS
// has one table, and `fontVar()` reads it directly.
//
// ⚠ NOTHING IN THIS FILE IS WIRED TO A COMPONENT YET. Palette-1 publishes the
// tokens; Palette-2 decides which of the 24 `R.bgPage` sites, the 110
// `R.border`/`R.shadow` sites and the 262 font sites consume them. Not one
// `R.*` reference changed in the commit that added this file.

// ── ⚠ THE HONEST LIMITATION ON `border`, MEASURED AND NOT BURIED ────────────
// NEITHER VALUE BELOW CLEARS THE 3:1 NON-TEXT FLOOR, AND NO HAIRLINE CAN.
// Composited over the platform surfaces:
//     light  rgba(0,0,0,0.12)      on #FFFFFF  ->  1.32:1
//     dark   rgba(255,255,255,0.18) on #121B31 ->  ~1.8:1
// Measured candidates all the way to alpha 0.24 / 0.30 top out at 1.78:1 and
// 2.68:1. A border that genuinely clears 3:1 against white is a mid-grey rule —
// a visible frame, not a hairline — and choosing that is a DESIGN decision about
// how the app looks, not a token decision. It is Palette-2's to make.
//
// ⚠ SO WHAT THIS TOKEN FIXES IS THE DARK-MODE DISAPPEARANCE, NOT THE FLOOR.
// `R.border` on the dark surface is 1.02:1 — gone. The white-alpha dark value
// takes that to roughly 1.8:1, which is a real edge. That is a genuine repair and
// it is not the same thing as meeting SC 1.4.11, and this comment exists so
// nobody reads the token's existence as the floor being met.
// ⚠ CONSEQUENCE FOR THE TWO EDGELESS ADJACENCY PAIRS: ProfileTab's nine badge
// tiles and two skeleton rows carry NO border and NO shadow, so they are defined
// purely by fill. A recess token plus a sub-3:1 border does not by itself make
// them a boundary — Palette-2 has to decide whether they get an edge at all.

// Ships as the hardcoded var() fallback, exactly as STATUS_LIGHT does: a
// component rendering with nothing mounted is on a light surface, so the light
// value is the correct thing to fall back to.
export const ELEVATION_LIGHT = Object.freeze({
  border: 'rgba(0,0,0,0.12)',
  shadow: '0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
});

// Mounted by the theme provider for dark mode.
// ⚠ WHITE-ALPHA, NOT BLACK-ALPHA, AND THAT IS THE WHOLE POINT OF SPLITTING.
// Black on near-black does not darken, it vanishes. The shadow stays black
// because a shadow is an occlusion rather than an edge — it is *supposed* to
// read as absence — but it is deepened, since a faint black shadow on a dark
// ground is doing nothing at all.
export const ELEVATION_DARK = Object.freeze({
  border: 'rgba(255,255,255,0.18)',
  shadow: '0 1px 4px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.30)',
});

// The custom-property names the provider mounts. Named here rather than spelled
// inline for the same reason STATUS_VARS and RENDER_TOKEN_VARS are: a consumer
// that reads this map cannot spell a property differently from the one mounted,
// and `--rm-onPrimary` already proved that a second naming rule fails silently.
export const ELEVATION_VARS = Object.freeze({
  border: '--rm-border',
  shadow: '--rm-shadow',
});

// ── FONTS ───────────────────────────────────────────────────────────────────
//
// ⚠ THESE ARE CONTRACTOR-SET COLUMNS THAT CURRENTLY REACH NOTHING. `font_heading`
// and `font_body` are real `contractor_settings` columns with a real editor in
// the branding panel, and their ONLY consumer is campaign email HTML. The
// referrer tree hardcodes `R.fontSans`/`R.fontBody`/`R.fontMono`, and
// `useReferrerFonts()` — which lives in `src/App.jsx`, NOT in `src/hooks/` —
// hardcodes one Google Fonts href for Montserrat + Roboto + Roboto Mono. So the
// family is hardcoded in one place and the stylesheet link in another, and
// NEITHER is contractor-aware.
//
// ⚠ THIS FILE PUBLISHES THE TOKENS AND NOTHING ELSE. The resolver does not yet
// emit the font columns at all, so there is no contractor value to mount — the
// provider mounts these defaults. Wiring the resolver, the loader and the
// painters is Palette-2.
//
// ⚠⚠ THE VERIFICATION TRAP, RECORDED BECAUSE IT MAKES A BROKEN WIRING LOOK
// CORRECT. Accent's stored fonts are Montserrat and Roboto — WHICH ARE ALSO THE
// PLATFORM DEFAULTS AND ALSO WHAT `R` HARDCODES. On that contractor a correct
// wiring and a completely unwired one render IDENTICAL PIXELS. Any future
// verification MUST set a contractor to something unmistakable — the branding
// panel's own list offers `Playfair Display` and `DM Serif Display`, both
// serifs — and watch the app follow. Checking on Accent proves nothing.
export const FONT_DEFAULTS = Object.freeze({
  heading: "'Montserrat', sans-serif",
  body: "'Roboto', sans-serif",
});

export const FONT_VARS = Object.freeze({
  heading: '--rm-font-heading',
  body: '--rm-font-body',
});

/**
 * Builds the CSS value a component declares for one elevation role: the custom
 * property, with the LIGHT value as its literal fallback.
 *
 * @param {'border'|'shadow'} role
 * @returns {string} e.g. 'var(--rm-border, rgba(0,0,0,0.12))'
 * @throws on an unknown role. A silent '' would render as no border at all —
 *         the same failure mode statusVar() refuses, and the same reason.
 */
export function elevationVar(role) {
  const name = ELEVATION_VARS[role];
  const fallback = ELEVATION_LIGHT[role];
  if (!name || !fallback) {
    throw new Error(`elevationTheme: unknown elevation role ${JSON.stringify(role)}`);
  }
  return `var(${name}, ${fallback})`;
}

/**
 * The typography counterpart. One table, no mode — see the divergence note.
 *
 * @param {'heading'|'body'} role
 * @returns {string} e.g. "var(--rm-font-body, 'Roboto', sans-serif)"
 * @throws on an unknown role, for the same reason elevationVar does.
 */
export function fontVar(role) {
  const name = FONT_VARS[role];
  const fallback = FONT_DEFAULTS[role];
  if (!name || !fallback) {
    throw new Error(`elevationTheme: unknown font role ${JSON.stringify(role)}`);
  }
  return `var(${name}, ${fallback})`;
}
