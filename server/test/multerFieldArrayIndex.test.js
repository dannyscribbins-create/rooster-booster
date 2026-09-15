'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCY UPGRADE COMMIT 1 — multer 2.3.0 AND THE CONTROL THE BUMP DOES NOT
// TURN ON.
//
// ⚠ WHY THIS FILE EXISTS AT ALL. multer 2.3.0 fixes four advisories, and THREE
// of them are closed by the version alone. The fourth — GHSA-535w-7cp7-47q4
// (CVE-2026-82333) — is closed only by setting `limits.fieldArrayIndexLimit`,
// which 2.3.0 introduces as OPT-IN with a documented default of `Infinity`.
// `make-middleware.js` runs the check exclusively when the key is present
// (`hasOwnProperty`), so a codebase that upgrades and stops there is still
// vulnerable and `npm audit` reports clean. **A GREEN AUDIT SAYS NOTHING ABOUT
// WHETHER THE OPTION WAS SET, WHICH IS WHY THE OPTION NEEDS A TEST AND NOT A
// CHECKLIST TICK.**
//
// THE ATTACK, in one line: a field named `items[4294967294]` makes multer's
// `appendField` allocate a maximum-length sparse array, and a NON-NUMERIC
// sibling on the same base then converts it to an object by iterating the full
// length — synchronously. One Express process serves everything, so the event
// loop stalls for the walk.
// ⚠ IT IS A HANG, NOT A THROW. `server.js` registers an `uncaughtException`
// handler that does not exit; that handler is irrelevant here, and reasoning
// "we catch uncaught exceptions" would be answering a different advisory.
//
// ── ⚠ THE SAFETY CONSTRAINT THAT SHAPES EVERY CASE BELOW ────────────────────
// The real index (4294967294) may ONLY be sent to an instance that HAS the
// option, where the check fires before `appendField` and nothing is allocated.
// **Sending it to an instance WITHOUT the option would hang this test file**, so
// the unconfigured control uses a SMALL index instead. That still proves the
// point — the question a control has to answer is "is the option the thing doing
// the work", and a small index answers it without ever paying for the walk.
//
// ── ⚠ WHAT THIS FILE CANNOT SEE ─────────────────────────────────────────────
// It drives ONE of the three multer routes over real HTTP — `branding/logo`,
// because that route's fixture already exists and needs no campaign row. The
// campaigns instance is covered STRUCTURALLY (both instances are asserted to
// declare the option) rather than behaviourally. **That split is stated rather
// than discovered: a source assertion proves the option is written down, and
// only the HTTP case proves multer acts on it.**
//
// ⚠ EXPECTED COUNT: 13 cases, COUNTED WITH grep RATHER THAN ESTIMATED.
// ⚠ THE FIRST NUMBER WRITTEN HERE WAS 11, AND IT WAS AN ESTIMATE. It was LOW by
// two, which is the exact shape the prediction exists to catch — recorded rather
// than silently overwritten, because "I counted" and "I guessed and got lucky"
// look identical afterwards. A
// prediction that happens to be LOW is indistinguishable from a file that threw
// during import and contributed nothing to either column.
// ─────────────────────────────────────────────────────────────────────────────

// ── B2 INTERCEPTION — must run before app.js pulls in campaigns.js ───────────
// Same pattern and the same reason as logoUpload.test.js: nothing here may
// depend on credentials the test machine does not have, and the stub must not be
// able to stand in for "no answer".
process.env.B2_ENDPOINT              = 'https://s3.test.invalid';
process.env.B2_MEDIA_KEY_ID          = 'test-key-id';
process.env.B2_MEDIA_APPLICATION_KEY = 'test-application-key';
process.env.B2_MEDIA_BUCKET_NAME     = 'roofmiles-test-media';
process.env.B2_PUBLIC_URL_BASE       = 'https://cdn.test.invalid/roofmiles-test-media';

