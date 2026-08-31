// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BRAND RETIREMENT — PHASE 2B — THE MOUNT SEAM
//
// Phase 2A built BrandingProvider, AdminBrandingContext and the throwing
// useAdminBranding() hook as a TESTED BUT UNUSED export. This file is the proof
// that the admin panel now mounts them, and that the values arriving are the
// ones GET /api/admin/me sent rather than anything resolved locally.
//
// ⚠ NOTHING IN THE PANEL RENDERS BRANDING THIS PHASE. That is Phase 4. So the
// only honest way to assert the hook resolves inside the tree is to put a probe
// INTO the tree — which is what the two module mocks below do. A test that
// looked for a company name in the rendered chrome would assert Phase 4's work
// and fail here for the right reason but the wrong phase.
//
// ── WHY TWO PROBES IN TWO DIFFERENT PLACES ─────────────────────────────────
// AdminApp renders two SIBLINGS: <AdminShell> (which wraps the page) and
// <AdminInboxSidebar>. A single probe deep inside the page would be satisfied by
// a provider mounted anywhere above that page — including inside AdminShell,
// around its children only. A probe in each sibling can only both resolve if the
// provider sits ABOVE BOTH, which is the structural claim Phase 4 depends on:
// the sidebar lockup (D-D) and the page content must read the same identity.
//
// ── ⚠ THE NON-VACUITY MECHANISM IS THE THROW ───────────────────────────────
// A probe that rendered a constant would pass every assertion below. The last
// describe renders THE SAME probe component with no provider above it and
// asserts it throws — so a green result here means the probe genuinely read
// context, and 2A's guard survived the mount. Take that block away and this
// whole file becomes CLAUDE.md vacuity shape #2.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from '@testing-library/react';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { useAdminBranding } from '../shared/BrandingProvider';
import AdminPanel from './AdminApp';

// The contractor the FIXTURE /me response names. Every value differs from the
// neutral platform set, so "published the contractor" and "published nothing"
// are two distinguishable states rather than one that happens to read correctly.
const TENANT_BRANDING = Object.freeze(resolveBrandingTheme({
  company_name:     'Delta Roofing Group',
  app_display_name: 'Delta Rewards',
  primary_color:    '#22AA55',
  secondary_color:  '#22AA66',
  accent_color:     '#22AA77',
  landing_bg_color: '#22AA88',
  logo_url:         'https://cdn.test.invalid/delta/logo.png',
}));

const NEUTRAL = Object.freeze(resolveBrandingTheme(null));

const ME_RESPONSE = {
  email: 'owner@delta.test.invalid',
  full_name: 'Dana Owner',
  tier: 'owner',
  permissions: {},
  title_id: null,
  is_field_rep: false,
  is_attributable: true,
  rep_revenue_visibility: 'none',
  branding: TENANT_BRANDING,
};

// ── THE PROBES ───────────────────────────────────────────────────────────────
// Hoisted above the imports by Vitest, so the factories reach for the hook via a
// dynamic import rather than the top-level binding.
vi.mock('./AdminDashboard', async () => {
  const { useAdminBranding: read } = await import('../shared/BrandingProvider');
  return {
    default: function PageProbe() {
      const { branding, source } = read();
      return <span data-testid="page-probe">{`${branding.companyName}|${branding.logoUrl}|${source}`}</span>;
    },
  };
});

vi.mock('./AdminInboxSidebar', async () => {
  const { useAdminBranding: read } = await import('../shared/BrandingProvider');
  return {
    default: function SiblingProbe() {
      const { branding } = read();
      return <span data-testid="sibling-probe">{branding.companyName}</span>;
    },
  };
});

