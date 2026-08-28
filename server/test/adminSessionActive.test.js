'use strict';

const { initTestDb } = require('./setup');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');
const { startTestServer, stopTestServer } = require('./helpers');
const { verifyAdminSession } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// R4 + THE DEACTIVATE TRANSACTION — Wave 1.1-b.
//
// TWO DEFECTS, ONE SHARED ROOT, AND THAT IS WHY THEY ARE FENCED IN ONE FILE.
//
//   R4  verifyAdminSession() in server/middleware/auth.js queried sessions
//       only and never joined team_members, so a DEACTIVATED member holding a
//       live token kept working. Its siblings in that same file are both
//       stricter: verifyReferrerSession joins users and adds
//       `u.deleted_at IS NULL`; verifyAnySession reads `active` and denies.
//       ⚠ ALL FOUR OF THESE WERE CITED BY LINE AND ALL FOUR ROTTED INSIDE THIS
//       ONE COMMIT. The comment added to verifyAdminSession pushed everything
//       below it down ~45 lines, so :86-90 and :209 became :137 and :256 while
//       still resolving to real code — the silent variety, where the number
//       stays plausible. Names do not do that. Cite by role.
//
//   TX  The deactivate handler in server/routes/admin/team.js
//       (PATCH /api/admin/team/:id/deactivate) — DELETE sessions then UPDATE
//       active=false, as two bare pool.query calls with no transaction. If the
//       UPDATE fails the sessions are already gone and the member is STILL
//       ACTIVE: the caller sees a 500 and the member simply logs back in.
//       ⚠ CITED BY ROLE, NOT BY LINE. This read ":554-555" and the fix itself
//       moved those writes to :575-576 — citation rot authored and shipped in
//       one commit, which is the case CLAUDE.md's never-cross-file-by-line-
//       number rule exists for. The handler name cannot drift the same way.
//
// ⚠ THE ORDERING IS THE ONLY REASON R4 HAS NEVER BEEN REACHABLE. Deactivation
// deletes sessions FIRST, so "active=false with a live session" does not occur
// on any product path. Fix either alone and the pair stays fragile — which is
// why both land together.
//
// ── ⚠ EVERY STATE BELOW IS MANUFACTURED DIRECTLY IN THE TEST DATABASE ───────
// There is no product path to active=false-with-a-live-session, and there is NO
// REACTIVATION ROUTE ANYWHERE: every write to team_members.active in the
// codebase is SET active=false inside the deactivate handler in
// server/routes/admin/team.js, and
// PATCH /api/admin/team/:id builds its UPDATE from a four-field allowlist
// (server/routes/admin/team.js:294-297) that `active` cannot reach.
//
// So these tests INSERT and UPDATE the state directly. A test that cannot
// produce the state it asserts on is not a test — it is a green run. Being
// green by construction is the hazard here, not the goal.
// ─────────────────────────────────────────────────────────────────────────────

const CONTRACTOR_ID = 'accent-roofing';

function buildTeamTestApp() {
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/', require('../routes/admin/index'));
  return app;
}

