// ─────────────────────────────────────────────────────────────────────────────
// THE FONT CHAIN — Palette-13 Part B (the chain commit, B.1-B.6)
//
// ⚠ THE DEFECT: a contractor picked fonts and their homeowners never saw them.
// `font_heading` and `font_body` are real columns with a real picker and a real
// stored value, and they reached CAMPAIGN EMAIL HTML and nothing else.
//
// ⚠ AND THE CHAIN BROKE IN FOUR PLACES, NOT THE TWO THE DEFECT LOOKED LIKE:
//   1. resolveBrandingTheme() emitted no font key at all
//   2. ThemeProvider mounted FONT_DEFAULTS unconditionally
//   3. useReferrerFonts() fetched one hardcoded Google stylesheet
//   4. the painters hardcoded the family
// This commit joins 1-3. The painters are the second commit, so these tests
// prove the VALUE ARRIVES, not that any component asks for it yet.
//
// ── THE VERIFICATION TRAP THIS FILE IS BUILT AROUND ─────────────────────────
// ⚠ ACCENT'S STORED FONTS ARE MONTSERRAT AND ROBOTO — WHICH ARE ALSO THE
// PLATFORM DEFAULTS AND ALSO WHAT THE OLD HARDCODED LOADER FETCHED. On that
// contractor a correct wiring and a completely unwired one produce IDENTICAL
// output. So every case below that matters uses a family that DIFFERS from the
// platform default, and the serif cases use Playfair Display specifically —
// a serif is unmistakably not Montserrat, and its generic differs too.
//
// ── NON-VACUITY ────────────────────────────────────────────────────────────
// Every "falls back to the default" case is PAIRED with a stored-value case on
// the same path. Without the pair, all of them pass identically against a build
// that ignores the column and always defaults — which is exactly the state this
// commit is fixing, so an unpaired fallback test would go green on the bug.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { resolveBrandingTheme, BRANDING_THEME_DEFAULTS, FONT_STACKS, resolveFont, fontStack } from '../utils/brandingTheme.mjs';
import { FONT_FACES, fontFaceCss, preloadUrls, FONT_URL_BASE } from './fontManifest.mjs';
import { themeVariables } from '../components/shared/ThemeProvider';
import { FONT_VARS, FONT_DEFAULTS } from './elevationTheme';

// A double that REFUSES a shape it does not recognise. A settings row that
// quietly accepts an unknown column name would let a typo'd fixture exercise
// the default branch while the test claimed to be exercising the set branch.
const SETTINGS_KEYS = new Set([
  'company_name', 'contractor_name', 'font_heading', 'font_body',
  'primary_color', 'secondary_color', 'accent_color', 'landing_bg_color',
]);
function row(o = {}) {
  for (const k of Object.keys(o)) {
    if (!SETTINGS_KEYS.has(k)) {
      throw new Error(`settings fixture got unknown column ${JSON.stringify(k)} — ` +
        'the double refuses an unrecognised shape rather than returning a plausible one');
    }
  }
  return o;
}

