'use strict';

const Stripe = require('stripe');
const { decrypt } = require('./encryption');

// TODO: Danny to remove STRIPE_TEST_ACCOUNT_ID from Railway env vars — no longer used

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
 * @returns {object} { success: true, transferId: string }
 * @throws on any failure
 */
async function executeStripeTransfer(pool, { userId, cashoutRequestId, bonusAmount }) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  // 1. Look up referrer bank token
  const userResult = await pool.query(
    'SELECT stripe_bank_account_token FROM users WHERE id = $1',
    [userId]
  );

  if (!userResult.rows[0]?.stripe_bank_account_token) {
    const err = new Error('no_bank_account');
    err.code = 'no_bank_account';
    throw err;
  }

  // NEVER log this value
  const paymentMethodId = decrypt(userResult.rows[0].stripe_bank_account_token);

  // 2. Look up contractor Stripe account
  const contractorResult = await pool.query(
    `SELECT stripe_account_id FROM contractor_settings
     WHERE contractor_id = 'accent-roofing'`
  );

  if (!contractorResult.rows[0]?.stripe_account_id) {
    throw new Error('no_contractor_stripe_account');
  }

  const contractorStripeAccountId = contractorResult.rows[0].stripe_account_id;

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
      roofmiles_contractor: 'accent-roofing'
    }
  });

  return { success: true, transferId: transfer.id };
}

module.exports = { executeStripeTransfer };
