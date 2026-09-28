'use strict';

// ── THE FACT-BACKED REQUEST READER (3d Phase 1a Commit 7b) ───────────────────
//
// R5i: live and replay choose the rep from the SAME saved facts using the SAME code. Commits 4
// and 5 did that for the QUOTE half and for `currentStatus`; the REQUEST half — which is what
// Mode A and Mode B actually decide on — stayed on a live Jobber fetch until this commit. This
// module is the request half, and after 7b it is the only way any caller obtains the engine's
// request list.
//
// ⚠ ITS OWN MODULE, AND THE REASON IS A REQUIRE CYCLE RATHER THAN TIDINESS. The obvious home is
// attributionDecide.js — "the decision owns the shape it decides from", which is why toEngineQuote
// lives there. But attributionDecide requires classifyPipelineStatus from crm/pipelineSync, and
// crm/pipelineSync is itself one of the doors that now needs this reader. Putting it there makes
// pipelineSync -> attributionDecide -> pipelineSync. Same shape, and the same fix, as
// server/utils/invoicePaid.js. **This file must therefore require nothing from server/crm and
// nothing from attributionDecide** — if you are about to add either import, that is the cycle.
//
// ⚠ AND IT MAKES NO NETWORK CALL, WHICH IS THE WHOLE POINT OF 7b. There is no axios here, no
// token parameter, and nothing to pass one to. That is what lets runAttributionEngine move INSIDE
// the per-client advisory lock (server/utils/clientLock.js), which is what makes the
// client_rep_assignments write atomic with the capture and the decision it was taken from.

// ── THE TIE-BREAK (Danny, 2026-09-27) ────────────────────────────────────────
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
// ⚠ ARRIVED HERE BY VERBATIM RELOCATION FROM attributionReplay.js (7b) — same names, same
// bodies, same comments. The replay imports them back, so there is ONE copy. Moving them is what
// lets the LIVE doors use the ruled order: until 7b the live path stable-sorted Jobber's
// REQUESTED_AT-descending page by createdAt (server/crm/jobber.js's fetchAttributionData), so a
// tie resolved to whatever Jobber happened to return first — the ruling was implemented on the
// replay side only, and the two sides disagreed on the same saved rows.
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
// ⚠ ONE COMPARATOR FOR BOTH THE ORDERING AND THE REPLAY'S "AT OR BEFORE" CUT, DELIBERATELY. The
// cut is what stops a replayed request seeing requests that did not exist yet, and under this
// ruling "did not exist yet" includes a same-instant request with a HIGHER id — so a cut written
// as `createdAt <= trigger` and an ordering written on the id would disagree with each other
// about which of two tied requests came first. Two spellings of one rule is how they drift.
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

/**
 * One saved request fact, in the shape the engine reads.
 * ⚠ Relocated verbatim from attributionReplay.js in 7b so the live doors and the replay build
 * the engine's request nodes from ONE mapper. A second copy is how the two sides start
 * disagreeing about a column, which is the divergence this whole arc exists to close.
 */
