# Design System Cleanup — Spec
**Date:** 2026-03-21
**Issues:** #2 (8pt grid), #3 (font scale), #4 (gradient colors), #12 (focus rings)
**Target file:** `src/App.js`
**Delivery:** Single commit covering all four fixes

---

## Background

`src/App.js` is a 2100+ line single-file React application using exclusively inline styles. The brand design tokens are defined in the `R` object (referrer app) and `AD` object (admin panel) at the top of the file. The brand kit source of truth lives in `accent-roofing-brand-tokens.css`.

Four design system inconsistencies have accumulated that this spec addresses together:

1. Spacing values that fall off the 8pt grid
2. Font sizes that exceed the brand's 6-slot type scale
3. Gradient color stops using intermediate blues not in the brand token set
4. Interactive elements with no visible focus ring (WCAG 2.4.7 failure)

---

## Fix 1 — Spacing to 8pt Grid

### Scope

Audit and correct all `padding`, `margin`, and `gap` inline style values in `App.js`.

**Excluded from scope:**
- `border-width` values (1px, 1.5px, 3px) — border sizing, not spacing
- Positional properties (`left`, `top`, `right`, `bottom`) — layout geometry
- Sizing properties (`width`, `height`) — component dimensions
- `border-radius` values — shape, not spacing
- `transform: translateY(...)` values — animation offsets

### Grid

Valid spacing values: **4, 8, 12, 16, 24, 32, 48, 64px**

### Rounding Rule

Round to the nearest grid value. For ties (e.g. 20px is equidistant between 16 and 24), use context: tight/compact UI elements round down; spacious section-level layouts round up. Where the same value appears in mixed contexts, apply the rounding that best serves the majority of occurrences and note the choice.

### Change Table

| Current value | Replacement | Context / rounding rationale |
|---|---|---|
| `gap: 3` | `gap: 4` | Nav tab buttons, status badges |
| `gap: 5` | `gap: 4` | Status badge dot + label, admin pending badge |
| `gap: 6` | `gap: 8` | Dashboard stats row, progress row |
| `gap: 10` | `gap: 8` | Compact flex rows in sidebar, cards, list items (~14 instances) — tie rounds down (compact UI) |
| `gap: 14` | `gap: 16` | Icon + text list item rows (~9 instances) — tie rounds up (list items need breathing room) |
| `margin: "1px 0 0"` | `margin: "0"` | Timestamp sub-label (negligible visual gap, round to 0) |
| `margin: "2px 0 0"` | `margin: "4px 0 0"` | Sub-labels below stats (~8 instances) |
| `margin: "3px 0 0"` | `margin: "4px 0 0"` | Admin detail name sub-label |
| `margin: "6px 0 0"` | `margin: "8px 0 0"` | Login subtitle, several UI labels |
| `margin: "0 0 6px"` | `margin: "0 0 8px"` | Label above login fields |
| `marginBottom: 6` | `marginBottom: 8` | Form field spacing |
| `marginBottom: 14` | `marginBottom: 16` | Multiple instances |
| `marginTop: 14` | `marginTop: 16` | Multiple instances |
| `marginTop: 18` | `marginTop: 16` | Stats section in pipeline/history headers |
| `marginTop: 20` | `marginTop: 24` | Spacious footer/link area — tie rounds up (section-level gap) |
| `marginBottom: 28` | `marginBottom: 24` | All 5 instances — tie rounds down (24 applied uniformly for consistency) |
| `padding: "10px 14px"` | `padding: "8px 12px"` | Error banners |
| `padding: "10px 4px 6px"` | `padding: "8px 4px 8px"` | Bottom nav tab buttons |
| `padding: "10px 16px"` | `padding: "8px 16px"` | Boost table modal header row (10 → 8) |
| `padding: "10px 18px"` | `padding: "8px 16px"` | Dashboard referral card row |
| `padding: 13` | `padding: 12` | Modal close button |
| `padding: "14px 20px"` | `padding: "16px 24px"` | Admin table rows, list item rows (~10 instances) — 14→16 (nearest), 20→24 (tie rounds up for spacious admin layout) |
| `padding: "15px"` | `padding: "16px"` | Primary CTA buttons in referrer app (~6 instances) |
| `padding: "15px 18px"` | `padding: "16px 16px"` | Profile action button |
| `padding: '9px 14px'` | `padding: '8px 12px'` | Admin sidebar nav items |
| `padding: '9px 18px'` | `padding: '8px 16px'` | `Btn` component `md` size |
| `padding: '6px 14px'` | `padding: '8px 16px'` | Filter tab buttons (cashouts, activity) |
| `padding: '3px 10px'` | `padding: '4px 8px'` | Admin status badge |
| `padding: '12px 20px 6px'` | `padding: '12px 16px 8px'` | Admin sidebar section header |
| `padding: "14px 16px 14px 44px"` | `padding: "16px 16px 16px 48px"` | Login/cashout input fields |
| `padding: "22px 22px 18px"` | `padding: "24px 24px 16px"` | Dashboard balance card — 22→24, 18→16 |
| `padding: "22px 24px"` | `padding: "24px 24px"` | Admin stats card, form card — 22→24 |

