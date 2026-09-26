'use strict';

// ── PER-CLIENT SERIALISATION (3d Phase 1a Commit 6) ──────────────────────────
//
// Commit 5 made every live door CAPTURE facts and then DECIDE from the saved rows. Those are two
// steps over shared state, so two events for the SAME client can interleave: capture A writes
// half its facts, decide B reads them, and B stores a decision taken from a fact set that never
// existed. Nothing raises, and the wrong answer is durable — the next event finds a stored
// decision and has no reason to look again.
//
// ⚠ IT IS A DATABASE LOCK, NOT AN IN-PROCESS QUEUE, AND THAT IS DANNY'S RULING (2026-09-25).
// Measured the same day: the Railway service `rooster-booster` runs `numReplicas: 1` in
// `us-west2`, in production AND staging, with no per-service override. **One replica today is
// not an argument for an in-process queue**, for three reasons that all hold at one replica:
//   1. `numReplicas` is a dashboard setting. Nothing in this repo pins it — `railway.json`
//      declares only the builder and the start command — so it can change without a commit, and
//      an in-process queue would silently stop serialising the moment it did.
//   2. A ROLLING DEPLOY OVERLAPS EVEN AT ONE REPLICA. The outgoing instance is still serving
//      while the incoming one boots, so two processes handle webhooks for the same contractor
//      during every deploy. That is not an edge case; it is every push.
//   3. A queue lives in memory. A restart mid-queue loses the ordering it was maintaining, and
//      the restart is exactly when a backlog of webhook retries arrives.
// The `getFreshContractorAccessToken` note in server/crm/jobber.js already prescribed this
// pattern — *"if RoofMiles ever runs more than one Railway replica, add
// pg_advisory_xact_lock(hashtext(contractor_id))"* — and this is that, one level finer.
//
// ⚠ TWO KEYS, NOT A CONCATENATED STRING, AND THE SECOND IS WHY DIFFERENT CLIENTS NEVER WAIT.
// `pg_advisory_xact_lock(int4, int4)` is the two-key form: key1 is the contractor, key2 is the
// client. Hashing `contractorId + ':' + jobberClientId` into ONE key would work too, but it
// would put every contractor in one 32-bit space and make a collision cross a tenant boundary —
// two different contractors' clients blocking each other, which is the one failure mode nobody
// would think to look for. Splitting the keys means a collision can only ever be between two
// clients of the SAME contractor: still wrong, still rare, and no longer a tenancy leak.
//
// ⚠ AND THE LOCK DOES NOT COVER THE JOBBER FETCH — DELIBERATELY, PER RULING 5. The fetch happens
// before this helper is called. Holding a pooled connection across a network call to Jobber would
// tie up a pool slot for the length of an external request, and a slow Jobber would exhaust the
// pool rather than merely delay one client. Commit 3's `updated_at` staleness guard is what keeps
// the FACTS correct when two fetches race; this lock only makes write-then-decide atomic.
// ⚠ runAttributionEngine MUST ALSO STAY OUTSIDE IT. The engine calls `fetchAttributionData`,
// which is a Jobber fetch — so wrapping the engine in the lock would reintroduce exactly the
// pool-starvation shape the paragraph above forbids, by a longer route.

// ── HOW LONG THE LOCK IS HELD, MEASURED RATHER THAN ESTIMATED ────────────────
// Measured 2026-09-25 against local Postgres, 7 runs, for a realistic worst case: a FULL page of
// every connection at the new PAGE_SIZE — 20 quotes, 20 jobs, 20 invoices, 20 requests, plus 60
// invoice-to-job links — captured, decided and staged inside one held lock.
//   sorted ms: 7.8  8.8  8.9  9.3  10.5  10.5  15.4     median 9.3, max 15.4
// ⚠ IT IS A LOCAL FIGURE AND RAILWAY WILL BE SLOWER — the app and Postgres are separate services,
// so every statement pays a network hop. Read it as an ORDER (tens of milliseconds), not as a
// budget, and re-measure on Railway before treating any number here as production truth.
// ⚠ THE POOL MARGIN: a hold of this length contends only with another event for the SAME client,
// because contractor_id and jobber_client_id are both in the key. A client receiving a burst of
// webhooks queues on itself for tens of milliseconds each; every other client is unaffected. The
// figure that would matter is a hold measured in SECONDS, and the only way to get one is to put a
// network call inside the lock — which is what the fence in server/test/clientLock.test.js
// forbids, by reading the real doors rather than trusting this comment.

