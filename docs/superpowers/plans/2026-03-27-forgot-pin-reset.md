# Forgot PIN / Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow referrers who forget their PIN to request a reset link via email, then set a new PIN through a dedicated screen.

**Architecture:** Two new server endpoints (`POST /api/forgot-pin`, `POST /api/reset-pin`) backed by a new `pin_reset_tokens` table. The frontend adds a "Forgot PIN?" sub-form inside `LoginScreen` and a standalone `ResetPinScreen` component that activates via `?reset=<token>` URL param — the same detection pattern used by `?admin=true`.

**Tech Stack:** Node.js/Express, PostgreSQL (`pg` Pool), `crypto` (built-in), `bcrypt`, `express-rate-limit`, Resend API, React (inline, no router)

---

## File Map

| File | Change |
|------|--------|
| `server.js` | Add `pin_reset_tokens` table to `initDB`; add `forgotPinLimiter`; add `POST /api/forgot-pin`; add `POST /api/reset-pin` |
| `src/App.js` | Add `ResetPinScreen` component (after line 581); add `showForgotPin` state + sub-form to `LoginScreen`; add `?reset=` detection in root `App` |

---

### Task 1: Add `pin_reset_tokens` table to `initDB`

**Files:**
- Modify: `server.js:70` (after `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`)

- [ ] **Step 1: Add the table creation to `initDB`**

In `server.js`, after line 70 (`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`), add:

```js
  await pool.query(`CREATE TABLE IF NOT EXISTS pin_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP
  )`);
```

- [ ] **Step 2: Verify the server starts without errors**

Run: `node server.js`
Expected: Server starts, `initDB` runs, no errors about `pin_reset_tokens`. Kill with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add pin_reset_tokens table to initDB"
```

---

### Task 2: Add `forgotPinLimiter` rate limiter

**Files:**
- Modify: `server.js:21` (after `adminLoginLimiter` block, before `const app = express()`)

- [ ] **Step 1: Add the rate limiter**

In `server.js`, after line 21 (the closing `});` of `adminLoginLimiter`), add:

```js

const forgotPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many reset requests. Please try again in 15 minutes.' }
});
```

- [ ] **Step 2: Verify the server still starts**

Run: `node server.js`
Expected: No errors. Kill with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add forgotPinLimiter rate limiter"
```

---

### Task 3: Add `POST /api/forgot-pin` endpoint

**Files:**
- Modify: `server.js:283` (after the `POST /api/profile/photo` handler, before `// ── ADMIN: AUTH`)

- [ ] **Step 1: Add the endpoint**

In `server.js`, after line 283 (closing `});` of `POST /api/profile/photo`), add:

```js

// ── REFERRER: FORGOT PIN ───────────────────────────────────────────────────────
const crypto = require('crypto');

app.post('/api/forgot-pin', forgotPinLimiter, async (req, res) => {
  const { email } = req.body;
  const genericResponse = { message: "If that email is registered, you'll receive a reset link shortly." };

  try {
    const userResult = await pool.query(
      'SELECT id, full_name, email FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const token = crypto.randomBytes(32).toString('hex');

      await pool.query(
        `INSERT INTO pin_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + interval '1 hour')`,
        [user.id, token]
      );

      const resetUrl = `${process.env.FRONTEND_URL}/?reset=${token}`;

      try {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: user.email,
          subject: 'Reset your Rooster Booster PIN',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <p style="font-size: 20px; font-weight: 700; color: #012854; margin: 0 0 8px;">Accent Roofing Service</p>
              <h1 style="font-size: 24px; color: #012854; margin: 0 0 16px;">Reset your PIN</h1>
              <p style="font-size: 15px; color: #444; margin: 0 0 24px;">
                Someone requested a PIN reset for your Rooster Booster referral account.
                Click the button below to set a new PIN. This link expires in 1 hour.
              </p>
              <a href="${resetUrl}" style="
                display: inline-block;
                background: #CC0000;
                color: #fff;
                text-decoration: none;
                padding: 14px 28px;
                border-radius: 8px;
                font-weight: 700;
                font-size: 15px;
                margin-bottom: 24px;
              ">Set New PIN</a>
              <p style="font-size: 13px; color: #888; margin: 0;">
                If you didn't request this, you can safely ignore this email. Your PIN has not been changed.
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Resend error (forgot-pin):', emailErr);
        // swallow — do not reveal whether email exists
      }

      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ($1, $2, $3, $4)`,
        ['pin_reset_request', user.full_name, user.email, 'Reset link sent']
      );
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('forgot-pin error:', err);
    res.json(genericResponse); // always return generic even on DB error
  }
});
```

- [ ] **Step 2: Verify the server starts**

Run: `node server.js`
Expected: No errors. Kill with Ctrl+C.

- [ ] **Step 3: Manual smoke test**

With the server running, send a request with a non-existent email:
```bash
curl -s -X POST http://localhost:4000/api/forgot-pin \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com"}' | cat
```
Expected: `{"message":"If that email is registered, you'll receive a reset link shortly."}`

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: add POST /api/forgot-pin endpoint"
```

