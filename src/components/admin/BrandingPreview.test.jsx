// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3c RED SUITE — BrandingPreview CONSUMES THE src/ MIRROR
//
// THE BUG. BrandingPreview.jsx:13-15 carries its own fallbacks:
//
//     const primary   = HEX_RE.test(formData.primary_color)   ? … : '#012854';
//     const secondary = HEX_RE.test(formData.secondary_color) ? … : '#CC0000';
//     const accent    = HEX_RE.test(formData.accent_color)    ? … : '#D3E3F0';
//
// Those three values are ACCENT ROOFING'S navy, red and light blue — the
// platform's original single-tenant palette, hardcoded before RoofMiles had a
// default of its own. The server falls back to RoofMiles' #F26A1B / #1C2D4D /
// #FFFFFF. So a contractor who has saved no colours sees ONE BRAND in the admin
// preview and A DIFFERENT ONE on their live surface, and NEITHER IS THEIRS.
// Nothing fails; the preview is simply lying about what the page will look like.
//
// ⚠ WHEN THESE TESTS GO GREEN, THE UNBRANDED PREVIEW TURNS ORANGE. That is THE
// CORRECTION, NOT A REGRESSION. #F26A1B is the RoofMiles platform default an
// unbranded contractor's live page already renders today; the preview finally
// agrees with it. Anyone who sees the orange, assumes a bug and "restores" the
// navy has reintroduced the white-label breach these tests exist to close.
//
// THE FIX Phase 3c makes: resolve through src/utils/brandingTheme.js — the
// mirrored copy of the server's resolver, already shipped in Phase 3b and already
// drift-guarded against the server copy by server/test/brandingTheme.test.js —
// and DELETE the three constants above.
//
// ── HOW THIS REPO TESTS COMPONENTS, reported rather than assumed ──────────────
// There is one existing component test, src/App.test.jsx: a smoke test using
// @testing-library/react + jsdom. That is the whole convention.
//
// It runs under Vitest, via `npm run test:react` — which `npm test` chains after
// the server suite, so these tests DO gate a push. The concern originally flagged
// here (component tests green only when someone remembered to run them) was closed
// when the two suites were chained; the Vite migration kept that chaining and moved
// the runner from Jest to Vitest.
//
// WHY NOT TEST THE RESOLVER INSTEAD AND CALL IT COVERED: brandingTheme.test.js
// already proves the mirror resolves correctly, exhaustively. What is unproven is
// that THE COMPONENT CONSULTS IT. That is only observable by rendering the
// component and reading the colours it actually painted.
//
// ── HOW COLOURS ARE OBSERVED ─────────────────────────────────────────────────
// jsdom normalises parseable colour declarations to `rgb(r, g, b)`, so every
// assertion below compares against rgbOf(hex) rather than the hex itself. Three
// plain (non-gradient) usages carry one resolved token each and are read
// directly — verified by probe against the real component before this file was
// written:
//
//   dashboard avatar backgroundColor -> accent
//   dashboard avatar color           -> primary
//   dashboard lone '$' span color    -> secondary
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent } from '@testing-library/react';
import BrandingPreview from './BrandingPreview';
import { BRANDING_THEME_DEFAULTS } from '../../utils/brandingTheme.mjs';

