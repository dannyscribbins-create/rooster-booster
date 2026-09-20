import { useCallback, useEffect, useRef, useState } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { fontVar } from '../../constants/elevationTheme';
import { MOTION, entrance, prefersReducedMotion } from './repMotion';

// ─── THE LONG-PRESS REVEAL — Canvass-9b, Danny's spec ────────────────────────
//
// **On Conversions and Revenue ONLY.** Haptic feedback, a glass blur over the
// card's own content, and a panel opening downward with two figures side by side,
// each titled above its number.
//
// ── ⚠ IT IS THE ONLY LONG-PRESS IN THE APP, WHICH DANNY NAMED AS THE RISK ──────
// A gesture used once is a gesture nobody discovers. Two things answer that, and
// neither is teaching the gesture in text:
//
//   1. **A VISIBLE CONTROL OPENS THE SAME PANEL.** The caret in the heading row is
//      a plain tap target. It is the card's hint that there is more here — without
//      a line of copy saying "hold me", which would be instruction rather than
//      design. **The long-press is a SHORTCUT to a thing that is already reachable**,
//      which is exactly Danny's constraint: neither affordance may be the only route
//      to a fact.
//   2. **The card's own face still carries the number and its definition.** The
//      reveal adds a breakdown; it does not hold the headline figure hostage.
//
// ⚠ SO THE ANSWER TO "DOES THE CARD HINT IT IS HOLDABLE" IS: IT HINTS THAT IT HOLDS
// MORE, AND DOES NOT ADVERTISE THE GESTURE. Advertising it would cost a line of
// copy on the app's most-read screen to teach a shortcut; hinting costs a caret.
//
// ── ⚠ THE FROST: TWO LAYERS, AND THE FIRST WRITING HAD IT BACKWARDS ───────────
//
// **Danny eye-tested it in production and the blur read as unintentional** — the
// card's original number was faintly visible top-left, sitting over the word
// "Referral", with ghosted text behind. Ruled: a glassy blurred effect with the
// revealed text **fully solid** over it; the underlying content reads as frosted,
// never as a second legible layer.
//
// ⚠ THE CAUSE WAS `opacity: 0.98` ON THE PANEL, AND IT IS THIS REPO'S OWN RECORDED
// RULE BITING ME: **OPACITY INHERITS.** On the container it made the panel's own
// TEXT translucent, so the card showed through the very words meant to cover it.
// Same defect as the payout figure muted by a faded paragraph it sat inside — and I
// wrote that rule into `RepInfoIcon` in this same phase, then broke it here.
//
// ⚠ MY EARLIER NOTE SAID *"the overlay carries a near-opaque background AND the
// blur; the blur is the finish, the background is the contract."* **The intent was
// right and the implementation did the opposite**, which is why the sentence is
// corrected rather than deleted: it described a design that was never built.
//
// **AS BUILT: the translucency lives on a dedicated `data-rep-reveal-frost` element
// and the content is its SIBLING.** The text has no ancestor carrying an opacity, so
// it is opaque by construction rather than by care.
//
// ⚠ AND THE TINT IS CHOSEN BY FEATURE DETECTION, NOT FIXED. With `backdrop-filter`
// the blur already destroys legibility, so a lighter tint keeps it GLASSY — what was
// asked for. Without it, glassy would mean "a second legible layer", so the tint goes
// near-opaque and the panel trades the effect for the contract. **The ruling is that
// the two layers are never both legible; the glass is what we keep when we can
// afford it.**
//
// ── ⚠ HAPTICS ARE GUARDED AND ARE NOT A FEATURE ANYTHING DEPENDS ON ────────────
// `navigator.vibrate` does not exist on iOS Safari at all and throws in jsdom. It is
// a confirmation that the hold registered, so its absence costs nothing and must
// never be allowed to throw. Same shape as `prefersReducedMotion`'s guard.
//
// ⚠ AND IT IS SUPPRESSED UNDER REDUCED MOTION. A viewer who asked for less motion is
// making an accessibility request about non-essential sensory effects, and a buzz is
// one — the OS setting is the nearest signal we have, and honouring it is the
// conservative reading.

