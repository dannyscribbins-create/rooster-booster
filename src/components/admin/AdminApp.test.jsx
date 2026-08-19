// ─────────────────────────────────────────────────────────────────────────────
// ABR PHASE 6B — STEP 3 — THE flaggedRes SHAPE GUARD
//
// AdminApp.jsx:160-162 reads `.unresolved_count` off a resolved value with no
// shape guard, while its four siblings in the same Promise.allSettled block all
// check theirs. A 403 or 500 body resolves FULFILLED, so the read yields
// `undefined` and `setFlaggedUnresolved(undefined)` runs.
//
// ── ⚠ THE FAILURE IS NOT "undefined" ON SCREEN. IT IS AN ABSENT BADGE. ──────
// The value is summed TWICE before it is ever compared:
//
//   AdminApp.jsx:230        flaggedUnresolved + missingOpenCount      → NaN
//   AdminComponents.jsx:184 (flaggedUnresolved + pendingReferralCount) > 0
//                                                        → NaN > 0 → false
//
// so the span is never created. That matters because THE PILL IS A SUM OF THREE
// COUNTERS — flagged, missing-open and pending-referral. One unguarded read
// poisons the whole sum, and a contractor with 3 pending referrals and 2 open
// missing-referrals is shown NO BADGE rather than "5". Two healthy queues are
// suppressed by a third one's bad response, and an absent badge is
// pixel-identical to a genuine all-clear.
//
// ── WHY THE ASSERTIONS NAME A NUMBER AND NOT "not undefined" ────────────────
// A test proving only "the badge is not undefined" PASSES AGAINST THE CURRENT
// ABSENT BADGE, which is the actual falsehood. Every case below asserts what
// the pill DOES read. badgeText() returns null for absent and the string for
// present, so "absent" and "reads 0" stay two distinguishable outcomes rather
// than one falsy blur.
//
// ── THE SHARP REACHABILITY PATH IS THE 500, NOT THE 403 ────────────────────
// All three referral endpoints share requirePermission('referral_review')
// (admin/index.js:1557, 1661, 1841), so a permission-403 hits all three at once
// and the two Array.isArray siblings correctly reject their bodies — the badge
// would be legitimately absent anyway. The damaging path is the summary's OWN
// catch at admin/index.js:1567-1569: one failing COUNT query while the other two
// succeed. The fixtures below model exactly that — flagged unresolvable, the
// other two healthy and non-zero.
//
// ── KNOWN REMAINING FALSEHOOD, RULED IN, NOT MISSED ────────────────────────
// The step-3 guard lets an unresolvable flagged count contribute ZERO, so the
// pill understates rather than vanishing. Magnitude drops from "three queues
// suppressed" to "one understated"; it is not eliminated. Representing an
// unknown in that pill needs a design decision about PARTIAL unknowns (what does
// it read when flagged is unknown but missing and pending are 2 and 3?) and
// AdminComponents.jsx:184-185 is deliberately out of this step's scope. The
// control case below is the executable record of that ruling.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor, act } from '@testing-library/react';
import AdminPanel from './AdminApp';

// The page is stubbed. AdminDashboard fires its own fetches and its render is
// steps 1 and 2's subject, not this step's — a change there must never turn a
// badge test red. AdminSidebar, which owns the pill, is left REAL.
vi.mock('./AdminDashboard', () => ({
  default: function DashboardStub() { return <div data-testid="page-stub" />; },
}));

const ME_RESPONSE = {
  email: 'owner@fixture.test.invalid',
  full_name: 'Dana Owner',
  tier: 'owner',
  permissions: {},
  branding: null,
};

// ── THE FIXTURE COUNTS ──────────────────────────────────────────────────────
// Distinct and non-zero so no two contributions can be confused for one another,
// and so "rendered the sum" and "rendered one term" are different numbers.
const FLAGGED_N = 4;   // unresolved_count from the summary endpoint
const MISSING_N = 2;   // unresolved rows from /missing-referrals
const PENDING_N = 3;   // status==='pending' rows from /pending-referrals

