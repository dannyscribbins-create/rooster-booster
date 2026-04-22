const axios = require('axios');
const { pool } = require('../db');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('./retryWithBackoff');
const { resendShouldRetry, twilioShouldRetry, jobberShouldRetry } = require('./retryHelpers');
function escapeHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPrimaryPhone(client) {
  const phones = client.phones || [];
  if (phones.length === 0) return null;
  const primary = phones.find(p =>
    p.description?.toLowerCase().includes('main') ||
    p.description?.toLowerCase().includes('mobile')
  ) || phones[0];
  return primary?.number || null;
}

function getPrimaryEmail(client) {
  const emails = client.emails || [];
  if (emails.length === 0) return null;
  return emails[0]?.address || null;
}

function getTwilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  return require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

// ── SEND PENDING INVITE EMAIL ─────────────────────────────────────────────────
// Sends an invite email to the referrer's email address.
// Failure is logged but never thrown — a failed invite must never crash the sync.
async function sendPendingInviteEmail(pendingRecord, contractorId) {
  try {
    const settingsResult = await pool.query(
      'SELECT company_name, company_phone, logo_url, app_logo_url FROM contractor_settings WHERE contractor_id = $1',
      [contractorId]
    );
    const settings    = settingsResult.rows[0] || {};
    const companyName = escapeHtml(settings.company_name || 'Your contractor');
    const companyPhone = escapeHtml(settings.company_phone || '');
    const logoUrl     = settings.logo_url || settings.app_logo_url || null;
    const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
    const safeLogoUrl = escapeHtml(logoUrl || '');
    const safeReferrerName = escapeHtml(pendingRecord.referred_by_name || '');

    const logoHtml = logoUrl
      ? `<img src="${safeLogoUrl}" alt="${companyName}" style="max-width:180px;height:auto;display:block;margin:0 auto 24px;" />`
      : '';

    // TODO: Update CTA link to App Store URL after Capacitor build.
    // TODO: Update email copy after brand review.
    // TODO: Embed contractor logo for improved brand trust.
    await retryWithBackoff(
      () => resend.emails.send({
        from: 'Rooster Booster <noreply@roofmiles.com>',
        to: pendingRecord.referred_by_email,
        subject: `${companyName} — You have a reward waiting`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
            ${logoHtml}
            <h2 style="color:#012854;margin:0 0 12px;font-size:22px;">You have a referral reward waiting</h2>
            <p style="color:#444;margin:0 0 24px;line-height:1.6;font-size:15px;">
              ${safeReferrerName}, someone you referred to ${companyName} is moving forward.
              You've earned a reward — create your account to claim it.
            </p>
            <div style="text-align:center;margin-bottom:24px;">
              <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;font-family:sans-serif;">
                Claim Your Reward
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
            <p style="color:#999;font-size:12px;margin:0;line-height:1.6;">
              ${companyName}${companyPhone ? ' · ' + companyPhone : ''}<br/>
              You're receiving this because someone listed you as a referral source.
            </p>
          </div>
        `,
      }),
      { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
    );
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] invite email failed:', err.message);
  }
}

// ── SEND PENDING INVITE SMS ───────────────────────────────────────────────────
// Sends an invite SMS to the referrer's phone number.
// Failure is logged but never thrown — a failed invite must never crash the sync.
// Gated on TWILIO_10DLC_ACTIVE=true — flip this in Railway after 10DLC approval.
async function sendPendingInviteSMS(pendingRecord, contractorId) {
  if (process.env.NODE_ENV !== 'production' || process.env.TWILIO_10DLC_ACTIVE !== 'true') {
    console.warn('[pendingReferral] SMS invite skipped — 10DLC not yet active');
    return;
  }
  try {
    const settingsResult = await pool.query(
      'SELECT company_name FROM contractor_settings WHERE contractor_id = $1',
      [contractorId]
    );
    const companyName = settingsResult.rows[0]?.company_name || 'Your contractor';
    const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';

    const twilio = getTwilioClient();
    if (!twilio) {
      console.warn('[pendingReferral] Twilio not configured — skipping SMS invite');
      return;
    }

    await retryWithBackoff(
      () => twilio.messages.create({
        body: `Hi, ${companyName} here — ${pendingRecord.referred_by_name}, you have a referral reward waiting. Create your account to claim it: ${frontendUrl}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: pendingRecord.referred_by_phone,
      }),
      { retries: 2, initialDelayMs: 1000, shouldRetry: twilioShouldRetry }
    );
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] invite SMS failed:', err.message);
  }
}

