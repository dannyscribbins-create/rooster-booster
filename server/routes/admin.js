const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { getCRMAdapter } = require('../crm/index');
const axios = require('axios');
const { verifyAdminSession } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { logError } = require('../middleware/errorLogger');
const { body, validationResult } = require('express-validator');
const { getPeriodDateRange } = require('../utils/dateUtils');
const { runBackup } = require('../utils/backup');
const { runVerify } = require('../utils/restore-verify');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { resendShouldRetry, jobberShouldRetry } = require('../utils/retryHelpers');

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

if (!process.env.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD environment variable is required');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// ── ADMIN: AUTH ───────────────────────────────────────────────────────────────
router.post('/api/admin/login', adminLoginLimiter, [
  body('password').notEmpty().withMessage('Password is required').isString().isLength({ max: 200 }).withMessage('Password too long'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  if (req.body.password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Incorrect password' });
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at, role) VALUES (NULL,$1,$2,$3)',
      [token, expiresAt, 'admin']
    );
    res.json({ success: true, token });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// ── ADMIN: REFERRERS ──────────────────────────────────────────────────────────
router.get('/api/admin/users', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { signup_source, joined_after, joined_before } = req.query;
  try {
    const conditions = [];
    const params = [];
    if (signup_source) {
      params.push(signup_source);
      conditions.push(`u.signup_source = $${params.length}`);
    }
    if (joined_after) {
      params.push(new Date(joined_after));
      conditions.push(`u.created_at >= $${params.length}`);
    }
    if (joined_before) {
      params.push(new Date(joined_before));
      conditions.push(`u.created_at <= $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT
        u.id, u.full_name, u.email, u.phone, u.created_at,
        u.signup_source, u.invited_by_user_id, u.jobber_client_id,
        u.email_verified,
        ref.full_name AS invited_by_name,
        CASE
          WHEN u.signup_source != 'peer_link' THEN NULL
          WHEN (
            EXISTS (SELECT 1 FROM referral_conversions rc WHERE rc.user_id = u.id)
            OR EXISTS (SELECT 1 FROM pipeline_cache pc WHERE LOWER(pc.referred_by) = LOWER(u.full_name) AND pc.pipeline_status = 'paid' AND pc.contractor_id = 'accent-roofing')
          ) THEN 'in_pipeline_paid'
          WHEN EXISTS (SELECT 1 FROM pipeline_cache pc WHERE LOWER(pc.referred_by) = LOWER(u.full_name) AND pc.pipeline_status = 'sold' AND pc.contractor_id = 'accent-roofing') THEN 'in_pipeline_sold'
          WHEN EXISTS (SELECT 1 FROM pipeline_cache pc WHERE LOWER(pc.referred_by) = LOWER(u.full_name) AND pc.pipeline_status = 'inspection' AND pc.contractor_id = 'accent-roofing') THEN 'in_pipeline_inspection'
          WHEN EXISTS (SELECT 1 FROM pipeline_cache pc WHERE LOWER(pc.referred_by) = LOWER(u.full_name) AND pc.contractor_id = 'accent-roofing') THEN 'in_pipeline_lead'
          WHEN EXISTS (SELECT 1 FROM booking_requests br WHERE br.submitted_by_user_id = u.id AND br.status != 'matched') THEN 'booking_requested'
          ELSE 'app_account_only'
        END AS lifecycle_status
      FROM users u
      LEFT JOIN users ref ON ref.id = u.invited_by_user_id
      ${where}
      ORDER BY u.created_at DESC
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});
router.post('/api/admin/users', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { full_name, email, pin, phone } = req.body;
  try {
    const hashedPin = await bcrypt.hash(String(pin), 10);
    const result = await pool.query(
      'INSERT INTO users (full_name,email,pin,phone) VALUES ($1,$2,$3,$4) RETURNING id,full_name,email,phone,created_at',
      [full_name, email, hashedPin, phone || null]
    );
    const newUser = result.rows[0];

    // Award founding_referrer badge to the first 20 users ever registered.
    // MVP shortcut: at FORA scale, scope this count per contractorId so each
    // contractor gets their own founding cohort of 20.
    // TODO: when self-serve signup is built, add the same founding_referrer check
    // to that new registration endpoint.
    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
    if (parseInt(countResult.rows[0].total) <= 20) {
      await pool.query(
        `INSERT INTO user_badges (user_id, badge_id, seen)
         VALUES ($1, 'founding_referrer', false)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [newUser.id]
      );
    }

    res.json(newUser);
  } catch (err) {
    await logError({ req, error: err });
    res.status(err.code === '23505' ? 400 : 500).json({ error: err.code === '23505' ? 'Email already exists' : err.message });
  }
});
router.patch('/api/admin/users/:id/pin', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { pin } = req.body;
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });
  try {
    await pool.query('UPDATE users SET pin=$1 WHERE id=$2', [await bcrypt.hash(String(pin), 10), req.params.id]);
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});
router.delete('/api/admin/users/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: MATCH USER TO JOBBER CLIENT ────────────────────────────────────────
router.post('/api/admin/users/:id/match-jobber', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const userResult = await pool.query('SELECT id, full_name, email, phone FROM users WHERE id = $1', [req.params.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    // pipeline_cache is the source of truth for all referred clients — name match is reliable
    // because syncSingleClient writes client_name from Jobber firstName + lastName.
    const cacheResult = await pool.query(
      `SELECT jobber_client_id, client_name FROM pipeline_cache
       WHERE contractor_id = 'accent-roofing'
         AND LOWER(client_name) = LOWER($1)
       LIMIT 1`,
      [user.full_name]
    );

    if (cacheResult.rows.length > 0) {
      const matched = cacheResult.rows[0];
      await pool.query('UPDATE users SET jobber_client_id = $1 WHERE id = $2', [matched.jobber_client_id, user.id]);
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('admin', $1, $2, $3)`,
        [user.full_name, user.email, `Admin manually matched to Jobber client via pipeline_cache: ${matched.jobber_client_id}`]
      );
      return res.json({ matched: true, jobberClientId: matched.jobber_client_id, message: 'Matched to Jobber client.' });
    } else {
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('admin', $1, $2, $3)`,
        [user.full_name, user.email, 'Admin manual Jobber match: client not found in pipeline_cache — Referred By field may not be set in Jobber']
      );
      return res.json({ matched: false, jobberClientId: null, message: 'Client not found. Make sure the Referred By field is set in Jobber for this client.' });
    }
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Jobber match failed: ' + err.message });
  }
});

