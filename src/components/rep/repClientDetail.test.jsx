// ── CANVASS-5: CLIENT DETAIL AND PAGING ─────────────────────────────────────
//
// ⚠ WHAT jsdom CAN AND CANNOT SETTLE. jsdom resolves NO `var()` and performs NO
// layout, so every colour claim here is DECLARATION-LEVEL — it proves which token a
// site reaches for, never what it paints. The painted figures come from the browser
// pass and are recorded in the commit and the checklist. A login screen once shipped
// at 1.34:1 under 654 green tests, which is why this distinction is stated rather
// than assumed.
//
// What IS settled here: which strings render, which branch runs, that the lock is
// never shown to a permitted rep, and that paging appends rather than replaces.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ThemeProvider from '../shared/ThemeProvider';
import RepClientDetailScreen, { RevenueCard } from './RepClientDetailScreen';
import RepClientsScreen from './RepClientsScreen';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';

function detailPayload(over = {}) {
  return {
    jobberClientId: 'jc-1',
    name: 'Maria Lopez',
    nameUnavailable: false,
    email: 'maria@example.test',
    phone: '770-555-0100',
    stage: 'sold',
    referredBy: null,
    assignmentSource: 'mode_a_at_close',
    isSticky: true,
    assignedAt: '2026-09-15T12:00:00Z',
    isFlagged: false,
    membership: null,
    revenue_hidden: true,
    ...over,
  };
}

function mountDetail(payload, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status === 200, status, json: async () => payload,
  });
  return render(<ThemeProvider><RepClientDetailScreen clientId="jc-1" onBack={() => {}} /></ThemeProvider>);
}

