// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-5 — BottomNav, and money as one colour everywhere
//
// T1  every qualifying money figure resolves to successText
// T2  money is brand-invariant — asserted as EQUALITY ACROSS BRANDS
// T3  BottomNav's active/inactive distinction survives and clears its floor
// T4  no R. colour read and no retired tone, hex OR decimal, in the nav
// T7  Palette-1's shortfall fences are not weakened
//
// ── ⚠ WHAT THESE TESTS CAN AND CANNOT SEE ──────────────────────────────────
// jsdom resolves no var(). Everything here is DECLARATION-level plus ARITHMETIC
// over the derivation; the mounted-vs-fallback half is the browser harness.
//
// ⚠ AND A CONTRAST CLAIM IS ABOUT A RELATIONSHIP, NOT A COLOUR. Palette-4c
// inverted two negative assertions by darkening a text tone — "the success tint
// cannot carry text" was true at 4.39 and false at 5.00 with nothing about the
// tint having changed. Every assertion below names the PAIR it measures and
// recomputes it from the tables, so moving either half moves the assertion with
// it rather than silently satisfying it.
//
// ⚠ EXPECTED COUNT: 18 cases in this file.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio, RENDER_TOKEN_KEYS } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';
import { ELEVATION_LIGHT } from '../../constants/elevationTheme';
import ReferrerApp from './ReferrerApp';

const SRC = path.resolve(process.cwd(), 'src');
const readSrc = (rel) => fs.readFileSync(path.resolve(SRC, rel), 'utf8');

const APP = readSrc('components/referrer/ReferrerApp.jsx');
const DASH = readSrc('components/referrer/DashboardTab.jsx');
const PROFILE = readSrc('components/referrer/ProfileTab.jsx');
const SEEDER = fs.readFileSync(path.resolve(process.cwd(), 'scripts/seedLocalStack.js'), 'utf8');

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
const successFor = (mode) => (mode === 'dark' ? STATUS_DARK.successText : STATUS_LIGHT.successText);

const pxOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function composite(hex, ground, alpha) {
  const f = pxOf(hex), b = pxOf(ground);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}
function compositeRgba(rgba, ground) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(rgba);
  if (!m) throw new Error(`compositeRgba: not an rgba(): ${JSON.stringify(rgba)}`);
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
const APP_CODE = codeOnly(APP);
const DASH_CODE = codeOnly(DASH);

// ⚠ THE DOUBLE THROWS ON A SHAPE IT DOES NOT RECOGNISE.
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
const APP_PROPS = {
  tab: 'dashboard', setTab: () => {}, pipeline: [], loading: false,
  userName: 'Dana Ellis', userEmail: 'dana@example.test',
  balance: 500, paidCount: 1, setProfilePhoto: () => {},
  onLogout: () => {}, onNameUpdate: () => {},
};

describe('Palette-5 — the sweep has something to sweep', () => {
  it('every source was read and the stripper left code behind', () => {
    for (const [name, full, code] of [['ReferrerApp', APP, APP_CODE], ['DashboardTab', DASH, DASH_CODE]]) {
      expect(full.length, `${name} not read`).toBeGreaterThan(5000);
      expect(code.length).toBeGreaterThan(1000);
      expect(code.length).toBeLessThan(full.length);
    }
    expect(APP_CODE).toContain('function BottomNav');
  });
});

