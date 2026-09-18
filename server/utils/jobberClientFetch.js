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
                id jobStatus
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
          'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
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
