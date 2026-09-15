'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// RED SUITE — CAMPAIGN EMAIL ATTRIBUTE ESCAPING
//
// `buildEmailHtml()` in server/routes/admin/campaigns.js defined a LOCAL escaper
// covering THREE characters — the ampersand, the less-than and the greater-than
// sign — where the sanctioned escapeHtml() covers FIVE, adding the double and
// single quote. Its output was interpolated INSIDE A DOUBLE-QUOTED HTML
// ATTRIBUTE, so a contractor's stored font name carrying a double quote
// terminated the style attribute and injected new attributes into the <h1>.
//
// ── IT WAS ALREADY KNOWN, AND SAYING SO IS THE POINT ────────────────────────
// ⚠ THIS IS SH-5 IN `SECURITY_HARDENING_SPEC.md` — a recorded HIGH, characterised
// exactly right: "doesn't escape the double quote and is used inside
// double-quoted HTML attributes — a genuine attribute-injection gap." The
// Palette-13 font scoping rediscovered it independently and this file was first
// written claiming it as a new find. That was wrong and is corrected here: a
// rediscovery presented as a discovery makes the audit that caught it first look
// like it missed it.
//
// ⚠ SH-5 IS ONLY PARTLY CLOSED. Its stated fix direction is to consolidate ALL
// the duplicates, which would also close SH-4. This change repairs the one copy
// that is LIVE — the only one that both omits the double quote and interpolates
// into an attribute. The other six wait, behind the baseline fence below.
//
// ── WHY IT SURVIVED THE ENUMERATION THAT SHOULD HAVE CAUGHT IT ──────────────
// escapeHtmlExport.test.js enumerated the local copies in C/DL-2 Phase 3d-1 and
// listed SIX. This one is not among them: it is named `esc`, not `escapeHtml`,
// and that enumeration searched for the NAME. A sweep for the replace CHAIN
// finds EIGHT across server/ — the canonical copy plus seven duplicates — and
// this was the weakest of all eight. A name-based search cannot find a thing
// that is spelled differently, which is the same shape CLAUDE.md records for
// the run-time-assembled constraint names.
//
// ── THE BOUNDING, STATED RATHER THAN IMPLIED ────────────────────────────────
// The actor is an admin holding `branding.manage` ON THEIR OWN TENANT; the
// victims are that tenant's own email recipients. This is NOT cross-tenant
// escalation, and most mail clients strip event handlers. It is still
// contractor-controlled text crossing into markup structure, under a resident
// rule that says such strings are escaped with escapeHtml().
//
// ── WHY THESE ASSERTIONS PARSE RATHER THAN STRING-MATCH ─────────────────────
// A string-match for '&quot;' passes on output that is still broken elsewhere:
// it proves one substitution happened, not that the element carries the
// attributes it should. Every attack case below PARSES the rendered HTML and
// asserts the element's ATTRIBUTE SET. The known answers were measured against
// both escapers before these assertions were written:
//     3-char, today   ->  h1 attributes ["style","onload"]
//     5-char, fixed   ->  h1 attributes ["style"]
//
// jsdom is used deliberately, and a prior file declined it. landingSkipPath.test.js
// says "NO jsdom ... jsdom is a devDependency of react-scripts reachable only by
// hoisting accident". THAT PREMISE IS OBSOLETE: react-scripts is gone and jsdom
// is a first-class devDependency in package.json since the Vite migration. The
// rest of that file's reasoning still stands and is not contradicted here — it
// needed to EXECUTE page script against a controllable clock and location, for
// which a hand-built fake is genuinely more legible. This file needs to PARSE
// markup and read an attribute set, which is exactly what a parser is for.
//
// ── NON-VACUITY ────────────────────────────────────────────────────────────
// A blank email passes every escaping assertion. So every attack case asserts
// the header/image actually RENDERED before asserting what it does not carry,
// and T5 pins substantive content independently.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const { buildEmailHtml } = require('../routes/admin/campaigns');

// ── FIXTURES THAT THROW ON AN UNEXPECTED SHAPE ──────────────────────────────
// A double that quietly accepts an unknown key is indistinguishable from one
// that read the key it was given: a typo'd fixture field would silently exercise
// the DEFAULT branch while the test claimed to be exercising the set branch.
const CAMPAIGN_KEYS = new Set(['name', 'email_header', 'image_url', 'cta_enabled', 'cta_url']);
const SETTINGS_KEYS = new Set([
  'font_heading', 'font_body', 'company_name', 'company_email', 'logo_url',
  'company_address', 'company_city', 'company_state', 'company_zip',
  'social_facebook', 'social_instagram', 'social_google', 'social_nextdoor', 'social_website',
]);

