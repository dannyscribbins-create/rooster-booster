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

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BrandingPreview from './BrandingPreview';
import { BRANDING_THEME_DEFAULTS, resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
// B-3 reads the engine's own answer rather than restating one, so an expectation
// here cannot drift from what the app derives.
import { deriveThemeTokens } from '../../utils/themeTokens.mjs';
// ⚠ userEvent IS USED IN EXACTLY ONE PLACE — B-4's fetch fence — FOR SOMETHING
// fireEvent STRUCTURALLY CANNOT DO. fireEvent dispatches an event at a node and
// performs NO hit testing, so it will happily "click" an element under
// `pointer-events: none`; a fence built on it would pass identically against a
// fully operable preview, which is the vacuity that fence exists to prevent.
// userEvent's hasPointerEvents() walks the ancestor chain in the element's OWN
// document and refuses, which is what makes the refusal observable at all.
// Pinned at v13 — no setup(), click() is synchronous and THROWS. Every other
// interaction in this file stays on fireEvent, matching the repo convention
// recorded in src/components/auth/unifiedLogin.test.jsx.
import userEvent from '@testing-library/user-event';

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

  it('[RED] the resolver actually drives the company name, not just the colours', async () => {
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
    // ⚠ RE-POINTED FROM THE PROGRAM NAME TO THE COMPANY NAME IN B-3, AND THE
    // SUBJECT IS UNCHANGED. This rendered a hand-painted login view that printed
    // `programName || companyName`; the view is now the REAL login screen, which
    // has never shown a program name and shows the COMPANY name instead. Asserting
    // a program name here would be pinning a surface that does not exist.
    // The discriminator survives intact, because the real screen renders the
    // company name through the same resolver output — so a resolver that started
    // defaulting the platform codename would still be caught below.
    // ⚠ AWAITED, BECAUSE THE BRANDING CHAIN IS ASYNCHRONOUS — and it is in
    // production too. The preview context's fetchBranding returns a promise, so
    // the first paint is the neutral palette and the draft arrives a tick later.
    // A synchronous query here would read the pre-resolution frame and fail for a
    // reason that has nothing to do with what is being asserted.
    // findAllByText, not findByText: the real screen renders the company name
    // TWICE — once in the subtitle and once in the footer — so the singular query
    // throws on multiple matches rather than reporting what it found.
    const withName = render(<BrandingPreview formData={{ company_name: 'Alpha Roofing Co' }} />);
    // NON-VACUITY: the populated case must work before the absence case means
    // anything — a preview that rendered no name at all would satisfy the sweep.
    // ⚠ READ FROM THE FRAME'S DOCUMENT SINCE B-3a, and awaited because the
    // injected chain is asynchronous in production too.
    await waitFor(() => expect(frameText()).toContain('Alpha Roofing Co'));
    withName.unmount();

    render(<BrandingPreview formData={{}} />);
    await waitFor(() => expect(frameText()).toContain('Welcome back'));  // it did render
    expect(frameText()).not.toContain('Rooster Booster');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BRANDING RUN B-3 — RED SUITE — THE PREVIEW SHOWS THE DERIVED RESULT
//
// THE DEFECT. This component never called deriveThemeTokens. It read the four
// stored hexes and hand-painted a picture from them, so it showed the values a
// contractor TYPED rather than the values the engine PAINTS. Five separate
// mismatches against the real login screen, and none of its colours was
// contrast-nudged. That is why an inverted palette looked plausible on save: the
// preview was never showing the real thing, it was drawing something that
// resembled it.
//
// ⚠ AND B-1 MADE IT WORSE RATHER THAN BETTER. After the route swap the preview's
// login gradient started from the dark neutral where the real screen's button is
// the action colour, so the panel disagreed with itself.
//
// THE FIX UNDER TEST. A preview-only branding context — createBrandingContext
// with an injected fetchBranding — mounts a REAL ThemeProvider over the draft
// values, and the REAL login screen paints from the --rm-* it puts on the page.
// ⚠ NOTHING WAS ADDED TO ThemeProvider. The injectable `context` prop already
// existed and the D4 chain already calls ctx.fetchBranding, so the override lives
// entirely in a preview-only object and no future reader has to ask whether that
// path can fire in production.
//
// ── ⚠ WHY EVERY DERIVATION CASE BELOW IS IN DARK MODE ───────────────────────
// In LIGHT mode a brand red that already clears the fill floor is passed through
// unchanged, so the typed value and the derived value are THE SAME STRING. A
// light-mode assertion therefore passes identically against a component that
// derives nothing at all — the exact vacuity this suite exists to prevent. In
// dark mode the engine lightens that fill until it reads on a dark ground, so
// the two values differ and the assertion can actually fail.
//
// ⚠ THE OBSERVATION POINT IS THE MOUNTED CUSTOM PROPERTY, NOT A PAINTED PIXEL.
// jsdom never resolves var(), so no test here can read what the login screen
// renders. What IS readable is the property set the provider mounts on its own
// wrapper — [data-rm-theme] — which is the same handle ThemeProvider.test.jsx
// uses. If the right value is mounted there, the real component is painting from
// it, because that is the only thing it reads.
// ─────────────────────────────────────────────────────────────────────────────

// The provider's wrapper — the one element carrying the --rm-* properties.
// ⚠ SEARCHED INSIDE THE PREVIEW FRAME SINCE B-3a, NOT IN THE PARENT DOCUMENT.
// The login screen no longer renders here: it is portalled into an iframe so that
// its `minHeight: 100vh` root is laid out against a phone-sized viewport instead
// of the browser's. Looking in the parent would find nothing and report it as a
// missing provider, which is a different defect from the one it would be hiding.
function themeRoot() {
  const frame = document.querySelector('iframe[data-preview-frame]');
  return frame?.contentDocument?.querySelector('[data-rm-theme]') ?? null;
}

function mountedToken(name) {
  const root = themeRoot();
  if (!root) throw new Error('the preview mounted no ThemeProvider — nothing below is meaningful');
  return root.style.getPropertyValue(name);
}

// The login screen's own DOM, which lives in the frame's document after B-3a.
function insideFrame(selector) {
  const frame = document.querySelector('iframe[data-preview-frame]');
  return frame?.contentDocument?.querySelector(selector) ?? null;
}

function frameText() {
  const frame = document.querySelector('iframe[data-preview-frame]');
  return frame?.contentDocument?.body?.textContent ?? '';
}

// A draft whose action colour is dark enough that dark mode MUST lighten it.
// Deliberately not any contractor's stored value: this file sits inside a
// brand-literal fence.
const DEEP_ACTION_DRAFT = {
  company_name:     'Preview Fixture Co',
  primary_color:    '#123A5F',
  secondary_color:  '#7A1020',
  accent_color:     '#DCE7F2',
  landing_bg_color: '#FFFFFF',
};

// A second draft that still DIVERGES after derivation, not merely before it.
// ⚠ CHOSEN BY COMPUTATION, NOT BY EYE. B-1 found a non-vacuity guard that went
// vacuous when both of its fixtures started answering the same thing once the
// routing moved; two inputs differing is not the same as two OUTPUTS differing.
const OTHER_DRAFT = {
  company_name:     'Second Fixture Co',
  primary_color:    '#1F5133',
  secondary_color:  '#6B3FA0',
  accent_color:     '#E4DCF2',
  landing_bg_color: '#FFFFFF',
};

describe('B-3 — the preview renders the DERIVED tokens, not the typed hexes', () => {

  it('[RED] DARK: the mounted action token is the DERIVED value, not the typed hex', async () => {
    // ⚠ THE LOAD-BEARING CASE. Two assertions and both are needed: the mounted
    // value must EQUAL what the engine derives, and must NOT equal what was
    // typed. The second is what fails against a component that passes raw values
    // through — which is the whole defect.
    const brand = resolveBrandingTheme(DEEP_ACTION_DRAFT);
    const expected = deriveThemeTokens(brand, 'dark');

    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} mode="dark" />);
    await screen.findByText('Live Preview');

    const painted = mountedToken('--rm-primary');

    expect(painted.toUpperCase()).toBe(expected.primary.toUpperCase());
    expect(painted.toUpperCase()).not.toBe(DEEP_ACTION_DRAFT.secondary_color.toUpperCase());
  });

  it('[RED] DARK: the page ground is derived from the draft too, not left at a default', async () => {
    // The ground is the other half of the acceptance condition. A component that
    // mounted a provider but fed it nothing would still satisfy the case above
    // by accident on some palettes; it cannot satisfy this one.
    const brand = resolveBrandingTheme(DEEP_ACTION_DRAFT);
    const expected = deriveThemeTokens(brand, 'dark');

    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} mode="dark" />);
    await screen.findByText('Live Preview');

    expect(mountedToken('--rm-bg').toUpperCase()).toBe(expected.bg.toUpperCase());
    expect(mountedToken('--rm-text').toUpperCase()).toBe(expected.text.toUpperCase());
  });

  it('[RED] the derivation tracks the DRAFT, not saved state', async () => {
    // The form hands this component unsaved values on every keystroke. A preview
    // reading anything else — a fetch, a cached response, the last save — would
    // show the contractor a page they are not currently editing.
    const edited = { ...DEEP_ACTION_DRAFT, secondary_color: '#2E6B2E' };
    const expected = deriveThemeTokens(resolveBrandingTheme(edited), 'dark');

    render(<BrandingPreview formData={edited} mode="dark" />);
    await screen.findByText('Live Preview');

    expect(mountedToken('--rm-primary').toUpperCase()).toBe(expected.primary.toUpperCase());
  });

  it('[RED] NON-VACUITY — two drafts that differ AFTER derivation preview differently', async () => {
    // ⚠ THE FIXTURES ARE PROVEN TO DIVERGE BEFORE THEY ARE COMPARED. Asserting
    // "two previews differ" is worthless if the two inputs happen to derive to
    // the same token, and it is worthless in the other direction if the pair is
    // never checked — the assertion would be pinning the fixtures rather than
    // the component. This computes the expectation from the real engine first.
    const a = deriveThemeTokens(resolveBrandingTheme(DEEP_ACTION_DRAFT), 'dark');
    const b = deriveThemeTokens(resolveBrandingTheme(OTHER_DRAFT), 'dark');
    expect(
      a.primary.toUpperCase(),
      'the two fixtures derive to the SAME action token — this guard would be vacuous'
    ).not.toBe(b.primary.toUpperCase());

    const first = render(<BrandingPreview formData={DEEP_ACTION_DRAFT} mode="dark" />);
    await screen.findByText('Live Preview');
    const paintedA = mountedToken('--rm-primary');
    first.unmount();

    render(<BrandingPreview formData={OTHER_DRAFT} mode="dark" />);
    await screen.findByText('Live Preview');
    const paintedB = mountedToken('--rm-primary');

    expect(paintedA.toUpperCase()).not.toBe(paintedB.toUpperCase());
    expect(paintedA.toUpperCase()).toBe(a.primary.toUpperCase());
    expect(paintedB.toUpperCase()).toBe(b.primary.toUpperCase());
  });

  it('[RED] a NEUTRAL draft still reaches the provider — the chain-path guard', async () => {
    // ⚠ THE INJECTION TRAVELS A DIFFERENT ROUTE FOR A NEUTRAL DRAFT, AND THAT IS
    // WHY THIS EXISTS. brandingForSlug() treats a payload equal to the platform
    // defaults as "no contractor identified" and declines, so the chain falls
    // through to its neutral source instead of the injected one. The OUTPUT is
    // identical today, which is exactly what makes the difference invisible — and
    // a future change to isNeutralBranding() could stop the injection working
    // with nothing failing. This pins the observable end state either way.
    render(<BrandingPreview formData={{}} mode="dark" />);
    await screen.findByText('Live Preview');

    const expected = deriveThemeTokens(resolveBrandingTheme({}), 'dark');
    expect(mountedToken('--rm-primary').toUpperCase()).toBe(expected.primary.toUpperCase());
    expect(mountedToken('--rm-bg').toUpperCase()).toBe(expected.bg.toUpperCase());
  });

  it('[RED] the REAL login screen is mounted, not a hand-painted lookalike', async () => {
    // ⚠ THE STRUCTURAL HALF. Every case above is satisfied by a component that
    // mounts a provider and then paints its own picture underneath it — the old
    // defect with better scaffolding. This asserts the actual screen is present,
    // by a control only the real component renders.
    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} />);
    await screen.findByText('Live Preview');

    // ⚠ READ THROUGH THE FRAME SINCE B-3a. The screen is portalled into a nested
    // document, so a parent-scoped query finds nothing — and would report "the
    // real screen is missing" when what actually changed is where it lives.
    await waitFor(() => expect(frameText()).toContain('Welcome back'));
    const buttons = Array.from(
      document.querySelector('iframe[data-preview-frame]').contentDocument.querySelectorAll('button')
    );
    expect(buttons.some(b => /sign in/i.test(b.textContent))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B-3a — RED SUITE — THE PREVIEW NEEDS ITS OWN VIEWPORT
//
// THE DEFECT, SEEN LIVE. The casing showed only the top of the login screen —
// logo and heading — with the form and the sign-in button below the crop.
// LoginScreen's root is `minHeight: 100vh` with `justifyContent: center`, and
// ⚠ 100vh RESOLVES AGAINST THE BROWSER VIEWPORT, NOT AGAINST A 500px BOX. On a
// tall window the root is a thousand pixels inside a five-hundred pixel casing
// and the card centres below the fold. The entrance animation was a red herring:
// it ran correctly on something already out of frame.
//
// ⚠ AND NEITHER A CONTAINING BLOCK NOR A TRANSFORM CHANGES WHAT vh MEANS. That
// is the whole reason this needs an iframe rather than a wrapper: a transform
// scales the rendered output while the element is still laid out against the
// viewport, and an overflow box crops it without shrinking it. ONLY A NEW
// VIEWPORT redefines vh, and in a browser that means a nested document.
//
// ⚠⚠ WHAT THIS SUITE CANNOT PROVE, STATED FIRST SO NOTHING BELOW IS READ AS
// MORE THAN IT IS. jsdom RUNS NO LAYOUT ENGINE. Measured directly: an element
// with an explicit height of 500px reports getBoundingClientRect() all zeros and
// offsetHeight 0. So `100vh` is never resolved to anything here, and setting
// window.innerHeight changes a number that nothing consults.
//
// THEREFORE NO TEST IN THIS FILE CAN ASSERT THAT THE CARD IS VISIBLE INSIDE THE
// CASING, at a tall viewport or any other. A case written that way would pass
// identically before and after the fix — the exact shape this arc has rejected
// three times. What these cases prove is the MECHANISM that makes the crop
// impossible: that a real nested document exists, that the screen renders inside
// it rather than in the parent, and that the derived custom properties are
// mounted in that document where the component can read them. The pixel outcome
// is a real-browser check and is owed separately.
// ─────────────────────────────────────────────────────────────────────────────

// The preview's nested viewport. Everything below reads through it, because
// after B-3a the login screen is no longer in the parent document at all.
function previewFrame() {
  return document.querySelector('iframe[data-preview-frame]');
}

function frameDoc() {
  const frame = previewFrame();
  if (!frame) throw new Error('the preview rendered no iframe — it has no viewport of its own');
  const doc = frame.contentDocument;
  if (!doc) throw new Error('the preview iframe exposed no document');
  return doc;
}

// The provider's wrapper, INSIDE the frame. If this is found in the parent
// document instead, the provider did not follow the portal and the component is
// painting from fallbacks.
function frameThemeRoot() {
  return frameDoc().querySelector('[data-rm-theme]');
}

describe('B-3a — the preview gets its own viewport, so 100vh means the casing', () => {

  it('[RED] renders into an iframe — the only thing that redefines vh', async () => {
    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} />);
    await screen.findByText('Live Preview');

    const frame = previewFrame();
    expect(
      frame,
      'no iframe. A wrapper cannot fix this: neither a containing block nor a ' +
      'transform changes what 100vh resolves against, so the card would still be ' +
      'laid out against the browser and still fall below the casing.'
    ).toBeTruthy();
  });

  it('[RED] the login screen renders INSIDE the frame, not in the parent document', async () => {
    // ⚠ THE PORTAL, ASSERTED FROM BOTH SIDES. Present inside the frame AND absent
    // outside it — an iframe that exists while the screen still renders in the
    // parent would satisfy the case above and fix nothing.
    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} />);
    await screen.findByText('Live Preview');

    const inside = frameDoc().querySelector('button');
    expect(inside, 'the frame is empty — nothing was portalled into it').toBeTruthy();

    expect(
      screen.queryByRole('button', { name: /sign in/i }),
      'the login screen is still in the PARENT document, so it is still laid out ' +
      'against the browser viewport and the crop is unchanged'
    ).toBeNull();
  });

  it('[RED] ⚠ the --rm-* are mounted INSIDE the frame, carrying DERIVED values', async () => {
    // ⚠ THE LOAD-BEARING CASE, AND IT CARRIES B-3'S ACCEPTANCE CONDITION THROUGH
    // THE FIX. A frame whose document has no custom properties leaves the real
    // component painting from its var() fallbacks — which is a preview that lies,
    // the defect B-3 existed to end, reintroduced by the fix for the crop.
    // Asserted in DARK because that is the only mode where the typed value and
    // the derived value differ; in light they coincide and this would pass
    // against no derivation at all.
    const expected = deriveThemeTokens(resolveBrandingTheme(DEEP_ACTION_DRAFT), 'dark');

    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} mode="dark" />);
    await screen.findByText('Live Preview');

    const root = frameThemeRoot();
    expect(root, 'no provider wrapper inside the frame — the tokens did not follow the portal').toBeTruthy();

    const painted = root.style.getPropertyValue('--rm-primary');
    expect(painted.toUpperCase()).toBe(expected.primary.toUpperCase());
    expect(painted.toUpperCase()).not.toBe(DEEP_ACTION_DRAFT.secondary_color.toUpperCase());
    expect(root.style.getPropertyValue('--rm-bg').toUpperCase()).toBe(expected.bg.toUpperCase());
  });

  it('[RED] the frame is a phone-sized viewport, scaled to the casing', async () => {
    // The numbers are the point: a 390x750 document scaled by 2/3 is exactly
    // 260x500, which is the casing. Both axes agree, so nothing is cropped and
    // the proportions are the real screen's rather than a squeeze.
    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} />);
    await screen.findByText('Live Preview');

    const frame = previewFrame();
    expect(frame.getAttribute('width')).toBe('390');
    expect(frame.getAttribute('height')).toBe('750');
    expect(frame.style.transform).toContain('scale');
  });

  it('B-3a — WHERE THE body BACKGROUND WRITE LANDS, recorded rather than assumed', async () => {
    // ⚠ NOT A REQUIREMENT — A MEASUREMENT, AND IT IS PINNED SO THE ANSWER CANNOT
    // CHANGE SILENTLY. ThemeLayer writes document.body.style.background on mount
    // and restores it on unmount. The open question B-3a had to settle is which
    // document that is now: the portal moves the RENDER TREE into the frame, but
    // the component's module-level `document` still refers to the realm the module
    // was loaded in. If the write reaches the parent, opening this panel repaints
    // the admin page's body with a contractor's brand colour.
    // ⚠ ThemeLayer IS NOT PATCHED EITHER WAY. It is a shared provider and a
    // preview must not reshape it; whatever this records is filed, not fixed.
    const before = document.body.style.background;
    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} mode="dark" />);
    await screen.findByText('Live Preview');
    await waitFor(() => expect(themeRoot()).toBeTruthy());

    const frame = document.querySelector('iframe[data-preview-frame]');
    const parentAfter = document.body.style.background;
    const frameAfter = frame.contentDocument.body.style.background;

    // ⚠ THE MEASURED ANSWER: THE WRITE STILL REACHES THE PARENT. Observed
    // 2026-09-01 — the admin page's body took the derived dark ground while the
    // frame's own body stayed unset. The portal moves the render tree, not the
    // module's idea of `document`, so the iframe did NOT scope this and was never
    // going to.
    // ⚠ PINNED AS A FACT, NOT AS A REQUIREMENT. Nobody wants this behaviour; what
    // this assertion buys is that it cannot change silently in either direction.
    // If a later change scopes the write, this fails and someone reads why rather
    // than discovering a preview that stopped repainting the panel. The fix is
    // filed in PRE_LAUNCH_CHECKLIST.md against the branding preview; it is not
    // taken here because ThemeLayer is a shared provider and a preview must not
    // reshape one.
    expect(parentAfter, 'the parent body was not repainted — the recorded behaviour changed')
      .not.toBe(before);
    expect(frameAfter, 'the frame body was repainted — the write is no longer where it was recorded')
      .toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B-3b — RED SUITE — THE PREVIEW UPDATES AS THE DRAFT CHANGES
