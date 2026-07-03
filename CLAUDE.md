This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **When working on any feature listed in the Feature Registry or Pending Features, read `CLAUDE_REGISTRY.md` before writing any code.**

## Commands
```bash
# Development
npm start          # React frontend on port 3000
node server.js     # Express backend on port 4000

# Production (Railway)
npm install        # build step
node server.js     # start step

# Build
npm run build      # production React build
```

No lint script is configured. `.npmrc` sets `legacy-peer-deps=true` to handle dependency conflicts.

---

## Architectural Principles

Every decision must pass two filters:
1. Will this produce healthy, efficient code unlikely to break?
2. Will this work at large scale — many contractors, many referrers?

MVP shortcuts must be flagged with a code comment explaining: (a) the limitation, (b) the scalable version, (c) when to build it.

**Known MVP shortcuts:**
- `paid_count` on users table — updated only when referrer loads pipeline. At scale, replace with background cron. Flagged in code: `// MVP: update this to cron-based sync at scale`
- `contractor_id` hardcoded as `'accent-roofing'` in all MVP endpoints — must be pulled from session token before contractor #2.

---

## Architecture

**RoofMiles** is a white-label referral rewards SaaS platform — Node.js/Express backend (Railway), React SPA frontend (Vercel), PostgreSQL.

### Backend — Folder Structure

`server.js` is a lean entry point only — imports, middleware, route mounts, cron bootstrap, listen. Do not add route handlers or business logic to server.js.

```
server.js                          ← lean entry point (~80 lines)
server/
├── db.js                          ← PostgreSQL pool + initDB() — creates/migrates all tables on startup
├── referralRules.js               ← evaluateReferral() — referral evaluation engine, imported by invoice-paid webhook
├── crm/
│   ├── index.js                   ← getCRMAdapter(contractorId) — multi-contractor dispatcher
│   ├── jobber.js                  ← accessToken, refreshTokenIfNeeded(), fetchPipelineForReferrer()
│   ├── pipelineSync.js            ← runFullSync(), runIncrementalSync(), runScheduledSync()
│   ├── servicetitan.js            ← placeholder
│   └── acculynx.js                ← placeholder
├── cron/
│   ├── index.js                   ← startCronJobs() — registers all 7 cron jobs on startup
│   ├── withLock.js                ← withLock(jobName, timeoutMinutes, fn) — atomic job lock
│   └── jobs/
│       ├── pipelineSync.js        ← every 30 min
│       ├── sessionCleanup.js      ← daily 2am UTC
│       ├── adminCacheExpiry.js    ← every 20 min
│       ├── engagementCadence.js   ← daily 6am UTC — M1/M3/M6/M12 post-job emails
│       ├── dynamicAudiences.js    ← daily 6:10am UTC — audience re-evaluation
│       ├── postJobSequence.js     ← daily 7am UTC — T+24h experience flow
│       └── jobberIncrementalSync.js ← daily 2am UTC — Jobber incremental client sync
├── jobs/
│   ├── fullJobberImport.js        ← full Jobber client import engine (one-time per contractor)
│   └── contactMatchingPass.js     ← runContactMatchingPass() — contact-to-jobber_client matching engine
├── middleware/
│   ├── auth.js                    ← verifyAdminSession(), verifyReferrerSession()
│   └── errorLogger.js             ← logError(), expressErrorHandler()
├── migrations/
│   ├── add_referrer_bank_columns.js      ← applied, imported in db.js
│   ├── add_notification_email_columns.js ← applied, imported in db.js
│   └── add_payout_columns.js             ← applied (one-time standalone script, superseded by initDB())
├── utils/
│   ├── retryWithBackoff.js        ← exponential backoff retry for all external API calls
│   ├── retryHelpers.js            ← resendShouldRetry, twilioShouldRetry, jobberShouldRetry, anthropicShouldRetry
│   ├── dateUtils.js               ← getPeriodDateRange() — shared date range calculator
│   ├── tags.js                    ← applyTag(), removeTag(), backfillTagsForContacts()
│   ├── pendingReferral.js         ← checkAndCreatePendingReferral(), escapeHtml(), getPrimaryEmail/Phone()
│   ├── emailSuppression.js        ← isEmailSuppressed(contractorId, recipientEmail, triggerKey)
│   ├── notificationEmail.js       ← sendAdminNotification(), resolveNotificationRecipient()
│   ├── backup.js                  ← daily backup to Backblaze B2
│   ├── restore-verify.js          ← backup verification utility
│   ├── encryption.js              ← AES-256-GCM encryption utilities
│   ├── stripeTransfer.js          ← Stripe transfer utilities
│   ├── adminHelpers.js            ← deriveOptOutType() and admin utility functions
│   └── deriveJobberTags.js        ← derives contact_tags from Jobber CRM data — currently hardcoded to Accent Roofing field labels; must be wired to contractor_field_mappings before contractor #2
├── docs/
│   └── email-triggers.md          ← reference doc for email trigger mappings
└── routes/
    ├── oauth.js                   ← GET /auth/jobber, GET /callback
    ├── referrer.js                ← all /api/* referrer endpoints + rate limiters
    ├── account.js                 ← all /api/account/* account management endpoints
    ├── unsubscribe.js             ← public unsubscribe route
    ├── resendWebhook.js           ← Resend webhook handler (bounces, clicks)
    ├── stripe.js                  ← placeholder — Stripe ACH payout routes
    ├── webhooks/
    │   ├── jobber.js              ← Jobber webhook handlers (CLIENT_CREATE, CLIENT_UPDATE, INVOICE_UPDATE, JOB_UPDATE, disconnect)
    │   └── stripe.js              ← Stripe webhook handler placeholder
    └── admin/
        ├── index.js               ← admin route aggregator + notification routes + import routes
        ├── cashouts.js            ← cash out approval/denial endpoints
        ├── contacts.js            ← contacts, unified contacts, jobber-clients endpoints
        ├── campaigns.js           ← campaigns, audiences, engagement cadence endpoints
        ├── notifications.js       ← notification preferences endpoints
        ├── referrers.js           ← referrer management endpoints
        └── metrics.js             ← admin metrics/stats endpoints
```

