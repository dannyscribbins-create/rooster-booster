// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-11 B1 — ExperiencePopup and MissingReferralModal
//
// ⚠ THESE TWO SURFACES HAD NEVER BEEN OPENED ON THE LOCAL STACK. Part A found
// that three of the four gated popups were unreachable because the seeder wrote
// no rows for them, so every prior "clean" claim about this file was a claim
// about a surface nobody had rendered. The seeder now writes those rows.
//
// T1  every site resolves to its ruled token
// T2  each popup RENDERS ITS CONTENT — ⚠ a blank modal passes every contrast
//     assertion, so the substantive element is asserted by name
// T3  the money rule holds in both files
// T4  no R. colour read, no retired hex tone, no retired decimal tone
// T5  ⚠ ExperiencePopup's slide sequencing is UNCHANGED, including the
//     hidden-button branch and "Skip for now"
// T7  themeKeyIntegrity's subject — no read of a key R does not define
// T8  Palette-1's shortfall fences, unweakened
//
// ⚠ WHAT jsdom CANNOT SEE. It resolves no var(), so a declaration assertion
// proves the TOKEN NAME reached the element and nothing about what it paints.
// Mounted-vs-fallback is the browser harness's half; the arithmetic below is the
// derivation's half. Three instruments, none a substitute for another.
//
// ⚠ THE GROUNDS, ESTABLISHED BEFORE ANY TOKEN WAS RULED (M.2). A modal sits on a
// SCRIM, not on the page:
//     ExperiencePopup       scrim rgba(0,0,0,0.55) -> card `surface`
//     MissingReferralModal  scrim rgba(0,0,0,0.45) -> sheet `surface`,
//                           and its INPUTS are `recess` inside that sheet
// ⚠ TWO GROUNDS IN ONE MODAL IS THE RISK. A token floored against `surface` is
// not safe on `recess` — that is exactly what took two ManageAccount icons to
// 2.68 and 2.89 last phase.
//
// ⚠ CASE COUNT IS COUNTED WITH grep, NOT ESTIMATED. See the phase report.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio, RENDER_TOKEN_KEYS } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';
// ⚠ STATIC IMPORTS, NOT `await import()` INSIDE THE TEST. A dynamic import in
// the test body is resolved against the 5s per-test timeout, and under full-suite
// load this file's import cost pushed it past that — the case failed at 5.2s in
// the suite and passed in isolation, which reads exactly like a flake and is not
// one. Hoisting moves the cost to module load, where it is not timed.
import ExperiencePopup from './ExperiencePopup';
import MissingReferralModal from './MissingReferralModal';

const SRC = path.resolve(process.cwd(), 'src');
const read = (rel) => fs.readFileSync(path.resolve(SRC, rel), 'utf8');
const EXP_RAW = read('components/referrer/ExperiencePopup.jsx');
const MRM_RAW = read('components/referrer/MissingReferralModal.jsx');

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
const EXP = codeOnly(EXP_RAW);
const MRM = codeOnly(MRM_RAW);
const FILES = [['ExperiencePopup', EXP], ['MissingReferralModal', MRM]];

const px = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function composite(hex, ground, alpha) {
  const f = px(hex), b = px(ground);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}

afterEach(() => { vi.restoreAllMocks(); });

