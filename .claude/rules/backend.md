---
paths:
  - "server/**/*.js"
---

# Backend conventions

⚠ **NOT LOADED AT SESSION START.** This file loads when Claude reads a `server/**/*.js`
file, and is NOT re-injected after a compaction. `CLAUDE.md` carries a permanent pointer
block naming it, so its absence is announced rather than silent.

⚠ **THE ENFORCEABLE RULES ARE IN `CLAUDE.md`, NOT HERE.** Several items below elaborate a
non-negotiable that stays resident in *Never Break These Rules* — `retryHelpers`,
`escapeHtml`, `getCRMAdapter`, `express.raw()`, `logError()`. **When deduplicating, never
delete the resident copy in favour of the more detailed one here: that silently unscopes a
non-negotiable.**

Moved verbatim from `CLAUDE.md` in restructure Phase 2. Nothing was corrected on the way in.
One bullet did NOT move — the pipeline stage vocabulary (`lead → inspection → sold → paid`,
DB `'paid'` → frontend `'complete'`) stayed resident, because a resident rule in *Never Break
→ Frontend Rules* depends on it.

## Key backend rules

- `getCRMAdapter(contractorId)` in crm/index.js is the multi-contractor hook — never import a CRM adapter directly in a route file.
- `retryWithBackoff` correct signature: `retryWithBackoff(() => fn({...}), { shouldRetry: resendShouldRetry })` — second arg is options object, NOT the function directly.
- `logError` correct signature: `logError({ req, error: err, source: 'METHOD /path' })`.
- `escapeHtml` lives in server/utils/pendingReferral.js — import from there, never redefine locally.
- `retryHelpers` (resendShouldRetry, twilioShouldRetry, jobberShouldRetry, anthropicShouldRetry) live in server/utils/retryHelpers.js — import from there, never redefine locally.
- New cron jobs → create server/cron/jobs/[name].js, add seed row to cron_job_locks in initDB(), export named start function, call in server/cron/index.js. All jobs must use withLock().

## Key backend behaviors

- Pipeline cache — pipeline endpoint reads from `pipeline_cache` (populated by background sync), not Jobber directly. Stale fallback returns `{ stale: true }`. No cache returns 503.
- `paid_at` on pipeline_cache — written once when pipeline_status first transitions to `'paid'`, never overwritten. Source of truth for cadence timing.
- Webhook security — `/webhooks/*` uses `express.raw()` before `express.json()`. Never remove this — HMAC verification requires the raw buffer.
- Payout safety — cashout approval wrapped in BEGIN/COMMIT/ROLLBACK. Stripe ACH slot is inside the transaction before COMMIT.
- Cron locks — 7 seed rows in cron_job_locks: pipeline_sync, session_cleanup, admin_cache_expiry, engagement_cadence, dynamic_audiences, post_job_sequence, jobber_incremental_sync.
- Error monitoring — all errors through `logError()` into error_log. Resend alert on first occurrence and every 10th recurrence. Severity auto-classified by route path. Never delete error_log rows — use `resolved=true`.
- Rate limiting — referrerLoginLimiter 10/15min, forgotPinLimiter 3/15min, resetPinLimiter 10/15min, signupLimiter 5/60min, verifyEmailLimiter 10/15min, cashoutLimiter 3/60min, bookingLimiter 3/60min, clientErrorLimiter 20/60min, pipelineLimiter 10/5min, adminLoginLimiter 5/15min.

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
