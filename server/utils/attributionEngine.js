'use strict';

const { logError: realLogError } = require('../middleware/errorLogger');

// Anchor = pipeline_cache.created_at (first-seen time), NOT the actual referral moment in
// Jobber — it lags behind the true referral by however long until our sync first observes the
// "Referred by" field. Normally that's under the ~30min sync cadence, but it is unboundedly
// wider during a sync outage (Bug 1, Session 93: syncs were dead for 2 days) or when a rep
// back-fills the referral field days after the underlying request/quote was already created.
// GRACE_MS absorbs that lag by shifting the eligibility cutoff earlier than the anchor itself.
// Trade-off: a quote/request from an UNRELATED prior visit that happens to fall within the
// GRACE window before detection can still win attribution — accepted, because the alternative
// (no grace) systematically orphans every referral that lands during a sync outage or a
// late-set referral field, which is worse and more common than a coincidental same-week
// unrelated closing.
const GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// A quote is eligible for the sticky gate's quote_salesperson match only if: it was never
// archived (archived means rejected/superseded, even if once approved), it has a recorded
// approvedAt (was ever actually approved), and that approvedAt is not earlier than the
// referral anchor minus GRACE_MS. Missing referralAnchor fails closed — never eligible.
function isQuoteEligible(quote, referralAnchor) {
  if (!referralAnchor) return false;
  if (quote.quoteStatus === 'archived') return false;
  const approvedAt = quote.lastTransitioned?.approvedAt;
  if (!approvedAt) return false;
  const cutoff = new Date(referralAnchor).getTime() - GRACE_MS;
  return new Date(approvedAt).getTime() >= cutoff;
}

// A request is eligible for Mode A/B selection only if its createdAt is not earlier than the
// referral anchor minus GRACE_MS. Missing referralAnchor fails closed — never eligible.
function isRequestEligible(request, referralAnchor) {
  if (!referralAnchor) return false;
  const cutoff = new Date(referralAnchor).getTime() - GRACE_MS;
  return new Date(request.createdAt).getTime() >= cutoff;
}

async function getAttributionSource(pool, contractorId) {
  const { rows } = await pool.query(
    `SELECT attribution_source FROM contractor_crm_settings WHERE contractor_id = $1`,
    [contractorId]
  );
  return rows.length > 0 ? rows[0].attribution_source : 'assessment_assigned_users';
}

// Resolves Mode A's match from in-grace requests-with-assessment (anchor filtering happens
// BEFORE match-counting, so an excluded pre-anchor rep can never contribute to a co-assignment
// flag). requests must already be sorted newest-first (fetchAttributionData's contract).
// Returns { type: 'none' } | { type: 'single', repId, assessmentId } | { type: 'multiple', repIds, assessmentId }.
async function resolveModeAMatch(pool, contractorId, requests, referralAnchor) {
  const eligible = (requests || []).filter(r => r.assessment != null && isRequestEligible(r, referralAnchor));
  if (eligible.length === 0) return { type: 'none' };

  const assessment = eligible[0].assessment; // most recent in-grade request with an assessment
  const assignedUserIds = (assessment.assignedUsers && assessment.assignedUsers.nodes)
    ? assessment.assignedUsers.nodes.map(u => u.id)
    : [];
  if (assignedUserIds.length === 0) return { type: 'none' };

  const { rows: matchedReps } = await pool.query(
    `SELECT id FROM team_members
     WHERE contractor_id = $1 AND is_attributable = true AND jobber_user_id = ANY($2::text[])`,
    [contractorId, assignedUserIds]
  );
  if (matchedReps.length === 0) return { type: 'none' };
  if (matchedReps.length >= 2) {
    return { type: 'multiple', repIds: matchedReps.map(r => r.id), assessmentId: assessment.id };
  }
  return { type: 'single', repId: matchedReps[0].id, assessmentId: assessment.id };
}

// Resolves Mode B's match from in-grace requests carrying a salesperson.
// Returns { type: 'none' } | { type: 'single', repId }.
async function resolveModeBMatch(pool, contractorId, requests, referralAnchor) {
  const eligible = (requests || []).filter(r => r.salesperson && r.salesperson.id && isRequestEligible(r, referralAnchor));
  if (eligible.length === 0) return { type: 'none' };

  const request = eligible[0]; // most recent in-grace request with a salesperson
  const { rows: matchedReps } = await pool.query(
    `SELECT id FROM team_members
     WHERE contractor_id = $1 AND is_attributable = true AND jobber_user_id = $2`,
    [contractorId, request.salesperson.id]
  );
  if (matchedReps.length === 0) return { type: 'none' };
  return { type: 'single', repId: matchedReps[0].id };
}

