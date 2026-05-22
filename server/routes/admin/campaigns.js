const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { verifyAdminSession } = require('../../middleware/auth');
const axios = require('axios');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { logError } = require('../../middleware/errorLogger');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { resendShouldRetry, jobberShouldRetry, anthropicShouldRetry } = require('../../utils/retryHelpers');
const { refreshTokenIfNeeded } = require('../../crm/jobber');
const multer = require('multer');
const Papa = require('papaparse');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const { deriveOptOutType } = require('../../utils/adminHelpers');

// Lazy initializer — reads env vars at call time, not at module load, to avoid ERR_INVALID_URL on startup
let _mediaS3Client = null;
function getMediaS3Client() {
  if (!_mediaS3Client) {
    const endpoint = process.env.B2_ENDPOINT;
    if (!endpoint) throw new Error('B2_ENDPOINT is not set');
    _mediaS3Client = new S3Client({
      endpoint,
      credentials: {
        accessKeyId: process.env.B2_MEDIA_KEY_ID,
        secretAccessKey: process.env.B2_MEDIA_APPLICATION_KEY,
      },
      region: 'us-east-005',
      forcePathStyle: true,
    });
  }
  return _mediaS3Client;
}
function buildB2PublicUrl(b2Key) {
  const base = process.env.B2_PUBLIC_URL_BASE
    || `https://f005.backblazeb2.com/file/${process.env.B2_MEDIA_BUCKET_NAME}`;
  return `${base}/${b2Key}`;
}

// ── CAMPAIGN SEND HELPERS ─────────────────────────────────────────────────────

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const _campaignMessageTypeMission = {
  referral_program_invite: "Invite the recipient to join or participate in the referral program. Emphasize appreciation, trust, and the simplicity of referring someone. Make the recipient feel like a valued part of the business's network.",
  reengagement: "Reconnect with the recipient in a warm, low-pressure way. Remind them the business is still active, still available, and still values the relationship. Avoid guilt-based language.",
  seasonal_outreach: "Use the current season as a natural, timely reason to stay top of mind. Keep it helpful and relevant. Do not force a service appointment angle.",
  thank_you_invite: "Lead with genuine gratitude for the recipient's support, business, or trust. Then softly invite them to take the CTA action. Do not sound transactional.",
  write_my_own: "The contractor has written a draft message. Personalize it for this specific recipient using their first name and job type where it fits naturally. Lightly rewrite it for clarity, warmth, and quality while preserving the contractor's voice and intent.",
};

const _campaignCtaGoal = {
  join_app:      "Encourage the recipient to join, accept the invite, or get connected through the app. End with a sentence that leads naturally into a 'Join the App' button.",
  website:       "Encourage the recipient to visit the website to learn more, view services, or reconnect. End with a sentence that leads naturally into a 'Visit Our Website' button.",
  facebook:      "Encourage the recipient to follow or visit the business on Facebook for updates, project photos, tips, or community content. End with a sentence that leads naturally into a 'Visit Us on Facebook' button.",
  google_profile:"Encourage the recipient to view the Google profile, read reviews, or leave honest feedback. End with a sentence that leads naturally into a 'View Our Google Profile' button. Do not pressure for a 5-star review. Do not imply any incentive for leaving a review.",
};

function deriveCTAType(ctaUrl) {
  if (!ctaUrl) return 'website';
  const url = ctaUrl.toLowerCase();
  if (url.includes('rooster-booster') || url.includes('roofmiles')) return 'join_app';
  if (url.includes('facebook.com')) return 'facebook';
  if (url.includes('google')) return 'google_profile';
  return 'website';
}

function deriveCTALabel(ctaUrl) {
  if (!ctaUrl) return 'Visit Our Website';
  const url = ctaUrl.toLowerCase();
  if (url.includes('rooster-booster') || url.includes('roofmiles')) return 'Join the App';
  if (url.includes('facebook.com')) return 'Visit Us on Facebook';
  if (url.includes('google')) return 'View Our Google Profile';
  return 'Visit Our Website';
}

const _campaignToneInstructions = {
  friendly:     'Write in a warm, approachable, conversational tone. Feel like a neighbor talking to a neighbor.',
  professional: 'Write in a polished, respectful, business-appropriate tone. Confident but not stiff.',
  warm:         'Write with genuine emotional warmth. Lead with appreciation and care.',
  casual:       'Write in a relaxed, natural tone. Like a text from someone you know well.',
};

const _campaignBaseSystemPrompt = `You are an expert email marketing copywriter for a contractor-to-homeowner referral and relationship-building platform.

Your job is to write a short, personalized email message body for a single recipient based on the campaign mission and CTA goal provided.

Rules you must always follow:
- Never mention inspections, free estimates, roof checks, appointments, or "coming out to take a look" unless the contractor's own draft message specifically includes those ideas.
- Always include the business name naturally somewhere in the message.
- Always address the recipient by their first name.
- Reference the recipient's job type naturally and organically where it makes sense — do not force it or make it sound awkward.
- Do not invent specific rewards, dollar amounts, discount offers, or program details that were not provided.
- Do not use hype, urgency, or pressure language.
- Do not write markdown. No asterisks, no headers, no bullet points.
- Do not write multiple versions.
- Do not include a subject line.
- Do not include a CTA button or URL.
- Keep the message under 80 words and between 3 and 5 sentences.
- The final sentence should lead naturally into a CTA button without writing the button itself.

Tone: warm, trustworthy, relationship-focused, clear, and professional but human. Not cheesy. Not overly casual. Not corporate.`;

