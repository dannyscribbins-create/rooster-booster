'use strict';

// ── RECOMPUTING A CLIENT'S SALES (Canvass-stage, Ruling 1) ──────────────────
//
// Pages every job a client has, oldest first, groups them by the contractor's
// invoice_window_days, and upserts the result into client_sales / client_sale_jobs.
//
// ⚠ THE FENCE, AND IT IS THE MOST IMPORTANT LINE IN THIS FILE: THIS IS CONSUMED BY
// THE REP CONVERSIONS PATH ONLY. Wiring it into evaluateReferral() would change how
// much referrers are PAID, which is its own ruling and never a side effect of a rep
// feature. `evaluateReferral()` is not touched by this phase and a test pins that its
// behaviour is unchanged.
//
// ⚠ AND THE TWO NUMBERS MEASURE DIFFERENT THINGS ON PURPOSE (ruled 2026-09-21):
// a rep's CONVERSIONS count SALES, repeats included; a referrer's PAYOUTS count
// PEOPLE REFERRED — one per person, enforced by `UNIQUE(user_id, jobber_client_id)`
// on referral_conversions, which stays exactly as it is. **Do not "align" them.**

const axios = require('axios');
const { retryWithBackoff } = require('./retryWithBackoff');
const { jobberShouldRetry } = require('./retryHelpers');
const { groupJobsIntoSales } = require('./saleGrouping');

