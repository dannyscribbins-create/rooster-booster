// ── CANVASS-4: THE CLIENTS TAB ──────────────────────────────────────────────
//
// ⚠ WHAT jsdom CAN AND CANNOT SETTLE, STATED HERE RATHER THAN IMPLIED BY THE
// ASSERTIONS. jsdom resolves NO `var()` and performs NO layout, so every colour
// claim below is DECLARATION-LEVEL — it proves which token a site reaches for, never
// what it paints. The painted figures come from the browser pass and are recorded in
// the commit and the checklist. This distinction is the reason a login screen shipped
// at 1.34:1 under 654 green tests.
//
// What IS settled here: which token is named, which strings render, and — the part
// the ruling turns on — that the membership badge renders NO ELEMENT AT ALL for the
// indistinguishable states.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ThemeProvider from '../shared/ThemeProvider';
import RepClientsScreen, {
  MembershipBadge, StatusPill, EmptyBook, STAGE_LABELS, SOURCE_LABELS, NO_STAGE_LABEL,
} from './RepClientsScreen';
import { ADMIN_TOKEN_KEY } from '../../utils/authStorage';

function client(over = {}) {
  return {
    jobberClientId: 'jc-1',
    name: 'Maria Lopez',
    stage: 'sold',
    assignmentSource: 'mode_a_at_close',
    isSticky: true,
    assignedAt: '2026-09-15T12:00:00Z',
    isFlagged: false,
    membership: null,
    ...over,
  };
}

function stubFetch(payload) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
}

function mount(payload) {
  global.fetch = stubFetch(payload);
  return render(<ThemeProvider><RepClientsScreen /></ThemeProvider>);
}

beforeEach(() => {
  localStorage.setItem(ADMIN_TOKEN_KEY, 'team-token');
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Canvass-4 — the membership badge renders the ruling, not the four-state space', () => {
  it('state "confirmed" renders the In app badge', () => {
    render(<MembershipBadge membership="confirmed" />);
    expect(screen.getByText('In app')).toBeTruthy();
  });

  it('state "invited" renders the Invited badge — proven now, lit by 3d', () => {
    // ⚠ THE SERVER CANNOT EMIT THIS YET, AND THAT IS EXACTLY WHY IT IS TESTED HERE.
    // Nothing in the schema records a per-client rep send. A badge whose slot has
    // never rendered cannot be trusted to render when 3d finally supplies the value;
    // this is the difference between a designed slot and a hypothetical one.
    render(<MembershipBadge membership="invited" />);
    expect(screen.getByText('Invited')).toBeTruthy();
  });

  it('⚠ every other state renders NO ELEMENT — the absence is a non-claim (A34.4 D4)', () => {
    // States 2, 3 and 4 of A24.5's space are indistinguishable, so the screen must not
    // assert that anyone has NOT signed up. Asserting on the CONTAINER's emptiness
    // rather than on a missing string is deliberate: `queryByText(...)` being null
    // would also pass against a badge that rendered an empty box, which is the
    // reserved slot the ruling forbids.
    for (const value of [null, undefined, 'unknown', 'not_signed_up', '']) {
      const { container, unmount } = render(<MembershipBadge membership={value} />);
      expect(container.innerHTML).toBe('');
      unmount();
    }
  });

  it('⚠ reserves no width — there is no placeholder element to become a claim', () => {
    const { container } = render(<MembershipBadge membership={null} />);
    expect(container.querySelectorAll('*').length).toBe(0);
  });

  it('never renders a negative assertion in any state', () => {
    for (const value of ['confirmed', 'invited', null, 'unknown']) {
      const { container, unmount } = render(<MembershipBadge membership={value} />);
      const text = (container.textContent || '').toLowerCase();
      for (const forbidden of ['not signed up', 'no app', 'not in app', 'no account']) {
        expect(text.includes(forbidden)).toBe(false);
      }
      unmount();
    }
  });
});

