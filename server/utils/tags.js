const { logError } = require('../middleware/errorLogger');

async function applyTag(pool, contactId, contractorId, tag, source) {
  try {
    await pool.query(
      `INSERT INTO contact_tags (contact_id, contractor_id, tag, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (contact_id, tag) DO UPDATE SET
         applied_at = NOW(),
         source = EXCLUDED.source`,
      [contactId, contractorId, tag, source]
    );
  } catch (err) {
    await logError({ req: null, error: err, source: `applyTag(${tag})` });
  }
}

async function removeTag(pool, contactId, contractorId, tag) {
  try {
    await pool.query(
      `DELETE FROM contact_tags WHERE contact_id = $1 AND tag = $2`,
      [contactId, tag]
    );
  } catch (err) {
    await logError({ req: null, error: err, source: `removeTag(${tag})` });
  }
}

// Additive-only backfill — applies tags that currently apply; never removes existing tags.
// jobberCrmData reserved for future CRM field mapping session (ignored for now).
async function backfillTagsForContacts(pool, contractorId, contactIds, jobberCrmData = null) {
  if (!Array.isArray(contactIds) || contactIds.length === 0) return;

  try {
    const result = await pool.query(
      `SELECT
         c.id AS contact_id,
         c.is_app_user,
         c.jobber_client_id,
         eoo.opt_out_campaigns,
         eoo.opt_out_all,
         eoo.opt_out_sms,
         eoo.referral_only,
         (SELECT COUNT(*) FROM contact_send_history csh WHERE csh.contact_id = c.id) AS send_count,
         (SELECT 1 FROM contact_send_history csh
          WHERE csh.contact_id = c.id AND csh.status = 'bounced' LIMIT 1) AS has_bounce,
         CASE
           WHEN c.jobber_client_id IS NOT NULL THEN
             (SELECT 1 FROM pipeline_cache pc
              WHERE pc.contractor_id = $1
                AND pc.jobber_client_id = c.jobber_client_id
                AND pc.pipeline_status = 'paid'
              LIMIT 1)
           ELSE NULL
         END AS is_paid_customer,
         (SELECT 1 FROM referral_conversions rc
          JOIN users u ON u.id = rc.user_id
          WHERE LOWER(u.email) = LOWER(c.email)
            AND rc.contractor_id = $1
          LIMIT 1) AS is_active_referrer,
         (SELECT 1 FROM campaign_contacts cc
          WHERE LOWER(cc.email) = LOWER(c.email)
            AND cc.contractor_id = $1
            AND cc.clicked = true
          LIMIT 1) AS is_high_engager
       FROM contacts c
       LEFT JOIN email_opt_outs eoo
         ON eoo.email = c.email AND eoo.contractor_id = c.contractor_id
       WHERE c.contractor_id = $1
         AND c.id = ANY($2::uuid[])`,
      [contractorId, contactIds]
    );

    for (const row of result.rows) {
      const cid = row.contact_id;
      if (row.is_app_user) await applyTag(pool, cid, contractorId, 'App User', 'system');
      if (row.jobber_client_id) await applyTag(pool, cid, contractorId, 'Existing Client', 'jobber');
      if (row.opt_out_campaigns || row.opt_out_all) await applyTag(pool, cid, contractorId, 'Opted Out', 'system');
      if (row.opt_out_sms) await applyTag(pool, cid, contractorId, 'SMS Opted Out', 'system');
      if (row.referral_only) await applyTag(pool, cid, contractorId, 'Referral Only', 'system');
      if (parseInt(row.send_count) > 0) await applyTag(pool, cid, contractorId, 'Previously Contacted', 'system');
      if (row.has_bounce) await applyTag(pool, cid, contractorId, 'Bounced', 'system');
      if (row.is_paid_customer) await applyTag(pool, cid, contractorId, 'Paid Customer', 'jobber');
      if (row.is_active_referrer) await applyTag(pool, cid, contractorId, 'Active Referrer', 'system');
      if (row.is_high_engager) await applyTag(pool, cid, contractorId, 'High Engager', 'system');
    }
  } catch (err) {
    await logError({ req: null, error: err, source: 'backfillTagsForContacts' });
  }
}

module.exports = { applyTag, removeTag, backfillTagsForContacts };