**Key backend rules:**

- `getCRMAdapter(contractorId)` in crm/index.js is the multi-contractor hook — never import a CRM adapter directly in a route file.
- `retryWithBackoff` correct signature: `retryWithBackoff(() => fn({...}), { shouldRetry: resendShouldRetry })` — second arg is options object, NOT the function directly.
- `logError` correct signature: `logError({ req, error: err, source: 'METHOD /path' })`.
- `escapeHtml` lives in server/utils/pendingReferral.js — import from there, never redefine locally.
- `retryHelpers` (resendShouldRetry, twilioShouldRetry, jobberShouldRetry, anthropicShouldRetry) live in server/utils/retryHelpers.js — import from there, never redefine locally.
- New cron jobs → create server/cron/jobs/[name].js, add seed row to cron_job_locks in initDB(), export named start function, call in server/cron/index.js. All jobs must use withLock().

**Key backend behaviors:**

- Pipeline cache — pipeline endpoint reads from `pipeline_cache` (populated by background sync), not Jobber directly. Stale fallback returns `{ stale: true }`. No cache returns 503.
- Pipeline stages: lead → inspection → sold → paid. DB value `'paid'` maps to frontend key `'complete'` ("Complete ✓").
- `paid_at` on pipeline_cache — written once when pipeline_status first transitions to `'paid'`, never overwritten. Source of truth for cadence timing.
- Webhook security — `/webhooks/*` uses `express.raw()` before `express.json()`. Never remove this — HMAC verification requires the raw buffer.
- Payout safety — cashout approval wrapped in BEGIN/COMMIT/ROLLBACK. Stripe ACH slot is inside the transaction before COMMIT.
- Cron locks — 7 seed rows in cron_job_locks: pipeline_sync, session_cleanup, admin_cache_expiry, engagement_cadence, dynamic_audiences, post_job_sequence, jobber_incremental_sync.
- Error monitoring — all errors through `logError()` into error_log. Resend alert on first occurrence and every 10th recurrence. Severity auto-classified by route path. Never delete error_log rows — use `resolved=true`.
- Rate limiting — referrerLoginLimiter 10/15min, forgotPinLimiter 3/15min, resetPinLimiter 10/15min, signupLimiter 5/60min, verifyEmailLimiter 10/15min, cashoutLimiter 3/60min, bookingLimiter 3/60min, clientErrorLimiter 20/60min, pipelineLimiter 10/5min, adminLoginLimiter 5/15min.

