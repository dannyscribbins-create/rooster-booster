'use strict';

// ── CANVASS-3.7: REQUEST-DRIVEN ATTRIBUTION ──────────────────────────────────
//
// Pins rulings R1 (the trigger is REQUEST_CREATE + REQUEST_UPDATE webhooks), R2 (the
// anchor is the request's own createdAt) and R3 (an unresolved client records NOTHING),
// plus the TWO-PIPELINES fence and its positive control.
//
// ⚠ ONE POOL PER FILE, NOT PER describe. initTestDb() returns the server/db.js pool
// SINGLETON, so a per-describe pool.end() kills the pool the next describe is about to
// use — which surfaces as CANCELLED tests during setup rather than failures, and a
// green-looking `fail 0` sitting above a suite that never ran.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const jobberRouter = require('../routes/webhooks/jobber');
const { _setTestOverrides, _resetTestOverrides } = jobberRouter;
const sweep = require('../cron/jobs/repRequestSweep');

const {
  seedToken,
  signJobberWebhook,
  httpPost,
  buildTestApp,
  startTestServer,
  stopTestServer,
  waitFor,
} = require('./helpers');

const TENANT = 'req-attr-tenant';
const OTHER  = 'req-attr-other';
const ACCT   = 'JACCT_REQ';
const CLIENT = 'jc-req-1';
const REQ    = 'req-1';

let pool, server, port;

// ── FIXTURES ─────────────────────────────────────────────────────────────────
// A client with a JOB and no paid invoice classifies as 'sold', which is NOT in the
// engine's GATE_EXCLUSIONS — so the sticky gate fires. That is deliberate: the sticky
// gate is where the orphan flag lives, so it is the only path on which R3 is observable
// at all. A 'lead' client would take the provisional branch and prove nothing about R3.
function soldClient(overrides = {}) {
  return {
    id: CLIENT,
    firstName: 'Req', lastName: 'Client',
    createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    customFields: [],
    quotes: { nodes: [] },
    jobs: { nodes: [{ id: 'job-1', jobStatus: 'active', invoices: { nodes: [] } }] },
    ...overrides,
  };
}

// The triggering request. createdAt is the R2 anchor.
function triggerRequest(overrides = {}) {
  return {
    id: REQ,
    createdAt: new Date('2026-09-18T15:41:20Z').toISOString(),
    client: { id: CLIENT },
    ...overrides,
  };
}

// An attribution payload in Mode A shape: salesperson NULL, the rep named on the
// assessment. ⚠ THIS IS ACCENT'S NORMAL CASE, NOT AN EDGE CASE (finding 4, measured
// live 2026-09-18): their salesperson field auto-fills with whoever CREATED the request
// — an office person — and the rep is attached through the assessment.
function modeAData(jobberUserIds, createdAt = new Date('2026-09-18T15:41:20Z').toISOString()) {
  return async () => ({
    requests: [{
      id: REQ,
      createdAt,
      salesperson: null,
      assessment: { id: 'assess-1', assignedUsers: { nodes: jobberUserIds.map(id => ({ id })) } },
    }],
    assessments: [],
  });
}

