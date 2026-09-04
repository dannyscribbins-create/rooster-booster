// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-4a PART B — DashboardTab
//
// T2  the warning tint derives, and EVERY banner text/tint pair is measured
// T3  THE MONEY FENCE — the dollar figures clear 4.5:1 on every seeded brand
// T4  THE TINT-IS-NOT-A-FILL FENCE — R-1's exact shape, and the class guard
// T5  every site resolves to its ruled token
// T6  no R. colour read and no retired tone survives, and the file still renders
// T9  Palette-1's shortfall fences are not weakened by anything here
//
// ── ⚠ WHAT THESE TESTS CAN AND CANNOT SEE ──────────────────────────────────
// jsdom does not resolve var(). Every assertion here is DECLARATION-level plus
// ARITHMETIC over the derivation: it proves a site NAMES the right property with
// the right fallback, and that the resulting pair clears its floor. IT CANNOT
// PROVE THE PROPERTY WAS MOUNTED, and mounted-vs-fallback is R-1's entire defect
// class — a declaration can be perfect while the provider mounts something the
// fallback contradicts. That half is the browser harness, run against three
// brands in two modes, and its readout is in the commit body.
// ⚠ SO A GREEN RUN OF THIS FILE IS EVIDENCE ABOUT DECLARATIONS AND ARITHMETIC.
// It is not evidence about pixels, and it must not be reported as if it were.
//
// ⚠ EXPECTED COUNT: 29 cases in this file. Stated because a heredoc has eaten
// backslashes repeatedly in this arc, and the worst instance made a module fail
// to LOAD while the runner still reported the run as passing — the file simply
// contributed zero. A count you did not predict cannot surprise you.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio, RENDER_TOKEN_VARS } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import {
  STATUS_TINT, STATUS_LIGHT, STATUS_DARK, STATUS_VARS, STATUS_BANNER, statusVar,
} from '../../constants/statusTheme';
import { ELEVATION_LIGHT, ELEVATION_VARS, elevationVar } from '../../constants/elevationTheme';
import DashboardTab from './DashboardTab';

const SRC = path.resolve(process.cwd(), 'src');
const DASH_REL = 'components/referrer/DashboardTab.jsx';
const DASH = fs.readFileSync(path.resolve(SRC, DASH_REL), 'utf8');
// ⚠ /\r?\n/ — `.` does not match `\r`, so a $-anchored pattern silently no-ops
// on a CRLF line, and core.autocrlf=true is the Windows default.
const DASH_LINES = DASH.split(/\r?\n/);

const TEXT_FLOOR = 4.5;
const GRAPHIC_FLOOR = 3;

// The seeded stack, by stored brand columns. Gamma is UNSET — what a contractor
// looks like before choosing anything, which is every contractor's first minute.
const BRANDS = [
  ['Gamma (UNSET)', null],
  ['Alpha', { primary_color: '#1C2D4D', secondary_color: '#F26A1B' }],
  ['Beta', { primary_color: '#0B3D3B', secondary_color: '#C2185B' }],
  ['Accent-shaped', { primary_color: '#012854', secondary_color: '#CC0000' }],
];
const MODES = ['light', 'dark'];

function eachBrandMode(fn) {
  for (const [label, src] of BRANDS) {
    for (const mode of MODES) {
      fn(label, mode, deriveThemeTokens(resolveBrandingTheme(src), mode));
    }
  }
}

// Composite an opaque colour over a ground at an alpha — what an `opacity`
// declaration on a text node actually produces, and what an rgba() fill does.
function composite(hex, ground, alpha) {
  const px = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const f = px(hex);
  const b = px(ground);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}

// An rgba(r,g,b,a) string composited over an opaque ground.
function compositeRgba(rgba, ground) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(rgba);
  if (!m) throw new Error(`compositeRgba: not an rgba() value: ${JSON.stringify(rgba)}`);
  const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
  const hex = '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('');
  return composite(hex.toUpperCase(), ground, alpha);
}

