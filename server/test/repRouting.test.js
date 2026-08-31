'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 5 — is_field_rep ON THE TWO AUTH PAYLOADS
//
// Governing spec: CDL_3b_BUILD_SPEC.md §7, plus the Phase 5 routing rulings.
//
// WHY A SERVER TEST EXISTS IN A PHASE LABELLED "UI + ROUTING". Phase 5 routes by
// IDENTITY rather than by URL, and the identity fact that decides between the
// admin panel and the field-rep surface — `is_field_rep` — was not on the wire.
// `POST /api/login`'s team branch returned { success, token, role, tier,
// permissions }; `GET /api/session`'s team branch returned { role, contractorId,
// tier, permissions }. Neither carried it, and `useAdminPermissions.js` fetched
// it from /api/admin/me and then dropped it before it reached React (a gap
// CDL_3a §8 parked explicitly: "wire this when the rep app needs it").
//
// ⚠ THE PROPERTY THIS FILE EXISTS FOR IS AGREEMENT, NOT PRESENCE.
//
// Routing happens at two different moments, from two different endpoints:
//
//     fresh login   → POST /api/login   → decides the surface
//     boot refresh  → GET  /api/session → decides the surface again
//
// If those two ever disagreed about `is_field_rep` for the SAME member, the
// symptom would not be an error. It would be a person landing on one surface
// when they log in and a different surface when they refresh the page — and
// nothing anywhere would fail. That is the whole reason the routing ruling chose
// to put the flag on both payloads rather than deriving it from /api/admin/me on
// one path only: two sources eventually drift, and this drift is invisible.
//
// So every assertion below is a COMPARISON BETWEEN THE TWO RESPONSES for one
// seeded member, not a check that each is individually true.
//
// ── SCOPE IS PINNED DELIBERATELY ────────────────────────────────────────────
// `is_field_rep` ONLY. `is_attributable` and `rep_revenue_visibility` belong to
// 3c's CD-7 revenue gate and are asserted ABSENT here — shipping fields nothing
// reads is how a payload silently becomes an API surface. That assertion is not
// pedantry: both columns already exist on team_members and both are already
// selected by GET /api/admin/me, so widening these two payloads is a one-word
// edit that nothing else would catch.
//
// ── ⚠ C/DL-3c PHASE 2a BUILT THE CONSUMER AND DID NOT WIDEN THIS. READ WHY ──
//
// The pin was written so that widening would be a DELIBERATE ACT rather than a
// one-word edit. Phase 2a is the session that finally had a reason to widen —
// the rep surface needed rep_revenue_visibility for CD-7's gate — and the
// deliberate act it produced was to LEAVE THIS ALONE.
//
// ⚠ THE TWO PAYLOADS ARE NOT THE ONLY WAY TO THE CLIENT, AND THEY ARE THE WRONG
// ONE. `GET /api/admin/me` has selected and returned all three rep flags since
// C/DL-3a. It is session-only and deliberately ungated (it is on
// server/test/adminRouteCoverage.test.js's PUBLIC_ADMIN_ROUTES allowlist,
// because a permission gate on a self-read would lock out newly-created
// accounts), so a general-tier field rep holding an EMPTY permissions JSONB
// already gets a 200 from it. Phase 2a widened the CLIENT HOOK that reads that
// endpoint — src/hooks/useAdminPermissions.js — and touched no server code at
// all. Nothing needs these flags at boot: is_field_rep is already here for
// routing, and rep_revenue_visibility is not read until a revenue-bearing
// screen renders, which is long after /api/admin/me has resolved.
//
// ⚠ SO WIDENING WOULD HAVE COST A WORKING FENCE AND BOUGHT NOTHING. That is the
// whole record. Do not read "3c needed the flags" as "3c should have widened
// this" — it needed them somewhere else, and they were already there.
//
// ⚠ AND IF A LATER PHASE DOES HAVE A REASON, THE REPAIR IS NOT TO INVERT THE
// VALUE IN PLACE. This is a negative assertion, and when the correct answer
// becomes "present" its purpose REVERSES rather than going stale — it stays
// true, stays green, and becomes the thing standing between the codebase and
// the change. Delete it with the reason recorded, and replace it with what the
// payload DOES say: agreement between the two responses (this file's actual
// subject), `false` present rather than omitted, and — the stronger fence —
// that a GATED ROUTE re-reads the flag from team_members rather than trusting
// the token, which is what server/middleware/auth.js's "never for
// authorisation" rule actually protects.
//
// NO DATABASE SCHEMA CHANGE. is_field_rep is an existing column (C/DL-3a).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const bcrypt = require('bcrypt');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');

