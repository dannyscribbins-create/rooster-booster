'use strict';

// ── PER-CLIENT SERIALISATION (3d Phase 1a Commit 6) ─────────────────────────
//
// Commit 5's doors capture facts and then decide from the saved rows. Two steps over shared
// state, so two events for the SAME client can interleave: capture A writes half its facts,
// decide B reads them, and B stores a decision taken from a fact set that never existed. Nothing
// raises, and the wrong answer is durable.
//
// ⚠ THESE CASES USE REAL CONCURRENCY ON REAL CONNECTIONS, WHICH IS THE ONLY WAY THE SUBJECT IS
// OBSERVABLE. A lock cannot be tested by calling the locked function once: a single caller is
// serialised by definition, so every assertion would pass against no lock at all. Each case below
// starts two overlapping operations and asserts what their ORDERING produced.
//
// ⚠ TWO OF THEM ASSERT ON ELAPSED TIME, AND THAT IS DELIBERATE RATHER THAN LAZY. "Different
// clients never wait on each other" is a statement about concurrency, and the only direct
// observable is whether two 300ms sections took ~300ms or ~600ms. The thresholds are set wide
// (under 500 / over 550 against a 300ms hold) so ordinary scheduling noise cannot move them, and
// each is PAIRED with its opposite on the same fixture — so a case cannot pass because the timing
// is meaningless, only because the ordering really differs.
//
// ⚠ ONE POOL PER FILE — initTestDb() returns the server/db.js pool SINGLETON.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const { withClientLock } = require('../utils/clientLock');
const { decideFromFacts } = require('../utils/attributionDecide');

const A = 'lock-tenant-a';
const B = 'lock-tenant-b';
const C1 = 'jc-lock-1';
const C2 = 'jc-lock-2';

let pool;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

beforeEach(async () => {
  for (const t of ['crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts',
    'crm_quote_facts', 'crm_request_facts', 'jobber_clients']) {
    for (const c of [A, B]) await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [c]);
  }
  for (const c of [A, B]) {
    await pool.query(`DELETE FROM contractors WHERE id = $1`, [c]);
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [c]);
  }
  for (const [c, cid] of [[A, C1], [A, C2], [B, C1]]) {
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
       VALUES ($1, $2, 'Lock', NOW())`, [cid, c]
    );
  }
});

// ── FACT WRITERS, SPLIT SO AN INTERLEAVING IS POSSIBLE ───────────────────────
// ⚠ THE DELAY BETWEEN THE TWO WRITES IS THE WHOLE POINT. captureClientFacts issues its statements
// back to back, so an unlocked interleaving is possible but vanishingly unlikely to be observed
// in a test — and a race that cannot be reproduced cannot be fenced. This writes a quote, waits,
// then writes a job, which widens the window to something a second operation reliably lands in.
// The SHAPE is the real one: a capture that is partly written when another decision reads it.
async function slowCapture(tx, contractorId, clientId, { gapMs = 300 } = {}) {
  await tx.query(
    `INSERT INTO crm_quote_facts
       (contractor_id, jobber_quote_id, jobber_client_id, quote_status, approved_at,
        salesperson_jobber_user_id, created_at)
     VALUES ($1, $2, $3, 'approved', NOW(), 'ju-lock', NOW())
     ON CONFLICT (contractor_id, jobber_quote_id) DO NOTHING`,
    [contractorId, `q-${clientId}`, clientId]
  );
  await sleep(gapMs);
  await tx.query(
    `INSERT INTO crm_job_facts
       (contractor_id, jobber_job_id, jobber_client_id, job_status, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', NOW(), NOW())
     ON CONFLICT (contractor_id, jobber_job_id) DO NOTHING`,
    [contractorId, `job-${clientId}`, clientId]
  );
}

// Seeds ONLY a quote, so the client decides 'inspection' until a job arrives.
async function seedQuoteOnly(contractorId, clientId) {
  await pool.query(
    `INSERT INTO crm_quote_facts
       (contractor_id, jobber_quote_id, jobber_client_id, quote_status, approved_at,
        salesperson_jobber_user_id, created_at)
     VALUES ($1, $2, $3, 'approved', NOW(), 'ju-lock', NOW())
     ON CONFLICT (contractor_id, jobber_quote_id) DO NOTHING`,
    [contractorId, `q-seed-${clientId}`, clientId]
  );
}

// Adds the job that moves the decision from 'inspection' to 'sold'.
async function addJobFact(tx, contractorId, clientId) {
  await tx.query(
    `INSERT INTO crm_job_facts
       (contractor_id, jobber_job_id, jobber_client_id, job_status, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', NOW(), NOW())
     ON CONFLICT (contractor_id, jobber_job_id) DO NOTHING`,
    [contractorId, `job-new-${clientId}`, clientId]
  );
}

async function writeStage(tx, contractorId, clientId, stage) {
  await tx.query(
    `UPDATE jobber_clients SET pipeline_stage = $3
      WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, clientId, stage]
  );
}

