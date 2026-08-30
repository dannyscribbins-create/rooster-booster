// ─────────────────────────────────────────────────────────────────────────────
// WAVE 1.1-g — ?reset= OUTRANKS SESSION-BASED ROUTING
//
// ⚠ THIS FILE SHIPPED GREEN AND WORTHLESS, AND THE REPAIR IS THE POINT.
//
// Its first version was named "the admin surface never intercepts", stored
// ADMIN_TOKEN_KEY, and asserted the reset screen rendered. It passed. It was
// measuring nothing: installFetch() returned 401 for /api/session
// unconditionally, so fetchSession() resolved null, `session` stayed null,
// surfaceFor(null) === 'login', and the admin branch it claimed to test was
// never reached. THE FILE DROVE THE NO-SESSION PATH THREE TIMES UNDER THREE
// DIFFERENT NAMES — and four days later a team member clicked a reset link
// while logged in and landed in the admin panel.
//
// ⚠ THE VACUITY SHAPE: A FIXTURE THAT ESTABLISHES A PRECONDITION'S PROXY
// RATHER THAN THE PRECONDITION. A stored token is not a session. The token is
// an INPUT to boot rehydration; `session` is what src/App.jsx's admin branch
// actually reads. Setting the token and asserting the outcome looks like the
// real test and excludes the only state that matters.
//
// It is worse than having written nothing, because the NAME occupied the space
// where real coverage would have gone — the next reader sees "the admin surface
// never intercepts" in the file list and stops looking.
//
// ⚠ THE GENERAL RULE, WHICH IS WHY THIS COMMENT IS LONG: when a test asserts
// behaviour under condition X, ASSERT THAT X HOLDS INSIDE THE TEST — do not set
// up something correlated with X and trust the wiring. Here that is done
// structurally: the admin-session tests come in PAIRS sharing one fixture, and
// the sibling without ?reset= renders the panel. That sibling IS the proof the
// session is admin-surface, because it observes the consequence rather than
// asserting the setup.
//
// ── THE DEFECT ──────────────────────────────────────────────────────────────
// src/App.jsx's chain is a flat sequence of early returns, and renderThemedRoute()
// is DECLARED near the bottom but CALLED five returns down. `?reset=` was read at
// the top and consumed inside that function — below
// `if (surfaceFor(session) === 'admin') return <AdminPanel …>`. So an
// admin-surface session short-circuited the reset branch entirely.
//
// ⚠ IT IS admin-ONLY, AND THAT IS WHY IT SURVIVED. 'referrer' and 'rep' sessions
// fall through to renderThemedRoute(), where the reset branch is genuinely first
// — so the referrer reset path has always worked. Wave 1.1-g made
// admin-session + ?reset= co-occur for the first time in the product's history.
// The branch did not change and its meaning did not change; a state that had
// never arrived, arrived.
//
// ── WHAT THE FIX DOES NOT DO ────────────────────────────────────────────────
// It does not touch the existing session. Clearing on arrival would mean either
// destroying a session the person may still want if they abandon the reset, or a
// client-only clear — which is exactly the defect D6 was raised to eliminate,
// reintroduced through a side door. Invalidating sessions on a COMPLETED reset is
// filed against the 2FA build, server-side, where it belongs. The non-mutation is
// asserted below so a later reader does not "fix" the untouched session.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { REFERRER_TOKEN_KEY, ADMIN_TOKEN_KEY } from '../../utils/authStorage';
import { ADMIN_STATS_ZEROS, FLAGGED_SUMMARY_ZERO } from '../../__fixtures__/adminStats';

const RESET_TOKEN = 'b'.repeat(64);

// ── SURFACE MARKERS ─────────────────────────────────────────────────────────
// ⚠ ANCHORED ON THE TAG AS WELL AS THE WORDS. The first version of the reset
// marker was /Set a New Password|Reset your password|New password/i, which
// matched BOTH the <h2> and the "New password" <label> beneath it — queryByText
// throws on multiple matches, so every positive test failed while the screen
// rendered perfectly. Same family as the needle that matched
// AdminSetPasswordScreen.jsx instead of Screen.jsx: the assertion's edge lands
// exactly where the ambiguity lives.
const resetScreen = () => screen.queryByText(/^Set a new password$/i, { selector: 'h2' });
const adminPanel  = () => screen.queryByText(/Missing Referrals/i);
const referrerApp = () => screen.queryByText(/Available Balance/i);
const unifiedDoor = () => screen.queryByText(/Welcome back/i);

const ADMIN_SESSION = { role: 'team', contractorId: 'tnt-reset', tier: 'admin', is_field_rep: false };
const REFERRER_SESSION = {
  role: 'referrer', contractorId: 'tnt-reset',
  name: 'Dana Referrer', email: 'dana@reset.test',
};

// Records every URL the app requests, so a test can assert what was NOT called.
let requested = [];

