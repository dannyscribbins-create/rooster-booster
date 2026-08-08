'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3a PHASE 1 — RED SUITE — SHARED USER-LEVEL PREFERENCE STORE
//
// Covers the new user_preferences table and the server/utils/userPreferences.js
// accessor. Per DECISION_C_DL_BUILD_SPEC.md CD-21: theme preference (and any
// future user-level preference) lives in ONE shared store readable by BOTH the
// referrer/client app (users) and the team/admin/field-rep side (team_members) —
// deliberately not a team_members column, so the client app can read the same
// store when its own toggle is built.
//
// SHAPE: the dual-nullable-FK pattern proven by contact_tags (db.js:927-949) —
// two nullable id columns + a CHECK + partial unique indexes.
//
// ONE DELIBERATE DIVERGENCE FROM THAT PRECEDENT: contact_tags' CHECK is
// "at least one" (contact_id IS NOT NULL OR jobber_client_id IS NOT NULL).
// This table's is EXACTLY ONE — it must reject both-null AND both-set. A row
// naming two different subjects has no coherent meaning here, and the partial
// unique indexes would not catch it. The two rejection tests below are what
// pin that stricter form; do not relax them to the contact_tags shape.
//
// EXPECTED RED TODAY, each for a documented reason:
//   - accessor tests      → MODULE_NOT_FOUND (utils/userPreferences.js absent)
//   - schema/CHECK tests  → 42P01 undefined_table (user_preferences absent),
//                           surfaced as an SQLSTATE mismatch against 23514
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// setup.js applies the localhost-only DATABASE_URL safety interlock at module-load time.
const { initTestDb } = require('./setup');
const { seedContractor, seedUser } = require('./helpers');

const TENANT_A = 'test-prefs-tenant-a';
const TENANT_B = 'test-prefs-tenant-b';
const TABLE = 'user_preferences';

// Resolved at CALL time rather than module load. Until Step 4 creates the module,
// a top-level require would throw MODULE_NOT_FOUND while node:test was still
// LOADING this file — collapsing all seven tests into one opaque file-level
// error. Deferring it produces a clean per-test RED naming the missing module,
// and needs no edit once the module exists (require caches after first success).
function prefs() {
  return require('../utils/userPreferences');
}

// Asserts fn() rejects with a SPECIFIC PostgreSQL SQLSTATE.
//
// Pinning the code is load-bearing, exactly as in inviteTokenSchema.test.js: a
// bare assert.rejects() would go GREEN today for entirely the wrong reason —
// the INSERTs below name a table that does not exist yet, so they throw 42P01
// (undefined_table). Requiring 23514 (check_violation) keeps these RED until
// the CHECK itself is what rejects the row, which is the only thing under test.
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

// Inserts a team_members row and returns its id. Defined locally rather than added
// to helpers.js — helpers.js is outside this phase's approved file scope, and
// inviteTokenSchema.test.js sets the precedent of inlining this same insert.
// team_members.email carries a GLOBAL UNIQUE, so every caller passes a distinct one.
async function seedTeamMember(pool, { contractorId, email }) {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
     VALUES ($1, $2, 'x', 'general', '{}')
     RETURNING id`,
    [contractorId, email]
  );
  return rows[0].id;
}

// Raw INSERT bypassing the accessor. The schema-level tests (CHECK, cascade) use
// this so they prove a property of the TABLE rather than of the accessor's SQL.
async function rawInsert(pool, { userId = null, teamMemberId = null, contractorId, key, value }) {
  await pool.query(
    `INSERT INTO ${TABLE} (user_id, team_member_id, contractor_id, pref_key, pref_value)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, teamMemberId, contractorId, key, JSON.stringify(value)]
  );
}

