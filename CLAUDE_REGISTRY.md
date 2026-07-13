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
- Replace CRA with Vite — closes 38 npm audit vulnerabilities confirmed 2026-07-06 (1 critical, 18 high; all CRA/react-scripts build toolchain — see Known Issues item 7).
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

**2a. Webhook contractor fallback — RESOLVED (Session 94, 2026-07-06)**
- Deploy logs originally showed all webhook processing under `contractor: accent-roofing` and `[invoice-paid] no access token found` (token is keyed to `accent-roofing-dev`). **Correction to the original evidence note**: grep for the exact fallback expression found only 4 occurrences because the `disconnect` handler's copy is a multi-line expression that a single-line grep misses — the real count was **5 occurrences**. Lesson for future sweeps: grep for the fallback literal alone (`'accent-roofing'`), not the full expression, to catch multi-line copies.
- **RESOLVED for the referrer-facing path (2026-07-06, launch-blocker fix)**: `server/utils/contractorContext.js` — `getDefaultContractorId()` — reads the single `contractors` row at request time and fails closed (throws + `logError`) unless exactly one row exists, tripping the moment contractor #2 is added. All ~34 hardcoded `'accent-roofing'` occurrences in `server/routes/referrer.js` (verified zero remaining via grep) now resolve through this helper, plus the security fix on `GET /api/referrer/enabled-payout-methods` (dropped client-supplied `:contractorId` param, added `verifyReferrerSession()`). Covered by `server/test/contractorResolution.test.js` (rename-safety pattern).
- **RESOLVED for the webhook path (Session 94, 2026-07-06)**: all 5 occurrences in `server/routes/webhooks/jobber.js` (`disconnect`, `client-create`, `client-update`, `invoice-paid`, `job-update`) now resolve via `getDefaultContractorId()`. Client-supplied `req.query.contractorId` / `payload?.contractor_id` are no longer trusted for tenancy at all. On resolution failure, each handler acks Jobber with 200 (Jobber retries on non-2xx, but this condition — 0 or 2+ contractor rows — cannot self-resolve within a retry window, so retrying would just hammer a permanent failure) and quarantines the event via `logWebhookResolutionFailure()` (webhook topic + Jobber item id + raw payload captured in `error_log`, so the event can be manually reconciled once the underlying condition is fixed). The 30-min pipeline sync cron is the backstop that eventually reconciles `pipeline_cache` state for any webhook lost this way. Covered by `server/test/webhookContractorResolution.test.js` (all 5 handlers, both fail-closed conditions, rename-safety, and 2d).
- `disconnect` has no registered webhook in the Jobber Developer Center (only CLIENT_CREATE/CLIENT_UPDATE/JOB_UPDATE/INVOICE_UPDATE are subscribed) — it is unreachable from Jobber today. Fixed anyway for consistency with the other four handlers.
- **STILL OPEN**: literals in `stripe.js`, `oauth.js`, `account.js`, `errorLogger.js`, `notificationEmail.js`, `stripeTransfer.js`. When these are swept, resolve `contractor_id` from `verifyAdminSession()`'s or `verifyReferrerSession()`'s returned `contractorId` — do not reintroduce `getDefaultContractorId()` or invent a new singleton-table helper. It was retired in the tenant-resolution rebuild (see `TENANT_RESOLUTION_REBUILD_SPEC.md`) specifically because it cannot support more than one contractor.

**2b. `fullClient.id` non-null guard checking the wrong variable — STALE/RESOLVED (Session 94, 2026-07-06)**
- Original audit note (undated, earlier session) described an INSERT/upsert of a client row in the webhook path guarding on the raw payload variable `clientId` instead of `fullClient.id`, risking a bad row write on the sparse-fallback path. Re-read `upsertAndTagClient()` (`webhooks/jobber.js`) in full on 2026-07-06 — it consistently uses `fullClient.id` at every write site, no guard on a mismatched variable. The code was likely fixed incidentally during Session 92's `fetchFullClient`/`upsertAndTagClient` work. No patch needed.

