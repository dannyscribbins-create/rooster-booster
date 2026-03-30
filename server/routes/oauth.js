const express = require('express');
const router = express.Router();
const axios = require('axios');
const { pool } = require('../db');
const { setAccessToken } = require('../crm/jobber');

// ── JOBBER OAUTH ──────────────────────────────────────────────────────────────
router.get('/auth/jobber', (req, res) => {
  res.redirect(`https://api.getjobber.com/api/oauth/authorize?response_type=code&client_id=${process.env.JOBBER_CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}`);
});
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post('https://api.getjobber.com/api/oauth/token', {
      grant_type: 'authorization_code', client_id: process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET, redirect_uri: process.env.REDIRECT_URI, code
    });
    setAccessToken(response.data.access_token);
    const expiresAt = new Date(Date.now() + (parseInt(response.data.expires_in) || 3600) * 1000);
    await pool.query(
      `INSERT INTO tokens (id,access_token,refresh_token,expires_at,updated_at) VALUES (1,$1,$2,$3,NOW())
       ON CONFLICT (id) DO UPDATE SET access_token=$1, refresh_token=$2, expires_at=$3, updated_at=NOW()`,
      [response.data.access_token, response.data.refresh_token, expiresAt]
    );
    res.send('Authorization successful! You can close this tab.');
  } catch (err) { res.status(500).send('Authorization failed: ' + err.message); }
});

module.exports = router;
