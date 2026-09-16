// ─────────────────────────────────────────────────────────────────────────────
// THE BODY DEFAULTS — WHAT src/index.css USED TO DO, WITHOUT THE FILE
//
// ⚠ `src/index.css` WAS A CRA LEFTOVER AND A STANDING VIOLATION of CLAUDE.md's
// "All styling inline. Never add CSS files." It is gone (Palette-16). It held
// five declarations and this module carries the four that still had a job:
//
//     body { margin: 0 }                        -- also written by App.jsx's
//                                                  font loader, but that runs
//                                                  after mount; this is the
//                                                  first paint.
//     body { font-family: <system stack> }      -- THE LOAD-BEARING ONE.
//     body { -webkit-font-smoothing: antialiased }
//     body { -moz-osx-font-smoothing: grayscale }
//
// ⚠ THE FIFTH IS NOT HERE AND THAT IS DELIBERATE: `code { font-family: … }`.
// Nothing in `src/` renders a `<code>` element — checked, zero matches — so it
// was styling for a tag the product does not use. Carrying it forward would
// have been preserving the file's contents rather than its behaviour.
//
// ── ⚠ WHY THE SYSTEM STACK IS KEPT RATHER THAN IMPROVED HERE ────────────────
// It is tempting to write the PLATFORM font here instead. That would change the
// admin tree, the legal pages and the crash screen — every surface that renders
// OUTSIDE `ThemeProvider` — and the admin tree has been deliberately untouched
// for fourteen phases. So this reproduces the removed file EXACTLY, and the
// improvement happens where it is safe: `ThemeProvider` additionally writes the
// MOUNTED body font, so anything inheriting inside the themed tree gets the
// contractor's face instead of this.
//
// ⚠ THAT SPLIT IS WHAT MAKES THE REMOVAL SAFE RATHER THAN MERELY TIDY.
// Measured in a browser before the change: of 232 visible text nodes across
// four surfaces, exactly ONE that a real visitor sees inherited `body`'s font —
// `ExperiencePopup`'s character counter, whose card declares no family and
// whose ancestors reach `body` without passing through `Screen`. Deleting the
// rule outright would have moved that text to the browser default. The
// provider's write moves it to the contractor's face instead, and closes the
// whole class rather than the one node a walkthrough happened to open.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ THE EXACT DECLARATIONS THE REMOVED FILE CARRIED. Held as data rather than
// inlined so a test can compare them against the original rather than against
// the module's own behaviour, which would be circular.
export const BODY_DEFAULTS = Object.freeze({
  margin: '0',
  // Byte-for-byte the stack `src/index.css` put on `body`.
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', " +
    "'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  webkitFontSmoothing: 'antialiased',
  mozOsxFontSmoothing: 'grayscale',
});

/**
 * Applies the former `index.css` body rule imperatively.
 *
 * Called once from `src/index.jsx`, where the stylesheet used to be imported,
 * so the declarations land at the same point in startup they always did.
 *
 * ⚠ IDEMPOTENT, AND A TEST PINS THAT. It runs on every module evaluation, which
 * under Vite's HMR is more than once; writing the same values twice must not
 * accumulate or reorder anything.
 *
 * ⚠ THE TWO SMOOTHING HINTS GO THROUGH setProperty BECAUSE THEY ARE
 * VENDOR-PREFIXED. `style.webkitFontSmoothing = …` is not reliably reflected —
 * the same class of silent no-op as `link.as`, which App.jsx records having
 * shipped a preload that did nothing.
 */
export function applyBodyDefaults() {
  const s = document.body.style;
  s.margin = BODY_DEFAULTS.margin;
  s.fontFamily = BODY_DEFAULTS.fontFamily;
  s.setProperty('-webkit-font-smoothing', BODY_DEFAULTS.webkitFontSmoothing);
  s.setProperty('-moz-osx-font-smoothing', BODY_DEFAULTS.mozOsxFontSmoothing);
}
