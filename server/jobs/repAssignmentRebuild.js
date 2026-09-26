'use strict';

// ── THE ASSIGNMENT REBUILD — AN OPERATOR-RUN SUPPORT TOOL (Danny, 2026-09-22) ──
//
// ⚠ IT IS NOT A FEATURE AND MUST NOT BECOME ONE. Danny's ruling: what a contractor wants
// is that attribution is RIGHT with few exceptions, and a front-end way to CORRECT the
// exceptions. This is neither — it is what Danny or support runs when an import attributed
// a whole book wrongly, and there is no button, no route and no contractor-facing anything.
//
// WHY IT EXISTS. Mapping a rep replays their history, but a STICKY is existing-wins, so a
// client frozen to the wrong rep can never be corrected by mapping the right one later.
// (The provisional rule shipped 2026-09-22 stops NEW ones being created — see
// attributionEngine's sticky gate — but it does not unfreeze what is already there.)
//
// HOW AN OPERATOR RUNS IT: set the Railway env var REP_ASSIGNMENT_REBUILD to the
// contractor id, restart, read the log, then REMOVE THE VAR. Naming the contractor is the
// confirmation step; there is deliberately no "all contractors" mode.
//
// ⚠ EVERY ATTRIBUTABLE REP MUST BE MAPPED FIRST, AND THIS REFUSES IF THEY ARE NOT. Mapping
// reps one at a time replays each in turn and the first one's stickies block the others —
// the exact defect this repairs. The check below is mechanical: an attributable member
// with no jobber_user_id aborts the run. It cannot check the other half — that every
// person who SHOULD be a rep has been added at all — so the operator does that.
//
// THE ORDER, WHICH IS THE WHOLE DESIGN: discard what the engine wrote → close the open
// co-assignment flags → replay once with everyone mapped. No Jobber call at any point;
// the replay reads the stored facts (crm_request_facts / crm_quote_facts), so this needs
// no re-import.
//
// WHAT SURVIVES, DELIBERATELY:
//   · sticky_source = 'manual'        — A36.3 makes an admin's assignment the override.
//   · provisional_source = 'qr_link'  — the engine already treats it as precedence.
//   · written_by = 'live'             — anything a webhook wrote since the import.
//   · anything the replay could not recreate — R5k, below, and it outranks all three.
//
// ── R5k, AND IT CHANGED WHAT THE THREE LINES ABOVE ARE FOR (Danny, 2026-09-24) ──
// ⚠ THE RULE IS NOW: THE REBUILD NEVER CLEARS AN ASSIGNMENT IT CANNOT RECREATE FROM SAVED
// FACTS. Before this, the marker and the source were the whole test, and they answer *who
// wrote this row* — never *can it come back*. A live webhook write from before the doors
// captured facts (Commit 5) leaves no fact behind, so the replay that follows the discard
// has nothing to read and the row is simply gone, under a summary reporting success.
// ⚠ AND IT IS WHY A LEGACY `written_by` NULL ROW IS NOW SAFE BY DEFAULT. This block used to
// say the NULL assumption was "true for the account this was built for and FALSE for a
// contractor with months of live activity", with `treatNullAsReplay: false` as the operator's
// only way out. That is superseded, not merely softened: the assumption still decides which
// rows are CANDIDATES for clearing, but a NULL row with no recreatable history is now spared
// by the guard whatever the flag says. The count of NULL candidate rows is still logged
// before it acts, and the flag still works, because narrowing the candidate set is a
// different and still-useful lever.
// ⚠ WHAT THE GUARD CANNOT SEE — see recreatableClientsSql in attributionReplay.js. It proves
// the replay will VISIT a client, not that it will write the same row back. A preview mode
// is the honest fix for that and is filed, not built.

const { pool } = require('../db');
const { replayForMappedReps, mappedAttributableUserIds, recreatableClientsSql } = require('../utils/attributionReplay');
const { logError: realLogError } = require('../middleware/errorLogger');

// The first N kept client ids that go in the log, per Q8 (Danny, 2026-09-24).
// ⚠ THE TOTAL IS PRINTED BESIDE THE LIST AND IS NOT DECORATION: a truncated list with no
// total reads exactly like a complete one, which is the failure this bound would otherwise
// introduce. A list that can only be trusted when it is short is not a report.
const KEPT_LOG_LIMIT = 50;

