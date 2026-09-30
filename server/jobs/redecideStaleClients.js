'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE CATCH-UP — RE-DECIDE ANY CLIENT WHOSE FACTS ARE NEWER THAN THEIR DECISION
//
// The other half of Danny's capture/decision split (2026-09-30). Splitting the two transactions
// means a decision failure leaves the facts saved and the stage stale; this is what converges that
// back. **Without it, "the next pass will fix it" is a hope** — a client whose decision failed and
// who then receives no further webhook would keep a stale stage indefinitely.
//
// ⚠ SAVED FACTS ONLY. NO JOBBER CALL, NO `fetchFullClient`, NO `axios`. That is the ruling and it is
// what makes this job cheap enough to run often and safe enough to run unattended: it re-runs a pure
// derivation over rows that are already stored. A fence scans this file's own source and fails if a
// Jobber fetcher or `axios` appears in it.
//
// ⚠ IT WRITES THE SAME TWO THINGS THE DOOR WRITES, THROUGH THE SAME CODE. The displayed stage on
// `jobber_clients`, and — for a client that has a `pipeline_cache` row — the referrer-visible status
// via the SHARED `writeReferredStatus`. Writing one without the other is what would put the two
// surfaces back out of step, which is the single thing the N4 arc exists to have eliminated. It is
// also why the money-adjacent UPDATE was extracted rather than copied here.
//
// ⚠ "FACTS NEWER THAN THE DECISION" INCLUDES "NEVER DECIDED". `stage_derived_at IS NULL` means either
// never decided or decided before that column existed, and both are work. The column is deliberately
// NOT backfilled — see `server/db.js` — because a backfill from `last_synced_at` would have made a
// client whose decision FAILED look decided and be missed permanently. Doing extra idempotent work is
// recoverable; missing a client is not.
//
// ⚠ BOUNDED BY A LIMIT, AND ORDERED OLDEST-FACTS-FIRST. The first runs are large for exactly the
// reason above, so the job takes a cap and reports how many remain rather than holding a connection
// for the whole book. A run that cannot say what it did not reach is a run nobody can act on.
//
// ⚠ AND THE PER-CLIENT LOCK IS STILL TAKEN. A webhook can land on the same client mid-run, and two
// decisions interleaving between the read and the write is the LOST UPDATE `clientLock.js` exists
// for. There is no Jobber fetch to keep outside it here, which is the one way this job is simpler
// than the door.
// ─────────────────────────────────────────────────────────────────────────────

const { decideFromFacts } = require('../utils/attributionDecide');
const { writeReferredStatus } = require('../utils/referredStatus');
const { withClientLock } = require('../utils/clientLock');
const { derivableClientIdSql } = require('../utils/derivableClient');
const { logError: realLogError } = require('../middleware/errorLogger');

const DOOR = 'redecide-stale';
const DEFAULT_LIMIT = 200;

/**
 * Clients whose newest fact is newer than their decision, oldest decision first.
 * Inputs: a db/pool, { contractorId, limit }.
 * Output: { candidates: [{ jobberClientId, newestFact, stageDerivedAt }], remaining }.
 *
 * ⚠ THE NEWEST FACT IS THE GREATEST `captured_at` ACROSS THE TABLES THAT HAVE ONE — and that is a
 * REAL LIMITATION, stated rather than smoothed over. Only `crm_job_facts` and `crm_invoice_facts`
 * carry a `captured_at`; `crm_quote_facts` and `crm_request_facts` have **no capture timestamp at
 * all** (their `created_at` is the Jobber record's own creation date, which says nothing about when we
 * last read it). So a client whose ONLY newer fact is a quote or a request is not detected by the
 * "facts are newer" branch.
 * ⚠ WHAT THAT DOES AND DOES NOT COST. The branch the RULING depends on is
 * `stage_derived_at IS NULL` — every client whose decision failed, or was never made, is caught
 * regardless of which fact tables carry timestamps. The limitation bites only on the refinement: a
 * client already decided whose quote later changed keeps its stage until some other event touches it.
 * It is filed on `PRE_LAUNCH_CHECKLIST.md`, and a test case pins it so it reads as known rather than
 * as an oversight.
 * ⚠ AND INVOICE FACTS MATTER MOST HERE, which is why job-only would not do: the paid invoice is
 * precisely the fact that moves a stage to 'paid'.
 * ⚠ AND THE PREDICATE IS IMPORTED, NEVER RE-SPELLED. `derivableClientIdSql` exists so the
 * `app_user_*` / synthetic exclusion has one home; writing `LIKE 'app_user_%'` here is the divergence
 * commit 2's fence forbids, and it would also miss `test-client-002`, a synthetic id live in
 * production with a real conversion row.
 */
