This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
```bash
# Development
npm start          # React frontend on port 3000
node server.js     # Express backend on port 4000

# Production (Railway)
npm install        # build step
node server.js     # start step

# Tests
npm test           # runs react-scripts test in watch mode

# Build
npm run build      # production React build
```

No lint script is configured. `.npmrc` sets `legacy-peer-deps=true` to handle dependency conflicts.

## Architecture

## Architectural Principles

Every decision in this codebase must pass two filters before implementation:

1. **Will this produce healthy, efficient code that is unlikely to break?**
2. **Will this work at large scale — many contractors, many referrers?**

If a shortcut is taken for MVP speed, it must be flagged with a code comment in the exact location where the shortcut lives, explaining: (a) what the limitation is, (b) what the scalable version looks like, and (c) when to build it.

### Known MVP shortcuts to address later

- **paid_count on users table** — updated only when a referrer loads their pipeline. Stale if a referral converts in Jobber between app visits. At FORA scale, replace with a background cron job that syncs all referrers' pipeline data from their CRM on a scheduled interval (e.g. every 24 hours). The column stays — the cron job is additive, not a rewrite. Flagged in code with comment: `// MVP: update this to cron-based sync at scale`

- **Jobber webhook handler implemented, Stripe + push notification integration pending** — the webhook route exists (`server/routes/webhooks/jobber.js`) and handles client-create, client-update, and disconnect events. However, referral_conversions rows are still recorded only when the leaderboard endpoint is called. At FORA scale, the webhook should also write to referral_conversions immediately on invoice payment, trigger a push notification, and kick off the Stripe ACH payout flow. This is the Stripe ACH session deliverable.

---

**Rooster Booster** is a referral rewards platform for Accent Roofing Service — a full-stack app with a Node.js/Express backend and a React SPA frontend split across organized component files.

### Backend — Folder Structure

`server.js` is a lean entry point only. It imports, mounts routes, calls initDB, registers the expressErrorHandler, schedules the background sync, and starts the server. Do not add route handlers or logic into server.js.

```
server.js                          ← entry point — imports, middleware, route mounts, cron bootstrap, listen
server/
├── db.js                          ← PostgreSQL pool + initDB() — creates/migrates all tables on startup
├── crm/
│   ├── index.js                   ← getCRMAdapter(contractorId) — dispatcher, currently always returns Jobber
│   ├── jobber.js                  ← accessToken, setAccessToken(), refreshTokenIfNeeded(), fetchPipelineForReferrer()
│   ├── pipelineSync.js            ← runFullSync(), runIncrementalSync(), runScheduledSync() — background Jobber sync worker
│   ├── servicetitan.js            ← placeholder — implement fetchPipeline() when ready
│   └── acculynx.js                ← placeholder — implement fetchPipeline() when ready
├── cron/
│   ├── index.js                   ← startCronJobs() — registers all cron jobs on startup
│   ├── withLock.js                ← withLock(jobName, timeoutMinutes, fn) — atomic job lock via cron_job_locks table
│   └── jobs/
│       ├── pipelineSync.js        ← every 30 min — calls runScheduledSync() inside withLock
│       ├── sessionCleanup.js      ← daily 2am UTC — deletes expired sessions
│       ├── adminCacheExpiry.js    ← every 20 min — deletes stale admin_cache rows
│       ├── engagementCadence.js   ← daily 6am UTC — stub for Session 71 M1/M3/M6/M12 cadence
│       └── dynamicAudiences.js   ← daily 6am UTC — stub for Session 71 audience re-evaluation
├── middleware/
│   ├── auth.js                    ← verifyAdminSession(), verifyReferrerSession()
│   └── errorLogger.js             ← classifySeverity(), explainError(), sendErrorAlert(), logError(), expressErrorHandler()
├── utils/
│   ├── retryWithBackoff.js        ← exponential backoff retry utility for all external API calls
│   └── dateUtils.js               ← getPeriodDateRange() — shared date range calculator for period filters
└── routes/
    ├── oauth.js                   ← GET /auth/jobber, GET /callback
    ├── referrer.js                ← all /api/* referrer endpoints + rate limiters
    ├── admin.js                   ← all /api/admin/* endpoints + adminLoginLimiter
    ├── account.js                 ← all /api/account/* referrer account management endpoints
    ├── stripe.js                  ← placeholder — implement Stripe ACH payout routes when ready
    └── webhooks/
        └── jobber.js              ← Jobber webhook handlers (client-create, client-update, disconnect)
```