const LONG_PRESS_MS = 450;

// ⚠ FEATURE-DETECTED ONCE, NOT ASSUMED, AND NOT GUESSED FROM A USER AGENT.
// `backdrop-filter` decides which tint the frost uses (see the panel), and getting
// that wrong in the unsupported direction means two legible layers — the exact thing
// Danny ruled against. `CSS.supports` asks the engine rather than inferring from a
// browser name, which is the only form of this check that stays true.
// ⚠ GUARDED FOR jsdom, WHICH IMPLEMENTS NO `CSS.supports` — and an absent answer is
// treated as NOT SUPPORTED, so the safe near-opaque tint is what a test and any
// unknown engine get. **The fallback direction is the readable one**, which is the
// opposite of how `prefersReducedMotion` defaults and is right for the same reason:
// each guard fails toward the outcome that cannot mislead.
const SUPPORTS_BACKDROP = (() => {
  try {
    return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
      && (CSS.supports('backdrop-filter', 'blur(1px)')
          || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
  } catch { return false; }
})();

// ⚠ MEASURED AGAINST THE PLATFORM CONVENTION RATHER THAN CHOSEN. iOS uses ~500ms for
// its own long-press and Android ~400-500ms; below ~350ms an ordinary tap starts
// firing it by accident, and above ~600ms it reads as unresponsive. 450 sits inside
// both platforms' expectations.

function vibrate(ms) {
  if (prefersReducedMotion()) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    // A refusing or throwing vibrate is not an error worth surfacing — the gesture
    // still worked and the panel still opened.
  }
}

/**
 * One titled figure inside the reveal.
 *
 * ⚠ A FIGURE WITH NO SOURCE RENDERS AN HONEST SENTENCE, NEVER A ZERO. A24.4/A34.6's
 * whole point is that "you may not see this", "this does not exist yet" and "this is
 * nought" are three different claims, and a `0` in a titled slot asserts the third.
 */
function Figure({ title, value, empty }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 0 }}>
      <p style={{
        margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
        textTransform: 'uppercase', opacity: 0.72,
        color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body'),
      }}>
        {title}
      </p>
      {empty ? (
        <p style={{
          margin: '4px 0 0', fontSize: 13, lineHeight: 1.4, opacity: 0.72,
          color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body'),
        }}>
          {empty}
        </p>
      ) : (
        <p style={{
          margin: '2px 0 0', fontSize: 22, fontWeight: 700, lineHeight: 1.15,
          color: 'var(--rm-text, #1C2D4D)', fontFamily: fontVar('body'),
        }}>
          {value}
        </p>
      )}
    </div>
  );
}

/**
 * Wraps a card's content and adds the reveal.
 *
 * @param {React.ReactNode} children - the card's ordinary face.
 * @param {string} revealLabel - the accessible name of the control.
 * @param {{title: string, value?: React.ReactNode, empty?: string}} left
 * @param {{title: string, value?: React.ReactNode, empty?: string}} right
 */
