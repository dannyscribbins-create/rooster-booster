const express = require('express');
const Stripe = require('stripe');
const { pool } = require('../db');
const { verifyAdminSession } = require('../middleware/auth');
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { stripeShouldRetry } = require('../utils/retryHelpers');
const { encrypt, decrypt } = require('../utils/encryption');
const { executeStripeTransfer } = require('../utils/stripeTransfer');

const router = express.Router();
const CONTRACTOR_ID = 'accent-roofing'; // MVP: pull from session at multi-contractor scale

function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return Stripe(process.env.STRIPE_SECRET_KEY);
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function getStripeRow() {
  try {
    const r = await pool.query(
      'SELECT stripe_account_id, stripe_connect_status FROM contractor_settings WHERE contractor_id = $1',
      [CONTRACTOR_ID]
    );
    return r.rows[0] || { stripe_account_id: null, stripe_connect_status: 'not_connected' };
  } catch (err) {
    throw err;
  }
}

async function upsertStripeAccount(stripeAccountId, status) {
  try {
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, stripe_account_id, stripe_connect_status)
       VALUES ($1, $2, $3)
       ON CONFLICT (contractor_id) DO UPDATE
         SET stripe_account_id = $2, stripe_connect_status = $3, updated_at = NOW()`,
      [CONTRACTOR_ID, stripeAccountId, status]
    );
  } catch (err) {
    throw err;
  }
}

// ── Route 1: POST /api/admin/stripe/create-account-link ───────────────────────

router.post('/api/admin/stripe/create-account-link', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const stripe = getStripeClient();
    const row = await getStripeRow();
    let stripeAccountId = row.stripe_account_id;

    if (!stripeAccountId) {
      const account = await retryWithBackoff(
        () => stripe.accounts.create({ type: 'standard' }),
        { retries: 2, shouldRetry: stripeShouldRetry }
      );
      stripeAccountId = account.id;
      await upsertStripeAccount(stripeAccountId, 'pending');
    }
    // Status not updated here — confirm-connection (Route 2) is the canonical status updater after onboarding

    const frontendUrl = process.env.FRONTEND_URL || '';
    const accountLink = await retryWithBackoff(
      () => stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${frontendUrl}?admin=true&stripe_connect=refresh`,
        return_url: `${frontendUrl}?admin=true&stripe_connect=success`,
        type: 'account_onboarding',
      }),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );

    res.json({ url: accountLink.url });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to create Stripe account link' });
  }
});

// ── Route 2: POST /api/admin/stripe/confirm-connection ────────────────────────

router.post('/api/admin/stripe/confirm-connection', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const row = await getStripeRow();
    if (!row.stripe_account_id) {
      return res.status(400).json({ error: 'No Stripe account linked' });
    }

    const stripe = getStripeClient();
    const account = await retryWithBackoff(
      () => stripe.accounts.retrieve(row.stripe_account_id),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );

    const status = (account.charges_enabled && account.payouts_enabled) ? 'active' : 'pending';
    await pool.query(
      `UPDATE contractor_settings SET stripe_connect_status = $1, updated_at = NOW() WHERE contractor_id = $2`,
      [status, CONTRACTOR_ID]
    );

    res.json({
      status,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to confirm Stripe connection' });
  }
});

// ── Route 3: GET /api/admin/stripe/connection-status ─────────────────────────

router.get('/api/admin/stripe/connection-status', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const row = await getStripeRow();
    const maskedId = row.stripe_account_id
      ? `...${row.stripe_account_id.slice(-6)}`
      : null;
    res.json({
      stripe_account_id_masked: maskedId,
      stripe_connect_status: row.stripe_connect_status || 'not_connected',
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to fetch Stripe connection status' });
  }
});

// ── Route 4: POST /api/admin/stripe/disconnect ────────────────────────────────

router.post('/api/admin/stripe/disconnect', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    // MVP: local-only clear. Stripe Standard accounts require manual deauthorization via Stripe dashboard.
    await pool.query(
      `UPDATE contractor_settings
         SET stripe_account_id = NULL, stripe_connect_status = 'not_connected', updated_at = NOW()
       WHERE contractor_id = $1`,
      [CONTRACTOR_ID]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to disconnect Stripe account' });
  }
});

// ── Route 5: POST /api/admin/stripe/transfer ──────────────────────────────────
// TODO: Danny to remove STRIPE_TEST_ACCOUNT_ID from Railway env vars — no longer used

