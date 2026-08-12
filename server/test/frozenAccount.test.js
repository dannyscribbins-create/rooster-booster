'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 3 — THE FROZEN ACCOUNT VIEW (D3)
//
// Governing spec: CDL_3b_BUILD_SPEC.md §5, decision D3.
//
// THE STARTING TRUTH. Deactivation deletes the member's sessions and flips
// `active = false`. Both login lookups carry `AND active = true`, so a
// deactivated person typing their CORRECT password is told
// "Invalid credentials" — indistinguishable from a typo. They retry until the
// rate limiter locks them out, and nothing anywhere tells them why.
//
// THE ORDER IS THE WHOLE DESIGN, AND IT IS WHY THIS IS NOT A ONE-LINE DELETE.
// Leaving the predicate in the LOOKUP produces today's misleading 401. Naively
// DELETING it turns the endpoint into an account enumerator: anyone could
// discover which addresses exist by observing a different response. So the
// predicate moves to a branch that runs AFTER bcrypt.compare has succeeded —
// the password must be genuinely proven before anything different is said.
//
// Every assertion below is one of those two halves:
//
//   PROVEN CREDENTIAL   → 403 { error: 'account_frozen', branding }, no session
//   UNPROVEN CREDENTIAL → the generic 401, byte-identical to an unknown address
//
// SESSIONS ARE ASSERTED AGAINST THE TABLE, NOT THE RESPONSE. A handler that
// minted a session and merely omitted the token from its JSON would pass a
// response-only check while leaving a live credential in the database. D3 binds
// "MINT NO SESSION", so that is what gets counted.
//
// BRANDING IN THE 403. Because the password is already proven, the server knows
// the contractor — so the frozen screen can be correctly white-labelled on a
// brand-new device with no stored hint and no host to read. The fixture below
// therefore saves a DISTINCTIVE palette and asserts against it, not merely that
// a branding key is present: a handler returning the neutral platform defaults
// would satisfy "has branding" while showing a frozen employee the wrong company.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const bcrypt = require('bcrypt');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');
const { resolveBrandingTheme } = require('../utils/brandingTheme');

const LOGIN = '/api/login';
const ADMIN_LOGIN = '/api/admin/login';
const CHOICE = '/api/login/choice';

const TENANT_FROZEN = 'tnt-frozen-a';
const TENANT_OTHER = 'tnt-frozen-b';

// A palette that shares NOT ONE VALUE with the platform defaults, so "the
// response carries branding" and "the response carries the RIGHT branding" are
// different assertions rather than the same one.
const FROZEN_BRAND = Object.freeze({
  companyName: 'Frozen Roofing Co',
  primaryColor: '#123456',
  secondaryColor: '#654321',
  accentColor: '#ABCDEF',
  backgroundColor: '#FAFAFA',
  logoUrl: 'https://cdn.test.invalid/frozen-logo.png',
});
const OTHER_BRAND_NAME = 'Beta Exteriors';

const PW = 'frozen-password-1';
const PW_OTHER = 'other-password-22';
const WRONG_PW = 'definitely-not-it';

const GENERIC_401_UNIFIED = { error: 'Invalid email or PIN' };
const GENERIC_401_ADMIN = { error: 'Invalid credentials' };

const NEUTRAL_BRANDING = resolveBrandingTheme(null);

// Rotating source IP — referrerLoginLimiter is 10/15min and adminLoginLimiter is
// 5/15min, both per IP, and this file makes far more attempts than either allows.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.93.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpPost(port, path, bodyObj) {
  const payload = Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'X-Forwarded-For': nextIp(),
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
    req.write(payload);
    req.end();
  });
}

let pool, server, port;

