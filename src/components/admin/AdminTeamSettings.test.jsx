// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3a PHASE 2B — REP-PROMOTION DRAWER (FRONTEND)
//
// WHAT THIS SUITE PINS. Phase 2A made POST /api/admin/team/:id/promote the single
// writer of the three rep flags and made PATCH /api/admin/team/:id REJECT a body
// carrying is_attributable (422). The drawer was left wired to the old contract:
// it renders one Attributable toggle, gated on the SAVED member record, and ships
// is_attributable inside the PATCH body — so today, flipping that toggle and
// pressing Save produces a red banner reading "is_attributable is no longer
// writable here". This suite describes the drawer that closes that gap.
//
// THE COHERENCE RULE IS THE POINT. Every rep ability requires is_field_rep. The
// server enforces it on the MERGED state and cascades both dependents off on a
// demotion; the DB CHECK backstops it. The drawer's job is to make an incoherent
// state UNREPRESENTABLE IN THE UNSAVED EDIT — the dependent toggles read the
// drawer's live local state, never the saved record, so an admin can never be
// looking at "Field Rep off, Attributable on" and press Save. Tests 1–3 are that
// rule, expressed as three things the user can actually do.
//
// ── CONVENTION ───────────────────────────────────────────────────────────────
// jsdom + @testing-library/react under Vitest, mirroring CompanyDetailsSettings
// .test.jsx. `fetch` is the ONLY thing replaced, at the true external boundary:
// the component, the real PermissionGate chain, the drawer's local state and its
// save path all run for real. Assertions read either the rendered DOM or THE
// REQUEST THE COMPONENT CHOSE TO SEND — never the mock itself.
//
// MemberEditDrawer is not exported. Mounting the real AdminTeamSettings and
// opening the drawer through the roster's pencil button is deliberate: it also
// exercises the permission gating end to end, which a direct drawer render could
// not do.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminTeamSettings from './AdminTeamSettings';
import { AdminPermissionsContext } from '../../hooks/useAdminPermissions';

const TEAM_URL    = '/api/admin/team';
const TITLES_URL  = '/api/admin/titles';
const FLAGS_URL   = '/api/admin/team/flagged-assignments';
const JOBBER_URL  = '/api/admin/jobber-users';
const MEMBER_ID   = 11;

// Accessible names of the three rep switches. Queried by role+name rather than by
// walking the DOM from a label, so a layout change cannot silently retarget a test
// at the wrong control.
const FIELD_REP   = 'Field rep';
const ATTRIBUTABLE = 'Attributable';
const REVENUE     = 'Revenue visibility';

// Mirrors a real GET /api/admin/team row (team.js:31-40) rather than only the
// fields these tests read — a partial fixture passes here and breaks in
// integration the moment the drawer reads a field the fixture omitted.
function memberRow(overrides = {}) {
  return {
    id: MEMBER_ID,
    email: 'riley@fixture.test.invalid',
    full_name: 'Riley Rep',
    tier: 'general',
    permissions: {},
    is_field_rep: false,
    is_attributable: false,
    rep_revenue_visibility: false,
    active: true,
    last_login_at: '2026-08-01T12:00:00.000Z',
    title_id: null,
    jobber_user_id: null,
    title_name: null,
    invite_pending: false,
    ...overrides,
  };
}

