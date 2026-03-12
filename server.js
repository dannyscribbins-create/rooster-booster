const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = process.env.JOBBER_CLIENT_ID;
const CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let accessToken = null;

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
        clients {
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
            quotes {
              nodes {
                id
                status
              }
            }
            jobs {
              nodes {
                id
                title
                jobStatus
                invoices {
                  nodes {
                    id
                    status
                    total
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

    // Filter clients referred by the logged-in user
    const referred = allClients.filter(client => {
      const referredByField = client.customFields.find(f => f.label && f.label.toLowerCase() === 'referred by');
      return referredByField && referredByField.valueText === referrer;
    });

    // Map each client to pipeline status
    const pipeline = referred.map(client => {
      const jobs = client.jobs.nodes;
      const quotes = client.quotes.nodes;

      // Check for paid invoice
      const paidInvoice = jobs.flatMap(j => j.invoices.nodes).find(inv => inv.status === 'paid');

      // Check for any job
      const hasJob = jobs.length > 0;

      // Check for active (non-archived) quotes
      const activeQuotes = quotes.filter(q => q.status !== 'archived');
      const hasActiveQuote = activeQuotes.length > 0;

      // Determine status
      let status;
      let payout = null;

      if (hasJob) {
        status = 'sold';
        if (paidInvoice) {
          payout = paidInvoice.total;
        }
      } else if (hasActiveQuote) {
        status = 'inspection';
      } else if (quotes.length > 0 && activeQuotes.length === 0) {
        // All quotes archived, no job = not sold
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