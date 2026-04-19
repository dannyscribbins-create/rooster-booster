const { pool } = require('../db');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('./retryWithBackoff');
const { getPrimaryPhone, getPrimaryEmail } = require('../crm/pipelineSync');

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

// ── CHECK AND CREATE PENDING REFERRAL ─────────────────────────────────────────
// Called from syncSingleClient for every referred client.
// If the referrer has no app account, creates a pending_referrals record and
// fires an invite. No-op if user account already exists or record already pending.
async function checkAndCreatePendingReferral(contractorId, client, referredByName) {
  // Check if referrer already has an account
  const userResult = await pool.query(
    'SELECT id FROM users WHERE LOWER(full_name) = LOWER($1) AND deleted_at IS NULL LIMIT 1',
    [referredByName]
  );
  if (userResult.rows.length > 0) return; // referrer has an account — nothing to do

  // Check if a pending record already exists for this client
  const existingResult = await pool.query(
    'SELECT id FROM pending_referrals WHERE contractor_id = $1 AND jobber_client_id = $2',
    [contractorId, client.id]
  );
  if (existingResult.rows.length > 0) return; // already pending — do nothing

  const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim();
  const phone      = getPrimaryPhone(client);
  const email      = getPrimaryEmail(client);

  let inviteChannel = 'none';
  if (email && phone) inviteChannel = 'email_and_sms';
  else if (email)     inviteChannel = 'email';
  else if (phone)     inviteChannel = 'sms';

  const insertResult = await pool.query(
    `INSERT INTO pending_referrals
       (contractor_id, jobber_client_id, client_name, referred_by_name,
        referred_by_phone, referred_by_email, invite_channel,
        invite_sent_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     ON CONFLICT (contractor_id, jobber_client_id) DO NOTHING
     RETURNING id, referred_by_name, referred_by_email, referred_by_phone`,
    [
      contractorId,
      client.id,
      clientName,
      referredByName,
      phone,
      email,
      inviteChannel,
      inviteChannel !== 'none' ? new Date() : null,
    ]
  );

  if (insertResult.rows.length === 0) return; // conflict — already existed

  const pendingRecord = insertResult.rows[0];

  // Send invites (failures are caught inside each function — never propagated)
  if (email) await sendPendingInviteEmail(pendingRecord, contractorId);
  if (phone) await sendPendingInviteSMS(pendingRecord, contractorId);

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

module.exports = { checkAndCreatePendingReferral, matchPendingReferral, markMatchSeen, sendPendingInviteEmail, sendPendingInviteSMS };
