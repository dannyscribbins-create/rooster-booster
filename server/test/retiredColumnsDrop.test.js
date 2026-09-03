'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BR-2 PHASE 3 — `tagline` AND `app_logo_url` ARE DROPPED
//
// WHAT EACH WAS, AND WHY IT WAS DEAD:
//
//   tagline        Read by NOTHING, ever. It never reached resolveBrandingTheme,
//                  so no surface could see it even in principle. Its panel helper
//                  claimed it appeared on the referrer login screen and dashboard;
//                  it appeared on neither.
//   app_logo_url   One consumer, three call sites, always as the SECOND term of
//                  `logo_url || app_logo_url || null` — unreachable whenever
//                  logo_url is set, and NULL for every contractor, with no writer
//                  anywhere in the product.
//
// ⚠ A DROP IS NOT A BACKFILL, so the fail-closed guard rule does not apply — and
// that is stated rather than silently omitted. A guard exists to fire while
// migration work REMAINS and must be wrapped in a work-remaining check so it
// becomes a permanent no-op after. `DROP COLUMN IF EXISTS` has no partial state:
// the column is there or it is not, the statement is its own idempotency check,
// and there is nothing for a guard to observe. Adding one would be a mechanism
// reporting health it cannot see.
//
// ⚠ THE ROW SEEDED HERE IS PRODUCTION'S SHAPE, NOT A FRESH ONE. tagline is
// POPULATED — with the platform boilerplate, which is what the production
// contractor actually holds — and app_logo_url is NULL. A fresh-schema run
// cannot exercise "a real pre-existing row already in a legacy state", which is
// what breaks in production and never breaks locally.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule) — the shape is
// reproduced, the identifiers are not.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');
const { initDB } = require('../db');

const TENANT = 'tnt-dropped-cols';
const DROPPED = Object.freeze(['tagline', 'app_logo_url']);

// The boilerplate the production contractor stores in `tagline`. Named here so
// the "populated, not null" precondition is a real value rather than a token.
const PLATFORM_BOILERPLATE = 'Refer your neighbors. Earn cash and more!';

let pool;

