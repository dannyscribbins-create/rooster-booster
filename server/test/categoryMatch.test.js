'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 7c-0 — ONE DEFINITION OF CATEGORY MATCHING, AND THE MIRROR THAT MUST NOT DRIFT
//
// Three places compared a schedule's qualifying value against an option or a record's value, three
// different ways, and NONE of them trimmed. Two of Accent's nineteen live Jobber options carry a
// trailing space (`'Skylight Install '`, `'Gutter Cleaning '`), so the looseness was reachable:
//   · the engine refused to MATCH a real pair      → a referrer silently not paid
//   · the admin panel reported a real option MISSING → a false alarm on the same pair
// One bug, two directions. This file pins the one matcher and the mirror.
//
// ⚠ NO DATABASE. Pure functions plus two source reads, so nothing joins a reset list.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeCategoryValue, categoryValuesMatch, categoryListIncludes, findUnmatchedCategoryKeys,
} = require('../utils/categoryMatch');

// Accent's real option list, as discovery stored it 2026-09-26. ⚠ THE TWO TRAILING SPACES ARE
// LOAD-BEARING AND ARE NOT A TYPO — they are what Jobber returns, and a fixture that tidied them
// would be testing a world where this bug cannot happen.
const ACCENT_OPTIONS = [
  'Out of Pocket', 'Insurance', 'Finance', 'Warranty Service', 'Inspection',
  'Skylight Measurement', 'Chimney Cap Measurement', 'Chimney Cap Install', 'Skylight Install ',
  'Rain Pan Install', 'Tarp Installation', 'Gutter Install', 'Gutter Cover Install', 'Side Work',
  'Virtual Estimate', 'Gutter Cleaning ', 'Addendum', 'Repair', 'Repair Attempt',
];

describe('7c-0 — the shared category matcher', () => {
  it('normalises by trimming and folding case, and blank becomes null', () => {
    assert.equal(normalizeCategoryValue('  Skylight Install  '), 'skylight install');
    assert.equal(normalizeCategoryValue('REPAIR'), 'repair');
    assert.equal(normalizeCategoryValue(''), null);
    assert.equal(normalizeCategoryValue('   '), null);
    assert.equal(normalizeCategoryValue(null), null);
    assert.equal(normalizeCategoryValue(undefined), null);
    assert.equal(normalizeCategoryValue(42), null, 'a non-string is not a category value');
  });

  it('⚠ null NEVER MATCHES null — two unknowns are not the same category', () => {
    // Returning '' instead of null would make every blank match every other blank and select a
    // payout schedule on the strength of two absences.
    assert.equal(categoryValuesMatch('', ''), false);
    assert.equal(categoryValuesMatch(null, null), false);
    assert.equal(categoryValuesMatch('   ', ''), false);
  });

  it('THE DEFECT: a trailing space no longer breaks a match', () => {
    // This is the pair that exists in Accent's production data today.
    assert.equal(categoryValuesMatch('Skylight Install', 'Skylight Install '), true);
    assert.equal(categoryListIncludes(['Skylight Install'], 'Skylight Install '), true);
    assert.equal(categoryListIncludes(ACCENT_OPTIONS, 'Skylight Install'), true,
      'the option carries the space, the query does not — and they are the same option');
  });

  it('case differences no longer break a match either', () => {
    assert.equal(categoryValuesMatch('out of pocket', 'Out of Pocket'), true);
    assert.equal(categoryListIncludes(ACCENT_OPTIONS, 'REPAIR ATTEMPT'), true);
  });

  it('⚠ AND IT DOES NOT NORMALISE HARDER THAN TRIM AND CASE — the paired negative', () => {
    // A contractor's vocabulary is theirs. Two options differing by punctuation or interior
    // whitespace are two options they chose to distinguish, and merging them would pay the wrong
    // schedule. Without this case, "normalise more aggressively" looks like a free improvement.
    assert.equal(categoryValuesMatch('Gutter Install', 'Gutter-Install'), false);
    assert.equal(categoryValuesMatch('Gutter Install', 'GutterInstall'), false);
    assert.equal(categoryValuesMatch('Gutter  Install', 'Gutter Install'), false,
      'an INTERIOR double space is not collapsed — only the ends are trimmed');
    assert.equal(categoryValuesMatch('Repair', 'Repair Attempt'), false, 'never a prefix match');
  });
});

