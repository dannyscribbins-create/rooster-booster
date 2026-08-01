'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 2b RED SUITE — RESEND VERIFICATION CODE
//
// EmailVerifyScreen.jsx has shipped a fake Resend button since self-serve signup
// went live: handleResend() sets a 60-second cooldown, flashes "Code resent! Check
// your inbox", and calls nothing (src/components/auth/EmailVerifyScreen.jsx:67-72,
// carrying its own `// MVP: add a dedicated /api/signup/resend-code endpoint`
// comment). A homeowner whose code never arrived is told it was resent and waits
// for an email that was never sent. This file pins the real endpoint.
//
// PROPOSED CONTRACT — this file defines it; the GREEN phase implements it.
//
//   POST /api/signup/resend-code   body: { email, contractorId }
//   -> 200, always, with one generic body regardless of outcome.
//
//   WHY email + contractorId RATHER THAN userId. The verify endpoint next door
//   takes userId, and reusing it here would be the shorter change — but users.id is
//   a sequential integer. A resend keyed on it is a mailbomb primitive: POST 1..N
//   and every real account in the table receives an email. Keyed on an address the
//   caller must already know, the endpoint hands out nothing it did not receive.
//   contractorId is already in the client's hands — the landing payload returns it
//   (see landingResolution.test.js) — and it scopes the lookup to one tenant, which
//   matters because users is UNIQUE(contractor_id, email), not UNIQUE(email).
//
//   NON-DISCLOSURE follows /api/forgot-pin (referrer.js:1410-1498) exactly: one
//   genericResponse object, returned for a hit, a miss, an already-verified account,
//   a missing parameter, and a swallowed DB error alike. Mail failures are swallowed
//   there for the same reason and are swallowed here.
//
// THE ONE-CODE RULE, which is the real security content of this file: after a
// resend, the OLD code must no longer verify. A 6-digit code is 1-in-a-million per
// guess; two live codes halve that, and a resend button a user can press repeatedly
// turns an inbox problem into an unbounded pile of simultaneously-valid codes. Both
// directions are asserted — old dead AND new live — because an implementation that
// invalidated everything and issued nothing would satisfy either half alone.
//
// RESEND INTERCEPTION — the require.cache pattern from signupEmailWhiteLabel.test.js,
// installed before anything that constructs a Resend client is required. The stub
// RECORDS sends rather than discarding them, because "no mail was sent" is itself an
// assertion here. No real mail.
//
// NO PRODUCTION CONTRACTOR ID LITERALS (house rule) — tenant ids are fixture-local.
// The one exception is the C9 regression guard, which must name the hardcoded
// company-name string it exists to detect.
// ─────────────────────────────────────────────────────────────────────────────

const sentEmails = [];

const _resendPath = require.resolve('resend');
require.cache[_resendPath] = {
  id: _resendPath,
  filename: _resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = {
          send: async payload => {
            sentEmails.push(payload);
            return { data: { id: 'test-stub' }, error: null };
          },
        };
      }
    },
  },
};

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

const RESEND_PATH = '/api/signup/resend-code';
const VERIFY_PATH = '/api/signup/verify-email';

const TENANT_A_ID = 'tnt-k7fq-internal';
const TENANT_B_ID = 'tnt-m2wp-internal';

const COMPANY_A = 'Alpha Roofing Co';
const COMPANY_B = 'Beta Roofing Co';

// The platform name. A homeowner who scanned a roofer's QR code and receives an
// email from "RoofMiles" has been handed every signal of a phishing attempt — the
// same failure signupEmailWhiteLabel.test.js pins for the first send.
const PLATFORM_NAME = 'RoofMiles';

let _counter = 0;
function uniq(prefix) {
  _counter += 1;
  return `${prefix}-${Date.now()}-${_counter}`;
}

// Fresh IP per request unless a test pins one. server/app.js sets `trust proxy 1`,
// so express-rate-limit keys on X-Forwarded-For; sharing one bucket across the file
// would make it 429 partway through for a reason unrelated to what it tests.
function nextIp() {
  _counter += 1;
  return `10.80.${Math.floor(_counter / 250)}.${(_counter % 250) + 1}`;
}

