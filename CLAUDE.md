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
server.js                          ← entry point — imports, middleware, route mounts, scheduled sync, listen
server/
├── db.js                          ← PostgreSQL pool + initDB() — creates/migrates all tables on startup
├── crm/
│   ├── index.js                   ← getCRMAdapter(contractorId) — dispatcher, currently always returns Jobber
│   ├── jobber.js                  ← accessToken, setAccessToken(), refreshTokenIfNeeded(), fetchPipelineForReferrer()
│   ├── pipelineSync.js            ← runFullSync(), runIncrementalSync(), runScheduledSync() — background Jobber sync worker
│   ├── servicetitan.js            ← placeholder — implement fetchPipeline() when ready
│   └── acculynx.js                ← placeholder — implement fetchPipeline() when ready
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
- **crm/pipelineSync.js** — background worker that calls Jobber GraphQL. `runScheduledSync()` is called by server.js on a 30-minute interval (60s startup delay). `runFullSync()` fetches all clients since referral_start_date; `runIncrementalSync()` fetches only clients updated since last sync.
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

**Database tables**: `tokens`, `users` (incl. paid_count + paid_count_updated_at — MVP, see Architectural Principles), `sessions`, `cashout_requests`, `activity_log`, `admin_cache`, `payout_announcements`, `announcement_settings`, `pin_reset_tokens`, `engagement_settings` (incl. season settings), `user_badges` (incl. seen column), `referral_conversions` (incl. bonus_amount INTEGER — dollar amount stored at sync time, source of truth for period-filtered earnings; see pipeline sync comment), `error_log` (incl. count, resolved — never delete rows; use resolved=true to mark fixed), `pipeline_cache` (populated by background sync worker; source of truth for pipeline endpoint), `sync_state` (tracks last_synced_at and initial_sync_complete per contractor), `flagged_referrals` (pre-start-date clients flagged during initial sync for admin review), `verification_codes` (phone and email OTP codes), `leaderboard_settings`, `invite_links`, `contractor_crm_settings` (incl. referral_start_date)

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

Do not wait to be asked. Do not skip files that appear to be "working." If a violation is found, report it and ask whether to fix it before or after the assigned task. Never silently leave a violation in place.

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
- `.claude/skills/ui-designer/` — UI design guidance
- `.claude/skills/ux-designer/` — UX design guidance
- `.claude/skills/ui-ux-pro-max/` — installed Session 15, use for polish passes

Also reference the brand files located at:

`G:\My Drive\Accent Roofing Service\app builder\accent roofing brand kit`

- `accent-roofing-brand-tokens.css` — design tokens (colors, typography, spacing, etc.)
- `accent-roofing-brand-reference.md` — brand guidelines and usage rules

## Deployment

