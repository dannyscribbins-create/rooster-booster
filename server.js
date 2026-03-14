const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

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

// On startup: create the tokens table if it doesn't exist, then load the saved token
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

  // Add expires_at column if it doesn't exist yet (for existing databases)
  await pool.query(`
    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
  `);

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
// This function runs before every Jobber API call.
// If the token expires within the next 5 minutes, it automatically gets a new one.
async function refreshTokenIfNeeded() {
  const result = await pool.query('SELECT * FROM tokens WHERE id = 1');
  if (result.rows.length === 0) {
    throw new Error('No token in database - visit /auth/jobber to authorize');
  }

  const { refresh_token, expires_at } = result.rows[0];

  // Check if token expires within the next 5 minutes
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
    const expiresIn = parseInt(response.data.expires_in) || 3600; // default to 1 hour if missing
const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Save the new token to database
    await pool.query(`
      UPDATE tokens
      SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
      WHERE id = 1
    `, [newAccessToken, newRefreshToken, newExpiresAt]);

    accessToken = newAccessToken;
    console.log('Token refreshed successfully - expires at:', newExpiresAt);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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
    const expiresIn = parseInt(response.data.expires_in) || 3600; // default to 1 hour if missing
const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Save token + expiry time to database
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

app.get('/api/pipeline', async (req, res) => {
  const { referrer } = req.query;
  try {
    // Auto-refresh token if it's about to expire before calling Jobber
    await refreshTokenIfNeeded();

    const response = await axios.post(
      'https://api.getjobber.com/api/graphql',
     { query: `{
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
}`},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-02-17'
        }
      }
    );

    console.log('Jobber response:', JSON.stringify(response.data, null, 2));
    if (!response.data.data) {
      return res.status(500).send('No data returned: ' + JSON.stringify(response.data));
    }
    const allClients = response.data.data.clients.nodes;

    const referred = allClients.filter(client => {
      const referredByField = client.customFields.find(f => f.label && f.label.toLowerCase() === 'referred by');
      return referredByField && referredByField.valueText === referrer;
    });

    const pipeline = referred.map(client => {
      const jobs = client.jobs.nodes;
      const quotes = client.quotes.nodes;

      const paidInvoice = jobs.flatMap(j => j.invoices.nodes).find(inv => inv.invoiceStatus === 'paid');
      const hasJob = jobs.length > 0;
      const activeQuotes = quotes.filter(q => q.quoteStatus !== 'archived');
      const hasActiveQuote = activeQuotes.length > 0;

      let status;
      let payout = null;

      if (hasJob) {
        status = 'sold';
        if (paidInvoice) {
          payout = paidInvoice.amounts.total;
        }
      } else if (hasActiveQuote) {
        status = 'inspection';
      } else if (quotes.length > 0 && activeQuotes.length === 0) {
        status = 'closed';
      } else {
        status = 'lead';
      }

      return {
        id: client.id,
        name: `${client.firstName} ${client.lastName}`,
        status,
        payout
      };
    });

    res.json(pipeline);
  } catch (err) {
    res.status(500).send('API call failed: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
  }
});

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
    if (user.pin !== pin) {
      return res.status(401).json({ error: 'Incorrect PIN' });
    }
    res.json({ success: true, fullName: user.full_name });
  } catch (err) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// ── ADMIN ENDPOINTS ───────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rooster123';

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect admin password' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query('SELECT id, full_name, email, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', async (req, res) => {
  const { password, full_name, email, pin } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      'INSERT INTO users (full_name, email, pin) VALUES ($1, $2, $3) RETURNING id, full_name, email, created_at',
      [full_name, email, pin]
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
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });
  try {
    await pool.query('UPDATE users SET pin = $1 WHERE id = $2', [pin, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

app.listen(4000, () => {
  console.log('Server running on port 4000');
});