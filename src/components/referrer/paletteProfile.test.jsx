// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-4b — ProfileTab
//
// T1  every site resolves to its ruled token
// T2  THE BADGE-TEXT FENCE — #999 was 2.53:1 and the grid is mostly unearned
// T3  no R. colour read, no retired HEX tone, and no retired DECIMAL tone
// T4  gradient text clears the DARKER STOP, with a non-vacuity check
// T5  every importer still renders
// T7  Palette-1's shortfall fences are not weakened
//
// ── ⚠ WHAT THESE TESTS CAN AND CANNOT SEE ──────────────────────────────────
// jsdom does not resolve var(). Every assertion here is DECLARATION-level plus
// ARITHMETIC over the derivation: it proves a site NAMES the right property with
// the right fallback, and that the resulting pair clears its floor. IT CANNOT
// PROVE THE PROPERTY WAS MOUNTED — that is R-1's defect class, and it is the
// browser harness's half. A green run here is evidence about declarations and
// arithmetic, and about nothing that was painted.
//
// ⚠ EXPECTED COUNT: 33 cases in this file. Stated because a module that fails to
// LOAD contributes zero while the runner still reports the run as passing.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio, RENDER_TOKEN_KEYS } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { STATUS_LIGHT, STATUS_DARK, STATUS_TINT, STATUS_BANNER, STATUS_VARS } from '../../constants/statusTheme';
import { ELEVATION_LIGHT, ELEVATION_VARS, elevationVar } from '../../constants/elevationTheme';
import ProfileTab from './ProfileTab';

const SRC = path.resolve(process.cwd(), 'src');
const PROFILE = fs.readFileSync(path.resolve(SRC, 'components/referrer/ProfileTab.jsx'), 'utf8');
// ⚠ /\r?\n/ — `.` does not match `\r`, and core.autocrlf=true is the Windows default.
const LINES = PROFILE.split(/\r?\n/);

const TEXT_FLOOR = 4.5;
const GRAPHIC_FLOOR = 3;

const BRANDS = [
  ['Gamma (UNSET)', null],
  ['Alpha', { primary_color: '#1C2D4D', secondary_color: '#F26A1B' }],
  ['Beta', { primary_color: '#0B3D3B', secondary_color: '#C2185B' }],
  ['Accent-shaped', { primary_color: '#012854', secondary_color: '#CC0000' }],
];
const MODES = ['light', 'dark'];

function eachBrandMode(fn) {
  for (const [label, src] of BRANDS) {
    for (const mode of MODES) fn(label, mode, deriveThemeTokens(resolveBrandingTheme(src), mode));
  }
}

const pxOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function composite(hex, ground, alpha) {
  const f = pxOf(hex), b = pxOf(ground);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}
function compositeRgba(rgba, ground) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(rgba);
  if (!m) throw new Error(`compositeRgba: not an rgba() value: ${JSON.stringify(rgba)}`);
  const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
  const hex = '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('');
  return composite(hex.toUpperCase(), ground, alpha);
}

// Comments stripped for the CODE-level questions only. NOT a comments-are-exempt
// carve-out: themeKeyIntegrity.test.js sweeps prose too and keeps none.
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
const CODE = codeOnly(PROFILE);

// ⚠ THE DOUBLE THROWS ON A SHAPE IT DOES NOT RECOGNISE. A permissive stub that
// can also answer "no data" is indistinguishable from a component that failed to
// ask — the trap the BR arc hit three times.
function installFetch() {
  vi.stubGlobal('fetch', async (url, init) => {
    if (typeof url !== 'string' && !(url instanceof URL)) {
      throw new Error(`fetch double: unexpected url shape ${Object.prototype.toString.call(url)}`);
    }
    if (init !== undefined && (init === null || typeof init !== 'object')) {
      throw new Error('fetch double: init must be an object or absent');
    }
    return { ok: true, status: 200, json: async () => [] };
  });
}

const PROPS = {
  onLogout: () => {}, pipeline: [], loading: false,
  userName: 'Dana Ellis', userEmail: 'dana@example.test',
  onNameUpdate: () => {}, setProfilePhoto: () => {},
  onResetHighlight: () => {}, refreshBankStatus: () => {},
  onResetOpenManageAccount: () => {},
};

