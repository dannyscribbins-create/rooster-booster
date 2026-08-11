'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 2, STEP 2A — SCHEMA LAYER FOR THE UNIFIED LOGIN
//
// Governing spec: CDL_3b_BUILD_SPEC.md §4.2, decision D1.
//
// Two indexes, and nothing else. The endpoint rewrite is step 2B.
//
//   idx_users_lower_email          NON-unique, users (LOWER(email))
//     D1 looks an email up across ALL contractors before it knows the tenant.
//     The only email index on users today is users_contractor_id_email_unique,
//     which LEADS with contractor_id — a tenant-less LOWER(email) predicate
//     cannot use it and sequential-scans on every login attempt.
//     NON-unique is load-bearing: one address holding an account with two
//     different contractors is a supported state per the tenant rebuild.
//
//   uniq_team_members_lower_email  UNIQUE, team_members (LOWER(email))
//     users is matched with LOWER(); team_members is matched case-SENSITIVELY
//     (db.js OWNER_SEED block, admin/index.js:58). One endpoint reading both
//     needs the two tables to agree on what "the same email" means.
//
// THE DIRTY-DATA PROOF (§4.2, and the ST-session standing principle) is Group 3.
// Production is clean TODAY — verified pre-flight, zero case-variant duplicates —
// which is why 2A can proceed at all. It is NOT a reason to skip the proof: a test
// DB rebuilt from scratch every run can never produce "a real pre-existing row
// already in a legacy state", which is exactly the shape that breaks in production
// and never breaks locally. The shape stays REACHABLE even though it is absent:
// the OWNER_SEED_EMAIL block inserts whatever letter case the env var happens to
// hold, without passing through any normalisation.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');
const { seedContractor } = require('./helpers');
const { initDB } = require('../db');

const TENANT_A = 'cdl3b-tenant-a';
const TENANT_B = 'cdl3b-tenant-b';

const USERS_INDEX = 'idx_users_lower_email';
const TM_INDEX    = 'uniq_team_members_lower_email';

let pool;

// Returns the rendered CREATE INDEX statement, or null when the index is absent.
// Asserted through pg_indexes rather than by running a query and timing it, so a
// missing index produces a clean named failure instead of a silent slow scan.
async function indexDef(name) {
  const { rows } = await pool.query('SELECT indexdef FROM pg_indexes WHERE indexname = $1', [name]);
  return rows.length ? rows[0].indexdef : null;
}

// Asserts fn() rejects with a SPECIFIC SQLSTATE. A bare assert.rejects() would go
// green for the wrong reason more than once in this file — the duplicate-insert
// test would pass on a plain foreign-key error, and the dirty-data test would pass
// on any incidental migration failure. Pinning the code is the whole point.
async function expectPgError(fn, code, label) {
  try {
    await fn();
  } catch (err) {
    assert.equal(
      err.code, code,
      `${label}: expected SQLSTATE ${code}, got ${err.code} — ${err.message}`
    );
    return err;
  }
  assert.fail(`${label}: expected SQLSTATE ${code}, but the statement succeeded`);
}

