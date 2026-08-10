// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3a PHASE 4B — SKELETON
//
// WHAT THIS SUITE PINS, AND WHY IT IS DIFFERENT FROM PHASE 4A's. 4A covered four
// BRAND-NEW primitives that nothing imported. Skeleton is LIVE on 13 files, so
// this suite carries an extra burden 4A's did not: proving the change is
// invisible where it must be and visible where it must be.
//
// THE BUG BEING FIXED. Skeleton shipped one fill, rgba(255,255,255,0.07) — a
// white wash, correct on the dark admin panel and very nearly a no-op on the
// light referrer screens. Composited over #FFFFFF it moves not one channel; over
// R.bgPage #EEF2F7 it moves one. Nine referrer call sites across four files were
// therefore rendering nothing at all during load, and three OTHER referrer files
// had already been hand-patched with a local rgba(1,40,84,0.08) override — the
// same bug, found and worked around per-caller instead of fixed once here.
//
// ⚠ WHAT "THEME READING" CAN AND CANNOT BE PROVEN HERE. Same limitation as 4A:
// jsdom DOES NOT RESOLVE var(). So the contract is proven in the same two halves:
//
//   (a) DECLARATION — the element declares exactly var(--rm-skeleton, <fill>), so
//       the variable name is right and the documented fallback is what ships.
//   (b) CASCADE SCOPE — a --rm-skeleton set on a wrapper is visible on the
//       element's own computed style, and absent when nothing sets it.
//
// BUT THIS SUITE ADDS A THIRD HALF 4A HAD NO NEED FOR, and it is the one that
// actually pins the bugfix: the shipped fallback is PARSED OUT of the rendered
// declaration and COMPOSITED IN THE TEST against real surface colours. That
// turns "the string changed" into "the fill moves N/255 on white and 1/255 on the
// admin card", which is the claim the phase is actually making. Arithmetic, not
// rendering — so jsdom's inability to resolve var() does not weaken it.
//
// ── CONVENTION ───────────────────────────────────────────────────────────────
// jsdom + @testing-library/react under Vitest, static top-level imports,
// mirroring uiStatePrimitives.test.jsx. Nothing is stubbed — Skeleton takes no
// props from the network and reads no browser API jsdom lacks.
// ─────────────────────────────────────────────────────────────────────────────

import { render } from '@testing-library/react';
import { R } from '../../constants/theme';
import { AD } from '../../constants/adminTheme';
import Skeleton from './Skeleton';
// NAMESPACE IMPORT, DELIBERATELY, and not `import Skeleton, { SKELETON_FILL }`.
// A named import of a member the module does not export is a LINK-TIME error
// under Vite's native ESM — it would take the whole file down with one message
// and every test below would go red for that one reason instead of its own. A
// namespace member simply reads undefined, so the export test fails alone.
import * as SkeletonModule from './Skeleton';

// The value this phase replaces. Kept as a literal so the preservation test below
// can composite it, and so a future edit that reverts the fill fails loudly.
const OLD_FILL = 'rgba(255,255,255,0.07)';

// jsdom re-serialises colour functions with spaces after the commas
// ('rgba(1,2,3,0.5)' reads back as 'rgba(1, 2, 3, 0.5)'), so comparisons run with
// whitespace collapsed — same helper as uiStatePrimitives.test.jsx's StateCard
// block. This keeps assertions on the VALUES rather than on jsdom's formatting.
const css = (value) => String(value).replace(/\s+/g, '');

// Pulls the fallback back out of `var(--name, <fallback>)`.
// The tests composite the SHIPPED value rather than a constant of their own, so
// what gets measured is what actually renders.
function fallbackOf(declaration) {
  const match = String(declaration).match(/^var\(\s*--[\w-]+\s*,\s*(.+)\)$/);
  if (!match) throw new Error(`not a var() declaration with a fallback: ${declaration}`);
  return match[1].trim();
}

function parseRgba(value) {
  const m = String(value).match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (!m) throw new Error(`not an rgb/rgba colour: ${value}`);
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}

function parseHex(value) {
  return { r: parseInt(value.slice(1, 3), 16), g: parseInt(value.slice(3, 5), 16), b: parseInt(value.slice(5, 7), 16) };
}

// Standard source-over alpha compositing of a translucent fill onto an opaque
// surface. This is exactly what a browser does when it paints the skeleton.
//
// ROUNDED TO INTEGER CHANNELS, DELIBERATELY, because that is what actually gets
// painted — a display rasterises to 8 bits per channel, so a difference of 3.21
// and a difference of 3 are the same pixels. Comparing the raw floats would hold
// the thresholds below to a precision the medium does not have.
function composite(fill, surfaceHex) {
  const f = parseRgba(fill);
  const s = parseHex(surfaceHex);
  return {
    r: Math.round(s.r + f.a * (f.r - s.r)),
    g: Math.round(s.g + f.a * (f.g - s.g)),
    b: Math.round(s.b + f.a * (f.b - s.b)),
  };
}