// The sources the ENGINE writes. 'manual' and 'qr_link' are deliberately absent.
const ENGINE_STICKY_SOURCES = ['quote_salesperson', 'promoted_provisional', 'mode_a_at_close', 'mode_b_at_close'];
const ENGINE_PROVISIONAL_SOURCES = ['mode_a', 'mode_b'];

/**
 * Refuse unless every attributable team member is mapped to a Jobber user.
 * Returns the unmapped members, empty when the precondition holds.
 */
async function unmappedAttributableReps(db, contractorId) {
  const { rows } = await db.query(
    // ⚠ ACTIVE ONLY (Danny, 2026-09-22). A DEACTIVATED member is not "a rep waiting to be
    // mapped" — they have left, their clients are history, and nothing about them can be
    // fixed by mapping. Counting them would let one departed colleague block the rebuild
    // permanently, which is a refusal nobody can clear.
    `SELECT id, email, full_name FROM team_members
      WHERE contractor_id = $1 AND is_attributable = true AND active = true
        AND jobber_user_id IS NULL
      ORDER BY id`,
    [contractorId]
  );
  return rows;
}

/**
 * Discard the engine-written halves of this contractor's assignments — but only where the
 * replay could put them back (R5k).
 * Returns { stickiesCleared, provisionalsCleared, rowsDeleted, nullMarkerRows,
 *           keptUnrecreatableTotal, keptUnrecreatable }.
 *
 * ⚠ A CONTRACTOR WITH NO MAPPED ATTRIBUTABLE REPS CLEARS NOTHING, AND THAT IS CORRECT RATHER
 * THAN A DEGENERATE CASE: the recreatable set is empty because the replay would visit nobody,
 * so every candidate row is spared and listed. The run is a no-op that says so.
 *
 * ⚠ IT CLEARS HALVES, NOT ROWS. One row can carry a manual sticky AND an engine-written
 * provisional; deleting it would throw away the admin's decision. Rows left with neither
 * rep are then removed, because an all-null row means nothing and the engine re-inserts.
 *
 * ⚠ THE MARKER IS PER ROW, NOT PER HALF, AND ONE CASE ESCAPES BECAUSE OF IT. `written_by`
 * is a single column, so a row whose LAST writer was the admin reads 'manual' and its
 * engine-written provisional is out of this discard's reach. Harmless: the sticky wins
 * every read (OWN_BOOK_PREDICATE is COALESCE(sticky, provisional)) and the replay
 * overwrites provisionals anyway. The alternative is a second marker column for a value
 * nobody reads. Found by a test and kept as a decision — see repAssignmentRebuild.test.js.
 * ⚠ AND `sticky_source` IS WHAT ACTUALLY PROTECTS A MANUAL ASSIGNMENT, not the marker: a
 * manual sticky is excluded by source whatever `written_by` happens to say.
 */
