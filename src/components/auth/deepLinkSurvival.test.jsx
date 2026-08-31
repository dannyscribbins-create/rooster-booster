// ─────────────────────────────────────────────────────────────────────────────
// DEEP-LINK PARAMETERS SURVIVE AUTHENTICATION
//
// WHY THIS FILE EXISTS. Phase 5 retired `?admin=true` as a routing input, and the
// guard tests proved it no longer PRODUCES a panel. None of them asked who was
// still SENDING it — and three server-side redirects attach a SECOND parameter:
//
//   server/routes/oauth.js:138   ?section=crm                (Jobber connect return)
//   server/routes/stripe.js:73   ?stripe_connect=refresh     (Stripe Connect return)
//   server/routes/stripe.js:74   ?stripe_connect=success
//
// THE TWO ARE NOT ALIKE, and conflating them produced a reported regression that
// did not exist:
//
//   stripe_connect  HAS a real consumer — BankingSettings.jsx:85 reads it straight
//                   off window.location.search when that panel mounts, confirms
//                   the connection server-side, then strips it from the URL. It is
//                   a LEAF component reading the URL directly, which is why a
//                   consumer search run against App.jsx and AdminApp.jsx missed it.
//   section         has NO consumer anywhere in src/, under any spelling. It has
//                   always been decorative and the Jobber return has always landed
//                   on the dashboard — pre-existing, not a Phase 5 regression.
//
// ⚠⚠ THE PROPERTY UNDER TEST IS SURVIVAL, NOT ROUTING — AND IT IS CURRENTLY AN
// ACCIDENT. NOTHING CHOSE IT.
//
// Signing in performs NO navigation: the session flips in React state and the URL
// is untouched, so the deep-link parameter survives the round-trip for free. That
// is true ONLY because there is no router — and D10 ("no router library in 3b") is
// explicitly revisitable at 3c when the bottom nav lands. A router, or any login
// path that navigated, reloaded, or tidied the URL with replaceState, would
// destroy it.
//
// ⚠ THE FAILURE WOULD BE SILENT. If login ever navigates, the Stripe Connect
// confirmation stops firing and NOTHING ELSE FAILS — no error, no log, no red
// test. The admin simply never gets their bank account marked connected, and the
// only symptom is a contractor who cannot be paid. Same silent-failure class as
// the branding drift guards: a correctness property that nothing announces the
// loss of. That is why an accidental property gets an explicit test.
//
// ── THE SHAPE THAT WOULD BREAK IT, NAMED ────────────────────────────────────
// `AdminSetPasswordScreen.jsx:34` is THE ONE PLACE IN THE APP THAT DESTROYS THE
// QUERY STRING on the way to the panel: `window.location.replace('/')` is a REAL
// NAVIGATION, unlike the state-flip that signing in performs. It is harmless
// there — an invite link carries no deep-link parameter — but it is precisely the
// pattern that would break the Stripe return if it were ever copied onto the login
// path. (App.jsx does the same in the signup flow, and ResetPinScreen on success;
// neither sits between a deep-link and the panel.)
//
// This distinction — real navigation vs state flip — is the thing to hold on to.
// It is also what explains the Jobber OAuth return landing on the sign-in screen
// before Phase 4: that return IS a real navigation, and no session survived one
// until boot rehydration shipped.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';
import { ADMIN_STATS_ZEROS, FLAGGED_SUMMARY_ZERO } from '../../__fixtures__/adminStats';

const TEAM_SESSION = {
  role: 'team', contractorId: 'tnt-deeplink', tier: 'owner',
  is_field_rep: false, permissions: {},
};

const adminPanel = () => screen.queryByText(/Missing Referrals/i);

// ⚠ THE STATS PAYLOAD IS SHAPED, NOT `{}` — and so is the flagged summary. Both
// come from src/__fixtures__/adminStats.js, which carries the reasoning: an
// empty-object mock clears AdminDashboard's object-level guard and THEN throws
// inside React on a later tick, which is how this was twice recorded as a flake.
//
// EVERY TEST IN THIS FILE MOUNTS THE PANEL: AdminApp opens on 'dashboard' with no
// PermissionGate above it, so AdminDashboard renders even though nothing here
// asserts on it, and AdminApp reads `.unresolved_count` off the summary on the
// same boot. The deep-link parameter is what is pinned; the dashboard is just
// what the panel paints underneath it.
//
// ⚠ RESOLVED — this block used to record both field-level guards as missing and
// defer them to Phase 6. Both shipped: ABR 6B step 1 (AdminDashboard.test.jsx),
// step 3 (AdminApp.test.jsx).

