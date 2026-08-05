// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3c — TENANT IDENTITY ON THE HOMEOWNER-FACING SIGNUP SCREENS
//
// THE BUG THIS CLOSES. SignupScreen.jsx and EmailVerifyScreen.jsx each did three
// hardcoded-tenant things:
//
//     import accentRoofingLogo from '../../assets/images/AccentRoofing-Logo.png';
//     <img src={accentRoofingLogo} alt={contractorName || 'Accent Roofing Service'} />
//     …
//     ACCENT ROOFING SERVICE · EST. 1989
//
// A homeowner who scanned CONTRACTOR #2's yard sign, followed CONTRACTOR #2's QR
// code and landed on CONTRACTOR #2's invite link was shown CONTRACTOR #1's logo
// above the form and CONTRACTOR #1's name in the footer. The alt text fell back to
// the same name, so a screen reader announced it too.
//
// This is the C9 shape Phase 2a removed from the PAYLOAD, still live on the SCREENS
// that render it. Phase 2a made the data white-labeled; these two files went on
// ignoring the data.
//
// THE FIX: source logo and company name from the invite payload's branding block,
// which App.js already receives from GET /api/invite/:slug and now threads down.
//
// ── THE FALLBACK CHAIN ENDS AT THE PLATFORM, NEVER AT A CONTRACTOR ───────────
// When a contractor has uploaded no logo, these screens draw the ROOFMILES mark.
// 'RoofMiles' in front of a homeowner is merely unhelpful; ANOTHER ROOFER'S name
// or mark there reads as phishing to the person looking at it, and is a
// white-label breach besides. There is no third option — a borrowed placeholder
// is not a fallback.
//
// ⚠ THE LANDING PAGE WILL NOT FOLLOW THIS RULE (Phase 3d, noted here, not built).
// There, a contractor with no logo renders their COMPANY NAME AS STYLED TEXT, not
// the RoofMiles mark: the homeowner scanned that contractor's yard sign and has
// never heard of RoofMiles. RoofMiles is the last resort on that surface, not the
// first. These screens differ because the homeowner has by then already accepted
// an invitation and is inside the product.
//
// ── HOW THE IMAGE SOURCE IS OBSERVED ─────────────────────────────────────────
// CRA's jest transform maps an imported image to its BASENAME, so a bundled asset
// renders as src="AccentRoofing-Logo.png" or src="roofmiles_logo_png.png" while a
// contractor's uploaded logo renders as the absolute URL from the payload. All
// three are distinguishable by substring, which is what every assertion below reads.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent } from '@testing-library/react';
import SignupScreen from './SignupScreen';
import EmailVerifyScreen from './EmailVerifyScreen';
import App from '../../App';

// The asset that must never appear on these screens again, and the platform mark
// that replaces it. Named as literals because the assertion is meaningless without
// them — this is the same exception brandingTheme.test.js takes for the three
// drifted hex values.
const ACCENT_ASSET  = 'AccentRoofing-Logo';
const ACCENT_NAME   = 'ACCENT ROOFING SERVICE';
const ROOFMILES_MARK = 'roofmiles_logo';

// Two tenants, mutually exclusive in every field, so a bleed-through is
// unmistakable rather than a near-miss.
const TENANT_A = {
  contractorId: 'tnt-alpha-internal',
  companyName: 'Alpha Roofing Co',
  logoUrl: 'https://cdn.test.invalid/alpha/logo.png',
};
const TENANT_B = {
  contractorId: 'tnt-beta-internal',
  companyName: 'Beta Roofing Co',
  logoUrl: 'https://cdn.test.invalid/beta/logo.png',
};

const HOMEOWNER_EMAIL = 'homeowner@example.test.invalid';
const INVITE_SLUG     = 'fixture-invite-slug';
const NEW_USER_ID     = 4242;

// See the note in EmailVerifyScreen.test.js: written with URLSearchParams because
// server/test/linkGeneratorSweep.test.js statically sweeps src/ for the literal
// Scheme B needle and allows it in exactly one file.
function goToSignupUrl(slug) {
  window.history.replaceState({}, '', `/?${new URLSearchParams({ signup: slug })}`);
}

function brandingBlockFor(tenant, { logoUrl } = {}) {
  return {
    slug: 'fixture-slug',
    companyName: tenant.companyName,
    programName: null,
    primaryColor: '#123456',
    secondaryColor: '#654321',
    accentColor: '#ABCDEF',
    backgroundColor: '#FFFFFF',
    logoUrl: logoUrl === undefined ? tenant.logoUrl : logoUrl,
    phone: null,
    email: null,
  };
}

