'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3d-2 RED SUITE — LP §2 STATES 0-3, SERVER-RENDERED
//
// Phase 3d-1 shipped the PLUMBING for GET /i/:slug: the mount, the scoped CSP,
// the per-request nonce, server-side theme injection and a deliberately minimal
// placeholder body. This file pins the PAGE that replaces that body.
//
// GOVERNING DOCUMENTS, in precedence order:
//   1. DECISION_C_DL_BUILD_SPEC.md §13, amendments A8-A20
//   2. LANDING_PAGE_SPEC.md §2, whose copy is "final as written" everywhere the
//      amendments do not override it
// Where an amendment and LP's surrounding prose disagree, the amendment wins.
//
// ── WHAT THESE TESTS ASSERT ON, AND WHY THAT IS THE RIGHT BOUNDARY ──────────
// The served response body. This route's entire contract IS the document it
// emits — there is no React tree to mount, no component to render in isolation,
// and A8 chose server rendering precisely so the brand is correct on the FIRST
// PAINT rather than after a fetch. Asserting on the bytes the homeowner's browser
// receives is asserting on the product's actual output, not on source text.
//
// Deliberately NOT pinned: whether States 1/2/3 ship as markup in the document
// or as template strings inside the nonce'd script. Every assertion below runs
// against the whole response body, so either shape satisfies it. What IS pinned
// is that all three states arrive in ONE response — the state machine is
// client-side and a full-page reload loses userId, email and contractorId.
//
// ── COPY ASSERTIONS ARE BEHAVIOUR, NOT SOURCE-GREPPING ──────────────────────
// LP §2 marks its strings "copy is final as written; changes require a spec
// amendment", and A11 is what an amendment looks like. A copy assertion here
// catches an UNAMENDED copy change on the single most important attribution
// surface in the product — a real break, not a redesign tripwire.
//
// They run against `renderedText()`, which decodes the five HTML entities and
// collapses whitespace, so the assertion is about what the visitor READS. A
// literal apostrophe escaped to &#039; renders identically and must not fail a
// copy test; byte-level escaping is file 2's job (landingMarkupSafety.test.js).
//
// ── NON-VACUITY ────────────────────────────────────────────────────────────
// Every absence assertion below states, at its site, what proves the page
// actually rendered first. A 404, a 500 or an empty body satisfies "does not
// contain X" for entirely the wrong reason, and this suite has been bitten by
// exactly that shape before.
//
// ── THE TWO LABELS, AND WHY SOME OF THIS FILE IS GREEN ON ARRIVAL ──────────
// [RED]              fails against 3d-1's placeholder; 3d-2 makes it pass.
// [GREEN-by-design]  already satisfied by 3d-1, and kept as a REGRESSION FENCE.
//
// The second group is not padding and is not a mistake. 3d-1 deliberately built
// "a minimal document proving the whole pipe works end to end" — the theme block,
// the logo, the chip, the footer mark, per-tenant isolation. LP §2 says the
// placeholder body is "meant to be replaced WHOLESALE", and a wholesale
// replacement is exactly the operation that silently drops a working behaviour
// nobody thought to re-implement. These tests are what notices.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer, seedUser } = require('./helpers');

// ── FIXTURES ────────────────────────────────────────────────────────────────

const TENANT_A = 'test-tenant-lp-a';
const TENANT_B = 'test-tenant-lp-b';
const TENANT_BARE = 'test-tenant-lp-bare';       // every branding column NULL
const TENANT_NAMELESS = 'test-tenant-lp-nameless'; // no company name at all

const SLUG_A = 'alpharoofing';
const SLUG_B = 'betaroofing';
const SLUG_BARE = 'gammaroofing';
const SLUG_NAMELESS = 'deltaroofing';

const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;

// A9: the path is /i/<slug>. /r/ is void and appears nowhere in code.
const landingPath = slug => `/i/${slug}`;

// Garish and mutually exclusive, so a bleed between tenants is unmistakable in a
// failure message rather than a subtle near-match.
const BRAND_A = {
  companyName: 'Alpha Roofing Co',
  programName: 'Alpha Advantage',
  primary: '#AA1111',
  secondary: '#AA2222',
  accent: '#AA4444',
  bg: '#AA3333',
  logo: 'https://cdn.test.invalid/alpha-logo.png',
  phone: '555-0100',
  email: 'hello@alpha.invalid',
  address: '1 Alpha Way, Atlanta GA',
};
const BRAND_B = {
  companyName: 'Beta Roofing Co',
  programName: 'Beta Advantage',
  primary: '#BB1111',
  secondary: '#BB2222',
  accent: '#BB4444',
  bg: '#BB3333',
  logo: 'https://cdn.test.invalid/beta-logo.png',
  phone: '555-0200',
  email: 'hello@beta.invalid',
  address: null,
};

// RoofMiles fallback tokens (LP §5 / BRANDING_THEME_DEFAULTS). Hand-copied
// literals rather than an import of the resolver: a test that derives its
// expectation from the code under test passes whatever that code does.
const RM = {
  companyName: 'RoofMiles',
  // ⚠ SWAPPED WITH THE PLATFORM DEFAULTS IN B-1. These are the COLUMN values:
  // primary_color is the navy dark neutral, secondary_color the orange action
  // colour. Which CSS VARIABLE each one lands in is asserted below and is the
  // opposite pairing — --brand-primary carries the CTA.
  primary: '#1C2D4D',
  secondary: '#F26A1B',
  accent: '#FDF0E7',
  bg: '#FFFFFF',
};

// Distinctive surnames, chosen so "the full last name never reaches the page" is
// provable by a substring search that cannot collide with anything else on it.
const PEER_OWNER_NAME = 'Daniel Zylkiewicz';
const PEER_OWNER_SURNAME = 'Zylkiewicz';
const PEER_CHIP = 'Daniel Z.';
const REP_OWNER_NAME = 'Marcus Vandenbergh';
const REP_OWNER_SURNAME = 'Vandenbergh';
const REP_CHIP = 'Marcus V.';

// ── THE STORE-BADGE GATE (A14) ──────────────────────────────────────────────
// A14 rules the slot is built, gated by an env var and filled in the Capacitor
// session. It does not NAME the variable, so this suite proposes one; renaming
// it is a one-line change here and in the implementation.
//
// The gate is `!== 'true'`, copied from TWILIO_10DLC_ACTIVE's strict compare so
// it fails closed when unset — and, per A14 in terms, WITHOUT that precedent's
// additional `NODE_ENV === 'production'` clause, which would make the slot
// untestable on every non-production boot. The test below proves the absence of
// that clause rather than trusting it.
const BADGE_FLAG = 'STORE_BADGES_ACTIVE';

// LP §2 State 3 locks the official Apple and Google artwork; these are the
// accessible names that artwork carries, and they are what the filled slot must
// expose whether the assets have landed yet or not.
const APPLE_BADGE_LABEL = 'Download on the App Store';
const GOOGLE_BADGE_LABEL = 'Get it on Google Play';

