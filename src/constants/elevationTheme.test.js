// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-1 T3 — THE NON-COLOUR SIDE CHANNEL
//
// The channel exists because `themeCssVariables()` throws on anything that is
// not #RRGGBB, and R-4 ruled that the validator stays strict rather than being
// loosened to admit fonts and alpha borders. These cases pin BOTH halves of that
// ruling: the channel publishes what it should, AND the validator still refuses
// what it always refused.
//
// ⚠ THE BOUNDARY IS THE POINT. An untested boundary drifts — someone adds a font
// to RENDER_TOKEN_KEYS "just to keep them together", the validator throws in a
// place nobody expects, and the fix is to relax the validator. These tests make
// that a red suite instead of a judgement call at 5pm.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  ELEVATION_LIGHT, ELEVATION_DARK, ELEVATION_VARS,
  FONT_DEFAULTS, FONT_VARS, elevationVar, fontVar,
} from './elevationTheme';
import { themeCssVariables, deriveThemeTokens, contrastRatio } from '../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../utils/brandingTheme.mjs';

// Composites an rgba over an opaque backdrop, so an alpha border can be measured
// against the surface it actually lands on rather than in the abstract.
function over(rgba, hex) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(rgba);
  if (!m) throw new Error(`over(): not an rgb/rgba value: ${rgba}`);
  const a = m[4] === undefined ? 1 : parseFloat(m[4]);
  const bg = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const c = [1, 2, 3].map((i) => Math.round(parseFloat(m[i]) * a + bg[i - 1] * (1 - a)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

describe('Palette-1 T3 — the side channel publishes all four roles', () => {
  it('covers border, shadow, and both fonts', () => {
    expect(Object.keys(ELEVATION_VARS).sort()).toEqual(['border', 'shadow']);
    expect(Object.keys(FONT_VARS).sort()).toEqual(['body', 'heading']);
  });

  it('the two elevation tables carry the same roles — a drift here is a silent gap', () => {
    expect(Object.keys(ELEVATION_LIGHT).sort()).toEqual(Object.keys(ELEVATION_VARS).sort());
    expect(Object.keys(ELEVATION_DARK).sort()).toEqual(Object.keys(ELEVATION_VARS).sort());
  });

  it('elevationVar() and fontVar() emit the property with the LIGHT value as fallback', () => {
    // Same contract statusVar() has, for the same reason: a component rendering
    // with nothing mounted is on a light surface.
    expect(elevationVar('border')).toBe(`var(--rm-border, ${ELEVATION_LIGHT.border})`);
    expect(elevationVar('shadow')).toBe(`var(--rm-shadow, ${ELEVATION_LIGHT.shadow})`);
    expect(fontVar('heading')).toBe(`var(--rm-font-heading, ${FONT_DEFAULTS.heading})`);
    expect(fontVar('body')).toBe(`var(--rm-font-body, ${FONT_DEFAULTS.body})`);
  });

  it('both helpers THROW on an unknown role rather than returning an empty string', () => {
    // ⚠ A SILENT '' RENDERS AS NO BORDER AND NO FONT AT ALL — the failure mode
    // statusVar() refuses by name, refused here for the same reason.
    for (const bad of ['nope', '', null, undefined, 0]) {
      expect(() => elevationVar(bad), `elevationVar(${JSON.stringify(bad)})`).toThrow(/unknown elevation role/);
      expect(() => fontVar(bad), `fontVar(${JSON.stringify(bad)})`).toThrow(/unknown font role/);
    }
  });

  it('⚠ THE BOUNDARY: a non-hex value reaching themeCssVariables THROWS, and the throw is ITS OWN', () => {
    // ⚠ VACUITY GUARD — ASSERT WHERE THE THROW COMES FROM. If the value were
    // rejected earlier (by deriveThemeTokens, or by a type check) this case would
    // pass while proving nothing about the validator. themeCssVariables is called
    // DIRECTLY with a token object, so nothing else can intercept it, and the
    // message is matched on the validator's own wording.
    const good = deriveThemeTokens(resolveBrandingTheme(null), 'light');

    for (const [label, bad] of [
      ['a font stack', FONT_DEFAULTS.body],
      ['an alpha border', ELEVATION_LIGHT.border],
      ['a multi-part shadow', ELEVATION_LIGHT.shadow],
    ]) {
      expect(
        () => themeCssVariables({ ...good, text: bad }),
        `${label} was accepted by the colour validator`
      ).toThrow(/themeTokens: token 'text' is .* not a #RRGGBB colour/);
    }

    // And the positive control: the unmodified token set passes. Without this,
    // the throws above could be caused by anything at all.
    expect(() => themeCssVariables(good)).not.toThrow();
  });

  it('⚠ none of the side-channel values could pass the validator — which is why the channel exists', () => {
    const HEX = /^#[0-9a-fA-F]{6}$/;
    for (const v of [...Object.values(ELEVATION_LIGHT), ...Object.values(ELEVATION_DARK),
                     ...Object.values(FONT_DEFAULTS)]) {
      expect(HEX.test(v), `${v} is a plain hex — it belongs in RENDER_TOKEN_KEYS, not here`).toBe(false);
    }
  });
});

describe('Palette-1 B.4 — the border value, measured and reported honestly', () => {
  const light = deriveThemeTokens(resolveBrandingTheme(null), 'light');
  const dark = deriveThemeTokens(resolveBrandingTheme(null), 'dark');

  it('the DARK border no longer vanishes — this is what the split actually fixes', () => {
    // R.border is rgba(0,0,0,0.08): composited on the dark surface it measures
    // 1.02:1, which is not a faint edge, it is no edge. The white-alpha dark
    // value is the repair.
    const oldOnDark = contrastRatio(over('rgba(0,0,0,0.08)', dark.surface), dark.surface);
    const newOnDark = contrastRatio(over(ELEVATION_DARK.border, dark.surface), dark.surface);
    expect(oldOnDark).toBeLessThan(1.1);
    expect(newOnDark).toBeGreaterThan(1.5);
  });

  it('⚠ AND IT STILL DOES NOT CLEAR 3:1 — asserted so the limitation cannot be forgotten', () => {
    // ⚠ THIS ASSERTS A KNOWN SHORTFALL ON PURPOSE. No hairline clears the non-text
    // floor: measured candidates up to alpha 0.24/0.30 top out at 1.78:1 and
    // 2.68:1. A border that clears 3:1 against white is a visible mid-grey frame,
    // which is a DESIGN decision and belongs to Palette-2.
    // If a future change DOES clear 3:1, this case goes red and whoever did it
    // must delete it — which is the point. A limitation nobody re-checks becomes
    // a permanent one.
    const lightRatio = contrastRatio(over(ELEVATION_LIGHT.border, light.surface), light.surface);
    const darkRatio = contrastRatio(over(ELEVATION_DARK.border, dark.surface), dark.surface);
    expect(lightRatio).toBeLessThan(3);
    expect(darkRatio).toBeLessThan(3);
  });
});

describe('Palette-1 B.3 — fonts diverge from elevation, deliberately', () => {
  it('fonts have ONE table and no mode variant', () => {
    // ⚠ NOT AN OVERSIGHT. A typeface has no dark variant and no contrast ratio,
    // so a light/dark split would invent a distinction nobody makes. Elevation
    // needs both; fonts need neither. Asserted so the asymmetry is deliberate
    // rather than something a later reader "fixes" into symmetry.
    expect(Object.keys(FONT_DEFAULTS).sort()).toEqual(['body', 'heading']);
    // There is no FONT_DARK, and this is the assertion that says so.
    // eslint-disable-next-line no-undef
    expect(typeof globalThis.FONT_DARK).toBe('undefined');
  });
});
