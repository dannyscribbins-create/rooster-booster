'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c — PHASE 2c — RULING B (the frozen rep is told, once) AND DECISION
// E-min (the reactivation path)
//
// ⚠ ONE FILE, BECAUSE THE TWO ARE ONE MECHANISM. Ruling B's "once" flag is
// written by the LOGIN handler and cleared by the REACTIVATION transaction. A
// flag that is written and never cleared makes a SECOND freeze silent, which is
// the exact defect Ruling B exists to fix — so "reactivation clears the key" is
// not an E-min detail that happens to touch Ruling B, it is the half of Ruling B
// that cannot live in the login handler. Splitting them across two files would
// let each half be green while the pair was broken.
//
// ── PART 1, THE MECHANISM RULING B ANSWERS ──────────────────────────────────
// `gatherLoginCandidates` deliberately does not filter on `active` (D3), so a
// deactivated team member IS gathered and IS compared. After the compare the
// handler partitions into `live` and `frozen`. A deactivated field rep who ALSO
// holds a homeowner account has exactly ONE live candidate — the `users` row,
// which carries a hardcoded honest `active: true` because a homeowner cannot be
// frozen — so the single-match branch mints a session and the 403
// FrozenAccountScreen branch is STRUCTURALLY UNREACHABLE for them: that branch
// requires `live.length === 0`. They are placed in the referrer app and never
// told their team access was revoked.
//
// ── PART 2, THE MECHANISM E-min ANSWERS ─────────────────────────────────────
// Before this phase, no route anywhere set `team_members.active = true`. The
// only post-creation write to that column was `SET active = false` inside the
// deactivate handler, and `PATCH /api/admin/team/:id` builds its UPDATE from a
// four-field allowlist `active` cannot reach. An Owner who deactivated the wrong
// person could not undo it without a direct database edit.
//
// ── EVERY NEGATIVE CASE HAS ITS POSITIVE SIBLING ON THE SAME FIXTURE ────────
// CLAUDE.md's vacuity shape #10 and the C/DL-3c Phase 2a GP2/GP5 measurement:
// a negative assertion ("the notice is absent", "the request is refused") passes
// identically against completely unwired code. Each one below is paired with a
// sibling on the same fixture that must produce the OPPOSITE result, so the pair
// can only be green if the handler is actually reading the thing under test.
//
//   B1 frozen team row + homeowner row → session AND notice
//   B2 homeowner row ALONE             → session and NO notice      (sibling of B1)
//   B3 ACTIVE team row + homeowner row → choice, no notice          (sibling of B1)
//   D3 Admin reactivating an Admin     → 403                        (the wall)
//   D4 Owner reactivating that SAME row → 200                       (sibling of D3)
//
// ── THE SEEN-KEY NEEDS ALL FOUR STATES, AND THE FOURTH IS THE PROOF ────────
// first login shows it · second does not · reactivation clears it · a login
// after reactivate-then-refreeze shows it AGAIN. Without that last one,
// "cleared" and "never written" are indistinguishable — the same shape as a
// fixture that establishes a precondition's proxy rather than the precondition.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');

const LOGIN = '/api/login';

// Two tenants. The whole point of Ruling B's third requirement is that the
// employer whose team access was revoked and the contractor whose referrer app
// the person is about to enter CAN BE DIFFERENT COMPANIES — so the fixture makes
// them different, and the assertion names the employer.
const TENANT_EMPLOYER = 'tnt-2c-employer';
const TENANT_HOMEOWNER = 'tnt-2c-homeowner';
const EMPLOYER_NAME = 'Employer Roofing Co';
const HOMEOWNER_NAME = 'Homeowner Exteriors';

const PW = 'ruling-b-password-1';
const OTHER_PW = 'ruling-b-password-2';

// Written by the login handler, cleared by the reactivation transaction.
const SEEN_KEY = 'team_access_revoked_seen';

