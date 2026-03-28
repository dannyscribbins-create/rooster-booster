# Login Logo + Profile Photo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Accent Roofing logo to the referrer login card and allow referrers to upload a profile photo that replaces their initials circle on the Dashboard and Profile screens.

**Architecture:** A `profile_photo TEXT` column is added to `users` via a safe `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migration in the existing `initDatabase` block. Two new authenticated REST endpoints (`GET/POST /api/profile/photo`) follow the exact same token-lookup pattern as `/api/cashout`. On the frontend, `profilePhoto` state lives in the root `App` component and is fetched once after login; a new inline `AvatarCircle` helper renders either a photo or initials depending on whether a photo exists.

**Tech Stack:** Node.js/Express, PostgreSQL (via `pg` pool), React (inline styles, no CSS framework), Phosphor Icons v2.1.1

---

## File Map

| File | What changes |
|------|-------------|
| `server.js` | Add `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`; add `GET /api/profile/photo`; add `POST /api/profile/photo` |
| `src/App.js` | Add `AvatarCircle` helper (inline, before `LoginScreen`); add `profilePhoto` + `setProfilePhoto` state to root `App`; fetch photo after login; pass `profilePhoto` to `Dashboard` and `Profile`; replace both initials circles with `AvatarCircle`; add upload input + handler to `Profile`; add Accent Roofing logo to `LoginScreen` |

---

## Task 1: DB migration — add `profile_photo` column

**Files:**
- Modify: `server.js` lines 67–69 (existing `ALTER TABLE` block)

- [ ] **Step 1: Add the migration line**

In `server.js`, find the block of `ALTER TABLE` statements (currently lines 67–69):

```js
await pool.query(`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);
await pool.query(`ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS method TEXT`);
await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'referrer'`);
```

Add one line immediately after:

```js
await pool.query(`ALTER TABLE tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);
await pool.query(`ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS method TEXT`);
await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'referrer'`);
await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`);
```

- [ ] **Step 2: Verify server starts without error**

```bash
node server.js
```

Expected: Server starts on port 4000, no crash, no Postgres error. The `ADD COLUMN IF NOT EXISTS` is idempotent — safe to run on a database that already has the column or one that doesn't.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "db: add profile_photo column to users table"
```

---

## Task 2: Server — `GET /api/profile/photo` endpoint

**Files:**
- Modify: `server.js` — add endpoint after the `/api/cashout` block (around line 245)

- [ ] **Step 1: Add the GET endpoint**

In `server.js`, after the closing `});` of `app.post('/api/cashout', ...)`, add:

```js
// ── REFERRER: GET PROFILE PHOTO ───────────────────────────────────────────────
app.get('/api/profile/photo', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  const sessionResult = await pool.query(
    'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
    [token, 'referrer']
  );
  if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
  const userId = sessionResult.rows[0].user_id;
  try {
    const result = await pool.query('SELECT profile_photo FROM users WHERE id=$1', [userId]);
    res.json({ photo: result.rows[0]?.profile_photo || null });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch photo' }); }
});
```

- [ ] **Step 2: Verify with curl**

Start the server, log in to get a token (use the `/api/login` endpoint), then:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/profile/photo
```

