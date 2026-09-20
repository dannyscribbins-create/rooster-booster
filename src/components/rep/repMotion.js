// ─── THE REP APP'S MOTION SYSTEM — Canvass-9b ────────────────────────────────
//
// Danny's brief, recorded verbatim because the words are the specification and a
// paraphrase would lose it: motion should feel **"clean, buttery, tactile,
// empowering, informative, and swift"**, and interacting should **"feel like a
// decision when you click without friction"**.
//
// ── ⚠ THE ONE SENTENCE THAT DECIDED THE WHOLE SHAPE ─────────────────────────
// *"feel like a decision … without friction"* is not a duration, it is a
// DIRECTION. A control that eases INTO its pressed state has already added
// friction — the app is visibly thinking about whether you pressed it. So:
//
//     **response is INSTANT. Only the SETTLE is eased.**
//
// `PRESS_IN` is 0ms and is not a placeholder to be tuned later. The tactile
// quality comes from the release, not the press.
//
// ── ⚠ AND THE CONSTRAINT THAT RULES OUT THE OBVIOUS FLOURISH ────────────────
// Danny's test case is **a 3,756-client book on a mid-range phone**, and scroll
// must not feel "weighed down or clunky". `REP_BOOK_LIMIT` is 100, so tapping
// Load more appends **one hundred rows in a single commit**.
//
// **THEREFORE: LIST ROWS NEVER ANIMATE IN. Not staggered, not faded, not ever.**
// A per-row entrance is the single most common "nice" motion touch and it is
// exactly the thing that would produce 100 simultaneous animations on the
// slowest device we care about. `repMotion.test.jsx` fences this, because it is
// the rule most likely to be broken by someone adding polish in good faith.
// Sections and screens animate; their contents do not.
//
// ── ⚠ REDUCED MOTION IS STRUCTURAL HERE, NOT PER-COMPONENT ──────────────────
// Danny accepted the constraint that the OS setting is honoured **"from the start
// rather than retrofit"**, and a per-component opt-in is a retrofit by
// construction: it covers what its author remembered. The blanket rule below is
// scoped to `[data-rep-shell]` and therefore covers **transitions this file never
// heard of**, including the three that already shipped —
// `RepBottomNav`'s `opacity 200ms` and `RepThemeToggleRow`'s two — none of which
// honoured any preference before this.
//
// ⚠ **`0.01ms`, NOT `0s`, AND THE DIFFERENCE IS BEHAVIOURAL.** A zeroed duration
// means some engines never fire `transitionend`/`animationend` at all, so any
// code awaiting one waits forever. An almost-zero duration is imperceptible AND
// still fires the event. This is a known technique rather than a hedge, and it is
// written down because `0s` is what a reader would "correct" it to.
//
// ⚠ **`!important` IS LOAD-BEARING** — every style in this codebase is inline, and
// an inline declaration beats a stylesheet rule unless the rule says otherwise.
// Without it this entire block is decorative. `LoadingIndicator.jsx` records the
// same thing at its own injection site; this is the second instance of one rule,
// not a second rule.

// ── THE TOKENS ──────────────────────────────────────────────────────────────
//
// ⚠ DURATIONS ARE DELIBERATELY SHORT. "Swift" is the brief's word. Anything above
// ~260ms on a phone reads as the app being slow rather than the app being smooth,
// and the screens here carry no content that needs time to be understood.
export const MOTION = Object.freeze({
  /** Press-down. ⚠ ZERO BY RULING — see the header. Not a value to tune. */
  pressIn: 0,
  /** Press-release settle, and any small same-place state change. */
  fast: 140,
  /** A screen or a section arriving. */
  base: 200,

  // ⚠ A DECELERATION CURVE, WHICH IS WHAT "BUTTERY" MEANS MECHANICALLY: fast
  // departure, soft arrival. An ease-in-out on an ENTRANCE is what makes motion
  // feel sluggish — it spends its first third barely moving.
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** For values that move BETWEEN two settled states (a toggle knob). */
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',

  /** The distance a screen or section travels on entrance. Small on purpose: a
   *  long travel reads as a page transition, and these are not pages. */
  rise: 8,
});

