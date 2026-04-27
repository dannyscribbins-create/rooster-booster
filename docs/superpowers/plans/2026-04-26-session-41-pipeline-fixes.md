# Session 41 — Pipeline Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three pipeline fixes: (1) peer-link signups instantly create a pipeline card, (2) Find in Jobber links regardless of start date + immediately updates pipeline_cache, (3) `app_user` status renders correctly as "In App" card with "Joined your network" sub-label.

**Architecture:** Fix 1 writes a `pipeline_cache` placeholder row at email-verify time so the referrer's pipeline shows the new user before any Jobber sync runs. Fix 2 calls `syncSingleClient` immediately after the admin links a user to Jobber, then deletes the placeholder row. Fix 3 adds teal design tokens + `app_user` STATUS_CONFIG so the frontend renders the new card without crashing.

**Tech Stack:** Node.js/Express backend, PostgreSQL (pool queries), React frontend with inline styles, Phosphor Icons, design tokens in theme.js.

---

## Critical read before starting

The ON CONFLICT clause in `syncSingleClient` keys on `(contractor_id, jobber_client_id)`. The Fix 1 placeholder uses `jobber_client_id = 'app_user_' + userId`; the real Jobber row uses a Jobber-issued ID. These are **different keys** — syncSingleClient's upsert will NOT overwrite the placeholder. Fix 2 must explicitly DELETE the `app_user_` row after writing the real Jobber row to prevent ghost duplicate cards.

---

## File Map

| File | Role |
|---|---|
| `server/routes/referrer.js` | Fix 1: pipeline_cache INSERT in verify-email endpoint (line ~341) |
| `server/routes/admin.js` | Fix 2: full Jobber fetch + syncSingleClient + placeholder DELETE in match-jobber endpoint (line ~160) |
| `src/constants/theme.js` | Fix 3a: teal tokens in R + `app_user` STATUS_CONFIG entry |
| `src/components/referrer/ProfileTab.jsx` | Fix 3b: "Joined your network" sub-label on app_user cards (line ~347) |

---

## Task 1 — Add teal design tokens and app_user to STATUS_CONFIG

**Must be done first** — `StatusBadge.jsx:5` does `const s = STATUS_CONFIG[status]` with no null guard. If any `app_user` row reaches the frontend before this task ships, the profile tab crashes.

**Files:**
- Modify: `src/constants/theme.js`

- [ ] **Step 1: Add teal tokens to the R object**

  In `src/constants/theme.js`, in the `// Status` section, add three teal tokens after the existing gray entries:

  ```js
  // existing entries above...
  grayBg:    "#f3f4f6",
  grayText:  "#6b7280",

  // new teal tokens for app_user status
  teal:      "#0891b2",
  tealBg:    "#cffafe",
  tealText:  "#0e7490",
  ```

- [ ] **Step 2: Add app_user to STATUS_CONFIG**

  In `src/constants/theme.js`, in the `STATUS_CONFIG` export, add after the `booking_pending` entry:

  ```js
  app_user: { label: "In App", color: R.tealText, dot: R.teal, bg: R.tealBg },
  ```

  The full STATUS_CONFIG should now read:
  ```js
  export const STATUS_CONFIG = {
    lead:            { label: "Lead Submitted",       color: R.grayText,  dot: R.grayText,  bg: R.grayBg  },
    inspection:      { label: "Inspection Completed", color: R.blueText,  dot: R.blue,      bg: R.blueBg  },
    sold:            { label: "Sold ✓",               color: R.greenText, dot: R.green,     bg: R.greenBg },
    closed:          { label: "Not Sold",             color: "#b91c1c",   dot: "#ef4444",   bg: "#fee2e2" },
    booking_pending: { label: "Booking Sent",         color: R.amberText, dot: R.amber,     bg: R.amberBg },
    app_user:        { label: "In App",               color: R.tealText,  dot: R.teal,      bg: R.tealBg  },
  };
  ```

