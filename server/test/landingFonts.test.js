'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3d-2 — SELF-HOSTED WEBFONTS ON THE LANDING PAGE
//
// LP names Montserrat (display) and Roboto (body). This file pins that they are
// served from OUR origin, that the landing router permits exactly that and
// nothing more, and that the global CSP is not touched on the way.
//
// ── A CORRECTION THIS FILE ENCODES ──────────────────────────────────────────
// The 3d-2 GREEN report claimed Google Fonts were BLOCKED by our own CSP —
// "font-src inherits 'self'". That was wrong, and it is worth writing down
// rather than quietly fixing: helmet does not leave font-src to be inherited. It
// sets it explicitly to `'self' https: data:`. Read from the library, not from
// memory:
//
//   node -e "console.log(require('helmet').contentSecurityPolicy.getDefaultDirectives()['font-src'])"
//   [ "'self'", 'https:', 'data:' ]
//
// So remote webfonts would have loaded fine, and the self-hosting decision rests
// on what it always actually rested on — an external request and a third-party
// dependency on the product's most important first paint — not on a CSP failure.
//
// ── WHAT THAT MEANS FOR THE FENCE BELOW ─────────────────────────────────────
// The originally-specified fence, "the GLOBAL CSP does not permit font-src
// 'self'", CANNOT be written: it is false, and has been since helmet was added.
// The real, observable difference is the other way round, and it is a TIGHTENING:
//
//   global   font-src 'self' https: data:      (helmet's default, untouched)
//   landing  font-src 'self'                   (https: and data: dropped)
//
// That is a genuine difference, it is the difference the router actually makes,
// and removing the directive collapses it — which is what makes the probe below
// meaningful rather than decorative.
//
// GUARD-PROOF SITE: delete `'font-src': ["'self'"]` from the landing router's
// contentSecurityPolicy call and re-run. The landing assertions must go RED —
// the directive falls back to helmet's `'self' https: data:` — while the global
// assertions stay GREEN. Then restore.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');
const fs = require('fs');
const path = require('path');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

const TENANT = 'test-tenant-fonts';
const SLUG = 'zetaroofing';
const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;
const landingPath = slug => `/i/${slug}`;

// The faces the page declares, and the files that must back them. Named as
// literals rather than read from the CSS under test: an expectation derived from
// the code under test passes whatever that code does.
const FONT_FILES = [
  'montserrat-latin.woff2',
  'roboto-latin.woff2',
];
const FONT_DIR = path.join(__dirname, '..', 'public', 'fonts');

