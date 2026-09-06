'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-8 PART C — THE CONTRAST FLOOR CHECK
//
// T1  the checker distinguishes text from non-text and applies the right floor
// T2  it fails loudly on an empty reading set
// T3  it catches all three known misses at their PRE-FIX values
// T4  the positive control fires on every run
//
// ⚠ WHY THIS EXISTS. Nothing in the Palette arc watched the 3:1 non-text floor,
// and three defects shipped because of it — each caught by the FOLLOWING phase
// or by hand. T3 is the acceptance test for the whole idea: a checker that does
// not catch the defects that motivated it is not the checker.
//
// ⚠ WHAT IT CAN AND CANNOT SEE. Everything here scores READINGS — the shapes the
// browser probe produces. It proves the SCORING is right. It cannot prove the
// PROBE reads the page correctly; that is the browser half, and its result is in
// the commit body. The two halves are split deliberately so the arithmetic can
// be tested without a browser and the browser is not asked to test arithmetic.
//
// ⚠ EXPECTED COUNT: 25 cases in this file — 22 written literally plus 3 generated
// by the MISSES loop in C.7. (Was 19/16 before the pictographic case below was
// added; the live sweep produced it, which is what the browser pass is for.)
// ⚠ AND THE FIRST PREDICTION WAS 17, WHICH IS WHAT COUNTING `test(` SOURCE LINES
// GIVES YOU. A loop that emits one case per row is invisible to a line count, so
// the number to predict is CASES EMITTED, not statements written. Recorded
// because a count you cannot predict cannot surprise you — and this one was off
// by exactly the loop.
// ─────────────────────────────────────────────────────────────────────────────

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  TEXT_FLOOR, LARGE_TEXT_FLOOR, NON_TEXT_FLOOR,
  ratioBetween, classifyContrastRole, scoreContrast,
  buildContrastProbeScript, assertContrastResult, summarizeContrast,
  EMOJI_ONLY,
} = require('../../scripts/paletteHarness');

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

// A reading factory. ⚠ It takes every field the classifier reads, so a test that
// forgets one gets a THROW rather than a default — the double that can also
// stand in for "no answer" is the trap this repo has hit repeatedly.
function reading(over) {
  return Object.assign({
    tag: 'span', cls: '', ownText: 'text', isIconFont: false, graphicRole: null,
    ariaHidden: false, fontSizePx: 14, fontWeight: 400,
    effectiveAlpha: 1, fg: { r: 0, g: 0, b: 0, a: 1 }, grounds: [WHITE],
  }, over);
}

describe('Palette-8 C.2 — text vs non-text, and the floor each gets', () => {
  test('[RED] normal text takes 4.5, large text takes 3, an icon takes 3', () => {
    assert.equal(classifyContrastRole(reading({ fontSizePx: 14 })).floor, TEXT_FLOOR);
    assert.equal(classifyContrastRole(reading({ fontSizePx: 24 })).floor, LARGE_TEXT_FLOOR);
    // 1.4.3's bold exception: >= 18.66px AND weight >= 700
    assert.equal(classifyContrastRole(reading({ fontSizePx: 19, fontWeight: 700 })).floor, LARGE_TEXT_FLOOR);
    assert.equal(classifyContrastRole(reading({ fontSizePx: 19, fontWeight: 400 })).floor, TEXT_FLOOR);
    assert.equal(
      classifyContrastRole(reading({ tag: 'i', ownText: '', isIconFont: true })).floor,
      NON_TEXT_FLOOR
    );
  });

  test('[RED] borders, state indicators and dividers are non-text', () => {
    for (const role of ['border', 'state indicator', 'divider']) {
      const c = classifyContrastRole(reading({ ownText: '', graphicRole: role }));
      assert.equal(c.kind, 'non-text', role + ' was not classified as non-text');
      assert.equal(c.floor, NON_TEXT_FLOOR);
      assert.ok(c.why.includes(role), 'the reason should name the role, got: ' + c.why);
    }
  });

  test('[RED] it REPORTS what it cannot classify rather than defaulting it', () => {
    // ⚠ A WRONG DEFAULT IS WORSE THAN A REPORTED UNKNOWN. Defaulting this to
    // non-text would silently pass body text at 3.2:1; defaulting it to text
    // would fail legitimate icons. It gets its own bucket and no floor.
    const c = classifyContrastRole(reading({ ownText: '', tag: 'div' }));
    assert.equal(c.kind, 'unclassifiable');
    assert.equal(c.floor, null);
    assert.ok(/neither own text nor an identifiable graphic role/.test(c.why));
  });

  test('[RED] and an unclassifiable reading is never scored as a pass', () => {
    const s = scoreContrast(reading({ ownText: '', tag: 'div' }));
    assert.equal(s.passes, null, 'unclassifiable must not report passes:true');
  });

  test('[RED] a malformed reading THROWS rather than being guessed at', () => {
    assert.throws(() => classifyContrastRole(null), /expected a reading object/);
    assert.throws(() => classifyContrastRole({}), /carries no tag/);
    // text with no font size is a broken PROBE, and saying so is the point
    assert.throws(
      () => classifyContrastRole(reading({ fontSizePx: undefined })),
      /the probe is wrong, not the page/
    );
    assert.throws(() => scoreContrast(reading({ grounds: [] })), /carries no grounds/);
    assert.throws(() => scoreContrast(reading({ effectiveAlpha: undefined })), /effectiveAlpha/);
  });
});

