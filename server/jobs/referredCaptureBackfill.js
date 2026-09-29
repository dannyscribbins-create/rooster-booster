'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 4 — REFERRED-CLIENT CAPTURE BACKFILL (Danny ruling 8, 2026-09-29)
//
// Before launch, capture facts for every client in `pipeline_cache`, so that every
// REFERRER-VISIBLE stage is fact-derived from day one. The rest of the book converges through
// the webhooks and the sync; only this population is gated on launch.
//
// ⚠ IT WRITES FACTS AND NOTHING ELSE. No `pipeline_stage`, no `pipeline_status`, no
// `client_rep_assignments`, no `flagged_assignments`, no `referral_conversions`. It does not
// even DECIDE — `decideFromFacts` is never called here. That is not caution, it is the whole
// design: capture must be able to run ahead of the commit that starts reading from it, and a
// backfill that also wrote a stage would be a silent migration of every referrer's screen
// disguised as a data job. `server/test/referredCaptureBackfill.test.js` fences it by scanning
// this file's own source, so the guarantee survives an edit rather than resting on this comment.
//
// ⚠ ORDER MATTERS AND IT IS WHY THIS IS COMMIT 4 RATHER THAN COMMIT 8. Commit 7 puts the
// referrer-visible status onto saved facts. Run in the other order, the five referred clients
// that have no facts today would derive `'lead'` for want of data — a downgrade on the one
// surface where a stage must only move forward. Capture precedes derivation.
//
// ⚠ IDEMPOTENT BY CONSTRUCTION, NOT BY A GUARD. Every writer in `factCapture.js` is an
// `INSERT ... ON CONFLICT DO UPDATE` keyed on the fact's own Jobber id, and none of them
// deletes. Re-running re-fetches and re-upserts the same rows to the same values; the only
// thing that changes is `captured_at`. There is no cursor and no watermark to corrupt.
//
// ⚠ THE PER-CLIENT LOCK IS TAKEN, AND THE JOBBER FETCH STAYS OUTSIDE IT. Holding a pooled
// connection across a Jobber round trip is what `server/utils/clientLock.js` forbids outright.
// The lock matters here because a webhook can land on the same client mid-backfill, and two
// captures interleaving would let one read facts the other had half-written.
// ─────────────────────────────────────────────────────────────────────────────

const { fetchFullClient } = require('../utils/jobberClientFetch');
const { captureClientFacts } = require('../utils/factCapture');
const { withClientLock } = require('../utils/clientLock');
const { computeThrottlePaceDelayMs } = require('../crm/pipelineSync');
const { derivableClientIdSql } = require('../utils/derivableClient');
const { logError: realLogError } = require('../middleware/errorLogger');

// test seam — inert in production, never called outside server/test/
let _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// test seam — inert in production, never called outside server/test/
function _setTestOverrides({ sleep } = {}) { if (sleep !== undefined) _sleep = sleep; }
// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() { _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); }

/**
 * Every referred client whose id belongs to a real Jobber client.
 * Inputs: a db/pool and the contractor id.
 * Output: { admitted: [id], excluded: [{ id, reason }] }.
 *
 * ⚠ THE PREDICATE IS IMPORTED, NEVER RE-SPELLED. Commit 2 exists so this exclusion has one
 * home; writing `LIKE 'app_user_%'` here would be the divergence that commit's fence forbids —
 * and it would also miss `test-client-002`, a synthetic id live in production today.
 * ⚠ AND THE EXCLUDED ROWS ARE RETURNED WITH THEIR REASON RATHER THAN FILTERED AWAY. A summary
 * that says "16 captured" without saying what happened to the other 4 reports health it never
 * observed.
 */
async function selectReferredClients(db, contractorId) {
  const { rows } = await db.query(
    `SELECT jobber_client_id, ${derivableClientIdSql('jobber_client_id')} AS derivable
       FROM pipeline_cache
      WHERE contractor_id = $1
      ORDER BY jobber_client_id ASC`,
    [contractorId]
  );
  const admitted = [];
  const excluded = [];
  for (const r of rows) {
    if (r.derivable) admitted.push(r.jobber_client_id);
    else excluded.push({ id: r.jobber_client_id, reason: 'no Jobber client behind this id' });
  }
  return { admitted, excluded };
}