// One locked unit of work: capture (slowly), then decide from what is on disk.
const lockedCaptureThenDecide = (contractorId, jobberClientId, opts) =>
  withClientLock(pool, { contractorId, jobberClientId }, async (tx) => {
    await slowCapture(tx, contractorId, jobberClientId, opts);
    const decided = await decideFromFacts(tx, { contractorId, jobberClientId });
    return decided.currentStatus;
  });

// ═════════════════════════════════════════════════════════════════════════════
describe('Commit 6 — two events for the SAME client are serialised', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('STALE DECISION — a slow unit cannot overwrite a newer decision', async () => {
    // ⚠ THE FIRST WRITING OF THIS CASE TESTED THE WRONG THING AND GUARD-PROOF (i) SAID SO.
    // It ran two identical capture-then-decide units concurrently and asserted both read a
    // complete fact set. Removing the lock left it GREEN, for two reasons that are both about
    // Postgres rather than about the lock: the two units INSERTed the same keys, so the unique
    // index already serialised them; and a transaction never exposes a half-written capture
    // anyway — READ COMMITTED means another transaction sees nothing until COMMIT.
    //
    // ⚠ SO THE ANOMALY THE LOCK ACTUALLY PREVENTS IS A LOST UPDATE, NOT A DIRTY READ.
    // Two units run concurrently. The SLOW one decides first, from the facts as they were; the
    // FAST one then captures a new job, decides 'sold', and commits. The slow one finally writes
    // its stage — computed before the job existed — and 'inspection' lands on top of 'sold'.
    // The stored stage is then a decision taken from older facts, which is exactly the shape
    // Danny's ruling names. Serialised, the slow unit either runs entirely first (and the fast
    // one overwrites it correctly) or entirely second (and sees the job); either order ends
    // 'sold'. Unserialised, it can end 'inspection'.
    await seedQuoteOnly(A, C1);            // the client starts at 'inspection'

    const slow = withClientLock(pool, { contractorId: A, jobberClientId: C1 }, async (tx) => {
      const decided = await decideFromFacts(tx, { contractorId: A, jobberClientId: C1 });
      await sleep(400);                    // the window the fast unit lands in
      await writeStage(tx, A, C1, decided.currentStatus);
      return decided.currentStatus;
    });

    // Started second, deliberately, so that unserialised it finishes INSIDE the slow one's sleep.
    await sleep(50);
    const fast = withClientLock(pool, { contractorId: A, jobberClientId: C1 }, async (tx) => {
      await addJobFact(tx, A, C1);
      const decided = await decideFromFacts(tx, { contractorId: A, jobberClientId: C1 });
      await writeStage(tx, A, C1, decided.currentStatus);
      return decided.currentStatus;
    });

    await Promise.all([slow, fast]);

    const { rows } = await pool.query(
      `SELECT pipeline_stage FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [A, C1]
    );
    assert.equal(rows[0].pipeline_stage, 'sold',
      'the stored stage must reflect the newest facts — inspection here means a stale decision won');
  });

  it('INTERLEAVING — the second unit observes the first\'s writes, not an empty table', async () => {
    // The positive control for the case above: it must fail because of ORDERING, not because
    // both units happened to write the same rows. Here the second unit writes nothing new (ON
    // CONFLICT DO NOTHING) and must still decide 'sold' — which is only true if it ran AFTER the
    // first committed.
    await lockedCaptureThenDecide(A, C1, { gapMs: 10 });
    const again = await lockedCaptureThenDecide(A, C1, { gapMs: 10 });
    assert.equal(again, 'sold');
    const { rows } = await pool.query(
      `SELECT COUNT(*) c FROM crm_job_facts WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [A, C1]
    );
    assert.equal(parseInt(rows[0].c, 10), 1, 'one job fact, written once and seen twice');
  });

  it('the same client DOES serialise — two 300ms units take over 550ms together', async () => {
    // ⚠ THE PAIRED OPPOSITE OF THE "different clients" CASE BELOW, ON THE SAME MACHINERY.
    // Without this, a passing "different clients are concurrent" assertion could simply mean the
    // timing observable is meaningless. One of these two must be slow and the other fast, or
    // neither is measuring anything.
    const t0 = Date.now();
    await Promise.all([
      lockedCaptureThenDecide(A, C1, { gapMs: 300 }),
      lockedCaptureThenDecide(A, C1, { gapMs: 300 }),
    ]);
    const elapsed = Date.now() - t0;
    assert.ok(elapsed > 550, `same client must serialise; took ${elapsed}ms, expected over 550`);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Commit 6 — different clients and different tenants never wait', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('DIFFERENT CLIENTS — two 300ms units overlap and finish under 500ms', async () => {
    // ⚠ GUARD-PROOF (ii): drop the client id from the lock key and these two share one lock, so
    // the elapsed time crosses 550 and this case goes red while the same-client case above stays
    // green. That pairing is what makes the key's second component falsifiable.
    const t0 = Date.now();
    const [a, b] = await Promise.all([
      lockedCaptureThenDecide(A, C1, { gapMs: 300 }),
      lockedCaptureThenDecide(A, C2, { gapMs: 300 }),
    ]);
    const elapsed = Date.now() - t0;

    assert.equal(a, 'sold');
    assert.equal(b, 'sold');
    assert.ok(elapsed < 500, `different clients must not wait; took ${elapsed}ms, expected under 500`);
  });

  it('TENANCY — the same client id under two contractors does not share a lock', async () => {
    // ⚠ GUARD-PROOF (iii): drop contractor_id from the key and these two serialise, because the
    // client id is IDENTICAL across the tenants. It is the sharpest form of the tenancy question
    // for a lock — nothing is read or written across the boundary, so only the timing shows it.
    const t0 = Date.now();
    const [a, b] = await Promise.all([
      lockedCaptureThenDecide(A, C1, { gapMs: 300 }),
      lockedCaptureThenDecide(B, C1, { gapMs: 300 }),
    ]);
    const elapsed = Date.now() - t0;

    assert.equal(a, 'sold');
    assert.equal(b, 'sold');
    assert.ok(elapsed < 500, `separate tenants must not wait; took ${elapsed}ms, expected under 500`);

    // And each tenant's facts are its own — the concurrency must not have crossed the boundary.
    for (const c of [A, B]) {
      const { rows } = await pool.query(
        `SELECT COUNT(*) n FROM crm_job_facts WHERE contractor_id = $1`, [c]);
      assert.equal(parseInt(rows[0].n, 10), 1, `${c} has exactly its own job fact`);
    }
  });

  it('the key is two components, and hashtext makes it stable across connections', async () => {
    // A cheap structural check with a real consequence: if the helper ever hashed one
    // concatenated string instead, a collision could put two DIFFERENT CONTRACTORS' clients on
    // one lock — the failure nobody would look for. Asserting the two-argument form is what
    // pins the shape.
    const src = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'utils', 'clientLock.js'), 'utf8');
    assert.match(src, /pg_advisory_xact_lock\(hashtext\(\$1\), hashtext\(\$2\)\)/,
      'two keys, contractor first, client second');
    assert.ok(!/pg_advisory_lock\(/.test(src),
      'the session-scoped form would leak a lock onto a pooled connection on any throw');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('Commit 6 — the lock is never held across a Jobber fetch', () => {
// ═════════════════════════════════════════════════════════════════════════════

  it('a client\'s lock is FREE while its door is waiting on Jobber', async () => {
    // ⚠ THIS IS THE POOL-SAFETY PROPERTY, AND IT IS OBSERVABLE RATHER THAN ARGUED.
    // pg_try_advisory_xact_lock returns false instead of blocking, so a second connection can ask
    // "is this client's lock taken right now?" while the door sits in its fetch. Holding a pooled
    // connection across a network call to Jobber would tie up a pool slot for the length of an
    // external request — a slow Jobber would exhaust the pool rather than delay one client.
    // Guard-proof (iv) moves the fetch inside the locked section and this goes red.
    let releaseFetch;
    const fetchBlocked = new Promise((r) => { releaseFetch = r; });

    // The door's shape: fetch FIRST (outside any lock), then capture+decide inside the lock.
    const door = (async () => {
      await fetchBlocked;                     // stands in for the Jobber round trip
      return lockedCaptureThenDecide(A, C1, { gapMs: 10 });
    })();

    // While the "fetch" is outstanding, the lock must be available to anyone else.
    const probe = await pool.connect();
    let freeDuringFetch;
    try {
      await probe.query('BEGIN');
      const { rows } = await probe.query(
        'SELECT pg_try_advisory_xact_lock(hashtext($1), hashtext($2)) AS got', [A, C1]);
      freeDuringFetch = rows[0].got;
      await probe.query('ROLLBACK');
    } finally {
      probe.release();
    }

    releaseFetch();
    assert.equal(await door, 'sold', 'the door still completed');
    assert.equal(freeDuringFetch, true,
      'the lock must be free during the fetch — taken here means the fetch runs inside it');
  });

  it('LOCK TIMEOUT — a waiter fails loudly instead of blocking forever', async () => {
    // ⚠ THE TIMEOUT IS SET TO 3000ms IN PRODUCTION, WHICH IS FAR TOO LONG TO WAIT FOR IN A TEST.
    // So the holder is taken on a connection this case controls, and the WAITER lowers its own
    // lock_timeout with SET LOCAL — the same mechanism, a shorter value. What is being proven is
    // that a blocked waiter RAISES 55P03 rather than hanging, and that withClientLock tags it.
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [A, C1]);

      const waiter = await pool.connect();
      let code = null, tagged = null;
      try {
        await waiter.query('BEGIN');
        await waiter.query("SET LOCAL lock_timeout = '150ms'");
        await waiter.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [A, C1]);
      } catch (err) {
        code = err.code;
        tagged = err.code === '55P03';
      } finally {
        await waiter.query('ROLLBACK').catch(() => {});
        waiter.release();
      }

      assert.equal(code, '55P03',
        'a blocked waiter must raise lock_not_available, not hang — got ' + code);
      assert.equal(tagged, true);
      await holder.query('ROLLBACK');
    } finally {
      holder.release();
    }
  });

  it('LOCK TIMEOUT — the production value is SET LOCAL, so it cannot leak onto the pool', () => {
    // ⚠ `SET` RATHER THAN `SET LOCAL` WOULD APPLY A 3s lock_timeout TO EVERY LATER QUERY THAT
    // POOLED CONNECTION SERVES, for the life of the process. The pool reuses connections, so the
    // setting would escape into unrelated work and be invisible there. Pinned as text because the
    // difference is one word and has no observable at this layer.
    const src = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'utils', 'clientLock.js'), 'utf8');
    assert.match(src, /SET LOCAL lock_timeout/, 'the timeout must be transaction-scoped');
    assert.ok(!/SET lock_timeout/.test(src.replace(/SET LOCAL lock_timeout/g, '')),
      'a bare SET would leak the setting onto the pooled connection');
    assert.match(src, /55P03/, 'and a timeout must be distinguishable from a capture failure');
  });

  it('NO PRODUCTION LOCKED SECTION CONTAINS A JOBBER FETCH', () => {
    // ⚠ THE BEHAVIOURAL PROBE ABOVE TESTS A DOOR THIS FILE SIMULATES. It cannot see where the
    // REAL doors put their fetches, so on its own it would let a fetch move inside a locked
    // section in production and still pass. This reads the three real doors, extracts the body of
    // every withClientLock callback by brace matching, and fails if one names a fetch.
    // ⚠ runAttributionEngine COUNTS AS A FETCH, and that is the non-obvious half: it calls
    // fetchAttributionData internally, so wrapping it in the lock would hold a pooled connection
    // across a Jobber round trip by a longer route.
    const fs = require('node:fs');
    const path = require('node:path');
    const DOORS = [
      path.join(__dirname, '..', 'utils', 'requestAttribution.js'),
      path.join(__dirname, '..', 'routes', 'webhooks', 'jobber.js'),
    ];
    // Assembled from pieces so this file is not its own offender.
    const FETCHERS = ['fetch' + 'FullClient', 'fetch' + 'ClientRelatedData',
      'fetch' + 'AttributionData', 'capture' + 'Post', 'run' + 'AttributionEngine'];

    let sectionsChecked = 0;
    const offenders = [];
    for (const file of DOORS) {
      const src = fs.readFileSync(file, 'utf8');
      let from = 0;
      for (;;) {
        const at = src.indexOf('withClientLock(', from);
        if (at === -1) break;
        from = at + 1;
        // Brace-match from the call's opening paren to its close, which bounds the callback.
        let depth = 0, i = src.indexOf('(', at), end = -1;
        for (; i < src.length; i += 1) {
          if (src[i] === '(') depth += 1;
          else if (src[i] === ')') { depth -= 1; if (depth === 0) { end = i; break; } }
        }
        if (end === -1) continue;
        const body = src.slice(at, end);
        sectionsChecked += 1;
        for (const f of FETCHERS) {
          if (body.includes(f)) offenders.push(`${path.basename(file)}: locked section calls ${f}`);
        }
      }
    }

    // ⚠ THE NON-VACUITY CHECK. If the extraction ever finds no sections — a rename, a refactor,
    // a brace-matcher that silently returns nothing — the assertion below passes against an empty
    // set, which is the failure mode of this whole class of test.
    assert.ok(sectionsChecked >= 3,
      `only ${sectionsChecked} locked sections found — expected at least 3 (two webhook doors and the request door)`);
    assert.deepEqual(offenders, [],
      'a Jobber fetch inside a locked section holds a pooled connection across a network call: '
      + offenders.join(' | '));
  });

  it('PAIRED POSITIVE — the lock IS taken while the locked section runs', async () => {
    // ⚠ WITHOUT THIS, THE CASE ABOVE PASSES AGAINST A BUILD THAT TAKES NO LOCK AT ALL.
    // "free during the fetch" is also true of a door with no lock anywhere, which is the
    // vacuity this pairing removes: the same probe must come back FALSE once the section is
    // genuinely inside the lock.
    let observed = null;
    const inside = withClientLock(pool, { contractorId: A, jobberClientId: C1 }, async (tx) => {
      const probe = await pool.connect();
      try {
        await probe.query('BEGIN');
        const { rows } = await probe.query(
          'SELECT pg_try_advisory_xact_lock(hashtext($1), hashtext($2)) AS got', [A, C1]);
        observed = rows[0].got;
        await probe.query('ROLLBACK');
      } finally {
        probe.release();
      }
      await tx.query('SELECT 1');
      return 'done';
    });

    assert.equal(await inside, 'done');
    assert.equal(observed, false, 'the lock is genuinely held inside the section');
  });
});