async function generatePersonalizedMessage(contact, campaignData, req) {
  try {
    const approvedMessage = (campaignData.approved_message || '').trim();

    if (approvedMessage) {
      const firstName = (contact.client_name || '').toString().trim().split(/\s+/)[0].slice(0, 50);
      const jobType = (contact.job_type || '').toString().trim().slice(0, 100);
      let serviceDate = '';
      if (contact.job_date) {
        const d = new Date(contact.job_date);
        if (!isNaN(d.getTime())) {
          serviceDate = `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
        }
      }

      const systemPrompt = `You are personalizing a pre-approved email message for a roofing company's outreach campaign.

Your job is to naturally weave in the recipient's personal details into the approved message below. Do NOT rewrite the message. Do NOT change the tone, structure, or intent. Only personalize it by incorporating the recipient's first name, job type (if available), and month and year of service (if available) where they fit naturally.

Return only the personalized message text. No subject line, no greeting label, no explanation. No markdown.`;

      const userPrompt = `Approved message:
"${approvedMessage}"

Recipient first name: ${firstName || 'not specified'}
Job type: ${jobType || 'not specified'}
Month and year of service: ${serviceDate || 'not available'}

Return the personalized message only.`;

      const text = await retryWithBackoff(async () => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 300,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (!response.ok) {
          const err = new Error(`Anthropic API error: ${response.status}`);
          err.status = response.status;
          throw err;
        }
        const data = await response.json();
        if (!data.content?.[0]?.text) throw new Error('Unexpected Anthropic response shape');
        return data.content[0].text.trim();
      }, { retries: 2, shouldRetry: anthropicShouldRetry });

      return text;
    }

    const tone = campaignData.selected_tone || 'friendly';
    const messageType = campaignData.message_preset || 'write_my_own';
    const contractorName = campaignData.contractor_name || 'the business';
    const ctaType = deriveCTAType(campaignData.cta_url);
    const name = (contact.client_name || '').toString().trim().slice(0, 100);
    const jobType = (contact.job_type || '').toString().trim().slice(0, 100);
    const customMessage = (campaignData.message_body || '').toString().trim().slice(0, 2000);

    const systemPrompt = _campaignBaseSystemPrompt + `\n\nTone instruction: ${_campaignToneInstructions[tone] || _campaignToneInstructions.friendly}`;
    const userPrompt = `Generate one email message body for the following recipient.

Recipient first name: ${name}
Recipient job type: ${jobType}
Business name: ${contractorName}

Campaign mission: ${_campaignMessageTypeMission[messageType] || 'Write a warm, relationship-focused message that feels personal and avoids generic contractor language.'}

CTA goal: ${_campaignCtaGoal[ctaType] || 'End with a sentence that leads naturally into the CTA button.'}

${messageType === 'write_my_own' && customMessage ? `The contractor has written this draft message. Use it as the foundation. Personalize it for this recipient, lightly rewrite for quality and warmth, and align the closing sentence to the CTA goal:\n\n"${customMessage}"` : ''}

Output: One email message body only. No subject line. No preview text. No button. No markdown. Under 80 words. 3 to 5 sentences.`;

    const text = await retryWithBackoff(async () => {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!response.ok) {
        const err = new Error(`Anthropic API error: ${response.status}`);
        err.status = response.status;
        throw err;
      }
      const data = await response.json();
      if (!data.content?.[0]?.text) throw new Error('Unexpected Anthropic response shape');
      return data.content[0].text.trim();
    }, { retries: 2, shouldRetry: anthropicShouldRetry });

    return text;
  } catch (err) {
    await logError({ req, error: err, source: 'generatePersonalizedMessage' });
    return campaignData.approved_message || campaignData.message_body;
  }
}

function buildEmailHtml(body, campaignData, token, contractorSettings = {}, unsubscribeUrl = null) {
  const cs = contractorSettings;
  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  const ctaHref = token && process.env.BACKEND_URL
    ? `${process.env.BACKEND_URL}/api/track/click/${token}`
    : campaignData.cta_url;
  const bodyEscaped = esc(body);

  const headerHtml = campaignData.email_header
    ? `<h1 style="font-family:${esc(cs.font_heading) || 'Georgia, serif'};font-size:28px;font-weight:700;color:#1a1a1a;margin:0 0 20px 0;">${esc(campaignData.email_header)}</h1>`
    : '';

  const imageAlt = esc(campaignData.name || 'Campaign image');
  const imageHtml = campaignData.image_url
    ? `<img src="${campaignData.image_url}" alt="${imageAlt}" style="display:block;max-width:100%;width:100%;border-radius:8px;margin:0 auto 24px auto;" />`
    : '';

  const bodyHtml = `<p style="font-family:${esc(cs.font_body) || 'Arial, sans-serif'};font-size:16px;line-height:1.8;color:#1a1a1a;white-space:pre-wrap;margin:0;">${bodyEscaped}</p>`;

  const ctaHtml = campaignData.cta_enabled && campaignData.cta_url
    ? `<div style="text-align:center;margin-top:32px;"><a href="${ctaHref}" style="display:inline-block;background:#CC0000;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">${deriveCTALabel(campaignData.cta_url)}</a></div>`
    : '';

  const dividerHtml = `<hr style="border:none;border-top:1px solid #eeeeee;margin:40px 0 24px;" />`;

  const logoHtml = cs.logo_url
    ? `<img src="${cs.logo_url}" alt="${esc(cs.company_name) || 'Company logo'}" style="display:block;max-height:48px;max-width:160px;margin:0 auto 8px;" />`
    : '';
  const poweredByHtml = `<p style="text-align:center;font-size:11px;color:#aaaaaa;margin:0 0 16px;">${esc(cs.company_name) || ''}${cs.company_name ? '<br/>' : ''}Powered by RoofMiles</p>`;

  const socialLinks = [
    { url: cs.social_facebook,  label: 'Facebook' },
    { url: cs.social_instagram, label: 'Instagram' },
    { url: cs.social_google,    label: 'Google' },
    { url: cs.social_website,   label: 'Website' },
  ].filter(s => s.url && s.url.trim() !== '');
  const socialHtml = socialLinks.length > 0
    ? `<p style="text-align:center;margin:0 0 16px;">${
        socialLinks.map(s =>
          `<a href="${s.url}" style="display:inline-block;margin:0 4px;font-size:11px;color:#555555;text-decoration:none;padding:3px 8px;border:1px solid #dddddd;border-radius:12px;">${s.label}</a>`
        ).join('')
      }</p>`
    : '';

  const contactLink = cs.company_email
    ? `<a href="mailto:${esc(cs.company_email)}" style="color:#555555;">${esc(cs.company_email)}</a>`
    : 'contact your service provider';
  const doNotReplyHtml = `<p style="font-size:12px;color:#777777;text-align:center;line-height:1.7;margin:0 0 16px;">Please do not reply to this email — replies cannot be received.<br/>For questions about your account or rewards: ${contactLink}<br/>For platform support: <a href="mailto:hello@roofmiles.com" style="color:#555555;">hello@roofmiles.com</a></p>`;

  const legalHtml = `<p style="text-align:center;font-size:11px;color:#aaaaaa;margin:0 0 12px;"><a href="https://roofmiles.com/terms" style="color:#aaaaaa;">Terms of Use</a> · <a href="https://roofmiles.com/privacy" style="color:#aaaaaa;">Privacy Policy</a></p>`;

  const unsubHtml = unsubscribeUrl
    ? `<p style="text-align:center;margin:8px 0 0 0;font-size:12px;color:#999999;font-family:Arial,sans-serif;"><a href="${unsubscribeUrl}" style="color:#999999;text-decoration:underline;">Unsubscribe or manage email preferences</a></p>`
    : `<p style="text-align:center;margin:8px 0 0 0;font-size:12px;color:#999999;font-family:Arial,sans-serif;">To unsubscribe, reply to this email with "UNSUBSCRIBE" in the subject line.</p>`;

  const addressParts = [cs.company_address, cs.company_city, cs.company_state, cs.company_zip]
    .filter(p => p && p.trim() !== '');
  const addressStr = addressParts.length > 0 ? esc(addressParts.join(', ')) : 'Address on file';
  const addressHtml = `<p style="font-size:11px;color:#aaaaaa;text-align:center;margin:0 0 12px;">${addressStr}</p>`;

  const copyrightHtml = `<p style="font-size:11px;color:#aaaaaa;text-align:center;margin:0 0 24px;">© ${new Date().getFullYear()} ${esc(cs.company_name) || 'RoofMiles'}. All rights reserved.</p>`;

  const pixelHtml = token && process.env.BACKEND_URL
    ? `<img src="${process.env.BACKEND_URL}/api/track/open/${token}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />`
    : '';

  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#ffffff;">
  ${headerHtml}
  ${imageHtml}
  ${bodyHtml}
  ${ctaHtml}
  ${dividerHtml}
  ${logoHtml}
  ${poweredByHtml}
  ${socialHtml}
  ${doNotReplyHtml}
  ${legalHtml}
  ${unsubHtml}
  ${addressHtml}
  ${copyrightHtml}
  ${pixelHtml}
</div>`;
}

async function sendEmailViaResend(contact, personalizedBody, campaignData, token, senderName = 'RoofMiles', contractorSettings = {}, unsubscribeUrl = null, req = null) {
  try {
    const subject = campaignData.subject_line || `A message from ${campaignData.contractor_name || 'us'}`;
    const html = buildEmailHtml(personalizedBody, campaignData, token, contractorSettings, unsubscribeUrl);
    const plainText = html.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();

    await retryWithBackoff(async () => {
      const payload = {
        to: contact.email,
        from: `${senderName} <noreply@roofmiles.com>`,
        subject,
        html,
        text: plainText,
      };
      await resend.emails.send(payload);
    }, { retries: 2, shouldRetry: resendShouldRetry });

    return { success: true, errorCode: null, errorMessage: null };
  } catch (err) {
    await logError({ req, error: err, source: 'sendEmailViaResend' });
    const errorCode   = err?.statusCode?.toString() || err?.response?.status?.toString() || null;
    const errorMessage = err?.message || 'Send failed';
    return { success: false, errorCode, errorMessage };
  }
}

async function executeBatchSend(campaignId, req) {
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';

  const campaignResult = await pool.query(
    `SELECT c.id, c.name, c.status, c.total_batches, c.current_batch, c.last_batch_sent_at,
            c.message_body, c.subject_line, c.cta_enabled, c.cta_url,
            c.ai_rapport_enabled, c.selected_tone, c.message_preset, c.contractor_id,
            c.approved_message, c.email_header, ci.public_url AS image_url,
            COALESCE(cs.email_sender_name, cs.company_name, 'RoofMiles') AS sender_name,
            cs.font_heading, cs.font_body, cs.company_name, cs.email_sender_name,
            cs.company_address, cs.company_city, cs.company_state, cs.company_zip,
            cs.company_email, cs.logo_url, cs.social_facebook, cs.social_instagram,
            cs.social_google, cs.social_website
     FROM campaigns c
     LEFT JOIN campaign_images ci ON ci.campaign_id = c.id
     LEFT JOIN contractor_settings cs ON cs.contractor_id = c.contractor_id
     WHERE c.id = $1 AND c.contractor_id = $2
     LIMIT 1`,
    [campaignId, contractorId]
  );
  if (campaignResult.rows.length === 0) throw new Error('Campaign not found');
  const campaign = campaignResult.rows[0];

  const batchNumber = campaign.current_batch;
  // MVP: contractor name hardcoded — replace with session lookup at multi-contractor scale
  const contractorName = 'Accent Roofing Service';
  const campaignData = { ...campaign, contractor_name: contractorName };
  const emailSubject = campaign.subject_line || `A message from ${contractorName || 'us'}`;
  const contractorSettings = {
    font_heading:      campaign.font_heading,
    font_body:         campaign.font_body,
    company_name:      campaign.company_name,
    email_sender_name: campaign.email_sender_name,
    company_address:   campaign.company_address,
    company_city:      campaign.company_city,
    company_state:     campaign.company_state,
    company_zip:       campaign.company_zip,
    company_email:     campaign.company_email,
    logo_url:          campaign.logo_url,
    social_facebook:   campaign.social_facebook,
    social_instagram:  campaign.social_instagram,
    social_google:     campaign.social_google,
    social_website:    campaign.social_website,
  };

  const contactsResult = await pool.query(
    `SELECT id, client_name, email, phone, job_type, job_date, client_jobber_id
     FROM campaign_contacts
     WHERE campaign_id = $1 AND contractor_id = $2
       AND batch_number = $3 AND selected = true AND opted_out = false`,
    [campaignId, contractorId, batchNumber]
  );
  const allContacts = contactsResult.rows;

  const hasEmail = allContacts.filter(c => c.email && c.email.trim());
  const noEmail  = allContacts.filter(c => !c.email || !c.email.trim());

  for (const c of noEmail) {
    await pool.query(
      `INSERT INTO campaign_send_log (campaign_id, batch_number, contact_id, contact_name, email, phone, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'skipped', NOW())`,
      [campaignId, batchNumber, c.id, c.client_name, c.email || null, c.phone || null]
    );
  }

  const tokenRows = await Promise.all(
    hasEmail.map(async (contact) => {
      const r = await pool.query(
        `INSERT INTO campaign_tracking_tokens
         (campaign_id, contractor_id, contact_email, contact_name, batch_number)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING token`,
        [campaignId, contractorId, contact.email, contact.client_name || null, batchNumber]
      );
      return { contact, token: r.rows[0].token };
    })
  );

  function replaceMessageTokens(body, contact, cs) {
    if (!body) return body;
    const firstName = (contact.client_name || '').split(' ')[0].trim() || '';
    const companyName = cs.company_name || '';
    let result = body;
    result = result.replace(/\[First Name\]/gi, firstName || 'there');
    result = result.replace(/\[Company\]/gi, companyName);
    return result;
  }

  function generateUnsubscribeToken() {
    return crypto.randomBytes(48).toString('hex');
  }

  async function isEmailSuppressed(cId, email, type = 'campaigns') {
    try {
      const result = await pool.query(
        `SELECT opt_out_campaigns, opt_out_sms, opt_out_all
         FROM email_opt_outs
         WHERE contractor_id = $1 AND email = $2`,
        [cId, email]
      );
      if (result.rows.length === 0) return false;
      const prefs = result.rows[0];
      if (prefs.opt_out_all) return true;
      if (type === 'campaigns' && prefs.opt_out_campaigns) return true;
      if (type === 'sms' && prefs.opt_out_sms) return true;
      return false;
    } catch (err) {
      await logError({ req, error: err, source: 'isEmailSuppressed' });
      return false; // fail open — never suppress on DB error
    }
  }

  let personalizedMessages = [];
  if (campaign.ai_rapport_enabled && process.env.ANTHROPIC_API_KEY) {
    const chunks = chunkArray(tokenRows, 50);
    for (let i = 0; i < chunks.length; i++) {
      const chunkMsgs = await Promise.all(
        chunks[i].map(({ contact: c }) => generatePersonalizedMessage(c, campaignData, req))
      );
      personalizedMessages.push(...chunkMsgs);
      if (i < chunks.length - 1) await sleep(150);
    }
  } else {
    personalizedMessages = tokenRows.map(({ contact }) => replaceMessageTokens(campaign.message_body, contact, contractorSettings));
  }

  const sendItems = [];
  const suppressedContacts = [];
  for (let idx = 0; idx < tokenRows.length; idx++) {
    const { contact, token: trackingToken } = tokenRows[idx];

    const suppressed = await isEmailSuppressed(contractorId, contact.email, 'campaigns');
    if (suppressed) {
      console.log(`[executeBatchSend] Suppressed: ${contact.email}`); // diagnostic log — intentional
      suppressedContacts.push(contact);
      continue;
    }

    let unsubscribeUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/email-preferences` : null;
    try {
      const unsubToken = generateUnsubscribeToken();
      const tokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO unsubscribe_tokens (token, contractor_id, email, campaign_id, batch_number, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (token) DO NOTHING`,
        [unsubToken, contractorId, contact.email, campaignId, batchNumber, tokenExpiresAt]
      );
      unsubscribeUrl = `${process.env.FRONTEND_URL}/email-preferences?token=${unsubToken}`;
    } catch (err) {
      await logError({ req, error: err });
      // unsubscribeUrl falls back to generic /email-preferences URL (CAN-SPAM fallback shown in footer)
    }

    sendItems.push({ contact, token: trackingToken, personalizedMessage: personalizedMessages[idx], unsubscribeUrl });
  }

  async function upsertContactRecord(email, name, status, jobberClientId) {
    try {
      const upsertRes = await pool.query(
        `INSERT INTO contacts (contractor_id, email, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (contractor_id, email) DO UPDATE SET
           updated_at = NOW(),
           name = COALESCE(EXCLUDED.name, contacts.name)
         RETURNING id`,
        [contractorId, email, name || null]
      );
      const contactId = upsertRes.rows[0].id;

      const appUserRes = await pool.query(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [email]
      );
      if (appUserRes.rows.length > 0) {
        await pool.query(
          `UPDATE contacts SET is_app_user = true WHERE id = $1`,
          [contactId]
        );
      }

      // Non-fatal: jobber_client_id is enrichment only — never block the email send.
      if (jobberClientId) {
        try {
          await pool.query(
            `UPDATE contacts
             SET jobber_client_id = $1
             WHERE id = $2
               AND jobber_client_id IS NULL`,
            [jobberClientId, contactId]
          );
        } catch (linkErr) {
          await logError({ req, error: linkErr, source: 'upsertContactRecord jobber_client_id link' });
        }
      }

      await pool.query(
        `INSERT INTO contact_send_history
           (contact_id, contractor_id, campaign_id, batch_number, channel, status, message_type, subject)
         VALUES ($1, $2, $3, $4, 'email', $5, 'campaign', $6)`,
        [contactId, contractorId, campaignId, batchNumber, status, emailSubject]
      );
    } catch (err) {
      await logError({ req, error: err, source: 'executeBatchSend contact upsert' });
    }
  }

  for (const c of suppressedContacts) {
    await pool.query(
      `INSERT INTO campaign_send_log (campaign_id, batch_number, contact_id, contact_name, email, phone, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'suppressed', NOW())`,
      [campaignId, batchNumber, c.id, c.client_name, c.email || null, c.phone || null]
    );
    await upsertContactRecord(c.email, c.client_name, 'suppressed', c.client_jobber_id || null);
  }

  const sendResults = [];
  const emailChunks = chunkArray(sendItems, 50);
  for (let i = 0; i < emailChunks.length; i++) {
    const chunk = emailChunks[i];
    const chunkResults = await Promise.all(
      chunk.map((item) =>
        sendEmailViaResend(item.contact, item.personalizedMessage, campaignData, item.token, campaign.sender_name, contractorSettings, item.unsubscribeUrl, req)
      )
    );
    for (let j = 0; j < chunk.length; j++) {
      sendResults.push({ contact: chunk[j].contact, ...chunkResults[j] });
    }
    if (i < emailChunks.length - 1) await sleep(150);
  }

  const successfulIds = [];
  for (const result of sendResults) {
    const status = result.success ? 'delivered' : 'failed';
    await pool.query(
      `INSERT INTO campaign_send_log (campaign_id, batch_number, contact_id, contact_name, email, phone, status, error_code, error_message, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [campaignId, batchNumber, result.contact.id, result.contact.client_name,
       result.contact.email, result.contact.phone || null,
       status, result.errorCode || null, result.errorMessage || null]
    );
    if (result.success) successfulIds.push(result.contact.id);
    await upsertContactRecord(result.contact.email, result.contact.client_name, result.success ? 'sent' : 'failed', result.contact.client_jobber_id || null);
  }

  if (successfulIds.length > 0) {
    await pool.query(
      `UPDATE campaign_contacts SET delivered = true WHERE id = ANY($1::int[])`,
      [successfulIds]
    );
  }

  const sent       = sendResults.filter(r => r.success).length;
  const failed     = sendResults.filter(r => !r.success).length;
  const skipped    = noEmail.length;
  const suppressed = suppressedContacts.length;

  await pool.query(
    `INSERT INTO campaign_batches (campaign_id, contractor_id, batch_number, sent_count, failed_count, skipped_count, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (campaign_id, batch_number) DO UPDATE SET
       sent_count    = EXCLUDED.sent_count,
       failed_count  = EXCLUDED.failed_count,
       skipped_count = EXCLUDED.skipped_count,
       sent_at       = EXCLUDED.sent_at`,
    [campaignId, contractorId, batchNumber, sent, failed, skipped]
  );

  await pool.query(
    `UPDATE campaigns
     SET current_batch = $1, last_batch_sent_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND contractor_id = $3`,
    [batchNumber + 1, campaignId, contractorId]
  );

  await pool.query(
    `INSERT INTO activity_log (event_type, detail) VALUES ($1, $2)`,
    ['campaign_batch_sent', JSON.stringify({ campaign_id: campaignId, batch_number: batchNumber, sent, failed, skipped, suppressed })]
  );

  return { sent, failed, skipped, suppressed, batch_number: batchNumber };
}

const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// ── PUBLIC: EMAIL TRACKING ────────────────────────────────────────────────────

router.get('/api/track/open/:token', async (req, res) => {
  res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' });
  try {
    const { token } = req.params;
    const tokenResult = await pool.query(
      `SELECT campaign_id, contractor_id, batch_number FROM campaign_tracking_tokens WHERE token = $1`,
      [token]
    );
    if (tokenResult.rows.length === 0) {
      return res.send(TRACKING_PIXEL);
    }
    const { campaign_id, contractor_id, batch_number } = tokenResult.rows[0];
    const existing = await pool.query(
      `SELECT 1 FROM campaign_events WHERE token = $1 AND event_type = 'open' LIMIT 1`,
      [token]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO campaign_events (token, campaign_id, contractor_id, batch_number, event_type, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'open', $5, $6)`,
        [token, campaign_id, contractor_id, batch_number, req.ip || null, req.headers['user-agent'] || null]
      );
      await pool.query(
        `UPDATE campaign_contacts SET opened = true
         WHERE campaign_id = $1 AND contractor_id = $2 AND email = (
           SELECT contact_email FROM campaign_tracking_tokens WHERE token = $3
         )`,
        [campaign_id, contractor_id, token]
      );
    }
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/track/open/:token' });
  }
  res.send(TRACKING_PIXEL);
});

router.get('/api/track/click/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const tokenResult = await pool.query(
      `SELECT t.campaign_id, t.contractor_id, t.batch_number, c.cta_url
       FROM campaign_tracking_tokens t
       JOIN campaigns c ON c.id = t.campaign_id
       WHERE t.token = $1`,
      [token]
    );
    if (tokenResult.rows.length === 0) {
      return res.redirect(process.env.FRONTEND_URL || '/');
    }
    const { campaign_id, contractor_id, batch_number, cta_url } = tokenResult.rows[0];
    const existing = await pool.query(
      `SELECT 1 FROM campaign_events WHERE token = $1 AND event_type = 'click' LIMIT 1`,
      [token]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO campaign_events (token, campaign_id, contractor_id, batch_number, event_type, cta_url, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'click', $5, $6, $7)`,
        [token, campaign_id, contractor_id, batch_number, cta_url || null,
         req.ip || null, req.headers['user-agent'] || null]
      );
      await pool.query(
        `UPDATE campaign_contacts SET clicked = true
         WHERE campaign_id = $1 AND contractor_id = $2 AND email = (
           SELECT contact_email FROM campaign_tracking_tokens WHERE token = $3
         )`,
        [campaign_id, contractor_id, token]
      );
    }
    return res.redirect(cta_url || process.env.FRONTEND_URL || '/');
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/track/click/:token' });
    return res.redirect(process.env.FRONTEND_URL || '/');
  }
});

// ── ADMIN: CAMPAIGNS ──────────────────────────────────────────────────────────

// MVP: Pro tier batch cap — 500 contacts per batch.
// TODO (FORA tiers): replace with DB lookup of contractor's plan batch cap.
// Growth = 200, Pro = 500. Change this one constant when tiers ship.
const CAMPAIGN_BATCH_CAP = 500;

router.post('/api/admin/campaigns', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { name, builder_path } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Campaign name is required' });
  const path = builder_path === 'csv' ? 'csv' : 'jobber';
  try {
    const result = await pool.query(
      `INSERT INTO campaigns (contractor_id, name, status, builder_path)
       VALUES ($1, $2, 'draft', $3)
       RETURNING id, name, status, builder_path, created_at`,
      ['accent-roofing', name.trim(), path]
    );
    res.json(result.rows[0]);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/admin/campaigns', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT id, name, status, total_contacts, created_at, updated_at
       FROM campaigns
       WHERE contractor_id = $1
       ORDER BY created_at DESC`,
      ['accent-roofing']
    );
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/admin/campaigns/field-values', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const settingsResult = await pool.query(
      'SELECT contractor_field_mappings FROM contractor_settings WHERE contractor_id = $1',
      ['accent-roofing']
    );
    const mappings = settingsResult.rows[0]?.contractor_field_mappings || {};

    let workCategoryValues = [];

    if (mappings.work_category) {
      const r = await pool.query(
        'SELECT options FROM contractor_jobber_fields WHERE contractor_id = $1 AND label = $2 LIMIT 1',
        ['accent-roofing', mappings.work_category]
      );
      if (r.rows.length > 0 && Array.isArray(r.rows[0].options)) {
        workCategoryValues = r.rows[0].options;
      }
    }

    res.json({ workCategoryValues });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/admin/campaigns/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, status, total_contacts, total_batches, current_batch,
              filters, builder_path, last_step,
              message_preset, message_body, ai_rapport_enabled, cta_enabled, cta_url,
              created_at, updated_at
       FROM campaigns WHERE id = $1 AND contractor_id = $2`,
      [id, 'accent-roofing']
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = result.rows[0];
    const imgResult = await pool.query(
      'SELECT public_url, filename FROM campaign_images WHERE campaign_id = $1 ORDER BY uploaded_at DESC LIMIT 1',
      [id]
    );
    campaign.image = imgResult.rows[0] || null;
    res.json(campaign);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/api/admin/campaigns/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  const { builder_path, last_step } = req.body;
  if (builder_path !== undefined && !['jobber', 'csv'].includes(builder_path)) {
    return res.status(400).json({ error: 'builder_path must be jobber or csv' });
  }
  if (last_step !== undefined && (typeof last_step !== 'number' || !Number.isInteger(last_step) || last_step < 0 || last_step > 5)) {
    return res.status(400).json({ error: 'last_step must be an integer 0–5' });
  }
  try {
    const check = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [id, 'accent-roofing']
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const updates = [];
    const params = [];
    if (builder_path !== undefined) {
      params.push(builder_path);
      updates.push(`builder_path = $${params.length}`);
    }
    if (last_step !== undefined) {
      params.push(last_step);
      updates.push(`last_step = $${params.length}`);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(id);
    const result = await pool.query(
      `UPDATE campaigns SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} AND contractor_id = 'accent-roofing' RETURNING id, builder_path, last_step`,
      params
    );
    res.json(result.rows[0]);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/admin/campaigns/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  const contractorId = 'accent-roofing';
  try {
    const check = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [id, contractorId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    await pool.query('BEGIN');
    try {
      await pool.query('DELETE FROM campaign_send_log WHERE campaign_id = $1', [id]);
      await pool.query('DELETE FROM campaign_batches WHERE campaign_id = $1', [id]);
      await pool.query('DELETE FROM campaign_contacts WHERE campaign_id = $1', [id]);
      await pool.query('DELETE FROM campaign_images WHERE campaign_id = $1', [id]);
      await pool.query('DELETE FROM campaign_events WHERE campaign_id = $1', [id]);
      // campaign_tracking_tokens handled by ON DELETE CASCADE on campaigns FK
      await pool.query('DELETE FROM unsubscribe_tokens WHERE campaign_id = $1', [id]);
      await pool.query('DELETE FROM campaigns WHERE id = $1 AND contractor_id = $2', [id, contractorId]);
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

    res.json({ deleted: true, id });
  } catch (err) {
    await logError({ req, error: err, source: 'DELETE /api/admin/campaigns/:id' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/api/admin/campaigns/:id/filters', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  const { dateFrom, dateTo, paidOnly, minJobValue, workCategory, jobSource, notInApp } = req.body;
  try {
    const check = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [id, 'accent-roofing']
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const filters = { dateFrom, dateTo, paidOnly, minJobValue, workCategory, jobSource, notInApp };
    const result = await pool.query(
      `UPDATE campaigns SET filters = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, filters`,
      [JSON.stringify(filters), id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/admin/campaigns/:id/contacts', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  try {
    const check = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [id, 'accent-roofing']
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const result = await pool.query(
      `SELECT id, client_name, phone, email, job_type, job_date, job_value, in_app, selected
       FROM campaign_contacts WHERE campaign_id = $1 AND contractor_id = $2 ORDER BY client_name ASC`,
      [id, 'accent-roofing']
    );
    res.json({ contacts: result.rows });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/api/admin/campaigns/:id/contacts/selection', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  const { updates } = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'updates must be a non-empty array' });
  }
  for (const u of updates) {
    if (typeof u.id !== 'number' || typeof u.selected !== 'boolean') {
      return res.status(400).json({ error: 'Each update must have numeric id and boolean selected' });
    }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      await client.query(
        'UPDATE campaign_contacts SET selected = $1 WHERE id = $2 AND campaign_id = $3',
        [u.selected, u.id, id]
      );
    }
    await client.query('COMMIT');
    res.json({ updated: updates.length });
  } catch (err) {
    await client.query('ROLLBACK');
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/api/admin/campaigns/:id/finalize-batch', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  try {
    const campaignCheck = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [id, 'accent-roofing']
    );
    if (campaignCheck.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    const contactsResult = await pool.query(
      `SELECT id FROM campaign_contacts
       WHERE campaign_id = $1 AND contractor_id = $2 AND selected = true
       ORDER BY client_name ASC`,
      [id, 'accent-roofing']
    );
    const selectedContacts = contactsResult.rows;
    if (selectedContacts.length === 0) return res.status(400).json({ error: 'No contacts selected' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < selectedContacts.length; i++) {
        const batchNumber = Math.ceil((i + 1) / CAMPAIGN_BATCH_CAP);
        await client.query(
          'UPDATE campaign_contacts SET batch_number = $1 WHERE id = $2',
          [batchNumber, selectedContacts[i].id]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const totalSelected = selectedContacts.length;
    const totalBatches = Math.ceil(totalSelected / CAMPAIGN_BATCH_CAP);
    await pool.query(
      `UPDATE campaigns
       SET total_contacts = $1, total_batches = $2, current_batch = 1, updated_at = NOW()
       WHERE id = $3 AND contractor_id = $4`,
      [totalSelected, totalBatches, id, 'accent-roofing']
    );

    res.json({ totalSelected, totalBatches });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/admin/campaigns/:id/messaging-context', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  try {
    const campaignCheck = await pool.query(
      'SELECT message_preset, message_body, approved_message, ai_rapport_enabled, cta_enabled, cta_url, ai_rapport_generations, subject_line, selected_tone, email_header FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [id, 'accent-roofing']
    );
    if (campaignCheck.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const saved = campaignCheck.rows[0];

    const settingsResult = await pool.query(
      'SELECT company_url, social_facebook, social_instagram, social_google, social_nextdoor, social_website FROM contractor_settings WHERE contractor_id = $1 LIMIT 1',
      ['accent-roofing']
    );
    const row = settingsResult.rows[0];
    const ctaOptions = {
      appSignup:  process.env.FRONTEND_URL || '',
      website:    row?.company_url       || null,
      facebook:   row?.social_facebook   || null,
      instagram:  row?.social_instagram  || null,
      google:     row?.social_google     || null,
      nextdoor:   row?.social_nextdoor   || null,
    };

    const imageResult = await pool.query(
      'SELECT public_url, filename, file_size_bytes FROM campaign_images WHERE campaign_id = $1 LIMIT 1',
      [id]
    );

    res.json({ saved, ctaOptions, image: imageResult.rows[0] || null });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/campaigns/:id/messaging-context' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/api/admin/campaigns/:id/messaging', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  const { message_preset, message_body, ai_rapport_enabled, cta_enabled, cta_url, subject_line, selected_tone, approved_message, email_header } = req.body;

  const validPresets = ['referral_invite', 're_engagement', 'seasonal', 'thank_you', 'write_own'];
  const validTones = ['friendly', 'professional', 'warm', 'casual'];
  if (!validPresets.includes(message_preset)) return res.status(400).json({ error: 'Invalid message_preset' });
  if (typeof ai_rapport_enabled !== 'boolean') return res.status(400).json({ error: 'ai_rapport_enabled must be boolean' });
  if (typeof cta_enabled !== 'boolean') return res.status(400).json({ error: 'cta_enabled must be boolean' });
  if (cta_url !== null && cta_url !== undefined && typeof cta_url !== 'string') return res.status(400).json({ error: 'cta_url must be string or null' });
  if (message_body !== null && message_body !== undefined && typeof message_body === 'string' && message_body.length > 1000) return res.status(400).json({ error: 'message_body exceeds 1000 characters' });
  if (subject_line !== null && subject_line !== undefined && typeof subject_line === 'string' && subject_line.length > 200) return res.status(400).json({ error: 'subject_line exceeds 200 characters' });
  if (selected_tone !== null && selected_tone !== undefined && !validTones.includes(selected_tone)) return res.status(400).json({ error: 'Invalid selected_tone' });
  if (approved_message !== null && approved_message !== undefined && typeof approved_message === 'string' && approved_message.length > 2000) return res.status(400).json({ error: 'approved_message exceeds 2000 characters' });
  const emailHeaderTrimmed = (email_header && typeof email_header === 'string') ? email_header.trim().slice(0, 100) : null;

  try {
    const result = await pool.query(
      `UPDATE campaigns
       SET message_preset = $1, message_body = $2, ai_rapport_enabled = $3,
           cta_enabled = $4, cta_url = $5, subject_line = $6,
           selected_tone = COALESCE($7, selected_tone),
           approved_message = $10, email_header = $11, updated_at = NOW()
       WHERE id = $8 AND contractor_id = $9`,
      [message_preset, message_body || null, ai_rapport_enabled, cta_enabled, cta_url || null, subject_line || null, selected_tone || null, id, 'accent-roofing', approved_message || null, emailHeaderTrimmed || null]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'PATCH /api/admin/campaigns/:id/messaging' });
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/admin/campaigns/:id/review-summary', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  try {
    const campaignResult = await pool.query(
      `SELECT id, name, status, total_contacts, total_batches, current_batch,
              message_preset, message_body, approved_message, ai_rapport_enabled, cta_enabled,
              cta_url, subject_line, email_header, sent_at
       FROM campaigns WHERE id = $1 AND contractor_id = $2`,
      [id, 'accent-roofing']
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = campaignResult.rows[0];

    const countsResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE selected = true AND batch_number = 1) AS batch1_selected,
         COUNT(*) FILTER (WHERE opted_out = true) AS opted_out_count
       FROM campaign_contacts
       WHERE campaign_id = $1 AND contractor_id = $2`,
      [id, 'accent-roofing']
    );
    const { batch1_selected, opted_out_count } = countsResult.rows[0];

    const settingsResult = await pool.query(
      `SELECT company_name FROM contractor_settings
       WHERE contractor_id = 'accent-roofing' LIMIT 1`
    );
    const companyName = settingsResult.rows[0]?.company_name || 'Accent Roofing Service';

    const imageResult = await pool.query(
      'SELECT public_url FROM campaign_images WHERE campaign_id = $1 LIMIT 1',
      [id]
    );

    const creditsPerMessage = 1;
    const monthlyCredits = 3000;
    const creditsConsumed = parseInt(batch1_selected, 10) * creditsPerMessage;
    const creditsRemaining = monthlyCredits - creditsConsumed;
    const overage = creditsRemaining < 0 ? Math.abs(creditsRemaining) : 0;
    const overageCost = parseFloat((overage * 0.008).toFixed(2));

    res.json({
      campaign,
      batch1Selected: parseInt(batch1_selected, 10),
      optedOutCount: parseInt(opted_out_count, 10),
      companyName,
      imageUrl: imageResult.rows[0]?.public_url || null,
      credits: {
        monthlyCredits: 3000,
        creditsConsumed,
        creditsRemaining: Math.max(creditsRemaining, 0),
        overage,
        overageCost,
        assumption: 'email_only',
      },
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/campaigns/:id/review-summary' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/campaigns/:id/launch', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  const campaignId = parseInt(id, 10);
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';
  try {
    const checkResult = await pool.query(
      `SELECT id, status, name, total_batches FROM campaigns WHERE id = $1 AND contractor_id = $2`,
      [id, contractorId]
    );
    if (checkResult.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const { status, name, total_batches } = checkResult.rows[0];
    if (status !== 'draft') return res.status(400).json({ error: 'Campaign already launched' });

    const newStatus = parseInt(total_batches, 10) > 1 ? 'pending_batches' : 'active';
    await pool.query(
      `UPDATE campaigns
       SET status = $1, sent_at = NOW(), campaign_expires_at = NOW() + INTERVAL '90 days', updated_at = NOW()
       WHERE id = $2 AND contractor_id = $3`,
      [newStatus, id, contractorId]
    );

    await pool.query(
      `INSERT INTO activity_log (event_type, detail) VALUES ($1, $2)`,
      ['campaign_launched', `Campaign "${name}" launched — sending Batch 1 of ${total_batches}`]
    );

    const result = await executeBatchSend(campaignId, req);

    res.json({ success: true, status: newStatus, ...result });
  } catch (err) {
    try {
      await pool.query(
        `UPDATE campaigns SET status = 'draft', sent_at = NULL, campaign_expires_at = NULL, updated_at = NOW()
         WHERE id = $1 AND contractor_id = $2`,
        [id, contractorId]
      );
    } catch (revertErr) {
      await logError({ req, error: revertErr, source: 'POST /api/admin/campaigns/:id/launch (revert)' });
    }
    await logError({ req, error: err, source: 'POST /api/admin/campaigns/:id/launch' });
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

async function fetchJobberPage(query, variables, accessToken) {
  return retryWithBackoff(
    async () => {
      const response = await axios.post(
        'https://api.getjobber.com/api/graphql',
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
          }
        }
      );
      if (response.data.errors && response.data.errors[0]?.message !== 'Throttled') {
        const err = new Error(response.data.errors[0]?.message || 'Jobber API error');
        err.response = { status: response.status };
        err.status = response.status;
        throw err;
      }
      return response.data;
    },
    { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
  );
}

router.post('/api/admin/campaigns/:id/pull', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  try {
    const campaignResult = await pool.query(
      'SELECT filters FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [id, 'accent-roofing']
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const filters = campaignResult.rows[0].filters || {};

    const settingsResult = await pool.query(
      'SELECT contractor_field_mappings FROM contractor_settings WHERE contractor_id = $1',
      ['accent-roofing']
    );
    const mappings = settingsResult.rows[0]?.contractor_field_mappings || {};

    await refreshTokenIfNeeded();
    const tokenResult = await pool.query('SELECT access_token FROM tokens WHERE id = 1');
    if (tokenResult.rows.length === 0 || !tokenResult.rows[0].access_token) {
      return res.status(503).json({ error: 'Jobber not connected' });
    }
    const token = tokenResult.rows[0].access_token;

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emit = (obj) => res.write(JSON.stringify(obj) + '\n');

    const jobsQueryWithFilter = `
      query CampaignJobsPull($cursor: String, $dateFrom: ISO8601DateTime, $dateTo: ISO8601DateTime) {
        jobs(
          first: 50
          after: $cursor
          filter: {
            completedAt: {
              after: $dateFrom
              before: $dateTo
            }
          }
        ) {
          nodes {
            id
            completedAt
            total
            customFields {
              ... on CustomFieldDropdown { label valueDropdown }
              ... on CustomFieldText { label valueText }
              ... on CustomFieldNumeric { label valueNumeric }
              ... on CustomFieldTrueFalse { label valueTrueFalse }
              ... on CustomFieldLink { label valueLink { text url } }
            }
            client {
              id
              name
              emails { address description }
              phones { number description }
            }
            invoices(first: 1) {
              nodes {
                invoiceStatus
                amounts { total }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    const jobsQueryNoFilter = `
      query CampaignJobsPull($cursor: String) {
        jobs(
          first: 50
          after: $cursor
        ) {
          nodes {
            id
            completedAt
            total
            customFields {
              ... on CustomFieldDropdown { label valueDropdown }
              ... on CustomFieldText { label valueText }
              ... on CustomFieldNumeric { label valueNumeric }
              ... on CustomFieldTrueFalse { label valueTrueFalse }
              ... on CustomFieldLink { label valueLink { text url } }
            }
            client {
              id
              name
              emails { address description }
              phones { number description }
            }
            invoices(first: 1) {
              nodes {
                invoiceStatus
                amounts { total }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    const hasDateFilter = filters.dateFrom && filters.dateTo;
    const allJobs = [];
    const seenClientIds = new Set();
    const PAGE_COST = 1493;
    const RESTORE_RATE = 500;
    let cursor = null;
    let hasNextPage = true;
    let pageNum = 1;

    while (hasNextPage) {
      if (pageNum === 1 || pageNum % 5 === 0) {
        console.log(`[Campaign Pull] page ${pageNum}, cursor: ${cursor || 'start'}, collected: ${allJobs.length}`); // diagnostic log — intentional
      }
      const variables = hasDateFilter
        ? { cursor, dateFrom: filters.dateFrom, dateTo: filters.dateTo }
        : { cursor };

      let jobJson;
      let throttleRetries = 0;
      while (true) {
        jobJson = await fetchJobberPage(
          hasDateFilter ? jobsQueryWithFilter : jobsQueryNoFilter,
          variables,
          token
        );
        if (jobJson.errors?.[0]?.message === 'Throttled') {
          throttleRetries++;
          if (throttleRetries > 3) {
            throw new Error(`Throttled after 3 retries on page ${pageNum}`);
          }
          const throttleStatus = jobJson.extensions?.cost?.throttleStatus;
          const currentlyAvailable = throttleStatus?.currentlyAvailable ?? 0;
          const waitMs = Math.ceil(((PAGE_COST - currentlyAvailable) / RESTORE_RATE) * 1000) + 200;
          console.log(`[Campaign Pull] Throttled on page ${pageNum} — waiting ${waitMs}ms before retry ${throttleRetries}/3`); // diagnostic log — intentional
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        break;
      }

      const page = jobJson?.data?.jobs;
      if (!page) break;
      allJobs.push(...(page.nodes || []));
      for (const job of (page.nodes || [])) {
        if (job.client?.id) seenClientIds.add(job.client.id);
      }
      emit({ type: 'progress', contactsSoFar: seenClientIds.size });
      if (page.pageInfo?.hasNextPage && !page.pageInfo?.endCursor) {
        throw new Error('Jobber returned hasNextPage=true but no endCursor — aborting pagination to prevent infinite loop');
      }
      hasNextPage = page.pageInfo?.hasNextPage ?? false;
      cursor = page.pageInfo?.endCursor ?? null;
      pageNum++;
      if (hasNextPage) {
        const throttleStatus = jobJson?.extensions?.cost?.throttleStatus;
        const currentlyAvailable = throttleStatus?.currentlyAvailable ?? 10000;
        if (currentlyAvailable < PAGE_COST) {
          const waitMs = Math.ceil(((PAGE_COST - currentlyAvailable) / RESTORE_RATE) * 1000) + 200;
          // MVP shortcut: fixed PAGE_COST estimate — scalable path: read requestedQueryCost dynamically per page
          await new Promise(r => setTimeout(r, waitMs));
        }
      }
    }
    console.log(`[Campaign Pull] complete — ${allJobs.length} total jobs pulled across ${pageNum} pages`); // diagnostic log — intentional

    // Filter 1 — paidOnly (default ON)
    let filteredJobs = allJobs;
    if (filters.paidOnly !== false) {
      filteredJobs = filteredJobs.filter(job => {
        const invoice = job.invoices?.nodes?.[0];
        return invoice?.invoiceStatus === 'paid';
      });
    }

    // Filter 2 — minJobValue
    if (filters.minJobValue && Number(filters.minJobValue) > 0) {
      filteredJobs = filteredJobs.filter(job => {
        const invoice = job.invoices?.nodes?.[0];
        const value = invoice?.amounts?.total ?? job.total;
        return value >= Number(filters.minJobValue);
      });
    }

    // Filter 3 — workCategory (supports per-item include/exclude mode; backward-compat with plain string arrays)
    if (Array.isArray(filters.workCategory) && filters.workCategory.length > 0 && mappings.work_category) {
      const label = mappings.work_category;
      const includes = filters.workCategory
        .filter(f => (typeof f === 'string' ? 'include' : (f.mode ?? 'include')) === 'include')
        .map(f => typeof f === 'string' ? f : f.value);
      const excludes = filters.workCategory
        .filter(f => typeof f !== 'string' && f.mode === 'exclude')
        .map(f => f.value);
      filteredJobs = filteredJobs.filter(job => {
        const field = (job.customFields || []).find(f => f.label === label);
        const val = field?.valueDropdown;
        if (includes.length > 0 && !includes.includes(val)) return false;
        if (excludes.includes(val)) return false;
        return true;
      });
    }

    // Filter 4 — jobSource removed: job source lives on Jobber client records, not job records.
    // Cannot be filtered at pull time. Future: filter post-pull if client custom fields become queryable.

    // Filter 5 — deduplicate by client.id (most recent completedAt wins)
    const clientMap = new Map();
    for (const job of filteredJobs) {
      if (!job.client?.id) continue;
      const existing = clientMap.get(job.client.id);
      if (!existing || new Date(job.completedAt) > new Date(existing.completedAt)) {
        clientMap.set(job.client.id, job);
      }
    }
    const dedupedJobs = Array.from(clientMap.values());

    const getField = (fields, label) => {
      if (!label) return null;
      const f = (fields || []).find(field => field.label === label);
      return f?.valueDropdown ?? f?.valueText ?? f?.valueNumeric ?? null;
    };

    const contacts = dedupedJobs.filter(job => job.client?.id).map(job => {
      const invoice = job.invoices?.nodes?.[0];
      return {
        clientJobberId: job.client.id,
        clientName: job.client.name,
        email: job.client.emails[0]?.address ?? null,
        phone: job.client.phones[0]?.number ?? null,
        jobValue: invoice?.amounts?.total ?? job.total,
        jobDate: job.completedAt,
        invoiceStatus: invoice?.invoiceStatus ?? null,
        workCategory: getField(job.customFields, mappings.work_category),
        jobSource: getField(job.customFields, mappings.job_source),
        materialType: getField(job.customFields, mappings.material_type),
        assignedRep: getField(job.customFields, mappings.assigned_rep),
      };
    });

    const usersResult = await pool.query(
      'SELECT email FROM users WHERE deleted_at IS NULL'
    );
    const knownEmails = new Set(
      usersResult.rows.map(r => r.email?.toLowerCase()).filter(Boolean)
    );
    const totalPulled = contacts.length;
    let inAppCount = 0;
    const withInApp = contacts.map(c => {
      const inApp = c.email ? knownEmails.has(c.email.toLowerCase()) : false;
      if (inApp) inAppCount++;
      return { ...c, inApp };
    });

    const finalContacts = filters.notInApp !== false
      ? withInApp.filter(c => !c.inApp)
      : withInApp;

    await pool.query('DELETE FROM campaign_contacts WHERE campaign_id = $1', [id]);
    if (withInApp.length > 0) {
      const valuePlaceholders = withInApp.map((_, i) => {
        const base = i * 11;
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11})`;
      }).join(',');
      const flatValues = withInApp.flatMap(c => [
        id, 'accent-roofing', c.clientJobberId, c.clientName, c.phone, c.email,
        c.jobType, c.jobSource, c.jobDate, c.jobValue, c.inApp
      ]);
      await pool.query(
        `INSERT INTO campaign_contacts
           (campaign_id, contractor_id, client_jobber_id, client_name, phone, email,
            job_type, job_source, job_date, job_value, in_app)
         VALUES ${valuePlaceholders}`,
        flatValues
      );
    }
    await pool.query(
      'UPDATE campaigns SET total_contacts = $1, updated_at = NOW() WHERE id = $2',
      [withInApp.length, id]
    );

    emit({ type: 'complete', totalContacts: finalContacts.length, inAppCount });
    res.write('\n');
    res.end();
  } catch (err) {
    await logError({ req, error: err });
    if (res.headersSent) {
      try { res.write(JSON.stringify({ type: 'error', message: err.message || 'Pull failed' }) + '\n'); } catch {}
      try { res.end(); } catch {}
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── CAMPAIGN DETAIL + BATCH MANAGEMENT + IMAGE + CSV ─────────────────────────

router.get('/api/admin/campaigns/:id/detail', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const campaignId = parseInt(req.params.id, 10);
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';
  try {
    const campaignResult = await pool.query(
      `SELECT id, contractor_id, name, status, filters, message_preset, message_body,
              ai_rapport_enabled, cta_enabled, cta_url, outreach_method, batch_cap,
              total_contacts, total_batches, current_batch, sent_at, last_batch_sent_at,
              campaign_expires_at, completed_at, created_at, updated_at
       FROM campaigns WHERE id = $1 AND contractor_id = $2`,
      [campaignId, contractorId]
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = campaignResult.rows[0];

    // MVP: lazy expiry on detail fetch — replace with a scheduled job before multi-contractor scale
    if (campaign.campaign_expires_at && new Date(campaign.campaign_expires_at) < new Date()) {
      await pool.query(
        `UPDATE campaigns SET status = 'closed'
         WHERE id = $1 AND status = 'active'
           AND campaign_expires_at IS NOT NULL
           AND campaign_expires_at < NOW()`,
        [campaignId]
      );
      campaign.status = 'closed';
    }

    // MVP note: one-time heal for campaigns launched before campaign_expires_at column existed
    const healResult = await pool.query(
      `UPDATE campaigns SET status = 'active', completed_at = NULL
       WHERE id = $1 AND status = 'closed' AND campaign_expires_at IS NULL
       RETURNING id`,
      [campaignId]
    );
    if (healResult.rows.length > 0) {
      campaign.status = 'active';
      campaign.completed_at = null;
    }

    const [batchStatsResult, batchRecordsResult] = await Promise.all([
      pool.query(
        `SELECT
           batch_number,
           COUNT(*) FILTER (WHERE selected = true)    AS total_contacts,
           COUNT(*) FILTER (WHERE delivered = true)   AS sent_count,
           COUNT(*) FILTER (WHERE opened = true)      AS opened_count,
           COUNT(*) FILTER (WHERE clicked = true)     AS clicked_count,
           COUNT(*) FILTER (WHERE converted = true)   AS converted_count,
           COUNT(*) FILTER (WHERE opted_out = true)   AS opted_out_count
         FROM campaign_contacts
         WHERE campaign_id = $1 AND contractor_id = $2
         GROUP BY batch_number
         ORDER BY batch_number ASC`,
        [campaignId, contractorId]
      ),
      pool.query(
        `SELECT batch_number, sent_count, failed_count, skipped_count, sent_at
         FROM campaign_batches
         WHERE campaign_id = $1
         ORDER BY batch_number ASC`,
        [campaignId]
      ),
    ]);

    const batchRecordMap = {};
    for (const br of batchRecordsResult.rows) {
      batchRecordMap[br.batch_number] = br;
    }

    const currentBatch = campaign.current_batch || 1;
    const batches = batchStatsResult.rows.map(row => {
      let batchStatus;
      if (campaign.status === 'closed') {
        batchStatus = 'sent';
      } else if (row.batch_number < currentBatch) {
        batchStatus = 'sent';
      } else if (row.batch_number === currentBatch) {
        batchStatus = 'active';
      } else {
        batchStatus = 'pending';
      }
      const br = batchRecordMap[row.batch_number] || {};
      return {
        batch_number:    row.batch_number,
        total_contacts:  parseInt(row.total_contacts, 10),
        sent_count:      parseInt(row.sent_count, 10),
        opened_count:    parseInt(row.opened_count, 10),
        clicked_count:   parseInt(row.clicked_count, 10),
        converted_count: parseInt(row.converted_count, 10),
        opted_out_count: parseInt(row.opted_out_count, 10),
        failed_count:    parseInt(br.failed_count || 0, 10),
        skipped_count:   parseInt(br.skipped_count || 0, 10),
        sent_at:         br.sent_at || null,
        status:          batchStatus,
      };
    });

    const totalSelected  = batches.reduce((s, b) => s + b.total_contacts, 0);
    const totalSent      = batches.reduce((s, b) => s + b.sent_count, 0);
    const totalOpened    = batches.reduce((s, b) => s + b.opened_count, 0);
    const totalClicked   = batches.reduce((s, b) => s + b.clicked_count, 0);
    const totalConverted = batches.reduce((s, b) => s + b.converted_count, 0);
    const totalOptedOut  = batches.reduce((s, b) => s + b.opted_out_count, 0);
    const batchesSent    = campaign.status === 'closed'
      ? (campaign.total_batches || 0)
      : Math.max(0, currentBatch - 1);

    const combined_metrics = {
      total_selected:  totalSelected,
      total_sent:      totalSent,
      total_opened:    totalOpened,
      total_clicked:   totalClicked,
      total_converted: totalConverted,
      total_opted_out: totalOptedOut,
      open_rate:       totalSent > 0 ? Math.round((totalOpened / totalSent) * 1000) / 10 : 0,
      click_rate:      totalSent > 0 ? Math.round((totalClicked / totalSent) * 1000) / 10 : 0,
      conversion_rate: totalSent > 0 ? Math.round((totalConverted / totalSent) * 1000) / 10 : 0,
      batches_sent:    batchesSent,
      batches_pending: (campaign.total_batches || 0) - batchesSent,
    };

    const [imageResult, optOutResult] = await Promise.all([
      pool.query(
        'SELECT public_url, filename FROM campaign_images WHERE campaign_id = $1 LIMIT 1',
        [campaignId]
      ),
      pool.query(
        `SELECT
           COUNT(*) AS total_opt_outs,
           COUNT(*) FILTER (WHERE opt_out_campaigns) AS opted_out_campaigns,
           COUNT(*) FILTER (WHERE opt_out_sms) AS opted_out_sms,
           COUNT(*) FILTER (WHERE opt_out_all) AS opted_out_all,
           COALESCE(json_agg(json_build_object(
             'email', email,
             'opted_out_at', opted_out_at,
             'opt_out_campaigns', opt_out_campaigns,
             'opt_out_sms', opt_out_sms,
             'opt_out_all', opt_out_all,
             'referral_only', referral_only
           )) FILTER (WHERE email IS NOT NULL), '[]') AS opt_out_contacts
         FROM email_opt_outs
         WHERE campaign_id = $1`,
        [campaignId]
      ),
    ]);

    const optOutData = optOutResult.rows[0]
      ? {
          total_opt_outs:       parseInt(optOutResult.rows[0].total_opt_outs, 10),
          opted_out_campaigns:  parseInt(optOutResult.rows[0].opted_out_campaigns, 10),
          opted_out_sms:        parseInt(optOutResult.rows[0].opted_out_sms, 10),
          opted_out_all:        parseInt(optOutResult.rows[0].opted_out_all, 10),
          opt_out_contacts:     optOutResult.rows[0].opt_out_contacts || [],
        }
      : { total_opt_outs: 0, opted_out_campaigns: 0, opted_out_sms: 0, opted_out_all: 0, opt_out_contacts: [] };

    res.json({ campaign, batches, combined_metrics, opt_out_data: optOutData, image: imageResult.rows[0] || null });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/campaigns/:id/detail' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/admin/campaigns/:id/metrics', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const campaignId = parseInt(req.params.id, 10);
  try {
    const [byBatchResult, totalsResult] = await Promise.all([
      pool.query(
        `SELECT batch_number, event_type, COUNT(*) AS count
         FROM campaign_events
         WHERE campaign_id = $1
         GROUP BY batch_number, event_type
         ORDER BY batch_number`,
        [campaignId]
      ),
      pool.query(
        `SELECT event_type, COUNT(DISTINCT token) AS unique_count
         FROM campaign_events
         WHERE campaign_id = $1
         GROUP BY event_type`,
        [campaignId]
      ),
    ]);
    res.json({ byBatch: byBatchResult.rows, totals: totalsResult.rows });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/campaigns/:id/metrics' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/campaigns/:id/send-batch', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const campaignId = parseInt(req.params.id, 10);
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';
  try {
    const guardResult = await pool.query(
      `SELECT id, status, last_batch_sent_at FROM campaigns WHERE id = $1 AND contractor_id = $2`,
      [campaignId, contractorId]
    );
    if (guardResult.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const { status, last_batch_sent_at } = guardResult.rows[0];

    if (!['active', 'pending_batches'].includes(status)) {
      return res.status(400).json({ error: 'Campaign is not in an active state' });
    }
    if (last_batch_sent_at) {
      const msSinceLast = Date.now() - new Date(last_batch_sent_at).getTime();
      if (msSinceLast < 24 * 60 * 60 * 1000) {
        const availableAt = new Date(new Date(last_batch_sent_at).getTime() + 24 * 60 * 60 * 1000);
        return res.status(429).json({
          error: 'Batches must be spaced at least 24 hours apart',
          next_batch_available_at: availableAt.toISOString(),
        });
      }
    }

    const result = await executeBatchSend(campaignId, req);
    res.json({
      success: true,
      ...result,
      next_batch_available_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/admin/campaigns/:id/send-batch' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/campaigns/:id/retry-batch', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const campaignId = parseInt(req.params.id, 10);
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';
  const { batch_number } = req.body;
  if (!batch_number || typeof batch_number !== 'number') {
    return res.status(400).json({ error: 'batch_number is required and must be a number' });
  }
  try {
    const failedResult = await pool.query(
      `SELECT id, contact_id, contact_name, email, phone
       FROM campaign_send_log
       WHERE campaign_id = $1 AND batch_number = $2 AND status = 'failed'`,
      [campaignId, batch_number]
    );
    if (failedResult.rows.length === 0) {
      return res.json({ success: true, retried: 0, message: 'No failed contacts to retry' });
    }

    const campaignResult = await pool.query(
      `SELECT c.message_body, c.subject_line, c.cta_enabled, c.cta_url, c.contractor_id,
              c.selected_tone, c.message_preset, c.email_header, ci.public_url AS image_url,
              COALESCE(cs.email_sender_name, cs.company_name, 'RoofMiles') AS sender_name,
              cs.font_heading, cs.font_body, cs.company_name, cs.email_sender_name,
              cs.company_address, cs.company_city, cs.company_state, cs.company_zip,
              cs.company_email, cs.logo_url, cs.social_facebook, cs.social_instagram,
              cs.social_google, cs.social_website
       FROM campaigns c
       LEFT JOIN campaign_images ci ON ci.campaign_id = c.id
       LEFT JOIN contractor_settings cs ON cs.contractor_id = c.contractor_id
       WHERE c.id = $1 AND c.contractor_id = $2 LIMIT 1`,
      [campaignId, contractorId]
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = campaignResult.rows[0];
    // MVP: contractor name hardcoded — replace with session lookup at multi-contractor scale
    const campaignData = { ...campaign, contractor_name: 'Accent Roofing Service' };
    const contractorSettings = {
      font_heading:      campaign.font_heading,
      font_body:         campaign.font_body,
      company_name:      campaign.company_name,
      email_sender_name: campaign.email_sender_name,
      company_address:   campaign.company_address,
      company_city:      campaign.company_city,
      company_state:     campaign.company_state,
      company_zip:       campaign.company_zip,
      company_email:     campaign.company_email,
      logo_url:          campaign.logo_url,
      social_facebook:   campaign.social_facebook,
      social_instagram:  campaign.social_instagram,
      social_google:     campaign.social_google,
      social_website:    campaign.social_website,
    };

    const contacts = failedResult.rows;
    const chunks = chunkArray(contacts, 50);
    const retryResults = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkResults = await Promise.all(
        chunk.map(c =>
          sendEmailViaResend(
            { email: c.email, phone: c.phone, client_name: c.contact_name },
            campaign.message_body,
            campaignData,
            null,
            campaign.sender_name,
            contractorSettings
          )
        )
      );
      for (let j = 0; j < chunk.length; j++) {
        retryResults.push({ logId: chunk[j].id, ...chunkResults[j] });
      }
      if (i < chunks.length - 1) await sleep(150);
    }

    for (const result of retryResults) {
      await pool.query(
        `UPDATE campaign_send_log
         SET status = $1, error_code = $2, error_message = $3, sent_at = NOW()
         WHERE id = $4`,
        [
          result.success ? 'delivered' : 'failed',
          result.errorCode || null,
          result.errorMessage || null,
          result.logId,
        ]
      );
    }

    const delivered   = retryResults.filter(r => r.success).length;
    const stillFailed = retryResults.filter(r => !r.success).length;

    const countsResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'delivered') AS sent_count,
         COUNT(*) FILTER (WHERE status = 'failed')    AS failed_count,
         COUNT(*) FILTER (WHERE status = 'skipped')   AS skipped_count
       FROM campaign_send_log
       WHERE campaign_id = $1 AND batch_number = $2`,
      [campaignId, batch_number]
    );
    const counts = countsResult.rows[0];
    await pool.query(
      `UPDATE campaign_batches
       SET sent_count = $1, failed_count = $2, skipped_count = $3
       WHERE campaign_id = $4 AND batch_number = $5`,
      [parseInt(counts.sent_count, 10), parseInt(counts.failed_count, 10),
       parseInt(counts.skipped_count, 10), campaignId, batch_number]
    );

    // Note: last_batch_sent_at is NOT updated — retry sends are exempt from the 24-hour throttle

    res.json({ success: true, retried: contacts.length, delivered, stillFailed });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/admin/campaigns/:id/retry-batch' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/admin/campaigns/:id/failed-contacts/:batchNumber', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const campaignId  = parseInt(req.params.id, 10);
  const batchNumber = parseInt(req.params.batchNumber, 10);
  try {
    const result = await pool.query(
      `SELECT contact_name, email, phone, error_code, error_message, sent_at
       FROM campaign_send_log
       WHERE campaign_id = $1 AND batch_number = $2 AND status = 'failed'
       ORDER BY sent_at ASC`,
      [campaignId, batchNumber]
    );
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/campaigns/:id/failed-contacts/:batchNumber' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/admin/campaigns/:id/export-failed/:batchNumber', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const campaignId  = parseInt(req.params.id, 10);
  const batchNumber = parseInt(req.params.batchNumber, 10);
  try {
    const result = await pool.query(
      `SELECT contact_name, email, phone, error_code, error_message
       FROM campaign_send_log
       WHERE campaign_id = $1 AND batch_number = $2 AND status = 'failed'
       ORDER BY sent_at ASC`,
      [campaignId, batchNumber]
    );

    const header = 'First Name,Last Name,Email,Phone,Error Code,Error Message\n';
    const rows = result.rows.map(row => {
      const nameParts  = (row.contact_name || '').split(' ');
      const firstName  = nameParts[0] || '';
      const lastName   = nameParts.slice(1).join(' ');
      const escape = v => `"${(v || '').replace(/"/g, '""')}"`;
      return [firstName, lastName, row.email, row.phone, row.error_code, row.error_message]
        .map(escape).join(',');
    });

    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="failed-contacts-batch-${batchNumber}.csv"`);
    res.send(csv);
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/campaigns/:id/export-failed/:batchNumber' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/campaigns/:id/upload-image',
  upload.single('image'),
  async (req, res) => {
    if (!await verifyAdminSession(req, res)) return;
    const campaignId = parseInt(req.params.id, 10);
    // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
    const contractorId = 'accent-roofing';
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'File must be JPG, PNG, GIF, or WEBP' });
      }
      if (req.file.size > 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'File size must be 2MB or smaller' });
      }

      const campaignCheck = await pool.query(
        'SELECT id FROM campaigns WHERE id = $1 AND contractor_id = $2',
        [campaignId, contractorId]
      );
      if (campaignCheck.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const b2Key = `campaigns/${campaignId}/${Date.now()}-${safeName}`;
      const publicUrl = buildB2PublicUrl(b2Key);

      if (!process.env.B2_MEDIA_KEY_ID || !process.env.B2_MEDIA_APPLICATION_KEY) {
        return res.status(500).json({ error: 'Media storage credentials are not configured' });
      }

      const s3 = getMediaS3Client();
      await s3.send(new PutObjectCommand({
        Bucket: process.env.B2_MEDIA_BUCKET_NAME,
        Key: b2Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ContentLength: req.file.size,
      }));

      // One image per campaign — replace if one already exists
      await pool.query('DELETE FROM campaign_images WHERE campaign_id = $1', [campaignId]);

      const insertResult = await pool.query(
        `INSERT INTO campaign_images (campaign_id, contractor_id, filename, b2_key, public_url, file_size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, public_url, filename, file_size_bytes`,
        [campaignId, contractorId, req.file.originalname, b2Key, publicUrl, req.file.size]
      );

      res.json({ success: true, ...insertResult.rows[0] });
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/admin/campaigns/:id/upload-image' });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/api/admin/campaigns/:id/image', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const campaignId = parseInt(req.params.id, 10);
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';
  try {
    const campaignCheck = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [campaignId, contractorId]
    );
    if (campaignCheck.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    const imageResult = await pool.query(
      'SELECT id, b2_key FROM campaign_images WHERE campaign_id = $1',
      [campaignId]
    );
    if (imageResult.rows.length === 0) return res.status(404).json({ error: 'No image for this campaign' });

    const s3 = getMediaS3Client();
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.B2_MEDIA_BUCKET_NAME,
      Key: imageResult.rows[0].b2_key,
    }));

    await pool.query('DELETE FROM campaign_images WHERE campaign_id = $1', [campaignId]);
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'DELETE /api/admin/campaigns/:id/image' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/campaigns/:id/upload-csv',
  upload.single('csv'),
  async (req, res) => {
    if (!await verifyAdminSession(req, res)) return;
    const campaignId = parseInt(req.params.id, 10);
    // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
    const contractorId = 'accent-roofing';
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const isAllowedType = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv']
        .includes(req.file.mimetype);
      const isAllowedExt = req.file.originalname.toLowerCase().endsWith('.csv');
      if (!isAllowedType && !isAllowedExt) {
        return res.status(400).json({ error: 'File must be a CSV' });
      }

      const campaignCheck = await pool.query(
        'SELECT id FROM campaigns WHERE id = $1 AND contractor_id = $2',
        [campaignId, contractorId]
      );
      if (campaignCheck.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

      await pool.query(
        'DELETE FROM campaign_contacts WHERE campaign_id = $1 AND source = $2',
        [campaignId, 'csv']
      );

      const csvText = req.file.buffer.toString('utf8');
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

      if (!parsed.data || parsed.data.length === 0) {
        return res.status(400).json({ error: 'CSV is empty or could not be parsed' });
      }

      const rawHeaders = parsed.meta.fields || [];
      const normHeaders = rawHeaders.map(h => h.toLowerCase().trim());

      function detectCol(patterns) {
        for (const p of patterns) {
          const idx = normHeaders.indexOf(p);
          if (idx !== -1) return rawHeaders[idx];
        }
        return null;
      }

      const detected = {
        firstName: detectCol(['first name', 'firstname', 'first', 'fname']),
        lastName:  detectCol(['last name', 'lastname', 'last', 'lname']),
        fullName:  detectCol(['full name', 'fullname', 'name', 'client name', 'customer name']),
        phone:     detectCol(['phone', 'phone number', 'mobile', 'cell', 'telephone', 'sms']),
        email:     detectCol(['email', 'email address', 'e-mail', 'emailaddress']),
      };

      const seenPhones = new Set();
      const seenEmails = new Set();
      let validCount = 0;
      let invalidCount = 0;
      let duplicateCount = 0;
      const preview = [];

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        const firstName = detected.firstName ? (row[detected.firstName] || '').trim() : '';
        const lastName  = detected.lastName  ? (row[detected.lastName]  || '').trim() : '';
        const fullName  = detected.fullName  ? (row[detected.fullName]  || '').trim() : '';
        const phone     = detected.phone     ? (row[detected.phone]     || '').trim() : '';
        const email     = detected.email     ? (row[detected.email]     || '').trim() : '';

        const hasName    = !!(firstName || fullName);
        const hasContact = !!(phone || email);
        const isValid    = hasName && hasContact;

        let reason = null;
        if (!hasName) reason = 'Missing name';
        else if (!hasContact) reason = 'Missing phone and email';

        let isDuplicate = false;
        if (isValid) {
          const cleanPhone = phone.replace(/\D/g, '');
          const cleanEmail = email.toLowerCase();
          if ((cleanPhone && seenPhones.has(cleanPhone)) || (cleanEmail && seenEmails.has(cleanEmail))) {
            isDuplicate = true;
            duplicateCount++;
          } else {
            if (cleanPhone) seenPhones.add(cleanPhone);
            if (cleanEmail) seenEmails.add(cleanEmail);
          }
        }

        if (isValid && !isDuplicate) validCount++;
        else if (!isValid) invalidCount++;

        if (i < 5) {
          preview.push({ firstName, lastName, fullName, phone, email, valid: isValid && !isDuplicate, duplicate: isDuplicate, reason: isDuplicate ? 'Duplicate phone or email' : reason });
        }
      }

      await pool.query(
        'UPDATE campaigns SET csv_raw = $1, updated_at = NOW() WHERE id = $2',
        [csvText, campaignId]
      );

      res.json({ detected_columns: detected, total_rows: parsed.data.length, valid_rows: validCount, invalid_rows: invalidCount, duplicate_rows: duplicateCount, preview, raw_headers: rawHeaders });
    } catch (err) {
      await logError({ req, error: err, source: 'POST /api/admin/campaigns/:id/upload-csv' });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/api/admin/campaigns/:id/confirm-csv', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const campaignId = parseInt(req.params.id, 10);
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';
  const { column_mapping, confirmed } = req.body;

  if (!confirmed) return res.status(400).json({ error: 'confirmed must be true' });
  if (!column_mapping) return res.status(400).json({ error: 'column_mapping is required' });

  try {
    const campaignResult = await pool.query(
      'SELECT id, csv_raw FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [campaignId, contractorId]
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const { csv_raw } = campaignResult.rows[0];
    if (!csv_raw) return res.status(400).json({ error: 'No CSV found — please re-upload the file' });

    const parsed = Papa.parse(csv_raw, { header: true, skipEmptyLines: true });
    const { firstName: fnCol, lastName: lnCol, fullName: fullCol, phone: phoneCol, email: emailCol } = column_mapping;

    const seenPhones = new Set();
    const seenEmails = new Set();
    const toInsert = [];
    let skipped = 0;

    for (const row of parsed.data) {
      const firstName = fnCol   ? (row[fnCol]   || '').trim() : '';
      const lastName  = lnCol   ? (row[lnCol]   || '').trim() : '';
      const fullName  = fullCol ? (row[fullCol] || '').trim() : '';
      const phone     = phoneCol ? (row[phoneCol] || '').replace(/\D/g, '') : '';
      const email     = emailCol ? (row[emailCol] || '').toLowerCase().trim() : '';

      const clientName = fullName || [firstName, lastName].filter(Boolean).join(' ');
      if (!clientName || (!phone && !email)) { skipped++; continue; }
      if (phone && seenPhones.has(phone)) { skipped++; continue; }
      if (email && seenEmails.has(email)) { skipped++; continue; }
      if (phone) seenPhones.add(phone);
      if (email) seenEmails.add(email);
      toInsert.push({ clientName, phone: phone || null, email: email || null });
    }

    if (toInsert.length > 0) {
      const valuePlaceholders = toInsert.map((_, i) => {
        const b = i * 7;
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7})`;
      }).join(',');
      await pool.query(
        `INSERT INTO campaign_contacts
           (campaign_id, contractor_id, client_name, phone, email, batch_number, source)
         VALUES ${valuePlaceholders}`,
        toInsert.flatMap(r => [campaignId, contractorId, r.clientName, r.phone, r.email, 1, 'csv'])
      );
    }

    await pool.query(
      'UPDATE campaigns SET total_contacts = $1, csv_raw = NULL, updated_at = NOW() WHERE id = $2',
      [toInsert.length, campaignId]
    );

    res.json({ success: true, contacts_imported: toInsert.length, skipped });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/admin/campaigns/:id/confirm-csv' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── REFERRAL SCHEDULE CRUD ────────────────────────────────────────────────────

router.get('/api/admin/schedules', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: contractor_id hardcoded; derive from session token at FORA scale
  const contractorId = 'accent-roofing';
  try {
    const schedulesResult = await pool.query(
      `SELECT id, name, is_active, payout_model, minimum_invoice, reset_period,
              escalating_steps, tier_brackets, flat_amount, percentage_rate,
              percentage_max_cap, invoice_window_days, created_at, updated_at
       FROM referral_schedules WHERE contractor_id = $1 ORDER BY created_at ASC`,
      [contractorId]
    );

    const schedules = await Promise.all(schedulesResult.rows.map(async s => {
      const jt = await pool.query(
        'SELECT jobber_label FROM referral_schedule_job_types WHERE schedule_id = $1 ORDER BY jobber_label ASC',
        [s.id]
      );
      return { ...s, job_types: jt.rows.map(r => r.jobber_label) };
    }));

    let all_labels = [];
    const settingsResult = await pool.query(
      'SELECT contractor_field_mappings FROM contractor_settings WHERE contractor_id = $1',
      [contractorId]
    );
    const mappings = settingsResult.rows[0]?.contractor_field_mappings || {};
    if (mappings.work_category) {
      const fieldResult = await pool.query(
        'SELECT options FROM contractor_jobber_fields WHERE contractor_id = $1 AND label = $2 LIMIT 1',
        [contractorId, mappings.work_category]
      );
      if (Array.isArray(fieldResult.rows[0]?.options)) {
        all_labels = fieldResult.rows[0].options;
      }
    }
    if (all_labels.length === 0) {
      const allJt = await pool.query(
        'SELECT DISTINCT jobber_label FROM referral_schedule_job_types WHERE contractor_id = $1 ORDER BY jobber_label ASC',
        [contractorId]
      );
      all_labels = allJt.rows.map(r => r.jobber_label);
    }

    const assignedSet = new Set(schedules.flatMap(s => s.job_types));
    const unassigned_labels = all_labels.filter(l => !assignedSet.has(l));

    res.json({ schedules, all_labels, unassigned_labels });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to load schedules' });
  }
});

router.post('/api/admin/schedules', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const contractorId = 'accent-roofing';
  const {
    name, payout_model, is_active, minimum_invoice, invoice_window_days,
    escalating_steps, tier_brackets, flat_amount, percentage_rate, percentage_max_cap,
    job_types,
  } = req.body;

  if (!name || !payout_model) {
    return res.status(400).json({ error: 'name and payout_model are required' });
  }

  // reset_period: 'annual' for escalating, 'none' for all others
  const reset_period = payout_model === 'escalating' ? 'annual' : 'none';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO referral_schedules
         (contractor_id, name, is_active, payout_model, minimum_invoice, reset_period,
          escalating_steps, tier_brackets, flat_amount, percentage_rate, percentage_max_cap,
          invoice_window_days, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
       RETURNING id, name, is_active, payout_model, minimum_invoice, reset_period,
                 escalating_steps, tier_brackets, flat_amount, percentage_rate,
                 percentage_max_cap, invoice_window_days, created_at, updated_at`,
      [
        contractorId, name, is_active ?? true, payout_model,
        minimum_invoice || null, reset_period,
        escalating_steps ? JSON.stringify(escalating_steps) : null,
        tier_brackets    ? JSON.stringify(tier_brackets)    : null,
        flat_amount      ?? null,
        percentage_rate  ?? null,
        percentage_max_cap ?? null,
        invoice_window_days || 20,
      ]
    );

    const schedule = insertResult.rows[0];

    if (Array.isArray(job_types) && job_types.length > 0) {
      for (const label of job_types) {
        await client.query(
          `INSERT INTO referral_schedule_job_types (schedule_id, contractor_id, jobber_label)
           VALUES ($1, $2, $3) ON CONFLICT (contractor_id, jobber_label) DO UPDATE SET schedule_id = EXCLUDED.schedule_id`,
          [schedule.id, contractorId, label]
        );
      }
    }

    await client.query('COMMIT');

    const jt = await pool.query(
      'SELECT jobber_label FROM referral_schedule_job_types WHERE schedule_id = $1 ORDER BY jobber_label ASC',
      [schedule.id]
    );
    res.status(201).json({ ...schedule, job_types: jt.rows.map(r => r.jobber_label) });
  } catch (err) {
    await client.query('ROLLBACK');
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to create schedule' });
  } finally {
    client.release();
  }
});

router.put('/api/admin/schedules/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const contractorId = 'accent-roofing';
  const scheduleId = parseInt(req.params.id, 10);
  const {
    name, payout_model, is_active, minimum_invoice, invoice_window_days,
    escalating_steps, tier_brackets, flat_amount, percentage_rate, percentage_max_cap,
    job_types,
  } = req.body;

  if (!name || !payout_model) {
    return res.status(400).json({ error: 'name and payout_model are required' });
  }

  const reset_period = payout_model === 'escalating' ? 'annual' : 'none';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE referral_schedules
       SET name=$1, is_active=$2, payout_model=$3, minimum_invoice=$4, reset_period=$5,
           escalating_steps=$6, tier_brackets=$7, flat_amount=$8, percentage_rate=$9,
           percentage_max_cap=$10, invoice_window_days=$11, updated_at=NOW()
       WHERE id=$12 AND contractor_id=$13
       RETURNING id, name, is_active, payout_model, minimum_invoice, reset_period,
                 escalating_steps, tier_brackets, flat_amount, percentage_rate,
                 percentage_max_cap, invoice_window_days, created_at, updated_at`,
      [
        name, is_active ?? true, payout_model,
        minimum_invoice || null, reset_period,
        escalating_steps ? JSON.stringify(escalating_steps) : null,
        tier_brackets    ? JSON.stringify(tier_brackets)    : null,
        flat_amount      ?? null,
        percentage_rate  ?? null,
        percentage_max_cap ?? null,
        invoice_window_days || 20,
        scheduleId, contractorId,
      ]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = updateResult.rows[0];

    await client.query(
      'DELETE FROM referral_schedule_job_types WHERE schedule_id = $1',
      [scheduleId]
    );

    if (Array.isArray(job_types) && job_types.length > 0) {
      for (const label of job_types) {
        await client.query(
          `INSERT INTO referral_schedule_job_types (schedule_id, contractor_id, jobber_label)
           VALUES ($1, $2, $3) ON CONFLICT (contractor_id, jobber_label) DO UPDATE SET schedule_id = EXCLUDED.schedule_id`,
          [scheduleId, contractorId, label]
        );
      }
    }

    await client.query('COMMIT');

    const jt = await pool.query(
      'SELECT jobber_label FROM referral_schedule_job_types WHERE schedule_id = $1 ORDER BY jobber_label ASC',
      [schedule.id]
    );
    res.json({ ...schedule, job_types: jt.rows.map(r => r.jobber_label) });
  } catch (err) {
    await client.query('ROLLBACK');
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to update schedule' });
  } finally {
    client.release();
  }
});

router.patch('/api/admin/schedules/:id/toggle', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const contractorId = 'accent-roofing';
  const scheduleId = parseInt(req.params.id, 10);
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active must be a boolean' });
  }

  try {
    const result = await pool.query(
      `UPDATE referral_schedules SET is_active=$1, updated_at=NOW()
       WHERE id=$2 AND contractor_id=$3
       RETURNING id, is_active`,
      [is_active, scheduleId, contractorId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Schedule not found' });
    res.json(result.rows[0]);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to toggle schedule' });
  }
});

// ── ADMIN: CAMPAIGNS — AI RAPPORT ────────────────────────────────────────────
const aiRapportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many AI generation requests. Please try again in a minute.' }
});

router.post('/api/admin/campaigns/:id/ai-rapport', aiRapportLimiter, async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI Rapport is not configured' });
  }

  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) return res.status(400).json({ error: 'Invalid campaign ID' });

  const { contacts, messageType, ctaType, contractorName = '', senderName = '', customMessage = '' } = req.body;
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'contacts must be a non-empty array' });
  }
  if (contacts.length > 50) {
    return res.status(400).json({ error: 'contacts array must not exceed 50 items' });
  }

  try {
    const campaignResult = await pool.query(
      'SELECT id, contractor_id, ai_rapport_generations FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [id, 'accent-roofing']
    );
    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = campaignResult.rows[0];
    const currentGenerations = campaign.ai_rapport_generations || 0;

    if (currentGenerations >= 5) {
      return res.status(429).json({
        error: 'Generation limit reached',
        generations_used: 5,
        generations_remaining: 0
      });
    }

    const messageTypeMission = {
      referral_program_invite: "Invite the recipient to join or participate in the referral program. Emphasize appreciation, trust, and the simplicity of referring someone. Make the recipient feel like a valued part of the business's network.",
      reengagement: "Reconnect with the recipient in a warm, low-pressure way. Remind them the business is still active, still available, and still values the relationship. Avoid guilt-based language.",
      seasonal_outreach: "Use the current season as a natural, timely reason to stay top of mind. Keep it helpful and relevant. Do not force a service appointment angle.",
      thank_you_invite: "Lead with genuine gratitude for the recipient's support, business, or trust. Then softly invite them to take the CTA action. Do not sound transactional.",
      write_my_own: "The contractor has written a draft message. Personalize it for this specific recipient using their first name and job type where it fits naturally. Lightly rewrite it for clarity, warmth, and quality while preserving the contractor's voice and intent."
    };

    const ctaGoal = {
      join_app: "Encourage the recipient to join, accept the invite, or get connected through the app. End with a sentence that leads naturally into a 'Join the App' button.",
      website: "Encourage the recipient to visit the website to learn more, view services, or reconnect. End with a sentence that leads naturally into a 'Visit Our Website' button.",
      facebook: "Encourage the recipient to follow or visit the business on Facebook for updates, project photos, tips, or community content. End with a sentence that leads naturally into a 'Visit Us on Facebook' button.",
      google_profile: "Encourage the recipient to view the Google profile, read reviews, or leave honest feedback. End with a sentence that leads naturally into a 'View Our Google Profile' button. Do not pressure for a 5-star review. Do not imply any incentive for leaving a review."
    };

    const previewContact = contacts[0];
    if (!previewContact) {
      return res.status(400).json({ error: 'No contacts provided for preview' });
    }

    const toneInstructions = {
      friendly:     'Write in a warm, approachable, conversational tone. Feel like a neighbor talking to a neighbor.',
      professional: 'Write in a polished, respectful, business-appropriate tone. Confident but not stiff.',
      warm:         'Write with genuine emotional warmth. Lead with appreciation and care.',
      casual:       'Write in a relaxed, natural tone. Like a text from someone you know well.'
    };

    const baseSystemPrompt = `You are an expert email marketing copywriter for a contractor-to-homeowner referral and relationship-building platform.

Your job is to write a short, personalized email message body for a single recipient based on the campaign mission and CTA goal provided.

Rules you must always follow:
- Never mention inspections, free estimates, roof checks, appointments, or "coming out to take a look" unless the contractor's own draft message specifically includes those ideas.
- Always include the business name naturally somewhere in the message.
- Always address the recipient by their first name.
- Reference the recipient's job type naturally and organically where it makes sense — do not force it or make it sound awkward.
- Do not invent specific rewards, dollar amounts, discount offers, or program details that were not provided.
- Do not use hype, urgency, or pressure language.
- Do not write markdown. No asterisks, no headers, no bullet points.
- Do not write multiple versions.
- Do not include a subject line.
- Do not include a CTA button or URL.
- Keep the message under 80 words and between 3 and 5 sentences.
- The final sentence should lead naturally into the CTA button without writing the button itself.

Tone: warm, trustworthy, relationship-focused, clear, and professional but human. Not cheesy. Not overly casual. Not corporate.`;

    const name = (previewContact.name || '').toString().trim().slice(0, 100);
    const jobType = (previewContact.job_type || '').toString().trim().slice(0, 100);
    const customMessageSafe = (customMessage || '').toString().trim().slice(0, 2000);
    const userPrompt = `Generate one email message body for the following recipient.

Recipient first name: ${name}
Recipient job type: ${jobType}
Business name: ${contractorName || 'the business'}
Sender name: ${senderName || ''}

Campaign mission: ${messageTypeMission[messageType] || 'Write a warm, relationship-focused message that feels personal and avoids generic contractor language.'}

CTA goal: ${ctaGoal[ctaType] || 'End with a sentence that leads naturally into the CTA button.'}

${messageType === 'write_my_own' && customMessageSafe ? `The contractor has written this draft message. Use it as the foundation. Personalize it for this recipient, lightly rewrite for quality and warmth, and align the closing sentence to the CTA goal:\n\n"${customMessageSafe}"` : ''}

Output: One email message body only. No subject line. No preview text. No button. No markdown. Under 80 words. 3 to 5 sentences.`;

    async function generateForTone(tone) {
      const systemPrompt = baseSystemPrompt + `\n\nTone instruction: ${toneInstructions[tone]}`;
      try {
        const text = await retryWithBackoff(async () => {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 300,
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }]
            })
          });
          if (!response.ok) {
            const err = new Error(`Anthropic API error: ${response.status}`);
            err.status = response.status;
            throw err;
          }
          const data = await response.json();
          if (!data.content?.[0]?.text) throw new Error('Unexpected Anthropic response shape');
          return data.content[0].text.trim();
        }, { retries: 2, shouldRetry: anthropicShouldRetry });
        return { tone, message: text };
      } catch (err) {
        await logError({ req, error: err });
        return { tone, message: null };
      }
    }

    const tones = ['friendly', 'professional', 'warm', 'casual'];
    const results = await Promise.all(tones.map(tone => generateForTone(tone)));

    const toneVariants = {};
    for (const { tone, message } of results) {
      toneVariants[tone] = message;
    }

    await pool.query(
      'UPDATE campaigns SET ai_rapport_generations = ai_rapport_generations + 1 WHERE id = $1 AND contractor_id = $2',
      [id, 'accent-roofing']
    );

    const newCount = currentGenerations + 1;
    return res.json({
      toneVariants,
      contactName: previewContact.name,
      generations_used: newCount,
      generations_remaining: 5 - newCount
    });
  } catch (err) {
    await logError({ req, error: err });
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/api/admin/campaigns/:id/generate-subject-lines', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI features are not configured' });
  }

  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) return res.status(400).json({ error: 'Invalid campaign ID' });

  const { messageType = '', contractorName = '', senderName = '' } = req.body;

  try {
    const campaignResult = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND contractor_id = $2',
      [id, 'accent-roofing']
    );
    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const systemPrompt = `You are an expert email marketing copywriter for a contractor-to-homeowner referral and relationship platform.

Your job is to generate exactly 3 email subject lines for a campaign message.

Rules you must always follow:
- Every subject line must include the sender's name or business name naturally — not bolted on at the end, but written into the subject line as part of the phrase. For example: "Danny at Accent Roofing wanted to reach out" or "A quick note from Accent Roofing Service"
- Subject lines must be concise — between 6 and 12 words
- Do not use clickbait, hype, urgency, or pressure language
- Do not use emoji
- Do not use ALL CAPS
- Do not number the options
- Do not include quotation marks around the subject lines
- Do not include any explanation or preamble
- Return exactly 3 subject lines, one per line, nothing else`;

    const userPrompt = `Generate 3 email subject lines for the following campaign.

Sender name: ${senderName || 'the sender'}
Business name: ${contractorName || 'the business'}
Message type: ${messageType || 'general outreach'}

Message type guidance:
- referral_program_invite: Subject should hint at an invitation or opportunity to be part of something
- reengagement: Subject should feel like a warm, natural check-in
- seasonal_outreach: Subject should reference staying connected or a timely hello
- thank_you_invite: Subject should lead with appreciation or gratitude
- write_my_own: Subject should be warm and relationship-focused

Output: exactly 3 subject lines, one per line, no numbering, no quotes, no explanation.`;

    let generatedText;
    try {
      generatedText = await retryWithBackoff(async () => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
          })
        });
        if (!response.ok) {
          const err = new Error(`Anthropic API error: ${response.status}`);
          err.status = response.status;
          throw err;
        }
        const data = await response.json();
        if (!data.content?.[0]?.text) throw new Error('Unexpected Anthropic response shape');
        return data.content[0].text.trim();
      }, { retries: 2, shouldRetry: anthropicShouldRetry });
    } catch (err) {
      await logError({ req, error: err });
      return res.status(500).json({ error: 'Failed to generate subject lines' });
    }

    const subjectLines = generatedText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 3);

    return res.json({ subjectLines });
  } catch (err) {
    await logError({ req, error: err });
    return res.status(500).json({ error: 'Failed to generate subject lines' });
  }
});

