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
// ⚠ classifyPipelineStatus IS GONE FROM THIS FILE (3d Phase 1a Commit 5). It decided from the
// LIVE FETCH; the decision now comes from decideFromFacts, which reads only saved facts, so the
// live door and the replay run the same code over the same rows (R5i). Re-importing it here
// would reintroduce a second definition of "what stage is this client".
const { captureClientFacts } = require('./factCapture');
const { decideFromFacts } = require('./attributionDecide');
const { withClientLock } = require('./clientLock');
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
    fullClient = await fetchFullClient(jobberClientId, token, { door: 'request-attribution', contractorId });
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

  // ── CAPTURE, THEN DECIDE (3d Phase 1a Commit 5) ─────────────────────────────
  //
  // ⚠ THE ORDER IS THE MECHANISM, NOT A PREFERENCE. decideFromFacts reads SAVED rows, so the
  // facts this event brought must be on disk before it runs. Reversed, a first-ever request
  // decides against an empty fact set and gets 'lead' — which is in the engine's
  // GATE_EXCLUSIONS, so the sticky gate is SKIPPED and nothing is attributed. That failure is
  // silent and self-consistent: the next event sees a stored answer and has no reason to look.
  //
  // ⚠ AND A FAILED CAPTURE MEANS NO DECISION AT ALL (rule 2). Not a 'lead', not a best effort.
  // The fact tables may be partially written or stale, and a decision taken from them would be
  // confidently wrong. Returning here leaves the client untouched; the next REQUEST_UPDATE or
  // the hourly sweep retries, and the row in error_log says why it has not happened yet.
  // ⚠ CAPTURE, DECIDE AND THE STAGE WRITE ARE ONE LOCKED TRANSACTION (Commit 6).
  // They are three steps over shared state, so two events for the SAME client could interleave:
  // capture A writes half its facts, decide B reads them, and B stores a decision taken from a
  // fact set that never existed. The advisory lock is keyed on (contractor, client), so different
  // clients never wait on each other — see server/utils/clientLock.js for why it is a DATABASE
  // lock rather than an in-process queue.
  // ⚠ THE JOBBER FETCH IS ABOVE THIS BLOCK AND STAYS THERE. Holding a pooled connection across a
  // network call to Jobber would exhaust the pool on a slow Jobber rather than delaying one
  // client, and runAttributionEngine below calls fetchAttributionData — which is a Jobber fetch,
  // so the engine stays OUTSIDE the lock for the same reason.
  let currentStatus, factClient;
  try {
    ({ currentStatus, factClient } = await withClientLock(pool, { contractorId, jobberClientId, door: 'request-attribution' }, async (tx) => {
      await captureClientFacts(tx, { contractorId, client: fullClient });
      // ⚠ `tx`, NOT `pool`. Passing the pool here would run the read on a DIFFERENT connection,
      // outside the transaction and outside the lock — it would look serialised and not be.
      const decided = await decideFromFacts(tx, { contractorId, jobberClientId });
      await writeStage(tx, contractorId, jobberClientId, decided.currentStatus);
      return { currentStatus: decided.currentStatus, factClient: decided.client };
    }));
  } catch (capErr) {
    await logError({
      req: null,
      contractorId,
      error: new Error(`[request-attribution] request ${request.id}: capture failed for client ${jobberClientId}, no decision written: ${capErr.message}`),
      source: 'requestAttribution/capture',
      alert: false,
    });
    return 'capture_failed';
  }

  // ⚠ currentStatus AND client BOTH COME FROM THE FACTS, AND THAT PAIRING IS WHAT R5i MEANS.
  // attributionReplay.js destructures this exact call and hands both to the engine the same
  // way; taking the status from facts while passing the LIVE client would give the replay and
  // the live door two different engine inputs from one set of rows, which is the parity the
  // fence in this arc exists to hold.
  // decided inside the locked transaction above, together with the stage write

  // ── THE STAGE WRITE (Canvass-stage Part 2; the seventh zero REVERSED) ───────
  //
  // ⚠ THIS PATH DELIBERATELY WRITES A STAGE, AND A TEST PREVIOUSLY FORBADE IT.
  // Canvass-stage shipped a "seventh zero" on the TWO-PIPELINES fence asserting the
  // request path wrote no stage. Danny REVERSED that the same day, and the reason is
  // the rep's experience: rep attribution STARTS at the request, so without this a rep
  // sees a newly assigned client carrying no stage at all. Writing it here gives them
  // 'lead' the moment the client enters their book, and it progresses from there.
  //
  // ⚠ IT DOES NOT BREACH THE FENCE, AND THE DISTINCTION IS THE WHOLE RULING. The fence
  // exists to stop this path SENDING anything and to stop it writing the REFERRER
  // pipeline. A stage on jobber_clients is neither: it sends nothing, and jobber_clients
  // is the whole-client table, not pipeline_cache. The other six zeros are unchanged and
  // still asserted, with their positive control.
  //
  // ⚠ FOR EVERY CLIENT, NOT ONLY NON-REFERRALS. The rep surface stores a stage for
  // everyone and reads jobber_clients only (Ruling 1) — a referred client skipped here
  // would read as unstaged on the rep's screen while its referral record said otherwise.
  //
  // ⚠ UPDATE ONLY — THIS PATH MUST NEVER CREATE A jobber_clients ROW. That is Danny's
  // guard, and it keeps row CREATION with the three writers that carry a full client
  // payload (the nightly sync, the full import, the client webhooks). A row conjured
  // from a stage alone would have no name, no email and no phone — the
  // `client_row_missing` state the rep list already has to render around — and this path
  // has no client payload to fill it with. If no row exists yet, nothing is written and
  // the next client-webhook or nightly sync supplies both the row and the stage.
  // ⚠ A zero-row UPDATE is the EXPECTED quiet outcome here, not an error to log.
  // ⚠ THE WRITE ITSELF MOVED INTO writeStage() AND RUNS INSIDE THE LOCK (Commit 6). The comment
  // block above is unchanged and still governs: UPDATE-only, a zero-row result is the expected
  // quiet outcome, and this path must never CREATE a jobber_clients row.

  await runAttributionEngine(pool, {
    contractorId,
    jobberClientId,
    currentStatus,
    client: factClient,
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

/**
 * Writes the decided stage. UPDATE-only, and a zero-row result is the expected quiet outcome.
 * Inputs: a transaction, the contractor, the client, the decided status.
 * Output: nothing.
 * ⚠ IT TAKES A TRANSACTION, NOT THE POOL, BECAUSE IT RUNS INSIDE THE PER-CLIENT LOCK. Called
 * with the pool it would write on another connection — outside the lock, and therefore able to
 * land between another event's capture and decide, which is the interleaving Commit 6 removes.
 */
async function writeStage(tx, contractorId, jobberClientId, currentStatus) {
  await tx.query(
    `UPDATE jobber_clients
        SET pipeline_stage = $3
      WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, jobberClientId, currentStatus]
  );
}

module.exports = { attributeFromRequest };
