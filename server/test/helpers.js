'use strict';

// Inserts the minimal contractor_settings row required by FK lookups and
// engagement_cadence_settings seeding. ON CONFLICT DO NOTHING is safe on repeat calls.
async function seedContractor(pool, contractorId) {
  await pool.query(
    `INSERT INTO contractors (id, name)
     VALUES ($1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [contractorId]
  );
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, company_name)
     VALUES ($1, $1)
     ON CONFLICT (contractor_id) DO NOTHING`,
    [contractorId]
  );
}

// Inserts a jobber_clients row. name goes into first_name for simplicity.
async function seedJobberClient(pool, { contractorId, jobberClientId, name = null, email = null, phone = null }) {
  await pool.query(
    `INSERT INTO jobber_clients
       (jobber_client_id, contractor_id, first_name, last_name, email, phone, last_synced_at)
     VALUES ($1, $2, $3, NULL, $4, $5, NOW())
     ON CONFLICT (jobber_client_id, contractor_id) DO NOTHING`,
    [jobberClientId, contractorId, name, email, phone]
  );
}

// Inserts a contacts row. Caller must supply a fixed UUID string for id.
async function seedContact(pool, { contractorId, id, name = null, email, phone = null, jobberClientId = null }) {
  await pool.query(
    `INSERT INTO contacts (id, contractor_id, email, name, phone, jobber_client_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (contractor_id, email) DO NOTHING`,
    [id, contractorId, email, name, phone, jobberClientId]
  );
}

// Inserts a contact_tags row. Exactly one of contactId or jobberClientId must be set.
async function seedTag(pool, { contractorId, contactId = null, jobberClientId = null, tag }) {
  if (!contactId && !jobberClientId) {
    throw new Error('seedTag: must provide either contactId or jobberClientId');
  }
  await pool.query(
    `INSERT INTO contact_tags (contact_id, jobber_client_id, contractor_id, tag, source)
     VALUES ($1, $2, $3, $4, 'system')
     ON CONFLICT DO NOTHING`,
    [contactId, jobberClientId, contractorId, tag]
  );
}

// Inserts a dynamic_audiences row with is_active = TRUE and returns the new id.
async function seedAudience(pool, { contractorId, name, tags, mode }) {
  const { rows } = await pool.query(
    `INSERT INTO dynamic_audiences (contractor_id, name, filter_json, is_active)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id`,
    [contractorId, name, JSON.stringify({ tags, mode })]
  );
  return rows[0].id;
}

// ── INVOICE-PAID WEBHOOK TEST HELPERS ─────────────────────────────────────────

// Inserts a minimal tokens row for webhook handler token lookup.
async function seedToken(pool, { contractorId, accessToken = 'test-access-token' }) {
  await pool.query(
    `INSERT INTO tokens (id, contractor_id, access_token, refresh_token, expires_at)
     VALUES (1, $1, $2, 'test-refresh-token', NOW() + INTERVAL '1 hour')
     ON CONFLICT (contractor_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token`,
    [contractorId, accessToken]
  );
}

// Inserts or updates engagement_settings for the experience flow feature flag.
async function seedEngagementSettings(pool, { contractorId, experienceFlowEnabled = false }) {
  await pool.query(
    `INSERT INTO engagement_settings (contractor_id, experience_flow_enabled)
     VALUES ($1, $2)
     ON CONFLICT (contractor_id) DO UPDATE SET experience_flow_enabled = EXCLUDED.experience_flow_enabled`,
    [contractorId, experienceFlowEnabled]
  );
}