const HEALTHY_TOTAL  = String(FLAGGED_N + MISSING_N + PENDING_N); // '9'
const DEGRADED_TOTAL = String(MISSING_N + PENDING_N);             // '5'

// The literal body a denied request produces (permissions.js:55) and the one the
// summary's own catch produces (admin/index.js:1568). Both resolve FULFILLED.
const DENIED_BODY = { error: 'Access denied' };
const SERVER_ERROR_BODY = { error: 'Internal server error' };

function installFetch({ flagged, missing = MISSING_N, pending = PENDING_N } = {}) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });

    if (u.includes('/api/admin/me')) return ok(ME_RESPONSE);
    // ⚠ Must be tested BEFORE any looser flagged match.
    if (u.includes('/api/admin/flagged-referrals/summary')) return ok(flagged);
    if (u.includes('/api/admin/pending-referrals')) {
      return ok({ pending: Array.from({ length: pending }, (_, i) => ({ id: i, status: 'pending' })) });
    }
    if (u.includes('/api/admin/missing-referrals')) {
      return ok(Array.from({ length: missing }, (_, i) => ({ id: i, resolved: false })));
    }
    if (u.includes('/api/admin/team/flagged-assignments')) return ok({ flags: [] });
    if (u.includes('/api/admin/cashouts')) return ok([]);
    if (u.includes('/api/admin/messages')) return ok([]);
    return ok({});
  });
}

// ── THE SELECTOR ────────────────────────────────────────────────────────────
// The nav button holds an icon element, a label span, and OPTIONALLY the badge
// span. Counting spans is what makes "no badge" and "badge reading 0" two
// different readings; a textContent match on the button alone could not tell
// them apart.
//
// The toHaveLength(1) guard is the non-vacuity mechanism: a selector that
// silently stopped matching would make every assertion below trivially pass, so
// it fails loudly instead.
function missingReferralsNav() {
  const buttons = Array.from(document.querySelectorAll('button'))
    .filter(b => b.textContent.startsWith('Missing Referrals'));
  expect(buttons).toHaveLength(1);
  return buttons[0];
}

// Returns the badge's text, or null when no badge element exists at all.
function badgeText() {
  const spans = Array.from(missingReferralsNav().querySelectorAll('span'));
  expect(spans[0].textContent).toBe('Missing Referrals');
  expect(spans.length).toBeLessThanOrEqual(2);
  return spans.length === 2 ? spans[1].textContent : null;
}