// The RoofMiles fallback tokens. Written as HAND-CHECKED LITERALS, deliberately
// not imported, so these expectations cannot be satisfied by the module under
// test agreeing with itself. The one assertion that DOES read
// BRANDING_THEME_DEFAULTS is the drift guard at the bottom, where reading it is
// the entire point.
// ⚠ SWAPPED WITH THE PLATFORM DEFAULTS IN B-1 (2026-09-01), AND NOTHING ABOUT
// THE PREVIEW ITSELF WAS TOUCHED. These name the primary_color / secondary_color
// COLUMN defaults, which the route swap moved: primary_color is the navy dark
// neutral, secondary_color the orange action colour. The component still paints
// `theme.primaryColor` raw, so its output followed the constants.
// ⚠ AND THAT IS THE PROBLEM B-3 OWNS, RESTATED HERE BECAUSE THIS FILE IS WHERE
// SOMEONE WILL MEET IT. BrandingPreview never calls deriveThemeTokens — it paints
// the stored hexes directly — so it does not show what the engine actually
// renders, and after this swap its login gradient starts from the DARK NEUTRAL
// where the real screen's button is the action colour. Updating these two
// constants keeps the suite honest about what the component does; it does not
// make the component correct. Do not "fix" the mapping here — the engine and the
// preview are kept separable on purpose, so a wrong engine and a wrong preview
// cannot cancel out and look right.
const ROOFMILES_PRIMARY   = '#1C2D4D';
const ROOFMILES_SECONDARY = '#F26A1B';

// The three values the component hardcodes today. Named exhaustively rather than
// checking one representative, because a partial fix — dropping the navy but
// keeping the light blue — is still Accent's brand on someone else's preview.
const ACCENT_LITERALS = ['#012854', '#CC0000', '#D3E3F0'];

function rgbOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// Renders the preview, switches to the Dashboard screen, and returns the three
// resolved colour tokens as jsdom reports them.
//
// The Dashboard screen is used because it paints all three tokens as PLAIN colour
// declarations. The Login screen paints primary and accent only inside a
// `linear-gradient(...)`, and jsdom's CSS parser drops declarations it cannot
// parse — so a login-screen assertion would read an empty string whatever the
// component resolved.
function resolveTokens(formData) {
  const { container, unmount } = render(<BrandingPreview formData={formData} />);
  fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));

  // PRECONDITION, and it guards every caller. If the Dashboard screen did not
  // render, every token below reads undefined — which would satisfy each of the
  // absence assertions in this file while proving absolutely nothing.
  const avatar = screen.getByText('JD');
  const dollar = Array.from(container.querySelectorAll('span')).find(s => s.textContent === '$');
  if (!dollar) throw new Error('the preview did not render its balance card — nothing below is meaningful');

  const styleBlob = Array.from(container.querySelectorAll('*'))
    .map(el => el.getAttribute('style') || '')
    .join(' | ');

  return {
    primary:   avatar.style.color,
    secondary: dollar.style.color,
    accent:    avatar.style.backgroundColor,
    styleBlob,
    unmount,
  };
}

// Asserts every token came out as a real, non-empty colour. Every absence
// assertion in this file is preceded by this: an empty or undefined token
// contains none of Accent's literals either, so without it "Accent's navy is
// absent" is satisfied by a preview that painted nothing at all.
function assertAllTokensPainted(t) {
  for (const [name, value] of [['primary', t.primary], ['secondary', t.secondary], ['accent', t.accent]]) {
    expect(value).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    if (!/^rgb\(\d+, \d+, \d+\)$/.test(value)) throw new Error(`${name} was not painted`);
  }
}

