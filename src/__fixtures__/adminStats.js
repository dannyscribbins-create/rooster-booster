// ─────────────────────────────────────────────────────────────────────────────
// SHARED ADMIN-ENDPOINT FIXTURES
//
// ⚠ THIS IS NOT A TEST FILE, AND THE FILENAME IS THE ONLY THING KEEPING IT THAT
// WAY. vite.config.mjs sets `test.include: ['src/**/*.test.{js,jsx}']` — a
// FILENAME pattern, not a directory one — so this directory is neither collected
// nor excluded, it is simply irrelevant to the runner. Rename this file to
// *.test.js and Vitest sweeps it up as a suite containing no cases. That is the
// one live risk in putting fixtures under src/.
//
// ── WHY THE STATS PAYLOAD MUST BE SHAPED, NOT `{}` ──────────────────────────
// AdminDashboard guards the stats OBJECT (`stats && (`) — and `{}` is truthy, so
// a blanket empty-object mock CLEARS that guard, sets stats = {}, and then throws
// inside React's render on a tick that lands after the assertion has already
// resolved. Vitest surfaces that as an UNHANDLED ERROR: "418 passed" alongside a
// NON-ZERO exit, failing `npm test` — or as nothing at all, depending on whether
// the late render beats teardown. A race, which is exactly how it was recorded
// twice as a flake before the shape was pinned.
//
// ⚠ RESOLVED, AND THE FIXTURE IS STILL CORRECT. The three copies this file
// replaces each recorded that AdminDashboard's field-level guard was missing and
// deferred it to "Phase 6". Both guards shipped — ABR 6B step 1 for the two
// toLocaleString reads (AdminDashboard.test.jsx), step 3 for the summary's
// `.unresolved_count` (AdminApp.test.jsx) — so a thin payload no longer crashes
// anything. A shaped payload remains right here because the real endpoints send
// one; it is simply no longer all that stands between a caller and a crash.
//
// ⚠ TWO EXPORTS, NEVER ONE OBJECT. These are two different endpoints' responses.
// Merged, the fixture would carry a shape that corresponds to nothing the server
// has ever sent.
//
// ⚠ NOT FOR ASSERTING ON DISPLAYED VALUES. Every number here is zero, so this
// fixture cannot tell a rendered value from a placeholder, cannot tell one card's
// value from another's, and — since `0` needs no thousands separator — cannot see
// a formatting change at all. A suite that asserts on what the dashboard DISPLAYS
// needs its own non-zero, distinct fixture. AdminDashboard.test.jsx's STATS_FULL
// is that fixture, and is deliberately not this one.
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/stats — the nine fields the endpoint builds on its fresh path,
// plus totalReferrers.
export const ADMIN_STATS_ZEROS = Object.freeze({
  activeReferrers: 0, totalReferrers: 0, totalBalance: 0, totalPaidOut: 0,
  totalReferrals: 0, totalLeads: 0, totalInspections: 0, totalSold: 0,
  totalNotSold: 0, pendingCashouts: 0,
});

// GET /api/admin/flagged-referrals/summary — one field, which AdminApp reads on
// boot and sums twice before ever comparing it.
export const FLAGGED_SUMMARY_ZERO = Object.freeze({ unresolved_count: 0 });
