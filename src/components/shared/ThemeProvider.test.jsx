// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b PHASE 1 STEP 4 — THE THEME PROVIDER
//
// THIS IS THE FIRST SURFACE IN THE PRODUCT TO MOUNT --rm-*. Everything C/DL-3a
// built — the derivation engine, the brand tokens, the status tokens and
// every primitive that declares var(--rm-X, fallback) — has been inert until now.
// The moment this provider mounts, all of it becomes visible at once.
//
// ⚠ WHAT THIS SUITE CAN AND CANNOT PROVE. jsdom DOES NOT RESOLVE var(), so no
// test here proves a RENDERED COLOUR — the same limitation uiStatePrimitives.
// test.jsx:10-32 documents at length. What it proves is that the right property
// NAMES carry the right VALUES on an element the primitives sit inside. The
// rendered-colour proof is the real-browser check in Step 5, which the theme
// system has owed since 3a Phase 3.
//
// ── THE TEST THAT MATTERS MOST IS THE ISOLATION ONE ─────────────────────────
// Ruling 5 scopes the mount to the provider's OWN WRAPPER ELEMENT rather than
// :root. That is not a style preference — it is what keeps the admin panel
// working. LockedSection lives on the dark admin panel and reads
// var(--rm-bg, #012854) for its permission scrim. Mount --rm-bg globally in light
// mode and that navy scrim becomes a WHITE veil over blurred locked content.
// AdminPanel renders outside this provider precisely so that cannot happen, and
// 'mounts nothing on document.documentElement' is the assertion that keeps it
// true. It is guard-proofed in Step 4 by moving the mount to :root and watching
// it go red.
//
// NO HARDCODED VARIABLE COUNTS ANYWHERE IN THIS FILE. Every count is derived from
// RENDER_TOKEN_KEYS and STATUS_VARS, so adding a token cannot leave a stale count
// behind — the spec prose already drifted this way once (it says four status vars;
// STATUS_VARS has six).
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RENDER_TOKEN_KEYS, RENDER_TOKEN_VARS, deriveThemeTokens, contrastRatio, TEXT_CONTRAST_MIN } from '../../utils/themeTokens.mjs';
import { STATUS_VARS, STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';
import { resolveBrandingTheme, BRANDING_THEME_DEFAULTS } from '../../utils/brandingTheme.mjs';
import { BRAND_HINT_STORAGE_KEY } from '../../utils/brandingChain';
import ThemeProvider, { ThemeContext, themeVariables, DEFAULT_THEME_MODE } from './ThemeProvider';
import { useContext } from 'react';

// jsdom reports a literal inline colour as rgb(...). Derived from the token
// rather than retyped, so the expectation cannot drift from the emitted value.
function cssColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

const SLUG_A = 'alpharoofing';
const APEX = 'roofmiles.com';
const APP_HOST = `app.${APEX}`;

const BRAND_A = Object.freeze(resolveBrandingTheme({
  contractor_name: 'Alpha Roofing Co',
  primary_color: '#AA1111',
  secondary_color: '#AA2222',
  accent_color: '#AA4444',
  landing_bg_color: '#AA3333',
}));

const NEUTRAL = Object.freeze(resolveBrandingTheme(null));

// Every custom property the provider is contractually required to mount, built
// FROM the two source-of-truth exports rather than written out. If either grows,
// this grows with it.
const EVERY_BRAND_VAR = Object.values(RENDER_TOKEN_VARS);
const EVERY_STATUS_VAR = Object.values(STATUS_VARS);
const EVERY_VAR = [...EVERY_BRAND_VAR, ...EVERY_STATUS_VAR];

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

function makeContext({ hostname = APP_HOST, search = '', table = {} } = {}) {
  return {
    hostname,
    search,
    storage: makeStorage(),
    fetchBranding: vi.fn(async slug => (table[slug] ? { ...table[slug] } : { ...NEUTRAL })),
    session: null,
  };
}

// The provider's wrapper — the single element that carries the variables.
function themeRoot() {
  return document.querySelector('[data-rm-theme]');
}

// Reads the --rm-* properties actually set on an element's own inline style.
function mountedVars(el) {
  const out = {};
  for (const name of EVERY_VAR) {
    const value = el.style.getPropertyValue(name);
    if (value !== '') out[name] = value;
  }
  return out;
}

afterEach(() => {
  // Leave documentElement exactly as found — the isolation tests depend on it.
  for (const name of EVERY_VAR) document.documentElement.style.removeProperty(name);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('themeVariables — every mounted custom property', () => {

  it('emits every brand var and every status var, counted from the source of truth', () => {
    const vars = themeVariables(BRAND_A, 'light');

    expect(Object.keys(vars).sort()).toEqual([...EVERY_VAR].sort());
    expect(Object.keys(vars)).toHaveLength(RENDER_TOKEN_KEYS.length + Object.keys(STATUS_VARS).length);
  });

  it('the brand vars carry deriveThemeTokens\' output for that mode', () => {
    for (const mode of ['light', 'dark']) {
      const tokens = deriveThemeTokens(BRAND_A, mode);
      const vars = themeVariables(BRAND_A, mode);
      for (const key of RENDER_TOKEN_KEYS) {
        expect(vars[RENDER_TOKEN_VARS[key]], `${RENDER_TOKEN_VARS[key]} in ${mode} mode`).toBe(tokens[key]);
      }
    }
  });

  it('light mode carries STATUS_LIGHT values', () => {
    const vars = themeVariables(BRAND_A, 'light');
    for (const [role, property] of Object.entries(STATUS_VARS)) {
      expect(vars[property], `${property} in light mode`).toBe(STATUS_LIGHT[role]);
    }
  });

  it('dark mode carries STATUS_DARK values', () => {
    // ⚠ THE BINDING CARRY-FORWARD FROM 3a §8. Mount only the brand vars and every
    // 3a primitive silently keeps its LIGHT status fallback in dark mode —
    // readable, and wrong. This is the assertion that stops that shipping.
    const vars = themeVariables(BRAND_A, 'dark');
    for (const [role, property] of Object.entries(STATUS_VARS)) {
      expect(vars[property], `${property} in dark mode`).toBe(STATUS_DARK[role]);
    }
  });

  it('the two status palettes genuinely differ, so the mode split is doing work', () => {
    // Guards against a copy-paste that pointed both modes at the same table: every
    // assertion above would still pass and dark mode would be silently wrong.
    const light = themeVariables(BRAND_A, 'light');
    const dark = themeVariables(BRAND_A, 'dark');
    const differing = Object.values(STATUS_VARS).filter(p => light[p] !== dark[p]);

    expect(differing.length, 'no status var differs between modes — the palettes are the same table')
      .toBeGreaterThan(0);
  });

  it('STATUS_VARS, STATUS_LIGHT and STATUS_DARK cover the same roles', () => {
    // The drift this file's status loop guards against, asserted directly against
    // the real constants rather than through a contrived throw.
    for (const role of Object.keys(STATUS_VARS)) {
      expect(STATUS_LIGHT[role], `STATUS_LIGHT is missing '${role}'`).toBeTruthy();
      expect(STATUS_DARK[role], `STATUS_DARK is missing '${role}'`).toBeTruthy();
    }
  });

  it('THROWS on an unknown mode rather than returning something renderable', () => {
    // A silently-defaulted mode paints a dark-mode user a white surface and logs
    // nothing anywhere — the exact failure deriveThemeTokens refuses.
    expect(() => themeVariables(BRAND_A, 'sideways')).toThrow(/mode/i);
    expect(() => themeVariables(BRAND_A, undefined)).toThrow(/mode/i);
  });

  it('falls back to the platform palette for an unusable brand rather than throwing', () => {
    // normalizeBrand's documented contract: a throw here is an unstyled surface.
    const vars = themeVariables(null, 'light');
    expect(vars['--rm-primary']).toBe(BRANDING_THEME_DEFAULTS.primaryColor);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ThemeProvider — mounting', () => {

  it('mounts every variable on its own wrapper element', async () => {
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);

    await screen.findByText('child');
    const root = themeRoot();
    expect(root, 'the provider rendered no wrapper element').toBeTruthy();

    const mounted = mountedVars(root);
    expect(Object.keys(mounted).sort()).toEqual([...EVERY_VAR].sort());
  });

  it('renders its children', async () => {
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
      <p>child content</p>
    </ThemeProvider>);
    expect(await screen.findByText('child content')).toBeTruthy();
  });

  it('the wrapper generates no layout box, so it cannot disturb the tree it wraps', () => {
    // display:contents. The provider exists to carry variables, not to add a div
    // to every screen's layout — Screen.jsx's overflow behaviour is documented as
    // intentional and must not acquire a new ancestor box.
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);
    expect(themeRoot().style.display).toBe('contents');
  });

  // ── RULING 5 — ISOLATION. THE TEST THAT PROTECTS THE ADMIN PANEL ───────────
  it('mounts NOTHING on document.documentElement', async () => {
    render(<ThemeProvider context={makeContext({ search: `?brand=${SLUG_A}`, table: { [SLUG_A]: BRAND_A } })}
      fetchStoredMode={async () => 'dark'}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    for (const name of EVERY_VAR) {
      expect(document.documentElement.style.getPropertyValue(name),
        `${name} leaked onto :root — AdminPanel renders outside this provider and would repaint`).toBe('');
    }
  });

  it('mounts NOTHING on document.body either', async () => {
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    for (const name of EVERY_VAR) {
      expect(document.body.style.getPropertyValue(name), `${name} leaked onto body`).toBe('');
    }
  });

  it('a sibling rendered outside the provider inherits no --rm-* value', async () => {
    // The structural statement of Ruling 5: AdminPanel is that sibling.
    render(
      <div>
        <ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
          <p>inside</p>
        </ThemeProvider>
        <p data-testid="outside">outside</p>
      </div>
    );
    await screen.findByText('inside');

    const outside = screen.getByTestId('outside');
    for (const name of EVERY_VAR) {
      expect(getComputedStyle(outside).getPropertyValue(name),
        `${name} reached a node outside the provider`).toBe('');
    }
  });

  it('a child INSIDE the provider does sit in the cascade scope', async () => {
    // The other half of the scoping proof: scoped, but not so scoped it is inert.
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
      <p data-testid="inside">inside</p>
    </ThemeProvider>);
    await screen.findByTestId('inside');

    const inside = screen.getByTestId('inside');
    for (const name of EVERY_VAR) {
      expect(getComputedStyle(inside).getPropertyValue(name),
        `${name} is not visible to a child of the provider`).not.toBe('');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ThemeProvider — mode', () => {

  it('defaults to LIGHT when nothing is stored (spec D8)', async () => {
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    expect(DEFAULT_THEME_MODE).toBe('light');
    expect(themeRoot().dataset.rmTheme).toBe('light');
    for (const [role, property] of Object.entries(STATUS_VARS)) {
      expect(themeRoot().style.getPropertyValue(property)).toBe(STATUS_LIGHT[role]);
    }
  });

  it('honours a stored dark preference when a session exists', async () => {
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => 'dark'}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    await waitFor(() => expect(themeRoot().dataset.rmTheme).toBe('dark'));
    for (const [role, property] of Object.entries(STATUS_VARS)) {
      expect(themeRoot().style.getPropertyValue(property), `${property} in stored dark mode`)
        .toBe(STATUS_DARK[role]);
    }
  });

  it('stays light when the preference read fails', async () => {
    // A preference lookup must never be able to leave the app unstyled or stuck.
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => { throw new Error('offline'); }}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    expect(themeRoot().dataset.rmTheme).toBe('light');
  });

  it('does not consult the preference store when mode is pinned by prop', async () => {
    const fetchStoredMode = vi.fn(async () => 'dark');
    render(<ThemeProvider context={makeContext()} fetchStoredMode={fetchStoredMode} mode="light">
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    expect(themeRoot().dataset.rmTheme).toBe('light');
    expect(fetchStoredMode).not.toHaveBeenCalled();
  });

  it('THROWS on a malformed pinned mode rather than rendering something wrong', () => {
    // React surfaces the throw from render; the alternative is a silently white
    // surface for a dark-mode user with nothing logged anywhere.
    expect(() => render(
      <ThemeProvider context={makeContext()} fetchStoredMode={async () => null} mode="sideways">
        <p>child</p>
      </ThemeProvider>
    )).toThrow(/mode/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ThemeProvider — branding resolution', () => {

  it('paints the resolved contractor\'s palette, not the platform\'s', async () => {
    render(<ThemeProvider
      context={makeContext({ search: `?brand=${SLUG_A}`, table: { [SLUG_A]: BRAND_A } })}
      fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    await waitFor(() =>
      expect(themeRoot().style.getPropertyValue('--rm-primary')).toBe(BRAND_A.primaryColor));
    expect(themeRoot().style.getPropertyValue('--rm-primary')).not.toBe(BRANDING_THEME_DEFAULTS.primaryColor);
  });

  it('falls back to the neutral palette when nothing resolves', async () => {
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    await waitFor(() =>
      expect(themeRoot().style.getPropertyValue('--rm-primary')).toBe(BRANDING_THEME_DEFAULTS.primaryColor));
  });

  it('renders styled immediately rather than blocking on the chain', () => {
    // NO GATE, DELIBERATELY. Resolution is async; withholding the tree until it
    // finishes would put a blank frame in front of every visitor to save a repaint
    // for some of them. The provider starts neutral-and-light and updates in place.
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);

    const root = themeRoot();
    expect(root).toBeTruthy();
    expect(Object.keys(mountedVars(root)).sort()).toEqual([...EVERY_VAR].sort());
  });

  it('write-through reaches the storage the context supplied', async () => {
    const context = makeContext({ search: `?brand=${SLUG_A}`, table: { [SLUG_A]: BRAND_A } });
    render(<ThemeProvider context={context} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    await waitFor(() => expect(context.storage.getItem(BRAND_HINT_STORAGE_KEY)).toBe(SLUG_A));
  });

  it('survives the chain failing outright', async () => {
    const broken = { ...makeContext(), fetchBranding: async () => { throw new Error('boom'); } };
    render(<ThemeProvider context={broken} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);

    expect(await screen.findByText('child')).toBeTruthy();
    expect(themeRoot().style.getPropertyValue('--rm-primary')).toBe(BRANDING_THEME_DEFAULTS.primaryColor);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ThemeContext — the second createContext in src/', () => {

  function Probe() {
    const theme = useContext(ThemeContext);
    return <span data-testid="probe">{`${theme.mode}|${theme.branding?.companyName}|${theme.source}`}</span>;
  }

  it('exposes mode, branding and the resolving source to consumers', async () => {
    render(<ThemeProvider
      context={makeContext({ search: `?brand=${SLUG_A}`, table: { [SLUG_A]: BRAND_A } })}
      fetchStoredMode={async () => 'dark'}>
      <Probe />
    </ThemeProvider>);

    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent).toBe(`dark|${BRAND_A.companyName}|url`));
  });

  it('the context carries no tenancy-bearing field (CD-24 R1)', async () => {
    let captured = null;
    function Capture() {
      captured = useContext(ThemeContext);
      return <span>captured</span>;
    }
    render(<ThemeProvider
      context={makeContext({ search: `?brand=${SLUG_A}`, table: { [SLUG_A]: BRAND_A } })}
      fetchStoredMode={async () => null}>
      <Capture />
    </ThemeProvider>);
    await screen.findByText('captured');

    await waitFor(() => expect(captured.branding.companyName).toBe(BRAND_A.companyName));
    expect('contractorId' in captured.branding).toBe(false);
    expect('contractor_id' in captured.branding).toBe(false);
    expect('slug' in captured.branding).toBe(false);
    expect(JSON.stringify(captured.branding).includes(SLUG_A)).toBe(false);
  });
});

// ── C/DL-3c PHASE 1a — THE onPrimary PAIR ──────────────────────────────────
//
// ⚠ THIS IS THE ONE COLOUR CLAIM THIS SUITE CAN ACTUALLY PROVE, and it is worth
// being precise about why, because the file header says no test here proves a
// rendered colour and that remains true.
//
// The limitation is that jsdom never RESOLVES var(), so a test cannot learn
// what colour a component ends up painted. But --rm-primary and
// --rm-on-primary are both mounted as literal hex strings on one element, and
// the contrast between two hex strings is arithmetic. So this proves the
// RELATIONSHIP between the two mounted values — which is the entire content of
// Ruling 1 — without proving that any button reads them.
//
// WHAT STILL NEEDS EYES, stated here so the gap is not mistaken for coverage:
// that the Sign In button actually picks the property up, that the two
// together look like a primary action rather than a warning, and that the
// fallback pair paints correctly with no provider mounted. Phase 1c.
describe('C/DL-3c Phase 1a — the onPrimary pair is legible as mounted', () => {

  it('mounts --rm-on-primary at AA or better against the --rm-primary beside it', async () => {
    for (const [label, brand] of [['brand A', BRAND_A], ['neutral', NEUTRAL]]) {
      for (const mode of ['light', 'dark']) {
        const vars = themeVariables(brand, mode);
        const primary = vars[RENDER_TOKEN_VARS.primary];
        const onPrimary = vars[RENDER_TOKEN_VARS.onPrimary];

        // Both must be real hex, or contrastRatio would throw and the failure
        // would read as a maths problem rather than a missing property.
        expect(primary, `${label}/${mode}: --rm-primary`).toMatch(/^#[0-9A-F]{6}$/i);
        expect(onPrimary, `${label}/${mode}: --rm-on-primary`).toMatch(/^#[0-9A-F]{6}$/i);

        const ratio = contrastRatio(onPrimary, primary);
        expect(
          ratio,
          `${label}/${mode}: ${onPrimary} on ${primary} is ${ratio.toFixed(2)}:1, below AA`
        ).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN);
      }
    }
  });

  it('carries the pair through a real mount, not only through themeVariables()', async () => {
    // themeVariables() is a pure function and the tests above call it directly.
    // THAT IS NOT THE SAME CLAIM as "the provider mounts it": a token could be
    // computed correctly and dropped on the way to the element, which is the
    // shape of every silent-failure defect this file's header describes.
    render(<ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    const root = themeRoot();
    const primary = root.style.getPropertyValue(RENDER_TOKEN_VARS.primary).trim();
    const onPrimary = root.style.getPropertyValue(RENDER_TOKEN_VARS.onPrimary).trim();

    expect(onPrimary, '--rm-on-primary never reached the wrapper element').not.toBe('');
    expect(contrastRatio(onPrimary, primary)).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN);
  });

  it('answers differently for two brands, so the mounted value is derived', async () => {
    // NON-VACUITY. Every assertion above is satisfied by a provider that mounts
    // a constant #000000 for every contractor — black clears AA against most
    // fills, so a hardcoded token would look correct here and be wrong on the
    // first brand whose primary is dark. These two palettes disagree, and the
    // disagreement is the proof the value is computed per brand.
    const dark = themeVariables(
      { primaryColor: '#101820', secondaryColor: '#1C2D4D', backgroundColor: '#FFFFFF' }, 'light'
    );
    const light = themeVariables(
      { primaryColor: '#FFF176', secondaryColor: '#333333', backgroundColor: '#FFFFFF' }, 'light'
    );

    expect(dark[RENDER_TOKEN_VARS.onPrimary]).toBe('#FFFFFF');
    expect(light[RENDER_TOKEN_VARS.onPrimary]).toBe('#000000');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c PHASE 1a — RULING 4 — THE PAGE BACKGROUND FOLLOWS THE THEME
//
// THE DEFECT. useReferrerFonts() in App.jsx set document.body.style.background
// to R.bgPage — a hardcoded literal from the light-only R palette, written by a
// FONT LOADER. body sits above this provider's wrapper element, so var(--rm-bg)
// cannot resolve there and the page ground could never follow the theme.
//
// ⚠ WHAT THIS FIX IS AND IS NOT, RECORDED BECAUSE THE ENTRY IT CLOSES OVERSTATED
// IT. The pre-launch item bills this as "latent today and the first thing anyone
// sees the moment the toggle lands." That is FALSE. Every themed surface —
// LoginScreen, ChoiceScreen, FrozenAccountScreen, ResetPinScreen, RepPlaceholder
// — paints its own minHeight:100vh canvas from var(--rm-bg), so body is covered
// on all five. The only place it shows through is the referrer app's desktop
// gutters beside the 430px column, and the referrer app is held in light mode
// (CD-21). So this is correct, worth making, and INVISIBLE TODAY.
//
// The line that would have made the billing true is Screen.jsx's own hardcoded
// R.bgPage, which is referrer-tree-only and belongs to the R/AD migration.
//
// ⚠ THE UNMOUNT RESTORE IS TESTED, NOT ONLY THE SET. An effect that sets a
// global and never restores it looks identical for as long as the provider is
// mounted — which is always, in production and in most tests. It is only
// distinguishable at teardown, so that is where it is asserted.
// ─────────────────────────────────────────────────────────────────────────────
describe('ThemeProvider — the page background (Ruling 4)', () => {
  const SENTINEL = 'rgb(1, 2, 3)';

  beforeEach(() => {
    // A known prior value, so "restored" is distinguishable from "cleared" —
    // an effect that resets to '' would pass a naive check against the default.
    document.body.style.background = SENTINEL;
  });

  it('paints document.body from the derived bg token', async () => {
    const expected = deriveThemeTokens(NEUTRAL, 'light').bg;

    render(<ThemeProvider mode="light" context={makeContext()} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    expect(document.body.style.background).toBe(cssColor(expected));
  });

  it('follows the MODE, not just the brand', async () => {
    // NON-VACUITY: the two modes must produce different grounds, or "body
    // follows the theme" is satisfied by a constant. Asserted as a difference
    // first, so a derivation that ignored mode fails here rather than in the
    // value check below.
    const light = deriveThemeTokens(NEUTRAL, 'light').bg;
    const dark = deriveThemeTokens(NEUTRAL, 'dark').bg;
    expect(dark, 'the two modes derive the same bg — this test proves nothing').not.toBe(light);

    const { unmount } = render(<ThemeProvider mode="dark" context={makeContext()} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    expect(document.body.style.background).toBe(cssColor(dark));
    unmount();
  });

  it('RESTORES the previous background when it unmounts', async () => {
    const { unmount } = render(<ThemeProvider mode="dark" context={makeContext()} fetchStoredMode={async () => null}>
      <p>child</p>
    </ThemeProvider>);
    await screen.findByText('child');

    // Precondition: it actually changed something. Without this the restore
    // assertion below passes against a provider that never wrote at all.
    expect(document.body.style.background).not.toBe(SENTINEL);

    unmount();
    expect(document.body.style.background, 'the provider left the page ground behind it').toBe(SENTINEL);
  });

  it('App.jsx no longer writes a hardcoded page background', () => {
    // SCOPE FENCE on the half this suite cannot reach by rendering. The write
    // has to be GONE from useReferrerFonts, not merely overridden later — two
    // writers racing on one global is the state this replaces.
    //
    // A source assertion alone would be vacuity shape 6 (a sweep proves a string
    // is absent and nothing about whether the file still runs). It is not alone:
    // App.jsx is mounted by seven existing suites — bootRehydration,
    // deepLinkSurvival, EmailVerifyScreen, resetSurfaceRoleBlind, roleRouting,
    // tenantIdentity and App.test.jsx — so a broken App fails the gate loudly.
    const source = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');

    expect(source).not.toMatch(/document\.body\.style\.background/);
    expect(source).not.toMatch(/R\.bgPage/);
  });
});
