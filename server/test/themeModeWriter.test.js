'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c PHASE 1b — RED SUITE — THE THEME-MODE WRITER AND THE team_member READ
//
// WHAT THIS PINS. `user_preferences` has had a reader since C/DL-3b and has
// NEVER HAD A WRITER. setPreference() shipped in 3a with zero production
// callers and still has none. This phase gives it one, and gives the read path
// a `team_member` subject so a field rep's stored mode can load at all.
//
// ⚠ THE TENANCY PREDICATE HAS NEVER EXECUTED IN PRODUCTION. setPreference's
// `ON CONFLICT … DO UPDATE … WHERE user_preferences.contractor_id = $2` was
// written in 3a as defence-in-depth and has been unreachable ever since,
// because nothing called the function. A guard nobody has seen work is a claim,
// not a guard — so it is exercised here directly AND through the route, and
// guard-proofed by removal.
//
// ⚠ ZERO ROWS AFFECTED MUST NOT LOOK LIKE SUCCESS. `DO UPDATE … WHERE` that
// matches nothing raises no error; the INSERT simply does nothing and the
// statement returns cleanly. That is the same silent shape as the
// `ON CONFLICT DO NOTHING` first-writer-wins race already on the pre-launch
// checklist. setPreference therefore returns its row count and the handler
// refuses to answer 200 on zero.
//
// ⚠ THE GATE IS TESTED IN BOTH DIRECTIONS, and that is not symmetry for its own
// sake: a one-directional negative test passes identically against a gate that
// rejects EVERYONE, which is a broken feature that looks like a secure one.
// Every "cannot set" case below is paired with a "can set" on the same fixture.
//
// THE RULING BEING ENFORCED (CD-21, ruled again in Phase 1a): the preference is
// user-level and SHARED by design — one store, both apps. What is gated is who
// may SET it. The setter is REP-ONLY, because a referrer flipping it would get
// dark shared primitives on a light R canvas: the referrer app reads no --rm-*
// at all.
//
// EXPECTED RED TODAY: PUT /api/preferences/theme-mode does not exist (404 on
// every write case), and the read path is verifyReferrerSession-only, so every
// team-subject case fails on 401.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor, seedUser, seedSession } = require('./helpers');

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';
const THEME_MODE_KEY = 'theme_mode';

let pool;
let server;
let port;
const base = () => `http://localhost:${port}`;

// ── FIXTURES ────────────────────────────────────────────────────────────────

