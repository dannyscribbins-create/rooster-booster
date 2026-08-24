'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 0.2 — SYNC + TOKEN-PATH REPAIR. RED-FIRST TESTS.
//
// Companion to jobberIngestionRepair.test.js. This file covers the sites with no
// _setTestOverrides seam: the nightly cron (cron/jobs/jobberIncrementalSync.js)
// and fetchReferrerContact (utils/pendingReferral.js).
//
// ⚠ THIS HEADER DESCRIBED THE OLD HARNESS AND HAS BEEN CORRECTED (item 4e).
// It used to read: "jobberIncrementalSync exports only startJobberIncrementalSyncJob();
// rather than add a seam — a production change, and Phase 1 modifies no production
// code — these tests patch node-cron's schedule to capture the registered callback,
// and patch axios.post on the shared require-cache instance." That was accurate for
// Phase 1 and is now false in every particular.
//
// The module exports runIncrementalSync / runForContractor and a _setTestOverrides
// http seam, so these tests call the real code directly and await it. The cron
// callback is also awaitable now (item 4d), which is what let the polling go.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Still required: the seam covers this module's calls, but refreshTokenIfNeeded in
// crm/jobber.js holds its own axios reference and must be fenced too. See setBoth.
const axios = require('axios');

// Wave 0.2 item 4e: the module now exports its runners and an http seam, so these
// tests call the real code directly. They previously reached it by patching
// node-cron's schedule and axios.post on the shared require cache — sound, and
// documented, but dependent on how the module happens to load.
const syncJob = require('../cron/jobs/jobberIncrementalSync');
const { runIncrementalSync, _setTestOverrides, _resetTestOverrides } = syncJob;

const TENANT = 'sync-tenant-a';

