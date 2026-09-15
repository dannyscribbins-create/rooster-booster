// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-9 — MONEY GOES BRAND-RESPONSIVE
//
// ⚠ THIS FILE REVERSES A RULING THREE PHASES OLD, AND THE REVERSAL IS THE POINT.
// Palette-4a/5/6 ruled money GREEN and fenced it from both directions. Danny
// reversed that on 2026-09-05 AFTER SEEING IT LIVE on the Dashboard balance
// card. The reasoning, recorded here because a reversal with no reason reads as
// churn to the next reader:
//   - green stood out as intended, and agreed with nothing else on the screen;
//     distinction was bought at the cost of cohesion.
//   - ⚠ THE LABEL ALREADY CARRIED THE MEANING. "AVAILABLE BALANCE" sits directly
//     above the figure, so the colour was doing semantic work the copy had
//     already done. Redundant-and-clashing is worse than plain.
//   - the original ruling was a design concept tested by SHIPPING it and looking
//     at it. That is the correct reason to reverse a ruling, and it is why it was
//     shipped rather than argued.
//
// ⚠ WHAT DID NOT CHANGE, so nobody "completes" the reversal too far:
//   - projections, teasers, other people's money and form values stay on
//     `--rm-text`. That half of the money rule stands and T3 still fences it.
//   - `successText` KEEPS its Palette-4c re-floored value and its other
//     consumers. The re-floor also fixed sites that are not money.
//
// T1  every money-in-account figure resolves to `--rm-primary-text`
// T2  money is brand-RESPONSIVE — the inverse of Palette-5 T2's invariance fence
// T3  projections stay on `--rm-text`
// T4  every moved site clears 4.5:1 on its ground, per brand per mode
// T5  `successText`'s other consumers still resolve
// T6  the token set is intact
// T7  Palette-1's shortfall fences are not weakened
//
// ⚠ WHAT THESE TESTS CAN AND CANNOT SEE. jsdom resolves no var(). These are
// DECLARATION-level plus ARITHMETIC over the derivation; mounted-vs-fallback is
// the browser harness's half, and AD-4 applies — the harness and the graphic
// checker share a precondition (a rendered node), so agreement between them is
// one check reported twice unless the node actually rendered.
//
// ⚠ EXPECTED COUNT: 23 cases in this file, all written literally — no loop
// emits a case here, so `it(` lines and cases coincide. The first draft of this
// header said 18, which is what estimating rather than counting gives you; the
// count lives in the list, not in the sentence above it.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { deriveThemeTokens, contrastRatio, RENDER_TOKEN_KEYS } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';

const SRC = path.resolve(process.cwd(), 'src');
const read = (rel) => fs.readFileSync(path.resolve(SRC, rel), 'utf8');

const DASH = read('components/referrer/DashboardTab.jsx');
const PROFILE = read('components/referrer/ProfileTab.jsx');
const CASHOUT = read('components/referrer/CashOutTab.jsx');

const TEXT_FLOOR = 4.5;

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

// ⚠ TRACKS BLOCK-COMMENT REGIONS. A per-line startsWith check misses
// CONTINUATION lines of a /* */ block, which is how an earlier phase counted a
// comment as a consumer. This file asserts on COMMENTS in places too, so the
// raw text and the code-only text are kept as separate values on purpose.
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

// ⚠ THE SITES DECLARE A CONSTANT, SO COUNT THE USES, NOT THE LITERAL. The
// literal appears exactly once per file (the declaration); counting it would
// report 1 for a file with four money figures and 1 for a file with none of
// them wired — indistinguishable, which is the vacuity trap this arc keeps
// finding. `MONEY_DECL` fences the declaration itself, including its fallback.
const MONEY_DECL = "const MONEY          = 'var(--rm-primary-text, #B1480A)';";
const MONEY_USE = 'color: MONEY';
const countOf = (hay, needle) => hay.split(needle).length - 1;

