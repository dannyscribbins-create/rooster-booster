'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 2a — SIGNUP VERIFICATION EMAIL, WHITE-LABELED
//
// The verification email was the SECOND consumer of the hardcoded module constant
// CONTRACTOR_NAME = 'Accent Roofing Service' (Phase 0 finding C9), and the more
// damaging of the two: the landing payload merely renders the wrong name, but this
// email is delivered to a homeowner's inbox welcoming them to a roofer they have
// never heard of. Phase 2a made it DB-driven; nothing tested it. This file is that
// test.
//
// THE FALLBACK CHAIN UNDER TEST — three rungs, each with a different job:
//   1. contractor_settings.company_name   the contractor's own display name.
//   2. contractors.name                   NOT NULL, so always available. This rung
//                                         exists so a contractor who has never
//                                         opened the Branding settings page still
//                                         gets THEIR name, not the platform's.
//   3. 'RoofMiles'                        unreachable in practice via rung 2, and
//                                         deliberately proven unreachable below.
//
// WHY RUNG 3 MUST NOT BE REACHED, stated plainly because it is the entire reason
// rung 2 exists: a homeowner who just scanned a roofer's QR code, typed their
// details into that roofer's signup page, and then receives an email titled "Your
// RoofMiles rewards account" has been handed every signal of a phishing attempt.
// They did not interact with RoofMiles. They interacted with their roofer.
//
// RESEND INTERCEPTION — follows the established convention (signupTenantStamp.test.js,
// inviteTokenSignup.test.js): replace the 'resend' module in require.cache BEFORE
// app.js is required. Necessary, not stylistic — POST /api/signup's send is not
// behind the router's _setTestOverrides seam (that seam covers only the cashout
// sends, per its own comment), Resend instances are built at require()-time, and
// the real RESEND_API_KEY from .env leaks into the test process. The one extension
// over the existing pattern: this stub RECORDS each send instead of discarding it,
// because the recorded subject and html ARE the thing under test. Process-local to
// this file; touches no production code and sends no mail.
//
// NO PRODUCTION CONTRACTOR ID LITERALS (house rule). The C9 guard names the
// hardcoded COMPANY NAME string it exists to detect — a display string, not a
// contractor id, and the assertion is meaningless without it.
// ─────────────────────────────────────────────────────────────────────────────

// Every send the process makes, in order. Populated by the stub below.
const sentEmails = [];

const _resendPath = require.resolve('resend');
require.cache[_resendPath] = {
  id: _resendPath,
  filename: _resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = {
          send: async payload => {
            sentEmails.push(payload);
            return { data: { id: 'test-stub' }, error: null };
          },
        };
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

const TENANT_A = 'test-tenant-a';
const TENANT_B = 'test-tenant-b';
const TENANT_NOSETTINGS = 'test-tenant-nosettings';  // company_name IS NULL
const TENANT_AMPERSAND = 'test-tenant-ampersand';

// contractors.name and contractor_settings.company_name are deliberately DIFFERENT
// for every tenant that has both. Identical values would make rung 1 untestable —
// an implementation that read the wrong column would look correct.
const ENTITY_A = 'Alpha Holdings LLC';
const COMPANY_A = 'Alpha Roofing Co';
const ENTITY_B = 'Beta Holdings LLC';
const COMPANY_B = 'Beta Roofing Co';

// The rung-2 tenant: a real company name on contractors, nothing in settings.
const ENTITY_NOSETTINGS = 'Delta Roofing Co';

// The escaping fixture. An ampersand is the realistic case — "& Sons" is ordinary
// in this trade — and it is the one character whose correct treatment DIFFERS
// between the plain-text subject and the HTML body.
const COMPANY_AMPERSAND = 'Smith & Sons Roofing';
const COMPANY_AMPERSAND_ESCAPED = 'Smith &amp; Sons Roofing';

// The platform name. Reaching this in an email is the phishing failure above.
const PLATFORM_NAME = 'RoofMiles';

let _counter = 0;
function uniq(prefix) {
  _counter += 1;
  return `${prefix}-${Date.now()}-${_counter}`;
}

// Fresh IP per signup. signupLimiter is 5/hour per IP and server/app.js sets
// `trust proxy 1`, so without this the file would 429 partway through.
function nextIp() {
  _counter += 1;
  return `10.60.${Math.floor(_counter / 250)}.${(_counter % 250) + 1}`;
}

function httpPost(port, path, bodyObj) {
  const bodyBuf = Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
        'X-Forwarded-For': nextIp(),
      },
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
    req.write(bodyBuf);
    req.end();
  });
}

