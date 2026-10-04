'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WHAT A FRONTEND CRASH LOOKS LIKE IN `error_log` (post-N4 cleanup C)
//
// Danny's ruling 1 (2026-10-03), three parts and no fourth:
//   · an error-boundary catch is CLASSIFIED CRITICAL for triage, REGARDLESS of route;
//   · the componentStack is KEPT instead of discarded;
//   · `/api/log-client-error` reads the session's contractor when a session exists, falling back
//     exactly as before when none does.
//
// ⚠ ALERT CADENCE IS DELIBERATELY UNCHANGED AND A CASE PINS THAT. `sendErrorAlert` already fires on
// first occurrence and every 10th for EVERY severity, so severity is a TRIAGE label and nothing
// more. Anyone reading "CRITICAL" as "now emails more" has it backwards, which is why the absence of
// a cadence change is asserted rather than assumed.
//
// ⚠ AND THE DEFECT THESE CASES EXIST FOR WAS STRUCTURAL, NOT A WRONG CONSTANT. `classifySeverity`
// grades by ROUTE needles — `/cashout`, `/stripe`, `/admin` — and a frontend crash's "route" is the
// browser pathname. So an error boundary catching on `/` (a whole page gone) scored INFO, while the
// identical crash on `/cashout` scored CRITICAL. **The grade described where the user was standing,
// not what happened.**
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb, captureResend } = require('./setup');
const {
  seedContractor, seedUser, seedSession, httpPost, startTestServer, stopTestServer,
} = require('./helpers');
const { createApp } = require('../app');

const TENANT = 'cec-tenant';
const OTHER = 'cec-other';
// ⚠ RETIRED BY CLEANUP D1 AND KEPT AS A FENCE RATHER THAN DELETED. `const PHANTOM =
// 'accent-roofing'` was the hardcoded fallback in `errorLogger.js`, and three cases below asserted
// rows landed on it. **That was correct about the old design and is now forbidden** — Danny's ruling
// 2: an error with genuinely no tenant is filed under an explicit `'platform'`, never a fake
// contractor id. The constant stays so the cases can assert the phantom is ABSENT, which is a
// stronger claim than simply naming the new value.
const PHANTOM = 'accent-roofing';
const { PLATFORM_TENANT } = require('../middleware/errorLogger');

let pool;
let server;
let port;

before(async () => {
  pool = await initTestDb();
  // ⚠ THIS SUITE LEGITIMATELY DRIVES SENDS, SO IT OPTS IN RATHER THAN BEING REFUSED — AND THAT IS
  // ALSO A SPEED FIX WORTH RECORDING. Every row it writes is a FIRST OCCURRENCE, and
  // `sendErrorAlert` emails on first occurrence for every severity, so without this the 7d-0
  // interlock refuses each send, `retryWithBackoff` retries it with backoff, and the suite spent
  // **~14 seconds per describe** waiting on retries of mail it never wanted to send.
  // `captureResend()` records them instead, which is the sanctioned opt-in.
  captureResend();
  ({ server, port } = await startTestServer(createApp()));
});

after(async () => {
  if (server) await stopTestServer(server);
});

beforeEach(async () => {
  // ⚠ CLEARED IN FK ORDER, AND `error_log` IS THE SUBJECT SO IT MUST BE EMPTY PER CASE. An absence
  // assertion over an uncleared table starts measuring a prior case's leftovers — the 6c
  // reset-coverage fence exists for exactly this shape.
  await pool.query('DELETE FROM error_log');
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM users');
  // ⚠ THE CONTRACTOR ROWS ARE NOT DELETED, AND THE FIRST WRITING TRIED TO. `contractors` keys on
  // `id`, not `contractor_id` — the delete raised `column "contractor_id" does not exist` IN THE
  // HOOK, which failed all 15 cases including the pure-source one that touches no database at all.
  // **That asymmetry is the tell this repo records: a hook fault fails what cannot depend on it,
  // while a subject fault spares those cases.** `seedContractor` is idempotent (`ON CONFLICT DO
  // NOTHING`), so re-seeding is the whole requirement and the rows can simply stay.
  await seedContractor(pool, TENANT);
  await seedContractor(pool, OTHER);
});

