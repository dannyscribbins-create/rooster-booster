const axios = require('axios');
const { pool } = require('../db');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../utils/retryHelpers');
const { logError } = require('../middleware/errorLogger');
const { boostSchedule } = require('../constants/boostSchedule');

// ── TOKEN AUTO-REFRESH ────────────────────────────────────────────────────────
// force=true bypasses the expires_at freshness check and always exchanges the refresh
// token. Used by the invoice-paid webhook's 401 retry path (2c mitigation): with refresh
// token rotation enabled and multiple uncoordinated call sites sharing a contractor's
// tokens row, a concurrent refresh elsewhere can invalidate the token this caller just
// read even though expires_at still looked fresh — force lets the caller recover in place
// rather than trusting a freshness check that a sibling refresh has already invalidated.
//
// Single-flight guard — per-process only. If RoofMiles ever runs multiple server
// instances, replace/augment with a Postgres advisory lock (e.g.
// pg_advisory_xact_lock(hashtext(contractor_id))) so the guard is visible across
// instances. Railway runs a single instance today.
const inFlightRefreshes = new Map(); // contractorId -> Promise

async function refreshTokenIfNeeded(contractorId, { force = false } = {}) {
  if (!contractorId) {
    const err = new Error('refreshTokenIfNeeded: contractorId is required');
    await logError({ req: null, error: err, source: 'refreshTokenIfNeeded' });
    throw err;
  }

  // A force caller arriving while a refresh is already in flight awaits that refresh
  // (it produces a brand-new token, which is what force wants) rather than starting a
  // second exchange — force bypasses only the expiry check below, never this guard.
  if (inFlightRefreshes.has(contractorId)) {
    return inFlightRefreshes.get(contractorId);
  }

  const refreshPromise = (async () => {
    const result = await pool.query('SELECT refresh_token, expires_at FROM tokens WHERE contractor_id = $1', [contractorId]);
    if (result.rows.length === 0) {
      throw new Error(`refreshTokenIfNeeded: no access token found for contractor ${contractorId} — visit /auth/jobber`);
    }
    const { refresh_token, expires_at } = result.rows[0];
    const fiveMin = new Date(Date.now() + 5 * 60 * 1000);
    if (force || !expires_at || new Date(expires_at) < fiveMin) {
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
        `UPDATE tokens SET access_token=$1, refresh_token=$2, expires_at=$3, updated_at=NOW() WHERE contractor_id=$4`,
        [newAccess, newRefresh, newExpiry, contractorId]
      );
      console.log('Token refreshed, expires:', newExpiry);
    }
  })();

  inFlightRefreshes.set(contractorId, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    // Cleared on success OR failure so the next call — whether a retry after a failed
    // attempt or a genuinely new refresh cycle — starts a fresh attempt, never stuck.
    inFlightRefreshes.delete(contractorId);
  }
}