describe('Palette-8 C.1 — it measures the COMPOSITE, not the declaration', () => {
  test('[RED] inherited opacity is folded in — the class that shipped for two phases', () => {
    // A perfectly correct declaration inside a muted parent. Every element's own
    // colour reads fine; the pair does not.
    const opaque = scoreContrast(reading({ fg: { r: 177, g: 72, b: 10, a: 1 }, effectiveAlpha: 1 }));
    const muted = scoreContrast(reading({ fg: { r: 177, g: 72, b: 10, a: 1 }, effectiveAlpha: 0.72 }));
    assert.ok(opaque.ratio >= TEXT_FLOOR, 'the opaque pair should clear: ' + opaque.ratio);
    assert.ok(muted.ratio < TEXT_FLOOR, 'the inherited-opacity pair should fail: ' + muted.ratio);
    // the measured figure Palette-5 found live
    assert.ok(Math.abs(muted.ratio - 3.29) < 0.1, 'expected ~3.29:1, got ' + muted.ratio);
  });

  test('[RED] a gradient is scored on its WORST stop, never an average', () => {
    // ⚠ AVERAGING WOULD HAVE PASSED THE HERO TEXT THAT FAILED. It read 5.48:1
    // against the base and 3.54:1 against the darker stop.
    const light = { r: 115, g: 146, b: 204 };   // the brighter stop
    const dark = { r: 78, g: 117, b: 190 };     // the darker stop
    const s = scoreContrast(reading({
      ownText: 'Hey', fg: { r: 0, g: 0, b: 0, a: 1 }, effectiveAlpha: 0.72,
      grounds: [light, dark],
    }));
    assert.equal(s.stops, 2);
    const againstLight = ratioBetween(
      { r: 0 * 0.72 + light.r * 0.28, g: 0 * 0.72 + light.g * 0.28, b: 0 * 0.72 + light.b * 0.28 }, light);
    assert.ok(s.ratio <= againstLight, 'the score must be the worst stop, not the better one');
  });

  test('[RED] and the ground it scored against is reported, so a wrong ground is visible', () => {
    const s = scoreContrast(reading({ grounds: [WHITE, BLACK] }));
    assert.ok(s.worstGround, 'no worstGround reported');
    assert.deepEqual(s.worstGround, BLACK, 'black text on black should name black as the worst ground');
  });
});

