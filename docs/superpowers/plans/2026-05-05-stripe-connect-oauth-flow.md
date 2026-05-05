# Stripe Connect OAuth Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Stripe Connect Account Links onboarding so contractors can link their Stripe account to RoofMiles, enabling ACH payouts to referrers.

**Architecture:** Five backend routes in `server/routes/stripe.js` (already mounted at `/` in `server.js`) manage the Stripe Account lifecycle. The DB stores `stripe_account_id` and `stripe_connect_status` on `contractor_settings`. `BankingSettings.jsx`'s existing static placeholder (Section 1) becomes the live Stripe Connect UI. `AdminCashOuts.jsx`'s "Approve & Transfer" button fires a transfer before marking the cashout approved.

**Tech Stack:** Node.js/Express, Stripe Node SDK (`stripe` npm), PostgreSQL (`contractor_settings` table), React (inline styles, AD tokens, Phosphor Icons)

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `package.json` | `stripe` added via npm install |
| Modify | `server/utils/retryHelpers.js` | Add `stripeShouldRetry` |
| Modify | `server/db.js` | Two `ALTER TABLE IF NOT EXISTS` lines for stripe columns |
| Replace | `server/routes/stripe.js` | All 5 routes (was 5-line placeholder) |
| Modify | `src/components/admin/BankingSettings.jsx` | Replace static Section 1 with dynamic Stripe Connect UI; add stripe state + URL param handling |
| Modify | `src/components/admin/AdminCashOuts.jsx` | New `handleStripeTransfer` handler, per-card loading + error state |

---

## Task 1: Install Stripe and add `stripeShouldRetry`

**Files:**
- Modify: `server/utils/retryHelpers.js`

- [ ] **Step 1: Install the Stripe npm package**

```bash
npm install stripe
```

Expected output: `added 1 package` (or similar). Verify `"stripe"` appears in `package.json` dependencies.

- [ ] **Step 2: Add `stripeShouldRetry` to retryHelpers.js**

Open `server/utils/retryHelpers.js`. The file currently ends at line 24 (`module.exports = ...`). Replace the file content with:

```js
const resendShouldRetry = (error) => {
  const status = error?.response?.status || error?.statusCode;
  if (!status) return true;
  if (status >= 500) return true;
  return false;
};

const twilioShouldRetry = (error) => {
  const code = error?.code;
  if (!code) return true;
  if (String(code).startsWith('2')) return true;
  return false;
};

const jobberShouldRetry = (error) => {
  const status = error?.response?.status ?? error?.status;
  if (!status) return true;
  if (status === 401) return false;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
};

const stripeShouldRetry = (error) => {
  const status = error?.statusCode || error?.status;
  if (!status) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
};

module.exports = { resendShouldRetry, twilioShouldRetry, jobberShouldRetry, stripeShouldRetry };
```

- [ ] **Step 3: Verify the file reads correctly**

```bash
node -e "const { stripeShouldRetry } = require('./server/utils/retryHelpers'); console.log(stripeShouldRetry({ statusCode: 429 }), stripeShouldRetry({ statusCode: 400 }));"
```

Expected: `true false`

- [ ] **Step 4: Commit**

```bash
git add server/utils/retryHelpers.js package.json package-lock.json
git commit -m "feat: install stripe package + add stripeShouldRetry to retryHelpers"
```

---

## Task 2: Add Stripe columns to `contractor_settings` in `db.js`

**Files:**
- Modify: `server/db.js` (lines 473–476, after the `paid_at` migration)

The file currently ends its ALTER TABLE block around line 475 with:
```js
  await pool.query(`ALTER TABLE cashout_requests ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`);
```

- [ ] **Step 1: Add the two stripe migration lines after `paid_at`**

Insert immediately after the `paid_at` line:

```js
  // ── STRIPE CONNECT ────────────────────────────────────────────────────────────
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`);
  await pool.query(`ALTER TABLE contractor_settings ADD COLUMN IF NOT EXISTS stripe_connect_status VARCHAR(20) NOT NULL DEFAULT 'not_connected'`);
```

- [ ] **Step 2: Verify the server starts cleanly**

```bash
node -e "require('./server/db').initDB().then(() => { console.log('ok'); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); })"
```

Expected: `ok` (may also print token-loaded line). If it errors, check DATABASE_URL is set or use the live Railway test — deploy and check Railway logs.

> **Note:** Local env cannot connect to Railway PostgreSQL. The migration will run on first Railway deploy. This verify step is a syntax check only; actual column creation happens on Railway.

- [ ] **Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add stripe_account_id and stripe_connect_status to contractor_settings"
```

