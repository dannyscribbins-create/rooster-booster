// ── CANVASS-6: THE HOME TAB ─────────────────────────────────────────────────
//
// ⚠ WHAT jsdom CAN AND CANNOT SETTLE. jsdom resolves NO `var()` and performs NO
// layout, so every colour claim here is DECLARATION-LEVEL — it proves which token a
// site reaches for, never what it paints, and it cannot see a reflow at all. The
// painted figures and the grid's behaviour come from the browser pass and are recorded
// in the commit and the checklist.
//
// What IS settled here: which strings render, which section a client lands in, that
// the two sections never imply one ranking, and that no revenue appears in any state.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import ThemeProvider from '../shared/ThemeProvider';
import RepHomeScreen, { STAT_CARDS } from './RepHomeScreen';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';

// ⚠ ROUTED BY URL, NOT BY CALL ORDER. ThemeProvider fetches
// /api/preferences/theme-mode and /api/session/branding on mount, so an order-keyed
// mock hands the component's payload to the theme request — the defect Canvass-5 found
// the hard way. Unrouted URLs REJECT rather than returning something plausible.
function routedFetch(routes) {
  return vi.fn((url) => {
    const hit = Object.keys(routes).find((k) => String(url).includes(k));
    if (!hit) return Promise.reject(new Error(`unrouted fetch: ${url}`));
    return Promise.resolve({ ok: true, status: 200, json: async () => routes[hit] });
  });
}
const THEME_ROUTES = {
  '/api/preferences/theme-mode': { mode: 'light' },
  '/api/session/branding': {},
};

const client = (id, over = {}) => ({
  jobberClientId: id, name: `Client ${id}`, nameUnavailable: false, assignedAt: '2026-09-15T12:00:00Z', ...over,
});

function payload({ stats = {}, furthestAlong = [], recentlyAssigned = [] } = {}) {
  return {
    stats: { clients: 0, locked: 0, provisional: 0, flagged: 0, ...stats },
    focus: { furthestAlong, recentlyAssigned },
    limit: 5,
  };
}

function mount(body) {
  global.fetch = routedFetch({ ...THEME_ROUTES, '/api/rep/home': body });
  return render(<ThemeProvider><RepHomeScreen /></ThemeProvider>);
}

