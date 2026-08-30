'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 1.1-g — TEAM CREDENTIAL RECOVERY
//
// Team members had no credential recovery path at all. Wave 1.1-f landed the
// schema — a nullable team_member_id plus an exactly_one_subject CHECK on
// pin_reset_tokens, verification_codes and email_verifications — and nothing
// read or wrote the column. This suite is the resolver's fence.
//
// ⚠ THE DEFECT IS SHARPER THAN "NO RECOVERY PATH", AND THE FRAMING MATTERS.
// Since C/DL-3b Phase 5 unified the door, src/components/auth/LoginScreen.jsx
// has shipped a forgot-password sub-form for EVERY role. A team member types
// their address, is told "if that email is registered, you'll receive a reset
// link shortly", and receives nothing — because POST /api/forgot-pin queries
// `users` only. The path is OFFERED and the request is SILENTLY DISCARDED.
// That is a promise the server does not keep, on a credential surface.
//
// ── THE TWO LOAD-BEARING CONSTRAINTS, NAMED AT EVERY ASSERTION ──────────────
// A RESET MUST NOT BECOME A 2FA BYPASS: the path mints nothing (see the
//   "mints nothing" test). There is no second factor anywhere in this codebase
//   today (SH-10: storage, editor and validator built; DELIVERY absent), so a
//   session minted here would skip a check that does not exist yet — and would
//   silently acquire the ability to skip one the day it does. Issuing no
//   session makes that structurally impossible rather than currently harmless.
// A RESET MUST NOT BECOME AN ACCOUNT-ENUMERATION ORACLE: this is the ISSUANCE
//   half's constraint and its assertions arrive with the issuance commit. What
//   redemption owes it is below — the frozen branch answers 403 only to a caller
//   already holding a valid token, never to one merely asking.
//
// ⚠ THIS FILE IS THE REDEMPTION HALF ONLY. POST /api/forgot-pin still queries
// `users` alone; the issuance commit adds Group A beside Group B here. Nothing
// in the working tree mints a team_member-subject token yet, which is why this
// commit is INERT IN PRODUCTION while being the fix that must land first.
//
// ── NO TEST MAY SEND EMAIL — THE PROPERTY, AND THE MECHANISM RE-DERIVED ─────
// ⚠ THIS ROUTER EXPORTS A SEAM THAT DOES NOT COVER THESE ROUTES, AND REACHING
// FOR IT IS THE OBVIOUS MISTAKE. server/routes/referrer.js's
// _setTestOverrides({ sendEmail }) redirects `_sendEmail`, which has exactly
// two call sites, BOTH on the cashout path. POST /api/forgot-pin calls
// resend.emails.send() DIRECTLY. Pinning the seam here would be a measure that
// works on a neighbouring path and does nothing on this one — the Wave 1.1-c
// to 1.1-d failure, one router over.
//
// ⚠ AND THE ENV-VAR FORM DOES NOT HOLD EITHER. server/routes/referrer.js
// constructs `new Resend(process.env.RESEND_API_KEY)` at MODULE LOAD, and a
// missing key does not reliably prevent a send() — it produces a 401 after the
// request has already left. Emptying the key is a mechanism; "no network-capable
// client is ever constructed" is the property.
//
// THE MECHANISM: replace the `resend` module in require.cache BEFORE anything
// that constructs a client is required. Pattern from
// server/test/unifiedForgotPin.test.js and forgotPinEmailEscaping.test.js.
//
// ⚠ AND ITS NON-VACUITY PROOF IS POSITIVE, NEVER NEGATIVE. An uninstalled stub
// produces sentEmails.length === 0, which is INDISTINGUISHABLE from a correct
// "no mail sent" on every negative test in this file. The guard is proven by
// the known-good referrer reset pushing exactly one payload, addressed
// correctly, carrying the contractor name in its html — that is what proves the
// stub sits on the real path rather than beside it.
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
const bcrypt = require('bcrypt');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');

const FORGOT = '/api/forgot-pin';
const RESET = '/api/reset-pin';
const LOGIN = '/api/login';

