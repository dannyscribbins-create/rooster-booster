'use strict';

// ── "Paid client" IS SELECTABLE AS AN AUDIENCE (3d Phase 1a Commit 4c) ───────
//
// Danny's ruling: paying_client must be offerable in the audience builder, labelled
// "Paid client", without breaking the existing prefixed and system tag groups.
//
// ⚠ THE DEFECT: paying_client SATISFIED NEITHER OF THE SUMMARY'S TWO QUERIES.
// The prefixed query requires `tag LIKE '%:%'` and it has no colon; the system query
// requires `source = 'system'` and deriveAndSaveTags writes it as `jobber_crm`. It fell
// through the gap, so an admin reaching for "clients who have paid" could only find
// `invoice:paid` — Jobber's verbatim status mirror, which after 4a does NOT agree with
// RoofMiles' own decision on a $0 or unsettled invoice. The tag existed, was written on
// every derivation, and could not be chosen.
//
// ⚠ AND THE SECOND HALF IS THE REBUILD. Both audience builders reconstruct a selectable
// tag as `prefix:value`, which is right for every prefixed group and WRONG for a bare
// one — it would offer `client_status:paying_client`, a string no row holds, and the
// audience would select NOBODY while reporting success. That is why the group carries
// `bare: true` and why the cases below assert the VALUE is the whole stored tag.

const { initTestDb } = require('./setup');
const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { createApp } = require('../app');
const { evaluateAudience } = require('../cron/jobs/dynamicAudiences');
const { seedContractor, seedJobberClient, seedAudience, startTestServer, stopTestServer } = require('./helpers');

const A = 'payaud-a';
const B = 'payaud-b';

// ⚠ ONE POOL PER FILE, NOT ONE PER describe — AND THIS FILE PROVED WHY ON ITS FIRST RUN.
// initTestDb() returns the server/db.js pool SINGLETON. With a before/after pair inside
// each describe, the first suite's after() called pool.end() and the second suite's
// setup then threw "Cannot use a pool after calling end on the pool" DURING setup — so
// its four cases were CANCELLED, not failed. The run reported `pass 8 · fail 0` with an
// entire describe that never executed, which is exactly the green-looking summary
// CLAUDE.md records. The lifecycle is file-level for that reason; do not move it back.
let pool, server, port;

before(async () => {
  pool = await initTestDb();
  ({ server, port } = await startTestServer(createApp()));
});

after(async () => {
  await stopTestServer(server);
  await pool.end();
});

// ⚠ NOT helpers.seedTag — IT HARDCODES source 'system', AND THE SOURCE IS THE WHOLE
// SUBJECT HERE. paying_client is written by deriveAndSaveTags with source 'jobber_crm',
// which is precisely why the system query could not see it. Seeding it as 'system'
// would make every case below pass through the OTHER query and prove nothing.
async function seedCrmTag(pool, { contractorId, jobberClientId, tag, source = 'jobber_crm' }) {
  await pool.query(
    `INSERT INTO contact_tags (jobber_client_id, contractor_id, tag, source, applied_at)
     VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING`,
    [jobberClientId, contractorId, tag, source]
  );
}

