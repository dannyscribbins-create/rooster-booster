const axios = require('axios');
const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../utils/retryHelpers');
const deriveAndSaveTags = require('../utils/deriveJobberTags');

// ── IMPORT STATE ──────────────────────────────────────────────────────────────
// Module-level — persists in memory for the duration of the process.
// The admin status route reads this object to report progress.
const importState = {
  status: 'idle',
  startedAt: null,
  completedAt: null,
  totalFound: 0,
  imported: 0,
  tagged: 0,
  errorMessage: null,
};

// ── PAGINATION HELPER ─────────────────────────────────────────────────────────
async function fetchAllPages(token, query, dataPath, delayMs = 200, label = '') {
  const results = [];
  let after = null;
  let hasNextPage = true;
  let pageNum = 0;

  while (hasNextPage) {
    pageNum++;
    const response = await retryWithBackoff(
      () => axios.post(
        'https://api.getjobber.com/api/graphql',
        { query, variables: { after } },
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

    const gqlErrors = response.data?.errors;
    if (gqlErrors?.length > 0) {
      const isThrottled = gqlErrors.some(e =>
        e.extensions?.code === 'THROTTLED' || e.message === 'Throttled'
      );
      if (isThrottled) {
        const throttleStatus = response.data?.extensions?.cost?.throttleStatus;
        const currentlyAvailable = throttleStatus?.currentlyAvailable || 0;
        const restoreRate = throttleStatus?.restoreRate || 500;
        const PAGE_COST = 1500;
        const waitMs = Math.max(
          Math.ceil(((PAGE_COST - currentlyAvailable) / restoreRate) * 1000) + 500,
          3000
        );
        console.log(`[fullJobberImport] ${label} throttled on page ${pageNum} — waiting ${waitMs}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        pageNum--;
        continue;
      }
      const messages = gqlErrors.map(e => e.message).join('; ');
      throw new Error(`Jobber GraphQL error in ${label} page ${pageNum}: ${messages}`);
    }

    // Walk the path string like "clients" or "invoices" to get the connection object
    const data = response.data?.data;
    const connection = data?.[dataPath];
    const nodes = connection?.nodes || [];
    results.push(...nodes);

    if (label) {
      console.log(`[fullJobberImport] ${label} — page ${pageNum}, ${nodes.length} ${dataPath}`);
    }

    hasNextPage = connection?.pageInfo?.hasNextPage || false;
    after = connection?.pageInfo?.endCursor || null;

    if (hasNextPage) {
      const throttleStatus = response.data?.extensions?.cost?.throttleStatus;
      if (throttleStatus) {
        const currentlyAvailable = throttleStatus.currentlyAvailable || 0;
        const restoreRate = throttleStatus.restoreRate || 500;
        const PAGE_COST = 1500;
        if (currentlyAvailable < PAGE_COST) {
          const waitMs = Math.ceil(((PAGE_COST - currentlyAvailable) / restoreRate) * 1000) + 200;
          await new Promise(resolve => setTimeout(resolve, waitMs));
        } else {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, delayMs || 500));
      }
    }
  }

  return results;
}

// ── MAIN IMPORT FUNCTION ──────────────────────────────────────────────────────
async function runFullJobberImport(contractorId, filterPreference) {
  if (importState.status === 'running') return;

  importState.status = 'running';
  importState.startedAt = new Date();
  importState.completedAt = null;
  importState.totalFound = 0;
  importState.imported = 0;
  importState.tagged = 0;
  importState.errorMessage = null;

  try {
    // Fetch access token and verify it has not expired
    const tokenResult = await pool.query(
      'SELECT access_token, refresh_token, expires_at FROM tokens WHERE contractor_id = $1',
      [contractorId]
    );
    const tokenRow = tokenResult.rows[0];
    if (!tokenRow?.access_token) throw new Error('No access token found for contractor');
    if (new Date(tokenRow.expires_at) < new Date()) {
      throw new Error(`Jobber token expired for ${contractorId} — reconnect Jobber OAuth`);
    }
    const token = tokenRow.access_token;

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('[fullJobberImport] Step A — fetching all clients...');

    // ── STEP A — Pull all Jobber clients ─────────────────────────────────────
    // No filter applied — ClientFilterAttributes does not support status filtering reliably.
    // Filtering (active/archived/lead) happens in Node.js (Step G), not in Jobber.
    const clientsQuery = `
      query GetClients($after: String) {
        clients(first: 100, after: $after) {
          nodes {
            id firstName lastName isCompany isLead isArchived createdAt updatedAt
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
    const allClients = await fetchAllPages(token, clientsQuery, 'clients', 500, 'Step A');
    console.log(`[fullJobberImport] Step A complete — ${allClients.length} clients fetched`);

    // ── STEP B — Pull all invoices ────────────────────────────────────────────
    console.log('[fullJobberImport] Step B — fetching all invoices...');
    const invoicesQuery = `
      query GetInvoices($after: String) {
        invoices(first: 100, after: $after) {
          nodes {
            id invoiceStatus createdAt
            amounts { total }
            client { id }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const allInvoices = await fetchAllPages(token, invoicesQuery, 'invoices', 500, 'Step B');
    console.log(`[fullJobberImport] Step B complete — ${allInvoices.length} invoices fetched`);

    // ── STEP C — Pull all jobs ────────────────────────────────────────────────
    console.log('[fullJobberImport] Step C — fetching all jobs...');
    const jobsQuery = `
      query GetJobs($after: String) {
        jobs(first: 50, after: $after) {
          nodes {
            id jobStatus jobType completedAt createdAt
            client { id }
            invoices { nodes { id invoiceStatus createdAt amounts { total } } }
            customFields {
              ... on CustomFieldText { label valueText }
              ... on CustomFieldDropdown { label valueDropdown }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const allJobs = await fetchAllPages(token, jobsQuery, 'jobs', 500, 'Step C');
    console.log(`[fullJobberImport] Step C complete — ${allJobs.length} jobs fetched`);

    // ── STEP D — Pull all quotes ──────────────────────────────────────────────
    console.log('[fullJobberImport] Step D — fetching all quotes...');
    const quotesQuery = `
      query GetQuotes($after: String) {
        quotes(first: 100, after: $after) {
          nodes {
            id quoteStatus createdAt
            client { id }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const allQuotes = await fetchAllPages(token, quotesQuery, 'quotes', 500, 'Step D');
    console.log(`[fullJobberImport] Step D complete — ${allQuotes.length} quotes fetched`);

    // ── STEP E — Pull all requests ────────────────────────────────────────────
    console.log('[fullJobberImport] Step E — fetching all requests...');
    const requestsQuery = `
      query GetRequests($after: String) {
        requests(first: 100, after: $after) {
          nodes {
            id requestStatus createdAt
            client { id }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const allRequests = await fetchAllPages(token, requestsQuery, 'requests', 500, 'Step E');
    console.log(`[fullJobberImport] Step E complete — ${allRequests.length} requests fetched`);

    // ── STEP F — Join all data by client ID ──────────────────────────────────
    console.log('[fullJobberImport] Step F — joining data...');
    const clientMap = new Map();
    for (const client of allClients) {
      clientMap.set(client.id, {
        ...client,
        invoices: [],
        jobs: [],
        quotes: [],
        requests: [],
      });
    }
    for (const inv of allInvoices) {
      const c = clientMap.get(inv.client?.id);
      if (c) c.invoices.push(inv);
    }
    for (const job of allJobs) {
      const c = clientMap.get(job.client?.id);
      if (c) c.jobs.push(job);
    }
    for (const quote of allQuotes) {
      const c = clientMap.get(quote.client?.id);
      if (c) c.quotes.push(quote);
    }
    for (const req of allRequests) {
      const c = clientMap.get(req.client?.id);
      if (c) c.requests.push(req);
    }

    // ── STEP G — Apply import filter ──────────────────────────────────────────
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const filteredClients = [];
    for (const client of clientMap.values()) {
      const allClientInvoices = [
        ...client.invoices,
        ...client.jobs.flatMap(j => j.invoices?.nodes || []),
      ];
      const hasAnyPaidInvoice = allClientInvoices.some(
        inv => (inv.invoiceStatus || '').toLowerCase() === 'paid'
      );

      if (hasAnyPaidInvoice) {
        filteredClients.push(client);
        continue;
      }

      const createdAt = client.createdAt ? new Date(client.createdAt) : null;
      if (filterPreference.mode === 'pull_all') {
        filteredClients.push(client);
      } else if (filterPreference.mode === 'paying_only') {
        // non-paying client — skip; paying clients already included above
      } else if (filterPreference.mode === 'custom_date' && filterPreference.customDate) {
        if (createdAt && createdAt >= new Date(filterPreference.customDate)) {
          filteredClients.push(client);
        }
      } else {
        // recommended: 12 months
        if (createdAt && createdAt >= twelveMonthsAgo) {
          filteredClients.push(client);
        }
      }
    }

    importState.totalFound = filteredClients.length;
    console.log(`[fullJobberImport] Step G complete — ${filteredClients.length} clients to import`);

    // ── STEP H — Bulk upsert into jobber_clients (batches of 500) ────────────
    console.log('[fullJobberImport] Step H — upserting into jobber_clients...');
    const BATCH_SIZE = 500;
    for (let i = 0; i < filteredClients.length; i += BATCH_SIZE) {
      const batch = filteredClients.slice(i, i + BATCH_SIZE);
      for (const client of batch) {
        const email = client.emails?.find(e => e.primary)?.address
          || client.emails?.[0]?.address
          || null;
        const phone = client.phones?.find(p => p.primary)?.number
          || client.phones?.[0]?.number
          || null;

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
      }
      importState.imported += batch.length;
      console.log(`[fullJobberImport] Step H — upserted ${importState.imported}/${filteredClients.length}`);
    }

    // ── STEP I — Derive and save tags (per client) ────────────────────────────
    console.log('[fullJobberImport] Step I — deriving tags...');
    for (const client of filteredClients) {
      // Normalize job-embedded invoices shape for deriveAndSaveTags
      const normalizedJobs = client.jobs.map(j => ({
        ...j,
        invoices: j.invoices?.nodes || [],
      }));

      const clientData = {
        isCompany:    client.isCompany,
        isLead:       client.isLead,
        tags:         client.tags,
        customFields: client.customFields,
        jobs:         normalizedJobs,
        invoices:     client.invoices,
        quotes:       client.quotes,
        requests:     client.requests,
      };

      await deriveAndSaveTags(pool, contractorId, client.id, clientData);

      // Permanent system tag — marks this contact as a known Jobber client
      await pool.query(
        `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
         VALUES ($1, $2, 'jobber_client', 'system', NOW())
         ON CONFLICT DO NOTHING`,
        [client.id, contractorId]
      );

      importState.tagged += 1;
    }

    importState.status = 'complete';
    importState.completedAt = new Date();
    console.log(`[fullJobberImport] Complete — ${importState.imported} imported, ${importState.tagged} tagged`);

  } catch (err) {
    importState.status = 'error';
    importState.errorMessage = err.message;
    await logError({ req: null, error: err, source: 'runFullJobberImport' });
    console.error('[fullJobberImport] Fatal error:', err.message);
  }
}

module.exports = { runFullJobberImport, importState };
