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
//   · quotes AND currentStatus from decideFromFacts (server/utils/attributionDecide.js), which
//     reads saved facts only. ⚠ THIS LINE USED TO READ "currentStatus from
//     jobber_clients.pipeline_stage", and Commit 4 made that FALSE rather than merely stale: Q6
//     removed the display column from the decision entirely. It is corrected here rather than
//     left, because a header that names the wrong input is what a reader trusts first;
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
const { decideFromFacts, toEngineQuote } = require('./attributionDecide');
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

// ── THE TIE-BREAK (Danny, 2026-09-27 — amended; 3d Phase 1a Commit 7c) ────────
//
// Most recent eligible request wins. ⚠ WHEN TWO ELIGIBLE REQUESTS SHARE A createdAt, THE ONE
// JOBBER CREATED LATER WINS, AND THAT IS THE HIGHER NUMERIC ID INSIDE THE EncodedId — decoded,
// and compared AS A NUMBER.
//
// ⚠ BASE64 TEXT ORDER IS NOT NUMERIC ORDER, AND THAT IS THE WHOLE REASON THIS FUNCTION EXISTS.
// Request 341664448 and request 99999999 decode to strings whose lexical order puts the '9'
// first, so a text comparison ranks the OLDER request as later. The ids are 9-and-8-digit
// neighbours in real data, so this is the common shape rather than a contrived one.
//
// ⚠ WHAT THIS CORRECTS: until 7c the replay's tie order was `jobber_request_id ASC` followed by
// a STABLE descending sort, so `eligible[0]` on a tie was the LOWEST id — the opposite of the
// ruling wherever ids ascend with creation. No column and no Jobber field was added; the number
// was already inside the id we store.
//
// Returns null for any id that is not a decodable Jobber gid. ⚠ A NULL IS NOT AN ERROR AND MUST
// NOT BECOME ONE: test fixtures and any pre-gid row carry plain ids, and the comparator falls
// back to raw string order for them so ordering stays deterministic instead of throwing.
function jobberIdNumber(encodedId) {
  if (typeof encodedId !== 'string' || encodedId === '') return null;
  let decoded;
  try {
    decoded = Buffer.from(encodedId, 'base64').toString('utf8');
  } catch {
    return null;
  }
  // ⚠ ANCHORED ON THE WHOLE gid SHAPE, NOT ON "ends with digits". Buffer.from(…, 'base64') is
  // LENIENT — it silently drops characters it does not recognise — so a plain id like 'r-12'
  // decodes to mojibake that a bare /(\d+)$/ could still match, inventing a number from noise.
  const m = /^gid:\/\/Jobber\/[A-Za-z]+\/(\d+)$/.exec(decoded);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) ? n : null;
}

// Orders two engine-shaped requests OLDEST FIRST. Negative when `a` is older.
// ⚠ ONE COMPARATOR FOR BOTH THE ORDERING AND THE "AT OR BEFORE" CUT BELOW, DELIBERATELY. The cut
// is what stops a replayed request seeing requests that did not exist yet, and under this ruling
// "did not exist yet" includes a same-instant request with a HIGHER id — so a cut written as
// `createdAt <= trigger` and an ordering written on the id would disagree with each other about
// which of two tied requests came first. Two spellings of one rule is how they drift.
function compareRequestsOldestFirst(a, b) {
  const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (byTime !== 0) return byTime;
  const an = jobberIdNumber(a.id);
  const bn = jobberIdNumber(b.id);
  if (an !== null && bn !== null) return an - bn;
  // Neither decodes, or only one does: raw string order, which is deterministic and is the
  // pre-7c behaviour. A decodable id sorts after an undecodable one so the two sets never
  // interleave unpredictably.
  if (an !== null) return 1;
  if (bn !== null) return -1;
  return String(a.id) < String(b.id) ? -1 : (String(a.id) > String(b.id) ? 1 : 0);
}

