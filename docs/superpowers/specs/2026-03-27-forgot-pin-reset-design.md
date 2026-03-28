# Design Spec: Forgot PIN / Password Reset
**Date:** 2026-03-27
**Status:** Approved

---

## Overview

Referrers who forget their PIN can request a reset link via email. The link expires after 1 hour and is single-use. The server never confirms whether an email address is registered — the response is always generic to prevent user enumeration.

---

## Data Model

New table added to `initDB` in `server.js`:

```sql
CREATE TABLE IF NOT EXISTS pin_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP
)
```

- `token` — 32-byte random hex string, generated with `crypto.randomBytes(32).toString('hex')`
- `expires_at` — set to `NOW() + 1 hour` at creation time
- `used_at` — `NULL` until redeemed; stamped with current timestamp on successful reset (row is kept for audit trail, not deleted)

---

## Environment Variables

Add `FRONTEND_URL` to Railway environment variables:
- Value: `https://rooster-booster-dannyscribbins-6082s-projects.vercel.app`
- Used in: reset email link construction (`${process.env.FRONTEND_URL}/?reset=<token>`)
- Not hardcoded — changing the frontend URL only requires updating the Railway env var

---

## Server Endpoints

### `POST /api/forgot-pin`

**Rate limit:** 3 requests per 15 minutes per IP (new `forgotPinLimiter` using `express-rate-limit`, same pattern as `referrerLoginLimiter`)

**Request body:** `{ email: string }`

**Flow:**
1. Look up user by email (case-insensitive: `LOWER(email) = LOWER($1)`)
2. Immediately prepare the generic response — do not branch on whether the user was found
3. If user found:
   - Generate `token = crypto.randomBytes(32).toString('hex')`
   - Insert into `pin_reset_tokens`: `(user_id, token, expires_at)` where `expires_at = NOW() + interval '1 hour'`
   - Send email via Resend (see Email section below)
   - Log to `activity_log`: `event_type='pin_reset_request'`, `full_name`, `email`, `detail='Reset link sent'`
4. Return `{ message: "If that email is registered, you'll receive a reset link shortly." }` — always, regardless of whether the user was found

**Error handling:** If Resend fails, log the error server-side but still return the generic success message — the user should not learn whether their email exists from an error response.

---

### `POST /api/reset-pin`

**Auth:** None (the token in the request body is the credential)

**Request body:** `{ token: string, pin: string }`

**Flow:**
1. Validate `pin` matches `/^\d{4}$/` — exactly 4 digits. If not: `400 { error: "PIN must be exactly 4 digits." }`
2. Look up token: `SELECT * FROM pin_reset_tokens WHERE token=$1 AND used_at IS NULL AND expires_at > NOW()`
3. If not found or expired: `400 { error: "Reset link is invalid or has expired." }`
4. If valid:
   - `await bcrypt.hash(String(pin), 10)`
   - `UPDATE users SET pin=$1 WHERE id=$2`
   - `UPDATE pin_reset_tokens SET used_at=NOW() WHERE token=$1`
   - Log to `activity_log`: `event_type='pin_reset'`, using `full_name` and `email` from the joined user row
5. Return `{ success: true }`

**Note:** The confirm-PIN match check (pin === confirmPin) is enforced on the frontend only. The server receives a single `pin` field — there is no need to send `confirmPin` to the server.

---

## Frontend

### Login Screen — "Forgot PIN?" link

A small inline text link appears directly below the PIN input field in `LoginScreen`, matching the visual style of the existing "Contact your rep" text link (no border, navy color, font-weight 600).

Tapping it sets `showForgotPin = true` (local state), which replaces the PIN field area with a compact sub-form:
- Email address input (pre-populated if the user already typed their email)
- "Send Reset Link" button (navy, full-width, same style as Sign In)
- "← Back to sign in" link to return to the normal login form

**States:**
- `idle` — form shown, button enabled
- `loading` — button shows spinner, "Sending…"
- `sent` — form replaced with a confirmation message: *"Check your email — if that address is registered, a reset link is on its way."* No way to re-send from this state (prevents abuse); user must tap "← Back" to start over
- `error` — shows inline error (network/server failure only — never "email not found")

### Reset Screen — `ResetPinScreen` component

New standalone function component in `src/App.js`, placed alongside `LoginScreen`.

**Activation:** In root `App`, before the `if (!loggedIn)` check, add:
```js
const resetToken = new URLSearchParams(window.location.search).get('reset');
if (resetToken) return <ResetPinScreen token={resetToken} />;
```

**UI:** Same card-on-gradient layout as `LoginScreen`. Contains:
- "Set a new PIN" heading
- New PIN input (4-digit, numeric, `type="password"`, maxLength 4)
- Confirm PIN input (same)
- "Set PIN" submit button
- Inline error display

**Validation (client-side before submit):**
- Both fields must be 4 digits
- Both fields must match — show "PINs don't match" if not

**On success:**
- Show brief success message: *"PIN updated! Redirecting to sign in…"*
- After 1.5 seconds: `window.history.replaceState({}, '', '/')` to strip the query param, then trigger a re-render so the app falls through to `LoginScreen`

**On token invalid/expired error from server:**
- Show: *"This reset link has expired or already been used. Request a new one from the login screen."*

---

## Email

**From:** `onboarding@resend.dev` (existing Resend sender)
**To:** User's registered email address
**Subject:** `Reset your Rooster Booster PIN`

**HTML body:**
- Accent Roofing logo at top (inline `<img>` pointing to the public asset, or omit if asset is not publicly hosted — use text fallback "Accent Roofing Service")
- Heading: "Reset your PIN"
- Body copy: "Someone requested a PIN reset for your Rooster Booster referral account. Click the button below to set a new PIN. This link expires in 1 hour."
- Prominent CTA button linking to `${process.env.FRONTEND_URL}/?reset=<token>`
- Footer note: "If you didn't request this, you can safely ignore this email. Your PIN has not been changed."

---

## Rate Limiting

New limiter added alongside existing limiters near the top of `server.js`:

```js
const forgotPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many reset requests. Please try again in 15 minutes.' }
});
```

Applied to `POST /api/forgot-pin`.

---

## Security Properties

| Property | How it's met |
|----------|-------------|
| User enumeration prevention | Generic response always returned; Resend errors swallowed server-side |
| Token brute-force resistance | 32-byte random hex = 256 bits of entropy |
| Token expiry | `expires_at` checked in SQL query — 1 hour from creation |
| Single-use | `used_at IS NULL` checked in SQL query; stamped on redemption |
| Replay after use | Impossible — `used_at IS NULL` condition fails on second use |
| Rate limiting | 3 req/15min on the email request endpoint |
| PIN validation | Server enforces `/^\d{4}$/` — client confirmation is UX only |

---

## Files Changed

| File | Change |
|------|--------|
| `server.js` | Add `pin_reset_tokens` table to `initDB`; add `forgotPinLimiter`; add `POST /api/forgot-pin`; add `POST /api/reset-pin` |
| `src/App.js` | Add `showForgotPin` state + sub-form to `LoginScreen`; add `ResetPinScreen` component; add `?reset=` detection in root `App` |

---

## Out of Scope

- Admin-initiated PIN reset (admin can already reset PINs via the admin panel)
- Email verification on account creation
- Multi-factor authentication
- "Remember me" / persistent sessions
