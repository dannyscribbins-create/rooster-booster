'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CANVASS-3.6 — RED SUITE — GET /api/admin/jobber-users MUST REACH EVERY USER
//
// THE RULING (Danny, 2026-09-17): an admin must be able to select ANY existing
// Jobber user, including retired ones. A user who cannot be mapped can never be
// attributed, so a list that quietly loses people breaks rep attribution at its
// root — and does it silently, months before anyone notices.
//
// ── ⚠ WHAT WAS ACTUALLY BROKEN, WHICH IS NOT WHAT IT LOOKED LIKE ────────────
// The phase was opened on "users(first: 50) caps the list at 50, so ~97 of
// Accent's 147 users are unreachable." **Measured at HEAD before any edit, that
// was not true**: the handler already paged to exhaustion on
// `pageInfo.hasNextPage`, and the client already filtered on name AND email. 50
// is a PAGE SIZE.
//
// Three real defects sat underneath it, and they are what this file fences:
//   1. THE LOOP WAS UNBOUNDED. A cursor that never stops advancing spins a
//      request handler against a remote API forever.
//   2. `if (!usersData) break;` RETURNED 200 WITH A TRUNCATED LIST. This is the
//      one that matters. Jobber answers a GraphQL failure with **HTTP 200** and
//      an `errors` array, so `jobberShouldRetry` — which reads only
//      `error.response.status` — never sees it and `retryWithBackoff` resolves
//      happily. Page 2 of 3 failing produced a short list; page 1 failing
//      produced an EMPTY list, indistinguishable from "this account has no
//      users". An admin searches for a colleague, does not find them, and
//      concludes they are not in Jobber.
//   3. NO CACHE. Three Jobber round trips every time the drawer opened.
//
// ── ⚠ WHAT THIS SUITE CANNOT PROVE, SAID HERE RATHER THAN DISCOVERED ────────
// Every Jobber response below is a FIXTURE. The local stack has **zero** rows in
// `tokens`, so no real Jobber call is possible from this environment, and
// calling Accent's production account from a test run is forbidden. So this file
// proves the HANDLER's behaviour given a shape; it proves nothing about what
// Jobber actually returns. The live half is recorded in PRE_LAUNCH_CHECKLIST.md
// as a dated GraphiQL verification, and the one open question — whether a User
// carries a status/active field at our pinned version — is filed there with the
// introspection query, unbuilt, because a field name that does not exist makes
// the WHOLE query fail and would break the picker completely.
//
// ⚠ AND THE axios FENCE IS A SAFETY INTERLOCK, NOT A CONVENIENCE.
// `.env` is loaded alongside `.env.test`, so Accent's live credentials are in
// this process — the hazard `jobberSyncRepair.test.js` documents. `axios.post`
// is patched in `beforeEach` to a function that THROWS, so any call this suite
// did not deliberately arrange fails loudly instead of reaching the network.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const axios = require('axios');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor, seedToken } = require('./helpers');

const TENANT = 'jobber-picker-tenant';

let pool;
let server;
let port;
let realAxiosPost;
let calls = [];
const base = () => `http://localhost:${port}`;

// ── FIXTURES ────────────────────────────────────────────────────────────────

const user = (n, opts = {}) => ({
  id: `usr_${n}`,
  name: { full: opts.full || `User ${n}` },
  email: { raw: opts.email || `user${n}@example.test` },
});

// Builds a Jobber-shaped success response for one page.
const page = (nodes, { hasNextPage = false, endCursor = null, totalCount = null }) => ({
  data: { data: { users: { nodes, pageInfo: { hasNextPage, endCursor }, totalCount } } },
});

// ⚠ THE SHAPE OF A JOBBER GRAPHQL FAILURE, AND IT IS THE WHOLE POINT OF THIS
// FILE: HTTP 200, `data` null, an `errors` array. Not a rejection. Not a 4xx.
// A fixture that threw here would be testing a path the real API does not take.
const gqlError = (message) => ({
  status: 200,
  data: { data: null, errors: [{ message }] },
});

