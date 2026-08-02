'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3d-2 RED SUITE — MARKUP SAFETY ON THE LANDING PAGE
//
// Companion to landingStates.test.js. That file asserts WHAT the page says; this
// one asserts that saying it cannot be turned into a weapon, and that the page's
// JavaScript can actually run under the CSP the route serves.
//
// ── WHY THIS SURFACE SPECIFICALLY ───────────────────────────────────────────
// GET /i/:slug is the only public, unauthenticated, server-rendered page in the
// product, and every brand value on it is contractor-controlled free text.
// `contractor_settings.logo_url` is an unconstrained TEXT column written by an
// admin upload; `company_name`, `company_address` and `company_phone` are
// free-text admin fields. Nothing between the admin form and this page validates
// their SHAPE — the shared resolver validates COLOURS against a strict hex regex
// and passes everything else through, correctly, because a company name is not a
// constrained value.
//
// So the escaping is the control, and it has exactly one sanctioned
// implementation: `escapeHtml` imported from server/utils/pendingReferral.js.
// C/DL-2 Phase 3d-1 exported it and repaired it to escape the single quote —
// before that repair it was the weakest of the seven copies in the repo, and
// `title='...'` and `src='...'` were both escapable. A seventh local copy would
// re-open that gap silently.
//
// ── ASSERTIONS HERE RUN ON RAW BYTES, DELIBERATELY ─────────────────────────
// landingStates.test.js decodes entities before matching copy, because a
// correctly-escaped apostrophe renders identically to the visitor. The opposite
// is true here: WHICH BYTES were served is the entire question, and decoding
// first would make an unescaped payload indistinguishable from an escaped one.
//
// ── NON-VACUITY ────────────────────────────────────────────────────────────
// Every absence assertion below states, at its site, what proves the page
// rendered at 200 with the contractor present first. This has bitten this suite
// repeatedly: "does not contain <script>alert(1)</script>" is satisfied by a 404,
// by a 500, and by an empty body.
//
// ── THE TWO LABELS ─────────────────────────────────────────────────────────
// [RED]              fails against 3d-1's placeholder; 3d-2 makes it pass.
// [GREEN-by-design]  already satisfied by 3d-1, kept as a regression fence.
//
// The escaping tests are all in the second group, and that is the finding worth
// stating rather than hiding: 3d-1's placeholder escapes correctly ALREADY. What
// it does NOT do is check the logo's scheme — it emits
// `src="javascript:alert(&#039;...&#039;)"` verbatim today, escaped and intact.
// Inert as it stands (an <img> does not execute a javascript: URL, and the
// route's own img-src does not list the scheme), but it is precisely the gap the
// https check closes, and the three refusal tests below are RED on it now.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

const TENANT = 'test-tenant-mksafe';
const SLUG = 'epsilonroofing';
const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;
const landingPath = slug => `/i/${slug}`;

const SAFE_PROGRAM = 'Epsilon Advantage';

// THE RENDER GATE for every non-vacuity precondition in this file. LP §2 State
// 1's subhead reads "Earn cash for referring friends and neighbors to {Company
// Name}." — this is its stable prefix, and the prefix rather than the whole
// sentence is what makes it usable here: the COMPANY NAME is the hostile value
// under test in half these cases, so a gate containing it would move with the
// thing being tested.
//
// Chosen over the State 1 headline deliberately. The headline is copy 3d-2 must
// still correct, so gating on it would block every assertion below behind a
// precondition failure and hide whether the real check can fail at all. This
// prefix already renders today, so each test below fails — or passes — for its
// own reason.
const SUBHEAD_PREFIX = 'Earn cash for referring friends and neighbors to';

// Exercises all five characters escapeHtml handles, in the two contexts this
// page actually produces: element text, and an attribute value (the logo's alt=
// and title= are both fed the company name).
const HOSTILE_NAME = `Alpha <script>alert(1)</script> & "Sons" 'Co'`;

// Distinctive enough that "absent from the entire response" is a precise claim.
// A legitimate inline icon may well be a data: URI, so the assertions below name
// THESE payloads rather than banning a scheme wholesale from every src on the page.
const JS_SCHEME_LOGO = "javascript:alert('xss-epsilon-logo')";
const DATA_SCHEME_LOGO = 'data:text/html;base64,PHNjcmlwdD5hbGVydCgneHNzLWVwc2lsb24nKTwvc2NyaXB0Pg==';
const HTTP_SCHEME_LOGO = 'http://cdn.test.invalid/epsilon-logo-insecure.png';
const HTTPS_SCHEME_LOGO = 'https://cdn.test.invalid/epsilon-logo.png';

