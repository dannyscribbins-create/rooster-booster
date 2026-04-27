// TODO: setAccessToken() and module-level accessToken are deprecated.
// All credential access now goes through getCRMAdapter(contractorId) in crm/index.js.
// Remove these after confirming all routes use the adapter pattern.
const axios = require('axios');
const { pool } = require('../db');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../utils/retryHelpers');

let accessToken = null;

// TODO: setAccessToken() is kept for backward compatibility while existing routes import
// directly from jobber.js. Once all callers go through getCRMAdapter() in crm/index.js,
// this function and the module-level accessToken variable can be removed.
function setAccessToken(token) { accessToken = token; }

// ── TOKEN AUTO-REFRESH ────────────────────────────────────────────────────────
// TODO: refreshTokenIfNeeded() is kept for backward compatibility. It uses WHERE id=1
// (single-contractor pattern). Once all callers go through getCRMAdapter(), replace with
// a contractorId-aware version and remove this function.
async function refreshTokenIfNeeded() {
  const result = await pool.query('SELECT * FROM tokens WHERE id = 1');
  if (result.rows.length === 0) throw new Error('No token - visit /auth/jobber');
  const { refresh_token, expires_at } = result.rows[0];
  const fiveMin = new Date(Date.now() + 5 * 60 * 1000);
  if (!expires_at || new Date(expires_at) < fiveMin) {
    console.log('Refreshing token...');
    const response = await retryWithBackoff(
      () => axios.post('https://api.getjobber.com/api/oauth/token', {
        grant_type: 'refresh_token', client_id: process.env.JOBBER_CLIENT_ID,
        client_secret: process.env.JOBBER_CLIENT_SECRET, refresh_token,
      }),
      { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
    );
    const newAccess = response.data.access_token;
    const newRefresh = response.data.refresh_token;
    const newExpiry = new Date(Date.now() + (parseInt(response.data.expires_in) || 3600) * 1000);
    await pool.query(
      `UPDATE tokens SET access_token=$1, refresh_token=$2, expires_at=$3, updated_at=NOW() WHERE id=1`,
      [newAccess, newRefresh, newExpiry]
    );
    accessToken = newAccess;
    console.log('Token refreshed, expires:', newExpiry);
  }
}

// ── SHARED: FETCH PIPELINE FOR A REFERRER ────────────────────────────────────
// Reads from pipeline_cache (populated by the background sync worker) instead of
// calling Jobber directly. Returns the same shape as the previous Jobber-direct
// implementation so all callers (referrer.js routes, admin routes) are unaffected.
//
// Response shape:
//   { pipeline: [{ id, name, status, bonusEarned, payout, pre_start_date }], balance, paidCount }
//   plus sync_pending: true when the initial cache sync has not yet completed.
//
// Status mapping (pipeline_cache → frontend STATUS_CONFIG keys):
//   'paid'     → 'sold'   (paid invoice = closed sale in frontend terms)
//   'not_sold' → 'closed'
//   all others → unchanged ('lead', 'inspection', 'sold')
//
// Bonus eligibility: pipeline_status === 'paid' AND pre_start_date === false
async function fetchPipelineForReferrer(referrerName, contractorId = null, config = null) {
  // Resolve contractorId — config-based path provides it; legacy path defaults to accent-roofing
  const resolvedContractorId = contractorId || (config?.contractorId) || 'accent-roofing';
  // Note: config is accepted for caller compatibility with getCRMAdapter() but is not
  // used — pipeline data comes from pipeline_cache, not the CRM directly.
  // credential and effectiveStartDate in config are intentionally ignored here.

  // Read from pipeline_cache — case-insensitive match on referred_by
  const cacheResult = await pool.query(
    `SELECT jobber_client_id, client_name, pipeline_status, pre_start_date, last_synced_at
     FROM pipeline_cache
     WHERE contractor_id = $1
       AND LOWER(referred_by) = LOWER($2)
     ORDER BY jobber_created_at ASC NULLS LAST`,
    [resolvedContractorId, referrerName]
  );

  // If no cache records exist yet (initial sync not complete), signal sync pending
  if (cacheResult.rows.length === 0) {
    // MVP: issues a second query on every load for referrers with zero pipeline entries.
    // At scale, include sync_state in the initial query as a LEFT JOIN on pipeline_cache
    // so a single round-trip handles both the data and the sync status.
    const syncResult = await pool.query(
      'SELECT initial_sync_complete FROM sync_state WHERE contractor_id = $1',
      [resolvedContractorId]
    );
    const syncComplete = syncResult.rows[0]?.initial_sync_complete ?? false;
    return {
      pipeline: [],
      balance: 0,
      paidCount: 0,
      sync_pending: !syncComplete,
    };
  }

  // Map pipeline_cache rows to the response shape PipelineTab expects
  // Bonus schedule: $500 base + boost per tier [0,100,200,250,300,350,400]
  const boostSchedule = [0, 100, 200, 250, 300, 350, 400];
  // paidCount here is the index into boostSchedule — it counts only bonus-eligible
  // (post-start-date) paid referrals in this result set, NOT the referrer's all-time
  // paid count. Pre-start-date rows are excluded from tier calculation.
  let paidCount    = 0;
  let totalBalance = 0;

  const pipeline = cacheResult.rows.map(row => {
    const isPreStart = row.pre_start_date;

    // Map internal status to frontend status values
    let status;
    if (row.pipeline_status === 'paid')          status = 'sold';
    else if (row.pipeline_status === 'not_sold') status = 'closed';
    else status = row.pipeline_status; // 'lead', 'inspection', 'sold'

    // Bonus only fires when paid AND not pre-start-date
    const bonusEarned = row.pipeline_status === 'paid' && !isPreStart;

    let payout = null;
    if (bonusEarned) {
      const boost = boostSchedule[Math.min(paidCount, boostSchedule.length - 1)];
      payout        = 500 + boost;
      totalBalance += payout;
      paidCount++;
    }

    return {
      id:            row.jobber_client_id,
      name:          row.client_name || 'Unknown',
      status,
      bonusEarned,
      payout,
      pre_start_date: isPreStart,
    };
  });

  const synced_at = cacheResult.rows.reduce(
    (max, row) => (row.last_synced_at && (!max || row.last_synced_at > max) ? row.last_synced_at : max),
    null
  );
  return { pipeline, balance: totalBalance, paidCount, synced_at };
}

// ── CRM FIELD DISCOVERY ───────────────────────────────────────────────────────
// Runs GetCustomFieldConfigurations, upserts into contractor_jobber_fields,
// and returns the full field list from the DB.
// tokenOverride: pass a fresh token directly (e.g. from OAuth callback) to skip DB read.
async function discoverJobberFields(contractorId, tokenOverride = null) {
  let token = tokenOverride;
  if (!token) {
    await refreshTokenIfNeeded();
    const tokenResult = await pool.query(
      'SELECT access_token FROM tokens WHERE contractor_id = $1',
      [contractorId]
    );
    if (tokenResult.rows.length === 0 || !tokenResult.rows[0].access_token) {
      throw new Error('No Jobber token found. Connect your Jobber account first.');
    }
    token = tokenResult.rows[0].access_token;
  }

  const query = `
    query GetCustomFieldConfigurations {
      customFieldConfigurations {
        nodes {
          ... on CustomFieldConfigurationText {
            id
            name
            __typename
          }
          ... on CustomFieldConfigurationDropdown {
            id
            name
            __typename
            dropdownOptions
          }
          ... on CustomFieldConfigurationNumeric {
            id
            name
            __typename
          }
          ... on CustomFieldConfigurationTrueFalse {
            id
            name
            __typename
          }
          ... on CustomFieldConfigurationLink {
            id
            name
            __typename
          }
        }
      }
    }
  `;

  console.log('[discoverFields] Starting field discovery for contractor:', contractorId);

  const response = await retryWithBackoff(
    () => axios.post(
      'https://api.getjobber.com/api/graphql',
      { query },
      { headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-02-17'
      } }
    ),
    { retries: 3, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
  );

  console.log('[discoverFields] Raw Jobber response:', JSON.stringify(response.data, null, 2));

  const TYPE_MAP = {
    CustomFieldConfigurationText:      'text',
    CustomFieldConfigurationDropdown:  'dropdown',
    CustomFieldConfigurationNumeric:   'numeric',
    CustomFieldConfigurationTrueFalse: 'truefalse',
    CustomFieldConfigurationLink:      'link',
    CustomFieldConfigurationArea:      'area',
  };

  const nodes = response.data?.data?.customFieldConfigurations?.nodes || [];

  // Deduplicate by name — Jobber returns the same field at multiple levels
  // (job, client, quote). Keep first occurrence of each unique name only.
  const seen = new Set();
  const uniqueNodes = nodes.filter(node => {
    if (!node.name || seen.has(node.name)) return false;
    seen.add(node.name);
    return true;
  });

  console.log('[discoverFields] Fields found:', uniqueNodes.length, uniqueNodes.map(n => n.name));

  // Clear existing fields for this contractor before re-inserting clean set
  await pool.query(
    'DELETE FROM contractor_jobber_fields WHERE contractor_id = $1',
    [contractorId]
  );

  for (const node of uniqueNodes) {
    const fieldType = TYPE_MAP[node.__typename] || 'other';
    const optionsValue = (node.__typename === 'CustomFieldConfigurationDropdown' && Array.isArray(node.dropdownOptions) && node.dropdownOptions.length)
      ? JSON.stringify(node.dropdownOptions.filter(o => o && o.trim() !== ''))
      : null;
    await pool.query(
      `INSERT INTO contractor_jobber_fields (contractor_id, jobber_field_id, label, field_type, options, discovered_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (contractor_id, jobber_field_id) DO UPDATE SET
         label = $3, field_type = $4, options = $5, discovered_at = NOW()`,
      [contractorId, node.id, node.name, fieldType, optionsValue]
    );
  }

  console.log('[discoverFields] Upsert complete. Rows processed:', uniqueNodes.length);

  const result = await pool.query(
    `SELECT jobber_field_id, label, field_type, options, discovered_at
     FROM contractor_jobber_fields
     WHERE contractor_id = $1
     ORDER BY label ASC`,
    [contractorId]
  );

  return result.rows;
}

module.exports = { setAccessToken, refreshTokenIfNeeded, fetchPipelineForReferrer, discoverJobberFields };