async function writeProvisional(pool, contractorId, jobberClientId, repId, source) {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       provisional_rep_id = EXCLUDED.provisional_rep_id,
       provisional_source = EXCLUDED.provisional_source,
       provisional_set_at = EXCLUDED.provisional_set_at,
       updated_at         = EXCLUDED.updated_at`,
    [contractorId, jobberClientId, repId, source]
  );
}

async function writeSticky(pool, contractorId, jobberClientId, repId, source) {
  // WHERE guard prevents overwriting an existing sticky under a concurrent race
  const result = await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       sticky_rep_id = EXCLUDED.sticky_rep_id,
       sticky_source = EXCLUDED.sticky_source,
       sticky_set_at = EXCLUDED.sticky_set_at,
       updated_at    = EXCLUDED.updated_at
     WHERE client_rep_assignments.sticky_rep_id IS NULL`,
    [contractorId, jobberClientId, repId, source]
  );

  // Auto-resolution (FA spec §4.5): rowCount > 0 means this call actually just set the
  // sticky (fresh insert, or the WHERE guard's first-ever write) — not a no-op against an
  // already-stickied client. Any OPEN flag on this exact client is now stale and self-closes;
  // other clients' flags (different jobber_client_id) are untouched.
  if (result.rowCount > 0) {
    await pool.query(
      `UPDATE flagged_assignments SET status = 'auto_resolved', resolved_at = NOW()
       WHERE contractor_id = $1 AND jobber_client_id = $2 AND status = 'open'`,
      [contractorId, jobberClientId]
    );
  }
}

// Inserts the bell-notification row for a newly-created flag (FQ-3: existing admin_messages
// inbox, missing_referral card precedent — not the notifications table).
async function insertFlagAdminMessage(pool, contractorId, flagId, title, body) {
  await pool.query(
    `INSERT INTO admin_messages (contractor_id, message_type, reference_id, title, body, color_code)
     VALUES ($1, 'flagged_assignment', $2, $3, $4, 'orange')`,
    [contractorId, flagId, title, body]
  );
}

async function writeCoAssignmentFlag(pool, contractorId, jobberClientId, repIds, assessmentId) {
  const { rows: existingFlag } = await pool.query(
    `SELECT id FROM flagged_assignments
     WHERE contractor_id = $1 AND jobber_client_id = $2 AND flag_reason = 'rep_co_assignment' AND status = 'open'`,
    [contractorId, jobberClientId]
  );
  if (existingFlag.length > 0) return;
  const { rows: inserted } = await pool.query(
    `INSERT INTO flagged_assignments
       (contractor_id, jobber_client_id, flag_reason, reps_involved, triggering_assessment_id)
     VALUES ($1, $2, 'rep_co_assignment', $3::jsonb, $4)
     RETURNING id`,
    [contractorId, jobberClientId, JSON.stringify(repIds), assessmentId]
  );
  await insertFlagAdminMessage(
    pool, contractorId, inserted[0].id,
    'Assignment Flagged: Multiple Reps Matched',
    `Client ${jobberClientId} has ${repIds.length} attributable reps matched and needs manual assignment.`
  );
}

