This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **When working on any feature listed in the Feature Registry or Pending Features, read `CLAUDE_REGISTRY.md` before writing any code.**
>
> **`PRE_LAUNCH_CHECKLIST.md` (repo root) is the CANONICAL index of all open and deferred work** — pre-launch items, C/DL-3b-2, C/DL-3c, Decision E, contractor-ID reconciliation, and the named builds. Read it when picking up work or closing a session. Detail stays in the documents it points at; **add what you defer before writing the handoff, not after.**

## Commands
```bash
# Development
npm start          # Vite dev server on port 3000
node server.js     # Express backend on port 4000

# Production (Railway)
npm install        # build step
node server.js     # start step

# Build
npm run build      # production Vite build → dist/

# Quality
npm run lint       # ESLint over src/ — react-hooks rules only
npm test           # lint + server suite + React suite (the single pre-push gate)
```

The frontend builds with **Vite** (`vite.config.mjs`), not create-react-app — react-scripts was removed in the Vite migration. Vercel is configured by `vercel.json` (`framework: vite`, `outputDirectory: dist`). Frontend env vars are `import.meta.env.VITE_*`, never `process.env.REACT_APP_*`.

`npm run lint` is narrow by design: `eslint.config.mjs` enables ONLY `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, with no recommended preset. It reproduces exactly what CRA enforced and nothing more — adding a preset would surface hundreds of never-enforced pre-existing violations. `.npmrc` sets `legacy-peer-deps=true` to handle dependency conflicts.

---

## Architectural Principles

Every decision must pass two filters:
1. Will this produce healthy, efficient code unlikely to break?
2. Will this work at large scale — many contractors, many referrers?

MVP shortcuts must be flagged with a code comment explaining: (a) the limitation, (b) the scalable version, (c) when to build it.

**Known MVP shortcuts:**
- `paid_count` on users table — updated only when referrer loads pipeline. At scale, replace with background cron. Flagged in code: `// MVP: update this to cron-based sync at scale`
- `contractor_id` resolution — RESOLVED — tenant-resolution rebuild S1-S3; referrer=session-derived, webhooks=accountId-derived.

---

## Architecture

**RoofMiles** is a white-label referral rewards SaaS platform — Node.js/Express backend (Railway), React SPA frontend (Vercel), PostgreSQL.

### Backend — Folder Structure

`server.js` is a lean entry point only — dotenv, process-level error handlers, the initDB()/cron bootstrap IIFE, the legacy backup cron, and `app.listen()`. All Express app construction (middleware, all 9 route mounts) lives in `server/app.js`'s `createApp()` factory (tenant-resolution rebuild, S1) — never add route handlers, middleware, or business logic to server.js itself.

