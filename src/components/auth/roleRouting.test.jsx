// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 5 — ROLE ROUTING BY IDENTITY
//
// Governing spec: CDL_3b_BUILD_SPEC.md §7.1, CD-4, plus the two Phase 5 routing
// rulings.
//
// THE STARTING TRUTH. `App.jsx` routed to the admin panel on `?admin=true` — a
// query-string toggle anyone can type. It did not escalate privilege (the panel
// asked for a password), but it meant the URL, not the person, chose the surface.
// Phase 5 inverts that: the authenticated identity chooses, and the query string
// is not consulted at all.
//
// ── THE RULE, AND WHY IT IS SHAPED THIS WAY ────────────────────────────────
//
//     tier      is_field_rep   →  surface
//     ───────   ────────────      ─────────────
//     general   true           →  rep placeholder   (3c builds the real one)
//     general   false          →  admin panel       (office staff)
//     admin     true           →  admin panel
//     owner     true           →  admin panel
//
// Only a GENERAL-TIER field rep is routed away from the panel. That is narrower
// than "is_field_rep decides" on purpose, and the reason is a production failure
// mode rather than a preference: an Owner carrying a rep flag would otherwise
// lose the admin panel entirely — no cash-out approval, no team management — with
// no route back until 3c ships a surface switcher. Recoverable only by a direct
// database edit. That is the same shape as the one-way-door deactivation defect
// found in Phase 3, and once was enough.
//
// It is also narrower than "tier decides", which would route non-rep general-tier
// office staff onto a rep surface they have no business on — the mirror image of
// the defect this requirement exists to prevent.
//
// ⚠ THREE OF THESE FOUR ROWS ARE GUARD-PROOFED, and the two interesting ones are
// guarding against the REJECTED OPTIONS rather than against nothing:
//   · general + NOT field rep → panel   fails if the rule collapses to tier
//   · owner   + field rep     → panel   fails if the rule collapses to the flag
// A test suite that only pinned the recommended path would pass under both
// rejected rules.
//
// ── WHY "NO ADMIN PANEL AT ALL", NOT A LOCKED ONE ──────────────────────────
// A general-tier field rep has no admin permissions, so PermissionGate would
// scrim every section and hand them a panel of locked boxes. The requirement is
// that they never receive it. Each assertion below therefore checks the ABSENCE
// of the other surfaces, not merely the presence of the right one.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import { REFERRER_TOKEN_KEY, ADMIN_TOKEN_KEY } from '../../utils/authStorage';
import { ADMIN_STATS_ZEROS, FLAGGED_SUMMARY_ZERO } from '../../__fixtures__/adminStats';

// ── SURFACE MARKERS ─────────────────────────────────────────────────────────
// One stable, surface-unique string each. Queried rather than asserted on a
// test id so the test breaks if the surface stops being recognisable to a person.
const referrerApp   = () => screen.queryByText(/Available Balance/i);
const adminPanel    = () => screen.queryByText(/Missing Referrals/i);
const repPlaceholder = () => screen.queryByText(/field rep tools/i);

// THE UNIFIED DOOR, and it must be told apart from the OLD inline admin form
// rather than merely "a form with an email box in it". The first version of this
// helper was queryByPlaceholderText(/email/i), which also matched the inline
// AdminLogin's "Enter admin email" — so the ?admin=true-with-no-session test
// passed against the pre-Phase-5 code and asserted nothing.
const unifiedDoor      = () => screen.queryByText(/Welcome back/i);
const legacyAdminForm  = () => screen.queryByPlaceholderText(/admin email/i);

const TEAM_SESSION = (tier, isFieldRep) => ({
  role: 'team',
  contractorId: 'tnt-routing',
  tier,
  is_field_rep: isFieldRep,
  permissions: {},
});

const REFERRER_SESSION = {
  role: 'referrer',
  contractorId: 'tnt-routing',
  name: 'Dana Referrer',
  email: 'dana@routing.test',
};

