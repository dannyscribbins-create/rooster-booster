# T+24h Post-Job Review & Referral Sequence — Design

**Date:** 2026-05-24  
**Status:** Approved  
**Touches:** `server/db.js`, `server/routes/webhooks/jobber.js`, `server/cron/jobs/postJobSequence.js`, `server/cron/index.js`, `server/routes/referrer.js`, `src/components/referrer/ExperiencePopup.jsx`

---

## Overview

When a Jobber job is marked complete, the system waits 24 hours and then:

- **If the client has an app account** — creates an `experience_prompts` record so `ExperiencePopup` fires on their next app open.
- **If the client has no app account** — sends a warm welcome email inviting them to sign up; after signup, `ExperiencePopup` fires on first open.

`ExperiencePopup` is upgraded in place (no new component) to add a return-acknowledgment screen (after the user taps the Google review button) and a referral-nudge screen. The existing admin toggle (`experience_flow_enabled`) controls the whole feature; it defaults to OFF.

---

## Architecture

```
JOB_UPDATE webhook
  → pipeline_cache.job_completed_at = NOW()

Daily cron (7:00am UTC)
  → rows where job_completed_at in [T-28h … T-20h] AND t24_sequence_triggered = FALSE
  → match client to app user (jobber_client_id → email → LOWER(name))
  → Scenario A: INSERT experience_prompts (pending) + send email pull
  → Scenario B: send warm welcome email with signup CTA, set users.post_job_invite = TRUE
  → SET t24_sequence_triggered = TRUE

App open (existing ReferrerApp.jsx polling)
  → GET /api/referrer/experience-prompt → returns pending prompt
  → ExperiencePopup renders

Invoice-paid webhook (modified)
  → Suppressed for matched app users (jobber_client_id match)
  → Non-app users continue unchanged (invite email as before)
```

---

## Database Changes

All added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `initDB()`.

### `pipeline_cache`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `job_completed_at` | `TIMESTAMPTZ` | NULL | Written once by JOB_UPDATE webhook when job status = 'completed' and total > 0. Never overwritten. |
| `t24_sequence_triggered` | `BOOLEAN NOT NULL` | `FALSE` | Set TRUE by cron after it fires the sequence. Guards against double-fire. |
| `post_job_modal_shown` | `BOOLEAN NOT NULL` | `FALSE` | Set TRUE when the user responds to (or dismisses) ExperiencePopup. Updated by the existing respond endpoint. |

### `users`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `post_job_invite` | `BOOLEAN` | `FALSE` | Set TRUE when a non-app user signs up via the Scenario B warm welcome email. Used to prioritize ExperiencePopup on first open. |

### New `feedback` table

```sql
CREATE TABLE IF NOT EXISTS feedback (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  contractor_id TEXT NOT NULL,
  message      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
)
```

---

## Phase 2 — Webhook: `/webhooks/jobber/job-update`

New route in `server/routes/webhooks/jobber.js`.

**Logic:**

1. HMAC verification (same `verifyJobberWebhookSignature` helper).
2. `res.status(200).json({ received: true })` immediately.
3. Async IIFE:
   a. Parse payload, extract `jobId`, `clientId`, `status`, `total`.
   b. If `status !== 'completed'` OR `total <= 0` → return early.
   c. Fetch all jobs for this client from Jobber GraphQL (`jobs(first:20) { nodes { id jobStatus total } }`). Filter to jobs with `total > 0`. If the current job's total is **not** the maximum among them → return early (a larger job's completion will be the trigger).
   d. 60-day cooldown: check `pipeline_cache WHERE contractor_id=$1 AND jobber_client_id=$2 AND job_completed_at > NOW() - INTERVAL '60 days'`. If found → return early.
   e. UPSERT `pipeline_cache SET job_completed_at = CASE WHEN job_completed_at IS NULL THEN NOW() ELSE job_completed_at END` (never overwrite existing).
4. Wrap in try/catch, call `logError` on error.

**Comment in code:** `// Requires JOB_UPDATE webhook subscription in Jobber developer settings`

---

## Phase 3 — Invoice-paid Suppression

In the `STEP 7A — App user path` block of the `invoice-paid` handler:

Before creating the `experience_prompts` record, check:
```sql
SELECT jobber_client_id FROM users WHERE id = $1
```
If the matched user has `jobber_client_id` set AND that ID matches the client whose invoice was paid → **skip** the `experience_prompts` INSERT. The T+24h cron will handle them.

Non-app users (Step 7B) are unchanged.

---