- [ ] **Step 3: Verify no build errors**

  Run: `npm run build 2>&1 | head -30`
  Expected: no errors referencing theme.js or STATUS_CONFIG.

---

## Task 2 — Render "Joined your network" sub-label on app_user cards

**Files:**
- Modify: `src/components/referrer/ProfileTab.jsx`

- [ ] **Step 1: Add sub-label inside the existing pipeline card name block**

  In `src/components/referrer/ProfileTab.jsx`, find the name/sub-label block inside the referral card map (currently around line 345–349):

  ```jsx
  <div>
    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: R.textPrimary }}>{ref.name}</p>
    {ref.pre_start_date && (
      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888", fontStyle: "italic", fontWeight: 400 }}>Historical Record</p>
    )}
  </div>
  ```

  Replace that block with:

  ```jsx
  <div>
    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: R.textPrimary }}>{ref.name}</p>
    {ref.pre_start_date && (
      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#888", fontStyle: "italic", fontWeight: 400 }}>Historical Record</p>
    )}
    {ref.status === 'app_user' && (
      <p style={{ margin: "2px 0 0", fontSize: 11, color: R.tealText, fontWeight: 500 }}>Joined your network</p>
    )}
  </div>
  ```

- [ ] **Step 2: Verify build**

  Run: `npm run build 2>&1 | head -30`
  Expected: no errors.

---

## Task 3 — Write pipeline_cache placeholder at peer signup (Fix 1)

**Files:**
- Modify: `server/routes/referrer.js`

- [ ] **Step 1: Add pipeline_cache write after email verification**

  In `server/routes/referrer.js`, find the `POST /api/signup/verify-email` handler. After the block that logs `'Email verified for new signup'` to activity_log (around line 348), and **before** the existing pending-referral match block, insert:

  ```js
  // ── PEER LINK: WRITE pipeline_cache PLACEHOLDER ─────────────────────────────
  // If this user signed up via a peer invite link, immediately write an app_user
  // placeholder to pipeline_cache so the referring user's pipeline tab shows them
  // at once — before any Jobber sync cycle runs.
  // Wrapped in its own try/catch: failure here must never block or roll back the signup.
  (async () => {
    try {
      const inviteResult = await pool.query(
        'SELECT invited_by_user_id, full_name FROM users WHERE id=$1',
        [userId]
      );
      const newUser = inviteResult.rows[0];
      if (!newUser?.invited_by_user_id) return;

      const inviterResult = await pool.query(
        'SELECT full_name FROM users WHERE id=$1',
        [newUser.invited_by_user_id]
      );
      const inviterName = inviterResult.rows[0]?.full_name;
      if (!inviterName) return;

      // Guard: don't write if pipeline_cache already has a row for this client name
      // (avoids duplicates when Jobber sync already caught this user)
      const existing = await pool.query(
        `SELECT 1 FROM pipeline_cache
         WHERE contractor_id = 'accent-roofing'
           AND LOWER(client_name) = LOWER($1)
         LIMIT 1`,
        [newUser.full_name]
      );
      if (existing.rows.length > 0) return;

      await pool.query(
        `INSERT INTO pipeline_cache
           (contractor_id, jobber_client_id, client_name, referred_by,
            pipeline_status, pre_start_date, raw_data, last_synced_at)
         VALUES ('accent-roofing', $1, $2, $3, 'app_user', false, $4, NOW())`,
        [
          'app_user_' + userId,
          newUser.full_name,
          inviterName,
          JSON.stringify({ source: 'app_signup', invited_by_user_id: newUser.invited_by_user_id }),
        ]
      );
    } catch (err) {
      await logError({ req, error: err });
      console.error('[signup] pipeline_cache write failed:', err.message);
    }
  })();
  ```

  The placement in the file (after activity_log write, before pending-referral block) should look like:

  ```js
  await pool.query(
    `INSERT INTO activity_log ... VALUES ('signup', $1, $2, $3)`,
    [full_name, email, 'Email verified for new signup']
  );

  // ── PEER LINK: WRITE pipeline_cache PLACEHOLDER ─────────────────────────────
  (async () => { ... })();

  // ── PENDING REFERRAL MATCH CHECK ────────────────────────────────────────────
  (async () => {
    try {
      const { matchPendingReferral } = require('../utils/pendingReferral');
      ...
  ```

