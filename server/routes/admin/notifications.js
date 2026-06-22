const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { verifyAdminSession } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const { logError } = require('../../middleware/errorLogger');

// GET /api/admin/notification-preferences
// Returns an object keyed by trigger_key → email_enabled boolean.
// Missing trigger keys default to true (enabled) on the client.
router.get('/api/admin/notification-preferences', requirePermission('branding'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT trigger_key, email_enabled FROM notification_preferences WHERE contractor_id = $1`,
      [contractorId]
    );
    const prefs = {};
    for (const row of result.rows) {
      prefs[row.trigger_key] = row.email_enabled;
    }
    res.json(prefs);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/notification-preferences
// Upserts a single trigger preference.
// Body: { trigger_key: string, email_enabled: boolean }
router.put('/api/admin/notification-preferences', requirePermission('branding.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
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
      [contractorId, trigger_key.trim(), email_enabled]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── NOTIFICATION BELL (sync completion notifications) ─────────────────────────

// GET /api/admin/notifications
// Returns unread + recent notifications for the admin bell.
// Intentionally session-only — admin UI chrome, not a content-area feature, see Phase 4B decision.
router.get('/api/admin/notifications', async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  try {
    const result = await pool.query(
      `SELECT id, type, title, body, deeplink, read, created_at
       FROM notifications
       WHERE contractor_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [contractorId]
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
// Intentionally session-only — admin UI chrome, not a content-area feature, see Phase 4B decision.
router.patch('/api/admin/notifications/:id/read', async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { id } = req.params;
  if (!id || isNaN(Number(id))) return res.status(400).json({ error: 'Invalid notification id' });
  try {
    await pool.query(
      `UPDATE notifications SET read = TRUE WHERE id = $1 AND contractor_id = $2`,
      [Number(id), contractorId]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err, source: 'PATCH /api/admin/notifications/:id/read' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
