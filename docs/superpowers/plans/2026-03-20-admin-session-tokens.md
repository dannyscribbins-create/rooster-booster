# Admin Session Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace password-based admin auth with session tokens that mirror the existing referrer token system.

**Architecture:** Add a `role` column to the `sessions` table; admin login generates a 64-char hex token stored with `role='admin'` and `user_id=NULL`; all 9 admin endpoints validate via a new `verifyAdminSession` helper; all 2 referrer session checks gain `AND role='referrer'`; the frontend stores the admin token in `sessionStorage` as `rb_admin_token` and sends it as an `Authorization: Bearer` header.

**Tech Stack:** Node.js/Express, PostgreSQL (`pg`), React (inline styles, no framework), `crypto` (built-in Node module — no new dependencies)

---

## Files Modified

| File | What changes |
|------|-------------|
| `server.js` | Schema migration, new `verifyAdminSession` helper, admin login token issuance, 9 admin endpoints swapped to token auth, 2 referrer endpoints get role filter, `checkAdminPassword` + `ADMIN_PASSWORD` deleted |
| `src/App.js` | `AdminLogin` captures token; `AdminPanel` stores token, removes password state/prop; `AdminDashboard`, `AdminReferrers`, `AdminCashOuts`, `AdminActivity` each read token from sessionStorage and send as Authorization header |

---

## Task 1: Add `role` column to sessions table

**Files:**
- Modify: `server.js:60-66`

### Context
`initDB()` runs at startup and uses `IF NOT EXISTS` guards, so adding a new `ALTER TABLE` there is safe and idempotent. The default `'referrer'` backfills all existing rows automatically.

- [ ] **Step 1: Add the migration**

In `server.js`, inside `initDB()` after the existing `ALTER TABLE tokens` line (currently line 67), add:

```js
await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'referrer'`);
```

- [ ] **Step 2: Start the server and verify the column exists**

```bash
node server.js
```

Then in a separate terminal, connect to the database and confirm:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sessions' AND column_name = 'role';
```

Expected: one row with `column_name=role`, `data_type=text`, `column_default='referrer'`.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add role column to sessions table"
```

---

## Task 2: Add `verifyAdminSession` helper and update admin login

**Files:**
- Modify: `server.js:247-252`

### Context
Lines 247–248 define `ADMIN_PASSWORD` and `checkAdminPassword`. Line 250–252 is `POST /api/admin/login`. We're replacing both with a token-issuing login and a reusable session validator.

- [ ] **Step 1: Replace the auth constant and login endpoint**

Delete lines 247–252 (the `ADMIN_PASSWORD` constant, `checkAdminPassword` function, and existing `POST /api/admin/login` handler) and replace with:

```js
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'rooster123';

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

app.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Incorrect password' });
  const token = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at, role) VALUES (NULL,$1,$2,$3)',
    [token, expiresAt, 'admin']
  );
  res.json({ success: true, token });
});
```

Note: `ADMIN_PASSWORD` is kept as a JS constant for the login check. It is only used here — never again after this task.

- [ ] **Step 2: Verify login issues a token**

```bash
curl -s -X POST http://localhost:4000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"rooster123"}' | jq .
```

Expected:
```json
{ "success": true, "token": "<64-char hex string>" }
```

- [ ] **Step 3: Verify wrong password returns 401**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong"}'
```

