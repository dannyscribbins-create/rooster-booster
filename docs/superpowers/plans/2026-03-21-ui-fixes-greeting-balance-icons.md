# UI Fixes: Greeting, Balance $ Size, Admin Icons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three targeted UI fixes to `src/App.js` in one commit — time-aware admin greeting, proportional balance $ sign, and Phosphor icons replacing all admin panel emoji.

**Architecture:** All changes in `src/App.js` only. No new components, no new dependencies. Phosphor Icons v2.1.1 already loaded via CDN.

**Spec:** `docs/superpowers/specs/2026-03-21-ui-fixes-greeting-balance-icons-design.md`

---

### Task 1: Apply all three UI fixes

**File:** `src/App.js` — four locations

---

- [ ] **Step 1: Fix 1 — Time-aware greeting**

Find the `AdminDashboard` function. Immediately before its `return (` statement, add:

```js
const hour = new Date().getHours();
const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
```

Then find this line inside the return:
```jsx
<AdminPageHeader title="Good morning, Danny." subtitle="Rooster Booster · Accent Roofing"
```

Change to:
```jsx
<AdminPageHeader title={`${greeting}, Danny.`} subtitle="Rooster Booster · Accent Roofing"
```

- [ ] **Step 2: Fix 2 — Balance $ sign size**

Find this exact span in the `Dashboard` function:
```jsx
<span style={{ fontSize: 13, color: R.red, fontFamily: R.fontMono, fontWeight: 700, marginBottom: 8 }}>$</span>
```

Replace with:
```jsx
<span style={{ fontSize: 28, color: R.red, fontFamily: R.fontMono, fontWeight: 700 }}>$</span>
```

(Two changes: `fontSize: 13` → `28`, `marginBottom: 8` removed entirely.)

- [ ] **Step 3: Fix 3A — Update StatCard to render Phosphor icons**

Find the `StatCard` function. Locate this line inside it (the icon container div):
```jsx
<div style={{ width: 34, height: 34, borderRadius: 8, background: accent ? `${accent}20` : AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: accent || AD.textSecondary }}>{icon}</div>
```

Replace with:
```jsx
<div style={{ width: 34, height: 34, borderRadius: 8, background: accent ? `${accent}20` : AD.bgCardTint, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent || AD.textSecondary }}>
  <i className={`ph ${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
</div>
```

- [ ] **Step 4: Fix 3B — Replace all 10 emoji icon prop values**

Find and replace each of the following `icon` prop values. Use exact string matching — each emoji appears only once.

| Find | Replace with |
|------|-------------|
| `icon="👥"` | `icon="ph-users"` |
| `icon="⚖️"` | `icon="ph-scales"` |
| `icon="✅"` | `icon="ph-check-circle"` |
| `icon="📋"` | `icon="ph-clipboard-text"` |
| `icon="🔵"` | `icon="ph-circle"` |
| `icon="🔍"` | `icon="ph-magnifying-glass"` |
| `icon="🏆"` | `icon="ph-trophy"` |
| `icon="💰"` | `icon="ph-currency-dollar"` |

Note: `📋` and `🏆` each appear twice in the file — replace **both** occurrences of each.
Note: `🐓` appears in the file but is NOT in this list — do not touch it.

- [ ] **Step 5: Verify build**

```bash
cd C:\Users\stacy\rooster-booster && npm run build 2>&1 | tail -15
```

Expected: `Compiled successfully` with no new errors.

- [ ] **Step 6: Self-review**

- `const hour` and `const greeting` are inside `AdminDashboard`, before `return (`
- `$` span now has `fontSize: 28` and no `marginBottom`
- `StatCard` icon div no longer has `fontSize: 16`; contains `<i className={`ph ${icon}`} ...>`
- All 10 emoji `icon` props replaced; `🐓` untouched
- No other lines changed

- [ ] **Step 7: Commit**

```bash
git add src/App.js
git commit -m "fix: time-aware greeting, proportional balance $ sign, Phosphor icons in admin StatCards"
```