function toEngineRequest(row) {
  const ids = Array.isArray(row.assigned_jobber_user_ids) ? row.assigned_jobber_user_ids : [];
  return {
    id: row.jobber_request_id,
    createdAt: new Date(row.created_at).toISOString(),
    salesperson: row.salesperson_jobber_user_id ? { id: row.salesperson_jobber_user_id } : null,
    // ⚠ pageInfo IS CARRIED FROM THE STORED COLUMN (7a-2), NOT OMITTED. resolveModeAMatch reads
    // assignedUsers.pageInfo.hasNextPage to refuse a truncated assessment as a single match.
    // Leaving it off here would make the REPLAY resolve a truncated assessment that the LIVE path
    // flags — the two sides disagreeing on the same saved row, which is the divergence this arc
    // exists to close.
    assessment: row.assessment_id
      ? {
        id: row.assessment_id,
        assignedUsers: {
          nodes: ids.map((id) => ({ id })),
          pageInfo: { hasNextPage: row.assigned_users_truncated === true },
        },
      }
      : null,
  };
}

/**
 * Replay one client's stored history through the engine.
 * Returns the number of stored requests replayed (0 = nothing to replay).
 */
async function replayClientAttribution(db, {
  contractorId, jobberClientId, logError = realLogError,
  // ⚠ FORWARDED TO THE ENGINE UNTOUCHED (7c). Both are `undefined` on every live path, and a
  // destructured default treats `undefined` as absent — so the engine takes its own defaults and
  // this pass-through is inert unless the rebuild preview supplies recording writers and the
  // simulated row that goes with them. The preview reuses THIS loop rather than copying it,
  // because a second copy of the per-request walk is a second place for the ordering, the
  // anchor and the "at or before" cut to drift from what production does.
  writers, readAssignmentRow,
}) {
  const { rows: reqRows } = await db.query(
    `SELECT jobber_request_id, created_at, salesperson_jobber_user_id, assessment_id,
            assigned_jobber_user_ids, assigned_users_truncated
       FROM crm_request_facts
      WHERE contractor_id = $1 AND jobber_client_id = $2
      ORDER BY created_at ASC, jobber_request_id ASC`,
    [contractorId, jobberClientId]
  );
  if (reqRows.length === 0) return 0;

  // ⚠ ONE DECISION PATH (R5i). The quote read, the job read and the status derivation all live
  // in decideFromFacts now, so the replay and — from Commit 5 — the live doors decide from the
  // same saved facts using the same code. This function no longer derives a status of its own.
  // ⚠ Q6: the old stageFor read jobber_clients.pipeline_stage FIRST and returned it when set, so
  // the decision inherited the display column. Nothing here reads it any more.
  const { currentStatus, client } = await decideFromFacts(db, { contractorId, jobberClientId });

  // ⚠ ORDERED IN JS, NOT BY THE SQL ABOVE, SINCE 7c. The `ORDER BY created_at ASC,
  // jobber_request_id ASC` stays for the index and for a deterministic starting point, but the
  // TIE is now decided by compareRequestsOldestFirst — the decoded numeric id — and Postgres
  // cannot express that without decoding base64 in SQL. See the comparator for the ruling.
  const allRequests = reqRows.map(toEngineRequest).sort(compareRequestsOldestFirst);
  for (let i = 0; i < allRequests.length; i += 1) {
    const trigger = allRequests[i];
    // History AS OF this request, newest first — see the header.
    // ⚠ `.reverse()` RATHER THAN A SECOND SORT, AND IT IS NOT A SHORTCUT: allRequests is already
    // oldest-first under the one comparator, and filter preserves order, so reversing yields
    // newest-first with ties HIGHEST-ID FIRST — which is exactly what `eligible[0]` must be.
    // Re-sorting here would be a second expression of the same rule.
    const asOf = allRequests
      .filter((r) => compareRequestsOldestFirst(r, trigger) <= 0)
      .reverse();

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
      writers,
      readAssignmentRow,
      logError,
    });
  }
  return allRequests.length;
}

