'use strict';

// ── SHARED FULL-CLIENT FETCH — THE CAPTURE-PATH FETCH CONTRACT ───────────────
// Extracted from server/routes/webhooks/jobber.js in Canvass-3.7; rewritten in 3d Phase 1a
// Commit 2 to page to exhaustion, to carry the money fields a sale's value needs, and to
// treat a GraphQL error as a FAILURE rather than an absence.
//
// WHY IT LIVES HERE: server/cron/jobs/repRequestSweep.js needs the same fetch, and a cron job
// importing a route file is the wrong direction — routes may import utils, never the reverse.
// The alternative was a second copy of this query, which is precisely what CLAUDE.md's
// "duplicate logic must be extracted to a shared utility" forbids, and a selection set
// duplicated across two files is one of the cheaper ways to ship a client object that is
// missing a field its consumer silently defaults.
//
// ⚠ THREE THINGS THIS MODULE GUARANTEES, AND EACH ONE REPLACED A DEFECT:
//   1. A GraphQL error is a THROWN failure. Jobber answers a failed query with HTTP 200 plus
//      an errors array, and jobberShouldRetry reads only error.response.status — so
//      retryWithBackoff resolves happily on exactly the failure we are most likely to hit.
//   2. NO FIXED CAP SILENTLY DROPS RECORDS. Every connection is paged to exhaustion (N3).
//      The old selection read jobs(first: 10) and invoices(first: 5); a long-time client with
//      eleven jobs lost one, and nothing said so.
//   3. THE INVOICE SET IS AUTHORITATIVE AND IS KEYED BY INVOICE ID. Invoices are paged off
//      Client.invoices rather than read through each job's nested connection, because
//      Invoice.jobs is itself a CONNECTION — one invoice can cover several jobs. Each job's
//      invoices.nodes is then REBUILT from that set, so a job can never lose an invoice to a
//      nested cap, and an invoice covering three jobs is stored once and appears under each.
//
// ⚠ EVERY FIELD BELOW IS VERIFIED AT THE PINNED VERSION 2026-05-12 by introspection Danny ran
// in Jobber's Developer Center. GraphQL has no optional field — an unknown field fails the
// WHOLE query, not itself — so a selection is a claim about the schema and this one is sourced.
//
// ⚠ MONEY IS A Float IN JOBBER AND IS DOLLARS, NOT CENTS (e.g. 29724.8). It is passed through
// unconverted here. Rounding to NUMERIC(12,2) belongs to whatever stores it, and must go via a
// decimal/string path rather than cents arithmetic.
//
// ⚠ AND "PAID" IS invoiceBalance = 0, NOT total MINUS paymentsTotal. Danny's ruling; the
// balance is authoritative and the subtraction is a reconstruction that drifts.
//
// ⚠ A VOIDED INVOICE IS STILL FETCHED, DELIBERATELY. 2026-05-12 added the enum value `voided`
// to InvoiceStatusTypeEnum, and a voided invoice's STATUS is a fact worth having. Nothing in
// this module treats it as paid, and nothing downstream may count it toward a sale's value.

const axios = require('axios');
const { retryWithBackoff } = require('./retryWithBackoff');
const { jobberShouldRetry } = require('./retryHelpers');

const JOBBER_GRAPHQL_URL = 'https://api.getjobber.com/api/graphql';
const JOBBER_API_VERSION = '2026-05-12';

// Page size per round trip.
//
// ⚠ LOWERED 50 → 20 IN 3d PHASE 1a COMMIT 5, AND THE REASON IS `requestedQueryCost`, NOT
// `actualQueryCost`. Danny measured this query in GraphiQL at the pinned 2026-05-12 (client
// Adrianne Boswell, first page): **requested 7730, actual 240** — a ~32× gap. Jobber checks
// the REQUESTED figure against the available bucket BEFORE running the query and refunds the
// unused part afterwards, so at ~7730 reserved against a 10000 ceiling **a capture only runs
// when the bucket is nearly full.** Any concurrent Jobber use — the rep sweep, a webhook
// burst, an import — throttles captures that in truth cost a few hundred points each.
// ⚠ AND ONE CLIENT EDIT SENDS TWO OF THEM: client-create and client-update call
// fetchFullClient AND fetchClientRelatedData (requested 8128), back to back.
// ⚠ SMALLER PAGES LOSE NOTHING HERE **BECAUSE EVERY CLIENT-LEVEL CONNECTION IS PAGED TO
// EXHAUSTION** (N3, Commit 2) — pageClientConnection throws rather than returning a short
// answer. The cost of a lower number is more round trips on a large client, each one cheap
// enough to be admitted when the bucket is only part-full, which is the trade being made.
const PAGE_SIZE = 20;