describe('7c-0 — the inverse guardrail', () => {
  it("flags Accent's retired quote-level keys, naming them as stored", () => {
    // The shape Danny's schedules carried before he reconfigured them: values from the QUOTE
    // "Job Type" sitting on schedules whose engine reads the JOB field.
    const keys = ['New Construction', 'Repair Attempt', 'Restoration', 'Skylight Install'];
    const unmatched = findUnmatchedCategoryKeys(keys, ACCENT_OPTIONS);
    assert.deepEqual(unmatched, ['New Construction', 'Restoration']);
  });

  it('⚠ PAIRED POSITIVE — a fully valid key set raises nothing', () => {
    // Accent's CURRENT configuration, read from production 2026-09-30. Without this case the
    // guardrail could flag everything and the case above would still pass.
    const current = ['Finance', 'Insurance', 'Out of Pocket', 'Gutter Cover Install',
      'Gutter Install', 'Repair', 'Side Work', 'Skylight Install '];
    assert.deepEqual(findUnmatchedCategoryKeys(current, ACCENT_OPTIONS), []);
  });

  it('⚠ A WHITESPACE-ONLY DIFFERENCE IS NOT FLAGGED — the false alarm this replaces', () => {
    // The old in-drawer check was `!allLabels.includes(l)`, exact and untrimmed, so a key stored
    // without the space was reported as "not in Jobber fields" while the option existed all along.
    assert.deepEqual(findUnmatchedCategoryKeys(['Skylight Install'], ACCENT_OPTIONS), []);
    assert.deepEqual(findUnmatchedCategoryKeys(['gutter cleaning'], ACCENT_OPTIONS), []);
  });

  it('⚠ AN UNKNOWN OPTION LIST FLAGS NOTHING, RATHER THAN EVERYTHING', () => {
    // No field mapped, or discovery never run. Reporting every key as broken would be a wall of
    // false alarms on exactly the setup where the admin can do least about it, and a guardrail that
    // cries wolf on a fresh install is one somebody switches off. Unknown is not wrong.
    assert.deepEqual(findUnmatchedCategoryKeys(['Anything'], []), []);
    assert.deepEqual(findUnmatchedCategoryKeys(['Anything'], null), []);
    assert.deepEqual(findUnmatchedCategoryKeys(['Anything'], ['   ', '']), [],
      'an option list of only blanks is also "unknown", not "nothing matches"');
  });

  it('a blank key is not reported as a missing Jobber option', () => {
    // It is a different defect — a key that should never have been stored — and folding it in here
    // would make the message claim Jobber lost an option it never had.
    assert.deepEqual(findUnmatchedCategoryKeys(['', '   ', 'Repair'], ACCENT_OPTIONS), []);
  });
});

describe('7c-0 — the src mirror must not drift from the canonical server copy', () => {
  // ⚠ WHY A FENCE AT ALL. The admin drawer needs the matcher for UNSAVED state as the admin toggles
  // pills, which the server cannot answer, so a second copy is unavoidable. This repo's established
  // arrangement is server-canonical / src-mirrored (see brandingTheme.js and its .mjs twin), and the
  // whole value of a mirror is that the diff between the copies is a FIXED, KNOWN quantity.
  const SERVER = path.join(__dirname, '..', 'utils', 'categoryMatch.js');
  const SRC = path.join(__dirname, '..', '..', 'src', 'utils', 'categoryMatch.mjs');

  /**
   * Reduce a copy to its executable shape, neutralising ONLY the two differences this repo's
   * mirrors are documented to carry: the MODULE SYSTEM and `'use strict'`.
   *
   * ⚠ THOSE TWO AND NO OTHERS, AND THE LIST IS THE POINT RATHER THAN THE STRIPPING. The first
   * writing of this fence neutralised the module system and forgot `'use strict'`, so it failed on
   * a difference that is deliberate (ESM is strict by definition, so the mirror omits the line —
   * see the header of `src/utils/brandingTheme.mjs` for the convention). **Every exemption added
   * here widens what may silently differ**, so each one is named for what it is.
   */
  function bodyOf(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'))
      .filter((l) => l !== "'use strict';")
      .map((l) => l.replace(/^export\s+function\s+/, 'function '))
      .filter((l) => !/^module\.exports/.test(l))
      .filter((l) => !/^(normalizeCategoryValue|categoryValuesMatch|categoryListIncludes|findUnmatchedCategoryKeys),?$/.test(l))
      .filter((l) => l !== '};')
      .join('\n');
  }

  it('the two copies have byte-identical executable bodies', () => {
    const a = bodyOf(fs.readFileSync(SERVER, 'utf8'));
    const b = bodyOf(fs.readFileSync(SRC, 'utf8'));
    // ⚠ NON-VACUITY FLOOR: without this, a stripper that reduced both to '' would pass forever.
    assert.ok(a.includes('function normalizeCategoryValue'), 'the stripped server body must still contain the functions');
    assert.ok(a.length > 400, `the stripped server body is suspiciously short (${a.length} chars)`);
    assert.equal(b, a, 'src/utils/categoryMatch.mjs has drifted from server/utils/categoryMatch.js');
  });

  it('the mirror exports all four names and the canonical copy is named as canonical', () => {
    const src = fs.readFileSync(SRC, 'utf8');
    for (const name of ['normalizeCategoryValue', 'categoryValuesMatch', 'categoryListIncludes',
      'findUnmatchedCategoryKeys']) {
      assert.ok(new RegExp(`export function ${name}\\b`).test(src), `mirror must export ${name}`);
    }
    assert.match(fs.readFileSync(SERVER, 'utf8'), /CANONICAL/,
      'the server copy must say it is the canonical one, or the mirror direction is guesswork');
  });
});

