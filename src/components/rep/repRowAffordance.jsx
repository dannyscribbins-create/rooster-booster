import { useState } from 'react';
import { CaretRight } from '@phosphor-icons/react';

// ─── "THIS ROW OPENS SOMETHING" — Canvass-9a, Part 3e ────────────────────────
//
// ⚠ THE DEFECT THIS FIXES IS NOT COSMETIC: DANNY DID NOT KNOW THE ROWS OPENED
// ANYTHING. Both list screens have shipped tappable rows since Canvass-4 — a
// `role="button"`, a `tabIndex`, an Enter/Space handler and a pointer cursor — and
// none of that is visible on a phone. A screen reader was told; a person was not.
//
// RULED: a chevron at the right edge, plus press feedback.
//
// ⚠ HOVER IS NOT AN OPTION AND IS NAMED HERE SO IT IS NOT REACHED FOR. There is no
// hover on a phone, so `:hover` affordances are invisible to the entire audience of
// this app. `cursor: pointer` has the same problem — it is a desktop-only signal
// that has been present the whole time and communicated nothing.
//
// ⚠ AND THE MOTION SYSTEM IS 9b. This is the MINIMUM that says "this responded": an
// immediate ground swap on pointer-down. **No transition, no duration, no easing, no
// transform** — those are 9b's, along with the reduce-motion contract that Danny has
// already accepted as a from-the-start requirement rather than a retrofit. Adding a
// transition here would be starting that system inside a phase scoped away from it.
// ⚠ WHICH ALSO MEANS THE FEEDBACK IS CORRECT UNDER `prefers-reduced-motion` TODAY,
// by construction rather than by a media query: an instant colour change is not
// motion. 9b inherits a working baseline instead of having to carve an exception.

// ── PRESS STATE ─────────────────────────────────────────────────────────────
//
// ⚠ POINTER EVENTS, NOT MOUSE OR TOUCH EVENTS. `onPointerDown` fires for touch, pen
// and mouse alike, so one pair of handlers serves the phone this app is for AND the
// desktop it is inspected on. A `touchstart`/`mousedown` pair would be two code
// paths for one behaviour and they would drift.
//
// ⚠ `onPointerCancel` AND `onPointerLeave` ARE BOTH REQUIRED, AND LEAVING EITHER OUT
// LEAVES A ROW STUCK LOOKING PRESSED. A scroll gesture that begins on a row cancels
// the pointer without ever firing `pointerup` — which on a 3,756-row book is the
// COMMON interaction, not an edge case. Dragging off the row fires `leave`.
//
// @returns {{pressed: boolean, pressHandlers: object}}
export function useRowPress() {
  const [pressed, setPressed] = useState(false);
  return {
    pressed,
    pressHandlers: {
      onPointerDown: () => setPressed(true),
      onPointerUp: () => setPressed(false),
      onPointerLeave: () => setPressed(false),
      onPointerCancel: () => setPressed(false),
      // A keyboard activation has no pointer, so the visual state is driven by focus
      // instead of being faked — the row is already reachable by Tab and already
      // responds to Enter and Space.
      onBlur: () => setPressed(false),
    },
  };
}

// ── THE CHEVRON ─────────────────────────────────────────────────────────────
//
// ⚠ `aria-hidden`, AND THAT IS NOT AN OVERSIGHT. The row itself already carries
// `role="button"`, so it announces as activatable; a chevron given a label would
// announce a SECOND control that does not exist. It is a sighted-user affordance and
// is marked as exactly that.
//
// ⚠ IT IS FADED, AND DELIBERATELY NOT TO THE TEXT CONSTANT. A chevron is a GRAPHIC
// element answering the **3:1** floor, not the 4.5 text floor, and `MUTED = 0.72` is
// a value derived for text on three specific grounds. Reusing it here would be the
// "a safety measure copied from a prior phase must be RE-DERIVED" failure — the same
// mistake A34.2 refused to make when it declined to write `MUTED` onto the nav dot.
// `0.55` is the value this shell already uses for a non-text graphic (the theme
// toggle's knob), and it is re-measured on the rendered node in this phase rather
// than inherited on that precedent alone.
const CHEVRON_OPACITY = 0.55;

export function RowChevron({ size = 16 }) {
  return (
    <CaretRight
      size={size}
      weight="bold"
      aria-hidden="true"
      // ⚠ `color` IS PASSED EXPLICITLY RATHER THAN INHERITED. Phosphor's default is
      // `currentColor`, and these rows set `color` on a CHILD span rather than on the
      // row, so inheriting would take the column's colour rather than the row's ink.
      // This repo has a recorded defect where Phosphor received a value that was not
      // a colour at all and silently painted black; naming the token is what keeps
      // that visible.
      color="var(--rm-text, #1C2D4D)"
      style={{ flexShrink: 0, opacity: CHEVRON_OPACITY }}
    />
  );
}

export { CHEVRON_OPACITY };
