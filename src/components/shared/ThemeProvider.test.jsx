// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b PHASE 1 STEP 4 — THE THEME PROVIDER
//
// THIS IS THE FIRST SURFACE IN THE PRODUCT TO MOUNT --rm-*. Everything C/DL-3a
// built — the derivation engine, the five brand tokens, the six status tokens and
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
import { RENDER_TOKEN_KEYS, deriveThemeTokens } from '../../utils/themeTokens';
import { STATUS_VARS, STATUS_LIGHT, STATUS_DARK } from '../../constants/statusTheme';
import { resolveBrandingTheme, BRANDING_THEME_DEFAULTS } from '../../utils/brandingTheme';
import { BRAND_HINT_STORAGE_KEY } from '../../utils/brandingChain';
import ThemeProvider, { ThemeContext, themeVariables, DEFAULT_THEME_MODE } from './ThemeProvider';
import { useContext } from 'react';

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
const EVERY_BRAND_VAR = RENDER_TOKEN_KEYS.map(k => `--rm-${k}`);
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
describe('themeVariables — the eleven custom properties', () => {

  it('emits every brand var and every status var, counted from the source of truth', () => {
    const vars = themeVariables(BRAND_A, 'light');

    expect(Object.keys(vars).sort()).toEqual([...EVERY_VAR].sort());
    expect(Object.keys(vars)).toHaveLength(RENDER_TOKEN_KEYS.length + Object.keys(STATUS_VARS).length);
  });

  it('the five brand vars carry deriveThemeTokens\' output for that mode', () => {
    for (const mode of ['light', 'dark']) {
      const tokens = deriveThemeTokens(BRAND_A, mode);
      const vars = themeVariables(BRAND_A, mode);
      for (const key of RENDER_TOKEN_KEYS) {
        expect(vars[`--rm-${key}`], `--rm-${key} in ${mode} mode`).toBe(tokens[key]);
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

  it('mounts all eleven variables on its own wrapper element', async () => {
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