function httpGet(port, path, token) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {} },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
          catch { resolve({ status: res.statusCode, body: text }); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// Owner tier short-circuits requirePermission(), so no JSONB flags are needed.
async function seedOwnerAdminSession(pool, contractorId, tag) {
  const hash = await bcrypt.hash('TestAdmin123!', 4);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
     VALUES ($1, $2, $3, 'owner', '{}') RETURNING id`,
    [contractorId, `owner-${tag}@payaud-test.com`, hash]
  );
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
     VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
    [token, contractorId, rows[0].id]
  );
  return token;
}

// ═════════════════════════════════════════════════════════════════════════════
describe('jobber-client-tag-summary offers paying_client as a bare group', () => {
// ═════════════════════════════════════════════════════════════════════════════

  let tokenA, tokenB;

  const summary = async (token, query = '') =>
    httpGet(port, `/api/admin/jobber-client-tag-summary${query}`, token);

  const groupFor = (body, prefix) => body.categories.find((c) => c.prefix === prefix);

  beforeEach(async () => {
    for (const c of [A, B]) {
      await pool.query('DELETE FROM sessions WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM contact_tags WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM jobber_clients WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM contractor_settings WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM team_members WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM titles WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM contractors WHERE id = $1', [c]);
      await seedContractor(pool, c);
    }
    tokenA = await seedOwnerAdminSession(pool, A, 'a');
    tokenB = await seedOwnerAdminSession(pool, B, 'b');

    for (const jid of ['pa-1', 'pa-2', 'pa-3']) {
      await seedJobberClient(pool, { contractorId: A, jobberClientId: jid, name: `Client ${jid}` });
    }
    await seedJobberClient(pool, { contractorId: B, jobberClientId: 'pb-1', name: 'Other tenant' });

    // Tenant A: two paying clients, one prefixed tag, one system tag.
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-1', tag: 'paying_client' });
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-2', tag: 'paying_client' });
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-1', tag: 'invoice:paid' });
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-3', tag: 'value:under_5k' });
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-1', tag: 'App User', source: 'system' });

    // Tenant B: its OWN paying client, which must never reach tenant A's summary.
    await seedCrmTag(pool, { contractorId: B, jobberClientId: 'pb-1', tag: 'paying_client' });
  });

  it('the summary offers paying_client at all — the whole point of 4c', async () => {
    const res = await summary(tokenA);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const g = groupFor(res.body, 'client_status');
    assert.ok(g, 'there must be a client_status group');
    assert.ok(g.values.includes('paying_client'),
      'before 4c this tag satisfied neither query and was unselectable');
  });

  it('the VALUE is the whole stored tag, and the group says so with bare: true', async () => {
    // ⚠ THIS IS THE CASE THAT STOPS THE REBUILD DEFECT. Both builders would otherwise
    // offer `client_status:paying_client`, which no row holds — an audience that
    // selects nobody and reports success.
    const g = groupFor((await summary(tokenA)).body, 'client_status');
    assert.equal(g.bare, true, 'the client must be told not to rebuild prefix:value');
    for (const v of g.values) {
      assert.ok(!v.includes(':'), `${v} must be a bare tag, not a value half`);
    }
  });

  it('PAIRED POSITIVE — the prefixed groups still appear, with their value halves', async () => {
    const body = (await summary(tokenA)).body;
    const invoice = groupFor(body, 'invoice');
    const value = groupFor(body, 'value');
    assert.ok(invoice, 'the invoice group must survive the third query');
    assert.deepEqual(invoice.values, ['paid']);
    assert.notEqual(invoice.bare, true, 'a prefixed group must NOT be marked bare');
    assert.ok(value && value.values.includes('under_5k'));
  });

  it('PAIRED POSITIVE — the roofmiles system group still appears', async () => {
    const g = groupFor((await summary(tokenA)).body, 'roofmiles');
    assert.ok(g, 'the system-tag group must survive the third query');
    assert.ok(g.values.includes('app_user'), 'and keep its own normalised values');
  });

  it('TENANCY — another contractor\'s paying_client never reaches this summary', async () => {
    const gA = groupFor((await summary(tokenA)).body, 'client_status');
    assert.equal(gA.contactCount, 2, 'tenant A has exactly two paying clients, not three');

    // The paired positive: tenant B sees its own, so the absence above is scoping and
    // not a query that simply returns nothing.
    const gB = groupFor((await summary(tokenB)).body, 'client_status');
    assert.ok(gB && gB.values.includes('paying_client'), 'tenant B must see its own');
    assert.equal(gB.contactCount, 1);
  });

  it('an attribution tag is excluded from the bare group', async () => {
    // Attribution tags are bare and jobber_crm-sourced, so without the shared exclusion
    // the new query would surface internal bookkeeping as an audience filter.
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-3', tag: 'rm_attr_former-rep:Tom' });
    const g = groupFor((await summary(tokenA)).body, 'client_status');
    assert.ok(!g.values.some((v) => v.startsWith('rm_attr')), 'attribution tags are not audience tags');
  });

  it('visibleOnly honours a contractor hiding the group, and spares the others', async () => {
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, tag_group_visibility)
       VALUES ($1, $2)
       ON CONFLICT (contractor_id) DO UPDATE SET tag_group_visibility = EXCLUDED.tag_group_visibility`,
      [A, JSON.stringify({ client_status: { enabled: false, hidden_values: [] } })]
    );
    const body = (await summary(tokenA, '?visibleOnly=true')).body;
    assert.equal(groupFor(body, 'client_status'), undefined, 'the hidden group must be gone');
    assert.ok(groupFor(body, 'invoice'), 'and nothing else may go with it');
    assert.ok(groupFor(body, 'roofmiles'));
  });

  it('a contractor with no paying_client gets no empty group', async () => {
    await pool.query(`DELETE FROM contact_tags WHERE contractor_id = $1 AND tag = 'paying_client'`, [A]);
    const body = (await summary(tokenA)).body;
    assert.equal(groupFor(body, 'client_status'), undefined, 'an empty group is clutter, not information');
    assert.ok(groupFor(body, 'invoice'), 'the rest of the summary is unaffected');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('an audience on paying_client selects exactly the tagged clients', () => {
// ═════════════════════════════════════════════════════════════════════════════

  // ⚠ OFFERING THE TAG PROVES NOTHING ABOUT WHAT AN AUDIENCE BUILT ON IT DOES.
  // These cases drive the real evaluator, because a tag that is selectable and selects
  // the wrong people is worse than one that is not selectable at all.

  beforeEach(async () => {
    await pool.query('DELETE FROM dynamic_audiences');
    for (const c of [A, B]) {
      await pool.query('DELETE FROM contact_tags WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM contacts WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM jobber_clients WHERE contractor_id = $1', [c]);
      // ⚠ sessions/team_members/titles MUST GO BEFORE contractors, AND LEAVING THEM OUT
      // IS WHAT THIS HOOK DID FIRST. The describe above seeds an owner admin per tenant,
      // so this DELETE hit `team_members_contractor_id_fkey` and every case in THIS suite
      // failed — including ones that touch neither table. A hook fault and a subject fault
      // look different: a subject fault spares the cases that do not touch it.
      await pool.query('DELETE FROM sessions WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM team_members WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM titles WHERE contractor_id = $1', [c]);
      await pool.query('DELETE FROM contractors WHERE id = $1', [c]);
      await seedContractor(pool, c);
    }
  });

  const membersOf = async (audienceId) => (await pool.query(
    `SELECT jobber_client_id FROM dynamic_audience_members
     WHERE audience_id = $1 AND jobber_client_id IS NOT NULL ORDER BY jobber_client_id`,
    [audienceId])).rows.map((r) => r.jobber_client_id);

  it('selects the tagged clients and no others', async () => {
    for (const jid of ['pa-1', 'pa-2', 'pa-3']) {
      await seedJobberClient(pool, { contractorId: A, jobberClientId: jid, name: jid });
    }
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-1', tag: 'paying_client' });
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-2', tag: 'paying_client' });
    // pa-3 carries the MIRROR and not the decision — after 4a these disagree, and an
    // audience on the decision must not pick up the mirror's clients.
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-3', tag: 'invoice:paid' });

    const id = await seedAudience(pool, { contractorId: A, name: 'Paid clients', tags: ['paying_client'], mode: 'AND' });
    await evaluateAudience(pool, id);
    assert.deepEqual(await membersOf(id), ['pa-1', 'pa-2']);
  });

  it('TENANCY — another contractor\'s paying_client is not a member', async () => {
    await seedJobberClient(pool, { contractorId: A, jobberClientId: 'pa-1', name: 'A one' });
    await seedJobberClient(pool, { contractorId: B, jobberClientId: 'pb-1', name: 'B one' });
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-1', tag: 'paying_client' });
    await seedCrmTag(pool, { contractorId: B, jobberClientId: 'pb-1', tag: 'paying_client' });

    const id = await seedAudience(pool, { contractorId: A, name: 'Paid A', tags: ['paying_client'], mode: 'AND' });
    await evaluateAudience(pool, id);
    assert.deepEqual(await membersOf(id), ['pa-1'], 'tenant B\'s identically-tagged client must not appear');
  });

  it('a client carrying the tag plus others appears ONCE', async () => {
    // The fan-out shape this repo has recorded twice: a join on a non-unique key emits
    // one row per match while the count says one client.
    await seedJobberClient(pool, { contractorId: A, jobberClientId: 'pa-1', name: 'A one' });
    for (const t of ['paying_client', 'invoice:paid', 'value:over_15k']) {
      await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-1', tag: t });
    }
    const id = await seedAudience(pool, { contractorId: A, name: 'Paid once', tags: ['paying_client'], mode: 'AND' });
    await evaluateAudience(pool, id);
    assert.deepEqual(await membersOf(id), ['pa-1']);
  });

  it('a rebuilt prefix:value form selects NOBODY — the defect bare: true prevents', async () => {
    // ⚠ THIS IS THE NEGATIVE THAT MAKES bare: true FALSIFIABLE. If a builder ever
    // rebuilds the bare group the way it rebuilds a prefixed one, this is what the
    // contractor gets: an audience that reports success and mails nobody.
    await seedJobberClient(pool, { contractorId: A, jobberClientId: 'pa-1', name: 'A one' });
    await seedCrmTag(pool, { contractorId: A, jobberClientId: 'pa-1', tag: 'paying_client' });

    const bad = await seedAudience(pool, { contractorId: A, name: 'Rebuilt', tags: ['client_status:paying_client'], mode: 'AND' });
    await evaluateAudience(pool, bad);
    assert.deepEqual(await membersOf(bad), [], 'the rebuilt form matches no stored tag');

    const good = await seedAudience(pool, { contractorId: A, name: 'Bare', tags: ['paying_client'], mode: 'AND' });
    await evaluateAudience(pool, good);
    assert.deepEqual(await membersOf(good), ['pa-1'], 'and the bare form is what works');
  });
});