describe('Palette-8 C.7 — it catches the three misses that motivated it', () => {
  // ⚠ THE ACCEPTANCE TEST FOR THE WHOLE IDEA, at each defect's PRE-FIX value.
  const MISSES = [
    ['Palette-4b: the activity icon after its ground moved', 2.55, reading({
      tag: 'i', cls: 'ph ph-money', ownText: '', isIconFont: true, fontSizePx: 20,
      fg: { r: 22, g: 163, b: 74, a: 1 }, grounds: [{ r: 210, g: 231, b: 227 }],
    })],
    ['the bottom nav\'s inactive label at 0.4 alpha', 2.40, reading({
      tag: 'span', ownText: 'Refer', fontSizePx: 11, fontWeight: 600, effectiveAlpha: 0.4,
      fg: { r: 1, g: 40, b: 84, a: 1 }, grounds: [WHITE],
    })],
    ['ContactModal\'s close control, open across two arcs', 2.61, reading({
      tag: 'i', cls: 'ph ph-x', ownText: '', isIconFont: true, fontSizePx: 18,
      fg: { r: 160, g: 160, b: 160, a: 1 }, grounds: [WHITE],
    })],
  ];

  for (const [name, expected, r] of MISSES) {
    test('[RED] ' + name, () => {
      const s = scoreContrast(r);
      assert.equal(s.passes, false, name + ' was not caught — ratio ' + s.ratio + ', floor ' + s.floor);
      assert.ok(Math.abs(s.ratio - expected) < 0.05,
        'expected ~' + expected + ':1, got ' + s.ratio);
    });
  }

  test('[RED] and each got the RIGHT floor — two icons at 3, one label at 4.5', () => {
    // ⚠ A CHECKER APPLYING ONE FLOOR TO EVERYTHING WOULD ALSO "CATCH" ALL THREE,
    // and would be wrong. This is what separates catching them from guessing.
    assert.equal(scoreContrast(MISSES[0][2]).floor, NON_TEXT_FLOOR);
    assert.equal(scoreContrast(MISSES[1][2]).floor, TEXT_FLOOR);
    assert.equal(scoreContrast(MISSES[2][2]).floor, NON_TEXT_FLOOR);
  });
});

describe('Palette-8 C.3/C.4 — it fails loudly rather than reporting silence', () => {
  const ok = (readings) => ({ ok: true, count: readings.length, readings });
  const anyText = (r) => typeof r.ownText === 'string' && r.ownText.trim() !== '';

  test('[RED] an empty reading set is a broken selector, not a clean sweep', () => {
    assert.throws(
      () => assertContrastResult(ok([]), { positiveControl: anyText }),
      /NOT a clean sweep/
    );
  });

  test('[RED] a dropped connection is not a clean sweep either', () => {
    for (const bad of [null, undefined, [], { ok: false }, { ok: true }]) {
      assert.throws(() => assertContrastResult(bad, { positiveControl: anyText }));
    }
  });

  test('[RED] a run with NO positive control is refused outright', () => {
    // ⚠ Without one a run cannot tell "found nothing wrong" from "looked in the
    // wrong place" — which is exactly what Part A's zero would have been.
    assert.throws(
      () => assertContrastResult(ok([reading({})]), {}),
      /cannot tell "found nothing wrong" from "looked in the wrong place"/
    );
  });

  test('[RED] a control that finds nothing FAILS even when readings are plentiful', () => {
    const plenty = Array.from({ length: 50 }, () => reading({ ownText: '', tag: 'i', isIconFont: true }));
    assert.throws(
      () => assertContrastResult(ok(plenty), {
        positiveControl: anyText, controlName: 'at least one text element',
      }),
      /the positive control found nothing/
    );
  });

  test('[RED] and it passes when the control genuinely fires', () => {
    const mixed = [reading({ ownText: 'Balance' }), reading({ ownText: '', tag: 'i', isIconFont: true })];
    const out = assertContrastResult(ok(mixed), {
      positiveControl: anyText, controlName: 'at least one text element',
    });
    assert.equal(out.length, 2);
  });
});

