// Jobber webhook handlers
// HMAC verification uses process.env.JOBBER_CLIENT_SECRET — already present in Railway env vars, no new vars needed.
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../../db');
const { syncSingleClient } = require('../../crm/pipelineSync');

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

// POST /webhooks/jobber/client-create
// Jobber fires this when a new client profile is created.
// Responds 200 immediately — sync runs async to stay within Jobber's response window.
router.post('/jobber/client-create', async (req, res) => {
  // ── HMAC SIGNATURE VERIFICATION ─────────────────────────────────────────────
  const signature = req.headers['x-jobber-hmac-sha256'];
  const secret    = process.env.JOBBER_CLIENT_SECRET;

  if (!secret) {
    console.error('[jobber-webhook] JOBBER_CLIENT_SECRET not set — cannot verify signature');
    return res.status(401).json({ error: 'Webhook secret not configured' });
  }
  if (!signature) {
    console.warn('[jobber-webhook] Missing x-jobber-hmac-sha256 header on client-create');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const rawBody     = JSON.stringify(req.body);
  const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  if (signature !== expectedSig) {
    console.warn('[jobber-webhook] Signature mismatch on client-create');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Respond 200 immediately — Jobber requires a fast response
  res.status(200).json({ received: true });

  // Async sync — never blocks the webhook response
  // MVP: webhook payload may not include full nested quotes/jobs/invoices data.
  // If payload is incomplete, classifyPipelineStatus returns 'lead' as default.
  // The 30-minute incremental sync will correct the status. This is acceptable for MVP.
  // TODO: implement multi-contractor lookup here when FORA scales beyond one contractor
  const contractorId = req.query.contractorId || req.body?.contractor_id || 'accent-roofing';
  const client       = req.body?.data?.client || req.body;

  (async () => {
    try {
      const settingsResult = await pool.query(
        'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const referralStartDate = settingsResult.rows[0]?.referral_start_date
        ? new Date(settingsResult.rows[0].referral_start_date)
        : null;
      await syncSingleClient(contractorId, client, referralStartDate);
      console.log(`[jobber-webhook] client-create sync complete for client: ${client?.id}`);
    } catch (err) {
      console.error('[jobber-webhook] client-create sync failed:', err.message);
    }
  })();
});

// POST /webhooks/jobber/client-update
// Jobber fires this when a client profile is updated (custom fields, job status, etc).
// Responds 200 immediately — sync runs async.
router.post('/jobber/client-update', async (req, res) => {
  // ── HMAC SIGNATURE VERIFICATION ─────────────────────────────────────────────
  const signature = req.headers['x-jobber-hmac-sha256'];
  const secret    = process.env.JOBBER_CLIENT_SECRET;

  if (!secret) {
    console.error('[jobber-webhook] JOBBER_CLIENT_SECRET not set — cannot verify signature');
    return res.status(401).json({ error: 'Webhook secret not configured' });
  }
  if (!signature) {
    console.warn('[jobber-webhook] Missing x-jobber-hmac-sha256 header on client-update');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const rawBody     = JSON.stringify(req.body);
  const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  if (signature !== expectedSig) {
    console.warn('[jobber-webhook] Signature mismatch on client-update');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Respond 200 immediately
  res.status(200).json({ received: true });

  // Async sync — never blocks the webhook response
  // MVP: webhook payload may not include full nested quotes/jobs/invoices data.
  // If payload is incomplete, classifyPipelineStatus returns 'lead' as default.
  // The 30-minute incremental sync will correct the status. This is acceptable for MVP.
  // TODO: implement multi-contractor lookup here when FORA scales beyond one contractor
  const contractorId = req.query.contractorId || req.body?.contractor_id || 'accent-roofing';
  const client       = req.body?.data?.client || req.body;

  (async () => {
    try {
      const settingsResult = await pool.query(
        'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const referralStartDate = settingsResult.rows[0]?.referral_start_date
        ? new Date(settingsResult.rows[0].referral_start_date)
        : null;
      await syncSingleClient(contractorId, client, referralStartDate);
      console.log(`[jobber-webhook] client-update sync complete for client: ${client?.id}`);
    } catch (err) {
      console.error('[jobber-webhook] client-update sync failed:', err.message);
    }
  })();
});

module.exports = router;
