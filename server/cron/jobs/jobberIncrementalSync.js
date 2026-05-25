const cron = require('node-cron');
const axios = require('axios');
const { withLock } = require('../withLock');
const { pool } = require('../../db');
const { logError } = require('../../middleware/errorLogger');
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../../utils/retryHelpers');
const deriveAndSaveTags = require('../../utils/deriveJobberTags');

const CONTRACTOR_ID = 'accent-roofing'; // MVP: replace with multi-contractor loop at scale

async function runIncrementalSync() {
  const tokenResult = await pool.query(
    'SELECT access_token, refresh_token, expires_at FROM tokens WHERE contractor_id = $1',
    [CONTRACTOR_ID]
  );
  const tokenRow = tokenResult.rows[0];
  if (!tokenRow?.access_token) {
    console.log('[jobberIncrementalSync] No access token — skipping');
    return;
  }
  if (new Date(tokenRow.expires_at) < new Date()) {
    console.warn(`[jobberIncrementalSync] Jobber token expired for ${CONTRACTOR_ID} — reconnect Jobber OAuth`);
    return;
  }
  const token = tokenRow.access_token;

  // Pull clients updated within the last 25 hours (covers 30-min overlap)
  console.log('[jobberIncrementalSync] Fetching recently updated clients...');
  const clientsResponse = await retryWithBackoff(
    () => axios.post(
      'https://api.getjobber.com/api/graphql',
      {
        query: `
          query GetRecentClients($after: String) {
            clients(
              filter: { status: active, updatedAt: { gte: "25_HOURS_AGO" } }
              first: 50
              after: $after
            ) {
              nodes {
                id firstName lastName isCompany isLead createdAt
                emails { address isPrimary }
                phones { number isPrimary }
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

      const email = client.emails?.find(e => e.isPrimary)?.address
        || client.emails?.[0]?.address
        || null;
      const phone = client.phones?.find(p => p.isPrimary)?.number
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
          CONTRACTOR_ID,
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

      await deriveAndSaveTags(pool, CONTRACTOR_ID, client.id, clientData);

      // Permanent system tag
      await pool.query(
        `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
         VALUES ($1, $2, 'jobber_client', 'system', NOW())
         ON CONFLICT DO NOTHING`,
        [client.id, CONTRACTOR_ID]
      );

    } catch (err) {
      await logError({ req: null, error: err, source: `jobberIncrementalSync — client ${client.id}` });
      console.error(`[jobberIncrementalSync] Error processing client ${client.id}:`, err.message);
    }
  }

  console.log(`[jobberIncrementalSync] Done — ${recentClients.length} clients processed`);
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
