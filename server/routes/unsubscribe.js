const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');

const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// ── GET /api/unsubscribe/validate ─────────────────────────────────────────────
router.get('/api/unsubscribe/validate', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const tokenResult = await pool.query(
      `SELECT t.token, t.contractor_id, t.email, t.campaign_id, t.expires_at, t.used_at
       FROM unsubscribe_tokens t
       WHERE t.token = $1`,
      [token]
    );
    if (tokenResult.rows.length === 0) return res.status(404).json({ error: 'Token not found' });

    const row = tokenResult.rows[0];
    if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'Token expired' });

    const [settingsResult, existingResult] = await Promise.all([
      pool.query(
        `SELECT company_name, logo_url, company_email
         FROM contractor_settings
         WHERE contractor_id = $1
         LIMIT 1`,
        [row.contractor_id]
      ),
      pool.query(
        `SELECT opt_out_campaigns, opt_out_sms, opt_out_all, referral_only
         FROM email_opt_outs
         WHERE contractor_id = $1 AND email = $2`,
        [row.contractor_id, row.email]
      ),
    ]);

    const cs = settingsResult.rows[0] || {};
    const existing = existingResult.rows[0] || null;

    res.json({
      valid: true,
      email: row.email,
      contractorId: row.contractor_id,
      campaignId: row.campaign_id,
      companyName: cs.company_name || null,
      logoUrl: cs.logo_url || null,
      companyEmail: cs.company_email || null,
      existingPreferences: existing
        ? {
            opt_out_campaigns: existing.opt_out_campaigns,
            opt_out_sms: existing.opt_out_sms,
            opt_out_all: existing.opt_out_all,
            referral_only: existing.referral_only,
          }
        : {
            opt_out_campaigns: false,
            opt_out_sms: false,
            opt_out_all: false,
            referral_only: false,
          },
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/unsubscribe/validate' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/unsubscribe/submit ──────────────────────────────────────────────
router.post('/api/unsubscribe/submit', async (req, res) => {
  const { token, opt_out_campaigns, opt_out_sms, opt_out_all, referral_only } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const tokenResult = await pool.query(
      `SELECT token, contractor_id, email, campaign_id, expires_at
       FROM unsubscribe_tokens
       WHERE token = $1`,
      [token]
    );
    if (tokenResult.rows.length === 0) return res.status(404).json({ error: 'Token not found' });

    const row = tokenResult.rows[0];
    if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'Token expired' });

    const ipAddress = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.ip;
    const userAgent = req.headers['user-agent'] || null;

    await pool.query(
      `INSERT INTO email_opt_outs
         (contractor_id, email, opt_out_campaigns, opt_out_sms, opt_out_all, referral_only,
          opted_out_at, token_used, campaign_id, source, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, 'unsubscribe_page', $9, $10)
       ON CONFLICT (contractor_id, email) DO UPDATE SET
         opt_out_campaigns = EXCLUDED.opt_out_campaigns,
         opt_out_sms       = EXCLUDED.opt_out_sms,
         opt_out_all       = EXCLUDED.opt_out_all,
         referral_only     = EXCLUDED.referral_only,
         opted_out_at      = NOW(),
         token_used        = EXCLUDED.token_used,
         campaign_id       = EXCLUDED.campaign_id,
         ip_address        = EXCLUDED.ip_address,
         user_agent        = EXCLUDED.user_agent`,
      [
        row.contractor_id,
        row.email,
        opt_out_campaigns === true,
        opt_out_sms === true,
        opt_out_all === true,
        referral_only === true,
        token,
        row.campaign_id,
        ipAddress,
        userAgent,
      ]
    );

    await pool.query(
      `UPDATE unsubscribe_tokens SET used_at = NOW() WHERE token = $1`,
      [token]
    );

    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/unsubscribe/submit' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/unsubscribe/pixel ────────────────────────────────────────────────
router.get('/api/unsubscribe/pixel', (req, res) => {
  const { token } = req.query;
  if (token) {
    pool.query(
      `UPDATE unsubscribe_tokens SET pixel_fired_at = NOW() WHERE token = $1 AND pixel_fired_at IS NULL`,
      [token]
    ).catch(() => {});
  }
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.end(TRACKING_PIXEL);
});

module.exports = router;
