'use strict';

// ── THE ASSIGNED DATE, COMMIT 1: THE COLUMNS, THE BACKFILL AND THE INDEX ──────
// 3d Phase 1b Commit 1. PHASE_1b_DESIGN.md §2.
//
// This commit adds four columns that NOTHING reads and NOTHING writes yet, so almost
// everything worth asserting here is about the SHAPE rather than about behaviour. Three
// properties carry the commit:
//
//   1. assigned_at has NO DEFAULT (Danny, Q2, 2026-09-28). A DEFAULT NOW() would turn every
//      future "a writer forgot the date" into "the writer silently stamped the clock" —
//      R5's defect wearing a schema hat, invisible and permanent. The absence of a default
//      is what makes Commit 2's writers fail LOUDLY instead.
//   2. The backfill is a PERMANENT NO-OP after its first run. Without that it runs on every
//      boot and overwrites a correctly-derived historical date with today's displayed
//      COALESCE — R5's defect reintroduced by the statement meant to seed it, silently, on
//      every restart.
//   3. The index's COALESCE argument order matches OWN_BOOK_PREDICATE's. The older index's
//      own header comment in db.js records that swapping them leaves an index that "still
//      builds, still looks right, and is silently never used".
//
// ⚠ EVERY FIXTURE HERE MAKES THE RELEVANT COLUMNS DISAGREE, AND THAT IS NOT TIDINESS.
// The backfill is COALESCE(sticky_set_at, provisional_set_at, updated_at). A fixture whose
// three timestamps are equal — which is what a row seeded with three bare NOW()s looks like
// — cannot tell which arm produced the answer, so every arm-selection assertion would pass
// against a backfill that read the wrong column. The three constants below are years apart
// for that reason.
//
// ⚠ AND THE INDEX FENCE READS BOTH SIDES RATHER THAN RESTATING EITHER. It compares the index
// Postgres ACTUALLY BUILT (pg_indexes.indexdef) against repBook.js's ACTUAL
// OWN_BOOK_PREDICATE. A fence with the expected order typed into it would agree with itself
// on the day it was written and stop agreeing the first time either side moved.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { backfillAssignedAt } = require('../db');
const { OWN_BOOK_PREDICATE } = require('../utils/repBook');

const TENANT = 'assigned-at-1';

// ⚠ YEARS APART, DELIBERATELY — see the header. STICKY is the newest so that "sticky wins"
// cannot be satisfied by an ordering coincidence either.
const STICKY_AT = '2026-03-01T10:00:00.000Z';
const PROV_AT = '2024-05-02T11:00:00.000Z';
const UPDATED_AT = '2023-07-03T12:00:00.000Z';

let pool;

// Seeds one assignment row with full control of all three timestamps. assigned_at is left
// unset — there is no default, so it arrives NULL, which is what the backfill looks for.
const seedRow = async (clientId, { stickyAt = null, provAt = null, updatedAt = UPDATED_AT }) => {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, sticky_set_at, provisional_set_at, updated_at)
     VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5::timestamptz)`,
    [TENANT, clientId, stickyAt, provAt, updatedAt]
  );
};

const readRow = async (clientId) => {
  const { rows } = await pool.query(
    `SELECT assigned_at, assigned_fact_kind, assigned_fact_id, assigned_fact_at,
            sticky_set_at, provisional_set_at, updated_at
       FROM client_rep_assignments
      WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [TENANT, clientId]
  );
  return rows[0] || null;
};

const iso = (v) => (v === null || v === undefined ? null : new Date(v).toISOString());

before(async () => {
  pool = await initTestDb();
});
after(async () => {
  await pool.end();
});