// Comments stripped for the CODE-level questions only — the same distinction
// Palette-2 and Palette-3 recorded, and it is NOT a comments-are-exempt
// carve-out. These ask "does the CODE still read R. / a retired tone";
// themeKeyIntegrity.test.js asks "does this NAME appear anywhere a reader could
// copy from" and keeps no carve-out at all.
function codeOnly(text) {
  const out = [];
  let inBlock = false;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (inBlock) { if (t.includes('*/')) inBlock = false; continue; }
    if (t.startsWith('/*') || t.startsWith('{/*')) { if (!t.includes('*/')) inBlock = true; continue; }
    if (t.startsWith('//') || t.startsWith('*')) continue;
    out.push(line);
  }
  return out.join('\n');
}

const DASH_CODE = codeOnly(DASH);

// ⚠ NON-VACUITY, FIRST AND UNCONDITIONALLY. Every source-text assertion below
// examines these strings; if the read ever returns nothing they all pass by
// examining nothing, which is the exact shape this file exists to catch.
describe('Palette-4a Part B — the sweep has something to sweep', () => {
  it('the component source was read and the comment stripper left code behind', () => {
    expect(DASH.length).toBeGreaterThan(20000);
    expect(DASH_LINES.length).toBeGreaterThan(700);
    expect(DASH_CODE.length).toBeGreaterThan(8000);
    // The stripper must remove SOMETHING, or it is not doing its job and every
    // "code-level" assertion below is silently a whole-file assertion.
    expect(DASH_CODE.length).toBeLessThan(DASH.length);
    expect(DASH_CODE).toContain('export default function Dashboard');
  });
});

