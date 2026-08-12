// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 4 — THE CLIENT SESSION SEAM (D6 / D7)
//
// Governing spec: CDL_3b_BUILD_SPEC.md §6, decisions D6 and D7.
//
// WHAT THIS FILE PROTECTS. authStorage.js is the single place a bearer token is
// read, written or cleared. Before Phase 4 that happened inline in 118 places
// across 38 files. The value of collapsing it to one module is entirely in the
// invariants below — if any of them stop holding, the seam has quietly become a
// second way of doing it rather than the only way.
//
// THE ONE THAT WILL BITE IF IT BREAKS: rm_brand_hint (CD-24 R3). Phase 1 put the
// branding hint in localStorage and prefixed it rm_ rather than rb_ so that a
// logout clearing "the rb keys" could not take it. Now that TOKENS live in
// localStorage too, the hint sits in the same store as the credential — one
// storage.clear() away from being wiped on every logout, which would blank a
// returning visitor's brand and be blamed on the branding chain rather than here.
//
// jsdom gives real localStorage and sessionStorage, so these are exercised
// against the actual Storage implementation rather than a stand-in.
// ─────────────────────────────────────────────────────────────────────────────

import {
  getReferrerToken, setReferrerToken, clearReferrerToken,
  getAdminToken, setAdminToken, clearAdminToken,
  getControlToken, setControlToken, clearControlToken,
  logoutReferrer, logoutAdmin, logoutControl,
  fetchSession,
  REFERRER_TOKEN_KEY, ADMIN_TOKEN_KEY, CONTROL_TOKEN_KEY,
} from './authStorage';

const BRAND_HINT_KEY = 'rm_brand_hint';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete global.fetch;
});

afterEach(() => {
  delete global.fetch;
});

describe('C/DL-3b Phase 4 — token storage (D7 piece 3)', () => {
  it('writes the referrer token to localStorage, NOT sessionStorage', () => {
    setReferrerToken('tok-referrer');

    expect(localStorage.getItem(REFERRER_TOKEN_KEY)).toBe('tok-referrer');
    // The whole point of D7 piece 3: sessionStorage dies with the tab.
    expect(sessionStorage.getItem(REFERRER_TOKEN_KEY)).toBeNull();
    expect(getReferrerToken()).toBe('tok-referrer');
  });

  it('keeps the three surfaces in separate keys', () => {
    setReferrerToken('tok-r');
    setAdminToken('tok-a');
    setControlToken('tok-c');

    expect(getReferrerToken()).toBe('tok-r');
    expect(getAdminToken()).toBe('tok-a');
    expect(getControlToken()).toBe('tok-c');
    expect(new Set([REFERRER_TOKEN_KEY, ADMIN_TOKEN_KEY, CONTROL_TOKEN_KEY]).size).toBe(3);
  });

  it('clearing one surface leaves the others signed in', () => {
    setReferrerToken('tok-r');
    setAdminToken('tok-a');

    clearReferrerToken();

    expect(getReferrerToken()).toBeNull();
    expect(getAdminToken()).toBe('tok-a');
  });

  it('returns null rather than undefined when nothing is stored', () => {
    expect(getReferrerToken()).toBeNull();
    expect(getAdminToken()).toBeNull();
    expect(getControlToken()).toBeNull();
  });
});

describe('the legacy sessionStorage migration', () => {
  it('adopts a pre-Phase-4 token so live sessions are not signed out by the deploy', () => {
    sessionStorage.setItem(REFERRER_TOKEN_KEY, 'legacy-token');

    expect(getReferrerToken()).toBe('legacy-token');
    expect(localStorage.getItem(REFERRER_TOKEN_KEY)).toBe('legacy-token');
  });

  it('is ONE-WAY — the old copy does not linger', () => {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, 'legacy-admin');

    getAdminToken();

    expect(sessionStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
  });

  it('never overwrites a current token with a stale legacy one', () => {
    localStorage.setItem(CONTROL_TOKEN_KEY, 'current');
    sessionStorage.setItem(CONTROL_TOKEN_KEY, 'stale');

    expect(getControlToken()).toBe('current');
  });
});

describe('rm_brand_hint SURVIVES LOGOUT (CD-24 R3)', () => {
  it('clearing a token leaves the branding hint untouched', () => {
    localStorage.setItem(BRAND_HINT_KEY, 'accent-roofing');
    setReferrerToken('tok-r');

    clearReferrerToken();

    expect(localStorage.getItem(BRAND_HINT_KEY)).toBe('accent-roofing');
  });

  it('a full logout on every surface still leaves the hint', async () => {
    localStorage.setItem(BRAND_HINT_KEY, 'accent-roofing');
    setReferrerToken('tok-r');
    setAdminToken('tok-a');
    setControlToken('tok-c');
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));

    await logoutReferrer();
    await logoutAdmin();
    await logoutControl();

    expect(getReferrerToken()).toBeNull();
    expect(getAdminToken()).toBeNull();
    expect(getControlToken()).toBeNull();
    // The assertion that catches a storage.clear() creeping into logout.
    expect(localStorage.getItem(BRAND_HINT_KEY)).toBe('accent-roofing');
  });
});

describe('logout calls the server (D6)', () => {
  it('POSTs /api/logout with the bearer token BEFORE clearing it', async () => {
    setReferrerToken('tok-to-kill');
    const seen = [];
    global.fetch = vi.fn(async (url, opts) => {
      seen.push({ url: String(url), opts });
      return { ok: true, json: async () => ({ success: true }) };
    });

    await logoutReferrer();

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toContain('/api/logout');
    expect(seen[0].opts.method).toBe('POST');
    // Without the token the server cannot name the row to delete, which would
    // reduce this to the pre-Phase-4 client-only logout.
    expect(seen[0].opts.headers.Authorization).toBe('Bearer tok-to-kill');
    expect(getReferrerToken()).toBeNull();
  });

  it('clears the local token even when the network call FAILS', async () => {
    setAdminToken('tok-a');
    global.fetch = vi.fn(async () => { throw new Error('offline'); });

    await expect(logoutAdmin()).resolves.toBeUndefined();

    // Leaving the token behind because a request timed out is the worse of the
    // two failures — the user pressed log out.
    expect(getAdminToken()).toBeNull();
  });

  it('makes no request when there is no token to revoke', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));

    await logoutReferrer();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('fetchSession — every failure is the same answer', () => {
  it('returns the session descriptor on 200', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ role: 'referrer', name: 'Dana' }) }));

    await expect(fetchSession('tok')).resolves.toEqual({ role: 'referrer', name: 'Dana' });
  });

  it('returns null on 401, on a thrown network error, and on no token', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(fetchSession('tok')).resolves.toBeNull();

    global.fetch = vi.fn(async () => { throw new Error('offline'); });
    await expect(fetchSession('tok')).resolves.toBeNull();

    global.fetch = vi.fn();
    await expect(fetchSession(null)).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
