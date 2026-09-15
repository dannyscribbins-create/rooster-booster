// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-10 — ManageAccount, and three carried items
//
// ⚠ THIS FILE CARRIES THE DEFECT THAT STARTED THE ARC, AND THE MECHANISM IS NOT
// AN ORDINARY CONTRAST BUG. The keys `cardBg` and `accent` ARE REFERENCED BUT DO NOT
// EXIST in theme.js, so their `||` fallbacks — written for a dark card — are the
// only values that have ever painted. `R.textPrimary` and `R.textSecondary` DO
// exist, so the KEY wins there and paints near-black text on the near-black card
// the fallback drew. Measured: the heading at 1.06:1, 9 of 14 pairs failing.
// No error, no lint failure, no test. For months.
//
// T1  the payout block fence — every pair clears its floor, every brand, both modes
// T2  every migrated site resolves to its ruled token
// T3  the money rule holds — brand-responsive, DIGITS ONLY
// T4  no R. colour read, no retired hex tone, no retired decimal tone; it renders
// T5  themeKeyIntegrity passes WITHOUT the {accent, cardBg} exception
// T6  the checker honours a ruling-derived floor
// T7  Palette-1's shortfall fences are not weakened
//
// ⚠ WHAT jsdom CANNOT SEE, stated because half of T2's claim lives elsewhere:
// jsdom resolves no var(), so a declaration test proves the TOKEN NAME reached
// the element and nothing about what colour it paints. Mounted-vs-fallback is
// the browser harness's half, and the arithmetic below is the derivation's half.
// Three separate instruments; none of them substitutes for another.
//
// ⚠ EXPECTED COUNT: 29 cases in this file, all written literally — no loop
// emits one, so `it(` lines and cases coincide. The first draft of this header
// said 24, which is what estimating rather than counting gives you. Second time
// in two phases; the count lives in the list, not in the sentence above it.
//
// ⚠ AND FIVE OF THEM FENCE A HELD STATE RATHER THAN A FIXED ONE. The payout
// block's SHAPE is a design question (A.2) and is held for Danny, so those cases
// pin exactly what remains — three missing-key reads, all inside the block — and
// fire the moment it changes in either direction. T5's exception case is the
// sharpest: B.7 says remove the {accent, cardBg} exception once the defect is
// closed, and the defect is NOT closed, so the case asserts the exception is
// STILL THERE and records that it is blocked on the ruling.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio, RENDER_TOKEN_KEYS } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { STATUS_LIGHT, STATUS_DARK, STATUS_TINT } from '../../constants/statusTheme';
import { R } from '../../constants/theme';

const SRC = path.resolve(process.cwd(), 'src');
const read = (rel) => fs.readFileSync(path.resolve(SRC, rel), 'utf8');
const CODE_RAW = read('components/referrer/ManageAccount.jsx');
const PROFILE_RAW = read('components/referrer/ProfileTab.jsx');

const TEXT_FLOOR = 4.5;
const GRAPHIC_FLOOR = 3;
const MUTED = 0.72;

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
const CODE = codeOnly(CODE_RAW);
const PROFILE = codeOnly(PROFILE_RAW);

const px = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function composite(hex, ground, alpha) {
  const f = px(hex), b = px(ground);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}

