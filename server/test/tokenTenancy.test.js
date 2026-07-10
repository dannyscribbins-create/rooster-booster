'use strict';

// TF SESSION — RED-FIRST TESTS. Spec: CRM_TOKEN_FIX_SPEC.md v1.0 §6 (spec file lives
// outside the repo; transcribed into the session brief that produced this file).
//
// Phase 0 decisions locked before this file was written:
//   TF-P0-1: crm/jobber.js:173 (discoverJobberFields) IS in scope — its refreshTokenIfNeeded
//            call will thread the function's own contractorId parameter. Covered indirectly
//            here by TEST 2's refreshTokenIfNeeded(contractorId) contract (the same function,
//            shared by both call sites) — no dedicated call-site test exists for it below,
//            since none was enumerated in the session's TEST 1-8 list.
//   TF-P0-2: db.js:1303 initDB bootstrap read is in scope, conditionally — handled in the
//            BUILD phase (inspect usage first). NOT tested here.
//   TF-P0-3: oauth.js fallback literals (lines 13, 24) are in scope — OAuth callback becomes
//            fail-closed: unresolvable contractor identity rejects (no 'accent-roofing'
//            default), and the resolved contractor must exist in the contractors table
//            before any token write. See TEST 7.
//
// Every test in this file is expected to go RED today, each for the reason documented above
// it — pinning the END-STATE behavior so the BUILD-phase fix can't silently regress it.
//
// Scope fence: this file, plus a surgical adaptation of invoicePaidWebhook.test.js
// (TEST 8, in that file). No other production or test code touched.

// Stub 'axios' and 'resend' BEFORE requiring anything that transitively requires them
// (../crm/jobber, ../routes/oauth, ../app -> ../routes/referrer). Process-local to this
// test file, touches no production code — same require.cache seam already used by
// signupTenantStamp.test.js for 'resend'.
const _axiosPath = require.resolve('axios');
let _axiosPostImpl = async (url) => {
  throw new Error(`[tokenTenancy.test.js] axios.post stub not configured for this call — url: ${url}`);
};
require.cache[_axiosPath] = {
  id: _axiosPath,
  filename: _axiosPath,
  loaded: true,
  exports: {
    post: (...args) => _axiosPostImpl(...args),
    isAxiosError: () => false,
  },
};
function setAxiosPostImpl(fn) { _axiosPostImpl = fn; }
function resetAxiosPostImpl() {
  _axiosPostImpl = async (url) => {
    throw new Error(`[tokenTenancy.test.js] axios.post stub not configured for this call — url: ${url}`);
  };
}

const _resendPath = require.resolve('resend');
require.cache[_resendPath] = {
  id: _resendPath,
  filename: _resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = { send: async () => ({ data: { id: 'test-stub' }, error: null }) };
      }
    },
  },
};

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

// setup.js applies the localhost-only DATABASE_URL safety interlock at module-load time.
const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { refreshTokenIfNeeded, getContractorAccessToken } = require('../crm/jobber');
const { getScheduledSyncDiscoveryRows } = require('../crm/pipelineSync');
const { seedContractor, startTestServer, stopTestServer, waitFor } = require('./helpers');

// ── SHARED FIXTURES / HELPERS (file-local — helpers.js is not touched this session) ────

const TENANT_A = 'tf-test-contractor-a';
const TENANT_B = 'tf-test-contractor-b';

// An error carrying a 4xx .response.status so jobberShouldRetry() (server/utils/
// retryHelpers.js) does not retry it — every refreshTokenIfNeeded/oauth call this file
// stubs is wrapped in retryWithBackoff with jobberShouldRetry, and a plain Error with no
// .response would look "unknown status" (retryable) and silently retry 3x with real
// backoff delays, turning a fast assertion failure into a slow, confusing one.
function nonRetryableError(message) {
  const err = new Error(message);
  err.response = { status: 400 };
  return err;
}