**Database tables:** tokens, users, sessions, cashout_requests, activity_log, admin_cache, payout_announcements, announcement_settings, pin_reset_tokens, engagement_settings, user_badges, referral_conversions, error_log, pipeline_cache, sync_state, flagged_referrals, verification_codes, leaderboard_settings, invite_links, contractor_crm_settings, notification_preferences, contact_tags, cron_job_locks, dynamic_audiences, dynamic_audience_members, engagement_cadence_settings, engagement_cadence_log, contacts, contact_send_history, email_opt_outs, contractor_settings, jobber_clients, contractor_jobber_fields, referral_schedules, pending_referrals, experience_prompts, experience_invite_tokens, campaign_contacts, notifications, contact_jobber_links, suggestion_box_submissions, referral_schedule_job_types, contractor_field_mappings

---

### Frontend — Component Structure

`src/App.js` is a routing shell (~250 lines — has grown beyond original 135-line target; extraction of pipeline state into a custom hook is a future cleanup item). Do not add component code into App.js.

**Two top-level modes:**
- **Referrer app** — 5-tab bottom nav: Home, Refer, Rankings, Cash Out, Profile
- **Admin panel** — accessed via `?admin=true` — sections: Dashboard, Referrers, Cash Outs, Activity Log, Announcements, Referral Review, Engagement, Settings, Contacts, Campaigns, Inbox

#### Folder structure
```
src/
├── App.js
├── config/
│   └── contractor.js               ← CONTRACTOR_CONFIG + BACKEND_URL
├── constants/
│   ├── theme.js                    ← R design tokens + STATUS_CONFIG
│   ├── adminTheme.js               ← AD admin design tokens + TAG_COLORS
│   ├── boostSchedule.js            ← BOOST_TABLE + getNextPayout() (predictive UI only)
│   ├── badges.js                   ← BADGES array
│   └── shouts.js                   ← WARMUP_ENTRIES (must stay in sync with WARMUP_ENTRIES_SERVER)
├── hooks/
│   └── useEntrance.js
└── components/
    ├── shared/
    │   ├── Screen.jsx              ← overflow settings intentional — do not change
    │   ├── AnimCard.jsx
    │   ├── StatusBadge.jsx
    │   ├── AvatarCircle.jsx
    │   ├── ContactModal.jsx
    │   ├── ErrorBoundary.jsx       ← class component — intentional exception
    │   └── Skeleton.jsx            ← loading skeleton component
    ├── auth/
    │   ├── LoginScreen.jsx
    │   ├── ResetPinScreen.jsx
    │   ├── SignupScreen.jsx
    │   └── EmailVerifyScreen.jsx
    ├── referrer/
    │   ├── ReferrerApp.jsx         ← tab shell + BottomNav
    │   ├── DashboardTab.jsx
    │   ├── ReferAFriendTab.jsx
    │   ├── RankingsTab.jsx
    │   ├── CashOutTab.jsx
    │   ├── ProfileTab.jsx
    │   ├── ManageAccount.jsx
    │   ├── RewardScheduleCard.jsx  ← reads from referral_schedules via API — does NOT use BOOST_TABLE
    │   ├── ExperiencePopup.jsx     ← T+24h post-job flow (good path 5 screens, bad path 3 screens)
    │   ├── BookingFormModal.jsx
    │   ├── ContractorAboutModal.jsx
    │   ├── MissingReferralModal.jsx
    │   ├── BadgeCelebrationPopup.jsx
    │   └── AnnouncementPopup.jsx
    └── admin/
        ├── AdminApp.jsx
        ├── AdminComponents.jsx     ← AdminSidebar, AdminShell, StatCard, Badge, Btn, ADMIN_NAV
        ├── AdminDashboard.jsx
        ├── AdminReferrers.jsx
        ├── AdminCashOuts.jsx
        ├── AdminActivityLog.jsx
        ├── AdminAnnouncementSettings.jsx
        ├── AdminPendingReferrals.jsx
        ├── AdminFlaggedReferrals.jsx
        ├── AdminReferralReview.jsx ← umbrella: Pending + Missing + Flagged tabs
        ├── AdminEngagement.jsx
        ├── AdminInboxSidebar.jsx
        ├── AdminAboutUs.jsx
        ├── AdminContactsTab.jsx    ← unified contacts table, grouped filter panel, tier filter pills
        ├── AdminContactDetailDrawer.jsx ← accepts contactId OR jobberClientId
        ├── AdminCampaigns.jsx      ← Campaigns + Audiences + Campaign Contacts tabs
        ├── AdminCampaignDetail.jsx
        ├── AdminSettings.jsx       ← main settings hub
        ├── AdminSettingsNotifications.jsx
        ├── AdminSettingsEngagement.jsx ← ExperiencePopup toggle lives here (not Retention page)
        ├── BankingSettings.jsx
        ├── BrandingPreview.jsx
        ├── BrandingProfileSettings.jsx
        ├── CompanyDetailsSettings.jsx
        ├── CRMSettings.jsx         ← CRM connection, import trigger, import state machine
        ├── ReferralProgramSettings.jsx
        ├── ScheduleBuilderDrawer.jsx
        └── TagCloudFilter.jsx      ← TagPill + TagCloudFilter shared components
```

