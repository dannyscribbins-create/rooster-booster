const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { verifyAdminSession } = require('../../middleware/auth');
const { logError } = require('../../middleware/errorLogger');
const { deriveOptOutType } = require('../../utils/adminHelpers');

// ── GLOBAL CONTACT LIST ───────────────────────────────────────────────────────

router.get('/api/admin/contacts', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';

  const { filter } = req.query;
  const ALLOWED_FILTERS = ['opted_out', 'app_user'];
  if (filter !== undefined && !ALLOWED_FILTERS.includes(filter)) {
    return res.status(400).json({ error: 'Invalid filter value' });
  }

  const rawLimit  = parseInt(req.query.limit,  10);
  const rawOffset = parseInt(req.query.offset, 10);
  const limit  = (!isNaN(rawLimit)  && rawLimit  > 0 && rawLimit  <= 200) ? rawLimit  : 100;
  const offset = (!isNaN(rawOffset) && rawOffset >= 0)                    ? rawOffset : 0;

  let extraWhere = '';
  if (filter === 'opted_out') {
    extraWhere = `AND (eoo.opt_out_campaigns = true OR eoo.opt_out_all = true OR eoo.opt_out_sms = true)`;
  } else if (filter === 'app_user') {
    extraWhere = `AND c.is_app_user = true`;
  }

  try {
    const baseWhere = `
      FROM contacts c
      LEFT JOIN email_opt_outs eoo
        ON eoo.email = c.email
        AND eoo.contractor_id = c.contractor_id
      WHERE c.contractor_id = $1
      ${extraWhere}`;

    const [countResult, rowsResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total ${baseWhere}`,
        [contractorId]
      ),
      pool.query(
        `SELECT
           c.id,
           c.name,
           c.email,
           c.is_app_user,
           c.created_at,
           eoo.opt_out_campaigns,
           eoo.opt_out_sms,
           eoo.opt_out_all,
           eoo.referral_only,
           (SELECT COUNT(*) FROM contact_send_history WHERE contact_id = c.id) AS total_sends,
           (SELECT MAX(sent_at) FROM contact_send_history WHERE contact_id = c.id) AS last_sent_at
         ${baseWhere}
         ORDER BY c.updated_at DESC
         LIMIT $2 OFFSET $3`,
        [contractorId, limit, offset]
      ),
    ]);

    const contacts = rowsResult.rows.map(row => ({
      id:           row.id,
      name:         row.name,
      email:        row.email,
      is_app_user:  row.is_app_user,
      created_at:   row.created_at,
      opted_out:    !!(row.opt_out_campaigns || row.opt_out_sms || row.opt_out_all || row.referral_only),
      opt_out_type: deriveOptOutType(row),
      total_sends:  parseInt(row.total_sends, 10),
      last_sent_at: row.last_sent_at || null,
    }));

    res.json({
      total_count: parseInt(countResult.rows[0].total, 10),
      contacts,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/contacts' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── CONTACT DETAIL ────────────────────────────────────────────────────────────

router.get('/api/admin/contacts/:contactId', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';
  const { contactId } = req.params;

  try {
    // ── 1. Contact row + opt-out join ─────────────────────────────────────────
    const contactResult = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.email,
         c.phone,
         c.is_app_user,
         c.jobber_client_id,
         c.created_at,
         eoo.opt_out_campaigns,
         eoo.opt_out_sms,
         eoo.opt_out_all,
         eoo.referral_only
       FROM contacts c
       LEFT JOIN email_opt_outs eoo
         ON eoo.email = c.email
         AND eoo.contractor_id = c.contractor_id
       WHERE c.id = $1
         AND c.contractor_id = $2`,
      [contactId, contractorId]
    );

    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const row = contactResult.rows[0];

    const contact = {
      id:               row.id,
      name:             row.name,
      email:            row.email,
      phone:            row.phone || null,
      is_app_user:      row.is_app_user,
      jobber_client_id: row.jobber_client_id || null,
      created_at:       row.created_at,
      opted_out:        !!(row.opt_out_campaigns || row.opt_out_sms || row.opt_out_all || row.referral_only),
      opt_out_type:     deriveOptOutType(row),
      opt_out_campaigns: !!row.opt_out_campaigns,
      opt_out_sms:       !!row.opt_out_sms,
      opt_out_all:       !!row.opt_out_all,
      referral_only:     !!row.referral_only,
    };

    // ── 2. Send history ───────────────────────────────────────────────────────
    const historyResult = await pool.query(
      `SELECT
         csh.campaign_id,
         cam.name AS campaign_name,
         csh.batch_number,
         csh.sent_at,
         csh.channel,
         csh.status,
         csh.subject
       FROM contact_send_history csh
       LEFT JOIN campaigns cam
         ON cam.id = csh.campaign_id
       WHERE csh.contact_id = $1
         AND csh.contractor_id = $2
       ORDER BY csh.sent_at DESC`,
      [contactId, contractorId]
    );

    const sendHistory = historyResult.rows.map(h => ({
      campaign_id:   h.campaign_id,
      campaign_name: h.campaign_name || null,
      batch_number:  h.batch_number,
      sent_at:       h.sent_at,
      channel:       h.channel,
      status:        h.status,
      subject:       h.subject || null,
    }));

    // ── 3. Jobber client ID fallback ──────────────────────────────────────────
    // If contacts row has no jobber_client_id, attempt two-step fallback:
    // 1. Check users table (app users with Jobber match at signup)
    // 2. Check pipeline_cache by client name (referred clients)
    if (!contact.jobber_client_id) {
      try {
        const userRes = await pool.query(
          `SELECT jobber_client_id FROM users
           WHERE LOWER(email) = LOWER($1) AND jobber_client_id IS NOT NULL LIMIT 1`,
          [contact.email]
        );
        if (userRes.rows.length > 0) {
          contact.jobber_client_id = userRes.rows[0].jobber_client_id;
        } else if (contact.name) {
          const pcRes = await pool.query(
            `SELECT jobber_client_id FROM pipeline_cache
             WHERE contractor_id = $1
               AND LOWER(client_name) = LOWER($2)
               AND jobber_client_id IS NOT NULL
             LIMIT 1`,
            [contractorId, contact.name]
          );
          if (pcRes.rows.length > 0) {
            contact.jobber_client_id = pcRes.rows[0].jobber_client_id;
          }
        }
        if (contact.jobber_client_id) {
          await pool.query(
            `UPDATE contacts SET jobber_client_id = $1, updated_at = NOW()
             WHERE id = $2 AND contractor_id = $3`,
            [contact.jobber_client_id, contactId, contractorId]
          );
        }
      } catch (fallbackErr) {
        await logError({ req, error: fallbackErr, source: 'GET /api/admin/contacts/:contactId — jobber_client_id fallback' });
        // Fallback failure must not break the drawer response
      }
    }

    // ── 4. Jobber profile ─────────────────────────────────────────────────────
    let jobberProfile = null;
    if (contact.jobber_client_id) {
      const pipelineResult = await pool.query(
        `SELECT
           pipeline_status,
           referred_by,
           raw_data
         FROM pipeline_cache
         WHERE jobber_client_id = $1
           AND contractor_id = $2
         LIMIT 1`,
        [contact.jobber_client_id, contractorId]
      );
      if (pipelineResult.rows.length > 0) {
        const pr = pipelineResult.rows[0];
        jobberProfile = {
          pipeline_status: pr.pipeline_status || null,
          referred_by:     pr.referred_by || null,
          // work_category is not a pipeline_cache column — extracted from raw_data JSONB if present
          work_category:   pr.raw_data?.work_category || null,
        };
      }
    }

    res.json({
      contact,
      send_history: sendHistory,
      jobber_profile: jobberProfile,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/contacts/:contactId' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── CONTACT RESUBSCRIBE ───────────────────────────────────────────────────────

router.patch('/api/admin/contacts/:contactId/resubscribe', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';
  const { contactId } = req.params;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(contactId)) {
    return res.status(400).json({ error: 'Invalid contact ID' });
  }

  const { flags } = req.body;
  const ALLOWED_FLAGS = ['opt_out_sms', 'opt_out_campaigns', 'opt_out_all', 'referral_only'];
  if (!Array.isArray(flags) || flags.length === 0) {
    return res.status(400).json({ error: 'flags must be a non-empty array' });
  }
  const invalid = flags.filter(f => !ALLOWED_FLAGS.includes(f));
  if (invalid.length > 0) {
    return res.status(400).json({ error: 'Invalid flag values' });
  }

  try {
    const contactResult = await pool.query(
      `SELECT id, name, email FROM contacts WHERE id = $1 AND contractor_id = $2`,
      [contactId, contractorId]
    );
    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    const contact = contactResult.rows[0];

    const optOutResult = await pool.query(
      `SELECT id FROM email_opt_outs WHERE contractor_id = $1 AND email = $2`,
      [contractorId, contact.email]
    );
    if (optOutResult.rows.length === 0) {
      return res.status(404).json({ error: 'No opt-out record found' });
    }

    // flags array contains only validated values from ALLOWED_FLAGS — safe to use as column names
    const setClauses = flags.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = flags.map(() => false);
    const offset = flags.length;

    await pool.query(
      `UPDATE email_opt_outs SET ${setClauses}, resubscribed_at = NOW(), resubscribe_source = 'admin' WHERE contractor_id = $${offset + 1} AND email = $${offset + 2}`,
      [...values, contractorId, contact.email]
    );

    const flagLabels = {
      opt_out_campaigns: 'Campaign & Promotional Emails',
      opt_out_sms:       'SMS Text Messages',
      opt_out_all:       'All Emails & Texts',
      referral_only:     'Referral Updates Only',
    };
    const detail = `Admin cleared opt-out flags: ${flags.map(f => flagLabels[f] || f).join(', ')}`;

    await pool.query(
      `INSERT INTO activity_log (event_type, full_name, email, detail, category, contact_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['resubscribe_admin', contact.name, contact.email, detail, 'admin_action', contactId]
    );

    res.json({ success: true, flags_cleared: flags });
  } catch (err) {
    await logError({ req, error: err, source: 'PATCH /api/admin/contacts/:contactId/resubscribe' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
