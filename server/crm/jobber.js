// TODO: setAccessToken() and module-level accessToken are deprecated.
// All credential access now goes through getCRMAdapter(contractorId) in crm/index.js.
// Remove these after confirming all routes use the adapter pattern.
const axios = require('axios');
const { pool } = require('../db');

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
    const response = await axios.post('https://api.getjobber.com/api/oauth/token', {
      grant_type: 'refresh_token', client_id: process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET, refresh_token
    });
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
    `SELECT jobber_client_id, client_name, pipeline_status, pre_start_date
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

  return { pipeline, balance: totalBalance, paidCount };
}

module.exports = { setAccessToken, refreshTokenIfNeeded, fetchPipelineForReferrer };
