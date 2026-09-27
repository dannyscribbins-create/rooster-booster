'use strict';

// ── THE ASSIGNMENT REBUILD PREVIEW — READ-ONLY (3d Phase 1a Commit 7c) ────────
//
// Answers, for one contractor and without writing anything: if the operator rebuild ran right
// now, which clients would keep the rep they have, which would change hands, and which would end
// up with nobody. It is the precondition Danny set on running REP_ASSIGNMENT_REBUILD against real
// data, and it is what `recreatableClientsSql`'s own comment in attributionReplay.js filed as
// "the honest fix" for the one thing that guard cannot see.
//
// ⚠ IT SERVES A SECOND PURPOSE AND THE TWO ARE THE SAME COMPUTATION. Commit 7b will switch the
// LIVE doors from choosing the rep on a fresh Jobber fetch to choosing it from saved facts. The
// question "what would deciding from saved facts do to every client, compared with who owns them
// now" is answered by exactly this pass, because the replay already decides from saved facts.
// So the preview is both a rebuild dry-run and 7b's blast radius.
//
// ⚠ NO ROUTE AND NO PAGE (Danny, 2026-09-27). Ruling D-K keeps the super-admin client surface
// shut, so this ships as a script (server/scripts/previewRebuild.js) and nothing else. The
// super-admin PAGE is deferred to the panel build-out before contractor #2 and is filed on
// PRE_LAUNCH_CHECKLIST.md; when it is built it must reuse THIS module rather than re-deriving
// the decision, for the same reason the rebuild composes the replay's SQL instead of copying it.
//
// ── HOW IT IS WRITE-FREE, WHICH IS TWO INDEPENDENT MECHANISMS ON PURPOSE ──────
//   1. RECORDING WRITERS. runAttributionEngine takes a `writers` seam (7c); this module passes
//      four that mutate an in-memory row and append to a list.
//   2. A SELECT-ONLY DB PROXY. Every statement the pass issues — the engine's, the replay's,
//      decideFromFacts' — goes through `selectOnlyDb`, which throws on anything that is not a
//      bare SELECT.
// ⚠ THEY ARE NOT DEFENCE IN DEPTH, THEY ARE TWO DIFFERENT CLAIMS. (1) says this module asked for
// no writes; (2) says nothing it called wrote anyway, including code added later that never
// heard of the seam. CLAUDE.md's rule about guards sharing an input is why both exist: a fence
// built only on (1) is a fence on my own intent.

const { decideFromFacts } = require('./attributionDecide');
const {
  replayClientAttribution,
  clientsNamingUsers,
  mappedAttributableUserIds,
  recreatableClientsSql,
} = require('./attributionReplay');
const {
  ENGINE_STICKY_SOURCES,
  ENGINE_PROVISIONAL_SOURCES,
} = require('../jobs/repAssignmentRebuild');
const { SOURCE_LABELS } = require('./clientAssignment');

// The three groups, as the totals and the CSV name them.
const GROUP_UNCHANGED = 'unchanged';
const GROUP_CHANGED = 'would_change';
const GROUP_LOST = 'unassigned_or_flagged';

// ── THE SELECT-ONLY PROXY ─────────────────────────────────────────────────────

// ⚠ COMMENTS ARE STRIPPED BEFORE THE STATEMENT IS CLASSIFIED, AND THIS REPO HAS ALREADY PAID FOR
// LEARNING WHY. A `\bFROM\b` needle run over loadContractorBranding() matched the word "from" in
// a SQL comment and reported a supplied column as absent. The same shape here would be worse in
// the other direction: a write hidden after a comment, or — far likelier — a legitimate SELECT
// refused because the prose above it contains the word "update".
function stripSqlComments(sql) {
  return String(sql).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

// ⚠ AN ALLOW-LIST ON THE FIRST KEYWORD, PLUS A DENY-LIST FOR EVERYTHING ELSE, BECAUSE NEITHER IS
// SUFFICIENT ALONE. `^select` alone admits `WITH x AS (DELETE … RETURNING *) SELECT …`, which is
// a data-modifying statement that begins with neither INSERT nor UPDATE. The deny-list alone
// would admit `BEGIN`. Word boundaries matter: `\bcreate\b` does not match `created_at`, and
// `\btruncate\b` does not match `assigned_users_truncated` — both appear in queries this pass
// legitimately issues, and both were checked rather than assumed.
const FORBIDDEN_WORD = /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|merge|copy|set|begin|commit|rollback|do|call|lock|vacuum|refresh)\b/i;

