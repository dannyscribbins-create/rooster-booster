'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3d-1 RED SUITE — POST /api/login ERROR DISCLOSURE
//
// THE MISSED DOOR. Phase 3a swept `err.message` out of the two public signup
// handlers and left this one standing. server/routes/referrer.js:1250 still
// answers:
//
//     res.status(500).json({ error: 'Login failed: ' + err.message })
//
// on a PUBLIC, UNAUTHENTICATED endpoint. Same violation, same file, same
// unauthenticated surface, three handlers down — and the two comments Phase 3a
// left behind (referrer.js:734-738, :838-846) both explain at length why the
// concatenated form had to go, while this third instance sat untouched between
// them. Fixing one door and leaving another open is incoherent: a caller probing
// for internal detail simply uses whichever endpoint still answers.
//
//   Security Standards — "Error responses must never expose err.message or
//                         err.stack to the client."
//   Code Quality       — "`err.message` in `res.status(500)` responses →
//                         replace with 'Internal server error'."
//
// WHAT THE PROBE DOES. A NUL byte reaches a text parameter in the candidate
// lookup, and Postgres refuses it: 22021, `invalid byte sequence for encoding
// "UTF8": 0x00`. That lands in the catch block, where the original bug
// concatenated it into the response. This is the same probe shape
// verifyEmailErrorDisclosure.test.js uses against /api/signup, and it is chosen
// because it fails inside the try rather than at a validator.
//
// ── THE PROBE MOVED AT C/DL-3b PHASE 2B, AND THE PREMISE DID NOT ────────────
// It used to ride in `contractorSlug`, whose only job was to be truthy enough to
// clear `if (!contractorSlug) return 400` before reaching the query. D1 retires
// that field entirely (Tenant Rebuild §3.5), so a NUL there now reaches no query
// at all, produces no 500, and would leave every absence assertion below passing
// vacuously. The NON-VACUITY GATE is what catches that — it did, loudly, rather
// than letting this file quietly stop testing anything.
//
// It now rides in `email`, which the unified login still binds to
// `LOWER(email) = LOWER($1)`. Same 22021, same catch block, same premise.
//
// ⚠ THIS TEST DEPENDS ON /api/login HAVING NO isEmail() VALIDATOR. One would
// answer before the handler and the probe would never reach the catch block. Its
// deliberate absence is documented at the route itself; the two comments are a
// matched pair and neither should be removed without the other.
//
// WHY THIS PHASE. The landing page's whole job is to create accounts, and the
// login endpoint is the door those accounts walk back through. Shipping a
// server-rendered public surface while the sibling handler on the same router
// hands out Postgres internals is not a defensible combination.
//
// NON-VACUITY. Every absence assertion here is preceded by an assertion that the
// response was a 500. Without it, a 400 (guard rejected the input), a 404 (route
// unmounted) or a 429 (referrerLoginLimiter, 10 per 15 minutes) would each carry
// no internal detail and the test would pass while proving nothing. The status
// assertion is what makes "the detail is absent" mean "the detail was
// suppressed" rather than "the code path never ran".
//
// NO PRODUCTION CONTRACTOR ID LITERALS (house rule) — the tenant is fixture-local.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const bcrypt = require('bcrypt');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

const LOGIN_PATH = '/api/login';

const TENANT_A = 'tnt-login-disclosure-a';

// Provokes 22021 in the candidate lookup. Shaped like an address so that if a
// format check is ever added upstream it fails on the NUL rather than on the
// shape, keeping the reason for any future breakage unambiguous.
const PROBE_EMAIL = 'zz-login-probe-\u0000-zz@test.invalid';

// Fragments of the Postgres error text that must never reach an unauthenticated
// caller. Asserted individually rather than as one string so a partial leak — a
// handler that strips the byte value but keeps the encoding name — still fails.
const LEAK_FRAGMENTS = [
  'invalid byte sequence',
  'encoding',
  'UTF8',
];

// A real bcrypt hash. The shared seedUser() helper inserts a placeholder string
// that is not a valid hash, and bcrypt.compare against it would land in the catch
// block — turning the over-reach guard below into an accidental second copy of
// the leak test instead of the counterweight it is meant to be.
const REAL_PASSWORD = 'correct-horse-battery';
const WRONG_PASSWORD = 'definitely-not-it';