Expected: `401`

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: add verifyAdminSession helper and issue token on admin login"
```

---

## Task 3: Update all 9 admin endpoints to use `verifyAdminSession`

**Files:**
- Modify: `server.js:255-378`

### Context
Each endpoint currently calls `checkAdminPassword(req.query.password)` or `checkAdminPassword(password)` from the request body. Replace every such check with `if (!await verifyAdminSession(req, res)) return;`. Remove `password` from query params and body destructuring for each endpoint.

- [ ] **Step 1: Update `GET /api/admin/users` (line ~256)**

Before:
```js
app.get('/api/admin/users', async (req, res) => {
  if (!checkAdminPassword(req.query.password)) return res.status(401).json({ error: 'Unauthorized' });
```

After:
```js
app.get('/api/admin/users', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
```

- [ ] **Step 2: Update `POST /api/admin/users` (line ~262)**

Before:
```js
app.post('/api/admin/users', async (req, res) => {
  const { password, full_name, email, pin } = req.body;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
```

After:
```js
app.post('/api/admin/users', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { full_name, email, pin } = req.body;
```

- [ ] **Step 3: Update `PATCH /api/admin/users/:id/pin` (line ~276)**

Before:
```js
app.patch('/api/admin/users/:id/pin', async (req, res) => {
  const { password, pin } = req.body;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
```

After:
```js
app.patch('/api/admin/users/:id/pin', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { pin } = req.body;
```

- [ ] **Step 4: Update `DELETE /api/admin/users/:id` (line ~285)**

Before:
```js
app.delete('/api/admin/users/:id', async (req, res) => {
  if (!checkAdminPassword(req.query.password)) return res.status(401).json({ error: 'Unauthorized' });
```

After:
```js
app.delete('/api/admin/users/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
```

- [ ] **Step 5: Update `GET /api/admin/referrer/:name` (line ~294)**

Before:
```js
app.get('/api/admin/referrer/:name', async (req, res) => {
  if (!checkAdminPassword(req.query.password)) return res.status(401).json({ error: 'Unauthorized' });
```

After:
```js
app.get('/api/admin/referrer/:name', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
```

- [ ] **Step 6: Update `GET /api/admin/cashouts` (line ~303)**

Before:
```js
app.get('/api/admin/cashouts', async (req, res) => {
  if (!checkAdminPassword(req.query.password)) return res.status(401).json({ error: 'Unauthorized' });
```

After:
```js
app.get('/api/admin/cashouts', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
```

- [ ] **Step 7: Update `PATCH /api/admin/cashouts/:id` (line ~310)**

Before:
```js
app.patch('/api/admin/cashouts/:id', async (req, res) => {
  const { password, status } = req.body;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
```

After:
```js
app.patch('/api/admin/cashouts/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { status } = req.body;
```

- [ ] **Step 8: Update `GET /api/admin/activity` (line ~327)**

Before:
```js
app.get('/api/admin/activity', async (req, res) => {
  if (!checkAdminPassword(req.query.password)) return res.status(401).json({ error: 'Unauthorized' });
```

After:
```js
app.get('/api/admin/activity', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
```

- [ ] **Step 9: Update `GET /api/admin/stats` (line ~336)**

Before:
```js
app.get('/api/admin/stats', async (req, res) => {
  const { password, refresh } = req.query;
  if (!checkAdminPassword(password)) return res.status(401).json({ error: 'Unauthorized' });
```

After:
```js
app.get('/api/admin/stats', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { refresh } = req.query;
```

- [ ] **Step 10: Confirm `checkAdminPassword` is removed and `ADMIN_PASSWORD` is retained**

`checkAdminPassword` was deleted as part of the block replacement in Task 2. Verify it no longer appears anywhere in `server.js`. `ADMIN_PASSWORD` is still in use (the login handler compares against it) and must be kept.

- [ ] **Step 11: Verify all 9 endpoints reject requests without a token**

Use the token from Task 2 verification. First confirm a valid token works:

```bash
TOKEN="<paste token from Task 2>"

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/admin/users
```

Expected: `200`

Then confirm a request without a token is rejected:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:4000/api/admin/users
```

Expected: `401`

- [ ] **Step 12: Commit**

```bash
git add server.js
git commit -m "feat: replace checkAdminPassword with verifyAdminSession on all admin endpoints"
```

---

## Task 4: Add `role='referrer'` filter to referrer session checks

**Files:**
- Modify: `server.js:179-183` (`GET /api/pipeline`)
- Modify: `server.js:218-222` (`POST /api/cashout`)

### Context
Currently these two checks query `sessions WHERE token=$1 AND expires_at > NOW()`. Adding `AND role=$2` with value `'referrer'` ensures admin tokens cannot be used on referrer routes.

- [ ] **Step 1: Update `GET /api/pipeline` session query (line ~180)**

Before:
```js
const sessionResult = await pool.query(
  'SELECT * FROM sessions WHERE token=$1 AND expires_at > NOW()',
  [token]
);
```

After:
```js
const sessionResult = await pool.query(
  'SELECT * FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
  [token, 'referrer']
);
```

- [ ] **Step 2: Update `POST /api/cashout` session query (line ~219)**

Before:
```js
const sessionResult = await pool.query(
  'SELECT * FROM sessions WHERE token=$1 AND expires_at > NOW()',
  [token]
);
```

After:
```js
const sessionResult = await pool.query(
  'SELECT * FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
  [token, 'referrer']
);
```

- [ ] **Step 3: Verify an admin token is rejected on a referrer endpoint**

```bash
TOKEN="<admin token from Task 2>"

curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/pipeline?referrer=Test"
```

Expected: `401` (admin token rejected on referrer route)

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: enforce role=referrer on referrer session checks"
```

---

## Task 5: Update `AdminLogin` to capture and store token

**Files:**
- Modify: `src/App.js:2135-2165`

### Context
`AdminLogin` is a self-contained component. Its `handleLogin` function currently calls `onLogin(password)` — we change it to call `onLogin(token)` after storing the token in sessionStorage.

- [ ] **Step 1: Update `handleLogin` in `AdminLogin`**

Before (lines ~2139–2147):
```js
function handleLogin() {
  fetch(`${BACKEND_URL}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then(r => r.json()).then(d => {
    if (d.error) setError('Incorrect password');
    else onLogin(password);
  });
}
```

After:
```js
function handleLogin() {
  fetch(`${BACKEND_URL}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then(r => r.json()).then(d => {
    if (d.error) setError('Incorrect password');
    else {
      sessionStorage.setItem('rb_admin_token', d.token);
      onLogin();
    }
  });
}
```

Note: `onLogin` no longer receives the password — it receives nothing. `AdminPanel.handleLogin` will be updated in Task 6.

- [ ] **Step 2: Commit**

```bash
git add src/App.js
git commit -m "feat: AdminLogin stores token in sessionStorage on success"
```

---

## Task 6: Update `AdminPanel` — remove password state, wire token for pending count fetch

**Files:**
- Modify: `src/App.js:2167-2196`

### Context
`AdminPanel` currently holds `password` in state, passes it to all 4 sub-components, and calls `checkAdminPassword`-backed endpoints with `?password=...` during `handleLogin`. We remove `password` state entirely, update `handleLogin` to read the token from sessionStorage (already stored by `AdminLogin`), and update the initial pending-count fetch to use the Authorization header.

- [ ] **Step 1: Rewrite `AdminPanel`**

Before (lines ~2167–2196):
```js
function AdminPanel() {
  const [authed, setAuthed]         = useState(false);
  const [password, setPassword]     = useState('');
  const [page, setPage]             = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);

  useAdminFonts();

  function handleLogin(pw) {
    setPassword(pw); setAuthed(true);
    fetch(`${BACKEND_URL}/api/admin/cashouts?password=${encodeURIComponent(pw)}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPendingCount(d.filter(c => c.status === 'pending').length); });
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />;

  const pages = {
    dashboard: <AdminDashboard password={password} setPage={setPage} />,
    referrers: <AdminReferrers password={password} />,
    cashouts:  <AdminCashOuts  password={password} />,
    activity:  <AdminActivity  password={password} />,
  };
  ...
}
```

After:
```js
function AdminPanel() {
  const [authed, setAuthed]         = useState(false);
  const [page, setPage]             = useState('dashboard');
  const [pendingCount, setPendingCount] = useState(0);

  useAdminFonts();

  function handleLogin() {
    setAuthed(true);
    const token = sessionStorage.getItem('rb_admin_token');
    fetch(`${BACKEND_URL}/api/admin/cashouts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPendingCount(d.filter(c => c.status === 'pending').length); });
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />;

  const pages = {
    dashboard: <AdminDashboard setLoggedIn={setAuthed} setPage={setPage} />,
    referrers: <AdminReferrers setLoggedIn={setAuthed} />,
    cashouts:  <AdminCashOuts  setLoggedIn={setAuthed} />,
    activity:  <AdminActivity  setLoggedIn={setAuthed} />,
  };
  ...
}
```

Note: `setLoggedIn` here is `setAuthed` from `AdminPanel`'s own state — it controls whether the panel shows or redirects to `AdminLogin`. Pass it as the `setLoggedIn` prop to each sub-component for their 401 handlers.

- [ ] **Step 2: Commit**

```bash
git add src/App.js
git commit -m "feat: AdminPanel uses token auth, removes password state"
```

---

## Task 7: Update `AdminDashboard` to use token

**Files:**
- Modify: `src/App.js:1703-1812`

### Context
`AdminDashboard` receives `{ password, setPage }`. It has one fetch: `GET /api/admin/stats`. Replace `password` with `setLoggedIn` in the props and update the fetch.

- [ ] **Step 1: Update component signature and fetch**

Change the function signature from:
```js
function AdminDashboard({ password, setPage }) {
```
To:
```js
function AdminDashboard({ setLoggedIn, setPage }) {
```

Update the stats fetch (line ~1710) from:
```js
fetch(`${BACKEND_URL}/api/admin/stats?password=${encodeURIComponent(password)}${forceRefresh ? '&refresh=true' : ''}`)
```
To:
```js
fetch(`${BACKEND_URL}/api/admin/stats${forceRefresh ? '?refresh=true' : ''}`, {
  headers: { 'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
})
```

Add 401 handling in the `.then(r => r.json())` chain. The fetch chain currently looks like:
```js
.then(r => r.json()).then(d => { ... })
```

Update to:
```js
.then(r => {
  if (r.status === 401) { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); return null; }
  return r.json();
}).then(d => { if (!d) return; ... })
```

- [ ] **Step 2: Commit**

```bash
git add src/App.js
git commit -m "feat: AdminDashboard uses token auth"
```

---

## Task 8: Update `AdminReferrers` to use token

**Files:**
- Modify: `src/App.js:1813-1996`

### Context
`AdminReferrers` has 5 fetch call sites: `loadUsers` (GET users), `loadReferrerDetail` (GET referrer/:name), `handleAdd` (POST users), `handleRemove` (DELETE users/:id), `handleResetPin` (PATCH users/:id/pin).

- [ ] **Step 1: Update component signature**

Change:
```js
function AdminReferrers({ password }) {
```
To:
```js
function AdminReferrers({ setLoggedIn }) {
```

- [ ] **Step 2: Add a helper for the token and 401 handler at the top of the component**

Add these two lines just inside the function body (before the first `useState`):
```js
const adminToken = () => sessionStorage.getItem('rb_admin_token');
const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
```

- [ ] **Step 3: Update `loadUsers` fetch (line ~1829)**

Before:
```js
fetch(`${BACKEND_URL}/api/admin/users?password=${encodeURIComponent(password)}`)
```

After:
```js
fetch(`${BACKEND_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${adminToken()}` } })
  .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
```

Remove the existing `.then(r => r.json())` that follows and replace with `.then(d => { if (!d) return; ... })`.

- [ ] **Step 4: Update `loadReferrerDetail` fetch (line ~1837)**

Before:
```js
fetch(`${BACKEND_URL}/api/admin/referrer/${encodeURIComponent(user.full_name)}?password=${encodeURIComponent(password)}`)
```

After:
```js
fetch(`${BACKEND_URL}/api/admin/referrer/${encodeURIComponent(user.full_name)}`, {
  headers: { 'Authorization': `Bearer ${adminToken()}` },
})
.then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
```

Update the following `.then(d => ...)` to guard with `if (!d) return;`.

- [ ] **Step 5: Update `handleAdd` fetch (line ~1845)**

Before:
```js
fetch(`${BACKEND_URL}/api/admin/users`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password, full_name: newName, email: newEmail, pin: newPin }),
})
```

After:
```js
fetch(`${BACKEND_URL}/api/admin/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
  body: JSON.stringify({ full_name: newName, email: newEmail, pin: newPin }),
})
.then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
```

Update the following `.then(d => ...)` to guard with `if (!d) return;`.

- [ ] **Step 6: Update `handleRemove` fetch (line ~1856)**

Before:
```js
fetch(`${BACKEND_URL}/api/admin/users/${id}?password=${encodeURIComponent(password)}`, { method: 'DELETE' })
```

After:
```js
fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${adminToken()}` },
})
.then(r => { if (r.status === 401) { on401(); return; } loadUsers(); })
```

Remove the trailing `.then(() => loadUsers())` since we folded it into the new chain.

- [ ] **Step 7: Update `handleResetPin` fetch (line ~1863)**

Before:
```js
fetch(`${BACKEND_URL}/api/admin/users/${id}/pin`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password, pin: p }),
})
```

After:
```js
fetch(`${BACKEND_URL}/api/admin/users/${id}/pin`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
  body: JSON.stringify({ pin: p }),
})
```

- [ ] **Step 8: Commit**

```bash
git add src/App.js
git commit -m "feat: AdminReferrers uses token auth"
```

---

## Task 9: Update `AdminCashOuts` to use token

**Files:**
- Modify: `src/App.js:1997-2080`

### Context
`AdminCashOuts` has 2 fetch call sites: `load` (GET cashouts) and `handleAction` (PATCH cashouts/:id).

- [ ] **Step 1: Update component signature**

Change:
```js
function AdminCashOuts({ password }) {
```
To:
```js
function AdminCashOuts({ setLoggedIn }) {
```

- [ ] **Step 2: Add token helper at top of component**

```js
const adminToken = () => sessionStorage.getItem('rb_admin_token');
const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
```

- [ ] **Step 3: Update `load` fetch (line ~2004)**

Before:
```js
fetch(`${BACKEND_URL}/api/admin/cashouts?password=${encodeURIComponent(password)}`)
```

After:
```js
fetch(`${BACKEND_URL}/api/admin/cashouts`, { headers: { 'Authorization': `Bearer ${adminToken()}` } })
  .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
```

Update the following `.then(d => ...)` to guard with `if (!d) return;`.

- [ ] **Step 4: Update `handleAction` fetch (line ~2012)**

Before:
```js
fetch(`${BACKEND_URL}/api/admin/cashouts/${id}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password, status }),
})
```

After:
```js
fetch(`${BACKEND_URL}/api/admin/cashouts/${id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
  body: JSON.stringify({ status }),
})
.then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
```

Update the following `.then(d => ...)` to guard with `if (!d) return;`.

- [ ] **Step 5: Commit**

```bash
git add src/App.js
git commit -m "feat: AdminCashOuts uses token auth"
```

---

## Task 10: Update `AdminActivity` to use token

**Files:**
- Modify: `src/App.js:2081-2133`

### Context
`AdminActivity` has 1 fetch call site: `GET /api/admin/activity`.

- [ ] **Step 1: Update component signature**

Change:
```js
function AdminActivity({ password }) {
```
To:
```js
function AdminActivity({ setLoggedIn }) {
```

- [ ] **Step 2: Add token helper at top of component**

```js
const adminToken = () => sessionStorage.getItem('rb_admin_token');
const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };
```

- [ ] **Step 3: Update the fetch (line ~2087)**

Before:
```js
fetch(`${BACKEND_URL}/api/admin/activity?password=${encodeURIComponent(password)}`)
```

After:
```js
fetch(`${BACKEND_URL}/api/admin/activity`, { headers: { 'Authorization': `Bearer ${adminToken()}` } })
  .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
```

Update the following `.then(d => ...)` to guard with `if (!d) return;`.

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: AdminActivity uses token auth"
```

---

## Task 11: End-to-end smoke test

No automated test suite exists for this backend. Manually verify the complete flow:

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
node server.js

# Terminal 2
npm start
```

- [ ] **Step 2: Verify admin login stores token**

Open the app, navigate to `/admin`, enter the admin password, and log in.
Open DevTools → Application → Session Storage → confirm `rb_admin_token` is set to a 64-char hex string.

- [ ] **Step 3: Verify all 4 admin tabs load correctly**

Click through Dashboard, Referrers, Cash Outs, and Activity Log. Each should load data without errors.

- [ ] **Step 4: Verify 401 bounces back to login**

In DevTools console, run:
```js
sessionStorage.setItem('rb_admin_token', 'invalidtoken')
```
Then navigate to a different admin tab. The app should clear the token and return to the login screen.

- [ ] **Step 5: Verify referrer login still works**

Log in as a referrer. Confirm the referrer dashboard loads normally (role filter should be transparent to existing referrer sessions, which already have `role='referrer'` from the column default).

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: address issues found in smoke test"
```