const STYLE_ID = 'rm-rep-motion';

// ⚠ NAMESPACED, AND THE PRECEDENT IS A MEASURED HAZARD RATHER THAN A CONVENTION.
// CSS keyframes are GLOBAL and last-definition-wins: `spin` is defined in
// SEVENTEEN places in this repo, so a shared primitive claiming a plain name
// silently redefines every one of them depending on injection order.
// `LoadingIndicator.jsx` records exactly this and took `rmSpin` for the same
// reason. These two names are unused repo-wide — verified, not assumed.
const KEYFRAMES = `
  @keyframes rmRepRise {
    from { opacity: 0; transform: translateY(${MOTION.rise}px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes rmRepFade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;

// ⚠ SCOPED TO THE REP SHELL, NOT GLOBAL. The referrer app and the admin panel have
// their own motion and their own owners; a `*` rule here would reach into both and
// silently change surfaces this phase never looked at.
const REDUCED = `
  @media (prefers-reduced-motion: reduce) {
    [data-rep-shell] *,
    [data-rep-shell] *::before,
    [data-rep-shell] *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

/**
 * Inject the rep app's keyframes and its reduced-motion contract.
 *
 * ⚠ ID-GUARDED RATHER THAN MODULE-FLAG-GUARDED. A module boolean does not survive
 * a test runner resetting the module registry between files, and cannot prevent a
 * double-inject if two modules import this one. The id can do both, which is why
 * `LoadingIndicator` uses the same guard.
 *
 * ⚠ SAFE TO CALL ON EVERY RENDER. It is a `getElementById` on the hot path and
 * nothing else once the tag exists.
 */
export function injectRepMotion() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = KEYFRAMES + REDUCED;
  document.head.appendChild(style);
}

/**
 * Whether the viewer has asked for reduced motion.
 *
 * ⚠ TWO LAYERS COVER THIS AND NEITHER IS SUFFICIENT ALONE, which is the pattern
 * `LoadingIndicator` established. The CSS block above applies before any JS runs
 * and re-evaluates live when the setting is flipped mid-session; this read happens
 * once per render, and is the layer a test can assert behaviourally.
 *
 * ⚠ GUARDED BECAUSE jsdom IMPLEMENTS NO `matchMedia` AT ALL — an unguarded call
 * throws in every test that mounts a rep screen. **Absent means "no preference
 * expressed", which is motion ALLOWED**, not motion suppressed: defaulting the
 * other way would make every test assert the reduced path and leave the ordinary
 * one unexercised.
 *
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    // ⚠ A THROWING matchMedia IS NOT A PREFERENCE EITHER. Some embedded webviews
    // reject unknown media features rather than reporting false.
    return false;
  }
}

/**
 * The entrance animation for a SCREEN or a SECTION — never for a list row.
 *
 * @param {{ delay?: number, fadeOnly?: boolean }} [opts]
 * @returns {object} an inline style fragment
 */
