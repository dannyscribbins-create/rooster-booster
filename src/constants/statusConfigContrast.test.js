// ─────────────────────────────────────────────────────────────────────────────
// EVERY STATUS_CONFIG PAIR MEETS ITS FLOOR — TEXT AT 4.5:1, DOT AT 3:1
//
// `STATUS_CONFIG` is the seven-state PIPELINE vocabulary, and it is correctly
// LITERAL: it belongs to the status system, not to the brand, so it does not
// move when a contractor edits a colour and it is not a candidate for
// tokenisation. What it never had was a contrast fence.
//
// ── ⚠ WHY A TABLE AND NOT A ONE-OFF FOR `lead` ──────────────────────────────
// This file was written to close ONE ruled defect — `lead`'s label at 4.39:1.
// Measuring all seven pairs instead of the one under repair found a SECOND
// defect nobody had recorded: `booking_pending`'s DOT at 2.86:1, under the 3:1
// graphic floor. A one-off assertion on `lead` would have shipped green beside
// it. The cost of the table over the one-off was nothing; the difference was a
// defect found rather than walked past.
//
// ── ⚠ TWO FLOORS, BECAUSE A DOT IS NOT TEXT ─────────────────────────────────
// The label is text and answers to 4.5:1 (WCAG 1.4.3). The dot is a small
// decorative disc and answers to the 3:1 non-text floor (1.4.11) — this repo's
// standing convention for a graphic. Asserting 4.5 on the dot would report a
// defect that is not one; asserting 3 on the label would miss one that is.
//
// ── ⚠ THE EXCEPTION IS PINNED TO ITS EXACT VALUE, NOT WAIVED ────────────────
// `booking_pending`'s dot is FILED, not fixed — it is outside the ruling this
// file ships under, and a phase that quietly repairs what it was not asked to
// repair is how a surface ends up changed with nobody able to say when. But an
// open-ended carve-out is a rubber stamp: it would let the value drift further
// and stay green. So the exception asserts the measured ratio EXACTLY. If anyone
// fixes it, this fires and they delete the entry. If anyone worsens it, this
// fires. No new defect can join the list silently.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { STATUS_CONFIG } from './theme';
import { contrastRatio } from '../utils/themeTokens.mjs';

const TEXT_FLOOR = 4.5;   // WCAG 1.4.3, normal-size text
const GRAPHIC_FLOOR = 3;  // WCAG 1.4.11, non-text

/**
 * Ratios for one status row, measured with the repo's own contrastRatio so this
 * file cannot disagree with the engine about what a number means.
 */
function ratios(cfg) {
  return {
    text: contrastRatio(cfg.color, cfg.bg),
    dot: contrastRatio(cfg.dot, cfg.bg),
  };
}

// ⚠ KNOWN, FILED, AND PINNED TO THE MEASURED VALUE — see the header.
const FILED_DOT_SHORTFALLS = Object.freeze({
  booking_pending: 2.86,
});

