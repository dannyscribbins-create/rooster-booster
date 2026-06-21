const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { verifyAdminSession } = require('../../middleware/auth');
const { logError } = require('../../middleware/errorLogger');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
// test seam — inert in production, never called outside server/test/
let _sendEmail = (...args) => resend.emails.send(...args);
const { retryWithBackoff } = require('../../utils/retryWithBackoff');
const { resendShouldRetry } = require('../../utils/retryHelpers');
const { isEmailSuppressed } = require('../../utils/emailSuppression');

function escapeHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDollars(n) {
  return parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

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
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
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
      const existingAnnouncement = await client.query(
        `SELECT 1 FROM payout_announcements WHERE cashout_request_id = $1`,
        [req.params.id]
      );
      if (existingAnnouncement.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Cashout already approved — duplicate approval blocked' });
      }
      // SCALABLE: wrap Stripe ACH call inside this transaction before committing approved status
      if (cashout.user_id != null) {
        await client.query(
          `INSERT INTO payout_announcements (cashout_request_id, user_id) VALUES ($1, $2)`,
          [req.params.id, cashout.user_id]
        );
      }
    }

    await client.query('COMMIT');

    // ── #8/#9 REFERRER CASHOUT STATUS EMAIL ────────────────────────────────────
    // Non-blocking: failure must not affect the admin response.
    if (cashout.email && (status === 'approved' || status === 'denied')) {
      try {
        const csResult = await pool.query(
          `SELECT email_sender_name, company_name, company_email FROM contractor_settings WHERE contractor_id = $1 LIMIT 1`,
          [contractorId]
        );
        const cs = csResult.rows[0] || {};
        const fromName = escapeHtml(cs.email_sender_name || cs.company_name || 'RoofMiles');
        const companyName = escapeHtml(cs.company_name || 'your contractor');
        const companyEmail = cs.company_email || '';
        const frontendUrl = process.env.FRONTEND_URL || 'https://roofmiles.com';
        const firstName = escapeHtml((cashout.full_name || '').split(' ')[0] || cashout.full_name || 'there');
        const formattedAmount = formatDollars(cashout.amount);

        const suppressed8or9 = await isEmailSuppressed(contractorId, cashout.email, status === 'approved' ? 'cashout_approved' : 'cashout_denied');
        if (status === 'approved') {
          // #8 — cashout approved
          if (!suppressed8or9) await retryWithBackoff(
            () => _sendEmail({
              from: `${fromName} <noreply@roofmiles.com>`,
              to: cashout.email,
              subject: `Your $${formattedAmount} cashout is approved!`,
              html: `
                <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                  <h2 style="color:#012854;margin:0 0 12px;">Money is on the way!</h2>
                  <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, your cashout request for $${formattedAmount} has been approved by ${companyName}. Payment is being processed and will arrive via the method you selected. We at ${companyName} truly appreciate you and even though we know it's not about the money, it's fun for us to show our gratitude.</p>
                  <div style="text-align:center;margin-bottom:24px;">
                    <a href="${frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">View Payout History</a>
                  </div>
                </div>
              `,
            }),
            { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
          );
        } else {
          // #9 — cashout denied
          if (!suppressed8or9) await retryWithBackoff(
            () => _sendEmail({
              from: `${fromName} <noreply@roofmiles.com>`,
              to: cashout.email,
              subject: `Update on your cashout request`,
              html: `
                <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                  <h2 style="color:#012854;margin:0 0 12px;">Your cashout wasn't approved this time</h2>
                  <p style="color:#444;margin:0 0 24px;line-height:1.6;">${firstName}, your cashout request for $${formattedAmount} was reviewed by ${companyName} and wasn't approved at this time. If you have questions, reach out to ${companyName} directly${companyEmail ? ` at ${escapeHtml(companyEmail)}` : ''}.</p>
                  <div style="text-align:center;margin-bottom:24px;">
                    <a href="${companyEmail ? 'mailto:' + companyEmail : frontendUrl}" style="display:inline-block;background:#012854;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Contact ${companyName}</a>
                  </div>
                </div>
              `,
            }),
            { retries: 2, initialDelayMs: 1000, shouldRetry: resendShouldRetry }
          );
        }
      } catch (emailErr) {
        await logError({ req, error: emailErr, source: 'PATCH /api/admin/cashouts/:id — referrer email' });
      }
    }

    res.json(cashout);
  } catch (err) {
    await client.query('ROLLBACK');
    await logError({ req, error: err });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// test seam — inert in production, never called outside server/test/
function _setTestOverrides({ sendEmail: a } = {}) {
  if (a !== undefined) _sendEmail = a;
}
// test seam — inert in production, never called outside server/test/
function _resetTestOverrides() {
  _sendEmail = (...args) => resend.emails.send(...args);
}
router._setTestOverrides  = _setTestOverrides;
router._resetTestOverrides = _resetTestOverrides;

module.exports = router;
