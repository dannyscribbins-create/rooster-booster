'use strict';

// ── REQUEST BACKFILL SWEEP (Canvass-3.7 safety net) ──────────────────────────
//
// WHY THIS EXISTS ALONGSIDE THE WEBHOOKS RATHER THAN INSTEAD OF THEM. Webhooks are the
// trigger (ruling R1) and this is the net under them, for two failures they cannot cover:
//   1. A MISSED DELIVERY. Jobber gives at-least-once delivery, which is a promise about
//      duplicates, not about never dropping one. A webhook lost while the service is
//      redeploying is lost permanently — nothing re-sends it.
//   2. REQUESTS THAT PREDATE THE SUBSCRIPTION. Accent has an existing book of requests
//      that will never fire a REQUEST_CREATE, because they were created before the topic
//      was subscribed at all. Without this sweep those clients are invisible to rep
//      attribution forever.
//
// ⚠ IT DRIVES THE SAME PATH — attributeFromRequest() — so R2's anchor and R3's silence
// apply identically here. A sweep with its own attribution logic would be a second engine
// that drifts; this one is a second DOOR to the same engine.
//
// CADENCE: hourly, on a cron, not on demand. A net that only runs when someone remembers
// to run it is not a net. Hourly is affordable — a contractor with no request activity in
// the last hour costs exactly one GraphQL call that returns zero nodes.

const cron = require('node-cron');
const { withLock } = require('../withLock');
const { pool } = require('../../db');
const { logError } = require('../../middleware/errorLogger');
const {
  getFreshContractorAccessToken,
  fetchRequestsUpdatedSince,
  fetchAttributionData,
} = require('../../crm/jobber');
const { attributeFromRequest } = require('../../utils/requestAttribution');
const { fetchFullClient } = require('../../utils/jobberClientFetch');

// How far back a contractor's FIRST-EVER sweep reaches. A NULL watermark means "never
// swept", never "sweep from the epoch" — an unbounded first run against a long-lived
// Jobber account is the one shape that could actually exhaust the API budget.
// ⚠ This does NOT backfill Accent's full history, and it is not meant to. A wider
// historical backfill is a separate, deliberate, on-demand job — filed, not built here.
const INITIAL_LOOKBACK_DAYS = 30;

// Hard page cap. 50 nodes per page, so 20 pages is 1000 requests in one run.
// ⚠ HITTING THE CAP IS A FAILURE, NOT A CLEAN STOP, and it is treated as one below:
// stopping early and advancing the watermark past requests we never looked at is exactly
// the silent loss this job exists to prevent. Same reasoning as Canvass-3.6's unbounded
// paging loop, with the sign flipped — there the danger was no cap, here it is a cap that
// pretends the run finished.
const MAX_PAGES = 20;

// Overlap subtracted from the watermark when it advances. Our clock and Jobber's are not
// the same clock, and `filter: { updatedAt: { after } }` is evaluated against theirs.
// Ten minutes of deliberate re-processing costs nothing — every write downstream is
// idempotent — and covers skew that would otherwise drop a request into the gap between
// two runs.
const WATERMARK_OVERLAP_MS = 10 * 60 * 1000;

// ── TEST SEAM ────────────────────────────────────────────────────────────────
// inert in production, never called outside server/test/
let _fetchRequestsUpdatedSince = fetchRequestsUpdatedSince;
let _fetchFullClient           = fetchFullClient;
let _fetchAttributionData      = fetchAttributionData;
let _getToken                  = getFreshContractorAccessToken;

// test seam — inert in production, never called outside server/test/
function _setTestOverrides({ fetchRequestsUpdatedSince: a, fetchFullClient: b, fetchAttributionData: c, getToken: d } = {}) {
  if (a !== undefined) _fetchRequestsUpdatedSince = a;
  if (b !== undefined) _fetchFullClient           = b;
  if (c !== undefined) _fetchAttributionData      = c;
  if (d !== undefined) _getToken                  = d;
}
// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() {
  _fetchRequestsUpdatedSince = fetchRequestsUpdatedSince;
  _fetchFullClient           = fetchFullClient;
  _fetchAttributionData      = fetchAttributionData;
  _getToken                  = getFreshContractorAccessToken;
}

