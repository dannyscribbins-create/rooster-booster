const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { fetchPipelineForReferrer } = require('../crm/jobber');
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
  try {
    const result = await pool.query('SELECT id,full_name,email,created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/api/admin/users', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { full_name, email, pin } = req.body;
  try {
    const hashedPin = await bcrypt.hash(String(pin), 10);
    const result = await pool.query(
      'INSERT INTO users (full_name,email,pin) VALUES ($1,$2,$3) RETURNING id,full_name,email,created_at',
      [full_name, email, hashedPin]
    );
    res.json(result.rows[0]);
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

// ── ADMIN: REFERRER DETAIL ────────────────────────────────────────────────────
router.get('/api/admin/referrer/:name', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const data = await fetchPipelineForReferrer(decodeURIComponent(req.params.name));
    res.json(data);
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
router.get('/api/admin/leaderboard', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // period param accepted but all periods return same all-time paid_count for MVP
  // (date-range filtering deferred until pipeline caching is built)
  try {
    const result = await pool.query(
      `SELECT full_name, email, paid_count
       FROM users
       WHERE paid_count > 0
       ORDER BY paid_count DESC
       LIMIT 50`
    );
    const rows = result.rows.map((row, i) => {
      const parts = row.full_name.trim().split(' ');
      return {
        rank: i + 1,
        first_name: parts[0] || '',
        last_name: parts.slice(1).join(' ') || '',
        email: row.email,
        converted_count: row.paid_count,
        period: req.query.period || 'alltime'
      };
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: ENGAGEMENT SETTINGS ────────────────────────────────────────────────
router.get('/api/admin/engagement-settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      'SELECT leaderboard_enabled, quarterly_prizes, yearly_prizes FROM engagement_settings WHERE contractor_id = $1',
      ['accent-roofing']
    );
    if (result.rows.length === 0) {
      return res.json({ leaderboard_enabled: true, quarterly_prizes: [], yearly_prizes: [] });
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/api/admin/engagement-settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { leaderboard_enabled, quarterly_prizes, yearly_prizes } = req.body;
  if (typeof leaderboard_enabled !== 'boolean') {
    return res.status(400).json({ error: 'leaderboard_enabled must be a boolean' });
  }
  if (!Array.isArray(quarterly_prizes) || quarterly_prizes.length > 3) {
    return res.status(400).json({ error: 'quarterly_prizes must be an array of max 3 items' });
  }
  if (!Array.isArray(yearly_prizes) || yearly_prizes.length > 3) {
    return res.status(400).json({ error: 'yearly_prizes must be an array of max 3 items' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO engagement_settings (contractor_id, leaderboard_enabled, quarterly_prizes, yearly_prizes, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (contractor_id) DO UPDATE
         SET leaderboard_enabled=$2, quarterly_prizes=$3, yearly_prizes=$4, updated_at=NOW()
       RETURNING leaderboard_enabled, quarterly_prizes, yearly_prizes`,
      ['accent-roofing', leaderboard_enabled, JSON.stringify(quarterly_prizes), JSON.stringify(yearly_prizes)]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
