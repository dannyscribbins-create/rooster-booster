// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BRAND RETIREMENT — PHASE 4 — THE PANEL RENDERS ITS OWN CONTRACTOR
//
// Governing spec: ADMIN_BRAND_RETIREMENT_BUILD_SPEC.md §1 (the design rules),
// D-D (the sidebar lockup), D-I (no wrong frame).
//
// ⚠ THE SWEEP IS NOT THIS FILE'S JOB. adminBranding.test.jsx proves no Accent
// literal survives in the source. Proving that twice would be worth nothing.
// What a source sweep structurally CANNOT answer is the question here:
//
//        DOES THE PANEL RENDER **THIS** CONTRACTOR, AND ONLY THIS ONE?
//
// A component with every literal removed and no wiring at all passes the sweep
// perfectly. So does one hardcoded to whichever tenant the test author typed
// first. Both are caught below, by the two-tenant fixture Phase 3 built.
//
// ── THE FOUR SHAPES THIS FILE EXISTS TO CATCH ──────────────────────────────
//   1. HARDCODED TO ONE TENANT — caught by rendering A then B and requiring the
//      value to CHANGE. "A logo renders" passes against a hardcoded logo.
//   2. A DEFAULT WHERE THERE MUST BE NONE — caught by TENANT_A_NO_LOGO. An
//      identity-bearing value that is absent must draw NOTHING, not a fallback
//      and not a dead target. This is 3b's fifth vacuity instance, the only one
//      that reached production.
//   3. CROSS-TENANT LEAK — caught by sweeping the fixture's CONTAMINANTS, every
//      value only tenant B holds, against output rendered under tenant A.
//   4. THE WRONG FRAME — caught by rendering with branding still in flight and
//      requiring the chrome to paint with NO contractor lockup (D-I).
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from '@testing-library/react';
import BrandingProvider from '../shared/BrandingProvider';
import { AdminSidebar } from './AdminComponents';
import AdminSettingsNotifications from './AdminSettingsNotifications';
import AdminDashboard from './AdminDashboard';
import AdminSettings from './AdminSettings';
import { platformIdentityLine, PLATFORM_NAME } from '../../utils/platformIdentity';
import {
  TENANT_A, TENANT_B, TENANT_A_NO_LOGO, NEUTRAL, CONTAMINANTS, underTenant,
} from './__fixtures__/twoTenantBranding';

const sidebar = () => (
  <AdminSidebar page="dashboard" setPage={() => {}} pendingCount={0}
    flaggedUnresolved={0} pendingReferralCount={0} onLogout={() => {}} />
);

/**
 * Finds the lockup's divider rule in rendered output.
 *
 * ⚠ SELECTED BY ITS DRAWN GEOMETRY, because no production component in this repo
 * carries a data-testid and this phase is not the place to start. The risk that
 * creates is a selector that silently stops matching — after which "no divider"
 * would pass forever against a divider that is right there on screen.
 *
 * THAT RISK IS CLOSED BY PAIRING, NOT BY THE SELECTOR: every absence assertion
 * below has a presence assertion beside it using this same helper, so a broken
 * selector fails the presence half immediately and loudly.
 *
 * @param {HTMLElement} container - render()'s container.
 * @returns {HTMLElement[]} every element drawn as a 1px vertical rule.
 */
function dividers(container) {
  return Array.from(container.querySelectorAll('div'))
    .filter(d => d.style.width === '1px' && d.style.height === '28px');
}

/** Every image src currently in the document — the leak surface for a logo. */
const imgSrcs = () => Array.from(document.querySelectorAll('img')).map(i => i.getAttribute('src'));

/**
 * Asserts no value belonging ONLY to tenant B appears anywhere in the output.
 *
 * Checks text AND image srcs: a logo leak travels through an attribute, never
 * through textContent, so a text-only sweep would miss the single most visible
 * form of the breach.
 */
function expectNoContamination(where) {
  const text = document.body.textContent;
  const srcs = imgSrcs().join(' ');
  for (const value of CONTAMINANTS) {
    expect(text, `${where}: tenant B's ${JSON.stringify(value)} appeared in the text`)
      .not.toContain(value);
    expect(srcs, `${where}: tenant B's ${JSON.stringify(value)} appeared in an image src`)
      .not.toContain(value);
  }
}