/**
 * Referred clients that still have NO facts of any kind.
 * ⚠ THIS IS THE RUN'S SUCCESS CONDITION, AND IT IS MEASURED AFTER RATHER THAN ASSUMED FROM THE
 * CAPTURE COUNT. "16 captures succeeded" and "16 clients now have facts" are different claims:
 * a client with genuinely no quotes, jobs, requests or invoices in Jobber captures successfully
 * and still has zero fact rows. The summary reports both so the difference is visible instead
 * of being averaged away.
 */
async function countZeroFactClients(db, contractorId) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n
       FROM pipeline_cache pc
      WHERE pc.contractor_id = $1
        AND ${derivableClientIdSql('pc.jobber_client_id')}
        AND NOT EXISTS (SELECT 1 FROM crm_request_facts f WHERE f.contractor_id = $1 AND f.jobber_client_id = pc.jobber_client_id)
        AND NOT EXISTS (SELECT 1 FROM crm_quote_facts   f WHERE f.contractor_id = $1 AND f.jobber_client_id = pc.jobber_client_id)
        AND NOT EXISTS (SELECT 1 FROM crm_job_facts     f WHERE f.contractor_id = $1 AND f.jobber_client_id = pc.jobber_client_id)
        AND NOT EXISTS (SELECT 1 FROM client_sales      s WHERE s.contractor_id = $1 AND s.jobber_client_id = pc.jobber_client_id)`,
    [contractorId]
  );
  return rows[0].n;
}

/**
 * Capture facts for every referred client of one contractor.
 * Inputs: a pool, { contractorId, getToken, logError, onLine }.
 * Output: a summary object — see the fields below.
 *
 * ⚠ ONE CLIENT'S FAILURE NEVER STOPS THE RUN. A backfill that aborts on the first bad client
 * leaves the operator with a partial result and no list of what was missed, which is worse than
 * a complete run with four recorded failures.
 */
async function runReferredCaptureBackfill(pool, {
  contractorId,
  getToken,
  logError = realLogError,
  onLine = () => {},
} = {}) {
  if (!contractorId) throw new Error('runReferredCaptureBackfill: contractorId is required');
  if (typeof getToken !== 'function') throw new Error('runReferredCaptureBackfill: getToken is required');

  const startedAt = Date.now();
  const { admitted, excluded } = await selectReferredClients(pool, contractorId);
  const zeroFactBefore = await countZeroFactClients(pool, contractorId);

  onLine(`[referredCaptureBackfill] ${contractorId}: ${admitted.length} admitted, ${excluded.length} excluded`);

  const summary = {
    contractorId,
    found: admitted.length + excluded.length,
    admitted: admitted.length,
    excluded,
    captured: 0,
    failed: [],
    jobberCalls: 0,
    actualCost: 0,
    requestedCost: 0,
    pacedMs: 0,
    zeroFactBefore,
    zeroFactAfter: null,
    elapsedMs: null,
  };

  for (const jobberClientId of admitted) {
    let lastCost = null;
    try {
      // ⚠ A TOKEN PER CLIENT, NOT ONE HELD ACROSS THE RUN. A sibling refresher rotates the
      // shared row, and a held token turns into a 401 on every remaining client — the exact
      // defect Wave 0.2 item 4b fixed in the nightly sync.
      const token = await getToken(contractorId);

      const client = await fetchFullClient(jobberClientId, token, {
        door: 'referred-capture-backfill',
        contractorId,
        onCost: (cost) => {
          if (!cost) return;
          lastCost = cost;
          summary.jobberCalls += 1;
          if (typeof cost.actualQueryCost === 'number') summary.actualCost += cost.actualQueryCost;
          if (typeof cost.requestedQueryCost === 'number') summary.requestedCost += cost.requestedQueryCost;
        },
      });

      // ⚠ THE FETCH IS DONE BY THE TIME THE LOCK IS TAKEN. See the header.
      await withClientLock(pool, { contractorId, jobberClientId, door: 'referred-capture-backfill' }, async (tx) => {
        await captureClientFacts(tx, { contractorId, client });
      });
      summary.captured += 1;
    } catch (err) {
      // ⚠ RECORDED AND CARRIED ON. The id goes into the summary so a re-run can be targeted,
      // and into error_log so the failure is visible to anyone not watching the console.
      summary.failed.push({ id: jobberClientId, message: err.message });
      onLine(`[referredCaptureBackfill] FAILED ${jobberClientId}: ${err.message}`);
      await logError({
        req: null,
        contractorId,
        error: new Error(`[referredCaptureBackfill] capture failed for client ${jobberClientId}: ${err.message}`),
        source: 'referredCaptureBackfill — capture',
        alert: false,
      });
    }

    // ⚠ PACED AGAINST THE RESERVATION, WHICH IS WHAT THROTTLES — Jobber reserves
    // `requestedQueryCost` and refunds the unused part, so a capture is refused on the
    // reservation while the bucket still looks healthy against the ACTUAL spend. Measured
    // live 2026-09-29: requested 3,408-3,515 against actual 46-72, bucket 10,000, restore
    // 500/s. The computed delay is 0 at this population's size; it is a guard against a
    // larger book, not a throttle this run is near.
    const paceMs = computeThrottlePaceDelayMs(lastCost?.throttleStatus, lastCost?.requestedQueryCost);
    if (paceMs > 0) {
      summary.pacedMs += paceMs;
      onLine(`[referredCaptureBackfill] pacing ${paceMs}ms — available ${lastCost?.throttleStatus?.currentlyAvailable}`);
      await _sleep(paceMs);
    }
  }

  summary.zeroFactAfter = await countZeroFactClients(pool, contractorId);
  summary.elapsedMs = Date.now() - startedAt;
  return summary;
}

/** The summary, formatted for a human. Returns an array of lines. */
function formatSummary(s) {
  const lines = [
    '',
    '── referred capture backfill ──────────────────────────────────',
    `contractor          ${s.contractorId}`,
    `pipeline_cache rows ${s.found}`,
    `admitted            ${s.admitted}`,
    `excluded            ${s.excluded.length}`,
  ];
  for (const e of s.excluded) lines.push(`  - ${e.id}: ${e.reason}`);
  lines.push(
    `captured            ${s.captured}`,
    `failed              ${s.failed.length}`
  );
  for (const f of s.failed) lines.push(`  - ${f.id}: ${f.message}`);
  lines.push(
    `Jobber calls        ${s.jobberCalls}`,
    `cost requested      ${s.requestedCost}`,
    `cost actual         ${s.actualCost}`,
    `paced               ${s.pacedMs}ms`,
    `elapsed             ${s.elapsedMs}ms`,
    '',
    `COMPLETENESS  zero-fact admitted clients: ${s.zeroFactBefore} before -> ${s.zeroFactAfter} after`,
  );
  // ⚠ THE CHECK IS REPORTED AS PASS/ATTENTION RATHER THAN LEFT FOR THE READER TO DO THE
  // SUBTRACTION. A summary whose success condition has to be inferred is one nobody checks.
  // ⚠ AND A NON-ZERO RESULT IS NOT NECESSARILY A FAILURE: a client with genuinely no quotes,
  // jobs, requests or invoices in Jobber captures successfully and still has zero fact rows.
  // It says ATTENTION, and names the distinction, rather than claiming a failure it cannot see.
  lines.push(
    s.zeroFactAfter === 0
      ? 'RESULT        PASS — every admitted referred client now has facts'
      : `RESULT        ATTENTION — ${s.zeroFactAfter} admitted client(s) still have no facts. `
        + 'That is expected only for a client with genuinely no quotes, jobs, requests or '
        + 'invoices in Jobber; check the failed list above first.'
  );
  lines.push('───────────────────────────────────────────────────────────────', '');
  return lines;
}

module.exports = {
  runReferredCaptureBackfill,
  selectReferredClients,
  countZeroFactClients,
  formatSummary,
  _setTestOverrides,
  _resetTestOverrides,
};
