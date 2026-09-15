'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// RED SUITE — URL-CONTEXT HANDLING IN OUTBOUND EMAIL
//
// ⚠ ESCAPING STOPPED THE BREAKOUT. IT DID NOT STOP THE SCHEME, AND THAT IS A
// DIFFERENT CLASS. `460e87c` replaced a three-character local escaper with the
// sanctioned five-character one and closed every ATTRIBUTE-BREAKOUT site in
// `buildEmailHtml()`. It deliberately left the URL attributes, because nothing
// in `javascript:alert(1)` needs escaping — an escaped hostile scheme lands in
// `href=` perfectly intact and is still a link that runs code.
//
// ── THE LANDING PAGE ALREADY SOLVED THIS, FOR THE SAME COLUMNS ──────────────
// `server/routes/landing.js` checks `logo_url` with `safeLogoUrl` and every
// social with `safeWebsiteUrl`, and records why: "these are unconstrained
// VARCHAR(500) columns an admin pasted into, so a value that cannot become a
// safe https link must draw NO icon rather than a broken one." The email
// templates put the SAME columns into the SAME attribute shapes and had no such
// check. So this commit reuses those functions rather than writing a third
// opinion — they moved to `server/utils/safeUrl.js` verbatim.
//
// ⚠ AND A NAME THAT CLAIMS THE PROPERTY IS NOT THE PROPERTY.
// `pendingReferral.js` already had `const safeLogoUrl = escapeHtml(logoUrl)` —
// escaping only, no scheme check, interpolated into three `<img src>`. Every
// call site read as solved. Found by sweeping for the SHAPE (a value in a URL
// attribute) rather than for the name.
//
// ── BOUNDING, STATED RATHER THAN IMPLIED ────────────────────────────────────
// The actor is an admin holding `branding.manage` ON THEIR OWN TENANT; the
// victims are that tenant's own email recipients. NOT cross-tenant escalation,
// and many mail clients strip or neuter such links. It is still
// contractor-controlled text becoming an executable link.
//
// ── WHY THESE ASSERTIONS PARSE ─────────────────────────────────────────────
// A string match for the absence of 'javascript:' passes on a blank email, on a
// 500, and on output that is still broken elsewhere. Every case below parses the
// rendered HTML and asserts the ELEMENT — its presence or absence, and its
// attribute values.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const { buildEmailHtml } = require('../routes/admin/campaigns');
const { safeLogoUrl, safeWebsiteUrl } = require('../utils/safeUrl');

// ── FIXTURES THAT THROW ON AN UNEXPECTED SHAPE ──────────────────────────────
const CAMPAIGN_KEYS = new Set(['name', 'email_header', 'image_url', 'cta_enabled', 'cta_url']);
const SETTINGS_KEYS = new Set([
  'font_heading', 'font_body', 'company_name', 'company_email', 'logo_url',
  'company_address', 'company_city', 'company_state', 'company_zip',
  'social_facebook', 'social_instagram', 'social_google', 'social_nextdoor', 'social_website',
]);
function guard(obj, allowed, label) {
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      throw new Error(`${label} fixture got unknown key ${JSON.stringify(k)} — the double refuses ` +
        'a shape it does not recognise rather than returning a plausible one');
    }
  }
  return obj;
}
const campaign = (o = {}) => guard(o, CAMPAIGN_KEYS, 'campaign');
const settings = (o = {}) => guard(o, SETTINGS_KEYS, 'contractorSettings');

function render(campaignData, contractorSettings, body = 'Hello there, this is the message body.') {
  const html = buildEmailHtml(body, campaignData, null, contractorSettings, null);
  assert.equal(typeof html, 'string', 'buildEmailHtml must return a string');
  const doc = new JSDOM(html).window.document;
  assert.ok(doc.querySelector('div'), 'the email wrapper must exist — a blank body passes every absence assertion');
  return doc;
}

const GOOD_LOGO = 'https://media.example.test/logo.png';
const GOOD_SOCIAL = 'https://facebook.example.test/acme';
const GOOD_CTA = 'https://example.test/join';

