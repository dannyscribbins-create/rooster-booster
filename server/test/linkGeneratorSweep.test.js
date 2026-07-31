'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-1 — STOP CHECKPOINT 2 RED SUITE — GENERATOR SWEEP
//
// Spec §4 requires a SWEEP, not a spot check: "Every re-pointed generator emits
// the new scheme; no generator still emits the old one."
//
// Two parts, by design:
//
//   PART A — STATIC. Walks the source tree and asserts zero surviving occurrences
//     of either legacy scheme. This is the exhaustive half: it catches a generator
//     nobody enumerated, including one added after this test was written.
//
//   PART B — LIVE. Boots the app and asserts the URLs actually emitted over HTTP.
//     This is the half that proves the replacement works, not just that the old
//     literal is gone.
//
// Two legacy schemes are in play (amendment A4):
//   Scheme A — https://leaksmith.com/refer?ref=<userId>&contractor=<contractorId>
//              Leaky. Wired to the Dashboard QR modal. C/DL-1 kills it.
//   Scheme B — ${FRONTEND_URL}?signup=<slug>
//              Opaque but not on roofmiles.com. C/DL-1 re-points it.
//
// Needle strings are assembled by concatenation so that this file never itself
// contains a literal the sweep is looking for.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { seedContractor, seedSession, startTestServer, stopTestServer } = require('./helpers');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TENANT_A = 'test-tenant-a';
const TABLE = 'contractor_invite_links';

// Assembled, never written literally — see header note.
const SCHEME_A_NEEDLE = 'leaksmith' + '.com/refer';
const SCHEME_B_NEEDLE = '?' + 'signup=';

// The one module permitted to construct an invite URL. Everything else must call
// its builder. Path is relative to the repo root, POSIX-separated.
const SHARED_BUILDER = 'server/utils/inviteTokens.js';

// Directories the sweep never descends into.
const SKIP_DIRS = new Set(['node_modules', 'build', 'dist', '.git', 'coverage', 'test']);

// Recursively collects .js/.jsx files under a directory.
function collectSourceFiles(absDir, acc = []) {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSourceFiles(path.join(absDir, entry.name), acc);
    } else if (/\.jsx?$/.test(entry.name)) {
      acc.push(path.join(absDir, entry.name));
    }
  }
  return acc;
}

// Every scannable source file in server/ and src/, as repo-relative POSIX paths.
function sweepTargets() {
  const files = [
    ...collectSourceFiles(path.join(REPO_ROOT, 'server')),
    ...collectSourceFiles(path.join(REPO_ROOT, 'src')),
  ];
  return files.map(f => path.relative(REPO_ROOT, f).split(path.sep).join('/'));
}

function findNeedle(needle, { allow = [] } = {}) {
  const hits = [];
  for (const rel of sweepTargets()) {
    if (allow.includes(rel)) continue;
    const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    text.split('\n').forEach((line, i) => {
      if (line.includes(needle)) hits.push(`${rel}:${i + 1}  ${line.trim()}`);
    });
  }
  return hits;
}

// Runs fn with INVITE_LINK_BASE_URL set, then restores it. buildInviteUrl reads
// process.env at call time, so this flips the live endpoints to stage 2 without
// restarting the server. Restores in a finally so a failing assertion cannot leak
// the variable into the next test.
async function withTokenBase(fn, base = 'https://roofmiles.com') {
  const prev = process.env.INVITE_LINK_BASE_URL;
  process.env.INVITE_LINK_BASE_URL = base;
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env.INVITE_LINK_BASE_URL;
    else process.env.INVITE_LINK_BASE_URL = prev;
  }
}

