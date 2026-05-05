---
name: Session 49 — Payout Queue + Banking Settings
description: Payout queue tab on CashOuts page (Phase 1) and Banking Settings page with Stripe status + payout automation (Phase 2)
type: project
---

# Session 49 Design — Payout Queue & Banking Settings

## Phase 1 — Payout Queue on CashOuts Page

### Goal
Add a "Referral Payouts" tab to `AdminCashOuts.jsx` alongside the existing "Cashout Requests" tab. Lets the admin approve or deny individual `referral_conversions` rows that have `payout_status = 'pending_review'`.

### Backend — `server/routes/admin.js`

**Route 1: `GET /api/admin/payout-queue`**
- Auth: `verifyAdminSession()`
- `contractor_id` hardcoded `'accent-roofing'` (MVP comment, same pattern as all other admin routes)
- Query: `referral_conversions` WHERE `payout_status = 'pending_review'` AND `contractor_id = 'accent-roofing'`
- JOIN `users` ON `user_id` → `referrer_name`, `referrer_email`
- LEFT JOIN `pipeline_cache` ON `jobber_client_id` AND `contractor_id` → `referred_client_name` (null if no match)
- Return: `id, referrer_name, referrer_email, referred_client_name, job_type, bonus_amount, converted_at, payout_status`
- `job_type` comes from `referral_conversions.job_type` — null for existing rows, shown as `—` in UI
- Order: `converted_at DESC`
- try/catch → 500 on failure

**Route 2: `PATCH /api/admin/payout-queue/:id`**
- Auth: `verifyAdminSession()`
- Body: `{ action }` — `'approve'` or `'deny'`
- `'approve'` → `payout_status = 'approved'`, `'deny'` → `payout_status = 'denied'`
- WHERE clause: `id = $1 AND contractor_id = 'accent-roofing' AND payout_status = 'pending_review'`
- 0 rows updated → 404 (already processed or wrong contractor)
- Returns updated row on success
- try/catch → 500 on failure

### DB Migration — `server/db.js`
Add: `ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS job_type TEXT`

Existing rows → null. Populating it at INSERT time is deferred to a later session when the webhook + pipelineSync INSERT paths are updated.

### Frontend — `src/components/admin/AdminCashOuts.jsx`

**Existing state preserved exactly.** New state added:
- `activeTab` — `'cashouts'` (default) | `'payouts'`
- `payoutQueue` — array of rows
- `payoutLoading` — boolean
- `payoutError` — string | null
- `payoutFetched` — boolean (lazy-load gate — fetch fires only on first tab click)
- `payoutActionLoading` — `{ [id]: 'approve' | 'deny' }` (per-row in-flight state)
- `payoutActionError` — `{ [id]: string }` (per-row inline error)

**Tab bar** added above existing filter pill row:
- Two tabs: "Cashout Requests" / "Referral Payouts"
- Styled to match existing filter pill pattern in the file
- Default: "Cashout Requests" — existing behavior unchanged on load

**Referral Payouts tab:**
- Lazy-fetch: fires `loadPayoutQueue()` on first click only (gate: `!payoutFetched`)
- Loading: skeleton cards (3 rows matching existing skeleton pattern)
- Empty: card with check icon + "No referral payouts pending review."
- Error: inline message + Retry button (re-fetches, resets `payoutFetched`)
- Each row card:
  - Referrer name + email (stacked, email in monospace muted style — matches cashout cards)
  - Client, Job Type, Bonus ($X,XXX.XX format), Date (Month D, YYYY) — labeled metadata grid
  - Approve (green) + Deny (muted/outlined) buttons side by side
  - While action in-flight: both buttons disabled, spinner on clicked button only
  - On success: remove row from `payoutQueue` local state (no refetch)
  - On failure: re-enable buttons, set `payoutActionError[id]`

---

## Phase 2 — Banking Settings Page

### Goal
Replace the "Banking Settings" `ComingSoonCard` placeholder in `AdminSettings.jsx` with a real `BankingSettings.jsx` component containing two sections: Stripe account status (display-only) and Payout Automation (interactive).

### Backend — `server/routes/admin.js`

**Route 3: `GET /api/admin/payout-automation`**
- Auth: `verifyAdminSession()`
- Query `contractor_settings` WHERE `contractor_id = 'accent-roofing'`
- Return: `{ payout_automation, payout_review_threshold }`
- If no row: return safe defaults `{ payout_automation: 'manual_all', payout_review_threshold: null }`
- try/catch → 500 on failure

**Route 4: `PUT /api/admin/payout-automation`**
- Auth: `verifyAdminSession()`
- Body: `{ payout_automation, payout_review_threshold }`
- Validate `payout_automation` ∈ `['manual_all', 'full_auto', 'threshold']` → 400 if invalid
- If not `'threshold'` → force `payout_review_threshold = null`
- UPSERT `contractor_settings` SET `payout_automation`, `payout_review_threshold` WHERE `contractor_id = 'accent-roofing'`
- Return updated `{ payout_automation, payout_review_threshold }`
- try/catch → 500 on failure

### Frontend — `src/components/admin/BankingSettings.jsx` (new file)

**State:**
- `initLoading` — boolean, true on mount while GET is in-flight
- `automation` — `'manual_all'` | `'full_auto'` | `'threshold'`
- `threshold` — string (controlled input value)
- `saving` — boolean
- `saveSuccess` — boolean
- `saveError` — string | null

**Section 1 — Stripe Account (display-only)**
- Heading: "Stripe Account"
- Status badge: "Not Connected" — neutral/muted color, not red
- Informational note below badge

**Section 2 — Payout Automation**
- Heading: "Payout Automation"
- Short description below heading
- Three full-width radio option cards (vertical stack):
  - `manual_all` — "Manual Review Required"
  - `full_auto` — "Fully Automatic"
  - `threshold` — "Threshold-Based"
  - Selected card: colored left border using `AD.blueText` + subtle background tint
  - Unselected: plain card border
- Conditional threshold input (visible only when `threshold` selected):
  - Smooth opacity + max-height CSS transition
  - `$` prefix, number input, min 0, step 0.01
- "Save Settings" button — disabled while `saving`
- Success message: "Payout settings saved." — shown inline after save, fades naturally
- Error message: inline on failure

**On mount:** `GET /api/admin/payout-automation` → pre-select option + pre-fill threshold input

**On save:** `PUT /api/admin/payout-automation` with `{ payout_automation, payout_review_threshold: threshold ? parseFloat(threshold) : null }`

**Styling:** All inline, AD tokens only, no CSS files.

### Wiring — `src/components/admin/AdminSettings.jsx`
- Add `import BankingSettings from './BankingSettings'` at top
- Replace `SETTINGS_PAGES.banking` ComingSoonCard with `<BankingSettings />`

---

## Key Constraints

- All styles inline — no CSS files
- `react-hooks/exhaustive-deps` — every useEffect with intentionally omitted deps needs the eslint-disable comment on the line immediately above the dependency array
- No `.then()` chains — all async code uses async/await
- `logError()` called in every catch block on the backend
- `contractor_id` uses `'accent-roofing'` hardcoded with `// TODO: pull from session when multi-contractor is live` comment
- `verifyAdminSession()` guards every new route