const TENANT = 'tnt-reprouting-a';
const PASSWORD = 'rep-routing-password-1';

// Rotating source IP — referrerLoginLimiter is 10 per 15 min per IP.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.93.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpJson(port, { method, path, body = null, token = null }) {
  const payload = body ? Buffer.from(JSON.stringify(body)) : null;
  const headers = { 'X-Forwarded-For': nextIp() };
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = payload.length;
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = _httpRequest({ hostname: 'localhost', port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let pool, server, port;

async function seedTeamMember({ email, tier = 'general', isFieldRep = false }) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions, active, is_field_rep)
     VALUES ($1, $2, $3, $4, '{}', true, $5) RETURNING id`,
    [TENANT, email, hash, tier, isFieldRep]
  );
  return rows[0].id;
}

// Logs the member in and immediately rehydrates with the token it was handed,
// returning both payloads. Every test below is a comparison of these two.
async function loginThenRehydrate(email) {
  const login = await httpJson(port, {
    method: 'POST', path: '/api/login', body: { email, password: PASSWORD },
  });
  assert.equal(login.status, 200, `login should succeed: ${login.raw}`);
  const session = await httpJson(port, {
    method: 'GET', path: '/api/session', token: login.body.token,
  });
  assert.equal(session.status, 200, `rehydration should succeed: ${session.raw}`);
  return { login: login.body, session: session.body };
}

describe('C/DL-3b Phase 5 — is_field_rep travels on both auth payloads, and they agree', () => {
  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
    await seedContractor(pool, TENANT);
  });

  after(async () => {
    await stopTestServer(server);
  });

  it('[RED] a FIELD REP: login and rehydration both report is_field_rep true, and agree', async () => {
    await seedTeamMember({ email: 'rep@reprouting.test', tier: 'general', isFieldRep: true });
    const { login, session } = await loginThenRehydrate('rep@reprouting.test');

    // ⚠ THE AGREEMENT ASSERTION COMES FIRST, DELIBERATELY, AND THE ORDER IS LOAD-
    // BEARING RATHER THAN STYLISTIC. Placed after the two value checks it is
    // SHADOWED: any divergence also fails one of them, so it could be deleted
    // entirely and every test here would still pass. Asserting it first is what
    // makes it the assertion that actually fires, and what lets a guard-proof
    // injection demonstrate this line rather than the one above it.
    //
    // It is a comparison rather than a third check against `true` because the
    // disagreement IS the defect: a later change that made both payloads wrong in
    // the SAME direction would keep routing self-consistent, and a person would
    // still land where they landed a moment ago.
    assert.equal(login.is_field_rep, session.is_field_rep,
      'PAYLOAD DISAGREEMENT: fresh login and boot rehydration report different is_field_rep for ' +
      'the same member. The symptom is a person landing on one surface when they sign in and a ' +
      'different one when they refresh, with nothing failing anywhere.');

    assert.equal(login.is_field_rep, true,
      'POST /api/login must report is_field_rep so a fresh login can route to the rep surface');
    assert.equal(session.is_field_rep, true,
      'GET /api/session must report is_field_rep so a page refresh routes to the same surface');
  });

  it('[RED] a NON-REP team member: login and rehydration both report false, and agree', async () => {
    await seedTeamMember({ email: 'office@reprouting.test', tier: 'general', isFieldRep: false });
    const { login, session } = await loginThenRehydrate('office@reprouting.test');

    // FALSE MUST BE PRESENT, NOT ABSENT. `undefined` and `false` route the same
    // way today, so a payload that simply omitted the key would pass a truthiness
    // check — and then quietly break the moment routing needs to tell "not a rep"
    // apart from "this build does not report rep-ness".
    assert.equal(login.is_field_rep, false, 'login must report false explicitly, not omit the key');
    assert.equal(session.is_field_rep, false, 'rehydration must report false explicitly, not omit the key');
    assert.equal(login.is_field_rep, session.is_field_rep, 'PAYLOAD DISAGREEMENT on a non-rep member');
  });

  it('[RED] an OWNER who is also a field rep still reports the flag honestly on both payloads', async () => {
    // The routing ruling sends this person to the ADMIN PANEL — but that is the
    // CLIENT's decision, made from tier plus the flag. The server's job is to
    // report both accurately and decide nothing. Pinned here so a later
    // "simplification" cannot move the rule onto the server by suppressing the
    // flag for privileged tiers, which would silently make the 3c surface
    // switcher unbuildable.
    await seedTeamMember({ email: 'ownerrep@reprouting.test', tier: 'owner', isFieldRep: true });
    const { login, session } = await loginThenRehydrate('ownerrep@reprouting.test');

    assert.equal(login.is_field_rep, true, 'the server must not suppress the flag for an owner');
    assert.equal(session.is_field_rep, true, 'the server must not suppress the flag for an owner');
    assert.equal(login.tier, 'owner');
    assert.equal(session.tier, 'owner');
    assert.equal(login.is_field_rep, session.is_field_rep, 'PAYLOAD DISAGREEMENT on an owner-rep');
  });

  it('[RED] neither payload leaks is_attributable or rep_revenue_visibility (scope pin)', async () => {
    // Both columns exist on team_members and GET /api/admin/me already returns
    // them, so widening these payloads is a one-word edit. They belong to 3c's
    // CD-7 revenue gate; until something reads them, shipping them is API surface
    // acquired by accident.
    await seedTeamMember({ email: 'scope@reprouting.test', tier: 'general', isFieldRep: true });
    const { login, session } = await loginThenRehydrate('scope@reprouting.test');

    for (const [label, payload] of [['POST /api/login', login], ['GET /api/session', session]]) {
      for (const leaked of ['is_attributable', 'rep_revenue_visibility']) {
        assert.equal(
          Object.hasOwn(payload, leaked), false,
          `${label} now carries '${leaked}'. Phase 5's ruling scoped this change to is_field_rep ONLY — ` +
          'the other two rep flags belong to 3c, and a payload nothing reads is API surface acquired by accident.'
        );
      }
    }
  });

  it('[RED] a referrer login is untouched — no rep flag on a surface that has no reps', async () => {
    // is_field_rep is a team_members concept. A users row has no such column, and
    // inventing a `false` for it on the referrer payload would imply the question
    // is meaningful there.
    const hash = await bcrypt.hash(PASSWORD, 10);
    await pool.query(
      `INSERT INTO users (contractor_id, email, full_name, pin) VALUES ($1, $2, $3, $4)`,
      [TENANT, 'homeowner@reprouting.test', 'Homeowner Person', hash]
    );

    const login = await httpJson(port, {
      method: 'POST', path: '/api/login', body: { email: 'homeowner@reprouting.test', password: PASSWORD },
    });
    assert.equal(login.status, 200, `referrer login should succeed: ${login.raw}`);
    assert.equal(login.body.role, 'referrer');
    assert.equal(Object.hasOwn(login.body, 'is_field_rep'), false,
      'the referrer payload must not carry a team_members flag');

    const session = await httpJson(port, {
      method: 'GET', path: '/api/session', token: login.body.token,
    });
    assert.equal(session.body.role, 'referrer');
    assert.equal(Object.hasOwn(session.body, 'is_field_rep'), false,
      'the referrer session descriptor must not carry a team_members flag');
  });
});