const { logError } = require('../middleware/errorLogger');

/**
 * Runs fn inside a transaction holding a per-client advisory lock.
 * Inputs: a pg Pool, { contractorId, jobberClientId }, and an async fn(tx).
 * Output: whatever fn returns.
 * Throws: whatever fn throws, after rolling back. The lock always releases, because
 *         pg_advisory_xact_lock is bound to the transaction rather than to the session.
 *
 * ⚠ `_xact_` IS LOAD-BEARING. The session-scoped `pg_advisory_lock` would need an explicit
 * unlock, and any throw between lock and unlock would leak it for the life of the pooled
 * connection — which, because the pool REUSES connections, means a leaked lock outlives the
 * request that took it and blocks that client forever. The xact form releases on COMMIT and on
 * ROLLBACK, so there is no path that holds it.
 *
 * ⚠ fn RECEIVES THE TRANSACTION AND MUST USE IT. Passing `pool` to a write inside fn would run
 * that write on a DIFFERENT connection, outside the transaction and outside the lock — it would
 * look serialised and not be. Every db argument inside fn is `tx`.
 */
async function withClientLock(pool, { contractorId, jobberClientId, door = 'unknown' }, fn) {
  if (!contractorId) throw new Error('withClientLock: contractorId is required');
  if (!jobberClientId) throw new Error('withClientLock: jobberClientId is required');

  const tx = await pool.connect();
  // ⚠ STARTED AFTER connect() AND BEFORE BEGIN, SO IT MEASURES THE HOLD AND NOT THE WAIT FOR A
  // POOL SLOT. Those are different problems with different fixes — a long hold means the locked
  // section is doing too much, a long wait means the pool is too small — and one number covering
  // both would hide whichever is not the cause.
  const heldFrom = Date.now();
  // Deferred to the finally: the line must be emitted on the failure path too, or the only
  // measurements ever logged are the ones that went well.
  let lockError = null;
  try {
    await tx.query('BEGIN');
    // ── LOCK TIMEOUT (follow-up to Commit 6) ────────────────────────────────
    //
    // ⚠ WITHOUT THIS A WAITER BLOCKS FOREVER AND HOLDS A POOLED CONNECTION WHILE IT DOES.
    // That is the worse half of the problem: the pool is 10 connections (pg's default, and
    // server/db.js sets no `max`), and `connectionTimeoutMillis` is unset — so a caller waiting
    // for a slot ALSO waits forever. One stuck holder could therefore take the whole pool down
    // with no error anywhere, which is the failure mode this repo files under "reports health it
    // cannot observe".
    //
    // ⚠ 3000ms, AND THE NUMBER IS DERIVED RATHER THAN PICKED. The locked section was measured at
    // median 9.3ms / max 15.4ms locally for a full page of every connection. Railway is slower —
    // app and Postgres are separate services, so each of the section's ~10 statements pays a hop;
    // a pessimistic Railway hold is on the order of 150ms. 3000ms is therefore ~195x the measured
    // median and still ~20 queued events deep at the pessimistic figure, so it cannot fire on
    // legitimate same-client contention. And it is bounded: a pathological wait gives a pool slot
    // back in 3s instead of never.
    // ⚠ RE-DERIVE IT FROM A RAILWAY MEASUREMENT BEFORE TREATING IT AS TUNED. It is a first value
    // computed from a LOCAL number, which is exactly the kind of figure this repo requires a
    // source for — the source is the measurement recorded at the top of this file, and that
    // measurement is local.
    //
    // ⚠ SET LOCAL, NOT SET. It reverts when the transaction ends, so it cannot leak onto the
    // pooled connection and silently apply a 3s lock_timeout to every later query that connection
    // serves. A plain SET here would be a per-connection setting escaping into unrelated work.
    await tx.query("SET LOCAL lock_timeout = '3000ms'");
    // ⚠ hashtext() IS STABLE ACROSS CONNECTIONS AND RESTARTS, which is the whole requirement —
    // a JS hash would have to agree between every replica and every Node version. Postgres
    // computes both keys, so the lock identity is a property of the database, not of the caller.
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [String(contractorId), String(jobberClientId)]);
    const result = await fn(tx);
    await tx.query('COMMIT');
    return result;
  } catch (err) {
    lockError = err;
    // ⚠ A LOCK TIMEOUT IS TAGGED SO A CALLER CAN TELL CONTENTION FROM A BAD CAPTURE.
    // Postgres raises SQLSTATE 55P03 (lock_not_available) when lock_timeout expires. Without this
    // tag every door would log "capture failed" for what is really "another event for this client
    // held the lock" — two different situations that want different handling, recorded under one
    // message. The flag is additive: nothing has to read it, and the doors that do not still
    // behave exactly as before.
    if (err && err.code === '55P03') {
      err.lockTimeout = true;
      err.message = `withClientLock: timed out after 3000ms waiting for the lock on client `
        + `${jobberClientId} (contractor ${contractorId}) — another event for the SAME client held `
        + `it; this is contention, not a capture failure: ${err.message}`;
    }
    // ⚠ THE ROLLBACK FAILURE IS CAPTURED HERE AND LOGGED AFTER THE CONNECTION IS RELEASED.
    // It used to `await logError(...)` right here, while `tx.release()` was still pending in the
    // finally — and logError can send a Resend alert with two retries. That held a POOLED
    // CONNECTION across an outbound HTTP call, which is the exact shape ruling 5 of Commit 6
    // forbids. It was safe only because this call passed `alert: false` and errorLogger gates
    // the send on `alert !== false`. **Pool safety must not depend on a flag one edit could
    // change**, so the log is deferred instead of relying on it.
    let rollbackFailure = null;
    try {
      await tx.query('ROLLBACK');
    } catch (rollbackErr) {
      rollbackFailure = rollbackErr;
    }
    // Stash for the finally, which releases first and logs second.
    err.__rollbackFailure = rollbackFailure;
    throw err;
  } finally {
    const heldMs = Date.now() - heldFrom;
    // ⚠ RELEASE FIRST. Everything below this line may do I/O, and none of it may do so while
    // holding a pool slot.
    tx.release();

    // ── HOLD-TIME LINE (6b, ruling 3) ───────────────────────────────────────
    // ⚠ EMITTED FOR EVERY LOCKED SECTION, SUCCESS OR FAILURE, because the 3000ms lock_timeout
    // was derived from a LOCAL measurement and needs re-deriving from Railway numbers — and a
    // line that only appears on success would measure the fast path and miss the slow one.
    // No client data beyond the id.
    // diagnostic log — intentional
    console.log(
      `[lock-hold] door=${door} contractor=${contractorId} client=${jobberClientId} `
      + `held_ms=${heldMs}${lockError ? ` outcome=${lockError.lockTimeout ? 'lock_timeout' : 'error'}` : ' outcome=ok'}`
    );

    const rollbackFailure = lockError && lockError.__rollbackFailure;
    if (rollbackFailure) {
      // Now safe: the connection is back in the pool, so this may take as long as it likes.
      await logError({
        req: null,
        contractorId,
        error: new Error(`withClientLock: ROLLBACK failed for client ${jobberClientId}: ${rollbackFailure.message}`),
        source: 'withClientLock — rollback',
        alert: false,
      }).catch(() => { /* never let logging mask the error already thrown */ });
    }
  }
}

module.exports = { withClientLock };