// Largest per-channel difference between two composited results, in 0-255 units.
// The single number that answers "can a person see this".
function maxChannelDelta(a, b) {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

// Renders `ui` inside a wrapper carrying CSS custom properties, and returns the
// component's own root. Half (b) gets its "variable is set" case from this: the
// properties live on an ANCESTOR, exactly as a theme provider mounts them in 3b/3c.
function renderThemed(ui, vars = {}) {
  const { container } = render(ui);
  const wrapper = document.createElement('div');
  container.parentNode.insertBefore(wrapper, container);
  wrapper.appendChild(container);
  for (const [name, value] of Object.entries(vars)) wrapper.style.setProperty(name, value);
  return { root: container.firstElementChild, wrapper, container };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Skeleton — theme declaration', () => {

  it('(a) declares its fill as the skeleton variable with a translucent neutral fallback', () => {
    // NEUTRAL GREY, NOT A BRAND TONE. Same rule LoadingIndicator states for its
    // ring: an unthemed primitive painting the platform's own brand colour into
    // another contractor's page is the white-label breach brandingTheme.js
    // refuses a default logo for. The three hand-patched callers used Accent's
    // navy at 8%; the fix must not promote that literal into the component.
    const { root } = renderThemed(<Skeleton />);
    expect(css(root.style.background)).toBe(css('var(--rm-skeleton, rgba(128,128,128,0.18))'));
  });

  it('(b) sits inside the cascade scope that would resolve that variable', () => {
    const { root } = renderThemed(<Skeleton />, { '--rm-skeleton': '#123456' });
    expect(getComputedStyle(root).getPropertyValue('--rm-skeleton')).toBe('#123456');
  });

  it('(b) reads nothing when no ancestor sets the variable — the live case today', () => {
    // NOTHING mounts --rm-* on any surface in production right now. This is not a
    // hypothetical branch, it is how every one of the 13 consumers renders today.
    const { root } = renderThemed(<Skeleton />);
    expect(getComputedStyle(root).getPropertyValue('--rm-skeleton')).toBe('');
  });

  it('never declares a bare var() with nothing to fall back to', () => {
    // A var() with no fallback renders as NO VALUE AT ALL — an invisible element,
    // nothing logged. Same rule the 4A shelf holds itself to.
    const { root } = renderThemed(<Skeleton />);
    for (const prop of Array.from(root.style)) {
      const value = root.style.getPropertyValue(prop);
      if (!value.includes('var(')) continue;
      expect(value, prop).toMatch(/var\(\s*--[\w-]+\s*,/);
    }
  });

  it('exports its fill and variable name for the 3b/3c provider to mount', () => {
    // The provider needs the property NAME from one place, or the name it mounts
    // and the name declared above drift silently and the theme simply never
    // applies. Asserted as literals — comparing the constant to itself pins nothing.
    expect(SkeletonModule.SKELETON_FILL).toBe('rgba(128,128,128,0.18)');
    expect(SkeletonModule.SKELETON_VAR).toBe('--rm-skeleton');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Skeleton — the visibility bug this phase exists to fix', () => {

  // THE THRESHOLD. 8/255 per channel is the smallest step that is reliably
  // perceptible as a distinct block on a plain surface; the conventional web
  // skeleton grey (#E5E7EB on white) sits at 20+. It is a floor, not a target.
  const VISIBLE = 8;

  it('the shipped fill is clearly visible on a WHITE card', () => {
    const { root } = renderThemed(<Skeleton />);
    const fill = fallbackOf(root.style.background);
    const surface = R.bgCard;                       // #FFFFFF
    const delta = maxChannelDelta(composite(fill, surface), parseHex(surface));
    expect(delta).toBeGreaterThanOrEqual(VISIBLE);
  });

  it('the shipped fill is clearly visible on the light PAGE canvas', () => {
    const { root } = renderThemed(<Skeleton />);
    const fill = fallbackOf(root.style.background);
    const surface = R.bgPage;                       // #EEF2F7
    const delta = maxChannelDelta(composite(fill, surface), parseHex(surface));
    expect(delta).toBeGreaterThanOrEqual(VISIBLE);
  });

  it('NON-VACUITY — the OLD fill fails both of those on the same arithmetic', () => {
    // Without this, the two tests above would pass for any value at all that
    // happened to be darker than white, and would not be pinning the bug.
    // The old fill moves ZERO channels on white and ONE on the page canvas.
    expect(maxChannelDelta(composite(OLD_FILL, R.bgCard), parseHex(R.bgCard))).toBe(0);
    expect(maxChannelDelta(composite(OLD_FILL, R.bgPage), parseHex(R.bgPage))).toBeLessThan(VISIBLE);
  });

  it('the shipped fill is no longer the old dark-surface-only value', () => {
    const { root } = renderThemed(<Skeleton />);
    expect(css(root.style.background)).not.toContain(css(OLD_FILL));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Skeleton — the ADMIN panel must not change at all', () => {

  // THE OVERRIDING RULE OF PHASE 4B. Seven admin files and ~28 call sites render
  // Skeleton on the dark panel today and are expressly NOT meant to look
  // different afterwards. "Imperceptible" is defined here as <= 3/255 on every
  // channel — roughly a third of the VISIBLE floor above, and below the point at
  // which a flat block reads as a different colour.
  const IMPERCEPTIBLE = 3;

  // The navy-header tolerance below is looser than IMPERCEPTIBLE on purpose: a
  // grey wash and a white wash cannot land on the same value over a saturated
  // navy, and the requirement there is "still clearly a skeleton", not "identical".
  const NAVY_TOLERANCE = 8;

  it.each([
    ['AD.bgCard',    AD.bgCard],     // #1f2638 — where most admin skeletons sit
    ['AD.bgPage',    AD.bgPage],     // #12161f
    ['AD.bgSurface', AD.bgSurface],  // #1a1f2e
  ])('renders on %s within a hair of what it renders today', (_name, surface) => {
    const { root } = renderThemed(<Skeleton />);
    const fill = fallbackOf(root.style.background);
    const delta = maxChannelDelta(composite(fill, surface), composite(OLD_FILL, surface));
    expect(delta).toBeLessThanOrEqual(IMPERCEPTIBLE);
  });

  it('also preserves the CashOutTab navy loading header, which is dark too', () => {
    // CashOutTab's first four skeletons sit on a #012854 gradient, not on the
    // light canvas — the one referrer surface where the old fill was CORRECT.
    // Easy to break while fixing the light screens, so it is pinned separately.
    const { root } = renderThemed(<Skeleton />);
    const fill = fallbackOf(root.style.background);
    const before = composite(OLD_FILL, '#012854');
    const after = composite(fill, '#012854');
    expect(maxChannelDelta(after, before)).toBeLessThanOrEqual(NAVY_TOLERANCE);
    // …and it must still stand off the header rather than merging into it.
    expect(maxChannelDelta(after, parseHex('#012854'))).toBeGreaterThanOrEqual(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Skeleton — drop-in: no caller had to change', () => {

  it('renders with no props at all', () => {
    const { root } = renderThemed(<Skeleton />);
    expect(root).toBeInTheDocument();
    expect(root.style.width).toBe('100%');
    expect(root.style.height).toBe('16px');
    expect(root.style.borderRadius).toBe('6px');
  });

  it.each([
    ['bare',                     {}],
    ['sized',                    { width: '180px', height: '180px', borderRadius: '12px' }],
    ['with incidental style',    { height: '62px', style: { marginBottom: 8 } }],
    ['with a flex-shrink guard', { width: '36px', height: '36px', borderRadius: '50%', style: { flexShrink: 0 } }],
  ])('the existing call shape "%s" still renders unchanged', (_name, props) => {
    // These four shapes cover every way the 13 live consumers actually call it.
    // A required new prop would have broken all of them; this is what "drop-in"
    // means in practice.
    const { root } = renderThemed(<Skeleton {...props} />);
    expect(root).toBeInTheDocument();
    expect(css(root.style.background)).toBe(css('var(--rm-skeleton, rgba(128,128,128,0.18))'));
  });

  it('still spreads the caller style LAST, so a caller can override the fill', () => {
    // House convention across every shared component. It is also the escape hatch
    // that let three referrer files hand-patch this bug in the first place — the
    // patches are removed this phase, but the capability must survive.
    const { root } = renderThemed(<Skeleton style={{ background: 'rebeccapurple', marginTop: '42px' }} />);
    expect(root.style.background).toBe('rebeccapurple');
    expect(root.style.marginTop).toBe('42px');
  });

  it('keeps animating with the keyframe name it already had', () => {
    // skeletonPulse is injected by this module and referenced nowhere else.
    // Renaming it while re-theming would silently stop every skeleton in the app.
    const { root } = renderThemed(<Skeleton />);
    expect(root.style.animation).toContain('skeletonPulse');
  });
});
