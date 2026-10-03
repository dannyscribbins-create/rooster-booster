'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 7c-3 — THE DEFAULT SCHEDULE, AND THE ONE PLACE IT IS READ
//
// Danny's ruling: each contractor has a DEFAULT schedule used when a job's category value is
// blank, absent at every stage, or not mapped to any schedule. **It starts as "No bonus" until the
// contractor chooses one of their own schedules in the Referral Program settings. Unmapped and
// blank values never silently pay on a schedule nobody chose.**
//
// ⚠ "NO BONUS" IS NULL, NOT A SENTINEL ROW. There is nothing to create, nothing to migrate, and a
// contractor who has never opened the setting is already in the ruled state. A sentinel schedule
// named "No bonus" would appear in every list, be editable, and could be assigned category values.
//
// ⚠ THE COLUMN LIST HERE MUST MATCH `evaluateReferral`'s SCHEDULE SELECT, because the row it
// returns is handed to the same downstream code — the threshold check, the payout model, the
// invoice window. A column selected there and missing here would read as NULL on the default path
// only, which is this repo's most-recorded defect: a writer reading a field no query selects. A
// fence in `defaultSchedule.test.js` differences the two selections and fails naming the gap.
//
// ⚠ AND THE DEFAULT MUST BE ACTIVE TO APPLY. `is_active = false` is how a contractor retires a
// schedule; a retired schedule silently paying on the fallback path would be worse than no default
// at all, because nothing on the settings screen would suggest it was still in use.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The columns every consumer of a schedule row needs. Exported so `evaluateReferral` and this
 * reader cannot drift — the single-source pattern, applied to a column list rather than to SQL.
 */
const SCHEDULE_COLUMNS = [
  'id', 'name', 'payout_model', 'minimum_invoice', 'reset_period',
  'escalating_steps', 'tier_brackets', 'flat_amount',
  'percentage_rate', 'percentage_max_cap', 'invoice_window_days',
];

/**
 * This contractor's default schedule, or null for "No bonus".
 * Inputs: a db/pool/tx, the contractor id.
 * Output: a schedule row shaped like `evaluateReferral`'s, with `mapped_labels` always `[]`, or
 *         null when no default is set, the default was deleted, or the default is inactive.
 *
 * ⚠ `mapped_labels` IS DELIBERATELY EMPTY RATHER THAN THE SCHEDULE'S REAL LABEL LIST. The default
 * is reached precisely when nothing MATCHED, so handing back the labels it failed to match on would
 * invite a later reader to re-run the comparison and conclude the engine had made a mistake. The
 * default applies BECAUSE it is the default, not because anything matched.
 *
 * ⚠ ONE QUERY, JOINED RATHER THAN TWO READS, so the setting and the schedule cannot be observed in
 * two different instants — a default deleted between the two reads would otherwise return a row
 * that no longer exists.
 */
async function getDefaultSchedule(db, contractorId) {
  if (!contractorId) return null;
  const cols = SCHEDULE_COLUMNS.map((c) => `s.${c}`).join(', ');
  const { rows } = await db.query(
    `SELECT ${cols}
       FROM contractor_settings cs
       JOIN referral_schedules s
         ON s.id = cs.default_schedule_id
        AND s.contractor_id = cs.contractor_id
      WHERE cs.contractor_id = $1
        AND s.is_active = true`,
    [contractorId]
  );
  if (rows.length === 0) return null;
  return { ...rows[0], mapped_labels: [] };
}

module.exports = { getDefaultSchedule, SCHEDULE_COLUMNS };
