// Jobber webhook handlers
// HMAC verification uses process.env.JOBBER_CLIENT_SECRET — already present in Railway env vars, no new vars needed.
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../../db');

// POST /webhooks/jobber/disconnect
// Called by Jobber when a contractor removes Rooster Booster from their Jobber account.
// Jobber expects a 200 response or it will retry — we always return 200, even on DB failure.
router.post('/jobber/disconnect', async (req, res) => {
  // ── HMAC SIGNATURE VERIFICATION ───────────────────────────────────────────
  // TODO: confirm exact Jobber webhook signature header name before Marketplace submission
  const signature = req.headers['x-jobber-hmac-sha256'];
  const secret = process.env.JOBBER_CLIENT_SECRET;

  if (!secret) {
    console.error('[jobber-webhook] JOBBER_CLIENT_SECRET not set — cannot verify signature');
    return res.status(401).json({ error: 'Webhook secret not configured' });
  }

  if (!signature) {
    console.warn('[jobber-webhook] Missing x-jobber-hmac-sha256 header — rejecting request');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const rawBody = JSON.stringify(req.body);
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  if (signature !== expectedSig) {
    console.warn('[jobber-webhook] Signature mismatch — rejecting request');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // ── CONTRACTOR IDENTIFICATION ─────────────────────────────────────────────
  // Jobber may include contractor context in query params or body.
  // TODO: implement multi-contractor lookup here when FORA scales beyond one contractor
  const contractorId =
    req.query.contractorId ||
    req.body?.contractor_id ||
    'accent-roofing'; // MVP default

  console.log(`[jobber-webhook] Disconnect received for contractor: ${contractorId}`);

  // Always return 200 to Jobber — DB failures are logged but must not cause retries
  try {
    // ── DATABASE CLEANUP ─────────────────────────────────────────────────────
    // 1. Mark CRM settings as disconnected
    await pool.query(
      `UPDATE contractor_crm_settings SET is_connected = false WHERE contractor_id = $1`,
      [contractorId]
    );

    // 2. Delete the OAuth token row
    await pool.query(
      `DELETE FROM tokens WHERE contractor_id = $1`,
      [contractorId]
    );

    // ── ACTIVITY LOG ─────────────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO activity_log (event_type, detail, created_at)
       VALUES ('jobber_disconnect_webhook', $1, NOW())`,
      [`Jobber triggered disconnect for contractor: ${contractorId}`]
    );

    console.log(`[jobber-webhook] Cleanup complete for contractor: ${contractorId}`);
  } catch (err) {
    // Log but do not propagate — Jobber must receive 200 to prevent retries
    console.error('[jobber-webhook] DB cleanup failed:', err.message);
  }

  res.status(200).json({ received: true });
});

module.exports = router;