**What each layer does:**
- **db.js** — owns the PostgreSQL pool. All other files import `{ pool }` from here. `initDB()` creates/migrates all tables on startup.
- **crm/jobber.js** — owns `accessToken` and all Jobber-specific logic. `fetchPipelineForReferrer()` is the core shared function used by both referrer and admin routes.
- **crm/pipelineSync.js** — background worker that calls Jobber GraphQL. `runScheduledSync()` is called by the cron job in `server/cron/jobs/pipelineSync.js` every 30 minutes inside an atomic lock. `runFullSync()` fetches all clients since referral_start_date; `runIncrementalSync()` fetches only clients updated since last sync.
- **crm/index.js** — `getCRMAdapter(contractorId)` is the FORA hook. When contractor #2 uses a different CRM, add their adapter file and update this dispatcher. No route code changes needed.
- **middleware/auth.js** — `verifyAdminSession(req, res)` returns true/false and handles 401 automatically. `verifyReferrerSession(req, res)` returns `{ userId, sessionId, token }` or null (sends 401/403 automatically); also checks for soft-deleted accounts.
- **middleware/errorLogger.js** — `logError({ req, error })` writes to `error_log` table and sends Resend email alerts on first occurrence and every 10th recurrence. `expressErrorHandler` is the Express catch-all registered in server.js. Never use `console.error` alone in production catch blocks — always call `logError` first.
- **utils/retryWithBackoff.js** — `retryWithBackoff(fn, options)` wraps any async function with exponential backoff and ±20% jitter. All external API calls (Jobber, Resend, Twilio, Stripe) must use this utility.
- **utils/dateUtils.js** — `getPeriodDateRange(period, settings)` returns `{ start, end }` Date objects for monthly/quarterly/yearly/alltime periods. Used by both referrer.js and admin.js leaderboard queries.
- **routes/referrer.js** — all `/api/*` referrer endpoints + multiple rate limiters (see Rate Limiting section).
- **routes/admin.js** — all `/api/admin/*` endpoints + adminLoginLimiter. ADMIN_PASSWORD lives here.
- **routes/account.js** — all `/api/account/*` endpoints: profile read/update, phone/email verification, TOTP setup/confirm/disable/reset, SMS 2FA toggle, recovery contacts, session list, sign-out-others, account deletion.
- **routes/webhooks/jobber.js** — Jobber webhook handlers. Receives raw body (express.raw middleware applied in server.js before express.json), verifies HMAC signature against JOBBER_WEBHOOK_SECRET, then processes client-create, client-update, and disconnect events.

**Adding new backend routes:**
- New referrer endpoints → add to `server/routes/referrer.js`
- New admin endpoints → add to `server/routes/admin.js`
- New account management endpoints → add to `server/routes/account.js`
- New CRM → create `server/crm/yourcrmname.js`, update `server/crm/index.js`
- Stripe ACH routes → build into `server/routes/stripe.js`

**Key backend behaviors:**
- **Jobber OAuth 2.0** — token acquisition in oauth.js, storage in `tokens` table, automatic refresh in crm/jobber.js when expiring
- **Two auth systems** — referrers: email + PIN (bcrypt), admins: password; both get session tokens in `sessions` table (24h TTL, role column separates referrer/admin)
- **Jobber GraphQL API** — queried in fetchPipelineForReferrer() to find clients with "Referred by" custom field, cross-referenced with quotes/jobs/invoices
- **Pipeline stages**: lead → inspection → sold → paid
- **Bonus calculation** — 7-tier boost schedule ($500–$900 per sale) based on cumulative paid count
- **Leaderboard endpoint** — returns `period_earnings` (sum of bonus_amount for the filtered period) on every top10 row, userRank row, and warmup row; returns `current_user` (full_name, profile_photo) on all responses for the personal rank row
- **Cash out workflow** — referrers request payouts; admin approves/denies; Resend sends email notifications; approval triggers payout_announcements row
- **Admin dashboard stats** — cached in `admin_cache` table with 15-minute TTL
- **Rate limiting** — all limiters listed below; referrerLoginLimiter and adminLoginLimiter apply to login endpoints; all others are endpoint-specific:
  - `referrerLoginLimiter`: 10/15min — `forgotPinLimiter`: 3/15min — `resetPinLimiter`: 10/15min
  - `signupLimiter`: 5/60min — `verifyEmailLimiter`: 10/15min
  - `cashoutLimiter`: 3/60min — `bookingLimiter`: 3/60min
  - `clientErrorLimiter`: 20/60min — `pipelineLimiter`: 10/5min
  - `adminLoginLimiter`: 5/15min
- **Badge system** — `GET /api/referrer/badges` returns all 7 badges merged with user's earned records (unearned secrets return null name/description); `POST /api/referrer/badges/acknowledge` marks badges seen after the celebration popup is dismissed; `checkAndAwardBadges(userId, count)` runs after every pipeline sync; founding_referrer awarded at account creation (first 20 users)
- **Error monitoring** — all errors route through `logError()` in server/middleware/errorLogger.js, stored in `error_log` table with deduplication (count + last_seen_at updated on repeat). Resend email alerts fire to admin1@roofmiles.com on first occurrence and every 10th recurrence. Severity auto-classified by route path: CRITICAL (cashout/payout/stripe/webhook/auth), WARNING (login/pin/reset/admin), INFO (everything else).
- **Retry logic** — all external API calls use `retryWithBackoff()` with exponential backoff and ±20% jitter. Jobber: 3 retries, skip on 401. Resend: 2 retries, skip on 4xx. Twilio: 2 retries, skip on non-2xxxx error codes.
- **Webhook security** — `/webhooks/*` uses `express.raw({ type: 'application/json' })` to capture raw bytes before `express.json()` runs. HMAC is verified against the raw buffer before any payload processing. Never remove the `express.raw()` middleware from server.js.
- **Pipeline cache** — the pipeline endpoint reads from `pipeline_cache` (populated by the background sync worker), not from Jobber directly. On adapter error, the endpoint falls back to the last known cache rows and returns `{ stale: true, stale_since }`. If no cache rows exist, returns 503. Frontend shows a yellow stale banner (with relative timestamp) or a red unavailable banner accordingly.
- **Payout safety** — cashout approval in admin.js is wrapped in a `BEGIN/COMMIT/ROLLBACK` database transaction. The status update, activity log insert, and payout_announcements insert all commit atomically. A scalable Stripe ACH call should be inserted inside this transaction before the final COMMIT.
- **Cron job infrastructure** — all scheduled jobs live in `server/cron/`. `startCronJobs()` is called inside the initDB IIFE in server.js after the DB is ready. Every job runs inside `withLock(jobName, timeoutMinutes, fn)` which acquires an atomic DB lock from `cron_job_locks` — if the lock is held, the tick is skipped with a log. All schedules run in UTC. To add a new job: create `server/cron/jobs/[name].js`, add a seed row in `initDB()`, and call `register()` in `server/cron/index.js`.