//
// THE REGRESSION B-3 INTRODUCED. Before B-3 the preview repainted as the admin
// typed. After it, a colour change did nothing until the panel was saved,
// navigated away from and navigated back to.
//
// ⚠ THE TELL WAS THAT THE VIEW BUTTONS ABOVE THE CASING RECOLOURED IMMEDIATELY
// while the phone did not. Those read form state directly; the phone reads it
// through a provider.
//
// THE MECHANISM, confirmed at the source rather than inferred: BrandingProvider
// resolves the D4 chain in an effect with an EMPTY dependency array, and its own
// comment says why — re-running on a changed `context` identity would re-resolve
// on every parent render, because the default context builder produces a fresh
// object each time. B-3 fed the draft in through that chain via an injected
// fetchBranding, so the draft is read exactly once, on mount, and every later
// keystroke produces a new context object that nothing consults.
//
// ⚠ THESE CASES ARE AGNOSTIC ABOUT THE FIX. They assert the observable property
// — the mounted token follows the draft, without a save and without the panel
// being torn down and rebuilt — so whichever mechanism is chosen has to deliver
// that rather than merely look plausible.
// ─────────────────────────────────────────────────────────────────────────────

describe('B-3b — the preview follows the draft as it is edited', () => {

  it('[RED] editing a colour repaints the mounted token, with no save and no remount', async () => {
    // ⚠ THE LOAD-BEARING CASE. rerender() on the SAME element instance is what
    // makes this a live update rather than a remount: React reconciles in place,
    // exactly as it does when the form's state changes under a typing admin. A
    // fix that only works by tearing the tree down would fail here, which is the
    // point — that is the behaviour being restored, not a repaint at any cost.
    const first = { ...DEEP_ACTION_DRAFT };
    const edited = { ...DEEP_ACTION_DRAFT, secondary_color: '#2E6B2E' };

    const before = deriveThemeTokens(resolveBrandingTheme(first), 'dark');
    const after = deriveThemeTokens(resolveBrandingTheme(edited), 'dark');
    // NON-VACUITY: the two drafts must actually derive to different tokens, or
    // "the token changed" is unprovable and "it did not" is meaningless.
    expect(
      before.primary.toUpperCase(),
      'the two drafts derive to the same token — this case could not fail'
    ).not.toBe(after.primary.toUpperCase());

    const view = render(<BrandingPreview formData={first} mode="dark" />);
    await screen.findByText('Live Preview');
    await waitFor(() => expect(themeRoot()).toBeTruthy());
    expect(mountedToken('--rm-primary').toUpperCase()).toBe(before.primary.toUpperCase());

    // The keystroke. Same component, new props — no unmount, no save.
    view.rerender(<BrandingPreview formData={edited} mode="dark" />);

    await waitFor(
      () => expect(mountedToken('--rm-primary').toUpperCase()).toBe(after.primary.toUpperCase()),
      { timeout: 2000 }
    );
  });

  it('[RED] the repainted value is still DERIVED, not the typed hex', async () => {
    // ⚠ THE FIX MUST NOT TRADE THIS DEFECT FOR THE ONE B-3 REMOVED. A preview
    // that updated live by painting raw values would satisfy the case above and
    // undo the whole of B-3. Asserted in DARK, where the typed and derived values
    // diverge; in light they coincide and this would pass against raw painting.
    // ⚠ THE EDITED VALUE MUST DIFFER FROM THE BASE DRAFT, AND THE FIRST DRAFT OF
    // THIS CASE DID NOT — it re-typed the fixture's own secondary_color, so
    // `first` and `edited` were identical, nothing changed, and the case passed
    // against the unfixed component. Caught by reading the RED count (two of
    // three) rather than assuming all three had failed.
    const first = { ...DEEP_ACTION_DRAFT };
    const edited = { ...DEEP_ACTION_DRAFT, secondary_color: '#5C1030' };
    expect(edited.secondary_color).not.toBe(first.secondary_color);
    const after = deriveThemeTokens(resolveBrandingTheme(edited), 'dark');
    expect(
      after.primary.toUpperCase(),
      'the edit does not move the derived token — this case could not fail'
    ).not.toBe(deriveThemeTokens(resolveBrandingTheme(first), 'dark').primary.toUpperCase());

    const view = render(<BrandingPreview formData={first} mode="dark" />);
    await screen.findByText('Live Preview');
    await waitFor(() => expect(themeRoot()).toBeTruthy());

    view.rerender(<BrandingPreview formData={edited} mode="dark" />);

    await waitFor(
      () => expect(mountedToken('--rm-primary').toUpperCase()).toBe(after.primary.toUpperCase()),
      { timeout: 2000 }
    );
    expect(mountedToken('--rm-primary').toUpperCase()).not.toBe('#5C1030');
  });

  it('[RED] the ground follows an edit to the neutral too, not only the action colour', async () => {
    // Both routed columns, because a fix that rewired one and not the other would
    // pass the two cases above and still be half broken.
    const first = { ...DEEP_ACTION_DRAFT };
    const edited = { ...DEEP_ACTION_DRAFT, primary_color: '#3A1F5F' };
    const after = deriveThemeTokens(resolveBrandingTheme(edited), 'dark');

    const view = render(<BrandingPreview formData={first} mode="dark" />);
    await screen.findByText('Live Preview');
    await waitFor(() => expect(themeRoot()).toBeTruthy());

    view.rerender(<BrandingPreview formData={edited} mode="dark" />);

    await waitFor(
      () => expect(mountedToken('--rm-bg').toUpperCase()).toBe(after.bg.toUpperCase()),
      { timeout: 2000 }
    );
  });

  it('B-3b — the update is SYNCHRONOUS and the screen is not remounted', async () => {
    // ⚠ TWO CLAIMS THE RULING ASKED TO BE CONFIRMED RATHER THAN ASSUMED, and they
    // are the reason (a) needs no debounce.
    //
    // SYNCHRONOUS: supplied mode has no effect behind it, so a new object on a
    // keystroke IS the update. Asserted with NO waitFor — the token must already
    // be correct on the render that follows the prop change. Under the old
    // resolving path this could not pass at any timeout, let alone none.
    //
    // NOT REMOUNTED: the card carries an entrance animation keyed on mount. If the
    // provider tore its subtree down on every edit the animation would replay on
    // every keystroke. Asserted by identity of the DOM node — a remount produces a
    // different element; a reconciled update keeps the same one.
    const first = { ...DEEP_ACTION_DRAFT };
    const edited = { ...DEEP_ACTION_DRAFT, secondary_color: '#2E6B2E' };
    const after = deriveThemeTokens(resolveBrandingTheme(edited), 'dark');

    const view = render(<BrandingPreview formData={first} mode="dark" />);
    await screen.findByText('Live Preview');
    await waitFor(() => expect(themeRoot()).toBeTruthy());

    const nodeBefore = themeRoot();

    view.rerender(<BrandingPreview formData={edited} mode="dark" />);

    // NO await, NO waitFor.
    expect(
      mountedToken('--rm-primary').toUpperCase(),
      'the repaint was not synchronous — supplied mode should need no tick'
    ).toBe(after.primary.toUpperCase());

    expect(
      themeRoot(),
      'the provider subtree was torn down and rebuilt — the entrance animation would replay on every keystroke'
    ).toBe(nodeBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B-4 — RED SUITE — THE PREVIEW SURFACES AND THE MODE TOGGLE
//
// B-3 through B-3c made ONE surface faithful. B-4 adds the controls: a view
// button per surface, and a light/dark toggle beside them that swaps what is
// mounted INSIDE the casing.
//
// ── THE THREE SURFACES, AND WHY THE THIRD IS NOT HERE ───────────────────────
// The unified login door and RepShell are real components painting from --rm-*,
// so both can be mounted and both answer a mode change. THE LANDING PAGE CANNOT
// BE PREVIEWED AT ALL TODAY and is filed rather than built — it is a
// server-rendered HTML string whose renderer is module-private, it emits
// --brand-* rather than the render tokens, the live page refuses cross-origin
// framing, and it HAS NO DARK MODE ANYWHERE IN IT. See PRE_LAUNCH_CHECKLIST.md's
// landing-preview entry for the route and its caveats. A surface with one mode
// sitting under a two-mode control is the defect this suite's disabled-toggle
// cases exist to prevent, one surface along.
//
// ── ⚠ WHY EVERY MODE CASE BELOW READS A DERIVED TOKEN IN DARK ───────────────
// The same argument B-3's header makes, and it is the whole reason a mode
// control is testable at all. In LIGHT mode a compliant brand fill is passed
// through unchanged, so the typed hex and the derived token are the same string
// — an assertion that the toggle "changed the colour" would pass identically
// against a control wired to nothing but a label. In dark the engine lightens
// the fill and darkens the ground, so light and dark produce DIFFERENT strings
// and the assertion can fail. Every case below computes both from the real
// engine and asserts they diverge BEFORE comparing anything the component
// painted.
//
// ⚠ AND THE OBSERVATION POINT IS THE MOUNTED CUSTOM PROPERTY, NOT A PIXEL.
// jsdom resolves no var(). What is readable is the property set ThemeProvider
// mounts on [data-rm-theme] inside the frame — the same handle B-3 uses.
// ─────────────────────────────────────────────────────────────────────────────

// The preview's own mode control. A data attribute rather than a role query:
// RepShell's Profile screen carries its OWN role="switch" (RepThemeToggleRow),
// and although that one lives in the frame's document rather than in `screen`,
// pinning this to a handle the preview owns means the two can never be confused
// if either moves.
function modeToggle() {
  return document.querySelector('[data-preview-mode-toggle]');
}

// A draft that names a logo and a company, for the merge case. The URL is a
// .invalid host, matching adminBrandingSeam.test.jsx — nothing here may resolve.
const REP_DRAFT = {
  ...DEEP_ACTION_DRAFT,
  company_name: 'Fourth Fixture Roofing',
  logo_url: 'https://cdn.test.invalid/fourth/mark.png',
};

describe('B-4 — the view switcher mounts each surface, and the mode toggle swaps it', () => {

  // ── 1. EACH VIEW BUTTON MOUNTS ITS OWN SURFACE ─────────────────────────────

  it('[RED] a Rep app view button mounts the REAL RepShell, not a drawing of one', async () => {
    // ⚠ THE STRUCTURAL HALF, AND IT IS THE SAME ARGUMENT B-3 MADE FOR LOGIN.
    // Every colour assertion below is satisfied by a component that mounts a
    // provider and paints its own picture underneath it. This asserts the actual
    // shell is present, by two handles only the real components render:
    // data-rep-shell is RepShell's root, data-rep-nav is RepBottomNav.
    render(<BrandingPreview formData={REP_DRAFT} />);
    await screen.findByText('Live Preview');

    fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));

    await waitFor(() => expect(insideFrame('[data-rep-shell]')).toBeTruthy());
    expect(
      insideFrame('[data-rep-nav]'),
      'the bottom nav is absent — a stub was mounted rather than the shell'
    ).toBeTruthy();
  });

  it('[RED] the shell renders INSIDE the frame, where its fixed nav and 100vh mean the casing', async () => {
    // ⚠ NOT A DUPLICATE OF THE CASE ABOVE — IT PINS WHERE, AND RepShell NEEDS
    // THE FRAME FOR A SECOND REASON LoginScreen DOES NOT HAVE. Its root is
    // minHeight:100vh (B-3a's argument), AND RepBottomNav is
    // position:fixed with bottom:0 and width:min(430px,100vw). Mounted in the
    // parent document that nav pins to the BROWSER viewport at 430px wide — a
    // bar floating across the admin panel, outside the phone entirely.
    render(<BrandingPreview formData={REP_DRAFT} />);
    await screen.findByText('Live Preview');

    fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));
    await waitFor(() => expect(insideFrame('[data-rep-shell]')).toBeTruthy());

    expect(
      document.querySelector('[data-rep-shell]'),
      'the shell rendered in the PARENT document — its fixed nav would escape the casing'
    ).toBeNull();
  });

  it('[RED] the two real surfaces are DISTINCT — each button mounts its own, not one of them twice', async () => {
    // ⚠ THE SIBLING PROOF, AND IT IS WHY THE LOGIN HALF IS ASSERTED HERE RATHER
    // THAN LEFT TO B-3. A switcher wired so that every button mounts the SAME
    // surface satisfies case 1 whenever that surface happens to be the shell.
    // Each state is pinned by what is present AND by what is absent.
    render(<BrandingPreview formData={REP_DRAFT} />);
    await screen.findByText('Live Preview');

    // Login is the entry view and is already the arc's proven surface.
    await waitFor(() => expect(frameText()).toContain('Welcome back'));
    expect(insideFrame('[data-rep-shell]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));
    await waitFor(() => expect(insideFrame('[data-rep-shell]')).toBeTruthy());
    expect(
      frameText(),
      'the login screen is still mounted alongside the shell — the views are not exclusive'
    ).not.toContain('Welcome back');
  });

  // ── 2. THE MODE TOGGLE CHANGES WHAT IS MOUNTED ─────────────────────────────

  it('[RED] DARK: the toggle moves the DERIVED action token, not a label', async () => {
    const brand = resolveBrandingTheme(DEEP_ACTION_DRAFT);
    const light = deriveThemeTokens(brand, 'light');
    const dark  = deriveThemeTokens(brand, 'dark');

    // NON-VACUITY, FIRST. If this fixture derived the same action token in both
    // modes, "the token moved" could never fail and this case would be pinning
    // the fixture rather than the control.
    expect(
      light.primary.toUpperCase(),
      'the fixture derives the SAME action token in both modes — this case could not fail'
    ).not.toBe(dark.primary.toUpperCase());

    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} />);
    await screen.findByText('Live Preview');
    await waitFor(() => expect(themeRoot()).toBeTruthy());

    expect(mountedToken('--rm-primary').toUpperCase()).toBe(light.primary.toUpperCase());

    fireEvent.click(modeToggle());

    await waitFor(
      () => expect(mountedToken('--rm-primary').toUpperCase()).toBe(dark.primary.toUpperCase()),
      { timeout: 2000 }
    );
    // ⚠ AND IT IS STILL DERIVED. A toggle that flipped the surface to dark by
    // painting the typed hex would satisfy the line above on some palettes and
    // undo the whole of B-3. Asserted in dark, where the two diverge.
    expect(
      mountedToken('--rm-primary').toUpperCase(),
      'the dark value IS the typed hex — the toggle is painting raw values'
    ).not.toBe(DEEP_ACTION_DRAFT.secondary_color.toUpperCase());
  });

  it('[RED] the page ground moves too, not only the action colour', async () => {
    // Both routed columns, for the same reason B-3b asserts both: a control
    // wired to one and not the other passes the case above and is half built.
    // The ground is also the single most visible thing a mode change does.
    const brand = resolveBrandingTheme(DEEP_ACTION_DRAFT);
    const light = deriveThemeTokens(brand, 'light');
    const dark  = deriveThemeTokens(brand, 'dark');
    expect(light.bg.toUpperCase()).not.toBe(dark.bg.toUpperCase());
    expect(light.text.toUpperCase()).not.toBe(dark.text.toUpperCase());

    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} />);
    await screen.findByText('Live Preview');
    await waitFor(() => expect(themeRoot()).toBeTruthy());
    expect(mountedToken('--rm-bg').toUpperCase()).toBe(light.bg.toUpperCase());

    fireEvent.click(modeToggle());

    await waitFor(
      () => expect(mountedToken('--rm-bg').toUpperCase()).toBe(dark.bg.toUpperCase()),
      { timeout: 2000 }
    );
    expect(mountedToken('--rm-text').toUpperCase()).toBe(dark.text.toUpperCase());
  });

  it('[RED] the toggle reports the mode it produced — the provider and the control agree', async () => {
    // ⚠ THE CONTROL'S OWN STATE IS A SECOND SOURCE OF TRUTH AND MUST NOT DRIFT
    // FROM THE PROVIDER'S. data-rm-theme is what ThemeLayer publishes;
    // aria-checked is what a screen reader is told. A control that swapped the
    // tokens while still announcing "off" is a defect no colour assertion sees.
    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} />);
    await screen.findByText('Live Preview');
    await waitFor(() => expect(themeRoot()).toBeTruthy());

    expect(themeRoot().getAttribute('data-rm-theme')).toBe('light');
    expect(modeToggle().getAttribute('aria-checked')).toBe('false');

    fireEvent.click(modeToggle());

    await waitFor(() => expect(themeRoot().getAttribute('data-rm-theme')).toBe('dark'));
    expect(modeToggle().getAttribute('aria-checked')).toBe('true');
  });

  // ── 3. TWO INDEPENDENT CONTROLS THAT MUST NOT CLOBBER EACH OTHER ───────────

  it('[RED] switching VIEWS preserves the MODE', async () => {
    // The obvious wrong implementation remounts the surface with a fresh mode
    // default on every view change, so a contractor comparing two screens in
    // dark is silently returned to light by the act of comparing them.
    const dark = deriveThemeTokens(resolveBrandingTheme(REP_DRAFT), 'dark');

    render(<BrandingPreview formData={REP_DRAFT} />);
    await screen.findByText('Live Preview');
    await waitFor(() => expect(themeRoot()).toBeTruthy());

    fireEvent.click(modeToggle());
    await waitFor(() => expect(themeRoot().getAttribute('data-rm-theme')).toBe('dark'));

    fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));
    await waitFor(() => expect(insideFrame('[data-rep-shell]')).toBeTruthy());

    expect(
      themeRoot().getAttribute('data-rm-theme'),
      'the view change reset the mode'
    ).toBe('dark');
    // ⚠ THE ATTRIBUTE ALONE IS NOT THE PROOF. A surface that reported dark while
    // mounting light tokens would satisfy the line above. The derived ground is
    // what the contractor actually sees.
    expect(mountedToken('--rm-bg').toUpperCase()).toBe(dark.bg.toUpperCase());
    expect(modeToggle().getAttribute('aria-checked')).toBe('true');
  });

  it('[RED] switching MODES preserves the VIEW', async () => {
    // The mirror of the case above, and the failure is the same shape: a
    // contractor inspecting the rep app in dark should not be returned to the
    // login screen by the toggle.
    render(<BrandingPreview formData={REP_DRAFT} />);
    await screen.findByText('Live Preview');

    fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));
    await waitFor(() => expect(insideFrame('[data-rep-shell]')).toBeTruthy());

    fireEvent.click(modeToggle());
    await waitFor(() => expect(themeRoot().getAttribute('data-rm-theme')).toBe('dark'));

    expect(
      insideFrame('[data-rep-shell]'),
      'the mode change sent the preview back to another surface'
    ).toBeTruthy();
    expect(frameText()).not.toContain('Welcome back');
  });

  // ── 4. THE TOGGLE IS DISABLED ON THE DASHBOARD ILLUSTRATION ────────────────

  it('[RED] the toggle is DISABLED on Dashboard and RE-ENABLED on leaving it', async () => {
    // ⚠ BOTH DIRECTIONS, IN ONE MOUNT, AND THE ENABLED STATE IS ASSERTED FIRST.
    // "It is disabled here" is satisfied by a control that is disabled
    // everywhere — including by one wired to nothing at all. The enabled
    // bookends are what make the middle assertion mean something.
    //
    // WHY IT IS DISABLED: DashboardPreview is a hand-painted illustration that
    // reads no token and no mode, so it renders identically in both. A live
    // control over a surface that ignores it teaches a contractor their palette
    // does nothing — the same "inaccurate AND unresponsive" failure that keeps
    // the referrer dashboard out of this switcher entirely.
    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} />);
    await screen.findByText('Live Preview');

    expect(modeToggle().disabled, 'the toggle is dead on the login view').toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    await waitFor(() => expect(modeToggle().disabled).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));
    await waitFor(() => expect(modeToggle().disabled).toBe(false));
  });

  it('[RED] the illustration says it does not follow the mode, not only that it is an illustration', async () => {
    // ⚠ THE LABEL WAS WRITTEN BEFORE A MODE CONTROL EXISTED. "Illustration of
    // your palette — not a render of the live screen" is honest about FIDELITY
    // and silent about MODE, and a disabled control with no stated reason is a
    // dead button. The sentence is the visible reason.
    //
    // ⚠ ANCHORED ON THE ILLUSTRATION'S OWN ELEMENT, NOT ON A DOCUMENT-WIDE TEXT
    // SEARCH. A needle matched anywhere on the panel would go green against the
    // word appearing in a button label.
    render(<BrandingPreview formData={DEEP_ACTION_DRAFT} />);
    await screen.findByText('Live Preview');

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));

    const note = await waitFor(() => {
      const el = document.querySelector('[data-preview-illustration-note]');
      if (!el) throw new Error('the illustration carries no note element');
      return el;
    });

    expect(note.textContent).toMatch(/illustration/i);
    expect(
      note.textContent,
      'the note does not mention the mode — the disabled toggle has no stated reason'
    ).toMatch(/light|dark/i);
  });

  // ── 5. THE B-3c MERGE REACHES THE NEW SURFACE ──────────────────────────────

  it('[RED] the draft logo and company name reach RepShell — no fallback to the platform mark', async () => {
    // ⚠ THE FALLBACK IS THE PRIMARY CASE, NOT THE INCIDENTAL ONE. RepShell reads
    // the branding logoUrl or falls back to the platform mark, and the branding
    // companyName or falls back to the platform name — so a surface the merge
    // never reaches renders the PLATFORM's mark and the PLATFORM's name and
    // looks entirely plausible. That is exactly the defect B-3c fixed on the
    // login screen — the preview showing one brand while the live screen shows
    // another — arriving one surface later.
    //
    // ⚠ BOTH FIELDS, AND THE LOGO IS THE LOAD-BEARING ONE. companyName is
    // DEFAULTED by the resolver; logoUrl resolves to null when unset, so it is
    // the field that can actually distinguish "the merge arrived" from "the
    // fallback fired". Asserting the name alone is the defaulted-field trap.
    render(<BrandingPreview formData={REP_DRAFT} />);
    await screen.findByText('Live Preview');

    fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));
    await waitFor(() => expect(insideFrame('[data-rep-shell]')).toBeTruthy());

    const mark = insideFrame('[data-rep-shell] img');
    expect(mark, 'the shell rendered no mark at all').toBeTruthy();
    expect(mark.getAttribute('src')).toBe(REP_DRAFT.logo_url);
    expect(
      mark.getAttribute('src'),
      'the shell fell back to the PLATFORM mark — the draft never reached it'
    ).not.toMatch(/roofmiles/i);
    expect(mark.getAttribute('alt')).toBe(REP_DRAFT.company_name);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B-4 — THE FETCH FENCE
