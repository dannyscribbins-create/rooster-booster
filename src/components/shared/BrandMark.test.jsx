// ─────────────────────────────────────────────────────────────────────────────
// BR-1 PHASE 2 — THE ABSENCE RULE, AT THE ONE PLACE THAT DECIDES IT
//
// Ruled by Danny 2026-09-02, three prongs BY CONTEXT:
//
//   A1  NO CONTRACTOR RESOLVED  → the RoofMiles mark. Correct: bare
//                                 app.roofmiles.com with no session and no hint
//                                 IS the platform's own door.
//   A2  CONTRACTOR RESOLVED, NO LOGO → the COMPANY NAME AS TEXT. Never the
//                                 RoofMiles mark.
//   A3  EMAILS → same rule, same reason (tested server-side).
//
// ⚠ A2's REASONING, PINNED HERE SO NOBODY "SIMPLIFIES" IT BACK. Putting the
// PLATFORM's mark on a CONTRACTOR's surface is itself a white-label breach. A
// homeowner who sees RoofMiles inside their roofer's app has been told they are
// in the wrong company's product — which is worse than seeing no mark at all.
// That is why A1 and A2 are different answers to what looks like one question,
// and why this is a BRANCH rather than the `logoUrl || roofMilesLogo` swap that
// six screens carried before it.
//
// ⚠ WHY A COMPONENT AND NOT SIX EDITS (A.4). The rule was written six times as
// `branding?.logoUrl || roofMilesLogo` and had already drifted into THREE
// mutually inconsistent behaviours across the codebase. Six branches would drift
// the same way. The extraction is itself the risky change, so the primitive is
// tested directly here rather than only through its callers.
//
// ── HOW "NO CONTRACTOR RESOLVED" IS KNOWN ───────────────────────────────────
// From `source`, which ThemeContext already carries: the D4 chain reports which
// link answered. 'neutral' means every source declined. It is NOT inferred from
// the branding values — a contractor who has customised nothing resolves to a
// payload equal to the platform defaults, and inferring from values would show
// them the platform's mark, which is exactly the breach A2 forbids.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen } from '@testing-library/react';
import { ThemeContext } from './ThemeProvider';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import roofMilesLogo from '../../assets/images/roofmiles_logo_png.png';
import BrandMark from './BrandMark';

const CONTRACTOR = Object.freeze(resolveBrandingTheme({
  contractor_name: 'Delta Roofing Co',
  logo_url: 'https://cdn.test.invalid/delta-logo.png',
}));

// ⚠ THE SAME CONTRACTOR WITH NO LOGO — same name, so "which branch ran" is
// decided by the logo alone and not by two fixtures differing in two ways.
const CONTRACTOR_NO_LOGO = Object.freeze(resolveBrandingTheme({
  contractor_name: 'Delta Roofing Co',
}));

const NEUTRAL = Object.freeze(resolveBrandingTheme(null));

// ⚠ THROWS ON AN UNEXPECTED SHAPE RATHER THAN RETURNING SOMETHING PLAUSIBLE —
// the lesson from BR-1 Phase 1-B, where a double that returned a bare theme
// instead of the `{branding, slug}` envelope read as "no answer" and made
// absence assertions pass for the wrong reason. `source` is the discriminator
// this whole file turns on, so a fixture that omits it must fail loudly.
function mount(branding, source, props = {}) {
  if (source === undefined) {
    throw new Error(
      'mount(): `source` is required. It is what separates A1 from A2, and a ' +
      'fixture that leaves it undefined would silently exercise the not-yet-' +
      'resolved path while appearing to test a resolved contractor.'
    );
  }
  return render(
    <ThemeContext.Provider value={{ mode: 'light', branding, source, setMode: () => {} }}>
      <BrandMark {...props} />
    </ThemeContext.Provider>
  );
}

const platformMark = () => document.querySelector(`img[src="${roofMilesLogo}"]`);
const anyImage = () => document.querySelector('img');

