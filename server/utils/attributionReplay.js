'use strict';

// ── HISTORICAL ATTRIBUTION REPLAY (Canvass-stage backfill, Danny 2026-09-21) ──
//
// Runs the EXISTING attribution engine over the history the full import stored in
// crm_request_facts / crm_quote_facts — with NO Jobber call. It is what makes mapping
// retroactive: an admin maps a team member to a Jobber user, and every client whose
// stored history names that user is attributed as if the mapping had existed all along.
//
// ⚠ A SECOND DOOR TO THE SAME ENGINE, NEVER A SECOND ENGINE. Every rule that decides
// who gets a client — quote-overrules-request precedence, Mode A/B, the grace window,
// the co-assignment flag, the sticky rule — lives in runAttributionEngine, and this file
// only assembles the engine's inputs from stored rows. Same reasoning as
// repRequestSweep.js, which is a second door for missed webhooks.
//
// THE REPLAY, AS APPROVED:
//   · for each stored request of a client, OLDEST FIRST;
//   · referralAnchor = that request's own createdAt (ruling R2 — the request path's anchor);
//   · the engine's request list = the client's stored requests created AT OR BEFORE that
//     request, NEWEST FIRST. ⚠ Newest-first is contractual — resolveModeAMatch takes
//     eligible[0] — and the "at or before" cut is what keeps a replayed request from seeing
//     requests that did not exist yet when it happened, which the live path never could;
//   · quotes from crm_quote_facts; currentStatus from jobber_clients.pipeline_stage;
//   · writeOrphanOnMiss: false (ruling R3 — an unresolved client records NOTHING).
//
// ⚠ STICKY IS EXISTING-WINS, AND THE ENGINE ALREADY ENFORCES IT. Its step 3 returns
// before doing anything when sticky_rep_id is set, and writeSticky carries
// `WHERE sticky_rep_id IS NULL`. So history can never overwrite a present assignment —
// this file adds no guard of its own, because a second guard is a second place for the
// rule to drift.
// ⚠ MAPPING IS RETROACTIVE; UNMAPPING IS NOT. Nothing here removes an assignment. A rep
// whose mapping is cleared keeps the clients they already hold until an admin reassigns.
//
// ⚠ AND IT SENDS NOTHING. This file has no import path to Resend, Twilio, pendingReferral
// or the notifications table, and it passes notifyAdminOnFlag: false so a co-assignment
// found in history lands in the Flagged queue WITHOUT ringing the admin bell (ruling 7).
// The fence in repImportScope.test.js counts that, with a positive control.

const { runAttributionEngine } = require('./attributionEngine');
const { classifyPipelineStatus } = require('../crm/pipelineSync');
const { logError: realLogError } = require('../middleware/errorLogger');

// ── STATUS, FOR THE ADMIN ──────────────────────────────────────────────────────
// In memory, per contractor, like the import's own importState. It answers "is a
// book being built right now, and what did the last one do" for the team screen.
// ⚠ It vanishes with the process — acceptable because the replay is idempotent and a
// restart mid-run only means the admin re-saves the mapping (or the next import runs it).
const replayStatus = new Map();

function getReplayStatus(contractorId) {
  return replayStatus.get(contractorId) || { state: 'idle' };
}

// One replay at a time per contractor. Two overlapping replays over the same clients
// are SAFE (the writes are idempotent) but would double the work and interleave the
// status object, so a later trigger waits for the earlier one.
const chains = new Map();

function toEngineRequest(row) {
  const ids = Array.isArray(row.assigned_jobber_user_ids) ? row.assigned_jobber_user_ids : [];
  return {
    id: row.jobber_request_id,
    createdAt: new Date(row.created_at).toISOString(),
    salesperson: row.salesperson_jobber_user_id ? { id: row.salesperson_jobber_user_id } : null,
    assessment: row.assessment_id
      ? { id: row.assessment_id, assignedUsers: { nodes: ids.map((id) => ({ id })) } }
      : null,
  };
}

function toEngineQuote(row) {
  return {
    id: row.jobber_quote_id,
    quoteStatus: row.quote_status,
    lastTransitioned: { approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null },
    salesperson: row.salesperson_jobber_user_id ? { id: row.salesperson_jobber_user_id } : null,
  };
}

