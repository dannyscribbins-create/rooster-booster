# RoofMiles — Architecture Reference

Reference data extracted from `CLAUDE.md` in restructure Phase 1, so that it stops
consuming context in every session. **Nothing in this file is a rule.** Every rule stayed
in `CLAUDE.md`; what moved here is data a reader consults at most once a session, and can
usually derive from the codebase itself.

⚠ **MOVED VERBATIM. NOTHING WAS CORRECTED ON THE WAY IN.** Several blocks below were known
to be stale at the time of the move and are still stale. That is deliberate: a relocation
whose diff also contains corrections is a diff nobody can review. Correcting them is a
separate pass.

Each block keeps its original `CLAUDE.md` heading, at its original heading LEVEL rather
than renormalised for this document, so that a citation naming the heading resolves here
unchanged. `CLAUDE.md` retains the same headings above one-line pointers to this file, so
either half of a citation still lands.

---

### Backend — Folder Structure

⚠ **GENERATED — DO NOT HAND-EDIT.**
Run `npm run architecture` to regenerate, or `npm run architecture -- --check` to report drift.
This block was hand-maintained until 2026-08-23 and had drifted by **30 files and 11
directories** — of which 5 directories are now listed and 6 are suppressed by design (see
`scripts/architecture.js`) — including `server/utils/sessionPolicy.js`, which `CLAUDE.md`'s
session non-negotiable cites by name.

