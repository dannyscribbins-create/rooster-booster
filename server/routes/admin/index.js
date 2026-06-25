const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { getCRMAdapter } = require('../../crm/index');
const axios = require('axios');
const { verifyAdminSession } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { logError } = require('../../middleware/errorLogger');
const { body, validationResult } = require('express-validator');
const { getPeriodDateRange } = require('../../utils/dateUtils');
const { runBackup } = require('../../utils/backup');
const { runVerify } = require('../../utils/restore-verify');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { resendShouldRetry, jobberShouldRetry } = require('../../utils/retryHelpers');
const { discoverJobberFields } = require('../../crm/jobber');
const { isEmailSuppressed } = require('../../utils/emailSuppression');
const { normalizeTagGroupVisibility } = require('../../utils/tagGroupVisibility');

const bcrypt = require('bcrypt');

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// Hash of a throwaway sentinel — ensures bcrypt.compare always runs even when
// the email is not found, preventing email enumeration via response-time differences.
const DUMMY_BCRYPT_HASH = '$2b$12$zx3jp3cwKJyBjvkjLrxpC.tFQcGrtob.60TLBryMPGb8IZQvlLF32';

// ── SUB-ROUTERS ───────────────────────────────────────────────────────────────
router.use(require('./campaigns'));
router.use(require('./contacts'));
router.use(require('./cashouts'));
router.use(require('./referrers'));
router.use(require('./metrics'));
router.use(require('./notifications'));
router.use(require('./team'));

// ── ADMIN: AUTH ───────────────────────────────────────────────────────────────
router.post('/api/admin/login', adminLoginLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().isString().isLength({ max: 200 }).withMessage('Password required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT id, password_hash, contractor_id, tier, permissions FROM team_members WHERE email = $1 AND active = true',
      [email]
    );
    const storedHash = result.rows.length ? result.rows[0].password_hash : DUMMY_BCRYPT_HASH;
    const match = await bcrypt.compare(password, storedHash);
    if (!result.rows.length || !match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const teamMember = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id) VALUES (NULL,$1,$2,$3,$4,$5)',
      [token, expiresAt, 'admin', teamMember.contractor_id, teamMember.id]
    );
    // Stamp last_login_at after a successful login. Failure is logged but must not
    // block the login response — the session is already created and valid.
    try {
      await pool.query('UPDATE team_members SET last_login_at = NOW() WHERE id = $1', [teamMember.id]);
    } catch (stampErr) {
      await logError({ req, error: stampErr, source: 'POST /api/admin/login (last_login_at stamp)' });
    }
    // Return tier + permissions so the frontend has initial state without a /me roundtrip.
    // /me remains the live-refresh source for all subsequent reads (Decision A §5.2).
    res.json({ success: true, token, tier: teamMember.tier, permissions: teamMember.permissions || {} });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/admin/login' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: ME ─────────────────────────────────────────────────────────────────
