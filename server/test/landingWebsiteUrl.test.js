'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// POLISH ITEM 3 — PHASE 2 (HALF 1) RED SUITE — safeWebsiteUrl
//
// THE VALIDATOR ALONE. Half 2 renders the branded State 0 contact block; this
// half pins the function that decides whether a stored website value is safe to
// put in an href at all. Split deliberately: one is a security predicate with a
// large input space, the other is markup. Testing them together would mean
// proving the hostile-scheme cases through a rendered page, where a failure
// reads as "the row is missing" rather than "the guard let it through".
//
// ── WHY safeLogoUrl CANNOT BE REUSED ────────────────────────────────────────
// It is the closest thing in the file and it refuses the exact shape stored
// here. safeLogoUrl (landing.js:222-237) calls new URL(value) with no scheme
// handling, so a BARE DOMAIN — 'accentroofingservice.com', which is precisely
// what the admin Company Details "Website URL" field asks for — throws and
// returns null. That strictness is correct THERE: for an <img src> a bare
// hostname is a broken relative path. It is wrong here, where it is the normal
// case. Hence a sibling rather than a widening of the original, which would
// weaken the logo guard to fix the website one.
//
// ── WHY THIS IS A UNIT TEST WHEN safeLogoUrl'S EQUIVALENT IS NOT ────────────
// safeLogoUrl has no direct test anywhere; it is module-private and exercised
// only through rendered output. That precedent cannot apply until Half 2 exists
// — there is nothing on the page rendering a website yet — so the function is
// reached through an additive `module.exports.safeWebsiteUrl = safeWebsiteUrl`
// hung off the exported router. The router itself stays the module's export:
// server/app.js:5,71 does `require('./routes/landing')` then
// `app.use('/', landingRoutes)`, so replacing it with a named-exports object
// would unmount the landing page.
//
// ── WHAT IS BINDING ─────────────────────────────────────────────────────────
// THE ORIGINAL IS THE LABEL, THE NORMALISED FORM IS THE HREF, and they are
// returned separately on purpose. new URL() normalises — a bare origin gains a
// trailing slash — so a homeowner shown the href would read
// 'https://accentroofingservice.com/' where their roofer's sign says
// 'accentroofingservice.com'. safeLogoUrl already makes this same
// original-vs-normalised distinction at :233-235 for the same reason.
//
// HTTPS ONLY, http REFUSED. Same stance as safeLogoUrl:215-217 — a TLS page
// linking out over http is the same mixed-content posture, and the check is what
// keeps a hostile scheme out of an href on the one public page in the product
// that interpolates contractor-controlled strings.
//
// NO PRODUCTION DOMAIN LITERALS beyond the contractor's own website, which is
// the value under test and cannot be fixture-local without testing something
// else. Hostile fixtures are .invalid.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// FOR THE SAFETY INTERLOCK ONLY, and initTestDb is deliberately NOT called.
// Requiring ../routes/landing pulls in ../db, which constructs a pg Pool at
// module load; requiring setup first guarantees that pool is built from
// .env.test and that the localhost interlock has already run. It never connects
// — pg opens no socket until the first query and this suite issues none — so
// there is no schema to build and no handle to close. A pure function does not
// need a database, and rebuilding one here would be a second's ceremony per run
// for nothing.
require('./setup');

// LAZY REQUIRE, matching brandingTheme.test.js:84-95. A top-level require of a
// module whose export does not exist yet would report as one file-level error
// and hide every individual case behind it.
function loadSafeWebsiteUrl() {
  let mod;
  try {
    mod = require('../routes/landing');
  } catch (err) {
    assert.fail(
      `server/routes/landing.js is not requirable (${err.code || err.message}).`
    );
  }
  assert.equal(
    typeof mod.safeWebsiteUrl, 'function',
    'server/routes/landing.js must expose safeWebsiteUrl for test. It is module-private today; ' +
    'the GREEN step adds `module.exports.safeWebsiteUrl = safeWebsiteUrl;` AFTER the existing ' +
    '`module.exports = router;` — a property on the router function object, so the app.js mount ' +
    'is untouched.'
  );
  return mod.safeWebsiteUrl;
}

// The contractor's stored website, in the two shapes the database actually
// holds. company_url is an unconstrained VARCHAR(500) with no normalisation
// between the admin form and the row, and the two admin surfaces disagree about
// the intended shape — Company Details' placeholder is a bare domain, the
// Branding page's social sibling shows a full URL. Both must work.
const BARE = 'accentroofingservice.com';
const WITH_SCHEME = 'https://accentroofingservice.com';