let calls;

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// URL matching is ORDER-SENSITIVE and the order below is load-bearing: both
// '/api/admin/team/flagged-assignments' and '/api/admin/team/11/promote' contain
// '/api/admin/team', so every specific branch must be tested before the roster
// branch. An unmodelled URL throws rather than resolving to undefined — a silent
// `await r.json()` on a stub surfaces three steps later as a confusing render
// failure.
function installFetch({ member = memberRow() } = {}) {
  calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    calls.push({ url: u, method, body: opts.body });

    if (u.includes(FLAGS_URL))  return jsonResponse({ flags: [] });
    if (u.includes(JOBBER_URL)) return jsonResponse({ users: [], totalCount: 0 });
    if (u.includes(TITLES_URL)) return jsonResponse([]);
    if (u.includes('/promote')) return jsonResponse({ id: MEMBER_ID, ...member });
    if (u.includes('/permissions')) return jsonResponse({ success: true });
    if (u.includes(TEAM_URL) && method === 'PATCH') {
      // The real Phase 2A contract: a PATCH carrying is_attributable is rejected
      // outright. Modelled so a drawer that regresses to the old wiring fails here
      // the same way it fails in production, instead of quietly going green.
      if (String(opts.body || '').includes('is_attributable')) {
        return jsonResponse({ error: 'is_attributable is no longer writable here — use POST /api/admin/team/:id/promote' }, 422);
      }
      return jsonResponse({ id: MEMBER_ID });
    }
    if (u.includes(TEAM_URL)) return jsonResponse([member]);

    throw new Error(`unexpected fetch to ${u} — the fixture does not model this call`);
  });
}

function callsTo(fragment, method) {
  return calls.filter(c => c.url.includes(fragment) && (!method || c.method === method));
}

// Mounts the roster with a given acting admin and opens the edit drawer.
// `viewer` is the AdminPermissionsContext value — the same shape AdminApp provides.
async function openDrawer({ member, viewer } = {}) {
  installFetch({ member });
  sessionStorage.setItem('rb_admin_token', 'test-admin-token');
  const value = viewer || { tier: 'owner', permissions: {}, loading: false, full_name: 'Owner', email: 'o@t.invalid' };
  render(
    <AdminPermissionsContext.Provider value={value}>
      <AdminTeamSettings />
    </AdminPermissionsContext.Provider>
  );
  // The roster renders a spinner until GET /api/admin/team resolves.
  const editBtn = await screen.findByTitle('Edit member');
  fireEvent.click(editBtn);
  // "Identity" is the drawer's first section header — the precondition for
  // every query below.
  await screen.findByText('Identity');
}

function repSwitch(name) {
  return screen.getByRole('button', { name });
}

function queryRepSwitch(name) {
  return screen.queryByRole('button', { name });
}

async function save() {
  fireEvent.click(screen.getByText('Save Changes'));
  await waitFor(() => expect(callsTo('/permissions', 'POST').length).toBeGreaterThan(0));
}

afterEach(() => {
  sessionStorage.clear();
  delete global.fetch;
});

