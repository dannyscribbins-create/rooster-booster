// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c — PHASE 2b — RULING A(i): THE HONEST EMPTY STATE
//
// A non-Owner whose permissions JSONB grants nothing used to receive the whole
// admin panel with ELEVEN SCRIMMED SECTIONS and 8 guaranteed 403s. RBAC's
// requirement has always been that such a person receives no panel — "not a
// locked one" — and a page of locked boxes is a perfectly clear message that
// they are somewhere they do not belong, delivered in the least useful way.
//
// ── ⚠ THE CONDITION IS THREE THINGS TOGETHER, AND TWO OF THEM ARE TRAPS ─────
//
// 1. tier !== 'owner'. AN OWNER WITH permissions = {} IS FULLY PRIVILEGED —
//    requirePermission short-circuits on tier before the JSONB is read, and
//    there is no owner preset in the invite modal because Owners are seeded
//    rather than created. Getting this wrong shows the empty state to the most
//    privileged person in the tenant. Fenced below by a REAL CASE, not a comment.
//
// 2. ⚠ THE READ HAS RESOLVED. `EMPTY.permissions` in useAdminPermissions is `{}`
//    — THE IDENTICAL VALUE to a genuinely empty JSONB. So "this member has no
//    flags" and "no answer has arrived yet" are indistinguishable by permissions
//    alone, and a check written on permissions would flash the empty state at
//    EVERY admin on EVERY boot. The arrival marker is `tier`, which is null in
//    EMPTY and a string once /api/admin/me lands.
//    ⚠ THIS IS VACUITY SHAPE #10 IN A THIRD COSTUME — a default value that makes
//    an unresolved state indistinguishable from a real one — and it is the same
//    mechanism 2a's seam pair needed, for the same reason. It is also the marker
//    PermissionGate already uses (`if (loading || !tier) return denied`), so this
//    predicate agrees with the gate rather than inventing a second rule.
//
// 3. No flag true. ⚠ `false` IS NOT A GRANT and neither is a null JSONB — the
//    column is nullable and the invite path can leave it so.
//
// ── WHY A THREE-VALUED PREDICATE AND NOT A BOOLEAN ─────────────────────────
// 'resolving' | 'none' | 'granted'. A boolean would have to fold 'resolving'
// into one of the other two, and BOTH foldings ship a defect: fold it into
// 'none' and every admin sees the empty state flash; fold it into 'granted' and
// the eleven scrims come straight back for the one frame that matters least.
// Making it a state the caller must handle is what stops either happening by
// accident. Same argument the tri-state membership column gets in §8.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import App from '../../App';
import { adminPanelAccess } from '../../hooks/useAdminPermissions';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';
import { ADMIN_STATS_ZEROS, FLAGGED_SUMMARY_ZERO } from '../../__fixtures__/adminStats';

// ── SURFACE MARKERS ─────────────────────────────────────────────────────────
// The sections marker is a SIDEBAR NAV ITEM, the same one roleRouting.test.jsx
// uses to mean "the admin panel is on screen". Queried by human-visible text so
// the test breaks if the panel stops being recognisable to a person.
const sections   = () => screen.queryByText(/Missing Referrals/i);
const emptyState = () => screen.queryByText(/has not given you access to any sections/i);

const TEAM_SESSION = (tier, isFieldRep = false) => ({
  role: 'team', contractorId: 'tnt-access', tier, is_field_rep: isFieldRep, permissions: {},
});

// A never-settling promise, for the unresolved-read case. NOT a rejection and
// NOT a slow timer: the property under test is "no answer has arrived", and a
// rejection is an answer.
const NEVER = new Promise(() => {});