---

### Task 4: Add `POST /api/reset-pin` endpoint

**Files:**
- Modify: `server.js` (after the `POST /api/forgot-pin` handler)

- [ ] **Step 1: Add the endpoint**

In `server.js`, directly after the closing `});` of `POST /api/forgot-pin`, add:

```js

// ── REFERRER: RESET PIN ────────────────────────────────────────────────────────
app.post('/api/reset-pin', async (req, res) => {
  const { token, pin } = req.body;

  if (!/^\d{4}$/.test(String(pin))) {
    return res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
  }

  try {
    const tokenResult = await pool.query(
      `SELECT prt.id, prt.user_id, u.full_name, u.email
       FROM pin_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1 AND prt.used_at IS NULL AND prt.expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const { user_id, full_name, email } = tokenResult.rows[0];
    const hashedPin = await bcrypt.hash(String(pin), 10);

    await pool.query('UPDATE users SET pin=$1 WHERE id=$2', [hashedPin, user_id]);
    await pool.query('UPDATE pin_reset_tokens SET used_at=NOW() WHERE token=$1', [token]);
    await pool.query(
      `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ($1, $2, $3, $4)`,
      ['pin_reset', full_name, email, 'PIN reset via email link']
    );

    res.json({ success: true });
  } catch (err) {
    console.error('reset-pin error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});
```

- [ ] **Step 2: Verify the server starts**

Run: `node server.js`
Expected: No errors. Kill with Ctrl+C.

- [ ] **Step 3: Manual smoke test — invalid token**

```bash
curl -s -X POST http://localhost:4000/api/reset-pin \
  -H "Content-Type: application/json" \
  -d '{"token":"fakefakefake","pin":"1234"}' | cat
```
Expected: `{"error":"Reset link is invalid or has expired."}`

- [ ] **Step 4: Manual smoke test — invalid PIN**

```bash
curl -s -X POST http://localhost:4000/api/reset-pin \
  -H "Content-Type: application/json" \
  -d '{"token":"fakefakefake","pin":"abc"}' | cat
```
Expected: `{"error":"PIN must be exactly 4 digits."}`

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: add POST /api/reset-pin endpoint"
```

---

### Task 5: Add `ResetPinScreen` component to `src/App.js`

**Files:**
- Modify: `src/App.js:581` (after closing `}` of `LoginScreen`, before `// ─── Dashboard`)

- [ ] **Step 1: Add the component**

In `src/App.js`, after line 581 (the closing `}` of `LoginScreen`) and before line 583 (`// ─── Dashboard`), insert:

```jsx
// ─── Reset PIN Screen ─────────────────────────────────────────────────────────
function ResetPinScreen({ token }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState("");
  const cardVisible = useEntrance(80);

  function handleSubmit() {
    setError("");
    if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(confirmPin)) {
      setError("Both fields must be exactly 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs don't match.");
      return;
    }
    setStatus("loading");
    fetch(`${BACKEND_URL}/api/reset-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, pin }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus("success");
          setTimeout(() => {
            window.history.replaceState({}, '', '/');
            window.location.reload();
          }, 1500);
        } else {
          setError(data.error || "Something went wrong.");
          setStatus("idle");
        }
      })
      .catch(() => {
        setError("Something went wrong. Please try again.");
        setStatus("idle");
      });
  }

  const inputStyle = (focused) => ({
    width: "100%", background: R.bgPage,
    border: `1.5px solid ${focused ? R.navy : R.border}`,
    borderRadius: 10, padding: "16px 16px 16px 48px",
    color: R.textPrimary, fontSize: 15,
    fontFamily: R.fontBody, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
  });

  const [pinFocused, setPinFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
      padding: "32px 24px", fontFamily: R.fontBody,
    }}>
      <div style={{
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? "translateY(0)" : "translateY(-12px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        textAlign: "center", marginBottom: 8,
      }}>
        <img src={rbLogoSquareWordmark} alt="Rooster Booster" style={{ width: 200, height: 'auto', margin: '0 auto', display: 'block', marginBottom: 8 }} />
      </div>

      <div style={{
        width: "100%", maxWidth: 380,
        background: R.bgCard, borderRadius: 20,
        padding: "32px 28px", boxShadow: R.shadowLg,
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s",
      }}>
        <img
          src={accentRoofingLogo}
          alt="Accent Roofing Service"
          style={{ width: 120, height: "auto", display: "block", margin: "0 auto 20px" }}
        />
        <h2 style={{
          margin: "0 0 8px", fontSize: 22, fontWeight: 700,
          fontFamily: R.fontSans, color: R.navy,
        }}>Set a new PIN</h2>
        <p style={{ margin: "0 0 24px", fontSize: 15, color: R.textSecondary }}>
          Choose a 4-digit PIN for your account.
        </p>

        {status === "success" ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#dcfce7", borderRadius: 10, padding: "16px",
            color: "#166534", fontSize: 15,
          }}>
            <i className="ph ph-check-circle" style={{ fontSize: 20, flexShrink: 0 }} />
            PIN updated! Redirecting to sign in…
          </div>
        ) : (
          <>
            {/* New PIN */}
            <label style={{
              display: "block", fontSize: 12, fontWeight: 500,
              color: R.textSecondary, marginBottom: 8,
            }}>New PIN</label>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <i className="ph ph-lock" style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 16, color: pinFocused ? R.navy : R.textMuted,
                transition: "color 0.2s", pointerEvents: "none",
              }} />
              <input
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onFocus={() => setPinFocused(true)} onBlur={() => setPinFocused(false)}
                type="password" placeholder="4-digit PIN" maxLength={4}
                style={inputStyle(pinFocused)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {/* Confirm PIN */}
            <label style={{
              display: "block", fontSize: 12, fontWeight: 500,
              color: R.textSecondary, marginBottom: 8,
            }}>Confirm PIN</label>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <i className="ph ph-lock" style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 16, color: confirmFocused ? R.navy : R.textMuted,
                transition: "color 0.2s", pointerEvents: "none",
              }} />
              <input
                value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onFocus={() => setConfirmFocused(true)} onBlur={() => setConfirmFocused(false)}
                type="password" placeholder="Confirm PIN" maxLength={4}
                style={inputStyle(confirmFocused)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#fee2e2", borderRadius: 8, padding: "8px 12px",
                marginBottom: 16, marginTop: 8,
              }}>
                <i className="ph ph-warning-circle" style={{ color: "#dc2626", fontSize: 16, flexShrink: 0 }} />
                <p style={{ color: "#dc2626", fontSize: 15, margin: 0 }}>{error}</p>
              </div>
            )}

            <button onClick={handleSubmit} disabled={status === "loading"} style={{
              width: "100%", marginTop: 16,
              background: status === "loading"
                ? R.redDark
                : `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
              border: "none", borderRadius: 10, padding: "16px",
              color: "#fff", fontSize: 15, fontWeight: 700,
              fontFamily: R.fontSans, cursor: status === "loading" ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "transform 0.2s, box-shadow 0.2s",
              transform: status === "loading" ? "scale(0.98)" : "scale(1)",
              boxShadow: status === "loading" ? "none" : "0 4px 14px rgba(204,0,0,0.35)",
            }}>
              {status === "loading"
                ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: "spin 0.8s linear infinite" }} /> Setting PIN…</>
                : <><i className="ph ph-check" style={{ fontSize: 16 }} /> Set PIN</>
              }
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

```

- [ ] **Step 2: Verify the app compiles**

Run: `npm start`
Expected: App compiles without errors. Kill with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add src/App.js
git commit -m "feat: add ResetPinScreen component"
```

---

### Task 6: Add `?reset=` detection in root `App`

**Files:**
- Modify: `src/App.js:2513` (after `const isAdmin = ...` line in root `App`)

- [ ] **Step 1: Add reset token detection**

In `src/App.js`, find this block in root `App` (around line 2513):

```js
  const isAdmin = window.location.search.includes("admin=true");

  useReferrerFonts();
```

Replace it with:

```js
  const isAdmin = window.location.search.includes("admin=true");
  const resetToken = new URLSearchParams(window.location.search).get('reset');

  useReferrerFonts();
```

Then find the two early-return checks (around line 2547-2548):

```js
  if (isAdmin) return <AdminPanel />;
  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;
```

Replace them with:

```js
  if (isAdmin) return <AdminPanel />;
  if (resetToken) return <ResetPinScreen token={resetToken} />;
  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;
```

- [ ] **Step 2: Manual test**

Start the app with `npm start` and navigate to `http://localhost:3000/?reset=abc123`.
Expected: `ResetPinScreen` renders with "Set a new PIN" heading. Navigate back to `/` — `LoginScreen` renders.

- [ ] **Step 3: Commit**

```bash
git add src/App.js
git commit -m "feat: detect ?reset= param and render ResetPinScreen"
```

---

### Task 7: Add "Forgot PIN?" sub-form to `LoginScreen`

**Files:**
- Modify: `src/App.js:396` (`LoginScreen` function)

- [ ] **Step 1: Add state and handler to `LoginScreen`**

In `src/App.js`, find the existing state declarations in `LoginScreen` (around line 396-403):

```js
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(null);
  const cardVisible = useEntrance(80);
  const [showContact, setShowContact] = useState(false);
```

Replace with:

```js
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(null);
  const cardVisible = useEntrance(80);
  const [showContact, setShowContact] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState("idle"); // idle | loading | sent | error
  const [forgotError, setForgotError] = useState("");

  function handleForgotPin() {
    if (!forgotEmail) return;
    setForgotStatus("loading");
    setForgotError("");
    fetch(`${BACKEND_URL}/api/forgot-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail }),
    })
      .then(res => res.json())
      .then(() => { setForgotStatus("sent"); })
      .catch(() => {
        setForgotError("Something went wrong. Please try again.");
        setForgotStatus("error");
      });
  }
