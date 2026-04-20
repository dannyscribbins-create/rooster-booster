const axios = require('axios');
const { pool } = require('../db');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('./retryWithBackoff');
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

const resendShouldRetry = (error) => {
  const status = error?.response?.status || error?.statusCode;
  if (!status) return true;
  if (status >= 500) return true;
  return false;
};

const twilioShouldRetry = (error) => {
  const code = error?.code;
  if (!code) return true;
  if (String(code).startsWith('2')) return true;
  return false;
};

const jobberShouldRetry = (error) => {
  const status = error?.response?.status;
  if (!status) return true;
  if (status === 401) return false;
  if (status >= 500) return true;
  return false;
};

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
    const companyName = settings.company_name || 'Your contractor';
    const companyPhone = settings.company_phone || '';
    const logoUrl     = settings.logo_url || settings.app_logo_url || null;
    const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${companyName}" style="max-width:180px;height:auto;display:block;margin:0 auto 24px;" />`
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
              ${pendingRecord.referred_by_name}, someone you referred to ${companyName} is moving forward.
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
// TODO: Activate SMS invite after Twilio 10DLC registration is complete (requires LLC + EIN)
async function sendPendingInviteSMS(pendingRecord, contractorId) {
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
    const companyName = settings.company_name || 'Your contractor';
    const logoUrl = settings.logo_url || settings.app_logo_url || null;
    const appUrl = process.env.FRONTEND_URL || 'https://rooster-booster.vercel.app';

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${companyName}" style="max-width:180px;height:auto;display:block;margin:0 auto 24px;" />`
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
              Hi ${referredRecord.referred_name}, someone referred you to ${companyName} —
              and we want to make sure they get the credit (and reward) they deserve.
            </p>
            <p style="color:#444;margin:0 0 24px;line-height:1.6;">
              We believe the person who referred you is <strong>${referredRecord.referred_by_name}</strong>.
              Forward this email to them so they can log in and claim their reward, or simply
              reply to this email with their name and best contact info and we'll take it from there.
            </p>
            <div style="text-align:center;margin:0 0 32px;">
              <a href="${appUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;">
                Forward to ${referredRecord.referred_by_name}
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
              ${companyName}${settings.company_phone ? ' · ' + settings.company_phone : ''}
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

// ── LOOKUP REFERRER IN JOBBER ─────────────────────────────────────────────────
// Searches the contractor's Jobber account for a client whose name matches the
// referrer name from the "Referred by" field.
async function lookupReferrerInJobber(referredByName, contractorId) {
  const tokenResult = await pool.query(
    'SELECT access_token FROM tokens WHERE contractor_id = $1',
    [contractorId]
  );
  const token = tokenResult.rows[0]?.access_token;
  if (!token) {
    console.warn(`[pendingReferral] No access token for contractor ${contractorId} — cannot look up referrer`);
    return { matches: [], token: null };
  }

  const safeName = referredByName.replace(/"/g, '');
  const query = `{
    clients(filter: { name: "${safeName}" }) {
      nodes {
        id
        firstName
        lastName
        phones { number description }
        emails { address description }
      }
    }
  }`;

  const response = await retryWithBackoff(
    () => axios.post(
      'https://api.getjobber.com/api/graphql',
      { query },
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

  const nodes = response.data?.data?.clients?.nodes || [];
  return { matches: nodes, token };
}

// ── CHECK AND CREATE PENDING REFERRAL ─────────────────────────────────────────
// Called from syncSingleClient for every referred client.
// If the referrer has no app account, creates a pending_referrals record then
// looks them up in Jobber by name to find their contact info for the auto-invite.
// No-op if user account already exists or record already pending.
async function checkAndCreatePendingReferral(contractorId, client, referredByName) {
  // Check if referrer already has an account
  const userResult = await pool.query(
    'SELECT id FROM users WHERE LOWER(full_name) = LOWER($1) AND deleted_at IS NULL LIMIT 1',
    [referredByName]
  );
  if (userResult.rows.length > 0) return;

  // Check if a pending record already exists for this client
  const existingResult = await pool.query(
    'SELECT id FROM pending_referrals WHERE contractor_id = $1 AND jobber_client_id = $2',
    [contractorId, client.id]
  );
  if (existingResult.rows.length > 0) return;

  const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim();

  // Insert with null contact info — populated after Jobber lookup below
  const insertResult = await pool.query(
    `INSERT INTO pending_referrals
       (contractor_id, jobber_client_id, client_name, referred_by_name,
        referred_by_phone, referred_by_email, invite_channel,
        invite_sent_at, status)
     VALUES ($1, $2, $3, $4, NULL, NULL, 'none', NULL, 'pending')
     ON CONFLICT (contractor_id, jobber_client_id) DO NOTHING
     RETURNING id, referred_by_name, referred_by_email, referred_by_phone`,
    [contractorId, client.id, clientName, referredByName]
  );

  if (insertResult.rows.length === 0) return; // conflict — already existed

  // ── REFERRER JOBBER LOOKUP ────────────────────────────────────────────────────
  // The referrer is named in the "Referred by" field but their contact info is in
  // their own Jobber client record — not in the referred person's record.
  // Look them up by name to find their phone/email for the auto-invite.
  let inviteChannel = 'none';
  let inviteSentAt = null;

  try {
    const { matches } = await lookupReferrerInJobber(referredByName, contractorId);

    await pool.query(
      'UPDATE pending_referrals SET referrer_lookup_attempted=true WHERE contractor_id=$1 AND jobber_client_id=$2',
      [contractorId, client.id]
    );

    if (matches.length === 1) {
      // Single match — extract contact info and send auto-invite
      const referrerClient = matches[0];
      const referrerPhone = getPrimaryPhone(referrerClient);
      const referrerEmail = getPrimaryEmail(referrerClient);

      await pool.query(
        `UPDATE pending_referrals
         SET referred_by_phone=$1, referred_by_email=$2
         WHERE contractor_id=$3 AND jobber_client_id=$4`,
        [referrerPhone, referrerEmail, contractorId, client.id]
      );

      const pendingResult = await pool.query(
        'SELECT * FROM pending_referrals WHERE contractor_id=$1 AND jobber_client_id=$2',
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
        name: `${m.firstName} ${m.lastName}`.trim(),
        phone: getPrimaryPhone(m),
        email: getPrimaryEmail(m),
      }));

      await pool.query(
        `UPDATE pending_referrals
         SET needs_admin_verification=true, jobber_name_matches=$1
         WHERE contractor_id=$2 AND jobber_client_id=$3`,
        [JSON.stringify(matchData), contractorId, client.id]
      );

      // Send "help us give credit" email to the REFERRED PERSON (we have their
      // contact info from the Jobber client object passed into this function)
      const referredEmail = getPrimaryEmail(client);
      const referredPhone = getPrimaryPhone(client);
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

  await pool.query(
    `INSERT INTO activity_log (event_type, detail) VALUES ('pending_referral_created', $1)`,
    [`Pending referral created for referrer "${referredByName}" (client: "${clientName}"). Channel: ${inviteChannel}`]
  );
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
    const result = await pool.query(
      `SELECT id FROM pending_referrals
       WHERE status = 'pending' AND referred_by_phone = $1
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

// ── MARK MATCH SEEN ───────────────────────────────────────────────────────────
async function markMatchSeen(pendingId) {
  await pool.query(
    'UPDATE pending_referrals SET match_seen_at = NOW() WHERE id = $1',
    [pendingId]
  );
}

module.exports = {
  checkAndCreatePendingReferral,
  matchPendingReferral,
  markMatchSeen,
  sendPendingInviteEmail,
  sendPendingInviteSMS,
  sendCreditAttributionEmail,
};
