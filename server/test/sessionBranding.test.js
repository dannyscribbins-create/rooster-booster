'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BR-1 PHASE 1 — RED SUITE — GET /api/session/branding
//
// THE DEFECT THIS CLOSES. `resolveFromSession` in src/utils/brandingChain.js is
// `return null` — the whole body. It is FIRST in the D4 chain, so while it
// declines, an authenticated user's branding is decided by `?brand=`, a
// localStorage hint, or nothing at all. The session's own contractor is never
// asked, because there is nothing to ask: BR Phase 0 §3.3 enumerated every
// candidate endpoint and found NO server-side branding source for an
// authenticated session outside the admin panel.
//
// THE CONTRACT THIS FILE DEFINES:
//
//   GET /api/session/branding  →  200 { branding: <resolveBrandingTheme output> }
//                              →  200 {}      when the session has no contractor
//                              →  401         with no token, or a dead token
//
//   Authenticated. Role-agnostic (verifyAnySession). Read-only as to branding.
//   No contractor_id, no slug, no token echo — the payload is a company name,
//   a program name, four colours, a logo URL and public contact details.
//
// ── WHY THE KEY IS OMITTED RATHER THAN NULLED ON THE NO-CONTRACTOR PATH ──────
// The same D-I convention GET /api/admin/me already follows: a client must be
// able to tell "resolution did not happen" from "resolved to nothing". A super
// admin holds a real session and belongs to no contractor; that is not an error
// and it is not a branding answer either. The chain reads a missing key as a
// non-answer and walks on to source 2.
//
// ── WHY NOT /api/branding/session ───────────────────────────────────────────
// `session` is NOT in RESERVED_SLUGS (server/utils/contractorSlug.js) and is a
// well-formed slug, so a contractor could legitimately be issued it. Mounting a
// literal segment under the same prefix as `/api/branding/:slug` would make the
// two collide, and which one won would depend on registration order — a silent
// dependency of exactly the kind this repo keeps finding. A distinct prefix has
// no such ordering hazard.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS anywhere in this file (house
// rule). Two-tenant fixtures throughout.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const crypto = require('crypto');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedContractor } = require('./helpers');

const ROUTE = '/api/session/branding';

const TENANT_A = 'tnt-sbrand-a';
const TENANT_B = 'tnt-sbrand-b';
// A third tenant that has never touched the Branding page. Its settings row
// exists (seedContractor creates one) and every brand column is NULL.
const TENANT_BARE = 'tnt-sbrand-bare';

const BRAND_A = {
  companyName: 'Alpha Roofing Co',
  programName: 'Alpha Rewards',
  primary: '#AA1111',
  secondary: '#AA2222',
  accent: '#AA4444',
  bg: '#AA3333',
  logo: 'https://cdn.test.invalid/alpha-logo.png',
  phone: '555-0100',
  email: 'hello@alpha.invalid',
};

const BRAND_B = {
  companyName: 'Beta Roofing Co',
  programName: 'Beta Rewards',
  primary: '#BB1111',
  secondary: '#BB2222',
  accent: '#BB4444',
  bg: '#BB3333',
  logo: 'https://cdn.test.invalid/beta-logo.png',
  phone: '555-0200',
  email: 'hello@beta.invalid',
};

