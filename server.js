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
      updated_at TIMESTAMP DEFAULT NOW()
    )
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

    // Save token to database so it survives server restarts
    await pool.query(`
      INSERT INTO tokens (id, access_token, refresh_token, updated_at)
      VALUES (1, $1, $2, NOW())
      ON CONFLICT (id) DO UPDATE
        SET access_token = $1, refresh_token = $2, updated_at = NOW()
    `, [accessToken, refreshToken]);

    console.log('Token saved to database');
    res.send('Authorization successful! You can close this tab.');
  } catch (err) {
    res.status(500).send('Authorization failed: ' + err.message);
  }
});

app.get('/api/pipeline', async (req, res) => {
  const { referrer } = req.query;
  try {
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

app.listen(4000, () => {
  console.log('Server running on port 4000');
});