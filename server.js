const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = process.env.JOBBER_CLIENT_ID;
const CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Connect to PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// This will hold the token in memory after we load it from the database
let accessToken = null;

// ── DATABASE INIT ─────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      pin TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cashout_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      full_name TEXT,
      email TEXT,
      amount NUMERIC,
      method TEXT,
      status TEXT DEFAULT 'pending',
      requested_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Activity log table — records logins and cashout submissions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      full_name TEXT,
      email TEXT,
      detail TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Add columns that may not exist in older databases
  await pool.query(`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);
  await pool.query(`ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS method TEXT`);

  const result = await pool.query('SELECT access_token FROM tokens WHERE id = 1');
  if (result.rows.length > 0) {
    accessToken = result.rows[0].access_token;
    console.log('Token loaded from database successfully');
  } else {
    console.log('No token found in database - visit /auth/jobber to authorize');
  }
}

initDB();

// ── TOKEN AUTO-REFRESH ────────────────────────────────────────────────────────
async function refreshTokenIfNeeded() {
  const result = await pool.query('SELECT * FROM tokens WHERE id = 1');
  if (result.rows.length === 0) {
    throw new Error('No token in database - visit /auth/jobber to authorize');
  }

  const { refresh_token, expires_at } = result.rows[0];
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  const tokenExpiresAt = new Date(expires_at);

  if (!expires_at || tokenExpiresAt < fiveMinutesFromNow) {
    console.log('Token expiring soon or unknown - refreshing now...');

    const response = await axios.post('https://api.getjobber.com/api/oauth/token', {
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token
    });

    const newAccessToken = response.data.access_token;
    const newRefreshToken = response.data.refresh_token;
    const expiresIn = parseInt(response.data.expires_in) || 3600;
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

    await pool.query(`
      UPDATE tokens
      SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
      WHERE id = 1
    `, [newAccessToken, newRefreshToken, newExpiresAt]);

    accessToken = newAccessToken;
    console.log('Token refreshed successfully - expires at:', newExpiresAt);
  }
}

// ── SHARED: FETCH PIPELINE FOR A REFERRER ────────────────────────────────────
// This logic is shared between /api/pipeline (referrer view) and
// /api/admin/referrer/:name (admin view). Kept in one place so they never drift.
async function fetchPipelineForReferrer(referrerName) {
  await refreshTokenIfNeeded();

  const response = await axios.post(
    'https://api.getjobber.com/api/graphql',
    {
      query: `{
        clients(first: 50) {
          nodes {
            id
            firstName
            lastName
            customFields {
              ... on CustomFieldText {
                label
                valueText
              }
            }
            quotes(first: 5) {
              nodes {
                id
                quoteStatus
              }
            }
            jobs(first: 5) {
              nodes {
                id
                jobStatus
                invoices(first: 5) {
                  nodes {
                    id
                    invoiceStatus
                    amounts {
                      total
                    }
                  }
                }
              }
            }
          }
        }
      }`
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': '2026-02-17'
      }
    }
  );

  if (!response.data.data) {
    throw new Error('No data returned from Jobber: ' + JSON.stringify(response.data));
  }

  const allClients = response.data.data.clients.nodes;

  const referred = allClients.filter(client => {
    const referredByField = client.customFields.find(f => f.label && f.label.toLowerCase() === 'referred by');
    return referredByField && referredByField.valueText === referrerName;
  });

  const pipeline = referred.map(client => {
    const jobs = client.jobs.nodes;
    const quotes = client.quotes.nodes;

    const paidInvoice = jobs.flatMap(j => j.invoices.nodes).find(inv => inv.invoiceStatus === 'paid');
    const hasJob = jobs.length > 0;
    const activeQuotes = quotes.filter(q => q.quoteStatus !== 'archived');
    const hasActiveQuote = activeQuotes.length > 0;

    let status;
    let bonusEarned = false;

    if (hasJob) {
      status = 'sold';
      if (paidInvoice) bonusEarned = true;
    } else if (hasActiveQuote) {
      status = 'inspection';
    } else if (quotes.length > 0 && activeQuotes.length === 0) {
      status = 'closed';
    } else {
      status = 'lead';
    }

    return { id: client.id, name: `${client.firstName} ${client.lastName}`, status, bonusEarned };
  });

  // Apply boost schedule to paid referrals
  const boostSchedule = [0, 100, 200, 250, 300, 350, 400];
  let paidCount = 0;
  let totalBalance = 0;

  const result = pipeline.map(client => {
    let payout = null;
    if (client.bonusEarned) {
      const boost = boostSchedule[Math.min(paidCount, boostSchedule.length - 1)];
      payout = 500 + boost;
      totalBalance += payout;
      paidCount++;
    }
    return { ...client, payout };
  });

  return { pipeline: result, balance: totalBalance, paidCount };
}
// ─────────────────────────────────────────────────────────────────────────────

// ── JOBBER OAUTH ──────────────────────────────────────────────────────────────
app.get('/auth/jobber', (req, res) => {
  const authUrl = `https://api.getjobber.com/api/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`;
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post('https://api.getjobber.com/api/oauth/token', {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code
    });

    accessToken = response.data.access_token;
    const refreshToken = response.data.refresh_token;
    const expiresIn = parseInt(response.data.expires_in) || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await pool.query(`
      INSERT INTO tokens (id, access_token, refresh_token, expires_at, updated_at)
      VALUES (1, $1, $2, $3, NOW())
      ON CONFLICT (id) DO UPDATE
        SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
    `, [accessToken, refreshToken, expiresAt]);

    console.log('Token saved to database - expires at:', expiresAt);
    res.send('Authorization successful! You can close this tab.');
  } catch (err) {
    res.status(500).send('Authorization failed: ' + err.message);
  }
});

