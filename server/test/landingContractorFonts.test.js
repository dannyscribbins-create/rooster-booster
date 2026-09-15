'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// THE LANDING PAGE'S FONTS — THE LAST SURFACE THAT IGNORED THEM
//
// ⚠ THE GAP. `loadContractorBranding()` was fixed to supply `font_heading` and
// `font_body`, so every surface now RECEIVES them. This page received them and
// threw them away: `PAGE_CSS` hardcoded 'Montserrat' and 'Roboto' and declared
// only those two faces. Verified against served bytes before this commit —
// a contractor stored as Playfair Display got a page containing zero
// occurrences of "Playfair".
//
// ⚠ AND IT IS THE PUBLIC ENTRY POINT. A contractor's typography reached every
// authenticated surface and not the one a stranger sees first.
//
// ── ⚠ WHY THE FACES CAN BE SERVED AT ALL, WHICH WAS THE REAL QUESTION ───────
// `font-src 'self'` is RULED on this router and is not widened here. This page
// is served by EXPRESS on Railway; the app's 25 woff2 files live in the repo's
// `public/fonts/` and are served to the SPA by Vercel — a different origin, and
// therefore unreachable under that CSP. `server/public/fonts/` held only two
// families.
// ⚠ THE FILES ARE ALREADY ON RAILWAY'S DISK. `public/fonts/` is tracked (40
// files) and Railway's build is `npm install` against a full checkout, so the
// fix is an express.static mount of a directory that is already there — NOT a
// 492 KB duplication of binary assets into `server/public/`, and not a build
// step. `/build` and `/dist` are gitignored; `public/` is not.
//
// ── ⚠ EVERY CASE SOURCES ITS VALUE FROM A REAL ROW ──────────────────────────
// Nothing is injected at any layer. That is the whole failure this sequence has
// been repairing: B.7's serif check set the family DOWNSTREAM of the gap and
// passed on a broken chain.
//
// ⚠ EXPECTED COUNT: 15 cases across 7 suites. Every `for` loop below sits
// inside an `it()` body and multiplies nothing.
// ⚠ COUNTED WITH `grep -c`; THE FIRST PASS PREDICTED 14. That is the FOURTH
// estimate-instead-of-count slip in this arc and the fourth that was LOW — the
// direction that matters, because a low prediction is indistinguishable from a
// suite that partly failed to register. The count is never written from the
// plan; it is written from the file.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');
const { BRANDING_THEME_DEFAULTS, FONT_STACKS } = require('../utils/brandingTheme');

const TENANT = 'landing-fonts-tenant';
const SLUG = 'zetafonts';

// ⚠ A SERIF AND A SANS, BOTH DIFFERENT FROM THE PLATFORM DEFAULTS. Montserrat
// and Roboto are what an unset contractor gets AND what Accent stores, so on
// them a correct wiring and a broken one emit identical bytes.
const STORED_HEADING = 'Playfair Display';
const STORED_BODY = 'Lato';

let pool;
let server;
let port;
let tokenSlug;

// ⚠ LAZY REQUIRE, so a missing module reports per-test instead of killing the
// file. A module-load failure surfaces as `suites 0` with the run still
// reporting a count — it reads like an ordinary failure and is not one.
function loadServerFontManifest() {
  let mod;
  try {
    mod = require('../utils/fontManifest');
  } catch (err) {
    assert.fail(
      `server/utils/fontManifest.js is not requirable (${err.code || err.message}). ` +
      'The landing page has no server-side face table yet.'
    );
  }
  assert.equal(typeof mod.fontFaceCss, 'function', 'must export fontFaceCss(family)');
  assert.ok(mod.FONT_FACES && typeof mod.FONT_FACES === 'object', 'must export FONT_FACES');
  return mod;
}

