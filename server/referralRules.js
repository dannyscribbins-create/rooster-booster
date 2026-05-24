// server/referralRules.js
// ── REFERRAL RULES ENGINE ─────────────────────────────────────────────────────
// Evaluates whether a paid invoice qualifies for a referral bonus and calculates
// the exact payout amount. Called from the invoice-paid webhook handler after the
// experience flow logic completes.
//
// Returns:
//   { qualified: false, reason: string }
//   { qualified: true, scheduleId, scheduleName, bonusAmount, referrerId, jobberClientId }
//
// Architecture notes:
//   - This module is intentionally standalone and testable in isolation.
//   - All DB access goes through pool — no Jobber API calls from this module.
//   - The caller (webhook handler) is responsible for fetching invoice + job data
//     from Jobber and passing it in via invoiceData.
//   - amounts.total from Jobber is whole dollars. No conversion applied.
//   - annual reset_period is anchored to contractor_crm_settings.referral_start_date.
//     If start date is 2025-03-14, the current annual window is 2025-03-14 → 2026-03-13.
//   - Case-insensitive name matching: LOWER(users.full_name) = LOWER(referred_by).
//     Phone/email fallback is deferred to a future session.

'use strict';

const { pool } = require('./db');

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
// contractorId: string — e.g. 'accent-roofing'
// invoiceData:  object — full invoice object from fetchInvoiceWithJobs()
//               Must include: client.id, issuedDate, waitingForFinancedPayment,
//               amounts.total, jobs.nodes, archivedJobs.nodes
// referredBy:   string — raw value from Jobber "Referred by" custom field on client
async function evaluateReferral(contractorId, invoiceData, referredBy) {

  // ── STEP 0 — Invoice Status Guard ────────────────────────────────────────────
  // Defensive safety net: only process paid invoices. The webhook handler guards
  // on invoiceStatus before calling here, but this prevents accidental execution
  // if a future caller omits that check.
  if (invoiceData.invoiceStatus !== 'paid') {
    return { qualified: false, reason: 'invoice_not_paid' };
  }

  // ── STEP 1 — Referrer Attribution Check ──────────────────────────────────────
  // Caller already confirmed referred_by is populated — but guard here too.
  if (!referredBy || !referredBy.trim()) {
    return { qualified: false, reason: 'no_referrer_attributed' };
  }

  // ── STEP 2 — Referrer Account Check (case-insensitive name match) ─────────────
  // Phone/email fallback deferred to future session.
  // MVP: LOWER(full_name) = LOWER(referred_by) only.
  const referrerResult = await pool.query(
    `SELECT id FROM users
     WHERE LOWER(full_name) = LOWER($1)
       AND deleted_at IS NULL
     LIMIT 1`,
    [referredBy.trim()]
  );
  if (referrerResult.rows.length === 0) {
    console.log(`[referralRules] No user match for referred_by: "${referredBy}" — routing to pending referral flow`);
    return { qualified: false, reason: 'referrer_not_found' };
  }
  const referrerId = referrerResult.rows[0].id;

  // ── STEP 3 — Start Date Gate ──────────────────────────────────────────────────
  // Invoices issued before referral_start_date are excluded entirely.
  const settingsResult = await pool.query(
    `SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1`,
    [contractorId]
  );
  const referralStartDate = settingsResult.rows[0]?.referral_start_date
    ? new Date(settingsResult.rows[0].referral_start_date)
    : null;

  const invoiceIssuedDate = invoiceData.issuedDate ? new Date(invoiceData.issuedDate) : null;
  if (referralStartDate && invoiceIssuedDate && invoiceIssuedDate < referralStartDate) {
    return { qualified: false, reason: 'invoice_before_start_date' };
  }

  // ── STEP 4 — waitingForFinancedPayment Gate ───────────────────────────────────
  // Defer processing — cron sync will re-evaluate on next cycle.
  if (invoiceData.waitingForFinancedPayment === true) {
    console.log(`[referralRules] Invoice ${invoiceData.invoiceNumber} deferred — waitingForFinancedPayment is true`);
    return { qualified: false, reason: 'waiting_for_financed_payment' };
  }

  // ── STEP 5 — Invoice Batching ─────────────────────────────────────────────────
  // For MVP single-invoice webhook: the batch IS this invoice.
  // Multi-invoice batch detection (shared job ID + date proximity) is handled
  // by pulling all client invoices and grouping. For MVP, we use the single
  // triggered invoice — the UNIQUE constraint on referral_conversions prevents
  // double-counting if a second invoice fires for the same client.
  // SCALABLE PATH: implement full batch grouping when multi-invoice projects
  // become common enough to warrant it. The invoice_window_days column is
  // already seeded and ready.
  const invoiceTotal = invoiceData.amounts?.total ?? 0;

  // ── STEP 6 — Job Type Classification ─────────────────────────────────────────
  // Collect all job type values from jobs and archivedJobs on this invoice.
  const allJobs = [
    ...(invoiceData.jobs?.nodes || []),
    ...(invoiceData.archivedJobs?.nodes || []),
  ];

  const jobTypeValues = [];
  for (const job of allJobs) {
    const fields = job.customFields || [];
    const jobTypeField = fields.find(
      f => f.label === 'Job Type' && f.valueDropdown !== undefined
    );
    if (jobTypeField?.valueDropdown) {
      jobTypeValues.push(jobTypeField.valueDropdown);
    }
  }

  if (jobTypeValues.length === 0) {
    return { qualified: false, reason: 'no_job_type_found' };
  }

  // Load all active schedules and their job type mappings for this contractor
  const schedulesResult = await pool.query(
    `SELECT s.id, s.name, s.payout_model, s.minimum_invoice, s.reset_period,
            s.escalating_steps, s.tier_brackets, s.flat_amount,
            s.percentage_rate, s.percentage_max_cap, s.invoice_window_days,
            array_agg(LOWER(jt.jobber_label)) AS mapped_labels
     FROM referral_schedules s
     JOIN referral_schedule_job_types jt ON jt.schedule_id = s.id
     WHERE s.contractor_id = $1 AND s.is_active = true
     GROUP BY s.id`,
    [contractorId]
  );

  // Priority: Schedule A (Full Roof) wins over Schedule B (Repair) if both match.
  // Implementation: try each job type value against schedules in DB order.
  // Full Roof labels are seeded first so they appear first in results.
  // If ANY job type on the invoice matches a schedule, that schedule wins.
  // Full Roof schedules beat Repair schedules because Out of Pocket / Insurance
  // labels will never appear on a Repair job in practice — but the priority
  // logic is explicit here for correctness at scale.
  let winningSchedule = null;

  // First pass: look for a Full Roof match (payout_model = escalating for Accent Roofing)
  for (const schedule of schedulesResult.rows) {
    for (const jobType of jobTypeValues) {
      if (schedule.mapped_labels.includes(jobType.toLowerCase())) {
        if (schedule.payout_model === 'escalating') {
          winningSchedule = schedule;
          break;
        }
      }
    }
    if (winningSchedule) break;
  }

  // Second pass: if no escalating match, look for any other schedule match
  if (!winningSchedule) {
    for (const schedule of schedulesResult.rows) {
      for (const jobType of jobTypeValues) {
        if (schedule.mapped_labels.includes(jobType.toLowerCase())) {
          winningSchedule = schedule;
          break;
        }
      }
      if (winningSchedule) break;
    }
  }

  if (!winningSchedule) {
    return { qualified: false, reason: 'no_matching_schedule_for_job_type' };
  }

  // ── STEP 7 — Qualifying Threshold Check ──────────────────────────────────────
  // Flat model: invoice amount irrelevant — skip threshold check.
  if (winningSchedule.payout_model !== 'flat' && winningSchedule.minimum_invoice !== null) {
    // Escalating: highest single invoice value must clear minimum
    // Tiered: invoice total must clear minimum floor
    // Percentage: invoice total must clear minimum
    if (invoiceTotal < winningSchedule.minimum_invoice) {
      return {
        qualified: false,
        reason: `invoice_below_minimum_threshold (${invoiceTotal} < ${winningSchedule.minimum_invoice})`,
      };
    }
  }

  // ── STEP 8 — Duplicate Check ──────────────────────────────────────────────────
  // One conversion per referred client, ever. Enforced by UNIQUE(user_id, jobber_client_id).
  const jobberClientId = invoiceData.client?.id;
  if (!jobberClientId) {
    return { qualified: false, reason: 'missing_client_id_on_invoice' };
  }

  const dupeCheck = await pool.query(
    `SELECT id FROM referral_conversions
     WHERE user_id = $1 AND jobber_client_id = $2`,
    [referrerId, jobberClientId]
  );
  if (dupeCheck.rows.length > 0) {
    return { qualified: false, reason: 'conversion_already_recorded' };
  }

  // ── STEP 9 — Payout Calculation ───────────────────────────────────────────────
  let bonusAmount = 0;

  if (winningSchedule.payout_model === 'flat') {
    bonusAmount = winningSchedule.flat_amount;

  } else if (winningSchedule.payout_model === 'percentage') {
    bonusAmount = invoiceTotal * winningSchedule.percentage_rate;
    if (winningSchedule.percentage_max_cap !== null) {
      bonusAmount = Math.min(bonusAmount, winningSchedule.percentage_max_cap);
    }

  } else if (winningSchedule.payout_model === 'tiered') {
    const brackets = winningSchedule.tier_brackets || [];
    const matchedBracket = brackets.find(b => {
      const aboveMin = invoiceTotal >= b.min;
      const belowMax = b.max === null || invoiceTotal <= b.max;
      return aboveMin && belowMax;
    });
    bonusAmount = matchedBracket ? matchedBracket.payout_amount : 0;

  } else if (winningSchedule.payout_model === 'escalating') {
    // Count prior qualifying conversions for this referrer under this schedule
    // within the current reset period window.
    // Annual reset anchored to contractor_crm_settings.referral_start_date.
    let periodStart = null;

    if (winningSchedule.reset_period === 'annual') {
      // Calculate current annual window from referral_start_date.
      // E.g. start = 2025-03-14 → current window = 2025-03-14 to 2026-03-13.
      // If today is past 2026-03-14, window shifts to 2026-03-14 → 2027-03-13.
      if (referralStartDate) {
        const now = new Date();
        let windowStart = new Date(referralStartDate);
        // Advance windowStart by full years until it's in the past but as recent as possible
        while (true) {
          const nextWindow = new Date(windowStart);
          nextWindow.setFullYear(nextWindow.getFullYear() + 1);
          if (nextWindow > now) break;
          windowStart = nextWindow;
        }
        periodStart = windowStart;
      }
    }
    // lifetime reset: periodStart stays null → count all-time conversions
    // none reset: treated same as lifetime for escalating (no reset ever)

    const countQuery = periodStart
      ? `SELECT COUNT(*) AS prior_count
         FROM referral_conversions rc
         JOIN referral_schedules rs ON rs.id = $3
         WHERE rc.user_id = $1
           AND rc.contractor_id = $2
           AND rc.converted_at >= $4`
      : `SELECT COUNT(*) AS prior_count
         FROM referral_conversions
         WHERE user_id = $1
           AND contractor_id = $2`;

    const countParams = periodStart
      ? [referrerId, contractorId, winningSchedule.id, periodStart]
      : [referrerId, contractorId];

    const countResult = await pool.query(countQuery, countParams);
    const priorCount = parseInt(countResult.rows[0].prior_count) || 0;

    // referral_number in escalating_steps is 1-based.
    // priorCount = 0 means this is their 1st referral → look for referral_number: 1.
    const steps = winningSchedule.escalating_steps || [];
    const targetReferralNumber = priorCount + 1;

    // Find exact step match, or fall back to the highest defined step (catch-all)
    const matchedStep = steps.find(s => s.referral_number === targetReferralNumber)
      || steps[steps.length - 1]; // last step is the catch-all for 7th and beyond

    bonusAmount = matchedStep ? matchedStep.payout_amount : 0;
  }

  if (bonusAmount <= 0) {
    return { qualified: false, reason: 'calculated_bonus_is_zero' };
  }

  return {
    qualified: true,
    scheduleId:   winningSchedule.id,
    scheduleName: winningSchedule.name,
    bonusAmount,
    referrerId,
    jobberClientId,
  };
}

module.exports = { evaluateReferral };
