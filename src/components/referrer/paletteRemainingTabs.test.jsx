// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-6 — the remaining tabs, and the money rule complete
//
// T1  every site resolves to its ruled token
// T2  THE MONEY FENCE, COMPLETE — account money green, projections text tone
// T3  AN INHERITED-OPACITY FENCE — the class that shipped for two phases
// T4  no R. colour, no retired hex tone, no retired decimal tone; they render
// T5  gradient text clears the DARKER STOP, non-vacuously
// T7  Palette-1's shortfall fences are not weakened
//
// ── ⚠ WHAT THESE TESTS CAN AND CANNOT SEE ──────────────────────────────────
// jsdom resolves no var(). These are DECLARATION-level plus ARITHMETIC over the
// derivation; mounted-vs-fallback is the browser harness's half.
// ⚠ AND EVERY CONTRAST CLAIM NAMES ITS PAIR AND RECOMPUTES IT FROM THE TABLES.
// Palette-4c inverted two negative assertions by darkening a text tone while
// nothing about the tint changed; an assertion that names a COLOUR where it
// means a RELATIONSHIP goes stale silently.
//
// ⚠ EXPECTED COUNT: 21 cases in this file.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio, RENDER_TOKEN_KEYS } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';
import { ELEVATION_LIGHT } from '../../constants/elevationTheme';
import CashOutTab from './CashOutTab';
import RankingsTab from './RankingsTab';
import ReferAFriendTab from './ReferAFriendTab';

const SRC = path.resolve(process.cwd(), 'src');
const read = (rel) => fs.readFileSync(path.resolve(SRC, rel), 'utf8');

const FILES = {
  CashOutTab: read('components/referrer/CashOutTab.jsx'),
  RankingsTab: read('components/referrer/RankingsTab.jsx'),
  ReferAFriendTab: read('components/referrer/ReferAFriendTab.jsx'),
  RewardScheduleCard: read('components/referrer/RewardScheduleCard.jsx'),
};
const DASH = read('components/referrer/DashboardTab.jsx');
const PROFILE = read('components/referrer/ProfileTab.jsx');
const POPUP = read('components/referrer/AnnouncementPopup.jsx');

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
const successFor = (m) => (m === 'dark' ? STATUS_DARK.successText : STATUS_LIGHT.successText);

const pxOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function composite(hex, ground, alpha) {
  const f = pxOf(hex), b = pxOf(ground);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}
function compositeRgba(rgba, ground) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(rgba);
  if (!m) throw new Error('compositeRgba: not an rgba(): ' + JSON.stringify(rgba));
  const a = m[4] === undefined ? 1 : parseFloat(m[4]);
  const hex = '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('');
  return composite(hex.toUpperCase(), ground, a);
}

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
const CODE = Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k, codeOnly(v)]));