```
server.js                          ← lean entry point (41 lines) — calls createApp(), does not build the app
server/
├── app.js                         ← createApp() factory — all middleware + all 9 app.use() mounts, in server.js's old order
├── db.js                          ← PostgreSQL pool + initDB() — creates/migrates all tables on startup
├── referralRules.js               ← evaluateReferral() — referral evaluation engine, imported by invoice-paid webhook
├── crm/
│   ├── index.js                   ← getCRMAdapter(contractorId) — multi-contractor dispatcher
│   ├── jobber.js                  ← getContractorAccessToken(contractorId), refreshTokenIfNeeded(contractorId, {force}), fetchPipelineForReferrer() — contractor-scoped token access (TF session)
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

**Database tables:** tokens, users, sessions, cashout_requests, activity_log, admin_cache, payout_announcements, announcement_settings, pin_reset_tokens, engagement_settings, user_badges, referral_conversions, error_log, pipeline_cache, sync_state, flagged_referrals, verification_codes, leaderboard_settings, invite_links, contractor_crm_settings, notification_preferences, contact_tags, cron_job_locks, dynamic_audiences, dynamic_audience_members, engagement_cadence_settings, engagement_cadence_log, contacts, contact_send_history, email_opt_outs, contractor_settings, jobber_clients, contractor_jobber_fields, referral_schedules, pending_referrals, experience_prompts, experience_invite_tokens, campaign_contacts, notifications, contact_jobber_links, suggestion_box_submissions, referral_schedule_job_types, contractor_field_mappings, admin_messages, flagged_assignments (status lifecycle: open/resolved/dismissed/auto_resolved — see CLAUDE_REGISTRY.md's Flagged Assignments Queue entry)

Note: `client_rep_assignments`, `team_members`, and `titles` are also live tables not yet in this list — out of scope for this edit, flag for a future documentation pass.

---

### Frontend — Component Structure

`src/App.jsx` is a routing shell (~250 lines — has grown beyond original 135-line target; extraction of pipeline state into a custom hook is a future cleanup item). Do not add component code into App.jsx.

**Three top-level surfaces, chosen by IDENTITY — never by URL** (C/DL-3b Phase 5):
- **Referrer app** — 5-tab bottom nav: Home, Refer, Rankings, Cash Out, Profile
- **Field rep** — 3c placeholder today; reached only by `tier='general'` **and** `is_field_rep`
- **Admin panel** — sections: Dashboard, Referrers, Cash Outs, Activity Log, Announcements, Referral Review, Engagement, Settings, Contacts, Campaigns, Inbox

⚠ **`?admin=true` NO LONGER DOES ANYTHING.** This line used to read "Admin panel — accessed via `?admin=true`", and that has been false since Phase 5. One unified door (`src/components/auth/LoginScreen.jsx`) serves every role; `src/App.jsx`'s `surfaceFor()` routes on the authenticated session descriptor, and the query string is not consulted. Typing the parameter gets the same login screen as typing nothing. Several server-side notification emails still build `?admin=true` links — they land correctly on that door, and the inert parameter is queued for the pre-launch literal sweep.

#### Folder structure
```
src/
├── App.jsx
├── index.jsx                       ← Vite entry point, referenced by /index.html
├── reportWebVitals.js
├── setupTests.js                   ← Vitest setup (jest-dom matchers), named by vite.config.mjs
├── config/
│   ├── contractor.js               ← BACKEND_URL + STRIPE_PUBLISHABLE_KEY (platform only)
│   └── featureFlags.js             ← isFlagEnabled() + isRmControlEnabled() — allow-list parse, fails closed
├── constants/
│   ├── theme.js                    ← R design tokens + STATUS_CONFIG
│   ├── adminTheme.js               ← AD admin design tokens + TAG_COLORS
│   ├── statusTheme.js              ← STATUS_VARS + STATUS_LIGHT/STATUS_DARK (the six status tokens)
│   ├── boostSchedule.js            ← BOOST_TABLE + getNextPayout() (predictive UI only)
│   ├── badges.js                   ← BADGES array
│   ├── registrySections.mjs
│   └── shouts.js                   ← WARMUP_ENTRIES (must stay in sync with WARMUP_ENTRIES_SERVER)
├── hooks/
│   ├── useEntrance.js
│   └── useAdminPermissions.js      ← AdminPermissionsContext + usePermissions() — the FIRST createContext in src/
├── utils/
│   ├── authStorage.js              ← the three token keys + logout seam; STORE is the one switch
│   ├── brandingChain.js            ← resolveBranding() — the D4 six-source chain + rm_brand_hint
│   ├── brandingTheme.mjs           ← ⚠ MIRROR of server/utils/brandingTheme.js — edit both, drift-guarded
│   ├── themeTokens.mjs             ← deriveThemeTokens() + themeCssVariables() + RENDER_TOKEN_KEYS
│   ├── safeStorage.js              ← safeLocalStorage()/safeSessionStorage() — throw-proof storage access
│   └── clientErrorReporter.js      ← safeAsync()
└── components/
    ├── PrivacyPolicy.jsx           ← ⚠ legal — names the OPERATING ENTITY; blocked on the LLC amendment
    ├── TermsOfService.jsx          ← ⚠ same
    ├── ContractorTerms.jsx         ← ⚠ same
    ├── EmailPreferences.jsx        ← public unsubscribe/preferences page (?token=)
    ├── shared/
    │   ├── Screen.jsx              ← overflow settings intentional — do not change
    │   ├── AnimCard.jsx
    │   ├── StatusBadge.jsx
    │   ├── AvatarCircle.jsx
    │   ├── ContactModal.jsx
    │   ├── ErrorBoundary.jsx       ← class component — intentional exception
    │   ├── Skeleton.jsx            ← loading skeleton — one translucent neutral fill, works on light + dark
    │   ├── LockedSection.jsx       ← locked-but-visible primitive (page/element modes); moved from admin/ in C/DL-3a Phase 4B — still imports AD, full de-AD-ing is 3b/3c
    │   ├── StateCard.jsx           ← shared card shell for the UI-state primitives
    │   ├── LoadingIndicator.jsx    ← spinner + label (keyframe rmSpin, not spin)
    │   ├── EmptyState.jsx
    │   ├── ErrorState.jsx
    │   ├── SuccessState.jsx
    │   └── ThemeProvider.jsx       ← ⚠ mounts the 11 --rm-* vars on its OWN wrapper (Ruling 5); exports useBranding()
    ├── auth/
    │   ├── LoginScreen.jsx         ← the ONE unified door — every role, no ?admin=true
    │   ├── ResetPinScreen.jsx
    │   ├── SignupScreen.jsx
    │   ├── EmailVerifyScreen.jsx
    │   ├── ChoiceScreen.jsx        ← D2 multi-match disambiguation (choice token, 2 min, single-use)
    │   └── FrozenAccountScreen.jsx ← D3 — rendered from the 403 body, with branding, no session
    ├── rep/
    │   └── RepPlaceholder.jsx      ← 3c placeholder; reached only by tier='general' AND is_field_rep
    ├── superAdmin/
    │   ├── SuperAdminLoginScreen.jsx ← ⚠ GATED OFF by VITE_ENABLE_RM_CONTROL (D-K). Working form, placeholder shell.
    │   └── SuperAdminShell.jsx     ← ⚠ same gate. Fully RoofMiles-branded when built — no contractor lockup.
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
    │   ├── PendingMatchPopup.jsx
    │   └── AnnouncementPopup.jsx
    └── admin/
        ├── AdminApp.jsx
        ├── PermissionGate.jsx      ← fail-closed-while-loading RBAC gate; renders shared/LockedSection when denied
        ├── AdminComponents.jsx     ← AdminSidebar, AdminShell, StatCard, Badge, Btn, ADMIN_NAV
        ├── AdminDashboard.jsx
        ├── AdminReferrers.jsx
        ├── AdminCashOuts.jsx
        ├── AdminActivityLog.jsx
        ├── AdminPendingReferrals.jsx
        ├── AdminFlaggedReferrals.jsx
        ├── AdminFlaggedAssignmentsQueue.jsx
        ├── AdminReferralReview.jsx ← umbrella: Pending + Missing + Flagged tabs
        ├── AdminEngagement.jsx
        ├── AdminInboxSidebar.jsx
        ├── AdminSetPasswordScreen.jsx ← reached by ?admin_invite=; window.location.replace('/') on success
        ├── AdminContactsTab.jsx    ← unified contacts table, grouped filter panel, tier filter pills
        ├── AdminContactDetailDrawer.jsx ← accepts contactId OR jobberClientId
        ├── AdminCampaigns.jsx      ← Campaigns + Audiences + Campaign Contacts tabs
        ├── AdminCampaignDetail.jsx
        ├── AdminSettings.jsx       ← main settings hub
        ├── AdminSettingsNotifications.jsx ← the LIVE announcement-preview surface (its orphaned twin was deleted)
        ├── AdminSettingsExperience.jsx ← ExperiencePopup toggle lives here (not Retention page)
        ├── AdminSettingsMyProfile.jsx
        ├── AdminTeamSettings.jsx   ← Manage Team + the flagged-assignments queue tab
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
- Config: `import { BACKEND_URL } from '../../config/contractor'`
- ⚠ **Contractor identity comes from `useBranding()`** (`src/components/shared/ThemeProvider.jsx`), never from a config module. `CONTRACTOR_CONFIG` was **deleted in C/DL-3b Phase 6** — it held one tenant's name, logo, phone, email, website and review link and shipped them to every contractor. `src/config/contractor.js` is platform-level only and nothing contractor-specific may be added back.