// ── SEND CREDIT ATTRIBUTION EMAIL ────────────────────────────────────────────
// Sent to the REFERRED PERSON when the referrer cannot be uniquely identified.
// Asks them to forward to the referrer so they can claim their reward.
async function sendCreditAttributionEmail(referredRecord, contractorId) {
  try {
    if (!referredRecord.referred_email) return;

    const settingsResult = await pool.query(
      'SELECT company_name, company_phone, logo_url, app_logo_url FROM contractor_settings WHERE contractor_id=$1',
      [contractorId]
    );
    const settings = settingsResult.rows[0] || {};
    const companyName = escapeHtml(settings.company_name || 'Your contractor');
    const companyPhone = escapeHtml(settings.company_phone || '');
    const logoUrl = settings.logo_url || settings.app_logo_url || null;
    const safeLogoUrl = escapeHtml(logoUrl || '');
    const appUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
    const safeReferredName = escapeHtml(referredRecord.referred_name || '');
    const safeReferrerName = escapeHtml(referredRecord.referred_by_name || '');

    const logoHtml = logoUrl
      ? `<img src="${safeLogoUrl}" alt="${companyName}" style="max-width:180px;height:auto;display:block;margin:0 auto 24px;" />`
      : '';

    await retryWithBackoff(
      () => resend.emails.send({
        from: `${companyName} <noreply@roofmiles.com>`,
        to: referredRecord.referred_email,
        subject: `Help us give credit where it's due — ${companyName}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
            ${logoHtml}
            <h2 style="color:#012854;margin:0 0 16px;font-size:22px;">Help us give credit where it's due</h2>
            <p style="color:#444;margin:0 0 16px;line-height:1.6;">
              Hi ${safeReferredName}, someone referred you to ${companyName} —
              and we want to make sure they get the credit (and reward) they deserve.
            </p>
            <p style="color:#444;margin:0 0 24px;line-height:1.6;">
              We believe the person who referred you is <strong>${safeReferrerName}</strong>.
              Forward this email to them so they can log in and claim their reward, or simply
              reply to this email with their name and best contact info and we'll take it from there.
            </p>
            <div style="text-align:center;margin:0 0 32px;">
              <a href="${appUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
                Forward to ${safeReferrerName}
              </a>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px;" />
            <p style="color:#666;margin:0 0 12px;line-height:1.6;font-size:14px;">
              <strong>While you're at it —</strong> did you know you can earn rewards
              for referring friends and neighbors to ${companyName} too?
            </p>
            <div style="text-align:center;margin:0 0 24px;">
              <a href="${appUrl}" style="display:inline-block;background:#fff;color:#012854;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;border:2px solid #012854;">
                Check Out the Rewards App
              </a>
            </div>
            <p style="color:#aaa;font-size:12px;margin:0;text-align:center;">
              ${companyName}${companyPhone ? ' · ' + companyPhone : ''}
              <br/>You're receiving this because you were recently referred to us.
              Reply to this email at any time.
            </p>
          </div>
        `,
        // TODO: Update CTA links to App Store URLs after Capacitor build.
        // TODO: Update email copy after brand review session.
        // TODO: Embed contractor logo for improved brand trust when logo_url is available.
      }),
      { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
    );

    await pool.query(
      `UPDATE pending_referrals SET credit_email_sent_at=NOW()
       WHERE contractor_id=$1 AND jobber_client_id=$2`,
      [contractorId, referredRecord.jobber_client_id]
    );

    console.log(`[pendingReferral] Credit attribution email sent to ${referredRecord.referred_email}`);
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] sendCreditAttributionEmail failed:', err.message);
  }
}