// Nested job ids per invoice. This is the ONE remaining nested cap and it is not a record
// cap: it bounds how many jobs a SINGLE invoice may name. A cap that could silently drop a
// job id would break the invoice-to-sale link, so it THROWS rather than truncating — see
// assertInvoiceJobsComplete below.
//
// ⚠ DELIBERATELY **NOT** LOWERED IN COMMIT 5, AND THIS IS THE ONE PLACE WHERE "smaller pages
// lose nothing" IS FALSE. This connection is NOT paged — `assertInvoiceJobsComplete` THROWS
// when it overflows. So cutting it to 10 would not shrink a page; it would turn every invoice
// naming 11+ jobs into a hard capture failure, and under Commit 5's rule 2 a failed capture
// means **no decision is written for that client at all.** It is the largest single term in
// the requested cost (invoices × (jobs + archivedJobs)) and it still stays at 50 for that
// reason. Lowering it requires paging it first, which is its own commit.
const INVOICE_JOBS_PAGE_SIZE = 50;

// People on ONE assessment. ⚠ A HARD CAP THAT TRUNCATES SILENTLY, AND 7a DOES NOT FIX IT — it is
// named here so the number has one home and the limit is visible. The engine's Mode A reads this
// list to decide whether an assessment names one rep (a match) or two (a co-assignment flag), so a
// sixth person is simply absent from that decision. `assignedUsers` is a connection and Jobber
// would report `pageInfo.hasNextPage`, but nothing selects it and nothing pages it, so the
// truncation is NOT detectable after the fact: five ids look exactly like all of them. Matches the
// import's REP_REQUESTS_QUERY, which carries the same cap. Filed, not fixed.
const ASSIGNED_USERS_PAGE_SIZE = 5;

// A runaway guard, not a record cap. Reaching it means the connection is larger than any real
// client and something is wrong with the cursor — so it THROWS rather than returning a short
// answer, which is the whole point of N3.
const MAX_PAGES = 200;

// ── THE QUERIES ──────────────────────────────────────────────────────────────
// Exported so the boundary fence in server/test/captureFetchContract.test.js can difference
// what the consumers READ against what these actually SELECT. That fence exists because
// loadContractorBranding() once omitted two columns its resolver read, and every surface
// silently fell back to a default: a test that injects the value itself cannot discover that
// nothing upstream supplies it.
//
// ⚠ NO BACKTICK MAY APPEAR IN A COMMENT INSIDE THESE TEMPLATE LITERALS. One closes the
// string, the remainder parses as an expression, and the file still loads.
//
// ⚠ AN INVOICE'S JOB SET IS TWO CONNECTIONS, AND SELECTING ONLY ONE OF THEM WAS A REAL GAP
// (3d Phase 1a Commit 3a). Jobber exposes `Invoice.jobs` and `Invoice.archivedJobs`
// SEPARATELY, and the repo's own live finding says so in terms: fetchInvoiceWithJobs in
// server/routes/webhooks/jobber.js carries *"archivedJobs must be fetched alongside jobs —
// archived jobs still carry job type"*, verified in the explorer on 2026-04-30, and Danny's
// 2026-05-12 introspection lists both on the Invoice type. Commit 2 selected `jobs` only, so
// `from_archived_jobs` in crm_invoice_job_links was STRUCTURALLY always false in production
// while the writer that sets it was correct and tested — the same shape as the font columns the
// branding loader never selected: a consumer reading a field no query asks for takes the
// default, and the default reads as an answer.

const CLIENT_SCALARS = `
            id firstName lastName createdAt isArchived
            customFields { ... on CustomFieldText { label valueText } }
            phones { number description }
            emails { address description }`;

// ⚠ `client { id }` IS LOAD-BEARING AND WAS ABSENT UNTIL COMMIT 5. writeQuoteFacts filters
// `n?.id && n.client?.id`, so a quote without it is DROPPED SILENTLY — no error, no row, and a
// capture that reports success having written nothing. It was invisible while the only writer of
// quote facts was the IMPORT, whose own query does select it (repImportScope.js); the moment a
// LIVE door captures, the omission decides every quote. Same shape as the font columns the
// branding loader never selected: a consumer reading a field no query asks for takes the default.
const QUOTE_FIELDS = `id quoteStatus createdAt lastTransitioned { approvedAt } salesperson { id } client { id }`;