async function insertMember(contractorId, email) {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier)
     VALUES ($1, $2, 'x', 'general') RETURNING id`,
    [contractorId, email]
  );
  return rows[0].id;
}

async function wipeIdentityTables() {
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM user_badges');
  await pool.query('DELETE FROM contractor_invite_links');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM team_members');
}

describe('C/DL-3b Phase 2A — unified-login email lookup indexes', () => {
  before(async () => {
    pool = await initTestDb();
    await seedContractor(pool, TENANT_A);
    await wipeIdentityTables();
  });

  after(async () => {
    await pool.end();
  });

  // ══ GROUP 1 — THE INDEXES EXIST AND HAVE THE RIGHT SHAPE ═══════════════════

  describe('index shape', () => {
    it('[RED] users carries an index on LOWER(email)', async () => {
      const def = await indexDef(USERS_INDEX);
      assert.ok(def, `${USERS_INDEX} not found on users`);
      assert.match(def, /lower\(email\)/i, `${USERS_INDEX} must be an expression index on LOWER(email); got: ${def}`);
      assert.match(def, /\bON public\.users\b/i, `${USERS_INDEX} must sit on users; got: ${def}`);
    });

    it('[RED] the users index is NON-unique — one email may hold an account with two contractors', async () => {
      // Pinned deliberately. A UNIQUE index here would look like a tightening and
      // would silently outlaw the cross-tenant duplicate that D1 exists to
      // disambiguate — the tenant rebuild made users.email unique PER CONTRACTOR
      // on purpose.
      const def = await indexDef(USERS_INDEX);
      assert.ok(def, `${USERS_INDEX} not found on users`);
      assert.doesNotMatch(def, /CREATE UNIQUE INDEX/i, `${USERS_INDEX} must not be unique; got: ${def}`);
    });

    it('[RED] two contractors may hold the same email, and the index does not prevent it', async () => {
      await seedContractor(pool, TENANT_B);
      await pool.query(
        `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
         VALUES ('Shared A', 'shared@cdl3b.test', 'x', TRUE, $1)`, [TENANT_A]
      );
      await pool.query(
        `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
         VALUES ('Shared B', 'shared@cdl3b.test', 'x', TRUE, $1)`, [TENANT_B]
      );
      const { rows } = await pool.query(
        'SELECT contractor_id FROM users WHERE LOWER(email) = LOWER($1) ORDER BY contractor_id',
        ['SHARED@cdl3b.test']
      );
      assert.deepEqual(rows.map(r => r.contractor_id), [TENANT_A, TENANT_B],
        'the cross-tenant duplicate D1 disambiguates must remain insertable and findable case-insensitively');
    });

    it('[RED] team_members carries a UNIQUE index on LOWER(email)', async () => {
      const def = await indexDef(TM_INDEX);
      assert.ok(def, `${TM_INDEX} not found on team_members`);
      assert.match(def, /CREATE UNIQUE INDEX/i, `${TM_INDEX} must be UNIQUE; got: ${def}`);
      assert.match(def, /lower\(email\)/i, `${TM_INDEX} must be an expression index on LOWER(email); got: ${def}`);
      assert.match(def, /\bON public\.team_members\b/i, `${TM_INDEX} must sit on team_members; got: ${def}`);
    });

    it('[RED] the team_members index actually rejects a case-variant duplicate', async () => {
      // The existing column-level UNIQUE (email) is case-SENSITIVE and lets both
      // of these coexist. This is the hole 2A closes.
      await insertMember(TENANT_A, 'Case@cdl3b.test');
      await expectPgError(
        () => insertMember(TENANT_A, 'case@cdl3b.test'),
        '23505',
        'case-variant team_members email'
      );
    });
  });

  // ══ GROUP 2 — IDEMPOTENCY AND THE WORK-REMAINING WRAPPER ═══════════════════

  describe('migration is idempotent and the guard no-ops once no work remains', () => {
    it('[RED] re-running initDB() is a clean no-op and leaves both indexes in place', async () => {
      await assert.doesNotReject(initDB(), 'second run');
      await assert.doesNotReject(initDB(), 'third run');
      assert.ok(await indexDef(USERS_INDEX), `${USERS_INDEX} must survive repeated runs`);
      assert.ok(await indexDef(TM_INDEX), `${TM_INDEX} must survive repeated runs`);

      // Still ENFORCING after the repeats — not dropped and quietly left off.
      await insertMember(TENANT_A, 'Repeat@cdl3b.test');
      await expectPgError(
        () => insertMember(TENANT_A, 'REPEAT@cdl3b.test'),
        '23505',
        'uniqueness still live after repeated initDB() runs'
      );
    });

    it('[RED] the guard stays a no-op with TWO contractors present', async () => {
      // The named standing principle, and the failure mode it exists to prevent:
      // a fail-closed guard that is not work-remaining-wrapped re-fires and crashes
      // every boot the moment a second contractors row exists. Two contractors, two
      // team members, one re-run — it must simply do nothing.
      await seedContractor(pool, TENANT_B);
      const { rows: cRows } = await pool.query('SELECT COUNT(*)::int AS n FROM contractors');
      assert.ok(cRows[0].n >= 2, `precondition: at least 2 contractors, found ${cRows[0].n}`);

      await insertMember(TENANT_A, 'two-a@cdl3b.test');
      await insertMember(TENANT_B, 'two-b@cdl3b.test');

      await assert.doesNotReject(initDB(), 'a re-run with two contractors must be a silent no-op');
      assert.ok(await indexDef(TM_INDEX), `${TM_INDEX} must still be present`);
    });
  });

  // ══ GROUP 3 — DIRTY-DATA PROOF (runs last; restores the schema) ════════════

  describe('dirty data: two team_members rows differing only by email case', () => {
    it('[RED] the migration fails closed, names the address, and destroys nothing', async () => {
      await pool.query(`DROP INDEX IF EXISTS ${TM_INDEX}`);
      assert.equal(await indexDef(TM_INDEX), null, 'precondition: index dropped');
      await wipeIdentityTables();

      // The pre-existing production row shape — only insertable while the index is
      // absent, which is exactly how it would come to exist before any migration
      // guarded it. The existing case-sensitive UNIQUE (email) permits both.
      const idUpper = await insertMember(TENANT_A, 'Dirty@cdl3b.test');
      const idLower = await insertMember(TENANT_A, 'dirty@cdl3b.test');

      const err = await expectPgError(
        () => initDB(),
        'P0001',
        'initDB() with a case-variant team_members duplicate'
      );
      assert.match(
        err.message, /dirty@cdl3b\.test/,
        `the operator must be told WHICH address collides; got: ${err.message}`
      );
      assert.match(
        err.message, /team_members/i,
        `the error must name the table it is talking about; got: ${err.message}`
      );

      assert.equal(await indexDef(TM_INDEX), null,
        'the index must not exist after a failed run — it must fail closed, not half-apply');

      // Neither row is rewritten, merged, or deleted. Two rows differing only by
      // case are two credential records with two hashes; picking a survivor is an
      // identity decision and belongs to an operator, never to a migration.
      const { rows } = await pool.query(
        'SELECT id, email FROM team_members WHERE LOWER(email) = $1 ORDER BY id',
        ['dirty@cdl3b.test']
      );
      assert.deepEqual(
        rows.map(r => ({ id: r.id, email: r.email })),
        [{ id: idUpper, email: 'Dirty@cdl3b.test' }, { id: idLower, email: 'dirty@cdl3b.test' }],
        'the migration must leave both rows exactly as it found them'
      );
    });

    it('[RED] once the operator resolves the duplicate, the next boot applies the index', async () => {
      await pool.query('DELETE FROM team_members WHERE email = $1', ['Dirty@cdl3b.test']);
      await assert.doesNotReject(initDB(), 'a resolved duplicate must let the migration self-apply');
      assert.ok(await indexDef(TM_INDEX), 'the index must appear once the data is clean');
    });

    it('[RED] the OWNER_SEED_EMAIL block does not insert a colliding case-variant', async () => {
      // db.js's seed checks `WHERE email = $1` — case-SENSITIVELY. Once a
      // case-insensitive uniqueness guarantee exists, an env var whose letter case
      // differs from the stored row makes that check miss, the INSERT fire, and the
      // new index reject it: initDB() throws and the boot dies. The seed's existence
      // check has to agree with the invariant the same file now enforces.
      await wipeIdentityTables();
      await insertMember(TENANT_A, 'Seeded.Owner@cdl3b.test');

      const priorEmail = process.env.OWNER_SEED_EMAIL;
      const priorPassword = process.env.OWNER_SEED_PASSWORD;
      process.env.OWNER_SEED_EMAIL = 'seeded.owner@cdl3b.test';
      process.env.OWNER_SEED_PASSWORD = 'not-a-real-password';
      try {
        await assert.doesNotReject(initDB(), 'a case-variant OWNER_SEED_EMAIL must not crash the boot');
      } finally {
        if (priorEmail === undefined) delete process.env.OWNER_SEED_EMAIL;
        else process.env.OWNER_SEED_EMAIL = priorEmail;
        if (priorPassword === undefined) delete process.env.OWNER_SEED_PASSWORD;
        else process.env.OWNER_SEED_PASSWORD = priorPassword;
      }

      const { rows } = await pool.query(
        'SELECT email FROM team_members WHERE LOWER(email) = $1',
        ['seeded.owner@cdl3b.test']
      );
      assert.deepEqual(
        rows.map(r => r.email), ['Seeded.Owner@cdl3b.test'],
        'the seed must recognise the existing row through its letter case and insert nothing'
      );
    });
  });
});
