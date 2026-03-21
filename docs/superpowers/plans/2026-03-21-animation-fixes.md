# Animation Fixes: Session Flag + Specific Transitions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two animation fixes to `src/App.js` — entrance animations fire only once per browser tab session, and all 16 `transition: all` values are replaced with scoped property lists.

**Architecture:** All changes in `src/App.js` only. Fix 1 modifies the `useEntrance` hook and `AnimCard` component (shared infrastructure) then adds a `screenKey` prop to 11 static AnimCard call sites across 4 screens. Fix 2 is 16 surgical string replacements.

**Spec:** `docs/superpowers/specs/2026-03-21-animation-fixes-design.md`

---

### Task 1: Fix 1 — Update `useEntrance` and `AnimCard` infrastructure

**File:** `src/App.js` — two locations (lines 88 and 127)

---

- [ ] **Step 1: Update `useEntrance` (line 88)**

Find this exact block:

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

Replace with:

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

- [ ] **Step 2: Update `AnimCard` (line 127)**

Find:

```js
function AnimCard({ children, delay = 0, style = {} }) {
  const visible = useEntrance(delay);
```

Replace with:

```js
function AnimCard({ children, delay = 0, screenKey = '', style = {} }) {
  const visible = useEntrance(delay, screenKey);
```

- [ ] **Step 3: Self-review**

- `useEntrance` has lazy `useState` initializer (arrow function inside `useState(...)`)
- `useEffect` dep array is `[]` (not `[delay]`) — intentional, screenKey captured at mount
- `AnimCard` destructures `screenKey = ''` and passes it to `useEntrance`
- No other lines changed

---

### Task 2: Fix 1 — Add `screenKey` to static AnimCard call sites

**File:** `src/App.js` — 11 call sites across Dashboard, Pipeline, History, Profile

**Context:** Only static layout cards (present when the screen first loads) get a `screenKey`. Dynamic list items rendered in `.map()` over data IDs do NOT get one. CashOut step panels do NOT get one (they animate on user action, not screen load).

---

#### Dashboard (5 call sites — `screenKey="dashboard"`)

- [ ] **Step 4: Balance card (line 557)**

Find:
```jsx
        <AnimCard delay={100} style={{ marginTop: 20 }}>
```
Replace with:
```jsx
        <AnimCard delay={100} screenKey="dashboard" style={{ marginTop: 20 }}>
```

- [ ] **Step 5: Boost Progress card (line 613)**

Find:
```jsx
        <AnimCard delay={200}>
          <div style={{
            background: R.bgCard, border: `1px solid ${R.border}`,
            borderRadius: 16, padding: "18px 20px",
            boxShadow: R.shadow,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
```
Replace the opening tag:
```jsx
        <AnimCard delay={200} screenKey="dashboard">
```
(Only the `<AnimCard` opening line changes — the contents are identical.)

- [ ] **Step 6: Reward Schedule table (line 664)**

Find:
```jsx
        <AnimCard delay={280}>
          <p style={{
            margin: "0 0 10px", fontSize: 10, color: R.textMuted,
            fontFamily: R.fontMono, letterSpacing: "0.1em", textTransform: "uppercase",
```
Replace the opening tag:
```jsx
        <AnimCard delay={280} screenKey="dashboard">
```

- [ ] **Step 7: Recent Referrals section wrapper (line 740)**

Find:
```jsx
        <AnimCard delay={360}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
```
Replace the opening tag:
```jsx
        <AnimCard delay={360} screenKey="dashboard">
```

- [ ] **Step 8: Google Review banner (line 805)**

Find:
```jsx
        <AnimCard delay={600}>
          <div style={{
            background: R.bgCard,
            border: `1px solid ${R.border}`,
            borderRadius: 16,
```
Replace the opening tag:
```jsx
        <AnimCard delay={600} screenKey="dashboard">
```

#### Pipeline (1 call site — `screenKey="pipeline"`)

- [ ] **Step 9: Stage stats row (line 898)**

Find:
```jsx
            <AnimCard key={s.label} delay={i * 60} style={{ flex: 1 }}>
```
Replace with:
```jsx
            <AnimCard key={s.label} delay={i * 60} screenKey="pipeline" style={{ flex: 1 }}>
```

#### History (2 call sites — `screenKey="history"`)

- [ ] **Step 10: Summary stats row (line 1339)**

Find:
```jsx
            <AnimCard key={s.label} delay={i * 80} style={{ flex: 1 }}>
```
Replace with:
```jsx
            <AnimCard key={s.label} delay={i * 80} screenKey="history" style={{ flex: 1 }}>
```

