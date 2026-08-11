'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 2c — THE ESCAPING SPLIT, SECOND INSTANCE
//
// Phase 2a fixed this exact bug on the signup verification email: escapeHtml had
// been applied to the value used for BOTH the plain-text subject and the HTML body.
// signupEmailWhiteLabel.test.js pins that fix. The PIN reset email carried the same
// mistake in a different field — escapeHtml on the From: display name — and this
// file pins its fix, so the codebase stops holding one corrected example and one
// broken one for the next person writing email copy to choose between.
//
// THE GENERAL RULE, which is what is actually under test here:
//   escapeHtml belongs in HTML BODIES ONLY.
//   Subjects, From: display names, and every other plain-text header carry the RAW
//   value. Escaping them protects nothing — there is no markup to inject into — and
//   actively corrupts what the recipient sees, because a mail client renders a
//   header literally. "Smith & Sons Roofing" arrives in the inbox as
//   "Smith &amp; Sons Roofing", from a company whose own name looks broken.
//
// ONE EMAIL, BOTH DIRECTIONS. The fixture is chosen so the same contractor name
// reaches both fields of the same send: with email_sender_name NULL, the From:
// display name falls back to company_name, which is also what the body renders.
// Asserting only the header would leave a "delete escapeHtml everywhere" fix
// looking correct, so the escaped form is pinned in the body in the same test.
//
// THE AMPERSAND IS THE REALISTIC CASE, not a contrived one — "& Sons" is ordinary
// in this trade — and it is the character whose correct treatment DIFFERS between
// the two fields. Same fixture rationale as signupEmailWhiteLabel.test.js.
//
// THE `contractorSlug` WIRE FIELD RETIRED AT C/DL-3b PHASE 2B. It used to hold a
// contractor ID despite its name, and the handler narrowed the user lookup by it.
// It is now ignored entirely: forgot-pin resolves by LOWER(email) across all
// contractors and sends one reset per matching account.
//
// THE REQUEST BELOW STILL SENDS IT, deliberately — a deployed client will keep
// sending it for a while, and this file is the incidental proof that doing so
// changes nothing. The single-tenant fixture here resolves to exactly one
// account either way, so what is under test (the escaping) is unaffected. The
// retirement itself is covered by server/test/unifiedForgotPin.test.js.
//
// RESEND INTERCEPTION — the require.cache pattern from signupEmailWhiteLabel.test.js,
// installed before anything that constructs a Resend client is required. The stub
// records sends because the recorded from/html ARE the thing under test. No real mail.
// ─────────────────────────────────────────────────────────────────────────────

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

const TENANT_AMPERSAND = 'tnt-k7fq-internal';

const COMPANY_AMPERSAND = 'Smith & Sons Roofing';
const COMPANY_AMPERSAND_ESCAPED = 'Smith &amp; Sons Roofing';

let _counter = 0;
function uniq(prefix) {
  _counter += 1;
  return `${prefix}-${Date.now()}-${_counter}`;
}

// Fresh IP per request. forgotPinLimiter is 3 per 15 minutes per IP and
// server/app.js sets `trust proxy 1`, so without this the file would 429 partway
// through for a reason unrelated to escaping.
function nextIp() {
  _counter += 1;
  return `10.100.${Math.floor(_counter / 250)}.${(_counter % 250) + 1}`;
}

function httpPost(port, path, bodyObj) {
  const payload = Buffer.from(JSON.stringify(bodyObj));
  return new Promise((resolve, reject) => {
    const req = _httpRequest({
      hostname: 'localhost', port, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'X-Forwarded-For': nextIp(),
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

describe('C/DL-2 Phase 2c — PIN reset email: escapeHtml belongs in the body, never the header', () => {
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
    await pool.query('DELETE FROM pin_reset_tokens');
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await pool.query(
      `INSERT INTO contractors (id, name) VALUES ($1, $2)`,
      [TENANT_AMPERSAND, 'Smith Holdings LLC']
    );
    // email_sender_name IS NULL deliberately: it makes the From: display name fall
    // back to company_name, which is the same value the body renders — so one send
    // exercises both halves of the split.
    await pool.query(
      `INSERT INTO contractor_settings (contractor_id, company_name, email_sender_name)
       VALUES ($1, $2, NULL)`,
      [TENANT_AMPERSAND, COMPANY_AMPERSAND]
    );
  });

  // Requests a PIN reset for one referrer and returns the email that was sent to
  // them. Filtered by recipient rather than taking the first send, matching
  // signupEmailWhiteLabel.test.js — other handlers share this Resend client.
  async function requestResetAndCaptureEmail() {
    const email = `${uniq('referrer')}@test.invalid`;
    await pool.query(
      `INSERT INTO users (full_name, email, pin, contractor_id, email_verified)
       VALUES ('Reset Requester', $1, '$2b$10$test.placeholder.hash.for.tests', $2, true)`,
      [email, TENANT_AMPERSAND]
    );

    // `contractorSlug` is the wire field name and it carries a contractor ID — see
    // the file header and the handler's own comment.
    const res = await httpPost(port, '/api/forgot-pin', { email, contractorSlug: TENANT_AMPERSAND });
    assert.equal(res.status, 200, `forgot-pin failed: ${res.raw}`);

    const sent = sentEmails.find(e => e.to === email);
    assert.ok(sent, `no PIN reset email was sent to ${email}`);
    return sent;
  }

  it('the From: display name carries the raw ampersand', async () => {
    // NON-VACUITY: requestResetAndCaptureEmail asserts a 200 and that an email
    // actually reached this recipient before returning it. An unsent email has no
    // entity in its header either.
    const sent = await requestResetAndCaptureEmail();

    assert.ok(
      sent.from.includes(COMPANY_AMPERSAND),
      `a From: display name is not HTML — it must carry the name verbatim, got: ${sent.from}`
    );
    assert.equal(
      sent.from.includes('&amp;'), false,
      'an HTML entity in a plain-text header renders literally in the recipient\'s inbox — ' +
      'the contractor\'s own name arrives looking broken'
    );
  });

  it('the HTML body carries the escaped ampersand', async () => {
    // The counterweight, and the reason it lives in this file rather than being
    // assumed: dropping escapeHtml everywhere would satisfy the header test above
    // while putting unescaped admin-sourced text into markup.
    const sent = await requestResetAndCaptureEmail();

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
