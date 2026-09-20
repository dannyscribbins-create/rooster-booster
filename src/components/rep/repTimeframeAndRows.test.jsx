// ─────────────────────────────────────────────────────────────────────────────
// CANVASS-9a — THE TIMEFRAME BAR, THE ROW AFFORDANCE, AND THE STAT CARDS
//
// Covers Parts 3b/3e/3f and 4a/4b/4c/4d on the CLIENT side. The server half is
// `server/test/repClients.test.js`'s "the timeframe window" block and
// `server/test/repTimeframe.test.js`; the two halves deliberately assert different
// things — the server owns "which rows", this owns "does the control reach the
// request, and does the row look tappable".
//
// ⚠ WHY THE REQUEST URL IS ASSERTED HERE AND NOT JUST THE RENDERED BAR. A bar that
// renders four buttons and changes a local `useState` while the fetch keeps asking
// for `all` would look completely correct on screen and in any test of the bar
// alone. That is the "a test that injects the value itself cannot discover that
// nothing upstream supplies it" shape with the layers inverted — the control is
// present and nothing consumes it. So these cases read the URL the component
// actually requested.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import ThemeProvider from '../shared/ThemeProvider';
import RepHomeScreen from './RepHomeScreen';
import RepClientsScreen, { EmptyBook } from './RepClientsScreen';
import RepShell from './RepShell';
import RepTimeframeBar, { TIMEFRAMES, TIMEFRAME_PHRASES } from './RepTimeframeBar';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';

const homePayload = (stats = {}) => ({
  stats: { clients: 3, locked: 2, provisional: 1, flagged: 1, conversions: 4, ...stats },
  focus: { furthestAlong: [], recentlyAssigned: [] },
});

const clientsPayload = (over = {}) => ({
  clients: [],
  total: 0,
  limit: 100,
  nextCursor: null,
  counts: { locked: 2, provisional: 1 },
  ...over,
});

// Records every URL requested, so a case can assert what the component ASKED for
// rather than only what it rendered.
function installFetch(body) {
  const calls = [];
  global.fetch = vi.fn((url) => {
    calls.push(String(url));
    return Promise.resolve({ ok: true, status: 200, json: async () => body });
  });
  return calls;
}

beforeEach(() => { localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token'); });
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); cleanup(); });

