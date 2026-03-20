# UI Audit Commit 2 Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Goal:** Fix GPU-janky progress bar animation and swap DM Mono → Roboto Mono throughout the app.

---

## Overview

Two independent visual/performance fixes in `src/App.js`. No new components, no config changes, no new files. Both changes are isolated and carry no shared state or cross-component dependencies.

---

## Fix 1: Progress Bar Animation — `width` → `transform: scaleX()`

### Problem

Both progress bars animate via `width` changes (e.g., `width: '0%'` → `width: '82%'`). Animating `width` triggers layout recalculation on every frame (the browser must reflow the surrounding document). On low-end Android devices this causes visible jank.

### Solution

Replace `width` animation with `transform: scaleX()` animation. `transform` runs on the GPU compositor thread with no layout involvement, producing smooth 60fps animation regardless of device class.

### Mechanics

For each bar element:
- Set `width: '100%'` (fixed, never changes)
- Add `transformOrigin: 'left'`
- Replace `width: animated ? 'X%' : '0%'` with `transform: animated ? 'scaleX(X)' : 'scaleX(0)'`
- Replace `transition: 'width Ns ...'` with `transition: 'transform Ns ...'`

The container already has `overflow: hidden` on both bars, so scaled content is correctly clipped.

### Bars to fix

| Location | Variable | Current value → animated value |
|----------|----------|--------------------------------|
| `src/App.js` ~line 631 | `barAnimated`, `progressPct` | `scaleX(0)` → `scaleX(progressPct / 100)` |
| `src/App.js` ~line 1690 | `animated` | `scaleX(0)` → `scaleX(1)` |

Both bars keep their existing easing curves (`cubic-bezier(0.4, 0, 0.2, 1)`) and durations unchanged.

---

## Fix 2: Font Swap — DM Mono → Roboto Mono

### Problem

DM Mono is used as the monospace font (data labels, amounts, status codes, email addresses). Roboto Mono is the on-brand monospace choice and needs to replace it everywhere.

### Solution

Two-part change:

**Part A — Update the Google Fonts URL** in `useReferrerFonts()` (~line 95):
- Remove: `DM+Mono:wght@400;600`
- Add: `Roboto+Mono:wght@400;600`

`useAdminFonts()` does not load DM Mono and requires no change.

**Part B — Update the font token and hardcoded strings:**

1. `R.fontMono` (~line 70): `"'DM Mono', monospace"` → `"'Roboto Mono', monospace"`
   - This propagates automatically to all 40+ referrer-app usages via the token.

2. Six hardcoded `'DM Mono', monospace` strings in the admin panel (lines ~1723, ~1882, ~1913, ~1975, ~2046, ~2059):
   - These do not use `R.fontMono` (they predate the token or were written independently).
   - Line ~2059 is inside a conditional expression: `fontFamily: mono ? "'DM Mono', monospace" : AD.fontSans` — this string must be updated inside the conditional.
   - Replace each literal string with `'Roboto Mono', monospace`.

### No other changes needed

- `useAdminFonts()` does not need its own Roboto Mono import. `useReferrerFonts()` is called unconditionally in the root `App` component and will append the Roboto Mono `<link>` tag to `document.head` on the same render cycle. Both hooks share the same browser document, so the font is available. **Note:** if the admin panel is ever extracted into a separate route or entry point, `useAdminFonts()` will need its own Roboto Mono import at that time.
- No CSS files, no `index.html`, no other files are involved.

---

## File Map

| File | Changes |
|------|---------|
| `src/App.js` | All edits — 2 progress bar elements, Google Fonts URL, `R.fontMono` token, 6 hardcoded admin strings |

---

## Verification

### Progress bar
- Open the referrer app → Pipeline tab. The pipeline bar should animate smoothly on load with no layout jank.
- Open the admin panel → Dashboard. The stat bars should animate smoothly.
- In Chrome DevTools → Rendering → enable "Paint flashing" — no green flash should occur during the bar animation (confirms compositor-only rendering).

### Font
- All monospaced text in the referrer app (balance amounts, timestamps, pipeline codes, reward schedule) renders in Roboto Mono.
- All monospaced text in the admin panel (emails, payout amounts, status indicators) renders in Roboto Mono.
- In the admin panel, open a cash-out request detail view. Verify that values rendered with the `mono` prop (payout amounts, email addresses in the detail block) display in Roboto Mono — this exercises the conditional `mono ? '...' : AD.fontSans` expression at line ~2059.
- Visual weight and spacing feel consistent with the previous DM Mono usage — both are true monospace fonts with similar metrics.