beforeEach(() => { localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token'); });
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('Canvass-5 — the detail screen renders the assignment record', () => {
  it('shows the name, the source in real vocabulary, and the locked pill', async () => {
    mountDetail(detailPayload());
    expect(await screen.findByText('Maria Lopez')).toBeTruthy();
    expect(screen.getByText(/Source: Assessment/)).toBeTruthy();
    expect(screen.getByText(/First assignment locked/)).toBeTruthy();
    expect(screen.getByText('Locked')).toBeTruthy();
  });

  it('⚠ a PROVISIONAL assignment is not described as locked', async () => {
    // The mockup's subtitle reads "Sticky assignment record", which is false of a
    // provisional assignment — a state it assumes away entirely.
    mountDetail(detailPayload({ isSticky: false, assignmentSource: 'mode_a' }));
    expect(await screen.findByText(/Provisional — not yet locked/)).toBeTruthy();
    expect(screen.queryByText(/First assignment locked/)).toBeNull();
    expect(screen.getByText('Provisional')).toBeTruthy();
  });

  it('shows the stage, and says so honestly when there is no referral record', async () => {
    mountDetail(detailPayload({ stage: null }));
    expect(await screen.findByText('No referral record')).toBeTruthy();
  });

  it('⚠ the referral CHAIN is not drawn — only the one fact that exists', async () => {
    // The mockup draws `Danny → Sarah K. → Maria Lopez`. There is no data behind it:
    // the link is a name string with no foreign key. The name is true; the chain
    // would be an invention.
    mountDetail(detailPayload({ referredBy: 'Sarah K.' }));
    expect(await screen.findByText(/Referred by Sarah K\./)).toBeTruthy();
    expect(screen.queryByText(/→/)).toBeNull();
  });

  it('a client with no client record opens and says so, without claiming a name', async () => {
    mountDetail(detailPayload({ name: null, nameUnavailable: true, email: null, phone: null }));
    expect(await screen.findByText('Details not available yet')).toBeTruthy();
    expect(screen.queryByText('Unnamed client')).toBeNull();
    expect(screen.queryByText('null')).toBeNull();
  });

  it('A34.8 — a 404 reads as "not in your book", never as an error', async () => {
    mountDetail({}, 404);
    expect(await screen.findByText('This client is not in your book.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a real failure reports an error rather than "not in your book"', async () => {
    // ⚠ THE DISTINCTION MATTERS: "not yours" and "we could not load it" are different
    // claims, and collapsing them tells a rep they lost a client when the network failed.
    mountDetail({}, 500);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText('This client is not in your book.')).toBeNull();
  });

  it('the flagged card appears only when a flag names this rep', async () => {
    const { unmount } = mountDetail(detailPayload({ isFlagged: false }));
    expect(await screen.findByText('Maria Lopez')).toBeTruthy();
    expect(screen.queryByText('Pending review')).toBeNull();
    unmount();

    mountDetail(detailPayload({ isFlagged: true }));
    expect(await screen.findByText('Pending review')).toBeTruthy();
    expect(screen.getByText('Flagged')).toBeTruthy();
  });
});

describe('Canvass-5 — A34.6: the lock and the empty state are different answers', () => {
  it('WITHOUT revenue visibility the rep sees the locked treatment', () => {
    render(<ThemeProvider><RevenueCard revenueHidden /></ThemeProvider>);
    expect(screen.getByText('Revenue is not shown for your account.')).toBeTruthy();
  });

  it('⚠ WITH revenue visibility the rep sees "no revenue recorded yet" — NEVER the lock', () => {
    // ⚠ THIS IS A34.6'S WHOLE POINT. Reusing the lock for both makes "you may not see
    // this" and "this does not exist yet" indistinguishable on screen, and tells a
    // permitted rep they are not permitted.
    render(<ThemeProvider><RevenueCard revenueHidden={false} /></ThemeProvider>);
    expect(screen.getByText('No revenue recorded yet.')).toBeTruthy();
    expect(screen.queryByText('Revenue is not shown for your account.')).toBeNull();
  });

  it('⚠ the two states are distinguishable on the same mount — paired, not asserted apart', () => {
    // A flag-OFF case alone passes identically against completely unwired code, because
    // the default is "hidden". The pair is what proves the value reaches the component.
    const { container: locked } = render(<ThemeProvider><RevenueCard revenueHidden /></ThemeProvider>);
    const { container: open } = render(<ThemeProvider><RevenueCard revenueHidden={false} /></ThemeProvider>);
    expect(locked.textContent).not.toBe(open.textContent);
  });

  it('a permitted rep never renders a lock glyph', async () => {
    // Declaration-level: asserts the SVG the lock icon renders is absent, not its colour.
    const { container } = render(<ThemeProvider><RevenueCard revenueHidden={false} /></ThemeProvider>);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('an end-to-end permitted payload shows the empty state, not the lock', async () => {
    mountDetail(detailPayload({ revenue_hidden: false, revenue: null }));
    expect(await screen.findByText('No revenue recorded yet.')).toBeTruthy();
    expect(screen.queryByText('Revenue is not shown for your account.')).toBeNull();
  });
});

describe('Canvass-5 — paging the list', () => {
  // ⚠ THE MOCK DISPATCHES ON URL, NOT ON CALL ORDER, AND THE FIRST DRAFT DID NOT.
  // `mockResolvedValueOnce` chains assume the component under test is the only caller.
  // It is not: ThemeProvider fetches /api/preferences/theme-mode and
  // /api/session/branding on mount, so page 2's payload was being handed to the THEME
  // request and the real page-2 call fell through to an undefined mock — which the
  // component correctly reported as a failed page. **The test was wrong and the code
  // was right**, and an order-keyed double is what hid it.
  function routedFetch(routes) {
    return vi.fn((url) => {
      const hit = Object.keys(routes).find((k) => String(url).includes(k));
      // ⚠ THROWS on an unrouted URL rather than returning something plausible. A double
      // that can also stand in for "no answer" is indistinguishable from the failure.
      if (!hit) return Promise.reject(new Error(`unrouted fetch: ${url}`));
      const value = routes[hit];
      const payload = typeof value === 'function' ? value() : value;
      return Promise.resolve({ ok: true, status: 200, json: async () => payload });
    });
  }

  const THEME_ROUTES = {
    '/api/preferences/theme-mode': { mode: 'light' },
    '/api/session/branding': {},
  };

  function page(ids, nextCursor, total) {
    return {
      clients: ids.map((i) => ({
        jobberClientId: i, name: `Client ${i}`, nameUnavailable: false,
        stage: 'sold', assignmentSource: 'mode_a_at_close', isSticky: true,
        assignedAt: '2026-09-15T12:00:00Z', isFlagged: false, membership: null,
      })),
      total, limit: 100, nextCursor,
    };
  }

  it('⚠ Load more APPENDS the next page rather than replacing it', async () => {
    const fetchMock = routedFetch({
      ...THEME_ROUTES,
      'cursor=': page(['c', 'd'], null, 4),          // page 2 — matched first, it is more specific
      '/api/rep/clients': page(['a', 'b'], 'CURSOR1', 4),
    });
    global.fetch = fetchMock;

    render(<ThemeProvider><RepClientsScreen /></ThemeProvider>);
    expect(await screen.findByText('Client a')).toBeTruthy();
    expect(screen.queryByText('Client c')).toBeNull();

    fireEvent.click(screen.getByText('Load more'));
    expect(await screen.findByText('Client c')).toBeTruthy();
    // ⚠ PAGE 1 MUST STILL BE THERE. A replace would look correct on page 2 and lose
    // everything above it, which is the failure a rep notices only by scrolling up.
    expect(screen.getByText('Client a')).toBeTruthy();
    expect(screen.getByText('Client d')).toBeTruthy();
  });

  it('the cursor is sent on the second request and not on the first', async () => {
    const fetchMock = routedFetch({
      ...THEME_ROUTES,
      'cursor=': page(['b'], null, 2),
      '/api/rep/clients': page(['a'], 'CURSOR1', 2),
    });
    global.fetch = fetchMock;

    render(<ThemeProvider><RepClientsScreen /></ThemeProvider>);
    await screen.findByText('Client a');
    // ⚠ SELECT THE CALLS BY URL, NEVER BY INDEX — ThemeProvider's own fetches sit
    // between them, so calls[0]/calls[1] name whatever happened to run first.
    const bookCalls = () => fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('/api/rep/clients'));
    expect(bookCalls()).toHaveLength(1);
    expect(bookCalls()[0]).not.toContain('cursor=');

    fireEvent.click(screen.getByText('Load more'));
    await screen.findByText('Client b');
    expect(bookCalls()).toHaveLength(2);
    expect(bookCalls()[1]).toContain('cursor=CURSOR1');
  });

  it('⚠ the control disappears on the last page — absence is how the end is known', async () => {
    global.fetch = routedFetch({ ...THEME_ROUTES, '/api/rep/clients': page(['a'], null, 1) });
    render(<ThemeProvider><RepClientsScreen /></ThemeProvider>);
    await screen.findByText('Client a');
    expect(screen.queryByText('Load more')).toBeNull();
  });

  it('⚠ a failed page keeps the rows AND the cursor — a transient error is not the end', async () => {
    // Clearing the cursor on failure would make a blip look like the end of the book,
    // permanently, with nothing to say so.
    const fetchMock = vi.fn((url) => {
      if (String(url).includes('cursor=')) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      if (String(url).includes('/api/rep/clients')) return Promise.resolve({ ok: true, status: 200, json: async () => page(['a'], 'CURSOR1', 3) });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    global.fetch = fetchMock;

    render(<ThemeProvider><RepClientsScreen /></ThemeProvider>);
    await screen.findByText('Client a');
    fireEvent.click(screen.getByText('Load more'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Client a')).toBeTruthy();
    expect(screen.getByText('Load more')).toBeTruthy();
  });

  it('the count reports the real total while only part of it is loaded', async () => {
    global.fetch = routedFetch({ ...THEME_ROUTES, '/api/rep/clients': page(['a', 'b'], 'C', 3756) });
    render(<ThemeProvider><RepClientsScreen /></ThemeProvider>);
    // ⚠ Anchored on the surrounding phrase, not the bare number — "3756" alone would
    // match "13756" too.
    expect(await screen.findByText(/Showing 2 of 3756/)).toBeTruthy();
  });

  it('tapping a row asks the shell to open that client', async () => {
    global.fetch = routedFetch({ ...THEME_ROUTES, '/api/rep/clients': page(['a'], null, 1) });
    const onOpenClient = vi.fn();
    render(<ThemeProvider><RepClientsScreen onOpenClient={onOpenClient} /></ThemeProvider>);
    fireEvent.click(await screen.findByText('Client a'));
    expect(onOpenClient).toHaveBeenCalledWith('a');
  });
});