// ⚠ is_field_rep MUST BE TRUE HERE, AND IT IS A CONSTRAINT RATHER THAN A PREFERENCE.
// `team_members_rep_coherence` (db.js) is `CHECK (is_field_rep OR (NOT is_attributable AND
// NOT rep_revenue_visibility))` — a NOT NULL-style shape added by a later migration, not
// visible in the table's CREATE. The first draft of this fixture omitted it and every
// seeding call aborted on the constraint. Recorded because CLAUDE.md names this exact
// trap: a table's shape is its CREATE plus every ALTER since, and the failure does not
// look like a schema failure.
// Setting it TRUE unconditionally is correct for both branches: a field rep who is not
// attributable is a legitimate state, which is what the `attributable: false` case needs.
async function seedRep(jobberUserId, { attributable = true, contractorId = TENANT, email } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, full_name, email, tier, active, is_field_rep, jobber_user_id, is_attributable, password_hash)
     VALUES ($1, $2, $3, 'general', TRUE, TRUE, $4, $5, 'x')
     RETURNING id`,
    [contractorId, `Rep ${jobberUserId}`, email || `rep-${jobberUserId}@${contractorId}.test`, jobberUserId, attributable]
  );
  return rows[0].id;
}

function envelope({ topic, accountId = ACCT, itemId = REQ, occurredAt = new Date().toISOString(), spelling = 'occurredAt' }) {
  const ev = { topic, appId: 'test-app', accountId, itemId };
  if (occurredAt !== null) ev[spelling] = occurredAt;
  return { data: { webHookEvent: ev } };
}

function post(path, payloadObject, { signature: sigOverride, omitSignature } = {}) {
  const { body, signature } = signJobberWebhook(payloadObject);
  const headers = omitSignature ? {} : { 'x-jobber-hmac-sha256': sigOverride || signature };
  return httpPost(port, path, body, headers);
}

async function assignmentsFor(contractorId = TENANT) {
  const { rows } = await pool.query(
    `SELECT sticky_rep_id, sticky_source, provisional_rep_id, provisional_source
     FROM client_rep_assignments WHERE contractor_id = $1 ORDER BY id`,
    [contractorId]
  );
  return rows;
}

async function countOf(table, contractorId = TENANT) {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE contractor_id = $1`, [contractorId]);
  return rows[0].n;
}

before(async () => {
  pool = await initTestDb();
  const app = buildTestApp();
  ({ server, port } = await startTestServer(app));
});

after(async () => {
  await stopTestServer(server);
  await pool.end();
});

