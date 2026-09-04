'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-0 — THE STACK RECIPE AND THE HARNESS, FENCED
//
// T1  the seeder produces the three contractors IN THE STATED STATES
// T2  the harness reports MOUNTED, never the declaration, when the two differ
// T3  the harness fails loudly on a dropped connection rather than reporting clean
// T4  the seeder cannot run against a non-local or suite-owned database
//
// ⚠ T1 READS BACK FROM THE DATABASE. It does not assert that the seeder RAN — a
// seeder that quietly filled defaults would satisfy that and produce a stack
// unable to exercise a single absence rule. Every assertion below is on a row
// SELECTed after the write, and the sparse contractor's NULLs and empty strings
// are asserted as `null` and `''` SEPARATELY, because this arc has repeatedly
// found the two behaving differently.
// ─────────────────────────────────────────────────────────────────────────────

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { initTestDb } = require('./setup');
const {
  assertLocalStackTarget, withDatabase, seedStack, CONTRACTORS, DUAL_EMAIL, FORBIDDEN_DB,
} = require('../../scripts/seedLocalStack');
const {
  classifyPaint, assertHarnessResult, normalizeColour, summarize,
} = require('../../scripts/paletteHarness');

describe('Palette-0 T4 — the seeder cannot reach anything but a local scratch DB', () => {
  test('[RED] a non-local host is refused', () => {
    // ⚠ THE POSITIVE CONTROL IS THE POINT. "It threw" proves nothing on its own —
    // a typo in the URL would also throw. The localhost case below must PASS on
    // the same shape, or this case is satisfied by any failure at all.
    for (const host of ['postgres.railway.internal', 'db.example.com', '10.0.0.5']) {
      assert.throws(
        () => assertLocalStackTarget(`postgresql://u:p@${host}:5432/roofmiles_local`),
        /LOCAL STACK INTERLOCK[\s\S]*may only be seeded/,
        `a connection to ${host} was allowed`
      );
    }
    const ok = assertLocalStackTarget('postgresql://u:p@localhost:5432/roofmiles_local');
    assert.equal(ok.hostname, 'localhost');
    assert.equal(ok.database, 'roofmiles_local');
  });

  test('[RED] the suite-owned database is refused even though it IS local', () => {
    // This is the second, independent interlock: `roofmiles_test` passes the host
    // check and must still be refused, because the suite runs DROP SCHEMA public
    // CASCADE on it every run and would destroy a long-lived stack.
    assert.throws(
      () => assertLocalStackTarget(`postgresql://u:p@localhost:5432/${FORBIDDEN_DB}`),
      /Refusing to seed/,
      'the suite database was allowed'
    );
    assert.equal(
      assertLocalStackTarget('postgresql://u:p@127.0.0.1:5432/roofmiles_local').database,
      'roofmiles_local'
    );
  });

  test('[RED] a missing or unparseable connection string is refused, not defaulted', () => {
    for (const bad of [undefined, null, '', 'not-a-url', 42]) {
      assert.throws(() => assertLocalStackTarget(bad), /LOCAL STACK INTERLOCK/);
    }
    // and a URL naming no database at all
    assert.throws(() => assertLocalStackTarget('postgresql://u:p@localhost:5432'), /names no database/);
  });

  test('withDatabase swaps only the database, preserving host and credentials', () => {
    const out = withDatabase('postgresql://u:p@localhost:5432/roofmiles_test', 'roofmiles_local');
    const parsed = new URL(out);
    assert.equal(parsed.pathname, '/roofmiles_local');
    assert.equal(parsed.hostname, 'localhost');
    assert.equal(parsed.username, 'u');
  });
});