let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.93.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpGet(port, reqPath, { host = null } = {}) {
  const headers = { 'X-Forwarded-For': nextIp() };
  if (host) headers.Host = host;
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path: reqPath, method: 'GET', headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            csp: res.headers['content-security-policy'] || null,
            bytes: buf,
            raw: buf.toString('utf8'),
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// Pulls one directive out of a CSP header string. Returns null when absent, so
// "missing" and "empty" stay distinguishable — the distinction the probe needs.
function directive(csp, name) {
  if (!csp) return null;
  for (const part of csp.split(';')) {
    const trimmed = part.trim();
    if (trimmed === name || trimmed.startsWith(`${name} `)) {
      return trimmed.slice(name.length).trim();
    }
  }
  return null;
}

describe('C/DL-2 Phase 3d-2 — self-hosted webfonts', () => {
  let pool, server, port, tokenSlug;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // ORDER IS LOAD-BEARING — `titles` carries an FK to `contractors`. See the
    // identical note in landingStates.test.js.
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, 'Zeta Roofing Co', $2)`,
      [TENANT, SLUG]
    );
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name, app_display_name)
       VALUES ($1, 'Zeta Roofing Co', 'Zeta Advantage')`,
      [TENANT]
    );

    tokenSlug = `tok-fonts-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', true)`,
      [TENANT, tokenSlug]
    );
  });

  // ── 1. THE FILES ARE ACTUALLY SERVED ───────────────────────────────────────

  it('every declared font file is served from /static with 200 and font/woff2', async () => {
    // The break this catches is the one that costs nothing to make and shows up
    // only as the wrong typeface: a @font-face pointing at a path that 404s. The
    // page keeps rendering, the fallback stack keeps working, and nothing
    // anywhere reports a problem.
    for (const file of FONT_FILES) {
      const res = await httpGet(port, `/static/fonts/${file}`);

      assert.equal(res.status, 200, `/static/fonts/${file} must serve (got ${res.status})`);
      assert.match(
        String(res.headers['content-type']), /font\/woff2/,
        `${file} must be served as font/woff2, got: ${res.headers['content-type']}`
      );
      assert.ok(res.bytes.length > 1000, `${file} served ${res.bytes.length} bytes — that is not a font`);
    }
  });

  it('the served bytes are real woff2, not a renamed placeholder', async () => {
    // woff2 files begin with the signature 'wOF2' (0x774F4632). A .woff2 name on
    // a file that is not one fails silently in the browser: the face is discarded
    // and the fallback renders, which is indistinguishable from success unless
    // someone is looking at the typeface.
    for (const file of FONT_FILES) {
      const res = await httpGet(port, `/static/fonts/${file}`);
      assert.equal(res.status, 200, `precondition: ${file} must serve (got ${res.status})`);

      assert.equal(
        res.bytes.subarray(0, 4).toString('latin1'), 'wOF2',
        `${file} does not carry the woff2 signature — the browser will silently discard it`
      );
    }
  });

  it('the page declares each face against a file that exists on disk', async () => {
    // Ties the CSS to the filesystem in ONE direction that matters: every URL the
    // page asks for resolves to a real committed asset. The reverse direction —
    // an orphaned file nobody references — is harmless and deliberately not
    // pinned.
    const res = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG) });
    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);

    const urls = [...res.raw.matchAll(/url\(['"]?(\/static\/fonts\/[^'")]+)['"]?\)/g)].map(m => m[1]);
    assert.ok(urls.length > 0, 'the page must declare at least one self-hosted @font-face');

    for (const url of urls) {
      const onDisk = path.join(FONT_DIR, path.basename(url));
      assert.ok(fs.existsSync(onDisk), `the page requests ${url}, which does not exist at ${onDisk}`);
    }
  });

  // ── 2. THE FACES ARE DECLARED THE WAY THEY HAVE TO BE ──────────────────────

  it('both LP families are declared and carry font-display: swap', async () => {
    // swap is what makes the text paint immediately in the fallback face rather
    // than blocking on the download. Without it the default is `auto`, which in
    // every current browser means a block period — a blank headline on the screen
    // that has to earn a stranger's trust in about two seconds, on exactly the
    // bad driveway connection this page is built for.
    const res = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG) });
    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);

    // Split on @font-face so `swap` is asserted PER FACE. A single font-display
    // anywhere in the stylesheet would otherwise satisfy a document-wide search
    // while one of the two faces still blocked.
    const faces = res.raw.split('@font-face').slice(1);
    assert.equal(faces.length >= 2, true, `expected at least two @font-face blocks, found ${faces.length}`);

    for (const family of ['Montserrat', 'Roboto']) {
      const face = faces.find(f => f.includes(`'${family}'`));
      assert.ok(face, `LP names ${family}; no @font-face declares it`);
      assert.match(
        face.slice(0, face.indexOf('}')), /font-display:\s*swap/,
        `the ${family} face must carry font-display: swap`
      );
      assert.match(
        face.slice(0, face.indexOf('}')), /format\(['"]woff2['"]\)/,
        `the ${family} face must be woff2`
      );
    }
  });

  it('the fallback chain behind each face is the system UI font, never a serif default', async () => {
    // A face that fails to load — a 404, a truncated download, a subset miss —
    // must degrade to something CHOSEN. A bare `font-family:'Montserrat'` falls
    // back to the browser's default serif, so the failure mode is not "slightly
    // different sans" but Times New Roman on the contractor's headline.
    //
    // NON-VACUITY: the page's 200 and the presence of both family names are
    // asserted first, so this describes real declarations rather than a document
    // that names no fonts at all.
    const res = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG) });
    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);

    // The @font-face blocks are EXCLUDED before matching. Their own
    // `font-family:'Montserrat';` is the face's NAME, not a usage stack, and it
    // is correct for it to be bare — a fallback list there would be meaningless.
    // Only the places the page USES a family can carry a fallback chain, and
    // those are the only places worth asserting on.
    const usageCss = res.raw.replace(/@font-face\s*\{[^}]*\}/g, '');

    const stacks = [...usageCss.matchAll(/font-family:\s*'(Montserrat|Roboto)'([^;}]*)/g)];
    assert.ok(stacks.length > 0, 'precondition: the page must set font-family to the LP families');

    for (const [, family, rest] of stacks) {
      assert.ok(
        /system-ui|ui-sans-serif/.test(rest) && /sans-serif\s*$/.test(rest.trim()),
        `the ${family} stack must fall through to the system UI font and end at sans-serif, got: '${rest.trim()}'`
      );
    }
  });

  // ── 3. THE LANDING CSP PERMITS EXACTLY THIS AND NOTHING MORE ───────────────

  it('the landing CSP permits font-src \'self\' and drops https: and data:', async () => {
    // THE PROBE TARGET. Removing `'font-src': ["'self'"]` from the landing router
    // makes the directive fall back to helmet's default `'self' https: data:` —
    // which still contains 'self', so an assertion that only checked for 'self'
    // would stay green through the deletion and prove nothing. The two absence
    // checks are what actually fail.
    const res = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG) });

    assert.equal(res.status, 200, `precondition: the landing page must serve (got ${res.status})`);
    assert.ok(res.csp, 'precondition: the landing response must carry a CSP header');

    const fontSrc = directive(res.csp, 'font-src');
    assert.ok(fontSrc, `the landing CSP must carry a font-src directive, got: ${res.csp}`);

    assert.ok(
      fontSrc.includes("'self'"),
      `font-src must permit 'self' — every face on this page ships from server/public/fonts. Got: ${fontSrc}`
    );
    assert.equal(
      fontSrc.includes('https:'), false,
      `the landing font-src must DROP https:. Every face is self-hosted, and a remote font on the one ` +
      `page that interpolates contractor-controlled strings is a third-party dependency with no upside. Got: ${fontSrc}`
    );
    assert.equal(
      fontSrc.includes('data:'), false,
      `the landing font-src must DROP data:. Got: ${fontSrc}`
    );
  });

  it('the GLOBAL CSP font-src is untouched — the tightening is scoped to the landing router', async () => {
    // The counterweight, the same shape as the img-src and script-src fences in
    // landingCsp.test.js — but pointed the OTHER way. Those catch someone WIDENING
    // the global policy to make the landing page work. This one catches someone
    // NARROWING it: applying the landing router's font-src globally would break
    // any other surface that legitimately loads a remote or data: font, and it
    // would do so far from here.
    //
    // NON-VACUITY: the API route's 200 and the presence of its CSP header are both
    // asserted before the directive is read. A 404, or a helmet that had been
    // removed outright, would otherwise satisfy an equality check for entirely the
    // wrong reason.
    const res = await httpGet(port, '/api/invite/zz-no-such-token', { host: hostFor(SLUG) });

    assert.equal(res.status, 200, `precondition: the API route must answer (got ${res.status}: ${res.raw})`);
    assert.ok(res.csp, 'precondition: the API response must still carry a CSP header at all');

    assert.equal(
      directive(res.csp, 'font-src'), "'self' https: data:",
      `the GLOBAL font-src must stay at helmet's default "'self' https: data:" — the tightening belongs ` +
      `to the landing router only. Got: ${res.csp}`
    );
  });

  it('the landing page loads no font from a third-party origin', async () => {
    // The behavioural half of the CSP claim, and the one that survives a CSP
    // refactor: whatever the header says, the document itself must not reach for
    // fonts.googleapis.com or fonts.gstatic.com. A stylesheet <link> to Google
    // would be permitted by style-src's `https:` today, so the header alone does
    // not close this.
    //
    // NON-VACUITY: the page's 200 and its own self-hosted @font-face URLs are
    // asserted present first — this is a page that demonstrably loads fonts, and
    // loads them from here.
    const res = await httpGet(port, landingPath(tokenSlug), { host: hostFor(SLUG) });

    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
    assert.match(
      res.raw, /url\(['"]?\/static\/fonts\//,
      'precondition: the page must declare at least one self-hosted font URL'
    );

    for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com']) {
      assert.equal(
        res.raw.includes(host), false,
        `the landing page reaches for ${host} — every face must be self-hosted`
      );
    }
  });

  // ── 4. LICENSING ───────────────────────────────────────────────────────────

  it('every shipped family carries its OFL licence alongside it', async () => {
    // Both families are SIL Open Font License 1.1 — Roboto included, since its
    // 2024 relicensing from Apache 2.0. The OFL requires the licence to accompany
    // the font files wherever they are redistributed, and serving them from our
    // own origin IS redistribution. A missing licence is a real obligation
    // unmet, not a tidiness issue, and it is invisible until someone asks.
    for (const name of ['Montserrat-OFL.txt', 'Roboto-OFL.txt']) {
      const file = path.join(FONT_DIR, name);
      assert.ok(fs.existsSync(file), `${name} must ship beside the font files (SIL OFL 1.1 requires it)`);
      const text = fs.readFileSync(file, 'utf8');
      assert.match(
        text, /SIL Open Font License, Version 1\.1/,
        `${name} must be the actual OFL 1.1 text`
      );
    }
  });
});