// F4 helper (TF session) — the one sanctioned way to read a contractor's access token;
// never query the tokens table ad hoc for reads.
async function getContractorAccessToken(contractorId) {
  if (!contractorId) {
    const err = new Error('getContractorAccessToken: contractorId is required');
    await logError({ req: null, error: err, source: 'getContractorAccessToken' });
    throw err;
  }
  const result = await pool.query('SELECT access_token FROM tokens WHERE contractor_id = $1', [contractorId]);
  const accessToken = result.rows[0]?.access_token;
  if (!accessToken) {
    throw new Error(`getContractorAccessToken: no access token found for contractor ${contractorId} — visit /auth/jobber`);
  }
  return accessToken;
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

  // Fetch confirmed conversion records for this referrer — source of truth for bonus amounts.
  // pipeline_status 'paid' items that already have a conversion record (from the invoice-paid
  // webhook or a prior pipeline load) carry the confirmed bonus_amount here.
  // Items with no record yet use the speculative payout as fallback.
  const conversionMap = {};
  try {
    const convResult = await pool.query(
      `SELECT rc.jobber_client_id, rc.bonus_amount
       FROM referral_conversions rc
       JOIN users u ON u.id = rc.user_id AND LOWER(u.full_name) = LOWER($2)
       WHERE rc.contractor_id = $1`,
      [resolvedContractorId, referrerName]
    );
    for (const row of convResult.rows) {
      conversionMap[row.jobber_client_id] = parseInt(row.bonus_amount);
    }
  } catch (convErr) {
    await logError({ req: null, error: convErr });
    console.error('[fetchPipeline] conversion lookup failed:', convErr.message);
  }

  // Map pipeline_cache rows to the response shape PipelineTab expects
  // Bonus schedule: $500 base + boost per tier — see server/constants/boostSchedule.js
  // paidCount here is the index into boostSchedule — it counts only bonus-eligible
  // (post-start-date) paid referrals in this result set, NOT the referrer's all-time
  // paid count. Pre-start-date rows are excluded from tier calculation.
  let paidCount    = 0;
  let totalBalance = 0;

  const pipeline = cacheResult.rows.map(row => {
    const isPreStart = row.pre_start_date;

    // Map internal status to frontend status values
    // pipeline_status 'paid' → 'complete' (invoice paid; bonus confirmed)
    // pipeline_status 'sold' → 'sold' (job in progress; no bonus yet)
    let status;
    if (row.pipeline_status === 'paid')          status = 'complete';
    else if (row.pipeline_status === 'not_sold') status = 'closed';
    else status = row.pipeline_status; // 'lead', 'inspection', 'sold'

    // Bonus only fires when paid AND not pre-start-date
    const bonusEarned = row.pipeline_status === 'paid' && !isPreStart;

    // conversion_bonus: actual amount from referral_conversions (null if record not yet written)
    const conversionBonus = bonusEarned ? (conversionMap[row.jobber_client_id] ?? null) : null;

    let payout = null;
    if (bonusEarned) {
      const boost = boostSchedule[Math.min(paidCount, boostSchedule.length - 1)];
      payout        = 500 + boost;
      totalBalance += conversionBonus ?? payout;
      paidCount++;
    }

    return {
      id:               row.jobber_client_id,
      name:             row.client_name || 'Unknown',
      status,
      bonusEarned,
      payout,
      conversion_bonus: conversionBonus,
      pre_start_date:   isPreStart,
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
    await refreshTokenIfNeeded(contractorId);
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

// Uses the TOP-LEVEL Query.requests field, not the nested Client.requests connection — the
// nested connection accepts no sort/filter args at our pinned version (2026-02-17): confirmed
// live via a GraphiQL argumentNotAccepted error, and confirmed in Jobber's Client type docs
// (args: after/before/first/last only; sibling connections like contacts/jobs/notes DO take
// sort, but requests and quotes are plain). The top-level Query.requests field, by contrast,
// takes filter: RequestFilterAttributes (which includes clientId) AND sort: [RequestsSortInput!]
// (the key/direction shape — REQUESTED_AT is the field it actually belongs to). Verified live
// in GraphiQL on 2026-07-06 against a production client: no errors, requests returned
// newest-first, requestedQueryCost sane. first: 25 with server-side newest-first ordering means
// the referral-era request is effectively always in-window regardless of client history length
// — this resolves the "10+ requests could miss the relevant one" limitation from the earlier
// nested-connection attempt.
// (Also confirmed in docs but NOT verified live — do not build against without a GraphiQL check
// first: QuoteFilterAttributes on the top-level `quotes` query includes clientId AND
// salespersonId; RequestFilterAttributes includes assignedTo, "the user assigned to the
// request's assessment".)
const ATTRIBUTION_QUERY = `
  query GetClientAttributionData($id: EncodedId!) {
    requests(first: 25, filter: { clientId: $id }, sort: [{ key: REQUESTED_AT, direction: DESCENDING }]) {
      nodes {
        id
        createdAt
        salesperson { id }
        assessment {
          id
          assignedUsers { nodes { id } }
        }
      }
    }
  }
`;

// Fetches requests and assessments for the attribution engine.
// _httpPost is injected in tests; production uses axios.post.
async function fetchAttributionData(clientId, token, _httpPost = null) {
  const post = _httpPost || axios.post;

  const response = await retryWithBackoff(
    () => post(
      'https://api.getjobber.com/api/graphql',
      { query: ATTRIBUTION_QUERY, variables: { id: clientId } },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
          'Content-Type': 'application/json',
        },
      }
    ),
    { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
  );

  if (response.data.errors) {
    const diagnosticDetails = {
      errors: (response.data.errors).slice(0, 5),
      connectionSlice: response.data?.data?.requests?.nodes?.slice(0, 2),
    };
    console.error('[fetchAttributionData] GraphQL error response:', JSON.stringify(diagnosticDetails)); // diagnostic log — intentional
    const err = new Error(`fetchAttributionData: GraphQL errors for client ${clientId}`);
    await logError({ req: null, error: err, source: 'fetchAttributionData' });
    throw err;
  }

  if (!response.data?.data?.requests) {
    const err = new Error(`fetchAttributionData: null requests response for client ${clientId}`);
    await logError({ req: null, error: err, source: 'fetchAttributionData' });
    throw err;
  }

  const requestNodes = response.data.data.requests.nodes;
  // Belt-and-suspenders — server-side sort on the query is by REQUESTED_AT (primary; no
  // CREATED_AT key exists in RequestsSortKey), not createdAt, so this local sort covers the
  // distinction between the two timestamps (see ATTRIBUTION_QUERY comment).
  const sorted = [...requestNodes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const assessments = sorted.filter(r => r.assessment != null).map(r => r.assessment);

  return { requests: sorted, assessments };
}

module.exports = { refreshTokenIfNeeded, getContractorAccessToken, fetchPipelineForReferrer, discoverJobberFields, fetchAttributionData };