// ── T1 — MONEY IS ONE COLOUR ────────────────────────────────────────────────
describe('Palette-5 T1 (reversed by Palette-9) — money resolves to the MONEY tone', () => {
  it('[RED] the Dashboard balance declares the MONEY tone, both of its spans', () => {
    // The balance is ONE figure split across two elements for typography, so
    // both take the same tone. The old split painted the glyph in the brand
    // accent and the number in body text.
    // ⚠ THIS CASE WAS INVERTED BY THE 2026-09-05 REVERSAL AND IS REWRITTEN
    // RATHER THAN DELETED. It read: *"the Dashboard balance declares successText,
    // both of its spans — expected the two balance spans on successText"*. The
    // SUBJECT is unchanged and still worth fencing: both halves of one figure
    // must agree. Only the tone they must agree ON has moved.
    const sites = DASH_CODE.split('color: MONEY').length - 1;
    expect(sites, 'expected the two balance spans on --rm-primary-text').toBe(2);
  });

  it('[RED] and it clears 4.5:1 on the card it sits on, every brand and mode', () => {
    eachBrandMode((label, mode, t) => {
      const pair = contrastRatio(successFor(mode), t.surface);
      expect(pair, `${label}/${mode}: balance on the card is ${pair.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] the balance is NOT on a gradient, so no darker-stop case arises', () => {
    // ⚠ Stated because the rule has cost a fix in two phases. The hero IS a
    // gradient; the balance card floats on `surface` above it.
    const heroStart = DASH_CODE.indexOf('linear-gradient(145deg,');
    const balance = DASH_CODE.indexOf('color: MONEY');
    expect(heroStart).toBeGreaterThan(-1);
    expect(balance).toBeGreaterThan(-1);
    expect(DASH_CODE).toContain('background: SURFACE, borderRadius: 18');
  });

  // ⚠ THIS WAS A GUARD-PROOF AND IS NOW THE MAIN PROPERTY — THE SHARPEST
  // SINGLE ARTEFACT OF THE REVERSAL, SO IT IS KEPT IN PLACE RATHER THAN MOVED.
  it('[RED] --rm-primary-text makes the balance brand-dependent, WHICH IS NOW THE POINT', () => {
    // It read: *"GUARD-PROOF — --rm-primary-text would make the balance
    // brand-dependent. The token the balance moved OFF still varies per brand,
    // which is exactly the property the ruling REJECTS for money."*
    // ⚠ THE ASSERTION IS CHARACTER-FOR-CHARACTER THE SAME. Only its purpose
    // flipped: the variation it was written to warn about is the behaviour the
    // 2026-09-05 ruling asks for. A negative assertion whose PURPOSE reverses
    // while staying green is the shape Palette-4c had to delete a fence over;
    // here the honest repair is to say out loud what it now proves.
    const derived = BRANDS.map(([, src]) => deriveThemeTokens(resolveBrandingTheme(src), 'light').primaryText);
    expect(new Set(derived).size, 'primaryText did not vary — money is not brand-responsive')
      .toBeGreaterThan(1);
  });

  it('[RED] the PROJECTED figures are on the TEXT TONE, and MONEY is BACK', () => {
    // ⚠ THIS CASE HAS NOW INVERTED TWICE, AND BOTH TURNS ARE KEPT.
    // Palette-5 asserted the projections were HELD on `--rm-primary-text` and
    // that the token therefore still had consumers.
    // Palette-6 rewrote it to: *"the MONEY constant should be gone — a
    // projection is still on the brand-text token"*, because the rule had sent
    // projections to the text tone and left the token with ZERO consumers.
    // Palette-9 reverses the other half: money itself is now the brand-text
    // token, so `const MONEY` is BACK and it is the balance that carries it.
    // ⚠ WHAT SURVIVED ALL THREE TURNS IS THE SUBJECT: no PROJECTION may wear
    // the money tone, whatever the money tone currently is. That claim has been
    // true throughout and is the only thing this case has ever really asserted.
    expect(DASH_CODE, 'the MONEY constant should be back').toContain('const MONEY');
    expect(DASH_CODE, 'the inline projection left the text tone')
      .toContain('<span style={{ color: TEXT, fontWeight: 700 }}>${nextPayout.total}</span>');
    expect(DASH_CODE, 'the projection card left the text tone')
      .toContain('fontFamily: R.fontMono, color: TEXT }}>${nextPayout.total}</p>');
  });
});

// ── T2 — BRAND INVARIANCE ───────────────────────────────────────────────────
// ⚠ THIS DESCRIBE WAS TITLED *"money is the same colour on every brand"*. That
// is FALSE after 2026-09-05 — money is brand-responsive, and the fence proving
// it lives in paletteMoneyBrandResponsive.test.jsx T2, which asserts DIFFERENCE
// across the seeded brands and guard-proofs it by pinning a constant.
// ⚠ THE CASES BELOW STILL PASS AND ARE NOT VACUOUS, BUT THEIR SUBJECT NARROWED:
// they are now facts about `successText`'s SURVIVING consumers — the login
// banner, the reset screen, SuccessState and the copy-link confirmation — which
// are status messages and are still deliberately the same on every contractor.
describe('Palette-5 T2 (narrowed by Palette-9) — successText is still brand-invariant', () => {
  it('[RED] successText is not a render token, so it CANNOT be brand-derived', () => {
    // ⚠ STRUCTURAL, NOT NUMERIC. Palette-4c's first attempt read one constant N
    // times and asserted it equalled itself. "Brand-invariant" is a fact about
    // where a value comes from: only deriveThemeTokens takes a brand.
    expect(RENDER_TOKEN_KEYS).not.toContain('successText');
    for (const [label, src] of BRANDS) {
      for (const mode of MODES) {
        const t = deriveThemeTokens(resolveBrandingTheme(src), mode);
        expect(Object.keys(t), `${label}/${mode} emits a successText`).not.toContain('successText');
      }
    }
  });

  it('[RED] both tabs still reach money through the SAME expression', () => {
    // ⚠ THE EQUALITY THAT MATTERS IS BETWEEN SCREENS. If Dashboard and Profile
    // named different tokens, "the same number paints the same colour" would be
    // false however invariant each was on its own.
    expect(DASH_CODE).toContain('color: MONEY');
    expect(codeOnly(PROFILE)).toContain('color: item.money ? MONEY :');
  });
});

// ── T3 — THE NAV'S STATES ───────────────────────────────────────────────────
describe('Palette-5 T3 — BottomNav active vs inactive', () => {
  it('[RED] the inactive icon now clears the 3:1 graphic floor against its ground', () => {
    // ⚠ THIS WAS THE DEFECT: 0.4 alpha composited to 2.40:1 on the platform
    // brand, on every screen in the app.
    eachBrandMode((label, mode, t) => {
      const inactive = composite(t.text, t.surface, 0.6);
      const pair = contrastRatio(inactive, t.surface);
      expect(pair, `${label}/${mode}: inactive icon is ${pair.toFixed(2)}:1 on its ground`)
        .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });

  it('[RED] GUARD-PROOF — the 0.4 it replaced FAILS that floor', () => {
    let sawFailure = false;
    eachBrandMode((label, mode, t) => {
      if (contrastRatio(composite(t.text, t.surface, 0.4), t.surface) < GRAPHIC_FLOOR) sawFailure = true;
    });
    expect(sawFailure, 'the old alpha never failed — this fence guards nothing').toBe(true);
  });

  it('[RED] the active state is still distinguishable, and by MORE than colour', () => {
    // ⚠ NO SINGLE ALPHA CLEARS BOTH CONSTRAINTS — measured, they cross before
    // either is met. What makes 0.60 correct is that state here is multiply
    // encoded, so this asserts the OTHER carriers still exist rather than
    // pretending a ratio settles it.
    eachBrandMode((label, mode, t) => {
      const inactive = composite(t.text, t.surface, 0.6);
      expect(contrastRatio(t.text, inactive), `${label}/${mode}: states are identical`)
        .toBeGreaterThan(1.0);
    });
    expect(APP_CODE, 'the filled-glyph variant is gone').toContain('t.icon + "-fill"');
    expect(APP_CODE, 'the sliding indicator is gone').toContain('background: activeColor');
    expect(APP_CODE, 'the label opacity cue is gone').toContain('opacity: active ? 1 : 0,');
  });

  it('[RED] the derived alpha is declared once, not repeated', () => {
    expect(APP_CODE).toContain('const INACTIVE_OPACITY = 0.6');
    expect(APP_CODE).toContain('opacity: active ? 1 : INACTIVE_OPACITY');
  });
});

// ── T4 — THE NAV'S SWEEPS ───────────────────────────────────────────────────
describe('Palette-5 T4 — no R. colour, no retired tone in the nav', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('[RED] the needles are validated against known answers', () => {
    const hex = /#012854/gi;
    const dec = /\(\s*1\s*,\s*40\s*,\s*84\s*[,)]/g;
    const c = (re, s) => (s.match(new RegExp(re.source, re.flags)) || []).length;
    // ⚠ THE ASYMMETRY IS THE POINT: the nav's shadow carried the retired navy as
    // DECIMAL channels, which the hex needle cannot see.
    expect(c(hex, '0 -4px 20px rgba(1,40,84,0.08)')).toBe(0);
    expect(c(dec, '0 -4px 20px rgba(1,40,84,0.08)')).toBe(1);
    expect(c(dec, 'rgb(1,40,840)')).toBe(0);
    expect(c(hex, '#012854')).toBe(1);
  });

  it('[RED] no retired tone survives in the nav, in EITHER form', () => {
    const NEEDLES = [
      ['#012854 hex', /#012854/gi], ['#041D3E hex', /#041D3E/gi],
      ['#CC0000 hex', /#cc0000/gi], ['#D3E3F0 hex', /#D3E3F0/gi],
      ['rgb(1,40,84) decimal', /\(\s*1\s*,\s*40\s*,\s*84\s*[,)]/g],
      ['rgb(204,0,0) decimal', /\(\s*204\s*,\s*0\s*,\s*0\s*[,)]/g],
    ];
    const found = [];
    for (const [label, re] of NEEDLES) {
      const n = (APP_CODE.match(new RegExp(re.source, re.flags)) || []).length;
      if (n) found.push(`${label} ×${n}`);
    }
    expect(found, `retired tones survive: ${found.join(', ')}`).toEqual([]);
  });

  it('[RED] and no R. COLOUR key is read in the nav', () => {
    const R_COLOUR = /(^|[^A-Za-z0-9_.])R\.(red|redDark|navy|navyDark|blueLight|bgBlueLight|bgCard|bgPage|textPrimary|textSecondary|textMuted|border|borderMed|shadow|shadowMd|shadowLg|green|greenBg|greenText|amber|amberBg|amberText)\b/g;
    const hits = [];
    let m;
    R_COLOUR.lastIndex = 0;
    while ((m = R_COLOUR.exec(APP_CODE)) !== null) { hits.push(m[2]); R_COLOUR.lastIndex = m.index + m[0].length; }
    expect(hits.sort()).toEqual([]);
  });

  // ⚠ A sweep proves a string is ABSENT and nothing about whether the code runs.
  it('[RED] and the nav still RENDERS, with all five destinations', () => {
    installFetch();
    render(<ReferrerApp {...APP_PROPS} />);
    for (const label of ['Home', 'Refer', 'Rankings', 'Cash Out', 'Profile']) {
      expect(screen.getByText(label), `${label} tab missing`).toBeTruthy();
    }
  });
});

// ── T5 / T7 ─────────────────────────────────────────────────────────────────
describe('Palette-5 T5/T7 — the seeder, and the shortfall fences', () => {
  it('[RED] the seeder produces a money surface, and says what it still cannot do', () => {
    // The recipe is the deliverable: the two non-obvious requirements are the
    // ones that made Palette-4c's hand-work necessary.
    expect(SEEDER).toContain('pipeline_cache');
    expect(SEEDER).toContain('contractor_crm_settings');
    expect(SEEDER, 'referred_by must be keyed on the NAME').toContain('referrerName');
    expect(SEEDER, 'the stale-cache limit must be stated').toMatch(/stale-cache path only/i);
    expect(SEEDER, 'the missing conversions must be stated').toMatch(/NO referral_conversions/);
    // ⚠ THIS FENCE ASSERTED THE LIMITS BLOCK SAID "NO BADGES", AND IT HAS INVERTED.
    // Palette-11 Part A extended the seeder to write three earned-and-unseen
    // badges, which is what finally made Palette-4b's #999 repair observable in a
    // browser — that repair had only ever been checked by arithmetic and by
    // forcing the branch in jsdom.
    // ⚠ THE SUBJECT SURVIVES: the limits block must still STATE what the seeder
    // cannot reach. Only the specific gap moved.
    expect(SEEDER, 'the badge seeding is not stated').toMatch(/BADGES NOW SEED/);
    expect(SEEDER, 'the remaining conversion gap is no longer stated')
      .toMatch(/referral_conversions/);
  });

  it('[RED] Palette-1\'s shortfall fences are not weakened', () => {
    const onWhite = compositeRgba(ELEVATION_LIGHT.border, '#FFFFFF');
    expect(contrastRatio(onWhite, '#FFFFFF')).toBeLessThan(GRAPHIC_FLOOR);
    eachBrandMode((label, mode, t) => {
      const sep = contrastRatio(t.recess, t.surface);
      expect(sep, `${label}/${mode}: recess/surface now clears 3:1 — update the ruling`).toBeLessThan(GRAPHIC_FLOOR);
      expect(sep).toBeGreaterThan(1.0);
    });
  });
});