describe('Palette-8 — the summary a phase would act on', () => {
  test('[RED] shortfalls and unclassifiables are separate buckets', () => {
    const { tally, shortfalls, unclassifiable } = summarizeContrast([
      reading({ ownText: 'fine', fg: { r: 0, g: 0, b: 0, a: 1 } }),
      reading({ ownText: 'faint', fg: { r: 200, g: 200, b: 200, a: 1 } }),
      reading({ ownText: '', tag: 'div' }),
    ]);
    assert.equal(tally.text, 2);
    assert.equal(tally.unclassifiable, 1);
    assert.equal(shortfalls.length, 1, 'the faint text should be the only shortfall');
    assert.equal(unclassifiable.length, 1);
    // ⚠ AND AN UNCLASSIFIABLE IS NOT COUNTED AS A SHORTFALL. Conflating them
    // would turn "I could not tell" into "this is broken".
    assert.ok(!shortfalls.some((s) => s.kind === 'unclassifiable'));
  });

  test('[RED] the probe script is syntactically valid and carries no stray backtick', () => {
    const src = buildContrastProbeScript('*');
    assert.doesNotThrow(() => new Function('return ' + src), 'the probe does not parse');
    // ⚠ A BACKTICK INSIDE A COMMENT IN A TEMPLATE LITERAL CLOSES THE STRING and
    // the remainder parses as an expression — no error, half the script dropped.
    assert.ok(!/\/\/[^\n]*`/.test(src), 'a comment inside the probe carries a backtick');
  });
});

// ── C.2, the case the first live sweep produced ───────────────────────────────
// An emoji is not painted by `color`. Scoring one as text manufactures a
// shortfall out of a property the reader never sees. The live Profile sweep
// reported seven at 1.44:1 and 2.20:1 before this existed; every one was a
// report about the checker.
describe('Palette-8 C.2 — a pictographic glyph is unmeasurable, not failing', () => {
  const at = (ownText) => classifyContrastRole({
    tag: 'span', ownText, fontSizePx: 24, fontWeight: 400,
  });

  test('an emoji-only label is unclassifiable with no floor', () => {
    for (const e of ['⭐', '🔥', '🏠', '🏆', '🔒', '👍🏽', '👨‍👩‍👧']) {
      const c = at(e);
      assert.equal(c.kind, 'unclassifiable', e + ' should not be scored as text');
      assert.equal(c.floor, null, e + ' should carry no floor');
      assert.match(c.why, /pictographic/);
    }
  });

  test('an emoji BESIDE words is still text and still gets a floor', () => {
    // The anchoring is the whole point: a label that merely CONTAINS an emoji
    // is read as text, and exempting it would blind the checker to real copy.
    for (const s of ['🔥 Streak', 'Rank 1 🏆', 'AK']) {
      assert.equal(at(s).kind, 'text', JSON.stringify(s) + ' should stay text');
      assert.equal(typeof at(s).floor, 'number');
    }
  });

  test('scoring an unclassifiable reading yields passes:null, never false', () => {
    // ⚠ passes:false would put it in the shortfall list — which is precisely the
    // false positive this case exists to prevent.
    const scored = scoreContrast({
      tag: 'span', ownText: '🔥', fontSizePx: 24, fontWeight: 400,
      effectiveAlpha: 1, fg: { r: 255, g: 255, b: 255, a: 1 },
      grounds: [{ r: 255, g: 255, b: 255 }],
    });
    assert.equal(scored.passes, null);
    assert.equal(scored.floor, null);
  });
});

// ⚠ THE FENCE AROUND THE EXEMPTION ITSELF. The first EMOJI_ONLY used
// \p{Emoji_Component}, which includes the ASCII digits, so "500" and "1" were
// exempted as pictographic on the live Home sweep. An exemption that swallows
// money figures reports a clean run it never observed — strictly worse than the
// shortfall it hides. These cases exist so that can never come back quietly.
describe('Palette-8 C.2 — the pictographic exemption must not swallow real content', () => {
  const kindOf = (ownText) => classifyContrastRole({
    tag: 'span', ownText, fontSizePx: 24, fontWeight: 400,
  }).kind;

  test('digits, money and bare punctuation are TEXT, never exempt', () => {
    for (const s of ['500', '1', '$500', '0', '#', '*', '12 345', '#1']) {
      assert.equal(kindOf(s), 'text', JSON.stringify(s) + ' must keep a text floor');
    }
  });

  test('the exemption still covers real pictographs, including modified ones', () => {
    for (const s of ['⭐', '🔥', '👍🏽', '👨‍👩‍👧', '⚠️']) {
      assert.equal(kindOf(s), 'unclassifiable', JSON.stringify(s) + ' should be unmeasurable');
    }
  });

  test('EMOJI_ONLY requires an actual pictograph, not merely emoji-adjacent codepoints', () => {
    // The structural claim, not a sample: a string with no Extended_Pictographic
    // must never match, whatever else it contains.
    assert.ok(!EMOJI_ONLY.test('500'));
    assert.ok(!EMOJI_ONLY.test('#*0123456789'));
    assert.ok(EMOJI_ONLY.test('🔥'));
  });
});