Estimated total: ~55–65 individual value replacements.

---

## Fix 2 — Font Scale Collapse

### Scope

Audit and correct all `fontSize` inline style values in `App.js`. This covers both the referrer app and the admin panel.

### Brand Type Scale (6 slots)

| Slot | Size | Role |
|---|---|---|
| label | 12px | Captions, badges, timestamps, nav tab labels, form labels, section trackers, uppercase metadata |
| body | 15px | Paragraphs, descriptions, list items, button text, primary readable text |
| h3 | 16px | Small section headers, icon sizes, secondary UI text |
| h2 | 22px | Modal titles, screen section headers, large stat readouts |
| h1 | 32px | Primary screen headings, app title |
| display | keep as-is | Intentionally large numbers/emoji kept visually prominent |

### Display Slot (do not change)

The following sizes are classified as "display type" and are explicitly excluded from normalization:
- **52px** — balance number on Dashboard
- **36px** — large icons in empty states, app logo emoji
- **64px** — celebratory emoji on cashout confirmation

### Full Mapping Table

| Current | → | Rationale |
|---|---|---|
| 9px | 12px | Tiny badge labels (boost table "✓ done", "next") |
| 9.5px | 12px | Bottom nav tab labels |
| 10px | 12px | Section metadata labels (uppercase trackers, timestamps) |
| 11px | 12px | Admin footer label |
| 11.5px | 12px | Admin status badge |
| 12px | 12px | Already on scale |
| 12.5px | 12px | Admin table metadata, email column |
| 13px | 15px | Body copy, descriptions, error text, list items |
| 13.5px | 15px | Admin list items, search input, sidebar nav items |
| 14px | 15px | Button text, body copy, form input text |
| 15px | 15px | Already on scale |
| 16px | 16px | Already on scale |
| 17px | 16px | Secondary icons, small action icons |
| 18px | 16px | Input field icons (email, lock) |
| 20px | 22px | Modal section headers, stat values |
| 22px | 22px | Already on scale |
| 24px | 22px | Cashout confirmation heading |
| 26px | 22px | Screen section titles (Dashboard, Pipeline, Cash Out, History) |
| 28px | 32px | Login screen app title "Rooster Booster" |
| 32px | 32px | Already on scale |
| 36px | keep | Display slot |
| 52px | keep | Display slot |
| 64px | keep | Display slot |

Estimated total: ~80–100 `fontSize` occurrences affected.

---

## Fix 3 — Off-Brand Gradient Colors

### Scope

Audit and correct all `linear-gradient` values in `App.js`. Every color stop must use a value from the `R` or `AD` design token objects (or a value present in those objects).

### Token Addition Required

The `AD` object does not currently have a `navyDark` key. Add it as part of this fix:

```js
navyDark: '#041D3E',   // add after AD.navy
```

This mirrors `R.navyDark` and provides a semantic name for the admin sidebar gradient endpoint.

### Off-Brand Stops Found

| Value | Count | Description |
|---|---|---|
| `#1a4a8a` | 8 | Mid-range blue — used as gradient fill between navy and lighter tones |
| `#2a6aaa` | 1 | Lighter medium blue — dashboard hero endpoint |
| `#1a3a6b` | 1 | Dark blue — admin sidebar gradient start |
| `#020f1f` | 1 | Near-black navy — admin sidebar gradient end |