**2c. Token-refresh coordination gap — RESOLVED-durable (Session 94 mitigation; durable fix shipped TF session, 2026-07-09)**
- Root cause of a chronic live 401 (`error_log` source `POST /webhooks/jobber/invoice-paid — fetchInvoiceWithJobs`, first_seen 2026-06-23, count 241+): Jobber refresh-token rotation is enabled (exchanging a refresh token invalidates the prior one immediately), and `refreshTokenIfNeeded()` (`server/crm/jobber.js`) operated on a single `tokens WHERE id=1` row refreshed independently from ~7 uncoordinated call sites (invoice-paid webhook, 30-min pipeline sync cron ×2, `fullJobberImport.js` ×2, `admin/campaigns.js`, `admin/team.js`, `referrer.js`) with no locking. Confirmed live: two invoice-paid webhooks arriving the same second produced two "Refreshing token..." log lines but only one "Token refreshed" — the loser's request then hit a 401 against Jobber's GraphQL API.
- **Session 94 mitigation** (retry-on-401): `refreshTokenIfNeeded(force)` accepted an optional `force` param. The invoice-paid webhook's `fetchInvoiceWithJobs` call caught a 401 specifically, force-refreshed, re-read the token row, and retried exactly once. Covered by `server/test/invoicePaidWebhook.test.js`.
- **RESOLVED-durable (TF session, 2026-07-09)**: `refreshTokenIfNeeded(contractorId, { force })` is now contractor-scoped (reads/writes `tokens WHERE contractor_id = $1`, not `id=1`) and single-flight guarded — an in-process `Map<contractorId, Promise>` (`inFlightRefreshes` in `server/crm/jobber.js`) collapses concurrent refresh calls for the same contractor into one in-flight exchange; a `force` caller arriving mid-refresh awaits that same promise rather than starting a second exchange, since force only bypasses the expiry check, never the guard. This closes the race at its source rather than only mitigating one call site's symptom. Session 94's 401→force-refresh→retry-once behavior in the invoice-paid webhook is preserved under the new signature. Pinned by regression test `tokenTenancy.test.js` TEST 6.
- **Standing architecture note (D3 upgrade path)**: the single-flight guard is per-process only. If RoofMiles ever runs more than one Railway replica, add a Postgres advisory lock (`pg_advisory_xact_lock(hashtext(contractor_id))`) so the guard is visible across instances. Railway's current config blocks replicas (attached volume) — verified 2026-07-09.

**2d. `logError()` calls in `webhooks/jobber.js` stamped with stale fallback contractor_id — RESOLVED (Session 94, 2026-07-06)**
- `logError()`'s own `contractor_id` resolution (`server/middleware/errorLogger.js`) falls back to `'accent-roofing'` when no `contractorId` is passed and there's no `req.session` (true for all webhook requests — no session middleware on `/webhooks/*`). Every `logError()` call in `webhooks/jobber.js` now passes the handler's resolved `contractorId` explicitly.

**Data-state findings pending Danny's SQL (Session 94, 2026-07-06) — no data migration performed this session**
- `contractor_settings`: **split-brain** — 1 row under `contractor_id='accent-roofing'` and 1 row under `'accent-roofing-dev'`. `contractor_id` is `UNIQUE NOT NULL` (`db.js`), so the two can't be merged with a plain `UPDATE`. Columns the webhook path actually reads: `contractor_field_mappings`, `app_display_name`, `email_sender_name`, `email_footer_text`, `company_name`, `company_email`, `company_phone`. Pending: Danny to run a comparison `SELECT` on both rows for these columns; fix (delete-then-rename, or a column-by-column `COALESCE` merge) to be proposed and run only after that, with a fresh Backblaze backup first.
- `jobber_clients`: 8 orphaned rows under `contractor_id='accent-roofing'` vs 17,564 under `'accent-roofing-dev'` — webhook writes landing in the wrong bucket during the affected window. Verified no current read path (admin contacts UI resolves `contractorId` from the verified admin session, not this literal) queries the 8 orphaned rows. Recommendation: leave as orphaned history, no migration — low value, adds collision risk for no functional benefit.
- `tokens`, `contractor_crm_settings`, `engagement_settings`: confirmed clean — exactly 1 row each, all under `'accent-roofing-dev'`.

