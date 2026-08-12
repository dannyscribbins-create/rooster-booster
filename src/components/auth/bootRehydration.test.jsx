// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 4 — BOOT REHYDRATION (D7, piece 2)
//
// Governing spec: CDL_3b_BUILD_SPEC.md §6, decision D7.
//
// THE STARTING TRUTH. `loggedIn` hard-initialised to false while a perfectly
// valid token sat in storage, so an accidental refresh dumped people back to the
// login screen. Every one of them then typed their PIN again to reach the screen
// they were already on.
//
// THE THREE OUTCOMES ASSERTED HERE:
//   valid token    → the app, and the login screen NEVER renders
//   bad token      → the login screen, cleanly, no crash, no partial state
//   no token       → the login screen IMMEDIATELY, with no loading state at all
//
// "NEVER RENDERS" IS THE INTERESTING ONE, and it is why the boot gate sits above
// every authenticated branch in renderThemedRoute() rather than beside them. A
// gate that merely resolves quickly still paints login-then-app on a slow
// connection — the flash users read as "it logged me out and then back in".
// Asserting it requires holding /api/session unresolved and checking the login
// screen is absent DURING the wait, which is what the deferred fixture below is
// for; a test that only checks the end state cannot see the flash.
//
// FIXTURE NOTE. App mounts ThemeProvider, whose branding chain may fetch, and a
// restored session immediately triggers the pipeline and profile-photo calls.
// The fixture answers by URL and returns benign payloads for everything it is
// not asserting on, so an unrelated call cannot fail the test.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { REFERRER_TOKEN_KEY } from '../../utils/authStorage';

const SESSION_OK = { role: 'referrer', name: 'Dana Referrer', email: 'dana@persist.test', contractorId: 'tnt-a' };

// Answers every call App can make on boot. `session` is the only interesting
// one; the rest exist so the component tree can finish rendering.
function installFetch({ session, holdSession = false }) {
  let releaseSession;
  const sessionGate = new Promise(resolve => { releaseSession = resolve; });

  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/session')) {
      if (holdSession) await sessionGate;
      if (!session) return { ok: false, status: 401, json: async () => ({ error: 'Not authorized' }) };
      return { ok: true, status: 200, json: async () => session };
    }
    if (u.includes('/api/pipeline')) {
      return { ok: true, status: 200, json: async () => ({ pipeline: [], balance: 0, paidCount: 0 }) };
    }
    // Branding chain, profile photo, bank status, anything else.
    return { ok: true, status: 200, json: async () => ({}) };
  });

  return { releaseSession };
}

const loginScreen = () => screen.queryByPlaceholderText('Email address');

// "The referrer app is on screen." The dashboard renders the name as an INITIALS
// avatar rather than as text, so querying for the name itself would be testing
// the avatar's formatting, not the rehydration.
const referrerApp = () => screen.queryByText(/Available Balance/i);

// The name arrived FROM THE SERVER, not merely from the presence of a token:
// App passes the rehydrated userName straight into the pipeline request, so the
// query string is where the session payload becomes observable.
function pipelineCalledFor(name) {
  return global.fetch.mock.calls.some(c =>
    String(c[0]).includes('/api/pipeline') &&
    String(c[0]).includes(encodeURIComponent(name))
  );
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

describe('C/DL-3b Phase 4 — boot rehydration (D7)', () => {

  it('[RED] a VALID token restores the session and the login screen never renders', async () => {
    localStorage.setItem(REFERRER_TOKEN_KEY, 'valid-token');
    installFetch({ session: SESSION_OK });

    render(<App />);

    await waitFor(() => expect(referrerApp()).toBeTruthy());
    expect(loginScreen()).toBeNull();
    // Proves it rehydrated from the SERVER's answer rather than merely trusting
    // that a token was present.
    await waitFor(() => expect(pipelineCalledFor('Dana Referrer')).toBe(true));
  });

  it('[RED] NO FLASH — while the token is being validated, neither login nor the app is shown', async () => {
    localStorage.setItem(REFERRER_TOKEN_KEY, 'valid-token');
    const { releaseSession } = installFetch({ session: SESSION_OK, holdSession: true });

    render(<App />);

    // Mid-flight: the boot gate is up.
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(loginScreen()).toBeNull();
    expect(referrerApp()).toBeNull();

    releaseSession();
    await waitFor(() => expect(referrerApp()).toBeTruthy());
  });

  it('[RED] an EXPIRED or REVOKED token lands on the login screen, no crash', async () => {
    localStorage.setItem(REFERRER_TOKEN_KEY, 'dead-token');
    installFetch({ session: null });

    render(<App />);

    await waitFor(() => expect(loginScreen()).toBeTruthy());
    expect(referrerApp()).toBeNull();
  });

  it('[RED] a network failure during rehydration lands on the login screen', async () => {
    localStorage.setItem(REFERRER_TOKEN_KEY, 'some-token');
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/api/session')) throw new Error('offline');
      return { ok: true, status: 200, json: async () => ({}) };
    });

    render(<App />);

    await waitFor(() => expect(loginScreen()).toBeTruthy());
  });

  it('[RED] a TEAM token does not restore the referrer app — Phase 5 owns that route', async () => {
    localStorage.setItem(REFERRER_TOKEN_KEY, 'team-token');
    installFetch({ session: { role: 'team', tier: 'general', permissions: {} } });

    render(<App />);

    await waitFor(() => expect(loginScreen()).toBeTruthy());
    // Deliberately NOT cleared: destroying a working credential to tidy up a
    // screen that has not been built yet would be the wrong trade.
    expect(localStorage.getItem(REFERRER_TOKEN_KEY)).toBe('team-token');
  });

  it('[RED] with NO stored token the login screen paints with no session call at all', async () => {
    installFetch({ session: SESSION_OK });

    render(<App />);

    await waitFor(() => expect(loginScreen()).toBeTruthy());
    // Nobody with no token should pay a round-trip or see a spinner.
    const sessionCalls = global.fetch.mock.calls.filter(c => String(c[0]).includes('/api/session'));
    expect(sessionCalls).toHaveLength(0);
  });
});