// ── T1 — THE MOVE ───────────────────────────────────────────────────────────
describe('Palette-9 T1 — every money-in-account figure is on --rm-primary-text', () => {
  it('[RED] the Dashboard balance takes it on BOTH of its spans', () => {
    // The balance is ONE figure split across two elements for typography. Both
    // take the same tone or the glyph and the number disagree.
    expect(DASH, 'the Dashboard does not declare the money constant').toContain(MONEY_DECL);
    expect(countOf(codeOnly(DASH), MONEY_USE),
      'expected the two balance spans on --rm-primary-text').toBe(2);
  });

  it('[RED] Profile carries it on all four of its account figures', () => {
    // the Balance stat row, the completed-referral bonus, the "$N earned"
    // total, and the activity-row amount.
    expect(PROFILE, 'Profile does not declare the money constant').toContain(MONEY_DECL);
    // ⚠ THREE ARE `color: MONEY` AND THE FOURTH IS A TERNARY — the Balance stat
    // row reads `color: item.money ? MONEY : ...`. Counting only the direct form
    // would report 3 and read as a missing site; counting the identifier alone
    // would match the declaration too. Both forms are asserted by name.
    // ⚠ WAS 3, IS 4 SINCE PALETTE-10 C.1 MOVED THE `ph-money` ICON ONTO THE SAME
    // TONE. The icon is not a figure — B.3 is explicit that the rule moves the
    // DIGITS — but it labels one, and Danny ruled it pairs with the amount.
    expect(countOf(codeOnly(PROFILE), MONEY_USE),
      'three money figures plus the icon that labels one of them').toBe(4);
    expect(codeOnly(PROFILE), 'the Balance stat row lost the money tone')
      .toContain('color: item.money ? MONEY :');
  });

  it('[RED] the CashOut confirmation figure takes it', () => {
    expect(CASHOUT, 'CashOut does not declare the money constant').toContain(MONEY_DECL);
    expect(countOf(codeOnly(CASHOUT), MONEY_USE), 'the "Request Submitted!" amount').toBe(1);
  });

  it('[RED] and no money-in-account figure is left declaring successText', () => {
    // ⚠ THE NEGATIVE HALF. T1's positives would all pass with a stray green
    // still sitting on a fifth figure.
    expect(countOf(codeOnly(DASH), "statusVar('successText')"),
      'the Dashboard should carry no successText at all now').toBe(0);
  });

  // ⚠ GUARD-PROOF T1.
  it('[RED] GUARD-PROOF — a money figure pointed back at successText is caught', () => {
    const clean = codeOnly(DASH);
    expect(clean.includes("statusVar('successText')"), 'baseline: the Dashboard is clean').toBe(false);
    const mutated = clean.replace(MONEY_USE, "color: statusVar('successText')");
    expect(countOf(mutated, MONEY_USE), 'the needle cannot see a reverted figure').toBe(1);
    expect(mutated.includes("statusVar('successText')"), 'the injected green is invisible').toBe(true);
  });
});