**users matching in invoice-paid webhook and pipelineSync — cross-tenant risk (Session 94, 2026-07-06, deferred)**
- `webhooks/jobber.js` invoice-paid's experience-flow user match (`WHERE LOWER(full_name)=...` / email / phone) and `crm/pipelineSync.js`'s referrer-account lookup have **no `contractor_id` filter at all** — a name/email/phone match against `users` could credit the wrong tenant's referrer the moment a second contractor exists. Not touched this session (out of scope for the tenant-resolution fix — the `contractorId` variable being correct doesn't change this, since the query doesn't filter on it at all). Flag before contractor #2 onboards.

**5. Incremental sync throttle fix — cost calibration pending version-pinned re-run (Session 93 Bug 2)**
- `CONSERVATIVE_REQUESTED_COST = 8055` in `runIncrementalSync` (`crm/pipelineSync.js`) and the `requestedQueryCost`/`actualQueryCost` figures behind the throttle-pacing design were calibrated via live GraphiQL against Jobber's **default API version (2025-04-16)**, not the pinned production version (`2026-02-17`) — the version header did not apply on those calibration runs. The fix (throttleStatus-driven pacing + `clients(first: 25)`) is version-shape-agnostic and functions correctly regardless, but the exact constant and the "customFields contributes only ~150 points" / "quotes(first:10) truncation risk is theoretical" conclusions are provisional pending a re-run of the same calibration queries under `2026-02-17`. Re-run and update/delete this note once confirmed.
- `runFullSync` (`crm/pipelineSync.js`) received the same `clients(first: 25)` reduction and now attaches `graphqlErrors` (including `extensions.cost`) on its no-clients-data throw, so a THROTTLED response is at least distinguishable there — but it still has **no retry or pacing logic at all**, unlike the retrofitted `runIncrementalSync`. Deferred by agreement (Danny, Session 93 Bug 2) since `runFullSync` is not on the 30-min cron path — it only runs on first-time contractor onboarding or as the incomplete-initial-sync fallback. A large first-time import could still hit the same throttle wall and crash outright. Registry item: retrofit `runFullSync` with the same `computeThrottlePaceDelayMs`/`_sleep` pacing pattern (no chunking structure exists there yet to hook the same-window-retry-before-shrink logic into — needs its own design pass).

**6. Attribution engine — Jobber TASKS may trigger false provisional attribution (deferred, live case 2026-07-06)**
- Live case: client `Z2lkOi8vSm9iYmVyL0NsaWVudC8yODA2ODcxNg==` received `provisional_rep_id=5` after a task (not an on-site assessment) was assigned to Daniel Scribbins that day.
- Deferred investigation: verify whether Jobber TASKS surface in the requests/assessment data fetched by `ATTRIBUTION_QUERY` and can trigger provisional attribution. May require distinguishing/blocking task-type items from counting as assessment assignments.
- Do not build until: Explicitly scheduled by Danny. Not investigated yet — this is a registry placeholder only.

**7. npm audit — 38 findings acknowledged and deferred (2026-07-06)**
- 38 npm audit findings (1 critical, 18 high) confirmed 2026-07-06, all in the react-scripts/webpack-dev-server build toolchain (shell-quote, underscore/jsonpath/bfj, ws, uuid) — build/dev-time dependencies, not runtime code shipped to users or the production server. Pre-existing, unrelated to the tenant-resolution fix.
- RESOLUTION PATH: the queued Vite migration exits the react-scripts dependency tree and is the actual fix; piecemeal overrides inside react-scripts are not worth the fragility. Fold into the same workstream as the Dependabot sweep (pre-launch cleanup checklist item 5) during roadmap reconciliation.

