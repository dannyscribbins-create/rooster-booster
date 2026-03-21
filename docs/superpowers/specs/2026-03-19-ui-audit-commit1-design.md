# UI Audit — Commit 1 Design Spec
**Date:** 2026-03-19
**Scope:** Three functional fixes from the UI audit. Deploy immediately upon completion.
**File:** `src/App.js` (single-file React app, inline styles, ~2100 lines)

---

## Overview

Three independent functional fixes grouped into a single commit for immediate Railway deployment:

1. Fix silent cash out failure
2. Add visible input labels (login + cash out screens)
3. ContactModal shared component (Profile + Login screens)

---

## Fix 1: Silent Cash Out Failure

### Problem
In the `CashOut` component, the Step 3 confirm button handler calls `setStep(4)` (the success screen) unconditionally — both after a successful API response and inside the `catch` block. A network failure or server error shows the user the same "Request Submitted!" screen as a real success.

### Solution
Add a `submitError` state string (`useState("")`) to the `CashOut` component.

**Updated handler logic:**
```
setSubmitting(true)
setSubmitError("")
try:
  res = await fetch(BACKEND_URL/api/cashout, ...)
  data = await res.json()
  if (!res.ok || data.error):
    setSubmitError(data.error || "Something went wrong. Please try again.")
    setSubmitting(false)
    return
  setSubmitting(false)
  setStep(4)   ← only reached on success
catch (err):
  setSubmitError("Connection error. Please check your connection and try again.")
  setSubmitting(false)
  ← do NOT call setStep(4)
```

**Error display:** Render an error block above the Submit button when `submitError` is non-empty. Style matches the existing login error pattern:
- Background: `#fee2e2`
- Border-radius: 8px
- Padding: `10px 14px`
- Icon: `ph-warning-circle`, color `#dc2626`, size 16px
- Text: `#dc2626`, 13px, DM Sans

Error clears in two places:
- **"Go Back" button:** add `setSubmitError("")` to its `onClick` alongside the existing `setStep(2)` call
- **Next submission attempt:** `setSubmitError("")` at the top of the handler before the fetch

Note: `submitError` is local component state. If the user navigates away from the CashOut tab and back, the error may persist if `CashOut` stays mounted (conditional render, not unmounted on tab switch). This is acceptable — the next submit attempt clears it. No additional cleanup logic needed.

---

## Fix 2: Visible Input Labels

### Problem
Two locations use placeholder text as the only label — a WCAG 2.1 SC 1.3.1 failure. Placeholders disappear on input focus and are never a substitute for visible labels.

### Label style (both locations)
```
font-family: R.fontBody (DM Sans)
font-size: 12px
font-weight: 500
color: R.textSecondary (#6B6B6B)
margin-bottom: 6px
display: block
```

### Location 1: Login screen
- Add label "Email address" above the email input wrapper div
- Add label "PIN" above the PIN input wrapper div
- Existing placeholders remain (serve as format hints)

### Location 2: Cash Out — Step 2 detail field
Add a visible label above the detail input that is derived from the selected `method`:

| Method | Label text |
|--------|-----------|
| `zelle` | Zelle phone or email |
| `venmo` | Venmo username |
| `paypal` | PayPal email |
| `check` | Mailing address |

The existing placeholder text already provides this hint — the label makes it persistent and accessible.

---

## Fix 3: ContactModal Component

### Problem
Two interactive elements are dead ends:
- "Contact Support" button in `Profile`
- "Contact your rep" span in `LoginScreen`

Both should surface Accent Roofing contact information.

### New component: `ContactModal`

**Location in file:** Add to the Shared Components section, after `StatusBadge`.

**Props:**
```
isOpen: boolean
onClose: () => void
```