// The evasions. Each is its own case so a failure names the shape.
const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const HOSTILE = [
  ['javascript:', "javascript:alert('x')"],
  ['javascript: mixed case', "JaVaScRiPt:alert('x')"],
  ['javascript: upper', "JAVASCRIPT:alert('x')"],
  ['leading whitespace', "   javascript:alert('x')"],
  ['leading tab', TAB + "javascript:alert('x')"],
  ['leading newline', LF + "javascript:alert('x')"],
  ['NUL prefix', NUL + "javascript:alert('x')"],
  ['TAB inside the scheme', 'java' + TAB + "script:alert('x')"],
  ['javascript:// form', 'javascript://host/%0aalert(1)'],
  ['data: html', 'data:text/html,<script>alert(1)</script>'],
  ['vbscript:', 'vbscript:msgbox(1)'],
  ['file:', 'file:///etc/passwd'],
  ['protocol-relative', '//evil.test/x.png'],
  ['plain http (mixed content)', 'http://media.example.test/logo.png'],
];

// ─────────────────────────────────────────────────────────────────────────────
describe('T1/T2 — a hostile logo_url never becomes an img src', () => {
  it('[T3 PAIRED POSITIVE, FIRST] an https logo renders — without this every refusal below is free', () => {
    const doc = render(campaign({}), settings({ logo_url: GOOD_LOGO, company_name: 'Acme Roofing' }));
    const imgs = [...doc.querySelectorAll('img')];
    const logo = imgs.find((i) => i.getAttribute('src') === GOOD_LOGO);
    assert.ok(logo, 'an https logo_url is the ordinary case and must render — the B2 pipeline writes exactly this shape');
    assert.equal(logo.getAttribute('alt'), 'Acme Roofing');
  });

  for (const [label, payload] of HOSTILE) {
    it(`[T1] a ${label} logo_url draws no <img> at all`, () => {
      const doc = render(campaign({}), settings({ logo_url: payload, company_name: 'Acme Roofing' }));
      // ⚠ NON-VACUITY: the email rendered and the company name is present, so
      // "no logo img" is a refusal rather than a blank document.
      assert.ok(doc.body.textContent.includes('Acme Roofing'), 'the company name must still render');

      const srcs = [...doc.querySelectorAll('img')].map((i) => i.getAttribute('src'));
      assert.ok(!srcs.includes(payload), `the hostile value reached an img src: ${JSON.stringify(payload)}`);
      // And it must not survive in ANY escaped form anywhere in the document.
      assert.ok(!/javascript|vbscript|data:text|file:/i.test(doc.documentElement.innerHTML),
        'the payload survived in some form — refusal means the value is never emitted');
    });
  }
});