**Database tables**: `tokens`, `users` (incl. paid_count + paid_count_updated_at — MVP, see Architectural Principles), `sessions`, `cashout_requests`, `activity_log`, `admin_cache`, `payout_announcements`, `announcement_settings`, `pin_reset_tokens`, `engagement_settings` (incl. season settings), `user_badges` (incl. seen column), `referral_conversions` (incl. bonus_amount INTEGER — dollar amount stored at sync time, source of truth for period-filtered earnings; see pipeline sync comment), `error_log` (incl. count, resolved — never delete rows; use resolved=true to mark fixed), `pipeline_cache` (populated by background sync worker; source of truth for pipeline endpoint; incl. `paid_at TIMESTAMPTZ` — written once when pipeline_status first transitions to 'paid', never overwritten on subsequent syncs), `sync_state` (tracks last_synced_at and initial_sync_complete per contractor), `flagged_referrals` (pre-start-date clients flagged during initial sync for admin review), `verification_codes` (phone and email OTP codes), `leaderboard_settings`, `invite_links`, `contractor_crm_settings` (incl. referral_start_date), `notification_preferences` (per-contractor per-trigger email suppression; one row per trigger_key, defaults to enabled), `contact_tags` (persistent tag layer on contacts; UNIQUE(contact_id, tag); source CHECK: system/jobber/jobber_crm/admin; written at trigger points, never computed on demand; indexed on contact_id, contractor_id, tag), `cron_job_locks` (atomic distributed lock per job_name; 5 seed rows: pipeline_sync, session_cleanup, admin_cache_expiry, engagement_cadence, dynamic_audiences; is_locked + timeout_at prevent duplicate concurrent runs), `dynamic_audiences` (saved tag filter sets; member_count + last_evaluated_at updated daily by cron), `dynamic_audience_members` (contact membership per audience; refreshed atomically by dynamic_audiences cron job), `engagement_cadence_settings` (per-contractor per-month 1/3/6/12 cadence config; defaults seeded in initDB), `engagement_cadence_log` (prevents duplicate M1/M3/M6/M12 sends; UNIQUE(contact_id, cadence_month))

---

### Frontend — Component Structure

`src/App.js` is a 135-line routing shell. It holds root state, two useEffect hooks, and the routing gate. Do not add component code into App.js — all UI lives in the component files below.

**Two top-level modes:**
- **Referrer app** — 5-tab bottom nav: Home, Refer, Rankings, Cash Out, Profile
- **Admin panel** — accessed via `?admin=true` URL param — 6 sections: Dashboard, Referrers, Cash Outs, Activity Log, Announcements, Engagement

#### Root state (lives in App.js — do not move)
`loggedIn`, `tab`, `userName`, `userEmail`, `pipeline`, `balance`, `paidCount`, `loading`, `profilePhoto`, `showReviewCard`, `announcement`, `announcementSettings`, `showAnnouncement`, `announcementShown`

#### Folder structure
```
src/
├── App.js                          ← 135-line routing shell + root state only
├── config/
│   └── contractor.js               ← CONTRACTOR_CONFIG (incl. contractorId) + BACKEND_URL (white-label boundary for FORA)
├── constants/
│   ├── theme.js                    ← R design tokens + STATUS_CONFIG
│   ├── adminTheme.js               ← AD admin design tokens
│   ├── boostSchedule.js            ← BOOST_TABLE + getNextPayout()
│   └── badges.js                   ← BADGES array — badge definitions, tiers, and trigger types
├── hooks/
│   └── useEntrance.js              ← useEntrance animation hook
└── components/
    ├── shared/
    │   ├── Screen.jsx              ← Page wrapper
    │   ├── AnimCard.jsx            ← Animated card wrapper
    │   ├── StatusBadge.jsx         ← Status badge (referrer + admin)
    │   ├── AvatarCircle.jsx        ← Avatar with camera hint
    │   └── ContactModal.jsx        ← Contact modal (Login + Profile)
    ├── auth/
    │   ├── LoginScreen.jsx         ← Login + inline forgot PIN flow
    │   └── ResetPinScreen.jsx      ← Reset PIN (email reset links)
    ├── referrer/
    │   ├── ReferrerApp.jsx         ← Tab shell + BottomNav
    │   ├── DashboardTab.jsx
    │   ├── ReferAFriendTab.jsx     ← Refer a Friend tab — QR code + share link
    │   ├── RankingsTab.jsx         ← Rankings tab — podium display (top 3), leaderboard list (4–10), time filters, prize display, always-visible personal rank row with period_earnings
    │   ├── CashOutTab.jsx
    │   ├── ProfileTab.jsx          ← Personal hub — My Referrals (pipeline), Activity feed, Badge gallery
    │   ├── BadgeCelebrationPopup.jsx ← New badge celebration overlay — one badge at a time, entrance animation
    │   └── AnnouncementPopup.jsx   ← Payout popup + PRESET_MESSAGES + resolveMessage()
    └── admin/
        ├── AdminApp.jsx            ← AdminPanel + AdminLogin + useAdminFonts
        ├── AdminComponents.jsx     ← AdminSidebar, AdminShell, AdminPageHeader,
        │                              StatCard, Badge, Btn, AdminInput, PipelineBar, ADMIN_NAV
        ├── AdminDashboard.jsx
        ├── AdminReferrers.jsx
        ├── AdminCashOuts.jsx
        ├── AdminActivityLog.jsx
        └── AdminAnnouncementSettings.jsx
```

#### Import conventions
- Referrer components: `import { R } from '../../constants/theme'`
- Admin components: `import { AD } from '../../constants/adminTheme'`
- Backend URL + white-label config: `import { BACKEND_URL, CONTRACTOR_CONFIG } from '../../config/contractor'`
- Boost table: `import { BOOST_TABLE, getNextPayout } from '../../constants/boostSchedule'`
- Animation hook: `import useEntrance from '../../hooks/useEntrance'`

