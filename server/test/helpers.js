'use strict';

// Inserts the minimal contractor_settings row required by FK lookups and
// engagement_cadence_settings seeding. ON CONFLICT DO NOTHING is safe on repeat calls.
async function seedContractor(pool, contractorId) {
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, company_name)
     VALUES ($1, $1)
     ON CONFLICT (contractor_id) DO NOTHING`,
    [contractorId]
  );
}

// Inserts a jobber_clients row. name goes into first_name for simplicity.
async function seedJobberClient(pool, { contractorId, jobberClientId, name = null, email = null }) {
  await pool.query(
    `INSERT INTO jobber_clients
       (jobber_client_id, contractor_id, first_name, last_name, email, last_synced_at)
     VALUES ($1, $2, $3, NULL, $4, NOW())
     ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING`,
    [jobberClientId, contractorId, name, email]
  );
}

// Inserts a contacts row. Caller must supply a fixed UUID string for id.
async function seedContact(pool, { contractorId, id, name = null, email }) {
  await pool.query(
    `INSERT INTO contacts (id, contractor_id, email, name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (contractor_id, email) DO NOTHING`,
    [id, contractorId, email, name]
  );
}

// Inserts a contact_tags row. Exactly one of contactId or jobberClientId must be set.
async function seedTag(pool, { contractorId, contactId = null, jobberClientId = null, tag }) {
  if (!contactId && !jobberClientId) {
    throw new Error('seedTag: must provide either contactId or jobberClientId');
  }
  await pool.query(
    `INSERT INTO contact_tags (contact_id, jobber_client_id, contractor_id, tag, source)
     VALUES ($1, $2, $3, $4, 'system')
     ON CONFLICT DO NOTHING`,
    [contactId, jobberClientId, contractorId, tag]
  );
}

// Inserts a dynamic_audiences row with is_active = TRUE and returns the new id.
async function seedAudience(pool, { contractorId, name, tags, mode }) {
  const { rows } = await pool.query(
    `INSERT INTO dynamic_audiences (contractor_id, name, filter_json, is_active)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id`,
    [contractorId, name, JSON.stringify({ tags, mode })]
  );
  return rows[0].id;
}

module.exports = { seedContractor, seedJobberClient, seedContact, seedTag, seedAudience };