describe('Canvass-4 — the status pill has THREE states, where the mockup drew two', () => {
  it('a sticky assignment reads Locked', () => {
    render(<StatusPill isSticky isFlagged={false} />);
    expect(screen.getByText('Locked')).toBeTruthy();
  });

  it('a provisional assignment reads Provisional — the state the mockup assumes away', () => {
    render(<StatusPill isSticky={false} isFlagged={false} />);
    expect(screen.getByText('Provisional')).toBeTruthy();
  });

  it('a flag wins over sticky', () => {
    render(<StatusPill isSticky isFlagged />);
    expect(screen.getByText('Flagged')).toBeTruthy();
  });

  it('⚠ no pill uses a STATUS_TINT fill — that table forbids a text consumer', () => {
    // DECLARATION-LEVEL. STATUS_TINT.warning measures 4.42:1 under warningText, under
    // the 4.5 floor, and its own entry says it must never gain a text consumer. The
    // first draft of this pill did exactly that. Asserting the background stays
    // transparent is what keeps the repair from being undone by someone "finishing"
    // the pill later.
    const { container } = render(<StatusPill isSticky isFlagged={false} />);
    expect(container.firstChild.style.background).toBe('transparent');
  });
});

describe('Canvass-4 — the vocabulary is ours, not the mockup\'s', () => {
  it('DB "paid" renders as Complete', () => {
    expect(STAGE_LABELS.paid).toBe('Complete');
  });

  it('⚠ the mockup\'s invented sources and stages appear nowhere', () => {
    // "Inherited" is referral inheritance — ASSIGNMENT_RULES_LOCKED's V1 records it as
    // implemented nowhere, re-verified this session. "Link" maps to no column at all.
    const labels = Object.values(SOURCE_LABELS).concat(Object.values(STAGE_LABELS));
    for (const invented of ['Inherited', 'Link', 'Inspection set', 'Converted', 'Proposal sent']) {
      expect(labels.includes(invented)).toBe(false);
    }
  });

  it('every real assignment-source enum value has a label', () => {
    // The two CHECK constraints in client_rep_assignments, written out. A source with
    // no label would render its raw enum value to a rep.
    for (const v of ['quote_salesperson', 'promoted_provisional', 'mode_a_at_close',
      'mode_b_at_close', 'manual', 'mode_a', 'mode_b', 'qr_link']) {
      expect(typeof SOURCE_LABELS[v]).toBe('string');
    }
  });
});

