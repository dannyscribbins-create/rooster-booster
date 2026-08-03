'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// POLISH ITEM 3 — PHASE 3 — THE MINT-FAILURE DEGRADE PATH
//
// serveLanding's marketing branch has an else nobody has ever exercised:
//
//   const token = await resolveDefaultMarketingToken(pool, payload.contractorId);
//   if (!token) {
//     res.type('html').send(renderInvalidPage({ contractor: payload.contractor }));
//     return;
//   }
//
// Its comment states the rule it exists for — "a branded page whose form cannot
// submit is worse than an honest dead end" — and that rule is right. A signup
// card with no `inviteSlug` to post would 400 on every attempt, so the route
// degrades to a BRANDED State 0 instead of rendering a form that cannot work.
//
// ── WHY THIS BRANCH NEEDS A FENCE NOW SPECIFICALLY ─────────────────────────
// It was defensible-but-untested when State 0 was a headline and a sentence.
// Polish item 3 changed what it renders: State 0 now carries a CONTACT BLOCK,
// which is the entire consolation this page offers a homeowner who cannot be
// given a working signup form. The degrade path is the one route to State 0 that
// arrives with a contractor whose data was loaded for a DIFFERENT purpose —
// marketing mode's `contractor: branding`, not buildInvalidPayload's — so it is
// the one place the block could silently render empty while every other State 0
// test stays green. That is precisely the shape of bug this repo has been bitten
// by: every piece correct in isolation, one wire never connected.
//
// ── WHY FAULT INJECTION, AND WHY AT THE DATABASE ───────────────────────────
// resolveDefaultMarketingToken returns null only by exhausting a three-attempt
// loop in which every SELECT finds nothing AND every INSERT returns nothing.
// Ordinary data cannot produce that: the first INSERT succeeds and returns the
// row. The branch is unreachable from the outside, which is exactly why it has
// no coverage and exactly why it deserves some.
//
// So the fault goes in at the database, mirroring the existing pattern at
// landingResolution.test.js:624 — a temporary trigger, dropped in a finally.
// Injecting at the DB rather than by stubbing the module exercises the REAL
// function, the real loop and the real route; a mocked resolveDefaultMarketingToken
// would prove only that the route branches on null, which is visible by reading it.
//
// ⚠ THE TRIGGER RETURNS NULL. IT MUST NOT RAISE, AND THE DIFFERENCE IS THE WHOLE
// TEST. resolveDefaultMarketingToken has no try/catch, so a RAISE propagates out
// of it, out of serveLanding's marketing branch, and into serveLanding's own
// catch — which renders the 500 page. That page is not State 0. A raising trigger
// would therefore produce a test that passes for a completely different reason
// (the route survived an exception) while the branch under test never executed.
// RETURN NULL makes the INSERT affect zero rows silently: the SELECT keeps
// finding nothing, the loop exhausts on schedule, and the function returns null
// through its own final `return null` — the real path, reached the real way.
//
// The first assertion below distinguishes the two outcomes explicitly rather
// than letting a 500 fail some later assertion with a confusing message.
//
// NO PRODUCTION CONTRACTOR ID, SLUG OR DOMAIN LITERALS (house rule).
//
// ── THIS FILE WRITES NOTHING TO PRODUCTION ─────────────────────────────────
// setup.js's safety interlock aborts the run unless DATABASE_URL is localhost.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

// ── FIXTURES ────────────────────────────────────────────────────────────────

const TENANT = 'test-tenant-mintfail';
const SLUG = 'deltamint';

const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;

// A17/A18: the bare subdomain IS the marketing surface. No token in the URL —
// which is what sends serveLanding down the branch that mints one.
const MARKETING_PATH = '/';

const BRAND = {
  companyName: 'Delta Mint Roofing Co',
  primary: '#DD1111',
  phone: '555-0810',
  // A BARE DOMAIN, the shape the admin Company Details "Website URL" field asks
  // for and the shape nothing normalises on the way to the column.
  website: 'deltamint.invalid',
};

// safeWebsiteUrl's contract, hand-written rather than imported — a test that
// derives its expectation from the code under test passes whatever that code
// does. href is parsed.href (normalised, trailing slash); label is the original.
const EXPECTED_WEBSITE_HREF = 'https://deltamint.invalid/';
const EXPECTED_WEBSITE_LABEL = 'deltamint.invalid';

// The BRANDED State 0 headline (A21). Hand-transcribed. This is the proof the
// degrade path renders State 0's branded variant rather than the neutral one —
// the payload carries a contractor, so neutral here would be a real bug.
const BRANDED_HEADLINE = "Let's get you the right link";

// State 1's primary CTA and the signup card's title. Their ABSENCE is the point
// of the whole branch: the form cannot be given a token to post, so it must not
// be drawn at all.
const SIGNUP_CTA = 'Create my account';
const SIGNUP_CARD_TITLE = 'Create your account';

const CONTACT_BLOCK_MARKER = 'data-contact-block';

// The fault-injection fixture. Named for what it does so a leaked trigger is
// self-describing in a psql session.
const TRIGGER_NAME = 'test_suppress_token_insert_trg';
const TRIGGER_FN = 'test_suppress_token_insert';

