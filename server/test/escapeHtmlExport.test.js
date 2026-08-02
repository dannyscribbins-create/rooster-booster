'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3d-1 RED SUITE — escapeHtml MUST BE IMPORTABLE
//
// CLAUDE.md states the rule twice, in two different sections:
//
//   "escapeHtml lives in server/utils/pendingReferral.js — import from there,
//    never redefine locally."
//
// THE RULE IS CURRENTLY UNFOLLOWABLE. `escapeHtml` is defined at
// server/utils/pendingReferral.js:8 and is NOT in that file's `module.exports`
// (line 550), which lists only the six pending-referral functions. There is no
// way to import it. That is not a style problem — it is why six route files
// independently redefine it:
//
//   server/routes/referrer.js:38
//   server/routes/account.js:24
//   server/routes/admin/cashouts.js:15
//   server/routes/resendWebhook.js:14
//   server/routes/webhooks/jobber.js:3
//   server/crm/pipelineSync.js:48
//
// THE SIX COPIES ARE OUT OF SCOPE FOR THIS PHASE, deliberately. Deleting them
// touches six production files across the webhook, email, cashout and CRM paths,
// every one of which renders admin- and CRM-sourced strings into outbound HTML
// email. That is its own change with its own blast radius and its own review; it
// is not a free rider on a landing-page phase. This file pins ONLY that the
// canonical copy becomes importable and correct, which is what unblocks the
// landing page — the page interpolates a contractor's company name, address and
// phone, and a referrer's chip name, straight into markup.
//
// ── THE SECOND FINDING, AND IT MAKES THIS MORE THAN A ONE-LINE EXPORT ────────
//
// The canonical copy is the WEAKEST of the seven. It escapes & < > " and STOPS.
// It does not escape the single quote. Four of the six local copies do:
//
//   pendingReferral.js (canonical)  & < > "          <- missing '
//   referrer.js, account.js, ...    & < > " '        <- &#039;
//
// So exporting it as-is would make the rule followable and hand every future
// caller the least safe implementation in the repo, which is a worse outcome
// than the status quo.
//
// WHY THE SINGLE QUOTE IS NOT COSMETIC HERE. Single-quoted attribute values are
// legal HTML and are what a server-rendered template naturally produces when the
// value itself contains double quotes. In `<img src='...'>` or
// `<div title='...'>`, an unescaped `'` closes the attribute and the rest of the
// value is parsed as markup. The landing page renders a contractor-controlled
// logo URL into `src`, a contractor-controlled company name into `title`/`alt`
// and text, and an address into the footer. Those values are admin-editable, and
// on a public unauthenticated page.
//
// This file therefore asserts the FULL five-character contract. The export test
// and the single-quote test fail independently, and both must be fixed.
//
// NO DATABASE FIXTURES — this is a pure unit test of a pure function. The pool is
// opened only because requiring pendingReferral.js transitively requires db.js,
// and it is closed in `after` so the test process exits cleanly.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');

// Loads .env.test and runs the localhost safety interlock at module-load time.
// Required before anything pulls in db.js. No schema work is done here.
require('./setup');

