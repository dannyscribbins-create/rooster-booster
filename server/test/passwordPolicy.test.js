'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 2, STEP 2B — UNIFIED 8-CHARACTER PASSWORD POLICY (CD-5 / D12)
//
// Governing spec: CDL_3b_BUILD_SPEC.md §1 D12.
//
// THREE DOORS, THREE DIFFERENT RULES before this phase:
//
//   POST /api/signup                    password.length < 6      → 400
//   POST /api/reset-pin                 /^\d{4}$/                → 400
//   POST /api/admin/team/accept-invite  isLength({ min: 8 })     → 400
//
// A unified login implies one policy: minimum 8, everywhere. Raising signup from
// 6 breaks nobody — bcrypt does not care what was hashed, so existing 6-character
// credentials keep authenticating. It binds only new signups and resets.
//
// RESET IS THE BLOCKED PATH and the reason this file exists. `^\d{4}$` does not
// merely fail to require 8 characters — it actively REFUSES anything that is not
// exactly four digits, so a person who signs up with a real password today
// physically cannot reset to one. accept-invite is already at 8 and is included
// as the counterweight: the round-trip below proves all three doors now agree,
// rather than proving two were dragged to meet a third.
//
// `users.pin` KEEPS ITS COLUMN NAME (D12 — rename rejected, ~10 identifier sites,
// cosmetic). The column is TEXT NOT NULL with no length constraint and no CHECK,
// so a 14-character alphanumeric already stores and re-authenticates correctly.
// This is a validator change, not a migration. A future reader must not mistake
// `users.pin` for a numeric column — hence this note.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');

const TENANT_A = 'tnt-pwpolicy-a';

// The spec's own example: 14 characters, alphanumeric, nothing a 4-digit gate
// would ever admit.
const LONG_PASSWORD = 'Roofm1lesRocks';
const SEVEN_CHARS = 'abc1234';
const EIGHT_CHARS = 'abc12345';

let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.97.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpPost(port, path, bodyObj) {
  const payload = Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'X-Forwarded-For': nextIp(),
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

let pool, server, port;

// Mints a usable pin_reset_tokens row for a fresh referrer and returns the token.
async function seedResetToken(email) {
  const hash = await bcrypt.hash('initial-password', 10);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
     VALUES ('Policy Tester', $1, $2, $3, true) RETURNING id`,
    [email, hash, TENANT_A]
  );
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO pin_reset_tokens (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + interval '1 hour')`,
    [rows[0].id, token]
  );
  return { token, userId: rows[0].id };
}

// Mints an active invite link so /api/signup has something to accept.
async function seedInviteSlug() {
  const slug = `policy-${crypto.randomBytes(6).toString('hex')}`;
  await pool.query(
    `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
     VALUES ($1, $2, 'contractor', true)`,
    [TENANT_A, slug]
  );
  return slug;
}