function assertSelectOnly(sql) {
  const bare = stripSqlComments(sql).trim();
  if (!/^select\b/i.test(bare)) {
    throw new Error(`assignmentPreview: refused a non-SELECT statement: ${bare.slice(0, 120)}`);
  }
  const hit = FORBIDDEN_WORD.exec(bare);
  if (hit) {
    throw new Error(`assignmentPreview: refused a statement containing "${hit[1]}": ${bare.slice(0, 120)}`);
  }
}

/**
 * Wraps a pool in a db-shaped object that answers SELECTs and refuses everything else, and
 * memoises results.
 *
 * ⚠ THE MEMO IS SOUND ONLY BECAUSE THE PASS IS WRITE-FREE, AND THE DEPENDENCY RUNS BOTH WAYS.
 * Nothing writes, so the same statement with the same parameters cannot produce a different
 * answer later in the run — that is what makes caching correct rather than a stale-read bug. It
 * also means the cache is NOT an optimisation that could be kept if the write-freedom were ever
 * relaxed: it would have to go in the same commit.
 *
 * ⚠ TWO TIERS, AND THE SPLIT IS A MEMORY DECISION RATHER THAN A CORRECTNESS ONE — WHICH IS WHY
 * IT DEFAULTS THE SAFE WAY. Because nothing writes, caching a statement in the wrong tier cannot
 * produce a wrong answer; it can only retain rows for longer than it needs to. So everything is
 * cached PER CLIENT and dropped at the client boundary, and only an explicit allow-list of
 * provably contractor-scoped lookups is kept for the whole run.
 *
 * ⚠ THE ALLOW-LIST IS WHERE THE HOIST ACTUALLY LANDS, AND IT IS TWO STATEMENTS. The engine reads
 * `contractor_crm_settings` for the attribution source and `team_members` for the user mapping
 * ONCE PER REQUEST PER CLIENT — thousands of identical queries in a 7,000-client run, which is
 * the cost worth removing and the only cost the engine cannot be asked to remove itself.
 * ⚠ A BROADER RULE WAS WRITTEN FIRST AND REJECTED FOR A MEASURABLE REASON: "contractor-level iff
 * no parameter mentions the current client" puts decideFromFacts' invoice read — parameterised on
 * JOB ids, which are client-derived but are not the client id — in the permanent tier, so a
 * 7,000-client run would retain 7,000 invoice result sets while looking like it retained none.
 */
const CONTRACTOR_SCOPED_READ = /\bfrom\s+(contractor_crm_settings|team_members)\b/i;

function selectOnlyDb(pool) {
  const contractorCache = new Map();
  let clientCache = new Map();
  const stats = { issued: 0, servedFromCache: 0, refused: 0 };

  return {
    stats,
    /** Starts a client's scope: the previous client's cached reads are dropped. */
    beginClient() {
      clientCache = new Map();
    },
    async query(sql, params) {
      try {
        assertSelectOnly(sql);
      } catch (err) {
        stats.refused += 1;
        throw err;
      }
      const cache = CONTRACTOR_SCOPED_READ.test(stripSqlComments(sql)) ? contractorCache : clientCache;
      const key = `${sql}::${JSON.stringify(params === undefined ? null : params)}`;
      if (cache.has(key)) {
        stats.servedFromCache += 1;
        return cache.get(key);
      }
      const result = await pool.query(sql, params);
      // Only the rows are ever read by any caller here; keeping the whole result object keeps
      // the shape honest for a caller that reads rowCount.
      cache.set(key, result);
      stats.issued += 1;
      return result;
    },
  };
}

// ── THE DISCARD, SIMULATED ────────────────────────────────────────────────────

/**
 * What discardEngineAssignments would leave of one row.
 *
 * ⚠ THE SOURCE LISTS AND THE RECREATABLE SET ARE IMPORTED, NEVER RESTATED. ENGINE_STICKY_SOURCES
 * and ENGINE_PROVISIONAL_SOURCES come from the rebuild itself and the recreatable set is built
 * from recreatableClientsSql — the same fragment the rebuild composes. A preview that spelled
 * either out again would agree with the rebuild on the day it was written and silently stop
 * agreeing the first time one of them was edited, which is the whole failure this preview exists
 * to prevent somebody making in production.
 *
 * ⚠ AND IT MIRRORS THE ORDER OF THE REAL THING: the rebuild clears HALVES, not rows, so a row
 * carrying a manual sticky and an engine-written provisional keeps the sticky.
 */