/** POST a client error report. `token` is optional — the route is unauthenticated by design. */
async function report(body, token) {
  const payload = JSON.stringify(body);
  return httpPost(port, '/api/log-client-error', payload,
    token ? { Authorization: `Bearer ${token}` } : {});
}

/** The single error_log row, or undefined. Asserts there is at most one, so a case cannot read a sibling. */
async function soleRow() {
  const { rows } = await pool.query(
    `SELECT contractor_id, route, method, severity, source, error_message, stack_trace, count
       FROM error_log`);
  assert.ok(rows.length <= 1, `expected at most one error_log row, found ${rows.length}`);
  return rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
describe('cleanup C — a boundary catch is CRITICAL regardless of route', () => {
  it('[RED before the fix] fatal on route "/" is stored CRITICAL, not INFO', async () => {
    // ⚠ `/` IS THE DISCRIMINATING ROUTE, NOT A TIDY ONE. It matches none of `classifySeverity`'s
    // needles, so route classification gives INFO — the exact grade a whole-page crash used to get.
    const res = await report({
      error_message: 'boundary: Cannot read properties of null',
      stack_trace: 'Error: boom\n  at X',
      route: '/',
      component: 'ErrorBoundary',
      component_stack: '\n    at CashOutTab\n    at ReferrerApp',
      fatal: true,
    });
    assert.equal(res.status, 200);

    const row = await soleRow();
    assert.ok(row, 'no error_log row was written');
    assert.equal(row.severity, 'CRITICAL',
      'a boundary catch on "/" must be CRITICAL for triage — route classification alone gives INFO');
    assert.equal(row.source, 'frontend');
    assert.equal(row.method, 'CLIENT');
    assert.equal(row.route, '/');
  });

  it('PAIRED NEGATIVE: a NON-fatal report on "/" is still graded by route — INFO', async () => {
    // ⚠ WITHOUT THIS, THE CASE ABOVE PASSES AGAINST A SERVER THAT MARKS *EVERYTHING* CRITICAL, which
    // would make the severity column useless rather than useful. The override must be reachable only
    // by the fatal flag.
    const res = await report({
      error_message: 'a handled, non-fatal failure',
      route: '/',
      component: 'safeAsync:someEffect',
      fatal: false,
    });
    assert.equal(res.status, 200);
    const row = await soleRow();
    assert.equal(row.severity, 'INFO', 'a non-fatal frontend error on "/" must stay route-classified');
  });

  it('`fatal` is read as STRICTLY TRUE — a truthy string cannot promote severity', async () => {
    // ⚠ THE ROUTE IS UNAUTHENTICATED, SO THE BODY IS UNTRUSTED INPUT. A truthiness test would let any
    // non-empty string promote a row, which is triage pollution anyone on the internet could write.
    const res = await report({
      error_message: 'truthy but not true',
      route: '/',
      fatal: 'yes',
    });
    assert.equal(res.status, 200);
    const row = await soleRow();
    assert.equal(row.severity, 'INFO');
  });

  it('a fatal report on a CRITICAL-by-route path is still CRITICAL — the override cannot downgrade', async () => {
    const res = await report({
      error_message: 'boundary on the money screen',
      route: '/cashout',
      fatal: true,
    });
    assert.equal(res.status, 200);
    assert.equal((await soleRow()).severity, 'CRITICAL');
  });

  it('⚠ ALERT CADENCE IS UNCHANGED: severity is a triage label, not a send gate', async () => {
    // ⚠ ASSERTED FROM SOURCE BECAUSE NO TEST CAN OBSERVE A SEND WITHOUT STUBBING RESEND, and the
    // 7d-0 interlock refuses sends by default. The property is that `sendErrorAlert`'s gate reads
    // only the COUNT — so promoting a severity cannot change who gets emailed. Stated as a case
    // because "the ruling changed severity only" is the half most easily lost later.
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'middleware', 'errorLogger.js'), 'utf8');
    // ⚠ SLICED BY LINE TO THE CLOSING BRACE, AND THE FIRST WRITING CAPPED IT AT 400 CHARACTERS
    // AGAINST A 1256-CHARACTER FUNCTION — so the slice matched nothing and the case failed on its
    // own non-vacuity floor rather than passing against an empty string. **That floor is the only
    // reason a needle built from a guess did not read as a pass.**
    const lines = src.split(/\r?\n/);
    const start = lines.findIndex((l) => l.startsWith('async function sendErrorAlert'));
    assert.ok(start >= 0, 'harness: sendErrorAlert not found');
    const end = lines.findIndex((l, i) => i > start && l === '}');
    assert.ok(end > start, 'harness: could not find the end of sendErrorAlert');
    const gate = lines.slice(start, end + 1).join('\n');
    assert.ok(gate.length > 300, `harness: the slice is too small to be the real function: ${gate.length}`);

    assert.match(gate, /count !== 1 && errorRow\.count % 10 !== 0/,
      'the alert gate must still be the count-based one');
    // The gate is the first executable line; a severity condition there would change WHO is emailed.
    assert.ok(!/severity/i.test(lines.slice(start, start + 4).join('\n')),
      'the alert gate must not have gained a severity condition');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('cleanup C — the componentStack is kept', () => {
  it('[RED before the fix] the componentStack reaches the stored stack_trace', async () => {
    const componentStack = '\n    at CashOutTab (src/components/referrer/CashOutTab.jsx:529)\n    at ReferrerApp';
    await report({
      error_message: 'boundary with a tree',
      stack_trace: 'Error: boom\n  at thing',
      route: '/cashout',
      component: 'ErrorBoundary',
      component_stack: componentStack,
      fatal: true,
    });
    const row = await soleRow();
    assert.match(row.stack_trace, /--- component stack ---/,
      'the component stack section is missing — it was discarded');
    assert.match(row.stack_trace, /at CashOutTab/);
    // And the JS stack is still there: keeping one must not replace the other.
    assert.match(row.stack_trace, /Error: boom/);
  });

  it('a LONG JS stack cannot truncate the componentStack away — each has its own budget', async () => {
    // ⚠ THIS IS THE CASE THAT CAUGHT A NAIVE IMPLEMENTATION. Appending the two and truncating the
    // RESULT satisfies "keep the componentStack" in the source and loses it in practice: a 5000-char
    // JS stack fills the budget and the half that says WHICH TREE died is cut off. The fixture's JS
    // stack is deliberately longer than the whole old cap.
    const hugeStack = 'Error: huge\n' + ('  at frame\n'.repeat(900));   // ~9k chars
    assert.ok(hugeStack.length > 5000, 'harness: the JS stack must exceed the old 5000 cap');
    await report({
      error_message: 'boundary with a huge stack',
      stack_trace: hugeStack,
      route: '/',
      component_stack: '\n    at TheTreeThatDied',
      fatal: true,
    });
    const row = await soleRow();
    assert.match(row.stack_trace, /at TheTreeThatDied/,
      'the component stack was truncated away by the JS stack — give it its own budget');
  });

  it('no componentStack means no section, not an empty one', async () => {
    await report({
      error_message: 'non-boundary error',
      stack_trace: 'Error: plain',
      route: '/profile',
    });
    const row = await soleRow();
    assert.equal(row.stack_trace, 'Error: plain');
    assert.ok(!/component stack/.test(row.stack_trace));
  });

  it('the componentStack no longer becomes the stored ROUTE when no route is sent', async () => {
    // ⚠ THE OLD HANDLER USED `component` AS A PATH FALLBACK, and for a boundary catch the `component`
    // WAS the componentStack — so a multi-line React tree could become the `route`, which is part of
    // the dedup key `(contractor_id, route, method, error_message)`. One crash could therefore never
    // dedupe with the next.
    await report({
      error_message: 'no route supplied',
      component: 'ErrorBoundary',
      component_stack: '\n    at A\n    at B',
      fatal: true,
    });
    const row = await soleRow();
    assert.equal(row.route, 'frontend-unknown');
    assert.ok(!row.route.includes('\n'), 'a multi-line value must never become the route');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('cleanup C — the session\'s contractor is read when there is one', () => {
  it('[RED before the fix] a logged-in referrer\'s crash is filed under THEIR contractor', async () => {
    const userId = await seedUser(pool, {
      fullName: 'CEC Referrer', email: 'cec-ref@test.com', contractorId: TENANT,
    });
    await seedSession(pool, { userId, token: 'cec-referrer-token', role: 'referrer', contractorId: TENANT });

    await report({ error_message: 'referrer crash', route: '/', fatal: true }, 'cec-referrer-token');

    const row = await soleRow();
    assert.equal(row.contractor_id, TENANT,
      `filed under ${row.contractor_id} instead of the session's tenant`);
    assert.notEqual(row.contractor_id, PHANTOM, 'still filed under the phantom id');
  });

  it('[RED before the fix] a logged-in ADMIN\'s crash is filed under their contractor', async () => {
    // ⚠ ROLE-AGNOSTIC ON PURPOSE. A crashing client does not know which surface its stored token
    // belongs to — the reason `verifyAnySession` exists — so an admin token must resolve too.
    await seedSession(pool, { token: 'cec-admin-token', role: 'admin', contractorId: OTHER });

    await report({ error_message: 'admin crash', route: '/', fatal: true }, 'cec-admin-token');

    assert.equal((await soleRow()).contractor_id, OTHER);
  });

  it('NO session falls back to the PLATFORM tenant — the route stays unauthenticated', async () => {
    // ⚠ THE PROPERTY DANNY NAMED IN C: "falling back as today when none." A crashed app that was
    // never logged in must still be able to report, so this is a 200 and not a 401 — and THAT half
    // is unchanged. ⚠ **What changed is WHICH tenant it falls back to, by ruling 2 in D1.** This
    // case read `assert.equal((await soleRow()).contractor_id, PHANTOM);` and C's comment called it
    // "the old fallback"; the old fallback was a contractor id that does not exist, so the honest
    // value is now the explicit platform marker. **A ruling replaced the mechanism — not a bug.**
    const res = await report({ error_message: 'anonymous crash', route: '/login' });
    assert.equal(res.status, 200);
    const row = await soleRow();
    assert.equal(row.contractor_id, PLATFORM_TENANT);
    assert.notEqual(row.contractor_id, PHANTOM, 'still filed under the phantom contractor id');
  });

  it('an EXPIRED session falls back too, and the response is indistinguishable', async () => {
    await seedSession(pool, {
      token: 'cec-expired', role: 'admin', contractorId: OTHER, expiresInMs: -60_000,
    });
    const res = await report({ error_message: 'expired crash', route: '/' }, 'cec-expired');
    assert.equal(res.status, 200);
    // Same inversion as the case above: this asserted PHANTOM until D1's ruling 2.
    const row = await soleRow();
    assert.equal(row.contractor_id, PLATFORM_TENANT);
    assert.notEqual(row.contractor_id, PHANTOM, 'still filed under the phantom contractor id');
  });

  it('⚠ a FORGED token is not an oracle — same status, same body as a valid one', async () => {
    // ⚠ THIS IS A SECURITY PROPERTY, NOT A NICETY. If the reply differed by token validity, an
    // unauthenticated endpoint would let anyone test a stolen token by watching the response.
    await seedSession(pool, { token: 'cec-valid', role: 'admin', contractorId: OTHER });

    const good = await report({ error_message: 'oracle probe A', route: '/' }, 'cec-valid');
    await pool.query('DELETE FROM error_log');
    const bad = await report({ error_message: 'oracle probe A', route: '/' }, 'not-a-real-token');

    assert.equal(good.status, bad.status);
    assert.deepEqual(good.body, bad.body);
  });

  it('and a report still writes NO row for a missing error_message — the 400 is unchanged', async () => {
    const res = await report({ route: '/', fatal: true });
    assert.equal(res.status, 400);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM error_log');
    assert.equal(rows[0].n, 0);
  });
});
