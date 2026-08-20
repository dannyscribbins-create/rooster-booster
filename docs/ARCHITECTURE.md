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

---

**Database tables:** tokens, users, sessions, cashout_requests, activity_log, admin_cache, payout_announcements, announcement_settings, pin_reset_tokens, engagement_settings, user_badges, referral_conversions, error_log, pipeline_cache, sync_state, flagged_referrals, verification_codes, leaderboard_settings, invite_links, contractor_crm_settings, notification_preferences, contact_tags, cron_job_locks, dynamic_audiences, dynamic_audience_members, engagement_cadence_settings, engagement_cadence_log, contacts, contact_send_history, email_opt_outs, contractor_settings, jobber_clients, contractor_jobber_fields, referral_schedules, pending_referrals, experience_prompts, experience_invite_tokens, campaign_contacts, notifications, contact_jobber_links, suggestion_box_submissions, referral_schedule_job_types, contractor_field_mappings, admin_messages, flagged_assignments (status lifecycle: open/resolved/dismissed/auto_resolved — see CLAUDE_REGISTRY.md's Flagged Assignments Queue entry)

Note: `client_rep_assignments`, `team_members`, and `titles` are also live tables not yet in this list — out of scope for this edit, flag for a future documentation pass.

---

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
