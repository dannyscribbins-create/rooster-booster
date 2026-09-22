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
// ⚠ AND THE ASSUMPTION IT STATES RATHER THAN MAKES: rows with written_by NULL predate the
// marker column, and this treats them as REPLAY-WRITTEN. That is true for the account this
// was built for (one import, one replay, no live rep traffic yet) and FALSE for a
// contractor with months of live activity after their import. The count of NULL rows it is
// about to discard is logged before it acts, and `treatNullAsReplay: false` is how an
// operator declines that assumption.

const { pool } = require('../db');
const { replayForMappedReps } = require('../utils/attributionReplay');
const { logError: realLogError } = require('../middleware/errorLogger');

// The sources the ENGINE writes. 'manual' and 'qr_link' are deliberately absent.
const ENGINE_STICKY_SOURCES = ['quote_salesperson', 'promoted_provisional', 'mode_a_at_close', 'mode_b_at_close'];
const ENGINE_PROVISIONAL_SOURCES = ['mode_a', 'mode_b'];

/**
 * Refuse unless every attributable team member is mapped to a Jobber user.
 * Returns the unmapped members, empty when the precondition holds.
 */
async function unmappedAttributableReps(db, contractorId) {
  const { rows } = await db.query(
    `SELECT id, email, full_name FROM team_members
      WHERE contractor_id = $1 AND is_attributable = true AND jobber_user_id IS NULL
      ORDER BY id`,
    [contractorId]
  );
  return rows;
}

/**
 * Discard the engine-written halves of this contractor's assignments.
 * Returns { stickiesCleared, provisionalsCleared, rowsDeleted, nullMarkerRows }.
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

  const { rows: nullRows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM client_rep_assignments
      WHERE contractor_id = $1 AND written_by IS NULL
        AND (sticky_source = ANY($2::text[]) OR provisional_source = ANY($3::text[]))`,
    [contractorId, ENGINE_STICKY_SOURCES, ENGINE_PROVISIONAL_SOURCES]
  );

  const sticky = await db.query(
    `UPDATE client_rep_assignments
        SET sticky_rep_id = NULL, sticky_source = NULL, sticky_set_at = NULL, updated_at = NOW()
      WHERE contractor_id = $1 AND sticky_source = ANY($2::text[]) AND ${markerClause}`,
    [contractorId, ENGINE_STICKY_SOURCES]
  );
  const provisional = await db.query(
    `UPDATE client_rep_assignments
        SET provisional_rep_id = NULL, provisional_source = NULL, provisional_set_at = NULL, updated_at = NOW()
      WHERE contractor_id = $1 AND provisional_source = ANY($2::text[]) AND ${markerClause}`,
    [contractorId, ENGINE_PROVISIONAL_SOURCES]
  );
  const deleted = await db.query(
    `DELETE FROM client_rep_assignments
      WHERE contractor_id = $1 AND sticky_rep_id IS NULL AND provisional_rep_id IS NULL`,
    [contractorId]
  );

  return {
    stickiesCleared: sticky.rowCount,
    provisionalsCleared: provisional.rowCount,
    rowsDeleted: deleted.rowCount,
    nullMarkerRows: nullRows[0].n,
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
