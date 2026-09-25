// Jobber webhook handlers
// HMAC verification uses process.env.JOBBER_CLIENT_SECRET — already present in Railway env vars, no new vars needed.
function escapeHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDollars(n) {
  return parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { pool } = require('../../db');
const { syncSingleClient, classifyPipelineStatus } = require('../../crm/pipelineSync');
const { refreshClientSales } = require('../../utils/clientSales');
const { logError } = require('../../middleware/errorLogger');
const { BRANDING_THEME_DEFAULTS } = require('../../utils/brandingTheme');
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { jobberShouldRetry, resendShouldRetry } = require('../../utils/retryHelpers');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { evaluateReferral } = require('../../referralRules');
const { isEmailSuppressed } = require('../../utils/emailSuppression');
const { applyTag } = require('../../utils/tags');
const deriveAndSaveTags = require('../../utils/deriveJobberTags');
const { runContactMatchingPass } = require('../../jobs/contactMatchingPass');
const { refreshTokenIfNeeded, getFreshContractorAccessToken, fetchRequestById, fetchAttributionData } = require('../../crm/jobber');
const { attributeFromRequest } = require('../../utils/requestAttribution');
const {
  fetchFullClient,
  assertNoJobberGraphQLErrors,
  assertInvoiceJobsComplete,
  pageClientConnection,
  capturePost,
  attachInvoicesToJobs,
} = require('../../utils/jobberClientFetch');

// ── HMAC SIGNATURE VERIFICATION ───────────────────────────────────────────────
// Returns true if the request passes verification, false and sends 401 otherwise.
// TODO: confirm exact Jobber webhook signature header name before Marketplace submission
function verifyJobberWebhookSignature(req, res) {
  const signature = req.headers['x-jobber-hmac-sha256'];
  const secret    = process.env.JOBBER_CLIENT_SECRET;

  if (!secret) {
    console.error('[jobber-webhook] JOBBER_CLIENT_SECRET not set — cannot verify signature');
    res.status(401).json({ error: 'Webhook secret not configured' });
    return false;
  }
  if (!signature) {
    console.warn('[jobber-webhook] Missing x-jobber-hmac-sha256 header — rejecting request');
    res.status(401).json({ error: 'Missing signature' });
    return false;
  }

  const expectedSig = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
  if (signature !== expectedSig) {
    console.warn('[jobber-webhook] Signature mismatch — rejecting request');
    res.status(401).json({ error: 'Invalid signature' });
    return false;
  }

  return true;
}

// ── FULL CLIENT FETCH ─────────────────────────────────────────────────────────
// Fetches complete client data from Jobber by ID, including quotes/jobs/invoices
// needed for accurate pipeline status classification. Called from webhook handlers
// so classifyPipelineStatus gets full data rather than the sparse webhook payload.
//
// ⚠ MOVED TO server/utils/jobberClientFetch.js IN CANVASS-3.7, VERBATIM. The cron
// sweep (server/cron/jobs/repRequestSweep.js) needs the same fetch, and a cron job
// importing a route file is the wrong direction. Imported at the top of this file;
// the _fetchFullClient test seam below is unchanged and still wraps it.

// ── INVOICE + JOBS FETCH (Referral Rules Engine) ──────────────────────────────
// Fetches a single invoice with full job data, custom fields, and invoice amounts.
// Used exclusively by the referral rules engine inside the invoice-paid handler.
// fetchFullClient() is a SEPARATE fetch and this one does not replace it. ⚠ That sentence used
// to read "fetchFullClient() is intentionally NOT modified", which a reader today would take as
// a standing rule: Commit 2 DID widen fetchFullClient, for its own reasons. What stays true is
// that these two fetches are distinct and neither is derived from the other.
//
// GraphQL field names verified via live Jobber GraphQL explorer on 2026-04-30:
//   - amounts.total = whole dollars (NOT cents). 3595 = $3,595. Do NOT divide by 100.
//   - waitingForFinancedPayment = boolean — defer processing if true
//   - Job Type lives at label === "Job Type" → valueDropdown (CustomFieldDropdown)
//   - archivedJobs must be fetched alongside jobs — archived jobs still carry job type
async function fetchInvoiceWithJobs(invoiceId, token) {
  const response = await retryWithBackoff(
    () => axios.post(
      'https://api.getjobber.com/api/graphql',
      {
        query: `query GetInvoiceWithJobs($id: EncodedId!) {
          invoice(id: $id) {
            id
            invoiceNumber
            invoiceStatus
            issuedDate
            waitingForFinancedPayment
            amounts { total }
            client { id name }
            jobs(first: 10) {
              nodes {
                id
                customFields {
                  ... on CustomFieldText { label valueText }
                  ... on CustomFieldDropdown { label valueDropdown }
                }
              }
            }
            archivedJobs(first: 10) {
              nodes {
                id
                customFields {
                  ... on CustomFieldText { label valueText }
                  ... on CustomFieldDropdown { label valueDropdown }
                }
              }
            }
          }
        }`,
        variables: { id: invoiceId },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-05-12',
        },
      }
    ),
    { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
  );

  // ⚠ ORDER MATTERS: read the errors array BEFORE the absence check. Both produce a throw, but
  // only this one says WHY — a 200-with-errors otherwise surfaced as "no invoice returned",
  // which reads as a deleted invoice rather than a failed query.
  assertNoJobberGraphQLErrors(response, `fetchInvoiceWithJobs ${invoiceId}`);
  if (!response.data?.data?.invoice) {
    throw new Error(`fetchInvoiceWithJobs: no invoice returned for id ${invoiceId}`);
  }
  return response.data.data.invoice;
}

// ── CLIENT JOBS FETCH (for job-update pipeline check) ─────────────────────────
// Fetches all jobs for a client so job-update can find the current job's status/total
// and compare against sibling jobs. Extracted to its own function (rather than an
// inline axios call) so it can be swapped for a test stub, matching the pattern used
// by fetchFullClient/fetchInvoiceWithJobs/fetchClientRelatedData above.
async function fetchClientJobsForJobUpdate(clientId, token) {
  const response = await retryWithBackoff(
    () => axios.post(
      'https://api.getjobber.com/api/graphql',
      {
        query: `query GetClientJobs($id: EncodedId!) {
          client(id: $id) {
            jobs(first: 20) {
              nodes { id jobStatus total }
            }
          }
        }`,
        variables: { id: clientId },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-05-12',
        },
      }
    ),
    { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
  );
  // ⚠ SAME DEFECT AS fetchClientRelatedData CARRIED, FIXED HERE FOR THE SAME REASON RATHER
  // THAN LEFT AS A KNOWN INSTANCE. This ended `|| []`, so a 200-with-errors produced an EMPTY
  // job list — and job-update compares the current job against its siblings, so "no siblings"
  // is a confident wrong answer rather than a missing one. The ERRORS RULE is "every Jobber
  // fetch in the capture path", not "the one the design named".
  assertNoJobberGraphQLErrors(response, `fetchClientJobsForJobUpdate ${clientId}`);
  return response.data?.data?.client?.jobs?.nodes || [];
}

// ── CLIENT RELATED DATA FETCH (for tag derivation and stage classification) ───
// Fetches jobs, quotes, requests and invoices for a single client — used by tag derivation
// after CLIENT_CREATE, CLIENT_UPDATE, JOB_UPDATE and INVOICE_UPDATE, and by the three stage
// webhooks to classify a pipeline stage.
//
// ⚠ IT USED TO END `return response.data?.data?.client || null;` AND THAT WAS THE LIVE DEFECT
// THIS COMMIT EXISTS FOR. Jobber answers a FAILED query with HTTP 200 plus an errors array, and
// jobberShouldRetry reads only error.response.status — so retryWithBackoff resolved happily,
// `data.client` was null, and the function returned the SAME `null` it returns for a client that
// genuinely has no data. The stage webhook reads that null as "not observed" and logs a calm
// "no related data, no stage written" line, so a broken fetch was indistinguishable from a quiet
// client and never reached error_log at all.
//
// ⚠ SO THE CONTRACT IS NOW TWO-VALUED, AND THE DISTINCTION IS THE PRODUCT:
//   · THROWS  — Jobber said no. The error carries `jobberGraphQLErrors`. Every caller logs it.
//   · null    — a clean 200 whose `data.client` is null. The client is genuinely absent, which
//               is a normal quiet outcome and stays one.
// A caller may treat null as an absence. It may NEVER treat a throw as one.
//
// ⚠ AND NO FIXED CAP SILENTLY DROPS RECORDS (N3). jobs, quotes, requests and invoices are all
// paged to exhaustion. This selection read jobs(first: 50), quotes(first: 20),
// requests(first: 20) and an UNBOUNDED nested `invoices { nodes }` — so a long-time client lost
// jobs past the fiftieth with nothing to say so, and the tag derived from "the latest job" was
// computed from a truncated list.
//
// ⚠ THE INVOICE MONEY FIELDS ARE HERE BECAUSE A SALE'S VALUE NEEDS THEM, and they are verified
// at 2026-05-12: amounts { total invoiceBalance paymentsTotal }. "Paid" is invoiceBalance = 0
// by ruling, never total minus paymentsTotal. A VOIDED invoice is fetched like any other — its
// status is a fact — and nothing here treats it as paid.
const RELATED_JOB_FIELDS = `id jobStatus jobType completedAt createdAt
                customFields {
                  ... on CustomFieldText { label valueText }
                  ... on CustomFieldDropdown { label valueDropdown }
                }`;

const RELATED_INVOICE_FIELDS = `id invoiceStatus createdAt issuedDate dueDate
                amounts { total invoiceBalance paymentsTotal }
                jobs(first: 50) { nodes { id } pageInfo { hasNextPage } }
                archivedJobs(first: 50) { nodes { id } pageInfo { hasNextPage } }`;

const RELATED_QUOTE_FIELDS = `id quoteStatus createdAt lastTransitioned { approvedAt } salesperson { id }`;

const RELATED_BASE_QUERY = `query GetClientRelated($id: EncodedId!) {
          client(id: $id) {
            isCompany isLead
            tags { nodes { label } }
            customFields {
              ... on CustomFieldText { label valueText }
              ... on CustomFieldDropdown { label valueDropdown }
            }
            jobs(first: 50) {
              nodes { ${RELATED_JOB_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
            quotes(first: 50) {
              nodes { ${RELATED_QUOTE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
            requests(first: 50) {
              nodes { id requestStatus createdAt }
              pageInfo { hasNextPage endCursor }
            }
            invoices(first: 50) {
              nodes { ${RELATED_INVOICE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const RELATED_JOBS_PAGE_QUERY = `query GetClientRelatedJobsPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            jobs(first: 50, after: $after) {
              nodes { ${RELATED_JOB_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const RELATED_QUOTES_PAGE_QUERY = `query GetClientRelatedQuotesPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            quotes(first: 50, after: $after) {
              nodes { ${RELATED_QUOTE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const RELATED_REQUESTS_PAGE_QUERY = `query GetClientRelatedRequestsPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            requests(first: 50, after: $after) {
              nodes { id requestStatus createdAt }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const RELATED_INVOICES_PAGE_QUERY = `query GetClientRelatedInvoicesPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            invoices(first: 50, after: $after) {
              nodes { ${RELATED_INVOICE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

async function fetchClientRelatedData(clientId, token) {
  const label = `fetchClientRelatedData ${clientId}`;

  const response = await capturePost(RELATED_BASE_QUERY, { id: clientId }, token);
  assertNoJobberGraphQLErrors(response, label);

  const client = response.data?.data?.client;
  // A clean 200 with no client is a genuine absence and stays one.
  if (!client) return null;

  const [jobNodes, quoteNodes, requestNodes, invoiceNodes] = await Promise.all([
    pageClientConnection({ query: RELATED_JOBS_PAGE_QUERY, clientId, token, field: 'jobs', firstPage: client.jobs, label }),
    pageClientConnection({ query: RELATED_QUOTES_PAGE_QUERY, clientId, token, field: 'quotes', firstPage: client.quotes, label }),
    pageClientConnection({ query: RELATED_REQUESTS_PAGE_QUERY, clientId, token, field: 'requests', firstPage: client.requests, label }),
    pageClientConnection({ query: RELATED_INVOICES_PAGE_QUERY, clientId, token, field: 'invoices', firstPage: client.invoices, label }),
  ]);

  assertInvoiceJobsComplete(invoiceNodes, label);

  return {
    ...client,
    jobs: { nodes: attachInvoicesToJobs(jobNodes, invoiceNodes) },
    quotes: { nodes: quoteNodes },
    requests: { nodes: requestNodes },
    invoices: { nodes: invoiceNodes },
  };
}

// ── TEST SEAMS ─────────────────────────────────────────────────────────────────
// Module-level variables default to the real implementations.
// Inert in production — never overridden outside tests.
let _fetchInvoiceWithJobs         = fetchInvoiceWithJobs;
let _fetchFullClient              = fetchFullClient;
let _fetchClientRelatedData       = fetchClientRelatedData;
let _fetchClientJobsForJobUpdate  = fetchClientJobsForJobUpdate;
let _refreshTokenIfNeeded         = refreshTokenIfNeeded;
let _getFreshContractorAccessToken = getFreshContractorAccessToken;
let _fetchRequestById             = fetchRequestById;
let _fetchAttributionData         = fetchAttributionData;
// Canvass-stage. Declared HERE with its siblings, not beside its function at the foot of
// the file: a `let` initialised down there would be in the TDZ for any caller that ran
// first, and this file's seam note is explicit that load-order is a timing argument and
// not a guarantee. The function itself hoists, so naming it from up here is safe.
let _fetchStageSubjectClient      = fetchStageSubjectClient;
let _sendEmail                    = (...args) => resend.emails.send(...args);

// test seam — inert in production, never called outside server/test/
function _setTestOverrides({
  fetchInvoiceWithJobs: a,
  fetchFullClient: b,
  fetchClientRelatedData: c,
  sendEmail: d,
  fetchClientJobsForJobUpdate: e,
  refreshTokenIfNeeded: f,
  getFreshContractorAccessToken: g,
  fetchRequestById: h,
  fetchAttributionData: i,
  fetchStageSubjectClient: j,
} = {}) {
  if (a !== undefined) _fetchInvoiceWithJobs        = a;
  if (b !== undefined) _fetchFullClient              = b;
  if (c !== undefined) _fetchClientRelatedData       = c;
  if (d !== undefined) _sendEmail                    = d;
  if (e !== undefined) _fetchClientJobsForJobUpdate  = e;
  if (f !== undefined) _refreshTokenIfNeeded         = f;
  if (g !== undefined) _getFreshContractorAccessToken = g;
  if (h !== undefined) _fetchRequestById             = h;
  if (i !== undefined) _fetchAttributionData         = i;
  if (j !== undefined) _fetchStageSubjectClient      = j;
}

// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() {
  _fetchInvoiceWithJobs        = fetchInvoiceWithJobs;
  _fetchFullClient             = fetchFullClient;
  _fetchClientRelatedData      = fetchClientRelatedData;
  _fetchClientJobsForJobUpdate = fetchClientJobsForJobUpdate;
  _refreshTokenIfNeeded        = refreshTokenIfNeeded;
  _getFreshContractorAccessToken = getFreshContractorAccessToken;
  _fetchRequestById            = fetchRequestById;
  _fetchAttributionData        = fetchAttributionData;
  _fetchStageSubjectClient     = fetchStageSubjectClient;
  _sendEmail                   = (...args) => resend.emails.send(...args);
}

// ── CONTRACTOR RESOLUTION QUARANTINE ──────────────────────────────────────────
// resolveWebhookContractorId() resolves contractor_id from the Jobber webhook payload's
// data.webHookEvent.accountId (confirmed field name, Jobber Developer Center docs,
// 2026-07-07) against contractor_crm_settings.jobber_account_id, captured at OAuth-connect
// time (server/routes/oauth.js). accountId is present on every event, including the
// first-ever CLIENT_CREATE for a brand-new client, so there is no chicken-and-egg problem.
// client-update additionally accepts a defensive fallbackLookup (a local jobber_clients
// lookup) for clients synced before the jobber_account_id backfill existed. There is no
// safe guess when neither path resolves — client-supplied contractorId (query/payload) is
// never trusted for tenancy. Jobber retries webhooks on non-2xx responses, but an
// unresolved accountId cannot self-resolve within a retry window — it needs a code/data
// fix — so retrying would just hammer a permanent failure. We ack 200 and quarantine the
// event in error_log (topic + item id + raw payload) instead, so it can be manually
// reconciled once the underlying condition is fixed. The 30-minute pipeline sync cron
// (crm/pipelineSync.js) is the backstop that eventually reconciles pipeline_cache state
// for any webhook lost this way.
async function resolveWebhookContractorId(payload, fallbackLookup) {
  const accountId = payload?.data?.webHookEvent?.accountId; // confirmed field name, Jobber Developer Center docs, 2026-07-07
  if (accountId) {
    const { rows } = await pool.query(
      'SELECT contractor_id FROM contractor_crm_settings WHERE jobber_account_id = $1',
      [accountId]
    );
    if (rows.length) return rows[0].contractor_id;
  }
  if (fallbackLookup) {
    const viaLocalData = await fallbackLookup();
    if (viaLocalData) return viaLocalData;
  }
  throw new Error('resolveWebhookContractorId: could not resolve contractor_id from payload accountId or local data');
}

async function logWebhookResolutionFailure(req, topic, itemId, payload, err) {
  const message = `[webhook-resolution] topic=${topic} itemId=${itemId ?? 'n/a'}: ${err.message}`;
  const quarantineErr = new Error(message);
  quarantineErr.stack = `${message}\n\nRaw payload:\n${JSON.stringify(payload)}\n\nOriginal stack:\n${err.stack}`;
  await logError({ req, error: quarantineErr, source: `POST /webhooks/jobber/${topic} — contractor resolution` });
}

// Upserts a client into jobber_clients and derives+saves all tags.
// Called fire-and-forget from webhook handlers.
async function upsertAndTagClient(contractorId, fullClient, relatedData) {
  const email = fullClient.emails?.find(e => e.isPrimary)?.address
    || fullClient.emails?.[0]?.address
    || null;
  const phone = fullClient.phones?.find(p => p.isPrimary)?.number
    || fullClient.phones?.[0]?.number
    || null;

  // ── PIPELINE STAGE (Canvass-stage Part 1) ──────────────────────────────────
  //
  // ⚠ relatedData GOES IN WHOLE, AND THAT IS THE POINT — IT IS ALREADY THE SHAPE
  // classifyPipelineStatus WANTS. fetchClientRelatedData returns the raw Jobber
  // client, so `jobs: { nodes: [...] }`, `quotes: { nodes: [...] }` and each job's
  // `invoices: { nodes: [...] }` are all intact.
  //
  // ⚠ DO NOT PASS THE `clientData` BUILT BELOW. That object flattens each job's
  // invoices and hands `jobs` over as a bare array, because deriveAndSaveTags wants
  // the opposite shape. The classifier reads `client.jobs?.nodes`, so the flattened
  // form yields an empty array, hits the "no jobs and no quotes" branch, and returns
  // 'lead' — for EVERY client, with no error anywhere. Two consumers of one fetch
  // needing opposite shapes is the whole trap; see the note in jobberIncrementalSync.
  //
  // ⚠ GATED ON relatedData BEING PRESENT, MATCHING THE TAG BLOCK BELOW. Two of this
  // function's four callers already guard `if (relatedData)`; the other two pass the
  // result of a fetch that resolves to null on failure. A null stage here means "not
  // observed this pass" and the COALESCE below preserves whatever was already stored.
  const pipelineStage = relatedData ? classifyPipelineStatus(relatedData) : null;

  // ── BLANK PROTECTION (Wave 0.2 item 1) ──────────────────────────────────────
  // COALESCE, not EXCLUDED, on the four identity-bearing columns. This upsert has
  // callers that pass a PARTIAL shell rather than a full client: job-update builds
  // { id, firstName: null, lastName: null, emails: [], phones: [] } and invoice-paid
  // copies only what its invoice fetch happened to return. Under the previous
  // unconditional DO UPDATE, one JOB_UPDATE webhook overwrote a good row's name,
  // email and phone with NULL — and those four columns are exactly what the contact
  // matcher reads. Confirmed by test T1, which was proven RED against that behaviour.
  //
  // The three booleans below deliberately do NOT get COALESCE. false is a meaningful
  // value there, the parameters are coerced with === true so they are never null, and
  // coalescing them would make "no longer a lead" unrepresentable. Write the guard the
  // value needs: do not correct them into line with the four above.
  //
  // MVP SHORTCUT:
  //   (a) LIMITATION — a value genuinely CLEARED in Jobber never propagates here.
  //       Deleting a client's phone number in Jobber leaves the old one in this table
  //       indefinitely. COALESCE cannot tell "absent from this payload" from
  //       "explicitly emptied", because both arrive as null.
  //   (b) SCALABLE VERSION — writers declare which columns they actually observed (an
  //       explicit observed-field set, or per-column present-in-payload flags) and the
  //       upsert overwrites only those. That distinguishes the two cases properly and
  //       lets a real clear through while still rejecting a shell's nulls.
  //   (c) WHEN — when a contractor first reports contact data that they cleared in
  //       Jobber and that is still showing here, or when the Wave 0.4 matcher begins
  //       auto-linking on these columns, whichever comes first.
  //
  // Scoped to THIS writer only. The other two jobber_clients writers — the per-client
  // upsert in jobberIncrementalSync's runForContractor loop, and the per-client
  // transaction in fullJobberImport's Step H+I — always carry full Jobber payloads.
  // They are precisely where a legitimate clear arrives, and coalescing the four
  // identity columns there would freeze cleared fields permanently.
  //
  // ⚠ CITED BY ROLE SINCE CANVASS-STAGE, AND THE REPAIR IS WORTH THE LINE BECAUSE THE
  // OLD FORM WAS HALF WRONG IN EXACTLY THE WAY CLAUDE.md PREDICTS. It read
  // "jobberIncrementalSync.js:162 and fullJobberImport.js:542". Verified at 8da50a2
  // before repairing: the fullJobberImport citation was CORRECT (it landed on the
  // INSERT), and the jobberIncrementalSync one was ALREADY WRONG — :162 is GraphQL
  // error handling inside the paging loop, while that writer sat at :286.
  // ⚠ Canvass-stage moved BOTH targets, so citecheck flagged both identically as
  // LIKELY ROTTED. Adding this commit's delta to each — the one-keystroke repair —
  // would have shifted the correct citation off its target AND certified the wrong one
  // as fixed. A function name does not drift; a line number does, and says nothing
  // about whether it was ever right.
  await pool.query(
    `INSERT INTO jobber_clients
       (jobber_client_id, contractor_id, first_name, last_name, email, phone,
        is_company, is_lead, is_archived, pipeline_stage, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE SET
       first_name = COALESCE(EXCLUDED.first_name, jobber_clients.first_name),
       last_name = COALESCE(EXCLUDED.last_name, jobber_clients.last_name),
       email = COALESCE(EXCLUDED.email, jobber_clients.email),
       phone = COALESCE(EXCLUDED.phone, jobber_clients.phone),
       is_company = EXCLUDED.is_company,
       is_lead = EXCLUDED.is_lead,
       is_archived = EXCLUDED.is_archived,
       -- COALESCE for the same reason as the four identity columns above, arrived at
       -- independently: a caller with no relatedData supplies null, and null here means
       -- "not observed", never "no stage". The MVP-shortcut caveat recorded above does
       -- NOT apply to this column — a stage cannot be "cleared" in Jobber, only moved to
       -- another of the five values, so there is no legitimate clear for COALESCE to eat.
       pipeline_stage = COALESCE(EXCLUDED.pipeline_stage, jobber_clients.pipeline_stage),
       last_synced_at = NOW()`,
    [
      fullClient.id,
      contractorId,
      fullClient.firstName || null,
      fullClient.lastName || null,
      email,
      phone,
      (relatedData?.isCompany ?? fullClient.isCompany) === true,
      (relatedData?.isLead ?? fullClient.isLead) === true,
      // ⚠ This was a hardcoded `false` until Wave 0.2 item 4c, so EVERY webhook path
      // wrote is_archived = false regardless of the client's real state in Jobber —
      // a successful write with a wrong value, which leaves no error and no skip row
      // to notice it by. Confirmed live 2026-08-23: archiving a client fired a
      // CLIENT_UPDATE, the handler ran, the fetch succeeded, and the row still said
      // false. Fixing fetchFullClient's selection set alone would NOT have helped,
      // because this parameter consulted no source at all.
      //
      // Reads fullClient only, unlike the two lines above. fetchClientRelatedData
      // selects isCompany and isLead but NOT isArchived, so a `relatedData?.isArchived ??`
      // prefix here would be a permanently-undefined branch — dead code dressed as
      // symmetry. Write the guard the value needs; do not align this with its siblings.
      fullClient.isArchived === true,
      pipelineStage,
    ]
  );

  if (relatedData) {
    const jobs = (relatedData.jobs?.nodes || []).map(j => ({
      ...j,
      invoices: j.invoices?.nodes || [],
    }));
    const clientData = {
      isCompany:    relatedData.isCompany,
      isLead:       relatedData.isLead,
      tags:         relatedData.tags,
      customFields: relatedData.customFields,
      jobs,
      invoices:     [],
      quotes:       relatedData.quotes?.nodes || [],
      requests:     relatedData.requests?.nodes || [],
    };
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
    await deriveAndSaveTags(pool, contractorId, fullClient.id, clientData, contractorFieldMappings);

    await pool.query(
      `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
       VALUES ($1, $2, 'jobber_client', 'system', NOW())
       ON CONFLICT DO NOTHING`,
      [fullClient.id, contractorId]
    );

    // tier_1 = Jobber-only client (no linked app contact). Replaced by tier_2 when a link is established.
    await pool.query(
      `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
       VALUES ($1, $2, 'tier_1', 'system', NOW())
       ON CONFLICT DO NOTHING`,
      [fullClient.id, contractorId]
    );
  }
}

// POST /webhooks/jobber/disconnect
// Called by Jobber when a contractor removes Rooster Booster from their Jobber account.
// Jobber expects a 200 response or it will retry — we always return 200, even on DB failure.
router.post('/jobber/disconnect', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  const payload = JSON.parse(req.body.toString());

  // No Jobber DISCONNECT webhook is currently registered in the Jobber Developer
  // Center for this app — this route is unreachable from Jobber today. Resolution
  // is still fixed here for consistency with the other four handlers.
  let contractorId;
  try {
    contractorId = await resolveWebhookContractorId(payload);
  } catch (err) {
    await logWebhookResolutionFailure(req, 'disconnect', null, payload, err);
    res.status(200).json({ received: true });
    return;
  }

  console.log(`[jobber-webhook] Disconnect received for contractor: ${contractorId}`);

  // Always return 200 to Jobber — DB failures are logged but must not cause retries
  try {
    // ── DATABASE CLEANUP ─────────────────────────────────────────────────────
    // 1. Mark CRM settings as disconnected
    await pool.query(
      `UPDATE contractor_crm_settings SET is_connected = false WHERE contractor_id = $1`,
      [contractorId]
    );

    // 2. Delete the OAuth token row
    await pool.query(
      `DELETE FROM tokens WHERE contractor_id = $1`,
      [contractorId]
    );

    // ── ACTIVITY LOG ─────────────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO activity_log (event_type, detail, created_at)
       VALUES ('jobber_disconnect_webhook', $1, NOW())`,
      [`Jobber triggered disconnect for contractor: ${contractorId}`]
    );

    console.log(`[jobber-webhook] Cleanup complete for contractor: ${contractorId}`);
  } catch (err) {
    // Log but do not propagate — Jobber must receive 200 to prevent retries
    await logError({ req, error: err, contractorId });
    console.error('[jobber-webhook] DB cleanup failed:', err.message);
  }

  res.status(200).json({ received: true });
});

// POST /webhooks/jobber/client-create
// Jobber fires this when a new client profile is created.
// Responds 200 immediately — sync runs async to stay within Jobber's response window.
router.post('/jobber/client-create', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  const payload = JSON.parse(req.body.toString());
  // Respond 200 immediately — Jobber requires a fast response
  res.status(200).json({ received: true });

  // Async sync — never blocks the webhook response.
  // ⚠ The MVP note that stood here — "webhook payload may not include full nested
  // quotes/jobs/invoices data ... classifyPipelineStatus returns 'lead' as default"
  // — was INVERTED, not merely stale, and it is why the sparse-payload fallback
  // looked reasonable for four months. A Jobber CLIENT_CREATE envelope does not
  // carry a partial client; it carries NO client (data.webHookEvent.{topic, appId,
  // accountId, itemId, occurredAt} only). The client is always fetched by id below,
  // and if that fetch fails there is nothing to degrade to — the event is skipped
  // and recorded instead.
  //
  // ⚠ The line 'const client = payload?.data?.client || payload' stood here too, and
  // survived item 2 as DEAD CODE: item 2 removed every READ of it in this handler
  // but not the declaration, so the exact expression behind ~550 dropped clients sat
  // here unreferenced, under the inverted comment above. Nothing consumed it, so
  // behaviour was correct — but it is the line a future reader would restore for
  // symmetry with a handler that no longer has it either. Removed 2026-08-24.

  (async () => {
    let contractorId;
    try {
      contractorId = await resolveWebhookContractorId(payload);
    } catch (err) {
      await logWebhookResolutionFailure(req, 'client-create', payload?.data?.webHookEvent?.itemId, payload, err);
      return;
    }

    try {
      const settingsResult = await pool.query(
        'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const referralStartDate = settingsResult.rows[0]?.referral_start_date
        ? new Date(settingsResult.rows[0].referral_start_date)
        : null;

      // Fetch full client data including quotes/jobs/invoices for accurate status classification
      const clientId = payload?.data?.webHookEvent?.itemId;
      if (!clientId) throw new Error('client-create webhook: missing client id in payload');

      // ── SANCTIONED TOKEN PATH (Wave 0.2 item 3) ─────────────────────────────
      // Same change as the client-update handler below — see the note there. The raw
      // SELECT is gone and acquisition moved into the skip-and-log try, so a token
      // failure and a fetch failure produce one recorded skip rather than two
      // different silences.
      let token;

      // ── SKIP-AND-LOG (Wave 0.2 item 2) ──────────────────────────────────────
      // Identical reasoning to the client-update handler above — see the full note
      // there. In short: there is no fallback object, because a Jobber CLIENT_CREATE
      // envelope carries no client to fall back to. The id goes in error_message so
      // the dedup key can see it (one row per skipped client), the underlying cause
      // travels with it, and alert:false keeps the cardinality out of the inbox.
      let fullClient;
      try {
        token = await _getFreshContractorAccessToken(contractorId);
        fullClient = await _fetchFullClient(clientId, token);
      } catch (fetchErr) {
        await logError({
          req,
          contractorId,
          error: new Error(`[client-create] skipped client ${clientId} — could not fetch from Jobber: ${fetchErr.message}`),
          source: 'POST /webhooks/jobber/client-create — fetchFullClient',
          alert: false,
        });
        return;
      }

      await syncSingleClient(contractorId, fullClient, referralStartDate, [], token);
      console.log(`[jobber-webhook] client-create sync complete for client: ${clientId}`);

      // Upsert into jobber_clients and derive tags. The former 'if (token)' guard
      // here is gone: a falsy token now returns above, so it was unreachable.
      // ⚠ A FAILED FETCH IS LOGGED AS A FAILURE, NOT PASSED ON AS AN ABSENCE. It used to
      // console.warn and return null, which upsertAndTagClient reads as "nothing observed" —
      // so a Jobber outage looked exactly like a client with no jobs and never reached
      // error_log. N5: this is why error_log rises after this ships.
      const relatedData = await _fetchClientRelatedData(clientId, token).catch(async err => {
        await logError({
          req,
          contractorId,
          error: new Error(`[client-create] fetchClientRelatedData failed for ${clientId}: ${err.message}`),
          source: 'POST /webhooks/jobber/client-create — fetchClientRelatedData',
          alert: false,
        });
        return null;
      });
      await upsertAndTagClient(contractorId, fullClient, relatedData);

      // Contact matching pass — isolated, never aborts webhook
      try {
        await runContactMatchingPass(contractorId, { jobberClientId: clientId });
      } catch (matchErr) {
        await logError({ req: null, error: matchErr, contractorId, source: 'jobber-webhook client-create matching' });
      }
    } catch (err) {
      await logError({ req, error: err, contractorId });
      console.error('[jobber-webhook] client-create sync failed:', err.message);
    }
  })();
});

// POST /webhooks/jobber/client-update
// Jobber fires this when a client profile is updated (custom fields, job status, etc).
// Responds 200 immediately — sync runs async.
router.post('/jobber/client-update', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  const payload = JSON.parse(req.body.toString());
  // Respond 200 immediately
  res.status(200).json({ received: true });

  // Async sync — never blocks the webhook response.
  // ⚠ The MVP note that stood here — "webhook payload may not include full nested
  // quotes/jobs/invoices data ... classifyPipelineStatus returns 'lead' as default"
  // — was INVERTED, not merely stale, and it is why the sparse-payload fallback
  // looked reasonable for four months. A Jobber CLIENT_UPDATE envelope does not
  // carry a partial client; it carries NO client (data.webHookEvent.{topic, appId,
  // accountId, itemId, occurredAt} only). The client is always fetched by id below,
  // and if that fetch fails there is nothing to degrade to — the event is skipped
  // and recorded instead.

  (async () => {
    // Hoisted above resolution (reordered minimally from its prior position inside the
    // second try block below) so C3's defensive fallbackLookup can close over it —
    // client-update is the one handler that keeps a local-data fallback for clients
    // synced before the jobber_account_id backfill existed.
    const clientId = payload?.data?.webHookEvent?.itemId;

    let contractorId;
    try {
      contractorId = await resolveWebhookContractorId(payload, async () => {
        if (!clientId) return null;
        const { rows } = await pool.query(
          'SELECT DISTINCT contractor_id FROM jobber_clients WHERE jobber_client_id = $1',
          [clientId]
        );
        // ── AMBIGUOUS IDs ARE REFUSED, NOT GUESSED (Wave 0.2 item 6) ────────────
        // THE DESIGN QUESTION, ANSWERED: with no accountId there IS no correct
        // contractor to derive. This fallback exists only for clients synced before
        // the jobber_account_id backfill, and a Jobber client id is not a tenancy
        // key — jobber_clients is uniquely keyed on the COMPOSITE
        // (jobber_client_id, contractor_id), so the same id may legitimately exist
        // under several contractors.
        //
        // Exactly ONE owner is unambiguous and safe to use. TWO OR MORE means the id
        // carries no tenancy signal at all, and there is nothing in the payload to
        // break the tie.
        //
        // This is CORRECTIVE, not preventive: confirmed in production 2026-08-23,
        // FIVE jobber_client_id values exist under both 'accent-roofing' and
        // 'accent-roofing-dev' right now. The previous query had no contractor
        // predicate, no ORDER BY and no LIMIT, and took rows[0] — so those five
        // resolved by heap order.
        //
        // ⚠ THE ASYMMETRY IS THE WHOLE ARGUMENT. Refusing quarantines a recoverable
        // event: the row is logged with its topic and item id, the 30-minute
        // pipelineSync reconciles pipeline_cache, and the nightly sync reconciles
        // jobber_clients — both contractor-scoped, so they self-correct. Guessing
        // writes one tenant's client into another tenant's data. That is a
        // white-label breach, no backstop repairs it, and nothing about the
        // resulting row announces that it is wrong.
        return rows.length === 1 ? rows[0].contractor_id : null;
      });
    } catch (err) {
      await logWebhookResolutionFailure(req, 'client-update', clientId, payload, err);
      return;
    }

    try {
      const settingsResult = await pool.query(
        'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const referralStartDate = settingsResult.rows[0]?.referral_start_date
        ? new Date(settingsResult.rows[0].referral_start_date)
        : null;

      // Fetch full client data including quotes/jobs/invoices for accurate status classification
      if (!clientId) throw new Error('client-update webhook: missing client id in payload');

      // ── SANCTIONED TOKEN PATH (Wave 0.2 item 3) ─────────────────────────────
      // BEHAVIOUR CHANGE: the raw SELECT that stood here is gone, and acquisition has
      // moved DOWN into the skip-and-log try below so a token failure and a fetch
      // failure produce the same recorded skip rather than two different silences.
      // Acquiring immediately before use is the point: refreshTokenIfNeeded's
      // single-flight guard protects rotation, not reads.
      let token;

      // ── SKIP-AND-LOG (Wave 0.2 item 2) ──────────────────────────────────────
      // There is no fallback object, deliberately. This used to read
      //     const client = payload?.data?.client || payload
      // and hand the raw webhook ENVELOPE to the writer whenever the fetch failed.
      // Jobber CLIENT_UPDATE payloads carry no data.client key at all, so that
      // object never had an .id, and upsertAndTagClient's INSERT raised a NOT NULL
      // violation every single time — roughly 550 dropped clients between
      // 2026-04-17 and 2026-08-21, none recoverable from local data because nothing
      // persisted the payload.
      //
      // The client id goes in error_message, NOT in the stack. logError dedupes on
      // (contractor_id, route, method, error_message) and overwrites stack_trace on
      // every recurrence, so an id living only in the stack collapses N skipped
      // clients into one unreadable row — which is precisely why the failing
      // population was unmeasurable in production. One row PER skipped client is
      // the requirement, and alert:false is what keeps that cardinality out of the
      // inbox: the database holds the list, the alert stays throttled.
      //
      // The underlying error travels with the record. A skip logged without its
      // cause reproduces the same defect with a friendlier message.
      let fullClient;
      try {
        token = await _getFreshContractorAccessToken(contractorId);
        fullClient = await _fetchFullClient(clientId, token);
      } catch (fetchErr) {
        await logError({
          req,
          contractorId,
          error: new Error(`[client-update] skipped client ${clientId} — could not fetch from Jobber: ${fetchErr.message}`),
          source: 'POST /webhooks/jobber/client-update — fetchFullClient',
          alert: false,
        });
        return;
      }

      await syncSingleClient(contractorId, fullClient, referralStartDate, [], token);
      console.log(`[jobber-webhook] client-update sync complete for client: ${clientId}`);

      // Upsert into jobber_clients and derive tags. The former 'if (token)' guard
      // here is gone: a falsy token now returns above, so it was unreachable.
      // ⚠ Logged as a failure, never passed on as an absence — see client-create above.
      const relatedData = await _fetchClientRelatedData(clientId, token).catch(async err => {
        await logError({
          req,
          contractorId,
          error: new Error(`[client-update] fetchClientRelatedData failed for ${clientId}: ${err.message}`),
          source: 'POST /webhooks/jobber/client-update — fetchClientRelatedData',
          alert: false,
        });
        return null;
      });
      await upsertAndTagClient(contractorId, fullClient, relatedData);

      // Contact matching pass — isolated, never aborts webhook
      try {
        await runContactMatchingPass(contractorId, { jobberClientId: clientId });
      } catch (matchErr) {
        await logError({ req: null, error: matchErr, contractorId, source: 'jobber-webhook client-update matching' });
      }
    } catch (err) {
      await logError({ req, error: err, contractorId });
      console.error('[jobber-webhook] client-update sync failed:', err.message);
    }
  })();
});

// POST /webhooks/jobber/invoice-paid
// Fires when a Jobber invoice is marked paid.
// Experience flow (in-app prompts / invite emails) runs only if experience_flow_enabled.
// Referral rules engine runs unconditionally — independent of experience flow.
router.post('/jobber/invoice-paid', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  res.status(200).json({ received: true });

  (async () => {
    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch (parseErr) {
      await logError({ req, error: parseErr, source: 'POST /webhooks/jobber/invoice-paid — payload parse' });
      return;
    }

    let contractorId;
    try {
      contractorId = await resolveWebhookContractorId(payload);
    } catch (err) {
      await logWebhookResolutionFailure(req, 'invoice-paid', payload?.data?.webHookEvent?.itemId, payload, err);
      return;
    }

    try {
      // (a) Cheap early exit — skip non-paid invoice updates before any DB or API calls.
      // Jobber sends INVOICE_UPDATE for all status changes; only 'paid' is actionable here.
      const rawInvoiceStatus = payload?.data?.invoice?.invoiceStatus;
      if (rawInvoiceStatus !== undefined && rawInvoiceStatus !== 'paid') {
        console.log(`[invoice-paid] raw invoiceStatus is '${rawInvoiceStatus}' — skipping`);
        return;
      }

      // STEP 2 — Feature flag check (experience flow only)
      // Does NOT exit — referral engine runs unconditionally regardless of this flag.
      const flagResult = await pool.query(
        'SELECT experience_flow_enabled FROM engagement_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const experienceFlowEnabled = !!(flagResult.rows[0]?.experience_flow_enabled);
      if (!experienceFlowEnabled) {
        console.log('[invoice-paid] experience flow disabled for contractor:', contractorId);
      }

      // STEP 3 — Extract invoice ID from webhook event payload
      // Jobber INVOICE_UPDATE payloads contain only the invoice ID at webHookEvent.itemId —
      // they do NOT include client data. Client ID is resolved via GraphQL after fetching the invoice.
      const invoiceId = payload?.data?.webHookEvent?.itemId;
      if (!invoiceId) {
        await logError({ req, error: new Error('[invoice-paid] missing invoiceId in webhook payload'), contractorId, source: 'POST /webhooks/jobber/invoice-paid' });
        try {
          await retryWithBackoff(
            () => _sendEmail({
              from: 'noreply@roofmiles.com',
              to: 'admin1@roofmiles.com',
              subject: '[RoofMiles Alert] Invoice webhook error — itemId missing from payload',
              html: `
                <p>A RoofMiles webhook error occurred and requires your attention.</p>
                <p><strong>Webhook:</strong> invoice-paid<br>
                <strong>Error:</strong> itemId was not present in the Jobber payload.<br>
                <strong>Time:</strong> ${new Date().toISOString()}<br>
                <strong>Invoice ID:</strong> not present in payload</p>
                <p>The referral conversion check for this invoice did not run.
                Please review recent invoices in Jobber to check whether a referral
                conversion should have been recorded.</p>
                <p>— RoofMiles System</p>
              `
            }),
            { shouldRetry: resendShouldRetry }
          );
        } catch (emailErr) {
          console.warn('[invoice-paid] failed to send admin alert email:', emailErr.message);
        }
        return;
      }

      // STEP 4 — Fetch token (refresh first, mirrors the pattern already used
      // in server/routes/admin/team.js's jobber-users route)
      await _refreshTokenIfNeeded(contractorId);
      let tokenResult = await pool.query(
        'SELECT access_token FROM tokens WHERE contractor_id = $1',
        [contractorId]
      );
      let token = tokenResult.rows[0]?.access_token;
      if (!token) {
        console.warn('[invoice-paid] no access token found');
        return;
      }

      // STEP 4b — Fetch invoice to resolve client ID and confirm paid status.
      // fetchInvoiceWithJobs() returns client { id name } alongside invoice amounts and
      // job type custom fields — one fetch serves both client ID resolution and the referral engine.
      //
      // 2c mitigation: a 401 here is the signature of the concurrent-refresh rotation race
      // (CLAUDE_REGISTRY.md item 2c) — refresh token rotation is enabled and this shared
      // tokens row is refreshed independently from ~7 call sites with no locking, so a
      // sibling refresh can invalidate the token this handler just read even though
      // expires_at looked fresh. Force a refresh and retry exactly once with the
      // freshly-re-read token; the 30-min pipeline sync cron is the backstop if this
      // single retry still fails.
      let invoiceWithJobs = null;
      try {
        invoiceWithJobs = await _fetchInvoiceWithJobs(invoiceId, token);
      } catch (err) {
        if (err?.response?.status === 401) {
          try {
            await _refreshTokenIfNeeded(contractorId, { force: true });
            tokenResult = await pool.query(
              'SELECT access_token FROM tokens WHERE contractor_id = $1',
              [contractorId]
            );
            token = tokenResult.rows[0]?.access_token;
            if (!token) throw err;
            invoiceWithJobs = await _fetchInvoiceWithJobs(invoiceId, token);
          } catch (retryErr) {
            await logError({ req, error: retryErr, contractorId, source: 'POST /webhooks/jobber/invoice-paid — fetchInvoiceWithJobs' });
            console.warn(`[invoice-paid] fetchInvoiceWithJobs failed after forced-refresh retry for invoice ${invoiceId}:`, retryErr.message);
            return;
          }
        } else {
          await logError({ req, error: err, contractorId, source: 'POST /webhooks/jobber/invoice-paid — fetchInvoiceWithJobs' });
          console.warn(`[invoice-paid] fetchInvoiceWithJobs failed for invoice ${invoiceId}:`, err.message);
          return;
        }
      }

      // (b) Guard — bail if invoice is not paid per the Jobber API response
      if (invoiceWithJobs.invoiceStatus !== 'paid') {
        console.log(`[invoice-paid] fetched invoice ${invoiceId} has status '${invoiceWithJobs.invoiceStatus}' — skipping`);
        return;
      }

      // STEP 4c — Resolve client ID from invoice response
      const clientId = invoiceWithJobs.client?.id;
      if (!clientId) {
        await logError({ req, error: new Error(`[invoice-paid] invoice ${invoiceId} has no client id`), contractorId, source: 'POST /webhooks/jobber/invoice-paid' });
        try {
          await retryWithBackoff(
            () => _sendEmail({
              from: 'noreply@roofmiles.com',
              to: 'admin1@roofmiles.com',
              subject: '[RoofMiles Alert] Invoice webhook error — client ID could not be resolved',
              html: `
                <p>A RoofMiles webhook error occurred and requires your attention.</p>
                <p><strong>Webhook:</strong> invoice-paid<br>
                <strong>Error:</strong> The Jobber API returned no client ID for the fetched invoice.<br>
                <strong>Time:</strong> ${new Date().toISOString()}<br>
                <strong>Invoice ID:</strong> ${invoiceId}</p>
                <p>The referral conversion check for this invoice did not run.
                Please review this invoice in Jobber to check whether a referral
                conversion should have been recorded.</p>
                <p>— RoofMiles System</p>
              `
            }),
            { shouldRetry: resendShouldRetry }
          );
        } catch (emailErr) {
          console.warn('[invoice-paid] failed to send admin alert email:', emailErr.message);
        }
        return;
      }
      console.log(`[invoice-paid] resolved client id: ${clientId}`);

      const fullClient = await _fetchFullClient(clientId, token);
      const clientName = (`${fullClient.firstName || ''} ${fullClient.lastName || ''}`).trim();
      const clientEmail = fullClient.emails?.[0]?.address || null;
      const clientPhone = fullClient.phones?.[0]?.number || null;

      // Extract "Referred by" custom field from the full client record
      const referredByField = (fullClient.customFields || []).find(
        f => f.label && f.label.toLowerCase() === 'referred by'
      );
      const referredBy = referredByField?.valueText?.trim() || null;

      // ── EXPERIENCE FLOW (gated by feature flag) ────────────────────────────────
      if (experienceFlowEnabled) {
        // STEP 5 — Match against app users (name → email → phone)
        let matchedUser = null;
        // ⚠ ALL THREE STEPS ARE SCOPED (Wave 0.3 F8). A fallback chain has to be
        // filtered at EVERY step: scoping only the first leaves the leak intact for
        // any client the first step misses, which is precisely when the fallbacks
        // run. Unscoped, a paid invoice for one contractor could create an
        // experience prompt — or send a branded invite email — for a user belonging
        // to a different contractor entirely.
        const nameResult = await pool.query(
          'SELECT id FROM users WHERE contractor_id = $2 AND LOWER(full_name) = LOWER($1) LIMIT 1',
          [clientName, contractorId]
        );
        matchedUser = nameResult.rows[0] || null;
        if (!matchedUser && clientEmail) {
          const emailResult = await pool.query(
            'SELECT id FROM users WHERE contractor_id = $2 AND LOWER(email) = LOWER($1) LIMIT 1',
            [clientEmail, contractorId]
          );
          matchedUser = emailResult.rows[0] || null;
        }
        if (!matchedUser && clientPhone) {
          const phoneResult = await pool.query(
            "SELECT id FROM users WHERE contractor_id = $2 AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = REGEXP_REPLACE($1, '[^0-9]', '', 'g') LIMIT 1",
            [clientPhone, contractorId]
          );
          matchedUser = phoneResult.rows[0] || null;
        }

        // STEP 6 — 30-day cooldown check (only if matched)
        // Uses flag instead of early return so STEP 9 (referral engine) always executes
        let experienceFlowBlocked = false;
        if (matchedUser) {
          const cooldownResult = await pool.query(
            `SELECT id FROM experience_prompts
             WHERE user_id = $1 AND contractor_id = $2
               AND triggered_at > NOW() - INTERVAL '30 days'
             LIMIT 1`,
            [matchedUser.id, contractorId]
          );
          if (cooldownResult.rows.length > 0) {
            console.log('[invoice-paid] skipping — within 30-day cooldown for user:', matchedUser.id);
            experienceFlowBlocked = true;
          }
        }

        if (!experienceFlowBlocked) {
          let experienceActionTaken = false;

          if (matchedUser) {
            // STEP 7A — App user path
            // Suppress immediate prompt if the user's jobber_client_id matches this client.
            // The T+24h post-job cron will create the experience_prompt after job completion.
            const userLinkResult = await pool.query(
              'SELECT jobber_client_id FROM users WHERE id = $1',
              [matchedUser.id]
            );
            const userJobberClientId = userLinkResult.rows[0]?.jobber_client_id;
            const isLinkedClient = userJobberClientId && userJobberClientId === fullClient.id;

            if (!isLinkedClient) {
              await pool.query(
                `INSERT INTO experience_prompts (user_id, contractor_id, jobber_invoice_id, response_type)
                 VALUES ($1, $2, $3, 'pending')`,
                [matchedUser.id, contractorId, fullClient.id]
              );
              console.log('[invoice-paid] experience prompt created for user:', matchedUser.id);
              // PUSH NOTIFICATION STUB — not built yet (requires App Store/Play Store registration)
              // TODO: fire push notification to user matchedUser.id when push infrastructure is ready
              // Message: "Thanks for working with us! We'd love your feedback — open the app to share."
            } else {
              console.log('[invoice-paid] user', matchedUser.id, 'is a linked client — T+24h cron will handle experience prompt');
            }
            experienceActionTaken = true;
          } else if (clientEmail) {
            // STEP 7B — Non-app-user path (has email)
            const inviteToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await pool.query(
              `INSERT INTO experience_invite_tokens
                 (token, contractor_id, jobber_client_name, jobber_client_email, jobber_client_phone, jobber_invoice_id, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [inviteToken, contractorId, clientName, clientEmail, clientPhone, fullClient.id, expiresAt]
            );

            const brandResult = await pool.query(
              'SELECT app_display_name, email_sender_name, email_footer_text FROM contractor_settings WHERE contractor_id = $1',
              [contractorId]
            );
            const brandRow = brandResult.rows[0] || {};
            const appDisplayName = brandRow.app_display_name || 'Rooster Booster';
            // Contractor-derived, with the PLATFORM default as the only fallback
            // (C/DL-3b Phase 6C). These two literals previously addressed every
            // contractor's homeowner by one specific tenant's business name.
            // The retired literal is not quoted here — the sweep reads source text.
            const emailSenderName = brandRow.email_sender_name || BRANDING_THEME_DEFAULTS.companyName;
            const emailFooterText = brandRow.email_footer_text
              || `${emailSenderName} · Powered by ${appDisplayName}`;

            const firstName = clientName.split(' ')[0] || clientName;
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const ctaUrl = `${frontendUrl}?exp=${inviteToken}`;

            await retryWithBackoff(
              () => _sendEmail({
                from: `${emailSenderName} <noreply@roofmiles.com>`,
                to: clientEmail,
                subject: `Thank you for choosing us, ${firstName}!`,
                html: `
                  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
                    <p style="font-size:16px;color:#1a1a1a;margin:0 0 16px;">Hi ${firstName},</p>
                    <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 28px;">
                      Thank you for trusting us with your project. We'd love to hear how it went — and as a bonus,
                      you can join our rewards app to earn cash for referring friends and neighbors.
                    </p>
                    <a href="${ctaUrl}"
                       style="display:inline-block;background:#012854;color:#fff;text-decoration:none;
                              border-radius:10px;padding:14px 28px;font-size:15px;font-weight:600;">
                      Share Your Experience
                    </a>
                    <p style="font-size:12px;color:#999;margin:32px 0 0;">${emailFooterText}</p>
                  </div>
                `,
              }),
              { retries: 2, initialDelayMs: 500, shouldRetry: resendShouldRetry }
            );

            console.log('[invoice-paid] invite token created, email sent to:', clientEmail);
            experienceActionTaken = true;
          } else {
            console.log('[invoice-paid] no app user match and no email — skipping experience flow');
          }

          // STEP 8 — Activity log (own try/catch — must not block main flow)
          if (experienceActionTaken) {
            try {
              const detail = matchedUser
                ? `experience prompt created for user ${matchedUser.id} (${clientName})`
                : `experience invite email sent to ${clientEmail} (${clientName})`;
              await pool.query(
                `INSERT INTO activity_log (event_type, detail) VALUES ($1, $2)`,
                ['invoice_paid_experience_trigger', detail]
              );
            } catch (logErr) {
              await logError({ req, error: logErr, contractorId, source: 'POST /webhooks/jobber/invoice-paid — activity_log insert' });
              console.error('[invoice-paid] activity log failed:', logErr.message);
            }
          }
        }
      }

      // ── STEP 9A — JOBBER CLIENT UPSERT + TAG DERIVATION ─────────────────────
      // Runs unconditionally — keeps jobber_clients and contact_tags in sync on every paid invoice.
      ;(async () => {
        try {
          // ⚠ Logged as a failure, never passed on as an absence — see client-create above.
          const relatedData = await _fetchClientRelatedData(clientId, token).catch(async err => {
            await logError({
              req: null,
              contractorId,
              error: new Error(`[invoice-paid] fetchClientRelatedData failed for ${clientId}: ${err.message}`),
              source: 'POST /webhooks/jobber/invoice-paid — fetchClientRelatedData',
              alert: false,
            });
            return null;
          });
          if (relatedData) {
            const clientShell = {
              id: clientId,
              firstName: fullClient.firstName || null,
              lastName: fullClient.lastName || null,
              emails: fullClient.emails || [],
              phones: fullClient.phones || [],
            };
            await upsertAndTagClient(contractorId, clientShell, relatedData);
          }
        } catch (tagErr) {
          await logError({ req, error: tagErr, contractorId, source: 'POST /webhooks/jobber/invoice-paid — upsertAndTagClient' });
        }
      })();

      // ── STEP 9 — REFERRAL RULES ENGINE ───────────────────────────────────────
      // Runs unconditionally — independent of experience flow flag and result.
      // Only fires if: client has a referred_by value AND invoice data was fetched.
      if (referredBy && invoiceWithJobs) {
        try {
          const result = await evaluateReferral(contractorId, invoiceWithJobs, referredBy);

          if (result.qualified) {
            // Count prior conversions before insert — needed for #13 first-milestone detection
            const priorCountResult = await pool.query(
              `SELECT COUNT(*) AS cnt FROM referral_conversions WHERE user_id=$1`,
              [result.referrerId]
            );
            const isFirstConversion = parseInt(priorCountResult.rows[0]?.cnt || '0') === 0;

            // Write conversion record — UNIQUE constraint is the DB-level safety net
            // RETURNING id lets us detect whether a new row was inserted vs duplicate skipped
            const conversionInsert = await pool.query(
              `INSERT INTO referral_conversions
                 (user_id, contractor_id, jobber_client_id, converted_at, bonus_amount)
               VALUES ($1, $2, $3, NOW(), $4)
               ON CONFLICT (user_id, jobber_client_id) DO NOTHING
               RETURNING id`,
              [result.referrerId, contractorId, result.jobberClientId, result.bonusAmount]
            );

            // Non-blocking Active Referrer tag write — paid_count increment lives here too
            // so concurrent duplicate deliveries where one INSERT returns rowCount=0 don't
            // double-increment the referrer's boost tier.
            if (conversionInsert.rowCount > 0) {
              await pool.query(
                `UPDATE users SET paid_count = paid_count + 1, paid_count_updated_at = NOW()
                 WHERE id = $1`,
                [result.referrerId]
              );
              ;(async () => {
                try {
                  const referrerEmailRes = await pool.query(
                    `SELECT email FROM users WHERE id = $1 LIMIT 1`,
                    [result.referrerId]
                  );
                  if (referrerEmailRes.rows.length > 0) {
                    const refEmail = referrerEmailRes.rows[0].email;
                    const contactRes = await pool.query(
                      `SELECT id FROM contacts WHERE contractor_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
                      [contractorId, refEmail]
                    );
                    if (contactRes.rows.length > 0) {
                      await applyTag(pool, contactRes.rows[0].id, contractorId, 'Active Referrer', 'system');
                    }
                  }
                } catch (tagErr) {
                  await logError({ req, error: tagErr, contractorId, source: 'POST /webhooks/jobber/invoice-paid — Active Referrer tag' });
                }
              })();
            }

            // Activity log for qualified conversion
            await pool.query(
              `INSERT INTO activity_log (event_type, detail)
               VALUES ($1, $2)`,
              [
                'referral_conversion',
                `Referral bonus $${result.bonusAmount} — schedule: ${result.scheduleName} — referrer user_id: ${result.referrerId} — client: ${clientName}`,
              ]
            );

            console.log(
              `[invoice-paid] Referral conversion recorded — user ${result.referrerId}, ` +
              `$${result.bonusAmount}, schedule: ${result.scheduleName}, client: ${clientName}`
            );

            // ── #4 BONUS EARNED EMAIL ─────────────────────────────────────────────
            // Only fires when a NEW conversion row was inserted (not on duplicates).
            if (conversionInsert.rowCount > 0) {
              try {
                const referrerLookup = await pool.query(
                  'SELECT full_name, email FROM users WHERE id=$1',
                  [result.referrerId]
                );
                const referrerRow = referrerLookup.rows[0];
                if (referrerRow?.email) {
                  const csLookup = await pool.query(
                    `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id=$1 LIMIT 1`,
                    [contractorId]
                  );
                  const cs = csLookup.rows[0] || {};
                  const fromName = escapeHtml(cs.email_sender_name || cs.company_name || 'RoofMiles');
                  const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
                  const firstName = escapeHtml((referrerRow.full_name || '').split(' ')[0] || referrerRow.full_name);
                  const safeClientName = escapeHtml(clientName);
                  const formattedAmount = formatDollars(result.bonusAmount);

                  const suppressed4 = await isEmailSuppressed(contractorId, referrerRow.email, 'bonus_earned');
                  if (!suppressed4) await retryWithBackoff(
                    () => _sendEmail({
                      from: `${fromName} <noreply@roofmiles.com>`,
                      to: referrerRow.email,
                      subject: `You just earned $${formattedAmount}`,
                      html: `
                        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                          <h2 style="color:#012854;margin:0 0 12px;">Your reward is ready</h2>
                          <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, ${safeClientName}'s job is complete and your $${formattedAmount} reward has been added to your balance. Cash out anytime directly from the app.</p>
                          <div style="text-align:center;margin-bottom:24px;">
                            <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Cash Out Now</a>
                          </div>
                        </div>
                      `,
                    }),
                    { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
                  );
                }
              } catch (bonusEmailErr) {
                await logError({ req, error: bonusEmailErr, contractorId, source: 'POST /webhooks/jobber/invoice-paid — #4 bonus email' });
              }
            }

            // ── #13 FIRST REWARD MILESTONE ──────────────────────────────────────────
            // Fires alongside #4 only on the referrer's very first conversion ever.
            if (conversionInsert.rowCount > 0 && isFirstConversion) {
              try {
                const referrerLookup13 = await pool.query(
                  'SELECT full_name, email FROM users WHERE id=$1',
                  [result.referrerId]
                );
                const referrerRow13 = referrerLookup13.rows[0];
                if (referrerRow13?.email) {
                  const csLookup13 = await pool.query(
                    `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id=$1 LIMIT 1`,
                    [contractorId]
                  );
                  const cs13 = csLookup13.rows[0] || {};
                  const fromName13 = escapeHtml(cs13.email_sender_name || cs13.company_name || 'RoofMiles');
                  const frontendUrl13 = process.env.FRONTEND_URL || 'https://roofmiles.com';
                  const firstName13 = escapeHtml((referrerRow13.full_name || '').split(' ')[0] || referrerRow13.full_name);
                  const suppressed13 = await isEmailSuppressed(contractorId, referrerRow13.email, 'first_reward_milestone');
                  if (!suppressed13) await retryWithBackoff(
                    () => _sendEmail({
                      from: `${fromName13} <noreply@roofmiles.com>`,
                      to: referrerRow13.email,
                      subject: `You just earned your first reward`,
                      html: `
                        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                          <h2 style="color:#012854;margin:0 0 12px;">First one in the books</h2>
                          <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName13}, your first referral reward just posted to your balance. This is just the beginning — every referral you send is another opportunity to earn. Cash out anytime.</p>
                          <div style="text-align:center;margin-bottom:24px;">
                            <a href="${frontendUrl13}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Cash Out Now</a>
                          </div>
                        </div>
                      `,
                    }),
                    { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
                  );
                }
              } catch (milestone13Err) {
                await logError({ req, error: milestone13Err, contractorId, source: 'POST /webhooks/jobber/invoice-paid — #13 first milestone' });
              }
            }
          } else {
            // Not qualified — log reason and exit cleanly. No action needed.
            console.log(
              `[invoice-paid] Referral not qualified — reason: ${result.reason}, ` +
              `client: ${clientName}, referred_by: "${referredBy}"`
            );
          }
        } catch (err) {
          // Referral engine failure must never affect experience flow or crash the handler
          console.error('[invoice-paid] Referral rules engine error:', err.message);
          await logError({ req, error: err, contractorId });
        }
      }

    } catch (err) {
      await logError({ req, error: err, contractorId });
      console.error('[invoice-paid]', err.message);
    }
  })();
});