**8. `payout_announcements` has no `contractor_id` column (ST session Phase 0 finding, 2026-07-13)**
- Verified during ST's Phase 0 checklist (adjacent to `cashout_requests`, which the cashout approval flow writes to it): `payout_announcements` is untenanted at the schema level — no `contractor_id` column exists. Not a live leak today — every write/read is reached through an already-tenant-scoped `cashout_request_id` (cashout approval inserts it inside the now-tenant-scoped approve transaction; the referrer-side read joins through `cashout_requests`, and after ST, that join is implicitly contractor-safe). Deliberately out of ST's scope (spec-fenced: "Do NOT touch: payout_announcements").
- Do not build until: its own scoped fix, before launch/contractor #2 — give it an explicit `contractor_id` column and direct scoping rather than relying on the implicit join-through-cashout_requests safety.

**9. `adminCacheExpiry` cron has deleted 0 rows since inception (ST session Phase 0 finding, 2026-07-13)**
- `server/cron/jobs/adminCacheExpiry.js` runs `DELETE FROM admin_cache WHERE expires_at < NOW()` every 20 minutes. No write site anywhere in the codebase (`admin/metrics.js`'s dashboard-stats upsert, `referrer.js`'s google-rating upsert) ever sets `expires_at` — it's always `NULL`, and `NULL < NOW()` is never `TRUE` in SQL, so the `WHERE` clause never matches a row. The job has been running as a harmless no-op for its entire lifetime. Pre-existing, untouched by ST (spec-fenced: "Do NOT touch... the adminCacheExpiry cron's never-fires expires_at bug").
- Do not build until: its own small pre-launch fix — either have the two write sites set `expires_at` (e.g. `cached_at + INTERVAL '20 minutes'`), or replace the cron's expiry logic with an age check against `cached_at` directly.

---

## Tenant Resolution Rebuild (multi-session effort)

Full build spec: `TENANT_RESOLUTION_REBUILD_SPEC.md`. Tracks the users/sessions schema fix (audit finding F7) + `getDefaultContractorId()` retirement (F1), batched with the `createApp()` refactor per the audit's Fix Sequencing recommendation.

**Session 1 (S1) — COMPLETE (commits `4eed1f9` + `91e70c4`, deployed + live-verified 2026-07-08)**
- `users.contractor_id` — NOT NULL, FK to `contractors(id)`, live and backfilled to `accent-roofing-dev` (5 rows, 0 NULLs verified).
- `users_email_key` replaced by `users_contractor_id_email_unique` (verified via `pg_constraint`).
- `createApp()` factory extracted to `server/app.js` — pure extraction, all 9 mounts + middleware order preserved verbatim. `server.js` is now a lean 41-line entry point (dotenv, process handlers, initDB/cron IIFE, backup cron, listen).
- `admin/referrers.js` `POST /api/admin/users` — captures `adminSession`, stamps `contractor_id` from the admin's own session; founding-referrer `COUNT(*)` is now scoped per contractor (this session's Q5 fix).
- `server/test/helpers.js` `seedUser()` — now requires an explicit `contractorId` (fail-loud, no hidden tenant default).
- `adminRouteCoverage.test.js` — sweep now walks the real `createApp()` instance; the obsolete server.js source-text drift guard was retired (proven RED via a temporary probe route before removal, per Session 86 discipline).
- Suite: 228/228 green.

**S1 explicitly did NOT touch** (deferred to later sessions):
- The 16 (`referrer.js`) + 5 (`webhooks/jobber.js`) `getDefaultContractorId()` call sites — still live, fail-closed tripwire intact.
- Session stamping for referrers — login/forgot-pin/signup flows still resolve tenancy via the singleton helper, not `session.contractorId`.
- Webhook contractor resolution — still resolves via `getDefaultContractorId()`, not Jobber's `accountId`.

**Session 2 (S2) — COMPLETE (commits `ee092f1` hotfix + `1824d5a` main, deployed + live-verified 2026-07-08)**
- Referrer sessions stamped with `contractor_id` at login from the PIN-verified `users` row; `verifyReferrerSession()` returns `contractorId` and rejects unstamped sessions — legacy (pre-migration) sessions invalidated by design, verified live.
- `contractorSlug` on login/forgot-pin scopes the `WHERE` clause only, never bypasses the credential check. Q2's two binding conditions shipped same-commit: `src/config/contractor.js`'s hardened-rule comment rewritten to the narrower rule + retirement note; `contractorId` value corrected to `accent-roofing-dev`.
- All 22 referrer-side sites converted (A1-A6, B1-B14, BX1-BX3).
- `getDefaultContractorId()` fully retired from `referrer.js` — require removed, zero matches via grep.
- `tenantIsolation.test.js` two-tenant suite green. Suite: 239/239.

