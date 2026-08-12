// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 3 RED SUITE — THE FROZEN ACCOUNT VIEW (D3)
//
// Governing spec: CDL_3b_BUILD_SPEC.md §5.
//
// WHAT THIS COVERS, IN TWO HALVES. The server half of D3 is proven in
// server/test/frozenAccount.test.js — 403, typed body, zero session rows. That
// proves the endpoint answers correctly and nothing more. A correct answer that
// no screen can render is not a delivered feature: today's deployed LoginScreen
// reads `data.error` and prints it verbatim, so a frozen employee would be shown
// the literal string "account_frozen" in the red error box. So this file pins
// BOTH the component contract and the wiring that reaches it.
//
// WHY THE BRANDING IS A PROP AND NOT READ FROM THE THEME PROVIDER. The whole
// point of D3's branding bonus is the BRAND-NEW DEVICE: no stored hint, no
// contractor subdomain (the app lives on app.roofmiles.com, a reserved slug), no
// session. The D4 chain therefore resolves NEUTRAL on that device — correctly.
// The 403 body is the only thing in the exchange that knows the contractor,
// because the server proved the password first. Reading the provider here would
// show a frozen employee the platform's logo instead of their employer's,
// silently, in exactly the case the payload exists to serve.
//
// ⚠ WHAT A COLOUR ASSERTION CAN MEAN HERE. jsdom never resolves var(), but it
// DOES normalise a literal inline colour, so `#123456` is observable as
// `rgb(18, 52, 86)` on a computed style. These tests use literals from the
// payload — not variables — so the assertion is real rather than declaration-
// level. See src/components/shared/uiStatePrimitives.test.jsx for the var() case
// and why it cannot be proven this way.
//
// ── CONVENTION ───────────────────────────────────────────────────────────────
// jsdom + @testing-library/react under Vitest, following EmailVerifyScreen.test.jsx.
// `fetch` is replaced at the true external boundary; every component is real, and
// no assertion reads the mock — each reads what the SCREEN chose to render.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FrozenAccountScreen from './FrozenAccountScreen';
import LoginScreen from './LoginScreen';

// The exact payload POST /api/login returns on a verified-but-frozen credential.
// Modelled on resolveBrandingTheme's output shape, which is what the server sends
// — a fixture that invented a different shape would let a component that reads
// the wrong keys pass here and render nothing in production.
const CONTRACTOR_BRANDING = {
  companyName: 'Frozen Roofing Co',
  programName: null,
  primaryColor: '#123456',
  secondaryColor: '#654321',
  accentColor: '#ABCDEF',
  backgroundColor: '#FAFAFA',
  logoUrl: 'https://cdn.test.invalid/frozen-logo.png',
  phone: null,
  email: null,
};

const FROZEN_403 = { error: 'account_frozen', branding: CONTRACTOR_BRANDING };
const GENERIC_401 = { error: 'Invalid email or PIN' };

const EMAIL = 'frozen.member@frozen.test.invalid';
const PASSWORD = 'frozen-password-1';

// jsdom normalises an inline hex colour to its rgb() form on a computed style.
function rgbOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// Every colour the rendered tree actually paints with. Used instead of a
// test-only data attribute: production code should not grow a hook that exists
// only so a test can find an element.
function paintedColours(container) {
  return Array.from(container.querySelectorAll('*')).flatMap(el => {
    const cs = getComputedStyle(el);
    return [cs.backgroundColor, cs.color, cs.borderColor, cs.borderTopColor];
  });
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

let calls;
function installFetch(loginResponse) {
  calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body });
    if (String(url).includes('/api/login')) return loginResponse;
    throw new Error(`unexpected fetch to ${url} — the fixture does not model this call`);
  });
}

