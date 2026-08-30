'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3a RED SUITE — IN-PATH BUG FIX (a)
//
// POST /api/signup/verify-email is PUBLIC and UNAUTHENTICATED. Its catch block
// (server/routes/referrer.js:823) currently answers:
//
//     res.status(500).json({ error: 'Verification failed: ' + err.message })
//
// which hands the raw internal error text to anyone on the internet. This
// violates two standing rules at once:
//
//   Security Standards  — "Error responses must never expose err.message or
//                          err.stack to the client."
//   Code Quality        — "`err.message` in `res.status(500)` responses →
//                          replace with 'Internal server error'."
//
// The sibling endpoint GET /api/invite/:slug already carries the corrected form
// (referrer.js:439-441, with the comment "Was `err.message` — leaked internals
// to the client"). This file pins the same correction one handler down.
//
// WHAT THE LEAK ACTUALLY DISCLOSES. The failure this test drives is a Postgres
// 22P02 (invalid_text_representation) raised by the first query in the handler:
// `WHERE user_id = $1` against `email_verifications.user_id`, which is an
// INTEGER column (its declaration is the first column after the primary key in
// the email_verifications CREATE TABLE block in server/db.js).
//
// ⚠ THIS USED TO READ "INTEGER NOT NULL (db.js:191)" AND BOTH HALVES WENT
// STALE IN WAVE 1.1-f. The NOT NULL was dropped so a team_member-subject row
// could exist, and the line number moved. Neither mattered to this test and
// that is exactly why it would have rotted unnoticed: THE 22P02 COMES FROM THE
// `INTEGER` TYPE, NOT FROM THE NOT NULL, so the probe still reaches the catch
// block and the file stayed green through a change that falsified its own
// explanation. Re-cited by role rather than by line for the same reason.
// Postgres phrases that as
//
//     invalid input syntax for type integer: "<the value the caller sent>"
//
// so today's response tells an unauthenticated caller the column's SQL type and
// echoes their own probe back inside a server error string. Vary the probe and
// the endpoint becomes a free schema-enumeration oracle — and the same catch
// block will happily forward a connection string, a constraint name, or a
// deadlock detail on any other internal failure.
//
// HOW THIS TEST FAILS AFTER THE FIX IS SHIPPED (the mutation check): reinstating
// any string concatenation of `err.message` into the 500 body fails the absence
// assertions below. Downgrading the handler so this probe stops reaching the
// catch block fails the non-vacuity assertion instead.
//
// NON-VACUITY. Every absence assertion in this file is preceded by
// `assert.equal(res.status, 500)`. Without it, a 404 (route unmounted), a 400
// (input rejected before the try block) or a 429 (rate limiter) would all
// contain no internal detail and the test would pass while proving nothing.
// The status assertion is what makes "the detail is absent" mean "the detail
// was suppressed" rather than "the code path never ran".
//
// NO PRODUCTION CONTRACTOR ID LITERALS (house rule) — the tenant id is
// fixture-local.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

const VERIFY_PATH = '/api/signup/verify-email';

const TENANT_A_ID = 'tnt-b4jd-internal';

// The exact value posted as `userId`. It is truthy (so it clears the handler's
// `if (!userId || !code)` guard at referrer.js:731), it is not an integer (so
// the first query raises 22P02), and it is distinctive enough that finding it
// echoed back in the response body is unambiguous evidence of a leak.
const PROBE_USER_ID = 'zz-not-an-integer-zz';

// Fragments of the Postgres error text that must never reach the client.
// Asserted individually rather than as one string so a partial leak — a handler
// that strips the quoted value but keeps the type name, say — still fails.
const LEAK_FRAGMENTS = [
  'invalid input syntax',
  'for type integer',
  PROBE_USER_ID,
];

let _counter = 0;

