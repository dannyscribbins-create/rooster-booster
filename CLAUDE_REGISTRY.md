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
