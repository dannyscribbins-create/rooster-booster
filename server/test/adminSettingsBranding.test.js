'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3a RED SUITE — ADMIN SETTINGS BRANDING
//
// Two independent things live here because they are the same endpoint pair:
//
//   PART 1 — IN-PATH BUG FIX (b). GET /api/admin/settings' zero-row fallback
//   (admin/index.js:580-604) answers a contractor that has never saved settings
//   with Accent Roofing's literals: their company name, their phone number,
//   their leaksmith.com address, their website, their Google review URL, and
//   logo_url: '/AccentRoofing-Logo-White.png'. The contractor's OWN id is
//   returned alongside all of it, so the payload reads as "these are your
//   settings". This is the last hardcoded-tenant surface on the admin side and
//   the direct sibling of the CONTRACTOR_NAME constant Phase 2a removed from the
//   public side (Phase 0 finding C9).
//
//   Worse than cosmetic: the admin Branding form loads this payload as its
//   initial state and PUTs it back on the first save. A contractor #2 who opens
//   Branding and changes one field PERSISTS Accent's name, phone and logo into
//   their own contractor_settings row — and from there into their emails and,
//   once Phase 3b ships, onto their public landing page.
//
//   PART 2 — landing_bg_color WIRING. The column exists (db.js:243, shipped in
//   ff2a871) and loadContractorBranding already reads it (referrer.js:244), but
//   neither GET nor PUT /api/admin/settings mentions it, so no admin can set it.
//   Both sides are wired in one change, for the reason the landmine test below
//   exists.
//
// NON-VACUITY. Every absence assertion in Part 1 is preceded by proof that the
// response is a 200 carrying THIS contractor's payload (contractor_id echoed
// back). Without that, a 403 from the permission gate or a 401 from an expired
// session would contain none of Accent's strings either, and the test would pass
// while proving nothing.
//
// NO PRODUCTION CONTRACTOR ID LITERALS (house rule) — tenant ids are
// fixture-local. The exception is ACCENT_LITERALS, which must name the exact
// strings it exists to detect.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

const SETTINGS_PATH = '/api/admin/settings';
const ME_PATH       = '/api/admin/me';

const TENANT_A_ID = 'tnt-q3vb-internal';   // no contractor_settings row — the zero-row case
const TENANT_B_ID = 'tnt-w8ny-internal';   // fully branded — the contamination source

// ⚠ THE SLUGS EXIST FOR ONE ASSERTION AND WOULD OTHERWISE BE VACUOUS SCAFFOLDING
// (Phase 2B). GET /api/admin/me's branding block must carry no slug (CD-24 R1),
// and `contractors.slug` is NULL on arrival for every row — so a fixture without
// them would let "no slug is echoed" pass against a payload that could not have
// contained one. CLAUDE.md vacuity shape #1: a case row proves nothing until the
// field exists. They are set here so the absence is a real absence.
const SLUG_A = 'alpha-roofing-fixture';
const SLUG_B = 'beta-roofing-fixture';

const COMPANY_A = 'Alpha Roofing Co';
const COMPANY_B = 'Beta Roofing Co';

// Every literal the zero-row fallback hardcodes today. Named exhaustively rather
// than checking one representative string, because a partial fix — dropping the
// logo but keeping the phone number — is still a white-label breach.
const ACCENT_LITERALS = [
  '/AccentRoofing-Logo-White.png',
  'Accent Roofing Service',
  '770-277-4869',
  'contact@leaksmith.com',
  'accentroofingservice.com',
  'https://g.page/r/CbtYNjHgUCwhEBM/review',
];

// Tenant B's distinctive brand. If any of these reach tenant A's payload the
// leak is cross-tenant rather than merely hardcoded.
const TENANT_B_BRAND = Object.freeze({
  company_name:     COMPANY_B,
  company_phone:    '555-0199',
  company_email:    'contact@beta.test.invalid',
  logo_url:         'https://cdn.test.invalid/beta/logo.png',
  primary_color:    '#B0B0B0',
  landing_bg_color: '#BBBBBB',
});

