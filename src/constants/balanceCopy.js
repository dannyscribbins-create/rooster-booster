// ── WHAT A REFERRER IS SHOWN ABOUT THEIR BALANCE ─────────────────────────────
//
// Danny's §2.10 ruling, 2026-09-29, amending §2.9
// (RoofMiles_Decisions_Record_Canvass_Attribution.md):
//
//   · a NEGATIVE balance DISPLAYS AS NEGATIVE, with a SUBTLE note explaining why;
//   · a TRUE $0 — someone with no progress yet — displays as $0 with NO message of any kind.
//
// ⚠ THE DISTINCTION IS BETWEEN A `$0` THAT MEANS NO PROGRESS AND A `$0` THAT WAS HIDING A
// NEGATIVE. The first keeps its silence; the second no longer exists, because the negative
// now shows. **Never explain a zero that just means "nothing yet".**
//
// ⚠ WHAT §2.9 SAID, AND WHY IT CHANGED. It clamped every non-positive balance to a plain
// `$0` with no message. That shipped (commits 3b/3c) and was withdrawn the next day: a
// referrer who earned $300 while at −$500 saw `$0` and would reasonably conclude nothing had
// happened, while their earnings went to a shortfall nobody had told them about. **The clamp
// did not make the situation kinder; it made it unexplainable.**
//
// ⚠ THE NOTE MUST NOT IMPLY A DEBT, AND THAT IS A RULING RATHER THAN A TONE PREFERENCE.
// Danny ruled POLICY B (§2.8): when a referrer's earnings shrink after a payout the
// CONTRACTOR absorbs the shortfall. **The referrer owes nothing.** So no wording here may say
// or suggest "owed", "debt", "repay", "negative" or "over-paid". Wording chosen by Danny
// 2026-09-29 from three proposals; the other two named the adjustment's cause or said
// outright that nothing is owed, and both raised a possibility the referrer need not consider.
export const BALANCE_ADJUSTMENT_NOTE = 'Your balance reflects a recent adjustment. Questions? Contact us.';

/**
 * Does this balance get the note?
 * ⚠ NEGATIVE ONLY. Not `<= 0` — a true zero is silent by ruling, and that silence is the
 * half of §2.9 that SURVIVED the amendment.
 * ⚠ AND NOT WHILE UNKNOWN: a note beside a figure that has not loaded explains nothing.
 */
export function showsBalanceNote({ available, known }) {
  return known === true && Number.isFinite(available) && available < 0;
}

/**
 * The figure itself, as text.
 * ⚠ THE NEGATIVE IS SHOWN AS NEGATIVE. No clamp, no absolute value, no "over-paid" phrasing —
 * the display matches the arithmetic, which is the whole point of the amendment.
 * ⚠ AND `known === false` IS NOT `$0`. It returns null so a caller renders its own
 * not-yet-known treatment rather than stating a figure it has no basis for.
 */
export function formatBalance({ available, known }) {
  if (known !== true || !Number.isFinite(available)) return null;
  const abs = Math.abs(available).toLocaleString();
  return available < 0 ? `-$${abs}` : `$${abs}`;
}

/**
 * May this referrer start a cash-out request?
 * ⚠ AT OR BELOW ZERO THE CONTROLS ARE DISABLED AND CARRY NO SEPARATE EXPLANATION (Danny,
 * 2026-09-29). The note already gives the reason where there is one; a second message beside
 * a greyed button is the "explain the zero" noise §2.9 was right to rule out.
 * ⚠ THE $20 MINIMUM IS A SEPARATE, EXISTING RULE and is not folded in here — it is about the
 * REQUEST, not about the balance, and the cash-out screen states it on its own terms.
 */
export function canRequestCashout({ available, known }) {
  return known === true && Number.isFinite(available) && available > 0;
}