#### New referrer features
Add new tab files to `src/components/referrer/`. Wire them into `ReferrerApp.jsx` (tab shell) and add a nav entry to `BottomNav` inside that file.

#### New admin features
Add new page files to `src/components/admin/`. Wire them into `AdminApp.jsx` and add a nav entry to `ADMIN_NAV` in `AdminComponents.jsx`.

#### ESLint note
`react-hooks/exhaustive-deps` warnings are hard Vercel build errors. Every `useEffect` with intentionally omitted dependencies must have `// eslint-disable-next-line react-hooks/exhaustive-deps` on the line immediately above the dependency array.

### Styling
All styling is inline (no CSS framework). Never add CSS files. Design tokens live in `src/constants/theme.js` (R object) and `src/constants/adminTheme.js` (AD object).
- Colors: Navy `#012854`, Red `#CC0000`, Light Blue `#D3E3F0`
- Fonts: Montserrat (display), Roboto (body), Roboto Mono (numbers)
- Icons: Phosphor Icons v2.1.1
- Mobile-first layout: 430px max-width with safe-area insets

## Code Quality Standards

When reading any file during a session, silently audit for the following and flag any violations before proceeding with the assigned task:

- .then() chains → must be converted to async/await
- var declarations → must be const or let
- callbacks → must be async/await
- class components → must be functional components (except ErrorBoundary.jsx — intentional exception)
- missing try/catch on async functions → must be wrapped
- hardcoded contractor_id or credentials → must use environment variables or CONTRACTOR_CONFIG
- unparameterized SQL queries → never concatenate user values into SQL strings; always use `$1`/`$2` placeholders
- missing retryWithBackoff on external API calls → all Jobber, Resend, Twilio, and Stripe calls must use `retryWithBackoff()` from server/utils/retryWithBackoff.js
- `SELECT *` in queries that return data to the client → always use explicit column lists

If a violation is found, report it and ask whether to fix it before or after the assigned task. Never silently leave a violation in place.

## Security Standards

- **Never trust identity values from the request** — `user_id`, `full_name`, and `email` must always be derived from the verified session token via DB lookup, never from `req.body` or `req.query`.
- **Session queries must always include role and expiry checks** — every session lookup must have `AND role = $n AND expires_at > NOW()` in the SQL WHERE clause.
- **New endpoints that handle user data must use `verifyReferrerSession()`** — import from `server/middleware/auth.js`. Never inline a raw token check in a new route handler.
- **All external API calls must use `retryWithBackoff()`** — import from `server/utils/retryWithBackoff.js`. Applies to Jobber, Resend, Twilio, and Stripe.
- **Never remove `express.raw()` on `/webhooks/*` in server.js** — it is required for correct HMAC verification. Placing `express.json()` before it will corrupt the raw buffer and break signature checks.
- **`ADMIN_PASSWORD` must always be set as a Railway environment variable** — the app crashes on startup if it is missing. This is intentional: a missing password is more dangerous than a crash.
- **`logError()` must be called in every catch block** — import from `server/middleware/errorLogger.js`. Never use `console.error` alone in production code; it bypasses the error_log table and alert system.
- **Never delete rows from `error_log`** — use `resolved = true` to mark fixed errors. The history is required for recurring-error detection and email throttling.

## Brand Standards

For any UI or UX work, read and apply the design skills at:
- `.claude/skills/ui-designer/`
- `.claude/skills/ux-designer/`
- `.claude/skills/ui-ux-pro-max/`

Brand files at `G:\My Drive\Accent Roofing Service\app builder\accent roofing brand kit`:
- `accent-roofing-brand-tokens.css` — design tokens
- `accent-roofing-brand-reference.md` — brand guidelines

## Deployment

