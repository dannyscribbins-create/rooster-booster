'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3d-1 RED SUITE — SERVER-OWNED STATIC ASSETS
//
// WHY THIS IS NEEDED AT ALL. Railway never builds the frontend. railway.json
// sets `buildCommand: "npm install"` — not `npm run build` — and `/build` is in
// .gitignore, so no CRA output exists on the Railway filesystem. `public/` is
// CRA's directory, consumed by react-scripts and deployed to Vercel; the Express
// process never sees it. `src/assets/images/*` is committed and physically
// present on disk, but it is only ADDRESSABLE through the webpack bundle, and
// reaching into src/ from server code crosses the architecture boundary
// CLAUDE.md draws.
//
// Phase 0 confirmed there is no express.static anywhere in server/ today. The
// server-rendered landing page needs the RoofMiles wordmark now and the two
// store badges later (A14), so it needs a static root of its own.
//
// PROPOSED CONTRACT — this file defines it; the implementation phase satisfies it.
//
//   server/public/            committed to git, server-owned, NOT CRA's public/
//   mounted at  /static       by express.static, inside createApp()
//   with caching              a Cache-Control max-age, not the bare default
//
// WHY /static AND NOT SOMETHING SHORTER. Phase 0 swept every mount in
// createApp(): /health, /webhooks, /api/webhooks, /api/*, /auth/jobber,
// /callback. Nothing owns /static and no router is mounted at a bare path that
// could shadow it. /i/ belongs to the landing page and /assets is close enough
// to CRA's own convention to be confusing later.
//
// PER-CONTRACTOR LOGOS STAY ON B2. This directory is for platform-owned artwork
// that ships with the code. A contractor logo is uploaded, tenant-scoped and
// mutable — putting it here would mean a deploy to change a logo.
//
// ── THE FIXTURE IS SELF-MANAGED, AND DELIBERATELY SO ────────────────────────
// This phase writes tests only, so it must not create the real wordmark asset —
// choosing its filename and format is the implementer's call. Instead each run
// writes its own throwaway file into server/public/, exercises the MECHANISM
// against it, and removes it in `after`. That keeps these tests independent of
// whatever the real assets end up being named, and means nothing is left behind.
//
// The directory itself is created if absent (git does not track empty
// directories, so an empty server/public/ left on disk is inert).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const fs = require('fs');
const path = require('path');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

// The contract under test.
const STATIC_MOUNT = '/static';
const STATIC_DIR = path.join(__dirname, '..', 'public');

// Throwaway fixture. The name is distinctive so it cannot collide with a real
// asset, and the extension drives the content-type assertion.
const FIXTURE_NAME = 'zz-test-fixture-wordmark.svg';
const FIXTURE_BODY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>fixture</title></svg>';

let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.87.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

