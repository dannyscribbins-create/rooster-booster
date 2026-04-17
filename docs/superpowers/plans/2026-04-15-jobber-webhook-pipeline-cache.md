# Jobber Webhook + Pipeline Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-request Jobber API calls with a real-time webhook-driven pipeline cache, eliminating the first:50 client cap and scaling pipeline reads to instant DB lookups.

**Architecture:** Jobber CLIENT_CREATE/CLIENT_UPDATE webhooks feed a `pipeline_cache` table via a new `pipelineSync.js` service; a 30-minute background scheduler provides a safety-net incremental sync; `fetchPipelineForReferrer()` reads from cache instead of calling Jobber directly. Pre-start-date clients are flagged for admin review and hard-gated from bonus logic.

**Tech Stack:** Node.js/Express, PostgreSQL (pg pool), Jobber GraphQL API (`2026-02-17`), React (inline styles, no CSS framework), existing Phosphor Icons v2.1.1, existing Resend email setup.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `server/db.js` | Add migrations for `pipeline_cache`, `flagged_referrals`, `sync_state` tables |
| Create | `server/crm/pipelineSync.js` | All sync logic: classifyPipelineStatus, getReferredByValue, syncSingleClient, runFullSync, runIncrementalSync |
| Modify | `server/routes/webhooks/jobber.js` | Add CLIENT_CREATE and CLIENT_UPDATE handlers |
| Modify | `server.js` | Add background scheduler (extract to named function, call from server.js) |
| Modify | `server/crm/jobber.js` | Replace `fetchPipelineForReferrer()` body with pipeline_cache read |
| Modify | `server/routes/admin.js` | Add GET /api/admin/flagged-referrals/summary, GET /api/admin/flagged-referrals, PUT /api/admin/flagged-referrals/:id |
| Modify | `src/components/referrer/ProfileTab.jsx` | Add "Historical Record" label on pre_start_date cards |
| Modify | `src/components/admin/AdminDashboard.jsx` | Add flagged referrals warning banner |
| Create | `src/components/admin/AdminFlaggedReferrals.jsx` | Flagged referrals review page |
| Modify | `src/components/admin/AdminApp.jsx` | Wire AdminFlaggedReferrals into pages map |
| Modify | `src/components/admin/AdminComponents.jsx` | Add `flagged` nav entry to ADMIN_NAV with badge count |
| Modify | `server/routes/referrer.js` | Add pre_start_date hard gate to bonus logic in /api/pipeline |

---

## Task 1: Database Migrations

**Files:**
- Modify: `server/db.js`

- [ ] **Step 1: Add pipeline_cache migration to initDB()**

Open `server/db.js`. After the last `ALTER TABLE` block (around line 280, just before the `SELECT access_token` result return), add:

```js
  await pool.query(`CREATE TABLE IF NOT EXISTS pipeline_cache (
    id SERIAL PRIMARY KEY,
    contractor_id VARCHAR(100) NOT NULL,
    jobber_client_id VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    referred_by VARCHAR(255),
    pipeline_status VARCHAR(50) DEFAULT 'lead',
    bonus_amount NUMERIC(10,2),
    jobber_created_at TIMESTAMP,
    pre_start_date BOOLEAN DEFAULT false,
    last_synced_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(contractor_id, jobber_client_id)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS flagged_referrals (
    id SERIAL PRIMARY KEY,
    contractor_id VARCHAR(100) NOT NULL,
    jobber_client_id VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    referred_by VARCHAR(255),
    pipeline_status VARCHAR(50),
    flag_reason VARCHAR(100),
    reviewed BOOLEAN DEFAULT false,
    review_label VARCHAR(100),
    review_note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    UNIQUE(contractor_id, jobber_client_id)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS sync_state (
    contractor_id VARCHAR(100) PRIMARY KEY,
    last_synced_at TIMESTAMP,
    initial_sync_complete BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
```

- [ ] **Step 2: Deploy to Railway to apply migrations**

```bash
git add server/db.js
git commit -m "feat: add pipeline_cache, flagged_referrals, and sync_state table migrations"
git push origin main
```

Wait 60 seconds, then verify in Railway logs that the server started without error. The new tables will be created automatically by `initDB()` on boot.

---

## Task 2: pipelineSync.js — classifyPipelineStatus and getReferredByValue

**Files:**
- Create: `server/crm/pipelineSync.js`

- [ ] **Step 1: Create the file with classifyPipelineStatus and getReferredByValue**

Create `server/crm/pipelineSync.js`:

```js
const axios = require('axios');
const { pool } = require('../db');

// ── PIPELINE STATUS CLASSIFIER ────────────────────────────────────────────────
// Input: a single Jobber client object with quotes, jobs, invoices
// Output: 'lead' | 'inspection' | 'not_sold' | 'sold' | 'paid'
function classifyPipelineStatus(client) {
  const quotes = client.quotes?.nodes || [];
  const jobs   = client.jobs?.nodes   || [];

  if (jobs.length === 0 && quotes.length === 0) return 'lead';

  // Check for paid invoice — client reached 'paid' stage
  for (const job of jobs) {
    const hasPaidInvoice = (job.invoices?.nodes || []).some(
      inv => inv.invoiceStatus === 'paid'
    );
    if (hasPaidInvoice) return 'paid';
  }

  // Job exists but no paid invoice yet
  if (jobs.length > 0) return 'sold';

  // No jobs — check quote activity
  const activeQuotes = quotes.filter(q => q.quoteStatus !== 'archived');
  if (activeQuotes.length > 0) return 'inspection';

  // All quotes archived, no job
  return 'not_sold';
}

// ── REFERRED BY FIELD EXTRACTOR ───────────────────────────────────────────────
// Input: a single Jobber client object
// Output: string value of "Referred by" custom field, or null
function getReferredByValue(client) {
  const fields = client.customFields || [];
  const field  = fields.find(f => f.label && f.label.toLowerCase() === 'referred by');
  if (!field) return null;
  const value = field.valueText?.trim();
  return value || null;
}

module.exports = { classifyPipelineStatus, getReferredByValue };
```

- [ ] **Step 2: Verify the file exists**

```bash
node -e "const p = require('./server/crm/pipelineSync'); console.log(Object.keys(p));"
```

Expected output: `[ 'classifyPipelineStatus', 'getReferredByValue' ]`

---

## Task 3: pipelineSync.js — syncSingleClient

**Files:**
- Modify: `server/crm/pipelineSync.js`

- [ ] **Step 1: Add syncSingleClient to pipelineSync.js**

Add the following function after `getReferredByValue`, before the `module.exports` line:

```js
// ── SYNC SINGLE CLIENT ────────────────────────────────────────────────────────
// Input: contractorId string, Jobber client object, referralStartDate Date object
// Upserts a referred client into pipeline_cache.
// Pre-start-date clients: written to pipeline_cache with pre_start_date=true
// and inserted into flagged_referrals if initial_sync is still running.
// Pre-start-date clients never trigger bonus logic (checked upstream by hard gate).
async function syncSingleClient(contractorId, client, referralStartDate) {
  const referredBy = getReferredByValue(client);
  if (!referredBy) return; // not a referred client — do nothing

  const clientName  = `${client.firstName || ''} ${client.lastName || ''}`.trim();
  const createdAt   = client.createdAt ? new Date(client.createdAt) : null;
  const isPreStart  = referralStartDate && createdAt && createdAt < referralStartDate;
  const status      = classifyPipelineStatus(client);

  await pool.query(
    `INSERT INTO pipeline_cache
       (contractor_id, jobber_client_id, client_name, referred_by, pipeline_status,
        pre_start_date, jobber_created_at, last_synced_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     ON CONFLICT (contractor_id, jobber_client_id) DO UPDATE SET
       client_name      = EXCLUDED.client_name,
       referred_by      = EXCLUDED.referred_by,
       pipeline_status  = EXCLUDED.pipeline_status,
       pre_start_date   = EXCLUDED.pre_start_date,
       last_synced_at   = NOW(),
       updated_at       = NOW()`,
    [contractorId, client.id, clientName, referredBy, status,
     isPreStart, createdAt]
  );

  // Flag pre-start-date clients for admin review only during initial sync
  if (isPreStart) {
    const syncResult = await pool.query(
      'SELECT initial_sync_complete FROM sync_state WHERE contractor_id = $1',
      [contractorId]
    );
    const syncComplete = syncResult.rows[0]?.initial_sync_complete ?? false;
    if (!syncComplete) {
      await pool.query(
        `INSERT INTO flagged_referrals
           (contractor_id, jobber_client_id, client_name, referred_by,
            pipeline_status, flag_reason)
         VALUES ($1, $2, $3, $4, $5, 'pre_start_date')
         ON CONFLICT (contractor_id, jobber_client_id) DO NOTHING`,
        [contractorId, client.id, clientName, referredBy, status]
      );
    }
  }
}
```

Update `module.exports`:

```js
module.exports = { classifyPipelineStatus, getReferredByValue, syncSingleClient };
```

---

## Task 4: pipelineSync.js — runFullSync

**Files:**
- Modify: `server/crm/pipelineSync.js`

- [ ] **Step 1: Add runFullSync to pipelineSync.js**

Add the following function after `syncSingleClient`, before `module.exports`:

```js
// ── FULL SYNC ─────────────────────────────────────────────────────────────────
// Fetches ALL clients from Jobber since referral_start_date using cursor-based
// pagination. Processes every client through syncSingleClient.
// Hard guard: if referral_start_date is not set, logs a warning and aborts.
async function runFullSync(contractorId) {
  console.log(`[pipelineSync] Starting full sync for contractor: ${contractorId}`);

  // Load CRM settings — referral_start_date is required
  const settingsResult = await pool.query(
    'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
    [contractorId]
  );
  if (settingsResult.rows.length === 0 || !settingsResult.rows[0].referral_start_date) {
    console.warn(`[pipelineSync] Full sync aborted: referral_start_date not set for contractor: ${contractorId}`);
    return;
  }
  const referralStartDate = new Date(settingsResult.rows[0].referral_start_date);
  const startDateISO      = referralStartDate.toISOString();

  // Fetch OAuth token for this contractor
  const tokenResult = await pool.query(
    'SELECT access_token FROM tokens WHERE contractor_id = $1',
    [contractorId]
  );
  if (tokenResult.rows.length === 0 || !tokenResult.rows[0].access_token) {
    console.warn(`[pipelineSync] Full sync aborted: no access token for contractor: ${contractorId}`);
    return;
  }
  const token = tokenResult.rows[0].access_token;

  // Paginate through all Jobber clients created since referral_start_date
  let allClients  = [];
  let cursor      = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const afterArg = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      clients(first: 50${afterArg}, filter: { createdAt: { after: "${startDateISO}" } }) {
        nodes {
          id firstName lastName createdAt
          customFields { ... on CustomFieldText { label valueText } }
          quotes(first: 10) { nodes { id quoteStatus archivedAt } }
          jobs(first: 10) {
            nodes {
              id jobStatus archivedAt
              invoices(first: 5) { nodes { invoiceStatus } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const response = await axios.post(
      'https://api.getjobber.com/api/graphql',
      { query },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
        },
      }
    );

    if (!response.data.data) {
      console.error('[pipelineSync] Jobber returned no data:', JSON.stringify(response.data));
      throw new Error('Jobber GraphQL returned no data during full sync');
    }

    const { nodes, pageInfo } = response.data.data.clients;
    allClients  = allClients.concat(nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor      = pageInfo.endCursor;
  }

  console.log(`[pipelineSync] Full sync fetched ${allClients.length} clients from Jobber`);

  // Process every client
  let referredCount = 0;
  for (const client of allClients) {
    const referredBy = getReferredByValue(client);
    if (referredBy) referredCount++;
    await syncSingleClient(contractorId, client, referralStartDate);
  }

  // Mark initial sync complete
  await pool.query(
    `INSERT INTO sync_state (contractor_id, last_synced_at, initial_sync_complete, updated_at)
     VALUES ($1, NOW(), true, NOW())
     ON CONFLICT (contractor_id) DO UPDATE SET
       last_synced_at        = NOW(),
       initial_sync_complete = true,
       updated_at            = NOW()`,
    [contractorId]
  );

  console.log(`[pipelineSync] Full sync complete for ${contractorId}: ${allClients.length} total clients, ${referredCount} referred`);
}
```

Update `module.exports`:

```js
module.exports = { classifyPipelineStatus, getReferredByValue, syncSingleClient, runFullSync };
```

---

## Task 5: pipelineSync.js — runIncrementalSync

**Files:**
- Modify: `server/crm/pipelineSync.js`

- [ ] **Step 1: Add runIncrementalSync to pipelineSync.js**

Add after `runFullSync`, before `module.exports`:

```js
// ── INCREMENTAL SYNC ──────────────────────────────────────────────────────────
// Fetches only clients updated since last_synced_at. Falls back to runFullSync
// if no sync_state record exists or initial_sync_complete is false.
async function runIncrementalSync(contractorId) {
  const syncResult = await pool.query(
    'SELECT last_synced_at, initial_sync_complete FROM sync_state WHERE contractor_id = $1',
    [contractorId]
  );

  if (syncResult.rows.length === 0 || !syncResult.rows[0].initial_sync_complete) {
    console.log(`[pipelineSync] No completed sync found for ${contractorId} — running full sync`);
    return runFullSync(contractorId);
  }

  const lastSyncedAt = new Date(syncResult.rows[0].last_synced_at);
  const lastSyncISO  = lastSyncedAt.toISOString();

  console.log(`[pipelineSync] Starting incremental sync for ${contractorId} since ${lastSyncISO}`);

  // Load referral_start_date for pre-start-date check
  const settingsResult = await pool.query(
    'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
    [contractorId]
  );
  const referralStartDate = settingsResult.rows[0]?.referral_start_date
    ? new Date(settingsResult.rows[0].referral_start_date)
    : null;

  // Fetch OAuth token
  const tokenResult = await pool.query(
    'SELECT access_token FROM tokens WHERE contractor_id = $1',
    [contractorId]
  );
  if (tokenResult.rows.length === 0 || !tokenResult.rows[0].access_token) {
    console.warn(`[pipelineSync] Incremental sync aborted: no access token for ${contractorId}`);
    return;
  }
  const token = tokenResult.rows[0].access_token;

  // Paginate — filter by updatedAt since last sync
  let allClients  = [];
  let cursor      = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const afterArg = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      clients(first: 50${afterArg}, filter: { updatedAt: { after: "${lastSyncISO}" } }) {
        nodes {
          id firstName lastName createdAt
          customFields { ... on CustomFieldText { label valueText } }
          quotes(first: 10) { nodes { id quoteStatus archivedAt } }
          jobs(first: 10) {
            nodes {
              id jobStatus archivedAt
              invoices(first: 5) { nodes { invoiceStatus } }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const response = await axios.post(
      'https://api.getjobber.com/api/graphql',
      { query },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': '2026-02-17',
        },
      }
    );

    if (!response.data.data) {
      console.error('[pipelineSync] Jobber returned no data during incremental sync:', JSON.stringify(response.data));
      throw new Error('Jobber GraphQL returned no data during incremental sync');
    }

    const { nodes, pageInfo } = response.data.data.clients;
    allClients  = allClients.concat(nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor      = pageInfo.endCursor;
  }

  console.log(`[pipelineSync] Incremental sync fetched ${allClients.length} updated clients`);

  for (const client of allClients) {
    await syncSingleClient(contractorId, client, referralStartDate);
  }

  await pool.query(
    `UPDATE sync_state SET last_synced_at = NOW(), updated_at = NOW()
     WHERE contractor_id = $1`,
    [contractorId]
  );

  console.log(`[pipelineSync] Incremental sync complete for ${contractorId}`);
}
```

Update final `module.exports`:

```js
module.exports = { classifyPipelineStatus, getReferredByValue, syncSingleClient, runFullSync, runIncrementalSync };
```

- [ ] **Step 2: Commit pipelineSync.js**

```bash
git add server/crm/pipelineSync.js
git commit -m "feat: add pipelineSync service with full and incremental sync logic"
```

---

## Task 6: Webhook Handlers — CLIENT_CREATE and CLIENT_UPDATE

**Files:**
- Modify: `server/routes/webhooks/jobber.js`

- [ ] **Step 1: Add the two new handlers**

Open `server/routes/webhooks/jobber.js`. At the top, add the pipelineSync import after the existing requires:

```js
const { syncSingleClient } = require('../../crm/pipelineSync');
```

Then add both handlers **before** the `module.exports = router;` line. The existing `/jobber/disconnect` handler must remain untouched above.

```js
// POST /webhooks/jobber/client-create
// Jobber fires this when a new client profile is created.
// Responds 200 immediately — sync runs async to stay within Jobber's response window.
router.post('/jobber/client-create', async (req, res) => {
  // ── HMAC SIGNATURE VERIFICATION ─────────────────────────────────────────────
  const signature = req.headers['x-jobber-hmac-sha256'];
  const secret    = process.env.JOBBER_CLIENT_SECRET;

  if (!secret) {
    console.error('[jobber-webhook] JOBBER_CLIENT_SECRET not set — cannot verify signature');
    return res.status(401).json({ error: 'Webhook secret not configured' });
  }
  if (!signature) {
    console.warn('[jobber-webhook] Missing x-jobber-hmac-sha256 header on client-create');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const rawBody     = JSON.stringify(req.body);
  const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  if (signature !== expectedSig) {
    console.warn('[jobber-webhook] Signature mismatch on client-create');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Respond 200 immediately — Jobber requires a fast response
  res.status(200).json({ received: true });

  // Async sync — never blocks the webhook response
  const contractorId = req.query.contractorId || req.body?.contractor_id || 'accent-roofing';
  const client       = req.body?.data?.client || req.body;

  (async () => {
    try {
      const settingsResult = await pool.query(
        'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const referralStartDate = settingsResult.rows[0]?.referral_start_date
        ? new Date(settingsResult.rows[0].referral_start_date)
        : null;
      await syncSingleClient(contractorId, client, referralStartDate);
      console.log(`[jobber-webhook] client-create sync complete for client: ${client?.id}`);
    } catch (err) {
      console.error('[jobber-webhook] client-create sync failed:', err.message);
    }
  })();
});

// POST /webhooks/jobber/client-update
// Jobber fires this when a client profile is updated (custom fields, job status, etc).
// Responds 200 immediately — sync runs async.
router.post('/jobber/client-update', async (req, res) => {
  // ── HMAC SIGNATURE VERIFICATION ─────────────────────────────────────────────
  const signature = req.headers['x-jobber-hmac-sha256'];
  const secret    = process.env.JOBBER_CLIENT_SECRET;

  if (!secret) {
    console.error('[jobber-webhook] JOBBER_CLIENT_SECRET not set — cannot verify signature');
    return res.status(401).json({ error: 'Webhook secret not configured' });
  }
  if (!signature) {
    console.warn('[jobber-webhook] Missing x-jobber-hmac-sha256 header on client-update');
    return res.status(401).json({ error: 'Missing signature' });
  }

  const rawBody     = JSON.stringify(req.body);
  const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  if (signature !== expectedSig) {
    console.warn('[jobber-webhook] Signature mismatch on client-update');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Respond 200 immediately
  res.status(200).json({ received: true });

  const contractorId = req.query.contractorId || req.body?.contractor_id || 'accent-roofing';
  const client       = req.body?.data?.client || req.body;

  (async () => {
    try {
      const settingsResult = await pool.query(
        'SELECT referral_start_date FROM contractor_crm_settings WHERE contractor_id = $1',
        [contractorId]
      );
      const referralStartDate = settingsResult.rows[0]?.referral_start_date
        ? new Date(settingsResult.rows[0].referral_start_date)
        : null;
      await syncSingleClient(contractorId, client, referralStartDate);
      console.log(`[jobber-webhook] client-update sync complete for client: ${client?.id}`);
    } catch (err) {
      console.error('[jobber-webhook] client-update sync failed:', err.message);
    }
  })();
});
```

- [ ] **Step 2: Verify existing disconnect handler is untouched**

Read `server/routes/webhooks/jobber.js` and confirm `router.post('/jobber/disconnect', ...)` handler is unchanged from the original.

- [ ] **Step 3: Commit**

```bash
git add server/routes/webhooks/jobber.js
git commit -m "feat: add CLIENT_CREATE and CLIENT_UPDATE webhook handlers"
```

---

## Task 7: Background Scheduler

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Read current server.js to confirm it is still 23 lines before touching**

Read `server.js`. It must match this structure before any changes:
- imports/requires at top
- `app.set('trust proxy', 1)`, `app.use(cors())`, `app.use(express.json(...))`
- `initDB()`
- Route mounts
- `app.listen(4000, ...)`

- [ ] **Step 2: Add scheduler import and function, wire into server.js**

Add the `runIncrementalSync` import at the top of `server.js`, after existing imports:

```js
const { runIncrementalSync } = require('./server/crm/pipelineSync');
```

Add the scheduler function definition after the route mounts, before `app.listen`:

```js
// ── BACKGROUND SYNC SCHEDULER ────────────────────────────────────────────────
// Runs runIncrementalSync() every 30 minutes for each contractor with a valid token.
// On deploy, waits 60 seconds before the first run to avoid startup pressure.
// A single contractor failure never stops the others.
async function runScheduledSync() {
  console.log('[scheduler] Starting scheduled incremental sync cycle');
  try {
    const result = await pool.query(
      'SELECT DISTINCT contractor_id FROM tokens WHERE access_token IS NOT NULL'
    );
    for (const row of result.rows) {
      try {
        await runIncrementalSync(row.contractor_id);
      } catch (err) {
        console.error(`[scheduler] Sync failed for contractor ${row.contractor_id}:`, err.message);
      }
    }
    console.log('[scheduler] Sync cycle complete');
  } catch (err) {
    console.error('[scheduler] Failed to query contractor list:', err.message);
  }
}

setTimeout(() => {
  runScheduledSync();
  setInterval(runScheduledSync, 30 * 60 * 1000); // every 30 minutes
}, 60 * 1000); // 60-second delay on startup
```

Also add `{ pool }` to the db import at the top of server.js since the scheduler needs it. The current import is:
```js
const { initDB } = require('./server/db');
```
Change it to:
```js
const { initDB, pool } = require('./server/db');
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add 30-minute incremental sync scheduler"
```

---

## Task 8: Replace fetchPipelineForReferrer with Cache Read

**Files:**
- Modify: `server/crm/jobber.js`

- [ ] **Step 1: Audit current response shape before changing anything**

The current `fetchPipelineForReferrer` returns:
```js
{
  pipeline: [
    { id: client.id, name: "First Last", status: "lead"|"inspection"|"sold"|"closed", bonusEarned: bool, payout: number|null }
  ],
  balance: number,
  paidCount: number
}
```

`server/routes/referrer.js` at `/api/pipeline` uses:
- `data.paidCount` → stored in users table
- `data.pipeline.filter(i => i.bonusEarned)` → inserts referral_conversions rows, uses `i.id` and `i.payout`
- `data.pipeline.length` → passed to checkAndAwardBadges
- Returns `data` as-is via `res.json(data)`

`ProfileTab.jsx` uses: `ref.id`, `ref.name`, `ref.status`, `ref.payout`

Pipeline_cache status values must map to frontend status values:
| pipeline_cache `pipeline_status` | Response `status` | `bonusEarned` |
|--|--|--|
| `lead` | `lead` | false |
| `inspection` | `inspection` | false |
| `sold` | `sold` | false |
| `paid` | `sold` | true (unless pre_start_date) |
| `not_sold` | `closed` | false |

- [ ] **Step 2: Replace fetchPipelineForReferrer body**

In `server/crm/jobber.js`, replace the entire body of `fetchPipelineForReferrer` with a pipeline_cache read. The function signature stays the same for backward compatibility.

The new function body (replacing everything between `async function fetchPipelineForReferrer(referrerName, contractorId = null, config = null) {` and its closing `}`):

```js
async function fetchPipelineForReferrer(referrerName, contractorId = null, config = null) {
  // Resolve contractorId — config-based path provides it; legacy path defaults to accent-roofing
  const resolvedContractorId = contractorId || (config?.contractorId) || 'accent-roofing';

  // Read from pipeline_cache — case-insensitive match on referred_by
  const cacheResult = await pool.query(
    `SELECT jobber_client_id, client_name, pipeline_status, pre_start_date
     FROM pipeline_cache
     WHERE contractor_id = $1
       AND LOWER(referred_by) = LOWER($2)
     ORDER BY jobber_created_at ASC NULLS LAST`,
    [resolvedContractorId, referrerName]
  );

  // If no cache records exist yet (initial sync not complete), signal sync pending
  if (cacheResult.rows.length === 0) {
    const syncResult = await pool.query(
      'SELECT initial_sync_complete FROM sync_state WHERE contractor_id = $1',
      [resolvedContractorId]
    );
    const syncComplete = syncResult.rows[0]?.initial_sync_complete ?? false;
    return {
      pipeline: [],
      balance: 0,
      paidCount: 0,
      sync_pending: !syncComplete,
    };
  }

  // Map pipeline_cache rows to the response shape PipelineTab expects
  // Bonus schedule: $500 base + boost per tier [0,100,200,250,300,350,400]
  const boostSchedule = [0, 100, 200, 250, 300, 350, 400];
  let paidCount    = 0;
  let totalBalance = 0;

  const pipeline = cacheResult.rows.map(row => {
    const isPreStart = row.pre_start_date;

    // Map internal status to frontend status values
    let status;
    if (row.pipeline_status === 'paid')     status = 'sold';
    else if (row.pipeline_status === 'not_sold') status = 'closed';
    else status = row.pipeline_status; // 'lead', 'inspection', 'sold'

    // Bonus only fires when paid AND not pre-start-date
    const bonusEarned = row.pipeline_status === 'paid' && !isPreStart;

    let payout = null;
    if (bonusEarned) {
      const boost = boostSchedule[Math.min(paidCount, boostSchedule.length - 1)];
      payout        = 500 + boost;
      totalBalance += payout;
      paidCount++;
    }

    return {
      id:            row.jobber_client_id,
      name:          row.client_name || 'Unknown',
      status,
      bonusEarned,
      payout,
      pre_start_date: isPreStart,
    };
  });

  return { pipeline, balance: totalBalance, paidCount };
}
```

- [ ] **Step 3: Commit**

```bash
git add server/crm/jobber.js
git commit -m "feat: referrer pipeline now reads from pipeline_cache instead of Jobber directly"
```

---

## Task 9: Frontend — Historical Record Label in ProfileTab.jsx

**Files:**
- Modify: `src/components/referrer/ProfileTab.jsx`

- [ ] **Step 1: Locate the referral card rendering block**

In `ProfileTab.jsx`, find the section that renders each `ref` card inside `filtered.map(ref => { ... })`. It starts around line 274. The card renders `ref.name`, `<StatusBadge status={ref.status} />`, and optionally `ref.payout`.

- [ ] **Step 2: Add "Historical Record" label below the client name for pre_start_date cards**

Find this line inside the card (around line 297):
```jsx
<p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: R.textPrimary }}>{ref.name}</p>
```

Replace it with:
```jsx
<div>
  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: R.textPrimary }}>{ref.name}</p>
  {ref.pre_start_date && (
    <p style={{ margin: "2px 0 0", fontSize: 11, color: R.textMuted, fontFamily: R.fontBody }}>
      Historical Record
    </p>
  )}
</div>
```

- [ ] **Step 3: Verify no bonus language appears on pre_start_date cards**

Confirm in the same card render that `ref.payout` is only rendered when truthy (`{ref.payout && ...}`). Since Phase 8 sets `payout: null` for pre_start_date records, no bonus dollar amount will appear. No changes needed there.

---

## Task 10: Admin Backend — Flagged Referrals Endpoints

**Files:**
- Modify: `server/routes/admin.js`

- [ ] **Step 1: Add three new endpoints near the end of admin.js**

Add the following three endpoints before `module.exports = router;`:

```js
// ── ADMIN: FLAGGED REFERRALS SUMMARY ──────────────────────────────────────────
router.get('/api/admin/flagged-referrals/summary', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) AS count,
         COUNT(*) FILTER (WHERE reviewed = true) AS resolved
       FROM flagged_referrals
       WHERE contractor_id = 'accent-roofing'`
    );
    res.json({
      count:    parseInt(result.rows[0].count) || 0,
      resolved: parseInt(result.rows[0].resolved) || 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: FLAGGED REFERRALS LIST ──────────────────────────────────────────────
router.get('/api/admin/flagged-referrals', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  try {
    const result = await pool.query(
      `SELECT id, jobber_client_id, client_name, referred_by, pipeline_status,
              flag_reason, reviewed, review_label, review_note, created_at, reviewed_at
       FROM flagged_referrals
       WHERE contractor_id = 'accent-roofing'
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADMIN: RESOLVE FLAGGED REFERRAL ───────────────────────────────────────────
router.put('/api/admin/flagged-referrals/:id', async (req, res) => {
  if (!await verifyAdminSession(req, res)) return;
  const { review_label, review_note } = req.body;
  const validLabels = ['Already Paid Externally', 'Test Account', 'Duplicate / Data Entry Error', 'Other'];
  if (!review_label || !validLabels.includes(review_label)) {
    return res.status(400).json({ error: 'review_label must be one of: ' + validLabels.join(', ') });
  }
  try {
    const result = await pool.query(
      `UPDATE flagged_referrals
       SET reviewed = true, review_label = $1, review_note = $2, reviewed_at = NOW()
       WHERE id = $3 AND contractor_id = 'accent-roofing'
       RETURNING *`,
      [review_label, review_note || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
```

---

## Task 11: AdminDashboard.jsx — Flagged Referrals Banner

**Files:**
- Modify: `src/components/admin/AdminDashboard.jsx`

- [ ] **Step 1: Add flaggedSummary state and fetch**

In `AdminDashboard.jsx`, add state for flagged summary at the top of the component, after the existing state declarations:

```jsx
const [flaggedSummary, setFlaggedSummary] = useState(null);
```

In the same `useEffect` that calls `loadStats()`, add a second fetch. The useEffect currently is:

```jsx
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { loadStats(); }, [refreshKey]);
```

Replace with:

```jsx
useEffect(() => {
  loadStats();
  fetch(`${BACKEND_URL}/api/admin/flagged-referrals/summary`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
  })
    .then(r => r.json())
    .then(d => { if (!d.error) setFlaggedSummary(d); })
    .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [refreshKey]);
```

- [ ] **Step 2: Render the banner**

In the JSX return, find where the pending cashouts banner is rendered (the `stats?.pendingCashouts > 0` block). Add the flagged referrals banner **above** the cashouts banner:

```jsx
{flaggedSummary && flaggedSummary.count > 0 && flaggedSummary.count !== flaggedSummary.resolved && (
  <div
    onClick={() => setPage('flagged')}
    style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      background: '#FFF8E1', border: '1px solid #FFC10740',
      borderRadius: 12, padding: '16px 24px', marginBottom: 16, cursor: 'pointer',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <i className="ph ph-warning" style={{ fontSize: 16, color: '#B45309', marginTop: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.5 }}>
        <strong>Action Required:</strong> {flaggedSummary.count - flaggedSummary.resolved} client record{(flaggedSummary.count - flaggedSummary.resolved) !== 1 ? 's' : ''} with referral data predate your program start date. These records will appear in your referrers' pipelines but are ineligible for bonuses. Review and resolve these records now to prevent referrer confusion.
      </span>
    </div>
    <span style={{ fontSize: 12, color: '#B45309', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12, flexShrink: 0 }}>
      Review <i className="ph ph-arrow-right" />
    </span>
  </div>
)}
```

---

## Task 12: AdminFlaggedReferrals.jsx — Review Page

**Files:**
- Create: `src/components/admin/AdminFlaggedReferrals.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useState, useEffect } from 'react';
import { AD } from '../../constants/adminTheme';
import { BACKEND_URL } from '../../config/contractor';
import { AdminPageHeader, Btn } from './AdminComponents';
import StatusBadge from '../shared/StatusBadge';
import Skeleton from '../shared/Skeleton';

const REVIEW_LABELS = [
  'Already Paid Externally',
  'Test Account',
  'Duplicate / Data Entry Error',
  'Other',
];

export default function AdminFlaggedReferrals({ setLoggedIn }) {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState({});  // id → true while saving

  // Local resolve state so resolved rows update immediately without refetch
  const [localState, setLocalState] = useState({}); // id → { review_label, review_note }

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin/flagged-referrals`, {
      headers: { 'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}` },
    })
      .then(r => {
        if (r.status === 401) { sessionStorage.removeItem('rb_admin_token'); setLoggedIn(false); return null; }
        return r.json();
      })
      .then(d => {
        if (!d) return;
        if (d.error) { setError(d.error); }
        else {
          setRecords(d);
          // Seed local state from existing reviewed records
          const init = {};
          d.forEach(r => {
            init[r.id] = { review_label: r.review_label || '', review_note: r.review_note || '' };
          });
          setLocalState(init);
        }
        setLoading(false);
      })
      .catch(() => { setError('Failed to load flagged referrals'); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleResolve(record) {
    const state = localState[record.id] || {};
    const label = state.review_label;
    if (!label) return;

    setSaving(s => ({ ...s, [record.id]: true }));
    fetch(`${BACKEND_URL}/api/admin/flagged-referrals/${record.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('rb_admin_token')}`,
      },
      body: JSON.stringify({ review_label: label, review_note: state.review_note || null }),
    })
      .then(r => r.json())
      .then(d => {
        setSaving(s => ({ ...s, [record.id]: false }));
        if (d.error) { alert('Failed to resolve: ' + d.error); return; }
        setRecords(prev => prev.map(r => r.id === record.id ? { ...r, reviewed: true, review_label: d.review_label, review_note: d.review_note } : r));
      })
      .catch(() => {
        setSaving(s => ({ ...s, [record.id]: false }));
        alert('Failed to save. Please try again.');
      });
  }

  // Map pipeline_cache status names to frontend display status
  function displayStatus(pipelineStatus) {
    if (pipelineStatus === 'not_sold') return 'closed';
    return pipelineStatus || 'lead';
  }

  const unresolvedCount = records.filter(r => !r.reviewed).length;

  return (
    <>
      <AdminPageHeader
        title="Flagged Referrals"
        subtitle={`${records.length} total · ${unresolvedCount} unresolved`}
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => <Skeleton key={i} height="120px" borderRadius="16px" />)}
        </div>
      ) : error ? (
        <p style={{ color: AD.red2Text, fontSize: 15 }}>{error}</p>
      ) : records.length === 0 ? (
        <div style={{ background: AD.bgCard, border: `1px solid ${AD.border}`, borderRadius: 16, padding: 40, textAlign: 'center' }}>
          <i className="ph ph-check-circle" style={{ fontSize: 40, color: AD.green, display: 'block', marginBottom: 12 }} />
          <p style={{ color: AD.textSecondary, fontSize: 15, margin: 0 }}>No flagged referrals. You're all clear.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {records.map(record => {
            const state       = localState[record.id] || {};
            const isResolved  = record.reviewed;
            const isSaving    = saving[record.id];
            const showNote    = state.review_label === 'Other';

            return (
              <div
                key={record.id}
                style={{
                  background: AD.bgCard,
                  border: `1px solid ${isResolved ? AD.greenBorder || AD.border : AD.border}`,
                  borderRadius: 16, padding: '20px 24px',
                  opacity: isResolved ? 0.75 : 1,
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: AD.textPrimary, fontFamily: AD.fontSans }}>
                      {record.client_name || '—'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: AD.textSecondary }}>
                      Referred by: <strong>{record.referred_by || '—'}</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusBadge status={displayStatus(record.pipeline_status)} />
                    {isResolved && (
                      <span style={{
                        background: '#dcfce7', color: '#15803d',
                        fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                        fontFamily: AD.fontSans,
                      }}>
                        Resolved
                      </span>
                    )}
                  </div>
                </div>

                {/* Resolve controls — disabled once resolved */}
                {!isResolved && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <select
                      value={state.review_label || ''}
                      onChange={e => setLocalState(s => ({ ...s, [record.id]: { ...s[record.id], review_label: e.target.value } }))}
                      style={{
                        width: '100%', padding: '10px 12px', fontSize: 14,
                        border: `1px solid ${AD.border}`, borderRadius: 8,
                        background: AD.bgPage, color: AD.textPrimary,
                        fontFamily: AD.fontSans,
                      }}
                    >
                      <option value="">Select a reason…</option>
                      {REVIEW_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>

                    {showNote && (
                      <textarea
                        placeholder="Add a note (optional)"
                        value={state.review_note || ''}
                        onChange={e => setLocalState(s => ({ ...s, [record.id]: { ...s[record.id], review_note: e.target.value } }))}
                        rows={2}
                        style={{
                          width: '100%', padding: '10px 12px', fontSize: 14,
                          border: `1px solid ${AD.border}`, borderRadius: 8,
                          background: AD.bgPage, color: AD.textPrimary,
                          fontFamily: AD.fontSans, resize: 'vertical', boxSizing: 'border-box',
                        }}
                      />
                    )}

                    <button
                      onClick={() => handleResolve(record)}
                      disabled={!state.review_label || isSaving}
                      style={{
                        alignSelf: 'flex-start',
                        background: state.review_label ? AD.green || '#16a34a' : AD.border,
                        color: state.review_label ? '#fff' : AD.textMuted,
                        border: 'none', borderRadius: 8, padding: '10px 20px',
                        fontSize: 14, fontWeight: 600, cursor: state.review_label ? 'pointer' : 'not-allowed',
                        fontFamily: AD.fontSans,
                      }}
                    >
                      {isSaving ? 'Saving…' : 'Resolve'}
                    </button>
                  </div>
                )}

                {/* Resolved — show the label that was selected */}
                {isResolved && record.review_label && (
                  <p style={{ margin: 0, fontSize: 13, color: AD.textSecondary }}>
                    Resolution: {record.review_label}
                    {record.review_note && ` — ${record.review_note}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
```

---

## Task 13: Wire AdminFlaggedReferrals into Admin Shell

**Files:**
- Modify: `src/components/admin/AdminApp.jsx`
- Modify: `src/components/admin/AdminComponents.jsx`

- [ ] **Step 1: Add import and pages entry in AdminApp.jsx**

At the top of `AdminApp.jsx`, add the import after existing component imports:

```jsx
import AdminFlaggedReferrals from './AdminFlaggedReferrals';
```

In the `pages` object inside `AdminPanel`, add:

```jsx
flagged: <AdminFlaggedReferrals setLoggedIn={setAuthed} />,
```

- [ ] **Step 2: Add flagged referrals state and fetch in AdminApp.jsx**

In `AdminPanel`, add state for the unresolved count. After the existing `useState` declarations:

```jsx
const [flaggedUnresolved, setFlaggedUnresolved] = useState(0);
```

In `handleLogin`, after the cashouts fetch, add:

```jsx
fetch(`${BACKEND_URL}/api/admin/flagged-referrals/summary`, {
  headers: { 'Authorization': `Bearer ${token}` },
})
  .then(r => r.json())
  .then(d => { if (d && !d.error) setFlaggedUnresolved(d.count - d.resolved); });
```

Pass `flaggedUnresolved` down to AdminShell:

Change:
```jsx
<AdminShell page={page} setPage={handleNavClick} pendingCount={pendingCount} ...>
```

To:
```jsx
<AdminShell page={page} setPage={handleNavClick} pendingCount={pendingCount} flaggedUnresolved={flaggedUnresolved} ...>
```

- [ ] **Step 3: Add nav entry to ADMIN_NAV in AdminComponents.jsx**

In `AdminComponents.jsx`, find the `ADMIN_NAV` array. Add the flagged nav item after the `engagement` entry:

```js
{ id: 'flagged', icon: 'ph-flag', label: 'Flagged Referrals' },
```

- [ ] **Step 4: Add badge count to the flagged nav item in AdminSidebar**

In `AdminSidebar`, find where `pendingCount` is destructured from props. Add `flaggedUnresolved`:

Change:
```jsx
export function AdminSidebar({ page, setPage, pendingCount }) {
```

To:
```jsx
export function AdminSidebar({ page, setPage, pendingCount, flaggedUnresolved = 0 }) {
```

Inside the nav items map, add a badge for `flagged` similar to the existing cashouts badge. After the existing cashouts badge block:

```jsx
{item.id === 'flagged' && flaggedUnresolved > 0 && (
  <span style={{ marginLeft: 'auto', background: '#d97706', color: '#fff', fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>{flaggedUnresolved}</span>
)}
```

- [ ] **Step 5: Propagate flaggedUnresolved through AdminShell to AdminSidebar**

In `AdminComponents.jsx`, find `AdminShell` (it renders `AdminSidebar`). Update `AdminShell` to accept and pass `flaggedUnresolved`:

Find:
```jsx
export function AdminShell({ page, setPage, pendingCount, children, ... }) {
```

Add `flaggedUnresolved = 0` to the destructure, then pass it to `<AdminSidebar ... flaggedUnresolved={flaggedUnresolved} />`.

- [ ] **Step 6: Commit all frontend changes so far**

```bash
git add src/components/referrer/ProfileTab.jsx \
        src/components/admin/AdminDashboard.jsx \
        src/components/admin/AdminFlaggedReferrals.jsx \
        src/components/admin/AdminApp.jsx \
        src/components/admin/AdminComponents.jsx \
        server/routes/admin.js
git commit -m "feat: pipeline cache frontend — historical record labels, flagged referrals banner and review screen"
```

---

## Task 14: Hard Gate — Block Bonus Logic for Pre-Start-Date Records

**Files:**
- Modify: `server/routes/referrer.js`

- [ ] **Step 1: Locate all bonus calculation sites**

In `server/routes/referrer.js`, find the `/api/pipeline` route (around line 283). The bonus logic is:

```js
for (const item of data.pipeline.filter(i => i.bonusEarned)) {
  await pool.query(
    `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, converted_at, bonus_amount)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (user_id, jobber_client_id) DO NOTHING`,
    [userId, 'accent-roofing', item.id, item.payout]
  );
}
```

Since Phase 8's `fetchPipelineForReferrer` replacement already sets `bonusEarned: false` and `payout: null` for pre_start_date records, the existing `filter(i => i.bonusEarned)` already blocks them from entering the referral_conversions insert loop.

- [ ] **Step 2: Add explicit hard gate log for pre-start-date records**

Replace the referral_conversions insert loop with a version that logs blocked records:

```js
for (const item of data.pipeline) {
  if (item.pre_start_date) {
    console.log(`[pipeline] Bonus blocked — pre-start-date record ${item.id} for user ${userId}`);
    continue;
  }
  if (!item.bonusEarned) continue;
  // bonus_amount stored at sync time — source of truth for all period-filtered earnings queries.
  // Full real-time accuracy requires Jobber webhook (see pipelineSync.js).
  await pool.query(
    `INSERT INTO referral_conversions (user_id, contractor_id, jobber_client_id, converted_at, bonus_amount)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (user_id, jobber_client_id) DO NOTHING`,
    [userId, 'accent-roofing', item.id, item.payout]
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/referrer.js
git commit -m "feat: hard gate blocks bonus logic for all pre-start-date pipeline records"
```

---

## Task 15: Build Verification and Push

- [ ] **Step 1: Run the production build**

```bash
CI=true npx react-scripts build 2>&1 | grep -E "Compiled|Failed|Warning.*exhaustive-deps|error"
```

Expected: `Compiled successfully.`

If you see `react-hooks/exhaustive-deps` warnings — they are hard Vercel build errors. For any useEffect with intentionally omitted dependencies, add the eslint-disable comment on the line **immediately above** the dependency array:

```jsx
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Re-run the build after any fixes until `Compiled successfully.` appears.

- [ ] **Step 2: Push to origin**

```bash
git push origin main
```

- [ ] **Step 3: Post-deploy verification checklist (wait 60 seconds after push)**

Check Railway logs for:
1. Server started without error
2. `[scheduler] Starting scheduled incremental sync cycle` appears ~60 seconds after deploy
3. For each contractor with a token: `[pipelineSync] Starting incremental sync for ...` appears
4. No unhandled errors in the scheduler cycle

Check Vercel deployment:
5. Vercel shows "Ready" status — if not, trigger manual redeploy from Vercel dashboard
6. Log into the referrer app — pipeline tab loads without error
7. If flagged referrals exist: admin dashboard shows the yellow banner
8. Admin → Flagged Referrals page loads the review UI

- [ ] **Step 4: Report Railway log output**

After the first scheduler cycle completes, report what the Railway logs show. Key lines to look for:
```
[scheduler] Starting scheduled incremental sync cycle
[pipelineSync] Starting incremental sync for accent-roofing since ...
[pipelineSync] Incremental sync fetched N updated clients
[pipelineSync] Incremental sync complete for accent-roofing
[scheduler] Sync cycle complete
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|--|--|
| pipeline_cache table migration | Task 1 |
| flagged_referrals table migration | Task 1 |
| sync_state table migration | Task 1 |
| classifyPipelineStatus() | Task 2 |
| getReferredByValue() | Task 2 |
| syncSingleClient() with upsert + flagged_referrals insert | Task 3 |
| runFullSync() with cursor pagination + referral_start_date guard | Task 4 |
| runIncrementalSync() falling back to runFullSync | Task 5 |
| CLIENT_CREATE webhook handler | Task 6 |
| CLIENT_UPDATE webhook handler | Task 6 |
| Respond 200 before async sync on webhooks | Task 6 |
| Background scheduler every 30 min, 60s startup delay | Task 7 |
| One contractor failure doesn't stop others | Task 7 |
| fetchPipelineForReferrer reads from pipeline_cache | Task 8 |
| sync_pending flag when no cache records | Task 8 |
| pre_start_date field on pipeline records | Task 8 |
| "Historical Record" label on pre_start_date cards | Task 9 |
| No bonus language on Historical Record cards | Task 9 (verified — payout is null) |
| GET /api/admin/flagged-referrals/summary | Task 10 |
| GET /api/admin/flagged-referrals | Task 10 |
| PUT /api/admin/flagged-referrals/:id | Task 10 |
| AdminDashboard yellow warning banner | Task 11 |
| Banner disappears when all resolved | Task 11 (count !== resolved condition) |
| AdminFlaggedReferrals review page | Task 12 |
| Dropdown: 4 review labels | Task 12 |
| Notes field visible only for "Other" | Task 12 |
| Resolved rows show green "Resolved" badge, controls disabled | Task 12 |
| Wire into AdminApp + ADMIN_NAV | Task 13 |
| Nav badge count for unresolved flagged records | Task 13 |
| Bonus hard gate for pre_start_date | Task 14 |
| Build verification | Task 15 |

### Type Consistency
- `classifyPipelineStatus` returns `'lead' | 'inspection' | 'not_sold' | 'sold' | 'paid'`
- `pipeline_cache.pipeline_status` stores these exact values
- Phase 8 maps these to frontend values: `not_sold → closed`, `paid → sold`
- `syncSingleClient` is called by both webhook handlers and sync functions — signature is `(contractorId, client, referralStartDate)` throughout
- `flaggedUnresolved` prop flows: `AdminPanel → AdminShell → AdminSidebar` (Tasks 11–13)

### Known Limitation
The webhook handlers receive the client data directly from the Jobber webhook payload. The Jobber webhook payload for CLIENT_CREATE/CLIENT_UPDATE may not include the full nested `quotes`, `jobs`, and `invoices` data needed by `classifyPipelineStatus`. If the webhook payload only includes basic client fields, `classifyPipelineStatus` will return `'lead'` for all webhook-triggered clients (no quotes/jobs found). The incremental sync running every 30 minutes will correct the status. This is acceptable for MVP — the pipeline_cache will always be accurate within 30 minutes even if webhook payload is incomplete.