// Each request gets its own source IP. server/app.js sets `trust proxy 1`, and
// a shared bucket would start 429ing partway through for a reason unrelated to
// what is being tested.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.94.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpGet(port, path, { token = null, headers: extra = {} } = {}) {
  const headers = { 'X-Forwarded-For': nextIp(), ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Promise((resolve, reject) => {
    const req = _httpRequest({ hostname: 'localhost', port, path, method: 'GET', headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let body = null;
        try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
        resolve({ status: res.statusCode, body, raw });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const newToken = () => crypto.randomBytes(32).toString('hex');

let pool, server, port;

async function seedBrandedContractor(contractorId, brand) {
  await seedContractor(pool, contractorId);
  await pool.query('UPDATE contractors SET name = $2 WHERE id = $1', [contractorId, brand.companyName]);
  await pool.query(
    `UPDATE contractor_settings SET
       company_name = $2, app_display_name = $3,
       primary_color = $4, secondary_color = $5, accent_color = $6, landing_bg_color = $7,
       logo_url = $8, company_phone = $9, company_email = $10
     WHERE contractor_id = $1`,
    [contractorId, brand.companyName, brand.programName,
      brand.primary, brand.secondary, brand.accent, brand.bg,
      brand.logo, brand.phone, brand.email]
  );
}

// A referrer session for `contractorId`, returning its bearer token.
async function seedReferrerSession(contractorId, { email }) {
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
     VALUES ($1, $2, 'x', $3, true) RETURNING id`,
    ['Session Branding Referrer', email, contractorId]
  );
  const token = newToken();
  await pool.query(
    `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour', 'referrer', $3)`,
    [rows[0].id, token, contractorId]
  );
  return token;
}

// A team session for `contractorId`, returning its bearer token. The rep surface
// renders inside ThemeProvider too, so this source must answer for team tokens
// as well as referrer ones — which is why the route uses verifyAnySession.
async function seedTeamSession(contractorId, { email }) {
  const { rows } = await pool.query(
    // password_hash is NOT NULL. Nothing here authenticates by password — the
    // session row is seeded directly — so a placeholder that is not a valid
    // bcrypt digest is deliberate: it cannot be matched by any login attempt.
    `INSERT INTO team_members (contractor_id, email, full_name, tier, active, is_field_rep, password_hash)
     VALUES ($1, $2, 'Session Branding Rep', 'general', true, true, 'not-a-usable-hash') RETURNING id`,
    [contractorId, email]
  );
  const token = newToken();
  await pool.query(
    `INSERT INTO sessions (team_member_id, token, expires_at, role, contractor_id)
     VALUES ($1, $2, NOW() + INTERVAL '1 hour', 'admin', $3)`,
    [rows[0].id, token, contractorId]
  );
  return token;
}

async function seedSuperAdminSession() {
  const token = newToken();
  await pool.query(
    `INSERT INTO sessions (token, expires_at, role)
     VALUES ($1, NOW() + INTERVAL '1 hour', 'super_admin')`,
    [token]
  );
  return token;
}

describe('BR-1 Phase 1 — GET /api/session/branding', () => {
  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM users');
    await seedBrandedContractor(TENANT_A, BRAND_A);
    await seedBrandedContractor(TENANT_B, BRAND_B);
    await seedContractor(pool, TENANT_BARE);
  });

  // ── R1 / R3 — RESOLUTION FROM THE SESSION, SERVER-SIDE ─────────────────────

  it('[RED] a referrer session resolves its own contractor\'s branding', async () => {
    const token = await seedReferrerSession(TENANT_A, { email: 'a-ref@alpha.invalid' });

    const res = await httpGet(port, ROUTE, { token });

    assert.equal(res.status, 200, `expected 200, got ${res.status} — the route does not exist yet`);
    assert.ok(res.body && res.body.branding, 'the response must carry a `branding` block');
    assert.equal(res.body.branding.companyName, BRAND_A.companyName);
    assert.equal(res.body.branding.programName, BRAND_A.programName);
    assert.equal(res.body.branding.primaryColor, BRAND_A.primary);
    assert.equal(res.body.branding.logoUrl, BRAND_A.logo);
    // ContactModal's two rows — the symptom (b) this phase exists to close.
    assert.equal(res.body.branding.phone, BRAND_A.phone);
    assert.equal(res.body.branding.email, BRAND_A.email);
  });

  // The rep surface renders inside ThemeProvider, holds `rb_admin_token`, and
  // must resolve identically. A route built on verifyReferrerSession would pass
  // the test above and fail this one.
  it('[RED] a team session resolves its own contractor\'s branding', async () => {
    const token = await seedTeamSession(TENANT_B, { email: 'b-rep@beta.invalid' });

    const res = await httpGet(port, ROUTE, { token });

    assert.equal(res.status, 200);
    assert.equal(res.body.branding.companyName, BRAND_B.companyName);
    assert.equal(res.body.branding.primaryColor, BRAND_B.primary);
  });

  // ── T3 — THE TENANCY TEST ──────────────────────────────────────────────────
  //
  // ASSERTS ON WHAT THE SERVER DERIVED, not on what rendered. Every client-supplied
  // channel that could plausibly name a contractor is present on the SAME request
  // and names B; the session names A. A must win.
  //
  // ⚠ A POSITIVE CONTROL SITS BESIDE IT DELIBERATELY. A route that 500'd, 401'd,
  // or returned neutral for every caller would satisfy "B's branding is not
  // returned" while performing no tenancy resolution whatsoever — the
  // plausible-rejection trap. So the assertion is that A's OWN values came back,
  // not merely that B's did not.
  it('[RED] a session for A with ?brand=B, a hint header and a body field naming B still resolves A', async () => {
    const tokenA = await seedReferrerSession(TENANT_A, { email: 'tenancy@alpha.invalid' });

    const res = await httpGet(
      port,
      `${ROUTE}?brand=${TENANT_B}&slug=${TENANT_B}&contractorId=${TENANT_B}&contractor_id=${TENANT_B}`,
      {
        token: tokenA,
        headers: {
          'X-Brand-Hint': TENANT_B,
          'X-Contractor-Id': TENANT_B,
        },
      }
    );

    assert.equal(res.status, 200);
    // POSITIVE: the server resolved A.
    assert.equal(res.body.branding.companyName, BRAND_A.companyName,
      'the session\'s own contractor must win over every client-supplied channel');
    assert.equal(res.body.branding.primaryColor, BRAND_A.primary);
    assert.equal(res.body.branding.phone, BRAND_A.phone);
    // NEGATIVE: nothing of B leaked.
    assert.notEqual(res.body.branding.companyName, BRAND_B.companyName);
    assert.notEqual(res.body.branding.primaryColor, BRAND_B.primary);
    assert.ok(!res.raw.includes(BRAND_B.companyName), 'no B value may appear anywhere in the body');
  });

  // ── R1 / CD-24 R1 — NO IDENTITY FIELD LEAVES THE ROUTE ─────────────────────
  it('[RED] the payload carries no contractor_id, no slug and no token', async () => {
    const token = await seedReferrerSession(TENANT_A, { email: 'noid@alpha.invalid' });

    const res = await httpGet(port, ROUTE, { token });

    assert.equal(res.status, 200);
    const keys = Object.keys(res.body);
    assert.deepEqual(keys, ['branding'], `the response has exactly one key; got ${keys.join(', ')}`);
    const brandKeys = Object.keys(res.body.branding);
    for (const forbidden of ['slug', 'contractorId', 'contractor_id', 'id', 'token']) {
      assert.ok(!brandKeys.includes(forbidden), `branding must not carry \`${forbidden}\``);
    }
    assert.ok(!res.raw.includes(TENANT_A), 'the contractor id must not appear in the body at all');
    assert.ok(!res.raw.includes(token), 'the token must never be echoed');
  });

  // ── T5 — HONEST NULLS ──────────────────────────────────────────────────────
  //
  // ⚠ THIS PHASE ONLY ASSERTS THEY ARRIVE HONESTLY. What a surface RENDERS for a
  // null logo, phone or email is the absence rule, which is Phase 2.
  it('[RED] a contractor with NULL branding resolves without throwing, and the nulls arrive as null', async () => {
    const token = await seedReferrerSession(TENANT_BARE, { email: 'bare@bare.invalid' });

    const res = await httpGet(port, ROUTE, { token });

    assert.equal(res.status, 200, 'an unbranded contractor must resolve, not 500');
    assert.ok(res.body.branding, 'the branding block must still be present');
    assert.equal(res.body.branding.logoUrl, null, 'logoUrl must be null, not a platform substitute');
    assert.equal(res.body.branding.phone, null);
    assert.equal(res.body.branding.email, null);
    assert.equal(res.body.branding.programName, null);
    // NOT VACUOUS: companyName falls back to contractors.name, which is NOT NULL,
    // so a real contractor always returns something identifying even with every
    // brand column unset. A response of all-nulls would fail here.
    assert.equal(res.body.branding.companyName, TENANT_BARE);
  });

  // ── R2's SERVER HALF — NO SESSION, NO ANSWER ───────────────────────────────

  it('[RED] no Authorization header is 401, not a neutral 200', async () => {
    const res = await httpGet(port, ROUTE);
    assert.equal(res.status, 401,
      'a 200 here would make "no session" indistinguishable from "resolved to the platform"');
  });

  it('[RED] an expired session is 401 and returns no branding', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ('Expired', 'expired@alpha.invalid', 'x', $1, true) RETURNING id`,
      [TENANT_A]
    );
    const token = newToken();
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour', 'referrer', $3)`,
      [rows[0].id, token, TENANT_A]
    );

    const res = await httpGet(port, ROUTE, { token });

    assert.equal(res.status, 401);
    assert.ok(!res.raw.includes(BRAND_A.companyName), 'a dead token must resolve nothing');
  });

  it('[RED] an unknown token is 401', async () => {
    const res = await httpGet(port, ROUTE, { token: newToken() });
    assert.equal(res.status, 401);
  });

  // ── THE NO-CONTRACTOR SESSION ──────────────────────────────────────────────
  //
  // A super admin holds a real session and belongs to no contractor. Omitting the
  // key (D-I) is what lets the chain tell that apart from a resolution failure.
  it('[RED] a super_admin session gets 200 with the branding key OMITTED, not nulled', async () => {
    const token = await seedSuperAdminSession();

    const res = await httpGet(port, ROUTE, { token });

    assert.equal(res.status, 200, 'a valid session is not an auth failure');
    assert.ok(!('branding' in res.body),
      'the key must be ABSENT — a null branding reads as "resolved to nothing", which is a different fact');
  });

  // ── METHOD ─────────────────────────────────────────────────────────────────
  it('[RED] the route is GET-only', async () => {
    const token = await seedReferrerSession(TENANT_A, { email: 'method@alpha.invalid' });
    const res = await new Promise((resolve, reject) => {
      const req = _httpRequest({
        hostname: 'localhost', port, path: ROUTE, method: 'POST',
        headers: { 'X-Forwarded-For': nextIp(), Authorization: `Bearer ${token}`, 'Content-Length': 0 },
      }, r => {
        r.on('data', () => {});
        r.on('end', () => resolve({ status: r.statusCode }));
      });
      req.on('error', reject);
      req.end();
    });
    assert.notEqual(res.status, 200, 'a POST must not resolve branding');
  });
});