// Sends the path EXACTLY as given — no URL normalisation, no re-encoding.
// That is load-bearing for the traversal tests: node:http would happily tidy a
// path built through the URL class, and a tidied `..` proves nothing.
function httpGetRaw(port, rawPath, { host = null } = {}) {
  const headers = { 'X-Forwarded-For': nextIp() };
  if (host) headers.Host = host;
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path: rawPath, method: 'GET', headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          raw: Buffer.concat(chunks).toString(),
        }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('C/DL-2 Phase 3d-1 — server-owned static assets', () => {
  let pool, server, port;
  let createdDir = false;

  before(async () => {
    if (!fs.existsSync(STATIC_DIR)) {
      fs.mkdirSync(STATIC_DIR, { recursive: true });
      createdDir = true;
    }
    fs.writeFileSync(path.join(STATIC_DIR, FIXTURE_NAME), FIXTURE_BODY, 'utf8');

    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
    try { fs.unlinkSync(path.join(STATIC_DIR, FIXTURE_NAME)); } catch { /* already gone */ }
    // Only remove the directory if this run created it, and only if it is empty —
    // never delete real assets someone has since added.
    if (createdDir) {
      try { fs.rmdirSync(STATIC_DIR); } catch { /* not empty, or in use — leave it */ }
    }
  });

  // ── 1. THE MOUNT EXISTS AND SERVES ─────────────────────────────────────────

  it('[RED] a file in server/public/ is served over HTTP with 200 and the right content type', async () => {
    const res = await httpGetRaw(port, `${STATIC_MOUNT}/${FIXTURE_NAME}`);

    assert.equal(
      res.status, 200,
      `express.static is not mounted at ${STATIC_MOUNT} (status ${res.status}). ` +
      'Phase 0 confirmed there is no express.static anywhere in server/ today.'
    );
    assert.equal(res.raw, FIXTURE_BODY, 'the served bytes must be the file\'s bytes');
    assert.match(
      String(res.headers['content-type']), /image\/svg\+xml/,
      `an .svg must be served as image/svg+xml, got: ${res.headers['content-type']}`
    );
  });

  it('[RED] static responses carry a caching header', async () => {
    // NON-VACUITY: the 200 is asserted first. A 404 carries no Cache-Control
    // either, so without this gate the assertion would be satisfied by the mount
    // simply not existing.
    //
    // The value is deliberately not pinned — max-age tuning is a judgment call.
    // What is pinned is that caching was configured at all, because the default
    // express.static behaviour is maxAge 0 and these assets are immutable
    // platform artwork on a first-touch marketing page.
    const res = await httpGetRaw(port, `${STATIC_MOUNT}/${FIXTURE_NAME}`);

    assert.equal(res.status, 200, `precondition: the asset must serve before its headers mean anything (got ${res.status})`);

    const cacheControl = res.headers['cache-control'];
    assert.ok(cacheControl, 'static assets must be served with a Cache-Control header');
    const maxAge = /max-age=(\d+)/.exec(String(cacheControl));
    assert.ok(maxAge, `Cache-Control must carry a max-age, got: ${cacheControl}`);
    assert.ok(
      Number(maxAge[1]) > 0,
      `max-age must be greater than zero — express.static defaults to 0, which is no caching at all (got: ${cacheControl})`
    );
  });

  it('[RED] a missing file under the static mount is a clean 404, not a crash', async () => {
    // NON-VACUITY: the sibling test above proves the mount exists and serves. Read
    // together, a 404 here means "this particular file is absent" rather than "the
    // mount does not exist". Read alone this test would pass against no mount at
    // all, which is exactly why it is not the only one.
    const ok = await httpGetRaw(port, `${STATIC_MOUNT}/${FIXTURE_NAME}`);
    assert.equal(ok.status, 200, 'precondition: the mount must be live for a 404 here to be meaningful');

    const res = await httpGetRaw(port, `${STATIC_MOUNT}/zz-no-such-asset-anywhere.svg`);

    assert.equal(res.status, 404, `a missing asset must 404, got ${res.status}`);
    assert.equal(res.status >= 500, false, 'a missing asset must never be a server error');
  });

  // ── 2. PATH TRAVERSAL ──────────────────────────────────────────────────────

  it('[RED] an encoded path-traversal attempt does not escape the static directory', async () => {
    // THE REAL TEST IS THE ENCODED FORM. A raw `../` is normalised away by the
    // router before express.static ever sees it, so a test using raw dots proves
    // nothing about the static layer. Percent-encoded separators survive
    // normalisation and are what an attacker actually sends.
    //
    // The targets are real files one and two levels above server/public/:
    // server/db.js and server/app.js. Both contain distinctive strings, so a
    // successful traversal is provable from the response body rather than
    // inferred from a status code.
    //
    // NON-VACUITY: the mount is proven live first. Against an unmounted /static
    // every one of these returns 404 and the test would pass while asserting
    // nothing about traversal at all.
    const ok = await httpGetRaw(port, `${STATIC_MOUNT}/${FIXTURE_NAME}`);
    assert.equal(ok.status, 200, 'precondition: the static mount must be live for traversal to be testable');

    const attempts = [
      `${STATIC_MOUNT}/..%2fdb.js`,
      `${STATIC_MOUNT}/%2e%2e%2fdb.js`,
      `${STATIC_MOUNT}/..%2f..%2fserver.js`,
      `${STATIC_MOUNT}/%2e%2e/%2e%2e/package.json`,
      `${STATIC_MOUNT}/..%5c..%5cpackage.json`,
      `${STATIC_MOUNT}/....//db.js`,
    ];

    for (const attempt of attempts) {
      const res = await httpGetRaw(port, attempt);

      assert.notEqual(
        res.status, 200,
        `path traversal succeeded for ${attempt} — it served something with a 200`
      );
      // Content assertions as well as the status, because a misconfigured mount
      // could serve a file with an unexpected status code.
      assert.equal(
        res.raw.includes('DATABASE_URL'), false,
        `path traversal for ${attempt} leaked database configuration`
      );
      assert.equal(
        res.raw.includes('createApp'), false,
        `path traversal for ${attempt} leaked server source`
      );
      assert.equal(
        res.raw.includes('"dependencies"'), false,
        `path traversal for ${attempt} leaked package.json`
      );
    }
  });

  it('[RED] a dotfile under the static root is not served', async () => {
    // Belt and braces. Nothing sensitive is planned for this directory, but a
    // static root that happily serves dotfiles is one stray copy of an env file
    // away from being a disclosure. express.static's `dotfiles: 'ignore'` is the
    // default; this pins that nobody turned it off.
    const dotName = '.zz-test-fixture-secret';
    fs.writeFileSync(path.join(STATIC_DIR, dotName), 'ZZ_SECRET_VALUE=hunter2', 'utf8');
    try {
      const ok = await httpGetRaw(port, `${STATIC_MOUNT}/${FIXTURE_NAME}`);
      assert.equal(ok.status, 200, 'precondition: the mount must be live');

      const res = await httpGetRaw(port, `${STATIC_MOUNT}/${dotName}`);

      assert.notEqual(res.status, 200, 'a dotfile under the static root must not be served');
      assert.equal(res.raw.includes('ZZ_SECRET_VALUE'), false, 'a dotfile\'s contents leaked');
    } finally {
      try { fs.unlinkSync(path.join(STATIC_DIR, dotName)); } catch { /* already gone */ }
    }
  });

  // ── 3. THE MOUNT DOES NOT SHADOW THE API ───────────────────────────────────

  it('[GREEN-by-design] the static mount does not shadow or intercept existing routes', async () => {
    // THE REGRESSION FENCE. express.static mounted carelessly — at '/' rather than
    // at a prefix, or ahead of the routers instead of alongside them — turns every
    // unmatched API path into a static-file miss. The failure is quiet: routes keep
    // 404ing, just for a different reason than before.
    //
    // Each assertion below names a route on a DIFFERENT router, so a mount that
    // swallowed one family of paths could not pass by luck.
    const health = await httpGetRaw(port, '/health');
    assert.equal(health.status, 200, 'GET /health must still answer 200');
    assert.match(health.raw, /"status"\s*:\s*"ok"/, 'GET /health must still return its JSON body');

    // referrer router — public, no auth, answers JSON on an unknown token.
    const invite = await httpGetRaw(port, '/api/invite/zz-no-such-token');
    assert.notEqual(invite.status, 404, 'GET /api/invite/:slug must still be routed (referrer router)');
    assert.match(
      invite.headers['content-type'] || '', /application\/json/,
      'GET /api/invite/:slug must still answer JSON, not a static-file miss'
    );

    // oauth router — a different mount entirely.
    const oauth = await httpGetRaw(port, '/auth/jobber');
    assert.notEqual(oauth.status, 404, 'GET /auth/jobber must still be routed (oauth router)');
  });

  it('[GREEN-by-design] the static mount does not intercept the API prefix it sits beside', async () => {
    // The specific miswiring this catches: mounting at '/' with server/public/ as
    // the root, which would make `/api/...` a static lookup first. Express would
    // fall through on a miss, so the symptom is subtle — a slower path and a
    // changed 404 shape — rather than an outright break.
    const res = await httpGetRaw(port, '/api/invite');

    assert.notEqual(res.status, 404, 'the marketing-mode route must still be reachable');
    assert.match(
      res.headers['content-type'] || '', /application\/json/,
      `/api/invite answered ${res.headers['content-type']} — the static mount is intercepting the API prefix`
    );
  });
});