describe('T1 — all three font roles publish and resolve per contractor', () => {
  it('a contractor whose fonts DIFFER from the platform default gets their own', () => {
    // ⚠ THE WHOLE POINT. Montserrat/Roboto here would prove nothing.
    const t = resolveBrandingTheme(row({ font_heading: 'Playfair Display', font_body: 'Nunito' }));
    expect(t.headingFont).toBe('Playfair Display');
    expect(t.bodyFont).toBe('Nunito');
    expect(t.headingFont).not.toBe(BRANDING_THEME_DEFAULTS.headingFont);
    expect(t.bodyFont).not.toBe(BRANDING_THEME_DEFAULTS.bodyFont);
  });

  it('the resolver emits all three roles, mono included', () => {
    const t = resolveBrandingTheme(row({}));
    expect(t).toHaveProperty('headingFont');
    expect(t).toHaveProperty('bodyFont');
    expect(t).toHaveProperty('monoFont');
  });

  it('mono is platform-fixed — no column can move it', () => {
    // There is no font_mono column; the fixture guard above proves the name is
    // not one this codebase recognises, and the resolver emits the constant.
    expect(() => row({ font_mono: 'Courier New' })).toThrow(/unknown column/);
    expect(resolveBrandingTheme(row({})).monoFont).toBe('Roboto Mono');
  });

  it('the provider mounts the contractor stack on all three properties', () => {
    const brand = resolveBrandingTheme(row({ font_heading: 'Playfair Display', font_body: 'Nunito' }));
    const vars = themeVariables(brand, 'light');
    expect(vars[FONT_VARS.heading]).toBe("'Playfair Display', serif");
    expect(vars[FONT_VARS.body]).toBe("'Nunito', sans-serif");
    expect(vars[FONT_VARS.mono]).toBe("'Roboto Mono', monospace");
  });

  it('the mounted stack is identical in light and dark — fonts take no mode (B.4)', () => {
    const brand = resolveBrandingTheme(row({ font_heading: 'Playfair Display' }));
    const light = themeVariables(brand, 'light');
    const dark = themeVariables(brand, 'dark');
    for (const prop of Object.values(FONT_VARS)) expect(dark[prop]).toBe(light[prop]);
  });
});

describe('T2 — an unset font falls back to the platform default', () => {
  // ⚠ EMPTY STRING IS ABSENT, and so is whitespace-only: resolveFont trims
  // before lookup, matching firstNonEmpty's treatment of a cleared admin field.
  for (const [label, value] of [
    ['null', null], ['undefined', undefined], ['an empty string', ''],
    ['whitespace only', '   '], ['a tab', '\t'],
    ['a number', 42], ['an array', []], ['an object', {}],
  ]) {
    it(`font_heading of ${label} resolves to the platform default`, () => {
      const t = resolveBrandingTheme(row({ font_heading: value }));
      expect(t.headingFont).toBe(BRANDING_THEME_DEFAULTS.headingFont);
    });
  }

  it('PAIRED POSITIVE — a stored value is used, so the cases above are not vacuous', () => {
    // Without this, every case above passes against a build that never reads the
    // column at all — which is precisely the state before this commit.
    const t = resolveBrandingTheme(row({ font_heading: 'Oswald', font_body: 'DM Sans' }));
    expect(t.headingFont).toBe('Oswald');
    expect(t.bodyFont).toBe('DM Sans');
  });

  it('a padded but valid family is trimmed, not rejected', () => {
    expect(resolveBrandingTheme(row({ font_heading: '  Oswald  ' })).headingFont).toBe('Oswald');
  });
});

describe('T4 — an off-allowlist value resolves to the fallback', () => {
  // ⚠ THIS IS THE BRANCH resolveFont ADDS OVER resolveColor, and the path R-A
  // exists for: the picker is a client-side <select>, the write path whitelists
  // COLUMN NAMES and never inspects a value, and the column is VARCHAR(100) with
  // no CHECK. Anything can be in there.
  for (const [label, value] of [
    ['a plausible but unlisted family', 'Comic Sans MS'],
    ['a CSS generic', 'sans-serif'],
    ['an attribute-injection payload', 'Arial" onload="alert(1)'],
    ['a style-injection payload', 'Arial;background:url(//evil.test)'],
    ['a url()', 'url(//evil.test/x.woff2)'],
    ['a near-miss on case', 'montserrat'],
    ['a near-miss on spacing', 'PlayfairDisplay'],
    ['an empty-ish quote', '"'],
  ]) {
    it(`${label} never reaches the mounted value`, () => {
      const t = resolveBrandingTheme(row({ font_heading: value }));
      expect(t.headingFont).toBe(BRANDING_THEME_DEFAULTS.headingFont);
      // And it must not survive into the style context by any route.
      const mounted = themeVariables(t, 'light')[FONT_VARS.heading];
      expect(mounted).toBe(FONT_DEFAULTS.heading);
      expect(mounted).not.toContain('evil.test');
      expect(mounted).not.toContain('onload');
    });
  }

  it('PAIRED POSITIVE — an ON-list family does reach the mounted value', () => {
    const t = resolveBrandingTheme(row({ font_heading: 'Playfair Display' }));
    expect(themeVariables(t, 'light')[FONT_VARS.heading]).toBe("'Playfair Display', serif");
  });

  it('resolveFont returns the fallback argument itself, not a hardcoded default', () => {
    // Otherwise the function would be ignoring its second parameter and passing
    // only by coincidence of the caller's default matching a literal inside it.
    expect(resolveFont('Comic Sans MS', 'SENTINEL')).toBe('SENTINEL');
    expect(resolveFont('Oswald', 'SENTINEL')).toBe('Oswald');
  });
});

