// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-12 PART B — THE BOOST BAR. The last referrer hold.
//
// T1  the gradient resolves to its ruled stops, per brand per mode
// T2  the stops clear the 1.35 separation floor on every seeded brand and mode
// T3  fill-vs-track clears the 3:1 graphic floor, per brand per mode
// T4  no R. colour read in this file, no retired tone anywhere in the referrer
//     tree, and the file still RENDERS
// T5  the string-literal fence's shape is absent from this file
// T6  Palette-1's shortfall fences are not weakened
//
// ── ⚠ WHAT THIS PHASE GAVE UP, RECORDED SO IT DOES NOT READ AS DRIFT ────────
// The boost bar was `R.red -> R.navy`: a deliberate TWO-COLOUR effect running
// between the action colour and the dark neutral. Ruled 2026-09-05 (Option A):
// it becomes `--rm-secondary -> --rm-secondary-dark`, a TONAL gradient like the
// four tab headers. ⚠ THAT IS A DELIBERATE LOSS, not an oversight.
//
// ⚠ AND IT WAS MEASURED IMPOSSIBLE RATHER THAN ABANDONED. `primary` and
// `secondary` are chosen INDEPENDENTLY by a contractor; nothing constrains them
// to sit far apart, so a gradient between them is a coin flip per brand. The
// mechanical substitution `secondary -> primary` was flat on all four seeded
// brands in dark (1.01-1.05), and on Beta it measured WORSE than the shipped
// pair (2.05 against 2.49) — Beta being the brand the hold was raised on. The
// derived partners work for the opposite reason: `X -> X-dark` has a GUARANTEED
// relationship, which is what let Palette-1 calibrate it to 1.35 and have it
// hold everywhere. T2 is that guarantee, asserted rather than trusted.
//
// ── ⚠ WHAT THESE TESTS CAN AND CANNOT SEE ──────────────────────────────────
// jsdom resolves no var(). Everything here is DECLARATION-level plus ARITHMETIC
// over the derivation: it proves the site NAMES the right property with the
// right fallback and that the resulting pair clears its floor. IT CANNOT PROVE
// THE PROPERTY WAS MOUNTED, and it cannot prove the value reaching the element
// is a colour at all — B1 shipped five icons rendering black from a string
// containing the TEXT of a call, and four independent checks passed on it.
// T5 is this file's half of that; `themeKeyIntegrity` owns the tree-wide half.
// ⚠ A GREEN RUN HERE IS EVIDENCE ABOUT DECLARATIONS AND ARITHMETIC. It is not
// evidence about pixels and must not be reported as if it were.
//
// ⚠ EXPECTED COUNT: 20 cases in this file, COUNTED WITH grep RATHER THAN
// ESTIMATED. Two prior phases in this arc predicted low by estimating (24 vs 29,
// 18 vs 23), and a prediction that happens to be low is indistinguishable from a
// file that failed to load and contributed zero.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio, GRADIENT_PARTNER_MIN_CONTRAST } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { ELEVATION_LIGHT } from '../../constants/elevationTheme';
import DashboardTab from './DashboardTab';

const SRC = path.resolve(process.cwd(), 'src');
const REFERRER_DIR = path.resolve(SRC, 'components/referrer');
const DASH_REL = 'components/referrer/DashboardTab.jsx';
// ⚠ /\r?\n/ everywhere — `.` does not match `\r`, so a $-anchored pattern
// silently no-ops on a CRLF line, and core.autocrlf=true is the Windows default.
const DASH = fs.readFileSync(path.resolve(SRC, DASH_REL), 'utf8');

const SEPARATION_FLOOR = 1.35;
const GRAPHIC_FLOOR = 3;

// The seeded stack, by stored brand columns. Gamma is UNSET — what a contractor
// looks like before choosing anything.
// ⚠ ALPHA'S BRAND IS THE PLATFORM DEFAULT, so every token mounts EQUAL to its
// fallback on it and a broken wiring is invisible. Beta is the brand that
// proves anything here; Alpha is kept because "the platform's own palette" is a
// real tenant state, not because it can discriminate.
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