---

## Task 3: Build Stripe backend routes (Routes 1–4)

**Files:**
- Replace: `server/routes/stripe.js`

Imports needed:
- `express`, `stripe` (npm), `{ pool }` from `'../db'`, `{ verifyAdminSession }` from `'../middleware/auth'`, `{ logError }` from `'../middleware/errorLogger'`, `{ retryWithBackoff }` from `'../utils/retryWithBackoff'`, `{ stripeShouldRetry }` from `'../utils/retryHelpers'`

The contractor_id is hardcoded as `'accent-roofing'` (MVP — pull from session when second contractor onboards).

- [ ] **Step 1: Write Routes 1–4 in stripe.js**

Replace the entire file with:

```js
const express = require('express');
const Stripe = require('stripe');
const { pool } = require('../db');
const { verifyAdminSession } = require('../middleware/auth');
const { logError } = require('../middleware/errorLogger');
const { retryWithBackoff } = require('../utils/retryWithBackoff');
const { stripeShouldRetry } = require('../utils/retryHelpers');

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const CONTRACTOR_ID = 'accent-roofing'; // MVP: pull from session at multi-contractor scale

// ── helpers ───────────────────────────────────────────────────────────────────

async function getStripeRow() {
  const r = await pool.query(
    'SELECT stripe_account_id, stripe_connect_status FROM contractor_settings WHERE contractor_id = $1',
    [CONTRACTOR_ID]
  );
  return r.rows[0] || { stripe_account_id: null, stripe_connect_status: 'not_connected' };
}

async function upsertStripeAccount(stripeAccountId, status) {
  await pool.query(
    `INSERT INTO contractor_settings (contractor_id, stripe_account_id, stripe_connect_status)
     VALUES ($1, $2, $3)
     ON CONFLICT (contractor_id) DO UPDATE
       SET stripe_account_id = $2, stripe_connect_status = $3, updated_at = NOW()`,
    [CONTRACTOR_ID, stripeAccountId, status]
  );
}

// ── Route 1: POST /api/admin/stripe/create-account-link ───────────────────────

router.post('/api/admin/stripe/create-account-link', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const row = await getStripeRow();
    let stripeAccountId = row.stripe_account_id;

    if (!stripeAccountId) {
      const account = await retryWithBackoff(
        () => stripe.accounts.create({ type: 'standard' }),
        { retries: 2, shouldRetry: stripeShouldRetry }
      );
      stripeAccountId = account.id;
      await upsertStripeAccount(stripeAccountId, 'pending');
    }

    const frontendUrl = process.env.FRONTEND_URL || '';
    const accountLink = await retryWithBackoff(
      () => stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${frontendUrl}/admin/banking?stripe_connect=refresh`,
        return_url: `${frontendUrl}/admin/banking?stripe_connect=success`,
        type: 'account_onboarding',
      }),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );

    res.json({ url: accountLink.url });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to create Stripe account link' });
  }
});

// ── Route 2: POST /api/admin/stripe/confirm-connection ────────────────────────

router.post('/api/admin/stripe/confirm-connection', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const row = await getStripeRow();
    if (!row.stripe_account_id) {
      return res.status(400).json({ error: 'No Stripe account linked' });
    }

    const account = await retryWithBackoff(
      () => stripe.accounts.retrieve(row.stripe_account_id),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );

    const status = (account.charges_enabled && account.payouts_enabled) ? 'active' : 'pending';
    await pool.query(
      `UPDATE contractor_settings SET stripe_connect_status = $1, updated_at = NOW() WHERE contractor_id = $2`,
      [status, CONTRACTOR_ID]
    );

    res.json({
      status,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to confirm Stripe connection' });
  }
});

// ── Route 3: GET /api/admin/stripe/connection-status ─────────────────────────

router.get('/api/admin/stripe/connection-status', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const row = await getStripeRow();
    const maskedId = row.stripe_account_id
      ? `...${row.stripe_account_id.slice(-6)}`
      : null;
    res.json({
      stripe_account_id_masked: maskedId,
      stripe_connect_status: row.stripe_connect_status || 'not_connected',
    });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to fetch Stripe connection status' });
  }
});

// ── Route 4: POST /api/admin/stripe/disconnect ────────────────────────────────

