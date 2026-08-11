'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 2, STEP 2B — UNIFIED LOGIN (D1 / D2)
//
// Governing spec: CDL_3b_BUILD_SPEC.md §4, decisions D1 and D2.
//
// THE INVERSION. The old endpoint identified the account and THEN checked the
// password: narrow `users` by a client-supplied contractorSlug, take rows[0],
// compare. D1 inverts it — gather every candidate across BOTH identity tables
// and ALL contractors, compare against every one, and branch on how many
// MATCHED. Tenancy comes from whichever hash actually opened, never from the
// request.
//
// Asking "which company?" before the password would show an unauthenticated
// stranger which contractors an address is registered with. Asking after the
// password is proven leaks nothing: the person has already demonstrated they
// hold the credential for every option displayed.
//
// COMPARE COUNTING. Several assertions here are about work that leaves no trace
// in the response — "at least one compare ran on a miss", "no more than five ran
// under the cap". They are asserted by wrapping bcrypt.compare on the shared
// module object, which referrer.js resolves by property lookup at call time. A
// timing-based proxy would be flaky and would prove nothing on a fast machine.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');

const LOGIN = '/api/login';
const CHOICE = '/api/login/choice';

const TENANT_A = 'tnt-unified-a';
const TENANT_B = 'tnt-unified-b';
const NAME_A = 'Alpha Roofing';
const NAME_B = 'Beta Exteriors';

const PW_A = 'alpha-password-1';
const PW_B = 'beta-password-22';
const PW_SHARED = 'shared-password-9';

// Rotating source IP — referrerLoginLimiter is 10 per 15 min per IP and this file
// makes far more than ten login attempts.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.91.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
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

// ── COMPARE COUNTER ──────────────────────────────────────────────────────────
// Wraps the real bcrypt.compare rather than replacing it: every assertion about
// authentication outcomes in this file depends on the real comparison still
// happening. Only the call count is observed.
const realCompare = bcrypt.compare;
let compareCount = 0;
function installCompareCounter() {
  bcrypt.compare = function (...args) {
    compareCount += 1;
    return realCompare.apply(this, args);
  };
}
function restoreCompare() {
  bcrypt.compare = realCompare;
}

let pool, server, port;

async function seedReferrer({ contractorId, email, password, fullName = 'Test Referrer' }) {
  const pinHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [fullName, email, pinHash, contractorId]
  );
  return rows[0].id;
}

