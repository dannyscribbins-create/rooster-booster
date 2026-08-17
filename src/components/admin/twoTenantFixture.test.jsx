// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BRAND RETIREMENT — PHASE 3 — THE FIXTURE'S OWN PROOF
//
// Governing spec: ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md, Phase 3 / Phase 4 guards.
//
// __fixtures__/twoTenantBranding.jsx exists so Phase 4 can decide ONE question:
// did tenant A's panel render tenant B's brand. Every assertion Phase 4 builds
// on it inherits whatever is true of the fixture — so if the two tenants agreed
// on a field, "A did not see B's value" would pass on that field forever, while
// proving nothing, in a test nobody would think to re-read.
//
// That is CLAUDE.md vacuity shape #1 exactly: a case row proves nothing until
// the field genuinely differs. This file forces the fixture's properties to be
// asserted rather than eyeballed.
//
// ⚠ NOTHING HERE RENDERS AN ADMIN SURFACE, AND NOTHING SHOULD. No admin
// component reads branding until Phase 4. The only render below is the fixture's
// own wrapper, exercised against a probe, to prove the wrapper WORKS before
// Phase 4 depends on it — a fixture that silently failed to publish would make
// every downstream test throw for an unrelated-looking reason.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen } from '@testing-library/react';
import { useAdminBranding } from '../shared/BrandingProvider';
import {
  TENANT_A, TENANT_B, TENANT_A_NO_LOGO, NEUTRAL, CONTAMINANTS, underTenant,
} from './__fixtures__/twoTenantBranding';

// The identity-bearing fields a leak would travel through. `programName` is
// included because it is contractor-chosen copy; the four colours because a
// palette leak is the exact D-A breach this whole session exists to close.
const IDENTITY_FIELDS = [
  'companyName', 'programName', 'primaryColor', 'secondaryColor',
  'accentColor', 'backgroundColor', 'logoUrl', 'phone', 'email',
];

describe('Phase 3 — the two-tenant fixture makes contamination DECIDABLE', () => {

  it('the two tenants differ on EVERY identity field', () => {
    // The load-bearing assertion of the whole fixture. One shared value and the
    // Phase 4 test covering that field becomes decoration.
    const shared = IDENTITY_FIELDS.filter(f => TENANT_A[f] === TENANT_B[f]);
    expect(shared,
      `tenants A and B agree on ${shared.join(', ')} — any Phase 4 assertion that ` +
      'tenant A did not render tenant B\'s value would pass on those fields no ' +
      'matter what the component did.'
    ).toEqual([]);
  });

  it('neither tenant matches the PLATFORM DEFAULT on any defaulted field', () => {
    // The third state. If tenant A's primaryColor happened to equal RoofMiles'
    // #F26A1B, then "the panel painted tenant A" and "the panel painted nothing
    // and fell back to neutral" would be the same observation — and the second
    // is a broken-wiring bug the sweep cannot see.
    for (const [label, brand] of [['A', TENANT_A], ['B', TENANT_B]]) {
      for (const field of IDENTITY_FIELDS) {
        if (NEUTRAL[field] === null || NEUTRAL[field] === undefined) continue;
        expect(brand[field],
          `tenant ${label}'s ${field} equals the platform default, so "rendered ` +
          `tenant ${label}" is indistinguishable from "rendered nothing".`
        ).not.toBe(NEUTRAL[field]);
      }
    }
  });

  it('every field the fixture claims to hold actually resolved', () => {
    // resolveBrandingTheme is the real resolver, and a raw key it does not read
    // yields undefined rather than throwing. A CONTAMINANTS entry of `undefined`
    // would then match nothing and quietly shrink the leak sweep — the fixture
    // would look fully populated while checking fewer values than it names.
    for (const field of IDENTITY_FIELDS) {
      expect(TENANT_A[field], `TENANT_A.${field} did not resolve`).toBeTruthy();
      expect(TENANT_B[field], `TENANT_B.${field} did not resolve`).toBeTruthy();
    }
    expect(CONTAMINANTS.length).toBeGreaterThan(0);
    expect(CONTAMINANTS.filter(v => typeof v !== 'string' || v === ''),
      'a CONTAMINANTS entry is not a usable string — it would match nothing and ' +
      'silently narrow every leak sweep built on this list.'
    ).toEqual([]);
  });

  it('no contaminant is a substring collision with tenant A', () => {
    // CONTAMINANTS is swept against rendered output, so a value that ALSO
    // appears inside one of tenant A's would report a leak on a clean render —
    // a false positive that would get the sweep weakened rather than the bug
    // fixed. Checked in both directions.
    const aValues = IDENTITY_FIELDS.map(f => TENANT_A[f]).filter(v => typeof v === 'string');
    const collisions = CONTAMINANTS.filter(c =>
      aValues.some(a => a.includes(c) || c.includes(a)));
    expect(collisions,
      `these tenant-B values overlap tenant A's: ${collisions.join(', ')} — a clean ` +
      'render under tenant A would be reported as a cross-tenant leak.'
    ).toEqual([]);
  });

  it('TENANT_A_NO_LOGO is tenant A with the logo ABSENT — nothing else changed', () => {
    // ⚠ THE ABSENT CASE IS THE PRIMARY FIXTURE (3b's fifth vacuity instance, the
    // one that reached production). Null, not '' and not a placeholder URL: the
    // consumer branches on presence, and an empty string is truthy in a `src`.
    expect(TENANT_A_NO_LOGO.logoUrl).toBeNull();

    // The absence must be ISOLATED, or a Phase 4 test asserting "no <img>" could
    // be passing because the whole object came back empty.
    for (const field of IDENTITY_FIELDS.filter(f => f !== 'logoUrl')) {
      expect(TENANT_A_NO_LOGO[field], `${field} changed in the no-logo variant`)
        .toBe(TENANT_A[field]);
    }
  });

  it('the fixtures are frozen, so one test cannot poison the next', () => {
    // Vitest shares module state across the files in a worker. A test that
    // mutated TENANT_A would change what a later file asserts against, and the
    // failure would surface somewhere else entirely.
    expect(Object.isFrozen(TENANT_A)).toBe(true);
    expect(Object.isFrozen(TENANT_B)).toBe(true);
    expect(Object.isFrozen(TENANT_A_NO_LOGO)).toBe(true);
    expect(Object.isFrozen(CONTAMINANTS)).toBe(true);
  });
});

