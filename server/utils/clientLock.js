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
async function withClientLock(pool, { contractorId, jobberClientId }, fn) {
  if (!contractorId) throw new Error('withClientLock: contractorId is required');
  if (!jobberClientId) throw new Error('withClientLock: jobberClientId is required');

  const tx = await pool.connect();
  try {
    await tx.query('BEGIN');
    // ⚠ hashtext() IS STABLE ACROSS CONNECTIONS AND RESTARTS, which is the whole requirement —
    // a JS hash would have to agree between every replica and every Node version. Postgres
    // computes both keys, so the lock identity is a property of the database, not of the caller.
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [String(contractorId), String(jobberClientId)]);
    const result = await fn(tx);
    await tx.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await tx.query('ROLLBACK');
    } catch (rollbackErr) {
      // A failed ROLLBACK means the connection is already unusable; the real error is the one
      // being thrown, and masking it with this one would hide the cause.
      await logError({
        req: null,
        contractorId,
        error: new Error(`withClientLock: ROLLBACK failed for client ${jobberClientId}: ${rollbackErr.message}`),
        source: 'withClientLock — rollback',
        alert: false,
      }).catch(() => { /* never let logging mask the throw below */ });
    }
    throw err;
  } finally {
    tx.release();
  }
}

module.exports = { withClientLock };