/**
 * The stage the engine gates on. Normally jobber_clients.pipeline_stage.
 *
 * ⚠ THE FALLBACK IS FOR A NULL OR ABSENT STAGE ONLY, AND IT IS DELIBERATELY WEAKER.
 * A client in the rep window may have no jobber_clients row at all (Step G excluded it
 * and the rep steps never CREATE a row — Danny's guard). Its stage is then derived from
 * what IS stored: a client_sales row means a job exists ('sold'); otherwise the quote
 * facts decide lead / inspection / not_sold. It can never say 'paid', because no invoice
 * is stored here — which only matters to the gate as "not lead/inspection/not_sold",
 * and 'sold' already clears that.
 */
async function stageFor(db, contractorId, jobberClientId, quotes) {
  const { rows } = await db.query(
    `SELECT pipeline_stage FROM jobber_clients WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, jobberClientId]
  );
  if (rows[0]?.pipeline_stage) return rows[0].pipeline_stage;

  const { rows: sales } = await db.query(
    `SELECT 1 FROM client_sales WHERE contractor_id = $1 AND jobber_client_id = $2 LIMIT 1`,
    [contractorId, jobberClientId]
  );
  if (sales.length > 0) return 'sold';
  return classifyPipelineStatus({ jobs: { nodes: [] }, quotes: { nodes: quotes } });
}

/**
 * Replay one client's stored history through the engine.
 * Returns the number of stored requests replayed (0 = nothing to replay).
 */
async function replayClientAttribution(db, { contractorId, jobberClientId, logError = realLogError }) {
  const { rows: reqRows } = await db.query(
    `SELECT jobber_request_id, created_at, salesperson_jobber_user_id, assessment_id, assigned_jobber_user_ids
       FROM crm_request_facts
      WHERE contractor_id = $1 AND jobber_client_id = $2
      ORDER BY created_at ASC, jobber_request_id ASC`,
    [contractorId, jobberClientId]
  );
  if (reqRows.length === 0) return 0;

  const { rows: quoteRows } = await db.query(
    `SELECT jobber_quote_id, quote_status, approved_at, salesperson_jobber_user_id
       FROM crm_quote_facts
      WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, jobberClientId]
  );
  const quotes = quoteRows.map(toEngineQuote);
  const client = { quotes: { nodes: quotes } };
  const currentStatus = await stageFor(db, contractorId, jobberClientId, quotes);

  const allRequests = reqRows.map(toEngineRequest);
  for (let i = 0; i < allRequests.length; i += 1) {
    const trigger = allRequests[i];
    const triggerMs = new Date(trigger.createdAt).getTime();
    // History AS OF this request, newest first — see the header.
    const asOf = allRequests
      .filter((r) => new Date(r.createdAt).getTime() <= triggerMs)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    await runAttributionEngine(db, {
      contractorId,
      jobberClientId,
      currentStatus,
      client,
      // Same return shape as crm/jobber.js's fetchAttributionData, built from rows.
      fetchAttributionData: async () => ({
        requests: asOf,
        assessments: asOf.filter((r) => r.assessment != null).map((r) => r.assessment),
      }),
      token: null,
      referralAnchor: trigger.createdAt,
      writeOrphanOnMiss: false,
      notifyAdminOnFlag: false,
      // ⚠ THE MARKER, AND THIS IS THE ONLY PLACE IT IS NOT 'live'. It is what lets an
      // operator-run rebuild discard what the replay wrote while leaving live and manual
      // assignments alone — see server/jobs/repAssignmentRebuild.js.
      writtenBy: 'replay',
      logError,
    });
  }
  return allRequests.length;
}

/** Clients whose stored history names any of these Jobber user ids. */
async function clientsNamingUsers(db, contractorId, jobberUserIds) {
  if (!jobberUserIds || jobberUserIds.length === 0) return [];
  const { rows } = await db.query(
    `SELECT jobber_client_id FROM crm_request_facts
      WHERE contractor_id = $1
        AND (salesperson_jobber_user_id = ANY($2::text[]) OR assigned_jobber_user_ids ?| $2::text[])
     UNION
     SELECT jobber_client_id FROM crm_quote_facts
      WHERE contractor_id = $1 AND salesperson_jobber_user_id = ANY($2::text[])
     ORDER BY 1`,
    [contractorId, jobberUserIds]
  );
  return rows.map((r) => r.jobber_client_id);
}

