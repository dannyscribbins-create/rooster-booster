'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 0.2 — JOBBER INGESTION REPAIR. RED-FIRST TESTS.
//
// ⚠ THIS HEADER IS A RECORD, AND IT HAS BEEN CORRECTED. It read: "Every test in
// this file is expected to FAIL against the code as it stands." That was true when
// written in Phase 1B and is now false — items 1-4 have shipped, so T1, T2, T3, T4
// and T11a are GREEN and must stay green. T7 and T9 remain skipped pending items 5
// and 6; each carries the item that un-skips it.
//
// What has NOT changed, and is the point of the file: every `it` title still carries
// the exact failure predicted BEFORE its first run. Those RED notes are the record
// the T8 guard-proofs check against — a fix is only accepted when disabling it
// returns the test to the shape named in its own title. A test that fails in a
// different shape is a failed test, not a RED one.
//
// WHAT THIS FILE PINS (Phase 0 / 1A findings):
//   jobber.js:468,545  const client = payload?.data?.client || payload
//                      Jobber CLIENT_* envelopes carry NO data.client, so `client`
//                      is always the whole envelope — an object with no .id.
//   jobber.js:499-504  fetchFullClient's .catch() returns that object as fullClient.
//   jobber.js:330-355  upsertAndTagClient binds fullClient.id -> NOT NULL violation.
//   jobber.js:1260     job-update's clientShell NULLs overwrite good columns through
//                      an unconditional DO UPDATE.
//   jobber.js:557-561  the fallbackLookup reads jobber_clients with no contractor
//                      predicate, under a COMPOSITE unique key.
//
// ⚠ NON-VACUITY. Phase 0 established that every pre-existing test overrides
// _fetchFullClient to SUCCEED — the failure branch had zero coverage, which is why
// ~550 production failures produced no signal for four months. These tests exist to
// drive that branch. Each one is guard-proofed in Phase 2 (T8) by disabling its fix
// and confirming it returns to the RED shape recorded here.
// ─────────────────────────────────────────────────────────────────────────────

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;

const {
  seedEngagementSettings,
  signJobberWebhook,
  httpPost,
  buildTestApp,
  startTestServer,
  stopTestServer,
  waitFor,
} = require('./helpers');

const TENANT_A  = 'ingestion-tenant-a';
const TENANT_B  = 'ingestion-tenant-b';
const ACCOUNT_A = 'JACCT_INGEST_A';

