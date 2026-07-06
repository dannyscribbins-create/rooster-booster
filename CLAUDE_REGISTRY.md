# RoofMiles — Feature Registry & Pending Features

This file is read by Claude Code when working on any feature listed below.
Read this file whenever the session touches a registered feature or pending spec.

---

## Feature Registry — Completed Features

When building anything that touches a listed feature, read its entry before writing code.

---

**Authentication System**
- Files: server/routes/referrer.js, server/routes/admin.js, server/middleware/auth.js, server/db.js
- Email + PIN for referrers, password for admins; both get 64-char hex session tokens with a role column (referrer/admin), expiring after 24 hours.
- Rule: Every session lookup must include AND role = $n AND expires_at > NOW(). Never loosen these filters.

**Referral Pipeline System**
- Files: server/crm/jobber.js, server/crm/pipelineSync.js, server/referralRules.js, server/db.js
- Syncs Jobber clients with "Referred by" field through lead → inspection → sold → paid. One bonus conversion per client enforced by UNIQUE(user_id, jobber_client_id) on referral_conversions.
- server/referralRules.js — evaluateReferral(contractorId, jobberClientId, invoiceData) — core referral evaluation engine imported by invoice-paid webhook. Step 0 guards on invoiceStatus paid. Reads from referral_schedules table. Never hardcode bonus amounts here.

**Pipeline Display (frontend status mapping)**
- Files: server/crm/jobber.js, src/constants/theme.js (STATUS_CONFIG), src/components/referrer/ProfileTab.jsx
- pipeline_status DB values map to frontend: 'lead'→'lead', 'inspection'→'inspection', 'sold'→'sold', 'paid'→'complete'. Never show dollar amount at sold stage. Complete cards read bonus_amount from referral_conversions.
- Bonus amount read path: complete cards use referral_conversions.bonus_amount via conversion_bonus field. RewardScheduleCard.jsx reads from referral_schedules table via GET /api/referrer/schedules (fully DB-driven, does NOT use BOOST_TABLE).
- Cosmetic gap: "Next Payout" in DashboardTab and ProfileTab still uses getNextPayout() from boostSchedule.js — predictive UI only, not used for conversion recording.

**Pending Referral System**
- Files: server/utils/pendingReferral.js, server/utils/retryHelpers.js, server/crm/pipelineSync.js, server/routes/webhooks/jobber.js, server/routes/referrer.js, server/routes/admin/index.js, src/components/referrer/PendingMatchPopup.jsx, src/components/admin/AdminPendingReferrals.jsx
- Creates pending_referrals record for referred clients whose referrers have no app account; auto-invites via email; credits on signup verification.
- Rule: pending_referrals records are never hard deleted. Close-out sets status='closed', closed_out_by_admin=true, closed_out_at=NOW().

**Cash Out System**
- Files: server/routes/admin/cashouts.js, server/routes/referrer.js, server/db.js
- Referrers request payouts ($20 min, server-side enforced); admins approve/deny triggering payout_announcements and Resend email. Approval wrapped in BEGIN/COMMIT/ROLLBACK transaction. Stripe ACH call slot is inside the transaction before COMMIT.

**Manage Account**
- Files: server/routes/account.js, src/components/referrer/ManageAccount.jsx, src/components/referrer/ProfileTab.jsx
- Collapsible Profile tab section: personal info, security (TOTP), privacy, soft-delete with 30-day retention.

