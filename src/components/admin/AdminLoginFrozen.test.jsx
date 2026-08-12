// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 3 RED SUITE — THE ADMIN DOOR SAYS THE SAME THING (D3)
//
// WHY THIS FILE EXISTS SEPARATELY FROM THE FROZEN VIEW'S OWN SUITE. The people
// D3 is actually about are DEACTIVATED EMPLOYEES, and today they log in through
// ?admin=true — the inline AdminLogin inside AdminApp.jsx, not the referrer
// screen. That form does `if (d.error) setError('Invalid credentials')`, so it
// flattens EVERY failure to the one sentence the whole decision exists to stop
// showing them. Without this, POST /api/admin/login's new typed 403 is invisible
// on the only surface its audience uses.
//
// ⚠ NO BRANDED FROZEN SCREEN HERE, DELIBERATELY, AND IT IS NOT AN OVERSIGHT.
// The admin panel renders OUTSIDE ThemeProvider on purpose (C/DL-3b Phase 1,
// Ruling 5): it uses the AD tokens and a dark palette, and LockedSection's
// permission scrim there falls back to its own #012854 / #fbbf24 literals
// precisely because nothing mounts --rm-* over it. Rendering the referrer-themed
// FrozenAccountScreen inside this tree would drag that palette in. The honest
// message in the panel's own idiom is the whole fix; the branded view is the
// unified door's, and Phase 5 replaces this inline form with it.
//
// ── CONVENTION ───────────────────────────────────────────────────────────────
// jsdom + @testing-library/react under Vitest. AdminPanel renders AdminLogin
// while unauthenticated and fires NO requests in that state — every effect and
// useAdminPermissions gate on `authed` — so the only call the fixture models is
// the login itself.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminPanel from './AdminApp';

const FROZEN_403 = {
  error: 'account_frozen',
  branding: { companyName: 'Frozen Roofing Co', primaryColor: '#123456', logoUrl: null },
};
const GENERIC_401 = { error: 'Invalid credentials' };

function installFetch(loginResponse) {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes('/api/admin/login')) return loginResponse;
    throw new Error(`unexpected fetch to ${url} — the fixture does not model this call`);
  });
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

async function signIn() {
  fireEvent.change(screen.getByPlaceholderText('Enter admin email'), { target: { value: 'frozen@frozen.test.invalid' } });
  fireEvent.change(screen.getByPlaceholderText('Enter admin password'), { target: { value: 'frozen-password-1' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

afterEach(() => {
  delete global.fetch;
  sessionStorage.clear();
});

describe('C/DL-3b Phase 3 — admin login and a frozen account', () => {
  it('[RED] a 403 account_frozen explains the account is inactive instead of blaming the password', async () => {
    installFetch(jsonResponse(FROZEN_403, { ok: false, status: 403 }));
    render(<AdminPanel />);
    await signIn();

    await waitFor(() => expect(screen.getByText(/inactive/i)).toBeTruthy());

    // The two failure modes this replaces: the misleading sentence, and the raw
    // protocol code leaking to a human.
    expect(screen.queryByText('Invalid credentials')).toBeNull();
    expect(screen.queryByText('account_frozen')).toBeNull();
  });

  it('[RED] a frozen response signs nobody in', async () => {
    installFetch(jsonResponse(FROZEN_403, { ok: false, status: 403 }));
    render(<AdminPanel />);
    await signIn();

    await waitFor(() => expect(screen.getByText(/inactive/i)).toBeTruthy());
    // The client half of "MINT NO SESSION" — nothing to store, because the 403
    // carries no token, and the panel must not have flipped to its authed tree.
    expect(sessionStorage.getItem('rb_admin_token')).toBeNull();
    expect(screen.getByPlaceholderText('Enter admin password')).toBeTruthy();
  });

  it('[RED] an ordinary 401 still reads as invalid credentials', async () => {
    // The regression guard: the frozen branch must not swallow every failure.
    installFetch(jsonResponse(GENERIC_401, { ok: false, status: 401 }));
    render(<AdminPanel />);
    await signIn();

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeTruthy());
    expect(screen.queryByText(/inactive/i)).toBeNull();
  });
});