// ⚠ NON-VACUITY, FIRST AND UNCONDITIONALLY.
describe('Palette-4b — the sweep has something to sweep', () => {
  it('the source was read and the comment stripper left code behind', () => {
    expect(PROFILE.length).toBeGreaterThan(25000);
    expect(LINES.length).toBeGreaterThan(800);
    expect(CODE.length).toBeGreaterThan(10000);
    expect(CODE.length).toBeLessThan(PROFILE.length);
    expect(CODE).toContain('export default function Profile');
  });
});

// ── T1 — THE RULED DESTINATIONS ─────────────────────────────────────────────
describe('Palette-4b T1 — every site resolves to its ruled token', () => {
  it('[RED] the token constants declare the platform defaults as their fallbacks', () => {
    const light = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    const EXPECT = [
      ['PRIMARY', '--rm-primary', light.primary],
      ['SECONDARY', '--rm-secondary', light.secondary],
      ['SECONDARY_DARK', '--rm-secondary-dark', light.secondaryDark],
      ['ON_SECONDARY', '--rm-on-secondary', light.onSecondary],
      ['SURFACE', '--rm-surface', light.surface],
      ['RECESS', '--rm-recess', light.recess],
    ];
    for (const [name, prop, value] of EXPECT) {
      expect(CODE, `${name} missing`).toContain(`const ${name}`);
      expect(CODE, `${name} fallback disagrees with the derivation`).toContain(`'var(${prop}, ${value})'`);
    }
    // The muted idiom is the one shared value, not a tenth pattern.
    expect(CODE).toContain('const MUTED = 0.72');
  });

  it('[RED] M.3 — navy split three ways: text, fills, and the gradient', () => {
    // Fills take onSecondary with them; text takes --rm-text.
    expect(CODE).toContain('background: `linear-gradient(145deg, ${SECONDARY} 0%, ${SECONDARY_DARK} 100%)`');
    expect(CODE).toContain('background: SECONDARY, color: ON_SECONDARY');           // badges Retry
    expect(CODE).toContain('background: !shoutOptOut ? SECONDARY : ');               // the toggle track
    expect(CODE).toContain('filter === f ? SECONDARY : RECESS');                     // filter pills
    expect(CODE).toContain('selected ? SECONDARY : RECESS');                         // shout pills
    // Six section/stat icons and the badge name became body text, not brand.
    const asText = CODE.split("color: 'var(--rm-text, #1C2D4D)'").length - 1;
    expect(asText, 'expected the text/icon sites to be on --rm-text').toBeGreaterThanOrEqual(20);
  });

  it('[RED] the elevation side channel replaced every border and shadow read', () => {
    for (const call of ["elevationVar('border')", "elevationVar('shadow')", "elevationVar('shadowMd')"]) {
      expect(CODE, `${call} is not used`).toContain(call);
    }
    // ⚠ ASSERTED ON THE CALL, NOT THE EMITTED STRING — the source holds the call;
    // `var(--rm-border, …)` is what it RETURNS, and a test grepping the return
    // value fails against correct code. Palette-3 hit that once.
    expect(elevationVar('shadowMd')).toBe(`var(${ELEVATION_VARS.shadowMd}, ${ELEVATION_LIGHT.shadowMd})`);
  });

  it('[RED] the Sign Out button repairs a hover state that was under the floor', () => {
    // ⚠ MEASURED BEFORE: #dc2626 on #fff5f5 is 4.51:1 and on the HOVER fill
    // #fee2e2 is 3.95:1 — a destructive control that got LESS readable on hover.
    expect(contrastRatio('#dc2626', '#fee2e2')).toBeLessThan(TEXT_FLOOR);
    // After: surface at rest, the danger tint on hover, dangerText throughout.
    const tint = compositeRgba(STATUS_TINT.danger, '#FFFFFF');
    expect(contrastRatio(STATUS_LIGHT.dangerText, '#FFFFFF')).toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(contrastRatio(STATUS_LIGHT.dangerText, tint)).toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(contrastRatio(STATUS_LIGHT.danger, '#FFFFFF')).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    expect(CODE).toContain('onMouseEnter={e => e.currentTarget.style.background = STATUS_TINT.danger}');
  });

  it('[RED] the upload error moved its GROUND rather than its text', () => {
    // Both obvious routes fail on the hero: the held literal #fca5a5 is 2.40:1 in
    // dark, and statusVar('dangerText') mounts #B91C1C on that navy at 2.87:1.
    const gammaLight = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    const gammaDark = deriveThemeTokens(resolveBrandingTheme(null), 'dark');
    expect(contrastRatio('#fca5a5', gammaDark.secondaryDark)).toBeLessThan(TEXT_FLOOR);
    expect(contrastRatio(STATUS_LIGHT.dangerText, gammaLight.secondaryDark)).toBeLessThan(TEXT_FLOOR);
    // So it sits on STATUS_BANNER.danger, which measures in both modes.
    expect(CODE).toContain('...STATUS_BANNER.danger');
    expect(STATUS_BANNER.danger.backgroundColor).toBe('var(--rm-surface, #FFFFFF)');
    expect(STATUS_BANNER.danger.border).toBe(`1px solid var(${STATUS_VARS.danger}, ${STATUS_LIGHT.danger})`);
  });

  it('[RED] the icon badge is the only thing grounded on the tint, and it is a GRAPHIC', () => {
    // STATUS_TINT grounding an icon tile is the 3:1 graphic use its own header
    // sanctions. Nothing else in this file was moved onto it.
    expect(CODE).toContain('background: STATUS_TINT.success');

    // ⚠ THIS CASE'S CLOSING ASSERTION WAS INVERTED BY PALETTE-4c, AND IT IS
    // REWRITTEN RATHER THAN DELETED. It read:
    //     expect(contrastRatio(STATUS_LIGHT.successText, tint)).toBeLessThan(TEXT_FLOOR)
    // under the comment "the reason nothing else moved: the tint cannot carry
    // text" — true at 4.39:1 when it was written, and FALSE at 5.00:1 now,
    // because 4c darkened successText. Nothing about the tint changed.
    // ⚠ A NEGATIVE ASSERTION WHOSE PURPOSE REVERSES IS THE FENCE CLAUDE.md WARNS
    // ABOUT: still green, still true-looking, and now guarding nothing. The
    // WARNING half is what still pins the rule, so that is what is asserted.
    const warningTint = compositeRgba(STATUS_TINT.warning, '#FFFFFF');
    expect(contrastRatio(STATUS_LIGHT.warningText, warningTint)).toBeLessThan(TEXT_FLOOR);

    // And what the tile actually paints: the TEXT tone as the glyph, clearing
    // the graphic floor with room, which is the Palette-4c repair.
    eachBrandMode((label, mode, t) => {
      if (mode !== 'light') return;
      const tile = compositeRgba(STATUS_TINT.success, t.recess);
      expect(contrastRatio(STATUS_LIGHT.successText, tile), label + ': icon on tile')
        .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });
});

// ── T2 — THE BADGE-TEXT FENCE ───────────────────────────────────────────────
describe('Palette-4b T2 — THE BADGE-TEXT FENCE', () => {
  it('[RED] every badge-grid text pair clears 4.5:1 on every seeded brand', () => {
    // The tiles are recessed wells: ground is --rm-recess, NOT a gradient, so the
    // muted idiom is measured against the tile itself.
    eachBrandMode((label, mode, t) => {
      const muted = composite(t.text, t.recess, 0.72);
      const mutedRatio = contrastRatio(muted, t.recess);
      const nameRatio = contrastRatio(t.text, t.recess);
      expect(mutedRatio, `${label}/${mode}: date + unearned name is ${mutedRatio.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
      expect(nameRatio, `${label}/${mode}: earned badge name is ${nameRatio.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  // ⚠ GUARD-PROOF. Without this the case above is arithmetic about a number
  // nobody chose, and would pass identically against unmigrated code.
  it('[RED] GUARD-PROOF — the #999 it replaced FAILS, on every brand', () => {
    let sawFailure = false;
    eachBrandMode((label, mode, t) => {
      if (mode !== 'light') return;
      const before = contrastRatio('#999999', t.recess);
      if (before < TEXT_FLOOR) sawFailure = true;
    });
    expect(sawFailure, '#999 never failed — the badge fence guards nothing').toBe(true);
    expect(contrastRatio('#999999', '#EEF2F7')).toBeCloseTo(2.53, 1);
    // And the literal is gone from the code.
    expect(CODE).not.toContain('"#999"');
    expect(CODE).not.toContain('"#888"');
  });

  it('[RED] the grid still has NO border and NO shadow — A.3 stands unchanged', () => {
    // The tiles are defined by fill alone, deliberately: non-interactive, and the
    // boundary is not required to understand the content. This asserts the phase
    // did not quietly "improve" that while fixing the text.
    const tiles = CODE.split('background: RECESS, borderRadius: 12, padding: "14px 10px"').length - 1;
    expect(tiles, 'expected the three badge tile variants on the recess').toBe(3);
    const tileBlock = CODE.slice(CODE.indexOf('background: RECESS, borderRadius: 12, padding: "14px 10px"'));
    expect(tileBlock.slice(0, 400)).not.toContain('boxShadow');
  });
});

// ── T3 — THE SWEEPS ─────────────────────────────────────────────────────────
describe('Palette-4b T3 — no R. colour, no retired tone in EITHER form', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('[RED] the needles are validated against known answers before being trusted', () => {
    // ⚠ A SWEEP RETURNING A NUMBER IS A TOOL REPORT until the pattern has been run
    // against a case whose answer is already known.
    const hexRed = /#cc0000/gi;
    const decRed = /\(\s*204\s*,\s*0\s*,\s*0\s*[,)]/g;
    const decBlue = /\(\s*211\s*,\s*227\s*,\s*240\s*[,)]/g;
    const c = (re, s) => (s.match(new RegExp(re.source, re.flags)) || []).length;
    // ⚠ THE ASYMMETRY IS THE WHOLE POINT: this file's ONE retired tone was
    // decimal-only, so a hex-only sweep would have reported it clean.
    expect(c(hexRed, 'rgba(204,0,0,0.3)')).toBe(0);
    expect(c(decRed, 'rgba(204,0,0,0.3)')).toBe(1);
    expect(c(decRed, 'rgba(2040,0,0,1)')).toBe(0);
    expect(c(decBlue, 'rgba(211,227,240,0.08)')).toBe(1);
    expect(c(decBlue, 'rgb(211,227,2400)')).toBe(0);
    expect(c(hexRed, '#CC0000')).toBe(1);
  });

  it('[RED] no retired Accent tone survives in code, hex OR decimal', () => {
    const NEEDLES = [
      ['#012854 hex', /#012854/gi], ['#041D3E hex', /#041D3E/gi],
      ['#CC0000 hex', /#cc0000/gi], ['#8C0000 hex', /#8c0000/gi], ['#D3E3F0 hex', /#D3E3F0/gi],
      ['rgb(1,40,84) decimal', /\(\s*1\s*,\s*40\s*,\s*84\s*[,)]/g],
      ['rgb(4,29,62) decimal', /\(\s*4\s*,\s*29\s*,\s*62\s*[,)]/g],
      ['rgb(204,0,0) decimal', /\(\s*204\s*,\s*0\s*,\s*0\s*[,)]/g],
      ['rgb(211,227,240) decimal', /\(\s*211\s*,\s*227\s*,\s*240\s*[,)]/g],
    ];
    const found = [];
    for (const [label, re] of NEEDLES) {
      const n = (CODE.match(new RegExp(re.source, re.flags)) || []).length;
      if (n) found.push(`${label} ×${n}`);
    }
    expect(found, `retired tones survive: ${found.join(', ')}`).toEqual([]);
  });

  it('[RED] the surviving R. colour reads are EXACTLY the A.2 hold', () => {
    // ⚠ ASSERTED BY EQUALITY, NOT "AT MOST". If a sixth read appears, this goes
    // RED and whoever added it must say why.
    const R_COLOUR = /(^|[^A-Za-z0-9_.])R\.(red|redDark|navy|navyDark|blueLight|bgBlueLight|bgCard|bgPage|bgCardTint|textPrimary|textSecondary|textMuted|border|borderMed|shadow|shadowMd|shadowLg|green|greenBg|greenText|amber|amberBg|amberText|teal|tealBg|tealText|emerald|emeraldBg|emeraldText)\b/g;
    const hits = [];
    let m;
    R_COLOUR.lastIndex = 0;
    while ((m = R_COLOUR.exec(CODE)) !== null) { hits.push(m[2]); R_COLOUR.lastIndex = m.index + m[0].length; }
    // ⚠ NARROWED IN PALETTE-4c, AND ONLY FOR SITES THAT ACTUALLY MOVED. The three
    // money reads (green x2, emeraldText) are gone because they were migrated;
    // tealText and the reports pill are STILL HELD and are STILL NAMED. A fence
    // loosened to match the code stops being a fence -- the test of whether this
    // edit was honest is that it got SHORTER by exactly the three that moved.
    expect(hits.sort()).toEqual(
      ['amberBg', 'amberText', 'greenBg', 'greenText', 'tealText']
    );
  });

  // ⚠ CLAUDE.md's shape 6: a sweep proves a string is ABSENT and NOTHING about
  // whether the code still runs.
  it('[RED] and ProfileTab still RENDERS — a sweep proves absence, not liveness', () => {
    installFetch();
    render(<ProfileTab {...PROPS} />);
    expect(screen.getByText('Dana Ellis')).toBeTruthy();
    expect(screen.getByText('My Referrals')).toBeTruthy();
    expect(screen.getByText('My Badges')).toBeTruthy();
  });

  it('[RED] V5 — the already-migrated primitives still render inside this tab', () => {
    // AvatarCircle moved in Palette-3; StatusBadge stayed on the status system
    // deliberately. Neither was re-migrated here, so this is the proof they still
    // mount rather than an assertion that they changed.
    installFetch();
    const { container } = render(
      <ProfileTab {...PROPS} pipeline={[{ id: 1, name: 'Sam Reed', status: 'complete', bonusEarned: true, conversion_bonus: 500 }]} />
    );
    // AvatarCircle renders the initials of the user name.
    expect(screen.getByText('DE')).toBeTruthy();
    // ⚠ ANCHORED ON THE FULL LABEL, NOT /Complete/. That fragment matches TWO
    // nodes — the filter pill reading "Complete" and StatusBadge's own
    // "Complete ✓" — and getByText THROWS on multiple matches, so the test would
    // fail for a reason with nothing to do with the behaviour under test.
    expect(screen.getByText('Complete ✓')).toBeTruthy();
    expect(container.querySelectorAll('div').length).toBeGreaterThan(20);
  });
});

// ── T4 — THE GRADIENT'S DARKER STOP ─────────────────────────────────────────
describe('Palette-4b T4 — text on the hero clears the DARKER STOP', () => {
  it('[RED] full onSecondary clears secondaryDark on every brand and mode', () => {
    eachBrandMode((label, mode, t) => {
      const ratio = contrastRatio(t.onSecondary, t.secondaryDark);
      expect(ratio, `${label}/${mode}: hero text on the dark stop is ${ratio.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  // ⚠ GUARD-PROOF + NON-VACUITY, exactly as Palette-4a fenced its own hero.
  it('[RED] GUARD-PROOF — the alphas this replaced FAIL there, and so does the muted idiom', () => {
    let sawAlphaFailure = false;
    let sawMutedFailure = false;
    eachBrandMode((label, mode, t) => {
      const a50 = contrastRatio(compositeRgba('rgba(255,255,255,0.5)', t.secondaryDark), t.secondaryDark);
      const a60 = contrastRatio(compositeRgba('rgba(255,255,255,0.6)', t.secondaryDark), t.secondaryDark);
      const muted = contrastRatio(composite(t.onSecondary, t.secondaryDark, 0.72), t.secondaryDark);
      if (a50 < TEXT_FLOOR || a60 < TEXT_FLOOR) sawAlphaFailure = true;
      if (muted < TEXT_FLOOR) sawMutedFailure = true;
    });
    expect(sawAlphaFailure, 'the 0.5/0.6 whites never failed — this phase fixed nothing').toBe(true);
    expect(sawMutedFailure, 'the muted idiom never failed on a dark stop — the exception guards nothing').toBe(true);
  });

  it('[RED] so NOTHING on the hero carries the muted alpha', () => {
    // The hero block runs from the gradient to the upload error. If a muted site
    // ever appears inside it, this goes red — which is the regression Palette-4a
    // had to fix after the fact.
    const start = CODE.indexOf('linear-gradient(145deg, ${SECONDARY}');
    const end = CODE.indexOf('STATUS_BANNER.danger');
    expect(start, 'the hero gradient was not found').toBeGreaterThan(-1);
    expect(end, 'the hero upload-error block was not found').toBeGreaterThan(start);
    expect(CODE.slice(start, end)).not.toContain('opacity: MUTED');
  });

  it('[RED] and the muted idiom IS used off the hero, where its ground is flat', () => {
    // ⚠ The complement of the case above. Without it, "no muted on the hero"
    // would be satisfied by a file that had abandoned the idiom entirely.
    const mutedSites = CODE.split('opacity: MUTED').length - 1;
    expect(mutedSites, 'the muted idiom vanished from the file').toBeGreaterThan(15);
    eachBrandMode((label, mode, t) => {
      const onRecess = contrastRatio(composite(t.text, t.recess, 0.72), t.recess);
      const onSurface = contrastRatio(composite(t.text, t.surface, 0.72), t.surface);
      expect(onRecess, `${label}/${mode}: muted on recess ${onRecess.toFixed(2)}`).toBeGreaterThanOrEqual(TEXT_FLOOR);
      expect(onSurface, `${label}/${mode}: muted on surface ${onSurface.toFixed(2)}`).toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });
});

// ── T5 — IMPORTERS ──────────────────────────────────────────────────────────
describe('Palette-4b T5 — the tab renders in each of its data states', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('[RED] loading, empty and populated all render', () => {
    installFetch();
    const { unmount: u1 } = render(<ProfileTab {...PROPS} loading />);
    expect(screen.getByText('My Referrals')).toBeTruthy();
    u1();
    const { unmount: u2 } = render(<ProfileTab {...PROPS} />);
    expect(screen.getByText(/No referrals in this category yet/)).toBeTruthy();
    u2();
    render(<ProfileTab {...PROPS} pipeline={[{ id: 2, name: 'Ada Kim', status: 'lead' }]} />);
    expect(screen.getByText('Ada Kim')).toBeTruthy();
  });

  it('[RED] the upload-error branch is DRIVEN, and renders its banner', () => {
    // ⚠ THE MIGRATED BRANCH MUST BE REACHED. The first version of this case
    // asserted a surface-ground element existed without ever setting the error —
    // it passed on the cards and proved nothing about the banner, which is the
    // "green by construction" shape this suite exists to refuse. The size guard
    // sets uploadError SYNCHRONOUSLY, so the branch is genuinely reachable.
    installFetch();
    const { container } = render(<ProfileTab {...PROPS} />);
    const input = container.querySelector('input[type="file"]');
    expect(input, 'the photo input was not rendered').toBeTruthy();

    const tooBig = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(tooBig, 'size', { value: 3 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [tooBig] } });

    const msg = screen.getByText('Photo must be under 2MB');
    expect(msg).toBeTruthy();
    // ⚠ AND THE GROUND IS OBSERVED ON THE RENDERED NODE. jsdom still resolves no
    // var(), so this proves the DECLARATION reached the element, not the pixel.
    const banner = msg.closest('div');
    expect(banner.style.backgroundColor).toBe('var(--rm-surface, #FFFFFF)');
    expect(banner.style.border).toContain('var(--rm-danger, #DC2626)');
    expect(msg.style.color).toBe('var(--rm-danger-text, #B91C1C)');
  });
});

// ── T7 — PALETTE-1'S SHORTFALL FENCES ───────────────────────────────────────
describe('Palette-4b T7 — Palette-1\'s acknowledged shortfalls are not weakened', () => {
  it('[RED] no hairline border clears 3:1, and the badge grid still relies on fill', () => {
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

// -- PALETTE-4c -- MONEY IS SEMANTICALLY GREEN -------------------------------
describe('Palette-4c T1/T2 - successText is a FIXED green, floored on both grounds', () => {
  it('[RED] it clears 4.5:1 against surface AND recess, every brand, both modes', () => {
    eachBrandMode((label, mode, t) => {
      const tone = mode === 'dark' ? STATUS_DARK.successText : STATUS_LIGHT.successText;
      const onSurface = contrastRatio(tone, t.surface);
      const onRecess = contrastRatio(tone, t.recess);
      expect(onSurface, label + '/' + mode + ': successText on surface is ' + onSurface.toFixed(2))
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
      expect(onRecess, label + '/' + mode + ': successText on recess is ' + onRecess.toFixed(2))
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  // THE RULING'S OWN FENCE, AND ITS FIRST DRAFT WAS VACUOUS -- RECORDED BECAUSE
  // THE BRIEF ASKED THE EXACT QUESTION THAT CAUGHT IT.
  // It read: for each brand, add STATUS_LIGHT.successText to a Set, then assert
  // the Set has one member. That reads ONE CONSTANT N TIMES. `seen.size` is 1 no
  // matter what any brand does, so the assertion could not fail -- it asserted
  // that a constant equals itself while appearing to assert brand-invariance.
  // ⚠ THE FIX IS STRUCTURAL, NOT A BETTER ASSERTION ON THE SAME READING.
  // "Brand-invariant" is not a fact about a value; it is a fact about WHERE the
  // value comes from. A colour is brand-derivable if and only if it is a render
  // token, because deriveThemeTokens is the only thing that takes a brand. So
  // the falsifiable claim is: successText is NOT in the render set, and no
  // brand's derivation produces it.
  it('[RED] it is BRAND-INVARIANT BY CONSTRUCTION - it is not a render token', () => {
    expect(RENDER_TOKEN_KEYS, 'successText is in the render set, so it CAN be brand-derived')
      .not.toContain('successText');
    for (const [label, src] of BRANDS) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        expect(Object.keys(t), label + '/' + mode + ': the derivation emits a successText')
          .not.toContain('successText');
      }
    }
    // And the money sites reach it through statusVar, which takes no brand.
    expect(CODE).toContain("statusVar('successText')");
  });

  it('[RED] GUARD-PROOF - a brand-DERIVED tone DOES vary, which is what the fence excludes', () => {
    // primaryText is the derived counterpart. It takes a different value per
    // brand, which is exactly the property successText must NOT have -- so this
    // shows the distinction the case above turns on is real and observable.
    const derived = BRANDS.map(function (b) {
      return deriveThemeTokens(resolveBrandingTheme(b[1]), 'light').primaryText;
    });
    expect(new Set(derived).size, 'a derived token did not vary - the contrast proves nothing')
      .toBeGreaterThan(1);
    // ⚠ AND THE RENDER SET GENUINELY CONTAINS THAT ONE, so "not in RENDER_TOKEN_KEYS"
    // above is a discriminating check rather than a check against an empty list.
    expect(RENDER_TOKEN_KEYS).toContain('primaryText');
  });

  it('[RED] the value has MARGIN, not a hundredth', () => {
    // #147C3B cleared the worst derivable recess by 0.01 and was rejected for
    // exactly the reason the Sign Out button failed: a floor met by a hundredth
    // is broken by the next change to the ground.
    const WORST_RECESS = '#ECECF9';
    expect(contrastRatio('#147C3B', WORST_RECESS)).toBeLessThan(4.6);
    expect(contrastRatio(STATUS_LIGHT.successText, WORST_RECESS)).toBeGreaterThan(4.7);
  });
});

describe('Palette-4c T3 - every money figure in ProfileTab', () => {
  it('[RED] the money sites and the activity icon declare successText', () => {
    const sites = CODE.split("color: statusVar('successText')").length - 1;
    expect(sites, 'expected four successText declarations').toBe(4);
    expect(CODE).not.toContain('color: R.green,');
    expect(CODE).not.toContain('color: R.emeraldText,');
  });

  it('[RED] GUARD-PROOF - the greens they replaced were LIVE FAILURES', () => {
    eachBrandMode((label, mode, t) => {
      if (mode !== 'light') return;
      expect(contrastRatio('#16a34a', t.surface)).toBeLessThan(TEXT_FLOOR);
      expect(contrastRatio('#16a34a', t.recess)).toBeLessThan(TEXT_FLOOR);
    });
    // And the OLD successText was under the floor on recess, which is why these
    // sites could not simply have been pointed at it before this phase.
    const plat = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    expect(contrastRatio('#15803D', plat.recess)).toBeLessThan(TEXT_FLOOR);
    expect(contrastRatio(STATUS_LIGHT.successText, plat.recess)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it('[RED] the activity icon repairs a regression Palette-4b shipped', () => {
    // Before 4b: R.green on the SOLID R.greenBg = exactly 3.00:1, at the floor.
    // 4b moved the ground to a 0.12 tint over the recess and it fell to 2.55:1.
    expect(contrastRatio('#16a34a', '#dcfce7')).toBeCloseTo(3.00, 1);
    eachBrandMode((label, mode, t) => {
      if (mode !== 'light') return;
      const tile = compositeRgba(STATUS_TINT.success, t.recess);
      expect(contrastRatio('#16A34A', tile), label + ': the OLD icon tone on the tile')
        .toBeLessThan(GRAPHIC_FLOOR);
      expect(contrastRatio(STATUS_LIGHT.successText, tile), label + ': the repaired icon')
        .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });

  it('[RED] no money figure in this file sits on a gradient (B.5)', () => {
    // The hero is the only gradient and it carries no money. If a money figure
    // ever moves onto it, its floor becomes the DARKER STOP.
    const heroStart = CODE.indexOf('linear-gradient(145deg,');
    const heroEnd = CODE.indexOf('STATUS_BANNER.danger');
    expect(heroStart).toBeGreaterThan(-1);
    expect(heroEnd).toBeGreaterThan(heroStart);
    expect(CODE.slice(heroStart, heroEnd)).not.toContain("statusVar('successText')");
  });
});

describe('Palette-4c B.2/B.3 - what stayed held, and why', () => {
  it('[RED] "Joined your network" keeps R.tealText - a status LABEL, not money', () => {
    expect(CODE).toContain('color: R.tealText');
    // It clears its floor and means what it paints, so the correct outcome is
    // leaving it alone. STATUS_CONFIG.app_user.color is the same value.
    const plat = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    expect(contrastRatio('#0e7490', plat.recess)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it('[RED] the reports pill keeps its own *Bg pair - the tint would be WORSE', () => {
    expect(CODE).toContain('report.resolved ? R.greenBg : R.amberBg');
    const warningTint = compositeRgba(STATUS_TINT.warning, '#FFFFFF');
    const successTint = compositeRgba(STATUS_TINT.success, '#FFFFFF');
    // What it measures today, on its own solid grounds.
    expect(contrastRatio('#15803d', '#dcfce7')).toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(contrastRatio('#b45309', '#fef3c7')).toBeGreaterThanOrEqual(TEXT_FLOOR);
    // THE WARNING HALF PINS THE DECISION: on the tint it is still under the
    // floor, so moving the pair would break one of the two.
    expect(contrastRatio(STATUS_LIGHT.warningText, warningTint)).toBeLessThan(TEXT_FLOOR);
    // The success half now clears on the tint only because Palette-4c darkened
    // the TEXT tone -- recorded so nobody reads it as the tint having improved.
    expect(contrastRatio(STATUS_LIGHT.successText, successTint)).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });
});
