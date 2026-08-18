// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PANEL BRAND RETIREMENT — PHASE 1, DECISION D-K
//
// THE `/rm-control` CLIENT ROUTES ARE GATED BEHIND `VITE_ENABLE_RM_CONTROL`,
// DEFAULT OFF.
//
// What is being gated, precisely: a WORKING login form (`SuperAdminLoginScreen`,
// 188 lines, POSTing to `/api/rm-control/login`) sitting behind an EMPTY
// placeholder shell. Before this gate it was reachable by unconditional pathname
// match at App.jsx, above the boot gate and above `surfaceFor()` — so typing the
// path rendered the form for anyone, authenticated or not.
//
// ⚠ WHY THAT MATTERS RATHER THAN BEING MERELY UNTIDY. The account IS seeded
// (one row, created 2026-06-21), so the credential is live. And the role it mints
// carries a real cross-tenant bypass: `server/middleware/permissions.js:47-51`
// returns `next()` for `role='super_admin'` on EVERY gated route, including
// `cashout_approve` and the Stripe transfer endpoints.
//
// That bypass is latent rather than live only because all 130 `requirePermission`
// routes independently call `verifyAdminSession()`, which filters `role='admin'`
// — an invariant held by repetition across 130 call sites, not by structure.
// Obscurity was the only control on the door itself. This makes the control
// explicit and fail-closed. See D-K.
//
// The SERVER route is deliberately untouched: it is rate-limited (5/15min) and
// enumeration-safe, and nothing is lost by leaving it — the shell makes zero API
// calls.
//
// ── HOW THE FLAG IS TESTED, AND WHY THIS WAY ────────────────────────────────
// `import.meta.env` is inlined by Vite at build time, so the usual worry is that
// it cannot be driven from a test. It CAN here: `vi.stubEnv` reaches
// `import.meta.env` under this repo's Vitest 4 setup — verified empirically with
// a throwaway probe before this file was written, not assumed.
//
// So the gate is exercised END TO END against the real `import.meta.env`, with no
// module mocking and no `vi.resetModules()` gymnastics. That is why
// `isRmControlEnabled()` reads the variable AT CALL TIME rather than caching it
// into a module-level const: a const would force this file to re-import the whole
// App module graph to change one value, which risks two React instances and tests
// the reloading machinery instead of the gate. The value is build-time constant
// in production, so a per-render property read costs nothing and buys a test that
// drives the actual production code path.
//
// ⚠ BOTH DIRECTIONS ARE ASSERTED. A gate proven only in the OFF direction would
// pass just as happily if it were welded shut, and a permanently-off gate is a
// silently deleted feature. The ON direction is what distinguishes "gated" from
// "removed" — and it is the half that Step 4's guard-proof breaks deliberately to
// confirm this file can actually go red.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { CONTROL_TOKEN_KEY } from '../../utils/authStorage';
import { isFlagEnabled, isRmControlEnabled } from '../../config/featureFlags';

const FLAG = 'VITE_ENABLE_RM_CONTROL';

// Identifying text, one per surface. Keyed on headings rather than on the "Sign
// In" button, which BOTH the super-admin form and the unified door render.
const PLATFORM_ADMIN_HEADING = /Platform Admin/i;      // SuperAdminLoginScreen
const SHELL_HEADING          = /Super Admin — Logged In/i; // SuperAdminShell
const UNIFIED_DOOR_FIELD     = /email address/i;       // LoginScreen