function installFetch({ session }) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/session')) {
      if (!session) return { ok: false, status: 401, json: async () => ({ error: 'Not authorized' }) };
      return { ok: true, status: 200, json: async () => session };
    }
    if (u.includes('/api/login')) {
      return { ok: true, status: 200, json: async () => ({
        success: true, role: 'team', token: 'team-token', tier: 'owner', is_field_rep: false,
      }) };
    }
    // ⚠ THIS BRANCH DID NOT EXIST BEFORE C/DL-3c PHASE 2b, AND ITS ABSENCE WAS
    // INVISIBLE. Every /api/admin/me call fell through to the catch-all below,
    // so the panel was driven by a response this fixture never modelled — and it
    // passed anyway, because the old panel rendered whatever permissions said.
    // Ruling A(i)'s arrival marker is what surfaced it: an unmodelled `{}` reads
    // as `tier: undefined`, which means "no answer yet", and the panel correctly
    // waits forever. A fixture answering a call it never modelled looks like
    // coverage and is not. Second instance this phase — see roleRouting.test.jsx.
    if (u.includes('/api/admin/me')) {
      return { ok: true, status: 200, json: async () => ({
        tier: 'owner', permissions: { dashboard: true },
      }) };
    }
    if (u.includes('/api/admin/stats')) {
      return { ok: true, status: 200, json: async () => ADMIN_STATS_ZEROS };
    }
    if (u.includes('/api/admin/flagged-referrals/summary')) {
      return { ok: true, status: 200, json: async () => FLAGGED_SUMMARY_ZERO };
    }
    if (u.includes('/api/admin/cashouts') || u.includes('/api/admin/missing-referrals')) {
      return { ok: true, status: 200, json: async () => [] };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

const setUrl = (search) => window.history.replaceState({}, '', `/${search}`);

beforeEach(() => { localStorage.clear(); setUrl(''); });
afterEach(() => { delete global.fetch; localStorage.clear(); setUrl(''); });

describe('C/DL-3b Phase 5 — deep-link parameters survive the login round-trip', () => {

  it('a Stripe Connect return preserves stripe_connect through a FRESH sign-in', async () => {
    setUrl('?admin=true&stripe_connect=success');
    installFetch({ session: null });

    render(<App />);
    await waitFor(() => expect(screen.getByLabelText(/email address/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'owner@deeplink.test' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'a-real-password-14' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(adminPanel()).toBeTruthy());

    // The parameter BankingSettings.jsx:85 reads when the admin opens Settings →
    // Banking. Asserted on the URL rather than on that component, because what is
    // being pinned is that authentication did not destroy it — not what Banking
    // does with it afterwards.
    expect(new URLSearchParams(window.location.search).get('stripe_connect')).toBe('success');
  });

  it('a Stripe Connect return preserves stripe_connect through REHYDRATION', async () => {
    // The likelier path in production: the admin was signed in, left for Stripe,
    // and came back with a live token still in storage.
    setUrl('?admin=true&stripe_connect=refresh');
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch({ session: TEAM_SESSION });

    render(<App />);
    await waitFor(() => expect(adminPanel()).toBeTruthy());

    expect(new URLSearchParams(window.location.search).get('stripe_connect')).toBe('refresh');
  });

  it('the Jobber connect return preserves its section parameter', async () => {
    // ⚠ NOTHING CONSUMES `section` — grep finds no reader anywhere in src/. This
    // asserts only that the parameter arrives intact, so that whoever eventually
    // wires the CRM deep-link has something to read. It is deliberately NOT an
    // assertion that the CRM section opens: that has never happened, before or
    // after Phase 5.
    //
    // NOTE THE EVENT CLASS. The real OAuth return is a FULL PAGE LOAD, not the
    // state-flip that signing in performs — which is why this test mounts App
    // fresh with the parameter already on the URL rather than driving the form.
    // Before Phase 4 no session survived a page load at all (`authed` initialised
    // to false regardless of a valid stored token), so the return landed on the
    // sign-in screen; boot rehydration is what changed that. Wiring `section` is
    // a minor UX item owned by the contractor-ID reconciliation session.
    setUrl('?admin=true&section=crm');
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch({ session: TEAM_SESSION });

    render(<App />);
    await waitFor(() => expect(adminPanel()).toBeTruthy());

    expect(new URLSearchParams(window.location.search).get('section')).toBe('crm');
  });

  it('no deep-link parameter is invented when none was sent', async () => {
    setUrl('');
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch({ session: TEAM_SESSION });

    render(<App />);
    await waitFor(() => expect(adminPanel()).toBeTruthy());

    expect(new URLSearchParams(window.location.search).get('stripe_connect')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('section')).toBeNull();
  });
});
