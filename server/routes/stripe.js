const express = require('express');
const Stripe = require('stripe');
const { pool } = require('../db');
const { verifyAdminSession, verifyReferrerSession } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
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

router.post('/api/admin/stripe/create-account-link', requirePermission('finance_settings.manage'), async (req, res) => {
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

router.post('/api/admin/stripe/confirm-connection', requirePermission('finance_settings.manage'), async (req, res) => {
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

router.get('/api/admin/stripe/connection-status', requirePermission('finance_settings'), async (req, res) => {
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

router.post('/api/admin/stripe/disconnect', requirePermission('finance_settings.manage'), async (req, res) => {
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

router.post('/api/admin/stripe/transfer', requirePermission('cashout_approve'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { cashoutRequestId, userId, bonusAmount } = req.body;
  if (!cashoutRequestId || !userId || !bonusAmount) {
    return res.status(400).json({ error: 'cashoutRequestId, userId, and bonusAmount are required' });
  }
  try {
    // ── TENANCY, IN THE PREDICATE ─────────────────────────────────────────────
    // All three inputs arrive from req.body and none of them was checked against
    // anything before this. The join also BINDS the payee to the cashout: userId
    // is no longer an independent parameter that happens to be passed alongside
    // cashoutRequestId, which is what the endpoint always meant.
    //
    // ⚠ THIS GATE IS THE CONTROL. DO NOT WEAKEN IT ON THE STRENGTH OF THE READS
    // BELOW IT. Removing it during a guard-proof injection produced a 400
    // no_bank_account rather than a leak, because executeStripeTransfer's own
    // scoped user read happened to catch the cross-tenant id — but that is
    // INCIDENTAL, not designed. The shapes do not match because nothing intended
    // them to, and the coincidence disappears the moment that read changes. The
    // inner scoping is correct on its own terms; it is not a second gate, and
    // this comment exists so nobody records it as one.
    const owned = await pool.query(
      `SELECT 1 FROM cashout_requests cr
         JOIN users u ON u.id = cr.user_id
        WHERE cr.id = $1 AND cr.user_id = $2
          AND cr.contractor_id = $3 AND u.contractor_id = $3`,
      [cashoutRequestId, userId, contractorId]
    );
    if (owned.rowCount === 0) {
      return res.status(404).json({ error: 'not_found', message: 'Cashout request not found' });
    }

    const result = await executeStripeTransfer(pool, { userId, cashoutRequestId, bonusAmount, contractorId });
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
//
// All four routes below are protected by verifyReferrerSession(), the sanctioned
// verifier — CLOSED 2026-08-28, Wave 1.1-d.
//
// ── THE RECORD OF WHAT WAS HERE, KEPT BECAUSE IT EXPLAINS THE SHAPE ──────────
//
// ⚠ THIS HEADER ONCE SAID "Protected by referrer session auth (same pattern
// as referrer.js)". THAT WAS NOT TRUE, AND IT WAS AN INVERTED RECORD RATHER
// THAN A STALE ONE — it told the next reader a mechanism was in place, so the
// reader who checked would stop checking. Corrected 2026-08-27, Wave 1.1; the
// sentence is true as of the fix below, which is exactly why the history stays.
//
// WHAT THESE FOUR ROUTES USED TO DO. Each hand-rolled its own session lookup
// instead of calling verifyReferrerSession():
//     SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()
// That was a live violation of CLAUDE.md's Never Break These Rules, which names
// verifyReferrerSession() as one of the only authorised ways to protect an
// endpoint and says never to inline a raw token check.
//
// SIX DIFFERENCES, not the three first recorded. All six are now closed, and
// each has an assertion in server/test/referrerStripeInlineAuth.test.js:
//   1. u.deleted_at IS NULL  — a SOFT-DELETED homeowner kept working here.
//      ⚠ TEST-ONLY: production held ZERO soft-deleted users on 2026-08-28, so
//      nothing exercises this in production and the suite is the whole proof.
//   2. s.contractor_id IS NOT NULL — a tenant-less session authenticated.
//   3. applySessionSlide()   — these four silently opted OUT of D7's 30-day
//      sliding window while every other referrer route extended it. A person
//      whose only activity was banking aged out on a schedule nobody chose.
//      Nothing failed; the session just quietly expired early.
//   4. JOIN users — the inline query returned user_id = NULL for a session with
//      no user behind it, and the handlers ran their whole body against it.
//      bank-status answered 200, and disconnect-bank reported SUCCESS.
//   5. The auth error path — a throw in the session lookup landed in the
//      ROUTE's catch, so an authentication outage was reported to the caller as
//      "Failed to fetch bank status".
//   6. logError attribution — that same failure was stamped 'backend' against a
//      banking route, so nothing in ops pointed at auth.
//
// AND NO GUARD SAW ANY OF IT: adminRouteCoverage.test.js filters /api/admin/*
// and these are /api/referrer/*, so they were neither gated, nor allowlisted,
// nor checked. ⚠ THAT GAP IS STILL OPEN — the fix below closes these four, not
// the blind spot that hid them. A companion invariant over /api/referrer/* is
// Wave 1.1-d2. save-bank-account is also a step-up re-auth target.
//
// ⚠ DO NOT "FIX" A FUTURE DIVERGENCE BY COPYING PREDICATES INTO A HANDLER.
// That is what produced these four. Route everything through the verifier.
//
// Sensitive values: never log payment method IDs, bank tokens,
// Financial Connections account IDs, or decrypted values anywhere
// ─────────────────────────────────────────────────────────────

// ── Route 6: POST /api/referrer/stripe/create-financial-connections-session ───

router.post('/api/referrer/stripe/create-financial-connections-session', async (req, res) => {
  try {
    const referrerSession = await verifyReferrerSession(req, res);
    if (!referrerSession) return;
    const { userId } = referrerSession;

    const userResult = await pool.query(
      'SELECT id, full_name, email, stripe_customer_id FROM users WHERE id = $1',
      [userId]
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
        [customerId, userId]
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
  try {
    const referrerSession = await verifyReferrerSession(req, res);
    if (!referrerSession) return;
    const { userId } = referrerSession;

    const { financialConnectionsAccountId } = req.body;
    if (!financialConnectionsAccountId) {
      return res.status(400).json({ error: 'financialConnectionsAccountId is required' });
    }

    const userResult = await pool.query(
      'SELECT stripe_bank_account_token, full_name FROM users WHERE id = $1',
      [userId]
    );
    if (!userResult.rows.length) return res.status(404).json({ error: 'User not found' });
    const userRow = userResult.rows[0];

    const stripe = getStripeClient();
    const paymentMethod = await retryWithBackoff(
      () => stripe.paymentMethods.create({
        type: 'us_bank_account',
        us_bank_account: { financial_connections_account: financialConnectionsAccountId },
        billing_details: { name: userRow.full_name }
      }),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );
    const paymentMethodId = paymentMethod.id;
    const encrypted = encrypt(paymentMethodId);

    await pool.query(
      'UPDATE users SET stripe_bank_account_token = $1 WHERE id = $2',
      [encrypted, userId]
    );

    const bankName = paymentMethod.us_bank_account?.bank_name || null;
    const last4 = paymentMethod.us_bank_account?.last4 || null;

    console.log('[stripe] bank account saved for user', userId); // diagnostic log — intentional

    res.json({ success: true, bankName, last4 });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to save bank account' });
  }
});

// ── Route 8: GET /api/referrer/stripe/bank-status ────────────────────────────

router.get('/api/referrer/stripe/bank-status', async (req, res) => {
  try {
    const referrerSession = await verifyReferrerSession(req, res);
    if (!referrerSession) return;
    const { userId } = referrerSession;

    const result = await pool.query(
      'SELECT stripe_bank_account_token FROM users WHERE id = $1',
      [userId]
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

// ── Route 9: POST /api/referrer/stripe/disconnect-bank ───────────────────────

router.post('/api/referrer/stripe/disconnect-bank', async (req, res) => {
  try {
    const referrerSession = await verifyReferrerSession(req, res);
    if (!referrerSession) return;
    const { userId } = referrerSession;

    const pendingResult = await pool.query(
      `SELECT COUNT(*) FROM cashout_requests
       WHERE user_id = $1 AND status IN ('pending', 'approved')`,
      [userId]
    );
    if (parseInt(pendingResult.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'pending_cashouts',
        message: 'Cannot disconnect bank while a cashout is pending'
      });
    }

    // Clear only the bank token — keep stripe_customer_id so it can be reused on reconnect
    await pool.query(
      'UPDATE users SET stripe_bank_account_token = NULL WHERE id = $1',
      [userId]
    );

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to disconnect bank account' });
  }
});

module.exports = router;