function httpGet(port, urlPath, token) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path: urlPath, method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Asserts a URL satisfies the new scheme's ruled properties. Deliberately
// property-based rather than exact-shape — the precise path segment is not ruled
// until STOP 3, but CD-8 (roofmiles.com), DL opacity, and the Scheme A kill are.
function assertNewScheme(url, label) {
  assert.ok(url, `${label}: no URL emitted`);
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'https:', `${label}: must be https, got ${parsed.protocol}`);
  assert.ok(
    parsed.hostname === 'roofmiles.com' || parsed.hostname.endsWith('.roofmiles.com'),
    `${label}: host must be roofmiles.com or a subdomain; got ${parsed.hostname}`
  );
  assert.ok(!url.includes('leaksmith'), `${label}: Scheme A survives in ${url}`);
  assert.equal(parsed.searchParams.get('signup'), null, `${label}: Scheme B survives in ${url}`);
  assert.equal(parsed.searchParams.get('ref'), null, `${label}: leaks a raw user id`);
  assert.equal(parsed.searchParams.get('contractor'), null, `${label}: leaks a raw contractor id`);
}

// ── PART A — STATIC SWEEP ────────────────────────────────────────────────────

describe('C/DL-1 generator sweep — Part A, static source sweep', () => {
  it('[RED] no file constructs the Scheme A leaky referral URL', async () => {
    const hits = findNeedle(SCHEME_A_NEEDLE);
    assert.deepEqual(
      hits, [],
      `Scheme A survives — it leaks a raw userId and contractorId in the URL:\n${hits.join('\n')}`
    );
  });

  it('[RED] no file outside the shared builder constructs a Scheme B signup URL', async () => {
    const hits = findNeedle(SCHEME_B_NEEDLE, { allow: [SHARED_BUILDER] });
    assert.deepEqual(
      hits, [],
      `Scheme B URL construction survives outside ${SHARED_BUILDER}:\n${hits.join('\n')}`
    );
  });

  it('[RED] the shared invite-URL builder module exists and exports buildInviteUrl', async () => {
    const abs = path.join(REPO_ROOT, SHARED_BUILDER);
    assert.ok(fs.existsSync(abs), `${SHARED_BUILDER} does not exist`);
    const mod = require('../utils/inviteTokens');
    assert.equal(typeof mod.buildInviteUrl, 'function', 'buildInviteUrl must be exported');
  });

  it('[RED] every known generator call site routes through the shared builder', async () => {
    // The four server-side emission points found by Phase 0 grep. Part A's needle
    // sweep proves the OLD scheme is gone; this proves each site adopted the NEW
    // one rather than inventing a third.
    const GENERATOR_FILES = [
      'server/routes/referrer.js',        // /api/referrer/qr-code + /api/referrer/my-invite-link
      'server/routes/admin/index.js',     // POST + GET /api/admin/invite-links
      'server/cron/jobs/postJobSequence.js', // T+24h welcome CTA
    ];
    const missing = GENERATOR_FILES.filter(rel => {
      const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      return !text.includes('buildInviteUrl');
    });
    assert.deepEqual(missing, [], `these generators do not call buildInviteUrl: ${missing.join(', ')}`);
  });

  it('[GREEN-by-design] no React component constructs an invite URL client-side', async () => {
    // Today the frontend only renders server-emitted fullUrl values. That property
    // must survive the re-point — a client-built URL cannot be server-side
    // contractor-derived, which is the whole point of the token scheme.
    const clientHits = sweepTargets()
      .filter(rel => rel.startsWith('src/'))
      .flatMap(rel => {
        const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
        return text.includes('roofmiles.com/') ? [rel] : [];
      });
    assert.deepEqual(clientHits, [], `client-side invite URL construction found in: ${clientHits.join(', ')}`);
  });
});

// ── PART B — LIVE EMISSION SWEEP ─────────────────────────────────────────────

