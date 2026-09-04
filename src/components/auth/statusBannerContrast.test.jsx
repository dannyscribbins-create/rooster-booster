// ─────────────────────────────────────────────────────────────────────────────
// R-1 — THE AUTH STATUS BANNERS MEET THEIR CONTRAST FLOOR **AS RENDERED**
//
// THE DEFECT THIS FENCES: A FALLBACK THAT IS CORRECT ONLY WHILE THE VARIABLE IS
// ABSENT. LoginScreen, ResetPinScreen and ChoiceScreen each declared
//
//     backgroundColor: 'var(--rm-danger,      #FEE2E2)'   <- a pale pink tint
//     color:           'var(--rm-danger-text, #B91C1C)'   <- dark red on it
//
// The fallback pair is fine — 5.30:1 — and NEVER PAINTS. ThemeProvider mounts
// --rm-danger as STATUS_LIGHT.danger (#DC2626), a SATURATED FILL, over the whole
// routed tree. So the rendered pair was dark red on bright red: 1.34:1, on the
// product's most-reached error path. The success banners were 1.52:1.
//
// ⚠ WHY NO EXISTING TEST COULD SEE IT, AND WHY THIS FILE IS SHAPED THE WAY IT IS.
// jsdom does not resolve var(). Every assertion in this repo that reads a colour
// reads the DECLARATION STRING, which contains the innocent fallback. A test
// written the obvious way reproduces the defect it is meant to catch: it measures
// #B91C1C on #FEE2E2, gets 5.30:1, and goes green against a 1.34:1 screen.
//
// ⚠ SO EVERY RATIO BELOW IS COMPUTED FROM THE **MOUNTED** VALUE, RESOLVED THROUGH
// themeVariables() — the same function ThemeProvider mounts from — and never from
// the fallback. resolveDeclared() returns both and the assertions use `.mounted`.
// That choice is the entire point of the file; see the assertion messages, which
// name which value was measured so a failure cannot be misread.
//
// ⚠ AND THE HELPER THROWS RATHER THAN RETURNING A "NO ANSWER" SHAPE. A resolver
// that could also answer "I could not parse that" would satisfy every assertion
// here without measuring anything — the double-that-can-stand-in-for-failure
// trap CLAUDE.md records from the BR arc. Unparseable declaration, or a custom
// property ThemeProvider does not mount: both throw.
//
// ⚠ EACH CASE ALSO ASSERTS THE MESSAGE IS PRESENT BEFORE MEASURING. A banner that
// stopped rendering would otherwise make every contrast assertion vacuously
// unreachable, which is the shape that put a ReferenceError past a green sweep.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent } from '@testing-library/react';
import { contrastRatio } from '../../utils/themeTokens.mjs';
import { themeVariables } from '../shared/ThemeProvider';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';
import LoginScreen from './LoginScreen';
import ResetPinScreen from './ResetPinScreen';
import ChoiceScreen from './ChoiceScreen';
import SignupScreen from './SignupScreen';

// WCAG SC 1.4.3 normal text. Every banner message below is 14–15px regular
// weight, so the large-text allowance (18.66px bold / 24px) does not apply.
const TEXT_FLOOR = 4.5;
// WCAG SC 1.4.11 non-text contrast, for the icon and the banner edge.
const GRAPHIC_FLOOR = 3.0;

// What ThemeProvider ACTUALLY mounts over the routed tree, for the unset
// contractor. Built by the provider's own function so this cannot drift from it.
const MOUNTED_LIGHT = themeVariables(resolveBrandingTheme(null), 'light');
const MOUNTED_DARK = themeVariables(resolveBrandingTheme(null), 'dark');

/**
 * Splits a `var(--rm-x, #hex)` declaration and resolves it against the mounted
 * table. Returns BOTH values so a caller must choose, and so an assertion
 * message can say which one it used.
 *
 * @throws if the declaration is not a var() form, or names a custom property
 *         ThemeProvider does not mount. Never returns a partial answer.
 */
function resolveDeclared(declared, mounted = MOUNTED_LIGHT) {
  if (typeof declared !== 'string' || declared.trim() === '') {
    throw new Error(`resolveDeclared: empty declaration ${JSON.stringify(declared)} — ` +
      'the element did not render the style, or jsdom dropped it');
  }
  const m = /^var\(\s*(--rm-[a-z0-9-]+)\s*,\s*([^)]*)\)$/.exec(declared.trim());
  if (!m) {
    throw new Error(`resolveDeclared: not a var() declaration: ${JSON.stringify(declared)}`);
  }
  const [, name, fallback] = m;
  if (!Object.prototype.hasOwnProperty.call(mounted, name)) {
    throw new Error(`resolveDeclared: ${name} is not mounted by ThemeProvider — ` +
      `a declaration naming it would take its fallback forever`);
  }
  return { name, fallback: fallback.trim(), mounted: mounted[name] };
}