#### Import conventions
- Referrer: `import { R } from '../../constants/theme'`
- Admin: `import { AD } from '../../constants/adminTheme'`
- Config: `import { BACKEND_URL, CONTRACTOR_CONFIG } from '../../config/contractor'`

#### ESLint note
`react-hooks/exhaustive-deps` warnings are hard Vercel build errors. Every `useEffect` with intentionally omitted dependencies must have `// eslint-disable-next-line react-hooks/exhaustive-deps` on the line immediately above the dependency array.

#### Styling
All styling inline. Never add CSS files. Design tokens: `src/constants/theme.js` (R) and `src/constants/adminTheme.js` (AD).
- Colors: Navy `#012854`, Red `#CC0000`, Light Blue `#D3E3F0`
- Fonts: Montserrat (display), Roboto (body), Roboto Mono (numbers)
- Icons: Phosphor Icons v2.1.1 only
- Mobile-first: 430px max-width with safe-area insets

---

## Contact Matching Standard

Used for: app user linking, unified contacts merge, signup, referral conversion linking, campaign deduplication.

Rule: Contact field (email or phone) is the PRIMARY match key. Name similarity (pg_trgm >= 0.4) is the CONFIRMATION signal.

- HIGH — auto-link: email match + name similarity >= 0.4
- HIGH — auto-link: phone match + name similarity >= 0.4
- MEDIUM — do not auto-link: contact match alone, name unavailable
- LOW — never link: name similarity only, no contact match

Phone normalization: `REGEXP_REPLACE(phone, '[^0-9]', '', 'g')`. COALESCE to `''` for NULLs.
Name normalization: `LOWER(TRIM(first || ' ' || last))`, COALESCE nulls to `''`.
pg_trgm: `CREATE EXTENSION IF NOT EXISTS pg_trgm` (wired in contacts.js at module load).

---

## Code Quality Standards

When reading any file during a session, silently audit and flag violations before proceeding:

- `.then()` chains → must be async/await
- `var` declarations → must be `const` or `let`
- Callbacks → must be async/await
- Class components → must be functional (except ErrorBoundary.jsx — intentional)
- Missing try/catch on async functions → must be wrapped
- Hardcoded contractor_id or credentials → must use env vars or CONTRACTOR_CONFIG
- Unparameterized SQL → always use `$1`/`$2` placeholders, never concatenate user values
- Missing retryWithBackoff on external API calls → all Jobber, Resend, Twilio, Stripe, Anthropic calls must use it
- `SELECT *` returning data to client → always use explicit column lists
- `err.message` or `err.stack` in `res.status(500)` responses → replace with `'Internal server error'`
- `console.log` in production code → remove unless marked `// diagnostic log — intentional`

Report violations and ask whether to fix before or after the assigned task. Never silently leave a violation.

## Dependency Management Standards

- Run `npm audit` before every push to Railway. HIGH/CRITICAL findings must be resolved or explicitly acknowledged.
- Run `npm outdated` at the start of any session touching package.json.
- Never install a new npm package without flagging it to Danny first — state what it does, why it's needed, whether anything already installed could do the job.
- Never install a package for a single use case that a few lines of native Node.js could handle.
- When a feature is removed or rewritten, check whether any package it depended on is now unused. Remove unused packages in the same session.
- devDependencies must never be imported in server/ production code.

## Code Cleanliness Standards

- Dead code must be removed in the same session it is identified — no commented-out functions, unused imports, or orphaned files.
- Every function with non-obvious logic must have a comment explaining what it does, inputs, and outputs.
- Functions longer than 60 lines are a signal to split — flag and discuss before leaving in place.
- Duplicate logic written in more than one file must be extracted to a shared utility in server/utils/ or src/utils/.
- No `console.log` in production code paths. Exception: lines marked `// diagnostic log — intentional`.
- Known complexity debt (do not refactor without explicit scheduling): server/routes/webhooks/jobber.js invoice-paid handler (~460 lines), server/routes/admin/campaigns.js (~3,163 lines).