- [ ] **Step 2: Verify referrer.js has no new .then() chains or var declarations**

  Visually scan the added block — all async code uses async/await, all variables use const.

- [ ] **Step 3: Check pipeline_cache has a raw_data column**

  The INSERT references a `raw_data` column. Confirm it exists:
  ```bash
  grep -n "raw_data" server/db.js
  ```
  If the column doesn't exist in the CREATE TABLE for pipeline_cache, the INSERT will fail silently (caught by the try/catch). Note it for Danny.

---

## Task 4 — Find in Jobber: immediate sync + placeholder cleanup (Fix 2)

**Files:**
- Modify: `server/routes/admin.js`

- [ ] **Step 1: Add required imports at the top of admin.js**

  admin.js currently imports `resendShouldRetry` from retryHelpers but not `jobberShouldRetry`, and does not import `syncSingleClient`. Add both:

  Find line ~19:
  ```js
  const { resendShouldRetry } = require('../utils/retryHelpers');
  ```
  Replace with:
  ```js
  const { resendShouldRetry, jobberShouldRetry } = require('../utils/retryHelpers');
  const { syncSingleClient } = require('../crm/pipelineSync');
  ```

- [ ] **Step 2: Add full-client fetch + syncSingleClient call inside match-jobber**

  Find the `POST /api/admin/users/:id/match-jobber` handler. After the successful-match block that does:

  ```js
  if (match) {
    await pool.query('UPDATE users SET jobber_client_id=$1 WHERE id=$2', [match.id, user.id]);
    await pool.query(
      `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('admin', $1, $2, $3)`,
      [user.full_name, user.email, `Admin manually matched to Jobber client: ${match.id}`]
    );
    return res.json({ matched: true, jobberClientId: match.id, message: 'Matched to Jobber client.' });
  }
  ```

  Replace the `if (match)` block with:

  ```js
  if (match) {
    await pool.query('UPDATE users SET jobber_client_id=$1 WHERE id=$2', [match.id, user.id]);
    await pool.query(
      `INSERT INTO activity_log (event_type, full_name, email, detail) VALUES ('admin', $1, $2, $3)`,
      [user.full_name, user.email, `Admin manually matched to Jobber client: ${match.id}`]
    );

    // Immediately sync the matched Jobber client into pipeline_cache — do not wait for the
    // next 30-minute background cycle. Also cleans up any app_user_ placeholder row.
    try {
      const settingsResult = await pool.query(
        'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
        ['accent-roofing']
      );
      const referralStartDate = settingsResult.rows[0]?.referral_start_date
        ? new Date(settingsResult.rows[0].referral_start_date)
        : null;

      // Fetch full client data (quotes/jobs/invoices) needed by syncSingleClient
      const fullClientResponse = await retryWithBackoff(
        () => axios.post(
          'https://api.getjobber.com/api/graphql',
          {
            query: `query GetClient($id: EncodedId!) {
              client(id: $id) {
                id firstName lastName createdAt
                customFields { ... on CustomFieldText { label valueText } }
                quotes(first: 10) { nodes { id quoteStatus } }
                jobs(first: 10) {
                  nodes {
                    id jobStatus
                    invoices(first: 5) { nodes { invoiceStatus } }
                  }
                }
              }
            }`,
            variables: { id: match.id },
          },
          {
            headers: {
              Authorization: `Bearer ${jobberToken}`,
              'Content-Type': 'application/json',
              'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
            },
          }
        ),
        { retries: 2, initialDelayMs: 1000, shouldRetry: jobberShouldRetry }
      );
      const fullClient = fullClientResponse.data?.data?.client;
      if (fullClient) {
        await syncSingleClient('accent-roofing', fullClient, referralStartDate, []);
        // Remove app_user_ placeholder if one exists — syncSingleClient wrote the real row
        // using the real Jobber client ID, so the placeholder is now a ghost duplicate.
        await pool.query(
          `DELETE FROM pipeline_cache
           WHERE contractor_id = 'accent-roofing'
             AND jobber_client_id = $1`,
          ['app_user_' + req.params.id]
        );
      }
    } catch (syncErr) {
      await logError({ req, error: syncErr });
      console.error('[match-jobber] post-link sync failed (non-fatal):', syncErr.message);
    }

    return res.json({ matched: true, jobberClientId: match.id, message: 'Matched to Jobber client.' });
  }
  ```

  **Important:** `jobberToken` is already in scope in the match-jobber handler (set on line ~171 as `const jobberToken = tokenRes.rows[0].access_token`). No new variable needed.

