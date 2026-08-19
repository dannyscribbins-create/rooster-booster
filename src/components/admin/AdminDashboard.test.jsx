// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BRAND RETIREMENT — PHASE 6B STEP 1 — ADMINDASHBOARD FIELD-LEVEL GUARD
// ⚠ PRE-FIX NARRATIVE: the present tense below is the state this suite was written against.
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
// recorded in src/__fixtures__/adminStats.js, where a blanket `{}` mock
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
import { AD } from '../../constants/adminTheme';

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

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2 — THE SILENT FALSEHOODS
//
// Step 1 fixed a CRASH. These are the opposite failure: the panel renders
// perfectly and says something untrue.
//
// ⚠ THE RULE THAT SCOPES THIS BLOCK. Visible wrongness announces itself;
// silent wrongness does not. "NaN total referrals" and "undefined accounts
// enrolled" are wrong AND LOOK wrong — an admin reads them as broken and does
// not act on them, so they are queued as cosmetic. "All caught up" is wrong and
// LOOKS RIGHT. Only that second kind causes a decision, and only that kind is
// tested here.
//
// Both sites below fail the same way: `undefined > 0` is false, so ABSENT is
// silently handled by the branch written for ZERO. That is why every test in
// this block asserts THREE states. Two would not distinguish them.
// ═══════════════════════════════════════════════════════════════════════════

// Round-trips a colour through jsdom's own parser, so comparisons run on what
// jsdom stores rather than on the source text.
//
// ⚠ NEEDED BECAUSE A BARE HEX IS RE-SERIALISED. AD.amberText is '#92400E' in
// source and reads back as 'rgb(146, 64, 14)' off the element; AD.textSecondary
// is already an rgba() and round-trips near-verbatim. Comparing a token to its
// raw source string would fail while the component was perfectly correct — the
// same trap recorded in LockedSection.test.jsx.
function cssColour(value) {
  const el = document.createElement('div');
  el.style.color = value;
  return el.style.color;
}

// The quick-action card's sub-line <p>, which carries BOTH the text and the
// colour (AdminDashboard.jsx:233-234: label <p> then sub <p>).
function quickActionSub(label) {
  const hits = screen.getAllByText(label).filter(el => el.tagName === 'P');
  // Non-vacuity: an empty result would make every assertion below vacuous.
  expect(hits).toHaveLength(1);
  return hits[0].nextElementSibling;
}

// The pipeline legend row for `label` (AdminDashboard.jsx:213-218). Its three
// spans are, in order: label, value, "(N%)".
//
// ⚠ textTransform IS WHAT SEPARATES THESE FROM THE StatCards. "Sold" is both a
// legend entry and a StatCard label; StatCard's label span is uppercase
// (AdminComponents.jsx:19) and the legend's is not (AdminDashboard.jsx:215).
function legendPct(label) {
  const hits = screen.getAllByText(label)
    .filter(el => el.tagName === 'SPAN' && el.style.textTransform !== 'uppercase');
  expect(hits).toHaveLength(1);
  const spans = hits[0].parentElement.querySelectorAll('span');
  expect(spans).toHaveLength(3);
  return spans[2].textContent;
}

describe('(a) Review Payouts must distinguish absent from zero', () => {

  // Non-vacuity for every colour assertion below. If these two tokens ever
  // resolved to the same computed value, "amber not grey" would prove nothing
  // and all three state tests would agree with each other while testing air.
  it('the two state colours are actually distinguishable', () => {
    expect(cssColour(AD.amberText)).not.toBe(cssColour(AD.textSecondary));
  });

  it('POPULATED — a real count, in amber', async () => {
    await renderWith({ ...STATS_FULL, pendingCashouts: 3 });
    const sub = quickActionSub('Review Payouts');
    expect(sub.textContent).toBe('3 pending review');
    expect(sub.style.color).toBe(cssColour(AD.amberText));
  });

  // ⚠ THIS TEST IS WHAT STOPS THE FIX OVER-REACHING. A guard that treated every
  // falsy count as unknown would swallow the legitimate all-clear and turn the
  // ABSENT test below green while breaking the real product behaviour.
  it('ZERO — the all-clear survives, in the calm colour', async () => {
    await renderWith({ ...STATS_FULL, pendingCashouts: 0 });
    const sub = quickActionSub('Review Payouts');
    expect(sub.textContent).toBe('All caught up');
    expect(sub.style.color).toBe(cssColour(AD.textSecondary));
  });

  // ⚠ ASSERTS WHAT IT DOES SAY, NOT WHAT IT DOESN'T. A test proving only "does
  // not say All caught up" passes against "0 pending review" — which is the
  // OTHER falsehood, and the one a naive fix produces.
  it('[RED] ABSENT — says the count is unknown, and is NOT styled as reassurance', async () => {
    await renderWith({ ...STATS_FULL, pendingCashouts: undefined });
    const sub = quickActionSub('Review Payouts');
    expect(sub.textContent).toBe('— pending review');
    // The colour is the more-read channel. Fixing the words alone ships a card
    // whose strongest visual signal still says "relax".
    expect(sub.style.color).toBe(cssColour(AD.amberText));
    expect(sub.style.color).not.toBe(cssColour(AD.textSecondary));
  });
});

describe('(c) the pipeline legend must not report a confident 0%', () => {

  it('POPULATED — real percentages', async () => {
    await renderWith(STATS_FULL);
    // 108 + 74 + 91 + 38 = 311. 108/311 = 34.7% → 35.
    expect(legendPct('Lead')).toBe('(35%)');
    expect(legendPct('Sold')).toBe('(29%)');
  });

  // ⚠ THE OVER-REACH FENCE, as above. An empty pipeline genuinely IS 0% — that
  // is a true statement about known data, and it must survive.
  it('ZERO — a genuinely empty pipeline still reports 0%', async () => {
    await renderWith({
      ...STATS_FULL,
      totalLeads: 0, totalInspections: 0, totalSold: 0, totalNotSold: 0,
    });
    expect(legendPct('Lead')).toBe('(0%)');
    expect(legendPct('Sold')).toBe('(0%)');
  });

  // pipelineTotal is NaN here, and `NaN > 0` is false, so today every segment
  // reports a confident, precise zero where the truth is unknown.
  it('[RED] ABSENT — a fieldless payload reports unknown, not 0%', async () => {
    await renderWith({});
    expect(legendPct('Lead')).toBe('(—%)');
    expect(legendPct('Sold')).toBe('(—%)');
  });

  // ⚠ THIS DOES NOT ISOLATE pct()'s `val` GUARD, AND AN EARLIER DRAFT OF THIS
  // COMMENT CLAIMED IT DID. It cannot: pipelineTotal (AdminDashboard.jsx:83) is
  // the SUM of these same four fields, so any absent val makes pipelineTotal
  // non-finite too and the pipelineTotal guard fires first. There is no payload
  // reachable through this call path that exercises the val guard alone.
  //
  // What it DOES pin is the realistic schema-drift shape — ONE field renamed or
  // dropped, not all of them — and the requirement that the legend degrade
  // WHOLESALE to unknown rather than to a mix of real-looking and fabricated
  // percentages. A partially-trustworthy row is worse than an untrustworthy one,
  // because it invites the reader to trust the half that still looks right.
  it('[RED] ONE FIELD ABSENT — the whole legend reports unknown, not a mix', async () => {
    await renderWith({ ...STATS_FULL, totalNotSold: undefined });
    expect(legendPct('Not Sold')).toBe('(—%)');
    expect(legendPct('Lead')).toBe('(—%)');
    expect(legendPct('Sold')).toBe('(—%)');
  });
});
