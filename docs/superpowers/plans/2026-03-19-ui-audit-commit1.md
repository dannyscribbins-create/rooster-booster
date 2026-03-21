# UI Audit Commit 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three functional issues in the Rooster Booster referral app: silent cash out failure, missing input labels, and dead-end contact buttons.

**Architecture:** All changes are in a single file (`src/App.js`). Three independent edits with no shared state or cross-component dependencies. `ContactModal` is a new shared component inserted in the Shared Components section and wired into two existing components via local state.

**Tech Stack:** React (Create React App), inline styles, Phosphor Icons via CDN script tag, `R{}` design token object.

---

## File Map

| File | Changes |
|------|---------|
| `src/App.js` | All edits — new `ContactModal` component, state additions, handler fix, label insertions, span-to-button conversion |

No new files. No config changes.

---

## Task 1: Fix Silent Cash Out Failure

**Files:**
- Modify: `src/App.js:825` (add state), `src/App.js:1063–1079` (fix handler), `src/App.js:1094` (fix Go Back)

### Step 1.1: Add `submitError` state to `CashOut`

In `src/App.js`, after line 825 (`const [submitting, setSubmitting] = useState(false);`), add one line:

```jsx
const [submitError, setSubmitError] = useState("");
```

The state block (lines 821–825) will now read:
```jsx
const [method, setMethod] = useState(null);
const [amount, setAmount] = useState("");
const [step, setStep] = useState(1);
const [detail, setDetail] = useState("");
const [submitting, setSubmitting] = useState(false);
const [submitError, setSubmitError] = useState("");
```

- [ ] Make this edit.

---

### Step 1.2: Fix the confirm button handler (lines 1063–1079)

Replace the entire `onClick={async () => { ... }}` handler body. The current broken code:

```jsx
onClick={async () => {
  setSubmitting(true);
  try {
    await fetch(`${BACKEND_URL}/api/cashout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionStorage.getItem("rb_token")}`,
      },
      body: JSON.stringify({
        user_id: null, full_name: userName,
        email: userEmail, amount: parseFloat(amount), method,
      }),
    });
  } catch (err) { console.error("Cash out error:", err); }
  setSubmitting(false);
  setStep(4);
}}
```

Replace with:

```jsx
onClick={async () => {
  setSubmitting(true);
  setSubmitError("");
  try {
    const res = await fetch(`${BACKEND_URL}/api/cashout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionStorage.getItem("rb_token")}`,
      },
      body: JSON.stringify({
        user_id: null, full_name: userName,
        email: userEmail, amount: parseFloat(amount), method,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      setSubmitError(data.error || "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setStep(4);
  } catch (err) {
    console.error("Cash out error:", err);
    setSubmitError("Connection error. Please check your connection and try again.");
    setSubmitting(false);
  }
}}
```

- [ ] Make this edit.

---

### Step 1.3: Add the error display block above the submit button

The submit button starts at the current line 1063 (after the handler replacement it remains in the same location). Find the Step 3 confirm section — it begins with:

```jsx
{step === 3 && (
  <AnimCard delay={0} style={{ marginTop: 20 }}>
    <div style={{
      background: R.bgCard, border: `1.5px solid ${R.border}`,
      borderRadius: 16, padding: "20px", boxShadow: R.shadow,
    }}>
      <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: R.navy, fontFamily: R.fontSans }}>
        Confirm your payout
      </p>
```

After the `.map(...)` summary rows block (the four rows showing Amount, Method, Sent to, Remaining) and **before** the submit `<button>`, add:

```jsx
{submitError && (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    background: "#fee2e2", borderRadius: 8, padding: "10px 14px",
    marginBottom: 14,
  }}>
    <i className="ph ph-warning-circle" style={{ color: "#dc2626", fontSize: 16, flexShrink: 0 }} />
    <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{submitError}</p>
  </div>
)}
```

- [ ] Make this edit.

---

### Step 1.4: Fix the Go Back button to also clear the error

Note: Step 1.3 inserted ~9 lines above the submit button, which itself sits above the Go Back button. The Go Back button has shifted from its original line 1094. Locate it by searching for the anchor string rather than by line number.

The Go Back button is identifiable by:

```jsx
<button onClick={() => setStep(2)} style={{
```

Change its `onClick` to:

```jsx
<button onClick={() => { setStep(2); setSubmitError(""); }} style={{
```

- [ ] Make this edit.

---

### Step 1.5: Verify Fix 1 manually

Start the backend (`node server.js`) and frontend (`npm start`). Log in as a referrer. Navigate to Cash Out, select a method, enter an amount and detail. On Step 3:

- [ ] **Happy path:** With normal connectivity, submit. Should advance to Step 4 success screen.
- [ ] **Network error path:** Open DevTools → Network tab → set throttling to "Offline". Submit. Should stay on Step 3 and show the red error block ("Connection error..."). Re-enable network. Tap "Go Back" — returns to Step 2 and error block should be gone. Tap "Continue" (the red button that appears once a valid amount is entered) to return to Step 3 — confirm the error block does not reappear until a new failed submit.
- [ ] **Server error path:** (Optional — requires temporarily breaking the API or returning an error response.) Confirm error message from server appears in the red block.

---

## Task 2: Add Visible Input Labels

**Files:**
- Modify: `src/App.js:298` (login email label), `src/App.js:314` (login PIN label), `src/App.js:1007` (cash out detail label)

---

### Step 2.1: Add label above the email input in `LoginScreen`

The email input wrapper div starts at approximately line 298:

```jsx
{/* Email field */}
<div style={{ position: "relative", marginBottom: 14 }}>
  <i className="ph ph-envelope" style={{
```

Before this `<div>`, add:

```jsx
<label style={{
  display: "block", fontSize: 12, fontWeight: 500,
  color: R.textSecondary, marginBottom: 6, fontFamily: R.fontBody,
}}>
  Email address
</label>
```

- [ ] Make this edit.

---

### Step 2.2: Add label above the PIN input in `LoginScreen`

The PIN input wrapper div starts at approximately line 314 (will shift slightly after step 2.1):

```jsx
{/* PIN field */}
<div style={{ position: "relative", marginBottom: 6 }}>
  <i className="ph ph-lock" style={{
```

Before this `<div>`, add:

```jsx
<label style={{
  display: "block", fontSize: 12, fontWeight: 500,
  color: R.textSecondary, marginBottom: 6, fontFamily: R.fontBody,
}}>
  PIN
</label>
```

- [ ] Make this edit.

---

### Step 2.3: Add dynamic label above the detail input in `CashOut` Step 2

The target area is in the `{step >= 2 && method && (...)}` block. The detail input sits inside a `<div style={{ marginTop: 12 }}>`. Here is the surrounding context for the insertion point (around line 1007):

```jsx
            </div>
            <div style={{ marginTop: 12 }}>       {/* ← insert label BEFORE this div */}
              <input
                value={detail} onChange={e => setDetail(e.target.value)}
                placeholder={method === "check" ? "Mailing address" : `Your ${methods.find(m => m.id === method)?.label} handle / email`}
                style={{
                  width: "100%", background: R.bgCard,
                  border: `1.5px solid ${R.border}`, borderRadius: 12,
                  padding: "14px 16px", ...
```

The `<div style={{ marginTop: 12 }}>` wraps only the input — it is a sibling, not a parent. Insert the label **before** that div so the label sits in its own flow above it. The label's `marginBottom: 6` provides the gap to the input; the input's container `marginTop: 12` provides the gap from the amount block above. The combined spacing is intentional.

Add this directly before `<div style={{ marginTop: 12 }}>`:

```jsx
<label style={{
  display: "block", fontSize: 12, fontWeight: 500,
  color: R.textSecondary, marginBottom: 6, fontFamily: R.fontBody,
}}>
  {{ zelle: "Zelle phone or email", venmo: "Venmo username",
     paypal: "PayPal email", check: "Mailing address" }[method]}
</label>
```

- [ ] Make this edit.

---

### Step 2.4: Verify Fix 2 manually

- [ ] Login screen: both "Email address" and "PIN" labels appear above their fields before any typing. They remain visible while typing. Placeholder text ("Email address", "PIN") still shows when fields are empty.
- [ ] Cash Out Step 2: Select Zelle — label reads "Zelle phone or email". Select Venmo — label reads "Venmo username". Select PayPal — label reads "PayPal email". Select Check by Mail — label reads "Mailing address". Label updates immediately on method change.

---

## Task 3: ContactModal Component

**Files:**
- Modify: `src/App.js:148` (insert new component), `src/App.js:207` (`LoginScreen` — state + span fix + modal render), `src/App.js:1213` (`Profile` — state + onClick + modal render)

---

### Step 3.1: Add `ContactModal` component to Shared Components section

`StatusBadge` ends at approximately line 148 with its closing `}`. After that closing brace, before the `// ─── Bottom Nav ───` comment line, insert the new component:

```jsx
// Contact Modal
function ContactModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#FFFFFF", borderRadius: 20, padding: 28,
          width: "100%", maxWidth: 340,
          boxShadow: R.shadowLg,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, fontFamily: R.fontSans, color: R.navy }}>
            Get in Touch
          </p>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 4, lineHeight: 1,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <i className="ph ph-x" style={{ fontSize: 20, color: R.textMuted }} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${R.border}`, marginBottom: 16 }} />

        {/* Phone */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <i className="ph ph-phone" style={{ fontSize: 20, color: R.navy, flexShrink: 0 }} />
          <a
            href="tel:7702774869"
            style={{ color: R.navy, fontSize: 15, fontFamily: R.fontBody, textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
            onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
          >
            770-277-4869
          </a>
        </div>

        {/* Email */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
          <i className="ph ph-envelope" style={{ fontSize: 20, color: R.navy, flexShrink: 0 }} />
          <a
            href="mailto:contact@leaksmith.com"
            style={{ color: R.navy, fontSize: 15, fontFamily: R.fontBody, textDecoration: "none" }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
            onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
          >
            contact@leaksmith.com
          </a>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 24, width: "100%", background: "none",
            border: `1.5px solid ${R.border}`, borderRadius: 12,
            padding: 13, color: R.textSecondary, fontSize: 14,
            cursor: "pointer", fontFamily: R.fontBody,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

- [ ] Make this edit.

---

### Step 3.2: Wire `ContactModal` into `LoginScreen`

Three sub-edits in `LoginScreen` (function starting at line 207):

**3.2a — Add state.** After line 213 (`const cardVisible = useEntrance(80);`), add:

```jsx
const [showContact, setShowContact] = useState(false);
```

**3.2b — Replace the "Contact your rep" `<span>` with a `<button>`.** Find lines 361–363:

```jsx
<span style={{ color: R.navy, fontWeight: 600, cursor: "pointer" }}>
  Contact your rep
</span>
```

Replace with:

```jsx
<button
  onClick={() => setShowContact(true)}
  style={{
    background: "none", border: "none", padding: 0, margin: 0,
    font: "inherit", cursor: "pointer",
    color: R.navy, fontWeight: 600,
  }}
>
  Contact your rep
</button>
```

**3.2c — Render the modal.** The `LoginScreen` return closes with a `<style>` tag then `</div>` at lines 375–378. Before the `<style>` tag, add:

```jsx
<ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
```

- [ ] Make all three sub-edits (3.2a, 3.2b, 3.2c).

---

### Step 3.3: Wire `ContactModal` into `Profile`

Three sub-edits in `Profile` (function starting at line 1213):

**3.3a — Add state.** After line 1216 (`const nextPayout = getNextPayout(soldCount);`), add:

```jsx
const [showContact, setShowContact] = useState(false);
```

**3.3b — Add `onClick` to the "Contact Support" button.** Find the Contact Support button (around line 1283). It currently has no `onClick`. Add `onClick={() => setShowContact(true)}` to the button:

```jsx
<button onClick={() => setShowContact(true)} style={{
  width: "100%", background: R.bgCard,
  ...
```

**3.3c — Render the modal.** `Profile` returns a `<Screen>` that closes at line 1313. Before `</Screen>`, add:

```jsx
<ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
```

- [ ] Make all three sub-edits (3.3a, 3.3b, 3.3c).

---

### Step 3.4: Verify Fix 3 manually

- [ ] **Profile flow:** Log in, go to Profile tab. Tap "Contact Support" — modal appears with "Get in Touch" header, phone number, and email. Tap the × button — modal closes. Tap "Contact Support" again — modal opens. Tap the backdrop — modal closes. Tap "Contact Support" — modal opens. Tap the "Close" button — modal closes.
- [ ] **Login flow:** Log out. On the login screen, tap "Contact your rep" — modal appears. All three close methods work (×, backdrop, Close button).
- [ ] **Phone link:** On a real mobile device or with DevTools mobile emulation, tap the phone number — confirms `tel:` link activates.
- [ ] **Email link:** Tap the email address — confirms `mailto:` link activates.
- [ ] **Visual check:** Modal is centered on screen. Card does not touch screen edges on a 375px viewport. Backdrop darkens the content behind it.

---

## Task 4: Commit and Deploy

- [ ] **Run the app one final time** and walk through all three verification checklists from Tasks 1–3.

- [ ] **Stage the single changed file:**

```bash
git add src/App.js
```

- [ ] **Commit:**

```bash
git commit -m "$(cat <<'EOF'
fix: silent cash out failure, missing input labels, contact modal

- Cash out: setStep(4) now only fires on successful API response;
  network and server errors show inline error block on step 3
- Login + cash out: add visible labels above all inputs (WCAG SC 1.3.1)
- ContactModal: new shared component wired into Profile and LoginScreen
  replacing dead-end 'Contact Support' and 'Contact your rep' elements

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Deploy to Railway:** Push to the tracked branch. Railway will detect the push and redeploy automatically via Nixpacks.

```bash
git push
```

- [ ] **Smoke test on production URL** (https://rooster-booster-production.up.railway.app): verify login labels visible, contact modal opens from both locations, cash out happy path completes to step 4.