describe('Palette-0 T1 — the seeded stack is in the states the arc needs', () => {
  let pool;
  before(async () => { pool = await initTestDb(); await seedStack(pool); });
  after(async () => { await pool.end(); });

  test('[RED] three contractors exist, and the sparse one has a NULL slug', async () => {
    const { rows } = await pool.query(
      `SELECT id, slug FROM contractors WHERE id LIKE 'palette-%' ORDER BY id`
    );
    assert.equal(rows.length, 3, 'expected exactly three seeded contractors');
    const bySlug = Object.fromEntries(rows.map((r) => [r.id, r.slug]));
    assert.equal(bySlug['palette-alpha'], 'alpha-roofing');
    assert.equal(bySlug['palette-beta'], 'beta-exteriors');
    // ⚠ STRICTLY NULL, NOT FALSY. `''` would also be falsy and would exercise a
    // DIFFERENT branch — sources 2.5 and 3 of the D4 chain key on IS NULL.
    assert.strictEqual(bySlug['palette-gamma'], null, 'Gamma must have slug IS NULL, not empty string');
  });

  test('[RED] A and B are configured, and VISIBLY different from each other', async () => {
    const { rows } = await pool.query(
      `SELECT contractor_id, primary_color, secondary_color, logo_url, font_heading
         FROM contractor_settings WHERE contractor_id IN ('palette-alpha','palette-beta')
        ORDER BY contractor_id`
    );
    const [a, b] = rows;
    for (const r of rows) {
      for (const k of ['primary_color', 'secondary_color', 'logo_url', 'font_heading']) {
        assert.ok(r[k], `${r.contractor_id}.${k} must be set`);
      }
    }
    // ⚠ ASSERTING THEY DIFFER IS THE WHOLE POINT OF HAVING TWO. If a future edit
    // made the palettes similar, a cross-tenant leak would stop being obvious and
    // this fixture would quietly lose the property it exists for.
    assert.notEqual(a.primary_color, b.primary_color);
    assert.notEqual(a.secondary_color, b.secondary_color);
    assert.notEqual(a.logo_url, b.logo_url);
    assert.notEqual(a.font_heading, b.font_heading);
  });

  test('[RED] the sparse contractor is sparse — NULLs and EMPTY STRINGS, both, as declared', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM contractor_settings WHERE contractor_id = 'palette-gamma'`
    );
    assert.equal(rows.length, 1);
    const g = rows[0];
    const declared = CONTRACTORS.find((c) => c.id === 'palette-gamma').settings;

    // ⚠ NON-VACUITY: the fixture must actually contain BOTH kinds of absence.
    // A sparse fixture built entirely from NULL exercises one branch and reads as
    // complete — which is the failure this assertion exists to prevent.
    const nulls = Object.keys(declared).filter((k) => declared[k] === null);
    const empties = Object.keys(declared).filter((k) => declared[k] === '');
    assert.ok(nulls.length >= 5, `expected several NULL fields, got ${nulls.length}`);
    assert.ok(empties.length >= 5, `expected several '' fields, got ${empties.length}`);

    // Then: every declared absence survived the round trip AS DECLARED.
    for (const k of nulls) {
      assert.strictEqual(g[k], null, `palette-gamma.${k} should be NULL, read back ${JSON.stringify(g[k])}`);
    }
    for (const k of empties) {
      assert.strictEqual(g[k], '', `palette-gamma.${k} should be '', read back ${JSON.stringify(g[k])}`);
    }
  });

  test('[RED] every tenant has a referrer, a rep and an owner, and the rep flag is real', async () => {
    for (const c of CONTRACTORS) {
      const { rows: u } = await pool.query(
        `SELECT count(*)::int n FROM users WHERE contractor_id = $1`, [c.id]
      );
      assert.ok(u[0].n >= 1, `${c.id} has no referrer`);
      const { rows: m } = await pool.query(
        `SELECT tier, is_field_rep FROM team_members WHERE contractor_id = $1 ORDER BY tier`, [c.id]
      );
      assert.ok(m.some((x) => x.tier === 'general' && x.is_field_rep === true), `${c.id} has no field rep`);
      assert.ok(m.some((x) => x.tier === 'owner'), `${c.id} has no owner`);
    }
  });

  test('[RED] the dual-identity person holds BOTH a users row and a team_members row', async () => {
    // The class that reproduced 1b102d9, and the only class that can hold a
    // rep-side dark preference and then authenticate onto a referrer surface.
    const { rows: u } = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND contractor_id = 'palette-alpha'`, [DUAL_EMAIL]
    );
    const { rows: m } = await pool.query(
      `SELECT id, is_field_rep FROM team_members WHERE email = $1`, [DUAL_EMAIL]
    );
    assert.equal(u.length, 1, 'no users row for the dual-identity email');
    assert.equal(m.length, 1, 'no team_members row for the dual-identity email');
    assert.equal(m[0].is_field_rep, true);
  });

  test('re-seeding converges rather than duplicating', async () => {
    await seedStack(pool);
    const { rows } = await pool.query(
      `SELECT (SELECT count(*)::int FROM contractors WHERE id LIKE 'palette-%') c,
              (SELECT count(*)::int FROM users WHERE contractor_id LIKE 'palette-%') u,
              (SELECT count(*)::int FROM team_members WHERE contractor_id LIKE 'palette-%') m`
    );
    assert.deepEqual(rows[0], { c: 3, u: 4, m: 7 });
  });
});