<!-- BEGIN GENERATED STRUCTURE: backend -->
```
server.js                          ← lean entry point (41 lines) — calls createApp(), does not build the app
server/
├── app.js                         ← createApp() factory — all middleware + every app.use() mount, in server.js's old order
├── db.js                          ← PostgreSQL pool + initDB() — creates/migrates all tables on startup
├── referralRules.js               ← evaluateReferral() — referral evaluation engine, imported by invoice-paid webhook
├── constants/
│   └── boostSchedule.js
├── crm/
│   ├── acculynx.js                ← placeholder
│   ├── index.js                   ← getCRMAdapter(contractorId) — multi-contractor dispatcher
│   ├── jobber.js                  ← getContractorAccessToken(contractorId), refreshTokenIfNeeded(contractorId, {force}), fetchPipelineForReferrer() — contractor-scoped token access (TF session)
│   ├── pipelineSync.js            ← runFullSync(), runIncrementalSync(), runScheduledSync()
│   └── servicetitan.js            ← placeholder
├── cron/
│   ├── index.js                   ← startCronJobs() — registers all 7 cron jobs on startup
│   ├── withLock.js                ← withLock(jobName, timeoutMinutes, fn) — atomic job lock
│   └── jobs/
│       ├── adminCacheExpiry.js    ← every 20 min
│       ├── dynamicAudiences.js    ← daily 6:10am UTC — audience re-evaluation
│       ├── engagementCadence.js   ← daily 6am UTC — M1/M3/M6/M12 post-job emails
│       ├── jobberIncrementalSync.js ← daily 2am UTC — Jobber incremental client sync
│       ├── pipelineSync.js        ← every 30 min
│       ├── postJobSequence.js     ← daily 7am UTC — T+24h experience flow
│       └── sessionCleanup.js      ← daily 2am UTC
├── docs/
│   └── email-triggers.md          ← reference doc for email trigger mappings
├── jobs/
│   ├── contactMatchingPass.js     ← runContactMatchingPass() — contact-to-jobber_client matching engine
│   └── fullJobberImport.js        ← full Jobber client import engine (one-time per contractor)
├── middleware/
│   ├── auth.js                    ← verifyAdminSession(), verifyReferrerSession()
│   ├── errorLogger.js             ← logError(), expressErrorHandler()
│   └── permissions.js
├── migrations/
│   ├── add_decision_b_schema.js
│   ├── add_flagged_assignments_status.js
│   ├── add_notification_email_columns.js ← applied, imported in db.js
│   ├── add_payout_columns.js      ← applied (one-time standalone script, superseded by initDB())
│   ├── add_referrer_bank_columns.js ← applied, imported in db.js
│   └── widen_sticky_source_check.js
├── permissions/
│   └── registry.js
├── routes/
│   ├── account.js                 ← all /api/account/* account management endpoints
│   ├── branding.js
│   ├── landing.js
│   ├── oauth.js                   ← GET /auth/jobber, GET /callback
│   ├── referrer.js                ← all /api/* referrer endpoints + rate limiters
│   ├── resendWebhook.js           ← Resend webhook handler (bounces, clicks)
│   ├── session.js
│   ├── stripe.js                  ← placeholder — Stripe ACH payout routes
│   ├── superAdmin.js
│   ├── unsubscribe.js             ← public unsubscribe route
│   ├── admin/
│   │   ├── campaigns.js           ← campaigns, audiences, engagement cadence endpoints
│   │   ├── cashouts.js            ← cash out approval/denial endpoints
│   │   ├── contacts.js            ← contacts, unified contacts, jobber-clients endpoints
│   │   ├── index.js               ← admin route aggregator + notification routes + import routes
│   │   ├── metrics.js             ← admin metrics/stats endpoints
│   │   ├── notifications.js       ← notification preferences endpoints
│   │   ├── referrers.js           ← referrer management endpoints
│   │   └── team.js
│   └── webhooks/
│       ├── jobber.js              ← Jobber webhook handlers (CLIENT_CREATE, CLIENT_UPDATE, INVOICE_UPDATE, JOB_UPDATE, disconnect)
│       └── stripe.js              ← Stripe webhook handler placeholder
├── scripts/
│   └── seedTestTeamMember.js
└── utils/
    ├── adminHelpers.js            ← deriveOptOutType() and admin utility functions
    ├── attributionEngine.js
    ├── b2Media.js
    ├── backup.js                  ← daily backup to Backblaze B2
    ├── brandingTheme.js
    ├── contractorSlug.js
    ├── dateUtils.js               ← getPeriodDateRange() — shared date range calculator
    ├── deriveJobberTags.js        ← derives contact_tags from Jobber CRM data — currently hardcoded to Accent Roofing field labels; must be wired to contractor_field_mappings before contractor #2
    ├── dummyHash.js
    ├── emailSuppression.js        ← isEmailSuppressed(contractorId, recipientEmail, triggerKey)
    ├── encryption.js              ← AES-256-GCM encryption utilities
    ├── frozenAccount.js
    ├── inviteTokens.js
    ├── landingResolve.js
    ├── notificationEmail.js       ← sendAdminNotification(), resolveNotificationRecipient()
    ├── pendingReferral.js         ← checkAndCreatePendingReferral(), escapeHtml(), getPrimaryEmail/Phone()
    ├── restore-verify.js          ← backup verification utility
    ├── retryHelpers.js            ← resendShouldRetry, twilioShouldRetry, jobberShouldRetry, anthropicShouldRetry
    ├── retryWithBackoff.js        ← exponential backoff retry for all external API calls
    ├── sessionPolicy.js
    ├── stripeTransfer.js          ← Stripe transfer utilities
    ├── tagGroupVisibility.js
    ├── tags.js                    ← applyTag(), removeTag(), backfillTagsForContacts()
    ├── themeTokens.js
    └── userPreferences.js
```
<!-- generated 2026-08-31 · HEAD 5bdae0b · 78 files, 15 dirs · npm run architecture -- --check -->
<!-- END GENERATED STRUCTURE: backend -->

> ⚠ **THIS PARAGRAPH EXISTS TWICE — once under each generated block — AND THE TWO COPIES
> MUST MOVE TOGETHER.** The exclusion counts below were **117 / 10** until 2026-08-31 and
> the test figure was stale by **21**, in both copies. It is hand-maintained prose sitting
> directly beneath a block that PRINTS the true number on every run: `npm run architecture
> -- --check` reports `EXCLUDED — test files N` per block (2026-08-31: backend 103 +
> frontend 36). Nothing updates this sentence when a test file is added, so it drifts by
> one every time anyone writes a test and by nothing at all when they do not. **Read the
> check's output; correct this from it rather than from memory** — and prefer teaching
> `scripts/architecture.js` to emit these two numbers into the block over correcting them
> here again.
>
> **Scope of the two blocks above and below.** Code files only: `.js`, `.jsx`, `.mjs`,
> `.css`, `.md`. **Excluded** — 139 test files (`*.test.*` and everything under
> `server/test/`) and 10 asset/binary files (`.png`, `.woff2`, `.txt`). ⚠ `src/index.css`
> is **not** an asset; it is listed. **Directories holding zero listed files are
> suppressed**, because an empty-looking directory cannot be told apart from a genuinely
> empty one: `server/public/`, `server/public/fonts/`, `server/test/`,
> `server/test/helpers/`, `src/assets/`, `src/assets/images/`. ⚠ `server/test/` can never
> reappear by adding a file — its exclusion is path-based, not extension-based.
> The authority for all of this is `scripts/architecture.js`, which prints every
> exclusion and every suppressed directory by name on each run.

