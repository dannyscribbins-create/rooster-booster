// Jobber webhook handlers
// HMAC verification uses process.env.JOBBER_CLIENT_SECRET — already present in Railway env vars, no new vars needed.
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const { pool } = require('../../db');
const { syncSingleClient } = require('../../crm/pipelineSync');
const { logError } = require('../../middleware/errorLogger');
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { jobberShouldRetry, resendShouldRetry } = require('../../utils/retryHelpers');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// ── HMAC SIGNATURE VERIFICATION ───────────────────────────────────────────────
// Returns true if the request passes verification, false and sends 401 otherwise.
// TODO: confirm exact Jobber webhook signature header name before Marketplace submission
function verifyJobberWebhookSignature(req, res) {
  const signature = req.headers['x-jobber-hmac-sha256'];
  const secret    = process.env.JOBBER_CLIENT_SECRET;

  if (!secret) {
    console.error('[jobber-webhook] JOBBER_CLIENT_SECRET not set — cannot verify signature');
    res.status(401).json({ error: 'Webhook secret not configured' });
    return false;
  }
  if (!signature) {
    console.warn('[jobber-webhook] Missing x-jobber-hmac-sha256 header — rejecting request');
    res.status(401).json({ error: 'Missing signature' });
    return false;
  }

  const expectedSig = crypto.createHmac('sha256', secret).update(req.body).digest('base64');
  if (signature !== expectedSig) {
    console.warn('[jobber-webhook] Signature mismatch — rejecting request');
    res.status(401).json({ error: 'Invalid signature' });
    return false;
  }

  return true;
}

// ── FULL CLIENT FETCH ─────────────────────────────────────────────────────────
// Fetches complete client data from Jobber by ID, including quotes/jobs/invoices
// needed for accurate pipeline status classification. Called from webhook handlers
// so classifyPipelineStatus gets full data rather than the sparse webhook payload.
async function fetchFullClient(clientId, token) {
  const response = await retryWithBackoff(
    () => axios.post(
      'https://api.getjobber.com/api/graphql',
      {
        query: `query GetClient($id: EncodedId!) {
          client(id: $id) {
            id firstName lastName createdAt
            customFields { ... on CustomFieldText { label valueText } }
            phones { number description }
            emails { address description }
            quotes(first: 10) { nodes { id quoteStatus } }
            jobs(first: 10) {
              nodes {
                id jobStatus
                invoices(first: 5) { nodes { invoiceStatus } }
              }
            }
          }
        }`,
        variables: { id: clientId },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
        },
      }
    ),
    { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
  );

  if (!response.data?.data?.client) {
    throw new Error(`fetchFullClient: no client returned for id ${clientId}`);
  }
  return response.data.data.client;
}

// POST /webhooks/jobber/disconnect
// Called by Jobber when a contractor removes Rooster Booster from their Jobber account.
// Jobber expects a 200 response or it will retry — we always return 200, even on DB failure.
router.post('/jobber/disconnect', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  const payload = JSON.parse(req.body.toString());
  // ── CONTRACTOR IDENTIFICATION ─────────────────────────────────────────────
  // Jobber may include contractor context in query params or body.
  // TODO: implement multi-contractor lookup here when FORA scales beyond one contractor
  const contractorId =
    req.query.contractorId ||
    payload?.contractor_id ||
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
    await logError({ req, error: err });
    console.error('[jobber-webhook] DB cleanup failed:', err.message);
  }

  res.status(200).json({ received: true });
});

// POST /webhooks/jobber/client-create
// Jobber fires this when a new client profile is created.
// Responds 200 immediately — sync runs async to stay within Jobber's response window.
router.post('/jobber/client-create', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  const payload = JSON.parse(req.body.toString());
  // Respond 200 immediately — Jobber requires a fast response
  res.status(200).json({ received: true });

  // Async sync — never blocks the webhook response
  // MVP: webhook payload may not include full nested quotes/jobs/invoices data.
  // If payload is incomplete, classifyPipelineStatus returns 'lead' as default.
  // The 30-minute incremental sync will correct the status. This is acceptable for MVP.
  // TODO: implement multi-contractor lookup here when FORA scales beyond one contractor
  const contractorId = req.query.contractorId || payload?.contractor_id || 'accent-roofing';
  const client       = payload?.data?.client || payload;

  (async () => {
    try {
      const settingsResult = await pool.query(
        'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const referralStartDate = settingsResult.rows[0]?.referral_start_date
        ? new Date(settingsResult.rows[0].referral_start_date)
        : null;

      // Fetch fresh token for the Jobber API call
      const tokenResult = await pool.query(
        'SELECT access_token FROM tokens WHERE contractor_id = $1',
        [contractorId]
      );
      const token = tokenResult.rows[0]?.access_token;

      // Fetch full client data including quotes/jobs/invoices for accurate status classification
      const rawClientId = client?.id;
      if (!rawClientId) throw new Error('client-create webhook: missing client id in payload');

      const fullClient = token
        ? await fetchFullClient(rawClientId, token).catch(err => {
            console.warn(`[jobber-webhook] fetchFullClient failed, using raw payload: ${err.message}`);
            return client;
          })
        : client;

      await syncSingleClient(contractorId, fullClient, referralStartDate);
      console.log(`[jobber-webhook] client-create sync complete for client: ${rawClientId}`);
    } catch (err) {
      await logError({ req, error: err });
      console.error('[jobber-webhook] client-create sync failed:', err.message);
    }
  })();
});