function simulateDiscard(row, { recreatable, treatNullAsReplay }) {
  if (!row) {
    return { sticky_rep_id: null, sticky_source: null, provisional_rep_id: null, provisional_source: null };
  }
  // The rebuild's markerClause, at this row.
  const markerMatches = row.written_by === 'replay' || (treatNullAsReplay && row.written_by == null);
  const clearSticky = recreatable && markerMatches && ENGINE_STICKY_SOURCES.includes(row.sticky_source);
  const clearProvisional = recreatable && markerMatches && ENGINE_PROVISIONAL_SOURCES.includes(row.provisional_source);
  return {
    sticky_rep_id: clearSticky ? null : row.sticky_rep_id,
    sticky_source: clearSticky ? null : row.sticky_source,
    provisional_rep_id: clearProvisional ? null : row.provisional_rep_id,
    provisional_source: clearProvisional ? null : row.provisional_source,
  };
}

// Who a row resolves to, by the same COALESCE(sticky, provisional) rule every read uses.
function resolve(row) {
  if (!row) return { repId: null, state: null, source: null };
  if (row.sticky_rep_id != null) {
    return { repId: row.sticky_rep_id, state: 'locked', source: row.sticky_source };
  }
  if (row.provisional_rep_id != null) {
    return { repId: row.provisional_rep_id, state: 'provisional', source: row.provisional_source };
  }
  return { repId: null, state: null, source: null };
}

// ── ONE CLIENT ────────────────────────────────────────────────────────────────

/**
 * Preview one client. `db` must already be a selectOnlyDb scoped to this client.
 * Returns the row the CSV and the totals are built from.
 */
async function previewClient(db, {
  contractorId, jobberClientId, beforeRow, recreatable, treatNullAsReplay, repNames, clientNames, logError,
}) {
  // Derived first, and deliberately: it populates this client's read cache, so the replay's own
  // call to decideFromFacts below is served from it rather than re-querying. The status is also
  // the single most useful column in the CSV — it is what decides whether the sticky gate fires
  // at all, and a client sitting at 'lead' explains its own outcome.
  const { currentStatus } = await decideFromFacts(db, { contractorId, jobberClientId });

  const after = simulateDiscard(beforeRow, { recreatable, treatNullAsReplay });
  const actions = [];

  // ⚠ THE RECORDING WRITERS REPRODUCE writeSticky's `WHERE sticky_rep_id IS NULL`, AND THAT IS
  // NOT A DETAIL. Existing-wins is the rule the whole rebuild is about: the second and later
  // iterations of the per-request loop must find the sticky already set and do nothing. A writer
  // that simply overwrote would report the LAST request's answer where production reports the
  // first one's, on exactly the multi-request clients the operator is worried about.
  const writers = {
    writeSticky: async (_db, _cid, _clid, repId, source) => {
      if (after.sticky_rep_id == null) {
        after.sticky_rep_id = repId;
        after.sticky_source = source;
        actions.push({ type: 'sticky', repId, source });
      } else {
        actions.push({ type: 'sticky_noop', repId, source });
      }
    },
    writeProvisional: async (_db, _cid, _clid, repId, source) => {
      after.provisional_rep_id = repId;
      after.provisional_source = source;
      actions.push({ type: 'provisional', repId, source });
    },
    writeCoAssignmentFlag: async (_db, _cid, _clid, repIds) => {
      actions.push({ type: 'flag', reason: 'rep_co_assignment', repIds: repIds || [] });
    },
    // Unreachable on this path — the replay passes writeOrphanOnMiss: false (ruling R3) — and
    // recorded rather than omitted, because a writer the seam knows about and this object does
    // not would be a silent TypeError if R3 ever changed.
    writeOrphanFlag: async () => {
      actions.push({ type: 'flag', reason: 'orphan' });
    },
  };

  // The engine's step 2, answered from the simulation instead of the table. Returned as a fresh
  // object each time so the engine cannot hold a reference that mutates under it.
  const readAssignmentRow = async () => ({
    provisional_rep_id: after.provisional_rep_id,
    provisional_source: after.provisional_source,
    sticky_rep_id: after.sticky_rep_id,
  });

  const requestsReplayed = await replayClientAttribution(db, {
    contractorId, jobberClientId, writers, readAssignmentRow, logError,
  });

  const before = resolve(beforeRow);
  const now = resolve(after);
  const flag = actions.find((a) => a.type === 'flag') || null;

  let group;
  if (before.repId === now.repId && before.state === now.state) {
    group = (now.repId == null && flag) ? GROUP_LOST : GROUP_UNCHANGED;
  } else if (now.repId == null) {
    group = GROUP_LOST;
  } else {
    group = GROUP_CHANGED;
  }

  return {
    jobberClientId,
    clientName: clientNames.get(jobberClientId) || '',
    group,
    currentRep: before.repId ? (repNames.get(before.repId) || `#${before.repId}`) : '',
    currentState: before.state || '',
    currentSource: before.source || '',
    currentSetAt: beforeRow
      ? (before.state === 'locked' ? beforeRow.sticky_set_at : beforeRow.provisional_set_at) || ''
      : '',
    newRep: now.repId ? (repNames.get(now.repId) || `#${now.repId}`) : '',
    newState: now.state || '',
    newSource: now.source || '',
    // ⚠ REPORTED SEPARATELY FROM THE GROUP, AND A GUARD-PROOF IS WHY. A flag raised on a client
    // that KEEPS its rep does not change the group, so folding "would a flag be raised" into the
    // group made it invisible — and the loop-threading case was therefore passing against a
    // preview that raised a co-assignment flag production would never raise. It is also the
    // column an operator needs on its own merits: every flag is an item in the admin queue.
    wouldFlag: flag ? flag.reason : '',
    reason: describe({ group, before, now, flag, currentStatus, requestsReplayed, recreatable, beforeRow }),
    recreatable: recreatable ? 'yes' : 'no',
    derivedStatus: currentStatus,
    requestsReplayed,
  };
}

