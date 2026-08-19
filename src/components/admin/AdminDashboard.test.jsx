// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BRAND RETIREMENT — PHASE 6B STEP 1 — ADMINDASHBOARD FIELD-LEVEL GUARD
//
// ⚠ THIS FILE IS NOT ABOUT BRANDING. adminBrandRetirement.test.jsx owns "does
// the panel render THIS contractor"; adminBranding.test.jsx owns "no Accent
// literal survives". Neither can see the defect below, because it is not a
// literal and not a tenancy question — it is what the panel does when the
// endpoint hands it a field it did not expect to be missing.
//
// ── THE DEFECT ──────────────────────────────────────────────────────────────
// AdminDashboard.jsx:132 guards the stats OBJECT (`: stats && (`). Two reads
// beneath it call a method on a FIELD:
//
//     :137   value={`$${stats.totalBalance.toLocaleString()}`}
//     :138   value={`$${stats.totalPaidOut.toLocaleString()}`}
//
// `.toLocaleString()` on undefined throws a TypeError mid-render, and a render
// error takes the WHOLE PANEL, not the one card. The object-level guard cannot
// help: `{}` is truthy, so it passes and the throw happens anyway. That is the
// precise reason a field-level guard is not redundant with an object-level one.
//
// ⚠ VACUITY RULE #5 GOVERNS THIS FILE. CLAUDE.md → Test Design: "a test
// asserting a component's DEFAULTED fields cannot see a bug in its
// NON-DEFAULTED one… WHEN A VALUE MAY LEGITIMATELY BE ABSENT, THE ABSENT CASE
// IS THE PRIMARY TEST." Every fixture in the suite today is fully populated,
// which is exactly why this shipped and stayed invisible.
//
// ── WHY THE ERROR BOUNDARY, AND WHY IT IS THE WHOLE DESIGN ──────────────────
// The throw does NOT happen during render(). It happens on the state update
// after /api/admin/stats resolves. React surfaces that as an UNHANDLED ERROR,
// which Vitest reports as a passing test in a non-zero run — the exact trap
// recorded at adminBrandRetirement.test.jsx:292-297, where a blanket `{}` mock
// let an assertion pass and THEN threw inside React.
//
// So a naive `expect(screen.getByText(...))` RED here would go GREEN while the
// suite failed elsewhere, and would be indistinguishable from a real pass. The
// boundary converts that side-channel into a deterministic assertion: `caught`
// is empty or it is not, and the test says which.
//
// ⚠ DO NOT REPLACE THE BOUNDARY WITH A try/catch AROUND render(). It would
// catch nothing — render() returns before the fetch resolves.
// ─────────────────────────────────────────────────────────────────────────────

import { Component } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import BrandingProvider from '../shared/BrandingProvider';
import AdminDashboard from './AdminDashboard';

// The nine fields GET /api/admin/stats builds on its fresh path
// (server/routes/admin/metrics.js:78-83), plus totalReferrers.
//
// ⚠ NON-ZERO AND DISTINCT, DELIBERATELY. A fixture of all-zeros cannot tell a
// rendered value from a placeholder, cannot tell one card's value from
// another's, and — because `0` needs no thousands separator — cannot see a
// formatting change at all. Each value below is unique and separator-bearing.
const STATS_FULL = Object.freeze({
  activeReferrers: 42, totalReferrers: 57,
  totalBalance: 1234567.5, totalPaidOut: 987654.25,
  totalReferrals: 311, totalLeads: 108, totalInspections: 74,
  totalSold: 91, totalNotSold: 38, pendingCashouts: 0,
});

// ── The boundary ────────────────────────────────────────────────────────────
// Records rather than re-throws, so a failing case produces a readable
// assertion instead of a worker-level crash.
function makeBoundary() {
  const caught = [];
  class Catcher extends Component {
    constructor(props) { super(props); this.state = { dead: false }; }
    static getDerivedStateFromError() { return { dead: true }; }
    componentDidCatch(error) { caught.push(error); }
    render() { return this.state.dead ? <div data-testid="panel-dead" /> : this.props.children; }
  }
  return { caught, Catcher };
}

