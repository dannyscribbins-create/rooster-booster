'use strict';

// ── assigned_at BECOMES NOT NULL, BEHIND A GATE (3d Phase 1b Commit 4) ──────
//
// Danny's ruling (2026-09-28): `SET NOT NULL` must NEVER be able to stop the service from
// booting. Count the NULLs first; if any exist, alert LOUDLY, SKIP the constraint, and let
// boot continue. Only apply it when the count is zero.
//
// ⚠ WHY A SKIP HAS TO BE LOUD. An initDB() throw on this service is quieter than it looks —
// server.js catches it and carries on with app.listen() outside, so the app serves and
// **startCronJobs() never runs**. Replacing the throw with a silent skip would be worse
// still: app serves, crons run, column stays nullable, nothing anywhere looks different.
// The alert is the only thing that can say so, which is why its assertion here sits beside
// the other two rather than being treated as a detail.
//
// ── HOW THE NULL FIXTURE IS PRODUCED, STATED PLAINLY BECAUSE IT CANNOT BE OBVIOUS ───────
// By the time any test runs, initTestDb() has already run initDB(), which has already
// applied the constraint — so `assigned_at` IS NOT NULL and **a NULL row cannot simply be
// inserted**. That is the whole point of Commit 1's third COALESCE arm: an ordinary row can
// no longer end up NULL.
//
// So the fixture puts the schema back to its pre-Commit-4 shape first:
//   1. ALTER COLUMN assigned_at DROP NOT NULL   (the state the gate is written for)
//   2. INSERT a row with assigned_at explicitly NULL
//   3. ⚠ PROVE THE NULL IS THERE — read the count back and assert it, BEFORE calling the
//      gate. Without step 3 a fixture that silently failed to produce the state would make
//      "the constraint was not applied" pass for the wrong reason, which is a guard-proof
//      that cannot fail wearing a fixture.
//   4. call the gate, assert all three properties together
//   5. restore the constraint, in a finally AND in an after() hook
//
// ⚠ THIS SUITE MUTATES THE SHARED SCHEMA, WHICH NOTHING ELSE HERE DOES. `npm test` runs
// server files with --test-concurrency=1 and node:test runs cases in a file serially, so no
// other suite can observe the window — but the restore is doubled (per-test finally, plus
// after()) because a half-restored schema would surface as unrelated suites failing on
// inserts, which is a long way from the cause.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { applyAssignedAtNotNull } = require('../db');

const TENANT = 'aa-notnull';

let pool;

const isNullable = async () => {
  const { rows } = await pool.query(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'client_rep_assignments' AND column_name = 'assigned_at'`
  );
  assert.equal(rows.length, 1, 'harness: the column must exist for any of this to mean anything');
  return rows[0].is_nullable === 'YES';
};

const dropNotNull = () => pool.query('ALTER TABLE client_rep_assignments ALTER COLUMN assigned_at DROP NOT NULL');
const restoreNotNull = async () => {
  await pool.query(`DELETE FROM client_rep_assignments WHERE assigned_at IS NULL`);
  await pool.query('ALTER TABLE client_rep_assignments ALTER COLUMN assigned_at SET NOT NULL');
};

const nullCount = async () => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM client_rep_assignments WHERE assigned_at IS NULL');
  return rows[0].n;
};

// Inserts a row whose assigned_at is explicitly NULL. Only possible while the constraint
// is dropped — which is exactly why the fixture drops it first.
const seedNullRow = async (clientId) => {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at, assigned_at)
     VALUES ($1, $2, NULL, 'manual', NOW(), NOW(), NULL)`,
    [TENANT, clientId]
  );
};

// Collects what the gate alerts with, instead of writing to error_log.
const spyLogger = () => {
  const calls = [];
  return { calls, logError: async (payload) => { calls.push(payload); } };
};

before(async () => { pool = await initTestDb(); });

after(async () => {
  // ⚠ BELT AND BRACES. A suite that left the column nullable would surface as unrelated
  // suites failing on inserts, a long way from the cause.
  try { await restoreNotNull(); } catch { /* already constrained */ }
  await pool.end();
});

beforeEach(async () => {
  await pool.query('DELETE FROM client_rep_assignments WHERE contractor_id = $1', [TENANT]);
});