// ── T1 — THE TOKENS ────────────────────────────────────────────────────────
describe('Palette-11 B1 T1 — every site resolves to its ruled token', () => {
  it('[RED] both files declare the render-token constants they use', () => {
    for (const [name, code] of FILES) {
      expect(code, `${name} does not declare the text token`).toContain('--rm-text');
      expect(code, `${name} does not declare the surface token`).toContain('--rm-surface');
    }
  });

  it('[RED] the card/sheet ground is `surface`, and the modal scrim is NOT a token', () => {
    // ⚠ THE SCRIM IS DELIBERATELY A LITERAL. It is a dimming layer over whatever
    // is behind the modal, not a themed ground — the same call ManageAccount's
    // delete modal made. Tokenising it would claim the brand owns the dimming.
    for (const [name, code] of FILES) {
      expect(code, `${name}'s panel left \`surface\``).toContain('var(--rm-surface,');
      expect(code, `${name} lost its scrim`).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.\d+\)/);
    }
  });

  it('[RED] MissingReferralModal grounds its INPUTS on `recess`, not `surface`', () => {
    // ⚠ TWO GROUNDS IN ONE MODAL. The sheet is `surface`; the form fields are an
    // inset. Asserted by name because a token floored against one is not safe on
    // the other, which is the defect that surfaced mid-phase in ManageAccount.
    expect(MRM, 'the input inset left `recess`').toContain('var(--rm-recess,');
  });

  it('[RED] non-colour goes through the side channel', () => {
    for (const [name, code] of FILES) {
      if (/border:|borderRadius|boxShadow/.test(code)) {
        expect(code, `${name} declares a border or shadow outside the side channel`)
          .toMatch(/elevationVar\('(border|shadow|shadowLg|shadowMd)'\)/);
      }
    }
  });

  it('[RED] a fill takes the brand token and its label takes the ON tone', () => {
    // ⚠ M.3: every unmigrated fill was `R.navy` with a hardcoded white label.
    // `onPrimary` is DERIVED per brand and is not always white — on the platform
    // brand it is black. A hardcoded white label on a derived fill is a defect
    // waiting for a light brand.
    for (const [name, code] of FILES) {
      expect(code, `${name} has a fill with no ON tone`).toContain('ON_PRIMARY');
      expect(code, `${name} still hardcodes a white label`).not.toMatch(/color: '#fff'/);
    }
  });

  it('[RED] every fill/label pair clears the text floor, every brand and mode', () => {
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.onPrimary, t.primary);
      expect(r, `${label}/${mode}: a button label is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] body text clears the text floor on the card, every brand and mode', () => {
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.text, t.surface);
      expect(r, `${label}/${mode}: body text on the card is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] muted text clears the floor at the existing idiom, on BOTH grounds', () => {
    // ⚠ M.5: the existing 0.72, not a second invention. Checked against `recess`
    // too, because MissingReferralModal's fields sit on it.
    eachBrandMode((label, mode, t) => {
      for (const [gname, g] of [['surface', t.surface], ['recess', t.recess]]) {
        const c = composite(t.text, g, MUTED);
        const r = contrastRatio(c, g);
        expect(r, `${label}/${mode}: muted text on ${gname} is ${r.toFixed(2)}:1`)
          .toBeGreaterThanOrEqual(TEXT_FLOOR);
      }
    });
  });

  it('[RED] the brand border/icon clears the GRAPHIC floor on the card', () => {
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.primary, t.surface);
      expect(r, `${label}/${mode}: a brand edge on the card is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });

  it('[RED] the muted idiom is the EXISTING one, and no second one appears', () => {
    for (const [name, code] of FILES) {
      const opacities = [...code.matchAll(/opacity:\s*(0\.\d+)/g)].map((m) => m[1]);
      for (const o of opacities) {
        expect(['0.72', '0.5', '0.6'], `${name} invented a muting opacity ${o}`).toContain(o);
      }
    }
  });
});

// ── T2 — THEY ACTUALLY RENDER ──────────────────────────────────────────────
describe('Palette-11 B1 T2 — each popup renders its content', () => {
  it('[RED] ExperiencePopup renders its two response choices', () => {
    // ⚠ A BLANK MODAL PASSES EVERY CONTRAST ASSERTION. The substantive elements
    // are asserted by name, not by "nothing failed".
    render(<ExperiencePopup prompt={{ id: 1, response_type: 'pending' }} onDismiss={() => {}} />);
    expect(screen.getByText('Great experience')).toBeTruthy();
    expect(screen.getByText('Could be better')).toBeTruthy();
  });

  it('[RED] MissingReferralModal renders its form when open', () => {
    const { container } = render(
      <MissingReferralModal isOpen onClose={() => {}} token="t" />
    );
    expect(container.querySelector('input'), 'the form did not render').toBeTruthy();
  });

  it('[RED] and MissingReferralModal renders NOTHING when closed', () => {
    // ⚠ THE NEGATIVE HALF, and it is what makes the positive meaningful: if the
    // component rendered its shell regardless, the case above would pass on a
    // modal that is always present and never opened.
    const { container } = render(
      <MissingReferralModal isOpen={false} onClose={() => {}} token="t" />
    );
    expect(container.firstChild, 'a closed modal still rendered something').toBeNull();
  });
});

// ── T3 — THE MONEY RULE ────────────────────────────────────────────────────
describe('Palette-11 B1 T3 — the money rule holds', () => {
  it('[RED] no money FIGURE exists on either surface', () => {
    // ⚠ THIS CASE FIRST ASSERTED "neither file contains --rm-primary-text", AND
    // THAT WAS WRONG — it conflated the TOKEN with the money ROLE. The token is
    // "the brand colour made safe for TEXT", floored at 4.5 against both
    // `surface` and `recess`; money is its largest consumer, not its definition.
    // MissingReferralModal's focus ring needs exactly that property, because
    // `--rm-primary` measures 2.68:1 on the recessed input.
    // ⚠ WHAT THE RULE ACTUALLY GOVERNS is which FIGURES wear it, and neither of
    // these surfaces renders an account figure at all.
    for (const [name, code] of FILES) {
      expect(code, `${name} renders a currency figure`).not.toMatch(/\$\{[^}]*(balance|payout|amount|earned)/i);
    }
    expect(EXP, 'ExperiencePopup acquired a brand-text tone it has no ground for')
      .not.toContain('--rm-primary-text');
  });

  it('[RED] and where the token IS used, it is a non-text accent on `recess`', () => {
    expect(MRM, 'the focus ring left the text-floored brand tone').toContain('FOCUS_RING');
    expect(MRM).toContain("var(--rm-primary-text,");
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.primaryText, t.recess);
      expect(r, `${label}/${mode}: the focus ring on the input is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });

  it('[RED] GUARD-PROOF — `--rm-primary` would FAIL on that same ground', () => {
    // ⚠ THE POINT OF THE ROUTING, PROVEN RATHER THAN ASSERTED. If the obvious
    // token also passed, choosing the other one would be superstition.
    const failures = [];
    eachBrandMode((label, mode, t) => {
      if (contrastRatio(t.primary, t.recess) < GRAPHIC_FLOOR) failures.push(`${label}/${mode}`);
    });
    expect(failures.length,
      '`--rm-primary` clears the recess everywhere — the focus-ring routing proves nothing')
      .toBeGreaterThan(0);
  });
});