let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.92.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpGet(port, path, { host = null } = {}) {
  const headers = { 'X-Forwarded-For': nextIp() };
  if (host) headers.Host = host;
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method: 'GET', headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'] || '',
          raw: Buffer.concat(chunks).toString(),
        }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// Returns every <form ...> open tag in the document. Open tags only — the
// question is what the form DECLARES, and a closing tag declares nothing.
function formOpenTags(html) {
  return String(html).match(/<form\b[^>]*>/gi) || [];
}

describe('C/DL-2 Phase 3d-2 — landing page markup safety', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // ORDER IS LOAD-BEARING — see landingStates.test.js's note on the titles FK.
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');
  });

  // Seeds one tenant with a chosen company name and logo URL, mints a marketing
  // token on it, and returns the served landing response.
  async function serveWith({ companyName = 'Epsilon Roofing Co', logoUrl = null }) {
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [TENANT, companyName, SLUG]
    );
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, app_display_name, primary_color, secondary_color,
          accent_color, landing_bg_color, logo_url, company_phone, company_email)
       VALUES ($1, $2, $3, '#EE1111', '#EE2222', '#EE4444', '#EE3333', $4, '555-0500', 'hello@epsilon.invalid')`,
      [TENANT, companyName, SAFE_PROGRAM, logoUrl]
    );

    const token = `tok-mksafe-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', true)`,
      [TENANT, token]
    );

    return httpGet(port, landingPath(token), { host: hostFor(SLUG) });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ESCAPING
  // ═══════════════════════════════════════════════════════════════════════════

  it('[GREEN-by-design] a contractor name containing < > & " \' is escaped, never emitted as markup', async () => {
    // NON-VACUITY: status 200 and the State 1 headline — which is built from the
    // SAFE program name, so it renders whether or not the company name escapes
    // correctly — are both asserted first. Without that gate, a 500 error page
    // satisfies every absence assertion below.
    const res = await serveWith({ companyName: HOSTILE_NAME, logoUrl: HTTPS_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);
    assert.match(res.contentType, /text\/html/i, 'precondition: the page must be served as HTML');
    assert.ok(res.raw.includes(SUBHEAD_PREFIX), 'precondition: this must be a fully rendered State 1 page');

    assert.equal(
      res.raw.includes('<script>alert(1)</script>'), false,
      'the contractor name was emitted as live markup — every interpolated brand value must go ' +
      'through escapeHtml from server/utils/pendingReferral.js'
    );
    assert.ok(
      res.raw.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),
      'the angle brackets must be escaped, not stripped — stripping silently rewrites a real company name'
    );
    assert.ok(
      res.raw.includes('&quot;Sons&quot;'),
      'the double quote must be escaped: the company name is fed to alt= and would break out of it'
    );
    assert.ok(
      res.raw.includes('&#039;Co&#039;'),
      "the single quote must be escaped — this is the repair 3d-1 made to escapeHtml, and title='...' " +
      'is escapable without it'
    );
    assert.ok(
      res.raw.includes('&amp;'),
      'the ampersand must be escaped, and FIRST — escaping < before & renders a lone < as the literal "&lt;"'
    );
  });

  it('[GREEN-by-design] the escaped name still reads correctly to the visitor', async () => {
    // The counterweight to the test above, and it is not decoration: "contains no
    // <script>" is trivially satisfied by an implementation that drops the company
    // name entirely, or replaces it with a placeholder. A homeowner looking at
    // "Smith & Sons" must see "Smith & Sons".
    const res = await serveWith({ companyName: HOSTILE_NAME, logoUrl: HTTPS_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);

    const decoded = res.raw
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    assert.ok(
      decoded.includes(HOSTILE_NAME),
      'the contractor name must survive escaping intact — escaped, not stripped or truncated'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. LOGO URL SAFETY
  // ═══════════════════════════════════════════════════════════════════════════

  it('[GREEN-by-design] an https logo_url renders — the counterweight that makes the refusals mean something', async () => {
    // Asserted FIRST in this section on purpose. Without it, "refuses javascript:"
    // and "refuses data:" are both satisfied by an implementation that never emits
    // a logo at all, which would be a white-label failure dressed as a security win.
    const res = await serveWith({ logoUrl: HTTPS_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);
    assert.ok(
      res.raw.includes(HTTPS_SCHEME_LOGO),
      'an https logo_url is the ordinary case and must render — the B2 upload pipeline writes exactly this shape'
    );
  });

  it('[RED] a javascript: logo_url is refused rather than emitted into src=', async () => {
    // escapeHtml stops an attribute breakout; it does NOT stop a dangerous SCHEME,
    // because nothing in `javascript:alert(1)` needs escaping. logo_url is an
    // unconstrained TEXT column, so the scheme check is a separate control that has
    // to exist on top of the escaping.
    //
    // NON-VACUITY: status 200 and the State 1 headline are asserted first, and the
    // test above proves a good logo DOES render — so absence here is a refusal
    // rather than a page that renders no logos and no content.
    const res = await serveWith({ logoUrl: JS_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);
    assert.ok(res.raw.includes(SUBHEAD_PREFIX), 'precondition: this must be a fully rendered State 1 page');

    assert.equal(
      res.raw.includes('javascript:'), false,
      'a javascript: logo_url reached the served document — the page must accept https only'
    );
    assert.equal(
      res.raw.includes('xss-epsilon-logo'), false,
      'the javascript: payload survived in some escaped form — refusal means the value is never emitted'
    );
  });

  it('[RED] a data: logo_url is refused rather than emitted into src=', async () => {
    // Named as a specific payload rather than banning the data: scheme from every
    // src on the page: an inline icon served as a data: URI is legitimate, and the
    // CSP already permits data: in img-src for exactly that reason. What must never
    // happen is a contractor-controlled data: document being rendered as the logo.
    //
    // NON-VACUITY: same gate as above — 200, the headline, and the https test's
    // proof that logos do render.
    const res = await serveWith({ logoUrl: DATA_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);
    assert.ok(res.raw.includes(SUBHEAD_PREFIX), 'precondition: this must be a fully rendered State 1 page');

    assert.equal(
      res.raw.includes('PHNjcmlwdD5hbGVydCgneHNzLWVwc2lsb24nKTwvc2NyaXB0Pg=='), false,
      'a data: logo_url reached the served document — the page must accept https only'
    );
  });

  it('[RED] a plain http:// logo_url is refused', async () => {
    // The https-scheme check is not only an XSS control. A page served over TLS
    // that pulls its logo over plain http is mixed content: browsers block the
    // image outright, so the contractor's brand silently disappears from the one
    // surface it exists for.
    //
    // NON-VACUITY: 200, the headline, and the https counterweight above.
    const res = await serveWith({ logoUrl: HTTP_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);
    assert.ok(res.raw.includes(SUBHEAD_PREFIX), 'precondition: this must be a fully rendered State 1 page');

    assert.equal(
      res.raw.includes(HTTP_SCHEME_LOGO), false,
      'a plain http:// logo_url must be refused — https only'
    );
  });

  it('[RED] a refused logo falls back to the company name, not to a blank header', async () => {
    // The refusal must degrade the way an ABSENT logo does. There is deliberately
    // no default logo (a placeholder borrowed from another contractor is a
    // white-label breach), so the fallback is the company name as styled text —
    // the homeowner scanned that contractor's sign and the header must say so.
    const res = await serveWith({ companyName: 'Epsilon Roofing Co', logoUrl: JS_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);
    assert.ok(res.raw.includes(SUBHEAD_PREFIX), 'precondition: this must be a rendered State 1 page');

    // Scoped to the header region — everything between <body> and the headline —
    // and with TAGS STRIPPED, so the name must be rendered TEXT. Both narrowings
    // are what stop this from passing for the wrong reason: unscoped, the subhead
    // and <title> both carry the name on every page; unstripped, the refused
    // <img>'s own alt= and title= attributes carry it too, which is precisely the
    // element that is supposed to be gone.
    const bodyStart = res.raw.indexOf('<body');
    assert.ok(bodyStart > 0, 'precondition: the document must have a body');
    const headlineAt = res.raw.indexOf('Join the', bodyStart);
    assert.ok(headlineAt > bodyStart, 'precondition: the headline must render, bounding the header region');

    const headerText = res.raw.slice(bodyStart, headlineAt).replace(/<[^>]*>/g, ' ');
    assert.ok(
      headerText.includes('Epsilon Roofing Co'),
      'a refused logo must fall back to the company name as TEXT, exactly as a NULL logo_url does — ' +
      'not to an empty header, and never to the RoofMiles mark'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. THE FORM MUST NOT RELY ON A NATIVE SUBMIT
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] no form on the page declares a native POST', async () => {
    // THE TRAP THIS EXISTS FOR, and it fails silently in both directions.
    // server/app.js mounts express.json() and NO express.urlencoded(). A native
    // <form method="post"> sends application/x-www-form-urlencoded, which no parser
    // on this server reads — so req.body is empty, every field arrives undefined,
    // and POST /api/signup answers "All fields are required." on a form the
    // homeowner filled in completely. Nothing throws and nothing is logged.
    //
    // NON-VACUITY: status 200 and the presence of the password input are asserted
    // first, so this describes a rendered signup form rather than a page with no
    // form at all — which would trivially satisfy "no form declares a POST".
    const res = await serveWith({ logoUrl: HTTPS_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);
    assert.ok(
      /(?:name|id)\s*=\s*["']password["']/.test(res.raw),
      'precondition: the signup form must have rendered before its submit mechanism means anything'
    );

    for (const tag of formOpenTags(res.raw)) {
      assert.equal(
        /\bmethod\s*=\s*["']?post["']?/i.test(tag), false,
        `a form declares a native POST, which this server cannot parse: ${tag}`
      );
      assert.equal(
        /\baction\s*=\s*["'][^"']*\/api\//i.test(tag), false,
        `a form points its native action at an API endpoint: ${tag}`
      );
    }
  });

  it('[RED] signup is submitted as JSON to POST /api/signup', async () => {
    // The positive half of the same contract. The endpoint reads req.body through
    // express.json(), so the request has to declare a JSON content type — and the
    // page has to name the endpoint at all.
    const res = await serveWith({ logoUrl: HTTPS_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);

    assert.ok(res.raw.includes('/api/signup'), 'the page must post the signup to /api/signup');
    assert.ok(
      res.raw.includes('application/json'),
      'the signup request must declare a JSON content type — express.urlencoded() is not mounted'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. THE PAGE'S JAVASCRIPT MUST SURVIVE ITS OWN CSP
  // ═══════════════════════════════════════════════════════════════════════════

  it('[GREEN-by-design] every inline script carries the per-request nonce', async () => {
    // The landing router serves script-src 'self' plus a nonce, with no
    // 'unsafe-inline' fallback — deliberately, because this page interpolates
    // contractor-controlled strings. An inline <script> without the nonce is
    // therefore DEAD: the browser refuses it, the state machine never runs, and the
    // server sees a perfectly successful 200.
    const res = await serveWith({ logoUrl: HTTPS_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);

    const scripts = res.raw.match(/<script\b[^>]*>/gi) || [];
    assert.ok(scripts.length > 0, 'precondition: the page must ship script — the state machine is client-side');

    for (const tag of scripts) {
      // An external same-origin src is permitted by script-src 'self' and needs no
      // nonce; only inline blocks do.
      if (/\bsrc\s*=/i.test(tag)) continue;
      assert.ok(
        /\bnonce\s*=\s*["'][A-Za-z0-9_-]{16,}["']/.test(tag),
        `an inline script has no nonce and will be blocked by this route's own CSP: ${tag}`
      );
    }
  });

  it('[GREEN-by-design] no inline event handler attributes — script-src-attr is \'none\'', async () => {
    // helmet's script-src-attr 'none' is inherited untouched by the landing
    // router's scoped CSP, so onclick=, oninput= and their siblings never fire.
    // This is the specific failure mode that would break the skip path's clipboard
    // write, which must run inside the click handler because
    // navigator.clipboard.writeText requires user activation.
    //
    // NON-VACUITY: status 200 and the presence of at least one nonce'd inline
    // script are asserted first — proving the page HAS working JavaScript, so the
    // absence of inline handlers is a design choice rather than a page with no
    // interactivity at all.
    const res = await serveWith({ logoUrl: HTTPS_SCHEME_LOGO });

    assert.equal(res.status, 200, `precondition: the page must render (got ${res.status})`);
    assert.ok(
      /<script\b[^>]*\bnonce\s*=/i.test(res.raw),
      'precondition: the page must carry a nonce\'d inline script'
    );

    const handlers = res.raw.match(/\son(?:click|submit|input|change|load|keyup|keydown|paste|focus|blur)\s*=/gi) || [];
    assert.deepEqual(
      handlers, [],
      `inline event handler attributes are blocked by script-src-attr 'none' and will never fire: ${handlers.join(', ')}`
    );
  });
});
