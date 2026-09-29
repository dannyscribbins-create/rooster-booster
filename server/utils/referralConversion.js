'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 6 — ONE WRITER FOR referral_conversions
//
// A PURE EXTRACTION. No behaviour changes in this commit: the SQL, the ON CONFLICT clause, the
// parameter order and the prior-count read are the invoice-paid webhook's own, moved verbatim.
//
// ⚠ WHY IT EXISTS BEFORE COMMIT 7 RATHER THAN INSIDE IT. Commit 7 makes a revealed paid invoice
// credit a referrer automatically (ruling 3), which means a SECOND caller starts writing
// conversions. Today `referral_conversions` has exactly one writer — this table's whole integrity
// rests on that — and adding the second one in the same commit that also changes what a referrer
// is paid would produce a diff nobody can review: an extraction and a money change at once.
// So the extraction lands first, with the webhook's behaviour proven unchanged, and commit 7 adds
// a caller to a writer that already exists.
//
// ⚠ THE PRIOR-COUNT READ MOVED IN WITH THE INSERT, AND THAT IS DELIBERATE RATHER THAN TIDY.
// `isFirstConversion` drives the #13 first-milestone email, and it is only correct if the count is
// taken BEFORE the insert. Left at the call site it is one reordering away from being wrong, and
// the reordering would look harmless — the count and the insert would still both be there. Here
// the ordering is a property of the function.
//
// ⚠ AND IT IS NOT A TRANSACTION, WHICH IS ALSO THE WEBHOOK'S EXISTING BEHAVIOUR. The count and
// the insert are two statements on the pool, so a concurrent first conversion for the same
// referrer could make both see zero and both send a first-milestone email. That race exists
// today, is unchanged by this extraction, and is NOT fixed here — fixing it inside a
// "no behaviour change" commit would make the guard-proof meaningless. Recorded rather than
// silently carried: the UNIQUE constraint still makes the CONVERSION itself exactly-once, so the
// worst case is a duplicate email, not a duplicate credit.
//
// ⚠ `db` IS THE FIRST ARGUMENT SO A CALLER INSIDE A TRANSACTION CAN PASS ITS `tx`. The webhook
// passes the pool, matching what it did before. Commit 7 may want the transaction.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records one referral conversion.
 * Inputs: a db/pool, and { userId, contractorId, jobberClientId, bonusAmount }.
 * Output: { inserted, id, isFirstConversion }
 *   inserted          — false when the UNIQUE constraint refused it as a duplicate delivery
 *   id                — the new row's id, or null when nothing was inserted
 *   isFirstConversion — whether this referrer had NO prior conversions, read BEFORE the insert
 *
 * ⚠ THE UNIQUE CONSTRAINT IS THE SAFETY NET, NOT THIS FUNCTION. `ON CONFLICT (user_id,
 * jobber_client_id) DO NOTHING` is what makes a redelivered webhook harmless, and
 * `UNIQUE(user_id, jobber_client_id)` on the table is a resident non-negotiable — one conversion
 * per client ever. `inserted` reports which happened so a caller can skip the emails.
 */
async function writeReferralConversion(db, { userId, contractorId, jobberClientId, bonusAmount } = {}) {
  if (!userId) throw new Error('writeReferralConversion: userId is required');
  if (!contractorId) throw new Error('writeReferralConversion: contractorId is required');
  if (!jobberClientId) throw new Error('writeReferralConversion: jobberClientId is required');
  if (bonusAmount === undefined || bonusAmount === null) {
    throw new Error('writeReferralConversion: bonusAmount is required');
  }

  // Count prior conversions BEFORE the insert — needed for #13 first-milestone detection.
  const priorCountResult = await db.query(
    `SELECT COUNT(*) AS cnt FROM referral_conversions WHERE user_id=$1`,
    [userId]
  );
  const isFirstConversion = parseInt(priorCountResult.rows[0]?.cnt || '0') === 0;

  // Write conversion record — UNIQUE constraint is the DB-level safety net.
  // RETURNING id lets the caller detect whether a new row was inserted vs duplicate skipped.
  const conversionInsert = await db.query(
    `INSERT INTO referral_conversions
       (user_id, contractor_id, jobber_client_id, converted_at, bonus_amount)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (user_id, jobber_client_id) DO NOTHING
     RETURNING id`,
    [userId, contractorId, jobberClientId, bonusAmount]
  );

  return {
    inserted: conversionInsert.rowCount > 0,
    id: conversionInsert.rows[0]?.id ?? null,
    isFirstConversion,
  };
}

module.exports = { writeReferralConversion };