// A stable hook for the slot itself. LP requires the slot to EXIST while empty
// (A14 — "ships the slot ... and fills it later"), and an empty slot is
// invisible in the markup without one.
const BADGE_SLOT_MARKER = 'data-store-badges';

// ── LP §2 COPY, VERBATIM ────────────────────────────────────────────────────
// Hand-transcribed from LANDING_PAGE_SPEC.md §2. Braced tokens are interpolated
// by the helpers below rather than matched literally.
const COPY = {
  // ── State 0 — AMENDED A21, POLISH ITEM 3 PHASE 2 ──────────────────────────
  // LP §2 marks its copy final and requires an amendment to change it. A21 is
  // that amendment (LANDING_PAGE_SPEC.md §2, DECISION_C_DL_BUILD_SPEC.md §14),
  // and the constants below are the openly-updated fence rather than a drifted
  // one. RETIRED, recorded here rather than deleted so a reader of this file can
  // see WHICH way the decision went:
  //
  //   headline  "This link isn't active"
  //   body      "This referral link isn't valid or may have expired. If someone
  //              sent it to you, ask them for a fresh link — or contact
  //              {Company Name} directly."
  //
  // The old headline stated the platform's problem rather than the visitor's,
  // and the body asked a homeowner to relay a technical failure to whoever
  // texted them. The replacement tells them where a WORKING link comes from.
  //
  // THE CONTACT SENTENCE IS GONE ENTIRELY, not reworded — the branded page now
  // carries a real contact block (phone · website · email) at the top instead of
  // a sentence pointing at one. `invalidContactSentence` is therefore deleted
  // rather than updated; nothing on the page corresponds to it any more. The
  // block itself is fenced in server/test/landingContactBlock.test.js, which
  // owns every assertion about its rows, ordering and presence gating.
  //
  // TWO VARIANTS, TWO HEADLINES. The single old string served both, which is why
  // one constant used to be enough. Branded and neutral are now different copy.
  invalidHeadlineBranded: "Let's get you the right link",
  invalidBodyBranded: company =>
    `To join ${company}'s referral program, use the link a neighbor or ${company} sent you. ` +
    "If it's expired, just ask them for a fresh one.",
  invalidHeadlineNeutral: "You'll need a referral link",
  invalidBodyNeutral:
    'RoofMiles referral links come from a contractor or a neighbor who referred you. ' +
    'Check your texts or email for the link they sent — that link is what connects you ' +
    'to the right company.',

  // State 1
  subhead: name => `Earn cash for referring friends and neighbors to ${name}.`,
  headline: program => `Join the ${program} rewards program`,
  step1Title: 'Share your personal link',
  step1Body: name => `Tell friends and neighbors about ${name}`,
  step2Title: 'They book a free inspection',
  step2Body: 'We take care of them like family',
  step3Title: 'You earn cash rewards',
  step3Body: 'Get paid when their job completes',
  cardTitle: 'Create your account',
  cta: 'Create my account',
  skipLink: 'Skip — just get the app',
  skipMicrocopy: "We'll copy your referral code so the app can connect you automatically.",
  chip: display => `Invited by ${display}`,
  poweredBy: 'Powered by',

  // State 2
  verifyHeadline: 'Check your email',
  verifySent: 'We sent a 6-digit code to',
  verifyButton: 'Verify',
  verifyError: "That code didn't match — try again.",
  verifyBack: 'Back',
  verifyResend: 'Resend code',
  verifyResendConfirm: 'Code sent',

  // State 3
  successHeadline: "You're in,",
  successBody: 'Your account is ready. Download the app to track your referrals and rewards.',
  // LP §2 State 3 reads "...email and PIN you just created", and its own inline
  // annotation corrects it: "('PIN' here should read 'password' per A11.)" The
  // annotation wins over the surrounding prose — see this file's precedence note
  // and the RED report, which flags this as a one-word decision for Danny.
  successReassurance: 'Sign in with the email and password you just created.',
};

// ── HTTP TRANSPORT ──────────────────────────────────────────────────────────
// Per-request X-Forwarded-For: server/app.js sets `trust proxy 1`, so
// express-rate-limit keys on it. Without per-test IPs the whole file shares one
// bucket and starts 429ing the moment a limiter is added to this route — a suite
// that passes RED and then breaks on GREEN for an unrelated reason.
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.91.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
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

// ── ASSERTION HELPERS ───────────────────────────────────────────────────────

// Decodes the five entities escapeHtml produces and collapses whitespace runs,
// so copy assertions describe what the VISITOR READS rather than which bytes
// carried it. An apostrophe escaped to &#039; renders identically on screen and
// must not fail a copy test.
//
// The ampersand is decoded LAST — the mirror of escapeHtml's order. Decoding it
// first would turn a literal, correctly-escaped "&amp;lt;" into "<".
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
// VARIABLE NAME as well as the colour, deliberately: C/DL-3's FieldRepApp is
// specified to consume "the same variables" this page declares (build spec §5),
// so the names are a cross-session contract rather than a local detail.
function assertCssVar(body, name, value, message) {
  const re = new RegExp(`--${name}\\s*:\\s*${escapeRe(value)}\\s*[;}]`, 'i');
  assert.ok(re.test(body), `${message} — expected --${name}:${value} in the served theme block`);
}

// Counts non-overlapping matches. Used where "exactly six" is the contract and
// "at least one" would pass with five boxes.
function countMatches(body, re) {
  const m = String(body).match(re);
  return m ? m.length : 0;
}

