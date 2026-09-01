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

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
// LoginScreen, ChoiceScreen, FrozenAccountScreen, ResetPinScreen, RepShell
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

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c PHASE 1b — THE MODE READ PRESENTS EITHER TOKEN
//
// THE DEFECT THIS CLOSES. fetchThemeModeFromApi() read getReferrerToken() alone,
// so A FIELD REP'S STORED MODE COULD NEVER LOAD: a rep authenticates as a team
// member and their token is written to the ADMIN key, so the function returned
// null before making a request. The endpoint answers both subjects as of 1b —
// one store, both apps, CD-21 — and the client has to present both.
//
// ⚠ ASSERTED ON THE REQUEST, NOT ON THE RENDER. The real seam is which token
// leaves the browser; a test that only checked the resulting mode would pass
// against a provider that asked with the wrong credential and got null.
// ─────────────────────────────────────────────────────────────────────────────
describe('ThemeProvider — the stored-mode read presents either token', () => {
  const REFERRER_KEY = 'rb_token';
  const ADMIN_KEY = 'rb_admin_token';

  let seen;
  let realFetch;

  beforeEach(() => {
    seen = [];
    localStorage.clear();
    realFetch = global.fetch;
    global.fetch = async (url, init) => {
      if (String(url).includes('/api/preferences/theme-mode')) {
        seen.push(init?.headers?.Authorization ?? null);
        return { ok: true, json: async () => ({ mode: 'dark' }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
  });

  afterEach(() => { global.fetch = realFetch; localStorage.clear(); });

  async function boot() {
    render(<ThemeProvider context={makeContext()}><p>child</p></ThemeProvider>);
    await screen.findByText('child');
    await waitFor(() => expect(seen.length).toBeGreaterThan(0));
  }

  it('presents the ADMIN token when only a team member is signed in', async () => {
    // THE REP CASE, and the one that was broken.
    localStorage.setItem(ADMIN_KEY, 'rep-token');
    await boot();
    expect(seen[0]).toBe('Bearer rep-token');
  });

  it('presents the REFERRER token when only a referrer is signed in', async () => {
    localStorage.setItem(REFERRER_KEY, 'homeowner-token');
    await boot();
    expect(seen[0]).toBe('Bearer homeowner-token');
  });

  it('prefers the referrer token when a person holds both', async () => {
    // Dual identity is a designed condition in this codebase, not an anomaly —
    // the same email can exist in `users` and `team_members`. The tie-break is
    // stated in the function; this pins it so it cannot drift silently.
    localStorage.setItem(REFERRER_KEY, 'homeowner-token');
    localStorage.setItem(ADMIN_KEY, 'rep-token');
    await boot();
    expect(seen[0]).toBe('Bearer homeowner-token');
  });

  it('makes NO request at all when nobody is signed in', async () => {
    // The login screen is the common case and must not cost a round trip.
    render(<ThemeProvider context={makeContext()}><p>child</p></ThemeProvider>);
    await screen.findByText('child');
    expect(seen).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3c PHASE 3-A STEP 2 — RED SUITE — setMode ON ThemeContext
//
// THE GAP. ThemeContext publishes `{ mode, branding, source }` and NO SETTER, so
// `mode` is readable and nothing in the product can move it. The Profile toggle
// (A30) needs to, and PRE_LAUNCH_CHECKLIST.md's theme-control entry names this
// exact shape — add setMode to that value, "budget for it; do not discover it".
// This suite is that budget.
//
// ── ⚠ THE REFUSAL IS THE LOAD-BEARING HALF, AND IT IS NOT ABOUT SAFETY ──────
// `mode` resolves as `pinnedMode ?? storedMode ?? DEFAULT_THEME_MODE`, so with a
// pin present NOTHING setMode writes can ever surface. Danny ruled the setter
// REFUSES LOUDLY rather than no-opping, on the finding that pinning is TEST-ONLY:
// three production ThemeProvider mounts, all bare; eight pinning sites, all in
// this file and BrandLogo.test.jsx. So the refusal path is UNREACHABLE IN
// PRODUCTION BY CONSTRUCTION — its whole audience is a developer whose test pins
// the mode and then simulates a toggle.
//
// ⚠ WHICH IS EXACTLY WHY "IT DID NOT MOVE" IS NOT A SUFFICIENT ASSERTION. A
// silent no-op and a loud refusal are INDISTINGUISHABLE from the outside: both
// leave the mode where it was. The distinction IS the ruling, so the warning is
// asserted directly. Assert only the held mode and this suite would go green
// against a setter that quietly threw the call away — CLAUDE.md's "a plausible-
// looking rejection is not the rejection you are testing for", in a costume.
//
// ⚠ AND THE PAIRED POSITIVE CONTROL IS ORDERED FIRST, DELIBERATELY. "Pinned →
// refuses" is satisfied by a setMode that never works at all. The unpinned case
// on the SAME probe is the proof that the setter does something when it is
// allowed to — vacuity shape #10's repair, applied to a refusal instead of a
// flag.
//
// EXPECTED RED TODAY: the useMemo in ThemeLayer publishes three keys and
// `value.setMode` is undefined, so every case below fails on the setter's
// absence rather than on its behaviour.
// ─────────────────────────────────────────────────────────────────────────────
describe('ThemeProvider — setMode (C/DL-3c Phase 3-A)', () => {
  let warn;

  beforeEach(() => {
    // Captured rather than silenced-and-forgotten: the pinned case asserts on it.
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => { warn.mockRestore(); });

  // ONE probe for every case, so the positive control and the refusal are driven
  // through identical wiring. A refusal test with its own bespoke harness can
  // differ from the positive in some way nobody notices, which is how the pair
  // stops being a pair.
  //
  // `seen` collects the context value on every render — that is what makes the
  // identity-stability case observable without reaching into React internals.
  function Probe({ seen, next = 'dark' }) {
    const value = useContext(ThemeContext);
    seen.push(value);
    return (
      <>
        <button onClick={() => value.setMode(next)}>toggle</button>
        <span data-testid="probe-mode">{value.mode}</span>
      </>
    );
  }

  it('[RED] POSITIVE CONTROL — setMode moves the rendered mode when nothing is pinned', async () => {
    // ORDERED FIRST. Every other case below is satisfiable by a setter that does
    // nothing at all; this is the one that is not.
    const seen = [];
    render(
      <ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
        <Probe seen={seen} next="dark" />
      </ThemeProvider>
    );
    await screen.findByTestId('probe-mode');
    expect(themeRoot().dataset.rmTheme).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    // BOTH ENDS OF THE WIRE: the published `mode` and the mounted variables. The
    // context value could update while the wrapper's data attribute and its
    // status vars did not, and the surface is what a person sees.
    await waitFor(() => expect(themeRoot().dataset.rmTheme).toBe('dark'));
    expect(screen.getByTestId('probe-mode').textContent).toBe('dark');
    for (const [role, property] of Object.entries(STATUS_VARS)) {
      expect(themeRoot().style.getPropertyValue(property), `${property} after a dark setMode`)
        .toBe(STATUS_DARK[role]);
    }
  });

  it('[RED] ⚠ THE RULING — with mode PINNED, setMode refuses and SAYS SO', async () => {
    // THE LOAD-BEARING CASE. Two assertions, and neither is redundant:
    //   (1) the mode did not move — the refusal actually refused;
    //   (2) console.warn fired — it refused LOUDLY rather than silently.
    // Drop (2) and this passes against a setter that swallows the call, which is
    // the failure the ruling exists to prevent.
    const seen = [];
    const fetchStoredMode = vi.fn(async () => 'dark');
    render(
      <ThemeProvider context={makeContext()} fetchStoredMode={fetchStoredMode} mode="light">
        <Probe seen={seen} next="dark" />
      </ThemeProvider>
    );
    await screen.findByTestId('probe-mode');

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(themeRoot().dataset.rmTheme, 'a pinned provider must not follow setMode').toBe('light');
    expect(screen.getByTestId('probe-mode').textContent).toBe('light');

    // THE PIN PATH IS PROVEN, not assumed: a pinned provider skips the
    // preference read entirely, so a zero call count here is what says the mode
    // under test is the PIN rather than a stored value that happened to be light.
    expect(fetchStoredMode).not.toHaveBeenCalled();

    expect(warn, 'setMode refused silently — a silent no-op is the defect this ruling names')
      .toHaveBeenCalled();
    const said = warn.mock.calls.map(c => c.join(' ')).join('\n');
    // ANCHORED ON THE SURROUNDING PHRASE, NOT A BARE TOKEN. A needle of 'mode'
    // matches almost any message this provider could emit.
    expect(said).toMatch(/setMode/);
    expect(said, 'the warning must name the PIN as the cause, or it explains nothing')
      .toMatch(/pinn?ed/i);
  });

  it('[RED] the context value still exposes mode, branding and source unchanged', async () => {
    const seen = [];
    render(
      <ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
        <Probe seen={seen} />
      </ThemeProvider>
    );
    await screen.findByTestId('probe-mode');

    const value = seen[seen.length - 1];
    // EXACT KEY SET, not a containment check. This is the assertion that catches
    // a fourth key arriving that nobody meant to publish, as well as the three
    // existing ones going missing.
    expect(Object.keys(value).sort()).toEqual(['branding', 'mode', 'setMode', 'source']);
    expect(value.mode).toBe('light');
    expect(value.branding).toBeTruthy();
    expect(value.branding.companyName).toBe(NEUTRAL.companyName);
    expect(value).toHaveProperty('source');
  });

  it('[RED] setMode is IDENTITY-STABLE across a re-render that changes nothing', async () => {
    // ⚠ THE GUARD ON THE FIRST ASSERTION IS NOT DECORATION — WITHOUT IT THIS CASE
    // IS VACUOUS TODAY. `setMode` is undefined at HEAD, and Object.is(undefined,
    // undefined) is true, so the identity assertion alone would go GREEN against
    // a provider that publishes no setter at all. It has to be proven to be a
    // function before its identity means anything.
    //
    // WHY IT MATTERS: useBranding() reads this same context and has six-plus
    // referrer consumers. An unstable setter re-renders every one of them on
    // every ThemeLayer render.
    // ⚠ A FRESH ELEMENT EACH TIME, AND THE SAME PROP OBJECTS INSIDE IT. This
    // harness was wrong on its first draft and went red for a reason that had
    // nothing to do with setMode, which is worth recording because the wrong
    // version LOOKS more correct: passing one `tree` element to both render()
    // and rerender() makes React bail out on element identity, so nothing
    // re-rendered at all and `seen` never grew. A re-render test that does not
    // re-render is the "mechanism reporting health it cannot observe" shape.
    //
    // `context` and `fetchStoredMode` are hoisted so the PROPS are identical
    // across the two renders — otherwise BrandingProvider would re-resolve and
    // `branding` would change identity, which would move `value` legitimately
    // and prove nothing about the setter.
    const seen = [];
    const context = makeContext();
    const fetchStoredMode = async () => null;
    const tree = () => (
      <ThemeProvider context={context} fetchStoredMode={fetchStoredMode}>
        <Probe seen={seen} />
      </ThemeProvider>
    );
    const { rerender } = render(tree());
    await screen.findByTestId('probe-mode');

    const before = seen[seen.length - 1];
    expect(typeof before.setMode, 'setMode is not a function — the identity check below would be vacuous')
      .toBe('function');

    const countBefore = seen.length;
    rerender(tree());
    await waitFor(() => expect(seen.length).toBeGreaterThan(countBefore));

    const after = seen[seen.length - 1];
    expect(after.mode).toBe(before.mode);
    expect(Object.is(after.setMode, before.setMode), 'setMode changed identity on a no-op re-render')
      .toBe(true);
    // THE WHOLE VALUE, NOT ONLY THE SETTER. If setMode were rebuilt per render
    // it would rebuild `value` with it — this is the same fact observed one
    // level up, and it is what the six-plus useBranding() consumers actually
    // depend on.
    expect(Object.is(after, before), 'the context value changed identity on a no-op re-render')
      .toBe(true);
  });

  it('[RED] setMode REFUSES a mode that is not light or dark, and says so', async () => {
    // NOT IN THE STEP BRIEF — added here with its reason, because this setter is
    // a new way to blank the app and shipping it unguarded would be introducing
    // the hazard in the same commit as the feature.
    //
    // themeVariables THROWS on an unknown mode by design, precisely so a bad mode
    // cannot silently paint a dark-mode user a white surface. So an unknown mode
    // would not degrade — it would take the whole tree to the ErrorBoundary. The
    // GET path already filters to the two known modes and the PUT endpoint
    // validates strictly; this is the third gate on the same value, on the one
    // path that had none.
    const seen = [];
    render(
      <ThemeProvider context={makeContext()} fetchStoredMode={async () => null}>
        <Probe seen={seen} next="sideways" />
      </ThemeProvider>
    );
    await screen.findByTestId('probe-mode');

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'toggle' })))
      .not.toThrow();

    expect(themeRoot().dataset.rmTheme).toBe('light');
    expect(warn, 'an unknown mode was accepted or dropped silently').toHaveBeenCalled();
    expect(warn.mock.calls.map(c => c.join(' ')).join('\n')).toMatch(/setMode/);
  });

  it('the CONTEXT DEFAULT publishes a setMode that complains instead of no-opping', async () => {
    // ⚠ NOT IN THE STEP BRIEF EITHER, AND IT IS THE OTHER HALF OF THE SAME
    // DECISION. Adding a key to a context that HAS a default is a choice about
    // the default whichever way it goes, and an untested one would be a code
    // path published in the same commit that created it.
    //
    // ThemeContext keeps a default deliberately (useBranding()'s totality
    // contract). Omitting setMode there would leave it undefined outside the
    // provider, so a toggle would render and then throw inside an onClick.
    // A SILENT default would be vacuity shape #10; this one talks, which is
    // what makes a missing provider visible rather than safe-looking.
    //
    // MOUNTED WITH NO PROVIDER ANYWHERE — that is the state under test, and it
    // is the same shape BrandingProvider.test.jsx uses for its Ruling 5 sibling.
    const seen = [];
    render(<Probe seen={seen} next="dark" />);
    await screen.findByTestId('probe-mode');

    expect(typeof seen[seen.length - 1].setMode).toBe('function');
    expect(screen.getByTestId('probe-mode').textContent).toBe(DEFAULT_THEME_MODE);

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(warn, 'the default setMode swallowed the call').toHaveBeenCalled();
    const said = warn.mock.calls.map(c => c.join(' ')).join('\n');
    expect(said).toMatch(/setMode/);
    expect(said, 'the warning must name the missing provider as the cause')
      .toMatch(/outside a themeprovider/i);
    // Nothing to change and nothing changed: the default holds its own mode.
    expect(screen.getByTestId('probe-mode').textContent).toBe(DEFAULT_THEME_MODE);
  });
});