// Rotating source IP — referrerLoginLimiter is 10/15min per IP and this file
// makes far more login attempts than that allows.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.94.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpRequest(port, method, path, bodyObj, token) {
  const payload = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path, method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': nextIp(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': payload.length } : {}),
      },
    }, res => {
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

const login = (port, email, password) => httpRequest(port, 'POST', LOGIN, { email, password });

let pool, server, port;

async function seedTeamMember({ contractorId, email, password, active = true, tier = 'general', permissions = {} }) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions, active, is_field_rep)
     VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
    [contractorId, email, hash, tier, permissions, active]
  );
  return rows[0].id;
}

async function seedReferrer({ contractorId, email, password, fullName = 'Dana Homeowner' }) {
  const pinHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [fullName, email, pinHash, contractorId]
  );
  return rows[0].id;
}

async function makeAdminSession(memberId, contractorId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
     VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
    [token, contractorId, memberId]
  );
  return token;
}

// Reads the seen-key row DIRECTLY, and reads the SUBJECT COLUMN with it.
// userPreferences.js exists precisely so callers never see which id column a
// subject type maps to — which means a writer that picked the wrong column would
// be invisible to a read through the same util. So this reads the raw row.
async function readSeenRow(teamMemberId) {
  const { rows } = await pool.query(
    `SELECT user_id, team_member_id, contractor_id, pref_value
       FROM user_preferences WHERE team_member_id = $1 AND pref_key = $2`,
    [teamMemberId, SEEN_KEY]
  );
  return rows[0] || null;
}

async function isActive(memberId) {
  const { rows } = await pool.query('SELECT active FROM team_members WHERE id = $1', [memberId]);
  return rows[0].active;
}

async function countSessionsFor(memberId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM sessions WHERE team_member_id = $1',
    [memberId]
  );
  return rows[0].n;
}