#### ESLint note
Every `useEffect` with intentionally omitted dependencies must have `// eslint-disable-next-line react-hooks/exhaustive-deps` on the line immediately above the dependency array.

Under Vite, ESLint is **not** part of the build — `react-hooks/exhaustive-deps` is no longer a Vercel build error the way it was under CRA's `CI=true`. It is enforced instead by `npm run lint`, which `npm test` runs first, so a violation blocks the pre-push gate rather than the deploy. `eslint.config.mjs` sets `reportUnusedDisableDirectives: 'off'`: `eslint-plugin-react-hooks` v7 understands stable setState setters and refs that the CRA-era v4 flagged, so ~50 existing disable comments now look "unused". They are kept deliberately — they document intent and re-arm if a future plugin version changes its analysis. Do not strip them with `--fix`.

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
- Hardcoded contractor_id or credentials → must use env vars; contractor **identity** comes from `useBranding()` / the D4 branding chain, never a config module
- Unparameterized SQL → always use `$1`/`$2` placeholders, never concatenate user values
- Missing retryWithBackoff on external API calls → all Jobber, Resend, Twilio, Stripe, Anthropic calls must use it
- `SELECT *` returning data to client → always use explicit column lists
- `err.message` or `err.stack` in `res.status(500)` responses → replace with `'Internal server error'`
- `console.log` in production code → remove unless marked `// diagnostic log — intentional`
- A backtick inside a **comment within a template literal** → remove it, or reword

