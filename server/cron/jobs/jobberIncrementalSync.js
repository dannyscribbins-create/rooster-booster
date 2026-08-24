const cron = require('node-cron');
const axios = require('axios');
const { withLock } = require('../withLock');
const { pool } = require('../../db');
const { logError } = require('../../middleware/errorLogger');
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../../utils/retryHelpers');
const deriveAndSaveTags = require('../../utils/deriveJobberTags');
const { runContactMatchingPass } = require('../../jobs/contactMatchingPass');
const { evaluateAudience } = require('./dynamicAudiences');
const { getFreshContractorAccessToken } = require('../../crm/jobber');

// ── TEST SEAM (Wave 0.2 item 4e) ──────────────────────────────────────────────
// Inert in production, never called outside server/test/. This exists because T5
// and T6 previously reached this module by patching node-cron's schedule and
// axios.post on the shared require cache — sound, documented, and exactly the kind
// of cleverness that rots the moment someone changes how the module loads.
// Declared here, above its callers, rather than beside module.exports: a `let` read
// before initialisation is a TDZ throw, and relying on "the module finishes loading
// before anything calls it" is a timing argument, not a guarantee.
let _axiosPost = (...args) => axios.post(...args);

// test seam — inert in production, never called outside server/test/
function _setTestOverrides({ axiosPost } = {}) {
  if (axiosPost !== undefined) _axiosPost = axiosPost;
}
// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() {
  _axiosPost = (...args) => axios.post(...args);
}

async function runIncrementalSync() {
  const { rows: contractorRows } = await pool.query(
    'SELECT id FROM contractors WHERE status = $1',
    ['active']
  );
  for (const { id: contractorId } of contractorRows) {
    await runForContractor(contractorId);
  }
}