// ── REQUESTS (3d Phase 1a Commit 7a) ─────────────────────────────────────────
//
// ⚠ THIS CONNECTION WAS ABSENT UNTIL 7a, AND ITS ABSENCE WAS SILENT DATA LOSS ON THE ONE DOOR
// WHOSE SUBJECT IS A REQUEST. attributeFromRequest fetches through fetchFullClient, and
// captureClientFacts reads client.requests?.nodes — so it received `undefined`, normalised it to
// [], and writeRequestFacts wrote ZERO rows while reporting success. Every request webhook and
// every repRequestSweep pass has been capturing no request facts at all.
//
// ⚠ THE FIELDS ARE EXACTLY WHAT writeRequestFacts READS, plus requestStatus.
// The writer keys on `id`, `createdAt` and `client.id` (it FILTERS OUT any node missing one of
// the three), and stores `salesperson.id`, `assessment.id` and the assessment's assignedUsers ids.
// ⚠ requestStatus IS SELECTED AND NOTHING ON THIS PATH READS IT TODAY. It is here because Danny
// specified it: deriveAndSaveTags builds the `request:*` tags from it on the OTHER fetch
// (fetchClientRelatedData), and having the two selections agree is worth one scalar. Recorded
// rather than quietly dropped, so nobody later "discovers" it as dead weight and removes it.
// ⚠ AND IT DIVERGES BY THAT ONE FIELD FROM THE IMPORT'S REP_REQUESTS_QUERY
// (server/jobs/repImportScope.js), which selects the same shape WITHOUT requestStatus. Stated
// because a difference between two selections that feed one writer is exactly what the mechanical
// fence exists to catch, and this one is deliberate.
const REQUEST_FIELDS = `id requestStatus createdAt
                client { id }
                salesperson { id }
                assessment { id assignedUsers(first: ${ASSIGNED_USERS_PAGE_SIZE}) { nodes { id } } }`;

// ⚠ EVERY FIELD BELOW IS READ BY A FACT WRITER IN server/utils/factCapture.js, AND THAT IS NOT
// A COINCIDENCE — it is enforced. The mechanical fence in
// server/test/captureFetchContract.test.js derives the writers' reads from their source and the
// selections from these constants, and fails on any field read but not selected. It replaced a
// HAND-MAINTAINED list that was written from Commit 2's needs and went stale the moment Commit 3
// added writers: it missed 26 fields, including `updatedAt`, which is the INPUT to the
// staleness guard — so that guard was inert in production while its own unit test proved the SQL
// worked. A fence built from a list someone maintains is a number in a governing document.
// ⚠ ALL OF THESE ARE VERIFIED AT THE PINNED 2026-05-12 by the introspection Danny ran in
// Jobber's Developer Center: the Job type carries jobNumber, jobStatus, jobType, title,
// createdAt, updatedAt, startAt, endAt, completedAt, total, invoicedTotal, uninvoicedTotal,
// client, quote, request and salesperson; the Invoice type carries invoiceNumber, invoiceStatus,
// createdAt, updatedAt, issuedDate, dueDate, receivedDate, client and amounts; and InvoiceAmounts
// carries total, subtotal, invoiceBalance, paymentsTotal, depositAmount, discountAmount and
// taxAmount. GraphQL has no optional field, so a selection is a claim about the schema.
const JOB_FIELDS = `id jobNumber jobStatus jobType title
                createdAt updatedAt startAt endAt completedAt
                total invoicedTotal uninvoicedTotal
                client { id } quote { id } request { id } salesperson { id }`;

const INVOICE_FIELDS = `id invoiceNumber invoiceStatus
                createdAt updatedAt issuedDate dueDate receivedDate
                client { id }
                amounts { total subtotal invoiceBalance paymentsTotal
                          depositAmount discountAmount taxAmount }
                jobs(first: ${INVOICE_JOBS_PAGE_SIZE}) { nodes { id } pageInfo { hasNextPage } }
                archivedJobs(first: ${INVOICE_JOBS_PAGE_SIZE}) { nodes { id } pageInfo { hasNextPage } }`;