router.post('/api/admin/stripe/transfer', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { cashoutRequestId, userId, bonusAmount } = req.body;
  if (!cashoutRequestId || !userId || !bonusAmount) {
    return res.status(400).json({ error: 'cashoutRequestId, userId, and bonusAmount are required' });
  }
  try {
    const result = await executeStripeTransfer(pool, { userId, cashoutRequestId, bonusAmount });
    return res.json({ success: true, transferId: result.transferId });
  } catch (err) {
    if (err.code === 'no_bank_account') {
      return res.status(400).json({
        error: 'no_bank_account',
        message: 'Referrer has no bank account connected'
      });
    }
    if (err.message === 'no_contractor_stripe_account') {
      return res.status(400).json({
        error: 'no_stripe_account',
        message: 'Contractor Stripe account not connected'
      });
    }
    await logError({ req, error: err });
    return res.status(500).json({ error: 'transfer_failed', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// REFERRER BANK CONNECTION ROUTES
// Protected by referrer session auth (same pattern as referrer.js)
// Sensitive values: never log payment method IDs, bank tokens,
// Financial Connections account IDs, or decrypted values anywhere
// ─────────────────────────────────────────────────────────────

// ── Route 6: POST /api/referrer/stripe/create-financial-connections-session ───

router.post('/api/referrer/stripe/create-financial-connections-session', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const user_id = sessionResult.rows[0].user_id;

    const userResult = await pool.query(
      'SELECT id, full_name, email, stripe_customer_id FROM users WHERE id = $1',
      [user_id]
    );
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    const stripe = getStripeClient();
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await retryWithBackoff(
        () => stripe.customers.create({
          name: user.full_name,
          email: user.email,
          metadata: { roofmiles_user_id: String(user.id), contractor_id: 'accent-roofing' }
        }),
        { retries: 2, shouldRetry: stripeShouldRetry }
      );
      customerId = customer.id;
      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, user_id]
      );
    }

    const session = await retryWithBackoff(
      () => stripe.financialConnections.sessions.create({
        account_holder: { type: 'customer', customer: customerId },
        filters: { countries: ['US'] },
        permissions: ['payment_method', 'balances'],
        return_url: process.env.FRONTEND_URL + '/profile?section=manage-account&stripe_bank=complete'
      }),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );

    res.json({ clientSecret: session.client_secret });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to create bank connection session' });
  }
});

// ── Route 7: POST /api/referrer/stripe/save-bank-account ─────────────────────

router.post('/api/referrer/stripe/save-bank-account', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const user_id = sessionResult.rows[0].user_id;

    const { financialConnectionsAccountId } = req.body;
    if (!financialConnectionsAccountId) {
      return res.status(400).json({ error: 'financialConnectionsAccountId is required' });
    }

    const stripe = getStripeClient();
    const paymentMethod = await retryWithBackoff(
      () => stripe.paymentMethods.create({
        type: 'us_bank_account',
        us_bank_account: { financial_connections_account: financialConnectionsAccountId }
      }),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );
    const paymentMethodId = paymentMethod.id;
    const encrypted = encrypt(paymentMethodId);

    await pool.query(
      'UPDATE users SET stripe_bank_account_token = $1 WHERE id = $2',
      [encrypted, user_id]
    );

    const bankName = paymentMethod.us_bank_account?.bank_name || null;
    const last4 = paymentMethod.us_bank_account?.last4 || null;

    console.log('[stripe] bank account saved for user', user_id); // diagnostic log — intentional

    res.json({ success: true, bankName, last4 });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to save bank account' });
  }
});

// ── Route 8: GET /api/referrer/stripe/bank-status ────────────────────────────

router.get('/api/referrer/stripe/bank-status', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const user_id = sessionResult.rows[0].user_id;

    const result = await pool.query(
      'SELECT stripe_bank_account_token FROM users WHERE id = $1',
      [user_id]
    );
    if (!result.rows.length || !result.rows[0].stripe_bank_account_token) {
      return res.json({ connected: false });
    }

    const paymentMethodId = decrypt(result.rows[0].stripe_bank_account_token);
    const stripe = getStripeClient();
    try {
      const pm = await retryWithBackoff(
        () => stripe.paymentMethods.retrieve(paymentMethodId),
        { retries: 2, shouldRetry: stripeShouldRetry }
      );
      const bankName = pm.us_bank_account?.bank_name || null;
      const last4 = pm.us_bank_account?.last4 || null;
      return res.json({ connected: true, bankName, last4 });
    } catch {
      // Graceful degradation — stale/invalid token, do not crash
      return res.json({ connected: false, stale: true });
    }
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to fetch bank status' });
  }
});

module.exports = router;
