# Review Dismiss + Payout Announcement Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Review card dismissal, a payout approval announcement popup with entrance animation, and an admin panel for configuring announcement copy.

**Architecture:** DB migrations run in `initDB()` on server startup. Login response is enriched with `showReviewCard` and `announcement`. Frontend stores these in App-level state. `AnnouncementPopup` is a new component in `App.js`. Admin settings live in a new `AdminAnnouncementSettings` page behind the sidebar.

**Tech Stack:** Node/Express (server.js), React SPA (src/App.js), PostgreSQL (Railway), inline styles, Phosphor Icons v2.1.1

---

## File Map

| File | Changes |
|------|---------|
| `server.js` | `initDB()` migrations; login endpoint; 2 new referrer endpoints; cashout approval update; 2 new admin endpoints |
| `src/App.js` | `LoginScreen.handleLogin`; App-level state + `handleLogin`; `Dashboard` props + Google Review X button; new `AnnouncementPopup` component; new `AdminAnnouncementSettings` component; `AdminPanel` pages map + sidebar nav |

---

## Task 1: DB migrations in initDB()

**Files:**
- Modify: `server.js` (inside `initDB()`, after the last existing `ALTER TABLE` on line 83)

- [ ] **Step 1: Add the migration queries to initDB()**

In `server.js`, find this block (the last two ALTER TABLE lines inside initDB, around line 83):