describe('C/DL-3c Phase 2c — Ruling B (told once) and E-min (reactivation)', () => {
  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM login_choice_tokens').catch(() => {});
    await pool.query('DELETE FROM user_preferences');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM contractors WHERE id LIKE $1', ['tnt-2c-%']);
    await seedContractor(pool, TENANT_EMPLOYER);
    await seedContractor(pool, TENANT_HOMEOWNER);
    await pool.query(
      'UPDATE contractor_settings SET company_name = $2 WHERE contractor_id = $1',
      [TENANT_EMPLOYER, EMPLOYER_NAME]
    );
    await pool.query(
      'UPDATE contractor_settings SET company_name = $2 WHERE contractor_id = $1',
      [TENANT_HOMEOWNER, HOMEOWNER_NAME]
    );
  });

  // ══ GROUP B — RULING B: THE FOURTH OUTCOME ═════════════════════════════════

  describe('the fourth outcome — one live match, but something to say first', () => {
    const EMAIL = 'frozen.rep@2c.test';

    it('[RED] B1 — a frozen team member who also holds a homeowner account gets a SESSION and the notice', async () => {
      // Today: the session is issued and nothing is said. `live.length === 1`
      // takes the plain single-match branch and the 403 branch is unreachable.
      const memberId = await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: EMAIL, password: PW, active: false,
      });
      await seedReferrer({ contractorId: TENANT_HOMEOWNER, email: EMAIL, password: PW });

      const res = await login(port, EMAIL, PW);

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.ok(res.body.token, 'the session is already minted — the screen precedes the destination');
      assert.equal(res.body.role, 'referrer', 'the minted session is the HOMEOWNER identity');

      assert.ok(
        res.body.team_access_revoked,
        `expected a team_access_revoked notice on the response, got: ${res.raw}`
      );

      // ⚠ THE NAME COMES FROM THE FROZEN ROW, NOT THE SESSION. The session is a
      // referrer session at TENANT_HOMEOWNER; the revoked team access was at
      // TENANT_EMPLOYER. A naive read of the session names the wrong company.
      assert.equal(
        res.body.team_access_revoked.contractor_name,
        EMPLOYER_NAME,
        'the notice must name the FROZEN row\'s contractor, never the session\'s'
      );
      assert.notEqual(
        res.body.team_access_revoked.contractor_name,
        HOMEOWNER_NAME,
        'naming the session\'s contractor is the specific defect this assertion exists to catch'
      );

      // VISIBLE, NOT SELECTABLE (D2 stays rejected). Nothing in the notice may
      // be usable as a destination or a credential for the frozen identity.
      assert.equal(res.body.team_access_revoked.token, undefined);
      assert.equal(res.body.team_access_revoked.choice_token, undefined);
      assert.equal(res.body.team_access_revoked.selection, undefined);
      assert.equal(
        res.raw.includes(String(memberId)) && res.raw.includes('team_member'),
        false,
        'the notice must not expose the frozen row as something to act on'
      );
    });

    it('[RED] B2 — POSITIVE SIBLING: a homeowner with NO team row signs straight through, no notice', async () => {
      // ⚠ THIS IS THE ASSERTION THAT STOPS "SHOW IT TO EVERYONE" FROM PASSING B1.
      // A handler that attached the notice unconditionally satisfies B1 exactly.
      await seedReferrer({ contractorId: TENANT_HOMEOWNER, email: 'plain@2c.test', password: PW });

      const res = await login(port, 'plain@2c.test', PW);

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.ok(res.body.token, 'an ordinary referrer login still mints a session');
      assert.equal(
        res.body.team_access_revoked,
        undefined,
        'nothing was revoked — the response must carry no notice at all'
      );
    });

    it('[RED] B3 — POSITIVE SIBLING: the same pair with the team row ACTIVE is a CHOICE, and carries no notice', async () => {
      // The other half of the sibling pair: it is FROZEN-ness that triggers the
      // notice, not merely holding two identities. With both live this is D2's
      // choice screen and Ruling B must stay out of it entirely.
      await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'live.rep@2c.test', password: PW, active: true,
      });
      await seedReferrer({ contractorId: TENANT_HOMEOWNER, email: 'live.rep@2c.test', password: PW });

      const res = await login(port, 'live.rep@2c.test', PW);

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.choice_required, true, 'two live identities is D2\'s choice screen');
      assert.equal(res.body.team_access_revoked, undefined, 'nothing is frozen — no notice');
      assert.equal(res.body.token, undefined, 'the choice branch mints nothing');
    });

    it('[RED] B4 — a frozen team member with NO homeowner account still gets the 403, unchanged', async () => {
      // The regression fence on D3. Ruling B adds a fourth outcome; it must not
      // reroute the third. `live.length === 0` is still the frozen 403.
      await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'lonely.rep@2c.test', password: PW, active: false,
      });

      const res = await login(port, 'lonely.rep@2c.test', PW);

      assert.equal(res.status, 403, `expected the D3 403, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.error, 'account_frozen');
      assert.equal(res.body.token, undefined, 'a frozen credential alone must never receive a token');
    });

    it('[RED] B5 — a WRONG password learns nothing: no notice, no session, the generic 401', async () => {
      // The enumeration half, inherited from D3. The fourth outcome sits AFTER
      // the compare like every other branch, so an unproven credential cannot
      // discover that an address belongs to a deactivated employee.
      await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'probe@2c.test', password: PW, active: false,
      });
      await seedReferrer({ contractorId: TENANT_HOMEOWNER, email: 'probe@2c.test', password: PW });

      const res = await login(port, 'probe@2c.test', 'definitely-not-it');

      assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.raw}`);
      assert.equal(res.raw.includes('team_access_revoked'), false, 'an unproven credential must learn nothing');
      assert.equal(res.raw.includes(EMPLOYER_NAME), false, 'and must not learn the employer\'s name either');
    });
  });

  // ══ GROUP C — THE "ONCE" STORE, ALL FOUR STATES ════════════════════════════

  describe('the seen key — once offered, and reset by reactivation', () => {
    const EMAIL = 'twice.rep@2c.test';
    let memberId;

    beforeEach(async () => {
      memberId = await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: EMAIL, password: PW, active: false,
      });
      await seedReferrer({ contractorId: TENANT_HOMEOWNER, email: EMAIL, password: PW });
    });

    it('[RED] C1 — the FIRST login shows the notice and records it against the TEAM_MEMBER subject', async () => {
      const first = await login(port, EMAIL, PW);
      assert.ok(first.body.team_access_revoked, `first login must carry the notice: ${first.raw}`);

      const row = await readSeenRow(memberId);
      assert.ok(row, 'the first login must record the seen key');

      // ⚠ THE SUBJECT COLUMN IS THE ASSERTION, NOT MERELY THE ROW'S EXISTENCE.
      // user_preferences carries two nullable FK columns under an
      // exactly_one_subject CHECK. A write routed to user_id would satisfy "a row
      // exists" while keying the flag to the HOMEOWNER identity — which is a
      // different person's row in every case where the two tenants differ.
      assert.equal(row.team_member_id, memberId, 'keyed to the frozen team_members row');
      assert.equal(row.user_id, null, 'never the users row — that is the identity that was NOT revoked');
      assert.equal(
        row.contractor_id, TENANT_EMPLOYER,
        'tenanted to the employer, matching the subject row'
      );
    });

    it('[RED] C2 — the SECOND login does not show it', async () => {
      const first = await login(port, EMAIL, PW);
      assert.ok(first.body.team_access_revoked, 'precondition: the first login showed it');

      const second = await login(port, EMAIL, PW);
      assert.equal(second.status, 200, `expected 200, got ${second.status}: ${second.raw}`);
      assert.ok(second.body.token, 'the person still signs in — only the notice is suppressed');
      assert.equal(second.body.team_access_revoked, undefined, 'told ONCE');
    });

    it('[RED] C3 — reactivation clears the key', async () => {
      await login(port, EMAIL, PW);
      assert.ok(await readSeenRow(memberId), 'precondition: the key was written');

      const ownerId = await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'owner.c3@2c.test', password: OTHER_PW, tier: 'owner',
      });
      const token = await makeAdminSession(ownerId, TENANT_EMPLOYER);

      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${memberId}/reactivate`, null, token);
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);

      assert.equal(await isActive(memberId), true, 'reactivation sets active = true');
      assert.equal(await readSeenRow(memberId), null, 'and clears the seen key in the same transaction');
    });

    it('[RED] C4 — reactivate, refreeze, and the notice is shown AGAIN', async () => {
      // ⚠ THIS IS THE ASSERTION THAT PROVES THE RESET IS REAL. Without it,
      // "cleared" and "never written" are indistinguishable: C3 alone passes
      // against a reactivation route that clears a key nothing consults, and C1
      // alone passes against a login handler that writes a key nothing clears.
      await login(port, EMAIL, PW);
      assert.equal(
        (await login(port, EMAIL, PW)).body.team_access_revoked, undefined,
        'precondition: the second login is silent'
      );

      const ownerId = await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'owner.c4@2c.test', password: OTHER_PW, tier: 'owner',
      });
      const token = await makeAdminSession(ownerId, TENANT_EMPLOYER);
      await httpRequest(port, 'PATCH', `/api/admin/team/${memberId}/reactivate`, null, token);

      // Refreeze through the real deactivate route — not a hand-written UPDATE.
      // The two halves must meet at the same column through the same doors.
      const deac = await httpRequest(port, 'PATCH', `/api/admin/team/${memberId}/deactivate`, null, token);
      assert.equal(deac.status, 200, `refreeze failed: ${deac.raw}`);
      assert.equal(await isActive(memberId), false);

      const after = await login(port, EMAIL, PW);
      assert.ok(
        after.body.team_access_revoked,
        `a SECOND freeze must be announced too — a flag that never resets makes it silent: ${after.raw}`
      );
    });
  });

  // ══ GROUP D — E-min: THE REACTIVATION ROUTE ════════════════════════════════

  describe('PATCH /api/admin/team/:id/reactivate', () => {
    let ownerId, ownerToken, frozenGeneralId;

    beforeEach(async () => {
      ownerId = await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'owner.d@2c.test', password: PW, tier: 'owner',
      });
      ownerToken = await makeAdminSession(ownerId, TENANT_EMPLOYER);
      frozenGeneralId = await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'general.d@2c.test', password: PW,
        tier: 'general', active: false,
      });
    });

    it('[RED] D1 — an Owner reactivates a deactivated member', async () => {
      // Today: 404 from Express — no such route exists anywhere.
      assert.equal(await isActive(frozenGeneralId), false, 'precondition');

      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${frozenGeneralId}/reactivate`, null, ownerToken);

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(await isActive(frozenGeneralId), true);
    });

    it('[RED] D2 — sessions are NOT restored, and the route does not pretend otherwise', async () => {
      // Deactivation DELETEs the member's sessions. Reactivation cannot restore
      // them and must not try — the person signs in again.
      assert.equal(await countSessionsFor(frozenGeneralId), 0, 'precondition');

      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${frozenGeneralId}/reactivate`, null, ownerToken);

      // ⚠ THE POSITIVE CONTROL IS ORDERED FIRST AND IT IS NOT DECORATION. "No
      // session was created" is trivially true of a route that does not exist —
      // this assertion is what stops the absence of the feature from reading as
      // the presence of the property.
      assert.equal(res.status, 200, `the reactivation must have SUCCEEDED, got ${res.status}: ${res.raw}`);
      assert.equal(await isActive(frozenGeneralId), true, 'positive control: the flag really flipped');

      assert.equal(
        await countSessionsFor(frozenGeneralId), 0,
        'reactivation must mint nothing — a restored session would be a credential nobody asked for'
      );
    });

    it('[RED] D3 — a cross-tenant target is 404, never 403 — and it is the HANDLER\'s 404', async () => {
      // Same posture as its sibling: 403 would confirm the id exists.
      //
      // ⚠ ASSERTING THE STATUS ALONE PROVES NOTHING HERE, AND THIS IS THE
      // MEASURED CASE, NOT A HYPOTHETICAL. Before the route existed, Express
      // answered its own 404 ("Cannot PATCH …", an HTML body) and a bare
      // `status === 404` assertion PASSED — a tenancy test green against a route
      // with no tenancy check because there was no route at all. The typed JSON
      // body is what tells the handler's refusal apart from the router's.
      const foreignId = await seedTeamMember({
        contractorId: TENANT_HOMEOWNER, email: 'foreign.d@2c.test', password: PW,
        tier: 'general', active: false,
      });

      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${foreignId}/reactivate`, null, ownerToken);

      assert.equal(res.status, 404, `expected 404, got ${res.status}: ${res.raw}`);
      assert.equal(
        res.body?.error, 'Member not found',
        `expected the HANDLER's typed 404 body, got: ${res.raw}`
      );
      assert.equal(await isActive(foreignId), false, 'and the foreign row is untouched');
    });

    it('[RED] D4 — an ADMIN may not reactivate an ADMIN-tier row', async () => {
      // Mirrors the PATCH's and promote's wall. Without it an Admin could
      // reactivate an Admin they were never allowed to edit.
      const adminId = await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'admin.actor@2c.test', password: PW,
        tier: 'admin', permissions: { 'team.manage': true },
      });
      const adminToken = await makeAdminSession(adminId, TENANT_EMPLOYER);
      const frozenAdminId = await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'admin.target@2c.test', password: PW,
        tier: 'admin', active: false,
      });

      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${frozenAdminId}/reactivate`, null, adminToken);

      assert.equal(res.status, 403, `expected 403, got ${res.status}: ${res.raw}`);
      assert.equal(await isActive(frozenAdminId), false, 'and the row did not change');
    });

    it('[RED] D5 — POSITIVE SIBLING: an OWNER reactivates that same ADMIN-tier row', async () => {
      // ⚠ WITHOUT THIS, D4 PASSES AGAINST A ROUTE THAT REFUSES EVERYONE — or
      // against no route at all, since a 404 is not a 403 but a handler that
      // 403'd unconditionally would satisfy D4 exactly.
      const frozenAdminId = await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'admin.target2@2c.test', password: PW,
        tier: 'admin', active: false,
      });

      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${frozenAdminId}/reactivate`, null, ownerToken);

      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(await isActive(frozenAdminId), true);
    });

    it('[RED] D6 — a member without team.manage is refused', async () => {
      const generalActorId = await seedTeamMember({
        contractorId: TENANT_EMPLOYER, email: 'general.actor@2c.test', password: PW,
        tier: 'general', permissions: {},
      });
      const generalToken = await makeAdminSession(generalActorId, TENANT_EMPLOYER);

      const res = await httpRequest(port, 'PATCH', `/api/admin/team/${frozenGeneralId}/reactivate`, null, generalToken);

      assert.equal(res.status, 403, `expected 403 from requirePermission, got ${res.status}: ${res.raw}`);
      assert.equal(await isActive(frozenGeneralId), false);
    });

    it('[RED] D7 — the transaction rolls back as a unit: a failure on the CLEAR leaves active unchanged', async () => {
      // ⚠ THE FAILURE IS INJECTED AT THE CLIENT, ON THE STATEMENT ITSELF —
      // matched by its SQL text, not by a call counter. A counter would silently
      // aim at a different statement the moment the transaction gained one, which
      // is how a rollback test comes to prove nothing.
      //
      // This is the deactivate handler's Wave 1.1-b defect in mirror image: two
      // bare queries would leave `active = true` committed with the stale seen key
      // still present, so the next freeze would be silent and nothing would say so.
      await login(port, 'general.d@2c.test', PW).catch(() => {});
      // The login above cannot mint the seen key (this member holds no homeowner
      // row), so write it directly — the subject of this test is the ROLLBACK.
      await pool.query(
        `INSERT INTO user_preferences (team_member_id, contractor_id, pref_key, pref_value)
         VALUES ($1, $2, $3, 'true'::jsonb)`,
        [frozenGeneralId, TENANT_EMPLOYER, SEEN_KEY]
      );

      const realConnect = pool.connect.bind(pool);
      let injected = false;
      // Every client handed out during the window, so their query methods can be
      // un-shadowed afterwards. ⚠ POOLED CLIENTS OUTLIVE THIS TEST — a patched
      // `query` left on one is handed to whatever borrows it next, and the damage
      // shows up in an unrelated suite with nothing pointing back here.
      const patched = [];
      function injectInto(client) {
        patched.push(client);
        const realQuery = client.query.bind(client);
        client.query = (...args) => {
          const text = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].text) || '';
          if (/user_preferences/i.test(text)) {
            injected = true;
            return Promise.reject(new Error('injected failure on the seen-key clear'));
          }
          return realQuery(...args);
        };
        return client;
      }

      // ⚠ BOTH CALL FORMS, AND THE CALLBACK ONE IS NOT OPTIONAL. `pool.query()`
      // calls `pool.connect(cb)` internally, so a promise-only stub swallows
      // every pooled query in the process — including the ones logError makes
      // while reporting the very failure being injected. The first version of
      // this test did exactly that and the run HUNG rather than failing, which is
      // the shape worth remembering: a harness defect that produces no error.
      pool.connect = function (cb) {
        if (typeof cb === 'function') {
          return realConnect((err, client, done) => {
            if (err) return cb(err, client, done);
            return cb(null, injectInto(client), done);
          });
        }
        return realConnect().then(injectInto);
      };

      let res;
      try {
        res = await httpRequest(port, 'PATCH', `/api/admin/team/${frozenGeneralId}/reactivate`, null, ownerToken);
      } finally {
        pool.connect = realConnect;
        // Own-property shadow removed, exposing Client.prototype.query again.
        for (const client of patched) delete client.query;
      }

      assert.equal(injected, true, 'the injection never fired — this test proved nothing about rollback');
      assert.equal(res.status, 500, `expected the route to report the failure, got ${res.status}: ${res.raw}`);
      assert.equal(
        await isActive(frozenGeneralId), false,
        'the UPDATE must have rolled back — a committed half is the Wave 1.1-b defect restaged'
      );
      assert.ok(await readSeenRow(frozenGeneralId), 'and the key it failed to clear is still there');
    });
  });
});
