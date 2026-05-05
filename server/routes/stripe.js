const express = require('express');
const Stripe = require('stripe');
const { pool } = require('../db');
const { verifyAdminSession } = require('../middleware/auth');
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { stripeShouldRetry } = require('../utils/retryHelpers');

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
        refresh_url: `${frontendUrl}/admin/banking?stripe_connect=refresh`,
        return_url: `${frontendUrl}/admin/banking?stripe_connect=success`,
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

router.post('/api/admin/stripe/transfer', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const { cashout_request_id, amount_cents } = req.body;

    if (!cashout_request_id || !amount_cents) {
      return res.status(400).json({ error: 'cashout_request_id and amount_cents are required' });
    }

    const destinationAccountId = process.env.STRIPE_TEST_ACCOUNT_ID || null;

    if (!destinationAccountId) {
      return res.status(422).json({
        error: 'no_destination_account',
        message: 'Referrer does not have a connected Stripe account yet.',
      });
    }

    const stripe = getStripeClient();

    const transfer = await retryWithBackoff(
      () => stripe.transfers.create({
        amount: amount_cents,
        currency: 'usd',
        destination: destinationAccountId,
      }),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );

    await pool.query(
      `INSERT INTO activity_log (event_type, detail, created_at)
       VALUES ('stripe_transfer', $1, NOW())`,
      [`Transfer ${transfer.id} for cashout #${cashout_request_id} — $${(amount_cents / 100).toFixed(2)}`]
    );

    res.json({ success: true, transfer_id: transfer.id });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Stripe transfer failed', message: err.message });
  }
});

module.exports = router;