describe('Wave 0.2 — Jobber ingestion repair (RED first)', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    const app = buildTestApp();
    ({ server, port } = await startTestServer(app));
  });

  after(async () => {
    _resetTestOverrides();
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    _resetTestOverrides();
    await pool.query('DELETE FROM contact_tags');
    await pool.query('DELETE FROM jobber_clients');
    await pool.query('DELETE FROM pipeline_cache');
    await pool.query('DELETE FROM contractor_crm_settings');
    await pool.query('DELETE FROM engagement_settings');
    await pool.query('DELETE FROM tokens');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM error_log');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM contractors');
  });

  // ── HARNESS ────────────────────────────────────────────────────────────────

  function post(path, payloadObject) {
    const { body, signature } = signJobberWebhook(payloadObject);
    return httpPost(port, path, body, { 'x-jobber-hmac-sha256': signature });
  }

  // The documented Jobber envelope (confirmed 2026-07-07, and independently
  // re-confirmed in Phase 0): data.webHookEvent.{topic,appId,accountId,itemId}.
  // ⚠ There is deliberately NO data.client key here. That absence IS the defect
  // under test — adding one would make every test below pass against broken code.
  function envelope({ topic, accountId = ACCOUNT_A, itemId, extra = {} }) {
    return {
      data: {
        webHookEvent: { topic, appId: 'test-app', accountId, itemId, occurredAt: new Date().toISOString() },
        ...extra,
      },
    };
  }

  async function seedTenant(id = TENANT_A, accountId = ACCOUNT_A) {
    await pool.query(
      `INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')
       ON CONFLICT (id) DO NOTHING`, [id]
    );
    if (accountId) {
      await pool.query(
        `INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`,
        [id, accountId]
      );
    }
    // ⚠ NOT helpers.seedToken() — that helper hardcodes id=1 (helpers.js:66), so a
    // second tenant collides on tokens_pkey before ON CONFLICT (contractor_id) can
    // fire. T9 is the only test here that seeds two tenants, and it is the reason
    // this is a local insert: omitting id lets the sequence supply distinct values.
    await pool.query(
      `INSERT INTO tokens (contractor_id, access_token, refresh_token, expires_at)
       VALUES ($1, 'test-access-token', 'test-refresh-token', NOW() + INTERVAL '1 hour')
       ON CONFLICT (contractor_id) DO UPDATE SET access_token = EXCLUDED.access_token`,
      [id]
    );
  }

  // Minimal relatedData shaped the way upsertAndTagClient destructures it
  // (jobber.js:358-370). Truthy, so the tag block runs and gives us a terminal
  // write to gate on; empty, so deriveAndSaveTags has nothing to choke on.
  function relatedDataStub() {
    return {
      isCompany: false, isLead: false,
      tags: { nodes: [] }, customFields: [],
      jobs: { nodes: [] }, quotes: { nodes: [] }, requests: { nodes: [] },
    };
  }

  // These handlers ack 200 and keep working, so every gate has to be a poll.
  // The timeout is swallowed on purpose — waitFor BOUNDS the wait and the
  // assertions decide the outcome. Letting it throw would replace a precise
  // failure message with a generic waitFor timeout, which is strictly less
  // useful when the write genuinely never arrives. Same convention as
  // webhookTenantDerivation.test.js:155-165.
  async function settle(predicate, timeout = 4000) {
    try { await waitFor(predicate, { timeout }); } catch { /* intentional */ }
  }

  const errorRows = () => pool.query('SELECT * FROM error_log ORDER BY id');

  // ─────────────────────────────────────────────────────────────────────────
  // T1 — BLANK PROTECTION. The prerequisite for every other item.
  //
  // ⚠ THIS RED IS THE PROOF THAT THE OBVIOUS FIX IS WRONG. If T1 passed on
  // current code, then "just pass clientId into a shell object" would be a safe
  // repair. It is not: the shell carries NULLs for the other four columns and
  // the DO UPDATE is unconditional, so the naive fix trades a dropped row for a
  // blanked one. Item 1 must land before item 2 for exactly this reason.
  // ─────────────────────────────────────────────────────────────────────────
  it('T1 — a NULL-bearing upsert must not blank an existing row (RED: jobber.js:337-340 DO UPDATE is unconditional, so job-update clientShell at :1260 overwrites first_name/last_name/email/phone with NULL)', async () => {
    await seedTenant();
    await seedEngagementSettings(pool, { contractorId: TENANT_A, experienceFlowEnabled: true });

    await pool.query(
      `INSERT INTO jobber_clients
         (jobber_client_id, contractor_id, first_name, last_name, email, phone, last_synced_at)
       VALUES ('jc-t1', $1, 'Cynthia', 'Graubart', 'cynthia@example.com', '770-555-0101', NOW())`,
      [TENANT_A]
    );

    _setTestOverrides({
      // One completed job with a positive total — clears the status, max-total and
      // cooldown gates so the handler reaches the :1260 upsert.
      fetchClientJobsForJobUpdate: async () => ([{ id: 'job-t1', jobStatus: 'COMPLETED', total: '5000' }]),
      fetchClientRelatedData: async () => relatedDataStub(),
    });

    const resp = await post('/webhooks/jobber/job-update', envelope({
      topic: 'JOB_UPDATE', itemId: 'job-t1',
      extra: { job: { id: 'job-t1', client: { id: 'jc-t1' } } },
    }));
    assert.equal(resp.status, 200, 'job-update must ack 200');

    // tier_1 is the LAST write inside upsertAndTagClient (jobber.js:391-396), so it
    // gates strictly after the jobber_clients upsert this test inspects.
    await settle(async () => {
      const { rows } = await pool.query(
        `SELECT 1 FROM contact_tags WHERE jobber_client_id = 'jc-t1' AND tag = 'tier_1'`
      );
      return rows.length > 0;
    });

    const { rows } = await pool.query(
      `SELECT first_name, last_name, email, phone FROM jobber_clients
       WHERE jobber_client_id = 'jc-t1' AND contractor_id = $1`, [TENANT_A]
    );
    assert.equal(rows.length, 1, 'the row must still exist');
    assert.equal(rows[0].first_name, 'Cynthia',             'first_name must survive a NULL-bearing upsert');
    assert.equal(rows[0].last_name,  'Graubart',            'last_name must survive a NULL-bearing upsert');
    assert.equal(rows[0].email,      'cynthia@example.com', 'email must survive a NULL-bearing upsert');
    assert.equal(rows[0].phone,      '770-555-0101',        'phone must survive a NULL-bearing upsert');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T2 — SKIP, DO NOT ATTEMPT A DOOMED WRITE.
  //
  // ⚠ SCOPE CORRECTION, REPORTED RATHER THAN SILENTLY APPLIED. The ruling says
  // "assert NO row is written." That assertion is GREEN on current code — the
  // INSERT raises 23502, so no row is written today either. Asserted alone it
  // would be vacuous in exactly the shape CLAUDE.md's Test Design section warns
  // about. The assertion that can actually go RED is the second one: no NOT NULL
  // violation may be raised at all. Both are kept; the first is labelled as the
  // regression fence it is.
  // ─────────────────────────────────────────────────────────────────────────
  it('T2 — a fetchFullClient failure must skip cleanly, raising no NOT NULL violation (RED: fullClient falls back to the envelope, fullClient.id is undefined, and jobber.js:330 raises 23502)', async () => {
    await seedTenant();
    _setTestOverrides({
      fetchFullClient: async () => { const e = new Error('Request failed with status code 401'); e.status = 401; throw e; },
      fetchClientRelatedData: async () => relatedDataStub(),
    });

    const resp = await post('/webhooks/jobber/client-update', envelope({
      topic: 'CLIENT_UPDATE', itemId: 'jc-t2',
    }));
    assert.equal(resp.status, 200, 'client-update must ack 200 even when the fetch fails');

    await settle(async () => (await errorRows()).rows.length > 0);

    // FENCE — green today and must stay green. It catches a repair that "fixes"
    // the skip by writing a partial or placeholder row instead of skipping.
    const { rows: clientRows } = await pool.query(
      `SELECT 1 FROM jobber_clients WHERE jobber_client_id = 'jc-t2'`
    );
    assert.equal(clientRows.length, 0, 'no jobber_clients row may be written for a client whose fetch failed');

    // THE RED ASSERTION — the handler must not attempt the write at all.
    const { rows: errs } = await errorRows();
    const notNullViolations = errs.filter(r => /null value in column "jobber_client_id"/i.test(r.error_message));
    assert.deepEqual(
      notNullViolations.map(r => r.error_message), [],
      'no NOT NULL violation may be raised — the handler must skip before the INSERT'
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T3 — THE SKIP IS RECORDED, PER CLIENT, WITH ITS CAUSE.
  //
  // ⚠ The id must land in error_message, not stack_trace. logError dedupes on
  // (contractor_id, route, method, error_message) and does stack_trace =
  // EXCLUDED.stack_trace (errorLogger.js:143-153) — an id that lives only in the
  // stack is overwritten on every recurrence, so N skipped clients collapse to
  // one row and the failing population becomes unmeasurable. That is exactly the
  // state production is in. The two-client assertion below is what tests this;
  // a single-client "contains the id" check would pass against a stack-only fix.
  //
  // ⚠ Ruling C: the log must carry the UNDERLYING error too. A skip logged
  // without its cause reproduces the same defect with a friendlier message.
  // ─────────────────────────────────────────────────────────────────────────
  it('T3 — each skipped client gets its OWN error_log row, carrying its id and its underlying cause in error_message (RED: today the only row is the PG NOT NULL message, which names no client, so two clients dedupe into one row)', async () => {
    await seedTenant();
    _setTestOverrides({
      fetchFullClient: async () => { const e = new Error('Request failed with status code 401'); e.status = 401; throw e; },
      fetchClientRelatedData: async () => relatedDataStub(),
    });

    await post('/webhooks/jobber/client-update', envelope({ topic: 'CLIENT_UPDATE', itemId: 'jc-t3-alpha' }));
    await post('/webhooks/jobber/client-update', envelope({ topic: 'CLIENT_UPDATE', itemId: 'jc-t3-beta'  }));

    await settle(async () => (await errorRows()).rows.length >= 2);

    const { rows: errs } = await errorRows();

    const alpha = errs.filter(r => r.error_message.includes('jc-t3-alpha'));
    const beta  = errs.filter(r => r.error_message.includes('jc-t3-beta'));

    assert.equal(alpha.length, 1, 'jc-t3-alpha must have exactly one error_log row naming it in error_message');
    assert.equal(beta.length,  1, 'jc-t3-beta must have exactly one error_log row naming it in error_message');

    // Ruling C — the cause, not just the fact of a skip.
    assert.match(
      alpha[0].error_message, /401/,
      'the skip record must carry the underlying error (a 401 here), not merely the word "skipped"'
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T4 — TOKEN ACQUISITION GOES THROUGH THE SANCTIONED PATH.
  // Behavioural half: the three webhook handlers, which have a test seam.
  // The other two sites (pendingReferral.js:259, jobberIncrementalSync.js:22)
  // have no seam and are covered in jobberSyncRepair.test.js.
  //
  // ⚠ Asserted on the CALL, never on the token VALUE — a value assertion passes
  // whether or not a refresh happened, which is the whole failure mode here.
  // ─────────────────────────────────────────────────────────────────────────
  // ⚠ DELIBERATE TEST CHANGE, RECORDED RATHER THAN QUIETLY MADE (Wave 0.2 item 3).
  // This test originally watched the refreshTokenIfNeeded seam, because that was the
  // only refresh entry point when it was written and proven RED. Item 3 introduced
  // getFreshContractorAccessToken() as the single sanctioned acquisition path — it
  // refreshes AND reads, so the handlers no longer call refreshTokenIfNeeded directly
  // and a seam watching that name would report zero forever, passing as a permanent
  // RED that nobody could ever fix. The assertion now watches the seam the code
  // actually uses.
  //
  // The original RED is NOT weakened by this: on pre-item-3 code the handlers call
  // NEITHER helper, so this test fails identically ("called 0 time(s)"). That is
  // confirmed by the T8 guard-proof, which reverts item 3 and observes exactly that.
  it('T4 — client-create, client-update and job-update each acquire their token through getFreshContractorAccessToken (RED: all three raw-SELECT tokens.access_token at :490/:580/:1191 and never call any refresh helper)', async () => {
    await seedTenant();
    await seedEngagementSettings(pool, { contractorId: TENANT_A, experienceFlowEnabled: true });

    const refreshCalls = [];
    _setTestOverrides({
      getFreshContractorAccessToken: async (cid) => { refreshCalls.push({ cid }); return 'test-access-token'; },
      fetchFullClient: async (id) => ({ id, firstName: 'Fetched', lastName: 'Client', customFields: [], emails: [], phones: [] }),
      fetchClientRelatedData: async () => relatedDataStub(),
      fetchClientJobsForJobUpdate: async () => ([{ id: 'job-t4', jobStatus: 'COMPLETED', total: '5000' }]),
    });

    await post('/webhooks/jobber/client-create', envelope({ topic: 'CLIENT_CREATE', itemId: 'jc-t4-create' }));
    await settle(async () => (await pool.query(`SELECT 1 FROM jobber_clients WHERE jobber_client_id='jc-t4-create'`)).rows.length > 0);

    await post('/webhooks/jobber/client-update', envelope({ topic: 'CLIENT_UPDATE', itemId: 'jc-t4-update' }));
    await settle(async () => (await pool.query(`SELECT 1 FROM jobber_clients WHERE jobber_client_id='jc-t4-update'`)).rows.length > 0);

    await post('/webhooks/jobber/job-update', envelope({
      topic: 'JOB_UPDATE', itemId: 'job-t4',
      extra: { job: { id: 'job-t4', client: { id: 'jc-t4-job' } } },
    }));
    await settle(async () => (await pool.query(`SELECT 1 FROM jobber_clients WHERE jobber_client_id='jc-t4-job'`)).rows.length > 0);

    assert.ok(refreshCalls.length >= 3,
      `all three handlers must refresh before using a token — getFreshContractorAccessToken was called ${refreshCalls.length} time(s), expected at least 3`);
    for (const call of refreshCalls) {
      assert.equal(call.cid, TENANT_A, 'the refresh must be scoped to the resolved contractor');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T11a — ARCHIVE STATE REACHES THE ROW (Wave 0.2 item 4c).
  //
  // upsertAndTagClient binds a HARDCODED `false` as its 9th parameter — it reads
  // isArchived from nothing at all. That is why fixing the GraphQL selection sets
  // alone is inert: the write site consults no source. This test drives the real
  // client-update handler with a client Jobber reports as archived.
  //
  // ⚠ WHAT THIS TEST CANNOT PROVE. It stubs _fetchFullClient, so it proves the VALUE
  // is read and written correctly. It CANNOT prove `isArchived` is a selectable field
  // on Client in the live Jobber schema — a stub answers whatever it is told to. Those
  // are two different claims and this test makes only the first. Field validity was
  // checked separately in GraphiQL (2026-08-23: valid in both query shapes, spelled
  // isArchived) and must be re-confirmed post-deploy, because that check ran against
  // API version 2025-04-xx while production pins 2026-02-17.
  // ⚠ Do NOT read a green T11a as schema confirmation.
  // ─────────────────────────────────────────────────────────────────────────
  it('T11a — a CLIENT_UPDATE for an archived client must write is_archived = true (RED: upsertAndTagClient binds a hardcoded false as $9 and reads the field from no source, so every webhook path writes false regardless of Jobber state)', async () => {
    await seedTenant();

    _setTestOverrides({
      fetchFullClient: async (id) => ({
        id, firstName: 'Archived', lastName: 'Client',
        isArchived: true,
        customFields: [], emails: [], phones: [],
      }),
      fetchClientRelatedData: async () => relatedDataStub(),
    });

    const resp = await post('/webhooks/jobber/client-update', envelope({
      topic: 'CLIENT_UPDATE', itemId: 'jc-t11a',
    }));
    assert.equal(resp.status, 200, 'client-update must ack 200');

    await settle(async () => {
      const { rows } = await pool.query(
        `SELECT 1 FROM contact_tags WHERE jobber_client_id = 'jc-t11a' AND tag = 'tier_1'`
      );
      return rows.length > 0;
    });

    const { rows } = await pool.query(
      `SELECT is_archived FROM jobber_clients WHERE jobber_client_id = 'jc-t11a' AND contractor_id = $1`,
      [TENANT_A]
    );
    assert.equal(rows.length, 1, 'the row must exist');
    assert.equal(rows[0].is_archived, true,
      'an archived Jobber client must land as is_archived = true, not false');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T7 — SEVERITY. A money- and auth-adjacent ingestion failure must not be INFO.
  //
  // ⚠ The mechanism is pinned alongside the outcome, per the ruling. If this row
  // is INFO for some reason OTHER than the route string, the fix is a different
  // fix — so the route assertion below is deliberately NOT a RED assertion. It
  // states what is true now and must remain true: req.path inside a router
  // mounted at /webhooks is the router-RELATIVE path, which is why
  // classifySeverity's `route.includes('/webhook')` test (errorLogger.js:10)
  // never matches.
  // ─────────────────────────────────────────────────────────────────────────
  it('T7 — a client-update ingestion failure must classify above INFO (RED: req.path is router-relative — /jobber/client-update — so classifySeverity /webhook needle never matches and every one of these lands as INFO)', async () => {
    await seedTenant();
    _setTestOverrides({
      fetchFullClient: async () => { const e = new Error('Request failed with status code 401'); e.status = 401; throw e; },
      fetchClientRelatedData: async () => relatedDataStub(),
    });

    await post('/webhooks/jobber/client-update', envelope({ topic: 'CLIENT_UPDATE', itemId: 'jc-t7' }));
    await settle(async () => (await errorRows()).rows.length > 0);

    const { rows: errs } = await errorRows();
    assert.ok(errs.length > 0, 'the failure must reach error_log at all');

    // ⚠ UPDATED OPENLY (Wave 0.2 item 5), not quietly loosened. This line previously
    // read:
    //     assert.equal(errs[0].route, '/jobber/client-update',
    //       'mechanism: the recorded route is router-relative and carries no /webhooks prefix');
    // and it pinned the DEFECT. req.path is router-relative, so the recorded route
    // carried no prefix and classifySeverity's '/webhook' needle could never match.
    // Item 5 changed the derivation to req.baseUrl + req.path, so the route is now the
    // full mounted path and the needle matches naturally.
    //
    // INVERTED WITH ITS REASON RATHER THAN DELETED: the route value is still the
    // MECHANISM behind the severity. If the derivation ever reverts — to req.path, or
    // to req.originalUrl, which would drag the query string into the dedup key — this
    // line names why the severity assertion below broke, instead of leaving someone to
    // rediscover it.
    assert.equal(errs[0].route, '/webhooks/jobber/client-update',
      'mechanism: the recorded route is the full mounted path, which is what lets the /webhook needle match');

    // Asserts what the severity IS, not what it is not. The former notEqual('INFO')
    // would stay green against WARNING, which is not the intended outcome for a
    // money- and auth-adjacent ingestion path — see CLAUDE.md on negative assertions
    // ending up as the fence around the defect.
    assert.equal(errs[0].severity, 'CRITICAL',
      'a money- and auth-adjacent ingestion failure must classify CRITICAL');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T9 — CROSS-TENANT FALLBACK (item 6, own test, own diff — Ruling B).
  //
  // jobber_clients is uniquely keyed on the COMPOSITE (jobber_client_id,
  // contractor_id), so one Jobber id may legitimately exist under two
  // contractors — which is production's current state (8 ghost rows under
  // 'accent-roofing' alongside 18,614 under 'accent-roofing-dev'). The
  // fallbackLookup at jobber.js:557-561 has no contractor predicate, no ORDER BY
  // and no LIMIT, and takes rows[0].
  //
  // ⚠ THIS IS THE PRODUCTION SHAPE, NOT A SYNTHETIC ONE. Confirmed 2026-08-23:
  // FIVE jobber_client_id values exist under BOTH contractors right now, so this
  // fallback has five live ambiguities today. The fix is corrective, not preventive.
  //
  // ⚠ This test does NOT presuppose the 1C design answer. It asserts only the
  // safety property that holds under EITHER resolution: an ambiguous id must
  // never be silently resolved to an arbitrary tenant. Refusing and quarantining
  // satisfies it; so would any unambiguous rule. Guessing does not.
  // ─────────────────────────────────────────────────────────────────────────
  it('T9 — an ambiguous fallback lookup must refuse rather than pick an arbitrary tenant (RED: the query has no contractor predicate, no ORDER BY and no LIMIT, so rows[0] resolves by heap order and the webhook proceeds under whichever tenant Postgres happened to return)', { skip: 'Wave 0.2 item 6 — cross-tenant fallback. UN-SKIP when item 6 lands.' }, async () => {
    // Two tenants, neither matching the incoming accountId, so the accountId path
    // fails and the fallback is forced to run.
    await seedTenant(TENANT_A, 'JACCT_SOMETHING_ELSE');
    await seedTenant(TENANT_B, null);

    // The SAME Jobber client id under both tenants — legal under the composite key.
    for (const t of [TENANT_A, TENANT_B]) {
      await pool.query(
        `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
         VALUES ('jc-t9', $1, 'Ambiguous', NOW())`, [t]
      );
    }

    _setTestOverrides({
      fetchFullClient: async (id) => ({ id, firstName: 'Ambiguous', lastName: null, customFields: [], emails: [], phones: [] }),
      fetchClientRelatedData: async () => relatedDataStub(),
    });

    const resp = await post('/webhooks/jobber/client-update', envelope({
      topic: 'CLIENT_UPDATE', accountId: 'JACCT_UNREGISTERED', itemId: 'jc-t9',
    }));
    assert.equal(resp.status, 200, 'client-update must ack 200');

    // Gate on either terminal outcome so the assertion — not a timeout — decides.
    await settle(async () => {
      const q = await pool.query(`SELECT 1 FROM error_log WHERE error_message LIKE '[webhook-resolution]%'`);
      const t = await pool.query(`SELECT 1 FROM contact_tags WHERE jobber_client_id = 'jc-t9'`);
      return q.rows.length > 0 || t.rows.length > 0;
    });

    const { rows: quarantined } = await pool.query(
      `SELECT error_message FROM error_log WHERE error_message LIKE '[webhook-resolution]%'`
    );
    assert.equal(quarantined.length, 1,
      'an ambiguous client id must be quarantined, not resolved to an arbitrary contractor');
    assert.match(quarantined[0].error_message, /jc-t9/,
      'the quarantine record must name the client id it refused');
  });
});
