'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY DETAILS SAVE-WIPE — PHASE 1 RED SUITE
//
// THE BUG. PUT /api/admin/settings (admin/index.js:642-710) is a FULL-ROW UPSERT:
// its DO UPDATE SET clause assigns all 30 branding columns on every call, and a
// key absent from the request body arrives as undefined, which node-postgres
// binds as SQL NULL. The endpoint's contract is therefore "send back the whole
// GET payload merged with your edits" — which BrandingProfileSettings.jsx:349
// honours (it PUTs { ...fullSettingsRef.current, ...formData }).
//
// CompanyDetailsSettings.jsx DOES NOT. Its load effect copies only the 9 company
// fields out of the GET response and discards the rest (line 115-125), and its
// save handler PUTs that 9-key formData verbatim (line 202). So every save of the
// Company Details page NULLs the 20 branding columns listed in BRANDED below —
// the logo, every colour including the landing background, all five socials, the
// review block, both fonts, the app display name, the tagline, and the email
// sender name and footer. Blast radius: the public landing page, referrer app
// theming, and outbound email.
//
// WHY THIS IS NOT THE STALE-READ CASE. brandingSaveRoundTrip.test.js's
// characterisation test covers a payload that CONTAINS logo_url with the value
// null because the client's copy went stale — the server was told to write null
// and correctly did. That is a client bug the API cannot detect. THIS file is a
// different shape: the keys are ABSENT ENTIRELY. "The caller did not mention this
// column" and "the caller asked to clear this column" are distinguishable, and
// the third test below pins that distinction so a fix cannot buy preservation by
// breaking deliberate clearing.
//
// NON-VACUITY. Every preservation assertion is preceded by proof that the branding
// columns were genuinely populated before the request, and by proof that the PUT
// actually wrote something. Without the first, "still equal" would hold because
// there was nothing there; without the second, a PUT that 200'd and wrote nothing
// would preserve everything trivially.
//
// NO PRODUCTION CONTRACTOR ID LITERALS (house rule) — the tenant id is
// fixture-local.
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

const TENANT_ID = 'tnt-p7hs-internal';
const COMPANY   = 'Alpha Roofing Co';

// The 9 fields CompanyDetailsSettings.jsx holds in state, in its own order
// (EMPTY_FORM, line 43-46). This list IS the partial payload — the whole point of
// the suite is that nothing outside it is mentioned.
const COMPANY_COLUMNS = Object.freeze([
  'company_name', 'company_phone', 'company_email', 'company_url',
  'company_address', 'company_city', 'company_state', 'company_zip', 'company_country',
]);

// What the row holds before the save.
const SEEDED_COMPANY = Object.freeze({
  company_name:    COMPANY,
  company_phone:   '555-0100',
  company_email:   'contact@alpha.test.invalid',
  company_url:     'alpha.test.invalid',
  company_address: '1 Old Street',
  company_city:    'Oldtown',
  company_state:   'GA',
  company_zip:     '30301',
  company_country: 'US',
});

// What the admin types in and saves. Every value differs from SEEDED_COMPANY so
// that "the save landed" is decidable field by field.
const EDITED_COMPANY = Object.freeze({
  company_name:    'Alpha Roofing Company',
  company_phone:   '555-0200',
  company_email:   'hello@alpha.test.invalid',
  company_url:     'www.alpha.test.invalid',
  company_address: '2 New Avenue',
  company_city:    'Newtown',
  company_state:   'TN',
  company_zip:     '37201',
  company_country: 'CA',
});