// ── REFERRER: PIPELINE ────────────────────────────────────────────────────────
app.get('/api/pipeline', async (req, res) => {
  const { referrer } = req.query;
  try {
    const data = await fetchPipelineForReferrer(referrer);
    res.json(data);
  } catch (err) {
    res.status(500).send('API call failed: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
  }
});

// ── REFERRER: LOGIN ───────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, pin } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'No account found with that email' });
    }
    const user = result.rows[0];
    const pinMatch = await bcrypt.compare(String(pin), user.pin);
    if (!pinMatch) {
      return res.status(401).json({ error: 'Incorrect PIN' });
    }

    // Log the login event
    await pool.query(
      `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('login', $1, $2, 'User logged in')`,
      [user.full_name, user.email]
    );

    res.json({ success: true, fullName: user.full_name, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// ── REFERRER: CASH OUT REQUEST ────────────────────────────────────────────────
app.post('/api/cashout', async (req, res) => {
  const { user_id, full_name, email, amount, method } = req.body;
  try {
    await pool.query(
      `INSERT INTO cashout_requests (user_id, full_name, email, amount, method, status, requested_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
      [user_id, full_name, email, amount, method || null]
    );

    // Log the cashout event
    await pool.query(
      `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('cashout', $1, $2, $3)`,
      [full_name, email, `Requested $${amount} via ${method || 'unknown'}`]
    );

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'dannyscribbins@gmail.com',
      subject: '💰 New Cash Out Request - Rooster Booster',
      html: `
        <h2>New Cash Out Request</h2>
        <p><strong>Name:</strong> ${full_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Amount Requested:</strong> $${amount}</p>
        <p><strong>Method:</strong> ${method || 'Not specified'}</p>
        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        <p>Log in to the admin panel to approve or deny this request.</p>
      `
    });
    res.json({ success: true, message: 'Cash out request submitted!' });
  } catch (err) {
    console.error('Cash out error:', err);
    res.status(500).json({ error: 'Failed to save cash out request' });
  }
});

// ── ADMIN: AUTH ───────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rooster123';

function checkAdminPassword(password) {
  return password === ADMIN_PASSWORD;
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (checkAdminPassword(password)) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect admin password' });
  }
});

// ── ADMIN: REFERRER MANAGEMENT ────────────────────────────────────────────────
app.get('/api/admin/users', async (req, res) => {
  const { password } = req.query;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query('SELECT id, full_name, email, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', async (req, res) => {
  const { password, full_name, email, pin } = req.body;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const hashedPin = await bcrypt.hash(String(pin), 10);
    const result = await pool.query(
      'INSERT INTO users (full_name, email, pin) VALUES ($1, $2, $3) RETURNING id, full_name, email, created_at',
      [full_name, email, hashedPin]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'A user with that email already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.patch('/api/admin/users/:id/pin', async (req, res) => {
  const { password, pin } = req.body;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });
  try {
    const hashedPin = await bcrypt.hash(String(pin), 10);
    await pool.query('UPDATE users SET pin = $1 WHERE id = $2', [hashedPin, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const { password } = req.query;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: REFERRER DETAIL (pipeline + balance from Jobber) ───────────────────
app.get('/api/admin/referrer/:name', async (req, res) => {
  const { password } = req.query;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const data = await fetchPipelineForReferrer(decodeURIComponent(req.params.name));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch referrer data: ' + err.message });
  }
});

// ── ADMIN: CASH OUT REQUEST MANAGEMENT ───────────────────────────────────────
app.get('/api/admin/cashouts', async (req, res) => {
  const { password } = req.query;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      `SELECT * FROM cashout_requests ORDER BY requested_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/cashouts/:id', async (req, res) => {
  const { password, status } = req.body;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  if (!['approved', 'denied'].includes(status)) return res.status(400).json({ error: 'Status must be approved or denied' });
  try {
    const result = await pool.query(
      `UPDATE cashout_requests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    // Log the admin action
    await pool.query(
      `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('admin', $1, $2, $3)`,
      [result.rows[0].full_name, result.rows[0].email, `Cash out request #${req.params.id} ${status} ($${result.rows[0].amount})`]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: ACTIVITY LOG ───────────────────────────────────────────────────────
app.get('/api/admin/activity', async (req, res) => {
  const { password } = req.query;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(4000, () => {
  console.log('Server running on port 4000');
});