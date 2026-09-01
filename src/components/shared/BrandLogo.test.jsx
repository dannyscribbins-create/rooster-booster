// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c PHASE 1a — RED SUITE — <BrandLogo> AND THE DARK-MODE PLATE (Ruling 3)
//
// THE DEFECT. Four surfaces render a contractor's logo as a bare <img> on
// var(--rm-surface): LoginScreen, ResetPinScreen, FrozenAccountScreen and
// RepShell (RepPlaceholder until C/DL-3c Phase 3-A replaced it). In light mode
// that surface is #FFFFFF and any ordinary logo
// reads. In dark mode it derives to a near-black (#121B31 for the platform
// palette, #112032 for a navy brand) and a dark-inked logo disappears into it.
//
// ⚠ WHY A PLATE AND NOT A FILTER, A SWAP, OR A SECOND UPLOAD. We cannot know how
// bright a contractor's artwork is — it is a remote image, so a canvas read is
// blocked by CORS, and there is no second (dark-mode) upload field to fall back
// on. What we DO know is that LIGHT MODE IS THE ONLY MODE THAT HAS EVER SHIPPED,
// so every logo currently in the system is already known-good on a light
// surface: a contractor who had uploaded white artwork would have an invisible
// logo TODAY, in the only mode anyone can reach. A plate that reproduces the
// light surface is therefore correct for every logo that can currently exist.
//
// ⚠ AND THAT ARGUMENT HAS AN EXPIRY CONDITION, WHICH IS ASSERTED BELOW RATHER
// THAN ONLY EXPLAINED. It holds while there is ONE logo slot. Add a dark-artwork
// upload field and the premise is gone — white artwork becomes reachable, and
// the plate makes it invisible in exactly the mode it was uploaded for. The
// component states the condition; this suite pins that the statement is present,
// because a safety argument whose precondition is only in a report gets
// inherited after the precondition lapses.
//
// ⚠ WHAT jsdom CAN AND CANNOT PROVE HERE. It never resolves var(), so no test
// can prove the SURFACE colour the plate sits on. But the plate's own background
// is a LITERAL (LIGHT_SURFACE_HEX), and jsdom normalises a literal inline colour
// to rgb(...) — the same distinction FrozenAccountScreen.test.jsx draws. So
// "the plate is painted the light surface colour" is a real assertion; "the
// logo is legible against what is behind it" is not, and is Phase 1c's.
//
// EXPECTED RED TODAY: src/components/shared/BrandLogo.jsx does not exist, so the
// import fails and every test in this file reports it.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import BrandLogo from './BrandLogo';
import ThemeProvider from './ThemeProvider';
import { LIGHT_SURFACE_HEX } from '../../utils/themeTokens.mjs';

const SRC = 'https://cdn.example.com/acme-roofing.png';
const ALT = 'Acme Roofing';

// jsdom reports a literal inline colour as rgb(...). LIGHT_SURFACE_HEX is read
// from the module rather than retyped, so the expectation cannot drift from the
// value the component actually uses.
function rgbOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// Renders inside a real provider with the mode PINNED, so the mode under test is
// the one the provider publishes rather than one the component was handed.
function mountAt(mode, props = {}) {
  return render(
    <ThemeProvider mode={mode} context={{ hostname: 'app.roofmiles.com', search: '', storage: null }}>
      <BrandLogo src={SRC} alt={ALT} {...props} />
    </ThemeProvider>
  );
}

const plate = () => document.querySelector('[data-rm-logo-plate]');

