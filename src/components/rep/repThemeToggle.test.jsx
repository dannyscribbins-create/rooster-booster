// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c PHASE 3-A STEP 4 — RED SUITE — THE PROFILE THEME TOGGLE (CD-6, A30)
//
// THE THIRD MECHANISM-WITH-NO-CALLER THIS ARC HAS MET, AND THE ONE THAT CLOSES.
// setPreference() shipped in 3a with zero production callers. C/DL-3c Phase 1b
// gave it one on the SERVER — PUT /api/preferences/theme-mode — and shipped no
// client that calls it. This suite is the client half, and
// PRE_LAUNCH_CHECKLIST.md's theme-control entry is deleted in the same commit,
// because "we'll mount it next phase" is what was said the three previous times
// this shape decayed.
//
// ── ⚠ WHAT THE FAILURE CASES ARE FOR, AND WHY THEY ARE NOT PADDING ──────────
// The defect worth designing against is the OPTIMISTIC FLIP THAT SILENTLY
// REVERTS: a switch that moves, fails to save, and slides back with no
// explanation teaches a person the app is broken without telling them anything.
// So the control is written write-first — it does not move until the server has
// agreed — and these cases pin that BOTH halves hold: the control does not lie
// about the stored state, AND the person is told.
//
// ⚠ ASSERTING ONLY "THE CONTROL DID NOT MOVE" WOULD BE THE SAME MISTAKE STEP 2's
// PINNED CASE CAUGHT. A control that silently swallows the failure also does not
// move. The message assertion is what separates "refused and said so" from
// "did nothing", and that distinction is the whole point of these two cases.
//
// ── ⚠ REP-ONLY IS ENFORCED BY THE SERVER, AND THE CLIENT DOES NOT SECOND-GUESS
// CD-21 makes the preference user-level and SHARED; what is gated is who may SET
// it. PUT /api/preferences/theme-mode re-reads is_field_rep from team_members,
// scoped by contractor_id and active = true, on every call — deliberately, so a
// member demoted a minute ago cannot still write. This client sends the request
// and renders the answer. It does NOT check is_field_rep itself: a client-side
// copy of an authorisation decision is a second source of truth that goes stale,
// and the surface placement already scopes it — RepShell renders only under
// App's rep branch.
//
// EXPECTED RED TODAY: src/components/rep/RepThemeToggleRow.jsx does not exist,
// so the import fails and every case in this file reports it. ⚠ READ `suites`
// ALONGSIDE `tests` on the RED run — a module-load failure registers nothing,
// and the numbers move in FILE-sized jumps rather than by ones.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ThemeProvider from '../shared/ThemeProvider';
import RepThemeToggleRow from './RepThemeToggleRow';
import RepShell from './RepShell';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';

const themeRoot = () => document.querySelector('[data-rm-theme]');
const row = () => document.querySelector('[data-rep-theme-row]');
const control = () => document.querySelector('[data-rep-theme-switch]');
const signOut = () => document.querySelector('[data-rep-signout]');
const problem = () => document.querySelector('[data-rep-theme-error]');

const CONTEXT = { hostname: 'app.roofmiles.com', search: '', storage: null };

// One place that says what a successful/failed PUT looks like, so a case cannot
// accidentally test a differently-shaped stub from its neighbour.
function installFetch({ status = 200, body = null, throws = false } = {}) {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (throws) throw new Error('offline');
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body ?? { mode: JSON.parse(init?.body || '{}').mode },
    };
  };
  return calls;
}

// The row alone, inside a REAL provider with nothing pinned — so `setMode` is
// live and the rendered mode is the provider's answer rather than a prop the
// component was handed.
function mountRow({ fetchStoredMode = async () => null } = {}) {
  return render(
    <ThemeProvider context={CONTEXT} fetchStoredMode={fetchStoredMode}>
      <RepThemeToggleRow />
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(ADMIN_TOKEN_KEY, 'rep-token');
});

afterEach(() => { localStorage.clear(); delete global.fetch; });

