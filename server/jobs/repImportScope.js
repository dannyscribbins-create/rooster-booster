'use strict';

// ── THE REP SCOPE OF THE FULL IMPORT (Canvass-stage backfill, Danny 2026-09-21) ──
//
// Three rep steps that run AFTER the campaign import has finished, fetch the rep
// window's requests, quotes and jobs, and write ONLY:
//   · crm_request_facts / crm_quote_facts   (the history the attribution replay reads)
//   · jobber_clients.pipeline_stage          (fill-only, UPDATE-only — see below)
//   · jobber_clients rows WITH full identity  (Rep Step 4, only for clients with none;
//                                              rep_scope_only, no tags — repScopeRows.js)
//   · contractor_crm_settings.rep_window_start (where the rep's book starts) and
//     rep_names_checked_at (Step 4 ran — see repNamesBackfill.js)
//   · client_sales / client_sale_jobs        (via the existing recomputeClientSales)
//
// ⚠ WHY THESE ARE SEPARATE STEPS AND NOT A FILTER ON CAMPAIGN STEPS C/D/E — RULING 2.
// deriveAndSaveTags() (server/utils/deriveJobberTags.js) builds the `request:*`,
// `quote:*`, `job:*`, `job_type:*`, `job_count:*` and `recency:*` tags, plus the
// work_category / material_type / assigned_rep / insurance tags off the latest job, out
// of the import's Step C/D/E arrays — and evaluateAudience()
// (server/cron/jobs/dynamicAudiences.js) selects campaign audiences from contact_tags.
// So filtering those sweeps to the rep window would silently change the tags of older
// paying clients, and therefore WHO RECEIVES CAMPAIGNS. Steps A–I are untouched: same
// filters, same selections, same pacing. The ~7 minutes this costs buys the isolation.
// ⚠ AND THIS FILE READS NOTHING THE CAMPAIGN STEPS FETCHED, IN EITHER DIRECTION. Reusing
// their in-memory arrays would be cheaper and would couple rep correctness to their
// shape — the day someone filters Step C, rep sale grouping would silently truncate.
//
// ⚠ IT SENDS NOTHING AND CREATES NO REFERRER-SIDE RECORD. No import path here reaches
// Resend, Twilio, pendingReferral, the notifications table or contact_tags. The fence
// in server/test/repImportScope.test.js counts that, with a positive control.

const axios = require('axios');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../utils/retryHelpers');
const { computeThrottlePaceDelayMs, classifyPipelineStatus } = require('../crm/pipelineSync');
const { fetchAllClientJobs, recomputeClientSales, windowDaysFor } = require('../utils/clientSales');
const {
  writeRequestFacts,
  writeQuoteFacts,
  writeJobFacts,
  writeInvoiceFacts,
  writeInvoiceJobLinks,
} = require('../utils/factCapture');
const { logError: realLogError } = require('../middleware/errorLogger');