// Seeds a tokens row at an explicit id — helpers.seedToken() hardcodes id=1 for every
// call, which cannot represent two contractors' rows coexisting (a second insert at id=1
// collides with the PRIMARY KEY even though ON CONFLICT targets contractor_id). tokens.id
// has no significance beyond being the legacy singleton PK; distinct explicit ids here are
// just what the CURRENT schema already allows multiple contractors' rows to use.
async function seedTokenRow(pool, { id, contractorId, accessToken = null, refreshToken = null, expiresAt = null }) {
  await pool.query(
    `INSERT INTO tokens (id, contractor_id, access_token, refresh_token, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [id, contractorId, accessToken, refreshToken, expiresAt]
  );
}

async function seedInviteLink(pool, { contractorId, slug, linkType = 'contractor' }) {
  await pool.query(
    `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
     VALUES ($1, $2, $3, true)`,
    [contractorId, slug, linkType]
  );
}

function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest({ hostname: 'localhost', port, path, method: 'GET' }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        resolve({ status: res.statusCode, body: text });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpPostJson(port, path, bodyObj, extraHeaders = {}) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': bodyBuf.length, ...extraHeaders },
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
    req.write(bodyBuf);
    req.end();
  });
}

// Generic OAuth-callback axios stub — handles the token exchange, account id/name
// lookups, and discoverJobberFields' fire-and-forget custom-field query, with neutral
// responses. Used as a baseline where a test doesn't need to inspect specific calls.
function defaultOauthAxiosStub() {
  return async (url, body) => {
    if (url === 'https://api.getjobber.com/api/oauth/token') {
      return { data: { access_token: 'stub-access', refresh_token: 'stub-refresh', expires_in: 3600 } };
    }
    if (typeof body?.query === 'string') {
      if (body.query.includes('customFieldConfigurations')) {
        return { data: { data: { customFieldConfigurations: { nodes: [] } } } };
      }
      if (body.query.includes('account')) {
        return { data: { data: { account: { id: 'JACCT_STUB', name: 'Stub Account' } } } };
      }
    }
    throw nonRetryableError(`defaultOauthAxiosStub: unhandled POST ${url}`);
  };
}

// Builds a controllable, delayed token-exchange stub for the single-flight tests (TEST 5).
// Records each call's refresh_token (or a caller-supplied phase tag) in order.
function makeExchangeStub({ delayMs = 40, tagWith = null, failWhen = null } = {}) {
  const calls = [];
  const impl = async (url, body) => {
    if (url !== 'https://api.getjobber.com/api/oauth/token') {
      throw nonRetryableError(`makeExchangeStub: unexpected axios.post url: ${url}`);
    }
    const tag = tagWith ? tagWith() : body.refresh_token;
    calls.push(tag);
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    if (failWhen && failWhen(tag)) throw nonRetryableError(`makeExchangeStub: stubbed failure for ${tag}`);
    return { data: { access_token: `new-access-for-${body.refresh_token}`, refresh_token: `new-refresh-for-${body.refresh_token}`, expires_in: 3600 } };
  };
  return { impl, calls };
}

// ── SUITE ────────────────────────────────────────────────────────────────────────────

describe('token tenancy — RED-first (CRM_TOKEN_FIX_SPEC.md v1.0 §6)', () => {
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
    resetAxiosPostImpl();
    await pool.query('DELETE FROM contractor_jobber_fields');
    await pool.query('DELETE FROM contact_tags');
    await pool.query('DELETE FROM contacts');
    await pool.query('DELETE FROM email_verifications');
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM tokens');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractors');
  });

  // ── TEST 1 — Fail-closed signature ──────────────────────────────────────────────────
  describe('TEST 1 — refreshTokenIfNeeded fail-closed signature', () => {
    it('rejects when called with no contractorId, or explicit null/undefined/empty-string', async () => {
      await seedContractor(pool, TENANT_A);
      // future in expires_at so a correctly-scoped call would no-op (not attempt a real
      // exchange) — isolates the assertion to "did it reject for missing identity",
      // not "did it also happen to hit the network".
      await seedTokenRow(pool, {
        id: 1, contractorId: TENANT_A,
        accessToken: 'fresh-access', refreshToken: 'fresh-refresh',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      await assert.rejects(() => refreshTokenIfNeeded(), 'refreshTokenIfNeeded() with no args must reject');
      await assert.rejects(() => refreshTokenIfNeeded(null), 'refreshTokenIfNeeded(null) must reject');
      await assert.rejects(() => refreshTokenIfNeeded(undefined), 'refreshTokenIfNeeded(undefined) must reject');
      await assert.rejects(() => refreshTokenIfNeeded(''), 'refreshTokenIfNeeded(\'\') must reject');
    });
  });

  // ── TEST 2 — Scoped refresh ──────────────────────────────────────────────────────────
  describe('TEST 2 — refreshTokenIfNeeded is scoped to the given contractorId', () => {
    it('refreshes only the specified contractor\'s row; the other contractor\'s row is byte-identical before/after', async () => {
      await seedContractor(pool, TENANT_A);
      await seedContractor(pool, TENANT_B);

      // Contractor B deliberately sits at id=1 — the row today's hardcoded
      // `WHERE id = 1` always reads/writes regardless of which contractorId string is
      // passed in. Contractor A (the one we actually ask to refresh) is expired and sits
      // at a different id, so a correctly-scoped implementation must find it there.
      await seedTokenRow(pool, {
        id: 1, contractorId: TENANT_B,
        accessToken: 'b-access-original', refreshToken: 'b-refresh-original',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await seedTokenRow(pool, {
        id: 2, contractorId: TENANT_A,
        accessToken: 'a-access-stale', refreshToken: 'a-refresh-stale',
        expiresAt: new Date(Date.now() - 60 * 1000), // expired — refresh must trigger
      });

      let exchangeCallCount = 0;
      const exchangeRequestBodies = [];
      setAxiosPostImpl(async (url, body) => {
        if (url !== 'https://api.getjobber.com/api/oauth/token') {
          throw nonRetryableError(`TEST 2: unexpected axios.post url: ${url}`);
        }
        exchangeCallCount++;
        exchangeRequestBodies.push(body);
        return { data: { access_token: 'a-access-new', refresh_token: 'a-refresh-new', expires_in: 3600 } };
      });

      const beforeB = await pool.query('SELECT * FROM tokens WHERE contractor_id = $1', [TENANT_B]);

      await refreshTokenIfNeeded(TENANT_A);

      assert.equal(exchangeCallCount, 1, 'exactly one token exchange call for the scoped refresh');
      assert.equal(
        exchangeRequestBodies[0]?.refresh_token, 'a-refresh-stale',
        'the exchange must use contractor A\'s own refresh_token — today it uses whichever row sits at id=1'
      );

      const { rows: aRows } = await pool.query('SELECT * FROM tokens WHERE contractor_id = $1', [TENANT_A]);
      assert.equal(aRows.length, 1);
      assert.equal(aRows[0].access_token, 'a-access-new', 'contractor A\'s row is updated with the exchanged token');

      const { rows: bRows } = await pool.query('SELECT * FROM tokens WHERE contractor_id = $1', [TENANT_B]);
      assert.deepEqual(
        bRows[0], beforeB.rows[0],
        'contractor B\'s row must be byte-identical before/after — today it gets clobbered because it sits at id=1'
      );
    });
  });

  // ── TEST 3 — F2 kill-shot ────────────────────────────────────────────────────────────
  describe('TEST 3 — F2 kill-shot: two OAuth completions under different contractor_ids', () => {
    it('tokens table holds two rows after two completions; contractor A\'s tokens are unmodified by B\'s connect', async () => {
      await seedContractor(pool, TENANT_A);
      await seedContractor(pool, TENANT_B);

      let exchangeCallCount = 0;
      setAxiosPostImpl(async (url, body) => {
        if (url === 'https://api.getjobber.com/api/oauth/token') {
          exchangeCallCount++;
          return exchangeCallCount === 1
            ? { data: { access_token: 'a-access', refresh_token: 'a-refresh', expires_in: 3600 } }
            : { data: { access_token: 'b-access', refresh_token: 'b-refresh', expires_in: 3600 } };
        }
        if (typeof body?.query === 'string') {
          if (body.query.includes('customFieldConfigurations')) {
            return { data: { data: { customFieldConfigurations: { nodes: [] } } } };
          }
          if (body.query.includes('account')) {
            return { data: { data: { account: { id: 'JACCT_STUB', name: 'Stub Account' } } } };
          }
        }
        throw nonRetryableError(`TEST 3: unexpected axios.post: ${url} ${JSON.stringify(body)}`);
      });

      const resp1 = await httpGet(port, '/callback?code=code-a&state=tf-test-contractor-a');
      assert.equal(resp1.status, 302, 'completion #1 redirects on success');

      const resp2 = await httpGet(port, '/callback?code=code-b&state=tf-test-contractor-b');
      assert.equal(resp2.status, 302, 'completion #2 redirects on success');

      // let any fire-and-forget discoverJobberFields calls from either completion settle
      // before asserting, and before the next test's beforeEach wipes shared tables.
      await new Promise(r => setTimeout(r, 100));

      const { rows } = await pool.query('SELECT contractor_id, access_token, refresh_token FROM tokens ORDER BY contractor_id');
      assert.equal(
        rows.length, 2,
        'tokens table must hold one row per contractor after two OAuth completions — ' +
        'today it holds one, because the upsert keys ON CONFLICT (id) with id=1 hardcoded'
      );

      const aRow = rows.find(r => r.contractor_id === TENANT_A);
      assert.ok(aRow, 'contractor A must still have its own tokens row');
      assert.equal(aRow?.access_token, 'a-access', 'contractor A\'s tokens must be unmodified by contractor B\'s later connect');
    });
  });

  // ── TEST 4 — F4 scoped reads ─────────────────────────────────────────────────────────
  describe('TEST 4 — F4 scoped reads (no fallback to another contractor\'s token)', () => {
    describe('(a) referrer signup Jobber-match IIFE — server/routes/referrer.js:359', () => {
      it('uses the signup contractor\'s own token, not whichever row happens to sit at tokens.id=1', async () => {
        await seedContractor(pool, TENANT_A);
        await seedContractor(pool, TENANT_B);
        await seedInviteLink(pool, { contractorId: TENANT_A, slug: 'tf-slug-a' });

        // Contractor B's token deliberately sits at id=1 — the row today's unscoped
        // `WHERE id = 1` read always returns, regardless of which contractor is signing up.
        await seedTokenRow(pool, {
          id: 1, contractorId: TENANT_B,
          accessToken: 'b-access', refreshToken: 'b-refresh',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
        await seedTokenRow(pool, {
          id: 2, contractorId: TENANT_A,
          accessToken: 'a-access', refreshToken: 'a-refresh',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        const capturedAuthHeaders = [];
        setAxiosPostImpl(async (url, body, config) => {
          if (url === 'https://api.getjobber.com/api/graphql') {
            capturedAuthHeaders.push(config?.headers?.Authorization);
            return { data: { data: { clients: { nodes: [] } } } };
          }
          throw nonRetryableError(`TEST 4a: unexpected axios.post: ${url}`);
        });

        const resp = await httpPostJson(port, '/api/signup', {
          firstName: 'Tenant', lastName: 'A', phone: '555-100-0001',
          email: `tf-signup-a-${Date.now()}@test.com`,
          password: 'password123', inviteSlug: 'tf-slug-a',
        }, { 'X-Forwarded-For': '10.9.1.1' });
        assert.equal(resp.status, 201, `signup failed: ${JSON.stringify(resp.body)}`);

        // The Jobber-match IIFE always writes an activity_log row (match or no-match) —
        // that row is the terminal signal that the background block has finished.
        await waitFor(async () => {
          const { rows } = await pool.query(
            "SELECT * FROM activity_log WHERE detail LIKE '%Jobber client match%'"
          );
          return rows.length > 0;
        }, { timeout: 3000 });

        assert.equal(capturedAuthHeaders.length, 1, 'exactly one Jobber clients lookup fired');
        assert.equal(
          capturedAuthHeaders[0], 'Bearer a-access',
          'the signup contractor\'s (A\'s) own token must be used — not contractor B\'s row sitting at id=1'
        );
      });

      it('signup contractor with no token row of its own must not fall back to another contractor\'s token', async () => {
        await seedContractor(pool, TENANT_A);
        await seedContractor(pool, TENANT_B);
        await seedInviteLink(pool, { contractorId: TENANT_A, slug: 'tf-slug-a2' });

        // Only B has a token row (at id=1). A has none.
        await seedTokenRow(pool, {
          id: 1, contractorId: TENANT_B,
          accessToken: 'b-access-only', refreshToken: 'b-refresh-only',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        const capturedAuthHeaders = [];
        setAxiosPostImpl(async (url, body, config) => {
          if (url === 'https://api.getjobber.com/api/graphql') {
            capturedAuthHeaders.push(config?.headers?.Authorization);
            return { data: { data: { clients: { nodes: [] } } } };
          }
          throw nonRetryableError(`TEST 4a-ii: unexpected axios.post: ${url}`);
        });

        const resp = await httpPostJson(port, '/api/signup', {
          firstName: 'Tenant', lastName: 'A2', phone: '555-100-0002',
          email: `tf-signup-a2-${Date.now()}@test.com`,
          password: 'password123', inviteSlug: 'tf-slug-a2',
        }, { 'X-Forwarded-For': '10.9.1.2' });
        assert.equal(resp.status, 201, `signup failed: ${JSON.stringify(resp.body)}`);

        // No positive "it happened" signal exists for the "must not fall back" case (the
        // whole point is that nothing should run) — give the background IIFE a window to
        // finish either way before asserting.
        await waitFor(async () => {
          const { rows } = await pool.query(
            "SELECT * FROM activity_log WHERE detail LIKE '%Jobber client match%' OR detail LIKE '%No Jobber client match%'"
          );
          return rows.length > 0;
        }, { timeout: 1500 }).catch(() => {});

        assert.equal(
          capturedAuthHeaders.length, 0,
          'contractor A has no token of its own — the background lookup must not silently borrow contractor B\'s token'
        );
      });
    });

    describe('(b) admin campaigns pull — server/routes/admin/campaigns.js:1408', () => {
      // Full route-level coverage remains impractical — no existing harness covers
      // POST /api/admin/campaigns/:id/pull (needs an authenticated admin session with
      // campaigns.manage permission, a seeded campaign + contractor_settings row, and an
      // ndjson STREAM response rather than a JSON body). BUILD phase (STEP 4b close-out)
      // extracted the token read into getContractorAccessToken() — campaigns.js now calls
      // that function directly (server/routes/admin/campaigns.js:1408), so this test
      // exercises the real production artifact, not a copy of the old query text.
      it('(i) contractor A\'s admin context receives A\'s token, never B\'s', async () => {
        await seedContractor(pool, TENANT_A);
        await seedContractor(pool, TENANT_B);
        await seedTokenRow(pool, {
          id: 1, contractorId: TENANT_B,
          accessToken: 'b-access-campaigns', refreshToken: 'b-refresh-campaigns',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
        await seedTokenRow(pool, {
          id: 2, contractorId: TENANT_A,
          accessToken: 'a-access-campaigns', refreshToken: 'a-refresh-campaigns',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        const token = await getContractorAccessToken(TENANT_A);

        assert.equal(
          token, 'a-access-campaigns',
          'an admin session scoped to contractor A must never be handed contractor B\'s Jobber token'
        );
      });

      it('(ii) a contractor with no token row gets a descriptive throw, no fallback', async () => {
        await seedContractor(pool, TENANT_A);
        await seedContractor(pool, TENANT_B);
        await seedTokenRow(pool, {
          id: 1, contractorId: TENANT_B,
          accessToken: 'b-access-only', refreshToken: 'b-refresh-only',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
        // Contractor A has no token row at all.

        await assert.rejects(
          () => getContractorAccessToken(TENANT_A),
          (err) => {
            assert.match(err.message, /no access token found for contractor/i);
            assert.match(err.message, new RegExp(TENANT_A));
            return true;
          },
          'must throw descriptively for a contractor with no token row — never fall back to another row'
        );
      });
    });
  });

  // ── TEST 5 — Single-flight ───────────────────────────────────────────────────────────
  describe('TEST 5 — single-flight refresh coalescing', () => {
    it('(a) two concurrent calls for the same contractor share a single exchange', async () => {
      await seedContractor(pool, TENANT_A);
      await seedTokenRow(pool, {
        id: 1, contractorId: TENANT_A,
        accessToken: 'a-access-stale', refreshToken: 'a-refresh-stale-5a',
        expiresAt: new Date(Date.now() - 60 * 1000),
      });

      const { impl, calls } = makeExchangeStub({ delayMs: 40 });
      setAxiosPostImpl(impl);

      const results = await Promise.allSettled([
        refreshTokenIfNeeded(TENANT_A),
        refreshTokenIfNeeded(TENANT_A),
      ]);

      assert.equal(
        calls.length, 1,
        'exactly one token exchange for two concurrent calls on the same contractor — today each call refreshes independently'
      );
      assert.equal(results[0].status, 'fulfilled');
      assert.equal(results[1].status, 'fulfilled');
    });

    it('(b) concurrent calls for different contractors run two independent exchanges', async () => {
      await seedContractor(pool, TENANT_A);
      await seedContractor(pool, TENANT_B);
      await seedTokenRow(pool, {
        id: 1, contractorId: TENANT_A,
        accessToken: 'a-access-stale', refreshToken: 'a-refresh-stale-5b',
        expiresAt: new Date(Date.now() - 60 * 1000),
      });
      await seedTokenRow(pool, {
        id: 2, contractorId: TENANT_B,
        accessToken: 'b-access-stale', refreshToken: 'b-refresh-stale-5b',
        expiresAt: new Date(Date.now() - 60 * 1000),
      });

      const { impl, calls } = makeExchangeStub({ delayMs: 40 });
      setAxiosPostImpl(impl);

      await Promise.all([
        refreshTokenIfNeeded(TENANT_A),
        refreshTokenIfNeeded(TENANT_B),
      ]);

      assert.equal(calls.length, 2, 'two independent contractors must run two independent exchanges');
      assert.deepEqual(
        calls.slice().sort(),
        ['a-refresh-stale-5b', 'b-refresh-stale-5b'].sort(),
        'each exchange must use its own contractor\'s refresh_token — today both calls collide on tokens.id=1'
      );
    });

    it('(c) a force:true call arriving mid-flight awaits the in-flight refresh instead of starting a second', async () => {
      await seedContractor(pool, TENANT_A);
      await seedTokenRow(pool, {
        id: 1, contractorId: TENANT_A,
        accessToken: 'a-access-stale', refreshToken: 'a-refresh-stale-5c',
        expiresAt: new Date(Date.now() - 60 * 1000), // expired — natural (non-forced) trigger
      });

      const { impl, calls } = makeExchangeStub({ delayMs: 60 });
      setAxiosPostImpl(impl);

      const call1 = refreshTokenIfNeeded(TENANT_A);
      await new Promise(r => setTimeout(r, 10)); // let call1 start its exchange before call2 arrives
      const call2 = refreshTokenIfNeeded(TENANT_A, { force: true });

      await Promise.allSettled([call1, call2]);

      assert.equal(
        calls.length, 1,
        'a force:true call arriving while a refresh is already in flight must await that refresh, not start a second exchange'
      );
    });

    it('(d) an in-flight rejection is shared by concurrent callers, and a later call starts a fresh attempt', async () => {
      await seedContractor(pool, TENANT_A);
      await seedTokenRow(pool, {
        id: 1, contractorId: TENANT_A,
        accessToken: 'a-access-stale', refreshToken: 'a-refresh-stale-5d',
        expiresAt: new Date(Date.now() - 60 * 1000),
      });

      let phase = 'failing';
      const calls = [];
      setAxiosPostImpl(async (url) => {
        if (url !== 'https://api.getjobber.com/api/oauth/token') {
          throw nonRetryableError(`TEST 5d: unexpected axios.post url: ${url}`);
        }
        calls.push(phase);
        await new Promise(r => setTimeout(r, 30));
        if (phase === 'failing') throw nonRetryableError('stubbed exchange failure');
        return { data: { access_token: 'a-access-recovered', refresh_token: 'a-refresh-recovered', expires_in: 3600 } };
      });

      const [r1, r2] = await Promise.allSettled([
        refreshTokenIfNeeded(TENANT_A),
        refreshTokenIfNeeded(TENANT_A),
      ]);

      const failingCalls = calls.filter(p => p === 'failing').length;
      assert.equal(
        failingCalls, 1,
        'two concurrent callers during a failing refresh must share the single in-flight rejection, not each trigger their own exchange attempt'
      );
      assert.equal(r1.status, 'rejected', 'first caller must see the rejection');
      assert.equal(r2.status, 'rejected', 'second caller must see the rejection');

      // The guard must clear on failure (in a finally) so a later call is a genuinely fresh attempt.
      phase = 'succeeding';
      await refreshTokenIfNeeded(TENANT_A);
      const succeedingCalls = calls.filter(p => p === 'succeeding').length;
      assert.equal(succeedingCalls, 1, 'a subsequent call after the failure must start a brand-new attempt, not stay permanently stuck');
    });
  });

  // ── TEST 6 — F5/D4 regression pin ────────────────────────────────────────────────────
  describe('TEST 6 — F5/D4 regression pin: scheduled-sync discovery must exclude inactive contractors', () => {
    // runScheduledSync() (server/crm/pipelineSync.js) is exported and callable, but driving
    // it end-to-end here would mean also making runIncrementalSync's full sync cycle safe
    // for 2-4 contractors (contractor_crm_settings.referral_start_date, sync_state,
    // pipeline_cache writes, throttle pacing...) — disproportionate to the one query under
    // test. BUILD phase (STEP 5) extracted the discovery query into its own exported
    // function, getScheduledSyncDiscoveryRows() — this test now exercises that real
    // production artifact directly, not an inline copy of the query text.
    it('discovery selects only active contractors with a non-null token', async () => {
      await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, 'Active One', 'active')`, ['tf-sched-active-1']);
      await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, 'Active Two', 'active')`, ['tf-sched-active-2']);
      await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, 'Paused', 'paused')`, ['tf-sched-inactive']);
      await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, 'Active No Token', 'active')`, ['tf-sched-null-token']);

      await seedTokenRow(pool, { id: 1, contractorId: 'tf-sched-active-1', accessToken: 'tok-active-1', refreshToken: 'r1', expiresAt: new Date(Date.now() + 3600000) });
      await seedTokenRow(pool, { id: 2, contractorId: 'tf-sched-active-2', accessToken: 'tok-active-2', refreshToken: 'r2', expiresAt: new Date(Date.now() + 3600000) });
      await seedTokenRow(pool, { id: 3, contractorId: 'tf-sched-inactive', accessToken: 'tok-inactive', refreshToken: 'r3', expiresAt: new Date(Date.now() + 3600000) });
      await seedTokenRow(pool, { id: 4, contractorId: 'tf-sched-null-token', accessToken: null, refreshToken: null, expiresAt: null });

      const { rows } = await getScheduledSyncDiscoveryRows();
      const discovered = rows.map(r => r.contractor_id).sort();

      assert.deepEqual(
        discovered,
        ['tf-sched-active-1', 'tf-sched-active-2'].sort(),
        'discovery must select only contractors with status=\'active\' AND a non-null token'
      );
    });
  });

  // ── TEST 7 — OAuth fail-closed (TF-P0-3) ─────────────────────────────────────────────
  describe('TEST 7 — OAuth callback fail-closed (TF-P0-3)', () => {
    it('(a) no resolvable contractor identity (no state param) → rejects, writes nothing to tokens', async () => {
      setAxiosPostImpl(defaultOauthAxiosStub());

      const resp = await httpGet(port, '/callback?code=code-no-state');
      await new Promise(r => setTimeout(r, 100));

      const { rows } = await pool.query('SELECT * FROM tokens');
      assert.equal(rows.length, 0, 'no tokens row written when no contractor identity can be resolved');
      assert.notEqual(resp.status, 302, 'must not redirect as if the connection succeeded');
    });

    it('(b) contractor_id resolves but does not exist in contractors table → rejects, writes nothing', async () => {
      setAxiosPostImpl(defaultOauthAxiosStub());
      const GHOST_ID = 'tf-test-contractor-ghost-does-not-exist';

      const resp = await httpGet(port, `/callback?code=code-ghost&state=${GHOST_ID}`);
      await new Promise(r => setTimeout(r, 100));

      const { rows } = await pool.query('SELECT * FROM tokens WHERE contractor_id = $1', [GHOST_ID]);
      assert.equal(rows.length, 0, 'no tokens row written for a contractor_id that does not exist in the contractors table');
      assert.notEqual(resp.status, 302, 'must not redirect as if the connection succeeded');
    });
  });
});