// ── ⚠ NO `fill-mode`, AND AN OVERSTATED DIAGNOSIS CORRECTED IN PLACE ─────────
//
// **THE OBSERVATION WAS RIGHT AND MY FIRST DIAGNOSIS WAS WRONG, AND BOTH ARE KEPT
// BECAUSE THIS REPO'S MOST EXPENSIVE RECORDED MISTAKE IS EXACTLY THAT PAIR** — an
// accurate reading promoted to a confident wrong cause, then inherited for five
// phases.
//
// **Observed, on the rendered node:** with `document.visibilityState === 'hidden'`,
// the screen wrapper computes to `opacity: 0` while every descendant is 1, and its
// animation reports `playState: "running"` with **`currentTime: 0`** — begun and
// never ticked. My contrast sweep consequently read every info icon at **1:1, ink
// identical to ground**, twice.
//
// **What I first concluded, and it was wrong:** that `animation-fill-mode: both` was
// stranding content at zero opacity and *"a rep who opens the app in a background tab
// would find a blank column"*. ⚠ **Removing the fill mode did not change the reading
// at all** — which is the evidence that killed the theory: the from-state applies
// during the ACTIVE phase regardless of fill, and the animation is in that phase.
//
// **What is actually true, measured rather than reasoned:** `finish()` takes the
// element to `opacity: 1`, and `cancel()` also leaves it at `opacity: 1`. **The
// element's natural style is visible and the animation completes to visible.** The
// zero exists only while the tab is HIDDEN and the animation has not ticked — i.e.
// only while nobody is looking — and resolves the moment the tab is foregrounded.
// **There is no blank column.**
//
// ⚠ SO THE FILL MODE IS NOT WHAT GOVERNS THIS, AND ITS REMOVAL IS NOT A FIX. It is
// kept off because the post-animation state is then the element's OWN style rather
// than a held keyframe, which is the smaller claim — **not because it rescues
// anything.** Restoring `both` would behave identically; do not expect otherwise.
//
// ⚠ THE RESIDUAL THAT IS REAL AND IS WORTH THE LINE: **an opacity entrance means
// this content reads as blank to anything measuring a HIDDEN tab** — a screenshot
// service, a prerenderer, or a harness like the one that measures this app. It bit
// the same contrast sweep twice. That is an operational fact about measurement, not
// a defect in the page, and the two must not be filed as one.
export function entrance({ delay = 0, fadeOnly = false } = {}) {
  injectRepMotion();
  if (prefersReducedMotion()) return {};
  const name = fadeOnly ? 'rmRepFade' : 'rmRepRise';
  return {
    animation: `${name} ${MOTION.base}ms ${MOTION.out} ${delay}ms`,
  };
}

/**
 * The transition for a control that must respond INSTANTLY and settle smoothly.
 *
 * ⚠ THE ASYMMETRY IS THE WHOLE POINT. `pressed === true` returns NO transition, so
 * the pressed state lands on the same frame as the pointer event — that is the
 * "without friction" half. `pressed === false` eases back over `fast` — that is
 * the "tactile" half. A symmetric transition would feel like lag on the way in.
 *
 * @param {boolean} pressed
 * @param {string} [properties] - the CSS properties to ease on release.
 * @returns {object} an inline style fragment
 */
// ⚠ THE LIST IS AN ARRAY AND EACH ENTRY GETS ITS OWN DURATION, BECAUSE THE CSS
// SHORTHAND DOES NOT DISTRIBUTE ONE ACROSS A COMMA LIST — AND GETTING THIS WRONG
// PRODUCES A TRANSITION THAT SILENTLY DOES NOTHING.
//
// ⚠ MEASURED, ON THE RENDERED NODE, AFTER THIS SHIPPED GREEN. The first writing was
// `${properties} ${MOTION.fast}ms ${MOTION.out}` over the string
// `'background-color, transform'`, which produces:
//
//     background-color, transform 140ms cubic-bezier(...)
//
// The browser parses that as TWO transitions — `background-color` with the DEFAULT
// duration of **0s**, and `transform` at 140ms. Computed on a real row:
// `transition-duration: 0s, 0.14s`. **So the ground swap — the only property that
// actually changes — never eased, and `transform`, which nothing sets, did.** The
// release settle was completely inert while looking correct in the source.
//
// ⚠ AND THE jsdom TEST PASSED AGAINST IT, which is the part worth keeping. The
// assertion was `toContain('140ms')`, and the malformed string contains '140ms'.
// jsdom stores the shorthand verbatim and computes nothing, so a declaration-level
// test cannot see a shorthand that parses into the wrong thing. `repMotion.test.jsx`
// now requires EVERY comma-separated segment to carry its own duration, which is the
// shape check that survives having no CSS engine.
const PRESS_PROPERTIES = Object.freeze(['background-color', 'transform']);

export function pressTransition(pressed, properties = PRESS_PROPERTIES) {
  injectRepMotion();
  if (prefersReducedMotion()) return {};
  const list = Array.isArray(properties) ? properties : [properties];
  const spec = pressed
    ? `${MOTION.pressIn}ms`
    : `${MOTION.fast}ms ${MOTION.out}`;
  return { transition: list.map((p) => `${p} ${spec}`).join(', ') };
}

export { PRESS_PROPERTIES };