/**
 * Why this client landed in its group, in words an operator can act on.
 * ⚠ THE UNSURPRISING CASES GET A REASON TOO. "unchanged" because nothing could be recreated is a
 * different fact from "unchanged" because the replay reached the same answer, and only one of
 * them means the rebuild is working.
 */
function describe({ group, before, now, flag, currentStatus, requestsReplayed, recreatable, beforeRow }) {
  if (flag && now.repId == null) {
    return flag.reason === 'rep_co_assignment'
      ? `flagged for a human — ${flag.repIds.length} attributable reps matched, or the assessment was truncated`
      : 'flagged — no rep could be resolved';
  }
  if (group === GROUP_LOST) {
    if (requestsReplayed === 0) {
      return 'would lose its rep — no request facts, so the replay writes nothing back';
    }
    return `would lose its rep — derived status '${currentStatus}' resolved to nobody from saved facts`;
  }
  if (group === GROUP_CHANGED) {
    if (before.repId == null) {
      return `newly assigned from saved facts (${SOURCE_LABELS[now.source] || now.source})`;
    }
    if (before.repId !== now.repId) {
      return `rep differs — saved facts name a different rep (${before.source || 'none'} → ${now.source || 'none'})`;
    }
    return `same rep, confidence flips ${before.state} → ${now.state} (${before.source || 'none'} → ${now.source || 'none'})`;
  }
  if (now.repId == null) return 'unassigned before and after';
  if (beforeRow && !recreatable) {
    return 'kept — the rebuild cannot recreate this assignment from saved facts, so it is spared';
  }
  return 'unchanged — the replay reaches the same rep and the same state';
}

// ── THE WHOLE PASS ────────────────────────────────────────────────────────────

/**
 * Preview every candidate client of one contractor.
 *
 * ⚠ THE CANDIDATE SET IS A UNION, AND THE SECOND ARM IS WHAT MAKES THE PREVIEW HONEST. The
 * clients the replay VISITS answer "who would the rebuild assign"; the clients that CURRENTLY
 * HOLD an assignment answer "who would the rebuild take one away from". A preview built from the
 * first arm alone structurally cannot report a loss, which is the outcome the gate exists for.
 *
 * `onProgress({ done, total })` is called as it goes; it must not write anything either.
 * Returns { totals, rows, stats, mappedUserIds, unmappedNote }.
 */