afterEach(() => {
  delete global.fetch;
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE COMPONENT CONTRACT
// ═════════════════════════════════════════════════════════════════════════════

describe('C/DL-3b Phase 3 — FrozenAccountScreen', () => {
  it('[RED] tells the person their account is inactive and who to contact', async () => {
    render(<FrozenAccountScreen branding={CONTRACTOR_BRANDING} />);

    // The copy D3 specifies: "your account is inactive, contact your
    // administrator". Matched loosely on the two load-bearing words so the
    // wording can be tuned without the test becoming a spell-checker.
    expect(screen.getByText(/inactive/i)).toBeTruthy();
    expect(screen.getByText(/administrator/i)).toBeTruthy();
  });

  it("[RED] renders the contractor's own name from the response payload", async () => {
    render(<FrozenAccountScreen branding={CONTRACTOR_BRANDING} />);
    expect(screen.getByText(CONTRACTOR_BRANDING.companyName)).toBeTruthy();
  });

  it("[RED] renders the contractor's own logo from the response payload", async () => {
    render(<FrozenAccountScreen branding={CONTRACTOR_BRANDING} />);
    const logo = screen.getByRole('img');
    expect(logo.getAttribute('src')).toBe(CONTRACTOR_BRANDING.logoUrl);
  });

  it("[RED] paints with the contractor's primary colour, not the platform's", async () => {
    const { container } = render(<FrozenAccountScreen branding={CONTRACTOR_BRANDING} />);
    expect(paintedColours(container)).toContain(rgbOf(CONTRACTOR_BRANDING.primaryColor));
  });

  it('[RED] falls back to the platform brand when no payload arrived', async () => {
    // A 403 that lost its branding — a proxy stripping the body, an older server,
    // a client that forgot to thread it. The screen must still render.
    render(<FrozenAccountScreen branding={null} />);

    expect(screen.getByText(/inactive/i)).toBeTruthy();
    expect(screen.getByText('RoofMiles')).toBeTruthy();

    // NO BORROWED LOGO, ever — the platform mark is the only honest stand-in, and
    // it must not be some other contractor's URL left over from the fixture.
    const logo = screen.getByRole('img');
    expect(logo.getAttribute('src')).not.toBe(CONTRACTOR_BRANDING.logoUrl);
  });

  it('[RED] is view-only — it offers no credential field to retry with', async () => {
    // D3, binding: the screen needs no authenticated data and mints no session.
    // A password box here would invite the retry loop the whole decision exists to
    // end, and would be the first step toward the half-privileged token D3 refuses.
    const { container } = render(<FrozenAccountScreen branding={CONTRACTOR_BRANDING} />);
    expect(container.querySelectorAll('input[type="password"]').length).toBe(0);
    expect(container.querySelectorAll('input').length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE WIRING — WITHOUT THIS THE ENDPOINT CHANGE IS INVISIBLE
// ═════════════════════════════════════════════════════════════════════════════

describe('C/DL-3b Phase 3 — LoginScreen reaches the frozen view', () => {
  // Drives the real form the way a person does.
  //
  // BY ROLE, NOT BY TEXT: the screen's own subheading reads "Sign in to view your
  // referral rewards", so getByText(/sign in/i) matches two elements and throws.
  async function signIn() {
    fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: EMAIL } });
    fireEvent.change(screen.getByPlaceholderText('PIN'), { target: { value: PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
  }

  it('[RED] a 403 account_frozen replaces the form with the frozen view', async () => {
    // TODAY: LoginScreen does `if (data.error) setError(data.error)`, so this
    // renders the literal string "account_frozen" in the red error box.
    installFetch(jsonResponse(FROZEN_403, { ok: false, status: 403 }));
    render(<LoginScreen onLogin={() => {}} />);
    await signIn();

    await waitFor(() => expect(screen.getByText(/inactive/i)).toBeTruthy());
    expect(screen.getByText(CONTRACTOR_BRANDING.companyName)).toBeTruthy();

    // The raw error code must never reach a human, and the form must be gone
    // rather than merely covered.
    expect(screen.queryByText('account_frozen')).toBeNull();
    expect(screen.queryByPlaceholderText('PIN')).toBeNull();
  });

  it('[RED] a frozen response never signs anyone in', async () => {
    // The client half of "MINT NO SESSION": no onLogin call, so no token is
    // stored and no app state flips to logged-in.
    const onLogin = vi.fn();
    installFetch(jsonResponse(FROZEN_403, { ok: false, status: 403 }));
    render(<LoginScreen onLogin={onLogin} />);
    await signIn();

    await waitFor(() => expect(screen.getByText(/inactive/i)).toBeTruthy());
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('[RED] an ordinary 401 still shows the inline error and keeps the form', async () => {
    // The regression guard. The frozen branch must not swallow every failure —
    // a wrong password is still a wrong password, on the same screen.
    installFetch(jsonResponse(GENERIC_401, { ok: false, status: 401 }));
    render(<LoginScreen onLogin={() => {}} />);
    await signIn();

    await waitFor(() => expect(screen.getByText(GENERIC_401.error)).toBeTruthy());
    expect(screen.getByPlaceholderText('PIN')).toBeTruthy();
    expect(screen.queryByText(/inactive/i)).toBeNull();
  });
});
