'use strict';

const { Pool } = require('pg');

// STEP A — Load .env.test at module-load time, BEFORE any module that opens a pool
// is required. override: true ensures test values win over any already-set process.env.
require('dotenv').config({ path: '.env.test', override: true });

// Set a deterministic webhook HMAC secret for tests. Must be set before the webhook
// router module is required (which can happen transitively during the test run).
process.env.JOBBER_CLIENT_SECRET = 'test-secret';

// STEP B — SAFETY INTERLOCK (runs at module-load time, not deferred to initTestDb).
// Tests must only connect to localhost/127.0.0.1. Any other host aborts the process
// before a single query can reach a non-local database.
const _rawUrl = process.env.DATABASE_URL;
if (!_rawUrl) {
  throw new Error(
    'TEST SAFETY INTERLOCK: DATABASE_URL is not set.\n' +
    'Add .env.test to the project root with DATABASE_URL pointing to localhost.'
  );
}

let _hostname;
try {
  _hostname = new URL(_rawUrl).hostname;
} catch {
  throw new Error(`TEST SAFETY INTERLOCK: Cannot parse DATABASE_URL: ${_rawUrl}`);
}

if (_hostname !== 'localhost' && _hostname !== '127.0.0.1') {
  throw new Error(
    '\n\n*** TEST SAFETY INTERLOCK ***\n' +
    `DATABASE_URL points to '${_hostname}' — tests may only run against localhost or 127.0.0.1.\n` +
    'ABORTING to prevent data loss on production or staging.\n'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP B2 — RESEND SAFETY INTERLOCK (7d-0). NO TEST MAY REACH RESEND'S NETWORK.
//
// ⚠ THE EXPOSURE WAS REAL AND MEASURED, NOT HYPOTHETICAL. `.env.test` defines only DATABASE_URL,
// NODE_ENV and ENCRYPTION_KEY — no Resend key. But `server/db.js` calls `require('dotenv').config()`,
// so the moment a test transitively requires ANY mailing module, `.env` is loaded and
// `RESEND_API_KEY` becomes **the real 36-character `re_…` key**. Measured: unset after this file
// runs, SET immediately after requiring `server/middleware/errorLogger`. Every mailer then builds
// `new Resend(realKey)` successfully at module load, and the ONLY thing standing between the suite
// and a live email to a real person is each suite remembering to stub its own `_sendEmail`.
//
// ⚠ THE PROPERTY IS "no test may reach Resend", AND THE OBVIOUS MECHANISM DOES NOT ACHIEVE IT.
// Pinning the key EMPTY — the mechanism this interlock was specified as — throws at CONSTRUCTION:
// measured, `new Resend('')`, `new Resend(undefined)` and `new Resend(null)` all raise *"Missing API
// key"*. Mailers construct their client at MODULE LOAD, and `errorLogger` is required almost
// everywhere, so an empty pin aborts essentially the whole suite at import rather than at send.
// **Re-derived from the property, exactly as CLAUDE.md requires of an inherited safety measure.**
//
// ⚠ THE PROTOTYPE IS REACHED THROUGH A THROWAWAY INSTANCE because the package exports only `Resend`;
// `Emails` is not exported. Patching the prototype affects clients constructed LATER, which is what
// matters here since every mailer builds its own — verified rather than assumed.
//
// ⚠ THE MAGNITUDE, MEASURED RATHER THAN INFERRED, BY ARMING CAPTURE FOR EVERY FILE AND COUNTING.
// A full `npm run test:server` attempts **122 logical sends**, and **109 of them go to
// `admin1@roofmiles.com`** — a real mailbox, named in CLAUDE.md as the admin alert address. They are
// almost all `errorLogger`'s first-occurrence alert. Capture was used for the count rather than
// counting refusals, because a refusal is a throw and `retryWithBackoff` retries it, so refusals
// over-count a logical send several times over: the final run refused **365** times for those 122.
//
// ⚠ THE SEND COUNT IS SOLID AND THE FILE COUNT IS NOT, SO ONLY THE FIRST IS QUOTED ANYWHERE. The 122
// comes from the payloads themselves. Attributing them to files gave **36**, while the refusal ledger
// shows **34** files refusing plus **14** capturing — 48, which cannot both be right. The two methods
// disagree and it is **NOT RECONCILED**; the file attribution used `process.argv[1]`, which is the
// weaker of the two measurements. **Recorded as a discrepancy rather than averaged into a number that
// would read as measured.**
//
// ⚠ AND THE FOURTEEN SUITES THAT WENT RED WERE ONLY A SUBSET, WHICH CORRECTED MY FIRST READING TWICE.
// I read fourteen red suites as fourteen suites mailing people. Most of them already replace the
// `resend` module in `require.cache` and assert on the recorded html, so their OWN subject matter never
// went out; what escaped was code they did not know they were reaching, UNAWAITED, in one case
// completing after the test had ended. And the other 22 senders never went red at all — their caller
// swallows a send failure, which is why this exposure survived so long. **The mail is stopped in all
// 122 cases; the LOUDNESS only reaches the callers that do not catch.**
//
// ⚠ THIS WAS ALREADY FILED, TWICE, AND SAYING SO IS THE POINT. `PRE_LAUNCH_CHECKLIST.md` carries
// *"TEST-ENVIRONMENT LIVE-FIRE HAZARD — `RESEND_API_KEY` leaks into the test process"*, naming the
// mechanism and the consequence — *"sends REAL email to `admin1@roofmiles.com` on every run"* — with a
// second instance recorded for the Jobber key. It is not a discovery here; what is new is the
// measurement and a structural guard instead of a per-suite mitigation. ⚠ **That entry forbids the
// root fix in a feature session — `setup.js` not loading `.env` at all — and this is deliberately NOT
// that change.** Only `RESEND_API_KEY` is pinned; every other credential in `.env` still leaks, and
// that half of the entry stays open.
//
// INDEPENDENT GUARDS, because one that fails silently is worth little:
//
//   (1) PIN THE KEY TO AN OBVIOUS DUMMY. `dotenv.config()` does NOT override an existing value
//       (measured), and this file runs before anything loads `.env` — so the real key never enters
//       the process at all. Non-empty, so construction succeeds everywhere.
//   (2) REFUSE THE SEND, LOUDLY. `Emails.prototype.send` throws a named interlock error. This is the
//       guard that makes an accidental send FAIL A TEST rather than pass quietly, which is the whole
//       point: Resend's own client turns a transport failure into a resolved `{ data: null, error }`,
//       so a network-level block alone would be silently swallowed and the suite would stay green.
//   (3) AND A NETWORK BACKSTOP. `globalThis.fetch` refuses any request to a `resend.com` host.
//       Resend v6 sends through global `fetch` (verified). This covers what (2) cannot: a Resend
//       surface nothing calls today (`batch.send`, `emails.create`), a send invoked with a rebound
//       receiver, or a SECOND copy of the package whose prototype this file never patched.
//
// ⚠ GUARD 2 IS NARROWED ON THE RECEIVER, AND THAT IS A DISCRIMINATOR RATHER THAN AN EXEMPTION.
// `express-rate-limit`'s CommonJS interop copies properties through a getter, and that read invokes a
// property named `send` on a PLAIN OBJECT — measured 12 times in a 14-file run, with
// `this.constructor.name === 'Object'`, not `Emails`. The first writing of this interlock answered all
// 12 with a throw. A receiver that is not an `Emails` instance cannot be a Resend send, so refusing to
// fire there closes no hole — and the check is CLASS IDENTITY, never the name, because a NAME is
// exactly what collided here. A paired positive proves a real `Emails` receiver still fires.
//
// ⚠ AND WHAT THAT THROW ACTUALLY COST IS STATED AS MEASURED, BECAUSE MY FIRST WRITING OF THIS COMMENT
// OVERCLAIMED IT. It said the 12 became "unhandled rejections, twelve a run, reported as async activity
// after the test ended" — an inference from the failure text of the pre-fix gate, never measured. When
// the discriminator is injected away, four non-opted-in suites that perform the read stayed GREEN with
// **0** such reports. So the 16 pre-fix failures were the genuine post-test sends, not the interop
// read. What the discriminator is really worth is narrower and still worth having: the interlock does
// not answer a bundler's property read with a rejected promise, which cannot abort a module load and
// cannot be attributed to any test if it ever did surface. **A recorded cost is a claim like any other
// number, and this one had no source until it was injected and counted.**
//
// ⚠ AND A SUITE MAY OPT IN TO CAPTURE, WHICH IS HOW A LEGITIMATE SENDER STAYS GREEN. `captureResend()`
// records payloads and resolves; it still reaches no network. Default-deny is what matters — a suite
// that has not opted in cannot send, and a NEW one cannot start sending silently.
const RESEND_INTERLOCK_KEY = 'INTERLOCK-tests-may-not-send-email';
process.env.RESEND_API_KEY = RESEND_INTERLOCK_KEY;

// When non-null, sends are recorded and resolve instead of throwing. Armed per test file by
// captureResend(); nothing here ever reaches the network in either state.
let _resendSink = null;
const _resendNetworkAttempts = [];

// ⚠ A REFUSAL LEDGER, BECAUSE A BLOCK NOBODY SEES IS HOW 109 EMAILS A RUN SURVIVED. 22 of the 36
// sending suites never went red when the interlock arrived: their caller catches a send failure, so the
// throw is swallowed and the run stays green. The mail is stopped either way — but a mechanism that
// reports nothing is the shape this repo keeps paying for, so every refusal is recorded and one line is
// printed per file at exit. Not an assertion: some suites legitimately trigger an alert they do not
// care about, and failing them would only teach people to disarm this.
const _refusedSends = [];
process.on('exit', () => {
  if (_refusedSends.length === 0) return;
  const to = [...new Set(_refusedSends.map((s) => String((s && s.to) || '?')))].join(', ');
  process.stdout.write(
    `[resend-interlock] refused ${_refusedSends.length} send(s) to: ${to}\n` +
    '[resend-interlock] no mail left this process. If these are expected, record them with ' +
    "captureResend() from './setup'.\n"
  );
});

const { Resend: _ResendForInterlock } = require('resend');
const _interlockProbe = new _ResendForInterlock(RESEND_INTERLOCK_KEY);
const _emailsPrototype = Object.getPrototypeOf(_interlockProbe.emails);
// ⚠ THE CLASS ITSELF, NOT ITS NAME. `Emails` is not exported by the package, so it is reached through
// a throwaway instance — the same reason the prototype is.
const _EmailsClass = _interlockProbe.emails.constructor;

_emailsPrototype.send = async function interlockedResendSend(payload) {
  if (!(this instanceof _EmailsClass)) {
    // A bundler's interop read, not a send. Answer in Resend's own failure shape rather than throwing,
    // so a module load cannot be aborted and no unhandled rejection is created.
    return { data: null, error: { name: 'interlock_not_a_send', message: 'not an Emails receiver' } };
  }
  if (_resendSink) {
    _resendSink.push(payload);
    return { data: { id: 'interlock-captured' }, error: null };
  }
  _refusedSends.push(payload);
  throw new Error(
    '\n\n*** TEST SAFETY INTERLOCK ***\n' +
    'A test tried to send a REAL email through Resend.\n' +
    `  to: ${payload && payload.to}  subject: ${payload && payload.subject}\n` +
    'Tests may never reach Resend. Either stub the sending seam — e.g.\n' +
    "  router._setTestOverrides({ sendEmail: async () => ({ data: { id: 'stub' } }) })\n" +
    '— or, if this suite legitimately drives a send, record them:\n' +
    "  const { captureResend } = require('./setup'); const sent = captureResend();\n" +
    'ABORTING the send to prevent mail reaching a real person.\n'
  );
};

// GUARD 3 — the network backstop. Passes everything else straight through.
const _realFetch = globalThis.fetch;
globalThis.fetch = async function interlockedFetch(resource, init) {
  const url = String((resource && resource.url) || resource || '');
  if (/^https?:\/\/([a-z0-9-]+\.)*resend\.com(\/|$|:)/i.test(url)) {
    _resendNetworkAttempts.push(url);
    throw new Error(
      '\n\n*** TEST SAFETY INTERLOCK ***\n' +
      `A test tried to reach Resend's network directly: ${url}\n` +
      'ABORTING to prevent mail reaching a real person.\n'
    );
  }
  return _realFetch.apply(this, arguments);
};

/**
 * Arm capture for this test file: sends are recorded and resolve, and still reach no network.
 * Returns the live array of payloads. Call stopCapturingResend() to return to default-deny.
 */
function captureResend() {
  _resendSink = [];
  return _resendSink;
}

/** Disarm capture, returning what was recorded. */
function stopCapturingResend() {
  const recorded = _resendSink || [];
  _resendSink = null;
  return recorded;
}

/** Every URL a test tried to fetch from a resend.com host. Must always be empty. */
function resendNetworkAttempts() {
  return _resendNetworkAttempts.slice();
}

/** Every send this process refused. Visible so a silent block cannot pass for an absent one. */
function refusedSends() {
  return _refusedSends.slice();
}

// initTestDb() — call once in a before() hook before any tests run.
// Returns the pool backed by roofmiles_test so tests can pass it to helpers and
// to evaluateAudience(), evaluateReferral(), etc.
async function initTestDb() {
  const dbUrl = process.env.DATABASE_URL;

  // STEP C — Create roofmiles_test if it does not exist.
  // Connect to the system 'postgres' database to issue CREATE DATABASE.
  const adminUrl = dbUrl.replace(/\/[^/?]*(\?.*)?$/, '/postgres');
  const adminPool = new Pool({ connectionString: adminUrl });
  try {
    await adminPool.query('CREATE DATABASE roofmiles_test');
  } catch (err) {
    if (err.code !== '42P04') throw err; // 42P04 = duplicate_database — already exists, fine
  } finally {
    await adminPool.end();
  }

  // STEP D — Wipe public schema so every run starts from a truly empty database.
  const wipePool = new Pool({ connectionString: dbUrl });
  try {
    await wipePool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await wipePool.query('CREATE SCHEMA public');
  } finally {
    await wipePool.end();
  }

  // STEP E — Create pg_trgm extension.
  // db.js does not create it; contacts.js does at module load but is not required here.
  const extPool = new Pool({ connectionString: dbUrl });
  try {
    await extPool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  } finally {
    await extPool.end();
  }

  // STEP F — Now require db.js (pool already points to roofmiles_test via DATABASE_URL set above)
  // and run initDB() to create the full schema via the idempotent migrations.
  const { pool, initDB } = require('../db');
  await initDB();

  return pool;
}

module.exports = {
  initTestDb, captureResend, stopCapturingResend, resendNetworkAttempts, refusedSends,
};