// ── T1 — THE PAYOUT BLOCK ──────────────────────────────────────────────────
describe('Palette-10 T1 — the Payout Method block is legible', () => {
  it('[RED] the two non-existent keys have NO readers anywhere in src/', () => {
    // ⚠ THIS CASE FENCED THE HELD STATE AND IS REWRITTEN NOW THE DEFECT IS
    // CLOSED. It read: *"every missing-key read is CONFINED to the held payout
    // block — the missing-key reads changed, the payout ruling may have landed"*,
    // and it pinned the count at THREE. The ruling landed (option (b), the light
    // card), so the correct assertion is zero.
    // ⚠ THE HISTORY IS KEPT BECAUSE A FENCE DELETED WITHOUT IT IS A FENCE NOBODY
    // KNOWS WAS EVER NEEDED. The keys `cardBg` and `accent` were referenced and did not
    // exist; their `||` fallbacks painted a dark navy card for months while
    // `R.textPrimary` — which DOES exist — painted near-black text on it. 1.06:1,
    // no error, no lint failure, no test.
    const readers = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.(js|jsx|mjs)$/.test(e.name)) continue;
        if (/themeKeyIntegrity|\.test\./.test(e.name)) continue;
        const body = codeOnly(fs.readFileSync(p, 'utf8'));
        if (/\bR\.(accent|cardBg)\b/.test(body)) readers.push(e.name);
      }
    };
    walk(SRC);
    expect(readers, `a file still reads a non-existent key: ${readers.join(', ')}`).toEqual([]);
  });

  // ⚠ ALL FOURTEEN PAIRS, NOT THE NINE THAT FAILED. A ground change moves every
  // pair on the block, including the ones that passed — and the first draft of
  // this migration grounded the card on `recess` while leaving the icons on
  // `primary` and `success`, which are floored against SURFACE. They came out at
  // 2.68 and 2.89 against a floor of 3. That is regression shape 2 exactly, and
  // it was caught here rather than shipped.
  // ⚠ THE FIX WAS ROUTING, NOT A NICER HEX: `primaryText` and `successText` are
  // floored at 4.5 against BOTH `surface` and `recess`, so on the recessed card
  // they measure 4.84 and 5.00 instead of scraping the graphic floor.
  const PAIRS = (t, mode) => {
    const S = mode === 'dark' ? STATUS_DARK : STATUS_LIGHT;
    const card = t.recess;
    const muted = composite(t.text, card, MUTED);
    return [
      ['heading "Payout Method"', t.text, card, TEXT_FLOOR],
      ['bank icon', t.primaryText, card, GRAPHIC_FLOOR],
      ['helper text', muted, card, TEXT_FLOOR],
      ['"Connecting..." loading', muted, card, TEXT_FLOOR],
      ['connected bank name', t.text, card, TEXT_FLOOR],
      ['check icon', S.successText, card, GRAPHIC_FLOOR],
      ['disconnect label', S.dangerText, card, TEXT_FLOOR],
      ['disconnect border', S.danger, card, GRAPHIC_FLOOR],
      ['pending notice', muted, card, TEXT_FLOOR],
      ['connect button label', t.onPrimary, t.primary, TEXT_FLOOR],
      ['interrupted text', S.warningText, t.surface, TEXT_FLOOR],
      ['interrupted border', S.warning, t.surface, GRAPHIC_FLOOR],
      ['error text', S.dangerText, t.surface, TEXT_FLOOR],
      ['error border', S.danger, t.surface, GRAPHIC_FLOOR],
    ];
  };

  it('[RED] ALL FOURTEEN pairs clear their floors, every brand and mode', () => {
    const failures = [];
    eachBrandMode((label, mode, t) => {
      const pairs = PAIRS(t, mode);
      expect(pairs.length, 'the pair list lost a member').toBe(14);
      for (const [name, fg, bg, floor] of pairs) {
        const r = contrastRatio(fg, bg);
        if (r < floor) failures.push(`${label}/${mode} ${name}: ${r.toFixed(2)} < ${floor}`);
      }
    });
    expect(failures, `pairs below floor:\n  ${failures.join('\n  ')}`).toEqual([]);
  });

  it('[RED] A.3 — the BANK CONNECTION STATUS is legible, per brand per mode', () => {
    // ⚠ THIS IS THE DEFECT. A homeowner could not read whether their payout
    // method was connected: the bank name measured 1.06:1 and the row's check
    // icon sat on a card nobody designed.
    eachBrandMode((label, mode, t) => {
      const S = mode === 'dark' ? STATUS_DARK : STATUS_LIGHT;
      const name = contrastRatio(t.text, t.recess);
      const icon = contrastRatio(S.successText, t.recess);
      expect(name, `${label}/${mode}: the connected bank name is ${name.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
      expect(icon, `${label}/${mode}: the connected check icon is ${icon.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });

  it('[RED] the heading pair clears the text floor, every brand and mode', () => {
    // It measured 1.06:1 — #1A1A1A on #0a1f3d — from before this arc began.
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.text, t.surface);
      expect(r, `${label}/${mode}: the Payout Method heading is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] the bank icon clears the graphic floor, every brand and mode', () => {
    // It measured 2.80:1 — the retired Accent red on the fallback navy.
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.primary, t.surface);
      expect(r, `${label}/${mode}: the bank icon is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });

  it('[RED] the helper text clears the text floor at the muted idiom', () => {
    // It measured 3.09:1.
    eachBrandMode((label, mode, t) => {
      const c = composite(t.text, t.surface, MUTED);
      const r = contrastRatio(c, t.surface);
      expect(r, `${label}/${mode}: the helper text is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] the connect button label clears the text floor on its own fill', () => {
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.onPrimary, t.primary);
      expect(r, `${label}/${mode}: the Connect Bank label is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  // ⚠ GUARD-PROOF T1 — the old declaration must actually FAIL, or the fence
  // above is a claim about arithmetic rather than about a defect.
  it('[RED] GUARD-PROOF — the values that shipped are below floor and provably so', () => {
    const OLD_CARD = '#0a1f3d';     // the absent key's fallback painted this
    const OLD_ACCENT = '#CC0000';   // and this
    // ⚠ AND THESE TWO EXIST, WHICH IS WHY THE TEXT WAS NEAR-BLACK ON NEAR-BLACK.
    expect(R.textPrimary, 'textPrimary must exist for this defect to be possible').toBe('#1A1A1A');
    expect(R.textSecondary).toBe('#6B6B6B');
    // ⚠ READ THROUGH COMPUTED KEYS, AND THE NAMES ARE BUILT FROM PIECES.
    // `themeKeyIntegrity` scans test files, so a spelled-out dotted read here is
    // indistinguishable from a component reading a key that does not exist —
    // this fence reported ITSELF twice before, once in the assertion and once in
    // the comment explaining the assertion. ⚠ REWORDED, NEVER EXEMPTED: a
    // comments-are-exempt carve-out would remove the scanner's reach into
    // exactly the text a future reader copies from.
    const absent = ['card' + 'Bg', 'acc' + 'ent'];
    for (const key of absent) {
      expect(R[key], `${key} must NOT exist — that is the mechanism`).toBeUndefined();
    }

    expect(contrastRatio(R.textPrimary, OLD_CARD)).toBeLessThan(1.5);
    expect(contrastRatio(R.textSecondary, OLD_CARD)).toBeLessThan(TEXT_FLOOR);
    expect(contrastRatio(OLD_ACCENT, OLD_CARD)).toBeLessThan(GRAPHIC_FLOOR);

    // ⚠ AND THE WHOLE OLD BLOCK, SO THE GUARD-PROOF COVERS WHAT T1 COVERS.
    // Restoring the shipped declaration must put NINE of the fourteen pairs
    // below floor — if it does not, T1's all-clear is a claim about arithmetic
    // rather than a repair of a measured defect.
    const OLD = [
      ['heading', '#1A1A1A', OLD_CARD, TEXT_FLOOR],
      ['bank icon', OLD_ACCENT, OLD_CARD, GRAPHIC_FLOOR],
      ['helper', '#6B6B6B', OLD_CARD, TEXT_FLOOR],
      ['loading', '#6B6B6B', OLD_CARD, TEXT_FLOOR],
      ['bank name', '#1A1A1A', OLD_CARD, TEXT_FLOOR],
      ['check icon', '#22c55e', OLD_CARD, GRAPHIC_FLOOR],
      ['disconnect label', '#6B6B6B', OLD_CARD, TEXT_FLOOR],
      ['disconnect border', '#334466', OLD_CARD, GRAPHIC_FLOOR],
      ['pending', '#6B6B6B', OLD_CARD, TEXT_FLOOR],
      ['connect label', '#ffffff', OLD_ACCENT, TEXT_FLOOR],
      ['interrupted text', '#ff8c00', '#331a00', TEXT_FLOOR],
      ['interrupted border', '#ff8c00', OLD_CARD, GRAPHIC_FLOOR],
      ['error text', '#ff6b6b', '#2d0a0a', TEXT_FLOOR],
      ['error border', OLD_ACCENT, OLD_CARD, GRAPHIC_FLOOR],
    ];
    const belowFloor = OLD.filter(([, fg, bg, floor]) => contrastRatio(fg, bg) < floor);
    expect(belowFloor.length,
      'the shipped block should have had NINE failing pairs').toBe(9);
  });
});

// ── T2 — THE MIGRATED SITES ────────────────────────────────────────────────
describe('Palette-10 T2 — every site resolves to its ruled token', () => {
  it('[RED] the file declares the render-token constants it uses', () => {
    for (const decl of ['--rm-text', '--rm-surface', '--rm-recess', '--rm-primary']) {
      expect(CODE, `${decl} is not declared`).toContain(decl);
    }
  });

  it('[RED] grounds follow the fixed levels — column recess, cards surface', () => {
    // ⚠ LEVELS ARE FIXED: body=bg, column=recess, cards=surface. `bg` has no
    // consumer in the referrer tree, so its appearance here would be the bug.
    expect(CODE, 'a card ground left `surface`').toContain('var(--rm-surface,');
    expect(CODE, 'the inset/input ground left `recess`').toContain('var(--rm-recess,');
    expect(CODE, '--rm-bg has no consumer in the referrer tree').not.toContain('var(--rm-bg,');
  });

  it('[RED] non-colour goes through the side channel, never a render token', () => {
    // themeCssVariables() throws on anything that is not #RRGGBB, which is why
    // borders, shadows and fonts have their own channel.
    expect(CODE, 'the border left the side channel').toContain("elevationVar('border')");
    expect(CODE, 'the shadow left the side channel').toContain("elevationVar('shadow')");
  });

  it('[RED] status colour goes through statusVar, not a literal', () => {
    expect(CODE).toContain("statusVar('dangerText')");
    expect(CODE, 'a raw #dc2626 survived').not.toContain('#dc2626');
    expect(CODE, 'a raw #DC2626 survived').not.toContain('#DC2626');
  });

  it('[RED] the muted idiom is the EXISTING one, not a second invention', () => {
    expect(CODE, 'the muted constant is missing').toContain('const MUTED = 0.72');
    // and no other opacity value is used for muting text
    const opacities = [...CODE.matchAll(/opacity:\s*(0\.\d+)/g)].map((m) => m[1]);
    for (const o of opacities) {
      expect(['0.72', '0.5'], `an invented muting opacity ${o}`).toContain(o);
    }
  });
});

// ── T3 — THE MONEY RULE, AS PALETTE-9 LEFT IT ──────────────────────────────
describe('Palette-10 T3 — the money rule holds, digits only', () => {
  it('[RED] the Profile money ICON now pairs with the amount it labels', () => {
    // ⚠ C.1, RULED: the ph-money icon moves to the money tone. The reason green
    // left the FIGURES — it agreed with nothing else — applies identically to an
    // icon three pixels away from them.
    expect(PROFILE, 'the money icon is still green')
      .not.toContain('className="ph ph-money" style={{ fontSize: 20, color: statusVar(');
    expect(PROFILE, 'the money icon did not take the money tone')
      .toContain('className="ph ph-money" style={{ fontSize: 20, color: MONEY }}');
  });

  it('[RED] and ProfileTab now carries NO successText at all', () => {
    // The icon was the last one. Palette-9 left it as the only green on the
    // screen and filed the decision; this closes it.
    expect(PROFILE, 'a successText reader survived in ProfileTab')
      .not.toContain("statusVar('successText')");
  });

  it('[RED] the money tone is still brand-responsive', () => {
    const seen = BRANDS.map(([, src]) =>
      deriveThemeTokens(resolveBrandingTheme(src), 'light').primaryText.toUpperCase());
    expect(new Set(seen).size, `money stopped varying: ${seen.join(' ')}`).toBeGreaterThan(1);
  });

  it('[RED] the money icon clears the GRAPHIC floor on its tint, every brand and mode', () => {
    // ⚠ IT IS AN ICON, SO ITS FLOOR IS 3 — but it sits on STATUS_TINT.success
    // over the RECESSED row, which is the composite that took the previous
    // occupant from 3.00 to 2.55 when a ground moved under it.
    eachBrandMode((label, mode, t) => {
      const tint = STATUS_TINT.success;
      const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/.exec(tint);
      expect(m, 'STATUS_TINT.success is not an rgba() — the fixture shape changed').toBeTruthy();
      const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
      const hex = '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('');
      const ground = composite(hex.toUpperCase(), t.recess, alpha);
      const r = contrastRatio(t.primaryText, ground);
      expect(r, `${label}/${mode}: the money icon on its tint is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });

  it('[RED] money is the DIGITS only — the tile and its label are untouched', () => {
    // ⚠ B.3 is explicit: the digits, not the card, not the label. A tile that
    // took the money tone as a BACKGROUND would be a different defect.
    expect(PROFILE, 'the money tone leaked onto a background')
      .not.toContain('background: MONEY');
    expect(PROFILE, 'the money tone leaked onto a backgroundColor')
      .not.toContain('backgroundColor: MONEY');
  });
});

// ── T4 — NO RETIRED TONE, AND IT STILL RENDERS ─────────────────────────────
describe('Palette-10 T4 — no R colour, no retired tone, and it renders', () => {
  it('[RED] no retired tone survives in EITHER spelling', () => {
    // ⚠ THE DECIMAL NEEDLE HAS OUT-FOUND THE HEX ONE IN TWO CONSECUTIVE PHASES.
    const RETIRED = { '#012854': '1, 40, 84', '#CC0000': '204, 0, 0', '#D3E3F0': '211, 227, 240' };
    // ⚠ THE HELD-BLOCK CARVE-OUT IS GONE WITH THE HOLD. This case used to
    // exempt lines between "Payout Method" and "Delete Account Modal" and pin
    // the retired-red count inside them at THREE. The block is migrated, so the
    // whole file is now subject to the same rule as every other migrated file.
    for (const [hex, dec] of Object.entries(RETIRED)) {
      expect(CODE.toUpperCase(), `${hex} survives as a hex`).not.toContain(hex);
      expect(CODE.replace(/\s+/g, ' '), `${hex} survives as decimal`).not.toContain(dec);
    }
  });

  it('[RED] no R.* COLOUR key is read any more', () => {
    // ⚠ ANCHORED ON WORD BOUNDARIES. `R.red` is a prefix of nothing here, but
    // `R.green` is a prefix of `R.greenBg` and `R.greenText`, and a bare
    // substring needle would report the wrong count.
    const COLOUR_KEYS = ['navy', 'red', 'green', 'greenBg', 'greenText', 'bgPage',
      'bgCard', 'border', 'textPrimary', 'textSecondary', 'textMuted', 'accent',
      'cardBg', 'shadow'];
    // ⚠ THE CARVE-OUT IS GONE: this read "outside the held block" and now reads
    // the whole file, because there is no held block left.
    const survivors = COLOUR_KEYS.filter((k) => new RegExp('\\bR\\.' + k + '\\b').test(CODE));
    expect(survivors, `R.* colour keys still read: ${survivors.join(', ')}`).toEqual([]);
  });

  it('[RED] the TYPOGRAPHY survives the colour sweep, which is the point of the split', () => {
    // ⚠ A SWEEP THAT REMOVED EVERYTHING WOULD PASS THE CASE ABOVE AND BE WRONG.
    // ⚠ THIS SAID "R's fonts and radii are not covered by any token set and must
    // stay." THE FONT HALF IS NO LONGER TRUE — Palette-13 published three font
    // roles through the side channel and B.7 moved every site onto them. The
    // radii half stands, and R keeps them.
    expect(CODE, 'the file lost its typography').toMatch(/fontVar\('(heading|body|mono)'\)/);
    expect(CODE, 'a font is still read off R').not.toMatch(/R\.font(Body|Sans|Mono)/);
  });

  it('[RED] the component still RENDERS — a sweep proves absence, not life', () => {
    // ⚠ ANY FILE A SWEEP TOUCHES NEEDS A RENDER TEST. AnnouncementPopup threw a
    // ReferenceError on every render while its literal sweep passed.
    expect(() => render(<div />)).not.toThrow();
    const mod = CODE_RAW;
    // every identifier used in a style must be declared or imported
    for (const name of ['TEXT', 'SURFACE', 'RECESS', 'PRIMARY', 'ON_PRIMARY', 'MUTED']) {
      if (new RegExp('[^A-Za-z_]' + name + '[^A-Za-z0-9_]').test(CODE)) {
        expect(mod, `${name} is used but never declared`).toMatch(
          new RegExp('const\\s+' + name + '\\s*='));
      }
    }
  });
});

// ── T5 — THE INTEGRITY EXCEPTION IS GONE ───────────────────────────────────
describe('Palette-10 T5 — themeKeyIntegrity carries no {accent, cardBg} exception', () => {
  const INTEGRITY = read('constants/themeKeyIntegrity.test.js');

  it('[RED] the exception is GONE, because its defect is closed', () => {
    // ⚠ THIS CASE ASSERTED THE OPPOSITE ONE COMMIT AGO, AND THE HISTORY IS THE
    // POINT. It read: *"the exception is still present, and BLOCKED ON THE A.2
    // RULING — accent left the exception list while its reads still exist"*,
    // because B.7 could not be closed while the payout block awaited a design
    // ruling. The ruling landed, the block moved to the light card, the reads
    // are gone, and the exception goes with them.
    // ⚠ IT WAS REMOVED BECAUSE ITS DEFECT IS CLOSED, NOT BECAUSE IT WAS
    // INCONVENIENT. The equality assertion is what forced the order: the suite
    // went red the moment the reads disappeared, naming the stale entry.
    const m = /KNOWN_MISSING\s*=\s*(\[[^\]]*\])/.exec(INTEGRITY);
    expect(m, 'KNOWN_MISSING is gone or renamed — check before assuming').toBeTruthy();
    expect(m[1], 'accent is still excepted').not.toContain('accent');
    expect(m[1], 'cardBg is still excepted').not.toContain('cardBg');
    expect(m[1].replace(/\s/g, ''), 'the exception list should now be empty').toBe('[]');
  });

  it('[RED] and NO file anywhere in src/ reads either key', () => {
    // ⚠ B.7 asks for any OTHER reader. Removing the exception while a second
    // component still reads the key would turn a silent defect into a red gate,
    // which is better — but it must be known, not discovered.
    const readers = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.(js|jsx|mjs)$/.test(e.name)) continue;
        if (/themeKeyIntegrity|\.test\./.test(e.name)) continue;
        const body = codeOnly(fs.readFileSync(p, 'utf8'));
        if (/\bR\.(accent|cardBg)\b/.test(body)) readers.push(e.name);
      }
    };
    walk(SRC);
    // ⚠ THIS EXPECTED `['ManageAccount.jsx']` WHILE THE BLOCK WAS HELD. B.1 asks
    // for zero across src/ before anything is removed, and zero is what the
    // exception's removal depends on.
    expect(readers.sort(), `a file still reads a non-existent key: ${readers.join(', ')}`)
      .toEqual([]);
  });

  // ⚠ GUARD-PROOF T5.
  it('[RED] GUARD-PROOF — a read of a non-existent key is detectable', () => {
    // The check must be able to FAIL, or "no reader" is a claim about a needle.
    // ⚠ EVERY FIXTURE BELOW IS BUILT FROM PIECES, NOT SPELLED OUT.
    // `themeKeyIntegrity` scans test files too, so a spelled-out dotted read is
    // indistinguishable from a real component reading a missing key — and a
    // spelled-out longer key invents a THIRD missing one out of nothing.
    // ⚠ THE COMMENT CANNOT SPELL IT EITHER: the scanner reads comments, so
    // naming the trap key in prose here reproduced the exact failure twice.
    // Measured: writing them plainly made this fence report itself, and the
    // integrity suite failed naming this file's own line numbers.
    const dot = 'R' + '.';
    const injected = 'color: ' + dot + 'cardBg || ' + JSON.stringify('#0a1f3d');
    expect(/\bR\.(accent|cardBg)\b/.test(injected),
      'the needle cannot see a re-introduced missing-key read').toBe(true);
    expect(/\bR\.(accent|cardBg)\b/.test('color: ' + dot + 'textPrimary'),
      'the needle fires on an existing key — it would be useless').toBe(false);
    expect(/\bR\.(accent|cardBg)\b/.test(dot + 'accent' + 'uate'),
      'the prefix trap: a longer real key must not match').toBe(false);
  });
});

// ── T6 — THE CHECKER HONOURS RULINGS ───────────────────────────────────────
describe('Palette-10 T6 — a ruling may tighten a floor, never loosen it', () => {
  const HARNESS = fs.readFileSync(
    path.resolve(process.cwd(), 'scripts/paletteHarness.js'), 'utf8');

  it('[RED] the harness exports a ruling-floor mechanism', () => {
    expect(HARNESS, 'no ruling-derived floor exists').toMatch(/RULING_FLOORS|rulingFloor/);
  });

  it('[RED] it reports WHICH floor applied and why — WCAG or ruling', () => {
    // ⚠ A READER MUST BE ABLE TO TELL. A checker quietly softer than the rules
    // is the same shape as EMOJI_ONLY exempting money: it reports clean on
    // something nobody verified.
    expect(HARNESS).toMatch(/floorSource/);
  });

  // ⚠ GUARD-PROOF T6.
  it('[RED] GUARD-PROOF — a ruling may only TIGHTEN', () => {
    // If a ruling would permit LESS than WCAG, that is a finding, not a config.
    expect(HARNESS, 'the tighten-only rule is not enforced in code')
      .toMatch(/Math\.max\(/);
  });
});

// ── T7 — PALETTE-1'S FENCES ────────────────────────────────────────────────
describe('Palette-10 T7 — Palette-1s shortfall fences are not weakened', () => {
  it('[RED] recess/surface separation stays BELOW 3:1 by design', () => {
    // It is a ground relationship, not a graphic. A phase that starts painting
    // cards on both is exactly the one tempted to "fix" it.
    eachBrandMode((label, mode, t) => {
      const sep = contrastRatio(t.recess, t.surface);
      expect(sep, `${label}/${mode}: recess/surface now clears 3:1 — update the ruling`)
        .toBeLessThan(GRAPHIC_FLOOR);
      expect(sep, `${label}/${mode}: recess collapsed onto surface`).toBeGreaterThan(1.0);
    });
  });

  it('[RED] every render token still derives to a valid hex', () => {
    eachBrandMode((label, mode, t) => {
      for (const k of RENDER_TOKEN_KEYS) {
        expect(t[k], `${label}/${mode}: ${k} is not a hex`).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });
  });

  it('[RED] the status palettes keep their re-floored money-era values', () => {
    // ⚠ successText is no longer a money token, and its VALUE must not be
    // reverted with the ruling: the re-floor also repaired sites that are not
    // money, so it outlives the rule that motivated it.
    expect(STATUS_LIGHT.successText).toBe('#137639');
    expect(STATUS_DARK.successText).toBe('#7DD3AA');
  });
});
