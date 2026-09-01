// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c — PHASE 2b — THE SURFACE SWITCHER
//
// C/DL-3b's routing rule was written to be RELAXED, NOT REVERSED. This is the
// relaxation: a team member who is also a field rep GAINS a second destination
// rather than having their first one taken away.
//
// ⚠ THE MECHANICAL PROOF THAT IT IS A RELAXATION LIVES IN roleRouting.test.jsx,
// NOT HERE, AND IT WAS TAKEN BEFORE THIS FILE EXISTED. surfaceFor() gained its
// second parameter with `chosen` null at every call site, and all twelve cases
// there — including the two GUARDs against the rejected rules ("tier decides",
// "is_field_rep decides") — passed UNTOUCHED. A rule that had been reversed
// could not have done that. This file covers what the new parameter adds.
//
// ── ⚠ WHY EVERY CASE ASSERTS THE FALLBACK AND NOT JUST THE SWITCH ──────────
// A switcher that routes is easy. A switcher that STOPS routing when the person
// stops qualifying is the part that strands someone if it is wrong, and it
// cannot be observed by driving the happy path. Each direction below therefore
// has a revocation sibling on the same fixture.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import App, { surfaceFor, canSwitchSurface } from '../../App';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';
import { ADMIN_STATS_ZEROS, FLAGGED_SUMMARY_ZERO } from '../../__fixtures__/adminStats';

const adminPanel = () => screen.queryByText(/Missing Referrals/i);
// ⚠ STRUCTURAL HANDLE, NOT COPY (C/DL-3c Phase 3-A). Was
// queryByText(/field rep tools/i), a string owned by the deleted
// RepPlaceholder. See roleRouting.test.jsx, which anchors the same way.
const repSurface = () => document.querySelector('[data-rep-shell]');
const emptyState = () => screen.queryByText(/has not given you access to any sections/i);
const switchToRep   = () => document.querySelector('[data-surface-switcher="rep"]');
const switchToAdmin = () => document.querySelector('[data-surface-switcher="admin"]');

const TEAM = (tier, isFieldRep) => ({
  role: 'team', contractorId: 'tnt-switch', tier, is_field_rep: isFieldRep, permissions: {},
});

// `session` is mutable so a case can revoke the rep flag between boots on the
// SAME fixture object — see the revocation cases.
let current;

function installFetch({ tier, isFieldRep, permissions }) {
  current = { session: TEAM(tier, isFieldRep), permissions };
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/session')) {
      return { ok: true, status: 200, json: async () => current.session };
    }
    if (u.includes('/api/admin/me')) {
      return { ok: true, status: 200, json: async () => ({
        email: 'x@switch.test', full_name: 'Switcher', tier: current.session.tier,
        permissions: current.permissions, title_id: null,
        is_field_rep: current.session.is_field_rep,
        is_attributable: false, rep_revenue_visibility: false,
      }) };
    }
    if (u.includes('/api/admin/stats')) return { ok: true, status: 200, json: async () => ADMIN_STATS_ZEROS };
    if (u.includes('/api/admin/flagged-referrals/summary')) return { ok: true, status: 200, json: async () => FLAGGED_SUMMARY_ZERO };
    if (u.includes('/api/admin/cashouts') || u.includes('/api/admin/missing-referrals')) {
      return { ok: true, status: 200, json: async () => [] };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
});

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('C/DL-3c Phase 2b — who is offered a switcher', () => {

  it('[RED] an OWNER-REP is offered one on the admin panel', async () => {
    installFetch({ tier: 'owner', isFieldRep: true, permissions: {} });
    render(<App />);
    await waitFor(() => expect(adminPanel()).toBeTruthy());
    expect(switchToRep()).toBeTruthy();
  });

  it('[RED] GUARD — a NON-rep owner is offered NOTHING', async () => {
    // The eligibility predicate's negative. Without it, "the owner-rep sees a
    // switcher" is satisfied by a control rendered for everybody.
    installFetch({ tier: 'owner', isFieldRep: false, permissions: {} });
    render(<App />);
    await waitFor(() => expect(adminPanel()).toBeTruthy());
    expect(switchToRep()).toBeNull();
    expect(switchToAdmin()).toBeNull();
  });

  it('[RED] a GENERAL-tier rep is offered one on the rep surface', async () => {
    installFetch({ tier: 'general', isFieldRep: true, permissions: {} });
    render(<App />);
    await waitFor(() => expect(repSurface()).toBeTruthy());
    expect(switchToAdmin()).toBeTruthy();
  });

  it('[RED] an ADMIN-REP WITH NO PERMISSIONS is offered one INSIDE the empty state', async () => {
    // ⚠ THE CASE THE TWO RULINGS MEET IN, AND THE ONE THAT MOTIVATED BOTH.
    // This is the dead end 1c found live: routed to the panel, refused
    // everywhere. Ruling A(i) replaces the eleven scrims with an honest message;
    // the switcher inside it is what turns "here is why you see nothing" into a
    // way out. A switcher rendered only in the sidebar would be invisible here,
    // because there is no sidebar — which is exactly how the escape hatch would
    // have ended up behind the wall it escapes.
    installFetch({ tier: 'admin', isFieldRep: true, permissions: {} });
    render(<App />);
    await waitFor(() => expect(emptyState()).toBeTruthy());
    expect(adminPanel()).toBeNull();
    expect(switchToRep()).toBeTruthy();
  });
});