async function selectStaleClients(db, { contractorId, limit = DEFAULT_LIMIT } = {}) {
  if (!contractorId) throw new Error('selectStaleClients: contractorId is required');
  const { rows } = await db.query(
    `WITH newest AS (
       SELECT jobber_client_id, MAX(captured_at) AS newest_fact
         FROM (
           -- ONLY THESE TWO TABLES HAVE A capture timestamp. crm_quote_facts and crm_request_facts
           -- have none, and their created_at column is the Jobber record's own date — reading it here
           -- would compare a client's quote date against our decision clock and call every old quote
           -- newer than the decision, forever. Absent is better than wrong; see the header.
           -- (No backticks in this comment: it sits inside a template literal, where one would close
           -- the string. That is the defect CLAUDE.md records, and it cost this file one debug pass.)
           SELECT jobber_client_id, captured_at FROM crm_job_facts     WHERE contractor_id = $1
           UNION ALL
           SELECT jobber_client_id, captured_at FROM crm_invoice_facts WHERE contractor_id = $1
         ) f
        GROUP BY jobber_client_id
     )
     SELECT jc.jobber_client_id, n.newest_fact, jc.stage_derived_at,
            COUNT(*) OVER () AS total
       FROM jobber_clients jc
       JOIN newest n ON n.jobber_client_id = jc.jobber_client_id
      WHERE jc.contractor_id = $1
        AND ${derivableClientIdSql('jc.jobber_client_id')}
        AND (jc.stage_derived_at IS NULL OR n.newest_fact > jc.stage_derived_at)
      ORDER BY jc.stage_derived_at ASC NULLS FIRST, n.newest_fact ASC
      LIMIT $2`,
    [contractorId, limit]
  );
  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  return {
    candidates: rows.map((r) => ({
      jobberClientId: r.jobber_client_id,
      newestFact: r.newest_fact,
      stageDerivedAt: r.stage_derived_at,
    })),
    // ⚠ REPORTED RATHER THAN INFERRED FROM THE LIMIT. `total` is the full matching population via a
    // window function, so the summary can say how many were left rather than leaving the operator to
    // guess whether the cap was reached.
    remaining: Math.max(0, total - rows.length),
  };
}

/**
 * Re-decide one client from saved facts, inside the per-client lock.
 * Inputs: a pool, { contractorId, jobberClientId }.
 * Output: { status, stageChanged, referredRows }.
 */
