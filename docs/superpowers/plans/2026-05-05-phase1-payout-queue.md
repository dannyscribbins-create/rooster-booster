# Phase 1 — Payout Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Referral Payouts" tab to the AdminCashOuts page that shows all referral_conversions rows with payout_status = 'pending_review' and lets the admin approve or deny each one.

**Architecture:** DB migration adds `job_type TEXT` to `referral_conversions`. Two new admin routes (GET list, PATCH action) sit in admin.js alongside the existing cashout routes. AdminCashOuts.jsx grows a top-level tab toggle — default tab shows all existing cashout content untouched; second tab lazy-fetches and renders the payout queue with per-row approve/deny.

**Tech Stack:** Node.js/Express (backend), PostgreSQL via `pool` from `server/db.js`, React (frontend), inline styles using `AD` tokens from `src/constants/adminTheme.js`, Phosphor Icons v2.1.1.

---

## Files Touched

| File | Action | What changes |
|------|--------|--------------|
| `server/db.js` | Modify | Add one `ALTER TABLE` migration at end of `initDB()` |
| `server/routes/admin.js` | Modify | Add two routes after the existing cashout block (~line 292) |
| `src/components/admin/AdminCashOuts.jsx` | Modify | Add tab nav + Referral Payouts tab; all existing code preserved |

---

## Task 1 — DB Migration: add `job_type` to `referral_conversions`

**Files:**
- Modify: `server/db.js` (end of `initDB()`, after line ~663)

**Context:** `referral_conversions` was created without a `job_type` column. The spec requires it in the payout queue response. This migration adds the column safely — existing rows will be null, shown as `—` in the UI. Populating it at INSERT time is deferred to a later session.

- [ ] **Step 1: Read `server/db.js` lines 655–664 to confirm the last migration before `module.exports`**

  Verify the file ends like this (line numbers approximate):
  ```
  ...last ALTER TABLE or pool.query call...
  }
  module.exports = { pool, initDB };
  ```

- [ ] **Step 2: Add the migration**

  In `server/db.js`, find the closing `}` of `initDB()` just before `module.exports`. Add this line immediately before that closing brace:

  ```js
    // job_type captured at conversion time — null for rows created before Session 49
    await pool.query(`ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS job_type TEXT`);
  ```

  The result at the end of `initDB()` should look like:
  ```js
    // job_type captured at conversion time — null for rows created before Session 49
    await pool.query(`ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS job_type TEXT`);
  }

  module.exports = { pool, initDB };
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add server/db.js
  git commit -m "feat: add job_type column to referral_conversions"
  ```

---

## Task 2 — Backend: `GET /api/admin/payout-queue`

**Files:**
- Modify: `server/routes/admin.js` — insert after the `PATCH /api/admin/cashouts/:id` route block, which ends around line 292

**Context:** `verifyAdminSession()` returns a boolean and handles 401 automatically — it does NOT return a contractor_id. All admin routes in this file hardcode `contractor_id = 'accent-roofing'` with a TODO comment. Follow that exact pattern. The JOIN to `pipeline_cache` uses both `jobber_client_id` AND `contractor_id` to avoid cross-contractor collisions.

- [ ] **Step 1: Read `server/routes/admin.js` lines 234–295 to confirm the exact insertion point**

  Verify the cashout block ends with:
  ```js
  // ── ADMIN: ACTIVITY LOG ───...
  router.get('/api/admin/activity', ...
  ```
  The new payout-queue routes will be inserted as a new section between `ADMIN: CASH OUTS` and `ADMIN: ACTIVITY LOG`.

