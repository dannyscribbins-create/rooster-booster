// ─────────────────────────────────────────────────────────────────────────────
// WAVE 0.4 — SCOPE ITEMS 3 AND 4: THE HELD STATE AND ITS DEEPLINK.
// PHASE 1, RED FIRST.
//
// ── WHY THE HELD STATE IS NOT COSMETIC ───────────────────────────────────────
// Once the gate exists, a row can be MATCHED AND HELD: the referrer was
// resolved, their contact columns are populated, and nothing was sent. Today
// that row renders identically to one that was matched and invited — same
// "Pending" badge, same contact line, and the only difference is an invite
// channel of "none" buried in a metadata column. While the gate is closed,
// success is therefore indistinguishable from failure on the surface an admin
// actually looks at. That is CLAUDE.md's "mechanism that reports health it
// cannot observe", arriving through the UI instead of through a test.
//
// ── THE ROW SHAPE THIS PINS, AND THE OPEN QUESTION IT LEAVES ─────────────────
// A held row is derived here, not flagged: contact columns populated AND
// invite_channel 'none' AND invite_sent_at NULL. That derivation is sound
// because populated contact columns mean there WAS somewhere to send. If Phase
// 2 prefers an explicit column the fixture changes and these assertions do not
// — they are about what the admin sees, not about how it is stored.
//
// ── CONVENTION ───────────────────────────────────────────────────────────────
// jsdom + @testing-library/react under Vitest. `fetch` is the only thing
// replaced. Assertions read the rendered DOM.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import AdminPendingReferrals from './AdminPendingReferrals';

const GATE_ANCHOR = 'notif-referral-match-outreach';

// The ruled copy, verbatim. It deliberately does not assume the gate is off for
// pre-launch reasons — a contractor may keep it off permanently and on purpose.
const HELD_BANNER =
  'Invite pending your approval. To automate, toggle ON the match trigger outreach.';

const UNMATCHED_COPY = /No Jobber clients matched this name/i;

function row(overrides = {}) {
  return {
    id: 1,
    contractor_id: 'w04-tenant',
    jobber_client_id: 'jc-1',
    client_name: 'Cynthia Graubart',
    referred_by_name: 'Tommy Mills',
    referred_by_email: null,
    referred_by_phone: null,
    invite_sent_at: null,
    invite_channel: 'none',
    invite_resent_at: null,
    matched_user_id: null,
    matched_at: null,
    match_seen_at: null,
    closed_out_by_admin: false,
    closed_out_at: null,
    closed_out_note: null,
    status: 'pending',
    created_at: '2026-08-20T12:00:00.000Z',
    needs_admin_verification: false,
    jobber_name_matches: null,
    referrer_lookup_attempted: true,
    credit_email_sent_at: null,
    ...overrides,
  };
}

// Matched, contact resolved, nothing sent — the state the gate creates.
const heldRow = () => row({
  referred_by_email: 'tommy.mills@fixture.test.invalid',
  referred_by_phone: '770-555-1212',
  invite_channel: 'none',
  invite_sent_at: null,
  needs_admin_verification: false,
});

// Matched, contact resolved, invite actually went out — the gate-open state.
const sentRow = () => row({
  id: 2,
  jobber_client_id: 'jc-2',
  referred_by_email: 'ivy.sender@fixture.test.invalid',
  invite_channel: 'email',
  invite_sent_at: '2026-08-21T09:00:00.000Z',
  needs_admin_verification: false,
});

// No candidate found at all — the pre-0.4 state of all thirteen production rows.
const unmatchedRow = () => row({
  id: 3,
  jobber_client_id: 'jc-3',
  needs_admin_verification: true,
  jobber_name_matches: [],
});

// ⚠ THE ENVELOPE IS `{ pending: [...] }`, NOT A BARE ARRAY.
// fetchRecords reads `d.pending || []`, so a bare array yields zero rows and
// every assertion here would report a false RED — "the banner is absent"
// because nothing rendered at all. P3's precondition (findByText on the sent
// row's email) is what caught it; keep preconditions on renders for exactly
// this reason.
function mockFetch(rows) {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ pending: rows }) }));
}