let _counter = 0;
function nextIp() {
  _counter += 1;
  return `10.86.${Math.floor(_counter / 250)}.${(_counter % 250) + 1}`;
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

describe('C/DL-2 Phase 3d-1 — POST /api/login error disclosure', () => {
  let pool, server, port, realUserEmail;

  before(async () => {
    pool = await initTestDb();
    await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $2)`, [TENANT_A, 'Alpha Roofing Co']);
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, $2)`,
      [TENANT_A, 'Alpha Roofing Co']
    );

    realUserEmail = 'login-disclosure@test.invalid';
    const hash = await bcrypt.hash(REAL_PASSWORD, 10);
    await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ('Test Homeowner', $1, $2, $3, true)`,
      [realUserEmail, hash, TENANT_A]
    );

    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  it('[RED] an internal failure returns no internal detail to the unauthenticated caller', async () => {
    const res = await httpPost(port, LOGIN_PATH, {
      email: PROBE_EMAIL, pin: 'whatever',
    });

    // ── NON-VACUITY GATE ─────────────────────────────────────────────────────
    // Proves the probe genuinely reached the catch block. A 400 or 422 would mean
    // a validator answered before the try (see the isEmail() note in the header);
    // a 401 would mean the lookup ran and matched nothing; a 404 would mean the
    // route is unmounted; a 429 would mean the limiter answered. All of them
    // satisfy every absence assertion below while testing nothing at all.
    assert.equal(
      res.status, 500,
      `the probe did not reach the login handler's catch block (status ${res.status}, body ${res.raw}) — ` +
      'the disclosure assertions below would pass vacuously'
    );

    assert.ok(res.body && typeof res.body === 'object', `expected a JSON body, got: ${res.raw}`);
    assert.equal(typeof res.body.error, 'string', `expected an { error } string, got: ${res.raw}`);

    // ── THE DISCLOSURE ASSERTIONS ────────────────────────────────────────────
    // Against the RAW response text, not just body.error: moving the detail into a
    // second field, or into an array, would evade a check that only read body.error.
    for (const fragment of LEAK_FRAGMENTS) {
      assert.equal(
        res.raw.includes(fragment), false,
        `the 500 response leaks internal detail (${JSON.stringify(fragment)}) to an ` +
        `unauthenticated caller. Full body: ${res.raw}`
      );
    }

    // The literal head of the concatenation being removed. Named explicitly so a
    // "fix" that keeps the prefix and merely truncates the message still fails.
    assert.equal(
      res.raw.includes('Login failed:'), false,
      "the concatenated 'Login failed: ' + err.message form is still in place at referrer.js:1250"
    );
  });

  it('[RED] the generic 500 body matches the house convention its siblings already use', async () => {
    // POST /api/signup, POST /api/signup/verify-email and GET /api/invite/:slug —
    // all on this same router — answer with exactly this object. A third phrasing
    // on the same public surface is a thing future readers have to guess at.
    const res = await httpPost(port, LOGIN_PATH, {
      email: PROBE_EMAIL, pin: 'whatever',
    });

    assert.equal(
      res.status, 500,
      `the probe did not reach the catch block (status ${res.status}, body ${res.raw})`
    );
    assert.deepEqual(
      res.body, { error: 'Internal server error' },
      `expected the house generic 500 body, got: ${res.raw}`
    );
  });

  it('[GREEN-by-design] the 500 body carries exactly one field, so detail cannot hide in a second', async () => {
    // GREEN ON ARRIVAL, and labelled rather than contorted into a false RED.
    // Today's leaking body is already `{ error: '...' }` — a single key — so this
    // says nothing about the current bug. It is a COUNTERWEIGHT aimed at one
    // specific bad fix: sanitising `error` while moving the real message into a
    // sibling field (`detail`, `code`, `hint`, a `stack` array), which would
    // satisfy every absence assertion above while disclosing exactly as much.
    //
    // ── THIS TEST PREVIOUSLY ASSERTED `res.raw.length < 200` AND WAS VACUOUS ──
    // The leaking response is 74 bytes, so the length heuristic passed while the
    // leak was fully present. It is recorded here because it is the exact failure
    // mode the phase brief warned about twice, and because a byte-length proxy for
    // "contains no internals" is never a real assertion — a shorter leak passes it
    // and a longer legitimate message fails it. Replaced with a structural check.
    const res = await httpPost(port, LOGIN_PATH, {
      email: PROBE_EMAIL, pin: 'whatever',
    });

    assert.equal(res.status, 500, `precondition: the probe must reach the catch block, got ${res.status}: ${res.raw}`);
    assert.ok(res.body && typeof res.body === 'object', `precondition: expected a JSON object, got: ${res.raw}`);
    assert.deepEqual(
      Object.keys(res.body), ['error'],
      `the 500 body must carry exactly one field. Extra fields are where suppressed detail ` +
      `reappears. Got keys: ${JSON.stringify(Object.keys(res.body))} — body: ${res.raw}`
    );
  });

  // ── OVER-REACH GUARD ───────────────────────────────────────────────────────

  it('[GREEN-by-design] a genuinely wrong password still gets its own actionable 401, not a generic 500', async () => {
    // GUARDS THE FIX AGAINST OVER-REACH, and matches the shape used for
    // verify-email's wrong-code case.
    //
    // The cheapest way to make every test above pass is to funnel the whole
    // handler into one generic answer. That would destroy the real, useful,
    // non-sensitive message a person needs when they mistype their password —
    // turning a recoverable typo into an unexplained server error, on the login
    // screen, which is the worst possible place for one.
    //
    // The 401 is also deliberately NON-ENUMERATING: it says "Invalid email or
    // PIN" for both a wrong password and an unknown address, so it stays
    // actionable without confirming which accounts exist. Both halves are
    // asserted below.
    const res = await httpPost(port, LOGIN_PATH, {
      email: realUserEmail, pin: WRONG_PASSWORD,
    });

    assert.equal(
      res.status, 401,
      `a wrong password must stay a 401 with actionable copy, got ${res.status}: ${res.raw}`
    );
    assert.notEqual(res.status, 500, 'a wrong password is not a server error');
    assert.match(
      res.body.error, /email|pin|password/i,
      `the 401 must still tell the person what was wrong, got: ${res.raw}`
    );
  });

  it('[GREEN-by-design] an unknown email gets the SAME 401 as a wrong password', async () => {
    // The non-enumeration counterweight to the test above. If the fix made the
    // wrong-password case more specific in order to stay "actionable", it would
    // turn the login endpoint into an account-enumeration oracle. The two answers
    // must be indistinguishable.
    const wrongPass = await httpPost(port, LOGIN_PATH, {
      email: realUserEmail, pin: WRONG_PASSWORD,
    });
    const unknownEmail = await httpPost(port, LOGIN_PATH, {
      email: 'no-such-person@test.invalid', pin: WRONG_PASSWORD,
    });

    assert.equal(wrongPass.status, 401, `precondition: wrong password must be 401, got ${wrongPass.raw}`);
    assert.equal(unknownEmail.status, 401, `precondition: unknown email must be 401, got ${unknownEmail.raw}`);
    assert.deepEqual(
      unknownEmail.body, wrongPass.body,
      'an unknown email and a wrong password must be indistinguishable — otherwise this is an enumeration oracle'
    );
  });

  it('[GREEN-by-design] a successful login still works — the fix must not break the door', async () => {
    // The broadest counterweight in the file. Every assertion above is about
    // failure paths; this one proves the handler still authenticates, so a fix
    // that made the catch block generic by breaking the try block would not pass.
    const res = await httpPost(port, LOGIN_PATH, {
      email: realUserEmail, pin: REAL_PASSWORD,
    });

    assert.equal(res.status, 200, `a correct password must still log in, got ${res.status}: ${res.raw}`);
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.token, 'string', 'a session token must still be issued');
    assert.equal(res.body.token.length, 64, 'session tokens are 64-char hex from 32 random bytes');
  });
});
