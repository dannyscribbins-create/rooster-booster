# UI Fixes: Time-Aware Greeting, Balance $ Size, Admin Emoji Icons — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Overview

Three targeted UI fixes to `src/App.js`, delivered in one commit:

1. **Fix 1 (#6)** — Admin panel greeting becomes time-aware ("Good morning / afternoon / evening")
2. **Fix 2 (#7)** — Balance `$` sign resized from 13px to 28px for visual proportion
3. **Fix 3 (#5)** — Admin panel `StatCard` emoji icons replaced with Phosphor icons

No backend changes. No new files. No new dependencies (Phosphor already loaded via CDN).

---

## Fix 1 — Time-Aware Greeting

**File:** `src/App.js`
**Location:** `AdminDashboard` function, line ~1793

### Current code
```jsx
<AdminPageHeader title="Good morning, Danny." subtitle="Rooster Booster · Accent Roofing"
```

### After
Add two lines immediately before the `return (` in `AdminDashboard` to compute the greeting, then use a template literal in the `title` prop:

```js
const hour = new Date().getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
```

```jsx
<AdminPageHeader title={`${greeting}, Danny.`} subtitle="Rooster Booster · Accent Roofing"
```

### Time ranges
- 0–11 → "Good morning"
- 12–16 → "Good afternoon"
- 17–23 → "Good evening"

### Scope
- Two lines added to `AdminDashboard`, one attribute changed.
- `AdminPageHeader` component is unchanged — it already renders `{title}` as a prop.
- The greeting is computed fresh on each render (component mounts once per admin session, so it reflects the time at login).

---

## Fix 2 — Balance $ Sign Size

**File:** `src/App.js`
**Location:** `Dashboard` function, line ~576

### Current code
```jsx
<span style={{ fontSize: 13, color: R.red, fontFamily: R.fontMono, fontWeight: 700, marginBottom: 8 }}>$</span>
```

### After
```jsx
<span style={{ fontSize: 28, color: R.red, fontFamily: R.fontMono, fontWeight: 700 }}>$</span>
```

### Changes
- `fontSize: 13` → `fontSize: 28`
- `marginBottom: 8` removed — this was artificially pushing the `$` upward to fake a subscript. The parent flex container uses `alignItems: "flex-end"` which naturally aligns both elements to the baseline; no manual offset needed.

### No other changes
The parent `<div>` flex container (line 575), the balance number `<span>` (52px, line 577), and all surrounding markup are unchanged.

---

## Fix 3 — Admin Panel Emoji Icons → Phosphor

**File:** `src/App.js`

### Part A: Update `StatCard` to render Phosphor icons

**Location:** `StatCard` function, line ~1677

`StatCard` currently renders the `icon` prop as raw JSX content: `{icon}`. This works for emoji strings but cannot render Phosphor class names. Change the icon container to render a Phosphor `<i>` element:

#### Current code (line 1677)
```jsx
<div style={{ width: 34, height: 34, borderRadius: 8, background: accent ? `${accent}20` : AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: accent || AD.textSecondary }}>{icon}</div>
```

#### After
```jsx
<div style={{ width: 34, height: 34, borderRadius: 8, background: accent ? `${accent}20` : AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent || AD.textSecondary }}>
  <i className={`ph ${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
</div>
```

Changes:
- `{icon}` → `<i className={`ph ${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />`
- `fontSize: 16` removed from the container div (it was controlling emoji size; icon size is now set on the `<i>` element directly)
- `aria-hidden="true"` added — all StatCard icons are decorative; the label text already describes the stat

### Part B: Update all `icon` prop values (7 call sites)

| Line | Component | Current | Replacement |
|------|-----------|---------|-------------|
| ~1821 | AdminDashboard StatCard | `"👥"` | `"ph-users"` |
| ~1822 | AdminDashboard StatCard | `"⚖️"` | `"ph-scales"` |
| ~1823 | AdminDashboard StatCard | `"✅"` | `"ph-check-circle"` |
| ~1826 | AdminDashboard StatCard | `"📋"` | `"ph-clipboard-text"` |
| ~1827 | AdminDashboard StatCard | `"🔵"` | `"ph-circle"` |
| ~1828 | AdminDashboard StatCard | `"🔍"` | `"ph-magnifying-glass"` |
| ~1829 | AdminDashboard StatCard | `"🏆"` | `"ph-trophy"` |
| ~1980 | AdminReferrers detail StatCard | `"📋"` | `"ph-clipboard-text"` |
| ~1981 | AdminReferrers detail StatCard | `"🏆"` | `"ph-trophy"` |
| ~1982 | AdminReferrers detail StatCard | `"💰"` | `"ph-currency-dollar"` |

### Out of scope for this fix
- `🐓` rooster emoji in `AdminSidebar` (line ~1590) and `AdminLogin` (line ~2253) — brand mark, to be replaced with real logo in a future session
- `🐓` rooster in the referrer login screen (line ~362) — not in admin panel, not in scope
- `🎉` in referrer Dashboard and CashOut success state — not in admin panel, not in scope

---

## Files Changed

- `src/App.js` — four locations:
  1. Two lines added + one attribute changed in `AdminDashboard` (Fix 1)
  2. One `<span>` style updated in `Dashboard` (Fix 2)
  3. `StatCard` icon container updated (Fix 3A)
  4. Seven `icon` prop values updated across `AdminDashboard` and `AdminReferrers` (Fix 3B)

---

## Out of Scope

- Making the greeting user-name dynamic (still hardcoded "Danny" — separate concern)
- Replacing the 🐓 brand mark
- Referrer app emoji (🎉 in Dashboard/CashOut)
- Dark mode
- Any admin panel changes beyond the three fixes above
