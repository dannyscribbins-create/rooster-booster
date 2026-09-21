const axios = require('axios');
const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../utils/retryHelpers');
const deriveAndSaveTags = require('../utils/deriveJobberTags');
const { refreshTokenIfNeeded } = require('../crm/jobber');
const { runContactMatchingPass } = require('./contactMatchingPass');
const { classifyPipelineStatus } = require('../crm/pipelineSync');
const { runRepScope } = require('./repImportScope');
const { replayForMappedReps } = require('../utils/attributionReplay');

// ── THE IMPORT'S CLIENT SHAPE, ADAPTED FOR THE CLASSIFIER (Canvass-stage) ─────
//
// ⚠ THIS IMPORT ASSEMBLES A THIRD SHAPE, DIFFERENT FROM BOTH OTHER WRITERS, AND
// THAT IS WHY AN ADAPTER EXISTS HERE AND NOWHERE ELSE.
//   · the webhook router's fetchClientRelatedData returns the raw Jobber client, so
//     classifyPipelineStatus can read it directly;
//   · jobberIncrementalSync likewise holds the raw client from its related query;
//   · THIS file builds its clients in Step F by joining four separately-paged
//     fetches onto a Map, so `jobs`, `quotes` and `invoices` are all BARE ARRAYS.
//
// classifyPipelineStatus reads `client.jobs?.nodes`, `client.quotes?.nodes` and
// `job.invoices?.nodes`. Handing it the Step F client gives `undefined || []` for
// every one of them — which is the classifier's first branch, so it returns 'lead'
// for EVERY client in the import, raises nothing, and fills the column with a
// verdict that looks like a business fact. Hence a named adapter rather than a call.
//
// ⚠ AND THE INVOICE JOIN IS AN EQUIVALENCE, NOT A RECONSTRUCTION — SAID PLAINLY
// BECAUSE IT LOOKS LIKE A FUDGE UNTIL THE CLASSIFIER'S TEST IS READ. Neither of this
// file's two invoice queries selects a JOB association: invoices arrive attached to
// the CLIENT only, so which job an invoice belongs to is genuinely not knowable here.
// The classifier asks only `jobs.some(job => job.invoices.some(inv => paid))` — i.e.
// "does this client have a job AND a paid invoice". Attaching the client's invoices
// to every job answers exactly that question and no other. It cannot change the
// verdict, because the classifier never reads an invoice per-job for any other purpose.
// ⚠ If a future change makes the classifier read invoices per-job, this stops being
// an equivalence and must be re-derived — do not assume it still holds.
function classifyImportedClientStage(client) {
  const clientInvoices = [
    ...(client.invoices || []),
    ...(client.jobs || []).flatMap(j => j.invoices?.nodes || []),
  ];
  return classifyPipelineStatus({
    jobs: {
      nodes: (client.jobs || []).map(j => ({ ...j, invoices: { nodes: clientInvoices } })),
    },
    quotes: { nodes: client.quotes || [] },
  });
}

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
  // Rep scope (Canvass-stage backfill). repStep names the step running now, for the
  // admin panel; repScope is the finished summary; repScopeError is set when the rep
  // scope failed AFTER the campaign import had already completed and committed.
  repStep: null,
  repScope: null,
  repScopeError: null,
};

// ── TEST SEAM (Canvass-stage Part 2) ─────────────────────────────────────────
//
// Inert in production, never called outside server/test/. Modelled exactly on
// jobberIncrementalSync's seam, which exists for the same reason recorded there: the
// alternative is patching axios on the shared require cache, which is sound and is
// also "exactly the kind of cleverness that rots the moment someone changes how the
// module loads."
//
// ⚠ THE REASON IT IS ADDED NOW RATHER THAN SOMEDAY: this file had NO seam and NO test,
// and the Step H / Step I partly-written defect lived here undisturbed the whole time.
// A cursor and a per-client transaction are precisely the kind of mechanism that
// reports health it cannot observe if nothing ever drives them to failure.
//
// `startupDelayMs` is part of the seam because the import opens with a fixed 3s sleep;
// a test that waits it out three times pays 9 seconds to observe nothing.
// Declared above every caller — a `let` read before initialisation is a TDZ throw.
let _axiosPost = (...args) => axios.post(...args);
let _getFreshToken = null;          // null = use the real getFreshToken below
let _startupDelayMs = 3000;