async function redecideOne(pool, { contractorId, jobberClientId }) {
  return withClientLock(pool, { contractorId, jobberClientId, door: DOOR }, async (tx) => {
    const before = await tx.query(
      `SELECT pipeline_stage FROM jobber_clients
        WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [contractorId, jobberClientId]
    );
    const decided = await decideFromFacts(tx, { contractorId, jobberClientId });

    // ⚠ `stage_derived_at` IS STAMPED UNCONDITIONALLY HERE, AND THAT IS CORRECT RATHER THAN
    // INCONSISTENT WITH THE DOOR. The door stamps only when a stage was decided, because its upsert
    // also runs when the decision FAILED. Here a decision has just succeeded by construction — if it
    // had thrown we would be in the catch, not this line — so the stamp records a fact. Leaving it
    // unstamped would make the client eligible again on every run: a job that never stops finding the
    // same work is one nobody keeps running.
    await tx.query(
      `UPDATE jobber_clients
          SET pipeline_stage = COALESCE($3::text, pipeline_stage),
              stage_derived_at = NOW()
        WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [contractorId, jobberClientId, decided.currentStatus]
    );

    // ⚠ AND THE REFERRER-VISIBLE STATUS TOO, WHERE A ROW EXISTS, THROUGH THE SHARED WRITER. Writing
    // the displayed stage alone would put the two surfaces out of step — the divergence N4 closed.
    // `writeReferredStatus` is an UPDATE, so a client the referral sync has never seen affects 0 rows
    // and that is the expected quiet outcome.
    let referredRows = 0;
    const cached = await tx.query(
      `SELECT 1 FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [contractorId, jobberClientId]
    );
    if (cached.rows.length > 0) {
      const ref = await writeReferredStatus(tx, { contractorId, jobberClientId });
      referredRows = ref.rowCount;
    }

    return {
      status: decided.currentStatus,
      stageChanged: (before.rows[0]?.pipeline_stage ?? null) !== decided.currentStatus,
      referredRows,
    };
  });
}

/**
 * Re-decide every stale client of one contractor, from saved facts only.
 * Inputs: a pool, { contractorId, limit, logError, onLine }.
 * Output: a summary object.
 *
 * ⚠ ONE CLIENT'S FAILURE NEVER STOPS THE RUN, and each failure is recorded with its id so a re-run
 * can be targeted. A catch-up job that aborts on the first bad client is a catch-up job that never
 * catches up.
 */
async function runRedecideStaleClients(pool, {
  contractorId,
  limit = DEFAULT_LIMIT,
  logError = realLogError,
  onLine = () => {},
} = {}) {
  if (!contractorId) throw new Error('runRedecideStaleClients: contractorId is required');

  const startedAt = Date.now();
  const { candidates, remaining } = await selectStaleClients(pool, { contractorId, limit });
  onLine(`[redecideStaleClients] ${contractorId}: ${candidates.length} stale client(s), ${remaining} beyond the limit`);

  const summary = {
    contractorId,
    limit,
    considered: candidates.length,
    remaining,
    redecided: 0,
    stageChanged: 0,
    referredUpdated: 0,
    failed: [],
    elapsedMs: null,
  };

  for (const c of candidates) {
    try {
      const out = await redecideOne(pool, { contractorId, jobberClientId: c.jobberClientId });
      summary.redecided += 1;
      if (out.stageChanged) summary.stageChanged += 1;
      if (out.referredRows > 0) summary.referredUpdated += 1;
    } catch (err) {
      summary.failed.push({ id: c.jobberClientId, message: err.message });
      onLine(`[redecideStaleClients] FAILED ${c.jobberClientId}: ${err.message}`);
      await logError({
        req: null,
        contractorId,
        error: new Error(`[redecideStaleClients] re-decide failed for client ${c.jobberClientId}: ${err.message}`),
        source: 'redecideStaleClients — decide',
        alert: false,
      });
    }
  }

  summary.elapsedMs = Date.now() - startedAt;
  return summary;
}

/** The summary, formatted for a human. Returns an array of lines. */
function formatSummary(s) {
  const lines = [
    '',
    '── re-decide stale clients (saved facts only) ──────────────────',
    `contractor          ${s.contractorId}`,
    `limit               ${s.limit}`,
    `stale considered    ${s.considered}`,
    `beyond the limit    ${s.remaining}`,
    `re-decided          ${s.redecided}`,
    `stage CHANGED       ${s.stageChanged}`,
    `referrer status set ${s.referredUpdated}`,
    `failed              ${s.failed.length}`,
  ];
  for (const f of s.failed) lines.push(`  - ${f.id}: ${f.message}`);
  lines.push(
    `elapsed             ${s.elapsedMs}ms`,
    // ⚠ SAID OUT LOUD, because a run that leaves work behind and does not say so reads as a run that
    // finished. Same reasoning as the rebuild's kept-rows log.
    s.remaining === 0
      ? 'COMPLETE — no client is left with facts newer than its decision'
      : `ATTENTION — ${s.remaining} client(s) still have facts newer than their decision; re-run`,
    '───────────────────────────────────────────────────────────────',
    ''
  );
  return lines;
}

module.exports = {
  runRedecideStaleClients,
  selectStaleClients,
  redecideOne,
  formatSummary,
  DEFAULT_LIMIT,
};
