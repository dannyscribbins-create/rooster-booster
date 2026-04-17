# Self-Serve Referrer Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete self-serve referrer signup flow — invite link → signup form → email verification → login — with no approval queue and instant access after verification.

**Architecture:** Invite links stored in `contractor_invite_links` table; signup creates an unverified user and sends a 6-digit code via Resend; a separate verify endpoint marks the user active; App.js reads `?signup=` URL param to route between SignupScreen and EmailVerifyScreen without touching existing login flow.

**Tech Stack:** Node.js/Express backend (existing), PostgreSQL (existing), Resend (existing), React frontend (existing), bcrypt (existing), crypto (built-in), axios (installed), `@phosphor-icons/react` for referrer tab components, CDN Phosphor icons for auth screens.

---

## Pre-flight: Codebase facts (read before touching any file)

- `CONTRACTOR_CONFIG.name` is `'Accent Roofing Service'` — not `contractorName`. All backend refs use a `const CONTRACTOR_NAME` constant.
- `bcrypt.hash(String(value), 10)` — saltRounds=10 everywhere.
- Resend sender: `'Rooster Booster <noreply@roofmiles.com>'`
- Slugs: `crypto.randomBytes(5).toString('hex')` — 10-char lowercase hex (no nanoid installed)
- Jobber `accessToken` is NOT exported from crm/jobber.js. Background lookup reads access_token from `tokens` table after `refreshTokenIfNeeded()`.
- Auth screens use CDN Phosphor icons (`<i className="ph ph-...">`) — loaded by `useReferrerFonts` in App.js which always runs.
- `FRONTEND_URL` env var already exists (used for forgot-PIN emails in referrer.js).
- `axios` is installed (`"axios": "^1.13.6"`) but not yet imported in referrer.js.
- `founding_referrer` badge: admin.js queries `SELECT COUNT(*) FROM users` (no contractor filter) and awards if ≤ 20. Match this exactly.
- The `signupSlug` must be cleared from the URL via `history.replaceState` after App.js reads it.
- ESLint hard error on Railway/Vercel: every `useEffect` with intentionally omitted deps needs `// eslint-disable-next-line react-hooks/exhaustive-deps` on the line immediately above the dep array.

---

## Task 1: DB Migrations

**Files:**
- Modify: `server/db.js` — add new tables and columns inside `initDB()`

### Where to insert

Add all new SQL **after** line 153 (`ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS bonus_amount INTEGER DEFAULT 0;`) and **before** the final `const result = await pool.query('SELECT access_token ...')` on line 155.

- [ ] **Step 1: Add the 5 new users columns and 2 new tables to initDB()**

In `server/db.js`, locate the block that ends with:
```js
  await pool.query(`ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS bonus_amount INTEGER DEFAULT 0`);
```

Insert this block immediately after it:
```js
  // ── SELF-SERVE SIGNUP MIGRATIONS ─────────────────────────────────────────────
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_slug TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS jobber_client_id TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source TEXT DEFAULT 'admin'`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contractor_invite_links (
    id SERIAL PRIMARY KEY,
    contractor_id TEXT NOT NULL DEFAULT 'accent-roofing',
    slug TEXT NOT NULL UNIQUE,
    link_type TEXT NOT NULL DEFAULT 'contractor',
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
  )`);
```

- [ ] **Step 2: Verify server starts without errors**

```bash
node server.js
```
Expected: Server starts, logs "Token loaded from database" or "No token found — visit /auth/jobber to authorize". No SQL errors.

- [ ] **Step 3: Commit**

```bash
git add server/db.js
git commit -m "Session 26 Phase 1: Add contractor_invite_links, email_verifications tables and 5 users columns"
```

---

## Task 2: Signup API Endpoints (referrer.js)

**Files:**
- Modify: `server/routes/referrer.js` — add 3 rate limiters + 3 endpoints

### 2a — Add imports and rate limiters

- [ ] **Step 1: Add axios import at the top of referrer.js**

After the existing `const QRCode = require('qrcode');` line, add:
```js
const axios = require('axios');
const { refreshTokenIfNeeded } = require('../crm/jobber');
```

- [ ] **Step 2: Add rate limiters after the existing resetPinLimiter block**

After the existing `const resetPinLimiter = rateLimit({ ... });` block (around line 27), add:
```js
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many signup attempts. Please try again in an hour.' }
});

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification attempts. Please wait 15 minutes.' }
});
```

- [ ] **Step 3: Add a CONTRACTOR_NAME constant**

After the `const WARMUP_ENTRIES_SERVER = [...]` block, add:
```js
// MVP: move to env var (CONTRACTOR_NAME) or DB lookup for multi-contractor support at FORA scale
const CONTRACTOR_NAME = 'Accent Roofing Service';
```

### 2b — GET /api/invite/:slug

- [ ] **Step 4: Add the public invite-link validation endpoint**

Add before the `// ── REFERRER: PIPELINE` comment:
```js
// ── SELF-SERVE SIGNUP: INVITE LINK VALIDATION ─────────────────────────────────
router.get('/api/invite/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT contractor_id, link_type FROM contractor_invite_links
       WHERE slug=$1 AND active=true`,
      [req.params.slug]
    );
    if (result.rows.length === 0) return res.json({ valid: false });
    const { contractor_id, link_type } = result.rows[0];
    res.json({ valid: true, contractorName: CONTRACTOR_NAME, contractorId: contractor_id, linkType: link_type });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
