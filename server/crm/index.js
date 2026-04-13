const { pool } = require('../db');

// ── CRM ADAPTER DISPATCHER ────────────────────────────────────────────────────
// getCRMAdapter(contractorId) — queries contractor_crm_settings to build a
// config-bound adapter for the contractor's connected CRM.
//
// Returns an object with:
//   fetchPipelineForReferrer(referrerName) — calls the correct adapter with config injected
//
// Throws if no CRM is connected for the contractorId.
async function getCRMAdapter(contractorId) {
  const settingsResult = await pool.query(
    'SELECT * FROM contractor_crm_settings WHERE contractor_id = $1',
    [contractorId]
  );

  if (settingsResult.rows.length === 0 || !settingsResult.rows[0].is_connected) {
    throw new Error(`No connected CRM found for contractor: ${contractorId}. Visit the CRM settings page to connect.`);
  }

  const settings = settingsResult.rows[0];
  const { crm_type, connection_method, referrer_field_name, stage_map, api_key,
          referral_start_date, connected_at } = settings;

  let credential;

  if (connection_method === 'oauth') {
    // Use dynamic require to avoid circular dependency issues at module load time
    const jobber = require('./jobber');
    await jobber.refreshTokenIfNeeded();
    const tokenResult = await pool.query(
      'SELECT access_token FROM tokens WHERE contractor_id = $1',
      [contractorId]
    );
    if (tokenResult.rows.length === 0) {
      throw new Error(`No OAuth token found for contractor: ${contractorId}. Re-authorize via /auth/jobber.`);
    }
    credential = tokenResult.rows[0].access_token;
  } else if (connection_method === 'api_key') {
    // MVP: api_key stored as plaintext
    // TODO: Add encryption before FORA launch — use AES-256-GCM or AWS KMS
    credential = api_key;
  } else {
    throw new Error(`Unknown connection_method: ${connection_method}`);
  }

  const config = {
    contractorId,
    crmType: crm_type,
    credential,
    referrerFieldName: referrer_field_name || 'Referred by',
    stageMap: stage_map || {
      lead: 'Quote Sent',
      inspection: 'Assessment Scheduled',
      sold: 'Job Approved',
      paid: 'Invoice Paid',
    },
    // effectiveStartDate: referral_start_date when set by contractor, otherwise falls back to OAuth connected_at.
    // fetchPipelineForReferrer() uses this to filter Jobber clients by createdAt.
    effectiveStartDate: referral_start_date ?? connected_at ?? null,
  };

  switch (crm_type) {
    case 'jobber': {
      const jobber = require('./jobber');
      return {
        fetchPipelineForReferrer: (referrerName) =>
          jobber.fetchPipelineForReferrer(referrerName, contractorId, config),
      };
    }
    case 'servicetitan': {
      const servicetitan = require('./servicetitan');
      return {
        fetchPipelineForReferrer: (referrerName) =>
          servicetitan.fetchPipelineForReferrer(referrerName, contractorId, config),
      };
    }
    case 'acculynx': {
      const acculynx = require('./acculynx');
      return {
        fetchPipelineForReferrer: (referrerName) =>
          acculynx.fetchPipelineForReferrer(referrerName, contractorId, config),
      };
    }
    default:
      throw new Error(`Unknown CRM type: ${crm_type}`);
  }
}

module.exports = { getCRMAdapter };