// Session-only — intentionally NO requirePermission. Reads the caller's own row live
// (Decision A §5.2: never serve identity data from the session token).
router.get('/api/admin/me', async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { teamMemberId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT email, full_name, tier, permissions, title_id,
              is_field_rep, is_attributable, rep_revenue_visibility
       FROM team_members
       WHERE id = $1 AND active = true`,
      [teamMemberId]
    );
    if (!result.rows.length) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const m = result.rows[0];
    res.json({
      email: m.email,
      full_name: m.full_name,
      tier: m.tier,
      permissions: m.permissions || {},
      title_id: m.title_id,
      is_field_rep: m.is_field_rep,
      is_attributable: m.is_attributable,
      rep_revenue_visibility: m.rep_revenue_visibility,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/me' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: ABOUT ──────────────────────────────────────────────────────────────
router.get('/api/admin/about', requirePermission('branding'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT contractor_id, enabled, booking_enabled, bio, years_in_business,
              service_area, google_place_id, certifications, booking_email, updated_at
       FROM contractor_about WHERE contractor_id = $1 LIMIT 1`,
      [contractorId]
    );
    if (result.rows.length === 0) {
      return res.json({
        contractor_id: contractorId,
        enabled: false,
        booking_enabled: false,
        bio: null,
        years_in_business: null,
        service_area: null,
        google_place_id: null,
        certifications: [],
        booking_email: null,
        updated_at: null
      });
    }
    const row = result.rows[0];
    const certs = typeof row.certifications === 'string' ? JSON.parse(row.certifications) : (row.certifications || []);
    res.json({ ...row, certifications: certs });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/about', requirePermission('branding.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { enabled, booking_enabled, bio, years_in_business, service_area, google_place_id, certifications, booking_email } = req.body;
  try {
    await pool.query(
      `INSERT INTO contractor_about (contractor_id, enabled, booking_enabled, bio, years_in_business, service_area, google_place_id, certifications, booking_email, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (contractor_id) DO UPDATE SET
         enabled=$2, booking_enabled=$3, bio=$4, years_in_business=$5, service_area=$6,
         google_place_id=$7, certifications=$8, booking_email=$9, updated_at=NOW()`,
      [contractorId, enabled, booking_enabled, bio, years_in_business, service_area, google_place_id, JSON.stringify(certifications || []), booking_email]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    console.error('POST /api/admin/about error:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: ANNOUNCEMENT SETTINGS ──────────────────────────────────────────────
router.get('/api/admin/announcement-settings', requirePermission('branding'), async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT enabled, mode, custom_message FROM announcement_settings WHERE id = 1');
    res.json(result.rows[0] || { enabled: true, mode: 'preset_1', custom_message: null });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/announcement-settings', requirePermission('branding.manage'), async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { enabled, mode, customMessage } = req.body;
  const VALID_MODES = ['preset_1', 'preset_2', 'custom'];
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' });
  if (!VALID_MODES.includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
  try {
    await pool.query(
      `INSERT INTO announcement_settings (id, enabled, mode, custom_message, updated_at)
       VALUES (1, $1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET enabled=$1, mode=$2, custom_message=$3, updated_at=NOW()`,
      [enabled, mode, customMessage || null]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: LEADERBOARD ────────────────────────────────────────────────────────
router.get('/api/admin/leaderboard', requirePermission('experience'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const settingsResult = await pool.query(
      `SELECT year_start_month, quarter_1_start, quarter_2_start,
              quarter_3_start, quarter_4_start, warmup_mode_enabled
       FROM engagement_settings WHERE contractor_id=$1`,
      [contractorId]
    );
    const settings = settingsResult.rows[0] || {};
    const warmup_mode_enabled = settings.warmup_mode_enabled ?? false;
    const period = req.query.period || 'alltime';
    const { start, end } = getPeriodDateRange(period, settings);

    let result;
    if (!start) {
      result = await pool.query(
        `SELECT u.id, u.full_name, u.email, COUNT(rc.id) as converted_count
         FROM users u
         LEFT JOIN referral_conversions rc ON rc.user_id = u.id AND rc.contractor_id = $1
         GROUP BY u.id, u.full_name, u.email
         ORDER BY converted_count DESC
         LIMIT 50`,
        [contractorId]
      );
    } else {
      result = await pool.query(
        `SELECT u.id, u.full_name, u.email, COUNT(rc.id) as converted_count
         FROM users u
         LEFT JOIN referral_conversions rc ON rc.user_id = u.id
           AND rc.contractor_id = $1
           AND rc.converted_at >= $2 AND rc.converted_at < $3
         GROUP BY u.id, u.full_name, u.email
         ORDER BY converted_count DESC
         LIMIT 50`,
        [contractorId, start, end]
      );
    }

    const rows = result.rows.map((row, i) => {
      const parts = row.full_name.trim().split(' ');
      return {
        rank: i + 1,
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || '',
        email: row.email,
        converted_count: parseInt(row.converted_count) || 0,
        period,
      };
    });

    let warmup_just_disabled = false;
    if (warmup_mode_enabled) {
      const realWithCount = rows.filter(r => r.converted_count > 0).length;
      if (realWithCount >= 5) {
        await pool.query(
          `UPDATE engagement_settings SET warmup_mode_enabled=false WHERE contractor_id=$1`,
          [contractorId]
        );
        warmup_just_disabled = true;
      }
    }

    res.json({ rows, warmup_just_disabled });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: RETENTION SETTINGS ─────────────────────────────────────────────────
router.get('/api/admin/retention-settings', requirePermission('experience'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT leaderboard_enabled, quarterly_prizes, yearly_prizes,
              year_start_month, quarter_1_start, quarter_2_start,
              quarter_3_start, quarter_4_start,
              warmup_mode_enabled, shouts_enabled, experience_flow_enabled
       FROM engagement_settings WHERE contractor_id = $1`,
      [contractorId]
    );
    if (result.rows.length === 0) {
      return res.json({
        leaderboard_enabled: true, quarterly_prizes: [], yearly_prizes: [],
        year_start_month: 1, quarter_1_start: 1, quarter_2_start: 4,
        quarter_3_start: 7, quarter_4_start: 10,
        warmup_mode_enabled: false, shouts_enabled: true,
        experience_flow_enabled: false,
      });
    }
    const row = result.rows[0];
    res.json({
      leaderboard_enabled: row.leaderboard_enabled,
      quarterly_prizes: row.quarterly_prizes,
      yearly_prizes: row.yearly_prizes,
      year_start_month: row.year_start_month ?? 1,
      quarter_1_start: row.quarter_1_start ?? 1,
      quarter_2_start: row.quarter_2_start ?? 4,
      quarter_3_start: row.quarter_3_start ?? 7,
      quarter_4_start: row.quarter_4_start ?? 10,
      warmup_mode_enabled: row.warmup_mode_enabled ?? false,
      shouts_enabled: row.shouts_enabled ?? true,
      experience_flow_enabled: row.experience_flow_enabled ?? false,
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/retention-settings', requirePermission('experience.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const {
    leaderboard_enabled, quarterly_prizes, yearly_prizes,
    year_start_month, quarter_1_start, quarter_2_start, quarter_3_start, quarter_4_start,
    warmup_mode_enabled, shouts_enabled, experience_flow_enabled,
  } = req.body;
  // Prize fields belong to POST /api/admin/prize-settings — reject loudly to prevent
  // the frontend from believing a prize edit saved when it didn't.
  if (quarterly_prizes !== undefined || yearly_prizes !== undefined) {
    return res.status(400).json({ error: 'quarterly_prizes and yearly_prizes must be submitted to POST /api/admin/prize-settings' });
  }
  if (typeof leaderboard_enabled !== 'boolean') {
    return res.status(400).json({ error: 'leaderboard_enabled must be a boolean' });
  }
  if (typeof warmup_mode_enabled !== 'boolean') {
    return res.status(400).json({ error: 'warmup_mode_enabled must be a boolean' });
  }
  if (typeof shouts_enabled !== 'boolean') {
    return res.status(400).json({ error: 'shouts_enabled must be a boolean' });
  }
  if (typeof experience_flow_enabled !== 'boolean') {
    return res.status(400).json({ error: 'experience_flow_enabled must be a boolean' });
  }
  const monthFields = { year_start_month, quarter_1_start, quarter_2_start, quarter_3_start, quarter_4_start };
  for (const [field, val] of Object.entries(monthFields)) {
    const n = parseInt(val);
    if (!Number.isInteger(n) || n < 1 || n > 12) {
      return res.status(400).json({ error: `${field} must be an integer between 1 and 12` });
    }
    monthFields[field] = n;
  }
  try {
    await pool.query(
      `INSERT INTO engagement_settings (
         contractor_id, leaderboard_enabled,
         year_start_month, quarter_1_start, quarter_2_start, quarter_3_start, quarter_4_start,
         warmup_mode_enabled, shouts_enabled, experience_flow_enabled, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (contractor_id) DO UPDATE
         SET leaderboard_enabled=$2,
             year_start_month=$3, quarter_1_start=$4, quarter_2_start=$5,
             quarter_3_start=$6, quarter_4_start=$7,
             warmup_mode_enabled=$8, shouts_enabled=$9,
             experience_flow_enabled=$10, updated_at=NOW()`,
      [
        contractorId, leaderboard_enabled,
        monthFields.year_start_month, monthFields.quarter_1_start, monthFields.quarter_2_start,
        monthFields.quarter_3_start, monthFields.quarter_4_start,
        warmup_mode_enabled, shouts_enabled, experience_flow_enabled,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: PRIZE SETTINGS ─────────────────────────────────────────────────────
// Separate gate from retention-settings: Finance preset has finance_settings but no
// experience grant, so prize data needs its own read endpoint (Decision A §6.3).
router.get('/api/admin/prize-settings', requirePermission('finance_settings'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT quarterly_prizes, yearly_prizes
       FROM engagement_settings WHERE contractor_id = $1`,
      [contractorId]
    );
    if (result.rows.length === 0) {
      return res.json({ quarterly_prizes: [], yearly_prizes: [] });
    }
    const row = result.rows[0];
    res.json({
      quarterly_prizes: row.quarterly_prizes,
      yearly_prizes: row.yearly_prizes,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/prize-settings' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/prize-settings', requirePermission('finance_settings.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { quarterly_prizes, yearly_prizes } = req.body;
  if (!Array.isArray(quarterly_prizes) || quarterly_prizes.length > 3) {
    return res.status(400).json({ error: 'quarterly_prizes must be an array of max 3 items' });
  }
  if (!Array.isArray(yearly_prizes) || yearly_prizes.length > 3) {
    return res.status(400).json({ error: 'yearly_prizes must be an array of max 3 items' });
  }
  try {
    await pool.query(
      `INSERT INTO engagement_settings (
         contractor_id, quarterly_prizes, yearly_prizes,
         leaderboard_enabled, warmup_mode_enabled, shouts_enabled, experience_flow_enabled,
         year_start_month, quarter_1_start, quarter_2_start, quarter_3_start, quarter_4_start,
         updated_at
       ) VALUES ($1, $2, $3, true, false, true, false, 1, 1, 4, 7, 10, NOW())
       ON CONFLICT (contractor_id) DO UPDATE SET
         quarterly_prizes=$2, yearly_prizes=$3, updated_at=NOW()`,
      [contractorId, JSON.stringify(quarterly_prizes), JSON.stringify(yearly_prizes)]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: INVITE LINKS ───────────────────────────────────────────────────────
router.post('/api/admin/invite-links', requirePermission('referrers.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { linkType } = req.body;
  if (!['contractor'].includes(linkType)) {
    return res.status(400).json({ error: "linkType must be 'contractor'" });
  }
  try {
    const slug = crypto.randomBytes(5).toString('hex');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const fullUrl = `${frontendUrl}?signup=${slug}`;
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, created_by_user_id, active)
       VALUES ($1, $2, $3, NULL, true)`,
      [contractorId, slug, linkType]
    );
    await pool.query(
      `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('admin', 'Admin', '', $1)`,
      [`Generated ${linkType} invite link: ${slug}`]
    );
    res.json({ slug, fullUrl });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/admin/invite-links', requirePermission('referrers'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const result = await pool.query(
      `SELECT id, slug, link_type, active, created_at
       FROM contractor_invite_links
       WHERE contractor_id=$1 AND active=true
       ORDER BY created_at DESC`,
      [contractorId]
    );
    const rows = result.rows.map(r => ({
      ...r,
      fullUrl: `${frontendUrl}?signup=${r.slug}`,
    }));
    res.json(rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: CONTRACTOR SETTINGS ────────────────────────────────────────────────
router.get('/api/admin/settings', requirePermission('branding'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT contractor_id, company_name, company_phone, company_email, company_url,
              company_address, company_city, company_state, company_zip, company_country,
              logo_url, app_logo_url, primary_color, secondary_color, accent_color,
              social_facebook, social_instagram, social_google, social_nextdoor, social_website,
              review_url, review_button_text, review_message,
              font_heading, font_body, app_display_name, tagline,
              email_sender_name, email_footer_text, created_at, updated_at
       FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
      [contractorId]
    );
    if (result.rows.length === 0) {
      return res.json({
        contractor_id: contractorId,
        company_name: 'Accent Roofing Service',
        company_phone: '770-277-4869',
        company_email: 'contact@leaksmith.com',
        company_url: 'accentroofingservice.com',
        company_address: null, company_city: null, company_state: null,
        company_zip: null, company_country: 'US',
        logo_url: '/AccentRoofing-Logo-White.png',
        app_logo_url: null,
        primary_color: null, secondary_color: null, accent_color: null,
        social_facebook: null, social_instagram: null, social_google: null,
        social_nextdoor: null, social_website: null,
        review_url: 'https://g.page/r/CbtYNjHgUCwhEBM/review',
        review_button_text: 'Leave a Review',
        review_message: 'Enjoying the rewards? Leave us a quick Google review!',
        font_heading: 'Montserrat',
        font_body: 'Roboto',
        app_display_name: 'Rooster Booster',
        tagline: 'Refer your neighbors. Earn cash rewards.',
        email_sender_name: 'Accent Roofing Service',
        email_footer_text: 'Accent Roofing Service · Powered by Rooster Booster',
        created_at: null, updated_at: null,
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/api/admin/settings', requirePermission('branding.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const {
    company_name, company_phone, company_email, company_url,
    company_address, company_city, company_state, company_zip, company_country,
    logo_url, app_logo_url,
    primary_color, secondary_color, accent_color,
    social_facebook, social_instagram, social_google, social_nextdoor, social_website,
    review_url, review_button_text, review_message,
    font_heading, font_body, app_display_name, tagline,
    email_sender_name, email_footer_text,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO contractor_settings (
         contractor_id, company_name, company_phone, company_email, company_url,
         company_address, company_city, company_state, company_zip, company_country,
         logo_url, app_logo_url,
         primary_color, secondary_color, accent_color,
         social_facebook, social_instagram, social_google, social_nextdoor, social_website,
         review_url, review_button_text, review_message,
         font_heading, font_body, app_display_name, tagline,
         email_sender_name, email_footer_text,
         updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,NOW())
       ON CONFLICT (contractor_id) DO UPDATE SET
         company_name=$2, company_phone=$3, company_email=$4, company_url=$5,
         company_address=$6, company_city=$7, company_state=$8, company_zip=$9, company_country=$10,
         logo_url=$11, app_logo_url=$12,
         primary_color=$13, secondary_color=$14, accent_color=$15,
         social_facebook=$16, social_instagram=$17, social_google=$18, social_nextdoor=$19, social_website=$20,
         review_url=$21, review_button_text=$22, review_message=$23,
         font_heading=$24, font_body=$25, app_display_name=$26, tagline=$27,
         email_sender_name=$28, email_footer_text=$29,
         updated_at=NOW()
       RETURNING *`,
      [
        contractorId, company_name, company_phone, company_email, company_url,
        company_address, company_city, company_state, company_zip, company_country ?? 'US',
        logo_url, app_logo_url,
        primary_color, secondary_color, accent_color,
        social_facebook, social_instagram, social_google, social_nextdoor, social_website,
        review_url, review_button_text, review_message,
        font_heading, font_body, app_display_name, tagline,
        email_sender_name, email_footer_text,
      ]
    );
    res.json({ success: true, settings: result.rows[0] });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: NOTIFICATION SETTINGS ─────────────────────────────────────────────
router.get('/api/admin/notification-settings', requirePermission('branding'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const [settingsResult, aboutResult] = await Promise.all([
      pool.query(
        `SELECT notification_email_payouts, notification_email_general
         FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
        [contractorId]
      ),
      pool.query(
        `SELECT booking_email FROM contractor_about WHERE contractor_id = $1 LIMIT 1`,
        [contractorId]
      ),
    ]);
    res.json({
      notification_email_payouts: settingsResult.rows[0]?.notification_email_payouts || null,
      notification_email_general: settingsResult.rows[0]?.notification_email_general || null,
      booking_email:              aboutResult.rows[0]?.booking_email                  || null,
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/api/admin/notification-settings', requirePermission('branding.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { notification_email_payouts, notification_email_general, booking_email } = req.body;

  const emailFields = { notification_email_payouts, notification_email_general, booking_email };
  for (const [field, value] of Object.entries(emailFields)) {
    if (value && typeof value === 'string' && value.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value.trim())) {
        return res.status(400).json({ error: `Invalid email address for ${field}` });
      }
    }
  }

  const payouts = notification_email_payouts?.trim() || null;
  const general = notification_email_general?.trim() || null;
  const booking = booking_email?.trim()              || null;

  try {
    await Promise.all([
      pool.query(
        `INSERT INTO contractor_settings (contractor_id, notification_email_payouts, notification_email_general)
         VALUES ($1, $2, $3)
         ON CONFLICT (contractor_id) DO UPDATE SET
           notification_email_payouts = EXCLUDED.notification_email_payouts,
           notification_email_general = EXCLUDED.notification_email_general,
           updated_at = NOW()`,
        [contractorId, payouts, general]
      ),
      pool.query(
        `INSERT INTO contractor_about (contractor_id, booking_email)
         VALUES ($1, $2)
         ON CONFLICT (contractor_id) DO UPDATE SET booking_email = EXCLUDED.booking_email`,
        [contractorId, booking]
      ),
    ]);
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: PAYOUT AUTOMATION SETTINGS ────────────────────────────────────────
router.get('/api/admin/payout-automation', requirePermission('finance_settings'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT payout_automation, payout_review_threshold
       FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
      [contractorId]
    );
    if (result.rows.length === 0) {
      return res.json({ payout_automation: 'manual_all', payout_review_threshold: null });
    }
    const { payout_automation, payout_review_threshold } = result.rows[0];
    res.json({ payout_automation, payout_review_threshold });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/api/admin/payout-automation', requirePermission('finance_settings.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { payout_automation } = req.body;
  let { payout_review_threshold } = req.body;
  if (!['manual_all', 'full_auto', 'threshold'].includes(payout_automation)) {
    return res.status(400).json({ error: 'payout_automation must be manual_all, full_auto, or threshold' });
  }
  if (payout_automation !== 'threshold') payout_review_threshold = null;
  try {
    const result = await pool.query(
      `INSERT INTO contractor_settings (contractor_id, payout_automation, payout_review_threshold)
       VALUES ($1, $2, $3)
       ON CONFLICT (contractor_id) DO UPDATE SET
         payout_automation = EXCLUDED.payout_automation,
         payout_review_threshold = EXCLUDED.payout_review_threshold,
         updated_at = NOW()
       RETURNING payout_automation, payout_review_threshold`,
      [contractorId, payout_automation, payout_review_threshold ?? null]
    );
    const row = result.rows[0];
    res.json({ payout_automation: row.payout_automation, payout_review_threshold: row.payout_review_threshold });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: PAYOUT METHOD SETTINGS ────────────────────────────────────────────
router.get('/api/admin/payout-methods', requirePermission('finance_settings'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT enabled_payout_methods FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
      [contractorId]
    );
    if (result.rows.length === 0) {
      return res.json({ enabled_payout_methods: ['stripe_ach', 'check', 'venmo', 'zelle'] });
    }
    const { enabled_payout_methods } = result.rows[0];
    res.json({ enabled_payout_methods: enabled_payout_methods || ['stripe_ach', 'check', 'venmo', 'zelle'] });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/api/admin/payout-methods', requirePermission('finance_settings.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { enabled_payout_methods } = req.body;
  const VALID_METHODS = ['stripe_ach', 'check', 'venmo', 'zelle'];
  if (!Array.isArray(enabled_payout_methods)) {
    return res.status(400).json({ error: 'enabled_payout_methods must be an array' });
  }
  if (enabled_payout_methods.length === 0) {
    return res.status(400).json({ error: 'At least one payout method must be enabled' });
  }
  const invalid = enabled_payout_methods.filter(m => !VALID_METHODS.includes(m));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Invalid payout method(s): ${invalid.join(', ')}` });
  }
  try {
    const result = await pool.query(
      `INSERT INTO contractor_settings (contractor_id, enabled_payout_methods)
       VALUES ($1, $2)
       ON CONFLICT (contractor_id) DO UPDATE SET
         enabled_payout_methods = EXCLUDED.enabled_payout_methods,
         updated_at = NOW()
       RETURNING enabled_payout_methods`,
      [contractorId, enabled_payout_methods]
    );
    const row = result.rows[0];
    res.json({ success: true, enabled_payout_methods: row.enabled_payout_methods });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: CRM SETTINGS ───────────────────────────────────────────────────────
router.get('/api/admin/crm/status', requirePermission('integrations'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const [settingsResult, visibilityResult] = await Promise.all([
      pool.query(
        `SELECT contractor_id, crm_type, crm_account_name, connection_method, api_key,
                referrer_field_name, stage_map, connected_at, last_synced_at,
                sync_interval_mins, is_connected, referral_start_date
         FROM contractor_crm_settings WHERE contractor_id = $1`,
        [contractorId]
      ),
      pool.query(
        `SELECT tag_group_visibility FROM contractor_settings WHERE contractor_id = $1`,
        [contractorId]
      ),
    ]);
    const tagGroupVisibility = normalizeTagGroupVisibility(visibilityResult.rows[0]?.tag_group_visibility || {});
    if (settingsResult.rows.length === 0) {
      return res.json({
        isConnected: false, crmType: null, crmAccountName: null,
        connectionMethod: null, referrerFieldName: 'Referred by',
        stageMap: { lead: 'Quote Sent', inspection: 'Assessment Scheduled', sold: 'Job Approved', paid: 'Invoice Paid' },
        connectedAt: null, lastSyncedAt: null, syncIntervalMins: 30, tokenStatus: 'missing',
        tagGroupVisibility,
      });
    }
    const s = settingsResult.rows[0];

    let tokenStatus = 'missing';
    if (s.connection_method === 'oauth') {
      const tokenResult = await pool.query(
        'SELECT expires_at FROM tokens WHERE contractor_id = $1',
        [contractorId]
      );
      if (tokenResult.rows.length === 0) {
        tokenStatus = 'missing';
      } else {
        const expiresAt = tokenResult.rows[0].expires_at;
        tokenStatus = (!expiresAt || new Date(expiresAt) < new Date()) ? 'expired' : 'ok';
      }
    } else if (s.connection_method === 'api_key') {
      tokenStatus = s.api_key ? 'ok' : 'missing';
    }

    if (s.is_connected && s.last_synced_at && s.sync_interval_mins) {
      const syncDue = new Date(s.last_synced_at.getTime() + s.sync_interval_mins * 60 * 1000);
      if (new Date() > syncDue) {
        pool.query(
          `UPDATE contractor_crm_settings SET last_synced_at = NOW() WHERE contractor_id = $1`,
          [contractorId]
        ).catch(err => console.error('Background sync update failed:', err.message));
      }
    }

    res.json({
      isConnected: s.is_connected,
      crmType: s.crm_type,
      crmAccountName: s.crm_account_name,
      connectionMethod: s.connection_method,
      referrerFieldName: s.referrer_field_name || 'Referred by',
      stageMap: s.stage_map || { lead: 'Quote Sent', inspection: 'Assessment Scheduled', sold: 'Job Approved', paid: 'Invoice Paid' },
      connectedAt: s.connected_at,
      referralStartDate: s.referral_start_date || null,
      lastSyncedAt: s.last_synced_at,
      syncIntervalMins: s.sync_interval_mins || 30,
      tokenStatus,
      tagGroupVisibility,
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/crm/test-connection', requirePermission('integrations'), async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { crmType, credential } = req.body;
  if (!crmType || !credential) return res.status(400).json({ error: 'crmType and credential required' });
  try {
    if (crmType === 'jobber') {
      const accountRes = await retryWithBackoff(
        () => axios.post(
          'https://api.getjobber.com/api/graphql',
          { query: '{ account { name } }' },
          { headers: {
              Authorization: `Bearer ${credential}`,
              'Content-Type': 'application/json',
              'X-JOBBER-GRAPHQL-VERSION': '2026-02-17'
          } }
        ),
        { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
      );
      const name = accountRes.data?.data?.account?.name;
      if (name) return res.json({ success: true, accountName: name, message: 'Connected successfully' });
      return res.json({ success: false, message: 'Invalid credential or no account data returned' });
    }
    if (crmType === 'servicetitan') {
      return res.json({ success: false, message: 'ServiceTitan adapter not yet implemented' });
    }
    if (crmType === 'acculynx') {
      return res.json({ success: false, message: 'AccuLynx adapter not yet implemented' });
    }
    return res.status(400).json({ error: `Unknown crmType: ${crmType}` });
  } catch (err) {
    await logError({ req, error: err });
    res.json({ success: false, message: err.response?.data?.errors?.[0]?.message || err.message });
  }
});

router.post('/api/admin/crm/connect-api-key', requirePermission('integrations.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { crmType, credential } = req.body;
  if (!crmType || !credential) return res.status(400).json({ error: 'crmType and credential required' });

  let accountName = null;
  try {
    if (crmType === 'jobber') {
      const accountRes = await retryWithBackoff(
        () => axios.post(
          'https://api.getjobber.com/api/graphql',
          { query: '{ account { name } }' },
          { headers: {
              Authorization: `Bearer ${credential}`,
              'Content-Type': 'application/json',
              'X-JOBBER-GRAPHQL-VERSION': '2026-02-17'
          } }
        ),
        { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
      );
      accountName = accountRes.data?.data?.account?.name;
      if (!accountName) return res.json({ success: false, message: 'Could not verify credential — no account data returned' });
    } else if (crmType === 'servicetitan' || crmType === 'acculynx') {
      return res.json({ success: false, message: `${crmType} adapter not yet implemented` });
    } else {
      return res.status(400).json({ error: `Unknown crmType: ${crmType}` });
    }
  } catch (err) {
    await logError({ req, error: err });
    return res.json({ success: false, message: err.message });
  }

  try {
    const credentialStr = typeof credential === 'object' ? JSON.stringify(credential) : credential;
    // MVP: api_key stored as plaintext — TODO: encrypt before FORA launch
    await pool.query(
      `INSERT INTO contractor_crm_settings
         (contractor_id, crm_type, connection_method, api_key, crm_account_name, is_connected, connected_at)
       VALUES ($1, $2, 'api_key', $3, $4, true, NOW())
       ON CONFLICT (contractor_id) DO UPDATE SET
         crm_type = $2, connection_method = 'api_key', api_key = $3,
         crm_account_name = $4, is_connected = true, connected_at = NOW()`,
      [contractorId, crmType, credentialStr, accountName]
    );
    res.json({ success: true, accountName });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/api/admin/crm/settings', requirePermission('integrations.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { referrerFieldName, stageMap, syncIntervalMins, tag_group_visibility } = req.body;
  try {
    if (referrerFieldName !== undefined || stageMap !== undefined || syncIntervalMins !== undefined) {
      await pool.query(
        `UPDATE contractor_crm_settings
         SET referrer_field_name = COALESCE($2, referrer_field_name),
             stage_map = COALESCE($3, stage_map),
             sync_interval_mins = COALESCE($4, sync_interval_mins)
         WHERE contractor_id = $1`,
        [contractorId, referrerFieldName || null, stageMap ? JSON.stringify(stageMap) : null, syncIntervalMins || null]
      );
    }
    if (tag_group_visibility !== undefined) {
      await pool.query(
        `INSERT INTO contractor_settings (contractor_id, tag_group_visibility)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (contractor_id) DO UPDATE SET tag_group_visibility = $2::jsonb`,
        [contractorId, JSON.stringify(tag_group_visibility)]
      );
    }
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'PUT /api/admin/crm/settings' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/crm/referral-start-date', requirePermission('integrations.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { referralStartDate } = req.body;

  try {
    let parsedDate = null;
    if (referralStartDate != null) {
      parsedDate = new Date(referralStartDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 (e.g. 2026-04-13).' });
      }
    }

    await pool.query(
      `UPDATE contractor_crm_settings SET referral_start_date = $2 WHERE contractor_id = $1`,
      [contractorId, parsedDate]
    );

    const settingsResult = await pool.query(
      'SELECT referral_start_date, connected_at FROM contractor_crm_settings WHERE contractor_id = $1',
      [contractorId]
    );
    const row = settingsResult.rows[0];
    const effectiveStartDate = row?.referral_start_date ?? row?.connected_at ?? null;

    res.json({ success: true, referralStartDate: row?.referral_start_date || null, effectiveStartDate });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/crm/sync', requirePermission('integrations.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const adapter = await getCRMAdapter(contractorId);
    const referrers = await pool.query('SELECT id, full_name FROM users ORDER BY id');
    const errors = [];
    for (const user of referrers.rows) {
      try {
        await adapter.fetchPipelineForReferrer(user.full_name);
      } catch (err) {
        await logError({ req, error: err });
        errors.push(`${user.full_name}: ${err.message}`);
      }
    }
    const lastSyncedAt = new Date();
    await pool.query(
      `UPDATE contractor_crm_settings SET last_synced_at = $1 WHERE contractor_id = $2`,
      [lastSyncedAt, contractorId]
    );
    res.json({ success: true, lastSyncedAt, errors: errors.length ? errors : undefined });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/crm/disconnect', requirePermission('integrations.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    await pool.query(`DELETE FROM tokens WHERE contractor_id = $1`, [contractorId]);
    await pool.query(
      `UPDATE contractor_crm_settings
       SET is_connected = false, crm_type = null, connection_method = null,
           api_key = null, crm_account_name = null
       WHERE contractor_id = $1`,
      [contractorId]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: EXTRACT COLORS FROM URL ───────────────────────────────────────────
router.get('/api/admin/extract-colors', requirePermission('branding'), async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only HTTPS URLs are allowed' });
  }
  const hostname = parsedUrl.hostname;
  const privateIpRe = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})$/;
  if (privateIpRe.test(hostname)) {
    return res.status(400).json({ error: 'Requests to private IP addresses are not allowed' });
  }

  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RoosterBooster/1.0)' },
      responseType: 'text',
    });
    const html = response.data;

    const hexRe = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
    const rawMatches = [];

    const styleTagRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let m;
    while ((m = styleTagRe.exec(html)) !== null) {
      const colors = m[1].match(hexRe);
      if (colors) rawMatches.push(...colors);
    }

    const inlineStyleRe = /style="([^"]*)"/gi;
    while ((m = inlineStyleRe.exec(html)) !== null) {
      const colors = m[1].match(hexRe);
      if (colors) rawMatches.push(...colors);
    }

    function normalize(hex) {
      const h = hex.slice(1);
      const full = h.length === 3
        ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2]
        : h;
      return '#' + full.toLowerCase();
    }

    function lightness(hex) {
      const r = parseInt(hex.slice(1,3),16)/255;
      const g = parseInt(hex.slice(3,5),16)/255;
      const b = parseInt(hex.slice(5,7),16)/255;
      return (Math.max(r,g,b) + Math.min(r,g,b)) / 2;
    }

    const normalized = rawMatches.map(normalize);
    const filtered = normalized.filter(hex => {
      const l = lightness(hex);
      return l >= 0.10 && l <= 0.90;
    });

    const freq = {};
    for (const hex of filtered) {
      freq[hex] = (freq[hex] || 0) + 1;
    }

    const top = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hex]) => hex);

    if (top.length < 3) {
      return res.json({ error: 'Not enough brand colors detected. Try uploading your logo instead.' });
    }

    res.json({ colors: top });
  } catch (err) {
    await logError({ req, error: err });
    res.json({ error: 'Could not reach this website. Try uploading your logo instead.' });
  }
});

// ── ADMIN: FLAGGED REFERRALS ──────────────────────────────────────────────────
router.get('/api/admin/flagged-referrals/summary', requirePermission('referral_review'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM flagged_referrals WHERE reviewed = false AND contractor_id = $1',
      [contractorId]
    );
    res.json({ unresolved_count: parseInt(result.rows[0].count) });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/admin/flagged-referrals', requirePermission('referral_review'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT id, jobber_client_id, client_name, referred_by, pipeline_status,
              flag_reason, reviewed, review_label, review_note, created_at, reviewed_at
       FROM flagged_referrals
       WHERE contractor_id = $1
       ORDER BY reviewed ASC, created_at DESC`,
      [contractorId]
    );
    res.json({ flagged: result.rows });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/api/admin/flagged-referrals/:id', requirePermission('referral_review.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { reviewed, review_label, review_note } = req.body;
  try {
    const result = await pool.query(
      `UPDATE flagged_referrals
       SET reviewed = $1, review_label = $2, review_note = $3,
           reviewed_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END
       WHERE id = $4 AND contractor_id = $5
       RETURNING id`,
      [reviewed, review_label ?? null, review_note ?? null, req.params.id, contractorId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

const backupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many backup requests. Please try again in an hour.' }
});

// ── ADMIN: MANUAL BACKUP TRIGGER ──────────────────────────────────────────────
router.post('/api/admin/backup/run', backupLimiter, requirePermission('advanced'), async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    await runBackup();
    res.json({ success: true, message: 'Backup completed successfully' });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── ADMIN: VERIFY LATEST BACKUP ───────────────────────────────────────────────
router.post('/api/admin/backup/verify', backupLimiter, requirePermission('advanced'), async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const lines = [];
  const origLog = console.log;
  console.log = (...args) => {
    lines.push(args.map(String).join(' '));
    origLog(...args);
  };
  try {
    await runVerify();
    res.json({ success: true, output: lines });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    console.log = origLog;
  }
});

// ── ADMIN: PENDING REFERRALS ──────────────────────────────────────────────────

const resendInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many resend attempts. Please try again in an hour.' }
});

router.get('/api/admin/pending-referrals', requirePermission('referral_review'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const includeClosed = req.query.include_closed === 'true';
  try {
    const statusFilter = includeClosed ? '' : `AND status != 'closed'`;
    const result = await pool.query(
      `SELECT id, contractor_id, jobber_client_id, client_name, referred_by_name,
              referred_by_phone, referred_by_email, invite_sent_at, invite_channel,
              invite_resent_at, matched_user_id, matched_at, match_seen_at,
              closed_out_by_admin, closed_out_at, closed_out_note, status, created_at,
              needs_admin_verification, jobber_name_matches, referrer_lookup_attempted,
              credit_email_sent_at
       FROM pending_referrals
       WHERE contractor_id = $1 ${statusFilter}
       ORDER BY
         CASE WHEN needs_admin_verification THEN 0 ELSE 1 END,
         CASE status WHEN 'pending' THEN 0 WHEN 'matched' THEN 1 ELSE 2 END,
         created_at DESC`,
      [contractorId]
    );
    res.json({ pending: result.rows });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/pending-referrals/:id/resend', resendInviteLimiter, requirePermission('referral_review.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT id, referred_by_name, referred_by_email, referred_by_phone, status
       FROM pending_referrals WHERE id=$1 AND contractor_id=$2`,
      [req.params.id, contractorId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const record = result.rows[0];

    if (record.status === 'closed') {
      return res.status(400).json({ error: 'Cannot resend invite to a closed record.' });
    }
    if (!record.referred_by_email && !record.referred_by_phone) {
      return res.status(400).json({ error: 'No contact info available to resend.' });
    }

    const { sendPendingInviteEmail, sendPendingInviteSMS } = require('../../utils/pendingReferral');
    if (record.referred_by_email) await sendPendingInviteEmail(record, contractorId);
    if (record.referred_by_phone) await sendPendingInviteSMS(record, contractorId);

    await pool.query(
      'UPDATE pending_referrals SET invite_resent_at=NOW() WHERE id=$1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/pending-referrals/:id/close', requirePermission('referral_review.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { note } = req.body || {};
  if (note && note.length > 500) return res.status(400).json({ error: 'Note must be 500 characters or less.' });
  try {
    const result = await pool.query(
      `UPDATE pending_referrals
       SET closed_out_by_admin=true, closed_out_at=NOW(), status='closed',
           closed_out_note=$1
       WHERE id=$2 AND contractor_id=$3
       RETURNING id`,
      [note || null, req.params.id, contractorId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/pending-referrals/:id/confirm-referrer', requirePermission('referral_review.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { referrer_name, referrer_jobber_id } = req.body || {};
  try {
    let referrerPhone = null;
    let referrerEmail = null;
    if (referrer_jobber_id) {
      const { fetchReferrerContact } = require('../../utils/pendingReferral');
      const contact = await fetchReferrerContact(String(referrer_jobber_id), contractorId);
      referrerPhone = contact.phone;
      referrerEmail = contact.email;
    }

    const result = await pool.query(
      `UPDATE pending_referrals
       SET referred_by_phone=$1, referred_by_email=$2, referred_by_name=$3,
           needs_admin_verification=false
       WHERE id=$4 AND contractor_id=$5
       RETURNING id, referred_by_name, referred_by_email, referred_by_phone, status`,
      [referrerPhone || null, referrerEmail || null, referrer_name || null, req.params.id, contractorId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const record = result.rows[0];

    const { sendPendingInviteEmail, sendPendingInviteSMS } = require('../../utils/pendingReferral');
    let inviteChannel = 'none';
    if (referrerEmail) {
      await sendPendingInviteEmail(record, contractorId);
      inviteChannel = referrerPhone ? 'email_and_sms' : 'email';
    }
    if (referrerPhone) {
      await sendPendingInviteSMS(record, contractorId);
      if (inviteChannel === 'email') inviteChannel = 'email_and_sms';
      else if (inviteChannel === 'none') inviteChannel = 'sms';
    }

    await pool.query(
      `UPDATE pending_referrals SET invite_channel=$1, invite_sent_at=NOW() WHERE id=$2`,
      [inviteChannel, req.params.id]
    );

    await pool.query(
      `INSERT INTO activity_log (event_type, detail) VALUES ('pending_referral_referrer_confirmed', $1)`,
      [`Admin confirmed referrer "${referrer_name}" for pending referral #${req.params.id}. Invite sent via ${inviteChannel}.`]
    );

    res.json({ success: true, inviteChannel });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: BOOKING REQUESTS ───────────────────────────────────────────────────
router.get('/api/admin/booking-requests', requirePermission('referral_review'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT br.id, br.referred_name, br.referred_phone, br.referred_email,
              br.referred_address, br.notes, br.status, br.created_at, br.matched_at,
              br.jobber_client_id,
              u.full_name AS submitted_by_name, u.email AS submitted_by_email,
              ref.full_name AS referrer_name
       FROM booking_requests br
       JOIN users u ON u.id = br.submitted_by_user_id
       LEFT JOIN users ref ON ref.id = u.invited_by_user_id
       WHERE br.contractor_id = $1
       ORDER BY
         CASE WHEN br.status = 'pending' THEN 0 ELSE 1 END,
         br.created_at DESC`,
      [contractorId]
    );
    res.json({ bookingRequests: result.rows });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: MISSING REFERRAL REPORTS ───────────────────────────────────────────

const ADMIN_CHANNEL_LABELS = {
  qr_code:                  'In-app QR code',
  personal_link:            'Personal link via app',
  company_info_via_app:     'Sent company info via app',
  company_info_outside_app: 'Sent company info outside of app',
  salesman_contact:         'Sent salesman\'s contact info',
};

router.get('/api/admin/missing-referrals', requirePermission('referral_review'), async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT mrr.id, mrr.referred_name, mrr.referred_contact, mrr.channel,
              mrr.approximate_date, mrr.admin_note, mrr.resolved, mrr.resolved_at,
              mrr.created_at, u.full_name AS referrer_name, u.email AS referrer_email
       FROM missing_referral_reports mrr
       JOIN users u ON u.id = mrr.user_id
       ORDER BY mrr.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/api/admin/missing-referrals/:id/resolve', requirePermission('referral_review.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) return res.status(400).json({ error: 'Invalid report id' });

  const admin_note = req.body.admin_note
    ? String(req.body.admin_note).trim().substring(0, 1000)
    : null;

  try {
    const updateResult = await pool.query(
      `UPDATE missing_referral_reports
       SET resolved=true, resolved_at=NOW(), admin_note=$1
       WHERE id=$2
       RETURNING id, user_id, referred_name, channel`,
      [admin_note, id]
    );
    if (updateResult.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    const report = updateResult.rows[0];

    const userResult = await pool.query(
      'SELECT full_name, email FROM users WHERE id=$1',
      [report.user_id]
    );
    const referrer = userResult.rows[0];

    if (referrer?.email) {
      try {
        const suppressed12 = await isEmailSuppressed(contractorId, referrer.email, 'missing_referral_resolved');
        let senderName = 'RoofMiles';
        try {
          const settingsRes = await pool.query(
            `SELECT COALESCE(email_sender_name, company_name, 'RoofMiles') AS sender_name
             FROM contractor_settings WHERE contractor_id = $1`,
            [contractorId]
          );
          senderName = settingsRes.rows[0]?.sender_name || 'RoofMiles';
        } catch (settingsErr) {
          await logError({ req, error: settingsErr });
        }
        if (!suppressed12) await retryWithBackoff(
          () => resend.emails.send({
            from: `${senderName} <noreply@roofmiles.com>`,
            to: referrer.email,
            subject: 'Your Missing Referral Was Found! 🎉',
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
                <h2 style="color:#012854;margin:0 0 12px">Great news, ${referrer.full_name}!</h2>
                <p style="color:#333;line-height:1.6;margin:0 0 16px">
                  We found your missing referral and it's been added to your pipeline!
                  Tap the button below to check it out.
                </p>
                <a href="${process.env.FRONTEND_URL}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">
                  View My Pipeline
                </a>
                <p style="color:#888;font-size:12px;margin-top:24px">
                  Questions? Reply to this email and we'll help.
                </p>
              </div>
            `,
          }),
          { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
        );
      } catch (emailErr) {
        await logError({ req, error: emailErr });
      }
    }

    const channelLabel = ADMIN_CHANNEL_LABELS[report.channel] || report.channel;
    try {
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, detail)
         VALUES ('missing_referral_resolved', $1, $2)`,
        [
          referrer?.full_name || 'Unknown',
          `Admin resolved missing referral report for "${report.referred_name}" via ${channelLabel}${admin_note ? `. Note: ${admin_note}` : ''}`,
        ]
      );
    } catch (logErr) {
      await logError({ req, error: logErr });
    }

    res.json(updateResult.rows[0]);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: INBOX MESSAGES ─────────────────────────────────────────────────────
router.get('/api/admin/messages', requirePermission('referral_review'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT
         am.id, am.message_type, am.reference_id, am.title, am.body,
         am.color_code, am.read, am.created_at,
         mrs.referred_name,
         u1.full_name  AS referrer_name,
         u1.email      AS referrer_email,
         sbs.message_text,
         u2.full_name  AS submitter_name,
         u2.email      AS submitter_email
       FROM admin_messages am
       LEFT JOIN missing_referral_reports mrs
         ON am.message_type = 'missing_referral' AND am.reference_id = mrs.id
       LEFT JOIN users u1
         ON am.message_type = 'missing_referral' AND mrs.user_id = u1.id
       LEFT JOIN suggestion_box_submissions sbs
         ON am.message_type = 'suggestion_box' AND am.reference_id = sbs.id
       LEFT JOIN users u2
         ON am.message_type = 'suggestion_box' AND sbs.user_id = u2.id
       WHERE am.contractor_id = $1
       ORDER BY am.created_at DESC`,
      [contractorId]
    );
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/api/admin/messages/:id/read', requirePermission('referral_review'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) return res.status(400).json({ error: 'Invalid message id' });
  try {
    await pool.query(
      `UPDATE admin_messages SET read = true WHERE id = $1 AND contractor_id = $2`,
      [id, contractorId]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM admin_messages WHERE contractor_id = $1 AND read = false`,
      [contractorId]
    );
    const unreadCount = parseInt(countResult.rows[0].count, 10);

    try {
      await pool.query(
        `INSERT INTO activity_log (event_type, detail) VALUES ('admin', $1)`,
        [`Admin marked inbox message #${id} as read`]
      );
    } catch (logErr) {
      await logError({ req, error: logErr });
    }

    res.json({ success: true, unreadCount });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN: JOBBER FIELD MAPPING ───────────────────────────────────────────────

const VALID_MAPPING_KEYS = ['work_category', 'job_source', 'material_type', 'assigned_rep'];

router.get('/api/admin/jobber/fields', requirePermission('integrations'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT jobber_field_id, label, field_type, options, discovered_at
       FROM contractor_jobber_fields
       WHERE contractor_id = $1
       ORDER BY label ASC`,
      [contractorId]
    );
    res.json({ fields: result.rows });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/admin/jobber/discover-fields', requirePermission('integrations.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const fields = await discoverJobberFields(contractorId);
    res.json({ fields });
  } catch (err) {
    await logError({ req, error: err });
    if (err.message && err.message.includes('No Jobber token')) {
      return res.status(400).json({ error: 'no_token', message: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/admin/jobber/field-mappings', requirePermission('integrations'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT contractor_field_mappings FROM contractor_settings WHERE contractor_id = $1`,
      [contractorId]
    );
    const mappings = result.rows[0]?.contractor_field_mappings || {};
    res.json({ mappings });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/api/admin/jobber/field-mappings', requirePermission('integrations.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const body = req.body || {};

  const invalidKeys = Object.keys(body).filter(k => !VALID_MAPPING_KEYS.includes(k));
  if (invalidKeys.length > 0) {
    return res.status(400).json({ error: `Invalid mapping keys: ${invalidKeys.join(', ')}. Allowed keys: ${VALID_MAPPING_KEYS.join(', ')}` });
  }

  const payload = {};
  for (const key of VALID_MAPPING_KEYS) {
    if (body[key] && typeof body[key] === 'string') {
      payload[key] = body[key];
    }
  }

  try {
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, contractor_field_mappings)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (contractor_id) DO UPDATE SET contractor_field_mappings = $2::jsonb`,
      [contractorId, JSON.stringify(payload)]
    );
    res.json({ mappings: payload });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── JOBBER CLIENT IMPORT ──────────────────────────────────────────────────────

const { runFullJobberImport, importState } = require('../../jobs/fullJobberImport');

// POST /api/admin/jobber-full-import
// Starts a one-time full Jobber client import. Fire-and-forget — returns 202 immediately.
router.post('/api/admin/jobber-full-import', requirePermission('integrations.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;

  const { filterPreference } = req.body;
  const validModes = ['recommended', 'custom_date', 'pull_all', 'paying_only'];

  if (!filterPreference || !validModes.includes(filterPreference.mode)) {
    return res.status(400).json({ error: 'filterPreference.mode must be one of: recommended, custom_date, pull_all' });
  }

  if (filterPreference.mode === 'custom_date') {
    const d = new Date(filterPreference.customDate);
    if (!filterPreference.customDate || isNaN(d.getTime())) {
      return res.status(400).json({ error: 'filterPreference.customDate must be a valid date when mode is custom_date' });
    }
  }

  if (importState.status === 'running') {
    return res.status(409).json({ error: 'Import already in progress' });
  }

  runFullJobberImport(contractorId, filterPreference); // fire and forget
  res.status(202).json({ message: 'Import started', status: 'running' });
});

// GET /api/admin/jobber-import-status
// Returns current import state.
router.get('/api/admin/jobber-import-status', requirePermission('integrations'), async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  res.json(importState);
});

module.exports = router;