async function discardEngineAssignments(db, { contractorId, treatNullAsReplay }) {
  // `written_by = ANY($2)` with 'replay' plus, optionally, a NULL match. Written as an
  // explicit OR rather than a clever array so the NULL rule is readable at the call site.
  const markerClause = treatNullAsReplay
    ? `(written_by = 'replay' OR written_by IS NULL)`
    : `(written_by = 'replay')`;

  // ── R5k: NEVER CLEAR WHAT CANNOT BE RECREATED (Danny, 2026-09-24) ───────────────────
  //
  // ⚠ THE THREE PREDICATES BELOW USED TO ASK ONLY *WHO WROTE THIS ROW*, NEVER *CAN IT COME
  // BACK*. Those are different questions and the gap between them is where rows died: a
  // pre-Commit-5 live webhook write left no fact behind, so the replay that follows the
  // discard has nothing to read, and the row is simply gone — silently, with the summary
  // reporting a successful rebuild. The marker cannot see this, because the marker is about
  // authorship and the loss is about evidence.
  //
  // ⚠ THE PREDICATE IS COMPOSED FROM THE REPLAY'S OWN SQL, NOT RE-WRITTEN HERE. See
  // recreatableClientsSql — the set this clears must be exactly the set the replay walks,
  // and two hand-written copies of one UNION is how a guard ends up proving the wrong thing.
  const mappedUserIds = await mappedAttributableUserIds(db, contractorId);
  // ⚠ `NOT IN (subquery)` IS SAFE HERE AND IT IS WORTH SAYING WHY, BECAUSE IT USUALLY IS NOT:
  // a single NULL anywhere in the subquery makes NOT IN return NULL for every row, which reads
  // as "nothing is unrecreatable" and would silently switch the guard off. It cannot happen
  // here — both arms select `jobber_client_id`, declared NOT NULL on crm_request_facts and on
  // crm_quote_facts (server/db.js). If either column ever becomes nullable, this must become
  // NOT EXISTS.
  const recreatable = `jobber_client_id IN (${recreatableClientsSql('$1', '$2')})`;
  const notRecreatable = `jobber_client_id NOT IN (${recreatableClientsSql('$1', '$2')})`;

  const { rows: nullRows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM client_rep_assignments
      WHERE contractor_id = $1 AND written_by IS NULL
        AND (sticky_source = ANY($2::text[]) OR provisional_source = ANY($3::text[]))`,
    [contractorId, ENGINE_STICKY_SOURCES, ENGINE_PROVISIONAL_SOURCES]
  );

  // ⚠ READ BEFORE ACTING. These are the rows the marker and the source WOULD have cleared
  // and the guard is sparing — so they can only be identified while they still exist. A
  // count alone sends the operator to SQL to find out which clients; the ids are what say
  // the rebuild deliberately left work behind (Q8).
  const { rows: keptRows } = await db.query(
    `SELECT jobber_client_id, sticky_source, provisional_source, written_by
       FROM client_rep_assignments
      WHERE contractor_id = $1
        AND (sticky_source = ANY($3::text[]) OR provisional_source = ANY($4::text[]))
        AND ${markerClause}
        AND ${notRecreatable}
      ORDER BY jobber_client_id`,
    [contractorId, mappedUserIds, ENGINE_STICKY_SOURCES, ENGINE_PROVISIONAL_SOURCES]
  );

  const sticky = await db.query(
    `UPDATE client_rep_assignments
        SET sticky_rep_id = NULL, sticky_source = NULL, sticky_set_at = NULL, updated_at = NOW()
      WHERE contractor_id = $1 AND sticky_source = ANY($3::text[]) AND ${markerClause}
        AND ${recreatable}`,
    [contractorId, mappedUserIds, ENGINE_STICKY_SOURCES]
  );
  const provisional = await db.query(
    `UPDATE client_rep_assignments
        SET provisional_rep_id = NULL, provisional_source = NULL, provisional_set_at = NULL, updated_at = NOW()
      WHERE contractor_id = $1 AND provisional_source = ANY($3::text[]) AND ${markerClause}
        AND ${recreatable}`,
    [contractorId, mappedUserIds, ENGINE_PROVISIONAL_SOURCES]
  );
  // ⚠ GUARDED TOO, AND THE REASON IS THAT IT IS THE ONLY UNGATED STATEMENT HERE. It carries
  // neither a source nor a marker predicate, so without the guard it is the one statement
  // that could still reach a row the two above just spared. Its cost is that a row left
  // all-null by something else survives the run; an all-null row carries no assignment, so
  // that is the cheap side of the trade.
  const deleted = await db.query(
    `DELETE FROM client_rep_assignments
      WHERE contractor_id = $1 AND sticky_rep_id IS NULL AND provisional_rep_id IS NULL
        AND ${recreatable}`,
    [contractorId, mappedUserIds]
  );

  return {
    stickiesCleared: sticky.rowCount,
    provisionalsCleared: provisional.rowCount,
    rowsDeleted: deleted.rowCount,
    nullMarkerRows: nullRows[0].n,
    keptUnrecreatableTotal: keptRows.length,
    keptUnrecreatable: keptRows.slice(0, KEPT_LOG_LIMIT).map((r) => ({
      jobberClientId: r.jobber_client_id,
      stickySource: r.sticky_source,
      provisionalSource: r.provisional_source,
      writtenBy: r.written_by,
    })),
  };
}

/**
 * Close the OPEN co-assignment flags before replaying.
 *
 * ⚠ AN OPEN FLAG SUPPRESSES THE CORRECT NEW ONE. writeCoAssignmentFlag returns early when
 * an open flag already exists on the client, so a flag raised under the old, partial
 * mapping would both survive and block the flag the rebuild should raise. Closing loses
 * nothing: an OPEN flag is by definition one nobody has acted on, and the replay re-raises
 * it if it is still true. ⚠ Flags an admin has RESOLVED are not open and are not touched.
 */
async function closeOpenCoAssignmentFlags(db, contractorId) {
  const { rowCount } = await db.query(
    `UPDATE flagged_assignments
        SET status = 'auto_resolved', resolved_at = NOW()
      WHERE contractor_id = $1 AND status = 'open' AND flag_reason = 'rep_co_assignment'`,
    [contractorId]
  );
  return rowCount;
}

/**
 * The whole operation. Returns a summary, or { refused: <reason> }.
 * Never throws — an operator reads the log, not a stack trace.
 */
async function runAssignmentRebuild(db, { contractorId, treatNullAsReplay = true, logError = realLogError } = {}) {
  try {
    const { rows: exists } = await db.query(`SELECT 1 FROM contractors WHERE id = $1`, [contractorId]);
    if (exists.length === 0) return { refused: `no such contractor: ${contractorId}` };

    const unmapped = await unmappedAttributableReps(db, contractorId);
    if (unmapped.length > 0) {
      return {
        refused: `${unmapped.length} attributable team member(s) have no jobber_user_id — map every rep first, `
          + `then re-run: ${unmapped.map((m) => m.full_name || m.email).join(', ')}`,
      };
    }

    const discarded = await discardEngineAssignments(db, { contractorId, treatNullAsReplay });
    const flagsClosed = await closeOpenCoAssignmentFlags(db, contractorId);
    const replay = await replayForMappedReps(db, { contractorId, logError });

    return {
      ...discarded,
      treatNullAsReplay,
      flagsClosed,
      clientsReplayed: replay ? replay.clientsDone : 0,
      replayFailed: replay ? replay.failed : 0,
    };
  } catch (err) {
    await logError({ req: null, contractorId, error: err, source: 'repAssignmentRebuild' });
    return { refused: `failed: ${err.message}` };
  }
}

/**
 * Boot entry point. Does nothing unless REP_ASSIGNMENT_REBUILD names a contractor.
 * ⚠ THE OPERATOR REMOVES THE VAR AFTERWARDS: while it is set, every restart re-runs the
 * rebuild. That is idempotent in effect (discard then replay reaches the same state from
 * the same facts) but it is wasted work and it would keep closing flags raised in between.
 */
async function startAssignmentRebuildIfRequested(db = pool, { env = process.env, logError = realLogError } = {}) {
  const contractorId = (env.REP_ASSIGNMENT_REBUILD || '').trim();
  if (!contractorId) return null;

  // diagnostic log — intentional
  console.log(`[repAssignmentRebuild] REQUESTED for ${contractorId} — discarding engine-written assignments, `
    + 'then replaying from stored facts. Remove REP_ASSIGNMENT_REBUILD after this run.');
  const result = await runAssignmentRebuild(db, { contractorId, logError });

  if (result.refused) {
    // diagnostic log — intentional
    console.warn(`[repAssignmentRebuild] REFUSED — ${result.refused}`);
    return result;
  }
  // diagnostic log — intentional
  console.log(`[repAssignmentRebuild] ${contractorId} — ${result.stickiesCleared} stickies and `
    + `${result.provisionalsCleared} provisionals cleared (${result.rowsDeleted} rows removed), of which `
    + `${result.nullMarkerRows} carried NO written_by marker and were treated as replay-written `
    + `(treatNullAsReplay=${result.treatNullAsReplay}); ${result.flagsClosed} open co-assignment flags closed; `
    + `${result.clientsReplayed} clients replayed, ${result.replayFailed} failed`);

  // ⚠ R5k's closure half: the rows the rebuild DECLINED to touch, by client id. The total is
  // printed whether or not the list is truncated — a list alone cannot tell the operator
  // whether it is all of them, and at KEPT_LOG_LIMIT it would not be.
  if (result.keptUnrecreatableTotal > 0) {
    // diagnostic log — intentional
    console.log(`[repAssignmentRebuild] ${contractorId} — KEPT ${result.keptUnrecreatableTotal} assignment(s) `
      + `the replay could not recreate from stored facts (showing ${result.keptUnrecreatable.length}): `
      + result.keptUnrecreatable
        .map((r) => `${r.jobberClientId} [sticky=${r.stickySource || '-'} provisional=${r.provisionalSource || '-'} `
          + `written_by=${r.writtenBy || 'NULL'}]`)
        .join(', '));
  }
  return result;
}

module.exports = {
  startAssignmentRebuildIfRequested,
  runAssignmentRebuild,
  discardEngineAssignments,
  closeOpenCoAssignmentFlags,
  unmappedAttributableReps,
  ENGINE_STICKY_SOURCES,
  ENGINE_PROVISIONAL_SOURCES,
};