// ═══ 2a / 2b / 2d / 2e — THE SIDEBAR LOCKUP (D-D) ═══════════════════════════
describe('Phase 4 — the sidebar lockup carries THIS contractor (D-D)', () => {

  it('[RED] renders tenant A\'s logo — and the SAME component renders tenant B\'s instead', () => {
    // ⚠ THE SWAP IS THE TEST. Asserting "a logo renders" passes against a
    // hardcoded one, which is the exact bug this session exists to close.
    const a = render(underTenant(TENANT_A, sidebar()));
    const logoA = screen.getByAltText(TENANT_A.companyName);
    expect(logoA.getAttribute('src')).toBe(TENANT_A.logoUrl);
    a.unmount();

    const b = render(underTenant(TENANT_B, sidebar()));
    const logoB = screen.getByAltText(TENANT_B.companyName);
    expect(logoB.getAttribute('src')).toBe(TENANT_B.logoUrl);

    // The claim, stated as itself rather than implied by the two reads above.
    expect(logoB.getAttribute('src')).not.toBe(logoA.getAttribute('src'));
    b.unmount();
  });

  it('[RED] the divider is DRAWN when there is a contractor logo beside it', () => {
    // The presence half of the pair. Without this, the absence assertion in the
    // next test could pass against a selector that matches nothing at all.
    const { container } = render(underTenant(TENANT_A, sidebar()));
    expect(dividers(container).length,
      'no divider found beside the contractor logo — if the lockup renders one, ' +
      'the dividers() selector has drifted and every absence test below is vacuous.'
    ).toBe(1);
  });

  it('[RED] ⚠ NO LOGO → NO <img> AND NO DIVIDER. Not a fallback, not a dead src', () => {
    // THE PRIMARY CASE, not the edge case. logoUrl is deliberately allowed to be
    // null; identity-bearing values get no defaults, and the consumer decides
    // whether to draw the element. A fallback here would either borrow another
    // contractor's mark or render src="null" against the app's own origin —
    // which is precisely what shipped in 3b.
    const { container } = render(underTenant(TENANT_A_NO_LOGO, sidebar()));

    expect(screen.queryByAltText(TENANT_A.companyName)).toBeNull();
    expect(imgSrcs().some(s => s === 'null' || s === '' || s === null),
      'an <img> was drawn with an empty or stringified-null src').toBe(false);

    // THE DIVIDER GOES WITH IT — a separator with nothing on one side is a stray
    // line. AnnouncementPopup states this rule; the lockup inherits it.
    expect(dividers(container).length,
      'the divider survived without a logo beside it — a rule floating in space.'
    ).toBe(0);

    // NON-VACUITY: the platform mark must still be there, or "no contractor
    // logo" would be passing because the whole lockup failed to render.
    expect(screen.getByAltText(/rooster booster|roofmiles/i)).toBeTruthy();
  });

  it('[RED] under tenant A, NOTHING belonging to tenant B appears', () => {
    render(underTenant(TENANT_A, sidebar()));
    expectNoContamination('sidebar under tenant A');
  });

  it('[RED] D-I — branding IN FLIGHT paints the chrome with NO contractor lockup', () => {
    // `supplied={null}` is the in-flight state: supplied mode, answer not yet
    // arrived. BrandingProvider is used directly rather than through the
    // fixture's underTenant() because the fixture takes a resolved brand and
    // this test is specifically about there not being one yet.
    //
    // D-I: the panel paints AT ONCE with placeholder identity and the contractor
    // joins the repaint /api/admin/me already causes. Never someone else's logo,
    // and never a spinner in front of every admin to save a repaint for some.
    const { container } = render(
      <BrandingProvider supplied={null}>{sidebar()}</BrandingProvider>
    );

    // The chrome is there — this is the "no wrong frame", not "no frame".
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByAltText(/rooster booster|roofmiles/i)).toBeTruthy();

    // …and no contractor is claimed yet.
    expect(dividers(container).length).toBe(0);
    expect(screen.queryByAltText(TENANT_A.companyName)).toBeNull();
    expect(screen.queryByAltText(TENANT_B.companyName)).toBeNull();
    expectNoContamination('sidebar with branding in flight');
  });

  it('[RED] a neutral brand names no contractor — absent lockup is a DESIGNED state', () => {
    // NEUTRAL is a complete, valid theme with no contractor in it (logoUrl null).
    // It must look like "the RoofMiles panel", not like a broken one.
    const { container } = render(underTenant(NEUTRAL, sidebar()));
    expect(dividers(container).length).toBe(0);
    expect(screen.getByAltText(/rooster booster|roofmiles/i)).toBeTruthy();
  });
});