Report violations and ask whether to fix before or after the assigned task. Never silently leave a violation.

**The backtick rule, because it produces no error and is invisible in review.** A stray `` ` `` inside a comment in a template literal *closes the string*. The remainder does not become a syntax error — it parses as an expression, so the file loads, the server boots, and the tests that do not read that value stay green. In the case that established this rule, a backtick in a CSS comment inside `landing.js`'s `PAGE_CSS` turned the stylesheet into `"…first half…" || \`…second half…\``, and `||` short-circuited on the truthy first half: **everything after the comment was silently dropped from the served page** — the hardcoded `#F26A1B` RoofMiles mark and every `@keyframes` rule. Two existing fences caught it; nothing else would have.

This applies to every template literal carrying markup or styles — `server/routes/landing.js`, and the HTML email bodies in `referrer.js`, `admin/campaigns.js` and the cron jobs. Backticks are natural to write in a comment (quoting a CSS property, an operator, a variable name), which is exactly why this is worth a line here. Use plain words or single quotes instead.

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
- Confirm server.js has not grown significantly (target: ~40 lines — app construction lives in server/app.js, not here)
- Confirm src/App.jsx has not accumulated component logic

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

- `npm test` runs the lint step and BOTH suites, and is the single pre-push gate:
  - `npm run lint` — ESLint over `src/`, react-hooks rules only (see Commands above).
  - `npm run test:server` — `node:test` over `server/test/*.test.js` with `--test-concurrency=1` (the concurrency flag is load-bearing: Node 24 runs test files in parallel by default and the suites share one database).
  - `npm run test:react` — **Vitest** + jsdom over `src/**/*.test.{js,jsx}` via `vitest run` (the `run` subcommand is what makes it exit instead of entering watch mode; `npm run test:react:watch` is the interactive one).
  - The three are chained with `&&`, lint → server → react, so a red React test blocks a push exactly like a red server test. Consequence to know: if an earlier step fails, the later ones do not run that invocation.
  - ⚠ `vite.config.mjs` sets `test.include: ['src/**/*.test.{js,jsx}']`. This is NOT cosmetic. Vitest's default glob scans the whole repo and would sweep up `server/test/*.test.js` — and `--test-concurrency=1` is a property of the **node:test invocation**, not of the test files, so another runner importing them bypasses it entirely and executes `initTestDb()`'s `DROP SCHEMA public CASCADE` in parallel workers. That destroyed the local test DB once already. The two runners must never overlap; the include glob is what enforces it structurally rather than by convention.
  - ⚠ These were separate commands until C/DL-2 Phase 3c, and component tests were therefore green only when someone remembered to run them. That is precisely how `BrandingPreview.jsx` drifted to Accent Roofing's palette while the server used RoofMiles' — no test was wrong, none of them ran.
