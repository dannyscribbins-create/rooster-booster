const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const { verifyAdminSession } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/permissions');
const { logError } = require('../../middleware/errorLogger');
const { deriveOptOutType } = require('../../utils/adminHelpers');
const { applyTag, removeTag } = require('../../utils/tags');
const { normalizeTagGroupVisibility } = require('../../utils/tagGroupVisibility');

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

router.get('/api/admin/contacts/tags/suggestions', requirePermission('contacts'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
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

router.get('/api/admin/contacts/tag-summary', requirePermission('contacts'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
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

router.get('/api/admin/contacts', requirePermission('contacts'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;

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

// ── UNIFIED CONTACTS ──────────────────────────────────────────────────────────
// Returns Jobber clients + app-only contacts merged in one table.
// source_badge: 'both' = linked, 'jobber' = Jobber-only, 'app' = app-only

router.get('/api/admin/contacts/unified', requirePermission('contacts'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;

  const search  = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const source  = typeof req.query.source === 'string' ? req.query.source.trim() : '';
  const tier    = typeof req.query.tier   === 'string' ? req.query.tier.trim()   : '';
  const rawTags = req.query.tags;
  const tagMode = req.query.tagMode === 'AND' ? 'AND' : 'OR';
  const page    = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset  = (page - 1) * limit;

  const filterTags = Array.isArray(rawTags)
    ? rawTags.filter(Boolean)
    : rawTags ? [rawTags] : [];

  try {
    // Build the unified CTE: Jobber clients (with/without link) + app-only contacts
    const params = [contractorId];
    let paramCount = 1;

    // Search condition fragments (applied per sub-query)
    let searchCondJobber = '';
    let searchCondContact = '';
    if (search) {
      paramCount++;
      params.push(`%${search}%`);
      const p = paramCount;
      searchCondJobber  = `AND (jc.first_name ILIKE $${p} OR jc.last_name ILIKE $${p} OR jc.email ILIKE $${p} OR jc.phone ILIKE $${p})`;
      searchCondContact = `AND (c.name ILIKE $${p} OR c.email ILIKE $${p} OR c.phone ILIKE $${p})`;
    }

    // Tier filter: derivable at query time — no tag dependency needed.
    // tier_1 = Jobber clients with no linked contact (source_badge='jobber')
    // tier_2 = Linked contacts (source_badge='both') + App-only contacts (source_badge='app')
    // The UI sends tier_1/tier_2 as tag pills (tags=tier_1), not as a tier= param — intercept
    // them here so they drive structural WHERE conditions, not tag EXISTS lookups.
    const tierFromTags = filterTags.includes('tier_1') ? 'tier_1'
                       : filterTags.includes('tier_2') ? 'tier_2' : null;
    const effectiveTier = tier || tierFromTags;
    let effectiveSource = source;
    if (effectiveTier === 'tier_1') effectiveSource = 'jobber';
    else if (effectiveTier === 'tier_2') effectiveSource = 'tier_2'; // special: both+app

    // Strip tier tags from the tag filter — they've been promoted to structural conditions above
    const structuralFilterTags = filterTags.filter(t => t !== 'tier_1' && t !== 'tier_2');

    // ── Jobber sub-query (both + jobber source badges) ────────────────────────
    const jobberSubQuery = (effectiveSource === 'app') ? '' : `
      SELECT
        jc.jobber_client_id,
        cjl.contact_id::text                          AS contact_id,
        TRIM(COALESCE(jc.first_name,'') || ' ' || COALESCE(jc.last_name,'')) AS name,
        COALESCE(jc.email, c.email)                   AS email,
        COALESCE(jc.phone, c.phone)                   AS phone,
        CASE WHEN cjl.contact_id IS NOT NULL THEN 'both' ELSE 'jobber' END AS source_badge,
        jc.last_synced_at,
        (SELECT COALESCE(ARRAY_AGG(ct.tag ORDER BY ct.tag), '{}')
         FROM contact_tags ct
         WHERE ct.jobber_client_id = jc.jobber_client_id AND ct.contractor_id = jc.contractor_id
           AND ct.tag NOT IN ('jobber_client','tier_1','tier_2')
        )                                              AS tags
      FROM jobber_clients jc
      LEFT JOIN contact_jobber_links cjl ON cjl.jobber_client_id = jc.jobber_client_id AND cjl.contractor_id = jc.contractor_id
      LEFT JOIN contacts c ON c.id = cjl.contact_id
      WHERE jc.contractor_id = $1
        ${searchCondJobber}
        ${(effectiveSource === 'both' || effectiveSource === 'tier_2') ? 'AND cjl.contact_id IS NOT NULL' : ''}
        ${effectiveSource === 'jobber' ? 'AND cjl.contact_id IS NULL' : ''}
    `;

    // ── App-only sub-query ────────────────────────────────────────────────────
    const appSubQuery = (effectiveSource === 'jobber' || effectiveSource === 'both') ? '' : `
      SELECT
        NULL                                           AS jobber_client_id,
        c.id::text                                     AS contact_id,
        COALESCE(c.name,'')                            AS name,
        c.email,
        c.phone,
        'app'::text                                    AS source_badge,
        NULL::timestamptz                              AS last_synced_at,
        (SELECT COALESCE(ARRAY_AGG(ct.tag ORDER BY ct.tag), '{}')
         FROM contact_tags ct
         WHERE ct.contact_id = c.id AND ct.contractor_id = c.contractor_id
           AND ct.tag NOT IN ('jobber_client','tier_1','tier_2')
        )                                              AS tags
      FROM contacts c
      WHERE c.contractor_id = $1
        AND NOT EXISTS (SELECT 1 FROM contact_jobber_links cjl WHERE cjl.contact_id = c.id)
        ${searchCondContact}
    `;

    // Build UNION
    const subQueries = [jobberSubQuery, appSubQuery].filter(Boolean);
    if (subQueries.length === 0) {
      return res.json({ total: 0, rows: [] });
    }

    const unionSQL = subQueries.join('\nUNION ALL\n');

    // ── Tag filter (AND/OR) applied on top of the unified CTE ────────────────
    let tagFilter = '';
    if (structuralFilterTags.length > 0) {
      if (tagMode === 'AND') {
        tagFilter = structuralFilterTags.map(t => {
          params.push(t);
          return `AND EXISTS (
            SELECT 1 FROM contact_tags ct
            WHERE (ct.jobber_client_id = u.jobber_client_id OR ct.contact_id::text = u.contact_id)
              AND ct.contractor_id = $1 AND ct.tag = $${params.length}
          )`;
        }).join('\n');
      } else {
        const placeholders = structuralFilterTags.map(t => { params.push(t); return `$${params.length}`; });
        tagFilter = `AND EXISTS (
          SELECT 1 FROM contact_tags ct
          WHERE (ct.jobber_client_id = u.jobber_client_id OR ct.contact_id::text = u.contact_id)
            AND ct.contractor_id = $1 AND ct.tag = ANY(ARRAY[${placeholders.join(',')}])
        )`;
      }
    }

    // count is before LIMIT/OFFSET — run separate count query
    const countSQL = `
      WITH u AS (${unionSQL})
      SELECT COUNT(*) AS total FROM u
      WHERE TRUE ${tagFilter}
    `;

    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const rowSQL = `
      WITH u AS (${unionSQL})
      SELECT * FROM u
      WHERE TRUE ${tagFilter}
      ORDER BY last_synced_at DESC NULLS LAST, name ASC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const [countResult, rowsResult] = await Promise.all([
      pool.query(countSQL, params.slice(0, params.length - 2)),
      pool.query(rowSQL, params),
    ]);

    res.json({
      total: parseInt(countResult.rows[0].total, 10),
      rows: rowsResult.rows.map(r => ({
        jobber_client_id: r.jobber_client_id || null,
        contact_id:       r.contact_id       || null,
        name:             r.name             || '',
        email:            r.email            || null,
        phone:            r.phone            || null,
        source_badge:     r.source_badge,
        last_synced_at:   r.last_synced_at   || null,
        tags:             Array.isArray(r.tags) ? r.tags : [],
      })),
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/contacts/unified' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── CONTACT DETAIL ────────────────────────────────────────────────────────────

router.get('/api/admin/contacts/:contactId', requirePermission('contacts'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
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

router.patch('/api/admin/contacts/:contactId/resubscribe', requirePermission('contacts.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
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

router.post('/api/admin/contacts/:contactId/tags', requirePermission('contacts.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
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

router.delete('/api/admin/contacts/:contactId/tags/:tag', requirePermission('contacts.manage'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
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
// ?visibleOnly=true filters out groups where tag_group_visibility[prefix] === false.
router.get('/api/admin/jobber-client-tag-summary', requirePermission('contacts'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const visibleOnly = req.query.visibleOnly === 'true';
  try {
    const [tagResult, systemTagResult, visibilityResult] = await Promise.all([
      pool.query(
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
      ),
      pool.query(
        `SELECT DISTINCT tag
         FROM contact_tags
         WHERE contractor_id = $1
           AND source = 'system'
           AND tag NOT LIKE '%:%'
         ORDER BY tag`,
        [contractorId]
      ),
      visibleOnly
        ? pool.query(
            `SELECT tag_group_visibility FROM contractor_settings WHERE contractor_id = $1`,
            [contractorId]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const visibility = normalizeTagGroupVisibility(visibilityResult.rows[0]?.tag_group_visibility || {});

    // Build RoofMiles system tag group — normalized values for consistent pill rendering
    const normalizeTagVal = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const systemValues = systemTagResult.rows.map(r => normalizeTagVal(r.tag));
    const roofmilesGroup = {
      prefix:       'roofmiles',
      label:        'RoofMiles Tags',
      values:       systemValues,
      valueCount:   systemValues.length,
      contactCount: 0, // RoofMiles tags span contacts table — not counted per jobber_client_id
      count:        0, // backward compat
    };

    let categories = tagResult.rows.map(row => {
      const values = Array.isArray(row.values) ? row.values : [];
      const contactCount = parseInt(row.client_count, 10);
      return {
        prefix:       row.prefix,
        label:        row.prefix.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        values,
        valueCount:   values.length,
        contactCount,
        count:        contactCount, // backward compat — AdminContactsTab.jsx reads .count
      };
    });

    if (visibleOnly) {
      const normalizeVal = s => s.toLowerCase().replace(/\s+/g, '_');
      categories = categories
        .filter(cat => visibility[cat.prefix]?.enabled !== false)
        .map(cat => {
          const hiddenVals = visibility[cat.prefix]?.hidden_values || [];
          if (hiddenVals.length === 0) return cat;
          const filteredValues = cat.values.filter(v => !hiddenVals.includes(normalizeVal(v)));
          return { ...cat, values: filteredValues, valueCount: filteredValues.length };
        });

      // Apply visibleOnly filtering to the RoofMiles group
      if (visibility['roofmiles']?.enabled !== false) {
        const hiddenVals = visibility['roofmiles']?.hidden_values || [];
        if (hiddenVals.length > 0) {
          roofmilesGroup.values = roofmilesGroup.values.filter(v => !hiddenVals.includes(v));
          roofmilesGroup.valueCount = roofmilesGroup.values.length;
        }
        if (roofmilesGroup.values.length > 0) {
          categories = [roofmilesGroup, ...categories];
        }
      }
    } else if (roofmilesGroup.values.length > 0) {
      categories = [roofmilesGroup, ...categories];
    }

    res.json({ categories });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/jobber-client-tag-summary' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── JOBBER CLIENTS LIST ───────────────────────────────────────────────────────

router.get('/api/admin/jobber-clients', requirePermission('contacts'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;

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

// ── JOBBER CLIENT DETAIL ──────────────────────────────────────────────────────

router.get('/api/admin/jobber-clients/:jobberClientId', requirePermission('contacts'), async (req, res) => {
  const adminSession = await verifyAdminSession(req, res);
  if (!adminSession) return;
  const { contractorId } = adminSession;
  const { jobberClientId } = req.params;

  try {
    const [clientResult, tagsResult, linkResult] = await Promise.all([
      pool.query(
        `SELECT jobber_client_id, first_name, last_name, email, phone,
                is_company, is_lead, is_archived, last_synced_at
         FROM jobber_clients
         WHERE jobber_client_id = $1 AND contractor_id = $2`,
        [jobberClientId, contractorId]
      ),
      pool.query(
        `SELECT tag, source, applied_at
         FROM contact_tags
         WHERE jobber_client_id = $1 AND contractor_id = $2
         ORDER BY applied_at DESC`,
        [jobberClientId, contractorId]
      ),
      pool.query(
        `SELECT cjl.contact_id, cjl.match_confidence, cjl.matched_on, cjl.created_at,
                c.name, c.email AS contact_email, c.phone AS contact_phone, c.is_app_user
         FROM contact_jobber_links cjl
         LEFT JOIN contacts c ON c.id = cjl.contact_id
         WHERE cjl.jobber_client_id = $1 AND cjl.contractor_id = $2
         LIMIT 1`,
        [jobberClientId, contractorId]
      ),
    ]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Jobber client not found' });
    }

    const client = clientResult.rows[0];
    const link   = linkResult.rows[0] || null;

    res.json({
      jobber_client_id: client.jobber_client_id,
      first_name:       client.first_name    || null,
      last_name:        client.last_name     || null,
      email:            client.email         || null,
      phone:            client.phone         || null,
      is_company:       client.is_company    || false,
      is_lead:          client.is_lead       || false,
      is_archived:      client.is_archived   || false,
      last_synced_at:   client.last_synced_at || null,
      source_badge:     link ? 'both' : 'jobber',
      tags:             tagsResult.rows.map(t => ({ tag: t.tag, source: t.source, applied_at: t.applied_at })),
      linked_contact:   link ? {
        contact_id:       link.contact_id,
        name:             link.name          || null,
        email:            link.contact_email || null,
        phone:            link.contact_phone || null,
        is_app_user:      link.is_app_user   || false,
        match_confidence: link.match_confidence,
        matched_on:       link.matched_on,
        linked_at:        link.created_at,
      } : null,
    });
  } catch (err) {
    await logError({ req, error: err, source: 'GET /api/admin/jobber-clients/:jobberClientId' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