## Periodic Code Health Checklist (every 5–10 sessions)

- `npm audit` — flag HIGH/CRITICAL
- `npm outdated` — flag production deps more than one major version behind
- Grep for `console.log` across server/ — remove any not marked intentional
- Grep for `TODO` and `FIXME` — action or document in handoff
- Check for files in server/ or src/ not in CLAUDE.md folder structure
- Confirm server.js has not grown significantly (target: ~80 lines)
- Confirm src/App.js has not accumulated component logic

---

## Security Standards

- Never trust identity values from the request — `user_id`, `full_name`, `email` must come from verified session token via DB lookup.
- Session queries must always include `AND role = $n AND expires_at > NOW()`.
- New endpoints handling user data must use `verifyReferrerSession()` — never inline a raw token check.
- All external API calls must use `retryWithBackoff()`.
- Never remove `express.raw()` on `/webhooks/*` in server.js — required for HMAC verification.
- `ADMIN_PASSWORD` must always be a Railway env var — app crashes on startup if missing (intentional).
- `logError()` must be called in every catch block — never use `console.error` alone in production.
- Never delete rows from `error_log` — use `resolved = true`.
- Error responses must never expose `err.message` or `err.stack` to the client.

---

## Brand Standards

For UI/UX work, read:
- `.claude/skills/ui-designer/`
- `.claude/skills/ux-designer/`
- `.claude/skills/ui-ux-pro-max/`

Brand files at `G:\My Drive\Accent Roofing Service\app builder\accent roofing brand kit`.

---

## Deployment

Hosted on Railway (backend) and Vercel (frontend). All commits to main auto-deploy to Railway. Vercel may need manual redeploy — dashboard → latest deployment → three dots → Redeploy.

**Local environment cannot connect to Railway PostgreSQL.** Always test login-dependent features on live deployment.

**Jobber API version header: `2026-02-17`** — monitor for deprecation notices.

`DB_QUERIES.md` in project root — reference cheat-sheet of Railway query interface SQL snippets. Accurate and inert.

`server/migrations/` — three one-time migration scripts, all applied. Two imported in db.js (idempotent). One standalone (add_payout_columns.js — superseded by initDB(), do not run again).

### Environment Variables (Railway)
- `JOBBER_CLIENT_ID`, `JOBBER_CLIENT_SECRET`, `REDIRECT_URI` — Jobber OAuth
- `JOBBER_WEBHOOK_SECRET` — Jobber webhook HMAC verification
- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_PASSWORD` — admin panel access (app crashes on startup if missing — intentional)
- `RESEND_API_KEY` — email via Resend
- `RESEND_FROM_EMAIL` — noreply@roofmiles.com
- `RESEND_WEBHOOK_SECRET` — Svix signing secret for Resend webhook verification
- `FRONTEND_URL` — required for PIN reset email links
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS (blocked until 10DLC)
- `TWILIO_10DLC_ACTIVE` — must remain false until 10DLC registration complete
- `ANTHROPIC_API_KEY` — used by campaigns.js for AI Rapport (raw fetch, no SDK)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe ACH (not yet live)
- `B2_ENDPOINT`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME` — Backblaze B2 backups
- `APP_VERSION` — set to `1.0.0` in Railway production

---

## Testing

- `npm test` runs the suite via Node's built-in `node:test` with `--test-concurrency=1` (the concurrency flag is load-bearing: Node 24 runs test files in parallel by default and the suites share one database).
- Test database is local PostgreSQL at localhost:5432, database `roofmiles_test`, credentials in `.env.test` (gitignored, local-only — never commit).
- `server/test/setup.js` contains a safety interlock: the run aborts unless `DATABASE_URL` points to localhost/127.0.0.1. Tests cannot touch production by construction.
- Rule: run `npm test` before every push. All 43 tests must be green.
- Characterization rule: a failing or surprising test result means STOP and report — never adjust production code to satisfy a test, and never silently adjust a test to satisfy the code. Deliberate behavior changes update the relevant test openly and are documented in the session handoff.

---

## Session Safety Protocol — Run Before Any Code Changes

1. Read this entire CLAUDE.md file
2. If the session touches a feature in the registry, read CLAUDE_REGISTRY.md
3. Read every file that will be touched — in full, before touching it
4. For any function being modified, search the codebase for all call sites and list them
5. Produce a brief impact statement before proceeding