router.post('/api/admin/stripe/disconnect', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    await pool.query(
      `UPDATE contractor_settings
         SET stripe_account_id = NULL, stripe_connect_status = 'not_connected', updated_at = NOW()
       WHERE contractor_id = $1`,
      [CONTRACTOR_ID]
    );
    res.json({ success: true });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Failed to disconnect Stripe account' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Verify the server loads without syntax errors**

```bash
node -e "require('./server/routes/stripe'); console.log('stripe routes loaded ok');"
```

Expected: `stripe routes loaded ok`

- [ ] **Step 3: Commit**

```bash
git add server/routes/stripe.js
git commit -m "feat: Stripe Connect routes 1-4 (create-account-link, confirm, status, disconnect)"
```

---

## Task 4: Add Route 5 — ACH Transfer

**Files:**
- Modify: `server/routes/stripe.js` (append before `module.exports`)

- [ ] **Step 1: Add Route 5 before `module.exports = router`**

Insert this block immediately before the `module.exports = router;` line at the bottom of `server/routes/stripe.js`:

```js
// ── Route 5: POST /api/admin/stripe/transfer ──────────────────────────────────

router.post('/api/admin/stripe/transfer', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const { cashout_request_id, amount_cents } = req.body;

    if (!cashout_request_id || !amount_cents) {
      return res.status(400).json({ error: 'cashout_request_id and amount_cents are required' });
    }

    const destinationAccountId = process.env.STRIPE_TEST_ACCOUNT_ID || null;

    if (!destinationAccountId) {
      return res.status(422).json({
        error: 'no_destination_account',
        message: 'Referrer does not have a connected Stripe account yet.',
      });
    }

    const transfer = await retryWithBackoff(
      () => stripe.transfers.create({
        amount: amount_cents,
        currency: 'usd',
        destination: destinationAccountId,
      }),
      { retries: 2, shouldRetry: stripeShouldRetry }
    );

    await pool.query(
      `INSERT INTO activity_log (event_type, detail, created_at)
       VALUES ('stripe_transfer', $1, NOW())`,
      [`Transfer ${transfer.id} for cashout #${cashout_request_id} — $${(amount_cents / 100).toFixed(2)}`]
    );

    res.json({ success: true, transfer_id: transfer.id });
  } catch (err) {
    await logError({ req, error: err });
    res.status(500).json({ error: 'Stripe transfer failed', message: err.message });
  }
});
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('./server/routes/stripe'); console.log('all 5 stripe routes loaded ok');"
```

Expected: `all 5 stripe routes loaded ok`

- [ ] **Step 3: Commit**

```bash
git add server/routes/stripe.js
git commit -m "feat: Stripe transfer route (Route 5) with activity log"
```

---

## Task 5: Update `BankingSettings.jsx` — Stripe Connect UI

**Files:**
- Modify: `src/components/admin/BankingSettings.jsx`

The existing "Section 1: Stripe Account" (lines 156–175) is a static placeholder. Replace it with the full dynamic Stripe Connect section. The rest of the file (Payout Automation, Payout Methods) stays untouched.

- [ ] **Step 1: Add stripe state variables after existing state declarations**

The existing state block ends around line 44 (`lastEnabledError`). Add new stripe state after it:

```js
  const [stripeStatus, setStripeStatus]       = useState('not_connected');
  const [stripeAccountId, setStripeAccountId] = useState(null);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeConfirming, setStripeConfirming] = useState(false);
  const [stripeBanner, setStripeBanner]         = useState(null); // { type: 'success'|'warning', text }
  const [stripeDisconnecting, setStripeDisconnecting] = useState(false);