describe('C/DL-2 signup verification email — white-labeled, never the platform', () => {
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
    sentEmails.length = 0;
    await pool.query('DELETE FROM email_verifications');
    await pool.query('DELETE FROM contacts');
    await pool.query('DELETE FROM contractor_invite_links');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await seedTenant(TENANT_A, ENTITY_A, COMPANY_A);
    await seedTenant(TENANT_B, ENTITY_B, COMPANY_B);
    await seedTenant(TENANT_AMPERSAND, 'Smith Holdings LLC', COMPANY_AMPERSAND);

    // RUNG 2 FIXTURE: a contractors row with a real name and a settings row whose
    // company_name is NULL. Seeded explicitly rather than through the shared
    // seedContractor() helper, which writes company_name = contractorId and would
    // make the NULL case unreachable.
    await pool.query(
      `INSERT INTO contractors (id, name) VALUES ($1, $2)`,
      [TENANT_NOSETTINGS, ENTITY_NOSETTINGS]
    );
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, NULL)`,
      [TENANT_NOSETTINGS]
    );
  });

  async function seedTenant(contractorId, entityName, companyName) {
    await pool.query(
      `INSERT INTO contractors (id, name) VALUES ($1, $2)`,
      [contractorId, entityName]
    );
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name) VALUES ($1, $2)`,
      [contractorId, companyName]
    );
  }

  async function mintToken(contractorId) {
    const slug = uniq('tok');
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, active)
       VALUES ($1, $2, 'contractor', true)`,
      [contractorId, slug]
    );
    return slug;
  }

  // Signs up one homeowner against a contractor and returns the verification email
  // that was sent to them.
  //
  // FILTERED BY RECIPIENT, not by taking the first send: POST /api/signup also
  // fires a non-blocking admin alert through the same Resend client, so an
  // unfiltered read would be a race between two emails with different content.
  async function signupAndCaptureEmail(contractorId) {
    const slug = await mintToken(contractorId);
    const email = `${uniq('homeowner')}@test.invalid`;

    const res = await httpPost(port, '/api/signup', {
      firstName: 'Test',
      lastName: 'Homeowner',
      phone: '555-123-4567',
      email,
      password: 'password123',
      inviteSlug: slug,
    });
    assert.equal(res.status, 201, `signup failed: ${JSON.stringify(res.body)}`);

    const sent = sentEmails.find(e => e.to === email);
    assert.ok(sent, `no verification email was sent to ${email}`);
    return sent;
  }

  // ── 1. THE NAME IS DB-DRIVEN, IN BOTH FIELDS ───────────────────────────────

  it('the subject and the body both carry the contractor\'s company_name', async () => {
    // BOTH FIELDS, deliberately. They are built from two different variables in the
    // handler (one escaped, one not), so a fix applied to only one would leave the
    // other hardcoded — and a test asserting on one field alone would not notice.
    const sent = await signupAndCaptureEmail(TENANT_A);

    assert.ok(
      sent.subject.includes(COMPANY_A),
      `subject must name the contractor, got: ${sent.subject}`
    );
    assert.ok(
      sent.html.includes(COMPANY_A),
      'the email body must name the contractor'
    );
  });

  it('C9 REGRESSION GUARD — the hardcoded contractor name reaches neither subject nor body', async () => {
    // Same guard shape as the landing payload's C9 test. If this is ever red,
    // someone has reintroduced a module-constant company name on the signup path.
    const sent = await signupAndCaptureEmail(TENANT_A);

    assert.equal(
      sent.subject.includes('Accent Roofing Service'), false,
      'the subject still carries the hardcoded CONTRACTOR_NAME constant'
    );
    assert.equal(
      sent.html.includes('Accent Roofing Service'), false,
      'the body still carries the hardcoded CONTRACTOR_NAME constant'
    );
  });

  it('two tenants, two signups — each email carries its own contractor, with no bleed', async () => {
    const sentA = await signupAndCaptureEmail(TENANT_A);
    const sentB = await signupAndCaptureEmail(TENANT_B);

    assert.ok(sentA.subject.includes(COMPANY_A), "tenant A's email must name tenant A");
    assert.ok(sentB.subject.includes(COMPANY_B), "tenant B's email must name tenant B");

    assert.equal(sentA.subject.includes(COMPANY_B), false, "tenant A's subject leaked tenant B");
    assert.equal(sentA.html.includes(COMPANY_B), false, "tenant A's body leaked tenant B");
    assert.equal(sentB.subject.includes(COMPANY_A), false, "tenant B's subject leaked tenant A");
    assert.equal(sentB.html.includes(COMPANY_A), false, "tenant B's body leaked tenant A");
  });

  // ── 2. THE FALLBACK CHAIN, RUNG BY RUNG ────────────────────────────────────

  it('RUNG 1 — company_name wins over contractors.name when it is populated', async () => {
    // Proves the chain reads the right column FIRST. contractors.name here is a
    // legal-entity name ("Alpha Holdings LLC") of the kind a homeowner would not
    // recognise — which is exactly why company_name exists and why it must win.
    const sent = await signupAndCaptureEmail(TENANT_A);

    assert.ok(sent.subject.includes(COMPANY_A), 'company_name must be used when present');
    assert.equal(
      sent.subject.includes(ENTITY_A), false,
      'contractors.name must not be used while company_name is populated'
    );
    assert.equal(sent.html.includes(ENTITY_A), false, 'same, in the body');
  });

  it('RUNG 2 — a NULL company_name falls back to contractors.name', async () => {
    // contractors.name is NOT NULL, so this rung is always available. A contractor
    // who has never opened the Branding settings page still gets their own name.
    const sent = await signupAndCaptureEmail(TENANT_NOSETTINGS);

    assert.ok(
      sent.subject.includes(ENTITY_NOSETTINGS),
      `subject must fall back to contractors.name, got: ${sent.subject}`
    );
    assert.ok(sent.html.includes(ENTITY_NOSETTINGS), 'the body must fall back too');
  });

  it('RUNG 2 — a NULL company_name must NOT produce a platform-named email', async () => {
    // THE PHISHING GUARD, and the reason rung 2 exists at all. A homeowner who just
    // scanned a roofer's QR code and typed their details into that roofer's signup
    // page receives "Your RoofMiles rewards account — verify your email". They have
    // never heard of RoofMiles. Every signal available to them says this email is
    // not from the company they just dealt with, and the rational response is to
    // delete it — costing the contractor the signup they just earned.
    //
    // Falling through to rung 3 is therefore not a cosmetic degradation; it is the
    // failure this rung prevents, which is why it is asserted separately from the
    // rung-2 success case above rather than folded into it.
    const sent = await signupAndCaptureEmail(TENANT_NOSETTINGS);

    assert.equal(
      sent.subject.includes(PLATFORM_NAME), false,
      'the platform name must never stand in for the contractor in a homeowner-facing subject'
    );
    assert.equal(
      sent.html.includes(PLATFORM_NAME), false,
      'nor in the body'
    );
  });

  // ── 3. THE ESCAPING SPLIT ──────────────────────────────────────────────────
  // Pins a real bug caught in review: escapeHtml had been applied to the value used
  // for BOTH fields. A subject line is plain text, not markup — escaping it does not
  // protect anything and actively corrupts the display name in the recipient's
  // inbox, where "Smith & Sons Roofing" arrives as "Smith &amp; Sons Roofing".
  // The two assertions are split because they are opposite claims about the same
  // value, and a single test asserting both would not say which one regressed.

  it('ESCAPING — the plain-text subject carries the raw ampersand', async () => {
    const sent = await signupAndCaptureEmail(TENANT_AMPERSAND);

    assert.ok(
      sent.subject.includes(COMPANY_AMPERSAND),
      `a subject is not HTML — it must carry the name verbatim, got: ${sent.subject}`
    );
    assert.equal(
      sent.subject.includes('&amp;'), false,
      'an HTML entity in a plain-text subject renders literally in the inbox'
    );
  });

  it('ESCAPING — the HTML body carries the escaped ampersand', async () => {
    // The counterweight. Dropping escapeHtml everywhere would satisfy the subject
    // test above while putting unescaped admin-sourced text into markup.
    const sent = await signupAndCaptureEmail(TENANT_AMPERSAND);

    assert.ok(
      sent.html.includes(COMPANY_AMPERSAND_ESCAPED),
      'the body is markup — the name must be HTML-escaped there'
    );
    assert.equal(
      sent.html.includes(COMPANY_AMPERSAND), false,
      'the raw, unescaped name must not appear in the HTML body'
    );
  });
});