export default function RepRevealCard({ children, revealLabel, left, right, testId = null }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const root = useRef(null);
  // ⚠ TRACKS WHETHER THE HOLD ALREADY FIRED, so the click that follows a long press
  // does not immediately toggle the panel shut again. A pointerup after a fired hold
  // is the SAME gesture, not a second one.
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  // ⚠ CLEARED ON UNMOUNT. A card that unmounts mid-hold — a tab switch, a re-fetch
  // replacing the list — would otherwise fire setState on a gone component.
  useEffect(() => clear, [clear]);

  // ── ⚠ FIX 3 — TAPPING OUTSIDE THE CARD CLOSES IT ───────────────────────────
  // Danny: *"No way back. Nothing closes it once open."* Ruled: an outside tap
  // closes, **which also makes it read as a temporary window rather than a fixed
  // state** — that second half is the real reason, and it is why an outside tap beats
  // adding a close button. A dismissable overlay teaches its own impermanence.
  //
  // ⚠ THE LISTENER IS ATTACHED ONLY WHILE OPEN, so a screen full of cards is not a
  // screen full of document listeners. On a 3,756-row book that distinction is the
  // difference between one listener and one per card.
  //
  // ⚠ AND IT IS ATTACHED IN AN EFFECT, WHICH IS WHAT STOPS THE OPENING GESTURE FROM
  // IMMEDIATELY CLOSING IT. The `pointerdown` that opened the panel has already
  // finished dispatching by the time this effect runs, so the handler cannot see its
  // own opening event — a listener added synchronously inside the opening handler
  // would catch the very same event bubbling to the document and close on open.
  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => {
      // ⚠ `contains` ON THE CARD, NOT ON THE PANEL. The caret and the card face are
      // both legitimate places to tap while open — tapping the caret must TOGGLE, not
      // toggle-then-close-again — so anything inside the card is "not outside".
      if (root.current && !root.current.contains(e.target)) setOpen(false);
    };
    // `pointerdown` rather than `click`: it fires on the gesture that begins the
    // dismissal, so the panel is gone before a scroll or a tap on something else
    // completes. `capture` so a child calling stopPropagation cannot trap it open.
    document.addEventListener('pointerdown', onOutside, true);
    return () => document.removeEventListener('pointerdown', onOutside, true);
  }, [open]);

  const start = () => {
    fired.current = false;
    clear();
    timer.current = setTimeout(() => {
      fired.current = true;
      vibrate(10);
      setOpen(true);
    }, LONG_PRESS_MS);
  };

  const end = () => clear();

  return (
    <div
      ref={root}
      data-rep-reveal-card=""
      data-testid={testId}
      data-rep-reveal-open={open ? 'true' : 'false'}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      // ⚠ BOTH CANCEL AND LEAVE, for the same reason the row press needs both: a hold
      // that becomes a scroll fires `pointercancel` and never `pointerup`, and on a
      // long list that is the common gesture rather than an edge case.
      onPointerCancel={end}
      onContextMenu={(e) => {
        // ⚠ A LONG PRESS ON MOBILE RAISES THE NATIVE CONTEXT MENU / TEXT SELECTION
        // UNLESS THIS IS SUPPRESSED, and that menu would appear ON TOP of the panel
        // the same gesture just opened. Suppressed only while this card is the
        // target, never globally.
        if (fired.current) e.preventDefault();
      }}
      style={{ position: 'relative' }}
    >
      {children}

      {/* ── THE VISIBLE ROUTE. Same panel, plain tap, no gesture to discover. ── */}
      <button
        type="button"
        data-rep-reveal-toggle=""
        aria-expanded={open}
        aria-label={revealLabel}
        onClick={() => { if (!fired.current) setOpen((v) => !v); fired.current = false; }}
        style={{
          position: 'absolute', top: 10, right: 10,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, padding: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--rm-text, #1C2D4D)',
        }}
      >
        {open
          ? <CaretUp size={15} weight="bold" aria-hidden="true" />
          : <CaretDown size={15} weight="bold" aria-hidden="true" />}
      </button>

      {open && (
        <div
          data-rep-reveal-panel=""
          role="group"
          aria-label={revealLabel}
          style={{
            // ⚠ COVERS THE CARD'S OWN CONTENT, WHICH IS WHAT "over the card" MEANS —
            // it is not a panel pushed below. `inset: 0` with a downward-opening
            // animation gives the frost something to sit over.
            position: 'absolute', inset: 0,
            borderRadius: 12,
            overflow: 'hidden',
            fontFamily: fontVar('body'),
            // ⚠ OPENS DOWNWARD, per the spec — a transform origin at the top with a
            // rise animation reads as unfolding from the heading rather than fading
            // in place. Suppressed entirely under reduced motion by `entrance()`.
            transformOrigin: 'top center',
            // ⚠ THE BLUR LIVES ON THE PANEL, NOT ON THE FROST CHILD, AND THAT IS A
            // CORRECTION MADE FROM A SCREENSHOT AFTER THE NUMBERS SAID IT WAS FINE.
            // Moving it to the child left the card's text CRISP AND FULLY LEGIBLE
            // behind the panel — Danny's exact complaint, unfixed — while every
            // declaration-level reading looked right.
            //
            // ⚠ THE CAUSE IS THE STACKING CONTEXT: this panel carries an `animation`,
            // which creates one, so a `backdrop-filter` on a DESCENDANT resolves its
            // backdrop against the panel rather than against the card behind it —
            // and the panel's own background is transparent, so it blurred nothing.
            // On the panel itself the backdrop IS the card, which is where it works.
            // **`backdrop-filter` is positional, not decorative: where it sits decides
            // what it can see.**
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            // ⚠ FIX 1 — `settle`, NOT `base`. Danny eye-tested it: "the whiteout takes
            // the card too suddenly". A panel that covers what someone is reading is
            // the one case where arriving fast reads as a snatch. It is a SETTLE, and
            // the motion rule says a settle eases.
            ...entrance({ duration: MOTION.settle }),
          }}
        >
          {/* ── ⚠ FIX 2 — THE FROST IS ITS OWN LAYER, AND THAT IS THE WHOLE FIX ──
              Danny: the blur read as unintentional — the original number was faintly
              visible top-left, sitting over "Referral", with ghosted text behind.

              ⚠ THE CAUSE WAS `opacity: 0.98` ON THE PANEL, AND IT IS THIS REPO'S OWN
              RECORDED RULE BITING ME: **OPACITY INHERITS.** Putting it on the
              container made the panel's TEXT translucent too, so the card's content
              showed through the very words meant to cover it. That is the same defect
              as the payout figure muted by a faded paragraph it happened to sit
              inside — and I wrote the rule into `RepInfoIcon` in this same phase.

              **So the translucency moves to a dedicated backdrop element and the
              content becomes a SIBLING, not a child.** The text is now fully opaque
              by construction: there is no ancestor carrying an opacity for it to
              inherit. The two layers can never both be legible.
              ⚠ `aria-hidden` — it is a pane of glass, not content. */}
          <div
            data-rep-reveal-frost=""
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              background: 'var(--rm-surface, #FFFFFF)',
              // ⚠ TINT ONLY — THE BLUR IS ON THE PANEL, FOR THE STACKING-CONTEXT
              // REASON RECORDED THERE. This layer exists solely to carry the
              // translucency, so that the revealed TEXT — its sibling — has no
              // translucent ancestor to inherit from.
              //
              // ⚠ TWO TINTS, CHOSEN BY WHETHER THE BLUR ACTUALLY WORKS. With
              // `backdrop-filter` the blur already destroys legibility, so a heavier
              // tint is unnecessary and a lighter one keeps it GLASSY — what Danny
              // asked for. Without it, glassy would mean "a second legible layer", so
              // the tint goes near-opaque and the panel trades the effect for the
              // contract. **The ruling is that the two layers are never both legible;
              // the glass is what we keep when we can afford it.**
              // ⚠ 0.86 RATHER THAN 0.72, MEASURED FROM A SCREENSHOT: at 0.72 the
              // blurred text underneath was still a visible ghost behind the figures.
              // Blur alone is not enough on a card whose own type is large and bold.
              opacity: SUPPORTS_BACKDROP ? 0.86 : 0.97,
            }}
          />

          {/* ⚠ `position: relative` PUTS THE CONTENT ABOVE THE FROST without a
              z-index race — a positioned sibling later in the DOM wins. */}
          <div
            style={{
              position: 'relative',
              height: '100%',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              gap: 10, padding: '14px 16px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <Figure {...left} />
              <Figure {...right} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { LONG_PRESS_MS, MOTION };
