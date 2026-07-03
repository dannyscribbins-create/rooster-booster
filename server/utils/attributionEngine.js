'use strict';

const { logError: realLogError } = require('../middleware/errorLogger');

// Assigns a sales rep to a referred Jobber client.
//
// Inputs:
//   pool              — pg Pool
//   contractorId      — contractor owning this client
//   jobberClientId    — Jobber client being evaluated
//   currentStatus     — pipeline status from classifyPipelineStatus
//   client            — Jobber client object; must include quotes.nodes with quoteStatus,
//                       salesperson.id, and lastTransitioned { approvedAt }
//   fetchAttributionData — async (jobberClientId, token) => { assessments, requests }
//                          REQUIRED in production; omit only in tests that don't reach
//                          the provisional step
//   token             — Jobber access token passed to fetchAttributionData
//   logError          — injectable; defaults to real logError for production
//
// Order of operations (contractual — do not reorder):
//   1. Guard on contractorId / jobberClientId
//   2. Read existing client_rep_assignments row
//   3. Sticky short-circuit: return if sticky already set
//   4. Early missing-fetcher detection: logError once, set skipProvisional; gate still runs
//   5. Sticky gate: fires when status NOT IN ('lead','inspection','not_sold')
//   6. Provisional step: skipped when skipProvisional
async function runAttributionEngine(pool, {
  contractorId,
  jobberClientId,
  currentStatus,
  client,
  fetchAttributionData,
  token,
  logError = realLogError,
}) {
  // 1. Guard — fail closed on missing identity
  if (!contractorId || !jobberClientId) return;

  // 2. Read existing assignment row
  const { rows: existing } = await pool.query(
    `SELECT provisional_rep_id, provisional_source, sticky_rep_id
     FROM client_rep_assignments
     WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, jobberClientId]
  );
  const existingRow = existing[0] || null;
  const currentProvisionalRepId = existingRow ? existingRow.provisional_rep_id : null;
  const currentProvisionalSource = existingRow ? existingRow.provisional_source : null;

  // 3. Sticky short-circuit
  if (existingRow && existingRow.sticky_rep_id != null) return;

  // 4. Early missing-fetcher check — log once and mark provisional as skipped;
  // the sticky gate reads only from the client object and runs regardless.
  let skipProvisional = false;
  if (!fetchAttributionData) {
    await logError({
      req: null,
      error: new Error('runAttributionEngine: fetchAttributionData is required in production'),
      source: 'attributionEngine/provisional',
    });
    skipProvisional = true;
  }

  // 5. Sticky gate — exclusion list fails open so unknown future statuses trigger attribution
  const GATE_EXCLUSIONS = new Set(['lead', 'inspection', 'not_sold']);
  if (!GATE_EXCLUSIONS.has(currentStatus)) {
    const quoteNodes = (client && client.quotes && client.quotes.nodes) ? client.quotes.nodes : [];
    const approvedQuotes = quoteNodes.filter(q => q.quoteStatus === 'approved');

    // Pick the most recently transitioned approved quote; handles multi-quote tiebreak
    const winnerQuote = approvedQuotes.reduce((best, q) => {
      if (!best) return q;
      return new Date(q.lastTransitioned?.approvedAt) > new Date(best.lastTransitioned?.approvedAt) ? q : best;
    }, null);

    let stickyRepId = null;
    let stickySource = null;

    // Prefer attributable quote salesperson
    if (winnerQuote && winnerQuote.salesperson && winnerQuote.salesperson.id) {
      const { rows: attrRows } = await pool.query(
        `SELECT id FROM team_members
         WHERE contractor_id = $1 AND jobber_user_id = $2 AND is_attributable = true`,
        [contractorId, winnerQuote.salesperson.id]
      );
      if (attrRows.length > 0) {
        stickyRepId = attrRows[0].id;
        stickySource = 'quote_salesperson';
      }
    }

    // Fall back to promoting the provisional rep
    if (stickyRepId === null && currentProvisionalRepId != null) {
      stickyRepId = currentProvisionalRepId;
      stickySource = 'promoted_provisional';
    }

    if (stickyRepId !== null) {
      // WHERE guard prevents overwriting an existing sticky under a concurrent race
      await pool.query(
        `INSERT INTO client_rep_assignments
           (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
           sticky_rep_id = EXCLUDED.sticky_rep_id,
           sticky_source = EXCLUDED.sticky_source,
           sticky_set_at = EXCLUDED.sticky_set_at,
           updated_at    = EXCLUDED.updated_at
         WHERE client_rep_assignments.sticky_rep_id IS NULL`,
        [contractorId, jobberClientId, stickyRepId, stickySource]
      );
      return;
    }

    // Orphan: no attributable salesperson and no provisional to promote.
    // Suppress duplicate if an unreviewed orphan flag already exists.
    const { rows: existingOrphan } = await pool.query(
      `SELECT id FROM flagged_assignments
       WHERE contractor_id = $1 AND jobber_client_id = $2 AND flag_reason = 'orphan' AND reviewed = false`,
      [contractorId, jobberClientId]
    );
    if (existingOrphan.length === 0) {
      await pool.query(
        `INSERT INTO flagged_assignments
           (contractor_id, jobber_client_id, flag_reason, triggering_quote_id)
         VALUES ($1, $2, 'orphan', $3)`,
        [contractorId, jobberClientId, winnerQuote ? winnerQuote.id : null]
      );
    }
    return;
  }

  // 6. Provisional step — skipped when fetcher is absent
  if (skipProvisional) return;

  // Read attribution mode; default to mode_a when settings row is missing
  const { rows: settingsRows } = await pool.query(
    `SELECT attribution_source FROM contractor_crm_settings WHERE contractor_id = $1`,
    [contractorId]
  );
  const attributionSource = settingsRows.length > 0
    ? settingsRows[0].attribution_source
    : 'assessment_assigned_users';

  const { assessments, requests } = await fetchAttributionData(jobberClientId, token);

  if (attributionSource === 'assessment_assigned_users') {
    await applyModeA(pool, contractorId, jobberClientId, assessments, currentProvisionalSource);
  } else {
    await applyModeB(pool, contractorId, jobberClientId, requests, currentProvisionalSource);
  }
}

// Mode A: cross-reference assessment.assignedUsers against attributable team_members.
async function applyModeA(pool, contractorId, jobberClientId, assessments, currentProvisionalSource) {
  if (!assessments || assessments.length === 0) return;

  const assessment = assessments[0];
  const assignedUserIds = (assessment.assignedUsers && assessment.assignedUsers.nodes)
    ? assessment.assignedUsers.nodes.map(u => u.id)
    : [];

  if (assignedUserIds.length === 0) return;

  const { rows: matchedReps } = await pool.query(
    `SELECT id FROM team_members
     WHERE contractor_id = $1 AND is_attributable = true AND jobber_user_id = ANY($2::text[])`,
    [contractorId, assignedUserIds]
  );

  if (matchedReps.length === 0) return;

  if (matchedReps.length >= 2) {
    // Co-assignment: suppress duplicate unreviewed flags
    const { rows: existingFlag } = await pool.query(
      `SELECT id FROM flagged_assignments
       WHERE contractor_id = $1 AND jobber_client_id = $2 AND flag_reason = 'rep_co_assignment' AND reviewed = false`,
      [contractorId, jobberClientId]
    );
    if (existingFlag.length === 0) {
      await pool.query(
        `INSERT INTO flagged_assignments
           (contractor_id, jobber_client_id, flag_reason, reps_involved, triggering_assessment_id)
         VALUES ($1, $2, 'rep_co_assignment', $3::jsonb, $4)`,
        [contractorId, jobberClientId, JSON.stringify(matchedReps.map(r => r.id)), assessment.id]
      );
    }
    return;
  }

  // Exactly one attributable match — qr_link source takes precedence over mode_a
  if (currentProvisionalSource === 'qr_link') return;

  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at, updated_at)
     VALUES ($1, $2, $3, 'mode_a', NOW(), NOW())
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       provisional_rep_id = EXCLUDED.provisional_rep_id,
       provisional_source = EXCLUDED.provisional_source,
       provisional_set_at = EXCLUDED.provisional_set_at,
       updated_at         = EXCLUDED.updated_at`,
    [contractorId, jobberClientId, matchedReps[0].id]
  );
}

// Mode B: read request.salesperson and match against attributable team_members.
async function applyModeB(pool, contractorId, jobberClientId, requests, currentProvisionalSource) {
  if (!requests || requests.length === 0) return;

  const request = requests[0];
  if (!request.salesperson || !request.salesperson.id) return;

  const { rows: matchedReps } = await pool.query(
    `SELECT id FROM team_members
     WHERE contractor_id = $1 AND is_attributable = true AND jobber_user_id = $2`,
    [contractorId, request.salesperson.id]
  );

  if (matchedReps.length === 0) return;

  // qr_link source takes precedence over mode_b
  if (currentProvisionalSource === 'qr_link') return;

  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at, updated_at)
     VALUES ($1, $2, $3, 'mode_b', NOW(), NOW())
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       provisional_rep_id = EXCLUDED.provisional_rep_id,
       provisional_source = EXCLUDED.provisional_source,
       provisional_set_at = EXCLUDED.provisional_set_at,
       updated_at         = EXCLUDED.updated_at`,
    [contractorId, jobberClientId, matchedReps[0].id]
  );
}

module.exports = { runAttributionEngine };
