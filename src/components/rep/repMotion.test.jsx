// ─────────────────────────────────────────────────────────────────────────────
// CANVASS-9b — THE REP APP'S MOTION SYSTEM
//
// ⚠ WHAT jsdom CAN AND CANNOT SETTLE HERE, STATED FIRST BECAUSE IT DECIDES EVERY
// ASSERTION IN THIS FILE. jsdom runs no animations, resolves no `var()`, performs
// no layout, and implements NO `matchMedia` at all. So nothing here proves that
// motion LOOKS right — that is the browser pass. What IS provable, and is where
// every defect in this system would actually live:
//   · the declarations emitted (durations, curves, which property eases)
//   · the ASYMMETRY between press-in and press-out, which is the ruling
//   · that the reduced-motion contract is injected, is scoped, and is honoured
//   · that list rows are excluded from entrance animation
//
// ⚠ AND THE matchMedia ABSENCE IS LOAD-BEARING RATHER THAN AN OBSTACLE. Because
// jsdom has none, `prefersReducedMotion()` returns false and every ordinary case
// exercises the MOTION-ALLOWED path. The reduced path is reached by installing a
// stub — which is the only way to test it, and is why the guard defaults the way
// it does.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import ThemeProvider from '../shared/ThemeProvider';
import RepShell from './RepShell';
import {
  MOTION, injectRepMotion, prefersReducedMotion, entrance, pressTransition,
} from './repMotion';

const STYLE_ID = 'rm-rep-motion';

// Split a CSS value list on TOP-LEVEL commas only.
//
// ⚠ A BARE `split(',')` IS WRONG HERE AND THE FIRST WRITING OF THIS FILE USED ONE.
// `cubic-bezier(0.22, 1, 0.36, 1)` contains three commas of its own, so a naive split
// turned one valid segment into five fragments and the shape assertion failed against
// CORRECT code. ⚠ That is the same class of bug as the defect the assertion exists to
// catch — a comma list parsed without regard to what the commas belong to — arriving
// in the checker rather than in the subject. Recorded rather than quietly fixed,
// because "the test was wrong" is the conclusion that gets reached too fast and here
// it was genuinely the reader at fault both times.
function splitTopLevel(value) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Installs a matchMedia that answers the reduced-motion query. ⚠ It THROWS on any
// other query rather than returning a plausible `matches: false`: a double that can
// also stand in for "some other question" is indistinguishable from the real thing
// answering, which is the recorded "a test double that can return a no-answer shape"
// failure.
function stubReducedMotion(reduced) {
  window.matchMedia = vi.fn((q) => {
    if (!String(q).includes('prefers-reduced-motion')) {
      throw new Error(`unexpected media query: ${q}`);
    }
    return { matches: reduced, media: q, addEventListener() {}, removeEventListener() {} };
  });
}

afterEach(() => {
  cleanup();
  delete window.matchMedia;
  document.getElementById(STYLE_ID)?.remove();
  vi.restoreAllMocks();
});