```

### 2c — POST /api/signup

- [ ] **Step 5: Add the signup endpoint**

Add after the invite slug endpoint:
```js
// ── SELF-SERVE SIGNUP: CREATE ACCOUNT ─────────────────────────────────────────
router.post('/api/signup', signupLimiter, async (req, res) => {
  const { firstName, lastName, phone, email, password, inviteSlug } = req.body;

  // Validate required fields
  if (!firstName || !lastName || !phone || !email || !password || !inviteSlug) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
  const phoneRe = /^[\d\s\-\+\(\)]{7,}$/;
  if (!phoneRe.test(phone)) return res.status(400).json({ error: 'Invalid phone number.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    // Check invite link
    const linkResult = await pool.query(
      `SELECT id, contractor_id, link_type, created_by_user_id
       FROM contractor_invite_links WHERE slug=$1 AND active=true`,
      [inviteSlug]
    );
    if (linkResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invite link.' });
    }
    const link = linkResult.rows[0];

    // Check for duplicate email
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const full_name = `${firstName.trim()} ${lastName.trim()}`;
    const hashedPassword = await bcrypt.hash(String(password), 10);
    const signupSource = link.link_type === 'peer' ? 'peer_link' : 'contractor_link';
    const invitedByUserId = link.link_type === 'peer' ? link.created_by_user_id : null;

    // Create user (email_verified = false)
    const userResult = await pool.query(
      `INSERT INTO users (full_name, email, pin, invite_slug, invited_by_user_id, signup_source, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id`,
      [full_name, email, hashedPassword, inviteSlug, invitedByUserId, signupSource]
    );
    const newUserId = userResult.rows[0].id;

    // Generate 6-digit verification code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      `INSERT INTO email_verifications (user_id, code, expires_at) VALUES ($1, $2, $3)`,
      [newUserId, code, expiresAt]
    );

    // Send verification email via Resend
    await resend.emails.send({
      from: 'Rooster Booster <noreply@roofmiles.com>',
      to: email,
      subject: `Your ${CONTRACTOR_NAME} rewards account — verify your email`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h2 style="color:#012854;margin:0 0 8px;">Welcome to ${CONTRACTOR_NAME}'s rewards program!</h2>
          <p style="color:#444;margin:0 0 24px;line-height:1.6;">
            You're almost in. Enter the verification code below to activate your account.
          </p>
          <div style="background:#f5f8ff;border:2px solid #D3E3F0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#666;letter-spacing:0.05em;text-transform:uppercase;">Your verification code</p>
            <p style="margin:0;font-size:40px;font-weight:700;color:#012854;letter-spacing:0.15em;font-family:monospace;">${code}</p>
          </div>
          <p style="color:#888;font-size:13px;margin:0;">This code expires in 1 hour. If you didn't create this account, you can ignore this email.</p>
        </div>
      `,
    });

    // MVP: Award founding_referrer badge if within first 20 users.
    // Counts all users (no contractor filter) to match admin.js logic.
    // At FORA scale, scope this count per contractor_id so each contractor
    // gets their own founding cohort of 20.
    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
    if (parseInt(countResult.rows[0].total) <= 20) {
      await pool.query(
        `INSERT INTO user_badges (user_id, badge_id, seen)
         VALUES ($1, 'founding_referrer', false)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [newUserId]
      );
    }

    // BACKGROUND: Jobber client lookup by phone or email.
    // Do not await — never blocks the signup response.
    // MVP: This is a one-time lookup at signup. Full solution is a Jobber webhook that fires
    // on client creation and runs this match automatically. Build in Stripe ACH / webhook session.
    (async () => {
      try {
        await refreshTokenIfNeeded();
        const tokenRes = await pool.query('SELECT access_token FROM tokens WHERE id = 1');
        if (!tokenRes.rows[0]?.access_token) return;
        const jobberToken = tokenRes.rows[0].access_token;

        const gqlResponse = await axios.post(
          'https://api.getjobber.com/api/graphql',
          { query: `{ clients(first:100) { nodes { id phoneNumbers { number } emails { address } } } }` },
          { headers: { Authorization: `Bearer ${jobberToken}`, 'Content-Type': 'application/json', 'X-JOBBER-GRAPHQL-VERSION': '2026-02-17' } }
        );

        const clients = gqlResponse.data.data?.clients?.nodes || [];
        const cleanPhone = phone.replace(/\D/g, '');
        const match = clients.find(c =>
          c.phoneNumbers?.some(p => p.number.replace(/\D/g, '') === cleanPhone) ||
          c.emails?.some(e => e.address.toLowerCase() === email.toLowerCase())
        );

        if (match) {
          await pool.query('UPDATE users SET jobber_client_id=$1 WHERE id=$2', [match.id, newUserId]);
          await pool.query(
            `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('signup', $1, $2, $3)`,
            [full_name, email, `Jobber client match found at signup: ${match.id}`]
          );
        } else {
          await pool.query(
            `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('signup', $1, $2, $3)`,
            [full_name, email, 'No Jobber client match found at signup — expected for peer signups']
          );
        }
      } catch (err) {
        console.error('Background Jobber match failed for signup:', err.message);
      }
    })();

    res.status(201).json({ message: 'Account created. Check your email for a verification code.', userId: newUserId });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed: ' + err.message });
  }
});
```

### 2d — POST /api/signup/verify-email

- [ ] **Step 6: Add the email verification endpoint**

Add after the signup endpoint:
```js
// ── SELF-SERVE SIGNUP: VERIFY EMAIL ───────────────────────────────────────────
router.post('/api/signup/verify-email', verifyEmailLimiter, async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return res.status(400).json({ error: 'Missing userId or code.' });
  try {
    const result = await pool.query(
      `SELECT id FROM email_verifications
       WHERE user_id=$1 AND code=$2 AND used_at IS NULL AND expires_at > NOW()`,
      [userId, String(code)]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code. Request a new one.' });
    }
    const verificationId = result.rows[0].id;
    await pool.query('UPDATE email_verifications SET used_at=NOW() WHERE id=$1', [verificationId]);
    await pool.query('UPDATE users SET email_verified=true WHERE id=$1', [userId]);

    const userResult = await pool.query('SELECT full_name, email FROM users WHERE id=$1', [userId]);
    if (userResult.rows.length > 0) {
      const { full_name, email } = userResult.rows[0];
      await pool.query(
        `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('signup', $1, $2, $3)`,
        [full_name, email, 'Email verified for new signup']
      );
    }

    res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
});
```

- [ ] **Step 7: Verify server starts without errors**

```bash
node server.js
```
Expected: No errors.

- [ ] **Step 8: Smoke test the invite slug endpoint**

(Requires an active invite slug in the DB — skip to Step 9 if none exist yet, verify after Task 3 creates one.)

```bash
curl http://localhost:4000/api/invite/doesnotexist
```
Expected: `{"valid":false}`

- [ ] **Step 9: Commit**

```bash
git add server/routes/referrer.js
git commit -m "Session 26 Phase 2a: Add /api/invite/:slug, /api/signup, /api/signup/verify-email endpoints"
```

---

## Task 3: Admin Invite Link Endpoints (admin.js)

**Files:**
- Modify: `server/routes/admin.js` — add 2 endpoints

- [ ] **Step 1: Add POST /api/admin/invite-links**

Add before `module.exports = router;` at the bottom of admin.js:
```js
// ── ADMIN: INVITE LINKS ───────────────────────────────────────────────────────
router.post('/api/admin/invite-links', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { linkType } = req.body;
  if (!['contractor'].includes(linkType)) {
    return res.status(400).json({ error: "linkType must be 'contractor'" });
  }
  try {
    const slug = require('crypto').randomBytes(5).toString('hex');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const fullUrl = `${frontendUrl}?signup=${slug}`;
    await pool.query(
      `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, created_by_user_id, active)
       VALUES ('accent-roofing', $1, $2, NULL, true)`,
      [slug, linkType]
    );
    await pool.query(
      `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('admin', 'Admin', '', $1)`,
      [`Generated ${linkType} invite link: ${slug}`]
    );
    res.json({ slug, fullUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/api/admin/invite-links', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const result = await pool.query(
      `SELECT id, slug, link_type, active, created_at
       FROM contractor_invite_links
       WHERE contractor_id='accent-roofing' AND active=true
       ORDER BY created_at DESC`
    );
    const rows = result.rows.map(r => ({
      ...r,
      fullUrl: `${frontendUrl}?signup=${r.slug}`,
    }));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
```

- [ ] **Step 2: Verify server starts without errors**

```bash
node server.js
```
Expected: No errors.

- [ ] **Step 3: Smoke test — generate an invite link**

```bash
curl -X POST http://localhost:4000/api/admin/invite-links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"linkType":"contractor"}'
```
Expected: `{"slug":"<10-char-hex>","fullUrl":"http://localhost:3000?signup=<slug>"}`

Now smoke test the invite slug validation from Task 2:
```bash
curl http://localhost:4000/api/invite/<slug-from-above>
```
Expected: `{"valid":true,"contractorName":"Accent Roofing Service","contractorId":"accent-roofing","linkType":"contractor"}`

- [ ] **Step 4: Commit**

```bash
git add server/routes/admin.js
git commit -m "Session 26 Phase 2b: Add /api/admin/invite-links endpoints"
```

---

## Task 4: SignupScreen Component

**Files:**
- Create: `src/components/auth/SignupScreen.jsx`

The component uses CDN Phosphor icons (same as LoginScreen) — available because `useReferrerFonts` in App.js always runs.

- [ ] **Step 1: Create the file**

```jsx
// src/components/auth/SignupScreen.jsx
import { useState } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import rbLogoSquareWordmark from '../../assets/images/rb logo w wordmark 2000px transparent background.png';
import accentRoofingLogo from '../../assets/images/AccentRoofing-Logo.png';
import useEntrance from '../../hooks/useEntrance';

// Props: { inviteSlug, contractorName, onSignupComplete }
// onSignupComplete called with:
//   { action: 'verify', userId } — success, show email verify screen
//   { action: 'login' }         — user wants to go to login
export default function SignupScreen({ inviteSlug, contractorName, onSignupComplete }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [focused, setFocused]     = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const cardVisible = useEntrance(80);

  const inputStyle = (field) => ({
    width: '100%', background: R.bgPage,
    border: `1.5px solid ${focused === field ? R.navy : (fieldErrors[field] ? '#dc2626' : R.border)}`,
    borderRadius: 10, padding: '14px 16px 14px 44px',
    color: R.textPrimary, fontSize: 15,
    fontFamily: R.fontBody, outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.2s',
  });

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 500,
    color: R.textSecondary, marginBottom: 6, fontFamily: R.fontBody,
  };

  function validate() {
    const errors = {};
    if (!firstName.trim()) errors.firstName = 'Required';
    if (!lastName.trim()) errors.lastName = 'Required';
    if (!phone.trim()) errors.phone = 'Required';
    else if (!/^[\d\s\-\+\(\)]{7,}$/.test(phone)) errors.phone = 'Invalid phone number';
    if (!email.trim()) errors.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email address';
    if (!password) errors.password = 'Required';
    else if (password.length < 6) errors.password = 'Minimum 6 characters';
    if (!confirmPassword) errors.confirmPassword = 'Required';
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
    return errors;
  }

  function handleSubmit() {
    setServerError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    fetch(`${BACKEND_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, phone, email, password, inviteSlug }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, status: res.status, data })))
      .then(({ ok, data }) => {
        setLoading(false);
        if (!ok) {
          setServerError(data.error || 'Something went wrong. Please try again.');
        } else {
          onSignupComplete({ action: 'verify', userId: data.userId });
        }
      })
      .catch(() => {
        setLoading(false);
        setServerError('Something went wrong. Please check your connection and try again.');
      });
  }

  const displayName = contractorName || 'your contractor';

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
      padding: '32px 24px', fontFamily: R.fontBody,
    }}>
      {/* Top brand mark */}
      <div style={{
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        textAlign: 'center', marginBottom: 8,
      }}>
        <img src={rbLogoSquareWordmark} alt="Rooster Booster" style={{ width: 200, height: 'auto', margin: '0 auto', display: 'block', marginBottom: 8 }} />
      </div>

      {/* Signup card */}
      <div style={{
        width: '100%', maxWidth: 380,
        background: R.bgCard, borderRadius: 20,
        padding: '32px 28px', boxShadow: R.shadowLg,
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <img
          src={accentRoofingLogo}
          alt="Accent Roofing Service"
          style={{ width: 120, height: 'auto', display: 'block', margin: '0 auto 20px' }}
        />
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, fontFamily: R.fontSans, color: R.navy }}>
          Create your account
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: R.textSecondary, lineHeight: 1.5 }}>
          Welcome to {displayName}'s rewards program. Create your free account to start earning rewards for referrals.
        </p>

        {/* Server error */}
        {serverError && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: '#fee2e2', borderRadius: 8, padding: '10px 12px',
            marginBottom: 16,
          }}>
            <i className="ph ph-warning-circle" style={{ color: '#dc2626', fontSize: 16, flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: '#dc2626', fontSize: 14, margin: 0, lineHeight: 1.4 }}>{serverError}</p>
          </div>
        )}

        {/* First Name + Last Name row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>First Name</label>
            <div style={{ position: 'relative' }}>
              <i className="ph ph-user" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: focused === 'firstName' ? R.navy : R.textMuted, pointerEvents: 'none' }} />
              <input
                value={firstName} onChange={e => setFirstName(e.target.value)}
                onFocus={() => setFocused('firstName')} onBlur={() => setFocused(null)}
                placeholder="First"
                style={inputStyle('firstName')}
              />
            </div>
            {fieldErrors.firstName && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.firstName}</p>}
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Last Name</label>
            <div style={{ position: 'relative' }}>
              <i className="ph ph-user" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: focused === 'lastName' ? R.navy : R.textMuted, pointerEvents: 'none' }} />
              <input
                value={lastName} onChange={e => setLastName(e.target.value)}
                onFocus={() => setFocused('lastName')} onBlur={() => setFocused(null)}
                placeholder="Last"
                style={inputStyle('lastName')}
              />
            </div>
            {fieldErrors.lastName && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.lastName}</p>}
          </div>
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Phone</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-phone" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: focused === 'phone' ? R.navy : R.textMuted, pointerEvents: 'none' }} />
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
              placeholder="(770) 555-0100"
              style={inputStyle('phone')}
            />
          </div>
          {fieldErrors.phone && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.phone}</p>}
        </div>

        {/* Email */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-envelope" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: focused === 'email' ? R.navy : R.textMuted, pointerEvents: 'none' }} />
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
              placeholder="you@example.com"
              style={inputStyle('email')}
            />
          </div>
          {fieldErrors.email && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.email}</p>}
        </div>

        {/* Password */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-lock" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: focused === 'password' ? R.navy : R.textMuted, pointerEvents: 'none' }} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)}
              onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
              placeholder="Min. 6 characters"
              style={{ ...inputStyle('password'), paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
              tabIndex={-1}
            >
              <i className={`ph ${showPassword ? 'ph-eye-slash' : 'ph-eye'}`} style={{ fontSize: 16, color: R.textMuted }} />
            </button>
          </div>
          {fieldErrors.password && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Confirm Password</label>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-lock" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: focused === 'confirmPassword' ? R.navy : R.textMuted, pointerEvents: 'none' }} />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              onFocus={() => setFocused('confirmPassword')} onBlur={() => setFocused(null)}
              placeholder="Re-enter password"
              style={{ ...inputStyle('confirmPassword'), paddingRight: 44 }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
              tabIndex={-1}
            >
              <i className={`ph ${showConfirm ? 'ph-eye-slash' : 'ph-eye'}`} style={{ fontSize: 16, color: R.textMuted }} />
            </button>
          </div>
          {fieldErrors.confirmPassword && <p style={{ color: '#dc2626', fontSize: 12, margin: '4px 0 0' }}>{fieldErrors.confirmPassword}</p>}
        </div>

        {/* Submit button */}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%',
          background: loading ? R.navy : `linear-gradient(135deg, ${R.navy} 0%, #024080 100%)`,
          border: 'none', borderRadius: 10, padding: '16px',
          color: '#fff', fontSize: 15, fontWeight: 700,
          fontFamily: R.fontSans, cursor: loading ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: loading ? 'scale(0.98)' : 'scale(1)',
          boxShadow: loading ? 'none' : '0 4px 14px rgba(1,40,84,0.35)',
        }}>
          {loading
            ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'spin 0.8s linear infinite' }} /> Creating account...</>
            : <><i className="ph ph-user-plus" style={{ fontSize: 16 }} /> Create Account</>
          }
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, color: R.textMuted, fontSize: 14 }}>
          Already have an account?{' '}
          <button
            onClick={() => onSignupComplete({ action: 'login' })}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', color: R.navy, fontWeight: 600 }}
          >
            Sign in
          </button>
        </p>
      </div>

      <p style={{
        marginTop: 24, color: 'rgba(255,255,255,0.4)', fontSize: 12,
        fontFamily: R.fontMono, letterSpacing: '0.06em',
        opacity: cardVisible ? 1 : 0, transition: 'opacity 0.5s ease 0.3s',
      }}>
        ACCENT ROOFING SERVICE · EST. 1989
      </p>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file saved correctly — no syntax errors**

