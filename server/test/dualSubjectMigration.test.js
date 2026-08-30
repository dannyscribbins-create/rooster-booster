'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 1.1-f — THE DUAL-NULLABLE SUBJECT MIGRATION — RED FIRST
//
// Team members have NO credential recovery path. The only recovery is an admin
// re-invite. Three tables hold recovery tokens and codes and all three FK to
// users(id) with no team_member path:
//     pin_reset_tokens.user_id      NULLABLE already
//     verification_codes.user_id    NULLABLE already
//     email_verifications.user_id   NOT NULL      ← the two-step one
//
// This phase makes the SHAPE possible. 1.1-g uses it. Nothing reads or writes
// team_member_id after this phase — the column exists and nothing uses it, and
// that is the intended end state. A migration plus an auth feature in one
// deploy is two failure modes sharing one revert.
//
// ── ⚠ THE FIRST TWO TABLES ALREADY PERMIT THE VIOLATION ─────────────────────
// A subject-less row is INSERTABLE TODAY into pin_reset_tokens and
// verification_codes with nothing preventing it. So the exactly-one CHECK is a
// constraint being added to tables that CURRENTLY PERMIT violations — it needs
// a work-remaining existence check and a fail-closed guard, not a fresh-schema
// proof.
//
// Production was measured 2026-08-29 and is CLEAN: 0 NULL-subject rows in
// pin_reset_tokens, 0 in verification_codes, 5 total rows in
// email_verifications. ⚠ THAT IS NOT THE PROOF. The guard exists for the
// database that is NOT clean, and a migration proven only against a table
// built fresh by initDB() is proven against a table that never had the
// problem. The dirty-data reproduction below rebuilds the three tables in
// their LEGACY shape, seeds violating rows, and runs the real initDB().
//
// ── ⚠ PLACEMENT IS LOAD-BEARING, AND IT IS THE REVERSE OF user_preferences ──
// server/db.js creates team_members at :1178. All three target tables are
// created ABOVE it — :75, :189, :304. So `team_member_id INTEGER REFERENCES
// team_members(id)` CANNOT go inline in those CREATE TABLE blocks: on a
// FRESH-DATABASE boot that is a forward reference to a table that does not
// exist yet, and initDB() fails at boot.
//
// user_preferences' own comment states this rule for a NEW table ("it cannot
// live beside contact_tags"); here it applies to THREE OLD tables in reverse.
// The columns therefore land as ALTER TABLE ... ADD COLUMN IF NOT EXISTS in one
// block placed AFTER team_members. THE FRESH-BOOT TEST BELOW IS THE ONLY THING
// THAT CATCHES A REGRESSION HERE — an existing database migrates fine either
// way, so someone who "tidies" the columns back inline sees nothing break
// locally and breaks every new deployment.
//
// ── ⚠ NO UNIQUE INDEXES, AND THAT IS A RE-DERIVATION NOT AN OMISSION ────────
// user_preferences carries two partial UNIQUE indexes. Its PROPERTY is "one row
// per (subject, key)". None of these three tables has an analogous rule and TWO
// ACTIVELY DEPEND ON MULTIPLE ROWS PER SUBJECT:
//   · verification_codes' consumers ORDER BY created_at DESC LIMIT 1
//     (server/routes/account.js, both verify handlers)
//   · the resend flow RETIRES THEN INSERTS a second email_verifications row for
//     the same user inside one transaction (server/routes/referrer.js, the
//     resend-code handler)
// A UNIQUE (user_id, …) here would break resend on its second call. Copying the
// measure by its MECHANISM rather than its PROPERTY is the exact failure
// CLAUDE.md records; the property does not transfer, so the indexes do not.
// (Non-unique indexes on team_member_id are also deliberately absent — nothing
// carries a value in that column until 1.1-g. Filed there, to be added with a
// measurement rather than an expectation.)
//
// ── ⚠ TWO CONSUMERS FAIL SILENTLY ON A team_member-SUBJECT ROW, AND THIS
//    PHASE DELIBERATELY DOES NOT FIX THEM ────────────────────────────────────
// They misbehave only once such a row exists, and nothing creates one until
// 1.1-g. Enumerated so 1.1-g starts from them rather than rediscovering them:
//   1. server/routes/referrer.js, POST /api/reset-pin — the token lookup joins
//      `JOIN users u ON u.id = prt.user_id`, an INNER join. A NULL-subject row
//      is dropped, rows.length === 0, and the handler answers "Reset link is
//      invalid or has expired." — BYTE-IDENTICAL to a genuine expiry.
//   2. server/routes/referrer.js, POST /api/signup/resend-code — the retirement
//      sweep `WHERE user_id = $1 AND used_at IS NULL` never matches a
//      NULL-subject row, so old codes are never retired, accumulate, and stay
//      simultaneously valid. The INSERT beside it in the same transaction
//      succeeds, so nothing errors.
// Cited by ROLE, not by line: this is the shape that keeps rotting.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { pool, initDB } = require('../db');