// ⚠ A DELIBERATELY MINIMAL SELECTION, AND THE COST IS WHY. Grouping needs an id and a
// date and nothing else. The fat `fetchClientRelatedData` query exists for
// classification and carries nested invoices, custom fields and tags —
// **measured on Accent 2026-09-21: a 10-job client query with nested invoices
// REQUESTED 173 and ACTUALLY cost 19.** Reusing it per webhook to read two fields
// would pay that repeatedly for data this function throws away.
//
// ⚠ PAGING IS PROVEN, NOT INFERRED. Measured by Danny in GraphiQL on Accent's live
// account, 2026-09-21, with the ascending CREATED_AT sort:
//   · after: null  -> the 2026-06-02T15:57:32Z job, hasNextPage true,  endCursor "MQ", requestedQueryCost 8
//   · after: "MQ"  -> the 2026-09-21T03:26:59Z job, hasNextPage false, endCursor "Mg", requestedQueryCost 8
// ⚠ VERSION CAVEAT KEPT: the explorer ran at 2026-05-12 and our client pins
// 2026-02-17. Strong evidence, not proof, for what our version receives — the same
// caveat every other probe in this arc carries.
const JOBS_PAGE_QUERY = `
  query GetClientJobsPaged($id: EncodedId!, $after: String) {
    client(id: $id) {
      jobs(first: 50, after: $after, sort: { key: CREATED_AT, direction: ASCENDING }) {
        nodes { id createdAt }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

// ⚠ A CAP ON THE PAGING ITSELF, BECAUSE AN UNBOUNDED LOOP OVER A THIRD PARTY IS THE
// Canvass-3.6 DEFECT. That phase found a `users` loop paging to exhaustion with no
// bound; this one is capped and reports a typed failure rather than spinning.
// 40 pages x 50 = 2,000 jobs for one client, which is far beyond any real account.
const MAX_JOB_PAGES = 40;

// test seam — inert in production, never called outside server/test/
let _axiosPost = (...args) => axios.post(...args);
function _setTestOverrides({ axiosPost } = {}) {
  if (axiosPost !== undefined) _axiosPost = axiosPost;
}
function _resetTestOverrides() {
  _axiosPost = (...args) => axios.post(...args);
}

/**
 * Every job for one client, oldest first.
 * ⚠ OLDEST-FIRST IS LOAD-BEARING, NOT TIDINESS. Grouping walks forward from an anchor,
 * so a run that stops early leaves a correct PREFIX of the sales rather than an
 * arbitrary middle — the newest sales are missing, which is recoverable, instead of
 * the anchors being wrong, which is not.
 */
async function fetchAllClientJobs(jobberClientId, token, { costTotals = null } = {}) {
  const jobs = [];
  let after = null;
  let hasNextPage = true;
  let pages = 0;

  while (hasNextPage) {
    if (++pages > MAX_JOB_PAGES) {
      throw new Error(`fetchAllClientJobs: exceeded ${MAX_JOB_PAGES} pages for client ${jobberClientId}`);
    }

    const response = await retryWithBackoff(
      () => _axiosPost(
        'https://api.getjobber.com/api/graphql',
        { query: JOBS_PAGE_QUERY, variables: { id: jobberClientId, after } },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
          },
        }
      ),
      { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
    );

    // ⚠ JOBBER ANSWERS A GraphQL FAILURE WITH HTTP 200 PLUS AN `errors` ARRAY, and
    // jobberShouldRetry reads only error.response.status — so retryWithBackoff resolves
    // happily on it. Without this the loop would read `nodes` as [] and report a client
    // with NO SALES, which is a wrong answer that looks exactly like a right one.
    const gqlErrors = response.data?.errors;
    if (gqlErrors?.length > 0) {
      throw new Error(`Jobber GraphQL error paging jobs for ${jobberClientId}: ${gqlErrors.map((e) => e.message).join('; ')}`);
    }

    // ⚠ COST IS ACCUMULATED RATHER THAN LOGGED PER CLIENT (Danny, 2026-09-22). This runs
    // once per re-paged client — 1,143 of them on Accent's first import — so a line each
    // would bury the step summary it belongs in. A caller that wants the number passes an
    // object and logs its own total; a caller that does not pays nothing. ⚠ THE POINT OF
    // IT IS STEP 2: adding job `total` to this query changes this cost, and "before" has
    // to be observable BEFORE the change, not reconstructed after it.
    const cost = response.data?.extensions?.cost;
    if (costTotals && cost) {
      costTotals.pages = (costTotals.pages || 0) + 1;
      costTotals.requested = (costTotals.requested || 0) + (Number(cost.requestedQueryCost) || 0);
      costTotals.actual = (costTotals.actual || 0) + (Number(cost.actualQueryCost) || 0);
    }

    const connection = response.data?.data?.client?.jobs;
    // ⚠ A NULL CONNECTION IS A FAILURE, NOT AN EMPTY CLIENT. `?.nodes || []` alone
    // would turn an unresolvable client into "this client has no jobs" and silently
    // delete every sale it had on the next recompute.
    if (!connection) {
      throw new Error(`fetchAllClientJobs: no jobs connection returned for client ${jobberClientId}`);
    }

    jobs.push(...(connection.nodes || []));
    hasNextPage = connection.pageInfo?.hasNextPage || false;
    after = connection.pageInfo?.endCursor || null;
    if (hasNextPage && !after) {
      // hasNextPage true with no cursor cannot be advanced; stopping is the only safe
      // move, and it must be loud rather than an infinite loop on the same page.
      throw new Error(`fetchAllClientJobs: hasNextPage with no endCursor for client ${jobberClientId}`);
    }
  }

  return jobs;
}

/** The contractor's configured grouping window, defaulting to the column's own default. */
async function windowDaysFor(db, contractorId) {
  // ⚠ THE CONTRACTOR'S OWN SETTING, SO THE ADMIN CONTROL THEY SEE MEANS SOMETHING.
  // `referral_schedules.invoice_window_days` is the field behind the admin panel's
  // "Invoice Grouping Window". ⚠ IT HAS NEVER BEEN READ BY ANYTHING UNTIL NOW — see
  // PRE_LAUNCH_CHECKLIST.md on the delivery gap, which is filed as its own
  // contractor-facing defect and is NOT fixed here.
  // ⚠ MAX(), not "the first row": a contractor may run several schedules, this is one
  // number, and taking whichever row the planner returned first would make the value
  // depend on row order. MAX is at least deterministic and is the more generous
  // grouping, which errs toward ONE sale rather than inventing two.
  const { rows } = await db.query(
    `SELECT MAX(invoice_window_days) AS days
       FROM referral_schedules
      WHERE contractor_id = $1 AND is_active = true`,
    [contractorId]
  );
  // ⚠ THE NULL CHECK IS SEPARATE FROM THE FINITE CHECK, AND COLLAPSING THEM IS A LIVE
  // DEFECT RATHER THAN A STYLE POINT. `MAX()` over zero rows returns NULL, and
  // `Number(null)` is **0** — which `Number.isFinite` happily accepts. Written as
  // `Number.isFinite(Number(days)) ? Number(days) : 20` this returned a 0-day window
  // for any contractor with no active schedule, making EVERY job its own sale and
  // inflating the headline conversions number on the rep's home screen. It was caught
  // by the "falls back to 20" case; nothing about the expression looks wrong.
  // ⚠ A deliberate 0 from a real row is still honoured — see groupJobsIntoSales, where
  // 0 means "every job is its own sale". The two cases are genuinely different and must
  // stay distinguishable: absent is not zero.
  const days = rows[0]?.days;
  if (days === null || days === undefined) return 20;
  const n = Number(days);
  return Number.isFinite(n) && n >= 0 ? n : 20;
}

/**
 * Recompute one client's sales from its full job list.
 * Returns { sales, jobs } counts.
 *
 * ⚠ ONE TRANSACTION. A recompute deletes the client's sales and rewrites them, so a
 * failure partway through would leave a client with FEWER conversions than it has —
 * a silent undercount on the rep's headline number.
 */
async function recomputeClientSales(pool, { contractorId, jobberClientId, jobs, windowDays }) {
  const groups = groupJobsIntoSales(jobs, windowDays);

  const tx = await pool.connect();
  try {
    await tx.query('BEGIN');

    // ⚠ DELETE-THEN-INSERT RATHER THAN A DIFF, AND THE UNIQUE MAKES IT SAFE. Regrouping
    // can MOVE a job between sales (a new job created inside an older window merges two
    // groups), so a diff would have to reason about membership changing owners. Rewriting
    // the client's sales from scratch cannot get that wrong, and the whole operation is
    // one client's rows inside one transaction.
    await tx.query(
      `DELETE FROM client_sales WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [contractorId, jobberClientId]
    );

    let jobRows = 0;
    for (const g of groups) {
      const { rows } = await tx.query(
        `INSERT INTO client_sales
           (contractor_id, jobber_client_id, anchor_at, last_event_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (contractor_id, jobber_client_id, anchor_at) DO UPDATE
           SET last_event_at = EXCLUDED.last_event_at, updated_at = NOW()
         RETURNING id`,
        [contractorId, jobberClientId, g.anchorAt, g.lastEventAt]
      );
      const saleId = rows[0].id;
      for (const jobId of g.jobIds) {
        await tx.query(
          `INSERT INTO client_sale_jobs (sale_id, contractor_id, jobber_job_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (contractor_id, jobber_job_id) DO UPDATE SET sale_id = EXCLUDED.sale_id`,
          [saleId, contractorId, jobId]
        );
        jobRows += 1;
      }
    }

    await tx.query('COMMIT');
    return { sales: groups.length, jobs: jobRows };
  } catch (err) {
    try { await tx.query('ROLLBACK'); } catch { /* connection already unusable */ }
    throw err;
  } finally {
    tx.release();
  }
}

/** Fetch + group + persist, for a caller that holds a token. */
async function refreshClientSales(pool, { contractorId, jobberClientId, token }) {
  const jobs = await fetchAllClientJobs(jobberClientId, token);
  const windowDays = await windowDaysFor(pool, contractorId);
  return recomputeClientSales(pool, { contractorId, jobberClientId, jobs, windowDays });
}

module.exports = {
  fetchAllClientJobs,
  recomputeClientSales,
  refreshClientSales,
  windowDaysFor,
  MAX_JOB_PAGES,
  _setTestOverrides,
  _resetTestOverrides,
};