function httpGet(p, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = _httpRequest({ hostname: 'localhost', port, path: p, method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, raw: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

const hostFor = (s) => `${s}.roofmiles.com`;
const landingPath = (t) => `/i/${t}`;

/** Fetches the landing page for this tenant. Sources everything from the row. */
async function servedPage() {
  const res = await httpGet(landingPath(tokenSlug), { host: hostFor(SLUG) });
  assert.equal(res.status, 200, `the landing page must render (got ${res.status})`);
  return res.raw;
}

async function setFonts(heading, body) {
  await pool.query(
    `UPDATE contractor_settings SET font_heading = $2, font_body = $3 WHERE contractor_id = $1`,
    [TENANT, heading === undefined ? null : heading, body === undefined ? null : body]
  );
}

/** The usage CSS — @font-face blocks removed, so a face's own NAME cannot match. */
const usageOnly = (html) => html.replace(/@font-face\s*\{[^}]*\}/g, '');

before(async () => {
  pool = await initTestDb();
  const app = createApp();
  ({ server, port } = await startTestServer(app));
});

after(async () => {
  if (server) await stopTestServer(server);
  if (pool) await pool.end();
});

beforeEach(async () => {
  // ⚠ ORDER IS LOAD-BEARING — `titles` carries an FK to `contractors`, and so do
  // users/team_members/sessions. Copied from landingFonts.test.js, which states
  // the same thing. A shortened version of this chain failed every case in the
  // file with a foreign-key error, including the pure-arithmetic fixture case —
  // which is how a broken hook announces itself: EVERYTHING fails, including
  // what cannot depend on the database.
  await pool.query('DELETE FROM contractor_invite_links');
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM user_badges');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM team_members');
  await pool.query('DELETE FROM titles');
  await pool.query('DELETE FROM contractor_settings');
  await pool.query('DELETE FROM contractors');
  await pool.query(
    `INSERT INTO contractors (id, name, slug) VALUES ($1, 'Zeta Fonts Co', $2)`, [TENANT, SLUG]
  );
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, 'Zeta Fonts Co')`,
    [TENANT]
  );
  tokenSlug = `tok-lf-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  await pool.query(
    `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
     VALUES ($1, $2, 'contractor', true)`,
    [TENANT, tokenSlug]
  );
});

