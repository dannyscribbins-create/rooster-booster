'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3c SUITE — THE BRANDING SAVE ROUND TRIP (API LAYER)
//
// WHAT THIS FILE IS FOR, stated up front because most of it is GREEN ON ARRIVAL
// and a reader who expects a RED suite will otherwise think it is broken.
//
// Phase 3c adds two controls to the admin Branding form: a logo uploader and a
// landing-background colour picker. Both write columns that PUT /api/admin/settings
// rewrites wholesale on every save, and the form saves by sending the GET payload
// merged with its form state. That is the landmine adminSettingsBranding.test.js
// already documented for landing_bg_color:
//
//   PUT is a FULL-ROW UPSERT. Every column in its parameter list is written on
//   every call, with an absent key mapping to NULL. So any column present in PUT
//   but missing from what the form sends back is DESTROYED the first time an
//   admin saves anything at all.
//
// logo_url is the same shape and must be proven INDEPENDENTLY, because the two
// columns fail for different reasons and a proof about one says nothing about the
// other. landing_bg_color's hazard was that it was missing from GET. logo_url's
// hazard is different and worse: it is written by a SEPARATE ENDPOINT
// (POST /api/admin/branding/logo) that the form's loaded payload knows nothing
// about, so the form's copy goes stale the instant a logo is uploaded.
//
// THE DIVISION OF LABOUR, because it decides where the fix belongs:
//
//   THIS FILE proves the API layer holds up its end — the upload writes, GET
//   surfaces the new URL, and a save built from a FRESH read preserves it. Those
//   pass on arrival and are a REGRESSION FENCE around the Phase 3c UI work, not
//   RED tests. They are reported as green-on-arrival rather than contorted into
//   false REDs.
//
//   THE CHARACTERISATION TEST at the bottom proves the API layer CANNOT defend
//   itself against a save built from a STALE read — that is correct full-row
//   upsert behaviour, not a bug to fix here. It is the reason the real RED test
//   for this hazard lives in src/components/admin/BrandingProfileSettings.test.jsx.
//
// NO LIVE BACKBLAZE. @aws-sdk/client-s3 is replaced in require.cache before
// anything that imports it loads — the same interception logoUpload.test.js uses.
//
// NO PRODUCTION CONTRACTOR ID LITERALS (house rule) — tenant ids are
// fixture-local.
// ─────────────────────────────────────────────────────────────────────────────

// ── B2 INTERCEPTION — must run before app.js pulls in campaigns.js ────────────

process.env.B2_ENDPOINT              = 'https://s3.test.invalid';
process.env.B2_MEDIA_KEY_ID          = 'test-key-id';
process.env.B2_MEDIA_APPLICATION_KEY = 'test-application-key';
process.env.B2_MEDIA_BUCKET_NAME     = 'roofmiles-test-media';
process.env.B2_PUBLIC_URL_BASE       = 'https://cdn.test.invalid/roofmiles-test-media';

const s3Puts = [];

const _s3Path = require.resolve('@aws-sdk/client-s3');
// Mirrors the FULL symbol set the codebase imports — campaigns.js takes
// S3Client/PutObjectCommand/DeleteObjectCommand, backup.js adds
// ListObjectsV2Command, restore-verify.js adds GetObjectCommand. A partial stub
// breaks those modules at require time rather than here, which is the
// silent-failure shape the mock rules warn about.
require.cache[_s3Path] = {
  id: _s3Path,
  filename: _s3Path,
  loaded: true,
  exports: {
    S3Client: class {
      async send(command) {
        if (command && command.__commandType === 'PutObject') s3Puts.push(command.input);
        return { ETag: '"test-etag"' };
      }
    },
    PutObjectCommand:     class { constructor(input) { this.input = input; this.__commandType = 'PutObject'; } },
    DeleteObjectCommand:  class { constructor(input) { this.input = input; this.__commandType = 'DeleteObject'; } },
    GetObjectCommand:     class { constructor(input) { this.input = input; this.__commandType = 'GetObject'; } },
    ListObjectsV2Command: class { constructor(input) { this.input = input; this.__commandType = 'ListObjectsV2'; } },
  },
};

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

const SETTINGS_PATH = '/api/admin/settings';
const LOGO_PATH     = '/api/admin/branding/logo';

const TENANT_A_ID = 'tnt-k4rt-internal';
const TENANT_B_ID = 'tnt-m9dq-internal';

const COMPANY_A = 'Alpha Roofing Co';
const COMPANY_B = 'Beta Roofing Co';

