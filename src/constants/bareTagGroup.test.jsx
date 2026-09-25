import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tagLabel } from './adminTheme';

// ── A BARE TAG GROUP IS NOT REBUILT (3d Phase 1a Commit 4c) ──────────────────
//
// `GET /api/admin/jobber-client-tag-summary` now returns a `client_status` group whose
// values are WHOLE STORED TAGS — `paying_client` — rather than the value half of a
// `prefix:value` pair. Both audience builders rebuild a selectable tag as
// `${cat.prefix}:${val}`, which is right for every prefixed group and WRONG here: it
// would offer `client_status:paying_client`, a string no contact_tags row holds.
//
// ⚠ THE FAILURE IS SILENT AND LOOKS LIKE SUCCESS. The audience saves, evaluates, reports
// a member count of zero, and mails nobody — there is no error anywhere. The server
// proves the evaluation side (payingClientAudience.test.js drives the real evaluator
// against both forms); these cases hold the CLIENT side of the same contract.

const SRC = path.resolve(__dirname, '..');
const BUILDERS = [
  path.join('components', 'admin', 'AdminCampaigns.jsx'),
  path.join('components', 'admin', 'AdminContactsTab.jsx'),
];

const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('the audience builders honour cat.bare', () => {

  it('the files under test exist and are non-trivial — an empty read makes the rest vacuous', () => {
    for (const rel of BUILDERS) {
      expect(read(rel).length, `${rel} is suspiciously short`).toBeGreaterThan(1000);
    }
  });

  it('every prefix:value rebuild is guarded by cat.bare', () => {
    // ⚠ ANCHORED ON THE REBUILD ITSELF, NOT ON THE WORD "bare". A file could mention
    // `bare` in a comment and still rebuild unconditionally; this counts the rebuilds
    // and requires each one to sit on the guarded side of a conditional.
    // ⚠ A PLAIN SUBSTRING, NOT A /g/ REGEX, AND THE FIRST WRITING OF THIS CASE WAS THE
    // BUG IT DESCRIBES. `RegExp.prototype.test` on a /g/ pattern advances lastIndex
    // between calls, so filtering an array with one shared regex object matches every
    // OTHER line — the case went RED against correct code. A checker with state is not
    // a checker, and this one had its state exactly where the reader cannot see it.
    const REBUILD = '${cat.prefix}:';
    for (const rel of BUILDERS) {
      const src = read(rel);
      const lines = src.split(/\r?\n/);
      const rebuilds = lines.filter((l) => l.includes(REBUILD));
      expect(rebuilds.length, `${rel} should still rebuild prefixed groups`).toBeGreaterThan(0);
      for (const line of rebuilds) {
        expect(line, `${rel}: this rebuild is unguarded — a bare tag would be mangled`)
          .toMatch(/cat\.bare/);
      }
    }
  });

  it('the label is applied on the bare branch and NOT on the prefixed one', () => {
    // ⚠ BOTH HALVES, BECAUSE THE RULING HAS TWO HALVES. Danny ruled the three grouped
    // sites keep rendering the value half — a prefixed group prints its prefix as the
    // heading directly above, so "Invoice / Jobber status: Paid" would be a regression.
    // A BARE tag has no heading supplying that context, which is exactly why
    // paying_client must read "Paid client" there.
    for (const rel of BUILDERS) {
      const src = read(rel);
      expect(src, `${rel} must label the bare branch`)
        .toMatch(/cat\.bare \? tagLabel\(val\)/);
      expect(src, `${rel} must keep the prefixed branch rendering the value half`)
        .toMatch(/cat\.bare \? tagLabel\(val\) : val\.replace\(/);
    }
  });

  it('the bare tag the server sends carries a label — the two halves agree', () => {
    // The client-side half of the server contract: the group the server emits holds
    // `paying_client`, and that is the exact key TAG_LABELS must carry. A rename on
    // either side without the other silently reverts the pill to a raw identifier.
    expect(tagLabel('paying_client')).toBe('Paid client');
  });

  it('the selected-tag list is built from the same guarded rebuild', () => {
    // AdminCampaigns computes visibleTagSet separately from the pill loop, and an
    // unguarded rebuild THERE would wrongly flag a selected paying_client as "hidden"
    // and render an amber warning pill for a tag that is plainly on screen.
    // ⚠ BOTH BUILDERS, BECAUSE ONLY ONE OF THEM WAS FIXED ON THE FIRST PASS AND THIS
    // FENCE IS WHAT FOUND THE OTHER. AdminContactsTab's set decides whether Section A
    // auto-opens: unguarded, a selected paying_client is absent from it and the section
    // holding that very pill stays collapsed.
    const NEEDLE = 'cat.values.map(v => (cat.bare ? v : `${cat.prefix}:${v}`))';
    for (const rel of BUILDERS) {
      expect(read(rel), `${rel} builds its selected-tag set unguarded`).toContain(NEEDLE);
    }
  });
});
