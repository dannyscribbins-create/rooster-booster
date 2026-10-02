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
const { isInvoicePaid } = require('./utils/invoicePaid');
const { categoryListIncludes, normalizeCategoryValue } = require('./utils/categoryMatch');
// ⚠ 7c-0 adds the first catch block in this module, and CLAUDE.md requires logError in every one.
const { logError } = require('./middleware/errorLogger');
// ⚠ A mapping value may be the legacy label string or the 7c-1 { field_id, entity, label }
// object; one parser for both.
const { parseMappingEntry } = require('./utils/fieldMapping');

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
// contractorId: string — e.g. 'accent-roofing'
// invoiceData:  object — full invoice object from fetchInvoiceWithJobs()
//               Must include: client.id, issuedDate, waitingForFinancedPayment,
//               amounts.total, jobs.nodes, archivedJobs.nodes
// referredBy:   string — raw value from Jobber "Referred by" custom field on client
/**
 * @param {object} [opts]
 * @param {string[]|null} [opts.categoryValues] — the payout category, ALREADY RESOLVED by the caller.
 *
 * ⚠ THE OPTION EXISTS SO THE FACT PATH DOES NOT NEED A SECOND EVALUATOR, AND THAT IS THE WHOLE REASON
 * IT IS AN OPTION RATHER THAN A REWRITE. `creditReferralFromFacts` resolves the category through
 * `categorySource` — which follows the configuration LINK (invoice copy first, then job, then the linked
 * quote) because THREE live configurations share the label "Job Type" across ALL_JOBS, ALL_INVOICES and
 * ALL_QUOTES. The label scan below cannot tell them apart and would read quote vocabulary onto a
 * job-reading schedule.
 * ⚠ AND WHEN IT IS OMITTED THE LABEL SCAN STILL RUNS, UNCHANGED. Any caller that still hands over a live
 * invoice object behaves exactly as before — which is what keeps this an addition rather than a
 * migration of every call site.
 * ⚠ AN EMPTY ARRAY IS A REAL ANSWER AND IS NOT THE SAME AS OMITTING IT. `[]` means "the resolver looked
 * and there is no category", which must reach `no_job_type_found`; `undefined` means "nobody resolved
 * one, scan the object". Collapsing the two would make a resolved-absent category fall back to a label
 * scan over an object the fact path assembled with no jobs on it — and that scan would find nothing
 * while reporting the wrong reason.
 *
 * @param {string|Date|null} [opts.clientCreatedAt] — the CLIENT's own Jobber creation date, when the
 *   caller holds it live. STEP 3b falls back to the stored column when this is omitted.
 *
 * ⚠ THE OPTION EXISTS BECAUSE A BRAND-NEW CLIENT HAS NO STORED ROW TO READ, AND WITHOUT IT RULING 1's
 * HEADLINE IS STRUCTURALLY DARK. Measured 2026-10-01: on the invoice-paid door the `jobber_clients`
 * identity upsert runs AFTER both the capture and the decision (`upsertAndTagClient`), so
 * `captureClientFacts`' `UPDATE ... SET jobber_created_at` affects **0 rows** on a first sighting —
 * `factCapture.js` says so in terms, for the full-capture marker directly above it. STEP 3b then read
 * no row, returned `client_created_at_unknown`, and the credit never fired. Ruling 1 exists precisely
 * so *"a first paid invoice is credited immediately rather than waiting for the sync"*, and that is the
 * one case the stored read cannot serve.
 * ⚠ IT IS NOT A SECOND SOURCE OF TRUTH. The value is the client's own Jobber `createdAt` from the very
 * object `captureClientFacts` writes the column from, so supplied and stored can never disagree about
 * the same client — one is simply available an instant earlier than the other.
 * ⚠ AND IT NARROWS NOTHING: an UNKNOWN date is still refused, and a date BEFORE the programme start is
 * still refused, on this path exactly as on the stored one. The paired guard-proof is what pins both
 * directions, because a supplied date that was only ever tested in the admitting direction would be a
 * money gate proven in one direction only.
 * ⚠ THE CATCH-UP DELIBERATELY DOES NOT SUPPLY IT. `redecideStaleClients` holds no live client, and its
 * selector reads `jobber_clients`, so the row always exists by the time it runs — the stored read is
 * correct there and must stay the default rather than become a special case.
 */