async function previewAssignments(pool, {
  contractorId, treatNullAsReplay = true, onProgress = null, logError = null,
} = {}) {
  if (!contractorId) throw new Error('previewAssignments: contractorId is required');

  const db = selectOnlyDb(pool);

  // ⚠ SWALLOWED, NOT FORWARDED (7c). logError WRITES to error_log, and a preview that logs is a
  // preview that writes. The replay calls it per failing client; here a failure becomes the
  // client's own reported outcome instead. Defaulting it to the real logger would have made the
  // SELECT-only proxy throw on the first bad client, which reads as a broken preview rather than
  // as one client that could not be decided.
  const previewLogError = logError || (async () => {});

  const mappedUserIds = await mappedAttributableUserIds(db, contractorId);
  const visited = await clientsNamingUsers(db, contractorId, mappedUserIds);

  const { rows: recreatableRows } = mappedUserIds.length === 0
    ? { rows: [] }
    : await db.query(recreatableClientsSql('$1', '$2'), [contractorId, mappedUserIds]);
  const recreatableSet = new Set(recreatableRows.map((r) => r.jobber_client_id));

  const { rows: assignmentRows } = await db.query(
    `SELECT jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at,
            provisional_rep_id, provisional_source, provisional_set_at, written_by
       FROM client_rep_assignments
      WHERE contractor_id = $1
      ORDER BY jobber_client_id`,
    [contractorId]
  );
  const beforeRows = new Map(assignmentRows.map((r) => [r.jobber_client_id, r]));

  const { rows: repRows } = await db.query(
    `SELECT id, full_name, email FROM team_members WHERE contractor_id = $1`,
    [contractorId]
  );
  const repNames = new Map(repRows.map((r) => [r.id, r.full_name || r.email]));

  const candidates = [...new Set([...visited, ...beforeRows.keys()])].sort();

  const { rows: nameRows } = candidates.length === 0
    ? { rows: [] }
    : await db.query(
      `SELECT jobber_client_id, first_name, last_name FROM jobber_clients
        WHERE contractor_id = $1 AND jobber_client_id = ANY($2::text[])`,
      [contractorId, candidates]
    );
  const clientNames = new Map(nameRows.map((r) => [
    r.jobber_client_id, `${r.first_name || ''} ${r.last_name || ''}`.trim(),
  ]));

  const rows = [];
  const totals = { [GROUP_UNCHANGED]: 0, [GROUP_CHANGED]: 0, [GROUP_LOST]: 0 };

  for (let i = 0; i < candidates.length; i += 1) {
    const jobberClientId = candidates[i];
    db.beginClient();
    const row = await previewClient(db, {
      contractorId,
      jobberClientId,
      beforeRow: beforeRows.get(jobberClientId) || null,
      recreatable: recreatableSet.has(jobberClientId),
      treatNullAsReplay,
      repNames,
      clientNames,
      logError: previewLogError,
    });
    rows.push(row);
    totals[row.group] += 1;
    if (onProgress && (i + 1) % 100 === 0) onProgress({ done: i + 1, total: candidates.length });
  }
  if (onProgress) onProgress({ done: candidates.length, total: candidates.length });

  return { totals, rows, stats: db.stats, mappedUserIds, candidates: candidates.length };
}

// ── CSV ───────────────────────────────────────────────────────────────────────

const CSV_COLUMNS = Object.freeze([
  'jobber_client_id', 'client_name', 'group',
  'current_rep', 'current_state', 'current_source', 'current_set_at',
  'new_rep', 'new_state', 'new_source', 'would_flag',
  'reason', 'recreatable', 'derived_status', 'requests_replayed',
]);

// ⚠ QUOTES EVERY FIELD RATHER THAN DECIDING WHICH NEED IT. A client name containing a comma is
// ordinary, a reason string contains them by construction, and a rep's name can contain a quote.
// Deciding per field is where a CSV writer goes wrong; quoting unconditionally cannot.
function csvCell(value) {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push([
      r.jobberClientId, r.clientName, r.group,
      r.currentRep, r.currentState, r.currentSource,
      r.currentSetAt instanceof Date ? r.currentSetAt.toISOString() : r.currentSetAt,
      r.newRep, r.newState, r.newSource, r.wouldFlag,
      r.reason, r.recreatable, r.derivedStatus, r.requestsReplayed,
    ].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  previewAssignments,
  toCsv,
  CSV_COLUMNS,
  selectOnlyDb,
  assertSelectOnly,
  simulateDiscard,
  GROUP_UNCHANGED,
  GROUP_CHANGED,
  GROUP_LOST,
};