```

- [ ] **Step 2: Replace the PIN field area with the conditional sub-form**

Find the PIN field block (around lines 500-520) and the error block (lines 522-531):

```jsx
        {/* PIN field */}
        <label style={{
          display: "block", fontSize: 12, fontWeight: 500,
          color: R.textSecondary, marginBottom: 8, fontFamily: R.fontBody,
        }}>
          PIN
        </label>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <i className="ph ph-lock" style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            fontSize: 16, color: focused === "pin" ? R.navy : R.textMuted,
            transition: "color 0.2s", pointerEvents: "none",
          }} />
          <input
            value={pass} onChange={e => setPass(e.target.value)}
            onFocus={() => setFocused("pin")} onBlur={() => setFocused(null)}
            type="password" placeholder="PIN"
            style={inputStyle("pin")}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
        </div>

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fee2e2", borderRadius: 8, padding: "8px 12px",
            marginBottom: 16, marginTop: 8,
          }}>
            <i className="ph ph-warning-circle" style={{ color: "#dc2626", fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: "#dc2626", fontSize: 15, margin: 0 }}>{error}</p>
          </div>
        )}
```

Replace with:

```jsx
        {showForgotPin ? (
          /* ── Forgot PIN sub-form ─────────────────────────────── */
          forgotStatus === "sent" ? (
            <div style={{
              background: "#eff6ff", borderRadius: 10, padding: "16px",
              marginBottom: 16, fontSize: 15, color: "#1d4ed8", lineHeight: 1.5,
            }}>
              Check your email — if that address is registered, a reset link is on its way.
            </div>
          ) : (
            <>
              <label style={{
                display: "block", fontSize: 12, fontWeight: 500,
                color: R.textSecondary, marginBottom: 8, fontFamily: R.fontBody,
              }}>
                Email address
              </label>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <i className="ph ph-envelope" style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  fontSize: 16, color: focused === "forgotEmail" ? R.navy : R.textMuted,
                  transition: "color 0.2s", pointerEvents: "none",
                }} />
                <input
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  onFocus={() => setFocused("forgotEmail")}
                  onBlur={() => setFocused(null)}
                  placeholder="Email address"
                  style={inputStyle("forgotEmail")}
                  onKeyDown={e => e.key === "Enter" && handleForgotPin()}
                />
              </div>
              {forgotStatus === "error" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "#fee2e2", borderRadius: 8, padding: "8px 12px",
                  marginBottom: 8, marginTop: 4,
                }}>
                  <i className="ph ph-warning-circle" style={{ color: "#dc2626", fontSize: 16, flexShrink: 0 }} />
                  <p style={{ color: "#dc2626", fontSize: 15, margin: 0 }}>{forgotError}</p>
                </div>
              )}
            </>
          )
        ) : (
          /* ── Normal PIN field ────────────────────────────────── */
          <>
            <label style={{
              display: "block", fontSize: 12, fontWeight: 500,
              color: R.textSecondary, marginBottom: 8, fontFamily: R.fontBody,
            }}>
              PIN
            </label>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <i className="ph ph-lock" style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 16, color: focused === "pin" ? R.navy : R.textMuted,
                transition: "color 0.2s", pointerEvents: "none",
              }} />
              <input
                value={pass} onChange={e => setPass(e.target.value)}
                onFocus={() => setFocused("pin")} onBlur={() => setFocused(null)}
                type="password" placeholder="PIN"
                style={inputStyle("pin")}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>
          </>
        )}

        {/* "Forgot PIN?" link — only shown in normal PIN mode */}
        {!showForgotPin && (
          <div style={{ textAlign: "right", marginBottom: 8 }}>
            <button
              onClick={() => { setShowForgotPin(true); setForgotEmail(email); }}
              style={{
                background: "none", border: "none", padding: 0, margin: 0,
                font: "inherit", cursor: "pointer",
                color: R.navy, fontWeight: 600, fontSize: 13,
              }}
            >
              Forgot PIN?
            </button>
          </div>
        )}

        {!showForgotPin && error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fee2e2", borderRadius: 8, padding: "8px 12px",
            marginBottom: 16, marginTop: 8,
          }}>
            <i className="ph ph-warning-circle" style={{ color: "#dc2626", fontSize: 16, flexShrink: 0 }} />
            <p style={{ color: "#dc2626", fontSize: 15, margin: 0 }}>{error}</p>
          </div>
        )}