function installFetch() {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/session')) {
      return { ok: false, status: 401, json: async () => ({ error: 'Not authorized' }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

const goTo = (pathname) => window.history.replaceState({}, '', pathname);

beforeEach(() => {
  localStorage.clear();
  installFetch();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete global.fetch;
  localStorage.clear();
  goTo('/');
});

// ── THE PARSE RULE, TESTED DIRECTLY ─────────────────────────────────────────
//
// Separate from the routing tests on purpose. The routing tests prove App
// CONSULTS the flag; these prove the flag MEANS the right thing — and the second
// is where the real risk lives, because Vite inlines every VITE_* value as a
// STRING and both 'false' and '0' are truthy strings in JavaScript.
describe('Phase 1 / D-K — isFlagEnabled fails closed', () => {

  for (const raw of ['true', 'TRUE', '1', 'yes', 'on', '  true  ']) {
    it(`${JSON.stringify(raw)} reads as ON`, () => {
      expect(isFlagEnabled(raw)).toBe(true);
    });
  }

  // The first two are the ones a bare truthiness check gets wrong. `undefined` is
  // what an unset variable actually yields. The last is the typo case the
  // allow-list exists for — a deny-list would read 'flase' as ON.
  for (const raw of [undefined, null, '', '   ', 'false', 'FALSE', '0', 'off', 'no', 'flase', 'enabled', 0, 1, true]) {
    it(`${JSON.stringify(raw)} reads as OFF`, () => {
      expect(isFlagEnabled(raw)).toBe(false);
    });
  }

  // Binds the parser to the variable it actually governs. Without this the two
  // could drift — a correct parser wired to the wrong env key would satisfy every
  // other test in this file's parse block.
  it('isRmControlEnabled reads VITE_ENABLE_RM_CONTROL specifically', () => {
    // ⚠ THE ABSENT STATE IS STUBBED, NOT ASSUMED — see the note above the
    // closed-gate block below for the false-red this prevents.
    vi.stubEnv(FLAG, undefined);
    expect(isRmControlEnabled()).toBe(false);
    vi.stubEnv(FLAG, 'true');
    expect(isRmControlEnabled()).toBe(true);
    vi.stubEnv(FLAG, 'false');
    expect(isRmControlEnabled()).toBe(false);
  });
});

describe('Phase 1 / D-K — /rm-control is gated OFF by default', () => {

  // The default-off case is the one that matters most: an absent variable is what
  // production has today.
  //
  // ⚠ THE ABSENT STATE IS NOW STUBBED EXPLICITLY — `vi.stubEnv(FLAG, undefined)` —
  // RATHER THAN INHERITED FROM THE AMBIENT ENVIRONMENT. That is the whole of this
  // hardening and it changes no assertion; only HOW the absent state is established.
  //
  // WHAT IT PREVENTS. These cases used to assert the absent behaviour while doing
  // nothing to establish absence, so their real premise was "no developer's .env
  // sets VITE_ENABLE_RM_CONTROL." Vitest loads .env through Vite, so the moment
  // that line exists locally — and it is the DOCUMENTED way to reach /rm-control
  // for a browser check — `import.meta.env` carried 'true' and three tests went
  // red on a change that touched none of this. A correct change, a red gate.
  //
  // WHY THAT MATTERS MORE THAN THE THREE TESTS. An unstated environmental
  // assumption in a test is a false-red generator, and a gate that cries wolf
  // stops being a gate — the next red gets waved through as "probably the env
  // again." Every POSITIVE case in this file already stubbed explicitly; only the
  // absent case leaned on ambient state, and that inconsistency was the defect.
  //
  // ⚠ ASSERTION ORDER IS DELIBERATE IN ALL THREE CLOSED-GATE CASES.
  //
  // The gated surfaces render SYNCHRONOUSLY from App's pathname branch — it is an
  // early return with nothing awaited — so their absence is assertable on the
  // first frame, and asserting it FIRST is what makes the failure message name
  // the actual defect. Waiting for the unified door first inverts that: the run
  // dies on "Unable to find a label with the text of: /email address/i", which is
  // true but describes the consequence rather than the cause.
  //
  // The unified-door assertion still runs, second, and it is the NON-VACUITY
  // half: without it a crashed render, an ErrorBoundary, or an empty tree would
  // satisfy every absence check above while proving nothing.
  it('[RED] with the flag ABSENT, /rm-control/login does not render the super-admin form', async () => {
    vi.stubEnv(FLAG, undefined);
    goTo('/rm-control/login');
    render(<App />);

    expect(screen.queryByText(PLATFORM_ADMIN_HEADING),
      'the super-admin login form rendered with VITE_ENABLE_RM_CONTROL unset — the gate is open by default'
    ).toBeNull();
    await waitFor(() => expect(screen.getByLabelText(UNIFIED_DOOR_FIELD)).toBeTruthy());
  });

  it('[RED] with the flag ABSENT, /rm-control does not render the super-admin shell', async () => {
    vi.stubEnv(FLAG, undefined);
    localStorage.setItem(CONTROL_TOKEN_KEY, 'probe-token');
    goTo('/rm-control');
    render(<App />);

    expect(screen.queryByText(SHELL_HEADING),
      'the super-admin shell rendered with VITE_ENABLE_RM_CONTROL unset — the gate is open by default'
    ).toBeNull();
    await waitFor(() => expect(screen.getByLabelText(UNIFIED_DOOR_FIELD)).toBeTruthy());
  });

  // Fail-closed: every one of these must read as OFF. 'false' and '0' are the two
  // that a naive truthiness check gets wrong — both are non-empty strings.
  for (const value of ['', 'false', '0', 'FALSE', 'off', 'no']) {
    it(`[RED] with the flag set to ${JSON.stringify(value)}, /rm-control/login stays closed`, async () => {
      vi.stubEnv(FLAG, value);
      goTo('/rm-control/login');
      render(<App />);

      expect(screen.queryByText(PLATFORM_ADMIN_HEADING),
        `${JSON.stringify(value)} enabled the gate — it must fail closed`
      ).toBeNull();
      await waitFor(() => expect(screen.getByLabelText(UNIFIED_DOOR_FIELD)).toBeTruthy());
    });
  }
});

describe('Phase 1 / D-K — the gate OPENS when explicitly enabled', () => {

  // ⚠ WITHOUT THIS BLOCK THE GATE IS UNPROVEN. A gate stuck permanently off
  // satisfies every assertion above.
  it('with the flag set to "true", /rm-control/login renders the super-admin form', async () => {
    vi.stubEnv(FLAG, 'true');
    goTo('/rm-control/login');
    render(<App />);

    await waitFor(() => expect(screen.getByText(PLATFORM_ADMIN_HEADING)).toBeTruthy());
    expect(screen.queryByLabelText(UNIFIED_DOOR_FIELD),
      'the unified door rendered instead of the super-admin form with the flag ON'
    ).toBeNull();
  });

  it('with the flag set to "true", /rm-control renders the super-admin shell', async () => {
    // The token keeps SuperAdminShell's useEffect from redirecting to the login
    // path, which in jsdom is an unimplemented navigation rather than a route change.
    localStorage.setItem(CONTROL_TOKEN_KEY, 'probe-token');
    vi.stubEnv(FLAG, 'true');
    goTo('/rm-control');
    render(<App />);

    await waitFor(() => expect(screen.getByText(SHELL_HEADING)).toBeTruthy());
  });

  it('with the flag set to "1", /rm-control/login renders the super-admin form', async () => {
    vi.stubEnv(FLAG, '1');
    goTo('/rm-control/login');
    render(<App />);

    await waitFor(() => expect(screen.getByText(PLATFORM_ADMIN_HEADING)).toBeTruthy());
  });
});

describe('Phase 1 — the other pre-provider early-return routes are undisturbed', () => {

  // REGRESSION GUARD, NOT A RED TEST. These four sit in the SAME early-return
  // block the gate edits (App.jsx:368-374), above the boot gate and outside
  // ThemeProvider. They pass before and after; what they pin is that adding a
  // condition to two lines of that block did not disturb the other four, reorder
  // them, or move them below the boot gate — where a stored token would start
  // deciding whether a legal page renders.
  //
  // The legal pages are out of scope for this session (D-F, blocked on the LLC
  // amendment). That is exactly why they need a guard: they are being read past,
  // repeatedly, by a session editing the lines next to them.
  // ⚠ QUERIED AS THE LEVEL-1 HEADING, NOT AS TEXT. `getByText(/Privacy Policy/i)`
  // matched TWO nodes on /privacy — the page's own <h1> and the footer link that
  // every legal page carries to the others — and failed with "Found multiple
  // elements" rather than proving anything. The heading role pins the page's
  // identity; a cross-link cannot satisfy it.
  const ROUTES = [
    ['/privacy',          /^Privacy Policy$/i],
    ['/terms',            /Terms of Service/i],
    ['/contractor-terms', /Contractor Terms of Service/i],
    // With no ?token= the preferences page resolves to its invalid state
    // immediately, with no network round trip — deterministic in jsdom.
    ['/email-preferences', /Link expired or invalid/i],
  ];

  const expectPage = async (heading) => {
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy()
    );
  };

  for (const [pathname, heading] of ROUTES) {
    it(`${pathname} still renders outside the provider, flag unset`, async () => {
      goTo(pathname);
      render(<App />);
      await expectPage(heading);
    });
  }

  for (const [pathname, heading] of ROUTES) {
    it(`${pathname} still renders with the rm-control flag ON`, async () => {
      vi.stubEnv(FLAG, 'true');
      goTo(pathname);
      render(<App />);
      await expectPage(heading);
    });
  }
});
