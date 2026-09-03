'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BR-2 PHASE 2 (A32(a)) — MIGRATION PROOF FOR THE FIVE LANDING COPY COLUMNS
//
// ⚠ A FRESH-SCHEMA RUN PROVES ALMOST NOTHING HERE, WHICH IS WHY THIS FILE
// EXISTS. CLAUDE.md's rule: "a test DB rebuilt from scratch every run can never
// exercise 'a real pre-existing row already in some legacy state,' which is
// exactly what breaks in production and never breaks locally." So the row this
// file seeds BEFORE running the migration is shaped like the production
// contractor's actual row, measured across BR-1 and BR-2:
//
//   company_name        SET
//   app_display_name    SET — and set to the retired platform codename
//   logo_url            SET
//   app_logo_url        NULL
//   review_url          EMPTY STRING  (not null — a touched-then-cleared field)
//   social_facebook     SET
//   social_instagram    EMPTY STRING
//   social_google       SET
//   social_nextdoor     EMPTY STRING
//   social_website      SET
//
// ⚠ THE MIX OF NULL AND EMPTY STRING IS THE POINT. A seed built only from nulls
// is a fresh-schema run wearing a costume; the production row carries both, and
// the empty-string columns are the ones a naive backfill or a `||` fallback
// treats differently from a null.
//
// WHAT IS PROVEN: the migration is idempotent, adds the columns NULL, BACKFILLS
// NOTHING, and disturbs no pre-existing value.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule) — the shape is
// reproduced, the identifiers are not.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');
const { initDB } = require('../db');

const TENANT = 'tnt-stepcopy-dirty';

const NEW_COLUMNS = Object.freeze([
  'landing_step1_title',
  'landing_step2_title',
  'landing_step2_body',
  'landing_step3_title',
  'landing_step3_body',
]);

// The frozen defaults, restated here ONLY so the no-backfill assertion has
// something to look for. ⚠ If a future change backfills these into rows, this
// file is what fails.
const FROZEN = Object.freeze([
  'Share your personal link',
  'They book a free inspection',
  'We take care of them like family',
  'You earn cash rewards',
  'Get paid when their job completes',
]);

let pool;