describe('Phase 3 — underTenant() actually publishes what it is handed', () => {

  // Reads through the real production hook. A probe returning a constant would
  // satisfy the assertions below without the provider working at all — so the
  // last test renders this same component bare and requires it to THROW, which
  // is only possible if it genuinely reads context.
  function Probe() {
    const { branding, source } = useAdminBranding();
    return <span data-testid="probe">{`${branding.companyName}|${branding.logoUrl}|${source}`}</span>;
  }

  it('publishes tenant A, and the SAME wrapper publishes tenant B instead', () => {
    // Both halves in one test on purpose: "the wrapper works" and "the wrapper
    // is not pinned to whichever tenant was written first" are the same claim,
    // and the second is the one Phase 4's logo-swap guard rests on.
    const { unmount } = render(underTenant(TENANT_A, <Probe />));
    expect(screen.getByTestId('probe').textContent)
      .toBe(`${TENANT_A.companyName}|${TENANT_A.logoUrl}|session`);
    unmount();

    render(underTenant(TENANT_B, <Probe />));
    expect(screen.getByTestId('probe').textContent)
      .toBe(`${TENANT_B.companyName}|${TENANT_B.logoUrl}|session`);
    expect(screen.getByTestId('probe').textContent).not.toContain(TENANT_A.companyName);
  });

  it('the no-logo variant publishes a NULL logoUrl, not a string', () => {
    render(underTenant(TENANT_A_NO_LOGO, <Probe />));
    // 'null' here is React stringifying the null into text content — which is
    // precisely the shape that shipped a dead href in 3b. Phase 4 asserts on the
    // absence of the element; this only proves the null survives the provider.
    expect(screen.getByTestId('probe').textContent)
      .toBe(`${TENANT_A_NO_LOGO.companyName}|null|session`);
  });

  it('publishing is SUPPLIED mode — the D4 chain never runs', () => {
    // The panel resolves identity from the session, never from the URL, the
    // hostname or a stored hint (D-H). A fixture that fell through to the chain
    // would prove something about a path the admin panel does not take.
    const spy = vi.fn();
    global.fetch = spy;
    try {
      render(underTenant(TENANT_A, <Probe />));
      expect(screen.getByTestId('probe').textContent).toContain(TENANT_A.companyName);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      delete global.fetch;
    }
  });

  it('⚠ NON-VACUITY — the probe THROWS with no provider above it', () => {
    // Take this away and every assertion in this describe passes against a probe
    // that renders a constant. The throw is what proves the probe reads context.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<Probe />)).toThrow(/BrandingProvider/);
    } finally {
      spy.mockRestore();
    }
  });
});