describe('the Profile theme toggle — the happy path', () => {
  it('[RED] flipping the control PUTs the new mode and the rendered mode follows', async () => {
    // THE POSITIVE CONTROL, ORDERED FIRST. Every failure case below is satisfied
    // by a control that never works at all; this is the one that is not.
    const calls = installFetch({ status: 200 });
    mountRow();
    await waitFor(() => expect(control()).toBeTruthy());
    expect(themeRoot().dataset.rmTheme).toBe('light');
    expect(control().getAttribute('aria-checked')).toBe('false');

    fireEvent.click(control());

    // BOTH ENDS OF THE WIRE. The request is the half a render assertion cannot
    // see, and the rendered mode is the half a request assertion cannot see.
    await waitFor(() => expect(themeRoot().dataset.rmTheme).toBe('dark'));
    expect(control().getAttribute('aria-checked')).toBe('true');

    const put = calls.find(c => c.url.includes('/api/preferences/theme-mode'));
    expect(put, 'no request reached the preferences endpoint').toBeTruthy();
    expect(put.init.method).toBe('PUT');
    expect(JSON.parse(put.init.body)).toEqual({ mode: 'dark' });
  });

  it('[RED] presents the ADMIN token — a rep authenticates as a team member', async () => {
    // ⚠ NOT THE SAME CHOICE THE READER MAKES, AND THE ASYMMETRY IS DELIBERATE.
    // fetchThemeModeFromApi prefers the REFERRER token, because a dual-identity
    // person reading a preference is usually looking at the referrer app. The
    // WRITE is rep-only and a rep's session is a team session on the admin key,
    // so presenting the referrer token for someone who holds both would 403 a
    // control that should work.
    localStorage.setItem('rb_token', 'homeowner-token');
    const calls = installFetch({ status: 200 });
    mountRow();
    await waitFor(() => expect(control()).toBeTruthy());

    fireEvent.click(control());

    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const put = calls.find(c => c.url.includes('/api/preferences/theme-mode'));
    expect(put.init.headers.Authorization).toBe('Bearer rep-token');
  });

  it('[RED] flips back, so the control is a toggle rather than a one-way door', async () => {
    installFetch({ status: 200 });
    mountRow({ fetchStoredMode: async () => 'dark' });
    await waitFor(() => expect(themeRoot().dataset.rmTheme).toBe('dark'));
    expect(control().getAttribute('aria-checked')).toBe('true');

    fireEvent.click(control());

    await waitFor(() => expect(themeRoot().dataset.rmTheme).toBe('light'));
    expect(control().getAttribute('aria-checked')).toBe('false');
  });
});

describe('the Profile theme toggle — a failed write must not leave the control lying', () => {
  // ⚠ EACH CASE ASSERTS TWO THINGS AND NEEDS BOTH: the mode did not move, AND
  // the person was told. Either alone is satisfied by a control that swallows
  // the failure.
  const CASES = [
    ['403 — the rep flag was revoked between render and click', { status: 403 }],
    ['409 — the write matched no row for this tenant', { status: 409 }],
    ['a network failure', { throws: true }],
  ];

  it.each(CASES)('[RED] %s leaves the mode alone and says so', async (_name, cfg) => {
    installFetch(cfg);
    mountRow();
    await waitFor(() => expect(control()).toBeTruthy());
    expect(problem(), 'a problem was reported before anything was attempted').toBeNull();

    fireEvent.click(control());

    await waitFor(() => expect(problem()).toBeTruthy());
    expect(themeRoot().dataset.rmTheme, 'the theme changed despite the write failing').toBe('light');
    expect(control().getAttribute('aria-checked'), 'the control moved despite the write failing')
      .toBe('false');
    expect(problem().textContent.trim().length, 'the problem element is empty')
      .toBeGreaterThan(0);
  });

  it('[RED] a later SUCCESS clears the message, so it is not a permanent scar', async () => {
    // Without this the failure cases are satisfied by a component that renders
    // the message once and never removes it — which would tell a person their
    // working toggle is still broken.
    let cfg = { status: 403 };
    global.fetch = async (url, init) => {
      if (cfg.throws) throw new Error('offline');
      return { ok: cfg.status < 300, status: cfg.status, json: async () => JSON.parse(init.body) };
    };
    mountRow();
    await waitFor(() => expect(control()).toBeTruthy());

    fireEvent.click(control());
    await waitFor(() => expect(problem()).toBeTruthy());

    cfg = { status: 200 };
    fireEvent.click(control());

    await waitFor(() => expect(themeRoot().dataset.rmTheme).toBe('dark'));
    expect(problem(), 'the message survived a successful write').toBeNull();
  });
});