describe('7c-0 — the engine and the admin panel use the shared matcher, not their own', () => {
  const ROOT = path.join(__dirname, '..', '..');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  /** Comments stripped, line positions preserved, so a finding names the right line. */
  function stripComments(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  }

  it('referralRules no longer hard-codes the category field label', () => {
    const src = stripComments(read('server/referralRules.js'));
    // ⚠ NEEDLE ASSEMBLED FROM PIECES so this assertion is not itself the pattern it forbids.
    const forbidden = 'f.label ' + '=== ' + "'Job Type'";
    assert.ok(!src.includes(forbidden),
      'referralRules must resolve the category field through the contractor mapping');
    assert.match(src, /contractor_field_mappings/,
      'it must read the mapping');
    assert.match(src, /work_category/, 'and specifically the work_category key');
  });

  it('referralRules matches schedule keys through the shared matcher, not its own lowercase', () => {
    const src = stripComments(read('server/referralRules.js'));
    assert.match(src, /categoryListIncludes\(/, 'it must call the shared matcher');
    assert.ok(!/mapped_labels\.includes\(/.test(src),
      'the raw Array.includes comparison must be gone — it was exact and untrimmed');
    assert.ok(!/array_agg\(LOWER\(/.test(src),
      'the SQL half of the old two-language comparison must be gone');
  });

  it('the schedules endpoint returns the guardrail verdict and gates it on options_known', () => {
    const src = stripComments(read('server/routes/admin/campaigns.js'));
    assert.match(src, /findUnmatchedCategoryKeys\(/, 'the endpoint must compute the verdict');
    assert.match(src, /unmatched_job_types/, 'and return it per schedule');
    assert.match(src, /options_known/,
      'gated, or an unrun discovery reports every key as broken');
  });

  it('the admin panel surfaces it on the LIST, not only inside an open schedule', () => {
    const list = read('src/components/admin/ReferralProgramSettings.jsx');
    assert.match(list, /unmatched_job_types/,
      'the schedule list must read the verdict — the pre-7c-0 check was only reachable from Step 2');
    // ⚠ AND IT MUST NOT RECOMPUTE IT. A second definition in the client is the thing 7c-0 removes.
    assert.ok(!/findUnmatchedCategoryKeys\(/.test(list),
      'the list must consume the server verdict, never recompute it');
  });

  it('the drawer uses the mirrored matcher for its unsaved-state buckets', () => {
    const drawer = read('src/components/admin/ScheduleBuilderDrawer.jsx');
    assert.match(drawer, /categoryMatch\.mjs/, 'it must import the mirror');
    assert.match(drawer, /findUnmatchedCategoryKeys\(form\.job_types, allLabels\)/,
      'the amber bucket must come from the shared function');
    assert.ok(!/!allLabels\.includes\(/.test(drawer),
      'the old exact, untrimmed, case-sensitive comparison must be gone');
  });
});