**After completing changes:**
1. Re-read every modified file in full
2. Confirm all imports resolve, no functions renamed/deleted, no logic altered outside target
3. Confirm all useEffect hooks with intentionally omitted deps still have eslint-disable comments
4. Confirm no .then() chains introduced, no console.log added to production paths
5. Run: `git add -A && git commit -m "[descriptive message]" && git push`
6. Never commit a broken or partial state

---

## Never Break These Rules — Non-Negotiable Constraints

### Authentication & Session Security
- Every session token has a role column. Admin endpoints: `AND role='admin'`. Referrer endpoints: `AND role='referrer'`. Never remove these filters.
- `verifyAdminSession()` and `verifyReferrerSession()` are the only authorized ways to protect endpoints. Never inline auth checks.
- Session tokens are 64-char hex from 32 random bytes. Never weaken.
- Sessions expire 24 hours. Never extend TTL without explicit instruction.
- `ADMIN_PASSWORD` in Railway env vars only. Never hardcode.

### Database Integrity
- `UNIQUE(user_id, jobber_client_id)` on referral_conversions enforces one conversion per client ever. Never remove.
- `contractor_id` must be present on every DB write touching contractor-owned data.
- Never use `SELECT *` in production queries (exception: backup.js — documented).
- Never run destructive SQL without explicit instruction and confirmed backup.
- Always click Run Backup Now before any migration or DB-touching push.
- `pending_referrals` records never hard deleted — close-out sets `status='closed'`.
- `ADD CONSTRAINT ... UNIQUE` in a `DO $$` block must catch `WHEN duplicate_object OR duplicate_table` (re-run collides with its own backing index, raising 42P07). `CHECK` constraints only need `duplicate_object` (no backing index). Prefer the `pg_constraint` pre-check pattern (see `tokens_contractor_id_unique` in db.js) for new UNIQUE constraints.

### Jobber API
- All Jobber GraphQL calls wrapped in retryWithBackoff with jobberShouldRetry.
- retryHelpers (resendShouldRetry, twilioShouldRetry, jobberShouldRetry, anthropicShouldRetry) live in server/utils/retryHelpers.js — never redefine locally.
- Jobber API version: `2026-02-17`. Do not change without verifying changelog.
- `ClientFilterAttributes` does NOT support name/firstName/lastName filtering — always filter locally in JS.
- Jobber GraphQL is read-only. Never add mutations without explicit instruction.
- OAuth token refresh handled by `refreshTokenIfNeeded()` — never bypass.
- `getPrimaryEmail`/`getPrimaryPhone` handle both GraphQL array shape and flat-string fallback — never simplify.
- phones/emails absent from bulk allClients sync query intentionally (API load). Only in fetchFullClient and targeted lookups.

### External Services
- All Resend calls: retryWithBackoff with resendShouldRetry.
- All Twilio calls: retryWithBackoff with twilioShouldRetry.
- SMS gated by `TWILIO_10DLC_ACTIVE` env var. Never remove this guard.
- Resend sends from noreply@roofmiles.com. Admin alerts to admin1@roofmiles.com.

### Frontend Rules
- Screen.jsx overflow settings intentional — do not change.
- All styling inline. Never add CSS files or CSS framework.
- Design tokens in theme.js (R) and adminTheme.js (AD). Never hardcode colors/fonts/spacing outside these files.
- Icons: Phosphor Icons v2.1.1 only.
- `WARMUP_ENTRIES_SERVER` must stay in sync with `WARMUP_ENTRIES` in shouts.js.
- Never display referral bonus dollar amount at `sold` stage — bonus only shown at `complete`, from `referral_conversions.bonus_amount`.

### Code Quality
- No `.then()` chains. No `var`. No callbacks. No class components except ErrorBoundary.jsx.
- Every async function must have try/catch.
- Error responses never expose internal stack traces or DB details to client.
- No `console.log` in production code paths (exception: `// diagnostic log — intentional`).
- User-sourced and CRM-sourced strings in HTML emails must be HTML-escaped via `escapeHtml()` in pendingReferral.js.
- Silent audit rule applies on every file read — flag violations before proceeding.

### Architecture Boundaries
- server.js is a lean entry point. No route handlers or business logic.
- App.js is a routing shell. No component code.
- pendingReferral.js is a utility file. No route handling or middleware.
- `getCRMAdapter(contractorId)` is the multi-contractor hook — never bypass.
- New referrer routes → referrer.js. New admin routes → admin/ sub-folder. New CRM adapters → crm/[name].js.