describe('C/DL-3c Phase 2b — the switch itself, and the fallback', () => {

  it('[RED] an owner-rep pressing it lands on the rep surface, panel gone', async () => {
    installFetch({ tier: 'owner', isFieldRep: true, permissions: { dashboard: true } });
    render(<App />);
    await waitFor(() => expect(adminPanel()).toBeTruthy());

    fireEvent.click(switchToRep());

    await waitFor(() => expect(repSurface()).toBeTruthy());
    expect(adminPanel()).toBeNull();
    // The return leg exists — a one-way door is the defect the whole routing
    // rule was shaped around.
    expect(switchToAdmin()).toBeTruthy();
  });

  it('[RED] and pressing it again returns them to the panel', async () => {
    installFetch({ tier: 'owner', isFieldRep: true, permissions: { dashboard: true } });
    render(<App />);
    await waitFor(() => expect(adminPanel()).toBeTruthy());

    fireEvent.click(switchToRep());
    await waitFor(() => expect(repSurface()).toBeTruthy());

    fireEvent.click(switchToAdmin());
    await waitFor(() => expect(adminPanel()).toBeTruthy());
    expect(repSurface()).toBeNull();
  });

  it('[RED] a DEMOTED member reboots onto their identity surface, and is offered nothing', async () => {
    // ⚠ THIS CASE WAS CALLED "REVOCATION" AND CLAIMED TO PROVE THE ELIGIBILITY
    // RE-CHECK INSIDE surfaceFor(). IT DID NOT, AND A GUARD-PROOF IS WHAT FOUND
    // THAT OUT: deleting the re-check left it GREEN.
    //
    // The reason is worth keeping. It renders a SECOND <App />, and a fresh mount
    // starts with chosenSurface === null — so it routed by identity whether or
    // not the re-check existed. It was re-testing "not persisted" under a name
    // that promised something else, which is worse than not testing it: the name
    // occupied the space where real coverage would have gone.
    //
    // Renamed to what it actually proves, which IS worth proving — a demoted
    // member's next boot puts them where their identity says, and takes the
    // control away. The re-check itself is pinned by a direct unit case below,
    // because an integration test cannot reach a state the architecture cannot
    // produce.
    installFetch({ tier: 'owner', isFieldRep: true, permissions: { dashboard: true } });
    const first = render(<App />);
    await waitFor(() => expect(adminPanel()).toBeTruthy());
    fireEvent.click(switchToRep());
    await waitFor(() => expect(repSurface()).toBeTruthy());
    first.unmount();

    current.session = TEAM('owner', false);
    render(<App />);

    await waitFor(() => expect(adminPanel()).toBeTruthy());
    expect(repSurface()).toBeNull();
    expect(switchToRep(), 'a demoted member must not still be offered the control').toBeNull();
  });

  it('[RED] NOT PERSISTED — a fresh boot returns to the identity surface', async () => {
    // Ruled: no persistence. Recorded as a TEST rather than only as a comment,
    // because "we decided not to" is indistinguishable from "we forgot" six
    // months later — and because not persisting is what makes the switcher
    // incapable of creating a one-way door.
    installFetch({ tier: 'owner', isFieldRep: true, permissions: { dashboard: true } });
    const first = render(<App />);
    await waitFor(() => expect(adminPanel()).toBeTruthy());
    fireEvent.click(switchToRep());
    await waitFor(() => expect(repSurface()).toBeTruthy());
    first.unmount();

    expect(sessionStorage.length, 'the choice must not be written to sessionStorage').toBe(0);

    render(<App />);
    await waitFor(() => expect(adminPanel()).toBeTruthy());
    expect(repSurface()).toBeNull();
  });
});

