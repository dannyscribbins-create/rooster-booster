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
  // ⚠ THE NEEDLE CHANGED SHAPE IN CANVASS-9a BECAUSE THE MARKUP DID, AND THE PROPERTY
  // IS UNCHANGED. Part 5 split the run-on `Source: X · Y · Assigned Z` paragraph into
  // labelled `dt`/`dd` field rows — that was the fix for the two-line cramped wrap
  // Canvass-8 measured — so `/Source: Assessment/` can no longer match: the label and
  // the value are now two elements and there is no colon between them.
  // ⚠ ASSERTED AS A LABEL/VALUE PAIR RATHER THAN BY LOOSENING THE REGEX. A relaxed
  // `/Assessment/` would pass against a screen that had lost the "Source" label
  // entirely, which is precisely the structure this phase added — so the pairing is
  // what has to be pinned, not the value's presence somewhere on the page.
  it('shows the name, the source as a labelled field, and the locked pill', async () => {
    mountDetail(detailPayload());
    expect(await screen.findByText('Maria Lopez')).toBeTruthy();
    const sourceLabel = screen.getByText('Source');
    expect(sourceLabel.tagName).toBe('DT');
    // The value is this label's own sibling, not merely somewhere in the document.
    expect(sourceLabel.nextElementSibling.tagName).toBe('DD');
    expect(sourceLabel.nextElementSibling.textContent).toBe('Assessment');
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
    // ⚠ SAME MARKUP CHANGE AS THE SOURCE FIELD ABOVE (Part 5): "Referred by" is now a
    // `dt` and the name its `dd`, so one regex can no longer span both. The chain
    // assertion — which is the point of this case — is untouched.
    mountDetail(detailPayload({ referredBy: 'Sarah K.' }));
    const label = await screen.findByText('Referred by');
    expect(label.tagName).toBe('DT');
    expect(label.nextElementSibling.textContent).toBe('Sarah K.');
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
    // Declaration-level: asserts the lock icon is absent, not its colour.
    //
    // ⚠ THE NEEDLE NAMES ITS SUBJECT SINCE 9b. It was `querySelector('svg')` — "no
    // icon at all" — which was correct only while the lock was the ONLY icon on this
    // card. 9b added the reveal's caret, a legitimate non-lock SVG, and the old
    // needle went red without the behaviour changing. **A bare needle standing in
    // for a specific subject is this repo's most-recorded trap, and this is an
    // instance of it in an existing test rather than a new one.**
    const { container } = render(<ThemeProvider><RevenueCard revenueHidden={false} /></ThemeProvider>);
    expect(container.querySelector('[data-rep-revenue-lock]')).toBeNull();
    // ⚠ AND THE PAIRED POSITIVE, so the handle is proven to exist at all — without
    // it, a renamed attribute would make this assertion permanently satisfied.
    const locked = render(<ThemeProvider><RevenueCard revenueHidden /></ThemeProvider>);
    expect(locked.container.querySelector('[data-rep-revenue-lock]')).toBeTruthy();
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

// ═══════════════════════════════════════════════════════════════════════════
// CANVASS-9a PART 5 — THE DETAIL SCREEN IS GROUPED INTO NAMED SECTIONS
//
// Danny: "all clunked together in scribble right now." The header card carried the
// client's identity, two badges, THREE attribution facts as a separator-joined
// sentence, and the contact details — four unrelated kinds of information in one box,
// at one visual weight, with no labels.
describe('Canvass-9a Part 5 — the detail screen is grouped, and the attribution no longer wraps', () => {
  it('renders four NAMED sections in relevance order', async () => {
    mountDetail(detailPayload());
    await screen.findByText('Maria Lopez');
    // ⚠ ORDER AS WELL AS PRESENCE. Four sections that all exist in an arbitrary order
    // would satisfy a presence-only assertion while still reading as a scribble.
    const titles = [...document.querySelectorAll('h2')].map((h) => h.textContent);
    expect(titles).toEqual(['Attribution', 'Pipeline', 'Value']);
    // The client card leads and is deliberately UNTITLED — the client's own name is its
    // heading, and a "CLIENT" label above a person's name is a label nobody needs.
    const firstSection = document.querySelectorAll('section')[0];
    expect(firstSection.textContent).toContain('Maria Lopez');
  });

  it('⚠ the three attribution facts are SEPARATE labelled rows, not one joined sentence', async () => {
    // This is the fix for the two-line cramped wrap Canvass-8 measured. The cause was
    // the SHAPE — three facts joined with a separator into one paragraph, broken by the
    // browser wherever it ran out of room, mid-fact, with the separator orphaned.
    mountDetail(detailPayload());
    await screen.findByText('Maria Lopez');
    const labels = [...document.querySelectorAll('dt')].map((d) => d.textContent);
    expect(labels).toContain('Source');
    expect(labels).toContain('Status');
    expect(labels).toContain('Assigned');
    // ⚠ AND THE SEPARATOR IS GONE FROM THE ATTRIBUTION CARD ENTIRELY, which is the
    // character that was being orphaned. Asserted on the card rather than the page,
    // because other parts of the screen may legitimately use it.
    const attributionCard = [...document.querySelectorAll('section')]
      .find((s) => s.textContent.includes('Attribution'));
    expect(attributionCard.textContent).not.toContain(' · ');
  });

  it('⚠ each value is its label’s OWN sibling, not merely somewhere on the page', async () => {
    // A `getByText` for the value would pass against a screen whose labels and values
    // had drifted apart — the pairing is the property, and `dt`/`dd` adjacency is it.
    mountDetail(detailPayload());
    await screen.findByText('Maria Lopez');
    const pairs = {};
    for (const dt of document.querySelectorAll('dt')) {
      pairs[dt.textContent] = dt.nextElementSibling && dt.nextElementSibling.textContent;
    }
    expect(pairs.Source).toBe('Assessment');
    expect(pairs.Status).toBe('First assignment locked');
  });

  it('⚠ an ABSENT assignment date omits its row rather than rendering a dash', async () => {
    // A dash in a labelled row is a claim that we looked and there was nothing; an
    // absent row makes no claim. Same rule as the membership badge.
    mountDetail(detailPayload({ assignedAt: null }));
    await screen.findByText('Maria Lopez');
    const labels = [...document.querySelectorAll('dt')].map((d) => d.textContent);
    expect(labels).not.toContain('Assigned');
    // ⚠ THE PAIRED POSITIVE, so this is not satisfied by a screen that lost the row
    // entirely: the other two attribution rows must still be there.
    expect(labels).toContain('Source');
    expect(labels).toContain('Status');
  });

  it('⚠ the contact details are labelled fields on the CLIENT card, not a joined line', async () => {
    mountDetail(detailPayload());
    await screen.findByText('Maria Lopez');
    const pairs = {};
    for (const dt of document.querySelectorAll('dt')) {
      pairs[dt.textContent] = dt.nextElementSibling && dt.nextElementSibling.textContent;
    }
    expect(pairs.Email).toBeTruthy();
    // And they sit on the FIRST section, beside the name, rather than in the
    // attribution record — "how to reach them" is not an attribution fact.
    const firstSection = document.querySelectorAll('section')[0];
    expect(firstSection.textContent).toContain(pairs.Email);
  });

  it('⚠ the status PILL moved to the attribution card, off the client card', async () => {
    // A correction rather than a rearrangement: "locked or provisional" is a fact about
    // the RECORD, and sitting beside the client's name it read as a property of the
    // PERSON.
    mountDetail(detailPayload());
    await screen.findByText('Maria Lopez');
    const sections = [...document.querySelectorAll('section')];
    const clientCard = sections[0];
    const attributionCard = sections.find((s) => s.textContent.includes('Attribution'));
    expect(attributionCard.textContent).toContain('Locked');
    // The client card keeps the MEMBERSHIP badge, which genuinely is about the person.
    expect(clientCard.textContent).not.toContain('Locked');
  });
});