// ── T2 — BRAND RESPONSIVENESS, THE INVERSE OF PALETTE-5 T2 ──────────────────
describe('Palette-9 T2 — money is brand-RESPONSIVE', () => {
  it('[RED] primaryText IS a render token, so it CAN be brand-derived', () => {
    // ⚠ STRUCTURAL, AND DELIBERATELY THE MIRROR OF THE FENCE IT REPLACES.
    // Palette-5 T2 asserted `successText` is NOT in RENDER_TOKEN_KEYS and that
    // no derivation emits it — that was the proof of invariance. The same claim
    // inverted is the proof of responsiveness.
    expect(RENDER_TOKEN_KEYS).toContain('primaryText');
    eachBrandMode((label, mode, t) => {
      expect(typeof t.primaryText, `${label}/${mode} emits no primaryText`).toBe('string');
      expect(t.primaryText, `${label}/${mode} primaryText is not a hex`).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });

  it('[RED] the seeded brands resolve DIFFERENT money colours in light mode', () => {
    // ⚠ THIS ASSERTS DIFFERENCE, NOT PRESENCE. Palette-4c's first invariance
    // test read one constant N times and asserted it equalled itself; the same
    // mistake inverted would be asserting each brand merely HAS a value.
    const seen = BRANDS.map(([, src]) =>
      deriveThemeTokens(resolveBrandingTheme(src), 'light').primaryText.toUpperCase());
    expect(new Set(seen).size,
      `money did not vary across brands: ${seen.join(' ')}`).toBeGreaterThan(1);
  });

  it('[RED] and in dark mode too', () => {
    const seen = BRANDS.map(([, src]) =>
      deriveThemeTokens(resolveBrandingTheme(src), 'dark').primaryText.toUpperCase());
    expect(new Set(seen).size,
      `money did not vary across brands in dark: ${seen.join(' ')}`).toBeGreaterThan(1);
  });

  it('[RED] both screens reach money through the SAME expression', () => {
    // ⚠ THE EQUALITY THAT MATTERS IS BETWEEN SCREENS, and it survives the
    // reversal unchanged: brand-responsive is not per-screen-variable. If
    // Dashboard and Profile named different tokens, "the same number paints the
    // same colour" would be false however brand-responsive each was alone.
    // ⚠ IDENTICAL DECLARATIONS, asserted character-for-character including the
    // fallback. A fallback that disagrees with what the provider mounts is its
    // own defect class — R-1's `var(--rm-danger, #FEE2E2)` painted 1.34:1.
    for (const [name, src] of [['Dashboard', DASH], ['Profile', PROFILE], ['CashOut', CASHOUT]]) {
      expect(src, name + ' declares a different money expression').toContain(MONEY_DECL);
    }
  });

  // ⚠ GUARD-PROOF T2 — the inverse of Palette-4c's fence.
  it('[RED] GUARD-PROOF — pinning money to a constant is caught as non-responsive', () => {
    const pinned = BRANDS.map(() => '#137639');
    expect(new Set(pinned).size, 'a pinned constant must read as ONE value').toBe(1);
    // and the real derivation must not look like that
    const real = BRANDS.map(([, src]) =>
      deriveThemeTokens(resolveBrandingTheme(src), 'light').primaryText.toUpperCase());
    expect(new Set(real).size).not.toBe(1);
  });
});

// ── T3 — THE HALF THAT DID NOT MOVE ────────────────────────────────────────
describe('Palette-9 T3 — projections still take the text tone', () => {
  it('[RED] no projection acquired the money token', () => {
    // Next Payout is a PROJECTION of what the next sold deal would pay. It was
    // excluded under the green rule and is excluded under this one; the rule's
    // test is "money the user HAS", which did not change.
    // ⚠ THIS CASE CARRIED THE OLD FENCE'S IDIOM AND WAS WRONG ON ITS FIRST RUN.
    // Palette-6 asserted `not.toContain('color: MONEY')` on the whole Dashboard,
    // because under the GREEN rule `MONEY` named the brand-text token and no site
    // was allowed to use it. Under this ruling `color: MONEY` is what the balance
    // is SUPPOSED to say, so the blanket negative fails on the correct code — and
    // had the balance not been wired, it would have PASSED on the wrong code.
    // ⚠ THE REPAIR IS TO NAME THE PROJECTION SITES, not to widen the needle.
    // Both Dashboard projections declare TEXT, and they are asserted by their own
    // expression rather than by the absence of someone else's.
    expect(codeOnly(DASH), 'the inline next-payout projection left the text tone')
      .toContain('<span style={{ color: TEXT, fontWeight: 700 }}>${nextPayout.total}</span>');
    expect(codeOnly(DASH), 'the next-payout card figure left the text tone')
      .toContain("fontFamily: fontVar('mono'), color: TEXT }}>${nextPayout.total}</p>");
    expect(codeOnly(PROFILE)).toContain('${nextPayout.total}');
  });

  it('[RED] the money flag still marks exactly ONE Profile stat row', () => {
    // ⚠ `money: true` IS THE RULING'S OWN TEST, not "contains a dollar sign".
    // Balance qualifies; Next Payout does not. If a second row acquired the
    // flag, a projection would have become account money silently.
    expect(countOf(PROFILE, 'money: true'), 'the money flag spread to another row').toBe(1);
  });

  it('[RED] GUARD-PROOF — a projection given the money token WOULD be caught', () => {
    const clean = codeOnly(DASH);
    const injected = MONEY_USE + ' /* injected */';
    const mutated = clean + '\n' + injected;
    expect(mutated.includes(injected), 'the needle cannot see an injected money tone').toBe(true);
  });
});

// ── T4 — THE CONTRAST, ON THE REAL GROUNDS ─────────────────────────────────
describe('Palette-9 T4 — every moved site clears 4.5:1, per brand per mode', () => {
  it('[RED] money clears the TEXT floor on `surface`', () => {
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.primaryText, t.surface);
      expect(r, `${label}/${mode}: money on a card is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] and on `recess`, which is the ground the activity rows sit on', () => {
    // ⚠ THE RECESSED GROUND IS THE WORSE OF THE PAIR and is why primaryText is
    // floored against both. Palette-4c learned this on successText: a tone
    // floored only against `surface` measured 2.93:1 one element lower.
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.primaryText, t.recess);
      expect(r, `${label}/${mode}: money on the recess is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] the 52px balance is held to 4.5:1, NOT the large-text allowance', () => {
    // ⚠ WCAG would permit 3:1 at this size. The ruling declines it: a payout
    // figure is the thing a homeowner reads most carefully, and primaryText is
    // already floored at 4.5 so the allowance buys nothing and costs a
    // justification nobody would find later.
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(t.primaryText, t.surface);
      expect(r, `${label}/${mode}: the balance took the large-text floor`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
    expect(DASH, 'the refusal of the large-text allowance is not recorded')
      .toContain('large-text');
  });

  // ⚠ GUARD-PROOF T4.
  it('[RED] GUARD-PROOF — the floor can actually fail', () => {
    // A floor assertion that no value could ever breach is not a floor. The
    // UNFLOORED brand colour is the honest counter-example: `primary` is floored
    // against the 3:1 NON-TEXT threshold, which is exactly why primaryText had
    // to be built.
    const offenders = [];
    eachBrandMode((label, mode, t) => {
      if (contrastRatio(t.primary, t.surface) < TEXT_FLOOR) offenders.push(`${label}/${mode}`);
    });
    expect(offenders.length,
      'no brand/mode fails the text floor on raw `primary` — the floor proves nothing')
      .toBeGreaterThan(0);
  });
});

// ── T5 — WHAT successText STILL CARRIES ────────────────────────────────────
describe('Palette-9 T5 — successText keeps its non-money consumers', () => {
  it('[RED] the re-floored VALUES are untouched', () => {
    // ⚠ DO NOT REVERT THE RE-FLOOR. The old value failed at 3.30 and 2.93, and
    // the re-floor also fixed sites that are not money — so it outlives the
    // ruling that motivated it.
    expect(STATUS_LIGHT.successText).toBe('#137639');
    expect(STATUS_DARK.successText).toBe('#7DD3AA');
  });

  it('[RED] and it still has real consumers outside the money set', () => {
    const survivors = ['components/auth/LoginScreen.jsx',
      'components/auth/ResetPinScreen.jsx',
      'components/shared/SuccessState.jsx',
      'components/referrer/ReferAFriendTab.jsx'];
    for (const rel of survivors) {
      expect(codeOnly(read(rel)), `${rel} lost its successText`).toContain("statusVar('successText')");
    }
  });

  it('[RED] those survivors still clear the text floor on `surface`', () => {
    eachBrandMode((label, mode, t) => {
      const r = contrastRatio(successFor(mode), t.surface);
      expect(r, `${label}/${mode}: successText on a card is ${r.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });
});

// ── T6 / T7 — THE TOKEN SET, AND THE OLD FENCES ────────────────────────────
describe('Palette-9 T6/T7 — the token set and Palette-1s fences', () => {
  it('[RED] Palette-1s shortfall fences still hold, unweakened', () => {
    // ⚠ NAMED HERE BECAUSE THIS PHASE MOVES COLOUR ONTO THE RECESSED GROUND.
    // The recess/surface separation is deliberately BELOW 3:1 — it is a ground
    // relationship, not a graphic — and a phase that starts painting money on
    // the recess is exactly the one that might be tempted to "fix" it.
    eachBrandMode((label, mode, t) => {
      const sep = contrastRatio(t.recess, t.surface);
      expect(sep, `${label}/${mode}: recess/surface now clears 3:1 — update the ruling`)
        .toBeLessThan(3);
      expect(sep, `${label}/${mode}: recess collapsed onto surface`).toBeGreaterThan(1.0);
    });
  });

  it('[RED] RENDER_TOKEN_KEYS is unchanged in length and prefix order', () => {
    // ⚠ A23.1: additions are APPENDED. This phase adds no token — it consumes
    // one that already existed — so the list must not move at all.
    expect(RENDER_TOKEN_KEYS.length).toBe(11);
    expect(RENDER_TOKEN_KEYS.slice(0, 6)).toEqual(
      ['primary', 'secondary', 'bg', 'surface', 'text', 'onPrimary']);
  });

  it('[RED] every render token still derives to a valid hex, every brand and mode', () => {
    eachBrandMode((label, mode, t) => {
      for (const k of RENDER_TOKEN_KEYS) {
        expect(t[k], `${label}/${mode}: ${k} is not a hex`).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });
  });
});
