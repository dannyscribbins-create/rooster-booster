# Admin Session Tokens — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Replace the current admin password-based auth (password sent on every request as a query param or body field) with a session token system that mirrors the existing referrer auth pattern exactly. Tokens are generated on login, stored in the `sessions` table, expire after 24 hours, persisted in `sessionStorage` as `rb_admin_token`, and sent as an `Authorization: Bearer` header on all admin API calls.

---

## Schema

One `ALTER TABLE` added to `initDB()` in `server.js`:

```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'referrer';
```

- Existing referrer sessions receive `role='referrer'` via the column default — no data migration needed.
- Admin sessions insert with `user_id=NULL, role='admin'`. The `user_id` column has no `NOT NULL` constraint and already allows NULL.
- `role` is used for strict token separation: referrer routes filter `AND role='referrer'`, admin routes filter `AND role='admin'`.

---

## Backend (`server.js`)

### Admin login — `POST /api/admin/login`

Before: validates password, returns `{ success: true }` with no token.

After: validates password → generates `crypto.randomBytes(32).toString('hex')` → inserts `(user_id=NULL, token, expires_at=NOW()+24h, role='admin')` into `sessions` → returns `{ success: true, token }`.

### New auth helper — `verifyAdminSession(req, res)`

An `async` function that returns `true` if the session is valid, or sends a 401 and returns `false`. Every admin route checks the return value before continuing:

```js
async function verifyAdminSession(req, res) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Not authorized' }); return false; }
  const result = await pool.query(
    'SELECT * FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
    [token, 'admin']
  );
  if (!result.rows.length) { res.status(401).json({ error: 'Session expired. Please log in again.' }); return false; }
  return true;
}
```

Calling convention in each route:
```js
app.get('/api/admin/...', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  // ... route logic
});
```

This ensures the route handler exits immediately after a 401 is sent, preventing "headers already sent" errors.

### Admin endpoints updated (9 total)

Each endpoint replaces its `checkAdminPassword()` call with `verifyAdminSession`. The `password` query param and body field are removed from every route signature:

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id/pin`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/referrer/:name`
- `GET /api/admin/cashouts`
- `PATCH /api/admin/cashouts/:id`
- `GET /api/admin/activity`
- `GET /api/admin/stats`

### Referrer session checks updated (2 endpoints)

`AND role='referrer'` added to session lookup in:

- `GET /api/pipeline`
- `POST /api/cashout`

### Cleanup

`checkAdminPassword()` function and `ADMIN_PASSWORD` JS constant are deleted from `server.js`. The `ADMIN_PASSWORD` environment variable in Railway can be retained or removed independently — it simply becomes unused by the app.

---

## Frontend (`src/App.js`)

### Admin login component

- On successful `POST /api/admin/login`, extract `token` from response.
- Store: `sessionStorage.setItem('rb_admin_token', token)`.
- `password` is no longer held in React state after login.

### Admin sub-components (AdminDashboard, AdminReferrers, AdminCashOuts, AdminActivity)

- Remove `password` prop from all 4 components. `setLoggedIn` continues to be passed as a prop so 401 handling can redirect to the login screen.
- Each component reads token directly: `sessionStorage.getItem('rb_admin_token')`.
- All fetch calls that currently send `?password=...` or `{ password }` in the body are updated to send `Authorization: Bearer <token>` as a header instead (~10 call sites).

### 401 handling

When any admin API call returns a 401:

```js
sessionStorage.removeItem('rb_admin_token');
setLoggedIn(false);
```

`removeItem` is called first to ensure no stale token persists before the login screen renders.

### Admin logout

Clears `rb_admin_token` from sessionStorage only. No server-side logout endpoint — the single-admin use case doesn't warrant it, and tokens expire in 24h regardless.

---

## Security Properties

- Password never transmitted beyond the login request.
- Admin tokens cannot be used on referrer routes (`AND role='referrer'` guard).
- Referrer tokens cannot be used on admin routes (`AND role='admin'` guard).
- Token is a 64-character hex string (32 random bytes), same entropy as referrer tokens.
- 401 response clears stale token before redirecting to login.

---

## Out of Scope

- Multiple admin users (single admin password remains the credential).
- Server-side logout / token revocation endpoint.
- Token refresh — admin re-authenticates after 24h expiry.