async function seedTeamMember(p, { contractorId, email, tier = 'general', isFieldRep = true }) {
  const { rows } = await p.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions, is_field_rep)
     VALUES ($1, $2, 'x', $3, '{}'::jsonb, $4)
     ON CONFLICT (email) DO UPDATE SET tier = EXCLUDED.tier,
                                       is_field_rep = EXCLUDED.is_field_rep,
                                       contractor_id = EXCLUDED.contractor_id,
                                       active = true
     RETURNING id`,
    [contractorId, email, tier, isFieldRep]
  );
  return rows[0].id;
}

async function seedTeamSession(p, { contractorId, teamMemberId }) {
  const token = crypto.randomBytes(32).toString('hex');
  await p.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
     VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
    [token, contractorId, teamMemberId]
  );
  return token;
}

async function seedReferrerSession(p, { contractorId, email }) {
  const userId = await seedUser(p, { fullName: 'A Referrer', email, contractorId });
  const token = crypto.randomBytes(32).toString('hex');
  await seedSession(p, { userId, token, role: 'referrer', contractorId });
  return { userId, token };
}

const put = (token, body) => fetch(`${base()}/api/preferences/theme-mode`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

const get = (token) => fetch(`${base()}/api/preferences/theme-mode`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

// Reads the row directly, so an assertion never learns the outcome from the
// same endpoint that produced it.
async function storedFor(column, id) {
  const { rows } = await pool.query(
    `SELECT pref_value, contractor_id FROM user_preferences
      WHERE ${column} = $1 AND pref_key = $2`,
    [id, THEME_MODE_KEY]
  );
  return rows[0] ?? null;
}

describe('C/DL-3c Phase 1b — the theme-mode writer', () => {
  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
    await seedContractor(pool, TENANT_A);
    await seedContractor(pool, TENANT_B);
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // Sessions before users: sessions.user_id has no cascade. team_members are
    // NOT cleared — every fixture below uses its own email, and other tables
    // reference them.
    await pool.query('DELETE FROM user_preferences');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
  });

  // ── THE WRITER EXISTS AND ROUND-TRIPS ─────────────────────────────────────

  it('[RED] a field rep sets dark, and the row lands under team_member_id', async () => {
    const memberId = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-a@x.test' });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: memberId });

    const res = await put(token, { mode: 'dark' });
    assert.equal(res.status, 200, `write was refused: ${res.status}`);
    assert.deepEqual(await res.json(), { mode: 'dark' });

    // ASSERTED AGAINST THE TABLE, not against the endpoint that just wrote it.
    const row = await storedFor('team_member_id', memberId);
    assert.ok(row, 'no user_preferences row was written for the team member');
    assert.equal(row.pref_value, 'dark');
    assert.equal(row.contractor_id, TENANT_A, 'the row did not carry the writer tenant');
  });

  it('[RED] the same rep can change their mind — the upsert updates rather than duplicating', async () => {
    // This is the ON CONFLICT path, which is the half that has never run.
    const memberId = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-b@x.test' });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: memberId });

    assert.equal((await put(token, { mode: 'dark' })).status, 200);
    assert.equal((await put(token, { mode: 'light' })).status, 200);

    const { rows } = await pool.query(
      'SELECT pref_value FROM user_preferences WHERE team_member_id = $1 AND pref_key = $2',
      [memberId, THEME_MODE_KEY]
    );
    assert.equal(rows.length, 1, `the upsert duplicated instead of updating — ${rows.length} rows`);
    assert.equal(rows[0].pref_value, 'light');
  });

  // ── THE REP-ONLY GATE, BOTH DIRECTIONS ────────────────────────────────────

  it('[RED] a REFERRER cannot set the mode, and a rep on the same tenant can', async () => {
    // ⚠ THE POSITIVE CONTROL IS THE POINT. "A referrer is refused" passes
    // identically against a route that refuses everyone, which would be a dead
    // endpoint wearing a security posture. The pair is what separates them.
    const { token: referrerToken, userId } = await seedReferrerSession(pool, {
      contractorId: TENANT_A, email: 'homeowner@x.test',
    });
    const memberId = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-c@x.test' });
    const repToken = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: memberId });

    const denied = await put(referrerToken, { mode: 'dark' });
    assert.equal(denied.status, 403, `a referrer was allowed to set the mode (${denied.status})`);
    assert.equal(await storedFor('user_id', userId), null, 'a referrer row was written despite the 403');

    const allowed = await put(repToken, { mode: 'dark' });
    assert.equal(allowed.status, 200, 'the gate refuses the rep too — it rejects everyone');
  });

  it('[RED] a team member who is NOT a field rep cannot set it, and one who is can', async () => {
    // Office staff hold an admin-role session exactly as a rep does, so role
    // alone cannot separate them. The flag is what decides.
    const staffId = await seedTeamMember(pool, {
      contractorId: TENANT_A, email: 'office@x.test', tier: 'admin', isFieldRep: false,
    });
    const staffToken = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: staffId });

    const repId = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-d@x.test' });
    const repToken = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: repId });

    const denied = await put(staffToken, { mode: 'dark' });
    assert.equal(denied.status, 403, `a non-rep team member was allowed to set the mode (${denied.status})`);
    assert.equal(await storedFor('team_member_id', staffId), null, 'a row was written despite the 403');

    assert.equal((await put(repToken, { mode: 'dark' })).status, 200,
      'the gate refuses a real field rep — it is keyed on the wrong thing');
  });

  it('[RED] no token is 401 and a bogus token is 401', async () => {
    assert.equal((await put(null, { mode: 'dark' })).status, 401);
    assert.equal((await put('not-a-real-token', { mode: 'dark' })).status, 401);
  });

  // ── VALIDATION ────────────────────────────────────────────────────────────

  it('[RED] refuses any mode that is not light or dark, and writes nothing', async () => {
    // pref_value is JSONB with NO CHECK constraint, so the column will hold
    // anything at all — and deriveThemeTokens THROWS on an unknown mode rather
    // than defaulting. One junk row is a blank app for that rep, so the gate is
    // here, at the only writer.
    const memberId = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-e@x.test' });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: memberId });

    for (const bad of ['DARK', 'Light', '', 'auto', null, 42, { mode: 'dark' }, ['dark']]) {
      const res = await put(token, { mode: bad });
      assert.equal(res.status, 400, `mode ${JSON.stringify(bad)} was accepted`);
    }
    assert.equal(await storedFor('team_member_id', memberId), null, 'a rejected mode still wrote a row');

    // Positive control on the same fixture: the validator is not refusing everything.
    assert.equal((await put(token, { mode: 'dark' })).status, 200);
  });

  // ── TENANCY ───────────────────────────────────────────────────────────────

  it('[RED] a rep write cannot reach another subject\'s row', async () => {
    const mine = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-f@x.test' });
    const theirs = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-g@x.test' });
    const myToken = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: mine });

    const wrote = await put(myToken, { mode: 'dark' });
    // PRECONDITION, NAMED. Without it a refused write makes the next line a bare
    // TypeError on null, which reports nothing about the property under test.
    assert.equal(wrote.status, 200,
      `the write itself was refused (${wrote.status}) — this test cannot speak to isolation`);

    assert.equal((await storedFor('team_member_id', mine)).pref_value, 'dark');
    assert.equal(await storedFor('team_member_id', theirs), null,
      'the write reached a second subject — the subject id is not coming from the session');
  });

  it('[RED] the subject comes from the SESSION, not from the body', async () => {
    // The obvious implementation reads a subject id off the request. Every
    // identity value must come from the verified session (CLAUDE.md, Security).
    const mine = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-h@x.test' });
    const victim = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-i@x.test' });
    const myToken = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: mine });

    const wrote = await put(myToken, { mode: 'dark', team_member_id: victim, teamMemberId: victim, subjectId: victim });
    assert.equal(wrote.status, 200,
      `the write itself was refused (${wrote.status}) — this test cannot speak to subject selection`);

    assert.equal(await storedFor('team_member_id', victim), null,
      'a body field selected the subject — identity is being taken from the request');
    assert.equal((await storedFor('team_member_id', mine)).pref_value, 'dark');
  });

  // ── THE TENANCY PREDICATE'S FIRST EXECUTION ───────────────────────────────

  it('[RED] setPreference reports ZERO rows when the tenancy predicate blocks it', async () => {
    // ⚠ THE PREDICATE THAT HAS NEVER RUN. A pre-existing row under a DIFFERENT
    // contractor_id makes ON CONFLICT fire and DO UPDATE … WHERE match nothing.
    // Postgres raises NOTHING for that: the statement succeeds having changed
    // no rows. Without a row count the caller cannot tell it from a write.
    const { setPreference } = require('../utils/userPreferences');
    const memberId = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-j@x.test' });

    // Drifted row: same subject and key, wrong tenant.
    await pool.query(
      `INSERT INTO user_preferences (team_member_id, contractor_id, pref_key, pref_value)
       VALUES ($1, $2, $3, '"light"'::jsonb)`,
      [memberId, TENANT_B, THEME_MODE_KEY]
    );

    const affected = await setPreference({
      subjectType: 'team_member', subjectId: memberId,
      contractorId: TENANT_A, key: THEME_MODE_KEY, value: 'dark',
    });

    assert.equal(affected, 0, 'the mis-tenanted write was not reported as zero rows');

    // AND THE ROW IS UNTOUCHED — both its value and its tenant.
    const row = await storedFor('team_member_id', memberId);
    assert.equal(row.pref_value, 'light', 'the blocked write changed the value anyway');
    assert.equal(row.contractor_id, TENANT_B, 'the blocked write re-stamped the tenant');

    // POSITIVE CONTROL: the same call on a clean row reports one.
    await pool.query('DELETE FROM user_preferences');
    const ok = await setPreference({
      subjectType: 'team_member', subjectId: memberId,
      contractorId: TENANT_A, key: THEME_MODE_KEY, value: 'dark',
    });
    assert.equal(ok, 1, 'a legitimate write did not report one row — the count is not real');
  });

  it('[RED] the ROUTE refuses to answer 200 when zero rows were written', async () => {
    // The handler half of the rule above. A 200 here would be the silent
    // shape: the rep sees their toggle move and nothing was stored.
    const memberId = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-k@x.test' });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: memberId });

    await pool.query(
      `INSERT INTO user_preferences (team_member_id, contractor_id, pref_key, pref_value)
       VALUES ($1, $2, $3, '"light"'::jsonb)`,
      [memberId, TENANT_B, THEME_MODE_KEY]
    );

    const res = await put(token, { mode: 'dark' });
    assert.notEqual(res.status, 200, 'the route answered 200 on a write that stored nothing');
    assert.equal(res.status, 409);

    const body = await res.json();
    assert.ok(!/contractor|tenant|user_preferences/i.test(JSON.stringify(body)),
      'the error body leaks internals');
  });

  // ── THE team_member READ PATH ─────────────────────────────────────────────

  it('[RED] a rep reads back their own stored mode', async () => {
    const memberId = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-l@x.test' });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: memberId });

    await put(token, { mode: 'dark' });

    const res = await get(token);
    assert.equal(res.status, 200, 'a rep cannot read the mode they just set');
    assert.deepEqual(await res.json(), { mode: 'dark' });
  });

  it('[RED] one rep cannot read another rep\'s stored mode', async () => {
    const a = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-m@x.test' });
    const b = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-n@x.test' });
    const tokenA = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: a });
    const tokenB = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: b });

    await put(tokenA, { mode: 'dark' });

    assert.deepEqual(await (await get(tokenB)).json(), { mode: null },
      'a rep read another rep\'s preference');
    assert.deepEqual(await (await get(tokenA)).json(), { mode: 'dark' });
  });

  it('[RED] the referrer read path still works — the team subject did not replace it', async () => {
    // REGRESSION FENCE. The read endpoint served referrers before this phase and
    // must still: the store is shared by design (CD-21), and only the WRITE is
    // gated. Adding a second subject is the failure mode where the first quietly
    // stops working.
    const { token, userId } = await seedReferrerSession(pool, {
      contractorId: TENANT_A, email: 'homeowner2@x.test',
    });
    await pool.query(
      `INSERT INTO user_preferences (user_id, contractor_id, pref_key, pref_value)
       VALUES ($1, $2, $3, '"dark"'::jsonb)`,
      [userId, TENANT_A, THEME_MODE_KEY]
    );

    assert.deepEqual(await (await get(token)).json(), { mode: 'dark' });
  });
});
