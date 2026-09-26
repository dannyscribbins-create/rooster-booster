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

  // ── A TRUNCATED ASSESSMENT IS NOT A SINGLE MATCH (3d Phase 1a Commit 7a-2) ──
  //
  // ⚠ assignedUsers IS CAPPED AT FIVE AND IS NOT PAGED, so "one attributable person among the
  // five we were given" is NOT the same claim as "one attributable person on this assessment".
  // A sixth assigned user is simply absent from assignedUserIds, and before 7a-2 that turned a
  // genuine co-assignment into a single match and wrote the wrong rep a STICKY — existing-wins,
  // uncorrectable by any later mapping, with no flag and nothing to notice it by.
  //
  // ⚠ IT RETURNS 'truncated' RATHER THAN 'multiple', AND THE DISTINCTION IS HONESTY.
  // We do not know that two attributable reps exist; we know we cannot tell. The caller sends it
  // to the same Flagged queue a co-assignment goes to — a human decides either way — but the
  // type keeps the two situations separable for anyone reading this code later.
  // ⚠ AND IT IS DETECTION, NOT PAGING. Nothing here fetches the sixth person. The flag says
  // "a human must look", never "here is who it was".
  if (assessment.assignedUsers && assessment.assignedUsers.pageInfo
      && assessment.assignedUsers.pageInfo.hasNextPage === true) {
    return { type: 'truncated', repIds: matchedReps.map(r => r.id), assessmentId: assessment.id };
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

// ── THE WRITER MARKER (Danny, 2026-09-22) ─────────────────────────────────────
// ⚠ PLUMBING, NOT PRODUCT. No contractor sees `written_by` and none would care. It
// exists so a rebuild can tell the REPLAY's assignments from live ones: the replay runs
// this same engine and therefore produces the same `*_source` values, which left the two
// indistinguishable. The only discriminator before this column was that Danny's replay
// happened in one burst on 2026-09-21 — true once, never a mechanism.
// ⚠ EXISTING ROWS STAY NULL, and a rebuild must SAY that it reads NULL as
// replay-written: true for Danny's data, false for a contractor with months of live
// activity after their import.
// 'live' (default) · 'replay' (attributionReplay) · 'manual' (the admin assign route,
// which writes its own row rather than calling these helpers).
async function writeProvisional(pool, contractorId, jobberClientId, repId, source, writtenBy = 'live') {
  await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at, updated_at, written_by)
     VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       provisional_rep_id = EXCLUDED.provisional_rep_id,
       provisional_source = EXCLUDED.provisional_source,
       provisional_set_at = EXCLUDED.provisional_set_at,
       updated_at         = EXCLUDED.updated_at,
       -- ⚠ A REPLAY MAY NOT DOWNGRADE A LIVE OR MANUAL MARKER (3d Phase 1a Commit 7, R5k).
       -- This was an unconditional rewrite to the incoming value, and the consequence
       -- was specific: a replay pass over a client flipped a LIVE-written provisional to
       -- 'replay', after which the operator rebuild — which discards by marker — treated
       -- somebody's webhook write as its own and discarded it. The row's marker is the only
       -- record of who wrote it, so overwriting it destroys the evidence the rebuild reads.
       -- ⚠ THE RECREATABLE GUARD IN repAssignmentRebuild.js ALSO COVERS TODAY'S INSTANCES OF
       -- THIS, AND THAT IS NOT A REASON TO SKIP THE FIX. A guard that happens to cover a bug
       -- is not a fix for it: loosen the guard and the bug returns silently, with no second
       -- mechanism left. Keep both.
       -- ⚠ A NULL STORED MARKER IS NOT PROTECTED HERE, DELIBERATELY. NULL means "written
       -- before the column existed", which is a claim about age, not about authorship —
       -- a NULL stored marker satisfies neither value in the IN test below, so the ELSE arm
       -- takes it and the row is honestly relabelled to whoever just wrote it. What keeps a
       -- legacy NULL row safe is the rebuild's recreatable guard, not this CASE.
       written_by         = CASE WHEN client_rep_assignments.written_by IN ('live', 'manual')
                                   AND EXCLUDED.written_by = 'replay'
                                 THEN client_rep_assignments.written_by
                                 ELSE EXCLUDED.written_by END`,
    [contractorId, jobberClientId, repId, source, writtenBy]
  );
}

async function writeSticky(pool, contractorId, jobberClientId, repId, source, writtenBy = 'live') {
  // WHERE guard prevents overwriting an existing sticky under a concurrent race
  const result = await pool.query(
    `INSERT INTO client_rep_assignments
       (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, updated_at, written_by)
     VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       sticky_rep_id = EXCLUDED.sticky_rep_id,
       sticky_source = EXCLUDED.sticky_source,
       sticky_set_at = EXCLUDED.sticky_set_at,
       updated_at    = EXCLUDED.updated_at,
       -- ⚠ THIS ONE IS STILL UNCONDITIONAL, AND THE ASYMMETRY WITH writeProvisional IS
       -- NAMED RATHER THAN LEFT TO BE NOTICED. A replay adding a STICKY to a row whose
       -- provisional half a webhook wrote does relabel the row 'replay'. It is the same
       -- shape as the defect fixed above and it is NOT fixed here, because reaching this
       -- line at all requires the client to have request facts (the replay's only entry
       -- point), which makes the row recreatable and therefore safe under the rebuild's
       -- guard. That is an argument resting on another file's current behaviour, so it is
       -- written down: filed on PRE_LAUNCH_CHECKLIST.md, not forgotten.
       written_by    = EXCLUDED.written_by
     WHERE client_rep_assignments.sticky_rep_id IS NULL`,
    [contractorId, jobberClientId, repId, source, writtenBy]
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

async function writeCoAssignmentFlag(pool, contractorId, jobberClientId, repIds, assessmentId, notifyAdmin = true) {
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
  // The flag ROW is always written — it is the record the admin queue resolves. Only the
  // bell is optional, for the bulk replay (see notifyAdminOnFlag below).
  if (!notifyAdmin) return;
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
//   referralAnchor    — timestamp (Date or ISO string) the eligibility window centres on.
//                       REFERRAL path: pipeline_cache.created_at (first seen as referred).
//                       REQUEST path: the triggering request's own createdAt (ruling R2,
//                       2026-09-18). Missing/null fails closed either way.
//   writeOrphanOnMiss — true (default) writes a flagged_assignments 'orphan' row plus its
//                       admin_messages bell when the sticky gate resolves nobody. FALSE
//                       records nothing at all on a miss.
//                       ⚠ THE DEFAULT IS TRUE BECAUSE THE REFERRAL PIPELINE'S ORPHAN FLAG IS
//                       A MONEY QUESTION — a referral that resolves to no rep is an incident,
//                       and ruling R3 (2026-09-18) leaves that behaviour explicitly unchanged.
//                       The REQUEST-driven path passes false: an ordinary client with no
//                       identifiable rep is not an incident, and flagging one per sold client
//                       would flood the admin queue. R3 is scoped to the request path ONLY,
//                       and this parameter is how the two are separated inside one engine.
//                       ⚠ Do NOT flip the default to false "for symmetry" — that silently
//                       un-flags the referral pipeline, which is the half R3 does not touch.
//   notifyAdminOnFlag — true (default) inserts the admin_messages bell beside a new
//                       co-assignment flag. FALSE writes the flagged_assignments row and
//                       rings nothing. ⚠ ONLY the historical replay passes false
//                       (server/utils/attributionReplay.js): it runs over a whole book at
//                       once, and ruling 7 (Danny, 2026-09-21) is that the replay creates
//                       no admin alert. The flag itself still lands in the Flagged queue,
//                       so the co-assignment is recorded rather than hidden. Every live
//                       path keeps the default.
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
  writeOrphanOnMiss = true,
  notifyAdminOnFlag = true,
  // ⚠ THE WRITER MARKER — 'live' unless the historical replay says otherwise. See
  // writeProvisional above for why it exists and why NULL rows mean "before the column".
  writtenBy = 'live',
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

    // ⚠ AN ELIGIBLE QUOTE WHOSE AUTHOR IS MAPPED TO NOBODY MAKES EVERY LATER ANSWER
    // PROVISIONAL (Danny, 2026-09-22). Same resolution, lower confidence.
    //
    // The gate's best signal is the quote's salesperson. When that person is not an
    // attributable member, the match below finds nobody and the gate falls through to a
    // WEAKER signal — the assessment. Keeping the fall-through is right: mapping is
    // incomplete by design (Accent: 147 Jobber users, one member, one of them a user
    // literally called "Scheduled Jobs"), and blocking would leave real clients
    // unassigned whenever the office wrote the quote. ⚠ WHAT WAS WRONG WAS WRITING THE
    // RESULT AS CERTAIN. A sticky is existing-wins and no later mapping can correct it; a
    // provisional is re-examined by every replay, so mapping that person later fixes the
    // client automatically.
    // ⚠ AND THE REASON IT IS NOT A CLEANUP: EVERY NEW CONTRACTOR STARTS WITH NOBODY
    // MAPPED, so without this each one takes a batch of permanently-wrong stickies on
    // their first import. Measured on Accent 2026-09-22: 10 of Danny's 13 such clients,
    // and 1,990 clients account-wide carry an eligible approved quote by an unmapped
    // author.
    // ⚠ CONSEQUENCE, STATED: a client whose quote author will NEVER be mapped (a
    // scheduler) stays provisional indefinitely. Book membership is unaffected —
    // OWN_BOOK_PREDICATE is COALESCE(sticky, provisional) — but the rep app's
    // locked/provisional split counts it as provisional, which is the honest reading:
    // nobody has confirmed who closed it.
    let quoteAuthorUnmapped = false;

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
      } else {
        quoteAuthorUnmapped = true;
      }
    }

    // Fall back to promoting the provisional rep.
    // ⚠ NOT WHEN THE QUOTE'S AUTHOR IS UNMAPPED: promotion is the same
    // uncertain-answer-written-as-certain move one step earlier, and freezing here would
    // put the client beyond the reach of the mapping that would have corrected it.
    if (stickyRepId === null && currentProvisionalRepId != null && !quoteAuthorUnmapped) {
      stickyRepId = currentProvisionalRepId;
      stickySource = 'promoted_provisional';
    }

    if (stickyRepId !== null) {
      await writeSticky(pool, contractorId, jobberClientId, stickyRepId, stickySource, writtenBy);
      return;
    }

    // Neither an eligible quote's salesperson nor an existing provisional resolved this
    // client. Fall through to Mode A/B before giving up — a matching assessment/request
    // still in the grace window counts, even with no quote or prior provisional to promote.
    if (skipProvisional) {
      if (writeOrphanOnMiss) await writeOrphanFlag(pool, contractorId, jobberClientId, winnerQuote ? winnerQuote.id : null);
      return;
    }

    const attributionSource = await getAttributionSource(pool, contractorId);
    const { requests } = await fetchAttributionData(jobberClientId, token);

    // ⚠ THE ONE PLACE THE CONFIDENCE RULE LANDS. The MATCH is unchanged — same mode, same
    // eligibility, same single/multiple/none — only the WRITE differs: provisional when
    // the gate's best signal was unreadable, sticky when it was simply absent. A
    // co-assignment flag and an orphan flag are unaffected either way; both are records
    // that something needs a human, and neither claims ownership.
    if (attributionSource === 'assessment_assigned_users') {
      const match = await resolveModeAMatch(pool, contractorId, requests, referralAnchor);
      if (match.type === 'single') {
        if (quoteAuthorUnmapped) {
          // qr_link keeps its precedence here exactly as it does in the provisional step.
          if (currentProvisionalSource !== 'qr_link') {
            await writeProvisional(pool, contractorId, jobberClientId, match.repId, 'mode_a', writtenBy);
          }
        } else {
          await writeSticky(pool, contractorId, jobberClientId, match.repId, 'mode_a_at_close', writtenBy);
        }
      } else if (match.type === 'multiple' || match.type === 'truncated') {
        // ⚠ 'truncated' LANDS IN THE SAME QUEUE AS A CO-ASSIGNMENT, DELIBERATELY (7a-2). Both mean
        // "a human must decide who owns this client", and reusing flag_reason 'rep_co_assignment'
        // keeps it in the queue admins already work rather than adding a value that would need
        // the CHECK constraint widened on two tables and the admin surface taught to render it.
        // ⚠ THE 'WHY' IS STILL RECOVERABLE: crm_request_facts.assigned_users_truncated is TRUE for
        // this assessment, joined on triggering_assessment_id. A dedicated flag_reason would be
        // clearer and is filed rather than done.
        await writeCoAssignmentFlag(pool, contractorId, jobberClientId, match.repIds, match.assessmentId, notifyAdminOnFlag);
      } else {
        if (writeOrphanOnMiss) await writeOrphanFlag(pool, contractorId, jobberClientId, winnerQuote ? winnerQuote.id : null);
      }
    } else {
      const match = await resolveModeBMatch(pool, contractorId, requests, referralAnchor);
      if (match.type === 'single') {
        if (quoteAuthorUnmapped) {
          if (currentProvisionalSource !== 'qr_link') {
            await writeProvisional(pool, contractorId, jobberClientId, match.repId, 'mode_b', writtenBy);
          }
        } else {
          await writeSticky(pool, contractorId, jobberClientId, match.repId, 'mode_b_at_close', writtenBy);
        }
      } else {
        if (writeOrphanOnMiss) await writeOrphanFlag(pool, contractorId, jobberClientId, winnerQuote ? winnerQuote.id : null);
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
        await writeProvisional(pool, contractorId, jobberClientId, match.repId, 'mode_a', writtenBy);
      }
    } else if (match.type === 'multiple' || match.type === 'truncated') {
      // ⚠ THE PROVISIONAL STEP NEEDS THE SAME BRANCH AS THE STICKY GATE, AND IT WAS MISSED ON THE
      // FIRST PASS (7a-2). Mode A has TWO consumers — the sticky gate above and this provisional
      // step — and a 'truncated' match falling through here would have written NOTHING at all:
      // no provisional, no flag, no orphan. Silent, and the quietest of the three wrong answers.
      // A provisional to one rep is less harmful than a sticky (every replay re-examines it), but
      // it is still a claim the truncated list cannot support.
      await writeCoAssignmentFlag(pool, contractorId, jobberClientId, match.repIds, match.assessmentId, notifyAdminOnFlag);
    }
  } else {
    const match = await resolveModeBMatch(pool, contractorId, requests, referralAnchor);
    if (match.type === 'single' && currentProvisionalSource !== 'qr_link') {
      await writeProvisional(pool, contractorId, jobberClientId, match.repId, 'mode_b', writtenBy);
    }
  }
}

module.exports = { runAttributionEngine };