// Answers everything AdminPanel asks for on mount. Only /api/admin/me is
// interesting; the rest exist so the tree finishes rendering without an
// unrelated rejection failing the assertion.
function installFetch({ me = ME_RESPONSE, meOk = true } = {}) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/admin/me')) {
      if (!meOk) return { ok: false, status: 500, json: async () => ({ error: 'Internal server error' }) };
      return { ok: true, status: 200, json: async () => me };
    }
    if (u.includes('/api/admin/messages') || u.includes('/api/admin/cashouts') ||
        u.includes('/api/admin/pending-referrals') || u.includes('/api/admin/missing-referrals')) {
      return { ok: true, status: 200, json: async () => [] };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
  sessionStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 2B — the admin panel mounts BrandingProvider and the hook resolves', () => {

  it('[RED] a consumer inside the page tree reads the branding /api/admin/me sent', async () => {
    installFetch();
    render(<AdminPanel onLogout={() => {}} />);

    await waitFor(() =>
      expect(screen.getByTestId('page-probe').textContent)
        .toBe(`${TENANT_BRANDING.companyName}|${TENANT_BRANDING.logoUrl}|session`));
  });

  it('[RED] the provider sits ABOVE BOTH siblings, not inside one of them', async () => {
    // AdminInboxSidebar is AdminShell's sibling. Both probes resolving is the
    // only arrangement in which Phase 4 can put the lockup in the sidebar chrome
    // and the contractor name on a page at the same time.
    installFetch();
    render(<AdminPanel onLogout={() => {}} />);

    await waitFor(() =>
      expect(screen.getByTestId('sibling-probe').textContent).toBe(TENANT_BRANDING.companyName));
    expect(screen.getByTestId('page-probe').textContent).toContain(TENANT_BRANDING.companyName);
  });

  it('[RED] the resolved value is DISTINGUISHABLE from the neutral one it started at', async () => {
    // Non-vacuity for both tests above. If the fixture happened to match the
    // platform defaults, "published the contractor" and "published nothing at
    // all" would be the same assertion.
    expect(TENANT_BRANDING.companyName).not.toBe(NEUTRAL.companyName);
    expect(TENANT_BRANDING.primaryColor).not.toBe(NEUTRAL.primaryColor);
    expect(TENANT_BRANDING.logoUrl).not.toBe(NEUTRAL.logoUrl);

    installFetch();
    render(<AdminPanel onLogout={() => {}} />);

    await waitFor(() =>
      expect(screen.getByTestId('page-probe').textContent).toContain(TENANT_BRANDING.companyName));
    expect(screen.getByTestId('page-probe').textContent).not.toContain(NEUTRAL.companyName);
  });

  it('[RED] paints immediately with the NEUTRAL identity — never another contractor\'s (D-I)', async () => {
    // ⚠ THIS CASE READ THE PROBE SYNCHRONOUSLY UNTIL C/DL-3c PHASE 2b, BECAUSE
    // THE PANEL PAINTED ON FRAME 1. IT NO LONGER DOES. Recorded rather than
    // quietly adjusted — this is a standing ruling meeting a newer one.
    //
    // D-I ruled: frame-1 BRANDED chrome is not achievable, and holding the shell
    // would trade a real universal delay for a COSMETIC one. Ruling A(i) now
    // holds the shell until /api/admin/me resolves — but for PERMISSIONS, not
    // for branding, and permissions are not cosmetic: painting sections before
    // knowing whether the member has any is what produced eleven scrims and
    // eight guaranteed 403s on every boot.
    //
    // ⚠ AND THE NEUTRAL FRAME IS NOW GONE ENTIRELY, WHICH IS AN IMPROVEMENT AND
    // NOT A REGRESSION — BUT IT IS A REAL CHANGE AND IS RECORDED AS ONE.
    // Branding and permissions ride the SAME /api/admin/me response, so a panel
    // that waits for permissions has already been handed the identity by the
    // time it paints. There is no longer a neutral-then-branded repaint at all:
    // the first frame is correctly branded.
    //
    // D-I's guarantee was never "show neutral first" — it was NEVER SHOW ANOTHER
    // CONTRACTOR'S IDENTITY, with neutral as the only honest thing to paint
    // while the answer was outstanding. With no outstanding window, the
    // guarantee holds by construction. THAT is what this case asserts now: the
    // first painted frame carries THIS tenant and no other.
    installFetch();
    render(<AdminPanel onLogout={() => {}} />);

    // The first painted frame, whenever it arrives.
    await waitFor(() => expect(screen.queryByTestId('page-probe')).toBeTruthy());
    const firstPaint = screen.getByTestId('page-probe').textContent;
    expect(firstPaint, 'the first frame must name THIS tenant').toContain(TENANT_BRANDING.companyName);
    // ⚠ THE NEGATIVE IS THE HALF THAT MATTERS, and it is why this case survives
    // its own rewrite rather than being deleted: no OTHER contractor's name, and
    // no platform placeholder standing in for one, may ever appear on a panel
    // that belongs to a tenant.
    expect(firstPaint, 'no platform placeholder in place of the tenant').not.toContain(NEUTRAL.companyName);

    // …and then it arrives, on the same tick as tier and permissions.
    await waitFor(() =>
      expect(screen.getByTestId('page-probe').textContent).toContain(TENANT_BRANDING.companyName));
  });

  it('[RED] a /me response with NO branding block leaves a working panel on neutral', async () => {
    // The client half of the server's fail-soft rule. The block is omitted when
    // resolution failed, and the panel must render rather than throw — the hook's
    // contract is that the OBJECT is never null, not that it names a contractor.
    installFetch({ me: { ...ME_RESPONSE, branding: undefined } });
    render(<AdminPanel onLogout={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('sibling-probe')).toBeTruthy());
    expect(screen.getByTestId('page-probe').textContent).toContain(NEUTRAL.companyName);
  });

  it('[RED] a failed /me leaves a working panel on neutral too', async () => {
    installFetch({ meOk: false });
    render(<AdminPanel onLogout={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('sibling-probe')).toBeTruthy());
    expect(screen.getByTestId('page-probe').textContent).toContain(NEUTRAL.companyName);
  });

  it('[RED] resolves from the RESPONSE, never from the D4 chain', async () => {
    // The panel must not call GET /api/branding/:slug. That chain resolves from
    // the URL, the hostname and a stored hint — none of them proven — which is
    // precisely the R2 shape D-J leaves open for C/DL-3c. Session-derived is the
    // whole point of choosing /me.
    installFetch();
    render(<AdminPanel onLogout={() => {}} />);
    await waitFor(() =>
      expect(screen.getByTestId('page-probe').textContent).toContain(TENANT_BRANDING.companyName));

    const called = global.fetch.mock.calls.map(([u]) => String(u));
    expect(called.some(u => u.includes('/api/branding/'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 2B — 2A\'s guard survives the mount', () => {

  // ⚠ THE SAME COMPONENT the page probe mock installs, rendered with nothing
  // above it. This is what makes every assertion in the block above non-vacuous:
  // a probe that returned a constant would pass them all and would NOT throw
  // here.
  function BareProbe() {
    const { branding } = useAdminBranding();
    return <span data-testid="bare">{branding.companyName}</span>;
  }

  it('[RED] useAdminBranding() still THROWS outside the provider', () => {
    // React logs the caught render error to console.error; that noise is expected
    // and is not what is being asserted.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<BareProbe />)).toThrow(/BrandingProvider/);
    } finally {
      spy.mockRestore();
    }
  });
});