// ── BATCH CONTACT LIST ────────────────────────────────────────────────────────

router.get('/api/admin/campaigns/:campaignId/batches/:batchNumber/contacts', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const campaignId  = parseInt(req.params.campaignId,  10);
  const batchNumber = parseInt(req.params.batchNumber, 10);
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';

  if (isNaN(campaignId) || isNaN(batchNumber)) {
    return res.status(400).json({ error: 'Invalid campaignId or batchNumber' });
  }

  try {
    const result = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.email,
         c.is_app_user,
         (SELECT csh_e.status
          FROM contact_send_history csh_e
          WHERE csh_e.contact_id = c.id
            AND csh_e.campaign_id = $1
            AND csh_e.batch_number = $2
            AND csh_e.channel = 'email'
          LIMIT 1) AS email_status,
         (SELECT csh_s.status
          FROM contact_send_history csh_s
          WHERE csh_s.contact_id = c.id
            AND csh_s.campaign_id = $1
            AND csh_s.batch_number = $2
            AND csh_s.channel = 'sms'
          LIMIT 1) AS sms_status,
         eoo.opt_out_campaigns,
         eoo.opt_out_sms,
         eoo.opt_out_all,
         eoo.referral_only
       FROM contacts c
       LEFT JOIN email_opt_outs eoo
         ON eoo.email = c.email
         AND eoo.contractor_id = c.contractor_id
       WHERE c.contractor_id = $3
         AND EXISTS (
           SELECT 1 FROM contact_send_history
           WHERE contact_id = c.id
             AND campaign_id = $1
             AND batch_number = $2
             AND contractor_id = $3
         )
       ORDER BY c.name ASC`,
      [campaignId, batchNumber, contractorId]
    );

    const contacts = result.rows.map(row => ({
      id:           row.id,
      name:         row.name,
      email:        row.email,
      is_app_user:  row.is_app_user,
      delivered:    row.email_status === 'sent',
      opened:       false,
      clicked_cta:  false,
      opted_out:    !!(row.opt_out_campaigns || row.opt_out_sms || row.opt_out_all || row.referral_only),
      opt_out_type: deriveOptOutType(row),
      sms_status:   row.sms_status || null,
      suppressed:   row.email_status === 'suppressed',
    }));

    res.json(contacts);
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/campaigns/:campaignId/batches/:batchNumber/contacts' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;