async function writeOrphanFlag(pool, contractorId, jobberClientId, triggeringQuoteId) {
  const { rows: existingOrphan } = await pool.query(
    `SELECT id FROM flagged_assignments
     WHERE contractor_id = $1 AND jobber_client_id = $2 AND flag_reason = 'orphan' AND status = 'open'`,
    [contractorId, jobberClientId]
  );
  if (existingOrphan.length > 0) return;
  const { rows: inserted } = await pool.query(
    `INSERT INTO flagged_assignments
       (contractor_id, jobber_client_id, flag_reason, triggering_quote_id)
     VALUES ($1, $2, 'orphan', $3)
     RETURNING id`,
    [contractorId, jobberClientId, triggeringQuoteId]
  );
  await insertFlagAdminMessage(
    pool, contractorId, inserted[0].id,
    'Assignment Flagged: Unable To Auto-Assign',
    `Client ${jobberClientId} could not be automatically assigned a rep and needs manual assignment.`
  );
}

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
//   referralAnchor    — timestamp (Date or ISO string) this client was first seen as referred;
//                       pipeline_cache.created_at in production. Missing/null fails closed.
//   logError          — injectable; defaults to real logError for production
//
// Order of operations (contractual — do not reorder):
//   1. Guard on contractorId / jobberClientId
//   2. Read existing client_rep_assignments row
//   3. Sticky short-circuit: return if sticky already set
//   4. Early missing-fetcher detection: logError once, set skipProvisional; gate still runs
//   5. Sticky gate: fires when status NOT IN ('lead','inspection','not_sold'). Tries, in order:
//      eligible quote's salesperson -> promote existing provisional -> Mode A/B fallthrough
//      (direct sticky write on exactly one in-grace match, or co-assignment flag on 2+) -> orphan
//   6. Provisional step: skipped when skipProvisional
async function runAttributionEngine(pool, {
  contractorId,
  jobberClientId,
  currentStatus,
  client,
  fetchAttributionData,
  token,
  referralAnchor,
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
    const eligibleQuotes = quoteNodes.filter(q => isQuoteEligible(q, referralAnchor));

    // Pick the most recently approved ELIGIBLE quote; handles multi-quote tiebreak
    const winnerQuote = eligibleQuotes.reduce((best, q) => {
      if (!best) return q;
      return new Date(q.lastTransitioned.approvedAt) > new Date(best.lastTransitioned.approvedAt) ? q : best;
    }, null);

    let stickyRepId = null;
    let stickySource = null;

    // Prefer the eligible quote's attributable salesperson
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
      await writeSticky(pool, contractorId, jobberClientId, stickyRepId, stickySource);
      return;
    }

    // Neither an eligible quote's salesperson nor an existing provisional resolved this
    // client. Fall through to Mode A/B before giving up — a matching assessment/request
    // still in the grace window counts, even with no quote or prior provisional to promote.
    if (skipProvisional) {
      await writeOrphanFlag(pool, contractorId, jobberClientId, winnerQuote ? winnerQuote.id : null);
      return;
    }

    const attributionSource = await getAttributionSource(pool, contractorId);
    const { requests } = await fetchAttributionData(jobberClientId, token);

    if (attributionSource === 'assessment_assigned_users') {
      const match = await resolveModeAMatch(pool, contractorId, requests, referralAnchor);
      if (match.type === 'single') {
        await writeSticky(pool, contractorId, jobberClientId, match.repId, 'mode_a_at_close');
      } else if (match.type === 'multiple') {
        await writeCoAssignmentFlag(pool, contractorId, jobberClientId, match.repIds, match.assessmentId);
      } else {
        await writeOrphanFlag(pool, contractorId, jobberClientId, winnerQuote ? winnerQuote.id : null);
      }
    } else {
      const match = await resolveModeBMatch(pool, contractorId, requests, referralAnchor);
      if (match.type === 'single') {
        await writeSticky(pool, contractorId, jobberClientId, match.repId, 'mode_b_at_close');
      } else {
        await writeOrphanFlag(pool, contractorId, jobberClientId, winnerQuote ? winnerQuote.id : null);
      }
    }
    return;
  }

  // 6. Provisional step — skipped when fetcher is absent
  if (skipProvisional) return;

  const attributionSource = await getAttributionSource(pool, contractorId);
  const { requests } = await fetchAttributionData(jobberClientId, token);

  if (attributionSource === 'assessment_assigned_users') {
    const match = await resolveModeAMatch(pool, contractorId, requests, referralAnchor);
    if (match.type === 'single') {
      // Exactly one attributable match — qr_link source takes precedence over mode_a
      if (currentProvisionalSource !== 'qr_link') {
        await writeProvisional(pool, contractorId, jobberClientId, match.repId, 'mode_a');
      }
    } else if (match.type === 'multiple') {
      await writeCoAssignmentFlag(pool, contractorId, jobberClientId, match.repIds, match.assessmentId);
    }
  } else {
    const match = await resolveModeBMatch(pool, contractorId, requests, referralAnchor);
    if (match.type === 'single' && currentProvisionalSource !== 'qr_link') {
      await writeProvisional(pool, contractorId, jobberClientId, match.repId, 'mode_b');
    }
  }
}

module.exports = { runAttributionEngine };