**HOTFIX (`ee092f1`, pulled forward from S2's A1/A2):** S1's `users.contractor_id NOT NULL` broke public signup — `referrer.js`'s signup `INSERT` lacked `contractor_id`, the same exposure Q5 caught and fixed for the admin-create-referrer `INSERT` but missed for signup. Down ~1h, zero real users affected (`error_log` confirmed empty). Fixed by pulling A1/A2 forward ahead of the rest of Batch A.

**S2 explicitly did NOT touch** (deferred to Session 3, now complete — see below):
- `webhooks/jobber.js` still called `getDefaultContractorId()` 5x — the function and `contractorContext.js` lived until Session 3, which retired both.
- The second-`contractors`-row restriction that stood here is superseded by the **D5 gate** below — read that before inserting a second row or connecting a second contractor's Jobber account.

**New findings for the record:**
- `users.contractor_id` / `sessions.contractor_id` FKs have no `ON UPDATE CASCADE` — a live contractor rename with existing dependents will be rejected by Postgres (safe direction, reinforces resolving tenancy dynamically rather than caching it).
- `src/config/contractor.js:15`'s `contractorId` literal now joins the backend-literal reconciliation scope (Known Issues 2a).
- Dependabot at 26 findings (1 critical) — pre-launch item 5.

**Session 3 (S3) — COMPLETE (deploy B, per `TENANT_RESOLUTION_REBUILD_SPEC.md` Section 8, Batch C)**
- `contractor_crm_settings.jobber_account_id` column + guarded UNIQUE added (`db.js`); OAuth callback (`oauth.js`) captures it via `account { id }` after every token exchange — dormant until the next connect/reconnect.
- `resolveWebhookContractorId(payload, fallbackLookup)` added to `webhooks/jobber.js` — resolves `contractor_id` from `payload.data.webHookEvent.accountId` against `contractor_crm_settings.jobber_account_id`; `client-update` keeps a defensive `jobber_clients`-based fallback for clients synced before the backfill. Unresolvable events quarantine via the existing 200-ack pattern (no behavior change to that pattern itself).
- All 5 `webhooks/jobber.js` call sites converted; `getDefaultContractorId()` fully retired — `server/utils/contractorContext.js` deleted, zero callers remained, pinned absent by test (`contractorResolution.test.js`).
- `webhookContractorResolution.test.js` rewritten to the new fail-closed contract (the old 0-row/2-row tripwire scenarios no longer apply — retired with the mechanism that produced them). `invoicePaidWebhook.test.js` modernized to resolve via `accountId` (plumbing only, business assertions unchanged). New `webhookTenantDerivation.test.js` covers the mechanism directly (spec Section 7.2).
- Backfill of `accent-roofing-dev`'s `jobber_account_id` is a manual, one-time step — Danny's, run outside this rebuild's automated migrations (see Section 4 Batch C for the chosen capture method).
- 238/238 green.

**D5 — two-stage gate on contractor #2 — COMPLETION NOTE (gate retired, TF passed 2026-07-09):** S3's checkpoint made a second `contractors` **row** resolution-safe — webhook and referrer traffic both resolve tenancy dynamically. A second contractor's Jobber OAuth **connect** was **FORBIDDEN** between S3 and TF because `oauth.js`'s token upsert was hardcoded to `tokens.id=1` — the moment a second contractor clicked Connect, that upsert would have overwritten Accent's row and destroyed Accent's live token. The CRM Token Fix (TF) session (2026-07-09) closed this: the OAuth upsert now keys `ON CONFLICT (contractor_id)` (F2), reads are contractor-scoped (F4), and `refreshTokenIfNeeded` is contractor-scoped and single-flight guarded (F3, [[2c above]]). The gate is retired.
- **Successor operational rule (binding, replaces the retired gate):** `GET /auth/jobber` now REQUIRES a `contractorId` query param — it 400s without one — and `GET /callback` requires a `state` param naming an EXISTING `contractors` row, fail-closed with no default-contractor fallback (`server/routes/oauth.js`). Any Connect button/link must pass the tenant's `contractorId` explicitly; there is no default. Verified live: `src/components/admin/CRMSettings.jsx` (both Connect buttons, lines 729 and 820) already sources `status.contractorId` from `GET /api/admin/crm/status`, which derives it from the verified admin session — no fix needed on the frontend side.

**TF (CRM Token Fix) — COMPLETE (2026-07-09)**
- **F2 (OAuth token write)** — `routes/oauth.js` callback's token INSERT now upserts `ON CONFLICT (contractor_id)` instead of a hardcoded `id=1` row, so a second contractor's Connect no longer overwrites another tenant's token.
- **F3 (token refresh)** — `refreshTokenIfNeeded(contractorId, { force })` (`server/crm/jobber.js`) is contractor-scoped and fail-closed (throws if `contractorId` is missing) with a per-contractor in-process single-flight guard. Full detail in [[2c above]].
- **F4 (token reads)** — both prior `WHERE id=1` reads scoped to `WHERE contractor_id = $1`; `getContractorAccessToken(contractorId)` added as the one sanctioned helper for reading a contractor's access token — never query the `tokens` table ad hoc for reads.
- **F5** — pinned by regression test `server/test/tokenTenancy.test.js` TEST 6 (prevents regression back to the shared-row behavior).
- **D4** — active-status discovery query live (contractor_crm_settings-driven; supports the OAuth-time `jobber_account_id` capture added in S3).
- **TF-P0-1** — `discoverJobberFields` now threads `contractorId` through its call chain.
- **TF-P0-2** — the `initDB()` bootstrap read that previously assumed a single tokens row was replaced with a tenant-neutral count log (was log-only; verified no consumer depended on its prior shape).
- **TF-P0-3** — OAuth fail-closed identity: no contractor identity in `state` → 400; contractor identity present but not found in `contractors` → 400. No default-contractor fallback at any point in the flow.
- **TF-D1.1** — `tokens.id` given a self-filling `SERIAL`-equivalent default (`tokens_id_seq`, `server/db.js`) so inserts can omit it; the primary key stays on `id` (D1 unchanged) — amends D1's original "inert without a default" assumption, which turned out to be schema-impossible (a `PRIMARY KEY` column with no default cannot be omitted from an `INSERT` that also specifies other columns). `id` itself remains unread/unwritten by application code; `contractor_id` is the real key.

**ST (Singleton Tables + cashout_requests Tenancy) — COMPLETE (2026-07-13, commit `a8faa84` + 3 hotfixes `b8792f2`/`7229b7a`/`94e00ed`)**
Full spec: `SINGLETON_CASHOUT_TENANCY_SPEC.md`. Closes **F6** and the Session 50 deferred `cashout_requests` migration note.
- **F6 — RESOLVED.** `admin_cache` (Phase 0 found it's a two-consumer cache table, not a true singleton — dashboard stats keyed `'dashboard_stats'`, Google Places rating keyed `'google_rating'`) now has a **composite `PRIMARY KEY (contractor_id, cache_key)`** (ST-1A ruling). The `google_rating` key is normalized from its old string-smuggled form (`'google_rating_<contractorId>'`) — tenancy comes from the `contractor_id` column, never from inside the key string. `announcement_settings` now has **`contractor_id` as its sole `PRIMARY KEY`** (ST-1, Option A). Both tables' old `id` columns are dropped. Missing-row semantics: rows are born lazily on first use — the old seed `INSERT` was deleted, not ported.
- **Session 50 deferred note — RESOLVED.** `cashout_requests.contractor_id` is `NOT NULL` with `idx_cashout_requests_contractor`. **House pattern for ownership-derivable tenancy backfills:** derive `contractor_id` via a join to the owning row (here, `users`) rather than a single-contractor assumption — safe even if the migration runs late, and it fails closed (`RAISE EXCEPTION`, never guesses) on any row whose owner can't be resolved.
- **One-time historical exception (Danny-ruled 2026-07-13):** 13 legacy `cashout_requests` rows (`user_id` NULL, `full_name = 'Daniel Scribbins'` — Danny's own early manual test cashouts, predating any second contractor) aren't derivable via the ownership join. Backfilled explicitly to the sole contractor via a **dynamic** `SELECT id FROM contractors LIMIT 1` lookup (never a hardcoded literal — see the hotfix note below). The exception predicate is narrow (`contractor_id IS NULL AND user_id IS NULL AND full_name = 'Daniel Scribbins'`) and does **not** relax the general orphan guard for any other/future unresolvable row.
- **Money-path defense-in-depth:** the admin cashout approve/deny/`paid` `UPDATE` (`admin/cashouts.js`) now carries `AND contractor_id=$n` from the verified admin session, inside the existing transaction — a mis-routed id from any future UI bug hits zero rows instead of another tenant's money. Guard-proven: predicate temporarily removed → the money-path kill-shot test went RED → restored → suite green again.
- **Incident + lessons, same session (2026-07-13), see [[Architecture Notes — Migration guard idempotency]] and [[Architecture Notes — Dirty-data reproduction testing rule]] below for the two new BINDING patterns this produced.** Short version: the first production deploy aborted mid-`initDB()` (NOT NULL enforced before key normalization ran against a real pre-existing row); a second deploy then correctly fail-closed on the 13 orphan rows above; a third deploy failed a hardcoded `'accent-roofing'` literal against the real (renamed) `'accent-roofing-dev'` contractor id. All three resolved same-session via the three hotfix commits above; final deploy verified clean (`initDB()` completes, cron scheduler starts, zero error-level logs).
- **payout_announcements Phase 0 verdict:** see [[Known Issues 8]] — untenanted, not a live leak, own scoped fix before launch/contractor #2.
- **adminCacheExpiry Phase 0 finding:** see [[Known Issues 9]] — cron has deleted 0 rows since inception, own small pre-launch fix.

**Next:** the F2/F3/F4/F5 CRM Token Fix (TF) and ST were the last two blockers before contractor #2's Jobber connect is safe — booting with a second `contractors` row is now architecturally legal and simulation-proven (ST's contractor-#2 boot simulation). **Named true gates still required before a real contractor #2 onboards:**
- **F8** — cross-tenant `users` matching in the invoice-paid webhook and `pipelineSync.js` referrer-account lookup ([[Known Issues — users matching in invoice-paid webhook and pipelineSync]]).
- The "STILL OPEN" hardcoded-literal sweep ([[Known Issues 2a]]) — `stripe.js`, `oauth.js`, `account.js`, `errorLogger.js`, `notificationEmail.js`, `stripeTransfer.js`.
- The Security G isolation test (per Danny's Multi-Contractor Security Session tracking — not yet built).

**Small follow-ups queue (opportunistic, not blocking):**
- `registryReconciliation.test.js` still uses the legacy `buildMirrorApp()` helper (green, harmless) — swap to `createApp()` opportunistically, same pattern already applied to `adminRouteCoverage.test.js`.
- `docs/desktop.ini` should be gitignored (Windows Explorer artifact, currently untracked noise in `git status`).
- `LoginScreen.jsx` / `ResetPinScreen.jsx` — `.then()` chains (CLAUDE.md violation, pre-existing, found during S2's LoginScreen edit — not fixed, out of that session's minimal-diff scope fence).
- `referrer.js` forgot-pin handler (~lines 1179-1200) — two `console.error(...)` calls missing the `// diagnostic log — intentional` marker (flagged during S2, out of that session's scope fence).
- Signup verification email send (`referrer.js` ~line 288) is not covered by the route's `_setTestOverrides` seam (that seam only covers the cashout-section sends) — tests stub the `resend` package via `require.cache` instead (see `signupTenantStamp.test.js`).
- webhookTenantDerivation.test.js:108 — pre-existing timing flake (C2 client-create wait race), fired 1-in-5 runs on 2026-07-09, untouched by TF.
- Wider adoption of `getContractorAccessToken(contractorId)` across the remaining ad-hoc scoped token reads — see TF close-out grep for the file list.
- Execution Plan v1 docx amendment: strike "(F2/F3/F4/2c)" from the B1-A S2 line; B1-A now reads S1 · S2 · S3 · TF · ST complete. The docx lives outside the repo — Danny owns this edit at the roadmap reconciliation session.

---

## Architecture Notes

**Naming collision + rename decision (Session 92)**
- TWO functions named `runIncrementalSync` exist: `server/crm/pipelineSync.js` (updates `pipeline_cache` + `sync_state`, called by the 30-min cron) and `server/cron/jobs/jobberIncrementalSync.js` (updates `jobber_clients`, daily 2am UTC). DECISION (Danny): rename both to function-specific names (e.g. `runPipelineIncrementalSync` / `runJobberClientsIncrementalSync`) during the cleanup pass.

**Migration guard idempotency — BINDING house pattern (ST session, 2026-07-13)**
- Every fail-closed migration guard in `db.js` that asserts a precondition (e.g. "exactly 1 `contractors` row") to gate a one-time backfill MUST be wrapped in a work-remaining check: `IF EXISTS (SELECT 1 FROM <table> WHERE <backfill column> IS NULL) THEN <existing precondition check + RAISE + backfill> END IF;`. Without this wrapper, the guard re-fires and crashes every single boot the moment a second `contractors` row exists — long after its one-time backfill already completed, with no relationship to the guard's original purpose.
- Applied this session to both new ST guards (`admin_cache`, `announcement_settings`) and, via a Danny-ruled scope amendment, to the pre-existing Session-1 `users.contractor_id` guard, which had the identical bug and would have taken down every future boot the same way. `cashout_requests`' orphan guard is a different shape (checks actual NULL rows directly, not a contractor count) and is naturally idempotent already — do not add this wrapper there.
- Discovered via the **contractor-#2 boot simulation** (insert a second `contractors` row into an already-migrated DB, re-run `initDB()`, confirm zero raises, then remove the fixture row). That simulation is now a standing part of the migration proof repertoire for any future fail-closed migration guard — run it whenever adding or touching one.

**Dirty-data reproduction — BINDING testing rule (ST session, 2026-07-13)**
- Migration idempotency proofs MUST include a reproduction seeded with production's actual pre-existing row shapes, not only fresh-schema `initDB()` runs. A test DB that is wiped and rebuilt from scratch on every run can never exercise "a real pre-existing row with a column already in some legacy state" — exactly the case that breaks in production and never breaks locally.
- **Incident record:** ST's fresh-schema-only proof (run against an empty `admin_cache`) missed an ordering bug — `cache_key SET NOT NULL` was enforced before the key-normalization `UPDATE` that would have populated it, which is a no-op against zero rows but aborts `initDB()` against a real pre-existing dashboard-stats row. This took down the first production deploy of the ST session (2026-07-13) — `initDB()` failed mid-migration, cron jobs stopped, and (briefly) referrer login and cashout endpoints 500'd since their code changes had already deployed assuming schema that hadn't finished migrating. Resolved same session via three hotfixes: `b8792f2` (ordering fix), `7229b7a` (orphan-row exception, see [[Tenant Resolution Rebuild — ST]] above), `94e00ed` (see next bullet). Full proof thereafter: fresh x2 + a reproduction of the exact dirty row + the contractor-#2 boot simulation + full suite x3.
- **Corollary reaffirmation:** never hardcode a contractor id anywhere, including inside migrations. Hotfix 2 (`7229b7a`) initially hardcoded `'accent-roofing'` for the 13-row historical exception and failed in production on an FK violation — the real contractor id is `'accent-roofing-dev'` (renamed by an earlier session). Hotfix 3 (`94e00ed`) fixed it to derive the id dynamically via `SELECT id FROM contractors LIMIT 1`, the same pattern already used by the Accent Roofing seed-data block.
