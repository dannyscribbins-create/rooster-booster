const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getCRMAdapter } = require('../crm/index');
const { refreshTokenIfNeeded } = require('../crm/jobber'); // still used for background Jobber client-match at signup
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const axios = require('axios');

const referrerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const forgotPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many reset requests. Please try again in 15 minutes.' }
});

const resetPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please request a new reset link.' }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many signup attempts. Please try again in an hour.' }
});

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification attempts. Please wait 15 minutes.' }
});

// ── WARMUP ENTRIES ────────────────────────────────────────────────────────────
// Must stay in sync with src/constants/shouts.js WARMUP_ENTRIES.
// Kept server-side to avoid a runtime import of an ES module from CommonJS.
const WARMUP_ENTRIES_SERVER = [
  { id: "warmup_1",  firstName: "Nail",     lastName: "Armstrong", referralCount: 14, earnings: 11600, shout: "I nailed it." },
  { id: "warmup_2",  firstName: "Galvan",   lastName: "Ized",      referralCount: 11, earnings: 8900,  shout: "Fully charged. ⚡" },
  { id: "warmup_3",  firstName: "Paige",    lastName: "Turner",    referralCount: 9,  earnings: 7300,  shout: "On to the next chapter." },
  { id: "warmup_4",  firstName: "Flash",    lastName: "Feltman",   referralCount: 8,  earnings: 6400,  shout: "Blink and you'll miss me." },
  { id: "warmup_5",  firstName: "Roger",    lastName: "Ringshank", referralCount: 7,  earnings: 5500,  shout: "Roger that. 🫡" },
  { id: "warmup_6",  firstName: "Grant",    lastName: "Gable",     referralCount: 6,  earnings: 4600,  shout: "It's a great day to refer." },
  { id: "warmup_7",  firstName: "Victor",   lastName: "Valley",    referralCount: 5,  earnings: 3500,  shout: "Victory is the only option." },
  { id: "warmup_8",  firstName: "Pete",     lastName: "Pitch",     referralCount: 4,  earnings: 2600,  shout: "Always closing." },
  { id: "warmup_9",  firstName: "Ridgeard", lastName: "Runner",    referralCount: 3,  earnings: 1800,  shout: "Keep running those referrals." },
  { id: "warmup_10", firstName: "Tarence",  lastName: "Tack",      referralCount: 2,  earnings: 1100,  shout: "Staying sharp." },
];

// MVP: move to env var (CONTRACTOR_NAME) or DB lookup for multi-contractor support at FORA scale
const CONTRACTOR_NAME = 'Accent Roofing Service';