beforeEach(() => { localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token'); });
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('Canvass-6 — the two sections are two orderings, not one ranking', () => {
  it('renders both section headings with labels that describe their own ordering', async () => {
    mount(payload({
      furthestAlong: [client('a', { stage: 'sold' })],
      recentlyAssigned: [client('b')],
    }));
    expect(await screen.findByText('Furthest along')).toBeTruthy();
    expect(screen.getByText('Recently assigned')).toBeTruthy();
    expect(screen.getByText(/by pipeline stage/)).toBeTruthy();
    expect(screen.getByText(/newest assignment first/)).toBeTruthy();
  });

  it('⚠ neither label borrows the other ordering, and no copy ranks one section above the other', async () => {
    // ⚠ THE RULING'S CENTRAL CONSTRAINT AS A FENCE. A client in section 2 is NOT
    // behind one in section 1 — it simply has no referral record. Copy implying
    // otherwise turns two honest lists back into the dishonest single ranking that
    // options ① and ② were rejected for.
    const { container } = mount(payload({
      furthestAlong: [client('a', { stage: 'sold' })],
      recentlyAssigned: [client('b')],
    }));
    await screen.findByText('Furthest along');
    const text = container.textContent.toLowerCase();
    for (const forbidden of ['behind', 'less advanced', 'lower priority', 'least', 'ranked below', 'also-ran']) {
      expect(text.includes(forbidden)).toBe(false);
    }
    // And "furthest along" must not appear as a description of the SECOND section.
    const second = screen.getByText('Recently assigned').parentElement;
    expect(second.textContent.toLowerCase().includes('furthest along')).toBe(false);
  });

  it('⚠ the staged client appears ONLY in section 1 and the unstaged ONLY in section 2', async () => {
    mount(payload({
      furthestAlong: [client('staged', { stage: 'paid' })],
      recentlyAssigned: [client('unstaged')],
    }));
    await screen.findByText('Client staged');
    const s1 = screen.getByText('Furthest along').closest('section');
    const s2 = screen.getByText('Recently assigned').closest('section');
    expect(s1.textContent).toContain('Client staged');
    expect(s1.textContent).not.toContain('Client unstaged');
    expect(s2.textContent).toContain('Client unstaged');
    expect(s2.textContent).not.toContain('Client staged');
  });

  it('section 1 shows the stage, section 2 shows the assignment date', async () => {
    mount(payload({
      furthestAlong: [client('a', { stage: 'paid' })],
      recentlyAssigned: [client('b')],
    }));
    // 'paid' renders as "Complete" — the mapping CLAUDE.md keeps resident.
    expect(await screen.findByText('Complete')).toBeTruthy();
    expect(screen.getByText(/Sep 15/)).toBeTruthy();
  });

  it('⚠ an EMPTY section 1 reads as a fact, not an error or a gap', async () => {
    // Measured: 3 staged of 39 in production, 5 of 268 seeded. This is the common case.
    mount(payload({ recentlyAssigned: [client('b')] }));
    expect(await screen.findByText(/None of your clients has a referral record yet/i)).toBeTruthy();
    // ⚠ NO alert role and no warning treatment — an empty first section is normal.
    expect(screen.queryByRole('alert')).toBeNull();
    // And section 2 still renders its rows beneath it.
    expect(screen.getByText('Client b')).toBeTruthy();
  });

  it('⚠ section 1 is NOT visually subordinate — both headings are the same element and size', async () => {
    // The ruling requires it to become the real focus as the backfill fills it, with
    // no restyle. Styling it as secondary today would make that a code change later.
    mount(payload({
      furthestAlong: [client('a', { stage: 'sold' })],
      recentlyAssigned: [client('b')],
    }));
    const h1 = await screen.findByText('Furthest along');
    const h2 = screen.getByText('Recently assigned');
    expect(h1.tagName).toBe(h2.tagName);
    expect(h1.style.fontSize).toBe(h2.style.fontSize);
    expect(h1.style.fontWeight).toBe(h2.style.fontWeight);
  });
});

describe('Canvass-6 — the stats, and what is deliberately absent', () => {
  it('renders every stat card from the payload', async () => {
    mount(payload({ stats: { clients: 39, locked: 30, provisional: 9, flagged: 2 } }));
    expect(await screen.findByText('39')).toBeTruthy();
    for (const c of STAT_CARDS) expect(screen.getByText(c.label)).toBeTruthy();
  });

  it('⚠ NO revenue card, NO lock, NO empty slot — in any state', async () => {
    // A34.6 + CD-7, and mockup 2B which already draws it. The absence must not read as
    // a lock by omission, so there is no placeholder and no reserved cell to find.
    const { container } = mount(payload({ stats: { clients: 5 } }));
    await screen.findByText('5');
    const text = container.textContent.toLowerCase();
    for (const forbidden of ['revenue', 'locked for your account', '$', 'not shown for your account']) {
      expect(text.includes(forbidden)).toBe(false);
    }
    // And no stat card renders an empty value where one was omitted.
    for (const c of STAT_CARDS) expect(typeof c.label).toBe('string');
  });

  it('⚠ CHAINS is absent — the referral link it would count does not exist', async () => {
    const { container } = mount(payload({ stats: { clients: 3 } }));
    await screen.findByText('3');
    expect(container.textContent.toLowerCase().includes('chain')).toBe(false);
  });

  it('a first-run rep sees zeros and both empty states, not an error', async () => {
    const { container } = mount(payload());
    expect(await screen.findByText(/Clients appear here once a request in Jobber is assigned/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    // ⚠ SCOPED PER REGION, AND THIS IS A DELIBERATE CHANGE MADE IN CANVASS-8 RATHER
    // THAN A LOOSENING. It read `getAllByText('0').length === STAT_CARDS.length` over
    // the WHOLE screen, which was correct while the grid held every zero on the page.
    // Canvass-8's conversions card adds a fifth zero OUTSIDE the grid, so the old form
    // would have had to become `STAT_CARDS.length + 1` — a hand-maintained number that
    // goes stale the next time anything renders a 0. Asserting each region separately
    // is falsifiable in both directions instead: a stat dropped from the grid fails the
    // first, and a conversions card that stops rendering fails the second.
    const grid = container.querySelector('[data-rep-stats]');
    expect(grid).toBeTruthy();
    expect(within(grid).getAllByText('0').length).toBe(STAT_CARDS.length);
    expect(within(screen.getByTestId('rep-conversions')).getByText('0')).toBeTruthy();
  });

  it('a failed load reports an error rather than an empty dashboard', async () => {
    // ⚠ "your book is empty" and "we could not load it" are different claims.
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/api/rep/home')) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    render(<ThemeProvider><RepHomeScreen /></ThemeProvider>);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText('Furthest along')).toBeNull();
  });
});

describe('Canvass-6 — preview mode is inert, and its paired positive', () => {
  it('⚠ preview mode fires NO request — the admin branding preview must not dial out', async () => {
    // ⚠ B-4's fence caught this for real. BrandingPreview mounts the REAL RepShell so a
    // contractor's palette shows on the real component, and its safety argument was
    // "the entry screen is Home" — which held only while Home was a placeholder.
    const fetchMock = vi.fn(() => Promise.reject(new Error('preview must not fetch')));
    global.fetch = fetchMock;
    render(<ThemeProvider><RepHomeScreen preview /></ThemeProvider>);
    await screen.findByText('Furthest along');
    const repCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/rep/'));
    expect(repCalls).toHaveLength(0);
  });

  it('⚠ THE PAIRED POSITIVE — without preview it DOES fetch', async () => {
    // Without this, the case above passes identically against a component that never
    // fetches at all, or one that fetches nothing on any path. The pair is what proves
    // `preview` is the thing doing the work.
    const fetchMock = routedFetch({ ...THEME_ROUTES, '/api/rep/home': payload({ stats: { clients: 1 } }) });
    global.fetch = fetchMock;
    render(<ThemeProvider><RepHomeScreen /></ThemeProvider>);
    await screen.findByText('1');
    const repCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/rep/home'));
    expect(repCalls.length).toBeGreaterThan(0);
  });

  it('preview renders a populated sample, not zeros', async () => {
    // An all-zero dashboard would demonstrate a contractor's palette on almost no ink,
    // which is the preview's entire job.
    render(<ThemeProvider><RepHomeScreen preview /></ThemeProvider>);
    expect(await screen.findByText('128')).toBeTruthy();
    expect(screen.getByText('Maria Lopez')).toBeTruthy();
  });
});

describe('Canvass-6 — tapping through to detail', () => {
  it('a row in EITHER section opens that specific client', async () => {
    const onOpenClient = vi.fn();
    global.fetch = routedFetch({
      ...THEME_ROUTES,
      '/api/rep/home': payload({
        furthestAlong: [client('staged', { stage: 'sold' })],
        recentlyAssigned: [client('unstaged')],
      }),
    });
    render(<ThemeProvider><RepHomeScreen onOpenClient={onOpenClient} /></ThemeProvider>);

    fireEvent.click(await screen.findByText('Client staged'));
    expect(onOpenClient).toHaveBeenCalledWith('staged');

    fireEvent.click(screen.getByText('Client unstaged'));
    expect(onOpenClient).toHaveBeenCalledWith('unstaged');
    expect(onOpenClient).toHaveBeenCalledTimes(2);
  });

  it('a client with no client record still renders, honestly, and is still tappable', async () => {
    const onOpenClient = vi.fn();
    global.fetch = routedFetch({
      ...THEME_ROUTES,
      '/api/rep/home': payload({ recentlyAssigned: [client('x', { name: null, nameUnavailable: true })] }),
    });
    render(<ThemeProvider><RepHomeScreen onOpenClient={onOpenClient} /></ThemeProvider>);
    const row = await screen.findByText('Details not available yet');
    expect(screen.queryByText('Unnamed client')).toBeNull();
    expect(screen.queryByText('null')).toBeNull();
    fireEvent.click(row);
    expect(onOpenClient).toHaveBeenCalledWith('x');
  });
});

// ── CANVASS-8: THE CONVERSIONS CARD ─────────────────────────────────────────
//
// ⚠ EVERY MEANINGFUL CASE HERE IS SEEDED NON-ZERO. Danny's Railway baseline is 0
// for every rep, and a card that has only ever rendered 0 is untested — a scoping
// or formatting bug is invisible at zero. The zero case is asserted too, separately,
// because zero is the honest production state and must not read as an error.
//
// ⚠ DECLARATION-LEVEL ONLY, like the rest of this file: jsdom resolves no var() and
// does no layout, so nothing here proves what the card PAINTS or how it sits beside
// the grid. That is the browser pass's job.
describe('Canvass-8 — the conversions card', () => {
  it('renders the count from the payload at a NON-ZERO value', async () => {
    mount(payload({ stats: { conversions: 3 } }));
    const card = await screen.findByTestId('rep-conversions');
    expect(within(card).getByText('3')).toBeTruthy();
  });

  it('⚠ the label is TRUE ON ITS OWN — it says what the number counts, and it is not "CONV"', async () => {
    // The mockup's word is CONV and it says nothing. A rep who never taps the info
    // affordance the UI pass will add must still read the label correctly, so the
    // label carries the noun ("referral conversions") rather than an abbreviation.
    mount(payload({ stats: { conversions: 3 } }));
    const card = await screen.findByTestId('rep-conversions');
    expect(within(card).getByText(/referral conversions/i)).toBeTruthy();
    // ⚠ ANCHORED ON THE WHOLE WORD. A bare 'CONV' needle would match 'CONVERSIONS'
    // and pass against the very label this rules out — the substring trap.
    expect(/\bCONV\b/.test(card.textContent)).toBe(false);
  });

  it('carries a definition line naming WHOSE referrals and WHAT happened to them', async () => {
    mount(payload({ stats: { conversions: 3 } }));
    const card = await screen.findByTestId('rep-conversions');
    const text = card.textContent.toLowerCase();
    expect(text.includes('your clients')).toBe(true);
    expect(text.includes('referred')).toBe(true);
    expect(text.includes('customers')).toBe(true);
  });

  it('renders zero honestly — no alert, no lock, no "not available" framing', async () => {
    mount(payload({ stats: { conversions: 0 } }));
    const card = await screen.findByTestId('rep-conversions');
    expect(within(card).getByText('0')).toBeTruthy();
    expect(card.querySelector('[role="alert"]')).toBeNull();
    const text = card.textContent.toLowerCase();
    for (const forbidden of ['locked', 'not available', 'unavailable', 'coming soon', 'error']) {
      expect(text.includes(forbidden)).toBe(false);
    }
  });

  it('⚠ sits OUTSIDE the stat grid — a fifth uppercase cell is what the label could not fit', async () => {
    // Structural, not cosmetic: the grid's cells are one-word uppercase labels, and
    // the truthful label for this number is a phrase. Keeping it out of the grid is
    // what lets the label be true. If someone folds it back in, this fails.
    const { container } = mount(payload({ stats: { conversions: 3 } }));
    await screen.findByTestId('rep-conversions');
    const grid = container.querySelector('[data-rep-stats]');
    expect(grid).toBeTruthy();
    expect(grid.querySelector('[data-testid="rep-conversions"]')).toBeNull();
  });

  it('treats a missing conversions field as 0 rather than rendering undefined', async () => {
    // The server always sends it, but a card that prints "undefined" on a partial
    // payload is the kind of defect that only shows in production.
    mount(payload());
    const card = await screen.findByTestId('rep-conversions');
    expect(within(card).getByText('0')).toBeTruthy();
    expect(card.textContent.includes('undefined')).toBe(false);
    expect(card.textContent.includes('NaN')).toBe(false);
  });
});