describe('STATUS_CONFIG — every pipeline pill clears its contrast floor', () => {

  it('POSITIVE CONTROL — the helper reports a known-failing pair as failing', () => {
    // ⚠ WITHOUT THIS, EVERY ASSERTION BELOW IS SATISFIED BY A BROKEN HELPER.
    // These are the exact values `lead` carried before this phase: #6b7280 on
    // #f3f4f6, which the admin palette independently measured at 4.39:1 and
    // rejected for the same reason. If contrastRatio ever stops distinguishing
    // them, this line is what says so.
    const known = contrastRatio('#6b7280', '#f3f4f6');
    expect(known).toBeCloseTo(4.39, 2);
    expect(known, 'the known-failing pair no longer fails — the helper is not measuring').toBeLessThan(TEXT_FLOOR);

    // And the other direction: a pair that must pass.
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('every label clears 4.5:1 on its own fill', () => {
    const failures = [];
    for (const [key, cfg] of Object.entries(STATUS_CONFIG)) {
      const { text } = ratios(cfg);
      if (text < TEXT_FLOOR) failures.push(`${key}: ${cfg.color} on ${cfg.bg} = ${text.toFixed(2)}`);
    }
    expect(failures, `status labels under the ${TEXT_FLOOR}:1 text floor`).toEqual([]);
  });

  it('every dot clears 3:1 on its own fill, except the ones filed and pinned', () => {
    const failures = [];
    for (const [key, cfg] of Object.entries(STATUS_CONFIG)) {
      if (key in FILED_DOT_SHORTFALLS) continue;
      const { dot } = ratios(cfg);
      if (dot < GRAPHIC_FLOOR) failures.push(`${key}: ${cfg.dot} on ${cfg.bg} = ${dot.toFixed(2)}`);
    }
    expect(failures, `status dots under the ${GRAPHIC_FLOOR}:1 graphic floor and NOT filed`).toEqual([]);
  });

  it('the filed dot shortfalls still measure exactly what was filed', () => {
    // ⚠ THIS IS THE HALF THAT STOPS THE EXCEPTION BECOMING A RUBBER STAMP.
    for (const [key, expected] of Object.entries(FILED_DOT_SHORTFALLS)) {
      const cfg = STATUS_CONFIG[key];
      expect(cfg, `${key} is filed as a dot shortfall but is no longer in STATUS_CONFIG`).toBeTruthy();
      expect(
        ratios(cfg).dot,
        `${key}'s dot moved from the filed ${expected}:1 — if it was FIXED, delete its entry from FILED_DOT_SHORTFALLS`
      ).toBeCloseTo(expected, 2);
    }
  });

  it('nothing that PASSES may sit on the filed list', () => {
    // ⚠ ADDED AFTER THE GUARD-PROOF FOUND THIS HOLE, AND IT IS WORTH THE LINE.
    // The two cases above were written claiming they made the carve-out
    // unrubber-stampable. They did not. Adding a PASSING key — `sold`, whose dot
    // is exactly 3.00 — to FILED_DOT_SHORTFALLS kept the whole file green: the
    // floor test skipped it because it was listed, and the pin test accepted it
    // because the number matched. A skip list that accepts passing entries grows
    // quietly and hides the next real one behind them.
    //
    // ⚠ THE BREAK WAS ONLY VISIBLE BECAUSE THE GUARD-PROOF TRIED IT. "It is
    // pinned to its value, so it cannot drift" was a claim about the mechanism
    // that the mechanism did not support.
    for (const [key, expected] of Object.entries(FILED_DOT_SHORTFALLS)) {
      expect(
        expected,
        `${key} is on the filed-shortfall list but ${expected}:1 clears the ${GRAPHIC_FLOOR}:1 floor — it does not belong there`
      ).toBeLessThan(GRAPHIC_FLOOR);
    }
  });

  it('lead is the pair this phase repaired, and it is repaired at the RULED value', () => {
    // ⚠ THE VALUE IS NAMED, NOT JUST THE FLOOR. "It clears 4.5" is satisfied by
    // any dark grey, including one chosen by accident. #4B5563 is the value the
    // ADMIN palette already moved this identical pair to (AD.grayMuted), so the
    // two trees now agree rather than having each picked a private answer.
    expect(STATUS_CONFIG.lead.color).toBe('#4B5563');
    expect(STATUS_CONFIG.lead.bg).toBe('#f3f4f6');
    expect(ratios(STATUS_CONFIG.lead).text).toBeCloseTo(6.87, 2);

    // ⚠ THE DOT MOVES WITH THE LABEL, AND THAT IS DELIBERATE. `lead` is the only
    // row where `dot === color`; every other row gives the dot a stronger tone.
    // The dot was never failing (4.39 is over the 3:1 graphic floor), so this is
    // not a repair — it is a refusal to introduce a divergence the row has never
    // had, for a value that only improves.
    expect(STATUS_CONFIG.lead.dot).toBe(STATUS_CONFIG.lead.color);
  });
});