function httpRequest(port, method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
    };
    const req = _httpRequest({ hostname: 'localhost', port, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function seedMember(pool, { email, tier, permissions = null }) {
  const hash = await bcrypt.hash('testpassword123', 10);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET tier = EXCLUDED.tier, permissions = EXCLUDED.permissions,
                                       active = true
     RETURNING id`,
    [CONTRACTOR_ID, email, hash, tier, permissions]
  );
  return rows[0].id;
}

async function makeSession(pool, memberId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
     VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
    [token, CONTRACTOR_ID, memberId]
  );
  return token;
}

// verifyAdminSession writes its own 401/500, so a caller must supply a res.
// Captured rather than discarded: a test asserting only the return value cannot
// tell "denied" from "threw and was swallowed".
function fakeReqRes(token) {
  const sent = { status: null, body: null };
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = {
    status(code) { sent.status = code; return res; },
    json(payload) { sent.body = payload; return res; },
  };
  return { req, res, sent };
}

// ⚠ ONE POOL FOR THE WHOLE FILE, ENDED ONCE, AND THAT IS NOT STYLE.
// initTestDb() returns the `pool` singleton from server/db.js. Two describes
// each calling initTestDb() in before() and pool.end() in after() means the
// FIRST suite's teardown kills the pool the second suite is about to use, and
// the second suite does not fail — it is CANCELLED, with "Cannot use a pool
// after calling end on the pool" surfacing from initDB(). A cancelled suite
// reports neither pass nor fail, so both of its tests silently do not run.
// Observed while writing this file: 3 passed, 2 failed, 2 CANCELLED.
let pool;
before(async () => { pool = await initTestDb(); });
after(async () => { await pool.end(); });

describe('R4 — verifyAdminSession must reject a deactivated team member', () => {
  let activeMemberId, inactiveMemberId, danglingMemberId;

  before(async () => {
    activeMemberId   = await seedMember(pool, { email: 'r4-active@team-test.com',   tier: 'admin' });
    inactiveMemberId = await seedMember(pool, { email: 'r4-inactive@team-test.com', tier: 'admin' });
    danglingMemberId = await seedMember(pool, { email: 'r4-dangling@team-test.com', tier: 'admin' });
  });

  // ── CASE 2 FIRST — THE POSITIVE CONTROL ────────────────────────────────────
  // Ordered first deliberately. A predicate that rejects EVERYTHING passes every
  // negative case below and looks identical to a working one. This is the
  // assertion that tells those two apart, so it must be seen passing.
  it('POSITIVE CONTROL: a live session whose member is active=true is ALLOWED', async () => {
    const token = await makeSession(pool, activeMemberId);
    const { rows } = await pool.query('SELECT active FROM team_members WHERE id = $1', [activeMemberId]);
    assert.equal(rows[0].active, true, 'precondition: member must be active for this control to mean anything');

    const { req, res, sent } = fakeReqRes(token);
    const result = await verifyAdminSession(req, res);

    assert.ok(result, 'an ACTIVE member with a live session must still be allowed through');
    assert.equal(result.teamMemberId, activeMemberId);
    assert.equal(result.contractorId, CONTRACTOR_ID);
    assert.equal(sent.status, null, 'no error response should have been written');
  });

  // ── CASE 1 — THE DEFECT ────────────────────────────────────────────────────
  it('[RED] a live session whose member is active=false is DENIED', async () => {
    const token = await makeSession(pool, inactiveMemberId);
    // MANUFACTURED. No product path reaches this state — deactivation deletes
    // sessions first, and nothing anywhere sets active back to true.
    await pool.query('UPDATE team_members SET active = false WHERE id = $1', [inactiveMemberId]);

    const { rows } = await pool.query('SELECT active FROM team_members WHERE id = $1', [inactiveMemberId]);
    assert.equal(rows[0].active, false, 'precondition: the state must actually have been manufactured');
    const { rows: srows } = await pool.query('SELECT 1 FROM sessions WHERE token = $1', [token]);
    assert.equal(srows.length, 1, 'precondition: the session must still exist');

    const { req, res, sent } = fakeReqRes(token);
    const result = await verifyAdminSession(req, res);

    assert.equal(
      result, null,
      'verifyAdminSession returned a session for a DEACTIVATED member. This is R4: ' +
      'the lookup queries sessions only and never joins team_members, so a revoked ' +
      'employee holding a live token keeps working on every session-only route.'
    );
    assert.equal(sent.status, 401, 'a rejected session must be answered 401, matching the expiry path');
  });

  // ── CASE 3 — THE NULL-DISJUNCT / FAIL-CLOSED CASE ──────────────────────────
  // ⚠ THIS STATE IS STRUCTURALLY UNREACHABLE TODAY AND THE TEST SAYS SO.
  // sessions_team_member_id_fkey is ON DELETE NO ACTION (verified: confdeltype
  // 'a'), so a member row cannot be deleted while a session references it, and
  // team_member_id cannot be repointed at a non-existent id. Both attempts fail
  // with 23503.
  //
  // It is fenced anyway, because the predicate's SHAPE decides what happens if
  // that ever changes, and the two plausible spellings differ:
  //     (s.team_member_id IS NULL OR tm.active = true)        -> denies   ✓
  //     (s.team_member_id IS NULL OR tm.active IS NOT FALSE)  -> ALLOWS   ✗
  // The second reads as equivalent and is not: a LEFT JOIN miss yields
  // tm.active = NULL, and NULL IS NOT FALSE is true.
  it('[RED] a live session pointing at a team_member row that no longer exists is DENIED', async () => {
    const token = await makeSession(pool, danglingMemberId);

    // The FK is what makes this unreachable, so it is dropped to manufacture the
    // state and restored in finally. Safe: initTestDb() runs
    // DROP SCHEMA public CASCADE and rebuilds from initDB() on every run
    // (server/test/setup.js:60-61,78), and --test-concurrency=1 means no other
    // suite is touching this database while it is down.
    await pool.query('ALTER TABLE sessions DROP CONSTRAINT sessions_team_member_id_fkey');
    try {
      await pool.query('DELETE FROM team_members WHERE id = $1', [danglingMemberId]);
      const { rows } = await pool.query('SELECT team_member_id FROM sessions WHERE token = $1', [token]);
      assert.equal(rows[0].team_member_id, danglingMemberId, 'precondition: the session still points at the deleted id');
      const { rows: gone } = await pool.query('SELECT 1 FROM team_members WHERE id = $1', [danglingMemberId]);
      assert.equal(gone.length, 0, 'precondition: the member row must actually be gone');

      const { req, res, sent } = fakeReqRes(token);
      const result = await verifyAdminSession(req, res);

      assert.equal(
        result, null,
        'verifyAdminSession returned a session whose team_member row does not exist. ' +
        'The predicate must fail CLOSED on a LEFT JOIN miss.'
      );
      assert.equal(sent.status, 401);
    } finally {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
      await pool.query(
        `ALTER TABLE sessions ADD CONSTRAINT sessions_team_member_id_fkey
         FOREIGN KEY (team_member_id) REFERENCES team_members(id)`
      );
    }

    // ⚠ VERIFY THE RESTORE ACTUALLY RESTORED, HERE, NOT ONLY IN THE SEPARATE
    // TRIPWIRE BELOW. If the ADD CONSTRAINT above silently no-opped or rebuilt
    // with different semantics, the tripwire would afterwards be asserting on a
    // constraint THIS TEST built rather than the one initDB() built — it would
    // pass, and it would be measuring the wrong object. That is a guard reading
    // its own output, which is the failure mode this project keeps finding.
    const { rows: restored } = await pool.query(`
      SELECT con.confdeltype
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
       WHERE rel.relname = 'sessions' AND con.conname = 'sessions_team_member_id_fkey'
    `);
    assert.equal(restored.length, 1, 'the FK was NOT restored — every later test in this run is now unguarded');
    assert.equal(
      restored[0].confdeltype, 'a',
      'the FK was restored with different ON DELETE semantics than initDB() creates. ' +
      'The tripwire test below would now be asserting on this test\'s artifact.'
    );
  });

  // ── THE FK ITSELF IS A TRIPWIRE, AND HERE IS WHY ───────────────────────────
  // ⚠ IF ANYONE ADDS ON DELETE SET NULL TO THIS FK, THE LEGACY DISJUNCT BELOW
  // SILENTLY BECOMES A BYPASS. Deleting a team member would set their live
  // session's team_member_id to NULL, and a NULL team_member_id is ALLOWED by
  // design (see the next test). A deleted employee's token would keep working,
  // and nothing in this file would go red — the dangling case above would stop
  // being reachable and the legacy case would absorb it.
  it('sessions_team_member_id_fkey is ON DELETE NO ACTION — the legacy disjunct depends on it', async () => {
    const { rows } = await pool.query(`
      SELECT con.confdeltype
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
       WHERE rel.relname = 'sessions' AND con.conname = 'sessions_team_member_id_fkey'
    `);
    assert.equal(rows.length, 1, 'sessions_team_member_id_fkey must exist');
    assert.equal(
      rows[0].confdeltype, 'a',
      'sessions_team_member_id_fkey is no longer ON DELETE NO ACTION. If it is now ' +
      'SET NULL, deleting a team member nulls their live session\'s team_member_id, ' +
      'which the legacy disjunct ALLOWS — a deleted employee keeps their access. ' +
      'Revisit the predicate in server/middleware/auth.js before changing this.'
    );
  });

  // ── CASE 4 — THE FENCE AROUND A DELIBERATE NON-CHANGE ──────────────────────
  // ⚠ THIS TEST IS NOT TESTING THE FIX. It fences the behaviour deliberately
  // LEFT ALONE, and it is the assertion that should stop someone tightening
  // this to an INNER JOIN without discovering the cost.
  //
  // A legacy admin session with team_member_id NULL predates the column
  // (server/middleware/permissions.js:58-61 documents the same shape). It stays
  // ALLOWED here because rejecting it is a DIFFERENT change from R4 and it is
  // already failed closed everywhere it matters: requirePermission fails it at
  // server/middleware/permissions.js:58-61, and GET /api/admin/me's own
  // `AND active = true` (server/routes/admin/index.js:169) yields no row for a
  // NULL id.
  //
  // An INNER JOIN would also break server/test/contractorContext.test.js:202-207,
  // which asserts exactly this and says so in a comment, and would silently
  // invalidate every admin session seeded through helpers.js's seedSession()
  // (server/test/helpers.js:131) — which does not set team_member_id at all.
  it('a legacy admin session with team_member_id NULL is still ALLOWED — deliberate, not an oversight', async () => {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2)`,
      [token, CONTRACTOR_ID]
    );

    const { req, res } = fakeReqRes(token);
    const result = await verifyAdminSession(req, res);

    assert.ok(
      result,
      'a legacy session with team_member_id NULL was rejected. If this was intentional ' +
      'it is a scope change beyond R4: it also breaks contractorContext.test.js and ' +
      'every session seeded by helpers.js seedSession(). Decide it openly, do not ' +
      'let an INNER JOIN make it by accident.'
    );
    assert.equal(result.teamMemberId, null);
    assert.equal(result.contractorId, CONTRACTOR_ID);
  });
});