// ── BADGE AWARD HELPER ────────────────────────────────────────────────────────
// Called after every pipeline sync. Checks pipeline_sync-triggered badges and
// inserts any newly qualifying ones. Returns array of newly awarded badge ids
// so the caller can surface the celebration popup.
async function checkAndAwardBadges(userId, totalReferralCount) {
  const existing = await pool.query(
    'SELECT badge_id FROM user_badges WHERE user_id=$1',
    [userId]
  );
  const earned = new Set(existing.rows.map(r => r.badge_id));

  const candidates = [
    { id: 'first_referral', qualifies: totalReferralCount >= 1 },
    { id: 'milestone_5',    qualifies: totalReferralCount >= 5  },
    { id: 'milestone_10',   qualifies: totalReferralCount >= 10 },
    { id: 'milestone_25',   qualifies: totalReferralCount >= 25 },
    // MVP shortcut: full trigger via Jobber webhook in Stripe ACH session
    // { id: 'client_badge', qualifies: ... },
    // MVP shortcut: full trigger via Jobber webhook in Stripe ACH session
    // { id: 'yearly_winner', qualifies: ... },
  ];

  const newlyAwarded = [];
  for (const { id, qualifies } of candidates) {
    if (qualifies && !earned.has(id)) {
      await pool.query(
        `INSERT INTO user_badges (user_id, badge_id, seen)
         VALUES ($1, $2, false)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [userId, id]
      );
      newlyAwarded.push(id);
    }
  }
  return newlyAwarded;
}

// ── SELF-SERVE SIGNUP: INVITE LINK VALIDATION ─────────────────────────────────
router.get('/api/invite/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT contractor_id, link_type FROM contractor_invite_links
       WHERE slug=$1 AND active=true`,
      [req.params.slug]
    );
    if (result.rows.length === 0) return res.json({ valid: false });
    const { contractor_id, link_type } = result.rows[0];
    res.json({ valid: true, contractorName: CONTRACTOR_NAME, contractorId: contractor_id, linkType: link_type });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SELF-SERVE SIGNUP: CREATE ACCOUNT ─────────────────────────────────────────
router.post('/api/signup', signupLimiter, async (req, res) => {
  const { firstName, lastName, phone, email, password, inviteSlug } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !phone || !email || !password || !inviteSlug) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
  const phoneRe = /^[\d\s\-\+\(\)]{7,}$/;
  if (!phoneRe.test(phone)) return res.status(400).json({ error: 'Invalid phone number.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    // Check invite link
    const linkResult = await pool.query(
      `SELECT id, contractor_id, link_type, created_by_user_id
       FROM contractor_invite_links WHERE slug=$1 AND active=true`,
      [inviteSlug]
    );
    if (linkResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invite link.' });
    }
    const link = linkResult.rows[0];

    // Check for duplicate email
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const full_name = `${firstName.trim()} ${lastName.trim()}`;
    const hashedPassword = await bcrypt.hash(String(password), 10);
    const signupSource = link.link_type === 'peer' ? 'peer_link' : 'contractor_link';
    const invitedByUserId = link.link_type === 'peer' ? link.created_by_user_id : null;

    // Create user (email_verified = false)
    const userResult = await pool.query(
      `INSERT INTO users (full_name, email, pin, phone, invite_slug, invited_by_user_id, signup_source, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING id`,
      [full_name, email, hashedPassword, phone || null, inviteSlug, invitedByUserId, signupSource]
    );
    const newUserId = userResult.rows[0].id;

    // Generate 6-digit verification code
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      `INSERT INTO email_verifications (user_id, code, expires_at) VALUES ($1, $2, $3)`,
      [newUserId, code, expiresAt]
    );

    // Send verification email via Resend
    await resend.emails.send({
      from: 'Rooster Booster <noreply@roofmiles.com>',
      to: email,
      subject: `Your ${CONTRACTOR_NAME} rewards account — verify your email`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="color:#012854;margin:0 0 8px;">Welcome to ${CONTRACTOR_NAME}'s rewards program!</h2>
          <p style="color:#444;margin:0 0 24px;line-height:1.6;">
            You're almost in. Enter the verification code below to activate your account.
          </p>
          <div style="background:#f5f8ff;border:2px solid #D3E3F0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#666;letter-spacing:0.05em;text-transform:uppercase;">Your verification code</p>
            <p style="margin:0;font-size:40px;font-weight:700;color:#012854;letter-spacing:0.15em;font-family:monospace;">${code}</p>
          </div>
          <p style="color:#888;font-size:13px;margin:0;">This code expires in 1 hour. If you didn't create this account, you can ignore this email.</p>
        </div>
      `,
    });

    // MVP: Award founding_referrer badge if within first 20 users.
    // Counts all users (no contractor filter) to match admin.js logic.
    // At FORA scale, scope this count per contractor_id so each contractor
    // gets their own founding cohort of 20.
    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
    if (parseInt(countResult.rows[0].total) <= 20) {
      await pool.query(
        `INSERT INTO user_badges (user_id, badge_id, seen)
         VALUES ($1, 'founding_referrer', false)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [newUserId]
      );
    }

    // BACKGROUND: Jobber client lookup by phone or email.
    // Do not await — never blocks the signup response.
    // MVP: This is a one-time lookup at signup. Full solution is a Jobber webhook that fires
    // on client creation and runs this match automatically. Build in Stripe ACH / webhook session.
    (async () => {
      try {
        await refreshTokenIfNeeded();
        const tokenRes = await pool.query('SELECT access_token FROM tokens WHERE id = 1');
        if (!tokenRes.rows[0]?.access_token) return;
        const jobberToken = tokenRes.rows[0].access_token;

        const gqlResponse = await axios.post(
          'https://api.getjobber.com/api/graphql',
          // MVP: fetches only first 100 Jobber clients — no pagination. At scale, use Jobber webhook (Stripe ACH session).
          { query: `{ clients(first:100) { nodes { id phoneNumbers { number } emails { address } } } }` },
          { headers: { Authorization: `Bearer ${jobberToken}`, 'Content-Type': 'application/json', 'X-JOBBER-GRAPHQL-VERSION': '2026-02-17' } }
        );

        const clients = gqlResponse.data.data?.clients?.nodes || [];
        const cleanPhone = phone.replace(/\D/g, '');
        const match = clients.find(c =>
          c.phoneNumbers?.some(p => p.number.replace(/\D/g, '') === cleanPhone) ||
          c.emails?.some(e => e.address.toLowerCase() === email.toLowerCase())
        );

        if (match) {
          await pool.query('UPDATE users SET jobber_client_id=$1 WHERE id=$2', [match.id, newUserId]);
          await pool.query(
            `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('signup', $1, $2, $3)`,
            [full_name, email, `Jobber client match found at signup: ${match.id}`]
          );
        } else {
          await pool.query(
            `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('signup', $1, $2, $3)`,
            [full_name, email, 'No Jobber client match found at signup — expected for peer signups']
          );
        }
      } catch (err) {
        console.error('Background Jobber match failed for signup:', err.message);
      }
    })();

    res.status(201).json({ message: 'Account created. Check your email for a verification code.', userId: newUserId });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed: ' + err.message });
  }
});

// ── SELF-SERVE SIGNUP: VERIFY EMAIL ───────────────────────────────────────────
router.post('/api/signup/verify-email', verifyEmailLimiter, async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return res.status(400).json({ error: 'Missing userId or code.' });
  try {
    const result = await pool.query(
      `SELECT id FROM email_verifications
       WHERE user_id=$1 AND code=$2 AND used_at IS NULL AND expires_at > NOW()`,
      [userId, String(code)]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });
    }
    const verificationId = result.rows[0].id;
    await pool.query('UPDATE email_verifications SET used_at=NOW() WHERE id=$1', [verificationId]);
    await pool.query('UPDATE users SET email_verified=true WHERE id=$1', [userId]);

    const userResult = await pool.query('SELECT full_name, email FROM users WHERE id=$1', [userId]);
    if (userResult.rows.length > 0) {
      const { full_name, email } = userResult.rows[0];
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('signup', $1, $2, $3)`,
        [full_name, email, 'Email verified for new signup']
      );
    }

    res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
});

// ── REFERRER: PIPELINE ────────────────────────────────────────────────────────
router.get('/api/pipeline', async (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authorized' });
    const sessionResult = await pool.query(
      'SELECT * FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;
    // TODO: pull contractorId from referrer session token when multi-contractor is live
    const contractorId = 'accent-roofing';
    const adapter = await getCRMAdapter(contractorId);
    const data = await adapter.fetchPipelineForReferrer(req.query.referrer);
    // MVP: update this to cron-based sync at scale
    await pool.query(
      'UPDATE users SET paid_count=$1, paid_count_updated_at=NOW() WHERE id=$2',
      [data.paidCount, userId]
    );

    // BUSINESS RULE: one conversion per referred client, ever. A returning client does not
    // generate a second bonus for the original referrer. The UNIQUE constraint on
    // (user_id, jobber_client_id) enforces this automatically — duplicate inserts are silently ignored.
    //
    // SCALABLE: currently conversions are recorded when a referrer loads their pipeline.
    // The production-grade version is a Jobber webhook that fires the moment an invoice
    // is marked paid in Jobber — writes the conversion row, triggers Stripe ACH payout,
    // updates balance, and fires a push notification immediately. Build this during the
    // Stripe ACH session. Until then Danny should periodically view referrers in the admin
    // panel near period end dates to ensure all syncs are current before prize decisions are made.
    for (const item of data.pipeline) {
      // Hard gate: pre-start-date referrals never earn bonuses, regardless of pipeline_status.
      // This is enforced at sync time (pre_start_date=true in pipeline_cache) and here as a
      // double-check before writing to referral_conversions.
      if (item.pre_start_date) {
        console.log(`[pipeline] Skipping pre-start-date referral: ${item.name} (contractor: ${contractorId || 'unknown'})`);
        continue;
      }
      if (!item.bonusEarned) continue;
      // bonus_amount stored at sync time — source of truth for all period-filtered earnings queries.
      // Full real-time accuracy requires Jobber webhook (Stripe ACH session).
      await pool.query(
        `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, converted_at, bonus_amount)
         VALUES ($1, $2, $3, NOW(), $4)
         ON CONFLICT (user_id, jobber_client_id) DO NOTHING`,
        [userId, 'accent-roofing', item.id, item.payout]
      );
    }

    await checkAndAwardBadges(userId, data.pipeline.length);

    res.json(data);
  } catch (err) {
    if (err.message && (err.message.includes('No CRM connected') || err.message.includes('No connected CRM'))) {
      return res.status(503).json({ error: 'crm_not_connected', message: 'No CRM is connected for this contractor. Please connect a CRM in admin settings.' });
    }
    console.error('CRM fetch error:', err);
    res.status(500).send('API call failed: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
  }
});

// ── REFERRER: LOGIN ───────────────────────────────────────────────────────────
router.post('/api/login', referrerLoginLimiter, async (req, res) => {
  const { email, pin } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or PIN' });
    const user = result.rows[0];
    const match = await bcrypt.compare(String(pin), user.pin);
    if (!match) return res.status(401).json({ error: 'Invalid email or PIN' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const deviceInfo = req.headers['user-agent'] || null;
    const ipAddress = req.ip || null;
    const sessionResult = await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at, device_info, ip_address) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [user.id, token, expiresAt, deviceInfo, ipAddress]
    );
    const sessionId = sessionResult.rows[0].id;

    // Async geo-lookup — do not await, never blocks login response
    if (ipAddress) {
      (async () => {
        try {
          const geoRes = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=city,country`, { timeout: 3000 });
          if (geoRes.data && geoRes.data.city) {
            await pool.query(
              'UPDATE sessions SET city=$1, country=$2 WHERE id=$3',
              [geoRes.data.city || null, geoRes.data.country || null, sessionId]
            );
          }
        } catch (_) { /* non-critical */ }
      })();
    }
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('login',$1,$2,$3)`,
      [user.full_name, user.email, 'Logged in']
    );

    // Increment login_count and read back updated values in one round-trip
    const updatedUser = await pool.query(
      'UPDATE users SET login_count = login_count + 1 WHERE id = $1 RETURNING login_count, review_dismissed_login',
      [user.id]
    );
    const { login_count, review_dismissed_login } = updatedUser.rows[0];

    // showReviewCard: true if never dismissed OR 5+ logins since dismissal
    const showReviewCard = review_dismissed_login === null || (login_count - review_dismissed_login) >= 5;

    // Check for unseen payout announcement
    const announcementResult = await pool.query(
      `SELECT pa.id, cr.amount, cr.full_name as referred_name
       FROM payout_announcements pa
       JOIN cashout_requests cr ON cr.id = pa.cashout_request_id
       WHERE pa.user_id = $1 AND pa.seen_at IS NULL
       LIMIT 1`,
      [user.id]
    );
    const announcement = announcementResult.rows.length > 0
      ? { id: announcementResult.rows[0].id, amount: announcementResult.rows[0].amount, referredName: announcementResult.rows[0].referred_name }
      : null;

    // Fetch announcement settings for popup rendering
    const settingsResult = await pool.query('SELECT enabled, mode, custom_message FROM announcement_settings WHERE id = 1');
    const announcementSettings = settingsResult.rows[0] || { enabled: true, mode: 'preset_1', custom_message: null };

    res.json({ success: true, fullName: user.full_name, email: user.email, phone: user.phone || null, token, showReviewCard, announcement, announcementSettings });
  } catch (err) { res.status(500).json({ error: 'Login failed: ' + err.message }); }
});

// ── REFERRER: CASH OUT ────────────────────────────────────────────────────────
router.post('/api/cashout', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  const sessionResult = await pool.query(
    'SELECT * FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
    [token, 'referrer']
  );
  if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
  const { user_id, full_name, email, amount, method } = req.body;
  if (parseFloat(amount) < 20) {
    return res.status(400).json({ error: 'Minimum cashout amount is $20' });
  }
  try {
    await pool.query(
      `INSERT INTO cashout_requests (user_id,full_name,email,amount,method,status,requested_at)
       VALUES ($1,$2,$3,$4,$5,'pending',NOW())`,
      [user_id, full_name, email, amount, method || null]
    );
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('cashout',$1,$2,$3)`,
      [full_name, email, `Requested $${amount} via ${method || 'unknown'}`]
    );
    await resend.emails.send({
      from: 'Rooster Booster <noreply@roofmiles.com>', to: process.env.RESEND_TO_EMAIL,
      subject: 'New Cash Out Request - Rooster Booster',
      html: `<h2>New Cash Out Request</h2><p><strong>Name:</strong> ${full_name}</p>
             <p><strong>Email:</strong> ${email}</p><p><strong>Amount:</strong> $${amount}</p>
             <p><strong>Method:</strong> ${method || 'Not specified'}</p>
             <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>`
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to save cash out request' }); }
});

