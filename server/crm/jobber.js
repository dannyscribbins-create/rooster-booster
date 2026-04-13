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
// fetchPipelineForReferrer(referrerName, contractorId, config)
//
// config = { credential, referrerFieldName, stageMap }
//   - credential: OAuth access token or API key (from getCRMAdapter)
//   - referrerFieldName: Jobber custom field label, e.g. 'Referred by'
//   - stageMap: maps our internal stage names to CRM display labels (available for future use)
//
// contractorId and config are optional for backward compatibility with existing direct callers.
// When config is omitted, falls back to module-level accessToken and hardcoded 'referred by'.
async function fetchPipelineForReferrer(referrerName, contractorId = null, config = null) {
  let token;
  let fieldName;

  let startDateISO;

  if (config) {
    // New config-based path: credential and field name come from getCRMAdapter()
    token = config.credential;
    fieldName = config.referrerFieldName.toLowerCase();
    startDateISO = config.effectiveStartDate
      ? new Date(config.effectiveStartDate).toISOString()
      : null;
  } else {
    // Legacy path: use module-level accessToken, refresh via WHERE id=1 pattern
    // TODO: remove legacy path once all callers use getCRMAdapter()
    await refreshTokenIfNeeded();
    token = accessToken;
    fieldName = 'referred by';
    // Fallback: filter to last 90 days to avoid scanning thousands of historical clients
    startDateISO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Build the clients() filter argument — when startDateISO is set, restrict by createdAt
  // TODO: add cursor-based pagination once createdAt filter is confirmed working in production.
  // With date filtering active, first:50 is sufficient for normal referral volume per sync.
  const clientsArg = startDateISO
    ? `first:50, filter:{ createdAt:{ after:"${startDateISO}" } }`
    : `first:50`;

  const response = await axios.post(
    'https://api.getjobber.com/api/graphql',
    { query: `{ clients(${clientsArg}) { nodes { id firstName lastName
        customFields { ... on CustomFieldText { label valueText } }
        quotes(first:5) { nodes { id quoteStatus } }
        jobs(first:5) { nodes { id jobStatus
          invoices(first:5) { nodes { id invoiceStatus amounts { total } } }
        } }
      } } }` },
    { headers: { Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': '2025-04-16' } }
  );
  if (!response.data.data) throw new Error('No data from Jobber: ' + JSON.stringify(response.data));
  const allClients = response.data.data.clients.nodes;
  const referred = allClients.filter(c => {
    const f = c.customFields.find(f => f.label && f.label.toLowerCase() === fieldName);
    return f && f.valueText?.trim().toLowerCase() === referrerName.trim().toLowerCase();
  });
  const pipeline = referred.map(client => {
    const jobs = client.jobs.nodes;
    const quotes = client.quotes.nodes;
    const paidInvoice = jobs.flatMap(j => j.invoices.nodes).find(inv => inv.invoiceStatus === 'paid');
    const hasJob = jobs.length > 0;
    const activeQuotes = quotes.filter(q => q.quoteStatus !== 'archived');
    let status, bonusEarned = false;
    if (hasJob) { status = 'sold'; if (paidInvoice) bonusEarned = true; }
    else if (activeQuotes.length > 0) status = 'inspection';
    else if (quotes.length > 0) status = 'closed';
    else status = 'lead';
    return { id: client.id, name: `${client.firstName} ${client.lastName}`, status, bonusEarned };
  });
  const boostSchedule = [0, 100, 200, 250, 300, 350, 400];
  let paidCount = 0, totalBalance = 0;
  const result = pipeline.map(client => {
    let payout = null;
    if (client.bonusEarned) {
      const boost = boostSchedule[Math.min(paidCount, boostSchedule.length - 1)];
      payout = 500 + boost; totalBalance += payout; paidCount++;
    }
    return { ...client, payout };
  });
  return { pipeline: result, balance: totalBalance, paidCount };
}

module.exports = { setAccessToken, refreshTokenIfNeeded, fetchPipelineForReferrer };
