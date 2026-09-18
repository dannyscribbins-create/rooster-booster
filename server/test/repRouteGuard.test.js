'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CANVASS-3 — RED SUITE — THE /api/rep/* PREFIX AND ITS IDENTITY GUARD
//
// WHAT THIS PINS, AND WHAT IT DELIBERATELY DOES NOT. Canvass-3 ships the
// BOUNDARY, not a screen: one route, `GET /api/rep/me`, so the guards have a
// real subject and Canvass-4's first client-data route lands INSIDE a fence
// rather than outside one. There is no client data here, so there is nothing
// here about A34.8's cross-rep 404 — that is Canvass-4's, on a route that does
// not exist yet, and asserting it now would be asserting against nothing.
//
// ── ⚠ THE GUARD IS TWO QUESTIONS, AND ONLY THE SECOND IS NEW ────────────────
//   1. IS THIS A LIVE TEAM SESSION ON THIS TENANT?  verifyAdminSession.
//   2. IS THAT MEMBER AN ACTIVE FIELD REP?          isActiveFieldRep.
// Question 1 is answered by machinery that predates this phase and is already
// fenced by sessionAuthInvariant. Question 2 is what makes the surface rep-only,
// and an owner, an admin and office staff are ALL indistinguishable to question
// 1 alone. Every case below says which question refused it.
//
// ── ⚠ THE FROZEN-REP CASE IS 401, NOT 403, AND GETTING THAT WRONG WOULD HAVE
//    BEEN A TEST THAT PASSED WHILE ASSERTING SOMETHING FALSE.
// The obvious expectation is "a deactivated rep is 403'd by the rep guard".
// It is not. `verifyAdminSession` carries
//     AND (s.team_member_id IS NULL OR tm.active = true)
// so a frozen member's session fails THERE, and the response is the verifier's
// own 401. `isActiveFieldRep` also carries `active = true`, but on this route it
// never gets the chance — it is defence in depth for a caller whose verifier
// does NOT check active (`verifyAnySession`, which the theme writer uses) and
// for a member deactivated between the verify and the read.
// **CLAUDE.md: a negative test must assert WHY the request was refused, not only
// THAT it was.** Both refusal codes are pinned below, distinctly, and the pair
// is what proves the two mechanisms are different mechanisms.
//
// ── ⚠ NEGATIVES ASSERT THE HANDLER'S TYPED BODY, NEVER EXPRESS'S OWN 404 ────
// The C/DL-3c Phase 2c lesson. A test satisfied by the framework's default HTML
// page is asserting that a route does not exist, which is true of every path in
// the world and stays true after someone deletes the route. Every negative here
// reads `{ error: ... }` off a JSON body.
//
// ── ⚠ EVERY NEGATIVE IS PAIRED WITH A POSITIVE ON THE SAME FIXTURE ──────────
// A guard that refuses EVERYONE passes every negative in this file and is a
// broken surface that looks like a secure one. The active field rep's 200 is
// what separates "the gate works" from "the gate is welded shut".
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor, seedUser, seedSession } = require('./helpers');
const { isActiveFieldRep } = require('../utils/repAccess');

const TENANT_A = 'rep-guard-tenant-a';
const TENANT_B = 'rep-guard-tenant-b';

let pool;
let server;
let port;
const base = () => `http://localhost:${port}`;

// ── FIXTURES ────────────────────────────────────────────────────────────────