// POST /webhooks/jobber/client-update
// Jobber fires this when a client profile is updated (custom fields, job status, etc).
// Responds 200 immediately — sync runs async.
router.post('/jobber/client-update', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  const payload = JSON.parse(req.body.toString());
  // Respond 200 immediately
  res.status(200).json({ received: true });

  // Async sync — never blocks the webhook response
  // MVP: webhook payload may not include full nested quotes/jobs/invoices data.
  // If payload is incomplete, classifyPipelineStatus returns 'lead' as default.
  // The 30-minute incremental sync will correct the status. This is acceptable for MVP.
  // TODO: implement multi-contractor lookup here when FORA scales beyond one contractor
  const contractorId = req.query.contractorId || payload?.contractor_id || 'accent-roofing';
  const client       = payload?.data?.client || payload;

  (async () => {
    try {
      const settingsResult = await pool.query(
        'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const referralStartDate = settingsResult.rows[0]?.referral_start_date
        ? new Date(settingsResult.rows[0].referral_start_date)
        : null;

      // Fetch fresh token for the Jobber API call
      const tokenResult = await pool.query(
        'SELECT access_token FROM tokens WHERE contractor_id = $1',
        [contractorId]
      );
      const token = tokenResult.rows[0]?.access_token;

      // Fetch full client data including quotes/jobs/invoices for accurate status classification
      const rawClientId = client?.id;
      if (!rawClientId) throw new Error('client-update webhook: missing client id in payload');

      const fullClient = token
        ? await fetchFullClient(rawClientId, token).catch(err => {
            console.warn(`[jobber-webhook] fetchFullClient failed, using raw payload: ${err.message}`);
            return client;
          })
        : client;

      await syncSingleClient(contractorId, fullClient, referralStartDate);
      console.log(`[jobber-webhook] client-update sync complete for client: ${rawClientId}`);
    } catch (err) {
      await logError({ req, error: err });
      console.error('[jobber-webhook] client-update sync failed:', err.message);
    }
  })();
});

