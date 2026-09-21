'use strict';

// ── THE REP SCOPE OF THE FULL IMPORT (Canvass-stage backfill, Danny 2026-09-21) ──
//
// Three rep steps that run AFTER the campaign import has finished, fetch the rep
// window's requests, quotes and jobs, and write ONLY:
//   · crm_request_facts / crm_quote_facts   (the history the attribution replay reads)
//   · jobber_clients.pipeline_stage          (fill-only, UPDATE-only — see below)
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
// first: 100, created after 2025-09-21 (explorer 2026-05-12; this code pins 2026-02-17):
//   requests  requested 1506 · actual 1174 · 67 pages
//   quotes    requested  906 · actual  906 · 96 pages
//   jobs      requested  406 · actual  406 · 61 pages
// ⚠ VERSION CAVEAT, SAME AS EVERY PROBE IN THIS ARC: the createdAt filter on these three
// connections was observed at 2026-05-12, not at our pinned version. If it is absent at
// 2026-02-17 the whole query fails — and that surfaces HERE as a GraphQL error, loudly,
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
        assessment { id assignedUsers(first: 5) { nodes { id } } }
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
const REP_JOBS_QUERY = `
  query RepJobs($since: ISO8601DateTime!, $after: String) {
    jobs(first: 100, after: $after, filter: { createdAt: { after: $since } }) {
      nodes {
        id createdAt
        client { id createdAt }
      }
      pageInfo { hasNextPage endCursor }
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
 * Page one rep connection to exhaustion, handing each page's nodes to onPage.
 * Paced on Jobber's own requestedQueryCost (ruling 8) — never a hardcoded page cost.
 * Returns { pages, nodes, requested, actual } for the step's summary log line.
 */
async function pageRepConnection({ label, query, dataPath, since, getToken, onPage }) {
  let after = null;
  let hasNextPage = true;
  let pages = 0;
  let nodesSeen = 0;
  let requested = 0;
  let actual = 0;
  let throttleRetries = 0;

  while (hasNextPage) {
    if (pages >= MAX_REP_PAGES) {
      throw new Error(`${label}: page cap (${MAX_REP_PAGES}) reached — run is incomplete`);
    }
    const token = await getToken();
    const response = await retryWithBackoff(
      () => _axiosPost(
        'https://api.getjobber.com/api/graphql',
        { query, variables: { since, after } },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
          },
        }
      ),
      { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
    );

    const cost = response.data?.extensions?.cost;
    const gqlErrors = response.data?.errors;
    if (gqlErrors?.length > 0) {
      const throttled = gqlErrors.some((e) => e.extensions?.code === 'THROTTLED' || e.message === 'Throttled');
      if (throttled) {
        throttleRetries += 1;
        if (throttleRetries > MAX_THROTTLE_RETRIES) {
          throw new Error(`${label}: throttle retry limit exceeded on page ${pages + 1}`);
        }
        const wait = computeThrottlePaceDelayMs(cost?.throttleStatus, cost?.requestedQueryCost)
          || THROTTLE_FALLBACK_WAIT_MS;
        // diagnostic log — intentional
        console.log(`[fullJobberImport] ${label} throttled on page ${pages + 1} (retry ${throttleRetries}) — waiting ${wait}ms`);
        await _sleep(wait);
        continue; // same page, same cursor
      }
      // ⚠ JOBBER ANSWERS A GraphQL FAILURE WITH HTTP 200, so retryWithBackoff resolves on it.
      // Reading `nodes` as [] here would record a window with NO history — a wrong answer
      // that looks exactly like a quiet account.
      throw new Error(`${label}: Jobber GraphQL error on page ${pages + 1}: ${gqlErrors.map((e) => e.message).join('; ')}`);
    }
    throttleRetries = 0;

    const connection = response.data?.data?.[dataPath];
    if (!connection) throw new Error(`${label}: no ${dataPath} connection on page ${pages + 1}`);

    pages += 1;
    const nodes = connection.nodes || [];
    nodesSeen += nodes.length;
    if (cost) {
      requested += Number(cost.requestedQueryCost) || 0;
      actual += Number(cost.actualQueryCost) || 0;
    }
    await onPage(nodes);

    hasNextPage = !!connection.pageInfo?.hasNextPage;
    after = connection.pageInfo?.endCursor || null;
    if (hasNextPage && !after) {
      throw new Error(`${label}: hasNextPage with no endCursor on page ${pages}`);
    }
    if (hasNextPage) {
      const wait = computeThrottlePaceDelayMs(cost?.throttleStatus, cost?.requestedQueryCost);
      if (wait > 0) await _sleep(wait);
    }
  }

  // ⚠ NAMED DISTINCTLY FROM THE CAMPAIGN STEPS SO THE RAILWAY LOG SAYS WHICH SCOPE RAN.
  // diagnostic log — intentional
  console.log(`[fullJobberImport] ${label} complete — ${pages} pages, ${nodesSeen} nodes, `
    + `cost requested=${requested} actual=${actual}`);
  return { pages, nodes: nodesSeen, requested, actual };
}

async function writeRequestFacts(db, contractorId, nodes) {
  const rows = nodes.filter((n) => n?.id && n.createdAt && n.client?.id);
  if (rows.length === 0) return 0;
  await db.query(
    `INSERT INTO crm_request_facts
       (contractor_id, jobber_request_id, jobber_client_id, created_at,
        salesperson_jobber_user_id, assessment_id, assigned_jobber_user_ids)
     SELECT $1, r.id, r.client_id, r.created_at, r.sp, r.aid, r.assigned
       FROM unnest($2::text[], $3::text[], $4::timestamptz[], $5::text[], $6::text[], $7::jsonb[])
         AS r(id, client_id, created_at, sp, aid, assigned)
     ON CONFLICT (contractor_id, jobber_request_id) DO UPDATE SET
       jobber_client_id           = EXCLUDED.jobber_client_id,
       created_at                 = EXCLUDED.created_at,
       salesperson_jobber_user_id = EXCLUDED.salesperson_jobber_user_id,
       assessment_id              = EXCLUDED.assessment_id,
       assigned_jobber_user_ids   = EXCLUDED.assigned_jobber_user_ids`,
    [
      contractorId,
      rows.map((n) => n.id),
      rows.map((n) => n.client.id),
      rows.map((n) => n.createdAt),
      rows.map((n) => n.salesperson?.id || null),
      rows.map((n) => n.assessment?.id || null),
      // ⚠ ATOMIC PER ASSESSMENT — the people on ONE assessment stay together (ruling 1).
      rows.map((n) => JSON.stringify((n.assessment?.assignedUsers?.nodes || []).map((u) => u.id).filter(Boolean))),
    ]
  );
  return rows.length;
}

async function writeQuoteFacts(db, contractorId, nodes) {
  const rows = nodes.filter((n) => n?.id && n.client?.id);
  if (rows.length === 0) return 0;
  await db.query(
    `INSERT INTO crm_quote_facts
       (contractor_id, jobber_quote_id, jobber_client_id, quote_status, approved_at,
        salesperson_jobber_user_id, created_at)
     SELECT $1, q.id, q.client_id, q.status, q.approved_at, q.sp, q.created_at
       FROM unnest($2::text[], $3::text[], $4::text[], $5::timestamptz[], $6::text[], $7::timestamptz[])
         AS q(id, client_id, status, approved_at, sp, created_at)
     ON CONFLICT (contractor_id, jobber_quote_id) DO UPDATE SET
       jobber_client_id           = EXCLUDED.jobber_client_id,
       quote_status               = EXCLUDED.quote_status,
       approved_at                = EXCLUDED.approved_at,
       salesperson_jobber_user_id = EXCLUDED.salesperson_jobber_user_id,
       created_at                 = EXCLUDED.created_at`,
    [
      contractorId,
      rows.map((n) => n.id),
      rows.map((n) => n.client.id),
      rows.map((n) => n.quoteStatus || null),
      rows.map((n) => n.lastTransitioned?.approvedAt || null),
      rows.map((n) => n.salesperson?.id || null),
      rows.map((n) => n.createdAt || null),
    ]
  );
  return rows.length;
}

/**
 * Stage for every rep-scope client. ⚠ FILL-ONLY AND UPDATE-ONLY, and both halves are
 * deliberate.
 *   · UPDATE-ONLY: the rep steps never CREATE a jobber_clients row — Danny's standing
 *     guard, which keeps row creation with the writers that carry a full client payload
 *     (name, email, phone). A rep-scope client with no row is counted and reported.
 *   · FILL-ONLY (`pipeline_stage IS NULL`): this step sees only the window, and no
 *     invoices at all, so it cannot say 'paid' and cannot see a job older than the window.
 *     Step H+I, which ran first, classified every row it wrote from full history. Letting
 *     the narrower view overwrite it would REGRESS a correct 'paid' to 'sold'.
 */
async function writeStages(db, contractorId, clientIds, jobsByClient) {
  let staged = 0;
  let noRow = 0;
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
      if (rows.length === 0) noRow += 1;
    }
  }
  return { staged, noRow };
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

  for (const [clientId, windowJobs] of jobsByClient) {
    try {
      const created = clientCreatedAt.get(clientId);
      let jobs = windowJobs;
      if (!created || new Date(created) < windowStart) {
        jobs = await fetchAllClientJobs(clientId, await getToken());
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
  return { clients, sales, paged, failed };
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
  summary.jobs = await pageRepConnection({
    label: 'Rep Step 3 — jobs',
    query: REP_JOBS_QUERY,
    dataPath: 'jobs',
    since,
    getToken,
    onPage: async (nodes) => {
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

  onStep('Rep stages');
  summary.stages = await writeStages(db, contractorId, [...clientIds].sort(), jobsByClient);
  // diagnostic log — intentional
  console.log(`[fullJobberImport] Rep stages complete — ${clientIds.size} rep-scope clients, `
    + `${summary.stages.staged} newly staged, ${summary.stages.noRow} with no jobber_clients row (stage not written)`);

  onStep('Rep sales');
  summary.sales = await groupSales(db, { contractorId, jobsByClient, clientCreatedAt, windowStart, getToken, logError });
  // diagnostic log — intentional
  console.log(`[fullJobberImport] Rep sales complete — ${summary.sales.clients} clients grouped into `
    + `${summary.sales.sales} sales (${summary.sales.paged} re-paged in full), ${summary.sales.failed} failed`);

  summary.clients = clientIds.size;
  return summary;
}

module.exports = {
  runRepScope,
  repWindowStart,
  pageRepConnection,
  MAX_REP_PAGES,
  REP_REQUESTS_QUERY,
  REP_QUOTES_QUERY,
  REP_JOBS_QUERY,
  _setTestOverrides,
  _resetTestOverrides,
};
