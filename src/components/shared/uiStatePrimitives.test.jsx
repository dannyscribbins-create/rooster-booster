// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3a PHASE 4A — UI-STATE PRIMITIVES (loading / empty / error / success)
//
// WHAT THIS SUITE PINS. Four brand-new shared primitives that nothing imports
// yet. The rep app mounts the --rm-* variables in 3b/3c; until then these
// components must be correct with NO variables set at all. That is the whole
// contract under test: reference the variable, ship a sane fallback, and stay
// presentable either way.
//
// ⚠ WHAT "THEME READING" CAN AND CANNOT BE PROVEN HERE — READ THIS BEFORE
// CHANGING ANY ASSERTION BELOW. jsdom DOES NOT RESOLVE var(). Measured against
// the pinned jsdom (^29) during Phase 4A Step 1:
//
//     el.style.background            = 'var(--rm-surface, #FFFFFF)'
//     getComputedStyle(el).background        -> 'var(--rm-surface, #ffffff)'  (literal)
//     getComputedStyle(el).backgroundColor   -> 'rgba(0, 0, 0, 0)'            (never resolves)
//     getComputedStyle(el).getPropertyValue('--rm-surface') -> '#123456'      (DOES cascade)
//
// So "the component renders the colour the wrapper supplied" is NOT provable in
// this environment, and any assertion that appears to prove it would be lying.
// What these tests prove instead is TWO HALVES that together cover the contract:
//
//   (a) DECLARATION — the element declares exactly var(--rm-X, <fallback>), so
//       the variable name is right and the documented fallback is what ships.
//   (b) CASCADE SCOPE — a --rm-X set on a wrapper is visible on the component's
//       own computed style, and absent when no wrapper sets it. So the element
//       sits inside the inheritance scope that WOULD resolve (a) in a browser.
//
// THIS IS A DECLARATION-LEVEL PROOF, NOT A RENDERED-COLOUR PROOF. Real
// resolution gets verified in a browser at 3b/3c, when something finally mounts
// the variables. Do not read a green run here as "the colours are correct on
// screen" — it cannot mean that.
//
// ── CONVENTION ───────────────────────────────────────────────────────────────
// jsdom + @testing-library/react under Vitest, static top-level imports,
// mirroring CompanyDetailsSettings.test.jsx and AdminTeamSettings.test.jsx.
// These primitives take no props from the network, so unlike those suites there
// is no fetch to replace — the only thing stubbed anywhere is window.matchMedia,
// which jsdom does not implement at all (measured, Step 1).
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent } from '@testing-library/react';
import { R } from '../../constants/theme';
import { STATUS_LIGHT, STATUS_TINT } from '../../constants/statusTheme';
import LoadingIndicator from './LoadingIndicator';
import StateCard from './StateCard';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import SuccessState from './SuccessState';

const KEYFRAMES_ID = 'rm-ui-state-keyframes';

// Renders `ui` inside a wrapper carrying the given CSS custom properties, and
// returns the wrapper's only element child — i.e. the component's own root.
// This is how half (b) gets its "variable is set" case: the properties live on
// an ancestor, exactly as a theme provider will mount them in 3b/3c.
function renderThemed(ui, vars = {}) {
  const { container } = render(ui);
  const wrapper = document.createElement('div');
  container.parentNode.insertBefore(wrapper, container);
  wrapper.appendChild(container);
  for (const [name, value] of Object.entries(vars)) wrapper.style.setProperty(name, value);
  return { root: container.firstElementChild, wrapper, container };
}

// Every element in the tree that owns visible text of its own (a direct, non-empty
// text-node child). The primary-is-a-fill rule is asserted against exactly these:
// an element with no text of its own may legitimately paint itself with --rm-primary,
// because a fill is what primary is for.
function elementsOwningText(root) {
  const out = [];
  const walk = (el) => {
    const ownsText = Array.from(el.childNodes)
      .some(n => n.nodeType === 3 && n.textContent.trim() !== '');
    if (ownsText) out.push(el);
    Array.from(el.children).forEach(walk);
  };
  walk(root);
  return out;
}