async function runForContractor(contractorId) {
  // ── SANCTIONED TOKEN PATH (Wave 0.2 item 3) ─────────────────────────────────
  // ⚠ THIS IS WHERE THE RESIDUAL 401s CAME FROM. Confirmed 2026-08-23: 52 occurrences
  // under source cron:jobber_incremental_sync, last seen 2026-08-16. This function
  // used to raw-SELECT the token, compare expires_at to now, and RETURN if expired —
  // giving up rather than refreshing, and disabling the backstop under exactly the
  // condition that makes the backstop necessary.
  //
  // BEHAVIOUR CHANGE, and it is the point of the fix: an expired token is now
  // refreshed and the sync proceeds, where before it silently did nothing. The
  // no-token skip is preserved, and is now recorded rather than a console line.
  //
  // ⚠ CLOSED BY ITEM 4b — this note used to read "STILL OPEN". It is kept, corrected,
  // because the state it described was real: this function acquired ONE token and held
  // it across the whole run, and a concurrent pipelineSync refresh rotated it out from
  // under long loops. Both loops below now re-acquire immediately before use. This
  // acquisition remains the first one, and its only job is to fail fast when the
  // contractor has no usable token at all.
  let token;
  try {
    token = await getFreshContractorAccessToken(contractorId);
  } catch (tokenErr) {
    await logError({
      req: null,
      contractorId,
      error: new Error(`jobberIncrementalSync: no usable Jobber token for contractor ${contractorId} — sync skipped: ${tokenErr.message}`),
      source: 'jobberIncrementalSync — token',
    });
    console.warn(`[jobberIncrementalSync] no usable Jobber token for ${contractorId} — skipping`);
    return;
  }

  // Pull clients updated within the last 25 hours (covers 30-min overlap)
  console.log('[jobberIncrementalSync] Fetching recently updated clients...');
  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

  // ── PAGINATION (Wave 0.2 item 4a) ───────────────────────────────────────────
  // $after was DECLARED in this query and never bound, and pageInfo was SELECTED
  // and never read — so the sync silently processed at most one page of 50 clients
  // per night and logged "Done — N clients processed" either way. A truncated run
  // and a complete run emitted an identical, healthy-looking line, which is why the
  // cap survived unnoticed. Test T5 pins the row count, never the log.
  //
  // ⚠ THE filter CLAUSE IS NOT TOUCHED HERE, DELIBERATELY. On 2026-05-25 this query
  // shipped with `filter: { status: active, updatedAt: { gte: ... } }` and Jobber
  // rejected it — InputObject 'ClientFilterAttributes' does not accept those args
  // (error_log, count 1; fixed the next day in fb23079). `updatedAt: { after: ... }`
  // is the accepted form and is independently corroborated by pipelineSync.js using
  // it successfully. Pagination changes first/after/variables only. If a change to
  // this file ever needs to edit `filter:`, that is the signal to re-verify in
  // GraphiQL first, per CLAUDE.md's standing rule.
  //
  // ⚠ Throttling is NOT the constraint that shaped this loop. Exactly one throttle
  // event exists in the entire error_log (2026-05-25, never repeated), and the live
  // budget is maximumAvailable 10,000 with restoreRate 500/s — a cost-7 single-client
  // query left 9,993 available (measured in GraphiQL 2026-08-23). A 50-node page of
  // this selection set sits far inside that, so no pacing helper is warranted here.
  // The observed per-page cost is logged below so the figure stays measured.
  const RECENT_CLIENTS_QUERY = `
    query GetRecentClients($after: String) {
      clients(
        filter: { updatedAt: { after: "${twentyFiveHoursAgo}" } }
        first: 50
        after: $after
      ) {
        nodes {
          id firstName lastName isCompany isLead isArchived createdAt
          emails { address primary }
          phones { number primary }
          tags { nodes { label } }
          customFields {
            ... on CustomFieldText { label valueText }
            ... on CustomFieldDropdown { label valueDropdown }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  const recentClients = [];
  let cursor = null;
  let hasNextPage = true;
  let pageNo = 0;

  while (hasNextPage) {
    pageNo += 1;
    // Re-acquire per page, same reasoning as the per-client loop below. Paging is
    // short, but a rotation between page 1 and page 2 would abort the fetch with a
    // 401 and lose every page after it.
    try {
      token = await getFreshContractorAccessToken(contractorId);
    } catch (tokenErr) {
      await logError({
        req: null,
        contractorId,
        error: new Error(`jobberIncrementalSync: lost the Jobber token while paging (page ${pageNo}) — ${recentClients.length} clients fetched so far: ${tokenErr.message}`),
        source: 'jobberIncrementalSync — token',
      });
      console.warn(`[jobberIncrementalSync] token lost while paging for ${contractorId} — stopping the fetch`);
      return;
    }

    const clientsResponse = await retryWithBackoff(
      () => _axiosPost(
        'https://api.getjobber.com/api/graphql',
        { query: RECENT_CLIENTS_QUERY, variables: { after: cursor } },
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

    // Jobber may not support the updatedAt filter — if the filter returns a GraphQL
    // error we log it and exit gracefully. Unchanged from the pre-pagination code,
    // except that it now aborts the whole paged fetch rather than a single request.
    const gqlErrors = clientsResponse.data?.errors;
    if (gqlErrors?.length > 0) {
      const msg = gqlErrors.map(e => e.message).join('; ');
      console.warn('[jobberIncrementalSync] Jobber filter error:', msg);
      await logError({ req: null, error: new Error(msg), source: 'jobberIncrementalSync — clients filter' });
      return;
    }

    const connection = clientsResponse.data?.data?.clients;
    if (!connection) break;

    recentClients.push(...(connection.nodes || []));

    // diagnostic log — intentional. Keeps the per-page cost MEASURED rather than
    // assumed, against the 10,000 budget noted above.
    const cost = clientsResponse.data?.extensions?.cost;
    if (cost) {
      console.log(`[jobberIncrementalSync] page ${pageNo}: ${(connection.nodes || []).length} nodes, actualQueryCost ${cost.actualQueryCost}, ${cost.throttleStatus?.currentlyAvailable}/${cost.throttleStatus?.maximumAvailable} available`);
    }

    hasNextPage = !!connection.pageInfo?.hasNextPage;
    cursor      = connection.pageInfo?.endCursor || null;
    if (hasNextPage && !cursor) break; // defensive: no cursor means no next page to ask for
  }

  if (recentClients.length === 0) {
    console.log('[jobberIncrementalSync] No recently updated clients — done');
    return;
  }

  console.log(`[jobberIncrementalSync] Processing ${recentClients.length} updated clients...`);

  let contractorFieldMappings = {};
  try {
    const mappingsResult = await pool.query(
      'SELECT contractor_field_mappings FROM contractor_settings WHERE contractor_id = $1',
      [contractorId]
    );
    contractorFieldMappings = mappingsResult.rows[0]?.contractor_field_mappings || {};
  } catch {
    // fall through — deriveAndSaveTags uses hardcoded label defaults
  }

  const updatedIds = [];

  // For each recently updated client, fetch their full related data individually
  // (jobs/invoices/quotes/requests) using targeted queries keyed by client ID.
  for (const client of recentClients) {
    try {
      // ── TOKEN RE-ACQUISITION, PER CLIENT (Wave 0.2 item 4b) ─────────────────
      // Item 3 closed only the give-up-on-expiry half of this job's 401s. This is
      // the other half: the run used to acquire ONE token and hold it across this
      // entire loop, so a concurrent pipelineSync refresh — which rotates the
      // refresh token, invalidating the old access token — left every remaining
      // iteration presenting a dead credential. That is the read-after-rotate
      // shape behind the 52 logged 401s under source
      // 'jobberIncrementalSync — client <id>', last seen 2026-08-16.
      //
      // refreshTokenIfNeeded's single-flight guard protects ROTATION, not READS,
      // so holding a token is unsafe no matter how well-behaved the refreshers are.
      // The fix is to acquire immediately before use.
      //
      // PER ITERATION, not per chunk: a rotation can land at any moment, so any
      // chunk size leaves a proportional window open, and "how big a window is
      // acceptable" is not a question with a defensible answer. The cost is one
      // indexed single-row DB read per client — negligible beside the Jobber
      // round-trip on the very next line — and refreshTokenIfNeeded only performs
      // an actual OAuth exchange within 5 minutes of expiry, so this is a cheap
      // check in the overwhelming majority of iterations.
      //
      // A failure here lands in this loop's existing catch, which logs against the
      // client id and continues to the next one — the established skip semantics.
      token = await getFreshContractorAccessToken(contractorId);

      const relatedResponse = await retryWithBackoff(
        () => _axiosPost(
          'https://api.getjobber.com/api/graphql',
          {
            query: `
              query GetClientRelated($id: EncodedId!) {
                client(id: $id) {
                  jobs(first: 50) {
                    nodes {
                      id jobStatus jobType completedAt createdAt
                      invoices { nodes { id invoiceStatus createdAt amounts { total } } }
                      customFields {
                        ... on CustomFieldText { label valueText }
                        ... on CustomFieldDropdown { label valueDropdown }
                      }
                    }
                  }
                  quotes(first: 20) { nodes { id quoteStatus createdAt } }
                  requests(first: 20) { nodes { id requestStatus createdAt } }
                }
              }
            `,
            variables: { id: client.id },
          },
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

      const relatedData = relatedResponse.data?.data?.client || {};
      const jobs     = relatedData.jobs?.nodes || [];
      const quotes   = relatedData.quotes?.nodes || [];
      const requests = relatedData.requests?.nodes || [];

      const email = client.emails?.find(e => e.primary)?.address
        || client.emails?.[0]?.address
        || null;
      const phone = client.phones?.find(p => p.primary)?.number
        || client.phones?.[0]?.number
        || null;

      // Upsert into jobber_clients
      await pool.query(
        `INSERT INTO jobber_clients
           (jobber_client_id, contractor_id, first_name, last_name, email, phone,
            is_company, is_lead, is_archived, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           is_company = EXCLUDED.is_company,
           is_lead = EXCLUDED.is_lead,
           is_archived = EXCLUDED.is_archived,
           last_synced_at = NOW()`,
        [
          client.id,
          contractorId,
          client.firstName || null,
          client.lastName || null,
          email,
          phone,
          client.isCompany === true,
          client.isLead === true,
          client.isArchived === true,
        ]
      );

      // Normalize job-embedded invoices for deriveAndSaveTags
      const normalizedJobs = jobs.map(j => ({
        ...j,
        invoices: j.invoices?.nodes || [],
      }));

      const clientData = {
        isCompany:    client.isCompany,
        isLead:       client.isLead,
        tags:         client.tags,
        customFields: client.customFields,
        jobs:         normalizedJobs,
        invoices:     [],
        quotes,
        requests,
      };

      await deriveAndSaveTags(pool, contractorId, client.id, clientData, contractorFieldMappings);

      // Permanent system tag
      await pool.query(
        `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
         VALUES ($1, $2, 'jobber_client', 'system', NOW())
         ON CONFLICT DO NOTHING`,
        [client.id, contractorId]
      );

      // tier_1 = Jobber-only client (no linked app contact). Replaced by tier_2 after matching pass.
      await pool.query(
        `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
         VALUES ($1, $2, 'tier_1', 'system', NOW())
         ON CONFLICT DO NOTHING`,
        [client.id, contractorId]
      );

      updatedIds.push(client.id);

    } catch (err) {
      await logError({ req: null, error: err, source: `jobberIncrementalSync — client ${client.id}` });
      console.error(`[jobberIncrementalSync] Error processing client ${client.id}:`, err.message);
    }
  }

  // Delta matching pass — run for each successfully processed client
  let totalLinked = 0;
  for (const jcId of updatedIds) {
    try {
      const { linked } = await runContactMatchingPass(contractorId, { jobberClientId: jcId });
      totalLinked += linked;
    } catch (err) {
      await logError({ req: null, error: err, source: `jobberIncrementalSync — matching ${jcId}` });
    }
  }

  if (totalLinked > 0) {
    await pool.query(
      `INSERT INTO notifications (contractor_id, type, title, body)
       VALUES ($1, 'incremental_sync', 'Sync complete', $2)`,
      [contractorId, `${updatedIds.length} clients synced, ${totalLinked} new contact links established.`]
    ).catch(() => {});
  }

  // --- Audience refresh phase ---
  // Rebuild every active audience once, after all tag writes for this batch are committed.
  // evaluateAudience() does a full DELETE-then-INSERT, so clients whose tags changed will
  // be added to matching audiences and removed from ones they no longer qualify for.
  console.log('[jobberIncrementalSync] Refreshing active audiences...');
  let audiencesRefreshed = 0;
  let audiencesFailed = 0;
  try {
    const audienceResult = await pool.query(
      'SELECT id, name FROM dynamic_audiences WHERE contractor_id = $1 AND is_active = TRUE',
      [contractorId]
    );
    for (const audience of audienceResult.rows) {
      try {
        await evaluateAudience(pool, audience.id);
        audiencesRefreshed++;
      } catch (err) {
        audiencesFailed++;
        await logError({ req: null, error: err, source: `jobberIncrementalSync audience-refresh ${audience.id}` });
        console.error(`[jobberIncrementalSync] Audience refresh failed for "${audience.name}" (${audience.id}):`, err.message);
      }
    }
  } catch (err) {
    await logError({ req: null, error: err, source: 'jobberIncrementalSync audience-refresh query' });
    console.error('[jobberIncrementalSync] Could not query active audiences:', err.message);
  }

  console.log(`[jobberIncrementalSync] Done — ${recentClients.length} clients processed, ${totalLinked} links established, ${audiencesRefreshed} audiences refreshed, ${audiencesFailed} audience failures`);
}

function startJobberIncrementalSyncJob() {
  // Daily at 2:00am UTC.
  // ⚠ The callback RETURNS the withLock promise — the braces that used to wrap this
  // body made it return undefined, so the job was not awaitable and a caller could
  // not tell a finished run from a started one. node-cron ignores the return value
  // either way; this exists so tests can await the job instead of polling for its
  // side effects (Wave 0.2 item 4d).
  cron.schedule('0 2 * * *', () => withLock('jobber_incremental_sync', 20, async () => {
    await runIncrementalSync();
  }));
  console.log('[cron] jobberIncrementalSync registered (daily 2am UTC)');
}

module.exports = {
  startJobberIncrementalSyncJob,
  // test seam — inert in production, never called outside server/test/
  runIncrementalSync,
  runForContractor,
  _setTestOverrides,
  _resetTestOverrides,
};