- Never add a React test that only runs under `test:react:watch`, and never split the gate back apart.
- Test database is local PostgreSQL at localhost:5432, database `roofmiles_test`, credentials in `.env.test` (gitignored, local-only — never commit).
- `server/test/setup.js` contains a safety interlock: the run aborts unless `DATABASE_URL` points to localhost/127.0.0.1. Tests cannot touch production by construction.
- Rule: run `npm test` before every push. Lint must be clean and both suites fully green — as of the Vite migration that is **734 server tests and 35 React tests across 6 files**. (Treat the numbers as a tripwire for an unexpectedly SHRINKING suite, not as a target to keep updated by hand. A Vitest file count that jumps far above 6 means the include glob has been widened and is picking up the server suite — see the warning above.)
- Characterization rule: a failing or surprising test result means STOP and report — never adjust production code to satisfy a test, and never silently adjust a test to satisfy the code. Deliberate behavior changes update the relevant test openly and are documented in the session handoff.
- Migration idempotency proofs must include a reproduction seeded with production's actual pre-existing row shapes, not only fresh-schema runs — a test DB rebuilt from scratch every run can never exercise "a real pre-existing row already in some legacy state," which is exactly what breaks in production and never breaks locally. See `CLAUDE_REGISTRY.md` (ST session, Architecture Notes) for the incident that established this.

---

## Test Design — learnings that cost production bugs to acquire

*Read before writing a test, not after it goes green. Every rule below was learned by shipping
something a green suite did not catch.*

### A test's own greenness is not evidence that it tests anything

**Six vacuity instances were found in C/DL-3b, in six different shapes. None was findable by
reading; every one was found by forcing the failure.**

1. **A case row proves nothing until the field exists.** Five rows added to the branding drift
   guard passed vacuously — that guard compares two copies, so a field absent from **both** is
   invisible to it. Rows are scaffolding; **injection is the mechanism.**
2. **An assertion against a state that cannot display the value proves nothing.**
   `BookingFormModal` renders branding only on its success screen, so a test of the idle form
   would have passed whatever the wiring said.
3. **A slice keyed on shared text checks the wrong thing.** `indexOf('You are an expert…')`
   matched the first of **two** prompts while the test claimed to check the second.
4. **An import-based check for a deleted export cannot fail** — under Vite a missing named
   import yields `undefined` rather than throwing. Read the source text instead.
5. **A test asserting a component's DEFAULTED fields cannot see a bug in its NON-DEFAULTED
   one.** This one reached production: the review card asserted `reviewMessage` and
   `reviewButtonText` (both defaulted, both always render) while `reviewUrl` was null and the
   button linked to a stringified `null`.
   **⚠ WHEN A VALUE MAY LEGITIMATELY BE ABSENT, THE ABSENT CASE IS THE PRIMARY TEST.**
