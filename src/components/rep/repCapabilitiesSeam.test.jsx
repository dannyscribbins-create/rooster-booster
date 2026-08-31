// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c — PHASE 2a — THE REP CAPABILITIES SEAM
//
// Governing: CDL_3c_PHASE0_REPORT.md §7, DECISION_C_DL_BUILD_SPEC.md §17 A24.4,
// and CLAUDE.md's vacuity shape #10 — which was recorded against THIS EXACT
// SURFACE before it was built.
//
// ── WHAT SHAPE #10 SAYS, AND WHY THIS FILE IS ARRANGED THE WAY IT IS ────────
//
// `AdminPermissionsContext` is created WITH A DEFAULT VALUE, and all eight of its
// consumers live in src/components/admin/. The rep surface renders at
// src/App.jsx:589, OUTSIDE AdminApp entirely. So a rep component calling
// usePermissions() would not throw — it would receive the default, where
// rep_revenue_visibility is undefined → falsy → revenue hidden.
//
// ⚠ A TEST THAT MOUNTS A REP COMPONENT WITH THE FLAG OFF AND ASSERTS "REVENUE IS
// NOT RENDERED" THEREFORE PASSES IDENTICALLY AGAINST COMPLETELY UNWIRED CODE.
// The behaviour fails safe, which is exactly why nobody looks: the gate is closed
// either way and only the REASON differs — and the reason is the whole property.
//
// THREE STRUCTURAL ANSWERS, all of them here:
//
//   1. THE PAIR MOUNTS <App />, NOT THE LEAF. Rendering RepSurface directly with
//      a provider the test supplies proves the component reads a context; it
//      proves NOTHING about whether App.jsx puts one above it. App's wiring is
//      the thing under test, so App is what gets rendered.
//
//   2. THE TWO CASES DIFFER IN EXACTLY ONE FIELD OF ONE RESPONSE —
//      /api/admin/me's rep_revenue_visibility, false vs true. Identical session
//      descriptor, identical everything else. Anything else that differs weakens
//      the inference from "this field travels" to "something differs somewhere".
//
//   3. THE FLAG-ON SIBLING ASSERTS THE VALUE ARRIVES. That is the assertion that
//      can fail against unwired code. Flag-off cannot, and never could.
//
// ── ⚠ AND THE FLAG-OFF CASE HAS ITS OWN VACUITY TRAP, ONE LEVEL DOWN ────────
// Before /api/admin/me resolves, the hook's EMPTY state reports every rep flag
// as null → the seam renders "false". So a flag-off case that simply asserts
// "false" PASSES ON THE FIRST FRAME, before the fetch has landed, against a
// context that is receiving nothing at all.
//
// So both cases wait on data-rep-field-rep="true" FIRST. That field is true in
// BOTH fixtures and false in EMPTY, which makes it an arrival marker rather than
// a value: it cannot go true until the /api/admin/me body has actually reached
// the component. Only then is the revenue flag read. This is CLAUDE.md's repair
// for shape #9 — observe the CONSEQUENCE, not the setup — applied to the
// precondition "the payload got here".
//
// ── ⚠ THE HONEST CAVEAT, WRITTEN AT THE SITE RATHER THAN ASSUMED ───────────
// THERE IS NO REVENUE VALUE TO RENDER IN 2a, OR IN PHASE 3. A24.4 sends 4B's
// revenue FIELD and 2B's revenue CARD to WAVE 1.6, because true job revenue is
// stored in no populated column and Job Revenue Capture is Wave 1.5. So
// flag-ON here asserts on a PROBE — the wiring seam RepSurface renders — and NOT
// on a revenue figure. That is the strongest honest assertion available today.
//
// ⚠ DO NOT READ THIS FILE AS COVERING CD-7. It covers the PIPE. The durable pair
// lands in Phase 3 against the locked-placeholder-vs-field distinction: with the
// flag off the server omits the key and the client draws the placeholder from
// its ABSENCE (A24.4), which is testable before the column is ever populated.
// When that pair exists, the probe assertions here may be replaced by it — and
// the three data-rep-* attributes on RepSurface deleted with them.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import App from '../../App';
import RepSurface from './RepSurface';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';

// The routed identity. IDENTICAL in both halves of the pair — a general-tier
// field rep is the one identity surfaceFor() sends to the rep surface.
const REP_SESSION = Object.freeze({
  role: 'team',
  contractorId: 'tnt-rep-caps',
  tier: 'general',
  is_field_rep: true,
  permissions: {},
});

// GET /api/admin/me's body. The ONLY thing that varies between the two cases is
// rep_revenue_visibility — every other field is pinned here so it cannot drift
// between the halves and quietly become a second variable.
function meBody(repRevenueVisibility) {
  return {
    email: 'rep@repcaps.test',
    full_name: 'Rae Rep',
    tier: 'general',
    permissions: {},
    title_id: 7,
    is_field_rep: true,
    is_attributable: true,
    rep_revenue_visibility: repRevenueVisibility,
  };
}