// ═══════════════════════════════════════════════════════════════════════════
describe('landing fonts — the fixture is real', () => {
  it('the fixture families are allowlisted and are NOT the platform defaults', () => {
    assert.ok(FONT_STACKS[STORED_HEADING]);
    assert.ok(FONT_STACKS[STORED_BODY]);
    assert.notEqual(STORED_HEADING, BRANDING_THEME_DEFAULTS.headingFont);
    assert.notEqual(STORED_BODY, BRANDING_THEME_DEFAULTS.bodyFont);
    assert.equal(FONT_STACKS[STORED_HEADING], 'serif', 'the heading fixture must be a serif');
    assert.equal(FONT_STACKS[STORED_BODY], 'sans-serif');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T1 — END TO END, FROM THE ROW, IN THE SERVED BYTES
// ═══════════════════════════════════════════════════════════════════════════
describe('T1 — the stored families reach the served page', () => {
  it('[RED] the served bytes contain the stored families', async () => {
    await setFonts(STORED_HEADING, STORED_BODY);
    const html = await servedPage();
    assert.ok(html.includes(STORED_HEADING), `the page never names ${STORED_HEADING}`);
    assert.ok(html.includes(STORED_BODY), `the page never names ${STORED_BODY}`);
  });

  it('[RED] it declares an @font-face for each stored family, at a servable URL', async () => {
    await setFonts(STORED_HEADING, STORED_BODY);
    const html = await servedPage();
    const faces = html.split('@font-face').slice(1);
    assert.ok(faces.length >= 2, `expected at least two @font-face blocks, found ${faces.length}`);
    for (const family of [STORED_HEADING, STORED_BODY]) {
      const face = faces.find((f) => f.includes(`font-family:'${family}'`));
      assert.ok(face, `no @font-face declares ${family}`);
      assert.ok(/font-display:\s*swap/.test(face), `${family}'s face lost font-display:swap`);
    }
    // ⚠ EVERY DECLARED URL MUST ACTUALLY SERVE. A face pointing at a 404 shows up
    // only as the wrong typeface — the failure the existing suite was built for.
    const urls = [...html.matchAll(/url\('([^']+\.woff2)'\)/g)].map((m) => m[1]);
    assert.ok(urls.length >= 2, 'the page declared no self-hosted faces');
    for (const u of urls) {
      const r = await httpGet(u);
      assert.equal(r.status, 200, `${u} must serve (got ${r.status})`);
    }
  });

  it('[RED] the page USES the stored families, not merely declares them', async () => {
    // ⚠ DECLARING A FACE PAINTS NOTHING. The usage CSS is where a family is
    // actually applied, and a page that declared Playfair and still used
    // Montserrat would satisfy the case above.
    await setFonts(STORED_HEADING, STORED_BODY);
    const usage = usageOnly(await servedPage());
    assert.ok(usage.includes(STORED_HEADING), `${STORED_HEADING} is declared but never used`);
    assert.ok(usage.includes(STORED_BODY), `${STORED_BODY} is declared but never used`);
    assert.ok(
      !/font-family:\s*'Montserrat'/.test(usage),
      'the page still hardcodes Montserrat in its usage CSS'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T2 — THE ALLOWLIST GOVERNS, AND THE CASE IS PAIRED
// ═══════════════════════════════════════════════════════════════════════════
describe('T2 — an off-allowlist value falls back', () => {
  it('[RED] a hostile value written straight to the column never reaches the CSS', async () => {
    // ⚠ THIS IS THE PAGE THE ALLOWLIST WAS ARGUED FOR: contractor-controlled text
    // interpolated into a style context on a public surface. The write goes
    // direct to the column, bypassing the endpoint's defence-in-depth check.
    // ⚠ A SENTINEL THE PAGE CANNOT ALREADY CONTAIN. A first draft asserted the
    // absence of `display:none` — which this page's own CSS carries FIVE TIMES,
    // so the assertion could never pass whatever the code did. A needle that
    // matches legitimate content is the same failure as one that matches prose.
    const HOSTILE = "ZZINJECTZZ'; } body { display:none } /*";
    await setFonts(HOSTILE, HOSTILE);
    const html = await servedPage();
    // ⚠ THE SENTINEL IS THE WHOLE ASSERTION, AND A STRUCTURAL ONE WAS TRIED AND
    // WITHDRAWN. `!/\}\s*body\s*\{/` looked like a good "did the payload close a
    // rule and open its own" check and matched the page's own `;}\nbody{` — the
    // second needle in this file to collide with legitimate content. A unique
    // sentinel cannot collide; a structural pattern over real CSS can.
    assert.ok(!html.includes('ZZINJECTZZ'), 'the hostile family name reached the stylesheet');
    // And the POSITIVE half: the rejected value is replaced by the platform
    // stack, not by nothing. An empty font-family is also "the payload absent".
    const usage = usageOnly(html);
    assert.ok(
      usage.includes(`'${BRANDING_THEME_DEFAULTS.headingFont}'`),
      'the rejected family was not replaced by the platform default'
    );
  });

  it('[RED] THE PAIR — the same column with an allowlisted value DOES arrive', async () => {
    // ⚠ WITHOUT THIS, THE CASE ABOVE PASSES AGAINST A PAGE THAT IGNORES THE
    // COLUMN ENTIRELY — which is precisely what it did before this commit, and
    // precisely what made the equivalent case vacuous one phase ago.
    // ⚠ A SENTINEL THE PAGE CANNOT ALREADY CONTAIN. A first draft asserted the
    // absence of `display:none` — which this page's own CSS carries FIVE TIMES,
    // so the assertion could never pass whatever the code did. A needle that
    // matches legitimate content is the same failure as one that matches prose.
    const HOSTILE = "ZZINJECTZZ'; } body { display:none } /*";
    await setFonts(HOSTILE, HOSTILE);
    const rejected = await servedPage();
    assert.ok(!rejected.includes('ZZINJECTZZ'));

    await setFonts(STORED_HEADING, STORED_BODY);
    const accepted = await servedPage();
    assert.ok(
      accepted.includes(STORED_HEADING),
      'the column is not read at all, so the rejection above was free'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T3 — ABSENCE IS THE PLATFORM DEFAULT, AND THE PAGE IS UNCHANGED FOR IT
// ═══════════════════════════════════════════════════════════════════════════
describe('T3 — an unset contractor gets the platform faces', () => {
  it('[RED] null, empty string and whitespace-only all give Montserrat/Roboto', async () => {
    for (const [label, v] of [['null', null], ['empty', ''], ['whitespace', '   ']]) {
      await setFonts(v, v);
      const html = await servedPage();
      assert.ok(html.includes("font-family:'Montserrat'"), `heading, ${label}`);
      assert.ok(html.includes("font-family:'Roboto'"), `body, ${label}`);
      assert.ok(!html.includes('Playfair'), `${label} leaked a family nobody stored`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T4 — THE PER-FAMILY GENERIC
// ═══════════════════════════════════════════════════════════════════════════
describe('T4 — every stack ends at a CHOSEN generic', () => {
  it('[RED] a serif family degrades to serif, a sans family to sans-serif', async () => {
    // ⚠ B.2. A serif falling back to sans-serif changes CATEGORY on font failure,
    // which is a worse failure than a different sans.
    // ⚠ THE STACK IS NOT `'X', <generic>` ON THIS PAGE, AND THAT IS DELIBERATE.
    // Two rulings meet here: the per-family generic (a serif must not degrade to
    // a sans), and this page's own rule that a failed face degrades to something
    // CHOSEN rather than to the browser default. So the chain is the family,
    // then a chosen list in its own category, ENDING at that category's generic.
    // Asserting `'X',\s*serif` would have been asserting the app's shape on a
    // page that deliberately has a richer one.
    await setFonts(STORED_HEADING, STORED_BODY);
    const usage = usageOnly(await servedPage());
    const valueOf = (prop) => {
      const m = new RegExp(`--brand-font-${prop}:([^;]+);`).exec(usage);
      assert.ok(m, `--brand-font-${prop} was not emitted`);
      return m[1].trim();
    };
    const heading = valueOf('heading');
    const body = valueOf('body');

    assert.ok(heading.startsWith(`'${STORED_HEADING}'`), `heading stack starts wrong: ${heading}`);
    assert.ok(body.startsWith(`'${STORED_BODY}'`), `body stack starts wrong: ${body}`);

    // ⚠ ANCHORED ON THE END, AND `serif` IS A SUFFIX OF `sans-serif` — so the
    // serif case must also assert the NEGATIVE, or a sans-serif ending would
    // satisfy it. The substring trap, in the one place it actually bites here.
    assert.ok(heading.endsWith('serif'), `heading must end at a generic: ${heading}`);
    assert.ok(!heading.endsWith('sans-serif'), `a SERIF family degraded to sans-serif: ${heading}`);
    assert.ok(body.endsWith('sans-serif'), `a SANS family must end at sans-serif: ${body}`);
  });

  it('[RED] and no usage names a family with NO generic behind it', async () => {
    // ⚠ THE LANDING PAGE'S ORIGINAL RULE, PRESERVED THROUGH THE CHANGE: a face
    // that fails to load must degrade to something CHOSEN, never to the
    // browser's default serif. A bare `font-family:'X';` is what that forbids.
    // ⚠ NOT "must end at sans-serif" — that was the correct encoding while both
    // families were sans, and it is wrong now that a serif is admissible.
    await setFonts(STORED_HEADING, STORED_BODY);
    const usage = usageOnly(await servedPage());
    const bare = [...usage.matchAll(/font-family:\s*'([^']+)'\s*[;}]/g)].map((m) => m[1]);
    assert.deepEqual(bare, [], `these usages name a family with no fallback: ${bare.join(', ')}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T5 — THE CSP IS UNCHANGED, AND THE FACES ARE REACHABLE UNDER IT
// ═══════════════════════════════════════════════════════════════════════════
describe('T5 — font-src self still holds', () => {
  it('[RED] the landing CSP still narrows font-src to self', async () => {
    await setFonts(STORED_HEADING, STORED_BODY);
    const res = await httpGet(landingPath(tokenSlug), { host: hostFor(SLUG) });
    const csp = res.headers['content-security-policy'] || '';
    const fontSrc = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('font-src'));
    assert.ok(fontSrc, 'the landing response set no font-src at all');
    assert.equal(fontSrc, "font-src 'self'", `font-src was widened: ${fontSrc}`);
  });

  it('[RED] every declared face is SAME-ORIGIN, so the CSP permits it', async () => {
    // ⚠ THE CSP AND THE URLS HAVE TO AGREE. A correct policy with a cross-origin
    // face is a page whose fonts silently do not load — the failure this pairing
    // exists to make impossible.
    await setFonts(STORED_HEADING, STORED_BODY);
    const html = await servedPage();
    const urls = [...html.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    assert.ok(urls.length > 0, 'no font URLs to check');
    for (const u of urls) {
      assert.ok(u.startsWith('/'), `font URL must be same-origin and root-relative, got ${u}`);
      assert.ok(!/^https?:/i.test(u), `third-party font origin: ${u}`);
    }
    assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html), 'a Google font reference survived');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T6 — THE ASSET SET, AND THE REST OF THE PAGE
// ═══════════════════════════════════════════════════════════════════════════
describe('T6 — every family is servable, and nothing else moved', () => {
  it('[RED] every allowlisted family has a face table entry whose file exists on disk', async () => {
    // ⚠ THE GAP THAT MADE THIS PHASE NON-TRIVIAL. A family a contractor can pick
    // whose woff2 is not reachable from THIS origin renders as the fallback with
    // nothing logged. Checked for all 14, not just the two in the fixture.
    const { FONT_FACES } = loadServerFontManifest();
    const missing = [];
    for (const family of Object.keys(FONT_STACKS)) {
      const faces = FONT_FACES[family];
      if (!faces) { missing.push(`${family} (no table entry)`); continue; }
      for (const { file } of faces) {
        const r = await httpGet(`/static/fonts/${file}`);
        if (r.status !== 200) missing.push(`${family} -> /static/fonts/${file} (${r.status})`);
      }
    }
    assert.deepEqual(missing, [], 'families a contractor can pick but this page cannot serve:\n' + missing.join('\n'));
  });

  it('[RED] the server face table agrees with the app manifest', async () => {
    // ⚠ A MIRROR, AND MIRRORS DRIFT. brandingTheme.js/.mjs and themeTokens.js/.mjs
    // are the established precedent; this pins the third pair rather than
    // trusting it. Compared by reading BOTH, not by restating either.
    const server = loadServerFontManifest();
    const app = await import('../../src/constants/fontManifest.mjs');
    assert.deepEqual(
      Object.keys(server.FONT_FACES).sort(),
      Object.keys(app.FONT_FACES).sort(),
      'the two face tables name different families'
    );
    for (const family of Object.keys(app.FONT_FACES)) {
      assert.deepEqual(
        server.FONT_FACES[family], app.FONT_FACES[family],
        `${family}'s faces differ between the server table and the app manifest`
      );
    }
  });

  it('the page still renders its substance — headline, steps, form, footer', async () => {
    // ⚠ A BLANK PAGE PASSES EVERY FONT ASSERTION ABOVE.
    await setFonts(STORED_HEADING, STORED_BODY);
    const html = await servedPage();
    assert.ok(html.includes('Zeta Fonts Co'), 'the company name is gone');
    assert.ok(/<form/i.test(html), 'the form is gone');
    assert.ok(/step-num/.test(html), 'the how-it-works steps are gone');
    assert.ok(html.length > 8000, `the page collapsed to ${html.length} bytes`);
  });

  it('contractor-settable content other than fonts is undisturbed', async () => {
    // B.6 — the step copy, the socials row and the brand mark are all
    // contractor-settable and none of them is this commit's business.
    await pool.query(
      `UPDATE contractor_settings
          SET landing_step1_title = 'Zeta step one', social_facebook = 'https://facebook.com/zeta'
        WHERE contractor_id = $1`, [TENANT]
    );
    await setFonts(STORED_HEADING, STORED_BODY);
    const html = await servedPage();
    assert.ok(html.includes('Zeta step one'), 'the overridable step copy stopped rendering');
    assert.ok(html.includes('facebook.com/zeta'), 'the socials row stopped rendering');
    // renderBrandMark: no logo stored, so the company NAME as text, never our mark.
    assert.ok(html.includes('Zeta Fonts Co'));
    assert.ok(!/roofmiles[-_]?logo/i.test(html), 'the platform mark appeared on a contractor page');
  });
});