- [ ] **Step 3: Verify no useEffect exhaustive-deps issues introduced**

  No React files were modified in this task — skip.

- [ ] **Step 4: Confirm admin.js has no new .then() chains or var declarations**

  Visually scan the added block.

---

## Task 5 — Verify pipeline_cache schema has raw_data column

- [ ] **Step 1: Check db.js for raw_data column**

  ```bash
  grep -n "raw_data" server/db.js
  ```

  If `raw_data` is present: nothing to do.

  If `raw_data` is absent: the Fix 1 INSERT will fail silently in the try/catch. Add the column to the pipeline_cache CREATE TABLE in db.js:

  ```sql
  raw_data JSONB,
  ```

  Add it after the `pre_start_date` column. No data migration needed — existing rows will have NULL.

---

## Task 6 — Post-build verification checklist

- [ ] **Check 1: No ESLint exhaustive-deps warnings**

  Run: `npm run build 2>&1 | grep -i "exhaustive-deps"`
  Expected: no output.

- [ ] **Check 2: StatusBadge renders app_user without crash**

  In browser console, confirm no `Cannot read properties of undefined` errors on the profile tab.

- [ ] **Check 3: Verify all five checklist items from the spec**

  1. New peer-link signup → referring user's pipeline shows 'In App' card with teal pill
  2. Pre-start-date Jobber client → admin Find in Jobber links successfully; pipeline card appears after link
  3. Post-start-date Jobber client → Find in Jobber still works (no regression)
  4. Peer-link signup + later Jobber match → pipeline upgrades from 'In App' to real Jobber status; no ghost duplicate cards
  5. No ESLint exhaustive-deps warnings

---

## Task 7 — Commit and push

- [ ] **Step 1: Run final build**

  ```bash
  npm run build
  ```
  Expected: Build succeeds with no errors.

- [ ] **Step 2: Commit**

  ```bash
  git add server/routes/referrer.js server/routes/admin.js src/constants/theme.js src/components/referrer/ProfileTab.jsx
  git commit -m "feat: peer signup pipeline card, find-in-jobber pre-start-date fix, app_user status"
  git push
  ```

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| pipeline_cache INSERT at verify-email | Task 3 |
| invited_by_user_id lookup + dedup guard | Task 3 Step 1 |
| Failure must never block signup | Task 3 (fire-and-forget async IIFE) |
| app_user rows returned by GET /api/pipeline | No change needed — fetchPipelineForReferrer has no status filter |
| Remove pre-start-date link block from admin | No existing block to remove; real fix is adding syncSingleClient |
| syncSingleClient called after admin link | Task 4 |
| allClients = [] passed to syncSingleClient | Task 4 Step 2 |
| app_user_ placeholder deleted after real Jobber write | Task 4 Step 2 |
| Teal color distinct from existing statuses | Task 1 (teal vs blue/green/amber/gray) |
| app_user added to STATUS_CONFIG | Task 1 Step 2 |
| "Joined your network" sub-label on app_user cards | Task 2 |
| No hardcoded hex outside R tokens | Task 1 (uses R.tealText / R.teal / R.tealBg) |
