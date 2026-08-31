// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c — PHASE 2c — RULING B ON THE CLIENT
//
// THE FOURTH OUTCOME, seen from the browser. POST /api/login has three shapes
// this file already knows about — a generic 401, a session, and D2's choice
// payload — and this adds a fourth: a SESSION that arrives carrying
// `team_access_revoked`. The session is complete and valid; the screen precedes
// the destination rather than replacing it.
//
// ⚠ THE DISTINCTION FROM THE FROZEN SCREEN IS THE THING MOST LIKELY TO BE LOST
// LATER, so it is asserted rather than described. FrozenAccountScreen is
// TERMINAL — no session exists, and its only way out is back to the sign-in
// form. This screen is ACKNOWLEDGED-THEN-CONTINUE, with a session already in
// hand. Rendering the frozen screen here would tell someone who IS signed in
// that they cannot get in, which is a different and false statement.
// PRE_LAUNCH_CHECKLIST.md ruled it a new component for exactly that reason.
//
// ⚠ AND THE CONTRACTOR NAME IS THE MULTI-TENANT ASSERTION. The session being
// minted is a REFERRER session, and the referrer's contractor may not be the
// employer whose team access was revoked — `users` is UNIQUE(contractor_id,
// email) while `team_members.email` is globally unique, so one person
// legitimately holds both under two tenants. The fixture therefore uses two
// DIFFERENT company names and the assertions name the right one and deny the
// other; a screen reading its employer name off ThemeContext would satisfy a
// single-name fixture perfectly.
//
// jsdom NOTE: var() never resolves here, so nothing below asserts a colour.
// Both themes need a real look — recorded in the phase report, not faked here.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginScreen from './LoginScreen';
import TeamAccessRevokedScreen from './TeamAccessRevokedScreen';

const TYPED_EMAIL = 'frozen.rep@door.test';
const TYPED_PASSWORD = 'a-real-password-14';

// The employer whose team access was revoked.
const EMPLOYER_NAME = 'Employer Roofing Co';
// The contractor whose referrer app the person is actually entering. Different
// company, on purpose — see the header.
const HOMEOWNER_NAME = 'Homeowner Exteriors';

const SESSION_BODY = {
  success: true, role: 'referrer', token: 'session-token-abc',
  fullName: 'Dana Homeowner', email: TYPED_EMAIL,
};

const REVOKED_RESPONSE = {
  ...SESSION_BODY,
  team_access_revoked: { contractor_name: EMPLOYER_NAME },
};

function installFetch(handlers) {
  global.fetch = vi.fn(async (url, init) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(init.body) : null;
    if (u.includes('/api/login/choice')) return handlers.choice(body);
    if (u.includes('/api/login')) return handlers.login(body);
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

const ok = (payload) => ({ ok: true, status: 200, json: async () => payload });
const forbidden = (payload) => ({ ok: false, status: 403, json: async () => payload });

function signIn() {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: TYPED_EMAIL } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: TYPED_PASSWORD } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { delete global.fetch; localStorage.clear(); });

describe('C/DL-3c Phase 2c — the frozen rep is told, once', () => {

  it('[RED] R1 — a session carrying team_access_revoked shows the notice and HOLDS the session', async () => {
    const onAuthenticated = vi.fn();
    installFetch({ login: async () => ok(REVOKED_RESPONSE), choice: async () => ok({}) });
    render(<LoginScreen onAuthenticated={onAuthenticated} />);
    signIn();

    await waitFor(() => {
      expect(screen.queryByText(new RegExp(EMPLOYER_NAME, 'i'))).toBeTruthy();
    });

    // ⚠ HELD, NOT DROPPED. The session is valid and the person is going to use
    // it — the screen simply comes first. A handler that called onAuthenticated
    // AND rendered the notice would flash the screen and navigate away from it.
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('[RED] R2 — POSITIVE SIBLING: the same session WITHOUT the notice signs straight through', async () => {
    // ⚠ THIS IS WHAT STOPS "ALWAYS SHOW THE SCREEN" FROM PASSING R1, and it is
    // the same fixture minus one key — not a different login shape.
    const onAuthenticated = vi.fn();
    installFetch({ login: async () => ok(SESSION_BODY), choice: async () => ok({}) });
    render(<LoginScreen onAuthenticated={onAuthenticated} />);
    signIn();

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(SESSION_BODY));
    expect(screen.queryByText(new RegExp(EMPLOYER_NAME, 'i'))).toBeNull();
  });

  it('[RED] R3 — continuing hands the FULL session body to onAuthenticated, unmodified', async () => {
    const onAuthenticated = vi.fn();
    installFetch({ login: async () => ok(REVOKED_RESPONSE), choice: async () => ok({}) });
    render(<LoginScreen onAuthenticated={onAuthenticated} />);
    signIn();

    const go = await screen.findByRole('button', { name: /continue/i });
    fireEvent.click(go);

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    // The whole body, notice included — the parent decides what to store, and
    // stripping a key here would be this screen editing someone else's payload.
    expect(onAuthenticated).toHaveBeenCalledWith(REVOKED_RESPONSE);
  });

  it('[RED] R4 — it is NOT the frozen screen: no "contact your administrator", no way back to the form', async () => {
    // The two screens are easy to conflate and the copy is where the difference
    // is visible to a person. Telling someone who just signed in that they
    // should contact an administrator to get access restored is false.
    installFetch({ login: async () => ok(REVOKED_RESPONSE), choice: async () => ok({}) });
    render(<LoginScreen onAuthenticated={() => {}} />);
    signIn();

    await screen.findByRole('button', { name: /continue/i });
    expect(screen.queryByText(/contact your administrator/i)).toBeNull();
    expect(screen.queryByText(/your account is inactive/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /back to sign in/i })).toBeNull();
  });

  it('[RED] R5 — REGRESSION FENCE: a 403 account_frozen still renders the frozen screen, unchanged', async () => {
    // Ruling B adds an outcome; it must not reroute D3's. This is the assertion
    // that would catch the fourth outcome swallowing the third.
    installFetch({
      login: async () => forbidden({ error: 'account_frozen', branding: { companyName: EMPLOYER_NAME } }),
      choice: async () => ok({}),
    });
    render(<LoginScreen onAuthenticated={() => {}} />);
    signIn();

    expect(await screen.findByText(/your account is inactive/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull();
  });

  it('[RED] R6 — the screen names the contractor it is GIVEN, and nothing else', async () => {
    // Rendered directly, so the assertion is about the component rather than the
    // wiring. A screen that read ThemeContext instead of its prop would show the
    // homeowner-side company — or the platform default — and R1 alone could not
    // tell, because R1 never puts a second name on the page.
    render(<TeamAccessRevokedScreen contractorName={EMPLOYER_NAME} onContinue={() => {}} />);

    expect(screen.getByText(new RegExp(EMPLOYER_NAME, 'i'))).toBeTruthy();
    expect(screen.queryByText(new RegExp(HOMEOWNER_NAME, 'i'))).toBeNull();
    expect(document.body.textContent).not.toMatch(/RoofMiles/);
  });

  it('[RED] R7 — with no name it still says something true, and invents no employer', async () => {
    // Identity-bearing values get no defaults (CLAUDE.md): a company name says
    // WHO, so an absent one must degrade to a generic sentence rather than
    // borrow the platform's name or another contractor's.
    render(<TeamAccessRevokedScreen contractorName={null} onContinue={() => {}} />);

    expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/RoofMiles/);
    expect(document.body.textContent).not.toMatch(/null|undefined/);
  });
});