function guard(obj, allowed, label) {
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      throw new Error(`${label} fixture got unknown key ${JSON.stringify(k)} — ` +
        'the double refuses a shape it does not recognise rather than returning a plausible one');
    }
  }
  return obj;
}

const campaign = (o = {}) => guard(o, CAMPAIGN_KEYS, 'campaign');
const settings = (o = {}) => guard(o, SETTINGS_KEYS, 'contractorSettings');

// Parses the email and returns the document. Throws if the wrapper is missing,
// so a build that returned '' or threw cannot be read as a passing absence.
function render(campaignData, contractorSettings, body = 'Hello there, this is the message body.') {
  const html = buildEmailHtml(body, campaignData, null, contractorSettings, null);
  assert.equal(typeof html, 'string', 'buildEmailHtml must return a string');
  const doc = new JSDOM(html).window.document;
  assert.ok(doc.querySelector('div'), 'the email wrapper <div> must exist — an empty body passes every absence assertion');
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('campaign email — attribute escaping', () => {

  // ── T1 ────────────────────────────────────────────────────────────────────
  it('[T1] a double quote in font_heading does not terminate the style attribute', () => {
    const doc = render(
      campaign({ email_header: 'Spring Update' }),
      settings({ font_heading: 'Arial" onload="alert(1)' })
    );

    const h1 = doc.querySelector('h1');
    // POSITIVE CONTROL FIRST: the header rendered at all. Without this, a
    // buildEmailHtml that dropped the header entirely would satisfy every
    // assertion below.
    assert.ok(h1, 'the <h1> must render — otherwise the absence below proves nothing');
    assert.equal(h1.textContent, 'Spring Update', 'the header text must survive');

    // THE ASSERTION: the element carries EXACTLY the attributes it should.
    assert.deepEqual(
      h1.getAttributeNames(), ['style'],
      'the <h1> must carry style and nothing else — an injected attribute appears here'
    );
    assert.equal(h1.hasAttribute('onload'), false, 'no onload attribute may be injected');

    // And the payload survives INSIDE the style value rather than escaping it.
    assert.match(
      h1.getAttribute('style'), /font-family:Arial" onload="alert\(1\);font-size:28px/,
      'the payload must remain inert data inside the style value'
    );
  });

  // ── T2 ────────────────────────────────────────────────────────────────────
  for (const [label, payload] of [
    ["single quote", "Arial' onload='alert(1)"],
    ["less-than", 'Arial</style><script>alert(1)</script>'],
    ["greater-than", 'Arial>alert'],
    ["ampersand", 'Arial&amp;co'],
  ]) {
    it(`[T2] a ${label} in font_heading cannot add an attribute or an element`, () => {
      const doc = render(
        campaign({ email_header: 'Spring Update' }),
        settings({ font_heading: payload })
      );
      const h1 = doc.querySelector('h1');
      assert.ok(h1, 'the <h1> must render');
      assert.deepEqual(h1.getAttributeNames(), ['style'], 'only the style attribute may be present');
      assert.equal(doc.querySelector('script'), null, 'no <script> element may be created');
    });
  }

  it('[T2] the same holds for font_body on the <p>', () => {
    const doc = render(
      campaign({}),
      settings({ font_body: 'Arial" onmouseover="alert(1)' })
    );
    const p = doc.querySelector('p');
    assert.ok(p, 'the body <p> must render');
    assert.equal(p.textContent, 'Hello there, this is the message body.', 'the body text must survive');
    assert.deepEqual(p.getAttributeNames(), ['style'], 'only the style attribute may be present');
  });

  // ── T3 ────────────────────────────────────────────────────────────────────
  it('[T3] a double quote in the campaign name does not break out of alt=', () => {
    const doc = render(
      campaign({ name: 'Spring" onerror="alert(1)', image_url: 'https://media.example.test/a/b.png' }),
      settings({})
    );

    const img = doc.querySelector('img');
    assert.ok(img, 'the campaign image must render — otherwise this proves nothing');

    assert.deepEqual(
      img.getAttributeNames(), ['src', 'alt', 'style'],
      'the <img> must carry exactly src, alt and style'
    );
    assert.equal(img.hasAttribute('onerror'), false, 'no onerror attribute may be injected');
    // ⚠ THE VALUE MUST ALSO SURVIVE INTACT. Under the three-character escaper the
    // alt was silently TRUNCATED to "Spring" as well as leaking an attribute —
    // asserting only the attribute set would miss half the defect.
    assert.equal(
      img.getAttribute('alt'), 'Spring" onerror="alert(1)',
      'the full campaign name must survive inside alt'
    );
  });

  // ── T4 ────────────────────────────────────────────────────────────────────
  // S.4: esc() returned '' for null/undefined, so `esc(x) || 'default'` treated
  // EMPTY STRING as absent. That behaviour is correct and must survive the swap.
  // Measured against both escapers before this was written: null, undefined and
  // '' all fall back, under either implementation.
  for (const [label, value] of [['null', null], ['undefined', undefined], ['an empty string', '']]) {
    it(`[T4] font_heading of ${label} falls back to the default family`, () => {
      const doc = render(
        campaign({ email_header: 'Spring Update' }),
        settings({ font_heading: value })
      );
      const style = doc.querySelector('h1').getAttribute('style');
      assert.match(style, /^font-family:Georgia, serif;/, 'the stored default must be used');
      assert.doesNotMatch(style, /font-family:;/, 'an empty family must never be emitted');
    });

    it(`[T4] font_body of ${label} falls back to the default family`, () => {
      const doc = render(campaign({}), settings({ font_body: value }));
      const style = doc.querySelector('p').getAttribute('style');
      assert.match(style, /^font-family:Arial, sans-serif;/, 'the stored default must be used');
    });
  }

  it('[T4] a real stored font is used rather than the default', () => {
    // The paired positive case. Without it, the three above pass identically
    // against a build that ignores the column entirely and always defaults.
    const doc = render(
      campaign({ email_header: 'Spring Update' }),
      settings({ font_heading: 'Playfair Display' })
    );
    const style = doc.querySelector('h1').getAttribute('style');
    assert.match(style, /^font-family:Playfair Display;/, 'the stored value must reach the attribute');
    assert.doesNotMatch(style, /Georgia/, 'the default must not be used when a value is stored');
  });

  // ── T5 ────────────────────────────────────────────────────────────────────
  it('[T5] a legitimate campaign email still renders its substantive content', () => {
    const doc = render(
      campaign({
        name: 'Spring Roof Check',
        email_header: 'A note from your roofer',
        image_url: 'https://media.example.test/a/b.png',
        cta_enabled: true,
        cta_url: 'https://example.test/join',
      }),
      settings({
        font_heading: 'Montserrat',
        font_body: 'Roboto',
        company_name: 'Example Roofing & Sons',
        company_email: 'hello@example.test',
        logo_url: 'https://media.example.test/logo.png',
        company_city: 'Springfield',
        company_state: 'GA',
        social_facebook: 'https://facebook.example.test/x',
      }),
      'Thanks for being a customer. We appreciate your referrals.'
    );

    // ⚠ SUBSTANCE, not "nothing threw". A blank email satisfies every escaping
    // assertion in this file.
    assert.equal(doc.querySelector('h1').textContent, 'A note from your roofer');
    assert.equal(
      doc.querySelector('p').textContent,
      'Thanks for being a customer. We appreciate your referrals.'
    );
    assert.match(doc.querySelector('h1').getAttribute('style'), /font-family:Montserrat;/);

    const imgs = [...doc.querySelectorAll('img')];
    assert.equal(imgs.length, 2, 'the campaign image and the logo must both render');
    assert.equal(imgs[0].getAttribute('src'), 'https://media.example.test/a/b.png');
    assert.equal(imgs[1].getAttribute('src'), 'https://media.example.test/logo.png');

    // The ampersand in the company name must round-trip as text, not as an entity
    // the reader sees. textContent decodes, which is the right check for a text node.
    const text = doc.body.textContent;
    assert.ok(text.includes('Example Roofing & Sons'), 'the company name must appear, decoded');
    assert.ok(text.includes('Springfield, GA'), 'the address line must appear');
    assert.ok(text.includes('hello@example.test'), 'the contact address must appear');
    assert.ok(text.includes('Powered by RoofMiles'), 'the platform footer must appear');

    const cta = [...doc.querySelectorAll('a')].find((a) => a.getAttribute('href') === 'https://example.test/join');
    assert.ok(cta, 'the CTA link must render');
    assert.equal(cta.textContent, 'Visit Our Website', 'the derived CTA label must render');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── T6 — THE FENCE AGAINST THE DUPLICATE RETURNING ──────────────────────────
//
// ⚠ THIS FENCE IS A BASELINE, NOT A ZERO-ASSERTION, AND THAT IS DELIBERATE.
// A repo-wide sweep finds EIGHT escaper chains under server/: the canonical one
// in server/utils/pendingReferral.js plus SEVEN duplicates. Repairing the other
// six touches the webhook, cashout, CRM and referrer email paths — six
// production files with their own blast radius, which C/DL-2 Phase 3d-1
// explicitly declined for the same reason. Asserting zero here would be RED for
// work this change is not doing.
//
// So the assertion is the one CLAUDE.md's ROLE_ONLY_BASELINE already
// establishes: the known set must not GROW, and the repaired file must be
// absent from it. That binds new writing immediately while the repair stays
// incremental.
//
// ⚠ WHY THIS FILE DOES NOT REPORT ITSELF. The scan is scoped to server/routes/
// and this file lives in server/test/, so it is out of scope STRUCTURALLY
// rather than by a comments-are-exempt carve-out — the carve-out that would
// remove the scan's reach into exactly the text someone copies from. The needle
// below is also assembled from character codes rather than written out, so the
// pattern does not appear literally anywhere in this file.
// ─────────────────────────────────────────────────────────────────────────────

const AMP = String.fromCharCode(38);
const ESCAPER_CHAIN = new RegExp('replace\\s*\\(\\s*/' + AMP + '/g');

// Measured at the time of writing. Each entry is a KNOWN duplicate that predates
// this change and is left for its own pass. campaigns.js is deliberately ABSENT.
const KNOWN_LOCAL_ESCAPERS = Object.freeze([
  'server/routes/account.js',
  'server/routes/admin/cashouts.js',
  'server/routes/referrer.js',
  'server/routes/resendWebhook.js',
  'server/routes/webhooks/jobber.js',
]);

function routeFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(p, out);
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function filesWithLocalEscaper() {
  const root = path.join(__dirname, '..', 'routes');
  return routeFiles(root)
    .filter((f) => fs.readFileSync(f, 'utf8').split(/\r?\n/).some((l) => ESCAPER_CHAIN.test(l)))
    .map((f) => 'server/routes/' + path.relative(root, f).split(path.sep).join('/'))
    .sort();
}

describe('campaign email — no local escaper (T6 fence)', () => {

  it('[T6] the needle finds a real escaper chain and spares a call to escapeHtml', () => {
    // ⚠ VALIDATED IN BOTH DIRECTIONS. A needle that can never match makes every
    // assertion below permanently satisfied, watching nothing.
    const real = "  return s.replace(/" + AMP + "/g, '" + AMP + "amp;').replace(/</g, '" + AMP + "lt;');";
    assert.equal(ESCAPER_CHAIN.test(real), true, 'the needle MUST find a local replace chain');
    assert.equal(ESCAPER_CHAIN.test('const clean = escapeHtml(value);'), false,
      'the needle must SPARE an ordinary call to the sanctioned escapeHtml');
    assert.equal(ESCAPER_CHAIN.test("s.replace(/x/g, 'y')"), false,
      'the needle must spare an unrelated replace');
  });

  it('[T6] campaigns.js defines no local escaper', () => {
    const found = filesWithLocalEscaper();
    assert.equal(
      found.includes('server/routes/admin/campaigns.js'), false,
      'server/routes/admin/campaigns.js must import escapeHtml rather than defining one'
    );
  });

  it('[T6] campaigns.js imports the sanctioned escapeHtml from its documented home', () => {
    // The paired positive. Without it, the absence above is satisfied by a file
    // that escapes nothing at all.
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'admin', 'campaigns.js'), 'utf8');
    assert.match(
      src, /require\(['"]\.\.\/\.\.\/utils\/pendingReferral['"]\)/,
      'campaigns.js must require server/utils/pendingReferral'
    );
    assert.match(src, /\bescapeHtml\b/, 'campaigns.js must reference escapeHtml');
  });

  it('[T6] the set of local escapers under server/routes/ has not grown', () => {
    const found = filesWithLocalEscaper();
    const added = found.filter((f) => !KNOWN_LOCAL_ESCAPERS.includes(f));
    assert.deepEqual(
      added, [],
      'a NEW local escaper appeared under server/routes/ — import escapeHtml from ' +
      'server/utils/pendingReferral instead of defining one'
    );
    // And the baseline itself must stay honest: an entry that gets repaired
    // should be REMOVED from the list, not left to rot as a permanent allowance.
    const goneButStillListed = KNOWN_LOCAL_ESCAPERS.filter((f) => !found.includes(f));
    assert.deepEqual(
      goneButStillListed, [],
      'these files no longer define a local escaper — remove them from ' +
      'KNOWN_LOCAL_ESCAPERS so the baseline shrinks as the repair proceeds'
    );
  });
});