- [ ] **Step 2: Add the GET route**

  Insert the following block immediately after the closing `});` of `PATCH /api/admin/cashouts/:id` (around line 292), before the `// ── ADMIN: ACTIVITY LOG` comment:

  ```js
  // ── ADMIN: PAYOUT QUEUE ───────────────────────────────────────────────────────
  router.get('/api/admin/payout-queue', async (req, res) => {
    if (!await verifyAdminSession(req, res)) return;
    // TODO: pull contractorId from admin session token when multi-contractor is live
    const contractorId = 'accent-roofing';
    try {
      const result = await pool.query(`
        SELECT
          rc.id,
          u.full_name  AS referrer_name,
          u.email      AS referrer_email,
          pc.client_name AS referred_client_name,
          rc.job_type,
          rc.bonus_amount,
          rc.converted_at,
          rc.payout_status
        FROM referral_conversions rc
        JOIN users u ON u.id = rc.user_id
        LEFT JOIN pipeline_cache pc
          ON  pc.jobber_client_id = rc.jobber_client_id
          AND pc.contractor_id    = rc.contractor_id
        WHERE rc.payout_status = 'pending_review'
          AND rc.contractor_id  = $1
        ORDER BY rc.converted_at DESC
      `, [contractorId]);
      res.json(result.rows);
    } catch (err) {
      await logError({ req, error: err });
      res.status(500).json({ error: err.message });
    }
  });
  ```

- [ ] **Step 3: Verify the route compiles — start the server locally**

  ```bash
  node server.js
  ```
  Expected: server starts on port 4000 with no syntax errors. Ctrl+C to stop.

- [ ] **Step 4: Commit**

  ```bash
  git add server/routes/admin.js
  git commit -m "feat: GET /api/admin/payout-queue — list pending referral conversions"
  ```

---

## Task 3 — Backend: `PATCH /api/admin/payout-queue/:id`

**Files:**
- Modify: `server/routes/admin.js` — insert immediately after the GET route added in Task 2

**Context:** The WHERE clause scopes the update to `payout_status = 'pending_review'` — if 0 rows are updated, the row was already processed (or belongs to a different contractor). Return 404 in that case. No transaction needed — this is a single-row status flip with no side-effects in this session.

- [ ] **Step 1: Add the PATCH route**

  Insert immediately after the closing `});` of the GET route added in Task 2:

  ```js
  router.patch('/api/admin/payout-queue/:id', async (req, res) => {
    if (!await verifyAdminSession(req, res)) return;
    // TODO: pull contractorId from admin session token when multi-contractor is live
    const contractorId = 'accent-roofing';
    const { action } = req.body;
    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "deny"' });
    }
    const newStatus = action === 'approve' ? 'approved' : 'denied';
    try {
      const result = await pool.query(
        `UPDATE referral_conversions
         SET payout_status = $1
         WHERE id             = $2
           AND contractor_id  = $3
           AND payout_status  = 'pending_review'
         RETURNING id, payout_status, bonus_amount, converted_at, job_type`,
        [newStatus, req.params.id, contractorId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Conversion not found or already processed' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      await logError({ req, error: err });
      res.status(500).json({ error: err.message });
    }
  });
  ```

- [ ] **Step 2: Verify the server still starts**

  ```bash
  node server.js
  ```
  Expected: starts on port 4000, no errors. Ctrl+C.

- [ ] **Step 3: Commit**

  ```bash
  git add server/routes/admin.js
  git commit -m "feat: PATCH /api/admin/payout-queue/:id — approve or deny referral conversion"
  ```

---

## Task 4 — Frontend: AdminCashOuts.jsx — tab nav + Referral Payouts tab

**Files:**
- Modify: `src/components/admin/AdminCashOuts.jsx` (currently 111 lines — full rewrite)

**Context:** The existing 111-line file is the source of truth — all existing state, useEffect, and `handleAction` logic must be preserved byte-for-byte. The only structural change is wrapping the existing filter pill + card list in `{activeTab === 'cashouts' && ...}`. New state added above existing state declarations. `handlePayoutAction` is a plain `async function` (not `safeAsync`) because we need fine-grained per-row error state.

The `@keyframes spin` style tag already exists in `AdminSettings.jsx` but is scoped to that component's render. Add it to this file's Referral Payouts tab render so the spinner works independently.

- [ ] **Step 1: Read `src/components/admin/AdminCashOuts.jsx` in full to confirm current state**

  Confirm the file is exactly 111 lines ending with `}` and `export default function AdminCashOuts`.