// ── ADMIN: REFERRER DETAIL ────────────────────────────────────────────────────
router.get('/api/admin/referrer/:name', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const name = decodeURIComponent(req.params.name);
    // TODO: pull contractorId from admin session token when multi-contractor is live
    const contractorId = 'accent-roofing';
    const adapter = await getCRMAdapter(contractorId);
    const [pipelineData, userResult] = await Promise.all([
      adapter.fetchPipelineForReferrer(name),
      pool.query(
        `SELECT
          u.id, u.full_name, u.email, u.created_at,
          u.signup_source, u.invited_by_user_id, u.jobber_client_id,
          u.email_verified,
          ref.full_name AS invited_by_name,
          (SELECT COUNT(*) FROM user_badges WHERE user_id = u.id) AS badge_count
         FROM users u
         LEFT JOIN users ref ON ref.id = u.invited_by_user_id
         WHERE u.full_name = $1
         LIMIT 1`,
        [name]
      ),
    ]);
    const userInfo = userResult.rows[0] || null;
    res.json({ ...pipelineData, userInfo });
  } catch (err) {
    await logError({ req, error: err });
    if (err.message && (err.message.includes('No CRM connected') || err.message.includes('No connected CRM'))) {
      return res.status(503).json({ error: 'crm_not_connected', message: 'No CRM is connected for this contractor. Please connect a CRM in admin settings.' });
    }
    console.error('CRM fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch referrer data: ' + err.message });
  }
});

