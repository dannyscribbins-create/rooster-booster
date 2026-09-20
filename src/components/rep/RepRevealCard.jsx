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
// ── ⚠ THE BLUR MUST NOT BE THE ONLY THING MAKING THE PANEL READABLE ────────────
// `backdrop-filter` is unsupported or disabled in more places than it is fashionable
// to admit — older Android webviews, and anywhere a user has turned off effects. If
// the overlay relied on it alone, an unsupported browser would render the panel's
// text directly over the card's own text, both fully legible, both unreadable
// together. **So the overlay carries a near-opaque background of its own AND the
// blur.** The blur is the finish; the background is the contract.
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
            // animation gives the blur something to blur.
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            gap: 10, padding: '14px 16px',
            borderRadius: 12,
            // ⚠ BOTH, AND THE ORDER OF IMPORTANCE IS BACKGROUND FIRST. See the header:
            // the blur is the finish, the near-opaque ground is the contract, and a
            // browser without `backdrop-filter` still gets a readable panel rather
            // than two layers of legible text on top of each other.
            background: 'var(--rm-surface, #FFFFFF)',
            opacity: 0.98,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            fontFamily: fontVar('body'),
            // ⚠ OPENS DOWNWARD, per the spec — a transform origin at the top with a
            // rise animation reads as unfolding from the heading rather than fading
            // in place. Suppressed entirely under reduced motion by `entrance()`.
            transformOrigin: 'top center',
            ...entrance(),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <Figure {...left} />
            <Figure {...right} />
          </div>
        </div>
      )}
    </div>
  );
}

export { LONG_PRESS_MS, MOTION };
