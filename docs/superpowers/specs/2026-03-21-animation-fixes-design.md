# Animation Fixes: Session Flag + Specific Transitions — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Overview

Two targeted animation fixes to `src/App.js`, delivered in one commit:

1. **Fix 1 (#1)** — Entrance animations fire only once per browser tab session; subsequent tab switches feel instant
2. **Fix 2 (#9)** — Replace all 16 `transition: all` instances with specific-property transitions for better render performance

No backend changes. No new files. No new dependencies.

---

## Fix 1 — Entrance Animation Session Flag

**File:** `src/App.js`
**Locations:** `useEntrance` hook (~line 88), `AnimCard` component (~line 127), and ~14 `AnimCard` call sites across 5 screens

### Problem

`useEntrance` initializes with `useState(false)`. React recreates component state on every mount, so every tab switch re-mounts the screen and restarts all entrance animations. This looks broken — content "pops in" every time the user switches tabs.

### Approach

Modify `useEntrance` to accept an optional `screenKey`. When provided, use a lazy `useState` initializer to check `sessionStorage` before the first render. If the screen has already been seen this session, start visible immediately (no animation). If not, animate as normal and record it once the animation completes.

`sessionStorage` is the right store: it persists for the lifetime of the browser tab and clears automatically when the tab closes, so the entrance animation plays once per session as intended.

### Changes

#### `useEntrance` (line 88)

**Before:**
```js
function useEntrance(delay = 0) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return visible;
}
```

**After:**
```js
function useEntrance(delay = 0, screenKey = '') {
  const [visible, setVisible] = useState(() =>
    screenKey ? !!sessionStorage.getItem(`rb_seen_${screenKey}`) : false
  );
  useEffect(() => {
    if (visible) return;
    const t = setTimeout(() => {
      setVisible(true);
      if (screenKey) sessionStorage.setItem(`rb_seen_${screenKey}`, '1');
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return visible;
}
```

Key details:
- Lazy initializer (`useState(() => ...)`) runs only once per mount and avoids a flash
- `if (visible) return` short-circuits the effect when already seen — no timer started, no setState call
- The `screenKey` is captured at mount time; the empty `[]` dep array is intentional and safe
- `sessionStorage.setItem` called inside the timeout callback, exactly when the card becomes visible

#### `AnimCard` (line 127)

Add `screenKey` prop, pass through to `useEntrance`:

**Before:**
```jsx
function AnimCard({ children, delay = 0, style = {} }) {
  const visible = useEntrance(delay);
```

**After:**
```jsx
function AnimCard({ children, delay = 0, screenKey = '', style = {} }) {
  const visible = useEntrance(delay, screenKey);
```

### Call Sites — Which AnimCards Get a `screenKey`

The session flag applies only to **static layout cards** that are always present when a screen first loads. Dynamic list items (rendered with `key={item.id}`) and step-conditional cards (in the CashOut flow) do **not** get a key — their animation timing is driven by data/state, not screen load.

**Rule:** If an `<AnimCard>` has a `key={}` prop from its parent map(), it does NOT get `screenKey`.

#### Dashboard — `screenKey="dashboard"`

| Line | Usage |
|------|-------|
| ~557 | `<AnimCard delay={100}` — balance card |
| ~613 | `<AnimCard delay={200}` — quick stats row |
| ~664 | `<AnimCard delay={280}` — referral tips / booster info |
| ~740 | `<AnimCard delay={360}` — recent referrals section wrapper |
| ~805 | `<AnimCard delay={600}` — Google Review banner |

Not keyed: `<AnimCard key={ref.id} delay={400 + idx * 60}` (dynamic referral items in the list)

#### Pipeline — `screenKey="pipeline"`

| Line | Usage |
|------|-------|
| ~898 | `<AnimCard key={s.label} delay={i * 60}` — stage stats row |

These use `key={s.label}` from a map but the labels are static constants (not data IDs). Add `screenKey="pipeline"` here.

Not keyed: `<AnimCard key={ref.id} delay={idx * 55}` (dynamic referral cards)

#### CashOut — `screenKey="cashout"`

No static layout AnimCards exist on the CashOut screen. The stepper header (lines 1062–1090) is a plain `<div>` with no AnimCard wrapper.

All four AnimCards are step-conditional (should animate fresh on each step progression):
- `<AnimCard delay={0}` at ~1020 (step 4 success card — only shown after form submission)
- `<AnimCard delay={80}` at ~1097 (step 1 panel — appears on user action)
- `<AnimCard delay={0}` at ~1143 (step 2 panel — appears on user action)
- `<AnimCard delay={0}` at ~1220 (step 3 panel — appears on user action)

None receive `screenKey`.

#### History — `screenKey="history"`

| Line | Usage |
|------|-------|
| ~1339 | `<AnimCard key={s.label} delay={i * 80}` — stats row |
| ~1361 | `<AnimCard delay={160}` — empty state card |

Not keyed: `<AnimCard key={item.id} delay={160 + idx * 60}` (dynamic earned history items)

#### Profile — `screenKey="profile"`

| Line | Usage |
|------|-------|
| ~1455 | `<AnimCard delay={80}` — stats card |
| ~1481 | `<AnimCard delay={160}` — Contact Support button |
| ~1498 | `<AnimCard delay={220}` — Sign Out button |

#### Login screen — NO `screenKey`

`cardVisible = useEntrance(80)` at ~line 305 is called directly (not via `AnimCard`) and has no screen key. The login screen should animate fresh on every visit.

### Summary of Changes

- `useEntrance`: 2 lines changed in signature + body
- `AnimCard`: 2 lines changed (prop + call)
- ~11 `<AnimCard` call sites updated to add `screenKey` prop (Dashboard: 5, Pipeline: 1, History: 2, Profile: 3; CashOut: none)

---

## Fix 2 — Replace `transition: all`

**File:** `src/App.js`
**Locations:** 16 occurrences

### Problem

`transition: all` tells the browser to watch every CSS property on every composited frame — including properties that never animate. For list-heavy screens (Pipeline, History) this creates unnecessary style recalculation on every interaction. Scoping transitions to the specific animated properties eliminates this overhead.

### Changes

All 16 replacements below. Each preserves the original duration and easing — only the property scope changes.

| Line | Context | Replace `transition: "all ..."` with |
|------|---------|--------------------------------------|
| ~353 | Login brand mark entrance | `"opacity 0.5s ease, transform 0.5s ease"` |
| ~380 | Login card entrance | `"opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s"` |
| ~454 | Sign In button hover | `"transform 0.2s, box-shadow 0.2s, background 0.2s"` |
| ~599 | Cash Out button hover | `"transform 0.2s, box-shadow 0.2s"` |
| ~847 | Google Review button hover | `"transform 0.2s"` |
| ~927 | Pipeline filter pills | `"background 0.2s, border-color 0.2s, color 0.2s"` |
| ~1073 | CashOut stepper circle | `"background 0.3s, border-color 0.3s"` |
| ~1110 | CashOut method select button | `"border-color 0.2s, box-shadow 0.2s, background 0.2s"` |
| ~1170 | CashOut amount quick-pick buttons | `"background 0.15s, border-color 0.15s"` |
| ~1488 | Profile Contact Support button | `"background 0.2s"` |
| ~1505 | Profile Sign Out button | `"background 0.2s"` |
| ~1609 | Admin nav buttons | `"background 0.15s, color 0.15s"` |
| ~1705 | Admin `Btn` component | `"background 0.15s, opacity 0.15s, transform 0.15s"` |
| ~1871 | Admin dashboard link cards | `"transform 0.15s, box-shadow 0.15s"` |
| ~2124 | AdminCashOuts filter buttons | `"background 0.15s, color 0.15s, box-shadow 0.15s"` |
| ~2203 | AdminActivity filter buttons | `"background 0.15s, color 0.15s, box-shadow 0.15s"` |

No visual change. No new behavior. Purely a render performance improvement.

---

## Files Changed

- `src/App.js` — three locations for Fix 1, sixteen for Fix 2:
  1. `useEntrance` hook updated
  2. `AnimCard` component updated
  3. ~11 `AnimCard` call sites updated with `screenKey` prop
  4. 16 `transition: all` values replaced with specific-property transitions

---

## Out of Scope

- Making the greeting name dynamic (separate concern)
- Admin panel entrance animations (admin panel is not tab-based; sessions are short)
- CSS-based animation (all animations remain JS-driven via `useEntrance`)
- Removing animations entirely on reduced-motion preference (separate a11y task)