function httpRequest(port, method, path, token, bodyObj) {
  const payload = bodyObj === undefined ? null : Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
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

describe('C/DL-2 Phase 3a — GET/PUT /api/admin/settings branding', () => {
  let pool, server, port;
  let ownerA, ownerB, readOnlyA, noPermsA;   // team_members.id

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));

    const hash = await bcrypt.hash('TestBrand123!', 4);   // rounds=4 for test speed

    for (const [id, name, slug] of [[TENANT_A_ID, COMPANY_A, SLUG_A], [TENANT_B_ID, COMPANY_B, SLUG_B]]) {
      await pool.query(`INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`, [id, name, slug]);
    }

    const mkMember = async (contractorId, email, tier, permissions) => {
      const { rows } = await pool.query(
        `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [contractorId, email, hash, tier, JSON.stringify(permissions)]
      );
      return rows[0].id;
    };

    ownerA = await mkMember(TENANT_A_ID, 'owner@alpha.test.invalid', 'owner', {});
    ownerB = await mkMember(TENANT_B_ID, 'owner@beta.test.invalid',  'owner', {});
    // Read-only: holds `branding` (view) but NOT `branding.manage` (write).
    readOnlyA = await mkMember(TENANT_A_ID, 'viewer@alpha.test.invalid', 'admin', { branding: true });
    // ⚠ ZERO PERMISSIONS, AND SPECIFICALLY NOT 'branding' (Phase 2B, D-H). This
    // member is the whole reason /api/admin/me was chosen over
    // /api/admin/settings: the latter is gated `requirePermission('branding')`,
    // so a Finance or read-only admin would get a 403 and their contractor's
    // logo would vanish for exactly the roles least able to explain why.
    noPermsA = await mkMember(TENANT_A_ID, 'general@alpha.test.invalid', 'general', {});
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM contractor_settings');
    // Tenant B is always fully branded — it is the contamination source that
    // makes "tenant A saw someone else's brand" a decidable question.
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, company_phone, company_email,
          logo_url, primary_color, landing_bg_color)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        TENANT_B_ID, TENANT_B_BRAND.company_name, TENANT_B_BRAND.company_phone,
        TENANT_B_BRAND.company_email, TENANT_B_BRAND.logo_url,
        TENANT_B_BRAND.primary_color, TENANT_B_BRAND.landing_bg_color,
      ]
    );
  });

  async function session(contractorId, teamMemberId) {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
      [token, contractorId, teamMemberId]
    );
    return token;
  }

  async function settingsRow(contractorId) {
    const { rows } = await pool.query(
      `SELECT company_name, company_phone, logo_url, primary_color, landing_bg_color
         FROM contractor_settings WHERE contractor_id = $1`,
      [contractorId]
    );
    return rows[0] || null;
  }

  // ══ PART 1 — ZERO-ROW FALLBACK MUST BE NEUTRAL ═════════════════════════════

  it('a contractor with no settings row receives neutral defaults, not Accent\'s', async () => {
    const token = await session(TENANT_A_ID, ownerA);

    // Precondition: tenant A genuinely has no row, so the fallback branch runs.
    assert.equal(await settingsRow(TENANT_A_ID), null, 'fixture error: tenant A already has a settings row');

    const res = await httpRequest(port, 'GET', SETTINGS_PATH, token);

    // ── NON-VACUITY GATE ─────────────────────────────────────────────────────
    // A 403 or 401 body contains none of Accent's strings either. These three
    // assertions prove we are looking at tenant A's real settings payload.
    assert.equal(res.status, 200, `GET /api/admin/settings failed: ${res.raw}`);
    assert.ok(res.body && typeof res.body === 'object', `expected a JSON object, got: ${res.raw}`);
    assert.equal(
      res.body.contractor_id, TENANT_A_ID,
      `the payload is not tenant A's — the assertions below would prove nothing. Got: ${res.raw}`
    );

    for (const literal of ACCENT_LITERALS) {
      assert.equal(
        res.raw.includes(literal), false,
        `the zero-row fallback served another contractor's brand value ${JSON.stringify(literal)} ` +
        `to tenant A. Full payload: ${res.raw}`
      );
    }
  });

  it('the zero-row fallback carries no logo at all', async () => {
    // Called out separately from the string sweep because the correct answer here
    // is a specific value, not merely "not Accent's". A borrowed placeholder logo
    // is a white-label breach whoever it belongs to — the same rule
    // loadContractorBranding states at referrer.js:245-247. Null is the answer;
    // the admin form renders an empty upload slot and the landing page draws no
    // logo row.
    const token = await session(TENANT_A_ID, ownerA);
    const res = await httpRequest(port, 'GET', SETTINGS_PATH, token);

    assert.equal(res.status, 200, `GET /api/admin/settings failed: ${res.raw}`);
    assert.equal(res.body.contractor_id, TENANT_A_ID, `not tenant A's payload: ${res.raw}`);
    assert.equal(res.body.logo_url, null, `expected no logo in the zero-row fallback, got ${res.body.logo_url}`);
  });

  it('the zero-row fallback never carries another live contractor\'s values', async () => {
    // The two-tenant form of the same requirement. Tenant B is fully branded in
    // the DB; a fallback built by "read any settings row" — or a GET that lost
    // its contractor_id predicate — would hand B's brand to A, and the hardcoded
    // -literal sweep above would not catch it.
    const token = await session(TENANT_A_ID, ownerA);
    const res = await httpRequest(port, 'GET', SETTINGS_PATH, token);

    assert.equal(res.status, 200, `GET /api/admin/settings failed: ${res.raw}`);
    assert.equal(res.body.contractor_id, TENANT_A_ID, `not tenant A's payload: ${res.raw}`);

    for (const value of Object.values(TENANT_B_BRAND)) {
      assert.equal(
        res.raw.includes(value), false,
        `tenant A's zero-row payload contains tenant B's ${JSON.stringify(value)}: ${res.raw}`
      );
    }
  });

  it('if the zero-row fallback names a company at all, it names the caller\'s own', async () => {
    // Null is acceptable; the contractor's own contractors.name is better and is
    // what loadContractorBranding's middle step already does (referrer.js:240).
    // Any THIRD value is the bug. Written as a decidable either/or rather than
    // pinning one, because both are defensible and the phase brief specifies
    // "neutral", not which flavour of neutral.
    const token = await session(TENANT_A_ID, ownerA);
    const res = await httpRequest(port, 'GET', SETTINGS_PATH, token);

    assert.equal(res.status, 200, `GET /api/admin/settings failed: ${res.raw}`);
    assert.equal(res.body.contractor_id, TENANT_A_ID, `not tenant A's payload: ${res.raw}`);
    assert.ok(
      res.body.company_name === null || res.body.company_name === COMPANY_A,
      `the zero-row fallback named a company that is neither null nor the caller's own: ` +
      `${JSON.stringify(res.body.company_name)}`
    );
  });

  it('a contractor WITH a settings row still gets its own saved values', async () => {
    // Guards the fix against over-reach: neutralising the fallback must not
    // neutralise the ordinary path. Tenant B is branded and must read back
    // branded.
    const token = await session(TENANT_B_ID, ownerB);
    const res = await httpRequest(port, 'GET', SETTINGS_PATH, token);

    assert.equal(res.status, 200, `GET /api/admin/settings failed: ${res.raw}`);
    assert.equal(res.body.contractor_id, TENANT_B_ID, `not tenant B's payload: ${res.raw}`);
    assert.equal(res.body.company_name, COMPANY_B);
    assert.equal(res.body.logo_url, TENANT_B_BRAND.logo_url);
  });

  // ══ PART 2 — landing_bg_color WIRING ═══════════════════════════════════════

  it('GET returns landing_bg_color', async () => {
    const token = await session(TENANT_B_ID, ownerB);
    const res = await httpRequest(port, 'GET', SETTINGS_PATH, token);

    assert.equal(res.status, 200, `GET /api/admin/settings failed: ${res.raw}`);
    assert.equal(res.body.contractor_id, TENANT_B_ID, `not tenant B's payload: ${res.raw}`);
    assert.equal(
      res.body.landing_bg_color, TENANT_B_BRAND.landing_bg_color,
      'GET /api/admin/settings does not return landing_bg_color — the column exists (db.js:243) ' +
      'and the landing page reads it (referrer.js:244), but no admin can see or set it'
    );
  });

  it('PUT persists landing_bg_color', async () => {
    const token = await session(TENANT_B_ID, ownerB);

    const res = await httpRequest(port, 'PUT', SETTINGS_PATH, token, {
      company_name: COMPANY_B,
      landing_bg_color: '#0F0F0F',
    });
    assert.equal(res.status, 200, `PUT /api/admin/settings failed: ${res.raw}`);

    const row = await settingsRow(TENANT_B_ID);
    assert.equal(row.landing_bg_color, '#0F0F0F', 'PUT /api/admin/settings did not persist landing_bg_color');
  });

  it('saving an unrelated branding field does not wipe an existing landing_bg_color', async () => {
    // ── THE LANDMINE ─────────────────────────────────────────────────────────
    // PUT /api/admin/settings is a full-row upsert: every column in its parameter
    // list is written on every call, with `undefined` mapping to NULL. The admin
    // form's save handler sends the GET response merged with form state, so any
    // column present in PUT but ABSENT from GET is destroyed the first time an
    // admin saves anything at all.
    //
    // That makes "add landing_bg_color to the PUT" — the obvious one-line change,
    // since PUT is where saving happens — strictly worse than doing nothing: a
    // contractor who set their landing background and later edited their phone
    // number would silently lose the background. Both sides, or neither.
    //
    // This test is written so that it cannot pass by accident. Today BOTH sides
    // are missing, so the column is simply never touched and the round trip
    // preserves it for the wrong reason. The GET assertion below is the
    // non-vacuity gate that closes that hole: it fails first, on arrival, and the
    // preservation assertion only becomes reachable once GET is wired.
    const token = await session(TENANT_B_ID, ownerB);

    const before = await httpRequest(port, 'GET', SETTINGS_PATH, token);
    assert.equal(before.status, 200, `GET /api/admin/settings failed: ${before.raw}`);
    assert.equal(
      before.body.landing_bg_color, TENANT_B_BRAND.landing_bg_color,
      'GET does not surface landing_bg_color, so the round trip below cannot be exercised — ' +
      'the form has nothing to send back and the preservation assertion would be vacuous'
    );

    // Exactly what the admin form does on save: the whole loaded payload, with
    // one unrelated field edited.
    const merged = { ...before.body, company_phone: '555-0250' };
    const put = await httpRequest(port, 'PUT', SETTINGS_PATH, token, merged);
    assert.equal(put.status, 200, `PUT /api/admin/settings failed: ${put.raw}`);

    const row = await settingsRow(TENANT_B_ID);

    // NON-VACUITY: prove the save actually happened. A PUT that 200'd but wrote
    // nothing would preserve landing_bg_color trivially.
    assert.equal(row.company_phone, '555-0250', 'the PUT did not persist the edited field — nothing was saved');

    assert.equal(
      row.landing_bg_color, TENANT_B_BRAND.landing_bg_color,
      'saving an unrelated branding field wiped landing_bg_color — landing_bg_color reached ' +
      'PUT without reaching GET'
    );
  });

  it('PUT writes only the calling contractor\'s row', async () => {
    // The upsert is keyed on the session-derived contractorId. Tenant A saving a
    // background must not touch tenant B's.
    const token = await session(TENANT_A_ID, ownerA);

    const put = await httpRequest(port, 'PUT', SETTINGS_PATH, token, {
      company_name: COMPANY_A,
      landing_bg_color: '#0A0A0A',
    });
    assert.equal(put.status, 200, `PUT /api/admin/settings failed: ${put.raw}`);

    // NON-VACUITY: tenant A must have been written before "tenant B untouched"
    // means anything — a no-op PUT leaves both untouched.
    const rowA = await settingsRow(TENANT_A_ID);
    assert.equal(rowA.landing_bg_color, '#0A0A0A', "tenant A's own write did not land — nothing is proven about tenant B");

    const rowB = await settingsRow(TENANT_B_ID);
    assert.equal(
      rowB.landing_bg_color, TENANT_B_BRAND.landing_bg_color,
      "tenant A's save changed tenant B's landing background"
    );
    assert.equal(rowB.company_name, COMPANY_B, "tenant A's save changed tenant B's company name");
  });

  // ══ PART 3 — GATES UNCHANGED ═══════════════════════════════════════════════

  it('read requires branding; write requires branding.manage', async () => {
    // The wiring must not relax either gate. readOnlyA holds `branding` and not
    // `branding.manage`, which is exactly the marketing-viewer shape Phase 6's
    // presets depend on.
    const token = await session(TENANT_A_ID, readOnlyA);

    // NON-VACUITY: the read leg must succeed, or the 403 below would be
    // indistinguishable from a member who cannot reach the endpoint at all.
    const read = await httpRequest(port, 'GET', SETTINGS_PATH, token);
    assert.equal(read.status, 200, `a member holding 'branding' must be able to read settings: ${read.raw}`);

    const write = await httpRequest(port, 'PUT', SETTINGS_PATH, token, { landing_bg_color: '#0C0C0C' });
    assert.equal(
      write.status, 403,
      `a member without 'branding.manage' must not be able to write settings, got ${write.status}: ${write.raw}`
    );

    assert.equal(
      await settingsRow(TENANT_A_ID), null,
      'the refused PUT still created a settings row'
    );
  });

  // ══ PART 4 — GET /api/admin/me CARRIES BRANDING (Phase 2B, spec D-H) ═══════
  //
  // The delivery seam. The admin panel has no way to learn who its contractor is:
  // GET /api/admin/settings knows, but it is gated `requirePermission('branding')`,
  // and the D4 branding chain resolves from the URL and hostname rather than from
  // the proven session — which is the R2 shape the checklist keeps open. /me is
  // session-only by construction, so it is the one response every tier receives.
  //
  // THESE TESTS LIVE IN THIS FILE, NOT A NEW ONE, because the two-tenant fixture
  // above is what makes them decidable: "tenant A got branding" proves nothing
  // unless tenant B's branding is simultaneously real and different.

  it('[RED] carries a branding block for the session\'s own tenant', async () => {
    const token = await session(TENANT_A_ID, ownerA);
    const res = await httpRequest(port, 'GET', ME_PATH, token);

    // NON-VACUITY: a 401 or 403 body carries no branding either.
    assert.equal(res.status, 200, `GET /api/admin/me failed: ${res.raw}`);
    assert.equal(res.body.tier, 'owner', `not the expected member's payload: ${res.raw}`);

    assert.ok(
      res.body.branding && typeof res.body.branding === 'object',
      `GET /api/admin/me returned no branding block — the admin panel has no other ` +
      `session-derived source for contractor identity (D-H). Got: ${res.raw}`
    );
    // Tenant A has NO contractor_settings row, so this value can only have come
    // from the resolver's three-step chain falling back to contractors.name.
    // Anything else — a platform default, or another tenant's name — is the bug.
    assert.equal(res.body.branding.companyName, COMPANY_A, `wrong tenant's company name: ${res.raw}`);
  });

  it('[RED] two tenants receive DIFFERENT branding blocks', async () => {
    // ── THE ASSERTION THAT CANNOT PASS AGAINST A HARDCODED BLOCK ─────────────
    // "branding exists" is satisfied by a constant. Two sessions, two tenants,
    // two distinguishable answers is not.
    const tokenA = await session(TENANT_A_ID, ownerA);
    const tokenB = await session(TENANT_B_ID, ownerB);

    const resA = await httpRequest(port, 'GET', ME_PATH, tokenA);
    const resB = await httpRequest(port, 'GET', ME_PATH, tokenB);

    assert.equal(resA.status, 200, `GET /api/admin/me failed for tenant A: ${resA.raw}`);
    assert.equal(resB.status, 200, `GET /api/admin/me failed for tenant B: ${resB.raw}`);

    assert.equal(resA.body.branding.companyName, COMPANY_A, `tenant A got the wrong name: ${resA.raw}`);
    assert.equal(resB.body.branding.companyName, COMPANY_B, `tenant B got the wrong name: ${resB.raw}`);

    // Not only the name. Tenant B is fully branded in the DB and tenant A has no
    // row at all, so every one of these differs for a different reason: a saved
    // value against a defaulted one, and a saved value against a null one.
    assert.equal(resB.body.branding.primaryColor, TENANT_B_BRAND.primary_color, `tenant B lost its saved colour: ${resB.raw}`);
    assert.equal(resB.body.branding.logoUrl, TENANT_B_BRAND.logo_url, `tenant B lost its saved logo: ${resB.raw}`);
    assert.equal(resA.body.branding.logoUrl, null, `tenant A was given a logo it never uploaded: ${resA.raw}`);
    assert.notEqual(
      resA.body.branding.primaryColor, resB.body.branding.primaryColor,
      'both tenants received the same primary colour — the block is not tenant-resolved'
    );

    // And nothing of B's reached A. The full-payload sweep, not one field.
    for (const value of Object.values(TENANT_B_BRAND)) {
      assert.equal(
        resA.raw.includes(value), false,
        `tenant A's /me payload contains tenant B's ${JSON.stringify(value)}: ${resA.raw}`
      );
    }
  });

  it('[RED] a member with NO permissions — and specifically not \'branding\' — still receives it', async () => {
    // ── THE TEST THAT PROVES D-H'S REASONING RATHER THAN RESTATING IT ────────
    // /api/admin/settings was rejected as the delivery path because it is gated
    // on 'branding'. Without this test that rejection is an assertion in a
    // document; with it, the two endpoints are compared on the same session.
    const token = await session(TENANT_A_ID, noPermsA);

    // NON-VACUITY, AND IT RUNS FIRST: prove this member genuinely lacks the
    // permission. If they held it, "they still got branding" would be trivially
    // true and would prove nothing about low-permission tiers at all.
    const gated = await httpRequest(port, 'GET', SETTINGS_PATH, token);
    assert.equal(
      gated.status, 403,
      `fixture error: this member reached the branding-gated endpoint, so they are not ` +
      `the low-permission case this test exists for. Got ${gated.status}: ${gated.raw}`
    );

    const res = await httpRequest(port, 'GET', ME_PATH, token);
    assert.equal(res.status, 200, `GET /api/admin/me refused a zero-permission member: ${res.raw}`);
    assert.deepEqual(res.body.permissions, {}, `not the zero-permission member's payload: ${res.raw}`);
    assert.ok(
      res.body.branding && res.body.branding.companyName === COMPANY_A,
      `a member without 'branding' received no contractor identity — their panel would show ` +
      `the platform's, which is the failure D-H was raised to prevent. Got: ${res.raw}`
    );
  });

  it('[RED] the branding block carries NO slug and NO contractor_id (CD-24 R1)', async () => {
    const token = await session(TENANT_A_ID, ownerA);
    const res = await httpRequest(port, 'GET', ME_PATH, token);

    assert.equal(res.status, 200, `GET /api/admin/me failed: ${res.raw}`);
    assert.ok(res.body.branding, `no branding block to inspect: ${res.raw}`);

    // ASSERTED ON THE RESPONSE, NOT ON THE RESOLVER'S OUTPUT. loadContractorBranding
    // re-attaches the slug for its landing-page callers (landingResolve.js:113), so
    // testing the resolver would prove the opposite of what is required here.
    for (const key of ['slug', 'contractor_id', 'contractorId', 'id']) {
      assert.equal(
        key in res.body.branding, false,
        `the branding block carries '${key}'. Tenancy is already proven by the session here; ` +
        `echoing an identifier back adds a disclosure without adding a capability. Got: ${res.raw}`
      );
      assert.equal(
        key in res.body, false,
        `the /me payload carries a top-level '${key}': ${res.raw}`
      );
    }

    // The values, not only the keys — a slug reachable under any other name is the
    // same disclosure. Both fixture slugs, so a cross-tenant echo fails too.
    assert.equal(res.raw.includes(SLUG_A), false, `the payload echoes the caller's slug: ${res.raw}`);
    assert.equal(res.raw.includes(SLUG_B), false, `the payload echoes another tenant's slug: ${res.raw}`);
    assert.equal(res.raw.includes(TENANT_A_ID), false, `the payload echoes the caller's contractor id: ${res.raw}`);
  });

  it('[RED] ⚠ FAIL SOFT — branding resolution failing still returns 200 with permissions intact', async () => {
    // ── PERMISSIONS ARE LOAD-BEARING; BRANDING IS DECORATION ─────────────────
    // A contractor whose branding cannot be resolved must get an UNBRANDED
    // WORKING panel, never a dead one. Without the wrapper this proves, one
    // malformed row would 500 /me — and /me is what supplies tier and
    // permissions, so PermissionGate would fail closed on every section at once
    // and the whole panel would render as locked.
    //
    // ⚠ THE FAILURE IS FORCED AT THE SCHEMA, deliberately. Deleting the
    // contractors row makes the resolver return NULL, which needs no catch at
    // all — that variant would go green with the wrapper removed and would
    // guard nothing. Renaming a column the resolver's SELECT names produces a
    // real 42703 from inside the try block, which is the only thing the catch
    // can be proven against.
    //
    // RESTORED IN `finally` so the schema is byte-identical afterwards. The
    // suite runs --test-concurrency=1, so no other file can observe the window.
    const token = await session(TENANT_A_ID, ownerA);

    await pool.query('ALTER TABLE contractor_about RENAME COLUMN google_place_id TO google_place_id__2b_broken');
    let res;
    try {
      res = await httpRequest(port, 'GET', ME_PATH, token);
    } finally {
      await pool.query('ALTER TABLE contractor_about RENAME COLUMN google_place_id__2b_broken TO google_place_id');
    }

    assert.equal(
      res.status, 200,
      `branding resolution failing took the whole /me response down with it. The panel needs ` +
      `tier and permissions to function; it does not need a logo. Got ${res.status}: ${res.raw}`
    );
    assert.equal(res.body.tier, 'owner', `the permissions payload did not survive: ${res.raw}`);
    assert.deepEqual(res.body.permissions, {}, `the permissions payload did not survive: ${res.raw}`);
    assert.equal(res.body.email, 'owner@alpha.test.invalid', `the identity payload did not survive: ${res.raw}`);

    // OMITTED, NOT NULLED, and not a half-built object. The client draws the
    // lockup from the block's presence (D-I: absent logo is a designed state).
    assert.equal(
      'branding' in res.body, false,
      `a failed resolution left a branding key behind — the client cannot tell "unresolved" ` +
      `from "resolved to nothing". Got: ${res.raw}`
    );
  });

  it('[RED] the fail-soft path is genuinely exercised — the forced failure really fails', async () => {
    // NON-VACUITY FOR THE TEST ABOVE. If the column rename did not actually break
    // the resolver's SELECT, that test would assert "200 with no branding" against
    // a request that succeeded and simply had nothing to return — passing for the
    // wrong reason, with the catch block never entered.
    const token = await session(TENANT_A_ID, ownerA);

    const healthy = await httpRequest(port, 'GET', ME_PATH, token);
    assert.ok(
      healthy.body.branding,
      `the control case has no branding either, so the forced-failure test proves nothing: ${healthy.raw}`
    );
  });
});