const TENANT_A = 'tnt-recov-a';
const TENANT_B = 'tnt-recov-b';
const NAME_A = 'Alpha Recovery Roofing';
const NAME_B = 'Beta Recovery Exteriors';

const NEW_PASSWORD = 'a-brand-new-password-1';

// ⚠ REGEX LIVES IN THIS FILE, NEVER IN A SHELL ONE-LINER (CLAUDE.md — a shell
// harness lies plausibly). `\d` inside a shell-quoted pattern reaches Node as
// the letter `d`, and the resulting wrong answer arrives without an error.
//
// The cost factor is the SECOND capture position in a modular-crypt bcrypt
// hash: $2b$12$<22-char salt><31-char digest>. Both variants of the algorithm
// tag are admitted ($2a$/$2b$/$2y$) because that byte is a library detail and
// pinning it would make this test fail on a bcrypt upgrade that changed
// nothing about the cost.
const COST_12 = /^\$2[aby]\$12\$/;
const COST_10 = /^\$2[aby]\$10\$/;
const SIXTY_FOUR_HEX = /[0-9a-f]{64}/;

// forgotPinLimiter is 3 per 15 minutes PER IP (server/routes/referrer.js).
// Several tests below issue more than three requests, so every request carries
// its own X-Forwarded-For. Without this the fourth request in a test would be
// refused by the limiter and the refusal would look exactly like the defect.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.96.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpPost(port, routePath, bodyObj) {
  const payload = Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path: routePath, method: 'POST',
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

async function seedReferrer(contractorId, email, { password = 'placeholder-password' } = {}) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
     VALUES ('Recovery Referrer', $1, $2, $3, true)
     RETURNING id`,
    [email, hash, contractorId]
  );
  return rows[0].id;
}

async function seedTeamMember(contractorId, email, { active = true, tier = 'admin' } = {}) {
  // Cost 12, matching every other team_members writer — server/routes/admin/team.js
  // (create and accept-invite) and server/db.js's two seed paths. The suite has
  // to start from the real cost or the cost assertion below proves nothing.
  const hash = await bcrypt.hash('placeholder-password', 12);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, full_name, tier, permissions, active)
     VALUES ($1, $2, $3, 'Recovery Member', $4, '{}'::jsonb, $5)
     RETURNING id`,
    [contractorId, email, hash, tier, active]
  );
  return rows[0].id;
}

// Mints a pin_reset_tokens row DIRECTLY, bypassing POST /api/forgot-pin.
//
// ⚠ THIS IS DELIBERATE AND IT IS WHAT MAKES THE REDEMPTION TESTS MEAN ANYTHING.
// If they obtained their token from forgot-pin, every one of them would go RED
// for ISSUANCE's reason — forgot-pin does not query team_members — and none
// would say anything about the redemption defect. Seeding directly isolates the
// two, so each failure is attributable to exactly one cause. The schema has
// permitted a team_member-subject row since Wave 1.1-f.
async function mintToken({ userId = null, teamMemberId = null, token, expiresIn = "1 hour" }) {
  await pool.query(
    `INSERT INTO pin_reset_tokens (user_id, team_member_id, token, expires_at)
     VALUES ($1, $2, $3, NOW() + $4::interval)`,
    [userId, teamMemberId, token, expiresIn]
  );
}

function emailsTo(address) {
  return sentEmails.filter(e => e.to === address);
}

async function teamHash(id) {
  const { rows } = await pool.query('SELECT password_hash FROM team_members WHERE id = $1', [id]);
  return rows[0].password_hash;
}

async function userHash(id) {
  const { rows } = await pool.query('SELECT pin FROM users WHERE id = $1', [id]);
  return rows[0].pin;
}

async function tokenRow(token) {
  const { rows } = await pool.query(
    'SELECT user_id, team_member_id, used_at, expires_at FROM pin_reset_tokens WHERE token = $1',
    [token]
  );
  return rows[0] || null;
}

async function sessionCount() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM sessions');
  return rows[0].n;
}