```

- [ ] **Step 2: Extend the `fetchSettings` useEffect to also load Stripe status and handle URL params**

The existing useEffect (lines 46–70) calls `fetchSettings()`. Replace the entire useEffect with this version that adds Stripe status fetching and URL param handling:

```js
  useEffect(() => {
    async function fetchSettings() {
      try {
        const [autoRes, methodsRes, stripeRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/admin/payout-automation`, {
            headers: { 'Authorization': `Bearer ${adminToken()}` },
          }),
          fetch(`${BACKEND_URL}/api/admin/payout-methods`, {
            headers: { 'Authorization': `Bearer ${adminToken()}` },
          }),
          fetch(`${BACKEND_URL}/api/admin/stripe/connection-status`, {
            headers: { 'Authorization': `Bearer ${adminToken()}` },
          }),
        ]);
        const autoData    = await autoRes.json();
        const methodsData = await methodsRes.json();
        const stripeData  = stripeRes.ok ? await stripeRes.json() : {};
        setAutomation(autoData.payout_automation || 'manual_all');
        setThreshold(autoData.payout_review_threshold != null ? String(autoData.payout_review_threshold) : '');
        setMethods(methodsData.enabled_payout_methods || ['stripe_ach', 'check', 'venmo', 'zelle']);
        setStripeStatus(stripeData.stripe_connect_status || 'not_connected');
        setStripeAccountId(stripeData.stripe_account_id_masked || null);
      } catch {
        // silent — defaults remain in place
      } finally {
        setInitLoading(false);
      }
    }

    async function handleStripeUrlParam() {
      const params = new URLSearchParams(window.location.search);
      const stripeParam = params.get('stripe_connect');
      if (!stripeParam) return;

      // Clean the URL param immediately
      const clean = new URL(window.location.href);
      clean.searchParams.delete('stripe_connect');
      window.history.replaceState({}, '', clean.toString());

      if (stripeParam === 'success') {
        setStripeConfirming(true);
        try {
          const r = await fetch(`${BACKEND_URL}/api/admin/stripe/confirm-connection`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken()}` },
          });
          const d = await r.json();
          if (r.ok) {
            setStripeStatus(d.status);
            setStripeBanner({ type: 'success', text: 'Stripe account connected successfully!' });
            setTimeout(() => setStripeBanner(null), 4000);
          }
        } catch {
          // silent
        } finally {
          setStripeConfirming(false);
        }
      } else if (stripeParam === 'cancelled') {
        setStripeBanner({ type: 'warning', text: 'Stripe connection cancelled — you can connect anytime.' });
        setTimeout(() => setStripeBanner(null), 4000);
      } else if (stripeParam === 'refresh') {
        // Link expired — get a fresh one and redirect transparently
        try {
          const r = await fetch(`${BACKEND_URL}/api/admin/stripe/create-account-link`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken()}` },
          });
          const d = await r.json();
          if (r.ok && d.url) window.location.href = d.url;
        } catch {
          // silent — user stays on page
        }
      }
    }

    handleStripeUrlParam();
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 3: Add `handleStripeConnect` and `handleStripeDisconnect` functions**

Add these two functions after `handleMethodToggle` (around line 137):

```js
  async function handleStripeConnect() {
    setStripeConnecting(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/stripe/create-account-link`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken()}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to start Stripe onboarding');
      window.location.href = d.url;
    } catch (err) {
      setStripeBanner({ type: 'warning', text: err.message || 'Failed to connect Stripe' });
      setTimeout(() => setStripeBanner(null), 4000);
      setStripeConnecting(false);
    }
  }

  async function handleStripeDisconnect() {
    if (!window.confirm('Disconnect your Stripe account? ACH payouts will be disabled.')) return;
    setStripeDisconnecting(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/admin/stripe/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken()}` },
      });
      if (!r.ok) throw new Error('Disconnect failed');
      setStripeStatus('not_connected');
      setStripeAccountId(null);
    } catch (err) {
      setStripeBanner({ type: 'warning', text: err.message || 'Disconnect failed' });
      setTimeout(() => setStripeBanner(null), 4000);
    } finally {
      setStripeDisconnecting(false);
    }
  }
```

- [ ] **Step 4: Replace Section 1 (static placeholder) with the dynamic Stripe Connect UI**

Find and replace the existing static Section 1 block (lines 156–175 in the original file — the block from `{/* ── Section 1: Stripe Account ── */}` to the closing `</div>` before the divider):

Replace this entire block:
```jsx
      {/* ── Section 1: Stripe Account ── */}
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
        Stripe Account
      </h2>
      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <i className="ph ph-credit-card" style={{ fontSize: 18, color: AD.textTertiary, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: AD.textSecondary, fontFamily: AD.fontSans }}>Connection Status</span>
        </div>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: AD.radiusPill,
          background: AD.bgCardTint, border: `1px solid ${AD.border}`,
          color: AD.textSecondary, fontSize: 12, fontFamily: AD.fontSans, marginBottom: 14,
        }}>
          Not Connected
        </span>
        <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
          Stripe Connect setup will be available in a future update. Once connected, approved Stripe ACH cashout requests will be transferred automatically to your referrers' bank accounts.
        </p>
      </div>