let calls;

// Answers everything App and the rep tree ask for on boot, and RECORDS every
// URL — item 5's measurement reads this array.
function installFetch(me) {
  calls = [];
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('/api/session')) {
      return { ok: true, status: 200, json: async () => REP_SESSION };
    }
    if (u.includes('/api/admin/me')) {
      return { ok: true, status: 200, json: async () => me };
    }
    // The theme provider's preference read and the D4 chain's branding lookup.
    // Neither is interesting here; both exist so the tree finishes rendering
    // without an unrelated rejection failing a wiring assertion.
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

const seam = () => document.querySelector('[data-rep-revenue-visible]');

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('C/DL-3c Phase 2a — the rep capabilities context reaches the rep tree', () => {

  it('[RED] flag OFF — the seam reports revenue hidden, AFTER the payload has arrived', async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(meBody(false));

    render(<App />);

    // ⚠ THE ARRIVAL MARKER FIRST. Without this the assertion below is satisfied
    // by the pre-fetch EMPTY state and proves nothing — see the header.
    //
    // ⚠ MEASURED, NOT ASSUMED (Phase 2a guard-proof). With the provider removed
    // from App.jsx AND a default put back on the context — completely unwired
    // code, the exact production shape — this test PASSES if BOTH the marker
    // above and the companion pin below are removed, and fails if EITHER is
    // present. That is vacuity shape #10 reproduced on purpose. Neither line is
    // decoration; they are two INDEPENDENT observers of the same precondition,
    // which is what stops this pair from being one guard wearing two hats.
    await waitFor(() => expect(seam()?.getAttribute('data-rep-field-rep')).toBe('true'));

    expect(seam().getAttribute('data-rep-revenue-visible')).toBe('false');
    // Pinned alongside, because a seam that reported every flag as the same value
    // would satisfy the pair above and be carrying nothing. It is also the second
    // observer named in the guard-proof note above: it differs from the revenue
    // flag in this fixture, so a defaulted-and-unprovided context fails it even
    // when the revenue assertion is satisfied vacuously.
    expect(seam().getAttribute('data-rep-attributable')).toBe('true');
  });

  it('[RED] flag ON — the seam reports revenue visible (the assertion that can fail unwired)', async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(meBody(true));

    render(<App />);

    await waitFor(() => expect(seam()?.getAttribute('data-rep-field-rep')).toBe('true'));

    expect(seam().getAttribute('data-rep-revenue-visible')).toBe('true');
  });

  it('[RED] the rep surface is still the rep surface — no admin panel, no referrer app', async () => {
    // The pair above would pass against a RepSurface that had quietly acquired
    // the wrong siblings. Cheap, and it keeps the seam anchored to the surface
    // roleRouting.test.jsx pins.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(meBody(true));

    render(<App />);

    await waitFor(() => expect(screen.queryByText(/field rep tools/i)).toBeTruthy());
    expect(screen.queryByText(/Missing Referrals/i)).toBeNull();
    expect(screen.queryByText(/Available Balance/i)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE THIRD CASE — AND IT IS WHAT MAKES THE TWO ABOVE MEAN ANYTHING
//
// ⚠ THE PAIR ABOVE PROVES A VALUE TRAVELS. THIS PROVES THERE IS NO DEFAULT FOR IT
// TO TRAVEL INSTEAD OF. Both are needed: a context created with a default would
// satisfy every assertion above on the day someone deleted the provider from
// App.jsx, because the hook would hand back the default and the seam would render
// "false" — which is what flag-off expects.
//
// This is the assertion that would have caught Wave 1.1-g's ThemeContext move
// before it reached production. ResetPinScreen was lifted above ThemeProvider,
// ThemeContext HAS a default, so it silently rendered NEUTRAL_BRANDING and the
// platform logo to a contractor's team member with nothing failing anywhere.
// Same class, same file position in the routing chain, same week.
//
// Modelled on src/components/admin/adminBrandingSeam.test.jsx's bare-probe block,
// which does this for useAdminBranding() (D-H) — deliberately, so the two
// throwing contexts in this codebase are fenced the same way and a reader who
// finds one finds the other.
// ─────────────────────────────────────────────────────────────────────────────
describe('C/DL-3c Phase 2a — the context has NO default', () => {

  it('[RED] useRepCapabilities() THROWS outside its provider', () => {
    // React logs the caught render error to console.error; that noise is expected
    // and is not what is being asserted.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<RepSurface onLogout={() => {}} />)).toThrow(/RepCapabilitiesContext|provider/i);
    } finally {
      spy.mockRestore();
    }
  });
});