// ═══ 2c — THE preset_2 [Company] SUBSTITUTION ═══════════════════════════════
describe('Phase 4 — preset_2 renders the contractor, not the token', () => {

  // Answers everything the settings page asks for on mount. Only
  // announcement-settings is interesting; the rest exist so the tree finishes.
  function installFetch(mode) {
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/admin/announcement-settings')) {
        return { ok: true, status: 200, json: async () => ({ enabled: true, mode, custom_message: '' }) };
      }
      if (u.includes('/api/admin/engagement-cadence')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
  }

  afterEach(() => { delete global.fetch; });

  it('[RED] the LIVE PREVIEW shows the contractor name, never the literal [Company]', async () => {
    // ⚠ ASSERTED ON RENDERED OUTPUT, NEVER ON THE CONSTANT. The template string
    // is byte-identical in every copy of it, so a constant-level assertion
    // cannot see a missing .replace() — it would pass today, against the bug.
    installFetch('preset_2');
    render(underTenant(TENANT_A, <AdminSettingsNotifications />));

    // The preview is located BY the substituted name, so finding it at all is
    // the assertion. Located this way rather than by a body-wide search because
    // the Message-style chooser above it deliberately displays the RAW template
    // — [Amount] and [Referred Name] included — and a body-level check for the
    // absence of '[Company]' would be asserting against that chooser instead.
    const preview = await waitFor(() =>
      screen.getByText(content => content.includes(`part of the ${TENANT_A.companyName} family`)));

    expect(preview.textContent).toContain(TENANT_A.companyName);
    expect(preview.textContent,
      'the live preview still shows the raw [Company] token — the substitution ' +
      'the referrer already gets was never wired into the preview whose entire ' +
      'purpose is to show what the referrer sees.'
    ).not.toContain('[Company]');
  });

  it('[RED] the same preview under tenant B shows B — so it is read, not hardcoded', async () => {
    installFetch('preset_2');
    render(underTenant(TENANT_B, <AdminSettingsNotifications />));

    const preview = await waitFor(() =>
      screen.getByText(content => content.includes(`part of the ${TENANT_B.companyName} family`)));
    expect(preview.textContent).not.toContain(TENANT_A.companyName);
  });

  it('[RED] preset_1 has no [Company] token and is unaffected', async () => {
    // A guard against a substitution that "works" by rewriting every template.
    //
    // ⚠ MATCHED ON A SUBSTITUTED VALUE ('$500'), NOT ON THE SHARED SENTENCE.
    // preset_1's trailing clause is byte-identical in the raw template the
    // Message-style chooser displays and in the resolved preview, so matching on
    // it found TWO elements and the test errored rather than asserting. The
    // amount is the only part that differs — the chooser shows '$[Amount]'.
    installFetch('preset_1');
    render(underTenant(TENANT_A, <AdminSettingsNotifications />));
    const preview = await waitFor(() => screen.getByText(content =>
      content.includes('We appreciate you so much') && content.includes('$500')));
    expect(preview.textContent).toContain('Sample Client');
  });

  it('[RED] the settings page renders under tenant A with no trace of tenant B', async () => {
    installFetch('preset_2');
    render(underTenant(TENANT_A, <AdminSettingsNotifications />));
    await waitFor(() =>
      screen.getByText(content => content.includes(`part of the ${TENANT_A.companyName} family`)));
    expectNoContamination('AdminSettingsNotifications under tenant A');
  });
});