async function seedTeamMember({ contractorId, email, password, active, tier = 'general' }) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions, active)
     VALUES ($1, $2, $3, $4, '{}', $5) RETURNING id`,
    [contractorId, email, hash, tier, active]
  );
  return rows[0].id;
}

async function seedReferrer({ contractorId, email, password, fullName = 'Test Referrer' }) {
  const pinHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
     VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [fullName, email, pinHash, contractorId]
  );
  return rows[0].id;
}

async function countSessions() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM sessions');
  return rows[0].n;
}

describe('C/DL-3b Phase 3 — frozen account view (D3)', () => {
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
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM activity_log');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM contractors WHERE id LIKE $1', ['tnt-frozen-%']);
    await seedContractor(pool, TENANT_FROZEN);
    await seedContractor(pool, TENANT_OTHER);
    await pool.query(
      `UPDATE contractor_settings
          SET company_name = $2, primary_color = $3, secondary_color = $4,
              accent_color = $5, landing_bg_color = $6, logo_url = $7
        WHERE contractor_id = $1`,
      [
        TENANT_FROZEN, FROZEN_BRAND.companyName, FROZEN_BRAND.primaryColor,
        FROZEN_BRAND.secondaryColor, FROZEN_BRAND.accentColor,
        FROZEN_BRAND.backgroundColor, FROZEN_BRAND.logoUrl,
      ]
    );
    await pool.query(
      'UPDATE contractor_settings SET company_name = $2 WHERE contractor_id = $1',
      [TENANT_OTHER, OTHER_BRAND_NAME]
    );
  });

  // ══ GROUP 1 — POST /api/login, THE UNIFIED DOOR ════════════════════════════

  describe('unified login — a deactivated team member', () => {
    const EMAIL = 'frozen.member@frozen.test';

    beforeEach(async () => {
      await seedTeamMember({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW, active: false });
    });

    it('[RED] the CORRECT password returns 403 account_frozen and mints no session', async () => {
      // Today: 401 'Invalid email or PIN', because `active = true` sits in the
      // LOOKUP and the row is never a candidate at all.
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW });

      assert.equal(res.status, 403, `expected 403, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.error, 'account_frozen', `expected the typed body, got: ${res.raw}`);
      assert.equal(res.body.token, undefined, 'a frozen credential must never receive a token');

      // THE TABLE, not the response — see this file's header.
      assert.equal(await countSessions(), 0, 'a frozen login must create no session row');
    });

    it('[RED] a WRONG password is the generic 401 — the frozen state needs the credential proven', async () => {
      // The enumeration half. If the branch ran before the compare, anyone could
      // discover which addresses exist by watching for a 403.
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: WRONG_PW });

      assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.raw}`);
      assert.deepEqual(res.body, GENERIC_401_UNIFIED);
      assert.equal(res.raw.includes('account_frozen'), false, 'an unproven credential must learn nothing');
      assert.equal(await countSessions(), 0);
    });

    it('[RED] an unknown address answers identically to a wrong password', async () => {
      const unknown = await httpPost(port, LOGIN, { email: 'nobody@frozen.test', pin: WRONG_PW });
      const wrong = await httpPost(port, LOGIN, { email: EMAIL, pin: WRONG_PW });

      assert.equal(unknown.status, wrong.status, 'status must not distinguish the two');
      assert.deepEqual(unknown.body, wrong.body, 'body must not distinguish the two — otherwise this enumerates accounts');
      assert.deepEqual(unknown.body, GENERIC_401_UNIFIED);
    });

    it("[RED] the 403 carries the frozen member's OWN branding, with no hint anywhere in the request", async () => {
      // No Host header naming a contractor, no ?brand= hint, no stored hint — the
      // request carries nothing but an address and a password. The server can
      // still white-label the screen ONLY because it has already proven the
      // credential and therefore knows the tenant.
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW });
      assert.equal(res.status, 403, res.raw);

      const branding = res.body.branding;
      assert.ok(branding && typeof branding === 'object', `expected a branding payload, got: ${res.raw}`);
      assert.equal(branding.companyName, FROZEN_BRAND.companyName);
      assert.equal(branding.primaryColor, FROZEN_BRAND.primaryColor);
      assert.equal(branding.secondaryColor, FROZEN_BRAND.secondaryColor);
      assert.equal(branding.logoUrl, FROZEN_BRAND.logoUrl);

      // NON-VACUITY. A handler that returned resolveBrandingTheme(null) would
      // satisfy "carries branding" while showing a frozen employee the platform's
      // logo instead of their employer's.
      assert.notEqual(branding.companyName, NEUTRAL_BRANDING.companyName);
      assert.notEqual(branding.primaryColor, NEUTRAL_BRANDING.primaryColor);
    });

    it('[RED] the 403 carries no tenancy-bearing identifier', async () => {
      // Same rule the choice response follows: a branding payload is cosmetic, and
      // an id or slug in it is an identity value the client has no use for.
      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW });
      assert.equal(res.status, 403, res.raw);
      assert.equal(res.body.branding.slug, undefined, 'the slug is not part of a branding payload');
      assert.equal(res.raw.includes(TENANT_FROZEN), false, 'no contractor id may appear in the response');
    });
  });

  describe('unified login — an ACTIVE team member is untouched', () => {
    const EMAIL = 'active.member@frozen.test';

    it('[RED] the correct password still mints a team session', async () => {
      await seedTeamMember({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW, active: true });

      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW });
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.role, 'team');

      const { rows } = await pool.query(
        'SELECT role, contractor_id, team_member_id FROM sessions WHERE token = $1',
        [res.body.token]
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].role, 'admin', "team sessions keep the existing 'admin' session role");
      assert.equal(rows[0].contractor_id, TENANT_FROZEN);
      assert.ok(rows[0].team_member_id);
    });
  });

  describe('unified login — a frozen identity never crowds out a live one', () => {
    const EMAIL = 'both.sides@frozen.test';

    it('[RED] a live referrer row wins outright when the team row is frozen', async () => {
      // Same address, same password, on both sides. The team identity is frozen,
      // so exactly ONE identity is reachable — which means a session, not a choice
      // screen, and certainly not a 403.
      await seedTeamMember({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW, active: false });
      await seedReferrer({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW });

      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW });
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.role, 'referrer');
      assert.equal(res.body.choice_required, undefined, 'one reachable identity is not a choice');

      const { rows } = await pool.query('SELECT role FROM sessions WHERE token = $1', [res.body.token]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].role, 'referrer');
    });

    it('[RED] a frozen identity is never offered on the choice screen', async () => {
      // Two live referrer rows plus one frozen team row, all on one password. The
      // choice list is "where you can go", so an unreachable identity must not
      // appear on it — offering it would produce a screen where one option always
      // fails.
      await seedTeamMember({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW, active: false });
      await seedReferrer({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW });
      await seedReferrer({ contractorId: TENANT_OTHER, email: EMAIL, password: PW });

      const res = await httpPost(port, LOGIN, { email: EMAIL, pin: PW });
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.choice_required, true, `expected a choice, got: ${res.raw}`);
      assert.equal(res.body.identities.length, 2, `only reachable identities may be listed: ${res.raw}`);
      assert.deepEqual(res.body.identities.map(i => i.role).sort(), ['referrer', 'referrer']);
      assert.equal(await countSessions(), 0, 'a multi-match must create no session row');
    });
  });

  // ══ GROUP 2 — POST /api/admin/login, THE SURFACE FROZEN EMPLOYEES USE ══════

  describe('admin login', () => {
    const EMAIL = 'frozen.admin@frozen.test';

    it('[RED] a deactivated member with the CORRECT password gets 403 account_frozen and no session', async () => {
      await seedTeamMember({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW, active: false });

      const res = await httpPost(port, ADMIN_LOGIN, { email: EMAIL, password: PW });
      assert.equal(res.status, 403, `expected 403, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.error, 'account_frozen');
      assert.equal(res.body.token, undefined);
      assert.equal(await countSessions(), 0, 'a frozen login must create no session row');
    });

    it("[RED] the admin 403 carries the same branding payload the unified door returns", async () => {
      await seedTeamMember({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW, active: false });

      const res = await httpPost(port, ADMIN_LOGIN, { email: EMAIL, password: PW });
      assert.equal(res.status, 403, res.raw);
      assert.equal(res.body.branding.companyName, FROZEN_BRAND.companyName);
      assert.equal(res.body.branding.primaryColor, FROZEN_BRAND.primaryColor);
      assert.equal(res.body.branding.logoUrl, FROZEN_BRAND.logoUrl);
      assert.equal(res.body.branding.slug, undefined);
    });

    it('[RED] a WRONG password is the generic 401', async () => {
      await seedTeamMember({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW, active: false });

      const res = await httpPost(port, ADMIN_LOGIN, { email: EMAIL, password: WRONG_PW });
      assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.raw}`);
      assert.deepEqual(res.body, GENERIC_401_ADMIN);
      assert.equal(res.raw.includes('account_frozen'), false);
    });

    it('[RED] an unknown address answers identically to a wrong password', async () => {
      await seedTeamMember({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW, active: false });

      const unknown = await httpPost(port, ADMIN_LOGIN, { email: 'nobody@frozen.test', password: WRONG_PW });
      const wrong = await httpPost(port, ADMIN_LOGIN, { email: EMAIL, password: WRONG_PW });
      assert.equal(unknown.status, wrong.status);
      assert.deepEqual(unknown.body, wrong.body);
      assert.deepEqual(unknown.body, GENERIC_401_ADMIN);
    });

    it('[RED] an ACTIVE member still logs in and receives tier and permissions', async () => {
      await seedTeamMember({ contractorId: TENANT_FROZEN, email: 'live.admin@frozen.test', password: PW, active: true, tier: 'owner' });

      const res = await httpPost(port, ADMIN_LOGIN, { email: 'live.admin@frozen.test', password: PW });
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.success, true);
      assert.equal(res.body.tier, 'owner');
      const { rows } = await pool.query('SELECT contractor_id FROM sessions WHERE token = $1', [res.body.token]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].contractor_id, TENANT_FROZEN);
    });
  });

  // ══ GROUP 3 — THE CHOICE WINDOW ════════════════════════════════════════════

  describe('choice redemption', () => {
    const EMAIL = 'window@frozen.test';

    it('[RED] a member deactivated INSIDE the two-minute window gets the frozen answer, not a session', async () => {
      // The credential was proven when the token was issued, so this person has
      // earned the honest answer — and redemption re-reads the row precisely so a
      // deactivation inside the window still takes effect. Both hold at once:
      // 403 account_frozen, and no session.
      const memberId = await seedTeamMember({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW, active: true });
      await seedReferrer({ contractorId: TENANT_OTHER, email: EMAIL, password: PW });

      const first = await httpPost(port, LOGIN, { email: EMAIL, pin: PW });
      assert.equal(first.body.choice_required, true, `precondition: a choice is offered: ${first.raw}`);
      const teamPick = first.body.identities.find(i => i.role === 'team');
      assert.ok(teamPick, `precondition: the team identity is on the list: ${first.raw}`);

      await pool.query('UPDATE team_members SET active = false WHERE id = $1', [memberId]);

      const res = await httpPost(port, CHOICE, { choice_token: first.body.choice_token, selection: teamPick.selection });
      assert.equal(res.status, 403, `expected 403, got ${res.status}: ${res.raw}`);
      assert.equal(res.body.error, 'account_frozen');
      assert.equal(await countSessions(), 0, 'a frozen redemption must create no session row');
    });

    it('[RED] a DELETED identity inside the window stays a generic 401', async () => {
      // The distinction is not decoration. A frozen row is a person who exists and
      // deserves an explanation; a row that is gone is indistinguishable from a
      // forged token and must stay in the generic bucket.
      const memberId = await seedTeamMember({ contractorId: TENANT_FROZEN, email: EMAIL, password: PW, active: true });
      await seedReferrer({ contractorId: TENANT_OTHER, email: EMAIL, password: PW });

      const first = await httpPost(port, LOGIN, { email: EMAIL, pin: PW });
      const teamPick = first.body.identities.find(i => i.role === 'team');
      await pool.query('DELETE FROM team_members WHERE id = $1', [memberId]);

      const res = await httpPost(port, CHOICE, { choice_token: first.body.choice_token, selection: teamPick.selection });
      assert.equal(res.status, 401, `expected 401, got ${res.status}: ${res.raw}`);
      assert.deepEqual(res.body, GENERIC_401_UNIFIED);
    });
  });
});
