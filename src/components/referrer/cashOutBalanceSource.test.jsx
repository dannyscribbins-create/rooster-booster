// ─────────────────────────────────────────────────────────────────────────────
// PAYOUT AUDIT — COMMIT (3b): THE CASH OUT SCREEN SHOWS THE SERVER'S BALANCE
//
// Danny's ruling on finding 6.
//
// WHAT WAS WRONG. `CashOutTab.jsx` computed its own balance:
//   pipeline.filter(p => p.payout).reduce((sum, p) => sum + p.payout, 0)
// — summing the SPECULATIVE `500 + boost` ladder, ignoring the confirmed
// `conversion_bonus` beside it, ignoring the server's own `balance` field, and
// subtracting NO pending, approved or paid cashouts. Measured on Danny's account: the
// screen displayed **$500 available** with a **Max** button pre-filled to $500, while
// the server's own gate computed **−$500** and refused the request.
//
// ⚠ jsdom RESOLVES NO `var()` AND PERFORMS NO LAYOUT, so nothing here asserts colour or
// position. Every assertion below is on TEXT, on the presence of a control, or on the
// request body actually sent — the three things this runner can see truthfully.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import CashOut from './CashOutTab';
import ThemeProvider from '../shared/ThemeProvider';

const TOKEN = 'tok-3b';

