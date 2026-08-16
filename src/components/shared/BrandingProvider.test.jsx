// ─────────────────────────────────────────────────────────────────────────────
// ADMIN BRAND RETIREMENT — PHASE 2A — THE PROVIDER SEAM
//
// D-H splits branding delivery in two. `BrandingProvider` owns { branding,
// source } and NOTHING ELSE: no DOM element, no CSS custom property.
// `ThemeProvider` consumes it and adds `mode` plus the eleven --rm-* variables
// on its own wrapper. The admin panel will mount BrandingProvider alone (Phase
// 2B), and Ruling 5 is then preserved STRUCTURALLY — the admin branch cannot
// acquire --rm-* because the provider it mounts has no code path that emits one.
//
// ── WHY THE HOOK THROWS, AND WHY THAT IS THE POINT ─────────────────────────
// ThemeContext was given a real default value (ThemeProvider.jsx:149-153), so
// calling useBranding() outside it returns NEUTRAL_BRANDING silently. Broken
// wiring and a genuinely unbranded contractor are then INDISTINGUISHABLE, and a
// literal sweep asserting "no Accent string survives" passes in both cases —
// CLAUDE.md vacuity shape #2, an assertion against a state that cannot display
// the value. AdminBrandingContext therefore uses createContext(undefined) and
// its hook throws.
//
// The first test below asserts on the THROW, not on a rendered fallback. If it
// is ever weakened to "renders neutral", it becomes the exact defect it exists
// to prevent.
//
// ⚠ THIS FILE MOUNTS NO ThemeProvider ANYWHERE, deliberately. Its Ruling 5 test
// is the sibling of ThemeProvider.test.jsx's documentElement assertion, and it
// proves the opposite direction: that one is "the variables do not escape the
// provider", this one is "this provider has no variables to escape".
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, waitFor } from '@testing-library/react';
import { RENDER_TOKEN_KEYS } from '../../utils/themeTokens.mjs';
import { STATUS_VARS } from '../../constants/statusTheme';
import { resolveBrandingTheme } from '../../utils/brandingTheme.mjs';
import BrandingProvider, { AdminBrandingContext, useAdminBranding } from './BrandingProvider';
import { useContext } from 'react';

const SLUG = 'gammaroofing';
const APP_HOST = 'app.roofmiles.com';

// A fixture contractor whose every value differs from the neutral platform set,
// so "returns the contractor" and "returns neutral" are two DISTINGUISHABLE
// states rather than one state that happens to read correctly.
const BRAND = Object.freeze(resolveBrandingTheme({
  contractor_name: 'Gamma Roofing LLC',
  program_name: 'Gamma Rewards',
  primary_color: '#CC7711',
  secondary_color: '#CC7722',
  accent_color: '#CC7744',
  landing_bg_color: '#CC7733',
}));

const NEUTRAL = Object.freeze(resolveBrandingTheme(null));

// Same eleven property names ThemeProvider is contractually required to mount,
// built FROM the source-of-truth exports rather than written out — so if either
// list grows, the "emits none of them" assertion grows with it.
const EVERY_VAR = [
  ...RENDER_TOKEN_KEYS.map(k => `--rm-${k}`),
  ...Object.values(STATUS_VARS),
];

function makeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

function makeContext({ search = '', table = {} } = {}) {
  return {
    hostname: APP_HOST,
    search,
    storage: makeStorage(),
    fetchBranding: vi.fn(async slug => (table[slug] ? { ...table[slug] } : { ...NEUTRAL })),
    session: null,
  };
}

