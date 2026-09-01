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
export default function BrandLogo({
  src,
  alt,
  width = 120,
  // Matches the margin the four call sites already used, so adopting this
  // component is not also a layout change. FrozenAccountScreen passes 16.
  marginBottom = 20,
}) {
  const { mode } = useContext(ThemeContext);

  const image = (
    <img
      src={src}
      alt={alt}
      style={{ width, height: 'auto', display: 'block' }}
    />
  );

  if (mode !== 'dark') {
    // Light mode is byte-for-byte the previous markup: no wrapper, no plate, the
    // margin on the image itself. Adopting this component must not move a pixel
    // in the only mode that has shipped.
    return (
      <img
        src={src}
        alt={alt}
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
      style={{
        background: LIGHT_SURFACE_HEX,
        width: 'fit-content',
        margin: `0 auto ${marginBottom}px`,
        padding: '10px 14px',
        borderRadius: 12,
      }}
    >
      {image}
    </div>
  );
}
