# UI Audit Commit 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace layout-triggering `width` animation with compositor-only `transform: scaleX()` on both progress bars, and swap every DM Mono reference to Roboto Mono throughout the app.

**Architecture:** All changes are in a single file (`src/App.js`). Two independent edits with no shared state or cross-component dependencies. The project has no meaningful test suite (the CRA default test is pre-broken), so verification is manual via the dev server.

**Tech Stack:** React (Create React App), inline styles, `R` and `AD` design token objects, Google Fonts via dynamically injected `<link>` tag.

---

## File Map

| File | Changes |
|------|---------|
| `src/App.js` | Referrer pipeline bar (line 633–639), admin dashboard bar (line 1690–1693), Google Fonts URL (line 95), `R.fontMono` token (line 70), 6 hardcoded `'DM Mono'` strings in admin panel (lines 1723, 1882, 1913, 1975, 2046, 2059) |

---

## Task 1: Fix Referrer Pipeline Bar Animation

**File:** `src/App.js:633–639`

The referrer app's boost-progress bar (Pipeline tab) currently animates `width` from `"0%"` to `"${progressPct}%"`. `width` changes trigger layout reflow on every frame. Replace with `transform: scaleX()` which runs on the GPU compositor thread.

The surrounding `<div>` container already has `overflow: "hidden"`, so scaled content is correctly clipped. No container changes needed.

### Step 1.1: Locate the referrer pipeline bar

Find this exact block in `src/App.js` (currently lines 631–639):

```jsx
{/* Animated progress bar */}
<div style={{ background: R.bgBlueLight, borderRadius: 999, height: 8, overflow: "hidden" }}>
  <div style={{
    width: barAnimated ? `${progressPct}%` : "0%",
    height: "100%",
    background: `linear-gradient(90deg, ${R.red} 0%, ${R.navy} 100%)`,
    borderRadius: 999,
    transition: "width 1.3s cubic-bezier(0.4, 0, 0.2, 1)",
  }} />
</div>
```

- [ ] Confirm you can see this block.

---

### Step 1.2: Replace the inner `<div>` style

Replace the inner `<div style={{...}} />` with:

```jsx
<div style={{
  width: "100%",
  height: "100%",
  background: `linear-gradient(90deg, ${R.red} 0%, ${R.navy} 100%)`,
  borderRadius: 999,
  transform: barAnimated ? `scaleX(${progressPct / 100})` : "scaleX(0)",
  transformOrigin: "left",
  transition: "transform 1.3s cubic-bezier(0.4, 0, 0.2, 1)",
}} />
```

Key changes:
- `width` is now `"100%"` and never changes
- `transform` drives the animation: `scaleX(0)` at start, `scaleX(progressPct / 100)` when animated (e.g. 82% → `scaleX(0.82)`)
- `transformOrigin: "left"` anchors the scale to the left edge
- `transition` targets `transform` instead of `width`

- [ ] Make this edit.

---

### Step 1.3: Verify referrer pipeline bar

Start the dev server (`npm start`). Log in as a referrer. Navigate to the Pipeline tab.

- [ ] The bar animates from left to right on page load.
- [ ] The bar stops at the correct proportion of the container width.
- [ ] No visible jank or jump.
- [ ] (Optional) In Chrome DevTools → More Tools → Rendering → enable "Paint flashing". No green flash during bar animation confirms compositor-only rendering.

---

## Task 2: Fix Admin Dashboard Bar Animation

**File:** `src/App.js:1690–1693`

The admin dashboard's stat bars animate `width` from `"0%"` to `"100%"`. Same problem, same fix. The container at line 1689 already has `overflow: 'hidden'`.

### Step 2.1: Locate the admin dashboard bar

Find this exact block (currently lines 1689–1695):

```jsx
<div style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: 14, position: 'relative' }}>
  <div style={{
    position: 'absolute', top: 0, left: 0, height: '100%',
    width: animated ? '100%' : '0%', background: gradient, borderRadius: 99,
    transition: 'width 1.1s cubic-bezier(0.4, 0, 0.2, 1)',
  }} />
</div>
```

- [ ] Confirm you can see this block.

---

### Step 2.2: Replace the inner `<div>` style

Replace the inner `<div style={{...}} />` with:

```jsx
<div style={{
  position: 'absolute', top: 0, left: 0, height: '100%',
  width: '100%', background: gradient, borderRadius: 99,
  transform: animated ? 'scaleX(1)' : 'scaleX(0)',
  transformOrigin: 'left',
  transition: 'transform 1.1s cubic-bezier(0.4, 0, 0.2, 1)',
}} />
```

Key changes:
- `width` is now `'100%'` (fixed)
- `transform` drives: `scaleX(0)` → `scaleX(1)` when `animated` flips to true
- `transformOrigin: 'left'` anchors to left edge
- `transition` targets `transform`

- [ ] Make this edit.

---

