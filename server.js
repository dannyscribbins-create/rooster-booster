const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { pool, initDB } = require('./server/db');
const { setAccessToken } = require('./server/crm/jobber');
const oauthRoutes = require('./server/routes/oauth');
const referrerRoutes = require('./server/routes/referrer');
const adminRoutes = require('./server/routes/admin');
const stripeRoutes = require('./server/routes/stripe');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

initDB().then(token => { if (token) setAccessToken(token); });

app.use('/', oauthRoutes);
app.use('/', referrerRoutes);
app.use('/', adminRoutes);
app.use('/', stripeRoutes);

// ─────────────────────────────────────────────────────────────────────────────
app.listen(4000, () => console.log('Server running on port 4000'));
