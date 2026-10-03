// ─────────────────────────────────────────────────────────────────────────────
// THE CASH OUT SCREEN WORKS FOR A REFERRER WHO ACTUALLY HAS MONEY
//
// ⚠ THIS FILE EXISTS BECAUSE SEVEN TEST FILES MOUNT `CashOutTab` AND NOT ONE OF THEM GAVE IT A
// POSITIVE BALANCE. Every fixture used `available: -500` or `available: 0`, because the whole
// payout-audit arc was about the over-paid account and the clamp. The amount step's preset buttons
// render only when a preset survives `v > 0 && v <= serverBalance` — so **every existing fixture
// seeded the one state that skips the branch entirely.**
//
// WHAT THAT HID: `{v === balance ? "Max" : …}` — `balance` is an identifier that has not existed
// since commit (3b) removed the prop. In module scope an undeclared free variable THROWS, so the
// line raised `ReferenceError: balance is not defined` and the error boundary blanked the entire
// Cash Out tab. It was found by enabling ESLint's `no-undef`, which reported it as the ONLY real
// violation in `src/`.
//
// ⚠ AND IT WAS LATENT RATHER THAN SAFE. Measured read-only in production the day it was found:
// 6 live users — 5 at zero, 1 negative, **0 positive**. So nobody could reach it, and the only
// thing preventing a blank money screen was that no referrer had earned anything yet. **The first
// one to earn would have hit it.**
//
// ⚠ jsdom RESOLVES NO `var()` AND PERFORMS NO LAYOUT, so nothing here asserts colour or position.
// Every assertion is on TEXT or on the presence of a control — what this runner can see truthfully.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import CashOut from './CashOutTab';
import ThemeProvider from '../shared/ThemeProvider';

const TOKEN = 'tok-positive';

function installFetch({ available }) {
  return vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/cashout/balance')) {
      return { ok: true, json: async () => ({ earned: available, deducted: 0, available }) };
    }
    if (u.includes('/api/referrer/enabled-payout-methods')) {
      return { ok: true, json: async () => ({ enabled_payout_methods: ['venmo', 'check'] }) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

function mount({ available }) {
  global.fetch = installFetch({ available });
  return render(
    <ThemeProvider>
      <CashOut
        loading={false}
        userName="Ref"
        userEmail="ref@test.com"
        bankStatus={{ connected: true }}
        setTab={() => {}}
        onOpenBankSetup={() => {}}
        token={TOKEN}
      />
    </ThemeProvider>
  );
}

const balanceLine = () => document.querySelector('[data-cashout-balance]');

/** Every enabled method button, by the control rather than its label text. */
function methodButtons() {
  return Array.from(document.querySelectorAll('button'))
    .filter((b) => /Venmo|Check/i.test(b.textContent || ''));
}

/**
 * Advance to the AMOUNT step the way a referrer does — by clicking a method.
 * ⚠ THE PRECONDITION IS ASSERTED, NOT ASSUMED. If the balance fetch has not resolved, or the
 * methods are disabled, the click does nothing and every later assertion would be measuring a
 * screen still on step 1 — which is the shape that made this branch untested in the first place.
 */
async function reachAmountStep(available) {
  const utils = mount({ available });
  await waitFor(() => expect(balanceLine().textContent).toMatch(/available/));

  const buttons = methodButtons();
  expect(buttons.length).toBeGreaterThan(0);
  expect(buttons[0].disabled).toBe(false);   // a positive balance must enable the chooser
  buttons[0].click();

  // The amount step is identified by its own control, not by text that might appear elsewhere.
  await waitFor(() => expect(document.querySelector('input[type="number"]')).toBeTruthy());
  return utils;
}

/** The preset buttons on the amount step: "$500", "$1,000", "Max". */
function presetButtons() {
  return Array.from(document.querySelectorAll('button'))
    .filter((b) => /^(Max|\$[\d,]+)$/.test((b.textContent || '').trim()));
}

describe('Cash Out — a POSITIVE balance renders the amount step without crashing', () => {
  let consoleError;
  beforeEach(() => {
    vi.restoreAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { delete global.fetch; });

  it('[RED before the fix] the amount step renders its presets for a referrer with money', async () => {
    // ⚠ THIS IS THE CASE THE CRASH WAS HIDING FROM. It asserts the screen rendered its OWN content,
    // never merely that `render()` returned — a component that throws during render leaves an EMPTY
    // container, so "it did not throw" is satisfied by the crash itself.
    await reachAmountStep(700);

    const presets = presetButtons();
    expect(presets.length).toBeGreaterThan(0);

    // And the production error string must not have reached the console.
    const logged = consoleError.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).not.toMatch(/balance is not defined/);
    expect(logged).not.toMatch(/ReferenceError/);
  });

  it('the preset equal to the balance is labelled Max, and the others show their amount', async () => {
    // ⚠ THIS PINS THE FIX RATHER THAN THE ABSENCE OF THE CRASH. `v === serverBalance` is what the
    // broken line was *trying* to express; asserting only "it did not throw" would pass against
    // `v === 0`, against `false`, or against the label being dropped altogether.
    await reachAmountStep(700);

    const labels = presetButtons().map((b) => (b.textContent || '').trim());
    // 700 admits 500 (below it) and 700 itself; 1000 exceeds it and is dropped.
    expect(labels).toContain('$500');
    expect(labels).toContain('Max');
    expect(labels.filter((l) => l === 'Max')).toHaveLength(1);
    expect(labels).not.toContain('$1,000');
    expect(labels).not.toContain('$1000');
  });

  it('a balance of exactly 500 renders ONE button, labelled Max', async () => {
    // ⚠ 500 IS THE DISCRIMINATING VALUE, NOT A ROUND NUMBER CHOSEN FOR TIDINESS. It collides with
    // the first hard-coded preset, so the `new Set(...)` dedup and the Max label are exercised
    // together — the exact pair the source comment above the expression describes. A fix that
    // dropped the dedup would render two buttons here; one that dropped the comparison would label
    // the single button "$500".
    await reachAmountStep(500);

    const labels = presetButtons().map((b) => (b.textContent || '').trim());
    expect(labels).toEqual(['Max']);
  });

  it('PAIRED NEGATIVE: a non-positive balance renders NO presets — why no fixture caught this', async () => {
    // ⚠ THIS IS THE STATE EVERY PRE-EXISTING FIXTURE USED, AND IT IS WHY THE CRASH SURVIVED. With a
    // non-positive balance no preset satisfies `v <= serverBalance`, the `.map` body never runs, and
    // the broken expression is never evaluated. Recording it as a named case means the next reader
    // can see that those fixtures were not wrong — they were seeded on the one safe side.
    const utils = mount({ available: -500 });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/available/));

    // Precondition: the chooser is disabled, so step 2 is unreachable at all.
    const buttons = methodButtons();
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(presetButtons()).toHaveLength(0);
    utils.unmount();
  });
});
