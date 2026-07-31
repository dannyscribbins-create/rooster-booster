'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-1 — STOP CHECKPOINT 2 RED SUITE — SCHEMA LAYER
//
// Covers the extend-over-supersede schema additions to contractor_invite_links
// and the revised owner CHECK constraint (Revision 2, approved 2026-07-31).
//
// REVISED CHECK under test — negative-only, orphan-tolerant:
//
//   ALTER TABLE contractor_invite_links
//     ADD CONSTRAINT chk_invite_links_owner CHECK (
//          (link_type = 'peer'       AND owner_team_member_id IS NULL)
//       OR (link_type = 'rep'        AND created_by_user_id   IS NULL)
//       OR (link_type = 'contractor' AND created_by_user_id   IS NULL
//                                    AND owner_team_member_id IS NULL)
//     );
//
// The constraint enforces only that the WRONG owner column is never set for a
// type. Each type's own owner column stays nullable so ON DELETE SET NULL can
// always fire (see the peer-owner-deletion test below) and so pre-existing
// orphans can never block ADD CONSTRAINT.
//
// COLUMN NAMES are this proposal's; they are not yet ratified. If STOP 3 renames
// any of them, this file is the single place to update.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');
const { seedContractor, seedUser } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TABLE = 'contractor_invite_links';

// The full set of columns C/DL-1 adds. Grouped by the spec clause that requires
// each one (DECISION_C_DL_BUILD_SPEC.md §4, C/DL-1 Scope).
const NEW_COLUMNS = [
  'owner_team_member_id',  // rep ownership
  'superseded_by',         // supersession pointer (CD-14) — column ships now, supersedeToken() is C/DL-3
  'redeemed_at',           // redemption pointer
  'redeemed_user_id',      // redemption pointer
  'expires_at',            // lifecycle (CD-20)
  'scanned_at',            // scan event (CD-16)
  'soft_save_name',        // soft-save (CD-11 / CD-12)
  'soft_save_email',       // soft-save (CD-11)
  'soft_save_phone',       // soft-save (CD-11)
  'consent_affirmed_at',   // consent capture (CD-15)
  'consent_channel',       // consent capture (CD-15)
];

let slugCounter = 0;
function uniqueSlug(prefix) {
  slugCounter += 1;
  return `${prefix}-${Date.now()}-${slugCounter}`;
}

// Asserts fn() rejects with a SPECIFIC PostgreSQL SQLSTATE.
//
// Written this way deliberately. A bare assert.rejects() would go GREEN today for
// entirely the wrong reason: the INSERTs below name owner_team_member_id, which
// does not exist yet, so they throw 42703 (undefined_column). Pinning the code to
// 23514 (check_violation) keeps these RED until the CHECK itself is what rejects
// the row — which is the only thing being tested.
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