// POST /webhooks/jobber/invoice-paid
// Fires when a Jobber invoice is marked paid. Checks if experience flow is enabled,
// then either creates an in-app prompt (for matched users) or sends an invite email.
router.post('/jobber/invoice-paid', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  res.status(200).json({ received: true });

  (async () => {
    try {
      const payload = JSON.parse(req.body.toString());
      const contractorId = req.query.contractorId || payload?.contractor_id || 'accent-roofing';

      // STEP 2 — Feature flag check — must be first
      const flagResult = await pool.query(
        'SELECT experience_flow_enabled FROM engagement_settings WHERE contractor_id = $1',
        [contractorId]
      );
      if (!flagResult.rows[0] || !flagResult.rows[0].experience_flow_enabled) {
        console.log('[invoice-paid] experience flow disabled for contractor:', contractorId);
        return;
      }

      // STEP 3 — Extract client ID from payload
      const clientId = payload?.data?.invoice?.client?.id || payload?.data?.client?.id;
      if (!clientId) {
        console.warn('[invoice-paid] could not extract client id from payload');
        return;
      }

      // STEP 4 — Fetch token and full client
      const tokenResult = await pool.query(
        'SELECT access_token FROM tokens WHERE contractor_id = $1',
        [contractorId]
      );
      const token = tokenResult.rows[0]?.access_token;
      if (!token) {
        console.warn('[invoice-paid] no access token found');
        return;
      }
      const fullClient = await fetchFullClient(clientId, token);
      const clientName = (`${fullClient.firstName || ''} ${fullClient.lastName || ''}`).trim();
      const clientEmail = fullClient.emails?.[0]?.address || null;
      const clientPhone = fullClient.phones?.[0]?.number || null;

      // STEP 5 — Match against app users (name → email → phone)
      let matchedUser = null;
      const nameResult = await pool.query(
        'SELECT id FROM users WHERE LOWER(full_name) = LOWER($1) LIMIT 1',
        [clientName]
      );
      matchedUser = nameResult.rows[0] || null;
      if (!matchedUser && clientEmail) {
        const emailResult = await pool.query(
          'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
          [clientEmail]
        );
        matchedUser = emailResult.rows[0] || null;
      }
      if (!matchedUser && clientPhone) {
        const phoneResult = await pool.query(
          "SELECT id FROM users WHERE REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = REGEXP_REPLACE($1, '[^0-9]', '', 'g') LIMIT 1",
          [clientPhone]
        );
        matchedUser = phoneResult.rows[0] || null;
      }

      // STEP 6 — 30-day cooldown check (only if matched)
      if (matchedUser) {
        const cooldownResult = await pool.query(
          `SELECT id FROM experience_prompts
           WHERE user_id = $1 AND contractor_id = $2
             AND triggered_at > NOW() - INTERVAL '30 days'
           LIMIT 1`,
          [matchedUser.id, contractorId]
        );
        if (cooldownResult.rows.length > 0) {
          console.log('[invoice-paid] skipping — within 30-day cooldown for user:', matchedUser.id);
          return;
        }
      }

      if (matchedUser) {
        // STEP 7A — App user path
        await pool.query(
          `INSERT INTO experience_prompts (user_id, contractor_id, jobber_invoice_id, response_type)
           VALUES ($1, $2, $3, 'pending')`,
          [matchedUser.id, contractorId, fullClient.id]
        );
        console.log('[invoice-paid] experience prompt created for user:', matchedUser.id);
        // PUSH NOTIFICATION STUB — not built yet (requires App Store/Play Store registration)
        // TODO: fire push notification to user matchedUser.id when push infrastructure is ready
        // Message: "Thanks for working with us! We'd love your feedback — open the app to share."
      } else {
        // STEP 7B — Non-app-user path
        if (!clientEmail) {
          console.log('[invoice-paid] no app user match and no email — skipping');
          return;
        }
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await pool.query(
          `INSERT INTO experience_invite_tokens
             (token, contractor_id, jobber_client_name, jobber_client_email, jobber_client_phone, jobber_invoice_id, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [inviteToken, contractorId, clientName, clientEmail, clientPhone, fullClient.id, expiresAt]
        );

        const brandResult = await pool.query(
          'SELECT app_display_name, email_sender_name, email_footer_text FROM contractor_settings WHERE contractor_id = $1',
          [contractorId]
        );
        const brandRow = brandResult.rows[0] || {};
        const appDisplayName = brandRow.app_display_name || 'Rooster Booster';
        const emailSenderName = brandRow.email_sender_name || 'Accent Roofing Service';
        const emailFooterText = brandRow.email_footer_text || 'Accent Roofing Service · Powered by Rooster Booster';

        const firstName = clientName.split(' ')[0] || clientName;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const ctaUrl = `${frontendUrl}?exp=${inviteToken}`;

        await retryWithBackoff(
          () => resend.emails.send({
            from: `${emailSenderName} <noreply@roofmiles.com>`,
            to: clientEmail,
            subject: `Thank you for choosing us, ${firstName}!`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;">
                <p style="font-size:16px;color:#1a1a1a;margin:0 0 16px;">Hi ${firstName},</p>
                <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 28px;">
                  Thank you for trusting us with your project. We'd love to hear how it went — and as a bonus,
                  you can join our rewards app to earn cash for referring friends and neighbors.
                </p>
                <a href="${ctaUrl}"
                   style="display:inline-block;background:#012854;color:#fff;text-decoration:none;
                          border-radius:10px;padding:14px 28px;font-size:15px;font-weight:600;">
                  Share Your Experience
                </a>
                <p style="font-size:12px;color:#999;margin:32px 0 0;">${emailFooterText}</p>
              </div>
            `,
          }),
          { retries: 2, initialDelayMs: 500, shouldRetry: resendShouldRetry }
        );

        console.log('[invoice-paid] invite token created, email sent to:', clientEmail);
      }

      // STEP 8 — Activity log (own try/catch — must not block main flow)
      try {
        const detail = matchedUser
          ? `experience prompt created for user ${matchedUser.id} (${clientName})`
          : `experience invite email sent to ${clientEmail} (${clientName})`;
        await pool.query(
          `INSERT INTO activity_log (event_type, detail) VALUES ($1, $2)`,
          ['invoice_paid_experience_trigger', detail]
        );
      } catch (logErr) {
        console.error('[invoice-paid] activity log failed:', logErr.message);
      }

    } catch (err) {
      await logError({ req, error: err });
      console.error('[invoice-paid]', err.message);
    }
  })();
});

module.exports = router;