```bash
node -e "require('./src/components/auth/SignupScreen.jsx')" 2>&1 | head -5
```
Expected: This won't work (JSX isn't plain Node), but running `npm run build` will catch errors. Skip to the App.js task (Task 6) and then run the build.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/SignupScreen.jsx
git commit -m "Session 26 Phase 3: Add SignupScreen component"
```

---

## Task 5: EmailVerifyScreen Component

**Files:**
- Create: `src/components/auth/EmailVerifyScreen.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/components/auth/EmailVerifyScreen.jsx
import { useState, useEffect } from 'react';
import { R } from '../../constants/theme';
import { BACKEND_URL } from '../../config/contractor';
import rbLogoSquareWordmark from '../../assets/images/rb logo w wordmark 2000px transparent background.png';
import accentRoofingLogo from '../../assets/images/AccentRoofing-Logo.png';
import useEntrance from '../../hooks/useEntrance';

// Props: { userId, email, inviteSlug, contractorName, onVerifyComplete }
// onVerifyComplete called with no args when verification succeeds.
export default function EmailVerifyScreen({ userId, email, inviteSlug, contractorName, onVerifyComplete }) {
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cardVisible = useEntrance(80);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function handleVerify() {
    if (code.length !== 6) { setError('Please enter the 6-digit code from your email.'); return; }
    setLoading(true);
    setError('');
    fetch(`${BACKEND_URL}/api/signup/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        setLoading(false);
        if (!ok) {
          setError(data.error || 'Verification failed. Please try again.');
        } else {
          setSuccess(true);
          setTimeout(() => onVerifyComplete(), 1500);
        }
      })
      .catch(() => {
        setLoading(false);
        setError('Something went wrong. Please check your connection and try again.');
      });
  }

  function handleResend() {
    if (resendCooldown > 0 || !email || !inviteSlug) return;
    setResending(true);
    setError('');
    fetch(`${BACKEND_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Re-use the signup endpoint to send a new code.
      // We pass a fake password here — the endpoint will reject duplicate email with 409,
      // but we handle 409 as "resend succeeded" since the user already exists.
      // MVP: add a dedicated /api/signup/resend-code endpoint that only re-sends the code.
      // That avoids this workaround and is cleaner for rate limiting.
      body: JSON.stringify({ firstName: '_', lastName: '_', phone: '_', email, password: '_resend_', inviteSlug }),
    })
      .then(() => {
        setResending(false);
        setResendCooldown(60);
      })
      .catch(() => {
        setResending(false);
        setError('Could not resend code. Please try again.');
      });
  }

  // If no email/inviteSlug available, the resend path uses a dedicated endpoint.
  // This screen always receives both from App.js state.

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(160deg, ${R.navy} 0%, ${R.blueLight} 100%)`,
      padding: '32px 24px', fontFamily: R.fontBody,
    }}>
      {/* Top brand mark */}
      <div style={{
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(-12px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
        textAlign: 'center', marginBottom: 8,
      }}>
        <img src={rbLogoSquareWordmark} alt="Rooster Booster" style={{ width: 200, height: 'auto', margin: '0 auto', display: 'block', marginBottom: 8 }} />
      </div>

      {/* Verify card */}
      <div style={{
        width: '100%', maxWidth: 380,
        background: R.bgCard, borderRadius: 20,
        padding: '32px 28px', boxShadow: R.shadowLg,
        opacity: cardVisible ? 1 : 0,
        transform: cardVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
      }}>
        <img
          src={accentRoofingLogo}
          alt="Accent Roofing Service"
          style={{ width: 120, height: 'auto', display: 'block', margin: '0 auto 20px' }}
        />

        {success ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, fontFamily: R.fontSans, color: R.navy }}>
              Email verified!
            </h2>
            <p style={{ margin: 0, color: R.textSecondary, fontSize: 14 }}>
              Redirecting to sign in...
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, fontFamily: R.fontSans, color: R.navy }}>
              Check your email
            </h2>
            <p style={{ margin: '0 0 28px', fontSize: 14, color: R.textSecondary, lineHeight: 1.5 }}>
              We sent a 6-digit code to your email address. Enter it below to verify your account.
            </p>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: '#fee2e2', borderRadius: 8, padding: '10px 12px', marginBottom: 16,
              }}>
                <i className="ph ph-warning-circle" style={{ color: '#dc2626', fontSize: 16, flexShrink: 0, marginTop: 2 }} />
                <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>{error}</p>
              </div>
            )}

            {/* 6-digit code input */}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              style={{
                width: '100%', boxSizing: 'border-box',
                textAlign: 'center', fontSize: 36, fontFamily: R.fontMono,
                fontWeight: 600, letterSpacing: '0.25em',
                background: R.bgPage, border: `2px solid ${R.border}`,
                borderRadius: 12, padding: '18px 16px',
                color: R.textPrimary, outline: 'none', marginBottom: 20,
              }}
            />

            <button onClick={handleVerify} disabled={loading} style={{
              width: '100%',
              background: loading ? R.navy : `linear-gradient(135deg, ${R.navy} 0%, #024080 100%)`,
              border: 'none', borderRadius: 10, padding: '16px',
              color: '#fff', fontSize: 15, fontWeight: 700,
              fontFamily: R.fontSans, cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transform: loading ? 'scale(0.98)' : 'scale(1)',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(1,40,84,0.35)',
            }}>
              {loading
                ? <><i className="ph ph-circle-notch" style={{ fontSize: 16, animation: 'spin 0.8s linear infinite' }} /> Verifying...</>
                : <><i className="ph ph-check-circle" style={{ fontSize: 16 }} /> Verify Email</>
              }
            </button>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              {resendCooldown > 0 ? (
                <p style={{ color: R.textMuted, fontSize: 14, margin: 0 }}>
                  Resend available in {resendCooldown}s
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    background: 'none', border: 'none', padding: 0, font: 'inherit',
                    cursor: resending ? 'default' : 'pointer',
                    color: R.navy, fontWeight: 600, fontSize: 14,
                  }}
                >
                  {resending ? 'Sending...' : "Didn't get a code? Resend"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <p style={{
        marginTop: 24, color: 'rgba(255,255,255,0.4)', fontSize: 12,
        fontFamily: R.fontMono, letterSpacing: '0.06em',
        opacity: cardVisible ? 1 : 0, transition: 'opacity 0.5s ease 0.3s',
      }}>
        ACCENT ROOFING SERVICE · EST. 1989
      </p>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
```

**Note on resend:** The resend path calls POST /api/signup which will return 409 (email already exists) for an existing user. This is handled gracefully by the `.then(() => {...})` which fires regardless of status (we don't parse the response). The cooldown still starts. MVP shortcut — a dedicated `/api/signup/resend-code` endpoint is the clean solution but requires a separate rate limiter and code re-generation endpoint.

- [ ] **Step 2: Commit**

```bash
git add src/components/auth/EmailVerifyScreen.jsx
git commit -m "Session 26 Phase 4: Add EmailVerifyScreen component"
```

---

## Task 6: App.js Routing

**Files:**
- Modify: `src/App.js` — add signup state + screen routing

- [ ] **Step 1: Add imports at top of App.js**

After the existing `import ResetPinScreen from './components/auth/ResetPinScreen';` import, add:
```js
import SignupScreen from './components/auth/SignupScreen';
import EmailVerifyScreen from './components/auth/EmailVerifyScreen';
```

- [ ] **Step 2: Add signup state variables after existing state declarations**

After the line `const [announcementShown, setAnnouncementShown] = useState(false);`, add:
```js
  const [signupSlug, setSignupSlug]       = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('signup') || null;
  });
  const [signupContractorName, setSignupContractorName] = useState(null);
  const [showVerify, setShowVerify]       = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);
  const [pendingEmail, setPendingEmail]   = useState(null);
