const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const referrerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const forgotPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many reset requests. Please try again in 15 minutes.' }
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const CLIENT_ID = process.env.JOBBER_CLIENT_ID;
const CLIENT_SECRET = process.env.JOBBER_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let accessToken = null;

// ── DATABASE INIT ─────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY, access_token TEXT, refresh_token TEXT,
    expires_at TIMESTAMP, updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, pin TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cashout_requests (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id),
    full_name TEXT, email TEXT, amount NUMERIC, method TEXT,
    status TEXT DEFAULT 'pending', requested_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY, event_type TEXT NOT NULL,
    full_name TEXT, email TEXT, detail TEXT, created_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_cache (
    id INTEGER PRIMARY KEY DEFAULT 1, stats JSONB, cached_at TIMESTAMP DEFAULT NOW()
  )`);
await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
  )`);
  await pool.query(`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);
  await pool.query(`ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS method TEXT`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'referrer'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`);
  await pool.query(`CREATE TABLE IF NOT EXISTS pin_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP
  )`);

  const result = await pool.query('SELECT access_token FROM tokens WHERE id = 1');
  if (result.rows.length > 0) {
    accessToken = result.rows[0].access_token;
    console.log('Token loaded from database');
  } else {
    console.log('No token found - visit /auth/jobber to authorize');
  }
}
initDB();

// ── TOKEN AUTO-REFRESH ────────────────────────────────────────────────────────
async function refreshTokenIfNeeded() {
  const result = await pool.query('SELECT * FROM tokens WHERE id = 1');
  if (result.rows.length === 0) throw new Error('No token - visit /auth/jobber');
  const { refresh_token, expires_at } = result.rows[0];
  const fiveMin = new Date(Date.now() + 5 * 60 * 1000);
  if (!expires_at || new Date(expires_at) < fiveMin) {
    console.log('Refreshing token...');
    const response = await axios.post('https://api.getjobber.com/api/oauth/token', {
      grant_type: 'refresh_token', client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET, refresh_token
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

// ── JOBBER OAUTH ──────────────────────────────────────────────────────────────
app.get('/auth/jobber', (req, res) => {
  res.redirect(`https://api.getjobber.com/api/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`);
});
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.post('https://api.getjobber.com/api/oauth/token', {
      grant_type: 'authorization_code', client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, code
    });
    accessToken = response.data.access_token;
    const expiresAt = new Date(Date.now() + (parseInt(response.data.expires_in) || 3600) * 1000);
    await pool.query(
      `INSERT INTO tokens (id,access_token,refresh_token,expires_at,updated_at) VALUES (1,$1,$2,$3,NOW())
       ON CONFLICT (id) DO UPDATE SET access_token=$1, refresh_token=$2, expires_at=$3, updated_at=NOW()`,
      [accessToken, response.data.refresh_token, expiresAt]
    );
    res.send('Authorization successful! You can close this tab.');
  } catch (err) { res.status(500).send('Authorization failed: ' + err.message); }
});

// ── REFERRER: PIPELINE ────────────────────────────────────────────────────────
app.get('/api/pipeline', async (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authorized' });
    const sessionResult = await pool.query(
      'SELECT * FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const data = await fetchPipelineForReferrer(req.query.referrer);
    res.json(data);
  } catch (err) {
    res.status(500).send('API call failed: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
  }
});

// ── REFERRER: LOGIN ───────────────────────────────────────────────────────────
app.post('/api/login', referrerLoginLimiter, async (req, res) => {
  const { email, pin } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or PIN' });
    const user = result.rows[0];
    const match = await bcrypt.compare(String(pin), user.pin);
    if (!match) return res.status(401).json({ error: 'Invalid email or PIN' });
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1,$2,$3)',
      [user.id, token, expiresAt]
    );
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('login',$1,$2,$3)`,
      [user.full_name, user.email, 'Logged in']
    );
    res.json({ success: true, fullName: user.full_name, email: user.email, token });
  } catch (err) { res.status(500).json({ error: 'Login failed: ' + err.message }); }
});

// ── REFERRER: CASH OUT ────────────────────────────────────────────────────────
app.post('/api/cashout', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  const sessionResult = await pool.query(
    'SELECT * FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
    [token, 'referrer']
  );
  if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
  const { user_id, full_name, email, amount, method } = req.body;
  try {
    await pool.query(
      `INSERT INTO cashout_requests (user_id,full_name,email,amount,method,status,requested_at)
       VALUES ($1,$2,$3,$4,$5,'pending',NOW())`,
      [user_id, full_name, email, amount, method || null]
    );
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('cashout',$1,$2,$3)`,
      [full_name, email, `Requested $${amount} via ${method || 'unknown'}`]
    );
    await resend.emails.send({
      from: 'onboarding@resend.dev', to: 'dannyscribbins@gmail.com',
      subject: 'New Cash Out Request - Rooster Booster',
      html: `<h2>New Cash Out Request</h2><p><strong>Name:</strong> ${full_name}</p>
             <p><strong>Email:</strong> ${email}</p><p><strong>Amount:</strong> $${amount}</p>
             <p><strong>Method:</strong> ${method || 'Not specified'}</p>
             <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>`
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to save cash out request' }); }
});

// ── REFERRER: GET PROFILE PHOTO ───────────────────────────────────────────────
app.get('/api/profile/photo', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;
    const result = await pool.query('SELECT profile_photo FROM users WHERE id=$1', [userId]);
    res.json({ photo: result.rows[0]?.profile_photo || null });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch photo' }); }
});