const s3Puts = [];
{
  const sdkPath = require.resolve('@aws-sdk/client-s3');
  const real = require('@aws-sdk/client-s3');
  // ⚠ THE DOUBLE THROWS ON A SHAPE IT DOES NOT RECOGNISE rather than returning
  // something plausible. A double that can also stand in for "no contract" is
  // indistinguishable from the failure, and that has bitten this repo three times.
  class PutObjectCommand {
    constructor(input) {
      if (!input || typeof input.Key !== 'string') {
        throw new Error('S3 double: PutObjectCommand got a shape it does not recognise: ' + JSON.stringify(input));
      }
      this.input = input;
    }
  }
  require.cache[sdkPath] = {
    id: sdkPath, filename: sdkPath, loaded: true, exports: Object.assign({}, real, {
      PutObjectCommand,
      S3Client: class {
        async send(cmd) {
          if (!(cmd instanceof PutObjectCommand)) {
            throw new Error('S3 double: send() got something that is not a PutObjectCommand');
          }
          s3Puts.push(cmd.input);
          return {};
        }
      },
    }),
  };
}

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const http = require('node:http');
const express = require('express');
const multer = require('multer');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

const LOGO_PATH = '/api/admin/branding/logo';
const TENANT_ID = 'tnt-mf1x-internal';
const COMPANY = 'Fieldname Roofing Co';

// A genuine 1x1 PNG — magic bytes matter, the route checks them.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

// ⚠ THE REAL ATTACK INDEX. 2**32 - 2 is the largest value a JS array length can
// take, which is what makes the sparse allocation maximal.
const ATTACK_INDEX = 4294967294;
// A small index used ONLY against the unconfigured control — see the safety note
// in the header.
const SMALL_INDEX = 5;