// ── THE CANDIDATE PREDICATE, WRITTEN ONCE (3d Phase 1a Commit 7) ──────────────
// ⚠ TWO CALLERS NEED THE SAME ANSWER AND MUST NOT EACH SPELL IT OUT. This is the set the
// replay VISITS; the rebuild's `recreatable` guard (server/jobs/repAssignmentRebuild.js)
// asks the same question in order to decide whether clearing a row is reversible. A second
// copy of this UNION in the rebuild would be a guard that looks right and proves the wrong
// thing the first time either side is edited — so the rebuild composes this fragment
// instead, and cannot drift from it.
// ⚠ BOTH ARMS CARRY contractor_id EXPLICITLY. A UNION is exactly the shape where a third
// arm added without the predicate reads as covered; write it on every arm.
function namesUsersSql(contractorParam, usersParam) {
  return `SELECT jobber_client_id FROM crm_request_facts
      WHERE contractor_id = ${contractorParam}
        AND (salesperson_jobber_user_id = ANY(${usersParam}::text[]) OR assigned_jobber_user_ids ?| ${usersParam}::text[])
     UNION
     SELECT jobber_client_id FROM crm_quote_facts
      WHERE contractor_id = ${contractorParam} AND salesperson_jobber_user_id = ANY(${usersParam}::text[])`;
}

/** Clients whose stored history names any of these Jobber user ids. */
async function clientsNamingUsers(db, contractorId, jobberUserIds) {
  if (!jobberUserIds || jobberUserIds.length === 0) return [];
  const { rows } = await db.query(
    `${namesUsersSql('$1', '$2')} ORDER BY 1`,
    [contractorId, jobberUserIds]
  );
  return rows.map((r) => r.jobber_client_id);
}

/**
 * The Jobber user ids a replay-for-everyone would run against: every attributable team
 * member who is mapped.
 *
 * ⚠ DELIBERATELY NOT FILTERED ON `active`, and that differs from the rebuild's refusal
 * check (`unmappedAttributableReps`), which IS active-only. The two ask different
 * questions: "must the operator map somebody before running" is about people who can still
 * be mapped, while this is about whose history the replay will actually walk — a departed
 * rep's mapped clients are still replayed and still theirs. Extracted here so the rebuild's
 * recreatable guard and the replay itself cannot use different sets.
 */
async function mappedAttributableUserIds(db, contractorId) {
  const { rows } = await db.query(
    `SELECT jobber_user_id FROM team_members
      WHERE contractor_id = $1 AND is_attributable = true AND jobber_user_id IS NOT NULL`,
    [contractorId]
  );
  return rows.map((r) => r.jobber_user_id);
}

/**
 * SQL selecting the clients whose assignment a replay could RECREATE from stored facts.
 * Takes the placeholder names so a caller can slot it into a statement of its own;
 * `contractorParam` binds the contractor id, `usersParam` a text[] of mapped Jobber user ids.
 *
 * ⚠ REQUEST FACTS SPECIFICALLY, ON TOP OF BEING A CANDIDATE — AND THE `AND` IS THE WHOLE
 * POINT. `replayClientAttribution` returns at `reqRows.length === 0` before the engine is
 * ever called, so a client with QUOTE facts only is returned by the UNION above, is visited,
 * and replays to nothing. A guard keyed on "has a row in any fact table" would therefore
 * spare nothing while looking like it spared everything — the plausible-looking guard that
 * still loses rows.
 *
 * ⚠ AND WHAT IT CANNOT SEE, STATED RATHER THAN ASSUMED: this answers "the replay will VISIT
 * this client and has requests to walk", never "the replay will write the same row". Two
 * known cases satisfy it and still write nothing — a client whose derived `currentStatus` is
 * in the engine's GATE_EXCLUSIONS with no in-grace Mode A/B match, and (7a-2) one whose
 * candidate assessments are all truncated, which flags instead of assigning. Those rows are
 * cleared and not recreated. Narrowing the guard to "the replay will write" means running
 * the engine to find out, which is the rebuild itself; a preview mode is the honest fix and
 * is filed on PRE_LAUNCH_CHECKLIST.md rather than guessed at here.
 */
function recreatableClientsSql(contractorParam, usersParam) {
  return `SELECT n.jobber_client_id FROM (${namesUsersSql(contractorParam, usersParam)}) n
             WHERE EXISTS (SELECT 1 FROM crm_request_facts rf
                            WHERE rf.contractor_id = ${contractorParam}
                              AND rf.jobber_client_id = n.jobber_client_id)`;
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
      const ids = await clientsNamingUsers(db, contractorId, await mappedAttributableUserIds(db, contractorId));
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
  mappedAttributableUserIds,
  recreatableClientsSql,
  namesUsersSql,
  getReplayStatus,
  toEngineRequest,
  jobberIdNumber,
  compareRequestsOldestFirst,
};