```js
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`);
  await pool.query(`CREATE TABLE IF NOT EXISTS pin_reset_tokens (
```

Insert these lines immediately after the `profile_photo` ALTER TABLE line (before the pin_reset_tokens CREATE TABLE):

```js
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS review_dismissed_login INTEGER`);
  await pool.query(`CREATE TABLE IF NOT EXISTS payout_announcements (
    id SERIAL PRIMARY KEY,
    cashout_request_id INTEGER REFERENCES cashout_requests(id),
    user_id INTEGER REFERENCES users(id),
    seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payout_announcements_user_unseen
    ON payout_announcements(user_id, seen_at)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS announcement_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    enabled BOOLEAN DEFAULT true,
    mode TEXT DEFAULT 'preset_1',
    custom_message TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`INSERT INTO announcement_settings (id, enabled, mode)
    VALUES (1, true, 'preset_1')
    ON CONFLICT (id) DO NOTHING`);
```

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "feat: add DB migrations for login_count, review_dismissed_login, payout_announcements, announcement_settings"
```

---

## Task 2: Backend — enrich login response

**Files:**
- Modify: `server.js` — `POST /api/login` handler (around line 215)

- [ ] **Step 1: Replace the login handler body**

Find the existing login endpoint. Currently, after creating the session token it does:
```js
    res.json({ success: true, fullName: user.full_name, email: user.email, token });
```

Replace the entire try block inside `app.post('/api/login', ...)` with:

```js
  const { email, pin } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or PIN' });
    const user = result.rows[0];
    const match = await bcrypt.compare(String(pin), user.pin);
    if (!match) return res.status(401).json({ error: 'Invalid email or PIN' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1,$2,$3)',
      [user.id, token, expiresAt]
    );
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('login',$1,$2,$3)`,
      [user.full_name, user.email, 'Logged in']
    );

    // Increment login_count
    await pool.query('UPDATE users SET login_count = login_count + 1 WHERE id = $1', [user.id]);
    const updatedUser = await pool.query('SELECT login_count, review_dismissed_login FROM users WHERE id = $1', [user.id]);
    const { login_count, review_dismissed_login } = updatedUser.rows[0];

    // showReviewCard: true if never dismissed OR 5+ logins since dismissal
    const showReviewCard = review_dismissed_login === null || (login_count - review_dismissed_login) >= 5;

    // Check for unseen payout announcement
    const announcementResult = await pool.query(
      `SELECT pa.id, cr.amount, cr.full_name as referred_name
       FROM payout_announcements pa
       JOIN cashout_requests cr ON cr.id = pa.cashout_request_id
       WHERE pa.user_id = $1 AND pa.seen_at IS NULL
       LIMIT 1`,
      [user.id]
    );
    const announcement = announcementResult.rows.length > 0
      ? { id: announcementResult.rows[0].id, amount: announcementResult.rows[0].amount, referredName: announcementResult.rows[0].referred_name }
      : null;

    // Fetch announcement settings for popup rendering
    const settingsResult = await pool.query('SELECT * FROM announcement_settings WHERE id = 1');
    const announcementSettings = settingsResult.rows[0] || { enabled: true, mode: 'preset_1', custom_message: null };

    res.json({ success: true, fullName: user.full_name, email: user.email, token, showReviewCard, announcement, announcementSettings });
  } catch (err) { res.status(500).json({ error: 'Login failed: ' + err.message }); }
```

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "feat: enrich login response with showReviewCard, announcement, announcementSettings"
```

---

## Task 3: Backend — POST /api/review/dismiss and POST /api/announcement/seen

**Files:**
- Modify: `server.js` — add two new endpoints after the reset-pin endpoint (around line 437)

- [ ] **Step 1: Add both endpoints**

Find the line:
```js
// ── ADMIN: AUTH ───────────────────────────────────────────────────────────────
```

Insert immediately before it:

```js
// ── REFERRER: DISMISS REVIEW CARD ─────────────────────────────────────────────
app.post('/api/review/dismiss', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;
    await pool.query(
      'UPDATE users SET review_dismissed_login = login_count WHERE id = $1',
      [userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── REFERRER: MARK ANNOUNCEMENT SEEN ──────────────────────────────────────────
app.post('/api/announcement/seen', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;
    const { announcementId } = req.body;
    await pool.query(
      'UPDATE payout_announcements SET seen_at = NOW() WHERE id = $1 AND user_id = $2',
      [announcementId, userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

```

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "feat: add POST /api/review/dismiss and POST /api/announcement/seen endpoints"
```

---

## Task 4: Backend — cashout approval inserts announcement + admin settings endpoints

**Files:**
- Modify: `server.js` — `PATCH /api/admin/cashouts/:id` and add two admin endpoints

- [ ] **Step 1: Update cashout approval to insert payout_announcement**

Find the cashout PATCH handler. Currently:
```js
    const result = await pool.query('UPDATE cashout_requests SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('admin',$1,$2,$3)`,
      [result.rows[0].full_name, result.rows[0].email,
       `Cash out request #${req.params.id} ${status} ($${result.rows[0].amount})`]
    );
    res.json(result.rows[0]);
```

Replace with:
```js
    const result = await pool.query('UPDATE cashout_requests SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await pool.query(
      `INSERT INTO activity_log (event_type,full_name,email,detail) VALUES ('admin',$1,$2,$3)`,
      [result.rows[0].full_name, result.rows[0].email,
       `Cash out request #${req.params.id} ${status} ($${result.rows[0].amount})`]
    );
    if (status === 'approved') {
      await pool.query(
        `INSERT INTO payout_announcements (cashout_request_id, user_id)
         SELECT $1, user_id FROM cashout_requests WHERE id = $1`,
        [req.params.id]
      );
    }
    res.json(result.rows[0]);
```

- [ ] **Step 2: Add admin announcement-settings endpoints**

Find the line:
```js
// ─────────────────────────────────────────────────────────────────────────────
app.listen(4000, () => console.log('Server running on port 4000'));
```

Insert before it:

```js
// ── ADMIN: ANNOUNCEMENT SETTINGS ──────────────────────────────────────────────
app.get('/api/admin/announcement-settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query('SELECT * FROM announcement_settings WHERE id = 1');
    res.json(result.rows[0] || { id: 1, enabled: true, mode: 'preset_1', custom_message: null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/announcement-settings', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { enabled, mode, customMessage } = req.body;
  try {
    await pool.query(
      `INSERT INTO announcement_settings (id, enabled, mode, custom_message, updated_at)
       VALUES (1, $1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET enabled=$1, mode=$2, custom_message=$3, updated_at=NOW()`,
      [enabled, mode, customMessage || null]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: auto-create payout announcement on cashout approval, add admin announcement-settings endpoints"
```

---

## Task 5: Frontend — thread login data through LoginScreen → App state

**Files:**
- Modify: `src/App.js` — `LoginScreen.handleLogin` (line ~429), `App.handleLogin` (line ~2848), `App` state declarations (line ~2810)

- [ ] **Step 1: Update LoginScreen.handleLogin to pass showReviewCard + announcement**

Find inside `LoginScreen` (around line 439):
```js
        if (data.error) {
          setError(data.error);
        } else {
          onLogin(data.fullName, data.email, data.token);
        }
```

Replace with:
```js
        if (data.error) {
          setError(data.error);
        } else {
          onLogin(data.fullName, data.email, data.token, data.showReviewCard ?? true, data.announcement ?? null, data.announcementSettings ?? null);
        }
```

- [ ] **Step 2: Add new state variables to App component**

Find in the App component (around line 2810):
```js
  const [profilePhoto, setProfilePhoto] = useState(null);
```

Add after it:
```js
  const [showReviewCard, setShowReviewCard] = useState(true);
  const [announcement, setAnnouncement] = useState(null);
  const [announcementSettings, setAnnouncementSettings] = useState(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementShown, setAnnouncementShown] = useState(false);
```

- [ ] **Step 3: Update App.handleLogin to accept and store new data**

Find:
```js
  function handleLogin(name, email, token) {
    setUserName(name);
    setUserEmail(email);
    sessionStorage.setItem("rb_token", token);
    setLoggedIn(true);
  }
```

Replace with:
```js
  function handleLogin(name, email, token, reviewCard, announcementData, settingsData) {
    setUserName(name);
    setUserEmail(email);
    sessionStorage.setItem("rb_token", token);
    setShowReviewCard(reviewCard ?? true);
    setAnnouncement(announcementData ?? null);
    setAnnouncementSettings(settingsData ?? null);
    setAnnouncementShown(false);
    setLoggedIn(true);
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: thread showReviewCard and announcement through login response to App state"
```

---

## Task 6: Frontend — Google Review card dismiss button

**Files:**
- Modify: `src/App.js` — `Dashboard` function signature and Google Review Banner section (lines ~891, ~1196)

- [ ] **Step 1: Add showReviewCard and onDismissReview to Dashboard props**

Find:
```js
function Dashboard({ setTab, pipeline, loading, userName, balance, paidCount, profilePhoto }) {
```

Replace with:
```js
function Dashboard({ setTab, pipeline, loading, userName, balance, paidCount, profilePhoto, showReviewCard, onDismissReview }) {
```

- [ ] **Step 2: Replace the Google Review Banner block**

Find the entire Google Review Banner block (lines ~1196–1253):
```js
      {/* Google Review Banner */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={600} screenKey="dashboard">
          <div style={{
            background: "#1a3a6b",
            border: "1px solid #041D3E",
            outline: "2px solid #ffffff",
            outlineOffset: "-4px",
            borderRadius: 16,
            padding: "18px 20px",
            boxShadow: R.shadow,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}>
            <i className="ph ph-star-fill" aria-hidden="true" style={{
              fontSize: 32,
              color: "#ffffff",
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <p style={{
                margin: "0 0 10px",
                fontSize: 15,
                color: "#D3E3F0",
                fontFamily: R.fontBody,
                lineHeight: 1.4,
              }}>
                {CONTRACTOR_CONFIG.reviewMessage}
              </p>
              <button
                onClick={() => window.open(CONTRACTOR_CONFIG.reviewUrl, '_blank', 'noopener,noreferrer')}
                style={{
                  background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 16px",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: R.fontBody,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 4px 14px rgba(204,0,0,0.3)",
                  transition: "transform 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <i className="ph ph-star" aria-hidden="true" style={{ fontSize: 15 }} />
                {CONTRACTOR_CONFIG.reviewButtonText}
              </button>
            </div>
          </div>
        </AnimCard>
      </div>
```

Replace with:
```js
      {/* Google Review Banner */}
      {showReviewCard && (
        <div style={{ padding: "16px 20px 0" }}>
          <AnimCard delay={600} screenKey="dashboard">
            <div style={{
              background: "#1a3a6b",
              border: "1px solid #041D3E",
              outline: "2px solid #ffffff",
              outlineOffset: "-4px",
              borderRadius: 16,
              padding: "18px 20px",
              boxShadow: R.shadow,
              display: "flex",
              alignItems: "center",
              gap: 16,
              position: "relative",
            }}>
              {/* Dismiss X */}
              <button
                onClick={onDismissReview}
                aria-label="Dismiss"
                style={{
                  position: "absolute", top: 10, right: 10,
                  background: "rgba(255,255,255,0.12)", border: "none",
                  borderRadius: "50%", width: 26, height: 26,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", padding: 0,
                }}
              >
                <i className="ph ph-x" style={{ fontSize: 14, color: "#fff" }} />
              </button>
              <i className="ph ph-star-fill" aria-hidden="true" style={{
                fontSize: 32,
                color: "#ffffff",
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <p style={{
                  margin: "0 0 10px",
                  fontSize: 15,
                  color: "#D3E3F0",
                  fontFamily: R.fontBody,
                  lineHeight: 1.4,
                }}>
                  {CONTRACTOR_CONFIG.reviewMessage}
                </p>
                <button
                  onClick={() => window.open(CONTRACTOR_CONFIG.reviewUrl, '_blank', 'noopener,noreferrer')}
                  style={{
                    background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 16px",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: R.fontBody,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 4px 14px rgba(204,0,0,0.3)",
                    transition: "transform 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <i className="ph ph-star" aria-hidden="true" style={{ fontSize: 15 }} />
                  {CONTRACTOR_CONFIG.reviewButtonText}
                </button>
              </div>
            </div>
          </AnimCard>
        </div>
      )}
```

- [ ] **Step 3: Wire dismiss handler in App — add onDismissReview callback and pass props to Dashboard**

In `App`, find:
```js
  function handleLogin(name, email, token, reviewCard, announcementData, settingsData) {
```

After the `handleLogin` function (before the `if (isAdmin)` line), add:

```js
  function handleDismissReview() {
    setShowReviewCard(false);
    fetch(`${BACKEND_URL}/api/review/dismiss`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem('rb_token')}` },
    }).catch(() => {}); // fire-and-forget
  }
```

- [ ] **Step 4: Pass new props to Dashboard in the screens map**

Find:
```js
    dashboard: <Dashboard setTab={setTab} pipeline={pipeline} loading={loading} userName={userName} balance={balance} paidCount={paidCount} profilePhoto={profilePhoto} />,
```

Replace with:
```js
    dashboard: <Dashboard setTab={setTab} pipeline={pipeline} loading={loading} userName={userName} balance={balance} paidCount={paidCount} profilePhoto={profilePhoto} showReviewCard={showReviewCard} onDismissReview={handleDismissReview} />,
```

- [ ] **Step 5: Commit**

```bash
git add src/App.js
git commit -m "feat: add dismiss X button to Google Review card, wire dismiss API call"
```

---

## Task 7: Frontend — AnnouncementPopup component

**Files:**
- Modify: `src/App.js` — add new component before `// ─── Admin Panel ─────`

- [ ] **Step 1: Add AnnouncementPopup component**

Find the line:
```js
// ─── Admin Panel ──────────────────────────────────────────────────────────────
```

Insert immediately before it:

```js
// ─── Announcement Popup ───────────────────────────────────────────────────────
const PRESET_MESSAGES = {
  preset_1: "Great news — your $[Amount] payout for referring [Referred Name] has been approved and is on its way! We appreciate you so much.",
  preset_2: "Your cashout request of $[Amount] for referring [Referred Name] has been approved. Thank you for being part of the Accent Roofing family.",
};

function resolveMessage(settings, referrerFirstName, amount, referredName) {
  let template = '';
  if (settings.mode === 'custom' && settings.custom_message) {
    template = `Hey ${referrerFirstName}, ${settings.custom_message}`;
  } else {
    template = PRESET_MESSAGES[settings.mode] || PRESET_MESSAGES.preset_1;
  }
  return template
    .replace(/\[First Name\]/g, referrerFirstName)
    .replace(/\[Amount\]/g, `$${parseFloat(amount).toLocaleString()}`)
    .replace(/\[Referred Name\]/g, referredName);
}

function AnnouncementPopup({ announcement, referrerFirstName, onDismiss, settings }) {
  const [cardVisible, setCardVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCardVisible(true), 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!announcement || !settings) return null;

  const message = resolveMessage(settings, referrerFirstName, announcement.amount, announcement.referredName);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(1,40,84,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "#FFFFFF", borderRadius: 24,
        padding: "36px 28px", width: "100%", maxWidth: 360,
        boxShadow: "0 12px 48px rgba(1,40,84,0.3)",
        textAlign: "center",
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 400ms ease-out, transform 400ms ease-out",
      }}>
        {/* Logo lockup */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, marginBottom: 24,
        }}>
          <img src={accentRoofingLogo} alt="Accent Roofing Service"
            style={{ height: 36, width: "auto", objectFit: "contain" }} />
          <div style={{ width: 1, height: 28, background: "rgba(0,0,0,0.1)" }} />
          <img src={rbLogoIcon} alt="Rooster Booster"
            style={{ height: 28, width: "auto", objectFit: "contain" }} />
        </div>

        {/* Message */}
        <p style={{
          margin: "0 0 20px", fontSize: 16, lineHeight: 1.6,
          color: R.textPrimary, fontFamily: R.fontBody,
        }}>
          {message}
        </p>

        {/* Amount display */}
        <div style={{ marginBottom: 20 }}>
          <span style={{
            fontSize: 48, fontWeight: 900, color: R.navy,
            fontFamily: R.fontMono, letterSpacing: "-0.02em",
          }}>
            ${parseFloat(announcement.amount).toLocaleString()}
          </span>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: R.textSecondary }}>
            for referring {announcement.referredName}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onDismiss}
          style={{
            width: "100%", marginBottom: 12,
            background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
            border: "none", borderRadius: 12, padding: "14px 24px",
            color: "#fff", fontSize: 15, fontWeight: 700,
            fontFamily: R.fontSans, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(204,0,0,0.35)",
            transition: "transform 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          <i className="ph ph-users" style={{ fontSize: 16, marginRight: 8 }} />
          Refer Another Friend
        </button>

        {/* Secondary dismiss */}
        <button
          onClick={onDismiss}
          style={{
            background: "none", border: "none", padding: "8px",
            color: R.textMuted, fontSize: 14, cursor: "pointer",
            fontFamily: R.fontBody,
          }}
        >
          I'll check it out later
        </button>
      </div>
    </div>
  );
}

```

- [ ] **Step 2: Commit**

```bash
git add src/App.js
git commit -m "feat: add AnnouncementPopup component with entrance animation, logo lockup, token replacement"
```

---

## Task 8: Frontend — announcement trigger logic + render in App

**Files:**
- Modify: `src/App.js` — `App` component

- [ ] **Step 1: Add useEffect to trigger popup on dashboard mount**

In `App`, find the existing useEffect (line ~2825):
```js
  useEffect(() => {
    if (loggedIn && userName) {
```

Add a new useEffect AFTER it (before `function handleLogin`):

```js
  useEffect(() => {
    if (tab === 'dashboard' && announcement && !announcementShown) {
      const t = setTimeout(() => {
        setShowAnnouncement(true);
        setAnnouncementShown(true);
      }, 900);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, announcement]);
```

- [ ] **Step 2: Add handleDismissAnnouncement callback**

Add this function right after `handleDismissReview`:

```js
  function handleDismissAnnouncement() {
    if (announcement) {
      fetch(`${BACKEND_URL}/api/announcement/seen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('rb_token')}`,
        },
        body: JSON.stringify({ announcementId: announcement.id }),
      }).catch(() => {});
    }
    setShowAnnouncement(false);
    setAnnouncement(null);
  }
```

- [ ] **Step 3: Render AnnouncementPopup in App's return**

Find:
```js
  return (
    <div style={{ background: R.bgPage, minHeight: "100vh" }}>
      {screens[tab]}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
```

Replace with:
```js
  return (
    <div style={{ background: R.bgPage, minHeight: "100vh" }}>
      {screens[tab]}
      <BottomNav tab={tab} setTab={setTab} />
      {showAnnouncement && announcement && announcementSettings && (
        <AnnouncementPopup
          announcement={announcement}
          referrerFirstName={userName.split(' ')[0]}
          onDismiss={handleDismissAnnouncement}
          settings={announcementSettings}
        />
      )}
    </div>
  );
```

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: add announcement trigger logic and render AnnouncementPopup on dashboard mount"
```

---

## Task 9: Frontend — Admin Announcement Settings page

**Files:**
- Modify: `src/App.js` — add `AdminAnnouncementSettings` component; update `ADMIN_NAV`, `AdminPanel.pages`, `AdminPanel`

- [ ] **Step 1: Add AdminAnnouncementSettings component**

Find the line:
```js
function AdminLogin({ onLogin }) {
```

Insert immediately before it:

```js
const PREVIEW_NAMES = ['Paige Turner', 'Grant Gable', 'Nail Armstrong', 'Victor Valley', 'Pete Pitch', 'Ridgeard Runner', 'Flash Feltman', 'Tarence Tack', 'Roger Ringshank', 'Galvan Ized'];

function AdminAnnouncementSettings({ setLoggedIn }) {
  const adminToken = () => sessionStorage.getItem('rb_admin_token');
  const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };

  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState('preset_1');
  const [customMessage, setCustomMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saved' | 'error'
  const [previewNameIdx, setPreviewNameIdx] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin/announcement-settings`, {
      headers: { 'Authorization': `Bearer ${adminToken()}` },
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => {
        if (!d) return;
        setEnabled(d.enabled ?? true);
        setMode(d.mode || 'preset_1');
        setCustomMessage(d.custom_message || '');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSave() {
    setSaving(true); setSaveStatus('');
    fetch(`${BACKEND_URL}/api/admin/announcement-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify({ enabled, mode, customMessage }),
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => {
        setSaving(false);
        if (!d) return;
        setSaveStatus(d.success ? 'saved' : 'error');
        setTimeout(() => setSaveStatus(''), 3000);
      })
      .catch(() => { setSaving(false); setSaveStatus('error'); });
  }

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    fetch(`${BACKEND_URL}/api/admin/announcement-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify({ enabled: next, mode, customMessage }),
    }).catch(() => {});
  }

  const previewSettings = { enabled, mode, custom_message: customMessage };
  const previewName = PREVIEW_NAMES[previewNameIdx];
  const previewAnnouncement = { id: 0, amount: 500, referredName: 'Sample Client' };

  const modeOptions = [
    { value: 'preset_1', label: 'Preset 1 — Warm', preview: PRESET_MESSAGES.preset_1 },
    { value: 'preset_2', label: 'Preset 2 — Professional', preview: PRESET_MESSAGES.preset_2 },
    { value: 'custom',   label: 'Custom',                  preview: '' },
  ];

  return (
    <>
      <AdminPageHeader title="Announcement Settings" subtitle="Payout approval popup" />

      {/* Enable / Disable toggle */}
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 20, boxShadow: AD.shadowSm, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Enable payout popup</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: AD.textSecondary }}>When enabled, referrers see a celebration popup on next login after cashout approval.</p>
        </div>
        <button
          onClick={handleToggle}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none',
            background: enabled ? '#2D8B5F' : AD.bgCardTint,
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: enabled ? 22 : 2,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </button>
      </div>

      {/* Message mode selector */}
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 20, boxShadow: AD.shadowSm }}>
        <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Message style</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {modeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              style={{
                background: mode === opt.value ? AD.bgCardTint : 'transparent',
                border: `1.5px solid ${mode === opt.value ? AD.blueLight : AD.border}`,
                borderRadius: 12, padding: '14px 16px', textAlign: 'left',
                cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
                fontFamily: AD.fontSans,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: opt.value !== 'custom' ? 6 : 0 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${mode === opt.value ? AD.blueLight : AD.borderStrong}`,
                  background: mode === opt.value ? AD.blueLight : 'transparent',
                }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: AD.textPrimary }}>{opt.label}</span>
              </div>
              {opt.preview && (
                <p style={{ margin: '0 0 0 24px', fontSize: 12, color: AD.textSecondary, lineHeight: 1.5 }}>{opt.preview}</p>
              )}
            </button>
          ))}
        </div>

        {/* Custom message textarea */}
        {mode === 'custom' && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: AD.textSecondary }}>
              <span style={{ fontWeight: 600, color: AD.textPrimary }}>Hey [First Name],</span> &nbsp;
              <span style={{ color: AD.textTertiary }}>(locked opener)</span>
            </p>
            <textarea
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              placeholder="your payout has been approved and is heading your way!"
              rows={4}
              style={{
                width: '100%', padding: '10px 12px',
                background: AD.bgSurface, border: `1px solid ${AD.borderStrong}`,
                borderRadius: 10, fontFamily: AD.fontSans, fontSize: 14,
                color: AD.textPrimary, outline: 'none', resize: 'vertical',
                boxSizing: 'border-box', lineHeight: 1.5,
              }}
              onFocus={e => e.target.style.borderColor = AD.blueLight}
              onBlur={e => e.target.style.borderColor = AD.borderStrong}
            />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: AD.textTertiary }}>
              Tokens: [First Name], [Amount], [Referred Name]
            </p>
          </div>
        )}
      </div>

      {/* Preview */}
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 20, boxShadow: AD.shadowSm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>Live preview</p>
          <Btn
            onClick={() => {
              setPreviewNameIdx(i => (i + 1) % PREVIEW_NAMES.length);
              setShowPreview(true);
            }}
            variant="outline" size="sm"
          >
            <i className="ph ph-eye" /> Preview
          </Btn>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, lineHeight: 1.6 }}>
          {resolveMessage(previewSettings, previewName.split(' ')[0], 500, 'Sample Client')}
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: AD.textTertiary }}>Preview name: {previewName} · Amount: $500</p>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn onClick={handleSave} variant="accent" size="lg">
          {saving ? <><i className="ph ph-circle-notch" style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</> : <><i className="ph ph-floppy-disk" /> Save Settings</>}
        </Btn>
        {saveStatus === 'saved' && <span style={{ fontSize: 13, color: AD.greenText }}><i className="ph ph-check" /> Saved</span>}
        {saveStatus === 'error' && <span style={{ fontSize: 13, color: AD.red2Text }}>Save failed</span>}
      </div>

      {/* Full-screen preview overlay */}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
            onClick={() => setShowPreview(false)}
          />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ pointerEvents: 'auto' }}>
              <AnnouncementPopup
                announcement={previewAnnouncement}
                referrerFirstName={previewName.split(' ')[0]}
                onDismiss={() => setShowPreview(false)}
                settings={previewSettings}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

```

- [ ] **Step 2: Add 'settings' to ADMIN_NAV**

Find:
```js
const ADMIN_NAV = [
  { id: 'dashboard', icon: 'ph-squares-four',    label: 'Dashboard'  },
  { id: 'referrers', icon: 'ph-users',            label: 'Referrers'  },
  { id: 'cashouts',  icon: 'ph-money',            label: 'Cash Outs'  },
  { id: 'activity',  icon: 'ph-clock-clockwise',  label: 'Activity'   },
];
```

Replace with:
```js
const ADMIN_NAV = [
  { id: 'dashboard', icon: 'ph-squares-four',    label: 'Dashboard'    },
  { id: 'referrers', icon: 'ph-users',            label: 'Referrers'    },
  { id: 'cashouts',  icon: 'ph-money',            label: 'Cash Outs'    },
  { id: 'activity',  icon: 'ph-clock-clockwise',  label: 'Activity'     },
  { id: 'settings',  icon: 'ph-megaphone',        label: 'Announcements'},
];
```

- [ ] **Step 3: Add settings page to AdminPanel**

Find inside `AdminPanel`:
```js
  const pages = {
    dashboard: <AdminDashboard setLoggedIn={setAuthed} setPage={setPage} />,
    referrers: <AdminReferrers setLoggedIn={setAuthed} />,
    cashouts:  <AdminCashOuts  setLoggedIn={setAuthed} />,
    activity:  <AdminActivity  setLoggedIn={setAuthed} />,
  };
```

Replace with:
```js
  const pages = {
    dashboard: <AdminDashboard setLoggedIn={setAuthed} setPage={setPage} />,
    referrers: <AdminReferrers setLoggedIn={setAuthed} />,
    cashouts:  <AdminCashOuts  setLoggedIn={setAuthed} />,
    activity:  <AdminActivity  setLoggedIn={setAuthed} />,
    settings:  <AdminAnnouncementSettings setLoggedIn={setAuthed} />,
  };
```

- [ ] **Step 4: Commit**

```bash
git add src/App.js
git commit -m "feat: add AdminAnnouncementSettings page with toggle, mode selector, live preview, save"
```

---

## Task 10: Deploy

- [ ] **Step 1: Final deploy**

```bash
git push
```

Wait 30 seconds, then test on live Vercel/Railway:
1. Log in as a referrer → confirm `showReviewCard` shows the review card; X button dismisses it
2. From admin, approve a cashout → confirm `payout_announcements` row is created
3. Log in as that referrer → confirm popup appears after ~900ms on dashboard tab
4. Dismiss popup → confirm it doesn't reappear
5. Admin panel → Announcements sidebar link → toggle, change mode, preview, save
6. Log in again (count < review_dismissed_login + 5) → review card should stay hidden

---

## Self-Review Checklist

**Spec coverage:**

| Spec item | Task |
|-----------|------|
| 1a. ALTER TABLE users login_count, review_dismissed_login | Task 1 |
| 1b. CREATE TABLE payout_announcements | Task 1 |
| 1c. CREATE TABLE announcement_settings, INSERT default row | Task 1 |
| 2a. Login: increment login_count, check announcement, showReviewCard | Task 2 |
| 2b. POST /api/review/dismiss | Task 3 |
| 2c. POST /api/announcement/seen | Task 3 |
| 2d. Cashout approval inserts payout_announcement | Task 4 |
| 2e. GET /api/admin/announcement-settings | Task 4 |
| 2f. POST /api/admin/announcement-settings | Task 4 |
| 3a. Google Review card X dismiss button | Task 6 |
| 3b. AnnouncementPopup component | Task 7 |
| 3c. Announcement trigger (900ms delay, dismiss API call) | Task 8 |
| 3d. Admin Announcement Settings card (toggle, mode, preview, save) | Task 9 |
| 4. Commit & deploy | Task 10 |

**Type consistency:**
- `resolveMessage(settings, referrerFirstName, amount, referredName)` — used in `AnnouncementPopup` (Task 7) and `AdminAnnouncementSettings` preview (Task 9) ✓
- `announcement` shape: `{ id, amount, referredName }` — set in Task 5, consumed in Task 7, Task 8 ✓
- `announcementSettings` shape: `{ enabled, mode, custom_message }` — server returns `custom_message` (snake_case), admin component sends `customMessage` (camelCase) → confirmed server upsert maps correctly ✓
- `PRESET_MESSAGES` object defined before both components that use it ✓

**ESLint:** All useEffect hooks that intentionally omit dependencies have `// eslint-disable-next-line react-hooks/exhaustive-deps` ✓

**Placeholder scan:** No TBD/TODO found. All code blocks are complete.