// The <img> inside the card — the contractor slot. The Rooster Booster wordmark
// above the card is the PRODUCT's own mark and is a separate question from
// tenancy, so it is excluded by matching on the card image's alt text.
function cardLogo() {
  const imgs = Array.from(document.querySelectorAll('img'));
  const card = imgs.find(i => (i.getAttribute('alt') || '') !== 'Rooster Booster');
  if (!card) throw new Error('no contractor logo slot rendered — nothing below is meaningful');
  return card;
}

function pageText() {
  return document.body.textContent || '';
}

afterEach(() => {
  delete global.fetch;
  window.history.replaceState({}, '', '/');
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE TWO SCREENS, RENDERED DIRECTLY
// ═════════════════════════════════════════════════════════════════════════════

describe('C/DL-2 Phase 3c — SignupScreen carries the contractor, not Accent Roofing', () => {

  it('renders the contractor\'s own logo and name from the branding block', () => {
    render(
      <SignupScreen
        inviteSlug={INVITE_SLUG}
        contractorName={TENANT_A.companyName}
        branding={brandingBlockFor(TENANT_A)}
        onSignupComplete={() => {}}
      />
    );

    // NON-VACUITY: the screen must genuinely have rendered its form before any
    // absence below can mean anything — a blank render contains no Accent strings
    // either. cardLogo() throws if the slot is missing.
    expect(screen.getByText('Create your account')).toBeInTheDocument();

    expect(cardLogo().getAttribute('src')).toContain(TENANT_A.logoUrl);
    expect(cardLogo().getAttribute('alt')).toBe(TENANT_A.companyName);
    expect(pageText()).toContain(TENANT_A.companyName);
  });

  it('shows no trace of Accent Roofing — asset, alt text or footer', () => {
    render(
      <SignupScreen
        inviteSlug={INVITE_SLUG}
        contractorName={TENANT_A.companyName}
        branding={brandingBlockFor(TENANT_A)}
        onSignupComplete={() => {}}
      />
    );
    // NON-VACUITY GATE: a real, populated screen showing a real logo.
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(cardLogo().getAttribute('src')).toContain(TENANT_A.logoUrl);

    const html = document.body.innerHTML;
    expect(html).not.toContain(ACCENT_ASSET);
    expect(pageText().toUpperCase()).not.toContain(ACCENT_NAME);
  });

  it('falls back to the ROOFMILES mark when the contractor has no logo, never to another brand', () => {
    render(
      <SignupScreen
        inviteSlug={INVITE_SLUG}
        contractorName={TENANT_A.companyName}
        branding={brandingBlockFor(TENANT_A, { logoUrl: null })}
        onSignupComplete={() => {}}
      />
    );
    // NON-VACUITY: the slot exists and is drawing something.
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    const src = cardLogo().getAttribute('src');
    expect(src).toBeTruthy();

    expect(src).toContain(ROOFMILES_MARK);
    expect(src).not.toContain(ACCENT_ASSET);
    // The NAME still belongs to the contractor even when the mark does not — the
    // homeowner must still be told whose program this is.
    expect(pageText()).toContain(TENANT_A.companyName);
  });
});

describe('C/DL-2 Phase 3c — EmailVerifyScreen carries the contractor, not Accent Roofing', () => {

  function renderVerify(tenant, brandingOverrides) {
    return render(
      <EmailVerifyScreen
        userId={NEW_USER_ID}
        email={HOMEOWNER_EMAIL}
        inviteSlug={INVITE_SLUG}
        contractorName={tenant.companyName}
        contractorId={tenant.contractorId}
        branding={brandingBlockFor(tenant, brandingOverrides)}
        onVerifyComplete={() => {}}
      />
    );
  }

  it('renders the contractor\'s own logo and name from the branding block', () => {
    renderVerify(TENANT_A);

    // NON-VACUITY: the verify card rendered.
    expect(screen.getByText('Check your email')).toBeInTheDocument();

    expect(cardLogo().getAttribute('src')).toContain(TENANT_A.logoUrl);
    expect(cardLogo().getAttribute('alt')).toBe(TENANT_A.companyName);
    expect(pageText()).toContain(TENANT_A.companyName);
  });

  it('shows no trace of Accent Roofing — asset, alt text or footer', () => {
    renderVerify(TENANT_A);
    expect(screen.getByText('Check your email')).toBeInTheDocument();
    expect(cardLogo().getAttribute('src')).toContain(TENANT_A.logoUrl);

    const html = document.body.innerHTML;
    expect(html).not.toContain(ACCENT_ASSET);
    expect(pageText().toUpperCase()).not.toContain(ACCENT_NAME);
  });

  it('falls back to the ROOFMILES mark when the contractor has no logo', () => {
    renderVerify(TENANT_A, { logoUrl: null });
    expect(screen.getByText('Check your email')).toBeInTheDocument();

    const src = cardLogo().getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toContain(ROOFMILES_MARK);
    expect(src).not.toContain(ACCENT_ASSET);
    expect(pageText()).toContain(TENANT_A.companyName);
  });

  it('degrades to the platform name when there is no branding block at all', () => {
    // A resolution that returned no contractor block must not blank the screen or
    // crash it. Named rather than left to chance because `branding` is optional at
    // the prop level and a bare `branding.companyName` would throw here.
    render(
      <EmailVerifyScreen
        userId={NEW_USER_ID}
        email={HOMEOWNER_EMAIL}
        inviteSlug={INVITE_SLUG}
        contractorName={null}
        contractorId={null}
        branding={null}
        onVerifyComplete={() => {}}
      />
    );

    expect(screen.getByText('Check your email')).toBeInTheDocument();
    expect(cardLogo().getAttribute('src')).toContain(ROOFMILES_MARK);
    expect(pageText().toUpperCase()).not.toContain(ACCENT_NAME);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. TWO TENANTS THROUGH THE REAL FLOW
// ═════════════════════════════════════════════════════════════════════════════

describe('C/DL-2 Phase 3c — the invite payload decides whose brand the homeowner sees', () => {

  function installFetch(tenant) {
    global.fetch = jest.fn(async (url) => {
      const u = String(url);
      if (u.includes(`/api/invite/${INVITE_SLUG}`)) {
        return {
          ok: true, status: 200,
          json: async () => ({
            valid: true, mode: 'invite',
            contractorId: tenant.contractorId,
            contractorName: tenant.companyName,
            linkType: 'contractor',
            contractor: brandingBlockFor(tenant),
          }),
        };
      }
      if (u.includes('/api/signup') && !u.includes('resend-code')) {
        return { ok: true, status: 200, json: async () => ({ userId: NEW_USER_ID }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
  }

  function fillField(labelText, value) {
    const input = screen.getByText(labelText).parentElement.querySelector('input');
    if (!input) throw new Error(`no input found for the field labelled "${labelText}"`);
    fireEvent.change(input, { target: { value } });
  }

  // Drives App from a bare invite URL through to the verify screen, so both
  // homeowner-facing screens are exercised with REAL components and the real
  // App-level threading rather than hand-passed props.
  async function completeSignup(tenant) {
    goToSignupUrl(INVITE_SLUG);
    installFetch(tenant);
    render(<App />);
    await screen.findByText('Create your account');

    fillField('First name',    'Dana');
    fillField('Last name',     'Reyes');
    fillField('Phone number',  '(770) 555-1234');
    fillField('Email address', HOMEOWNER_EMAIL);
    fillField('Password',         'hunter2!');
    fillField('Confirm password', 'hunter2!');
    fireEvent.click(screen.getByText('Create Account'));

    await screen.findByText('Check your email');
  }

  it('tenant A\'s homeowner sees tenant A\'s brand end to end', async () => {
    await completeSignup(TENANT_A);

    // NON-VACUITY: proven to be on the verify screen with a real logo slot before
    // the cross-tenant absence assertions below.
    expect(cardLogo().getAttribute('src')).toContain(TENANT_A.logoUrl);
    expect(pageText()).toContain(TENANT_A.companyName);

    expect(document.body.innerHTML).not.toContain(TENANT_B.logoUrl);
    expect(pageText()).not.toContain(TENANT_B.companyName);
    expect(document.body.innerHTML).not.toContain(ACCENT_ASSET);
  });

  it('tenant B\'s homeowner sees tenant B\'s brand end to end', async () => {
    // THE TEST THAT WOULD HAVE CAUGHT THE ORIGINAL BUG. A single-tenant fixture
    // cannot distinguish "renders the contractor's brand" from "renders the one
    // brand that is compiled in", which is exactly how this shipped.
    await completeSignup(TENANT_B);

    expect(cardLogo().getAttribute('src')).toContain(TENANT_B.logoUrl);
    expect(pageText()).toContain(TENANT_B.companyName);

    expect(document.body.innerHTML).not.toContain(TENANT_A.logoUrl);
    expect(pageText()).not.toContain(TENANT_A.companyName);
    expect(document.body.innerHTML).not.toContain(ACCENT_ASSET);
  });
});