describe('C/DL-1 schema — contractor_invite_links extensions + owner CHECK', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM ${TABLE}`);
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractors');
    await seedContractor(pool, TENANT_A);
  });

  // ── COLUMN EXISTENCE ───────────────────────────────────────────────────────
  // Asserted through information_schema rather than by SELECTing the columns, so
  // a missing column produces a clean assertion failure naming the column instead
  // of an opaque 42703 query error.

  it('[RED] adds every C/DL-1 column to contractor_invite_links', async () => {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [TABLE]
    );
    const present = new Set(rows.map(r => r.column_name));
    const missing = NEW_COLUMNS.filter(c => !present.has(c));
    assert.deepEqual(missing, [], `missing columns on ${TABLE}: ${missing.join(', ')}`);
  });

  it('[RED] drops the stale contractor_id DEFAULT (amendment A1 — dynamic-id-first)', async () => {
    const { rows } = await pool.query(
      `SELECT column_default FROM information_schema.columns
        WHERE table_name = $1 AND column_name = 'contractor_id'`,
      [TABLE]
    );
    assert.equal(rows.length, 1, 'contractor_id column not found');
    assert.equal(
      rows[0].column_default, null,
      `contractor_id must carry no DEFAULT; found ${rows[0].column_default}`
    );
  });

  it('[RED] owner_team_member_id is an FK to team_members with ON DELETE SET NULL', async () => {
    const { rows } = await pool.query(
      `SELECT c.conname, c.confdeltype
         FROM pg_constraint c
         JOIN pg_attribute a
           ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = $1::regclass
          AND c.contype  = 'f'
          AND a.attname  = 'owner_team_member_id'`,
      [TABLE]
    );
    assert.equal(rows.length, 1, 'no FK constraint found on owner_team_member_id');
    // confdeltype 'n' = SET NULL. Symmetry with created_by_user_id is what makes
    // the orphan-tolerant CHECK correct in both directions.
    assert.equal(rows[0].confdeltype, 'n', 'owner_team_member_id FK must be ON DELETE SET NULL');
  });

  it('[RED] chk_invite_links_owner exists as a CHECK constraint', async () => {
    const { rows } = await pool.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = $1::regclass AND contype = 'c' AND conname = 'chk_invite_links_owner'`,
      [TABLE]
    );
    assert.equal(rows.length, 1, 'chk_invite_links_owner not found on contractor_invite_links');
  });

  // ── CHECK BEHAVIOR — PEER ──────────────────────────────────────────────────

  it('[GREEN-by-design] peer link with a NULL owner is accepted (orphan is a legal state)', async () => {
    // Revision 2's whole point. This must be green BEFORE the migration (no
    // constraint yet) and must stay green AFTER it. If it ever goes red, the
    // constraint was written in the rejected NOT NULL form.
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, created_by_user_id, active)
       VALUES ($1, $2, 'peer', NULL, true)`,
      [TENANT_A, uniqueSlug('peer-orphan')]
    );
    const { rows } = await pool.query(
      `SELECT created_by_user_id FROM ${TABLE} WHERE link_type = 'peer'`
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].created_by_user_id, null);
  });

  it('[RED] peer link may never carry owner_team_member_id', async () => {
    const memberRow = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'rep-schema@test.com', 'x', 'general', '{}') RETURNING id`,
      [TENANT_A]
    );
    const memberId = memberRow.rows[0].id;

    await expectPgError(
      () => pool.query(
        `INSERT INTO ${TABLE} (contractor_id, slug, link_type, owner_team_member_id, active)
         VALUES ($1, $2, 'peer', $3, true)`,
        [TENANT_A, uniqueSlug('peer-badowner'), memberId]
      ),
      '23514',
      'peer + owner_team_member_id'
    );
  });

  // ── CHECK BEHAVIOR — REP (mirrored) ────────────────────────────────────────

  it('[RED] rep link with a NULL owner is accepted (orphan is a legal state)', async () => {
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, owner_team_member_id, active)
       VALUES ($1, $2, 'rep', NULL, true)`,
      [TENANT_A, uniqueSlug('rep-orphan')]
    );
    const { rows } = await pool.query(
      `SELECT owner_team_member_id FROM ${TABLE} WHERE link_type = 'rep'`
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].owner_team_member_id, null);
  });

  it('[RED] rep link may never carry created_by_user_id', async () => {
    const userId = await seedUser(pool, {
      fullName: 'Schema Referrer', email: 'schema-ref@test.com', contractorId: TENANT_A,
    });

    await expectPgError(
      () => pool.query(
        `INSERT INTO ${TABLE} (contractor_id, slug, link_type, created_by_user_id, active)
         VALUES ($1, $2, 'rep', $3, true)`,
        [TENANT_A, uniqueSlug('rep-badowner'), userId]
      ),
      '23514',
      'rep + created_by_user_id'
    );
  });

  // ── CHECK BEHAVIOR — CONTRACTOR ────────────────────────────────────────────

  it('[RED] contractor link may never carry created_by_user_id', async () => {
    const userId = await seedUser(pool, {
      fullName: 'Schema Referrer 2', email: 'schema-ref2@test.com', contractorId: TENANT_A,
    });

    await expectPgError(
      () => pool.query(
        `INSERT INTO ${TABLE} (contractor_id, slug, link_type, created_by_user_id, active)
         VALUES ($1, $2, 'contractor', $3, true)`,
        [TENANT_A, uniqueSlug('con-baduser'), userId]
      ),
      '23514',
      'contractor + created_by_user_id'
    );
  });

  it('[RED] contractor link may never carry owner_team_member_id', async () => {
    const memberRow = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'rep-schema2@test.com', 'x', 'general', '{}') RETURNING id`,
      [TENANT_A]
    );

    await expectPgError(
      () => pool.query(
        `INSERT INTO ${TABLE} (contractor_id, slug, link_type, owner_team_member_id, active)
         VALUES ($1, $2, 'contractor', $3, true)`,
        [TENANT_A, uniqueSlug('con-badowner'), memberRow.rows[0].id]
      ),
      '23514',
      'contractor + owner_team_member_id'
    );
  });

  // ── FAIL-CLOSED POSTURE ────────────────────────────────────────────────────
  // GATED: this test encodes the approved fail-closed decision, which is itself
  // gated on the §6 group-by query confirming production holds no link_type
  // outside peer/contractor/rep. If that query returns an unexpected value, STOP
  // and report — do not widen the constraint (or delete this test) without a ruling.

  it('[RED] unknown link_type is rejected — fail-closed posture', async () => {
    await expectPgError(
      () => pool.query(
        `INSERT INTO ${TABLE} (contractor_id, slug, link_type, active)
         VALUES ($1, $2, 'affiliate', true)`,
        [TENANT_A, uniqueSlug('unknown-type')]
      ),
      '23514',
      "link_type = 'affiliate'"
    );
  });

  // ── THE REVISION 2 REGRESSION GUARD ────────────────────────────────────────

  it('[GREEN-by-design] deleting a user who owns an active peer link succeeds and nulls the owner', async () => {
    // This is the exact scenario the ORIGINAL (rejected) NOT NULL constraint would
    // have deadlocked: ON DELETE SET NULL fires, writes NULL into created_by_user_id,
    // and a NOT NULL CHECK would then reject the write and block the deletion.
    //
    // Green today (no constraint). Must STAY green after the migration — that is
    // the entire proof that Revision 2 landed correctly.
    const userId = await seedUser(pool, {
      fullName: 'Owner To Delete', email: 'owner-delete@test.com', contractorId: TENANT_A,
    });
    const slug = uniqueSlug('peer-owned');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, created_by_user_id, active)
       VALUES ($1, $2, 'peer', $3, true)`,
      [TENANT_A, slug, userId]
    );

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    const { rows } = await pool.query(
      `SELECT created_by_user_id, link_type, active FROM ${TABLE} WHERE slug = $1`,
      [slug]
    );
    assert.equal(rows.length, 1, 'the peer link row must survive its owner being deleted');
    assert.equal(rows[0].created_by_user_id, null, 'ON DELETE SET NULL must have fired');
    assert.equal(rows[0].link_type, 'peer');
    assert.equal(rows[0].active, true, 'deleting the owner must not deactivate the link');
  });

  it('[RED] deleting a team member who owns a rep link succeeds and nulls the owner', async () => {
    const memberRow = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'rep-delete@test.com', 'x', 'general', '{}') RETURNING id`,
      [TENANT_A]
    );
    const memberId = memberRow.rows[0].id;
    const slug = uniqueSlug('rep-owned');
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, owner_team_member_id, active)
       VALUES ($1, $2, 'rep', $3, true)`,
      [TENANT_A, slug, memberId]
    );

    await pool.query('DELETE FROM team_members WHERE id = $1', [memberId]);

    const { rows } = await pool.query(
      `SELECT owner_team_member_id, active FROM ${TABLE} WHERE slug = $1`,
      [slug]
    );
    assert.equal(rows.length, 1, 'the rep link row must survive its owner being deleted');
    assert.equal(rows[0].owner_team_member_id, null, 'ON DELETE SET NULL must have fired');
  });
});
