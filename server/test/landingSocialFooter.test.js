'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BR-2 PHASE 2 (A32(b)) — THE SOCIAL ROW IN THE LANDING FOOTER
//
// `LANDING_PAGE_SPEC.md` had no opinion on social links until A32; this is the
// first. It is LAYOUT rather than copy, so §2's copy freeze is not what governs
// it — the amendment records that reasoning and this file fences the result.
//
// ⚠ THE PREDICATE IS NOT RESTATED HERE OR IN THE RENDERER. Which links count as
// populated is decided once, by the collector `resolveBrandingTheme` gained in
// BR-2 Phase 1, so the landing page, the About Us popup and the campaign email
// footer cannot disagree. These tests drive the RENDERER against that
// collector's output rather than re-deciding absence themselves.
//
// ⚠ EMPTY STRING, NULL AND WHITESPACE ARE ALL ABSENT, and the fixtures carry all
// three. The production contractor has three socials set and two stored as
// EMPTY STRING — a fixture built only from nulls exercises one branch and ships
// a footer with two dead icons in it.
//
// ⚠ AND THE GROUP-LEVEL RULE: with nothing set there is NO ROW, NO CONTAINER and
// NO DIVIDER — not an empty container. That is the form LP-1 already takes per
// field, applied to a group.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { resolveBrandingTheme } = require('../utils/brandingTheme');
const { __test__ } = require('../routes/landing');

// ⚠ THROWS ON AN UNEXPECTED SHAPE rather than returning something plausible —
// the BR-1 Phase 1-B lesson. `renderFooter` takes a resolved theme; handing it a
// raw settings row would silently produce a footer with no socials and every
// absence assertion below would pass for the wrong reason.
function footerFor(raw) {
  const theme = resolveBrandingTheme(raw);
  if (!theme || typeof theme.companyName !== 'string') {
    throw new Error('footerFor(): expected a resolveBrandingTheme payload');
  }
  return __test__.renderFooter(theme);
}

const THREE_SET = {
  contractor_name: 'Alpha Roofing Co',
  company_phone: '555-0100',
  company_email: 'help@alpha.invalid',
  social_facebook: 'https://facebook.com/alpharoofing',
  social_instagram: '',            // empty string — the production shape
  social_google: 'https://g.page/alpharoofing',
  social_nextdoor: '   ',          // whitespace only
  social_website: 'https://alpharoofing.invalid',
};

const NONE_SET = {
  contractor_name: 'Bare Roofing Co',
  company_phone: '555-0900',
  company_email: 'help@bare.invalid',
  social_facebook: '', social_instagram: null,
  social_google: '   ', social_nextdoor: '', social_website: null,
};

describe('BR-2 Phase 2 (A32(b)) — the landing footer social row', () => {

  it('[RED] T5 — exactly the POPULATED socials render, the absent ones nowhere', () => {
    const html = footerFor(THREE_SET);

    // ⚠ THE href IS NORMALISED AND THE FIXTURE IS NOT, WHICH IS safeWebsiteUrl
    // DOING ITS DOCUMENTED JOB rather than a defect. A bare origin gains a
    // trailing slash (`https://alpharoofing.invalid` -> `.../`) because that is
    // what `new URL().href` produces; a path-bearing URL is unchanged. Asserting
    // the raw fixture string would fence the ABSENCE of normalisation, which is
    // the opposite of what that helper exists for — so the expectation carries
    // the normalised form and says why.
    for (const url of [
      'https://facebook.com/alpharoofing',
      'https://g.page/alpharoofing',
      'https://alpharoofing.invalid/',
    ]) {
      assert.ok(html.includes(`href="${url}"`), `the footer is missing ${url}`);
    }

    // ⚠ THE ABSENT TWO SWEPT OUT OF THE WHOLE FOOTER, not merely out of the row.
    assert.ok(!/instagram/i.test(html), 'the empty-string social leaked into the footer');
    assert.ok(!/nextdoor/i.test(html), 'the whitespace-only social leaked into the footer');
    // NOT VACUOUS: no anchor may carry an empty or stringified-null target.
    for (const m of html.matchAll(/href="([^"]*)"/g)) {
      assert.ok(!/^(|null|undefined)$/.test(m[1]), `a dead href reached the footer: "${m[1]}"`);
    }
  });

  it('[RED] T5 — the fixture genuinely mixes set, empty string and whitespace', () => {
    // NON-VACUITY FOR THE TEST ABOVE, as an assertion rather than a comment.
    assert.equal(THREE_SET.social_instagram, '');
    assert.equal(THREE_SET.social_nextdoor.trim(), '');
    assert.equal(resolveBrandingTheme(THREE_SET).socials.length, 3);
  });

  it('[RED] T6 — every social absent means NO ROW, NO CONTAINER — and the contact rows survive', () => {
    const html = footerFor(NONE_SET);

    // ⚠ THE CONTAINER, NOT THE LINKS. "No links rendered" is satisfied by an
    // empty container with a divider above it, which is exactly what A32(b)
    // forbids.
    assert.ok(!html.includes('class="socials"'), 'an empty socials container rendered');
    assert.ok(!/facebook|instagram|nextdoor/i.test(html));

    // ⚠ AND THE OTHER DIRECTION, WHICH IS WHY THIS TEST IS NOT JUST AN ABSENCE.
    // A renderFooter that threw, or returned '', would satisfy every line above.
    assert.ok(html.includes('tel:555-0900'), 'the phone contact row disappeared with the socials');
    assert.ok(html.includes('mailto:help@bare.invalid'), 'the email contact row disappeared');
    assert.ok(html.includes('Powered by'), 'the footer itself did not render');
  });

  it('[RED] every social link is safe to click and carries an accessible name', () => {
    const html = footerFor(THREE_SET);
    const anchors = [...html.matchAll(/<a\s+[^>]*href="https:\/\/[^"]*"[^>]*>/g)].map(m => m[0]);
    const socialAnchors = anchors.filter(a => /aria-label="[^"]*on /.test(a));

    assert.equal(socialAnchors.length, 3, 'expected three social anchors');
    for (const a of socialAnchors) {
      assert.ok(/target="_blank"/.test(a), `social link has no target: ${a}`);
      // ⚠ noopener IS NOT COSMETIC on an admin-pasted URL: without it the
      // destination gets a handle on this window through window.opener.
      assert.ok(/rel="noopener noreferrer"/.test(a), `social link has no rel: ${a}`);
      assert.ok(/aria-label="/.test(a), `icon-only link with no accessible name: ${a}`);
    }
  });

  it('[RED] a hostile social URL cannot break out of the attribute or carry a scheme', () => {
    // The columns are unconstrained VARCHAR(500) with an admin form in front of
    // them, so both halves are real: escaping stops an attribute breakout, and a
    // scheme check stops `javascript:` — which needs no escaping at all and would
    // otherwise land in href perfectly intact. Same split safeLogoUrl documents.
    const html = footerFor({
      ...THREE_SET,
      social_facebook: 'javascript:alert(1)',
      social_google: 'https://g.page/"><script>alert(1)</script>',
    });

    assert.ok(!html.includes('javascript:'), 'a javascript: scheme reached an href');
    assert.ok(!html.includes('<script>'), 'markup broke out of the attribute');
  });
});
