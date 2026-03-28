# Design Spec: Contractor Logo on Login Card + Profile Photo Upload
**Date:** 2026-03-27
**Status:** Approved

---

## Overview

Two independent features that both touch the login/profile area of the referrer app:

1. **Accent Roofing logo on the login card** — brand the login experience as Accent Roofing's rewards portal
2. **Profile photo upload** — referrers can tap their initials circle to upload a photo; photo persists in the database and replaces the initials circle everywhere the logged-in user's avatar appears

---

## Feature 1 — Accent Roofing Logo on Login Card

### What changes

Add the `AccentRoofing-Logo.png` asset (already in `src/assets/images/`) inside the white login card, above the "Welcome back" headline. Centered, constrained width (~120px), with a small bottom margin before the headline.

### Why inside the card

The Rooster Booster wordmark already occupies the top brand mark area above the card. Placing the Accent Roofing logo inside the card creates a clear two-tier hierarchy: RB is the platform, Accent Roofing is the contractor whose portal the referrer is entering. This reads naturally as "Accent Roofing's rewards program, powered by Rooster Booster."

### Scope

- One `<img>` added to `LoginScreen` JSX in `src/App.js`
- `accentRoofingLogo` import already exists (added for the cash out confirmation screen)
- No layout changes, no new files

---

## Feature 2 — Profile Photo Upload

### Data model

Add a `profile_photo TEXT` column to the `users` table. Stores base64-encoded image string. Null when no photo has been uploaded.

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
```

Added to the `initDatabase` block in `server.js` alongside the existing `ALTER TABLE` statements.

### Server endpoints

**`GET /api/profile/photo`**
- Auth: `Authorization: Bearer <token>` header, validated against `sessions` table (same pattern as `/api/cashout`)
- Returns: `{ photo: "<base64string>" }` or `{ photo: null }`

**`POST /api/profile/photo`**
- Auth: same token pattern
- Body: `{ photo: "<base64string>" }`
- Validates: body must contain `photo` field
- Action: `UPDATE users SET profile_photo = $1 WHERE id = $2`
- Returns: `{ success: true }`

### Frontend state

`profilePhoto` state (string | null) lives in the root `App` component alongside `userName` and `userEmail`. It is fetched once after login via `GET /api/profile/photo` and updated optimistically when the user uploads a new photo.

**Props added:**
- `Dashboard`: receives `profilePhoto` prop
- `Profile`: receives `profilePhoto` and `setProfilePhoto` props

### Avatar rendering — `AvatarCircle` helper

A new inline helper component (not a separate file) renders the logged-in user's avatar. Used in exactly two places:

1. **Dashboard header** — 44px circle, `boxShadow: "0 0 0 3px rgba(255,255,255,0.2)"`
2. **Profile header** — 64px circle, `boxShadow: "0 0 0 4px rgba(255,255,255,0.2)"`

```
AvatarCircle({ userName, profilePhoto, size, shadow, onClick, showCameraHint })
```

- If `profilePhoto`: renders `<img>` cropped to circle via `objectFit: cover`, `borderRadius: 50%`
- Else: renders existing initials div (unchanged appearance)
- `showCameraHint`: when true (Profile only), renders a `ph-camera` icon in a small white circle positioned `bottom: 0, right: 0` over the avatar

The wrapper div uses `position: relative` to anchor the camera overlay. In the Dashboard, `showCameraHint` is false and `onClick` is undefined — the circle is non-interactive there.

### Upload flow

1. A hidden `<input type="file" accept="image/*">` ref lives in `Profile`
2. User taps the avatar circle → `inputRef.current.click()`
3. `onChange` handler: validates file ≤ 2MB, reads with `FileReader.readAsDataURL`
4. On `FileReader.onload`: POST to `/api/profile/photo` with token header
5. On success: call `setProfilePhoto(base64string)` — state updates, both Dashboard and Profile re-render with the photo

### Size guard

Client-side: if `file.size > 2 * 1024 * 1024`, show a brief inline error ("Photo must be under 2MB") and abort. No server-side size validation needed for this use case — the client guard is sufficient.

### Circles NOT affected

The initials circles for other people's referrals in the Pipeline and Cash Out screens (lines 825, 1006 in `App.js`) are unrelated to the logged-in user and remain unchanged.

---

## Files Changed

| File | Change |
|------|--------|
| `server.js` | Add `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`; add `GET /api/profile/photo`; add `POST /api/profile/photo` |
| `src/App.js` | Add `AvatarCircle` helper; add `profilePhoto` state + fetch to `App`; pass props to `Dashboard` and `Profile`; add upload input + handler to `Profile`; add logo to `LoginScreen` |

---

## Out of Scope

- Cropping/resizing UI (user uploads as-is)
- Photo deletion (not requested)
- Admin panel avatars (those are other users' initials, not the logged-in admin)