describe('BrandLogo — the dark-mode plate (C/DL-3c Phase 1a, Ruling 3)', () => {

  it('[RED] renders the image with its src and alt in both modes', () => {
    for (const mode of ['light', 'dark']) {
      const { unmount } = mountAt(mode);
      const img = screen.getByAltText(ALT);
      expect(img.getAttribute('src'), `${mode}: src`).toBe(SRC);
      unmount();
    }
  });

  it('[RED] dark mode puts the logo on a plate painted the LIGHT surface', () => {
    mountAt('dark');

    const el = plate();
    expect(el, 'no plate element in dark mode — a dark-inked logo is invisible here').toBeTruthy();
    expect(el.style.background || el.style.backgroundColor).toBe(rgbOf(LIGHT_SURFACE_HEX));

    // The image must be INSIDE the plate, not beside it. A plate rendered as a
    // sibling would satisfy every assertion above and paint nothing behind the
    // logo — which is the whole job.
    expect(el.contains(screen.getByAltText(ALT))).toBe(true);
  });

  it('[RED] light mode renders NO plate — the flag-off sibling on the same mount', () => {
    // NON-VACUITY, AND THE REASON IT IS A SEPARATE TEST. Every assertion in the
    // dark case is satisfied by a component that plates unconditionally. This is
    // the paired flag-off case CLAUDE.md's vacuity shape 10 requires: same
    // component, same props, only the mode differs, and it must come out the
    // other way. Without it, "the plate is present in dark mode" is evidence of
    // nothing about the mode.
    mountAt('light');

    expect(screen.getByAltText(ALT)).toBeTruthy();
    expect(plate(), 'a plate was rendered in LIGHT mode — the treatment is unconditional').toBeNull();
  });

  it('[RED] with no provider at all it renders unplated', () => {
    // THE FALLBACK IS THE VALUE THAT IS CORRECT WHERE THE COMPONENT ACTUALLY
    // RENDERS WITH NOTHING MOUNTED — statusTheme.js's rule, applied here. A
    // component outside the provider is on a light surface, so no plate.
    // ThemeContext carries a default, so this cannot throw; that default is what
    // makes the case reachable and therefore worth pinning.
    render(<BrandLogo src={SRC} alt={ALT} />);

    expect(screen.getByAltText(ALT)).toBeTruthy();
    expect(plate()).toBeNull();
  });

  it('[RED] states its own expiry condition in the source', () => {
    // ⚠ THIS ASSERTS ON A SENTENCE, DELIBERATELY, AND THE FILE IT READS IS THE
    // ONE UNDER TEST. The plate is only safe while there is a single logo slot.
    // That precondition cannot be expressed as behaviour — there is nothing to
    // execute — so the guard is that the claim is written where the next reader
    // stands. CLAUDE.md: "where a claim matters, the guard reads the source TEXT
    // and asserts on the sentence."
    //
    // Paired with the render tests above rather than standing alone, because a
    // source sweep proves a string is present and proves nothing about whether
    // the component still runs (vacuity shape 6).
    // process.cwd() rather than import.meta.url — Vitest transforms this file,
    // so import.meta.url is not a file: URL here. Same resolution the existing
    // source-reading suites use (unifiedLogin.test.jsx, contractorBranding.test.jsx).
    const path = resolve(process.cwd(), 'src/components/shared/BrandLogo.jsx');
    const src = readFileSync(path, 'utf8');

    expect(src).toMatch(/one logo slot|single logo slot/i);
    expect(src).toMatch(/dark[- ]artwork|second upload|dark-mode upload/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE FOUR CALL SITES — adoption proven by RENDERING, not by grepping
//
// ⚠ A SOURCE SWEEP FOR "<BrandLogo" WOULD PASS AGAINST A SCREEN THAT NO LONGER
// RENDERS AT ALL. That is CLAUDE.md's vacuity shape 6, recorded after
// AnnouncementPopup threw a ReferenceError on every render while its literal
// sweep stayed green. So each site is MOUNTED, and the assertion reads what the
// screen actually produced.
//
// WHY THESE FOUR AND NOT SIX. SignupScreen and EmailVerifyScreen also render a
// logo, and they are deliberately excluded: both paint entirely from R tokens
// (R.bgCard inside an R.navy gradient) and never touch --rm-*, so they have no
// dark mode to collide in. Plating them would be a change with no defect behind
// it. Recorded here because "six logo sites" is the obvious count and four is
// the right one.
// ─────────────────────────────────────────────────────────────────────────────
describe('BrandLogo — the four sites that render on var(--rm-surface)', () => {
  const CASES = [
    ['LoginScreen',         () => import('../auth/LoginScreen'),   { onAuthenticated: () => {} }],
    ['ResetPinScreen',      () => import('../auth/ResetPinScreen'), { token: 'tok' }],
    ['FrozenAccountScreen', () => import('../auth/FrozenAccountScreen'),
      { branding: { companyName: 'Frozen Co', logoUrl: 'https://cdn.example.com/frozen.png' }, onBack: () => {} }],
    // ⚠ RE-POINTED IN C/DL-3c PHASE 3-A, NOT DROPPED. RepPlaceholder was deleted
    // and RepShell took its place as the rep surface's logo site — the mark moved
    // from the centre of a card into the shell's header bar, and it is still a
    // BrandLogo on var(--rm-surface), which is the whole subject of this table.
    // ⚠ RepShell IS MOUNTED BARE HERE, WHICH IS WHY IT MUST NOT CALL
    // useRepCapabilities(). That hook throws outside its provider by design;
    // RepSurface calls it one level up so this table can keep mounting the shell
    // with a ThemeProvider and nothing else. Both files say so at their own site.
    ['RepShell',            () => import('../rep/RepShell'), { onLogout: () => {} }],
  ];

  beforeEach(() => {
    // The true external boundary. No screen here should need the network to
    // paint its logo; if one starts to, this fails loudly rather than hanging.
    global.fetch = () => Promise.reject(new Error('no network in this suite'));
  });

  it.each(CASES)('%s renders, and plates its logo in dark mode', async (name, load, props) => {
    const { default: Screen } = await load();

    const { unmount } = render(
      <ThemeProvider mode="dark" context={{ hostname: 'app.roofmiles.com', search: '', storage: null }}>
        <Screen {...props} />
      </ThemeProvider>
    );

    // RENDERED AT ALL — the half a sweep cannot see.
    const el = plate();
    expect(el, `${name}: no plated logo — either it does not use BrandLogo, or it did not render`).toBeTruthy();
    expect(el.style.background || el.style.backgroundColor).toBe(rgbOf(LIGHT_SURFACE_HEX));
    expect(el.querySelector('img'), `${name}: plate is empty`).toBeTruthy();
    unmount();
  });

  it.each(CASES)('%s renders its logo UNplated in light mode', async (name, load, props) => {
    // THE PAIRED FLAG-OFF SIBLING, per site rather than only on the unit. Without
    // it, "plated in dark" is satisfied by a component that plates always — and
    // the four sites are exactly where that would ship.
    const { default: Screen } = await load();

    const { unmount } = render(
      <ThemeProvider mode="light" context={{ hostname: 'app.roofmiles.com', search: '', storage: null }}>
        <Screen {...props} />
      </ThemeProvider>
    );

    expect(document.querySelector('img'), `${name}: rendered no image at all`).toBeTruthy();
    expect(plate(), `${name}: plated in LIGHT mode`).toBeNull();
    unmount();
  });
});
