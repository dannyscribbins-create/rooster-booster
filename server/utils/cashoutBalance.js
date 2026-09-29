'use strict';

// ── THE ONE DEFINITION OF A REFERRER'S AVAILABLE BALANCE (Danny's ruling, 2026-09-28) ──
//
// available = SUM(referral_conversions.bonus_amount)
//           − SUM(cashout_requests.amount WHERE status <> 'denied')
//
// ⚠ EVERY NON-DENIED CASHOUT DEDUCTS — 'pending' AND 'approved' AND 'paid'. That last one
// is the whole reason this module exists. `POST /api/cashout` deducted only
// `status IN ('pending','approved')`, so a SETTLED cashout stopped reducing the balance and
// the same earnings could be cashed out again, indefinitely. `routes/account.js` already
// computed it correctly with `status <> 'denied'`, so the codebase carried BOTH formulas and
// the money path used the wrong one. This is finding 1 of PAYOUT_AMOUNT_AUDIT.md.
//
// ⚠ IT WAS MEASURED FIRING IN PRODUCTION, NOT INFERRED. Danny's test referrer: earned
// $500.00, two SETTLED cashouts of $500 each, and the old gate deducted **0** — so his
// balance read $500 forever and he was paid twice against one earning. The visible symptom
// was a balance that "never drops": the dip is transient, and actioning the cashout in the
// admin panel is what restored it, because 'paid' left the deducted set.
//
// ⚠ 'denied' IS THE ONLY STATE THAT DOES NOT DEDUCT, and it is written as `<> 'denied'`
// rather than as an IN-list of the three that do. That direction is deliberate: a new status
// added later (a 'failed' or a 'reversed', say) then defaults to DEDUCTING, which is the
// safe direction — a state nobody taught this function about cannot silently free up money.
// An IN-list would fail open. **Do not "clarify" this into `IN ('pending','approved','paid')`.**
//
// ⚠ ONE STATEMENT, NOT TWO QUERIES. The gate this replaces ran the earned sum and the
// deducted sum as two separate round trips under Promise.all, so a cashout inserted between
// them was counted by neither. One statement reads both sides at one instant.
//
// ⚠ SCOPED BY user_id ONLY, WHICH MATCHES routes/account.js AND IS NOT AN OVERSIGHT — BUT IT
// IS ALSO NOT COMPLETE, AND THE GAP IS FILED. 13 of 19 production cashout rows carry
// `user_id = NULL`, including all four in 'approved', so `WHERE user_id = $1` cannot see them
// and they are deducted by neither the old formula nor this one. Fixing THAT is a separate
// item on PRE_LAUNCH_CHECKLIST.md's payout-audit block; changing the predicate here would
// change which rows every caller counts, which is its own ruling. **This function is not a
// fix for the NULL user_id rows and must not be recorded as one.**
//
// ⚠ AND server/test/cashoutBalanceSingleSource.test.js FENCES THIS. It fails, naming
// file:line, if any other file under server/ computes a per-user balance from
// `cashout_requests` itself. If you are about to write one, import this instead.

/**
 * A referrer's cash-out balance.
 *
 * Inputs:
 *   db     — a pg Pool or a checked-out client/transaction. Anything with .query().
 *   userId — users.id of the referrer.
 *
 * Output: { earned, deducted, available }, all NUMBERS in dollars.
 *   earned    — every referral bonus ever booked for this user
 *   deducted  — every cashout of theirs that is not 'denied'
 *   available — earned − deducted. ⚠ CAN BE ZERO OR NEGATIVE, and callers must handle
 *               that rather than clamping: a negative balance is the true state of an
 *               account that has been over-paid, and hiding it behind a `Math.max(0, …)`
 *               would conceal exactly the condition this module was written to surface.
 *
 * ⚠ Money arrives from node-postgres as a NUMERIC **string** ('500.00'), so every value is
 * put through Number() here. A caller comparing a request amount against a raw column value
 * would be comparing a number to a string.
 */
async function getCashoutBalance(db, userId) {
  const { rows } = await db.query(
    `SELECT
       COALESCE((SELECT SUM(bonus_amount) FROM referral_conversions WHERE user_id = $1), 0) AS earned,
       COALESCE((SELECT SUM(amount) FROM cashout_requests WHERE user_id = $1 AND status <> 'denied'), 0) AS deducted`,
    [userId]
  );
  const earned = Number(rows[0]?.earned ?? 0);
  const deducted = Number(rows[0]?.deducted ?? 0);

  // ⚠ A NON-FINITE RESULT IS NOT TREATED AS ZERO. Number('') and Number(null) are 0, which
  // would read as "nothing earned, nothing spent" — a manufactured plausible answer of
  // exactly the kind CLAUDE.md records from getStripeRow()'s `|| { not_connected }`. If the
  // arithmetic cannot be done, say so and let the caller fail closed.
  if (!Number.isFinite(earned) || !Number.isFinite(deducted)) {
    throw new Error(`getCashoutBalance: non-numeric balance for user ${userId}`);
  }

  return { earned, deducted, available: earned - deducted };
}

module.exports = { getCashoutBalance };
