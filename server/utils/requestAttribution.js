'use strict';

// ── REQUEST-DRIVEN REP ATTRIBUTION (Canvass-3.7) ─────────────────────────────
//
// THE TRIGGER IS A REQUEST BEING SAVED IN JOBBER, delivered as a REQUEST_CREATE or
// REQUEST_UPDATE webhook (ruling R1, Danny, 2026-09-18). It is NOT the client's
// updatedAt and it is NOT polling — measured live on Accent's account 2026-09-18,
// saving a request does not bump the CLIENT's updatedAt at all (client stayed
// 2026-09-14T14:48:58Z while a request created 2026-09-18T15:41:20Z appeared), so the
// client-driven incremental sync can never see a new request and a gate inside the
// existing client query would never have run.
//
// ⚠ WHY THIS MODULE EXISTS AT ALL, RATHER THAN A BRANCH INSIDE syncSingleClient.
// The TWO-PIPELINES ruling (2026-09-17) requires SEPARATE CHECKS: "Neither is nested
// inside the other, and neither early-returns out of the other." Today both pipelines
// run inside syncSingleClient, whose FIRST statement is `if (!referredBy) return;` —
// so the attribution engine is currently nested inside the referrer gate. Widening
// attribution by moving that gate would have put every client with a request through
// the outreach machinery sitting below it.
//
// THE SEPARATION IS STRUCTURAL, NOT CONDITIONAL: this module never calls
// syncSingleClient, never requires it for anything but the pure classifier, and has no
// import path to Resend, Twilio, pendingReferral or the notifications table. It cannot
// send anything because there is nothing here to send with. That is what the fence test
// (`requestAttribution.test.js`) pins, with a positive control proving the referral
// path still sends — because "nothing was sent" passes against a path that sends
// nothing to anybody.
//
// ⚠ THE ONE THING IT SHARES WITH THE REFERRAL PIPELINE IS runAttributionEngine, and
// that is deliberate: the quote-overrules-request precedence, the Mode A/B multi-
// assignee filter, the sticky rule and the co-assignment flag are all rules about
// attribution, not about referral, and duplicating them here would be two copies of
// the thing most expensive to get wrong. The one behaviour that DOES differ travels as
// an explicit named option — `writeOrphanOnMiss: false`, ruling R3 — rather than as a
// second engine.

const { runAttributionEngine } = require('./attributionEngine');
const { classifyPipelineStatus } = require('../crm/pipelineSync');
const { logError: realLogError } = require('../middleware/errorLogger');

// ── THE ANCHOR (ruling R2) ───────────────────────────────────────────────────
// The eligibility window centres on the TRIGGERING REQUEST'S OWN createdAt, so the
// anchor and the trigger are the same real-world event and "why is this client in my
// book" stays answerable. The referral pipeline's anchor (pipeline_cache.created_at)
// is untouched and unreachable from here — an ordinary client has no pipeline_cache
// row at all, which is why attribution with the referral anchor did not "run wide
// open" but resolved NOBODY, every time.
// ⚠ The recorded fallback if this proves too tight in practice is the CLIENT's
// createdAt (option B in the filed table). Do not switch to it without a ruling: it
// widens the window to effectively the client's whole history, at which point GRACE_MS
// stops protecting anything.

// Runs rep attribution for one Jobber request.
//
// Inputs:
//   pool           — pg Pool
//   contractorId   — resolved tenant; every write below is scoped to it
//   request        — { id, createdAt, client: { id } } from fetchRequestById or the sweep
//   deps           — { fetchFullClient, fetchAttributionData, token, logError }
//
// Output: a typed outcome string, for the caller's log line and for tests:
//   'attributed'     — the engine ran to completion
//   'no_client'      — the request carries no client id; nothing written
//   'client_fetch'   — the client could not be fetched; nothing written
//
// ⚠ 'attributed' means THE ENGINE RAN, not that a rep was found. Under R3 a request
// resolving to nobody writes nothing and is indistinguishable here from one that wrote
// a sticky — which is correct: an ordinary client with no identifiable rep is not an
// incident, and the caller must not log it as one.
async function attributeFromRequest(pool, { contractorId, request, fetchFullClient, fetchAttributionData, token, logError = realLogError }) {
  if (!contractorId) throw new Error('attributeFromRequest: contractorId is required');
  if (!request || !request.id) throw new Error('attributeFromRequest: request with an id is required');

  const jobberClientId = request.client && request.client.id ? request.client.id : null;
  if (!jobberClientId) {
    // Not an error condition worth alerting on — a request with no client is a shape we
    // do not attribute, and saying so is cheaper than a silent return.
    await logError({
      req: null,
      contractorId,
      error: new Error(`[request-attribution] request ${request.id} carries no client id — nothing attributed`),
      source: 'requestAttribution/no-client',
      alert: false,
    });
    return 'no_client';
  }

  // The engine's sticky gate reads quotes off the client object and classifyPipelineStatus
  // reads quotes AND jobs, so the full client is required — this is the same fetch the
  // client webhooks already use, reused rather than re-specified.
  let fullClient;
  try {
    fullClient = await fetchFullClient(jobberClientId, token);
  } catch (fetchErr) {
    await logError({
      req: null,
      contractorId,
      error: new Error(`[request-attribution] request ${request.id}: could not fetch client ${jobberClientId}: ${fetchErr.message}`),
      source: 'requestAttribution/client-fetch',
      alert: false,
    });
    return 'client_fetch';
  }

  const currentStatus = classifyPipelineStatus(fullClient);

  await runAttributionEngine(pool, {
    contractorId,
    jobberClientId,
    currentStatus,
    client: fullClient,
    fetchAttributionData,
    token,
    // R2 — the triggering request's own createdAt, never pipeline_cache.created_at.
    referralAnchor: request.createdAt,
    // R3 — an unresolved client records NOTHING: no assignment, no flagged_assignments
    // row, no admin_messages bell. When a rep is assigned later, REQUEST_UPDATE fires and
    // it attributes then (finding 3: assigning a rep DOES bump the request's updatedAt,
    // measured 15:41:20Z -> 20:05:17Z).
    // ⚠ Scoped to THIS path. The referral pipeline's orphan flag is unchanged — that flag
    // exists because a referral's credit is a money question.
    writeOrphanOnMiss: false,
    logError,
  });

  return 'attributed';
}

module.exports = { attributeFromRequest };