describe('C/DL-1 generator sweep — Part B, live emission', () => {
  let pool, server, port;
  let referrerToken, referrerUserId;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM ${TABLE}`);
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractors');
    await seedContractor(pool, TENANT_A);

    const u = await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ('Sweep Referrer', 'sweep@test.com', 'x', $1, true) RETURNING id`,
      [TENANT_A]
    );
    referrerUserId = u.rows[0].id;
    referrerToken = crypto.randomBytes(32).toString('hex');
    await seedSession(pool, {
      userId: referrerUserId, token: referrerToken, role: 'referrer', contractorId: TENANT_A,
    });
  });

  it('[RED] GET /api/referrer/my-invite-link emits the new scheme', async () => {
    // STAGE 2 (D3) — declares which stage it tests. INVITE_LINK_BASE_URL gates
    // both domain and path shape; unset, these endpoints emit the legacy shape
    // that production runs until the C/DL-2 landing page serves /i/:slug.
    await withTokenBase(async () => {
      const res = await httpGet(port, '/api/referrer/my-invite-link', referrerToken);
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assertNewScheme(res.body.fullUrl, 'my-invite-link');
    });
  });

  it('[RED] GET /api/referrer/qr-code emits the new scheme', async () => {
    // STAGE 2 (D3) — see note above.
    await withTokenBase(async () => {
      const res = await httpGet(port, '/api/referrer/qr-code', referrerToken);
      assert.equal(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      // The endpoint returns only a data-URL image today. Post-re-point it must also
      // return the URL the QR encodes, so the emitted scheme is assertable at all.
      assertNewScheme(res.body.fullUrl, 'qr-code');
    });
  });

  it('[interim] a slug round-trips through /api/invite/:slug unchanged', async () => {
    // STAGE 1 — the shape production actually serves for the whole C/DL-1 →
    // C/DL-2 gap. The SPA reads ?signup=<slug> (src/App.js:58-59) and hands that
    // slug straight to /api/invite/:slug (src/App.js:82). If the emitted slug and
    // the resolvable slug ever diverge, every invite link in the wild breaks.
    const linkRes = await httpGet(port, '/api/referrer/my-invite-link', referrerToken);
    assert.equal(linkRes.status, 200, `my-invite-link failed: ${JSON.stringify(linkRes.body)}`);

    const emitted = linkRes.body.fullUrl;
    assert.ok(emitted.includes('?signup='), `interim shape expected, got ${emitted}`);
    const slugFromUrl = new URL(emitted).searchParams.get('signup');
    assert.equal(slugFromUrl, linkRes.body.slug, 'the URL must carry the slug the endpoint reports');

    const inviteRes = await httpGet(port, `/api/invite/${slugFromUrl}`);
    assert.equal(inviteRes.status, 200, `invite lookup failed: ${JSON.stringify(inviteRes.body)}`);
    assert.equal(inviteRes.body.valid, true, 'the emitted slug must resolve');
    assert.equal(inviteRes.body.contractorId, TENANT_A, 'and resolve to the right tenant');
  });

  it('[RED] no referrer-facing surface hands out a Scheme A URL', async () => {
    // my-invite-link returns fullUrl as plaintext, so a substring check is valid
    // there. qr-code returns only a base64 PNG — the encoded URL is inside the
    // image, invisible to substring checks — so it is proven by re-encoding the
    // legacy URL with the same already-installed `qrcode` package and asserting
    // the served bytes differ.
    const QRCode = require('qrcode');

    const linkRes = await httpGet(port, '/api/referrer/my-invite-link', referrerToken);
    const linkSerialized = JSON.stringify(linkRes.body || '');
    assert.ok(!linkSerialized.includes('leaksmith'), 'my-invite-link still carries a leaksmith.com URL');
    assert.ok(
      !linkSerialized.includes(`ref=${referrerUserId}`),
      `my-invite-link leaks the raw userId ${referrerUserId}`
    );

    const qrRes = await httpGet(port, '/api/referrer/qr-code', referrerToken);
    const legacyPng = await QRCode.toDataURL(
      `https://leaksmith.com/refer?ref=${referrerUserId}&contractor=${TENANT_A}`
    );
    assert.notEqual(
      qrRes.body.qrCodeDataUrl, legacyPng,
      'the served QR still encodes the Scheme A leaksmith.com URL'
    );
  });
});
