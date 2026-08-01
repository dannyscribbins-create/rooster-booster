'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 1 RED SUITE — SCHEMA LAYER (landing page)
//
// Covers the two — and only two — schema additions approved for C/DL-2:
//
//   contractor_settings.landing_bg_color   the ONE genuinely missing branding
//                                          column (Phase 0 finding C8). The
//                                          existing primary_color / secondary_color
//                                          / logo_url columns are REUSED; adding
//                                          brand_* twins was explicitly rejected
//                                          — two competing colour sources on one
//                                          table is the thing we are avoiding.
//
//   contractors.slug                       the PUBLIC per-contractor slug (LP §6.2).
//                                          TEXT, UNIQUE, NULLABLE. Deliberately
//                                          distinct from contractors.id, which is
//                                          the internal identity and must never
//                                          appear in a public URL.
//
// NOT covered here and NOT to be added: company_address (Phase 0 C6 — it already
// exists at db.js:204), brand_primary_color, brand_secondary_color,
// landing_logo_url.
//
// NULLABILITY IS LOAD-BEARING, not incidental. No slug value is seeded by the
// migration (standing rule: never hardcode contractor IDs in migrations), so
// EVERY contractor row starts with slug IS NULL and stays that way until a
// manual statement sets one. A UNIQUE constraint written as PG15's
// `UNIQUE NULLS NOT DISTINCT` would therefore reject the second contractor row
// outright. The multiple-NULLs test below is the guard against that.
//
// SQLSTATE PINNING (ratified pattern, inherited from inviteTokenSchema.test.js).
// The uniqueness test pins 23505 rather than using a bare assert.rejects().
// A bare reject would go GREEN today for entirely the wrong reason: the INSERT
// names a `slug` column that does not exist yet, so it throws 42703
// (undefined_column) — and would keep passing on 42703 forever if the column
// were later dropped. Pinning 23505 keeps it RED until the UNIQUE constraint
// itself is what rejects the row, which is the only thing under test.
//
// GUARD-PROOF (spec §6 requirement) — performed during the GREEN phase:
//   Drop the UNIQUE constraint on contractors.slug, re-run this file, and confirm
//   'rejects a duplicate slug with SQLSTATE 23505' goes RED because the second
//   INSERT SUCCEEDS (assert.fail path, not a different SQLSTATE). Then restore.
//   That proves the test is bound to the constraint and not to some incidental
//   error along the way.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');

// Fixture tenants. Derived locally, never a production contractor id — the
// standing house rule forbids the live contractor-id literals anywhere in the
// tree, test files included. The literals are not reproduced here even as prose:
// the sweep matches on source text and cannot tell a comment from code (same
// reasoning as the Scheme A note at referrer.js:1394-1398).
const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';

// Asserts fn() rejects with a SPECIFIC PostgreSQL SQLSTATE. See the SQLSTATE
// PINNING note above for why this exists instead of assert.rejects().
async function expectPgError(fn, code, label) {
  try {
    await fn();
  } catch (err) {
    assert.equal(
      err.code, code,
      `${label}: expected SQLSTATE ${code}, got ${err.code} — ${err.message}`
    );
    return;
  }
  assert.fail(`${label}: expected SQLSTATE ${code}, but the statement succeeded`);
}

