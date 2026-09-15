// ─────────────────────────────────────────────────────────────────────────────
// PALETTE-15 — THE TWO AUTH SCREENS
//
// T1  every site resolves to its ruled token
// T2  no R. colour read, no retired HEX tone, no retired DECIMAL tone — and both
//     files still RENDER their substantive content
// T3  the page ground, and the measurement that removed the retired gradient
// T4  the absence rule holds pre-auth, in BOTH directions
// T5  BrandMark and the dark plate still behave
// T7  Palette-1's shortfall fences are not weakened
//
// ── ⚠ WHY THIS PHASE EXISTS, AND WHY IT IS NOT RESIDUE ──────────────────────
// `SignupScreen` and `EmailVerifyScreen` were NEVER COLOUR-MIGRATED while their
// five auth siblings were. They carried 43 `R.` colour keys, 22 retired-tone
// reaches and 5 gradients between them, on the SIGNUP AND EMAIL-VERIFICATION
// PATH — the first two screens a contractor's first referrer ever sees.
//
// ⚠ THEY SURVIVED ELEVEN PHASES FOR A REASON WORTH RECORDING: every sweep that
// reported "zero retired tones" was scoped to the REFERRER tree, and these are
// in `auth/`. A true statement whose SCOPE WAS NEVER STATED — the third find of
// that exact shape, after `App.jsx`'s focus ring and `ErrorBoundary`'s crash
// button.
//
// ── ⚠ WHAT THESE TESTS CAN AND CANNOT SEE ──────────────────────────────────
// jsdom does not resolve var(). Every assertion here is DECLARATION-level plus
// ARITHMETIC over the derivation: it proves a site NAMES the right property with
// the right fallback, and that the resulting pair clears its floor. IT CANNOT
// PROVE THE PROPERTY WAS MOUNTED — that is R-1's defect class, and it is the
// browser harness's half. A green run here is evidence about declarations and
// arithmetic, and about nothing that was painted.
//
// ⚠ EXPECTED COUNT: 26 cases in this file. Stated because a module that fails to
// LOAD contributes zero while the runner still reports the run as passing.
// ⚠ NINETEEN `for` LOOPS APPEAR BELOW AND EVERY ONE SITS INSIDE AN `it()` BODY
// OR A HELPER, so they multiply nothing — 26 `it(` lines, 26 cases. A loop that
// WRAPS an `it()` would; treating a loop as a case-multiplier because it is a
// loop is the other way this goes wrong.
// ⚠ AND 26 WAS COUNTED WITH `grep -c`, NOT ESTIMATED. A first pass planning this
// file predicted 25 — one block was written with three cases and planned with
// two. Both recorded estimate-instead-of-count failures in CLAUDE.md were LOW,
// and a prediction that is low looks identical to a suite that did not run.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import { STATUS_LIGHT, STATUS_VARS, statusVar } from '../../constants/statusTheme';
import { ELEVATION_LIGHT, ELEVATION_VARS, elevationVar } from '../../constants/elevationTheme';
import { R } from '../../constants/theme';
import ThemeProvider from '../shared/ThemeProvider';
import SignupScreen from './SignupScreen';
import EmailVerifyScreen from './EmailVerifyScreen';

const SRC = path.resolve(process.cwd(), 'src');
const readSrc = (rel) => fs.readFileSync(path.resolve(SRC, rel), 'utf8');
const SIGNUP = readSrc('components/auth/SignupScreen.jsx');
const VERIFY = readSrc('components/auth/EmailVerifyScreen.jsx');

const TEXT_FLOOR = 4.5;
const GRAPHIC_FLOOR = 3;

const BRANDS = [
  ['Gamma (UNSET)', null],
  ['Alpha', { primary_color: '#1C2D4D', secondary_color: '#F26A1B' }],
  ['Beta', { primary_color: '#0B3D3B', secondary_color: '#C2185B' }],
  ['Accent-shaped', { primary_color: '#012854', secondary_color: '#CC0000' }],
];
const MODES = ['light', 'dark'];