describe('T2 — hostile social URLs draw no link', () => {
  it('[PAIRED POSITIVE] an https social renders as a link', () => {
    const doc = render(campaign({}), settings({ social_facebook: GOOD_SOCIAL, company_name: 'Acme Roofing' }));
    const hrefs = [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    assert.ok(hrefs.some((h) => h && h.startsWith('https://facebook.example.test')),
      'a legitimate social link must render');
  });

  it('a bare domain still renders — it is the NORMAL case for these fields', () => {
    // safeWebsiteUrl prepends https only when there is no scheme, which is what
    // keeps a hostile scheme from being laundered into an https one.
    const doc = render(campaign({}), settings({ social_google: 'acme.example.test/page', company_name: 'Acme Roofing' }));
    const hrefs = [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    assert.ok(hrefs.some((h) => h && h.startsWith('https://acme.example.test')),
      'a bare domain is what the admin field actually receives and must still link');
  });

  for (const [label, payload] of HOSTILE) {
    it(`[T2] a ${label} social draws no link`, () => {
      const doc = render(campaign({}), settings({ social_facebook: payload, company_name: 'Acme Roofing' }));
      assert.ok(doc.body.textContent.includes('Acme Roofing'), 'the company name must still render');
      const hrefs = [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href'));
      assert.ok(!hrefs.includes(payload), `the hostile value reached an href: ${JSON.stringify(payload)}`);
      assert.ok(!/javascript|vbscript|data:text|file:/i.test(doc.documentElement.innerHTML),
        'the payload survived in some form');
    });
  }
});

describe('T2 — a hostile cta_url draws no CTA', () => {
  it('[PAIRED POSITIVE] an https CTA renders with its derived label', () => {
    const doc = render(campaign({ cta_enabled: true, cta_url: GOOD_CTA }), settings({ company_name: 'Acme Roofing' }));
    const cta = [...doc.querySelectorAll('a')].find((a) => (a.getAttribute('href') || '').startsWith('https://example.test'));
    assert.ok(cta, 'a legitimate CTA must render');
    assert.equal(cta.textContent, 'Visit Our Website');
  });

  for (const [label, payload] of HOSTILE) {
    it(`[T2] a ${label} cta_url draws no CTA link`, () => {
      const doc = render(campaign({ cta_enabled: true, cta_url: payload }), settings({ company_name: 'Acme Roofing' }));
      assert.ok(doc.body.textContent.includes('Acme Roofing'), 'the company name must still render');
      const hrefs = [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href'));
      assert.ok(!hrefs.includes(payload), `the hostile value reached an href: ${JSON.stringify(payload)}`);
      assert.ok(!/javascript|vbscript|data:text|file:/i.test(doc.documentElement.innerHTML),
        'the payload survived in some form');
    });
  }
});

describe('T4 — rejection behaviour follows the landing page', () => {
  it('a refused logo OMITS the element rather than emitting an empty src', () => {
    // ⚠ THE RULING. The landing page renders the company NAME as styled text
    // when a logo is refused, and never falls back to the platform mark. In this
    // template the name already renders immediately below the logo slot, so
    // omitting the <img> reaches the same outcome without inventing markup.
    // ⚠ AN EMPTY src= IS NOT NEUTRAL — a browser resolves src="" to the current
    // document URL, which is a second request and a visibly broken image in an
    // email the recipient can see.
    const doc = render(campaign({}), settings({ logo_url: "javascript:alert('x')", company_name: 'Acme Roofing' }));
    for (const img of doc.querySelectorAll('img')) {
      const src = img.getAttribute('src');
      assert.ok(src && src.trim() !== '', 'an img was emitted with an empty src');
    }
    assert.ok(doc.body.textContent.includes('Acme Roofing'), 'the company name carries the brand instead');
  });

  it('a refused social omits ONLY that link, not the whole footer', () => {
    const doc = render(campaign({}), settings({
      social_facebook: "javascript:alert('x')",
      social_google: GOOD_SOCIAL,
      company_name: 'Acme Roofing',
    }));
    const hrefs = [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter(Boolean);
    assert.ok(hrefs.some((h) => h.startsWith('https://facebook.example.test')),
      'the surviving social must still render — a refusal must not take its siblings with it');
    assert.ok(!hrefs.some((h) => /javascript/i.test(h)), 'the refused social must be gone');
  });
});

describe('T5 — a legitimate campaign email still renders its substantive content', () => {
  it('everything a recipient reads is present', () => {
    const doc = render(
      campaign({
        name: 'Spring Roof Check',
        email_header: 'A note from your roofer',
        image_url: 'https://media.example.test/a/b.png',
        cta_enabled: true,
        cta_url: GOOD_CTA,
      }),
      settings({
        company_name: 'Example Roofing & Sons',
        company_email: 'hello@example.test',
        logo_url: GOOD_LOGO,
        company_city: 'Springfield',
        company_state: 'GA',
        social_facebook: GOOD_SOCIAL,
      }),
      'Thanks for being a customer. We appreciate your referrals.'
    );
    // ⚠ SUBSTANCE. A blank email passes every security assertion in this file.
    assert.equal(doc.querySelector('h1').textContent, 'A note from your roofer');
    assert.equal(doc.querySelector('p').textContent, 'Thanks for being a customer. We appreciate your referrals.');
    const imgs = [...doc.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    assert.ok(imgs.includes('https://media.example.test/a/b.png'), 'the campaign image must render');
    assert.ok(imgs.includes(GOOD_LOGO), 'the logo must render');
    const text = doc.body.textContent;
    assert.ok(text.includes('Example Roofing & Sons'), 'the company name, decoded');
    assert.ok(text.includes('Springfield, GA'), 'the address line');
    assert.ok(text.includes('hello@example.test'), 'the contact address');
    assert.ok(text.includes('Powered by RoofMiles'), 'the platform footer');
  });
});

describe('the shared check behaves the same for both callers', () => {
  it('safeLogoUrl admits https and refuses every hostile shape', () => {
    assert.equal(safeLogoUrl(GOOD_LOGO), GOOD_LOGO);
    for (const [label, payload] of HOSTILE) {
      assert.equal(safeLogoUrl(payload), null, `safeLogoUrl admitted ${label}`);
    }
  });

  it('safeWebsiteUrl admits a bare domain and refuses every hostile SCHEME', () => {
    assert.equal(safeWebsiteUrl('acme.example.test')?.href, 'https://acme.example.test/');
    for (const [label, payload] of HOSTILE) {
      if (label === 'protocol-relative') continue;   // see the case below
      assert.equal(safeWebsiteUrl(payload), null, `safeWebsiteUrl admitted ${label}`);
    }
  });

  it('⚠ safeWebsiteUrl NORMALISES a protocol-relative input to https, and that is not a hole', () => {
    // ⚠ MEASURED, AND THE FIRST DRAFT OF THIS SUITE CALLED IT A DEFECT.
    // '//evil.test/x' contains no '://', so the https prefix is prepended and the
    // URL parser collapses the doubled slashes: the result is
    // 'https://evil.test/x'. That LOOKS like laundering and is not — the output
    // is https, and an admin can reach the identical result by typing
    // 'evil.test', which is exactly what this field is for. The function's job is
    // to guarantee an https link to a dotted host, and it does.
    // ⚠ safeLogoUrl REFUSES THE SAME INPUT, and the asymmetry is correct rather
    // than an inconsistency: it does no prepending, because for an `img src` a
    // bare hostname is a broken relative path, not the normal case.
    assert.equal(safeWebsiteUrl('//evil.test/x.png').href, 'https://evil.test/x.png');
    assert.equal(safeLogoUrl('//evil.test/x.png'), null);
    // The property that actually matters is unchanged: the result is https.
    assert.equal(new URL(safeWebsiteUrl('//evil.test/x.png').href).protocol, 'https:');
  });

  it('both refuse a non-string without throwing', () => {
    for (const v of [null, undefined, 42, {}, []]) {
      assert.equal(safeLogoUrl(v), null);
      assert.equal(safeWebsiteUrl(v), null);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ── T6 — THE FENCE AGAINST A LOCAL COPY ─────────────────────────────────────
//
// ⚠ A BASELINE, NOT A ZERO-ASSERTION, and for the reason 460e87c recorded: an
// entry that can only grow stops being a list of open work. This one also fails
// when a listed file is REPAIRED, so the baseline shrinks as the work proceeds
// rather than rotting into a permanent allowance.
//
// ⚠ IT DOES NOT REPORT ITSELF, STRUCTURALLY RATHER THAN BY A CARVE-OUT: the scan
// is scoped to production files and this lives under server/test/. And the
// needles are ASSEMBLED FROM PIECES so the patterns appear nowhere literally —
// the reword-never-exempt rule has been hit in six consecutive phases of this
// arc, twice in the last one alone, and once on a message string rather than on
// a regex.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ ASSEMBLED FROM PIECES so neither pattern appears literally in this file.
// ⚠ AND MATCHED ON `.protocol` PLUS THE SCHEME RATHER THAN ON AN OPERATOR — a
// first draft spelled the comparison as `!==` and missed the canonical
// implementation entirely, which uses `===`. A needle that cannot find the thing
// it is modelled on makes every assertion below permanently satisfied.
const PROTO = ['.', 'protocol'].join('');
const SCHEME = ['https', ':'].join('');
const NEW_URL = ['new', ' URL('].join('');
const declaresCheck = (code) => code.includes(PROTO) && code.includes(SCHEME) && code.includes(NEW_URL);

function productionFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'test') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) productionFiles(p, out);
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const SERVER = path.join(__dirname, '..');
const CANONICAL = 'server/utils/safeUrl.js';

function filesDeclaringASchemeCheck() {
  return productionFiles(SERVER)
    .map((f) => 'server/' + path.relative(SERVER, f).split(path.sep).join('/'))
    .filter((rel) => {
      const src = fs.readFileSync(path.join(SERVER, '..', rel), 'utf8');
      const code = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      return declaresCheck(code);
    })
    .sort();
}

describe('T6 — the scheme check has exactly one home', () => {
  it('the needle finds the canonical implementation and spares an ordinary call', () => {
    // ⚠ VALIDATED IN BOTH DIRECTIONS. A needle that can never match makes every
    // assertion below permanently satisfied, watching nothing.
    const canonical = fs.readFileSync(path.join(SERVER, 'utils', 'safeUrl.js'), 'utf8');
    assert.equal(declaresCheck(canonical), true, 'the needle must find the canonical implementation');
    assert.equal(filesDeclaringASchemeCheck().includes(CANONICAL), true);
    // An ordinary CALL to the shared helper must not look like a DECLARATION.
    assert.equal(declaresCheck('const logo = safeLogoUrl(cs.logo_url);'), false,
      'a call site must not match the needle');
    assert.equal(declaresCheck('const u = new URL(x);'), false,
      'a bare parse with no scheme comparison must not match');
  });

  // ⚠ A BASELINE, AND ITS ONE ENTRY IS NOT A DUPLICATE AWAITING REPAIR.
  // `/api/admin/extract-colors` parses a URL, requires https AND REFUSES PRIVATE
  // IP RANGES. That is an SSRF guard protecting the SERVER from being made to
  // fetch an internal address — a different control for a different purpose from
  // "this link must not run code in a recipient's mail client". Routing it
  // through safeLogoUrl would STRIP the private-IP check and swap a 400 for a
  // null. It is listed so the fence spares it deliberately rather than by a
  // carve-out, and so that a reader knows it was examined and not missed.
  // ⚠ THE NEEDLE FOUND IT, WHICH IS THE NEEDLE WORKING. Validating in both
  // directions means confirming it spares the legitimate idiom too — that is
  // what this list records.
  const KNOWN_DIFFERENT_PURPOSE = Object.freeze(['server/routes/admin/index.js']);

  it('no file outside the canonical one declares its own scheme check', () => {
    const found = filesDeclaringASchemeCheck().filter((f) => f !== CANONICAL);
    const unexpected = found.filter((f) => !KNOWN_DIFFERENT_PURPOSE.includes(f));
    assert.deepEqual(unexpected, [],
      'a second scheme check appeared — import { safeLogoUrl, safeWebsiteUrl } from ' +
      'server/utils/safeUrl instead of declaring one');
    // And the baseline must shrink rather than rot: an entry that no longer
    // declares a check has been repaired or removed, and must leave this list.
    const goneButListed = KNOWN_DIFFERENT_PURPOSE.filter((f) => !found.includes(f));
    assert.deepEqual(goneButListed, [],
      'these files no longer declare a check — remove them from KNOWN_DIFFERENT_PURPOSE');
  });

  it('the email templates IMPORT the shared check rather than having none', () => {
    // The paired positive. "No local copy" is satisfied by a file that checks
    // nothing at all, which is the state this commit is fixing.
    for (const rel of ['server/routes/admin/campaigns.js', 'server/utils/pendingReferral.js', 'server/routes/landing.js']) {
      const src = fs.readFileSync(path.join(SERVER, '..', rel), 'utf8');
      // ⚠ THE PATH SHAPE DIFFERS BY CALLER, AND TWO DRAFTS OF THIS REGEX WERE
      // TOO NARROW IN TURN. The three callers reach it as '../../utils/safeUrl',
      // '../utils/safeUrl' and — from inside utils/ — './safeUrl'. Requiring
      // 'utils/safeUrl' missed the third; requiring './safeUrl' missed the first
      // two. A needle that cannot match a legitimate caller reports a defect
      // that is not there, which is the same failure in the opposite direction
      // from a needle that matches prose.
      assert.match(src, /require\(['"][^'"]*safeUrl['"]\)/,
        `${rel} must import the shared URL check`);
    }
  });
});