describe('Canvass-9b — the reduced-motion contract', () => {
  it('injects a stylesheet carrying BOTH the keyframes and the reduced-motion block', () => {
    injectRepMotion();
    const el = document.getElementById(STYLE_ID);
    expect(el, 'no motion stylesheet was injected').toBeTruthy();
    expect(el.textContent).toContain('@keyframes rmRepRise');
    expect(el.textContent).toContain('prefers-reduced-motion: reduce');
  });

  it('⚠ the reduced-motion block is SCOPED to the rep shell, not global', () => {
    // A `*` rule would reach into the referrer app and the admin panel — two surfaces
    // with their own motion and their own owners, which this phase never looked at.
    injectRepMotion();
    const css = document.getElementById(STYLE_ID).textContent;
    const block = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(block).toContain('[data-rep-shell]');
    // ⚠ AND THE PAIRED NEGATIVE: no bare universal selector at the start of a rule.
    // Without it, "it contains [data-rep-shell]" is satisfied by a sheet that ALSO
    // carries a global rule.
    expect(block).not.toMatch(/^\s*\*\s*,/m);
    expect(block).not.toMatch(/\{\s*\*\s*\{/);
  });

  it('⚠ uses 0.01ms rather than 0s, so transitionend still fires', () => {
    // A zeroed duration means some engines never fire the event, so anything awaiting
    // one waits forever. Imperceptible AND observable is the point.
    injectRepMotion();
    const css = document.getElementById(STYLE_ID).textContent;
    expect(css).toContain('0.01ms');
    expect(css).not.toMatch(/transition-duration:\s*0s/);
    expect(css).not.toMatch(/animation-duration:\s*0s/);
  });

  it('⚠ the keyframe names are NAMESPACED — `spin` is defined in 17 places repo-wide', () => {
    // CSS keyframes are global and last-definition-wins, so a plain name silently
    // redefines every other definition depending on injection order. LoadingIndicator
    // records the same hazard and took `rmSpin` for it.
    injectRepMotion();
    const css = document.getElementById(STYLE_ID).textContent;
    for (const name of css.match(/@keyframes\s+([A-Za-z0-9_-]+)/g) || []) {
      expect(name.split(/\s+/)[1]).toMatch(/^rmRep/);
    }
  });

  it('injects at most ONCE even when called repeatedly', () => {
    injectRepMotion(); injectRepMotion(); injectRepMotion();
    expect(document.querySelectorAll(`#${STYLE_ID}`).length).toBe(1);
  });

  it('⚠ an ABSENT matchMedia means "no preference", which is motion ALLOWED', () => {
    // jsdom's own state. Defaulting the other way would make every test in the suite
    // assert the reduced path and leave the ordinary one unexercised.
    expect(window.matchMedia).toBeUndefined();
    expect(prefersReducedMotion()).toBe(false);
    expect(entrance()).toHaveProperty('animation');
  });

  it('⚠ a THROWING matchMedia is not a preference either', () => {
    // Some embedded webviews reject an unknown media feature rather than reporting
    // false. Treating a throw as "reduced" would silently kill motion for them.
    window.matchMedia = () => { throw new Error('unsupported'); };
    expect(prefersReducedMotion()).toBe(false);
  });

  it('⚠ when reduced motion IS requested, entrance and press emit NOTHING', () => {
    stubReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(entrance()).toEqual({});
    expect(pressTransition(true)).toEqual({});
    expect(pressTransition(false)).toEqual({});
  });

  it('⚠ and the PAIRED POSITIVE on the same stub — motion allowed emits declarations', () => {
    // Without this, "reduced emits nothing" is satisfied by a system that emits nothing
    // ever — which would pass while the whole feature was dead.
    stubReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(entrance().animation).toContain('rmRepRise');
    expect(pressTransition(false).transition).toContain(`${MOTION.fast}ms`);
  });
});

describe('Canvass-9b — the press asymmetry, which is the ruling', () => {
  it('press-in is ZERO and press-out eases', () => {
    // "feel like a decision when you click without friction" is a DIRECTION, not a
    // duration: a control that eases INTO its pressed state has already added the
    // friction the brief forbids.
    expect(MOTION.pressIn).toBe(0);
    expect(pressTransition(true).transition).toContain('0ms');
    expect(pressTransition(false).transition).toContain(`${MOTION.fast}ms`);
  });

  it('⚠ the two directions are NOT the same declaration', () => {
    // The single assertion that a symmetric transition — the default thing to write —
    // cannot satisfy.
    expect(pressTransition(true).transition).not.toBe(pressTransition(false).transition);
  });

  it('⚠ EVERY property in the list carries its OWN duration — a shorthand does not distribute one', () => {
    // ⚠ THIS FENCE EXISTS BECAUSE THE FIRST WRITING SHIPPED GREEN AND DID NOTHING.
    // `background-color, transform 140ms ease` parses as background-color at the
    // DEFAULT 0s and transform at 140ms — measured on the rendered node as
    // `transition-duration: 0s, 0.14s`. The ground swap, which is the only property
    // that changes, never eased.
    //
    // ⚠ AND THE TEST THAT MISSED IT WAS `toContain('140ms')`, WHICH THE MALFORMED
    // STRING SATISFIES. jsdom stores the shorthand verbatim and computes nothing, so
    // no declaration-level assertion can see a shorthand that parses wrongly. What CAN
    // be checked without a CSS engine is the SHAPE: split on commas, and require each
    // segment to name a property AND a duration.
    for (const pressed of [true, false]) {
      const decl = pressTransition(pressed).transition;
      const segments = splitTopLevel(decl);
      expect(segments.length, `${pressed}: expected one segment per property`).toBe(2);
      for (const seg of segments) {
        expect(seg, `${pressed}: segment "${seg}" carries no duration`).toMatch(/\s\d+m?s\b/);
        expect(seg, `${pressed}: segment "${seg}" names no property`).toMatch(/^[a-z-]+\s/);
      }
    }
  });

  it('⚠ the ground swap is the property that actually eases', () => {
    // The row's visible change is its background. A transition list that omitted it —
    // or gave it the default 0s — would leave the settle inert while the declaration
    // still looked correct, which is exactly what happened.
    const decl = pressTransition(false).transition;
    const bg = splitTopLevel(decl).find((s) => s.startsWith('background-color'));
    expect(bg, 'background-color is not in the transition list').toBeTruthy();
    expect(bg).toContain(`${MOTION.fast}ms`);
  });

  it('the release uses a DECELERATION curve, not ease-in-out', () => {
    // "Buttery" mechanically means fast departure, soft arrival. An ease-in-out on an
    // arrival spends its first third barely moving, which reads as sluggish.
    expect(pressTransition(false).transition).toContain(MOTION.out);
  });

  it('durations stay SWIFT — nothing over 260ms', () => {
    // The brief's own word. Pinned as a ceiling rather than as exact values, so tuning
    // stays free while "slow" stays forbidden.
    for (const key of ['pressIn', 'fast', 'base']) {
      expect(MOTION[key]).toBeLessThanOrEqual(260);
    }
  });
});

describe('Canvass-9b — what animates, and what must never', () => {
  const mountShell = () => render(
    <ThemeProvider>
      <RepShell onLogout={() => {}} />
    </ThemeProvider>
  );

  it('the SCREEN carries an entrance animation', () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200,
      json: async () => ({ stats: {}, focus: { furthestAlong: [], recentlyAssigned: [] } }),
    }));
    const { container } = mountShell();
    const animated = [...container.querySelectorAll('main > div')]
      .filter((d) => (d.style.animation || '').includes('rmRep'));
    expect(animated.length, 'the screen wrapper carries no entrance animation').toBeGreaterThan(0);
  });

  it('⚠ the entrance REPLAYS on a screen change — a CSS animation only runs on mount', () => {
    // Without a changing `key` the wrapper is reused, the animation does not re-run,
    // and the first screen animates while every later one appears instantly. Asserted
    // through the observable consequence: the wrapper is a DIFFERENT element after the
    // navigation, which is what forces the replay.
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true, status: 200,
      json: async () => ({ clients: [], total: 0, limit: 100, nextCursor: null, counts: { locked: 0, provisional: 0 } }),
    }));
    const { container } = mountShell();
    const before = container.querySelector('main > div');
    fireEvent.click(document.querySelector('[data-rep-tab="clients"]'));
    const after = container.querySelector('main > div');
    expect(after).not.toBe(before);
  });

  it('⚠ THE BOTTOM NAV IS NOT ANIMATED IN — it is chrome, and chrome does not arrive', () => {
    // A nav that animates on every screen change draws the eye to the thing that did
    // not change. The entrance is scoped to the screen wrapper inside `main`.
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) }));
    const { container } = mountShell();
    const nav = container.querySelector('nav');
    expect(nav.style.animation || '').toBe('');
    const header = container.querySelector('header');
    expect(header.style.animation || '').toBe('');
  });
});
