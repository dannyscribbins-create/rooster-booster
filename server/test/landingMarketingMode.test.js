'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3d-3 RED SUITE (1 of 2) — MARKETING MODE
//
// The bare subdomain as a working product surface: <slug>.roofmiles.com with no
// token renders a branded page WITH a signup that actually submits.
//
// GOVERNING DOCUMENTS, in precedence order:
//   1. DECISION_C_DL_BUILD_SPEC.md §13, amendments A17 / A18 / A19
//   2. LANDING_PAGE_SPEC.md §6.4 (bare-subdomain bullet) and §2 (State 0/1 copy)
// Where an amendment and LP's surrounding prose disagree, the amendment wins.
//
// ── THE RULE THIS FILE EXISTS TO PROTECT ────────────────────────────────────
// THE TOKEN IS THE TENANCY AUTHORITY; THE HOSTNAME IS COSMETIC ROUTING (A5, LP
// §6.4). Marketing mode is the one place that rule is under real pressure, since
// the hostname is the ONLY input the visitor supplied. A18's answer is not to
// relax it but to route marketing mode through a token as well: the hostname
// selects WHICH contractor's marketing token to look up or mint, and the
// resulting TOKEN ROW is what stamps contractor_id on the user.
//
// So `POST /api/signup` keeps requiring `inviteSlug` and keeps deriving tenancy
// from the token row. Nothing in this file asks it to do otherwise, and §5 below
// includes a hostile-host case that proves it does not.
//
// ── WHY AUTO-MINT ───────────────────────────────────────────────────────────
// A18: "Auto-mint exists so the path can never fail closed for a contractor who
// has configured nothing — which is the state every new contractor starts in."
// A design that required an admin to mint a link first would ship a broken page
// to every contractor on day one, discovered by whoever visited first.
//
// ── NON-VACUITY ─────────────────────────────────────────────────────────────
// Every absence assertion below states, at its site, what proves the page
// rendered first. A 404, a 500 or an empty body satisfies "does not contain X"
// for entirely the wrong reason.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule). Two-tenant fixtures
// wherever tenancy matters.
//
// ── THIS FILE WRITES NOTHING TO PRODUCTION ──────────────────────────────────
// setup.js's safety interlock aborts the run unless DATABASE_URL is localhost.
// ─────────────────────────────────────────────────────────────────────────────

// Resend stub — must be installed BEFORE app.js is required. Same pattern as
// inviteTokenSignup.test.js and signupTenantStamp.test.js: POST /api/signup's
// verification-email send is not behind a test seam, Resend instances are built
// at require()-time, and the real RESEND_API_KEY from .env leaks into the test
// process otherwise. Process-local to this file; touches no production code.
const _resendPath = require.resolve('resend');
require.cache[_resendPath] = {
  id: _resendPath,
  filename: _resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = { send: async () => ({ data: { id: 'test-stub' }, error: null }) };
      }
    },
  },
};

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

// ── FIXTURES ────────────────────────────────────────────────────────────────

const TENANT_A = 'test-tenant-mkt-a';
const TENANT_B = 'test-tenant-mkt-b';

const SLUG_A = 'alphamarketing';
const SLUG_B = 'betamarketing';

// A subdomain no contractor holds. Deliberately a well-FORMED, non-reserved slug
// so it reaches the database lookup and returns nothing, rather than being
// rejected earlier by extractSlugFromHost's format or denylist rules — those are
// already covered by contractorSlug.test.js and are not what this file is about.
const SLUG_UNCLAIMED = 'nobodyholdsthis';

const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;

// The bare subdomain. A17's whole subject: "<slug>.roofmiles.com/ with no token".
const MARKETING_PATH = '/';

// A9: the token path is /i/<slug>. /r/ is void and appears nowhere in code.
const landingPath = slug => `/i/${slug}`;

const TABLE = 'contractor_invite_links';

// Garish and mutually exclusive, so a bleed between tenants is unmistakable in a
// failure message rather than a subtle near-match.
const BRAND_A = {
  companyName: 'Alpha Marketing Roofing',
  programName: 'Alpha Rewards',
  primary: '#AA1111',
  secondary: '#AA2222',
  accent: '#AA4444',
  bg: '#AA3333',
  phone: '555-0100',
  email: 'hello@alpha.invalid',
  address: '1 Alpha Way, Atlanta GA',
};
const BRAND_B = {
  companyName: 'Beta Marketing Roofing',
  programName: 'Beta Rewards',
  primary: '#BB1111',
  secondary: '#BB2222',
  accent: '#BB4444',
  bg: '#BB3333',
  phone: '555-0200',
  email: 'hello@beta.invalid',
  address: '2 Beta Road, Athens GA',
};