// An rgba(r,g,b,a) string composited over an opaque ground.
function compositeRgba(rgba, ground) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(rgba);
  if (!m) throw new Error(`compositeRgba: not an rgba() value: ${JSON.stringify(rgba)}`);
  const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
  const px = [1, 2, 3].map((i) => Number(m[i]));
  const bg = [1, 3, 5].map((i) => parseInt(ground.slice(i, i + 2), 16));
  return '#' + [0, 1, 2]
    .map((i) => Math.round(px[i] * alpha + bg[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}

// Comments stripped for the CODE-level questions only. ⚠ NOT a
// comments-are-exempt carve-out: these ask "does the CODE still read a retired
// tone"; `themeKeyIntegrity` asks "does this NAME appear anywhere a reader could
// copy from" and keeps no carve-out at all. The prose instances this stripper
// removes are records of the retirement, and they are reported in the phase
// write-up rather than swept silently.
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

// Every non-test component in the referrer tree, walked rather than listed.
// ⚠ A HAND-MAINTAINED FILES LIST IS THIS REPO'S RECORDING FAILURE MODE: new
// files are invisible to it and nothing announces the omission.
const TREE = fs.readdirSync(REFERRER_DIR)
  .filter((f) => /\.jsx$/.test(f) && !/\.test\.jsx$/.test(f))
  .sort()
  .map((f) => [f, codeOnly(fs.readFileSync(path.join(REFERRER_DIR, f), 'utf8'))]);

// ── NON-VACUITY, FIRST AND UNCONDITIONALLY ─────────────────────────────────
describe('Palette-12 B — the sweep has something to sweep', () => {
  it('the sources were read and the comment stripper left code behind', () => {
    expect(DASH.length).toBeGreaterThan(20000);
    expect(DASH_CODE.length).toBeGreaterThan(8000);
    // The stripper must remove SOMETHING, or every "code-level" assertion below
    // is silently a whole-file assertion.
    expect(DASH_CODE.length).toBeLessThan(DASH.length);
    expect(DASH_CODE).toContain('export default function Dashboard');
    // The walk, not a list. Fifteen components at the time of writing; the
    // assertion is a floor so a new file cannot shrink the swept set unnoticed.
    expect(TREE.length, 'the referrer walk returned too few files').toBeGreaterThanOrEqual(15);
    for (const [name, code] of TREE) {
      expect(code.length, `${name} stripped to nothing`).toBeGreaterThan(200);
    }
  });
});

// ── T1 — THE RULED STOPS ───────────────────────────────────────────────────
describe('Palette-12 B T1 — the gradient resolves to its ruled stops', () => {
  it('[RED] the boost fill is SECONDARY -> SECONDARY_DARK, and the old pair is gone', () => {
    expect(DASH_CODE).toContain('linear-gradient(90deg, ${SECONDARY} 0%, ${SECONDARY_DARK} 100%)');
    // ⚠ ANCHORED ON THE SURROUNDING PHRASE, not on the token names alone. Both
    // constants appear dozens of times in this file; `toContain('SECONDARY')`
    // would be satisfied by any one of them and would watch nothing.
    expect(DASH_CODE).not.toContain('${R.red} 0%');
    expect(DASH_CODE).not.toContain('${R.navy} 100%');
  });

  it('[RED] both constants declare the property the provider mounts, with the mounted fallback', () => {
    // ⚠ THE FALLBACK MUST BE THE VALUE THAT ACTUALLY MOUNTS. R-1 shipped
    // `var(--rm-danger, #FEE2E2)` — a plausible pale tint against a saturated
    // fill — and painted 1.34:1 for months because jsdom resolves no var().
    const platform = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    expect(DASH_CODE).toContain(`const SECONDARY      = 'var(--rm-secondary, ${platform.secondary})'`);
    expect(DASH_CODE).toContain(`const SECONDARY_DARK = 'var(--rm-secondary-dark, ${platform.secondaryDark})'`);
  });

  it('[RED] the two stops are DISTINCT values in every brand and mode', () => {
    // A gradient whose stops are equal is a flat fill wearing a gradient's
    // syntax, and it reads as correct in the source.
    eachBrandMode((label, mode, t) => {
      expect(t.secondary, `${label}/${mode}: the stops are identical`).not.toBe(t.secondaryDark);
    });
  });

  it('[RED] the track is still the recessed groove, and the fill still has no text', () => {
    expect(DASH_CODE).toContain('background: RECESS, borderRadius: 999');
    // ⚠ M.4 RE-CONFIRMED RATHER THAN INHERITED: the gradient div is
    // self-closing, so the darker-stop text rule does not reach it. The `<p>`
    // beneath is a SIBLING on the card ground, not a child of the fill.
    const start = DASH_CODE.indexOf('linear-gradient(90deg, ${SECONDARY}');
    expect(start).toBeGreaterThan(-1);
    const after = DASH_CODE.slice(start, start + 420);
    expect(after, 'the gradient div is no longer self-closing — re-derive the text rule').toContain('/>');
    expect(after.slice(0, after.indexOf('/>')), 'the fill grew children').not.toContain('</div>');
  });
});

// ── T2 — THE SEPARATION FLOOR ──────────────────────────────────────────────
describe('Palette-12 B T2 — the stops clear 1.35 everywhere', () => {
  it('[RED] the floor under test IS Palette-1s calibrated constant, not a second copy', () => {
    // ⚠ A LOCAL 1.35 WOULD AGREE WITH THE DERIVATION TODAY AND DRIFT SILENTLY.
    expect(GRADIENT_PARTNER_MIN_CONTRAST).toBe(SEPARATION_FLOOR);
  });

  it('[RED] MEASURED — all eight seeded brand/mode pairs clear the separation floor', () => {
    const measured = [];
    eachBrandMode((label, mode, t) => {
      const sep = contrastRatio(t.secondary, t.secondaryDark);
      measured.push([`${label}/${mode}`, Number(sep.toFixed(2))]);
      expect(sep, `${label}/${mode}: ${t.secondary} -> ${t.secondaryDark} separates by only ${sep.toFixed(2)}`)
        .toBeGreaterThanOrEqual(SEPARATION_FLOOR);
    });
    expect(measured.length, 'expected eight readings — four brands, two modes').toBe(8);
  });

  it('[RED] GUARD-PROOF — pinning the stops EQUAL drives the same check RED', () => {
    // ⚠ THE FENCE MUST BE SHOWN TO FAIL. A separation assertion that has never
    // been seen failing is a claim, not a check — and this one is arithmetic
    // over a derivation that is guaranteed to satisfy it, which is exactly the
    // shape that goes vacuous without anybody noticing.
    let fired = 0;
    eachBrandMode((label, mode, t) => {
      const pinned = contrastRatio(t.secondary, t.secondary);
      if (pinned < SEPARATION_FLOOR) fired++;
    });
    expect(fired, 'pinning the stops equal did not fail the floor — this fence guards nothing').toBe(8);
    expect(contrastRatio('#1C2D4D', '#1C2D4D')).toBe(1);
  });

  it('[RED] and the CANDIDATE that was ruled against still fails, which is why Option A exists', () => {
    // ⚠ THIS IS A RECORD OF A MEASUREMENT, KEPT EXECUTABLE. `secondary ->
    // primary` was the mechanical substitution; it is flat in dark mode on every
    // seeded brand. If this ever stops failing the ruling should be revisited on
    // purpose rather than discovered by someone re-proposing the gradient.
    const flat = [];
    eachBrandMode((label, mode, t) => {
      const sep = contrastRatio(t.secondary, t.primary);
      if (mode === 'dark') flat.push([`${label}/${mode}`, Number(sep.toFixed(2))]);
    });
    expect(flat.length).toBe(4);
    for (const [label, sep] of flat) {
      expect(sep, `${label}: the cross-brand candidate is no longer flat — revisit the ruling`)
        .toBeLessThan(SEPARATION_FLOOR);
    }
  });
});

// ── T3 — FILL VS TRACK ─────────────────────────────────────────────────────
describe('Palette-12 B T3 — the fill reads against its track', () => {
  it('[RED] MEASURED — BOTH stops clear 3:1 against `recess`, every brand and mode', () => {
    // ⚠ TWO GROUNDS, AND THE TRACK IS THE ONE THAT MATTERS. `--rm-secondary` is
    // floored against `surface` only, so on `recess` it is UNPROVEN and the
    // measured ratio is the only evidence — the exact shape that has been
    // hand-caught in four consecutive phases at 3.00, 2.55, 2.68 and 2.89.
    // `--rm-secondary-dark` is floored against its PARTNER, against no ground at
    // all, so it is unproven on every ground including this one.
    let worst = Infinity;
    eachBrandMode((label, mode, t) => {
      const start = contrastRatio(t.secondary, t.recess);
      const end = contrastRatio(t.secondaryDark, t.recess);
      worst = Math.min(worst, start, end);
      expect(start, `${label}/${mode}: the start stop on the track is ${start.toFixed(2)}`)
        .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
      expect(end, `${label}/${mode}: the end stop on the track is ${end.toFixed(2)}`)
        .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
    // A floor on the worst reading, so a derivation change that erodes the
    // margin is visible before it becomes a failure.
    expect(worst).toBeGreaterThan(GRAPHIC_FLOOR);
  });

  it('[RED] GUARD-PROOF — the same comparison FAILS on a pair that is known to fail', () => {
    // 2.68:1 is a real measured miss from this arc: `--rm-primary` on
    // `--rm-recess`, caught by hand in ManageAccount.
    const near = contrastRatio('#8FA0B8', '#ECF0F8');
    expect(near).toBeLessThan(GRAPHIC_FLOOR);
  });
});

// ── T4 — THE THREE NEEDLES, AND THE FILE STILL RENDERS ─────────────────────
describe('Palette-12 B T4 — no R colour here, no retired tone in the tree', () => {
  // Every colour-bearing key on `R`. ⚠ The FONT keys are deliberately absent:
  // the split between colour and non-colour is the whole point of the migration.
  const R_COLOUR_KEYS = ['bgPage', 'bgCard', 'red', 'redDark', 'navy', 'navyDark', 'blueLight',
    'textPrimary', 'textSecondary', 'textMuted', 'green', 'greenBg', 'greenText',
    'amber', 'amberBg', 'amberText', 'blue', 'blueBg', 'blueText', 'grayBg', 'grayText',
    'teal', 'tealBg', 'tealText', 'emerald', 'emeraldBg', 'emeraldText',
    'border', 'shadow', 'shadowLg'];
  // The retired Accent tones, and the keys whose VALUE is one. ⚠ `shadowLg` is
  // in this list because it carries `rgba(1,40,84,0.13)` INSIDE a shadow — the
  // third route a tone travels, invisible to a hex needle and to a bare
  // colour-key needle alike.
  const R_RETIRED_KEYS = ['navy', 'navyDark', 'red', 'redDark', 'blueLight', 'shadowLg'];
  const RETIRED_HEX = ['#012854', '#041D3E', '#CC0000', '#8C0000', '#D3E3F0'];
  const RETIRED_DEC = ['1,40,84', '4,29,62', '204,0,0', '140,0,0', '211,227,240'];
  const rKey = (k) => new RegExp('(^|[^A-Za-z0-9_.])R\\.' + k + '\\b');

  it('[RED] GUARD-PROOF — all three needles fire on their own form AND spare the look-alikes', () => {
    // ⚠ VALIDATED IN BOTH DIRECTIONS. A needle that finds the defect and also
    // fires on the legitimate idiom is not a check, it is noise someone will
    // exempt; a needle that spares everything is not a check either.
    expect("color: '#012854'".toUpperCase().includes('#012854')).toBe(true);
    expect("color: '#01285A'".toUpperCase().includes('#012854')).toBe(false);
    expect('rgba(1, 40, 84, 0.85)'.replace(/\s+/g, '').includes('1,40,84')).toBe(true);
    expect('rgba(1, 40, 85, 0.85)'.replace(/\s+/g, '').includes('1,40,84')).toBe(false);
    expect(rKey('navy').test('background: R.navy')).toBe(true);
    // the prefix trap, which a bare substring needle fails
    expect(rKey('red').test('background: R.redDark'), 'red must not match redDark').toBe(false);
    expect(rKey('navy').test('theme.R.navy'), 'a dotted parent must not match').toBe(false);
    expect(rKey('navy').test('const navy = 1'), 'a bare word must not match').toBe(false);
  });

  it('[RED] DashboardTab reads ZERO colour keys off R — the hold is closed, not shrunk', () => {
    // ⚠ ASSERTED BY EQUALITY AGAINST THE EMPTY SET. The fence this replaces
    // asserted the hold EXISTED (`['navy','red']`) so it could not silently
    // grow; with the hold closed the same fence has to assert the opposite or
    // it becomes a negative assertion guarding the defect.
    const survivors = R_COLOUR_KEYS.filter((k) => rKey(k).test(DASH_CODE));
    expect(survivors, `DashboardTab still reads: ${survivors.join(', ')}`).toEqual([]);
  });

  it('[RED] and it keeps its TYPOGRAPHY — the split is the point, not the emptying', () => {
    // ⚠ THE PURPOSE OF THIS CASE IS UNCHANGED AND IS THE REASON IT STILL EXISTS:
    // a sweep that emptied the file of every declaration would pass the case
    // above and be WRONG. What proves non-emptying MOVED in Palette-13 B.7.
    // The font keys are gone because they were MIGRATED, not deleted — the file
    // now declares the three roles through the side channel, which is where a
    // contractor's chosen face actually arrives.
    expect(DASH_CODE).toMatch(/fontVar\('(heading|body|mono)'\)/);
    // And the old spelling must be gone, or the migration was partial.
    expect(DASH_CODE).not.toMatch(/R\.font(Body|Sans|Mono)/);
  });

  it('[RED] NO RETIRED TONE SURVIVES ANYWHERE IN THE REFERRER TREE, in any of its three spellings', () => {
    const reaches = [];
    for (const [name, code] of TREE) {
      const flat = code.replace(/\s+/g, '');
      const up = code.toUpperCase();
      for (const h of RETIRED_HEX) if (up.includes(h)) reaches.push(`${name}: hex ${h}`);
      for (const d of RETIRED_DEC) if (flat.includes(d)) reaches.push(`${name}: rgba(${d})`);
      for (const k of R_RETIRED_KEYS) if (rKey(k).test(code)) reaches.push(`${name}: R.${k}`);
    }
    expect(reaches, `retired tones still reached: ${reaches.join(' | ')}`).toEqual([]);
  });

  it('[RED] the R colour reads that REMAIN in the tree are the named status holds, and no others', () => {
    // ⚠ NAMED, NOT COUNTED. `ProfileTab` keeps five STATUS keys by Palette-4b's
    // ruling — they are the status palette, not a retired brand tone. This
    // assertion is what stops "the referrer tree has no R colour read" being
    // claimed when it is false, and what stops the held set growing.
    const held = [];
    for (const [name, code] of TREE) {
      for (const k of R_COLOUR_KEYS) if (rKey(k).test(code)) held.push(`${name}:R.${k}`);
    }
    expect(held.sort()).toEqual([
      'ProfileTab.jsx:R.amberBg',
      'ProfileTab.jsx:R.amberText',
      'ProfileTab.jsx:R.greenBg',
      'ProfileTab.jsx:R.greenText',
      'ProfileTab.jsx:R.tealText',
    ]);
  });

  it('[RED] and DashboardTab STILL RENDERS — a sweep proves a string is absent, never that code runs', () => {
    // ⚠ `AnnouncementPopup` threw a ReferenceError on every render while its
    // literal sweep passed. The sweep was correct; the component no longer ran.
    const { container } = render(
      <DashboardTab
        setTab={() => {}} pipeline={[]} loading={false} userName="Testy"
        balance={0} paidCount={3} profilePhoto={null} showReviewCard={false}
        onDismissReview={() => {}} sessionToken="t" onViewAllReferrals={() => {}}
        bankStatus={null} onOpenBankSetup={() => {}}
      />
    );
    expect(container.textContent).toContain('Boost Progress');
    expect(container.textContent).toContain('of 7 referrals');
    // The fill itself, found by its declared gradient rather than by a test id.
    const fills = [...container.querySelectorAll('div')]
      .filter((d) => (d.getAttribute('style') || '').includes('linear-gradient(90deg'));
    expect(fills.length, 'the boost fill did not render').toBe(1);
    const style = fills[0].getAttribute('style');
    expect(style).toContain('--rm-secondary,');
    expect(style).toContain('--rm-secondary-dark,');
  });
});

// ── T5 — THE STRING-LITERAL SHAPE ──────────────────────────────────────────
describe('Palette-12 B T5 — a value, never the TEXT of a call', () => {
  // The same anchor `themeKeyIntegrity` uses: an ASSIGNMENT position, then a
  // quote, then `<word>Var(`. ⚠ Anchored on `[=:]` rather than on any quoted
  // call, because the unanchored form fires on legitimate test NEEDLES — and a
  // fence that stops reading the files an idiom gets copied from has a hole in it.
  const CALL_AS_STRING = /[=:]\s*['"`]\s*(?:status|elevation|font)Var\s*\(/;

  it('[RED] GUARD-PROOF — the shape fires on the defect and spares the legitimate forms', () => {
    // Assembled from pieces: written plainly, the fixture IS the defect.
    const q = "'";
    const defect = 'const AMBER = ' + q + 'status' + 'Var(' + q;
    expect(CALL_AS_STRING.test(defect), 'the fence does not catch B1s shape').toBe(true);
    expect(CALL_AS_STRING.test("color: statusVar('warning')"), 'a real call must be spared').toBe(false);
    expect(CALL_AS_STRING.test("background: 'var(--rm-secondary, #1C2D4D)'"), 'a var() string must be spared').toBe(false);
  });

  it('[RED] and DashboardTab contains the shape nowhere', () => {
    const offenders = DASH.split(/\r?\n/)
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => CALL_AS_STRING.test(line));
    expect(offenders.map(([n]) => n), `a call is stored as a string at line(s): ${offenders.map(([n]) => n).join(', ')}`).toEqual([]);
  });
});

// ── T6 — PALETTE-1'S SHORTFALLS ────────────────────────────────────────────
describe('Palette-12 B T6 — Palette-1s shortfall fences are not weakened', () => {
  it('[RED] the hairline is still below the graphic floor, and recess/surface still is too', () => {
    const onWhite = compositeRgba(ELEVATION_LIGHT.border, '#FFFFFF');
    expect(contrastRatio(onWhite, '#FFFFFF')).toBeLessThan(GRAPHIC_FLOOR);
    eachBrandMode((label, mode, t) => {
      const sep = contrastRatio(t.recess, t.surface);
      expect(sep, `${label}/${mode}: recess/surface now clears 3:1 — update the ruling`)
        .toBeLessThan(GRAPHIC_FLOOR);
      expect(sep).toBeGreaterThan(1.0);
    });
  });
});
