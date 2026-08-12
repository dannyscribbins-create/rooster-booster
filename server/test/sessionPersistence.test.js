'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 4 — PERSISTENCE AND LOGOUT (D6 / D7)
//
// Governing spec: CDL_3b_BUILD_SPEC.md §6, decisions D6 and D7.
//
// THE STARTING TRUTH. There is no logout route anywhere in this codebase. All
// three surfaces "log out" by deleting a key from sessionStorage, which means
// the bearer token stays valid server-side for its full lifetime after every
// logout. Anyone holding a copy of that token — a shared computer, a synced
// browser profile, a proxy log — keeps the account until the clock runs out.
//
// TWO ENDPOINTS, BOTH ROLE-AGNOSTIC:
//   GET  /api/session  validates a stored token and describes its owner, so the
//                      client can rehydrate instead of dumping people at login
//                      on every refresh.
//   POST /api/logout   deletes the row. The row, not the response — a handler
//                      that returned 200 and left the session live would pass
//                      any response-shaped assertion while changing nothing.
//
// SESSIONS ARE ASSERTED AGAINST THE TABLE, then re-probed with the token. Both
// halves are needed: the count proves the delete happened, the re-probe proves
// the delete was the one that mattered.
//
// THE SLIDE IS OBSERVED THROUGH expires_at, NOT THROUGH A RETURN VALUE. The
// policy arithmetic is unit-tested in sessionPolicy.test.js; what this file
// proves is that the arithmetic is actually WIRED to the verify path and
// actually writes. A correct policy that no request ever calls is inert.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');
const { SESSION_SLIDE_MS, SESSION_ABSOLUTE_CAP_MS } = require('../utils/sessionPolicy');

const SESSION = '/api/session';
const LOGOUT = '/api/logout';
const LOGIN = '/api/login';

const TENANT = 'tnt-persist-a';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const PW = 'persist-password-1';

// Rotating source IP — referrerLoginLimiter is 10/15min per IP and this file
// logs in more often than that allows.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.71.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpRequest(port, method, path, { body = null, token = null } = {}) {
  const payload = body ? Buffer.from(JSON.stringify(body)) : null;
  return new Promise((resolve, reject) => {
    const headers = { 'X-Forwarded-For': nextIp() };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = _httpRequest({ hostname: 'localhost', port, path, method, headers }, res => {
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
    if (payload) req.write(payload);
    req.end();
  });
}

const httpGet = (port, path, token) => httpRequest(port, 'GET', path, { token });
const httpPost = (port, path, body, token) => httpRequest(port, 'POST', path, { body, token });

let pool, server, port;

// Inserts a session row with full control over created_at and expires_at —
// seedSession() in helpers.js cannot set created_at, and the 90-day cap is
// unobservable without it.
async function seedSessionAt({ token, role, userId = null, teamMemberId = null, contractorId = null, createdAgoMs, expiresInMs }) {
  await pool.query(
    `INSERT INTO sessions (user_id, token, created_at, expires_at, role, contractor_id, team_member_id)
     VALUES ($1, $2, NOW() - ($3::bigint * INTERVAL '1 millisecond'),
                     NOW() + ($4::bigint * INTERVAL '1 millisecond'), $5, $6, $7)`,
    [userId, token, String(createdAgoMs), String(expiresInMs), role, contractorId, teamMemberId]
  );
}

async function readSession(token) {
  const { rows } = await pool.query(
    'SELECT id, created_at, expires_at, role FROM sessions WHERE token = $1',
    [token]
  );
  return rows[0] || null;
}

async function countSessions() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM sessions');
  return rows[0].n;
}

async function seedReferrer({ email, password, fullName = 'Persist Referrer' }) {
  const pinHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [fullName, email, pinHash, TENANT]
  );
  return rows[0].id;
}

