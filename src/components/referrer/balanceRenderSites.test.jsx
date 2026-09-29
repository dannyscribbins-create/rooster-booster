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

  // ⚠ THE THREE CASES BELOW WERE **INVERTED BY A RULING**, NOT CORRECTED FOR A BUG, AND THE
  // OLD ASSERTIONS ARE QUOTED SO THE CHANGE IS REVIEWABLE RATHER THAN SILENT.
  // Commit (3b) made this screen say "$500 over-paid — nothing available", and these cases
  // ASSERTED that wording. Danny then ruled (§2.9, 2026-09-29) that a zero or negative balance
  // shows on every referrer surface as a plain $0 with **no message of any kind** — never
  // "over-paid", "overpaid", "negative", or a minus sign. So:
  //   · toMatch(/over-paid/) on the balance line      → now the exact opposite
  //   · toMatch(/[$]500 over-paid/)                   → retired; the figure is not shown at all
  //   · getByText(/No balance available to cash out/)  → that copy was REMOVED
  // ⚠ THE PREVIOUS WORDING WAS HONEST AND IS NOW FORBIDDEN. That is a product decision about
  // what a referrer should be told, not a discovery that the old text was wrong — and the
  // distinction matters, because the TRUE value is still what the server returns and what the
  // admin panel shows.
  // ⚠ INVERTED A SECOND TIME, BY §2.10 AMENDING §2.9 THE DAY AFTER IT SHIPPED. The old
  // assertions are quoted so the reversal is reviewable:
  //   · toMatch(/[$]0 available/) on a −500 balance — the clamp
  //   · not.toMatch(/-[$]/)                          — a minus sign was forbidden outright
  //   · getByText(/No balance available to cash out/) — already removed by §2.9 itself
  // ⚠ BOTH WERE CORRECT UNDER §2.9 AND ARE NOW WRONG, AND NEITHER WAS A BUG. The clamp made a
  // referrer who earned $300 while at −$500 see `$0` and conclude nothing had happened, so
  // Danny amended the ruling to show the truth. **Recording the reversal is what stops the
  // next reader treating the clamp as the intent.**
  it('⚠ DANNY\'S SHAPE: a server balance of −500 displays as −$500, not $0 and not $500', async () => {
    mount({ available: -500 });
    await waitFor(() => expect(balanceLine().textContent).not.toMatch(/Checking/));
    const text = balanceLine().textContent;
    expect(text).toMatch(/-\$500 available/);
    expect(text).not.toMatch(/\$0 available/);
    // ⚠ THE ORIGINAL FINDING-6 DEFECT WAS A **POSITIVE** $500 HERE, so the needle has to
    // exclude the minus — `not.toMatch(/\$500/)` would fail against the correct `-$500`,
    // which is the substring trap this arc has now hit four times.
    expect(text).not.toMatch(/(^|[^-])\$500 available/);
  });

  it('⚠ a negative balance shows the §2.10 note, and NOTHING implying a debt', async () => {
    const { container } = mount({ available: -500 });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/-\$500/));
    const note = document.querySelector('[data-balance-note]');
    expect(note).toBeTruthy();
    expect(note.textContent).toBe('Your balance reflects a recent adjustment. Questions? Contact us.');
    // ⚠ POLICY B MEANS THE REFERRER OWES NOTHING (§2.8), so no wording may imply one. This is
    // the half of the old case that SURVIVES the amendment: the minus sign is now required,
    // but the debt language is still forbidden.
    const all = container.textContent;
    expect(all).not.toMatch(/over-?paid/i);
    expect(all).not.toMatch(/\bdebt\b/i);
    expect(all).not.toMatch(/\bowe[sd]?\b/i);
    expect(all).not.toMatch(/\brepay\b/i);
    expect(all).not.toMatch(/negative/i);
  });

  it('⚠ a TRUE $0 displays $0 with NO note — the half of §2.9 that SURVIVED', async () => {
    // ⚠ THE DISTINCTION THE AMENDMENT TURNS ON. A `$0` meaning "no progress yet" keeps its
    // silence; a `$0` that was hiding a negative no longer exists. `showsBalanceNote` tests
    // `< 0` and not `<= 0` for exactly this, and this case is what pins the difference.
    const { container } = mount({ available: 0 });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/\$0 available/));
    expect(document.querySelector('[data-balance-note]')).toBeNull();
    expect(container.textContent).not.toMatch(/adjustment/i);
  });

  // ⚠ RENAMED: this read "no method button is offered", which stated the opposite of what it
  // now asserts. A name that misdescribes its own assertion is the inverted-record failure.
  it('⚠ a non-positive balance DISABLES the request — every method button is disabled', async () => {
    // ⚠ THE OTHER HALF OF THE RULING, AND THE HALF THAT PROTECTS THE REFERRER. Silence about
    // the balance is only acceptable because the control is blocked; a screen that said $0 and
    // still let a request through would be worse than the wording it replaced.
    mount({ available: -500 });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/-\$500/));
    expect(screen.queryByText(/Minimum cashout amount/i)).toBeNull();
    // ⚠ DISABLED, NOT ABSENT — AND THE FIRST WRITING OF THIS CASE ASSERTED ABSENCE AND FAILED
    // AGAINST CORRECT CODE. Danny's ruling is that the request is BLOCKED (button disabled),
    // which is a different claim from the chooser not rendering: a screen that hid its controls
    // entirely would leave a referrer with a $0 and no explanation of what the screen is even
    // for. `queryByText('Venmo')` also returns the label `<p>` INSIDE the button, so asserting
    // on the text could never have reached the button's own state — the enclosing control is
    // what carries it.
    const methodButtons = Array.from(document.querySelectorAll('button'))
      .filter(b => /Venmo|Check/.test(b.textContent));
    expect(methodButtons.length).toBeGreaterThan(0);
    for (const b of methodButtons) {
      expect(b.disabled).toBe(true);
    }
  });

  it('⚠ PAIRED POSITIVE: a healthy balance is unchanged and the request IS enabled', async () => {
    // ⚠ WITHOUT THIS, EVERY ASSERTION ABOVE IS SATISFIED BY A SCREEN THAT SHOWS $0 AND OFFERS
    // NOTHING TO ANYONE — which is an outage, not a clamp. This is the case that fails if the
    // clamp over-reaches.
    mount({ available: 640 });
    await waitFor(() => expect(balanceLine().textContent).toMatch(/\$640 available/));
    const methodButtons = Array.from(document.querySelectorAll('button'))
      .filter(b => /Venmo|Check/.test(b.textContent));
    expect(methodButtons.length).toBeGreaterThan(0);
    for (const b of methodButtons) {
      expect(b.disabled).toBe(false);
    }
    expect(screen.queryByText(/Minimum cashout amount/i)).toBeNull();
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

  it('⚠ FENCE: no referrer-facing file contains the forbidden balance wording', () => {
    // ⚠ A SOURCE FENCE ACROSS THE WHOLE REFERRER TREE, BECAUSE THE RENDER TESTS ABOVE COVER
    // ONE SCREEN. Danny's §2.9 ruling is about EVERY referrer surface, and `ProfileTab.jsx`
    // shows a Balance row too. Mounting ProfileTab means standing up six unrelated fetches, so
    // its coverage here is deliberately STRUCTURAL — stated rather than implied, because a
    // source fence cannot see a word assembled at runtime.
    // ⚠ NEEDLES BUILT FROM PIECES so this file cannot match itself.
    const OVER = 'over' + '-paid';
    const OVER2 = 'over' + 'paid';
    const NEG = 'neg' + 'ative';
    const root = path.join(process.cwd(), 'src', 'components', 'referrer');
    const offenders = [];
    for (const name of fs.readdirSync(root)) {
      if (!/\.jsx?$/.test(name) || /\.test\./.test(name)) continue;
      const raw = fs.readFileSync(path.join(root, name), 'utf8');
      // ⚠ COMMENTS STRIPPED. Both CashOutTab and ProfileTab now carry comments EXPLAINING the
      // ruling, which necessarily name the forbidden words — the "a guard that fires on the
      // prose beside it" case where the prose must be allowed to say what it forbids.
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      src.split(/\r?\n/).forEach((line, i) => {
        const l = line.toLowerCase();
        // "over-paid" / "overpaid" have no legitimate non-copy use in this tree, so they are
        // flagged wherever they appear.
        if (l.includes(OVER) || l.includes(OVER2)) {
          offenders.push(`${name}:${i + 1} — ${line.trim().slice(0, 80)}`);
          return;
        }
        // ⚠ "negative" IS FLAGGED ONLY INSIDE USER-VISIBLE COPY, AND THE FIRST WRITING OF THIS
        // FENCE GOT THAT WRONG. A bare word match reported `ExperiencePopup.jsx`'s
        // `direction === 'negative'` twice — the experience flow's own positive/negative
        // branch, nothing to do with a balance. **A heuristic that reports plausible findings is
        // worse than none**, and a fence flagging two correct lines would have been switched off
        // or carved out within a month.
        // ⚠ THE DISCRIMINATOR IS A SPACE INSIDE THE STRING. Copy has spaces ("your balance is
        // negative"); an enum value or identifier does not ('negative'). Validated in BOTH
        // directions: it spares the ExperiencePopup lines and catches the synthetic copy in the
        // harness floor below.
        for (const span of line.match(/'[^']*'|"[^"]*"|`[^`]*`/g) || []) {
          const inner = span.slice(1, -1);
          if (inner.toLowerCase().includes(NEG) && /\s/.test(inner)) {
            offenders.push(`${name}:${i + 1} — ${line.trim().slice(0, 80)}`);
            return;
          }
        }
      });
    }
    expect(offenders, 'forbidden balance wording on a referrer surface:\n  ' +
      offenders.join('\n  ')).toEqual([]);
  });

  it('HARNESS FLOOR: the wording fence reads real referrer files and its needles work', () => {
    // ⚠ WITHOUT THIS THE FENCE ABOVE PASSES BECAUSE THE DIRECTORY LISTING FOUND NOTHING.
    const root = path.join(process.cwd(), 'src', 'components', 'referrer');
    const files = fs.readdirSync(root).filter(n => /\.jsx?$/.test(n) && !/\.test\./.test(n));
    expect(files).toContain('CashOutTab.jsx');
    expect(files).toContain('ProfileTab.jsx');
    // ⚠ BOTH DIRECTIONS. It must catch forbidden COPY and spare the legitimate identifier —
    // the exact pair the first writing of the fence got wrong on `ExperiencePopup.jsx`.
    const NEG = 'neg' + 'ative';
    const copy = `"your balance is ${NEG}"`;
    const identifier = `direction === '${NEG}'`;
    const flags = (line) => (line.match(/'[^']*'|"[^"]*"|`[^`]*`/g) || [])
      .some(sp => sp.slice(1, -1).toLowerCase().includes(NEG) && /\s/.test(sp.slice(1, -1)));
    expect(flags(copy)).toBe(true);        // catches the defect
    expect(flags(identifier)).toBe(false); // spares the idiom
    const synthetic = 'label: "You are over-paid"';
    expect(synthetic.toLowerCase().includes('over' + '-paid')).toBe(true);
  });

  it('⚠ ProfileTab clamps its Balance row and keeps the true value for the admin', () => {
    // ⚠ STRUCTURAL, AND THE LIMIT IS STATED: this reads source rather than rendering, so it
    // proves the clamp is WRITTEN, not that it paints. The wording fence above is what covers
    // ProfileTab's copy; between them the ruling is covered on that screen without standing up
    // its six unrelated fetches.
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'referrer', 'ProfileTab.jsx'), 'utf8'
    );
    // The Balance row must clamp at zero...
    expect(src).toMatch(/Math\.max\(0,\s*serverBalance\)/);
    // ...and must still READ the server's own figure rather than computing one.
    expect(src).toMatch(/api\/cashout\/balance/);
    // ⚠ AND THE OLD CLIENT-SIDE SUM MUST BE GONE, which is the other half of finding 6 on this
    // screen — it summed `conversion_bonus ?? payout` and subtracted no cashouts at all.
    expect(src).not.toMatch(/reduce\([^)]*conversion_bonus/);
  });

  // ── THE RENDER-SITE FENCE ──────────────────────────────────────────────────
  // ⚠ THIS EXISTS BECAUSE THE PREVIOUS FENCE WAS THE WRONG SHAPE AND MISSED THE MAIN SCREEN.
  // That one forbade a client-side SUM (`reduce(` beside `payout`), which caught Cash Out and
  // Profile because they CALCULATED a balance. The Dashboard calculated nothing — it rendered
  // `data.balance`, the server's speculative pipeline total, handed down as a PROP from
  // App.jsx — so a fence for the shape of a CALCULATION was structurally blind to it. One
  // account read $500 there and $0 on the other two screens on the same day.
  // ⚠ SO THIS FENCE IS ABOUT SOURCES, NOT ARITHMETIC: every balance must originate from
  // `useCashoutBalance`, and the two speculative fields must reach no render at all.
  // **A value that arrives already wrong is still wrong.**

  const SPECULATIVE_FIELDS = ['data' + '.balance', 'detail' + '.balance'];
  const ENDPOINT = '/api/cashout' + '/balance';
  const HOOK = path.join('src', 'hooks', 'useCashoutBalance.js');

  function srcFiles(root) {
    const out = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(js|jsx)$/.test(entry.name)) continue;
        if (/\.test\.(js|jsx)$/.test(entry.name)) continue;
        out.push(full);
      }
    })(root);
    return out;
  }

  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('⚠ FENCE: only the shared hook fetches the balance endpoint', () => {
    const offenders = [];
    for (const file of srcFiles(path.join(process.cwd(), 'src'))) {
      const rel = path.relative(process.cwd(), file);
      if (rel === HOOK || rel.replace(/\//g, '\\') === HOOK) continue;
      strip(fs.readFileSync(file, 'utf8')).split(/\r?\n/).forEach((line, i) => {
        if (line.includes(ENDPOINT)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(offenders, 'a second balance fetcher:\n  ' + offenders.join('\n  ') +
      '\nImport useCashoutBalance instead.').toEqual([]);
  });

  it('⚠ FENCE: no src/ file RENDERS a speculative balance field', () => {
    // ⚠ THIS IS THE ONE THAT WOULD HAVE CAUGHT THE DASHBOARD. `data.balance` and
    // `detail.balance` are the two pipeline-derived totals that subtract no cash-outs. Neither
    // may appear anywhere in src/ — not rendered, not assigned, not passed on.
    const offenders = [];
    for (const file of srcFiles(path.join(process.cwd(), 'src'))) {
      const rel = path.relative(process.cwd(), file);
      strip(fs.readFileSync(file, 'utf8')).split(/\r?\n/).forEach((line, i) => {
        for (const f of SPECULATIVE_FIELDS) {
          if (line.includes(f)) offenders.push(`${rel}:${i + 1} — ${f}`);
        }
      });
    }
    expect(offenders, 'a speculative balance reaches a render site:\n  ' +
      offenders.join('\n  ') + '\nRead the balance from useCashoutBalance.').toEqual([]);
  });

  it('⚠ FENCE: no component is handed a balance as a PROP', () => {
    // ⚠ THE PROP-DELIVERED CASE, NAMED EXPLICITLY, because that is exactly how the Dashboard
    // received its wrong number and why a source fence has to look for delivery as well as for
    // computation. A `balance={...}` prop means some parent decided the figure.
    const offenders = [];
    for (const file of srcFiles(path.join(process.cwd(), 'src'))) {
      const rel = path.relative(process.cwd(), file);
      strip(fs.readFileSync(file, 'utf8')).split(/\r?\n/).forEach((line, i) => {
        if (/\bbalance=\{/.test(line)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(offenders, 'a balance is passed as a prop:\n  ' + offenders.join('\n  ') +
      '\nCall useCashoutBalance in the component that renders it.').toEqual([]);
  });

  it('HARNESS FLOOR: the render-site fence walks real files and its needles work', () => {
    // ⚠ WITHOUT THIS ALL THREE FENCES ABOVE PASS BECAUSE THE WALK FOUND NOTHING, which is
    // indistinguishable from a clean codebase — the shape CLAUDE.md records as a mechanism
    // reporting health it never observed.
    const files = srcFiles(path.join(process.cwd(), 'src')).map(f => path.relative(process.cwd(), f));
    expect(files.length).toBeGreaterThan(50);
    expect(files.some(f => /DashboardTab\.jsx$/.test(f))).toBe(true);
    expect(files.some(f => /useCashoutBalance\.js$/.test(f))).toBe(true);
    // The hook must actually contain the endpoint, or fence 1 is vacuous.
    const hook = fs.readFileSync(path.join(process.cwd(), HOOK), 'utf8');
    expect(hook.includes(ENDPOINT)).toBe(true);
    // And each needle must match a synthetic line of the forbidden shape.
    expect('const b = data' + '.balance;').toContain(SPECULATIVE_FIELDS[0]);
    expect(/\bbalance=\{/.test('<Dashboard balance={x} />')).toBe(true);
    // ⚠ AND MUST SPARE THE LEGITIMATE IDIOM: `balanceState`, `balanceText`, `balanceNote` and
    // `cashoutBalance` are all real identifiers in this tree and none is a prop pass.
    expect(/\bbalance=\{/.test('const balanceText = formatBalance(balanceState);')).toBe(false);
    expect('detail.cashoutBalance.available').not.toContain(SPECULATIVE_FIELDS[1] + '.');
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
