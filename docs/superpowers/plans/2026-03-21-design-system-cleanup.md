# Design System Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four design system inconsistencies in `src/App.js` — spacing to 8pt grid, font scale collapse to brand type scale, off-brand gradient colors replaced with token values, and WCAG focus rings added to all interactive elements.

**Architecture:** All four fixes are mechanical edits to a single file (`src/App.js`). No new files are created. Changes are purely presentational (inline styles and a CSS injection); no logic, data flow, or component structure is altered. The four fixes are independent and can be applied in any order, but this plan does them in order of lowest to highest change volume to keep early tasks easy to review.

**Tech Stack:** React (inline styles), vanilla CSS injection via `document.createElement('style')`, Node/Express backend (not touched)

---

## Files Modified

- **Modify:** `src/App.js` — all changes are in this file only
  - Fix 4 (focus rings): `useReferrerFonts` (~line 105), `useAdminFonts` (~line 1529)
  - Fix 3 (gradients): `AD` object (~line 1546), 9 gradient strings throughout
  - Fix 2 (font scale): ~80–100 `fontSize` occurrences throughout
  - Fix 1 (spacing): ~55–65 `padding`/`margin`/`gap` occurrences throughout

**No tests exist for this app's UI styling** — verification is a clean build (`npm run build`) plus visual inspection. Steps include explicit verification commands.

---

## Task 1: Add Focus Ring CSS (Fix 4)

**Files:**
- Modify: `src/App.js` — `useReferrerFonts` function (~line 105) and `useAdminFonts` function (~line 1529)

This is purely additive. Inject a global `<style>` block into `document.head` from both font hooks. The rule uses `:focus-visible` (keyboard only — no spurious rings on mouse click). `border-radius: inherit` makes the ring follow pill/rounded button shapes.

- [ ] **Step 1.1: Add focus ring injection to `useReferrerFonts`**

Find this block in `useReferrerFonts` (~line 113–115):
```js
    document.head.appendChild(icons);
    document.body.style.margin = "0";
    document.body.style.background = R.bgPage;
```

Replace with:
```js
    document.head.appendChild(icons);
    const focusStyle = document.createElement("style");
    focusStyle.textContent = "button:focus-visible,a:focus-visible{outline:2px solid #012854;outline-offset:2px;border-radius:inherit;}";
    document.head.appendChild(focusStyle);
    document.body.style.margin = "0";
    document.body.style.background = R.bgPage;
```

- [ ] **Step 1.2: Add focus ring injection to `useAdminFonts`**

Find this block in `useAdminFonts` (~line 1535–1537):
```js
    document.head.appendChild(icons);
  }, []);
}
```

Replace with:
```js
    document.head.appendChild(icons);
    const focusStyle = document.createElement("style");
    focusStyle.textContent = "button:focus-visible,a:focus-visible{outline:2px solid #012854;outline-offset:2px;border-radius:inherit;}";
    document.head.appendChild(focusStyle);
  }, []);
}
```

- [ ] **Step 1.3: Verify**

Run: `npm run build`
Expected: Build succeeds with no errors. No warnings about the new lines.

- [ ] **Step 1.4: Manual spot-check**

Start dev server (`npm start`), navigate to the login screen, tab to the Sign In button, confirm a navy outline appears. Tab to the "Contact your rep" link, confirm ring appears. Switch to the admin panel, tab through sidebar buttons, confirm rings appear.

---

## Task 2: Fix Off-Brand Gradient Colors + Add AD.navyDark Token (Fix 3)

**Files:**
- Modify: `src/App.js` — `AD` object (~line 1546–1548), 9 gradient strings

**Important:** Add `AD.navyDark` to the token object FIRST (Step 2.1), then update the gradient strings that reference it (Steps 2.2–2.10).

- [ ] **Step 2.1: Add `navyDark` to the `AD` token object**

Find in the `AD` object (~line 1548):
```js
  navy:       '#012854',
```