describe('C/DL-3a Phase 1 — user_preferences shared store + accessor', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Deletes are scoped to this file's own tenants rather than truncating shared
    // tables, and deliberately do NOT touch user_preferences directly: both its FKs
    // are ON DELETE CASCADE, so clearing users + team_members clears every pref row
    // by construction. That also keeps beforeEach from throwing 42P01 during the RED
    // run, when the table does not exist yet.
    const tenants = [TENANT_A, TENANT_B];
    await pool.query('DELETE FROM users WHERE contractor_id = ANY($1)', [tenants]);
    await pool.query('DELETE FROM team_members WHERE contractor_id = ANY($1)', [tenants]);
    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);
  });

  // ── ROUND-TRIP: BOTH SUBJECT TYPES ─────────────────────────────────────────
  // The whole point of CD-21 — one store, two subject types, same accessor.

  it('[RED] set then get round-trips a value for a user subject', async () => {
    const userId = await seedUser(pool, {
      fullName: 'Prefs Referrer', email: 'prefs-user@test.com', contractorId: TENANT_A,
    });

    await prefs().setPreference({
      subjectType: 'user', subjectId: userId, contractorId: TENANT_A,
      key: 'theme_mode', value: 'dark',
    });

    const value = await prefs().getPreference({
      subjectType: 'user', subjectId: userId, contractorId: TENANT_A, key: 'theme_mode',
    });
    assert.equal(value, 'dark');
  });

  it('[RED] set then get round-trips a value for a team_member subject', async () => {
    const memberId = await seedTeamMember(pool, {
      contractorId: TENANT_A, email: 'prefs-rep@test.com',
    });

    await prefs().setPreference({
      subjectType: 'team_member', subjectId: memberId, contractorId: TENANT_A,
      key: 'theme_mode', value: 'light',
    });

    const value = await prefs().getPreference({
      subjectType: 'team_member', subjectId: memberId, contractorId: TENANT_A, key: 'theme_mode',
    });
    assert.equal(value, 'light');
  });

  // ── THE EXACTLY-ONE CHECK ──────────────────────────────────────────────────

  it('[RED] rejects a row with BOTH user_id and team_member_id NULL', async () => {
    await expectPgError(
      () => rawInsert(pool, {
        userId: null, teamMemberId: null,
        contractorId: TENANT_A, key: 'theme_mode', value: 'dark',
      }),
      '23514',
      'both subject columns NULL'
    );
  });

  it('[RED] rejects a row with BOTH user_id and team_member_id set', async () => {
    const userId = await seedUser(pool, {
      fullName: 'Prefs Both', email: 'prefs-both@test.com', contractorId: TENANT_A,
    });
    const memberId = await seedTeamMember(pool, {
      contractorId: TENANT_A, email: 'prefs-both-rep@test.com',
    });

    // This is the case contact_tags' weaker "at least one" CHECK would ACCEPT.
    await expectPgError(
      () => rawInsert(pool, {
        userId, teamMemberId: memberId,
        contractorId: TENANT_A, key: 'theme_mode', value: 'dark',
      }),
      '23514',
      'both subject columns set'
    );
  });

  // ── CASCADE FROM EITHER PARENT ─────────────────────────────────────────────

  it('[RED] deleting the parent users row cascades its preferences away', async () => {
    const userId = await seedUser(pool, {
      fullName: 'Prefs Cascade', email: 'prefs-cascade@test.com', contractorId: TENANT_A,
    });
    await rawInsert(pool, { userId, contractorId: TENANT_A, key: 'theme_mode', value: 'dark' });

    const before = await pool.query(`SELECT id FROM ${TABLE} WHERE user_id = $1`, [userId]);
    assert.equal(before.rows.length, 1, 'precondition: the preference row must exist');

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    const after = await pool.query(`SELECT id FROM ${TABLE} WHERE user_id = $1`, [userId]);
    assert.equal(after.rows.length, 0, 'ON DELETE CASCADE must have removed the preference row');
  });

  it('[RED] deleting the parent team_members row cascades its preferences away', async () => {
    const memberId = await seedTeamMember(pool, {
      contractorId: TENANT_A, email: 'prefs-cascade-rep@test.com',
    });
    await rawInsert(pool, { teamMemberId: memberId, contractorId: TENANT_A, key: 'theme_mode', value: 'dark' });

    const before = await pool.query(`SELECT id FROM ${TABLE} WHERE team_member_id = $1`, [memberId]);
    assert.equal(before.rows.length, 1, 'precondition: the preference row must exist');

    await pool.query('DELETE FROM team_members WHERE id = $1', [memberId]);

    const after = await pool.query(`SELECT id FROM ${TABLE} WHERE team_member_id = $1`, [memberId]);
    assert.equal(after.rows.length, 0, 'ON DELETE CASCADE must have removed the preference row');
  });

  // ── TENANCY ────────────────────────────────────────────────────────────────

  it('[RED] stores contractor_id, and a read scoped to the wrong contractor returns nothing', async () => {
    const userId = await seedUser(pool, {
      fullName: 'Prefs Tenant', email: 'prefs-tenant@test.com', contractorId: TENANT_A,
    });

    await prefs().setPreference({
      subjectType: 'user', subjectId: userId, contractorId: TENANT_A,
      key: 'theme_mode', value: 'dark',
    });

    // Stored: the column carries the tenant, never smuggled inside pref_key.
    const { rows } = await pool.query(
      `SELECT contractor_id FROM ${TABLE} WHERE user_id = $1 AND pref_key = 'theme_mode'`,
      [userId]
    );
    assert.equal(rows.length, 1, 'the preference row must exist');
    assert.equal(rows[0].contractor_id, TENANT_A, 'contractor_id must be stored on the row');

    // Returned under the right tenant.
    assert.equal(
      await prefs().getPreference({
        subjectType: 'user', subjectId: userId, contractorId: TENANT_A, key: 'theme_mode',
      }),
      'dark'
    );

    // Invisible under the wrong one — the tenancy guard is in the WHERE clause,
    // not merely implied by the subject id.
    assert.equal(
      await prefs().getPreference({
        subjectType: 'user', subjectId: userId, contractorId: TENANT_B, key: 'theme_mode',
      }),
      null,
      'a read scoped to the wrong contractor_id must return null'
    );
  });
});