function installFetch({ session, me, hangMe = false }) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/session')) {
      return { ok: true, status: 200, json: async () => session };
    }
    if (u.includes('/api/admin/me')) {
      if (hangMe) return NEVER;
      return { ok: true, status: 200, json: async () => me };
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

const meBody = (tier, permissions) => ({
  email: 'member@access.test', full_name: 'Mem Ber', tier, permissions,
  title_id: null, is_field_rep: false, is_attributable: false, rep_revenue_visibility: false,
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

// ═══ THE PREDICATE, EXHAUSTIVELY ═════════════════════════════════════════════
describe('C/DL-3c Phase 2b — adminPanelAccess() is three-valued', () => {
  const CASES = [
    // [label,                                    input,                                        expected]
    ['no answer yet — tier is null',              { tier: null,      permissions: {} },          'resolving'],
    ['no answer yet — tier undefined',            { tier: undefined, permissions: {} },          'resolving'],
    ['an OWNER with an EMPTY JSONB is privileged', { tier: 'owner',   permissions: {} },          'granted'],
    ['an OWNER with a NULL JSONB is privileged',  { tier: 'owner',   permissions: null },        'granted'],
    ['admin tier, nothing granted',               { tier: 'admin',   permissions: {} },          'none'],
    ['general tier, nothing granted',             { tier: 'general', permissions: {} },          'none'],
    ['a NULL JSONB is not a grant',               { tier: 'admin',   permissions: null },        'none'],
    ['an explicit FALSE is not a grant',          { tier: 'admin',   permissions: { dashboard: false } }, 'none'],
    ['a truthy non-true is not a grant',          { tier: 'admin',   permissions: { dashboard: 'yes' } }, 'none'],
    ['one true flag is enough',                   { tier: 'admin',   permissions: { dashboard: true } },  'granted'],
    ['a true flag among falses is enough',        { tier: 'general', permissions: { a: false, team: true } }, 'granted'],
  ];

  for (const [label, input, expected] of CASES) {
    it(`[RED] ${label} → ${expected}`, () => {
      expect(adminPanelAccess(input)).toBe(expected);
    });
  }

  it('[RED] the three values are the only three', () => {
    // Guards against a fourth value appearing and a caller silently falling
    // through its if-chain into the wrong render.
    const seen = new Set(CASES.map(([, input]) => adminPanelAccess(input)));
    expect([...seen].sort()).toEqual(['granted', 'none', 'resolving']);
  });
});

// ═══ THE PANEL, THROUGH <App /> ══════════════════════════════════════════════
//
// ⚠ MOUNTED THROUGH <App />, NOT <AdminPanel /> DIRECTLY. The predicate is
// already unit-tested above; what these cases add is that AdminApp actually
// BRANCHES on it and that the branch is reachable from a real boot. Rendering
// the panel directly with a hand-built context would prove neither.
describe('C/DL-3c Phase 2b — the panel renders the honest empty state', () => {

  it('[RED] a non-Owner with NOTHING granted gets the message, and NO sections', async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch({ session: TEAM_SESSION('admin'), me: meBody('admin', {}) });

    render(<App />);

    await waitFor(() => expect(emptyState()).toBeTruthy());
    // THE REQUIREMENT IS ABSENCE, NOT A LOCKED PRESENCE — the same wording
    // roleRouting.test.jsx uses for the rep surface, and the same requirement.
    expect(sections()).toBeNull();
  });

  it('[RED] POSITIVE SIBLING — the same mount with ONE flag granted renders the sections', async () => {
    // ⚠ WITHOUT THIS THE CASE ABOVE PROVES NOTHING. "The sections are absent" is
    // satisfied by a panel that never rendered at all — a broken mock, a throw
    // swallowed by an ErrorBoundary, a marker string that no longer matches.
    // This differs from it in ONE field of ONE response.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch({ session: TEAM_SESSION('admin'), me: meBody('admin', { dashboard: true }) });

    render(<App />);

    await waitFor(() => expect(sections()).toBeTruthy());
    expect(emptyState()).toBeNull();
  });

  it('[RED] GUARD — an OWNER with permissions = {} gets the FULL panel, never the message', async () => {
    // ⚠ THE CONDITION-1 GUARD, AS A REAL CASE RATHER THAN A COMMENT.
    // requirePermission short-circuits on tier === 'owner' before the JSONB is
    // consulted, so an empty object is the NORMAL state for an Owner — there is
    // no owner preset in the invite modal, because Owners are seeded. A
    // predicate written on permissions alone would lock the panel's appearance
    // for the most privileged person in the tenant.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch({ session: TEAM_SESSION('owner'), me: meBody('owner', {}) });

    render(<App />);

    await waitFor(() => expect(sections()).toBeTruthy());
    expect(emptyState()).toBeNull();
  });

  it('[RED] THE ARRIVAL MARKER — while /api/admin/me is UNRESOLVED, NEITHER renders', async () => {
    // ⚠ THE CASE THAT WOULD OTHERWISE SHIP BROKEN, AND IT ASSERTS ON THE
    // INTERMEDIATE STATE RATHER THAN ON EITHER ENDPOINT.
    //
    // EMPTY.permissions is `{}` and a genuinely unpermissioned member's JSONB is
    // `{}`. A check written on permissions cannot tell them apart, so it would
    // render the empty state on the FIRST FRAME OF EVERY ADMIN'S BOOT and then
    // retract it — the flash-of-the-wrong-surface the App boot gate exists to
    // prevent, reintroduced one layer down.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch({ session: TEAM_SESSION('admin'), me: meBody('admin', {}), hangMe: true });

    render(<App />);

    // Wait for something that proves the panel got past the boot gate and is
    // genuinely sitting in the resolving state, rather than asserting on an
    // empty document that would satisfy both expectations vacuously.
    await waitFor(() => expect(document.querySelector('[data-admin-resolving]')).toBeTruthy());

    expect(emptyState()).toBeNull();
    expect(sections()).toBeNull();
  });
});

// ═══ BADGE PRIMING — THE 403 STORM, COUNTED ══════════════════════════════════
//
// The 8 refused requests were never a routing problem. primeBadgeCounts() and
// the inbox effect fired on MOUNT — before /api/admin/me had said which sections
// the member could see — so every one of them was sent and correctly refused.
// A DATA DEPENDENCY: the requests were not wrong, their TIMING was, and for a
// member with an empty JSONB they were wrong to exist at all.
//
// ⚠ COUNTED RATHER THAN ASSERTED ABSENT. "No gated call fired" is satisfied by a
// panel that never rendered; the granted case below is the positive sibling that
// makes the no-access case mean something, and it is on the same fixture.
describe('C/DL-3c Phase 2b — priming waits, and skips what it may not read', () => {

  const adminCalls = () => global.fetch.mock.calls
    .map(c => String(c[0]))
    .filter(u => u.includes('/api/admin/'));
  const gatedCalls = () => adminCalls().filter(u => !u.includes('/api/admin/me'));

  it('[RED] a member with NO sections fires ZERO gated admin requests', async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch({ session: TEAM_SESSION('admin'), me: meBody('admin', {}) });

    render(<App />);
    await waitFor(() => expect(emptyState()).toBeTruthy());

    expect(
      gatedCalls(),
      `a member who can see nothing requested ${gatedCalls().length} gated endpoint(s): ` +
      `${gatedCalls().join(', ')}. Every one is a guaranteed 403 — the server is right to ` +
      'refuse them and they should never have been sent.'
    ).toEqual([]);

    // NON-VACUITY: the panel really did boot and really did talk to the server.
    expect(adminCalls().some(u => u.includes('/api/admin/me'))).toBe(true);
  });

  it('[RED] POSITIVE SIBLING — a member WITH referral_review fires those, and only those', async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch({
      session: TEAM_SESSION('admin'),
      me: meBody('admin', { dashboard: true, referral_review: true }),
    });

    render(<App />);
    await waitFor(() => expect(sections()).toBeTruthy());
    await waitFor(() => expect(gatedCalls().length).toBeGreaterThan(0));

    const urls = gatedCalls().join(' ');
    // The three referral_review routes and /messages are theirs.
    expect(urls, 'pending-referrals is a referral_review route').toContain('/api/admin/pending-referrals');
    expect(urls, 'missing-referrals is a referral_review route').toContain('/api/admin/missing-referrals');
    // ⚠ AND THE ONES THEY MAY NOT READ MUST BE ABSENT. Without this the case
    // above is just "some calls happened" and the gating is untested.
    expect(urls, 'cashouts requires the cashouts flag').not.toContain('/api/admin/cashouts');
    expect(urls, 'flagged-assignments requires rep_assignment').not.toContain('flagged-assignments');
  });

  it('[RED] the duplicate is gone — the flagged summary is requested ONCE per boot', async () => {
    // AdminApp primed the sidebar badge and AdminDashboard fetched its own copy
    // for the same card, so this fired twice on every boot for EVERY member,
    // Owners included. One endpoint, two components, two states that could
    // disagree. The dashboard now takes the count as a prop.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch({ session: TEAM_SESSION('owner'), me: meBody('owner', {}) });

    render(<App />);
    await waitFor(() => expect(sections()).toBeTruthy());
    await waitFor(() => expect(gatedCalls().length).toBeGreaterThan(0));

    const summary = adminCalls().filter(u => u.includes('/api/admin/flagged-referrals/summary'));
    expect(summary.length, `requested ${summary.length} times: ${summary.join(', ')}`).toBe(1);
  });
});
