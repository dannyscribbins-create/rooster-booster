'use strict';

// ── WHO IS THIS CLIENT ASSIGNED TO — FOR THE ADMIN PANEL (Danny, 2026-09-22) ──
//
// Until now an admin could see an assignment ONLY in the Flagged queue, which lists only
// clients carrying an open flag — so a contractor whose attribution went wrong had no
// recourse inside the product. This is the read half of the correction path; the write
// half is PATCH /api/admin/team/client-assignment/:jobberClientId.
//
// ⚠ UNASSIGNED IS THE COMMON CASE AND IS NOT AN ERROR. Measured on Accent 2026-09-22:
// 1,990 clients carry an eligible approved quote whose author is mapped to nobody, and
// they are correctly unassigned because nobody is mapped yet. A surface that renders
// "none" as a warning would be shouting about the normal state of a new contractor.

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
    `SELECT cra.sticky_rep_id, cra.sticky_source, cra.sticky_set_at,
            cra.provisional_rep_id, cra.provisional_source, cra.provisional_set_at,
            cra.written_by,
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
    set_at:       locked ? row.sticky_set_at : row.provisional_set_at,
    written_by:   row.written_by || null,
  };
}

module.exports = { getClientAssignment, SOURCE_LABELS };