Hosted on Railway (backend) and Vercel (frontend). Environment variables required:
- `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`, `REDIRECT_URI` — Jobber OAuth
- `JOBBER_WEBHOOK_SECRET` — Jobber webhook HMAC verification
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_PASSWORD` — admin panel access (app crashes on startup if missing — intentional)
- `RESEND_API_KEY` — email notifications via Resend
- `RESEND_FROM_EMAIL` — sending address (`noreply@roofmiles.com`)
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

---

### Feature Registry — Completed Features and Their Rules

This registry is the source of truth for every major feature in the system. When building anything that touches a listed feature, read its entry in full before writing code.

---

**Authentication System**
- Status: Complete
- Files: server/routes/referrer.js (referrer login/signup/PIN), server/routes/admin.js (admin login), server/middleware/auth.js, server/db.js (users, sessions tables)
- How it works: Referrers log in with email + PIN (bcrypt hashed). Admins log in with ADMIN_PASSWORD env var. Both receive 64-char hex session tokens stored in the sessions table with a role column. Tokens expire after 24 hours.
- Key rules: role column is the only separator between referrer and admin access. AND role='referrer' and AND role='admin' must always be present in session queries. verifyAdminSession() is the only authorized admin auth check.
- Rate limiters: referrerLoginLimiter (10/15min), forgotPinLimiter (3/15min), resetPinLimiter (10/15min), adminLoginLimiter (5/15min)

**Referral Pipeline System**
- Status: Complete
- Files: server/crm/jobber.js (fetchPipelineForReferrer), server/crm/pipelineSync.js (syncSingleClient, runFullSync, runIncrementalSync), server/db.js (pipeline_cache, referral_conversions tables)
- How it works: Jobber webhook fires on CLIENT_CREATE or CLIENT_UPDATE. syncSingleClient writes client to pipeline_cache. fetchPipelineForReferrer reads pipeline_cache and cross-references with Jobber for quote/job/invoice status. Pipeline stages: lead → inspection → sold → paid.
- Key rules: One conversion per referred client ever, enforced by UNIQUE(user_id, jobber_client_id) on referral_conversions. Referral program start date is 01/01/2026 — historical clients before this date are excluded. Bonus amounts are stored at time of conversion, never recalculated. allClients name matching uses local JavaScript filtering only — never Jobber API name filters. phones and emails are not in the bulk allClients query — only fetched via targeted single-client queries.
- Jobber pagination: cursor-based looping with first:50 cap per query. pipeline_cache stores results. Background sync runs every ~30 minutes.

**Pending Referral System**
- Status: Complete — audited and hardened in Session 38
- Files: server/utils/pendingReferral.js, server/utils/retryHelpers.js, server/crm/pipelineSync.js, server/routes/webhooks/jobber.js, server/routes/referrer.js, server/routes/admin.js, src/components/referrer/PendingMatchPopup.jsx, src/components/referrer/ReferrerApp.jsx, src/components/admin/AdminPendingReferrals.jsx, src/components/admin/AdminApp.jsx, src/components/admin/AdminComponents.jsx
- How it works: When syncSingleClient detects a referred client whose referrer has no app account, a pending_referrals record is created. The referrer's contact info is looked up in Jobber via fetchReferrerContact(). An auto-invite email fires via Resend. When the referrer signs up and verifies their email, matchPendingReferral() matches them by email or phone and credits them. A celebration popup (PendingMatchPopup.jsx) fires on their first login.
- Key rules: Webhook-triggered syncs pass allClients=[] — forces no-match path and admin flagging. The scheduled full sync retries webhook-created records that have needs_admin_verification=true, invite_channel='none', status='pending' — the isRetry path in checkAndCreatePendingReferral handles this. jobber_name_matches JSONB stores id and name only — contact info must be fetched via fetchReferrerContact() at confirm time using the stored Jobber client ID. SMS invites gated by TWILIO_10DLC_ACTIVE=false. Credit attribution email is gated by !isRetry to prevent duplicate sends on retry. getPrimaryEmail and getPrimaryPhone handle both GraphQL array shape and flat-string fallback. pending_referrals records are never hard deleted — close out sets status='closed'. HMAC verification is handled by verifyJobberWebhookSignature() — a single shared function used by all three webhook handlers.
- Known deferred items: PendingMatchPopup copy is placeholder (TODO in code). Invite email copy is placeholder (TODO in code). App Store links in emails are placeholder (#) until Capacitor build. About Us modal renders behind PendingMatchPopup on first login — fix in UI overhaul session. Bulk sync path (allClients) does not fetch phone/email — credit attribution email cannot fire for referrals that enter via scheduled sync rather than webhook. Architectural decision deferred.

**Cash Out System**
- Status: Complete
- Files: server/routes/referrer.js (cashout request), server/routes/admin.js (approve/deny), server/db.js (cashout_requests table)
- How it works: Referrer requests payout from Cash Out tab. Admin approves or denies. Approval triggers payout_announcements row and Resend notification email. $20 minimum cashout threshold enforced server-side.
- Key rules: Balance gate — cashout request rejected if balance insufficient. $20 minimum enforced on server endpoint, not just UI. Stripe ACH pipeline not yet built — cashouts are currently manual.

**Manage Account**
- Status: Complete (Session 32)
- Files: server/routes/account.js, src/components/referrer/ManageAccount.jsx, src/components/referrer/ProfileTab.jsx
- How it works: Collapsible section at bottom of Profile tab. Three toggle tabs: Personal Info, Security, Privacy. Delete Account triggers soft delete (sets deleted_at timestamp). $20 minimum cashout exception applies on deletion — balance auto-cashed out regardless of minimum.
- Key rules: Delete Account is soft delete only. Sets deleted_at + deletion_requested_at. 30-day retention before permanent purge (cron job location marked with TODO). Admin notified via email on deletion. User must type DELETE in modal — enforced in UI and verified server-side. TOTP via speakeasy. Recovery phone and recovery email fields exist on users table.

**Error Monitoring System**
- Status: Complete (Session 34)
- Files: server/middleware/errorLogger.js, server/db.js (error_log table), src/utils/clientErrorReporter.js, src/components/shared/ErrorBoundary.jsx
- How it works: All backend errors route through logError() which upserts to error_log with deduplication, classifies severity, and sends email alert to admin1@roofmiles.com on first occurrence and every 10th recurrence. Frontend errors route through reportClientError() with 60-second deduplication.
- Key rules: Never make API calls inside error handlers — rule-based plain-English explanations only. /api/log-client-error is intentionally public with no auth. Severity: CRITICAL for /cashout /payout /stripe /webhook /auth /token, WARNING for /login /pin /reset /admin, INFO for everything else. Never delete error_log rows — use resolved=true to mark fixed.

**Database Backup System**
- Status: Complete (Session 36)
- Files: server/utils/backup.js, server/utils/restore-verify.js, server/routes/admin.js (backup endpoints)
- How it works: Pure JavaScript backup using pg client. Discovers all tables dynamically. Compresses to .json.gz, uploads to Backblaze B2. Daily cron at 2am UTC. Admin panel has Run Backup Now and Verify Latest Backup buttons. Retains 30 days.
- Key rules: Always run backup before any database migration or risky push. Backup endpoints rate-limited to 3/hr. Full restore script (one-click admin button) not yet built — queued for future session.

**Announcement / Payout Popup System**
- Status: Complete
- Files: src/components/referrer/AnnouncementPopup.jsx, server/routes/admin.js (announcement settings), server/db.js (payout_announcements, announcement_settings tables)
- How it works: Admin configures announcement messages. On login, referrer app checks for unread announcements. Payout approval triggers payout_announcements row which fires celebration popup.
- Key rules: WARMUP_ENTRIES_SERVER must stay in sync with WARMUP_ENTRIES in shouts.js. PendingMatchPopup must take priority over AnnouncementPopup when both present — currently not enforced, fix in UI overhaul session.

**Invite Link System**
- Status: Complete
- Files: server/routes/referrer.js, server/routes/admin.js, server/db.js (contractor_invite_links, email_verifications tables)
- How it works: Admin generates contractor invite links. Referrers generate peer invite links. Links route to signup flow. Email verification required via 6-digit code sent by Resend.
- Key rules: No limit currently enforced on how many links can be generated — known gap for future fix. OAuth flow must complete within a single browser session.

**Admin Panel**
- Status: Complete
- Files: src/components/admin/ (all files), server/routes/admin.js
- How it works: Accessed via ?admin=true URL param. Sections: Dashboard, Referrers, Cash Outs, Activity Log, Announcements, Pending Referrals, Settings. Admin stats cached in admin_cache with 15-minute TTL.
- Key rules: All admin endpoints protected by verifyAdminSession(). Admin token stored in sessionStorage as rb_admin_token. 401 handler clears token and resets loggedIn=false. New admin pages added to src/components/admin/ and wired into AdminApp.jsx and ADMIN_NAV in AdminComponents.jsx.

---

### Pending Features — Design Specs and Current Constraints

When building any feature listed here, read both the original design spec AND the current constraints column before writing a single line of code. These designs were made at a point in time — the constraints column reflects everything that has changed since.

---

**Feature: Booking Request Pending State (Pending Referral Feature 2)**
- Designed: Session 37
- Original spec: Referred person submits a booking request via referral link → a pending pipeline card appears in the referrer's pipeline tab before the job is in Jobber. Reuses infrastructure from the Pending Referral System.
- Current constraints: booking_requests table does not yet exist — design it properly before building. The pending referral system (Feature 1) is complete and audited — its table structure should inform the booking_requests schema. Pipeline tab currently reads only from pipeline_cache — the booking request card must integrate without breaking the existing pipeline read path. The isRetry pattern in checkAndCreatePendingReferral is a reference for how to handle retry logic cleanly.
- Do not build until: Explicitly scheduled by Danny.

**Feature: Missing Referral Self-Report (Pending Referral Feature 3)**
- Designed: Sessions 25.5 and 37
- Original spec: Entry point in Profile tab. Popup form with channel dropdown (5 options: in-app QR code, personal link via app, sent company's direct info via app, sent company's info outside of app, sent salesman's contact info). Creates a purple admin inbox thread for admin to investigate and manually credit.
- Current constraints: No admin inbox thread system exists yet — this feature requires building it. Channel dropdown options are locked per Session 25.5 design. Purple color must use AD design tokens. Admin inbox is separate from the existing activity log — it is a new UI surface.
- Do not build until: Explicitly scheduled by Danny. Standalone — no dependency on Feature 2.

**Feature: Stripe ACH Payout Pipeline**
- Designed: Sessions 24–25
- Original spec: Stripe Connect Standard — each contractor connects their own Stripe account. RoofMiles orchestrates payouts without holding funds. Jobber webhook on invoice paid triggers full payout pipeline. Payout transaction wrapper (BEGIN/COMMIT/ROLLBACK) already in place in admin.js.
- Current constraints: server/routes/stripe.js placeholder exists — build into it. Stripe Connect Standard confirmed — do not propose Express or platform payouts (avoids money transmitter licensing). $20 minimum cashout threshold enforced server-side must be respected by Stripe pipeline. Payout approval must trigger payout_announcements row. Determine with Danny whether pipeline is fully automatic or still admin-approved.
- Do not build until: Stripe Connect account registered. Explicitly scheduled by Danny.

**Feature: Vite Migration**
- Designed: Session 35 range
- Original spec: Replace Create React App with Vite. Closes all 26 remaining npm audit vulnerabilities. No functional changes — pure toolchain swap.
- Current constraints: 26 vulnerabilities are all CRA build toolchain — none reachable in production. Test on staging branch first, never directly on main. All env vars prefixed REACT_APP_ may need renaming to VITE_ — audit all references before migrating.
- Do not build until: Explicitly scheduled by Danny.

**Feature: ServiceTitan CRM Adapter**
- Designed: Session 25 range
- Original spec: server/crm/servicetitan.js placeholder exists. Implement fetchPipeline() when ready. getCRMAdapter() dispatcher already routes by contractorId.
- Current constraints: Accent Roofing migrating to ServiceTitan within approximately 6 months from April 2026. Do not bypass getCRMAdapter(). ServiceTitan API auth is different from Jobber OAuth — research before building. fetchPipelineForReferrer() in jobber.js is the reference implementation.
- Do not build until: ServiceTitan API credentials available. Explicitly scheduled by Danny.

**Feature: Full Restore Script**
- Designed: Session 36
- Original spec: One-click restore button in admin panel. Uses restore-verify.js as foundation.
- Current constraints: restore-verify.js exists in server/utils/ — build on it. Must require explicit admin confirmation. Must be rate-limited. Must trigger a backup of current state before overwriting.
- Do not build until: Explicitly scheduled by Danny.

**Feature: [STAGING] Error Email Prefix**
- Designed: Session 36
- Original spec: Add NODE_ENV=staging check to error emails so staging incidents are distinguishable from production.
- Current constraints: Change goes in logError() in server/middleware/errorLogger.js only. Add [STAGING] prefix to email subject when NODE_ENV === 'staging'. Railway staging env var NODE_ENV is already set to staging.
- Can be bundled into any session — does not need its own dedicated session.

**Feature: Capacitor Mobile Build**
- Designed: Sessions 28–30
- Original spec: Wrap React frontend in Capacitor for native iOS and Android builds. Submit to App Store and Google Play.
- Current constraints: Manage Account feature is complete — App Store hard requirement met. Invite email CTA links use placeholder (#) App Store URLs — update after Capacitor build. Apple Developer Account ($99/yr) and Google Play ($25) not yet registered — Danny action item. Twilio 10DLC must be active before submission.
- Do not build until: Developer accounts registered. LLC + EIN complete. Explicitly scheduled by Danny.

**Feature: Pending Referral Bulk Sync Phone/Email Architecture**
- Designed: Identified in Session 38 audit
- Original spec: The bulk allClients sync query deliberately omits phones and emails to reduce API load. This means getPrimaryEmail and getPrimaryPhone always return null for referrals that enter via the scheduled sync rather than via webhook. The credit attribution email cannot fire for these referrals.
- Current constraints: Adding phones/emails to bulk query means fetching contact info for potentially hundreds of clients every 30 minutes — significant API load increase. Alternatives to evaluate: fetch contact info only for referred clients (those with a non-empty Referred by field) rather than all clients; or accept the limitation and rely on admin verification for bulk-sync referrals.
- Do not build until: Explicitly scheduled by Danny. Requires architectural decision on API load tradeoff.

**Feature: Master Admin Panel**
- Designed: Session 34 range
- Original spec: Danny-only platform-wide admin panel with insights across all contractors.
- Current constraints: Requires separate auth layer from contractor admin. contractor_id must be pulled from session before this works. No build started.
- Do not build until: Second contractor onboarded. Explicitly scheduled by Danny.

**Feature: Referral Program Modes**
- Designed: Session 24
- Original spec: Six modes — Flat Bonus (live), Service-Tiered, Percentage of Job Value, Tiered Milestone, Give & Get, Chain Attribution. Stackable with VIP tier multipliers.
- Current constraints: Only Flat Bonus is live. Bonus amounts stored at conversion time — any new mode must also store at conversion time. BOOST_TABLE in boostSchedule.js drives current mode. VIP multipliers not built.
- Do not build until: Explicitly scheduled by Danny.