### Step 2.3: Verify admin dashboard bar

Log in as admin. Navigate to the Dashboard tab.

- [ ] Stat bars animate from left to right on load.
- [ ] Bars reach full width at the correct proportion of their containers.
- [ ] No visible jank or jump.

---

## Task 3: Commit Progress Bar Changes

Both bars are fixed. Commit before moving on.

- [ ] Stage and commit:

```bash
git add src/App.js
git commit -m "$(cat <<'EOF'
perf: replace width animation with transform scaleX on progress bars

Compositor-only transform avoids layout reflow on every animation frame.
Fixes visible jank on low-end Android devices.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Swap DM Mono → Roboto Mono

**File:** `src/App.js` — lines 70, 95, 1723, 1882, 1913, 1975, 2046, 2059

Three sub-edits: the Google Fonts URL, the `R.fontMono` token (propagates to 40+ referrer-app usages automatically), and 6 hardcoded admin-panel strings.

---

### Step 4.1: Update the Google Fonts URL

Find line 95 in `useReferrerFonts()`:

```js
fonts.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;600&display=swap";
```

Replace with:

```js
fonts.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=DM+Sans:wght@300;400;500;600;700&family=Roboto+Mono:wght@400;600&display=swap";
```

Only change: `DM+Mono` → `Roboto+Mono`. Everything else stays identical.

- [ ] Make this edit.

---

### Step 4.2: Update the `R.fontMono` token

Find line 70:

```js
fontMono:    "'DM Mono', monospace",
```

Replace with:

```js
fontMono:    "'Roboto Mono', monospace",
```

This single change propagates to all 40+ referrer-app usages of `R.fontMono`. No other referrer-app edits are needed.

- [ ] Make this edit.

---

### Step 4.3: Replace the 6 hardcoded admin-panel strings

The admin panel does not use `R.fontMono` — it has hardcoded `'DM Mono', monospace` literals. Replace each one. Use search-by-content rather than line numbers since prior edits may have shifted lines.

**Occurrence 1** — admin dashboard cache status span:
```jsx
fontFamily: "'DM Mono', monospace"   // inside the stats && <span> near AdminPageHeader
```
Replace the literal with `"'Roboto Mono', monospace"`.

**Occurrence 2** — selected referrer email paragraph:
```jsx
fontFamily: "'DM Mono', monospace"   // in <p> showing selected.email
```
Replace with `"'Roboto Mono', monospace"`.

**Occurrence 3** — referral list payout amount span:
```jsx
fontFamily: "'DM Mono', monospace"   // in ref.payout span showing +$amount
```
Replace with `"'Roboto Mono', monospace"`.

**Occurrence 4** — referrers table email cell:
```jsx
fontFamily: "'DM Mono', monospace"   // in <td> showing u.email
```
Replace with `"'Roboto Mono', monospace"`.

**Occurrence 5** — cash-out card email paragraph:
```jsx
fontFamily: "'DM Mono', monospace"   // in <p> showing c.email
```
Replace with `"'Roboto Mono', monospace"`.

**Occurrence 6** — cash-out detail row (conditional expression):
```jsx
fontFamily: mono ? "'DM Mono', monospace" : AD.fontSans
```
Replace only the string inside the conditional:
```jsx
fontFamily: mono ? "'Roboto Mono', monospace" : AD.fontSans
```

- [ ] Make all 6 edits. After each, run a quick grep to confirm no `'DM Mono'` literals remain:

```bash
grep -n "'DM Mono'" src/App.js
```

Expected output: nothing (zero matches).

---

### Step 4.4: Verify the font swap

With the dev server still running (or restart it):

- [ ] **Referrer app:** Log in. On the Dashboard, balance amounts and reward schedule figures render in Roboto Mono (slightly different letterforms from DM Mono — compare to a screenshot or use DevTools → Elements → Computed to confirm `font-family: Roboto Mono`).
- [ ] **Referrer app:** Navigate to Pipeline tab. Status codes and amounts render in Roboto Mono.
- [ ] **Admin panel:** Log in as admin. Emails, payout amounts, and the cache status indicator render in Roboto Mono.
- [ ] **Admin panel:** Open a cash-out request detail view. Confirm the payout amount and email address in the detail block render in Roboto Mono (exercises the `mono ? '...' : AD.fontSans` conditional at the previously hardcoded line).

---

## Task 5: Commit and Deploy

- [ ] Stage and commit:

```bash
git add src/App.js
git commit -m "$(cat <<'EOF'
style: swap DM Mono for Roboto Mono throughout

Updates Google Fonts URL, R.fontMono design token, and 6 hardcoded
admin-panel font strings. All monospace text now uses Roboto Mono.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] Push to Railway:

```bash
git push
```

- [ ] Smoke test on production (`https://rooster-booster-production.up.railway.app`): verify progress bars animate smoothly and monospace text renders in Roboto Mono on a real mobile device.