// Postgres SQLSTATEs. Asserting the CODE rather than "it was rejected" is what
// makes test 3 meaningful — see its own comment.
const CHECK_VIOLATION    = '23514';
const NOT_NULL_VIOLATION = '23502';

const TABLES = ['pin_reset_tokens', 'verification_codes', 'email_verifications'];

const CONSTRAINT_NAME = (t) => `${t}_exactly_one_subject`;

// ⚠ THE LEGACY DDL, COPIED VERBATIM FROM server/db.js AS OF HEAD 08b2fc0.
// This is what production's tables actually look like BEFORE the migration, and
// rebuilding from it is what makes the dirty-data reproduction a reproduction
// rather than a fresh-schema run. Do not "update" these to match the new shape
// — the whole point is that they are the OLD shape.
const LEGACY_DDL = {
  pin_reset_tokens: `CREATE TABLE pin_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP
  )`,
  verification_codes: `CREATE TABLE verification_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    type VARCHAR(30) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  email_verifications: `CREATE TABLE email_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
  )`,
};

// ── introspection helpers ────────────────────────────────────────────────────

async function columnExists(table, column) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows.length === 1;
}

async function columnIsNullable(table, column) {
  const { rows } = await pool.query(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows[0] && rows[0].is_nullable === 'YES';
}

async function constraintExists(name) {
  const { rows } = await pool.query('SELECT 1 FROM pg_constraint WHERE conname = $1', [name]);
  return rows.length === 1;
}

// The FK's delete action, read from the catalogue rather than assumed.
// 'c' = CASCADE. user_preferences uses ON DELETE CASCADE on both subject
// columns and this migration copies that.
async function fkDeleteAction(table, column) {
  const { rows } = await pool.query(
    `SELECT c.confdeltype
       FROM pg_constraint c
       JOIN pg_attribute a
         ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.conrelid = $1::regclass AND a.attname = $2`,
    [table, column]
  );
  return rows[0] ? rows[0].confdeltype : null;
}

// Captures a Postgres error's SQLSTATE and constraint name, or null if the
// statement unexpectedly SUCCEEDED. Returning null rather than throwing is what
// lets the assertion say "this was accepted" in its own words.
async function insertError(sql, params) {
  try {
    await pool.query(sql, params);
    return null;
  } catch (err) {
    return { code: err.code, constraint: err.constraint, message: err.message };
  }
}

// ── fixtures ─────────────────────────────────────────────────────────────────

const CID = 'w11f-tenant';

async function seedSubjects() {
  await pool.query(
    `INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')
     ON CONFLICT (id) DO NOTHING`,
    [CID]
  );
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, $1)
     ON CONFLICT (contractor_id) DO NOTHING`,
    [CID]
  );
  // ⚠ IDEMPOTENT ON PURPOSE. rebuildLegacy() runs twice — once for the dirty
  // reproduction and once for the clean one — and the second call hit
  // users_contractor_id_email_unique (23505). The subjects survive both rebuilds
  // because only the three LEAF tables are dropped, so this must find the
  // existing rows rather than insert new ones. Insert-then-select, not
  // ON CONFLICT ... RETURNING: a DO NOTHING conflict returns no row at all.
  await pool.query(
    `INSERT INTO users (full_name, email, pin, email_verified, contractor_id)
     VALUES ('W11F User', 'w11f-user@test.local', 'x', TRUE, $1)
     ON CONFLICT (contractor_id, email) DO NOTHING`,
    [CID]
  );
  await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
     VALUES ($1, 'w11f-member@test.local', 'x', 'owner', '{}')
     ON CONFLICT DO NOTHING`,
    [CID]
  );
  const { rows: u } = await pool.query(
    'SELECT id FROM users WHERE contractor_id = $1 AND email = $2', [CID, 'w11f-user@test.local']
  );
  const { rows: t } = await pool.query(
    'SELECT id FROM team_members WHERE contractor_id = $1 AND email = $2', [CID, 'w11f-member@test.local']
  );
  assert.equal(u.length, 1, 'the fixture user was neither inserted nor found');
  assert.equal(t.length, 1, 'the fixture team member was neither inserted nor found');
  return { userId: u[0].id, teamMemberId: t[0].id };
}

// Rebuilds the three tables in their LEGACY shape and seeds the row shapes
// production could actually be carrying. Returns the seeded user id.
//
// ⚠ DROP ... CASCADE is safe here and only here: all three are LEAF tables —
// nothing in the schema references them. Verified against server/db.js.
async function rebuildLegacy({ dirty }) {
  for (const t of TABLES) {
    await pool.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
  }
  for (const t of TABLES) {
    await pool.query(LEGACY_DDL[t]);
  }
  const { userId } = await seedSubjects();

  // Clean rows — the shapes production actually holds today.
  await pool.query(
    `INSERT INTO pin_reset_tokens (user_id, token, expires_at)
     VALUES ($1, 'w11f-clean-token', NOW() + interval '1 hour')`,
    [userId]
  );
  await pool.query(
    `INSERT INTO verification_codes (user_id, code, type, expires_at)
     VALUES ($1, '123456', 'email', NOW() + interval '1 hour')`,
    [userId]
  );
  await pool.query(
    `INSERT INTO email_verifications (user_id, code, expires_at)
     VALUES ($1, '654321', NOW() + interval '1 hour')`,
    [userId]
  );

  if (dirty) {
    // ⚠ THE VIOLATING ROWS. Legal in the legacy shape on the two nullable
    // tables — this is the state the guard exists for. email_verifications
    // cannot hold one while its NOT NULL stands, which is exactly why its
    // migration is two-step and why the guard must run AFTER the DROP NOT NULL.
    await pool.query(
      `INSERT INTO pin_reset_tokens (user_id, token, expires_at)
       VALUES (NULL, 'w11f-orphan-token', NOW() + interval '1 hour')`
    );
    await pool.query(
      `INSERT INTO verification_codes (user_id, code, type, expires_at)
       VALUES (NULL, '999999', 'email', NOW() + interval '1 hour')`
    );
  }
  return userId;
}

describe('Wave 1.1-f — the dual-nullable subject migration (RED)', () => {
  let pooledDb;
  let userId;
  let teamMemberId;

  before(async () => {
    // ⚠ ONE POOL PER TEST FILE. initTestDb() returns the server/db.js pool
    // SINGLETON; a second call plus a second pool.end() is what produced a
    // CANCELLED suite that reported neither pass nor fail. The destructive
    // tests below re-run initDB() against this same pool rather than calling
    // initTestDb() again.
    pooledDb = await initTestDb();
    ({ userId, teamMemberId } = await seedSubjects());
  });

  after(async () => {
    await pooledDb.end();
  });

  // ══ 1. THE SHAPE EXISTS ═══════════════════════════════════════════════════

  it('all three tables carry a nullable team_member_id with ON DELETE CASCADE', async () => {
    for (const t of TABLES) {
      assert.ok(
        await columnExists(t, 'team_member_id'),
        `${t}.team_member_id does not exist. The migration has not run, or the ALTER was ` +
          `placed before team_members is created (server/db.js) and silently skipped.`
      );
      assert.ok(await columnIsNullable(t, 'team_member_id'), `${t}.team_member_id must be nullable`);
      assert.equal(
        await fkDeleteAction(t, 'team_member_id'),
        'c',
        `${t}.team_member_id must be ON DELETE CASCADE, matching user_preferences' shape`
      );
    }
  });

  it('email_verifications.user_id is now NULLABLE — the two-step half', async () => {
    assert.ok(
      await columnIsNullable('email_verifications', 'user_id'),
      'email_verifications.user_id is still NOT NULL. It is the only one of the three that ' +
        'needs the DROP NOT NULL step, and without it a team_member-subject row is ' +
        'structurally impossible there.'
    );
  });

  it('all three carry the exactly-one-subject CHECK', async () => {
    for (const t of TABLES) {
      assert.ok(
        await constraintExists(CONSTRAINT_NAME(t)),
        `constraint ${CONSTRAINT_NAME(t)} does not exist on ${t}`
      );
    }
  });

  // ══ 2. THE CHECK BEHAVES ══════════════════════════════════════════════════

  it('a team_member-subject row INSERTs into each of the three tables', async () => {
    assert.equal(
      await insertError(
        `INSERT INTO pin_reset_tokens (user_id, team_member_id, token, expires_at)
         VALUES (NULL, $1, 'w11f-tm-token', NOW() + interval '1 hour')`,
        [teamMemberId]
      ),
      null,
      'a team_member-subject pin_reset_tokens row was rejected'
    );
    assert.equal(
      await insertError(
        `INSERT INTO verification_codes (user_id, team_member_id, code, type, expires_at)
         VALUES (NULL, $1, '111111', 'email', NOW() + interval '1 hour')`,
        [teamMemberId]
      ),
      null,
      'a team_member-subject verification_codes row was rejected'
    );
    assert.equal(
      await insertError(
        `INSERT INTO email_verifications (user_id, team_member_id, code, expires_at)
         VALUES (NULL, $1, '222222', NOW() + interval '1 hour')`,
        [teamMemberId]
      ),
      null,
      'a team_member-subject email_verifications row was rejected'
    );
  });

  it('a row with BOTH subjects set is rejected by the CHECK, by name', async () => {
    const both = [
      ['pin_reset_tokens', `INSERT INTO pin_reset_tokens (user_id, team_member_id, token, expires_at)
        VALUES ($1, $2, 'w11f-both-token', NOW() + interval '1 hour')`],
      ['verification_codes', `INSERT INTO verification_codes (user_id, team_member_id, code, type, expires_at)
        VALUES ($1, $2, '333333', 'email', NOW() + interval '1 hour')`],
      ['email_verifications', `INSERT INTO email_verifications (user_id, team_member_id, code, expires_at)
        VALUES ($1, $2, '444444', NOW() + interval '1 hour')`],
    ];
    for (const [t, sql] of both) {
      const err = await insertError(sql, [userId, teamMemberId]);
      assert.ok(err, `${t} ACCEPTED a row naming two different subjects`);
      assert.equal(err.code, CHECK_VIOLATION, `${t}: expected a CHECK violation, got ${err.code}`);
      assert.equal(
        err.constraint,
        CONSTRAINT_NAME(t),
        `${t} was rejected by ${err.constraint}, not by the exactly-one-subject CHECK. ` +
          `A plausible-looking rejection is not the rejection under test.`
      );
    }
  });

  // ⚠ THE ASSERTION IS ON THE SQLSTATE, AND THAT IS THE WHOLE POINT OF THIS
  // TEST. On email_verifications a neither-subject row is rejected TODAY — by
  // its NOT NULL (23502), not by any CHECK. After the migration it must be
  // rejected by the CHECK (23514) instead, because the NOT NULL is gone. A test
  // that asserted only "it was rejected" would be GREEN BEFORE AND AFTER and
  // would prove nothing about either state. On the two already-nullable tables
  // this is the pre-existing permissiveness being closed and it is RED today.
  it('a row with NEITHER subject is rejected — by the CHECK, not by a NOT NULL', async () => {
    const neither = [
      ['pin_reset_tokens', `INSERT INTO pin_reset_tokens (user_id, team_member_id, token, expires_at)
        VALUES (NULL, NULL, 'w11f-neither-token', NOW() + interval '1 hour')`],
      ['verification_codes', `INSERT INTO verification_codes (user_id, team_member_id, code, type, expires_at)
        VALUES (NULL, NULL, '555555', 'email', NOW() + interval '1 hour')`],
      ['email_verifications', `INSERT INTO email_verifications (user_id, team_member_id, code, expires_at)
        VALUES (NULL, NULL, '666666', NOW() + interval '1 hour')`],
    ];
    for (const [t, sql] of neither) {
      const err = await insertError(sql, []);
      assert.ok(err, `${t} ACCEPTED a subject-less row — the pre-existing permissiveness is still open`);
      assert.notEqual(
        err.code,
        NOT_NULL_VIOLATION,
        `${t} rejected the row with a NOT NULL violation (23502), not a CHECK violation. ` +
          `On email_verifications that is the PRE-migration behaviour: the row is refused ` +
          `for the old reason and the CHECK may not exist at all.`
      );
      assert.equal(err.code, CHECK_VIOLATION, `${t}: expected a CHECK violation, got ${err.code}`);
      assert.equal(err.constraint, CONSTRAINT_NAME(t), `${t}: wrong constraint`);
    }
  });

  // ⚠ GREEN IN THE RED STATE, BY DESIGN — one of only two here, so it is worth
  // saying which. It asserts an ABSENCE of constraint, and no constraint exists
  // yet, so it cannot fail today. Its job is entirely post-migration.
  it('partial-index sanity: multiple rows per subject remain legal on all three', async () => {
    // ⚠ THE INVERSE OF A UNIQUE-INDEX TEST, AND IT IS DELIBERATE. This pins the
    // decision NOT to copy user_preferences' partial unique indexes. Two live
    // flows depend on multiple rows per subject; if someone adds a
    // UNIQUE (user_id, …) later, this goes red and names why.
    for (let i = 0; i < 2; i++) {
      assert.equal(
        await insertError(
          `INSERT INTO verification_codes (user_id, code, type, expires_at)
           VALUES ($1, '77777' || $2::text, 'email', NOW() + interval '1 hour')`,
          [userId, String(i)]
        ),
        null,
        'a SECOND verification_codes row for the same user+type was rejected. The consumers ' +
          'ORDER BY created_at DESC LIMIT 1 and expect several to exist.'
      );
      assert.equal(
        await insertError(
          `INSERT INTO email_verifications (user_id, code, expires_at)
           VALUES ($1, '88888' || $2::text, NOW() + interval '1 hour')`,
          [userId, String(i)]
        ),
        null,
        'a SECOND email_verifications row for the same user was rejected. The resend flow ' +
          'retires-then-inserts inside one transaction and REQUIRES this.'
      );
    }
  });

  // ══ 3. POSITIVE CONTROL ═══════════════════════════════════════════════════
  // ⚠ ORDERED AFTER THE NEGATIVES BUT LOAD-BEARING FOR ALL OF THEM. A migration
  // that rejected everything would satisfy every assertion above and look
  // identical to a correct one.
  //
  // ⚠ GREEN IN THE RED STATE, BY DESIGN — the second of the two. It describes
  // behaviour that is correct BEFORE the migration and must remain correct
  // after, so it proves nothing about the migration on its own and everything
  // about it in combination with the negatives above.

  it('POSITIVE CONTROL — a user-subject row still inserts and every consumer still finds it', async () => {
    const token = 'w11f-positive-token';
    assert.equal(
      await insertError(
        `INSERT INTO pin_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + interval '1 hour')`,
        [userId, token]
      ),
      null,
      'an ordinary user-subject row was rejected — the migration rejects everything'
    );

    // The reset-pin token lookup, replicated verbatim from
    // server/routes/referrer.js's POST /api/reset-pin handler — the INNER JOIN
    // that is one of the two silent consumers. It must still resolve a
    // user-subject row unchanged.
    const { rows: reset } = await pool.query(
      `SELECT prt.user_id, u.full_name, u.email
         FROM pin_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
        WHERE prt.token = $1 AND prt.used_at IS NULL AND prt.expires_at > NOW()`,
      [token]
    );
    assert.equal(reset.length, 1, 'the reset-pin INNER JOIN no longer resolves a user-subject row');
    assert.equal(reset[0].user_id, userId);

    // The signup verify-email lookup, from the verify-email handler.
    await pool.query(
      `INSERT INTO email_verifications (user_id, code, expires_at)
       VALUES ($1, '901234', NOW() + interval '1 hour')`,
      [userId]
    );
    const { rows: ev } = await pool.query(
      `SELECT id FROM email_verifications
        WHERE user_id=$1 AND code=$2 AND used_at IS NULL AND expires_at > NOW()`,
      [userId, '901234']
    );
    assert.equal(ev.length, 1, 'the verify-email lookup no longer resolves a user-subject row');

    // The phone/email code lookup, from server/routes/account.js's two verify
    // handlers — including their ORDER BY ... LIMIT 1.
    await pool.query(
      `INSERT INTO verification_codes (user_id, code, type, expires_at)
       VALUES ($1, '135790', 'phone', NOW() + interval '1 hour')`,
      [userId]
    );
    const { rows: vc } = await pool.query(
      `SELECT id FROM verification_codes
        WHERE user_id=$1 AND code=$2 AND type='phone' AND used=false AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1`,
      [userId, '135790']
    );
    assert.equal(vc.length, 1, 'the account verification-code lookup no longer resolves a user-subject row');
  });

  // ══ 4. THE FRESH-DATABASE BOOT ════════════════════════════════════════════
  // ⚠ THE ONLY TEST THAT CATCHES THE FORWARD-REFERENCE HAZARD. An EXISTING
  // database migrates fine whether the ALTER sits before or after team_members,
  // so nothing else here would notice someone moving the columns back inline
  // into the CREATE TABLE blocks. This wipes the schema and rebuilds from
  // initDB() exactly as a brand-new deployment does.
  //
  // Destructive, and ordered here on purpose: everything above has finished.

  it('FRESH BOOT — a brand-new database builds from initDB() with no forward reference', async () => {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    await assert.doesNotReject(
      () => initDB(),
      'initDB() failed on a FRESH database. If the failure names team_members, the ' +
        'team_member_id columns have been moved into the CREATE TABLE blocks at the top of ' +
        'server/db.js — that is a forward reference to a table created at :1178, and it ' +
        'breaks every new deployment while leaving existing ones working.'
    );

    for (const t of TABLES) {
      assert.ok(await columnExists(t, 'team_member_id'), `${t}.team_member_id missing after a fresh boot`);
      assert.ok(await constraintExists(CONSTRAINT_NAME(t)), `${CONSTRAINT_NAME(t)} missing after a fresh boot`);
    }
  });

  // ══ 5. THE FAIL-CLOSED GUARD, AGAINST DIRTY DATA ══════════════════════════
  // ⚠ THE DIRTY-DATA REPRODUCTION IS THE POINT. Production is clean (measured
  // 2026-08-29: 0, 0, and 5 rows). A migration proven only against a table
  // initDB() just built is proven against a table that never had the problem.
  // rebuildLegacy() recreates the three tables in their PRE-migration shape and
  // seeds rows that are legal there and illegal after.

  it('FAIL CLOSED — the migration ABORTS on dirty data and changes nothing', async () => {
    await rebuildLegacy({ dirty: true });

    const before = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM pin_reset_tokens)   AS prt,
              (SELECT COUNT(*)::int FROM verification_codes) AS vc`
    );

    let threw = null;
    try { await initDB(); } catch (err) { threw = err; }

    assert.ok(
      threw,
      'initDB() SUCCEEDED against a table holding subject-less rows. The exactly-one CHECK ' +
        'cannot have been added — or was added to a table it should have refused. This is the ' +
        'fail-closed guard, and a guard whose failure mode has never been observed is a claim.'
    );
    assert.match(
      threw.message,
      /exactly[- ]one[- ]subject|subject-less|neither subject/i,
      `the abort must name WHY it refused. Got: ${threw.message}`
    );

    // Nothing changed: the violating rows are still there and no constraint landed.
    const after = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM pin_reset_tokens)   AS prt,
              (SELECT COUNT(*)::int FROM verification_codes) AS vc`
    );
    assert.deepEqual(after.rows[0], before.rows[0], 'the aborted migration deleted or added rows');
    assert.equal(
      await constraintExists(CONSTRAINT_NAME('pin_reset_tokens')),
      false,
      'the CHECK was added despite the abort'
    );
  });

  it('WORK-REMAINING — the guard is a permanent no-op once the data is clean', async () => {
    // Same legacy rebuild, no violating rows: the migration must run to
    // completion rather than abort.
    await rebuildLegacy({ dirty: false });
    await assert.doesNotReject(() => initDB(), 'the migration aborted on CLEAN legacy data');
    for (const t of TABLES) {
      assert.ok(await constraintExists(CONSTRAINT_NAME(t)), `${CONSTRAINT_NAME(t)} was not added`);
    }

    // ⚠ SECOND RUN, ON AN ALREADY-MIGRATED DATABASE. Every fail-closed guard
    // must be wrapped in a work-remaining check so it fires while backfill
    // work remains and is a permanent no-op after — otherwise it re-crashes on
    // every boot. This is that assertion, and it is the one the ST-session
    // incident in CLAUDE_REGISTRY.md was written about.
    await assert.doesNotReject(
      () => initDB(),
      'initDB() failed on its SECOND run against an already-migrated database. The guard is ' +
        'not wrapped in a work-remaining existence check and will re-crash on every boot.'
    );
    await assert.doesNotReject(() => initDB(), 'initDB() is not idempotent across three runs');
  });
});