async function seedTeamMember({ email, password, tier = 'general' }) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions, active)
     VALUES ($1, $2, $3, $4, '{"team":true}', true) RETURNING id`,
    [TENANT, email, hash, tier]
  );
  return rows[0].id;
}

const newToken = () => crypto.randomBytes(32).toString('hex');

describe('C/DL-3b Phase 4 — persistence and logout (D6/D7)', () => {
  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM login_choice_tokens').catch(() => {});
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM contractors WHERE id LIKE $1', ['tnt-persist-%']);
    await seedContractor(pool, TENANT);
  });

  // ══ GROUP 1 — GET /api/session, THE REHYDRATION PROBE ══════════════════════

  describe('GET /api/session — a valid token', () => {
    it('[RED] describes a referrer session so the client can restore it', async () => {
      const userId = await seedReferrer({ email: 'rehydrate@persist.test', password: PW });
      const token = newToken();
      await seedSessionAt({
        token, role: 'referrer', userId, contractorId: TENANT,
        createdAgoMs: DAY, expiresInMs: 29 * DAY,
      });

      const res = await httpGet(port, SESSION, token);

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.role, 'referrer');
      assert.equal(res.body.name, 'Persist Referrer', 'the client needs the name to restore its header');
      assert.equal(res.body.email, 'rehydrate@persist.test');
      assert.equal(res.body.token, undefined, 'the probe must never echo the credential back');
      assert.ok(userId);
    });

    it('[RED] describes a team session with tier and permissions', async () => {
      const memberId = await seedTeamMember({ email: 'rep@persist.test', password: PW, tier: 'general' });
      const token = newToken();
      await seedSessionAt({
        token, role: 'admin', teamMemberId: memberId, contractorId: TENANT,
        createdAgoMs: DAY, expiresInMs: 29 * DAY,
      });

      const res = await httpGet(port, SESSION, token);

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.role, 'team', 'the client routes on role; a team member is "team"');
      assert.equal(res.body.tier, 'general');
      assert.deepEqual(res.body.permissions, { team: true });
    });

    it('[RED] describes a super-admin session', async () => {
      const token = newToken();
      await seedSessionAt({ token, role: 'super_admin', createdAgoMs: DAY, expiresInMs: 29 * DAY });

      const res = await httpGet(port, SESSION, token);

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.role, 'super_admin');
    });
  });

  describe('GET /api/session — a token that must NOT restore', () => {
    it('[RED] an EXPIRED token is 401, not a partial session', async () => {
      const userId = await seedReferrer({ email: 'expired@persist.test', password: PW });
      const token = newToken();
      await seedSessionAt({
        token, role: 'referrer', userId, contractorId: TENANT,
        createdAgoMs: 2 * DAY, expiresInMs: -HOUR,
      });

      const res = await httpGet(port, SESSION, token);

      assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.role, undefined, 'an expired probe must carry no identity at all');
    });

    it('[RED] a REVOKED (deleted) token is 401', async () => {
      const res = await httpGet(port, SESSION, newToken());
      assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.raw}`);
    });

    it('[RED] a MALFORMED token is 401 and does not crash the handler', async () => {
      for (const bad of ['', 'not-a-token', '../../etc/passwd', "' OR 1=1 --", 'x'.repeat(5000)]) {
        const res = await httpGet(port, SESSION, bad);
        assert.equal(res.status, 401, `malformed token ${JSON.stringify(bad.slice(0, 20))} → ${res.status}`);
      }
    });

    it('[RED] no Authorization header at all is 401', async () => {
      const res = await httpGet(port, SESSION, null);
      assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.raw}`);
    });

    it('[RED] a referrer session whose user was soft-deleted is 401', async () => {
      const userId = await seedReferrer({ email: 'deleted@persist.test', password: PW });
      await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);
      const token = newToken();
      await seedSessionAt({
        token, role: 'referrer', userId, contractorId: TENANT,
        createdAgoMs: DAY, expiresInMs: 29 * DAY,
      });

      const res = await httpGet(port, SESSION, token);
      assert.equal(res.status, 401, 'a soft-deleted account must not rehydrate');
    });
  });

  // ══ GROUP 2 — POST /api/logout, THE ROW MUST GO ════════════════════════════

  describe('POST /api/logout', () => {
    it('[RED] GUARD-PROOF: deletes the session row and the same token is then rejected', async () => {
      const userId = await seedReferrer({ email: 'logout@persist.test', password: PW });
      const token = newToken();
      await seedSessionAt({
        token, role: 'referrer', userId, contractorId: TENANT,
        createdAgoMs: DAY, expiresInMs: 29 * DAY,
      });
      assert.equal(await countSessions(), 1, 'precondition: the session exists');

      const res = await httpPost(port, LOGOUT, {}, token);
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);

      // HALF ONE — the table. Comment out the DELETE in the handler and this
      // is the assertion that goes red.
      assert.equal(await countSessions(), 0, 'logout must DELETE the row, not merely answer 200');

      // HALF TWO — the token. Proves the deleted row was the one that mattered.
      const after = await httpGet(port, SESSION, token);
      assert.equal(after.status, 401, 'the token must be dead on the very next request');
    });

    it('[RED] deletes an ADMIN session', async () => {
      const memberId = await seedTeamMember({ email: 'adminout@persist.test', password: PW });
      const token = newToken();
      await seedSessionAt({
        token, role: 'admin', teamMemberId: memberId, contractorId: TENANT,
        createdAgoMs: DAY, expiresInMs: 29 * DAY,
      });

      assert.equal((await httpPost(port, LOGOUT, {}, token)).status, 200);
      assert.equal(await countSessions(), 0, 'the admin surface must log out server-side too');
    });

    it('[RED] deletes a SUPER-ADMIN session', async () => {
      const token = newToken();
      await seedSessionAt({ token, role: 'super_admin', createdAgoMs: DAY, expiresInMs: 29 * DAY });

      assert.equal((await httpPost(port, LOGOUT, {}, token)).status, 200);
      assert.equal(await countSessions(), 0, 'the super-admin surface must log out server-side too');
    });

    it('[RED] deletes ONLY the presented session, never a sibling', async () => {
      const userId = await seedReferrer({ email: 'sibling@persist.test', password: PW });
      const mine = newToken();
      const theirs = newToken();
      await seedSessionAt({ token: mine, role: 'referrer', userId, contractorId: TENANT, createdAgoMs: DAY, expiresInMs: 29 * DAY });
      await seedSessionAt({ token: theirs, role: 'referrer', userId, contractorId: TENANT, createdAgoMs: DAY, expiresInMs: 29 * DAY });

      await httpPost(port, LOGOUT, {}, mine);

      assert.equal(await countSessions(), 1, 'logging out one device must not log out the others');
      assert.ok(await readSession(theirs), 'the untouched session must survive');
    });

    it('[RED] an unknown token is still 200 — logout reveals nothing', async () => {
      // A 404 here would turn logout into a token oracle: present a guess, read
      // the status, learn whether it exists.
      const res = await httpPost(port, LOGOUT, {}, newToken());
      assert.equal(res.status, 200, `expected an idempotent 200, got ${res.status}: ${res.raw}`);
    });

    it('[RED] no Authorization header is 200, not a crash', async () => {
      const res = await httpPost(port, LOGOUT, {}, null);
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
    });
  });

  // ══ GROUP 3 — THE SLIDE, OBSERVED THROUGH THE TABLE ════════════════════════

  describe('sliding expiry (D7)', () => {
    it('[RED] an authenticated request extends an active session', async () => {
      const userId = await seedReferrer({ email: 'slide@persist.test', password: PW });
      const token = newToken();
      // Last bumped 2 hours ago — past the throttle.
      await seedSessionAt({
        token, role: 'referrer', userId, contractorId: TENANT,
        createdAgoMs: 10 * DAY, expiresInMs: SESSION_SLIDE_MS - 2 * HOUR,
      });
      const before = await readSession(token);

      const res = await httpGet(port, SESSION, token);
      assert.equal(res.status, 200);

      const after = await readSession(token);
      assert.ok(
        after.expires_at.getTime() > before.expires_at.getTime(),
        'an active session must be slid forward on use'
      );
      // Landed at ~now + 30d, within a generous window for test latency.
      const target = Date.now() + SESSION_SLIDE_MS;
      assert.ok(
        Math.abs(after.expires_at.getTime() - target) < 60_000,
        `expected ~now+30d, got ${after.expires_at.toISOString()}`
      );
    });

    it('[RED] the throttle suppresses a second bump within the hour', async () => {
      const userId = await seedReferrer({ email: 'throttle@persist.test', password: PW });
      const token = newToken();
      await seedSessionAt({
        token, role: 'referrer', userId, contractorId: TENANT,
        createdAgoMs: 10 * DAY, expiresInMs: SESSION_SLIDE_MS - 2 * HOUR,
      });

      const seeded = await readSession(token);

      await httpGet(port, SESSION, token);        // first bump — lands at now+30d
      const afterFirst = await readSession(token);

      // NOT VACUOUS. Without this line the test passes when NOTHING writes at
      // all — "unchanged" and "correctly throttled" would be the same result.
      assert.ok(
        afterFirst.expires_at.getTime() > seeded.expires_at.getTime(),
        'precondition: the first request must actually have slid the session'
      );

      await httpGet(port, SESSION, token);        // immediately again
      await httpGet(port, SESSION, token);
      const afterThird = await readSession(token);

      assert.equal(
        afterThird.expires_at.getTime(), afterFirst.expires_at.getTime(),
        'THROTTLE BREACH: a database write happened on every request'
      );
    });

    it('[RED] created_at is never rewritten by a slide — the cap must stay anchored', async () => {
      const userId = await seedReferrer({ email: 'anchor@persist.test', password: PW });
      const token = newToken();
      await seedSessionAt({
        token, role: 'referrer', userId, contractorId: TENANT,
        createdAgoMs: 10 * DAY, expiresInMs: SESSION_SLIDE_MS - 2 * HOUR,
      });
      const before = await readSession(token);

      await httpGet(port, SESSION, token);

      const after = await readSession(token);

      // NOT VACUOUS — see the throttle test above. created_at trivially matches
      // if the request did nothing, so prove the slide ran before checking the
      // anchor held.
      assert.ok(
        after.expires_at.getTime() > before.expires_at.getTime(),
        'precondition: the request must actually have slid the session'
      );
      assert.equal(
        after.created_at.getTime(), before.created_at.getTime(),
        'CAP DEFEATED: rewriting created_at on each slide makes the 90-day ceiling unreachable'
      );
    });

    it('[RED] THE CAP WINS — a session active past 90 days is not extended', async () => {
      const userId = await seedReferrer({ email: 'cap@persist.test', password: PW });
      const token = newToken();
      // Created 89d23h ago, one hour of life left, still being used.
      await seedSessionAt({
        token, role: 'referrer', userId, contractorId: TENANT,
        createdAgoMs: SESSION_ABSOLUTE_CAP_MS - HOUR, expiresInMs: HOUR,
      });
      const before = await readSession(token);

      const res = await httpGet(port, SESSION, token);
      assert.equal(res.status, 200, 'it is still valid — for one more hour');

      const after = await readSession(token);
      assert.equal(
        after.expires_at.getTime(), before.expires_at.getTime(),
        'IMMORTAL TOKEN: the slide pushed a session past its 90-day ceiling'
      );
    });

    it('[RED] a session past its cap and past its expiry is simply dead', async () => {
      const userId = await seedReferrer({ email: 'dead@persist.test', password: PW });
      const token = newToken();
      await seedSessionAt({
        token, role: 'referrer', userId, contractorId: TENANT,
        createdAgoMs: SESSION_ABSOLUTE_CAP_MS + DAY, expiresInMs: -HOUR,
      });

      const res = await httpGet(port, SESSION, token);
      assert.equal(res.status, 401, 'past the cap the session must be gone, not renewed');
    });
  });

  // ══ GROUP 4 — THE MINT, ALL THREE DOORS ════════════════════════════════════

  describe('session minting uses the 30-day slide window', () => {
    it('[RED] POST /api/login mints a 30-day session, not 24 hours', async () => {
      await seedReferrer({ email: 'mint@persist.test', password: PW });

      const res = await httpPost(port, LOGIN, { email: 'mint@persist.test', pin: PW });
      assert.equal(res.status, 200, `login failed: ${res.raw}`);

      const row = await readSession(res.body.token);
      assert.ok(row, 'the login must have created a session row');
      const lifeMs = row.expires_at.getTime() - Date.now();
      assert.ok(
        Math.abs(lifeMs - SESSION_SLIDE_MS) < 60_000,
        `expected a ~30-day session, got ${(lifeMs / DAY).toFixed(2)} days`
      );
    });
  });
});
