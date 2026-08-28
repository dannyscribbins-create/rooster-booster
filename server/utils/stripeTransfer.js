'use strict';

const Stripe = require('stripe');
const { decrypt } = require('./encryption');
const { logError } = require('../middleware/errorLogger');

// TODO: Danny to remove STRIPE_TEST_ACCOUNT_ID from Railway env vars — no longer used

// ── THE SANCTIONED CONNECTED-ACCOUNT PATH ─────────────────────────────────────
// Modelled deliberately on getContractorAccessToken(contractorId) in
// server/crm/jobber.js: required argument, parameterised predicate, loud throw,
// and NEVER a default. CLAUDE_REGISTRY.md Known Issues 2a names this file in its
// STILL OPEN list and instructs exactly this shape — resolve from the session's
// contractorId, and do not reintroduce getDefaultContractorId().
//
// ⚠ WHAT THIS REPLACED, BECAUSE THE FAILURE WAS SILENT AND LASTED WEEKS.
// The query was `WHERE contractor_id = 'accent-roofing'` — the PRE-RENAME GHOST
// id. Production's only contractor is 'accent-roofing-dev', so this returned
// ZERO ROWS for every caller, and the whole admin Stripe surface reported
// "not connected" against a live, healthy connection. A hardcoded literal that
// resolves to nothing does not fail loudly; it manufactures a plausible answer.
//
// 🔴 THE NOT-CONFIGURED CASE MUST FAIL CLOSED AND LOUD, AND THIS IS WHERE.
// A contractor who has signed up but not finished Stripe Connect WILL reach
// this path. Falling back to any default — a literal, an env var, the first row
// in the table — would pay one contractor's referrer out of another
// contractor's money. That is strictly worse than the defect being fixed.
// There is no fallback here, and there must never be one.
async function getContractorStripeAccountId(pool, contractorId) {
  if (!contractorId) {
    const err = new Error('getContractorStripeAccountId: contractorId is required');
    await logError({ req: null, error: err, source: 'getContractorStripeAccountId' });
    throw err;
  }
  const result = await pool.query(
    'SELECT stripe_account_id FROM contractor_settings WHERE contractor_id = $1',
    [contractorId]
  );
  const accountId = result.rows[0]?.stripe_account_id;
  if (!accountId) {
    // Message preserved verbatim — the transfer route maps this exact string to
    // its 400 no_stripe_account response. The code is additive, for callers that
    // would rather branch on a code than on a message.
    const err = new Error('no_contractor_stripe_account');
    err.code = 'no_contractor_stripe_account';
    throw err;
  }
  return accountId;
}

/**
 * Executes a Stripe ACH transfer from the contractor's connected account
 * to the referrer's linked bank account.
 *
 * NEVER log paymentMethodId, encrypted tokens, or decrypted values.
 *
 * @param {object} pool - DB pool
 * @param {object} params
 * @param {number} params.userId - referrer user ID
 * @param {number} params.cashoutRequestId - cashout request ID
 * @param {number} params.bonusAmount - dollar amount (e.g. 250.00)
 * @param {string} params.contractorId - REQUIRED. The contractor whose connected
 *   account funds this transfer and whose referrer is being paid. Both DB reads
 *   below are scoped by it. Never defaulted — see getContractorStripeAccountId.
 * @returns {object} { success: true, transferId: string }
 * @throws on any failure
 */
async function executeStripeTransfer(pool, { userId, cashoutRequestId, bonusAmount, contractorId }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  // 1. Look up referrer bank token — scoped, so a payee id from another tenant
  //    resolves to no row rather than to that tenant's encrypted token.
  const userResult = await pool.query(
    'SELECT stripe_bank_account_token FROM users WHERE id = $1 AND contractor_id = $2',
    [userId, contractorId]
  );

  if (!userResult.rows[0]?.stripe_bank_account_token) {
    const err = new Error('no_bank_account');
    err.code = 'no_bank_account';
    throw err;
  }

  // NEVER log this value
  const paymentMethodId = decrypt(userResult.rows[0].stripe_bank_account_token);

  // 2. Look up the CALLER'S contractor Stripe account — never a literal, never a default
  const contractorStripeAccountId = await getContractorStripeAccountId(pool, contractorId);

  // 3. Convert to cents — always use Math.round to avoid floating point errors
  const amountInCents = Math.round(bonusAmount * 100);
  if (amountInCents <= 0) throw new Error('invalid_amount');

  // 4. Fire transfer
  const transfer = await stripe.transfers.create({
    amount: amountInCents,
    currency: 'usd',
    destination: contractorStripeAccountId,
    transfer_group: 'cashout_' + cashoutRequestId,
    metadata: {
      cashout_request_id: String(cashoutRequestId),
      user_id: String(userId),
      roofmiles_contractor: contractorId
    }
  });

  return { success: true, transferId: transfer.id };
}

module.exports = { executeStripeTransfer };
