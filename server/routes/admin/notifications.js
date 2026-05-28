const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { verifyAdminSession } = require('../../middleware/auth');
const { logError } = require('../../middleware/errorLogger');

const CONTRACTOR_ID = 'accent-roofing'; // MVP: hardcoded — FORA: pull from admin session token

// GET /api/admin/notification-preferences
// Returns an object keyed by trigger_key → email_enabled boolean.
// Missing trigger keys default to true (enabled) on the client.
router.get('/api/admin/notification-preferences', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT trigger_key, email_enabled FROM notification_preferences WHERE contractor_id = $1`,
      [CONTRACTOR_ID]
    );
    const prefs = {};
    for (const row of result.rows) {
      prefs[row.trigger_key] = row.email_enabled;
    }
    res.json(prefs);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/notification-preferences
// Upserts a single trigger preference.
// Body: { trigger_key: string, email_enabled: boolean }
router.put('/api/admin/notification-preferences', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { trigger_key, email_enabled } = req.body;
  if (typeof trigger_key !== 'string' || !trigger_key.trim()) {
    return res.status(400).json({ error: 'trigger_key is required' });
  }
  if (typeof email_enabled !== 'boolean') {
    return res.status(400).json({ error: 'email_enabled must be a boolean' });
  }
  try {
    await pool.query(
      `INSERT INTO notification_preferences (contractor_id, trigger_key, email_enabled, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (contractor_id, trigger_key) DO UPDATE
         SET email_enabled = EXCLUDED.email_enabled, updated_at = NOW()`,
      [CONTRACTOR_ID, trigger_key.trim(), email_enabled]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});

// ── NOTIFICATION BELL (sync completion notifications) ─────────────────────────

// GET /api/admin/notifications
// Returns unread + recent notifications for the admin bell.
router.get('/api/admin/notifications', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT id, type, title, body, deeplink, read, created_at
       FROM notifications
       WHERE contractor_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [CONTRACTOR_ID]
    );
    res.json({
      notifications: result.rows,
      unread_count: result.rows.filter(r => !r.read).length,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/notifications' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/notifications/:id/read
// Marks a single notification as read.
router.patch('/api/admin/notifications/:id/read', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { id } = req.params;
  if (!id || isNaN(Number(id))) return res.status(400).json({ error: 'Invalid notification id' });
  try {
    await pool.query(
      `UPDATE notifications SET read = TRUE
       WHERE id = $1 AND contractor_id = $2`,
      [Number(id), CONTRACTOR_ID]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'PATCH /api/admin/notifications/:id/read' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