describe('C/DL-2 Phase 3d-1 — escapeHtml is importable from its documented home', () => {
  after(async () => {
    // db.js is pulled in transitively by pendingReferral.js. Ending the pool keeps
    // the test process from holding an idle client open at exit.
    const { pool } = require('../db');
    await pool.end();
  });

  function loadEscapeHtml() {
    const mod = require('../utils/pendingReferral');
    assert.equal(
      typeof mod.escapeHtml, 'function',
      'server/utils/pendingReferral.js must EXPORT escapeHtml. It is defined at line 8 but ' +
      'absent from module.exports, which makes CLAUDE.md\'s "import from there, never redefine ' +
      'locally" rule impossible to follow — and is why six route files redefine it.'
    );
    return mod.escapeHtml;
  }

  it('[RED] escapeHtml is exported from server/utils/pendingReferral.js', () => {
    // The bare export check, named on its own so a missing export reports as one
    // clear failure rather than as a confusing cascade through the escaping tests.
    loadEscapeHtml();
  });

  it('[RED] it escapes the ampersand first, so later replacements are not double-encoded', () => {
    const escapeHtml = loadEscapeHtml();
    // Order matters and is worth pinning: escaping `<` to `&lt;` BEFORE escaping
    // `&` would turn a lone `<` into `&amp;lt;` and render the literal text
    // "&lt;" to the visitor.
    assert.equal(escapeHtml('&'), '&amp;');
    assert.equal(escapeHtml('a & b'), 'a &amp; b');
    assert.equal(escapeHtml('<'), '&lt;', 'a lone < must not become &amp;lt;');
  });

  it('[RED] it escapes < and > so a value cannot open or close a tag', () => {
    const escapeHtml = loadEscapeHtml();
    assert.equal(escapeHtml('<'), '&lt;');
    assert.equal(escapeHtml('>'), '&gt;');
    assert.equal(
      escapeHtml('<script>alert(1)</script>'),
      '&lt;script&gt;alert(1)&lt;/script&gt;',
      'a script tag in a company name must render as text, not execute'
    );
  });

  it('[RED] it escapes the double quote so a value cannot break out of an attribute', () => {
    const escapeHtml = loadEscapeHtml();
    assert.equal(escapeHtml('"'), '&quot;');
    assert.equal(
      escapeHtml('" onerror="x'), '&quot; onerror=&quot;x',
      'a double-quoted attribute must not be escapable'
    );
  });

  it('[RED] it escapes the SINGLE quote — the canonical copy does not today', () => {
    // THIS IS THE SECOND HALF OF THE FIX AND FAILS SEPARATELY FROM THE EXPORT.
    //
    // pendingReferral.js's copy escapes & < > " and stops. referrer.js:38,
    // account.js:24 and the other local copies all add `.replace(/'/g, '&#039;')`.
    // Exporting the canonical copy unchanged would promote the weakest of the
    // seven implementations into the one every future caller is told to use.
    //
    // `<img src='{logoUrl}'>` and `<div title='{companyName}'>` are both legal
    // HTML and both are things a server-rendered template produces. In either, an
    // unescaped `'` ends the attribute and everything after it parses as markup.
    const escapeHtml = loadEscapeHtml();

    assert.equal(
      escapeHtml("'"), '&#039;',
      "escapeHtml must escape the single quote. The canonical copy in " +
      "pendingReferral.js does not; the six local copies do. Exporting it as-is " +
      "hands every caller the least safe version in the repo."
    );
    assert.equal(
      escapeHtml("' onerror='x"), '&#039; onerror=&#039;x',
      'a single-quoted attribute must not be escapable either'
    );
  });

  it('[RED] all five characters escape together in one realistic value', () => {
    // The composite case. A per-character test can pass while a broken chained
    // implementation mangles a value containing several of them at once.
    const escapeHtml = loadEscapeHtml();
    assert.equal(
      escapeHtml(`Smith & Sons <"Roofing">'s`),
      'Smith &amp; Sons &lt;&quot;Roofing&quot;&gt;&#039;s'
    );
  });

  it('[RED] a plain string passes through untouched', () => {
    // The counterweight against over-escaping. The cheapest way to pass every test
    // above is to mangle everything; this pins that ordinary contractor names
    // survive intact.
    const escapeHtml = loadEscapeHtml();
    assert.equal(escapeHtml('Alpha Roofing Co'), 'Alpha Roofing Co');
    assert.equal(escapeHtml('770-277-4869'), '770-277-4869');
    assert.equal(escapeHtml('1 Alpha Way, Atlanta GA 30301'), '1 Alpha Way, Atlanta GA 30301');
  });

  it('[RED] nullish and non-string input yields a string and never throws', () => {
    // The landing page interpolates optional branding values — phone, email and
    // address are all nullable columns. A throw here would be a blank page on a
    // public marketing surface, so the total-function property is part of the
    // contract rather than an accident.
    //
    // DELIBERATELY NOT PINNING NUMBER COERCION. The canonical copy returns '' for
    // a number (`typeof s !== 'string'`); referrer.js's copy stringifies it. That
    // divergence is real and is one more argument for a single implementation, but
    // choosing the winner is a call for the phase that deletes the six copies —
    // not one to smuggle in here. Only "returns a string, does not throw" is
    // asserted, which both behaviours satisfy.
    const escapeHtml = loadEscapeHtml();
    for (const input of [null, undefined, '', 0, false, 42, {}, []]) {
      const out = escapeHtml(input);
      assert.equal(typeof out, 'string', `escapeHtml(${JSON.stringify(input)}) must return a string`);
    }
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
  });

  it('[GREEN-by-design] the six local copies still exist — recorded, not fixed, in this phase', () => {
    // A DELIBERATE SCOPE FENCE, not a coverage test.
    //
    // This asserts the copies are STILL THERE. It exists so that whoever deletes
    // them has to come here and delete this test too, at which point they read the
    // note above about why the deletion is its own change. Without it, "export the
    // canonical copy" and "remove six local ones" blur into a single unreviewed
    // edit across the webhook, email, cashout and CRM paths.
    //
    // If this test goes red, the cleanup happened — update the file header and
    // remove this test rather than restoring the copies.
    const fs = require('fs');
    const path = require('path');
    const copies = [
      ['routes', 'referrer.js'],
      ['routes', 'account.js'],
      ['routes', 'admin', 'cashouts.js'],
      ['routes', 'resendWebhook.js'],
      ['routes', 'webhooks', 'jobber.js'],
      ['crm', 'pipelineSync.js'],
    ];

    const stillLocal = copies.filter(parts => {
      const src = fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
      return /function escapeHtml\s*\(/.test(src);
    });

    assert.equal(
      stillLocal.length, copies.length,
      'A local escapeHtml copy was removed in this phase. That cleanup is deliberately ' +
      'OUT OF SCOPE here — it touches six production files on the email, webhook, cashout ' +
      'and CRM paths and needs its own review. If it was done on purpose, delete this test.'
    );
  });
});
