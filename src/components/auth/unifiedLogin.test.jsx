// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 5 — THE UNIFIED DOOR
//
// Governing spec: CDL_3b_BUILD_SPEC.md §7.1, decisions D2, D3, D12, and CD-4.
//
// ONE WHITE-LABELED DOOR replacing two: LoginScreen.jsx (client) and the inline
// AdminLogin inside AdminApp.jsx (team). The endpoint was already unified in
// Phase 2B — verify-then-disambiguate means one form can serve both — but the UI
// still had two, styled differently, and the team one announced the admin panel's
// existence to anyone who typed ?admin=true.
//
// ── WHAT THIS FILE PINS ─────────────────────────────────────────────────────
//   · the choice screen renders ONLY on a genuine multi-match (D2)
//   · choosing posts { choice_token, selection } and never the password again
//   · the choice list shows contractor name and role, and NOTHING else (D2)
//   · a 403 renders the frozen view from the RESPONSE's branding (D3)
//   · "Password", not "PIN", everywhere (D12)
//   · the retired contractorSlug is no longer sent
//   · no Accent literal survives in either rewritten file (sweep, not spot check)
//
// ── THE CHOICE-SCREEN PRIVACY ASSERTION IS THE SHARP ONE ────────────────────
// D2 permits contractor name and role on that list and forbids emails and IDs.
// The server already honours this; the risk is the CLIENT rendering something
// the server did not send but the client happens to hold — the typed email sits
// in component state two lines away. So the assertion is negative and specific:
// the address the person just typed must not appear on the choice screen.
// ─────────────────────────────────────────────────────────────────────────────

// fireEvent, not userEvent: @testing-library/user-event is pinned at v13 here,
// which has no `setup()` — and fireEvent is what every other component test in
// this repo uses.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import LoginScreen from './LoginScreen';

const TYPED_EMAIL = 'multi@door.test';
const TYPED_PASSWORD = 'a-real-password-14';

const CHOICE_RESPONSE = {
  choice_required: true,
  choice_token: 'c'.repeat(64),
  identities: [
    { selection: 0, contractor_name: 'Alpha Roofing', role: 'referrer' },
    { selection: 1, contractor_name: 'Beta Exteriors', role: 'team' },
  ],
};