// Waits for /api/admin/me to land (proving the tree mounted and fetched), then
// flushes the remaining microtask chain so primeBadgeCounts' allSettled block
// has run its state updates. Needed by the ZERO case, which has no positive
// value to wait on — every counter starts at 0 and legitimately stays there.
async function settle() {
  await waitFor(() => expect(screen.getByText('Dana Owner')).toBeInTheDocument());
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
  sessionStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 6B step 3 — the Missing Referrals badge survives an unresolvable flagged count', () => {

  it('a real count renders the sum of all three queues', async () => {
    installFetch({ flagged: { unresolved_count: FLAGGED_N } });
    render(<AdminPanel onLogout={() => {}} />);

    await waitFor(() => expect(badgeText()).toBe(HEALTHY_TOTAL));
  });

  it('a genuine all-clear renders NO badge, and that is correct', async () => {
    // The over-reach fence. A guard that rendered the pill unconditionally, or
    // treated every falsy value as unknown, turns this red — which is the point:
    // zero is a true statement about known data and must stay silent.
    installFetch({ flagged: { unresolved_count: 0 }, missing: 0, pending: 0 });
    render(<AdminPanel onLogout={() => {}} />);

    await settle();
    expect(badgeText()).toBeNull();
  });

  it('[RED] a denied flagged summary must not suppress the two queues that resolved', async () => {
    // The fixture sanity check: 5 is meaningful ONLY because both surviving
    // queues carry real rows. Without this the assertion below could be read as
    // "some number appeared".
    expect(MISSING_N).toBeGreaterThan(0);
    expect(PENDING_N).toBeGreaterThan(0);

    installFetch({ flagged: DENIED_BODY });
    render(<AdminPanel onLogout={() => {}} />);

    await waitFor(() => expect(badgeText()).toBe(DEGRADED_TOTAL));
  });

  it('[RED] a 500 from the summary alone must not suppress the two queues that resolved', async () => {
    // The sharp reachability path — one failing COUNT query, the other two
    // endpoints healthy. Same shape as the 403 body, different origin, and this
    // is the one that is NOT self-cancelling across the three endpoints.
    installFetch({ flagged: SERVER_ERROR_BODY });
    render(<AdminPanel onLogout={() => {}} />);

    await waitFor(() => expect(badgeText()).toBe(DEGRADED_TOTAL));
  });

  it('[RED] the poisoned sum never reaches the pill as NaN', async () => {
    // Names the mechanism directly. `undefined + missingOpenCount` is NaN, and a
    // fix that made the span render unconditionally would print the string "NaN"
    // rather than suppressing it — this fails against that fix and against
    // today's absence, which are the two wrong directions out of here.
    installFetch({ flagged: DENIED_BODY });
    render(<AdminPanel onLogout={() => {}} />);

    await settle();
    const text = badgeText();
    expect(text).not.toBeNull();
    expect(text).not.toContain('NaN');
  });

  it('[RED] an unknown flagged count contributes ZERO — the ruled, recorded remainder', async () => {
    // ⚠ THIS TEST ASSERTS A KNOWN SILENT FALSEHOOD ON PURPOSE.
    // An unresolvable flagged count and a flagged count of exactly 0 produce the
    // SAME pill. That is step 3's accepted remainder, not an oversight: the pill
    // sums three counters and representing a partial unknown in it is a design
    // decision deferred to 6A. This is the executable record. If a later step
    // teaches the pill to say "unknown", this test is the one that must be
    // rewritten, and it should be — it is a fence around a compromise, not
    // around a correct behaviour.
    installFetch({ flagged: DENIED_BODY });
    const { unmount } = render(<AdminPanel onLogout={() => {}} />);
    await waitFor(() => expect(badgeText()).toBe(DEGRADED_TOTAL));
    const unresolvableReading = badgeText();
    unmount();

    installFetch({ flagged: { unresolved_count: 0 } });
    render(<AdminPanel onLogout={() => {}} />);
    await waitFor(() => expect(badgeText()).toBe(DEGRADED_TOTAL));

    expect(unresolvableReading).toBe(badgeText());
  });

  it('[RED] the three states are mutually distinguishable', async () => {
    // Non-vacuity for everything above. If any two of the three fixtures
    // happened to render the same pill, a test claiming to tell them apart would
    // be asserting nothing. Read from three real renders, not from constants.
    const readings = [];

    installFetch({ flagged: { unresolved_count: FLAGGED_N } });
    const healthy = render(<AdminPanel onLogout={() => {}} />);
    await waitFor(() => expect(badgeText()).toBe(HEALTHY_TOTAL));
    readings.push(badgeText());
    healthy.unmount();

    installFetch({ flagged: { unresolved_count: 0 }, missing: 0, pending: 0 });
    const allClear = render(<AdminPanel onLogout={() => {}} />);
    await settle();
    readings.push(badgeText());
    allClear.unmount();

    installFetch({ flagged: DENIED_BODY });
    render(<AdminPanel onLogout={() => {}} />);
    await waitFor(() => expect(badgeText()).toBe(DEGRADED_TOTAL));
    readings.push(badgeText());

    expect(new Set(readings).size).toBe(3);
    expect(readings).toEqual([HEALTHY_TOTAL, null, DEGRADED_TOTAL]);
  });
});