//
// ⚠ THIS IS A NEW RISK B-4 CREATES, NOT AN OLD ONE IT INHERITS. Until now the
// only surface in the casing was LoginScreen, whose three fetches all sit inside
// submit handlers. RepShell brings RepThemeToggleRow, and that row calls
// saveThemeMode() — a real PUT to /api/preferences/theme-mode presenting the
// ADMIN token, which is the token the person looking at this panel is holding.
// ⚠ SO A CLICKABLE PREVIEW WOULD LET AN ADMIN CHANGE A THEME PREFERENCE BY
// LOOKING AT THEIR OWN BRANDING PAGE. Not hypothetical: B-3a found the login
// screen inside this casing accepting typing, submitting, and opening real
// browser tabs, which is why the pointer-events block exists at all.
//
// TWO FENCES, AND THEY ARE DIFFERENT CLAIMS:
//   (A) B-4's OWN control writes nothing. It is a preview control, not the rep
//       app's theme setting.
//   (B) NOTHING INSIDE THE FRAME IS OPERABLE, so the rep app's own writer cannot
//       be reached in the first place.
// (A) alone would leave the real writer one click away; (B) alone would not say
// what B-4's control does.
// ─────────────────────────────────────────────────────────────────────────────

describe('B-4 — the preview writes nothing, and nothing in the casing is operable', () => {

  it('[RED] B-4 toggle writes NOTHING — it moves the mode and fires no request, on every view', async () => {
    // ⚠ THE "IT WORKED" ASSERTIONS ARE THE NON-VACUITY CONTROL, AND WITHOUT THEM
    // THIS CASE IS WORTHLESS. "No request fired" is satisfied by a toggle wired
    // to nothing at all — by a dead button, by a missing button, by a component
    // that renders nothing. Each click below is proved to have MOVED THE MODE
    // before the fetch count is read, so what is pinned is "it works and it is
    // silent" rather than "nothing happened".
    //
    // The stub RESOLVES rather than rejecting: a rejected promise nothing caught
    // would surface as an unhandled rejection and bury the assertion message
    // that actually says what went wrong.
    const calls = [];
    const realFetch = global.fetch;
    global.fetch = (...args) => {
      calls.push(args);
      return Promise.resolve({ ok: false, status: 0, json: async () => ({}) });
    };

    try {
      render(<BrandingPreview formData={REP_DRAFT} />);
      await screen.findByText('Live Preview');
      await waitFor(() => expect(themeRoot()).toBeTruthy());

      fireEvent.click(modeToggle());
      await waitFor(() => expect(themeRoot().getAttribute('data-rm-theme')).toBe('dark'));
      expect(calls, 'the toggle fired a request from the login view').toHaveLength(0);

      // The other real surface — the one that brought the writer into the casing.
      fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));
      await waitFor(() => expect(insideFrame('[data-rep-shell]')).toBeTruthy());
      expect(calls, 'mounting the rep shell fired a request').toHaveLength(0);

      fireEvent.click(modeToggle());
      await waitFor(() => expect(themeRoot().getAttribute('data-rm-theme')).toBe('light'));
      expect(calls, 'the toggle fired a request from the rep view').toHaveLength(0);
    } finally {
      global.fetch = realFetch;
    }
  });

  it('[RED] nothing inside the frame is operable — the rep app own theme writer is unreachable', async () => {
    // ⚠ TWO LAYERS, ASSERTED SEPARATELY, BECAUSE EITHER ALONE IS A DIFFERENT
    // CLAIM. Layer one: a real click on anything in the frame is REFUSED. Layer
    // two: the writer is not even rendered, because RepShell enters on Home and
    // RepThemeToggleRow lives on Profile, which is reached only through the nav
    // that layer one just proved unreachable.
    render(<BrandingPreview formData={REP_DRAFT} />);
    await screen.findByText('Live Preview');

    fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));
    await waitFor(() => expect(insideFrame('[data-rep-shell]')).toBeTruthy());

    // ⚠ THE POSITIVE CONTROL, AND IT COMES FIRST. userEvent refusing a click is
    // only evidence about the frame if userEvent will accept one elsewhere. B-4's
    // own toggle sits in the parent document and must click cleanly; without this
    // line, "userEvent threw" is equally explained by a broken harness.
    expect(
      () => userEvent.click(modeToggle()),
      'userEvent refused a click in the PARENT document — the refusal below proves nothing about the frame'
    ).not.toThrow();

    const tab = insideFrame('[data-rep-tab="profile"]');
    expect(tab, 'the rep nav rendered no Profile tab — nothing below is meaningful').toBeTruthy();

    expect(
      () => userEvent.click(tab),
      'a real click reached the rep app nav — the preview is operable and the theme writer is one tab away'
    ).toThrow(/pointer-events/);

    // Layer two. The writer is not on the entry screen and cannot be navigated to.
    expect(
      insideFrame('[data-rep-theme-switch]'),
      'the rep app own theme switch is rendered in the preview'
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B-4 — THE ARC'S ESTABLISHED PROPERTIES, RE-ASSERTED ON THE SURFACE B-4 ADDED
//
// ⚠ THIS EXISTS BECAUSE OF A RULE THIS CODEBASE PAID FOR: "a rule applied once
// to a surface does not stay applied when the surface moves." B-3b's four
// live-update cases are all green and every one of them drives the LOGIN view.
// None of them says anything about the rep view, and "the provider sits above
// the swap so it must follow the draft there too" is a structural argument, not
// a measurement. The structural argument happens to be right; that is not the
// same as it having been checked.
// ─────────────────────────────────────────────────────────────────────────────

describe('B-4 — the arc properties still hold on the newly added surface', () => {

  it('[RED] the REP view follows the draft live too — no save, no remount', async () => {
    // Same shape as B-3b's load-bearing case, driven on the other surface, and
    // in dark for the same reason: in light the typed and derived values
    // coincide, so the assertion could not fail against raw painting.
    const first = { ...REP_DRAFT };
    const edited = { ...REP_DRAFT, secondary_color: '#2E6B2E' };

    const before = deriveThemeTokens(resolveBrandingTheme(first), 'dark');
    const after  = deriveThemeTokens(resolveBrandingTheme(edited), 'dark');
    expect(
      before.primary.toUpperCase(),
      'the two drafts derive to the same token — this case could not fail'
    ).not.toBe(after.primary.toUpperCase());

    const view = render(<BrandingPreview formData={first} mode="dark" />);
    await screen.findByText('Live Preview');

    fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));
    await waitFor(() => expect(insideFrame('[data-rep-shell]')).toBeTruthy());
    expect(mountedToken('--rm-primary').toUpperCase()).toBe(before.primary.toUpperCase());

    const nodeBefore = themeRoot();

    // The keystroke. Same element, new props — no unmount, no save.
    view.rerender(<BrandingPreview formData={edited} mode="dark" />);

    await waitFor(
      () => expect(mountedToken('--rm-primary').toUpperCase()).toBe(after.primary.toUpperCase()),
      { timeout: 2000 }
    );
    // ⚠ AND THE VIEW SURVIVED THE EDIT. A repaint that tore the frame down and
    // rebuilt it would satisfy the line above and dump the contractor back on
    // the login screen every time they typed a character.
    expect(insideFrame('[data-rep-shell]'), 'the edit reset the view').toBeTruthy();
    expect(
      themeRoot(),
      'the provider subtree was torn down and rebuilt on a keystroke'
    ).toBe(nodeBefore);
  });

  it('[RED] the frame is the SAME element across a view change — one frame, not one per surface', async () => {
    // ⚠ THE STRUCTURAL CLAIM BEHIND "switching views preserves the mode".
    // That case asserts the OUTCOME; this asserts that the outcome comes from
    // one document and one provider rather than from two that happen to agree —
    // no remount, no second document, no entrance animation replaying on a view
    // change.
    //
    // ⚠ WHAT THIS CASE CANNOT SEE, MEASURED RATHER THAN ASSUMED, BECAUSE IT WAS
    // WRITTEN AFTER THE COMPONENT AND HAD TO EARN ITS PLACE. Guard-proofed twice:
    //   · Rewriting the source as `screen === 'rep' ? <PreviewFrame>…rep…' :
    //     <PreviewFrame>…login…` — a literal frame per surface — DID NOT MAKE IT
    //     FAIL. React reconciles two elements of the same type at the same
    //     position, so the DOM node and the provider are the same either way.
    //     That is not a hole: the two source shapes are behaviourally identical,
    //     and this case pins the behaviour rather than the spelling.
    //   · Giving those frames distinct `key`s — which DOES force a remount — made
    //     it RED with "the view change built a second frame". So the assertion
    //     can fail, and the failure it catches is the one that matters.
    // ⚠ RECORDED BECAUSE A GUARD-PROOF THAT DID NOT FIRE IS EVIDENCE ABOUT THE
    // GUARD, and a later reader repeating the first attempt would otherwise
    // conclude the case is vacuous and delete it.
    //
    // The LENGTH assertion is the independent half: an implementation that keeps
    // both surfaces mounted and hides one — the obvious "make switching instant"
    // shortcut — is invisible to the identity assertions and fails this one.
    render(<BrandingPreview formData={REP_DRAFT} />);
    await screen.findByText('Live Preview');
    await waitFor(() => expect(themeRoot()).toBeTruthy());

    const frameBefore = document.querySelector('iframe[data-preview-frame]');
    const providerBefore = themeRoot();

    fireEvent.click(screen.getByRole('button', { name: 'Rep app' }));
    await waitFor(() => expect(insideFrame('[data-rep-shell]')).toBeTruthy());

    expect(
      document.querySelectorAll('iframe[data-preview-frame]'),
      'more than one frame is mounted'
    ).toHaveLength(1);
    expect(
      document.querySelector('iframe[data-preview-frame]'),
      'the view change built a second frame'
    ).toBe(frameBefore);
    expect(
      themeRoot(),
      'the view change built a second provider — the mode is preserved by luck, not by structure'
    ).toBe(providerBefore);
  });
});