- [ ] **Step 11: Empty state card (line 1361)**

Find:
```jsx
          <AnimCard delay={160}>
            <div style={{
              background: R.bgCard, border: `1px solid ${R.border}`,
              borderRadius: 14, padding: "36px 20px", textAlign: "center",
```
Replace the opening tag:
```jsx
          <AnimCard delay={160} screenKey="history">
```

#### Profile (3 call sites — `screenKey="profile"`)

- [ ] **Step 12: Stats card (line 1455)**

Find:
```jsx
        {/* Stats */}
        <AnimCard delay={80}>
```
Replace the AnimCard tag:
```jsx
        {/* Stats */}
        <AnimCard delay={80} screenKey="profile">
```

- [ ] **Step 13: Contact Support button (line 1481)**

Find:
```jsx
        <AnimCard delay={160}>
          <button onClick={() => setShowContact(true)} style={{
```
Replace the opening tag:
```jsx
        <AnimCard delay={160} screenKey="profile">
```

- [ ] **Step 14: Sign Out button (line 1498)**

Find:
```jsx
        <AnimCard delay={220}>
          <button onClick={onLogout} style={{
```
Replace the opening tag:
```jsx
        <AnimCard delay={220} screenKey="profile">
```

- [ ] **Step 15: Self-review for Task 2**

- All 5 Dashboard AnimCards now have `screenKey="dashboard"`
- Pipeline stats row has `screenKey="pipeline"`
- History stats row and empty state have `screenKey="history"`
- Profile stats, Contact Support, Sign Out have `screenKey="profile"`
- CashOut AnimCards are unchanged (no screenKey)
- Dynamic list items (`key={ref.id}`, `key={item.id}`) are unchanged (no screenKey)
- Login screen `useEntrance(80)` call is unchanged (no screenKey)

---

### Task 3: Fix 2 — Replace all 16 `transition: all` values + build + commit

**File:** `src/App.js` — 16 locations

**Note:** `transition: "all ..."` (double quotes) is used in the referrer app; `transition: 'all ...'` (single quotes) is used in the admin panel. Both are replaced. Because many occurrences use the same string (`"all 0.2s"`), each step below includes enough surrounding context to uniquely identify the target.

---

#### Unique duration strings (can match directly)

- [ ] **Step 16: Login brand mark (line 353)**

Find:
```
        transition: "all 0.5s ease",
        textAlign: "center", marginBottom: 28,
```
Replace `transition` value:
```
        transition: "opacity 0.5s ease, transform 0.5s ease",
        textAlign: "center", marginBottom: 28,
```

- [ ] **Step 17: Login card (line 380)**

Find:
```
        transition: "all 0.5s ease 0.1s",
      }}>
```
Replace:
```
        transition: "opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s",
      }}>
```

- [ ] **Step 18: CashOut stepper circle (line 1073)**

Find:
```
          transition: "all 0.3s",
        }}>
```
Replace:
```
          transition: "background 0.3s, border-color 0.3s",
        }}>
```

- [ ] **Step 19: CashOut amount quick-pick buttons (line 1170)**

Find:
```
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = R.bgBlueLight; e.currentTarget.style.borderColor = R.navy; }}
```
Replace:
```
            transition: "background 0.15s, border-color 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = R.bgBlueLight; e.currentTarget.style.borderColor = R.navy; }}
```

#### `transition: "all 0.2s"` — referrer app (5 occurrences, unique by context)

- [ ] **Step 20: Sign In button (line 454)** — transitions `transform`, `box-shadow`, and `background` (loading state changes all three)

Find:
```
          transition: "all 0.2s",
          transform: loading ? "scale(0.98)" : "scale(1)",
          boxShadow: loading ? "none" : "0 4px 14px rgba(204,0,0,0.35)",
```
Replace:
```
          transition: "transform 0.2s, box-shadow 0.2s, background 0.2s",
          transform: loading ? "scale(0.98)" : "scale(1)",
          boxShadow: loading ? "none" : "0 4px 14px rgba(204,0,0,0.35)",
```

- [ ] **Step 21: Cash Out button (line 599)** — hover lift only (`transform` + `box-shadow` from onMouseEnter)

Find:
```
              boxShadow: "0 4px 14px rgba(204,0,0,0.3)",
              transition: "all 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
            >
              <i className="ph ph-money"
```
Replace `transition` line:
```
              transition: "transform 0.2s, box-shadow 0.2s",
```