## Phase 4 — Cron: `server/cron/jobs/postJobSequence.js`

Schedule: `0 7 * * *` (7:00am UTC daily, after engagement cadence at 6:00am).

**Logic:**

```sql
SELECT pc.*, c.email AS contact_email
FROM pipeline_cache pc
LEFT JOIN contacts c ON c.jobber_client_id = pc.jobber_client_id
  AND c.contractor_id = pc.contractor_id
WHERE pc.job_completed_at IS NOT NULL
  AND pc.job_completed_at <= NOW() - INTERVAL '20 hours'
  AND pc.job_completed_at >= NOW() - INTERVAL '28 hours'
  AND pc.t24_sequence_triggered = FALSE
```

For each row:

**Match to app user (priority order):**
1. `SELECT id, full_name, email, referral_code FROM users WHERE jobber_client_id = $1 AND contractor_id = $2`
2. `SELECT ... WHERE LOWER(email) = LOWER($contactEmail)`
3. `SELECT ... WHERE LOWER(full_name) = LOWER($clientName)`

**Scenario A (match found) — gated by `experience_flow_enabled` flag:**
- Check `engagement_settings.experience_flow_enabled` for the contractor. If false, skip the experience_prompts insert (but still send the pull-back email and set `t24_sequence_triggered`).
- INSERT into `experience_prompts (user_id, contractor_id, jobber_invoice_id, response_type)` — store `jobber_client_id` in the `jobber_invoice_id` column to preserve pipeline_cache linkage for the `post-job-sequence-complete` endpoint.
- Send Resend email: subject "Your project is wrapped up — come share your experience", body "We'd love to hear how your project went. Tap below to open the app and share your thoughts.", CTA button "Open App" → `${process.env.FRONTEND_URL}`.
- SET `t24_sequence_triggered = TRUE` on pipeline_cache row.

**Scenario B (no match):**
- Query `contractor_invite_links WHERE contractor_id = $1 AND link_type = 'contractor' AND active = TRUE ORDER BY created_at DESC LIMIT 1` to get a signup slug. If none exists, use `${FRONTEND_URL}` as the fallback CTA (no slug).
- Send warm welcome email: subject "We want to say thank you", body "We want to say thank you for trusting us with your work and introduce you to our client portal app. Once you're signed up, we would love to know how you felt the project went." CTA button: "Sign Up" → `${FRONTEND_URL}/?signup=${slug}`.
- SET `t24_sequence_triggered = TRUE`.

**Per-row isolation:** each row wrapped in its own try/catch; errors logged via `logError` and loop continues.

**Export:** `function startPostJobSequenceJob()` — registered in `server/cron/index.js` alongside the other named exports.

**Lock seed row** added in `initDB()`: `INSERT INTO cron_job_locks (job_name) VALUES ('post_job_sequence') ON CONFLICT DO NOTHING`.

---

## Phase 5 — Backend Route: enrich experience-prompt response

`GET /api/referrer/experience-prompt` (existing endpoint in `referrer.js`) is updated to JOIN with `users.referral_code` and include `referral_link` in the returned `prompt` object:

```json
{
  "prompt": {
    "id": 42,
    "google_place_id": "...",
    "referral_link": "https://roofmiles.com/?ref=abc123"
  }
}
```

Referral link construction: `${process.env.FRONTEND_URL}/?ref=${user.referral_code}` (same pattern as `engagementCadence.js`). If `referral_code` is null, omit `referral_link`.

---

## Phase 6 — Frontend: Upgrade `ExperiencePopup.jsx`

**New screen map (good path):**

| Screen | Slide index | Content |
|--------|-------------|---------|
| Rating fork | 0 | "How'd everything go?" — 😊 Great / 😕 Not great |
| Review ask | 1 | "Mind sharing your experience?" — Google review button, visibilitychange listener, "Skip for now" link |
| Return acknowledgment | 2 | "Thank you! 🙏" — auto-advance 2.5s or tap Continue |
| Referral nudge | 3 | "Got anyone in mind?" — "Share My Link" (Web Share API / clipboard fallback), "Maybe later" |
| Close | 4 | "You're all set!" — "Back to Dashboard" → `onDismiss()` |

**Bad path:**

| Screen | Slide index | Content |
|--------|-------------|---------|
| Rating fork | 0 | Same as above → 😕 → slide 5 |
| Suggestion box | 5 | Textarea, Submit → POST /api/referrer/feedback |
| Acknowledgment | 6 | "We hear you." — "Back to Dashboard" → `onDismiss()` |