async function adminToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions, is_field_rep, active)
     VALUES ($1, 'picker-owner@x.test', 'x', 'owner', '{}'::jsonb, false, true)
     ON CONFLICT (email) DO UPDATE SET contractor_id = EXCLUDED.contractor_id, active = true
     RETURNING id`,
    [TENANT]
  );
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
     VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
    [token, TENANT, rows[0].id]
  );
  return token;
}

const get = (token, qs = '') => fetch(`${base()}/api/admin/jobber-users${qs}`, {
  headers: { Authorization: `Bearer ${token}` },
});

// Reads status and body together and REFUSES a non-JSON body, so no assertion
// here can be satisfied by Express's own HTML error page.
async function readJson(res) {
  const ct = res.headers.get('content-type') || '';
  assert.ok(ct.includes('application/json'), `expected JSON, got '${ct}' with status ${res.status}`);
  return { status: res.status, body: await res.json() };
}

describe('Canvass-3.6 — the Jobber user picker reaches every user, or fails loudly', () => {
  let token;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
    realAxiosPost = axios.post;
    await seedContractor(pool, TENANT);
    await seedToken(pool, { contractorId: TENANT });
    token = await adminToken();
  });

  after(async () => {
    axios.post = realAxiosPost;
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    calls = [];
    // THE FENCE: anything not deliberately arranged by a test throws rather than
    // reaching api.getjobber.com with live credentials.
    axios.post = async (...args) => { calls.push(args); throw new Error('harness: unexpected axios.post'); };
    // The cache is per (contractor_id, cache_key); clearing it makes each case
    // independent of the one before, which otherwise passes by replay.
    await pool.query('DELETE FROM admin_cache WHERE contractor_id = $1', [TENANT]);
  });

  // ── 1. MULTI-PAGE ─────────────────────────────────────────────────────────
  it('[RED] an account spanning three pages returns EVERY user, not the first page', async () => {
    // 147 is Accent's real count, measured in GraphiQL 2026-09-17 — the fixture
    // reproduces the live shape rather than a round number.
    const all = Array.from({ length: 147 }, (_, i) => user(i + 1));
    axios.post = async (url, body) => {
      calls.push(body.query);
      const after = /after: "([^"]+)"/.exec(body.query);
      const start = after ? Number(after[1]) : 0;
      const slice = all.slice(start, start + 50);
      const next = start + 50;
      return page(slice, { hasNextPage: next < all.length, endCursor: String(next), totalCount: all.length });
    };

    const { status, body } = await readJson(await get(token));
    assert.equal(status, 200);
    assert.equal(body.users.length, 147, 'the handler did not page to exhaustion');
    assert.equal(body.totalCount, 147);
    assert.equal(calls.length, 3, `expected 3 pages of 50, saw ${calls.length} request(s)`);
    // ⚠ IDENTITY, NOT JUST COUNT. A handler that returned page one three times
    // would satisfy a length check against a 150-long fixture and be wrong.
    assert.equal(body.users[0].id, 'usr_1');
    assert.equal(body.users[146].id, 'usr_147');
    assert.equal(new Set(body.users.map(u => u.id)).size, 147, 'duplicate users — a page was repeated');
  });

  it('[RED] the SECOND page is requested with an `after` cursor — the mechanism, not the total', async () => {
    // Guard-proof for the case above: 147 users could also arrive from one giant
    // page. This pins that pagination is what produced them.
    const all = Array.from({ length: 60 }, (_, i) => user(i + 1));
    axios.post = async (url, body) => {
      calls.push(body.query);
      const after = /after: "([^"]+)"/.exec(body.query);
      const start = after ? Number(after[1]) : 0;
      return page(all.slice(start, start + 50), {
        hasNextPage: start + 50 < all.length, endCursor: String(start + 50), totalCount: all.length,
      });
    };
    await readJson(await get(token));
    assert.equal(calls.length, 2);
    assert.ok(!/after:/.test(calls[0]), 'the first page should carry no cursor');
    assert.match(calls[1], /after: "50"/, 'the second page did not carry the endCursor');
  });

  // ── 2. THE SILENT TRUNCATION — THE DEFECT THIS PHASE EXISTS FOR ───────────
  it('[RED] a GraphQL error on page 2 is a typed 502 — NOT 200 with a short list', async () => {
    const all = Array.from({ length: 120 }, (_, i) => user(i + 1));
    let n = 0;
    axios.post = async () => {
      n += 1;
      if (n === 1) return page(all.slice(0, 50), { hasNextPage: true, endCursor: '50', totalCount: 120 });
      return gqlError('Throttled');
    };

    const { status, body } = await readJson(await get(token));
    assert.equal(status, 502, 'a mid-paging failure was served as success');
    assert.equal(body.error, 'Could not load the full Jobber user list');
    assert.ok(body.users === undefined, 'a partial list leaked into the error body');
  });

  it('[RED] a GraphQL error on page ONE is a 502, not 200 with an EMPTY list', async () => {
    // ⚠ THE WORST CASE, AND THE MOST CONVINCING ONE. An empty 200 is
    // indistinguishable from an account that genuinely has no users — the admin
    // sees "no users match" for every search and has no reason to suspect a
    // failure.
    axios.post = async () => gqlError('PERMISSION_DENIED');
    const { status, body } = await readJson(await get(token));
    assert.equal(status, 502);
    assert.ok(!Array.isArray(body.users), 'an empty user list was served as success');
  });

  it('[RED] collecting FEWER users than Jobber\'s own totalCount is a 502', async () => {
    // A page that reports hasNextPage:false while totalCount says there are more
    // — truncation with no error anywhere to notice it.
    axios.post = async () => page([user(1), user(2)], { hasNextPage: false, totalCount: 147 });
    const { status } = await readJson(await get(token));
    assert.equal(status, 502, 'a shortfall against totalCount was served as success');
  });

  it('MORE users than totalCount is served, not failed — deliberately asymmetric', async () => {
    // Fewer than promised loses people and must fail. More than promised loses
    // nobody; turning an upstream quirk into an outage on a live admin screen is
    // the wrong trade for a count we do not control. Asserted so the asymmetry
    // is a decision rather than an oversight.
    axios.post = async () => page([user(1), user(2), user(3)], { hasNextPage: false, totalCount: 2 });
    const { status, body } = await readJson(await get(token));
    assert.equal(status, 200);
    assert.equal(body.users.length, 3);
  });

  // ── 3. THE UPPER BOUND ────────────────────────────────────────────────────
  it('[RED] a cursor that never terminates hits the page bound and raises a TYPED error', async () => {
    // The unbounded-loop case: hasNextPage is always true. Before the bound this
    // spun forever against a remote API inside a request handler.
    axios.post = async () => {
      calls.push(1);
      return page([user(calls.length)], { hasNextPage: true, endCursor: String(calls.length), totalCount: null });
    };

    const { status, body } = await readJson(await get(token));
    assert.equal(status, 502);
    assert.equal(body.error, 'Jobber user list is larger than expected');
    assert.ok(body.users === undefined, 'a truncated list was returned alongside the error');
    // ⚠ BOUNDED, AND THE NUMBER IS ASSERTED. Without this the case passes
    // against a bound of one page, which would break every real account.
    assert.equal(calls.length, 40, `expected exactly 40 pages before the bound fired, saw ${calls.length}`);
  });

  // ── 4. CACHING ────────────────────────────────────────────────────────────
  it('[RED] a second request inside the TTL is served from cache with no Jobber call', async () => {
    axios.post = async () => { calls.push(1); return page([user(1), user(2)], { hasNextPage: false, totalCount: 2 }); };

    const first = await readJson(await get(token));
    assert.equal(first.status, 200);
    assert.equal(first.body.cached, false);
    assert.equal(calls.length, 1);

    const second = await readJson(await get(token));
    assert.equal(second.status, 200);
    assert.equal(second.body.cached, true, 'the second call was not served from cache');
    assert.equal(second.body.users.length, 2);
    assert.equal(calls.length, 1, 'the cached path still called Jobber');
  });

  it('[RED] ?refresh=1 bypasses the cache', async () => {
    axios.post = async () => { calls.push(1); return page([user(1)], { hasNextPage: false, totalCount: 1 }); };
    await readJson(await get(token));
    assert.equal(calls.length, 1);
    const forced = await readJson(await get(token, '?refresh=1'));
    assert.equal(forced.body.cached, false);
    assert.equal(calls.length, 2, 'refresh=1 did not reach Jobber');
  });

  it('[RED] a FAILED fetch is never cached — the next request retries rather than serving the failure', async () => {
    // ⚠ CACHING BEFORE THE INTEGRITY CHECKS WOULD MAKE ONE BAD FETCH STICK FOR
    // TEN MINUTES, which converts a transient upstream blip into a sustained
    // wrong answer. The write sits after every check for exactly this reason.
    axios.post = async () => gqlError('Throttled');
    assert.equal((await readJson(await get(token))).status, 502);

    axios.post = async () => page([user(1), user(2)], { hasNextPage: false, totalCount: 2 });
    const after = await readJson(await get(token));
    assert.equal(after.status, 200);
    assert.equal(after.body.cached, false, 'the failure was cached');
    assert.equal(after.body.users.length, 2);
  });

  it('the cache row is tenant-scoped, and is written only on success', async () => {
    axios.post = async () => page([user(1)], { hasNextPage: false, totalCount: 1 });
    await readJson(await get(token));
    const { rows } = await pool.query(
      `SELECT contractor_id, cache_key, jsonb_array_length(data->'users') AS n
         FROM admin_cache WHERE contractor_id = $1 AND cache_key = 'jobber_users'`,
      [TENANT]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].contractor_id, TENANT);
    assert.equal(Number(rows[0].n), 1);
  });

  // ── 4b. THE `status` FIELD AND ITS DEGRADATION (Canvass-3.6b) ────────────
  //
  // ⚠ THE RISK THIS SECTION EXISTS FOR. `User.status` was introspected live on
  // 2026-09-17 — but in an explorer running **2026-05-12**, while this client
  // pins **2026-02-17**. GraphQL has no optional field: if `status` does not
  // exist at our version the WHOLE query fails, which reaches the handler as
  // `data.users === undefined` and — under the 502 rule this file already
  // fences — would take the picker from "no marker" to **"no picker at all"**,
  // on every contractor, permanently.
  //
  // The handler therefore requests `status` and retries ONCE without it on a
  // FIRST-PAGE failure. These cases pin both halves and the boundary between
  // them.
  describe('the status field, requested optimistically', () => {
    it('[RED] status is SELECTED in the query, and passed through to the client', async () => {
      axios.post = async (url, body) => {
        calls.push(body.query);
        return page(
          [{ ...user(1), status: 'DEACTIVATED' }, { ...user(2), status: 'ACTIVATED' }],
          { hasNextPage: false, totalCount: 2 }
        );
      };
      const { status, body } = await readJson(await get(token));
      assert.equal(status, 200);
      assert.match(calls[0], /status/, 'the query did not select status');
      assert.equal(body.statusAvailable, true);
      // ⚠ BOTH USERS ARE PRESENT. The ruling is that a deactivated user stays
      // SELECTABLE — the route must never filter on this field, and a test that
      // only checked the value passed through would not notice if it did.
      assert.equal(body.users.length, 2);
      assert.equal(body.users.find(u => u.id === 'usr_1').status, 'DEACTIVATED');
      assert.equal(body.users.find(u => u.id === 'usr_2').status, 'ACTIVATED');
    });

    it('[RED] a first-page failure WITH status retries WITHOUT it and serves the full list', async () => {
      // The degradation. Failing here instead would be the "no picker" outcome.
      let n = 0;
      axios.post = async (url, body) => {
        n += 1;
        calls.push(body.query);
        if (/status/.test(body.query)) return gqlError("Field 'status' doesn't exist on type 'User'");
        return page([user(1), user(2)], { hasNextPage: false, totalCount: 2 });
      };

      const { status, body } = await readJson(await get(token));
      assert.equal(status, 200, 'an unknown status field took the whole picker down');
      assert.equal(body.users.length, 2, 'the fallback did not return the full list');
      // ⚠ REPORTED, NOT SILENT. Without this the admin cannot tell "nobody is
      // deactivated" from "we could not ask".
      assert.equal(body.statusAvailable, false);
      assert.equal(n, 2, 'expected exactly one retry');
      assert.match(calls[0], /status/);
      assert.ok(!/status/.test(calls[1]), 'the retry still selected status');
    });

    it('[RED] the retry happens ONCE — a second failure is still a 502', async () => {
      // Guard-proof for the case above: a fallback that swallowed every failure
      // would reintroduce the silent-truncation defect this file exists to close.
      axios.post = async (url, body) => { calls.push(body.query); return gqlError('Throttled'); };
      const { status } = await readJson(await get(token));
      assert.equal(status, 502);
      assert.equal(calls.length, 2, 'expected one attempt with status and one without, then failure');
    });

    it('[RED] a failure on page TWO is a 502 — it does NOT retry without status', async () => {
      // ⚠ THE BOUNDARY, AND IT IS THE CASE MOST LIKELY TO BE GOT WRONG. Once page
      // one has succeeded WITH status, the field demonstrably exists — so a later
      // failure is a real failure. Retrying mid-paging would also produce a list
      // where some users carry a status and others do not, with nothing saying so.
      let n = 0;
      axios.post = async (url, body) => {
        n += 1;
        calls.push(body.query);
        if (n === 1) return page([{ ...user(1), status: 'ACTIVATED' }], { hasNextPage: true, endCursor: '50', totalCount: 60 });
        return gqlError('Throttled');
      };
      const { status } = await readJson(await get(token));
      assert.equal(status, 502);
      assert.equal(n, 2, 'page two was retried when it should have failed');
      assert.ok(/status/.test(calls[1]), 'page two dropped status — it should not have');
    });

    it('[RED] every one of the five enum values survives the round trip unaltered', async () => {
      // The route must not normalise, map or bucket these — the copy decision is
      // open and belongs to the client. Four of the five are non-active.
      const ENUM = ['ACTIVATED', 'DEACTIVATED', 'NOT_INVITED', 'RESEND_INVITE', 'SEND_INVITE'];
      axios.post = async () => page(
        ENUM.map((s, i) => ({ ...user(i + 1), status: s })),
        { hasNextPage: false, totalCount: 5 }
      );
      const { body } = await readJson(await get(token));
      assert.deepEqual(body.users.map(u => u.status), ENUM);
    });

    it('a cached response preserves statusAvailable', async () => {
      axios.post = async (url, body) => {
        if (/status/.test(body.query)) return gqlError('nope');
        return page([user(1)], { hasNextPage: false, totalCount: 1 });
      };
      const first = await readJson(await get(token));
      assert.equal(first.body.statusAvailable, false);
      const second = await readJson(await get(token));
      assert.equal(second.body.cached, true);
      assert.equal(second.body.statusAvailable, false, 'the cache lost the flag');
    });
  });

  // ── 5. THE PINNED VERSION ─────────────────────────────────────────────────
  it('every Jobber request carries the PINNED API version, on every page', async () => {
    // CLAUDE.md, Never Break → Jobber API. Asserted on EVERY page rather than
    // the first, because a header built inside a loop can drift on a later
    // iteration and a first-page-only check would not see it.
    const seen = [];
    axios.post = async (url, body, cfg) => {
      seen.push(cfg?.headers?.['X-JOBBER-GRAPHQL-VERSION']);
      const after = /after: "([^"]+)"/.exec(body.query);
      const start = after ? Number(after[1]) : 0;
      return page([user(start + 1)], { hasNextPage: start < 50, endCursor: String(start + 50), totalCount: 2 });
    };
    await get(token);
    assert.ok(seen.length >= 2, `expected more than one page, saw ${seen.length}`);
    for (const v of seen) assert.equal(v, '2026-02-17');
  });

  // ── 6. THE GUARDS THAT PREDATE THIS PHASE, RE-ASSERTED ───────────────────
  it('no Jobber connection is a typed 503, and never reaches the network', async () => {
    await pool.query('DELETE FROM tokens WHERE contractor_id = $1', [TENANT]);
    const { status, body } = await readJson(await get(token));
    assert.equal(status, 503);
    assert.equal(body.error, 'Jobber not connected');
    assert.equal(calls.length, 0, 'the handler called out with no token');
    await seedToken(pool, { contractorId: TENANT });
  });

  it('an unauthenticated request is refused before any Jobber call', async () => {
    const res = await fetch(`${base()}/api/admin/jobber-users`);
    assert.equal(res.status, 401);
    assert.equal(calls.length, 0);
  });
});
