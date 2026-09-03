'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BR-2 PHASE 3 (T1) — THE THREE EMAIL LOGO CHAINS, BEFORE AND AFTER THE DROP
//
// `app_logo_url` was the SECOND term of `logo_url || app_logo_url || null` in
// three pendingReferral templates. Dropping it simplifies the chain to
// `logo_url || null`. THE CHAINS DID NOT DISAPPEAR — the `|| null` stays,
// because `settings` is `rows[0] || {}`, so with no settings row `logo_url` is
// UNDEFINED and the templates branch on truthiness while interpolating.
//
// ⚠ THE WITHOUT-LOGO CASE IS THE ONE THE CHAIN EXISTED FOR, so it is asserted
// first and its precondition is pinned rather than assumed. A fixture that
// supplied a logo in every case would drive only the term that was never in
// question.
//
// ⚠ WHY THIS TESTS THE RENDERED HTML AND NOT THE EXPRESSION. The claim is
// "identical output before and after", and only the output can carry that.
// Asserting `logoUrl === settings.logo_url` would restate the implementation.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
// ─────────────────────────────────────────────────────────────────────────────

// Resend is replaced in require.cache BEFORE the module under test loads, and it
// RECORDS each send rather than discarding it — the recorded html IS the thing
// under test. Same convention as signupEmailWhiteLabel.test.js. No mail is sent.
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
          send: async payload => { sentEmails.push(payload); return { data: { id: 'test-stub' }, error: null }; },
        };
      }
    },
  },
};

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { initTestDb } = require('./setup');

const WITH_LOGO = 'tnt-plr-withlogo';
const NO_LOGO = 'tnt-plr-nologo';
const LOGO = 'https://cdn.test.invalid/plr/logo.png';

let pool;
let pendingReferral;

async function seed(contractorId, companyName, logoUrl) {
  await pool.query('DELETE FROM contractor_settings WHERE contractor_id = $1', [contractorId]);
  await pool.query('DELETE FROM contractors WHERE id = $1', [contractorId]);
  await pool.query('INSERT INTO contractors (id, name) VALUES ($1, $2)', [contractorId, companyName]);
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, company_name, company_phone, logo_url, email_sender_name)
     VALUES ($1, $2, '555-0500', $3, $2)`,
    [contractorId, companyName, logoUrl]
  );
}

// ⚠ THROWS ON AN UNEXPECTED SHAPE rather than returning something plausible —
// the BR-1 Phase 1-B lesson. A send that never happened would make every
// "the platform mark is absent" assertion below pass for the wrong reason.
function lastSend() {
  const sent = sentEmails[sentEmails.length - 1];
  if (!sent || typeof sent.html !== 'string') {
    throw new Error('lastSend(): no email was captured — the template did not send at all');
  }
  return sent;
}

describe('BR-2 Phase 3 (T1) — the three pendingReferral templates after the app_logo_url drop', () => {

  before(async () => {
    pool = await initTestDb();
    pendingReferral = require('../utils/pendingReferral');
  });

  after(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    sentEmails.length = 0;
    await seed(WITH_LOGO, 'Logo Roofing Co', LOGO);
    await seed(NO_LOGO, 'Bare Roofing Co', null);
  });

  it('[RED] the fixtures genuinely differ — one HAS a logo and one does NOT', async () => {
    // NON-VACUITY, AS AN ASSERTION. If the no-logo fixture ever gained one, every
    // without-logo case below would silently test the with-logo branch — which is
    // the branch that was never in question.
    const { rows } = await pool.query(
      'SELECT contractor_id, logo_url FROM contractor_settings WHERE contractor_id = ANY($1) ORDER BY 1',
      [[NO_LOGO, WITH_LOGO]]
    );
    const byId = Object.fromEntries(rows.map(r => [r.contractor_id, r.logo_url]));
    assert.equal(byId[NO_LOGO], null, 'the no-logo fixture has a logo');
    assert.equal(byId[WITH_LOGO], LOGO, 'the with-logo fixture has none');
  });

  // The three templates, each exercised twice. Named by their exported function
  // so a rename fails loudly here rather than silently skipping a template.
  const TEMPLATES = [
    ['sendPendingInviteEmail', (fn, id) =>
      fn({ referred_by_email: 'ref@test.invalid', referred_by_name: 'Dana Referrer' }, id)],
    ['sendCreditAttributionEmail', (fn, id) =>
      fn({ referred_email: 'home@test.invalid', referred_name: 'Sam Homeowner', referred_by_name: 'Dana Referrer' }, id)],
    ['sendPendingRewardEmail', (fn, id) =>
      fn('ref@test.invalid', 'Dana Referrer', 'Sam Homeowner', '250.00', id)],
  ];

  for (const [name, invoke] of TEMPLATES) {
    it(`[RED] ${name} — WITH a logo, renders the contractor's mark`, async () => {
      const fn = pendingReferral[name];
      assert.equal(typeof fn, 'function', `${name} is not exported — the template list is stale`);

      await invoke(fn, WITH_LOGO);
      const html = lastSend().html;

      assert.ok(html.includes(`src="${LOGO}"`), `${name} did not render the logo`);
      assert.ok(html.includes('Logo Roofing Co'), 'the company is not named');
      // NOT VACUOUS: no dead src survived the chain simplification.
      assert.ok(!/src="(null|undefined|)"/.test(html), `${name} rendered a dead image src`);
    });

    it(`[RED] ${name} — WITHOUT a logo, renders the company NAME as text and no image`, async () => {
      // ⚠ THE BRANCH THE CHAIN EXISTED FOR. Before the drop this fell through
      // app_logo_url — always NULL — to the same place. A3 (BR-1 Phase 2) made
      // the else branch the company name rather than an empty string, and that
      // behaviour must be untouched by this drop.
      const fn = pendingReferral[name];
      await invoke(fn, NO_LOGO);
      const html = lastSend().html;

      assert.ok(html.includes('Bare Roofing Co'), `${name} did not name the company`);
      assert.ok(!/<img[^>]*src="http/.test(html), `${name} rendered an image with no logo set`);
      assert.ok(!/src="(null|undefined|)"/.test(html), `${name} rendered a dead image src`);
      // ⚠ AND NEVER THE PLATFORM MARK — A3's rule: substituting RoofMiles here
      // tells a homeowner they are dealing with a company they never heard of.
      assert.ok(!/roofmiles_logo|rb[ _%]?logo/i.test(html), `${name} substituted the platform mark`);
    });
  }
});