/** The banner element is the styled box wrapping the message paragraph. */
function bannerFor(messageNode) {
  const box = messageNode.closest('div[style]');
  if (!box) throw new Error('no styled banner ancestor found for the message');
  return box;
}

/**
 * The assertion every case shares. Reads the DECLARED strings, resolves both
 * through the MOUNTED table, and measures the mounted pair.
 */
function expectBannerLegible(banner, messageNode, label, mounted = MOUNTED_LIGHT) {
  const bg = resolveDeclared(banner.style.backgroundColor, mounted);
  const fg = resolveDeclared(messageNode.style.color, mounted);
  const rendered = contrastRatio(fg.mounted, bg.mounted);
  const asFallback = contrastRatio(fg.fallback, bg.fallback);

  expect(
    rendered,
    `${label}: MEASURED THE MOUNTED PAIR — ${fg.name}=${fg.mounted} on ` +
    `${bg.name}=${bg.mounted} = ${rendered.toFixed(2)}:1, floor ${TEXT_FLOOR}. ` +
    `(The DECLARED fallbacks ${fg.fallback} on ${bg.fallback} would measure ` +
    `${asFallback.toFixed(2)}:1 — that pair never paints and is not what this asserts.)`
  ).toBeGreaterThanOrEqual(TEXT_FLOOR);
}

function installFetch(impl) {
  global.fetch = impl;
}

afterEach(() => { delete global.fetch; });