beforeEach(async () => {
  // ⚠ ONE LITERAL DELETE, NOT A LOOP OVER AN ARRAY. This suite touches exactly one table, and
  // the 6c reset-coverage fence reads a literal `DELETE FROM <name>` directly while an
  // interpolated one sends it to the array-resolution path. One table, one statement.
  await pool.query('DELETE FROM client_rep_assignments WHERE contractor_id = $1', [TENANT]);
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Phase 1b Commit 1 — the assigned_at columns', () => {

  it('all four columns exist, with the right types and nullability', async () => {
    const { rows } = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_name = 'client_rep_assignments'
          AND column_name = ANY($1::text[])
        ORDER BY column_name`,
      [['assigned_at', 'assigned_fact_at', 'assigned_fact_id', 'assigned_fact_kind']]
    );

    // Non-vacuity floor. ⚠ SAME CAVEAT AS THE INDEX FENCE'S, AND IT IS STATED HERE TOO
    // RATHER THAN LEFT TO BE INFERRED: the byName lookups below dereference the result, so
    // an empty set reds with or without this line. What it buys is a NAMED failure instead
    // of a TypeError — and cover for any later assertion that reads the SET rather than a
    // row, which is the shape that would genuinely pass on nothing.
    assert.equal(rows.length, 4, 'all four columns must exist — an empty set is not a pass');

    const byName = new Map(rows.map((r) => [r.column_name, r]));
    assert.equal(byName.get('assigned_at').data_type, 'timestamp with time zone');
    assert.equal(byName.get('assigned_fact_at').data_type, 'timestamp with time zone');
    assert.equal(byName.get('assigned_fact_kind').data_type, 'text');
    assert.equal(byName.get('assigned_fact_id').data_type, 'text');

    // ⚠ NULLABLE IN THIS COMMIT, ON PURPOSE. NOT NULL arrives in Commit 4, AFTER every
    // writer sets it. Shipping it here would fail every engine write on a live service.
    for (const c of ['assigned_at', 'assigned_fact_at', 'assigned_fact_id', 'assigned_fact_kind']) {
      assert.equal(byName.get(c).is_nullable, 'YES', `${c} is nullable until Commit 4`);
    }
  });

  it('⚠ assigned_at has NO DEFAULT — the choice that makes a forgetful writer fail loudly', async () => {
    // ⚠ THIS IS THE LOAD-BEARING ASSERTION OF THE COMMIT (Danny, Q2). With a DEFAULT NOW(),
    // every test in Commits 2 and 3 still passes while production silently stamps the clock
    // on any path that forgets the date — which is exactly R5's defect, and unobservable.
    const { rows } = await pool.query(
      `SELECT column_default FROM information_schema.columns
        WHERE table_name = 'client_rep_assignments' AND column_name = 'assigned_at'`
    );
    assert.equal(rows.length, 1, 'the column must exist for this fence to mean anything');
    assert.equal(rows[0].column_default, null, 'assigned_at must have no default');
  });

  it('a row inserted without assigned_at gets NULL, not a clock value', async () => {
    // The paired positive for the fence above: the catalog says "no default", and this says
    // what that MEANS at insert time. A default would make this row carry today's date.
    await seedRow('c-nodefault', { stickyAt: STICKY_AT });
    const row = await readRow('c-nodefault');
    assert.equal(row.assigned_at, null);
    assert.equal(row.assigned_fact_kind, null);
    assert.equal(row.assigned_fact_id, null);
    assert.equal(row.assigned_fact_at, null);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Phase 1b Commit 1 — the backfill', () => {

  it('takes sticky_set_at when it is present, over both other arms', async () => {
    await seedRow('c-sticky', { stickyAt: STICKY_AT, provAt: PROV_AT, updatedAt: UPDATED_AT });
    const filled = await backfillAssignedAt(pool);
    assert.equal(filled, 1);

    const row = await readRow('c-sticky');
    // ⚠ The three source columns are years apart, so this cannot pass against a backfill
    // reading provisional_set_at or updated_at.
    assert.equal(iso(row.assigned_at), STICKY_AT);
    assert.notEqual(iso(row.assigned_at), PROV_AT);
    assert.notEqual(iso(row.assigned_at), UPDATED_AT);
  });

  it('falls to provisional_set_at when there is no sticky', async () => {
    await seedRow('c-prov', { stickyAt: null, provAt: PROV_AT, updatedAt: UPDATED_AT });
    await backfillAssignedAt(pool);

    const row = await readRow('c-prov');
    assert.equal(iso(row.assigned_at), PROV_AT);
    assert.notEqual(iso(row.assigned_at), UPDATED_AT);
  });

  it('⚠ a row with NEITHER set_at falls to updated_at AND is marked write_time', async () => {
    // ⚠ THE THIRD ARM IS WHAT STOPS COMMIT 4's SET NOT NULL THROWING. timeframeClause's note
    // in repBook.js records that a row with no assignment date at all exists deliberately,
    // and both
    // *_set_at columns are nullable with no default — so COALESCE of the first two CAN be
    // NULL, and a NULL is what makes the constraint fail during initDB.
    await seedRow('c-dateless', { stickyAt: null, provAt: null, updatedAt: UPDATED_AT });
    const filled = await backfillAssignedAt(pool);
    assert.equal(filled, 1);

    const row = await readRow('c-dateless');
    assert.equal(iso(row.assigned_at), UPDATED_AT, 'the third arm must fill it');
    assert.notEqual(row.assigned_at, null, 'and it must not be left NULL');
    // ⚠ THE MARKER IS THE HALF THAT MATTERS. Without it a row whose date is really
    // updated_at is indistinguishable from one whose date is a real historical set_at.
    assert.equal(row.assigned_fact_kind, 'write_time');
  });

  it('⚠ and a row that DID have a set_at is NOT marked write_time — the paired negative', async () => {
    // Without this, `assigned_fact_kind = 'write_time'` everywhere would pass the case above.
    await seedRow('c-marked', { stickyAt: STICKY_AT });
    await backfillAssignedAt(pool);

    const row = await readRow('c-marked');
    assert.equal(row.assigned_fact_kind, null,
      'a fact-dated row is NOT a write_time row — Q1: no kind is guessed for a backfilled row');
  });

  it('⚠ leaves assigned_fact_id and assigned_fact_at NULL — Q1, no provenance is invented', async () => {
    // Danny, Q1 (2026-09-28): the producing fact is not recorded anywhere, so no kind, id or
    // time is guessed for a backfilled row. NULL means "we do not know", which is true.
    await seedRow('c-prov-null', { stickyAt: STICKY_AT });
    await backfillAssignedAt(pool);

    const row = await readRow('c-prov-null');
    assert.equal(row.assigned_fact_id, null);
    assert.equal(row.assigned_fact_at, null);
  });

  it('⚠ IS A PERMANENT NO-OP AFTER THE FIRST RUN — it must never overwrite a stored date', async () => {
    // ⚠ THE PROPERTY THIS COMMIT MOST NEEDS. Unguarded, this statement runs on EVERY BOOT and
    // rewrites a correctly-derived historical assigned_at with today's displayed COALESCE —
    // which is R5's defect reintroduced by the very statement meant to seed it, silently, on
    // every restart, forever.
    await seedRow('c-noop', { stickyAt: STICKY_AT, provAt: PROV_AT, updatedAt: UPDATED_AT });
    assert.equal(await backfillAssignedAt(pool), 1, 'the first run fills it');
    assert.equal(iso((await readRow('c-noop')).assigned_at), STICKY_AT);

    // ⚠ MOVE THE SOURCE COLUMN SO THE TWO RUNS WOULD DISAGREE. Re-running against an
    // unchanged row proves nothing: the second run would write the same value and the case
    // would pass against a missing guard. The new value must be one the backfill WOULD pick.
    const MOVED = '2027-01-01T09:00:00.000Z';
    await pool.query(
      `UPDATE client_rep_assignments SET sticky_set_at = $3::timestamptz
        WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [TENANT, 'c-noop', MOVED]
    );

    assert.equal(await backfillAssignedAt(pool), 0, 'the second run must touch no rows');
    const row = await readRow('c-noop');
    assert.equal(iso(row.sticky_set_at), MOVED, 'harness: the source column really moved');
    assert.equal(iso(row.assigned_at), STICKY_AT, 'and assigned_at must NOT have followed it');
  });

  it('fills only the rows that need it, and reports how many', async () => {
    await seedRow('c-a', { stickyAt: STICKY_AT });
    await seedRow('c-b', { provAt: PROV_AT });
    assert.equal(await backfillAssignedAt(pool), 2);

    await seedRow('c-c', { stickyAt: STICKY_AT });
    assert.equal(await backfillAssignedAt(pool), 1, 'only the new row is filled');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Phase 1b Commit 1 — the #15 index', () => {

  // Pulls the COALESCE argument list out of a SQL fragment, as lower-cased bare column
  // names with any table alias stripped.
  // ⚠ IT ASSERTS IT MATCHED. A helper that silently returns [] on no match turns every
  // comparison below into [] === [], which is the vacuity this whole file is written around.
  const coalesceArgs = (sql, label) => {
    const m = /COALESCE\(([^)]*)\)/i.exec(sql);
    assert.ok(m, `harness: no COALESCE found in ${label} — this fence is vacuous otherwise`);
    const args = m[1].split(',').map((s) => s.trim().replace(/^[a-z_][a-z0-9_]*\./i, '').toLowerCase());
    assert.ok(args.length >= 2, `harness: ${label}'s COALESCE must have at least two arguments`);
    return args;
  };

  const indexDef = async () => {
    const { rows } = await pool.query(
      `SELECT indexdef FROM pg_indexes
        WHERE tablename = 'client_rep_assignments' AND indexname = 'idx_cra_owner_assigned'`
    );
    // ⚠ NON-VACUITY FLOOR — AND IT IS A LEGIBILITY GUARD, NOT A VACUITY GUARD. THIS
    // SENTENCE FIRST CLAIMED OTHERWISE AND A GUARD-PROOF MEASURED IT FALSE, SO IT RECORDS
    // THE MEASUREMENT INSTEAD OF THE REASONING.
    // It read: "an empty set — and every assertion built on it would otherwise be skipped
    // rather than failed." Guard-proof (iv) pointed the index name at nothing and reds 3;
    // guard-proof (iv-b) did the same WITH THIS LINE DELETED and reds the same 3. The
    // downstream assertions all dereference rows[0], so an empty set fails either way —
    // this line changes an obscure TypeError into a named failure, which is worth having
    // and is not what a non-vacuity floor usually buys.
    // ⚠ KEEP IT ANYWAY, for the case the measurement does NOT cover: an assertion added
    // later that reads the set rather than a row (a count, a filter, an .every()) WOULD
    // pass vacuously on an empty result, and this line is what stops that one.
    assert.equal(rows.length, 1, 'idx_cra_owner_assigned must exist — an empty set is not a pass');
    return rows[0].indexdef;
  };

  it('the index exists on client_rep_assignments', async () => {
    const def = await indexDef();
    assert.match(def, /client_rep_assignments/);
  });

  it('⚠ its COALESCE argument order matches OWN_BOOK_PREDICATE\'s — swap them and it is never used', async () => {
    // ⚠ BOTH SIDES ARE DERIVED, NEITHER IS TYPED. The left side is the index Postgres
    // actually built; the right side is the predicate the rep routes actually run. A fence
    // with the expected order written into it would agree with itself on the day it was
    // written and stop agreeing the first time either side moved — which is the same
    // hand-maintained-copy failure the index itself is exposed to.
    //
    // ⚠ WHY IT MATTERS, from idx_cra_contractor_owner's own header: Postgres matches an
    // indexed expression against a predicate's expression TEXTUALLY. Swap the two columns
    // and the index still builds,
    // still looks right, and is silently never used — a performance defect with no symptom.
    const fromIndex = coalesceArgs(await indexDef(), 'the built index');
    const fromPredicate = coalesceArgs(OWN_BOOK_PREDICATE, 'OWN_BOOK_PREDICATE');

    assert.deepEqual(fromIndex, fromPredicate);
    // Stated explicitly as well as compared, so a reader of a failure knows which order is
    // correct without going to look it up.
    assert.deepEqual(fromIndex, ['sticky_rep_id', 'provisional_rep_id']);
  });

  it('⚠ it carries BOTH sort keys, descending — the ORDER BY #15 needs', async () => {
    // ⚠ BOTH OR NEITHER. After #15 the clients list is
    // `ORDER BY assigned_at DESC, jobber_client_id DESC` with a keyset on the same pair. If
    // only the first key is indexed, the ORDER BY is satisfied by a sort over the matched
    // rows instead of by the index — which is exactly the state idx_cra_contractor_owner is
    // in today, since it omits jobber_client_id entirely.
    const def = await indexDef();
    assert.match(def, /assigned_at\s+DESC/i, 'assigned_at must be indexed descending');
    assert.match(def, /jobber_client_id\s+DESC/i, 'and jobber_client_id must be too');
    assert.ok(def.indexOf('assigned_at') < def.indexOf('jobber_client_id'),
      'assigned_at must be the EARLIER key — reversed, the index cannot serve the ORDER BY');
  });

  it('⚠ idx_cra_contractor_owner is KEPT — Danny, Q4', async () => {
    // Danny ruled (Q4, 2026-09-28) that the older index stays: it still serves the clients
    // count query, which has no ORDER BY and uses its first two keys. Dropping it would be
    // destructive DDL on a live table for a write-amplification saving on a small one.
    // ⚠ This is a fence against a future "tidy-up", not an assertion about performance.
    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'client_rep_assignments' AND indexname = 'idx_cra_contractor_owner'`
    );
    assert.equal(rows.length, 1, 'idx_cra_contractor_owner must still exist');
  });
});
