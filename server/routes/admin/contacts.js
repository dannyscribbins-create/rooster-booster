const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { verifyAdminSession } = require('../../middleware/auth');
const { logError } = require('../../middleware/errorLogger');
const { deriveOptOutType } = require('../../utils/adminHelpers');
const { applyTag, removeTag } = require('../../utils/tags');

// pg_trgm required for fuzzy name matching — used in app user linking, unified contacts merge (Session 77), and new user signup flow
;(async () => {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  } catch (err) {
    // Extension may require superuser on first install — logged but must not crash the server
    console.log('pg_trgm setup skipped:', err.message); // diagnostic log — intentional
  }
})();

// ── TAG SUGGESTIONS (literal route — must be before /:contactId) ──────────────

router.get('/api/admin/contacts/tags/suggestions', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const contractorId = 'accent-roofing';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  try {
    const result = await pool.query(
      `SELECT DISTINCT tag FROM contact_tags
       WHERE contractor_id = $1 AND source = 'admin'
         AND tag ILIKE $2
       ORDER BY tag LIMIT 10`,
      [contractorId, `%${q}%`]
    );
    res.json({ suggestions: result.rows.map(r => r.tag) });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/contacts/tags/suggestions' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── TAG SUMMARY (literal route — must be before /:contactId) ─────────────────

router.get('/api/admin/contacts/tag-summary', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const contractorId = 'accent-roofing';
  try {
    const result = await pool.query(
      `SELECT ct.tag, ct.source, COUNT(DISTINCT ct.contact_id) AS contact_count
       FROM contact_tags ct
       WHERE ct.contractor_id = $1
       GROUP BY ct.tag, ct.source
       ORDER BY ct.source, ct.tag`,
      [contractorId]
    );
    res.json({ tags: result.rows.map(r => ({ tag: r.tag, source: r.source, contact_count: parseInt(r.contact_count, 10) })) });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/contacts/tag-summary' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

  // Tag-based filter (Addendum 2 pattern: AND uses one EXISTS per tag, OR uses ANY)
  const rawTags = req.query.tags;
  const tags = rawTags
    ? (Array.isArray(rawTags) ? rawTags : [rawTags])
        .filter(t => typeof t === 'string' && t.length > 0 && t.length <= 100)
        .slice(0, 20)
    : [];
  const tagLogic = req.query.logic === 'OR' ? 'OR' : 'AND';

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

  // Build tag EXISTS clauses and dynamic params
  let tagWhere = '';
  const tagParams = [];
  let nextParam = 2; // $1 = contractorId

  if (tags.length > 0) {
    if (tagLogic === 'AND') {
      const clauses = tags.map((tag, i) => {
        tagParams.push(tag);
        return `AND EXISTS (SELECT 1 FROM contact_tags ct${i + 1} WHERE ct${i + 1}.contact_id = c.id AND ct${i + 1}.tag = $${nextParam + i})`;
      });
      tagWhere = clauses.join('\n');
      nextParam += tags.length;
    } else {
      tagParams.push(tags);
      tagWhere = `AND EXISTS (SELECT 1 FROM contact_tags ct1 WHERE ct1.contact_id = c.id AND ct1.tag = ANY($${nextParam}))`;
      nextParam += 1;
    }
  }

  const limitParam  = nextParam;
  const offsetParam = nextParam + 1;

  try {
    const baseWhere = `
      FROM contacts c
      LEFT JOIN email_opt_outs eoo
        ON eoo.email = c.email
        AND eoo.contractor_id = c.contractor_id
      WHERE c.contractor_id = $1
      ${extraWhere}
      ${tagWhere}`;

    const baseParams = [contractorId, ...tagParams];

    const [countResult, rowsResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total ${baseWhere}`,
        baseParams
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
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        [...baseParams, limit, offset]
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

    // ── 5. Contact tags ───────────────────────────────────────────────────────
    const tagsResult = await pool.query(
      `SELECT tag, source FROM contact_tags
       WHERE contact_id = $1
       ORDER BY applied_at`,
      [contactId]
    );
    const tags = tagsResult.rows.map(r => ({ tag: r.tag, source: r.source }));

    res.json({
      contact,
      send_history: sendHistory,
      jobber_profile: jobberProfile,
      tags,
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

    // Non-blocking tag sync based on current flag state after resubscribe
    ;(async () => {
      try {
        const currentOptOut = await pool.query(
          `SELECT opt_out_campaigns, opt_out_all, opt_out_sms, referral_only
           FROM email_opt_outs WHERE contractor_id = $1 AND email = $2`,
          [contractorId, contact.email]
        );
        if (currentOptOut.rows.length === 0) return;
        const cur = currentOptOut.rows[0];
        if (cur.opt_out_campaigns || cur.opt_out_all) {
          await applyTag(pool, contactId, contractorId, 'Opted Out', 'system');
        } else {
          await removeTag(pool, contactId, contractorId, 'Opted Out');
        }
        if (cur.opt_out_sms) {
          await applyTag(pool, contactId, contractorId, 'SMS Opted Out', 'system');
        } else {
          await removeTag(pool, contactId, contractorId, 'SMS Opted Out');
        }
        if (cur.referral_only) {
          await applyTag(pool, contactId, contractorId, 'Referral Only', 'system');
        } else {
          await removeTag(pool, contactId, contractorId, 'Referral Only');
        }
      } catch (tagErr) {
        await logError({ req, error: tagErr, source: 'PATCH /api/admin/contacts/:contactId/resubscribe — tag sync' });
      }
    })();
  } catch (err) {
    await logError({ req, error: err, source: 'PATCH /api/admin/contacts/:contactId/resubscribe' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADD ADMIN TAG ─────────────────────────────────────────────────────────────

router.post('/api/admin/contacts/:contactId/tags', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const contractorId = 'accent-roofing';
  const { contactId } = req.params;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(contactId)) {
    return res.status(400).json({ error: 'Invalid contact ID' });
  }

  const { tag } = req.body;
  if (!tag || typeof tag !== 'string' || tag.trim().length === 0 || tag.trim().length > 100) {
    return res.status(400).json({ error: 'Invalid tag' });
  }
  const cleanTag = tag.trim();

  try {
    const contactCheck = await pool.query(
      `SELECT id FROM contacts WHERE id = $1 AND contractor_id = $2`,
      [contactId, contractorId]
    );
    if (contactCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await applyTag(pool, contactId, contractorId, cleanTag, 'admin');

    const tagsResult = await pool.query(
      `SELECT tag, source FROM contact_tags WHERE contact_id = $1 ORDER BY applied_at`,
      [contactId]
    );
    res.json({ tags: tagsResult.rows.map(r => ({ tag: r.tag, source: r.source })) });
  } catch (err) {
    await logError({ req, error: err, source: 'POST /api/admin/contacts/:contactId/tags' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── REMOVE ADMIN TAG ──────────────────────────────────────────────────────────

router.delete('/api/admin/contacts/:contactId/tags/:tag', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const contractorId = 'accent-roofing';
  const { contactId, tag } = req.params;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(contactId)) {
    return res.status(400).json({ error: 'Invalid contact ID' });
  }

  try {
    const tagCheck = await pool.query(
      `SELECT source FROM contact_tags WHERE contact_id = $1 AND tag = $2`,
      [contactId, tag]
    );
    if (tagCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    if (tagCheck.rows[0].source !== 'admin') {
      return res.status(403).json({ error: 'Only admin-added tags can be removed' });
    }

    await removeTag(pool, contactId, contractorId, tag);

    const tagsResult = await pool.query(
      `SELECT tag, source FROM contact_tags WHERE contact_id = $1 ORDER BY applied_at`,
      [contactId]
    );
    res.json({ tags: tagsResult.rows.map(r => ({ tag: r.tag, source: r.source })) });
  } catch (err) {
    await logError({ req, error: err, source: 'DELETE /api/admin/contacts/:contactId/tags/:tag' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── JOBBER CLIENT TAG SUMMARY ─────────────────────────────────────────────────
// Returns Jobber-sourced tags grouped by prefix for filter panel Section A.
router.get('/api/admin/jobber-client-tag-summary', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';
  try {
    const result = await pool.query(
      `SELECT
         SUBSTRING(tag FROM 1 FOR POSITION(':' IN tag) - 1) AS prefix,
         ARRAY_AGG(DISTINCT SUBSTRING(tag FROM POSITION(':' IN tag) + 1)
                   ORDER BY SUBSTRING(tag FROM POSITION(':' IN tag) + 1)) AS values,
         COUNT(DISTINCT jobber_client_id) AS client_count
       FROM contact_tags
       WHERE contractor_id = $1
         AND source = 'jobber_crm'
         AND jobber_client_id IS NOT NULL
         AND tag LIKE '%:%'
       GROUP BY SUBSTRING(tag FROM 1 FOR POSITION(':' IN tag) - 1)
       ORDER BY SUBSTRING(tag FROM 1 FOR POSITION(':' IN tag) - 1)`,
      [contractorId]
    );

    const categories = result.rows.map(row => ({
      prefix: row.prefix,
      label:  row.prefix.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      values: row.values,
      count:  parseInt(row.client_count, 10),
    }));

    res.json({ categories });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/jobber-client-tag-summary' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── JOBBER CLIENTS LIST ───────────────────────────────────────────────────────

router.get('/api/admin/jobber-clients', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // MVP: contractor_id hardcoded — pull from session token before second contractor onboards
  const contractorId = 'accent-roofing';

  const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const paying    = req.query.paying   === 'true';
  const appUser   = req.query.app_user === 'true';
  const tagLogic  = req.query.logic    === 'OR' ? 'OR' : 'AND';

  const rawTags = req.query.tags;
  const tags = rawTags
    ? (Array.isArray(rawTags) ? rawTags : [rawTags])
        .filter(t => typeof t === 'string' && t.length > 0 && t.length <= 100)
        .slice(0, 20)
    : [];

  const rawLimit  = parseInt(req.query.limit,  10);
  const rawOffset = parseInt(req.query.offset, 10);
  const limit  = (!isNaN(rawLimit)  && rawLimit  > 0 && rawLimit  <= 200) ? rawLimit  : 100;
  const offset = (!isNaN(rawOffset) && rawOffset >= 0)                    ? rawOffset : 0;

  // $1 = contractorId throughout
  const params   = [contractorId];
  let nextParam  = 2;
  let extraWhere = '';
  let tagWhere   = '';

  if (rawSearch) {
    params.push(`%${rawSearch}%`);
    extraWhere += ` AND (jc.first_name ILIKE $${nextParam} OR jc.last_name ILIKE $${nextParam} OR jc.email ILIKE $${nextParam})`;
    nextParam++;
  }

  if (paying) {
    // No new param — reuses $1
    // 'paying_client' is the lifetime tag written by deriveAndSaveTags() whenever a client has any paid invoice — never removed
    extraWhere += ` AND EXISTS (
      SELECT 1 FROM contact_tags ct_pay
      WHERE ct_pay.jobber_client_id = jc.jobber_client_id
        AND ct_pay.contractor_id = $1
        AND ct_pay.tag = 'paying_client'
    )`;
  }

  if (appUser) {
    // No new param — reuses $1
    // HIGH confidence match: email OR phone (primary key) + name similarity >= 0.4 (confirmation signal)
    // Prevents staff-email false positives where a proposal was sent to an internal address
    extraWhere += ` AND EXISTS (
      SELECT 1 FROM contacts c_au
      WHERE c_au.contractor_id = $1
        AND c_au.is_app_user = true
        AND (
          LOWER(c_au.email) = LOWER(jc.email)
          OR REGEXP_REPLACE(COALESCE(c_au.phone,''), '[^0-9]', '', 'g')
             = REGEXP_REPLACE(COALESCE(jc.phone,''), '[^0-9]', '', 'g')
        )
        AND similarity(
          LOWER(TRIM(COALESCE(c_au.name,''))),
          LOWER(TRIM(COALESCE(jc.first_name,'') || ' ' || COALESCE(jc.last_name,'')))
        ) >= 0.4
    )`;
  }

  if (tags.length > 0) {
    if (tagLogic === 'AND') {
      // One EXISTS per tag — same pattern as contacts endpoint
      const clauses = tags.map((tag, i) => {
        params.push(tag);
        return `AND EXISTS (SELECT 1 FROM contact_tags ct${i + 1} WHERE ct${i + 1}.jobber_client_id = jc.jobber_client_id AND ct${i + 1}.tag = $${nextParam + i})`;
      });
      tagWhere   = clauses.join('\n');
      nextParam += tags.length;
    } else {
      params.push(tags); // array — uses ANY($n)
      tagWhere = `AND EXISTS (SELECT 1 FROM contact_tags ct_or WHERE ct_or.jobber_client_id = jc.jobber_client_id AND ct_or.tag = ANY($${nextParam}))`;
      nextParam += 1;
    }
  }

  const limitParam  = nextParam;
  const offsetParam = nextParam + 1;

  const baseConditions = `
    jc.contractor_id = $1
    AND jc.is_archived = false
    ${extraWhere}
    ${tagWhere}`;

  try {
    const [countResult, rowsResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total
         FROM jobber_clients jc
         WHERE ${baseConditions}`,
        params
      ),
      pool.query(
        `SELECT
           jc.jobber_client_id,
           jc.first_name,
           jc.last_name,
           jc.email,
           jc.phone,
           jc.is_company,
           jc.last_synced_at,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT('tag', ct.tag, 'source', ct.source)
             ) FILTER (WHERE ct.tag IS NOT NULL),
             '[]'::json
           ) AS tags
         FROM jobber_clients jc
         LEFT JOIN contact_tags ct
           ON ct.jobber_client_id = jc.jobber_client_id
           AND ct.contractor_id = $1
         WHERE ${baseConditions}
         GROUP BY
           jc.jobber_client_id, jc.first_name, jc.last_name,
           jc.email, jc.phone, jc.is_company, jc.last_synced_at
         ORDER BY jc.last_synced_at DESC NULLS LAST
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        [...params, limit, offset]
      ),
    ]);

    const clients = rowsResult.rows.map(row => ({
      jobber_client_id: row.jobber_client_id,
      first_name:       row.first_name    || '',
      last_name:        row.last_name     || '',
      email:            row.email         || null,
      phone:            row.phone         || null,
      is_company:       row.is_company    || false,
      last_synced_at:   row.last_synced_at || null,
      tags:             Array.isArray(row.tags) ? row.tags : [],
    }));

    res.json({
      total: parseInt(countResult.rows[0].total, 10),
      clients,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/jobber-clients' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