describe('C/DL-3b Phase 2B — unified 8-character password policy (CD-5 / D12)', () => {
  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM pin_reset_tokens');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM contractors WHERE id LIKE $1', ['tnt-pwpolicy-%']);
    await seedContractor(pool, TENANT_A);
  });

  // ══ RESET — THE BLOCKED PATH ═══════════════════════════════════════════════

  describe('POST /api/reset-pin', () => {
    it('[RED] accepts a 14-character alphanumeric password', async () => {
      // Under `^\d{4}$` this is a 400. It is the single most important assertion
      // in the file: today a referrer literally cannot reset to a real password.
      const { token } = await seedResetToken('reset-long@policy.test');
      const res = await httpPost(port, '/api/reset-pin', { token, pin: LONG_PASSWORD });
      assert.equal(res.status, 200, `a real password must be accepted on reset, got ${res.status}: ${res.raw}`);
    });

    it('[RED] rejects seven characters', async () => {
      const { token } = await seedResetToken('reset-short@policy.test');
      const res = await httpPost(port, '/api/reset-pin', { token, pin: SEVEN_CHARS });
      assert.equal(res.status, 400, `seven characters must be refused, got ${res.status}: ${res.raw}`);
    });

    it('[RED] accepts exactly eight characters — the boundary', async () => {
      const { token } = await seedResetToken('reset-eight@policy.test');
      const res = await httpPost(port, '/api/reset-pin', { token, pin: EIGHT_CHARS });
      assert.equal(res.status, 200, `eight characters is the minimum, got ${res.status}: ${res.raw}`);
    });

    it('[RED] a four-digit PIN is no longer sufficient', async () => {
      // The old rule inverted. Recorded explicitly so the change is deliberate and
      // visible rather than an incidental consequence of loosening the regex.
      const { token } = await seedResetToken('reset-4digit@policy.test');
      const res = await httpPost(port, '/api/reset-pin', { token, pin: '1234' });
      assert.equal(res.status, 400, `a 4-digit PIN must now be refused, got ${res.status}: ${res.raw}`);
    });

    it('[RED] the rejection message names the real rule', async () => {
      const { token } = await seedResetToken('reset-msg@policy.test');
      const res = await httpPost(port, '/api/reset-pin', { token, pin: '1234' });
      assert.equal(res.status, 400);
      assert.doesNotMatch(
        res.body.error, /4 digits|four digits/i,
        `the error must not still describe the retired rule, got: ${res.body.error}`
      );
      assert.match(res.body.error, /8|eight/i, `the error must state the 8-character minimum, got: ${res.body.error}`);
    });
  });

  // ══ SIGNUP ═════════════════════════════════════════════════════════════════

  describe('POST /api/signup', () => {
    it('[RED] rejects seven characters — raised from six', async () => {
      const slug = await seedInviteSlug();
      const res = await httpPost(port, '/api/signup', {
        firstName: 'Poli', lastName: 'Cy', phone: '555-123-4567',
        email: 'signup-short@policy.test', password: SEVEN_CHARS, inviteSlug: slug,
      });
      assert.equal(res.status, 400, `seven characters must be refused at signup, got ${res.status}: ${res.raw}`);
    });

    it('[RED] accepts a 14-character alphanumeric password', async () => {
      const slug = await seedInviteSlug();
      const res = await httpPost(port, '/api/signup', {
        firstName: 'Poli', lastName: 'Cy', phone: '555-123-4567',
        email: 'signup-long@policy.test', password: LONG_PASSWORD, inviteSlug: slug,
      });
      // 201, not 200 — signup CREATES a resource and says so. Pinned rather than
      // loosened to `< 400`, so a future handler that quietly downgrades the
      // status still fails here.
      assert.equal(res.status, 201, `a real password must be accepted at signup, got ${res.status}: ${res.raw}`);
    });
  });

  // ══ THE ROUND TRIP ═════════════════════════════════════════════════════════

  it('[RED] a 14-character password survives signup → login → reset → login', async () => {
    // The end-to-end proof that the three doors agree. Each leg is a real HTTP
    // request against the real handlers; nothing is stubbed.
    const email = 'roundtrip@policy.test';
    const slug = await seedInviteSlug();

    const signup = await httpPost(port, '/api/signup', {
      firstName: 'Round', lastName: 'Trip', phone: '555-987-6543',
      email, password: LONG_PASSWORD, inviteSlug: slug,
    });
    assert.equal(signup.status, 201, `leg 1 (signup) failed: ${signup.raw}`);

    // Signup leaves email_verified false; login does not gate on it, but the row
    // is stamped here so the fixture matches a real post-verification account.
    await pool.query('UPDATE users SET email_verified = true WHERE LOWER(email) = LOWER($1)', [email]);

    const login1 = await httpPost(port, '/api/login', { email, pin: LONG_PASSWORD });
    assert.equal(login1.status, 200, `leg 2 (login with the signup password) failed: ${login1.raw}`);

    const { rows } = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO pin_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + interval '1 hour')`,
      [rows[0].id, token]
    );

    const NEW_PASSWORD = 'Different14Ch!';
    const reset = await httpPost(port, '/api/reset-pin', { token, pin: NEW_PASSWORD });
    assert.equal(reset.status, 200, `leg 3 (reset to another real password) failed: ${reset.raw}`);

    const login2 = await httpPost(port, '/api/login', { email, pin: NEW_PASSWORD });
    assert.equal(login2.status, 200, `leg 4 (login with the reset password) failed: ${login2.raw}`);

    const stale = await httpPost(port, '/api/login', { email, pin: LONG_PASSWORD });
    assert.equal(stale.status, 401, 'the superseded password must stop working');
  });

  // ══ THE COUNTERWEIGHT ══════════════════════════════════════════════════════

  it('[GREEN-by-design] accept-invite was already at eight and is unchanged', async () => {
    // GREEN ON ARRIVAL, and labelled rather than contorted into a false RED. It is
    // the reference the other two doors were raised to meet, so a regression here
    // would mean the unification went the wrong direction.
    const { rows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, 'invitee@policy.test', 'x', 'general', '{}') RETURNING id`,
      [TENANT_A]
    );
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO team_member_invite_tokens (team_member_id, token, expires_at)
       VALUES ($1, $2, NOW() + interval '1 hour')`,
      [rows[0].id, token]
    );

    const short = await httpPost(port, '/api/admin/team/accept-invite', { token, password: SEVEN_CHARS });
    assert.equal(short.status, 400, `seven characters must be refused, got ${short.status}: ${short.raw}`);

    const ok = await httpPost(port, '/api/admin/team/accept-invite', { token, password: LONG_PASSWORD });
    assert.equal(ok.status, 200, `a real password must be accepted, got ${ok.status}: ${ok.raw}`);
  });
});