async function columnsPresent() {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'contractor_settings' AND column_name = ANY($1)`,
    [DROPPED]
  );
  return rows.map(r => r.column_name).sort();
}

describe('BR-2 Phase 3 — the retired columns are gone, and the row survives', () => {

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  it('[RED] T4 — neither column exists on contractor_settings', async () => {
    assert.deepEqual(await columnsPresent(), [],
      'a retired column is still on the table');
  });

  it('[RED] T4 — a DIRTY pre-existing row survives the drop with everything else intact', async () => {
    // ── Seed production's shape BEFORE re-running the migration ──
    // ⚠ THE COLUMNS MUST EXIST TO BE SEEDED, and by this point they do not. So
    // they are re-added, populated, and then dropped again by initDB() — which
    // is a STRONGER test than seeding before the first drop: it proves the
    // migration removes a column that is present AND CARRYING DATA, rather than
    // only being a no-op against a schema where it never existed.
    await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS tagline TEXT`);
    await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS app_logo_url TEXT`);

    await pool.query('DELETE FROM contractor_settings WHERE contractor_id = $1', [TENANT]);
    await pool.query('DELETE FROM contractors WHERE id = $1', [TENANT]);
    await pool.query('INSERT INTO contractors (id, name) VALUES ($1, $2)', [TENANT, 'Dropped Cols Roofing']);
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, app_display_name, logo_url, tagline, app_logo_url,
          review_url, social_facebook, social_instagram, company_phone)
       VALUES ($1, $2, $3, $4, $5, NULL, '', $6, '', $7)`,
      [TENANT, 'Dropped Cols Roofing', 'Rooster Booster',
        'https://cdn.test.invalid/dropped-logo.png', PLATFORM_BOILERPLATE,
        'https://facebook.com/dropped', '555-0400']
    );

    // PRECONDITION, ASSERTED: the row really is dirty. Without this the drop
    // below could be proving nothing — a column that was already absent, or a
    // row whose tagline was already null, is not the state production is in.
    const seeded = await pool.query(
      'SELECT tagline, app_logo_url FROM contractor_settings WHERE contractor_id = $1', [TENANT]);
    assert.equal(seeded.rows[0].tagline, PLATFORM_BOILERPLATE, 'fixture error: tagline was not populated');
    assert.equal(seeded.rows[0].app_logo_url, null, 'fixture error: app_logo_url should be NULL, as in production');

    // ── Run the real migration over that row ──
    await initDB();

    assert.deepEqual(await columnsPresent(), [], 'the drop did not remove both columns');

    const { rows } = await pool.query(
      'SELECT * FROM contractor_settings WHERE contractor_id = $1', [TENANT]);
    const row = rows[0];
    assert.ok(row, 'the pre-existing row did not survive the drop');

    // ⚠ EVERY OTHER COLUMN IS INTACT, and the empty-string ones are named
    // explicitly: they are what a careless migration would normalise, and they
    // would look "cleaned up" rather than broken.
    assert.equal(row.company_name, 'Dropped Cols Roofing');
    assert.equal(row.app_display_name, 'Rooster Booster');
    assert.equal(row.logo_url, 'https://cdn.test.invalid/dropped-logo.png');
    assert.equal(row.review_url, '', 'an EMPTY STRING column was rewritten by the drop');
    assert.equal(row.social_instagram, '');
    assert.equal(row.social_facebook, 'https://facebook.com/dropped');
    assert.equal(row.company_phone, '555-0400');
    // And the columns are gone from the ROW too, not merely from the catalogue.
    for (const col of DROPPED) {
      assert.ok(!(col in row), `${col} is still a key on the returned row`);
    }
  });

  it('[RED] T5 — the drop is IDEMPOTENT: a second run against an already-dropped schema does not crash', async () => {
    // ⚠ THIS IS WHAT `IF EXISTS` BUYS, AND IT IS THE ONE THAT WOULD BITE ON
    // EVERY BOOT rather than once. Railway restarts run initDB() again; without
    // IF EXISTS the second boot raises 42703 and the server never listens.
    const before = await pool.query('SELECT * FROM contractor_settings WHERE contractor_id = $1', [TENANT]);

    await initDB();
    await initDB();

    const after = await pool.query('SELECT * FROM contractor_settings WHERE contractor_id = $1', [TENANT]);
    assert.deepEqual(after.rows[0], before.rows[0], 'a repeat migration run mutated the row');
    assert.deepEqual(await columnsPresent(), []);
  });

  it('[RED] the columns are gone from the WRITABLE set, so a PUT cannot resurrect them', async () => {
    // ⚠ T3's RULED BEHAVIOUR — SILENTLY IGNORED, NOT REJECTED, and the choice is
    // deliberate rather than incidental. PUT /api/admin/settings already filters
    // the body to SETTINGS_WRITABLE_COLUMNS and ignores everything else; an
    // unknown key has always been dropped without comment. Making these two
    // REJECT would be a special case that treats a retired column differently
    // from any other unknown field, and the panel is the only caller — it stopped
    // sending them in this same commit. The generic path is the one under test.
    const { SETTINGS_WRITABLE_COLUMNS } = require('../routes/admin/index');
    for (const col of DROPPED) {
      assert.ok(!SETTINGS_WRITABLE_COLUMNS.includes(col),
        `${col} is still writable — a PUT carrying it would try to write a dropped column and 500`);
    }
  });
  it('[RED] T2 — the settings GET no-row branch carries neither key, and no longer defaults tagline', () => {
    // ⚠ THE ASYMMETRY THIS REMOVES, RECORDED BECAUSE IT WAS THE ODD ONE OUT.
    // That branch answers for a contractor with NO settings row, and returned
    // `tagline: 'Refer your neighbors. Earn cash rewards.'` as a NON-NULL default
    // while every sibling identity field returned null — so the admin form loaded
    // the platform's boilerplate, and the first save recorded the contractor as
    // having authored it. A backfill through the API.
    //
    // Read from SOURCE TEXT rather than by calling the route: the branch needs an
    // authenticated admin session and a contractor with no settings row, and
    // standing that up would be fixture scaffolding proving less than this line.
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.resolve(process.cwd(), 'server/routes/admin/index.js'), 'utf8');

    assert.ok(!src.includes("tagline: 'Refer your neighbors"),
      'the no-row branch still defaults tagline');
    assert.ok(!/^\s*app_logo_url: null,/m.test(src),
      'the no-row branch still returns app_logo_url');
    // NOT VACUOUS: the branch itself is still there, with its siblings intact.
    assert.ok(src.includes('logo_url: null,'), 'the no-row branch lost logo_url too');
    assert.ok(src.includes('app_display_name: null,'), 'the no-row branch lost app_display_name');
  });

});
