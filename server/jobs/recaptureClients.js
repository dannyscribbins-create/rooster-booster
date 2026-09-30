'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// TARGETED RE-CAPTURE — facts plus the displayed stage, for a named list of clients
//
// Built for the 7 clients whose invoice-paid capture was rolled back by the `$3` parameter-type
// defect (see PRE_LAUNCH_CHECKLIST.md, closed 2026-09-30). Jobber does not redeliver those
// webhooks, so the facts they would have written have to be fetched again deliberately.
//
// ⚠ IT IS THE INVOICE-PAID DOOR MINUS IDENTITY AND TAGS, AND THAT IS THE WHOLE DESIGN. Under the
// per-client lock it does exactly what `upsertAndTagClient` does — `captureClientFacts`, then
// `decideFromFacts`, then store the decided stage — and nothing else. Identity and tags are
// derived from the FETCH rather than from facts, they were never rolled back (they are written on
// the pool, outside the lock, after the catch), and re-deriving them would be a write nobody
// asked for.
//
// ⚠ IT REFUSES A CLIENT THAT HAS A `pipeline_cache` ROW, AND THAT REFUSAL IS THE LOAD-BEARING
// PART RATHER THAN CAUTION. Such a client has TWO stages — the displayed one in
// `jobber_clients.pipeline_stage` and the referrer-visible one in `pipeline_cache.pipeline_status`
// — and the referrer-visible one has exactly one owner by design (`syncSingleClient`, which alone
// knows the referrer name and the pre-start-date decision). Writing the displayed stage here
// without the other would put the two surfaces back out of step, which is the single thing the N4
// arc exists to have eliminated. Measured 2026-09-30: none of the 7 affected clients has a
// `pipeline_cache` row, so this restriction excludes nobody today — it is here so the script
// cannot be pointed at a referred client next month and quietly reintroduce the divergence.
//
// ⚠ IDEMPOTENT BY CONSTRUCTION, NOT BY A GUARD. Every writer in `factCapture.js` is an
// `INSERT ... ON CONFLICT DO UPDATE` keyed on the fact's own Jobber id, and none deletes. The
// stage write is a COALESCE, so a run that decides nothing leaves the stored stage standing.
// There is no cursor and no watermark.
//
// ⚠ THE JOBBER FETCH STAYS OUTSIDE THE LOCK. Holding a pooled connection across a Jobber round
// trip is what `server/utils/clientLock.js` forbids outright.
// ─────────────────────────────────────────────────────────────────────────────

const { fetchFullClient } = require('../utils/jobberClientFetch');
const { captureClientFacts } = require('../utils/factCapture');
const { decideFromFacts } = require('../utils/attributionDecide');
const { withClientLock } = require('../utils/clientLock');
const { computeThrottlePaceDelayMs } = require('../crm/pipelineSync');
const { isDerivableJobberClientId } = require('../utils/derivableClient');
const { logError: realLogError } = require('../middleware/errorLogger');

const DOOR = 'recapture-clients';

// test seam — inert in production, never called outside server/test/
let _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// test seam — inert in production, never called outside server/test/
function _setTestOverrides({ sleep } = {}) { if (sleep !== undefined) _sleep = sleep; }
// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() { _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); }

/**
 * The fact counts and stored stage for one client, for the before/after report.
 * Inputs: a db/pool, { contractorId, jobberClientId }. Output: a plain object of counts.
 *
 * ⚠ `crm_invoice_job_links` CARRIES NO `jobber_client_id` — it is keyed (invoice, job) — so it is
 * counted through the invoice facts rather than directly. Reading its column list rather than
 * assuming it matches its siblings is what stops this query failing at run time.
 */
