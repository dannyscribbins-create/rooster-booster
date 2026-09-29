'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT AUDIT — COMMIT (1): ONE DEFINITION OF A REFERRER'S AVAILABLE BALANCE
//
// Danny's ruling, 2026-09-28, on finding 1:
//   · ONE shared function computes the balance — earned minus every cashout that is
//     not denied, so pending AND approved AND paid all deduct;
//   · both the cashout route and account.js use it, neither computes its own;
//   · a fence fails if any other file computes a balance itself, naming file:line;
//   · a request is refused when it exceeds the balance, including at zero or below.
//
// WHAT WAS WRONG. `POST /api/cashout` deducted only `status IN ('pending','approved')`.
// A settled cashout therefore stopped reducing the balance, and the same earnings could
// be cashed out again — indefinitely. `routes/account.js` already used `<> 'denied'`, so
// the codebase carried BOTH formulas and the money path used the wrong one.
//
// ⚠ MEASURED FIRING IN PRODUCTION, WHICH IS WHY THE FIXTURE BELOW IS THE SHAPE IT IS.
// Danny's test referrer: earned $500.00, two SETTLED $500 cashouts, old deduction **0**,
// so his balance read $500 forever and he was paid twice against one earning. The visible
// symptom was a balance that "never drops" — the dip is transient, and actioning the
// cashout in the admin panel is what restored it, because 'paid' left the deducted set.
// `DANNYS_SHAPE` below reproduces those exact numbers.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { request: _httpRequest } = require('node:http');

const referrerRouter = require('../routes/referrer');
const { getCashoutBalance, getContractorOwedTotal } = require('../utils/cashoutBalance');
const {
  seedContractor, seedUser, seedSession, startTestServer, stopTestServer,
} = require('./helpers');

const CONTRACTOR = 'accent-roofing';
const TOKEN = 'cashout-balance-single-source-token';

function buildApp() {
  const express = require('express');
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '5mb' }));
  app.use('/', referrerRouter);
  return app;
}

function httpReq(port, method, p, body, extraHeaders = {}) {
  const bodyBuf = body != null ? Buffer.from(JSON.stringify(body)) : null;
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path: p, method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyBuf ? { 'Content-Length': bodyBuf.length } : {}),
        ...extraHeaders,
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

// ── THE FENCE'S NEEDLES, ASSEMBLED FROM PIECES ──────────────────────────────
// ⚠ BUILT BY CONCATENATION SO THIS FILE CANNOT MATCH ITSELF. The fence walks `server/`
// and skips `server/test/`, so today it would not scan this file anyway — but CLAUDE.md
// records a stylesheet sweep that walked all of `src/` INCLUDING itself and reported its
// own test file as the offender. Assembling the needle is what makes widening the walk
// later a safe edit instead of a self-inflicted red.
const T_TABLE = 'cashout' + '_requests';
const T_SUM = 'SUM' + '(';
const T_USER = 'user' + '_id';

// The ONE file allowed to contain a per-user balance sum.
const ALLOWED = path.join('server', 'utils', 'cashoutBalance.js');

/** Every .js file under server/, EXCLUDING server/test — derived by walking, never typed. */
function serverFiles() {
  // ⚠ WALKED, NOT A HAND-MAINTAINED LIST. Every sweep in this repo built from a typed
  // FILES list has gone stale without announcing it; a new route computing its own
  // balance must be visible to this fence the moment it lands.
  const root = path.join(__dirname, '..');
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'test' && path.resolve(dir) === path.resolve(root)) continue;
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.name.endsWith('.js')) {
        out.push(full);
      }
    }
  })(root);
  return out;
}

/** Strip // and /* *\/ comments so prose cannot satisfy or trip the needle. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Every quoted span in a source file, with the line it starts on.
 * Backticks, single and double quotes — the three ways SQL is written here.
 * ⚠ SPANS, NOT LINE WINDOWS. A window heuristic around the table name would read
 * neighbouring statements and report a SUM that belongs to a different query — the
 * "reading a window instead of the line" defect CLAUDE.md records as 21 false flags.
 */
