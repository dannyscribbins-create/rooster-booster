const axios = require('axios');
const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../utils/retryHelpers');
const deriveAndSaveTags = require('../utils/deriveJobberTags');
const { refreshTokenIfNeeded } = require('../crm/jobber');
const { runContactMatchingPass } = require('./contactMatchingPass');

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
  matchingProgress: { processed: 0, total: 0, linked: 0 },
  linksEstablished: 0,
  errorMessage: null,
};

// ── PAGINATION HELPER ─────────────────────────────────────────────────────────
async function fetchAllPages(token, query, dataPath, label = '', contractorId = null) {
  const results = [];
  let after = null;
  let hasNextPage = true;
  let pageNum = 0;
  let throttleRetries = 0;

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

    // Check for GraphQL errors including THROTTLED
    const gqlErrors = response.data?.errors;
    if (gqlErrors?.length > 0) {
      const isThrottled = gqlErrors.some(e =>
        e.extensions?.code === 'THROTTLED' || e.message === 'Throttled'
      );

      if (isThrottled) {
        throttleRetries++;
        if (throttleRetries > 10) {
          throw new Error(`Jobber throttle retry limit exceeded in ${label} — too many retries. Try again later.`);
        }
        const throttleStatus = response.data?.extensions?.cost?.throttleStatus;
        const currentlyAvailable = throttleStatus?.currentlyAvailable || 0;
        const restoreRate = throttleStatus?.restoreRate || 500;
        const PAGE_COST = 2500;
        const waitMs = Math.max(
          Math.ceil(((PAGE_COST - currentlyAvailable) / restoreRate) * 1000) + 500,
          10000
        );
        console.log(`[fullJobberImport] ${label} throttled on page ${pageNum} (retry ${throttleRetries}) — waiting ${waitMs}ms`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        pageNum--;
        continue;
      }

      // Non-throttle GraphQL error — surface it clearly
      const messages = gqlErrors.map(e => e.message).join('; ');
      throw new Error(`Jobber GraphQL error in ${label} page ${pageNum}: ${messages}`);
    }

    // Reset throttle retry counter on successful page
    throttleRetries = 0;

    // Read nodes from response
    const connection = response.data?.data?.[dataPath];
    const nodes = connection?.nodes || [];
    results.push(...nodes);

    console.log(`[fullJobberImport] ${label} — page ${pageNum}, ${nodes.length} ${dataPath}`);

    hasNextPage = connection?.pageInfo?.hasNextPage || false;
    after = connection?.pageInfo?.endCursor || null;

    // Adaptive inter-page delay based on actual bucket state
    if (hasNextPage) {
      const throttleStatus = response.data?.extensions?.cost?.throttleStatus;
      if (throttleStatus) {
        const currentlyAvailable = throttleStatus.currentlyAvailable || 0;
        const restoreRate = throttleStatus.restoreRate || 500;
        const PAGE_COST = 2500;
        if (currentlyAvailable < PAGE_COST) {
          const waitMs = Math.ceil(((PAGE_COST - currentlyAvailable) / restoreRate) * 1000) + 200;
          await new Promise(resolve => setTimeout(resolve, waitMs));
        } else {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (pageNum % 50 === 0 && contractorId) {
      console.log(`[fullJobberImport] ${label} — refreshing token at page ${pageNum}`);
      await refreshTokenIfNeeded();
      const refreshed = await pool.query(
        'SELECT access_token FROM tokens WHERE contractor_id = $1',
        [contractorId]
      );
      if (refreshed.rows[0]?.access_token) {
        token = refreshed.rows[0].access_token;
      }
    }
  }

  return results;
}

// ── TOKEN HELPER ─────────────────────────────────────────────────────────────
async function getFreshToken(contractorId) {
  await refreshTokenIfNeeded();
  const tokenResult = await pool.query(
    'SELECT access_token, expires_at FROM tokens WHERE contractor_id = $1',
    [contractorId]
  );
  const tokenRow = tokenResult.rows[0];
  if (!tokenRow?.access_token) throw new Error('No access token found for contractor');
  if (new Date(tokenRow.expires_at) < new Date()) {
    throw new Error(`Jobber token expired for ${contractorId} — reconnect Jobber OAuth`);
  }
  return tokenRow.access_token;
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
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('[fullJobberImport] Step A — fetching all clients...');
    const tokenA = await getFreshToken(contractorId);

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
            customFields {
              ... on CustomFieldText { label valueText }
              ... on CustomFieldDropdown { label valueDropdown }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const allClients = await fetchAllPages(tokenA, clientsQuery, 'clients', 'Step A', contractorId);
    console.log(`[fullJobberImport] Step A complete — ${allClients.length} clients fetched`);

    // ── STEP B — Pull all invoices ────────────────────────────────────────────
    console.log('[fullJobberImport] Step B — fetching all invoices...');
    const tokenB = await getFreshToken(contractorId);
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
    const allInvoices = await fetchAllPages(tokenB, invoicesQuery, 'invoices', 'Step B', contractorId);
    console.log(`[fullJobberImport] Step B complete — ${allInvoices.length} invoices fetched`);

    // ── STEP D — Pull all quotes ──────────────────────────────────────────────
    console.log('[fullJobberImport] Step D — fetching all quotes...');
    const tokenD = await getFreshToken(contractorId);
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
    const allQuotes = await fetchAllPages(tokenD, quotesQuery, 'quotes', 'Step D', contractorId);
    console.log(`[fullJobberImport] Step D complete — ${allQuotes.length} quotes fetched`);

    // ── STEP E — Pull all requests ────────────────────────────────────────────
    console.log('[fullJobberImport] Step E — fetching all requests...');
    const tokenE = await getFreshToken(contractorId);
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
    const allRequests = await fetchAllPages(tokenE, requestsQuery, 'requests', 'Step E', contractorId);
    console.log(`[fullJobberImport] Step E complete — ${allRequests.length} requests fetched`);

    // ── STEP C — Pull all jobs (most expensive, runs last) ────────────────────
    console.log('[fullJobberImport] Step C — fetching all jobs...');
    const tokenC = await getFreshToken(contractorId);
    const jobsQuery = `
      query GetJobs($after: String) {
        jobs(first: 100, after: $after) {
          nodes {
            id jobStatus jobType completedAt createdAt
            client { id }
            customFields {
              ... on CustomFieldText { label valueText }
              ... on CustomFieldDropdown { label valueDropdown }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const allJobs = await fetchAllPages(tokenC, jobsQuery, 'jobs', 'Step C', contractorId);
    console.log(`[fullJobberImport] Step C complete — ${allJobs.length} jobs fetched`);

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

      // tier_1 = Jobber-only client (no linked app contact). Replaced by tier_2 after matching pass.
      await pool.query(
        `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
         VALUES ($1, $2, 'tier_1', 'system', NOW())
         ON CONFLICT DO NOTHING`,
        [client.id, contractorId]
      );

      importState.tagged += 1;
    }

    // ── PHASE 2 — Contact matching pass ──────────────────────────────────────
    console.log('[fullJobberImport] Phase 2 — running contact matching pass...');
    importState.status = 'matching';
    importState.matchingProgress = { processed: 0, total: filteredClients.length, linked: 0 };

    for (const client of filteredClients) {
      try {
        const { linked } = await runContactMatchingPass(contractorId, { jobberClientId: client.id });
        importState.matchingProgress.processed++;
        importState.matchingProgress.linked += linked;
        importState.linksEstablished += linked;
      } catch (err) {
        await logError({ req: null, error: err, source: `fullJobberImport — matching client ${client.id}` });
      }
    }

    if (importState.linksEstablished > 0) {
      await pool.query(
        `INSERT INTO notifications (contractor_id, type, title, body)
         VALUES ($1, 'import_complete', 'Import complete', $2)`,
        [contractorId, `${importState.imported} clients imported, ${importState.linksEstablished} contact links established.`]
      );
    }

    importState.status = 'complete';
    importState.completedAt = new Date();
    console.log(`[fullJobberImport] Complete — ${importState.imported} imported, ${importState.tagged} tagged, ${importState.linksEstablished} links established`);

  } catch (err) {
    importState.status = 'error';
    importState.errorMessage = err.message;
    await logError({ req: null, error: err, source: 'runFullJobberImport' });
    console.error('[fullJobberImport] Fatal error:', err.message);
  }
}

module.exports = { runFullJobberImport, importState };