---

**Database tables:** tokens, users, sessions, cashout_requests, activity_log, admin_cache, payout_announcements, announcement_settings, pin_reset_tokens, engagement_settings, user_badges, referral_conversions, error_log, pipeline_cache, sync_state, flagged_referrals, verification_codes, leaderboard_settings, invite_links, contractor_crm_settings, notification_preferences, contact_tags, cron_job_locks, dynamic_audiences, dynamic_audience_members, engagement_cadence_settings, engagement_cadence_log, contacts, contact_send_history, email_opt_outs, contractor_settings, jobber_clients, contractor_jobber_fields, referral_schedules, pending_referrals, experience_prompts, experience_invite_tokens, campaign_contacts, notifications, contact_jobber_links, suggestion_box_submissions, referral_schedule_job_types, contractor_field_mappings, admin_messages, flagged_assignments (status lifecycle: open/resolved/dismissed/auto_resolved — see CLAUDE_REGISTRY.md's Flagged Assignments Queue entry)

Note: `client_rep_assignments`, `team_members`, and `titles` are also live tables not yet in this list — out of scope for this edit, flag for a future documentation pass.

---

#### Folder structure
⚠ **GENERATED — DO NOT HAND-EDIT.**
Run `npm run architecture` to regenerate, or `npm run architecture -- --check` to report drift.
This block was hand-maintained until 2026-08-23 and had drifted by **30 files and 11
directories** — of which 5 directories are now listed and 6 are suppressed by design (see
`scripts/architecture.js`) — including `server/utils/sessionPolicy.js`, which `CLAUDE.md`'s
session non-negotiable cites by name.

<!-- BEGIN GENERATED STRUCTURE: frontend -->
```
src/
├── App.jsx
├── index.css
├── index.jsx                       ← Vite entry point, referenced by /index.html
├── reportWebVitals.js
├── setupTests.js                   ← Vitest setup (jest-dom matchers), named by vite.config.mjs
├── __fixtures__/
│   └── adminStats.js
├── components/
│   ├── ContractorTerms.jsx         ← ⚠ same
│   ├── EmailPreferences.jsx        ← public unsubscribe/preferences page (?token=)
│   ├── PrivacyPolicy.jsx           ← ⚠ legal — names the OPERATING ENTITY; blocked on the LLC amendment
│   ├── TermsOfService.jsx          ← ⚠ same
│   ├── admin/
│   │   ├── AdminActivityLog.jsx
│   │   ├── AdminApp.jsx
│   │   ├── AdminCampaignDetail.jsx
│   │   ├── AdminCampaigns.jsx      ← Campaigns + Audiences + Campaign Contacts tabs
│   │   ├── AdminCashOuts.jsx
│   │   ├── AdminComponents.jsx     ← AdminSidebar, AdminShell, StatCard, Badge, Btn, ADMIN_NAV
│   │   ├── AdminContactDetailDrawer.jsx ← accepts contactId OR jobberClientId
│   │   ├── AdminContactsTab.jsx    ← unified contacts table, grouped filter panel, tier filter pills
│   │   ├── AdminDashboard.jsx
│   │   ├── AdminEngagement.jsx
│   │   ├── AdminFlaggedAssignmentsQueue.jsx
│   │   ├── AdminFlaggedReferrals.jsx
│   │   ├── AdminInboxSidebar.jsx
│   │   ├── AdminPendingReferrals.jsx
│   │   ├── AdminReferralReview.jsx ← umbrella: Pending + Missing + Flagged tabs
│   │   ├── AdminReferrers.jsx
│   │   ├── AdminSetPasswordScreen.jsx ← reached by ?admin_invite=; window.location.replace('/') on success
│   │   ├── AdminSettings.jsx       ← main settings hub
│   │   ├── AdminSettingsExperience.jsx ← ExperiencePopup toggle lives here (not Retention page)
│   │   ├── AdminSettingsMyProfile.jsx
│   │   ├── AdminSettingsNotifications.jsx ← the LIVE announcement-preview surface (its orphaned twin was deleted)
│   │   ├── AdminTeamSettings.jsx   ← Manage Team + the flagged-assignments queue tab
│   │   ├── BankingSettings.jsx
│   │   ├── BrandingPreview.jsx
│   │   ├── BrandingProfileSettings.jsx
│   │   ├── CRMSettings.jsx         ← CRM connection, import trigger, import state machine
│   │   ├── CompanyDetailsSettings.jsx
│   │   ├── PermissionGate.jsx      ← fail-closed-while-loading RBAC gate; renders shared/LockedSection when denied
│   │   ├── ReferralProgramSettings.jsx
│   │   ├── ScheduleBuilderDrawer.jsx
│   │   ├── TagCloudFilter.jsx      ← TagPill + TagCloudFilter shared components
│   │   └── __fixtures__/
│   │       └── twoTenantBranding.jsx
│   ├── auth/
│   │   ├── ChoiceScreen.jsx        ← D2 multi-match disambiguation (choice token, 2 min, single-use)
│   │   ├── EmailVerifyScreen.jsx
│   │   ├── FrozenAccountScreen.jsx ← D3 — rendered from the 403 body, with branding, no session
│   │   ├── LoginScreen.jsx         ← the ONE unified door — every role, no ?admin=true
│   │   ├── ResetPinScreen.jsx
│   │   └── SignupScreen.jsx
│   ├── referrer/
│   │   ├── AnnouncementPopup.jsx
│   │   ├── BadgeCelebrationPopup.jsx
│   │   ├── BookingFormModal.jsx
│   │   ├── CashOutTab.jsx
│   │   ├── ContractorAboutModal.jsx
│   │   ├── DashboardTab.jsx
│   │   ├── ExperiencePopup.jsx     ← T+24h post-job flow (good path 5 screens, bad path 3 screens)
│   │   ├── ManageAccount.jsx
│   │   ├── MissingReferralModal.jsx
│   │   ├── PendingMatchPopup.jsx
│   │   ├── ProfileTab.jsx
│   │   ├── RankingsTab.jsx
│   │   ├── ReferAFriendTab.jsx
│   │   ├── ReferrerApp.jsx         ← tab shell + BottomNav
│   │   └── RewardScheduleCard.jsx  ← reads from referral_schedules via API — does NOT use BOOST_TABLE
│   ├── rep/
│   │   ├── RepPlaceholder.jsx      ← 3c placeholder; reached only by tier='general' AND is_field_rep
│   │   └── RepSurface.jsx          ← rep tree root + RepCapabilitiesContext consumer; Phase 3 puts the shell here
│   ├── shared/
│   │   ├── AnimCard.jsx
│   │   ├── AvatarCircle.jsx
│   │   ├── BrandLogo.jsx
│   │   ├── BrandingProvider.jsx
│   │   ├── ContactModal.jsx
│   │   ├── EmptyState.jsx
│   │   ├── ErrorBoundary.jsx       ← class component — intentional exception
│   │   ├── ErrorState.jsx
│   │   ├── LoadingIndicator.jsx    ← spinner + label (keyframe rmSpin, not spin)
│   │   ├── LockedSection.jsx       ← locked-but-visible primitive (page/element modes); moved from admin/ in C/DL-3a Phase 4B — still imports AD, full de-AD-ing is 3b/3c
│   │   ├── Screen.jsx              ← overflow settings intentional — do not change
│   │   ├── Skeleton.jsx            ← loading skeleton — one translucent neutral fill, works on light + dark
│   │   ├── StateCard.jsx           ← shared card shell for the UI-state primitives
│   │   ├── StatusBadge.jsx
│   │   ├── SuccessState.jsx
│   │   └── ThemeProvider.jsx       ← ⚠ mounts the 11 --rm-* vars on its OWN wrapper (Ruling 5); exports useBranding()
│   └── superAdmin/
│       ├── SuperAdminLoginScreen.jsx ← ⚠ GATED OFF by VITE_ENABLE_RM_CONTROL (D-K). Working form, placeholder shell.
│       └── SuperAdminShell.jsx     ← ⚠ same gate. Fully RoofMiles-branded when built — no contractor lockup.
├── config/
│   ├── contractor.js               ← BACKEND_URL + STRIPE_PUBLISHABLE_KEY (platform only)
│   └── featureFlags.js             ← isFlagEnabled() + isRmControlEnabled() — allow-list parse, fails closed
├── constants/
│   ├── adminTheme.js               ← AD admin design tokens + TAG_COLORS
│   ├── badges.js                   ← BADGES array
│   ├── boostSchedule.js            ← BOOST_TABLE + getNextPayout() (predictive UI only)
│   ├── registrySections.mjs
│   ├── shouts.js                   ← WARMUP_ENTRIES (must stay in sync with WARMUP_ENTRIES_SERVER)
│   ├── statusTheme.js              ← STATUS_VARS + STATUS_LIGHT/STATUS_DARK (the six status tokens)
│   └── theme.js                    ← R design tokens + STATUS_CONFIG
├── hooks/
│   ├── useAdminPermissions.js      ← AdminPermissionsContext + usePermissions() — the FIRST createContext in src/
│   └── useEntrance.js
└── utils/
    ├── announcementMessage.js
    ├── authStorage.js              ← the three token keys + logout seam; STORE is the one switch
    ├── brandingChain.js            ← resolveBranding() — the D4 six-source chain + rm_brand_hint
    ├── brandingTheme.mjs           ← ⚠ MIRROR of server/utils/brandingTheme.js — edit both, drift-guarded
    ├── clientErrorReporter.js      ← safeAsync()
    ├── platformIdentity.js
    ├── safeStorage.js              ← safeLocalStorage()/safeSessionStorage() — throw-proof storage access
    └── themeTokens.mjs             ← deriveThemeTokens() + themeCssVariables() + RENDER_TOKEN_KEYS
```
<!-- generated 2026-08-31 · HEAD 5bdae0b · 102 files, 14 dirs · npm run architecture -- --check -->
<!-- END GENERATED STRUCTURE: frontend -->

> ⚠ **THIS PARAGRAPH EXISTS TWICE — once under each generated block — AND THE TWO COPIES
> MUST MOVE TOGETHER.** The exclusion counts below were **117 / 10** until 2026-08-31 and
> the test figure was stale by **21**, in both copies. It is hand-maintained prose sitting
> directly beneath a block that PRINTS the true number on every run: `npm run architecture
> -- --check` reports `EXCLUDED — test files N` per block (2026-08-31: backend 103 +
> frontend 36). Nothing updates this sentence when a test file is added, so it drifts by
> one every time anyone writes a test and by nothing at all when they do not. **Read the
> check's output; correct this from it rather than from memory** — and prefer teaching
> `scripts/architecture.js` to emit these two numbers into the block over correcting them
> here again.
>
> **Scope of the two blocks above and below.** Code files only: `.js`, `.jsx`, `.mjs`,
> `.css`, `.md`. **Excluded** — 139 test files (`*.test.*` and everything under
> `server/test/`) and 10 asset/binary files (`.png`, `.woff2`, `.txt`). ⚠ `src/index.css`
> is **not** an asset; it is listed. **Directories holding zero listed files are
> suppressed**, because an empty-looking directory cannot be told apart from a genuinely
> empty one: `server/public/`, `server/public/fonts/`, `server/test/`,
> `server/test/helpers/`, `src/assets/`, `src/assets/images/`. ⚠ `server/test/` can never
> reappear by adding a file — its exclusion is path-based, not extension-based.
> The authority for all of this is `scripts/architecture.js`, which prints every
> exclusion and every suppressed directory by name on each run.

---

## Periodic Code Health Checklist (every 5–10 sessions)

- `npm audit` — flag HIGH/CRITICAL
- `npm outdated` — flag production deps more than one major version behind
- Grep for `console.log` across server/ — remove any not marked intentional
- Grep for `TODO` and `FIXME` — action or document in handoff
- Check for files in server/ or src/ not in this file's folder structure (above) — the structure moved here from CLAUDE.md in restructure Phase 1
- Confirm server.js has not grown significantly (target: ~40 lines — app construction lives in server/app.js, not here)
- Confirm src/App.jsx has not accumulated component logic

---

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

## Known MVP shortcuts

Moved from `CLAUDE.md`'s **Architectural Principles** in ABR 6A commit 2. The rule stayed
resident — *MVP shortcuts must be flagged with a code comment explaining (a) the limitation,
(b) the scalable version, (c) when to build it* — which is precisely what makes this list
reference: the flag lives in the code, so this is a lookup. **Moved verbatim; nothing
corrected on the way in** (the `contractor_id` line already read RESOLVED).

> **Known MVP shortcuts:**
> - `paid_count` on users table — updated only when referrer loads pipeline. At scale, replace with background cron. Flagged in code: `// MVP: update this to cron-based sync at scale`
> - `contractor_id` resolution — RESOLVED — tenant-resolution rebuild S1-S3; referrer=session-derived, webhooks=accountId-derived.

---

## Deployment

Moved from `CLAUDE.md`'s **Deployment** section in ABR 6A commit 2. Three rules stayed
resident there: *every commit to main auto-deploys*, *local cannot reach Railway PostgreSQL*,
and the `add_payout_columns.js` **do-not-run-again** prohibition. The Jobber API version
header also stays resident under *Never Break → Jobber API*, where it is a rule; the copy
below is the second one. **Moved verbatim; nothing corrected on the way in.**

> Hosted on Railway (backend) and Vercel (frontend). All commits to main auto-deploy to Railway. Vercel may need manual redeploy — dashboard → latest deployment → three dots → Redeploy.
>
> **Jobber API version header: `2026-02-17`** — monitor for deprecation notices.
>
> `DB_QUERIES.md` in project root — reference cheat-sheet of Railway query interface SQL snippets. Accurate and inert.
>
> `server/migrations/` — three one-time migration scripts, all applied. Two imported in db.js (idempotent). One standalone (add_payout_columns.js — superseded by initDB(), do not run again).

---

## The Vite migration — build and lint configuration

Moved from `CLAUDE.md`'s **Commands** section in ABR 6A commit 2. Reference: it explains why
the toolchain is configured as it is, which is lookup-able by definition. The two rules it
carried — `import.meta.env.VITE_*` never `process.env.REACT_APP_*`, and never add an ESLint
preset — stayed resident. **Moved verbatim; nothing corrected on the way in.**

> The frontend builds with **Vite** (`vite.config.mjs`), not create-react-app — react-scripts was removed in the Vite migration. Vercel is configured by `vercel.json` (`framework: vite`, `outputDirectory: dist`). Frontend env vars are `import.meta.env.VITE_*`, never `process.env.REACT_APP_*`.
>
> `npm run lint` is narrow by design: `eslint.config.mjs` enables ONLY `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, with no recommended preset. It reproduces exactly what CRA enforced and nothing more — adding a preset would surface hundreds of never-enforced pre-existing violations. `.npmrc` sets `legacy-peer-deps=true` to handle dependency conflicts.

---

## The Vitest include glob

Moved from `CLAUDE.md`'s **Testing** section in ABR 6A commit 2. The rule — *the two runners
must never overlap; never widen the glob, never point another runner at `server/test/`* —
stayed resident. What moved is the mechanism and the incident. **Moved verbatim; nothing
corrected on the way in.**

> ⚠ `vite.config.mjs` sets `test.include: ['src/**/*.test.{js,jsx}']`. This is NOT cosmetic. Vitest's default glob scans the whole repo and would sweep up `server/test/*.test.js` — and `--test-concurrency=1` is a property of the **node:test invocation**, not of the test files, so another runner importing them bypasses it entirely and executes `initTestDb()`'s `DROP SCHEMA public CASCADE` in parallel workers. That destroyed the local test DB once already. The two runners must never overlap; the include glob is what enforces it structurally rather than by convention.

⚠ **A WORSE VARIANT OF THIS EXISTS AND IS OPEN**, recorded under *Developer setup* in
`PRE_LAUNCH_CHECKLIST.md`: `initTestDb`'s STEPS D/E have no concurrency guard, and unlike the
case above — which `IF EXISTS` made self-healing — that one does not self-heal.