function toEngineRequest(row) {
  const ids = Array.isArray(row.assigned_jobber_user_ids) ? row.assigned_jobber_user_ids : [];
  return {
    id: row.jobber_request_id,
    createdAt: new Date(row.created_at).toISOString(),
    salesperson: row.salesperson_jobber_user_id ? { id: row.salesperson_jobber_user_id } : null,
    // ⚠ pageInfo IS CARRIED FROM THE STORED COLUMN (7a-2), NOT OMITTED. resolveModeAMatch reads
    // assignedUsers.pageInfo.hasNextPage to refuse a truncated assessment as a single match.
    // ⚠ AND THIS IS WHAT 7b GIVES THE LIVE PATH THAT IT NEVER HAD. The live ATTRIBUTION_QUERY
    // selected `assignedUsers { nodes { id } }` with no pageInfo at all, so hasNextPage was
    // `undefined` and the truncation branch could not fire on any live door — a genuine
    // co-assignment on a six-person assessment was written as a single-match STICKY, which is
    // existing-wins and uncorrectable. The capture query does select it
    // (REQUEST_FIELDS in server/utils/jobberClientFetch.js), so reading from facts is what
    // makes 7a-2's protection reach the live doors.
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

// The columns toEngineRequest reads, in one place, so a caller cannot select a subset and get a
// silently thinner request. ⚠ Every field here is read by toEngineRequest above; dropping one
// makes the engine decide from a node missing a field it tests, which is this repo's recorded
// reads-vs-selects defect (server/test/captureFetchContract.test.js exists because of it).
const REQUEST_FACT_COLUMNS = 'jobber_request_id, created_at, salesperson_jobber_user_id, '
  + 'assessment_id, assigned_jobber_user_ids, assigned_users_truncated';

/**
 * Every stored request fact for one client, in the shape and ORDER the engine requires.
 * Inputs: a db/pool/tx, the contractor id, the Jobber client id.
 * Output: an array of engine-shaped requests, NEWEST FIRST.
 *
 * ⚠ NEWEST-FIRST IS CONTRACTUAL, NOT CONVENIENT. resolveModeAMatch and resolveModeBMatch both
 * take `eligible[0]` after filtering, so the caller's order IS the "most recent eligible request
 * wins" ruling. Hand this list back in any other order and the engine silently picks a different
 * rep, with nothing failing anywhere.
 *
 * ⚠ SORTED IN JS RATHER THAN BY THE SQL, AND THE `ORDER BY` IS STILL THERE ON PURPOSE. Postgres
 * cannot express the tie-break — it would have to decode base64 — so the SQL gives a
 * deterministic starting point for the index and compareRequestsOldestFirst decides the tie.
 * Reversing an oldest-first sort yields newest-first with ties HIGHEST-ID FIRST, which is exactly
 * what eligible[0] must be; re-sorting descending instead would be a second expression of one
 * rule, and `.reverse()` is what keeps it single.
 *
 * ⚠ NO LIMIT, AND THAT IS A DELIBERATE DIFFERENCE FROM THE LIVE FETCH IT REPLACES.
 * fetchAttributionData capped at `first: 25` newest-by-REQUESTED_AT. Both modes take the most
 * recent ELIGIBLE request, so the cap only ever bit when 25-plus newer requests were all
 * ineligible — rare, and the uncapped answer is the correct one.
 */
async function requestsFromFacts(db, { contractorId, jobberClientId }) {
  if (!contractorId) throw new Error('requestsFromFacts: contractorId is required');
  if (!jobberClientId) throw new Error('requestsFromFacts: jobberClientId is required');

  const { rows } = await db.query(
    `SELECT ${REQUEST_FACT_COLUMNS}
       FROM crm_request_facts
      WHERE contractor_id = $1 AND jobber_client_id = $2
      ORDER BY created_at ASC, jobber_request_id ASC`,
    [contractorId, jobberClientId]
  );

  return rows.map(toEngineRequest).sort(compareRequestsOldestFirst).reverse();
}

/**
 * Builds the reader runAttributionEngine's `readRequests` parameter expects, bound to one
 * db handle and one contractor.
 * Inputs: a db/pool/tx, the contractor id.
 * Output: async (jobberClientId) => ({ requests }) — the engine's contract.
 *
 * ⚠ BIND IT TO THE TRANSACTION, NEVER THE POOL, AT EVERY LIVE DOOR. The engine now runs INSIDE
 * withClientLock; a reader holding the pool would read on a different connection, outside the
 * lock and outside the transaction, so it could observe another event's half-written capture —
 * which is the exact interleaving the lock exists to prevent, reintroduced through the one
 * argument nobody would think to check.
 *
 * ⚠ AND THE RETURN SHAPE IS `{ requests }`, NOT A BARE ARRAY, because that is what the engine
 * destructures. It is the shape the old fetchAttributionData returned, kept so the engine's
 * contract did not have to change in the same commit as its wiring.
 */
function makeRequestReader(db, contractorId) {
  return async (jobberClientId) => ({
    requests: await requestsFromFacts(db, { contractorId, jobberClientId }),
  });
}

module.exports = {
  requestsFromFacts,
  makeRequestReader,
  toEngineRequest,
  jobberIdNumber,
  compareRequestsOldestFirst,
  REQUEST_FACT_COLUMNS,
};
