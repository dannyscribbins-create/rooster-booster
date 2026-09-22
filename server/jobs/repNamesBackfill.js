'use strict';

// ── REP STEP 4, STANDALONE — NAMING THE ROWLESS CLIENTS OF AN IMPORT THAT PREDATES IT ──
//
// Ruled by Danny 2026-09-22: "148 calls is minutes; Danny should not wait for a 1 h 45 m
// import to name 11 rows in his own book." Rep Step 4 (repImportScope.js) names rowless
// rep-scope clients INSIDE an import — but Accent's first run finished before Step 4
// existed, so its 148 are still rowless. This names them WITHOUT an import.
//
// ⚠ A ONE-OFF JOB THAT RUNS AT BOOT, NOT AN ADMIN ACTION. It is needed exactly once per
// contractor whose import predates Step 4 — every import from here on names inline — so a
// permanent route and button would outlive their only use. Pushing deploys, the deploy
// boots, and this runs in the background after initDB(). The Railway log carries
// "Rep names backfill — <contractor> — N rowless rep-scope clients" and then Step 4's own
// "Rep Step 4 — names complete — …" line.
//
// ⚠ THE SAME FENCE AS REP STEP 4, BECAUSE IT IS REP STEP 4. The per-client work is
// nameMissingClients() itself — identity fetched before any write, rows marked
// rep_scope_only, no contact_tags, ON CONFLICT DO NOTHING. Nothing here writes a row.
//
// ⚠ ONE-OFF BY A CLAIM, NOT BY MEMORY. contractor_crm_settings.rep_names_checked_at is
// set when this CLAIMS a contractor (before any call), and by every completed import's
// rep scope (recordBookWindow). So it runs only for a contractor with rep facts whose
// last import predates Step 4 — and at most once, even across overlapping deploys.
// ⚠ If a deploy kills it mid-run, the claim stays set and the remainder is NOT retried
// on the next boot. To re-run: set rep_names_checked_at back to NULL and restart. Every
// write is ON CONFLICT DO NOTHING, so a re-run only names what is still rowless.

const { pool } = require('../db');
const { nameMissingClients } = require('./repImportScope');
const { classifyPipelineStatus } = require('../crm/pipelineSync');
const { getFreshContractorAccessToken } = require('../crm/jobber');
const { logError: realLogError } = require('../middleware/errorLogger');

/**
 * The rep-scope clients with no jobber_clients row, rebuilt from what the import STORED —
 * the same set the in-import Step 4 derives from its three sweeps, with no Jobber call.
 *   · requests and quotes: the fact tables hold only the rep window's, by construction.
 *   · jobs: a client with a sale whose last job falls on or after rep_window_start had a
 *     job inside the window. ⚠ NOT every client_sales row — grouping re-paged older
 *     clients in full, so a sale that ENDS before the window is history, not scope.
 *     (A NULL rep_window_start makes that branch contribute nothing, which is correct:
 *     no rep import has completed, so there is no window to be inside.)
 *
 * Stage is computed exactly as writeStages computes it for a missing client: jobs and
 * quote statuses, no invoices — so 'sold' at most, never 'paid'. The jobs are the ones
 * grouping stored for the client, which for a rowless client exist only if it had a
 * window job; the verdict is therefore the one the import itself would have written.
 *
 * @returns [{ clientId, stage }] ordered by client id
 */
async function findRowlessRepClients(db, contractorId) {
  const { rows } = await db.query(
    `WITH ids AS (
       SELECT jobber_client_id FROM crm_request_facts WHERE contractor_id = $1
       UNION
       SELECT jobber_client_id FROM crm_quote_facts WHERE contractor_id = $1
       UNION
       SELECT cs.jobber_client_id
         FROM client_sales cs
         JOIN contractor_crm_settings s ON s.contractor_id = cs.contractor_id
        WHERE cs.contractor_id = $1 AND cs.last_event_at >= s.rep_window_start
     )
     SELECT ids.jobber_client_id AS client_id,
            (SELECT COUNT(*)::int
               FROM client_sale_jobs j JOIN client_sales cs ON cs.id = j.sale_id
              WHERE cs.contractor_id = $1 AND cs.jobber_client_id = ids.jobber_client_id) AS jobs,
            COALESCE((SELECT array_agg(q.quote_status)
                        FROM crm_quote_facts q
                       WHERE q.contractor_id = $1 AND q.jobber_client_id = ids.jobber_client_id),
                     '{}') AS quote_statuses
       FROM ids
      WHERE NOT EXISTS (SELECT 1 FROM jobber_clients jc
                         WHERE jc.contractor_id = $1 AND jc.jobber_client_id = ids.jobber_client_id)
      ORDER BY 1`,
    [contractorId]
  );
  return rows.map((r) => ({
    clientId: r.client_id,
    stage: classifyPipelineStatus({
      jobs: { nodes: Array.from({ length: r.jobs }, () => ({ invoices: { nodes: [] } })) },
      quotes: { nodes: r.quote_statuses.map((s) => ({ quoteStatus: s })) },
    }),
  }));
}

/**
 * Name one contractor's rowless rep-scope clients, if it has not been done.
 * Returns null when another run (or a completed import) already claimed it, else
 * { rowless, named, notFound, failed, requested, actual }.
 */
async function runRepNamesBackfill(db, { contractorId, getToken, logError = realLogError }) {
  const claim = await db.query(
    `UPDATE contractor_crm_settings SET rep_names_checked_at = NOW()
      WHERE contractor_id = $1 AND rep_names_checked_at IS NULL`,
    [contractorId]
  );
  if (claim.rowCount !== 1) return null;

  const missing = await findRowlessRepClients(db, contractorId);
  // diagnostic log — intentional
  console.log(`[repNamesBackfill] Rep names backfill — ${contractorId} — ${missing.length} rowless rep-scope clients`);
  const totals = await nameMissingClients(db, { contractorId, missing, getToken, logError });
  return { rowless: missing.length, ...totals };
}

/**
 * Boot entry point: every contractor with rep facts and no names check yet.
 * Fire-and-forget from server.js — it never throws, so a Jobber outage at boot costs a
 * logged error and nothing else.
 */
async function startRepNamesBackfill(db = pool, { getToken = getFreshContractorAccessToken, logError = realLogError } = {}) {
  try {
    const { rows } = await db.query(
      `SELECT s.contractor_id FROM contractor_crm_settings s
        WHERE s.rep_names_checked_at IS NULL
          AND EXISTS (SELECT 1 FROM crm_request_facts f WHERE f.contractor_id = s.contractor_id)
        ORDER BY 1`
    );
    const results = [];
    for (const { contractor_id: contractorId } of rows) {
      try {
        results.push(await runRepNamesBackfill(db, { contractorId, getToken: () => getToken(contractorId), logError }));
      } catch (err) {
        await logError({ req: null, contractorId, error: err, source: 'repNamesBackfill', alert: false });
      }
    }
    return results;
  } catch (err) {
    await logError({ req: null, error: err, source: 'repNamesBackfill — contractor scan', alert: false });
    return [];
  }
}

module.exports = { startRepNamesBackfill, runRepNamesBackfill, findRowlessRepClients };