const wrap = (ui) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('Canvass-9a — the timeframe bar as a control', () => {
  it('renders all four windows, with `all` selected by default', () => {
    const onChange = vi.fn();
    wrap(<RepTimeframeBar value="all" onChange={onChange} />);
    for (const t of TIMEFRAMES) {
      expect(screen.getByText(t.label), `${t.key} option missing`).toBeTruthy();
    }
    const all = document.querySelector('[data-rep-timeframe-option="all"]');
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-rep-timeframe-option="week"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('⚠ re-tapping the SELECTED window fires nothing — the paired negative', () => {
    // Without this, "tapping fires onChange" is satisfied by a bar that re-requests on
    // every tap, which on the Clients tab would throw the list away and rebuild it for
    // no change. The positive is the case below.
    const onChange = vi.fn();
    wrap(<RepTimeframeBar value="all" onChange={onChange} />);
    fireEvent.click(document.querySelector('[data-rep-timeframe-option="all"]'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('tapping an UNSELECTED window reports that window', () => {
    const onChange = vi.fn();
    wrap(<RepTimeframeBar value="all" onChange={onChange} />);
    fireEvent.click(document.querySelector('[data-rep-timeframe-option="month"]'));
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('⚠ the selected option is the ONLY one filled, and its ink is the computed pair', () => {
    // `--rm-on-primary` is COMPUTED under a contrast floor against the primary fill.
    // The platform primary is the orange #F26A1B whose floored pair is BLACK — so a
    // `#FFFFFF` fallback here would be the plausible wrong answer that
    // themeKeyIntegrity exists to catch, and has already caught on the Profile avatar.
    wrap(<RepTimeframeBar value="year" onChange={() => {}} />);
    const year = document.querySelector('[data-rep-timeframe-option="year"]');
    const week = document.querySelector('[data-rep-timeframe-option="week"]');
    expect(year.style.background).toContain('--rm-primary');
    expect(year.style.color).toContain('--rm-on-primary');
    expect(year.style.color).not.toContain('#FFFFFF');
    expect(week.style.background).toBe('transparent');
  });

  it('every window has a phrase, and `all` does not name a date range', () => {
    // The phrase is what states the window ONCE above the grid, which is the whole
    // answer to "make it obvious which cards respond".
    for (const t of TIMEFRAMES) {
      expect(typeof TIMEFRAME_PHRASES[t.key]).toBe('string');
      expect(TIMEFRAME_PHRASES[t.key].length).toBeGreaterThan(0);
    }
    expect(TIMEFRAME_PHRASES.all).toBe('all time');
  });
});

describe('Canvass-9a — Home: the window reaches the request, and the structure is the new one', () => {
  it('⚠ the FIRST request carries timeframe=all, and changing the window RE-REQUESTS', async () => {
    const calls = installFetch(homePayload());
    wrap(<RepHomeScreen />);
    await screen.findByText('Your book at a glance');
    expect(calls.some((u) => u.includes('/api/rep/home?timeframe=all'))).toBe(true);

    fireEvent.click(document.querySelector('[data-rep-timeframe-option="week"]'));
    await waitFor(() => {
      expect(calls.some((u) => u.includes('/api/rep/home?timeframe=week'))).toBe(true);
    });
  });

  it('the stats section is NAMED, and Today’s focus is a separate section below it', async () => {
    // Part 3c. The screen used to open with an h1 reading "Today's focus" whose subtitle
    // was "Your book at a glance" — so the stat grid was titled "Today's focus" and the
    // focus lists were untitled subsections of it.
    installFetch(homePayload());
    const { container } = wrap(<RepHomeScreen />);
    await screen.findByText('Your book at a glance');

    const statsSection = container.querySelector('[data-rep-stats-section]');
    const focusSection = container.querySelector('[data-rep-focus-section]');
    expect(statsSection).toBeTruthy();
    expect(focusSection).toBeTruthy();
    // ⚠ ORDER, NOT MERE PRESENCE. "stats at the top, Today's Focus below them" is the
    // instruction, and two sections that both exist in the wrong order would satisfy a
    // presence-only assertion.
    expect(statsSection.compareDocumentPosition(focusSection) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    // The stat grid is INSIDE the named stats section, not floating above both.
    expect(statsSection.querySelector('[data-rep-stats]')).toBeTruthy();
    // And the timeframe bar sits inside the stats section, so it does not appear to
    // govern Today's Focus — which it deliberately does not.
    expect(statsSection.querySelector('[data-rep-timeframe]')).toBeTruthy();
    expect(focusSection.querySelector('[data-rep-timeframe]')).toBeNull();
  });

  it('the h1 is a GREETING, not a section name', async () => {
    installFetch(homePayload());
    const { container } = wrap(<RepHomeScreen caps={{ full_name: 'Dana Whitfield' }} />);
    await screen.findByText('Your book at a glance');
    const h1 = container.querySelector('h1');
    // ⚠ MATCHES THE GREETING SHAPE RATHER THAN A FIXED TIME OF DAY. Pinning "Good
    // morning" would make this test fail depending on when the suite runs — a real
    // flake, and one whose cause would look like a code defect.
    expect(h1.textContent).toMatch(/^Good (morning|afternoon|evening), Dana\.$/);
  });

  it('⚠ a rep with no resolved name is greeted WITHOUT a fabricated one', async () => {
    // `caps` is null until /api/admin/me lands, and a name is identity-bearing — there
    // is no default that is not somebody else's.
    installFetch(homePayload());
    const { container } = wrap(<RepHomeScreen caps={null} />);
    await screen.findByText('Your book at a glance');
    expect(container.querySelector('h1').textContent).toMatch(/^Good (morning|afternoon|evening)\.$/);
  });

  it('⚠ CLIENTS leads at full width and the two that partition it pair beneath', async () => {
    // Found by LOOKING, not by measuring — no contrast reading or count could have shown
    // it. Removing the fourth card left three at `flex: 1 1 40%`, so the third wrapped
    // ALONE and stretched to full width: a PROVISIONAL of 1 rendered at the same visual
    // weight as the conversions card, above a CLIENTS of 272.
    //
    // ⚠ ASSERTED AS THE FLEX CONTRACT RATHER THAN AS PIXELS, because jsdom performs no
    // layout — "the third card is on its own row" is not observable here. What IS
    // observable is the declaration that produces it, and that is where the defect lived.
    installFetch(homePayload());
    const { container } = wrap(<RepHomeScreen />);
    await screen.findByText('Your book at a glance');
    const cards = [...container.querySelector('[data-rep-stats]').children];
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain('CLIENTS');
    expect(cards[0].style.flex).toBe('1 1 100%');
    // ⚠ AND THE OTHER TWO MUST *NOT* BE WIDE — the paired negative. Without it, "the
    // first card is full width" is satisfied by three stacked full-width cards, which is
    // a worse version of the defect rather than a fix for it.
    expect(cards[1].style.flex).toBe('1 1 40%');
    expect(cards[2].style.flex).toBe('1 1 40%');
    // ⚠ EVERY CARD STILL GROWS. A `0` grow factor on any of them would leave a gap at the
    // end of its row — the HOLE this grid's own note forbids, which is the reason a
    // half-width lone card was rejected as the fix.
    for (const c of cards) expect(c.style.flex.startsWith('1 1 ')).toBe(true);
  });

  it('⚠ Part 3f — there is NO flagged stat card, though the payload still carries the count', async () => {
    // Ruled: Flagged is a pill on the rows it applies to, and a rep can take no action
    // on a flag an owner resolves. ⚠ THE PAIRED POSITIVE IS WHAT STOPS THIS GOING
    // VACUOUS: the payload genuinely carries `flagged: 1`, so "FLAGGED is absent" is
    // about the CARD and not about a fixture that forgot the field.
    installFetch(homePayload({ flagged: 1 }));
    const { container } = wrap(<RepHomeScreen />);
    await screen.findByText('Your book at a glance');
    const grid = container.querySelector('[data-rep-stats]');
    expect(grid.textContent).not.toContain('FLAGGED');
    // The three that DO ship, so the grid is proven to render at all.
    expect(grid.textContent).toContain('CLIENTS');
    expect(grid.textContent).toContain('LOCKED');
    expect(grid.textContent).toContain('PROVISIONAL');
  });
});

describe('Canvass-9a — Clients: the window, the cards, and the row', () => {
  it('⚠ the first request carries timeframe=all and the window re-requests', async () => {
    const calls = installFetch(clientsPayload());
    wrap(<RepClientsScreen />);
    await screen.findByText('No clients yet');
    expect(calls.some((u) => u.includes('/api/rep/clients?timeframe=all'))).toBe(true);
    fireEvent.click(document.querySelector('[data-rep-timeframe-option="year"]'));
    await waitFor(() => {
      expect(calls.some((u) => u.includes('/api/rep/clients?timeframe=year'))).toBe(true);
    });
  });

  it('Part 4a — Locked and Provisional cards render, and NOT Flagged', async () => {
    installFetch(clientsPayload({ counts: { locked: 7, provisional: 2 } }));
    const { container } = wrap(<RepClientsScreen />);
    await waitFor(() => expect(container.querySelector('[data-rep-book-stats]')).toBeTruthy());
    const cards = container.querySelector('[data-rep-book-stats]');
    expect(cards.textContent).toContain('LOCKED');
    expect(cards.textContent).toContain('PROVISIONAL');
    expect(cards.textContent).toContain('7');
    expect(cards.textContent).toContain('2');
    expect(cards.textContent).not.toContain('FLAGGED');
  });

  it('⚠ ABSENT counts render NO cards — absent is not zero', async () => {
    // The paired negative for the case above. A payload that lost the field must not
    // produce two confident zeros: that is the defect this codebase already shipped on
    // the admin money surface, where an admin was told affirmatively there was nothing
    // to review because `undefined > 0` is false.
    installFetch(clientsPayload({ counts: undefined }));
    const { container } = wrap(<RepClientsScreen />);
    await screen.findByText('No clients yet');
    expect(container.querySelector('[data-rep-book-stats]')).toBeNull();
  });

  it('⚠ a NON-NUMERIC count is refused rather than rendered', async () => {
    // `Number.isFinite` per field, not `!= null`. A string would render and then
    // concatenate: `"7" + 2` is `"72"`, a confidently wrong figure in a stat card.
    installFetch(clientsPayload({ counts: { locked: '7', provisional: 2 } }));
    const { container } = wrap(<RepClientsScreen />);
    await screen.findByText('No clients yet');
    expect(container.querySelector('[data-rep-book-stats]')).toBeNull();
  });

  it('⚠ a WINDOWED empty result does not claim the book is empty', async () => {
    // Reachable by a rep with 272 clients who tapped Week. Telling them their book is
    // empty is false, and it is the kind of false that reads as data loss. Same
    // distinction A34.6 draws on the revenue card, on a different screen.
    installFetch(clientsPayload());
    wrap(<RepClientsScreen />);
    await screen.findByText('No clients yet');
    fireEvent.click(document.querySelector('[data-rep-timeframe-option="week"]'));
    await screen.findByText('Nothing in this timeframe');
    expect(screen.queryByText('No clients yet')).toBeNull();
    // And it says how to get back, which is the part that makes it actionable.
    expect(screen.getByText(/Choose All to see your whole book/)).toBeTruthy();
  });

  it('EmptyBook renders the unfiltered copy for `all` — the sibling of the case above', () => {
    wrap(<EmptyBook timeframe="all" />);
    expect(screen.getByText('No clients yet')).toBeTruthy();
    expect(screen.queryByText('Nothing in this timeframe')).toBeNull();
  });
});

describe('Canvass-9a Part 3e — the rows read as tappable', () => {
  const row = (over = {}) => ({
    jobberClientId: 'jc-1',
    name: 'Maria Lopez',
    nameUnavailable: false,
    stage: 'sold',
    assignmentSource: 'mode_a_at_close',
    isSticky: true,
    assignedAt: '2026-09-15T12:00:00Z',
    isFlagged: false,
    membership: 'none',
    ...over,
  });

  it('⚠ a tappable row carries a chevron; an INERT row does not', async () => {
    // The pair is the whole assertion. "A chevron renders" would be satisfied by a
    // component that draws one unconditionally — which would promise a destination on
    // the admin branding preview's rows, where `onOpen` is genuinely absent.
    installFetch(clientsPayload({ clients: [row()], total: 1 }));
    const withOpen = wrap(<RepClientsScreen onOpenClient={() => {}} />);
    await screen.findByText('Maria Lopez');
    const li = withOpen.container.querySelector('li');
    expect(li.querySelector('svg'), 'no chevron on a tappable row').toBeTruthy();
    expect(li.getAttribute('role')).toBe('button');
    cleanup();

    installFetch(clientsPayload({ clients: [row()], total: 1 }));
    const noOpen = wrap(<RepClientsScreen />);
    await screen.findByText('Maria Lopez');
    const inert = noOpen.container.querySelector('li');
    expect(inert.querySelector('svg'), 'a chevron on an inert row promises a destination that does not exist').toBeNull();
    expect(inert.getAttribute('role')).toBeNull();
  });

  it('⚠ pressing a row changes its ground, and releasing restores it', async () => {
    installFetch(clientsPayload({ clients: [row()], total: 1 }));
    const { container } = wrap(<RepClientsScreen onOpenClient={() => {}} />);
    await screen.findByText('Maria Lopez');
    const li = container.querySelector('li');

    expect(li.getAttribute('data-rep-row-pressed')).toBe('false');
    expect(li.style.background).toContain('--rm-surface');

    fireEvent.pointerDown(li);
    expect(li.getAttribute('data-rep-row-pressed')).toBe('true');
    // A card row sits ON surface above a `recess` column, so pressing goes DOWN into
    // the column. Home's rows sit on the column and swap UP to surface — one rule,
    // "swap to the other ground", on two different starting grounds.
    expect(li.style.background).toContain('--rm-recess');

    fireEvent.pointerUp(li);
    expect(li.getAttribute('data-rep-row-pressed')).toBe('false');
    expect(li.style.background).toContain('--rm-surface');
  });

  it('⚠ a CANCELLED pointer clears the pressed state — a scroll must not leave a row stuck', async () => {
    // On a 3,756-row book a gesture that begins on a row and becomes a scroll is the
    // COMMON interaction, and it fires pointercancel with no pointerup. Leaving this
    // handler out leaves a row looking pressed indefinitely.
    installFetch(clientsPayload({ clients: [row()], total: 1 }));
    const { container } = wrap(<RepClientsScreen onOpenClient={() => {}} />);
    await screen.findByText('Maria Lopez');
    const li = container.querySelector('li');
    fireEvent.pointerDown(li);
    expect(li.getAttribute('data-rep-row-pressed')).toBe('true');
    fireEvent.pointerCancel(li);
    expect(li.getAttribute('data-rep-row-pressed')).toBe('false');
  });

  it('⚠ dragging OFF a row clears the pressed state too', async () => {
    installFetch(clientsPayload({ clients: [row()], total: 1 }));
    const { container } = wrap(<RepClientsScreen onOpenClient={() => {}} />);
    await screen.findByText('Maria Lopez');
    const li = container.querySelector('li');
    fireEvent.pointerDown(li);
    fireEvent.pointerLeave(li);
    expect(li.getAttribute('data-rep-row-pressed')).toBe('false');
  });

  // ⚠ THIS CASE WAS INVERTED IN 9b, NOT DELETED, AND THE HALF THAT SURVIVES IS THE
  // IMPORTANT ONE. In 9a it read *"there is NO transition declared — motion is 9b"*
  // and asserted both `transition` and `animation` were empty. 9b built the motion
  // system, so the transition half is superseded by design. **The ANIMATION half is
  // not, and it is now permanent**: a list row must never animate in.
  it('⚠ the press is INSTANT and only the SETTLE eases — the asymmetry is the ruling', async () => {
    // Danny's brief: interacting should "feel like a decision when you click without
    // friction". Easing INTO the pressed state is friction. So press-down is 0ms and
    // the release eases — and a SYMMETRIC transition, which is what anyone would write
    // by default, fails this.
    installFetch(clientsPayload({ clients: [row()], total: 1 }));
    const { container } = wrap(<RepClientsScreen onOpenClient={() => {}} />);
    await screen.findByText('Maria Lopez');
    const li = container.querySelector('li');

    // At rest: the settle is eased.
    expect(li.style.transition).toContain('140ms');

    // Pressed: instant, so the state lands on the same frame as the pointer event.
    fireEvent.pointerDown(li);
    expect(li.style.transition, 'the press-down eases, which is the friction the ruling forbids')
      .toContain('0ms');
    expect(li.style.transition).not.toContain('140ms');

    fireEvent.pointerUp(li);
    expect(li.style.transition).toContain('140ms');
  });

  it('⚠ A LIST ROW NEVER ANIMATES IN — the 3,756-row rule, and it is permanent', async () => {
    // ⚠ THE SURVIVING HALF OF 9a's FENCE, AND THE REASON IT OUTLIVED THE OTHER HALF.
    // `REP_BOOK_LIMIT` is 100, so tapping Load more appends ONE HUNDRED ROWS IN A
    // SINGLE COMMIT. A per-row entrance animation — staggered or not — is the single
    // most common "polish" instinct and is exactly what would produce 100 simultaneous
    // animations on the mid-range phone Danny named as the test case.
    // **Sections and screens animate; their contents do not.**
    installFetch(clientsPayload({
      clients: [row(), row({ jobberClientId: 'jc-2', name: 'Allen Wade' })],
      total: 2,
    }));
    const { container } = wrap(<RepClientsScreen onOpenClient={() => {}} />);
    await screen.findByText('Maria Lopez');
    for (const li of container.querySelectorAll('li')) {
      expect(li.style.animation, 'a list row declares an entrance animation').toBe('');
      expect(li.style.animationName || '').toBe('');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CANVASS-9b PART 0(b) — THE SWITCHER IS ABSENT FROM EVERY SCREEN BUT PROFILE
//
// The other half of the ruling, fenced from the shell's side. `repProfileScreen`
// proves it IS on Profile; this proves it is NOT anywhere else — and the two
// together are what make "it moved" checkable rather than "it disappeared".
//
// ⚠ THE SHELL IS DRIVEN WITH A REAL SWITCHER NODE THROUGHOUT. Passing null would make
// every absence assertion here pass vacuously against a shell that had simply lost the
// prop — an absence assertion must first prove the presence it is asserting the absence
// of. So each case navigates to Profile at the end and finds it there, on the SAME
// mount, which is the paired positive.
describe('Canvass-9b Part 0(b) — the switcher is absent from Home, Clients and Client Detail', () => {
  const SWITCHER = <button type="button" data-surface-switcher="admin">Switch to the admin panel</button>;

  const mountShell = () => render(
    <ThemeProvider>
      <RepShell onLogout={() => {}} switcher={SWITCHER} />
    </ThemeProvider>
  );

  const go = async (tab) => {
    fireEvent.click(document.querySelector(`[data-rep-tab="${tab}"]`));
    await waitFor(() => expect(document.querySelector('[data-rep-screen]').getAttribute('data-rep-screen')).toBe(tab));
  };

  const switcher = () => document.querySelector('[data-surface-switcher]');

  it('⚠ HOME — the entry screen carries no switcher, and Profile still does', async () => {
    installFetch(clientsPayload());
    mountShell();
    await waitFor(() => expect(document.querySelector('[data-rep-shell]')).toBeTruthy());
    expect(switcher(), 'the switcher is back on Home').toBeNull();
    // ⚠ THE PAIRED POSITIVE, SAME MOUNT. Without it this passes against a shell that
    // never received the prop at all.
    await go('profile');
    expect(switcher(), 'the switcher is not on Profile either — it was lost, not moved').toBeTruthy();
  });

  it('⚠ CLIENTS carries no switcher', async () => {
    installFetch(clientsPayload());
    mountShell();
    await go('clients');
    expect(switcher()).toBeNull();
    await go('profile');
    expect(switcher()).toBeTruthy();
  });

  it('⚠ CLIENT DETAIL carries no switcher', async () => {
    // The sub-screen, reached by tapping a row — the one screen that is not a tab, and
    // therefore the one a chrome-level control would most easily survive onto.
    installFetch(clientsPayload({
      clients: [{
        jobberClientId: 'jc-1', name: 'Maria Lopez', nameUnavailable: false, stage: 'sold',
        assignmentSource: 'mode_a_at_close', isSticky: true, assignedAt: '2026-09-15T12:00:00Z',
        isFlagged: false, membership: 'none',
      }],
      total: 1,
    }));
    mountShell();
    await go('clients');
    const row = await screen.findByText('Maria Lopez');
    fireEvent.click(row.closest('li'));
    await waitFor(() => expect(document.querySelector('[data-rep-screen]').getAttribute('data-rep-screen')).toBe('clientDetail'));
    expect(switcher()).toBeNull();
  });

  it('⚠ the shell renders NO switcher slot of its own at any screen', async () => {
    // The structural fence rather than the per-screen one: `[data-rep-switcher-slot]`
    // as a CHILD OF THE SHELL ROOT is the chrome mount that was removed. Profile
    // renders a slot of its own, INSIDE main — so this anchors on the parent, not on
    // the attribute, which is what keeps it meaningful after the move.
    installFetch(clientsPayload());
    mountShell();
    for (const tab of ['home', 'clients', 'profile']) {
      await go(tab);
      expect(
        document.querySelector('[data-rep-shell] > [data-rep-switcher-slot]'),
        `a chrome-level switcher slot reappeared on ${tab}`
      ).toBeNull();
    }
    // And on Profile the slot exists inside the column, which is where it moved to.
    expect(document.querySelector('main [data-rep-switcher-slot]')).toBeTruthy();
  });
});