function installFetch(stats) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/admin/stats')) {
      return { ok: true, status: 200, json: async () => stats };
    }
    if (u.includes('/api/admin/flagged-referrals/summary')) {
      return { ok: true, status: 200, json: async () => ({ unresolved_count: 0 }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}
afterEach(() => { delete global.fetch; });

// Renders the panel against `stats` and resolves once the fetch has settled
// one way or the other — either the cards painted, or the boundary caught.
async function renderWith(stats) {
  const { caught, Catcher } = makeBoundary();
  installFetch(stats);
  const view = render(
    <Catcher>
      <BrandingProvider supplied={null}>
        <AdminDashboard setLoggedIn={() => {}} setPage={() => {}} />
      </BrandingProvider>
    </Catcher>
  );
  await waitFor(() => {
    const settled = caught.length > 0 || screen.queryByText('Total Balance Owed');
    expect(settled).toBeTruthy();
  });
  return { caught, view };
}

// Returns the StatCard element that carries `label`, so a value assertion is
// anchored to ITS OWN card rather than to the document.
//
// ⚠ THE $$500 RULE. CLAUDE.md → Test Design: "toContain on a bare VALUE cannot
// see a defect in the CONTEXT around it." A document-wide
// toContain('1,234,567.5') would pass with the number on the wrong card, or
// with two dollar signs in front of it. The card is the context; assert inside
// it, and assert the '$' as part of the string rather than separately.
// ⚠ getByText ALONE IS AMBIGUOUS HERE and throws "multiple elements". "Sold" is
// both a StatCard label and a pipeline-legend entry (AdminDashboard.jsx:183);
// "Leads"/"Inspections" sit beside "Lead"/"Inspection". StatCard's label span
// carries textTransform: uppercase (AdminComponents.jsx:19) and the legend's
// (AdminDashboard.jsx:188) does not, which separates them on a real rendered
// property rather than on DOM position.
function cardFor(label) {
  const hits = screen.getAllByText(label)
    .filter(el => el.tagName === 'SPAN' && el.style.textTransform === 'uppercase');
  // Non-vacuity: if the selector silently stopped matching, an empty result
  // would make every assertion below vacuous. Fail loudly instead.
  expect(hits).toHaveLength(1);
  // StatCard: label <span> → parent flex row → card <div> (AdminComponents.jsx:18-25)
  return hits[0].parentElement.parentElement;
}

describe('AdminDashboard — a missing stats field must blank a card, not the panel', () => {

  // ── RED 1 ─────────────────────────────────────────────────────────────────
  it('[RED] survives totalBalance: undefined', async () => {
    const { caught } = await renderWith({ ...STATS_FULL, totalBalance: undefined });
    expect(caught.map(e => e.message)).toEqual([]);
    expect(screen.queryByTestId('panel-dead')).toBeNull();
    // The panel is intact: a sibling card still shows its real value.
    expect(cardFor('Total Paid Out').textContent).toContain('$987,654.25');
    // And the absent one drew the honest placeholder, not a fabricated zero.
    expect(cardFor('Total Balance Owed').textContent).toContain('—');
    expect(cardFor('Total Balance Owed').textContent).not.toContain('$0');
  });

  // ── RED 2 ─────────────────────────────────────────────────────────────────
  it('[RED] survives totalPaidOut: undefined', async () => {
    const { caught } = await renderWith({ ...STATS_FULL, totalPaidOut: undefined });
    expect(caught.map(e => e.message)).toEqual([]);
    expect(screen.queryByTestId('panel-dead')).toBeNull();
    expect(cardFor('Total Balance Owed').textContent).toContain('$1,234,567.5');
    expect(cardFor('Total Paid Out').textContent).toContain('—');
    expect(cardFor('Total Paid Out').textContent).not.toContain('$0');
  });

  // ── RED 3 ─────────────────────────────────────────────────────────────────
  // The realistic shape, not the single-field one. An empty object is what the
  // cache path produces when the stored JSONB is NULL — `{...null}` is legal
  // and yields `{}` — and it is what any response-shape change degrades toward.
  // It is also the case the line-132 guard provably cannot catch, since `{}` is
  // truthy.
  it('[RED] survives a fieldless stats object', async () => {
    const { caught } = await renderWith({});
    expect(caught.map(e => e.message)).toEqual([]);
    expect(screen.queryByTestId('panel-dead')).toBeNull();
    expect(cardFor('Total Balance Owed').textContent).toContain('—');
    expect(cardFor('Total Paid Out').textContent).toContain('—');
  });

  // ── NEGATIVE — vacuity shape #1 ───────────────────────────────────────────
  // Without this, a fix that blanked both cards unconditionally would turn all
  // three tests above green. The placeholder must appear ONLY when the value is
  // absent, and the real formatted value must survive untouched.
  it('a populated stats object still renders the real formatted values', async () => {
    const { caught } = await renderWith(STATS_FULL);
    expect(caught.map(e => e.message)).toEqual([]);

    const balance = cardFor('Total Balance Owed');
    const paid = cardFor('Total Paid Out');

    expect(balance.textContent).toContain('$1,234,567.5');
    expect(paid.textContent).toContain('$987,654.25');

    // The placeholder must be ABSENT here, or the fix is unconditional and the
    // three RED tests above prove nothing.
    expect(balance.textContent).not.toContain('—');
    expect(paid.textContent).not.toContain('—');

    // Anchored to the card, so a value landing on the wrong one still fails.
    expect(balance.textContent).toContain('across all referrers');
    expect(paid.textContent).toContain('approved payouts');
  });
});
