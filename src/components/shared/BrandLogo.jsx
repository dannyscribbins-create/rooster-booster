import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';
import { LIGHT_SURFACE_HEX } from '../../utils/themeTokens.mjs';

// ─── BrandLogo — the contractor's mark, safe in both modes ───────────────────
//
// C/DL-3c Phase 1a, Ruling 3. ONE TREATMENT, NOT FOUR EDITS. Four surfaces
// rendered a bare <img> on var(--rm-surface) — LoginScreen, ResetPinScreen,
// FrozenAccountScreen and RepShell. Four sites carrying the same defect
// are four sites that drift, so the treatment lives here and they call it.
//
// ── THE DEFECT ───────────────────────────────────────────────────────────────
// In light mode the surface is #FFFFFF and any ordinary logo reads against it.
// In dark mode `surface` derives to a near-black — #121B31 for the platform
// palette, #112032 for a navy brand — and a dark-inked logo, which is what most
// roofing contractors upload, disappears into it. Nothing errors; the mark is
// simply not there.
//
// ── THE FIX, AND WHY IT IS A PLATE ───────────────────────────────────────────
// In dark mode the logo sits on a plate painted LIGHT_SURFACE_HEX — the same
// colour deriveLightTokens uses for the light-mode card. In light mode nothing
// is added at all.
//
// ⚠ WE CANNOT KNOW HOW BRIGHT THE ARTWORK IS, and that is what rules out the
// alternatives. The logo is a remote image, so reading its pixels on a canvas is
// blocked by CORS; there is no dark-mode upload field to swap to; and a CSS
// filter (invert, brightness) mangles a colour logo rather than adapting it.
//
// ⚠ SO THE ARGUMENT IS ABOUT WHAT ALREADY EXISTS, NOT ABOUT WHAT WE CAN DETECT.
// LIGHT MODE IS THE ONLY MODE THAT HAS EVER SHIPPED. Every logo currently in the
// system is therefore already known-good on a light surface — a contractor who
// had uploaded white artwork would have an invisible logo TODAY, in the only
// mode anyone can reach, and would have said so. A plate that reproduces the
// light surface is correct for every logo that can currently exist.
//
// ⚠⚠ THE EXPIRY CONDITION, WRITTEN HERE BECAUSE THIS IS WHERE IT WILL BE
// INHERITED. The argument above holds while `contractor_settings` has exactly
// ONE LOGO SLOT. It dies the moment a second, dark-artwork upload field is
// added: white artwork becomes reachable, and this plate would render it
// invisible in precisely the mode it was uploaded for — the current defect,
// inverted, for the contractors who took the trouble.
//
// **If you are adding a dark-mode logo upload, this component is part of that
// change, not a thing that keeps working alongside it.** Prefer the stored dark
// artwork when present and fall back to the plate when it is not.
//
// A safety argument whose precondition is not written beside the code gets
// inherited after the precondition lapses, which is why this paragraph is here
// and not only in a session report. BrandLogo.test.jsx asserts it is still here.
//
// ── THE MODE COMES FROM THE PROVIDER, AND THE NO-PROVIDER CASE IS DELIBERATE ─
// ThemeContext carries a real default (DEFAULT_THEME_MODE, 'light'), so a
// BrandLogo rendered outside the provider reports light and draws no plate.
// That is the correct fallback by statusTheme.js's rule: the fallback is the
// value that is right where the component actually renders with nothing mounted,
// and a component with no --rm-* above it is on a light surface.
// ── ⚠ `onError` IS A REPORT, NOT A DECISION (Canvass-2, amendment A34.11) ────
// This component knows the mark FAILED TO LOAD; it does not know what should be
// drawn instead, because that is the absence rule and the absence rule lives in
// BrandMark — one place, deliberately, after the codebase drifted to three
// mutually inconsistent NULL-logo behaviours. So this reports upward and renders
// nothing different itself. ⚠ Do NOT add a fallback here: a second site deciding
// what an absent mark looks like is the exact drift BrandMark was written to end.
// ── ⚠ `stableBox` — THE PLATE CHANGES THE BOX, AND ON A SHELL THAT MATTERS ───
//
// Canvass-9a, and it is a MEASURED defect rather than a refinement. The plate wraps
// the mark in a div padded `10px 14px`, so in dark mode the header is **20px taller
// than in light** — and because the header is the first thing in a column, that 20px
// displaces every element below it. Measured on the rendered node, palette-beta, one
// route, one scroll position, fonts equal in both runs:
//
//     header height   dark 87.59   light 67.59   Δ +20
//     main top        dark 145.59  light 125.59  Δ +20
//     h1 top          dark 169.59  light 149.59  Δ +20
//
// ⚠ IT IS A SINGLE DISPLACEMENT, NOT AN ACCUMULATION — the offset is introduced at
// the header and every later number carries the same 20, unchanged. Proven by
// zeroing ONLY this padding on the rendered node: the dark header collapsed to
// 67.59 and `main` to 125.59, matching light exactly.
//
// ⚠ AND THE CAUSE IS THE PADDING, NOT SPACE THAT "FAILED TO COLLAPSE". In light mode
// this component returns a BARE IMAGE and the wrapper does not exist at all; the
// `<img>` itself is byte-identical in both modes (39.59 × 132 at the measured size).
// The whole 20px is this div's own vertical padding.
//
// ── WHY IT IS OPT-IN AND NOT SIMPLY FIXED FOR EVERYONE ──────────────────────
// This component has FOUR call sites and only one of them is a shell. On
// LoginScreen, ResetPinScreen and FrozenAccountScreen a person never sees the same
// screen in both modes back to back — there is nothing to compare against, so a
// 20px difference is unobservable there. On the rep shell the mode is a TOGGLE the
// rep flips on the Profile tab and then watches the app repaint, which is precisely
// the condition under which the jump is visible. **The requirement belongs to the
// surface that has it.**
//
// ⚠ AND THIS FILE'S OWN HEADER FORBIDS THE ALTERNATIVE IN TERMS: *"Light mode is
// byte-for-byte the previous markup … Adopting this component must not move a pixel
// in the only mode that has shipped."* Reserving the box unconditionally would add
// 20px to three shipped auth screens as a side effect of fixing a fourth. The flag
// keeps that promise while making the box identical where identity is required.
//
// WHEN SET: light mode renders the SAME wrapper with the SAME padding and a
// transparent background, so the two branches produce the same box BY
// CONSTRUCTION rather than by two numbers someone has to keep equal.
//
// ⚠ THE ATTRIBUTES SAY WHAT IS TRUE. `data-rm-logo-box` marks the wrapper in both
// modes — it is the box. `data-rm-logo-plate` marks it ONLY when it actually paints
// a plate, which is dark only, so every existing assertion that a plate is absent in
// light stays correct and keeps meaning what it meant.
export default function BrandLogo({
  src,
  alt,
  width = 120,
  // Matches the margin the four call sites already used, so adopting this
  // component is not also a layout change. FrozenAccountScreen passes 16.
  marginBottom = 20,
  onError,
  stableBox = false,
  boxPadding = '10px 14px',
}) {
  const { mode } = useContext(ThemeContext);

  const image = (
    <img
      src={src}
      alt={alt}
      onError={onError}
      style={{ width, height: 'auto', display: 'block' }}
    />
  );

  // ⚠ ONE DECLARATION, READ BY BOTH BRANCHES. The whole point is that the dark plate
  // and the reserved light box cannot have different padding — so the number is
  // written once and neither branch may restate it.
  //
  // ⚠ IT IS A DEFAULTED PROP SINCE 9b PART 0(c), AND THE DEFAULT IS THE SHIPPED VALUE.
  // The rep header needs a tighter box than a full-page auth card does: its mark is
  // 19.8px tall, where `10px 14px` is more than half the logo's own height again.
  // The three auth call sites pass nothing and are therefore BYTE-IDENTICAL — which is
  // the promise this file's header makes in terms ("Adopting this component must not
  // move a pixel in the only mode that has shipped"), and the same reason `stableBox`
  // is opt-in rather than universal.
  // ⚠ STILL ONE VALUE PER RENDER, WHICH IS WHAT THE PARITY FENCE DEPENDS ON: both
  // branches read this same binding, so light and dark cannot diverge whatever a
  // caller passes. Making it a prop widens what the value can BE; it does not
  // reintroduce two places for it to be written.
  const BOX_PADDING = boxPadding;

  if (mode !== 'dark' && stableBox) {
    return (
      <div
        data-rm-logo-box=""
        style={{
          background: 'transparent',
          width: 'fit-content',
          margin: `0 auto ${marginBottom}px`,
          padding: BOX_PADDING,
          borderRadius: 12,
        }}
      >
        {image}
      </div>
    );
  }

  if (mode !== 'dark') {
    // Light mode is byte-for-byte the previous markup: no wrapper, no plate, the
    // margin on the image itself. Adopting this component must not move a pixel
    // in the only mode that has shipped.
    return (
      <img
        src={src}
        alt={alt}
        onError={onError}
        style={{ width, height: 'auto', display: 'block', margin: `0 auto ${marginBottom}px` }}
      />
    );
  }

  return (
    // width:'fit-content' so the plate hugs the mark rather than becoming a full
    // bleed band across the card. data-rm-logo-plate is the handle tests and a
    // real browser use to find it, matching data-rm-theme on the provider.
    <div
      data-rm-logo-plate=""
      data-rm-logo-box=""
      style={{
        background: LIGHT_SURFACE_HEX,
        width: 'fit-content',
        margin: `0 auto ${marginBottom}px`,
        padding: BOX_PADDING,
        borderRadius: 12,
      }}
    >
      {image}
    </div>
  );
}
