// ─────────────────────────────────────────────────────────────────────────────
// BR-2 PHASE 1 (S1) — THE SOCIAL LINKS REACH A HOMEOWNER
//
// THE DEFECT. Five columns — social_facebook, _instagram, _google, _nextdoor,
// _website — have an admin editor, a PATCH whitelist entry and a database
// column, and exactly ONE reader: the campaign email footer. No landing page, no
// referrer surface. A contractor fills them in and no homeowner ever sees them.
// The same shape the review trio was in before C/DL-3b Phase 6A.
//
// ⚠ THE TWO ABSENT SHAPES ARE DIFFERENT AND BOTH ARE REAL. The production
// contractor has three socials SET and two stored as EMPTY STRING — not NULL.
// A fixture built only from nulls exercises one branch and ships a row with two
// dead icons in it, which is worse than three icons. Every test here uses a
// fixture carrying BOTH shapes.
//
// ⚠ AND THE GROUP-LEVEL ABSENCE RULE. With nothing set, no row renders — not an
// empty container, not a divider with nothing under it. That is BR-1 Phase 2's
// absence rule applied to a GROUP rather than to a field, which is why the
// container's absence is asserted and not merely the links'.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen } from '@testing-library/react';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { ThemeContext } from '../shared/ThemeProvider';
import ContractorAboutModal from './ContractorAboutModal';

// ⚠ THE FIXTURE MIXES EMPTY STRING, NULL AND WHITESPACE, deliberately. Three set
// and two absent, matching production exactly.
const RAW_MIXED = {
  contractor_name: 'Alpha Roofing Co',
  logo_url: 'https://cdn.test.invalid/alpha-logo.png',
  social_facebook: 'https://facebook.com/alpharoofing',
  social_instagram: '',                                   // empty string
  social_google: 'https://g.page/alpharoofing',
  social_nextdoor: null,                                  // null
  social_website: 'https://alpharoofing.invalid',
};

const RAW_NONE = {
  contractor_name: 'Bare Roofing Co',
  social_facebook: '', social_instagram: null,
  social_google: '   ', social_nextdoor: '', social_website: null,
};

const BRAND_MIXED = Object.freeze(resolveBrandingTheme(RAW_MIXED));
const BRAND_NONE = Object.freeze(resolveBrandingTheme(RAW_NONE));
// Same contractor, no logo — for the A2 pairing in T3.
const BRAND_MIXED_NO_LOGO = Object.freeze(resolveBrandingTheme({ ...RAW_MIXED, logo_url: null }));

const ABOUT = { enabled: true, bio: 'We roof things.', years_in_business: 12 };

// ⚠ THROWS ON AN UNEXPECTED SHAPE rather than returning something plausible —
// the BR-1 Phase 1-B lesson. `source` decides A1 vs A2 inside BrandMark and a
// fixture that omits it would silently drive the not-yet-resolved path while
// looking like a resolved contractor.
function mount(branding, { source = 'session', about = ABOUT } = {}) {
  if (!branding || typeof branding !== 'object') {
    throw new Error('mount(): branding must be a resolveBrandingTheme payload');
  }
  return render(
    <ThemeContext.Provider value={{ mode: 'light', branding, source, setMode: () => {} }}>
      <ContractorAboutModal visible onContinue={() => {}} onBook={() => {}} aboutData={about} />
    </ThemeContext.Provider>
  );
}

const socialRow = () => document.querySelector('[data-rm-socials]');
const socialLinks = () => [...document.querySelectorAll('[data-rm-socials] a')];

describe('BR-2 S1 — the About Us popup carries the contractor\'s socials', () => {

  it('[RED] T1 — exactly the POPULATED socials render, and the absent ones appear nowhere', () => {
    mount(BRAND_MIXED);

    const hrefs = socialLinks().map(a => a.getAttribute('href'));
    expect(hrefs).toEqual([
      'https://facebook.com/alpharoofing',
      'https://g.page/alpharoofing',
      'https://alpharoofing.invalid',
    ]);

    // ⚠ BOTH ABSENT SHAPES SWEPT OUT OF THE WHOLE DOM, not just out of the row.
    // An icon rendered with an empty href elsewhere would still be a dead link.
    const html = document.body.innerHTML;
    expect(html, 'the empty-string social leaked').not.toMatch(/instagram/i);
    expect(html, 'the null social leaked').not.toMatch(/nextdoor/i);
    // NOT VACUOUS: no link may carry an empty or stringified-null target.
    for (const a of socialLinks()) {
      const href = a.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toMatch(/^(null|undefined|#)$/);
    }
  });

  it('[RED] T1 — the fixture genuinely mixes empty string, null AND whitespace', () => {
    // NON-VACUITY FOR THE TEST ABOVE, as an assertion rather than a comment. If
    // the fixture ever became all-populated or all-null, T1 would still pass
    // while covering one branch.
    expect(RAW_MIXED.social_instagram).toBe('');
    expect(RAW_MIXED.social_nextdoor).toBeNull();
    expect(RAW_NONE.social_google.trim()).toBe('');
    expect(BRAND_MIXED.socials).toHaveLength(3);
  });

  it('[RED] T2 — with every social absent there is NO ROW AND NO CONTAINER', () => {
    mount(BRAND_NONE);

    // ⚠ THE CONTAINER, NOT THE LINKS. "No links rendered" is satisfied by an
    // empty container with a divider above it, which is the exact thing A3
    // forbids — a group-level absence, not a field-level one.
    expect(socialRow(), 'an empty socials container rendered').toBeNull();
    expect(socialLinks()).toHaveLength(0);

    // AND THE OTHER DIRECTION: the modal still rendered. Without this, a crashed
    // component satisfies every assertion above.
    expect(screen.getByText(/Meet Bare Roofing Co/)).toBeTruthy();
  });

  it('[RED] T3 — the row does not disturb the existing logo-else-name behaviour', () => {
    // ⚠ THIS COMPONENT WAS ALREADY A2-COMPLIANT BEFORE BR-2 — BR-1 Phase 2
    // confirmed it needed no change, because it uses a ternary for
    // logo-else-company-name. Both halves are asserted here so adding the social
    // row cannot quietly regress the half nobody was looking at.
    const withLogo = mount(BRAND_MIXED);
    expect(document.querySelector(`img[src="${BRAND_MIXED.logoUrl}"]`)).toBeTruthy();
    expect(socialLinks()).toHaveLength(3);
    withLogo.unmount();

    mount(BRAND_MIXED_NO_LOGO);
    // A2: the name as text, and no image at all.
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getAllByText(/Alpha Roofing Co/).length).toBeGreaterThan(0);
    // The socials still render on the no-logo branch.
    expect(socialLinks()).toHaveLength(3);
  });

  it('[RED] every social link is safe to click and carries an accessible name', () => {
    mount(BRAND_MIXED);

    for (const a of socialLinks()) {
      expect(a.getAttribute('target')).toBe('_blank');
      // ⚠ noopener IS NOT COSMETIC on a link opening an admin-pasted URL: without
      // it the destination gets a handle on this window via window.opener.
      expect(a.getAttribute('rel')).toMatch(/noopener/);
      expect(a.getAttribute('rel')).toMatch(/noreferrer/);
      expect(a.getAttribute('aria-label'), 'an icon-only link with no accessible name').toBeTruthy();
    }
  });
});
