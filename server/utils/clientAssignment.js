'use strict';

// ── WHO IS THIS CLIENT ASSIGNED TO — FOR THE ADMIN PANEL (Danny, 2026-09-22) ──
//
// Until now an admin could see an assignment ONLY in the Flagged queue, which lists only
// clients carrying an open flag — so a contractor whose attribution went wrong had no
// recourse inside the product. This is the read half of the correction path; the write
// half is PATCH /api/admin/team/client-assignment/:jobberClientId.
// ⚠ AND SINCE 3d PHASE 1b COMMIT 3 THE WRITE ITSELF LIVES HERE TOO — `writeManualSticky`
// at the bottom of this file, shared by BOTH admin routes. The sentence above still names
// the right ENTRY POINT; what moved is the statement, not the route.
//
// ⚠ UNASSIGNED IS THE COMMON CASE AND IS NOT AN ERROR. Measured on Accent 2026-09-22:
// 1,990 clients carry an eligible approved quote whose author is mapped to nobody, and
// they are correctly unassigned because nobody is mapped yet. A surface that renders
// "none" as a warning would be shouting about the normal state of a new contractor.

// ⚠ assignedAt.js REQUIRES NOTHING, so importing it here cannot make a cycle — worth
// stating because this file IS imported by routes/admin/team.js, which is where a cycle
// would surface as an `undefined` at call time rather than as an error.
const { FACT_KINDS, ASSIGNED_COLUMNS, assignedAtSetClause } = require('./assignedAt');

// The stored source values, in words a contractor can read. ⚠ The KEY set is the
// `sticky_source` / `provisional_source` CHECK constraints — if a value is added there
// and not here, the surface falls back to the raw value rather than rendering blank.
const SOURCE_LABELS = {
  manual:                'Set by an admin',
  quote_salesperson:     'Named on the approved quote',
  promoted_provisional:  'Confirmed when the job was created',
  mode_a_at_close:       'On the assessment when the job was created',
  mode_b_at_close:       'Named on the request when the job was created',
  mode_a:                'On the assessment for this visit',
  mode_b:                'Named on the request',
  qr_link:               'Scanned this rep\'s QR link',
};

/**
 * One client's assignment, shaped for a surface.
 * Returns null when the client has no assignment row at all.
 *
 * `state` is 'locked' (a sticky — someone confirmed it) or 'provisional' (the engine's
 * current best answer, which a later replay may revise). ⚠ The two are NOT a ranking of
 * how much a rep owns the client: book membership is COALESCE(sticky, provisional), so a
 * provisional client is fully in that rep's book. The difference is CONFIDENCE.
 */
async function getClientAssignment(db, contractorId, jobberClientId) {
  if (!contractorId || !jobberClientId) return null;
  const { rows } = await db.query(
    `SELECT cra.sticky_rep_id, cra.sticky_source,
            cra.provisional_rep_id, cra.provisional_source,
            cra.assigned_at, cra.written_by,
            tm.full_name, tm.email, tm.active
       FROM client_rep_assignments cra
       LEFT JOIN team_members tm ON tm.id = COALESCE(cra.sticky_rep_id, cra.provisional_rep_id)
      WHERE cra.contractor_id = $1 AND cra.jobber_client_id = $2`,
    [contractorId, jobberClientId]
  );
  const row = rows[0];
  if (!row) return null;

  const repId = row.sticky_rep_id || row.provisional_rep_id;
  if (!repId) return null;  // a row can exist with both halves cleared

  const locked = row.sticky_rep_id != null;
  const source = locked ? row.sticky_source : row.provisional_source;
  return {
    rep_id:       repId,
    rep_name:     row.full_name || row.email || null,
    rep_active:   row.active !== false,
    state:        locked ? 'locked' : 'provisional',
    source,
    source_label: SOURCE_LABELS[source] || source || null,
    // ⚠ ONE COLUMN, AND THIS CLOSES THE LAST DIVERGENT READER IN THE PHASE. It read
    // `locked ? row.sticky_set_at : row.provisional_set_at` — branching on the REP-ID
    // column while every other reader branched on which DATE was non-null. A row with a
    // sticky rep and a NULL sticky_set_at made the admin card and the rep surfaces
    // disagree, and source could not prove that shape unreachable. With one stored date
    // there is nothing left to branch on, so the divergence cannot exist.
    // ⚠ The serialised NAME stays `set_at`, so AssignedRepCard.jsx is unchanged.
    set_at:       row.assigned_at,
    written_by:   row.written_by || null,
  };
}