// ═══ THE IDENTITY LINE — "RoofMiles · Acme Roofing" ═════════════════════════
//
// AdminDashboard's page header and AdminSettings' section header both carried
// the literal "Rooster Booster · Accent Roofing". They are the panel's two most
// -viewed strings and were on NO inventory list — the finding that produced the
// walking sweep.
//
// ⚠ EACH GETS A RENDER TEST BECAUSE EACH NOW CALLS useAdminBranding(), WHICH
// THROWS. Both were previously renderable anywhere; a caller that mounts either
// outside BrandingProvider now crashes the panel. That is the intended contract
// (D-H: broken wiring must not look like an unbranded contractor), but it means
// "does this component still render at all" is a live question for both — which
// is precisely the AnnouncementPopup ReferenceError shape.
describe('Phase 4 — the identity line names the platform AND the contractor', () => {

  // ⚠ THE STATS PAYLOAD IS SHAPED, NOT `{}`. AdminDashboard calls
  // `stats.totalBalance.toLocaleString()` with no guard, so a blanket empty-object
  // mock let the header assertion pass and THEN threw inside React's render —
  // surfacing as a Vitest UNHANDLED ERROR, which reports "418 passed" while
  // exiting NON-ZERO and failing `npm test`, the pre-push gate. A test that
  // leaves the component mid-crash is not testing the component that ships.
  const STATS = Object.freeze({
    activeReferrers: 0, totalReferrers: 0, totalBalance: 0, totalPaidOut: 0,
    totalReferrals: 0, totalLeads: 0, totalInspections: 0, totalSold: 0,
    totalNotSold: 0, pendingCashouts: 0,
  });

  function installFetch() {
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/admin/stats')) {
        return { ok: true, status: 200, json: async () => STATS };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
  }
  afterEach(() => { delete global.fetch; });

  it('platformIdentityLine joins the platform and the contractor', () => {
    expect(platformIdentityLine(TENANT_A)).toBe(`${PLATFORM_NAME} · ${TENANT_A.companyName}`);
    expect(platformIdentityLine(TENANT_B)).toBe(`${PLATFORM_NAME} · ${TENANT_B.companyName}`);
  });

  it('⚠ it never renders the platform name TWICE', () => {
    // The suppression rule, and the only genuinely non-obvious line in the
    // helper. NEUTRAL.companyName IS the platform name, so a naive join would
    // print "RoofMiles · RoofMiles" on every panel until /api/admin/me lands —
    // on literally every admin's first frame.
    expect(platformIdentityLine(NEUTRAL)).toBe(PLATFORM_NAME);
    expect(platformIdentityLine(null)).toBe(PLATFORM_NAME);
    expect(platformIdentityLine({})).toBe(PLATFORM_NAME);
    expect(platformIdentityLine({ companyName: '' })).toBe(PLATFORM_NAME);
  });

  it('the platform name is READ from the branding defaults, not typed here', () => {
    // Non-vacuity for every assertion above: if PLATFORM_NAME were undefined or
    // empty they would all still agree with each other and prove nothing.
    expect(typeof PLATFORM_NAME).toBe('string');
    expect(PLATFORM_NAME.length).toBeGreaterThan(0);
    expect(PLATFORM_NAME).toBe(NEUTRAL.companyName);
  });

  it('[RENDER] AdminDashboard shows the line, and it CHANGES between tenants', async () => {
    installFetch();
    const a = render(underTenant(TENANT_A, <AdminDashboard setLoggedIn={() => {}} setPage={() => {}} />));
    await waitFor(() => expect(screen.getByText(`${PLATFORM_NAME} · ${TENANT_A.companyName}`)).toBeTruthy());
    expectNoContamination('AdminDashboard under tenant A');
    a.unmount();

    render(underTenant(TENANT_B, <AdminDashboard setLoggedIn={() => {}} setPage={() => {}} />));
    await waitFor(() => expect(screen.getByText(`${PLATFORM_NAME} · ${TENANT_B.companyName}`)).toBeTruthy());
    expect(screen.queryByText(`${PLATFORM_NAME} · ${TENANT_A.companyName}`)).toBeNull();
  });

  it('[RENDER] AdminSettings shows the line, and it CHANGES between tenants', async () => {
    installFetch();
    const a = render(underTenant(TENANT_A, <AdminSettings />));
    await waitFor(() => expect(screen.getByText(`${PLATFORM_NAME} · ${TENANT_A.companyName}`)).toBeTruthy());
    expectNoContamination('AdminSettings under tenant A');
    a.unmount();

    render(underTenant(TENANT_B, <AdminSettings />));
    await waitFor(() => expect(screen.getByText(`${PLATFORM_NAME} · ${TENANT_B.companyName}`)).toBeTruthy());
  });

  it('[RENDER] both paint the platform alone while branding is in flight (D-I)', async () => {
    // The wrong-frame guard for the headers, matching the sidebar's. What an
    // admin sees on frame 1 is "RoofMiles", never a doubled name and never
    // somebody else's.
    installFetch();
    render(<BrandingProvider supplied={null}><AdminDashboard setLoggedIn={() => {}} setPage={() => {}} /></BrandingProvider>);
    await waitFor(() => expect(screen.getByText(PLATFORM_NAME)).toBeTruthy());
    expect(screen.queryByText(new RegExp(`${PLATFORM_NAME} · ${PLATFORM_NAME}`))).toBeNull();
    expect(screen.queryByText(`${PLATFORM_NAME} · ${TENANT_A.companyName}`)).toBeNull();
  });
});