const BASE_QUERY = `query GetClient($id: EncodedId!) {
          client(id: $id) {${CLIENT_SCALARS}
            quotes(first: ${PAGE_SIZE}) {
              nodes { ${QUOTE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
            jobs(first: ${PAGE_SIZE}) {
              nodes { ${JOB_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
            requests(first: ${PAGE_SIZE}) {
              nodes { ${REQUEST_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
            invoices(first: ${PAGE_SIZE}) {
              nodes { ${INVOICE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const QUOTES_PAGE_QUERY = `query GetClientQuotesPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            quotes(first: ${PAGE_SIZE}, after: $after) {
              nodes { ${QUOTE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const JOBS_PAGE_QUERY = `query GetClientJobsPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            jobs(first: ${PAGE_SIZE}, after: $after) {
              nodes { ${JOB_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

// ⚠ PAGED TO EXHAUSTION LIKE ITS THREE SIBLINGS (N3). Adding a connection with `first: 20` and
// no follow-up query would have swapped one silent truncation for another: a client with 21
// requests would lose the 21st with nothing to say so, which is the defect this module's header
// says it exists to prevent.
const REQUESTS_PAGE_QUERY = `query GetClientRequestsPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            requests(first: ${PAGE_SIZE}, after: $after) {
              nodes { ${REQUEST_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const INVOICES_PAGE_QUERY = `query GetClientInvoicesPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            invoices(first: ${PAGE_SIZE}, after: $after) {
              nodes { ${INVOICE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

/**
 * The one sanctioned Jobber POST for the capture path.
 * Inputs: query string, variables object, bearer token, a label for error messages.
 * Output: the axios response.
 * ⚠ Every caller must pass its result through assertNoJobberGraphQLErrors.
 */
async function capturePost(query, variables, token, meta = {}) {
  const response = await retryWithBackoff(
    () => axios.post(
      JOBBER_GRAPHQL_URL,
      { query, variables },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': JOBBER_API_VERSION,
        },
      }
    ),
    { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
  );
  logCaptureCost(response, meta);
  return response;
}

/**
 * Logs one line per capture-path Jobber fetch carrying the throttle figures.
 * Inputs: the axios response, and { door, contractorId, label } naming who asked.
 * Output: nothing. Never throws — a logging failure must not fail a capture.
 *
 * ⚠ IT LOGS `requestedQueryCost` FIRST BECAUSE THAT IS THE FIGURE THAT THROTTLES. Jobber
 * reserves the REQUESTED amount against the available bucket before running the query and
 * refunds the unused part after, so a capture whose ACTUAL cost is 240 can still be refused
 * when the bucket holds 7000. Danny measured exactly that gap in GraphiQL at 2026-05-12:
 * GetClient requested 7730 / actual 240, GetClientRelated requested 8128 / actual 351.
 * **A log that showed only `actualQueryCost` would report a system nowhere near its limit
 * while captures were being throttled** — the health-it-cannot-observe shape.
 *
 * ⚠ NO CLIENT DATA BEYOND THE ID. The line carries the door, the contractor, a label and the
 * four throttle numbers. Names, emails and phones are in the response and none of them go here.
 *
 * ⚠ AND THE NUMBERS COME FROM THE RESPONSE, NOT FROM A CONSTANT. `fullJobberImport`'s pacing
 * compares a hardcoded PAGE_COST against the bucket, and that constant's own comment records it
 * as unsourced; this line is what makes the real figure observable per query shape.
 */
function logCaptureCost(response, { door = 'capture', contractorId = null, label = null } = {}) {
  try {
    const cost = response?.data?.extensions?.cost;
    if (!cost) return;
    const t = cost.throttleStatus || {};
    // diagnostic log — intentional
    console.log(
      `[capture-cost] door=${door} contractor=${contractorId || '-'}`
      + `${label ? ` q=${label}` : ''}`
      + ` requested=${cost.requestedQueryCost} actual=${cost.actualQueryCost}`
      + ` available=${t.currentlyAvailable} max=${t.maximumAvailable} restore=${t.restoreRate}`
    );
  } catch {
    // A cost line is an observation, never a precondition.
  }
}

/**
 * Turns a 200-with-errors response into a thrown, DISTINGUISHABLE failure.
 * Inputs: the axios response, a label naming what was being fetched.
 * Output: nothing on success; throws otherwise.
 *
 * ⚠ THE DISTINGUISHABILITY IS THE POINT, NOT THE THROW. A caller has to be able to tell
 * "Jobber said no" from "this client genuinely has no data", because the second is a normal
 * quiet outcome and the first must never be written as one. The thrown error carries
 * `jobberGraphQLErrors`, so a caller can branch on the KIND of failure rather than on a
 * message string.
 */
function assertNoJobberGraphQLErrors(response, label) {
  const errors = response?.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const err = new Error(`${label}: Jobber GraphQL error: ${errors.map((e) => e?.message).join('; ')}`);
    err.jobberGraphQLErrors = errors;
    throw err;
  }
}

/**
 * An invoice may name several jobs, and losing one would break the invoice-to-sale link.
 * Inputs: the invoice nodes.
 * Output: nothing; throws if any invoice has more job ids than one page can carry.
 * ⚠ THROWS RATHER THAN TRUNCATING, because a silently short job set reads as a correct
 * invoice that simply belongs to fewer sales.
 */
function assertInvoiceJobsComplete(invoiceNodes, label) {
  for (const inv of invoiceNodes) {
    // ⚠ BOTH CONNECTIONS, because Jobber splits an invoice's jobs into `jobs` and
    // `archivedJobs` and either one truncating loses a real link. Checking only `jobs` was the
    // state this function shipped in at Commit 2, and it made an archived-job overflow
    // invisible while reading as a completeness check.
    const over = inv?.jobs?.pageInfo?.hasNextPage ? 'jobs'
      : inv?.archivedJobs?.pageInfo?.hasNextPage ? 'archivedJobs'
        : null;
    if (over) {
      throw new Error(
        `${label}: invoice ${inv.id} names more than ${INVOICE_JOBS_PAGE_SIZE} ${over} — `
        + 'the job set would be truncated and the invoice-to-sale link would be wrong'
      );
    }
  }
}

/**
 * Pages one of a client's connections to exhaustion.
 * Inputs: the follow-up query, the client id, the bearer token, the connection's field name,
 *         the first page already fetched, and a label.
 * Output: every node across every page, in Jobber's order.
 * ⚠ A missing endCursor with hasNextPage true is a THROW, never a quiet stop — that is the
 * shape that returns a short answer and looks complete.
 */
async function pageClientConnection({ query, clientId, token, field, firstPage, label, root = 'client', meta = {} }) {
  const nodes = [...(firstPage?.nodes || [])];
  let pageInfo = firstPage?.pageInfo;
  let pages = 1;

  while (pageInfo?.hasNextPage) {
    if (!pageInfo.endCursor) {
      throw new Error(`${label}: ${field} reported hasNextPage with no endCursor after ${pages} page(s)`);
    }
    if (pages >= MAX_PAGES) {
      throw new Error(`${label}: ${field} exceeded ${MAX_PAGES} pages — refusing to return a partial set`);
    }

    const response = await capturePost(query, { id: clientId, after: pageInfo.endCursor }, token,
      { ...meta, label: `${meta.label || field} p${pages + 1}` });
    assertNoJobberGraphQLErrors(response, `${label} (${field} page ${pages + 1})`);

    // ⚠ `root` EXISTS BECAUSE Invoice.jobs IS PAGED THE SAME WAY Client.jobs IS (Commit 3c), and
    // a second copy of this loop is what CLAUDE.md's shared-utility rule forbids. It defaults to
    // 'client' so every existing caller is unchanged.
    const connection = response.data?.data?.[root]?.[field];
    if (!connection) {
      throw new Error(`${label}: ${field} connection absent on page ${pages + 1}`);
    }
    nodes.push(...(connection.nodes || []));
    pageInfo = connection.pageInfo;
    pages += 1;
  }

  return nodes;
}

/**
 * Fetches complete client data from Jobber by ID — quotes, jobs and invoices, all paged to
 * exhaustion — for pipeline classification, tag derivation and the attribution engine.
 *
 * Inputs: the Jobber client id, a bearer token.
 * Output: a client object in the CONNECTION shape its consumers read —
 *         client.quotes.nodes, client.jobs.nodes, job.invoices.nodes — plus
 *         client.invoices.nodes as the authoritative, invoice-id-keyed set.
 * Throws: on a GraphQL error, on an absent client, and on any paging anomaly.
 *
 * ⚠ THE CONNECTION SHAPE IS LOAD-BEARING AND IS NOT A STYLE CHOICE. classifyPipelineStatus
 * reads client.jobs?.nodes and job.invoices?.nodes; hand it the FLATTENED object built for
 * deriveAndSaveTags and every branch reads an empty array, so it returns 'lead' for the whole
 * book with no error and the dependent stat sits at zero forever.
 */
async function fetchFullClient(clientId, token, costMeta = {}) {
  const label = `fetchFullClient ${clientId}`;
  // ⚠ OPTIONAL AND ADDITIVE (Commit 5). Every existing caller keeps working unchanged; a caller
  // that knows its door and contractor passes them so the cost line can be attributed. It is
  // the DOOR that makes the log useful — an untagged cost line cannot tell a webhook burst
  // from the sweep, which is the only question the numbers are being read to answer.
  const meta = { door: costMeta.door || 'fetchFullClient', contractorId: costMeta.contractorId || null, label: 'GetClient' };

  const response = await capturePost(BASE_QUERY, { id: clientId }, token, meta);
  assertNoJobberGraphQLErrors(response, label);

  const client = response.data?.data?.client;
  if (!client) {
    throw new Error(`fetchFullClient: no client returned for id ${clientId}`);
  }

  const [quoteNodes, jobNodes, invoiceNodes, requestNodes] = await Promise.all([
    pageClientConnection({ query: QUOTES_PAGE_QUERY, clientId, token, field: 'quotes', firstPage: client.quotes, label, meta }),
    pageClientConnection({ query: JOBS_PAGE_QUERY, clientId, token, field: 'jobs', firstPage: client.jobs, label, meta }),
    pageClientConnection({ query: INVOICES_PAGE_QUERY, clientId, token, field: 'invoices', firstPage: client.invoices, label, meta }),
    pageClientConnection({ query: REQUESTS_PAGE_QUERY, clientId, token, field: 'requests', firstPage: client.requests, label, meta }),
  ]);

  assertInvoiceJobsComplete(invoiceNodes, label);

  return {
    ...client,
    quotes: { nodes: quoteNodes },
    jobs: { nodes: attachInvoicesToJobs(jobNodes, invoiceNodes) },
    invoices: { nodes: invoiceNodes },
    // ⚠ THE CONNECTION SHAPE, matching its siblings, because captureClientFacts reads
    // client.requests?.nodes. A bare array here would read as absent and capture nothing — the
    // same undefined-vs-empty distinction that made this whole commit necessary.
    requests: { nodes: requestNodes },
  };
}

/**
 * Rebuilds each job's invoices.nodes from the authoritative invoice set.
 * Inputs: the job nodes, the invoice nodes (each carrying jobs.nodes of job ids).
 * Output: the job nodes, each with an invoices.nodes array.
 *
 * ⚠ ONE INVOICE CAN COVER SEVERAL JOBS, so it appears under each of them here and MUST be
 * counted once when a value is computed. The invoice set above is the thing keyed by invoice
 * id; this view is keyed by job and deliberately contains duplicates.
 */
function attachInvoicesToJobs(jobNodes, invoiceNodes) {
  const byJobId = new Map();
  for (const inv of invoiceNodes) {
    for (const j of (inv?.jobs?.nodes || [])) {
      if (!j?.id) continue;
      if (!byJobId.has(j.id)) byJobId.set(j.id, []);
      byJobId.get(j.id).push(inv);
    }
  }
  return jobNodes.map((job) => ({ ...job, invoices: { nodes: byJobId.get(job.id) || [] } }));
}

module.exports = {
  fetchFullClient,
  assertNoJobberGraphQLErrors,
  assertInvoiceJobsComplete,
  pageClientConnection,
  capturePost,
  attachInvoicesToJobs,
  JOBBER_API_VERSION,
  PAGE_SIZE,
  MAX_PAGES,
  // Exported for the boundary fence only. ⚠ THE FIELD CONSTANTS ARE EXPORTED SEPARATELY FROM THE
  // QUERIES ON PURPOSE: a fence that checks a writer's reads against a WHOLE query passes when
  // the field happens to appear somewhere else in it. That is not hypothetical — checking
  // writeJobFacts against BASE_QUERY reported `salesperson` and `total` as SELECTED, because
  // QUOTE_FIELDS carries a salesperson and INVOICE_FIELDS carries a total. Per-entity checking
  // is what makes the fence precise.
  BASE_QUERY,
  QUOTES_PAGE_QUERY,
  JOBS_PAGE_QUERY,
  INVOICES_PAGE_QUERY,
  JOB_FIELDS,
  INVOICE_FIELDS,
  QUOTE_FIELDS,
  REQUEST_FIELDS,
  REQUESTS_PAGE_QUERY,
  ASSIGNED_USERS_PAGE_SIZE,
};