// jsdom implements no matchMedia whatsoever (measured, Step 1 — window.matchMedia
// is undefined), so the reduced-motion case has to be installed by hand. Modelled
// as the real MediaQueryList surface rather than a bare { matches } so a component
// that subscribes to changes does not throw on a partial stub.
function installMatchMedia(prefersReduced) {
  window.matchMedia = vi.fn((query) => ({
    matches: prefersReduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }));
}

afterEach(() => {
  delete window.matchMedia;
  document.getElementById(KEYFRAMES_ID)?.remove();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('LoadingIndicator', () => {

  it('renders as a live status region carrying its label', () => {
    render(<LoadingIndicator label="Loading pipeline…" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading pipeline…');
  });

  it('names itself for assistive tech even with no visible label', () => {
    // A bare spinner with no accessible name announces nothing at all, which is
    // the most common way a loading state is inaccessible.
    render(<LoadingIndicator />);
    expect(screen.getByRole('status')).toHaveAccessibleName();
  });

  it('(a) declares the brand variable with a NEUTRAL fallback for its accent', () => {
    // The ring accent is a FILL, which is what --rm-primary is for.
    //
    // THE FALLBACK IS DELIBERATELY NEUTRAL GREY, NOT RoofMiles ORANGE. An
    // unthemed primitive painting the platform's own brand colour into some
    // other contractor's page is the same white-label breach brandingTheme.js
    // refuses a default logo for.
    const { root } = renderThemed(<LoadingIndicator />);
    const ring = root.querySelector('.rm-spin');
    expect(ring.style.borderTopColor).toBe(`var(--rm-primary, ${R.textMuted})`);
    expect(R.textMuted).toBe('#A0A0A0');
  });

  it('(b) sits inside the cascade scope that would resolve that variable', () => {
    const { root } = renderThemed(<LoadingIndicator />, { '--rm-primary': '#123456' });
    const ring = root.querySelector('.rm-spin');
    expect(getComputedStyle(ring).getPropertyValue('--rm-primary')).toBe('#123456');
  });

  it('(b) reads nothing when no ancestor sets the variable — the fallback case', () => {
    const { root } = renderThemed(<LoadingIndicator />);
    const ring = root.querySelector('.rm-spin');
    expect(getComputedStyle(ring).getPropertyValue('--rm-primary')).toBe('');
  });

  // ⚠ THESE THREE READ style.animation, THE SHORTHAND, AND NOT style.animationName.
  // jsdom does not expand CSS shorthands into their longhands — measured while
  // building this suite: setting `animation: 'rmSpin 0.8s linear infinite'` leaves
  // animationName as the empty string forever. An assertion on animationName is
  // therefore always-'' and would pass its negative form for free.
  it('animates by default, and does not crash where matchMedia is absent', () => {
    // NON-VACUITY for the reduced-motion test below: if the spinner never
    // animated, "suppressed under reduced motion" would pass for free.
    // window.matchMedia is deleted in afterEach, so this is the absent case.
    expect(window.matchMedia).toBeUndefined();
    const { root } = renderThemed(<LoadingIndicator />);
    expect(root.querySelector('.rm-spin').style.animation).toContain('rmSpin');
  });

  it('suppresses the animation when the user prefers reduced motion', () => {
    installMatchMedia(true);
    const { root } = renderThemed(<LoadingIndicator />);
    const ring = root.querySelector('.rm-spin');
    expect(ring.style.animation).toBe('none');
    expect(ring.style.animation).not.toContain('rmSpin');
  });

  it('still animates when the user expresses no reduced-motion preference', () => {
    installMatchMedia(false);
    const { root } = renderThemed(<LoadingIndicator />);
    expect(root.querySelector('.rm-spin').style.animation).toContain('rmSpin');
  });

  it('ships the CSS reduced-motion layer too, not only the JS check', () => {
    // TWO LAYERS ON PURPOSE. The JS check is read once at render, so it cannot
    // respond to a user flipping the OS setting without a re-render; the CSS
    // rule can, and applies before any JS has run. !important is load-bearing —
    // a stylesheet rule loses to an inline style without it, and every style in
    // this codebase is inline.
    render(<LoadingIndicator />);
    const injected = document.getElementById(KEYFRAMES_ID);
    expect(injected).not.toBeNull();
    expect(injected.textContent).toContain('@keyframes rmSpin');
    expect(injected.textContent).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(injected.textContent).toMatch(/animation:\s*none\s*!important/);
  });

  it('names its keyframe rmSpin so it cannot collide with the 22 local spin definitions', () => {
    // `spin` is defined inline in 21 other files. A shared primitive claiming
    // that name would silently redefine theirs depending on injection order.
    render(<LoadingIndicator />);
    expect(document.getElementById(KEYFRAMES_ID).textContent).not.toMatch(/@keyframes\s+spin\b/);
  });

  it('injects its stylesheet exactly once across many mounts', () => {
    render(<LoadingIndicator />);
    render(<LoadingIndicator />);
    render(<LoadingIndicator />);
    expect(document.querySelectorAll(`#${KEYFRAMES_ID}`)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('EmptyState', () => {

  it('renders its title and message', () => {
    render(<EmptyState title="No referrals yet" message="Share your link to get started." />);
    expect(screen.getByText('No referrals yet')).toBeInTheDocument();
    expect(screen.getByText('Share your link to get started.')).toBeInTheDocument();
  });

  it('CARD-EDGE RULE — defines its edge with a border AND a shadow', () => {
    // Light-mode bg and surface are legitimately the SAME colour (both #FFFFFF
    // for RoofMiles — deriveLightTokens passes bg through unchanged). A card that
    // relies on bg-vs-surface contrast is therefore invisible on a white page.
    // The edge is the card, and it is not optional.
    const { root } = renderThemed(<EmptyState title="No referrals yet" />);
    expect(root.style.border).not.toBe('');
    expect(root.style.boxShadow).not.toBe('');
  });

  it('(a) declares the surface variable with a neutral fallback', () => {
    const { root } = renderThemed(<EmptyState title="No referrals yet" />);
    expect(root.style.background).toBe(`var(--rm-surface, ${R.bgCard})`);
  });

  it('(b) sits inside the cascade scope that would resolve it', () => {
    const { root } = renderThemed(<EmptyState title="No referrals yet" />, { '--rm-surface': '#0B111E' });
    expect(getComputedStyle(root).getPropertyValue('--rm-surface')).toBe('#0B111E');
  });

  it('renders a caller-supplied action', () => {
    render(<EmptyState title="No referrals yet" action={<button>Invite someone</button>} />);
    expect(screen.getByRole('button', { name: 'Invite someone' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ErrorState', () => {

  it('renders as an alert carrying its title and message', () => {
    render(<ErrorState title="Could not load pipeline" message="Check your connection." />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not load pipeline');
    expect(alert).toHaveTextContent('Check your connection.');
  });

  it('renders its status colour from the semantic danger variable', () => {
    // Status is NOT brand-derived and does not go through deriveThemeTokens —
    // the five --rm-* tokens carry no red at all. The fallback is the LIGHT
    // value; the dark value is mounted by the provider in 3b/3c.
    const { root } = renderThemed(<ErrorState title="Could not load pipeline" />);
    const heading = screen.getByText('Could not load pipeline');
    expect(heading.style.color).toBe(`var(--rm-danger-text, ${STATUS_LIGHT.dangerText})`);
    expect(root).toBeInTheDocument();
  });

  it('CARD-EDGE RULE — defines its edge with a border AND a shadow', () => {
    const { root } = renderThemed(<ErrorState title="Could not load pipeline" />);
    expect(root.style.border).not.toBe('');
    expect(root.style.boxShadow).not.toBe('');
  });

  it('(a)/(b) declares the surface variable and sits in its cascade scope', () => {
    const { root } = renderThemed(<ErrorState title="x" />, { '--rm-surface': '#121B31' });
    expect(root.style.background).toBe(`var(--rm-surface, ${R.bgCard})`);
    expect(getComputedStyle(root).getPropertyValue('--rm-surface')).toBe('#121B31');
  });

  it('offers a retry control only when a handler is supplied, and calls it', () => {
    const { unmount } = render(<ErrorState title="x" />);
    expect(screen.queryByRole('button')).toBeNull();
    unmount();

    const onRetry = vi.fn();
    render(<ErrorState title="x" onRetry={onRetry} retryLabel="Try again" />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('SuccessState', () => {

  it('renders as a status region carrying its title and message', () => {
    render(<SuccessState title="Cash out requested" message="We'll email you when it lands." />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cash out requested');
    expect(status).toHaveTextContent("We'll email you when it lands.");
  });

  it('renders its status colour from the semantic success variable', () => {
    render(<SuccessState title="Cash out requested" />);
    const heading = screen.getByText('Cash out requested');
    expect(heading.style.color).toBe(`var(--rm-success-text, ${STATUS_LIGHT.successText})`);
  });

  it('CARD-EDGE RULE — defines its edge with a border AND a shadow', () => {
    const { root } = renderThemed(<SuccessState title="Cash out requested" />);
    expect(root.style.border).not.toBe('');
    expect(root.style.boxShadow).not.toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('rules that hold across the whole shelf', () => {

  const EVERY_PRIMITIVE = [
    ['LoadingIndicator', <LoadingIndicator key="l" label="Loading…" />],
    ['EmptyState',       <EmptyState key="e" title="Nothing here" message="Nothing at all." />],
    ['ErrorState',       <ErrorState key="x" title="It broke" message="Badly." onRetry={() => {}} />],
    ['SuccessState',     <SuccessState key="s" title="Done" message="All good." />],
  ];

  it.each(EVERY_PRIMITIVE)('PRIMARY-IS-A-FILL — %s never colours text with --rm-primary', (_name, ui) => {
    // Orange-on-white fails contrast. The Phase 3 engine guarantees --rm-text is
    // readable against --rm-surface; it guarantees nothing of the sort for
    // --rm-primary, which is a fill and an accent only.
    const { root } = renderThemed(ui);
    const texts = elementsOwningText(root);
    expect(texts.length).toBeGreaterThan(0);   // non-vacuity: something was found to check
    for (const el of texts) {
      expect(el.style.color).not.toContain('--rm-primary');
    }
  });

  it.each(EVERY_PRIMITIVE)('%s is presentable with no --rm-* variables set at all', (_name, ui) => {
    // THE LIVE CASE FOR THE WHOLE OF 3a: nothing mounts the variables yet, so
    // this is how these primitives actually render in production today.
    //
    // The contract is NOT "every text element declares its own colour" — an
    // element inheriting a colour from the component's own root is correct CSS,
    // and LoadingIndicator's label does exactly that. It is: the component
    // establishes a text colour, and NO declaration anywhere is a var() without
    // a fallback, since that one renders as no value at all.
    const { root } = renderThemed(ui);
    expect(root.style.color || root.style.background).not.toBe('');

    const all = [root, ...root.querySelectorAll('*')];
    for (const el of all) {
      for (const prop of Array.from(el.style)) {
        const value = el.style.getPropertyValue(prop);
        if (!value.includes('var(')) continue;
        // A bare var(--x) with no comma has nothing to fall back to.
        expect(value, `${prop} on <${el.tagName.toLowerCase()}>`).toMatch(/var\(\s*--[\w-]+\s*,/);
      }
    }
  });

  it.each(EVERY_PRIMITIVE)('%s spreads the caller style LAST, so the caller wins', (_name, ui) => {
    // House convention across every existing shared component (Screen, AnimCard,
    // Skeleton): `...style` spreads LAST. fontFamily is the property under test
    // precisely BECAUSE each primitive sets it itself — overriding a property the
    // component never touches would pass under either spread order and prove
    // nothing about the ordering.
    const withOverride = { ...ui, props: { ...ui.props, style: { fontFamily: 'CallerFont', marginTop: '42px' } } };
    const { root } = renderThemed(withOverride);
    expect(root.style.fontFamily).toBe('CallerFont');
    expect(root.style.marginTop).toBe('42px');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('statusTheme constants', () => {

  it('pins the ruled light values that ship as the hardcoded var() fallbacks', () => {
    // These four hexes are the Phase 4A ruling. Asserted as literals — a test
    // that only compared the constant to itself would pin nothing.
    expect(STATUS_LIGHT).toMatchObject({
      danger:      '#DC2626',
      dangerText:  '#B91C1C',
      success:     '#16A34A',
      successText: '#15803D',
    });
  });

  it('keeps the tints translucent so one value serves both modes', () => {
    // A translucent tint reads as a pale wash on white and a dark wash on
    // near-black, which is why these need no light/dark split at all.
    expect(STATUS_TINT.danger).toMatch(/^rgba\(/);
    expect(STATUS_TINT.success).toMatch(/^rgba\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('StateCard — the edge is intrinsic, not offered', () => {

  // THIS IS THE PROPERTY THE EXTRACTION BUYS. Three copies of the card-edge rule
  // could each be dropped in a later edit with nothing to catch it. One shell
  // that re-applies the edge AFTER the caller's spread cannot be talked out of
  // it. These tests exist to pin that, not merely to cover a new file.

  // jsdom re-serialises colour functions with spaces after the commas, so the
  // token 'rgba(0,0,0,0.08)' reads back as 'rgba(0, 0, 0, 0.08)'. Comparing with
  // whitespace collapsed keeps these assertions on the VALUES rather than on
  // jsdom's formatting, while still catching any real change to either.
  const css = (value) => String(value).replace(/\s+/g, '');

  function expectEdge(root) {
    expect(css(root.style.border)).toBe(css(`1px solid ${R.border}`));
    expect(css(root.style.boxShadow)).toBe(css(R.shadow));
  }

  it('draws its edge with no style prop at all', () => {
    const { container } = render(<StateCard>content</StateCard>);
    expectEdge(container.firstElementChild);
  });

  it('keeps its edge even when a caller explicitly tries to remove it', () => {
    // The hostile case, and the whole point of breaking the house spread order
    // in this one file.
    const { container } = render(
      <StateCard style={{ border: 'none', boxShadow: 'none' }}>content</StateCard>
    );
    expectEdge(container.firstElementChild);
  });

  it('still lets a caller override incidental style', () => {
    // The edge is the ONLY thing the caller loses control of. A shell that
    // ignored everything would be an equally bad answer.
    const { container } = render(
      <StateCard style={{ marginTop: '42px', fontFamily: 'CallerFont', padding: '3px' }}>content</StateCard>
    );
    const root = container.firstElementChild;
    expect(root.style.marginTop).toBe('42px');
    expect(root.style.fontFamily).toBe('CallerFont');
    expect(root.style.padding).toBe('3px');
  });

  it('passes semantics through, carrying none of its own', () => {
    // The shell is deliberately role-less: each state component supplies the
    // role its own meaning calls for (alert vs status).
    const { container } = render(<StateCard role="alert" aria-live="assertive">content</StateCard>);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('role', 'alert');
    expect(root).toHaveAttribute('aria-live', 'assertive');
    expect(render(<StateCard>x</StateCard>).container.firstElementChild).not.toHaveAttribute('role');
  });

  it.each([
    ['EmptyState',   <EmptyState key="e" title="T" style={{ border: 'none', boxShadow: 'none' }} />],
    ['ErrorState',   <ErrorState key="x" title="T" style={{ border: 'none', boxShadow: 'none' }} />],
    ['SuccessState', <SuccessState key="s" title="T" style={{ border: 'none', boxShadow: 'none' }} />],
  ])('%s cannot be made edgeless through its own style prop either', (_name, ui) => {
    // The guarantee has to survive the trip through each state component, or the
    // shell protects nothing that callers can actually reach.
    const { container } = render(ui);
    expectEdge(container.firstElementChild);
  });
});