// ── HTTP TRANSPORT ──────────────────────────────────────────────────────────
// Per-request X-Forwarded-For: server/app.js sets `trust proxy 1`, so
// express-rate-limit keys on it. Without per-test IPs the whole file shares one
// bucket and starts 429ing the moment a limiter reaches this route.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.97.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
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

// Decodes the five entities escapeHtml produces and collapses whitespace runs,
// so copy assertions describe what the VISITOR READS.
function renderedText(html) {
  return String(html)
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns the full <a>...</a> element whose href is EXACTLY `href`, or null.
function anchorWithHref(raw, href) {
  const re = new RegExp(`<a\\b[^>]*href\\s*=\\s*["']${escapeRe(href)}["'][^>]*>[\\s\\S]*?<\\/a>`, 'i');
  const m = String(raw).match(re);
  return m ? m[0] : null;
}

describe('C/DL-2 polish 3 phase 3 — the mint-failure degrade path renders a branded State 0', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    // BELT AND BRACES. The test's own finally drops both objects; this catches
    // the one case that finally cannot — a failure between CREATE FUNCTION and
    // CREATE TRIGGER, or an abort inside the try that skips straight past it.
    // A leaked INSERT-suppressing trigger on contractor_invite_links would break
    // essentially every landing suite that runs after this file.
    await pool.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON contractor_invite_links`);
    await pool.query(`DROP FUNCTION IF EXISTS ${TRIGGER_FN}()`);
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    // ORDER IS LOAD-BEARING — `titles` carries an FK to `contractors` and db.js's
    // startup seed creates title rows. Deleting contractors first raises 23503.
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [TENANT, BRAND.companyName, SLUG]
    );
    // company_email and company_address are deliberately LEFT UNSET: the claim
    // under test is that the block renders the rows whose data resolves, and a
    // fixture with everything populated cannot tell that from a block that draws
    // every row unconditionally.
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, primary_color, company_phone, company_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [TENANT, BRAND.companyName, BRAND.primary, BRAND.phone, BRAND.website]
    );

    // NO DEFAULT MARKETING TOKEN. This is the state every contractor starts in —
    // A18's auto-mint exists precisely because of it — and it is what sends the
    // request through resolveDefaultMarketingToken rather than past it.
  });

  // Counts this contractor's marketing tokens. The proof that the mint genuinely
  // failed rather than that the page merely looked like State 0.
  async function marketingTokenCount() {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM contractor_invite_links WHERE contractor_id = $1`,
      [TENANT]
    );
    return rows[0].n;
  }

  async function triggerExists() {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM pg_trigger WHERE tgname = $1 AND NOT tgisinternal`,
      [TRIGGER_NAME]
    );
    return rows[0].n > 0;
  }

  it('a failed marketing mint degrades to the BRANDED State 0, contact block and all', async () => {
    // ── INSTALL THE FAULT ────────────────────────────────────────────────────
    // BEFORE INSERT ... FOR EACH ROW returning NULL tells PostgreSQL to skip the
    // row silently. No exception is raised, nothing reaches serveLanding's catch,
    // and the INSERT reports zero rows affected — which is the one condition
    // resolveDefaultMarketingToken's loop cannot recover from.
    await pool.query(`
      CREATE OR REPLACE FUNCTION ${TRIGGER_FN}() RETURNS trigger AS $$
      BEGIN RETURN NULL; END;
      $$ LANGUAGE plpgsql;
    `);
    await pool.query(`
      CREATE TRIGGER ${TRIGGER_NAME}
      BEFORE INSERT ON contractor_invite_links
      FOR EACH ROW EXECUTE FUNCTION ${TRIGGER_FN}();
    `);

    let res;
    try {
      assert.equal(
        await marketingTokenCount(), 0,
        'precondition: this contractor must start with no marketing token, or the mint is never attempted'
      );

      res = await httpGet(port, MARKETING_PATH, { host: hostFor(SLUG) });

      // ── 1. IT IS A PAGE, AND IT IS NOT THE 500 ────────────────────────────
      // Asserted first and asserted SPECIFICALLY, because a 500 here does not
      // mean "the degrade path is broken" — it means the fixture is wrong. A
      // trigger that RAISED instead of returning NULL produces exactly this, and
      // the resulting test would pass its later assertions for the wrong reason
      // if they were written loosely enough. Named here so the failure message
      // says which of the two it was.
      assert.notEqual(
        res.status, 500,
        'got the 500 page, not State 0. The fault fixture RAISED instead of returning NULL: ' +
        'resolveDefaultMarketingToken has no try/catch, so an exception propagates into ' +
        "serveLanding's catch and renders the error page. The branch under test never ran."
      );
      assert.equal(res.status, 200, `the degrade path is a PAGE, never an error status (got ${res.status})`);
      assert.match(res.contentType, /text\/html/i, 'the degrade path must render HTML, not JSON');

      // ── 2. IT IS THE *BRANDED* STATE 0 ────────────────────────────────────
      // Both halves matter. The headline proves State 0 rather than a stripped
      // State 1; the company name and palette prove the BRANDED variant, which
      // is the whole reason this branch passes `{ contractor: payload.contractor }`
      // rather than a bare `{}`. A neutral page here would be a real regression:
      // the visitor typed this contractor's own subdomain.
      const text = renderedText(res.raw);
      assert.ok(
        text.includes(BRANDED_HEADLINE),
        `the degrade path must render State 0's branded headline "${BRANDED_HEADLINE}" (A21)`
      );
      assert.ok(
        text.includes(BRAND.companyName),
        `the degrade path must name the contractor whose subdomain was visited (${BRAND.companyName})`
      );
      assert.ok(
        res.raw.includes(BRAND.primary),
        "the degrade path must carry the contractor's own palette, not the neutral RoofMiles theme"
      );

      // ── 3. THE CONTACT BLOCK RENDERED ─────────────────────────────────────
      // THE POINT OF THIS FENCE. This branch loads its contractor through
      // marketing mode's `contractor: branding`, not through buildInvalidPayload,
      // so it is the one path to State 0 where the block could arrive empty while
      // every other State 0 test stayed green. A homeowner on this page cannot be
      // given a signup form; the contact rows are the entire remaining value of
      // the document.
      assert.ok(
        res.raw.includes(CONTACT_BLOCK_MARKER),
        'the degrade path must render the State 0 contact block — with no signup form on offer, ' +
        'the contact rows are all this page has left to give'
      );
      assert.ok(
        anchorWithHref(res.raw, `tel:${BRAND.phone}`),
        `the contact block must carry the phone row (expected href="tel:${BRAND.phone}")`
      );
      const siteAnchor = anchorWithHref(res.raw, EXPECTED_WEBSITE_HREF);
      assert.ok(
        siteAnchor,
        `the contact block must carry the website row (expected href="${EXPECTED_WEBSITE_HREF}", ` +
        `resolved from company_url "${BRAND.website}")`
      );
      assert.ok(
        renderedText(siteAnchor).replace(/<[^>]*>/g, ' ').trim() === EXPECTED_WEBSITE_LABEL,
        `the website row's visible label must be the bare domain "${EXPECTED_WEBSITE_LABEL}". As served: ${siteAnchor}`
      );

      // ── 4. NO FORM, AND NOTHING WAS MINTED ────────────────────────────────
      // The rule this branch exists for, stated as an assertion: a signup card
      // with no inviteSlug to post would 400 on every submission, so it must not
      // be drawn. Asserted on the CTA and the card title rather than on `<form`
      // alone — the copy is what a homeowner would have tried to use.
      assert.equal(
        text.includes(SIGNUP_CTA), false,
        'a signup form with no token to post 400s on every attempt — the degrade path must not draw one'
      );
      assert.equal(
        text.includes(SIGNUP_CARD_TITLE), false,
        'the signup card must not render on the degrade path'
      );
      assert.equal(
        /name\s*=\s*["']inviteSlug["']/i.test(res.raw), false,
        'there is no token to carry, so nothing may claim to carry one'
      );

      // THE PROOF THE NULL PATH WAS ACTUALLY TAKEN. Without this, every
      // assertion above would also pass on a page that reached State 0 some
      // other way. Zero rows means the INSERT really was suppressed, the loop
      // really did exhaust, and resolveDefaultMarketingToken really did return
      // null — which is the only way to reach the branch under test.
      assert.equal(
        await marketingTokenCount(), 0,
        'the mint must genuinely have failed — a token row here means the page reached State 0 ' +
        'by some other route and this test proved nothing about the degrade path'
      );
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON contractor_invite_links`);
      await pool.query(`DROP FUNCTION IF EXISTS ${TRIGGER_FN}()`);
    }

    // ── 5. CLEANUP RAN, AND THE FAULT IS WHAT CAUSED ALL OF THE ABOVE ───────
    // Two claims in one request, and the second is why this is not merely
    // hygiene. With the trigger gone the SAME url must now mint and serve
    // State 1 — which proves (a) the fixture was dropped, so nothing is poisoned
    // for later files, and (b) the branded State 0 above was caused BY THE FAULT
    // rather than by a broken seed, an unresolvable host, or any other reason a
    // page might have degraded. A test that injects a fault and never shows the
    // system recovering has not proved the fault was load-bearing.
    assert.equal(await triggerExists(), false, `${TRIGGER_NAME} must be dropped, or every later suite inherits it`);

    const after = await httpGet(port, MARKETING_PATH, { host: hostFor(SLUG) });

    assert.equal(after.status, 200, `precondition: the recovered request must render (got ${after.status})`);
    assert.equal(
      await marketingTokenCount(), 1,
      'with the fault removed the same request must auto-mint exactly one marketing token (A18) — ' +
      'if it does not, the State 0 above was not caused by the mint failing'
    );
    assert.ok(
      renderedText(after.raw).includes(SIGNUP_CARD_TITLE),
      'with a token available the same URL must serve State 1 with its signup card, not State 0'
    );
  });
});