async function evaluateReferral(contractorId, invoiceData, referredBy, opts = {}) {
  const suppliedCategoryValues = Array.isArray(opts.categoryValues) ? opts.categoryValues : null;
  // ⚠ `undefined` MEANS "NOBODY SUPPLIED ONE, READ THE COLUMN" — it is NOT the same as a null date.
  // A caller that holds a client with no `createdAt` passes null and is refused, exactly as an absent
  // column is; collapsing the two would make "I looked and there is none" fall back to a stored read
  // that the brand-new case cannot answer, which is the defect this option closes.
  const suppliedClientCreatedAt = Object.prototype.hasOwnProperty.call(opts, 'clientCreatedAt')
    ? opts.clientCreatedAt
    : undefined;

  // ── STEP 0 — Invoice Status Guard ────────────────────────────────────────────
  // Defensive safety net: only process paid invoices. The webhook handler guards
  // on invoiceStatus before calling here, but this prevents accidental execution
  // if a future caller omits that check.
  // ⚠ THE ONE DEFINITION (4a), AND THIS IS THE SITE WHERE IT PAYS MONEY. It read the status
  // alone, so a paid-but-unsettled invoice or a $0 invoice could qualify a referral for a bonus.
  // fetchInvoiceWithJobs now selects invoiceBalance alongside total.
  if (!isInvoicePaid(invoiceData)) {
    return { qualified: false, reason: 'invoice_not_paid' };
  }

  // ── STEP 1 — Referrer Attribution Check ──────────────────────────────────────
  // Caller already confirmed referred_by is populated — but guard here too.
  if (!referredBy || !referredBy.trim()) {
    return { qualified: false, reason: 'no_referrer_attributed' };
  }

  // ── STEP 2 — Referrer Account Check (case-insensitive name match) ─────────────
  // Phone/email fallback deferred to future session.
  // MVP: LOWER(full_name) = LOWER(referred_by), scoped to this contractor.
  //
  // ⚠ THE contractor_id PREDICATE IS THE MONEY GUARD (Wave 0.3 F8). Without it this
  // matched a name across EVERY tenant, and the id it returns is written straight
  // into referral_conversions with a bonus_amount by the invoice-paid handler — the
  // table carrying UNIQUE(user_id, jobber_client_id). One contractor's paid invoice
  // could therefore book a bonus against another contractor's referrer. Of the
  // twelve unscoped matchers F8 found, this is the only one where a wrong match
  // moves money, which is why it was fixed first.
  //
  // Unreachable while Accent is the only contractor — there is no second row to
  // match — and live the day contractor #2 provisions.
  //
  // users.contractor_id is NOT NULL with an FK (db.js:1201-1240), so this predicate
  // can never silently match nothing because the column was null.
  const referrerResult = await pool.query(
    `SELECT id FROM users
     WHERE contractor_id = $2
       AND LOWER(full_name) = LOWER($1)
       AND deleted_at IS NULL
     LIMIT 1`,
    [referredBy.trim(), contractorId]
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

  // ── STEP 3b — THE CLIENT'S OWN CREATION DATE (ONE START-DATE RULE, Danny 2026-10-01) ──────────
  //
  // ⚠ BOTH DATES ARE NOW REQUIRED, AND THIS IS THE HALF THAT WAS MISSING. A bonus is earned only if the
  // CLIENT was created on or after the programme start AND the INVOICE was issued on or after it. Until
  // this gate existed the engine read only the invoice date, while `pipeline_cache.pre_start_date`
  // suppressed the CARD on the client date — so a pre-start client with a post-start invoice qualified
  // in the engine and got a `referral_conversions` row the referrer could never see.
  //
  // ⚠ IT CLOSES THAT GAP IN THE CONSERVATIVE DIRECTION, WHICH IS WHY IT IS SAFE TO ADD TO A MONEY PATH:
  // it can only REFUSE conversions that previously qualified, never create one. The engine now refuses
  // the same population the card already hides, so the two agree by construction instead of by accident.
  //
  // ⚠ READ FROM `jobber_clients.jobber_created_at`, NOT `created_at`. The latter is `DEFAULT NOW()` —
  // when ROOFMILES inserted the row — and gating on it would exclude or admit clients by when we first
  // saw them. The column this reads is written by `captureClientFacts` from the client's own Jobber
  // `createdAt`, and backfilled once from `pipeline_cache.jobber_created_at`.
  //
  // ⚠ AND AN UNKNOWN DATE IS NOT ELIGIBLE (Danny's ruling). Unknown is never permission. A client whose
  // column is still NULL waits for its next full capture rather than being paid on an assumption —
  // the same reasoning the nullable `waiting_for_financed_payment` exists for, and the opposite of
  // `IS NOT TRUE`, which would fold unknown in with "fine".
  //
  // ⚠ THE GATE IS SKIPPED ENTIRELY WHEN THE CONTRACTOR HAS NO START DATE, exactly as the invoice gate
  // above is. With no programme start there is nothing to be before, and refusing every client for want
  // of a setting would be a worse answer than the one this replaces.
  if (referralStartDate) {
    // ⚠ SUPPLIED WINS OVER STORED, AND ONLY BECAUSE STORED CANNOT EXIST YET ON THE PATH THAT SUPPLIES.
    // See the `clientCreatedAt` note on this function's signature: on a first sighting the identity row
    // is written after the credit, so the column is unreadable at exactly the moment ruling 1 requires
    // an answer. Where both are available they are the same value from the same Jobber field.
    let clientCreatedAt = null;
    if (suppliedClientCreatedAt !== undefined) {
      clientCreatedAt = suppliedClientCreatedAt ? new Date(suppliedClientCreatedAt) : null;
      // ⚠ AN UNPARSEABLE SUPPLIED DATE IS UNKNOWN, NOT NOW(). `new Date('nonsense')` is an Invalid Date,
      // and comparing one against the start date is FALSE in both directions — so without this check a
      // malformed value would slip past the start-date comparison and be read as eligible.
      if (clientCreatedAt && Number.isNaN(clientCreatedAt.getTime())) clientCreatedAt = null;
    } else {
      const clientRow = await pool.query(
        `SELECT jobber_created_at FROM jobber_clients
          WHERE contractor_id = $1 AND jobber_client_id = $2`,
        [contractorId, invoiceData.client?.id || null]
      );
      clientCreatedAt = clientRow.rows[0]?.jobber_created_at
        ? new Date(clientRow.rows[0].jobber_created_at)
        : null;
    }
    if (!clientCreatedAt) {
      return { qualified: false, reason: 'client_created_at_unknown' };
    }
    if (clientCreatedAt < referralStartDate) {
      return { qualified: false, reason: 'client_before_start_date' };
    }
  }

  // ── STEP 4 — waitingForFinancedPayment Gate ───────────────────────────────────
  // ⚠ IT BLOCKS UNLESS THE FLAG IS EXPLICITLY `false` (Danny, 7d ruling 3). `TRUE` or `NULL` is NOT
  // eligible. This read `=== true`, which converted on NULL — and NULL is what all 3,881 invoice fact
  // rows predating the column hold, plus every row a query that does not select the field produces.
  // ⚠ **NEVER `!== true` OR `IS NOT TRUE`**: those fold unknown in with false and convert on unknown,
  // which is the whole reason the column was made nullable with no default rather than `NOT NULL
  // DEFAULT FALSE`.
  if (invoiceData.waitingForFinancedPayment !== false) {
    console.log(`[referralRules] Invoice ${invoiceData.invoiceNumber} deferred — waitingForFinancedPayment is not explicitly false`);
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

  // ⚠ THE CONTRACTOR'S OWN FIELD, NOT A HARD-CODED LABEL (7c-0). This read was
  // `f.label === 'Job Type'` — the ONLY reader in the codebase that ignored the contractor's
  // mapping, while `deriveJobberTags.js` has always honoured it. The consequence was silent and it
  // was money: a contractor who renamed the field in Jobber kept perfectly correct TAGS and
  // stopped qualifying for any payout schedule, because this function alone could no longer find
  // the field. Nothing surfaced it — `no_job_type_found` writes no row and raises no alert.
  //
  // ⚠ THE `|| 'Job Type'` FALLBACK IS KEPT DELIBERATELY, AND IT IS NOT THE DEFECT BEING FIXED.
  // `deriveJobberTags.js` has the identical fallback, and the two readers MUST agree: a contractor
  // with no mapping configured must resolve the same field on both paths or their tags and their
  // payouts would disagree. Removing it here would make every unmapped contractor stop qualifying
  // — a regression dressed as a cleanup. The defect was IGNORING the mapping, not having a default.
  let workCategoryLabel = 'Job Type';
  try {
    const mappingResult = await pool.query(
      'SELECT contractor_field_mappings FROM contractor_settings WHERE contractor_id = $1',
      [contractorId]
    );
    // ⚠ THROUGH THE PARSER (7c-1). The stored value is now { field_id, entity, label }, and
    // `object || 'Job Type'` yields the OBJECT — which normalises to null, matches no field, and
    // returns `no_job_type_found` for EVERY referral. The migration that introduced the new shape
    // would have broken the money path this function's 7c-0 change had just repaired.
    workCategoryLabel = parseMappingEntry(mappingResult.rows[0]?.contractor_field_mappings?.work_category)?.label
      || 'Job Type';
  } catch (mappingErr) {
    // ⚠ FALL BACK, NEVER ABORT. A settings read failing must not turn into an unpaid referral; the
    // default is the same one deriveJobberTags uses, so the behaviour degrades to the pre-7c-0 path
    // rather than to nothing. Logged so the degradation is visible instead of assumed.
    await logError({
      req: null,
      contractorId,
      error: new Error(`[evaluateReferral] could not read work_category mapping, falling back to 'Job Type': ${mappingErr.message}`),
      source: 'evaluateReferral — field mapping',
      alert: false,
    });
  }

  // ⚠ THE SUPPLIED CATEGORY SHORT-CIRCUITS THE LABEL SCAN ENTIRELY, rather than being merged with it.
  // Merging would let the label scan contribute a value the configuration-linked resolver deliberately
  // rejected — which is the ambiguity 7c-1 exists to remove, reintroduced through the back door.
  const jobTypeValues = suppliedCategoryValues !== null ? [...suppliedCategoryValues] : [];
  for (const job of (suppliedCategoryValues !== null ? [] : allJobs)) {
    const fields = job.customFields || [];
    // ⚠ CASE-INSENSITIVE ON THE LABEL, MATCHING deriveJobberTags' getCustomFieldValue. The two read
    // the same field off the same record and disagreed: that one folds case, this one used `===`.
    // ⚠ AND `valueText` IS ACCEPTED AS WELL AS `valueDropdown`, for the same reason. The old
    // `valueDropdown !== undefined` guard meant a contractor whose category field is a TEXT field
    // could never qualify at all — a whole class of contractor silently excluded by a type check.
    const jobTypeField = fields.find(
      f => f.label && normalizeCategoryValue(f.label) === normalizeCategoryValue(workCategoryLabel)
    );
    const value = jobTypeField?.valueDropdown || jobTypeField?.valueText || null;
    if (normalizeCategoryValue(value) !== null) {
      jobTypeValues.push(value);
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
            -- ⚠ RAW LABELS, NOT LOWER() (7c-0). The comparison used to be split across two
            -- languages — SQL lowercased here, JS lowercased at the call site — and NEITHER
            -- trimmed. Splitting a single rule across a query and a loop is how the two halves
            -- came to disagree with the third copy in the admin panel. The raw label now travels
            -- to ONE matcher (utils/categoryMatch), and it is also what lets a warning quote the
            -- value exactly as stored, trailing space and all.
            array_agg(jt.jobber_label) AS mapped_labels
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
      if (categoryListIncludes(schedule.mapped_labels, jobType)) {
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
        if (categoryListIncludes(schedule.mapped_labels, jobType)) {
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