// The 20 columns PUT /api/admin/settings writes that the Company Details payload
// never mentions. Named exhaustively rather than sampling: a fix that rescues the
// logo and the colours but drops the tagline and the email footer is still data
// loss, and a sampled test would call it green.
const BRANDED = Object.freeze({
  logo_url:           'https://cdn.test.invalid/alpha/logo.png',
  app_logo_url:       'https://cdn.test.invalid/alpha/app-logo.png',
  primary_color:      '#A1A1A1',
  secondary_color:    '#A2A2A2',
  accent_color:       '#A3A3A3',
  landing_bg_color:   '#A4A4A4',
  social_facebook:    'https://facebook.test.invalid/alpha',
  social_instagram:   'https://instagram.test.invalid/alpha',
  social_google:      'https://google.test.invalid/alpha',
  social_nextdoor:    'https://nextdoor.test.invalid/alpha',
  social_website:     'https://alpha.test.invalid',
  review_url:         'https://reviews.test.invalid/alpha',
  review_button_text: 'Review Alpha',
  review_message:     'Enjoying the rewards? Tell Alpha about it.',
  font_heading:       'Alpha Display',
  font_body:          'Alpha Text',
  app_display_name:   'Alpha Rewards',
  tagline:            'Refer a neighbour, earn with Alpha.',
  email_sender_name:  'Alpha Roofing Co',
  email_footer_text:  'Sent by Alpha Roofing Co.',
});

const BRANDING_COLUMNS = Object.freeze(Object.keys(BRANDED));

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