// ⚠ THE STATS PAYLOAD IS SHAPED, NOT `{}` — and so is the flagged summary. Both
// come from src/__fixtures__/adminStats.js, which carries the reasoning: an
// empty-object mock clears AdminDashboard's object-level guard and THEN throws
// inside React on a later tick, which is how this was twice recorded as a flake.
// Neither payload is interesting to this file; both exist so the panel can finish
// rendering without an unrelated throw failing a routing assertion.
//
// ⚠ RESOLVED — this block used to record both field-level guards as missing and
// defer them to Phase 6. Both shipped: ABR 6B step 1 (AdminDashboard.test.jsx),
// step 3 (AdminApp.test.jsx).

// Answers everything App and either surface can ask for on boot. Only
// /api/session is interesting; the rest exist so the tree can finish rendering
// without an unrelated rejection failing the assertion.
function installFetch(session) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/session')) {
      if (!session) return { ok: false, status: 401, json: async () => ({ error: 'Not authorized' }) };
      return { ok: true, status: 200, json: async () => session };
    }
    if (u.includes('/api/pipeline')) {
      return { ok: true, status: 200, json: async () => ({ pipeline: [], balance: 0, paidCount: 0 }) };
    }
    if (u.includes('/api/admin/me')) {
      // ⚠ `permissions` GAINED A GRANTED FLAG IN C/DL-3c PHASE 2b, AND THAT IS A
      // DELIBERATE FIXTURE CHANGE RECORDED RATHER THAN QUIETLY MADE.
      //
      // It was `{}`. Ruling A(i) made an empty JSONB on a non-Owner render the
      // honest empty state instead of the panel, so three cases here went red —
      // correctly. THIS FILE'S SUBJECT IS ROUTING: which surface an identity
      // receives. It was never about what an unpermissioned member sees once
      // they get there, and it only ever passed on `{}` because the old panel
      // rendered regardless.
      //
      // ⚠ THE ALTERNATIVE WOULD HAVE BEEN TO WEAKEN A(i) TO KEEP THESE GREEN,
      // which is production code bent to satisfy a test. The flag is the honest
      // fix: it restores the precondition these cases always assumed.
      // adminPanelAccess()'s own behaviour is covered in
      // src/components/admin/adminPanelAccess.test.jsx, including the empty case.
      return { ok: true, status: 200, json: async () => ({
        tier: session?.tier ?? null, permissions: { dashboard: true },
      }) };
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

describe('C/DL-3b Phase 5 — the authenticated identity chooses the surface', () => {

  it('[RED] general tier + field rep → the rep surface, and NO admin panel at all', async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(TEAM_SESSION('general', true));

    render(<App />);

    await waitFor(() => expect(repPlaceholder()).toBeTruthy());
    // THE REQUIREMENT IS ABSENCE, NOT A LOCKED PRESENCE. A panel whose sections
    // are all scrimmed by PermissionGate would satisfy "they cannot use it" and
    // still fail this.
    expect(adminPanel()).toBeNull();
    expect(referrerApp()).toBeNull();
  });

  // ── THE 403 FENCE (C/DL-3c Phase 2a) ────────────────────────────────────────
  //
  // PRE_LAUNCH_CHECKLIST.md filed "FOURTEEN 403s FIRE ON EVERY RepPlaceholder
  // LOAD" from a console read during the 1c walkthrough. ⚠ THAT ATTRIBUTION WAS
  // WRONG AND THIS TEST IS WHERE IT WAS DISPROVED. On the rep branch the mounted
  // tree is App → ThemeProvider → BrandingProvider → ThemeLayer → RepSurface →
  // RepPlaceholder. AdminPanel returns at App.jsx:498, FIVE early returns above
  // the rep branch, so AdminApp — the only thing that primes badge counts — never
  // mounts at all. The endpoints in that entry (/api/admin/stats, .../cashouts,
  // .../team, .../settings) are exactly AdminApp's and AdminSettings' mount sets,
  // seen in the same walkthrough on a console that was not cleared between
  // navigations.
  //
  // ⚠ THE ASSERTION IS "ONLY /api/admin/me", NOT "NO /api/admin/ AT ALL", AND THE
  // DIFFERENCE IS THE WHOLE POINT. Phase 2a feeds the rep capabilities context
  // from GET /api/admin/me, which is session-only and on adminRouteCoverage's
  // PUBLIC_ADMIN_ROUTES allowlist by design — a general-tier rep with an empty
  // permissions JSONB gets a 200 from it. Every OTHER /api/admin/* route carries
  // requirePermission() and would 403. So "no admin fetch" would be false the
  // moment the seam landed, and a fence that has to be relaxed is a fence nobody
  // trusts. This one is exact and stays true.
  //
  // ⚠ KEPT PERMANENTLY. It is the fence against anyone later wiring a GATED admin
  // fetch above the surface split — which is the only way the storm could ever
  // become real on this surface.
  it('[RED] FENCE — the rep surface calls NO gated admin endpoint, only /api/admin/me', async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(TEAM_SESSION('general', true));

    render(<App />);

    await waitFor(() => expect(repPlaceholder()).toBeTruthy());

    const adminCalls = global.fetch.mock.calls
      .map(c => String(c[0]))
      .filter(u => u.includes('/api/admin/'));
    const gated = adminCalls.filter(u => !u.includes('/api/admin/me'));

    expect(
      gated,
      `the rep surface requested ${gated.length} gated admin endpoint(s): ${gated.join(', ')}. ` +
      'Every /api/admin/* route except /api/admin/me, /api/admin/titles, /api/admin/notifications ' +
      'and the login/invite pair carries requirePermission(), and a general-tier rep holds an ' +
      'empty permissions JSONB — so each of these is a guaranteed 403 on every load. If a rep ' +
      'genuinely needs this data, it belongs on a rep-prefixed route with an own-book predicate, ' +
      'not on an admin route that happens to answer.'
    ).toEqual([]);

    // NON-VACUITY: the filter above returns [] just as happily when nothing was
    // fetched at all — a broken mock, a tree that never rendered, a renamed
    // property on vi.fn(). The seam's own call must be present.
    expect(
      adminCalls.some(u => u.includes('/api/admin/me')),
      'the rep surface made NO /api/admin/me call, so the empty gated-call list above is ' +
      'evidence about nothing. Either the capabilities context is unwired or this mock is.'
    ).toBe(true);
  });

  it('[RED] GUARD — general tier WITHOUT the field-rep flag → the admin panel, not the rep surface', async () => {
    // Office staff. This is the assertion that fails if the rule ever collapses
    // to "tier decides", which was a rejected option precisely because it routes
    // these people onto a surface built for someone else.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(TEAM_SESSION('general', false));

    render(<App />);

    await waitFor(() => expect(adminPanel()).toBeTruthy());
    expect(repPlaceholder()).toBeNull();
  });

  it('[RED] GUARD — an OWNER who is also a field rep keeps the admin panel', async () => {
    // The locked-out-owner case. If the rule ever collapses to "is_field_rep
    // decides", this owner loses cash-out approval and team management with no
    // route back until 3c ships a surface switcher — recoverable only by a direct
    // database edit.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(TEAM_SESSION('owner', true));

    render(<App />);

    await waitFor(() => expect(adminPanel()).toBeTruthy());
    expect(repPlaceholder()).toBeNull();
  });

  it('[RED] an ADMIN who is also a field rep keeps the admin panel', async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    installFetch(TEAM_SESSION('admin', true));

    render(<App />);

    await waitFor(() => expect(adminPanel()).toBeTruthy());
    expect(repPlaceholder()).toBeNull();
  });

  it('[RED] a referrer lands on the referrer app', async () => {
    localStorage.setItem(REFERRER_TOKEN_KEY, 'referrer-token');
    installFetch(REFERRER_SESSION);

    render(<App />);

    await waitFor(() => expect(referrerApp()).toBeTruthy());
    expect(adminPanel()).toBeNull();
    expect(repPlaceholder()).toBeNull();
  });

  it('[RED] GUARD — ?admin=true does NOT produce an admin panel for a referrer', async () => {
    // The whole point of routing by identity. Before Phase 5 this query string
    // returned <AdminPanel /> unconditionally, before any identity was known.
    localStorage.setItem(REFERRER_TOKEN_KEY, 'referrer-token');
    installFetch(REFERRER_SESSION);
    setUrl('?admin=true');

    render(<App />);

    await waitFor(() => expect(referrerApp()).toBeTruthy());
    expect(adminPanel()).toBeNull();
  });

  it('[RED] GUARD — ?admin=true with NO session shows the unified login, not an admin form', async () => {
    // A stranger typing the query string must reach the same door as everyone
    // else. Before Phase 5 they reached a separate, differently-styled admin
    // login form that announced the panel's existence.
    installFetch(null);
    setUrl('?admin=true');

    render(<App />);

    await waitFor(() => expect(unifiedDoor()).toBeTruthy());
    // The separate admin form is gone, not merely bypassed. Its distinct styling
    // and copy announced the panel's existence to anyone who typed the query
    // string; CD-4 replaces it with one door for everybody.
    expect(legacyAdminForm()).toBeNull();
    expect(adminPanel()).toBeNull();
    expect(repPlaceholder()).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// THE BOOT-ORDER TIE-BREAK
//
// ⚠ THIS STATE EXISTS IN PRODUCTION FOR REAL PEOPLE ON EXACTLY ONE DAY — DEPLOY
// DAY — AND NEVER AGAIN, WHICH IS WHY IT IS PINNED RATHER THAN REASONED ABOUT.
//
// Two token keys exist (`rb_admin_token`, `rb_token`) because 29 files read the
// admin one directly, so unifying them was a blast radius Phase 5 did not need.
// From Phase 5 onward at most one is live: the unified door writes the key that
// matches the authenticated role and DROPS THE OTHER. But a device that used both
// surfaces BEFORE Phase 5 — a team member who also holds a homeowner account, on
// their own laptop — arrives at the new build holding two stale-but-valid tokens
// and no rule to choose between them.
//
// THE RULE: the team token is tried FIRST. If it validates as a team session it
// wins; anything else falls through to the referrer token.
//
// It is not an escalation in either direction, and that is the point. Both tokens
// are credentials the person legitimately holds, both are validated SERVER-SIDE
// before either is honoured, and a referrer cannot come to possess an admin token
// — so "a referrer's device rehydrates an admin session" cannot happen unless
// that device really does hold a live team session. The only question the order
// answers is which surface to open on, and a team member holding an old homeowner
// token almost certainly wants their team surface.
// ═════════════════════════════════════════════════════════════════════════════

// Answers /api/session according to WHICH bearer token was presented, so the
// order App tries them in is observable rather than assumed.
function installFetchByToken(sessionsByToken) {
  global.fetch = vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('/api/session')) {
      const bearer = (init?.headers?.Authorization || '').replace('Bearer ', '');
      const session = sessionsByToken[bearer];
      if (!session) return { ok: false, status: 401, json: async () => ({ error: 'Not authorized' }) };
      return { ok: true, status: 200, json: async () => session };
    }
    if (u.includes('/api/login')) {
      return { ok: true, status: 200, json: async () => ({
        success: true, role: 'team', token: 'fresh-team-token', tier: 'owner', is_field_rep: false,
      }) };
    }
    if (u.includes('/api/pipeline')) {
      return { ok: true, status: 200, json: async () => ({ pipeline: [], balance: 0, paidCount: 0 }) };
    }
    // ⚠ THIS BRANCH DID NOT EXIST BEFORE C/DL-3c PHASE 2b, AND ITS ABSENCE WAS
    // INVISIBLE — WHICH IS THE INTERESTING PART.
    //
    // Every /api/admin/me call fell through to the catch-all `{}` below, so the
    // panel was driven by a response this fixture never modelled. It passed
    // anyway, because the old panel rendered whatever permissions said. Ruling
    // A(i)'s arrival marker is what surfaced it: `tier: undefined` reads as
    // "no answer yet", the resolving state renders neither surface, and the
    // assertion finally had something to fail against.
    //
    // A fixture that answers a call it never modelled is the same family as a
    // FIXTURE NOTHING CONSUMES — it looks like coverage and is not. Recorded
    // here rather than silently filled in.
    if (u.includes('/api/admin/me')) {
      const bearer = (init?.headers?.Authorization || '').replace('Bearer ', '');
      const session = sessionsByToken[bearer];
      return { ok: true, status: 200, json: async () => ({
        tier: session?.tier ?? 'owner', permissions: { dashboard: true },
      }) };
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

describe('C/DL-3b Phase 5 — two live tokens on one device (the deploy-day state)', () => {

  it('[RED] the TEAM token wins when both are valid', async () => {
    localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
    localStorage.setItem(REFERRER_TOKEN_KEY, 'referrer-token');
    installFetchByToken({
      'team-token': TEAM_SESSION('owner', false),
      'referrer-token': REFERRER_SESSION,
    });

    render(<App />);

    await waitFor(() => expect(adminPanel()).toBeTruthy());
    expect(referrerApp()).toBeNull();
  });

  it('[RED] an EXPIRED team token falls through to the referrer token rather than stranding the person', async () => {
    // The failure this prevents is not a wrong surface — it is NO surface. If the
    // team token were tried and its failure treated as the answer, someone whose
    // team session had lapsed would be shown the login screen while holding a
    // perfectly good referrer session.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'stale-team-token');
    localStorage.setItem(REFERRER_TOKEN_KEY, 'referrer-token');
    installFetchByToken({ 'referrer-token': REFERRER_SESSION });

    render(<App />);

    await waitFor(() => expect(referrerApp()).toBeTruthy());
    expect(adminPanel()).toBeNull();
  });

  it('[RED] a team KEY holding a non-team session does not misroute', async () => {
    // Defence in depth against the shape of the bug, not just its likeliest
    // cause. The branch is on what the SERVER says the session is
    // (`restored?.role === 'team'`), never on which key it came out of — so a
    // referrer session stored under the admin key by some earlier build falls
    // through to the referrer path instead of opening the panel.
    localStorage.setItem(ADMIN_TOKEN_KEY, 'mislabelled-token');
    localStorage.setItem(REFERRER_TOKEN_KEY, 'referrer-token');
    installFetchByToken({
      'mislabelled-token': REFERRER_SESSION,
      'referrer-token': REFERRER_SESSION,
    });

    render(<App />);

    await waitFor(() => expect(referrerApp()).toBeTruthy());
    expect(adminPanel()).toBeNull();
  });

  it('[RED] signing in DROPS the other key — which is what makes the ambiguity legacy-only', async () => {
    // The mechanism the tie-break comment relies on. Without it, the two-live-token
    // state would be permanent rather than something the first Phase 5 login clears,
    // and the order above would be load-bearing forever instead of for one day.
    localStorage.setItem(REFERRER_TOKEN_KEY, 'old-referrer-token');
    installFetchByToken({});

    render(<App />);
    await waitFor(() => expect(screen.queryByLabelText(/email address/i)).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'owner@tie.test' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'a-real-password-14' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(localStorage.getItem(ADMIN_TOKEN_KEY)).toBe('fresh-team-token'));
    expect(localStorage.getItem(REFERRER_TOKEN_KEY)).toBeNull();
  });
});
