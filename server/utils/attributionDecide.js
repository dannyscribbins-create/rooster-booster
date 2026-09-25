'use strict';

// ── ONE DECISION PATH — decideFromFacts (3d Phase 1a Commit 4) ───────────────
//
// R5i: live and replay must decide from the SAME saved facts using the SAME code. This module
// is that code. It replaced `stageFor` in server/utils/attributionReplay.js, which is deleted.
//
// ⚠ Q6 — jobber_clients.pipeline_stage IS NOT A DECISION INPUT, AND THAT IS THE POINT OF THE
// REWRITE. `stageFor` read it FIRST and returned it when set, so the decision inherited whatever
// the display column happened to say. The column stays, still written by the handlers, still what
// the rep surface shows — but nothing here reads it. **If you are about to add a read of
// pipeline_stage to this file, that is the change this commit exists to prevent.**
//
// ⚠ AND THE CONSEQUENCE, STATED RATHER THAN DISCOVERED: from this commit until Q6's follow-up,
// the DISPLAYED stage and the DECISION's status are derived from two different things and can
// disagree. Accepted and temporary; it is on PRE_LAUNCH_CHECKLIST.md.
//
// ⚠ NOT WIRED TO ANY LIVE DOOR IN THIS COMMIT, DELIBERATELY. The webhooks,
// server/cron/jobs/repRequestSweep.js and server/utils/requestAttribution.js still derive
// currentStatus from a LIVE fetch, and they must, because Commit 5 is what makes them CAPTURE
// facts. Switching them now would read an empty fact set for every uncaptured client, return
// 'lead', and — because attributionEngine's GATE_EXCLUSIONS is ['lead','inspection','not_sold']
// — the sticky gate would never fire. That is a silent loss of the highest-confidence
// attribution, and it looks exactly like nothing happening.

const { classifyPipelineStatus } = require('../crm/pipelineSync');

/**
 * Is this invoice PAID, for the purposes of a decision? (Danny's ruling, 2026-09-25.)
 * Inputs: an object carrying invoiceStatus, invoiceBalance and total — numbers or the
 *         NUMERIC strings node-postgres returns.
 * Output: boolean.
 *
 * ⚠ ALL THREE CONDITIONS, AND EACH ONE EXCLUDES A REAL SHAPE THAT THE STATUS ALONE ADMITS:
 *   · invoiceStatus = 'paid'  — excludes `voided` and `bad_debt`. A written-off invoice has a
 *                               zero balance by definition, so balance alone would count a write
 *                               -off as revenue.
 *   · invoiceBalance = 0      — excludes a `paid` invoice still carrying a balance after a
 *                               credit or adjustment.
 *   · total > 0               — excludes a $0 invoice, which is zero-value work and must never
 *                               move a client to 'paid'.
 *
 * ⚠ THIS IS STRICTER THAN THE REST OF THE CODEBASE, ON PURPOSE AND TEMPORARILY. Seven sites still
 * test `invoiceStatus === 'paid'` alone (pipelineSync, fullJobberImport, referralRules,
 * admin/campaigns, the invoice-paid webhook, deriveJobberTags twice). They disagree with this
 * helper in exactly two shapes — status paid with a non-zero balance, and status paid with total
 * 0 — and moving them onto this helper is filed on PRE_LAUNCH_CHECKLIST.md as its own commit.
 * ⚠ ONE HELPER, NOT A COPIED PREDICATE. When those seven move, they move onto THIS function.
 */
function isInvoicePaid(invoice) {
  if (!invoice) return false;
  if (invoice.invoiceStatus !== 'paid') return false;

  // NUMERIC arrives as a string from node-postgres; Number() on null is 0, which would read as a
  // settled balance, so a null is rejected before it can be parsed into a false positive.
  if (invoice.invoiceBalance === null || invoice.invoiceBalance === undefined) return false;
  if (invoice.total === null || invoice.total === undefined) return false;

  const balance = Number(invoice.invoiceBalance);
  const total = Number(invoice.total);
  if (!Number.isFinite(balance) || !Number.isFinite(total)) return false;

  return balance === 0 && total > 0;
}

/**
 * Derives the decision's currentStatus, and the client object the engine reads, from SAVED FACTS.
 * Inputs: a db/pool, the contractor id, the Jobber client id.
 * Output: { currentStatus, client } where client is the connection shape the engine and
 *         classifyPipelineStatus both read — client.quotes.nodes and client.jobs.nodes, each job
 *         carrying invoices.nodes.
 *
 * ⚠ classifyPipelineStatus IS CALLED UNMODIFIED. The stricter paid rule is applied by FILTERING
 * each job's invoices to those isInvoicePaid accepts, so the classifier's own
 * `invoiceStatus === 'paid'` test sees only invoices that already satisfy all three conditions.
 * Editing the classifier instead would change every surface that shares it.
 *
 * ⚠ EVERY READ IS contractor_id-SCOPED AND EVERY ORDER IS PINNED WITH A DETERMINISTIC TIEBREAK.
 * The quote order is load-bearing: attributionEngine picks the most recently approved eligible
 * quote with a `reduce` that KEEPS the incumbent on a tie, so two quotes approved at the same
 * instant resolve by whichever arrived first. Unordered, that is whatever Postgres felt like.
 */