**Implementation notes:**

- `hasLeftForReview` local state flag: set `true` when the Google review button is tapped. `document.addEventListener('visibilitychange')` listener: when `!document.hidden && hasLeftForReview` → advance to slide 2 (return acknowledgment). Listener cleaned up on unmount.
- Auto-advance on slide 2: `setTimeout(2500)` → advance to slide 3. Cancelled if "Continue" tapped first.
- "Share My Link" on slide 3: `navigator.share({ text: presetMessage })` if available; fallback: `navigator.clipboard.writeText(presetMessage)` + show "Copied!" state for 2s.
- Preset share message: `"I just finished my project with ${contractorName} and I'd like to introduce you to them. Download their app to learn more: ${prompt.referral_link}"`
- "Skip for now" on slide 1 → advance to slide 3 (referral nudge, not close).
- Google review URL: `CONTRACTOR_CONFIG.reviewUrl` (already `https://g.page/r/CbtYNjHgUCwhEBM/review`).
- `contractorName`: read from `CONTRACTOR_CONFIG.name`.
- `onDismiss` is the existing prop — no change to the call site in `ReferrerApp.jsx`.
- The existing `{slide === 2 && <button onClick={onDismiss}>×</button>}` close button moves to `slide === 4 || slide === 6` (the two terminal screens). No × on earlier screens — the user must navigate forward.
- "Back to Dashboard" buttons on slides 4 and 6 fire the `post-job-sequence-complete` POST (fire-and-forget) then call `onDismiss()`.

**post_job_modal_shown wiring:** on `onDismiss()` (or when slide 4/6 "Back to Dashboard" is tapped), fire-and-forget POST to `/api/referrer/post-job-sequence-complete`. Backend sets `post_job_modal_shown = TRUE` on the pipeline_cache row whose `jobber_client_id` equals the `jobber_invoice_id` stored on the experience_prompt.

---

## Phase 7 — New Backend Routes

### `POST /api/referrer/feedback`
- Auth: `verifyReferrerSession`
- Body: `{ message }`
- INSERT into `feedback` table
- Return `{ success: true }`
- try/catch + logError

### `POST /api/referrer/post-job-sequence-complete`
- Auth: `verifyReferrerSession`
- Look up user's most-recent experience_prompt (any response_type — this fires even on dismiss)
- The `jobber_invoice_id` column on that row stores the `jobber_client_id` (intentional re-use of the column — the T+24h cron populates it with the jobber_client_id, not an invoice ID)
- SET `pipeline_cache.post_job_modal_shown = TRUE` WHERE `contractor_id = $1 AND jobber_client_id = $jobber_invoice_id_value`
- Return `{ success: true }`
- try/catch + logError

---

## Phase 8 — Register Webhook Route

`server.js` must mount the updated webhooks router. The new `/webhooks/jobber/job-update` route is in the same file (`webhooks/jobber.js`) already mounted — no server.js change needed if it uses `router.post('/jobber/job-update', ...)`.

Verify `server.js` mounts the webhooks router with a path that allows this pattern (expected: `app.use('/webhooks', webhooksRouter)`).

---

## Verification Plan

1. Railway logs: confirm `post_job_sequence` cron registers.
2. DB check:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'pipeline_cache'
     AND column_name IN ('job_completed_at','t24_sequence_triggered','post_job_modal_shown');
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'users' AND column_name = 'post_job_invite';
   SELECT table_name FROM information_schema.tables WHERE table_name = 'feedback';
   ```
3. Dev-trigger button in `ProfileTab.jsx` (clearly labeled, removed after test): calls `INSERT INTO experience_prompts` directly via a dev endpoint or sets `showExperiencePopup = true` via prop.
4. Walk both paths manually in live app (good: rating → review → return acknowledgment → referral nudge → close; bad: rating → suggestion box → acknowledgment).
5. Confirm `post_job_modal_shown = TRUE` after completion.
6. Remove dev-trigger button. Commit.

---

## Constraints Carried Forward

- `experience_flow_enabled` toggle in `engagement_settings` defaults to `FALSE`. The JOB_UPDATE webhook and cron run unconditionally, but `experience_prompts` inserts are only done when the flag is `TRUE` (mirror the existing invoice-paid pattern).
- `retryWithBackoff` + `resendShouldRetry` on all Resend calls.
- All cron jobs use `withLock`.
- No `.then()` chains; no `var`; all async functions have try/catch.
- `post_job_modal_shown` and `post_job_invite` are additive — they do not affect the referral pipeline path.
