// ─────────────────────────────────────────────────────────────────────────────
// WAVE 1.1-g — THE RESET SURFACE IS ROLE-BLIND, AND MUST STAY THAT WAY
//
// Wave 1.1-g gives team members credential recovery. It required NO frontend
// work, and this file is the fence that keeps that true.
//
// ⚠ THE PHASE WAS SCOPED EXPECTING A FRONTEND BUILD, AND THE PREMISE WAS A
// PRE-PHASE-5 MODEL OF THE APP. "A referrer resets in the referrer app; a team
// member logs into the admin panel" described the era when `?admin=true` chose a
// surface. C/DL-3b Phase 5 collapsed that into one door, and three properties
// fell out that together make the reset path serve every role already:
//
//   1. App.jsx reads `?reset=` and returns <ResetPinScreen> ABOVE the identity
//      branch. No role, session or tier is consulted on that path.
//   2. ResetPinScreen posts { token, pin } and knows nothing about the subject.
//      Its branding comes from the D4 host/slug chain, NEVER from the token —
//      so the screen discloses nothing about whose token it is holding. That is
//      a property to preserve, not a gap to fill.
//   3. After success it navigates to '/', the unified door, whose /api/login
//      already routes team members through gatherLoginCandidates + surfaceFor.
//
// So the live defect 1.1-g closes was the reverse of the expected one: the UI has
// OFFERED team members a forgot-password form since Phase 5, and the server
// silently discarded the request while answering "if that address is registered,
// a reset link is on its way." The fix was entirely server-side.
//
// ⚠ WHY A TEST FOR SOMETHING NOBODY IS CHANGING. Because "a rule applied once to
// a surface does not stay applied when the surface moves" (CLAUDE.md). If the
// door is ever re-split — a separate admin login, a role hint in the URL — the
// reset path would silently stop serving one of the two populations, and nothing
// in the server suite could see it. The server tests prove a team member's TOKEN
// works; only this proves they can reach the screen that spends it.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { REFERRER_TOKEN_KEY, ADMIN_TOKEN_KEY } from '../../utils/authStorage';

const RESET_TOKEN = 'b'.repeat(64);

// A stable, surface-unique marker. Queried by text rather than a test id so this
// breaks if the screen stops being recognisable to the person reading it.
//
// ⚠ ANCHORED ON THE HEADING ELEMENT, NOT ON THE PHRASE. The first version of this
// helper was /Set a New Password|Reset your password|New password/i, and it
// matched BOTH the <h2> and the "New password" <label> beneath it — queryByText
// throws on multiple matches, so all three positive tests failed while the screen
// was rendering perfectly. Same family as the needle that matched
// AdminSetPasswordScreen.jsx: the assertion's edge lands exactly where the
// ambiguity lives. The selector pins the tag as well as the words.
const resetScreen = () =>
  screen.queryByText(/^Set a new password$/i, { selector: 'h2' });
const unifiedDoor = () => screen.queryByText(/Welcome back/i);

function installFetch() {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    // 401 on session: nobody is logged in. The reset link is followed by a person
    // who by definition cannot authenticate — that is why they are here.
    if (u.includes('/api/session')) {
      return { ok: false, status: 401, json: async () => ({ error: 'Not authorized' }) };
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
  installFetch();
});

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
  sessionStorage.clear();
  setUrl('');
});

describe('Wave 1.1-g — the reset surface takes no role input', () => {

  it('?reset= renders the reset screen with no session of any kind', async () => {
    setUrl(`?reset=${RESET_TOKEN}`);
    render(<App />);
    await waitFor(() => expect(resetScreen()).toBeTruthy());
    expect(unifiedDoor()).toBeNull();
  });

  it('?reset= renders the SAME screen when a team token is stored — the admin surface never intercepts', async () => {
    // The one that would fail if the door were re-split. A stored team token is
    // what a team member following a reset link on their working machine actually
    // has; if the admin branch ever moved above the reset branch, this person
    // would be routed into the panel — or bounced to an admin login — and the
    // link they were emailed would stop working for exactly one population.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    setUrl(`?reset=${RESET_TOKEN}`);
    render(<App />);
    await waitFor(() => expect(resetScreen()).toBeTruthy());
  });

  it('?reset= renders the SAME screen when a referrer token is stored', async () => {
    // The positive control for the test above. Without it, "the team case reached
    // the reset screen" is satisfied by a router that sends EVERYTHING there, and
    // the assertion would be measuring nothing about role-blindness.
    localStorage.setItem(REFERRER_TOKEN_KEY, 'referrer-token');
    setUrl(`?reset=${RESET_TOKEN}`);
    render(<App />);
    await waitFor(() => expect(resetScreen()).toBeTruthy());
  });

  it('the reset screen is not reachable without the parameter — the marker is real', async () => {
    // ⚠ NON-VACUITY. The three assertions above all query for the same text. If
    // that text also appeared on the login screen — or if queryByText matched
    // something incidental — every one of them would pass against a router that
    // ignored `?reset=` entirely. This is what proves the marker distinguishes.
    render(<App />);
    await waitFor(() => expect(unifiedDoor()).toBeTruthy());
    expect(resetScreen()).toBeNull();
  });
});