// ── T4 — NO RETIRED TONE, NO R COLOUR ──────────────────────────────────────
describe('Palette-11 B1 T4 — no R colour, no retired tone', () => {
  const COLOUR_KEYS = ['navy', 'red', 'green', 'greenBg', 'greenText', 'bgPage', 'bgCard',
    'border', 'borderMed', 'textPrimary', 'textSecondary', 'textMuted', 'shadow', 'shadowLg'];

  it('[RED] no R.* COLOUR key is read in either file', () => {
    for (const [name, code] of FILES) {
      const survivors = COLOUR_KEYS.filter((k) => new RegExp('\\bR\\.' + k + '\\b').test(code));
      expect(survivors, `${name} still reads: ${survivors.join(', ')}`).toEqual([]);
    }
  });

  it('[RED] the TYPOGRAPHY survives the colour sweep, which is the point of the split', () => {
    // ⚠ A SWEEP THAT REMOVED EVERYTHING WOULD PASS THE CASE ABOVE AND BE WRONG.
    // That reasoning is unchanged; what proves it moved in Palette-13 B.7. The
    // font keys left R because they were MIGRATED to the side channel, so the
    // proof of non-emptying is now the token call, not the key.
    for (const [name, code] of FILES) {
      expect(code, `${name} lost its typography`).toMatch(/fontVar\('(heading|body|mono)'\)/);
      expect(code, `${name} still reads a font off R`).not.toMatch(/R\.font(Body|Sans|Mono)/);
    }
  });

  it('[RED] no retired tone survives in EITHER spelling', () => {
    // ⚠ THE DECIMAL NEEDLE HAS OUT-FOUND THE HEX ONE IN THREE PHASES.
    const RETIRED = { '#012854': '1, 40, 84', '#CC0000': '204, 0, 0', '#D3E3F0': '211, 227, 240' };
    for (const [name, code] of FILES) {
      for (const [hex, dec] of Object.entries(RETIRED)) {
        expect(code.toUpperCase(), `${name}: ${hex} survives as a hex`).not.toContain(hex);
        expect(code.replace(/\s+/g, ' '), `${name}: ${hex} survives as decimal`).not.toContain(dec);
      }
    }
  });

  it('[RED] GUARD-PROOF — both needles fire on an injected retired tone', () => {
    // ⚠ AND THE R-KEY PATH IS THE ONE A HEX SWEEP CANNOT SEE: ManageAccount's
    // gear icon reached #012854 through `R.navy` and the hex needle found zero.
    const hexInjected = "color: '#012854'";
    const decInjected = 'background: rgba(1, 40, 84, 0.08)';
    const keyInjected = 'color: R.navy';
    expect(hexInjected.toUpperCase().includes('#012854')).toBe(true);
    expect(decInjected.replace(/\s+/g, ' ').includes('1, 40, 84')).toBe(true);
    expect(/\bR\.navy\b/.test(keyInjected)).toBe(true);
    // and the prefix trap: a longer key must not match a shorter needle
    expect(/\bR\.green\b/.test('R.greenBg'), 'prefix trap').toBe(false);
  });
});