describe('Wave 0.4 items 3 and 4 — the held state and its deeplink (RED first)', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('P1 — a matched-but-held row shows the approval banner (RED: no such state exists in the UI; a held row renders exactly like an invited one)', async () => {
    mockFetch([heldRow()]);
    render(<AdminPendingReferrals />);
    expect(await screen.findByText(HELD_BANNER)).toBeTruthy();
  });

  // ⚠ THE ACTUAL REQUIREMENT: held must be DISTINGUISHABLE, not merely labelled.
  // Asserting the banner exists on a held row proves nothing if the same banner
  // also appears on an unmatched one. This pins both directions in one render.
  it('P2 — held and unmatched are visually distinct: the held row does NOT claim no client matched, and the unmatched row does NOT claim an invite is awaiting approval (RED: neither state is expressed)', async () => {
    mockFetch([heldRow(), unmatchedRow()]);
    const { container } = render(<AdminPendingReferrals />);
    await screen.findByText(HELD_BANNER);

    const cards = Array.from(container.querySelectorAll('div')).filter(
      d => d.textContent.includes('Tommy Mills') && !d.textContent.includes('jc-3')
    );
    expect(cards.length, 'precondition: the held row must render its own card').toBeGreaterThan(0);

    // Exactly one of the two messages on the page, and they belong to different rows.
    expect(screen.getAllByText(HELD_BANNER).length).toBe(1);
    expect(screen.getAllByText(UNMATCHED_COPY).length).toBe(1);
  });

  // ⚠ THIS ONE IS GREEN TODAY AND THAT IS EXPECTED — IT IS A POST-FIX GUARD,
  // NOT A RED. No banner exists anywhere yet, so "no banner on a sent row"
  // passes trivially. It becomes meaningful the moment P1 goes green, and its
  // job from then on is to catch a banner rendered unconditionally. Recorded
  // explicitly rather than left to look like a passing RED: known absence is
  // recoverable, silent absence is not.
  //
  // Its precondition (findByText on the sent row's address) is load-bearing —
  // it is what caught the `{ pending: [...] }` envelope bug that would
  // otherwise have made all four tests here report false REDs.
  it('P3 [GUARD, green today] — a row whose invite actually went out shows NO approval banner (the partner that stops P1 from being satisfied by an always-on banner)', async () => {
    mockFetch([sentRow()]);
    render(<AdminPendingReferrals />);
    await screen.findByText('ivy.sender@fixture.test.invalid');
    expect(screen.queryByText(HELD_BANNER)).toBeNull();
  });

  // ── THE SEND BUTTONS MUST NOT RENDER ON A HELD ROW ─────────────────────────
  // ⚠ THE RENDER CONDITION CHANGED MEANING WITHOUT BEING TOUCHED. Both send
  // buttons gate on `(referred_by_email || referred_by_phone)`. Before Wave 0.4
  // that was equivalent to "has been invited", because the same branch wrote the
  // contact columns and fired the invite together. The matcher rebuild broke that
  // coupling, so the condition now means "is invitable" — and a held row, which
  // by definition must NOT be invited yet, satisfies it.
  //
  // A refused click is a worse experience than an absent button, and the banner
  // already tells the admin what to do. So the buttons go away rather than
  // erroring. The server-side refusal (wave04GateBypass.test.js) stays as the
  // real control — this is the UI not offering an action it knows will fail.
  it('P5 — neither send button renders on a held row (RED: both gate on contact-info-present, which a held row now satisfies, so the card offers a send on a row whose whole point is that nothing was sent)', async () => {
    mockFetch([heldRow()]);
    render(<AdminPendingReferrals />);
    await screen.findByText(HELD_BANNER);

    expect(screen.queryByText(/Resend Invite/i), 'Resend Invite must not be offered on a held row').toBeNull();
    expect(screen.queryByText(/^Follow Up$/i), 'Follow Up must not be offered on a held row').toBeNull();
    // Close Out is unaffected — closing a held row is legitimate.
    expect(screen.getByText(/Close Out/i)).toBeTruthy();
  });

  // ⚠ POSITIVE CONTROL for P5. Without it, deleting both buttons outright would
  // pass — and they are correct and wanted on a row that WAS invited.
  it('P6 — both send buttons DO render on a row whose invite actually went out (the partner that stops P5 from being satisfied by removing them everywhere)', async () => {
    mockFetch([sentRow()]);
    render(<AdminPendingReferrals />);
    await screen.findByText('ivy.sender@fixture.test.invalid');

    expect(screen.getByText(/Resend Invite/i)).toBeTruthy();
    expect(screen.getByText(/^Follow Up$/i)).toBeTruthy();
  });

  // ── ITEM 4 — THE DEEPLINK ──────────────────────────────────────────────────
  // Small, and explicitly IN SCOPE precisely because it is the first thing a
  // build drops as creep. Without it the banner names a setting the admin then
  // has to go and find.
  it('P4 — the held banner offers a control that navigates to the gate card (RED: no control exists, so the banner names a setting with no way to reach it)', async () => {
    mockFetch([heldRow()]);
    const { container } = render(<AdminPendingReferrals />);
    await screen.findByText(HELD_BANNER);

    const link = container.querySelector(`a[href*="${GATE_ANCHOR}"], [data-deeplink="${GATE_ANCHOR}"]`);
    expect(
      link,
      `expected the banner to carry a control targeting "${GATE_ANCHOR}" — either an anchor href or a data-deeplink attribute`
    ).toBeTruthy();
  });
});