```

With this dynamic version:
```jsx
      {/* ── Section 1: Stripe Connect ── */}
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
        Stripe Connect
      </h2>

      {/* Banner */}
      {stripeBanner && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: AD.radiusMd,
          background: stripeBanner.type === 'success' ? AD.greenBg : AD.amberBg,
          border: `1px solid ${stripeBanner.type === 'success' ? AD.green : AD.amber}`,
          color: stripeBanner.type === 'success' ? AD.greenText : AD.amberText,
          fontSize: 13, fontFamily: AD.fontSans, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <i className={`ph ${stripeBanner.type === 'success' ? 'ph-check-circle' : 'ph-warning'}`} style={{ fontSize: 16 }} />
          {stripeBanner.text}
        </div>
      )}

      <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: AD.radiusLg, padding: '20px 22px' }}>

        {/* Not connected */}
        {stripeStatus === 'not_connected' && (
          <>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
              Connect your Stripe account to enable automatic ACH payouts for referrers who choose Stripe ACH.
            </p>
            <button
              onClick={handleStripeConnect}
              disabled={stripeConnecting || stripeConfirming}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: AD.radiusMd, border: 'none',
                background: stripeConnecting ? AD.bgCardTint : AD.navy,
                color: stripeConnecting ? AD.textSecondary : '#fff',
                fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
                cursor: stripeConnecting ? 'not-allowed' : 'pointer',
              }}
            >
              <i className="ph ph-plugs" style={{ fontSize: 16 }} />
              {stripeConnecting ? 'Connecting…' : 'Connect Stripe'}
            </button>
          </>
        )}

        {/* Pending */}
        {stripeStatus === 'pending' && (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: AD.radiusPill, background: AD.amberBg, border: `1px solid ${AD.amber}`, marginBottom: 14 }}>
              <i className="ph ph-clock" style={{ fontSize: 14, color: AD.amberText }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: AD.amberText, fontFamily: AD.fontSans }}>Stripe Connection Pending</span>
            </div>
            {stripeAccountId && (
              <p style={{ margin: '0 0 8px', fontSize: 12, color: AD.textTertiary, fontFamily: "'Roboto Mono', monospace" }}>
                Account: {stripeAccountId}
              </p>
            )}
            <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
              Complete your Stripe onboarding to activate ACH payouts.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={handleStripeConnect}
                disabled={stripeConnecting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: AD.radiusMd, border: 'none',
                  background: stripeConnecting ? AD.bgCardTint : AD.navy,
                  color: stripeConnecting ? AD.textSecondary : '#fff',
                  fontSize: 14, fontWeight: 500, fontFamily: AD.fontSans,
                  cursor: stripeConnecting ? 'not-allowed' : 'pointer',
                }}
              >
                <i className="ph ph-plugs" style={{ fontSize: 16 }} />
                {stripeConnecting ? 'Loading…' : 'Resume Onboarding'}
              </button>
              <button
                onClick={handleStripeDisconnect}
                disabled={stripeDisconnecting}
                style={{
                  padding: '8px 14px', borderRadius: AD.radiusMd,
                  border: `1px solid ${AD.border}`, background: 'transparent',
                  color: AD.textSecondary, fontSize: 13, fontFamily: AD.fontSans,
                  cursor: stripeDisconnecting ? 'not-allowed' : 'pointer',
                }}
              >
                {stripeDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </>
        )}

        {/* Active */}
        {stripeStatus === 'active' && (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: AD.radiusPill, background: AD.greenBg, border: `1px solid ${AD.green}`, marginBottom: 14 }}>
              <i className="ph ph-check-circle" style={{ fontSize: 14, color: AD.greenText }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: AD.greenText, fontFamily: AD.fontSans }}>Stripe Connected</span>
            </div>
            {stripeAccountId && (
              <p style={{ margin: '0 0 8px', fontSize: 12, color: AD.textTertiary, fontFamily: "'Roboto Mono', monospace" }}>
                Account: {stripeAccountId}
              </p>
            )}
            <p style={{ margin: '0 0 16px', fontSize: 13, color: AD.textSecondary, fontFamily: AD.fontSans, lineHeight: 1.6 }}>
              ACH payouts are active. Referrers can be paid automatically via Stripe.
            </p>
            <button
              onClick={handleStripeDisconnect}
              disabled={stripeDisconnecting}
              style={{
                padding: '8px 14px', borderRadius: AD.radiusMd,
                border: `1px solid ${AD.border}`, background: 'transparent',
                color: AD.textSecondary, fontSize: 13, fontFamily: AD.fontSans,
                cursor: stripeDisconnecting ? 'not-allowed' : 'pointer',
              }}
            >
              {stripeDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </>
        )}

      </div>