async function snapshotClient(db, { contractorId, jobberClientId }) {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM crm_job_facts     WHERE contractor_id=$1 AND jobber_client_id=$2) AS job_facts,
       (SELECT COUNT(*)::int FROM crm_quote_facts   WHERE contractor_id=$1 AND jobber_client_id=$2) AS quote_facts,
       (SELECT COUNT(*)::int FROM crm_invoice_facts WHERE contractor_id=$1 AND jobber_client_id=$2) AS invoice_facts,
       (SELECT COUNT(*)::int FROM crm_request_facts WHERE contractor_id=$1 AND jobber_client_id=$2) AS request_facts,
       (SELECT COUNT(*)::int FROM crm_invoice_job_links l
          JOIN crm_invoice_facts f
            ON f.contractor_id = l.contractor_id AND f.jobber_invoice_id = l.jobber_invoice_id
         WHERE l.contractor_id=$1 AND f.jobber_client_id=$2) AS invoice_job_links,
       (SELECT pipeline_stage FROM jobber_clients
         WHERE contractor_id=$1 AND jobber_client_id=$2) AS stage`,
    [contractorId, jobberClientId]
  );
  return rows[0];
}

/**
 * Sorts a requested list into what may be re-captured and what may not, with a reason each.
 * Inputs: a db/pool, contractorId, an array of client ids.
 * Output: { admitted: [id], excluded: [{ id, reason }] }.
 *
 * ⚠ EVERY REFUSAL CARRIES ITS REASON RATHER THAN BEING FILTERED AWAY. A summary that says
 * "5 captured" of 7 requested, without saying what happened to the other two, reports health it
 * never observed — the failure this repo records as its most common.
 */
async function classifyRequested(db, contractorId, requestedIds) {
  const admitted = [];
  const excluded = [];
  for (const id of requestedIds) {
    if (!isDerivableJobberClientId(id)) {
      excluded.push({ id, reason: 'not a Jobber client id — nothing to fetch' });
      continue;
    }
    const { rows: known } = await db.query(
      'SELECT 1 FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2',
      [contractorId, id]
    );
    if (known.length === 0) {
      excluded.push({ id, reason: 'no jobber_clients row for this contractor — wrong tenant, or never synced' });
      continue;
    }
    const { rows: cached } = await db.query(
      'SELECT 1 FROM pipeline_cache WHERE contractor_id = $1 AND jobber_client_id = $2',
      [contractorId, id]
    );
    if (cached.length > 0) {
      excluded.push({ id, reason: 'has a pipeline_cache row — the referrer-visible status has one owner; see the header' });
      continue;
    }
    admitted.push(id);
  }
  return { admitted, excluded };
}

/**
 * Re-capture facts and re-decide the displayed stage for a named list of clients.
 * Inputs: a pool, { contractorId, clientIds, getToken, logError, onLine }.
 * Output: a summary object — see the fields below.
 *
 * ⚠ ONE CLIENT'S FAILURE NEVER STOPS THE RUN, for the same reason commit 4's backfill records: a
 * job that aborts on the first bad client leaves a partial result and no list of what was missed.
 */
async function runRecaptureClients(pool, {
  contractorId,
  clientIds,
  getToken,
  logError = realLogError,
  onLine = () => {},
} = {}) {
  if (!contractorId) throw new Error('runRecaptureClients: contractorId is required');
  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    throw new Error('runRecaptureClients: at least one client id is required');
  }
  if (typeof getToken !== 'function') throw new Error('runRecaptureClients: getToken is required');

  const startedAt = Date.now();
  const { admitted, excluded } = await classifyRequested(pool, contractorId, clientIds);
  onLine(`[recaptureClients] ${contractorId}: ${admitted.length} admitted, ${excluded.length} excluded`);

  const summary = {
    contractorId,
    requested: clientIds.length,
    admitted: admitted.length,
    excluded,
    clients: [],
    captured: 0,
    failed: [],
    jobberCalls: 0,
    actualCost: 0,
    requestedCost: 0,
    pacedMs: 0,
    elapsedMs: null,
  };

  for (const jobberClientId of admitted) {
    let lastCost = null;
    const before = await snapshotClient(pool, { contractorId, jobberClientId });
    try {
      // ⚠ A TOKEN PER CLIENT, NOT ONE HELD ACROSS THE RUN — a sibling refresher rotates the
      // shared row, and a held token becomes a 401 on every remaining client.
      const token = await getToken(contractorId);

      const client = await fetchFullClient(jobberClientId, token, {
        door: DOOR,
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
      await withClientLock(pool, { contractorId, jobberClientId, door: DOOR }, async (tx) => {
        await captureClientFacts(tx, { contractorId, client });
        // `tx`, not `pool` — a read on another connection would sit outside the lock, which is
        // the lost-update the lock exists to prevent.
        const decided = await decideFromFacts(tx, { contractorId, jobberClientId });
        // ⚠ COALESCE, SO A NULL DECISION WOULD LEAVE THE STORED STAGE STANDING — null means "not
        // decided this pass", never "no stage", the same reading `upsertAndTagClient`'s upsert
        // encodes for this identical column.
        // ⚠ AND IT IS A GUARD AGAINST A VALUE THAT CANNOT OCCUR TODAY, SAID PLAINLY RATHER THAN
        // IMPLIED TO BE A LIVE BRANCH. Measured 2026-09-30: `classifyPipelineStatus` returns one
        // of exactly five strings on every path and NEVER null, so `decided.currentStatus` is
        // always a stage here and the COALESCE never fires. It is kept because it costs nothing,
        // because it matches the reading the same column already has one door along, and because
        // the day `decideFromFacts` gains a "could not decide" return this write must not blank a
        // real stage. A test pins the five-value claim, so the comment cannot rot into a guess.
        await tx.query(
          `UPDATE jobber_clients
              SET pipeline_stage = COALESCE($3::text, pipeline_stage),
                  last_synced_at = NOW()
            WHERE contractor_id = $1 AND jobber_client_id = $2`,
          [contractorId, jobberClientId, decided.currentStatus]
        );
      });

      const after = await snapshotClient(pool, { contractorId, jobberClientId });
      summary.clients.push({ id: jobberClientId, before, after });
      summary.captured += 1;
    } catch (err) {
      summary.failed.push({ id: jobberClientId, message: err.message });
      summary.clients.push({ id: jobberClientId, before, after: null, error: err.message });
      onLine(`[recaptureClients] FAILED ${jobberClientId}: ${err.message}`);
      await logError({
        req: null,
        contractorId,
        error: new Error(`[recaptureClients] re-capture failed for client ${jobberClientId}: ${err.message}`),
        source: 'recaptureClients — capture',
        alert: false,
      });
    }

    // ⚠ PACED AGAINST THE RESERVATION, which is what Jobber throttles on — it reserves
    // `requestedQueryCost` and refunds the unused part, so a capture is refused on the
    // reservation while the bucket still looks healthy against the actual spend.
    const paceMs = computeThrottlePaceDelayMs(lastCost?.throttleStatus, lastCost?.requestedQueryCost);
    if (paceMs > 0) {
      summary.pacedMs += paceMs;
      onLine(`[recaptureClients] pacing ${paceMs}ms — available ${lastCost?.throttleStatus?.currentlyAvailable}`);
      await _sleep(paceMs);
    }
  }

  summary.elapsedMs = Date.now() - startedAt;
  return summary;
}

/** The summary, formatted for a human. Returns an array of lines. */
function formatSummary(s) {
  const lines = [
    '',
    '── targeted re-capture ────────────────────────────────────────',
    `contractor          ${s.contractorId}`,
    `requested           ${s.requested}`,
    `admitted            ${s.admitted}`,
    `excluded            ${s.excluded.length}`,
  ];
  for (const e of s.excluded) lines.push(`  - ${e.id}: ${e.reason}`);
  lines.push(`captured            ${s.captured}`, `failed              ${s.failed.length}`);
  for (const f of s.failed) lines.push(`  - ${f.id}: ${f.message}`);
  lines.push('', 'PER CLIENT — facts and stage, before -> after:');
  for (const c of s.clients) {
    if (!c.after) {
      lines.push(`  ${c.id}  FAILED — ${c.error}`);
      continue;
    }
    const b = c.before;
    const a = c.after;
    lines.push(
      `  ${c.id}`,
      `      jobs ${b.job_facts}->${a.job_facts}  quotes ${b.quote_facts}->${a.quote_facts}` +
      `  invoices ${b.invoice_facts}->${a.invoice_facts}  requests ${b.request_facts}->${a.request_facts}` +
      `  links ${b.invoice_job_links}->${a.invoice_job_links}`,
      `      stage ${b.stage} -> ${a.stage}${b.stage === a.stage ? '  (unchanged)' : '  ** CHANGED **'}`
    );
  }
  lines.push(
    '',
    `Jobber calls        ${s.jobberCalls}`,
    `cost requested      ${s.requestedCost}`,
    `cost actual         ${s.actualCost}`,
    `paced               ${s.pacedMs}ms`,
    `elapsed             ${s.elapsedMs}ms`,
    '───────────────────────────────────────────────────────────────',
    ''
  );
  return lines;
}

module.exports = {
  runRecaptureClients,
  classifyRequested,
  snapshotClient,
  formatSummary,
  _setTestOverrides,
  _resetTestOverrides,
};