describe('Company Details partial save — PUT /api/admin/settings', () => {
  let pool, server, port;
  let owner;   // team_members.id

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));

    const hash = await bcrypt.hash('TestPartial123!', 4);   // rounds=4 for test speed

    await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $2)`, [TENANT_ID, COMPANY]);

    const { rows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, $2, $3, 'owner', '{}') RETURNING id`,
      [TENANT_ID, 'owner@alpha.test.invalid', hash]
    );
    owner = rows[0].id;
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  // A FULLY BRANDED ROW before every test. Column names come from the frozen
  // whitelists above and never from request data, so the interpolation below
  // cannot carry a user value into SQL; the values themselves are parameterised.
  // Built from the constants rather than hand-typed so the placeholder list can
  // never drift out of step with BRANDED.
  beforeEach(async () => {
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM contractor_settings');

    const cols   = ['contractor_id', ...COMPANY_COLUMNS, ...BRANDING_COLUMNS];
    const values = [
      TENANT_ID,
      ...COMPANY_COLUMNS.map(c => SEEDED_COMPANY[c]),
      ...BRANDING_COLUMNS.map(c => BRANDED[c]),
    ];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
    await pool.query(
      `INSERT INTO contractor_settings (${cols.join(', ')}) VALUES (${placeholders})`,
      values
    );
  });

  async function session() {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
      [token, TENANT_ID, owner]
    );
    return token;
  }

  // Explicit column list (never SELECT *), assembled from the same constants the
  // seed uses so the reader and the writer cannot disagree about the column set.
  async function settingsRow() {
    const cols = [...COMPANY_COLUMNS, ...BRANDING_COLUMNS].join(', ');
    const { rows } = await pool.query(
      `SELECT ${cols} FROM contractor_settings WHERE contractor_id = $1`,
      [TENANT_ID]
    );
    return rows[0] || null;
  }

  // Proves the fixture landed. Called at the top of every test, because every
  // assertion below is about a value CHANGING or NOT CHANGING, and neither is
  // meaningful if the value was never there.
  async function assertSeeded() {
    const row = await settingsRow();
    assert.ok(row, 'fixture error: no contractor_settings row was seeded');
    for (const col of BRANDING_COLUMNS) {
      assert.equal(
        row[col], BRANDED[col],
        `fixture error: ${col} was not seeded (got ${JSON.stringify(row[col])}) — ` +
        'a wipe of this column would be undetectable'
      );
    }
    return row;
  }

  // ══ THE RED TEST ═══════════════════════════════════════════════════════════

  it('[RED] a partial save of the 9 Company Details fields does not wipe the other 20 branding columns', async () => {
    const token = await session();
    await assertSeeded();

    // EXACTLY what CompanyDetailsSettings.handleSave sends: its 9-key formData and
    // nothing else. Not a merged GET payload — that path is already covered by
    // adminSettingsBranding.test.js and passes today.
    const put = await httpRequest(port, 'PUT', SETTINGS_PATH, token, EDITED_COMPANY);
    assert.equal(put.status, 200, `PUT ${SETTINGS_PATH} failed: ${put.raw}`);

    const row = await settingsRow();

    // NON-VACUITY: prove the save genuinely wrote. A PUT that 200'd but persisted
    // nothing would preserve all 20 branding columns for entirely the wrong reason.
    assert.equal(
      row.company_phone, EDITED_COMPANY.company_phone,
      'the PUT did not persist the edited company phone — nothing was saved, so nothing is proven'
    );

    // Reported as one list rather than 20 separate assertions so a failure names
    // every column that was lost, not just the first one.
    const wiped = BRANDING_COLUMNS
      .filter(col => row[col] !== BRANDED[col])
      .map(col => `${col}: ${JSON.stringify(BRANDED[col])} -> ${JSON.stringify(row[col])}`);

    assert.deepEqual(
      wiped, [],
      `saving the Company Details page destroyed ${wiped.length} branding column(s) that its payload ` +
      `never mentioned:\n  ${wiped.join('\n  ')}\n` +
      'PUT /api/admin/settings is a full-row upsert, so every column absent from the request body ' +
      'was written as NULL.'
    );
  });

  // ══ COMPANION GUARDS — pass now, and must still pass after the fix ══════════

  it('[GUARD] the same partial save DOES update all 9 company fields', async () => {
    // The other half of the requirement. A "fix" that ignored the payload
    // entirely, or that only applied a subset of the keys it was given, would
    // satisfy the RED test above and break the page it exists to repair.
    const token = await session();
    const before = await assertSeeded();

    // NON-VACUITY: every edited value must differ from what is already stored, or
    // "it was updated" is indistinguishable from "it was never touched".
    for (const col of COMPANY_COLUMNS) {
      assert.notEqual(
        before[col], EDITED_COMPANY[col],
        `fixture error: ${col} is already ${JSON.stringify(EDITED_COMPANY[col])} before the save`
      );
    }

    const put = await httpRequest(port, 'PUT', SETTINGS_PATH, token, EDITED_COMPANY);
    assert.equal(put.status, 200, `PUT ${SETTINGS_PATH} failed: ${put.raw}`);

    const row = await settingsRow();
    for (const col of COMPANY_COLUMNS) {
      assert.equal(
        row[col], EDITED_COMPANY[col],
        `the partial save did not persist ${col} — expected ${JSON.stringify(EDITED_COMPANY[col])}, ` +
        `got ${JSON.stringify(row[col])}`
      );
    }
  });

  it('[GUARD] a branding key present with an explicit null still clears that column', async () => {
    // THE LINE A FIX MUST NOT CROSS. Preservation must come from the key being
    // ABSENT, never from the value being null — an admin who empties their tagline
    // box and saves must get an empty tagline. A fix built on COALESCE, or on
    // "skip null values", would pass the RED test by making deliberate clearing
    // impossible, and this is the test that catches it.
    //
    // Two columns, not one, so the behaviour cannot be satisfied by special-casing
    // a single field. Both are also columns the RED test proves are otherwise
    // preserved, which is exactly the contrast being drawn.
    const token = await session();
    const before = await assertSeeded();
    assert.ok(before.tagline,          'fixture error: tagline was already empty — clearing it proves nothing');
    assert.ok(before.landing_bg_color, 'fixture error: landing_bg_color was already empty — clearing it proves nothing');

    const put = await httpRequest(port, 'PUT', SETTINGS_PATH, token, {
      ...EDITED_COMPANY,
      tagline: null,
      landing_bg_color: null,
    });
    assert.equal(put.status, 200, `PUT ${SETTINGS_PATH} failed: ${put.raw}`);

    const row = await settingsRow();

    // NON-VACUITY: prove the request was processed at all before reading anything
    // into the two nulls below.
    assert.equal(
      row.company_phone, EDITED_COMPANY.company_phone,
      'the PUT did not persist the edited company phone — nothing was saved, so nothing is proven'
    );

    assert.equal(row.tagline, null, 'an explicit tagline: null did not clear the column — deliberate clearing is broken');
    assert.equal(
      row.landing_bg_color, null,
      'an explicit landing_bg_color: null did not clear the column — deliberate clearing is broken'
    );
  });
});