// ── THE TWO A18 MARKER COLUMNS ──────────────────────────────────────────────
// A18 requires two persisted facts about a marketing token that today's schema
// cannot express, and both are load-bearing rather than cosmetic:
//
//   DEFAULT   which of a contractor's marketing links the bare subdomain serves.
//             Without it there is no way to honour "admins MAY designate a
//             different existing marketing link as the default", and no way for
//             a second serve to find the token the first one minted rather than
//             minting another.
//
//   AUTOMATIC whether the platform minted it or a human did. A18 in terms:
//             "clearly labelled in the admin marketing-links list as automatic,
//             so an admin never finds a link they did not create and cannot
//             account for." A label the admin list can render has to be a stored
//             fact, not an inference.
//
// A18 does not NAME either column, so this suite proposes names — the same move
// landingStates.test.js made for STORE_BADGES_ACTIVE. Renaming is a one-line
// change here and in the implementation.
//
// DELIBERATELY CONFINED. The auto-mint, reuse and concurrency proofs below are
// written against row COUNTS and the SLUG THE PAGE CARRIES, which are observable
// without either column, so a rename cannot invalidate them. Only the "marked
// default / marked automatic" assertions and the admin-override fixtures touch
// these names.
const COL_DEFAULT = 'is_default_marketing';
const COL_AUTO = 'auto_minted';

// ── LP §2 COPY, VERBATIM ────────────────────────────────────────────────────
// Hand-transcribed from LANDING_PAGE_SPEC.md §2. Braced tokens are interpolated
// by the helpers rather than matched literally.
const COPY = {
  invalidHeadline: "This link isn't active",
  invalidContactSentence: 'or contact',
  headline: program => `Join the ${program} rewards program`,
  subhead: name => `Earn cash for referring friends and neighbors to ${name}.`,
  cardTitle: 'Create your account',
  cta: 'Create my account',
  chipPrefix: 'Invited by',
};

// ── HTTP TRANSPORT ──────────────────────────────────────────────────────────
// Per-request X-Forwarded-For: server/app.js sets `trust proxy 1`, so
// express-rate-limit keys on it. Without per-test IPs the whole file shares one
// bucket and starts 429ing the moment a limiter is added to the marketing route
// or the moment the signup limiter (5/60min) is reached — a suite that passes
// RED and then breaks on GREEN for an unrelated reason.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.71.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
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

function httpPost(port, path, bodyObj, { host = null } = {}) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj));
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': bodyBuf.length,
    'X-Forwarded-For': nextIp(),
  };
  if (host) headers.Host = host;
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method: 'POST', headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          try { resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }); }
          catch { resolve({ status: res.statusCode, body: text }); }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// ── ASSERTION HELPERS ───────────────────────────────────────────────────────

// Decodes the five entities escapeHtml produces and collapses whitespace runs,
// so copy assertions describe what the VISITOR READS rather than which bytes
// carried it. Byte-level escaping is landingMarkupSafety.test.js's job.
//
// The ampersand is decoded LAST — the mirror of escapeHtml's order.
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

// Asserts a CSS custom property is declared with an exact value. Pins the
// VARIABLE NAME as well as the colour — C/DL-3's FieldRepApp is specified to
// consume "the same variables" this page declares, so the names are a
// cross-session contract rather than a local detail.
function assertCssVar(body, name, value, message) {
  const re = new RegExp(`--${name}\\s*:\\s*${escapeRe(value)}\\s*[;}]`, 'i');
  assert.ok(re.test(body), `${message} — expected --${name}:${value} in the served theme block`);
}

// The one precondition every test in this file opens with. A marketing page that
// 404s or 500s would satisfy most of the absence assertions below for entirely
// the wrong reason, so nothing is asserted about a response until this has run.
function assertRenderedPage(res, label) {
  assert.equal(res.status, 200, `${label}: the marketing page must render (got ${res.status})`);
  assert.match(res.contentType, /text\/html/i, `${label}: it must be HTML, not a JSON error body`);
}

