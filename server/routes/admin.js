const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { fetchPipelineForReferrer, refreshTokenIfNeeded } = require('../crm/jobber');
const axios = require('axios');
const { verifyAdminSession } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rooster123';

// ── ADMIN: AUTH ───────────────────────────────────────────────────────────────
router.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
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
        ref.full_name AS invited_by_name
      FROM users u
      LEFT JOIN users ref ON ref.id = u.invited_by_user_id
      ${where}
      ORDER BY u.created_at DESC
    `;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/api/admin/users/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: MATCH USER TO JOBBER CLIENT ────────────────────────────────────────
router.post('/api/admin/users/:id/match-jobber', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const userResult = await pool.query('SELECT id, full_name, email, phone FROM users WHERE id = $1', [req.params.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    // Matches by phone (if available) or email. At scale, Jobber webhook will make this unnecessary.
    await refreshTokenIfNeeded();
    const tokenRes = await pool.query('SELECT access_token FROM tokens WHERE id = 1');
    if (!tokenRes.rows[0]?.access_token) return res.status(503).json({ error: 'Jobber not connected' });
    const jobberToken = tokenRes.rows[0].access_token;

    const gqlResponse = await axios.post(
      'https://api.getjobber.com/api/graphql',
      // MVP: fetches only first 100 Jobber clients — no pagination. At scale, use Jobber webhook (Stripe ACH session).
      { query: `{ clients(first:100) { nodes { id emails { address } phoneNumbers { number } } } }` },
      { headers: { Authorization: `Bearer ${jobberToken}`, 'Content-Type': 'application/json', 'X-JOBBER-GRAPHQL-VERSION': '2026-02-17' } }
    );

    const clients = gqlResponse.data.data?.clients?.nodes || [];
    const cleanPhone = user.phone ? user.phone.replace(/\D/g, '') : null;
    const match = clients.find(c =>
      c.emails?.some(e => e.address.toLowerCase() === user.email.toLowerCase()) ||
      (cleanPhone && c.phoneNumbers?.some(p => p.number.replace(/\D/g, '') === cleanPhone))
    );

    if (match) {
      await pool.query('UPDATE users SET jobber_client_id=$1 WHERE id=$2', [match.id, user.id]);
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('admin', $1, $2, $3)`,
        [user.full_name, user.email, `Admin manually matched to Jobber client: ${match.id}`]
      );
      return res.json({ matched: true, jobberClientId: match.id, message: 'Matched to Jobber client.' });
    } else {
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('admin', $1, $2, $3)`,
        [user.full_name, user.email, 'Admin manual Jobber match: no client found by email or phone']
      );
      return res.json({ matched: false, jobberClientId: null, message: 'No Jobber client found with this email or phone number.' });
    }
  } catch (err) { res.status(500).json({ error: 'Jobber match failed: ' + err.message }); }
});

// ── ADMIN: REFERRER DETAIL ────────────────────────────────────────────────────
router.get('/api/admin/referrer/:name', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const name = decodeURIComponent(req.params.name);
    const [pipelineData, userResult] = await Promise.all([
      fetchPipelineForReferrer(name),
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
  } catch (err) { res.status(500).json({ error: 'Failed to fetch referrer data: ' + err.message }); }
});

// ── ADMIN: CASH OUTS ──────────────────────────────────────────────────────────
router.get('/api/admin/cashouts', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT * FROM cashout_requests ORDER BY requested_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.patch('/api/admin/cashouts/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { status } = req.body;
  if (!['approved','denied'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const result = await pool.query('UPDATE cashout_requests SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('admin',$1,$2,$3)`,
      [result.rows[0].full_name, result.rows[0].email,
       `Cash out request #${req.params.id} ${status} ($${result.rows[0].amount})`]
    );
    if (status === 'approved') {
      await pool.query(
        `INSERT INTO payout_announcements (cashout_request_id, user_id)
         SELECT $1, COALESCE(cr.user_id, u.id)
         FROM cashout_requests cr
         LEFT JOIN users u ON u.full_name = cr.full_name
         WHERE cr.id = $1
           AND NOT EXISTS (
             SELECT 1 FROM payout_announcements WHERE cashout_request_id = $1
           )`,
        [req.params.id]
      );
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: ACTIVITY LOG ───────────────────────────────────────────────────────
router.get('/api/admin/activity', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: DASHBOARD STATS (cached 15 min) ────────────────────────────────────
router.get('/api/admin/stats', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { refresh } = req.query;
  try {
    if (refresh !== 'true') {
      const cached = await pool.query('SELECT * FROM admin_cache WHERE id=1');
      if (cached.rows.length > 0) {
        const ageMin = (Date.now() - new Date(cached.rows[0].cached_at).getTime()) / 60000;
        if (ageMin < 15) return res.json({ ...cached.rows[0].stats, cachedAt: cached.rows[0].cached_at, fromCache: true });
      }
    }
    const usersResult = await pool.query('SELECT full_name FROM users');
    const allUsers = usersResult.rows;
    let totalReferrals=0, totalSold=0, totalNotSold=0, totalLeads=0, totalInspections=0, totalBalance=0, activeReferrers=0;
    for (const user of allUsers) {
      try {
        const data = await fetchPipelineForReferrer(user.full_name);
        const p = data.pipeline;
        if (p.length > 0) activeReferrers++;
        totalReferrals   += p.length;
        totalSold        += p.filter(x => x.status==='sold').length;
        totalNotSold     += p.filter(x => x.status==='closed').length;
        totalLeads       += p.filter(x => x.status==='lead').length;
        totalInspections += p.filter(x => x.status==='inspection').length;
        totalBalance     += data.balance;
      } catch(e) { console.error(`Stats: failed for ${user.full_name}:`, e.message); }
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
  } catch (err) { res.status(500).json({ error: 'Stats failed: ' + err.message }); }
});

// ── ADMIN: ABOUT ──────────────────────────────────────────────────────────────
router.get('/api/admin/about', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      "SELECT * FROM contractor_about WHERE contractor_id = 'accent-roofing' LIMIT 1"
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: LEADERBOARD ────────────────────────────────────────────────────────

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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: ENGAGEMENT SETTINGS ────────────────────────────────────────────────
router.get('/api/admin/engagement-settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT leaderboard_enabled, quarterly_prizes, yearly_prizes,
              year_start_month, quarter_1_start, quarter_2_start,
              quarter_3_start, quarter_4_start,
              warmup_mode_enabled, shouts_enabled
       FROM engagement_settings WHERE contractor_id = $1`,
      ['accent-roofing']
    );
    if (result.rows.length === 0) {
      return res.json({
        leaderboard_enabled: true, quarterly_prizes: [], yearly_prizes: [],
        year_start_month: 1, quarter_1_start: 1, quarter_2_start: 4,
        quarter_3_start: 7, quarter_4_start: 10,
        warmup_mode_enabled: false, shouts_enabled: true,
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
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/admin/engagement-settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const {
    leaderboard_enabled, quarterly_prizes, yearly_prizes,
    year_start_month, quarter_1_start, quarter_2_start, quarter_3_start, quarter_4_start,
    warmup_mode_enabled, shouts_enabled,
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
         warmup_mode_enabled, shouts_enabled, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (contractor_id) DO UPDATE
         SET leaderboard_enabled=$2, quarterly_prizes=$3, yearly_prizes=$4,
             year_start_month=$5, quarter_1_start=$6, quarter_2_start=$7,
             quarter_3_start=$8, quarter_4_start=$9,
             warmup_mode_enabled=$10, shouts_enabled=$11, updated_at=NOW()`,
      [
        'accent-roofing', leaderboard_enabled,
        JSON.stringify(quarterly_prizes), JSON.stringify(yearly_prizes),
        monthFields.year_start_month, monthFields.quarter_1_start, monthFields.quarter_2_start,
        monthFields.quarter_3_start, monthFields.quarter_4_start,
        warmup_mode_enabled, shouts_enabled,
      ]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: CONTRACTOR SETTINGS ────────────────────────────────────────────────
router.get('/api/admin/settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      "SELECT * FROM contractor_settings WHERE contractor_id = 'accent-roofing' LIMIT 1"
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
      'SELECT * FROM contractor_crm_settings WHERE contractor_id = $1',
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
      lastSyncedAt: s.last_synced_at,
      syncIntervalMins: s.sync_interval_mins || 30,
      tokenStatus,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
      const accountRes = await axios.post(
        'https://api.getjobber.com/api/graphql',
        { query: '{ account { name } }' },
        { headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-02-17'
        } }
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
      const accountRes = await axios.post(
        'https://api.getjobber.com/api/graphql',
        { query: '{ account { name } }' },
        { headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-02-17'
        } }
      );
      accountName = accountRes.data?.data?.account?.name;
      if (!accountName) return res.json({ success: false, message: 'Could not verify credential — no account data returned' });
    } else if (crmType === 'servicetitan' || crmType === 'acculynx') {
      return res.json({ success: false, message: `${crmType} adapter not yet implemented` });
    } else {
      return res.status(400).json({ error: `Unknown crmType: ${crmType}` });
    }
  } catch (err) {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/crm/sync
// Triggers a pipeline sync for all active referrers and updates last_synced_at.
router.post('/api/admin/crm/sync', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const referrers = await pool.query('SELECT id, full_name FROM users ORDER BY id');
    const errors = [];
    for (const user of referrers.rows) {
      try {
        await fetchPipelineForReferrer(user.full_name);
      } catch (err) {
        errors.push(`${user.full_name}: ${err.message}`);
      }
    }
    const lastSyncedAt = new Date();
    await pool.query(
      `UPDATE contractor_crm_settings SET last_synced_at = $1 WHERE contractor_id = 'accent-roofing'`,
      [lastSyncedAt]
    );
    res.json({ success: true, lastSyncedAt, errors: errors.length ? errors : undefined });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: EXTRACT COLORS FROM URL ───────────────────────────────────────────
router.get('/api/admin/extract-colors', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

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
  } catch {
    res.json({ error: 'Could not reach this website. Try uploading your logo instead.' });
  }
});

module.exports = router;