- [ ] **Step 22: Google Review banner button (line 847)** — hover lift only (`transform`)

Find:
```
                  boxShadow: "0 4px 14px rgba(204,0,0,0.3)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <i className="ph ph-star"
```
Replace `transition` line:
```
                  transition: "transform 0.2s",
```

- [ ] **Step 23: Pipeline filter pills (line 927)** — `background`, `border-color`, `color` change on active state

Find:
```
            whiteSpace: "nowrap", transition: "all 0.2s",
          }}>{filterLabels[f]}</button>
```
Replace:
```
            whiteSpace: "nowrap", transition: "background 0.2s, border-color 0.2s, color 0.2s",
          }}>{filterLabels[f]}</button>
```

- [ ] **Step 24: CashOut method select button (line 1110)** — `border-color`, `box-shadow`, `background` change on selection

Find:
```
                  boxShadow: method === m.id ? "0 4px 14px rgba(204,0,0,0.12)" : R.shadow,
                  transition: "all 0.2s",
                }}
                  onMouseEnter={e => { if (method !== m.id) e.currentTarget.style.borderColor = R.borderMed; }}
```
Replace `transition` line:
```
                  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
```

#### `transition: "all 0.2s"` — Profile screen (2 occurrences)

- [ ] **Step 25: Profile Contact Support button (line 1488)** — `background` only on hover

Find:
```
            transition: "all 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = R.bgBlueLight}
            onMouseLeave={e => e.currentTarget.style.background = R.bgCard}
```
Replace:
```
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = R.bgBlueLight}
            onMouseLeave={e => e.currentTarget.style.background = R.bgCard}
```

- [ ] **Step 26: Profile Sign Out button (line 1505)** — `background` only on hover

Find:
```
            transition: "all 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff5f5"}
```
Replace:
```
            transition: "background 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff5f5"}
```

#### `transition: 'all 0.15s'` — admin panel (5 occurrences, single quotes)

- [ ] **Step 27: Admin nav buttons (line 1609)** — `background` + `color` change on active state

Find:
```
              fontFamily: AD.fontSans, transition: 'all 0.15s',
              position: 'relative',
```
Replace:
```
              fontFamily: AD.fontSans, transition: 'background 0.15s, color 0.15s',
              position: 'relative',
```

- [ ] **Step 28: Admin `Btn` component (line 1705)** — `background`, `opacity`, `transform` on hover

Find:
```
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', cursor: 'pointer', fontFamily: AD.fontSans, fontWeight: 500, transition: 'all 0.15s', borderRadius: 10,
```
Replace `transition` value in this line:
```
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', cursor: 'pointer', fontFamily: AD.fontSans, fontWeight: 500, transition: 'background 0.15s, opacity 0.15s, transform 0.15s', borderRadius: 10,
```

- [ ] **Step 29: Admin dashboard link cards (line 1871)** — `transform` + `box-shadow` on hover

Find:
```
              fontFamily: AD.fontSans, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = AD.shadowMd; }}
```
Replace:
```
              fontFamily: AD.fontSans, transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = AD.shadowMd; }}
```

- [ ] **Step 30: AdminCashOuts filter buttons (line 2124)** — `background`, `color`, `box-shadow` on active state

Find:
```
            textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'all 0.15s' }}>
            {f}{f === 'pending'
```
Replace `transition` value:
```
            textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>
            {f}{f === 'pending'
```

- [ ] **Step 31: AdminActivity filter buttons (line 2203)** — `background`, `color`, `box-shadow` on active state

Find:
```
            textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'all 0.15s' }}>{f}</button>
```
Replace `transition` value:
```
            textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>{f}</button>
```

---

- [ ] **Step 32: Self-review for Task 3**

Grep to verify no `transition: "all` or `transition: 'all` remain in `src/App.js`:

```bash
grep -n "transition.*all" src/App.js
```

Expected: zero results from the `useEntrance`/`AnimCard` code (those use `"opacity ... transform"`), but zero `transition: "all` or `transition: 'all` hits. The only `all` related to transitions should be gone.

Also check that the CashOut stepper connector line (line ~1085) was NOT modified — it uses `transition: "background 0.3s"` which is already specific and was not in scope.

- [ ] **Step 33: Build verify**

```bash
cd C:\Users\stacy\rooster-booster && npm run build 2>&1 | tail -20
```

Expected: `Compiled successfully` with no new errors or warnings.

- [ ] **Step 34: Commit**

```bash
git add src/App.js
git commit -m "perf: entrance animation session flag, replace transition: all with specific properties"
```