### Replacement Table

| Location | Current gradient | Replacement |
|---|---|---|
| Login screen background | `navy → #1a4a8a 40% → blueLight` | `R.navy → R.blueLight` (2 stops, direct) |
| Dashboard hero header | `navy → #1a4a8a 60% → #2a6aaa` | `R.navy → R.navyDark` |
| Profile screen header | `navy → #1a4a8a` | `R.navy → R.navyDark` |
| Pipeline screen header | `navy → #1a4a8a` | `R.navy → R.navyDark` |
| Cash Out screen header | `navy → #1a4a8a` | `R.navy → R.navyDark` |
| Cash Out confirmation card | `navy → #1a4a8a` | `R.navy → R.navyDark` |
| History screen header | `navy → #1a4a8a` | `R.navy → R.navyDark` |
| Cash Out header (profile step) | `navy → #1a4a8a` | `R.navy → R.navyDark` |
| Admin sidebar (`AD.bgSidebar`) | `#1a3a6b → #012854 → #020f1f` | `AD.navy → AD.navyDark` |

**Gradient direction and angle are preserved.** Only color stop values change.

**Gradients already using brand token values (no change):**
- Line ~650: `red → navy` progress bar — already on-brand
- Line ~1290: `green → greenText` success button — both values exist in `R`

Estimated total: 9 gradient instances + 1 token addition to `AD`.

---

## Fix 4 — Focus Rings

### Scope

Add a visible keyboard focus indicator to all interactive elements (`<button>`, `<a>`) in both the referrer app and admin panel. Input fields are excluded — they already use a border-color change as a WCAG-compliant focus indicator.

### Implementation

Inject a global `<style>` rule in **both** font hooks:
- `useReferrerFonts` (line ~105) — serves the referrer app entry point
- `useAdminFonts` (line ~1529) — serves the admin panel entry point

Both hooks already append elements to `document.head`, making them the correct insertion points for each app branch.

```css
button:focus-visible,
a:focus-visible {
  outline: 2px solid #012854;
  outline-offset: 2px;
  border-radius: inherit;
}
```

`border-radius: inherit` ensures the focus ring follows the shape of pill buttons, rounded cards, and other non-rectangular interactive elements.

### Color Rationale

Navy (`#012854`, `R.navy`) is used rather than red (`#CC0000`) because:
- Red focus rings read as error states on red-styled CTAs
- Navy meets 4.5:1 contrast ratio against the white card surfaces where most buttons appear
- Navy is the primary brand color and is already used as the hover/focus indicator on input fields

### No Existing Styles to Remove

No `<button>` elements in `App.js` have an inline `outline: "none"` that would override this rule. The two `outline: "none"` values in the file are both on `<input>` elements (which are excluded from this fix).

### Coverage

This single rule covers:
- All bottom nav tab buttons (~5)
- Login screen buttons (~3)
- Dashboard action buttons (~3)
- Boost table modal trigger
- Pipeline filter tabs, referral cards
- Cash Out step buttons (~6)
- Profile action buttons (~4)
- Contact modal close button
- Admin sidebar nav buttons (~4)
- Admin `<Btn>` component (all variants and sizes)
- Admin filter tabs, table action buttons
- All `<a>` links (phone, email in ContactModal)

---

## Acceptance Criteria

- [ ] Every `padding`, `margin`, and `gap` value listed in the Fix 1 change table has been updated to its specified replacement
- [ ] No `fontSize` value appears outside the six defined slots (12, 15, 16, 22, 32px + display exceptions at 36, 52, 64px)
- [ ] Every `linear-gradient` in `App.js` uses only values from the `R` or `AD` token objects; `AD.navyDark` has been added to the `AD` object
- [ ] Every `<button>` and `<a>` in both the referrer app and admin panel shows a 2px navy outline on keyboard `:focus-visible`
- [ ] The focus ring CSS is injected in both `useReferrerFonts` and `useAdminFonts`
- [ ] Input `focus` behavior is unchanged
- [ ] No visual regressions on the referrer app's five main screens
- [ ] No visual regressions on the admin panel's four sections
- [ ] All changes are in `src/App.js` only (except the `AD.navyDark` token addition, which is also in `src/App.js`)
