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

app.get('/api/clients', async (req, res) => {
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
              label
              value
            }
          }
        }
      }`},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2024-11-14'
        }
      }
    );
    res.json(response.data);
  } catch (err) {
   res.status(500).send('API call failed: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