// ── MULTIPART ENCODER ───────────────────────────────────────────────────────
// Hand-rolled, matching logoUpload.test.js. ⚠ Not extracted to a shared helper
// in this commit: a relocation and a behaviour change in one diff cannot be
// reviewed, and this commit's subject is the upgrade.
function encodeMultipart(parts) {
  const boundary = '----RoofMilesFieldIdx' + crypto.randomBytes(8).toString('hex');
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

function post(port, pathname, parts, token) {
  const { boundary, body } = encodeMultipart(parts);
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = http.request({
      hostname: 'localhost', port, path: pathname, method: 'POST',
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
        resolve({ status: res.statusCode, body: parsed, raw, ms: Date.now() - started });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// The attack pair: a maximal numeric index, then a NON-NUMERIC sibling on the
// same base. ⚠ BOTH HALVES ARE REQUIRED — the numeric one allocates the sparse
// array and the sibling is what forces the full-length walk. A test sending only
// the first would pass against vulnerable code.
function attackParts(fileField, index) {
  return [
    { name: `items[${index}]`, data: Buffer.from('x', 'utf8') },
    { name: 'items[boom]', data: Buffer.from('y', 'utf8') },
    { name: fileField, filename: 'logo.png', contentType: 'image/png', data: PNG_1x1 },
  ];
}

// ── SOURCE FENCES (1.6) ─────────────────────────────────────────────────────
const SERVER = path.resolve(process.cwd(), 'server');
function read(rel) { return fs.readFileSync(path.resolve(SERVER, rel), 'utf8'); }
const ADMIN_SRC = read('routes/admin/index.js');
const CAMPAIGNS_SRC = read('routes/admin/campaigns.js');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.js$/.test(e.name)) out.push(p);
  }
  return out;
}
const SERVER_FILES = walk(SERVER);

describe('multer 2.3.0 — the option is the control, not the version', () => {
  let pool, server, port, ctlServer, ctlPort, ownerId;

  before(async () => {
    // ⚠ ONE POOL PER FILE, never one per describe. `initTestDb()` returns the
    // db.js pool SINGLETON, so a second teardown kills the pool a later suite is
    // about to use — which surfaces as CANCELLED tests, not failures.
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));

    // ── THE UNCONFIGURED CONTROL ────────────────────────────────────────────
    // A multer instance identical to the real ones EXCEPT that it omits
    // `fieldArrayIndexLimit`. ⚠ THIS IS THE GUARD-PROOF, MADE PERMANENT: without
    // it, every assertion below is satisfied by code that rejects the shape for
    // some other reason, and nothing would ever say so.
    const unconfigured = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });
    const ctlApp = express();
    ctlApp.post('/ctl', unconfigured.single('logo'), (req, res) => {
      res.json({ ok: true, bodyKeys: Object.keys(req.body || {}), hasFile: !!req.file });
    });
    // eslint-disable-next-line no-unused-vars
    ctlApp.use((err, req, res, next) => res.status(400).json({ code: err && err.code }));
    ({ server: ctlServer, port: ctlPort } = await startTestServer(ctlApp));

    await pool.query(`INSERT INTO contractors (id, name) VALUES ($1, $2)`, [TENANT_ID, COMPANY]);
    const hash = await bcrypt.hash('TestFieldIdx123!', 4);
    const { rows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, permissions)
       VALUES ($1, $2, $3, 'owner', '{}'::jsonb) RETURNING id`,
      [TENANT_ID, 'owner@fieldidx.test.invalid', hash]
    );
    ownerId = rows[0].id;
  });

  after(async () => {
    await stopTestServer(server);
    await stopTestServer(ctlServer);
    await pool.end();
  });

  beforeEach(async () => {
    s3Puts.length = 0;
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name, logo_url) VALUES ($1, $2, NULL)`,
      [TENANT_ID, COMPANY]
    );
  });

  async function session() {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at, role, contractor_id, team_member_id)
       VALUES (NULL, $1, NOW() + INTERVAL '1 hour', 'admin', $2, $3)`,
      [token, TENANT_ID, ownerId]
    );
    return token;
  }

  // ── NON-VACUITY, FIRST AND UNCONDITIONALLY ────────────────────────────────
  it('the sources were read and the installed multer is the fixed line', () => {
    assert.ok(ADMIN_SRC.length > 10000, 'admin/index.js read as suspiciously short');
    assert.ok(CAMPAIGNS_SRC.length > 10000, 'campaigns.js read as suspiciously short');
    assert.ok(SERVER_FILES.length > 50, 'the server walk returned too few files: ' + SERVER_FILES.length);
    // ⚠ READ FROM THE INSTALLED package.json, NEVER `npm ls` — this repo has
    // measured `npm ls` printing nanoid@3.3.18 while disk held 3.3.17.
    const installed = require('multer/package.json').version;
    const [maj, min] = installed.split('.').map(Number);
    assert.ok(maj > 2 || (maj === 2 && min >= 3),
      'multer must be >= 2.3.0 for fieldArrayIndexLimit to exist at all; installed ' + installed);
  });

  // ── 1. THE OPTION IS DECLARED AT BOTH CALL SITES ──────────────────────────
  it('both multer instances declare fieldArrayIndexLimit — neither covers the other', () => {
    assert.match(ADMIN_SRC, /fieldArrayIndexLimit:\s*LOGO_UPLOAD_LIMIT\.fieldArrayIndexLimit/,
      'the logo instance does not pass fieldArrayIndexLimit');
    assert.match(CAMPAIGNS_SRC, /fieldArrayIndexLimit:\s*CAMPAIGN_UPLOAD_FIELD_ARRAY_INDEX_LIMIT/,
      'the campaigns instance does not pass fieldArrayIndexLimit');
  });

  it('the logo bound is exported so the suite reads it rather than restating it', () => {
    const l = require('../routes/admin/index').LOGO_UPLOAD_LIMIT;
    assert.ok(l, 'admin/index.js must export LOGO_UPLOAD_LIMIT');
    assert.equal(typeof l.fieldArrayIndexLimit, 'number');
    // ⚠ DERIVED, NOT COPIED: no route this instance serves posts a bracketed
    // field name at all, so the largest index a real request needs is NONE.
    assert.equal(l.fieldArrayIndexLimit, 0,
      'the derived value is 0 — see the block at logoUpload for the derivation');
  });

  // ── 2. THE ATTACK SHAPE, OVER REAL HTTP, AGAINST THE REAL ROUTE ───────────
  it('the attack shape is REJECTED rather than walked', async () => {
    const token = await session();
    const res = await post(port, LOGO_PATH, attackParts('logo', ATTACK_INDEX), token);
    assert.equal(res.status, 400, 'the attack shape was not rejected: ' + res.raw);
    // ⚠ A NEGATIVE MUST SAY WHY IT WAS REFUSED, NOT ONLY THAT IT WAS. A 400 for
    // a missing file, a bad mime or an expired session reads identically here,
    // and each would leave the advisory live.
    assert.equal(s3Puts.length, 0, 'a rejected upload must not have reached storage');
  });

  it('and it is refused FAST — the walk never happens', async () => {
    const token = await session();
    const res = await post(port, LOGO_PATH, attackParts('logo', ATTACK_INDEX), token);
    assert.equal(res.status, 400);
    // The walk of a 2**32-2 sparse array takes many seconds. A generous ceiling:
    // the point is the order of magnitude, not a tuned number, and a threshold
    // that needs tuning twice is a threshold fitted to the failure.
    assert.ok(res.ms < 5000, 'the request took ' + res.ms + 'ms — that looks like the walk, not a rejection');
  });

  it('the numeric half ALONE is still rejected — the limit does not need the sibling', async () => {
    // The sibling is what triggers the WALK; the limit refuses the ALLOCATION.
    // Asserting this separately is what stops the fence being satisfied by
    // something that only notices the pair.
    const token = await session();
    const res = await post(port, LOGO_PATH, [
      { name: `items[${ATTACK_INDEX}]`, data: Buffer.from('x', 'utf8') },
      { name: 'logo', filename: 'logo.png', contentType: 'image/png', data: PNG_1x1 },
    ], token);
    assert.equal(res.status, 400, 'a lone oversized index was accepted: ' + res.raw);
    assert.equal(s3Puts.length, 0);
  });

  it('a SMALL over-limit index is rejected too — the limit is 0, not "very large"', async () => {
    // ⚠ WITHOUT THIS THE FENCE WOULD PASS AGAINST A LIMIT OF 1000000. The
    // measured behaviour must match the DERIVED value, not merely be tighter
    // than the attack.
    const token = await session();
    const res = await post(port, LOGO_PATH, [
      { name: `items[${SMALL_INDEX}]`, data: Buffer.from('x', 'utf8') },
      { name: 'logo', filename: 'logo.png', contentType: 'image/png', data: PNG_1x1 },
    ], token);
    assert.equal(res.status, 400, 'items[5] was accepted, so the limit is not 0: ' + res.raw);
  });

  // ── 3. GUARD-PROOF — THE SAME SHAPE IS ACCEPTED WITHOUT THE OPTION ────────
  it('GUARD-PROOF — an instance WITHOUT the option accepts the same field name', async () => {
    // ⚠ THE SMALL INDEX, DELIBERATELY. Sending 4294967294 to an unconfigured
    // instance is the actual denial of service and would hang this file.
    const res = await post(ctlPort, '/ctl', [
      { name: `items[${SMALL_INDEX}]`, data: Buffer.from('x', 'utf8') },
      { name: 'logo', filename: 'logo.png', contentType: 'image/png', data: PNG_1x1 },
    ]);
    assert.equal(res.status, 200,
      'the unconfigured control REJECTED the shape — then the real rejection proves nothing about the option: ' + res.raw);
    assert.deepEqual(res.body.bodyKeys, ['items'], 'the control should have parsed the bracket path');
    assert.equal(res.body.hasFile, true);
  });

  it('GUARD-PROOF — and the CONFIGURED route refuses that same small index', async () => {
    // The pair above and this line are the control and the subject on one shape.
    // ⚠ Either alone is satisfiable by something other than the option.
    const token = await session();
    const res = await post(port, LOGO_PATH, [
      { name: `items[${SMALL_INDEX}]`, data: Buffer.from('x', 'utf8') },
      { name: 'logo', filename: 'logo.png', contentType: 'image/png', data: PNG_1x1 },
    ], token);
    assert.equal(res.status, 400);
  });

  // ── 4. LEGITIMATE TRAFFIC STILL WORKS (1.5) ───────────────────────────────
  it('a REAL upload still succeeds, and the bytes reach storage', async () => {
    // ⚠ "NOTHING THREW" IS NOT THE ASSERTION. The row must be written and the
    // object must have been put, or a route that silently 200s with no effect
    // would pass.
    const token = await session();
    const res = await post(port, LOGO_PATH, [
      { name: 'logo', filename: 'logo.png', contentType: 'image/png', data: PNG_1x1 },
    ], token);
    assert.equal(res.status, 200, 'a legitimate upload was rejected: ' + res.raw);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.logo_url === 'string' && res.body.logo_url.length > 0);
    assert.equal(s3Puts.length, 1, 'the object was not put');
    const { rows } = await pool.query(
      'SELECT logo_url FROM contractor_settings WHERE contractor_id = $1', [TENANT_ID]);
    assert.equal(rows[0].logo_url, res.body.logo_url, 'the column was not written');
  });

  it('an UNBRACKETED extra text field is still accepted — the limit is not a field ban', async () => {
    // ⚠ A NEEDLE VALIDATED IN BOTH DIRECTIONS. A control that only rejects is
    // indistinguishable from one that rejects everything.
    const token = await session();
    const res = await post(port, LOGO_PATH, [
      { name: 'caption', data: Buffer.from('our logo', 'utf8') },
      { name: 'logo', filename: 'logo.png', contentType: 'image/png', data: PNG_1x1 },
    ], token);
    assert.equal(res.status, 200, 'a plain text field was refused: ' + res.raw);
  });

  // ── 5. THE TWO UNREACHABLE ADVISORIES STAY UNREACHABLE (1.6) ──────────────
  it('GHSA-qfvm needs diskStorage and GHSA-qvfw needs an async fileFilter — neither exists here', () => {
    // ⚠ THESE TWO ARE NOT REACHABLE TODAY, AND THIS FENCE IS WHAT STOPS A FUTURE
    // CHANGE RE-ARMING THEM SILENTLY. The version bump closes both; the fence is
    // about the NEXT multer advisory in the same families, which this repo
    // should not have to rediscover by reading an advisory twice.
    //
    // ⚠ NEEDLES VALIDATED IN BOTH DIRECTIONS FIRST — a needle that cannot match
    // makes an absence assertion permanently satisfied, which is worse than no
    // assertion because the name occupies the space real coverage would take.
    const DISK = /multer\.diskStorage|\bdiskStorage\s*\(/;
    const FILTER = /\bfileFilter\s*:/;
    assert.equal(DISK.test('const s = multer.diskStorage({})'), true, 'the diskStorage needle cannot match');
    assert.equal(DISK.test('multer.memoryStorage()'), false, 'the diskStorage needle fires on memoryStorage');
    assert.equal(FILTER.test('multer({ fileFilter: cb })'), true, 'the fileFilter needle cannot match');
    assert.equal(FILTER.test('// fileFilter is not used'), false, 'the fileFilter needle fires on prose');

    const diskHits = [], filterHits = [];
    for (const f of SERVER_FILES) {
      const src = fs.readFileSync(f, 'utf8');
      const rel = path.relative(process.cwd(), f).split(path.sep).join('/');
      if (rel.startsWith('server/test/')) continue;   // this file names both by necessity
      if (DISK.test(src)) diskHits.push(rel);
      if (FILTER.test(src)) filterHits.push(rel);
    }
    assert.deepEqual(diskHits, [],
      'diskStorage appeared — GHSA-qfvm (fd leak on aborted uploads) becomes reachable: ' + diskHits.join(', '));
    assert.deepEqual(filterHits, [],
      'a fileFilter appeared — GHSA-qvfw (async fileFilter race) becomes reachable; if it is SYNCHRONOUS say so here: '
      + filterHits.join(', '));
  });

  it('and both instances are still memoryStorage, which is what makes GHSA-qfvm inapplicable', () => {
    assert.match(ADMIN_SRC, /storage:\s*multer\.memoryStorage\(\)/);
    assert.match(CAMPAIGNS_SRC, /storage:\s*multer\.memoryStorage\(\)/);
  });
});
