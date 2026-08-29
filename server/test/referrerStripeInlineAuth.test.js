'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 1.1-d — THE FOUR INLINE-AUTH REFERRER STRIPE ROUTES — RED FIRST
//
// Four routes in server/routes/stripe.js hand-roll their own session lookup
// instead of calling verifyReferrerSession(), which CLAUDE.md names as one of
// the only authorised ways to protect an endpoint:
//
//   POST /api/referrer/stripe/create-financial-connections-session
//   POST /api/referrer/stripe/save-bank-account          (step-up re-auth target)
//   GET  /api/referrer/stripe/bank-status
//   POST /api/referrer/stripe/disconnect-bank
//
// ⚠ ONE DEFECT, FOUR INSTANCES, SIX DIFFERENCES. The tests below are organised
// by DIFFERENCE, not by route — four copies of one wrong query is one thing to
// fix, and asserting it four times would report four passes for one property.
// Where a difference is observable per-route, the route is the loop variable.
//
// ⚠ INVISIBLE TO EVERY EXISTING GUARD, WHICH IS WHY THEY SURVIVED.
// adminRouteCoverage.test.js and adminRouteInvariant.test.js both filter on the
// /api/admin/ prefix; these are /api/referrer/*. adminRouteCoverage.test.js
// says so in its own limitations comment. Nothing asserts anything about these
// four today. A companion invariant over /api/referrer/* is Wave 1.1-d2 and is
// deliberately NOT built here — a guard whose failure mode has never been
// observed is a claim, so it needs its own RED.
//
// ── THE TWO STRIPE GUARDS, AND WHY THE FIRST IS THE OPPOSITE OF 1.1-c's ──────
//
// 1.1-c PINNED STRIPE_SECRET_KEY to a dummy, because executeStripeTransfer()
// aborts on a missing key at its first statement and every D4 test needed to
// get PAST that to reach the defect. **This phase needs the reverse.** All four
// routes here call getStripeClient() only AFTER the auth check, and that
// function throws when the key is falsy (server/routes/stripe.js). Emptying the
// key therefore makes constructing a Stripe client STRUCTURALLY IMPOSSIBLE,
// rather than merely unreached — a stronger guarantee than pinning a dummy,
// which would let route 6 dial api.stripe.com for real.
//
//   GUARD 1  process.env.STRIPE_SECRET_KEY = '' at module scope, before any
//            route module loads. Empty string rather than `delete`, on purpose:
//            dotenv skips a key that is already an own property of process.env,
//            so a later .env load cannot put a real key back. Asserted below.
//   GUARD 2  every request is shaped to terminate before getStripeClient() is
//            reached at all, so Guard 1 is a backstop and not the mechanism.
//            Route 6 is the one exception and is handled explicitly.
//
// ⚠ A PLAUSIBLE-LOOKING REJECTION IS NOT THE REJECTION YOU ARE TESTING FOR.
// These routes call Stripe, so a missing key, a bad argument and an
// unconfigured account all surface as "it failed". Every negative below pins
// the EXACT auth body, never a bare status code, and every positive pins the
// exact non-auth outcome that proves execution got past the auth boundary.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');

// GUARD 1 — see the header. Must run before ../app is required.
process.env.STRIPE_SECRET_KEY = '';

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { createApp } = require('../app');
const { seedContractor, startTestServer, stopTestServer } = require('./helpers');
const { SESSION_SLIDE_MS } = require('../utils/sessionPolicy');

const TENANT = 'w11d-tenant';

// The two auth responses verifyReferrerSession() sends, byte-identical to the
// ones the inline blocks send today. That identity is what makes this fix
// invisible to the four frontend callers.
const AUTH_401_EXPIRED = 'Session expired. Please log in again.';

// ── HTTP TRANSPORT ────────────────────────────────────────────────────────────