// test seam — inert in production, never called outside server/test/
function _setTestOverrides({ axiosPost, getFreshToken, startupDelayMs } = {}) {
  if (axiosPost !== undefined) _axiosPost = axiosPost;
  if (getFreshToken !== undefined) _getFreshToken = getFreshToken;
  if (startupDelayMs !== undefined) _startupDelayMs = startupDelayMs;
}
// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() {
  _axiosPost = (...args) => axios.post(...args);
  _getFreshToken = null;
  _startupDelayMs = 3000;
}

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
      () => _axiosPost(
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

    // ── PER-PAGE COST MEASUREMENT (Canvass-stage Part 3) ────────────────────────
    // MEASUREMENT ONLY — this line changes no behaviour and paces nothing.
    //
    // ⚠ WHY IT EXISTS: the two pacing branches below both compare currentlyAvailable
    // against a hardcoded PAGE_COST = 2500, and that number has NO SOURCE. Jobber
    // returns the real figure on every single response, in the SAME extensions.cost
    // object those branches already read throttleStatus out of — requestedQueryCost
    // (what the query was quoted at) and actualQueryCost (what it was charged). The
    // code reaches into that object, takes the sibling it wants, and leaves the two
    // fields that would have made the constant unnecessary.
    // server/routes/admin/campaigns.js flags the identical shortcut.
    //
    // ⚠ AND IT IS PER QUERY SHAPE, WHICH IS WHY label AND dataPath ARE ON THE LINE.
    // fetchAllPages is called with several different selection sets; one number
    // cannot be right for all of them, and a log that does not say which shape it
    // measured would produce a second unsourced constant instead of a measurement.
    //
    // ⚠ DO NOT RE-PACE ANYTHING ON THIS UNTIL A PRODUCTION RUN HAS PRINTED IT.
    // Substituting one guess for another is how the 2500 arrived. Read it off the
    // Railway logs of a real import first, then decide separately whether the
    // pacing changes at all.
    const cost = response.data?.extensions?.cost;
    if (cost) {
      // diagnostic log — intentional
      console.log(
        `[fullJobberImport] COST ${label} page ${pageNum} — requested=${cost.requestedQueryCost} `
        + `actual=${cost.actualQueryCost} available=${cost.throttleStatus?.currentlyAvailable} `
        + `max=${cost.throttleStatus?.maximumAvailable} restore=${cost.throttleStatus?.restoreRate} `
        + `nodes=${nodes.length} path=${dataPath}`
      );
    }

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
      await refreshTokenIfNeeded(contractorId);
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
  // test seam — inert in production, never taken outside server/test/
  if (_getFreshToken) return _getFreshToken(contractorId);
  await refreshTokenIfNeeded(contractorId);
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
  importState.repStep = null;
  importState.repScope = null;
  importState.repScopeError = null;

  // Date filter: only applied when mode=custom_date with a valid date
  const dateFilter = (filterPreference.mode === 'custom_date' && filterPreference.customDate)
    ? new Date(filterPreference.customDate).toISOString()
    : null;

  console.log('[fullJobberImport] starting — date filter:', dateFilter || 'none (all clients)');

  try {
    await new Promise(resolve => setTimeout(resolve, _startupDelayMs));
    console.log('[fullJobberImport] Step A — fetching all clients...');
    const tokenA = await getFreshToken(contractorId);

    // ── STEP A — Pull all Jobber clients ─────────────────────────────────────
    // Status filtering (active/archived/lead) happens in Node.js (Step G).
    // When a custom date filter is set, add createdAt filter to Jobber query to
    // avoid fetching all 150+ pages. ClientFilterAttributes does NOT support
    // name/firstName/lastName filtering — never attempt that here.
    const clientsFilterStr = dateFilter
      ? `, filter: { createdAt: { after: "${dateFilter}" } }`
      : '';
    const clientsQuery = `
      query GetClients($after: String) {
        clients(first: 100, after: $after${clientsFilterStr}) {
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

    // ── STEP B — Pull invoices scoped to clients from Step A ─────────────────
    // When a date filter is active, Step A returned a small filtered set.
    // Fetch invoices per client to avoid sweeping all historical invoices.
    // For unfiltered imports (16K clients), use the existing bulk sweep.
    const tokenB = await getFreshToken(contractorId);
    let allInvoices = [];

    if (dateFilter) {
      console.log(`[fullJobberImport] Step B — per-client invoice fetch (${allClients.length} clients)...`);
      for (const client of allClients) {
        try {
          const invRes = await retryWithBackoff(
            () => _axiosPost(
              'https://api.getjobber.com/api/graphql',
              {
                query: `
                  query GetClientInvoices($id: EncodedId!) {
                    client(id: $id) {
                      invoices(first: 50) {
                        nodes {
                          id invoiceStatus createdAt
                          amounts { total }
                        }
                      }
                    }
                  }
                `,
                variables: { id: client.id },
              },
              {
                headers: {
                  Authorization: `Bearer ${tokenB}`,
                  'Content-Type': 'application/json',
                  'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
                },
              }
            ),
            { retries: 3, initialDelayMs: 500, shouldRetry: jobberShouldRetry }
          );
          const clientInvoices = (invRes.data?.data?.client?.invoices?.nodes || []).map(inv => ({
            ...inv,
            client: { id: client.id },
          }));
          allInvoices.push(...clientInvoices);
        } catch (invErr) {
          await logError({ req: null, error: invErr, source: `fullJobberImport Step B — client ${client.id}` });
          console.error(`[fullJobberImport] Step B error fetching invoices for client ${client.id}:`, invErr.message);
        }
      }
      console.log(`[fullJobberImport] Step B complete — ${allInvoices.length} invoices fetched (per-client)`);
    } else {
      console.log('[fullJobberImport] Step B — bulk invoice fetch (no date filter)...');
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
      allInvoices = await fetchAllPages(tokenB, invoicesQuery, 'invoices', 'Step B', contractorId);
      console.log(`[fullJobberImport] Step B complete — ${allInvoices.length} invoices fetched`);
    }

    // ── STEP D — Pull quotes scoped to clients from Step A ───────────────────
    const tokenD = await getFreshToken(contractorId);
    let allQuotes = [];

    if (dateFilter) {
      console.log(`[fullJobberImport] Step D — per-client quote fetch (${allClients.length} clients)...`);
      for (const client of allClients) {
        try {
          const quotRes = await retryWithBackoff(
            () => _axiosPost(
              'https://api.getjobber.com/api/graphql',
              {
                query: `
                  query GetClientQuotes($id: EncodedId!) {
                    client(id: $id) {
                      quotes(first: 50) {
                        nodes {
                          id quoteStatus createdAt
                        }
                      }
                    }
                  }
                `,
                variables: { id: client.id },
              },
              {
                headers: {
                  Authorization: `Bearer ${tokenD}`,
                  'Content-Type': 'application/json',
                  'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
                },
              }
            ),
            { retries: 3, initialDelayMs: 500, shouldRetry: jobberShouldRetry }
          );
          const clientQuotes = (quotRes.data?.data?.client?.quotes?.nodes || []).map(q => ({
            ...q,
            client: { id: client.id },
          }));
          allQuotes.push(...clientQuotes);
        } catch (quotErr) {
          await logError({ req: null, error: quotErr, source: `fullJobberImport Step D — client ${client.id}` });
          console.error(`[fullJobberImport] Step D error fetching quotes for client ${client.id}:`, quotErr.message);
        }
      }
      console.log(`[fullJobberImport] Step D complete — ${allQuotes.length} quotes fetched (per-client)`);
    } else {
      console.log('[fullJobberImport] Step D — bulk quote fetch (no date filter)...');
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
      allQuotes = await fetchAllPages(tokenD, quotesQuery, 'quotes', 'Step D', contractorId);
      console.log(`[fullJobberImport] Step D complete — ${allQuotes.length} quotes fetched`);
    }

    // ── STEP E — Pull requests scoped to clients from Step A ─────────────────
    const tokenE = await getFreshToken(contractorId);
    let allRequests = [];

    if (dateFilter) {
      console.log(`[fullJobberImport] Step E — per-client request fetch (${allClients.length} clients)...`);
      for (const client of allClients) {
        try {
          const reqRes = await retryWithBackoff(
            () => _axiosPost(
              'https://api.getjobber.com/api/graphql',
              {
                query: `
                  query GetClientRequests($id: EncodedId!) {
                    client(id: $id) {
                      requests(first: 50) {
                        nodes {
                          id requestStatus createdAt
                        }
                      }
                    }
                  }
                `,
                variables: { id: client.id },
              },
              {
                headers: {
                  Authorization: `Bearer ${tokenE}`,
                  'Content-Type': 'application/json',
                  'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
                },
              }
            ),
            { retries: 3, initialDelayMs: 500, shouldRetry: jobberShouldRetry }
          );
          const clientRequests = (reqRes.data?.data?.client?.requests?.nodes || []).map(r => ({
            ...r,
            client: { id: client.id },
          }));
          allRequests.push(...clientRequests);
        } catch (reqErr) {
          await logError({ req: null, error: reqErr, source: `fullJobberImport Step E — client ${client.id}` });
          console.error(`[fullJobberImport] Step E error fetching requests for client ${client.id}:`, reqErr.message);
        }
      }
      console.log(`[fullJobberImport] Step E complete — ${allRequests.length} requests fetched (per-client)`);
    } else {
      console.log('[fullJobberImport] Step E — bulk request fetch (no date filter)...');
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
      allRequests = await fetchAllPages(tokenE, requestsQuery, 'requests', 'Step E', contractorId);
      console.log(`[fullJobberImport] Step E complete — ${allRequests.length} requests fetched`);
    }

    // ── STEP C — Pull jobs scoped to clients from Step A (most expensive) ────
    const tokenC = await getFreshToken(contractorId);
    let allJobs = [];

    if (dateFilter) {
      console.log(`[fullJobberImport] Step C — per-client job fetch (${allClients.length} clients)...`);
      for (const client of allClients) {
        try {
          const jobRes = await retryWithBackoff(
            () => _axiosPost(
              'https://api.getjobber.com/api/graphql',
              {
                query: `
                  query GetClientJobs($id: EncodedId!) {
                    client(id: $id) {
                      jobs(first: 50) {
                        nodes {
                          id jobStatus jobType completedAt createdAt
                          customFields {
                            ... on CustomFieldText { label valueText }
                            ... on CustomFieldDropdown { label valueDropdown }
                          }
                        }
                      }
                    }
                  }
                `,
                variables: { id: client.id },
              },
              {
                headers: {
                  Authorization: `Bearer ${tokenC}`,
                  'Content-Type': 'application/json',
                  'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
                },
              }
            ),
            { retries: 3, initialDelayMs: 500, shouldRetry: jobberShouldRetry }
          );
          const clientJobs = (jobRes.data?.data?.client?.jobs?.nodes || []).map(j => ({
            ...j,
            client: { id: client.id },
          }));
          allJobs.push(...clientJobs);
        } catch (jobErr) {
          await logError({ req: null, error: jobErr, source: `fullJobberImport Step C — client ${client.id}` });
          console.error(`[fullJobberImport] Step C error fetching jobs for client ${client.id}:`, jobErr.message);
        }
      }
      console.log(`[fullJobberImport] Step C complete — ${allJobs.length} jobs fetched (per-client)`);
    } else {
      console.log('[fullJobberImport] Step C — bulk job fetch (no date filter)...');
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
      allJobs = await fetchAllPages(tokenC, jobsQuery, 'jobs', 'Step C', contractorId);
      console.log(`[fullJobberImport] Step C complete — ${allJobs.length} jobs fetched`);
    }

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

    // ── STEP H+I — PER-CLIENT TRANSACTION AND CURSOR (Canvass-stage Part 2) ──
    //
    // ⚠ THIS DELIBERATELY FIXES THE STEP H / STEP I PARTLY-WRITTEN DEFECT. It is
    // NOT a side effect of adding the stage column, and it is recorded here rather
    // than left for someone to discover in a diff.
    //
    // WHAT IT REPLACED: Step H upserted jobber_clients for ALL clients, and Step I
    // then derived tags for ALL clients. Those are two full passes over the same
    // list, so a failure anywhere in the second one left EVERY client half-written —
    // a jobber_clients row with no tags — and a re-run started from the beginning
    // with no record of how far it had got. The two steps are merged below into one
    // per-client unit of work.
    //
    // ⚠ AND THE RESUMABILITY THIS REPLACES WAS NEVER THERE. The scoping for this
    // phase assumed the import already kept durable progress; it does not. Steps A-C
    // fetch everything into memory, progress lives only in the module-level
    // `importState` object, and nothing is written until this point — so a failure in
    // the fetch loses the whole run. Bulk all-or-nothing on the FETCH is accepted
    // (at a 12-month window a failed run costs minutes); the cursor below covers the
    // WRITE phase, which is the part that leaves a database half-updated.
    //
    // THREE PROPERTIES, and each is a thing that was previously impossible:
    //   (1) a client is wholly written or not written at all — one transaction;
    //   (2) a failed run leaves a clean PREFIX, and the cursor names where it ended;
    //   (3) a run reports WHICH concern failed, not merely that something did.
    console.log('[fullJobberImport] Step H+I — per-client upsert, stage and tags...');

    // ⚠ SORTED BY ID, AND THE CURSOR IS WHY. `clientMap.values()` yields insertion
    // order, which comes from however Jobber happened to page the fetch. A cursor over
    // an order that can differ between runs is worse than no cursor: on resume it
    // would skip clients that sorted differently the second time, silently, and the
    // run would report success. A total order the database and the loop agree on is
    // what makes "everything up to this id is done" a true statement.
    filteredClients.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    // ── RESUME ────────────────────────────────────────────────────────────────
    // A cursor row survives the process; `importState` does not. Reading it here is
    // what makes a resumed run different from a restarted one.
    let resumeAfterId = null;
    try {
      const { rows: cursorRows } = await pool.query(
        `SELECT last_client_id, clients_done FROM jobber_import_progress
          WHERE contractor_id = $1 AND completed_at IS NULL`,
        [contractorId]
      );
      if (cursorRows[0]?.last_client_id) {
        resumeAfterId = cursorRows[0].last_client_id;
        console.log(`[fullJobberImport] resuming after client ${resumeAfterId} (${cursorRows[0].clients_done} already done)`);
      }
    } catch (cursorErr) {
      // A missing or unreadable cursor must never block an import — it degrades to a
      // full re-run, which is correct and merely slower. Every write below is an
      // idempotent upsert, so re-processing a client is safe.
      console.warn(`[fullJobberImport] cursor read failed, starting from the beginning: ${cursorErr.message}`);
    }

    // ⚠ THE PER-RUN FIELDS RESET AND THE CURSOR FIELDS DO NOT, AND THE SPLIT IS THE
    // WHOLE POINT OF THE ROW. `failed`, `last_error` and `last_failed_concern` describe
    // THIS run and would otherwise accumulate across resumes, so a resumed run that
    // succeeded completely would still report the previous run's failures. But
    // `last_client_id` and `clients_done` are the cursor — they describe work that is
    // COMMITTED, they survive the process, and resetting them is exactly what would
    // turn a resume back into a restart.
    // ⚠ `clients_done` IS RESET ONLY WHEN THIS IS NOT A RESUME, which is what keeps it
    // a count of committed clients rather than a count of clients committed this run.
    const runId = `${contractorId}-${Date.now()}`;
    await pool.query(
      `INSERT INTO jobber_import_progress
         (contractor_id, run_id, clients_total, started_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (contractor_id) DO UPDATE SET
         run_id              = EXCLUDED.run_id,
         clients_total       = EXCLUDED.clients_total,
         clients_done        = CASE WHEN $4::boolean THEN jobber_import_progress.clients_done ELSE 0 END,
         last_client_id      = CASE WHEN $4::boolean THEN jobber_import_progress.last_client_id ELSE NULL END,
         failed              = 0,
         last_error          = NULL,
         last_failed_concern = NULL,
         started_at          = COALESCE(jobber_import_progress.started_at, NOW()),
         completed_at        = NULL,
         updated_at          = NOW()`,
      [contractorId, runId, filteredClients.length, resumeAfterId !== null]
    );

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

    // ── PER-CONCERN COUNTERS ──────────────────────────────────────────────────
    // ⚠ ONE PASS DOES NOT MEAN ONE NUMBER. A client can be upserted, receive a stage,
    // and fail tag derivation; reporting a single "imported" count cannot say which
    // of those happened. `staged` is counted separately from `upserted` because a
    // null stage is a legitimate outcome, not a failure, and the two must not be
    // read as the same event.
    const counts = { upserted: 0, staged: 0, tagged: 0, failed: 0 };
    let skipped = 0;
    let sawResumePoint = resumeAfterId === null;

    for (const client of filteredClients) {
      // The sorted order above is what lets a string compare stand in for "already
      // done" — every id at or below the cursor was committed by the previous run.
      if (!sawResumePoint) {
        if (client.id === resumeAfterId) sawResumePoint = true;
        skipped += 1;
        continue;
      }

      const email = client.emails?.find(e => e.primary)?.address
        || client.emails?.[0]?.address
        || null;
      const phone = client.phones?.find(p => p.primary)?.number
        || client.phones?.[0]?.number
        || null;

      const pipelineStage = classifyImportedClientStage(client);

      const tx = await pool.connect();
      let concern = 'begin';
      try {
        await tx.query('BEGIN');

        concern = 'jobber_clients';
        await tx.query(
          `INSERT INTO jobber_clients
             (jobber_client_id, contractor_id, first_name, last_name, email, phone,
              is_company, is_lead, is_archived, pipeline_stage, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE SET
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             email = EXCLUDED.email,
             phone = EXCLUDED.phone,
             is_company = EXCLUDED.is_company,
             is_lead = EXCLUDED.is_lead,
             is_archived = EXCLUDED.is_archived,
             pipeline_stage = COALESCE(EXCLUDED.pipeline_stage, jobber_clients.pipeline_stage),
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
            pipelineStage,
          ]
        );

        // ⚠ THE FLATTENED SHAPE, AND IT IS BUILT HERE RATHER THAN REUSED. This is
        // what deriveAndSaveTags wants; classifyImportedClientStage above needs the
        // OPPOSITE shape and builds its own. Do not "simplify" by feeding one to
        // both — the classifier reads `jobs.nodes` and would see an empty array,
        // returning 'lead' for every client in the import with no error at all.
        concern = 'contact_tags';
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
        // `tx` rather than `pool` — deriveAndSaveTags takes its query runner as its
        // first parameter and passes it down to every tag helper, so the whole tag
        // derivation joins this client's transaction with no signature change.
        await deriveAndSaveTags(tx, contractorId, client.id, clientData, contractorFieldMappings);

        // Permanent system tag — marks this contact as a known Jobber client
        await tx.query(
          `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
           VALUES ($1, $2, 'jobber_client', 'system', NOW())
           ON CONFLICT DO NOTHING`,
          [client.id, contractorId]
        );

        // tier_1 = Jobber-only client (no linked app contact). Replaced by tier_2 after matching pass.
        await tx.query(
          `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
           VALUES ($1, $2, 'tier_1', 'system', NOW())
           ON CONFLICT DO NOTHING`,
          [client.id, contractorId]
        );

        // ⚠ THE CURSOR IS WRITTEN INSIDE THE SAME TRANSACTION, AND THAT IS THE WHOLE
        // MECHANISM. Committed separately it would be a report of progress rather
        // than a record of it: a crash between the client's COMMIT and the cursor's
        // would re-do one client (harmless), and a crash the other way round would
        // SKIP one (not harmless, and silent). One commit makes the two agree by
        // construction.
        // ⚠ AND THE CURSOR STOPS ADVANCING AT THE FIRST FAILURE, WHICH IS WHAT MAKES
        // "a clean prefix" LITERALLY TRUE RATHER THAN NEARLY TRUE. This loop does not
        // abort on a failed client — it logs and carries on, which is right, because
        // one bad client should not cost the other 5,999. But that means a plain
        // high-water mark would record "attempted up to here", not "completed up to
        // here": a failure at ic-2 followed by a success at ic-3 would advance the
        // cursor PAST ic-2, and the resumed run would skip the one client that still
        // needed doing — silently, and forever, since nothing would ever revisit it.
        // Freezing the cursor at the last client before the first failure means a
        // resume retries from exactly the point where the run stopped being complete.
        concern = 'cursor';
        if (counts.failed === 0) {
          await tx.query(
            `UPDATE jobber_import_progress
                SET last_client_id = $2,
                    clients_done   = clients_done + 1,
                    updated_at     = NOW()
              WHERE contractor_id = $1`,
            [contractorId, client.id]
          );
        }

        await tx.query('COMMIT');

        counts.upserted += 1;
        if (pipelineStage) counts.staged += 1;
        counts.tagged += 1;
        importState.imported += 1;
        importState.tagged += 1;
      } catch (clientErr) {
        try { await tx.query('ROLLBACK'); } catch { /* the connection is already unusable */ }
        counts.failed += 1;
        // The concern name is what turns "the import failed" into "tag derivation
        // failed on client X" — recorded on the cursor row so it survives the process.
        await pool.query(
          `UPDATE jobber_import_progress
              SET failed = failed + 1, last_error = $2, last_failed_concern = $3, updated_at = NOW()
            WHERE contractor_id = $1`,
          [contractorId, clientErr.message, concern]
        ).catch(() => { /* never let the progress write mask the real error */ });
        await logError({
          req: null,
          contractorId,
          error: new Error(`fullJobberImport Step H+I — client ${client.id} failed at ${concern}: ${clientErr.message}`),
          source: 'fullJobberImport — per-client transaction',
        });
        console.error(`[fullJobberImport] client ${client.id} failed at ${concern}: ${clientErr.message}`);
      } finally {
        tx.release();
      }

      if (counts.upserted % 100 === 0) {
        console.log(`[fullJobberImport] Step H+I — ${counts.upserted}/${filteredClients.length - skipped} written`);
      }
    }

    console.log(
      `[fullJobberImport] Step H+I complete — upserted ${counts.upserted}, staged ${counts.staged}, `
      + `tagged ${counts.tagged}, failed ${counts.failed}, skipped ${skipped} (resumed)`
    );

    // ⚠ COMPLETE ONLY WHEN NOTHING FAILED — THE CLOSURE HALF, AND IT WAS WRONG FIRST.
    // This originally set completed_at unconditionally, so a run that failed two of
    // three clients still marked itself finished, the resume read (which requires
    // completed_at IS NULL) found nothing, and the cursor could never be acted on. The
    // mechanism recorded progress arriving and had no way to record that it had NOT
    // arrived — the exact asymmetry CLAUDE.md names. Caught by the resume test, which
    // is the only reason it is not still there.
    if (counts.failed === 0) {
      await pool.query(
        `UPDATE jobber_import_progress SET completed_at = NOW(), updated_at = NOW()
          WHERE contractor_id = $1`,
        [contractorId]
      );
    } else {
      console.warn(
        `[fullJobberImport] run left OPEN for resume — ${counts.failed} client(s) failed, `
        + `cursor held at ${counts.upserted > 0 ? 'the last completed client' : 'the start'}`
      );
    }

    // ── PHASE 2 — Contact matching pass ──────────────────────────────────────
    // Run ONCE as a full pass (iterates all contacts, not per-client).
    // Per-client matching (single jobber client scope) is only for webhook handlers.
    console.log('[fullJobberImport] Phase 2 — running contact matching pass (full pass)...');
    importState.status = 'matching';
    importState.matchingProgress = { processed: 0, total: filteredClients.length, linked: 0 };

    try {
      const matchResult = await runContactMatchingPass(contractorId);
      importState.matchingProgress.processed = filteredClients.length;
      importState.matchingProgress.linked = matchResult.linked;
      importState.linksEstablished = matchResult.linked;
    } catch (err) {
      await logError({ req: null, error: err, source: 'fullJobberImport — Phase 2 matching pass' });
    }

    if (importState.linksEstablished > 0) {
      await pool.query(
        `INSERT INTO notifications (contractor_id, type, title, body)
         VALUES ($1, 'import_complete', 'Import complete', $2)`,
        [contractorId, `${importState.imported} clients imported, ${importState.linksEstablished} contact links established.`]
      );
    }

    // ── REP SCOPE — Rep Steps 1-3, stages, sales, then the replay ────────────
    // ⚠ AFTER THE CAMPAIGN IMPORT, AND IN ITS OWN try, ON PURPOSE. Everything above has
    // committed by now, so a rep-scope failure — including a schema error on the
    // createdAt filter, which is observed only at a newer API version — cannot touch the
    // campaign result. It is recorded on importState and the run still completes.
    // ⚠ Steps A-I above are UNCHANGED by this block (ruling 2); see repImportScope.js
    // for why the rep scope fetches its own data rather than reading theirs.
    importState.status = 'rep_history';
    try {
      importState.repScope = await runRepScope(pool, {
        contractorId,
        filterPreference,
        getToken: () => getFreshToken(contractorId),
        onStep: (label) => { importState.repStep = label; },
      });
      // Ruling 5: an import completing lights up the books of reps ALREADY mapped. No
      // Jobber call — it reads the facts written just above.
      importState.repStep = 'Rep replay';
      const replay = await replayForMappedReps(pool, { contractorId });
      if (replay) importState.repScope.replay = { clients: replay.clientsDone, failed: replay.failed };
    } catch (repErr) {
      importState.repScopeError = repErr.message;
      await logError({ req: null, contractorId, error: repErr, source: 'fullJobberImport — rep scope' });
      console.error('[fullJobberImport] Rep scope failed (campaign import already complete):', repErr.message);
    }
    importState.repStep = null;

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

module.exports = { runFullJobberImport, importState, _setTestOverrides, _resetTestOverrides };
