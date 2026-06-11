'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const cashoutsRouter = require('../routes/admin/cashouts');
const referrerRouter = require('../routes/referrer');

const {
  seedContractor,
  seedUser,
  seedSession,
  startTestServer,
  stopTestServer,
} = require('./helpers');

// trust proxy enabled so each test can pass a unique x-forwarded-for IP and stay
// under the cashoutLimiter's 3-per-hour-per-IP cap without touching production config.
function buildCashoutTestApp() {
  const express = require('express');
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '5mb' }));
  app.use('/', referrerRouter);
  app.use('/', cashoutsRouter);
  return app;
}

function httpReq(port, method, path, body, extraHeaders = {}) {
  const bodyBuf = body != null ? Buffer.from(JSON.stringify(body)) : null;
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      {
        hostname: 'localhost', port, path, method,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {}),
          ...extraHeaders,
        },
      },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
          catch { resolve({ status: res.statusCode, body: text }); }
        });
      }
    );
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

const ADMIN_TOKEN    = 'cashout-test-admin-token';
const REFERRER_TOKEN = 'cashout-test-referrer-token';

describe('cashout — balance, request, and approval integrity', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(buildCashoutTestApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    cashoutsRouter._resetTestOverrides();
    referrerRouter._resetTestOverrides();
    await pool.query('DELETE FROM payout_announcements');
    await pool.query('DELETE FROM cashout_requests');
    await pool.query('DELETE FROM referral_conversions');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM contractor_settings');
  });

  async function setupReferrer({ email = 'ref@test.com', fullName = 'Test Referrer' } = {}) {
    await seedContractor(pool, 'accent-roofing');
    const userId = await seedUser(pool, { fullName, email, contractorId: 'accent-roofing' });
    await seedSession(pool, { userId, token: REFERRER_TOKEN, role: 'referrer' });
    return { userId };
  }

  async function setupAdmin() {
    await seedSession(pool, { userId: null, token: ADMIN_TOKEN, role: 'admin' });
  }

  async function seedConversion(userId, bonusAmount) {
    await pool.query(
      `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, bonus_amount)
       VALUES ($1, 'accent-roofing', $2, $3)`,
      [userId, `jc-${Math.random().toString(36).slice(2)}`, bonusAmount]
    );
  }

  async function seedCashoutRequest(userId, amount, status = 'pending') {
    const { rows } = await pool.query(
      `INSERT INTO cashout_requests (user_id, full_name, email, amount, payout_method, status, requested_at)
       VALUES ($1, 'Test Referrer', 'ref@test.com', $2, 'venmo', $3, NOW())
       RETURNING id`,
      [userId, amount, status]
    );
    return rows[0].id;
  }

  // ── TEST 1 ────────────────────────────────────────────────────────────────────
  it('$20 minimum enforced: request below minimum rejected, no DB row created', async () => {
    const { userId } = await setupReferrer();
    await seedConversion(userId, 100);

    const resp = await httpReq(port, 'POST', '/api/cashout',
      { amount: 15, payout_method: 'venmo' },
      { authorization: `Bearer ${REFERRER_TOKEN}`, 'x-forwarded-for': '1.0.0.1' }
    );

    assert.equal(resp.status, 400);
    assert.equal(resp.body.error, 'Minimum cashout amount is $20');

    const { rows } = await pool.query('SELECT id FROM cashout_requests');
    assert.equal(rows.length, 0, 'no cashout_requests row created');
  });

  // ── TEST 2 ────────────────────────────────────────────────────────────────────
  it('balance formula: earned minus pending determines available; exceeding available rejected', async () => {
    const { userId } = await setupReferrer();
    await seedConversion(userId, 50);

    const resp = await httpReq(port, 'POST', '/api/cashout',
      { amount: 100, payout_method: 'venmo' },
      { authorization: `Bearer ${REFERRER_TOKEN}`, 'x-forwarded-for': '1.0.0.2' }
    );

    assert.equal(resp.status, 400);
    assert.equal(resp.body.error, 'Requested amount exceeds your available balance');

    const { rows } = await pool.query('SELECT id FROM cashout_requests');
    assert.equal(rows.length, 0, 'no cashout_requests row created on balance reject');
  });

  // ── TEST 3 ────────────────────────────────────────────────────────────────────
  it('exactly $20 with matching balance accepted: row created with status=pending', async () => {
    const { userId } = await setupReferrer();
    await seedConversion(userId, 20);

    referrerRouter._setTestOverrides({
      sendEmail: async () => ({ id: 'stub' }),
      sendAdminNotification: async () => {},
    });

    const resp = await httpReq(port, 'POST', '/api/cashout',
      { amount: 20, payout_method: 'venmo' },
      { authorization: `Bearer ${REFERRER_TOKEN}`, 'x-forwarded-for': '1.0.0.3' }
    );

    assert.equal(resp.status, 200);
    assert.equal(resp.body.success, true);

    const { rows } = await pool.query(
      'SELECT amount, status FROM cashout_requests WHERE user_id = $1', [userId]
    );
    assert.equal(rows.length, 1, 'one cashout_requests row created');
    assert.equal(parseFloat(rows[0].amount), 20);
    assert.equal(rows[0].status, 'pending');
  });

  // ── TEST 4 ────────────────────────────────────────────────────────────────────
  it('denied cashouts excluded from pending sum: full earned balance remains available', async () => {
    // $100 earned, $80 denied. If denied were counted: available=$20, $100 request would fail.
    // If denied correctly excluded: available=$100, request succeeds.
    const { userId } = await setupReferrer();
    await seedConversion(userId, 100);
    await seedCashoutRequest(userId, 80, 'denied');

    referrerRouter._setTestOverrides({
      sendEmail: async () => ({ id: 'stub' }),
      sendAdminNotification: async () => {},
    });

    const resp = await httpReq(port, 'POST', '/api/cashout',
      { amount: 100, payout_method: 'venmo' },
      { authorization: `Bearer ${REFERRER_TOKEN}`, 'x-forwarded-for': '1.0.0.4' }
    );

    assert.equal(resp.status, 200, 'denied cashout does not reduce available balance');
    assert.equal(resp.body.success, true);
  });

  // ── TEST 5 ────────────────────────────────────────────────────────────────────
  it('admin approve: status=approved, activity_log row, payout_announcements row, email via seam', async () => {
    const { userId } = await setupReferrer({ email: 'ref@test.com' });
    await setupAdmin();
    const cashoutId = await seedCashoutRequest(userId, 50, 'pending');

    const emails = [];
    cashoutsRouter._setTestOverrides({ sendEmail: async args => { emails.push(args); return { id: 'stub' }; } });

    const resp = await httpReq(port, 'PATCH', `/api/admin/cashouts/${cashoutId}`,
      { status: 'approved' },
      { authorization: `Bearer ${ADMIN_TOKEN}` }
    );

    assert.equal(resp.status, 200);
    assert.equal(resp.body.status, 'approved');

    const { rows: crRows } = await pool.query(
      'SELECT status FROM cashout_requests WHERE id = $1', [cashoutId]
    );
    assert.equal(crRows[0].status, 'approved');

    const { rows: alRows } = await pool.query(
      "SELECT detail FROM activity_log WHERE event_type = 'admin'"
    );
    assert.equal(alRows.length, 1, 'one activity_log row');
    assert.ok(alRows[0].detail.includes('approved'), `activity_log detail: "${alRows[0].detail}"`);
    assert.ok(alRows[0].detail.includes('50'), 'activity_log detail includes amount');

    const { rows: paRows } = await pool.query(
      'SELECT cashout_request_id, user_id FROM payout_announcements'
    );
    assert.equal(paRows.length, 1, 'one payout_announcements row');
    assert.equal(Number(paRows[0].cashout_request_id), Number(cashoutId));
    assert.equal(paRows[0].user_id, userId);

    // email sent synchronously before res.json — already present by the time we receive response
    assert.equal(emails.length, 1, 'one email sent via seam');
    assert.equal(emails[0].to, 'ref@test.com');
    assert.ok(emails[0].subject.toLowerCase().includes('approved'), `subject: "${emails[0].subject}"`);
    assert.ok(emails[0].subject.includes('50'), `subject includes amount: "${emails[0].subject}"`);
  });

  // ── TEST 6 ────────────────────────────────────────────────────────────────────
  it('admin deny: status=denied, activity_log row, no payout_announcements, denial email sent', async () => {
    const { userId } = await setupReferrer({ email: 'ref@test.com' });
    await setupAdmin();
    const cashoutId = await seedCashoutRequest(userId, 75, 'pending');

    const emails = [];
    cashoutsRouter._setTestOverrides({ sendEmail: async args => { emails.push(args); return { id: 'stub' }; } });

    const resp = await httpReq(port, 'PATCH', `/api/admin/cashouts/${cashoutId}`,
      { status: 'denied' },
      { authorization: `Bearer ${ADMIN_TOKEN}` }
    );

    assert.equal(resp.status, 200);
    assert.equal(resp.body.status, 'denied');

    const { rows: crRows } = await pool.query(
      'SELECT status FROM cashout_requests WHERE id = $1', [cashoutId]
    );
    assert.equal(crRows[0].status, 'denied');

    const { rows: alRows } = await pool.query(
      "SELECT detail FROM activity_log WHERE event_type = 'admin'"
    );
    assert.equal(alRows.length, 1, 'one activity_log row on deny');
    assert.ok(alRows[0].detail.includes('denied'), `activity_log detail: "${alRows[0].detail}"`);

    const { rows: paRows } = await pool.query('SELECT id FROM payout_announcements');
    assert.equal(paRows.length, 0, 'no payout_announcements on deny');

    assert.equal(emails.length, 1, 'one denial email sent');
    assert.equal(emails[0].to, 'ref@test.com');
  });

  // ── TEST 7 ────────────────────────────────────────────────────────────────────
  it('double-approval blocked: second approve returns 409, no duplicate payout_announcements row', async () => {
    const { userId } = await setupReferrer({ email: 'ref@test.com' });
    await setupAdmin();
    const cashoutId = await seedCashoutRequest(userId, 50, 'pending');

    const emails = [];
    cashoutsRouter._setTestOverrides({ sendEmail: async args => { emails.push(args); return { id: 'stub' }; } });

    const resp1 = await httpReq(port, 'PATCH', `/api/admin/cashouts/${cashoutId}`,
      { status: 'approved' },
      { authorization: `Bearer ${ADMIN_TOKEN}` }
    );
    assert.equal(resp1.status, 200, 'first approval: 200');

    const resp2 = await httpReq(port, 'PATCH', `/api/admin/cashouts/${cashoutId}`,
      { status: 'approved' },
      { authorization: `Bearer ${ADMIN_TOKEN}` }
    );
    assert.equal(resp2.status, 409, 'second approval blocked with 409');

    const { rows: paRows } = await pool.query(
      'SELECT id FROM payout_announcements WHERE cashout_request_id = $1', [cashoutId]
    );
    assert.equal(paRows.length, 1, 'exactly one payout_announcements row after double-approval attempt');
  });

  // ── TEST 8 ────────────────────────────────────────────────────────────────────
  it('balance formula SQL: pending+approved reduce available; denied excluded', async () => {
    // Runs the exact queries from referrer.js lines 846-847 and pins their results.
    const { userId } = await setupReferrer();
    await seedConversion(userId, 300);
    await seedCashoutRequest(userId, 100, 'pending');
    await seedCashoutRequest(userId, 50,  'approved');
    await seedCashoutRequest(userId, 200, 'denied');

    const [earnedRes, pendingRes] = await Promise.all([
      pool.query(
        'SELECT COALESCE(SUM(bonus_amount), 0) AS earned FROM referral_conversions WHERE user_id = $1',
        [userId]
      ),
      pool.query(
        "SELECT COALESCE(SUM(amount), 0) AS pending FROM cashout_requests WHERE user_id = $1 AND status IN ('pending', 'approved')",
        [userId]
      ),
    ]);

    const earned    = parseFloat(earnedRes.rows[0].earned);
    const pending   = parseFloat(pendingRes.rows[0].pending);
    const available = earned - pending;

    assert.equal(earned,    300, 'earned = sum of referral_conversions.bonus_amount');
    assert.equal(pending,   150, 'pending = pending($100) + approved($50); denied($200) excluded');
    assert.equal(available, 150, 'available = 300 - 150');
  });
});
