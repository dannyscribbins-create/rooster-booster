// ─────────────────────────────────────────────────────────────────────────────
// CANVASS-2 — THE REP SHELL'S GROUND, ITS FADED TEXT, AND ITS BROKEN LOGO
//
// Fences amendment A34 (DECISION_C_DL_BUILD_SPEC.md §23):
//   A34.1 (D1)   the rep column paints `--rm-recess`; header and nav keep
//                `--rm-surface`.
//   A34.2 (D2)   the faded-text sites take `MUTED`; the inactive nav DOT answers
//                the 3:1 graphic floor on its own ground and is NOT `MUTED`.
//   A34.11 (D11) a SET-BUT-UNREACHABLE logo falls back like the absent case.
//
// ── ⚠ WHAT jsdom CAN AND CANNOT DECIDE, STATED UP FRONT RATHER THAN DISCOVERED ─
// jsdom does no layout and **never resolves `var()`**, so it cannot report a
// composited colour and no assertion here reads one. The split is:
//
//   DECLARATION-LEVEL (source text)   which token a site declares, and which
//                                     opacity constant it uses.
//   ARITHMETIC (the repo's own        whether that token, at that opacity, on
//   deriveThemeTokens/contrastRatio)  that ground, clears its floor.
//   RENDERED (a real browser only)    that the element actually SITS on that
//                                     ground. Canvass-2's rendered pass does
//                                     that; this file cannot and does not claim
//                                     to. → `A token floored against one ground
//                                     is not safe on another.`
//
// ── ⚠ THE OPACITIES ARE READ OUT OF THE SOURCE, NEVER TYPED HERE ────────────
// If this file hardcoded `0.72`, it would keep passing against a shell that had
// reverted to `0.65` — it would be testing its own literal. The constants are
// EXTRACTED from the two component files and the arithmetic runs on whatever is
// actually there, so a revert fails this suite rather than sliding past it.
// `T0` asserts the extractors found something, because an extractor that returns
// nothing would otherwise make every arithmetic case vacuous.
//
// ── ⚠ AND THE POSITIVE CONTROL IS THE PROOF THE FLOOR CAN FAIL ──────────────
// T6 pins that the PRE-FIX values are BELOW their floors under this exact
// arithmetic. Without it, "every pair clears its floor" is satisfiable by a
// contrast function that returns 21 for everything, and this repo has recorded
// a checker passing five black-on-white icons for a correct reason.
//
// ⚠ THE `composite()` HELPER IS THIS REPO'S ELEVENTH COPY and is deliberately a
// copy rather than an extraction — ten palette suites already carry it, and
// extracting it is a change to ten files that does not belong in a contrast fix.
// Filed on PRE_LAUNCH_CHECKLIST.md rather than done quietly here.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { deriveThemeTokens, contrastRatio } from '../../utils/themeTokens.mjs';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
// ⚠ STATUS TOKENS ARE NOT RENDER TOKENS, AND THIS IMPORT IS THE RECORD OF
// GETTING THAT WRONG. The first draft read `t.dangerText` off the object
// `deriveThemeTokens()` returns. That object has ELEVEN keys and `dangerText` is
// not one of them — `--rm-danger-text` comes from `statusTheme.js`, on the side
// channel, precisely because the render-token validator would reject it. The
// read yielded `undefined` and the case failed LOUDLY, which is the lucky
// direction; the same mistake against a defaulting source is this repo's
// recorded silent shape.
import { STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';
import ThemeProvider from '../shared/ThemeProvider';
import RepShell from './RepShell';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const readHere = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');

const SHELL_SRC = readHere('RepShell.jsx');
const NAV_SRC = readHere('RepBottomNav.jsx');

const TEXT_FLOOR = 4.5;
const GRAPHIC_FLOOR = 3;

// ⚠ THE SEEDED BRANDS, NOT INVENTED ONES. Alpha and Beta are the palettes
// `scripts/seedLocalStack.js` actually writes, so an arithmetic result here and
// a rendered reading in the browser pass are about the same two contractors.
// Gamma is the UNSET contractor — the one whose palette EQUALS the platform
// default, where a correct wiring and a broken one look identical, which is why
// it is present rather than assumed covered by the other two.
const BRANDS = [
  ['Gamma (UNSET)', null],
  ['palette-alpha', { primary_color: '#1C2D4D', secondary_color: '#F26A1B' }],
  ['palette-beta', { primary_color: '#0B3D3B', secondary_color: '#C2185B' }],
];
const MODES = ['light', 'dark'];

function eachBrandMode(fn) {
  for (const [label, src] of BRANDS) {
    for (const mode of MODES) fn(label, mode, deriveThemeTokens(resolveBrandingTheme(src), mode));
  }
}

const pxOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function composite(hex, ground, alpha) {
  const f = pxOf(hex), b = pxOf(ground);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}

/**
 * Pulls a named `const X = <number>;` out of a component's source.
 *
 * Returns null rather than throwing so T0 can assert the absence loudly with a
 * message naming the file — an extractor that silently yielded `undefined`
 * would make every arithmetic case below pass on `NaN >= 4.5` being false…
 * which is why T0 exists and runs first.
 */
function numericConst(src, name) {
  const m = new RegExp(String.raw`const\s+${name}\s*=\s*([0-9]*\.?[0-9]+)\s*;`).exec(src);
  return m ? parseFloat(m[1]) : null;
}

const MUTED_SHELL = numericConst(SHELL_SRC, 'MUTED');
const MUTED_NAV = numericConst(NAV_SRC, 'MUTED');
const DOT_INACTIVE = numericConst(NAV_SRC, 'DOT_INACTIVE');

afterEach(() => cleanup());

describe('Canvass-2 T0 — the extractors found real values (non-vacuity)', () => {
  // ⚠ WITHOUT THIS EVERY ARITHMETIC CASE BELOW IS UNFALSIFIABLE IN THE WRONG
  // DIRECTION. `contrastRatio(composite(x, y, NaN), y)` is NaN, and `NaN >= 4.5`
  // is false — so a failed extraction would fail loudly rather than pass. That is
  // the lucky direction, and it is still not a result anybody could READ: the
  // failure would name a contrast floor while the real cause is a renamed
  // constant. This case makes the true cause the thing that fails.
  it('[RED] both MUTED constants and the dot constant are present and numeric', () => {
    expect(MUTED_SHELL, 'RepShell.jsx declares no `const MUTED = <n>;`').not.toBeNull();
    expect(MUTED_NAV, 'RepBottomNav.jsx declares no `const MUTED = <n>;`').not.toBeNull();
    expect(DOT_INACTIVE, 'RepBottomNav.jsx declares no `const DOT_INACTIVE = <n>;`').not.toBeNull();
    for (const v of [MUTED_SHELL, MUTED_NAV, DOT_INACTIVE]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('[RED] the two MUTED constants are the SAME value — one number, not two', () => {
    // A34.2: "reuse the value and the convention — never introduce a second
    // number." Two files each declaring MUTED is this codebase's convention
    // (seven referrer files do it); two files declaring DIFFERENT numbers is the
    // drift that convention is one edit away from.
    //
    // ⚠ THE FINITENESS CHECK IS NOT REDUNDANT WITH THE CASE ABOVE — IT IS WHAT
    // STOPS THIS ONE PASSING VACUOUSLY. Both extractors return `null` when the
    // constant is absent or renamed, and `null === null` is true, so without
    // this line the case goes GREEN on a shell that declares no MUTED at all.
    // Observed: it passed in the RED run, beside a failing T0.1. A case that is
    // green while its own precondition is red is the shape this repo names.
    expect(Number.isFinite(MUTED_SHELL)).toBe(true);
    expect(MUTED_NAV).toBe(MUTED_SHELL);
  });

  it('[RED] the inactive DOT is NOT the MUTED constant', () => {
    // ⚠ THE WHOLE POINT OF A34.2's SECOND HALF. The dot answers a 3:1 GRAPHIC
    // floor and the faded text answers a 4.5 TEXT floor; one value cannot serve
    // both, and writing MUTED onto the dot is the "safety measure copied from a
    // prior phase" failure with the two floors one line apart.
    expect(DOT_INACTIVE).not.toBe(MUTED_SHELL);
  });
});

describe('Canvass-2 T1 — the column ground is --rm-recess (A34.1) [DECLARATION-LEVEL]', () => {
  it('[RED] RepShell\'s root declares --rm-recess and reads --rm-bg nowhere', () => {
    expect(SHELL_SRC).toContain("backgroundColor: 'var(--rm-recess,");
    // ⚠ ASSERTED ON THE WHOLE FILE, NOT THE ROOT. A34.1 makes `--rm-bg` a
    // non-ground for this tree; a second site reading it would reintroduce the
    // divergence Screen.jsx's header forbids, from somewhere nobody is looking.
    expect(SHELL_SRC).not.toContain('--rm-bg');
    expect(NAV_SRC).not.toContain('--rm-bg');
  });

  it('[RED] the header and the nav still declare --rm-surface', () => {
    // A34.1 moves the COLUMN only. If a sweep-minded edit moved the chrome too,
    // the bars would vanish into the page and the edge D1 exists to create would
    // be gone — with every contrast assertion below still green, because they
    // would then be measuring text on recess either way.
    expect(SHELL_SRC).toContain("background: 'var(--rm-surface,");
    expect(NAV_SRC).toContain("background: 'var(--rm-surface,");
  });

  it('the needles are not vacuous — the files do read other --rm-* tokens', () => {
    // Guard-proof for the `.not.toContain('--rm-bg')` above: a needle that can
    // never match makes a negative assertion permanently satisfied, and an
    // empty/renamed file would satisfy it perfectly.
    expect(SHELL_SRC).toContain('var(--rm-text,');
    expect(NAV_SRC).toContain('var(--rm-primary,');
  });
});

describe('Canvass-2 T2 — every text pair in the shell clears 4.5 [ARITHMETIC]', () => {
  // ⚠ GROUNDS ARE ASSIGNED FROM A34.1, NOT GUESSED. After A34.1 the 430px column
  // and the full-width wrapper are both `recess`; the header bar and the fixed
  // nav are both `surface`. Nothing in the rep tree puts text on `bg`.
  const SITES = [
    ['ScreenTitle h1', 'recess', () => 1],
    ['ScreenTitle subtitle', 'recess', () => MUTED_SHELL],
    ['placeholder body', 'recess', () => 0.75],
    ['nav label — active', 'surface', () => 1],
    ['nav label — inactive', 'surface', () => MUTED_NAV],
  ];

  for (const [site, ground, alphaOf] of SITES) {
    it(`[RED] ${site} on --rm-${ground}`, () => {
      eachBrandMode((label, mode, t) => {
        const ratio = contrastRatio(composite(t.text, t[ground], alphaOf()), t[ground]);
        expect(
          ratio,
          `${site} on ${ground}, ${label} ${mode}: ${ratio.toFixed(2)} is below ${TEXT_FLOOR}`
        ).toBeGreaterThanOrEqual(TEXT_FLOOR);
      });
    });
  }

  it('[RED] Sign out (--rm-danger-text) on --rm-recess', () => {
    // Its own token, not --rm-text, so it cannot ride on the rows above — and it
    // moved ground with A34.1 exactly as they did.
    eachBrandMode((label, mode, t) => {
      const dangerText = (mode === 'dark' ? STATUS_DARK : STATUS_LIGHT).dangerText;
      // Guard-proof: a renamed status key would make `dangerText` undefined and
      // contrastRatio would throw or return NaN — either of which reads as a
      // contrast failure while the real cause is a missing key.
      expect(dangerText, 'statusTheme exports no `dangerText` for this mode').toBeTruthy();
      const ratio = contrastRatio(dangerText, t.recess);
      expect(
        ratio,
        `Sign out on recess, ${label} ${mode}: ${ratio.toFixed(2)} is below ${TEXT_FLOOR}`
      ).toBeGreaterThanOrEqual(TEXT_FLOOR);
    });
  });
});

describe('Canvass-2 T3 — the nav dots clear 3.0 [ARITHMETIC]', () => {
  it('[RED] the INACTIVE dot (--rm-text, faded) on --rm-surface', () => {
    eachBrandMode((label, mode, t) => {
      const ratio = contrastRatio(composite(t.text, t.surface, DOT_INACTIVE), t.surface);
      expect(
        ratio,
        `inactive dot, ${label} ${mode}: ${ratio.toFixed(2)} is below ${GRAPHIC_FLOOR}`
      ).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });

  it('the ACTIVE dot (--rm-primary) on --rm-surface still clears 3.0', () => {
    // Unchanged by Canvass-2 and re-measured rather than assumed: `--rm-primary`
    // is floored to 3:1 against `surface` ONLY, and `surface` is the ground it is
    // used on here, so this pair is `floored` rather than `unproven`.
    eachBrandMode((label, mode, t) => {
      const ratio = contrastRatio(t.primary, t.surface);
      expect(
        ratio,
        `active dot, ${label} ${mode}: ${ratio.toFixed(2)} is below ${GRAPHIC_FLOOR}`
      ).toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
    });
  });
});

describe('Canvass-2 T4 — the POSITIVE CONTROL: the pre-fix values FAIL', () => {
  // ⚠ WITHOUT THESE, T2 AND T3 ARE "every pair clears its floor" WITH NO
  // EVIDENCE THE FLOOR CAN EVER BE BELOW. They pin the measured defect Canvass-1
  // found, under this file's own arithmetic, so a contrast helper that returned
  // a large number for everything would fail HERE instead of passing silently.
  const beta = deriveThemeTokens(resolveBrandingTheme(BRANDS[2][1]), 'light');

  it('[RED] 0.65 on --rm-recess is BELOW 4.5 on palette-beta light — the defect A34.2 fixes', () => {
    const ratio = contrastRatio(composite(beta.text, beta.recess, 0.65), beta.recess);
    expect(ratio).toBeLessThan(TEXT_FLOOR);
  });

  it('[RED] 0.40 on --rm-surface is BELOW 3.0 on palette-beta light — the dot defect', () => {
    const ratio = contrastRatio(composite(beta.text, beta.surface, 0.40), beta.surface);
    expect(ratio).toBeLessThan(GRAPHIC_FLOOR);
  });

  it('[RED] and the shipped constants clear the same pairs the old ones failed', () => {
    // The pairing is what makes the two cases above a CONTROL rather than two
    // assertions about history: same brand, same mode, same ground, same
    // arithmetic — only the constant differs.
    expect(contrastRatio(composite(beta.text, beta.recess, MUTED_SHELL), beta.recess))
      .toBeGreaterThanOrEqual(TEXT_FLOOR);
    expect(contrastRatio(composite(beta.text, beta.surface, DOT_INACTIVE), beta.surface))
      .toBeGreaterThanOrEqual(GRAPHIC_FLOOR);
  });
});

describe('Canvass-2 T5 — a SET-BUT-UNREACHABLE logo falls back (A34.11)', () => {
  const CONTRACTOR = {
    branding: { companyName: 'Beta Exteriors', logoUrl: 'https://example.invalid/beta-logo.png' },
    source: 'slug',
  };

  beforeEach(() => {
    global.fetch = () => Promise.reject(new Error('no network in this suite'));
  });

  const mount = (supplied) => render(
    <ThemeProvider mode="light" supplied={supplied} context={{ hostname: 'app.roofmiles.com', search: '', storage: null }}>
      <RepShell onLogout={() => {}} />
    </ThemeProvider>
  );

  it('[RED] before the error the logo IS an <img> — the precondition, asserted', () => {
    // ⚠ THE PAIRED POSITIVE. Without it, "after the error there is no <img>"
    // passes identically against a shell that never rendered one — which is this
    // repo's recorded shape for a fixture that establishes nothing.
    mount(CONTRACTOR);
    const img = document.querySelector('header img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe(CONTRACTOR.branding.logoUrl);
    expect(screen.queryByText('Beta Exteriors')).toBeNull();
  });

  it('[RED] after the image fails to load, the NAME renders and no <img> remains', () => {
    mount(CONTRACTOR);
    fireEvent.error(document.querySelector('header img'));
    expect(document.querySelector('header img')).toBeNull();
    // A2's branch: the contractor's own name, never the platform mark.
    expect(screen.getByText('Beta Exteriors')).toBeTruthy();
  });

  it('[RED] the failure does NOT fall back to the platform mark', () => {
    // The white-label breach BrandMark exists to prevent, arriving through the
    // new branch rather than the old one. A34.11 says "like the absent case",
    // and the absent case for a RESOLVED contractor is A2, not A1.
    mount(CONTRACTOR);
    fireEvent.error(document.querySelector('header img'));
    expect(document.querySelector('header img')).toBeNull();
    expect(screen.queryByText(/RoofMiles/i)).toBeNull();
  });

  it('[RED] a NEW logo url after a failure is tried again, not suppressed', () => {
    // ⚠ A STICKY BOOLEAN WOULD PASS EVERY CASE ABOVE AND BREAK THIS ONE. If the
    // failure is remembered as "the logo is broken" rather than "THIS url is
    // broken", a contractor who fixes their image host stays on the text
    // fallback until the tab is reloaded, and nothing anywhere reports it.
    const { rerender } = mount(CONTRACTOR);
    fireEvent.error(document.querySelector('header img'));
    expect(document.querySelector('header img')).toBeNull();

    rerender(
      <ThemeProvider mode="light" context={{ hostname: 'app.roofmiles.com', search: '', storage: null }}
        supplied={{ ...CONTRACTOR, branding: { ...CONTRACTOR.branding, logoUrl: 'https://example.invalid/beta-logo-v2.png' } }}>
        <RepShell onLogout={() => {}} />
      </ThemeProvider>
    );

    const img = document.querySelector('header img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://example.invalid/beta-logo-v2.png');
  });
});