async function decideFromFacts(db, { contractorId, jobberClientId }) {
  if (!contractorId) throw new Error('decideFromFacts: contractorId is required');
  if (!jobberClientId) throw new Error('decideFromFacts: jobberClientId is required');

  const { rows: quoteRows } = await db.query(
    `SELECT jobber_quote_id, quote_status, approved_at, salesperson_jobber_user_id
       FROM crm_quote_facts
      WHERE contractor_id = $1 AND jobber_client_id = $2
      ORDER BY approved_at DESC NULLS LAST, jobber_quote_id ASC`,
    [contractorId, jobberClientId]
  );

  // ⚠ TWO SOURCES OF "THIS CLIENT HAS A JOB", UNIONED, AND BOTH ARE SAVED FACTS.
  // crm_job_facts is the richer one and arrives with Commit 3b's import. client_sale_jobs is what
  // `stageFor` leaned on before job facts existed, and it still holds real Jobber job ids. Until
  // every contractor has re-imported under 3b, dropping it would regress a client from 'sold' to
  // 'lead' — a status change with no fact behind it. The union is strictly more correct than
  // either alone, and becomes redundant rather than wrong once the imports have run.
  const { rows: jobRows } = await db.query(
    `SELECT jobber_job_id FROM crm_job_facts
      WHERE contractor_id = $1 AND jobber_client_id = $2
      UNION
     SELECT csj.jobber_job_id
       FROM client_sale_jobs csj
       JOIN client_sales cs
         ON cs.id = csj.sale_id AND cs.contractor_id = csj.contractor_id
      WHERE csj.contractor_id = $1 AND cs.jobber_client_id = $2
      ORDER BY jobber_job_id ASC`,
    [contractorId, jobberClientId]
  );

  const jobIds = jobRows.map((r) => r.jobber_job_id);

  // ⚠ A SALE WITH NO JOB IDS IS STILL EVIDENCE OF A JOB, AND OMITTING THIS REGRESSED A TEST.
  // `stageFor` asked `SELECT 1 FROM client_sales` — EXISTENCE — whereas the union above needs a
  // client_sale_jobs row to produce an id. A sale can exist with no rows in that table, and the
  // first draft of this function then returned 'lead' for a client the old code called 'sold'.
  // That is a status change with no fact behind it, so the existence check is kept: client_sales
  // is a saved fact, and a sale cannot exist without a job.
  // ⚠ The synthetic node carries NO invoices, so it can raise a client to 'sold' and never to
  // 'paid' — exactly the ceiling stageFor's own comment described.
  let syntheticFromSale = false;
  if (jobIds.length === 0) {
    const { rows: sales } = await db.query(
      `SELECT 1 FROM client_sales WHERE contractor_id = $1 AND jobber_client_id = $2 LIMIT 1`,
      [contractorId, jobberClientId]
    );
    syntheticFromSale = sales.length > 0;
  }

  // Invoices linked to any of this client's jobs, with the link's job id so each job carries its
  // own. ⚠ An invoice can cover several jobs, so it appears under each — that is the view keyed
  // by job, and it is deliberately not the set a VALUE would be summed over.
  let invoiceRows = [];
  if (jobIds.length > 0) {
    ({ rows: invoiceRows } = await db.query(
      `SELECT l.jobber_job_id, f.jobber_invoice_id, f.invoice_status, f.invoice_balance, f.total
         FROM crm_invoice_job_links l
         JOIN crm_invoice_facts f
           ON f.contractor_id = l.contractor_id AND f.jobber_invoice_id = l.jobber_invoice_id
        WHERE l.contractor_id = $1 AND l.jobber_job_id = ANY($2::text[])
        ORDER BY l.jobber_job_id ASC, f.jobber_invoice_id ASC`,
      [contractorId, jobIds]
    ));
  }

  const paidByJob = new Map();
  for (const r of invoiceRows) {
    const invoice = {
      id: r.jobber_invoice_id,
      invoiceStatus: r.invoice_status,
      invoiceBalance: r.invoice_balance,
      total: r.total,
    };
    if (!isInvoicePaid(invoice)) continue;
    if (!paidByJob.has(r.jobber_job_id)) paidByJob.set(r.jobber_job_id, []);
    // ⚠ THE LITERAL 'paid' IS DELIBERATE, AND IT IS WHAT MAKES isInvoicePaid THE ONLY DECIDER.
    // classifyPipelineStatus tests `inv.invoiceStatus === 'paid'` itself. Passing the row's RAW
    // status through meant the classifier re-filtered, so the helper's status condition was
    // redundant — and the voided and bad_debt cases then PASSED with that condition deleted,
    // because the classifier excluded them instead. My own tests could not tell the two apart.
    // Every invoice reaching this line has already satisfied all three conditions, so marking it
    // 'paid' states that conclusion rather than laundering a status: the ruling is applied in one
    // place, and deleting any part of it now fails a test.
    paidByJob.get(r.jobber_job_id).push({ id: invoice.id, invoiceStatus: 'paid' });
  }

  const jobNodes = jobIds.map((id) => ({ id, invoices: { nodes: paidByJob.get(id) || [] } }));
  if (syntheticFromSale) {
    jobNodes.push({ id: null, invoices: { nodes: [] } });
  }

  const client = {
    quotes: { nodes: quoteRows.map(toEngineQuote) },
    jobs: { nodes: jobNodes },
  };

  return { currentStatus: classifyPipelineStatus(client), client };
}

/**
 * One saved quote fact, in the shape the engine reads.
 * ⚠ Moved here from attributionReplay.js with decideFromFacts, because the decision owns the
 * shape it decides from. The replay imports it rather than keeping a second copy.
 */
function toEngineQuote(row) {
  return {
    id: row.jobber_quote_id,
    quoteStatus: row.quote_status,
    lastTransitioned: { approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null },
    salesperson: row.salesperson_jobber_user_id ? { id: row.salesperson_jobber_user_id } : null,
  };
}

module.exports = { decideFromFacts, isInvoicePaid, toEngineQuote };
