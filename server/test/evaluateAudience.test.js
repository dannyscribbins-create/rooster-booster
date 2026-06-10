'use strict';

// setup.js MUST be required first — it loads .env.test and runs the safety
// interlock before db.js (required transitively below) creates its pool.
const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAudience } = require('../cron/jobs/dynamicAudiences');
const {
  seedContractor,
  seedJobberClient,
  seedContact,
  seedTag,
  seedAudience,
} = require('./helpers');

// Fixed UUIDs for contacts — deterministic so assertions are readable.
const C1_ID = '11111111-1111-1111-1111-111111111111';
const C2_ID = '22222222-2222-2222-2222-222222222222';
const CX_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('evaluateAudience', () => {
  let pool;

  before(async () => {
    pool = await initTestDb();
  });

  after(async () => {
    await pool.end();
  });

  // Clear only the tables touched by these tests; preserve schema.
  // Order respects FK constraints (audiences cascade to members; contacts cascade
  // to contact_jobber_links and the UUID side of dynamic_audience_members).
  beforeEach(async () => {
    await pool.query('DELETE FROM dynamic_audiences');   // cascades to dynamic_audience_members
    await pool.query('DELETE FROM contact_tags');
    await pool.query('DELETE FROM contacts');            // cascades to contact_jobber_links
    await pool.query('DELETE FROM jobber_clients');
    await pool.query('DELETE FROM contractor_settings');

    // Seed both contractors
    await seedContractor(pool, 'test-roofing');
    await seedContractor(pool, 'other-roofing');

    // Jobber clients J1..J5 for test-roofing
    for (const jid of ['j1', 'j2', 'j3', 'j4', 'j5']) {
      await seedJobberClient(pool, {
        contractorId: 'test-roofing',
        jobberClientId: jid,
        name: `Client ${jid}`,
        email: `${jid}@test.com`,
      });
    }

    // Contacts C1, C2 for test-roofing
    await seedContact(pool, { contractorId: 'test-roofing', id: C1_ID, name: 'Contact One', email: 'c1@test.com' });
    await seedContact(pool, { contractorId: 'test-roofing', id: C2_ID, name: 'Contact Two', email: 'c2@test.com' });

    // other-roofing: jobber client X1 and contact CX
    await seedJobberClient(pool, { contractorId: 'other-roofing', jobberClientId: 'x1', name: 'Client X1', email: 'x1@other.com' });
    await seedContact(pool, { contractorId: 'other-roofing', id: CX_ID, name: 'Contact X', email: 'cx@other.com' });

    // Tags: J1 ['invoice:paid', 'jobtype:Roof Replacement']
    await seedTag(pool, { contractorId: 'test-roofing', jobberClientId: 'j1', tag: 'invoice:paid' });
    await seedTag(pool, { contractorId: 'test-roofing', jobberClientId: 'j1', tag: 'jobtype:Roof Replacement' });
    // J2 ['invoice:paid']
    await seedTag(pool, { contractorId: 'test-roofing', jobberClientId: 'j2', tag: 'invoice:paid' });
    // J3 ['jobtype:Roof Replacement']
    await seedTag(pool, { contractorId: 'test-roofing', jobberClientId: 'j3', tag: 'jobtype:Roof Replacement' });
    // J4 ['Opted Out']
    await seedTag(pool, { contractorId: 'test-roofing', jobberClientId: 'j4', tag: 'Opted Out' });
    // J5: no tags

    // C1 ['App User', 'invoice:paid']
    await seedTag(pool, { contractorId: 'test-roofing', contactId: C1_ID, tag: 'App User' });
    await seedTag(pool, { contractorId: 'test-roofing', contactId: C1_ID, tag: 'invoice:paid' });
    // C2 ['App User']
    await seedTag(pool, { contractorId: 'test-roofing', contactId: C2_ID, tag: 'App User' });

    // other-roofing tags
    await seedTag(pool, { contractorId: 'other-roofing', jobberClientId: 'x1', tag: 'invoice:paid' });
    await seedTag(pool, { contractorId: 'other-roofing', contactId: CX_ID, tag: 'App User' });
  });

  // Returns rows sorted by a stable key for deep equality comparisons.
  async function getMembers(audienceId) {
    const { rows } = await pool.query(
      `SELECT contact_id, jobber_client_id
       FROM dynamic_audience_members
       WHERE audience_id = $1`,
      [audienceId]
    );
    return [...rows].sort((a, b) => {
      const ka = `${a.contact_id || ''}|${a.jobber_client_id || ''}`;
      const kb = `${b.contact_id || ''}|${b.jobber_client_id || ''}`;
      return ka.localeCompare(kb);
    });
  }

  // ── TEST 1 ────────────────────────────────────────────────────────────────────
  it('AND mode, single tag [invoice:paid] → J1, J2, C1 (count 3)', async () => {
    const audienceId = await seedAudience(pool, {
      contractorId: 'test-roofing',
      name: 'test-1',
      tags: ['invoice:paid'],
      mode: 'AND',
    });

    const { memberCount } = await evaluateAudience(pool, audienceId);
    assert.equal(memberCount, 3);

    const members = await getMembers(audienceId);
    assert.equal(members.length, 3);

    const jobberIds = members.filter(m => m.jobber_client_id).map(m => m.jobber_client_id).sort();
    const contactIds = members.filter(m => m.contact_id).map(m => String(m.contact_id));

    assert.deepEqual(jobberIds, ['j1', 'j2']);
    assert.deepEqual(contactIds, [C1_ID]);
  });

  // ── TEST 2 ────────────────────────────────────────────────────────────────────
  it('AND mode, two tags [invoice:paid, jobtype:Roof Replacement] → J1 only (count 1)', async () => {
    const audienceId = await seedAudience(pool, {
      contractorId: 'test-roofing',
      name: 'test-2',
      tags: ['invoice:paid', 'jobtype:Roof Replacement'],
      mode: 'AND',
    });

    const { memberCount } = await evaluateAudience(pool, audienceId);
    assert.equal(memberCount, 1);

    const members = await getMembers(audienceId);
    assert.equal(members.length, 1);
    assert.equal(members[0].jobber_client_id, 'j1');
    assert.equal(members[0].contact_id, null);
  });

  // ── TEST 3 ────────────────────────────────────────────────────────────────────
  it('OR mode, [invoice:paid, jobtype:Roof Replacement] → J1, J2, J3, C1 (count 4)', async () => {
    const audienceId = await seedAudience(pool, {
      contractorId: 'test-roofing',
      name: 'test-3',
      tags: ['invoice:paid', 'jobtype:Roof Replacement'],
      mode: 'OR',
    });

    const { memberCount } = await evaluateAudience(pool, audienceId);
    assert.equal(memberCount, 4);

    const members = await getMembers(audienceId);
    assert.equal(members.length, 4);

    const jobberIds = members.filter(m => m.jobber_client_id).map(m => m.jobber_client_id).sort();
    const contactIds = members.filter(m => m.contact_id).map(m => String(m.contact_id));

    assert.deepEqual(jobberIds, ['j1', 'j2', 'j3']);
    assert.deepEqual(contactIds, [C1_ID]);
  });

  // ── TEST 4 ────────────────────────────────────────────────────────────────────
  it('empty tags → all test-roofing members J1..J5 + C1 + C2 (count 7), no other-roofing', async () => {
    const audienceId = await seedAudience(pool, {
      contractorId: 'test-roofing',
      name: 'test-4',
      tags: [],
      mode: 'AND',
    });

    const { memberCount } = await evaluateAudience(pool, audienceId);
    assert.equal(memberCount, 7);

    const members = await getMembers(audienceId);
    assert.equal(members.length, 7);

    const jobberIds = members.filter(m => m.jobber_client_id).map(m => m.jobber_client_id).sort();
    const contactIds = members.filter(m => m.contact_id).map(m => String(m.contact_id)).sort();

    assert.deepEqual(jobberIds, ['j1', 'j2', 'j3', 'j4', 'j5']);
    assert.deepEqual(contactIds, [C1_ID, C2_ID].sort());

    // Verify other-roofing members never appear
    const allJobberIds = members.map(m => m.jobber_client_id).filter(Boolean);
    assert.ok(!allJobberIds.includes('x1'), 'x1 must not appear in test-roofing audience');
    const allContactIds = members.map(m => m.contact_id).filter(Boolean).map(String);
    assert.ok(!allContactIds.includes(CX_ID), 'CX must not appear in test-roofing audience');
  });

  // ── TEST 5 ────────────────────────────────────────────────────────────────────
  it('roofmiles: prefix — roofmiles:app_user resolves to App User → C1, C2', async () => {
    const audienceId = await seedAudience(pool, {
      contractorId: 'test-roofing',
      name: 'test-5a',
      tags: ['roofmiles:app_user'],
      mode: 'OR',
    });

    const { memberCount } = await evaluateAudience(pool, audienceId);
    assert.equal(memberCount, 2);

    const members = await getMembers(audienceId);
    const contactIds = members.map(m => String(m.contact_id)).sort();
    assert.deepEqual(contactIds, [C1_ID, C2_ID].sort());
  });

  it('roofmiles: prefix — roofmiles:sms_opted_out resolves to SMS Opted Out (ROOFMILES_TAG_OVERRIDES) → J4', async () => {
    // Seed 'SMS Opted Out' on J4 for this specific test (standard fixture has 'Opted Out' on J4)
    await seedTag(pool, { contractorId: 'test-roofing', jobberClientId: 'j4', tag: 'SMS Opted Out' });

    const audienceId = await seedAudience(pool, {
      contractorId: 'test-roofing',
      name: 'test-5b',
      tags: ['roofmiles:sms_opted_out'],
      mode: 'OR',
    });

    const { memberCount } = await evaluateAudience(pool, audienceId);
    assert.equal(memberCount, 1);

    const members = await getMembers(audienceId);
    assert.equal(members[0].jobber_client_id, 'j4');
  });

  // ── TEST 6 ────────────────────────────────────────────────────────────────────
  it('contractor isolation — OR mode on [invoice:paid] returns count 3, never includes other-roofing X1', async () => {
    const audienceId = await seedAudience(pool, {
      contractorId: 'test-roofing',
      name: 'test-6',
      tags: ['invoice:paid'],
      mode: 'OR',
    });

    const { memberCount } = await evaluateAudience(pool, audienceId);
    assert.equal(memberCount, 3);

    const members = await getMembers(audienceId);
    const allJobberIds = members.map(m => m.jobber_client_id).filter(Boolean);
    assert.ok(!allJobberIds.includes('x1'), 'x1 (other-roofing) must not appear in test-roofing audience');
    assert.deepEqual(allJobberIds.sort(), ['j1', 'j2']);
  });

  // ── TEST 7 ────────────────────────────────────────────────────────────────────
  it('re-evaluation replaces atomically — no duplicates, member_count equals row count', async () => {
    const audienceId = await seedAudience(pool, {
      contractorId: 'test-roofing',
      name: 'test-7',
      tags: ['invoice:paid'],
      mode: 'AND',
    });

    const first = await evaluateAudience(pool, audienceId);
    const second = await evaluateAudience(pool, audienceId);

    assert.equal(first.memberCount, second.memberCount);

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM dynamic_audience_members WHERE audience_id = $1`,
      [audienceId]
    );
    assert.equal(parseInt(countRows[0].cnt), second.memberCount, 'row count must equal memberCount after re-evaluation');
  });

  // ── TEST 8 ────────────────────────────────────────────────────────────────────
  it('inactive audience — returns { memberCount: 0 }, pre-existing members untouched', async () => {
    const audienceId = await seedAudience(pool, {
      contractorId: 'test-roofing',
      name: 'test-8',
      tags: ['invoice:paid'],
      mode: 'AND',
    });

    // Populate members with a first evaluation
    await evaluateAudience(pool, audienceId);
    const membersBefore = await getMembers(audienceId);
    assert.equal(membersBefore.length, 3, 'sanity check: 3 members before deactivation');

    // Deactivate the audience
    await pool.query(`UPDATE dynamic_audiences SET is_active = FALSE WHERE id = $1`, [audienceId]);

    // Evaluate the now-inactive audience
    const { memberCount } = await evaluateAudience(pool, audienceId);
    assert.equal(memberCount, 0);

    // Members from the first evaluation must still be in the table
    const membersAfter = await getMembers(audienceId);
    assert.equal(membersAfter.length, 3, 'pre-existing members must not be touched when audience is inactive');
  });

  // ── TEST 9 ────────────────────────────────────────────────────────────────────
  it('member_count on dynamic_audiences equals actual row count in dynamic_audience_members', async () => {
    const audienceId = await seedAudience(pool, {
      contractorId: 'test-roofing',
      name: 'test-9',
      tags: ['invoice:paid'],
      mode: 'OR',
    });

    const { memberCount } = await evaluateAudience(pool, audienceId);

    const { rows: audRows } = await pool.query(
      `SELECT member_count FROM dynamic_audiences WHERE id = $1`,
      [audienceId]
    );
    assert.equal(audRows[0].member_count, memberCount, 'dynamic_audiences.member_count must match returned memberCount');

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM dynamic_audience_members WHERE audience_id = $1`,
      [audienceId]
    );
    assert.equal(parseInt(countRows[0].cnt), memberCount, 'actual member row count must match memberCount');
  });
});