describe('the Profile theme toggle — placement (A30) and both modes', () => {
  it('[RED] sits DIRECTLY ABOVE Sign out on the Profile screen', async () => {
    // ⚠ A30's ANCHOR IS Sign out, NOT Security — Security is 3-C's and may not
    // ship at all, and "above Sign out" is the phrasing that survives its
    // absence. Asserted as DOM ORDER rather than by eye, and on the two
    // elements' own handles rather than on their copy.
    installFetch({ status: 200 });
    render(
      <ThemeProvider context={CONTEXT} fetchStoredMode={async () => null}>
        <RepShell onLogout={() => {}} />
      </ThemeProvider>
    );

    // Driving through the nav is fine HERE — this suite is about the shell's own
    // Profile screen. The ASSERTION anchors on the row and the button, never on
    // the nav.
    fireEvent.click(document.querySelector('[data-rep-tab="profile"]'));
    await waitFor(() => expect(signOut()).toBeTruthy());

    expect(row(), 'the theme row is not on the Profile screen').toBeTruthy();
    const position = row().compareDocumentPosition(signOut());
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING, 'Sign out does not follow the theme row')
      .toBeTruthy();

    // DIRECTLY above: nothing of ours between them. Guards against a later row
    // being inserted into the gap A30 names, which "somewhere above" would miss.
    let next = row().nextElementSibling;
    while (next && next.getAttribute('aria-hidden') === 'true') next = next.nextElementSibling;
    expect(next, 'something sits between the theme row and Sign out').toBe(signOut());
  });

  it('[RED] renders in BOTH modes and reports the mode it is in', async () => {
    // THE PAIR ON ONE MOUNT SHAPE. A dark-only assertion is satisfied by a
    // control that reports checked always; the light sibling is what makes the
    // dark one mean something.
    installFetch({ status: 200 });
    const light = mountRow({ fetchStoredMode: async () => null });
    await waitFor(() => expect(control()).toBeTruthy());
    expect(control().getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/dark mode/i)).toBeTruthy();
    light.unmount();

    mountRow({ fetchStoredMode: async () => 'dark' });
    await waitFor(() => expect(themeRoot().dataset.rmTheme).toBe('dark'));
    expect(control().getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/dark mode/i)).toBeTruthy();
  });

  it('[RED] is a real switch, not a div someone can only click', async () => {
    // Keyboard reachability and a name, asserted rather than assumed. The rep
    // app has no other control of this kind yet, so this is the precedent.
    installFetch({ status: 200 });
    mountRow();
    await waitFor(() => expect(control()).toBeTruthy());

    expect(control().tagName).toBe('BUTTON');
    expect(control().getAttribute('role')).toBe('switch');

    // ⚠ THIS ASSERTION WAS CHANGED AFTER THE IMPLEMENTATION LANDED, AND THE
    // REASON IS RECORDED RATHER THAN THE CHANGE BEING MADE QUIETLY. It first
    // read `aria-label || textContent`, and went red against a control that is
    // correctly labelled by `aria-labelledby` pointing at the visible "Dark
    // mode" text. The original enumerated two naming mechanisms and missed the
    // one that is RIGHT here: an aria-label would duplicate the visible string
    // into a second place that can drift from it, and a screen reader would
    // then announce something the screen does not say.
    //
    // ⚠ AND IT IS NOW STRONGER, NOT WEAKER. It RESOLVES the name — the
    // referenced element must exist and must carry text — so it fails against
    // an aria-labelledby pointing at a missing or empty id, which is the way
    // this attribute actually breaks. The production code was not touched.
    const labelledBy = control().getAttribute('aria-labelledby');
    const name = labelledBy
      ? document.getElementById(labelledBy)?.textContent
      : (control().getAttribute('aria-label') || control().textContent);
    expect(name, 'the switch has no resolvable accessible name').toBeTruthy();
    expect(name.trim()).toMatch(/dark mode/i);
  });
});