async function seedTeamMember({ contractorId, email, password, tier = 'general', active = true }) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions, active)
     VALUES ($1, $2, $3, $4, '{}', $5) RETURNING id`,
    [contractorId, email, hash, tier, active]
  );
  return rows[0].id;
}

async function countSessions() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM sessions');
  return rows[0].n;
}

describe('C/DL-3b Phase 2B — unified login (verify-then-disambiguate)', () => {
  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
    installCompareCounter();
  });

  after(async () => {
    restoreCompare();
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
    await pool.query('DELETE FROM contractors WHERE id LIKE $1', ['tnt-unified-%']);
    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);
    await pool.query('UPDATE contractors SET name = $1 WHERE id = $2', [NAME_A, TENANT_A]);
    await pool.query('UPDATE contractors SET name = $1 WHERE id = $2', [NAME_B, TENANT_B]);
    await pool.query('UPDATE contractor_settings SET company_name = $1 WHERE contractor_id = $2', [NAME_A, TENANT_A]);
    await pool.query('UPDATE contractor_settings SET company_name = $1 WHERE contractor_id = $2', [NAME_B, TENANT_B]);
    compareCount = 0;
  });

  // ══ GROUP 1 — CROSS-TENANT DISAMBIGUATION BY CREDENTIAL ════════════════════

  describe('same email, two contractors, different passwords', () => {
    const EMAIL = 'shared-different@unified.test';

    beforeEach(async () => {
      await seedReferrer({ contractorId: TENANT_A, email: EMAIL, password: PW_A, fullName: 'A Person' });
      await seedReferrer({ contractorId: TENANT_B, email: EMAIL, password: PW_B, fullName: 'B Person' });
    });

    it("[RED] tenant A's password logs into tenant A", async () => {
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_A });
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.success, true);
      const { rows } = await pool.query('SELECT contractor_id, role FROM sessions WHERE token = $1', [res.body.token]);
      assert.equal(rows.length, 1, 'exactly one session row for the returned token');
      assert.equal(rows[0].contractor_id, TENANT_A, 'tenancy must come from the row whose hash opened');
      assert.equal(rows[0].role, 'referrer');
    });

    it("[RED] tenant B's password logs into tenant B", async () => {
      // The other half, and the one that proves the outcome is credential-derived
      // rather than ordering-derived. Under the OLD code the candidate set was
      // narrowed by a client-supplied slug; under D1 nothing is narrowed and this
      // password opens exactly one of the two hashes.
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_B });
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      const { rows } = await pool.query('SELECT contractor_id FROM sessions WHERE token = $1', [res.body.token]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].contractor_id, TENANT_B, 'tenancy must come from the row whose hash opened');
    });

    it('[RED] a password valid for neither tenant is a generic 401 and mints nothing', async () => {
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: 'not-either-of-them' });
      assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.raw}`);
      assert.equal(await countSessions(), 0, 'a failed login must create no session row');
    });

    it('[RED] every candidate is compared, not just the first', async () => {
      // THE GUARD-PROOF TARGET. Removing the per-candidate loop and comparing only
      // candidates[0] makes exactly one of the two logins above fail — which one
      // depends on ordering, which is the bug. Counting the compares pins the
      // mechanism rather than the symptom.
      compareCount = 0;
      await httpPost(port, LOGIN, { email: EMAIL, pin: PW_B });
      assert.equal(compareCount, 2, `expected one compare per candidate (2), got ${compareCount}`);
    });
  });

  // ══ GROUP 2 — THE CHOICE PATH (D2) ═════════════════════════════════════════

  describe('same email, two contractors, same password', () => {
    const EMAIL = 'shared-same@unified.test';

    beforeEach(async () => {
      await seedReferrer({ contractorId: TENANT_A, email: EMAIL, password: PW_SHARED, fullName: 'A Person' });
      await seedReferrer({ contractorId: TENANT_B, email: EMAIL, password: PW_SHARED, fullName: 'B Person' });
    });

    it('[RED] returns a choice token and mints NO session', async () => {
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.choice_required, true, `expected choice_required, got: ${res.raw}`);
      assert.equal(typeof res.body.choice_token, 'string');
      assert.equal(res.body.choice_token.length, 64, 'choice tokens are 64-char hex from 32 random bytes');
      assert.equal(res.body.token, undefined, 'no session token may be issued on a multi-match');

      // Asserted against the TABLE, not just the response body. A handler that
      // minted a session and merely omitted the token from the JSON would pass a
      // response-only check while leaving a live credential in the database.
      assert.equal(await countSessions(), 0, 'a multi-match must create no session row');
    });

    it('[RED] the identity list carries contractor name and role only — never emails or IDs', async () => {
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      assert.equal(res.status, 200, res.raw);
      assert.equal(res.body.identities.length, 2);

      const names = res.body.identities.map(i => i.contractor_name).sort();
      assert.deepEqual(names, [NAME_A, NAME_B].sort());
      for (const identity of res.body.identities) {
        assert.equal(identity.role, 'referrer');
        assert.deepEqual(
          Object.keys(identity).sort(), ['contractor_name', 'role', 'selection'],
          `an identity may carry only a display name, a role and an opaque selector; got ${JSON.stringify(identity)}`
        );
      }

      // Against the RAW response: the address and the tenant ids must appear
      // nowhere at all, including in a field this test does not know to read.
      assert.equal(res.raw.includes(EMAIL), false, 'the choice response must not echo the email address');
      assert.equal(res.raw.includes(TENANT_A), false, 'the choice response must not carry a contractor id');
      assert.equal(res.raw.includes(TENANT_B), false, 'the choice response must not carry a contractor id');
    });

    it('[RED] redeeming a choice token mints a session for the selected identity', async () => {
      const first = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      const pickB = first.body.identities.find(i => i.contractor_name === NAME_B);

      const res = await httpPost(port, CHOICE, { choice_token: first.body.choice_token, selection: pickB.selection });
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(typeof res.body.token, 'string');

      const { rows } = await pool.query('SELECT contractor_id FROM sessions WHERE token = $1', [res.body.token]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].contractor_id, TENANT_B, 'the session must belong to the identity that was selected');
    });

    it('[RED] the password is never re-sent — redemption takes only the token and the selection', async () => {
      // D2, binding: "Do NOT ask the client to re-send the password." Asserted by
      // redeeming successfully without one; a handler that required it would 4xx.
      const first = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      const res = await httpPost(port, CHOICE, {
        choice_token: first.body.choice_token,
        selection: first.body.identities[0].selection,
      });
      assert.equal(res.status, 200, `redemption must not require the credential again: ${res.raw}`);
    });

    it('[RED] a choice token is single-use — the second redemption is refused', async () => {
      const first = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      const sel = first.body.identities[0].selection;

      const ok = await httpPost(port, CHOICE, { choice_token: first.body.choice_token, selection: sel });
      assert.equal(ok.status, 200, `precondition: the first redemption must succeed: ${ok.raw}`);

      const replay = await httpPost(port, CHOICE, { choice_token: first.body.choice_token, selection: sel });
      assert.equal(replay.status, 401, `a replayed choice token must be refused, got ${replay.status}: ${replay.raw}`);
      assert.equal(await countSessions(), 1, 'the replay must not mint a second session');
    });

    it('[RED] an expired choice token is refused', async () => {
      const first = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      await pool.query(
        `UPDATE login_choice_tokens SET expires_at = NOW() - interval '1 second' WHERE token = $1`,
        [first.body.choice_token]
      );
      const res = await httpPost(port, CHOICE, {
        choice_token: first.body.choice_token,
        selection: first.body.identities[0].selection,
      });
      assert.equal(res.status, 401, `an expired choice token must be refused, got ${res.status}: ${res.raw}`);
      assert.equal(await countSessions(), 0);
    });

    it('[RED] a forged choice token is refused', async () => {
      const res = await httpPost(port, CHOICE, {
        choice_token: crypto.randomBytes(32).toString('hex'),
        selection: 0,
      });
      assert.equal(res.status, 401, `a forged choice token must be refused, got ${res.status}: ${res.raw}`);
      assert.equal(await countSessions(), 0);
    });

    it('[RED] a selection outside the matched set is refused', async () => {
      // The identity set is stored server-side at issue time, so "an identity that
      // did not match" is not addressable. Proven rather than assumed.
      const first = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      const res = await httpPost(port, CHOICE, { choice_token: first.body.choice_token, selection: 99 });
      assert.equal(res.status, 401, `an out-of-range selection must be refused, got ${res.status}: ${res.raw}`);
      assert.equal(await countSessions(), 0);
    });

    it('[RED] the 2-minute TTL is what is actually written', async () => {
      const first = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      const { rows } = await pool.query(
        `SELECT EXTRACT(EPOCH FROM (expires_at - NOW()))::int AS secs FROM login_choice_tokens WHERE token = $1`,
        [first.body.choice_token]
      );
      assert.equal(rows.length, 1, 'the choice token must be persisted server-side');
      assert.ok(rows[0].secs > 90 && rows[0].secs <= 120, `expected a ~120s TTL, got ${rows[0].secs}s`);
    });
  });

  // ══ GROUP 3 — MULTI-ROLE (CD-4: the Owner who is also a rep) ═══════════════

  describe('same email as both a users row and a team_members row', () => {
    const EMAIL = 'multi-role@unified.test';

    it('[RED] a shared password offers both identities, labelled by role', async () => {
      await seedReferrer({ contractorId: TENANT_A, email: EMAIL, password: PW_SHARED });
      await seedTeamMember({ contractorId: TENANT_A, email: EMAIL, password: PW_SHARED });

      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      assert.equal(res.status, 200, res.raw);
      assert.equal(res.body.choice_required, true, `expected a choice, got: ${res.raw}`);
      const roles = res.body.identities.map(i => i.role).sort();
      assert.deepEqual(roles, ['referrer', 'team'], `expected one of each role, got ${JSON.stringify(roles)}`);
    });

    it('[RED] the team_members credential alone lands on the team side with no choice', async () => {
      await seedReferrer({ contractorId: TENANT_A, email: EMAIL, password: PW_A });
      await seedTeamMember({ contractorId: TENANT_A, email: EMAIL, password: PW_B });

      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_B });
      assert.equal(res.status, 200, res.raw);
      assert.equal(res.body.choice_required, undefined, 'a single match must never show the choice screen');
      assert.equal(res.body.role, 'team');

      const { rows } = await pool.query(
        'SELECT role, contractor_id, team_member_id, user_id FROM sessions WHERE token = $1',
        [res.body.token]
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].role, 'admin', "team sessions keep the existing 'admin' session role");
      assert.equal(rows[0].contractor_id, TENANT_A);
      assert.ok(rows[0].team_member_id, 'a team session must carry team_member_id for requirePermission');
      assert.equal(rows[0].user_id, null);
    });

    it('[RED] the users credential alone lands on the referrer side with no choice', async () => {
      await seedReferrer({ contractorId: TENANT_A, email: EMAIL, password: PW_A });
      await seedTeamMember({ contractorId: TENANT_A, email: EMAIL, password: PW_B });

      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_A });
      assert.equal(res.status, 200, res.raw);
      assert.equal(res.body.choice_required, undefined);
      assert.equal(res.body.role, 'referrer');
      const { rows } = await pool.query('SELECT role FROM sessions WHERE token = $1', [res.body.token]);
      assert.equal(rows[0].role, 'referrer');
    });
  });

  // ══ GROUP 4 — TIMING PARITY AND ENUMERATION ════════════════════════════════

  describe('zero matches', () => {
    it('[RED] an unknown email still runs at least one compare', async () => {
      // Without a dummy-hash compare the handler returns before doing any bcrypt
      // work, and response timing tells an attacker whether the address exists.
      compareCount = 0;
      const res = await httpPost(port, LOGIN, { email: 'nobody@unified.test', pin: 'whatever-8ch' });
      assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.raw}`);
      assert.ok(compareCount >= 1, `a miss must still perform a compare for timing parity, got ${compareCount}`);
    });

    it('[RED] an unknown email and a wrong password are indistinguishable', async () => {
      await seedReferrer({ contractorId: TENANT_A, email: 'known@unified.test', password: PW_A });
      const unknown = await httpPost(port, LOGIN, { email: 'nobody@unified.test', pin: 'wrong-password' });
      const wrong = await httpPost(port, LOGIN, { email: 'known@unified.test', pin: 'wrong-password' });
      assert.equal(unknown.status, wrong.status, 'status must not distinguish the two');
      assert.deepEqual(unknown.body, wrong.body, 'body must not distinguish the two — otherwise this enumerates accounts');
    });
  });

  // ══ GROUP 5 — HOSTILE PAYLOAD ══════════════════════════════════════════════

  describe('client-supplied tenancy is ignored', () => {
    const EMAIL = 'hostile@unified.test';

    it('[RED] contractorSlug and contractor_id in the body do not steer the session', async () => {
      // THE GUARD-PROOF TARGET. The password below belongs to tenant B. The body
      // names tenant A twice, in both the retired wire field and the column name.
      // Tenancy must come from the authenticated row regardless.
      await seedReferrer({ contractorId: TENANT_A, email: EMAIL, password: PW_A });
      await seedReferrer({ contractorId: TENANT_B, email: EMAIL, password: PW_B });

      const res = await httpPost(port, LOGIN, {
        email: EMAIL, pin: PW_B, contractorSlug: TENANT_A, contractor_id: TENANT_A,
      });
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      const { rows } = await pool.query('SELECT contractor_id FROM sessions WHERE token = $1', [res.body.token]);
      assert.equal(
        rows[0].contractor_id, TENANT_B,
        'the session must belong to the tenant whose hash opened, not the one the caller named'
      );
    });

    it('[RED] a body naming a tenant the credential does not belong to still 401s', async () => {
      await seedReferrer({ contractorId: TENANT_A, email: EMAIL, password: PW_A });
      const res = await httpPost(port, LOGIN, {
        email: EMAIL, pin: 'wrong-password-x', contractorSlug: TENANT_A,
      });
      assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.raw}`);
      assert.equal(await countSessions(), 0);
    });

    it('[RED] a missing contractorSlug is no longer an error — the field is retired', async () => {
      // Tenant Rebuild §3.5's narrowing exception retires HERE. The old handler
      // answered 400 'Missing contractor context.' before doing anything.
      await seedReferrer({ contractorId: TENANT_A, email: EMAIL, password: PW_A });
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_A });
      assert.equal(res.status, 200, `a login with no tenant field must work, got ${res.status}: ${res.raw}`);
    });
  });

  // ══ GROUP 6 — CANDIDATE CAP ════════════════════════════════════════════════

  describe('candidate cap', () => {
    it('[RED] no more than five candidates are gathered or compared', async () => {
      // Without a cap, N bcrypt compares per request is a cheap denial of service:
      // an attacker registers the same address with many contractors and every
      // login attempt against it costs N hashes.
      const EMAIL = 'capped@unified.test';
      for (let i = 0; i < 7; i += 1) {
        const cid = `tnt-unified-cap-${i}`;
        await seedContractor(pool, cid);
        await seedReferrer({ contractorId: cid, email: EMAIL, password: PW_SHARED });
      }

      compareCount = 0;
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      assert.ok(compareCount <= 5, `at most five compares may run, got ${compareCount}`);
      assert.equal(res.status, 200, res.raw);
      assert.equal(res.body.identities.length, 5, `the choice list must be capped at five, got ${res.body.identities.length}`);

      await pool.query('DELETE FROM users');
      await pool.query('DELETE FROM contractors WHERE id LIKE $1', ['tnt-unified-cap-%']);
    });

    it('[RED] the team_members candidate is never crowded out by referrer rows', async () => {
      // Ordering is load-bearing, not incidental: team_members is ordered first so
      // an employee whose address also holds many homeowner accounts can still
      // reach the side they actually work in.
      const EMAIL = 'crowded@unified.test';
      for (let i = 0; i < 6; i += 1) {
        const cid = `tnt-unified-crowd-${i}`;
        await seedContractor(pool, cid);
        await seedReferrer({ contractorId: cid, email: EMAIL, password: PW_SHARED });
      }
      await seedTeamMember({ contractorId: TENANT_A, email: EMAIL, password: PW_SHARED });

      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW_SHARED });
      assert.equal(res.status, 200, res.raw);
      assert.ok(
        res.body.identities.some(i => i.role === 'team'),
        `the team identity must survive the cap; got ${JSON.stringify(res.body.identities)}`
      );

      await pool.query('DELETE FROM users');
      await pool.query('DELETE FROM contractors WHERE id LIKE $1', ['tnt-unified-crowd-%']);
    });
  });

  // ══ GROUP 7 — CASE INSENSITIVITY ACROSS BOTH TABLES (2A's payoff) ══════════

  describe('email matching is case-insensitive on both sides', () => {
    it('[RED] a team member stored in mixed case is reachable from a normalised form', async () => {
      // The reason uniq_team_members_lower_email exists. team_members was matched
      // case-SENSITIVELY before 2B, so a row stored as Jane@x.test was unreachable
      // from a login form that lowercases its input.
      await seedTeamMember({ contractorId: TENANT_A, email: 'Jane.Doe@Unified.Test', password: PW_A });
      const res = await httpPost(port, LOGIN, { email: 'jane.doe@unified.test', pin: PW_A });
      assert.equal(res.status, 200, `mixed-case team_members row must be reachable, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.role, 'team');
    });
  });
});