// ── REFERRER: SAVE PROFILE PHOTO ──────────────────────────────────────────────
app.post('/api/profile/photo', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const { photo } = req.body;
    if (!photo) return res.status(400).json({ error: 'No photo provided' });
    if (typeof photo !== 'string' || !photo.startsWith('data:image/') || photo.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'Invalid photo' });
    }
    const userId = sessionResult.rows[0].user_id;
    await pool.query('UPDATE users SET profile_photo=$1 WHERE id=$2', [photo, userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to save photo' }); }
});

// ── REFERRER: FORGOT PIN ───────────────────────────────────────────────────────
app.post('/api/forgot-pin', forgotPinLimiter, async (req, res) => {
  const { email } = req.body;
  const genericResponse = { message: "If that email is registered, you'll receive a reset link shortly." };

  try {
    const userResult = await pool.query(
      'SELECT id, full_name, email FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const token = crypto.randomBytes(32).toString('hex');

      await pool.query(
        `INSERT INTO pin_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + interval '1 hour')`,
        [user.id, token]
      );

      const frontendUrl = process.env.FRONTEND_URL || '';
      if (!frontendUrl) console.warn('WARNING: FRONTEND_URL is not set — reset links will be broken');
      const resetUrl = `${frontendUrl}/?reset=${token}`;

      try {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: user.email,
          subject: 'Reset your Rooster Booster PIN',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <p style="font-size: 20px; font-weight: 700; color: #012854; margin: 0 0 8px;">Accent Roofing Service</p>
              <h1 style="font-size: 24px; color: #012854; margin: 0 0 16px;">Reset your PIN</h1>
              <p style="font-size: 15px; color: #444; margin: 0 0 24px;">
                Someone requested a PIN reset for your Rooster Booster referral account.
                Click the button below to set a new PIN. This link expires in 1 hour.
              </p>
              <a href="${resetUrl}" style="
                display: inline-block;
                background: #CC0000;
                color: #fff;
                text-decoration: none;
                padding: 14px 28px;
                border-radius: 8px;
                font-weight: 700;
                font-size: 15px;
                margin-bottom: 24px;
              ">Set New PIN</a>
              <p style="font-size: 13px; color: #888; margin: 0;">
                If you didn't request this, you can safely ignore this email. Your PIN has not been changed.
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Resend error (forgot-pin):', emailErr);
        // swallow — do not reveal whether email exists
      }

      try {
        await pool.query(
          `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ($1, $2, $3, $4)`,
          ['pin_reset_request', user.full_name, user.email, 'Reset link sent']
        );
      } catch (logErr) {
        console.error('Activity log error (forgot-pin):', logErr);
      }
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('forgot-pin error:', err);
    res.json(genericResponse); // always return generic even on DB error
  }
});

// ── ADMIN: AUTH ───────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rooster123';

async function verifyAdminSession(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authorized' }); return false; }
  try {
    const result = await pool.query(
      'SELECT id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'admin']
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return false;
    }
    return true;
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
    return false;
  }
}

app.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Incorrect password' });
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at, role) VALUES (NULL,$1,$2,$3)',
      [token, expiresAt, 'admin']
    );
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// ── ADMIN: REFERRERS ──────────────────────────────────────────────────────────
app.get('/api/admin/users', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT id,full_name,email,created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/admin/users', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { full_name, email, pin } = req.body;
  try {
    const hashedPin = await bcrypt.hash(String(pin), 10);
    const result = await pool.query(
      'INSERT INTO users (full_name,email,pin) VALUES ($1,$2,$3) RETURNING id,full_name,email,created_at',
      [full_name, email, hashedPin]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(err.code === '23505' ? 400 : 500).json({ error: err.code === '23505' ? 'Email already exists' : err.message });
  }
});
app.patch('/api/admin/users/:id/pin', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { pin } = req.body;
  if (!pin || pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });
  try {
    await pool.query('UPDATE users SET pin=$1 WHERE id=$2', [await bcrypt.hash(String(pin), 10), req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/admin/users/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: REFERRER DETAIL ────────────────────────────────────────────────────
app.get('/api/admin/referrer/:name', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const data = await fetchPipelineForReferrer(decodeURIComponent(req.params.name));
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch referrer data: ' + err.message }); }
});

// ── ADMIN: CASH OUTS ──────────────────────────────────────────────────────────
app.get('/api/admin/cashouts', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT * FROM cashout_requests ORDER BY requested_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch('/api/admin/cashouts/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { status } = req.body;
  if (!['approved','denied'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const result = await pool.query('UPDATE cashout_requests SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('admin',$1,$2,$3)`,
      [result.rows[0].full_name, result.rows[0].email,
       `Cash out request #${req.params.id} ${status} ($${result.rows[0].amount})`]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: ACTIVITY LOG ───────────────────────────────────────────────────────
app.get('/api/admin/activity', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: DASHBOARD STATS (cached 15 min) ────────────────────────────────────
app.get('/api/admin/stats', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { refresh } = req.query;
  try {
    if (refresh !== 'true') {
      const cached = await pool.query('SELECT * FROM admin_cache WHERE id=1');
      if (cached.rows.length > 0) {
        const ageMin = (Date.now() - new Date(cached.rows[0].cached_at).getTime()) / 60000;
        if (ageMin < 15) return res.json({ ...cached.rows[0].stats, cachedAt: cached.rows[0].cached_at, fromCache: true });
      }
    }
    const usersResult = await pool.query('SELECT full_name FROM users');
    const allUsers = usersResult.rows;
    let totalReferrals=0, totalSold=0, totalNotSold=0, totalLeads=0, totalInspections=0, totalBalance=0, activeReferrers=0;
    for (const user of allUsers) {
      try {
        const data = await fetchPipelineForReferrer(user.full_name);
        const p = data.pipeline;
        if (p.length > 0) activeReferrers++;
        totalReferrals   += p.length;
        totalSold        += p.filter(x => x.status==='sold').length;
        totalNotSold     += p.filter(x => x.status==='closed').length;
        totalLeads       += p.filter(x => x.status==='lead').length;
        totalInspections += p.filter(x => x.status==='inspection').length;
        totalBalance     += data.balance;
      } catch(e) { console.error(`Stats: failed for ${user.full_name}:`, e.message); }
    }
    const paidRes    = await pool.query(`SELECT COALESCE(SUM(amount),0) as total FROM cashout_requests WHERE status='approved'`);
    const pendingRes = await pool.query(`SELECT COUNT(*) as count FROM cashout_requests WHERE status='pending'`);
    const stats = {
      totalReferrers: allUsers.length, activeReferrers,
      totalReferrals, totalSold, totalNotSold, totalLeads, totalInspections,
      totalBalance, totalPaidOut: parseFloat(paidRes.rows[0].total),
      pendingCashouts: parseInt(pendingRes.rows[0].count),
    };
    await pool.query(
      `INSERT INTO admin_cache (id,stats,cached_at) VALUES (1,$1,NOW())
       ON CONFLICT (id) DO UPDATE SET stats=$1, cached_at=NOW()`,
      [JSON.stringify(stats)]
    );
    res.json({ ...stats, cachedAt: new Date(), fromCache: false });
  } catch (err) { res.status(500).json({ error: 'Stats failed: ' + err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
app.listen(4000, () => console.log('Server running on port 4000'));