// Inserts a flat-amount referral schedule with one job type mapping.
// Returns the schedule id.
async function seedReferralSchedule(pool, { contractorId, jobberLabel = 'Roof Replacement', flatAmount = 250 }) {
  const { rows } = await pool.query(
    `INSERT INTO referral_schedules
       (contractor_id, name, is_active, payout_model, flat_amount, reset_period, invoice_window_days)
     VALUES ($1, 'Test Schedule', TRUE, 'flat', $2, 'none', 20)
     ON CONFLICT (contractor_id, name) DO UPDATE SET flat_amount = EXCLUDED.flat_amount
     RETURNING id`,
    [contractorId, flatAmount]
  );
  const scheduleId = rows[0].id;
  await pool.query(
    `INSERT INTO referral_schedule_job_types (schedule_id, contractor_id, jobber_label)
     VALUES ($1, $2, $3)
     ON CONFLICT (contractor_id, jobber_label) DO NOTHING`,
    [scheduleId, contractorId, jobberLabel]
  );
  return scheduleId;
}

// Inserts a users row with a dummy bcrypt hash (no auth needed in webhook tests).
// Returns the new user id.
async function seedUser(pool, { fullName, email, contractorId }) {
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, email_verified)
     VALUES ($1, $2, '$2b$10$test.placeholder.hash.for.tests', TRUE)
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id`,
    [fullName, email]
  );
  return rows[0].id;
}

// Inserts a sessions row with the given role and token.
// userId may be null for admin sessions (no user account required).
// contractorId is required for admin sessions; nullable for referrer sessions.
async function seedSession(pool, { userId = null, token, role = 'referrer', expiresInMs = 3_600_000, contractorId = null }) {
  const expiresAt = new Date(Date.now() + expiresInMs);
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [userId, token, expiresAt, role, contractorId]
  );
}

// ── HTTP TEST TRANSPORT HELPERS ───────────────────────────────────────────────

const crypto = require('crypto');
const { request: _httpRequest } = require('node:http');

// Computes the JOBBER HMAC-SHA256 signature over a JSON payload and returns
// { body: Buffer, signature: string } — both needed for signedHttpPost.
function signJobberWebhook(payloadObject) {
  const body = Buffer.from(JSON.stringify(payloadObject));
  const signature = crypto
    .createHmac('sha256', process.env.JOBBER_CLIENT_SECRET)
    .update(body)
    .digest('base64');
  return { body, signature };
}

// Makes a POST request to localhost:port and returns { status, body }.
// `body` must be a Buffer (use signJobberWebhook to prepare it).
function httpPost(port, path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
        ...extraHeaders,
      },
    };
    const req = _httpRequest(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null });
        } catch {
          resolve({ status: res.statusCode, body: text });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Builds a minimal express app that mirrors server.js webhook middleware order.
// Uses the real webhook router — the same module instance the tests control via _setTestOverrides.
function buildTestApp() {
  const express = require('express');
  // PARITY with server.js lines 36-38: raw body parser on /webhooks BEFORE express.json.
  // express.raw() is load-bearing — HMAC verification requires req.body as a raw Buffer.
  const jobberRouter = require('../routes/webhooks/jobber');
  const app = express();
  app.use('/webhooks', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '5mb' }));
  app.use('/webhooks', jobberRouter);
  return app;
}

// Starts the express app on an ephemeral port. Returns { server, port }.
function startTestServer(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, 'localhost', () => {
      resolve({ server, port: server.address().port });
    });
    server.on('error', reject);
  });
}

// Gracefully stops a test server.
function stopTestServer(server) {
  return new Promise((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  });
}

// Polls predicateFn every `interval` ms until it returns truthy or `timeout` ms elapse.
// Rejects with a descriptive error if the timeout is exceeded.
async function waitFor(predicateFn, { timeout = 3000, interval = 30 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicateFn()) return;
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`waitFor: predicate did not become true within ${timeout}ms`);
}

module.exports = {
  seedContractor,
  seedJobberClient,
  seedContact,
  seedTag,
  seedAudience,
  seedToken,
  seedEngagementSettings,
  seedReferralSchedule,
  seedUser,
  seedSession,
  signJobberWebhook,
  httpPost,
  buildTestApp,
  startTestServer,
  stopTestServer,
  waitFor,
};
