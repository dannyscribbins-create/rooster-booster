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