/** ⚠ THE LOOP IS INSIDE THIS HELPER, NOT AROUND AN `it()`. It emits no cases. */
function eachBrandMode(fn) {
  for (const [label, src] of BRANDS) {
    for (const mode of MODES) fn(label, mode, deriveThemeTokens(resolveBrandingTheme(src), mode));
  }
}

const pxOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (a) => '#' + a.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase();
/** Composites `hex` at `alpha` over `ground`. This is what `opacity:` produces. */
function composite(hex, ground, alpha) {
  const f = pxOf(hex), b = pxOf(ground);
  return hexOf([0, 1, 2].map((i) => f[i] * alpha + b[i] * (1 - alpha)));
}
function compositeRgba(rgba, ground) {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(rgba);
  if (!m) throw new Error(`compositeRgba: not an rgba() value: ${JSON.stringify(rgba)}`);
  const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
  return composite(hexOf([1, 2, 3].map((i) => Number(m[i]))), ground, alpha);
}

// ⚠ COMMENTS BLANKED LINE-BY-LINE, NOT DROPPED, so line numbers survive and a
// continuation line inside a block comment cannot be read as code. A draft of
// Palette-14's census read comments as code and over-reported by 15, inventing
// findings that were records of retired reads.
const codeOnly = (src) => src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split(/\r?\n/)
  .map((l) => (/^\s*\/\//.test(l) ? '' : l.replace(/\/\/[^\n'"`]*$/, '')))
  .join('\n');

const SIGNUP_CODE = codeOnly(SIGNUP);
const VERIFY_CODE = codeOnly(VERIFY);
const BOTH = [['SignupScreen', SIGNUP_CODE], ['EmailVerifyScreen', VERIFY_CODE]];

// ── THE THREE NEEDLES ───────────────────────────────────────────────────────
// ⚠ A retired tone reaches code THREE WAYS: as a HEX, as a DECIMAL rgba(), and
// through a KEY whose VALUE is the tone. The decimal needle has out-found the
// hex one in four consecutive phases, and the key needle is the only one that
// can see `R.navy`.
const RETIRED = [
  ['#012854', [1, 40, 84]],
  ['#CC0000', [204, 0, 0]],
  ['#8C0000', [140, 0, 0]],
  ['#D3E3F0', [211, 227, 240]],
  ['#041D3E', [4, 29, 62]],
];
// ⚠ THE LIGHT-BLUE KEY IS DELIBERATELY ABSENT FROM THIS LIST AND FROM THIS FILE
// IN ITS DOTTED FORM. Palette-15 deleted it from `R` — its only three readers
// were the two screens — so naming it here would make `themeKeyIntegrity`'s
// undefined-key check fire on this very file. Its tone `#D3E3F0` is still in
// RETIRED above, which is the route that matters.
const RETIRED_KEYS = ['navy', 'navyDark', 'red', 'redDark'];

function retiredReaches(code) {
  const hits = [];
  for (const [hex, [r, g, b]] of RETIRED) {
    if (new RegExp(hex, 'i').test(code)) hits.push('hex ' + hex);
    if (new RegExp('rgba?\\(\\s*' + r + '\\s*,\\s*' + g + '\\s*,\\s*' + b + '\\b').test(code)) {
      hits.push('decimal ' + hex);
    }
  }
  for (const k of RETIRED_KEYS) {
    if (new RegExp('\\bR\\.' + k + '\\b').test(code)) hits.push('key R.' + k);
  }
  return hits;
}

/** Every key `R` defines that is a COLOUR. Fonts and the two shadows are not. */
const R_COLOUR_KEYS = Object.keys(R).filter(
  (k) => !/^font/.test(k) && !/^shadow/.test(k)
);
function rColourReads(code) {
  const hits = [];
  for (const k of R_COLOUR_KEYS) {
    const n = (code.match(new RegExp('\\bR\\.' + k + '\\b', 'g')) || []).length;
    if (n) hits.push(`R.${k} x${n}`);
  }
  return hits;
}

const PAGE_GRADIENT = /background:\s*`?\s*linear-gradient/;

function installFetch(impl) {
  // ⚠ THE DOUBLE THROWS ON A SHAPE IT DOES NOT RECOGNISE. A permissive stub that
  // can also answer "no data" satisfies every assertion looking for an absence,
  // which is the trap the BR arc hit three times.
  vi.stubGlobal('fetch', async (url, init) => {
    if (typeof url !== 'string' && !(url instanceof URL)) {
      throw new Error(`fetch double: unexpected url shape ${Object.prototype.toString.call(url)}`);
    }
    if (init !== undefined && (init === null || typeof init !== 'object')) {
      throw new Error('fetch double: init must be an object or absent');
    }
    return impl(String(url), init);
  });
}
afterEach(() => { vi.unstubAllGlobals(); });

const SIGNUP_PROPS = {
  inviteSlug: 'slug', contractorName: 'Beta Exteriors',
  branding: null, onSignupComplete: () => {},
};
const VERIFY_PROPS = {
  userId: 7, email: 'dana@example.test', inviteSlug: 'slug',
  contractorName: 'Beta Exteriors', contractorId: 'palette-beta',
  branding: null, onVerifyComplete: () => {},
};

// ═══════════════════════════════════════════════════════════════════════════
// NON-VACUITY, FIRST AND UNCONDITIONALLY
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-15 — the sweep has something to sweep', () => {
  it('both sources were read and the comment blanker left code behind', () => {
    expect(SIGNUP.length).toBeGreaterThan(10000);
    expect(VERIFY.length).toBeGreaterThan(9000);
    expect(SIGNUP_CODE).toContain('export default function SignupScreen');
    expect(VERIFY_CODE).toContain('export default function EmailVerifyScreen');
    // Blanking preserves line count and removes content.
    expect(SIGNUP_CODE.split(/\r?\n/).length).toBe(SIGNUP.split(/\r?\n/).length);
    expect(SIGNUP_CODE.replace(/\s/g, '').length).toBeLessThan(SIGNUP.replace(/\s/g, '').length);
  });

  it('the needles find a planted tone and spare a near-miss — BOTH directions', () => {
    // ⚠ A needle that cannot match makes every absence assertion below
    // permanently satisfied, watching nothing.
    expect(retiredReaches("color: '#012854'")).toContain('hex #012854');
    expect(retiredReaches("boxShadow: '0 4px 14px rgba(1,40,84,0.35)'")).toContain('decimal #012854');
    expect(retiredReaches('background: R.navy')).toContain('key R.navy');
    expect(retiredReaches("color: '#012855'")).toEqual([]);        // one digit off
    expect(retiredReaches("color: 'rgba(1,40,85,0.35)'")).toEqual([]);
    expect(retiredReaches("color: '#1C2D4D'")).toEqual([]);        // the PLATFORM navy
    expect(rColourReads('background: R.bgPage')).toContain('R.bgPage x1');
    expect(rColourReads('fontFamily: R.fontBody')).toEqual([]);    // a FONT key, not a colour
    expect(rColourReads('boxShadow: R.shadowLg')).toEqual([]);     // the side channel's job
    expect(rColourReads('background: AD.bgPage')).toEqual([]);     // the admin set is a different question
    // ⚠ AND THE GRADIENT NEEDLE, so T3's absence assertion cannot go vacuous.
    expect(PAGE_GRADIENT.test('background: `linear-gradient(160deg, #012854 0%, #D3E3F0 100%)`')).toBe(true);
    expect(PAGE_GRADIENT.test("backgroundColor: 'var(--rm-bg, #FFFFFF)'")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T1 — EVERY SITE RESOLVES TO ITS RULED TOKEN
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-15 T1 — every site resolves to its ruled token', () => {
  it('[RED] the fallbacks these screens declare are what the provider mounts', () => {
    const light = deriveThemeTokens(resolveBrandingTheme(null), 'light');
    // ⚠ NOT A PLAUSIBLE ALTERNATIVE — the value the light mount actually
    // produces. A tint is not a fill; that inversion painted the login screen's
    // error message at 1.34:1 for months.
    const pairs = [
      ['--rm-bg', light.bg], ['--rm-surface', light.surface],
      ['--rm-text', light.text], ['--rm-primary', light.primary],
      ['--rm-on-primary', light.onPrimary],
    ];
    for (const [name, value] of pairs) {
      const decl = `var(${name}, ${value})`;
      for (const [label, code] of BOTH) {
        if (!code.includes(name)) continue;
        expect(
          code,
          `${label} names ${name} but not with the mounted fallback ${value}`
        ).toContain(decl);
      }
    }
    // Non-vacuity: at least one of the five is genuinely present in each file.
    for (const [label, code] of BOTH) {
      expect(pairs.some(([n]) => code.includes(n)), `${label} declares no render token`).toBe(true);
    }
  });

  it('[RED] SignupScreen — the page ground is bg and the card is surface', () => {
    expect(SIGNUP_CODE).toContain("backgroundColor: 'var(--rm-bg, #FFFFFF)'");
    expect(SIGNUP_CODE).toContain("backgroundColor: 'var(--rm-surface, #FFFFFF)'");
    // M.2 — `recess` is the 430px COLUMN level and there is no column here.
    expect(SIGNUP_CODE).not.toContain('--rm-recess');
  });

  it('[RED] EmailVerifyScreen — BOTH grounds are bg and BOTH cards are surface', () => {
    // ⚠ TWO FULL RETURNS: the success state and the normal state. A test that
    // only drives the normal one leaves half the screen unmigrated and green.
    const grounds = (VERIFY_CODE.match(/backgroundColor: 'var\(--rm-bg, #FFFFFF\)'/g) || []).length;
    const cards = (VERIFY_CODE.match(/backgroundColor: 'var\(--rm-surface, #FFFFFF\)'/g) || []).length;
    expect(grounds, 'both page grounds must be --rm-bg').toBeGreaterThanOrEqual(2);
    expect(cards, 'both cards must be --rm-surface').toBeGreaterThanOrEqual(2);
    expect(VERIFY_CODE).not.toContain('--rm-recess');
  });

  it('[RED] the submit and verify buttons are the ACTION token, not the neutral', () => {
    // B-1's routing: the button fill is the render token `primary`, which comes
    // from the stored secondaryColor — the contractor's ACTION colour. The old
    // navy gradient was the DARK NEUTRAL, which is `secondary`.
    for (const [label, code] of BOTH) {
      expect(code, `${label} button fill`).toContain("backgroundColor: 'var(--rm-primary, #F26A1B)'");
      expect(code, `${label} button label`).toContain("color: 'var(--rm-on-primary, #000000)'");
      expect(code, `${label} still paints a brand gradient`).not.toMatch(/linear-gradient/);
    }
  });

  it('[RED] shadows and borders come from the side channel, never from R', () => {
    // ⚠ `R.shadowLg` IS A FOURTH ROUTE TO A RETIRED TONE AND NO NEEDLE IN THIS
    // ARC COUNTED IT: its value carries the retired navy as three DECIMAL
    // channels inside an rgba(), so it is neither a hex nor a colour key. The
    // published role holds the same geometry with a neutral black.
    expect(R.shadowLg).toMatch(/rgba\(1,\s*40,\s*84/);
    expect(ELEVATION_LIGHT.shadowLg).not.toMatch(/rgba\(1,\s*40,\s*84/);
    // ⚠ THE SOURCE NAMES THE ROLE, NOT THE PROPERTY — asserting on the property
    // name here would only pass if the declaration were INLINED, which is the
    // thing the side channel exists to prevent. So both halves are checked: the
    // file calls the helper with the right role, AND the helper emits the right
    // property. That also pins the role -> property mapping, which a single
    // source-text check cannot see.
    expect(elevationVar('shadowLg')).toContain(ELEVATION_VARS.shadowLg);
    expect(elevationVar('shadowMd')).toContain(ELEVATION_VARS.shadowMd);
    expect(elevationVar('border')).toContain(ELEVATION_VARS.border);
    for (const [label, code] of BOTH) {
      expect(code, `${label} still reads a shadow off R`).not.toMatch(/\bR\.shadow/);
      expect(code, `${label} card shadow`).toContain("elevationVar('shadowLg')");
      expect(code, `${label} button shadow`).toContain("elevationVar('shadowMd')");
      expect(code, `${label} input border`).toContain("elevationVar('border')");
    }
  });

  it('[RED] the field-error colours are the status ROLES, not bare literals', () => {
    // The error EDGE is the fill role (graphic, 3:1); the error TEXT is the text
    // role (4.5:1). #DC2626 as text measures 4.83:1 and passes by luck; #B91C1C
    // is the value the role actually names, at 6.47:1.
    // Both halves again: the source names the ROLE, the helper emits the property.
    expect(statusVar('danger')).toContain(STATUS_VARS.danger);
    expect(statusVar('dangerText')).toContain(STATUS_VARS.dangerText);
    expect(SIGNUP_CODE).toContain("statusVar('danger')");
    expect(SIGNUP_CODE).toContain("statusVar('dangerText')");
    expect(contrastRatio(STATUS_LIGHT.dangerText, '#FFFFFF')).toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(contrastRatio(STATUS_LIGHT.danger, '#FFFFFF')).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
  });

  it('[RED] the resend confirmation uses successText, not the success FILL', () => {
    // ⚠ A LIVE TEXT DEFECT THIS PHASE CLOSES. "Code resent! Check your inbox."
    // was painted with the success FILL — 3.30:1 on the card, under the 4.5
    // floor. The fill is a 3:1 graphic value and has never been a text tone.
    expect(contrastRatio(STATUS_LIGHT.success, '#FFFFFF')).toBeLessThan(TEXT_FLOOR);
    expect(contrastRatio(STATUS_LIGHT.successText, '#FFFFFF')).toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(statusVar('successText')).toContain(STATUS_VARS.successText);
    expect(VERIFY_CODE).toContain("statusVar('successText')");
    // ⚠ ASSERTING THE FILL ROLE IS ABSENT, ANCHORED ON THE CALL. `'success'` as a
    // bare substring is inside `'successText'` — the substring trap that decided
    // an amendment number was taken when every hit was a hex colour. The closing
    // quote is what separates the two roles.
    expect(VERIFY_CODE).not.toContain("statusVar('success')");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T2 — NO R. COLOUR READ, NO RETIRED TONE, AND BOTH FILES STILL RENDER
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-15 T2 — the retired palette is gone from both screens', () => {
  it('[RED] neither screen reads a colour key off R', () => {
    for (const [label, code] of BOTH) {
      expect(rColourReads(code), `${label} still reads R colour keys`).toEqual([]);
    }
  });

  it('[RED] neither screen reaches a retired tone by hex, decimal or key', () => {
    for (const [label, code] of BOTH) {
      expect(retiredReaches(code), `${label} still reaches a retired tone`).toEqual([]);
    }
  });

  it('[RED] GUARD-PROOF — both retired forms are caught when injected', () => {
    // ⚠ INJECTED INTO THE REAL SOURCE, not into a toy string, so this proves the
    // assertion above is capable of failing against these exact files.
    for (const [label, code] of BOTH) {
      expect(retiredReaches(code + "\nconst X = { color: '#012854' };"),
        `${label}: the HEX needle went blind`).toContain('hex #012854');
      expect(retiredReaches(code + "\nconst X = { boxShadow: '0 1px rgba(1,40,84,0.2)' };"),
        `${label}: the DECIMAL needle went blind`).toContain('decimal #012854');
      // ⚠ COUNT-INDEPENDENT ON PURPOSE. A first draft asserted the exact string
      // `R.bgPage x1` and failed against the UNMIGRATED file for the wrong
      // reason — it already held one, so injecting a second reported x2. A
      // guard-proof that is sensitive to the subject's current contents is
      // testing the subject, not the needle.
      expect(rColourReads(code + '\nconst X = { background: R.bgPage };')
        .some((h) => h.startsWith('R.bgPage ')),
      `${label}: the R-key needle went blind`).toBe(true);
    }
  });

  it('[RED] SignupScreen renders its substantive content — the form', () => {
    // ⚠ A SWEEP PROVES A STRING IS ABSENT AND PROVES NOTHING ABOUT WHETHER THE
    // FILE STILL RUNS. AnnouncementPopup threw a ReferenceError on every render
    // while its literal sweep passed. A BLANK SCREEN PASSES EVERY CONTRAST
    // ASSERTION — this is the render.
    render(<SignupScreen {...SIGNUP_PROPS} />);
    expect(screen.getByPlaceholderText('First')).toBeTruthy();
    expect(screen.getByPlaceholderText('Last')).toBeTruthy();
    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeTruthy();
  });

  it('[RED] EmailVerifyScreen renders BOTH states — the input and the success card', () => {
    installFetch(async () => ({ ok: true, json: async () => ({ verified: true }) }));
    render(<EmailVerifyScreen {...VERIFY_PROPS} />);
    const field = screen.getByPlaceholderText('000000');
    expect(field).toBeTruthy();
    expect(screen.getByText(/Check your email/i)).toBeTruthy();

    // Drive the success state — the second full return, which a test of the idle
    // screen alone would leave entirely unasserted.
    fireEvent.change(field, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verify Email/i }));
    return waitFor(() => expect(screen.getByText(/Email verified/i)).toBeTruthy());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T3 — THE PAGE GROUND, AND THE MEASUREMENT THAT REMOVED THE GRADIENT
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-15 T3 — the page ground', () => {
  it('[RED] neither screen declares a page-ground gradient any more', () => {
    for (const [label, code] of BOTH) {
      expect(PAGE_GRADIENT.test(code), `${label} still declares a background gradient`).toBe(false);
    }
  });

  it('[RED] RECORD — the retired gradient failed the text floor at EVERY stop', () => {
    // ⚠ THIS IS WHY THE GRADIENT WENT, AND IT IS THE MEASUREMENT RATHER THAN A
    // PREFERENCE. The ground ran #012854 -> #D3E3F0 and the footer company name
    // sat on it at rgba(255,255,255,0.4).
    //
    // ⚠ AND THE BINDING STOP IS THE LIGHTEST ONE, NOT THE DARKEST. "Text on a
    // gradient clears the DARKER stop" is the rule for DARK text; this text is
    // WHITE, so it inverts. Both ends are measured here precisely so the next
    // reader does not apply the half of the rule that happens to be quoted.
    const DARK_STOP = '#012854';
    const LIGHT_STOP = '#D3E3F0';
    const FOOTER = 'rgba(255,255,255,0.4)';
    const atDark = contrastRatio(compositeRgba(FOOTER, DARK_STOP), DARK_STOP);
    const atLight = contrastRatio(compositeRgba(FOOTER, LIGHT_STOP), LIGHT_STOP);
    expect(atDark, `footer on the DARKER stop measured ${atDark.toFixed(2)}:1`).toBeLessThan(TEXT_FLOOR);
    expect(atLight, `footer on the LIGHTER stop measured ${atLight.toFixed(2)}:1`).toBeLessThan(TEXT_FLOOR);
    expect(atLight).toBeLessThan(atDark);   // the lighter stop is the worse one
  });

  it('[RED] the footer clears the text floor on the new ground, every brand and mode', () => {
    // The footer is 12px uppercase — normal text, so 4.5 applies and the
    // large-text allowance does not.
    const FOOTER_ALPHA = 0.7;
    eachBrandMode((label, mode, t) => {
      const composited = composite(t.text, t.bg, FOOTER_ALPHA);
      const ratio = contrastRatio(composited, t.bg);
      expect(
        ratio,
        `${label}/${mode}: footer --rm-text @${FOOTER_ALPHA} on --rm-bg ${t.bg} = ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });

  it('[RED] and the sibling alpha it did NOT inherit is recorded with its number', () => {
    // ⚠ A SAFETY MEASURE COPIED FROM A PRIOR PHASE MUST BE RE-DERIVED, NOT
    // INHERITED. LoginScreen and ResetPinScreen print their footer at
    // `opacity: 0.45`. Measured on the worst brand that is 2.51:1 — under the
    // floor. These two screens use 0.7 instead, and the sibling value is FILED
    // rather than copied. This case fails if 0.45 ever becomes adequate, which
    // is when the divergence should be revisited.
    let worst = Infinity;
    eachBrandMode((label, mode, t) => {
      worst = Math.min(worst, contrastRatio(composite(t.text, t.bg, 0.45), t.bg));
    });
    expect(worst, `the siblings' 0.45 footer alpha measures ${worst.toFixed(2)}:1`).toBeLessThan(TEXT_FLOOR);
    for (const [label, code] of BOTH) {
      expect(code, `${label} inherited the sub-floor footer alpha`).not.toContain('opacity: 0.45');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T4 — THE ABSENCE RULE, PRE-AUTH, IN BOTH DIRECTIONS
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-15 T4 — the absence rule holds on a pre-auth surface', () => {
  it('[RED] a contractor with NO logo gets their NAME, never the platform mark', () => {
    // A2. The invite payload names a specific contractor, so a contractor IS
    // resolved even though no session exists and the D4 chain answered neutral.
    const branding = { companyName: 'Beta Exteriors', logoUrl: null };
    const { container, unmount } = render(
      <SignupScreen {...SIGNUP_PROPS} branding={branding} />
    );
    const mark = container.querySelector('[data-rm-brand-name]');
    expect(mark, 'A2 — the resolved contractor got no name mark').toBeTruthy();
    expect(mark.textContent).toBe('Beta Exteriors');
    expect(container.querySelector('img'), 'A2 — a mark was drawn anyway').toBeNull();
    unmount();

    const v = render(<EmailVerifyScreen {...VERIFY_PROPS} branding={branding} />);
    expect(v.container.querySelector('[data-rm-brand-name]').textContent).toBe('Beta Exteriors');
    expect(v.container.querySelector('img')).toBeNull();
  });

  it('[RED] NO contractor resolved gets the RoofMiles mark — the other direction', () => {
    // A1. ⚠ WITHOUT THIS SIBLING THE CASE ABOVE PROVES NOTHING ABOUT WIRING: a
    // component that rendered no mark under any condition would satisfy it.
    const { container } = render(
      <ThemeProvider><SignupScreen {...SIGNUP_PROPS} branding={null} /></ThemeProvider>
    );
    const img = container.querySelector('img');
    expect(img, 'A1 — the platform door drew no mark at all').toBeTruthy();
    expect(container.querySelector('[data-rm-brand-name]')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T5 — BrandMark AND THE DARK PLATE ARE UNDISTURBED
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-15 T5 — B.7\'s mark work survives this migration', () => {
  it('[RED] both screens mount BrandMark with the invite payload as the override', () => {
    // ⚠ THE OVERRIDE IS LOAD-BEARING. These screens do NOT get their contractor
    // from the D4 chain — they take the invite payload as a prop. BrandMark was
    // swept onto the chain once and seven tests caught it.
    for (const [label, code] of BOTH) {
      expect(code, `${label} no longer passes its branding to BrandMark`)
        .toMatch(/<BrandMark\s+branding=\{branding\}/);
    }
  });

  it('[RED] the dark plate still behaves, and the logo branch still draws an img', () => {
    const branding = { companyName: 'Beta Exteriors', logoUrl: 'https://example.invalid/b.png' };
    const { container } = render(<SignupScreen {...SIGNUP_PROPS} branding={branding} />);
    const img = container.querySelector('img');
    expect(img, 'the logo branch drew nothing').toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.invalid/b.png');
    // The plate is BrandLogo's, drawn only in dark mode; light is the default
    // outside a provider, so there must be no plate here. Asserting the LIGHT
    // case keeps this from becoming a claim about a mode nothing exercised.
    expect(container.querySelector('[data-rm-logo-plate]')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T6 — M.5: NO FALLBACK IS A STRING CONTAINING THE TEXT OF A CALL
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-15 T6 — a declaration is a value, never the text of a call', () => {
  it('[RED] neither screen assigns a quoted helper call as a colour', () => {
    // ⚠ THE INCIDENT: `const AMBER = "statusVar('warning')"` — a string holding
    // the TEXT of a call. Phosphor received something that is not a CSS colour
    // and fell back to BLACK, and four independent checks passed because black
    // on white is 21:1. `themeKeyIntegrity` carries the repo-wide fence; this is
    // the local one, anchored on ASSIGNMENT position so a test needle cannot
    // trip it.
    const CALL_AS_STRING = /[=:]\s*(['"])\s*[a-zA-Z]+Var\(/;
    expect(CALL_AS_STRING.test(`color: 'status` + `Var('warning')'`)).toBe(true);
    expect(CALL_AS_STRING.test("color: statusVar('warning')")).toBe(false);
    for (const [label, code] of BOTH) {
      expect(CALL_AS_STRING.test(code), `${label} assigns the TEXT of a call`).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T7 — PALETTE-1'S ACKNOWLEDGED SHORTFALLS ARE NOT WEAKENED
// ═══════════════════════════════════════════════════════════════════════════
describe('Palette-15 T7 — Palette-1\'s shortfalls are recorded, not quietly fixed', () => {
  it('[RED] no hairline border clears 3:1, and the one used here is still visible', () => {
    const onWhite = compositeRgba(ELEVATION_LIGHT.border, '#FFFFFF');
    const ratio = contrastRatio(onWhite, '#FFFFFF');
    expect(ratio, 'the hairline now clears 3:1 — update Palette-1\'s ruling').toBeLessThan(GRAPHIC_FLOOR);
    expect(ratio, 'the hairline is invisible, which is a different defect').toBeGreaterThan(1.0);
  });

  it('[RED] the icon alpha these screens chose clears the GRAPHIC floor everywhere', () => {
    // ⚠ RE-DERIVED, NOT INHERITED. The siblings' unfocused input icons sit at
    // `opacity: 0.5`, which composites to 2.85:1 on the worst brand — under the
    // 3:1 non-text floor. These screens use 0.6. The margin is deliberate: a
    // floor met by hundredths is a floor the next token change silently breaks.
    const CHOSEN = 0.6;
    eachBrandMode((label, mode, t) => {
      const ratio = contrastRatio(composite(t.text, t.surface, CHOSEN), t.surface);
      expect(
        ratio,
        `${label}/${mode}: icon --rm-text @${CHOSEN} on --rm-surface ${t.surface} = ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });

  it('[RED] and every muted TEXT alpha these screens use clears the TEXT floor', () => {
    // Every alpha applied to --rm-text on a text node in either file. Listed
    // explicitly so adding a new one without measuring it fails here.
    const TEXT_ALPHAS = [0.7, 0.72, 0.75];
    eachBrandMode((label, mode, t) => {
      for (const alpha of TEXT_ALPHAS) {
        const ratio = contrastRatio(composite(t.text, t.surface, alpha), t.surface);
        expect(
          ratio,
          `${label}/${mode}: --rm-text @${alpha} on --rm-surface ${t.surface} = ${ratio.toFixed(2)}:1`
        ).toBeGreaterThanOrEqual(TEXT_FLOOR);
      }
    });
    // Non-vacuity: the alphas asserted are the alphas the files actually use.
    for (const [label, code] of BOTH) {
      expect(
        TEXT_ALPHAS.some((a) => code.includes(`opacity: ${a}`)),
        `${label} uses none of the measured text alphas`
      ).toBe(true);
    }
  });
});
