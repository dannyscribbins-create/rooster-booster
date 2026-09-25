'use strict';

// ── SHARED FULL-CLIENT FETCH ─────────────────────────────────────────────────
// Extracted from server/routes/webhooks/jobber.js in Canvass-3.7, unchanged.
//
// ⚠ RELOCATED VERBATIM. The function body below — query text, selection set, retry
// options, error message — is byte-for-byte what lived in the webhook router, per
// CLAUDE.md's rule that a relocation must be mechanically checkable and must never carry
// a correction in the same commit. Nothing was "tidied" on the way across. The webhook
// router now imports it from here and keeps its own `_fetchFullClient` test seam around it.
//
// WHY IT MOVED: server/cron/jobs/repRequestSweep.js needs the same fetch, and a cron job
// importing a route file is the wrong direction — routes may import utils, never the
// reverse. The alternative was a second copy of this query, which is precisely what
// CLAUDE.md's "duplicate logic must be extracted to a shared utility" forbids, and a
// selection set duplicated across two files is one of the cheaper ways to ship a client
// object that is missing a field its consumer silently defaults.

const axios = require('axios');
const { retryWithBackoff } = require('./retryWithBackoff');
const { jobberShouldRetry } = require('./retryHelpers');

// Fetches complete client data from Jobber by ID, including quotes/jobs/invoices
// needed for accurate pipeline status classification. Called from webhook handlers
// so classifyPipelineStatus gets full data rather than the sparse webhook payload.
//
// ⚠ `createdAt` ON THE JOB NODES IS LOAD-BEARING AND WAS MISSING UNTIL CANVASS-STAGE.
// This selection read `id jobStatus` only, which made it the ONE fetch of four that
// could not date a sale — and it is the fetch the REQUEST path and repRequestSweep use.
// The gap was found by asking the question per writer rather than once: the webhook
// router's fetchClientRelatedData, jobberIncrementalSync's GetClientRelated and
// fullJobberImport's Step C all carried it; this did not.
// ⚠ The field is PROVEN at 2026-05-12 — those three shipped queries select
// `job.createdAt` under that exact version header, it was equally proven at the previous
// pin 2026-02-17, and Danny's 2026-05-12 introspection lists `createdAt` on the Job type —
// so this is not a 3.6b-style unknown-field risk, where a field absent at our version
// fails the WHOLE query.
// ⚠ `first: 10` IS STILL A CAP, AND IT IS NOT ENOUGH FOR SALE GROUPING. Dating one
// sale needs only the earliest job; grouping sales needs EVERY job, and a client with
// more than ten silently loses some. See PRE_LAUNCH_CHECKLIST.md on paging jobs
// oldest-first — this line fixes the missing FIELD, not the cap.
async function fetchFullClient(clientId, token) {
  const response = await retryWithBackoff(
    () => axios.post(
      'https://api.getjobber.com/api/graphql',
      {
        query: `query GetClient($id: EncodedId!) {
          client(id: $id) {
            id firstName lastName createdAt isArchived
            customFields { ... on CustomFieldText { label valueText } }
            phones { number description }
            emails { address description }
            quotes(first: 10) { nodes { id quoteStatus lastTransitioned { approvedAt } salesperson { id } } }
            jobs(first: 10) {
              nodes {
                id jobStatus createdAt
                invoices(first: 5) { nodes { invoiceStatus } }
              }
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

  if (!response.data?.data?.client) {
    throw new Error(`fetchFullClient: no client returned for id ${clientId}`);
  }
  return response.data.data.client;
}

module.exports = { fetchFullClient };