function installFetch({ available, fail = false, malformed = false }) {
  return vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('/api/cashout/balance')) {
      if (fail) throw new Error('network down');
      if (malformed) return { ok: true, json: async () => ({ available: 'lots' }) };
      return { ok: true, json: async () => ({ earned: 0, deducted: 0, available }) };
    }
    if (u.includes('/api/referrer/enabled-payout-methods')) {
      return { ok: true, json: async () => ({ enabled_payout_methods: ['venmo', 'check'] }) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

// ⚠ DANNY'S SHAPE, AS A PIPELINE THE FIXED COMPONENT IGNORES — AND PASSING IT IS
// DELIBERATE. These two rows sum to exactly 500 under the REMOVED client-side formula
// (`filter(p => p.payout).reduce(...)`), which is the figure his screen really showed while
// the server computed −500. The fixed component takes no `pipeline` prop, so this is inert
// today; it is here so guard-proof (i) — restoring the prop and the sum — has something to
// sum and is OBSERVABLE. Without it the injection would render $0 and look like a pass.
const DANNYS_PIPELINE = [
  { id: 'a', status: 'complete', bonusEarned: true, payout: 500, conversion_bonus: 500 },
  { id: 'b', status: 'sold', bonusEarned: false, payout: null, conversion_bonus: null },
];

function mount(opts) {
  global.fetch = installFetch(opts);
  return render(
    <ThemeProvider>
      <CashOut
        pipeline={DANNYS_PIPELINE}
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

describe('payout commit (3b) — the Cash Out screen reads the server balance', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { delete global.fetch; });

  it('⚠ DANNY\'S SHAPE: a server balance of −500 does NOT display $500', async () => {
    mount({ available: -500 });
    await waitFor(() => expect(balanceLine().textContent).not.toMatch(/Checking/));
    const text = balanceLine().textContent;
    // The exact defect: the old client-side sum rendered "$500 available" here.
    expect(text).not.toMatch(/\$500 available/);
    expect(text).toMatch(/over-paid/);
    expect(text).toMatch(/nothing available/);
  });

  it('a negative balance shows the amount owed rather than hiding or clamping it', async () => {
    mount({ available: -500 });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/over-paid/));
    // ⚠ ANCHORED ON THE SURROUNDING PHRASE, NOT THE BARE VALUE. `toContain('500')` would be
    // satisfied by "$1,500" or "$5000" — CLAUDE.md's toContain-on-a-bare-value trap.
    expect(balanceLine().textContent).toMatch(/\$500 over-paid/);
  });

  it('a ZERO balance says so and does not offer a request', async () => {
    mount({ available: 0 });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/\$0 available/));
    expect(screen.getByText(/No balance available to cash out/)).toBeTruthy();
  });

  it('a positive balance renders the SERVER\'s figure', async () => {
    // ⚠ THE PAIRED POSITIVE FOR EVERY REFUSAL ABOVE. Without it, a screen that rendered
    // "nothing available" unconditionally would pass all of them — and that is an outage,
    // not a safety improvement.
    mount({ available: 137 });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/\$137 available/));
    expect(balanceLine().textContent).not.toMatch(/over-paid/);
  });

  it('distinguishes NOT-YET-KNOWN from zero', async () => {
    // ⚠ THE STATE A NUMERIC DEFAULT WOULD ERASE. Before the fetch resolves there is no
    // basis for any figure, and "$0 available" is a different, real answer — so the two
    // must not render identically.
    mount({ available: 0 });
    expect(balanceLine().textContent).toMatch(/Checking balance/);
    await waitFor(() => expect(balanceLine().textContent).toMatch(/\$0 available/));
  });

  it('a FAILED balance fetch fails closed — it never invents a number', async () => {
    mount({ available: 0, fail: true });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/Balance unavailable/));
    // ⚠ THE NEEDLE IS A DOLLAR FIGURE FOLLOWED BY "available", NOT `/available$/`.
    // This assertion was first written as `not.toMatch(/available$/)` and FAILED against
    // correct code, because "Balance unavailable" ENDS WITH "available" — the substring trap
    // CLAUDE.md records, in the checker rather than in the subject. What is actually
    // forbidden is reporting a FIGURE as available, so that is what is matched.
    expect(balanceLine().textContent).not.toMatch(/\$[\d,]+ available/);
    expect(screen.getByText(/could not read your balance/)).toBeTruthy();
  });

  it('a MALFORMED balance (a string) is rejected rather than rendered', async () => {
    // ⚠ Number.isFinite, not `!= null`: `'lots'` would concatenate into "$lots available".
    mount({ available: 0, malformed: true });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/Balance unavailable/));
    expect(balanceLine().textContent).not.toMatch(/lots/);
  });

  it('it actually requests the balance endpoint with the bearer token', async () => {
    // ⚠ THE NON-VACUITY CONTROL FOR THE WHOLE FILE. Every case above reads rendered text;
    // none of them proves the component asked the SERVER rather than computing something
    // that happens to match. This one does.
    mount({ available: 42 });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/\$42 available/));
    const calls = global.fetch.mock.calls.map(c => String(c[0]));
    expect(calls.some(u => u.includes('/api/cashout/balance'))).toBe(true);
    const call = global.fetch.mock.calls.find(c => String(c[0]).includes('/api/cashout/balance'));
    expect(call[1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  // ── THE SOURCE FENCE ───────────────────────────────────────────────────────

  it('⚠ FENCE: no src/ file computes an available balance itself', () => {
    // ⚠ NEEDLE ASSEMBLED FROM PIECES so this file cannot match itself.
    // The shape is a `reduce(` in the same expression as `payout` — which is exactly the
    // removed defect, and is not a shape any legitimate display code needs.
    const PAYOUT = 'pay' + 'out';
    const REDUCE = 'red' + 'uce(';
    const root = path.join(process.cwd(), 'src');
    const offenders = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(js|jsx)$/.test(entry.name)) continue;
        if (/\.test\.(js|jsx)$/.test(entry.name)) continue;   // tests are not production code
        const src = fs.readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        const lines = src.split(/\r?\n/);          // ⚠ /\r?\n/, never /\n/ — CRLF working trees
        lines.forEach((line, i) => {
          if (line.includes(REDUCE) && line.includes(PAYOUT)) {
            offenders.push(`${path.relative(process.cwd(), full)}:${i + 1}`);
          }
        });
      }
    })(root);
    expect(offenders, `a src/ file sums payouts into a balance at:\n  ${offenders.join('\n  ')}\n` +
      'Read the server balance from GET /api/cashout/balance instead.').toEqual([]);
  });

  it('HARNESS FLOOR: the fence\'s walk and needle both work', () => {
    // ⚠ WITHOUT THIS THE FENCE PASSES BECAUSE THE WALK FOUND NOTHING, which is
    // indistinguishable from a clean codebase. Proven two ways: the walk reaches a known
    // file, and the needle matches a synthetic line of the forbidden shape.
    const PAYOUT = 'pay' + 'out';
    const REDUCE = 'red' + 'uce(';
    const root = path.join(process.cwd(), 'src');
    let seen = 0;
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (/\.jsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) seen++;
      }
    })(root);
    expect(seen).toBeGreaterThan(50);
    const synthetic = `const b = list.${REDUCE}(s, p) => s + p.${PAYOUT}, 0);`;
    expect(synthetic.includes(REDUCE) && synthetic.includes(PAYOUT)).toBe(true);
  });

  it('CashOutTab no longer takes the pipeline prop at all', () => {
    // ⚠ THE STRUCTURAL HALF. The prop was the INPUT to the deleted calculation; while it
    // remains in the signature the calculation can be restored without touching the caller,
    // and nothing would flag it.
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'referrer', 'CashOutTab.jsx'), 'utf8'
    );
    const sig = src.match(/export default function CashOut\(\{[^}]*\}/)[0];
    expect(sig).not.toMatch(/\bpipeline\b/);
  });
});