function installFetch() {
  vi.stubGlobal('fetch', async (url, init) => {
    if (typeof url !== 'string' && !(url instanceof URL)) {
      throw new Error('fetch double: unexpected url shape ' + Object.prototype.toString.call(url));
    }
    if (init !== undefined && (init === null || typeof init !== 'object')) {
      throw new Error('fetch double: init must be an object or absent');
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

describe('Palette-6 — the sweep has something to sweep', () => {
  it('all four sources were read and the stripper left code behind', () => {
    for (const [name, full] of Object.entries(FILES)) {
      expect(full.length, name + ' not read').toBeGreaterThan(3000);
      expect(CODE[name].length).toBeGreaterThan(800);
      expect(CODE[name].length).toBeLessThan(full.length);
    }
  });
});

// ── T1 ──────────────────────────────────────────────────────────────────────
describe('Palette-6 T1 — the ruled destinations', () => {
  it('[RED] each migrated file declares the platform defaults as its fallbacks', () => {
    const light = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    const EXPECT = [
      ['PRIMARY', '--rm-primary', light.primary],
      ['SECONDARY', '--rm-secondary', light.secondary],
      ['ON_SECONDARY', '--rm-on-secondary', light.onSecondary],
      ['SURFACE', '--rm-surface', light.surface],
      ['RECESS', '--rm-recess', light.recess],
      ['TEXT', '--rm-text', light.text],
    ];
    for (const name of Object.keys(FILES)) {
      for (const [c, prop, value] of EXPECT) {
        if (!CODE[name].includes('const ' + c)) continue;
        expect(CODE[name], name + ': ' + c + ' fallback disagrees with the derivation')
          .toContain("'var(" + prop + ', ' + value + ")'");
      }
    }
  });

  it('[RED] the elevation side channel replaced every border and shadow read', () => {
    for (const name of Object.keys(FILES)) {
      expect(CODE[name], name + ' still has no elevationVar').toContain('elevationVar(');
    }
  });

  it('[RED] M.3 — navy split three ways rather than mapped in bulk', () => {
    // fills take onSecondary with them; gradients take the derived partner;
    // text and icons take the text tone.
    expect(CODE.CashOutTab).toContain('color: ON_SECONDARY');
    expect(CODE.CashOutTab).toContain('${SECONDARY} 0%, ${SECONDARY_DARK} 100%');
    expect(CODE.RankingsTab).toContain('period === p.value ? SECONDARY : SURFACE');
    expect(CODE.RankingsTab).toContain('period === p.value ? ON_SECONDARY : TEXT');
  });

  it('[RED] AvatarCircle\'s bg prop now has NO callers, ending its own defect', () => {
    // AvatarCircle hardcodes a #fff foreground whenever `bg` is passed — its
    // documented defect — and RankingsTab was the only caller.
    expect(CODE.RankingsTab).not.toContain('bg={');
    const avatar = read('components/shared/AvatarCircle.jsx');
    expect(avatar, 'the defect comment should still describe the prop').toContain("bg ? '#fff'");
    let callers = 0;
    for (const f of fs.readdirSync(path.resolve(SRC, 'components/referrer'))) {
      if (/\.test\./.test(f)) continue;
      if (/\bbg=\{/.test(read('components/referrer/' + f))) callers++;
    }
    expect(callers, 'a caller of the bg prop reappeared in the referrer tree').toBe(0);
  });
});

// ── T2 — THE MONEY FENCE, COMPLETE ─────────────────────────────────────────
// ⚠ THIS DESCRIBE WAS TITLED *"money in the account is green; everything else is
// text"* AND IT GUARD-PROOFED BOTH DIRECTIONS. Danny reversed the green half on
// 2026-09-05 after seeing it live, so the fence as written guarded the wrong
// thing while staying perfectly green.
// ⚠ IT IS REWRITTEN, NOT DELETED, AND BOTH GUARD-PROOFS ARE KEPT — the fence's
// real value was never the colour it named. It was the CONTRAST between two
// classes of figure: money the user HAS, and everything else. That distinction
// survived the reversal untouched; only the tone on one side of it moved.
describe('Palette-6 T2 (reversed by Palette-9) — account money is the MONEY tone; everything else is text', () => {
  it('[RED] account money is the MONEY tone on all three screens that carry it', () => {
    // Was: *"account money is successText on both screens that carry it"*.
    expect(codeOnly(DASH), 'the Dashboard balance').toContain('color: MONEY');
    expect(codeOnly(PROFILE), 'Profile earnings + Balance row').toContain('MONEY');
    expect(CODE.CashOutTab, 'the completed-cashout figure').toContain('color: MONEY');
  });

  it('[RED] and it clears 4.5:1 on its ground, every brand and mode', () => {
    // ⚠ THE GROUND PAIR MOVED WITH THE TONE. This measured `successText` against
    // `surface`; it now measures the brand-derived money tone against BOTH
    // `surface` and the `recess` the activity rows sit on — the worse of the two,
    // and the one Palette-4c learned about the hard way at 2.93:1.
    eachBrandMode((label, mode, t) => {
      for (const [ground, hex] of [['surface', t.surface], ['recess', t.recess]]) {
        const pair = contrastRatio(t.primaryText, hex);
        expect(pair, label + '/' + mode + ': money on ' + ground + ' is ' + pair.toFixed(2))
          .toBeGreaterThanOrEqual(TEXT_FLOOR);
      }
    });
  });

  it('[RED] every PROJECTION is on the text tone — none is green', () => {
    // the two Dashboard next-payout figures, Profile's stat row, the schedule
    // rows, the prize thresholds, the leaderboard rows, the broadcast payout.
    // ⚠ THE FIRST LINE USED TO READ `not.toContain('color: MONEY')` OVER THE WHOLE
    // DASHBOARD, which is now exactly backwards — the balance is SUPPOSED to say
    // that. A blanket negative over a file cannot distinguish "no projection took
    // the tone" from "nothing took the tone at all", and after the reversal it
    // fails on correct code. The projections are named individually instead.
    expect(codeOnly(DASH), 'the inline projection left the text tone')
      .toContain('<span style={{ color: TEXT, fontWeight: 700 }}>${nextPayout.total}</span>');
    expect(CODE.RewardScheduleCard, 'a schedule row took the money tone').not.toContain('color: MONEY');
    expect(CODE.RankingsTab, 'a prize figure took the money tone').not.toContain('color: MONEY');
    expect(codeOnly(POPUP), "another person's payout took the money tone").not.toContain('color: MONEY');
    expect(CODE.RewardScheduleCard, 'a schedule row went green').not.toContain("statusVar('successText')");
    expect(CODE.RankingsTab, 'a prize or leaderboard figure went green').not.toContain("statusVar('successText')");
    expect(codeOnly(POPUP), "another person's payout went green").not.toContain("statusVar('successText')");
  });

  // ⚠ GUARD-PROOF, DIRECTION ONE.
  it('[RED] GUARD-PROOF — an account figure on the TEXT tone would be indistinguishable from a projection', () => {
    // The two tones must actually differ, or "green means money in the account"
    // is a claim no rendering could falsify.
    eachBrandMode((label, mode, t) => {
      expect(successFor(mode).toUpperCase(), label + '/' + mode + ': the money tone equals the text tone')
        .not.toBe(t.text.toUpperCase());
    });
  });

  // ⚠ GUARD-PROOF, DIRECTION TWO.
  it('[RED] GUARD-PROOF — a projection on successText WOULD be caught', () => {
    const injected = "color: statusVar('successText')";
    expect(CODE.RewardScheduleCard.includes(injected), 'baseline: schedule rows are clean').toBe(false);
    const mutated = CODE.RewardScheduleCard + '\n' + injected;
    expect(mutated.includes(injected), 'the needle cannot see an injected green').toBe(true);
  });

  it('[RED] --rm-primary-text now has EXACTLY THREE code consumers', () => {
    // ⚠ THIS CASE ASSERTED **ZERO** AND IS REWRITTEN RATHER THAN DELETED. It read:
    // *"--rm-primary-text has ZERO code consumers, and the reason is recorded —
    // a consumer of --rm-primary-text reappeared"*, and it fenced the tombstone
    // in DashboardTab explaining why a token nothing read was kept.
    // ⚠ THAT TOMBSTONE IS WHY THIS PHASE WAS A WIRING JOB AND NOT A DERIVATION
    // JOB. The token survived three phases with no consumer because a comment
    // said not to delete it; Palette-9 is the "next brand-coloured text site"
    // that comment predicted.
    // ⚠ THE COUNT IS FENCED IN BOTH DIRECTIONS ON PURPOSE. Too few means a money
    // site was reverted; too many means the tone leaked onto a fourth file, which
    // is how a projection would quietly become account money.
    const consumers = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.(js|jsx|mjs)$/.test(e.name) || /\.test\./.test(e.name)) continue;
        if (/themeTokens|themeKeyIntegrity/.test(e.name)) continue;
        // ⚠ codeOnly() TRACKS BLOCK-COMMENT REGIONS. A per-line startsWith check
        // misses CONTINUATION lines of a /* */ block, which is how this counted a
        // comment as a consumer on its first run.
        if (codeOnly(fs.readFileSync(p, 'utf8')).includes('--rm-primary-text')) consumers.push(e.name);
      }
    };
    walk(SRC);
    expect(consumers.sort(), 'the money tone is not on exactly the three money files')
      .toEqual(['CashOutTab.jsx', 'DashboardTab.jsx', 'ProfileTab.jsx']);
    expect(RENDER_TOKEN_KEYS).toContain('primaryText');
    // and the tombstone must now say the OPPOSITE of what it used to
    expect(DASH, 'the stale zero-consumer tombstone is still there')
      .not.toContain('ZERO CONSUMERS, AND IT IS KEPT ON PURPOSE');
    expect(DASH, 'the reversal is not recorded where the tombstone was')
      .toContain('IT HAD ZERO CONSUMERS FOR THREE');
  });
});

// ── T3 — THE INHERITED-OPACITY FENCE ───────────────────────────────────────
describe('Palette-6 T3 — inherited opacity, the class that shipped for two phases', () => {
  it('[RED] no muted PARENT wraps a non-muted child in any migrated file', () => {
    // ⚠ OPACITY INHERITS AND COLOUR DOES NOT. Palette-5 found a money span
    // nested inside a paragraph carrying `opacity: MUTED`, compositing a correct
    // declaration down to 3.29:1. Every element's own colour was right.
    // This walks the JSX text and flags a line that OPENS a muted element and
    // does not close it before a coloured child appears.
    for (const [name, src] of Object.entries(CODE)) {
      const lines = src.split(/\r?\n/);
      const offenders = [];
      lines.forEach((l, i) => {
        if (!/opacity:\s*MUTED/.test(l)) return;
        // a self-contained element (opens and closes its own tag on one line, or
        // carries its own text) cannot mute a differently-coloured child
        const window_ = lines.slice(i, i + 6).join('\n');
        if (/color:\s*(statusVar|PRIMARY|SECONDARY|ON_)/.test(window_.replace(l, ''))) {
          offenders.push(name + ':' + (i + 1));
        }
      });
      expect(offenders, 'a muted parent may be wrapping a coloured child: ' + offenders.join(', '))
        .toEqual([]);
    }
  });

  it('[RED] GUARD-PROOF — the composited pair the class produces DOES fail', () => {
    // The arithmetic that makes this class a defect rather than a style note.
    eachBrandMode((label, mode, t) => {
      if (mode !== 'light') return;
      const inherited = composite(t.primaryText, t.surface, 0.72);
      const ratio = contrastRatio(inherited, t.surface);
      if (label === 'Gamma (UNSET)') {
        expect(ratio, 'primaryText at 0.72 should be the failure Palette-5 measured')
          .toBeLessThan(TEXT_FLOOR);
      }
    });
  });

  it('[RED] and the muted idiom itself still clears on BOTH its grounds', () => {
    eachBrandMode((label, mode, t) => {
      for (const [g, ground] of [['surface', t.surface], ['recess', t.recess]]) {
        const r = contrastRatio(composite(t.text, ground, 0.72), ground);
        expect(r, label + '/' + mode + ': muted on ' + g + ' is ' + r.toFixed(2))
          .toBeGreaterThanOrEqual(TEXT_FLOOR);
      }
    });
  });
});

// ── T4 — THE SWEEPS ────────────────────────────────────────────────────────
describe('Palette-6 T4 — no R. colour, no retired tone in EITHER form', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('[RED] the needles are validated against known answers', () => {
    const hex = /#012854/gi;
    const dec = /\(\s*1\s*,\s*40\s*,\s*84\s*[,)]/g;
    const c = (re, s) => (s.match(new RegExp(re.source, re.flags)) || []).length;
    expect(c(hex, 'rgba(1,40,84,0.08)')).toBe(0);
    expect(c(dec, 'rgba(1,40,84,0.08)')).toBe(1);
    expect(c(dec, 'rgb(1,40,840)')).toBe(0);
    expect(c(hex, '#012854')).toBe(1);
  });

  it('[RED] no retired tone survives in any of the four, hex OR decimal', () => {
    const NEEDLES = [
      ['#012854', /#012854/gi], ['#041D3E', /#041D3E/gi], ['#CC0000', /#cc0000/gi],
      ['#8C0000', /#8c0000/gi], ['#D3E3F0', /#D3E3F0/gi],
      ['rgb(1,40,84)', /\(\s*1\s*,\s*40\s*,\s*84\s*[,)]/g],
      ['rgb(4,29,62)', /\(\s*4\s*,\s*29\s*,\s*62\s*[,)]/g],
      ['rgb(204,0,0)', /\(\s*204\s*,\s*0\s*,\s*0\s*[,)]/g],
      ['rgb(211,227,240)', /\(\s*211\s*,\s*227\s*,\s*240\s*[,)]/g],
    ];
    const found = [];
    for (const [name, src] of Object.entries(CODE)) {
      for (const [label, re] of NEEDLES) {
        const n = (src.match(new RegExp(re.source, re.flags)) || []).length;
        if (n) found.push(name + ' ' + label + ' ×' + n);
      }
    }
    expect(found, 'retired tones survive: ' + found.join(', ')).toEqual([]);
  });

  it('[RED] and no R. COLOUR key is read in any of the four', () => {
    const R_COLOUR = /(^|[^A-Za-z0-9_.])R\.(red|redDark|navy|navyDark|blueLight|bgBlueLight|bgCard|bgPage|bgCardTint|textPrimary|textSecondary|textMuted|border|borderMed|shadow|shadowMd|shadowLg|green|greenBg|greenText|amber|amberBg|amberText|teal|tealBg|tealText|emerald|emeraldBg|emeraldText)\b/g;
    const hits = [];
    for (const [name, src] of Object.entries(CODE)) {
      R_COLOUR.lastIndex = 0;
      let m;
      while ((m = R_COLOUR.exec(src)) !== null) { hits.push(name + '.' + m[2]); R_COLOUR.lastIndex = m.index + m[0].length; }
    }
    expect(hits.sort()).toEqual([]);
  });

  it('[RED] and all three tabs still RENDER — a sweep proves absence, not liveness', () => {
    installFetch();
    const { unmount: u1 } = render(<CashOutTab pipeline={[]} loading={false} userName="A" userEmail="a@b.co" setTab={() => {}} token="t" />);
    expect(screen.getByText('Cash Out')).toBeTruthy();
    u1();
    const { unmount: u2 } = render(<RankingsTab token="t" />);
    u2();
    render(<ReferAFriendTab userName="A" token="t" />);
    expect(document.body.textContent.length).toBeGreaterThan(20);
  });
});

// ── T5 / T7 ────────────────────────────────────────────────────────────────
describe('Palette-6 T5/T7 — gradient stops and the shortfall fences', () => {
  it('[RED] hero text on a gradient takes FULL onSecondary, not the muted idiom', () => {
    for (const name of ['CashOutTab', 'RankingsTab']) {
      const src = CODE[name];
      const start = src.indexOf('${SECONDARY} 0%, ${SECONDARY_DARK}');
      expect(start, name + ' has no derived-partner hero gradient').toBeGreaterThan(-1);
    }
    // and none of the four uses a raw white alpha on a gradient any more
    for (const [name, src] of Object.entries(CODE)) {
      expect(src, name + ' still has a raw white alpha').not.toContain('rgba(255,255,255,0.5)');
      expect(src, name + ' still has a raw white alpha').not.toContain('rgba(255,255,255,0.6)');
    }
  });

  it('[RED] GUARD-PROOF — the muted idiom DOES fail on a darker stop', () => {
    let sawFailure = false;
    eachBrandMode((label, mode, t) => {
      const muted = composite(t.onSecondary, t.secondaryDark, 0.72);
      if (contrastRatio(muted, t.secondaryDark) < TEXT_FLOOR) sawFailure = true;
      const full = contrastRatio(t.onSecondary, t.secondaryDark);
      expect(full, label + '/' + mode + ': full onSecondary on the dark stop').toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
    expect(sawFailure, 'the muted idiom never failed — this fence guards nothing').toBe(true);
  });

  it('[RED] Palette-1\'s shortfall fences are not weakened', () => {
    const onWhite = compositeRgba(ELEVATION_LIGHT.border, '#FFFFFF');
    expect(contrastRatio(onWhite, '#FFFFFF')).toBeLessThan(GRAPHIC_FLOOR);
    eachBrandMode((label, mode, t) => {
      const sep = contrastRatio(t.recess, t.surface);
      expect(sep, label + '/' + mode + ': recess/surface now clears 3:1 — update the ruling').toBeLessThan(GRAPHIC_FLOOR);
      expect(sep).toBeGreaterThan(1.0);
    });
  });
});