describe('BrandMark — A1: no contractor resolved', () => {

  it('[RED] T1 — renders the RoofMiles mark when the chain answered neutral', () => {
    mount(NEUTRAL, 'neutral');

    expect(platformMark(), 'the platform door must carry the platform mark').toBeTruthy();
    expect(platformMark().getAttribute('alt')).toBe(NEUTRAL.companyName);
  });

  it('[RED] T1 — renders the RoofMiles mark while resolution is still in flight', () => {
    // `source` is null for the first frame, before the chain answers. The
    // branding is neutral in that frame, so this is A1's case and not A2's —
    // and rendering a company name here would print "RoofMiles" as text, which
    // is the one thing A2 exists to prevent.
    mount(NEUTRAL, null);

    expect(platformMark()).toBeTruthy();
  });
});

describe('BrandMark — A2: a contractor IS resolved', () => {

  it('[RED] T3 — renders the contractor\'s logo when one is set', () => {
    mount(CONTRACTOR, 'session');

    const img = anyImage();
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(CONTRACTOR.logoUrl);
    expect(img.getAttribute('alt')).toBe('Delta Roofing Co');
    // NON-VACUITY: it is the CONTRACTOR's mark, not the platform's.
    expect(platformMark()).toBeNull();
  });

  it('[RED] T2 — renders the COMPANY NAME AS TEXT when no logo is set', () => {
    // ⚠ BOTH DIRECTIONS ARE ASSERTED, AND THE PROMPT NAMES WHY. A component that
    // rendered NOTHING would satisfy "the platform mark is absent" while failing
    // the rule completely — an absence assertion alone cannot tell "the right
    // thing rendered" from "nothing did".
    mount(CONTRACTOR_NO_LOGO, 'session');

    // POSITIVE: the contractor is named.
    expect(screen.getByText('Delta Roofing Co')).toBeTruthy();
    // NEGATIVE: the platform's mark does not appear.
    expect(platformMark(), 'the RoofMiles mark must NEVER appear on a resolved contractor\'s surface').toBeNull();
    // AND NO IMAGE AT ALL — a broken <img src=""> would also satisfy the line above.
    expect(anyImage()).toBeNull();
  });

  it('[RED] T2 — the fixture genuinely has no logo, so the branch under test is reachable', () => {
    // NON-VACUITY FOR THE TEST ABOVE, as an assertion rather than as a comment.
    // If this fixture ever gained a logo, the A2 test would pass by rendering the
    // image and never touch the name branch at all.
    expect(CONTRACTOR_NO_LOGO.logoUrl).toBeNull();
    expect(CONTRACTOR.logoUrl).toBeTruthy();
  });

  it('[RED] T2 — a resolved contractor whose branding EQUALS the platform defaults still gets text', () => {
    // ⚠ THE CASE THAT RULES OUT INFERRING FROM VALUES. `isNeutralBranding` reads
    // a payload identical to the defaults as "no contractor identified" — a
    // documented false negative. If BrandMark inferred from the branding object
    // instead of from `source`, a contractor who has customised nothing would be
    // shown the PLATFORM'S MARK on their own surface. That is A2's breach, and
    // it would arrive silently, for the contractors least likely to notice.
    mount(NEUTRAL, 'session');

    expect(platformMark(), 'a resolved contractor must never get the platform mark, however plain their branding').toBeNull();
    expect(screen.getByText(NEUTRAL.companyName)).toBeTruthy();
  });

  it('[RED] every non-neutral source counts as resolved, not just the session', () => {
    // The chain has four answering links besides neutral. A branch written as
    // `source === 'session'` would regress the logged-out login screen that
    // BR-1 Phase 1-B restored, where the answering source is 'stored'.
    for (const source of ['session', 'host', 'url', 'stored']) {
      const { unmount } = mount(CONTRACTOR_NO_LOGO, source);
      expect(platformMark(), `source '${source}' was treated as unresolved`).toBeNull();
      expect(screen.getByText('Delta Roofing Co')).toBeTruthy();
      unmount();
    }
  });
});