describe('MemberEditDrawer — rep promotion area', () => {

  it('[RED] Field Rep OFF: the promotion area shows the Field Rep switch and NEITHER dependent toggle', async () => {
    // Today there is no Field Rep switch at all — the whole card is gated on
    // member.is_field_rep, so a non-rep's drawer has no promotion controls.
    // The first assertion is what makes this test non-vacuous: without it,
    // "no dependent toggles" would be satisfied by a drawer that renders nothing.
    await openDrawer({ member: memberRow({ is_field_rep: false }) });

    expect(repSwitch(FIELD_REP)).toBeInTheDocument();
    expect(repSwitch(FIELD_REP)).toHaveAttribute('aria-pressed', 'false');

    expect(queryRepSwitch(ATTRIBUTABLE)).toBeNull();
    expect(queryRepSwitch(REVENUE)).toBeNull();
  });

  it('[RED] toggling Field Rep ON (unsaved) reveals both dependents, defaulted OFF', async () => {
    // Driven by LOCAL state: nothing has been saved and the member record still
    // says is_field_rep=false, so a drawer that reads the saved record here shows
    // nothing. Both dependents must appear, and both must start false — inheriting
    // a stale true from anywhere would be an incoherent unsaved state.
    await openDrawer({ member: memberRow({ is_field_rep: false }) });

    fireEvent.click(repSwitch(FIELD_REP));

    expect(repSwitch(FIELD_REP)).toHaveAttribute('aria-pressed', 'true');
    expect(repSwitch(ATTRIBUTABLE)).toHaveAttribute('aria-pressed', 'false');
    expect(repSwitch(REVENUE)).toHaveAttribute('aria-pressed', 'false');
  });

  it('[RED] toggling Field Rep OFF hides the dependents AND resets them to false', async () => {
    // THE COHERENCE TEST. Enable a dependent, then demote. Hiding alone is not
    // enough: if the local values survive behind the hidden controls, re-promoting
    // resurrects an ability the admin never re-granted, and a save would ship it.
    // Re-enabling Field Rep is how we read the state the user cannot see.
    await openDrawer({ member: memberRow({ is_field_rep: false }) });

    fireEvent.click(repSwitch(FIELD_REP));
    fireEvent.click(repSwitch(ATTRIBUTABLE));
    fireEvent.click(repSwitch(REVENUE));
    expect(repSwitch(ATTRIBUTABLE)).toHaveAttribute('aria-pressed', 'true');
    expect(repSwitch(REVENUE)).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(repSwitch(FIELD_REP));
    expect(queryRepSwitch(ATTRIBUTABLE)).toBeNull();
    expect(queryRepSwitch(REVENUE)).toBeNull();

    fireEvent.click(repSwitch(FIELD_REP));
    expect(repSwitch(ATTRIBUTABLE)).toHaveAttribute('aria-pressed', 'false');
    expect(repSwitch(REVENUE)).toHaveAttribute('aria-pressed', 'false');
  });

  it('[RED] saving sends the rep flags to POST /:id/promote, never to PATCH', async () => {
    // The Phase 2A contract, from the client side. The member is ALREADY a field
    // rep so the drawer's current Attributable toggle exists — today flipping it
    // puts is_attributable in the PATCH body, the fixture 422s exactly as
    // production does, and no promote call is ever made.
    await openDrawer({ member: memberRow({ is_field_rep: true }) });

    fireEvent.click(repSwitch(ATTRIBUTABLE));
    await save();

    const promotes = callsTo('/promote', 'POST');
    expect(promotes.length).toBe(1);
    expect(JSON.parse(promotes[0].body).is_attributable).toBe(true);

    // The negative half is the point of the test, not a bonus: a drawer that calls
    // promote AND still ships is_attributable on the PATCH would fail the save with
    // a 422 while looking correct in the promote assertion above.
    for (const c of callsTo(TEAM_URL, 'PATCH')) {
      expect(String(c.body || '')).not.toContain('is_attributable');
    }
    expect(screen.queryByText(/no longer writable here/)).toBeNull();
  });

  it('[RED] an admin without rep_promotion sees the area locked, not interactive', async () => {
    // team.manage is deliberately NOT sufficient — promotion has its own flag
    // server-side (403), and the UI must fail closed the same way rather than
    // offering a control that always errors. The softLocked two-layer treatment:
    // disabled control + LockedSection tooltip.
    await openDrawer({
      member: memberRow({ is_field_rep: false }),
      viewer: {
        tier: 'admin',
        permissions: { team: true, 'team.manage': true },
        loading: false, full_name: 'Marketing Admin', email: 'm@t.invalid',
      },
    });

    const fieldRep = repSwitch(FIELD_REP);
    expect(fieldRep).toBeDisabled();
    expect(screen.getByTitle('Requires rep promotion permission.')).toBeInTheDocument();

    // Non-vacuity for "not interactive": jsdom's fireEvent does not honour CSS
    // pointer-events, so the disabled attribute is what actually has to hold.
    fireEvent.click(fieldRep);
    expect(queryRepSwitch(ATTRIBUTABLE)).toBeNull();
  });

  it('[RED] Revenue Visibility copy scopes the grant to the rep\'s OWN performance', async () => {
    // This control decides what a field rep can see about money. The copy must say
    // "their own" and must not imply team- or company-wide visibility — an admin
    // who misreads this grants the wrong thing and nothing downstream corrects them.
    await openDrawer({ member: memberRow({ is_field_rep: true }) });

    const copy = screen.getByText(/own performance/i);
    expect(copy).toBeInTheDocument();
    expect(copy.textContent).toMatch(/never the team's or the company's/i);
  });
});