function httpPost(port, path, bodyObj, { ip = null } = {}) {
  const payload = Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'X-Forwarded-For': ip || nextIp(),
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

describe('C/DL-2 Phase 2b — POST /api/signup/resend-code', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    sentEmails.length = 0;
    await pool.query('DELETE FROM email_verifications');
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedTenant(TENANT_A_ID, COMPANY_A);
    await seedTenant(TENANT_B_ID, COMPANY_B);
  });

  async function seedTenant(contractorId, companyName) {
    await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $2)`, [contractorId, companyName]);
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, $2)`,
      [contractorId, companyName]
    );
  }

  // Seeds an unverified account holding exactly one live verification code — the
  // state a homeowner is in when they press Resend. Returns { userId, email, code }.
  async function seedPendingSignup(contractorId, { code = '111111', verified = false } = {}) {
    const email = `${uniq('homeowner')}@test.invalid`;
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ($1, $2, '$2b$10$test.placeholder.hash.for.tests', $3, $4)
       RETURNING id`,
      ['Test Homeowner', email, contractorId, verified]
    );
    const userId = rows[0].id;
    await pool.query(
      `INSERT INTO email_verifications (user_id, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [userId, code]
    );
    return { userId, email, code };
  }

  // The newest still-usable code for a user, or null. Mirrors the eligibility
  // predicate of /api/signup/verify-email so "live" here means the same thing it
  // means to the endpoint that consumes it.
  async function liveCode(userId) {
    const { rows } = await pool.query(
      `SELECT code FROM email_verifications
        WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()
        ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    return rows[0] ? rows[0].code : null;
  }

  async function liveCodeCount(userId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM email_verifications
        WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [userId]
    );
    return rows[0].n;
  }

  // ── 1. THE LIMITER CONTRACT ────────────────────────────────────────────────

  it('referrer.js exports RESEND_CODE_LIMIT so the suite reads the threshold', async () => {
    // Same convention as LANDING_RESOLVE_LIMIT (Phase 2a): the numbers are tuning,
    // and a test that hardcoded them would fail on every tune. What is asserted is
    // that a bound EXISTS and is conservative — this endpoint sends mail to an
    // address the caller supplies, which is the shape of an abuse primitive.
    const referrerRouter = require('../routes/referrer');
    const limit = referrerRouter.RESEND_CODE_LIMIT;

    assert.ok(limit, 'referrer.js must export RESEND_CODE_LIMIT');
    assert.ok(Number.isInteger(limit.max) && limit.max > 0, 'RESEND_CODE_LIMIT.max must be a positive integer');
    assert.ok(
      Number.isInteger(limit.windowMs) && limit.windowMs > 0,
      'RESEND_CODE_LIMIT.windowMs must be a positive integer'
    );
    assert.ok(
      limit.max <= 10,
      'a mail-triggering endpoint needs a tight bound — a double-digit allowance per window is a formality, not a limiter'
    );
  });

  // ── 2. HAPPY PATH ──────────────────────────────────────────────────────────

  it('issues a fresh 6-digit code, sends it, and reports success', async () => {
    const { userId, email } = await seedPendingSignup(TENANT_A_ID, { code: '111111' });

    const res = await httpPost(port, RESEND_PATH, { email, contractorId: TENANT_A_ID });
    assert.equal(res.status, 200, `resend failed: ${res.raw}`);
    assert.ok(res.body && typeof res.body === 'object', `expected a JSON body, got: ${res.raw}`);

    const fresh = await liveCode(userId);
    assert.ok(fresh, 'no live verification code exists after a resend');
    assert.match(fresh, /^\d{6}$/, `the re-minted code must be 6 digits, got: ${fresh}`);
    assert.notEqual(fresh, '111111', 'the resend re-issued the same code it was asked to replace');

    const sent = sentEmails.find(e => e.to === email);
    assert.ok(sent, `no email was sent to ${email}`);
    assert.ok(
      sent.html.includes(fresh),
      'the email must carry the code that was actually stored — a resend that mails a ' +
      'different code than it persists locks the user out entirely'
    );
  });

  // ── 3. THE ONE-CODE RULE — BOTH DIRECTIONS ─────────────────────────────────

  it('the new code verifies and the old code no longer does', async () => {
    const { userId, email, code: oldCode } = await seedPendingSignup(TENANT_A_ID, { code: '111111' });

    // PRECONDITION 1 — the old code is genuinely live before the resend. Without
    // this, "the old code is rejected" would be satisfied by a code that never
    // worked in the first place.
    assert.equal(await liveCode(userId), oldCode, 'fixture error: the old code is not live pre-resend');

    const res = await httpPost(port, RESEND_PATH, { email, contractorId: TENANT_A_ID });
    assert.equal(res.status, 200, `resend failed: ${res.raw}`);

    // PRECONDITION 2 — a genuinely different code now exists. Without this, an
    // endpoint that did nothing at all would pass the "new code verifies" half by
    // re-verifying the old one.
    const newCode = await liveCode(userId);
    assert.ok(newCode, 'the resend issued no code');
    assert.notEqual(newCode, oldCode, 'the resend did not change the code');

    // DIRECTION 1 — old code dead. Asserted FIRST: verifying consumes state, and a
    // successful new-code verification would mark the account verified and make this
    // assertion pass for the wrong reason.
    const withOld = await httpPost(port, VERIFY_PATH, { userId, code: oldCode });
    assert.equal(
      withOld.status, 400,
      'the superseded code still verifies. Two live 6-digit codes double the guess ' +
      'surface, and a Resend button the user can press repeatedly makes that unbounded'
    );

    // DIRECTION 2 — new code live.
    const withNew = await httpPost(port, VERIFY_PATH, { userId, code: newCode });
    assert.equal(withNew.status, 200, `the re-minted code does not verify: ${withNew.raw}`);

    const { rows } = await pool.query('SELECT email_verified FROM users WHERE id = $1', [userId]);
    assert.equal(rows[0].email_verified, true, 'a successful verification must mark the account verified');
  });

  it('leaves exactly one live code behind, however many times it is pressed', async () => {
    // The cumulative form of the rule above. A user who presses Resend three times
    // because nothing arrived must not end up with three simultaneously-valid codes.
    const referrerRouter = require('../routes/referrer');
    const limit = referrerRouter.RESEND_CODE_LIMIT;
    assert.ok(limit, 'RESEND_CODE_LIMIT is not exported yet');

    const { userId, email } = await seedPendingSignup(TENANT_A_ID, { code: '111111' });
    const ip = '10.180.180.180';   // dedicated bucket — untouched by any other test

    const presses = Math.min(3, limit.max);
    for (let i = 0; i < presses; i += 1) {
      const res = await httpPost(port, RESEND_PATH, { email, contractorId: TENANT_A_ID }, { ip });
      assert.equal(res.status, 200, `resend #${i + 1} failed: ${res.raw}`);
    }

    assert.equal(
      await liveCodeCount(userId), 1,
      `after ${presses} resends the account must hold exactly one live code`
    );
  });

  // ── 4. ALREADY VERIFIED ────────────────────────────────────────────────────

  it('a verified account gets no new code and no email', async () => {
    // Nothing to verify, so nothing to send. Left open, this is a free mailer aimed
    // at any address that has ever completed signup.
    const { userId, email } = await seedPendingSignup(TENANT_A_ID, { code: '111111', verified: true });
    await pool.query('UPDATE email_verifications SET used_at = NOW() WHERE user_id = $1', [userId]);

    const before = await liveCodeCount(userId);
    assert.equal(before, 0, 'fixture error: a verified account should hold no live code');

    const res = await httpPost(port, RESEND_PATH, { email, contractorId: TENANT_A_ID });
    assert.equal(res.status, 200, `expected the generic response, got: ${res.raw}`);

    assert.equal(await liveCodeCount(userId), 0, 'a code was issued for an already-verified account');
    assert.equal(
      sentEmails.some(e => e.to === email), false,
      'an email was sent to an already-verified account'
    );
  });

  // ── 5. NON-DISCLOSURE ──────────────────────────────────────────────────────

  it('an unknown email is answered identically to a real one, and sends nothing', async () => {
    // NON-VACUITY: the known-account leg is asserted to have actually WORKED — it
    // returns 200 and produces a live code — before its response is compared with the
    // unknown-account leg. Two identical 404s would otherwise satisfy this test while
    // proving the endpoint does not exist.
    const { userId, email: knownEmail } = await seedPendingSignup(TENANT_A_ID, { code: '111111' });

    const known = await httpPost(port, RESEND_PATH, { email: knownEmail, contractorId: TENANT_A_ID });
    assert.equal(known.status, 200, `the known-account leg failed: ${known.raw}`);
    assert.ok(await liveCode(userId), 'the known-account leg issued no code — nothing is being compared');

    const unknownEmail = `${uniq('nobody')}@test.invalid`;
    const unknown = await httpPost(port, RESEND_PATH, { email: unknownEmail, contractorId: TENANT_A_ID });

    assert.equal(
      unknown.status, known.status,
      'the status code distinguishes a registered address from an unregistered one'
    );
    assert.equal(
      unknown.raw, known.raw,
      'the response body distinguishes a registered address from an unregistered one — ' +
      'this endpoint would then be an account-enumeration oracle'
    );
    assert.equal(
      sentEmails.some(e => e.to === unknownEmail), false,
      'mail was sent to an address with no account'
    );
  });

  it('a code is never issued across tenants for a shared email address', async () => {
    // users is UNIQUE(contractor_id, email), so the same homeowner address can hold
    // an account under two contractors. An unscoped lookup would re-mint and mail the
    // wrong contractor's code — and, because the response is generic either way,
    // nothing in the response would show it.
    const sharedEmail = `${uniq('shared')}@test.invalid`;
    const { rows: aRows } = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ('Tenant A Homeowner', $1, 'x', $2, false) RETURNING id`,
      [sharedEmail, TENANT_A_ID]
    );
    const { rows: bRows } = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ('Tenant B Homeowner', $1, 'x', $2, false) RETURNING id`,
      [sharedEmail, TENANT_B_ID]
    );
    const userA = aRows[0].id;
    const userB = bRows[0].id;
    for (const uid of [userA, userB]) {
      await pool.query(
        `INSERT INTO email_verifications (user_id, code, expires_at)
         VALUES ($1, '111111', NOW() + INTERVAL '1 hour')`,
        [uid]
      );
    }

    const res = await httpPost(port, RESEND_PATH, { email: sharedEmail, contractorId: TENANT_A_ID });
    assert.equal(res.status, 200, `resend failed: ${res.raw}`);

    // NON-VACUITY: tenant A must have been served before "tenant B untouched" means
    // anything — a no-op endpoint leaves both untouched.
    const codeA = await liveCode(userA);
    assert.notEqual(codeA, '111111', "tenant A's code was not re-minted — nothing was proven about tenant B");

    assert.equal(
      await liveCode(userB), '111111',
      "tenant B's account was re-minted by a request naming tenant A"
    );
    assert.equal(await liveCodeCount(userB), 1, "tenant B's account gained an extra live code");
  });

  // ── 6. RATE LIMIT ──────────────────────────────────────────────────────────

  it('requests beyond the limit are rejected with 429', async () => {
    const referrerRouter = require('../routes/referrer');
    const limit = referrerRouter.RESEND_CODE_LIMIT;
    assert.ok(limit, 'RESEND_CODE_LIMIT is not exported yet');

    const { email } = await seedPendingSignup(TENANT_A_ID, { code: '111111' });
    const ip = '10.190.190.190';   // dedicated bucket — untouched by any other test

    for (let i = 0; i < limit.max; i += 1) {
      const res = await httpPost(port, RESEND_PATH, { email, contractorId: TENANT_A_ID }, { ip });
      assert.equal(res.status, 200, `request ${i + 1} of ${limit.max} was rejected early: ${res.raw}`);
    }

    const overLimit = await httpPost(port, RESEND_PATH, { email, contractorId: TENANT_A_ID }, { ip });
    assert.equal(
      overLimit.status, 429,
      `request ${limit.max + 1} should have been rate limited, got ${overLimit.status}`
    );
  });

  it('the limiter is keyed per IP, not globally', async () => {
    // A limiter keyed on something shared would take the signup flow down for every
    // homeowner the moment one of them pressed Resend too often.
    const referrerRouter = require('../routes/referrer');
    const limit = referrerRouter.RESEND_CODE_LIMIT;
    assert.ok(limit, 'RESEND_CODE_LIMIT is not exported yet');

    const { email: noisyEmail } = await seedPendingSignup(TENANT_A_ID, { code: '111111' });
    const noisyIp = '10.191.191.191';
    for (let i = 0; i <= limit.max; i += 1) {
      await httpPost(port, RESEND_PATH, { email: noisyEmail, contractorId: TENANT_A_ID }, { ip: noisyIp });
    }

    const { email: quietEmail } = await seedPendingSignup(TENANT_A_ID, { code: '111111' });
    const quiet = await httpPost(port, RESEND_PATH, { email: quietEmail, contractorId: TENANT_A_ID }, { ip: '10.192.192.192' });
    assert.equal(quiet.status, 200, 'one noisy IP exhausted the limiter for every other caller');
  });

  // ── 7. WHITE-LABELING (addition — see the phase report) ────────────────────

  it('the resent email carries the contractor, never the platform or a hardcoded name', async () => {
    // Not listed in the phase brief, included because this is a SECOND copy of the
    // verification email and every hardcoded-name bug Phase 2a removed from the first
    // one is one copy-paste away from reappearing here. The failure is the phishing
    // signal pinned by signupEmailWhiteLabel.test.js: a homeowner who dealt with a
    // roofer receives an email from a platform they have never heard of.
    const { email } = await seedPendingSignup(TENANT_A_ID, { code: '111111' });

    const res = await httpPost(port, RESEND_PATH, { email, contractorId: TENANT_A_ID });
    assert.equal(res.status, 200, `resend failed: ${res.raw}`);

    const sent = sentEmails.find(e => e.to === email);
    assert.ok(sent, `no email was sent to ${email}`);

    assert.ok(sent.subject.includes(COMPANY_A), `the subject must name the contractor, got: ${sent.subject}`);
    assert.ok(sent.html.includes(COMPANY_A), 'the body must name the contractor');
    assert.equal(sent.subject.includes(PLATFORM_NAME), false, 'the platform name stood in for the contractor');
    assert.equal(
      sent.html.includes('Accent Roofing Service'), false,
      'the hardcoded CONTRACTOR_NAME constant reappeared on the resend path'
    );
  });
});