// ── ADMIN: CASH OUTS ──────────────────────────────────────────────────────────
router.get('/api/admin/cashouts', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT id, user_id, full_name, email, amount, method, status, requested_at FROM cashout_requests ORDER BY requested_at DESC');
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});
router.patch('/api/admin/cashouts/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { status } = req.body;
  if (!['approved','denied'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'UPDATE cashout_requests SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const cashout = result.rows[0];

    await client.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('admin',$1,$2,$3)`,
      [cashout.full_name, cashout.email,
       `Cash out request #${req.params.id} ${status} ($${cashout.amount})`]
    );

    if (status === 'approved') {
      // SCALABLE: wrap Stripe ACH call inside this transaction before committing approved status
      if (cashout.user_id == null) {
        await logError({ req, error: { message: `Payout announcement skipped: cashout_request #${req.params.id} has no user_id`, severity: 'INFO' } });
      } else {
        await client.query(
          `INSERT INTO payout_announcements (cashout_request_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (cashout_request_id) DO NOTHING`,
          [req.params.id, cashout.user_id]
        );
      }
    }

    await client.query('COMMIT');
    res.json(cashout);
  } catch (err) {
    await client.query('ROLLBACK');
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── ADMIN: ACTIVITY LOG ───────────────────────────────────────────────────────
router.get('/api/admin/activity', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT id, event_type, full_name, email, detail, created_at FROM activity_log ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: DASHBOARD STATS (cached 15 min) ────────────────────────────────────
router.get('/api/admin/stats', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { refresh } = req.query;
  try {
    if (refresh !== 'true') {
      const cached = await pool.query('SELECT stats, cached_at FROM admin_cache WHERE id=1');
      if (cached.rows.length > 0) {
        const ageMin = (Date.now() - new Date(cached.rows[0].cached_at).getTime()) / 60000;
        if (ageMin < 15) return res.json({ ...cached.rows[0].stats, cachedAt: cached.rows[0].cached_at, fromCache: true });
      }
    }
    const usersResult = await pool.query('SELECT full_name FROM users');
    const allUsers = usersResult.rows;
    let totalReferrals=0, totalSold=0, totalNotSold=0, totalLeads=0, totalInspections=0, totalBalance=0, activeReferrers=0;
    // TODO: pull contractorId from admin session token when multi-contractor is live
    const contractorId = 'accent-roofing';
    let adapter;
    try {
      adapter = await getCRMAdapter(contractorId);
    } catch (err) {
      if (err.message && (err.message.includes('No CRM connected') || err.message.includes('No connected CRM'))) {
        return res.status(503).json({ error: 'crm_not_connected', message: 'No CRM is connected for this contractor. Please connect a CRM in admin settings.' });
      }
      throw err;
    }
    for (const user of allUsers) {
      try {
        const data = await adapter.fetchPipelineForReferrer(user.full_name);
        const p = data.pipeline;
        if (p.length > 0) activeReferrers++;
        totalReferrals   += p.length;
        totalSold        += p.filter(x => x.status==='sold').length;
        totalNotSold     += p.filter(x => x.status==='closed').length;
        totalLeads       += p.filter(x => x.status==='lead').length;
        totalInspections += p.filter(x => x.status==='inspection').length;
        totalBalance     += data.balance;
      } catch(e) {
        await logError({ req, error: e });
        console.error(`Stats: failed for ${user.full_name}:`, e.message);
      }
    }
    const paidRes    = await pool.query(`SELECT COALESCE(SUM(amount),0) as total FROM cashout_requests WHERE status='approved'`);
    const pendingRes = await pool.query(`SELECT COUNT(*) as count FROM cashout_requests WHERE status='pending'`);
    const stats = {
      totalReferrers: allUsers.length, activeReferrers,
      totalReferrals, totalSold, totalNotSold, totalLeads, totalInspections,
      totalBalance, totalPaidOut: parseFloat(paidRes.rows[0].total),
      pendingCashouts: parseInt(pendingRes.rows[0].count),
    };
    await pool.query(
      `INSERT INTO admin_cache (id,stats,cached_at) VALUES (1,$1,NOW())
       ON CONFLICT (id) DO UPDATE SET stats=$1, cached_at=NOW()`,
      [JSON.stringify(stats)]
    );
    res.json({ ...stats, cachedAt: new Date(), fromCache: false });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Stats failed: ' + err.message });
  }
});

// ── ADMIN: ABOUT ──────────────────────────────────────────────────────────────
router.get('/api/admin/about', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT contractor_id, enabled, booking_enabled, bio, years_in_business,
              service_area, google_place_id, certifications, booking_email, updated_at
       FROM contractor_about WHERE contractor_id = 'accent-roofing' LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.json({
        contractor_id: 'accent-roofing',
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
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/about', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { enabled, booking_enabled, bio, years_in_business, service_area, google_place_id, certifications, booking_email } = req.body;
  try {
    await pool.query(
      `INSERT INTO contractor_about (contractor_id, enabled, booking_enabled, bio, years_in_business, service_area, google_place_id, certifications, booking_email, updated_at)
       VALUES ('accent-roofing', $1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (contractor_id) DO UPDATE SET
         enabled=$1, booking_enabled=$2, bio=$3, years_in_business=$4, service_area=$5,
         google_place_id=$6, certifications=$7, booking_email=$8, updated_at=NOW()`,
      [enabled, booking_enabled, bio, years_in_business, service_area, google_place_id, JSON.stringify(certifications || []), booking_email]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    console.error('POST /api/admin/about error:', err.message, err.stack);
    res.status(500).json({ error: 'Save failed', detail: err.message });
  }
});

// ── ADMIN: ANNOUNCEMENT SETTINGS ──────────────────────────────────────────────
router.get('/api/admin/announcement-settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT enabled, mode, custom_message FROM announcement_settings WHERE id = 1');
    res.json(result.rows[0] || { enabled: true, mode: 'preset_1', custom_message: null });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/announcement-settings', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: LEADERBOARD ────────────────────────────────────────────────────────

router.get('/api/admin/leaderboard', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const settingsResult = await pool.query(
      `SELECT year_start_month, quarter_1_start, quarter_2_start,
              quarter_3_start, quarter_4_start, warmup_mode_enabled
       FROM engagement_settings WHERE contractor_id=$1`,
      ['accent-roofing']
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
         LEFT JOIN referral_conversions rc ON rc.user_id = u.id AND rc.contractor_id = 'accent-roofing'
         GROUP BY u.id, u.full_name, u.email
         ORDER BY converted_count DESC
         LIMIT 50`
      );
    } else {
      result = await pool.query(
        `SELECT u.id, u.full_name, u.email, COUNT(rc.id) as converted_count
         FROM users u
         LEFT JOIN referral_conversions rc ON rc.user_id = u.id
           AND rc.contractor_id = 'accent-roofing'
           AND rc.converted_at >= $1 AND rc.converted_at < $2
         GROUP BY u.id, u.full_name, u.email
         ORDER BY converted_count DESC
         LIMIT 50`,
        [start, end]
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

    // Auto-disable warmup mode if 5+ real referrers now have conversions
    let warmup_just_disabled = false;
    if (warmup_mode_enabled) {
      const realWithCount = rows.filter(r => r.converted_count > 0).length;
      if (realWithCount >= 5) {
        await pool.query(
          `UPDATE engagement_settings SET warmup_mode_enabled=false WHERE contractor_id='accent-roofing'`
        );
        warmup_just_disabled = true;
      }
    }

    res.json({ rows, warmup_just_disabled });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: ENGAGEMENT SETTINGS ────────────────────────────────────────────────
router.get('/api/admin/engagement-settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT leaderboard_enabled, quarterly_prizes, yearly_prizes,
              year_start_month, quarter_1_start, quarter_2_start,
              quarter_3_start, quarter_4_start,
              warmup_mode_enabled, shouts_enabled, experience_flow_enabled
       FROM engagement_settings WHERE contractor_id = $1`,
      ['accent-roofing']
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
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/engagement-settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const {
    leaderboard_enabled, quarterly_prizes, yearly_prizes,
    year_start_month, quarter_1_start, quarter_2_start, quarter_3_start, quarter_4_start,
    warmup_mode_enabled, shouts_enabled, experience_flow_enabled,
  } = req.body;
  if (typeof leaderboard_enabled !== 'boolean') {
    return res.status(400).json({ error: 'leaderboard_enabled must be a boolean' });
  }
  if (!Array.isArray(quarterly_prizes) || quarterly_prizes.length > 3) {
    return res.status(400).json({ error: 'quarterly_prizes must be an array of max 3 items' });
  }
  if (!Array.isArray(yearly_prizes) || yearly_prizes.length > 3) {
    return res.status(400).json({ error: 'yearly_prizes must be an array of max 3 items' });
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
         contractor_id, leaderboard_enabled, quarterly_prizes, yearly_prizes,
         year_start_month, quarter_1_start, quarter_2_start, quarter_3_start, quarter_4_start,
         warmup_mode_enabled, shouts_enabled, experience_flow_enabled, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (contractor_id) DO UPDATE
         SET leaderboard_enabled=$2, quarterly_prizes=$3, yearly_prizes=$4,
             year_start_month=$5, quarter_1_start=$6, quarter_2_start=$7,
             quarter_3_start=$8, quarter_4_start=$9,
             warmup_mode_enabled=$10, shouts_enabled=$11,
             experience_flow_enabled=$12, updated_at=NOW()`,
      [
        'accent-roofing', leaderboard_enabled,
        JSON.stringify(quarterly_prizes), JSON.stringify(yearly_prizes),
        monthFields.year_start_month, monthFields.quarter_1_start, monthFields.quarter_2_start,
        monthFields.quarter_3_start, monthFields.quarter_4_start,
        warmup_mode_enabled, shouts_enabled, experience_flow_enabled,
      ]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: INVITE LINKS ───────────────────────────────────────────────────────
router.post('/api/admin/invite-links', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
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
       VALUES ('accent-roofing', $1, $2, NULL, true)`,
      [slug, linkType]
    );
    await pool.query(
      `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('admin', 'Admin', '', $1)`,
      [`Generated ${linkType} invite link: ${slug}`]
    );
    res.json({ slug, fullUrl });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/admin/invite-links', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const result = await pool.query(
      `SELECT id, slug, link_type, active, created_at
       FROM contractor_invite_links
       WHERE contractor_id='accent-roofing' AND active=true
       ORDER BY created_at DESC`
    );
    const rows = result.rows.map(r => ({
      ...r,
      fullUrl: `${frontendUrl}?signup=${r.slug}`,
    }));
    res.json(rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: CONTRACTOR SETTINGS ────────────────────────────────────────────────
router.get('/api/admin/settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT contractor_id, company_name, company_phone, company_email, company_url,
              company_address, company_city, company_state, company_zip, company_country,
              logo_url, app_logo_url, primary_color, secondary_color, accent_color,
              social_facebook, social_instagram, social_google, social_nextdoor, social_website,
              review_url, review_button_text, review_message,
              font_heading, font_body, app_display_name, tagline,
              email_sender_name, email_footer_text, created_at, updated_at
       FROM contractor_settings WHERE contractor_id = 'accent-roofing' LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.json({
        contractor_id: 'accent-roofing',
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
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/admin/settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id. FORA: pull from admin session token
  const contractorId = 'accent-roofing';
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
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: CRM SETTINGS ───────────────────────────────────────────────────────

// GET /api/admin/crm/status
// Returns current CRM connection state for the contractor.
router.get('/api/admin/crm/status', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
  try {
    const settingsResult = await pool.query(
      `SELECT contractor_id, crm_type, crm_account_name, connection_method, api_key,
              referrer_field_name, stage_map, connected_at, last_synced_at,
              sync_interval_mins, is_connected, referral_start_date
       FROM contractor_crm_settings WHERE contractor_id = $1`,
      [contractorId]
    );
    if (settingsResult.rows.length === 0) {
      return res.json({
        isConnected: false, crmType: null, crmAccountName: null,
        connectionMethod: null, referrerFieldName: 'Referred by',
        stageMap: { lead: 'Quote Sent', inspection: 'Assessment Scheduled', sold: 'Job Approved', paid: 'Invoice Paid' },
        connectedAt: null, lastSyncedAt: null, syncIntervalMins: 30, tokenStatus: 'missing',
      });
    }
    const s = settingsResult.rows[0];

    // Check OAuth token status
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

    // Trigger background sync if overdue (fire-and-forget, don't block response)
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
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/crm/test-connection
// Body: { crmType, credential }
// Tests that the credential can reach the CRM API. Does not save anything.
router.post('/api/admin/crm/test-connection', async (req, res) => {
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

// POST /api/admin/crm/connect-api-key
// Body: { crmType, credential }
// Tests connection first, then saves to contractor_crm_settings as api_key connection.
router.post('/api/admin/crm/connect-api-key', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
  const { crmType, credential } = req.body;
  if (!crmType || !credential) return res.status(400).json({ error: 'crmType and credential required' });

  // Test first
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

  // Save
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
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/crm/settings
// Body: { referrerFieldName, stageMap, syncIntervalMins }
// Updates field mapping and sync settings.
router.put('/api/admin/crm/settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
  const { referrerFieldName, stageMap, syncIntervalMins } = req.body;
  try {
    await pool.query(
      `UPDATE contractor_crm_settings
       SET referrer_field_name = COALESCE($2, referrer_field_name),
           stage_map = COALESCE($3, stage_map),
           sync_interval_mins = COALESCE($4, sync_interval_mins)
       WHERE contractor_id = $1`,
      [contractorId, referrerFieldName || null, stageMap ? JSON.stringify(stageMap) : null, syncIntervalMins || null]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/crm/referral-start-date
// Body: { referralStartDate: '2026-04-13' } or { referralStartDate: null } to reset to default.
// Sets the date filter for fetchPipelineForReferrer — only clients created on/after this date
// will appear in referrers' pipelines. When null, falls back to connected_at.
router.post('/api/admin/crm/referral-start-date', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // TODO FORA: pull contractorId from session token instead of hardcoding accent-roofing
  const contractorId = 'accent-roofing';
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/crm/sync
// Triggers a pipeline sync for all active referrers and updates last_synced_at.
router.post('/api/admin/crm/sync', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    // TODO: pull contractorId from admin session token when multi-contractor is live
    const contractorId = 'accent-roofing';
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
      `UPDATE contractor_crm_settings SET last_synced_at = $1 WHERE contractor_id = 'accent-roofing'`,
      [lastSyncedAt]
    );
    res.json({ success: true, lastSyncedAt, errors: errors.length ? errors : undefined });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/crm/disconnect
// Removes OAuth token and marks CRM as disconnected.
router.post('/api/admin/crm/disconnect', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
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
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: EXTRACT COLORS FROM URL ───────────────────────────────────────────
router.get('/api/admin/extract-colors', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  // SSRF protection: validate URL before making any outbound request
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
  // Reject private/loopback/link-local IP ranges
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

    // Extract from <style> tag contents
    const styleTagRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let m;
    while ((m = styleTagRe.exec(html)) !== null) {
      const colors = m[1].match(hexRe);
      if (colors) rawMatches.push(...colors);
    }

    // Extract from inline style attributes
    const inlineStyleRe = /style="([^"]*)"/gi;
    while ((m = inlineStyleRe.exec(html)) !== null) {
      const colors = m[1].match(hexRe);
      if (colors) rawMatches.push(...colors);
    }

    // Normalize 3-digit and 6-digit hex to lowercase 6-digit
    function normalize(hex) {
      const h = hex.slice(1);
      const full = h.length === 3
        ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2]
        : h;
      return '#' + full.toLowerCase();
    }

    // Compute perceptual lightness from hex
    function lightness(hex) {
      const r = parseInt(hex.slice(1,3),16)/255;
      const g = parseInt(hex.slice(3,5),16)/255;
      const b = parseInt(hex.slice(5,7),16)/255;
      return (Math.max(r,g,b) + Math.min(r,g,b)) / 2;
    }

    const normalized = rawMatches.map(normalize);

    // Filter near-white (lightness > 90%) and near-black (lightness < 10%)
    const filtered = normalized.filter(hex => {
      const l = lightness(hex);
      return l >= 0.10 && l <= 0.90;
    });

    // Count frequency and deduplicate
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

// GET /api/admin/flagged-referrals/summary
// Returns count of unresolved flagged referrals for the admin dashboard banner.
router.get('/api/admin/flagged-referrals/summary', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM flagged_referrals WHERE reviewed = false AND contractor_id = $1',
      [contractorId]
    );
    res.json({ unresolved_count: parseInt(result.rows[0].count) });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/flagged-referrals
// Returns all flagged referrals ordered by unresolved first, then newest first.
router.get('/api/admin/flagged-referrals', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
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
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/flagged-referrals/:id
// Resolves (or un-resolves) a flagged referral.
// Body: { reviewed, review_label, review_note }
router.put('/api/admin/flagged-referrals/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
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
    res.status(500).json({ error: err.message });
  }
});

const backupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many backup requests. Please try again in an hour.' }
});

// ── ADMIN: MANUAL BACKUP TRIGGER ──────────────────────────────────────────────
router.post('/api/admin/backup/run', backupLimiter, async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    await runBackup();
    res.json({ success: true, message: 'Backup completed successfully' });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── ADMIN: VERIFY LATEST BACKUP ───────────────────────────────────────────────
router.post('/api/admin/backup/verify', backupLimiter, async (req, res) => {
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
    res.status(500).json({ success: false, error: err.message });
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

// GET /api/admin/pending-referrals
// List all pending referrals. Default excludes closed; ?include_closed=true shows all.
router.get('/api/admin/pending-referrals', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/pending-referrals/:id/resend
// Resend invite email (and SMS if Twilio active). Updates invite_resent_at.
router.post('/api/admin/pending-referrals/:id/resend', resendInviteLimiter, async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
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

    const { sendPendingInviteEmail, sendPendingInviteSMS } = require('../utils/pendingReferral');
    if (record.referred_by_email) await sendPendingInviteEmail(record, contractorId);
    if (record.referred_by_phone) await sendPendingInviteSMS(record, contractorId);

    await pool.query(
      'UPDATE pending_referrals SET invite_resent_at=NOW() WHERE id=$1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/pending-referrals/:id/close
// Close out a pending referral. Optional body.note → closed_out_note.
router.post('/api/admin/pending-referrals/:id/close', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/pending-referrals/:id/confirm-referrer
// Admin selects the correct Jobber candidate for a needs_admin_verification record.
// referrer_jobber_id: the Jobber client ID of the selected candidate (from jobber_name_matches).
// The backend fetches contact info from Jobber using that ID, stores it, and fires the invite.
router.post('/api/admin/pending-referrals/:id/confirm-referrer', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: hardcoded contractor_id — FORA: pull from admin session token
  const contractorId = 'accent-roofing';
  const { referrer_name, referrer_jobber_id } = req.body || {};
  try {
    // Fetch contact info from Jobber using the selected candidate's Jobber client ID.
    // jobber_name_matches stores { id, name } per candidate — id is the Jobber client ID.
    let referrerPhone = null;
    let referrerEmail = null;
    if (referrer_jobber_id) {
      const { fetchReferrerContact } = require('../utils/pendingReferral');
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

    const { sendPendingInviteEmail, sendPendingInviteSMS } = require('../utils/pendingReferral');
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
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: BOOKING REQUESTS ───────────────────────────────────────────────────
router.get('/api/admin/booking-requests', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const contractorId = 'accent-roofing';
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
    res.status(500).json({ error: err.message });
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

// GET /api/admin/missing-referrals
router.get('/api/admin/missing-referrals', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/missing-referrals/:id/resolve
router.patch('/api/admin/missing-referrals/:id/resolve', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
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
        await retryWithBackoff(
          () => resend.emails.send({
            from: 'Rooster Booster <noreply@roofmiles.com>',
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
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: INBOX MESSAGES ─────────────────────────────────────────────────────

// GET /api/admin/messages
// Returns all admin_messages for this contractor with joined detail rows for
// both message types (missing_referral and suggestion_box).
router.get('/api/admin/messages', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
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
       WHERE am.contractor_id = 'accent-roofing'
       ORDER BY am.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/messages/:id/read
// Marks a single admin_messages row as read and returns the new unread count.
router.patch('/api/admin/messages/:id/read', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (!id || id < 1) return res.status(400).json({ error: 'Invalid message id' });
  try {
    await pool.query(
      `UPDATE admin_messages SET read = true
       WHERE id = $1 AND contractor_id = 'accent-roofing'`,
      [id]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM admin_messages
       WHERE contractor_id = 'accent-roofing' AND read = false`
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