// Tenant B is the contamination source: fully branded, never touched by tenant A.
const TENANT_B_LOGO = 'https://cdn.test.invalid/beta/original-logo.png';
const TENANT_B_BG   = '#BBBBBB';

// A genuine 1×1 PNG, not random bytes — the endpoint validates magic bytes
// (detectImageMime, admin/index.js), so random bytes would be rejected for a
// reason that has nothing to do with what these tests are about.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

// ── TRANSPORT ────────────────────────────────────────────────────────────────

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

// Hand-rolled rather than pulling in a form-data package — the Dependency
// Management Standards forbid a new package for a use case a few lines of Node
// covers, and logoUpload.test.js already does exactly this.
function encodeMultipart(parts) {
  const boundary = '----RoofMilesTestBoundary' + crypto.randomBytes(8).toString('hex');
  const chunks = [];
  for (const part of parts) {
    let head = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename !== undefined) head += `; filename="${part.filename}"`;
    head += '\r\n';
    if (part.contentType) head += `Content-Type: ${part.contentType}\r\n`;
    head += '\r\n';
    chunks.push(Buffer.from(head, 'utf8'), part.data, Buffer.from('\r\n', 'utf8'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return { boundary, body: Buffer.concat(chunks) };
}

function httpUpload(port, token, { filename = 'logo.png', contentType = 'image/png', data = PNG_1x1 } = {}) {
  const { boundary, body } = encodeMultipart([{ name: 'logo', filename, contentType, data }]);
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path: LOGO_PATH, method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    req.write(body);
    req.end();
  });
}