// Answers everything App and either surface can ask for on boot. Only
// /api/session is interesting; the rest exist so the tree can finish rendering
// without an unrelated rejection failing a routing assertion.
//
// ⚠ PASSING A SESSION HERE IS THE ENTIRE REPAIR. The previous version had no
// parameter and always answered 401.
function installFetch(session) {
  requested = [];
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    requested.push(u);
    if (u.includes('/api/session')) {
      if (!session) return { ok: false, status: 401, json: async () => ({ error: 'Not authorized' }) };
      return { ok: true, status: 200, json: async () => session };
    }
    if (u.includes('/api/pipeline')) {
      return { ok: true, status: 200, json: async () => ({ pipeline: [], balance: 0, paidCount: 0 }) };
    }
    if (u.includes('/api/admin/me')) {
      return { ok: true, status: 200, json: async () => ({ tier: session?.tier ?? null, permissions: {} }) };
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

function setUrl(search) {
  window.history.replaceState({}, '', `/${search}`);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setUrl('');
});

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
  sessionStorage.clear();
  setUrl('');
});

describe('Wave 1.1-g — ?reset= resolves before session-based routing', () => {

  // ══ THE PAIR. One fixture, two URLs. ═══════════════════════════════════════
  // Read these two together: the second is the precondition proof for the first.

  it('POSITIVE CONTROL / PRECONDITION — this exact session renders the ADMIN PANEL without ?reset=', async () => {
    // ⚠ ORDERED FIRST DELIBERATELY. This is what makes the next test mean
    // something. It proves the fixture produces a session that surfaceFor()
    // routes to 'admin' — observed through its consequence rather than asserted
    // about the setup, which is precisely what the previous version of this file
    // failed to do. If this goes red, the test below is measuring nothing and
    // must not be believed.
    //
    // It is ALSO the control against a fix that renders ResetPinScreen
    // unconditionally: such a fix passes the reset assertions and breaks the app.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(ADMIN_SESSION);

    render(<App />);

    await waitFor(() => expect(adminPanel()).toBeTruthy());
    expect(resetScreen()).toBeNull();
  });

  it('[RED] an ADMIN-surface session + ?reset= renders the RESET SCREEN, not the panel', async () => {
    // 🔴 THE PRODUCTION DEFECT, REPRODUCED. Same fixture as the test above — the
    // only difference is the query string.
    //
    // RECORDED RED: the admin panel renders and resetScreen() is null. The token
    // is never spent; pin_reset_tokens.used_at stays NULL, which is exactly what
    // production showed on token id 6.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(ADMIN_SESSION);
    setUrl(`?reset=${RESET_TOKEN}`);

    render(<App />);

    await waitFor(() => expect(resetScreen()).toBeTruthy());
    // ABSENCE, not merely presence. A chain that rendered both would satisfy a
    // presence-only assertion while still handing a logged-in person the panel.
    expect(adminPanel()).toBeNull();
    expect(referrerApp()).toBeNull();
  });

  it('[RED] the reset screen does NOT consume or mutate the existing session', async () => {
    // ⚠ THE RULING IS "LEAVE IT ALONE", AND IT IS ASSERTED SO NOBODY "FIXES" IT.
    // Clearing on arrival would be either a server-side logout destroying a
    // session the person may still want if they abandon the reset, or a
    // client-only clear — the exact defect D6 closed, through a side door.
    // Session invalidation belongs on a COMPLETED reset, server-side, and is
    // filed against the 2FA build.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(ADMIN_SESSION);
    setUrl(`?reset=${RESET_TOKEN}`);

    render(<App />);
    await waitFor(() => expect(resetScreen()).toBeTruthy());

    expect(localStorage.getItem(ADMIN_TOKEN_KEY)).toBe('team-token');
    expect(requested.some(u => u.includes('/api/logout'))).toBe(false);
  });

  it('a REFERRER-surface session + ?reset= renders the reset screen — the path that always worked', async () => {
    // GREEN BEFORE THE FIX, AND SAYING SO IS THE POINT. 'referrer' is not
    // intercepted by the admin branch, so this case fell through to the reset
    // branch and has been correct since Phase 5. It is the fence that catches a
    // fix which reorders the chain and breaks the half that was never broken.
    localStorage.setItem(REFERRER_TOKEN_KEY, 'referrer-token');
    installFetch(REFERRER_SESSION);
    setUrl(`?reset=${RESET_TOKEN}`);

    render(<App />);

    await waitFor(() => expect(resetScreen()).toBeTruthy());
    expect(referrerApp()).toBeNull();
  });

  it('no session + ?reset= renders the reset screen — the regression fence', async () => {
    // Green throughout. This is the case the incognito test on production
    // exercised, and the one the original version of this file was accidentally
    // testing three times.
    installFetch(null);
    setUrl(`?reset=${RESET_TOKEN}`);

    render(<App />);

    await waitFor(() => expect(resetScreen()).toBeTruthy());
    expect(unifiedDoor()).toBeNull();
  });

  it('the reset screen is not reachable without the parameter — the marker is real', async () => {
    // ⚠ NON-VACUITY FOR THE MARKER ITSELF. Every assertion above queries the same
    // text. If it also appeared on the login screen, or matched something
    // incidental, all of them would pass against a router that ignored `?reset=`.
    installFetch(null);
    render(<App />);
    await waitFor(() => expect(unifiedDoor()).toBeTruthy());
    expect(resetScreen()).toBeNull();
  });
});