function httpRequest(port, method, path, token, bodyObj) {
  const bodyBuf = bodyObj === undefined ? null : Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (bodyBuf) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = bodyBuf.length;
    }
    const req = _httpRequest({ hostname: 'localhost', port, path, method, headers }, res => {
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

// THE FOUR ROUTES, each with the request shape that terminates SOONEST after the
// auth boundary — so a positive control observes "auth passed" without reaching
// Stripe, and a negative observes the auth rejection itself.
//
// `pastAuth` is what the route returns when auth SUCCEEDS and execution stops at
// the first thing after it. Route 6 is the exception: it has no pre-Stripe exit,
// so its marker is getStripeClient() throwing on the emptied key — which is
// still strictly after the auth check, and is Guard 1 doing visible work.
const ROUTES = [
  {
    name: 'create-financial-connections-session',
    method: 'POST',
    path: '/api/referrer/stripe/create-financial-connections-session',
    body: {},
    pastAuth: { status: 500, error: 'Failed to create bank connection session' },
  },
  {
    name: 'save-bank-account',
    method: 'POST',
    path: '/api/referrer/stripe/save-bank-account',
    body: {}, // financialConnectionsAccountId omitted → 400 before getStripeClient()
    pastAuth: { status: 400, error: 'financialConnectionsAccountId is required' },
  },
  {
    name: 'bank-status',
    method: 'GET',
    path: '/api/referrer/stripe/bank-status',
    body: undefined, // no bank token on the user → 200 {connected:false} before Stripe
    pastAuth: { status: 200, connected: false },
  },
  {
    name: 'disconnect-bank',
    method: 'POST',
    path: '/api/referrer/stripe/disconnect-bank',
    body: {}, // no pending cashouts → UPDATE then 200, never touches Stripe
    pastAuth: { status: 200, success: true },
  },
];

const call = (port, r, token) => httpRequest(port, r.method, r.path, token, r.body);

// ── SUITE ─────────────────────────────────────────────────────────────────────

describe('Wave 1.1-d — the four inline-auth referrer Stripe routes (RED)', () => {
  // ⚠ ONE POOL PER FILE, NOT PER describe. initTestDb() returns the server/db.js
  // pool SINGLETON; a second describe ending it kills the pool the next suite is
  // about to use, and the result is CANCELLED tests, which land in neither the
  // pass nor the fail column.
  let pool, app, server, port;
  let liveUserId, liveToken;

  before(async () => {
    pool = await initTestDb();
    app = createApp();
    ({ server, port } = await startTestServer(app));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  async function seedReferrer({ email, deletedAt = null }) {
    const hash = await bcrypt.hash('1234', 4);
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, pin, email_verified, contractor_id, deleted_at)
       VALUES ('W11d Referrer', $1, $2, TRUE, $3, $4) RETURNING id`,
      [email, hash, TENANT, deletedAt]
    );
    return rows[0].id;
  }

  // Inserts a referrer session DIRECTLY rather than via helpers.seedSession(),
  // which refuses to mint a referrer session without a contractor_id — the very
  // state difference 2 exists to test.
  async function seedSessionRaw({ token, userId, contractorId, expiresInMs = 3_600_000 }) {
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id)
       VALUES ($1, $2, $3, 'referrer', $4)
       ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [userId, token, new Date(Date.now() + expiresInMs), contractorId]
    );
  }

  beforeEach(async () => {
    // FK-safe order: sessions and cashouts reference users with NO ACTION.
    await pool.query('DELETE FROM payout_announcements');
    await pool.query('DELETE FROM cashout_requests');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_preferences');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM announcement_settings');
    await pool.query('DELETE FROM admin_cache');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedContractor(pool, TENANT);

    liveUserId = await seedReferrer({ email: 'live@w11d.test' });
    liveToken = 'l'.repeat(64);
    await seedSessionRaw({ token: liveToken, userId: liveUserId, contractorId: TENANT });
  });

  // ── GUARD 1, ASSERTED ─────────────────────────────────────────────────────
  // A guard whose failure mode has never been observed is a claim, not a check.

  describe('Stripe guards', () => {
    it('GUARD 1: STRIPE_SECRET_KEY is falsy, so no Stripe client can be constructed', () => {
      assert.ok(
        !process.env.STRIPE_SECRET_KEY,
        'a real key reached this process — route 6 would dial api.stripe.com for real'
      );
    });
  });

  // ── POSITIVE CONTROLS — ORDERED FIRST ─────────────────────────────────────
  // A verifier that rejects everything passes every negative below and looks
  // identical to a working one. These four are what tell the two apart, and each
  // pins the EXACT non-auth outcome rather than merely "not 401".

  describe('POSITIVE CONTROLS — a normal live referrer session succeeds on all four', () => {
    for (const r of ROUTES) {
      it(`POSITIVE CONTROL: ${r.name} lets a live session past the auth boundary`, async () => {
        const res = await call(port, r, liveToken);
        assert.equal(res.status, r.pastAuth.status, `${r.name}: expected the past-auth outcome`);
        if (r.pastAuth.error !== undefined) {
          assert.equal(res.body.error, r.pastAuth.error);
        }
        if (r.pastAuth.connected !== undefined) {
          assert.equal(res.body.connected, r.pastAuth.connected);
        }
        if (r.pastAuth.success !== undefined) {
          assert.equal(res.body.success, r.pastAuth.success);
        }
      });
    }

    it('POSITIVE CONTROL: disconnect-bank actually WRITES — an observed success, not a 200', async () => {
      await pool.query(
        `UPDATE users SET stripe_bank_account_token = 'enc:placeholder' WHERE id = $1`,
        [liveUserId]
      );
      const res = await call(port, ROUTES[3], liveToken);
      assert.equal(res.status, 200);
      const { rows } = await pool.query('SELECT stripe_bank_account_token FROM users WHERE id = $1', [liveUserId]);
      assert.equal(rows[0].stripe_bank_account_token, null, 'the bank token must actually be cleared');
    });
  });

  // ── DIFFERENCE 1 — u.deleted_at IS NULL ───────────────────────────────────
  // ⚠ TEST-ONLY, AND IT MUST BE SAID PLAINLY. Production ran
  //     SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL   -> 0
  // on 2026-08-28. No account has ever been soft-deleted at Accent, so NOTHING
  // exercises this in production and this assertion is the entire verification.
  // Same position as Wave 0.3's twelve tenant-scoping fixes and 1.1-c's six.
  // Do not let a green run here read as production-confirmed.

  describe('DIFFERENCE 1 — a soft-deleted referrer keeps working (TEST-ONLY)', () => {
    for (const r of ROUTES) {
      it(`RED: ${r.name} must REJECT a soft-deleted user's live token`, async () => {
        const deadId = await seedReferrer({ email: 'deleted@w11d.test', deletedAt: new Date() });
        const deadToken = 'd'.repeat(64);
        await seedSessionRaw({ token: deadToken, userId: deadId, contractorId: TENANT });

        const res = await call(port, r, deadToken);
        assert.equal(
          res.status, 401,
          `${r.name}: a soft-deleted homeowner's token still authenticates — the account is ` +
          `deleted as far as the product is concerned and the banking surface still answers to it`
        );
        assert.equal(res.body.error, AUTH_401_EXPIRED, 'and it must be the AUTH rejection, not some later failure');
      });
    }
  });

  // ── DIFFERENCE 2 — s.contractor_id IS NOT NULL ────────────────────────────

  describe('DIFFERENCE 2 — a session with NULL contractor_id is accepted', () => {
    for (const r of ROUTES) {
      it(`RED: ${r.name} must REJECT a session carrying no tenant`, async () => {
        const orphanToken = 'o'.repeat(64);
        await seedSessionRaw({ token: orphanToken, userId: liveUserId, contractorId: null });

        const res = await call(port, r, orphanToken);
        assert.equal(res.status, 401, `${r.name}: a tenant-less session authenticated`);
        assert.equal(res.body.error, AUTH_401_EXPIRED);
      });
    }
  });

  // ── DIFFERENCE 3 — applySessionSlide() / D7 ───────────────────────────────
  // computeSessionSlide infers the last bump as expiresAt - SESSION_SLIDE_MS, so
  // a session expiring in one hour reads as bumped ~29 days ago and is NOT
  // throttled. It must therefore slide to about now + 30 days on first verify.

  describe('DIFFERENCE 3 — these four opt out of the D7 sliding window', () => {
    it('RED: a request on bank-status pushes expires_at forward by the slide', async () => {
      const before = await pool.query('SELECT expires_at FROM sessions WHERE token = $1', [liveToken]);
      const beforeMs = new Date(before.rows[0].expires_at).getTime();

      const res = await call(port, ROUTES[2], liveToken);
      assert.equal(res.status, 200, 'the request itself must succeed — otherwise this measures nothing');

      const after = await pool.query('SELECT expires_at FROM sessions WHERE token = $1', [liveToken]);
      const afterMs = new Date(after.rows[0].expires_at).getTime();

      assert.ok(
        afterMs > beforeMs,
        'expires_at did not move — a referrer whose only activity is banking ages out on a ' +
        'schedule nobody chose, while every other referrer route extends their session'
      );
      // Pin the magnitude, not merely the direction: a one-second drift would
      // satisfy "moved forward" while proving the policy was never applied.
      const expected = Date.now() + SESSION_SLIDE_MS;
      assert.ok(
        Math.abs(afterMs - expected) < 5 * 60 * 1000,
        `expires_at moved, but not by the D7 slide (got ${new Date(afterMs).toISOString()})`
      );
    });
  });

  // ── DIFFERENCES 4 AND 5 — the auth error path ─────────────────────────────
  // Induction: rename the sessions table so the session lookup itself throws.
  // This hits BOTH implementations identically — the inline query and the
  // verifier both read `sessions` — which is what makes the comparison fair.
  // Today the throw lands in the ROUTE's catch, so ops is told a banking feature
  // failed when what actually failed was authentication.

  describe('DIFFERENCES 4 and 5 — an auth-layer DB failure is reported as a business failure', () => {
    // ⚠ THE RESTORE IS ASSERTED IN THE TEST THAT BROKE IT, NOT ONLY IN CLEANUP.
    // A rename that silently failed to restore would leave every later test in
    // this file — and the slide test in particular — asserting against a table
    // this helper built rather than the real one, and they would pass. Cleanup
    // that is never checked is a mechanism reporting a state it cannot observe.
    async function withSessionsTableBroken(fn) {
      await pool.query('ALTER TABLE sessions RENAME TO sessions_w11d_tmp');
      let result;
      try {
        result = await fn();
      } finally {
        await pool.query('ALTER TABLE sessions_w11d_tmp RENAME TO sessions');
      }
      const { rows } = await pool.query(
        `SELECT to_regclass('public.sessions')          AS live,
                to_regclass('public.sessions_w11d_tmp') AS leftover`
      );
      assert.ok(rows[0].live, 'sessions was NOT restored — every later assertion in this file is now void');
      assert.equal(rows[0].leftover, null, 'the temporary table survived the restore');
      return result;
    }

    it('RED: the response says AUTH failed, not that bank status failed', async () => {
      const res = await withSessionsTableBroken(() => call(port, ROUTES[2], liveToken));
      assert.equal(res.status, 500);
      assert.equal(
        res.body.error, 'Auth check failed',
        'the auth lookup threw and the caller was told the banking feature failed — the ' +
        'route catch swallowed an authentication error and relabelled it'
      );
    });

    it('RED: logError attributes the failure to the verifier, not to the route', async () => {
      await withSessionsTableBroken(() => call(port, ROUTES[2], liveToken));
      const { rows } = await pool.query(
        `SELECT source, error_message FROM error_log ORDER BY id DESC LIMIT 1`
      );
      assert.ok(rows.length, 'an auth failure must be logged at all');
      assert.equal(
        rows[0].source, 'verifyReferrerSession',
        'ops sees this as a generic backend error on a banking route; nothing points at auth'
      );
    });
  });

  // ── DIFFERENCE 6 — the INNER JOIN on users ────────────────────────────────
  // ⚠ SEPARABLE FROM DIFFERENCE 1, NOT A SECOND SPELLING OF IT. Difference 1 is
  // a user row that EXISTS and carries deleted_at. This is a session that
  // resolves to NO user row at all, which the schema permits: sessions.user_id
  // is nullable (admin sessions rely on that) and nothing constrains
  // role='referrer' to imply a non-null user_id. Different fixture, different
  // predicate, and a different and worse RED — the inline query happily returns
  // user_id = NULL, and the handlers then run their whole body against it.

  describe('DIFFERENCE 6 — a referrer session with no user resolves to NULL and proceeds', () => {
    it('RED: bank-status answers 200 to a session that resolves to no user', async () => {
      const ghostToken = 'g'.repeat(64);
      await seedSessionRaw({ token: ghostToken, userId: null, contractorId: TENANT });

      const res = await call(port, ROUTES[2], ghostToken);
      assert.equal(
        res.status, 401,
        'a session with no user behind it got a 200 and a business answer — ' +
        'the inline query returns user_id = NULL and the handler carries on with it'
      );
      assert.equal(res.body.error, AUTH_401_EXPIRED);
    });

    it('RED: disconnect-bank reports success to a session that resolves to no user', async () => {
      const ghostToken = 'h'.repeat(64);
      await seedSessionRaw({ token: ghostToken, userId: null, contractorId: TENANT });

      const res = await call(port, ROUTES[3], ghostToken);
      assert.equal(
        res.status, 401,
        'a session with no user behind it was told its bank disconnect succeeded — ' +
        'the UPDATE matched zero rows and the route reported success anyway'
      );
      assert.equal(res.body.error, AUTH_401_EXPIRED);
    });
  });
});
