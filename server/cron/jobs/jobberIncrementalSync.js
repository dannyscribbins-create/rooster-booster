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
  // ⚠ STILL OPEN, and it is Wave 0.2 item 4's job: this acquires ONE token and holds
  // it across the per-client loop below. refreshTokenIfNeeded's single-flight guard
  // protects rotation, not reads, so a concurrent pipelineSync refresh can still
  // rotate this token out from under a long run. Item 4 is where the loop learns to
  // re-acquire. Do not read this comment as "already handled".
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
  const clientsResponse = await retryWithBackoff(
    () => axios.post(
      'https://api.getjobber.com/api/graphql',
      {
        query: `
          query GetRecentClients($after: String) {
            clients(
              filter: { updatedAt: { after: "${twentyFiveHoursAgo}" } }
              first: 50
              after: $after
            ) {
              nodes {
                id firstName lastName isCompany isLead createdAt
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
        `,
      },
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

  // Jobber may not support updatedAt filter — fall back to job-level if needed.
  // If the filter returns a GraphQL error, we log it and exit gracefully.
  const gqlErrors = clientsResponse.data?.errors;
  if (gqlErrors?.length > 0) {
    const msg = gqlErrors.map(e => e.message).join('; ');
    console.warn('[jobberIncrementalSync] Jobber filter error:', msg);
    await logError({ req: null, error: new Error(msg), source: 'jobberIncrementalSync — clients filter' });
    return;
  }

  const recentClients = clientsResponse.data?.data?.clients?.nodes || [];
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
      const relatedResponse = await retryWithBackoff(
        () => axios.post(
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
  // Daily at 2:00am UTC
  cron.schedule('0 2 * * *', () => {
    withLock('jobber_incremental_sync', 20, async () => {
      await runIncrementalSync();
    });
  });
  console.log('[cron] jobberIncrementalSync registered (daily 2am UTC)');
}

module.exports = { startJobberIncrementalSyncJob };
