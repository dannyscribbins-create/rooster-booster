// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT AUDIT — COMMIT (3c): THE ADMIN PANEL SHOWS THE TRUE NEGATIVE AND FLAGS IT
//
// Danny's rulings, 2026-09-29:
//   · §2.9 — every REFERRER screen clamps a non-positive balance to a plain $0 with no
//     message, and the request is disabled;
//   · the ADMIN panel shows the TRUE value and flags it.
//
// ⚠ THE ADMIN SIDE IS WHAT MAKES THE REFERRER-SIDE SILENCE HONEST RATHER THAN CONCEALING.
// Until the policy-B write-off exists (filed under the money-phase launch gate), this card is
// the ONLY place an over-payment is visible to anyone. If it is removed, or if the clamp is
// ever pushed into GET /api/cashout/balance, an over-paid account becomes invisible.
//
// ⚠ AND `cashoutBalance.available` IS NOT `detail.balance`. That second field is the adapter's
// speculative `500 + boost` sum, subtracts no cashouts, and is left untouched — which is why
// the server sends a separately-named key rather than overwriting it.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdminReferrers from './AdminReferrers';

// Danny's real production shape: earned $500.00 against two settled $500 cashouts.
const DANNYS_BALANCE = { earned: 500, deducted: 1000, available: -500, over_paid: true };
const HEALTHY_BALANCE = { earned: 900, deducted: 250, available: 650, over_paid: false };

const REFERRER = {
  id: 2, full_name: 'Daniel Scribbins', email: 'danny@test.com',
  signup_source: 'contractor_link', invited_by_name: null, created_at: '2026-01-01',
};

function installFetch(cashoutBalance) {
  return vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/admin/referrer/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          pipeline: [],
          // ⚠ THE SPECULATIVE FIELD IS DELIBERATELY DIFFERENT FROM THE TRUE ONE HERE. If the
          // card ever read `balance` instead of `cashoutBalance.available` it would show 500
          // and this fixture is what makes that visible.
          balance: 500,
          paidCount: 1,
          userInfo: REFERRER,
          cashoutBalance,
        }),
      };
    }
    if (u.includes('/api/admin/users')) {
      return { ok: true, status: 200, json: async () => [REFERRER] };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

// ⚠ THE PROP IS `setLoggedIn`, AND THE DETAIL OPENS FROM A "View" BUTTON — NOT FROM THE NAME.
// The first writing of this helper rendered `<AdminReferrers on401={...} />` and clicked the
// name text; `on401` is a LOCAL helper built from `setLoggedIn`, not a prop, and the name is
// plain text with no handler. Every case failed with "expected null to be truthy" — which reads
// like a missing card rather than a detail view that never opened.
async function openDetail(cashoutBalance) {
  global.fetch = installFetch(cashoutBalance);
  render(<AdminReferrers setLoggedIn={() => {}} />);
  const view = await screen.findByText(/View/);
  view.click();
  await waitFor(() => expect(document.querySelector('[data-admin-cashout-balance]')).toBeTruthy());
}

const card = () => document.querySelector('[data-admin-cashout-balance]');
const value = () => document.querySelector('[data-admin-balance-value]');
const flag = () => document.querySelector('[data-admin-overpaid-flag]');

describe('payout commit (3c) — the admin panel shows the true negative balance and flags it', () => {
  afterEach(() => { delete global.fetch; });

  it('⚠ DANNY\'S SHAPE: the admin sees −$500, not $0 and not $500', async () => {
    await openDetail(DANNYS_BALANCE);
    // ⚠ ANCHORED ON THE SIGNED FIGURE, NOT ON "500". `toContain('500')` would be satisfied by
    // the speculative `balance: 500` in the same payload — which is the exact wrong number and
    // the reason that field is in the fixture.
    expect(value().textContent).toMatch(/-\$500/);
    expect(value().textContent).not.toMatch(/^\$500/);
    expect(value().textContent).not.toMatch(/\$0/);
  });

  it('⚠ DANNY\'S SHAPE: the OVER-PAID flag is shown', async () => {
    await openDetail(DANNYS_BALANCE);
    expect(flag()).toBeTruthy();
    expect(flag().textContent).toMatch(/OVER-PAID/);
  });

  it('shows the arithmetic behind it, so the figure is checkable rather than asserted', async () => {
    await openDetail(DANNYS_BALANCE);
    const text = card().textContent;
    expect(text).toMatch(/\$500 earned/);
    expect(text).toMatch(/\$1,000 cashed out/);
    // ⚠ NAMES WHICH STATUSES DEDUCT. An admin reading "cashed out" cannot otherwise tell
    // whether a pending request is included, and that ambiguity is what made the two balance
    // formulas coexist for months.
    expect(text).toMatch(/pending, approved and paid/);
  });

  it('says plainly that the referrer app shows $0 — so the silence is documented where it is decided', async () => {
    await openDetail(DANNYS_BALANCE);
    expect(card().textContent).toMatch(/referrer app shows them \$0/);
  });

  it('⚠ PAIRED POSITIVE: a HEALTHY balance shows the figure with NO flag', async () => {
    // ⚠ WITHOUT THIS, A CARD THAT FLAGGED EVERY REFERRER WOULD PASS EVERY CASE ABOVE, and an
    // always-on warning is indistinguishable from no warning within a week.
    await openDetail(HEALTHY_BALANCE);
    expect(value().textContent).toMatch(/\$650/);
    expect(value().textContent).not.toMatch(/-\$/);
    expect(flag()).toBeNull();
    expect(card().textContent).not.toMatch(/OVER-PAID/);
    expect(card().textContent).not.toMatch(/referrer app shows them/);
  });

  it('the card is absent entirely when the referrer has no app account', async () => {
    // ⚠ null, NOT A ZEROED OBJECT. A CRM-side referrer with no `users` row has no balance to
    // speak of, and a manufactured `{ available: 0 }` would read as "settled up" — the
    // getStripeRow() manufactured-answer shape CLAUDE.md records.
    global.fetch = installFetch(null);
    render(<AdminReferrers setLoggedIn={() => {}} />);
    const view = await screen.findByText(/View/);
    view.click();
    await waitFor(() => expect(screen.queryByText(/Loading data/)).toBeNull());
    expect(card()).toBeNull();
  });
});
