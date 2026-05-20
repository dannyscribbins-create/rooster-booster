const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { verifyAdminSession } = require('../../middleware/auth');
const { logError } = require('../../middleware/errorLogger');

// ── ADMIN: CASH OUTS ──────────────────────────────────────────────────────────
router.get('/api/admin/cashouts', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT id, user_id, full_name, email, amount, method, payout_method, status, requested_at, paid_at, bank_connection_blocked_reason FROM cashout_requests ORDER BY requested_at DESC');
    res.json(result.rows);
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  }
});
router.patch('/api/admin/cashouts/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { status } = req.body;
  if (!['approved','denied','paid'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateSql = status === 'paid'
      ? 'UPDATE cashout_requests SET status=$1, paid_at=NOW() WHERE id=$2 RETURNING *'
      : 'UPDATE cashout_requests SET status=$1 WHERE id=$2 RETURNING *';
    const result = await client.query(updateSql, [status, req.params.id]);
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
      if (cashout.user_id != null) {
        await client.query(
          `INSERT INTO payout_announcements (cashout_request_id, user_id) VALUES ($1, $2)`,
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

module.exports = router;