// POST /webhooks/jobber/job-update
// Fires when a Jobber job is updated. Used to detect job completion and mark
// pipeline_cache.job_completed_at so the T+24h post-job sequence cron can trigger.
// Requires JOB_UPDATE webhook subscription in Jobber developer settings.
router.post('/jobber/job-update', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  res.status(200).json({ received: true });

  (async () => {
    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch (parseErr) {
      await logError({ req, error: parseErr, source: 'POST /webhooks/jobber/job-update — payload parse' });
      return;
    }

    let contractorId;
    try {
      contractorId = await resolveWebhookContractorId(payload);
    } catch (err) {
      await logWebhookResolutionFailure(req, 'job-update', payload?.data?.job?.id, payload, err);
      return;
    }

    try {
      // Feature flag check — this handler exists solely to feed the T+24h experience flow.
      // Unlike invoice-paid, there is no unconditional second engine here, so disabled = early exit.
      const flagResult = await pool.query(
        'SELECT experience_flow_enabled FROM engagement_settings WHERE contractor_id = $1',
        [contractorId]
      );
      if (!flagResult.rows[0]?.experience_flow_enabled) {
        console.log('[job-update] experience flow disabled for contractor:', contractorId);
        return;
      }

      const jobId   = payload?.data?.job?.id;
      const clientId = payload?.data?.job?.client?.id;
      if (!jobId || !clientId) {
        console.log('[job-update] missing job id or client id in payload — skipping');
        return;
      }

      // ── SANCTIONED TOKEN PATH (Wave 0.2 item 3) ─────────────────────────────
      // BEHAVIOUR CHANGE: this used to raw-SELECT the token and, on absence, warn to
      // the console and return — a silent skip with no durable record. It now
      // refreshes first (read-after-rotate is a real window; see crm/jobber.js) and
      // records the skip. The skip ITSELF is unchanged: job-update still returns
      // without acting, so nothing downstream sees new behaviour.
      let token;
      try {
        token = await _getFreshContractorAccessToken(contractorId);
      } catch (tokenErr) {
        await logError({
          req,
          contractorId,
          error: new Error(`[job-update] skipped job ${jobId} — no usable Jobber token: ${tokenErr.message}`),
          source: 'POST /webhooks/jobber/job-update — token',
          alert: false,
        });
        console.warn('[job-update] no usable Jobber access token — skipping');
        return;
      }

      // Fetch all jobs for this client from Jobber GraphQL to get accurate status + total
      const allJobs = await _fetchClientJobsForJobUpdate(clientId, token);

      // Find the current job among the fetched set
      const currentJob = allJobs.find(j => j.id === jobId);
      if (!currentJob) {
        console.log(`[job-update] job ${jobId} not found in client jobs response — skipping`);
        return;
      }

      // Only process completed jobs with a positive dollar value
      const jobStatus = (currentJob.jobStatus || '').toUpperCase();
      const jobTotal  = parseFloat(currentJob.total) || 0;
      if (jobStatus !== 'COMPLETED' || jobTotal <= 0) {
        console.log(`[job-update] job ${jobId} status=${jobStatus} total=${jobTotal} — skipping`);
        return;
      }

      // Only trigger if this is the highest-value job (or tied for highest) among dollar-value jobs.
      // If a larger completed job exists, that one was (or will be) the trigger.
      const dollarJobs = allJobs.filter(j => (parseFloat(j.total) || 0) > 0);
      const maxTotal   = Math.max(...dollarJobs.map(j => parseFloat(j.total) || 0));
      if (jobTotal < maxTotal) {
        console.log(`[job-update] job ${jobId} total ${jobTotal} is not the max (${maxTotal}) — skipping`);
        return;
      }

      // 60-day cooldown: skip if job_completed_at was already set within the last 60 days
      const cooldownResult = await pool.query(
        `SELECT id FROM pipeline_cache
         WHERE contractor_id = $1 AND jobber_client_id = $2
           AND job_completed_at > NOW() - INTERVAL '60 days'
         LIMIT 1`,
        [contractorId, clientId]
      );
      if (cooldownResult.rows.length > 0) {
        console.log(`[job-update] client ${clientId} already has job_completed_at within 60 days — skipping`);
        return;
      }

      // UPSERT pipeline_cache — only write job_completed_at if it is currently NULL
      await pool.query(
        `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, job_completed_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (contractor_id, jobber_client_id)
         DO UPDATE SET job_completed_at = CASE
           WHEN pipeline_cache.job_completed_at IS NULL THEN NOW()
           ELSE pipeline_cache.job_completed_at
         END`,
        [contractorId, clientId]
      );

      console.log(`[job-update] job_completed_at set for client ${clientId} (contractor: ${contractorId})`);

      // Upsert into jobber_clients and derive tags for the affected client
      // ⚠ Logged as a failure, never passed on as an absence — see client-create above.
      const relatedData = await _fetchClientRelatedData(clientId, token).catch(async err => {
        await logError({
          req,
          contractorId,
          error: new Error(`[job-update] fetchClientRelatedData failed for ${clientId}: ${err.message}`),
          source: 'POST /webhooks/jobber/job-update — fetchClientRelatedData',
          alert: false,
        });
        return null;
      });
      if (relatedData) {
        const clientShell = { id: clientId, firstName: null, lastName: null, emails: [], phones: [] };
        await upsertAndTagClient(contractorId, clientShell, relatedData);
      }
    } catch (err) {
      await logError({ req, error: err, contractorId, source: 'POST /webhooks/jobber/job-update' });
      console.error('[job-update]', err.message);
    }
  })();
});