/**
 * Replay a set of clients, recording progress in replayStatus.
 * `trigger` is a short label for the log and the status ('mapping' | 'import').
 */
async function replayClients(db, { contractorId, jobberClientIds, trigger, teamMemberId = null, logError = realLogError }) {
  const status = {
    state: 'running',
    trigger,
    teamMemberId,
    clientsTotal: jobberClientIds.length,
    clientsDone: 0,
    failed: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  replayStatus.set(contractorId, status);

  for (const jobberClientId of jobberClientIds) {
    try {
      await replayClientAttribution(db, { contractorId, jobberClientId, logError });
    } catch (err) {
      status.failed += 1;
      // alert: false — one row per failing client is high-cardinality by construction,
      // and ruling 7 is that the replay sends nothing; the count is on the status and
      // in the summary log line below.
      await logError({
        req: null,
        contractorId,
        error: new Error(`attributionReplay (${trigger}): client ${jobberClientId} failed: ${err.message}`),
        source: 'attributionReplay — client',
        alert: false,
      });
    }
    status.clientsDone += 1;
  }

  status.state = 'complete';
  status.finishedAt = new Date().toISOString();
  // diagnostic log — intentional
  console.log(`[attributionReplay] ${contractorId} (${trigger}${teamMemberId ? `, member ${teamMemberId}` : ''}): `
    + `${status.clientsDone} clients replayed, ${status.failed} failed`);
  return status;
}

// Runs fn after whatever replay is already queued for this contractor has settled.
// The previous run's failure is swallowed here only for ORDERING — each run records
// its own failures on replayStatus and in error_log before it settles.
function enqueue(contractorId, fn) {
  const prev = chains.get(contractorId) || Promise.resolve();
  const next = (async () => {
    try { await prev; } catch { /* recorded by the run that failed */ }
    return fn();
  })();
  chains.set(contractorId, next);
  return next;
}

/**
 * Background trigger after an admin maps an attributable team member to a Jobber user.
 * Fire-and-forget from the route: returns the promise (tests await it), never throws.
 */
function replayForTeamMember(db, { contractorId, teamMemberId, logError = realLogError }) {
  return enqueue(contractorId, async () => {
    try {
      const { rows } = await db.query(
        `SELECT jobber_user_id FROM team_members
          WHERE id = $1 AND contractor_id = $2 AND is_attributable = true AND jobber_user_id IS NOT NULL`,
        [teamMemberId, contractorId]
      );
      if (rows.length === 0) return null; // not (or no longer) mapped and attributable
      const ids = await clientsNamingUsers(db, contractorId, [rows[0].jobber_user_id]);
      return await replayClients(db, { contractorId, jobberClientIds: ids, trigger: 'mapping', teamMemberId, logError });
    } catch (err) {
      replayStatus.set(contractorId, { state: 'error', trigger: 'mapping', teamMemberId, finishedAt: new Date().toISOString() });
      await logError({ req: null, contractorId, error: err, source: 'attributionReplay — mapping' });
      return null;
    }
  });
}

/** After an import completes: every client naming ANY already-mapped attributable rep. */
function replayForMappedReps(db, { contractorId, logError = realLogError }) {
  return enqueue(contractorId, async () => {
    try {
      const { rows } = await db.query(
        `SELECT jobber_user_id FROM team_members
          WHERE contractor_id = $1 AND is_attributable = true AND jobber_user_id IS NOT NULL`,
        [contractorId]
      );
      const ids = await clientsNamingUsers(db, contractorId, rows.map((r) => r.jobber_user_id));
      return await replayClients(db, { contractorId, jobberClientIds: ids, trigger: 'import', logError });
    } catch (err) {
      replayStatus.set(contractorId, { state: 'error', trigger: 'import', finishedAt: new Date().toISOString() });
      await logError({ req: null, contractorId, error: err, source: 'attributionReplay — import' });
      return null;
    }
  });
}

module.exports = {
  replayClientAttribution,
  replayForTeamMember,
  replayForMappedReps,
  clientsNamingUsers,
  getReplayStatus,
};