describe('Wave 1.1-g — team credential recovery', () => {
  before(async () => {
    // ⚠ ONE POOL PER FILE, NOT PER describe. initTestDb() returns the server/db.js
    // pool SINGLETON, so a second describe calling it in before() and pool.end()
    // in after() kills the pool its sibling is about to use — which surfaces as
    // CANCELLED tests during setup, contributing to neither the pass nor the fail
    // column. That is the Wave 1.1-b incident; this file has exactly one pair.
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    sentEmails.length = 0;
    await pool.query('DELETE FROM pin_reset_tokens');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM super_admins');
    await pool.query('DELETE FROM contractors WHERE id LIKE $1', ['tnt-recov-%']);
    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);
    await pool.query('UPDATE contractor_settings SET company_name = $1 WHERE contractor_id = $2', [NAME_A, TENANT_A]);
    await pool.query('UPDATE contractor_settings SET company_name = $1 WHERE contractor_id = $2', [NAME_B, TENANT_B]);
  });

  // ══ GROUP B — REDEMPTION (POST /api/reset-pin), tokens seeded directly ═════

  it('B1 [RED] R3.1 — a team_member-subject token is FOUND, not dropped by the INNER JOIN', async () => {
    // 🔴 THE RECORDED RED IS 400 {"error":"Reset link is invalid or has expired."}
    // — byte-identical to a genuine expiry, which is why this test may never
    // assert merely "it failed". server/routes/referrer.js's token lookup joins
    // `JOIN users u ON u.id = prt.user_id`; a NULL user_id drops the row.
    const email = 'b1-team@recov.test';
    const memberId = await seedTeamMember(TENANT_A, email);
    const token = 'b1'.padEnd(64, '0');
    await mintToken({ teamMemberId: memberId, token });

    // ⚠ EXPIRY EXCLUDED BY CONSTRUCTION, NOT BY HOPE. "Invalid or expired" is this
    // surface's answer to everything, so the test proves the token was live at the
    // moment of the request before it interprets the answer.
    const before = await tokenRow(token);
    assert.ok(before.expires_at > new Date(), 'precondition: the seeded token is unexpired');
    assert.equal(before.used_at, null, 'precondition: the seeded token is unused');

    const res = await httpPost(port, RESET, { token, pin: NEW_PASSWORD });

    assert.equal(res.status, 200, `expected the token to resolve; got ${res.status} ${res.raw}`);
    assert.equal(res.body.success, true, 'the handler must report success');

    const after = await tokenRow(token);
    assert.notEqual(
      after.used_at, null,
      'the token was not burned — it resolved but the redemption did not complete'
    );
  });

  it('B2 [RED] the team member password actually changes', async () => {
    // ⚠ A DIFFERENT FAILURE FROM B1, AND THE SPLIT IS DELIBERATE. Fixing only the
    // JOIN leaves `UPDATE users SET pin=$1 WHERE id=$2` running with a NULL id:
    // zero rows updated, no error raised, token burned, success: true returned.
    // B1 would go GREEN while the password never changed — a FALSE SUCCESS on a
    // credential path, strictly worse than the silent rejection it replaced.
    // These two assertions are what make that state visible.
    const email = 'b2-team@recov.test';
    const memberId = await seedTeamMember(TENANT_A, email);
    const token = 'b2'.padEnd(64, '0');
    await mintToken({ teamMemberId: memberId, token });

    const hashBefore = await teamHash(memberId);
    const res = await httpPost(port, RESET, { token, pin: NEW_PASSWORD });
    assert.equal(res.status, 200, res.raw);

    const hashAfter = await teamHash(memberId);
    assert.notEqual(hashAfter, hashBefore, 'the stored password_hash did not change');
    assert.ok(
      await bcrypt.compare(NEW_PASSWORD, hashAfter),
      'the stored hash does not verify against the new password'
    );
  });

  it('B3 [RED] the cost factor follows the SUBJECT, not the route', async () => {
    // 🔴 server/routes/referrer.js hardcodes bcrypt.hash(String(pin), 10) — the
    // `users` cost. team_members hash at 12 EVERYWHERE ELSE: admin/team.js's
    // create and accept-invite, and db.js's two seed paths. A team member who
    // reset through the unmodified handler would be silently downgraded from cost
    // 12 to cost 10, with nothing reporting it.
    //
    // ⚠ THE PAIRING IS THE TEST. Asserting 12 alone goes GREEN against an
    // implementation that raised EVERY reset to 12 — a live-traffic change to the
    // referrer path nobody asked for. Both halves pin the actual property.
    const teamEmail = 'b3-team@recov.test';
    const userEmail = 'b3-user@recov.test';
    const memberId = await seedTeamMember(TENANT_A, teamEmail);
    const userId = await seedReferrer(TENANT_A, userEmail);

    const teamToken = 'b3a'.padEnd(64, '0');
    const userToken = 'b3b'.padEnd(64, '0');
    await mintToken({ teamMemberId: memberId, token: teamToken });
    await mintToken({ userId, token: userToken });

    assert.equal((await httpPost(port, RESET, { token: teamToken, pin: NEW_PASSWORD })).status, 200);
    assert.equal((await httpPost(port, RESET, { token: userToken, pin: NEW_PASSWORD })).status, 200);

    const storedTeam = await teamHash(memberId);
    const storedUser = await userHash(userId);

    assert.match(
      storedTeam, COST_12,
      `a team member reset stored ${storedTeam.slice(0, 7)} — team_members hash at cost 12 ` +
      'everywhere else, so this silently weakened the credential.'
    );
    assert.match(
      storedUser, COST_10,
      `a referrer reset stored ${storedUser.slice(0, 7)} — raising the users cost is a ` +
      'live-traffic change that was not asked for.'
    );
  });

  it('B4 [RED] the reset MINTS NOTHING — no session row, no token in the body', async () => {
    // 🔴 A RESET MUST NOT BECOME A 2FA BYPASS. There is no second factor anywhere
    // in this codebase today, so a session minted here would skip a check that
    // does not exist yet — and would acquire the ability to skip one the day it
    // does. Issuing nothing makes that structurally impossible rather than
    // currently harmless.
    const email = 'b4-team@recov.test';
    const memberId = await seedTeamMember(TENANT_A, email);
    const token = 'b4'.padEnd(64, '0');
    await mintToken({ teamMemberId: memberId, token });

    const before = await sessionCount();
    const res = await httpPost(port, RESET, { token, pin: NEW_PASSWORD });
    assert.equal(res.status, 200, res.raw);

    assert.equal(await sessionCount(), before, 'the reset path wrote a sessions row');
    assert.equal(res.body.token, undefined, 'the response body carries a token');
    assert.ok(
      !SIXTY_FOUR_HEX.test(res.raw),
      `the response body carries a 64-hex value: ${res.raw}`
    );

    // ⚠ NON-VACUITY. "sessions did not grow" is also what a broken counter
    // reports. A real login through the SAME counter must grow it, or the three
    // assertions above are measuring nothing.
    const login = await httpPost(port, LOGIN, { email, password: NEW_PASSWORD });
    assert.equal(login.status, 200, `positive control: the new password must log in — ${login.raw}`);
    assert.equal(
      await sessionCount(), before + 1,
      'POSITIVE CONTROL FAILED: a real login did not grow the session count either, so the ' +
      'assertion above proves nothing about the reset path.'
    );
  });

  it('B5 [RED] a deactivated member is stopped AT REDEMPTION, and the token is NOT burned', async () => {
    // E1. 403 with the frozen-account body, not a generic 400 — and the standard
    // is the one already in use, not a new one: a caller holding a valid 64-hex
    // token has proven mailbox possession, which is the identical proof that
    // licenses naming the contractor in the reset email's body.
    //
    // ⚠ THE NON-BURN IS DELIBERATE AND IT IS WHY IT IS ASSERTED. A later reader
    // will see an unburned token on a rejected redemption and "fix" it. Burning
    // here would mean a member reactivated an hour later has to request a second
    // link for no security gain — the rejection disclosed nothing a burn protects.
    const email = 'b5-frozen@recov.test';
    const memberId = await seedTeamMember(TENANT_A, email, { active: false });
    const token = 'b5'.padEnd(64, '0');
    await mintToken({ teamMemberId: memberId, token });

    const hashBefore = await teamHash(memberId);
    const res = await httpPost(port, RESET, { token, pin: NEW_PASSWORD });

    // ⚠ ASSERT WHY, NOT THAT. A 400 here would ALSO be a rejection, and would
    // ALSO leave the password unchanged — while meaning the token was never
    // resolved at all, which is the B1 defect wearing this test's costume.
    assert.equal(res.status, 403, `expected the frozen answer, got ${res.status} ${res.raw}`);
    assert.equal(res.body.error, 'account_frozen', `wrong rejection: ${res.raw}`);
    assert.ok(res.body.branding, 'the frozen body must carry branding for the screen');

    assert.equal(await teamHash(memberId), hashBefore, 'a frozen member had their password changed');
    assert.equal(
      (await tokenRow(token)).used_at, null,
      'the token was burned on a frozen rejection — it must survive for use after reactivation'
    );
  });

  it('B6 POSITIVE CONTROL — an ordinary referrer reset still works end to end', async () => {
    // ⚠ ORDERED LAST BUT LOAD-BEARING FOR EVERY NEGATIVE ABOVE. A path that
    // rejected everything would satisfy most of them. This drives the whole
    // referrer journey — request, mint, redeem, log in — and observes each step.
    const email = 'b6-user@recov.test';
    const userId = await seedReferrer(TENANT_A, email);

    const forgot = await httpPost(port, FORGOT, { email });
    assert.equal(forgot.status, 200, forgot.raw);

    const sent = emailsTo(email);
    assert.equal(sent.length, 1, 'the referrer must receive exactly one reset email');
    assert.ok(sent[0].html.includes(NAME_A), 'the email must name the contractor');

    const { rows } = await pool.query(
      'SELECT token FROM pin_reset_tokens WHERE user_id = $1', [userId]
    );
    assert.equal(rows.length, 1, 'the referrer must get exactly one token');

    const reset = await httpPost(port, RESET, { token: rows[0].token, pin: NEW_PASSWORD });
    assert.equal(reset.status, 200, reset.raw);
    assert.equal(reset.body.success, true);

    const login = await httpPost(port, LOGIN, { email, password: NEW_PASSWORD });
    assert.equal(login.status, 200, `the new password must log in — ${login.raw}`);
    assert.equal(login.body.role, 'referrer');
  });

  it('B7 a genuinely expired team_member-subject token is still refused, and refused as expired', async () => {
    // The fence on the fix. Making the JOIN find team_member rows must not make it
    // find EXPIRED ones — and the rejection must leave the token unburned and the
    // password untouched, which is what distinguishes "expired" from "resolved
    // then failed".
    //
    // ⚠ GREEN IN THE RED STATE — THE THIRD ONE IN THIS FILE, AND THE ONLY ONE THAT
    // IS GREEN FOR THE WRONG REASON. Before the fix this passes because the INNER
    // JOIN drops the row, not because the token expired; the two are byte-identical
    // on the wire, which is the whole defect. Measured: it passed in both the RED
    // run and the reverted guard-proof. Its value is entirely POST-fix, where it is
    // the only thing standing between "the join now finds team members" and "the
    // join now finds expired team members too".
    const email = 'b7-team@recov.test';
    const memberId = await seedTeamMember(TENANT_A, email);
    const token = 'b7'.padEnd(64, '0');
    await mintToken({ teamMemberId: memberId, token, expiresIn: '-1 hour' });

    const hashBefore = await teamHash(memberId);
    const res = await httpPost(port, RESET, { token, pin: NEW_PASSWORD });

    assert.equal(res.status, 400, res.raw);
    assert.equal(res.body.error, 'Reset link is invalid or has expired.');
    assert.equal(await teamHash(memberId), hashBefore, 'an expired token changed the password');
    assert.equal((await tokenRow(token)).used_at, null, 'an expired token was burned');
  });
});