describe('C/DL-2 Phase 3c — BrandingPreview resolves through src/utils/brandingTheme', () => {

  // ── 1. THE DEFAULTS ────────────────────────────────────────────────────────

  it('[RED] unset form state resolves the ROOFMILES defaults, not Accent Roofing\'s', () => {
    // THE CENTRAL TEST. An admin who has opened Branding and saved nothing is
    // looking at what their live page will render — and today they are looking at
    // a different company's brand.
    const t = resolveTokens({});
    assertAllTokensPainted(t);

    expect(t.primary).toBe(rgbOf(ROOFMILES_PRIMARY));
    expect(t.secondary).toBe(rgbOf(ROOFMILES_SECONDARY));
    t.unmount();
  });

  it('[RED] the accent slot falls back to the resolver\'s accent default, never to Accent Roofing\'s light blue', () => {
    // ⚠ THIS TEST WAS TIGHTENED WHEN THE OPEN QUESTION IT RAISED WAS RULED.
    // It was originally written as a decidable either/or, because the resolver
    // exposed only THREE colour tokens while the preview paints FOUR slots, and
    // the fourth (`accent`, sourced from formData.accent_color) had no home.
    //
    // THE RULING (C/DL-2 Phase 3c): accent_color STAYS the source — it is a real
    // column that GET/PUT /api/admin/settings already round-trips and that admins
    // can already set, so re-pointing the slot at landing_bg_color would silently
    // ignore a value they had saved. Its FALLBACK comes from shared code: the
    // resolver gained an accentColor token, defaulting to #FDF0E7, a pale tint of
    // the primary orange. The accent slot paints soft background washes, so a tint
    // of the primary keeps the default palette internally coherent rather than
    // introducing a fourth unrelated hue.
    //
    // Asserted TWICE on purpose, following this file's existing convention:
    // once against a HAND-DERIVED LITERAL (which pins the actual value) and once
    // against the value READ FROM THE MIRROR (which is the drift guard — a re-typed
    // constant would go on passing while the two copies diverged). Neither
    // assertion alone is sufficient, and together they are not circular.
    const t = resolveTokens({});
    assertAllTokensPainted(t);

    expect(t.accent).not.toBe(rgbOf('#D3E3F0'));
    expect(t.accent).toBe(rgbOf('#FDF0E7'));
    expect(t.accent).toBe(rgbOf(BRANDING_THEME_DEFAULTS.accentColor));
    t.unmount();
  });

  it('[RED] no hardcoded Accent Roofing literal survives into the preview\'s output', () => {
    // NON-VACUITY, stated explicitly because an absence assertion is worthless
    // without it. TWO gates run before the sweep:
    //   (a) resolveTokens throws unless the Dashboard mockup genuinely rendered —
    //       a component that rendered nothing has no literals in it either;
    //   (b) assertAllTokensPainted proves all three slots hold real rgb() colours,
    //       so the sweep is looking at a fully-painted preview rather than a blank.
    //
    // KNOWN LIMIT OF THE SWEEP, recorded rather than glossed: jsdom drops
    // `linear-gradient(...)` declarations it cannot parse, so a literal appearing
    // ONLY inside a gradient would escape the blob. The three explicit token
    // assertions below the sweep close that gap — the same three constants feed
    // both the plain and the gradient usages, so a literal that survived anywhere
    // is still resolved into one of these three slots.
    const t = resolveTokens({});
    assertAllTokensPainted(t);

    for (const hex of ACCENT_LITERALS) {
      expect(t.styleBlob).not.toContain(hex);
      expect(t.styleBlob).not.toContain(rgbOf(hex));
    }
    for (const hex of ACCENT_LITERALS) {
      expect([t.primary, t.secondary, t.accent]).not.toContain(rgbOf(hex));
    }
    t.unmount();
  });

  // ── 2. NO OVER-REACH ───────────────────────────────────────────────────────

  it('[GREEN-by-design] populated form state is reflected verbatim', () => {
    // THE COUNTERWEIGHT. A preview that painted the defaults unconditionally would
    // satisfy every assertion above and make the live preview useless — its entire
    // job is re-rendering from UNSAVED form state on every keystroke.
    //
    // Green on arrival: the component already passes valid hex through. It is a
    // regression fence around the rewire, and is reported as such.
    const t = resolveTokens({
      primary_color: '#123456', secondary_color: '#654321', accent_color: '#ABCDEF',
    });
    assertAllTokensPainted(t);

    expect(t.primary).toBe(rgbOf('#123456'));
    expect(t.secondary).toBe(rgbOf('#654321'));
    expect(t.accent).toBe(rgbOf('#ABCDEF'));
    t.unmount();
  });

  // ── 3. THE SAME MALFORMED-HEX RULE AS THE SERVER ───────────────────────────

  it('[RED] malformed hex resolves to the default, by the same rule the server applies', () => {
    // The values that make this a REAL test rather than a restatement of the
    // component's existing HEX_RE check: 'navy' and 'F26A1B' already fall back
    // today — to Accent's navy. What changes is WHICH default they land on.
    //
    // '#abc' is here deliberately: the 3-digit shorthand is legal CSS and is
    // REFUSED by the shared resolver, so this also pins that the component adopted
    // the resolver's regex rather than keeping its own near-identical one.
    const t = resolveTokens({
      primary_color: 'navy', secondary_color: 'F26A1B', accent_color: '#abc',
    });
    assertAllTokensPainted(t);

    expect(t.primary).toBe(rgbOf(ROOFMILES_PRIMARY));
    expect(t.secondary).toBe(rgbOf(ROOFMILES_SECONDARY));
    expect(t.accent).not.toBe(rgbOf('#D3E3F0'));
    t.unmount();
  });

  it('[RED] an empty-string colour is treated as unset, not painted as a literal empty value', () => {
    // A DB column reads NULL; a colour field the admin CLEARED reads ''. Same
    // intent, same answer — the equivalence the resolver's firstNonEmpty exists
    // for. The preview must not diverge from the page on it.
    const t = resolveTokens({ primary_color: '', secondary_color: '', accent_color: '' });
    assertAllTokensPainted(t);

    expect(t.primary).toBe(rgbOf(ROOFMILES_PRIMARY));
    expect(t.secondary).toBe(rgbOf(ROOFMILES_SECONDARY));
    t.unmount();
  });

  // ── 4. THE DRIFT GUARD ─────────────────────────────────────────────────────

  it('[RED] the preview\'s defaults ARE the mirror\'s, read from the mirror', () => {
    // THE IMPORTANT ONE, and the counterpart of
    // "the mapping's defaults are the server's ROOFMILES_DEFAULTS, read from the
    // server" in server/test/brandingTheme.test.js.
    //
    // The hex values are READ from src/utils/brandingTheme rather than re-typed
    // here, because a test that re-typed them would go on passing while the two
    // drifted apart — which is exactly how this component ended up three colours
    // away from the server with nothing failing. The hand-written literals in the
    // tests above still pin the actual values, so the pairing is not circular.
    //
    // ⚠ Satisfying this by copying BRANDING_THEME_DEFAULTS into a local constant
    // in BrandingPreview.jsx would pass this assertion and reintroduce the drift
    // in a new place. The component must CALL the mirror.
    const t = resolveTokens({});
    assertAllTokensPainted(t);

    expect(t.primary).toBe(rgbOf(BRANDING_THEME_DEFAULTS.primaryColor));
    expect(t.secondary).toBe(rgbOf(BRANDING_THEME_DEFAULTS.secondaryColor));
    t.unmount();
  });

  it('[RED] the resolver actually drives the app name and tagline, not just the colours', () => {
    // PROVES THE WHOLE COMPONENT MOVED ONTO THE MIRROR, not only its three colour
    // lines. The cheapest way to satisfy every colour assertion above is to swap
    // three literals for three imported constants and leave the rest of the
    // component's `||` fallbacks alone.
    //
    // The discriminator is 'Rooster Booster' (BrandingPreview.jsx:18). The resolver
    // deliberately supplies NO default program name — brandingTheme.test.js:288-295
    // records why: 'Rooster Booster' is this platform's internal codename, not a
    // program name any contractor would choose, and it is exactly as wrong on a
    // white-labeled surface as another contractor's colour would be.
    //
    // The preview must show the contractor's own program name when it has one, and
    // must not invent the platform's when it does not.
    const withName = render(<BrandingPreview formData={{ app_display_name: 'Alpha Rewards' }} />);
    // NON-VACUITY: the populated case must work before the absence case means
    // anything — a preview that rendered no name at all would satisfy the sweep.
    expect(screen.getByText('Alpha Rewards')).toBeInTheDocument();
    withName.unmount();

    const { container } = render(<BrandingPreview formData={{}} />);
    expect(container.textContent).toContain('Welcome back');   // the login screen did render
    expect(container.textContent).not.toContain('Rooster Booster');
  });
});