describe('C/DL-2 schema — landing_bg_color + contractors.slug', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Delete order mirrors inviteTokenSchema.test.js — dependents before
    // contractors, which carries inbound FKs from several tables.
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractors');
  });

  // ── 1a. contractor_settings.landing_bg_color ───────────────────────────────
  // Asserted through information_schema rather than by SELECTing the column, so
  // a missing column produces a clean assertion failure naming it rather than an
  // opaque 42703.

  it('[RED] contractor_settings has a landing_bg_color column', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'contractor_settings' AND column_name = 'landing_bg_color'`
    );
    assert.equal(
      rows.length, 1,
      'contractor_settings.landing_bg_color not found — LP §5 --brand-bg has no source column'
    );
  });

  it('[GREEN-by-design] the reused branding columns are still present and untouched', async () => {
    // The counterweight to the test above. The approved design REUSES these three
    // rather than adding brand_* twins. If a future migration ever adds the twins,
    // this test stays green while the duplication goes unnoticed — so its real job
    // is to fail loudly if someone RENAMES or drops one of them while wiring the
    // landing page. Green today and must stay green.
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'contractor_settings'
          AND column_name IN ('primary_color', 'secondary_color', 'logo_url')`
    );
    const present = new Set(rows.map(r => r.column_name));
    const missing = ['primary_color', 'secondary_color', 'logo_url'].filter(c => !present.has(c));
    assert.deepEqual(missing, [], `reused branding columns missing: ${missing.join(', ')}`);
  });

  it('[GREEN-by-design] company_address already exists — no C/DL-2 schema work for it', async () => {
    // Phase 0 finding C6. LP-1 was written on the false premise that no address
    // column existed; it has been in the base CREATE TABLE all along (db.js:204).
    // This test exists so that premise can never be re-adopted by a later reader:
    // if it is ever red, someone dropped a live column.
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'contractor_settings' AND column_name = 'company_address'`
    );
    assert.equal(rows.length, 1, 'company_address must already exist — LP-1 requires no schema change');
  });

  // ── 1b. contractors.slug — TEXT, nullable, UNIQUE ──────────────────────────

  it('[RED] contractors has a slug column typed TEXT and nullable', async () => {
    const { rows } = await pool.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'contractors' AND column_name = 'slug'`
    );
    assert.equal(rows.length, 1, 'contractors.slug not found');
    assert.equal(rows[0].data_type, 'text', 'contractors.slug must be TEXT');
    assert.equal(
      rows[0].is_nullable, 'YES',
      'contractors.slug must be NULLABLE — no slug is seeded by the migration, so every row starts NULL'
    );
  });

  it('[RED] contractors.slug carries a UNIQUE constraint', async () => {
    // Accepts either a named UNIQUE constraint or a bare unique index — both are
    // legitimate ways to land this, and the behavioral tests below are what
    // actually pin the semantics.
    const { rows } = await pool.query(
      `SELECT i.indisunique
         FROM pg_index i
         JOIN pg_attribute a
           ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'contractors'::regclass
          AND i.indisunique = true
          AND a.attname = 'slug'
          AND array_length(i.indkey::int[], 1) = 1`
    );
    assert.equal(rows.length, 1, 'no single-column UNIQUE index found on contractors.slug');
  });

  // ── 4. SLUG UNIQUENESS — DB level, SQLSTATE-pinned ─────────────────────────

  it('[RED] rejects a duplicate slug with SQLSTATE 23505', async () => {
    // GUARD-PROOF SITE. During GREEN: drop the UNIQUE constraint, confirm this
    // test fails via the assert.fail branch ("the statement succeeded"), restore.
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $1, 'sharedslug')`,
      [TENANT_A]
    );

    await expectPgError(
      () => pool.query(
        `INSERT INTO contractors (id, name, slug) VALUES ($1, $1, 'sharedslug')`,
        [TENANT_B]
      ),
      '23505',
      'two contractors holding the same slug'
    );
  });

  it('[RED] permits many contractors to hold a NULL slug simultaneously', async () => {
    // The NULLS NOT DISTINCT guard described in the header. Every contractor row
    // starts NULL because the migration seeds no slug value, so if this is ever
    // red the very next contractor onboarded cannot be created at all.
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $1, NULL)`,
      [TENANT_A]
    );
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $1, NULL)`,
      [TENANT_B]
    );

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM contractors WHERE slug IS NULL`
    );
    assert.equal(rows[0].n, 2, 'both contractors must coexist with a NULL slug');
  });

  it('[RED] slug is independent of contractors.id — the internal id never becomes the public slug', async () => {
    // LP §6.2's "slug ≠ contractor_id, deliberately". A migration that backfilled
    // slug = id would satisfy every other test in this file while leaking the
    // internal identity into public URLs — which is the one thing the column
    // exists to prevent. Pins that the column defaults to NULL, not to id.
    await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $1)`, [TENANT_A]);

    const { rows } = await pool.query(
      `SELECT slug FROM contractors WHERE id = $1`,
      [TENANT_A]
    );
    assert.equal(rows.length, 1);
    assert.equal(
      rows[0].slug, null,
      'a newly inserted contractor must have slug NULL — never auto-derived from id'
    );
  });
});