// Fresh IP per request. server/app.js sets `trust proxy 1`, so express-rate-limit
// keys on X-Forwarded-For; verifyEmailLimiter is 10 per 15 minutes and a shared
// bucket would 429 partway through the file for a reason unrelated to the leak.
function nextIp() {
  _counter += 1;
  return `10.84.${Math.floor(_counter / 250)}.${(_counter % 250) + 1}`;
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

describe('C/DL-2 Phase 3a — POST /api/signup/verify-email error disclosure', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $2)`,
      [TENANT_A_ID, 'Alpha Roofing Co']);
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  it('an internal failure returns no internal detail to the unauthenticated caller', async () => {
    const res = await httpPost(port, VERIFY_PATH, { userId: PROBE_USER_ID, code: '111111' });

    // ── NON-VACUITY GATE ─────────────────────────────────────────────────────
    // Proves the probe genuinely reached the catch block. A 404 would mean the
    // route is not mounted; a 400 would mean the guard rejected the input before
    // the try; a 429 would mean the limiter answered. All three would satisfy
    // every absence assertion below while testing nothing at all.
    assert.equal(
      res.status, 500,
      `the probe did not reach the handler's catch block (status ${res.status}, body ${res.raw}) — ` +
      'the disclosure assertions below would pass vacuously'
    );

    assert.ok(res.body && typeof res.body === 'object', `expected a JSON body, got: ${res.raw}`);
    assert.equal(typeof res.body.error, 'string', `expected an { error } string, got: ${res.raw}`);

    // ── THE DISCLOSURE ASSERTIONS ────────────────────────────────────────────
    // Asserted against the RAW response text, not just body.error: moving the
    // detail into a second field, or into an array, would evade a check that
    // only read body.error.
    for (const fragment of LEAK_FRAGMENTS) {
      assert.equal(
        res.raw.includes(fragment), false,
        `the 500 response leaks internal detail (${JSON.stringify(fragment)}) to an ` +
        `unauthenticated caller. Full body: ${res.raw}`
      );
    }

    // The 'Verification failed: ' prefix is the literal head of the concatenation
    // being removed. Named explicitly so that a fix which keeps the prefix and
    // merely truncates the message still fails.
    assert.equal(
      res.raw.includes('Verification failed:'), false,
      "the concatenated 'Verification failed: ' + err.message form is still in place"
    );
  });

  it('the generic 500 body matches the house convention used by its sibling handlers', async () => {
    // GET /api/invite/:slug (referrer.js:441), PUT /api/admin/settings
    // (admin/index.js:665) and requirePermission's catch (permissions.js:101) all
    // answer with exactly this object. Pinning it here keeps the public signup
    // surface from inventing a third phrasing that a future reader has to guess at.
    const res = await httpPost(port, VERIFY_PATH, { userId: PROBE_USER_ID, code: '111111' });

    assert.equal(
      res.status, 500,
      `the probe did not reach the catch block (status ${res.status}, body ${res.raw})`
    );
    assert.deepEqual(
      res.body, { error: 'Internal server error' },
      `expected the house generic 500 body, got: ${res.raw}`
    );
  });

  it('POST /api/signup leaks no internal detail either', async () => {
    // THE SIBLING DOOR. referrer.js's signup handler carried the identical
    // violation — `res.status(500).json({ error: 'Signup failed: ' + err.message })`
    // — on the same public, unauthenticated signup flow, two handlers up from
    // verify-email. Sanitising one and leaving the other is incoherent: a caller
    // probing for schema detail simply uses whichever endpoint still answers.
    //
    // The probe is the same shape as the one above. `inviteSlug` clears the
    // required-fields guard and the format validators (email, phone, password
    // length ≥ 6 are all satisfied), then reaches resolveToken, whose query is
    // where a hostile value provokes the internal failure.
    // A NUL byte. It survives JSON transport and every validator on this route,
    // then Postgres refuses it in a text parameter (22021, 'invalid byte sequence
    // for encoding UTF8: 0x00') the moment resolveToken runs its lookup.
    const probe = 'zz-signup-probe-\u0000-zz';
    const res = await httpPost(port, '/api/signup', {
      firstName: 'Probe', lastName: 'Caller',
      phone: '555-0100', email: 'probe@test.invalid',
      password: 'not-a-pin-value', inviteSlug: probe,
    });

    // ── NON-VACUITY GATE ─────────────────────────────────────────────────────
    // Identical reasoning to the verify-email test above: a 400 (validator
    // rejected the input before the try), a 404 (route unmounted) or a 429
    // (signupLimiter) would all carry no internal detail and would satisfy every
    // absence assertion below while proving nothing reached the catch block.
    assert.equal(
      res.status, 500,
      `the probe did not reach the signup handler's catch block (status ${res.status}, body ${res.raw}) — ` +
      'the disclosure assertions below would pass vacuously'
    );

    assert.ok(res.body && typeof res.body === 'object', `expected a JSON body, got: ${res.raw}`);
    assert.equal(
      res.raw.includes('Signup failed:'), false,
      "the concatenated 'Signup failed: ' + err.message form is still in place"
    );
    assert.deepEqual(
      res.body, { error: 'Internal server error' },
      `expected the house generic 500 body, got: ${res.raw}`
    );
  });

  it('a well-formed but wrong code is still answered with its own 400, not the generic 500', async () => {
    // GUARDS THE FIX AGAINST OVER-REACH. The cheapest way to make the two tests
    // above pass is to swallow everything into one generic answer. That would
    // destroy the real, useful, non-sensitive message a homeowner needs when they
    // mistype the code from their inbox — turning a recoverable typo into an
    // unexplained server error.
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ('Test Homeowner', 'verify-leak@test.invalid',
               '$2b$10$test.placeholder.hash.for.tests', $1, false)
       RETURNING id`,
      [TENANT_A_ID]
    );
    const userId = rows[0].id;

    const res = await httpPost(port, VERIFY_PATH, { userId, code: '000000' });

    assert.equal(
      res.status, 400,
      `a wrong-but-valid code must stay a 400 with actionable copy, got ${res.status}: ${res.raw}`
    );
    assert.match(
      res.body.error, /code/i,
      `the 400 must still tell the homeowner the code was the problem, got: ${res.raw}`
    );
  });
});