// ── T2 — THE REGRESSION FENCE ───────────────────────────────────────────────
// The six banners are safe because their background is a SURFACE, not a status
// FILL. These cases pin the fact that the fill tokens are fills, so that if the
// status palette is ever retuned into tints, the banners are re-examined rather
// than silently re-inverting.
describe('R-1 T2 — the mounted status fills are FILLS, and text may not sit on them', () => {
  it('ThemeProvider mounts --rm-danger / --rm-success as the STATUS_LIGHT fills', () => {
    expect(MOUNTED_LIGHT['--rm-danger']).toBe(STATUS_LIGHT.danger);
    expect(MOUNTED_LIGHT['--rm-success']).toBe(STATUS_LIGHT.success);
    expect(MOUNTED_DARK['--rm-danger']).toBe(STATUS_DARK.danger);
    expect(MOUNTED_DARK['--rm-success']).toBe(STATUS_DARK.success);
  });

  it('those fills CANNOT carry their own text tone — this is why R-1 existed', () => {
    // ⚠ THIS IS A NEGATIVE ASSERTION AND ITS PURPOSE IS DELIBERATE, so state it:
    // it pins the REASON the banners must not use a fill as a background. If a
    // future palette change made these pairs legible, this case goes red and the
    // banner design becomes a free choice again rather than a forced one.
    expect(contrastRatio(STATUS_LIGHT.dangerText, STATUS_LIGHT.danger)).toBeLessThan(TEXT_FLOOR);
    expect(contrastRatio(STATUS_LIGHT.successText, STATUS_LIGHT.success)).toBeLessThan(TEXT_FLOOR);
  });

  it('the status fills clear the GRAPHIC floor on the mounted surface, in both modes', () => {
    for (const [mode, mounted, palette] of [
      ['light', MOUNTED_LIGHT, STATUS_LIGHT], ['dark', MOUNTED_DARK, STATUS_DARK],
    ]) {
      for (const role of ['danger', 'success']) {
        const ratio = contrastRatio(palette[role], mounted['--rm-surface']);
        expect(ratio, `${mode} ${role} edge ${palette[role]} on surface ` +
          `${mounted['--rm-surface']} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
      }
    }
  });

  it('the status TEXT tones clear the text floor on the mounted surface, both modes', () => {
    for (const [mode, mounted, palette] of [
      ['light', MOUNTED_LIGHT, STATUS_LIGHT], ['dark', MOUNTED_DARK, STATUS_DARK],
    ]) {
      for (const role of ['dangerText', 'successText']) {
        const ratio = contrastRatio(palette[role], mounted['--rm-surface']);
        expect(ratio, `${mode} ${role} ${palette[role]} on surface ` +
          `${mounted['--rm-surface']} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
      }
    }
  });
});

// ── T1 — THE SIX REGIONS, EACH REACHED BY A REAL INTERACTION ────────────────
describe('R-1 T1 — every auth status banner is legible as rendered', () => {
  it('LoginScreen — the failed-login error banner', async () => {
    installFetch(async () => ({ ok: true, json: async () => ({ error: 'Incorrect email or password.' }) }));
    render(<LoginScreen onAuthenticated={() => {}} />);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'whatever1' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    const msg = await screen.findByText('Incorrect email or password.');
    expectBannerLegible(bannerFor(msg), msg, 'LoginScreen failed-login error');
  });

  // ⚠ THE FORGOT SUB-FORM'S EMAIL LABEL IS THE SAME SENTENCE AS THE LOGIN FORM'S,
  // so getByLabelText('Email address') throws on multiple matches — the exact trap
  // CLAUDE.md records from BR-2. Anchored on the id instead, which is structural.
  function openForgot(container) {
    fireEvent.click(screen.getByRole('button', { name: /Forgot password\?/i }));
    const field = container.querySelector('#rm-forgot-email');
    if (!field) throw new Error('the forgot-password email field did not render');
    fireEvent.change(field, { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: /Send reset link/i }));
  }

  it('LoginScreen — the forgot-password error banner', async () => {
    installFetch(async () => { throw new Error('network'); });
    const { container } = render(<LoginScreen onAuthenticated={() => {}} />);
    openForgot(container);

    const msg = await screen.findByText('Something went wrong. Please try again.');
    expectBannerLegible(bannerFor(msg), msg, 'LoginScreen forgot-password error');
  });

  it('LoginScreen — the forgot-password success banner', async () => {
    installFetch(async () => ({ ok: true, json: async () => ({ success: true }) }));
    const { container } = render(<LoginScreen onAuthenticated={() => {}} />);
    openForgot(container);

    const msg = await screen.findByText(/a reset link is on its way/i);
    // The success banner styles the box and carries the text on the SAME element.
    expectBannerLegible(msg, msg, 'LoginScreen forgot-password success');
  });

  function fillReset(container, value) {
    const pw = container.querySelector('#rm-reset-password');
    const confirm = container.querySelector('#rm-reset-confirm');
    if (!pw || !confirm) throw new Error('the reset password fields did not render');
    fireEvent.change(pw, { target: { value } });
    fireEvent.change(confirm, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: /Set password/i }));
  }

  it('ResetPinScreen — the validation error banner', async () => {
    const { container } = render(<ResetPinScreen token="t" />);
    fillReset(container, 'short');

    const msg = await screen.findByText('Password must be at least 8 characters.');
    expectBannerLegible(bannerFor(msg), msg, 'ResetPinScreen error');
  });

  it('ResetPinScreen — the success banner', async () => {
    installFetch(async () => ({ ok: true, json: async () => ({ success: true }) }));
    const { container } = render(<ResetPinScreen token="t" />);
    fillReset(container, 'longenough1');

    const msg = await screen.findByText(/Password updated/i);
    expectBannerLegible(msg, msg, 'ResetPinScreen success');
  });

  it('ChoiceScreen — the error banner', async () => {
    render(
      <ChoiceScreen
        identities={[{ role: 'team', label: 'Alpha Roofing' }]}
        onChoose={() => {}}
        onCancel={() => {}}
        error="That did not work. Please try again."
      />
    );

    const msg = screen.getByText('That did not work. Please try again.');
    expectBannerLegible(bannerFor(msg), msg, 'ChoiceScreen error');
  });
});