afterEach(() => {
  for (const name of EVERY_VAR) {
    document.documentElement.style.removeProperty(name);
    document.body.style.removeProperty(name);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('useAdminBranding — the hook THROWS outside its provider (D-H)', () => {

  function Consumer() {
    const { branding } = useAdminBranding();
    return <span data-testid="consumer">{branding.companyName}</span>;
  }

  it('THROWS when read with no provider above it, rather than rendering neutral', () => {
    // ⚠ THE ASSERTION IS ON THE THROW. A silently-neutral read is the D-H failure
    // mode itself: an admin panel showing the platform's identity because the
    // wiring broke looks identical to one showing it because the contractor has
    // set no logo. Only one of those is a bug, and nothing would say which.
    //
    // React logs the caught render error to console.error; that noise is expected
    // and is not what is being asserted.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<Consumer />)).toThrow(/BrandingProvider/);
    } finally {
      spy.mockRestore();
    }
  });

  it('the raw context default is undefined, which is WHAT MAKES the throw possible', () => {
    // Guards the mechanism rather than the symptom. Give AdminBrandingContext any
    // default object and the hook above can no longer distinguish "outside the
    // provider" from "inside a provider that resolved to that object" — the throw
    // would become unreachable and the test above would go vacuously green in the
    // one direction that matters.
    let captured = 'not-read';
    function Peek() {
      captured = useContext(AdminBrandingContext);
      return <span>peeked</span>;
    }
    render(<Peek />);
    expect(captured).toBeUndefined();
  });

  it('does NOT throw when mounted inside the provider', () => {
    // The other half: scoped, but not so scoped it is unusable.
    render(<BrandingProvider context={makeContext()}><Consumer /></BrandingProvider>);
    expect(screen.getByTestId('consumer')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BrandingProvider — supplies the RESOLVED contractor, not neutral defaults', () => {

  function Probe() {
    const { branding, source } = useAdminBranding();
    return <span data-testid="probe">{`${branding.companyName}|${branding.programName}|${source}`}</span>;
  }

  it('resolves a real contractor through the D4 chain and publishes it', async () => {
    render(
      <BrandingProvider context={makeContext({ search: `?brand=${SLUG}`, table: { [SLUG]: BRAND } })}>
        <Probe />
      </BrandingProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent)
        .toBe(`${BRAND.companyName}|${BRAND.programName}|url`));
  });

  it('the resolved value is DISTINGUISHABLE from the neutral one it started at', async () => {
    // Non-vacuity for the test above. If the fixture happened to match the platform
    // defaults, "publishes the contractor" and "published nothing at all" would be
    // the same assertion — CLAUDE.md's two-distinguishable-states rule.
    expect(BRAND.companyName).not.toBe(NEUTRAL.companyName);
    expect(BRAND.primaryColor).not.toBe(NEUTRAL.primaryColor);

    render(
      <BrandingProvider context={makeContext({ search: `?brand=${SLUG}`, table: { [SLUG]: BRAND } })}>
        <Probe />
      </BrandingProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('probe').textContent).toContain(BRAND.companyName));
    expect(screen.getByTestId('probe').textContent).not.toContain(NEUTRAL.companyName);
  });

  it('starts neutral and renders children IMMEDIATELY rather than blocking on the chain', () => {
    // Carried over from ThemeProvider's contract: resolution is async, and
    // withholding the tree until it finishes puts a blank frame in front of every
    // visitor to save a repaint for some of them. Synchronous — no await.
    render(<BrandingProvider context={makeContext()}><Probe /></BrandingProvider>);
    expect(screen.getByTestId('probe').textContent).toContain(NEUTRAL.companyName);
  });

  it('survives the chain failing outright, keeping the neutral defaults', async () => {
    const broken = { ...makeContext(), fetchBranding: async () => { throw new Error('boom'); } };
    render(<BrandingProvider context={broken}><Probe /></BrandingProvider>);
    expect(await screen.findByTestId('probe')).toBeTruthy();
    expect(screen.getByTestId('probe').textContent).toContain(NEUTRAL.companyName);
  });

  it('carries no tenancy-bearing field (CD-24 R1)', async () => {
    let captured = null;
    function Capture() {
      captured = useAdminBranding();
      return <span>captured</span>;
    }
    render(
      <BrandingProvider context={makeContext({ search: `?brand=${SLUG}`, table: { [SLUG]: BRAND } })}>
        <Capture />
      </BrandingProvider>
    );
    await screen.findByText('captured');
    await waitFor(() => expect(captured.branding.companyName).toBe(BRAND.companyName));

    expect('contractorId' in captured.branding).toBe(false);
    expect('contractor_id' in captured.branding).toBe(false);
    expect('slug' in captured.branding).toBe(false);
    expect(JSON.stringify(captured.branding).includes(SLUG)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BrandingProvider — RULING 5 holds on the admin tree', () => {

  // The provider is about to become the ONLY thing the admin panel mounts. If it
  // could emit a single --rm-*, LockedSection's permission scrim would read
  // var(--rm-bg) instead of its #012854 fallback and a navy veil over blurred,
  // permission-gated content would turn WHITE in light mode. Sibling to
  // ThemeProvider.test.jsx's 'mounts NOTHING on document.documentElement'.
  it('emits no --rm-* custom property on ANY element in its tree', async () => {
    const { container } = render(
      <BrandingProvider context={makeContext({ search: `?brand=${SLUG}`, table: { [SLUG]: BRAND } })}>
        <div data-testid="child"><span>deep</span></div>
      </BrandingProvider>
    );
    await screen.findByTestId('child');

    // Every element the render produced, the container itself included — not just
    // the ones this test happens to name.
    const elements = [container, ...container.querySelectorAll('*')];
    expect(elements.length).toBeGreaterThan(2);

    for (const el of elements) {
      for (const name of EVERY_VAR) {
        expect(el.style?.getPropertyValue(name) ?? '',
          `${name} was emitted by BrandingProvider — Ruling 5 requires it emit none`).toBe('');
      }
    }
  });

  it('emits nothing on documentElement or body either', async () => {
    render(
      <BrandingProvider context={makeContext({ search: `?brand=${SLUG}`, table: { [SLUG]: BRAND } })}>
        <p>child</p>
      </BrandingProvider>
    );
    await screen.findByText('child');

    for (const name of EVERY_VAR) {
      expect(document.documentElement.style.getPropertyValue(name),
        `${name} leaked onto :root`).toBe('');
      expect(document.body.style.getPropertyValue(name), `${name} leaked onto body`).toBe('');
    }
  });

  it('generates NO DOM element of its own, so it cannot carry a variable at all', () => {
    // The structural form of the rule. ThemeProvider needs a wrapper because it
    // has variables to hang somewhere; this provider has none, so the correct
    // number of elements it contributes is zero. A wrapper here would be a place
    // for a --rm-* to appear later without anyone noticing.
    const { container } = render(
      <BrandingProvider context={makeContext()}><p data-testid="only">only child</p></BrandingProvider>
    );
    expect(container.childNodes).toHaveLength(1);
    expect(container.firstChild).toBe(screen.getByTestId('only'));
  });
});