// Sweeps one contractor's requests updated since its watermark.
//
// Returns { swept, attributed, advanced, reason } — `advanced` is the whole point of the
// return value and every test in this file's watermark section reads it.
//
// ⚠ THE WATERMARK ADVANCES ON EXACTLY ONE CONDITION: the paging loop ran to exhaustion
// AND every request in it was processed without throwing. Any other exit — a GraphQL
// schema error, a lost token, the page cap, a single request that blew up — returns with
// `advanced: false` and the column untouched, so the next run re-covers the same window.
// A watermark advanced on failure loses every request in the skipped window, silently and
// permanently, which is the failure mode this whole job exists to prevent. Re-covering a
// window costs duplicated idempotent work and nothing else.
async function sweepContractor(contractorId) {
  // The run's start instant is captured BEFORE the first fetch, never after. A request
  // updated while the sweep is in flight must fall inside the NEXT window, not be skipped
  // because the watermark was stamped with a time later than the data we actually read.
  const runStartedAt = new Date();

  const { rows: settingsRows } = await pool.query(
    `SELECT request_sweep_watermark FROM contractor_crm_settings WHERE contractor_id = $1`,
    [contractorId]
  );
  if (settingsRows.length === 0) {
    return { swept: 0, attributed: 0, advanced: false, reason: 'no_crm_settings' };
  }

  const watermark = settingsRows[0].request_sweep_watermark
    ? new Date(settingsRows[0].request_sweep_watermark)
    : new Date(Date.now() - INITIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  let token;
  try {
    token = await _getToken(contractorId);
  } catch (tokenErr) {
    await logError({
      req: null,
      contractorId,
      error: new Error(`repRequestSweep: no usable Jobber token for ${contractorId} — sweep skipped: ${tokenErr.message}`),
      source: 'repRequestSweep — token',
    });
    return { swept: 0, attributed: 0, advanced: false, reason: 'no_token' };
  }

  const since = watermark.toISOString();
  let cursor = null;
  let hasNextPage = true;
  let pageNo = 0;
  let swept = 0;
  let attributed = 0;

  while (hasNextPage) {
    if (pageNo >= MAX_PAGES) {
      await logError({
        req: null,
        contractorId,
        error: new Error(`repRequestSweep: page cap (${MAX_PAGES}) reached for ${contractorId} since ${since} — watermark NOT advanced, run is incomplete`),
        source: 'repRequestSweep — page cap',
      });
      return { swept, attributed, advanced: false, reason: 'page_cap' };
    }
    pageNo += 1;

    // Re-acquired per page for the same reason jobberIncrementalSync does it: a
    // concurrent refresh rotates the token and every later page would present a dead
    // credential. The single-flight guard protects rotation, not reads.
    try {
      token = await _getToken(contractorId);
    } catch (tokenErr) {
      await logError({
        req: null,
        contractorId,
        error: new Error(`repRequestSweep: lost the Jobber token while paging (page ${pageNo}) — ${swept} requests seen: ${tokenErr.message}`),
        source: 'repRequestSweep — token',
      });
      return { swept, attributed, advanced: false, reason: 'token_lost' };
    }

    let page;
    try {
      page = await _fetchRequestsUpdatedSince(since, token, cursor);
    } catch (fetchErr) {
      // ⚠ A SCHEMA ERROR LANDS HERE AND MUST NOT DEGRADE TO AN UNFILTERED SWEEP.
      // `Request.updatedAt` and RequestFilterAttributes.updatedAt were observed in the
      // explorer at version 2026-05-12, which since the 2-pre bump is the version our
      // client pins — so their presence is no longer the open question it was. The guard
      // stays: if they are ever absent this is where we find out, and the correct outcome
      // is a loud recorded failure with the watermark untouched — not a full-history scan.
      await logError({
        req: null,
        contractorId,
        error: new Error(`repRequestSweep: request fetch failed on page ${pageNo} since ${since}: ${fetchErr.message}`),
        source: 'repRequestSweep — fetchRequestsUpdatedSince',
      });
      return { swept, attributed, advanced: false, reason: 'fetch_failed' };
    }

    for (const request of page.nodes) {
      swept += 1;
      try {
        const outcome = await attributeFromRequest(pool, {
          contractorId,
          request,
          fetchFullClient: _fetchFullClient,
          fetchAttributionData: _fetchAttributionData,
          token,
        });
        if (outcome === 'attributed') attributed += 1;
      } catch (err) {
        // One bad request must not advance the watermark past the rest of the window.
        await logError({
          req: null,
          contractorId,
          error: new Error(`repRequestSweep: request ${request.id} failed: ${err.message}`),
          source: 'repRequestSweep — attribute',
        });
        return { swept, attributed, advanced: false, reason: 'attribute_failed' };
      }
    }

    hasNextPage = page.hasNextPage;
    cursor = page.endCursor;
    if (hasNextPage && !cursor) break; // defensive: no cursor means no next page to ask for
  }

  // ── THE ONLY PLACE THIS COLUMN IS WRITTEN ────────────────────────────────────
  const advanceTo = new Date(runStartedAt.getTime() - WATERMARK_OVERLAP_MS);
  await pool.query(
    `UPDATE contractor_crm_settings SET request_sweep_watermark = $2 WHERE contractor_id = $1`,
    [contractorId, advanceTo]
  );

  return { swept, attributed, advanced: true, reason: 'ok' };
}

async function runRepRequestSweep() {
  const { rows: contractorRows } = await pool.query(
    'SELECT id FROM contractors WHERE status = $1',
    ['active']
  );
  for (const { id: contractorId } of contractorRows) {
    try {
      const result = await sweepContractor(contractorId);
      console.log(`[repRequestSweep] ${contractorId}: ${result.swept} swept, ${result.attributed} attributed, watermark ${result.advanced ? 'advanced' : 'HELD'} (${result.reason})`);
    } catch (err) {
      // One contractor's failure must not stop the others.
      await logError({ req: null, contractorId, error: err, source: 'repRequestSweep — contractor' });
    }
  }
}

function startRepRequestSweepJob() {
  // Hourly, at :20 — deliberately off the top of the hour so it does not contend with
  // the 30-minute pipeline sync.
  cron.schedule('20 * * * *', () => withLock('rep_request_sweep', 20, async () => {
    await runRepRequestSweep();
  }));
  console.log('[cron] repRequestSweep registered (hourly at :20)');
}

module.exports = {
  startRepRequestSweepJob,
  // test seam — inert in production, never called outside server/test/
  runRepRequestSweep,
  sweepContractor,
  _setTestOverrides,
  _resetTestOverrides,
  INITIAL_LOOKBACK_DAYS,
  MAX_PAGES,
  WATERMARK_OVERLAP_MS,
};