// ── T2 — THE WARNING TINT, AND WHAT IT MEASURED ─────────────────────────────
describe('Palette-4a Part B T2 — the warning tint (R-B)', () => {
  it('[RED] STATUS_TINT carries a warning entry, as an alpha wash like its siblings', () => {
    expect(Object.keys(STATUS_TINT).sort()).toEqual(['danger', 'success', 'warning']);
    for (const [role, value] of Object.entries(STATUS_TINT)) {
      expect(value, `${role} is not an rgba() wash`).toMatch(/^rgba\(/);
    }
  });

  // ⚠ THIS IS THE CASE R-B ASKED FOR BY NAME, AND ITS ANSWER DECIDED THE PHASE.
  it('[RED] MEASURED — two of the three tints CANNOT carry banner text', () => {
    const results = [];
    for (const role of ['danger', 'success', 'warning']) {
      const ground = compositeRgba(STATUS_TINT[role], '#FFFFFF');
      const ratio = contrastRatio(STATUS_LIGHT[`${role}Text`], ground);
      results.push([role, ground, Number(ratio.toFixed(2))]);
    }
    const byRole = Object.fromEntries(results.map(([r, , v]) => [r, v]));

    // Recorded as MEASUREMENTS, not as a pass/fail, because the point is the
    // shape of the answer: a 0.12 wash of a mid-tone does not leave enough
    // contrast range for text, and that is a property of tints rather than of
    // these two hexes. success 4.39 was Palette-1's finding; warning 4.42 is
    // this phase's, and it is why the banners did NOT go onto the tint.
    expect(byRole.danger).toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(byRole.success).toBeLessThan(TEXT_FLOOR);
    expect(byRole.warning).toBeLessThan(TEXT_FLOOR);
    expect(byRole.warning).toBeCloseTo(4.42, 1);
  });

  it('[RED] so STATUS_BANNER grounds on the SURFACE and puts the status colour on the EDGE', () => {
    for (const role of ['danger', 'success', 'warning']) {
      const banner = STATUS_BANNER[role];
      expect(banner, `STATUS_BANNER.${role} is missing`).toBeTruthy();
      // ⚠ THE GROUND IS THE SURFACE TOKEN. If this ever becomes a tint, R-1
      // has been reproduced and this case is the thing that says so.
      expect(banner.backgroundColor).toBe('var(--rm-surface, #FFFFFF)');
      expect(banner.border).toBe(
        `1px solid var(${STATUS_VARS[role]}, ${STATUS_LIGHT[role]})`
      );
      // And no banner may reference the tint table at all.
      expect(JSON.stringify(banner)).not.toContain('rgba(');
    }
  });

  it('[RED] every banner text/tint pair clears its floor AS SHIPPED (surface ground)', () => {
    // The pairs that actually paint: *Text on `surface`, and the edge as a
    // graphic. Light uses STATUS_LIGHT on #FFFFFF; dark uses STATUS_DARK on the
    // referrer dark surface the provider mounts.
    const CASES = [
      ['light', '#FFFFFF', STATUS_LIGHT],
      ['dark', '#121B31', STATUS_DARK],
    ];
    for (const [mode, ground, table] of CASES) {
      for (const role of ['danger', 'warning']) {
        const text = contrastRatio(table[`${role}Text`], ground);
        const edge = contrastRatio(table[role], ground);
        expect(text, `${mode}/${role} text is ${text.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
        expect(edge, `${mode}/${role} edge is ${edge.toFixed(2)}:1`).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
      }
    }
  });

  it('[RED] the three migrated banners declare the status system, not literals', () => {
    // The bank prompt, the 429 notice and the stale-cache notice are warning;
    // the pipeline-unavailable notice is danger.
    const warningBanners = DASH_CODE.split('...STATUS_BANNER.warning').length - 1;
    const dangerBanners = DASH_CODE.split('...STATUS_BANNER.danger').length - 1;
    expect(warningBanners, 'expected exactly three warning banners').toBe(3);
    expect(dangerBanners, 'expected exactly one danger banner').toBe(1);
    // ⚠ AND THE LITERALS THEY WERE BUILT FROM ARE GONE FROM THE CODE. Anchored
    // on the full literal, not a fragment — a bare '#F5' would match anything.
    for (const dead of ['#FFF8E1', '#F5C518', '#B8860B', '#7B5900', '#FFF0F0', '#7A0000', '#1a0a00', '#ff8c00', '#cc7700']) {
      expect(DASH_CODE, `${dead} survives in code`).not.toContain(dead);
    }
  });
});

// ── T3 — THE MONEY FENCE ────────────────────────────────────────────────────
describe('Palette-4a Part B T3 — THE MONEY FENCE', () => {
  it('[RED] the dollar figures clear 4.5:1 on every seeded brand, both grounds', () => {
    eachBrandMode((label, mode, t) => {
      const onSurface = contrastRatio(t.primaryText, t.surface);
      const onRecess = contrastRatio(t.primaryText, t.recess);
      expect(onSurface, `${label}/${mode}: money on surface is ${onSurface.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
      expect(onRecess, `${label}/${mode}: money on recess is ${onRecess.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  // ⚠ GUARD-PROOF. Without this the case above passes against a fence that
  // could never fail, and "primaryText clears 4.5" would be an assertion about
  // arithmetic rather than about a decision. This shows the REJECTED token
  // genuinely fails — so the fence has an observed failure mode.
  it('[RED] GUARD-PROOF — pointing the money at --rm-primary FAILS, which is why it does not', () => {
    const failures = [];
    eachBrandMode((label, mode, t) => {
      const ratio = contrastRatio(t.primary, t.surface);
      if (ratio < TEXT_FLOOR) failures.push(`${label}/${mode} ${ratio.toFixed(2)}:1`);
    });
    expect(
      failures.length,
      'no seeded brand failed under --rm-primary, so the money fence guards nothing'
    ).toBeGreaterThan(0);
    // The platform brand is one of them — 3.06:1, an orange at full brightness.
    expect(failures.join(' | ')).toContain('Gamma (UNSET)/light');
  });

  it('[RED] and the dollar-figure sites declare --rm-primary-text, not --rm-primary', () => {
    expect(DASH_CODE).toContain("const MONEY = 'var(--rm-primary-text, #B1480A)'");
    // Anchored on the surrounding declaration, never on a bare token name — a
    // bare '--rm-primary-text' also appears inside '--rm-primary-text' checks
    // and, more to the point, a bare value proves only that it occurs SOMEWHERE.
    const moneySites = DASH_CODE.split('color: MONEY').length - 1;
    expect(moneySites, 'expected three dollar-figure sites on MONEY').toBe(3);
  });
});

// ── T4 — THE TINT-IS-NOT-A-FILL FENCE ───────────────────────────────────────
describe('Palette-4a Part B T4 — R-1\'s exact shape, and the class guard', () => {
  // The guard themeKeyIntegrity.test.js enforces: every var(--rm-*, #hex)
  // fallback must equal what the provider mounts for the platform brand in
  // light mode. Re-derived here from the same two sources it uses, so this is
  // an independent statement of the rule rather than a copy of its answer.
  function expectedFallbacks() {
    const light = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    const out = {};
    for (const [key, prop] of Object.entries(RENDER_TOKEN_VARS)) out[prop] = light[key];
    for (const [role, prop] of Object.entries(STATUS_VARS)) out[prop] = STATUS_LIGHT[role];
    return out;
  }
  const VAR_DECL = /var\(\s*(--rm-[a-z0-9-]+)\s*,\s*(#[0-9a-fA-F]{6})\s*\)/g;

  function violations(source) {
    const expected = expectedFallbacks();
    const bad = [];
    VAR_DECL.lastIndex = 0;
    let m;
    while ((m = VAR_DECL.exec(source)) !== null) {
      const [, prop, fallback] = m;
      const want = expected[prop];
      if (want && fallback.toUpperCase() !== want.toUpperCase()) {
        bad.push(`${prop} falls back to ${fallback}, derivation says ${want}`);
      }
      VAR_DECL.lastIndex = m.index + m[0].length;
    }
    return bad;
  }

  it('[RED] GUARD-PROOF — a banner pointed at var(--rm-warning, <pale tint>) is CAUGHT', () => {
    // ⚠ THIS IS R-1 VERBATIM, ONE ROLE ALONG. The declaration reads as a pale
    // amber banner ground and measures perfectly well; the provider mounts the
    // SATURATED FILL #D97706, so what would paint is dark amber on bright amber.
    const inverted = "backgroundColor: 'var(--rm-warning, #FEF3C7)',";
    const found = violations(inverted);
    expect(found.length, 'THE CLASS GUARD DID NOT CATCH R-1\'S SHAPE — this is a bigger finding than the banner')
      .toBe(1);
    expect(found[0]).toContain('--rm-warning');
    expect(found[0]).toContain('#FEF3C7');
    expect(found[0]).toContain(STATUS_LIGHT.warning);
  });

  it('[RED] POSITIVE CONTROL — the shipped declaration is accepted by the same predicate', () => {
    // ⚠ Without this, the case above passes against a predicate that rejects
    // EVERYTHING, which would look identical. Two of the three instances of this
    // class in the arc were invisible in the negative and obvious in the positive.
    expect(violations(STATUS_BANNER.warning.border)).toEqual([]);
    expect(violations(STATUS_BANNER.warning.backgroundColor)).toEqual([]);
    expect(violations(statusVar('warningText'))).toEqual([]);
  });

  it('[RED] and DashboardTab itself carries no fallback that disagrees with the mount', () => {
    const bad = violations(codeOnly(DASH));
    expect(bad, `fallbacks disagreeing with the derivation:\n${bad.join('\n')}`).toEqual([]);
    // ⚠ NON-VACUITY: the file must actually contain fallbacks to check.
    const declared = (codeOnly(DASH).match(VAR_DECL) || []).length;
    expect(declared, 'no var() fallbacks found in DashboardTab').toBeGreaterThan(8);
  });
});

// ── T5 — EVERY SITE RESOLVES TO ITS RULED TOKEN ─────────────────────────────
describe('Palette-4a Part B T5 — the ruled destinations', () => {
  it('[RED] the token constants declare the platform defaults as their fallbacks', () => {
    const light = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    const EXPECT = [
      ['PRIMARY', '--rm-primary', light.primary],
      ['PRIMARY_DARK', '--rm-primary-dark', light.primaryDark],
      ['ON_PRIMARY', '--rm-on-primary', light.onPrimary],
      ['SECONDARY', '--rm-secondary', light.secondary],
      ['SECONDARY_DARK', '--rm-secondary-dark', light.secondaryDark],
      ['ON_SECONDARY', '--rm-on-secondary', light.onSecondary],
      ['SURFACE', '--rm-surface', light.surface],
      ['RECESS', '--rm-recess', light.recess],
      ['MONEY', '--rm-primary-text', light.primaryText],
    ];
    for (const [name, prop, value] of EXPECT) {
      expect(DASH_CODE, `${name} is not declared as ${prop} with the derived fallback`)
        .toContain(`const ${name}`);
      expect(DASH_CODE).toContain(`'var(${prop}, ${value})'`);
    }
  });

  it('[RED] R-D — 718/760 use secondary+onSecondary, 526 matches AvatarCircle, 703 is primary', () => {
    // The two QR buttons: a secondary fill with the derived foreground on it.
    const secondaryButtons = DASH_CODE.split('background: SECONDARY, color: ON_SECONDARY').length - 1;
    expect(secondaryButtons, 'expected the two QR modal buttons on secondary+onSecondary').toBe(2);
    // The inline initials badge, matching AvatarCircle's pair rather than its own.
    expect(DASH_CODE).toContain('background: PRIMARY, color: ON_PRIMARY');
    // The spinner ring, following LoadingIndicator.
    expect(DASH_CODE).toContain('border: `3px solid ${PRIMARY}`');
  });

  it('[RED] R-D — 400 IS HELD ON LITERALS, and the hold cannot silently grow', () => {
    // ⚠ ASSERTED BY EQUALITY, NOT BY "AT MOST ONE". This is the single site in
    // the file that still reads a colour off R, and it is deliberate: a
    // cross-brand-colour gradient is a design question, not a substitution. If a
    // second R colour read appears, this goes RED and whoever added it must say
    // why — an exception list that can only grow stops being an exception list.
    const R_COLOUR = /(^|[^A-Za-z0-9_.])R\.(red|redDark|navy|navyDark|blueLight|bgBlueLight|bgCard|bgPage|bgCardTint|textPrimary|textSecondary|textMuted|border|borderMed|shadow|shadowMd|shadowLg)\b/g;
    const hits = [];
    codeOnly(DASH).split(/\r?\n/).forEach((line, i) => {
      R_COLOUR.lastIndex = 0;
      let m;
      while ((m = R_COLOUR.exec(line)) !== null) {
        hits.push({ key: m[2], line: line.trim() });
        R_COLOUR.lastIndex = m.index + m[0].length;
      }
    });
    expect(hits.map((h) => h.key).sort()).toEqual(['navy', 'red']);
    // And both are on ONE line — the progress fill — not scattered.
    expect(new Set(hits.map((h) => h.line)).size).toBe(1);
    expect(hits[0].line).toContain('linear-gradient(90deg,');
  });

  it('[RED] R-E and the muted idiom land where they were ruled', () => {
    // The progress track is the recessed groove.
    expect(DASH_CODE).toContain('background: RECESS, borderRadius: 999');
    // ⚠ THE MUTED ALPHA IS ONE VALUE, SHARED WITH THE NINE FILES THAT ALREADY
    // HAVE THIS IDIOM. A second near-identical alpha is how a tenth pattern starts.
    expect(DASH_CODE).toContain('const MUTED = 0.72');
    const mutedSites = DASH_CODE.split('opacity: MUTED').length - 1;
    expect(mutedSites, 'expected the muted idiom at thirteen CODE sites').toBe(13);
  });

  it('[RED] the Phosphor colour PROP is gone — a var() cannot live in an SVG attribute', () => {
    // Phosphor defaults `color` to currentColor, so the icon inherits the CSS
    // `color` set on its parent. Passing var(...) to the prop would put a custom
    // property into a presentation ATTRIBUTE — which jsdom resolves not at all.
    expect(DASH_CODE).not.toContain('color={R.navy}');
    expect(DASH_CODE).toContain('<X size={22} weight="bold" />');
  });

  it('[RED] the muted idiom clears 4.5:1 on BOTH grounds, every brand, every mode', () => {
    eachBrandMode((label, mode, t) => {
      const onSurface = composite(t.text, t.surface, 0.72);
      const onRecess = composite(t.text, t.recess, 0.72);
      const a = contrastRatio(onSurface, t.surface);
      const b = contrastRatio(onRecess, t.recess);
      expect(a, `${label}/${mode}: muted on surface is ${a.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
      expect(b, `${label}/${mode}: muted on recess is ${b.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] R-F — the value it REPLACED does not clear the floor, so the fix is real', () => {
    // ⚠ GUARD-PROOF for the idiom. R.textMuted was #A0A0A0 — 2.61:1 on white,
    // the same failure as the ✕ this arc has been chasing. Without this the case
    // above is arithmetic about a number nobody chose.
    const before = contrastRatio('#A0A0A0', '#FFFFFF');
    expect(before).toBeLessThan(TEXT_FLOOR);
    expect(before).toBeCloseTo(2.61, 1);
    // ⚠ AND THE DERIVED FLOOR IS A FLOOR: 0.60 does not clear it. If it did,
    // 0.72 would be an arbitrary pick rather than the lowest safe value.
    const beta = deriveThemeTokens(resolveBrandingTheme({ primary_color: '#0B3D3B', secondary_color: '#C2185B' }), 'light');
    const tooLight = composite(beta.text, beta.recess, 0.60);
    expect(contrastRatio(tooLight, beta.recess)).toBeLessThan(TEXT_FLOOR);
  });

  // ⚠ FOUND BY THE BROWSER HARNESS, NOT BY A TEST, AND THAT IS THE RECORD.
  // The hero's ground is a GRADIENT, so its text must clear the DARKER STOP.
  // The arithmetic that first approved the muted idiom there measured against
  // `secondary` and read 4.67–5.48; against `secondaryDark` the real numbers are
  // 3.54 · 3.54 · 4.14 · 3.74 in dark mode — under the floor on EVERY brand.
  // Same class as the bank banner's warningText: the mechanism was inherited
  // instead of the property being re-derived against the ground it landed on.
  it('[RED] a gradient ground is floored on its DARKER STOP — muted fails there, full onSecondary does not', () => {
    let sawMutedFailure = false;
    eachBrandMode((label, mode, t) => {
      const muted = composite(t.onSecondary, t.secondaryDark, 0.72);
      if (contrastRatio(muted, t.secondaryDark) < TEXT_FLOOR) sawMutedFailure = true;
      const full = contrastRatio(t.onSecondary, t.secondaryDark);
      expect(full, `${label}/${mode}: full onSecondary on the dark stop is ${full.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
    // ⚠ NON-VACUITY: if the muted variant never failed, this fence would be
    // guarding a distinction that does not exist and the hero could be "tidied"
    // back into line with its sibling for free.
    expect(sawMutedFailure, 'the muted idiom never failed on a dark stop — this fence guards nothing').toBe(true);
    // And the hero sub-line must NOT carry the muted alpha.
    const hero = DASH_CODE.split('\n').find((l) => l.includes('Hey, {userName'));
    expect(hero, 'the hero greeting line was not found').toBeTruthy();
    const heroDecl = DASH_CODE.split('\n')[DASH_CODE.split('\n').indexOf(hero) - 1];
    expect(heroDecl).toContain('color: ON_SECONDARY');
    expect(heroDecl, 'the hero sub-line must not be muted — its ground is a gradient').not.toContain('opacity: MUTED');
  });

  it('[RED] onSecondary sites clear their floor, and the value they replaced does not', () => {
    let sawRescue = false;
    eachBrandMode((label, mode, t) => {
      const after = contrastRatio(t.onSecondary, t.secondary);
      expect(after, `${label}/${mode}: onSecondary is ${after.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
      const before = contrastRatio('#FFFFFF', t.secondary);
      if (before < TEXT_FLOOR) sawRescue = true;
    });
    expect(sawRescue, 'a bare white never failed — the onSecondary sites guard nothing').toBe(true);
  });
});

// ── T6 — THE SWEEPS, AND THE RENDER THAT PROVES THEY MEAN ANYTHING ──────────
describe('Palette-4a Part B T6 — no R. colour, no retired tone, and it still runs', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('[RED] the needles are validated against known answers before being trusted', () => {
    // ⚠ A SWEEP RETURNING A NUMBER IS A TOOL REPORT UNTIL THE PATTERN HAS BEEN
    // RUN AGAINST A CASE WHOSE ANSWER IS ALREADY KNOWN. This arc has had a
    // needle return 80 hits against a true answer of 7.
    const decimalRed = /\(\s*204\s*,\s*0\s*,\s*0\s*[,)]/g;
    const decimalBlue = /\(\s*211\s*,\s*227\s*,\s*240\s*[,)]/g;
    const hexRed = /#cc0000/gi;
    const count = (re, s) => (s.match(new RegExp(re.source, re.flags)) || []).length;

    expect(count(decimalRed, 'rgba(204,0,0,0.3)')).toBe(1);
    expect(count(decimalRed, 'rgba(2040,0,0,1)')).toBe(0);
    expect(count(decimalBlue, 'rgba(211,227,240,0.75)')).toBe(1);
    // ⚠ THE HEX NEEDLE CANNOT SEE THE DECIMAL FORM. That asymmetry is the whole
    // reason both are swept: three sites in this file were decimal-only.
    expect(count(hexRed, 'rgba(204,0,0,0.3)')).toBe(0);
    expect(count(hexRed, '#CC0000')).toBe(1);
    expect(count(hexRed, '#cc0000')).toBe(1);
  });

  it('[RED] no retired Accent tone survives in code, in EITHER form', () => {
    const NEEDLES = [
      ['#012854 (hex)', /#012854/gi],
      ['#041D3E (hex)', /#041D3E/gi],
      ['#CC0000 (hex)', /#cc0000/gi],
      ['#D3E3F0 (hex)', /#D3E3F0/gi],
      ['rgb(1,40,84) (decimal)', /\(\s*1\s*,\s*40\s*,\s*84\s*[,)]/g],
      ['rgb(204,0,0) (decimal)', /\(\s*204\s*,\s*0\s*,\s*0\s*[,)]/g],
      ['rgb(211,227,240) (decimal)', /\(\s*211\s*,\s*227\s*,\s*240\s*[,)]/g],
    ];
    const found = [];
    for (const [label, re] of NEEDLES) {
      const hits = (DASH_CODE.match(new RegExp(re.source, re.flags)) || []).length;
      if (hits) found.push(`${label} ×${hits}`);
    }
    expect(found, `retired tones survive in code: ${found.join(', ')}`).toEqual([]);
  });

  it('[RED] the elevation side channel replaced every shadow and border read', () => {
    expect(DASH_CODE).toContain("elevationVar('shadowLg')");
    expect(DASH_CODE).toContain("elevationVar('shadowMd')");
    expect(DASH_CODE).toContain("elevationVar('shadow')");
    expect(DASH_CODE).toContain("elevationVar('border')");
    // ⚠ ASSERTED ON THE CALL, NOT ON THE EMITTED STRING. The source holds
    // `elevationVar('border')`; `var(--rm-border,` is what that RETURNS, and a
    // test grepping for the return value fails against correct code — which
    // happened once in Palette-3 and is why this note is here.
    expect(elevationVar('shadowMd')).toBe(`var(${ELEVATION_VARS.shadowMd}, ${ELEVATION_LIGHT.shadowMd})`);
    expect(elevationVar('shadowLg')).toBe(`var(${ELEVATION_VARS.shadowLg}, ${ELEVATION_LIGHT.shadowLg})`);
  });

  it('[RED] shadowLg no longer carries a brand tone inside an occlusion', () => {
    // ⚠ R.shadowLg was `0 8px 32px rgba(1,40,84,0.13)` and rgb(1,40,84) IS the
    // retired navy — a brand colour hiding in a shadow, invisible to every hex
    // sweep and every R.-keyed needle because it is neither.
    for (const table of [ELEVATION_LIGHT]) {
      for (const role of ['shadow', 'shadowMd', 'shadowLg']) {
        expect(table[role], `${role} carries a non-neutral shadow`).not.toMatch(/\(\s*1\s*,\s*40\s*,\s*84/);
        expect(table[role]).toMatch(/rgba\(0,0,0,/);
      }
    }
  });

  // ⚠ CLAUDE.md's shape 6: AnnouncementPopup threw a ReferenceError on every
  // render while its literal sweep passed. A sweep proves a string is ABSENT; it
  // proves NOTHING about whether the code still runs.
  it('[RED] and the component still RENDERS — a sweep proves absence, not liveness', () => {
    installFetch();
    render(
      <DashboardTab
        setTab={() => {}} pipeline={[]} loading={false}
        userName="Dana Ellis" balance={1250} paidCount={3} sessionToken="t"
      />
    );
    expect(screen.getByText('Your Dashboard')).toBeTruthy();
    expect(screen.getByText('Available Balance')).toBeTruthy();
    // The balance actually rendered its value, so the card ran rather than
    // merely mounting an empty shell.
    expect(screen.getByText('1,250')).toBeTruthy();
  });

  it('[RED] the banner branches render too — the migrated code paths are REACHED', () => {
    // ⚠ THE MIGRATED BANNERS ARE ALL BEHIND CONDITIONS. The render above drives
    // none of them, so without this case every banner assertion in this file is
    // a claim about source text that no execution has ever confirmed.
    installFetch();
    const { container } = render(
      <DashboardTab
        setTab={() => {}} pipeline={[]} loading={false}
        userName="Dana Ellis" balance={0} paidCount={0} sessionToken="t"
        pipelineRateLimited pipelineUnavailable
        bankStatus={{ connected: false }} onOpenBankSetup={() => {}}
      />
    );
    expect(screen.getByText('Connect Your Bank Account')).toBeTruthy();
    expect(screen.getByText(/Pipeline data is temporarily unavailable/)).toBeTruthy();
    expect(screen.getByText(/Pipeline data is currently unavailable/)).toBeTruthy();

    // ⚠ AND THE DECLARATION IS OBSERVED ON THE RENDERED NODE, not just in source.
    // This is the closest jsdom gets to the real question; it still cannot
    // resolve the var(), which is why the harness exists.
    const grounds = [...container.querySelectorAll('div')]
      .filter((d) => d.style.backgroundColor === 'var(--rm-surface, #FFFFFF)');
    expect(grounds.length, 'no banner rendered the surface ground').toBeGreaterThanOrEqual(3);
  });
});

// ── T9 — PALETTE-1'S SHORTFALL FENCES ───────────────────────────────────────
describe('Palette-4a Part B T9 — Palette-1\'s acknowledged shortfalls are not weakened', () => {
  it('[RED] no hairline border clears the 3:1 non-text floor, and that is still true', () => {
    // ⚠ THIS ASSERTS A KNOWN SHORTFALL ON PURPOSE. Adding two shadow roles does
    // not repair the border, and nothing in this phase claimed it did. If a
    // future change DOES clear 3:1 here, this goes red and whoever did it must
    // update the ruling rather than delete the fence.
    const onWhite = compositeRgba(ELEVATION_LIGHT.border, '#FFFFFF');
    const ratio = contrastRatio(onWhite, '#FFFFFF');
    expect(ratio).toBeLessThan(GRAPHIC_FLOOR);
    expect(ratio).toBeGreaterThan(1.0);
  });

  it('[RED] the recess/surface separation is still below 3:1, and still visible', () => {
    eachBrandMode((label, mode, t) => {
      const ratio = contrastRatio(t.recess, t.surface);
      expect(ratio, `${label}/${mode}: recess/surface now clears 3:1 — update the ruling`).toBeLessThan(GRAPHIC_FLOOR);
      expect(ratio, `${label}/${mode}: recess is indistinguishable from surface`).toBeGreaterThan(1.0);
    });
  });
});

// ⚠ THE DOUBLE THROWS ON A SHAPE IT DOES NOT RECOGNISE. A permissive stub that
// can also answer "no data" is indistinguishable from a component that failed to
// ask — the trap the BR arc hit three times, and the reason this is not a bare
// `async () => ({})`.
function installFetch() {
  vi.stubGlobal('fetch', async (url, init) => {
    if (typeof url !== 'string' && !(url instanceof URL)) {
      throw new Error(`fetch double: unexpected url shape ${Object.prototype.toString.call(url)}`);
    }
    if (init !== undefined && (init === null || typeof init !== 'object')) {
      throw new Error('fetch double: init must be an object or absent');
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}
