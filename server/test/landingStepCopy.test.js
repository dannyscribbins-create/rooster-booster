'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BR-2 PHASE 2 (A32(a)) — LP §2's STEP COPY BECOMES OVERRIDABLE
//
// ⚠ THE COPY DID NOT CHANGE. Every string keeps its exact wording as the FROZEN
// DEFAULT; what changed is that a contractor may replace it. A32 says this in
// terms, and T1 below is what makes it checkable rather than asserted: the
// defaults are pinned VERBATIM against the baseline captured from the served
// page at 24c747f, before any column existed.
//
// ⚠ NULL MEANS DEFAULT. The columns are added NULL and never backfilled, so
// "this contractor chose this string" stays distinguishable from "nobody has
// looked at it". EMPTY STRING IS ABSENT TOO — a cleared field returns the
// default rather than shipping an empty step, which is the state a
// touched-then-cleared field actually reaches (measured on the socials, where
// the production contractor has two of five stored as '').
//
// ⚠ AND THE THINGS THAT DID NOT MOVE ARE PINNED HARDER THAN THE THINGS THAT DID.
// The hero headline and the subhead are NOT overridable — the <h1> uses the
// PROGRAM name, so the subhead is the only place the COMPANY name appears in the
// hero, and free text there would let a contractor delete their own name from
// their own page. T4 fences that.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { resolveBrandingTheme } = require('../utils/brandingTheme');
const { __test__ } = require('../routes/landing');

// ⚠ THE BASELINE, COPIED FROM THE SERVED PAGE AT 24c747f — before a single
// column existed. These are the bytes the page emitted then, and T1 asserts the
// page still emits them now. Written as the rendered HTML rather than as bare
// strings so a change to the surrounding markup is caught too.
const FROZEN = Object.freeze({
  step1Title: 'Share your personal link',
  step2Title: 'They book a free inspection',
  step2Body:  'We take care of them like family',
  step3Title: 'You earn cash rewards',
  step3Body:  'Get paid when their job completes',
});

// The five columns, paired with the slot each drives. Used to build per-string
// fixtures — ⚠ ONE AT A TIME, because a fixture setting all five together cannot
// tell a per-string fallback from a single all-or-nothing branch.
const COLUMNS = Object.freeze([
  ['landing_step1_title', 'step1Title'],
  ['landing_step2_title', 'step2Title'],
  ['landing_step2_body',  'step2Body'],
  ['landing_step3_title', 'step3Title'],
  ['landing_step3_body',  'step3Body'],
]);

const BASE = Object.freeze({ contractor_name: 'Alpha Roofing Co', app_display_name: 'Alpha Rewards' });

// ⚠ THROWS ON AN UNEXPECTED SHAPE rather than returning something plausible —
// the BR-1 Phase 1-B lesson. renderState1 takes a RESOLVED theme; handing it a
// raw settings row would render every default and every absence assertion below
// would pass for exactly the wrong reason.
function pageFor(raw) {
  const theme = resolveBrandingTheme(raw);
  if (!theme || typeof theme.companyName !== 'string') {
    throw new Error('pageFor(): expected a resolveBrandingTheme payload');
  }
  const html = __test__.renderState1(theme);
  // NON-VACUITY, ONCE, FOR EVERY TEST BELOW: a renderState1 that threw or
  // returned '' would satisfy every "the default is absent" assertion in this
  // file. Nothing here is meaningful unless the page actually rendered.
  assert.ok(html.includes('<ol class="steps">'), 'renderState1 produced no steps list');
  assert.ok(html.includes('Create your account'), 'renderState1 produced no signup card');
  return html;
}