Expected response (no photo uploaded yet): `{"photo":null}`

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: GET /api/profile/photo endpoint"
```

---

## Task 3: Server — `POST /api/profile/photo` endpoint

**Files:**
- Modify: `server.js` — add endpoint immediately after the GET endpoint from Task 2

- [ ] **Step 1: Add the POST endpoint**

```js
// ── REFERRER: SAVE PROFILE PHOTO ──────────────────────────────────────────────
app.post('/api/profile/photo', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  const sessionResult = await pool.query(
    'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
    [token, 'referrer']
  );
  if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
  const { photo } = req.body;
  if (!photo) return res.status(400).json({ error: 'No photo provided' });
  const userId = sessionResult.rows[0].user_id;
  try {
    await pool.query('UPDATE users SET profile_photo=$1 WHERE id=$2', [photo, userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to save photo' }); }
});
```

- [ ] **Step 2: Check Express body size limit**

Base64 of a 2MB image is ~2.7MB. Express's default JSON body limit is 100kb — this will reject the upload. Find the `express.json()` middleware line in `server.js` (likely near the top) and increase the limit:

```js
app.use(express.json({ limit: '5mb' }));
```

- [ ] **Step 3: Verify with curl**

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"photo":"data:image/png;base64,iVBORw0KGgo="}' \
  http://localhost:4000/api/profile/photo
```

Expected: `{"success":true}`

Then verify the GET endpoint now returns the photo:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/profile/photo
```

Expected: `{"photo":"data:image/png;base64,iVBORw0KGgo="}`

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: POST /api/profile/photo endpoint + increase JSON body limit"
```

---

## Task 4: Frontend — `AvatarCircle` helper component

**Files:**
- Modify: `src/App.js` — add `AvatarCircle` function just before the `// ─── Login Screen` comment (line ~349)

- [ ] **Step 1: Add the `AvatarCircle` component**

Insert the following before the `// ─── Login Screen` comment:

```jsx
// ─── Avatar Circle ────────────────────────────────────────────────────────────
function AvatarCircle({ userName, profilePhoto, size, shadow, onClick, showCameraHint }) {
  const initials = userName.split(" ").map(n => n[0]).join("");
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      style={{ position: "relative", width: size, height: size, flexShrink: 0, cursor: onClick ? "pointer" : "default" }}
    >
      {profilePhoto ? (
        <img
          src={profilePhoto}
          alt={userName}
          style={{
            width: size, height: size, borderRadius: "50%",
            objectFit: "cover", boxShadow: shadow, display: "block",
          }}
        />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: "50%",
          background: R.red, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.34, fontWeight: 700, fontFamily: R.fontMono,
          boxShadow: shadow,
        }}>
          {initials}
        </div>
      )}
      {showCameraHint && (
        <div style={{
          position: "absolute", bottom: 0, right: 0,
          width: 22, height: 22, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <i className="ph ph-camera" style={{ fontSize: 12, color: R.navy }} />
        </div>
      )}
    </div>
  );
}
```

**Note:** The component has two `style` props on the outer div — fix this by combining them into one. The correct outer div is:

```jsx
<div
  onClick={onClick}
  role={onClick ? "button" : undefined}
  style={{ position: "relative", width: size, height: size, flexShrink: 0, cursor: onClick ? "pointer" : "default" }}
>
```

- [ ] **Step 2: Verify the app still compiles**

```bash
npm start
```

Expected: App loads, no compile errors in console. `AvatarCircle` is defined but not yet used anywhere — that's fine.

- [ ] **Step 3: Commit**

```bash
git add src/App.js
git commit -m "feat: AvatarCircle helper component"
```

---

## Task 5: Frontend — `profilePhoto` state + fetch in root `App`

**Files:**
- Modify: `src/App.js` — root `App` component (around lines 2411–2464)

- [ ] **Step 1: Add `profilePhoto` state**

In the `App` function, find the state declarations (lines 2412–2419):

```js
const [loggedIn, setLoggedIn]   = useState(false);
const [tab, setTab]             = useState("dashboard");
const [userName, setUserName]   = useState("");
const [userEmail, setUserEmail] = useState("");
const [pipeline, setPipeline]   = useState([]);
const [balance, setBalance]     = useState(0);
const [paidCount, setPaidCount] = useState(0);
const [loading, setLoading]     = useState(false);
```

Add `profilePhoto` state:

```js
const [loggedIn, setLoggedIn]       = useState(false);
const [tab, setTab]                 = useState("dashboard");
const [userName, setUserName]       = useState("");
const [userEmail, setUserEmail]     = useState("");
const [pipeline, setPipeline]       = useState([]);
const [balance, setBalance]         = useState(0);
const [paidCount, setPaidCount]     = useState(0);
const [loading, setLoading]         = useState(false);
const [profilePhoto, setProfilePhoto] = useState(null);
```

- [ ] **Step 2: Fetch profile photo after login**

Find the existing `useEffect` that fetches pipeline data (around line 2425). It already fires when `loggedIn && userName`. Add a parallel fetch for the photo inside the same `useEffect`, after the pipeline fetch call:

```js
useEffect(() => {
  if (loggedIn && userName) {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/pipeline?referrer=${encodeURIComponent(userName)}`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("rb_token")}` },
    })
      .then(res => res.json())
      .then(data => {
        setPipeline(Array.isArray(data.pipeline) ? data.pipeline : []);
        setBalance(data.balance || 0);
        setPaidCount(data.paidCount || 0);
        setLoading(false);
      })
      .catch(err => { console.error(err); setLoading(false); });

    fetch(`${BACKEND_URL}/api/profile/photo`, {
      headers: { "Authorization": `Bearer ${sessionStorage.getItem("rb_token")}` },
    })
      .then(res => res.json())
      .then(data => { if (data.photo) setProfilePhoto(data.photo); })
      .catch(() => {}); // non-critical — silently fail
  }
}, [loggedIn, userName]);
```

- [ ] **Step 3: Pass `profilePhoto` and `setProfilePhoto` to `Dashboard` and `Profile`**

Find the `screens` object (around line 2452):

```js
const screens = {
  dashboard: <Dashboard setTab={setTab} pipeline={pipeline} loading={loading} userName={userName} balance={balance} paidCount={paidCount} />,
  pipeline:  <Pipeline pipeline={pipeline} loading={loading} />,
  cashout:   <CashOut pipeline={pipeline} userName={userName} userEmail={userEmail} />,
  history:   <History pipeline={pipeline} />,
  profile:   <Profile onLogout={() => { setLoggedIn(false); setPipeline([]); setUserName(""); sessionStorage.removeItem("rb_token"); }} pipeline={pipeline} userName={userName} />,
};
```

Update `dashboard` and `profile` entries:

```js
const screens = {
  dashboard: <Dashboard setTab={setTab} pipeline={pipeline} loading={loading} userName={userName} balance={balance} paidCount={paidCount} profilePhoto={profilePhoto} />,
  pipeline:  <Pipeline pipeline={pipeline} loading={loading} />,
  cashout:   <CashOut pipeline={pipeline} userName={userName} userEmail={userEmail} />,
  history:   <History pipeline={pipeline} />,
  profile:   <Profile onLogout={() => { setLoggedIn(false); setPipeline([]); setUserName(""); setProfilePhoto(null); sessionStorage.removeItem("rb_token"); }} pipeline={pipeline} userName={userName} profilePhoto={profilePhoto} setProfilePhoto={setProfilePhoto} />,
};
```

Note `setProfilePhoto(null)` is added to the logout handler so the photo clears when the user logs out.

- [ ] **Step 4: Verify the app still compiles**

```bash
npm start
```

Expected: App loads, no errors. Props are passed but not yet consumed — that's fine.

- [ ] **Step 5: Commit**

```bash
git add src/App.js
git commit -m "feat: profilePhoto state + fetch in App, pass props to Dashboard and Profile"
```

---

## Task 6: Frontend — replace Dashboard initials circle with `AvatarCircle`

**Files:**
- Modify: `src/App.js` — `Dashboard` function signature and header avatar (lines 533, 582–590)

- [ ] **Step 1: Add `profilePhoto` to Dashboard's destructured props**

Find:
```js
function Dashboard({ setTab, pipeline, loading, userName, balance, paidCount }) {
```

Replace with:
```js
function Dashboard({ setTab, pipeline, loading, userName, balance, paidCount, profilePhoto }) {
```

- [ ] **Step 2: Replace the initials circle div with `AvatarCircle`**

Find the avatar div in the Dashboard header (lines 582–590):

```jsx
<div style={{
  width: 44, height: 44, borderRadius: "50%",
  background: R.red, color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 15, fontWeight: 700, fontFamily: R.fontMono,
  boxShadow: "0 0 0 3px rgba(255,255,255,0.2)",
}}>
  {userName.split(" ").map(n => n[0]).join("")}
</div>
```

Replace with:

```jsx
<AvatarCircle
  userName={userName}
  profilePhoto={profilePhoto}
  size={44}
  shadow="0 0 0 3px rgba(255,255,255,0.2)"
  showCameraHint={false}
/>
```

- [ ] **Step 3: Verify visually**

```bash
npm start
```

Log in and check the Dashboard. If no photo uploaded: initials circle looks identical to before. If you manually set `profilePhoto` state to a data URL in React DevTools, a circular photo should appear.

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: use AvatarCircle in Dashboard header"
```

---

## Task 7: Frontend — replace Profile initials circle with `AvatarCircle` + upload

**Files:**
- Modify: `src/App.js` — `Profile` function (lines 1520–1623)

- [ ] **Step 1: Add `profilePhoto` and `setProfilePhoto` to Profile's destructured props**

Find:
```js
function Profile({ onLogout, pipeline, userName }) {
```

Replace with:
```js
function Profile({ onLogout, pipeline, userName, profilePhoto, setProfilePhoto }) {
```

- [ ] **Step 2: Add upload state and file input ref**

After the existing state declarations inside `Profile` (`showContact` state, around line 1524), add:

```js
const [uploadError, setUploadError] = useState("");
const fileInputRef = useRef(null);
```

`useRef` is already imported from React at the top of the file — confirm this. If not present, add it to the import: `import { useState, useEffect, useRef } from "react";`

- [ ] **Step 3: Add the upload handler**

After the new state declarations, add:

```js
function handlePhotoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  setUploadError("");
  if (file.size > 2 * 1024 * 1024) {
    setUploadError("Photo must be under 2MB");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result;
    fetch(`${BACKEND_URL}/api/profile/photo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessionStorage.getItem("rb_token")}`,
      },
      body: JSON.stringify({ photo: base64 }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setProfilePhoto(base64);
        else setUploadError("Upload failed. Please try again.");
      })
      .catch(() => setUploadError("Upload failed. Please try again."));
  };
  reader.readAsDataURL(file);
}
```

- [ ] **Step 4: Replace the initials circle div with `AvatarCircle` + add hidden file input**

Find the avatar section in the Profile header (lines 1538–1555):

```jsx
{/* Avatar + name */}
<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
  <div style={{
    width: 64, height: 64, borderRadius: "50%",
    background: R.red, color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 22, fontWeight: 700, fontFamily: R.fontMono,
    boxShadow: "0 0 0 4px rgba(255,255,255,0.2)",
  }}>
    {userName.split(" ").map(n => n[0]).join("")}
  </div>
```

Replace with:

```jsx
{/* Avatar + name */}
<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    style={{ display: "none" }}
    onChange={handlePhotoSelect}
  />
  <AvatarCircle
    userName={userName}
    profilePhoto={profilePhoto}
    size={64}
    shadow="0 0 0 4px rgba(255,255,255,0.2)"
    onClick={() => fileInputRef.current.click()}
    showCameraHint={true}
  />
```

- [ ] **Step 5: Add upload error display**

After the closing `</div>` of the avatar+name section (just before `</div>` that closes the navy header div), add the error message. Find the line immediately after the name/sold count block closes:

```jsx
      </div>
    </div>
  </div>  {/* end navy header */}
```

Insert the error just before the last closing `</div>` of the navy header:

```jsx
  {uploadError && (
    <p style={{ margin: "8px 0 0", fontSize: 13, color: "#fca5a5" }}>{uploadError}</p>
  )}
</div>  {/* end navy header */}
```

- [ ] **Step 6: Verify visually**

```bash
npm start
```

Go to Profile screen. The initials circle should show the camera overlay icon. Tap it — the file picker should open. Select a photo under 2MB — the circle should update to show the photo. Navigate to Dashboard — the 44px circle should also show the photo.

- [ ] **Step 7: Commit**

```bash
git add src/App.js
git commit -m "feat: profile photo upload — tap avatar to upload, persists to DB"
```

---

## Task 8: Frontend — Accent Roofing logo on login card

**Files:**
- Modify: `src/App.js` — `LoginScreen` function (around line 419)

- [ ] **Step 1: Add the logo inside the login card**

The `accentRoofingLogo` import already exists (added in a previous commit for the cash out confirmation screen). Find the login card header inside `LoginScreen` (around line 419):

```jsx
<h2 style={{
  margin: "0 0 8px", fontSize: 22, fontWeight: 700,
  fontFamily: R.fontSans, color: R.navy,
}}>Welcome back</h2>
<p style={{ margin: "0 0 24px", fontSize: 15, color: R.textSecondary }}>
  Sign in to view your referral rewards
</p>
```

Replace with:

```jsx
<img
  src={accentRoofingLogo}
  alt="Accent Roofing Service"
  style={{ width: 120, height: "auto", display: "block", margin: "0 auto 20px" }}
/>
<h2 style={{
  margin: "0 0 8px", fontSize: 22, fontWeight: 700,
  fontFamily: R.fontSans, color: R.navy,
}}>Welcome back</h2>
<p style={{ margin: "0 0 24px", fontSize: 15, color: R.textSecondary }}>
  Sign in to view your referral rewards
</p>
```

- [ ] **Step 2: Verify visually**

```bash
npm start
```

Log out (or open in a fresh session so the login screen shows). The Accent Roofing logo should appear centered at the top of the white login card, above "Welcome back". The Rooster Booster wordmark still shows above the card as before.

- [ ] **Step 3: Commit**

```bash
git add src/App.js
git commit -m "feat: Accent Roofing logo on login card"
```

---

## Task 9: Final integration commit + push

- [ ] **Step 1: Smoke test the full flow**

1. Load the app — confirm Accent Roofing logo appears on the login card
2. Log in — confirm Dashboard initials circle appears normally (no photo yet)
3. Go to Profile — confirm camera overlay on initials circle
4. Tap circle, upload a photo ≤ 2MB — confirm circle updates to photo
5. Navigate to Dashboard — confirm 44px circle also shows the photo
6. Log out and log back in — confirm photo is still there (fetched from DB)
7. Try uploading a file > 2MB — confirm "Photo must be under 2MB" error appears

- [ ] **Step 2: Push to GitHub**

```bash
git push
git log --oneline -6
```

Expected: Six commits visible since the start of this feature, ending with the final push message `"contractor logo on login card + profile photo upload"`.

---

## Self-Review Checklist

**Spec coverage:**
- [x] Accent Roofing logo on login card → Task 8
- [x] Profile photo upload → Tasks 1–7
- [x] base64 stored in DB on `users.profile_photo` → Tasks 1–3
- [x] Token-only auth on server endpoints → Tasks 2–3
- [x] Camera icon overlay on circle → Task 4 (`showCameraHint`)
- [x] Photo replaces initials on Dashboard → Task 6
- [x] Photo replaces initials on Profile → Task 7
- [x] Fallback to initials when no photo → Task 4 (`AvatarCircle` conditional)
- [x] Tap circle opens file picker → Task 7
- [x] 2MB size guard → Task 7
- [x] `setProfilePhoto(null)` on logout → Task 5
- [x] Express body size limit increased for base64 payload → Task 3
- [x] Pipeline referral initials circles (lines 825, 1006) NOT changed → confirmed out of scope

**Placeholder scan:** No TBDs, all code blocks complete, all types consistent.

**Type consistency:** `profilePhoto` (string | null) used consistently across Tasks 4–7. `AvatarCircle` props `userName`, `profilePhoto`, `size`, `shadow`, `onClick`, `showCameraHint` defined in Task 4 and consumed identically in Tasks 6 and 7.