// ═══════════════════════════════════════════════════════════════════════════
describe('assigned_at SET NOT NULL — the gate', () => {

  it('⚠ WITH A NULL ROW: boot COMPLETES, the alert is logged, AND the constraint is NOT applied', async () => {
    // ⚠ ALL THREE TOGETHER. Any two of them are satisfied by something that is not the
    // behaviour: "boot completed" alone is satisfied by a gate that does nothing at all,
    // and "the constraint was not applied" alone is satisfied by a fixture that never
    // produced a NULL. The third assertion below — that the NULL really was there when the
    // gate ran — is what stops that last one.
    const spy = spyLogger();
    await dropNotNull();
    try {
      await seedNullRow('c-null-1');
      await seedNullRow('c-null-2');

      // ⚠ THE FIXTURE IS PROVEN BEFORE THE GATE IS CALLED, NOT INFERRED FROM ITS RESULT.
      assert.equal(await isNullable(), true, 'precondition: the column is nullable again');
      assert.equal(await nullCount(), 2, 'precondition: TWO rows really carry a NULL assigned_at');

      const result = await applyAssignedAtNotNull(pool, { logError: spy.logError });

      // (1) BOOT COMPLETES — the call returned rather than throwing, and says why.
      assert.equal(result.applied, false);
      assert.equal(result.reason, 'nulls-present');
      assert.equal(result.nullCount, 2);

      // (2) THE ALERT IS LOGGED, WITH ALERT ENABLED.
      assert.equal(spy.calls.length, 1, 'exactly one alert');
      const call = spy.calls[0];
      assert.equal(call.alert, true, '⚠ alert must be ENABLED — a silent skip is worse than the throw');
      assert.match(call.source, /assigned_at SET NOT NULL/);
      // It must name the COUNT and a SAMPLE of client ids, or the operator goes to SQL.
      assert.match(call.error.message, /\b2 row\(s\)/, 'the message names the count');
      assert.match(call.error.message, /c-null-1/, 'and a sample of jobber_client_ids');
      assert.match(call.error.message, /c-null-2/);

      // (3) THE CONSTRAINT IS NOT APPLIED.
      assert.equal(await isNullable(), true, 'the column must still be nullable');
    } finally {
      await restoreNotNull();
    }
  });

  it('⚠ WITH ZERO NULL ROWS: the constraint IS applied — the paired positive', async () => {
    // Without this, "the constraint was not applied" above is satisfied by a gate that
    // never applies it under any circumstances.
    await dropNotNull();
    try {
      assert.equal(await isNullable(), true, 'precondition: nullable');
      assert.equal(await nullCount(), 0, 'precondition: and nothing is NULL');

      const spy = spyLogger();
      const result = await applyAssignedAtNotNull(pool, { logError: spy.logError });

      assert.equal(result.applied, true);
      assert.equal(result.reason, 'applied');
      assert.equal(await isNullable(), false, 'the column is now NOT NULL');
      assert.equal(spy.calls.length, 0, 'and nothing was alerted about');
    } finally {
      await restoreNotNull();
    }
  });

  it('is a no-op once applied, and does NOT take the lock again', async () => {
    // SET NOT NULL is idempotent in Postgres, so this is about the ACCESS EXCLUSIVE lock
    // rather than about correctness — the gate reads the catalog and returns early.
    assert.equal(await isNullable(), false, 'precondition: initDB already applied it');
    const spy = spyLogger();
    const result = await applyAssignedAtNotNull(pool, { logError: spy.logError });
    assert.equal(result.reason, 'already-applied');
    assert.equal(result.applied, false, 'it did not apply it AGAIN');
    assert.equal(spy.calls.length, 0);
  });

  it('⚠ NEVER THROWS, even when the query layer fails — and it ALERTS rather than swallowing', async () => {
    // "Never stop the boot" has to survive a lock timeout or a permissions error too. But a
    // catch that swallowed would be a mechanism reporting health it never observed, so the
    // catch alerts. Loud and non-fatal, never quiet and non-fatal.
    const spy = spyLogger();
    const brokenDb = { query: async () => { throw new Error('connection terminated unexpectedly'); } };

    const result = await applyAssignedAtNotNull(brokenDb, { logError: spy.logError });

    assert.equal(result.applied, false);
    assert.equal(result.reason, 'failed');
    assert.match(result.error, /connection terminated/);
    assert.equal(spy.calls.length, 1);
    assert.equal(spy.calls[0].alert, true, 'a failure alerts too');
    assert.match(spy.calls[0].error.message, /boot continued/);
  });

  it('⚠ does not fail even if its own alerting throws', async () => {
    // The last thing that must not take the boot down is the thing reporting that
    // something already went wrong.
    const brokenDb = { query: async () => { throw new Error('db gone'); } };
    const brokenLogger = async () => { throw new Error('error_log unreachable'); };

    const result = await applyAssignedAtNotNull(brokenDb, { logError: brokenLogger });
    assert.equal(result.reason, 'failed');
  });

  it('caps the sample it names, and prints the total beside it', async () => {
    // ⚠ A TRUNCATED LIST WITH NO TOTAL READS EXACTLY LIKE A COMPLETE ONE — the same reason
    // the rebuild's kept-rows log prints both (Q8).
    const spy = spyLogger();
    await dropNotNull();
    try {
      for (let i = 0; i < 25; i += 1) await seedNullRow(`c-many-${String(i).padStart(2, '0')}`);
      assert.equal(await nullCount(), 25, 'precondition: 25 NULL rows');

      const result = await applyAssignedAtNotNull(pool, { logError: spy.logError });

      assert.equal(result.nullCount, 25, 'the TOTAL is the real total');
      assert.equal(result.sample.length, 20, 'the sample is capped');
      assert.match(spy.calls[0].error.message, /Showing 20 of 25/,
        'and the message says it is a sample');
    } finally {
      await restoreNotNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('assigned_at SET NOT NULL — the constraint, in the schema initDB produced', () => {

  it('the column is NOT NULL after a normal boot', async () => {
    assert.equal(await isNullable(), false);
  });

  it('⚠ and still has NO default — Q2 survives the constraint', async () => {
    // A NOT NULL column with a default would silently stamp the clock for any writer that
    // forgot the date, which is R5's defect. NOT NULL plus NO default is what makes that
    // writer fail loudly instead.
    const { rows } = await pool.query(
      `SELECT column_default FROM information_schema.columns
        WHERE table_name = 'client_rep_assignments' AND column_name = 'assigned_at'`
    );
    assert.equal(rows[0].column_default, null);
  });

  it('⚠ an INSERT omitting assigned_at now FAILS — the consequence, asserted', async () => {
    // This is what forced ~20 fixtures across 9 files to supply a date in this commit. It
    // is Q2 working rather than collateral damage: a fixture is a writer.
    await assert.rejects(
      () => pool.query(
        `INSERT INTO client_rep_assignments (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, updated_at)
         VALUES ($1, 'c-no-date', NULL, 'manual', NOW())`,
        [TENANT]
      ),
      /assigned_at/
    );
  });
});