describe('BR-2 Phase 2 (A32(a)) — the frozen defaults', () => {

  it('[RED] T1 — every column NULL renders the frozen copy, VERBATIM', () => {
    const html = pageFor(BASE);

    // ⚠ ASSERTED AS RENDERED MARKUP, not as bare substrings. A bare
    // `includes('You earn cash rewards')` would still pass if the string moved
    // into an attribute or a comment.
    assert.ok(html.includes(`<h3>${FROZEN.step1Title}</h3>`), 'step 1 title drifted');
    assert.ok(html.includes(`<h3>${FROZEN.step2Title}</h3>`), 'step 2 title drifted');
    assert.ok(html.includes(`<p>${FROZEN.step2Body}</p>`),    'step 2 body drifted');
    assert.ok(html.includes(`<h3>${FROZEN.step3Title}</h3>`), 'step 3 title drifted');
    assert.ok(html.includes(`<p>${FROZEN.step3Body}</p>`),    'step 3 body drifted');

    // Step 1's body stays ASSEMBLED and is not overridable.
    assert.ok(html.includes('<p>Tell friends and neighbors about Alpha Roofing Co</p>'));
  });

  it('[RED] T1 — an EMPTY settings row renders the same page as a null one', () => {
    // The two absent shapes at the row level: a contractor with no settings row
    // at all, and one whose row exists with every landing column NULL.
    const noRow = pageFor(null);
    const nullCols = pageFor({ contractor_name: 'RoofMiles' });
    assert.equal(noRow, nullCols, 'a missing settings row and a NULL-column row diverged');
  });

  // ── T2 / T3 — PER STRING, ONE AT A TIME ────────────────────────────────────
  //
  // ⚠ EACH COLUMN GETS ITS OWN CASE, and that is the point rather than
  // thoroughness theatre. A fixture that set all five at once would pass against
  // a renderer that read ONE column and used it for all five slots, or against
  // one that fell back all-or-nothing. Only a per-string fixture separates them.
  for (const [col, slot] of COLUMNS) {
    const CUSTOM = `Custom ${slot} for this contractor`;

    it(`[RED] T2 — ${col} set renders the contractor's string, and the default appears NOWHERE`, () => {
      const html = pageFor({ ...BASE, [col]: CUSTOM });

      assert.ok(html.includes(CUSTOM), `${col} was ignored`);
      // ⚠ THE DEFAULT MUST BE GONE FROM THE WHOLE PAGE, not merely replaced in
      // its slot. A renderer that appended rather than substituted would satisfy
      // "the custom string is present" while shipping both.
      assert.ok(!html.includes(FROZEN[slot]),
        `the frozen default for ${slot} survived alongside the override`);

      // AND THE OTHER FOUR ARE UNTOUCHED — this is what catches a renderer that
      // reads one column into every slot.
      for (const [, otherSlot] of COLUMNS) {
        if (otherSlot === slot) continue;
        assert.ok(html.includes(FROZEN[otherSlot]),
          `setting ${col} also displaced ${otherSlot}`);
      }
    });

    it(`[RED] T3 — ${col} set to EMPTY STRING renders the default`, () => {
      const html = pageFor({ ...BASE, [col]: '' });
      assert.ok(html.includes(FROZEN[slot]),
        `an empty ${col} shipped a blank step instead of the default`);
    });

    it(`[RED] T3 — ${col} set to WHITESPACE renders the default`, () => {
      // The other realistic shape of a cleared field. `firstNonEmpty`'s contract
      // covers it; this pins that the renderer uses that contract rather than a
      // bare `||`, which would let '   ' through as a truthy blank step.
      const html = pageFor({ ...BASE, [col]: '   ' });
      assert.ok(html.includes(FROZEN[slot]),
        `a whitespace-only ${col} shipped a blank step instead of the default`);
    });
  }

  // ── T4 — WHAT IS NOT MOVING ────────────────────────────────────────────────
  it('[RED] T4 — the hero headline and subhead are unchanged by ANY stored value', () => {
    // ⚠ PIN THE THING THAT IS NOT MOVING. A32 reaches five strings; a reader who
    // sees "the copy freeze was amended" must not be able to widen it by
    // accident, and the subhead is the one that matters — the <h1> uses the
    // PROGRAM name, so the subhead is the only place the COMPANY name appears in
    // the hero. Free text there lets a contractor delete their own name.
    const everythingSet = Object.fromEntries(COLUMNS.map(([c, s]) => [c, `override ${s}`]));
    const html = pageFor({ ...BASE, ...everythingSet });

    assert.ok(html.includes('<h1>Join the Alpha Rewards rewards program</h1>'),
      'the hero headline moved');
    assert.ok(html.includes('<p>Earn cash for referring friends and neighbors to Alpha Roofing Co.</p>'),
      'the subhead moved — it is NOT overridable, see A32');
  });

  it('[RED] T4 — no landing_* column can reach the hero, even named like one', () => {
    // Adversarial: a column that looks like it should drive the hero must not.
    // If someone later adds `landing_headline` or `landing_subhead` the resolver
    // and renderer must both ignore it until an amendment says otherwise.
    const html = pageFor({
      ...BASE,
      landing_headline: 'HIJACKED HEADLINE',
      landing_subhead: 'HIJACKED SUBHEAD',
    });
    assert.ok(!html.includes('HIJACKED'), 'an unratified landing_* column reached the hero');
  });

  // ── THE BACKFILL FENCE ─────────────────────────────────────────────────────
  it('[RED] a stored value EQUAL to the frozen default is still distinguishable from NULL', () => {
    // ⚠ THIS IS THE GUARD THE MIGRATION DELIBERATELY DOES NOT CARRY. Adding
    // nullable columns with no backfill leaves no partial state, so a boot-time
    // fail-closed guard would have nothing to observe — it would be a mechanism
    // reporting health it cannot see. The risk it would guard against is a
    // FUTURE backfill, so it is fenced here instead.
    //
    // The rendered output is identical either way — that is expected and is not
    // the defect. What must stay true is that the RESOLVER reports them
    // differently, because that is what a future audit of "who has actually
    // reviewed their copy" would read.
    const stored = resolveBrandingTheme({ ...BASE, landing_step2_body: FROZEN.step2Body });
    const nulled = resolveBrandingTheme(BASE);

    assert.equal(stored.landingStep2Body, FROZEN.step2Body);
    assert.equal(nulled.landingStep2Body, null,
      'a NULL column resolved to the default instead of to null — the ' +
      'chose-it/never-touched-it distinction is gone, which is what backfilling ' +
      'would destroy');
  });
});