// ── THE MANUAL STICKY, WRITTEN ONCE (3d Phase 1b Commit 3) ───────────────────
//
// Both admin write paths — PATCH /api/admin/team/flagged-assignments/:id with
// action='assign', and PATCH /api/admin/team/client-assignment/:jobberClientId — wrote
// BYTE-IDENTICAL INSERT ... ON CONFLICT statements. Two copies of one statement is how a
// fix lands in one of them, and the batch ruling requires the same-rep guard to live in a
// single shared writer rather than be pasted into both.
//
// ⚠ A36.3 IS THE RULE THIS FUNCTION MUST NOT BREAK: A MANUAL ASSIGNMENT ALWAYS SUPERSEDES
// WHATEVER THE ENGINE DECIDED. So there is deliberately NO `WHERE sticky_rep_id IS NULL`
// here, unlike the engine's writeSticky. Both routes recorded that absence as a ruling in
// their own comments before this extraction, and it must survive it.
// ⚠ THE SAME-REP GUARD IS ON THE DATE ONLY, AND CONFLATING THE TWO IS THE ONE WAY THIS
// COMMIT COULD GO WRONG. assignedAtSetClause governs assigned_at and the R5h triple; the
// REP, the SOURCE and the MARKER are written unconditionally every time. A guard that
// leaked onto sticky_rep_id would make a manual re-assign to a different rep fail
// silently — the exact opposite of A36.3 — and every date assertion here would still pass.
//
// ⚠ IT TAKES `tx`, NEVER THE POOL. Both routes run inside an explicit BEGIN/COMMIT on a
// checked-out client, and a writer bound to the pool would land on a different connection:
// outside the transaction, so it would SURVIVE A ROLLBACK that was supposed to undo it.
//
// ⚠ IT DOES NOT VALIDATE THE REP, AND THAT IS DELIBERATE RATHER THAN AN OVERSIGHT. The two
// routes validate differently today — the flagged path requires `is_attributable`, the
// correction path requires `is_attributable AND active` — and that asymmetry is a KNOWN,
// SEPARATELY FILED item. Folding validation in here would silently resolve it as a side
// effect of an extraction, which is not a decision this commit gets to make.
//
// ⚠ THREE 'manual's, THREE DIFFERENT VOCABULARIES, AND THEY ONLY LOOK LIKE ONE.
//   · sticky_source = 'manual'      — WHY this rep (the *_source CHECK constraint's vocabulary,
//                                     and what protects the row from the rebuild's discard)
//   · written_by = 'manual'         — WHO put it there (the rebuild's marker vocabulary)
//   · assigned_fact_kind = 'manual' — WHAT dated it (R5h's vocabulary)
// Three questions, one word. Do not "dedupe" them into a shared constant: they are owned by
// three different mechanisms and any one of them could change without the others.
//
// ⚠ THE FACT TIME IS NOW(), AND THAT IS NOT THE 'write_time' FALLBACK. For a manual
// assignment the admin's decision IS the fact, so its own time IS the write time — they
// coincide in value and differ entirely in meaning. 'write_time' means "no fact time was
// available"; 'manual' means "the fact happened now". This is also why this writer does not
// route through normaliseFact, whose rule ("no time -> write_time") is right for the engine
// and wrong here. Both timestamps come from the SAME statement's NOW(), which Postgres
// fixes at transaction start, so assigned_at and assigned_fact_at are the same instant by
// construction rather than by luck.
async function writeManualSticky(tx, { contractorId, jobberClientId, repId }) {
  if (!contractorId || !jobberClientId) throw new Error('writeManualSticky: contractorId and jobberClientId are required');
  if (repId == null) throw new Error('writeManualSticky: repId is required — use the DELETE path to clear');
  await tx.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at, written_by,
        ${ASSIGNED_COLUMNS})
     VALUES ($1, $2, $3, 'manual', NOW(), NOW(), 'manual', NOW(), $4, NULL, NOW())
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       sticky_rep_id = EXCLUDED.sticky_rep_id,
       sticky_source = EXCLUDED.sticky_source,
       sticky_set_at = EXCLUDED.sticky_set_at,
       updated_at    = EXCLUDED.updated_at,
       written_by    = EXCLUDED.written_by,
       ${assignedAtSetClause('sticky')}`,
    [contractorId, jobberClientId, repId, FACT_KINDS.MANUAL]
  );
}

module.exports = { getClientAssignment, writeManualSticky, SOURCE_LABELS };
