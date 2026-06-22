const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { getCRMAdapter } = require('../../crm/index');
const { verifyAdminSession } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const bcrypt = require('bcrypt');
const { logError } = require('../../middleware/errorLogger');

// ── ADMIN: REFERRERS ──────────────────────────────────────────────────────────
router.get('/api/admin/users', requirePermission('referrers'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
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
            OR EXISTS (SELECT 1 FROM pipeline_cache pc WHERE LOWER(pc.referred_by) = LOWER(u.full_name) AND pc.pipeline_status = 'paid' AND pc.contractor_id = $${params.length + 1})
          ) THEN 'in_pipeline_paid'
          WHEN EXISTS (SELECT 1 FROM pipeline_cache pc WHERE LOWER(pc.referred_by) = LOWER(u.full_name) AND pc.pipeline_status = 'sold' AND pc.contractor_id = $${params.length + 1}) THEN 'in_pipeline_sold'
          WHEN EXISTS (SELECT 1 FROM pipeline_cache pc WHERE LOWER(pc.referred_by) = LOWER(u.full_name) AND pc.pipeline_status = 'inspection' AND pc.contractor_id = $${params.length + 1}) THEN 'in_pipeline_inspection'
          WHEN EXISTS (SELECT 1 FROM pipeline_cache pc WHERE LOWER(pc.referred_by) = LOWER(u.full_name) AND pc.contractor_id = $${params.length + 1}) THEN 'in_pipeline_lead'
          WHEN EXISTS (SELECT 1 FROM booking_requests br WHERE br.submitted_by_user_id = u.id AND br.status != 'matched') THEN 'booking_requested'
          ELSE 'app_account_only'
        END AS lifecycle_status
      FROM users u
      LEFT JOIN users ref ON ref.id = u.invited_by_user_id
      ${where}
      ORDER BY u.created_at DESC
    `;
    params.push(contractorId);
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});
router.post('/api/admin/users', requirePermission('referrers.manage'), async (req, res) => {
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
router.patch('/api/admin/users/:id/pin', requirePermission('referrers.manage'), async (req, res) => {
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
router.delete('/api/admin/users/:id', requirePermission('referrers.manage'), async (req, res) => {
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
router.post('/api/admin/users/:id/match-jobber', requirePermission('referrers.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const userResult = await pool.query('SELECT id, full_name, email, phone FROM users WHERE id = $1', [req.params.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    // pipeline_cache is the source of truth for all referred clients — name match is reliable
    // because syncSingleClient writes client_name from Jobber firstName + lastName.
    const cacheResult = await pool.query(
      `SELECT jobber_client_id, client_name FROM pipeline_cache
       WHERE contractor_id = $1
         AND LOWER(client_name) = LOWER($2)
       LIMIT 1`,
      [contractorId, user.full_name]
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
router.get('/api/admin/referrer/:name', requirePermission('referrers'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const name = decodeURIComponent(req.params.name);
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

module.exports = router;