// ── T5 — THE FLOW IS UNCHANGED ─────────────────────────────────────────────
describe('Palette-11 B1 T5 — ExperiencePopups sequencing is untouched', () => {
  it('[RED] the slide transitions are exactly the ones that shipped', () => {
    // ⚠ COLOURS ONLY. P.3 rules the hidden-button treatment minimal and gives the
    // full version to the Referral Conversion Engine, so a migration that
    // re-sequenced anything would be making that ruling by accident.
    expect(EXP, 'the positive choice no longer opens slide 1')
      .toContain("setDirection('positive'); setSlide(1);");
    expect(EXP, 'the negative choice no longer opens slide 1')
      .toContain("setDirection('negative'); setSlide(1);");
    expect(EXP, 'the 2.5s auto-advance from slide 2 is gone')
      .toContain('setSlide(3), 2500');
    expect(EXP, 'the terminal condition changed')
      .toContain("slide === 4 || (slide === 2 && direction === 'negative')");
  });

  it('[RED] the hidden-button branch and its exit still exist', () => {
    // The review button renders only with a destination; "Skip for now" calls
    // setSlide(3) directly, which is what makes hiding the button safe.
    expect(EXP, 'the review-destination gate is gone').toContain('branding.reviewUrl &&');
    expect(EXP_RAW, 'the Skip for now exit is gone').toContain('Skip for now');
    expect(EXP, 'Skip for now no longer advances to slide 3').toContain('setSlide(3)');
  });

  it('[RED] GUARD-PROOF — the flow needles would catch a re-sequence', () => {
    const resequenced = EXP.replace("setDirection('positive'); setSlide(1);",
      "setDirection('positive'); setSlide(2);");
    expect(resequenced.includes("setDirection('positive'); setSlide(1);"),
      'the needle cannot see a re-sequenced flow').toBe(false);
    expect(EXP.includes("setDirection('positive'); setSlide(1);"),
      'baseline: the shipped flow is present').toBe(true);
  });
});

// ── T7 / T8 ────────────────────────────────────────────────────────────────
describe('Palette-11 B1 T7/T8 — the token set and Palette-1s fences', () => {
  it('[RED] neither file reads a key R does not define', () => {
    // ⚠ THE KEYS ARE BUILT FROM PIECES, NOT SPELLED. themeKeyIntegrity scans
    // test files AND comments, and last phase this shape reported itself three
    // times over. Reworded, never exempted.
    const dot = 'R' + '.';
    const absent = ['card' + 'Bg', 'acc' + 'ent'];
    for (const [name, code] of FILES) {
      for (const key of absent) {
        expect(code.includes(dot + key), `${name} reads a non-existent key`).toBe(false);
      }
    }
  });

  it('[RED] recess/surface separation stays BELOW 3:1 by design', () => {
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

  it('[RED] the status palettes keep their re-floored values', () => {
    expect(STATUS_LIGHT.successText).toBe('#137639');
    expect(STATUS_DARK.successText).toBe('#7DD3AA');
  });
});
