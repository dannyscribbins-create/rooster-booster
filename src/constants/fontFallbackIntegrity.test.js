// ─────────────────────────────────────────────────────────────────────────────
// FONT FALLBACK INTEGRITY — Palette-13 Part B, B.8
//
// ⚠ A var() FALLBACK MUST BE THE VALUE THAT ACTUALLY MOUNTS. This is the defect
// class that painted the login screen's failed-login message at 1.34:1 for
// months: `var(--rm-danger, #FEE2E2)` reads as a plausible pale error tint and
// the provider mounts the saturated fill `#DC2626`. jsdom resolves no var(), so
// no render test anywhere can see the disagreement. Only an equality check can.
//
// ⚠ AND THE SECOND HALF, WHICH IS WORSE BECAUSE IT LOOKS RIGHT IN REVIEW: a
// fallback that is a STRING CONTAINING THE TEXT OF A CALL. Five icons shipped
// BLACK from `const AMBER = "statusVar('warning')"` — a string, not the call —
// and four independent checks passed, because a checker cannot see a defect
// whose symptom is high contrast. `themeKeyIntegrity` fences that class on
// assignment position; this file fences the font roles' VALUES.
//
// ── WHAT THIS ASSERTS, AND WHY IT IS NOT VACUOUS ────────────────────────────
// FONT_DEFAULTS[role] must be EXACTLY fontStack(BRANDING_THEME_DEFAULTS[…Font]).
// Both sides are computed from live modules — neither is a literal restated
// here — so the check fails if either the default family, the generic map, or
// the stack format moves. A literal expectation would pass after someone
// changed both sides in the same wrong way.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { FONT_DEFAULTS, FONT_VARS, fontVar } from './elevationTheme';
import { BRANDING_THEME_DEFAULTS, FONT_STACKS, fontStack, resolveFont } from '../utils/brandingTheme.mjs';

// role -> the BRANDING_THEME_DEFAULTS key that feeds it. Written out because the
// two vocabularies genuinely differ (`heading` vs `headingFont`), and a derived
// mapping would hide a rename in exactly the place this file exists to catch it.
const ROLE_TO_DEFAULT = { heading: 'headingFont', body: 'bodyFont', mono: 'monoFont' };

describe('font fallback integrity — the fallback is the value that mounts', () => {
  it('every FONT_VARS role has a default and a branding source', () => {
    // Non-vacuity: the loops below iterate FONT_VARS, so an empty or shrunken
    // FONT_VARS would make every one of them pass trivially.
    expect(Object.keys(FONT_VARS).sort()).toEqual(['body', 'heading', 'mono']);
    expect(Object.keys(ROLE_TO_DEFAULT).sort()).toEqual(Object.keys(FONT_VARS).sort());
  });

  for (const [role, defaultKey] of Object.entries(ROLE_TO_DEFAULT)) {
    it(`FONT_DEFAULTS.${role} equals the stack the provider mounts for an unbranded contractor`, () => {
      const family = BRANDING_THEME_DEFAULTS[defaultKey];
      expect(typeof family).toBe('string');
      expect(family).not.toBe('');
      expect(FONT_DEFAULTS[role]).toBe(fontStack(family));
    });

    it(`fontVar('${role}') declares that same value as its literal fallback`, () => {
      expect(fontVar(role)).toBe(`var(${FONT_VARS[role]}, ${FONT_DEFAULTS[role]})`);
    });

    it(`FONT_DEFAULTS.${role} is a font stack, not the text of a call`, () => {
      const v = FONT_DEFAULTS[role];
      // The five-black-icons shape: a value that merely CONTAINS a call.
      expect(v).not.toMatch(/\w+Var\s*\(/);
      expect(v).not.toMatch(/fontStack\s*\(/);
      // A real stack: a quoted family, a comma, then a bare CSS generic.
      expect(v).toMatch(/^'[^']+', (serif|sans-serif|monospace)$/);
    });
  }

  it('the default families are themselves on the allowlist', () => {
    // Otherwise resolveFont would reject the platform's own defaults and
    // fontStack would fall through to its emergency stack — a state in which
    // every contractor silently renders the body face for every role.
    for (const key of Object.values(ROLE_TO_DEFAULT)) {
      const family = BRANDING_THEME_DEFAULTS[key];
      expect(Object.prototype.hasOwnProperty.call(FONT_STACKS, family)).toBe(true);
      expect(resolveFont(family, 'SENTINEL')).toBe(family);
    }
  });

  it('every allowlisted family produces its OWN generic, not a blanket sans-serif', () => {
    // R-C. Two of the heading families are serifs; appending sans-serif to
    // everything changes CATEGORY on font failure.
    const serifs = Object.keys(FONT_STACKS).filter((f) => FONT_STACKS[f] === 'serif');
    expect(serifs.sort()).toEqual(['DM Serif Display', 'Playfair Display']);
    for (const [family, generic] of Object.entries(FONT_STACKS)) {
      expect(fontStack(family)).toBe(`'${family}', ${generic}`);
    }
  });
});