Hosted on Railway (backend) and Vercel (frontend). Environment variables required:
- `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`, `REDIRECT_URI` — Jobber OAuth
- `JOBBER_WEBHOOK_SECRET` — Jobber webhook HMAC verification
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_PASSWORD` — admin panel access (app crashes on startup if missing — intentional)
- `RESEND_API_KEY` — email notifications via Resend
- `RESEND_FROM_EMAIL` — sending address (`noreply@roofmiles.com`)
- `RESEND_WEBHOOK_SECRET` — Svix signing secret for Resend webhook verification (copy from Resend dashboard → Webhooks → your endpoint's Signing Secret)
- `FRONTEND_URL` — required for forgot PIN reset email links
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — Twilio SMS (set in Railway; blocked until 10DLC registration is complete)
- `APP_VERSION` — current version string, set to `1.0.0` in Railway

Railway auto-deploys on every GitHub push. Wait ~30 seconds after pushing before testing. Vercel may need a manual redeploy — go to Vercel dashboard, find latest deployment, click three dots, Redeploy.

**Local environment cannot connect to Railway PostgreSQL.** Always test login-dependent features on the live Vercel/Railway deployment, never locally.

**Jobber API version header is `2026-02-17`** — monitor for deprecation notices. Real Accent Roofing Jobber account connects April 14, 2026.

---

### Session Safety Protocol — Run Before Any Code Changes

Every Claude Code session must begin with these steps, in order, before writing or modifying any code:

1. Read this entire CLAUDE.md file
2. Read every file that will be touched during this session — in full, before touching it
3. For any function being modified, search the entire codebase for all call sites of that function and list them
4. Produce a brief impact statement: what does this change affect, and what adjacent code could silently break?
5. Do not proceed until the impact statement is complete and has been acknowledged

After completing any set of changes:
1. Re-read every modified file in full
2. Confirm all imports still resolve, no functions were accidentally renamed or deleted, no logic was altered outside the targeted change
3. Confirm all useEffect hooks with intentionally omitted deps still have eslint-disable-next-line comments
4. Confirm no .then() chains were introduced
5. Confirm no new console.log statements were added to production code paths (diagnostic logs marked with // diagnostic log — intentional are exempt)
6. Run: git add -A && git commit -m "[descriptive message]" && git push
7. Never commit a broken or partial state

---

### Never Break These Rules — Non-Negotiable Constraints

These rules encode decisions made across Sessions 1–38. Violating any of them breaks either security, data integrity, or a multi-contractor architecture that has been carefully designed. Every rule has a reason. Do not remove, work around, or simplify any of them without an explicit instruction from Danny.

**Authentication & Session Security**
- Every session token in the sessions table has a role column (referrer or admin). Admin endpoints must always check AND role='admin'. Referrer endpoints must always check AND role='referrer'. These filters must never be removed or loosened.
- verifyAdminSession() in server/middleware/auth.js is the only authorized way to protect admin endpoints. Never inline auth checks or duplicate this logic.
- Session tokens are 64-character hex strings generated from 32 random bytes. Never shorten or weaken token generation.
- Sessions expire after 24 hours. Never extend TTL without explicit instruction.
- ADMIN_PASSWORD lives in Railway environment variables only. It must never be hardcoded anywhere in the codebase, even as a fallback.

**Database Integrity**
- UNIQUE(user_id, jobber_client_id) on referral_conversions enforces one conversion per referred client, ever. This constraint must never be removed. Returning clients do not generate repeat bonuses.
- contractor_id must be present on every database write that touches contractor-owned data. In MVP it is hardcoded as 'accent-roofing'. Before contractor #2 is onboarded it must be pulled from the session token. Never remove contractor_id from queries.
- Never use SELECT * in production queries. Always specify the columns needed.
- Never run destructive SQL (DROP, TRUNCATE, DELETE without WHERE) without an explicit instruction and a confirmed backup.
- Always click Run Backup Now in the admin panel before any migration or database-touching push.
- pending_referrals records must never be hard deleted. Close out sets status='closed', closed_out_by_admin=true, closed_out_at=NOW(). Records are retained permanently for audit trail.

**Jobber API**
- All Jobber GraphQL calls must be wrapped in retryWithBackoff with jobberShouldRetry. No direct axios.post to Jobber without retry logic.
- retryWithBackoff helpers (resendShouldRetry, twilioShouldRetry, jobberShouldRetry) live in server/utils/retryHelpers.js. Import from there — never redefine locally.
- Jobber API version header is 2026-02-17. Do not change this without verifying the new version in Jobber's changelog.
- ClientFilterAttributes does NOT support name, firstName, or lastName filtering. Never attempt to filter Jobber clients by name via the API. Always use local filtering on an already-fetched allClients array.
- Jobber GraphQL is read-only. There are no mutations anywhere in this codebase. Never add a mutation without explicit instruction.
- OAuth token refresh is handled automatically by refreshTokenIfNeeded() in crm/jobber.js. Never bypass this.
- getPrimaryEmail and getPrimaryPhone in pendingReferral.js handle both the GraphQL array shape (client.emails[]/client.phones[]) and a flat-string fallback (client.email/client.phone) for raw webhook payloads. Never simplify these back to single-shape extraction.
- phones and emails fields are intentionally absent from the bulk allClients sync query — removed to reduce API load. They are only fetched in fetchFullClient (single-client webhook path) and fetchReferrerContact (targeted referrer lookup). Do not add them back to bulk queries without explicit instruction and architectural review.

**External Services**
- All Resend email calls must be wrapped in retryWithBackoff with resendShouldRetry.
- All Twilio SMS calls must be wrapped in retryWithBackoff with twilioShouldRetry.
- SMS sending is gated by TWILIO_10DLC_ACTIVE environment variable. This must remain false until 10DLC registration is complete. Never remove this guard.
- Resend sends from noreply@roofmiles.com. Admin alerts go to admin1@roofmiles.com. Never change these without explicit instruction.

**Frontend Rules**
- Screen.jsx overflow settings are intentional. Do not change them.
- All styling is inline. Never add CSS files or introduce a CSS framework.
- Design tokens live in src/constants/theme.js (R object) and src/constants/adminTheme.js (AD object). Never hardcode colors, fonts, or spacing values outside these files.
- Icons: Phosphor Icons v2.1.1 only. No other icon library.
- WARMUP_ENTRIES_SERVER in the backend must always stay in sync with WARMUP_ENTRIES in shouts.js.
- react-hooks/exhaustive-deps warnings are hard Vercel build errors. Every useEffect with intentionally omitted dependencies must have // eslint-disable-next-line react-hooks/exhaustive-deps on the line immediately above the dependency array.
- Never display a referral bonus dollar amount on a pipeline card at `sold` stage — the job is in progress and no conversion record exists yet. Bonus amounts are only shown on `complete` stage cards, sourced from `referral_conversions.bonus_amount`.

**Code Quality**
- No .then() chains anywhere. All async code uses async/await.
- No var declarations. Use const or let.
- No callback patterns. Use async/await.
- No class components except ErrorBoundary.jsx — intentional exception, React requires class components for error boundaries.
- Every async function must have try/catch. No unhandled promise rejections.
- Error responses must never expose internal stack traces or database details to the client.
- No console.log in production code paths. Diagnostic logs marked with // diagnostic log — intentional are the only exception.
- User-sourced strings and CRM-sourced strings embedded in HTML emails must be HTML-escaped before insertion. Use the escapeHtml helper in pendingReferral.js. Escape <, >, &, and " at minimum.
- The silent audit rule applies to every file read during any session: check for .then() chains, var declarations, callback patterns, class components, missing try/catch, and hardcoded contractor_id — flag all violations before proceeding with the assigned task.

**Architecture Boundaries**
- server.js is a 23-line entry point only. No route handlers or business logic in server.js.
- App.js is a 135-line routing shell only. No component code in App.js.
- pendingReferral.js is a utility file. No route handling or middleware in it.
- New referrer routes → server/routes/referrer.js only.
- New admin routes → server/routes/admin.js only.
- New CRM adapters → server/crm/[name].js, wired through server/crm/index.js.
- getCRMAdapter(contractorId) in crm/index.js is the FORA multi-contractor hook. Never bypass it by importing a CRM adapter directly in a route file.
- Retry helpers → server/utils/retryHelpers.js. Never redefine resendShouldRetry, twilioShouldRetry, or jobberShouldRetry locally in any file.
- New cron jobs → create `server/cron/jobs/[name].js`, add seed row to `cron_job_locks` in `initDB()`, export a named start function (e.g. `startMyJob`) and call it in `server/cron/index.js`. All jobs must use `withLock()` from `server/cron/withLock.js`.

---

### Feature Registry — Completed Features and Their Rules

When building anything that touches a listed feature, read its entry before writing code.

---

**Authentication System**
- Files: server/routes/referrer.js, server/routes/admin.js, server/middleware/auth.js, server/db.js
- Email + PIN for referrers, password for admins; both get 64-char hex session tokens with a role column (referrer/admin), expiring after 24 hours.

**Referral Pipeline System**
- Files: server/crm/jobber.js, server/crm/pipelineSync.js, server/db.js
- Syncs Jobber clients with "Referred by" field through lead → inspection → sold → paid; one bonus conversion per client enforced by UNIQUE(user_id, jobber_client_id).

**Pipeline Display (frontend status mapping)**
- Files: server/crm/jobber.js (`fetchPipelineForReferrer`), server/routes/referrer.js (stale cache fallback), src/constants/theme.js (STATUS_CONFIG), src/components/referrer/ProfileTab.jsx
- `pipeline_status` DB values map to frontend status keys as follows:
  - `'lead'` → `'lead'` ("Lead Submitted")
  - `'inspection'` → `'inspection'` ("Inspection Completed")
  - `'sold'` → `'sold'` ("Sold ✓") — job in progress, no bonus displayed
  - `'paid'` → `'complete'` ("Complete ✓") — invoice paid, bonus confirmed
  - `'not_sold'` → `'closed'` ("Not Sold")
- Bonus amount on `complete` cards is sourced from `referral_conversions.bonus_amount` (the `conversion_bonus` field returned by `fetchPipelineForReferrer`), with speculative `payout` as fallback if no conversion record exists yet.
- `sold` cards show "Pending completion" — never show a dollar amount at this stage.
- The DB column `pipeline_status` is never changed by this mapping — admin views read raw DB values and are unaffected.

**Pending Referral System**
- Files: server/utils/pendingReferral.js, server/utils/retryHelpers.js, server/crm/pipelineSync.js, server/routes/webhooks/jobber.js, server/routes/referrer.js, server/routes/admin.js, src/components/referrer/PendingMatchPopup.jsx, src/components/admin/AdminPendingReferrals.jsx
- Creates a pending_referrals record for referred clients whose referrers have no app account, auto-invites via email, and credits them on signup verification.

**Cash Out System**
- Files: server/routes/referrer.js, server/routes/admin.js, server/db.js
- Referrers request payouts ($20 min, server-side); admins approve or deny, triggering payout_announcements and a Resend email; Stripe ACH not yet built — currently manual.

**Manage Account**
- Files: server/routes/account.js, src/components/referrer/ManageAccount.jsx, src/components/referrer/ProfileTab.jsx
- Collapsible Profile tab section for personal info, security (TOTP), privacy, and soft-delete with 30-day retention before permanent purge.

**Error Monitoring System**
- Files: server/middleware/errorLogger.js, server/db.js, src/utils/clientErrorReporter.js, src/components/shared/ErrorBoundary.jsx
- All errors through logError() into error_log with deduplication; email alert on first and every 10th recurrence; use resolved=true, never delete rows.

**Database Backup System**
- Files: server/utils/backup.js, server/utils/restore-verify.js, server/routes/admin.js
- Daily 2am UTC cron compresses all tables to .json.gz and uploads to Backblaze B2 (30-day retention); admin has Run Backup Now and Verify Latest Backup buttons (rate-limited 3/hr).

**Announcement / Payout Popup System**
- Files: src/components/referrer/AnnouncementPopup.jsx, server/routes/admin.js, server/db.js
- Admin-configured announcements and payout-triggered popups shown to referrers on login via payout_announcements and announcement_settings tables.

**Invite Link System**
- Files: server/routes/referrer.js, server/routes/admin.js, server/db.js
- Admin and referrers generate invite links routing to signup with email verification via a 6-digit Resend code.

**Admin Panel**
- Files: src/components/admin/ (all files), server/routes/admin.js
- Admin dashboard at ?admin=true covering referrers, cash outs, activity log, announcements, pending referrals, and settings; 15-minute stats cache; all endpoints behind verifyAdminSession().

**Email Notification Suppression**
- Files: server/utils/emailSuppression.js, server/routes/admin/notifications.js, server/db.js, src/components/admin/AdminSettingsNotifications.jsx
- `isEmailSuppressed(contractorId, recipientEmail, triggerKey)` — checks email_opt_outs (opt_out_all) and notification_preferences (per-trigger toggle); fails open on DB error. Wired to all configurable triggers as of Session 68. Permanent triggers (#10, #11, #27, #28, #29, #30) are never gated. Configurable triggers: first_referral_submitted, referral_inspection, referral_sold, referral_lost, referral_reactivated, bonus_earned, first_reward_milestone, reward_earned_no_account, cashout_request_received, cashout_approved, cashout_denied, missing_referral_resolved, profile_photo_uploaded, new_referrer_signup, new_referral_detected, missing_referral_report.

**Cron Job Infrastructure**
- Files: server/cron/index.js, server/cron/withLock.js, server/cron/jobs/pipelineSync.js, server/cron/jobs/sessionCleanup.js, server/cron/jobs/adminCacheExpiry.js, server/cron/jobs/engagementCadence.js, server/cron/jobs/dynamicAudiences.js, server/db.js (cron_job_locks table)
- All scheduled jobs use `withLock(jobName, timeoutMinutes, fn)` — acquires an atomic PostgreSQL row lock from `cron_job_locks`; if the lock is already held (or within timeout), the tick is skipped. This prevents duplicate runs if a job takes longer than its schedule interval.
- `startCronJobs()` called inside the `initDB()` IIFE in server.js immediately after DB is ready. Never call it before initDB resolves — the lock table must exist.
- 5 active jobs: pipeline_sync (30min), session_cleanup (2am daily), admin_cache_expiry (20min), engagement_cadence (6am UTC — M1/M3/M6/M12 post-job emails; exports `startEngagementCadenceJob`), dynamic_audiences (6:10am UTC — re-evaluates saved audience filter sets; exports `startDynamicAudiencesJob`).
- Note: engagementCadence.js and dynamicAudiences.js export named functions (`startEngagementCadenceJob`, `startDynamicAudiencesJob`) rather than `register()`. cron/index.js calls these directly.
- The existing daily backup cron in server.js (lines 80–89) is NOT managed by this system — it predates the cron infrastructure and remains inline.

**Contact Tag System**
- Files: server/utils/tags.js, server/db.js, server/routes/admin/contacts.js, src/constants/adminTheme.js (TAG_COLORS), src/components/admin/TagCloudFilter.jsx, src/components/admin/AdminContactDetailDrawer.jsx, src/components/admin/AdminContactsTab.jsx, src/components/admin/AdminCampaigns.jsx
- Tags are PERSISTENT — written at the moment the underlying fact is recorded, removed when it changes. Never computed on demand.
- `applyTag(pool, contactId, contractorId, tag, source)` — upserts with ON CONFLICT DO UPDATE. `removeTag(pool, contactId, contractorId, tag)` — deletes. `backfillTagsForContacts(pool, contractorId, contactIds)` — additive backfill for an array of contact UUIDs.
- All tag writes are non-blocking fire-and-forget IIFEs — never await in the main request path; never let tag failure affect the primary operation.
- Tag write trigger points: signup (App User), opt-out/resubscribe (Opted Out, SMS Opted Out, Referral Only), Resend bounce (Bounced), Resend click (High Engager), pipeline sync paid status (Paid Customer), webhook referral conversion (Active Referrer), first send in upsertContactRecord (Previously Contacted), Jobber client link (Existing Client), CSV/Jobber import (backfillTagsForContacts).
- source CHECK: `('system', 'jobber', 'jobber_crm', 'admin')`. Only admin-sourced tags can be deleted via the API; system/jobber tags return 403.
- Frontend: `TAG_COLORS` map exported from adminTheme.js. `TagPill` and `TagCloudFilter` shared components in TagCloudFilter.jsx. Tag cloud filter in AdminContactsTab uses tag-summary endpoint + AND/OR EXISTS SQL pattern (Addendum 2). Drawer shows tags with admin add/remove. Campaign ResultsModal shows enriched tag pills per contact.
- `POST /api/admin/campaigns/enrich-contacts` — batch lookup by email, aggregates from contact_send_history, computes Recently Contacted (last 30 days) as non-stored dynamic tag, max 500 emails.

**Dynamic Audiences**
- Files: server/cron/jobs/dynamicAudiences.js, server/routes/admin/campaigns.js, src/components/admin/AdminCampaigns.jsx, server/db.js (dynamic_audiences + dynamic_audience_members tables)
- Audiences tab inside AdminCampaigns.jsx — lives alongside Campaigns and Campaign Contacts tabs; not a standalone nav item.
- Saved tag filter sets (name, description, filter_json: `{tags, mode}`) re-evaluated daily at 6:10am UTC by `startDynamicAudiencesJob()`.
- `filter_json.mode`: 'AND' = contact must have ALL tags; 'OR' = contact must have ANY tag.
- Member sets refreshed atomically per audience: BEGIN → DELETE old members → INSERT new members → UPDATE member_count → COMMIT.
- CRUD via /api/admin/audiences routes in campaigns.js. DELETE is soft (is_active = false) — no hard delete ever.
- Members endpoint: GET /api/admin/audiences/:id/members — returns up to 500, ordered by added_at DESC.

**Engagement Cadence M1/M3/M6/M12**
- Files: server/cron/jobs/engagementCadence.js, server/routes/admin/campaigns.js, src/components/admin/AdminSettingsNotifications.jsx, server/db.js (engagement_cadence_settings + engagement_cadence_log tables)
- Automated post-job emails at 1/3/6/12 months after pipeline_cache.paid_at; deduplication enforced by UNIQUE(contact_id, cadence_month) in engagement_cadence_log.
- Settings managed in AdminSettingsNotifications.jsx under Referrer Notifications → "Post-Job Engagement Cadence" section (4 toggle rows, each with inline subject/body editor).
- Admin can toggle each month on/off (optimistic update + Saved flash) and edit subject/body with token support: `{{first_name}}`, `{{company_name}}`, `{{job_type}}`, `{{install_month}}`, `{{warranty_year}}`, `{{referral_link}}`.
- Settings CRUD via GET /api/admin/engagement-cadence and PUT /api/admin/engagement-cadence/:month in campaigns.js.
- Default rows seeded in initDB() for any contractor in contractor_settings; ON CONFLICT DO NOTHING prevents overwrites.
- paid_at on pipeline_cache is the source of truth for cadence timing — written once on first 'paid' transition, never overwritten.

---

### Pending Features — Design Specs and Current Constraints

Read the current constraints before building any feature below.

---

**Feature: Booking Request Pending State (Pending Referral Feature 2)**
- Booking request via referral link creates a pending pipeline card in the referrer's tab before the job enters Jobber.
- Current constraints: booking_requests table does not yet exist — design it properly before building. The pending referral system (Feature 1) is complete and audited — its table structure should inform the booking_requests schema. Pipeline tab currently reads only from pipeline_cache — the booking request card must integrate without breaking the existing pipeline read path. The isRetry pattern in checkAndCreatePendingReferral is a reference for how to handle retry logic cleanly.
- Do not build until: Explicitly scheduled by Danny.

**Feature: Missing Referral Self-Report (Pending Referral Feature 3)**
- Profile tab popup with 5-option channel dropdown creates a purple admin inbox thread for manual credit investigation.
- Current constraints: No admin inbox thread system exists yet — this feature requires building it. Channel dropdown options are locked per Session 25.5 design. Purple color must use AD design tokens. Admin inbox is separate from the existing activity log — it is a new UI surface.
- Do not build until: Explicitly scheduled by Danny. Standalone — no dependency on Feature 2.

**Feature: Stripe ACH Payout Pipeline**
- Stripe Connect Standard — each contractor's own Stripe account, RoofMiles orchestrates ACH payouts without holding funds.
- Current constraints: server/routes/stripe.js placeholder exists — build into it. Stripe Connect Standard confirmed — do not propose Express or platform payouts (avoids money transmitter licensing). $20 minimum cashout threshold enforced server-side must be respected by Stripe pipeline. Payout approval must trigger payout_announcements row. Determine with Danny whether pipeline is fully automatic or still admin-approved.
- Do not build until: Stripe Connect account registered. Explicitly scheduled by Danny.

**Feature: Vite Migration**
- Replace Create React App with Vite — pure toolchain swap, no functional changes, closes 26 npm audit vulnerabilities.
- Current constraints: 26 vulnerabilities are all CRA build toolchain — none reachable in production. Test on staging branch first, never directly on main. All env vars prefixed REACT_APP_ may need renaming to VITE_ — audit all references before migrating.
- Do not build until: Explicitly scheduled by Danny.

**Feature: ServiceTitan CRM Adapter**
- Implement fetchPipeline() in server/crm/servicetitan.js via the getCRMAdapter() dispatcher.
- Current constraints: Accent Roofing migrating to ServiceTitan within approximately 6 months from April 2026. Do not bypass getCRMAdapter(). ServiceTitan API auth is different from Jobber OAuth — research before building. fetchPipelineForReferrer() in jobber.js is the reference implementation.
- Do not build until: ServiceTitan API credentials available. Explicitly scheduled by Danny.

**Feature: Full Restore Script**
- One-click admin panel restore button built on restore-verify.js.
- Current constraints: restore-verify.js exists in server/utils/ — build on it. Must require explicit admin confirmation. Must be rate-limited. Must trigger a backup of current state before overwriting.
- Do not build until: Explicitly scheduled by Danny.

**Feature: [STAGING] Error Email Prefix**
- Prefix error alert subjects with [STAGING] in logError() when NODE_ENV === 'staging'.
- Current constraints: Change goes in logError() in server/middleware/errorLogger.js only. Add [STAGING] prefix to email subject when NODE_ENV === 'staging'. Railway staging env var NODE_ENV is already set to staging.
- Can be bundled into any session.

**Feature: Capacitor Mobile Build**
- Native iOS and Android builds via Capacitor for App Store and Google Play.
- Current constraints: Manage Account feature is complete — App Store hard requirement met. Invite email CTA links use placeholder (#) App Store URLs — update after Capacitor build. Apple Developer Account ($99/yr) and Google Play ($25) not yet registered — Danny action item. Twilio 10DLC must be active before submission.
- Do not build until: Developer accounts registered. LLC + EIN complete. Explicitly scheduled by Danny.

**Feature: Pending Referral Bulk Sync Phone/Email Architecture**
- Bulk sync omits phones/emails (API load concern) — credit attribution emails can't fire for scheduled-sync referrals; architectural decision pending.
- Current constraints: Adding phones/emails to bulk query means fetching contact info for potentially hundreds of clients every 30 minutes — significant API load increase. Alternatives to evaluate: fetch contact info only for referred clients (those with a non-empty Referred by field) rather than all clients; or accept the limitation and rely on admin verification for bulk-sync referrals.
- Do not build until: Explicitly scheduled by Danny. Requires architectural decision on API load tradeoff.

**Feature: Master Admin Panel**
- Platform-wide admin panel (Danny only) with cross-contractor insights; requires a separate auth layer.
- Current constraints: Requires separate auth layer from contractor admin. contractor_id must be pulled from session before this works. No build started.
- Do not build until: Second contractor onboarded. Explicitly scheduled by Danny.

**Feature: Referral Program Modes**
- Six planned bonus modes stackable with VIP tier multipliers; only Flat Bonus is currently live.
- Current constraints: Only Flat Bonus is live. Bonus amounts stored at conversion time — any new mode must also store at conversion time. BOOST_TABLE in boostSchedule.js drives current mode. VIP multipliers not built.
- Do not build until: Explicitly scheduled by Danny.