// ── REQUEST-DRIVEN REP ATTRIBUTION (Canvass-3.7, rulings R1/R2/R3) ───────────
//
// Two topics, two routes, alongside the existing four. Both drive the SAME path —
// attributeFromRequest() — because REQUEST_CREATE and REQUEST_UPDATE differ only in
// which real-world moment fired them, never in what should happen next.
//
// ⚠ REQUEST_UPDATE IS NOT AN AFTERTHOUGHT, IT IS HALF THE DESIGN. Measured live on
// Accent's account 2026-09-18: scheduling an assessment and assigning a rep moved the
// request's updatedAt 15:41:20Z -> 20:05:17Z while `salesperson` stayed NULL throughout.
// So the "a rep was assigned later" case — which under R3 is the ONLY way a client that
// recorded nothing on create ever gets attributed — arrives exclusively on this topic.
//
// ⚠ AND NEVER TREAT A NULL salesperson AS "NO REP" (finding 4). Accent's salesperson
// field auto-fills with whoever CREATED the request — an office person, not the rep —
// and the rep is attached through the ASSESSMENT instead. That is Mode A, it is how
// Accent operates, and the engine's resolveModeAMatch is what reads it.

// Reads the webhook's event timestamp, tolerating BOTH spellings.
// ⚠ JOBBER SHIPS TWO. Apps created before 2023-12-08 receive `occuredAt` — one r — and
// newer apps receive `occurredAt`. WHICH ONE THIS APP RECEIVES COULD NOT BE ESTABLISHED
// FROM SOURCE: no production code anywhere in this repo has ever read either spelling,
// so the only occurrences are comments and our own test fixtures, and a fixture we wrote
// is evidence about us rather than about Jobber. Reading both costs one `??` and removes
// the question; picking one would make the dedupe key silently absent on half the guesses.
function webhookOccurredAt(payload) {
  const ev = payload?.data?.webHookEvent;
  return ev?.occurredAt ?? ev?.occuredAt ?? null;
}

