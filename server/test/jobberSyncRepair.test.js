'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 0.2 — SYNC + TOKEN-PATH REPAIR. RED-FIRST TESTS.
//
// Companion to jobberIngestionRepair.test.js. This file covers the sites with no
// _setTestOverrides seam: the nightly cron (cron/jobs/jobberIncrementalSync.js)
// and fetchReferrerContact (utils/pendingReferral.js).
//
// ⚠ HOW THESE DRIVE UNEXPORTED CODE WITHOUT TOUCHING PRODUCTION FILES.
// jobberIncrementalSync exports only startJobberIncrementalSyncJob(); runIncrementalSync
// and runForContractor are private. Rather than add a seam (which is a production
// change, and Phase 1 modifies no production code), these tests:
//   1. patch node-cron's `schedule` to CAPTURE the registered callback, then invoke it;
//   2. patch `axios.post` on the shared require-cache instance.
// Both are property lookups performed at CALL time, so patching the shared module
// object reaches the sync module even though it captured its reference at load time.
// Everything is restored in after(). --test-concurrency=1 makes this safe.
//
// ⚠ Phase 2 should still add a proper _setTestOverrides seam to the sync module.
// The patching above is sound but it is the kind of cleverness that rots; the seam
// is what makes T5/T6 legible to the next session.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const axios = require('axios');
const cron = require('node-cron');

const TENANT = 'sync-tenant-a';

