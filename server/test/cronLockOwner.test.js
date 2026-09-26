'use strict';

// ── CRON LOCK OWNERSHIP (3d Phase 1a Commit 7a-3) ───────────────────────────
//
// withLock had two halves of one defect, and the second made the lock worse than none:
//   1. pipeline_sync's expiry was 10 minutes against a 30-minute tick, so a sweep still running
//      at T+10 had a takeable lock and the T+30 tick started a SECOND sweep alongside it.
//   2. The release cleared the row by job_name ALONE, so the first sweep then cleared a lock the
//      second was holding — and the cycle repeated, one extra concurrent sweep at a time.
//
// ⚠ THESE CASES DRIVE THE REAL withLock AGAINST THE REAL cron_job_locks ROW. A lock cannot be
// tested by calling it once: a single caller is serialised by definition. Each case below overlaps
// two runs, or forges a takeover, and asserts what the ROW says afterwards.
//
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { withLock } = require('../cron/withLock');

// A job name of its own, so these cases never race a real seeded job's row.
const JOB = 'test_lock_owner';

let pool;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lockRow = async () => (await pool.query(
  `SELECT is_locked, locked_by, timeout_at FROM cron_job_locks WHERE job_name = $1`, [JOB]
)).rows[0];

before(async () => { pool = await initTestDb(); });
after(async () => {
  await pool.query(`DELETE FROM cron_job_locks WHERE job_name = $1`, [JOB]);
  await pool.end();
});

beforeEach(async () => {
  await pool.query(`DELETE FROM cron_job_locks WHERE job_name = $1`, [JOB]);
  await pool.query(`INSERT INTO cron_job_locks (job_name) VALUES ($1)`, [JOB]);
  await pool.query(`DELETE FROM error_log WHERE source LIKE $1`, [`cron:${JOB}%`]);
});