// ── FETCH REFERRER CONTACT ────────────────────────────────────────────────────
// Targeted single-client Jobber query to get phones and emails for a known client ID.
// Called only after a single name match — one API call, not a bulk fetch.
async function fetchReferrerContact(jobberId, contractorId) {
  const tokenResult = await pool.query(
    'SELECT access_token FROM tokens WHERE contractor_id = $1',
    [contractorId]
  );
  const token = tokenResult.rows[0]?.access_token;
  if (!token) return { phone: null, email: null };

  try {
    const response = await retryWithBackoff(
      () => axios.post(
        'https://api.getjobber.com/api/graphql',
        {
          query: `query GetReferrerContact($id: EncodedId!) {
            client(id: $id) {
              phones { number description }
              emails { address description }
            }
          }`,
          variables: { id: jobberId },
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
    const c = response.data?.data?.client;
    if (!c) return { phone: null, email: null };
    return { phone: getPrimaryPhone(c), email: getPrimaryEmail(c) };
  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] fetchReferrerContact failed:', err.message);
    return { phone: null, email: null };
  }
}

// ── CHECK AND CREATE PENDING REFERRAL ─────────────────────────────────────────
// Called from syncSingleClient for every referred client.
// If the referrer has no app account, creates a pending_referrals record then
// looks them up in Jobber by name to find their contact info for the auto-invite.
// No-op if user account already exists or record already processed.
//
// MVP: webhook path calls this with allClients=[] because the full client list is
// not available per-request. When allClients=[] the name match always fails and the
// record is flagged needs_admin_verification=true. The next scheduled full sync
// (which has allClients populated) will re-attempt the name match for those records
// via the isRetry path below.
async function checkAndCreatePendingReferral(contractorId, client, referredByName, allClients = []) {
  // Check if referrer already has an account
  const userResult = await pool.query(
    'SELECT id FROM users WHERE LOWER(full_name) = LOWER($1) AND deleted_at IS NULL LIMIT 1',
    [referredByName]
  );
  if (userResult.rows.length > 0) return;

  const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim();

  // Check if a pending record already exists for this client
  const existingResult = await pool.query(
    `SELECT id, needs_admin_verification, invite_channel, status
     FROM pending_referrals WHERE contractor_id = $1 AND jobber_client_id = $2`,
    [contractorId, client.id]
  );

  // Allow re-processing only if the record was flagged for admin verification with no
  // invite sent and we now have a real client list. This repairs webhook-created records
  // on the next scheduled full sync.
  let isRetry = false;
  if (existingResult.rows.length > 0) {
    const rec = existingResult.rows[0];
    if (
      rec.needs_admin_verification &&
      rec.invite_channel === 'none' &&
      rec.status === 'pending' &&
      allClients.length > 0
    ) {
      isRetry = true;
    } else {
      return;
    }
  }

  if (!isRetry) {
    // Insert with null contact info — populated after Jobber lookup below
    const insertResult = await pool.query(
      `INSERT INTO pending_referrals
         (contractor_id, jobber_client_id, client_name, referred_by_name,
          referred_by_phone, referred_by_email, invite_channel,
          invite_sent_at, status)
       VALUES ($1, $2, $3, $4, NULL, NULL, 'none', NULL, 'pending')
       ON CONFLICT (contractor_id, jobber_client_id) DO NOTHING
       RETURNING id`,
      [contractorId, client.id, clientName, referredByName]
    );

    if (insertResult.rows.length === 0) return; // conflict — already existed
  }

  // ── REFERRER JOBBER LOOKUP ────────────────────────────────────────────────────
  // The referrer is named in the "Referred by" field but their contact info is in
  // their own Jobber client record — not in the referred person's record.
  // Look them up by name to find their phone/email for the auto-invite.
  // Jobber ClientFilterAttributes does not support name filtering — confirmed in
  // GraphiQL. Local matching against allClients is the correct approach.
  let inviteChannel = 'none';
  let inviteSentAt = null;

  try {
    const normalizedReferrerName = referredByName.trim().toLowerCase();

    const matches = allClients.filter(c => {
      const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim().toLowerCase();
      const reverseName = `${c.lastName || ''} ${c.firstName || ''}`.trim().toLowerCase();
      return fullName === normalizedReferrerName || reverseName === normalizedReferrerName;
    });

    await pool.query(
      'UPDATE pending_referrals SET referrer_lookup_attempted=true WHERE contractor_id=$1 AND jobber_client_id=$2',
      [contractorId, client.id]
    );

    if (matches.length === 1) {
      // Single match — fetch contact info via targeted Jobber query (bulk sync omits phones/emails)
      const { phone: referrerPhone, email: referrerEmail } = await fetchReferrerContact(matches[0].id, contractorId);

      await pool.query(
        `UPDATE pending_referrals
         SET referred_by_phone=$1, referred_by_email=$2, needs_admin_verification=false
         WHERE contractor_id=$3 AND jobber_client_id=$4`,
        [referrerPhone, referrerEmail, contractorId, client.id]
      );

      const pendingResult = await pool.query(
        `SELECT id, referred_by_name, referred_by_email, referred_by_phone
         FROM pending_referrals WHERE contractor_id=$1 AND jobber_client_id=$2`,
        [contractorId, client.id]
      );
      const pendingRecord = pendingResult.rows[0];

      if (referrerEmail) {
        await sendPendingInviteEmail(pendingRecord, contractorId);
        inviteChannel = referrerPhone ? 'email_and_sms' : 'email';
      }
      if (referrerPhone) {
        await sendPendingInviteSMS(pendingRecord, contractorId);
        if (inviteChannel === 'email') inviteChannel = 'email_and_sms';
        else if (inviteChannel === 'none') inviteChannel = 'sms';
      }
      if (inviteChannel !== 'none') inviteSentAt = new Date();

    } else {
      // No match or multiple matches — flag for admin verification
      const matchData = matches.map(m => ({
        id: m.id,
        name: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
      }));

      await pool.query(
        `UPDATE pending_referrals
         SET needs_admin_verification=true, jobber_name_matches=$1
         WHERE contractor_id=$2 AND jobber_client_id=$3`,
        [JSON.stringify(matchData), contractorId, client.id]
      );

      // Send "help us give credit" email to the REFERRED PERSON only on first creation.
      // On retry, the referred client already received this email — do not resend.
      if (!isRetry) {
        const referredEmail = getPrimaryEmail(client);
        const referredPhone = getPrimaryPhone(client);
        // diagnostic log — intentional
        console.log('[pendingReferral] credit attribution — referred email:', referredEmail, 'referred phone:', referredPhone);
        if (referredEmail || referredPhone) {
          await sendCreditAttributionEmail(
            {
              referred_name: clientName,
              referred_email: referredEmail,
              referred_phone: referredPhone,
              referred_by_name: referredByName,
              client_name: clientName,
              jobber_client_id: client.id,
            },
            contractorId
          );
          // diagnostic log — intentional
          console.log('[pendingReferral] credit attribution email sent to:', referredEmail);
        } else {
          // diagnostic log — intentional
          console.warn('[pendingReferral] credit attribution skipped — no contact info found for referred client:', clientName);
        }
      }

      const reason = matches.length === 0 ? 'no_jobber_match' : 'multiple_jobber_matches';
      console.warn(`[pendingReferral] Admin verification required for ${referredByName} — ${reason}`);
    }

    await pool.query(
      `UPDATE pending_referrals
       SET invite_channel=$1, invite_sent_at=$2
       WHERE contractor_id=$3 AND jobber_client_id=$4`,
      [inviteChannel, inviteSentAt, contractorId, client.id]
    );

  } catch (err) {
    await logError({ req: null, error: err });
    console.error('[pendingReferral] referrer lookup failed:', err.message);
  }

  try {
    await pool.query(
      `INSERT INTO activity_log (event_type, detail) VALUES ('pending_referral_created', $1)`,
      [`Pending referral ${isRetry ? 'retry' : 'created'} for referrer "${referredByName}" (client: "${clientName}"). Channel: ${inviteChannel}`]
    );
  } catch (logErr) {
    await logError({ req: null, error: logErr });
    console.warn('[pendingReferral] activity_log insert failed:', logErr.message);
  }
}

// ── MATCH PENDING REFERRAL ────────────────────────────────────────────────────
// Called after email verification to link a new user to any pending referral record.
// Matches on email (case-insensitive) or phone. Returns matched record or null.
async function matchPendingReferral(userId, email, phone) {
  let match = null;

  if (email) {
    const result = await pool.query(
      `SELECT id FROM pending_referrals
       WHERE status = 'pending' AND LOWER(referred_by_email) = LOWER($1)
       LIMIT 1`,
      [email]
    );
    if (result.rows.length > 0) match = result.rows[0];
  }

  if (!match && phone) {
    // Normalize both sides to digits-only to handle format differences between
    // Jobber-stored numbers (e.g. "+1 (555) 999-5555") and signup-entered numbers.
    const result = await pool.query(
      `SELECT id FROM pending_referrals
       WHERE status = 'pending'
         AND REGEXP_REPLACE(referred_by_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE($1, '[^0-9]', '', 'g')
       LIMIT 1`,
      [phone]
    );
    if (result.rows.length > 0) match = result.rows[0];
  }

  if (!match) return null;

  await pool.query(
    `UPDATE pending_referrals
     SET matched_user_id = $1, matched_at = NOW(), status = 'matched'
     WHERE id = $2`,
    [userId, match.id]
  );

  return match;
}

module.exports = {
  checkAndCreatePendingReferral,
  matchPendingReferral,
  sendPendingInviteEmail,
  sendPendingInviteSMS,
  sendCreditAttributionEmail,
};