Replace with:
```js
  navy:       '#012854',
  navyDark:   '#041D3E',
```

- [ ] **Step 2.2: Fix login screen background gradient (~line 353)**

Find:
```js
      background: `linear-gradient(160deg, ${R.navy} 0%, #1a4a8a 40%, ${R.blueLight} 100%)`,
```

Replace with:
```js
      background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
```

- [ ] **Step 2.3: Fix dashboard hero header gradient (~line 520)**

`R.navyDark` already exists in the `R` object (line ~37: `navyDark: "#041D3E"`). No addition needed — it can be used directly.

Find:
```js
        background: `linear-gradient(145deg, ${R.navy} 0%, #1a4a8a 60%, #2a6aaa 100%)`,
```

Replace with:
```js
        background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
```

- [ ] **Step 2.4: Fix pipeline screen header gradient (~line 885)**

Find:
```js
        background: `linear-gradient(145deg, ${R.navy} 0%, #1a4a8a 100%)`,
```

Replace with:
```js
        background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
```

Note: This same pattern (`145deg, ${R.navy} 0%, #1a4a8a 100%`) appears on four more screen headers (History ~line 1060, Cash Out ~line 1331, Profile ~line 1431, and one more ~line 885). Use the Edit tool on each occurrence individually to avoid touching the wrong gradient.

- [ ] **Step 2.5: Fix Cash Out profile-step header gradient (~line 1025)**

Find:
```js
          background: `linear-gradient(160deg, ${R.navy} 0%, #1a4a8a 50%, ${R.blueLight} 100%)`,
```

Replace with:
```js
          background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
```

- [ ] **Step 2.6: Fix Cash Out confirmation card gradient (~line 1043)**

Find:
```js
                marginTop: 28, background: `linear-gradient(135deg, ${R.navy} 0%, #1a4a8a 100%)`,
```

Replace with:
```js
                marginTop: 28, background: `linear-gradient(135deg, ${R.navy} 0%, ${R.navyDark} 100%)`,
```

- [ ] **Step 2.7: Fix History screen header gradient (~line 1060)**

Find the History screen's outer header `<div>` (look for the nearby `<h1>` containing the text "History"). Update its background:

Find: `` background: `linear-gradient(145deg, ${R.navy} 0%, #1a4a8a 100%)` `` ← this specific instance
Replace: `` background: `linear-gradient(145deg, ${R.navy} 0%, ${R.navyDark} 100%)` ``

- [ ] **Step 2.8: Fix Cash Out screen header gradient (~line 1331)**

Find the Cash Out screen's outer header `<div>` (look for the nearby `<h1>` containing "Cash Out"). Apply the same replacement as Step 2.7.

- [ ] **Step 2.9: Fix Profile screen header gradient (~line 1431)**

Find the Profile screen's outer header `<div>` (look for the nearby `<h1>` containing `{userName}`). Apply the same replacement as Step 2.7.

- [ ] **Step 2.10: Fix admin sidebar gradient (`AD.bgSidebar`, ~line 1546)**

Find:
```js
  bgSidebar:  'linear-gradient(160deg, #1a3a6b 0%, #012854 50%, #020f1f 100%)',
```

Replace with:
```js
  bgSidebar:  'linear-gradient(160deg, #012854 0%, #041D3E 100%)',
```

**Note:** Use literal hex values here — `AD.navy` (#012854) and `AD.navyDark` (#041D3E). A template literal referencing `${AD.navy}` would fail at runtime because `AD` is a `const` and does not exist yet while its own properties are being constructed.

- [ ] **Step 2.11: Confirm no `#1a4a8a`, `#2a6aaa`, `#1a3a6b`, `#020f1f` remain**

Search `src/App.js` for each of these four hex values. All should return zero matches.

- [ ] **Step 2.12: Verify build**

Run: `npm run build`
Expected: Clean build, no errors.

---

## Task 3: Collapse Font Scale (Fix 2)

**Files:**
- Modify: `src/App.js` — all `fontSize` occurrences

**How to work through this:** Use the find-and-replace table below. For each row, use Grep to locate all instances, then apply the replacement. Most values are written as bare numbers in JS object literals (e.g., `fontSize: 13`), not strings — search accordingly.

**Do NOT change these sizes (display slot):** 36, 52, 64.

**Sizes already on scale (skip):** 12, 15, 16, 22, 32.

- [ ] **Step 3.1: Replace `fontSize: 9` → `fontSize: 12`**

Instances: boost table "✓ done" and "next" mini badges (~line 716–717).
Search for `fontSize: 9,` — update each to `fontSize: 12,`.

- [ ] **Step 3.2: Replace `fontSize: 9.5` → `fontSize: 12`**

Instances: bottom nav tab label (~line 295).
Search for `fontSize: 9.5,` — update to `fontSize: 12,`.

- [ ] **Step 3.3: Replace `fontSize: 10` → `fontSize: 12`**

Instances: ~10 occurrences — section metadata labels, "Available Balance" caption, pipeline screen sub-labels, timestamp meta.
Search for `fontSize: 10,` — update all to `fontSize: 12,`.

- [ ] **Step 3.4: Replace `fontSize: 11` → `fontSize: 12`**

Instances: StatusBadge (~line 154), admin footer "ACCENT ROOFING SERVICE" label (~line 487), activity log timestamp sub-line (~line 2235).
Search for `fontSize: 11,` — update all to `fontSize: 12,`.

- [ ] **Step 3.5: Replace `fontSize: 11.5` → `fontSize: 12`**

Instances: admin StatusBadge component (~line 1704), admin Btn size sm (~line 1713).
Search for `fontSize: 11.5,` — update all to `fontSize: 12,`.

- [ ] **Step 3.6: Replace `fontSize: 12.5` → `fontSize: 12`**

Instances: admin table email/date columns (~lines 2077–2078), admin sidebar footer name (~line 1633).
Search for `fontSize: 12.5,` — update all to `fontSize: 12,`.

- [ ] **Step 3.7: Replace `fontSize: 13` → `fontSize: 15`**

Instances: ~15 occurrences — body copy descriptions, error text, referral sub-labels, empty state text, pipeline loading text.
Search for `fontSize: 13,` — update all to `fontSize: 15,`.

- [ ] **Step 3.8: Replace `fontSize: 13.5` → `fontSize: 15`**

Instances: admin sidebar nav items (~line 1615), admin search input (~line 2048), admin table font-size base (~line 2051), admin pipeline list items (~line 2012), admin activity log name (~line 2228).
Search for `fontSize: 13.5,` — update all to `fontSize: 15,`.

- [ ] **Step 3.9: Replace `fontSize: 14` → `fontSize: 15`**

Instances: ~15 occurrences — button labels, body copy, sub-descriptions, boost table values, cashout input text, profile action buttons.
Search for `fontSize: 14,` — update all to `fontSize: 15,`.

- [ ] **Step 3.10: Replace `fontSize: 17` → `fontSize: 16`**

Instances: ~8 occurrences — small icons (cashout step icon, profile icons, admin activity icons, admin sidebar nav icons, submit/back button icons).
Search for `fontSize: 17,` — update all to `fontSize: 16,`.

- [ ] **Step 3.11: Replace `fontSize: 18` → `fontSize: 16`**

Instances: input field icons in login and cashout (~lines 407, 429).
Search for `fontSize: 18,` — update all to `fontSize: 16,`.

- [ ] **Step 3.12: Replace `fontSize: 20` → `fontSize: 22`**

Instances: ContactModal "Get in Touch" title (~line 187), ContactModal close X icon (~line 198), ContactModal phone/envelope icons (~lines 207, 220), stat readout value in pipeline/history (~line 641, 911, 1036), profile username stat (~line 1444, 1450).
Search for `fontSize: 20,` — update all to `fontSize: 22,`.

- [ ] **Step 3.13: Replace `fontSize: 24` → `fontSize: 22`**

Instances: cashout confirmation "Payout Approved!" heading (~line 1033).
Search for `fontSize: 24,` — update to `fontSize: 22,`.

- [ ] **Step 3.14: Replace `fontSize: 26` → `fontSize: 22`**

Instances: section h1 headings for Dashboard, Pipeline, Cash Out, History screens (~lines 547, 891, 1064, 1335), admin login screen title (~line 2266).
Search for `fontSize: 26,` — update all to `fontSize: 22,`.

- [ ] **Step 3.15: Replace `fontSize: 28` → `fontSize: 32`**

Instances: login screen app title "Rooster Booster" (~line 371), dashboard balance `$` sign (~line 583), admin page title (~line 1658).
Search for `fontSize: 28,` — update all to `fontSize: 32,`.

- [ ] **Step 3.16: Verify no off-scale sizes remain**

Run each grep individually to confirm zero matches for every off-scale value:

```bash
grep -n "fontSize: 9," src/App.js
grep -n "fontSize: 9.5," src/App.js
grep -n "fontSize: 10," src/App.js
grep -n "fontSize: 11," src/App.js
grep -n "fontSize: 11.5," src/App.js
grep -n "fontSize: 12.5," src/App.js
grep -n "fontSize: 13," src/App.js
grep -n "fontSize: 13.5," src/App.js
grep -n "fontSize: 14," src/App.js
grep -n "fontSize: 17," src/App.js
grep -n "fontSize: 18," src/App.js
grep -n "fontSize: 20," src/App.js
grep -n "fontSize: 24," src/App.js
grep -n "fontSize: 26," src/App.js
grep -n "fontSize: 28," src/App.js
```

Expected: zero matches for all. (Do NOT flag 36, 52, or 64 — those are the display slot and must stay.)

- [ ] **Step 3.17: Verify build**

Run: `npm run build`
Expected: Clean build, no errors.

---

## Task 4: Align Spacing to 8pt Grid (Fix 1)

**Files:**
- Modify: `src/App.js` — `padding`, `margin`, and `gap` values throughout

**Scope reminder:** Only `padding`, `margin`, and `gap`. Do NOT change `border-width`, `border-radius`, `left`, `top`, `right`, `bottom`, `width`, `height`, or `transform` values.

Work through the change table row by row. Use Grep to locate instances before editing to confirm context.

- [ ] **Step 4.1: `gap: 3` → `gap: 4`**

Search: `gap: 3,`
Instances: nav tab buttons, status badge. Update all.

- [ ] **Step 4.2: `gap: 5` → `gap: 4`**

Search: `gap: 5,`
Instances: StatusBadge dot + label (~line 153), admin badge. Update all.

- [ ] **Step 4.3: `gap: 6` → `gap: 8`**

Search: `gap: 6,`
Instances: dashboard progress row, balance loading state. Update all.

- [ ] **Step 4.4: `gap: 10` → `gap: 8`**

Search: `gap: 10,`
Instances: ~14 occurrences in compact flex rows (sidebar header, card rows, list items). Update all.

- [ ] **Step 4.5: `gap: 14` → `gap: 16`**

Search: `gap: 14,`
Instances: ~9 occurrences in icon + text list item rows. Update all.

- [ ] **Step 4.6: `margin: "1px 0 0"` → `margin: "0"`**

Search: `margin: "1px 0 0"`
Instances: activity log timestamp sub-line. Update to `margin: 0`.

- [ ] **Step 4.7: `margin: "2px 0 0"` → `margin: "4px 0 0"`**

Search: `margin: "2px 0 0"`
Instances: ~8 sub-label below stats, balance card sub-text, pipeline cards. Update all.

- [ ] **Step 4.8: `margin: "3px 0 0"` → `margin: "4px 0 0"`**

Search: `margin: "3px 0 0"`
Instances: admin referrer detail name sub-label. Update all.

- [ ] **Step 4.9: `margin: "6px 0 0"` → `margin: "8px 0 0"`**

Search: `margin: "6px 0 0"`
Instances: login subtitle, several UI sub-labels. Update all.

- [ ] **Step 4.10: `margin: "0 0 6px"` → `margin: "0 0 8px"`**

Search: `margin: "0 0 6px"`
Instances: label above login fields. Update all.

- [ ] **Step 4.11: `marginBottom: 6` → `marginBottom: 8`**

Search: `marginBottom: 6,`
Instances: form field label spacing. Update all.

- [ ] **Step 4.12: `marginBottom: 14` → `marginBottom: 16`**

Search: `marginBottom: 14,`
Instances: multiple login/cashout field wrappers. Update all.

- [ ] **Step 4.13: `marginTop: 14` → `marginTop: 16`**

Search: `marginTop: 14,`
Instances: login button, cashout "continue" button area. Update all.

- [ ] **Step 4.14: `marginTop: 18` → `marginTop: 16`**

Search: `marginTop: 18,`
Instances: pipeline/history stat section. Update all.

- [ ] **Step 4.15: `marginTop: 20` → `marginTop: 24`**

Search: `marginTop: 20,`
Instances: login "Don't have an account?" footer link area. Update all.

- [ ] **Step 4.16: `marginBottom: 28` → `marginBottom: 24`**

Search: `marginBottom: 28,`
Instances: 5 occurrences (login brand mark, dashboard section, admin alert banner, and others). Update all to 24.

- [ ] **Step 4.17: `padding: "10px 14px"` → `padding: "8px 12px"`**

Search: `padding: "10px 14px"`
Instances: error banner in login, error banner in cashout. Update all.

- [ ] **Step 4.18: `padding: "10px 4px 6px"` → `padding: "8px 4px 8px"`**

Search: `padding: "10px 4px 6px"`
Instances: bottom nav tab buttons. Update all.

- [ ] **Step 4.19: `padding: "10px 16px"` → `padding: "8px 16px"`**

Search: `padding: "10px 16px"`
Instances: boost table modal header row. Update all.

- [ ] **Step 4.20: `padding: "10px 18px"` → `padding: "8px 16px"`**

Search: `padding: "10px 18px"`
Instances: dashboard referral card row. Update all.

- [ ] **Step 4.21: `padding: 13` → `padding: 12`**

Search: `padding: 13,`
Instances: ContactModal close button, cashout "go back" button. Update all.

- [ ] **Step 4.22: `padding: "14px 20px"` → `padding: "16px 24px"`**

Search: `padding: "14px 20px"`
Instances: ~10 occurrences in admin table rows, pipeline list items, activity log items. Update all.

- [ ] **Step 4.23: `padding: "15px"` → `padding: "16px"`**

Search: `padding: "15px"`
Instances: ~6 primary CTA buttons in referrer app (sign in, cashout submit, etc.). Update all.

- [ ] **Step 4.24: `padding: "15px 18px"` → `padding: "16px 16px"`**

Search: `padding: "15px 18px"`
Instances: profile action button. Update all.

- [ ] **Step 4.25: `padding: '9px 14px'` → `padding: '8px 12px'`**

Search: `padding: '9px 14px'`
Instances: admin sidebar nav item buttons. Update all.

- [ ] **Step 4.26: `padding: '9px 18px'` → `padding: '8px 16px'`**

Search: `padding: '9px 18px'`
Instances: `Btn` component `md` size definition. Update.

- [ ] **Step 4.27: `padding: '6px 14px'` → `padding: '8px 16px'`**

Search: `padding: '6px 14px'`
Instances: filter tab buttons in cashouts and activity log. Update all.

- [ ] **Step 4.28: `padding: '3px 10px'` → `padding: '4px 8px'`**

Search: `padding: '3px 10px'`
Instances: admin StatusBadge component. Update all.

- [ ] **Step 4.29: `padding: '12px 20px 6px'` → `padding: '12px 16px 8px'`**

Search: `padding: '12px 20px 6px'`
Instances: admin sidebar "Main Menu" section label. Update.

- [ ] **Step 4.30: `padding: "14px 16px 14px 44px"` → `padding: "16px 16px 16px 48px"`**

Search: `padding: "14px 16px 14px 44px"`
Instances: login email/PIN input fields, cashout amount input. Update all.

- [ ] **Step 4.31: `padding: "22px 22px 18px"` → `padding: "24px 24px 16px"`**

Search: `padding: "22px 22px 18px"`
Instances: dashboard balance card. Update.

- [ ] **Step 4.32: `padding: "22px 24px"` → `padding: "24px 24px"`**

Search: `padding: "22px 24px"`
Instances: admin stats card, admin "New Referrer" form card. Update all.

- [ ] **Step 4.33: Verify no off-grid spacing remains**

Spot-check by grepping for the most common patterns that were changed:

```bash
grep -n "gap: 3," src/App.js
grep -n "gap: 5," src/App.js
grep -n "gap: 6," src/App.js
grep -n "gap: 10," src/App.js
grep -n "gap: 14," src/App.js
grep -n "marginBottom: 6," src/App.js
grep -n "marginBottom: 14," src/App.js
grep -n "marginBottom: 28," src/App.js
grep -n "marginTop: 14," src/App.js
grep -n "marginTop: 18," src/App.js
grep -n "padding: \"15px\"" src/App.js
grep -n "padding: \"14px 20px\"" src/App.js
grep -n "padding: \"10px 14px\"" src/App.js
```

Expected: zero matches for all.

- [ ] **Step 4.34: Verify build**

Run: `npm run build`
Expected: Clean build, no errors.

---

## Task 5: Final Verification + Commit

- [ ] **Step 5.1: Full build check**

Run: `npm run build`
Expected: Clean build, no errors or warnings beyond any pre-existing ones.

- [ ] **Step 5.2: Visual regression spot-check**

Start dev server: `npm start`

Check each screen in the referrer app:
- [ ] Login screen — card layout intact, button spacing looks comfortable, focus ring visible on tab
- [ ] Dashboard — balance number still large (52px kept), hero header gradient is deep navy (not mid-blue)
- [ ] Pipeline — filter tabs, referral cards, empty state
- [ ] Cash Out — multi-step flow, amount input, confirmation card
- [ ] Profile — stats, action buttons

Check admin panel (append `/admin` or use admin login):
- [ ] Dashboard stats cards, pipeline health bar, pending alert banner
- [ ] Referrers table, referrer detail view
- [ ] Cash Outs list, filter tabs
- [ ] Activity log

- [ ] **Step 5.3: Verify gradient replacements**

```bash
grep -n "#1a4a8a\|#2a6aaa\|#1a3a6b\|#020f1f" src/App.js
```

Expected: zero matches.

- [ ] **Step 5.4: Verify focus ring injection**

```bash
grep -n "focus-visible" src/App.js
```

Expected: 2 matches (one in `useReferrerFonts`, one in `useAdminFonts`).

- [ ] **Step 5.5: Commit**

```bash
git add src/App.js
git commit -m "fix: design system cleanup — 8pt grid spacing, brand font scale, gradient tokens, focus rings

- Replace all off-grid padding/margin/gap values with nearest 8pt grid values
- Collapse 14 font sizes to 5-slot brand type scale (12/15/16/22/32px); preserve display sizes 36/52/64px
- Replace intermediate gradient blues (#1a4a8a, #2a6aaa, #1a3a6b) with R.navy/R.navyDark/R.blueLight tokens
- Add AD.navyDark token to AD object
- Inject button:focus-visible/a:focus-visible outline in both useReferrerFonts and useAdminFonts

Closes #2, #3, #4, #12

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
