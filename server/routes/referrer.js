const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { fetchPipelineForReferrer } = require('../crm/jobber');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');

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
    const data = await fetchPipelineForReferrer(req.query.referrer);
    await pool.query(
      'UPDATE users SET paid_count=$1, paid_count_updated_at=NOW() WHERE id=$2',
      [data.paidCount, userId]
    );
    res.json(data);
  } catch (err) {
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
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1,$2,$3)',
      [user.id, token, expiresAt]
    );
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

    res.json({ success: true, fullName: user.full_name, email: user.email, token, showReviewCard, announcement, announcementSettings });
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

// ── REFERRER: LEADERBOARD ──────────────────────────────────────────────────────
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

    const settingsResult = await pool.query(
      'SELECT leaderboard_enabled FROM engagement_settings WHERE contractor_id=$1',
      ['accent-roofing']
    );
    const leaderboard_enabled = settingsResult.rows.length > 0
      ? settingsResult.rows[0].leaderboard_enabled
      : true;

    const top10Result = await pool.query(
      `SELECT full_name, paid_count
       FROM users
       WHERE paid_count > 0
       ORDER BY paid_count DESC
       LIMIT 10`
    );
    const top10 = top10Result.rows.map((row, i) => ({
      rank: i + 1,
      first_name: row.full_name.split(' ')[0],
      converted_count: row.paid_count
    }));

    const userResult = await pool.query(
      'SELECT paid_count FROM users WHERE id=$1',
      [userId]
    );
    const userPaidCount = userResult.rows[0]?.paid_count || 0;
    let userRank = null;
    if (userPaidCount > 0) {
      const rankResult = await pool.query(
        'SELECT COUNT(*) as rank FROM users WHERE paid_count > $1',
        [userPaidCount]
      );
      userRank = { rank: parseInt(rankResult.rows[0].rank) + 1, converted_count: userPaidCount };
    }

    res.json({ top10, userRank, leaderboard_enabled });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
