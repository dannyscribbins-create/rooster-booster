const axios = require('axios');
const { pool } = require('../db');

let accessToken = null;

function setAccessToken(token) { accessToken = token; }

// ── TOKEN AUTO-REFRESH ────────────────────────────────────────────────────────
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
async function fetchPipelineForReferrer(referrerName) {
  await refreshTokenIfNeeded();
  const response = await axios.post(
    'https://api.getjobber.com/api/graphql',
    { query: `{ clients(first:50) { nodes { id firstName lastName
        customFields { ... on CustomFieldText { label valueText } }
        quotes(first:5) { nodes { id quoteStatus } }
        jobs(first:5) { nodes { id jobStatus
          invoices(first:5) { nodes { id invoiceStatus amounts { total } } }
        } }
      } } }` },
    { headers: { Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': '2026-02-17' } }
  );
  if (!response.data.data) throw new Error('No data from Jobber: ' + JSON.stringify(response.data));
  const allClients = response.data.data.clients.nodes;
  const referred = allClients.filter(c => {
    const f = c.customFields.find(f => f.label && f.label.toLowerCase() === 'referred by');
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