```

- [ ] **Step 3: Replace the Sign In button with conditional buttons**

Find the Sign In button (around line 533):

```jsx
        <button onClick={handleLogin} style={{
          width: "100%", marginTop: 16,
          background: loading
            ? R.redDark
            : `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
          border: "none", borderRadius: 10, padding: "16px",
          color: "#fff", fontSize: 15, fontWeight: 700,
          fontFamily: R.fontSans, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "transform 0.2s, box-shadow 0.2s, background 0.2s",
          transform: loading ? "scale(0.98)" : "scale(1)",
          boxShadow: loading ? "none" : "0 4px 14px rgba(204,0,0,0.35)",
        }}>
          {loading
            ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: "spin 0.8s linear infinite" }} /> Signing in...</>
            : <><i className="ph ph-sign-in" style={{ fontSize: 16 }} /> Sign In</>
          }
        </button>
```

Replace with:

```jsx
        {showForgotPin ? (
          <>
            {forgotStatus !== "sent" && (
              <button onClick={handleForgotPin} disabled={forgotStatus === "loading"} style={{
                width: "100%", marginTop: 16,
                background: forgotStatus === "loading"
                  ? R.redDark
                  : `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
                border: "none", borderRadius: 10, padding: "16px",
                color: "#fff", fontSize: 15, fontWeight: 700,
                fontFamily: R.fontSans, cursor: forgotStatus === "loading" ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "transform 0.2s, box-shadow 0.2s",
                transform: forgotStatus === "loading" ? "scale(0.98)" : "scale(1)",
                boxShadow: forgotStatus === "loading" ? "none" : "0 4px 14px rgba(204,0,0,0.35)",
              }}>
                {forgotStatus === "loading"
                  ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: "spin 0.8s linear infinite" }} /> Sending…</>
                  : <><i className="ph ph-paper-plane-tilt" style={{ fontSize: 16 }} /> Send Reset Link</>
                }
              </button>
            )}
            <button
              onClick={() => { setShowForgotPin(false); setForgotStatus("idle"); setForgotError(""); }}
              style={{
                background: "none", border: "none", padding: "12px 0 0",
                width: "100%", textAlign: "center",
                font: "inherit", cursor: "pointer",
                color: R.navy, fontWeight: 600, fontSize: 14,
              }}
            >
              ← Back to sign in
            </button>
          </>
        ) : (
          <button onClick={handleLogin} style={{
            width: "100%", marginTop: 16,
            background: loading
              ? R.redDark
              : `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
            border: "none", borderRadius: 10, padding: "16px",
            color: "#fff", fontSize: 15, fontWeight: 700,
            fontFamily: R.fontSans, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "transform 0.2s, box-shadow 0.2s, background 0.2s",
            transform: loading ? "scale(0.98)" : "scale(1)",
            boxShadow: loading ? "none" : "0 4px 14px rgba(204,0,0,0.35)",
          }}>
            {loading
              ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: "spin 0.8s linear infinite" }} /> Signing in...</>
              : <><i className="ph ph-sign-in" style={{ fontSize: 16 }} /> Sign In</>
            }
          </button>
        )}
```

- [ ] **Step 4: Verify the app compiles and test the sub-form**

Run: `npm start`

Open `http://localhost:3000`:
- Login screen renders normally
- "Forgot PIN?" link appears below PIN field
- Clicking it switches to the email sub-form
- "← Back to sign in" returns to the PIN field
- Submitting any email shows the "Check your email" confirmation
- "← Back to sign in" resets back to login form

- [ ] **Step 5: Commit**

```bash
git add src/App.js
git commit -m "feat: add Forgot PIN sub-form to LoginScreen"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|------------------|------|
| `pin_reset_tokens` table | Task 1 |
| `forgotPinLimiter` 3 req/15min | Task 2 |
| `POST /api/forgot-pin` — generic response always | Task 3 |
| `POST /api/forgot-pin` — Resend email with branded HTML | Task 3 |
| `POST /api/forgot-pin` — activity log entry | Task 3 |
| `POST /api/reset-pin` — `/^\d{4}$/` validation | Task 4 |
| `POST /api/reset-pin` — `used_at IS NULL AND expires_at > NOW()` | Task 4 |
| `POST /api/reset-pin` — bcrypt hash, UPDATE users, stamp `used_at` | Task 4 |
| `POST /api/reset-pin` — activity log entry | Task 4 |
| `ResetPinScreen` — card layout, two PIN inputs, success/error states | Task 5 |
| `ResetPinScreen` — client-side validation (4 digits, match) | Task 5 |
| `ResetPinScreen` — `window.history.replaceState` redirect after success | Task 5 |
| `?reset=` detection in root `App` before login check | Task 6 |
| `LoginScreen` — "Forgot PIN?" link below PIN field | Task 7 |
| `LoginScreen` — sub-form with email input, Send button | Task 7 |
| `LoginScreen` — `sent` state shows confirmation, no re-send | Task 7 |
| `LoginScreen` — `error` state for network failure only | Task 7 |
| `LoginScreen` — pre-populate email from existing input | Task 7 (Step 1: `setForgotEmail(email)`) |
| `FRONTEND_URL` env var used in reset link | Task 3 (`process.env.FRONTEND_URL`) |

**Placeholder scan:** No TBDs, TODOs, or vague requirements found.

**Type consistency:** `forgotPinLimiter` referenced in Task 2 and used in Task 3. `ResetPinScreen` defined in Task 5, used in Task 6. All consistent.
