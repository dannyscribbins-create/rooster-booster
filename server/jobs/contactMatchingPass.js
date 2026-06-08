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
 *   jobberClientIds — scope to an array of Jobber client IDs (batch path)
 *   contactId       — scope to one app contact (signup path)
 *   (neither)       — full pass over all contacts for contractor (iterate contacts → jobber)
 *
 * Returns: { processed, linked, errors }
 */
async function runContactMatchingPass(contractorId, options = {}) {
  const { jobberClientId, jobberClientIds, contactId } = options;

  let processed = 0;
  let linked = 0;
  let errors = 0;

  console.log('[contactMatchingPass] starting — contractor:', contractorId,
    'scope:', jobberClientIds ? jobberClientIds.length + ' clients'
    : contactId ? 'single contact'
    : jobberClientId ? 'single jobber client'
    : 'full pass');

  try {
    if (jobberClientId || jobberClientIds) {
      // ── Jobber-client-scoped path (webhook / incremental sync / import) ───────
      // Fetch the Jobber client(s), find matching contacts for each.
      const ids = jobberClientIds || [jobberClientId];
      const jcResult = await pool.query(
        `SELECT jobber_client_id, first_name, last_name, email, phone
         FROM jobber_clients
         WHERE jobber_client_id = ANY($1) AND contractor_id = $2`,
        [ids, contractorId]
      );

      for (const jc of jcResult.rows) {
        processed++;
        try {
          const newLinks = await _matchJobberClientToContacts(contractorId, jc);
          linked += newLinks;
        } catch (err) {
          errors++;
          await logError({ req: null, error: err, source: `runContactMatchingPass — jobber_client ${jc.jobber_client_id}` });
        }
      }

    } else if (contactId) {
      // ── Contact-scoped path (signup path) ───────────────────────────────────
      // Fetch the contact, find matching Jobber clients.
      const contactResult = await pool.query(
        `SELECT id, name, email, phone FROM contacts WHERE id = $1 AND contractor_id = $2`,
        [contactId, contractorId]
      );
      const contact = contactResult.rows[0];
      if (contact) {
        processed++;
        try {
          const newLinks = await _matchContactToJobberClients(contractorId, contact);
          linked += newLinks;
        } catch (err) {
          errors++;
          await logError({ req: null, error: err, source: `runContactMatchingPass — contact ${contactId}` });
        }
      }

    } else {
      // ── Full pass — iterate contacts, look up matching jobber_clients ─────────
      // With ~13 contacts and 16K Jobber clients, iterating contacts is far more efficient.
      const contactsResult = await pool.query(
        `SELECT id, name, email, phone FROM contacts WHERE contractor_id = $1`,
        [contractorId]
      );

      for (const contact of contactsResult.rows) {
        processed++;
        try {
          const newLinks = await _matchContactToJobberClients(contractorId, contact);
          linked += newLinks;
        } catch (err) {
          errors++;
          await logError({ req: null, error: err, source: `runContactMatchingPass — contact ${contact.id}` });
        }
      }
    }
  } catch (err) {
    await logError({ req: null, error: err, source: 'runContactMatchingPass' });
    console.error('[contactMatchingPass] Error:', err.message);
  }

  console.log('[contactMatchingPass] complete — processed:', processed, 'linked:', linked, 'errors:', errors);

  return { processed, linked, errors };
}