// ═══ THE ROUTING RULE ITSELF, AS A PURE FUNCTION ═════════════════════════════
//
// ⚠ THESE EXIST BECAUSE AN INTEGRATION TEST COULD NOT REACH THE BRANCH THEY
// COVER. `session` is written once per mount and never refreshed, and `chosen`
// is only settable via a control drawn only when eligibility already holds — so
// "chosen is set AND the person does not qualify" is unreachable through <App />.
// A case that appeared to cover it was passing for an unrelated reason.
//
// The branch stays in the code as defence in depth against the day anything
// refreshes the session mid-mount. Defence in depth that nothing exercises is a
// claim rather than a mechanism, so it is exercised HERE, directly.
describe('C/DL-3c Phase 2b — surfaceFor(), directly', () => {

  const OWNER_REP   = { role: 'team', tier: 'owner',   is_field_rep: true };
  const OWNER_PLAIN = { role: 'team', tier: 'owner',   is_field_rep: false };
  const GEN_REP     = { role: 'team', tier: 'general', is_field_rep: true };
  const GEN_PLAIN   = { role: 'team', tier: 'general', is_field_rep: false };

  it('[RED] chosen = null reproduces the pre-2b rule exactly', () => {
    // The four rows of C/DL-3b's table, unchanged. This is the same property the
    // two GUARDs in roleRouting.test.jsx assert through the DOM; asserting it on
    // the function too is cheap and localises a break.
    expect(surfaceFor(GEN_REP, null)).toBe('rep');
    expect(surfaceFor(GEN_PLAIN, null)).toBe('admin');
    expect(surfaceFor(OWNER_REP, null)).toBe('admin');
    expect(surfaceFor({ role: 'team', tier: 'admin', is_field_rep: true }, null)).toBe('admin');
    expect(surfaceFor(null, null)).toBe('login');
    expect(surfaceFor({ role: 'referrer' }, null)).toBe('referrer');
  });

  it('[RED] an ELIGIBLE session honours chosen, in both directions', () => {
    expect(surfaceFor(OWNER_REP, 'rep')).toBe('rep');
    expect(surfaceFor(GEN_REP, 'admin')).toBe('admin');
  });

  it('[RED] THE DEFENCE-IN-DEPTH BRANCH — an INELIGIBLE session ignores chosen', () => {
    // ⚠ THE CASE THE GUARD-PROOF DEMANDED. Deleting the canSwitchSurface() term
    // from surfaceFor() makes exactly this fail, and nothing else in the suite.
    expect(surfaceFor(OWNER_PLAIN, 'rep'), 'a non-rep must never be routed to the rep surface').toBe('admin');
    expect(surfaceFor(GEN_PLAIN, 'rep'), 'office staff must never be routed to the rep surface').toBe('admin');
  });

  it('[RED] a REFERRER is never routed by chosen, at any value', () => {
    // The rep rule is code a referrer never reaches — the referrer branch returns
    // first. Pinned because widening the rule below it must stay incapable of
    // leaking the rep surface to a homeowner.
    for (const chosen of ['rep', 'admin', 'login', 'referrer']) {
      expect(surfaceFor({ role: 'referrer' }, chosen)).toBe('referrer');
    }
  });

  it('[RED] an unknown chosen value falls back rather than routing nowhere', () => {
    expect(surfaceFor(OWNER_REP, 'nonsense')).toBe('admin');
    expect(surfaceFor(GEN_REP, '')).toBe('rep');
  });

  it('[RED] canSwitchSurface is is_field_rep AND team, not either', () => {
    expect(canSwitchSurface(OWNER_REP)).toBe(true);
    expect(canSwitchSurface(OWNER_PLAIN)).toBe(false);
    expect(canSwitchSurface({ role: 'referrer', is_field_rep: true })).toBe(false);
    expect(canSwitchSurface(null)).toBe(false);
  });
});
