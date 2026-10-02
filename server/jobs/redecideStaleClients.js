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
// ⚠ IT DECIDES ONLY FROM COMPLETE HISTORY — DANNY'S RULING, 2026-10-01 — AND THE PREVIEW THAT FORCED
// IT IS THE REASON TO READ THIS BLOCK. The first writing selected on "any fact is newer than the
// decision". Measured against production, that would have moved 364 clients on its first run, of which
// **354 went BACKWARDS and 353 came off 'paid'**. Sampled against Jobber live, 21 of those split
// **14 DATA GAP / 2 BOTH WRONG / 5 REAL CORRECTION** — so the majority were clients whose stored
// 'paid' was RIGHT and whose stored facts were short, because `repImportScope.js` captured only the
// rep WINDOW, per entity.
//
// ⚠ A RATCHET WAS PROPOSED AND REJECTED, and the reason is worth keeping. Refusing any downward write
// would also block the 5 genuine corrections, and it contradicts the ruling that reps always see the
// TRUE stage. The defect is not the direction of the move; it is deciding from data that is missing.
// So the fix is upstream of the decision: select only clients whose history is known to be complete.
//
// ⚠ COMPLETE MEANS `jobber_clients.last_full_capture_at`, STAMPED BY THE FETCHER'S CERTIFICATION —
// see `server/utils/captureCompleteness.js`. Never backfilled, so eligibility is **0 on the day this
// ships** and grows only as real full captures run (~58 clients a day through the live doors). A job
// that does nothing for its first many runs is correct here, not broken.
//
// ⚠ AND "NEVER DECIDED" IS STILL WORK, BUT ONLY FOR A FULLY CAPTURED CLIENT. `stage_derived_at IS NULL`
// means never decided or decided before that column existed; paired with a non-null marker it is a
// client we have complete history for and no decision from it.
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
const { creditReferralFromFacts } = require('../utils/referralCredit');
const { notifyReferralCredit } = require('../utils/referralNotify');
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
    `SELECT jc.jobber_client_id, jc.last_full_capture_at, jc.stage_derived_at,
            COUNT(*) OVER () AS total
       FROM jobber_clients jc
      WHERE jc.contractor_id = $1
        AND ${derivableClientIdSql('jc.jobber_client_id')}
        AND jc.last_full_capture_at IS NOT NULL
        AND (
          jc.stage_derived_at IS NULL OR jc.last_full_capture_at > jc.stage_derived_at
          -- THE REFERRER-VISIBLE HALF (7d ruling 2).
          -- WITHOUT THIS CLAUSE A SYNC-DECIDED CLIENT IS NEVER CREDITED BY THIS JOB. The two surfaces
          -- carry their own decision markers: stage_derived_at on jobber_clients for the DISPLAYED
          -- stage, and status_derived_at on pipeline_cache for the REFERRER-VISIBLE status. A client
          -- the sync has already decided has a current stage_derived_at, so the first two conditions
          -- are both false, and the client falls out of the selection with its referrer uncredited.
          -- Measured before this clause: status_derived_at was written by two statements and read by
          -- nothing at all.
          -- THIS IS WHAT MAKES "credited within one run" TRUE for every path that decides the
          -- referrer-visible status without crediting, which after C1 is the sync.
          -- IT IS AN EXISTS RATHER THAN A JOIN, deliberately. pipeline_cache is unique on
          -- (contractor, client) so a join is safe today, but answering a boolean with a join is the
          -- fan-out shape that double-counted a rep's book, found in a browser and not by a test.
          -- A boolean needs EXISTS; a join is for columns you SELECT.
          -- NO BACKTICKS IN THIS COMMENT, AND THAT IS NOT STYLE: this SQL lives in a template
          -- literal, so a backtick here closes the string. The first writing of this block used them
          -- and the file failed to parse with "missing ) after argument list" — the exact signature
          -- CLAUDE.md records for this defect. Reworded, never escaped.
          OR EXISTS (
            SELECT 1 FROM pipeline_cache pc
             WHERE pc.contractor_id = jc.contractor_id
               AND pc.jobber_client_id = jc.jobber_client_id
               AND (pc.status_derived_at IS NULL
                    OR jc.last_full_capture_at > pc.status_derived_at)
          )
        )
      ORDER BY jc.stage_derived_at ASC NULLS FIRST, jc.last_full_capture_at ASC
      LIMIT $2`,
    [contractorId, limit]
  );
  const total = rows.length > 0 ? Number(rows[0].total) : 0;

  // ⚠ COUNTED, NOT MERELY EXCLUDED. A client left out because nothing ever fully captured it is the
  // normal case today and must stay visible: 16,329 of this tenant's 19,598 clients have no job or
  // invoice fact at all, and a job that silently ignores five sixths of the book while reporting
  // success is the health-reporting failure CLAUDE.md records. One extra aggregate per run.
  const { rows: skipRows } = await db.query(
    `SELECT COUNT(*) AS n
       FROM jobber_clients jc
      WHERE jc.contractor_id = $1
        AND ${derivableClientIdSql('jc.jobber_client_id')}
        AND jc.last_full_capture_at IS NULL`,
    [contractorId]
  );

  return {
    candidates: rows.map((r) => ({
      jobberClientId: r.jobber_client_id,
      lastFullCaptureAt: r.last_full_capture_at,
      stageDerivedAt: r.stage_derived_at,
    })),
    // ⚠ REPORTED RATHER THAN INFERRED FROM THE LIMIT. `total` is the full matching population via a
    // window function, so the summary can say how many were left rather than leaving the operator to
    // guess whether the cap was reached.
    remaining: Math.max(0, total - rows.length),
    skippedPartial: Number(skipRows[0].n),
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
    let creditOutcome = null;
    const cached = await tx.query(
      `SELECT 1 FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [contractorId, jobberClientId]
    );
    if (cached.rows.length > 0) {
      const ref = await writeReferredStatus(tx, { contractorId, jobberClientId });
      referredRows = ref.rowCount;
    }

    // ── THE CREDIT, THROUGH THE ONE SHARED CREDIT (7d) ────────────────────────
    // ⚠ THE SAME FUNCTION THE DOOR CALLS. This is the whole reason the catch-up matters for money and
    // not only for display: a client that becomes paid by a route with no webhook — this job, the sync,
    // a re-capture — used to reach 'paid' on the referrer's screen and never be credited. A second copy
    // of the gate logic here would be a second set of money rules.
    //
    // ⚠ IT IS OUTSIDE THE `cached` BRANCH, AND THAT IS RULING 1 RATHER THAN AN OVERSIGHT. The credit
    // reads the referrer from SAVED CLIENT FACTS and creates the `pipeline_cache` row itself when a
    // capture shows a referrer and no row exists — so gating it on the row already existing would make
    // the brand-new-referral path, which ruling 1 exists for, structurally unreachable from this job.
    // ⚠ A client with no referrer in its facts returns `not_referred` and writes nothing, so running it
    // for every selected client costs one indexed read on the clients that are not referred.
    // ⚠ AND THE ORDER MATTERS: `writeReferredStatus` above is an UPDATE that affects 0 rows when no row
    // exists yet. If the credit CREATES the row, the referrer-visible status is written by the NEXT
    // run — which is the conservative direction, because a status written before its facts were
    // credited would show a stage with no bonus beside it.
    creditOutcome = await creditReferralFromFacts(tx, { contractorId, jobberClientId });

    return {
      status: decided.currentStatus,
      stageChanged: (before.rows[0]?.pipeline_stage ?? null) !== decided.currentStatus,
      referredRows,
      // ⚠ RETURNED SO THE CALLER CAN NOTIFY *AFTER* THE LOCK. Sending inside would hold a pooled
      // connection across an outbound HTTP call — the defect commit 6b fixed in withClientLock.
      creditOutcome,
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
  const { candidates, remaining, skippedPartial } = await selectStaleClients(pool, { contractorId, limit });
  onLine(`[redecideStaleClients] ${contractorId}: ${candidates.length} eligible, `
    + `${remaining} beyond the limit, ${skippedPartial} skipped (never fully captured)`);

  const summary = {
    contractorId,
    limit,
    considered: candidates.length,
    remaining,
    skippedPartial,
    redecided: 0,
    stageChanged: 0,
    referredUpdated: 0,
    credited: 0,
    failed: [],
    elapsedMs: null,
  };

  for (const c of candidates) {
    try {
      const out = await redecideOne(pool, { contractorId, jobberClientId: c.jobberClientId });
      summary.redecided += 1;
      if (out.stageChanged) summary.stageChanged += 1;
      if (out.referredRows > 0) summary.referredUpdated += 1;
      // ── NOTIFY AFTER THE LOCK, ONLY ON A NEW CREDIT (7d) ────────────────────
      // `redecideOne` has returned, so its transaction is committed and its lock released. Gated on
      // `credited`, which is true only when a conversion row was INSERTED — a duplicate sends none.
      if (out.creditOutcome && out.creditOutcome.credited) {
        summary.credited += 1;
        await notifyReferralCredit(pool, { ...out.creditOutcome, contractorId, req: null });
      }
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
    `eligible            ${s.considered}`,
    `beyond the limit    ${s.remaining}`,
    // ⚠ ON ITS OWN LINE BECAUSE IT IS THE NUMBER THAT EXPLAINS A QUIET RUN. An operator seeing
    // "eligible 0" needs to know whether that means "nothing to do" or "nothing is eligible yet",
    // and those are different states with different actions.
    `skipped: no full capture  ${s.skippedPartial}`,
    `re-decided          ${s.redecided}`,
    `stage CHANGED       ${s.stageChanged}`,
    `referrer status set ${s.referredUpdated}`,
    `CREDITED            ${s.credited}`,
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
