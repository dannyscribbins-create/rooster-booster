// Jobber webhook handlers
// HMAC verification uses process.env.JOBBER_CLIENT_SECRET — already present in Railway env vars, no new vars needed.
function escapeHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDollars(n) {
  return parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

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
const { evaluateReferral } = require('../../referralRules');
const { isEmailSuppressed } = require('../../utils/emailSuppression');
const { applyTag } = require('../../utils/tags');

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

// ── INVOICE + JOBS FETCH (Referral Rules Engine) ──────────────────────────────
// Fetches a single invoice with full job data, custom fields, and invoice amounts.
// Used exclusively by the referral rules engine inside the invoice-paid handler.
// fetchFullClient() is intentionally NOT modified — this is a separate fetch.
//
// GraphQL field names verified via live Jobber GraphQL explorer on 2026-04-30:
//   - amounts.total = whole dollars (NOT cents). 3595 = $3,595. Do NOT divide by 100.
//   - waitingForFinancedPayment = boolean — defer processing if true
//   - Job Type lives at label === "Job Type" → valueDropdown (CustomFieldDropdown)
//   - archivedJobs must be fetched alongside jobs — archived jobs still carry job type
async function fetchInvoiceWithJobs(invoiceId, token) {
  const response = await retryWithBackoff(
    () => axios.post(
      'https://api.getjobber.com/api/graphql',
      {
        query: `query GetInvoiceWithJobs($id: EncodedId!) {
          invoice(id: $id) {
            id
            invoiceNumber
            invoiceStatus
            issuedDate
            waitingForFinancedPayment
            amounts { total }
            client { id name }
            jobs(first: 10) {
              nodes {
                id
                customFields {
                  ... on CustomFieldText { label valueText }
                  ... on CustomFieldDropdown { label valueDropdown }
                }
              }
            }
            archivedJobs(first: 10) {
              nodes {
                id
                customFields {
                  ... on CustomFieldText { label valueText }
                  ... on CustomFieldDropdown { label valueDropdown }
                }
              }
            }
          }
        }`,
        variables: { id: invoiceId },
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

  if (!response.data?.data?.invoice) {
    throw new Error(`fetchInvoiceWithJobs: no invoice returned for id ${invoiceId}`);
  }
  return response.data.data.invoice;
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
// Fires when a Jobber invoice is marked paid.
// Experience flow (in-app prompts / invite emails) runs only if experience_flow_enabled.
// Referral rules engine runs unconditionally — independent of experience flow.
router.post('/jobber/invoice-paid', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  res.status(200).json({ received: true });

  (async () => {
    try {
      const payload = JSON.parse(req.body.toString());
      const contractorId = req.query.contractorId || payload?.contractor_id || 'accent-roofing';

      // (a) Cheap early exit — skip non-paid invoice updates before any DB or API calls.
      // Jobber sends INVOICE_UPDATE for all status changes; only 'paid' is actionable here.
      const rawInvoiceStatus = payload?.data?.invoice?.invoiceStatus;
      if (rawInvoiceStatus !== undefined && rawInvoiceStatus !== 'paid') {
        console.log(`[invoice-paid] raw invoiceStatus is '${rawInvoiceStatus}' — skipping`);
        return;
      }

      // STEP 2 — Feature flag check (experience flow only)
      // Does NOT exit — referral engine runs unconditionally regardless of this flag.
      const flagResult = await pool.query(
        'SELECT experience_flow_enabled FROM engagement_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const experienceFlowEnabled = !!(flagResult.rows[0]?.experience_flow_enabled);
      if (!experienceFlowEnabled) {
        console.log('[invoice-paid] experience flow disabled for contractor:', contractorId);
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

      // Extract "Referred by" custom field from the full client record
      const referredByField = (fullClient.customFields || []).find(
        f => f.label && f.label.toLowerCase() === 'referred by'
      );
      const referredBy = referredByField?.valueText?.trim() || null;

      // ── REFERRAL RULES ENGINE SETUP ───────────────────────────────────────────────
      // Fetch invoice + job data needed for referral classification.
      // Separate from fetchFullClient() — fetchFullClient() provides client contact data
      // for experience flow. fetchInvoiceWithJobs() provides invoice amounts and job type
      // custom fields for payout calculation.
      const invoiceId = payload?.data?.invoice?.id;
      let invoiceWithJobs = null;
      if (invoiceId && referredBy) {
        try {
          invoiceWithJobs = await fetchInvoiceWithJobs(invoiceId, token);
        } catch (err) {
          await logError({ req, error: err, source: 'POST /webhooks/jobber/invoice-paid — fetchInvoiceWithJobs' });
          console.warn(`[invoice-paid] fetchInvoiceWithJobs failed for invoice ${invoiceId}:`, err.message);
          // Non-fatal — referral engine will be skipped, experience flow continues
        }
      }

      // (b) Second guard — invoice fully fetched; bail if status still isn't 'paid'.
      // Fires when invoiceStatus was absent from the raw payload so guard (a) was a no-op,
      // but the Jobber API response reveals the invoice is not yet paid.
      if (invoiceWithJobs && invoiceWithJobs.invoiceStatus !== 'paid') {
        console.log(`[invoice-paid] fetched invoice ${invoiceId} has status '${invoiceWithJobs.invoiceStatus}' — skipping`);
        return;
      }

      // ── EXPERIENCE FLOW (gated by feature flag) ────────────────────────────────
      if (experienceFlowEnabled) {
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
        // Uses flag instead of early return so STEP 9 (referral engine) always executes
        let experienceFlowBlocked = false;
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
            experienceFlowBlocked = true;
          }
        }

        if (!experienceFlowBlocked) {
          let experienceActionTaken = false;

          if (matchedUser) {
            // STEP 7A — App user path
            // Suppress immediate prompt if the user's jobber_client_id matches this client.
            // The T+24h post-job cron will create the experience_prompt after job completion.
            const userLinkResult = await pool.query(
              'SELECT jobber_client_id FROM users WHERE id = $1',
              [matchedUser.id]
            );
            const userJobberClientId = userLinkResult.rows[0]?.jobber_client_id;
            const isLinkedClient = userJobberClientId && userJobberClientId === fullClient.id;

            if (!isLinkedClient) {
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
              console.log('[invoice-paid] user', matchedUser.id, 'is a linked client — T+24h cron will handle experience prompt');
            }
            experienceActionTaken = true;
          } else if (clientEmail) {
            // STEP 7B — Non-app-user path (has email)
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
            experienceActionTaken = true;
          } else {
            console.log('[invoice-paid] no app user match and no email — skipping experience flow');
          }

          // STEP 8 — Activity log (own try/catch — must not block main flow)
          if (experienceActionTaken) {
            try {
              const detail = matchedUser
                ? `experience prompt created for user ${matchedUser.id} (${clientName})`
                : `experience invite email sent to ${clientEmail} (${clientName})`;
              await pool.query(
                `INSERT INTO activity_log (event_type, detail) VALUES ($1, $2)`,
                ['invoice_paid_experience_trigger', detail]
              );
            } catch (logErr) {
              await logError({ req, error: logErr, source: 'POST /webhooks/jobber/invoice-paid — activity_log insert' });
              console.error('[invoice-paid] activity log failed:', logErr.message);
            }
          }
        }
      }

      // ── STEP 9 — REFERRAL RULES ENGINE ───────────────────────────────────────
      // Runs unconditionally — independent of experience flow flag and result.
      // Only fires if: client has a referred_by value AND invoice data was fetched.
      if (referredBy && invoiceWithJobs) {
        try {
          const result = await evaluateReferral(contractorId, invoiceWithJobs, referredBy);

          if (result.qualified) {
            // Count prior conversions before insert — needed for #13 first-milestone detection
            const priorCountResult = await pool.query(
              `SELECT COUNT(*) AS cnt FROM referral_conversions WHERE user_id=$1`,
              [result.referrerId]
            );
            const isFirstConversion = parseInt(priorCountResult.rows[0]?.cnt || '0') === 0;

            // Write conversion record — UNIQUE constraint is the DB-level safety net
            // RETURNING id lets us detect whether a new row was inserted vs duplicate skipped
            const conversionInsert = await pool.query(
              `INSERT INTO referral_conversions
                 (user_id, contractor_id, jobber_client_id, converted_at, bonus_amount)
               VALUES ($1, $2, $3, NOW(), $4)
               ON CONFLICT (user_id, jobber_client_id) DO NOTHING
               RETURNING id`,
              [result.referrerId, contractorId, result.jobberClientId, result.bonusAmount]
            );

            // Update referrer's paid_count cache
            await pool.query(
              `UPDATE users SET paid_count = paid_count + 1, paid_count_updated_at = NOW()
               WHERE id = $1`,
              [result.referrerId]
            );

            // Non-blocking Active Referrer tag write
            if (conversionInsert.rowCount > 0) {
              ;(async () => {
                try {
                  const referrerEmailRes = await pool.query(
                    `SELECT email FROM users WHERE id = $1 LIMIT 1`,
                    [result.referrerId]
                  );
                  if (referrerEmailRes.rows.length > 0) {
                    const refEmail = referrerEmailRes.rows[0].email;
                    const contactRes = await pool.query(
                      `SELECT id FROM contacts WHERE contractor_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
                      [contractorId, refEmail]
                    );
                    if (contactRes.rows.length > 0) {
                      await applyTag(pool, contactRes.rows[0].id, contractorId, 'Active Referrer', 'system');
                    }
                  }
                } catch (tagErr) {
                  await logError({ req, error: tagErr, source: 'POST /webhooks/jobber/invoice-paid — Active Referrer tag' });
                }
              })();
            }

            // Activity log for qualified conversion
            await pool.query(
              `INSERT INTO activity_log (event_type, detail)
               VALUES ($1, $2)`,
              [
                'referral_conversion',
                `Referral bonus $${result.bonusAmount} — schedule: ${result.scheduleName} — referrer user_id: ${result.referrerId} — client: ${clientName}`,
              ]
            );

            console.log(
              `[invoice-paid] Referral conversion recorded — user ${result.referrerId}, ` +
              `$${result.bonusAmount}, schedule: ${result.scheduleName}, client: ${clientName}`
            );

            // ── #4 BONUS EARNED EMAIL ─────────────────────────────────────────────
            // Only fires when a NEW conversion row was inserted (not on duplicates).
            if (conversionInsert.rowCount > 0) {
              try {
                const referrerLookup = await pool.query(
                  'SELECT full_name, email FROM users WHERE id=$1',
                  [result.referrerId]
                );
                const referrerRow = referrerLookup.rows[0];
                if (referrerRow?.email) {
                  const csLookup = await pool.query(
                    `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id=$1 LIMIT 1`,
                    [contractorId]
                  );
                  const cs = csLookup.rows[0] || {};
                  const fromName = escapeHtml(cs.email_sender_name || cs.company_name || 'RoofMiles');
                  const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
                  const firstName = escapeHtml((referrerRow.full_name || '').split(' ')[0] || referrerRow.full_name);
                  const safeClientName = escapeHtml(clientName);
                  const formattedAmount = formatDollars(result.bonusAmount);

                  const suppressed4 = await isEmailSuppressed(contractorId, referrerRow.email, 'bonus_earned');
                  if (!suppressed4) await retryWithBackoff(
                    () => resend.emails.send({
                      from: `${fromName} <noreply@roofmiles.com>`,
                      to: referrerRow.email,
                      subject: `You just earned $${formattedAmount}`,
                      html: `
                        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                          <h2 style="color:#012854;margin:0 0 12px;">Your reward is ready</h2>
                          <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, ${safeClientName}'s job is complete and your $${formattedAmount} reward has been added to your balance. Cash out anytime directly from the app.</p>
                          <div style="text-align:center;margin-bottom:24px;">
                            <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Cash Out Now</a>
                          </div>
                        </div>
                      `,
                    }),
                    { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
                  );
                }
              } catch (bonusEmailErr) {
                await logError({ req, error: bonusEmailErr, source: 'POST /webhooks/jobber/invoice-paid — #4 bonus email' });
              }
            }

            // ── #13 FIRST REWARD MILESTONE ──────────────────────────────────────────
            // Fires alongside #4 only on the referrer's very first conversion ever.
            if (conversionInsert.rowCount > 0 && isFirstConversion) {
              try {
                const referrerLookup13 = await pool.query(
                  'SELECT full_name, email FROM users WHERE id=$1',
                  [result.referrerId]
                );
                const referrerRow13 = referrerLookup13.rows[0];
                if (referrerRow13?.email) {
                  const csLookup13 = await pool.query(
                    `SELECT email_sender_name, company_name FROM contractor_settings WHERE contractor_id=$1 LIMIT 1`,
                    [contractorId]
                  );
                  const cs13 = csLookup13.rows[0] || {};
                  const fromName13 = escapeHtml(cs13.email_sender_name || cs13.company_name || 'RoofMiles');
                  const frontendUrl13 = process.env.FRONTEND_URL || 'https://roofmiles.com';
                  const firstName13 = escapeHtml((referrerRow13.full_name || '').split(' ')[0] || referrerRow13.full_name);
                  const suppressed13 = await isEmailSuppressed(contractorId, referrerRow13.email, 'first_reward_milestone');
                  if (!suppressed13) await retryWithBackoff(
                    () => resend.emails.send({
                      from: `${fromName13} <noreply@roofmiles.com>`,
                      to: referrerRow13.email,
                      subject: `You just earned your first reward`,
                      html: `
                        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                          <h2 style="color:#012854;margin:0 0 12px;">First one in the books</h2>
                          <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName13}, your first referral reward just posted to your balance. This is just the beginning — every referral you send is another opportunity to earn. Cash out anytime.</p>
                          <div style="text-align:center;margin-bottom:24px;">
                            <a href="${frontendUrl13}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Cash Out Now</a>
                          </div>
                        </div>
                      `,
                    }),
                    { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
                  );
                }
              } catch (milestone13Err) {
                await logError({ req, error: milestone13Err, source: 'POST /webhooks/jobber/invoice-paid — #13 first milestone' });
              }
            }
          } else {
            // Not qualified — log reason and exit cleanly. No action needed.
            console.log(
              `[invoice-paid] Referral not qualified — reason: ${result.reason}, ` +
              `client: ${clientName}, referred_by: "${referredBy}"`
            );
          }
        } catch (err) {
          // Referral engine failure must never affect experience flow or crash the handler
          console.error('[invoice-paid] Referral rules engine error:', err.message);
          await logError({ req, error: err });
        }
      }

    } catch (err) {
      await logError({ req, error: err });
      console.error('[invoice-paid]', err.message);
    }
  })();
});

// POST /webhooks/jobber/job-update
// Fires when a Jobber job is updated. Used to detect job completion and mark
// pipeline_cache.job_completed_at so the T+24h post-job sequence cron can trigger.
// Requires JOB_UPDATE webhook subscription in Jobber developer settings.
router.post('/jobber/job-update', async (req, res) => {
  if (!verifyJobberWebhookSignature(req, res)) return;

  res.status(200).json({ received: true });

  (async () => {
    try {
      const payload = JSON.parse(req.body.toString());
      const contractorId = req.query.contractorId || payload?.contractor_id || 'accent-roofing';

      // Feature flag check — this handler exists solely to feed the T+24h experience flow.
      // Unlike invoice-paid, there is no unconditional second engine here, so disabled = early exit.
      const flagResult = await pool.query(
        'SELECT experience_flow_enabled FROM engagement_settings WHERE contractor_id = $1',
        [contractorId]
      );
      if (!flagResult.rows[0]?.experience_flow_enabled) {
        console.log('[job-update] experience flow disabled for contractor:', contractorId);
        return;
      }

      const jobId   = payload?.data?.job?.id;
      const clientId = payload?.data?.job?.client?.id;
      if (!jobId || !clientId) {
        console.log('[job-update] missing job id or client id in payload — skipping');
        return;
      }

      // Fetch token
      const tokenResult = await pool.query(
        'SELECT access_token FROM tokens WHERE contractor_id = $1',
        [contractorId]
      );
      const token = tokenResult.rows[0]?.access_token;
      if (!token) {
        console.warn('[job-update] no access token found — skipping');
        return;
      }

      // Fetch all jobs for this client from Jobber GraphQL to get accurate status + total
      const jobsResponse = await retryWithBackoff(
        () => axios.post(
          'https://api.getjobber.com/api/graphql',
          {
            query: `query GetClientJobs($id: EncodedId!) {
              client(id: $id) {
                jobs(first: 20) {
                  nodes { id jobStatus total }
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

      const allJobs = jobsResponse.data?.data?.client?.jobs?.nodes || [];

      // Find the current job among the fetched set
      const currentJob = allJobs.find(j => j.id === jobId);
      if (!currentJob) {
        console.log(`[job-update] job ${jobId} not found in client jobs response — skipping`);
        return;
      }

      // Only process completed jobs with a positive dollar value
      const jobStatus = (currentJob.jobStatus || '').toUpperCase();
      const jobTotal  = parseFloat(currentJob.total) || 0;
      if (jobStatus !== 'COMPLETED' || jobTotal <= 0) {
        console.log(`[job-update] job ${jobId} status=${jobStatus} total=${jobTotal} — skipping`);
        return;
      }

      // Only trigger if this is the highest-value job (or tied for highest) among dollar-value jobs.
      // If a larger completed job exists, that one was (or will be) the trigger.
      const dollarJobs = allJobs.filter(j => (parseFloat(j.total) || 0) > 0);
      const maxTotal   = Math.max(...dollarJobs.map(j => parseFloat(j.total) || 0));
      if (jobTotal < maxTotal) {
        console.log(`[job-update] job ${jobId} total ${jobTotal} is not the max (${maxTotal}) — skipping`);
        return;
      }

      // 60-day cooldown: skip if job_completed_at was already set within the last 60 days
      const cooldownResult = await pool.query(
        `SELECT id FROM pipeline_cache
         WHERE contractor_id = $1 AND jobber_client_id = $2
           AND job_completed_at > NOW() - INTERVAL '60 days'
         LIMIT 1`,
        [contractorId, clientId]
      );
      if (cooldownResult.rows.length > 0) {
        console.log(`[job-update] client ${clientId} already has job_completed_at within 60 days — skipping`);
        return;
      }

      // UPSERT pipeline_cache — only write job_completed_at if it is currently NULL
      await pool.query(
        `INSERT INTO pipeline_cache (contractor_id, jobber_client_id, job_completed_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (contractor_id, jobber_client_id)
         DO UPDATE SET job_completed_at = CASE
           WHEN pipeline_cache.job_completed_at IS NULL THEN NOW()
           ELSE pipeline_cache.job_completed_at
         END`,
        [contractorId, clientId]
      );

      console.log(`[job-update] job_completed_at set for client ${clientId} (contractor: ${contractorId})`);
    } catch (err) {
      await logError({ req, error: err, source: 'POST /webhooks/jobber/job-update' });
      console.error('[job-update]', err.message);
    }
  })();
});

module.exports = router;