describe('deactivate — the session DELETE and the active=false UPDATE are one transaction', () => {
  let server, port;
  let ownerId, ownerId2, targetId;

  before(async () => {
    ownerId  = await seedMember(pool, { email: 'tx-owner@team-test.com',  tier: 'owner' });
    ownerId2 = await seedMember(pool, { email: 'tx-owner2@team-test.com', tier: 'owner' });
    targetId = await seedMember(pool, { email: 'tx-target@team-test.com', tier: 'admin' });
    ({ server, port } = await startTestServer(buildTeamTestApp()));
  });

  after(async () => {
    await stopTestServer(server);
  });

  // ── POSITIVE CONTROL — the route works when nothing is forced to fail ──────
  // Without this, a route that 500s for an unrelated reason would satisfy the
  // rollback assertion below and look like a pass.
  it('POSITIVE CONTROL: a normal deactivate succeeds and does delete the sessions', async () => {
    const callerToken = await makeSession(pool, ownerId);
    const victimToken = await makeSession(pool, targetId);

    const res = await httpRequest(port, 'PATCH', `/api/admin/team/${targetId}/deactivate`, null, callerToken);
    assert.equal(res.status, 200, `deactivate should succeed; got ${res.status} ${JSON.stringify(res.body)}`);

    const { rows: sess } = await pool.query('SELECT 1 FROM sessions WHERE token = $1', [victimToken]);
    assert.equal(sess.length, 0, 'the victim session must be gone on the success path');
    const { rows: mem } = await pool.query('SELECT active FROM team_members WHERE id = $1', [targetId]);
    assert.equal(mem[0].active, false, 'the member must be deactivated on the success path');

    // restore for the next test
    await pool.query('UPDATE team_members SET active = true WHERE id = $1', [targetId]);
  });

  // ── THE DEFECT ─────────────────────────────────────────────────────────────
  it('[RED] if the active=false UPDATE fails, the session DELETE is rolled back', async () => {
    const callerToken = await makeSession(pool, ownerId2);
    const victimToken = await makeSession(pool, targetId);

    // FORCE THE UPDATE TO FAIL. A rollback test that never triggers a rollback
    // proves nothing, so the failure is manufactured rather than hoped for. The
    // trigger is scoped to this one member id so no other suite can be affected,
    // and dropped in finally.
    await pool.query(`
      CREATE OR REPLACE FUNCTION _tx_block_deactivate() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'test-forced UPDATE failure';
      END; $$ LANGUAGE plpgsql
    `);
    await pool.query(`
      CREATE TRIGGER _tx_block_deactivate_trg
        BEFORE UPDATE ON team_members
        FOR EACH ROW WHEN (NEW.id = ${targetId} AND NEW.active = false)
        EXECUTE FUNCTION _tx_block_deactivate()
    `);

    try {
      // Prove the probe injected: the UPDATE must actually be impossible now.
      let blocked = false;
      try { await pool.query('UPDATE team_members SET active = false WHERE id = $1', [targetId]); }
      catch { blocked = true; }
      assert.ok(blocked, 'the forced-failure trigger did not fire — this control never injected, ' +
        'and a probe that fails to inject looks identical to a clean run');

      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${targetId}/deactivate`, null, callerToken);
      assert.equal(res.status, 500, `the forced UPDATE failure should surface as 500; got ${res.status}`);

      const { rows: sess } = await pool.query('SELECT 1 FROM sessions WHERE token = $1', [victimToken]);
      assert.equal(
        sess.length, 1,
        'The session DELETE was NOT rolled back when the UPDATE failed. ' +
        'The deactivate handler in server/routes/admin/team.js ran two bare pool.query calls with no ' +
        'transaction, so the sessions are already gone while the member is still ' +
        'active=true — the caller sees a 500 and the member simply logs back in. ' +
        'Both halves must commit or neither does.'
      );
      const { rows: mem } = await pool.query('SELECT active FROM team_members WHERE id = $1', [targetId]);
      assert.equal(mem[0].active, true, 'the member must still be active after a failed deactivate');
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS _tx_block_deactivate_trg ON team_members');
      await pool.query('DROP FUNCTION IF EXISTS _tx_block_deactivate()');
    }
  });
});