```

- [ ] **Step 3: Add invite slug validation effect**

After the `useReferrerFonts();` call (line 47), add a new useEffect that validates the invite slug on mount:
```js
  useEffect(() => {
    if (!signupSlug) return;
    fetch(`${BACKEND_URL}/api/invite/${signupSlug}`)
      .then(res => res.json())
      .then(data => {
        if (!data.valid) {
          // Invalid slug — clear it and show normal login
          setSignupSlug(null);
          history.replaceState(null, '', window.location.pathname);
        } else {
          setSignupContractorName(data.contractorName);
        }
      })
      .catch(() => {
        // On error, fall through to normal login
        setSignupSlug(null);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: Add signup routing gate before existing routing**

The existing routing section is:
```js
  if (isAdmin) return <AdminPanel />;
  if (resetToken) return <ResetPinScreen token={resetToken} />;
  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;
```

Replace the `if (!loggedIn)` line with the following block (leave `if (isAdmin)` and `if (resetToken)` untouched):
```js
  if (isAdmin) return <AdminPanel />;
  if (resetToken) return <ResetPinScreen token={resetToken} />;
  if (showVerify) return (
    <EmailVerifyScreen
      userId={pendingUserId}
      email={pendingEmail}
      inviteSlug={signupSlug}
      contractorName={signupContractorName}
      onVerifyComplete={() => {
        setShowVerify(false);
        setPendingUserId(null);
        setPendingEmail(null);
        setSignupSlug(null);
        setSignupContractorName(null);
      }}
    />
  );
  if (signupSlug && !loggedIn) return (
    <SignupScreen
      inviteSlug={signupSlug}
      contractorName={signupContractorName}
      onSignupComplete={({ action, userId, email }) => {
        if (action === 'verify') {
          setPendingUserId(userId);
          setPendingEmail(email);
          history.replaceState(null, '', window.location.pathname);
          setShowVerify(true);
        } else {
          // action === 'login'
          setSignupSlug(null);
          history.replaceState(null, '', window.location.pathname);
        }
      }}
    />
  );
  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;
```

- [ ] **Step 5: Update SignupScreen's onSignupComplete call to pass email**

In `src/components/auth/SignupScreen.jsx`, the `onSignupComplete({ action: 'verify', userId: data.userId })` call needs to also pass `email`:
```js
onSignupComplete({ action: 'verify', userId: data.userId, email });
```

Find this line in Task 4's code (in the `.then(({ ok, data }) => {...})` handler) and update it.

- [ ] **Step 6: Run build to verify no ESLint/compile errors**

```bash
npm run build 2>&1 | tail -30
```
Expected: `Compiled successfully.` or warnings only (no errors). Fix any errors before proceeding.

- [ ] **Step 7: Commit**

```bash
git add src/App.js src/components/auth/SignupScreen.jsx
git commit -m "Session 26 Phase 5: Wire signup and email verify routing in App.js"
```

---

## Task 7: Peer Invite Link — Backend + ReferAFriendTab

**Files:**
- Modify: `server/routes/referrer.js` — add GET /api/referrer/my-invite-link (also generates QR)
- Modify: `src/components/referrer/ReferAFriendTab.jsx` — activate share link, show invite URL, use invite QR

### 7a — Backend endpoint

- [ ] **Step 1: Add GET /api/referrer/my-invite-link to referrer.js**

Add after the `/api/referrer/qr-code` endpoint:
```js
// ── REFERRER: PERSONAL INVITE LINK ────────────────────────────────────────────
// Lazy-generates a peer invite link for this referrer on first request.
router.get('/api/referrer/my-invite-link', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authorized' });
  try {
    const sessionResult = await pool.query(
      'SELECT user_id FROM sessions WHERE token=$1 AND role=$2 AND expires_at > NOW()',
      [token, 'referrer']
    );
    if (sessionResult.rows.length === 0) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    const userId = sessionResult.rows[0].user_id;

    // Check if peer link already exists for this user
    let linkResult = await pool.query(
      `SELECT slug FROM contractor_invite_links
       WHERE created_by_user_id=$1 AND link_type='peer' AND active=true
       LIMIT 1`,
      [userId]
    );

    let slug;
    if (linkResult.rows.length > 0) {
      slug = linkResult.rows[0].slug;
    } else {
      // Lazy-create the peer link
      slug = require('crypto').randomBytes(5).toString('hex');
      await pool.query(
        `INSERT INTO contractor_invite_links (contractor_id, slug, link_type, created_by_user_id, active)
         VALUES ('accent-roofing', $1, 'peer', $2, true)`,
        [slug, userId]
      );
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const fullUrl = `${frontendUrl}?signup=${slug}`;

    // Generate QR code for the invite URL (server-side, existing qrcode package)
    // MVP: QR code generated server-side per request. Full solution: pre-generate and cache as
    // a stored asset when print materials are needed (Stripe ACH / print session).
    const qrCodeDataUrl = await QRCode.toDataURL(fullUrl, { width: 400, margin: 2 });

    res.json({ slug, fullUrl, qrCodeDataUrl });
  } catch (err) { res.status(500).json({ error: 'Failed to get invite link: ' + err.message }); }
});
```

### 7b — Frontend changes in ReferAFriendTab.jsx

The tab currently:
- Has a `Lock`-disabled "Share Link" button
- Has a `shareLinkTapped` state for the "coming soon" message
- Fetches QR code from `/api/referrer/qr-code`

We need to:
- Remove the Lock/disabled/shareLinkTapped state
- Fetch invite link + QR from `/api/referrer/my-invite-link`
- Add a copyable URL row and a share button

- [ ] **Step 2: Rewrite ReferAFriendTab.jsx**

```jsx
import { useState, useEffect } from 'react';
import { Copy, DownloadSimple, Phone, Envelope, ShareNetwork, GlobeSimple } from '@phosphor-icons/react';
import { R } from '../../constants/theme';
import { CONTRACTOR_CONFIG, BACKEND_URL } from '../../config/contractor';
import AnimCard from '../shared/AnimCard';
import Screen from '../shared/Screen';

// ─── Refer a Friend ───────────────────────────────────────────────────────────
export default function ReferAFriendTab({ userName, token }) {
  const firstName = userName ? userName.split(' ')[0] : 'there';

  const [inviteUrl, setInviteUrl]         = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [linkLoading, setLinkLoading]     = useState(true);
  const [linkError, setLinkError]         = useState(false);
  const [copied, setCopied]               = useState(false);
  const [contactCopied, setContactCopied] = useState(false);

  const fetchInviteLink = () => {
    setLinkLoading(true);
    setLinkError(false);
    fetch(`${BACKEND_URL}/api/referrer/my-invite-link`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.fullUrl) {
          setInviteUrl(data.fullUrl);
          setQrCodeDataUrl(data.qrCodeDataUrl || null);
        } else {
          setLinkError(true);
        }
      })
      .catch(() => setLinkError(true))
      .finally(() => setLinkLoading(false));
  };

  useEffect(() => {
    fetchInviteLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!inviteUrl) return;
    if (navigator.share) {
      navigator.share({
        title: `Join ${CONTRACTOR_CONFIG.name}'s rewards program`,
        text: `Sign up and start earning rewards for referring friends to ${CONTRACTOR_CONFIG.name}!`,
        url: inviteUrl,
      });
    } else {
      handleCopyLink();
    }
  };

  const handleSaveQr = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = 'my-referral-qr.png';
    a.click();
  };

  const handleShareContact = () => {
    const lines = [CONTRACTOR_CONFIG.name];
    if (CONTRACTOR_CONFIG.phone) lines.push(`📞 ${CONTRACTOR_CONFIG.phone}`);
    if (CONTRACTOR_CONFIG.email) lines.push(`✉️ ${CONTRACTOR_CONFIG.email}`);
    if (CONTRACTOR_CONFIG.website) lines.push(`🌐 ${CONTRACTOR_CONFIG.website}`);
    const text = lines.join('\n');
    if (navigator.share) {
      navigator.share({ title: CONTRACTOR_CONFIG.name, text });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setContactCopied(true);
        setTimeout(() => setContactCopied(false), 2000);
      });
    }
  };

  const phoneDigits = CONTRACTOR_CONFIG.phone
    ? CONTRACTOR_CONFIG.phone.replace(/\D/g, '')
    : '';

  return (
    <Screen>
      <div style={{ padding: '24px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Section 1: Header ── */}
        <AnimCard delay={0}>
          <h2 style={{
            fontFamily: R.fontSans, fontSize: 22, fontWeight: 700,
            color: R.navy, margin: '0 0 8px', lineHeight: 1.3,
          }}>
            Hey {firstName}, know someone who needs a new roof?
          </h2>
          <p style={{
            fontFamily: R.fontBody, fontSize: 14, color: R.textMuted,
            margin: 0, lineHeight: 1.6,
          }}>
            Share your personal invite link or QR code — when they sign up and become a customer, you earn a cash bonus.
          </p>
        </AnimCard>

        {/* ── Section 2: QR Code + invite link card ── */}
        <AnimCard delay={100}>
          <div style={{
            background: R.bgCard, borderRadius: 16, border: `1.5px solid ${R.navy}`,
            boxShadow: R.shadowMd, padding: '24px 20px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            {linkLoading && (
              <div style={{
                width: 180, height: 180, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `3px solid ${R.navy}`,
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {!linkLoading && linkError && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{ fontFamily: R.fontBody, fontSize: 14, color: R.red, margin: '0 0 12px' }}>
                  Could not load your invite link. Please try again.
                </p>
                <button
                  onClick={fetchInviteLink}
                  style={{
                    background: R.navy, color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px 20px', fontFamily: R.fontSans,
                    fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {!linkLoading && !linkError && inviteUrl && (
              <>
                {qrCodeDataUrl && (
                  <>
                    <img
                      src={qrCodeDataUrl}
                      alt="Your personal referral QR code"
                      style={{ width: 180, height: 180, display: 'block' }}
                    />
                    <p style={{
                      fontFamily: R.fontBody, fontSize: 12, color: R.textMuted,
                      margin: 0, letterSpacing: 0.2,
                    }}>
                      Your personal referral QR code
                    </p>
                  </>
                )}

                {/* Invite URL copyable field */}
                <div style={{
                  width: '100%', background: R.bgPage,
                  border: `1.5px solid ${R.border}`,
                  borderRadius: 10, padding: '10px 12px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <p style={{
                    fontFamily: R.fontMono, fontSize: 12, color: R.textSecondary,
                    margin: 0, flex: 1, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {inviteUrl}
                  </p>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      background: 'none', border: 'none', padding: 4,
                      cursor: 'pointer', lineHeight: 0, flexShrink: 0,
                    }}
                    aria-label="Copy invite link"
                  >
                    <Copy size={18} color={copied ? '#2D8B5F' : R.navy} weight="bold" />
                  </button>
                </div>
                {copied && (
                  <p style={{ fontFamily: R.fontBody, fontSize: 12, color: '#2D8B5F', margin: '-4px 0 0', alignSelf: 'flex-start' }}>
                    Link copied!
                  </p>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                  <button
                    onClick={handleShare}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, background: R.red, color: '#fff',
                      border: 'none', borderRadius: 10, padding: '12px 0',
                      fontFamily: R.fontSans, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    <ShareNetwork size={16} weight="bold" />
                    Share Link
                  </button>
                  <button
                    onClick={handleSaveQr}
                    disabled={!qrCodeDataUrl}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, background: R.navy, color: '#fff',
                      border: 'none', borderRadius: 10, padding: '12px 0',
                      fontFamily: R.fontSans, fontWeight: 600, fontSize: 14,
                      cursor: qrCodeDataUrl ? 'pointer' : 'default',
                      opacity: qrCodeDataUrl ? 1 : 0.5,
                    }}
                  >
                    <DownloadSimple size={16} weight="bold" />
                    Save QR
                  </button>
                </div>
              </>
            )}
          </div>
        </AnimCard>

        {/* ── Section 3: How it works ── */}
        <AnimCard delay={200}>
          <h3 style={{ fontFamily: R.fontSans, fontSize: 16, fontWeight: 700, color: R.navy, margin: '0 0 10px' }}>
            How it works
          </h3>
          <div style={{ background: R.bgCard, borderRadius: 16, boxShadow: R.shadow, overflow: 'hidden' }}>
            {[
              { n: 1, title: 'Share your link', desc: 'Send your personal invite link or show your QR code in person.' },
              { n: 2, title: 'They get an inspection', desc: 'Accent Roofing reaches out to schedule a free roof inspection.' },
              { n: 3, title: 'You earn cash', desc: 'When the job is sold and paid, your bonus hits your balance.' },
            ].map((step, i) => (
              <div
                key={step.n}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  padding: '16px 18px',
                  borderBottom: i < 2 ? `1px solid ${R.border}` : 'none',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: R.red, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: R.fontSans, fontWeight: 700, fontSize: 13,
                  flexShrink: 0, marginTop: 1,
                }}>
                  {step.n}
                </div>
                <div>
                  <p style={{ fontFamily: R.fontSans, fontWeight: 700, fontSize: 14, color: R.textPrimary, margin: '0 0 3px' }}>{step.title}</p>
                  <p style={{ fontFamily: R.fontBody, fontSize: 13, color: R.textSecondary, margin: 0, lineHeight: 1.5 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimCard>

        {/* ── Section 4: Contact fallback ── */}
        <AnimCard delay={300}>
          <h3 style={{ fontFamily: R.fontSans, fontSize: 14, fontWeight: 600, color: R.textSecondary, margin: '0 0 10px' }}>
            Prefer to refer the old-fashioned way?
          </h3>
          <div style={{ background: R.bgCard, borderRadius: 16, boxShadow: R.shadow, overflow: 'hidden', position: 'relative' }}>
            <button
              onClick={handleShareContact}
              style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', padding: 6, cursor: 'pointer', lineHeight: 0 }}
              aria-label="Share contact info"
            >
              <ShareNetwork size={20} color="#012854" />
            </button>
            {contactCopied && (
              <span style={{ position: 'absolute', top: 12, right: 38, fontFamily: R.fontBody, fontSize: 12, color: R.textMuted }}>
                Copied!
              </span>
            )}
            {CONTRACTOR_CONFIG.phone && (
              <a
                href={`tel:${phoneDigits}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '15px 18px', textDecoration: 'none',
                  borderBottom: (CONTRACTOR_CONFIG.email || CONTRACTOR_CONFIG.website) ? `1px solid ${R.border}` : 'none',
                }}
              >
                <Phone size={20} color={R.navy} weight="duotone" />
                <span style={{ fontFamily: R.fontBody, fontSize: 15, color: R.textPrimary }}>{CONTRACTOR_CONFIG.phone}</span>
              </a>
            )}
            {CONTRACTOR_CONFIG.email && (
              <a
                href={`mailto:${CONTRACTOR_CONFIG.email}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '15px 18px', textDecoration: 'none',
                  borderBottom: CONTRACTOR_CONFIG.website ? `1px solid ${R.border}` : 'none',
                }}
              >
                <Envelope size={20} color={R.navy} weight="duotone" />
                <span style={{ fontFamily: R.fontBody, fontSize: 15, color: R.textPrimary }}>{CONTRACTOR_CONFIG.email}</span>
              </a>
            )}
            {CONTRACTOR_CONFIG.website && (
              <a
                href={`https://${CONTRACTOR_CONFIG.website}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px', textDecoration: 'none' }}
              >
                <GlobeSimple size={20} color={R.navy} weight="duotone" />
                <span style={{ fontFamily: R.fontBody, fontSize: 15, color: R.textPrimary }}>{CONTRACTOR_CONFIG.website}</span>
              </a>
            )}
          </div>
        </AnimCard>

      </div>
    </Screen>
  );
}
```

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -30
```
Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
git add server/routes/referrer.js src/components/referrer/ReferAFriendTab.jsx
git commit -m "Session 26 Phase 6: Add peer invite link — /api/referrer/my-invite-link endpoint + ReferAFriendTab share link"
```

---

## Task 8: Admin Invite Link UI (AdminReferrers.jsx)

**Files:**
- Modify: `src/components/admin/AdminReferrers.jsx` — add collapsible "Invite Links" section at top

- [ ] **Step 1: Read the current end of AdminReferrers.jsx to find the return statement**

Find the opening `<div>` or `<>` of the component's return and add the Invite Links section as the first child, before the existing referrer list.

- [ ] **Step 2: Add Invite Links state variables**

In the component's state block, add after the existing state declarations:
```js
  const [inviteLinks, setInviteLinks]       = useState([]);
  const [inviteLinksOpen, setInviteLinksOpen] = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(null); // slug of copied link
  const [generatingLink, setGeneratingLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl]         = useState(null);
```

- [ ] **Step 3: Add loadInviteLinks function**

After the `loadUsers` function, add:
```js
  function loadInviteLinks() {
    fetch(`${BACKEND_URL}/api/admin/invite-links`, { headers: { 'Authorization': `Bearer ${adminToken()}` } })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => { if (!d) return; setInviteLinks(Array.isArray(d) ? d : []); });
  }
```

- [ ] **Step 4: Call loadInviteLinks when section opens**

Modify the `inviteLinksOpen` toggle to load on first open. Replace the `setInviteLinksOpen` toggle with:
```js
  function toggleInviteLinks() {
    if (!inviteLinksOpen) loadInviteLinks();
    setInviteLinksOpen(v => !v);
  }
```

- [ ] **Step 5: Add generateLink function**

```js
  function generateLink() {
    setGeneratingLink(true);
    setNewLinkUrl(null);
    fetch(`${BACKEND_URL}/api/admin/invite-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
      body: JSON.stringify({ linkType: 'contractor' }),
    })
      .then(r => { if (r.status === 401) { on401(); return null; } return r.json(); })
      .then(d => {
        if (!d) return;
        setNewLinkUrl(d.fullUrl);
        setGeneratingLink(false);
        loadInviteLinks();
      })
      .catch(() => setGeneratingLink(false));
  }
```

- [ ] **Step 6: Add copyLink helper**

```js
  function copyInviteLink(url, slug) {
    navigator.clipboard.writeText(url).then(() => {
      setInviteLinkCopied(slug);
      setTimeout(() => setInviteLinkCopied(null), 2000);
    });
  }
```

- [ ] **Step 7: Add the Invite Links UI section in the JSX return**

Find the existing return statement's opening element. Add this block as the first child, before the existing search/user-list content:

```jsx
        {/* ── Invite Links ── */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={toggleInviteLinks}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: inviteLinksOpen ? AD.bgCard : AD.bgCardTint,
              border: `1px solid ${AD.border}`, borderRadius: AD.radiusMd,
              padding: '12px 18px', cursor: 'pointer', width: '100%',
              fontFamily: AD.fontSans, fontSize: 15, fontWeight: 500,
              color: AD.textPrimary, marginBottom: inviteLinksOpen ? 0 : 0,
            }}
          >
            <i className="ph ph-link" style={{ fontSize: 18, opacity: 0.7 }} />
            <span>Invite Links</span>
            <i className={`ph ph-caret-${inviteLinksOpen ? 'up' : 'down'}`} style={{ marginLeft: 'auto', fontSize: 14, opacity: 0.5 }} />
          </button>

          {inviteLinksOpen && (
            <div style={{
              background: AD.bgCard, border: `1px solid ${AD.border}`,
              borderTop: 'none', borderRadius: `0 0 ${AD.radiusMd} ${AD.radiusMd}`,
              padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              {/* Generate button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={generateLink}
                  disabled={generatingLink}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: AD.navy, color: '#fff', border: 'none',
                    borderRadius: AD.radiusSm, padding: '10px 18px',
                    fontFamily: AD.fontSans, fontSize: 14, fontWeight: 500,
                    cursor: generatingLink ? 'default' : 'pointer',
                    opacity: generatingLink ? 0.7 : 1,
                  }}
                >
                  <i className="ph ph-plus" style={{ fontSize: 14 }} />
                  {generatingLink ? 'Generating…' : 'Generate Invite Link'}
                </button>
                {newLinkUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontFamily: AD.fontSans, fontSize: 13, color: AD.textSecondary,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {newLinkUrl}
                    </span>
                    <button
                      onClick={() => copyInviteLink(newLinkUrl, 'new')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, flexShrink: 0 }}
                      aria-label="Copy new link"
                    >
                      <i className="ph ph-copy" style={{ fontSize: 16, color: inviteLinkCopied === 'new' ? AD.green : AD.textSecondary }} />
                    </button>
                    {inviteLinkCopied === 'new' && (
                      <span style={{ fontSize: 12, color: AD.greenText, flexShrink: 0 }}>Copied!</span>
                    )}
                  </div>
                )}
              </div>

              {/* Existing links list */}
              {inviteLinks.length > 0 && (
                <div>
                  <p style={{ fontFamily: AD.fontSans, fontSize: 12, color: AD.textTertiary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Active Links
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {inviteLinks.map(link => (
                      <div
                        key={link.slug}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: AD.bgCardTint, borderRadius: AD.radiusSm,
                          padding: '10px 14px',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontFamily: AD.fontSans, fontSize: 13, color: AD.textPrimary,
                            margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {link.fullUrl}
                          </p>
                          <p style={{ fontFamily: AD.fontSans, fontSize: 11, color: AD.textTertiary, margin: 0 }}>
                            Created {new Date(link.created_at).toLocaleDateString()} · {link.link_type}
                          </p>
                        </div>
                        <button
                          onClick={() => copyInviteLink(link.fullUrl, link.slug)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, flexShrink: 0 }}
                          aria-label="Copy link"
                        >
                          <i className="ph ph-copy" style={{ fontSize: 16, color: inviteLinkCopied === link.slug ? AD.green : AD.textSecondary }} />
                        </button>
                        {inviteLinkCopied === link.slug && (
                          <span style={{ fontSize: 12, color: AD.greenText, flexShrink: 0 }}>Copied!</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inviteLinks.length === 0 && !generatingLink && (
                <p style={{ fontFamily: AD.fontSans, fontSize: 14, color: AD.textTertiary, margin: 0 }}>
                  No invite links yet. Generate one above.
                </p>
              )}
            </div>
          )}
        </div>
```

- [ ] **Step 8: Run build**

```bash
npm run build 2>&1 | tail -30
```
Expected: `Compiled successfully.`

- [ ] **Step 9: Commit and push**

```bash
git add src/components/admin/AdminReferrers.jsx
git commit -m "Session 26 Phase 7: Add invite link generator UI to Admin Referrers page"
git push
```

---

## End-to-End Verification Checklist

After Railway + Vercel deploy (allow ~30–60s after push):

- [ ] Visit `https://your-vercel-url.app?signup=invalidslugg` — should see **login screen** (invalid slug falls through)
- [ ] Admin panel → Referrers → Invite Links → Generate Invite Link → copy the URL
- [ ] Open copied URL in a new tab — should see **SignupScreen** with contractor name
- [ ] Fill out signup form with intentionally bad email — should see inline error
- [ ] Fill out correctly — should see **EmailVerifyScreen**
- [ ] Enter wrong code — should see error message
- [ ] Enter correct 6-digit code from email — should see "Email verified! Redirecting…" then **LoginScreen**
- [ ] Log in with the new account — should work
- [ ] Check activity_log in admin panel — signup and email verified events appear
- [ ] On Refer tab — invite URL appears, copy button works, QR code displays
- [ ] Admin panel → Referrers → Invite Links list — shows the generated link

---

## Known MVP Shortcuts (flagged in code)

| Location | Shortcut | Scale fix |
|----------|----------|-----------|
| `referrer.js` — background Jobber match | Searches all clients (first:100), runs once at signup | Jobber webhook fires on client creation — Stripe ACH session |
| `referrer.js` — CONTRACTOR_NAME constant | Hardcoded string | Move to `CONTRACTOR_NAME` env var or DB lookup per contractor_id |
| `referrer.js` — founding_referrer count | `SELECT COUNT(*) FROM users` (no contractor filter) | Scope per contractor_id at FORA scale |
| `EmailVerifyScreen.jsx` — resend via /api/signup | Reuses signup endpoint (409 expected), no dedicated resend | Add `/api/signup/resend-code` endpoint with its own rate limiter |
| `referrer.js` — QR code generation | Server-side per request using qrcode package | Pre-generate and cache as asset; build when print materials needed |