// ── THE REP WINDOW (ruling 4) ─────────────────────────────────────────────────
// No second control: the window follows the import mode's effective date.
//   recommended  → 12 months
//   custom_date  → the chosen date
//   paying_only  → 12 months (stated in that option's copy in CRMSettings.jsx)
//   pull_all     → 12 months. ⚠ pull_all is accepted by the API and absent from the UI
//                  (filed); 12 months is chosen so an API-only caller cannot trigger an
//                  unbounded full-history rep sweep.
function repWindowStart(filterPreference, now = new Date()) {
  if (filterPreference?.mode === 'custom_date' && filterPreference.customDate) {
    const d = new Date(filterPreference.customDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(now);
  d.setMonth(d.getMonth() - 12);
  return d;
}

// ── THE THREE QUERIES ─────────────────────────────────────────────────────────
// Selections are the ones Danny measured on Accent's live account, 2026-09-21,
// first: 100, created after 2025-09-21 (explorer 2026-05-12; this code now pins 2026-05-12):
//   requests  requested 1506 · actual 1174 · 67 pages
//   quotes    requested  906 · actual  906 · 96 pages
//   jobs      requested  406 · actual  406 · 61 pages
// ⚠ THE VERSION CAVEAT THIS ARC CARRIED IS CLOSED: the createdAt filter on these three
// connections was observed at 2026-05-12, and the 2-pre bump made 2026-05-12 our pinned
// version, so the observation and the client now agree. The failure path is kept anyway —
// if the filter is ever absent the whole query fails, and that surfaces HERE, loudly,
// AFTER the campaign import has already completed and committed. It cannot degrade into
// an unfiltered sweep, because a failed query is thrown, never retried without the filter.
// ⚠ EVERY NESTED CONNECTION CARRIES AN EXPLICIT first: (ruling 8) — assignedUsers(first: 5)
// is the only one. Five people on one assessment is far beyond any real visit.
// ⚠ ONE SCALAR IS ADDED TO THE MEASURED JOBS SELECTION: client { createdAt }. It is what
// lets sale grouping skip a per-client Jobber call for every client created inside the
// window — see groupSales below. A scalar on an already-selected object; negligible cost.
const REP_REQUESTS_QUERY = `
  query RepRequests($since: ISO8601DateTime!, $after: String) {
    requests(first: 100, after: $after, filter: { createdAt: { after: $since } }) {
      nodes {
        id createdAt
        client { id }
        salesperson { id }
        assessment { id assignedUsers(first: 5) { nodes { id } pageInfo { hasNextPage } } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;
const REP_QUOTES_QUERY = `
  query RepQuotes($since: ISO8601DateTime!, $after: String) {
    quotes(first: 100, after: $after, filter: { createdAt: { after: $since } }) {
      nodes {
        id createdAt quoteStatus
        client { id }
        salesperson { id }
        lastTransitioned { approvedAt }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;
// ── THE FACT-WRITER FIELD SETS (3d Phase 1a Commit 3b) ───────────────────────
// ⚠ THESE MUST CARRY EVERY FIELD THE FACT WRITERS READ, AND IT IS ENFORCED RATHER THAN
// REMEMBERED. The mechanical fence in server/test/captureFetchContract.test.js derives each
// writer's reads from server/utils/factCapture.js and fails on any field read but not selected —
// and since 3b it covers THESE constants too, not only the live capture path. That fence exists
// because Commit 3's writers read 42 field/selection pairs no query selected, including
// `updatedAt`, which left the staleness guard inert in production while its unit tests were green.
//
// ⚠ IDENTICAL TO THE LIVE PATH BY CONSTRUCTION, WHICH IS WHAT R5i ACTUALLY REQUIRES. The import
// and the webhooks must produce the same fact row for the same Jobber object, so the honest way
// to get there is one field list per entity rather than two lists someone keeps in step. These
// mirror JOB_FIELDS and INVOICE_FIELDS in server/utils/jobberClientFetch.js; the fence compares
// both against the same derived read set, so a divergence fails on one side or the other.
//
// ⚠ ALL FIELDS VERIFIED AT THE PINNED 2026-05-12 by Danny's introspection — see the note at
// JOB_FIELDS in server/utils/jobberClientFetch.js for the type-by-type list.
// ⚠ `client { id createdAt }` IS INSIDE THIS CONSTANT, AND THE FENCE IS WHY. The first draft kept
// it on its own line in REP_JOBS_QUERY, reasoning that the QUERY still selected it — and the fence
// went red naming `client`, correctly: it checks the per-entity CONSTANT, because that is the unit
// a writer is fed from. A field selected somewhere else in the document is the whole-query
// looseness this fence was built to remove, so the constant was wrong rather than the check.
// ⚠ `createdAt` on the client is the import's own need, not the job writer's: groupSales reads it
// to decide sale re-paging. The live JOB_FIELDS selects `client { id }` only, and both satisfy the
// fence — the writer reads `client.id` and nothing more.
const REP_JOB_FIELDS = `id jobNumber jobStatus jobType title
        createdAt updatedAt startAt endAt completedAt
        total invoicedTotal uninvoicedTotal
        client { id createdAt } quote { id } request { id } salesperson { id }`;

const REP_INVOICE_FIELDS = `id invoiceNumber invoiceStatus
          createdAt updatedAt issuedDate dueDate receivedDate
          client { id }
          amounts { total subtotal invoiceBalance paymentsTotal
                    depositAmount discountAmount taxAmount }
          jobs(first: 50) { nodes { id } pageInfo { hasNextPage } }
          archivedJobs(first: 50) { nodes { id } pageInfo { hasNextPage } }`;

const REP_JOBS_QUERY = `
  query RepJobs($since: ISO8601DateTime!, $after: String) {
    jobs(first: 100, after: $after, filter: { createdAt: { after: $since } }) {
      nodes {
        ${REP_JOB_FIELDS}
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

// ⚠ PER CLIENT, NOT A TOP-LEVEL SWEEP, AND THE REASON IS THE WINDOW. §4.3 governs the import's
// REACH — 12 months by activity — and the rep scope's client set is already the answer to that
// question. Storage itself has NO window (Q5), so this fetches a rep-scope client's invoices to
// exhaustion regardless of date: an invoice raised this month can settle a job from before the
// window, and clipping the FETCH would lose the sale's value rather than merely its display.
const REP_CLIENT_INVOICES_QUERY = `
  query RepClientInvoices($id: EncodedId!, $after: String) {
    client(id: $id) {
      invoices(first: 50, after: $after) {
        nodes {
          ${REP_INVOICE_FIELDS}
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

// ⚠ A CAP ON THE PAGING, BECAUSE AN UNBOUNDED LOOP OVER A THIRD PARTY IS THE Canvass-3.6
// DEFECT. 600 pages x 100 = 60,000 nodes of one kind in the window — six times the
// largest measured (quotes, 96 pages). Hitting it is a typed failure, not a clean stop.
const MAX_REP_PAGES = 600;
const MAX_THROTTLE_RETRIES = 10;
// Used only when Jobber's throttle response carries no usable cost object, so
// computeThrottlePaceDelayMs returns 0 — a zero wait on a throttle is a hot loop.
const THROTTLE_FALLBACK_WAIT_MS = 5000;

// ── TEST SEAM ─────────────────────────────────────────────────────────────────
// test seam — inert in production, never called outside server/test/
let _axiosPost = (...args) => axios.post(...args);
let _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// test seam — inert in production, never called outside server/test/
function _setTestOverrides({ axiosPost, sleep } = {}) {
  if (axiosPost !== undefined) _axiosPost = axiosPost;
  if (sleep !== undefined) _sleep = sleep;
}
// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() {
  _axiosPost = (...args) => axios.post(...args);
  _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One rep-scope GraphQL request, retried through Jobber's throttle.
 * Shared by the three paged steps and by Rep Step 4's per-client identity fetch, so
 * every rep call is paced and failed the same way.
 * Returns { data, cost } — `data` is response.data.data, `cost` is extensions.cost.
 * Throws on any non-throttle GraphQL error: Jobber answers those with HTTP 200, so
 * retryWithBackoff resolves on them, and reading an empty result instead would record
 * a window with NO history — a wrong answer that looks exactly like a quiet account.
 */
async function repRequest({ label, query, variables, getToken }) {
  for (let throttleRetries = 0; ; throttleRetries += 1) {
    const token = await getToken();
    const response = await retryWithBackoff(
      () => _axiosPost(
        'https://api.getjobber.com/api/graphql',
        { query, variables },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-05-12',
          },
        }
      ),
      { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
    );
    const cost = response.data?.extensions?.cost;
    const gqlErrors = response.data?.errors;
    if (!gqlErrors?.length) return { data: response.data?.data, cost };

    const throttled = gqlErrors.some((e) => e.extensions?.code === 'THROTTLED' || e.message === 'Throttled');
    if (!throttled) {
      throw new Error(`${label}: Jobber GraphQL error: ${gqlErrors.map((e) => e.message).join('; ')}`);
    }
    if (throttleRetries >= MAX_THROTTLE_RETRIES) {
      throw new Error(`${label}: throttle retry limit exceeded`);
    }
    const wait = computeThrottlePaceDelayMs(cost?.throttleStatus, cost?.requestedQueryCost)
      || THROTTLE_FALLBACK_WAIT_MS;
    // diagnostic log — intentional
    console.log(`[fullJobberImport] ${label} throttled (retry ${throttleRetries + 1}) — waiting ${wait}ms`);
    await _sleep(wait); // then the SAME request again — same cursor, same client
  }
}

// Adds one response's cost into a step's running totals.
function addCost(totals, cost) {
  if (!cost) return;
  totals.requested += Number(cost.requestedQueryCost) || 0;
  totals.actual += Number(cost.actualQueryCost) || 0;
}

// Waits what Jobber's own cost report says the NEXT call needs (ruling 8).
async function paceAfter(cost) {
  const wait = computeThrottlePaceDelayMs(cost?.throttleStatus, cost?.requestedQueryCost);
  if (wait > 0) await _sleep(wait);
}

/**
 * Page one rep connection to exhaustion, handing each page's nodes to onPage.
 * Paced on Jobber's own requestedQueryCost (ruling 8) — never a hardcoded page cost.
 * Returns { pages, nodes, requested, actual } for the step's summary log line.
 */
async function pageRepConnection({ label, query, dataPath, since, getToken, onPage }) {
  let after = null;
  let hasNextPage = true;
  const totals = { pages: 0, nodes: 0, requested: 0, actual: 0 };

  while (hasNextPage) {
    if (totals.pages >= MAX_REP_PAGES) {
      throw new Error(`${label}: page cap (${MAX_REP_PAGES}) reached — run is incomplete`);
    }
    const { data, cost } = await repRequest({ label, query, variables: { since, after }, getToken });
    const connection = data?.[dataPath];
    if (!connection) throw new Error(`${label}: no ${dataPath} connection on page ${totals.pages + 1}`);

    totals.pages += 1;
    const nodes = connection.nodes || [];
    totals.nodes += nodes.length;
    addCost(totals, cost);
    await onPage(nodes);

    hasNextPage = !!connection.pageInfo?.hasNextPage;
    after = connection.pageInfo?.endCursor || null;
    if (hasNextPage && !after) {
      throw new Error(`${label}: hasNextPage with no endCursor on page ${totals.pages}`);
    }
    if (hasNextPage) await paceAfter(cost);
  }

  // ⚠ NAMED DISTINCTLY FROM THE CAMPAIGN STEPS SO THE RAILWAY LOG SAYS WHICH SCOPE RAN.
  // diagnostic log — intentional
  console.log(`[fullJobberImport] ${label} complete — ${totals.pages} pages, ${totals.nodes} nodes, `
    + `cost requested=${totals.requested} actual=${totals.actual}`);
  return totals;
}

/**
 * Pages ONE rep-scope client's invoices to exhaustion and writes the facts.
 * Inputs: db, contractorId, the Jobber client id, getToken, and a totals object for cost.
 * Output: { invoices, links } counts.
 * Throws: on a GraphQL error (repRequest's contract), on a missing connection, on a cursor
 *         anomaly, and — via the writers — on an incomplete invoice job set.
 *
 * ⚠ IT GOES THROUGH repRequest, NOT axios, SO IT INHERITS THE IMPORT'S WHOLE CONTRACT: the
 * errors array is a failure, a throttle is retried on Jobber's own cost report, and every
 * response's cost is added to the step totals. Calling axios directly here would be a second
 * fetch contract in the same file — which is the shape that let the live path and the import
 * drift apart in the first place.
 * ⚠ AND NO FIXED CAP SILENTLY DROPS RECORDS (N3): hasNextPage with no endCursor throws, and the
 * page cap throws rather than returning a short set.
 */
async function captureClientInvoices(db, { contractorId, clientId, getToken, totals }) {
  let after = null;
  let pages = 0;
  let invoices = 0;
  let links = 0;

  for (;;) {
    if (pages >= MAX_REP_PAGES) {
      throw new Error(`Rep invoices: client ${clientId} exceeded ${MAX_REP_PAGES} pages — refusing a partial set`);
    }
    const { data, cost } = await repRequest({
      label: `Rep invoices — client ${clientId}`,
      query: REP_CLIENT_INVOICES_QUERY,
      variables: { id: clientId, after },
      getToken,
    });
    pages += 1;
    addCost(totals, cost);

    const connection = data?.client?.invoices;
    if (!connection) {
      throw new Error(`Rep invoices: no invoices connection for client ${clientId} on page ${pages}`);
    }
    const nodes = connection.nodes || [];

    // ⚠ THE SAME WRITERS THE LIVE PATH USES. R5i is satisfied by calling the same functions with
    // the same node shape, not by two writers that agree today.
    invoices += await writeInvoiceFacts(db, contractorId, nodes);
    links += await writeInvoiceJobLinks(db, contractorId, nodes);

    const hasNext = !!connection.pageInfo?.hasNextPage;
    after = connection.pageInfo?.endCursor || null;
    if (hasNext && !after) {
      throw new Error(`Rep invoices: client ${clientId} reported hasNextPage with no endCursor on page ${pages}`);
    }
    if (!hasNext) break;
    await paceAfter(cost);
  }

  return { invoices, links };
}

/**
 * Stage for every rep-scope client. ⚠ FILL-ONLY AND UPDATE-ONLY, and both halves are
 * deliberate.
 *   · UPDATE-ONLY: this step never CREATES a jobber_clients row. A rep-scope client with
 *     no row is returned in `missing`, with the stage computed here, and Rep Step 4
 *     creates its row WITH full identity — never a nameless one (Danny, 2026-09-22).
 *   · FILL-ONLY (`pipeline_stage IS NULL`): this step sees only the window, and no
 *     invoices at all, so it cannot say 'paid' and cannot see a job older than the window.
 *     Step H+I, which ran first, classified every row it wrote from full history. Letting
 *     the narrower view overwrite it would REGRESS a correct 'paid' to 'sold'.
 */
async function writeStages(db, contractorId, clientIds, jobsByClient) {
  let staged = 0;
  const missing = [];
  for (const clientId of clientIds) {
    const { rows: quoteRows } = await db.query(
      `SELECT quote_status FROM crm_quote_facts WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [contractorId, clientId]
    );
    const stage = classifyPipelineStatus({
      jobs: { nodes: (jobsByClient.get(clientId) || []).map((j) => ({ id: j.id, invoices: { nodes: [] } })) },
      quotes: { nodes: quoteRows.map((q) => ({ quoteStatus: q.quote_status })) },
    });
    const res = await db.query(
      `UPDATE jobber_clients SET pipeline_stage = $3
        WHERE contractor_id = $1 AND jobber_client_id = $2 AND pipeline_stage IS NULL`,
      [contractorId, clientId, stage]
    );
    if (res.rowCount > 0) {
      staged += 1;
    } else {
      const { rows } = await db.query(
        `SELECT 1 FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2`,
        [contractorId, clientId]
      );
      if (rows.length === 0) missing.push({ clientId, stage });
    }
  }
  return { staged, noRow: missing.length, missing };
}

/**
 * Sale grouping for every client with a job in the window (ruling 6).
 *
 * ⚠ A CLIENT CREATED INSIDE THE WINDOW HAS NO JOB OLDER THAN IT, so the window's jobs ARE
 * its full history and grouping them is exact. Every OTHER client may have jobs before the
 * window — and recomputeClientSales rewrites ALL of a client's sales, so grouping a
 * truncated list would both split a sale that straddles the window start (a wrong anchor)
 * and delete every older sale. Those clients are re-paged in full, oldest first, with the
 * existing fetchAllClientJobs — which is also what keeps a client over the old first: 50
 * cap from losing sales.
 */
async function groupSales(db, { contractorId, jobsByClient, clientCreatedAt, windowStart, getToken, logError }) {
  const windowDays = await windowDaysFor(db, contractorId);
  let sales = 0;
  let clients = 0;
  let paged = 0;
  let failed = 0;
  // The re-paging cost, which had no logging at all until 2026-09-22 — see
  // fetchAllClientJobs. It is the baseline Step 2's job `total` will be measured against.
  const pagingCost = { pages: 0, requested: 0, actual: 0 };

  for (const [clientId, windowJobs] of jobsByClient) {
    try {
      const created = clientCreatedAt.get(clientId);
      let jobs = windowJobs;
      if (!created || new Date(created) < windowStart) {
        jobs = await fetchAllClientJobs(clientId, await getToken(), { costTotals: pagingCost });
        paged += 1;
      }
      const result = await recomputeClientSales(db, { contractorId, jobberClientId: clientId, jobs, windowDays });
      sales += result.sales;
      clients += 1;
    } catch (err) {
      failed += 1;
      await logError({
        req: null,
        contractorId,
        error: new Error(`fullJobberImport Rep sales — client ${clientId}: ${err.message}`),
        source: 'fullJobberImport — rep sale grouping',
        alert: false,
      });
    }
  }
  return { clients, sales, paged, failed, windowDays, pagingCost };
}

// ── REP STEP 4 — NAMES (Danny, 2026-09-22) ────────────────────────────────────
// The same identity fields Step A selects, for ONE client. `emails` and `phones` are
// plain lists, not connections, so ruling 8's first: does not apply to them.
// ⚠ `client(id:)` IS PROVEN at 2026-05-12 — fetchFullClient and the per-client Steps
// B–E of the campaign import use it under that exact header. It was proven at the previous
// pin 2026-02-17 too, and the five intervening versions removed and retyped nothing.
const REP_CLIENT_IDENTITY_QUERY = `
  query RepClientIdentity($id: EncodedId!) {
    client(id: $id) {
      id firstName lastName isCompany isLead isArchived
      emails { address primary }
      phones { number primary }
    }
  }
`;

/**
 * Create a NAMED jobber_clients row for each rep-scope client that has none.
 *
 * ⚠ THE EARLIER BAN WAS ON NAMELESS ROWS, AND THIS DOES NOT CREATE ONE. A row is written
 * only after its identity has been fetched; a client Jobber cannot return is counted
 * and skipped, never written blank.
 * ⚠ IT FETCHES ONLY THE MISSING IDS — the three rep sweeps are not widened (ruling 3).
 * ⚠ THE ROW IS MARKED rep_scope_only AND WRITES NO contact_tags, so it joins no
 * campaign audience and the matching pass never links it (server/utils/repScopeRows.js).
 * ⚠ ON CONFLICT DO NOTHING: if a campaign-side writer created the row meanwhile, its
 * row — and its tags — win, and this step does not touch it.
 *
 * @param missing  [{ clientId, stage }] from writeStages
 * @returns { named, notFound, failed, requested, actual }
 */
async function nameMissingClients(db, { contractorId, missing, getToken, logError }) {
  const totals = { named: 0, notFound: 0, failed: 0, requested: 0, actual: 0 };
  for (const { clientId, stage } of missing) {
    try {
      const { data, cost } = await repRequest({
        label: 'Rep Step 4 — names', query: REP_CLIENT_IDENTITY_QUERY, variables: { id: clientId }, getToken,
      });
      addCost(totals, cost);
      const c = data?.client;
      if (!c?.id) {
        totals.notFound += 1;
      } else {
        const email = c.emails?.find((e) => e.primary)?.address || c.emails?.[0]?.address || null;
        const phone = c.phones?.find((p) => p.primary)?.number || c.phones?.[0]?.number || null;
        const res = await db.query(
          `INSERT INTO jobber_clients
             (jobber_client_id, contractor_id, first_name, last_name, email, phone,
              is_company, is_lead, is_archived, pipeline_stage, rep_scope_only, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW())
           ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING`,
          [clientId, contractorId, c.firstName || null, c.lastName || null, email, phone,
            c.isCompany === true, c.isLead === true, c.isArchived === true, stage]
        );
        if (res.rowCount > 0) totals.named += 1;
      }
      await paceAfter(cost);
    } catch (err) {
      totals.failed += 1;
      await logError({
        req: null,
        contractorId,
        error: new Error(`fullJobberImport Rep Step 4 — client ${clientId}: ${err.message}`),
        source: 'fullJobberImport — rep names',
        alert: false,
      });
    }
  }
  // diagnostic log — intentional
  console.log(`[fullJobberImport] Rep Step 4 — names complete — ${missing.length} clients with no row, `
    + `${totals.named} named, ${totals.notFound} not found in Jobber, ${totals.failed} failed, `
    + `cost requested=${totals.requested} actual=${totals.actual}`);
  return totals;
}

/**
 * Record where this contractor's rep book starts (the COUNT clip — see repBook.js's
 * SALES_IN_BOOK_WINDOW). ⚠ LEAST, so a later import can only move it EARLIER: history
 * already fetched stays valid, and a Recommended re-run a year from now must not drop a
 * year of the book. Postgres LEAST ignores NULL, so the first run simply sets it.
 * Written only after the rep scope has completed, so a failed run never claims a window
 * it did not fill.
 * ⚠ It also stamps rep_names_checked_at: Step 4 has just run inline, so the standalone
 * boot backfill (repNamesBackfill.js) has nothing to do for this contractor.
 */
async function recordBookWindow(db, contractorId, windowStart) {
  await db.query(
    `INSERT INTO contractor_crm_settings (contractor_id, rep_window_start, rep_names_checked_at) VALUES ($1, $2, NOW())
     ON CONFLICT (contractor_id) DO UPDATE
       SET rep_window_start = LEAST(contractor_crm_settings.rep_window_start, EXCLUDED.rep_window_start),
           rep_names_checked_at = NOW()`,
    [contractorId, windowStart]
  );
}

/**
 * Run the rep scope. Called by runFullJobberImport AFTER the campaign import completes.
 * `onStep(label)` lets the caller surface progress on importState.
 */
async function runRepScope(db, { contractorId, filterPreference, getToken, onStep = () => {}, logError = realLogError, now = new Date() }) {
  const windowStart = repWindowStart(filterPreference, now);
  const since = windowStart.toISOString();
  // diagnostic log — intentional
  console.log(`[fullJobberImport] Rep scope — window starts ${since} (mode ${filterPreference?.mode})`);

  const clientIds = new Set();
  const summary = { windowStart: since };

  onStep('Rep Step 1 — requests');
  let requestFacts = 0;
  summary.requests = await pageRepConnection({
    label: 'Rep Step 1 — requests',
    query: REP_REQUESTS_QUERY,
    dataPath: 'requests',
    since,
    getToken,
    onPage: async (nodes) => {
      requestFacts += await writeRequestFacts(db, contractorId, nodes);
      for (const n of nodes) if (n?.client?.id) clientIds.add(n.client.id);
    },
  });
  summary.requests.facts = requestFacts;

  onStep('Rep Step 2 — quotes');
  let quoteFacts = 0;
  summary.quotes = await pageRepConnection({
    label: 'Rep Step 2 — quotes',
    query: REP_QUOTES_QUERY,
    dataPath: 'quotes',
    since,
    getToken,
    onPage: async (nodes) => {
      quoteFacts += await writeQuoteFacts(db, contractorId, nodes);
      for (const n of nodes) if (n?.client?.id) clientIds.add(n.client.id);
    },
  });
  summary.quotes.facts = quoteFacts;

  onStep('Rep Step 3 — jobs');
  const jobsByClient = new Map();
  const clientCreatedAt = new Map();
  let jobFacts = 0;
  summary.jobs = await pageRepConnection({
    label: 'Rep Step 3 — jobs',
    query: REP_JOBS_QUERY,
    dataPath: 'jobs',
    since,
    getToken,
    onPage: async (nodes) => {
      // ⚠ THE FULL NODES GO TO THE FACT WRITER; jobsByClient KEEPS ITS FLATTENED SHAPE.
      // groupSales reads { id, createdAt } off jobsByClient, and widening that map to the raw
      // node would hand a second consumer a shape it did not ask for — the mismatch CLAUDE.md
      // records as vacuity shape #12, where one fetch feeds two consumers needing opposite
      // shapes. Writing facts from `nodes` and grouping from the flattened copy keeps both
      // contracts explicit.
      jobFacts += await writeJobFacts(db, contractorId, nodes);
      for (const n of nodes) {
        const cid = n?.client?.id;
        if (!cid || !n.id) continue;
        clientIds.add(cid);
        if (!jobsByClient.has(cid)) jobsByClient.set(cid, []);
        jobsByClient.get(cid).push({ id: n.id, createdAt: n.createdAt });
        if (n.client.createdAt) clientCreatedAt.set(cid, n.client.createdAt);
      }
    },
  });
  summary.jobs.facts = jobFacts;

  // ── REP STEP 3b — INVOICES FOR THE REP-SCOPE CLIENTS ────────────────────────
  // ⚠ WHY A SEPARATE STEP AND NOT PART OF STEP 3: Jobber's top-level `invoices` connection
  // cannot be filtered to this client set, and an invoice's DATE is not the sale's date — an
  // invoice raised this month can settle a job from before the window. So invoices are fetched
  // PER CLIENT, over the client set §4.3's window already produced, and to exhaustion (Q5:
  // storage has no window).
  // ⚠ A PER-CLIENT FAILURE IS RECORDED AND THE SWEEP CONTINUES, which is the established shape
  // for this file's per-client work (Rep Step 4 does the same). One client's bad invoice must not
  // cost the whole import the rep scope — and the failure is a LOUD row in error_log, never a
  // silent zero.
  onStep('Rep Step 3b — invoices');
  const invoiceTotals = { requested: 0, actual: 0 };
  summary.invoices = { clients: 0, invoices: 0, links: 0, failed: 0, cost: invoiceTotals };
  for (const clientId of [...clientIds].sort()) {
    try {
      const { invoices, links } = await captureClientInvoices(db, {
        contractorId, clientId, getToken, totals: invoiceTotals,
      });
      summary.invoices.clients += 1;
      summary.invoices.invoices += invoices;
      summary.invoices.links += links;
    } catch (invErr) {
      summary.invoices.failed += 1;
      await logError({
        req: null,
        contractorId,
        error: new Error(`Rep Step 3b — invoices failed for client ${clientId}: ${invErr.message}`),
        source: 'fullJobberImport — rep invoices',
        alert: false,
      });
    }
  }
  // diagnostic log — intentional
  console.log(`[fullJobberImport] Rep Step 3b complete — ${summary.invoices.clients} clients, `
    + `${summary.invoices.invoices} invoice facts, ${summary.invoices.links} job links, `
    + `${summary.invoices.failed} failed, cost requested=${invoiceTotals.requested} actual=${invoiceTotals.actual}`);

  onStep('Rep stages');
  const { missing, ...stageCounts } = await writeStages(db, contractorId, [...clientIds].sort(), jobsByClient);
  summary.stages = stageCounts;
  // diagnostic log — intentional
  console.log(`[fullJobberImport] Rep stages complete — ${clientIds.size} rep-scope clients, `
    + `${summary.stages.staged} newly staged, ${summary.stages.noRow} with no jobber_clients row (named in Rep Step 4)`);

  onStep('Rep Step 4 — names');
  summary.names = await nameMissingClients(db, { contractorId, missing, getToken, logError });

  onStep('Rep sales');
  summary.sales = await groupSales(db, { contractorId, jobsByClient, clientCreatedAt, windowStart, getToken, logError });
  // diagnostic log — intentional
  console.log(`[fullJobberImport] Rep sales complete — ${summary.sales.clients} clients grouped into `
    + `${summary.sales.sales} sales (${summary.sales.paged} re-paged in full), ${summary.sales.failed} failed, `
    + `window ${summary.sales.windowDays}d chained, re-paging cost ${summary.sales.pagingCost.pages} pages `
    + `requested=${summary.sales.pagingCost.requested} actual=${summary.sales.pagingCost.actual}`);

  // Only now — every rep step has completed — is the window a claim about filled history.
  await recordBookWindow(db, contractorId, windowStart);

  summary.clients = clientIds.size;
  return summary;
}

module.exports = {
  runRepScope,
  repWindowStart,
  pageRepConnection,
  nameMissingClients,
  MAX_REP_PAGES,
  REP_CLIENT_IDENTITY_QUERY,
  REP_REQUESTS_QUERY,
  REP_QUOTES_QUERY,
  REP_JOBS_QUERY,
  REP_CLIENT_INVOICES_QUERY,
  // ⚠ THE PER-ENTITY FIELD CONSTANTS, exported so the mechanical reads-vs-selects fence covers
  // the IMPORT's queries and not only the live capture path. Per-entity rather than the whole
  // query, because a whole-query check passes when the field appears anywhere in it.
  REP_JOB_FIELDS,
  REP_INVOICE_FIELDS,
  captureClientInvoices,
  _setTestOverrides,
  _resetTestOverrides,
};