// ═════════════════════════════════════════════════════════════════════════════
describe('7a-3 — a long-running job is not joined by a second', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('a second run while the first holds the lock is SKIPPED, not started', async () => {
    let firstRan = 0, secondRan = 0;
    const first = withLock(JOB, 25, async () => { firstRan += 1; await sleep(300); });
    await sleep(50);
    await withLock(JOB, 25, async () => { secondRan += 1; });
    await first;

    assert.equal(firstRan, 1);
    assert.equal(secondRan, 0, 'the second run must not execute its body while the first holds');
  });

  it('PAIRED POSITIVE — once the first finishes, a second DOES run', async () => {
    // Without this, "the second is skipped" would also pass against a lock nobody can ever take.
    let ran = 0;
    await withLock(JOB, 25, async () => { ran += 1; });
    await withLock(JOB, 25, async () => { ran += 1; });
    assert.equal(ran, 2, 'the lock releases and the next run proceeds');
  });

  it('the lock is released and the owner cleared after a clean run', async () => {
    await withLock(JOB, 25, async () => { /* work */ });
    const row = await lockRow();
    assert.equal(row.is_locked, false);
    assert.equal(row.locked_by, null, 'the owner token is cleared with the lock');
    assert.equal(row.timeout_at, null);
  });

  it('a THROWING job still releases — the catch must not strand the lock', async () => {
    await withLock(JOB, 25, async () => { throw new Error('boom'); });
    const row = await lockRow();
    assert.equal(row.is_locked, false, 'withLock swallows the error and still releases');
  });

  it('an EXPIRED lock is takeable — that is the recovery path, not a bug', async () => {
    // A crashed holder must not block forever. Expiry in the past = takeable.
    await pool.query(
      `UPDATE cron_job_locks SET is_locked = TRUE, locked_by = 'dead-holder',
              locked_at = NOW() - INTERVAL '1 hour', timeout_at = NOW() - INTERVAL '30 minutes'
        WHERE job_name = $1`, [JOB]
    );
    let ran = 0;
    await withLock(JOB, 25, async () => { ran += 1; });
    assert.equal(ran, 1, 'a stale lock is recovered by the next tick');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('7a-3 — a run that lost its lock releases NOTHING', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('the original holder cannot clear a lock that was taken over', async () => {
    // ⚠ THIS IS THE DEFECT, REPRODUCED AS A TEST. The original holder overruns its expiry, a
    // second run legitimately takes the lock, and the first then finishes. Before 7a-3 its
    // unconditional release cleared the row and the SECOND run was left holding nothing — so a
    // third run could start alongside it, and a fourth alongside that.
    let takeoverOwner = null;

    // The overrunning holder: a 1-second expiry it will exceed.
    const overrunner = withLock(JOB, 0, async () => {
      // Force the expiry into the past while this run is still working — the same state a real
      // sweep reaches when it runs past its timeout.
      await pool.query(
        `UPDATE cron_job_locks SET timeout_at = NOW() - INTERVAL '1 minute' WHERE job_name = $1`,
        [JOB]
      );
      // A second run now takes it over, exactly as the next cron tick would.
      await pool.query(
        `UPDATE cron_job_locks SET is_locked = TRUE, locked_by = 'second-run',
                locked_at = NOW(), timeout_at = NOW() + INTERVAL '25 minutes'
          WHERE job_name = $1 AND (is_locked = FALSE OR timeout_at < NOW())`,
        [JOB]
      );
      takeoverOwner = (await lockRow()).locked_by;
      await sleep(20);
    });
    await overrunner;

    assert.equal(takeoverOwner, 'second-run', 'precondition: the takeover happened');

    const row = await lockRow();
    assert.equal(row.locked_by, 'second-run',
      'the overrunning run must NOT have cleared the new owner — that is the whole fix');
    assert.equal(row.is_locked, true, 'and the lock is still held by the run that owns it');
  });

  it('an overrun is LOGGED, so a too-short expiry is observable', async () => {
    // ⚠ WITHOUT THIS THE FIX IS SILENT. An overrun releasing nothing is correct behaviour, but a
    // correct behaviour nobody can see is how a 10-minute expiry survived on a 30-minute tick.
    // The error_log row is the only signal that the expiry is too short for the real work.
    await withLock(JOB, 0, async () => {
      await pool.query(
        `UPDATE cron_job_locks SET is_locked = TRUE, locked_by = 'someone-else',
                timeout_at = NOW() + INTERVAL '25 minutes' WHERE job_name = $1`, [JOB]
      );
    });
    const { rows } = await pool.query(
      `SELECT source FROM error_log WHERE source = $1`, [`cron:${JOB} — lock overrun`]
    );
    assert.ok(rows.length >= 1, 'an overrun writes one row naming the job');
  });

  it('the release is owner-scoped in SOURCE, not only in effect', () => {
    // The behavioural cases above depend on two runs interleaving; this pins the mechanism so a
    // refactor cannot drop the predicate and pass by timing.
    const src = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'cron', 'withLock.js'), 'utf8');
    assert.match(src, /locked_by = \$2/, 'the release must be scoped to the owner token');
    assert.match(src, /locked_by = \$3/, 'and the acquire must write one');
  });

  it('pipeline_sync\'s expiry exceeds its own tick interval risk — 25 minutes, not 10', () => {
    // ⚠ PINNED BECAUSE THE NUMBER IS THE HALF A READER WILL "TIDY". 10 minutes on a 30-minute tick
    // guarantees a takeable lock for 20 minutes of every cycle. Anything at or above the tick makes
    // a crashed holder block a whole extra cycle. 25 is the value between those two failures.
    const src = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'cron', 'jobs', 'pipelineSync.js'), 'utf8');
    const m = src.match(/withLock\('pipeline_sync',\s*(\d+)/);
    assert.ok(m, 'pipeline_sync must take a lock');
    const minutes = parseInt(m[1], 10);
    assert.ok(minutes > 10, `expiry must exceed the old 10 minutes, got ${minutes}`);
    assert.ok(minutes < 30, `expiry must stay under the 30-minute tick so a dead holder self-heals, got ${minutes}`);
  });
});