**Error Monitoring System**
- Files: server/middleware/errorLogger.js, server/db.js, src/utils/clientErrorReporter.js, src/components/shared/ErrorBoundary.jsx
- All errors through logError() into error_log with deduplication. Email alert on first and every 10th recurrence. Use resolved=true, never delete rows.
- ErrorBoundary.jsx hardcoded colors (#CC0000, #021428) are intentional — renders outside React tree.

**Database Backup System**
- Files: server/utils/backup.js, server/utils/restore-verify.js, server/routes/admin/index.js
- Daily 2am UTC cron compresses all tables to .json.gz, uploads to Backblaze B2 (30-day retention). Admin has Run Backup Now + Verify Latest Backup buttons (rate-limited 3/hr). SELECT * in backup.js is intentional exception — full table export required.

**Announcement / Payout Popup System**
- Files: src/components/referrer/AnnouncementPopup.jsx, server/routes/admin/index.js, server/db.js
- Admin-configured announcements and payout-triggered popups via payout_announcements and announcement_settings tables.

**Invite Link System**
- Files: server/routes/referrer.js, server/routes/admin/index.js, server/db.js
- Admin and referrers generate invite links routing to signup with email verification via 6-digit Resend code.

**Admin Panel**
- Files: src/components/admin/ (all files), server/routes/admin/ (all files)
- Admin dashboard at ?admin=true. Sections: Dashboard, Referrers, Cash Outs, Activity Log, Announcements, Referral Review, Engagement, Settings (CRM, Branding, Company, Banking, Notifications, Experience), Contacts, Campaigns, Inbox. 15-minute stats cache. All endpoints behind verifyAdminSession().

**Email Notification Suppression**
- Files: server/utils/emailSuppression.js, server/routes/admin/notifications.js, server/db.js, src/components/admin/AdminSettingsNotifications.jsx
- isEmailSuppressed(contractorId, recipientEmail, triggerKey) — checks email_opt_outs and notification_preferences. Fails open on DB error. Permanent triggers (#10, #11, #27–#30) never gated.

**Cron Job Infrastructure**
- Files: server/cron/index.js, server/cron/withLock.js, server/cron/jobs/ (all 7 files), server/db.js
- 7 active jobs: pipeline_sync (30min), session_cleanup (2am daily), admin_cache_expiry (20min), engagement_cadence (6am UTC), dynamic_audiences (6:10am UTC), post_job_sequence (7am UTC), jobber_incremental_sync (2am daily).
- All jobs use withLock(jobName, timeoutMinutes, fn). startCronJobs() called after initDB() resolves. To add a job: create jobs/[name].js, add seed row to cron_job_locks in initDB(), call start function in cron/index.js.
- Note: engagementCadence and dynamicAudiences export named functions (startEngagementCadenceJob, startDynamicAudiencesJob). postJobSequence exports startPostJobSequenceJob. jobberIncrementalSync exports startJobberIncrementalSyncJob.
- The legacy daily backup cron in server.js (pre-cron-infrastructure) remains inline and is NOT managed by this system.

**Contact Tag System**
- Files: server/utils/tags.js, server/db.js, server/routes/admin/contacts.js, src/constants/adminTheme.js (TAG_COLORS), src/components/admin/TagCloudFilter.jsx, src/components/admin/AdminContactDetailDrawer.jsx, src/components/admin/AdminContactsTab.jsx, src/components/admin/AdminCampaigns.jsx
- Tags are PERSISTENT — written at the moment the underlying fact is recorded, never computed on demand.
- applyTag(pool, contactId, contractorId, tag, source) — upserts ON CONFLICT DO UPDATE. removeTag(pool, contactId, contractorId, tag) — deletes. All tag writes are non-blocking fire-and-forget IIFEs.
- source CHECK: ('system', 'jobber', 'jobber_crm', 'admin'). Only admin-sourced tags deletable via API.
- tier_1: written at Jobber import — client exists in Jobber only. tier_2: written at RoofMiles event (campaign send, app signup, CSV import).

**Unified Contacts Architecture**
- Files: server/jobs/contactMatchingPass.js, server/routes/admin/contacts.js, src/components/admin/AdminContactsTab.jsx, src/components/admin/AdminContactDetailDrawer.jsx, server/db.js (contact_jobber_links table)
- contact_jobber_links: pre-computed match table. UNIQUE(contact_id, jobber_client_id). Four trigger points: post-import, incremental sync delta, CLIENT_CREATE/UPDATE webhook, new user signup.
- runContactMatchingPass(contractorId, options) — iterates contacts, queries jobber_clients by email/phone, confirms with pg_trgm name similarity >= 0.4. Never throws — always returns { processed, linked, errors }.
- GET /api/admin/contacts/unified — single unified result set. source_badge: both/app/jobber. Supports tier filter (1=Jobber-only, 2=has contact record).
- AdminContactDetailDrawer accepts contactId (UUID) OR jobberClientId (string). Jobber-only drawer omits send history and communication preferences.

**Dynamic Audiences**
- Files: server/cron/jobs/dynamicAudiences.js, server/routes/admin/campaigns.js, src/components/admin/AdminCampaigns.jsx, server/db.js
- Saved tag filter sets re-evaluated daily at 6:10am UTC. filter_json.mode: AND/OR. Member sets refreshed atomically per audience. DELETE is soft (is_active=false) — never hard delete.

**Engagement Cadence M1/M3/M6/M12**
- Files: server/cron/jobs/engagementCadence.js, server/routes/admin/campaigns.js, src/components/admin/AdminSettingsNotifications.jsx, server/db.js
- Automated post-job emails at 1/3/6/12 months after pipeline_cache.paid_at. Deduplication via UNIQUE(contact_id, cadence_month) in engagement_cadence_log. paid_at is written once on first paid transition, never overwritten.
- All Resend sends in this job use retryWithBackoff with resendShouldRetry.

**T+24h Post-Job Experience Sequence**
- Files: server/cron/jobs/postJobSequence.js, server/routes/webhooks/jobber.js (JOB_UPDATE handler), server/routes/referrer.js, src/components/referrer/ExperiencePopup.jsx, server/db.js
- Triggered by JOB_UPDATE webhook when job status = completed AND amount > $0 AND is highest-value job for client. Fires T+24h cron at 7am UTC. Scenario A (app user): pull back into app. Scenario B (non-user): warm welcome email with Sign Up CTA.
- pipeline_cache columns: job_completed_at (written once on trigger, never overwritten), t24_sequence_triggered (set TRUE after cron fires), post_job_modal_shown (set TRUE after user completes flow).
- experience_flow_enabled gate is first check in JOB_UPDATE handler — hard early return if disabled.

**Jobber Client Import System**
- Files: server/jobs/fullJobberImport.js, server/jobs/contactMatchingPass.js, server/routes/admin/index.js (import status + trigger routes), src/components/admin/AdminSettingsCRM.jsx
- Full import: Steps A→B→D→E→C (cheapest first), per-client fetch for B/C/D/E when date filter is active. Token refresh before each step and every 50 pages. Phase 2 runs runContactMatchingPass after import completes.
- importState machine: idle → running → matching → complete/error. Polled every 3s by frontend.
- Tags { nodes { label } } costs 10,305 pts/page — NEVER include in bulk paginated queries.

---

## Pending Features — Design Specs and Current Constraints

Read the current constraints before building any feature below.

---

**Feature: Session 78 — CRM Settings Overhaul (NEXT BUILD)**
- Pipeline Stage Mapping, CRM Field Setup hub, Tag Value Preview, Tag Group Controls.
- Wire deriveJobberTags.js to contractor_field_mappings — replace hardcoded Accent Roofing field labels with dynamic lookup. This is the multi-contractor unlock.
- Files to touch: server/utils/deriveJobberTags.js, server/routes/admin/contacts.js or new CRM route, src/components/admin/CRMSettings.jsx or AdminSettingsCRM.jsx.
- Do not build until: Explicitly scheduled by Danny. Currently queued as next session.

**Feature: Booking Request Pending State (Pending Referral Feature 2)**
- Booking request via referral link creates pending pipeline card before job enters Jobber.
- Current constraints: booking_requests table does not yet exist — design before building. Pipeline tab reads only from pipeline_cache — booking request card must integrate without breaking existing read path.
- Do not build until: Explicitly scheduled by Danny.

**Feature: Missing Referral Self-Report (Pending Referral Feature 3)**
- Profile tab popup with 5-option channel dropdown creates purple admin inbox thread.
- Current constraints: No admin inbox thread system exists yet. Channel dropdown options locked per Session 25.5 design.
- Do not build until: Explicitly scheduled by Danny.

**Feature: Stripe ACH Payout Pipeline**
- Stripe Connect Standard — each contractor's own Stripe account, RoofMiles orchestrates ACH.
- Current constraints: server/routes/stripe.js placeholder exists. $20 minimum enforced server-side. Payout approval must trigger payout_announcements.
- Do not build until: Stripe Connect account registered. LLC amendment complete. Explicitly scheduled by Danny.

**Feature: Vite Migration**
- Replace CRA with Vite — closes 32 npm audit vulnerabilities (all CRA build toolchain).
- Current constraints: Test on staging branch first. All REACT_APP_ env vars may need renaming to VITE_.
- Do not build until: Explicitly scheduled by Danny.

**Feature: ServiceTitan CRM Adapter**
- Implement fetchPipeline() in server/crm/servicetitan.js via getCRMAdapter() dispatcher.
- Current constraints: Do not bypass getCRMAdapter(). Accent Roofing migrating to ServiceTitan ~6 months from April 2026.
- Do not build until: ServiceTitan API credentials available. Explicitly scheduled by Danny.

**Feature: Notification Center UI**
- Bell icon, notification list panel, unread count badge, mark-read on open.
- Current constraints: Backend routes fully built in Session 77 (GET /api/admin/notifications, PATCH /api/admin/notifications/:id/read). Frontend not yet built.
- Do not build until: Explicitly scheduled by Danny.

**Feature: Campaign Builder Audience Step — Unified Pool**
- Update Campaign Builder audience step to pull from GET /api/admin/contacts/unified instead of separate contacts/jobber-clients endpoints.
- Current constraints: Unified endpoint is live. AdminCampaigns.jsx not yet updated.
- Do not build until: Explicitly scheduled by Danny.

**Feature: Capacitor Mobile Build**
- Native iOS/Android builds via Capacitor for App Store and Google Play.
- Current constraints: Apple Developer Account ($99/yr) and Google Play ($25) not yet registered. Twilio 10DLC must be active before submission. Invite email CTAs use placeholder App Store URLs — update after build.
- Do not build until: Developer accounts registered. LLC + EIN complete. Explicitly scheduled by Danny.

**Feature: [STAGING] Error Email Prefix**
- Prefix error alert subjects with [STAGING] in logError() when NODE_ENV === 'staging'.
- Change goes in server/middleware/errorLogger.js only.
- Can be bundled into any session.

**Feature: Master Admin Panel**
- Platform-wide admin panel (Danny only) at ops.roofmiles.com with cross-contractor insights.
- Current constraints: Requires separate auth layer. contractor_id must be session-derived. No build started.
- Do not build until: Second contractor onboarded. Explicitly scheduled by Danny.

**Feature: Referral Program Modes**
- Six planned bonus modes stackable with VIP tier multipliers. Only Flat Bonus currently live.
- Current constraints: Bonus amounts stored at conversion time — any new mode must also store at conversion time.
- Do not build until: Explicitly scheduled by Danny.

**Feature: Full Restore Script**
- One-click admin panel restore button built on restore-verify.js.
- Current constraints: restore-verify.js exists. Must require explicit admin confirmation. Must be rate-limited. Must trigger backup before overwriting.
- Do not build until: Explicitly scheduled by Danny.

**Feature: Pending Referral Bulk Sync Phone/Email Architecture**
- Bulk sync omits phones/emails — credit attribution emails can't fire for scheduled-sync referrals.
- Current constraints: Adding phones/emails to bulk query means significant API load increase. Alternatives: fetch contact info only for referred clients, or accept limitation and rely on admin verification.
- Do not build until: Explicitly scheduled by Danny. Requires architectural decision on API load tradeoff.

**Feature: Permission-Aware UI Rendering (frontend RBAC soft-locks)**
- Admin panel cards/controls that write to permission-gated endpoints currently have no frontend disabled/hidden state — save actions fire unconditionally and the server returns 403 for unauthorized callers.
- Deferred scope: CRM Settings cards (Referrer Field Mapping, Sync Interval, Tag Visibility, Rep Attribution Source — Session 91), and all other admin UI controls whose endpoints are tagged with requirePermission(). When built, sweep all cards in a single pass rather than card-by-card.
- Do not build until: Explicitly scheduled by Danny.

**Feature: Attribution Engine Orphan Self-Resolution (Decision B follow-on)**
- Future consideration: after writing an orphan flag, the engine could still evaluate the provisional step so a later sync pass can promote and self-resolve the orphan without requiring admin review.
- Deferred — matches locked spec as built (Session 92). Currently the orphan path returns immediately with no provisional write.
- Do not build until: Explicitly scheduled by Danny.

---

## Known Issues / Pre-launch Cleanup

**1. Scheduler silent on disconnect + possibly never registered (Session 92 finding)**
- `POST /api/admin/crm/disconnect` deletes the tokens row (`admin/index.js:1101`); `runScheduledSync` (`crm/pipelineSync.js:793`) guards on `SELECT DISTINCT contractor_id FROM tokens WHERE access_token IS NOT NULL` and skips with only `[scheduler] No contractors with tokens — skipping cycle`. HOWEVER live deploy logs (July 2 18:28 EDT deploy, multiple :00/:30 UTC boundaries elapsed) show ZERO [scheduler] lines of ANY kind — neither skip nor start — suggesting `startCronJobs()` may not actually be invoked from the production entry point. Verification pending. Fixes pending review: (a) confirm/repair cron registration, (b) prominent skip logging, (c) sync-staleness alert via logError when `sync_state.last_synced_at` exceeds threshold, (d) launch consideration: contractor OAuth disconnect silently halts their pipeline sync with no recovery signal.

**2. Sync Now button mis-wired (Session 92 finding + decision)**
- `POST /api/admin/crm/sync` (`admin/index.js:1069`) calls `fetchPipelineForReferrer` per referrer and updates `contractor_crm_settings.last_synced_at` (status-card display only) — it does NOT run the pipeline incremental sync, does NOT touch `sync_state`, does NOT exercise `syncSingleClient`/attribution, and logs nothing. DECISION (Danny): keep the feature — its original intent (contractor-facing manual data refresh) is valid — but rewire it to `runIncrementalSync(contractorId)` from `crm/pipelineSync.js` with proper logging. Fix pending its own reviewed build.

**3. fetchFullClient swallows GraphQL errors (Session 92 finding)**
- When the quote-field bug broke the webhook query, `'client-update sync complete'` still logged. Root cause: `_fetchFullClient` calls throw `Error: fetchFullClient: no client returned for id ${clientId}` (webhooks/jobber.js:96–97) when Jobber returns a 200 with `{ data: { client: null } }`. But the caller in both CLIENT_CREATE (line 403–408) and CLIENT_UPDATE (line 474–478) handlers wraps the call in `.catch(err => { console.warn(...); return client; })` — silently falling back to the sparse webhook payload. The `console.warn` is NOT sent to `logError`, so no DB trace or admin alert fires. Result: clients sync with no quotes/jobs/invoices → `classifyPipelineStatus` returns `'lead'` regardless of real status. Fix pending its own reviewed build — add a diagnostic guard matching the `fetchAttributionData` pattern (log via `logError`, not `console.warn`, before returning the fallback).
- SELF-HEALING NOTE: pipeline_cache rows are re-upserted with fresh classification on every sync pass, so the post-hotfix catch-up incremental sync (window back to July 1) automatically repairs any webhook-era 'lead' misclassifications. Verify by spot-checking known sold/paid clients in pipeline_cache after the catch-up run completes.

**4. escapeHtml redefined locally in webhooks/jobber.js (CLAUDE.md violation, pre-existing, found Session 92)**
- `escapeHtml` is defined locally at webhooks/jobber.js lines 3–6 instead of imported from `server/utils/pendingReferral.js` as required by CLAUDE.md. Fix during the catch-block/error-handling audit (cleanup item 1).

**2a. Webhook contractor fallback CONFIRMED LIVE (Session 92 evidence)**
- Deploy logs show all webhook processing under `contractor: accent-roofing` and `[invoice-paid] no access token found` (token is keyed to `accent-roofing-dev`). Two confirmed consequences: (1) invoice-paid webhook token lookups fail under the fallback id, (2) attribution engine no-ops on webhook-triggered updates because rep mappings live under `accent-roofing-dev`. Raises priority of cleanup item 2a (fail-closed contractor resolution).
- **RESOLVED for the referrer-facing path (2026-07-06, launch-blocker fix)**: `server/utils/contractorContext.js` — `getDefaultContractorId()` — reads the single `contractors` row at request time and fails closed (throws + `logError`) unless exactly one row exists, tripping the moment contractor #2 is added. All ~34 hardcoded `'accent-roofing'` occurrences in `server/routes/referrer.js` (verified zero remaining via grep) now resolve through this helper, plus the security fix on `GET /api/referrer/enabled-payout-methods` (dropped client-supplied `:contractorId` param, added `verifyReferrerSession()`). Covered by `server/test/contractorResolution.test.js` (rename-safety pattern).
- **STILL OPEN**: `server/routes/webhooks/jobber.js` (4 occurrences of `req.query.contractorId || payload?.contractor_id || 'accent-roofing'`), plus literals in `stripe.js`, `oauth.js`, `account.js`, `errorLogger.js`, `notificationEmail.js`, `stripeTransfer.js`. When these are swept, **adopt `getDefaultContractorId()` — do not invent a second parallel resolution helper.**

**5. Incremental sync throttle fix — cost calibration pending version-pinned re-run (Session 93 Bug 2)**
- `CONSERVATIVE_REQUESTED_COST = 8055` in `runIncrementalSync` (`crm/pipelineSync.js`) and the `requestedQueryCost`/`actualQueryCost` figures behind the throttle-pacing design were calibrated via live GraphiQL against Jobber's **default API version (2025-04-16)**, not the pinned production version (`2026-02-17`) — the version header did not apply on those calibration runs. The fix (throttleStatus-driven pacing + `clients(first: 25)`) is version-shape-agnostic and functions correctly regardless, but the exact constant and the "customFields contributes only ~150 points" / "quotes(first:10) truncation risk is theoretical" conclusions are provisional pending a re-run of the same calibration queries under `2026-02-17`. Re-run and update/delete this note once confirmed.
- `runFullSync` (`crm/pipelineSync.js`) received the same `clients(first: 25)` reduction and now attaches `graphqlErrors` (including `extensions.cost`) on its no-clients-data throw, so a THROTTLED response is at least distinguishable there — but it still has **no retry or pacing logic at all**, unlike the retrofitted `runIncrementalSync`. Deferred by agreement (Danny, Session 93 Bug 2) since `runFullSync` is not on the 30-min cron path — it only runs on first-time contractor onboarding or as the incomplete-initial-sync fallback. A large first-time import could still hit the same throttle wall and crash outright. Registry item: retrofit `runFullSync` with the same `computeThrottlePaceDelayMs`/`_sleep` pacing pattern (no chunking structure exists there yet to hook the same-window-retry-before-shrink logic into — needs its own design pass).

**6. Attribution engine — Jobber TASKS may trigger false provisional attribution (deferred, live case 2026-07-06)**
- Live case: client `Z2lkOi8vSm9iYmVyL0NsaWVudC8yODA2ODcxNg==` received `provisional_rep_id=5` after a task (not an on-site assessment) was assigned to Daniel Scribbins that day.
- Deferred investigation: verify whether Jobber TASKS surface in the requests/assessment data fetched by `ATTRIBUTION_QUERY` and can trigger provisional attribution. May require distinguishing/blocking task-type items from counting as assessment assignments.
- Do not build until: Explicitly scheduled by Danny. Not investigated yet — this is a registry placeholder only.

---

## Architecture Notes

**Naming collision + rename decision (Session 92)**
- TWO functions named `runIncrementalSync` exist: `server/crm/pipelineSync.js` (updates `pipeline_cache` + `sync_state`, called by the 30-min cron) and `server/cron/jobs/jobberIncrementalSync.js` (updates `jobber_clients`, daily 2am UTC). DECISION (Danny): rename both to function-specific names (e.g. `runPipelineIncrementalSync` / `runJobberClientsIncrementalSync`) during the cleanup pass.
