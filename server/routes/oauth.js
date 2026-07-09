// Required env vars: JOBBER_CLIENT_ID, JOBBER_CLIENT_SECRET, REDIRECT_URI, FRONTEND_URL
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../db');
const { discoverJobberFields } = require('../crm/jobber');
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { jobberShouldRetry } = require('../utils/retryHelpers');

// ── JOBBER OAUTH ──────────────────────────────────────────────────────────────
router.get('/auth/jobber', (req, res) => {
  const contractorId = req.query.contractorId || 'accent-roofing';
  res.redirect(
    `https://api.getjobber.com/api/oauth/authorize?response_type=code` +
    `&client_id=${process.env.JOBBER_CLIENT_ID}` +
    `&redirect_uri=${process.env.REDIRECT_URI}` +
    `&state=${encodeURIComponent(contractorId)}`
  );
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const contractorId = state || 'accent-roofing';
  try {
    const response = await axios.post('https://api.getjobber.com/api/oauth/token', {
      grant_type: 'authorization_code', client_id: process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET, redirect_uri: process.env.REDIRECT_URI, code
    });
    const expiresAt = new Date(Date.now() + (parseInt(response.data.expires_in) || 3600) * 1000);
    await pool.query(
      `INSERT INTO tokens (id,access_token,refresh_token,expires_at,updated_at,contractor_id) VALUES (1,$1,$2,$3,NOW(),$4)
       ON CONFLICT (id) DO UPDATE SET access_token=$1, refresh_token=$2, expires_at=$3, updated_at=NOW(), contractor_id=$4`,
      [response.data.access_token, response.data.refresh_token, expiresAt, contractorId]
    );

    // Tenant rebuild S3, Batch C(b): captures which Jobber account this OAuth connection
    // belongs to, so webhook handlers can resolve contractor_id from the payload's
    // accountId instead of the single-tenant getDefaultContractorId() tripwire (webhook-side
    // Batch C is a separate deploy — webhooks/jobber.js is not touched here). This capture
    // inherits this file's existing state-param tenant trust (contractorId above can still
    // fall back to the stale 'accent-roofing' literal when no state param is present) —
    // that trust question is tracked as F2 in CRM_TOKEN_FIX_SPEC.md and is NOT addressed by
    // this change; a future TF session owns it. Dormant until the next OAuth connect/reconnect.
    try {
      const accountIdRes = await retryWithBackoff(
        () => axios.post(
          'https://api.getjobber.com/api/graphql',
          { query: `query { account { id } }` },
          { headers: {
              Authorization: `Bearer ${response.data.access_token}`,
              'Content-Type': 'application/json',
              'X-JOBBER-GRAPHQL-VERSION': '2026-02-17'
          } }
        ),
        { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
      );
      const jobberAccountId = accountIdRes.data?.data?.account?.id;
      await pool.query(
        `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)
         ON CONFLICT (contractor_id) DO UPDATE SET jobber_account_id = EXCLUDED.jobber_account_id`,
        [contractorId, jobberAccountId]
      );
    } catch (captureErr) {
      // Never fail the OAuth flow over this — a missing jobber_account_id fails closed
      // later, at webhook time, via the existing quarantine pattern (recoverable); a
      // broken OAuth connect is worse.
      await logError({ req, error: captureErr, source: 'GET /callback — jobber_account_id capture' });
      console.warn('Could not capture Jobber account id:', captureErr.message);
    }

    // Fetch Jobber account name to store in CRM settings
    let crmAccountName = 'Unknown Account';
    try {
      const accountRes = await axios.post(
        'https://api.getjobber.com/api/graphql',
        { query: '{ account { name } }' },
        { headers: {
            Authorization: `Bearer ${response.data.access_token}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': '2026-02-17'
        } }
      );
      if (accountRes.data?.data?.account?.name) {
        crmAccountName = accountRes.data.data.account.name;
      }
    } catch (accountErr) {
      await logError({ req, error: accountErr, source: 'GET /callback — Jobber account name fetch' });
      console.warn('Could not fetch Jobber account name:', accountErr.message);
    }

    // Upsert CRM settings row so the admin CRM page shows as connected
    await pool.query(
      `INSERT INTO contractor_crm_settings
         (contractor_id, crm_type, connection_method, crm_account_name, is_connected, connected_at)
       VALUES ($1, 'jobber', 'oauth', $2, true, NOW())
       ON CONFLICT (contractor_id) DO UPDATE SET
         crm_type = 'jobber',
         connection_method = 'oauth',
         crm_account_name = $2,
         is_connected = true,
         connected_at = NOW()`,
      [contractorId, crmAccountName]
    );

    // Auto-trigger field discovery on Jobber connect — fire and forget
    discoverJobberFields(contractorId, response.data.access_token)
      .catch(err => console.warn('Auto field discovery failed silently:', err.message));

    // Redirect to admin CRM settings page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?admin=true&section=crm`);
  } catch (err) {
    await logError({ req, error: err, source: 'GET /callback' });
    res.status(500).send('Authorization failed. Please try again.');
  }
});

module.exports = router;