// THE NORMALISED HREF CARRIES A TRAILING SLASH. Verified against Node's WHATWG
// URL rather than assumed: new URL('https://accentroofingservice.com').href is
// 'https://accentroofingservice.com/'. This is exactly why href and label are
// two values instead of one.
const HREF = 'https://accentroofingservice.com/';

describe('Polish item 3 Phase 2 (half 1) — safeWebsiteUrl', () => {

  it('[RED] landing.js exposes safeWebsiteUrl', async () => {
    // The bare existence check, named separately so a missing export reports as
    // ONE clear failure rather than fifteen confusing ones.
    loadSafeWebsiteUrl();
  });

  it('[RED] accepts a stored website and returns the normalised href with the original as the label', async () => {
    const safeWebsiteUrl = loadSafeWebsiteUrl();

    // deepEqual is deepSTRICTEqual here (node:assert/strict), which compares own
    // keys — so this also pins that the return is EXACTLY { href, label } and
    // grows no third key without this test being updated openly.
    assert.deepEqual(
      safeWebsiteUrl(BARE),
      { href: HREF, label: BARE },
      'a bare domain is the normal stored shape and must be accepted, with https:// prepended for the href only'
    );

    assert.deepEqual(
      safeWebsiteUrl(`  ${BARE}  `),
      { href: HREF, label: BARE },
      'padding must be trimmed before parsing AND before being used as the label — ' +
      'a label with leading spaces renders as a gap in the contact row'
    );

    assert.deepEqual(
      safeWebsiteUrl(WITH_SCHEME),
      { href: HREF, label: WITH_SCHEME },
      'an already-schemed value must be accepted, and the LABEL must preserve what the admin typed ' +
      'rather than being rewritten to the normalised form'
    );

    assert.deepEqual(
      safeWebsiteUrl(`${BARE}/contact`),
      { href: `https://${BARE}/contact`, label: `${BARE}/contact` },
      'a path must survive — new URL does not append a trailing slash to a value that already has a path'
    );
  });

  it('[RED] refuses everything that is not a plain https website', async () => {
    const safeWebsiteUrl = loadSafeWebsiteUrl();

    const refused = [
      // ── SCHEME ────────────────────────────────────────────────────────────
      [
        'http://accentroofingservice.com',
        'plain http is refused — a TLS page linking out over http is the same mixed-content posture ' +
        'safeLogoUrl:215-217 refuses, and accepting it here would be the looser of two sibling guards',
      ],
      [
        'javascript:alert(1)',
        'a javascript: URL must never reach an href. NOTE THE MECHANISM: this value contains no "://", ' +
        'so the prepend fires and new URL("https://javascript:alert(1)") THROWS on the invalid port — ' +
        'it is refused by the parse, not by the protocol check',
      ],
      [
        'javascript://evil.invalid/%0aalert(1)',
        'the OTHER half of the javascript: case, and the reason both are here: this one DOES contain ' +
        '"://", so no prepend fires, it parses cleanly as protocol javascript: and is refused by the ' +
        'https check instead. An implementation that got only one of these two paths right would still ' +
        'pass a table that tested only the other',
      ],
      [
        'data:text/html,<script>alert(1)</script>',
        'same shape as the bare javascript: case — no "://", so the prepend produces an unparseable ' +
        'host and it is refused',
      ],

      // ── HOSTNAME ──────────────────────────────────────────────────────────
      [
        'https://localhost',
        'a hostname with no dot is refused. It parses perfectly well, which is exactly why it needs its ' +
        'own rule rather than being caught by the parse',
      ],
      ['https://foo', 'a bare label is not a website'],
      ['not a url with spaces', 'free text — the prepend produces an unparseable host'],

      // ── EMPTY AND NON-STRING ──────────────────────────────────────────────
      ['', 'empty string — the shape a cleared admin field has'],
      ['   ', 'whitespace-only is unset, not a website'],
      [null, 'NULL is the shape an unset DB column has'],
      [undefined, 'the key may simply be absent — the resolver omits website when unset'],
      [123, 'a non-string must not reach new URL'],
      [{}, 'an object must not reach new URL either'],
    ];

    for (const [input, why] of refused) {
      assert.equal(
        safeWebsiteUrl(input), null,
        `${JSON.stringify(input)} must be refused: ${why}`
      );
    }
  });
});