**Structure:**
```
Fixed backdrop (position: fixed, inset: 0, z-index: 200)
  background: rgba(0,0,0,0.5)
  display: flex, alignItems: center, justifyContent: center
  padding: 24px (so card doesn't touch screen edges on small phones)
  onClick → onClose

  Card (max-width 340px, width: 100%)
    background: R.bgCard (#FFFFFF)
    border-radius: 20px
    padding: 28px
    box-shadow: R.shadowLg
    onClick: e.stopPropagation() ← prevents backdrop click from firing

    Row: header (display: flex, justifyContent: space-between, alignItems: center, marginBottom: 16)
      "Get in Touch" — Montserrat, 20px, weight 700, R.navy, margin: 0
      Close icon button:
        Uses <i className="ph ph-x"> — consistent with Phosphor icon system
        fontSize: 20, color: R.textMuted
        background: none, border: none, cursor: pointer, padding: 4px, lineHeight: 1

    Divider: borderTop: `1px solid ${R.border}`, marginBottom: 16

    Row: phone (display: flex, alignItems: center, gap: 12)
      <i className="ph ph-phone"> — fontSize: 20, color: R.navy, flexShrink: 0
      <a href="tel:7702774869">770-277-4869</a>
        DM Sans, 15px, color: R.navy, textDecoration: none
        onMouseEnter/Leave: toggle textDecoration underline

    Row: email (display: flex, alignItems: center, gap: 12, marginTop: 14)
      <i className="ph ph-envelope"> — fontSize: 20, color: R.navy, flexShrink: 0
      <a href="mailto:contact@leaksmith.com">contact@leaksmith.com</a>
        same style as phone link

    Close button (marginTop: 24)
      Full-width, matches existing "Go Back" button exactly:
        background: none, border: `1.5px solid ${R.border}`, borderRadius: 12
        padding: 13px, color: R.textSecondary, fontSize: 14
        cursor: pointer, fontFamily: R.fontBody
        display: flex, alignItems: center, justifyContent: center, gap: 6
      Label: "Close"
      onClick → onClose
```

**Backdrop click:** Clicking the backdrop (not the card) calls `onClose`. Clicking inside the card does not propagate. Achieved with `e.stopPropagation()` on the card.

**Early return:** If `!isOpen`, return `null`.

### Trigger changes

**`Profile` component:**
- Add `const [showContact, setShowContact] = useState(false)`
- "Contact Support" button: `onClick={() => setShowContact(true)}`
- Render `<ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />` at end of `Profile` JSX

**`LoginScreen` component:**
- Add `const [showContact, setShowContact] = useState(false)`
- "Contact your rep" `<span>` → change to `<button>` with `onClick={() => setShowContact(true)}`. Apply these style resets to visually match the existing span across all browsers:
  ```
  background: none, border: none, padding: 0, margin: 0,
  font: inherit, cursor: pointer,
  color: R.navy, fontWeight: 600
  ```
- Render `<ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />` at end of `LoginScreen` JSX

Changing span to button also fixes a secondary accessibility issue (interactive element needs to be a button, not a span).

---

## Out of Scope for This Commit

- Progress bar animation fix (Commit 2)
- DM Mono → Roboto font swap (Commit 2)
- All other audit findings (#6–#20)

---

## Testing Checklist

- [ ] Cash out: submit with network disconnected — should show error, stay on step 3
- [ ] Cash out: submit with server returning `{ error: "..." }` — should show error, stay on step 3
- [ ] Cash out: successful submit — should advance to step 4 success screen
- [ ] Login: email and PIN labels visible before typing
- [ ] Login: placeholders still visible when fields are empty
- [ ] Cash out step 2: label updates when payment method changes
- [ ] Profile: "Contact Support" opens modal
- [ ] Login: "Contact your rep" opens modal
- [ ] Modal: phone number is tappable (tel: link)
- [ ] Modal: email is tappable (mailto: link)
- [ ] Modal: backdrop tap closes modal
- [ ] Modal: × button closes modal
- [ ] Modal: "Close" button closes modal