// ── Match a contact to Jobber clients ─────────────────────────────────────────
// Finds Jobber clients whose email OR phone matches the contact, confirms with
// pg_trgm name similarity >= 0.4, and inserts a link for each HIGH confidence match.
async function _matchContactToJobberClients(contractorId, contact) {
  const cEmail = contact.email ? contact.email.trim().toLowerCase() : null;
  const cPhone = contact.phone ? contact.phone.replace(/[^0-9]/g, '') : null;
  const cName  = contact.name  ? contact.name.toLowerCase().trim()   : null;

  if (!cEmail && !cPhone) return 0;

  // Find Jobber clients whose email OR normalized phone matches
  const jcResult = await pool.query(
    `SELECT jobber_client_id, first_name, last_name, email, phone,
            CASE
              WHEN $1::TEXT IS NOT NULL AND LOWER(TRIM(COALESCE(email,''))) = $1 THEN 'email'
              ELSE 'phone'
            END AS matched_on
     FROM jobber_clients
     WHERE contractor_id = $3
       AND (
         ($1::TEXT IS NOT NULL AND LOWER(TRIM(COALESCE(email,''))) = $1)
         OR ($2::TEXT IS NOT NULL AND $2 <> '' AND REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g') = $2)
       )`,
    [cEmail, cPhone, contractorId]
  );

  let newLinks = 0;

  for (const jc of jcResult.rows) {
    const jName = [jc.first_name, jc.last_name].filter(Boolean).join(' ').toLowerCase().trim();

    // MEDIUM confidence (one side has no name) → skip
    if (!cName || !jName) continue;

    // Confirm with pg_trgm name similarity
    const simResult = await pool.query(
      `SELECT similarity($1, $2) AS sim`,
      [cName, jName]
    );
    const sim = parseFloat(simResult.rows[0]?.sim || 0);
    if (sim < 0.4) continue;

    // HIGH confidence — determine matched_on (may be both if both signals present)
    let matchedOn = jc.matched_on;
    if (cEmail && jc.email && jc.email.trim().toLowerCase() === cEmail &&
        cPhone && jc.phone && jc.phone.replace(/[^0-9]/g, '') === cPhone) {
      matchedOn = 'email+phone';
    }

    // Insert link
    const insertResult = await pool.query(
      `INSERT INTO contact_jobber_links
         (contact_id, jobber_client_id, contractor_id, match_confidence, matched_on)
       VALUES ($1, $2, $3, 'high', $4)
       ON CONFLICT (contact_id, jobber_client_id) DO NOTHING
       RETURNING id`,
      [contact.id, jc.jobber_client_id, contractorId, matchedOn]
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
      newLinks++;
    }
  }

  return newLinks;
}

// ── Match a Jobber client to contacts ────────────────────────────────────────
// Used by the webhook / incremental sync path where a single Jobber client is the anchor.
async function _matchJobberClientToContacts(contractorId, jc) {
  const jEmail = jc.email ? jc.email.trim().toLowerCase() : null;
  const jPhone = jc.phone ? jc.phone.replace(/[^0-9]/g, '') : null;
  const jName  = [jc.first_name, jc.last_name].filter(Boolean).join(' ').toLowerCase().trim();

  if (!jEmail && !jPhone) return 0;

  // Find contacts whose email OR normalized phone matches
  const matchResult = await pool.query(
    `SELECT
       c.id,
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

  let newLinks = 0;

  for (const contact of matchResult.rows) {
    // MEDIUM confidence (one side has no name) → skip
    if (!jName || !contact.norm_name) continue;

    const simResult = await pool.query(
      `SELECT similarity($1, $2) AS sim`,
      [jName, contact.norm_name]
    );
    const sim = parseFloat(simResult.rows[0]?.sim || 0);
    if (sim < 0.4) continue;

    // Determine matched_on
    let matchedOn = contact.matched_on;
    if (jEmail && jPhone) {
      // Check if both signals present
      const bothCheck = await pool.query(
        `SELECT 1 FROM contacts WHERE id = $1
          AND LOWER(TRIM(COALESCE(email,''))) = $2
          AND REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g') = $3`,
        [contact.id, jEmail, jPhone]
      );
      if (bothCheck.rows.length > 0) matchedOn = 'email+phone';
    }

    const insertResult = await pool.query(
      `INSERT INTO contact_jobber_links
         (contact_id, jobber_client_id, contractor_id, match_confidence, matched_on)
       VALUES ($1, $2, $3, 'high', $4)
       ON CONFLICT (contact_id, jobber_client_id) DO NOTHING
       RETURNING id`,
      [contact.id, jc.jobber_client_id, contractorId, matchedOn]
    );

    if (insertResult.rows.length > 0) {
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
      newLinks++;
    }
  }

  return newLinks;
}

module.exports = { runContactMatchingPass };