describe('BR-2 Phase 2 — the landing copy migration, against a DIRTY pre-existing row', () => {

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  it('[RED] the columns exist, are TEXT and are NULLABLE', async () => {
    const { rows } = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_name = 'contractor_settings' AND column_name = ANY($1)
        ORDER BY column_name`,
      [NEW_COLUMNS]
    );

    assert.equal(rows.length, NEW_COLUMNS.length, `expected ${NEW_COLUMNS.length} columns, got ${rows.length}`);
    for (const r of rows) {
      assert.equal(r.data_type, 'text', `${r.column_name} is not TEXT`);
      assert.equal(r.is_nullable, 'YES', `${r.column_name} is NOT NULL — NULL is what "use the default" means`);
      // ⚠ A DEFAULT WOULD BE A BACKFILL BY ANOTHER NAME. Every future INSERT
      // would stamp the platform's copy onto a contractor who never chose it.
      assert.equal(r.column_default, null, `${r.column_name} carries a column DEFAULT`);
    }
  });

  it('[RED] a DIRTY pre-existing row survives the migration untouched, and gains NULLs', async () => {
    // ── Seed production's actual row shape, BEFORE re-running the migration ──
    await pool.query('DELETE FROM contractor_settings WHERE contractor_id = $1', [TENANT]);
    await pool.query('DELETE FROM contractors WHERE id = $1', [TENANT]);
    await pool.query('INSERT INTO contractors (id, name) VALUES ($1, $2)', [TENANT, 'Dirty Row Roofing']);
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, app_display_name, logo_url, app_logo_url,
          review_url, social_facebook, social_instagram, social_google,
          social_nextdoor, social_website)
       VALUES ($1, $2, $3, $4, NULL, '', $5, '', $6, '', $7)`,
      [TENANT, 'Dirty Row Roofing', 'Rooster Booster',
        'https://cdn.test.invalid/dirty-logo.png',
        'https://facebook.com/dirty', 'https://g.page/dirty', 'https://dirty.invalid']
    );

    // ⚠ RE-RUN THE REAL MIGRATION over that row. This is the half a fresh-schema
    // run cannot do: initDB() here executes against a table that already holds a
    // legacy row, which is the state production is in.
    await initDB();

    const { rows } = await pool.query(
      `SELECT * FROM contractor_settings WHERE contractor_id = $1`, [TENANT]);
    const row = rows[0];
    assert.ok(row, 'the pre-existing row did not survive the migration');

    // THE NEW COLUMNS ARRIVED NULL — not defaulted, not backfilled.
    for (const col of NEW_COLUMNS) {
      assert.equal(row[col], null, `${col} was backfilled on a pre-existing row`);
    }

    // ⚠ AND NOTHING ELSE MOVED. The empty-string columns are named explicitly:
    // they are what a careless backfill or a COALESCE would rewrite, and they
    // would look "fixed" rather than broken.
    assert.equal(row.company_name, 'Dirty Row Roofing');
    assert.equal(row.app_display_name, 'Rooster Booster', 'a pre-existing value was rewritten');
    assert.equal(row.logo_url, 'https://cdn.test.invalid/dirty-logo.png');
    assert.equal(row.app_logo_url, null, 'a NULL column was filled in');
    assert.equal(row.review_url, '', 'an EMPTY STRING column was rewritten — it is not the same as NULL');
    assert.equal(row.social_instagram, '', 'an EMPTY STRING social was rewritten');
    assert.equal(row.social_nextdoor, '');
    assert.equal(row.social_facebook, 'https://facebook.com/dirty');
  });

  it('[RED] the migration is IDEMPOTENT over the dirty row — a second run changes nothing', async () => {
    const before = await pool.query('SELECT * FROM contractor_settings WHERE contractor_id = $1', [TENANT]);
    await initDB();
    const after = await pool.query('SELECT * FROM contractor_settings WHERE contractor_id = $1', [TENANT]);

    assert.deepEqual(after.rows[0], before.rows[0], 'a second migration run mutated the row');
  });

  // ── THE BACKFILL FENCE, AND WHY IT IS WRITTEN AS A PREDICATE ──────────────
  //
  // ⚠ THE FIRST VERSION OF THIS TEST COULD NEVER HAVE FAILED, AND THE WAY THAT
  // SURFACED IS WORTH RECORDING. It swept `contractor_settings` for a stored
  // value equal to a frozen default. Run in file order it sweeps rows the
  // seeding test above has just reset to NULL — so when a backfill was actually
  // simulated in the database, the sweep still passed. It was asserting over
  // data it had itself cleaned: a mechanism reporting health it cannot observe.
  //
  // WRITTEN AS A PREDICATE INSTEAD, so BOTH states are exercised inside the
  // suite rather than by poking the database once by hand: the same function is
  // asked about the real rows (must be clean) and about a synthetic backfilled
  // row (must reject it). The failure mode is demonstrated permanently rather
  // than assumed.
  //
  // ⚠ AND IT IS A TEST RATHER THAN A BOOT-TIME FAIL-CLOSED GUARD, deliberately.
  // The migration adds nullable columns and backfills nothing, so there is no
  // partial state for a guard to observe and nothing for a work-remaining check
  // to wrap — a guard here would be the very defect the guard rule is part of
  // preventing. The risk it would cover is a FUTURE backfill, which is what this
  // fences.
  function backfilledColumns(row) {
    return NEW_COLUMNS.filter(col => FROZEN.includes(row[col]));
  }

  it('[RED] the fence REJECTS a backfilled row — the failure state, demonstrated', () => {
    const backfilled = { contractor_id: 'synthetic', landing_step2_body: 'We take care of them like family' };
    assert.deepEqual(backfilledColumns(backfilled), ['landing_step2_body'],
      'the fence cannot see a row carrying the frozen default as a stored value');
  });

  it('[RED] the fence PASSES a row that is NULL or genuinely contractor-authored', () => {
    // The other state, and the second case is what stops the fence being a
    // blanket ban: a contractor may legitimately write their own copy, and only
    // copy IDENTICAL to the platform's is suspicious.
    assert.deepEqual(backfilledColumns({ contractor_id: 'a' }), []);
    assert.deepEqual(backfilledColumns({ contractor_id: 'b', landing_step2_body: 'We treat every roof like our own' }), []);
  });

  it('[RED] NO REAL ROW carries a stored value equal to a frozen default', async () => {
    const { rows } = await pool.query(
      `SELECT contractor_id, ${NEW_COLUMNS.join(', ')} FROM contractor_settings`);

    // ⚠ NON-VACUITY: the sweep must have had rows to sweep. An empty table
    // satisfies the loop below without observing anything.
    assert.ok(rows.length > 0, 'no contractor_settings rows exist — the sweep saw nothing');

    for (const row of rows) {
      assert.deepEqual(backfilledColumns(row), [],
        `${row.contractor_id} holds the frozen default as a STORED value. Either a ` +
        'backfill ran, or a contractor typed the platform copy verbatim. The first ' +
        'destroys the chose-it/never-touched-it distinction; check which.');
    }
  });
});