async function seedTeamMember(p, { contractorId, email, tier = 'general', isFieldRep = true, active = true }) {
  const { rows } = await p.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions, is_field_rep, active)
     VALUES ($1, $2, 'x', $3, '{}'::jsonb, $4, $5)
     ON CONFLICT (email) DO UPDATE SET tier = EXCLUDED.tier,
                                       is_field_rep = EXCLUDED.is_field_rep,
                                       contractor_id = EXCLUDED.contractor_id,
                                       active = EXCLUDED.active
     RETURNING id`,
    [contractorId, email, tier, isFieldRep, active]
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
  return token;
}

const getMe = (token) => fetch(`${base()}/api/rep/me`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

// Reads status AND the parsed JSON body together, so no assertion can settle for
// a bare status code. ⚠ IT ASSERTS THE RESPONSE IS JSON AT ALL — that is what
// separates the handler's typed refusal from Express's default HTML 404.
async function readJson(res) {
  const ct = res.headers.get('content-type') || '';
  assert.ok(
    ct.includes('application/json'),
    `expected a JSON body from the handler, got content-type '${ct}' with status ${res.status}. ` +
      `An HTML body means Express answered, not the route — which is what a negative test ` +
      `accidentally asserting "this path does not exist" looks like.`
  );
  return { status: res.status, body: await res.json() };
}

describe('Canvass-3 — GET /api/rep/me and the active-field-rep guard', () => {
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
    // NOT cleared — each fixture uses its own email and other tables reference
    // them. Same ordering as themeModeWriter.test.js, for the same reason.
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM users');
  });

  // ── THE POSITIVE, FIRST. It runs before every negative below because a
  //    predicate that rejects everything satisfies all of them. ────────────────
  it('[RED] an ACTIVE GENERAL-TIER FIELD REP gets 200 and their own verified identity', async () => {
    const memberId = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'rep-pos@x.test' });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: memberId });

    const { status, body } = await readJson(await getMe(token));
    assert.equal(status, 200);
    // ⚠ THE IDENTITY MUST COME FROM THE SESSION, NOT BE ECHOED FROM THE REQUEST.
    // These values were never sent by the client; if they match, they came from
    // the verified session and the guard's own read.
    assert.equal(body.teamMemberId, memberId);
    assert.equal(body.contractorId, TENANT_A);
    assert.equal(body.isFieldRep, true);
  });

  // ── THE IDENTITY HALF (question 2) — 403 FROM THE GUARD ───────────────────
  it('[RED] a general-tier team member WITHOUT the field-rep flag is 403 — the guard, not the verifier', async () => {
    // ⚠ THE PAIR THAT SEPARATES THE FLAG FROM THE ROLE. This member has the same
    // tier and the same session shape as the passing case above; the ONLY
    // difference is is_field_rep. A test that varied tier as well could not tell
    // which predicate refused it.
    const memberId = await seedTeamMember(pool, {
      contractorId: TENANT_A, email: 'office-staff@x.test', tier: 'general', isFieldRep: false,
    });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: memberId });

    const { status, body } = await readJson(await getMe(token));
    assert.equal(status, 403, 'office staff reached the rep surface');
    assert.equal(body.error, 'Not authorized');
    // WHY, not merely THAT: a 403 here must be the guard's, and the verifier
    // answers 401. Pinning the code distinguishes the two mechanisms.
  });

  // ── THE SESSION HALF (question 1) — 401 FROM THE VERIFIER ─────────────────
  it('[RED] a FROZEN field rep is 401 from verifyAdminSession, NOT 403 from the guard', async () => {
    // ⚠ THIS IS THE CASE THE OBVIOUS EXPECTATION GETS WRONG, and it is asserted
    // in the direction that is actually true rather than the one that sounds
    // right. verifyAdminSession's own `tm.active = true` disjunct refuses the
    // session before isActiveFieldRep is ever called.
    const memberId = await seedTeamMember(pool, {
      contractorId: TENANT_A, email: 'frozen-rep@x.test', isFieldRep: true, active: false,
    });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: memberId });

    const { status, body } = await readJson(await getMe(token));
    assert.equal(status, 401, 'a frozen rep was not refused at the session layer');
    assert.match(body.error, /Session expired/);

    // POSITIVE CONTROL ON THE SAME MEMBER: reactivate and the identical token
    // now works. Without this, "frozen is refused" is satisfiable by a token
    // that was never valid — and the refusal would look identical.
    await pool.query('UPDATE team_members SET active = true WHERE id = $1', [memberId]);
    const after = await readJson(await getMe(token));
    assert.equal(after.status, 200, 'the same token still failed after reactivation — the 401 above was not about `active`');
    assert.equal(after.body.teamMemberId, memberId);
  });

  it('[RED] a REFERRER session is refused — the rep surface is not on the referrer key', async () => {
    const token = await seedReferrerSession(pool, { contractorId: TENANT_A, email: 'homeowner@x.test' });

    const { status, body } = await readJson(await getMe(token));
    // 401 and not 403: verifyAdminSession filters `s.role = 'admin'`, so a
    // referrer token matches no row at all and never reaches the guard.
    assert.equal(status, 401);
    assert.ok(body.error, 'no typed error body on the referrer refusal');
  });

  it('[RED] no token at all is refused with a typed body', async () => {
    const { status, body } = await readJson(await getMe(null));
    assert.equal(status, 401);
    assert.equal(body.error, 'Not authorized');
  });

  // ── TIER IS NOT THE PREDICATE (A25 + A34.3(d)) ────────────────────────────
  it('[RED] an OWNER who is also a field rep is ALLOWED — the surface is reached by the switcher', async () => {
    // ⚠ THE CASE A `tier = 'general'` PREDICATE WOULD BREAK, AND IT WOULD BREAK
    // SILENTLY: `surfaceFor()` routes owner-reps and admin-reps to the ADMIN
    // panel by default, so they arrive here only through the surface switcher —
    // a path no routing test exercises. A25 rules them switcher-eligible, and
    // A34.3(d) requires the guard not to assume general tier.
    const ownerId = await seedTeamMember(pool, {
      contractorId: TENANT_A, email: 'owner-rep@x.test', tier: 'owner', isFieldRep: true,
    });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: ownerId });

    const { status, body } = await readJson(await getMe(token));
    assert.equal(status, 200, 'an owner-rep was refused — the guard has assumed general tier');
    assert.equal(body.teamMemberId, ownerId);
  });

  it('[RED] an ADMIN who is also a field rep is ALLOWED', async () => {
    const adminId = await seedTeamMember(pool, {
      contractorId: TENANT_A, email: 'admin-rep@x.test', tier: 'admin', isFieldRep: true,
    });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: adminId });

    const { status } = await readJson(await getMe(token));
    assert.equal(status, 200, 'an admin-rep was refused — the guard has assumed general tier');
  });

  it('[RED] an OWNER who is NOT a field rep is 403 — tier does not substitute for the flag', async () => {
    // The mirror of the case above, and the one that proves the owner case
    // passed on its FLAG rather than on its tier. Without this pair, "owners are
    // allowed" and "field reps are allowed" are indistinguishable.
    const ownerId = await seedTeamMember(pool, {
      contractorId: TENANT_A, email: 'owner-only@x.test', tier: 'owner', isFieldRep: false,
    });
    const token = await seedTeamSession(pool, { contractorId: TENANT_A, teamMemberId: ownerId });

    const { status, body } = await readJson(await getMe(token));
    assert.equal(status, 403, 'an owner with no rep flag reached the rep surface on tier alone');
    assert.equal(body.error, 'Not authorized');
  });

  // ── COVERAGE: EVERY REP ROUTE CARRIES THE IDENTITY GUARD ──────────────────
  //
  // ⚠ THIS IS THE HALF sessionAuthInvariant CANNOT SEE, AND WITHOUT IT THE REP
  // PREFIX IS ONLY HALF-FENCED. Assertion A proves every /api/rep/* route calls
  // a verify*Session. A route that called verifyAdminSession and then simply
  // FORGOT isActiveFieldRep would satisfy it completely — and would serve rep
  // data to an owner, an admin and office staff, because question 1 cannot tell
  // them apart. That is a real hole, one line of forgetting wide, and the guard
  // that catches it has to be written on purpose.
  //
  // It is the rep-prefix analogue of adminRouteCoverage's requirePermission
  // sweep. ⚠ IT DELIBERATELY DOES NOT LIVE IN adminRouteCoverage: that file's
  // subject is the PERMISSION model, and rep routes carry no permission flag by
  // ruling. Asserting a different property in a file named for the other one is
  // how a guard's purpose quietly widens until nobody knows what it covers.
  //
  // ⚠ SAME SOURCE-TEXT LIMITS AS ASSERTION A, STATED RATHER THAN DISCOVERED: it
  // sees the handler as WRITTEN, not as executed, so a call behind `if (false)`
  // would satisfy it, and a route delegating to a wrapper would read as a
  // violation. Both are narrower than the hole it closes — a guard that is not
  // there at all.
  describe('rep-prefix coverage — the identity guard, not merely a session', () => {
    const { collectRoutes } = require('./helpers/adminRouterIntrospection');
    const { stripComments } = require('./helpers/sourceScan');
    const REP_GUARD_RE = /\bisActiveFieldRep\s*\(/;

    const repRoutes = () => collectRoutes(createApp()._router.stack, '/api/rep/');

    const unguarded = (routes) => routes.filter((route) => !route.middlewareStack.some((layer) => {
      const h = layer && layer.handle;
      return typeof h === 'function' && REP_GUARD_RE.test(stripComments(h.toString()));
    })).map((r) => `${r.method} ${r.path}`);

    it('[RED] the walk is non-empty — otherwise everything below passes vacuously', () => {
      // The same floor sessionAuthInvariant carries, repeated here because THIS
      // file's assertions are also prefix-scoped and would also pass on an empty
      // array. A floor is not shared between files by being written once.
      assert.ok(
        repRoutes().length > 0,
        `collectRoutes() found no /api/rep/* routes. Either repRoutes moved off its '/' mount ` +
          `— collectRoutes matches a MOUNT-RELATIVE path — or the walk is broken. The coverage ` +
          `assertion below would pass over nothing.`
      );
    });

    it('[RED] every /api/rep/* route calls isActiveFieldRep', () => {
      assert.deepEqual(
        unguarded(repRoutes()),
        [],
        `The following /api/rep/* routes verify a SESSION but never check the IDENTITY.\n` +
          `verifyAdminSession proves "a live team session on this tenant" and nothing more — an ` +
          `owner, an admin and office staff all pass it. Without isActiveFieldRep these routes ` +
          `serve rep data to every team member of the contractor.\n` +
          `⚠ sessionAuthInvariant's assertion A WILL STILL BE GREEN for these routes. That is ` +
          `why this assertion exists separately; do not read a green session guard as coverage.\n\n` +
          unguarded(repRoutes()).map((v) => `  • ${v}`).join('\n')
      );
    });

    it('control: a rep route that verifies a session but SKIPS the guard IS reported', () => {
      // ⚠ WITHOUT THIS THE ASSERTION ABOVE IS "an empty list is empty". The probe
      // is deliberately shaped like the realistic mistake: a correct session call
      // and no identity check — which is exactly what would pass assertion A.
      const express = require('express');
      const app = express();
      const router = express.Router();
      const verifyAdminSession = async () => ({ contractorId: 'p', teamMemberId: 1 });
      const isActiveFieldRep = async () => true;

      router.get('/api/rep/__probe_session_only', async (req, res) => {
        const s = await verifyAdminSession(req, res);
        if (!s) return;
        res.json({ ok: true });
      });
      router.get('/api/rep/__probe_guarded', async (req, res) => {
        const s = await verifyAdminSession(req, res);
        if (!s) return;
        if (!await isActiveFieldRep({ teamMemberId: s.teamMemberId, contractorId: s.contractorId })) {
          return res.status(403).json({ error: 'Not authorized' });
        }
        res.json({ ok: true });
      });
      // ⚠ A GUARD NAMED ONLY IN A COMMENT IS NOT A GUARD. stripComments() is what
      // makes this a violation, and this probe is why that matters here too.
      router.get('/api/rep/__probe_comment_only', async (req, res) => {
        const s = await verifyAdminSession(req, res);
        if (!s) return;
        // isActiveFieldRep(...) would go here
        res.json({ ok: true });
      });
      app.use('/', router);

      const found = unguarded(collectRoutes(app._router.stack, '/api/rep/')).sort();
      assert.deepEqual(
        found,
        ['GET /api/rep/__probe_comment_only', 'GET /api/rep/__probe_session_only'],
        `the coverage sweep did not report the deliberate violations — it is not firing. Got: ${JSON.stringify(found)}`
      );
      // AND IT DOES NOT OVER-FIRE: the properly guarded probe must be absent.
      assert.ok(
        !found.includes('GET /api/rep/__probe_guarded'),
        'the sweep reported a route that DOES call the guard — it is over-firing, which a ' +
          'violations-only assertion could never reveal.'
      );
    });
  });

  // ── THE PREDICATE ITSELF, DIRECTLY ────────────────────────────────────────
  //
  // ⚠ THE ROUTE CASES ABOVE CANNOT SEE THE TENANCY PREDICATE AT ALL, AND THAT IS
  // WHY THESE EXIST. `verifyAdminSession` returns the session's OWN
  // contractor_id, so the route can never hand isActiveFieldRep a mismatched
  // pair — the cross-tenant argument is unreachable through HTTP today. That
  // makes the predicate's `contractor_id = $2` clause exactly the kind of
  // defence-in-depth nobody has ever watched execute, which CLAUDE.md calls a
  // claim rather than a guard.
  describe('isActiveFieldRep — the predicate, exercised where the route cannot reach', () => {
    it('[RED] true for an active field rep on the matching tenant', async () => {
      const id = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'pred-yes@x.test' });
      assert.equal(await isActiveFieldRep({ teamMemberId: id, contractorId: TENANT_A }), true);
    });

    it('[RED] FALSE for the same member under a DIFFERENT tenant — the tenancy clause fires', async () => {
      const id = await seedTeamMember(pool, { contractorId: TENANT_A, email: 'pred-tenant@x.test' });
      // Same id, same active flag, same rep flag — only the tenant differs. If
      // the predicate ever loses its contractor_id clause this is the only
      // assertion in the repo that notices.
      assert.equal(await isActiveFieldRep({ teamMemberId: id, contractorId: TENANT_B }), false);
      // PAIRED POSITIVE on the same row, so a `false` from a broken query cannot
      // pass as tenancy working.
      assert.equal(await isActiveFieldRep({ teamMemberId: id, contractorId: TENANT_A }), true);
    });

    it('[RED] false for an INACTIVE field rep — the half verifyAdminSession usually answers first', async () => {
      const id = await seedTeamMember(pool, {
        contractorId: TENANT_A, email: 'pred-frozen@x.test', isFieldRep: true, active: false,
      });
      assert.equal(await isActiveFieldRep({ teamMemberId: id, contractorId: TENANT_A }), false);
      await pool.query('UPDATE team_members SET active = true WHERE id = $1', [id]);
      assert.equal(await isActiveFieldRep({ teamMemberId: id, contractorId: TENANT_A }), true);
    });

    it('[RED] false for a non-rep, and false for ids that cannot exist', async () => {
      const id = await seedTeamMember(pool, {
        contractorId: TENANT_A, email: 'pred-nonrep@x.test', isFieldRep: false,
      });
      assert.equal(await isActiveFieldRep({ teamMemberId: id, contractorId: TENANT_A }), false);
      // ⚠ A MISSING ID MUST NOT REACH THE DATABASE AS `WHERE id = NULL`, which
      // matches nothing and returns the right answer for the wrong reason. These
      // pin the early return rather than the query's accidental behaviour.
      assert.equal(await isActiveFieldRep({ teamMemberId: null, contractorId: TENANT_A }), false);
      assert.equal(await isActiveFieldRep({ teamMemberId: undefined, contractorId: TENANT_A }), false);
      assert.equal(await isActiveFieldRep({ teamMemberId: id, contractorId: null }), false);
      assert.equal(await isActiveFieldRep({ teamMemberId: 999999999, contractorId: TENANT_A }), false);
    });
  });
});