6. **A sweep proves a string is ABSENT. It proves NOTHING about whether the code still runs.**
   `AnnouncementPopup` threw a `ReferenceError` on every render while its literal sweep passed
   — the sweep was correct, the component simply no longer ran. **Any file a sweep touches
   needs at least one render test, however trivial.**

**The conclusion:** non-vacuity assertions belong in tests that look **too simple to need
them** — grep-a-file, render-and-check, slice-a-string — because that is exactly where this
keeps happening.

### Sweeps have two independent gaps

- **Formatting, not values.** `770-277-4869` and `7702774869` are the same number and do not
  match. **Normalise before comparing** — strip non-digits for phones; strip scheme, `www.`
  and trailing slash for URLs. A `tel:` href dialled the wrong company through a sweep that
  reported clean.
- **The hand-maintained FILES list — NOT FIXED.** Every sweep iterates a list someone typed.
  New files are invisible until remembered, and **nothing announces the omission**. A clean
  sweep is evidence about the listed files only. Prefer walking a directory tree.

### Retirements need a producer sweep, not only a consumer assertion

Proving a value is ignored is **not** proving nothing depended on it. Grep the **producers**
repo-wide — server routes, email templates, redirects — and enumerate **consumers** repo-wide
too, remembering that a consumer need not sit on the obvious path: any component can read
`window.location` directly.

### Two rules about defaults

- **Canonical-default rule.** When a default exists in two places, **the one that reaches
  production users is canonical**; the other is a copy that drifted.
- **Identity-bearing values get no defaults.** A logo, a review link, a phone number —
  anything that says **who** the contractor is — resolves to `null` when unset, and the
  consumer decides whether to draw the element. Borrowing another contractor's value is a
  white-label breach; fabricating one sends a homeowner somewhere that does not exist. Generic
  copy is the opposite case and may be defaulted freely. **The line is: does the value say
  WHO, or does it say WHAT.**

### A literal can bias generated text without ever appearing in output

An AI prompt whose worked **example** names a real tenant is **instructing** the model toward
it. No sweep of generated copy can catch it. Assert on the **shipped prompt template**.

### Classifying whether a value is "wired up" has five states, not three

Storage, an editor and a validator are three conditions — **delivery is the fourth**, and
**derivability is the fifth**. Both are invisible to a check built from the schema and the
admin panel, because both look complete. Ask: *"does anything carry this to the surface that
needs it?"* and *"can this be constructed from something already stored?"* — and ask the second
about the fields that look **empty**, not the ones that look finished.
→ `CDL_3b_BUILD_SPEC.md` §8.0 categories (d) and (e).

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
5. Run `npm audit` before pushing (per Dependency Management Standards) — resolve or explicitly acknowledge any HIGH/CRITICAL findings before proceeding
6. Run: `git add -A && git commit -m "[descriptive message]" && git push`
7. Never commit a broken or partial state

---

## Never Break These Rules — Non-Negotiable Constraints