describe('Canvass-4 — the list', () => {
  // ⚠ RENAMED AND NARROWED IN CANVASS-9a: THE SOURCE IS NO LONGER ON A LIST ROW.
  // Part 4c removed it by ruling — redundant, since the source appears on the detail
  // screen, and not what Danny wants at a glance. The two `toContain('Assessment')`
  // assertions this case carried are DELETED rather than inverted, because the source's
  // absence gets its own case below: an assertion that a string is gone belongs with the
  // ruling that removed it, not hidden inside a case about what a row shows.
  it('renders a client row with its stage and assignment date', async () => {
    mount({ clients: [client()], total: 1, limit: 100 });
    expect(await screen.findByText('Maria Lopez')).toBeTruthy();
    const meta = screen.getByText(/Sold/);
    expect(meta.textContent).toContain('Sold');
    expect(meta.textContent).toContain('Assigned');
  });

  // ── RULING 2 (Danny, 2026-09-21) — TWO CHANNELS, NEITHER BORROWING THE OTHER ──
  it('⚠ a REFERRED client shows a "Referral" text segment beside its stage', async () => {
    mount({ clients: [client({ isReferred: true })], total: 1, limit: 100 });
    await screen.findByText('Maria Lopez');
    const meta = screen.getByText(/Sold/);
    expect(meta.textContent).toContain('Referral');
    // ⚠ BOTH CHANNELS IN ONE ASSERTION SET. The stage must be untouched by the referral
    // marker — same word, same line — because "Sold" means the same thing however the
    // client arrived. A build that fused the two would still contain 'Referral'.
    expect(meta.textContent).toContain('Sold');
    expect(meta.textContent).toContain('Assigned Sep 15');
  });

  it('⚠ a DIRECT client shows NOTHING in that channel — no "Direct", no empty slot', async () => {
    // ⚠ THE PAIRED NEGATIVE, AND IT NEEDS ITS POSITIVE TO MEAN ANYTHING. "Referral is
    // absent" passes against a row that failed to render at all, so the stage and the
    // date are asserted present on the same row. Danny's standing principle — no badge
    // unless it IS a referral — held here; only the FORM changed to text.
    mount({ clients: [client({ isReferred: false })], total: 1, limit: 100 });
    await screen.findByText('Maria Lopez');
    const meta = screen.getByText(/Sold/);
    expect(meta.textContent).not.toContain('Referral');
    expect(meta.textContent).not.toContain('Direct');
    expect(meta.textContent).toBe('Sold · Assigned Sep 15');
  });

  it('⚠ and it is TEXT, not a third pill — the row keeps exactly two', async () => {
    // ⚠ THE CONSTRAINT THE RULING IS ACTUALLY ABOUT. The row already carries a
    // MembershipBadge and a StatusPill; a third chip of similar shape is the collision
    // Danny is guarding against. Asserting the SEGMENT lives in the meta line — the same
    // element as the stage and the date — is what pins "text" rather than "badge".
    mount({ clients: [client({ isReferred: true })], total: 1, limit: 100 });
    await screen.findByText('Maria Lopez');
    const meta = screen.getByText(/Sold/);
    expect(meta.textContent).toBe('Sold · Referral · Assigned Sep 15');
  });

  it('⚠ Part 4c — the SOURCE is absent from a list row, and its label still exists', async () => {
    // ⚠ TWO ASSERTIONS, AND THE SECOND IS WHAT STOPS THIS GOING VACUOUS. "Assessment is
    // absent" would pass forever if `SOURCE_LABELS` were deleted, if the fixture stopped
    // carrying a source, or if the row failed to render at all — an absence assertion
    // must first prove the presence it is asserting the absence of. So: the label is
    // still a real label for this fixture's source value (the detail screen renders it),
    // AND the row does not show it.
    mount({ clients: [client()], total: 1, limit: 100 });
    await screen.findByText('Maria Lopez');
    expect(SOURCE_LABELS.mode_a_at_close).toBe('Assessment');
    const meta = screen.getByText(/Sold/);
    expect(meta.textContent).not.toContain('Assessment');
  });

  it('⚠ Part 4d — a client with NO referral record shows NOTHING, not a label', async () => {
    // ⚠ THIS CASE WAS INVERTED IN CANVASS-9a, NOT DELETED, AND THE INVERSION IS THE
    // RECORD. It asserted `findByText(/No referral record/)` — correct until Danny ruled
    // that a row with no referral record says nothing at all (the membership-badge
    // principle: a referred client says who referred them and everyone else says
    // nothing). Measured reason: 264 of 272 seeded rows carry no pipeline row, so the
    // label was repeated text on almost every row.
    //
    // ⚠ AND THE ROW MUST STILL READ DELIBERATELY WITH IT GONE, which the brief asks for
    // in terms — so this asserts the POSITIVE too: the date survives as the row's one
    // meta segment. A row that rendered an EMPTY meta line would satisfy "the label is
    // absent" while looking like a failed load, and that is the defect this pairing
    // catches.
    mount({ clients: [client({ stage: null })], total: 1, limit: 100 });
    await screen.findByText('Maria Lopez');
    expect(screen.queryByText(/No referral record/)).toBeNull();
    const meta = screen.getByText(/Assigned/);
    expect(meta.textContent).toBe('Assigned Sep 15');
  });

  it('⚠ the missing-stage label is never a pipeline stage name', async () => {
    // The paired structural fence: whatever NO_STAGE_LABEL becomes, it must not be a
    // value from the stage vocabulary, because that is the fabrication under guard.
    const stageNames = Object.values(STAGE_LABELS);
    expect(stageNames.includes(NO_STAGE_LABEL)).toBe(false);
  });

  it('the empty book renders its own state and makes no claim about other clients', async () => {
    mount({ clients: [], total: 0, limit: 100 });
    expect(await screen.findByText('No clients yet')).toBeTruthy();
    const { container } = render(<EmptyBook />);
    expect(container.textContent).not.toContain('no clients in the system');
  });

  it('⚠ the bounded page says it is bounded when there is more', async () => {
    const many = Array.from({ length: 100 }, (_, i) => client({ jobberClientId: `jc-${i}`, name: `Client ${i}` }));
    mount({ clients: many, total: 250, limit: 100 });
    // ⚠ ANCHORED ON THE SURROUNDING PHRASE, NOT ON "100". A bare value assertion
    // passes against "1100 of 250" — the toContain-on-a-value trap.
    expect(await screen.findByText(/Showing 100 of 250/)).toBeTruthy();
  });

  it('⚠ the count STILL renders when the page is the whole book — Canvass-4b', async () => {
    // ⚠ THIS CASE IS INVERTED FROM WHAT CANVASS-4 SHIPPED, DELIBERATELY. It previously
    // asserted the line was ABSENT when nothing was truncated. That passed, and it was
    // wrong: a rep whose book fits on one page saw no count anywhere, which is what was
    // reported from production. "How big is my book" and "the list is cut off" are two
    // different jobs; the old condition served only the second.
    mount({ clients: [client()], total: 1, limit: 100 });
    await screen.findByText('Maria Lopez');
    expect(screen.getByText('1 client')).toBeTruthy();
  });

  it('⚠ the count pluralises, and never reads "1 clients"', async () => {
    const two = [client(), client({ jobberClientId: 'jc-2', name: 'Second' })];
    mount({ clients: two, total: 2, limit: 100 });
    await screen.findByText('Second');
    expect(screen.getByText('2 clients')).toBeTruthy();
  });

  it('⚠ the total is the ASSIGNMENT count even when a row cannot be named', async () => {
    // Pins 1(c): the displayed total must not be reduced to what happens to be
    // displayable. Both rows render here, and the count agrees with the database.
    mount({
      clients: [client(), client({ jobberClientId: 'jc-x', name: null, nameUnavailable: true })],
      total: 2, limit: 100,
    });
    await screen.findByText('Maria Lopez');
    expect(screen.getByText('2 clients')).toBeTruthy();
    expect(screen.getByText('Details not available yet')).toBeTruthy();
  });

  it('a flagged row shows the Flagged pill', async () => {
    mount({ clients: [client({ isFlagged: true })], total: 1, limit: 100 });
    expect(await screen.findByText('Flagged')).toBeTruthy();
  });

  it('a confirmed member shows In app beside the pill', async () => {
    mount({ clients: [client({ membership: 'confirmed' })], total: 1, limit: 100 });
    expect(await screen.findByText('In app')).toBeTruthy();
    expect(screen.getByText('Locked')).toBeTruthy();
  });

  it('⚠ a row with no client record renders honestly, and is NOT called "Unnamed client"', async () => {
    // Three name states, three labels. Collapsing the third into 'Unnamed client' would
    // claim we hold a client record that we do not.
    mount({
      clients: [
        client({ jobberClientId: 'jc-a', name: 'Real Name' }),
        client({ jobberClientId: 'jc-b', name: 'Unnamed client' }),
        client({ jobberClientId: 'jc-c', name: null, nameUnavailable: true }),
      ],
      total: 3, limit: 100,
    });
    await screen.findByText('Real Name');
    expect(screen.getByText('Unnamed client')).toBeTruthy();
    expect(screen.getByText('Details not available yet')).toBeTruthy();
    // ⚠ And it must not render the literal "null" — the JSX trap where a null name
    // reaches the DOM as text.
    expect(screen.queryByText('null')).toBeNull();
  });

  it('⚠ an unnamed-record row still carries its assignment metadata', async () => {
    // The evidence for rendering these rather than dropping them: the stage, date and
    // source are present and useful even when the name is not.
    mount({
      clients: [client({ jobberClientId: 'jc-c', name: null, nameUnavailable: true, stage: 'sold' })],
      total: 1, limit: 100,
    });
    await screen.findByText('Details not available yet');
    const meta = screen.getByText(/Sold/);
    expect(meta.textContent).toContain('Assigned');
    // ⚠ THE `toContain('Assessment')` THAT STOOD HERE IS GONE WITH THE SOURCE SEGMENT
    // ITSELF (Part 4c), not relaxed. What this case is actually for — that an
    // unnamed-record row still carries the metadata it does have — is unchanged and is
    // now carried by the stage and the date.
    expect(meta.textContent).toContain('Sold');
  });

  it('a failed load reports an error rather than an empty book', async () => {
    // ⚠ THE DISTINCTION THAT MATTERS: "your book is empty" and "we could not load
    // your book" are different claims, and collapsing them tells a rep they have no
    // clients when the network failed.
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    render(<ThemeProvider><RepClientsScreen /></ThemeProvider>);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText('No clients yet')).toBeNull();
  });

  it('calls the rep route with the admin bearer token', async () => {
    mount({ clients: [], total: 0, limit: 100 });
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/rep/clients');
    expect(opts.headers.Authorization).toBe('Bearer team-token');
  });
});
