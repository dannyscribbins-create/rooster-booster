const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Twilio is optional — only initialised when credentials are present so the
// server doesn't crash in environments where Twilio isn't yet configured.
function getTwilioClient() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  return require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

// ── SESSION VERIFICATION ──────────────────────────────────────────────────────
// Returns { userId, sessionId } on success, or sends 401/403 and returns null.
async function verifyReferrerSession(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authorized' }); return null; }

  const sessionResult = await pool.query(
    'SELECT * FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
    [token, 'referrer']
  );
  if (sessionResult.rows.length === 0) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return null;
  }

  const { user_id: userId, id: sessionId } = sessionResult.rows[0];

  // Block soft-deleted accounts
  const userCheck = await pool.query('SELECT deleted_at FROM users WHERE id=$1', [userId]);
  if (userCheck.rows[0]?.deleted_at) {
    res.status(403).json({ error: 'Account scheduled for deletion' });
    return null;
  }

  return { userId, sessionId, token };
}

// ── GET /api/account/me ───────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const result = await pool.query(
      `SELECT full_name, email, phone_number, phone_verified, email_verified,
              totp_enabled, sms_2fa_enabled, recovery_phone, recovery_email
       FROM users WHERE id=$1`,
      [session.userId]
    );
    const u = result.rows[0];
    res.json({
      name: u.full_name,
      email: u.email,
      phone_number: u.phone_number || null,
      phone_verified: u.phone_verified || false,
      email_verified: u.email_verified || false,
      totp_enabled: u.totp_enabled || false,
      sms_2fa_enabled: u.sms_2fa_enabled || false,
      recovery_phone: u.recovery_phone || null,
      recovery_email: u.recovery_email || null,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/account/name ─────────────────────────────────────────────────────
router.put('/name', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    await pool.query('UPDATE users SET full_name=$1 WHERE id=$2', [name.trim(), session.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/account/send-phone-verification ─────────────────────────────────
router.post('/send-phone-verification', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const { phone_number } = req.body;
    if (!phone_number) return res.status(400).json({ error: 'Phone number is required' });

    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO verification_codes (user_id, code, type, expires_at) VALUES ($1,$2,'phone',$3)`,
      [session.userId, code, expiresAt]
    );

    const twilio = getTwilioClient();
    if (!twilio) return res.status(503).json({ error: 'SMS service not configured' });

    await twilio.messages.create({
      body: `Your Rooster Booster verification code is: ${code}. Expires in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone_number,
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/account/verify-phone ────────────────────────────────────────────
router.post('/verify-phone', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const { phone_number, code } = req.body;
    if (!phone_number || !code) return res.status(400).json({ error: 'Missing phone_number or code' });

    const result = await pool.query(
      `SELECT id FROM verification_codes
       WHERE user_id=$1 AND code=$2 AND type='phone' AND used=false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [session.userId, String(code)]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired code' });

    await pool.query('UPDATE verification_codes SET used=true WHERE id=$1', [result.rows[0].id]);
    await pool.query(
      'UPDATE users SET phone_number=$1, phone_verified=true WHERE id=$2',
      [phone_number, session.userId]
    );

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/account/send-email-verification ─────────────────────────────────
router.post('/send-email-verification', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const userResult = await pool.query('SELECT email FROM users WHERE id=$1', [session.userId]);
    const { email } = userResult.rows[0];

    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO verification_codes (user_id, code, type, expires_at) VALUES ($1,$2,'email',$3)`,
      [session.userId, code, expiresAt]
    );

    await resend.emails.send({
      from: 'Rooster Booster <noreply@roofmiles.com>',
      to: email,
      subject: 'Verify your email — Rooster Booster',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="color:#012854;margin:0 0 8px;">Verify your email</h2>
          <p style="color:#444;margin:0 0 24px;line-height:1.6;">Enter the code below to verify your email address.</p>
          <div style="background:#f5f8ff;border:2px solid #D3E3F0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#666;letter-spacing:0.05em;text-transform:uppercase;">Verification code</p>
            <p style="margin:0;font-size:40px;font-weight:700;color:#012854;letter-spacing:0.15em;font-family:monospace;">${code}</p>
          </div>
          <p style="color:#888;font-size:13px;margin:0;">Expires in 10 minutes. If you didn't request this, you can ignore it.</p>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/account/verify-email ────────────────────────────────────────────
router.post('/verify-email', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const result = await pool.query(
      `SELECT id FROM verification_codes
       WHERE user_id=$1 AND code=$2 AND type='email' AND used=false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [session.userId, String(code)]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired code' });

    await pool.query('UPDATE verification_codes SET used=true WHERE id=$1', [result.rows[0].id]);
    await pool.query('UPDATE users SET email_verified=true WHERE id=$1', [session.userId]);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/account/totp/setup ──────────────────────────────────────────────
router.post('/totp/setup', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const userResult = await pool.query('SELECT email FROM users WHERE id=$1', [session.userId]);
    const { email } = userResult.rows[0];

    const secret = speakeasy.generateSecret({
      name: `Rooster Booster (${email})`,
      issuer: 'Rooster Booster',
      length: 20,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({ secret: secret.base32, qrCodeUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/account/totp/confirm ────────────────────────────────────────────
router.post('/totp/confirm', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const { secret, token } = req.body;
    if (!secret || !token) return res.status(400).json({ error: 'Missing secret or token' });

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: String(token),
      window: 1,
    });
    if (!verified) return res.status(400).json({ error: 'Invalid authenticator code' });

    await pool.query(
      'UPDATE users SET totp_secret=$1, totp_enabled=true WHERE id=$2',
      [secret, session.userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/account/totp/disable ────────────────────────────────────────────
router.post('/totp/disable', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    await pool.query(
      'UPDATE users SET totp_enabled=false WHERE id=$1',
      [session.userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/account/totp/reset ─────────────────────────────────────────────
router.post('/totp/reset', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    await pool.query(
      'UPDATE users SET totp_enabled=false, totp_secret=NULL WHERE id=$1',
      [session.userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/account/sms-2fa ──────────────────────────────────────────────────
router.put('/sms-2fa', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });

    if (enabled) {
      const userResult = await pool.query('SELECT phone_verified FROM users WHERE id=$1', [session.userId]);
      if (!userResult.rows[0]?.phone_verified) {
        return res.status(400).json({ error: 'Verify your phone number before enabling SMS 2FA' });
      }
    }

    await pool.query('UPDATE users SET sms_2fa_enabled=$1 WHERE id=$2', [enabled, session.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/account/recovery ─────────────────────────────────────────────────
router.put('/recovery', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const { recovery_phone, recovery_email } = req.body;
    await pool.query(
      'UPDATE users SET recovery_phone=$1, recovery_email=$2 WHERE id=$3',
      [recovery_phone || null, recovery_email || null, session.userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/account/sessions ─────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const result = await pool.query(
      `SELECT id, device_info, ip_address, city, country, created_at
       FROM sessions
       WHERE user_id=$1 AND role='referrer' AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 2`,
      [session.userId]
    );

    const sessions = result.rows.map(s => ({
      ...s,
      is_current: s.id === session.sessionId,
    }));

    res.json(sessions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/account/sessions/sign-out-others ────────────────────────────────
router.post('/sessions/sign-out-others', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    await pool.query(
      'DELETE FROM sessions WHERE user_id=$1 AND id != $2',
      [session.userId, session.sessionId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/account/me ────────────────────────────────────────────────────
router.delete('/me', async (req, res) => {
  try {
    const session = await verifyReferrerSession(req, res);
    if (!session) return;

    const { confirmation } = req.body;
    if (confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Type DELETE to confirm' });
    }

    const userResult = await pool.query(
      'SELECT full_name, email FROM users WHERE id=$1',
      [session.userId]
    );
    const { full_name, email } = userResult.rows[0];

    await pool.query(
      'UPDATE users SET deleted_at=NOW(), deletion_requested_at=NOW() WHERE id=$1',
      [session.userId]
    );

    // Auto-create a final cashout request if the user has an outstanding balance.
    // Balance = total earned from referral_conversions minus total already requested (non-denied).
    const balanceResult = await pool.query(
      `SELECT
         COALESCE((SELECT SUM(bonus_amount) FROM referral_conversions WHERE user_id=$1), 0)
         - COALESCE((SELECT SUM(amount) FROM cashout_requests WHERE user_id=$1 AND status != 'denied'), 0)
       AS balance`,
      [session.userId]
    );
    const balance = parseFloat(balanceResult.rows[0]?.balance || 0);
    if (balance > 0) {
      await pool.query(
        `INSERT INTO cashout_requests (user_id, full_name, email, amount, method, status, requested_at)
         VALUES ($1, $2, $3, $4, 'account_deletion', 'pending', NOW())`,
        [session.userId, full_name, email, balance]
      );
    }

    // TODO: cron job to permanently purge users where deleted_at < NOW() - INTERVAL '30 days'

    // Confirmation to user
    await resend.emails.send({
      from: 'Rooster Booster <noreply@roofmiles.com>',
      to: email,
      subject: 'Your account has been scheduled for deletion',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="color:#012854;margin:0 0 8px;">Account deletion requested</h2>
          <p style="color:#444;margin:0 0 16px;line-height:1.6;">
            Hi ${full_name}, we've received your request to delete your Rooster Booster account.
          </p>
          <p style="color:#444;margin:0 0 16px;line-height:1.6;">
            Your account will be permanently deleted in 30 days. If you change your mind, contact us before then.
          </p>
          <p style="color:#888;font-size:13px;margin:0;">If you didn't request this, contact us immediately at hello@roofmiles.com.</p>
        </div>
      `,
    }).catch(() => {}); // non-blocking

    // Admin notification
    await resend.emails.send({
      from: 'Rooster Booster <noreply@roofmiles.com>',
      to: 'hello@roofmiles.com',
      subject: `Account deletion requested — ${full_name}`,
      html: `
        <p><strong>Name:</strong> ${full_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Requested at:</strong> ${new Date().toLocaleString()}</p>
        <p>Account will be purged in 30 days unless the cron job is implemented.</p>
      `,
    }).catch(() => {}); // non-blocking

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