describe('C/DL-2 Phase 3d-2 — LP §2 States 0-3, server-rendered', () => {
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
    // nothing to do with the landing page. Sequence copied from
    // landingResolution.test.js, which already had it right.
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedTenant(TENANT_A, SLUG_A, BRAND_A);
    await seedTenant(TENANT_B, SLUG_B, BRAND_B);

    // Every branding column NULL — drives the RoofMiles-defaults assertions and
    // the "no logo, so render the company NAME" fallback.
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, 'Gamma Roofing Co', $2)`,
      [TENANT_BARE, SLUG_BARE]
    );
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, 'Gamma Roofing Co')`,
      [TENANT_BARE]
    );

    // No usable name from EITHER source. contractors.name is NOT NULL, so the
    // only reachable "nameless" state is the empty string — which the resolver's
    // firstNonEmpty treats as unset, exactly as it treats a cleared admin field.
    // This is the ONLY fixture that can exercise the last-resort branch.
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, '', $2)`,
      [TENANT_NAMELESS, SLUG_NAMELESS]
    );
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, NULL)`,
      [TENANT_NAMELESS]
    );
  });

  async function seedTenant(contractorId, slug, brand) {
    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [contractorId, brand.companyName, slug]
    );
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, app_display_name, primary_color, secondary_color,
          accent_color, landing_bg_color, logo_url, company_phone, company_email, company_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        contractorId, brand.companyName, brand.programName, brand.primary, brand.secondary,
        brand.accent, brand.bg, brand.logo, brand.phone, brand.email, brand.address,
      ]
    );
  }

  let _slugCounter = 0;
  function uniqueSlug(prefix) {
    _slugCounter += 1;
    return `${prefix}-${Date.now()}-${_slugCounter}`;
  }

  // link_type-appropriate owner columns only — chk_invite_links_owner rejects the
  // wrong pairing, so this helper is also a small proof the fixtures are shaped
  // like real rows.
  async function mintToken({
    contractorId, linkType = 'peer', createdByUserId = null, ownerTeamMemberId = null,
    active = true, expiresAt = null,
  }) {
    const slug = uniqueSlug(`tok-${linkType}`);
    await pool.query(
      `INSERT INTO contractor_invite_links
         (contractor_id, slug, link_type, created_by_user_id, owner_team_member_id, active, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [contractorId, slug, linkType, createdByUserId, ownerTeamMemberId, active, expiresAt]
    );
    return slug;
  }

  async function seedTeamMember({ contractorId, fullName, email }) {
    const { rows } = await pool.query(
      `INSERT INTO team_members (contractor_id, email, password_hash, tier, full_name, is_field_rep)
       VALUES ($1, $2, 'hash', 'staff', $3, true)
       RETURNING id`,
      [contractorId, email, fullName]
    );
    return rows[0].id;
  }

  // The State 1 page every section below starts from: a valid marketing token on
  // its own subdomain. Returns the response so callers can gate on it.
  async function getState1(contractorId = TENANT_A, slug = SLUG_A) {
    const token = await mintToken({ contractorId, linkType: 'contractor' });
    return httpGet(port, landingPath(token), { host: hostFor(slug) });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. STATE 0 — INVALID
  // ═══════════════════════════════════════════════════════════════════════════

  it('[GREEN-by-design] every invalid cause is a 200 HTML page, never a 404 and never JSON', async () => {
    // Already satisfied by 3d-1's placeholder and kept as a regression fence, not
    // reported as a surprise. LP §2 State 0 is a PAGE: a homeowner holding a dead
    // link must see a branded explanation and a way to reach the contractor, not
    // a browser error and not a raw JSON object. The distinction lives in the
    // body, never in the status code.
    const expired = await mintToken({
      contractorId: TENANT_A, linkType: 'contractor', expiresAt: new Date(Date.now() - 60_000),
    });
    const revoked = await mintToken({ contractorId: TENANT_A, linkType: 'contractor', active: false });
    const mismatched = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const cases = [
      ['unknown token', landingPath('no-such-token-anywhere'), hostFor(SLUG_A)],
      ['expired token', landingPath(expired), hostFor(SLUG_A)],
      ['revoked token', landingPath(revoked), hostFor(SLUG_A)],
      ['token↔subdomain mismatch', landingPath(mismatched), hostFor(SLUG_B)],
    ];

    for (const [label, path, host] of cases) {
      const res = await httpGet(port, path, { host });
      assert.equal(res.status, 200, `${label}: State 0 is a page, not a 404 (got ${res.status})`);
      assert.match(res.contentType, /text\/html/i, `${label}: State 0 must be HTML, not JSON`);
    }
  });

  it('[RED] every ordinary invalid cause renders LP State 0 headline and body copy', async () => {
    // Table-driven over the three causes that are NOT a mismatch. A mismatch is
    // different in kind (two sources actively disagreeing) and gets its own tests
    // below; folding it in here would hide the branding difference between them.
    const expired = await mintToken({
      contractorId: TENANT_A, linkType: 'contractor', expiresAt: new Date(Date.now() - 60_000),
    });
    const revoked = await mintToken({ contractorId: TENANT_A, linkType: 'contractor', active: false });

    const cases = [
      ['unknown token', 'no-such-token-anywhere'],
      ['expired token', expired],
      ['revoked token', revoked],
    ];

    for (const [label, token] of cases) {
      const res = await httpGet(port, landingPath(token), { host: hostFor(SLUG_A) });
      assert.equal(res.status, 200, `${label}: precondition — State 0 must render (got ${res.status})`);

      // ALL THREE CAUSES ARE BRANDED. The host slug resolves in every one of
      // them and nothing is in conflict, so buildInvalidPayload attaches the
      // subdomain contractor's branding — which after A21 also decides WHICH
      // headline renders.
      const text = renderedText(res.raw);
      assert.ok(
        text.includes(COPY.invalidHeadlineBranded),
        `${label}: the branded State 0 headline is locked as "${COPY.invalidHeadlineBranded}" (A21)`
      );
      assert.ok(
        text.includes(COPY.invalidBodyBranded(BRAND_A.companyName)),
        `${label}: the branded State 0 body copy is locked and missing. Expected to contain: ` +
        `"${COPY.invalidBodyBranded(BRAND_A.companyName)}"`
      );
    }
  });

  it('[RED] an invalid token on a RESOLVED subdomain renders that contractor\'s branding', async () => {
    // LP §2 State 0: "Contractor branding if the slug resolved." The subdomain is
    // the only signal present here and nothing is in conflict, so the homeowner
    // gets a page that looks like the roofer whose sign they scanned — and the
    // contact sentence that gives them a way to reach that roofer.
    //
    // NOTE FOR THE IMPLEMENTER: resolveLanding returns a bare { valid: false } for
    // this case today, carrying no branding from either side. The ordinary-invalid
    // and mismatch paths are currently indistinguishable to the route, so this
    // test and the next one cannot both pass without that distinction being made.
    const revoked = await mintToken({ contractorId: TENANT_A, linkType: 'contractor', active: false });

    const res = await httpGet(port, landingPath(revoked), { host: hostFor(SLUG_A) });

    assert.equal(res.status, 200, `precondition: State 0 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(text.includes(COPY.invalidHeadlineBranded), 'precondition: this must be the BRANDED State 0 page');

    assert.ok(
      text.includes(BRAND_A.companyName),
      `a resolved-slug State 0 must carry the subdomain contractor's name (${BRAND_A.companyName})`
    );
    // A21 REPLACED THE CONTACT SENTENCE WITH THE BODY COPY ITSELF, which names
    // the contractor twice — a stronger version of the same claim this assertion
    // has always made: a branded State 0 must be about THIS company, not a
    // generic failure page wearing their colours. The old "— or contact {Company}
    // directly." sentence is gone; the affordance it pointed at is now a real
    // contact block, fenced in server/test/landingContactBlock.test.js.
    assert.ok(
      text.includes(COPY.invalidBodyBranded(BRAND_A.companyName)),
      `the branded body must name the contractor: "${COPY.invalidBodyBranded(BRAND_A.companyName)}"`
    );
    assertCssVar(res.raw, 'brand-primary', BRAND_A.secondary, 'a resolved-slug State 0 must carry the contractor theme');
  });

  it('[RED] a token↔subdomain MISMATCH renders neutral branding and names neither side', async () => {
    // RULED (C/DL-2 Phase 2a, recorded at landingResolution.test.js): a mismatch
    // happens only through tampering or miswiring, so trust NEITHER source.
    // Rendering the host's branding would confirm to a prober that that subdomain
    // resolves to a real contractor; rendering the token's would do the same for
    // the token.
    //
    // NON-VACUITY: status 200, the State 0 headline, and the RoofMiles NEUTRAL
    // theme are all asserted BEFORE the two absence checks. Without them, today's
    // placeholder — which emits no theme block at all when there is no contractor
    // — satisfies "contains neither company name" while proving nothing.
    const token = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, landingPath(token), { host: hostFor(SLUG_B) });

    assert.equal(res.status, 200, `precondition: State 0 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(text.includes(COPY.invalidHeadlineNeutral), 'precondition: this must be the NEUTRAL State 0 page');
    assertCssVar(res.raw, 'brand-secondary', RM.primary, 'a mismatch must render the NEUTRAL RoofMiles theme');

    assert.equal(
      text.includes(BRAND_A.companyName), false,
      "a mismatch must not name the TOKEN's contractor — that confirms the token is real"
    );
    assert.equal(
      text.includes(BRAND_B.companyName), false,
      "a mismatch must not name the SUBDOMAIN's contractor — that confirms the subdomain resolves"
    );
    assert.equal(
      res.raw.includes(BRAND_A.primary) || res.raw.includes(BRAND_B.primary), false,
      "a mismatch must not carry either side's palette"
    );
  });

  it('[RED] the neutral State 0 variant offers no way to contact anybody', async () => {
    // ── REWRITTEN UNDER A21, AND THE CLAIM IS THE SAME ONE ────────────────────
    // This test used to read "the neutral variant drops the contact sentence",
    // against LP §2's "(Neutral variant drops the contact sentence.)" That
    // sentence no longer exists on EITHER variant — the branded page carries a
    // real contact block instead of a line pointing at one — so an assertion
    // about its absence would now pass on a page that had never rendered it and
    // would be worth nothing.
    //
    // WHAT LP ACTUALLY MEANT SURVIVES INTACT: there is nobody to contact here, so
    // the page must offer no contact route at all. Under the old copy that was
    // provable by one missing sentence; under the new one it is provable
    // directly, which is strictly stronger — it now also catches a contact block
    // leaking onto the neutral page, which is the shape this could break in.
    //
    // NON-VACUITY: the neutral headline and body are asserted present first, so
    // the absences below prove a rendered neutral page carrying no contact route
    // rather than a page that failed to render.
    const token = await mintToken({ contractorId: TENANT_A, linkType: 'contractor' });

    const res = await httpGet(port, landingPath(token), { host: hostFor(SLUG_B) });

    assert.equal(res.status, 200, `precondition: State 0 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(text.includes(COPY.invalidHeadlineNeutral), 'precondition: this must be the NEUTRAL State 0 page');
    assert.ok(text.includes(COPY.invalidBodyNeutral), 'precondition: the neutral State 0 body copy must be present');

    assert.equal(
      /href\s*=\s*["']tel:/i.test(res.raw), false,
      'a mismatch trusts neither source — a phone number on this page could only have come from one of them'
    );
    assert.equal(
      /href\s*=\s*["']mailto:/i.test(res.raw), false,
      'a mismatch trusts neither source — an email address on this page could only have come from one of them'
    );
    assert.equal(
      res.raw.includes('data-contact-block'), false,
      'the contact block is a BRANDED-only affordance; there is no contractor here to contact'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. STATE 1 — LANDING + SIGNUP
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] State 1 renders LP\'s headline and subhead from the resolved theme', async () => {
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);

    assert.ok(
      text.includes(COPY.headline(BRAND_A.programName)),
      `LP §2 State 1 headline is locked: "${COPY.headline(BRAND_A.programName)}"`
    );
    assert.ok(
      text.includes(COPY.subhead(BRAND_A.companyName)),
      `LP §2 State 1 subhead is locked: "${COPY.subhead(BRAND_A.companyName)}"`
    );
  });

  it('[GREEN-by-design] the headline degrades to the company name when no program name is set', async () => {
    // programName has NO platform default, deliberately (brandingTheme.js:
    // "'Rooster Booster' is this platform's internal codename, not a program name
    // any contractor would choose"). The headline must therefore degrade, and the
    // break this catches is the literal "Join the null rewards program" — or
    // "undefined", which is the same bug in a different font.
    const res = await getState1(TENANT_BARE, SLUG_BARE);

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);

    assert.ok(
      text.includes(COPY.headline('Gamma Roofing Co')),
      'with no app_display_name the headline must fall back to the company name'
    );
    assert.equal(
      /Join the (null|undefined|)\s*rewards program/.test(text), false,
      'the headline interpolated an unset program name'
    );
  });

  it('[RED] State 1 renders the three how-it-works steps verbatim', async () => {
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);

    const steps = [
      COPY.step1Title, COPY.step1Body(BRAND_A.companyName),
      COPY.step2Title, COPY.step2Body,
      COPY.step3Title, COPY.step3Body,
    ];
    for (const line of steps) {
      assert.ok(text.includes(line), `LP §2 how-it-works copy is locked and missing: "${line}"`);
    }
  });

  it('[RED] the signup card carries all five A11 fields plus the invite slug', async () => {
    // A11 VOIDS LP's field list. The live POST /api/signup requires firstName,
    // lastName, phone, email, password AND inviteSlug, and answers "All fields are
    // required." if any is absent. PHONE is the one LP omitted entirely, and its
    // absence is what would make every submission from this page fail at the door.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(text.includes(COPY.cardTitle), `LP §2 signup card title is locked: "${COPY.cardTitle}"`);
    assert.ok(text.includes(COPY.cta), `LP §2 primary CTA is locked: "${COPY.cta}"`);

    // Matched as a name= or id= ATTRIBUTE VALUE rather than as a bare substring.
    // "email" and "phone" both occur incidentally on this page — a mailto: link, a
    // tel: link, an icon class — so a bare includes() would pass for firstName and
    // lastName and then pass for phone whether or not the field A11 added exists.
    // Pinning the attribute is what makes the phone assertion real.
    for (const field of ['firstName', 'lastName', 'phone', 'email', 'password']) {
      assert.ok(
        new RegExp(`(?:name|id)\\s*=\\s*["']${escapeRe(field)}["']`).test(res.raw),
        `POST /api/signup requires "${field}" — the form must carry an input bound to it ` +
        'or the endpoint answers "All fields are required." on every submission'
      );
    }

    // The sixth key. Not a visible input — the page holds the slug it was served
    // under and posts it — but the endpoint refuses without it, and no other
    // spelling reaches it.
    assert.ok(
      res.raw.includes('inviteSlug'),
      'POST /api/signup requires "inviteSlug"; without it the token never stamps contractor_id'
    );
  });

  it('[RED] the credential field is a masked 6-character password, not a 4-digit PIN', async () => {
    // The second half of A11, and the half most likely to survive a careless read
    // of LP §2: "Create a PIN (4-digit, numeric keypad, masked; helper text '4
    // digits, numbers only')" is VOID. POST /api/signup rejects any credential
    // under 6 characters outright.
    //
    // NON-VACUITY: the signup card title and a masked input are both asserted
    // present before the absence checks, so "no 4-digit hint" cannot pass because
    // the form is missing.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(text.includes(COPY.cardTitle), 'precondition: the signup card must render');
    assert.ok(
      /type\s*=\s*["']password["']/i.test(res.raw),
      'the credential input must be masked (type="password")'
    );

    assert.ok(
      /6[\s-]?character/i.test(text),
      'helper text must state the 6-character minimum (A11 voids "4 digits, numbers only")'
    );
    assert.equal(
      /4 digits/i.test(text), false,
      'the "4 digits, numbers only" helper text is VOID (A11)'
    );
    assert.equal(
      /maxlength\s*=\s*["']?4["']?/i.test(res.raw), false,
      'a maxlength of 4 on this page can only be the voided 4-digit PIN'
    );
  });

  it('[GREEN-by-design] a PEER token renders the chip as first name + last initial', async () => {
    const userId = await seedUser(pool, {
      fullName: PEER_OWNER_NAME, email: 'peer-owner@alpha.invalid', contractorId: TENANT_A,
    });
    const token = await mintToken({ contractorId: TENANT_A, linkType: 'peer', createdByUserId: userId });

    const res = await httpGet(port, landingPath(token), { host: hostFor(SLUG_A) });

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(
      text.includes(COPY.chip(PEER_CHIP)),
      `LP §2 locks the chip format: "${COPY.chip(PEER_CHIP)}"`
    );
  });

  it('[GREEN-by-design] a REP token renders the chip too — A12 makes rep a live owner type', async () => {
    // A12: the chip renders for `peer` AND `rep`, the two link types with a
    // personal owner. LP called rep "future"; it has been a live enum value since
    // C/DL-1. A chip implementation that special-cases only `peer` passes the test
    // above and fails this one, which is the whole reason both exist.
    const memberId = await seedTeamMember({
      contractorId: TENANT_A, fullName: REP_OWNER_NAME, email: 'rep-owner@alpha.invalid',
    });
    const token = await mintToken({ contractorId: TENANT_A, linkType: 'rep', ownerTeamMemberId: memberId });

    const res = await httpGet(port, landingPath(token), { host: hostFor(SLUG_A) });

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(
      text.includes(COPY.chip(REP_CHIP)),
      `a rep token must render a chip (A12): "${COPY.chip(REP_CHIP)}"`
    );
  });

  it('[GREEN-by-design] the owner\'s full surname reaches the page for neither peer nor rep', async () => {
    // LP §7: the full last name is never SENT to the page, not merely never
    // displayed by it. A page that receives it has already leaked it, whatever it
    // then chooses to render.
    //
    // NON-VACUITY: for each link type the REDACTED chip is asserted present first,
    // which proves the owner row was found, joined and rendered. Without that, a
    // page that failed to resolve any owner at all would satisfy "the surname is
    // absent" for exactly the wrong reason.
    const userId = await seedUser(pool, {
      fullName: PEER_OWNER_NAME, email: 'peer-owner@alpha.invalid', contractorId: TENANT_A,
    });
    const memberId = await seedTeamMember({
      contractorId: TENANT_A, fullName: REP_OWNER_NAME, email: 'rep-owner@alpha.invalid',
    });
    const peerToken = await mintToken({ contractorId: TENANT_A, linkType: 'peer', createdByUserId: userId });
    const repToken = await mintToken({ contractorId: TENANT_A, linkType: 'rep', ownerTeamMemberId: memberId });

    const cases = [
      ['peer', peerToken, PEER_CHIP, PEER_OWNER_SURNAME],
      ['rep', repToken, REP_CHIP, REP_OWNER_SURNAME],
    ];

    for (const [label, token, chip, surname] of cases) {
      const res = await httpGet(port, landingPath(token), { host: hostFor(SLUG_A) });

      assert.equal(res.status, 200, `${label}: precondition — State 1 must render (got ${res.status})`);
      assert.ok(
        renderedText(res.raw).includes(COPY.chip(chip)),
        `${label}: precondition — the redacted chip must render, proving the owner was resolved`
      );

      assert.equal(
        res.raw.includes(surname), false,
        `${label}: the full surname "${surname}" reached the page — redaction must happen server-side`
      );
    }
  });

  it('[RED] a CONTRACTOR marketing token renders no chip at all', async () => {
    // A12: never a chip for `contractor` — there is no personal owner to name.
    //
    // NON-VACUITY: the State 1 headline is asserted present first, so this proves
    // a rendered page WITHOUT a chip rather than an unrendered page. The peer and
    // rep tests above are the second half of the proof: they show the chip does
    // render when it should, so its absence here is a decision and not a bug.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(
      text.includes(COPY.headline(BRAND_A.programName)),
      'precondition: this must be a fully rendered State 1 page'
    );

    assert.equal(
      text.includes('Invited by'), false,
      'a contractor marketing token has no personal owner — it must render no chip (A12)'
    );
  });

  it('[RED] the skip affordance renders with the binding DL-5 disclosure copy', async () => {
    // The LINK and its microcopy are State 1 and in scope. The interstitial
    // BEHAVIOUR it triggers — clipboard write, confirmation, store redirect — is
    // LP §2's separate "skip-path interstitial" subsection and belongs to 3d-3.
    // LP marks the microcopy "Exact DL-5 disclosure #1 wording — binding", which
    // is a stronger lock than the rest of §2's copy.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);

    assert.ok(text.includes(COPY.skipLink), `LP §2 secondary link is locked: "${COPY.skipLink}"`);
    assert.ok(
      text.includes(COPY.skipMicrocopy),
      `the DL-5 disclosure wording is BINDING, not merely locked: "${COPY.skipMicrocopy}"`
    );
  });

  it('[GREEN-by-design] the footer RoofMiles mark is #F26A1B in every theme, including a themed one', async () => {
    // LP §2 footer: the word RoofMiles in #F26A1B "in EVERY theme (hardcoded
    // exception, deliberate)". The break this catches is the natural-looking
    // mistake of painting it with var(--brand-primary), which on Alpha's page
    // would render the RoofMiles mark in Alpha's red.
    //
    // Asserted on a HEAVILY THEMED tenant rather than the bare one: on the bare
    // fixture --brand-primary already resolves to #F26A1B, so the wrong
    // implementation would pass there.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(text.includes(COPY.poweredBy), `LP §2 footer copy is locked: "${COPY.poweredBy} RoofMiles"`);
    assert.ok(text.includes(RM.companyName), 'the RoofMiles mark must appear in the footer');

    // ⚠ A LITERAL, NOT RM.primary, SINCE B-1 (2026-09-01) — AND THE COUPLING IT
    // REPLACES IS THE INTERESTING PART. This read `RM.primary`, which happened to
    // equal the wordmark orange only because the platform's primary_color WAS
    // #F26A1B. The route swap made primary_color navy and this assertion started
    // demanding a navy RoofMiles mark — a test failing because a value it was
    // borrowing moved out from under it, not because anything it guards changed.
    // The mark is a BRAND ASSET hardcoded in landing.js's `.powered b` rule; it
    // is not a token and must not track one. Naming it here as its own constant
    // is what stops the next palette decision reaching it.
    const ROOFMILES_WORDMARK = '#F26A1B';
    assert.ok(
      res.raw.includes(ROOFMILES_WORDMARK),
      `the RoofMiles mark must be hardcoded ${ROOFMILES_WORDMARK} in every theme — not ` +
      `var(--brand-primary), which on this fixture would paint it ${BRAND_A.secondary}`
    );
  });

  it('[RED] the footer contact card renders phone, email and address when all are set', async () => {
    // LP §2 footer: "contact card (§LP-1) · divider · Powered by RoofMiles". LP-1
    // was closed as recommended and the resolver already emits all three values,
    // so the break this catches is a footer that ships the RoofMiles mark and
    // forgets the half of it that lets a homeowner reach the roofer.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);

    assert.ok(text.includes(BRAND_A.phone), `the contact card must render company_phone (${BRAND_A.phone})`);
    assert.ok(text.includes(BRAND_A.email), `the contact card must render company_email (${BRAND_A.email})`);
    assert.ok(text.includes(BRAND_A.address), `the contact card must render company_address (${BRAND_A.address})`);
  });

  it('[RED] an unset address never renders as a null or undefined row', async () => {
    // LP-1's rule, and the resolver implements the server half of it: `address` is
    // OMITTED from the payload, never set to null, when company_address is unset —
    // "the footer decides whether to draw the contact row by the key's PRESENCE,
    // so a null would render an empty row where no row belongs."
    //
    // The page half of that rule is what this pins. Whether an empty ROW is drawn
    // is a visual question with no server-side observable; whether the literal
    // "null" is printed at a homeowner is not, and it is the failure a
    // presence-blind footer actually produces.
    //
    // NON-VACUITY: 200, plus B's phone AND email asserted present — so this is a
    // rendered contact card missing only its address, not a missing card. The
    // test above is the other half: it proves the address DOES render when set.
    const res = await getState1(TENANT_B, SLUG_B);

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(text.includes(BRAND_B.phone), 'precondition: the contact card must render B\'s phone');
    assert.ok(text.includes(BRAND_B.email), 'precondition: the contact card must render B\'s email');

    // Tags stripped, so attribute values — most importantly the base64url nonce,
    // which could in principle contain either word — cannot satisfy the match.
    const visible = text.replace(/<[^>]*>/g, ' ');
    assert.equal(
      /\b(?:null|undefined)\b/.test(visible), false,
      'an unset company_address was interpolated into visible copy'
    );
  });

  it('[GREEN-by-design] two contractors get two pages with no branding bleed', async () => {
    // The requirement this arc exists for. Asserted in BOTH directions, because a
    // single-direction check passes against an implementation that has simply
    // pinned one tenant's values.
    //
    // NON-VACUITY: each page's OWN company name and palette are asserted present
    // before the other tenant's are asserted absent.
    const resA = await getState1(TENANT_A, SLUG_A);
    const resB = await getState1(TENANT_B, SLUG_B);

    assert.equal(resA.status, 200, `precondition: A's page must render (got ${resA.status})`);
    assert.equal(resB.status, 200, `precondition: B's page must render (got ${resB.status})`);

    const textA = renderedText(resA.raw);
    const textB = renderedText(resB.raw);

    assert.ok(textA.includes(BRAND_A.companyName), "precondition: A's page must name A");
    assertCssVar(resA.raw, 'brand-primary', BRAND_A.secondary, "A's page must carry A's palette");
    assert.ok(textB.includes(BRAND_B.companyName), "precondition: B's page must name B");
    assertCssVar(resB.raw, 'brand-primary', BRAND_B.secondary, "B's page must carry B's palette");

    assert.equal(textA.includes(BRAND_B.companyName), false, "A's page named B");
    assert.equal(resA.raw.includes(BRAND_B.primary), false, "A's page carried B's palette");
    assert.equal(textB.includes(BRAND_A.companyName), false, "B's page named A");
    assert.equal(resB.raw.includes(BRAND_A.primary), false, "B's page carried A's palette");
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. STATE 2 — EMAIL VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] State 2 ships in the same response with LP\'s locked copy', async () => {
    // ONE RESPONSE, three states. The transition is client-side because the page
    // state that survives it — userId from the signup 201, plus email and
    // contractorId for resend — exists only in memory; a full-page reload loses
    // all three and strands the homeowner on a verify screen with nothing to
    // verify. Whether State 2 arrives as hidden markup or as a template string
    // inside the nonce'd script is NOT pinned here; that it arrives is.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(text.includes(COPY.cardTitle), 'precondition: this must be the full landing document');

    for (const line of [COPY.verifyHeadline, COPY.verifySent, COPY.verifyButton, COPY.verifyResend]) {
      assert.ok(text.includes(line), `LP §2 State 2 copy is locked and missing: "${line}"`);
    }
    // The arrow may be a literal ←, &larr; or &#8592; — all three render the same
    // glyph, and renderedText decodes neither entity form, so all three are
    // accepted. What is pinned is that the back affordance is the arrowed text
    // link LP specifies rather than a bare word appearing somewhere on the page.
    assert.ok(
      /(?:←|&larr;|&#8592;)\s*Back/.test(res.raw),
      'LP §2 State 2 carries a "← Back" text link'
    );
  });

  it('[RED] State 2 carries exactly six single-digit code boxes', async () => {
    // LP §2: "Six auto-advancing single-digit boxes; paste of a 6-digit string
    // fills all." Six is the contract — a five-box implementation would satisfy
    // "at least one box exists" and silently make the code un-enterable.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
    assert.ok(
      renderedText(res.raw).includes(COPY.verifyHeadline),
      'precondition: State 2 must be present in the document'
    );

    const boxes = countMatches(res.raw, /maxlength\s*=\s*["']?1["']?/gi);
    assert.equal(
      boxes, 6,
      `LP §2 State 2 specifies exactly six single-digit boxes; found ${boxes} inputs with maxlength=1`
    );
  });

  it('[RED] the Verify button ships disabled and the wrong-code error copy ships with it', async () => {
    // LP §2: "'Verify' button: DISABLED (muted tint, as mocked) until 6 digits
    // present." The initial render is the disabled state — a button that starts
    // enabled lets a homeowner submit an empty code and receive an error for
    // something they have not done yet.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(text.includes(COPY.verifyHeadline), 'precondition: State 2 must be present in the document');

    // Scoped to a <button> open tag. A bare /disabled/ search would be satisfied
    // by the word appearing in a class name, a comment or a CSS rule.
    assert.ok(
      /<button[^>]*\bdisabled\b/i.test(res.raw),
      'the Verify button must ship disabled until six digits are present (LP §2 State 2)'
    );
    assert.ok(
      text.includes(COPY.verifyError),
      `LP §2 State 2 wrong-code copy is locked: "${COPY.verifyError}"`
    );
  });

  it('[RED] resend is wired to POST /api/signup/resend-code with email and contractorId', async () => {
    // The live endpoint reads exactly { email, contractorId } and FAILS CLOSED to
    // its generic response when either is missing — so a resend wired with the
    // wrong key names looks like it worked and silently sends nothing. That is the
    // break this catches.
    //
    // The endpoint's own confirmation copy must be OPTIMISTIC and independent of
    // the response: it returns the same generic 200 for a nonexistent account, a
    // verified one and a successful send, precisely so nothing leaks. Conditioning
    // the UI on it would re-open that hole from the client side. That property is
    // not observable in the served document — see the RED report.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
    assert.ok(
      renderedText(res.raw).includes(COPY.verifyResend),
      'precondition: the resend affordance must be present'
    );

    assert.ok(
      res.raw.includes('/api/signup/resend-code'),
      'the resend affordance must call POST /api/signup/resend-code'
    );
    assert.ok(res.raw.includes('contractorId'), 'resend requires contractorId — the endpoint fails closed without it');
    assert.ok(
      renderedText(res.raw).includes(COPY.verifyResendConfirm),
      `LP §2 State 2 resend confirmation copy is locked: "${COPY.verifyResendConfirm}"`
    );
  });

  it('[RED] the contractorId resend needs is injected server-side', async () => {
    // The page cannot derive it: the hostname is cosmetic routing and the internal
    // id is not in the URL. It must come from the resolved payload, whose
    // contractorId is read from the TOKEN row. Without it in the document, resend
    // posts undefined and the endpoint answers its generic 200 anyway — a failure
    // with no symptom.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
    assert.ok(
      res.raw.includes(TENANT_A),
      "the resolved contractor id must be present in the served document for the resend call"
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. STATE 3 — SUCCESS + GET THE APP
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] State 3 ships with LP\'s copy, including the reassurance line §7\'s session claim was struck for', async () => {
    // LP §7's "on verify success: session created" is STRUCK. verify-email marks
    // the row verified and returns a message; sessions are bearer tokens minted
    // only by POST /api/login. State 3 is therefore a "you're in — now sign in"
    // screen, and its reassurance line is literal rather than reassuring.
    //
    // ⚠ ONE-WORD DECISION FOR DANNY: LP §2 State 3 reads "...email and PIN you
    // just created" and its own inline annotation corrects it — "('PIN' here
    // should read 'password' per A11.)" The annotation wins over the surrounding
    // prose, so this asserts "password". Flipping it back is one string here.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
    const text = renderedText(res.raw);

    assert.ok(text.includes(COPY.successHeadline), `LP §2 State 3 headline is locked: "${COPY.successHeadline} {FirstName}!"`);
    assert.ok(text.includes(COPY.successBody), `LP §2 State 3 body copy is locked: "${COPY.successBody}"`);
    assert.ok(
      text.includes(COPY.successReassurance),
      `LP §2 State 3 reassurance line is locked (A11 wording): "${COPY.successReassurance}"`
    );
  });

  it('[RED] the checkmark celebration is CSS animation, per A15', async () => {
    // A15: framer-motion is not installed and will not be added. The VISUAL INTENT
    // is unchanged — the checkmark celebration and confetti accents still happen —
    // so the break this catches is a State 3 that ships no motion at all because
    // the library it was specified against does not exist.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
    assert.ok(
      renderedText(res.raw).includes(COPY.successHeadline),
      'precondition: State 3 must be present in the document'
    );

    assert.ok(
      /@keyframes\s+[\w-]+/.test(res.raw),
      'the State 3 celebration must be CSS animation (A15) — no @keyframes rule was served'
    );
    assert.ok(
      /\banimation\s*:/.test(res.raw),
      'a @keyframes rule that nothing references animates nothing'
    );
  });

  it('[RED] the store-badge slot is present and empty while the flag is unset', async () => {
    // A14: the slot is BUILT and gated; the artwork and its destinations arrive in
    // the Capacitor session. `!== 'true'` fails closed when unset.
    //
    // NON-VACUITY: State 3's own copy and the slot marker are both asserted
    // present before the badge labels are asserted absent — so this proves an
    // EMPTY SLOT on a rendered page, not a missing State 3. Its counterweight is
    // the next test, which proves the same slot fills when the flag is set; absent
    // that, "renders nothing" would be satisfied by never having built the slot.
    delete process.env[BADGE_FLAG];

    const res = await getState1();

    assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(text.includes(COPY.successHeadline), 'precondition: State 3 must be present in the document');
    assert.ok(
      res.raw.includes(BADGE_SLOT_MARKER),
      `A14 ships the SLOT now and fills it later — expected a "${BADGE_SLOT_MARKER}" container in the document`
    );

    assert.equal(
      text.includes(APPLE_BADGE_LABEL), false,
      `the App Store badge must not render while ${BADGE_FLAG} is unset (A14)`
    );
    assert.equal(
      text.includes(GOOGLE_BADGE_LABEL), false,
      `the Google Play badge must not render while ${BADGE_FLAG} is unset (A14)`
    );
  });

  it('[RED] the badge slot fills when the flag is set — and the gate does NOT also require production', async () => {
    // A14 in terms: "Gate on the flag ALONE. The precedent (TWILIO_10DLC_ACTIVE)
    // also requires NODE_ENV === 'production'; copying that clause would make the
    // badge slot untestable on every non-production boot."
    //
    // THIS TEST IS THAT PROOF, and it is why NODE_ENV is asserted rather than
    // assumed: the run is non-production, so an implementation carrying the extra
    // clause renders nothing here and fails. The env var must also be read PER
    // RENDER — a value captured at module load is set before this file's first
    // request and could never be flipped by a test.
    assert.notEqual(
      process.env.NODE_ENV, 'production',
      'precondition: this proof is only meaningful on a NON-production boot'
    );

    const previous = process.env[BADGE_FLAG];
    process.env[BADGE_FLAG] = 'true';
    try {
      const res = await getState1();

      assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
      const text = renderedText(res.raw);
      assert.ok(text.includes(COPY.successHeadline), 'precondition: State 3 must be present in the document');

      assert.ok(
        text.includes(APPLE_BADGE_LABEL),
        `with ${BADGE_FLAG}=true the App Store badge must render — on a non-production boot. ` +
        'A gate that also tests NODE_ENV fails here, which is exactly what A14 forbids.'
      );
      assert.ok(
        text.includes(GOOGLE_BADGE_LABEL),
        `with ${BADGE_FLAG}=true the Google Play badge must render — on a non-production boot`
      );
    } finally {
      if (previous === undefined) delete process.env[BADGE_FLAG];
      else process.env[BADGE_FLAG] = previous;
    }
  });

  it('[RED] the badge gate is a strict compare — a truthy non-"true" value stays closed', async () => {
    // The other half of A14's instruction: "Copy the strict !== 'true' string
    // compare, which fails closed when unset, and nothing else." A loose
    // Boolean(process.env.X) opens the slot on 'false', '0' and 'no' — all of
    // which an admin might plausibly set meaning the opposite.
    //
    // NON-VACUITY: State 3 and the slot marker are asserted present first, and the
    // preceding test proves the labels DO render under the correct value.
    const previous = process.env[BADGE_FLAG];
    process.env[BADGE_FLAG] = 'false';
    try {
      const res = await getState1();

      assert.equal(res.status, 200, `precondition: the landing page must render (got ${res.status})`);
      const text = renderedText(res.raw);
      assert.ok(text.includes(COPY.successHeadline), 'precondition: State 3 must be present in the document');
      assert.ok(res.raw.includes(BADGE_SLOT_MARKER), 'precondition: the slot itself must be present');

      assert.equal(
        text.includes(APPLE_BADGE_LABEL), false,
        `${BADGE_FLAG}='false' must keep the slot closed — the gate is a strict !== 'true' compare`
      );
    } finally {
      if (previous === undefined) delete process.env[BADGE_FLAG];
      else process.env[BADGE_FLAG] = previous;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. THEMING
  // ═══════════════════════════════════════════════════════════════════════════

  it('[GREEN-by-design] the resolved theme is injected server-side — no fetch-then-repaint', async () => {
    // A8's second finding, and the reason this page is server-rendered at all: the
    // contractor's colours are known at render time. A client-rendered page paints,
    // fetches, then repaints — meaning a homeowner sees the wrong brand, or no
    // brand, for the first frame of the single most important attribution surface
    // in the product.
    //
    // All four tokens are asserted, not one: an implementation that injects
    // primary and forgets the rest still paints most of the page in defaults.
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);

    assertCssVar(res.raw, 'brand-primary', BRAND_A.secondary, 'primary must be server-injected');
    assertCssVar(res.raw, 'brand-secondary', BRAND_A.primary, 'secondary must be server-injected');
    assertCssVar(res.raw, 'brand-accent', BRAND_A.accent, 'accent must be server-injected');
    assertCssVar(res.raw, 'brand-bg', BRAND_A.bg, 'background must be server-injected');
  });

  it('[RED] B-1 — --brand-primary carries the CTA colour, which is secondary_color', async () => {
    // ⚠ THE PUBLIC HOMEOWNER-FACING FACE OF THE ROUTE SWAP, AND THE ONE THE APP
    // TESTS CANNOT REACH. The landing page does not use the render tokens — it
    // emits its own --brand-* variables straight from the resolver, so swapping
    // the derivations alone would fix every app surface and leave THIS page
    // inverted, where strangers see it.
    //
    // WHAT THE CSS ACTUALLY DOES WITH THEM, read from the stylesheet rather than
    // assumed: --brand-primary paints `.submit`, `.step-num`, link colour and the
    // focus ring; --brand-secondary paints `body{color:...}`, i.e. the body text.
    // That is the same split the render tokens use, so after the ruling the CTA
    // variable must be fed by secondary_color and the text variable by
    // primary_color.
    //
    // ⚠ ASSERTED AGAINST THE OTHER COLUMN, NOT AGAINST A HEX. BRAND_A's two
    // colours are #AA1111 and #AA2222 — close enough that a hex assertion reads
    // as arbitrary. Naming which COLUMN each variable must carry is the contract.
    const res = await getState1();
    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);

    assertCssVar(res.raw, 'brand-primary', BRAND_A.secondary,
      'after the B-1 route swap --brand-primary is the CALL-TO-ACTION colour, which is stored ' +
      'in secondary_color. It still paints .submit and .step-num; only its source moves.');
    assertCssVar(res.raw, 'brand-secondary', BRAND_A.primary,
      'after the B-1 route swap --brand-secondary is the DARK NEUTRAL, which is stored in ' +
      'primary_color. It paints body text, and body text must be the darker of the two.');
  });

  it('[GREEN-by-design] NULL branding columns render the RoofMiles defaults', async () => {
    // LP §5: "any NULL branding column falls back to RoofMiles tokens — a
    // brand-new contractor has a decent page before uploading anything."
    //
    // Asserted as CSS VARIABLE DECLARATIONS rather than as bare substrings, and
    // that is load-bearing for primary: #F26A1B is also the hardcoded footer
    // colour on EVERY page, so `raw.includes('#F26A1B')` would pass on a page that
    // injected no theme at all.
    const res = await getState1(TENANT_BARE, SLUG_BARE);

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);

    assertCssVar(res.raw, 'brand-primary', RM.secondary, 'NULL primary_color must fall back to RoofMiles');
    assertCssVar(res.raw, 'brand-secondary', RM.primary, 'NULL secondary_color must fall back to RoofMiles');
    assertCssVar(res.raw, 'brand-accent', RM.accent, 'NULL accent_color must fall back to RoofMiles');
    assertCssVar(res.raw, 'brand-bg', RM.bg, 'NULL landing_bg_color must fall back to RoofMiles');
  });

  it('[GREEN-by-design] the contractor logo renders when logo_url is set', async () => {
    const res = await getState1();

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    assert.ok(
      res.raw.includes(BRAND_A.logo),
      `the contractor's logo must render in the header (${BRAND_A.logo})`
    );
  });

  it('[RED] with no logo the page renders the COMPANY NAME as text, never the RoofMiles mark', async () => {
    // There is deliberately no default logo: "a placeholder logo borrowed from
    // another contractor is a white-label breach, not a fallback"
    // (brandingTheme.js). But falling back to the ROOFMILES mark is the same
    // breach wearing a platform hat — the homeowner scanned a sign in a yard, and
    // the header must say whose yard it was.
    //
    // NON-VACUITY: status 200 and the State 1 headline are asserted first, and the
    // company name is asserted PRESENT before the RoofMiles mark is asserted
    // absent — so this proves a rendered header carrying the right name, not a
    // page that rendered no header at all. RoofMiles still appears in the footer
    // by design, so the absence check is scoped to the header region below.
    const res = await getState1(TENANT_BARE, SLUG_BARE);

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);
    assert.ok(
      text.includes(COPY.headline('Gamma Roofing Co')),
      'precondition: this must be a fully rendered State 1 page'
    );
    assert.ok(text.includes('Gamma Roofing Co'), 'the company name must render in place of the missing logo');

    // Everything before the how-it-works block is the header region. The footer's
    // "Powered by RoofMiles" lives well after it, so scoping here is what keeps
    // the assertion about the LOGO SLOT rather than about the whole document.
    const headerEnd = text.indexOf(COPY.step1Title);
    assert.ok(headerEnd > 0, 'precondition: the how-it-works block must render, bounding the header region');
    const header = text.slice(0, headerEnd);

    assert.equal(
      header.includes(RM.companyName), false,
      'a contractor with no logo must not have the RoofMiles mark stand in for theirs'
    );
  });

  it('[RED] RoofMiles is the last resort only when the company name is missing too', async () => {
    // The one case where the platform mark is correct: nothing resolvable from
    // company_name OR contractors.name. Reachable only via the empty-string
    // fixture, since contractors.name is NOT NULL — see the beforeEach note.
    //
    // This is the counterweight to the test above: without it, "never render the
    // RoofMiles mark in the header" could be satisfied by an implementation that
    // renders an empty header forever.
    const res = await getState1(TENANT_NAMELESS, SLUG_NAMELESS);

    assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
    const text = renderedText(res.raw);

    const headerEnd = text.indexOf(COPY.step1Title);
    assert.ok(headerEnd > 0, 'precondition: the how-it-works block must render, bounding the header region');
    const header = text.slice(0, headerEnd);

    assert.ok(
      header.includes(RM.companyName),
      'with neither a logo nor any resolvable company name, RoofMiles is the last resort'
    );
  });
});
