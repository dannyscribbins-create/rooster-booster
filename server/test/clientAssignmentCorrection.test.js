'use strict';

// ── THE CORRECTION PATH, AND DEPARTURE AS HISTORY (Danny, 2026-09-22) ────────
//
// Two rulings, one file, because they are the same subject seen twice:
//   PART 1 — an admin can SEE who a client is assigned to and CHANGE it, from the
//            client's own record rather than only from the Flagged queue.
//   PART 2 — deactivating a rep marks their clients as HISTORY and moves nothing. A
//            departed rep's clients are not a book to hand over; when someone new works
//            one, the CRM says so and the engine assigns them normally.
//
// ⚠ THE FENCE THIS FILE CARRIES IS THE CAMPAIGN ONE. Audiences are built from contact
// tags, so the historical tag is one click from becoming "email everyone Tom used to
// have". The reserved namespace is asserted here with a real audience as the positive
// control — an audience that is unchanged by the tag existing.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startTestServer, stopTestServer, seedAudience } = require('./helpers');
const { createApp } = require('../app');
const { evaluateAudience } = require('../cron/jobs/dynamicAudiences');
const { formerRepTag, isAttributionTag } = require('../utils/attributionTags');
const { getClientAssignment } = require('../utils/clientAssignment');

const TENANT = 'correction-a';
let pool, server, base;

async function seedMember({ email, tier = 'admin', attributable = true, permissions = null, fullName = 'A Member' }) {
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, is_field_rep, is_attributable, full_name, active, permissions)
     VALUES ($1, $2, 'x', $3, $4, $4, $5, true, $6::jsonb) RETURNING id`,
    [TENANT, email, tier, attributable, fullName, permissions ? JSON.stringify(permissions) : null]
  );
  return rows[0].id;
}

async function sessionFor(teamMemberId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (token, role, team_member_id, contractor_id, expires_at, created_at)
     VALUES ($1, 'admin', $2, $3, NOW() + INTERVAL '1 day', NOW())`,
    [token, teamMemberId, TENANT]
  );
  return token;
}