describe('Palette-0 T2 — the harness reports the MOUNTED value, never the declaration', () => {
  // ⚠ THIS FIXTURE RECONSTRUCTS R-1's PRE-FIX DECLARATION ON PURPOSE. The real
  // ones were repaired in 7233065, so the only way to keep proving the harness
  // against a KNOWN-WRONG case is to carry the wrong case here.
  const R1_PRE_FIX = Object.freeze({
    declared: 'var(--rm-danger, #FEE2E2)',   // author intended a pale tint
    computed: 'rgb(220, 38, 38)',            // what actually painted: the FILL
    varValue: '#DC2626',                     // the provider mounted this
  });

  test('[RED] the fixture genuinely has a differing pair — asserted as a PRECONDITION', () => {
    // ⚠ WITHOUT THIS, T2 COULD PASS AGAINST A FIXTURE WHOSE FALLBACK AND MOUNT
    // AGREE, which is the healthy case and proves nothing about the distinction.
    const fallback = normalizeColour('#FEE2E2');
    const mounted = normalizeColour(R1_PRE_FIX.varValue);
    assert.notEqual(fallback, mounted, 'the fixture must differ, or T2 is vacuous');
    assert.equal(normalizeColour(R1_PRE_FIX.computed), mounted, 'the fixture must have painted the MOUNTED value');
  });

  test('[RED] it classifies as MOUNTED and resolves to the fill, not the tint', () => {
    const c = classifyPaint(R1_PRE_FIX);
    assert.equal(c.source, 'mounted');
    assert.equal(c.resolved, 'rgb(220, 38, 38)');
    assert.equal(c.property, '--rm-danger');
    // The declaration's own fallback must NOT be what is reported.
    assert.notEqual(c.resolved, normalizeColour('#FEE2E2'));
  });

  test('[RED] an unmounted property is reported as FALLBACK — the silent-non-migration case', () => {
    // Same declaration, nothing mounted (the admin tree, or a component moved
    // above ThemeProvider). It paints the tint, and the harness must SAY so.
    const c = classifyPaint({ declared: 'var(--rm-danger, #FEE2E2)', computed: 'rgb(254, 226, 226)', varValue: '' });
    assert.equal(c.source, 'fallback');
    assert.equal(c.resolved, 'rgb(254, 226, 226)');
  });

  test('a raw literal is reported as LITERAL — not migrated', () => {
    const c = classifyPaint({ declared: '#EEF2F7', computed: 'rgb(238, 242, 247)', varValue: '' });
    assert.equal(c.source, 'literal');
  });

  test('a reading matching NEITHER is `unexplained`, never bucketed into a pass', () => {
    const c = classifyPaint({ declared: 'var(--rm-text, #1C2D4D)', computed: 'rgb(1, 2, 3)', varValue: '#FFFFFF' });
    assert.equal(c.source, 'unexplained');
    assert.equal(c.matches, false);
  });

  test('classifyPaint THROWS on a shape it does not recognise', () => {
    // ⚠ A CLASSIFIER THAT CAN ALSO ANSWER "I DON'T KNOW" SATISFIES EVERY
    // ASSERTION THAT LOOKS FOR ABSENCE. It throws instead.
    assert.throws(() => classifyPaint(null), /expected a reading object/);
    assert.throws(() => classifyPaint({ declared: 'x', computed: '' }), /no computed value/);
    assert.throws(() => classifyPaint({ declared: 'x' }), /no computed value/);
  });

  test('summarize tallies by source and flags the ones a phase must act on', () => {
    const { tally, flagged } = summarize([
      R1_PRE_FIX,
      { declared: 'var(--rm-text, #1C2D4D)', computed: 'rgb(28, 45, 77)', varValue: '#1C2D4D' },
      { declared: 'var(--rm-text, #1C2D4D)', computed: 'rgb(28, 45, 77)', varValue: '' },
      { declared: '#EEF2F7', computed: 'rgb(238, 242, 247)', varValue: '' },
    ]);
    assert.deepEqual(tally, { mounted: 2, fallback: 1, literal: 1, unexplained: 0 });
    assert.equal(flagged.length, 1);
    assert.equal(flagged[0].source, 'fallback');
  });
});

describe('Palette-0 T3 — a dropped connection fails loudly, never as a clean sweep', () => {
  test('[RED] null, undefined and malformed results all throw', () => {
    for (const bad of [null, undefined, 'nope', 42, []]) {
      assert.throws(() => assertHarnessResult(bad), /HARNESS:/,
        `assertHarnessResult accepted ${JSON.stringify(bad)}`);
    }
  });

  test('[RED] an EMPTY reading set throws — this is the whole point', () => {
    // ⚠ AN EMPTY SET READS EXACTLY LIKE "SWEPT EVERYTHING, FOUND NO DEFECTS".
    // The screenshot path already returned a wrong answer WITH A SUCCESS STATUS
    // in this environment; the harness must not be able to do the same.
    assert.throws(
      () => assertHarnessResult({ ok: true, count: 0, readings: [] }),
      /0 readings, expected at least 1[\s\S]*NOT a clean sweep/
    );
  });

  test('[RED] ok:false throws even when readings are present', () => {
    assert.throws(
      () => assertHarnessResult({ ok: false, readings: [{ computed: 'rgb(0,0,0)' }] }),
      /did not report ok:true/
    );
  });

  test('a well-formed non-empty result is returned', () => {
    const readings = assertHarnessResult({
      ok: true, count: 1,
      readings: [{ declared: 'var(--rm-text, #1C2D4D)', computed: 'rgb(28, 45, 77)', varValue: '#1C2D4D' }],
    });
    assert.equal(readings.length, 1);
  });
});