function sqlSpans(src) {
  const spans = [];
  const re = /`[^`]*`|'[^'\n]*'|"[^"\n]*"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    spans.push({ text: m[0], line: src.slice(0, m.index).split('\n').length });
  }
  return spans;
}

function findLocalBalanceSums() {
  const findings = [];
  for (const file of serverFiles()) {
    const rel = path.relative(path.join(__dirname, '..', '..'), file);
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    for (const span of sqlSpans(src)) {
      if (span.text.includes(T_TABLE) && span.text.includes(T_SUM) && span.text.includes(T_USER)) {
        findings.push({ file: rel, line: span.line });
      }
    }
  }
  return findings;
}

const DANNYS_SHAPE = { earned: 500, paidCashouts: [500, 500] };

describe('payout commit (1) — one definition of a referrer\'s available balance', () => {
  let pool, server, port, userId;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(buildApp()));
  });

  after(async () => {
    referrerRouter._resetTestOverrides();
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    referrerRouter._resetTestOverrides();
    await pool.query('DELETE FROM payout_announcements');
    await pool.query('DELETE FROM cashout_requests');
    await pool.query('DELETE FROM referral_conversions');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM contractor_settings');

    await seedContractor(pool, CONTRACTOR);
    userId = await seedUser(pool, {
      fullName: 'Balance Referrer', email: 'balance@pay1.test', contractorId: CONTRACTOR,
    });
    await seedSession(pool, { userId, token: TOKEN, role: 'referrer', contractorId: CONTRACTOR });
    referrerRouter._setTestOverrides({
      sendEmail: async () => ({ id: 'stub' }),
      sendAdminNotification: async () => {},
    });
  });

  async function earn(amount) {
    await pool.query(
      `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, bonus_amount)
       VALUES ($1, $2, $3, $4)`,
      [userId, CONTRACTOR, `jc-${Math.random().toString(36).slice(2)}`, amount]
    );
  }

  async function cashout(amount, status) {
    await pool.query(
      `INSERT INTO cashout_requests
         (user_id, full_name, email, amount, payout_method, contractor_id, status, requested_at)
       VALUES ($1, 'Balance Referrer', 'balance@pay1.test', $2, 'venmo', $3, $4, NOW())`,
      [userId, amount, CONTRACTOR, status]
    );
  }

  let ip = 100;
  const request = (amount) => httpReq(port, 'POST', '/api/cashout',
    { amount, payout_method: 'venmo' },
    { authorization: `Bearer ${TOKEN}`, 'x-forwarded-for': `9.0.0.${ip++}` }
  );

  // ── DANNY'S EXACT SHAPE ────────────────────────────────────────────────────

  it('⚠ DANNY\'S SHAPE: earned $500 with two PAID $500 cashouts is −$500, not $500', async () => {
    await earn(DANNYS_SHAPE.earned);
    for (const amt of DANNYS_SHAPE.paidCashouts) await cashout(amt, 'paid');

    const bal = await getCashoutBalance(pool, userId);
    assert.equal(bal.earned, 500, 'earned is the one booked conversion');
    assert.equal(bal.deducted, 1000, 'BOTH settled cashouts must deduct — this is the defect');
    assert.equal(bal.available, -500, 'so the account is over-paid by $500');
  });

  it('⚠ DANNY\'S SHAPE: and a further request is REFUSED rather than allowed', async () => {
    await earn(DANNYS_SHAPE.earned);
    for (const amt of DANNYS_SHAPE.paidCashouts) await cashout(amt, 'paid');

    const res = await request(500);
    assert.equal(res.status, 400, 'an over-paid account must not be able to request more');
    assert.equal(res.body.error, 'Requested amount exceeds your available balance');
    const { rows } = await pool.query(
      'SELECT id FROM cashout_requests WHERE status = $1', ['pending']
    );
    assert.equal(rows.length, 0, 'and no new row may be created');
  });

  // ── WHICH STATES DEDUCT ────────────────────────────────────────────────────

  for (const state of ['pending', 'approved', 'paid']) {
    it(`a '${state}' cashout DEDUCTS from the available balance`, async () => {
      await earn(300);
      await cashout(100, state);
      const bal = await getCashoutBalance(pool, userId);
      assert.equal(bal.deducted, 100, `'${state}' must reduce the balance`);
      assert.equal(bal.available, 200);
    });
  }

  it('⚠ PAIRED POSITIVE: a DENIED cashout does NOT deduct', async () => {
    // ⚠ WITHOUT THIS, A FUNCTION THAT DEDUCTED *EVERY* CASHOUT WOULD PASS EVERY CASE
    // ABOVE. `<> 'denied'` has exactly one exception and this is the only test that can
    // see it — the three-state loop cannot distinguish "not denied" from "all of them".
    await earn(300);
    await cashout(100, 'denied');
    const bal = await getCashoutBalance(pool, userId);
    assert.equal(bal.deducted, 0, 'a denied cashout must never reduce the balance');
    assert.equal(bal.available, 300);
  });

  it('mixed states deduct exactly the non-denied ones', async () => {
    await earn(1000);
    await cashout(100, 'pending');
    await cashout(50, 'approved');
    await cashout(200, 'paid');
    await cashout(400, 'denied');
    const bal = await getCashoutBalance(pool, userId);
    assert.equal(bal.deducted, 350, 'pending + approved + paid; denied excluded');
    assert.equal(bal.available, 650);
  });

  // ── THE REFUSAL, AT AND BELOW ZERO ─────────────────────────────────────────

  it('refuses a request when the balance is exactly ZERO', async () => {
    await earn(500);
    await cashout(500, 'paid');
    const bal = await getCashoutBalance(pool, userId);
    assert.equal(bal.available, 0, 'precondition: the balance is exactly zero');

    const res = await request(20);
    assert.equal(res.status, 400, 'a zero balance must refuse even the $20 minimum');
    assert.equal(res.body.error, 'Requested amount exceeds your available balance');
  });

  it('refuses a request when the balance is NEGATIVE', async () => {
    await earn(100);
    await cashout(500, 'paid');
    const bal = await getCashoutBalance(pool, userId);
    assert.ok(bal.available < 0, 'precondition: the balance is negative');

    const res = await request(20);
    assert.equal(res.status, 400);
  });

  it('⚠ PAIRED POSITIVE: a request WITHIN the balance is still accepted', async () => {
    // ⚠ THE REFUSALS ABOVE ARE ALL SATISFIED BY A GATE THAT REFUSES EVERYTHING. This is
    // the only case that can fail if the fix over-corrects, and a cashout route that
    // refuses every request is an outage rather than a safety improvement.
    await earn(500);
    await cashout(100, 'paid');
    const res = await request(100);
    assert.equal(res.status, 200, 'earned 500 − paid 100 = 400 available, so 100 must pass');
    assert.equal(res.body.success, true);
    const { rows } = await pool.query(
      `SELECT amount FROM cashout_requests WHERE user_id = $1 AND status = 'pending'`, [userId]
    );
    assert.equal(rows.length, 1, 'and the row must actually be created');
    assert.equal(parseFloat(rows[0].amount), 100);
  });

  it('a request for exactly the available balance is accepted', async () => {
    await earn(500);
    await cashout(100, 'paid');
    const res = await request(400);
    assert.equal(res.status, 200, 'the boundary itself must be spendable, not off-by-one');
  });

  // ── THE SINGLE-SOURCE FENCE ────────────────────────────────────────────────

  it('NON-VACUITY: the fence\'s needle actually matches the shared function', async () => {
    // ⚠ WITHOUT THIS THE FENCE BELOW PASSES AGAINST A NEEDLE THAT MATCHES NOTHING, which
    // is indistinguishable from a codebase with no local balance sums. CLAUDE.md records
    // this exact shape twice: a fence reporting health it never observed.
    const all = findLocalBalanceSums();
    assert.ok(
      all.some(f => f.file === ALLOWED || f.file.replace(/\//g, '\\') === ALLOWED),
      `the needle must find the sum inside ${ALLOWED} — it found: ` +
      JSON.stringify(all)
    );
  });

  it('⚠ FENCE: no file outside the shared function computes a cashout balance itself', async () => {
    const offenders = findLocalBalanceSums().filter(
      f => f.file !== ALLOWED && f.file.replace(/\//g, '\\') !== ALLOWED
    );
    assert.deepEqual(
      offenders, [],
      'a per-user cashout balance is computed outside server/utils/cashoutBalance.js at:\n' +
      offenders.map(f => `  ${f.file}:${f.line}`).join('\n') +
      '\nImport getCashoutBalance instead of writing a second formula.'
    );
  });

  it('the fence does NOT flag a legitimate contractor-scoped payout total', async () => {
    // ⚠ THE PAIRED NEGATIVE, AND IT IS WHAT KEEPS THE FENCE ALIVE. admin/metrics.js sums
    // cashout_requests by CONTRACTOR to show a dashboard total — a different question from
    // a referrer's available balance, and a correct one. A fence that flagged it would be
    // switched off within a month, which CLAUDE.md records as the fate of any check that
    // reports plausible findings. The discriminator is the `user_id` predicate.
    const metrics = path.join(__dirname, '..', 'routes', 'admin', 'metrics.js');
    const src = stripComments(fs.readFileSync(metrics, 'utf8'));
    const spans = sqlSpans(src).filter(s => s.text.includes(T_TABLE) && s.text.includes(T_SUM));
    assert.ok(spans.length >= 1, 'harness: metrics.js must still contain such a sum at all');
    for (const s of spans) {
      assert.ok(
        !s.text.includes(T_USER),
        `metrics.js:${s.line} would be flagged — the fence's discriminator has broken`
      );
    }
  });

  // ── THE ADMIN AGGREGATE ────────────────────────────────────────────────────

  it('⚠ admin "Total Balance Owed" agrees with the shared function, per referrer', async () => {
    // ⚠ WHAT IT REPLACED SUMMED THE SPECULATIVE PIPELINE FIGURE AND SUBTRACTED NO CASH-OUTS,
    // so an admin was shown every bonus ever earned as still owed — a number that can only
    // grow. This pins that the aggregate in routes/admin/metrics.js computes the same
    // arithmetic as getCashoutBalance, one round trip instead of one per referrer.
    await earn(500);
    await cashout(100, 'paid');
    await cashout(50, 'pending');
    await cashout(400, 'denied');      // must not deduct
    const bal = await getCashoutBalance(pool, userId);
    assert.equal(bal.available, 350, 'precondition: the shared function says 350');

    // ⚠ CALLS THE SHARED AGGREGATE RATHER THAN RE-TYPING ITS SQL. The first writing of this
    // case pasted the query inline — which is a third copy of the balance arithmetic, in the
    // very file that fences against a second one.
    const owed = await getContractorOwedTotal(pool, CONTRACTOR);
    assert.equal(owed, 350, 'the aggregate must agree with the helper');
  });

  it('⚠ the aggregate CLAMPS each referrer at zero, so one over-paid account cannot mask a real debt', async () => {
    // ⚠ THIS IS A JUDGEMENT, PINNED SO IT IS VISIBLE RATHER THAN INCIDENTAL. A negative balance
    // is not money the contractor can collect, so letting it reduce the total would understate
    // what is genuinely owed to everyone else. Danny's own account is the live example: summed
    // RAW this tenant reads −$500; summed CLAMPED it reads what is actually owed.
    // **If the raw signed sum is wanted instead, the GREATEST() is the one thing to change.**
    await earn(100);
    await cashout(600, 'paid');        // this referrer is at −500
    const other = await seedUser(pool, {
      fullName: 'Healthy Referrer', email: 'healthy@pay1.test', contractorId: CONTRACTOR,
    });
    await pool.query(
      `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, bonus_amount)
       VALUES ($1, $2, 'jc-healthy', 300)`, [other, CONTRACTOR]
    );

    // ⚠ THE RAW SIGNED SUM IS COMPUTED HERE ONLY TO PROVE THE TWO READINGS DISAGREE. Without
    // it the fixture cannot tell a clamped aggregate from an unclamped one — the shape
    // CLAUDE.md records as "a fixture whose columns agree cannot tell two readings apart".
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(
                COALESCE((SELECT SUM(rc.bonus_amount) FROM referral_conversions rc
                           WHERE rc.user_id = u.id), 0)
              - COALESCE((SELECT SUM(cr.amount) FROM cashout_requests cr
                           WHERE cr.user_id = u.id AND cr.status <> 'denied'), 0)
              ), 0) AS raw
         FROM users u
        WHERE u.contractor_id = $1 AND u.deleted_at IS NULL`,
      [CONTRACTOR]
    );
    assert.equal(parseFloat(rows[0].raw), -200, 'raw: the over-paid account eats the healthy one');
    assert.equal(await getContractorOwedTotal(pool, CONTRACTOR), 300,
      'clamped: the $300 genuinely owed still shows');
  });

  it('both callers IMPORT the shared function', async () => {
    // ⚠ THE FENCE PROVES NO SECOND FORMULA EXISTS. It cannot prove the callers use the
    // FIRST one — a route that computed nothing at all would also pass it. These two
    // assertions are what close that gap.
    for (const rel of [['routes', 'referrer.js'], ['routes', 'account.js']]) {
      const src = fs.readFileSync(path.join(__dirname, '..', ...rel), 'utf8');
      assert.match(
        src, /require\(['"]\.\.\/utils\/cashoutBalance['"]\)/,
        `${rel.join('/')} must import the shared balance function`
      );
      assert.match(
        src, /getCashoutBalance\s*\(/,
        `${rel.join('/')} must actually call it`
      );
    }
  });
});