beforeEach(async () => {
  _resetTestOverrides();
  sweep._resetTestOverrides();
  await pool.query('DELETE FROM jobber_webhook_events');
  await pool.query('DELETE FROM admin_messages');
  await pool.query('DELETE FROM flagged_assignments');
  await pool.query('DELETE FROM client_rep_assignments');
  await pool.query('DELETE FROM pipeline_cache');
  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM jobber_clients');
  await pool.query('DELETE FROM contact_tags');
  await pool.query('DELETE FROM contractor_crm_settings');
  await pool.query('DELETE FROM tokens');
  await pool.query('DELETE FROM error_log');
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM titles');
  await pool.query('DELETE FROM team_members');
  await pool.query('DELETE FROM contractors');

  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, 'Req Tenant', 'active')`, [TENANT]);
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, 'Other Tenant', 'active')`, [OTHER]);
  await pool.query(`INSERT INTO contractor_crm_settings (contractor_id, jobber_account_id) VALUES ($1, $2)`, [TENANT, ACCT]);
  await seedToken(pool, { contractorId: TENANT });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-3.7 — REQUEST_CREATE / REQUEST_UPDATE attribution (R1, R2)', () => {

  it('R1 — a REQUEST_CREATE whose assessment names an attributable rep writes an assignment', async () => {
    const repId = await seedRep('ju-1');
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest(),
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData(['ju-1']),
    });

    const resp = await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    assert.equal(resp.status, 200, 'request-create must ack 200');

    await waitFor(async () => (await assignmentsFor()).length > 0);
    const rows = await assignmentsFor();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sticky_rep_id, repId, 'the attributable rep must be stickied');
    assert.equal(rows[0].sticky_source, 'mode_a_at_close');
  });

  it('⚠ finding 4 — salesperson NULL but the assessment names an attributable rep still attributes', async () => {
    // The fixture's salesperson is explicitly null and the ONLY signal is the assessment.
    // A build that read salesperson first and treated null as "no rep" fails here.
    const repId = await seedRep('ju-null-sp');
    let sawNullSalesperson = false;
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest(),
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: async (...args) => {
        const data = await modeAData(['ju-null-sp'])(...args);
        sawNullSalesperson = data.requests[0].salesperson === null;
        return data;
      },
    });

    await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    await waitFor(async () => (await assignmentsFor()).length > 0);

    assert.equal(sawNullSalesperson, true, 'the fixture must actually carry a null salesperson');
    const rows = await assignmentsFor();
    assert.equal(rows[0].sticky_rep_id, repId);
  });

  it('R2 — the anchor is the REQUEST\'s own createdAt, not pipeline_cache (no pipeline_cache row exists)', async () => {
    const repId = await seedRep('ju-anchor');
    // The request is dated well after the client was created, and there is NO
    // pipeline_cache row for this client at all. Under the referral anchor this path
    // resolved NOBODY every time — a null anchor fails closed in isRequestEligible.
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest({ createdAt: '2026-09-18T15:41:20Z' }),
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData(['ju-anchor'], '2026-09-18T15:41:20Z'),
    });

    await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    await waitFor(async () => (await assignmentsFor()).length > 0);

    assert.equal(await countOf('pipeline_cache'), 0, 'no referral record may exist for this client');
    assert.equal((await assignmentsFor())[0].sticky_rep_id, repId);
  });

  // ── THE ANCHOR DISCRIMINATOR (R2, option A vs option B) ────────────────────
  // ⚠ THESE TWO REPLACED A SINGLE "outside the grace window" TEST THAT WAS VACUOUS, AND
  // THE WAY IT WAS FOUND IS THE POINT: a guard-proof run swapped the anchor from the
  // REQUEST's createdAt (option A, the ruling) to the CLIENT's createdAt (option B, the
  // recorded fallback) and the whole suite stayed GREEN at 24/24. The original dates —
  // client 2026-09-01, request 2026-09-18, attribution request 2026-09-18 — sit inside
  // the grace window under BOTH anchors, so the assertion could not tell the ruling from
  // its own runner-up. It was the vacuity shape this repo files as "a negative case that
  // cannot fail because the observable is the same for both states".
  //
  // The dates below are chosen so the two anchors DISAGREE. Client created 2026-06-01,
  // triggering request 2026-09-18, GRACE_MS 7 days:
  //   option A cutoff = 2026-09-11   option B cutoff = 2026-05-25
  // An attribution request dated 2026-07-01 falls OUTSIDE A and INSIDE B.
  const ANCHOR_CLIENT_CREATED = '2026-06-01T00:00:00Z';
  const ANCHOR_TRIGGER_AT     = '2026-09-18T15:41:20Z';

  it('⚠ R2 — the anchor is the REQUEST\'s createdAt: a request inside the CLIENT-anchored window but outside it does NOT attribute', async () => {
    await seedRep('ju-optionb');
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest({ createdAt: ANCHOR_TRIGGER_AT }),
      fetchFullClient: async () => soldClient({ createdAt: ANCHOR_CLIENT_CREATED }),
      // 2026-07-01: inside option B's window, outside option A's.
      fetchAttributionData: modeAData(['ju-optionb'], '2026-07-01T00:00:00Z'),
    });

    await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    await new Promise(r => setTimeout(r, 400));
    assert.equal(
      (await assignmentsFor()).length, 0,
      'anchoring on the client createdAt (option B) would have attributed this — the ruling is option A'
    );
  });

  it('⚠ R2 — its paired positive: the SAME fixture attributes when the request is inside the REQUEST-anchored window', async () => {
    // Without this, the test above passes identically against completely unwired code —
    // "nothing was attributed" is the observable for both "the window excluded it" and
    // "attribution never ran". Same client, same anchor, same rep; only the attribution
    // request's date moves, from outside option A's window to inside it.
    const repId = await seedRep('ju-optiona');
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest({ createdAt: ANCHOR_TRIGGER_AT }),
      fetchFullClient: async () => soldClient({ createdAt: ANCHOR_CLIENT_CREATED }),
      fetchAttributionData: modeAData(['ju-optiona'], '2026-09-15T00:00:00Z'),
    });

    await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    await waitFor(async () => (await assignmentsFor()).length > 0);
    assert.equal((await assignmentsFor())[0].sticky_rep_id, repId);
  });

  it('⚠ finding 3 — REQUEST_UPDATE attributes a request that recorded nothing on create', async () => {
    // The full R3 lifecycle in one test: create resolves nobody and writes NOTHING,
    // then a rep is assigned, REQUEST_UPDATE fires, and it attributes then.
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest(),
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData([]),   // no assigned users yet
    });
    await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    await new Promise(r => setTimeout(r, 400));
    assert.equal((await assignmentsFor()).length, 0, 'create must record nothing');
    assert.equal(await countOf('flagged_assignments'), 0, 'create must not flag');

    // A rep is now mapped and assigned via the assessment; the request's updatedAt
    // moved (measured 15:41:20Z -> 20:05:17Z) and REQUEST_UPDATE fires.
    const repId = await seedRep('ju-later');
    _setTestOverrides({ fetchAttributionData: modeAData(['ju-later']) });

    await post('/webhooks/jobber/request-update', envelope({ topic: 'REQUEST_UPDATE', occurredAt: '2026-09-18T20:05:17Z' }));
    await waitFor(async () => (await assignmentsFor()).length > 0);
    assert.equal((await assignmentsFor())[0].sticky_rep_id, repId);
  });

  it('the quote-overrules-request rule still holds — an eligible quote\'s salesperson wins', async () => {
    const quoteRep   = await seedRep('ju-quote');
    const requestRep = await seedRep('ju-request');
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest(),
      fetchFullClient: async () => soldClient({
        quotes: { nodes: [{
          id: 'q-1', quoteStatus: 'approved',
          lastTransitioned: { approvedAt: '2026-09-18T16:00:00Z' },
          salesperson: { id: 'ju-quote' },
        }] },
      }),
      fetchAttributionData: modeAData(['ju-request']),
    });

    await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    await waitFor(async () => (await assignmentsFor()).length > 0);
    const row = (await assignmentsFor())[0];
    assert.equal(row.sticky_rep_id, quoteRep, 'the quote salesperson must win over the request');
    assert.notEqual(row.sticky_rep_id, requestRep);
    assert.equal(row.sticky_source, 'quote_salesperson');
  });

  it('Mode A narrows to ATTRIBUTABLE reps — a non-attributable co-assignee is not a second match', async () => {
    const good = await seedRep('ju-good');
    await seedRep('ju-bad', { attributable: false });
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest(),
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData(['ju-good', 'ju-bad']),
    });

    await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    await waitFor(async () => (await assignmentsFor()).length > 0);
    assert.equal((await assignmentsFor())[0].sticky_rep_id, good, 'the non-attributable user must not count');
    assert.equal(await countOf('flagged_assignments'), 0, 'one attributable match is not a co-assignment');
  });

  it('2+ attributable assignees still raise a co-assignment flag and its bell', async () => {
    await seedRep('ju-a');
    await seedRep('ju-b');
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest(),
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData(['ju-a', 'ju-b']),
    });

    await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    await waitFor(async () => (await countOf('flagged_assignments')) > 0);
    const { rows } = await pool.query(`SELECT flag_reason, reps_involved FROM flagged_assignments WHERE contractor_id = $1`, [TENANT]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].flag_reason, 'rep_co_assignment');
    assert.equal(rows[0].reps_involved.length, 2);
    assert.equal(await countOf('admin_messages'), 1, 'the co-assignment bell must still ring');
    assert.equal((await assignmentsFor()).length, 0, 'a flagged client is left unassigned');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-3.7 — R3: an unresolved client records NOTHING', () => {

  it('R3 — a request resolving to nobody writes no assignment, no flag and no bell', async () => {
    // No team member carries this jobber_user_id at all — the flood case. Under the
    // pre-ruling behaviour this wrote one flagged_assignments row AND one admin_messages
    // bell per sold client with a request.
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest(),
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData(['ju-unmapped']),
    });

    await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    await new Promise(r => setTimeout(r, 400));

    assert.equal((await assignmentsFor()).length, 0, 'no assignment');
    assert.equal(await countOf('flagged_assignments'), 0, 'no flagged_assignments row');
    assert.equal(await countOf('admin_messages'), 0, 'no admin_messages bell');
  });

  it('⚠ R3 IS SCOPED — the REFERRAL path still orphan-flags, on the same engine', async () => {
    // THE PAIRED POSITIVE. Without this, "no flag was written" passes identically against
    // an engine that can no longer flag at all — which is the defect R3 must not cause,
    // because a referral's credit is a money question. Same engine, same miss, opposite
    // outcome, and the ONLY difference is writeOrphanOnMiss.
    const { runAttributionEngine } = require('../utils/attributionEngine');
    await runAttributionEngine(pool, {
      contractorId: TENANT,
      jobberClientId: CLIENT,
      currentStatus: 'sold',
      client: soldClient(),
      fetchAttributionData: modeAData(['ju-unmapped']),
      token: 'tok',
      referralAnchor: '2026-09-18T15:41:20Z',
      // writeOrphanOnMiss deliberately NOT passed — the referral path's default.
    });

    assert.equal(await countOf('flagged_assignments'), 1, 'the referral path must still flag');
    assert.equal(await countOf('admin_messages'), 1, 'and still ring the bell');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-3.7 — THE FENCE: widening attribution must not widen outreach', () => {

  it('the request-driven path creates no outreach, referrer record, pending invite or alert', async () => {
    // The target list filed with the TWO-PIPELINES ruling, asserted item by item.
    const repId = await seedRep('ju-fence');
    let emailsSent = 0;
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => triggerRequest(),
      fetchFullClient: async () => soldClient({
        customFields: [{ label: 'Referred by', valueText: 'Someone Who Referred' }],
      }),
      fetchAttributionData: modeAData(['ju-fence']),
      sendEmail: async () => { emailsSent += 1; return { data: { id: 'x' } }; },
    });

    // ⚠ THE CLIENT CARRIES A "Referred by" VALUE, DELIBERATELY. A fence tested against a
    // client with no referrer name would pass because the referral pipeline's own gate
    // declined it — proving the gate works, not that the paths are separate. This client
    // WOULD produce outreach through syncSingleClient; it must not through this door.
    await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    await waitFor(async () => (await assignmentsFor()).length > 0);

    assert.equal((await assignmentsFor())[0].sticky_rep_id, repId, 'attribution must have actually run');
    assert.equal(await countOf('pipeline_cache'), 0, 'no pipeline_cache upsert');
    assert.equal(await countOf('notifications'), 0, 'no notifications row');
    assert.equal(await countOf('admin_messages'), 0, 'no #25 admin alert');
    assert.equal(emailsSent, 0, 'no email sent');
    const { rows: pending } = await pool.query(`SELECT COUNT(*)::int AS n FROM pending_referrals WHERE contractor_id = $1`, [TENANT]);
    assert.equal(pending[0].n, 0, 'no pending referral record');
    assert.equal(await countOf('contact_tags'), 0, 'no Paid-Customer tag pass');
  });

  it('POSITIVE CONTROL — a referred client still produces its outreach through the REFERRAL path', async () => {
    // Without this, the fence above passes against a build that sends nothing to anybody.
    const pipelineSync = require('../crm/pipelineSync');
    let adminAlerts = 0;
    pipelineSync._setPipelineSyncEmailsForTest({
      adminNotification: async () => { adminAlerts += 1; },
      email: async () => ({ data: { id: 'x' } }),
    });
    try {
      await pipelineSync.syncSingleClient(
        TENANT,
        soldClient({ customFields: [{ label: 'Referred by', valueText: 'Someone Who Referred' }] }),
        null, [], 'tok'
      );
      await waitFor(async () => (await countOf('pipeline_cache')) > 0);
      assert.equal(await countOf('pipeline_cache'), 1, 'the referral pipeline must still write its record');
      await waitFor(async () => adminAlerts > 0);
      assert.ok(adminAlerts > 0, 'the referral pipeline must still raise its #25 admin alert');
    } finally {
      pipelineSync._resetPipelineSyncEmails();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-3.7 — delivery, tenancy and signature', () => {

  it('the same webhook delivered twice produces one outcome, and the second makes no Jobber call', async () => {
    await seedRep('ju-dupe');
    let fetches = 0;
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => { fetches += 1; return triggerRequest(); },
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData(['ju-dupe']),
    });

    const env = envelope({ topic: 'REQUEST_CREATE', occurredAt: '2026-09-18T15:41:20Z' });
    await post('/webhooks/jobber/request-create', env);
    await waitFor(async () => (await assignmentsFor()).length > 0);
    await post('/webhooks/jobber/request-create', env);   // byte-identical redelivery
    await new Promise(r => setTimeout(r, 400));

    assert.equal((await assignmentsFor()).length, 1, 'one assignment row');
    assert.equal(fetches, 1, 'the duplicate must short-circuit before any Jobber call');
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM jobber_webhook_events');
    assert.equal(rows[0].n, 1, 'one claimed delivery');
  });

  it('⚠ a LATER occurredAt for the same request is NOT a duplicate — it is the R1 update case', async () => {
    // The paired control for the dedupe above. A key of (contractor, topic, item) alone
    // would swallow this, and the symptom would be attribution silently ceasing after the
    // first event per request — which is exactly the "a rep was assigned later" case.
    let fetches = 0;
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => { fetches += 1; return triggerRequest(); },
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData([]),
    });

    await post('/webhooks/jobber/request-update', envelope({ topic: 'REQUEST_UPDATE', occurredAt: '2026-09-18T15:41:20Z' }));
    await waitFor(async () => fetches >= 1);
    await post('/webhooks/jobber/request-update', envelope({ topic: 'REQUEST_UPDATE', occurredAt: '2026-09-18T20:05:17Z' }));
    await waitFor(async () => fetches >= 2);
    assert.equal(fetches, 2, 'a later occurredAt must be processed');
  });

  it('⚠ the one-r `occuredAt` spelling is accepted as a dedupe key too', async () => {
    // Apps created before 2023-12-08 receive `occuredAt`. Which spelling THIS app gets
    // could not be established from source — no production code has ever read either —
    // so both are read. This test fails if a future edit picks one.
    let fetches = 0;
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => { fetches += 1; return triggerRequest(); },
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData([]),
    });

    const env = envelope({ topic: 'REQUEST_CREATE', occurredAt: '2026-09-18T15:41:20Z', spelling: 'occuredAt' });
    await post('/webhooks/jobber/request-create', env);
    await waitFor(async () => fetches >= 1);
    await post('/webhooks/jobber/request-create', env);
    await new Promise(r => setTimeout(r, 400));

    assert.equal(fetches, 1, 'the one-r spelling must key the dedupe');
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM jobber_webhook_events');
    assert.equal(rows[0].n, 1);
  });

  it('an unknown accountId is refused, typed, and writes nothing', async () => {
    let fetches = 0;
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => { fetches += 1; return triggerRequest(); },
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData(['ju-1']),
    });

    const resp = await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE', accountId: 'JACCT_NOBODY' }));
    assert.equal(resp.status, 200, 'unresolvable events are acked, not retried forever');
    await waitFor(async () => {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM error_log WHERE error_message LIKE '%webhook-resolution%'`);
      return rows[0].n > 0;
    });

    // ⚠ ASSERT WHY IT WAS REFUSED, NOT ONLY THAT IT WAS. A plausible-looking rejection
    // is not the rejection under test: the source must name contractor resolution, and
    // no Jobber call may have happened.
    const { rows } = await pool.query(`SELECT source FROM error_log WHERE error_message LIKE '%webhook-resolution%'`);
    assert.match(rows[0].source, /contractor resolution/);
    assert.equal(fetches, 0, 'no Jobber call on an unresolved tenant');
    assert.equal((await assignmentsFor()).length, 0);
    assert.equal((await assignmentsFor(OTHER)).length, 0, 'and nothing landed on another tenant');
  });

  it('a bad HMAC signature is refused with 401 and writes nothing', async () => {
    let fetches = 0;
    _setTestOverrides({ fetchRequestById: async () => { fetches += 1; return triggerRequest(); } });
    const resp = await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }), { signature: 'not-the-signature' });
    assert.equal(resp.status, 401);
    assert.equal(resp.body.error, 'Invalid signature', 'refused for the signature, not something else');
    await new Promise(r => setTimeout(r, 200));
    assert.equal(fetches, 0);
    assert.equal((await assignmentsFor()).length, 0);
  });

  it('a missing HMAC signature is refused with 401', async () => {
    const resp = await post('/webhooks/jobber/request-update', envelope({ topic: 'REQUEST_UPDATE' }), { omitSignature: true });
    assert.equal(resp.status, 401);
    assert.equal(resp.body.error, 'Missing signature');
  });

  it('the handler responds without waiting for attribution to finish', async () => {
    // ⚠ Jobber requires a response within 1 SECOND or it may disable the app's webhooks.
    // The first Jobber call blocks on a timer; if the route awaited the work, the ack
    // could not return until that timer fires.
    //
    // ⚠ THE GATE RELEASES ON A TIMER RATHER THAN ON AN ASSERTION, DELIBERATELY. An
    // earlier draft released it only after the assertions ran, which meant a route that
    // awaited its work produced a HANG rather than a failure — the response never came,
    // so httpPost never resolved. Measured: that variant ran past 400s with no output.
    // A hang is technically a red and is a bad one: it looks like a wedged suite rather
    // than a broken property, and this repo files "cancelled/never-finished" under the
    // same heading as a suite that did not run. The timer guarantees the route always
    // completes, so the property under test fails as an ASSERTION on elapsed time.
    const BLOCK_MS = 1500;
    await seedRep('ju-slow');
    _setTestOverrides({
      getFreshContractorAccessToken: async () => 'tok',
      fetchRequestById: async () => { await new Promise(r => setTimeout(r, BLOCK_MS)); return triggerRequest(); },
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData(['ju-slow']),
    });

    const startedAt = Date.now();
    const resp = await post('/webhooks/jobber/request-create', envelope({ topic: 'REQUEST_CREATE' }));
    const ackMs = Date.now() - startedAt;
    assert.equal(resp.status, 200);
    assert.ok(ackMs < 1000, `ack took ${ackMs}ms — must be well inside Jobber's 1s budget`);
    assert.equal((await assignmentsFor()).length, 0, 'the work has demonstrably not run yet');

    // And the work still completes afterwards — otherwise "acked fast" would also pass
    // against a route that acked and then did nothing at all.
    await waitFor(async () => (await assignmentsFor()).length > 0, { timeout: BLOCK_MS + 3000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('Canvass-3.7 — the backfill sweep and its watermark', () => {

  async function watermarkOf(contractorId = TENANT) {
    const { rows } = await pool.query(
      `SELECT request_sweep_watermark FROM contractor_crm_settings WHERE contractor_id = $1`, [contractorId]
    );
    return rows[0].request_sweep_watermark;
  }

  it('a successful sweep attributes through the same path and advances the watermark', async () => {
    const repId = await seedRep('ju-sweep');
    sweep._setTestOverrides({
      getToken: async () => 'tok',
      fetchRequestsUpdatedSince: async () => ({
        nodes: [{ id: REQ, createdAt: '2026-09-18T15:41:20Z', updatedAt: '2026-09-18T20:05:17Z', client: { id: CLIENT } }],
        hasNextPage: false, endCursor: null,
      }),
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData(['ju-sweep']),
    });

    const result = await sweep.sweepContractor(TENANT);
    assert.equal(result.advanced, true);
    assert.equal(result.swept, 1);
    assert.equal((await assignmentsFor())[0].sticky_rep_id, repId, 'the sweep drives the same engine');
    assert.ok(await watermarkOf(), 'the watermark must be set');
  });

  it('⚠ a FAILED sweep does not advance the watermark', async () => {
    await pool.query(
      `UPDATE contractor_crm_settings SET request_sweep_watermark = $2 WHERE contractor_id = $1`,
      [TENANT, new Date('2026-09-01T00:00:00Z')]
    );
    sweep._setTestOverrides({
      getToken: async () => 'tok',
      fetchRequestsUpdatedSince: async () => { throw new Error('Field "updatedAt" is not defined'); },
    });

    const result = await sweep.sweepContractor(TENANT);
    assert.equal(result.advanced, false);
    assert.equal(result.reason, 'fetch_failed');
    assert.equal(
      new Date(await watermarkOf()).toISOString(), '2026-09-01T00:00:00.000Z',
      'a watermark advanced on failure loses every request in the skipped window'
    );
  });

  it('⚠ a sweep whose attribution throws mid-page does not advance the watermark either', async () => {
    await pool.query(
      `UPDATE contractor_crm_settings SET request_sweep_watermark = $2 WHERE contractor_id = $1`,
      [TENANT, new Date('2026-09-01T00:00:00Z')]
    );
    sweep._setTestOverrides({
      getToken: async () => 'tok',
      fetchRequestsUpdatedSince: async () => ({
        nodes: [{ id: REQ, createdAt: '2026-09-18T15:41:20Z', updatedAt: '2026-09-18T20:05:17Z', client: { id: CLIENT } }],
        hasNextPage: false, endCursor: null,
      }),
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: async () => { throw new Error('attribution blew up'); },
    });

    const result = await sweep.sweepContractor(TENANT);
    assert.equal(result.advanced, false);
    assert.equal(result.reason, 'attribute_failed');
    assert.equal(new Date(await watermarkOf()).toISOString(), '2026-09-01T00:00:00.000Z');
  });

  it('⚠ hitting the page cap is a failure, not a clean stop — the watermark is held', async () => {
    sweep._setTestOverrides({
      getToken: async () => 'tok',
      fetchRequestsUpdatedSince: async () => ({ nodes: [], hasNextPage: true, endCursor: 'c' }),
    });
    const result = await sweep.sweepContractor(TENANT);
    assert.equal(result.advanced, false);
    assert.equal(result.reason, 'page_cap');
    assert.equal(await watermarkOf(), null, 'never-swept stays never-swept');
  });

  it('the sweep obeys R3 — a request resolving to nobody writes nothing and still advances', async () => {
    sweep._setTestOverrides({
      getToken: async () => 'tok',
      fetchRequestsUpdatedSince: async () => ({
        nodes: [{ id: REQ, createdAt: '2026-09-18T15:41:20Z', updatedAt: '2026-09-18T20:05:17Z', client: { id: CLIENT } }],
        hasNextPage: false, endCursor: null,
      }),
      fetchFullClient: async () => soldClient(),
      fetchAttributionData: modeAData(['ju-nobody']),
    });

    const result = await sweep.sweepContractor(TENANT);
    assert.equal(result.advanced, true, 'resolving nobody is not a failure');
    assert.equal(await countOf('flagged_assignments'), 0);
    assert.equal(await countOf('admin_messages'), 0);
  });
});