const patchAssignment = (token, clientId, body) => fetch(
  `${base}/api/admin/team/client-assignment/${encodeURIComponent(clientId)}`,
  { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
);

const assignmentRow = async (clientId) => (await pool.query(
  `SELECT sticky_rep_id, sticky_source, written_by, provisional_rep_id, provisional_source
     FROM client_rep_assignments WHERE contractor_id = $1 AND jobber_client_id = $2`,
  [TENANT, clientId])).rows[0] || null;

const tagsOf = async (clientId) => (await pool.query(
  `SELECT tag FROM contact_tags WHERE contractor_id = $1 AND jobber_client_id = $2 ORDER BY tag`,
  [TENANT, clientId])).rows.map((r) => r.tag);

before(async () => {
  pool = await initTestDb();
  const started = await startTestServer(createApp());
  server = started.server;
  base = `http://localhost:${started.port}`;
});
after(async () => {
  await stopTestServer(server);
  await pool.end();
});

beforeEach(async () => {
  // ⚠ dynamic_audience_members IS KEYED BY AUDIENCE, NOT BY CONTRACTOR — deleting it by
  // contractor_id raises 42703 in the HOOK, which fails every case in the file at once.
  await pool.query(
    `DELETE FROM dynamic_audience_members WHERE audience_id IN
       (SELECT id FROM dynamic_audiences WHERE contractor_id = $1)`, [TENANT]);
  await pool.query('DELETE FROM activity_log');
  // ⚠ crm_invoice_job_links / crm_invoice_facts / crm_job_facts ADDED WITH COMMIT 4. A fact
  // table missing from this list leaks rows between cases, and since decideFromFacts reads these
  // to derive the status, a leaked job fact silently turns a later 'lead' client into 'sold' and
  // lets the sticky gate run. That is exactly what happened while writing this commit: seeding a
  // job fact in one case made a LATER case assign the wrong rep (20 !== 21).
  for (const t of ['contact_tags', 'dynamic_audiences', 'flagged_assignments',
    'client_rep_assignments', 'crm_request_facts',
    'crm_invoice_job_links', 'crm_invoice_facts', 'crm_job_facts',
    'jobber_clients', 'sessions', 'titles', 'team_members']) {
    await pool.query(`DELETE FROM ${t} WHERE contractor_id = $1`, [TENANT]);
  }
  await pool.query('DELETE FROM contractors WHERE id = $1', [TENANT]);
  await pool.query(`INSERT INTO contractors (id, name, status) VALUES ($1, $1, 'active')`, [TENANT]);
  await pool.query(
    `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
     VALUES ('c1', $1, 'Client One', NOW()), ('c2', $1, 'Client Two', NOW())`, [TENANT]);
});

// ═══════════════════════════════════════════════════════════════════════════
describe('PART 1 — seeing and changing a client\'s rep from the client record', () => {

  it('[RED] ⚠ an OWNER can assign a client that carries no flag — the case with no path before today', async () => {
    const owner = await seedMember({ email: 'owner@corr.test', tier: 'owner', attributable: false });
    const rep = await seedMember({ email: 'rep@corr.test', tier: 'general', fullName: 'Rep One' });
    const token = await sessionFor(owner);

    const res = await patchAssignment(token, 'c1', { rep_id: rep });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.assignment.rep_id, rep);
    assert.equal(body.assignment.state, 'locked');
    assert.equal(body.assignment.source_label, 'Set by an admin');
    assert.deepEqual(await assignmentRow('c1'),
      { sticky_rep_id: rep, sticky_source: 'manual', written_by: 'manual', provisional_rep_id: null, provisional_source: null });
  });

  it('[RED] ⚠ a member WITHOUT rep_assignment cannot — 403, and nothing is written', async () => {
    const rep = await seedMember({ email: 'rep2@corr.test', tier: 'general', fullName: 'Rep Two' });
    // A general member with an explicit empty permission set: authenticated, unprivileged.
    const nobody = await seedMember({ email: 'nobody@corr.test', tier: 'general', attributable: false, permissions: {} });
    const token = await sessionFor(nobody);

    const res = await patchAssignment(token, 'c1', { rep_id: rep });
    assert.equal(res.status, 403);
    assert.equal(await assignmentRow('c1'), null, 'the refusal is not cosmetic');
  });

  it('[RED] ⚠ a manual assignment SURVIVES a replay — existing-wins, and A36.3 is why', async () => {
    const owner = await seedMember({ email: 'owner3@corr.test', tier: 'owner', attributable: false });
    const chosen = await seedMember({ email: 'chosen@corr.test', tier: 'general', fullName: 'Chosen Rep' });
    const other = await seedMember({ email: 'other@corr.test', tier: 'general', fullName: 'Other Rep' });
    await pool.query(`UPDATE team_members SET jobber_user_id = 'ju-other' WHERE id = $1`, [other]);
    // History that names the OTHER rep — exactly what a replay would act on.
    await pool.query(
      `INSERT INTO crm_request_facts (contractor_id, jobber_request_id, jobber_client_id, created_at, assessment_id, assigned_jobber_user_ids)
       VALUES ($1, 'r1', 'c1', NOW() - INTERVAL '5 days', 'as-1', '["ju-other"]')`, [TENANT]);
    await pool.query(`UPDATE jobber_clients SET pipeline_stage = 'sold' WHERE contractor_id = $1 AND jobber_client_id = 'c1'`, [TENANT]);

    const token = await sessionFor(owner);
    assert.equal((await patchAssignment(token, 'c1', { rep_id: chosen })).status, 200);

    const { replayClientAttribution } = require('../utils/attributionReplay');
    await replayClientAttribution(pool, { contractorId: TENANT, jobberClientId: 'c1' });

    const row = await assignmentRow('c1');
    assert.equal(row.sticky_rep_id, chosen, 'the admin\'s decision stands');
    assert.equal(row.sticky_source, 'manual');
  });

  it('[RED] ⚠ CLEARING removes the row entirely — and a later replay CAN attribute the client again', async () => {
    // The ruling: clearing says "this is wrong", not "nobody may ever hold this client".
    // The CRM is what decides who is working it, so the engine is free to answer again.
    const owner = await seedMember({ email: 'owner4@corr.test', tier: 'owner', attributable: false });
    const rep = await seedMember({ email: 'rep4@corr.test', tier: 'general', fullName: 'Rep Four' });
    await pool.query(`UPDATE team_members SET jobber_user_id = 'ju-4' WHERE id = $1`, [rep]);
    const token = await sessionFor(owner);
    await patchAssignment(token, 'c1', { rep_id: rep });

    const res = await patchAssignment(token, 'c1', { rep_id: null });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).assignment, null);
    assert.equal(await assignmentRow('c1'), null, 'the row is gone, not blanked');

    await pool.query(
      `INSERT INTO crm_request_facts (contractor_id, jobber_request_id, jobber_client_id, created_at, assessment_id, assigned_jobber_user_ids)
       VALUES ($1, 'r1', 'c1', NOW() - INTERVAL '5 days', 'as-1', '["ju-4"]')`, [TENANT]);
    // ⚠ THE STAGE IS NOW SEEDED AS A FACT, NOT ONLY AS THE DISPLAY COLUMN (Commit 4, Q6).
    // decideFromFacts does not read jobber_clients.pipeline_stage, so this line alone left the
    // decision at 'lead' — which is in attributionEngine's GATE_EXCLUSIONS, so the sticky gate was
    // skipped and the client came back unattributed. The pipeline_stage write stays because the
    // column is still the display value; the crm_job_facts row is what 'sold' now MEANS.
    await pool.query(`UPDATE jobber_clients SET pipeline_stage = 'sold' WHERE contractor_id = $1 AND jobber_client_id = 'c1'`, [TENANT]);
    await pool.query(
      `INSERT INTO crm_job_facts (contractor_id, jobber_job_id, jobber_client_id, created_at)
       VALUES ($1, 'jf-c1', 'c1', NOW() - INTERVAL '20 days')
       ON CONFLICT (contractor_id, jobber_job_id) DO NOTHING`, [TENANT]);
    const { replayClientAttribution } = require('../utils/attributionReplay');
    await replayClientAttribution(pool, { contractorId: TENANT, jobberClientId: 'c1' });
    assert.equal((await assignmentRow('c1')).sticky_rep_id, rep, 'the engine may answer again — that is the ruling');
  });

  it('[RED] the activity log records WHO changed it and WHAT to, for both assign and clear', async () => {
    const owner = await seedMember({ email: 'owner5@corr.test', tier: 'owner', attributable: false });
    const rep = await seedMember({ email: 'rep5@corr.test', tier: 'general', fullName: 'Rep Five' });
    const token = await sessionFor(owner);
    await patchAssignment(token, 'c1', { rep_id: rep });
    await patchAssignment(token, 'c1', { rep_id: null });

    const { rows } = await pool.query(
      `SELECT detail FROM activity_log WHERE category = 'admin_action' ORDER BY id`);
    const details = rows.map((r) => r.detail).filter((d) => d.includes('c1'));
    assert.match(details[0], new RegExp(`assigned to rep ${rep} \\(by team_member #${owner}\\)`));
    assert.match(details[1], new RegExp(`assignment cleared \\(by team_member #${owner}\\)`));
  });

  it('[RED] ⚠ TENANCY — another contractor\'s client is a 404, not a cross-tenant write', async () => {
    const owner = await seedMember({ email: 'owner6@corr.test', tier: 'owner', attributable: false });
    const rep = await seedMember({ email: 'rep6@corr.test', tier: 'general', fullName: 'Rep Six' });
    await pool.query(`INSERT INTO contractors (id, name, status) VALUES ('correction-b', 'B', 'active') ON CONFLICT DO NOTHING`);
    await pool.query(
      `INSERT INTO jobber_clients (jobber_client_id, contractor_id, first_name, last_synced_at)
       VALUES ('theirs', 'correction-b', 'Theirs', NOW()) ON CONFLICT DO NOTHING`);
    const token = await sessionFor(owner);

    const res = await patchAssignment(token, 'theirs', { rep_id: rep });
    assert.equal(res.status, 404);
    const { rows } = await pool.query(
      `SELECT 1 FROM client_rep_assignments WHERE jobber_client_id = 'theirs'`);
    assert.equal(rows.length, 0);
    await pool.query(`DELETE FROM jobber_clients WHERE contractor_id = 'correction-b'`);
    await pool.query(`DELETE FROM contractors WHERE id = 'correction-b'`);
  });

  it('[RED] an UNASSIGNED client reads as null rather than an empty shape', async () => {
    // What the drawer renders its "not assigned" state from — 1,990 clients on Accent, so
    // a surface that treated "no row" as an error would be wrong about the normal case.
    assert.equal(await getClientAssignment(pool, TENANT, 'c1'), null);
    const rep = await seedMember({ email: 'rep7@corr.test', tier: 'general', fullName: 'Rep Seven' });
    await pool.query(
      `INSERT INTO client_rep_assignments (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at)
       VALUES ($1, 'c1', $2, 'mode_a', NOW())`, [TENANT, rep]);
    const read = await getClientAssignment(pool, TENANT, 'c1');
    assert.equal(read.state, 'provisional', 'and a provisional reads as provisional, not as locked');
    assert.equal(read.source_label, 'On the assessment for this visit');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('PART 2 — deactivation marks history and moves nothing', () => {

  it('[RED] ⚠ deactivating a rep TAGS their clients and leaves every assignment alone', async () => {
    const owner = await seedMember({ email: 'owner8@corr.test', tier: 'owner', attributable: false });
    const leaver = await seedMember({ email: 'leaver@corr.test', tier: 'general', fullName: 'Tom Rees' });
    await pool.query(
      `INSERT INTO client_rep_assignments (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at, written_by)
       VALUES ($1, 'c1', $2, 'mode_a_at_close', NOW(), 'replay')`, [TENANT, leaver]);
    await pool.query(
      `INSERT INTO client_rep_assignments (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at, written_by)
       VALUES ($1, 'c2', $2, 'mode_a', NOW(), 'live')`, [TENANT, leaver]);
    const token = await sessionFor(owner);

    const res = await fetch(`${base}/api/admin/team/${leaver}/deactivate`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);

    const tag = formerRepTag('Tom Rees');
    assert.deepEqual(await tagsOf('c1'), [tag], 'the locked client is marked');
    assert.deepEqual(await tagsOf('c2'), [tag], 'and the provisional one');
    // ⚠ THE RULING: a LOCKED assignment records that this person SOLD that client, and the
    // conversion and payout history depends on it. Deactivation records a fact; it moves nothing.
    const row = await assignmentRow('c1');
    assert.equal(row.sticky_rep_id, leaver, 'the assignment is untouched');
    assert.equal(row.sticky_source, 'mode_a_at_close');
    assert.equal((await assignmentRow('c2')).provisional_rep_id, leaver);
  });

  it('[RED] ⚠ THE CAMPAIGN FENCE — an audience naming the tag selects NOBODY, with a real audience as the control', async () => {
    const owner = await seedMember({ email: 'owner9@corr.test', tier: 'owner', attributable: false });
    const leaver = await seedMember({ email: 'leaver2@corr.test', tier: 'general', fullName: 'Tom Rees' });
    await pool.query(
      `INSERT INTO client_rep_assignments (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at)
       VALUES ($1, 'c1', $2, 'mode_a_at_close', NOW())`, [TENANT, leaver]);
    // c1 also carries an ordinary campaign tag, so the control audience really contains it.
    await pool.query(
      `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
       VALUES ('c1', $1, 'job_type:roof', 'jobber_crm', NOW())`, [TENANT]);
    const token = await sessionFor(owner);
    await fetch(`${base}/api/admin/team/${leaver}/deactivate`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });

    const tag = formerRepTag('Tom Rees');
    assert.ok(isAttributionTag(tag));

    const controlId = await seedAudience(pool, { contractorId: TENANT, name: 'roofs', tags: ['job_type:roof'], mode: 'OR' });
    const attributionId = await seedAudience(pool, { contractorId: TENANT, name: 'toms-old-clients', tags: [tag], mode: 'OR' });

    const controlResult = await evaluateAudience(pool, controlId);
    const attributionResult = await evaluateAudience(pool, attributionId);

    assert.equal(controlResult.memberCount, 1, 'THE POSITIVE CONTROL: an ordinary audience still selects the client');
    assert.equal(attributionResult.memberCount, 0, 'and the attribution tag selects nobody');
    assert.equal(attributionResult.refused, 'attribution_tag');
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM dynamic_audience_members WHERE audience_id = $1`, [attributionId]);
    assert.equal(rows[0].n, 0, 'no members were written either');
  });

  it('[RED] ⚠ a MIXED audience is empty too — dropping the tag would WIDEN it', async () => {
    // The sharp case: `attribution:x AND job_type:roof` must not quietly become
    // `job_type:roof`, which is a bigger send than anyone asked for.
    await pool.query(
      `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
       VALUES ('c1', $1, 'job_type:roof', 'jobber_crm', NOW())`, [TENANT]);
    const mixedId = await seedAudience(pool, {
      contractorId: TENANT, name: 'mixed', tags: [formerRepTag('Tom Rees'), 'job_type:roof'], mode: 'AND',
    });
    const result = await evaluateAudience(pool, mixedId);
    assert.equal(result.memberCount, 0);
    assert.equal(result.refused, 'attribution_tag');
  });

  it('[RED] a new request naming ANOTHER mapped rep assigns that rep, with the tag left as the record', async () => {
    // Danny's flow, end to end: departure marks history; someone new works the client; the
    // CRM says so; the engine assigns them normally. Nothing had to hand the client over.
    const owner = await seedMember({ email: 'owner10@corr.test', tier: 'owner', attributable: false });
    const leaver = await seedMember({ email: 'leaver3@corr.test', tier: 'general', fullName: 'Tom Rees' });
    const successor = await seedMember({ email: 'successor@corr.test', tier: 'general', fullName: 'New Rep' });
    await pool.query(`UPDATE team_members SET jobber_user_id = 'ju-new' WHERE id = $1`, [successor]);
    await pool.query(
      `INSERT INTO client_rep_assignments (contractor_id, jobber_client_id, provisional_rep_id, provisional_source, provisional_set_at)
       VALUES ($1, 'c1', $2, 'mode_a', NOW())`, [TENANT, leaver]);
    const token = await sessionFor(owner);
    await fetch(`${base}/api/admin/team/${leaver}/deactivate`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });

    await pool.query(
      `INSERT INTO crm_request_facts (contractor_id, jobber_request_id, jobber_client_id, created_at, assessment_id, assigned_jobber_user_ids)
       VALUES ($1, 'r-new', 'c1', NOW(), 'as-new', '["ju-new"]')`, [TENANT]);
    const { replayClientAttribution } = require('../utils/attributionReplay');
    await replayClientAttribution(pool, { contractorId: TENANT, jobberClientId: 'c1' });

    assert.equal((await assignmentRow('c1')).provisional_rep_id, successor, 'the new rep is assigned normally');
    assert.deepEqual(await tagsOf('c1'), [formerRepTag('Tom Rees')], 'and the history tag stays as the record');
  });

  it('[RED] reactivating the member REMOVES the tag — it records a departure that did not last', async () => {
    const owner = await seedMember({ email: 'owner11@corr.test', tier: 'owner', attributable: false });
    const leaver = await seedMember({ email: 'leaver4@corr.test', tier: 'general', fullName: 'Tom Rees' });
    await pool.query(
      `INSERT INTO client_rep_assignments (contractor_id, jobber_client_id, sticky_rep_id, sticky_source, sticky_set_at)
       VALUES ($1, 'c1', $2, 'mode_a_at_close', NOW())`, [TENANT, leaver]);
    const token = await sessionFor(owner);
    await fetch(`${base}/api/admin/team/${leaver}/deactivate`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
    assert.equal((await tagsOf('c1')).length, 1, 'precondition');

    const res = await fetch(`${base}/api/admin/team/${leaver}/reactivate`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await tagsOf('c1'), [], 'the tag is gone');
    assert.equal((await assignmentRow('c1')).sticky_rep_id, leaver, 'and the assignment never moved either way');
  });

  it('[RED] ⚠ the rebuild does NOT count a DEACTIVATED attributable member as unmapped', async () => {
    // Danny's ruling: a departed colleague must not be able to block the rebuild forever.
    const { unmappedAttributableReps } = require('../jobs/repAssignmentRebuild');
    const active = await seedMember({ email: 'active@corr.test', tier: 'general', fullName: 'Active Rep' });
    await pool.query(`UPDATE team_members SET jobber_user_id = 'ju-active' WHERE id = $1`, [active]);
    const gone = await seedMember({ email: 'gone@corr.test', tier: 'general', fullName: 'Gone Rep' });
    await pool.query(`UPDATE team_members SET active = false WHERE id = $1`, [gone]);

    assert.deepEqual(await unmappedAttributableReps(pool, TENANT), [], 'a deactivated unmapped rep is not a blocker');

    const stillHere = await seedMember({ email: 'stillhere@corr.test', tier: 'general', fullName: 'Unmapped Rep' });
    const blockers = await unmappedAttributableReps(pool, TENANT);
    assert.equal(blockers.length, 1, 'but an ACTIVE unmapped rep still is');
    assert.equal(blockers[0].id, stillHere);
  });
});
