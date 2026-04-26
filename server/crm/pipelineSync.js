const axios = require('axios');
const { pool } = require('../db');
const { refreshTokenIfNeeded } = require('./jobber');
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('../utils/retryWithBackoff');

const jobberShouldRetry = (error) => {
  const status = error?.response?.status;
  if (!status) return true;
  if (status === 401) return false;
  if (status >= 500) return true;
  return false;
};

// ── PIPELINE STATUS CLASSIFIER ────────────────────────────────────────────────
// Input: a single Jobber client object with quotes, jobs, invoices
// Output: 'lead' | 'inspection' | 'not_sold' | 'sold' | 'paid'
function classifyPipelineStatus(client) {
  const quotes = client.quotes?.nodes || [];
  const jobs   = client.jobs?.nodes   || [];

  if (jobs.length === 0 && quotes.length === 0) return 'lead';

  // Check for paid invoice — client reached 'paid' stage
  for (const job of jobs) {
    const hasPaidInvoice = (job.invoices?.nodes || []).some(
      inv => inv.invoiceStatus === 'paid'
    );
    if (hasPaidInvoice) return 'paid';
  }

  // Job exists but no paid invoice yet
  if (jobs.length > 0) return 'sold';

  // No jobs — check quote activity
  const activeQuotes = quotes.filter(q => q.quoteStatus !== 'archived');
  if (activeQuotes.length > 0) return 'inspection';

  // All quotes archived, no job
  return 'not_sold';
}

// ── REFERRED BY FIELD EXTRACTOR ───────────────────────────────────────────────
// Input: a single Jobber client object
// Output: string value of "Referred by" custom field, or null
function getReferredByValue(client) {
  const fields = client.customFields || [];
  const field  = fields.find(f => f.label && f.label.toLowerCase() === 'referred by');
  if (!field) return null;
  const value = field.valueText?.trim();
  return value || null;
}

// ── SYNC SINGLE CLIENT ────────────────────────────────────────────────────────
// Input: contractorId string, Jobber client object, referralStartDate Date object
// Upserts a referred client into pipeline_cache.
// Pre-start-date clients: written to pipeline_cache with pre_start_date=true
// and inserted into flagged_referrals if initial_sync is still running.
// Pre-start-date clients never trigger bonus logic (checked upstream by hard gate).
async function syncSingleClient(contractorId, client, referralStartDate, allClients = []) {
  const referredBy = getReferredByValue(client);
  if (!referredBy) return; // not a referred client — do nothing

  const clientName  = `${client.firstName || ''} ${client.lastName || ''}`.trim();
  const createdAt   = client.createdAt ? new Date(client.createdAt) : null;
  const isPreStart  = !!(referralStartDate && createdAt && createdAt < referralStartDate);
  const status      = classifyPipelineStatus(client);

  await pool.query(
    `INSERT INTO pipeline_cache
       (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
        pre_start_date, jobber_created_at, last_synced_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       client_name      = EXCLUDED.client_name,
       referred_by      = EXCLUDED.referred_by,
       pipeline_status  = EXCLUDED.pipeline_status,
       pre_start_date   = EXCLUDED.pre_start_date,
       last_synced_at   = NOW(),
       updated_at       = NOW()`,
    [contractorId, client.id, clientName, referredBy, status,
     isPreStart, createdAt]
  );

  // ── APP_USER_ PLACEHOLDER CLEANUP ──────────────────────────────────────────
  // If a peer-signup placeholder row exists for this client (written at signup when
  // no Jobber client ID was known yet), delete it now that the real Jobber row has
  // been upserted. The placeholder keys on app_user_<userId> — a different
  // (contractor_id, jobber_client_id) pair — so both rows coexist without this DELETE.
  // Failure is non-fatal: the real row is already written; cleanup can be retried on
  // the next sync cycle.
  try {
    await pool.query(
      `DELETE FROM pipeline_cache
       WHERE contractor_id = $1
         AND LOWER(client_name) = LOWER($2)
         AND jobber_client_id LIKE 'app_user_%'`,
      [contractorId, clientName]
    );
  } catch (cleanupErr) {
    await logError({ req: null, error: cleanupErr });
    console.error('[pipelineSync] app_user_ placeholder cleanup failed:', cleanupErr.message);
  }

  // ── PENDING REFERRAL CHECK ──────────────────────────────────────────────────
  // If this referred client's referrer has no app account, create a pending record
  // and fire an auto-invite. Runs async — must not block or throw inside syncSingleClient.
  // SCALABLE: This check runs on every sync. At high contractor volume, consider
  // batching or caching the user lookup. For MVP with single contractor, this is fine.
  try {
    const { checkAndCreatePendingReferral } = require('../utils/pendingReferral');
    await checkAndCreatePendingReferral(contractorId, client, referredBy, allClients);
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pipelineSync] pending referral check failed:', err.message);
  }

  // Flag pre-start-date clients for admin review only during initial sync
  if (isPreStart) {
    const syncResult = await pool.query(
      'SELECT initial_sync_complete FROM sync_state WHERE contractor_id = $1',
      [contractorId]
    );
    const syncComplete = syncResult.rows[0]?.initial_sync_complete ?? false;
    if (!syncComplete) {
      await pool.query(
        `INSERT INTO flagged_referrals
           (contractor_id, jobber_client_id, client_name, referred_by,
            pipeline_status, flag_reason)
         VALUES ($1, $2, $3, $4, $5, 'pre_start_date')
         ON CONFLICT (contractor_id, jobber_client_id) DO NOTHING`,
        [contractorId, client.id, clientName, referredBy, status]
      );
    }
  }

  // ── BOOKING REQUEST MATCH ───────────────────────────────────────────────────
  // When a Jobber client appears whose name matches a pending booking_request referral,
  // mark the request matched so it no longer surfaces as booking_pending in the pipeline.
  // MVP: name-only match — bulk sync omits phones/emails (CLAUDE.md constraint) so
  // full phone/email confirmation via fetchReferrerContact is deferred.
  try {
    await pool.query(
      `UPDATE booking_requests br
       SET status = 'matched', jobber_client_id = $1, matched_at = NOW(), updated_at = NOW()
       FROM users u
       WHERE u.id = br.submitted_by_user_id
         AND LOWER(u.full_name) = LOWER($2)
         AND br.status = 'pending'
         AND br.contractor_id = $3`,
      [client.id, clientName, contractorId]
    );
  } catch (brMatchErr) {
    await logError({ req: null, error: brMatchErr });
    console.error('[pipelineSync] booking request match check failed:', brMatchErr.message);
  }
}