// ── T2b — THE CLASS FENCE, NOT SIX INSTANCE FENCES ──────────────────────────
// The six cases above pin six banners. This pins THE RULE, so the next banner
// written anywhere in the auth tree cannot reintroduce R-1 in a new place.
describe('R-1 T2b — no auth-tree declaration puts a status *Text on a status fill', () => {
  const AUTH_DIR = path.resolve(process.cwd(), 'src/components/auth');
  const FILL_VARS = ['--rm-danger', '--rm-success', '--rm-warning'];

  it('every var() background in src/components/auth resolves to a SURFACE, never a FILL', () => {
    const files = fs.readdirSync(AUTH_DIR).filter((f) => /\.jsx$/.test(f) && !/\.test\./.test(f));
    // ⚠ NON-VACUITY: if the glob ever matches nothing this case would pass by
    // examining zero files, which is the failure this whole suite is about.
    expect(files.length, 'no auth screens were scanned').toBeGreaterThan(4);

    const offenders = [];
    let scanned = 0;
    for (const f of files) {
      // Split on /\r?\n/ — a $-anchored regex silently no-ops on a CRLF line,
      // and core.autocrlf=true is the Windows default (CLAUDE.md).
      const lines = fs.readFileSync(path.join(AUTH_DIR, f), 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*')) return;   // prose, not a declaration
        const m = /background(?:Color)?:\s*'var\(\s*(--rm-[a-z0-9-]+)/.exec(t);
        if (!m) return;
        scanned++;
        if (FILL_VARS.includes(m[1])) offenders.push(`${f}:${i + 1} — ${m[1]}`);
      });
    }
    expect(scanned, 'no var() backgrounds were found to scan').toBeGreaterThan(0);
    expect(
      offenders,
      'a status FILL is being used as a background. Text placed on it cannot ' +
      'meet 4.5:1 — that is R-1. Use var(--rm-surface, …) with a statusVar() edge:\n' +
      offenders.join('\n')
    ).toEqual([]);
  });
});

// ── T3 — THE SCREEN THAT NEVER REACHED FOR THE VARIABLE ─────────────────────
describe('R-1 T3 — SignupScreen is immune to the mount, and stays that way', () => {
  it('renders without throwing', () => {
    // ⚠ THE SOURCE-TEXT CASE BELOW PROVES A STRING IS ABSENT AND PROVES NOTHING
    // ABOUT WHETHER THE FILE STILL RUNS. CLAUDE.md records a component that threw
    // a ReferenceError on every render while its literal sweep passed. This is
    // that render.
    render(<SignupScreen inviteSlug="s" contractorName="Alpha Roofing" branding={null} onSignupComplete={() => {}} />);
    expect(screen.getByPlaceholderText('First')).toBeTruthy();
  });

  it('its error banner declares no --rm-* custom property, so nothing can override it', () => {
    // ⚠ THE POINT OF THIS CASE IS THE ABSENCE OF A var(), NOT A COLOUR VALUE.
    // SignupScreen paints its banner with opaque literals and therefore cannot
    // suffer R-1's inversion at all. Fenced so a later "consistency" sweep that
    // converts it to var(--rm-danger, …) has to come past this case and read why
    // that would be a regression rather than a tidy-up.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/auth/SignupScreen.jsx'), 'utf8'
    );
    const lines = source.split(/\r?\n/);
    const bannerStart = lines.findIndex((l) => l.includes('{serverError && ('));
    expect(bannerStart, 'the serverError banner block was not found').toBeGreaterThan(-1);
    // ⚠ THE WINDOW IS BOUNDED BY THE BLOCK'S OWN CLOSING TAG, NOT BY A LINE COUNT,
    // and comment lines are dropped before parsing. Both were learned here: a
    // fixed slice width stopped reaching the colour declaration the moment a
    // comment was added above it, and a wider fixed width ran past the banner into
    // unrelated var(--rm-*) code. A window that does not know where its subject
    // ends measures whatever happens to be nearby.
    const closeAt = lines.findIndex((l, i) => i > bannerStart && l.includes('</div>'));
    expect(closeAt, 'the serverError banner block never closed').toBeGreaterThan(bannerStart);
    const block = lines
      .slice(bannerStart, closeAt + 1)
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith('//') && !t.startsWith('{/*') && !t.startsWith('*') && !t.endsWith('*/');
      })
      .join('\n');

    expect(block).not.toMatch(/var\(--rm-/);
    // Both operands are opaque literals, so DECLARED IS RENDERED here — the one
    // place in this file where reading the declaration is legitimate.
    const bg = /background:\s*'(#[0-9a-fA-F]{6})'/.exec(block);
    const fg = /color:\s*'(#[0-9a-fA-F]{6})'/.exec(block);
    expect(bg, 'no literal background found in the signup error banner').toBeTruthy();
    expect(fg, 'no literal colour found in the signup error banner').toBeTruthy();

    const ratio = contrastRatio(fg[1], bg[1]);
    expect(
      ratio,
      `SignupScreen error text ${fg[1]} on ${bg[1]} = ${ratio.toFixed(2)}:1, floor ${TEXT_FLOOR}`
    ).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });
});
