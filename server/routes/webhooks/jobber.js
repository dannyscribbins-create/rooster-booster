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
const { writeReferredStatus } = require('../../utils/referredStatus');
// ⚠ ONE RESOLVER FOR BOTH EXTRACTION SITES (Commit B). `crm/pipelineSync.js` requires the same two
// symbols; a second `.find()` spelled here is how the two doors drift apart on which field names the
// referrer, which is a money question.
const {
  resolveReferralSourceField, readReferredByValue,
} = require('../../utils/referralSourceField');
// ── C1 — ONE SHARED CREDIT, ONE SHARED NOTIFY ────────────────────────────────────────────────────
// ⚠ TWO MODULES RATHER THAN ONE, AND THE SPLIT IS THE POINT: the credit WRITES and takes a `tx` inside
// the lock; the notify SENDS and takes the `pool` after the lock is released. Collapsing them would put
// an outbound HTTP call inside a held connection.
const { creditReferralFromFacts } = require('../../utils/referralCredit');
const { notifyReferralCredit } = require('../../utils/referralNotify');
// ⚠ THE MODULE ITSELF, ONLY SO `_setTestOverrides` CAN FORWARD THE EMAIL SEAM TO IT. Production
// never calls the notify's override setter; see the note in `_setTestOverrides` below.
const notifyModule = require('../../utils/referralNotify');
const { isDerivableJobberClientId } = require('../../utils/derivableClient');
const { refreshClientSales } = require('../../utils/clientSales');
const { logError } = require('../../middleware/errorLogger');
const { BRANDING_THEME_DEFAULTS } = require('../../utils/brandingTheme');
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { jobberShouldRetry, resendShouldRetry } = require('../../utils/retryHelpers');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { isEmailSuppressed } = require('../../utils/emailSuppression');
const deriveAndSaveTags = require('../../utils/deriveJobberTags');
const { runContactMatchingPass } = require('../../jobs/contactMatchingPass');
const { refreshTokenIfNeeded, getFreshContractorAccessToken, fetchRequestById } = require('../../crm/jobber');
const { attributeFromRequest } = require('../../utils/requestAttribution');
// ── CAPTURE-THEN-DECIDE (3d Phase 1a Commit 5) ───────────────────────────────
// ⚠ classifyPipelineStatus IS STILL IMPORTED ABOVE AND IS NO LONGER A DECISION INPUT HERE.
// syncSingleClient (the nightly/pipeline_cache path) still uses it; the two webhook doors in
// this file do not. Removing the import would break that other consumer, so the rule is
// enforced by the fence in server/test/captureThenDecide.test.js rather than by absence.
const { captureClientFacts } = require('../../utils/factCapture');
const { certifyFullyPaged } = require('../../utils/captureCompleteness');
const { decideFromFacts } = require('../../utils/attributionDecide');
const { runAttributionEngine } = require('../../utils/attributionEngine');
const { withClientLock } = require('../../utils/clientLock');
// ⚠ THE ENGINE'S REQUEST LIST, FROM SAVED FACTS (7b). fetchAttributionData — a live Jobber
// call — used to be imported here and handed to the engine. It is gone from this file and from
// crm/jobber.js entirely, so no door can reach for it by habit.
const { makeRequestReader } = require('../../utils/requestFacts');
const { isInvoicePaid, PAID_STATUS } = require('../../utils/invoicePaid');
// ⚠ THREE IMPORTS WERE REMOVED HERE BY C1 AND THEY WENT TOGETHER: `evaluateReferral`,
// `writeReferralConversion` and `applyTag`. Their ONLY call sites were inside the 173-line
// live-object referral block this commit retired (see STEP 9 below). All three are still used —
// by `server/utils/referralCredit.js`, which is now the one place that evaluates, writes a
// conversion and applies the Active Referrer tag. Named rather than silently dropped, because
// three vanished imports in a 200-line deletion is exactly where a side effect gets lost.
const {
  fetchFullClient,
  assertNoJobberGraphQLErrors,
  assertInvoiceJobsComplete,
  pageClientConnection,
  capturePost,
  attachInvoicesToJobs,
  // ⚠ IMPORTED, NEVER PASTED. This file previously spelled its own narrower `customFields`
  // selections — four of them — and selected `customFieldConfiguration` zero times, so
  // `writeCustomFieldFacts` skipped every field and this door captured no custom-field facts while
  // reporting success. A second copy of a selection is how one copy gets fixed and the other does
  // not; sharing the constant is what makes that unexpressible.
  CUSTOM_FIELDS,
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
//
// ⚠ BOTH JOB CONNECTIONS ARE PAGED TO EXHAUSTION (3d Phase 1a Commit 3c, Danny's ruling). They
// read `jobs(first: 10)` and `archivedJobs(first: 10)` with NO pageInfo on either, so an invoice
// covering more than ten jobs lost the rest with nothing to say so — and
// assertInvoiceJobsComplete could not catch it, because a missing pageInfo makes hasNextPage
// `undefined`, which is not `true`. **An absent field reads as health.**
//
// ⚠ AND THE CONSEQUENCE WAS A WRONG BONUS, NOT A MISSING ONE, WHICH IS WHY IT IS ON THE MONEY
// PATH. evaluateReferral (server/referralRules.js) collects Job Type custom fields from
// `jobs.nodes` PLUS `archivedJobs.nodes` and picks a payout schedule from them: a Full Roof label
// selects the ESCALATING schedule, and a Repair label a different one. Truncating the job set can
// drop the job carrying the Full Roof label, so a referral is paid on the wrong schedule — or
// returns `no_job_type_found` and is not paid at all. Both are silent and both are money.
//
// ⚠ 50 IS A PAGE SIZE, NOT A CAP. A cursor anomaly and the page cap both THROW rather than
// returning a short set, and the caller's existing catch turns a throw into a recorded skip with
// NO money-path action — see the invoice-paid handler's fetch block.
// ⚠ WIDENED TO THE SHARED SELECTION RATHER THAN EXEMPTED. This one feeds `evaluateReferral`'s live
// object, not `writeCustomFieldFacts`, so it is the selection a "only fix the capture doors" change
// would have left narrow — and a file with one narrow selection left in it is exactly how the next
// missing-field defect ships. CLAUDE.md's rule is reword, never exempt: the fence below requires
// EVERY customFields selection in this file to carry the configuration id and both value members,
// with no per-constant carve-out, so this one is widened too. The extra members are additive —
// `evaluateReferral` matches on the label and ignores what it does not read.
const INVOICE_JOB_NODE_FIELDS = `id
                ${CUSTOM_FIELDS}`;

const INVOICE_WITH_JOBS_QUERY = `query GetInvoiceWithJobs($id: EncodedId!) {
          invoice(id: $id) {
            id
            invoiceNumber
            invoiceStatus
            issuedDate
            waitingForFinancedPayment
            amounts { total invoiceBalance }
            client { id name }
            jobs(first: 50) {
              nodes { ${INVOICE_JOB_NODE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
            archivedJobs(first: 50) {
              nodes { ${INVOICE_JOB_NODE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const INVOICE_JOBS_PAGE_QUERY = `query GetInvoiceJobsPage($id: EncodedId!, $after: String) {
          invoice(id: $id) {
            jobs(first: 50, after: $after) {
              nodes { ${INVOICE_JOB_NODE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const INVOICE_ARCHIVED_JOBS_PAGE_QUERY = `query GetInvoiceArchivedJobsPage($id: EncodedId!, $after: String) {
          invoice(id: $id) {
            archivedJobs(first: 50, after: $after) {
              nodes { ${INVOICE_JOB_NODE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

async function fetchInvoiceWithJobs(invoiceId, token) {
  const label = `fetchInvoiceWithJobs ${invoiceId}`;
  const response = await capturePost(INVOICE_WITH_JOBS_QUERY, { id: invoiceId }, token);

  // ⚠ ORDER MATTERS: read the errors array BEFORE the absence check. Both produce a throw, but
  // only this one says WHY — a 200-with-errors otherwise surfaced as "no invoice returned",
  // which reads as a deleted invoice rather than a failed query.
  assertNoJobberGraphQLErrors(response, label);
  const invoice = response.data?.data?.invoice;
  if (!invoice) {
    throw new Error(`fetchInvoiceWithJobs: no invoice returned for id ${invoiceId}`);
  }

  // ⚠ `root: 'invoice'` — the shared pager, not a second copy of the loop. It throws on
  // hasNextPage-with-no-endCursor, on an absent connection, on a mid-page errors array and on the
  // page cap, which is the whole point: every one of those would otherwise be a short job set.
  const [jobs, archivedJobs] = await Promise.all([
    pageClientConnection({
      query: INVOICE_JOBS_PAGE_QUERY, clientId: invoiceId, token,
      field: 'jobs', firstPage: invoice.jobs, label, root: 'invoice',
    }),
    pageClientConnection({
      query: INVOICE_ARCHIVED_JOBS_PAGE_QUERY, clientId: invoiceId, token,
      field: 'archivedJobs', firstPage: invoice.archivedJobs, label, root: 'invoice',
    }),
  ]);

  return { ...invoice, jobs: { nodes: jobs }, archivedJobs: { nodes: archivedJobs } };
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
// ⚠ THESE TWO CARRY EVERY FIELD THE FACT WRITERS READ, AND THE MECHANICAL FENCE IN
// server/test/captureFetchContract.test.js ENFORCES IT rather than trusting anyone to remember.
// Before 3a-2 they were 8 and 11 fields short of what writeInvoiceFacts and writeJobFacts read,
// so those columns were NULL for every client in production while the writers looked correct.
// All fields verified at the pinned 2026-05-12 by Danny's introspection — see the note at
// JOB_FIELDS in server/utils/jobberClientFetch.js for the type-by-type list.
// ⚠ customFields STAYS: deriveJobberTags reads it off each job for the work_category and
// material_type tags, and it is the one thing here that is NOT a fact-writer field.
// ── CAPTURE PAGE SIZES (3d Phase 1a Commit 5) ────────────────────────────────
//
// ⚠ THESE WERE FIVE HARDCODED `first: 50` LITERALS UNTIL COMMIT 5, AND A COST FIX CANNOT BE
// APPLIED TO A NUMBER THAT IS WRITTEN OUT FIVE TIMES. They are named here so the value moves
// once, and so the fence in server/test/captureFetchContract.test.js can read it.
//
// ⚠ 20, NOT 50, BECAUSE `requestedQueryCost` IS WHAT THROTTLES — NOT `actualQueryCost`.
// Danny measured GetClientRelated in GraphiQL at the pinned 2026-05-12: **requested 8128,
// actual 351.** Jobber reserves the REQUESTED figure against the available bucket before
// running the query and refunds the remainder, so at ~8128 against a 10000 ceiling this
// capture is admitted **only when the bucket is nearly full** — and client-create/-update send
// fetchFullClient (requested 7730) immediately before it.
// ⚠ SMALLER PAGES LOSE NOTHING because all four client-level connections below are paged to
// exhaustion by pageClientConnection, which throws rather than returning a short answer.
const RELATED_PAGE_SIZE = 20;

// ⚠ STAYS AT 50, AND THE ASYMMETRY IS DELIBERATE — see the matching note at
// INVOICE_JOBS_PAGE_SIZE in server/utils/jobberClientFetch.js. This connection is NOT paged:
// assertInvoiceJobsComplete THROWS when it overflows, so lowering it would convert an invoice
// naming 11+ jobs from a capture into a hard failure, and under Commit 5's rule 2 that means no
// decision is written for the client at all.
const RELATED_INVOICE_JOBS_PAGE_SIZE = 50;

const RELATED_JOB_FIELDS = `id jobNumber jobStatus jobType title
                createdAt updatedAt startAt endAt completedAt
                total invoicedTotal uninvoicedTotal
                client { id } quote { id } request { id } salesperson { id }
                ${CUSTOM_FIELDS}`;

// ⚠ customFields ADDED HERE, AND THE INVOICE COPY IS THE ONE THAT MATTERS MOST. This selection
// carried NO custom fields at all, and `categorySource`'s ruling 1 reads the INVOICE copy FIRST —
// so the money door could never see the field its payout schedule is chosen from. A real Accent job
// reports `""` on the job while its invoice copy reports `"Out of Pocket"`, which is why "fall
// through to the job" is not a substitute for selecting this.
const RELATED_INVOICE_FIELDS = `id invoiceNumber invoiceStatus
                createdAt updatedAt issuedDate dueDate receivedDate
                waitingForFinancedPayment
                client { id }
                amounts { total subtotal invoiceBalance paymentsTotal
                          depositAmount discountAmount taxAmount }
                jobs(first: ${RELATED_INVOICE_JOBS_PAGE_SIZE}) { nodes { id } pageInfo { hasNextPage } }
                archivedJobs(first: ${RELATED_INVOICE_JOBS_PAGE_SIZE}) { nodes { id } pageInfo { hasNextPage } }
                ${CUSTOM_FIELDS}`;

// ⚠ `client { id }` ADDED IN COMMIT 5 — see the note at QUOTE_FIELDS in jobberClientFetch.js.
// Without it writeQuoteFacts drops every quote and the capture writes nothing, silently.
// ⚠ AND customFields ADDED, because ruling 1's last fall-through is the LINKED QUOTE. A quote-level
// field was unreachable on this door for the same reason the invoice copy was: nothing selected it.
const RELATED_QUOTE_FIELDS = `id quoteStatus createdAt lastTransitioned { approvedAt } salesperson { id } client { id }
                ${CUSTOM_FIELDS}`;

const RELATED_BASE_QUERY = `query GetClientRelated($id: EncodedId!) {
          client(id: $id) {
            id createdAt isCompany isLead
            tags { nodes { label } }
            ${CUSTOM_FIELDS}
            jobs(first: ${RELATED_PAGE_SIZE}) {
              nodes { ${RELATED_JOB_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
            quotes(first: ${RELATED_PAGE_SIZE}) {
              nodes { ${RELATED_QUOTE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
            requests(first: ${RELATED_PAGE_SIZE}) {
              nodes { id requestStatus createdAt client { id } }
              pageInfo { hasNextPage endCursor }
            }
            invoices(first: ${RELATED_PAGE_SIZE}) {
              nodes { ${RELATED_INVOICE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const RELATED_JOBS_PAGE_QUERY = `query GetClientRelatedJobsPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            jobs(first: ${RELATED_PAGE_SIZE}, after: $after) {
              nodes { ${RELATED_JOB_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const RELATED_QUOTES_PAGE_QUERY = `query GetClientRelatedQuotesPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            quotes(first: ${RELATED_PAGE_SIZE}, after: $after) {
              nodes { ${RELATED_QUOTE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const RELATED_REQUESTS_PAGE_QUERY = `query GetClientRelatedRequestsPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            requests(first: ${RELATED_PAGE_SIZE}, after: $after) {
              nodes { id requestStatus createdAt client { id } }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

const RELATED_INVOICES_PAGE_QUERY = `query GetClientRelatedInvoicesPage($id: EncodedId!, $after: String) {
          client(id: $id) {
            invoices(first: ${RELATED_PAGE_SIZE}, after: $after) {
              nodes { ${RELATED_INVOICE_FIELDS} }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`;

async function fetchClientRelatedData(clientId, token, meta = {}) {
  const label = `fetchClientRelatedData ${clientId}`;
  // ⚠ OPTIONAL AND ADDITIVE (Commit 5) — see the matching note in fetchFullClient. The door is
  // what makes a cost line answer anything; an untagged one cannot separate a webhook burst
  // from the sweep, which is the whole question the numbers are read for.
  const costMeta = { door: meta.door || 'fetchClientRelatedData', contractorId: meta.contractorId || null };

  const response = await capturePost(RELATED_BASE_QUERY, { id: clientId }, token,
    { ...costMeta, label: 'GetClientRelated' });
  assertNoJobberGraphQLErrors(response, label);

  const client = response.data?.data?.client;
  // A clean 200 with no client is a genuine absence and stays one.
  if (!client) return null;

  const [jobNodes, quoteNodes, requestNodes, invoiceNodes] = await Promise.all([
    pageClientConnection({ query: RELATED_JOBS_PAGE_QUERY, clientId, token, field: 'jobs', firstPage: client.jobs, label, meta: costMeta }),
    pageClientConnection({ query: RELATED_QUOTES_PAGE_QUERY, clientId, token, field: 'quotes', firstPage: client.quotes, label, meta: costMeta }),
    pageClientConnection({ query: RELATED_REQUESTS_PAGE_QUERY, clientId, token, field: 'requests', firstPage: client.requests, label, meta: costMeta }),
    pageClientConnection({ query: RELATED_INVOICES_PAGE_QUERY, clientId, token, field: 'invoices', firstPage: client.invoices, label, meta: costMeta }),
  ]);

  assertInvoiceJobsComplete(invoiceNodes, label);

  // ⚠ CERTIFIED HERE FOR THE SAME REASON fetchFullClient IS: reaching this line means all four
  // `pageClientConnection` calls resolved, and that helper throws rather than returning a short set.
  // Both fetchers meet the SAME standard — the same four connections, drained the same way — so
  // "fully captured" means one thing across every live door.
  return certifyFullyPaged({
    ...client,
    jobs: { nodes: attachInvoicesToJobs(jobNodes, invoiceNodes) },
    quotes: { nodes: quoteNodes },
    requests: { nodes: requestNodes },
    invoices: { nodes: invoiceNodes },
  });
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
  fetchStageSubjectClient: j,
} = {}) {
  if (a !== undefined) _fetchInvoiceWithJobs        = a;
  if (b !== undefined) _fetchFullClient              = b;
  if (c !== undefined) _fetchClientRelatedData       = c;
  if (d !== undefined) {
    _sendEmail                    = d;
    // ── C1 — THE NOTIFY'S SEAM IS THE SAME SEAM, AND IT HAD TO BE SAID IN CODE ─────────
    // ⚠ `referralNotify.js` CARRIES ITS OWN `_sendEmail`, AND ITS COMMENT CLAIMS "ONE SEAM, MATCHING
    // THE WEBHOOK ROUTER'S". That parity did not exist from a CALLER's point of view: overriding this
    // router's seam left the notify holding the real Resend client, so the two bonus emails this door
    // is responsible for went somewhere no assertion could see them.
    // ⚠ AND IT FAILED SILENTLY RATHER THAN LOUDLY, WHICH IS WHY IT IS WORTH THE LINES. With the 7d-0
    // interlock armed by `captureResend()`, those sends were RECORDED by the interlock instead of
    // refused — so nothing threw, nothing logged, the credit was written correctly, and four cases
    // waiting on `emails.length >= 2` simply timed out. A seam that reports coverage it does not have
    // is this repo's recurring shape; forwarding is what makes the notify's comment true.
    // ⚠ FORWARDED RATHER THAN DUPLICATED IN EVERY SUITE, deliberately. The alternative is that each
    // suite must know about two seams, and the one that gets forgotten is the one whose emails vanish.
    notifyModule._setTestOverrides({ sendEmail: d });
  }
  if (e !== undefined) _fetchClientJobsForJobUpdate  = e;
  if (f !== undefined) _refreshTokenIfNeeded         = f;
  if (g !== undefined) _getFreshContractorAccessToken = g;
  if (h !== undefined) _fetchRequestById             = h;
  if (j !== undefined) _fetchStageSubjectClient      = j;
}

// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() {
  // ⚠ RESET THE NOTIFY'S SEAM TOO. `_setTestOverrides` forwards into it, so resetting only this
  // module's own seam would leave one suite's stub installed in `referralNotify` for every suite that
  // ran after it — a cross-file leak that shows up as someone else's emails arriving in your array.
  notifyModule._resetTestOverrides();
  _fetchInvoiceWithJobs        = fetchInvoiceWithJobs;
  _fetchFullClient             = fetchFullClient;
  _fetchClientRelatedData      = fetchClientRelatedData;
  _fetchClientJobsForJobUpdate = fetchClientJobsForJobUpdate;
  _refreshTokenIfNeeded        = refreshTokenIfNeeded;
  _getFreshContractorAccessToken = getFreshContractorAccessToken;
  _fetchRequestById            = fetchRequestById;
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
// ⚠ `door` IS A REQUIRED-IN-PRACTICE FOURTH ARGUMENT (6b). Four routes share this function, so
// without it every cost and hold-time line it produces is untraceable to the event that caused it
// — which is exactly the state the live check found: `door=fetchClientRelatedData contractor=-`.
// ⚠ `alsoDeriveReferredStatus` IS OPT-IN AND ONLY invoice-paid PASSES IT (N4 commit 7b).
// A paid invoice moves the REFERRER-visible stage, and this door is the only one that sees a paid
// invoice without also calling `syncSingleClient` — client-create and client-update both call it a
// few lines later, so turning this on for them would write `pipeline_cache` twice per event.
// ⚠ IT RUNS INSIDE THIS FUNCTION'S EXISTING LOCK AND TRANSACTION, WHICH IS DANNY'S RULING RATHER
// THAN A CONVENIENCE. A second lock immediately afterwards would serialize on the same key but
// would not be ATOMIC with the capture: another event could land between, and the later derive
// could then write a status taken from facts the first had not finished writing.
async function upsertAndTagClient(contractorId, fullClient, relatedData, door = 'upsertAndTagClient', { alsoDeriveReferredStatus = false } = {}) {
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
  // ⚠ CAPTURE, THEN DECIDE (Commit 5). This used to be
  // `relatedData ? classifyPipelineStatus(relatedData) : null` — a decision taken from the LIVE
  // fetch. It now comes from decideFromFacts, which reads only saved rows, so this door and the
  // replay run the same code over the same facts (R5i).
  //
  // ⚠ A FAILED CAPTURE YIELDS null, AND null IS NOT A STAGE (rule 2). The upsert below
  // COALESCEs it, so the stored stage survives untouched — "not observed this pass", exactly as
  // an absent relatedData already meant. What must never happen is a decision taken from a fact
  // set a failed capture may have left partial: that would write a confident wrong stage, and
  // the next event would see a stored answer and have no reason to look again.
  //
  // ⚠ IDENTITY AND TAGS BELOW STILL RUN, AND THAT IS DANNY'S RULING (2026-09-25), NOT a reading
  // of convenience. They are derived from the FETCH, not from the fact tables, so a fact-write
  // failure says nothing about them — and skipping them would mean a brand-new client got no
  // jobber_clients row at all on client-create. ⚠ HIS CONDITION IS THE OTHER HALF: they may only
  // run off a COMPLETE fetch. That already holds structurally — `relatedData` is null when the
  // fetch failed (Commit 2 made a GraphQL error throw, and every caller catches it to null), and
  // the tag block below is gated on it. Since 4b `paying_client` can be REMOVED, so deriving
  // tags from a partial fetch could strip a real one; the guard-proof for that is in
  // captureThenDecide.test.js.
  // ⚠ CAPTURE AND DECISION ARE TWO SEPARATE LOCKED TRANSACTIONS (Danny's ruling, 2026-09-30), AND
  // THE RULING CORRECTED A READING I HAD FILED. The coupling was filed as *not obviously wrong*, on
  // the grounds that splitting it trades one inconsistency for another. That is true and the two are
  // NOT equal:
  //   - "facts stored, stage stale" leaves `status_derived_at IS NULL` / an unmoved stage, which the
  //     next pass and the catch-up job already converge out of;
  //   - "stage written, facts discarded" is a decision resting on data that was rolled back — and it
  //     cost SEVEN clients their facts on the invoice-paid door, with nothing left to re-derive from.
  // So: facts commit first, on their own. The decision runs afterwards in its own locked transaction
  // and CANNOT take the capture down with it.
  //
  // ⚠ THE SECOND LOCK IS NOT REDUNDANT. The decision still reads every fact for this client and
  // writes the referrer-visible status, so two events for one client must not interleave between the
  // read and the write — that is the LOST UPDATE `clientLock.js` exists for, and it is unchanged by
  // the split. What the split removes is only the shared FATE of the two units.
  //
  // ⚠ AND THE TWO FAILURE PATHS MEAN DIFFERENT THINGS, so they are caught separately and say so. A
  // capture failure means the facts are NOT saved; a decision failure means they ARE, and the client
  // is left in the "not yet derived" state the catch-up job looks for. Collapsing them into one catch
  // would make the alert unable to tell an operator which happened.
  // ── RULING 3 (Danny, 2026-10-02) — THE IDENTITY ROW EXISTS BEFORE THE CAPTURE ──────────
  //
  // ⚠ THE DEFECT THIS CLOSES, MEASURED END TO END IN PRODUCTION ON 2026-10-02. `captureClientFacts`
  // writes `jobber_created_at` and the full-capture marker with `UPDATE jobber_clients …`, and the
  // identity upsert that CREATES that row ran AFTER both the capture and the decision. So on a client's
  // FIRST SIGHTING both writes affected **0 rows**: the creation date stayed NULL even for a client that
  // had just been credited, and `last_full_capture_at` stayed NULL so the catch-up could not see it until
  // the client's NEXT full capture. `factCapture.js` records exactly that ordering for the marker, and
  // called the resulting ineligibility "the conservative direction" — true of the marker, and not true
  // of the creation date, which C1 had to work around by supplying the date from the live object.
  //
  // ⚠ IT IS AN `ON CONFLICT DO NOTHING` PRE-INSERT, NOT A MOVE OF THE REAL UPSERT, AND THE REASON IS
  // THAT THE REAL UPSERT CANNOT MOVE. It writes `pipeline_stage` and `stage_derived_at` from `$10` — the
  // DECIDED stage — so it structurally cannot run before the decision. Relocating it would mean splitting
  // one statement into two writers of one row, which is how two writers come to disagree.
  //
  // ⚠ AND IT CARRIES IDENTITY RATHER THAN BEING A BARE KEY INSERT. A row with NULL name, email and phone
  // would be visible to the contact matcher for the milliseconds before the real upsert fills it, and if
  // that upsert then failed it would persist. Carrying the same identity values the real upsert uses
  // means a brand-new row is correct the moment it exists.
  // ⚠ `DO NOTHING`, SO AN EXISTING ROW IS UNTOUCHED. Every client the system has already seen is
  // completely unaffected — this statement only ever creates a row that was about to be created anyway,
  // a few milliseconds earlier.
  //
  // ⚠ NON-FATAL, AND GATED ON `relatedData`. It runs only when a capture is about to happen, which is
  // exactly when the row needs to pre-exist; a failure here must not abort the webhook, because the real
  // upsert below still runs and the next event retries.
  if (relatedData && fullClient.id) {
    try {
      await pool.query(
        `INSERT INTO jobber_clients
           (jobber_client_id, contractor_id, first_name, last_name, email, phone,
            is_company, is_lead, is_archived, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING`,
        [
          fullClient.id,
          contractorId,
          fullClient.firstName || null,
          fullClient.lastName || null,
          email,
          phone,
          (relatedData?.isCompany ?? fullClient.isCompany) === true,
          (relatedData?.isLead ?? fullClient.isLead) === true,
          (relatedData?.isArchived ?? fullClient.isArchived) === true,
        ]
      );
    } catch (preErr) {
      await logError({
        req: null,
        contractorId,
        error: new Error(`[upsertAndTagClient] identity pre-insert failed for client ${fullClient.id}, the capture's UPDATEs will affect 0 rows on a first sighting: ${preErr.message}`),
        source: 'upsertAndTagClient — identity pre-insert',
        alert: false,
      });
    }
  }

  let pipelineStage = null;
  let captureCommitted = false;
  if (relatedData) {
    try {
      // ⚠ CAPTURE AND DECIDE ARE ONE LOCKED TRANSACTION (Commit 6), keyed on
      // (contractor, client) so different clients never wait on each other. Without it two
      // events for the same client interleave: capture A writes half its facts and decide B
      // reads them, storing a stage taken from a fact set that never existed.
      // ⚠ THE IDENTITY UPSERT BELOW STAYS OUTSIDE THE LOCK ON PURPOSE. It writes name, email,
      // phone and the archived flags from the FETCH — none of which is part of the decision —
      // and it is the write that must still happen when capture fails (Danny's ruling,
      // 2026-09-25). The decided stage is carried out of the lock and into it; a null stage is
      // COALESCEd there, so a failed capture leaves the stored stage standing.
      // ⚠ AND THE JOBBER FETCH IS ALREADY DONE BY THE TIME THIS RUNS — a pooled connection must
      // never be held across a call to Jobber. See server/utils/clientLock.js.
      // ── TRANSACTION 1 — CAPTURE, AND NOTHING ELSE ────────────────────────────
      await withClientLock(pool, { contractorId, jobberClientId: fullClient.id, door }, async (tx) => {
        await captureClientFacts(tx, { contractorId, client: relatedData });
      });
      captureCommitted = true;
    } catch (capErr) {
      await logError({
        req: null,
        contractorId,
        error: new Error(`[upsertAndTagClient] CAPTURE failed for client ${fullClient.id}, the facts were NOT saved and no stage was decided: ${capErr.message}`),
        source: 'upsertAndTagClient — capture',
        // ⚠ IT ALERTS, AND `alert: false` IS WHY THE `$3` DEFECT WENT UNNOTICED FOR THREE HOURS. A
        // failure that loses a client's facts is the definition of something a person needs to know
        // about, and INFO with no alert made it indistinguishable from routine noise.
        alert: true,
      });
      pipelineStage = null;
    }
  }

  // ── TRANSACTION 2 — DECIDE, ONLY IF THE FACTS ARE ACTUALLY THERE ────────────
  // ⚠ GATED ON THE CAPTURE HAVING COMMITTED, not merely on `relatedData`. Deciding after a failed
  // capture is the one thing the pre-split code did that this ruling exists to stop: the facts may be
  // absent or stale, and a confident wrong stage is worse than none because the next event sees a
  // stored answer and has no reason to look again.
  //
  // ⚠ DECLARED OUT HERE SO THE NOTIFY CAN READ IT AFTER THE LOCK HAS BEEN RELEASED (C1). It stays null
  // on every path that does not credit — a failed capture, a non-derivable id, a client with no
  // referrer in its facts — and the notify is gated on it, so "no credit" and "credit but no email"
  // cannot be confused.
  let creditOutcome = null;
  if (captureCommitted) {
    try {
      pipelineStage = await withClientLock(pool, { contractorId, jobberClientId: fullClient.id, door }, async (tx) => {
        // `tx`, not `pool` — a read on another connection would sit outside the lock.
        const decided = await decideFromFacts(tx, { contractorId, jobberClientId: fullClient.id });

        // ── THE REFERRER-VISIBLE STAGE, FROM THE SAME FACTS (N4 commit 7b) ──────
        // ⚠ ONLY WHERE A ROW ALREADY EXISTS. This is an UPDATE, never an INSERT: `syncSingleClient`
        // owns creating a `pipeline_cache` row, because it is the only path that knows the referrer
        // name and the pre-start-date decision. A zero-row result is the expected quiet outcome for
        // a client the referral sync has not seen.
        // ⚠ THIS COMMENT USED TO OPEN "ONLY FOR A REFERRED CLIENT" AND THAT WAS FALSE OF THE GUARD.
        // The condition tests `alsoDeriveReferredStatus` and derivability — NOT whether the client is
        // referred — so the statement runs for every real Jobber client on an invoice-paid webhook
        // and simply affects no rows for the rest. Harmless as behaviour, and the reason the
        // parameter-type defect below hit SEVEN non-referred clients rather than nobody: a comment
        // that describes the effect as though it described the gate hides the real blast radius.
        // ⚠ IT WRITES NO CONVERSION AND CREDITS NOBODY. That is commit 7d, and it is blocked on
        // 7c — the Job Type custom field is not captured, so `evaluateReferral` cannot run from
        // facts at all yet.
        // ⚠ ONE COPY OF THE STATEMENT, IN `server/utils/referredStatus.js`. The split gives this
        // write a SECOND caller — the catch-up job — and a pasted copy of a money-adjacent UPDATE is
        // exactly what this repo has already paid for twice. `writeReferredStatus` carries the
        // `$3::text` casts, the write-once `paid_at` CASE and the UPDATE-never-INSERT rule with it.
        if (alsoDeriveReferredStatus && isDerivableJobberClientId(fullClient.id)) {
          await writeReferredStatus(tx, { contractorId, jobberClientId: fullClient.id });

          // ── THE CREDIT, THROUGH THE ONE SHARED CREDIT (C1) ────────────────────
          // ⚠ THE THIRD PARAGRAPH ABOVE IS NOW OUT OF DATE BY DESIGN AND IS LEFT STANDING AS THE
          // RECORD: it says this door "writes no conversion and credits nobody … blocked on 7c".
          // 7c shipped, Commit A made the custom-field facts reachable on this door, and C1 is the
          // credit. The old sentence is kept rather than deleted because a reader who believed it
          // needs to see which claim was withdrawn.
          //
          // ⚠ INSIDE THE LOCK AND INSIDE THIS TRANSACTION, so the conversion row and the stage
          // decision that justified it commit together or not at all.
          //
          // ⚠ IT NEVER THROWS INTO THIS CALLBACK. `creditReferralFromFacts` swallows and alerts,
          // because a referral that cannot be evaluated must not roll back the stage decision it
          // rode in on — the transaction coupling that cost seven clients their facts on this very
          // door when `$3` was left uncast.
          //
          // ⚠ AND IT SENDS NO EMAIL. The notify runs after the lock is released, below — sending
          // here would hold a pooled connection across an outbound HTTP call, which is the defect
          // commit 6b fixed inside `withClientLock` itself.
          //
          // ⚠ THE CLIENT'S CREATION DATE IS SUPPLIED FROM THE LIVE OBJECT, AND WITHOUT IT THE BRAND-NEW
          // CASE COULD NEVER BE CREDITED. The identity upsert below is what CREATES the `jobber_clients`
          // row, and it runs after this block — `factCapture.js` records the same ordering for the
          // full-capture marker in terms — so on a first sighting `captureClientFacts`' write of
          // `jobber_created_at` affects 0 rows and the one start-date rule reads nothing. Measured
          // 2026-10-01: the credit returned `client_created_at_unknown` and ruling 1's *"credited
          // immediately rather than waiting for the sync"* was dark for exactly the client it names.
          // ⚠ `relatedData`, NOT `fullClient`. The shell built at the invoice-paid call site carries only
          // id, name, emails and phones; `relatedData` is the full client fetch and is the same object
          // `captureClientFacts` writes the column from, so the two can never disagree.
          // ⚠ AND IT IS PASSED EVEN WHEN ABSENT, deliberately: `clientCreatedAt: undefined` would be
          // indistinguishable from not supplying it, so a client the fetch returned with no `createdAt`
          // is passed as null and REFUSED, rather than falling through to a stored read that cannot
          // answer. Unknown is never permission.
          creditOutcome = await creditReferralFromFacts(tx, {
            contractorId, jobberClientId: fullClient.id, req: null,
            clientCreatedAt: relatedData?.createdAt ?? null,
          });
        }

        return decided.currentStatus;
      });
    } catch (decErr) {
      // ⚠ A DECISION FAILURE IS A DIFFERENT EVENT FROM A CAPTURE FAILURE, AND THE MESSAGE SAYS SO.
      // The facts ARE saved — that is the whole point of the split — so this is recoverable, and the
      // client is now in the state the catch-up job looks for: facts newer than its decision.
      // ⚠ IT STILL ALERTS. "Recoverable" is not "invisible": the catch-up job is bounded by its own
      // cadence, and a decision that fails every time would otherwise be a client silently stuck on
      // a stale stage. The `$3` defect is the whole argument — three hours at INFO with no alert.
      await logError({
        req: null,
        contractorId,
        error: new Error(`[upsertAndTagClient] DECISION failed for client ${fullClient.id}; the facts ARE saved, so this is recoverable — the catch-up job will re-decide it from saved facts: ${decErr.message}`),
        source: 'upsertAndTagClient — decision',
        alert: true,
      });
      pipelineStage = null;
    }
  }

  // ── THE NOTIFY, AFTER THE LOCK IS RELEASED, ONLY ON A NEW CREDIT (C1) ───────
  // ⚠ HERE RATHER THAN INSIDE THE LOCK, AND THAT IS NOT A STYLE CHOICE. `notifyReferralCredit` sends
  // through Resend with retries; doing it inside `withClientLock` would hold a pooled connection across
  // an outbound HTTP call, so a slow Resend would exhaust the pool rather than delay one email. That is
  // precisely the defect commit 6b fixed inside `withClientLock` itself, and it is why this function
  // takes `pool` rather than `tx`.
  //
  // ⚠ GATED ON `credited`, NEVER ON `qualified`. A duplicate webhook delivery is `qualified: true` with
  // `inserted: false`, and emailing on `qualified` is exactly how a referrer gets told twice about one
  // bonus. `credited` is true only when a conversion row was INSERTED by this call.
  //
  // ⚠ AND IT IS AWAITED RATHER THAN FIRED AND FORGOTTEN, so a send failure reaches the handler's own
  // catch and is logged. An unawaited promise here would reach no log at all — the shape
  // `.claude/rules/frontend.md` records for an unwrapped async IIFE, on the server side.
  if (creditOutcome && creditOutcome.credited) {
    await notifyReferralCredit(pool, { ...creditOutcome, contractorId, req: null });
  }

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
    // ⚠ `stage_derived_at` IS STAMPED ONLY WHEN A STAGE WAS ACTUALLY DECIDED, AND THE GUARD IS THE
    // WHOLE POINT OF THE COLUMN. This upsert runs whether or not the decision succeeded — it writes
    // identity from the FETCH — so an unconditional `NOW()` would claim a decision on every client
    // whose decision had just FAILED, and the catch-up job would then never find them. That is the
    // exact shape of the defect the split exists to make recoverable, reintroduced one column along.
    // ⚠ AND IT READS THE BARE PARAMETER, NOT `EXCLUDED.pipeline_stage`, FOR THE REASON 7b RECORDED:
    // on the conflict branch `EXCLUDED` carries whatever the INSERT's own expression produced, so
    // reading it is one COALESCE away from never being null. `$10` is the decision, and null means
    // "not decided this pass".
    `INSERT INTO jobber_clients
       (jobber_client_id, contractor_id, first_name, last_name, email, phone,
        is_company, is_lead, is_archived, pipeline_stage, stage_derived_at, last_synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             CASE WHEN $10::text IS NOT NULL THEN NOW() ELSE NULL END, NOW())
     ON CONFLICT (jobber_client_id, contractor_id) DO UPDATE SET
       stage_derived_at = CASE
         WHEN $10::text IS NOT NULL THEN NOW()
         ELSE jobber_clients.stage_derived_at
       END,
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
        fullClient = await _fetchFullClient(clientId, token, { door: 'client-create', contractorId });
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

      // ⚠ `captureClient` IS THE SAME OBJECT, PASSED SO THE REFERRAL DOOR CAPTURES WITHOUT A
      // SECOND FETCH (7b). fetchFullClient's result is already the connection shape
      // captureClientFacts needs; omitting it here would make syncSingleClient fetch this
      // very client again.
      await syncSingleClient(contractorId, fullClient, referralStartDate, [], token, { captureClient: fullClient });
      console.log(`[jobber-webhook] client-create sync complete for client: ${clientId}`);

      // Upsert into jobber_clients and derive tags. The former 'if (token)' guard
      // here is gone: a falsy token now returns above, so it was unreachable.
      // ⚠ A FAILED FETCH IS LOGGED AS A FAILURE, NOT PASSED ON AS AN ABSENCE. It used to
      // console.warn and return null, which upsertAndTagClient reads as "nothing observed" —
      // so a Jobber outage looked exactly like a client with no jobs and never reached
      // error_log. N5: this is why error_log rises after this ships.
      const relatedData = await _fetchClientRelatedData(clientId, token, { door: 'client-create', contractorId }).catch(async err => {
        await logError({
          req,
          contractorId,
          error: new Error(`[client-create] fetchClientRelatedData failed for ${clientId}: ${err.message}`),
          source: 'POST /webhooks/jobber/client-create — fetchClientRelatedData',
          alert: false,
        });
        return null;
      });
      await upsertAndTagClient(contractorId, fullClient, relatedData, 'client-create');

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
        fullClient = await _fetchFullClient(clientId, token, { door: 'client-update', contractorId });
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

      // ⚠ `captureClient` IS THE SAME OBJECT, PASSED SO THE REFERRAL DOOR CAPTURES WITHOUT A
      // SECOND FETCH (7b). fetchFullClient's result is already the connection shape
      // captureClientFacts needs; omitting it here would make syncSingleClient fetch this
      // very client again.
      await syncSingleClient(contractorId, fullClient, referralStartDate, [], token, { captureClient: fullClient });
      console.log(`[jobber-webhook] client-update sync complete for client: ${clientId}`);

      // Upsert into jobber_clients and derive tags. The former 'if (token)' guard
      // here is gone: a falsy token now returns above, so it was unreachable.
      // ⚠ Logged as a failure, never passed on as an absence — see client-create above.
      const relatedData = await _fetchClientRelatedData(clientId, token, { door: 'client-update', contractorId }).catch(async err => {
        await logError({
          req,
          contractorId,
          error: new Error(`[client-update] fetchClientRelatedData failed for ${clientId}: ${err.message}`),
          source: 'POST /webhooks/jobber/client-update — fetchClientRelatedData',
          alert: false,
        });
        return null;
      });
      await upsertAndTagClient(contractorId, fullClient, relatedData, 'client-update');

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
      // ⚠ PAID_STATUS, NOT isInvoicePaid, AND THE DISTINCTION IS REAL. The webhook PAYLOAD
      // carries a status and no amounts, so this cannot decide paid-ness — it only skips updates
      // that definitely are not. The authoritative decision is made below against the FETCHED
      // invoice. Using the shared constant keeps the literal out of this file without pretending
      // the payload can answer a question it has no data for.
      if (rawInvoiceStatus !== undefined && rawInvoiceStatus !== PAID_STATUS) {
        console.log(`[invoice-paid] raw invoiceStatus is '${rawInvoiceStatus}' — skipping`);
        return;
      }

      // ── (b) CLAIM THE DELIVERY (Danny, ruled 2026-10-01, built after C2) ─────────────
      //
      // ⚠ THIS DOOR WAS THE ONLY ONE THAT CLAIMED NOTHING, AND THAT IS HOW THE C1 LAUNCH-GATE CAME TO
      // BE ANSWERED FROM LOGS RATHER THAN FROM THE DATABASE. `claimWebhookDelivery` had exactly two
      // call sites — the request and stage handlers — so `jobber_webhook_events` returned **0 rows for
      // `topic ILIKE '%INVOICE%'` across 5,379 events since 2026-09-18**. ⚠ A zero from a table that
      // structurally cannot hold the row is not an observation, and it was checked only because the
      // figure looked too clean.
      //
      // ⚠ WHAT THIS CHANGES AND WHAT IT DOES NOT, STATED PLAINLY SO NOBODY OVERREADS IT:
      //   · IT ADDS a durable record that this door ran, and it makes a duplicate delivery skip HERE —
      //     before the engagement-settings read, before the invoice fetch, before the client fetch,
      //     before the capture, before the decision and before the credit. Measured cost of the old
      //     behaviour: a duplicate re-ran TWO Jobber round trips and a full re-capture.
      //   · IT DOES NOT make this door exactly-once, and it is NOT what stands between us and a double
      //     payout. The money idempotence is `referral_conversions`' UNIQUE(user_id, jobber_client_id)
      //     plus `evaluateReferral`'s STEP 8; the email is gated on a row being INSERTED. Both are
      //     unchanged. CLAUDE.md records that the worst case of a redelivery is a duplicate EMAIL,
      //     never a duplicate credit — and that was already prevented.
      //
      // ⚠ IT FAILS OPEN BY DESIGN. With no usable `occurred_at` there is no key that separates a
      // duplicate delivery from a legitimate second event, so `claimWebhookDelivery` returns
      // `{ claimed: true, keyed: false }` and the work proceeds. **Adding this must not be read as
      // making the door exactly-once**, which is why the inert case is LOGGED rather than assumed away.
      //
      // ⚠ PLACED AFTER THE CHEAP STATUS EXIT, NOT BEFORE IT, AND THE REASON IS THE TABLE'S SIZE. Jobber
      // sends INVOICE_UPDATE for every status change, each with its own `occurred_at`, so claiming
      // before the exit would write a row for every draft, sent and awaiting-payment transition this
      // door deliberately ignores. Only an actionable delivery is recorded.
      //
      // ⚠ AND THE TOPIC LITERAL IS THIS DOOR'S OWN. Pointing a new route's literal at an existing
      // topic is a defect this repo has already measured: the quote-approved commit aimed its key at
      // `'quote-update'` and a real QUOTE_APPROVED was swallowed under a log line calling it a
      // duplicate. `'invoice-paid'` shares its key with nothing.
      const deliveryItemId = payload?.data?.webHookEvent?.itemId;
      if (deliveryItemId) {
        const claim = await claimWebhookDelivery(
          contractorId, 'invoice-paid', deliveryItemId, webhookOccurredAt(payload));
        if (!claim.claimed) {
          // diagnostic log — intentional
          // ⚠ THE TWO SIBLING DOORS' IDENTICAL LINES CARRY NO SUCH MARKER, which is a pre-existing gap
          // against CLAUDE.md's `console.log` rule rather than something this commit should quietly
          // sweep up. Marked here so the NEW line complies; the other two are noted, not touched.
          console.log(`[invoice-paid] duplicate delivery for invoice ${deliveryItemId} — already claimed, skipping`);
          return;
        }
        if (!claim.keyed) {
          // Recorded once per delivery rather than never: an absent occurred_at makes the dedupe above
          // inert, which is exactly the silently-disabled mechanism this codebase files under "reports
          // health it cannot observe".
          await logError({
            req: null,
            contractorId,
            error: new Error(`[invoice-paid] webhook carried no occurredAt/occuredAt — delivery dedupe inert for invoice ${deliveryItemId}`),
            source: 'POST /webhooks/jobber/invoice-paid — dedupe key',
            alert: false,
          });
        }
      }
      // ⚠ A MISSING itemId IS DELIBERATELY NOT CLAIMED AND NOT HANDLED HERE. STEP 3 below already
      // detects it, writes an `error_log` row and alerts an admin; duplicating that check would mean
      // two places deciding what a payload without an invoice id means.

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
      // ⚠ THE ONE DEFINITION (4a). This is the AUTHORITATIVE check — the payload pre-filter
      // above is only a cheap early exit — so it decides whether a referral is evaluated at all.
      if (!isInvoicePaid(invoiceWithJobs)) {
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

      const fullClient = await _fetchFullClient(clientId, token, { door: 'invoice-paid', contractorId });
      const clientName = (`${fullClient.firstName || ''} ${fullClient.lastName || ''}`).trim();
      const clientEmail = fullClient.emails?.[0]?.address || null;
      const clientPhone = fullClient.phones?.[0]?.number || null;

      // ── THE REFERRAL-SOURCE FIELD, THROUGH THE ONE SHARED RESOLVER (Commit B) ─────────────
      //
      // ⚠ THE HARDCODED LITERAL IS GONE. This read was
      // `f.label && f.label.toLowerCase() === 'referred by'`, which ignored
      // `contractor_crm_settings.referrer_field_name` entirely — so the setting was stored, edited,
      // returned in the adapter config, and read by nothing. A contractor who typed any other name had
      // a setting that was accepted, echoed back and inert, on the money path.
      //
      // ⚠ AND IT IS THE SAME FUNCTION `pipelineSync.getReferredByValue` CALLS. Two sites each spelling
      // their own `.find()` is how they drift; a test drives both against one fixture and asserts they
      // agree. Matching is by CONFIGURATION ID when a field is picked, because Accent has NINE client
      // configurations and one of them is `Referred by Chuck Rigdon` — a prefix match finds two.
      const referralSourceField = await resolveReferralSourceField(pool, contractorId);
      const referredBy = readReferredByValue(fullClient.customFields, referralSourceField);

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
          const relatedData = await _fetchClientRelatedData(clientId, token, { door: 'invoice-paid', contractorId }).catch(async err => {
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
            // ⚠ THE FIFTH CALLER OF THE REFERRED-STATUS DERIVATION (N4 commit 7b, Danny's ruling).
            // A paid invoice moves the referrer-visible stage, and this door previously wrote only
            // `jobber_clients.pipeline_stage` — which is exactly how a referrer sat at
            // "Inspection Completed" for four months against an invoice settled in May.
            await upsertAndTagClient(contractorId, clientShell, relatedData, 'invoice-paid',
              { alsoDeriveReferredStatus: true });
          }
        } catch (tagErr) {
          await logError({ req, error: tagErr, contractorId, source: 'POST /webhooks/jobber/invoice-paid — upsertAndTagClient' });
        }
      })();

      // ── STEP 9 — RETIRED. THE CREDIT NOW HAPPENS FROM FACTS, INSIDE THE LOCK (C1) ──────────
      //
      // ⚠ 170 LINES OF LIVE-OBJECT EVALUATION USED TO SIT HERE, AND RETIRING THEM IS 7d RULING 5.
      // They called `evaluateReferral(contractorId, invoiceWithJobs, referredBy)` against the LIVE
      // invoice object this handler had just fetched, then wrote the conversion, the activity-log
      // line, the 'Active Referrer' tag and both emails inline.
      //
      // ⚠ WHY IT HAD TO GO RATHER THAN BE LEFT AS A SECOND PATH: it was the ONLY path that could
      // credit, so a client that became paid by any other route — the sync, a stage webhook, the
      // catch-up job, a re-capture — reached 'paid' on the referrer's own screen and was never
      // credited at all. And leaving it beside the fact-driven credit would mean TWO evaluators of
      // one money question, which is the shape this repo has already paid for twice (the cash-out
      // balance, the speculative payout ladder).
      //
      // ⚠ EVERYTHING IT DID STILL HAPPENS, IN ONE PLACE EACH, AND THIS LIST IS THE REVIEWABLE PART:
      //   · the gates              → `evaluateReferral`, unchanged, now fed an invoice built from facts
      //   · the conversion row     → `writeReferralConversion`, the single writer
      //   · the activity-log row   → `creditReferralFromFacts`, inside the same transaction
      //   · the Active Referrer tag → same, and now INSIDE the transaction rather than
      //                              fire-and-forget on the pool, so it cannot land for a credit that
      //                              rolled back
      //   · both emails (#4 bonus, #13 first milestone) → `notifyReferralCredit`, after the lock
      //
      // ⚠ AND THE CATEGORY CHANGED SOURCE, WHICH IS THE ONE BEHAVIOURAL DIFFERENCE WORTH NAMING.
      // This block scanned the live invoice's jobs for a field matching the mapped LABEL. Three live
      // configurations share the label "Job Type" across ALL_JOBS, ALL_INVOICES and ALL_QUOTES, so a
      // label scan can read quote vocabulary onto a job-reading schedule. The fact path resolves it
      // through `categorySource`, which follows the configuration LINK: the invoice's own copy first,
      // then the job, then the linked quote.
      //
      // ⚠ `referredBy` AND `invoiceWithJobs` ARE STILL READ ABOVE AND ARE STILL USED — by the
      // experience flow and by the pending-referral matcher. Do not delete them as orphans.

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
      const relatedData = await _fetchClientRelatedData(clientId, token, { door: 'job-update', contractorId }).catch(async err => {
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
        await upsertAndTagClient(contractorId, clientShell, relatedData, 'job-update');
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
// ── R5j — AN APPROVAL RUNS THE ENGINE, NOT ONLY THE STAGE ────────────────────
//
// ⚠ QUOTE_APPROVED WAS STAGE-ONLY UNTIL COMMIT 5, AND THAT WAS THE GAP. An approved quote is the
// strongest signal a client has a salesperson, and until then it moved a display column and
// nothing else — the sticky was written only when a REQUEST happened to fire.
//
// ⚠ THE ANCHOR IS THE QUOTE'S OWN approved_at, READ BACK FROM THE FACTS JUST CAPTURED. Not NOW(),
// which would drift with delivery lag, and not the client's createdAt — the request path anchors
// on the triggering request's createdAt (R2) and this is the same rule applied to the triggering
// quote.
//
// ⚠ IT TAKES `tx` AND EVERY READ AND WRITE USES IT (7b). Called with the pool, the anchor read
// would miss the capture in this very transaction — the quote fact whose approved_at it is
// looking for — and the engine's writes would land outside the lock. Both would look right.
//
// ⚠ IT SWALLOWS ITS OWN FAILURE, AND THAT IS R5j'S "ISOLATED" RULING SURVIVING THE MOVE INSIDE
// THE LOCK. The ruling is that an engine failure leaves the stage standing. While the engine ran
// on the pool, position gave that for free; inside one transaction a throw would roll the stage
// back with it, so the catch is what preserves the ruling now. It is deliberately NOT a rethrow.
async function runApprovalEngine(tx, { req, contractorId, jobberClientId, itemId, topic, currentStatus, client }) {
  try {
    const { rows: qRows } = await tx.query(
      `SELECT approved_at FROM crm_quote_facts
        WHERE contractor_id = $1 AND jobber_quote_id = $2`,
      [contractorId, itemId]
    );
    const referralAnchor = qRows[0]?.approved_at || null;
    await runAttributionEngine(tx, {
      contractorId,
      jobberClientId,
      currentStatus,
      client,
      // ⚠ BOUND TO `tx` — see server/utils/requestFacts.js. A pool-bound reader would not see
      // the request facts captured moments ago in this transaction.
      readRequests: makeRequestReader(tx, contractorId),
      referralAnchor,
      // R3, as on the request path — an unresolved client records NOTHING.
      writeOrphanOnMiss: false,
      logError,
    });
    console.log(`[${topic}] engine ran for client ${jobberClientId} (anchor ${referralAnchor || 'none'})`);
  } catch (engErr) {
    await logError({
      req,
      contractorId,
      error: new Error(`[${topic}] stage written but attribution engine failed for client ${jobberClientId}: ${engErr.message}`),
      source: `POST /webhooks/jobber/${topic} — attribution engine`,
      alert: false,
    });
  }
}

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
      relatedData = await _fetchClientRelatedData(jobberClientId, token, { door: topic, contractorId });
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

    // ⚠ CAPTURE, THEN DECIDE (Commit 5) — was `classifyPipelineStatus(relatedData)`, a decision
    // from the live fetch. A failed capture writes NO stage and returns (rule 2): this handler's
    // entire job is the decision, so unlike upsertAndTagClient there is nothing else to preserve.
    // ⚠ CAPTURE, DECIDE AND THE STAGE WRITE ARE ONE LOCKED TRANSACTION (Commit 6), keyed on
    // (contractor, client). Unlike upsertAndTagClient there is nothing here that is not part of
    // the decision, so the UPDATE goes inside the lock too — which is what makes a concurrent
    // event unable to observe facts written but not yet decided from.
    // ⚠ THE JOBBER FETCHES ARE ABOVE AND STAY OUTSIDE THE LOCK. See server/utils/clientLock.js.
    // ⚠ AND ON quote-approved THE ENGINE IS NOW INSIDE IT (7b), WHERE IT USED TO RUN BELOW ON THE
    // POOL. The engine called fetchAttributionData — a Jobber round trip — which is the only
    // reason it had to stay out; its request list now comes from the facts captured two lines
    // above, in this same transaction. That makes the client_rep_assignments write atomic with
    // the capture and the stage, so a concurrent event cannot decide from facts this one has
    // written but not yet acted on.
    // ⚠ R5j'S "ISOLATED" RULING IS PRESERVED BY THE INNER try/catch, NOT BY POSITION. It said an
    // engine failure must leave the stage standing rather than rolling the handler into its
    // catch. Inside one transaction, a throw would roll back the stage too — so the engine call
    // catches its own failure, records it, and lets the transaction commit the capture and the
    // stage. The ruling is about what survives an engine failure, and that is unchanged.
    let stage, result;
    try {
      ({ stage, result } = await withClientLock(pool, { contractorId, jobberClientId, door: topic }, async (tx) => {
        await captureClientFacts(tx, { contractorId, client: relatedData });
        const decided = await decideFromFacts(tx, { contractorId, jobberClientId });
        // ⚠ UPDATE ONLY. See the block at the top of this section: a zero-row result is the
        // expected quiet outcome for a client the sync has not mirrored yet, not an error.
        const upd = await tx.query(
          `UPDATE jobber_clients
              SET pipeline_stage = $3
            WHERE contractor_id = $1 AND jobber_client_id = $2`,
          [contractorId, jobberClientId, decided.currentStatus]
        );
        if (topic === 'quote-approved') {
          await runApprovalEngine(tx, {
            req, contractorId, jobberClientId, itemId, topic,
            currentStatus: decided.currentStatus, client: decided.client,
          });
        }
        return { stage: decided.currentStatus, result: upd };
      }));
    } catch (capErr) {
      await logError({
        req,
        contractorId,
        error: new Error(`[${topic}] ${itemId} -> client ${jobberClientId}: capture failed, no stage written: ${capErr.message}`),
        source: `POST /webhooks/jobber/${topic} — capture`,
        alert: false,
      });
      return;
    }
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
  // Commit 3c — the invoice fetch's own three queries, so the paging tests read the REAL text.
  INVOICE_WITH_JOBS_QUERY,
  INVOICE_JOBS_PAGE_QUERY,
  INVOICE_ARCHIVED_JOBS_PAGE_QUERY,
};
// ⚠ THE REAL DOOR, exported for the capture/decision split's BEHAVIOURAL guard-proof. Inert in
// production — nothing outside server/test/ reads it.
//
// ⚠ IT IS THE ACTUAL FUNCTION, NOT AN INDIRECTION SEAM, AND THAT DISTINCTION MATTERS HERE. Commit 3
// DELETED two `_`-prefixed seams because a seam's `(...args) =>` default forwards arguments with no
// literal for a fence to read, and because the failure they existed to inject was reachable at the
// axios layer anyway. This is the opposite shape: the same reasoning as `_captureFetches` directly
// above — the test must drive the REAL capture-then-decide path, because a test that reimplements the
// split cannot discover that production no longer does it.
//
// ⚠ AND WITHOUT IT, DANNY'S FIRST GUARD-PROOF HAS NO BEHAVIOURAL CASE. Measured: restoring the shared
// transaction reddened only a SOURCE assertion — width 1 — which proves the shape is written, never
// that a decision failure leaves the facts behind. That is the entire property of the ruling.
router._upsertAndTagClient = upsertAndTagClient;

// The per-entity field selections, for the mechanical reads-vs-selects fence. Separate from the
// queries above because a whole-query check passes when a field appears anywhere in it.
router._captureFields = {
  RELATED_JOB_FIELDS,
  RELATED_INVOICE_FIELDS,
  RELATED_QUOTE_FIELDS,
};