// ── REFERRER: GET PROFILE PHOTO ───────────────────────────────────────────────
router.get('/api/profile/photo', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;
    const result = await pool.query('SELECT profile_photo FROM users WHERE id=$1', [userId]);
    res.json({ photo: result.rows[0]?.profile_photo || null });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch photo' }); }
});

// ── REFERRER: SAVE PROFILE PHOTO ──────────────────────────────────────────────
router.post('/api/profile/photo', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const { photo } = req.body;
    if (!photo) return res.status(400).json({ error: 'No photo provided' });
    if (typeof photo !== 'string' || !photo.startsWith('data:image/') || photo.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'Invalid photo' });
    }
    const userId = sessionResult.rows[0].user_id;
    await pool.query('UPDATE users SET profile_photo=$1 WHERE id=$2', [photo, userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to save photo' }); }
});

// ── REFERRER: FORGOT PIN ───────────────────────────────────────────────────────
router.post('/api/forgot-pin', forgotPinLimiter, async (req, res) => {
  const { email } = req.body;
  const genericResponse = { message: "If that email is registered, you'll receive a reset link shortly." };

  try {
    const userResult = await pool.query(
      'SELECT id, full_name, email FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const token = crypto.randomBytes(32).toString('hex');

      await pool.query(
        `INSERT INTO pin_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + interval '1 hour')`,
        [user.id, token]
      );

      const frontendUrl = process.env.FRONTEND_URL || '';
      if (!frontendUrl) console.warn('WARNING: FRONTEND_URL is not set — reset links will be broken');
      const resetUrl = `${frontendUrl}/?reset=${token}`;

      try {
        await resend.emails.send({
          from: 'Rooster Booster <noreply@roofmiles.com>',
          to: user.email,
          subject: 'Reset your Rooster Booster PIN',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <p style="font-size: 20px; font-weight: 700; color: #012854; margin: 0 0 8px;">Accent Roofing Service</p>
              <h1 style="font-size: 24px; color: #012854; margin: 0 0 16px;">Reset your PIN</h1>
              <p style="font-size: 15px; color: #444; margin: 0 0 24px;">
                Someone requested a PIN reset for your Rooster Booster referral account.
                Click the button below to set a new PIN. This link expires in 1 hour.
              </p>
              <a href="${resetUrl}" style="
                display: inline-block;
                background: #CC0000;
                color: #fff;
                text-decoration: none;
                padding: 14px 28px;
                border-radius: 8px;
                font-weight: 700;
                font-size: 15px;
                margin-bottom: 24px;
              ">Set New PIN</a>
              <p style="font-size: 13px; color: #888; margin: 0;">
                If you didn't request this, you can safely ignore this email. Your PIN has not been changed.
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Resend error (forgot-pin):', emailErr);
        // swallow — do not reveal whether email exists
      }

      try {
        await pool.query(
          `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ($1, $2, $3, $4)`,
          ['pin_reset_request', user.full_name, user.email, 'Reset link sent']
        );
      } catch (logErr) {
        console.error('Activity log error (forgot-pin):', logErr);
      }
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('forgot-pin error:', err);
    res.json(genericResponse); // always return generic even on DB error
  }
});

// ── REFERRER: RESET PIN ────────────────────────────────────────────────────────
router.post('/api/reset-pin', resetPinLimiter, async (req, res) => {
  const { token, pin } = req.body;

  if (!/^\d{4}$/.test(String(pin))) {
    return res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
  }

  if (!token || typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({ error: 'Reset token is required.' });
  }

  try {
    const tokenResult = await pool.query(
      `SELECT prt.user_id, u.full_name, u.email
       FROM pin_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1 AND prt.used_at IS NULL AND prt.expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const { user_id, full_name, email } = tokenResult.rows[0];
    const hashedPin = await bcrypt.hash(String(pin), 10);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET pin=$1 WHERE id=$2', [hashedPin, user_id]);
      await client.query('UPDATE pin_reset_tokens SET used_at=NOW() WHERE token=$1', [token]);
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
    try {
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ($1, $2, $3, $4)`,
        ['pin_reset', full_name, email, 'PIN reset via email link']
      );
    } catch (logErr) {
      console.error('Activity log error (reset-pin):', logErr);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('reset-pin error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── REFERRER: DISMISS REVIEW CARD ─────────────────────────────────────────────
router.post('/api/review/dismiss', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;
    await pool.query(
      'UPDATE users SET review_dismissed_login = login_count WHERE id = $1',
      [userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── REFERRER: QR CODE ─────────────────────────────────────────────────────────
router.get('/api/referrer/qr-code', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;
    const referralUrl = `https://leaksmith.com/refer?ref=${userId}&contractor=accent-roofing`;
    const qrCodeDataUrl = await QRCode.toDataURL(referralUrl);
    res.json({ qrCodeDataUrl });
  } catch (err) { res.status(500).json({ error: 'Failed to generate QR code' }); }
});

// ── REFERRER: PERSONAL INVITE LINK ────────────────────────────────────────────
// Lazy-generates a peer invite link for this referrer on first request.
router.get('/api/referrer/my-invite-link', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;

    // Check if peer link already exists for this user
    let linkResult = await pool.query(
      `SELECT slug FROM contractor_invite_links
       WHERE created_by_user_id=$1 AND link_type='peer' AND active=true
       LIMIT 1`,
      [userId]
    );

    let slug;
    if (linkResult.rows.length > 0) {
      slug = linkResult.rows[0].slug;
    } else {
      // Lazy-create the peer link
      slug = crypto.randomBytes(5).toString('hex');
      await pool.query(
        `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, created_by_user_id, active)
         VALUES ('accent-roofing', $1, 'peer', $2, true)`,
        [slug, userId]
      );
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const fullUrl = `${frontendUrl}?signup=${slug}`;

    // Generate QR code for the invite URL (server-side, existing qrcode package)
    // MVP: QR code generated server-side per request. Full solution: pre-generate and cache as
    // a stored asset when print materials are needed (Stripe ACH / print session).
    const qrCodeDataUrl = await QRCode.toDataURL(fullUrl, { width: 400, margin: 2 });

    res.json({ slug, fullUrl, qrCodeDataUrl });
  } catch (err) { res.status(500).json({ error: 'Failed to get invite link: ' + err.message }); }
});

// ── REFERRER: ABOUT ───────────────────────────────────────────────────────────
router.get('/api/referrer/about', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;

    const aboutResult = await pool.query(
      "SELECT * FROM contractor_about WHERE contractor_id = 'accent-roofing' LIMIT 1"
    );
    const about = aboutResult.rows[0];
    if (!about || !about.enabled) return res.json({ enabled: false });

    let google_rating = null;
    let google_review_count = null;

    if (about.google_place_id && process.env.GOOGLE_PLACES_API_KEY) {
      try {
        const cached = await pool.query(
          "SELECT data, cached_at FROM admin_cache WHERE cache_key = 'google_rating_accent-roofing' AND cached_at > NOW() - INTERVAL '86400 seconds'"
        );
        if (cached.rows.length > 0) {
          google_rating = cached.rows[0].data.rating ?? null;
          google_review_count = cached.rows[0].data.userRatingCount ?? null;
        } else {
          const googleRes = await fetch(
            `https://places.googleapis.com/v1/places/${encodeURIComponent(about.google_place_id)}`,
            {
              headers: {
                'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'rating,userRatingCount'
              }
            }
          );
          if (googleRes.ok) {
            const googleData = await googleRes.json();
            google_rating = googleData.rating ?? null;
            google_review_count = googleData.userRatingCount ?? null;
            await pool.query(
              `INSERT INTO admin_cache (id, cache_key, data, cached_at) VALUES (2, 'google_rating_accent-roofing', $1, NOW())
               ON CONFLICT (id) DO UPDATE SET cache_key='google_rating_accent-roofing', data=$1, cached_at=NOW()`,
              [JSON.stringify({ rating: google_rating, userRatingCount: google_review_count })]
            );
          }
        }
      } catch (e) {
        console.error('Google Places API error:', e.message);
      }
    }

    const userResult = await pool.query('SELECT about_modal_seen, booking_submitted FROM users WHERE id = $1', [userId]);
    const about_modal_seen   = userResult.rows[0]?.about_modal_seen   ?? false;
    const booking_submitted  = userResult.rows[0]?.booking_submitted  ?? false;

    const certs = typeof about.certifications === 'string' ? JSON.parse(about.certifications) : (about.certifications || []);
    res.json({ ...about, certifications: certs, google_rating, google_review_count, about_modal_seen, booking_submitted });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── REFERRER: MARK ABOUT MODAL SEEN ───────────────────────────────────────────
router.patch('/api/referrer/about/seen', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;
    await pool.query('UPDATE users SET about_modal_seen = true WHERE id = $1', [userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── REFERRER: BOOKING ─────────────────────────────────────────────────────────
router.post('/api/referrer/booking', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;

    const { name, phone, email, address, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required' });

    await pool.query('UPDATE users SET booking_submitted = true WHERE id = $1', [userId]);

    const aboutResult = await pool.query(
      "SELECT booking_email FROM contractor_about WHERE contractor_id = 'accent-roofing' LIMIT 1"
    );
    const toEmail = aboutResult.rows[0]?.booking_email || process.env.RESEND_TO_EMAIL;

    await resend.emails.send({
      from: 'Rooster Booster <noreply@roofmiles.com>',
      to: toEmail,
      subject: `New Inspection Booking Request — ${name}`,
      html: `<h2>New Inspection Booking Request</h2>
             <p><strong>Name:</strong> ${name}</p>
             <p><strong>Phone:</strong> ${phone}</p>
             ${email ? `<p><strong>Email:</strong> ${email}</p>` : ''}
             ${address ? `<p><strong>Address:</strong> ${address}</p>` : ''}
             ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
             <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>`
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── REFERRER: MARK ANNOUNCEMENT SEEN ──────────────────────────────────────────
router.post('/api/announcement/seen', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;
    const { announcementId } = req.body;
    if (!announcementId) return res.status(400).json({ error: 'announcementId is required' });
    await pool.query(
      'UPDATE payout_announcements SET seen_at = NOW() WHERE id = $1 AND user_id = $2',
      [announcementId, userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── REFERRER: BADGES ──────────────────────────────────────────────────────────

// Badge master list — must match src/constants/badges.js exactly.
// Kept server-side to avoid a runtime import of an ES module from CommonJS.
const BADGES_MASTER = [
  { id: "founding_referrer", name: null,              emoji: "🐓", description: null,                                          tier: "secret",   trigger: "account_creation" },
  { id: "first_referral",    name: "First Referral",  emoji: "⭐", description: "You made your first referral.",               tier: "standard", trigger: "pipeline_sync"    },
  { id: "milestone_5",       name: "On a Roll",        emoji: "🔥", description: "5 referrals and counting.",                  tier: "standard", trigger: "pipeline_sync"    },
  { id: "milestone_10",      name: "Double Digits",    emoji: "🔥", description: "10 referrals. You're serious about this.",   tier: "standard", trigger: "pipeline_sync"    },
  { id: "milestone_25",      name: "Referral Machine", emoji: "🔥", description: "25 referrals. Legendary.",                   tier: "standard", trigger: "pipeline_sync"    },
  { id: "client_badge",      name: "Client",           emoji: "🏠", description: "You're not just a referrer — you're family.", tier: "standard", trigger: "pipeline_sync"   },
  { id: "yearly_winner",     name: "Yearly Champion",  emoji: "🏆", description: "Top of the leaderboard at year end.",        tier: "standard", trigger: "admin_awarded"    },
];

router.get('/api/referrer/badges', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;

    const earnedResult = await pool.query(
      'SELECT badge_id, earned_at, seen FROM user_badges WHERE user_id=$1',
      [userId]
    );
    const earnedMap = {};
    for (const row of earnedResult.rows) {
      earnedMap[row.badge_id] = { earned_at: row.earned_at, seen: row.seen };
    }

    const badges = BADGES_MASTER.map(badge => {
      const record = earnedMap[badge.id];
      if (record) {
        return { ...badge, earned: true, earned_at: record.earned_at, seen: record.seen };
      }
      // Unearned secret badges: reveal nothing
      if (badge.tier === 'secret') {
        return { id: badge.id, emoji: badge.emoji, name: null, description: null, tier: 'secret', trigger: badge.trigger, earned: false, earned_at: null, seen: false };
      }
      return { ...badge, earned: false, earned_at: null, seen: false };
    });

    res.json(badges);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/referrer/badges/acknowledge', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;

    const { badgeIds } = req.body;
    if (!Array.isArray(badgeIds) || badgeIds.length === 0) return res.status(400).json({ error: 'badgeIds must be a non-empty array' });

    await pool.query(
      'UPDATE user_badges SET seen=true WHERE user_id=$1 AND badge_id=ANY($2)',
      [userId, badgeIds]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── REFERRER: LEADERBOARD ──────────────────────────────────────────────────────

// Priority order for leaderboard display badge — first match wins
const BADGE_PRIORITY = ['yearly_winner', 'milestone_25', 'milestone_10', 'milestone_5', 'client_badge', 'first_referral', 'founding_referrer'];

// Returns { id, emoji } for the highest-priority badge the user has earned, or null
function pickDisplayBadge(earnedSet) {
  for (const id of BADGE_PRIORITY) {
    if (earnedSet.has(id)) {
      const badge = BADGES_MASTER.find(b => b.id === id);
      return badge ? { id: badge.id, emoji: badge.emoji } : null;
    }
  }
  return null;
}

// SCALABLE: period boundaries driven by contractor engagement_settings, not hardcoded
function getPeriodDateRange(period, settings) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (!period || period === 'alltime') return { start: null, end: null };
  if (period === 'monthly') {
    return {
      start: new Date(currentYear, now.getMonth(), 1),
      end: new Date(currentYear, now.getMonth() + 1, 1),
    };
  }
  if (period === 'yearly') {
    const ysm = settings.year_start_month || 1;
    const startYear = currentMonth >= ysm ? currentYear : currentYear - 1;
    return {
      start: new Date(startYear, ysm - 1, 1),
      end: new Date(startYear + 1, ysm - 1, 1),
    };
  }
  if (period === 'quarterly') {
    const q = [
      settings.quarter_1_start || 1,
      settings.quarter_2_start || 4,
      settings.quarter_3_start || 7,
      settings.quarter_4_start || 10,
    ];
    let qIdx = 0;
    for (let i = q.length - 1; i >= 0; i--) {
      if (currentMonth >= q[i]) { qIdx = i; break; }
    }
    const qStartMonth = q[qIdx];
    const qEndMonth = q[(qIdx + 1) % 4];
    const endYear = qEndMonth <= qStartMonth ? currentYear + 1 : currentYear;
    return {
      start: new Date(currentYear, qStartMonth - 1, 1),
      end: new Date(endYear, qEndMonth - 1, 1),
    };
  }
  return { start: null, end: null };
}

router.get('/api/referrer/leaderboard', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;

    const [settingsResult, userShoutResult] = await Promise.all([
      pool.query(
        `SELECT leaderboard_enabled, year_start_month, quarter_1_start,
                quarter_2_start, quarter_3_start, quarter_4_start,
                quarterly_prizes, yearly_prizes,
                warmup_mode_enabled, shouts_enabled
         FROM engagement_settings WHERE contractor_id=$1`,
        ['accent-roofing']
      ),
      pool.query(
        'SELECT shout_opt_out, pinned_shout, full_name, profile_photo FROM users WHERE id=$1',
        [userId]
      ),
    ]);

    const settings = settingsResult.rows[0] || {};
    const leaderboard_enabled  = settings.leaderboard_enabled  ?? true;
    const warmup_mode_enabled  = settings.warmup_mode_enabled  ?? false;
    const shouts_enabled       = settings.shouts_enabled       ?? true;
    const shout_opt_out        = userShoutResult.rows[0]?.shout_opt_out  ?? false;
    const pinned_shout         = userShoutResult.rows[0]?.pinned_shout   ?? null;

    const period = req.query.period || 'alltime';
    const { start, end } = getPeriodDateRange(period, settings);

    let top10Result, userCountResult;
    if (!start) {
      [top10Result, userCountResult] = await Promise.all([
        pool.query(
          `SELECT u.id, u.full_name, u.profile_photo,
                  COUNT(rc.id) as converted_count,
                  COALESCE(SUM(rc.bonus_amount), 0) as period_earnings
           FROM users u
           LEFT JOIN referral_conversions rc ON rc.user_id = u.id AND rc.contractor_id = 'accent-roofing'
           GROUP BY u.id, u.full_name, u.profile_photo
           ORDER BY converted_count DESC
           LIMIT 10`
        ),
        pool.query(
          `SELECT COUNT(*) as converted_count,
                  COALESCE(SUM(bonus_amount), 0) as period_earnings
           FROM referral_conversions
           WHERE user_id = $1 AND contractor_id = 'accent-roofing'`,
          [userId]
        ),
      ]);
    } else {
      [top10Result, userCountResult] = await Promise.all([
        pool.query(
          `SELECT u.id, u.full_name, u.profile_photo,
                  COUNT(rc.id) as converted_count,
                  COALESCE(SUM(rc.bonus_amount), 0) as period_earnings
           FROM users u
           LEFT JOIN referral_conversions rc ON rc.user_id = u.id
             AND rc.contractor_id = 'accent-roofing'
             AND rc.converted_at >= $1 AND rc.converted_at < $2
           GROUP BY u.id, u.full_name, u.profile_photo
           ORDER BY converted_count DESC
           LIMIT 10`,
          [start, end]
        ),
        pool.query(
          `SELECT COUNT(*) as converted_count,
                  COALESCE(SUM(bonus_amount), 0) as period_earnings
           FROM referral_conversions
           WHERE user_id = $1 AND contractor_id = 'accent-roofing'
             AND converted_at >= $2 AND converted_at < $3`,
          [userId, start, end]
        ),
      ]);
    }

    const userCount = parseInt(userCountResult.rows[0]?.converted_count) || 0;

    // Count real entries with at least 1 conversion for warmup threshold check
    const realWithCount = top10Result.rows.filter(r => parseInt(r.converted_count) > 0).length;

    // ── Warmup mode: return placeholder entries when fewer than 5 real referrers have converted ──
    if (warmup_mode_enabled) {
      if (realWithCount < 5) {
        const warmupTop10 = WARMUP_ENTRIES_SERVER.map((entry, i) => ({
          rank: i + 1,
          first_name: entry.firstName,
          last_name: entry.lastName,
          converted_count: entry.referralCount,
          period_earnings: entry.earnings,
          shout: entry.shout,
          display_badge: null,
          is_warmup: true,
        }));
        return res.json({
          top10: warmupTop10,
          userRank: null,
          current_user: {
            full_name: userShoutResult.rows[0]?.full_name || null,
            profile_photo: userShoutResult.rows[0]?.profile_photo || null,
          },
          leaderboard_enabled,
          warmup_mode_enabled: true,
          shouts_enabled,
          shout_opt_out,
          pinned_shout,
          quarterly_prizes: settings.quarterly_prizes ?? [],
          yearly_prizes: settings.yearly_prizes ?? [],
        });
      }
      // 5+ real referrers — auto-disable warmup mode
      await pool.query(
        `UPDATE engagement_settings SET warmup_mode_enabled=false WHERE contractor_id='accent-roofing'`
      );
    }

    // ── Normal leaderboard path ───────────────────────────────────────────────
    // Collect all user IDs we need badges for: top 10 + the logged-in user
    const top10Ids = top10Result.rows.map(r => r.id);
    const allIds = [...new Set([...top10Ids, userId])];

    // Run badge lookup, rank query, and current user profile in parallel
    const badgesPromise = pool.query(
      'SELECT user_id, badge_id FROM user_badges WHERE user_id = ANY($1)',
      [allIds]
    );
    const userProfilePromise = pool.query(
      'SELECT full_name, profile_photo FROM users WHERE id=$1',
      [userId]
    );
    const rankPromise = userCount > 0
      ? (!start
          ? pool.query(
              `SELECT COUNT(*) as rank_above FROM (
                 SELECT user_id FROM referral_conversions
                 WHERE contractor_id = 'accent-roofing'
                 GROUP BY user_id HAVING COUNT(*) > $1
               ) sub`,
              [userCount]
            )
          : pool.query(
              `SELECT COUNT(*) as rank_above FROM (
                 SELECT user_id FROM referral_conversions
                 WHERE contractor_id = 'accent-roofing'
                   AND converted_at >= $1 AND converted_at < $2
                 GROUP BY user_id HAVING COUNT(*) > $3
               ) sub`,
              [start, end, userCount]
            )
        )
      : Promise.resolve(null);

    const [badgesResult, rankResult, userProfileResult] = await Promise.all([badgesPromise, rankPromise, userProfilePromise]);

    // Build badge map: userId → Set of earned badge ids
    const badgeMap = {};
    for (const row of badgesResult.rows) {
      if (!badgeMap[row.user_id]) badgeMap[row.user_id] = new Set();
      badgeMap[row.user_id].add(row.badge_id);
    }

    const top10 = top10Result.rows.map((row, i) => ({
      rank: i + 1,
      first_name: row.full_name.split(' ')[0],
      profile_photo: row.profile_photo || null,
      converted_count: parseInt(row.converted_count) || 0,
      period_earnings: parseInt(row.period_earnings) || 0,
      display_badge: pickDisplayBadge(badgeMap[row.id] || new Set()),
    }));

    const userProfile = userProfileResult.rows[0] || {};
    const userRank = userCount > 0 ? {
      rank: parseInt(rankResult.rows[0]?.rank_above || 0) + 1,
      full_name: userProfile.full_name || null,
      profile_photo: userProfile.profile_photo || null,
      converted_count: userCount,
      period_earnings: parseInt(userCountResult.rows[0]?.period_earnings) || 0,
      display_badge: pickDisplayBadge(badgeMap[userId] || new Set()),
    } : null;

    const response = {
      top10,
      userRank,
      current_user: {
        full_name: userProfile.full_name || null,
        profile_photo: userProfile.profile_photo || null,
      },
      leaderboard_enabled,
      warmup_mode_enabled: false,
      shouts_enabled,
      shout_opt_out,
      pinned_shout,
      quarterly_prizes: settings.quarterly_prizes ?? [],
      yearly_prizes: settings.yearly_prizes ?? [],
    };

    // Signal to admin panel that warmup was just auto-disabled
    if (warmup_mode_enabled && realWithCount >= 5) {
      response.warmup_just_disabled = true;
    }

    res.json(response);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── REFERRER: SHOUT SETTINGS ───────────────────────────────────────────────────
router.patch('/api/referrer/shout-settings', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;

    const { shout_opt_out, pinned_shout } = req.body;
    if (typeof shout_opt_out !== 'boolean') {
      return res.status(400).json({ error: 'shout_opt_out must be a boolean' });
    }
    if (pinned_shout !== null && typeof pinned_shout !== 'string') {
      return res.status(400).json({ error: 'pinned_shout must be a string or null' });
    }

    await pool.query(
      'UPDATE users SET shout_opt_out=$1, pinned_shout=$2 WHERE id=$3',
      [shout_opt_out, pinned_shout, userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