describe('T5 — the generic is correct per family (R-C)', () => {
  it('every allowlisted family maps to its OWN generic', () => {
    // ⚠ R-C's reason: HEADING_FONTS offers two SERIFS, and appending sans-serif
    // to everything gives a serif a fallback that CHANGES CATEGORY on failure.
    for (const [family, generic] of Object.entries(FONT_STACKS)) {
      expect(fontStack(family)).toBe(`'${family}', ${generic}`);
      expect(['serif', 'sans-serif', 'monospace']).toContain(generic);
    }
  });

  it('the serifs fall back to serif and the mono to monospace — named, not counted', () => {
    expect(fontStack('Playfair Display')).toBe("'Playfair Display', serif");
    expect(fontStack('DM Serif Display')).toBe("'DM Serif Display', serif");
    expect(fontStack('Roboto Mono')).toBe("'Roboto Mono', monospace");
    // The specific regression R-C names: a serif must NOT end in sans-serif.
    expect(fontStack('Playfair Display')).not.toMatch(/sans-serif$/);
  });

  it('covers all 15 roles the picker plus the mono role can produce', () => {
    // Non-vacuity for the loop above: an emptied table would pass it trivially.
    expect(Object.keys(FONT_STACKS)).toHaveLength(15);
  });
});

describe('B.5 — the manifest declares a face for everything the allowlist admits', () => {
  it('every allowlisted family has at least one face', () => {
    // ⚠ THE GAP THIS CATCHES: a family a contractor can SELECT and the app
    // cannot SERVE renders the generic fallback and reports nothing.
    const missing = Object.keys(FONT_STACKS).filter((f) => !FONT_FACES[f]);
    expect(missing).toEqual([]);
  });

  it('the manifest declares no family the allowlist would reject', () => {
    // The other direction: a shipped file nothing can select is dead weight.
    const orphans = Object.keys(FONT_FACES).filter((f) => !FONT_STACKS[f]);
    expect(orphans).toEqual([]);
  });

  it('every face carries font-display:swap and a same-origin url', () => {
    for (const family of Object.keys(FONT_FACES)) {
      const css = fontFaceCss(family);
      expect(css).toContain('font-display:swap');
      expect(css).toContain(`font-family:'${family}'`);
      // ⚠ SELF-HOSTED IS THE WHOLE RULING. A remote origin here would silently
      // reintroduce exactly what landing.js's font-src 'self' refuses.
      expect(css).not.toMatch(/https?:\/\//);
      expect(css).toContain(`url('${FONT_URL_BASE}`);
    }
  });

  it('an unknown family yields no css rather than a broken rule', () => {
    expect(fontFaceCss('Comic Sans MS')).toBe('');
    expect(preloadUrls(['Comic Sans MS'])).toEqual([]);
  });

  it('preloads the three platform defaults and nothing else', () => {
    const urls = preloadUrls([
      BRANDING_THEME_DEFAULTS.headingFont,
      BRANDING_THEME_DEFAULTS.bodyFont,
      BRANDING_THEME_DEFAULTS.monoFont,
    ]);
    expect(urls).toHaveLength(3);
    for (const u of urls) expect(u.startsWith(FONT_URL_BASE)).toBe(true);
  });
});
