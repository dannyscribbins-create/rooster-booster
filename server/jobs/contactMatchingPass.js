const { pool } = require('../db');
const { logError } = require('../middleware/errorLogger');

/**
 * runContactMatchingPass(contractorId, options)
 *
 * Matches jobber_clients rows to contacts rows using the Contact Matching Standard:
 *   - PRIMARY: email match OR normalized phone match
 *   - CONFIRMATION: pg_trgm name similarity >= 0.4
 *   - HIGH confidence (both signals) → insert into contact_jobber_links
 *   - MEDIUM confidence (contact match only, no name) → skip
 *
 * options:
 *   jobberClientId  — scope to one Jobber client (webhook / incremental sync path)
 *   contactId       — scope to one app contact (signup path)
 *   (neither)       — full pass over all jobber_clients for contractor
 *
 * Returns: { processed, linked }
 */
async function runContactMatchingPass(contractorId, options = {}) {
  const { jobberClientId, contactId } = options;

  let processed = 0;
  let linked = 0;

  try {
    // ── Build the candidate set of Jobber clients to evaluate ─────────────────
    let jobberClients;

    if (jobberClientId) {
      const r = await pool.query(
        `SELECT jobber_client_id, first_name, last_name, email, phone
         FROM jobber_clients
         WHERE jobber_client_id = $1 AND contractor_id = $2`,
        [jobberClientId, contractorId]
      );
      jobberClients = r.rows;
    } else if (contactId) {
      // When scoped to a contact, fetch Jobber clients whose email or phone
      // matches the contact — the contact is the anchor, not Jobber.
      const contactRow = await pool.query(
        `SELECT email, phone FROM contacts WHERE id = $1`,
        [contactId]
      );
      if (!contactRow.rows[0]) return { processed: 0, linked: 0 };
      const { email, phone } = contactRow.rows[0];

      const normalizedPhone = phone
        ? phone.replace(/[^0-9]/g, '')
        : null;

      const r = await pool.query(
        `SELECT jobber_client_id, first_name, last_name, email, phone
         FROM jobber_clients
         WHERE contractor_id = $1
           AND (
             ($2::TEXT IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($2)))
             OR ($3::TEXT IS NOT NULL AND $3 <> '' AND REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g') = $3)
           )`,
        [contractorId, email, normalizedPhone]
      );
      jobberClients = r.rows;
    } else {
      // Full pass
      const r = await pool.query(
        `SELECT jobber_client_id, first_name, last_name, email, phone
         FROM jobber_clients
         WHERE contractor_id = $1`,
        [contractorId]
      );
      jobberClients = r.rows;
    }

    for (const jc of jobberClients) {
      processed++;

      const jEmail = jc.email ? jc.email.trim().toLowerCase() : null;
      const jPhone = jc.phone ? jc.phone.replace(/[^0-9]/g, '') : null;
      const jName  = [jc.first_name, jc.last_name].filter(Boolean).join(' ').toLowerCase().trim();

      if (!jEmail && !jPhone) continue;

      // ── Find matching contacts using email OR phone ────────────────────────
      const matchResult = await pool.query(
        `SELECT
           c.id,
           COALESCE(c.email,'') AS email,
           REGEXP_REPLACE(COALESCE(c.phone,''), '[^0-9]', '', 'g') AS norm_phone,
           LOWER(TRIM(COALESCE(c.name,''))) AS norm_name,
           CASE
             WHEN $1::TEXT IS NOT NULL AND LOWER(TRIM(COALESCE(c.email,''))) = $1 THEN 'email'
             ELSE 'phone'
           END AS matched_on
         FROM contacts c
         WHERE c.contractor_id = $3
           AND (
             ($1::TEXT IS NOT NULL AND LOWER(TRIM(COALESCE(c.email,''))) = $1)
             OR ($2::TEXT IS NOT NULL AND $2 <> '' AND REGEXP_REPLACE(COALESCE(c.phone,''), '[^0-9]', '', 'g') = $2)
           )`,
        [jEmail, jPhone, contractorId]
      );

      for (const contact of matchResult.rows) {
        // ── Confirm with pg_trgm name similarity ──────────────────────────────
        // If either side has no name, skip name check (MEDIUM confidence → skip).
        if (!jName || !contact.norm_name) continue;

        const simResult = await pool.query(
          `SELECT similarity($1, $2) AS sim`,
          [jName, contact.norm_name]
        );
        const sim = parseFloat(simResult.rows[0]?.sim || 0);
        if (sim < 0.4) continue;

        // HIGH confidence — insert link
        const insertResult = await pool.query(
          `INSERT INTO contact_jobber_links
             (contact_id, jobber_client_id, contractor_id, match_confidence, matched_on)
           VALUES ($1, $2, $3, 'high', $4)
           ON CONFLICT (contact_id, jobber_client_id) DO NOTHING
           RETURNING id`,
          [contact.id, jc.jobber_client_id, contractorId, contact.matched_on]
        );

        if (insertResult.rows.length > 0) {
          // Link is new — promote Jobber client from tier_1 to tier_2
          await pool.query(
            `DELETE FROM contact_tags
             WHERE jobber_client_id = $1 AND contractor_id = $2 AND tag = 'tier_1'`,
            [jc.jobber_client_id, contractorId]
          );
          await pool.query(
            `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
             VALUES ($1, $2, 'tier_2', 'system', NOW())
             ON CONFLICT DO NOTHING`,
            [jc.jobber_client_id, contractorId]
          );
          linked++;
        }
      }
    }
  } catch (err) {
    await logError({ req: null, error: err, source: 'runContactMatchingPass' });
    console.error('[contactMatchingPass] Error:', err.message);
  }

  return { processed, linked };
}

module.exports = { runContactMatchingPass };