- [ ] **Step 2: Replace the full file contents**

  Write the following as the complete new file:

  ```jsx
  import { useState, useEffect } from 'react';
  import { AD } from '../../constants/adminTheme';
  import { BACKEND_URL } from '../../config/contractor';
  import { AdminPageHeader, Badge, Btn } from './AdminComponents';
  import Skeleton from '../shared/Skeleton';
  import { safeAsync } from '../../utils/clientErrorReporter';

  export default function AdminCashOuts({ setLoggedIn }) {
    const adminToken = () => sessionStorage.getItem('rb_admin_token');
    const on401 = () => { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); };

    // ── Cashout Requests state ──────────────────────────────────────────────────
    const [cashouts, setCashouts] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [filter, setFilter]     = useState('all');

    // ── Tab + Referral Payouts state ────────────────────────────────────────────
    const [activeTab, setActiveTab]                     = useState('cashouts');
    const [payoutQueue, setPayoutQueue]                 = useState([]);
    const [payoutLoading, setPayoutLoading]             = useState(false);
    const [payoutError, setPayoutError]                 = useState(null);
    const [payoutFetched, setPayoutFetched]             = useState(false);
    const [payoutActionLoading, setPayoutActionLoading] = useState({});
    const [payoutActionError, setPayoutActionError]     = useState({});

    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/cashouts`, { headers: { 'Authorization': `Bearer ${adminToken()}` } });
        if (r.status === 401) { on401(); return; }
        const d = await r.json();
        setCashouts(Array.isArray(d) ? d : []);
        setLoading(false);
      } catch {
        // no-op: preserves original behavior where setLoading stays true on error
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, []);

    async function loadPayoutQueue() {
      setPayoutLoading(true);
      setPayoutError(null);
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/payout-queue`, { headers: { 'Authorization': `Bearer ${adminToken()}` } });
        if (r.status === 401) { on401(); return; }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to load payout queue');
        setPayoutQueue(Array.isArray(d) ? d : []);
        setPayoutFetched(true);
      } catch (err) {
        setPayoutError(err.message || 'Failed to load payout queue');
      } finally {
        setPayoutLoading(false);
      }
    }

    function handleTabChange(tab) {
      setActiveTab(tab);
      if (tab === 'payouts' && !payoutFetched) loadPayoutQueue();
    }

    const handleAction = safeAsync(async (id, status) => {
      if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Deny'} this request?`)) return;
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/cashouts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
          body: JSON.stringify({ status }),
        });
        if (r.status === 401) { on401(); return; }
        const d = await r.json();
        if (d.error) alert(d.error); else load();
      } catch {
        // swallow
      }
    }, 'AdminCashOuts');

    async function handlePayoutAction(id, action) {
      setPayoutActionLoading(prev => ({ ...prev, [id]: action }));
      setPayoutActionError(prev => { const next = { ...prev }; delete next[id]; return next; });
      try {
        const r = await fetch(`${BACKEND_URL}/api/admin/payout-queue/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken()}` },
          body: JSON.stringify({ action }),
        });
        if (r.status === 401) { on401(); return; }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Action failed');
        setPayoutQueue(prev => prev.filter(row => row.id !== id));
      } catch (err) {
        setPayoutActionError(prev => ({ ...prev, [id]: err.message || 'Action failed' }));
      } finally {
        setPayoutActionLoading(prev => { const next = { ...prev }; delete next[id]; return next; });
      }
    }

    const filtered     = filter === 'all' ? cashouts : cashouts.filter(c => c.status === filter);
    const pendingCount = cashouts.filter(c => c.status === 'pending').length;
    const badgeType    = { pending: 'warning', approved: 'success', denied: 'danger' };

    return (
      <>
        <AdminPageHeader title="Cash Outs" subtitle={pendingCount > 0 ? `${pendingCount} pending review` : 'All requests reviewed'} />

        {/* ── Top-level tab navigation ── */}
        <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
          {[
            { id: 'cashouts', label: 'Cashout Requests' },
            { id: 'payouts',  label: 'Referral Payouts'  },
          ].map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeTab === t.id ? AD.bgSurface : 'transparent', color: activeTab === t.id ? AD.textPrimary : AD.textSecondary, fontSize: 12, fontWeight: activeTab === t.id ? 600 : 400, fontFamily: AD.fontSans, boxShadow: activeTab === t.id ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Cashout Requests tab ── */}
        {activeTab === 'cashouts' && (
          <>
            <div style={{ display: 'flex', gap: 4, background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', boxShadow: AD.shadowSm }}>
              {['all', 'pending', 'approved', 'denied'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filter === f ? AD.bgSurface : 'transparent', color: filter === f ? AD.textPrimary : AD.textSecondary, fontSize: 12, fontWeight: filter === f ? 600 : 400, fontFamily: AD.fontSans, textTransform: 'capitalize', boxShadow: filter === f ? AD.shadowSm : 'none', transition: 'background 0.15s, color 0.15s, box-shadow 0.15s' }}>
                  {f}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                </button>
              ))}
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2].map(i => <Skeleton key={i} height="120px" borderRadius="16px" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '32px', textAlign: 'center' }}>
                <i className="ph ph-check-circle" style={{ fontSize: 32, color: AD.greenText, display: 'block', marginBottom: 8 }} />
                <p style={{ color: AD.textSecondary, fontSize: 15, margin: 0 }}>No {filter === 'all' ? '' : filter} requests.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(c => (
                  <div key={c.id} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: AD.shadowSm }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                          {c.full_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>{c.full_name}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{c.email}</p>
                        </div>
                      </div>
                      <Badge type={badgeType[c.status] || 'neutral'}>{c.status}</Badge>
                    </div>
                    <div style={{ display: 'flex', gap: 28, marginBottom: c.status === 'pending' ? 16 : 0 }}>
                      {[
                        { label: 'Amount',    val: `$${parseFloat(c.amount).toLocaleString()}`, mono: true, big: true },
                        { label: 'Method',    val: c.method || '—' },
                        { label: 'Submitted', val: new Date(c.requested_at).toLocaleDateString() },
                      ].map(({ label, val, mono, big }) => (
                        <div key={label}>
                          <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</p>
                          <p style={{ margin: '3px 0 0', fontSize: big ? 16 : 15, fontWeight: big ? 700 : 500, color: AD.textPrimary, fontFamily: mono ? "'Roboto Mono', monospace" : AD.fontSans }}>{val}</p>
                        </div>
                      ))}
                    </div>
                    {c.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Btn onClick={() => handleAction(c.id, 'approved')} variant="success"><i className="ph ph-check" /> Approve</Btn>
                        <Btn onClick={() => handleAction(c.id, 'denied')}   variant="danger"><i className="ph ph-x" /> Deny</Btn>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Referral Payouts tab ── */}
        {activeTab === 'payouts' && (
          <>
            {payoutLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0, 1, 2].map(i => <Skeleton key={i} height="140px" borderRadius="16px" />)}
              </div>
            ) : payoutError ? (
              <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '28px', textAlign: 'center' }}>
                <i className="ph ph-warning-circle" style={{ fontSize: 28, color: AD.amberText, display: 'block', marginBottom: 8 }} />
                <p style={{ color: AD.textSecondary, fontSize: 14, margin: '0 0 16px' }}>{payoutError}</p>
                <button
                  onClick={() => { setPayoutFetched(false); loadPayoutQueue(); }}
                  style={{ padding: '8px 18px', borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`, background: 'transparent', color: AD.textSecondary, fontSize: 13, fontFamily: AD.fontSans, cursor: 'pointer' }}
                >
                  Retry
                </button>
              </div>
            ) : payoutQueue.length === 0 ? (
              <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '32px', textAlign: 'center' }}>
                <i className="ph ph-check-circle" style={{ fontSize: 32, color: AD.greenText, display: 'block', marginBottom: 8 }} />
                <p style={{ color: AD.textSecondary, fontSize: 15, margin: 0 }}>No referral payouts pending review.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {payoutQueue.map(row => {
                  const inFlight = payoutActionLoading[row.id];
                  const rowErr   = payoutActionError[row.id];
                  const bonus    = parseFloat(row.bonus_amount) || 0;
                  const date     = new Date(row.converted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  return (
                    <div key={row.id} style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: AD.shadowSm }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: AD.red, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                          {(row.referrer_name || '?').split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: AD.textPrimary }}>{row.referrer_name || '—'}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: AD.textSecondary, fontFamily: "'Roboto Mono', monospace" }}>{row.referrer_email || '—'}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 16 }}>
                        {[
                          { label: 'Client',   val: row.referred_client_name || '—' },
                          { label: 'Job Type', val: row.job_type || '—' },
                          { label: 'Bonus',    val: `$${bonus.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, mono: true, big: true },
                          { label: 'Date',     val: date },
                        ].map(({ label, val, mono, big }) => (
                          <div key={label}>
                            <p style={{ margin: 0, fontSize: 12, color: AD.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{label}</p>
                            <p style={{ margin: '3px 0 0', fontSize: big ? 16 : 15, fontWeight: big ? 700 : 500, color: AD.textPrimary, fontFamily: mono ? "'Roboto Mono', monospace" : AD.fontSans }}>{val}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={() => handlePayoutAction(row.id, 'approve')}
                          disabled={!!inFlight}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: AD.radiusMd, border: 'none', background: inFlight === 'approve' ? AD.green : AD.greenBg, color: AD.greenText, fontSize: 13, fontWeight: 500, fontFamily: AD.fontSans, cursor: inFlight ? 'not-allowed' : 'pointer', opacity: inFlight && inFlight !== 'approve' ? 0.5 : 1, transition: 'opacity 0.15s, background 0.15s' }}
                        >
                          {inFlight === 'approve'
                            ? <><i className="ph ph-circle-notch" style={{ fontSize: 14, animation: 'spin 0.8s linear infinite' }} />Approving...</>
                            : <><i className="ph ph-check" style={{ fontSize: 14 }} />Approve</>}
                        </button>
                        <button
                          onClick={() => handlePayoutAction(row.id, 'deny')}
                          disabled={!!inFlight}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: AD.radiusMd, border: `1px solid ${AD.border}`, background: 'transparent', color: AD.textSecondary, fontSize: 13, fontWeight: 500, fontFamily: AD.fontSans, cursor: inFlight ? 'not-allowed' : 'pointer', opacity: inFlight && inFlight !== 'deny' ? 0.5 : 1, transition: 'opacity 0.15s' }}
                        >
                          {inFlight === 'deny'
                            ? <><i className="ph ph-circle-notch" style={{ fontSize: 14, animation: 'spin 0.8s linear infinite' }} />Denying...</>
                            : <><i className="ph ph-x" style={{ fontSize: 14 }} />Deny</>}
                        </button>
                      </div>
                      {rowErr && (
                        <p style={{ margin: '10px 0 0', fontSize: 13, color: AD.red2Text }}>{rowErr}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </>
        )}
      </>
    );
  }
  ```

- [ ] **Step 3: Verify the React build passes**

  ```bash
  npm run build 2>&1 | tail -20
  ```
  Expected: `Compiled successfully.` with no errors. Warnings about bundle size are acceptable.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/admin/AdminCashOuts.jsx
  git commit -m "feat: payout queue tab on cashouts page — approve/deny referral conversions"
  ```

---

## Task 5 — Push and verify on live deployment

- [ ] **Step 1: Push to main**

  ```bash
  git push
  ```

- [ ] **Step 2: Wait ~30 seconds for Railway to deploy, then verify the following on the live Vercel deployment:**

  1. Open the admin panel (`?admin=true`) and navigate to Cash Outs
  2. Confirm the "Cashout Requests" tab is selected by default and all existing cashout content renders exactly as before
  3. Click the "Referral Payouts" tab — confirm it loads (spinner then either rows or the empty state "No referral payouts pending review.")
  4. If rows exist: confirm each card shows referrer name, email, client, job type (or `—`), bonus amount formatted as `$X,XXX.XX`, and date formatted as `Month D, YYYY`
  5. If rows exist: click Approve or Deny on one row — confirm the row disappears from the list on success
  6. Return to "Cashout Requests" tab — confirm all existing data and filters still work