// ── FULL SYNC ─────────────────────────────────────────────────────────────────
// Fetches ALL clients from Jobber since referral_start_date using cursor-based
// pagination. Processes every client through syncSingleClient.
// Hard guard: if referral_start_date is not set, logs a warning and aborts.
async function runFullSync(contractorId) {
  console.log(`[pipelineSync] Starting full sync for contractor: ${contractorId}`);

  // Load CRM settings — referral_start_date is required
  const settingsResult = await pool.query(
    'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
    [contractorId]
  );
  if (settingsResult.rows.length === 0 || !settingsResult.rows[0].referral_start_date) {
    console.warn(`[pipelineSync] Full sync aborted: referral_start_date not set for contractor: ${contractorId}`);
    return;
  }
  const referralStartDate = new Date(settingsResult.rows[0].referral_start_date);
  const startDateISO      = referralStartDate.toISOString();

  // Refresh OAuth token if expiring soon, then fetch the (potentially updated) token
  await refreshTokenIfNeeded();
  const tokenResult = await pool.query(
    'SELECT access_token FROM tokens WHERE contractor_id = $1',
    [contractorId]
  );
  if (tokenResult.rows.length === 0 || !tokenResult.rows[0].access_token) {
    console.warn(`[pipelineSync] Full sync aborted: no access token for contractor: ${contractorId}`);
    return;
  }
  const token = tokenResult.rows[0].access_token;

  // Paginate through all Jobber clients created since referral_start_date
  // MVP: allClients array accumulates all pages before processing. At FORA scale with
  // tens of thousands of clients per contractor, process each page immediately in the
  // while loop rather than collecting all into memory. The schema and sync_state update
  // at the bottom would remain the same.
  let allClients  = [];
  let cursor      = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const afterArg = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      clients(first: 50${afterArg}, filter: { createdAt: { after: "${startDateISO}" } }) {
        nodes {
          id firstName lastName createdAt
          customFields { ... on CustomFieldText { label valueText } }
          quotes(first: 10) { nodes { id quoteStatus } }
          jobs(first: 10) {
            nodes {
              id jobStatus
              invoices(first: 5) { nodes { invoiceStatus } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const response = await retryWithBackoff(
      () => axios.post(
        'https://api.getjobber.com/api/graphql',
        { query },
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

    if (!response.data.data || !response.data.data.clients) {
      console.error('[pipelineSync] Jobber returned no clients data:', JSON.stringify(response.data));
      throw new Error('Jobber GraphQL returned no clients data during full sync');
    }
    if (response.data.errors?.length) {
      console.warn('[pipelineSync] Jobber returned partial errors during full sync:', JSON.stringify(response.data.errors));
    }

    const { nodes, pageInfo } = response.data.data.clients;
    allClients  = allClients.concat(nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor      = pageInfo.endCursor;
  }

  console.log(`[pipelineSync] Full sync fetched ${allClients.length} clients from Jobber`);

  // Process every client
  let referredCount = 0;
  for (const client of allClients) {
    const referredBy = getReferredByValue(client);
    if (referredBy) referredCount++;
    await syncSingleClient(contractorId, client, referralStartDate, allClients);
  }

  // Mark initial sync complete
  await pool.query(
    `INSERT INTO sync_state (contractor_id, last_synced_at, initial_sync_complete, updated_at)
     VALUES ($1, NOW(), true, NOW())
     ON CONFLICT (contractor_id) DO UPDATE SET
       last_synced_at        = NOW(),
       initial_sync_complete = true,
       updated_at            = NOW()`,
    [contractorId]
  );

  console.log(`[pipelineSync] Full sync complete for ${contractorId}: ${allClients.length} total clients, ${referredCount} referred`);
}

// ── INCREMENTAL SYNC ──────────────────────────────────────────────────────────
// Fetches only clients updated since last_synced_at. Falls back to runFullSync
// if no sync_state record exists or initial_sync_complete is false.
async function runIncrementalSync(contractorId) {
  const syncResult = await pool.query(
    'SELECT last_synced_at, initial_sync_complete FROM sync_state WHERE contractor_id = $1',
    [contractorId]
  );

  if (syncResult.rows.length === 0 || !syncResult.rows[0].initial_sync_complete) {
    console.log(`[pipelineSync] No completed sync found for ${contractorId} — running full sync`);
    return runFullSync(contractorId);
  }

  const lastSyncedAt = new Date(syncResult.rows[0].last_synced_at);
  const lastSyncISO  = lastSyncedAt.toISOString();

  console.log(`[pipelineSync] Starting incremental sync for ${contractorId} since ${lastSyncISO}`);

  // Load referral_start_date for pre-start-date check
  const settingsResult = await pool.query(
    'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
    [contractorId]
  );
  const referralStartDate = settingsResult.rows[0]?.referral_start_date
    ? new Date(settingsResult.rows[0].referral_start_date)
    : null;

  // Refresh OAuth token if expiring soon, then fetch the (potentially updated) token
  await refreshTokenIfNeeded();
  const tokenResult = await pool.query(
    'SELECT access_token FROM tokens WHERE contractor_id = $1',
    [contractorId]
  );
  if (tokenResult.rows.length === 0 || !tokenResult.rows[0].access_token) {
    console.warn(`[pipelineSync] Incremental sync aborted: no access token for ${contractorId}`);
    return;
  }
  const token = tokenResult.rows[0].access_token;

  // Paginate — filter by updatedAt since last sync
  // MVP: same in-memory accumulation as runFullSync — see comment there for scale path.
  let allClients  = [];
  let cursor      = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const afterArg = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      clients(first: 50${afterArg}, filter: { updatedAt: { after: "${lastSyncISO}" } }) {
        nodes {
          id firstName lastName createdAt
          customFields { ... on CustomFieldText { label valueText } }
          quotes(first: 10) { nodes { id quoteStatus } }
          jobs(first: 10) {
            nodes {
              id jobStatus
              invoices(first: 5) { nodes { invoiceStatus } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const response = await retryWithBackoff(
      () => axios.post(
        'https://api.getjobber.com/api/graphql',
        { query },
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

    if (!response.data.data || !response.data.data.clients) {
      console.error('[pipelineSync] Jobber returned no clients data during incremental sync:', JSON.stringify(response.data));
      throw new Error('Jobber GraphQL returned no clients data during incremental sync');
    }
    if (response.data.errors?.length) {
      console.warn('[pipelineSync] Jobber returned partial errors during incremental sync:', JSON.stringify(response.data.errors));
    }

    const { nodes, pageInfo } = response.data.data.clients;
    allClients  = allClients.concat(nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor      = pageInfo.endCursor;
  }

  console.log(`[pipelineSync] Incremental sync fetched ${allClients.length} updated clients`);

  for (const client of allClients) {
    await syncSingleClient(contractorId, client, referralStartDate, allClients);
  }

  await pool.query(
    `UPDATE sync_state SET last_synced_at = NOW(), updated_at = NOW()
     WHERE contractor_id = $1`,
    [contractorId]
  );

  console.log(`[pipelineSync] Incremental sync complete for ${contractorId}`);
}

// ── SCHEDULED SYNC RUNNER ────────────────────────────────────────────────────
// Called by server.js on a 30-minute interval.
// Queries all contractors with valid tokens and runs runIncrementalSync for each.
// Per-contractor errors are isolated — one failure never stops the others.
async function runScheduledSync() {
  console.log('[scheduler] Starting scheduled incremental sync cycle');
  try {
    const result = await pool.query(
      'SELECT DISTINCT contractor_id FROM tokens WHERE access_token IS NOT NULL'
    );
    if (result.rows.length === 0) {
      console.log('[scheduler] No contractors with tokens — skipping cycle');
      return;
    }
    for (const row of result.rows) {
      try {
        await runIncrementalSync(row.contractor_id);
      } catch (err) {
        await logError({ req: null, error: err });
        console.error(`[scheduler] Sync failed for contractor ${row.contractor_id}:`, err.message);
      }
    }
    console.log('[scheduler] Sync cycle complete');
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[scheduler] Failed to query contractor list:', err.message);
  }
}

module.exports = { classifyPipelineStatus, getReferredByValue, syncSingleClient, runFullSync, runIncrementalSync, runScheduledSync };
