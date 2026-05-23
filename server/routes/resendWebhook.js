// Resend webhook handler
// Verifies svix signatures and processes email delivery events for campaign tracking.
// IMPORTANT: This route requires express.raw({ type: 'application/json' }) middleware applied
// upstream in server.js BEFORE express.json() — the raw buffer is required for svix signature
// verification. Never remove the express.raw() middleware for this path.
const express = require('express');
const router = express.Router();
const { Webhook } = require('svix');
const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');

// POST /resend
// Handles all Resend webhook events for campaign email tracking.
// Always returns 200 (except on signature failure) — Resend retries on non-200
// and would flood duplicate events if we returned an error on DB failure.
router.post('/resend', async (req, res) => {
  // ── SIGNATURE VERIFICATION ──────────────────────────────────────────────────
  const rawBody = req.body;

  if (!process.env.RESEND_WEBHOOK_SECRET) {
    await logError({ req, error: new Error('RESEND_WEBHOOK_SECRET not set'), source: 'POST /api/webhooks/resend' });
    return res.status(400).json({ error: 'Webhook secret not configured' });
  }

  const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET);
  try {
    wh.verify(rawBody, {
      'svix-id': req.headers['svix-id'],
      'svix-timestamp': req.headers['svix-timestamp'],
      'svix-signature': req.headers['svix-signature'],
    });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/webhooks/resend' });
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // ── PARSE BODY ──────────────────────────────────────────────────────────────
  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/webhooks/resend — JSON parse' });
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // ── RESOLVE CONTACT TOKEN ───────────────────────────────────────────────────
  // Resend puts the recipient email in event.data.to as an array of strings.
  const contactEmail = Array.isArray(event.data?.to) ? event.data.to[0] : event.data?.to;

  if (!contactEmail) {
    console.log('[resend-webhook] No recipient email in payload — skipping'); // diagnostic log — intentional
    return res.status(200).json({ received: true });
  }

  let tokenRow = null;
  try {
    const tokenResult = await pool.query(
      `SELECT token, campaign_id, batch_number, contractor_id
       FROM campaign_tracking_tokens
       WHERE contact_email = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [contactEmail]
    );
    tokenRow = tokenResult.rows[0] || null;
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/webhooks/resend — token lookup' });
  }

  if (!tokenRow) {
    console.log(`[resend-webhook] No tracking token found for email: ${contactEmail}`); // diagnostic log — intentional
    return res.status(200).json({ received: true });
  }

  const { token, campaign_id, batch_number, contractor_id } = tokenRow;

  // ── ROUTE BY EVENT TYPE ─────────────────────────────────────────────────────

  if (event.type === 'email.opened') {
    // ── OPEN (SERVER-SIDE) ────────────────────────────────────────────────────
    let openUpdated = false;
    try {
      const updateResult = await pool.query(
        `UPDATE campaign_contacts
         SET opened = true
         WHERE campaign_id = $1 AND batch_number = $2 AND email = $3 AND opened = false`,
        [campaign_id, batch_number, contactEmail]
      );
      openUpdated = updateResult.rowCount > 0;
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.opened update' });
    }

    if (openUpdated) {
      try {
        await pool.query(
          `INSERT INTO campaign_events (token, campaign_id, contractor_id, batch_number, event_type)
           VALUES ($1, $2, $3, $4, 'open_server')`,
          [token, campaign_id, contractor_id, batch_number]
        );
      } catch (err) {
        await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.opened event insert' });
      }
    }

    return res.status(200).json({ received: true });
  }

  if (event.type === 'email.clicked') {
    // ── CLICK (SERVER-SIDE) ───────────────────────────────────────────────────
    let clickUpdated = false;
    try {
      const updateResult = await pool.query(
        `UPDATE campaign_contacts
         SET clicked = true
         WHERE campaign_id = $1 AND batch_number = $2 AND email = $3 AND clicked = false`,
        [campaign_id, batch_number, contactEmail]
      );
      clickUpdated = updateResult.rowCount > 0;
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.clicked update' });
    }

    if (clickUpdated) {
      try {
        await pool.query(
          `INSERT INTO campaign_events (token, campaign_id, contractor_id, batch_number, event_type)
           VALUES ($1, $2, $3, $4, 'click_server')`,
          [token, campaign_id, contractor_id, batch_number]
        );
      } catch (err) {
        await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.clicked event insert' });
      }
    }

    return res.status(200).json({ received: true });
  }

  if (event.type === 'email.complained') {
    // ── SPAM COMPLAINT ────────────────────────────────────────────────────────
    try {
      await pool.query(
        `UPDATE campaign_contacts
         SET complained = true
         WHERE campaign_id = $1 AND batch_number = $2 AND email = $3`,
        [campaign_id, batch_number, contactEmail]
      );
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.complained update' });
    }

    try {
      await pool.query(
        `INSERT INTO campaign_events (token, campaign_id, contractor_id, batch_number, event_type)
         VALUES ($1, $2, $3, $4, 'complained')`,
        [token, campaign_id, contractor_id, batch_number]
      );
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.complained event insert' });
    }

    try {
      await pool.query(
        `INSERT INTO email_opt_outs (contractor_id, email, opt_out_all, opted_out_at, source)
         VALUES ($1, $2, true, NOW(), 'spam_complaint')
         ON CONFLICT (contractor_id, email)
         DO UPDATE SET opt_out_all = true, opted_out_at = NOW(), source = 'spam_complaint'`,
        [contractor_id, contactEmail]
      );
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.complained opt-out upsert' });
    }

    return res.status(200).json({ received: true });
  }

  if (event.type === 'email.bounced') {
    // ── BOUNCE ────────────────────────────────────────────────────────────────
    try {
      await pool.query(
        `UPDATE campaign_contacts
         SET bounced = true
         WHERE campaign_id = $1 AND batch_number = $2 AND email = $3`,
        [campaign_id, batch_number, contactEmail]
      );
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.bounced update' });
    }

    try {
      await pool.query(
        `INSERT INTO campaign_events (token, campaign_id, contractor_id, batch_number, event_type)
         VALUES ($1, $2, $3, $4, 'bounced')`,
        [token, campaign_id, contractor_id, batch_number]
      );
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.bounced event insert' });
    }

    return res.status(200).json({ received: true });
  }

  if (event.type === 'email.delivered') {
    // ── DELIVERED ─────────────────────────────────────────────────────────────
    let deliveredUpdated = false;
    try {
      const updateResult = await pool.query(
        `UPDATE campaign_contacts
         SET delivered = true
         WHERE campaign_id = $1 AND batch_number = $2 AND email = $3`,
        [campaign_id, batch_number, contactEmail]
      );
      deliveredUpdated = updateResult.rowCount > 0;
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.delivered update' });
    }

    if (deliveredUpdated) {
      try {
        await pool.query(
          `INSERT INTO campaign_events (token, campaign_id, contractor_id, batch_number, event_type)
           VALUES ($1, $2, $3, $4, 'delivered')`,
          [token, campaign_id, contractor_id, batch_number]
        );
      } catch (err) {
        await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.delivered event insert' });
      }
    }

    return res.status(200).json({ received: true });
  }

  if (event.type === 'email.failed') {
    // ── FAILED ────────────────────────────────────────────────────────────────
    let failedUpdated = false;
    try {
      const updateResult = await pool.query(
        `UPDATE campaign_contacts
         SET failed = true
         WHERE campaign_id = $1 AND batch_number = $2 AND email = $3`,
        [campaign_id, batch_number, contactEmail]
      );
      failedUpdated = updateResult.rowCount > 0;
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.failed update' });
    }

    if (failedUpdated) {
      try {
        await pool.query(
          `INSERT INTO campaign_events (token, campaign_id, contractor_id, batch_number, event_type)
           VALUES ($1, $2, $3, $4, 'failed')`,
          [token, campaign_id, contractor_id, batch_number]
        );
      } catch (err) {
        await logError({ req, error: err, source: 'POST /api/webhooks/resend — email.failed event insert' });
      }
    }

    return res.status(200).json({ received: true });
  }

  // ── UNHANDLED EVENT TYPES ───────────────────────────────────────────────────
  // Covers: sent, delivery_delayed, scheduled, received, suppressed
  console.log(`[resend-webhook] Unhandled event type: ${event.type}`); // diagnostic log — intentional
  return res.status(200).json({ received: true });
});

module.exports = router;