describe('Wave 0.2 — sync pagination, token refresh and the sanctioned token path (RED first)', () => {
  let pool;
  let realAxiosPost;
  let requests = [];

  // ⚠ TWO INTERCEPTION LAYERS, AND BOTH ARE LOAD-BEARING.
  //
  // The seam (item 4e) covers THIS module's Jobber calls and is what the tests
  // assert against. It does NOT cover refreshTokenIfNeeded, which lives in
  // crm/jobber.js and holds its own axios reference — and T6 deliberately drives an
  // EXPIRED token, so it triggers a real OAuth token exchange against
  // api.getjobber.com. Rotating Accent's live refresh token from a test run would
  // invalidate the production credential.
  //
  // So global axios.post stays patched as a fence: anything not covered by the seam
  // is caught rather than escaping to the network. Same class of hazard as the
  // RESEND_API_KEY leak documented in errorLoggerAlertFlag.test.js — .env is loaded
  // alongside .env.test, so live credentials are present in this process.
  const setBoth = fn => { axios.post = fn; _setTestOverrides({ axiosPost: fn }); };

  before(async () => {
    pool = await initTestDb();
    realAxiosPost = axios.post;
  });

  after(async () => {
    axios.post = realAxiosPost;
    _resetTestOverrides();
    await pool.end();
  });

  beforeEach(async () => {
    requests = [];
    setBoth(async (...args) => { requests.push(args); throw new Error('harness: unexpected axios.post call'); });
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

  // ⚠ THE POLLING IS GONE, AND RETIRING IT IS ITEM 4d/4e's POINT.
  // This helper used to invoke a cron callback captured off node-cron and then POLL,
  // because the job registered a braced body — () => { withLock(...); } — which
  // returns undefined, so awaiting it awaited nothing and the sync ran detached.
  // Item 4d removed the braces and item 4e exported the runner, so the job is
  // genuinely awaitable now and the assertions read committed state directly.
  //
  // This is not tidying. A polling test cannot distinguish "not finished yet" from
  // "never going to happen" — it reports the same timeout for both, and the second
  // is the failure worth knowing about.
  const runSync = () => runIncrementalSync();

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
  it('T5 — the nightly sync must follow hasNextPage and process every page (RED: the query declares $after but the request body binds no variables, and pageInfo is selected and never read, so exactly the first 50 land and the run reports success)', async () => {
    await seedTenant();

    const page1 = Array.from({ length: 50 }, (_, i) => clientNode(i));
    const page2 = Array.from({ length: 10 }, (_, i) => clientNode(50 + i));

    setBoth(async (url, body, opts) => {
      requests.push({ url, body, opts });
      if (isClientsQuery(body)) {
        const cursor = cursorOf(body);
        return cursor === 'CURSOR-PAGE-2'
          ? { data: { data: { clients: { nodes: page2, pageInfo: { hasNextPage: false, endCursor: null } } } } }
          : { data: { data: { clients: { nodes: page1, pageInfo: { hasNextPage: true, endCursor: 'CURSOR-PAGE-2' } } } } };
      }
      // Per-client related-data query.
      return { data: { data: { client: { jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] } } } } };
    });

    await runSync();

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

    setBoth(async (url, body, opts) => {
      requests.push({ url, body, opts });
      if (/oauth\/token/.test(url)) {
        return { data: { access_token: 'refreshed-access', refresh_token: 'refreshed-refresh', expires_in: 3600 } };
      }
      if (isClientsQuery(body)) {
        return { data: { data: { clients: { nodes: [clientNode(1)], pageInfo: { hasNextPage: false, endCursor: null } } } } };
      }
      return { data: { data: { client: { jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] } } } } };
    });

    await runSync();

    const graphqlCalls = requests.filter(r => isClientsQuery(r.body));
    assert.ok(graphqlCalls.length > 0,
      'an expired token must be refreshed and the sync must continue — instead the run made no Jobber request at all');

    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM jobber_clients WHERE contractor_id = $1', [TENANT]
    );
    assert.equal(rows[0].n, 1, 'the sync must have upserted the client it fetched after refreshing');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T12 — TOKEN RE-ACQUISITION INSIDE THE PER-CLIENT LOOP (item 4b).
  //
  // ⚠ WRITTEN AFTER ITS FIX, NOT BEFORE — AND SAID SO PLAINLY. Every other test in
  // this wave was proven RED first. This one was not: item 4b was implemented, and
  // only then did it become clear that nothing in the suite could go red if the
  // re-acquisition were removed. A fix with no test that can fail is the
  // "mechanism whose failure mode has never been observed" shape from CLAUDE.md, so
  // the gap is closed here rather than left. Its RED is demonstrated by the T8
  // guard-proof instead of by authoring order.
  //
  // THE DEFECT IT PINS: the run used to acquire one token and hold it across every
  // iteration. Jobber rotates the refresh token on use, so a concurrent pipelineSync
  // refresh invalidated the held access token and every remaining client 401'd —
  // 52 occurrences under source 'jobberIncrementalSync — client <id>', last seen
  // 2026-08-16. The single-flight guard cannot help: it protects rotation, not reads.
  //
  // The stub rotates the stored token between client 1 and client 2, exactly as a
  // sibling refresher would, and the assertion is that client 2's request carries
  // the NEW credential.
  // ─────────────────────────────────────────────────────────────────────────
  it('T12 — the per-client loop must re-acquire the token, so a mid-run rotation does not poison every remaining client (RED without item 4b: one token is read before the loop and reused, so client 2 presents the credential that was invalidated after client 1)', async () => {
    await seedTenant();

    const bearers = [];
    let rotated = false;

    setBoth(async (url, body, opts) => {
      requests.push({ url, body, opts });
      if (isClientsQuery(body)) {
        return { data: { data: { clients: {
          nodes: [clientNode(1), clientNode(2)],
          pageInfo: { hasNextPage: false, endCursor: null },
        } } } };
      }
      // Per-client related-data query — record which credential it presented.
      bearers.push(String(opts?.headers?.Authorization || ''));
      if (!rotated) {
        rotated = true;
        // A sibling refresher (pipelineSync) rotates the row mid-run.
        await pool.query(
          `UPDATE tokens SET access_token = 'rotated-access-token' WHERE contractor_id = $1`,
          [TENANT]
        );
      }
      return { data: { data: { client: { jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] } } } } };
    });

    await runSync();

    assert.equal(bearers.length, 2, 'both clients must have been fetched');
    assert.match(bearers[0], /sync-access-token/, 'client 1 uses the pre-rotation token');
    assert.match(bearers[1], /rotated-access-token/,
      `client 2 must re-acquire and use the rotated token — it presented ${bearers[1]}`);
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
  // ─────────────────────────────────────────────────────────────────────────
  // T11b / T11c — THE GRAPHQL SELECTION SETS MUST REQUEST isArchived.
  //
  // ⚠ WHY THESE READ SOURCE TEXT RATHER THAN BEHAVIOUR, AND IT IS NOT LAZINESS.
  // The cron's write site ALREADY reads client.isArchived correctly
  // (jobberIncrementalSync.js). Its defect is that the GraphQL query never REQUESTS
  // the field, so the node arrives without it and `=== true` is permanently false.
  // A behavioural test cannot see that: it stubs axios, and the stub supplies
  // whatever the test hands it — so a stubbed node carrying isArchived: true makes
  // the cron write true TODAY, against unfixed code. That test would be green,
  // meaningless, and would read as coverage.
  //
  // The webhook is the asymmetric case: _fetchFullClient also omits the field, AND
  // upsertAndTagClient binds a hardcoded false. The hardcoded literal IS
  // behaviourally visible, which is what T11a pins. The omission is not, which is
  // what T11b pins. Two defects on one path, and only one of them is observable at
  // runtime — so both instruments are needed and neither is redundant.
  //
  // ⚠ Neither of these proves the field EXISTS in the live Jobber schema. Asserting
  // that a query string contains a word says nothing about whether Jobber accepts it.
  // Schema validity was checked in GraphiQL (2026-08-23) and needs post-deploy
  // confirmation — a rejected field fails the query wholesale and the cron's error
  // handler returns, silently disabling the nightly sync.
  // ─────────────────────────────────────────────────────────────────────────
  const SELECTS_IS_ARCHIVED = /\bisArchived\b/;

  it('T11b — _fetchFullClient must request isArchived (RED: its selection set is "id firstName lastName createdAt" plus customFields/phones/emails/quotes/jobs — isArchived, isCompany and isLead are all absent)', () => {
    const body = sliceBetween(
      read('routes/webhooks/jobber.js'),
      /async function fetchFullClient\(/,
      /\n\/\/ ── INVOICE \+ JOBS FETCH/
    );
    assert.ok(body.length > 200, 'harness: the fetchFullClient slice is too short to be the real body');
    assert.ok(/client\(id: \$id\)/.test(body), 'harness: the slice must contain the GraphQL query');
    assert.equal(SELECTS_IS_ARCHIVED.test(body), true,
      'fetchFullClient must select isArchived, or the webhook path can never know a client was archived');
  });

  it('T11c — the cron clients query must request isArchived (RED: the selection set is "id firstName lastName isCompany isLead createdAt" plus emails/phones/tags/customFields — isArchived is absent, so client.isArchived === true at the write site is permanently false)', () => {
    // ⚠ ANCHORED ON THE QUERY CONSTANT, NOT ON PROSE. This slice originally ran from
    // /query GetRecentClients/ to a comment beginning "// Jobber may not support
    // updatedAt filter". Item 4a reworded that comment ("...support THE updatedAt
    // filter"), the end anchor stopped matching, sliceBetween fell back to
    // slice-to-EOF, and the assertion then found `client.isArchived === true` at the
    // WRITE SITE further down the file. The test passed against a query with the
    // field removed — vacuous, and it survived a guard-proof attempt before being
    // caught. Anchor on code that cannot be reworded, and prove the slice's extent.
    const body = sliceBetween(
      read('cron/jobs/jobberIncrementalSync.js'),
      /const RECENT_CLIENTS_QUERY = /,
      /\n  const recentClients = \[\]/
    );
    assert.ok(body.length > 200, 'harness: the GetRecentClients slice is too short to be the real query');
    assert.ok(/pageInfo/.test(body), 'harness: the slice must reach the end of the connection selection');
    // NON-VACUITY: the slice must stop before the write site, or a hit here proves nothing.
    assert.equal(/client\.isArchived === true/.test(body), false,
      'harness: the slice has overrun into the write site — any isArchived match below would be spurious');
    assert.equal(SELECTS_IS_ARCHIVED.test(body), true,
      'the cron clients query must select isArchived — its write site already reads the field, so the query is the only thing missing');
  });

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