// Claims one webhook delivery. Returns true if this process should do the work, false if
// an earlier delivery already claimed it.
// ⚠ FAILS OPEN, DELIBERATELY, AND SAYS SO RATHER THAN DOING IT QUIETLY. With no usable
// occurred_at there is no key that distinguishes a duplicate delivery from a legitimate
// second update, and the two must not be collapsed — swallowing the second REQUEST_UPDATE
// would break the "a rep was assigned later" case above, which is the worse failure by a
// long way. Processing twice is idempotent by write shape (see the table comment in
// db.js); skipping the real second event is not recoverable at all.
async function claimWebhookDelivery(contractorId, topic, itemId, occurredAt) {
  if (!occurredAt) return { claimed: true, keyed: false };
  const { rowCount } = await pool.query(
    `INSERT INTO jobber_webhook_events (contractor_id, topic, item_id, occurred_at)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [contractorId, topic, itemId, occurredAt]
  );
  return { claimed: rowCount > 0, keyed: true };
}

// The shared body of both request routes.
// ⚠ RESPONDS BEFORE ANY OF THIS RUNS — see the routes below. Jobber requires a response
// within 1 SECOND or it may disable the app's webhooks, and this function makes up to two
// Jobber round trips plus several queries. It is called from inside a detached async IIFE
// exactly as the four existing handlers are, and never awaited by the route.
async function handleRequestWebhook(req, topic) {
  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (parseErr) {
    await logError({ req, error: parseErr, source: `POST /webhooks/jobber/${topic} — payload parse` });
    return;
  }

  const itemId = payload?.data?.webHookEvent?.itemId;

  // ── TENANCY ─────────────────────────────────────────────────────────────────
  // ⚠ NO fallbackLookup IS PASSED, AND THAT IS NOT AN OVERSIGHT. client-update's
  // defensive local lookup keys on a jobber_clients row for the client in the payload;
  // here the payload's itemId is a REQUEST id, which appears in no local table, so there
  // is nothing to look up. An unknown accountId is refused, typed and quarantined — every
  // write below is contractor-scoped and there is no safe guess.
  let contractorId;
  try {
    contractorId = await resolveWebhookContractorId(payload);
  } catch (err) {
    await logWebhookResolutionFailure(req, topic, itemId, payload, err);
    return;
  }

  try {
    if (!itemId) throw new Error(`${topic} webhook: missing request id (itemId) in payload`);

    const claim = await claimWebhookDelivery(contractorId, topic, itemId, webhookOccurredAt(payload));
    if (!claim.claimed) {
      console.log(`[${topic}] duplicate delivery for request ${itemId} — already claimed, skipping`);
      return;
    }
    if (!claim.keyed) {
      // Recorded once per delivery rather than never: an absent occurred_at means the
      // dedupe above is inert, and that is exactly the kind of silently-disabled mechanism
      // this codebase files under "reports health it cannot observe".
      await logError({
        req: null,
        contractorId,
        error: new Error(`[${topic}] webhook carried no occurredAt/occuredAt — delivery dedupe inert for request ${itemId}`),
        source: `POST /webhooks/jobber/${topic} — dedupe key`,
        alert: false,
      });
    }

    let token;
    let request;
    try {
      token   = await _getFreshContractorAccessToken(contractorId);
      request = await _fetchRequestById(itemId, token);
    } catch (fetchErr) {
      // Skip-and-log, the established semantics of the four handlers above. The request id
      // goes in the message so logError's dedup key sees one row per request rather than
      // one row per topic. alert:false keeps a schema-version failure out of the inbox at
      // per-request cardinality — it will be one row per request, loudly, in error_log.
      await logError({
        req,
        contractorId,
        error: new Error(`[${topic}] skipped request ${itemId} — could not fetch from Jobber: ${fetchErr.message}`),
        source: `POST /webhooks/jobber/${topic} — fetchRequestById`,
        alert: false,
      });
      return;
    }

    const outcome = await attributeFromRequest(pool, {
      contractorId,
      request,
      fetchFullClient: _fetchFullClient,
      fetchAttributionData: _fetchAttributionData,
      token,
    });
    console.log(`[${topic}] request ${itemId} -> ${outcome} (contractor: ${contractorId})`);
  } catch (err) {
    await logError({ req, error: err, contractorId, source: `POST /webhooks/jobber/${topic}` });
    console.error(`[${topic}]`, err.message);
  }
}

// POST /webhooks/jobber/request-create — Jobber topic REQUEST_CREATE
router.post('/jobber/request-create', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;
  res.status(200).json({ received: true });
  handleRequestWebhook(req, 'request-create');
});

// POST /webhooks/jobber/request-update — Jobber topic REQUEST_UPDATE
router.post('/jobber/request-update', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;
  res.status(200).json({ received: true });
  handleRequestWebhook(req, 'request-update');
});

// ═══════════════════════════════════════════════════════════════════════════
// STAGE WEBHOOKS — QUOTE_CREATE, QUOTE_UPDATE, JOB_CREATE (Canvass-stage)
//                  + QUOTE_APPROVED (3d Phase 1a Commit 0, 2026-09-24)
// ═══════════════════════════════════════════════════════════════════════════
//
// WHY THEY EXIST, AND WHY THEY ARE NOT URGENT. Measured live by Danny on Accent's
// account 2026-09-21: creating a quote, and converting it to a job, BOTH bump the
// client's `updatedAt` to the second. So `jobberIncrementalSync`'s 25-hour filter
// already catches every stage transition within about a day. These handlers take that
// lag to near-instant; they do not rescue a hole.
// ⚠ AND THE BEHAVIOUR IS OBJECT-SPECIFIC, NOT GENERAL — a REQUEST does NOT bump the
// client's updatedAt (measured 2026-09-18, Canvass-3.7). Do not generalise from either
// measurement to the other; the two are recorded together in PRE_LAUNCH_CHECKLIST.md
// precisely so nobody does.
//
// THE TRANSITIONS THESE COVER:
//   inspection  <- a quote is created            QUOTE_CREATE
//   not_sold    <- every quote becomes archived  QUOTE_UPDATE
//   sold        <- a job is created              JOB_CREATE
// `paid` already arrives through the INVOICE_UPDATE subscription, which this file has
// handled since long before this phase.
// ⚠ QUOTE_APPROVED IS SUBSCRIBED AND MOVES NO STAGE OF ITS OWN — an approved quote is
// still 'inspection' until a job exists. It is routed anyway, for the reason its own
// route records: it was subscribed against a path that did not exist and 404'd silently.
// Phase 1a Commit 5 is what gives it work to do (R5j — capture, then attribute).
// ⚠ THIS PARAGRAPH SAID "there are only three worth a webhook" UNTIL 2026-09-24, above a
// list that is now four lines long. The count is removed rather than replaced: nothing
// updates a number written above the list it counts, which is why it went stale the first
// time a topic was added.
//
// ⚠ THEY WRITE A STAGE AND NOTHING ELSE. No syncSingleClient, no pipeline_cache, no
// pending referral, no email, no admin alert. That is the TWO-PIPELINES fence, and it
// is asserted over each of these topics by name rather than assumed from the shared
// handler.
//
// ⚠ AND THEY NEVER CREATE A jobber_clients ROW — the same guard the request path
// carries, extended here deliberately rather than by habit. Row CREATION belongs to the
// three writers that carry a full client payload; a row conjured from a stage alone has
// no name, email or phone. These handlers know a quote id or a job id, not a client.

// ⚠ THREE FIELDS HERE ARE **NOT PROVEN** AT OUR PINNED VERSION 2026-05-12, AND EACH IS
// NAMED BECAUSE AN UNKNOWN FIELD FAILS THE WHOLE QUERY RATHER THAN ITSELF:
//   1. `Query.quote(id:)` — ZERO occurrences anywhere in this repo before this commit.
//   2. `Query.job(id:)`   — likewise ZERO. ⚠ `server/crm/jobber.js` asserts in a comment
//      that "client(id:)/invoice(id:)/job(id:) are all proven in this codebase". That is
//      TRUE of the first two and FALSE of `job(id:)`: measured 2026-09-21, the only
//      occurrence of `job(id:)` in the repository was that comment claiming it. The
//      claim has been corrected at its source.
//   3. `Quote.client` / `Job.client` — needed to get from a quote or job id to a client.
//      ⚠ **`Job.client` IS NOW PROVEN** — Danny's 2026-05-12 introspection lists it on the
//      Job type, and 2026-05-12 is our pin as of the 2-pre bump. The OTHER THREE ARE STILL
//      UNPROVEN and are deliberately left on this list: that introspection covered the
//      Invoice, InvoiceAmounts, Job and Client TYPES, and said nothing about the QUERY root
//      fields `quote(id:)` / `job(id:)` or about `Quote.client`. Narrowing the claim to what
//      was actually observed is the point — a partial dump is not a clean bill of health.
// ⚠ THE DEGRADATION IS THE SAME ONE `fetchRequestById` CHOSE, AND FOR THE SAME REASON:
// a fetch that cannot name its field writes NOTHING and records the failure. It never
// falls back to a wider query. If these turn out to be absent at 2026-05-12, the
// handlers are inert and the nightly sync keeps doing the job it already does — which
// is why shipping them ahead of a GraphiQL confirmation is safe rather than reckless.
async function fetchStageSubjectClient(topic, itemId, token) {
  const isQuote = topic.startsWith('quote');
  const query = isQuote
    ? `query GetQuoteClient($id: EncodedId!) { quote(id: $id) { id client { id } } }`
    : `query GetJobClient($id: EncodedId!) { job(id: $id) { id client { id } } }`;

  const response = await retryWithBackoff(
    () => axios.post(
      'https://api.getjobber.com/api/graphql',
      { query, variables: { id: itemId } },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-05-12',
        },
      }
    ),
    { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
  );

  // ⚠ JOBBER ANSWERS A GraphQL FAILURE WITH HTTP 200 PLUS AN `errors` ARRAY, and
  // jobberShouldRetry reads only error.response.status — so retryWithBackoff resolves
  // happily on exactly the failure this function is most likely to hit. Reading the
  // errors array explicitly is what turns that into a recorded skip instead of a
  // silent `undefined` client id. Same defect class as the Canvass-3.6 user picker,
  // which returned HTTP 200 with a truncated list.
  const gqlErrors = response.data?.errors;
  if (gqlErrors?.length > 0) {
    throw new Error(`Jobber GraphQL error resolving ${topic} ${itemId}: ${gqlErrors.map(e => e.message).join('; ')}`);
  }

  const node = isQuote ? response.data?.data?.quote : response.data?.data?.job;
  const clientId = node?.client?.id;
  if (!clientId) throw new Error(`${topic} ${itemId}: no client id on the fetched ${isQuote ? 'quote' : 'job'}`);
  return clientId;
}

// Shared body for the three stage topics. Mirrors handleRequestWebhook's shape exactly:
// parse, resolve tenancy, claim the delivery, fetch, act, log — never throwing out.
async function handleStageWebhook(req, topic) {
  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (parseErr) {
    await logError({ req, error: parseErr, source: `POST /webhooks/jobber/${topic} — payload parse` });
    return;
  }

  const itemId = payload?.data?.webHookEvent?.itemId;

  // No fallbackLookup, for the same reason handleRequestWebhook passes none: the
  // payload's itemId is a QUOTE or JOB id, which appears in no local table, so there is
  // nothing to look up and no safe guess.
  let contractorId;
  try {
    contractorId = await resolveWebhookContractorId(payload);
  } catch (err) {
    await logWebhookResolutionFailure(req, topic, itemId, payload, err);
    return;
  }

  try {
    if (!itemId) throw new Error(`${topic} webhook: missing item id (itemId) in payload`);

    // ⚠ KEYED ON occurred_at, SO A GENUINE SECOND UPDATE IS NOT SWALLOWED. QUOTE_UPDATE
    // in particular fires repeatedly for one quote, and each firing is a real event that
    // may change the classification — deduping on (topic, itemId) alone would drop every
    // transition after the first.
    const claim = await claimWebhookDelivery(contractorId, topic, itemId, webhookOccurredAt(payload));
    if (!claim.claimed) {
      console.log(`[${topic}] duplicate delivery for ${itemId} — already claimed, skipping`);
      return;
    }
    if (!claim.keyed) {
      await logError({
        req: null,
        contractorId,
        error: new Error(`[${topic}] webhook carried no occurredAt/occuredAt — delivery dedupe inert for ${itemId}`),
        source: `POST /webhooks/jobber/${topic} — dedupe key`,
        alert: false,
      });
    }

    let token, jobberClientId, relatedData;
    try {
      token = await _getFreshContractorAccessToken(contractorId);
      jobberClientId = await _fetchStageSubjectClient(topic, itemId, token);
      relatedData = await _fetchClientRelatedData(jobberClientId, token);
    } catch (fetchErr) {
      // Skip-and-log, the established semantics. alert:false keeps a schema-version
      // failure out of the inbox at per-item cardinality; it is one loud row per item in
      // error_log, which is what an absent `quote(id:)` or `job(id:)` would look like.
      await logError({
        req,
        contractorId,
        error: new Error(`[${topic}] skipped ${itemId} — could not resolve or fetch its client: ${fetchErr.message}`),
        source: `POST /webhooks/jobber/${topic} — fetch`,
        alert: false,
      });
      return;
    }

    if (!relatedData) {
      // ⚠ null NOW MEANS ONE THING ONLY: a clean 200 whose client is genuinely absent. Since
      // Commit 2 a GraphQL error THROWS and is caught above as a recorded skip, so this branch
      // can no longer be reached by a failed fetch. It used to be, and that is exactly how a
      // Jobber outage got written as "nothing observed" with a calm log line and no error_log
      // row. Write nothing — the same reading upsertAndTagClient's COALESCE encodes.
      console.log(`[${topic}] ${itemId} -> client ${jobberClientId} returned no related data, no stage written`);
      return;
    }

    const stage = classifyPipelineStatus(relatedData);

    // ⚠ UPDATE ONLY. See the block at the top of this section: a zero-row result is the
    // expected quiet outcome for a client the sync has not mirrored yet, not an error.
    const result = await pool.query(
      `UPDATE jobber_clients
          SET pipeline_stage = $3
        WHERE contractor_id = $1 AND jobber_client_id = $2`,
      [contractorId, jobberClientId, stage]
    );
    console.log(`[${topic}] ${itemId} -> client ${jobberClientId} stage ${stage} (${result.rowCount} row(s), contractor: ${contractorId})`);

    // ── SALES RECOMPUTE (Canvass-stage, Ruling 1) ───────────────────────────
    //
    // ⚠ ONLY ON JOB_CREATE. Sales are anchored on JOB CREATED, so a quote event
    // cannot open, close or move a sale — recomputing on one would page every job a
    // client has in order to arrive at the answer it already had. The stage still
    // updates on quote events above, because a quote genuinely moves the stage.
    //
    // ⚠ ISOLATED, AND DELIBERATELY NOT ALLOWED TO FAIL THE STAGE WRITE. The stage is
    // already committed by the time this runs; a paging failure must leave that
    // standing rather than rolling the handler into its catch. The nightly sync is the
    // backstop, and the failure is recorded.
    if (topic === 'job-create') {
      try {
        const counts = await refreshClientSales(pool, { contractorId, jobberClientId, token });
        console.log(`[${topic}] client ${jobberClientId} sales recomputed — ${counts.sales} sale(s), ${counts.jobs} job(s)`);
      } catch (salesErr) {
        await logError({
          req,
          contractorId,
          error: new Error(`[${topic}] stage written but sales recompute failed for client ${jobberClientId}: ${salesErr.message}`),
          source: `POST /webhooks/jobber/${topic} — sales recompute`,
          alert: false,
        });
      }
    }
  } catch (err) {
    await logError({ req, error: err, contractorId, source: `POST /webhooks/jobber/${topic}` });
    console.error(`[${topic}]`, err.message);
  }
}

// POST /webhooks/jobber/quote-create — Jobber topic QUOTE_CREATE
router.post('/jobber/quote-create', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;
  res.status(200).json({ received: true });
  handleStageWebhook(req, 'quote-create');
});

// POST /webhooks/jobber/quote-update — Jobber topic QUOTE_UPDATE
router.post('/jobber/quote-update', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;
  res.status(200).json({ received: true });
  handleStageWebhook(req, 'quote-update');
});

// POST /webhooks/jobber/quote-approved — Jobber topic QUOTE_APPROVED
//
// ⚠ IT EXISTS BECAUSE ITS ABSENCE WAS A SILENT 404 IN PRODUCTION. Danny subscribed
// QUOTE_APPROVED on 2026-09-24 pointing at this exact path before any route served it.
// Nothing in this file dispatches on the payload's topic — routing is by URL only — so an
// unsubscribed path is not "an unhandled topic", it is an unmatched route: Express's
// finalhandler answered 404 and **every event was dropped without a trace**. No HMAC check
// ran (verifyJobberWebhookSignature is the first statement INSIDE each route body, never
// middleware), no jobber_webhook_events row was claimed, and no error_log row was written,
// because expressErrorHandler is a four-argument error handler that an unmatched route
// never reaches. The subscription was deleted and is re-added after this deploys.
//
// ⚠ ITS OWN ROUTE AND ITS OWN TOPIC LITERAL, NOT quote-update's — THAT IS THE WHOLE POINT
// OF A SEPARATE ROUTE. jobber_webhook_events' key is
// (contractor_id, topic, item_id, occurred_at), so sharing quote-update's literal would
// make a genuine QUOTE_APPROVED and a genuine QUOTE_UPDATE for the same quote at the same
// occurred_at collide, and claimWebhookDelivery would discard the second as a duplicate
// delivery. Jobber plausibly emits both for one approval. Asserted by name in
// stageWebhooks.test.js, with the paired case proving both are claimed.
//
// ⚠ AND IT NEEDS NO HANDLER CHANGE, WHICH IS LOAD-BEARING RATHER THAN LUCKY:
// fetchStageSubjectClient branches on `topic.startsWith('quote')`, so 'quote-approved'
// takes the quote(id:) branch, and the sales recompute is gated on `topic === 'job-create'`,
// so it correctly does not fire. **Both depend on this literal's spelling** — renaming it
// silently sends approvals down the job(id:) branch.
//
// ⚠ STAGE ONLY, LIKE ITS THREE SIBLINGS. It captures no facts and runs no attribution;
// that is Phase 1a Commit 5 (R5i/R5j), deliberately not this commit.
router.post('/jobber/quote-approved', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;
  res.status(200).json({ received: true });
  handleStageWebhook(req, 'quote-approved');
});

// POST /webhooks/jobber/job-create — Jobber topic JOB_CREATE
router.post('/jobber/job-create', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;
  res.status(200).json({ received: true });
  handleStageWebhook(req, 'job-create');
});

module.exports = router;
// test seam — inert in production, never called outside server/test/
router._setTestOverrides  = _setTestOverrides;
router._resetTestOverrides = _resetTestOverrides;

// ⚠ THE REAL CAPTURE-PATH FETCHES AND THEIR QUERY TEXT, exported for the contract fence in
// server/test/captureFetchContract.test.js. The fence has to exercise the ACTUAL functions and
// read the ACTUAL selection text: a test that stubs the fetch and injects the value cannot
// discover that nothing upstream selects it, which is how loadContractorBranding() shipped a
// query missing two columns its resolver read. Inert in production.
router._captureFetches = { fetchClientRelatedData, fetchClientJobsForJobUpdate, fetchInvoiceWithJobs };
router._captureQueries = {
  RELATED_BASE_QUERY,
  RELATED_JOBS_PAGE_QUERY,
  RELATED_QUOTES_PAGE_QUERY,
  RELATED_REQUESTS_PAGE_QUERY,
  RELATED_INVOICES_PAGE_QUERY,
};