describe('C/DL-2 Phase 3c — branding save round trip (logo + landing background)', () => {
  let pool, server, port;
  let ownerA, ownerB;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));

    const hash = await bcrypt.hash('TestRoundTrip123!', 4);   // rounds=4 for test speed

    for (const [id, name] of [[TENANT_A_ID, COMPANY_A], [TENANT_B_ID, COMPANY_B]]) {
      await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $2)`, [id, name]);
    }

    const mkMember = async (contractorId, email) => {
      const { rows } = await pool.query(
        `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
         VALUES ($1, $2, $3, 'owner', '{}') RETURNING id`,
        [contractorId, email, hash]
      );
      return rows[0].id;
    };

    ownerA = await mkMember(TENANT_A_ID, 'owner@alpha.test.invalid');
    ownerB = await mkMember(TENANT_B_ID, 'owner@beta.test.invalid');
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    s3Puts.length = 0;
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, logo_url, landing_bg_color)
       VALUES ($1, $2, NULL, NULL), ($3, $4, $5, $6)`,
      [TENANT_A_ID, COMPANY_A, TENANT_B_ID, COMPANY_B, TENANT_B_LOGO, TENANT_B_BG]
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
      `SELECT company_name, company_phone, logo_url, landing_bg_color
         FROM contractor_settings WHERE contractor_id = $1`,
      [contractorId]
    );
    return rows[0] || null;
  }

  // Uploads a logo and returns the URL the endpoint reported, having first proven
  // the upload genuinely succeeded. Every test below builds on this, so a silent
  // upload failure must surface HERE rather than as a confusing assertion three
  // steps later.
  async function uploadLogo(token) {
    const res = await httpUpload(port, token);
    assert.equal(res.status, 200, `logo upload failed: ${res.raw}`);
    assert.ok(res.body && res.body.logo_url, `the upload reported no logo_url: ${res.raw}`);
    assert.equal(s3Puts.length, 1, 'the upload did not reach storage — nothing was actually stored');
    return res.body.logo_url;
  }

  // ── 1. UPLOAD → GET ────────────────────────────────────────────────────────

  it('[GREEN-by-design] a logo upload followed by GET returns the new URL', async () => {
    // The first half of the round trip, and the precondition for everything
    // below: if GET does not surface the uploaded URL, the form can never send it
    // back and every preservation assertion in this file is vacuous.
    //
    // Green on arrival — logo_url is already in GET's column list
    // (admin/index.js:574). Pinned as a regression fence, because Phase 3c is
    // about to start writing that column from a second endpoint.
    const token = await session(TENANT_A_ID, ownerA);

    // Precondition: tenant A starts with no logo, so "GET returned a logo" cannot
    // be satisfied by a value that was already there.
    const before = await httpRequest(port, 'GET', SETTINGS_PATH, token);
    assert.equal(before.status, 200, `GET /api/admin/settings failed: ${before.raw}`);
    assert.equal(before.body.contractor_id, TENANT_A_ID, `not tenant A's payload: ${before.raw}`);
    assert.equal(before.body.logo_url, null, 'fixture error: tenant A already had a logo');

    const uploaded = await uploadLogo(token);

    const after = await httpRequest(port, 'GET', SETTINGS_PATH, token);
    assert.equal(after.status, 200, `GET /api/admin/settings failed: ${after.raw}`);
    assert.equal(after.body.contractor_id, TENANT_A_ID, `not tenant A's payload: ${after.raw}`);
    assert.equal(
      after.body.logo_url, uploaded,
      'GET does not surface the uploaded logo, so the Branding form can never send it back on save'
    );
  });

  // ── 2. UPLOAD → FRESH READ → MERGED SAVE ───────────────────────────────────

  it('[GREEN-by-design] a save built from a FRESH read preserves an uploaded logo', async () => {
    // The save shape the Branding form performs: the whole loaded GET payload,
    // with one unrelated field edited, PUT back. This is the landing_bg_color
    // landmine's exact shape applied to logo_url, and it is proven independently
    // rather than inferred from that column's proof — the two columns reach the
    // row by different routes and fail for different reasons.
    const token = await session(TENANT_A_ID, ownerA);
    const uploaded = await uploadLogo(token);

    const loaded = await httpRequest(port, 'GET', SETTINGS_PATH, token);
    // NON-VACUITY: the merged body below is built FROM this payload. If it does
    // not carry the uploaded URL, the PUT preserves nothing because there was
    // nothing to preserve, and the assertion at the end would pass for the wrong
    // reason entirely.
    assert.equal(
      loaded.body.logo_url, uploaded,
      'the loaded payload does not carry the uploaded logo — the round trip below cannot be exercised'
    );

    const merged = { ...loaded.body, company_phone: '555-0311' };
    const put = await httpRequest(port, 'PUT', SETTINGS_PATH, token, merged);
    assert.equal(put.status, 200, `PUT /api/admin/settings failed: ${put.raw}`);

    const row = await settingsRow(TENANT_A_ID);
    // NON-VACUITY: prove the save actually wrote. A PUT that 200'd but wrote
    // nothing would preserve the logo trivially and prove nothing about the upsert.
    assert.equal(row.company_phone, '555-0311', 'the PUT did not persist the edited field — nothing was saved');
    assert.equal(
      row.logo_url, uploaded,
      'saving an unrelated branding field wiped the uploaded logo'
    );
  });

  it('[GREEN-by-design] one merged save preserves an uploaded logo AND a landing background together', async () => {
    // BOTH NEW PHASE 3C COLUMNS IN ONE SAVE. Covered nowhere else: the
    // landing_bg_color landmine test predates the logo endpoint, and the logo
    // suite predates landing_bg_color reaching GET. The realistic admin session
    // sets a background, uploads a logo, then edits their phone number — and a
    // fix that rescued one column by special-casing it could still lose the other.
    const token = await session(TENANT_A_ID, ownerA);

    // Step 1: set the background through the NORMAL SAVE PATH, not a direct row
    // write — the phase brief asks specifically that the picker's value survives
    // the path an admin actually uses.
    const setBg = await httpRequest(port, 'PUT', SETTINGS_PATH, token, {
      company_name: COMPANY_A,
      landing_bg_color: '#0D0D0D',
    });
    assert.equal(setBg.status, 200, `PUT /api/admin/settings failed: ${setBg.raw}`);
    assert.equal(
      (await settingsRow(TENANT_A_ID)).landing_bg_color, '#0D0D0D',
      'the normal save path did not persist landing_bg_color'
    );

    // Step 2: upload a logo — a second endpoint writing the same row.
    const uploaded = await uploadLogo(token);

    // Step 3: reload and save an unrelated edit, exactly as the form does.
    const loaded = await httpRequest(port, 'GET', SETTINGS_PATH, token);
    assert.equal(loaded.status, 200, `GET /api/admin/settings failed: ${loaded.raw}`);
    assert.equal(loaded.body.logo_url, uploaded, 'GET lost the uploaded logo');
    assert.equal(loaded.body.landing_bg_color, '#0D0D0D', 'GET lost the saved landing background');

    const merged = { ...loaded.body, company_phone: '555-0312' };
    const put = await httpRequest(port, 'PUT', SETTINGS_PATH, token, merged);
    assert.equal(put.status, 200, `PUT /api/admin/settings failed: ${put.raw}`);

    const row = await settingsRow(TENANT_A_ID);
    assert.equal(row.company_phone, '555-0312', 'the PUT did not persist the edited field — nothing was saved');
    assert.equal(row.logo_url,         uploaded, 'the merged save wiped the uploaded logo');
    assert.equal(row.landing_bg_color, '#0D0D0D', 'the merged save wiped the landing background');
  });

  it('[GREEN-by-design] neither the upload nor the merged save touches another tenant', async () => {
    // Tenant B is fully branded throughout. Both writes in this file are keyed on
    // the SESSION-derived contractorId, and this is the test that says so.
    const tokenA = await session(TENANT_A_ID, ownerA);
    const uploaded = await uploadLogo(tokenA);

    const loaded = await httpRequest(port, 'GET', SETTINGS_PATH, tokenA);
    await httpRequest(port, 'PUT', SETTINGS_PATH, tokenA, { ...loaded.body, company_phone: '555-0313' });

    // NON-VACUITY: tenant A must have been written before "tenant B untouched"
    // means anything — a pair of no-op requests leaves both rows untouched.
    const rowA = await settingsRow(TENANT_A_ID);
    assert.equal(rowA.logo_url, uploaded, "tenant A's own write did not land — nothing is proven about tenant B");
    assert.equal(rowA.company_phone, '555-0313');

    const rowB = await settingsRow(TENANT_B_ID);
    assert.equal(rowB.logo_url,         TENANT_B_LOGO, "tenant A's logo upload overwrote tenant B's logo");
    assert.equal(rowB.landing_bg_color, TENANT_B_BG,   "tenant A's save changed tenant B's landing background");
    assert.equal(rowB.company_name,     COMPANY_B,     "tenant A's save changed tenant B's company name");
  });

  // ── 3. WHAT THE API CANNOT DEFEND ──────────────────────────────────────────

  it('[CHARACTERIZATION] a save built from a STALE read wipes the uploaded logo — the API cannot prevent this', async () => {
    // READ THIS BEFORE "FIXING" ANYTHING IT DESCRIBES. This test asserts the
    // CURRENT AND CORRECT behaviour of a full-row upsert, and it is here to name
    // where the real defect lives rather than to demand a server change.
    //
    // THE SEQUENCE, which is the ordinary admin session:
    //   1. open Branding      -> the form loads GET, logo_url is null
    //   2. upload a logo      -> a DIFFERENT endpoint writes logo_url
    //   3. edit the phone box -> the form's loaded copy still says null
    //   4. press Save         -> PUT writes logo_url = null. The logo is gone.
    //
    // The server behaved correctly at every step: it was TOLD to write null. No
    // server-side change can distinguish "the client means null" from "the
    // client's copy is stale" without inventing a partial-update protocol, which
    // is a much larger change than this phase and would break the landing_bg_color
    // guarantee that depends on the full-row semantics.
    //
    // THEREFORE THE FIX IS IN THE FORM, and its RED test is
    // 'a save after an upload sends the NEW logo_url, not the stale one' in
    // src/components/admin/BrandingProfileSettings.test.jsx. That test is the one
    // that must go green in Phase 3c. This one must keep passing unchanged.
    const token = await session(TENANT_A_ID, ownerA);

    // Step 1 — the form's initial load, BEFORE the upload.
    const staleLoad = await httpRequest(port, 'GET', SETTINGS_PATH, token);
    assert.equal(staleLoad.status, 200, `GET /api/admin/settings failed: ${staleLoad.raw}`);
    assert.equal(staleLoad.body.logo_url, null, 'fixture error: tenant A already had a logo');

    // Step 2 — the upload lands in the row the form is not watching.
    const uploaded = await uploadLogo(token);
    // NON-VACUITY: the logo must genuinely be in the row, or "it was wiped" below
    // would be indistinguishable from "it was never there".
    assert.equal(
      (await settingsRow(TENANT_A_ID)).logo_url, uploaded,
      'the upload did not reach the row — there is nothing for the stale save to destroy'
    );

    // Steps 3 and 4 — save the stale payload with one unrelated edit.
    const put = await httpRequest(port, 'PUT', SETTINGS_PATH, token, {
      ...staleLoad.body, company_phone: '555-0314',
    });
    assert.equal(put.status, 200, `PUT /api/admin/settings failed: ${put.raw}`);

    const row = await settingsRow(TENANT_A_ID);
    assert.equal(row.company_phone, '555-0314', 'the PUT did not persist the edited field — nothing was saved');
    assert.equal(
      row.logo_url, null,
      'the stale save did NOT wipe the logo. That is a behaviour change in PUT /api/admin/settings: ' +
      'it is no longer a full-row upsert. Re-verify the landing_bg_color preservation guarantee in ' +
      'adminSettingsBranding.test.js before accepting it, and update this characterisation deliberately'
    );
  });
});