const SINGLE_MATCH_RESPONSE = {
  success: true, role: 'referrer', token: 'single-token',
  fullName: 'Dana Referrer', email: TYPED_EMAIL,
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

describe('C/DL-3b Phase 5 — the unified login door', () => {

  it('[RED] labels the credential field "Password", never "PIN" (D12)', async () => {
    installFetch({ login: async () => ok(SINGLE_MATCH_RESPONSE), choice: async () => ok({}) });
    render(<LoginScreen onAuthenticated={() => {}} />);

    expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
    // The whole screen, not just the label — "Forgot PIN?" lived here too.
    expect(document.body.textContent).not.toMatch(/\bPIN\b/);
  });

  it('[RED] does not send the retired contractorSlug', async () => {
    // Ignored server-side since Phase 2B (D1 retired the Tenant Rebuild §3.5
    // narrowing exception). Sending it anyway implies to a future reader that
    // tenancy is still a client input, which is exactly the belief D1 removed.
    let sent = null;
    installFetch({ login: async (body) => { sent = body; return ok(SINGLE_MATCH_RESPONSE); }, choice: async () => ok({}) });
    render(<LoginScreen onAuthenticated={() => {}} />);

    signIn();

    await waitFor(() => expect(sent).toBeTruthy());
    expect(sent.contractorSlug).toBeUndefined();
    expect(sent.password).toBe(TYPED_PASSWORD);
  });

  it('[RED] a SINGLE match never shows the choice screen', async () => {
    const onAuthenticated = vi.fn();
    installFetch({ login: async () => ok(SINGLE_MATCH_RESPONSE), choice: async () => ok({}) });
    render(<LoginScreen onAuthenticated={onAuthenticated} />);

    signIn();

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
    expect(screen.queryByText(/Alpha Roofing/)).toBeNull();
    expect(screen.queryByText(/which account/i)).toBeNull();
  });

  it('[RED] a MULTI match shows the choice screen, with contractor name and role only', async () => {
    installFetch({ login: async () => ok(CHOICE_RESPONSE), choice: async () => ok({}) });
    render(<LoginScreen onAuthenticated={() => {}} />);

    signIn();

    await waitFor(() => expect(screen.getByText(/Alpha Roofing/)).toBeTruthy());
    expect(screen.getByText(/Beta Exteriors/)).toBeTruthy();

    // ⚠ THE PRIVACY ASSERTION (D2). The email is two lines away in component
    // state, so rendering it here would be an easy, invisible mistake — and it
    // would put an address on screen next to a list of the companies that address
    // is registered with.
    expect(document.body.textContent).not.toContain(TYPED_EMAIL);
    // The choice token is a bearer credential. It belongs in a request body, not
    // in the DOM.
    expect(document.body.innerHTML).not.toContain(CHOICE_RESPONSE.choice_token);
  });

  it('[RED] choosing posts { choice_token, selection } and never the password again', async () => {
    let choiceBody = null;
    const onAuthenticated = vi.fn();
    installFetch({
      login: async () => ok(CHOICE_RESPONSE),
      choice: async (body) => {
        choiceBody = body;
        return ok({ success: true, role: 'team', token: 'team-token', tier: 'general', is_field_rep: true });
      },
    });
    render(<LoginScreen onAuthenticated={onAuthenticated} />);
    signIn();

    await waitFor(() => expect(screen.getByText(/Beta Exteriors/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Beta Exteriors/ }));

    await waitFor(() => expect(choiceBody).toBeTruthy());
    expect(choiceBody.choice_token).toBe(CHOICE_RESPONSE.choice_token);
    expect(choiceBody.selection).toBe(1);
    // D2, binding: the credential was already proven when the token was issued.
    // Re-sending it would mean holding it in the client across two requests for
    // no gain.
    expect(choiceBody.password).toBeUndefined();
    expect(choiceBody.pin).toBeUndefined();

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
    expect(onAuthenticated.mock.calls[0][0].role).toBe('team');
  });

  it('[RED] a frozen 403 renders the frozen view, branded from the RESPONSE body (D3)', async () => {
    installFetch({
      login: async () => forbidden({
        error: 'account_frozen',
        branding: { companyName: 'Gamma Roofing', primaryColor: '#123456' },
      }),
      choice: async () => ok({}),
    });
    render(<LoginScreen onAuthenticated={() => {}} />);

    signIn();

    await waitFor(() => expect(screen.getByText(/inactive/i)).toBeTruthy());
    // The branding travels in the 403 because the server has already proven the
    // password and therefore knows the contractor — which is what makes the
    // frozen screen correctly white-labeled on a brand-new device with no hint.
    expect(screen.getByText(/Gamma Roofing/)).toBeTruthy();
    // The literal protocol code must never reach a person.
    expect(document.body.textContent).not.toContain('account_frozen');
  });

  it('[RED] carries a quiet team-member affordance (CD-4)', async () => {
    installFetch({ login: async () => ok(SINGLE_MATCH_RESPONSE), choice: async () => ok({}) });
    render(<LoginScreen onAuthenticated={() => {}} />);

    // Client-facing BY DEFAULT: the homeowner framing is what an unknown visitor
    // sees, and the team route is present but quiet.
    expect(screen.getByText(/referral rewards/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /team member/i })).toBeTruthy();
  });
});

// ── THE SWEEP ────────────────────────────────────────────────────────────────
// A SOURCE-TEXT SWEEP, NOT A RENDERED SPOT CHECK, because the failure mode is a
// literal that only appears on a branch the test did not happen to render — the
// forgot-password sub-form, an error state, a fallback. Reading the file catches
// every branch at once.
describe('C/DL-3b Phase 5 — Group A retirement on the two rewritten files', () => {
  const FILES = [
    'src/components/auth/LoginScreen.jsx',
    'src/components/auth/ResetPinScreen.jsx',
  ];

  // Accent Roofing's palette and identity. The hexes are the platform's original
  // single-tenant colours; a contractor who saved no branding was shown them.
  const ACCENT_LITERALS = [
    'ACCENT ROOFING SERVICE',
    'Accent Roofing',
    'AccentRoofing-Logo',
    'accentRoofingLogo',
    'EST. 1989',
    '#012854',
    '#CC0000',
    '#D3E3F0',
  ];

  for (const file of FILES) {
    it(`[RED] ${file} contains no Accent literal`, () => {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      const found = ACCENT_LITERALS.filter(literal => source.includes(literal));
      expect(found,
        `${file} still carries Accent Roofing literals: ${found.join(', ')}. ` +
        'Branding must come from the D4 chain, not from an import or a hardcoded hex.'
      ).toEqual([]);
    });
  }
});