```

- [ ] **Step 5: Verify no build errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: `Compiled successfully.` — fix any lint/import errors if they appear.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/BankingSettings.jsx
git commit -m "feat: dynamic Stripe Connect UI in BankingSettings (not_connected/pending/active states)"
```

---

## Task 6: Update `AdminCashOuts.jsx` — Stripe ACH transfer before approve

**Files:**
- Modify: `src/components/admin/AdminCashOuts.jsx`

The current `handleAction` is a shared function for all cashout actions. The Stripe ACH "Approve & Transfer" button needs its own handler that fires the transfer route first, shows an inline error on failure, and only then calls the approve endpoint.

- [ ] **Step 1: Add per-card transfer state after existing state declarations**

The existing state block ends around line 38 (`filter`). Add:

```js
  const [transferringId, setTransferringId] = useState(null);
  const [transferErrors, setTransferErrors] = useState({});
```

- [ ] **Step 2: Add `handleStripeTransfer` function after the existing `handleAction` function (around line 69)**

```js
  const handleStripeTransfer = safeAsync(async (c) => {
    if (!window.confirm('Approve and send Stripe ACH transfer?')) return;
    setTransferringId(c.id);
    setTransferErrors(prev => ({ ...prev, [c.id]: null }));
    try {
      const amountCents = Math.round(parseFloat(c.amount) * 100);
      const transferRes = await fetch(`${BACKEND_URL}/api/admin/stripe/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
        body: JSON.stringify({ cashout_request_id: c.id, amount_cents: amountCents }),
      });
      if (transferRes.status === 401) { on401(); return; }
      const transferData = await transferRes.json();
      if (!transferRes.ok) {
        const msg = transferData.message || transferData.error || 'Transfer failed';
        setTransferErrors(prev => ({ ...prev, [c.id]: msg }));
        return;
      }
      // Transfer succeeded — now update cashout status to approved
      const approveRes = await fetch(`${BACKEND_URL}/api/admin/cashouts/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (approveRes.status === 401) { on401(); return; }
      load();
    } catch {
      setTransferErrors(prev => ({ ...prev, [c.id]: 'Unexpected error during transfer' }));
    } finally {
      setTransferringId(null);
    }
  }, 'AdminCashOuts');
```

- [ ] **Step 3: Update the Stripe ACH button in `renderActions` to use the new handler**

Find the `isStripeACH` block in `renderActions` (lines 77–89 in the original). Replace:

```jsx
      if (isStripeACH) {
        return (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => handleAction(c.id, 'approved')} variant="success">
                <i className="ph ph-bank" /> Approve & Transfer
              </Btn>
              <Btn onClick={() => handleAction(c.id, 'denied')} variant="danger">
                <i className="ph ph-x" /> Deny
              </Btn>
            </div>
            {/* TODO: wire Stripe ACH transfer here after Stripe Connect registration — approval currently sets status to 'approved' only */}
            <p style={noteStyle}>Stripe ACH transfer will fire automatically upon approval.</p>
          </div>
        );
      }
```

With:

```jsx
      if (isStripeACH) {
        const isTransferring = transferringId === c.id;
        const transferError = transferErrors[c.id];
        return (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => !isTransferring && handleStripeTransfer(c)} variant="success" disabled={isTransferring}>
                <i className="ph ph-bank" /> {isTransferring ? 'Transferring…' : 'Approve & Transfer'}
              </Btn>
              <Btn onClick={() => handleAction(c.id, 'denied')} variant="danger" disabled={isTransferring}>
                <i className="ph ph-x" /> Deny
              </Btn>
            </div>
            {transferError && (
              <p style={{ ...noteStyle, color: AD.red2Text, marginTop: 8 }}>
                <i className="ph ph-warning-circle" style={{ marginRight: 4 }} />
                {transferError}
              </p>
            )}
            {!transferError && (
              <p style={noteStyle}>Stripe ACH transfer fires before approval is recorded.</p>
            )}
          </div>
        );
      }
```

- [ ] **Step 4: Verify no build errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: `Compiled successfully.`

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminCashOuts.jsx
git commit -m "feat: Stripe ACH transfer fires before cashout approval in AdminCashOuts"
```

---

## Task 7: Deploy and verify on Railway/Vercel

- [ ] **Step 1: Push all commits**

```bash
git push
```

Railway auto-deploys on push (~30s). Check Railway logs for:
- `Token loaded from database` or `No token found` — confirms `initDB()` ran cleanly
- No migration errors on `stripe_account_id`/`stripe_connect_status` columns

- [ ] **Step 2: Verify Stripe columns in Railway DB**

In Railway's database console (or Postgres client):
```sql
SELECT stripe_account_id, stripe_connect_status FROM contractor_settings WHERE contractor_id = 'accent-roofing';
```
Expected: row returned with `stripe_account_id = NULL` and `stripe_connect_status = 'not_connected'` (or the row may not exist yet — that's fine, it gets created on first upsert).

- [ ] **Step 3: Banking Settings loads without errors**

Open `?admin=true` → Banking Settings. Verify:
- Stripe Connect section renders (not the old static placeholder)
- Status shows "not connected" with "Connect Stripe" button
- No console errors

- [ ] **Step 4: Test Connect Stripe button**

Click "Connect Stripe". Verify:
- Network call to `/api/admin/stripe/create-account-link` returns 200 with a URL
- Browser redirects to Stripe hosted onboarding page

- [ ] **Step 5: Complete Stripe sandbox onboarding**

Complete the onboarding flow in Stripe's sandbox. Verify:
- Browser redirects back to `/admin/banking?stripe_connect=success`
- Success banner appears: "Stripe account connected successfully!"
- Banner auto-clears after 4 seconds
- Status badge updates to "Stripe Connection Pending" or "Stripe Connected"

- [ ] **Step 6: Test ACH transfer on AdminCashOuts**

Seed a `stripe_ach` cashout request (or use an existing pending one). In Admin → Cash Outs:
- Verify "Approve & Transfer" button shows loading state while in flight
- Verify transfer appears in Stripe sandbox dashboard
- Verify activity_log entry is created (check Railway DB: `SELECT * FROM activity_log ORDER BY id DESC LIMIT 5`)
- Verify cashout status updates to "approved"

- [ ] **Step 7: Test Disconnect**

Click "Disconnect" on the active/pending Stripe section. Verify:
- Confirmation dialog appears
- Status reverts to "not connected"
- `contractor_settings` row shows `stripe_account_id = NULL` and `stripe_connect_status = 'not_connected'`

- [ ] **Step 8: Final commit message (if any cleanup needed)**

```bash
git add -A
git commit -m "feat: Stripe Connect OAuth flow, account link onboarding, ACH transfer trigger"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in task |
|-----------------|-----------------|
| DB columns stripe_account_id + stripe_connect_status | Task 2 |
| Route 1: create-account-link | Task 3 |
| Route 2: confirm-connection | Task 3 |
| Route 3: connection-status (masked) | Task 3 |
| Route 4: disconnect (local clear only) | Task 3 |
| Route 5: transfer with STRIPE_TEST_ACCOUNT_ID | Task 4 |
| Activity log for transfer | Task 4 |
| BankingSettings: load status on mount | Task 5 |
| BankingSettings: not_connected state + Connect button | Task 5 |
| BankingSettings: pending state + Resume + Disconnect | Task 5 |
| BankingSettings: active state + Disconnect | Task 5 |
| ?stripe_connect=success → confirm + banner | Task 5 |
| ?stripe_connect=cancelled → banner | Task 5 |
| ?stripe_connect=refresh → transparent redirect | Task 5 |
| URL param cleanup via history.replaceState | Task 5 |
| Approve & Transfer: loading state | Task 6 |
| Approve & Transfer: inline error on failure | Task 6 |
| Approve & Transfer: approve only on transfer success | Task 6 |
| stripeShouldRetry for all Stripe API calls | Task 1 |
| no_destination_account error when STRIPE_TEST_ACCOUNT_ID absent | Task 4 |

All spec requirements covered. No gaps found.

**Placeholder scan:** No TBD/TODO/placeholder language in any code step. All code blocks are complete and ready to paste.

**Type consistency:** `stripe_connect_status` (snake_case) used consistently in DB, backend responses, and frontend state. `stripeStatus` (camelCase) is the React state variable — distinct and consistent. `stripe_account_id_masked` is the API field name, `stripeAccountId` is the React state — no collision.