describe('C/DL-2 Phase 3d-3 — marketing mode (A17/A18): the bare subdomain as a working signup', () => {
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
    // ORDER IS LOAD-BEARING — `titles` carries an FK to `contractors` and db.js's
    // startup seed creates title rows. Deleting contractors first raises 23503
    // inside this hook and fails every test in the file for a reason that has
    // nothing to do with the landing page.
    await pool.query('DELETE FROM email_verifications');
    await pool.query('DELETE FROM contact_tags');
    await pool.query('DELETE FROM contacts');
    await pool.query(`DELETE FROM ${TABLE}`);
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedTenant(TENANT_A, SLUG_A, BRAND_A);
    await seedTenant(TENANT_B, SLUG_B, BRAND_B);
  });

  async function seedTenant(contractorId, slug, brand) {
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [contractorId, brand.companyName, slug]
    );
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, app_display_name, primary_color, secondary_color,
          accent_color, landing_bg_color, company_phone, company_email, company_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        contractorId, brand.companyName, brand.programName, brand.primary, brand.secondary,
        brand.accent, brand.bg, brand.phone, brand.email, brand.address,
      ]
    );
  }

  // ── TOKEN-TABLE READERS ───────────────────────────────────────────────────

  // Every column that exists TODAY. Deliberately names no A18 marker column, so
  // the count-and-shape assertions keep working whatever those end up being
  // called.
  async function tokenRows(contractorId) {
    const { rows } = await pool.query(
      `SELECT id, slug, link_type, active, created_by_user_id, owner_team_member_id,
              redeemed_at, redeemed_user_id, expires_at, created_at
         FROM ${TABLE}
        WHERE contractor_id = $1
        ORDER BY id`,
      [contractorId]
    );
    return rows;
  }

  async function totalTokenCount() {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${TABLE}`);
    return rows[0].n;
  }

  // Reads the two proposed A18 marker columns for one slug.
  //
  // 42703 (undefined_column) is converted into a legible assertion failure rather
  // than surfacing as a raw PostgreSQL error, so the RED reason reads as "the
  // schema does not carry this yet" instead of as a broken test.
  async function markersFor(slug) {
    try {
      const { rows } = await pool.query(
        `SELECT ${COL_DEFAULT} AS is_default, ${COL_AUTO} AS auto_minted
           FROM ${TABLE} WHERE slug = $1`,
        [slug]
      );
      assert.equal(rows.length, 1, `markersFor: no token row for slug ${slug}`);
      return rows[0];
    } catch (err) {
      if (err.code === '42703') {
        assert.fail(
          `A18 needs the default-marketing marker persisted on ${TABLE}. Expected columns ` +
          `"${COL_DEFAULT}" (which link the bare subdomain serves) and "${COL_AUTO}" (the ` +
          '"automatic" label A18 requires the admin marketing-links list to render). ' +
          `PostgreSQL: ${err.message}`
        );
      }
      throw err;
    }
  }

  // Seeds a marketing token with the A18 markers set explicitly — the fixture the
  // admin-override tests need. Same 42703 translation as above.
  async function seedMarketingToken(contractorId, slug, { isDefault = false, autoMinted = false } = {}) {
    try {
      await pool.query(
        `INSERT INTO ${TABLE}
           (contractor_id, slug, link_type, created_by_user_id, owner_team_member_id, active,
            ${COL_DEFAULT}, ${COL_AUTO})
         VALUES ($1, $2, 'contractor', NULL, NULL, true, $3, $4)`,
        [contractorId, slug, isDefault, autoMinted]
      );
    } catch (err) {
      if (err.code === '42703') {
        assert.fail(
          `A18's admin override needs a designable default. Expected columns "${COL_DEFAULT}" ` +
          `and "${COL_AUTO}" on ${TABLE}. PostgreSQL: ${err.message}`
        );
      }
      throw err;
    }
  }

  // Serves the bare subdomain once and returns the response.
  const getMarketing = (slug) => httpGet(port, MARKETING_PATH, { host: hostFor(slug) });

  function signupBody(overrides = {}) {
    return {
      firstName: 'Marketing',
      lastName: 'Visitor',
      phone: '555-123-4567',
      email: `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.invalid`,
      password: 'password123',
      ...overrides,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. MARKETING PAGE RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] a bare subdomain renders State 1 with the contractor\'s branding and a working signup form', async () => {
    // A17: "A bare-subdomain visit renders a branded page WITH a working signup."
    // LP §6.4's bullet said the same thing before the amendment; what A17 adds is
    // that it is WORK rather than an assumption, because there is no route on '/'
    // today and POST /api/signup refuses without a token.
    //
    // The form is asserted FIELD BY FIELD rather than by the card title alone. A
    // page that renders the heading and omits `phone` looks correct in a browser
    // and answers "All fields are required." on every submission — the exact shape
    // A11 was written to prevent, and the thing that makes a signup form
    // decorative rather than working.
    const res = await getMarketing(SLUG_A);

    assertRenderedPage(res, 'bare subdomain');
    const text = renderedText(res.raw);

    assert.ok(
      text.includes(COPY.headline(BRAND_A.programName)),
      `marketing mode is State 1, so LP's headline applies: "${COPY.headline(BRAND_A.programName)}"`
    );
    assert.ok(
      text.includes(COPY.subhead(BRAND_A.companyName)),
      `LP §2 State 1 subhead is locked: "${COPY.subhead(BRAND_A.companyName)}"`
    );
    assert.ok(text.includes(COPY.cardTitle), `LP §2 signup card title is locked: "${COPY.cardTitle}"`);
    assert.ok(text.includes(COPY.cta), `LP §2 primary CTA is locked: "${COPY.cta}"`);

    // Matched as a name= or id= ATTRIBUTE VALUE rather than as a bare substring:
    // "email" and "phone" both occur incidentally on this page (a mailto: link, a
    // tel: link, an icon class), so includes() would pass whether or not the input
    // exists.
    for (const field of ['firstName', 'lastName', 'phone', 'email', 'password']) {
      assert.ok(
        new RegExp(`(?:name|id)\\s*=\\s*["']${escapeRe(field)}["']`).test(res.raw),
        `POST /api/signup requires "${field}" — the marketing form must carry an input bound to it`
      );
    }
    assert.ok(
      res.raw.includes('inviteSlug'),
      'POST /api/signup requires "inviteSlug", and A18 keeps it that way — marketing mode carries a ' +
      'token rather than asking the endpoint to trust the hostname'
    );

    assertCssVar(res.raw, 'brand-primary', BRAND_A.primary, 'the marketing page must carry the contractor theme');
    assertCssVar(res.raw, 'brand-bg', BRAND_A.bg, 'the marketing page must carry the contractor theme');
    assert.ok(
      text.includes(BRAND_A.phone) && text.includes(BRAND_A.email),
      'the marketing page must carry the contractor contact card (LP §2 footer / LP-1)'
    );
  });

  it('[RED] the marketing page carries NO referrer chip', async () => {
    // A17: attributed "to the contractor with no personal referrer". A12: the chip
    // renders for `peer` and `rep` — the two link types with a personal owner —
    // and NEVER for `contractor`. There is no owner here to name, and inventing
    // one would be a false claim printed at a homeowner.
    //
    // NON-VACUITY: 200, the State 1 headline and the signup card title are all
    // asserted present first, so this proves a RENDERED marketing page with no
    // chip on it — not a 404, and not a page that failed to render any copy.
    const res = await getMarketing(SLUG_A);

    assertRenderedPage(res, 'bare subdomain');
    const text = renderedText(res.raw);
    assert.ok(text.includes(COPY.headline(BRAND_A.programName)), 'precondition: State 1 must render');
    assert.ok(text.includes(COPY.cardTitle), 'precondition: the signup card must render');

    assert.equal(
      text.includes(COPY.chipPrefix), false,
      'a contractor marketing token has no personal owner — marketing mode must render no chip (A12/A17)'
    );
  });

  it('[RED] two contractors get two marketing pages with no branding bleed', async () => {
    // The white-label failure this whole arc exists to prevent, on the surface
    // where the hostname is the ONLY input the visitor supplied — which is exactly
    // where a resolver that leaked would leak.
    const a = await getMarketing(SLUG_A);
    const b = await getMarketing(SLUG_B);

    assertRenderedPage(a, "A's marketing page");
    assertRenderedPage(b, "B's marketing page");
    const textA = renderedText(a.raw);
    const textB = renderedText(b.raw);

    assert.ok(textA.includes(BRAND_A.companyName), "precondition: A's page must name A");
    assert.ok(textB.includes(BRAND_B.companyName), "precondition: B's page must name B");

    assert.equal(textA.includes(BRAND_B.companyName), false, "A's marketing page must never name B");
    assert.equal(textB.includes(BRAND_A.companyName), false, "B's marketing page must never name A");
    assert.equal(a.raw.includes(BRAND_B.primary), false, "A's marketing page must never carry B's palette");
    assert.equal(b.raw.includes(BRAND_A.primary), false, "B's marketing page must never carry A's palette");
  });

  it('[RED] an unclaimed subdomain takes the neutral State 0 path — not a crash, and not a mint', async () => {
    // LP §6.4: "Unknown slug → State 0 (neutral)." A wildcard DNS record means
    // EVERY label under roofmiles.com reaches this server, forever, including
    // typos and probes, so this is ordinary traffic rather than an edge case.
    //
    // TWO SEPARATE CLAIMS, and the second is the one with teeth:
    //   1. it renders rather than throwing — 200, HTML, State 0 copy, no branding
    //      from either real tenant;
    //   2. it MINTS NOTHING. Auto-mint keyed on an unresolved host would let any
    //      passer-by fill this table by walking subdomains.
    const before = await totalTokenCount();
    assert.equal(before, 0, 'precondition: the fixture starts with no tokens');

    const res = await httpGet(port, MARKETING_PATH, { host: hostFor(SLUG_UNCLAIMED) });

    assertRenderedPage(res, 'unclaimed subdomain');
    const text = renderedText(res.raw);
    assert.ok(
      text.includes(COPY.invalidHeadline),
      `an unclaimed subdomain must render LP §2 State 0: "${COPY.invalidHeadline}"`
    );
    assert.equal(
      text.includes(COPY.invalidContactSentence), false,
      'the NEUTRAL State 0 variant drops the contact sentence — there is nobody to contact'
    );
    assert.equal(
      text.includes(BRAND_A.companyName) || text.includes(BRAND_B.companyName), false,
      'an unclaimed subdomain must name no contractor at all'
    );

    assert.equal(
      await totalTokenCount(), 0,
      'an unresolved host must mint nothing — otherwise walking subdomains fills this table'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. AUTO-MINT (A18)
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] the first serve mints exactly ONE contractor token, marks it default and automatic, and the page carries it', async () => {
    // A18: "Each contractor gets a link_type='contractor' token minted on demand,
    // the first time their bare subdomain is served with no default present."
    //
    // The owner columns are asserted NULL because chk_invite_links_owner requires
    // it for `contractor` — a mint that set either would be rejected by the
    // database, so this doubles as a proof the minted row is shaped like a real
    // one rather than merely present.
    assert.equal((await tokenRows(TENANT_A)).length, 0, 'precondition: A has no tokens');

    const res = await getMarketing(SLUG_A);
    assertRenderedPage(res, 'first bare-subdomain serve');
    assert.ok(
      renderedText(res.raw).includes(COPY.cardTitle),
      'precondition: the page must actually render its signup card, not merely return 200'
    );

    const rows = await tokenRows(TENANT_A);
    assert.equal(rows.length, 1, `the first serve must mint exactly one token (got ${rows.length})`);

    const [row] = rows;
    assert.equal(row.link_type, 'contractor', "A18 mints a link_type='contractor' token");
    assert.equal(row.active, true, 'a marketing token is live from the moment it is minted');
    assert.equal(row.created_by_user_id, null, 'a contractor token has no personal owner (chk_invite_links_owner)');
    assert.equal(row.owner_team_member_id, null, 'a contractor token has no personal owner (chk_invite_links_owner)');
    assert.equal(row.redeemed_at, null, 'a freshly minted marketing token is unredeemed');
    assert.equal(row.expires_at, null, 'a marketing token on a truck wrap must not carry a silent expiry');

    assert.ok(
      res.raw.includes(row.slug),
      'the page must carry the token it was served under — the signup it fronts posts that exact slug ' +
      'back to POST /api/signup, and a page carrying no token has a form that cannot submit'
    );

    const markers = await markersFor(row.slug);
    assert.equal(markers.is_default, true, 'the minted token must be marked as this contractor\'s default marketing link');
    assert.equal(
      markers.auto_minted, true,
      'A18: the row must record that the PLATFORM minted it, so the admin marketing-links list can ' +
      'label it automatic and an admin never finds a link they cannot account for'
    );

    // Tenancy: minting for A must not have touched B.
    assert.equal((await tokenRows(TENANT_B)).length, 0, "serving A's subdomain must mint nothing for B");
  });

  it('[RED] a second serve reuses the first token and mints nothing', async () => {
    // The half that makes auto-mint safe rather than a leak. A mint-per-visit
    // would grow this table by one row per page load on a printed URL, and would
    // hand a different "referral code" to every visitor for the same campaign.
    const first = await getMarketing(SLUG_A);
    assertRenderedPage(first, 'first serve');

    const afterFirst = await tokenRows(TENANT_A);
    assert.equal(afterFirst.length, 1, 'precondition: the first serve must mint exactly one token');
    const mintedSlug = afterFirst[0].slug;

    const second = await getMarketing(SLUG_A);
    assertRenderedPage(second, 'second serve');

    const afterSecond = await tokenRows(TENANT_A);
    assert.equal(
      afterSecond.length, 1,
      `the second serve must reuse the existing default, not mint another (got ${afterSecond.length} rows)`
    );
    assert.equal(afterSecond[0].slug, mintedSlug, 'the reused token must be the same row, not a replacement');
    assert.ok(
      second.raw.includes(mintedSlug),
      'the second serve must carry the SAME token — otherwise two visitors to one printed URL sign up ' +
      'under different codes'
    );
  });

  it('[RED] the auto-minted token is multi-use and no signup ever redeems it', async () => {
    // inviteTokens.js's load-bearing rule: peer and contractor tokens are
    // MULTI-USE and nothing is ever written to the row; only `rep` redeems. A
    // marketing token that deactivated on its first signup would take a printed
    // truck-wrap URL out of service the moment one homeowner used it — and the
    // second homeowner would get State 0 with no way to tell why.
    const res = await getMarketing(SLUG_A);
    assertRenderedPage(res, 'first serve');
    const rows = await tokenRows(TENANT_A);
    assert.equal(rows.length, 1, 'precondition: the serve must have minted a token');
    const slug = rows[0].slug;

    const first = await httpPost(port, '/api/signup', signupBody({ inviteSlug: slug }));
    assert.equal(first.status, 201, `first marketing signup failed: ${JSON.stringify(first.body)}`);

    const second = await httpPost(port, '/api/signup', signupBody({ inviteSlug: slug, phone: '555-222-3333' }));
    assert.equal(
      second.status, 201,
      `a SECOND signup on the same marketing token must succeed: ${JSON.stringify(second.body)}`
    );

    const after = await tokenRows(TENANT_A);
    assert.equal(after.length, 1, 'signup must not mint or duplicate the marketing token');
    assert.equal(after[0].active, true, 'a marketing link must never be deactivated by a signup');
    assert.equal(after[0].redeemed_at, null, 'a contractor token is multi-use — nothing may write redeemed_at');
    assert.equal(after[0].redeemed_user_id, null, 'a contractor token is multi-use — nothing may write redeemed_user_id');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CONCURRENCY
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] concurrent first serves for one contractor yield exactly ONE default token', async () => {
    // ⚠ THIS MUST BE ENFORCED AT THE DATABASE LEVEL. The obvious implementation —
    // SELECT a default, and INSERT one if the SELECT found nothing — races: every
    // concurrent request reads "no default" before any of them writes, and all of
    // them insert. The window is small and the trigger is ordinary (a QR code
    // scanned by several people at once at an event, a link posted to a group
    // chat, a preview crawler fanning out), so it will happen in production and
    // will not happen in manual testing.
    //
    // What the fix looks like is not pinned here — a partial unique index over
    // (contractor_id) WHERE <default marker>, an exclusion constraint, or an
    // INSERT ... ON CONFLICT are all fine. What IS pinned is the outcome: one
    // token, and every concurrent visitor served the SAME one.
    //
    // GUARD-PROOF SITE: drop that constraint and re-run. If this test still
    // passes, it is not testing what it claims — it is testing that the local
    // machine happened to serialise eight requests.
    const FANOUT = 8;
    assert.equal((await tokenRows(TENANT_A)).length, 0, 'precondition: A has no tokens');

    const responses = await Promise.all(
      Array.from({ length: FANOUT }, () => getMarketing(SLUG_A))
    );

    responses.forEach((res, i) => assertRenderedPage(res, `concurrent serve ${i + 1}`));

    const rows = await tokenRows(TENANT_A);
    assert.equal(
      rows.length, 1,
      `${FANOUT} concurrent first-serves must leave exactly ONE marketing token, not ${rows.length}. ` +
      'A check-then-create in application code cannot produce this — the guard has to be a database constraint.'
    );

    const slug = rows[0].slug;
    responses.forEach((res, i) => {
      assert.ok(
        res.raw.includes(slug),
        `concurrent serve ${i + 1} carried a token that is not the surviving default — a request that ` +
        'loses the mint race must recover and serve the winner, never serve a row it failed to write'
      );
    });

    const markers = await markersFor(slug);
    assert.equal(markers.is_default, true, 'the surviving token must be the contractor\'s default');
  });

  it('[RED] concurrent serves for two different contractors mint one token EACH', async () => {
    // The counterweight to the test above, and the reason it is not enough on its
    // own: a constraint written one column too wide — UNIQUE on the marker alone
    // rather than on (contractor_id, marker) — produces exactly one default row
    // across the whole platform. That passes the previous test and silently gives
    // every contractor but the first a broken bare subdomain.
    const responses = await Promise.all([
      getMarketing(SLUG_A), getMarketing(SLUG_B),
      getMarketing(SLUG_A), getMarketing(SLUG_B),
    ]);
    responses.forEach((res, i) => assertRenderedPage(res, `interleaved serve ${i + 1}`));

    const rowsA = await tokenRows(TENANT_A);
    const rowsB = await tokenRows(TENANT_B);
    assert.equal(rowsA.length, 1, `A must end with exactly one marketing token (got ${rowsA.length})`);
    assert.equal(rowsB.length, 1, `B must end with exactly one marketing token (got ${rowsB.length})`);
    assert.notEqual(rowsA[0].slug, rowsB[0].slug, 'two contractors must not share a marketing token');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ADMIN OVERRIDE (A18)
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] an admin-designated default is served in preference to minting a new one', async () => {
    // A18: "Admins MAY designate a different existing marketing link as the
    // default." The designated row here is deliberately NOT the only marketing
    // token and NOT the newest one, so an implementation that picks "the most
    // recent contractor link" or "the only contractor link" passes for the wrong
    // reason and fails here.
    await seedMarketingToken(TENANT_A, 'admin-designated-default', { isDefault: true, autoMinted: false });
    await seedMarketingToken(TENANT_A, 'some-other-campaign-link', { isDefault: false, autoMinted: false });

    const res = await getMarketing(SLUG_A);
    assertRenderedPage(res, 'bare subdomain with a designated default');
    assert.ok(
      renderedText(res.raw).includes(COPY.cardTitle),
      'precondition: the page must render its signup card'
    );

    assert.ok(
      res.raw.includes('admin-designated-default'),
      "the page must carry the admin's designated default marketing link"
    );
    assert.equal(
      res.raw.includes('some-other-campaign-link'), false,
      'the page must not carry a non-default marketing link'
    );
  });

  it('[RED] a designated default suppresses auto-mint entirely, across repeated serves', async () => {
    // The second half of A18's override, and the one an admin would notice: if a
    // designated default did not suppress the mint, every contractor who set one
    // would find an unexplained extra "automatic" link in their list — precisely
    // the outcome A18's labelling requirement exists to prevent.
    await seedMarketingToken(TENANT_A, 'designated-and-permanent', { isDefault: true, autoMinted: false });
    assert.equal((await tokenRows(TENANT_A)).length, 1, 'precondition: exactly the designated row exists');

    for (let i = 0; i < 3; i += 1) {
      const res = await getMarketing(SLUG_A);
      assertRenderedPage(res, `serve ${i + 1} with a designated default`);
      assert.ok(res.raw.includes('designated-and-permanent'), `serve ${i + 1} must carry the designated default`);
    }

    const rows = await tokenRows(TENANT_A);
    assert.equal(
      rows.length, 1,
      `a designated default must suppress auto-mint on every serve (found ${rows.length} rows)`
    );
  });

  it('[RED] marketing tokens that are NOT designated default do not suppress auto-mint', async () => {
    // A18 mints "the first time their bare subdomain is served WITH NO DEFAULT
    // PRESENT" — not "with no marketing link present". The distinction is the
    // whole reason the marker column exists: a contractor may hold several
    // campaign links and have designated none of them, and the bare subdomain
    // still has to resolve to exactly one.
    //
    // An implementation that tests `link_type='contractor'` rather than the
    // default marker passes every other test in this section and fails here — it
    // would silently adopt an arbitrary campaign link as the subdomain's identity.
    await seedMarketingToken(TENANT_A, 'campaign-link-one', { isDefault: false, autoMinted: false });
    await seedMarketingToken(TENANT_A, 'campaign-link-two', { isDefault: false, autoMinted: false });

    const res = await getMarketing(SLUG_A);
    assertRenderedPage(res, 'bare subdomain with marketing links but no default');

    const rows = await tokenRows(TENANT_A);
    assert.equal(rows.length, 3, `a contractor with no DEFAULT must get one minted (found ${rows.length} rows)`);

    const minted = rows.find(r => r.slug !== 'campaign-link-one' && r.slug !== 'campaign-link-two');
    assert.ok(minted, 'precondition: a new row must have been minted');
    assert.ok(res.raw.includes(minted.slug), 'the page must carry the newly minted default');

    const markers = await markersFor(minted.slug);
    assert.equal(markers.is_default, true, 'the minted token must be marked default');
    assert.equal(markers.auto_minted, true, 'the minted token must be labelled automatic (A18)');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SIGNUP THROUGH MARKETING MODE
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] a marketing signup stamps contractor_link, a NULL referrer, and the token\'s contractor', async () => {
    // A17's attribution shape, and A19's premise: "stamped signup_source =
    // 'contractor_link' with a null invited_by_user_id". Both halves are load-
    // bearing. `signup_source` is what tells a later re-attribution pass which
    // rows are candidates; a null `invited_by_user_id` is what makes them
    // candidates in the first place.
    //
    // The end-to-end path is what is tested — serve the page, take the token the
    // page was served under, post it — rather than a hand-seeded token, because
    // the thing that can break is the JOIN between them.
    const page = await getMarketing(SLUG_A);
    assertRenderedPage(page, 'bare subdomain');
    const rows = await tokenRows(TENANT_A);
    assert.equal(rows.length, 1, 'precondition: the serve must have minted a marketing token');
    const slug = rows[0].slug;
    assert.ok(page.raw.includes(slug), 'precondition: the page must carry the token it minted');

    const email = `mkt-attrib-${Date.now()}@test.invalid`;
    const res = await httpPost(port, '/api/signup', signupBody({ email, inviteSlug: slug }));
    assert.equal(res.status, 201, `marketing signup must succeed: ${JSON.stringify(res.body)}`);

    const { rows: users } = await pool.query(
      `SELECT contractor_id, signup_source, invited_by_user_id, invite_slug
         FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    assert.equal(users.length, 1, 'exactly one user row must be created');
    const [user] = users;

    assert.equal(user.contractor_id, TENANT_A, 'contractor_id must come from the TOKEN row');
    assert.equal(user.signup_source, 'contractor_link', "A17/A19: a marketing signup is stamped 'contractor_link'");
    assert.equal(
      user.invited_by_user_id, null,
      'there is no personal referrer on a marketing signup — A19 records this as the population that will ' +
      'need after-the-fact re-attribution'
    );
    assert.equal(user.invite_slug, slug, 'the user row must record the token it arrived on');
  });

  it('[RED] a hostile Host header cannot override the token\'s contractor', async () => {
    // THE TENANCY PROOF, and the reason marketing mode routes through a token at
    // all rather than taking the shorter path of trusting the subdomain (A18, A5,
    // LP §6.4). The signup below arrives on B's subdomain carrying A's marketing
    // token — the exact shape an attacker produces by editing one header.
    //
    // TWO-TENANT AND TWO-SIDED: the user must land on A, and B must end the test
    // with no users at all. The second assertion is what catches an implementation
    // that writes the row twice or resolves the tenant per-statement.
    const page = await getMarketing(SLUG_A);
    assertRenderedPage(page, 'bare subdomain');
    const rows = await tokenRows(TENANT_A);
    assert.equal(rows.length, 1, 'precondition: the serve must have minted a marketing token for A');
    const slug = rows[0].slug;

    const email = `mkt-hostile-${Date.now()}@test.invalid`;
    const res = await httpPost(
      port, '/api/signup', signupBody({ email, inviteSlug: slug }),
      { host: hostFor(SLUG_B) }   // ← the hostile part: B's subdomain, A's token
    );
    assert.equal(res.status, 201, `signup must succeed on the token's authority: ${JSON.stringify(res.body)}`);

    const { rows: users } = await pool.query(
      `SELECT contractor_id FROM users WHERE LOWER(email) = LOWER($1)`, [email]
    );
    assert.equal(users.length, 1, 'exactly one user row must be created');
    assert.equal(
      users[0].contractor_id, TENANT_A,
      'the TOKEN is the tenancy authority and the hostname is cosmetic routing — a Host header must ' +
      'never move a signup between tenants'
    );

    const { rows: bUsers } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE contractor_id = $1`, [TENANT_B]
    );
    assert.equal(bUsers[0].n, 0, "the hostile host's contractor must receive no user at all");
  });

  it('[RED] the served marketing page identifies the TOKEN\'s contractor, never the hostname\'s', async () => {
    // The page-side half of the same rule. The document must carry the contractor
    // id the resend call needs (State 2 posts { email, contractorId } and fails
    // closed without it), and that id must be the token's.
    //
    // NON-VACUITY: 200 and the signup card are asserted first, and A's id is
    // asserted PRESENT before B's is asserted absent — so this is a rendered page
    // naming one tenant, not an empty body naming neither.
    const res = await getMarketing(SLUG_A);
    assertRenderedPage(res, 'bare subdomain');
    assert.ok(renderedText(res.raw).includes(COPY.cardTitle), 'precondition: the signup card must render');

    assert.ok(
      res.raw.includes(TENANT_A),
      'the resolved contractor id must be present in the served document — resend posts it and the ' +
      'endpoint fails closed to a generic 200 without it, a failure with no symptom'
    );
    assert.equal(
      res.raw.includes(TENANT_B), false,
      "no other tenant's id may appear in the served document"
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. A19 — THE GAP THAT MUST LEAVE A TRACE
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] the attribution site records A19 — these rows are the re-attribution population', async () => {
    // ⚠ A DOCUMENTATION FENCE, and the only source-grepping test in this suite.
    // Flagged as such deliberately: every other assertion here is about served
    // bytes or database rows.
    //
    // A19 is a requirement that produces NO behaviour — "nothing is built for this
    // now" — so there is nothing else to assert against. What A19 does require is
    // that the trace survives: "widening the marketing path without naming the
    // consequence would leave no trace of why." A17 manufactures a class of
    // signups that cannot be credited to the peer who actually made the referral,
    // and the next person reading the attribution branch is the person who needs
    // to know that.
    //
    // Deliberately loose on wording, strict on placement: the note must sit in the
    // file that assigns signup_source, not in a design document that the person
    // editing that branch will never open.
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'routes', 'referrer.js'), 'utf8'
    );

    const attributionIndex = source.indexOf("signupSource = 'contractor_link'");
    assert.notEqual(
      attributionIndex, -1,
      "precondition: POST /api/signup must still stamp 'contractor_link' — if this moved, move the note with it"
    );

    // The comment block that introduces the attribution branch, plus a generous
    // window after it. Not the whole file: a mention of A19 in an unrelated header
    // would satisfy this and teach nobody anything.
    const window = source.slice(Math.max(0, attributionIndex - 1500), attributionIndex + 1500);
    assert.ok(
      /A19|re-attribut/i.test(window),
      'A19 requires the gap to leave a trace at the attribution site: a comment recording that rows ' +
      "stamped 'contractor_link' with a null invited_by_user_id are the population a future " +
      'attribution engine must be able to re-attribute after the fact. Nothing is built for it now — ' +
      'the note is the deliverable.'
    );
  });
});