describe('Wave 0.2 — sync pagination, token refresh and the sanctioned token path (RED first)', () => {
  let pool;
  let realAxiosPost, realCronSchedule;
  let capturedCronTask = null;
  let requests = [];

  before(async () => {
    pool = await initTestDb();

    realAxiosPost = axios.post;
    realCronSchedule = cron.schedule;

    // Capture the callback the cron job registers instead of scheduling it.
    cron.schedule = (_expr, fn) => { capturedCronTask = fn; return { stop() {} }; };
    require('../cron/jobs/jobberIncrementalSync').startJobberIncrementalSyncJob();
    assert.ok(typeof capturedCronTask === 'function', 'harness: the cron callback must have been captured');
  });

  after(async () => {
    axios.post = realAxiosPost;
    cron.schedule = realCronSchedule;
    await pool.end();
  });

  beforeEach(async () => {
    requests = [];
    axios.post = async (...args) => { requests.push(args); throw new Error('harness: unexpected axios.post call'); };
    await pool.query('DELETE FROM contact_tags');
    await pool.query('DELETE FROM jobber_clients');
    await pool.query('DELETE FROM pending_referrals');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM tokens');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM notifications');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM contacts');
    await pool.query('DELETE FROM contractors');
  });

  // ── HARNESS ────────────────────────────────────────────────────────────────

  async function seedTenant({ expired = false } = {}) {
    await pool.query(
      `INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]
    );
    await pool.query(
      `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
       VALUES ($1, 'sync-access-token', 'sync-refresh-token', NOW() + ($2 || ' minutes')::interval)`,
      [TENANT, expired ? '-120' : '120']
    );
  }

  function clientNode(i) {
    return {
      id: `jc-sync-${String(i).padStart(3, '0')}`,
      firstName: `First${i}`, lastName: `Last${i}`,
      isCompany: false, isLead: false,
      createdAt: new Date().toISOString(),
      emails: [{ address: `c${i}@example.com`, primary: true }],
      phones: [{ number: `770-555-${String(i).padStart(4, '0')}`, primary: true }],
      tags: { nodes: [] }, customFields: [],
    };
  }

  // Returns the cursor a paginating implementation would have sent, or null.
  // Checked BOTH ways a fix might carry it — bound GraphQL variables (the shape
  // the query's own `$after` declaration expects) or string interpolation — so the
  // test pins the BEHAVIOUR (a second page was requested) and not one spelling of
  // the fix.
  function cursorOf(body) {
    if (body?.variables?.after) return body.variables.after;
    const m = /after:\s*"([^"]+)"/.exec(body?.query || '');
    return m ? m[1] : null;
  }

  const isClientsQuery = body => /GetRecentClients|clients\s*\(/.test(body?.query || '');

  // ⚠ THE CRON CALLBACK IS NOT AWAITABLE. jobberIncrementalSync.js:283-285 registers
  //     () => { withLock('jobber_incremental_sync', 20, async () => { ... }); }
  // — a braced body that returns undefined rather than the withLock promise. So
  // `await capturedCronTask()` awaits nothing and the sync runs detached. Every
  // assertion below therefore has to poll for the work, exactly like the
  // fire-and-forget webhook handlers in jobberIngestionRepair.test.js.
  //
  // The timeout is swallowed on purpose: this BOUNDS the wait, and the assertions
  // are what decide the outcome. Letting it throw would replace a precise failure
  // ("0 clients queries were made") with a generic timeout.
  async function runSyncAndSettle(predicate, timeout = 8000) {
    await capturedCronTask();
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await predicate()) return;
      await new Promise(r => setTimeout(r, 40));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // T5 — PAGINATION.
  //
  // ⚠ THE FALSE-HEALTH SHAPE IN ITS PUREST FORM. jobberIncrementalSync.js:277
  // logs "Done — N clients processed" where N is recentClients.length, which is
  // capped at the page size. A truncated run and a complete run emit an
  // identical, healthy-looking line. So this test asserts the ROW COUNT, never
  // the log — per CLAUDE.md's rule that a mechanism reporting health it cannot
  // observe is worse than no mechanism.
  // ─────────────────────────────────────────────────────────────────────────
  it('T5 — the nightly sync must follow hasNextPage and process every page (RED: the query declares $after but the request body binds no variables, and pageInfo is selected and never read, so exactly the first 50 land and the run reports success)', { skip: 'Wave 0.2 item 4 — pagination. UN-SKIP when item 4 lands.' }, async () => {
    await seedTenant();

    const page1 = Array.from({ length: 50 }, (_, i) => clientNode(i));
    const page2 = Array.from({ length: 10 }, (_, i) => clientNode(50 + i));

    axios.post = async (url, body, opts) => {
      requests.push({ url, body, opts });
      if (isClientsQuery(body)) {
        const cursor = cursorOf(body);
        return cursor === 'CURSOR-PAGE-2'
          ? { data: { data: { clients: { nodes: page2, pageInfo: { hasNextPage: false, endCursor: null } } } } }
          : { data: { data: { clients: { nodes: page1, pageInfo: { hasNextPage: true, endCursor: 'CURSOR-PAGE-2' } } } } };
      }
      // Per-client related-data query.
      return { data: { data: { client: { jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] } } } } };
    };

    // Settle on the fixed behaviour (60 rows). On current code this polls out and
    // the assertions report what actually landed.
    await runSyncAndSettle(async () => {
      const { rows } = await pool.query(
        'SELECT count(*)::int AS n FROM jobber_clients WHERE contractor_id = $1', [TENANT]
      );
      return rows[0].n >= 60;
    });

    const clientsRequests = requests.filter(r => isClientsQuery(r.body));
    const secondPage = clientsRequests.filter(r => cursorOf(r.body) === 'CURSOR-PAGE-2');

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM jobber_clients WHERE contractor_id = $1', [TENANT]
    );

    assert.equal(secondPage.length, 1,
      `the sync must request page 2 using the endCursor it was handed — ${clientsRequests.length} clients query/queries were made, none carrying the cursor; ${rows[0].n} of 60 clients landed`);
    assert.equal(rows[0].n, 60,
      `every client across both pages must be upserted — only ${rows[0].n} landed, which is the page size, not the population`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T6 — AN EXPIRED TOKEN MUST BE REFRESHED, NOT SURRENDERED TO.
  //
  // jobberIncrementalSync.js:32-35 reads expires_at and returns. That is the
  // backstop for the very webhook failures this wave is repairing, and it is
  // disabled by exactly the condition that causes them (1A-1, S3).
  // ─────────────────────────────────────────────────────────────────────────
  it('T6 — an expired token must be refreshed and the sync must proceed (RED: jobberIncrementalSync.js:32-35 compares expires_at to now and returns, so not one Jobber request is ever made)', async () => {
    await seedTenant({ expired: true });

    axios.post = async (url, body, opts) => {
      requests.push({ url, body, opts });
      if (/oauth\/token/.test(url)) {
        return { data: { access_token: 'refreshed-access', refresh_token: 'refreshed-refresh', expires_in: 3600 } };
      }
      if (isClientsQuery(body)) {
        return { data: { data: { clients: { nodes: [clientNode(1)], pageInfo: { hasNextPage: false, endCursor: null } } } } };
      }
      return { data: { data: { client: { jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] } } } } };
    };

    await runSyncAndSettle(async () => {
      const { rows } = await pool.query(
        'SELECT count(*)::int AS n FROM jobber_clients WHERE contractor_id = $1', [TENANT]
      );
      return rows[0].n >= 1;
    });

    const graphqlCalls = requests.filter(r => isClientsQuery(r.body));
    assert.ok(graphqlCalls.length > 0,
      'an expired token must be refreshed and the sync must continue — instead the run made no Jobber request at all');

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM jobber_clients WHERE contractor_id = $1', [TENANT]
    );
    assert.equal(rows[0].n, 1, 'the sync must have upserted the client it fetched after refreshing');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T4b — fetchReferrerContact FAILS SILENTLY (Ruling A).
  //
  // pendingReferral.js:258-262 raw-reads the token and, on absence, returns
  // { phone: null, email: null }. Those two nulls are written straight onto
  // pending_referrals.referred_by_email / referred_by_phone — the exact column
  // pair matchPendingReferral() keys on. The result is a pending referral that
  // can never match, with no record anywhere of why.
  //
  // ⚠ Same defect class as the webhook 401s never reaching error_log (Ruling C):
  // a downstream symptom with the cause discarded.
  // ─────────────────────────────────────────────────────────────────────────
  it('T4b — a token failure inside fetchReferrerContact must be logged (RED: pendingReferral.js:262 returns { phone: null, email: null } and calls no logError, so the referral is left permanently unmatchable with no record of the cause)', async () => {
    // Contractor exists; deliberately NO tokens row.
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, $1)
       ON CONFLICT (contractor_id) DO NOTHING`, [TENANT]
    );

    const { checkAndCreatePendingReferral } = require('../utils/pendingReferral');

    const referredClient = {
      id: 'jc-t4b-referred', firstName: 'Referred', lastName: 'Person',
      customFields: [], emails: [], phones: [],
    };
    // Exactly one name match, so the single-match branch runs and reaches
    // fetchReferrerContact — the multi/zero-match branch never calls it.
    const allClients = [{ id: 'jc-t4b-referrer', firstName: 'Jane', lastName: 'Referrer' }];

    await checkAndCreatePendingReferral(TENANT, referredClient, 'Jane Referrer', allClients);

    // Precondition: the branch under test actually ran. Without this, a future
    // change that stops reaching fetchReferrerContact would leave the RED
    // assertion below passing for the wrong reason.
    const { rows: prRows } = await pool.query(
      `SELECT referrer_lookup_attempted, referred_by_email, referred_by_phone
       FROM pending_referrals WHERE jobber_client_id = 'jc-t4b-referred'`
    );
    assert.equal(prRows.length, 1, 'precondition: the pending_referrals row must have been created');
    assert.equal(prRows[0].referrer_lookup_attempted, true, 'precondition: the single-match lookup branch must have run');
    assert.equal(prRows[0].referred_by_email, null, 'precondition: the lookup produced no email — this is the silent failure');

    const { rows: errs } = await pool.query('SELECT error_message, source FROM error_log');
    assert.ok(errs.length > 0,
      'a token failure that leaves a pending referral permanently unmatchable must be recorded in error_log — nothing was logged');
    assert.ok(
      errs.some(e => /token/i.test(e.error_message) || /referrer.?contact/i.test(e.source || '')),
      `the record must identify the cause as a token failure — got: ${JSON.stringify(errs)}`
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T4-source — THE SANCTIONED TOKEN PATH, ALL FIVE SITES.
  //
  // The three webhook handlers are asserted BEHAVIOURALLY in
  // jobberIngestionRepair.test.js (T4). The two sites here have no seam, so this
  // reads the SOURCE TEXT — the instrument CLAUDE.md prescribes when a claim is
  // about what a file says rather than what it returns ("Where a claim matters,
  // the guard reads the source TEXT and asserts on the sentence").
  //
  // ⚠ Scoped to the enclosing FUNCTION, not the whole file, and located by
  // signature rather than line number — so it cannot drift, and it cannot demand
  // changes to call sites outside this session's approved scope (invoice-paid's
  // two reads at :700/:730 already refresh first and are deliberately untouched).
  // ─────────────────────────────────────────────────────────────────────────
  const RAW_TOKEN_READ = /SELECT\s+access_token[\s\S]{0,80}?FROM\s+tokens/i;

  function sliceBetween(source, startPattern, endPattern) {
    const start = source.search(startPattern);
    assert.notEqual(start, -1, `harness: could not locate ${startPattern} — the test needs re-anchoring`);
    const rest = source.slice(start + 1);
    const end = rest.search(endPattern);
    return end === -1 ? source.slice(start) : source.slice(start, start + 1 + end);
  }

  const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

  const SITES = [
    {
      name: 'client-create handler (webhooks/jobber.js:490)',
      file: 'routes/webhooks/jobber.js',
      start: /router\.post\('\/jobber\/client-create'/,
      end: /router\.post\(/,
    },
    {
      name: 'client-update handler (webhooks/jobber.js:580)',
      file: 'routes/webhooks/jobber.js',
      start: /router\.post\('\/jobber\/client-update'/,
      end: /router\.post\(/,
    },
    {
      name: 'job-update handler (webhooks/jobber.js:1191)',
      file: 'routes/webhooks/jobber.js',
      start: /router\.post\('\/jobber\/job-update'/,
      end: /module\.exports/,
    },
    {
      name: 'fetchReferrerContact (utils/pendingReferral.js:259)',
      file: 'utils/pendingReferral.js',
      start: /async function fetchReferrerContact\(/,
      end: /\nasync function |\nfunction /,
    },
    {
      name: 'runForContractor (cron/jobs/jobberIncrementalSync.js:22)',
      file: 'cron/jobs/jobberIncrementalSync.js',
      start: /async function runForContractor\(/,
      end: /\nfunction startJobberIncrementalSyncJob/,
    },
  ];

  for (const site of SITES) {
    it(`T4-source — ${site.name} must not read the tokens table directly (RED: it raw-SELECTs access_token, bypassing refreshTokenIfNeeded and getContractorAccessToken — a Never-Break rule in CLAUDE.md)`, () => {
      const body = sliceBetween(read(site.file), site.start, site.end);
      // Non-vacuity: prove the slice actually contains the function before
      // asserting on what it lacks. An empty slice would pass silently.
      assert.ok(body.length > 200, `harness: the slice for ${site.name} is too short to be the real body`);
      assert.equal(
        RAW_TOKEN_READ.test(body), false,
        `${site.name} still reads tokens.access_token directly — it must acquire its token through the sanctioned path`
      );
    });
  }
});