### Authentication & Session Security
- Every session token has a role column. Admin endpoints: `AND role='admin'`. Referrer endpoints: `AND role='referrer'`. Never remove these filters.
- `verifyAdminSession()`, `verifyReferrerSession()` and `verifyAnySession()` are the only authorized ways to protect endpoints. Never inline auth checks. (`verifyAnySession()` is the role-agnostic one, added in C/DL-3b Phase 4 for boot rehydration — it exists because a client holding a stored token does not yet know which surface the token belongs to.)
- Session tokens are 64-char hex from 32 random bytes. Never weaken.
- **Session lifetime: a 30-day sliding window with a 90-day absolute cap, one policy for all three roles** (referrer, admin/team, super_admin). `expires_at` is pushed forward on each successful verify, but never past `created_at + 90 days` — the cap is what stops a slide from producing an immortal token. Bumps are throttled to at most one write per session per hour. **The numbers live in exactly one place — `server/utils/sessionPolicy.js` — and `computeSessionSlide()` is the only thing that may write `expires_at`. Never inline a TTL literal at a mint site.**
  - **This replaced a flat 24-hour TTL, extended DELIBERATELY by C/DL-3b decision D7** — recorded here so a future session does not read a stale rule and "restore" it. **The rule itself is unchanged: never alter session lifetime without explicit instruction.** Only the numbers moved.
  - The security control that makes a long session safe is **step-up re-authentication on high-consequence actions**, not a short session. That is a PRE-LAUNCH item (see `CDL_3b_BUILD_SPEC.md` §10) and it is what D7's tradeoff was accepted against. A 30-day session without it is a 30-day key to the money paths.
  - `sessions.created_at` is the cap's anchor. **Never rewrite it on a slide** — doing so makes the 90-day ceiling unreachable and silently uncaps every session.
- Logout is server-side: `POST /api/logout` deletes the session row. Never reduce a logout to clearing client storage — that leaves the bearer token valid for its full remaining lifetime, which is the defect D6 was raised to fix.
- `ADMIN_PASSWORD` in Railway env vars only. Never hardcode.

### Database Integrity
- `UNIQUE(user_id, jobber_client_id)` on referral_conversions enforces one conversion per client ever. Never remove.
- `contractor_id` must be present on every DB write touching contractor-owned data.
- Never use `SELECT *` in production queries (exception: backup.js — documented).
- Never run destructive SQL without explicit instruction and confirmed backup.
- Always click Run Backup Now before any migration or DB-touching push.
- `pending_referrals` records never hard deleted — close-out sets `status='closed'`.
- `ADD CONSTRAINT ... UNIQUE` in a `DO $$` block must catch `WHEN duplicate_object OR duplicate_table` (re-run collides with its own backing index, raising 42P07). `CHECK` constraints only need `duplicate_object` (no backing index). Prefer the `pg_constraint` pre-check pattern (see `tokens_contractor_id_unique` in db.js) for new UNIQUE constraints.
- Every fail-closed migration guard (e.g. "exactly 1 `contractors` row") must be wrapped in a work-remaining check (`IF EXISTS (SELECT 1 FROM <table> WHERE <backfill column> IS NULL) THEN ... END IF`) so it fires while backfill work remains and is a permanent no-op after — otherwise it re-crashes every boot the moment a second `contractors` row exists. See `CLAUDE_REGISTRY.md` (ST session, Architecture Notes) for the incident that surfaced this.

### Jobber API
- All Jobber GraphQL calls wrapped in retryWithBackoff with jobberShouldRetry.
- retryHelpers (resendShouldRetry, twilioShouldRetry, jobberShouldRetry, anthropicShouldRetry) live in server/utils/retryHelpers.js — never redefine locally.
- Jobber API version: `2026-02-17`. Do not change without verifying changelog.
- `ClientFilterAttributes` does NOT support name/firstName/lastName filtering — always filter locally in JS.
- Jobber GraphQL is read-only. Never add mutations without explicit instruction.
- OAuth token refresh handled by `refreshTokenIfNeeded(contractorId, {force})` — never bypass. Token access is contractor-scoped: never read or write the `tokens` table without a `contractor_id` predicate. Use `getContractorAccessToken(contractorId)` for reads — it is the only sanctioned way to read a contractor's access token. `tokens.id` is inert (sequence-filled default, never referenced by application code) — `contractor_id` is the real key.
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
- App.jsx is a routing shell. No component code.
- pendingReferral.js is a utility file. No route handling or middleware.
- `getCRMAdapter(contractorId)` is the multi-contractor hook — never bypass.
- New referrer routes → referrer.js. New admin routes → admin/ sub-folder. New CRM adapters → crm/[name].js.
