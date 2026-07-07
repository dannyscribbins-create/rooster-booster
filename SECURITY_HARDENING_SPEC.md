# RoofMiles — Security Hardening Spec

**Status:** Read-only planning document. No source files were modified to produce this spec. Written 2026-07-07.

**Changelog:** v1.0 — 2026-07-07, initial spec written with the original May audit document unlocatable, Section 2 built as a git-history reconstruction instead. **v1.1 — 2026-07-07, original May audit located and truly re-verified; all seven open questions resolved; CodeQL confirmed active; 6 additional findings recovered from the original document (SH-13 through SH-18).**

**Scope discipline:** Multi-tenant isolation (session-derived `contractor_id`, RLS-equivalent scoping, the webhook `accountId` resolution mechanism) is fully covered by `TENANT_RESOLUTION_REBUILD_SPEC.md` — this document references that plan by session number where relevant and does not re-litigate or duplicate any of its findings (F1–F14) or its 3-session build plan.

**Governing rule:** per the product owner, security readiness is a launch pillar — Accent-ready must equal contractor-#2-ready by design, and July 15 is abandoned as a fixed date in favor of readiness. "Bank-level security" is the stated bar; Section 1 explains honestly what that phrase can and can't mean for an app this size today.

---

## 0. On the original May audit document

**Resolved.** The original document (`RoofMiles_Security_Audit_May2026.md`) existed in the planning-chat project files, never in this repository. It has since been located and added to this repo at `docs/RoofMiles_Security_Audit_May2026.md`, and read in full for this update. Section 2 below is now a true re-verification of its 42 numbered items (plus its "Additional Items" appendix) against the current codebase, replacing the git-history reconstruction used in v1.0 of this spec. That reconstruction still has independent evidentiary value (it captures the actual commit-level work done in the audit's aftermath, which the checklist-style original document doesn't itself record) and is preserved as **Appendix A**.

---

## 1. Plain-Language Overview — what "bank-level" realistically means here

A bank-grade posture rests on roughly eight pillars. Here's where RoofMiles actually stands on each, honestly, in plain language:

| Pillar | Status | Why |
|---|---|---|
| **Transport security** | Strong | Railway/Vercel terminate TLS automatically; Helmet is wired in (ships HSTS by default). Nothing found wrong here. |
| **Authentication** | Strong foundation, one real gap | Passwords/PINs are bcrypt-hashed with a timing-safe "dummy hash" trick to prevent email-enumeration. But 2FA (TOTP) exists in the UI and does *nothing* — it's never checked at login, and there's no failed-attempt lockout on any PIN/password surface beyond rate limiting. Both are decided fixes now (Section 4, Session 8). |
| **Authorization (RBAC)** | Strong, but undocumented | A real permission system (`requirePermission()`, per-contractor `team_members`, tiers, a `super_admin` role) is live across 126 call sites in 9 files — more mature than CLAUDE.md describes, and more mature than the original May audit's own assessment ("no formal RBAC framework") anticipated. CLAUDE.md itself is stale here and should be updated (Section 6, Q7) so a future session doesn't work from a wrong mental model. |
| **Input handling** | Weak | SQL injection specifically is well-guarded — 100% parameterized queries, confirmed by direct inspection, no exceptions found. But general request-body validation is present on only ~6% of write endpoints; ~94% rely on nothing or scattered manual checks. This is the soil real bugs grow in — several of today's findings (XSS, unvalidated money fields) trace back to it. |
| **Tenant isolation** | Known gap, already being fixed | Fully scoped and sequenced in `TENANT_RESOLUTION_REBUILD_SPEC.md` — not duplicated here. Today it fails *closed* (the app breaks loudly rather than leaking data) which is the right failure mode while the real fix is pending. The original audit's recommendation of native PostgreSQL Row-Level Security as a second line of defense was not adopted — the tenant spec deliberately chose application-layer enforcement instead (Section 3, SH-14). |
| **Secrets at rest** | The single biggest finding in this report | Jobber's OAuth tokens — full read/write access to a contractor's entire CRM — are stored as plain text in Postgres, even though a working AES-256-GCM encryption utility already exists in this codebase and is used correctly for other secrets (bank tokens, SSNs). It just was never pointed at the Jobber tokens. The original May audit flagged this same gap in its "Additional Items" list two months ago — it is still open today. |
| **Auditability** | Decent, undermined by a documentation-scale error-leak pattern | `error_log` with deduplication and alerting is real and works. But CLAUDE.md's explicit, repeated rule — "never expose `err.message` to the client on a 500" — is violated at 43+ call sites concentrated in the two highest-traffic files (`referrer.js`, `account.js`). One file (`metrics.js`) was correctly fixed; the fix didn't propagate. Separately, the `activity_log` audit trail itself isn't confirmed append-only and doesn't capture IP addresses (Section 3, SH-16). |
| **Dependency hygiene** | A real process exists, with one blind spot | `npm audit` before every push is an actual habit here (confirmed via commit history), not aspirational, and GitHub's default CodeQL scanning is confirmed active (Section 6, Q4). But the current "38 findings, all build-toolchain, not production" story has a hole: `multer`, a direct production dependency, carries a real high-severity DoS CVE with a trivial fix, and it isn't being tracked as urgent because it got lumped in with the react-scripts pile. Separately, GitHub's Security tab shows 354 open Dependabot/CodeQL alerts that have never had a dedicated triage pass — see Section 2, item 35. |
| **Operational response** | Decent, with a documentation gap | Daily Backblaze backups with a verify utility, `logError()` with alert-on-first-and-every-10th-recurrence, cron job locking to prevent double-runs. This part of the story is genuinely solid. The one gap: no written rollback runbook exists despite every underlying capability (git revert, Railway redeploy, Backblaze restore) already being in place (Section 3, SH-17). |

**Bottom line for a novice reader:** the *shape* of a secure app is here — parameterized SQL everywhere, real password hashing, a real permission system, real backups. The gaps are concentrated in three places: a plaintext credential that should be encrypted, an error-leak pattern that shipped once as a fix and didn't spread, and an escaping/validation layer that's thin enough that a couple of real XSS bugs already snuck through it. None of these are exotic — they're the standard short list any web app this size has to close before "bank-level" is more than a slogan.

---

## 2. Re-Verification — the Original May 2026 Audit, Item by Item

Source: `docs/RoofMiles_Security_Audit_May2026.md`, read in full. Original status markers in parentheses. Items unrelated to security proper (pure performance/infrastructure items) are still tracked here for completeness per the original document's own numbering, but are explicitly scoped **out** of this security spec's Section 4 build plan — they remain under the original document's own "Database Performance Session" / "Monitoring & Alerting Session" / "Infrastructure & Docker Session" categories, which this spec does not re-plan.

| # | Item | Original | Current status | Evidence |
|---|---|---|---|---|
| 1 | Rate Limiting | ✓ DONE | **VERIFIED-DONE** | This session's independent agent re-audit confirmed every limiter listed in the original (plus several added since: `missingReferralLimiter`, `superAdminLoginLimiter`, `backupLimiter`, `resendInviteLimiter`, `aiRapportLimiter`) is defined *and* actually applied to its intended route. No orphans found. |
| 2 | SQL Injection Prevention | ✓ DONE | **VERIFIED-DONE** | Full sweep across 17 route files (114 POST/PUT/PATCH endpoints) found zero raw-concatenation violations — 100% parameterized, including two near-miss patterns (`admin/contacts.js:563`, dynamic `campaigns.js` UPDATEs) that only interpolate whitelisted column names, never values. |
| 3 | Partitioning | — N/A | **VERIFIED-DONE (N/A, unchanged)** | Table sizes remain far below the threshold where this would matter. |
| 4 | RPC | — N/A | **VERIFIED-DONE (N/A, unchanged)** | Still a monolith. |
| 5 | QPS Monitoring | ✗ TODO | **STILL-OPEN** | Not code-verifiable — depends on external Railway/monitoring-tool configuration. No evidence of a QPS dashboard added since May. Performance-domain item, out of this spec's build-plan scope (tracked under the original document's own Monitoring & Alerting Session). |
| 6 | Load Balancing | — N/A | **VERIFIED-DONE (N/A, unchanged)** | Still not needed at current scale. |
| 7 | Staging Containerization | ~ PARTIAL | **STILL-OPEN** | No `Dockerfile` found in the repo root. Not re-investigated in depth this session — performance/infra-domain item, out of this spec's build-plan scope. |
| 8 | FTP | — N/A | **VERIFIED-DONE (N/A, unchanged)** | No FTP anywhere. |
| 9 | Terms of Use / Legal Protection | ~ PARTIAL | **STILL-OPEN** | Folded into new finding SH-15 (Section 3) — no evidence a signup-flow terms checkbox was added since May. |
| 10 | Data & Compliance Documentation | ✗ TODO | **PARTIALLY-DONE** | The account-deletion flow this item flagged as "in the build queue" has since shipped (`ManageAccount.jsx` / `account.js` — soft-delete with 30-day retention, per `CLAUDE_REGISTRY.md`'s "Manage Account" entry). No formal internal Data Processing document exists yet. Folded into SH-15. |
| 11 | CCPA Compliance | ✗ TODO | **PARTIALLY-DONE** | The right-to-deletion piece is now satisfied by the same account-deletion flow (item 10). The "Do Not Sell" privacy-policy disclosure was not verified this session (would require reading the live `/privacy` page content, out of this spec's code-only investigation surface). Folded into SH-15. |
| 12 | Row-Level Security (RLS) | ~ PARTIAL | **PARTIALLY-DONE / SUPERSEDED BY DESIGN DECISION** | `TENANT_RESOLUTION_REBUILD_SPEC.md` implements the application-layer half of this item's recommendation (every query scoped via session-derived `contractor_id`) but deliberately does **not** implement native PostgreSQL `CREATE POLICY` RLS as the "second line of defense at the database layer" this item specifically asked for. This is a real, distinct gap from what the tenant spec closes — see new finding SH-14. |
| 13 | Authentication & Authorization | ✓ DONE | **VERIFIED-DONE**, with adjacent new findings | The core mechanism (session-token identity, bcrypt, never-trust-the-body) remains sound and unchanged. This session found two *related but distinct* gaps the May audit didn't have visibility into: TOTP is decorative (SH-10) and there's no failed-attempt lockout (SH-13). These don't invalidate item 13's DONE status for what it actually assessed — they're new surface. |
| 14 | Access Control on All Requests | ✓ DONE | **VERIFIED-DONE, exceeded** | Now backed by a full `requirePermission()` RBAC layer (126 call sites, 9 files) that didn't exist in this form in May — a substantial upgrade beyond the original item's scope. |
| 15 | Input Validation & Sanitization | ~ PARTIAL | **STILL-OPEN** | Helmet is now confirmed installed (was "not confirmed" in May) but left at bare defaults. A schema validator (`express-validator`) exists but covers only ~6% of write endpoints. Directly covered by existing finding **SH-9**. |
| 16 | CORS | ~ PARTIAL | **STILL-OPEN, confirmed unresolved** | May's item asked "needs verification whether locked to specific domain." This session confirmed it is **not** — `cors()` is called with zero config, the wide-open default. Covered by existing finding **SH-11**. |
| 17 | CSRF | ~ PARTIAL | **VERIFIED-DONE (upgraded)** | May's assessment was correct but hedged ("SameSite/explicit CSRF checks not confirmed"). This session confirmed definitively: zero `res.cookie(`/`Set-Cookie` calls exist anywhere in `server/` — auth is 100% bearer-token-via-`sessionStorage`, with no cookie-based session at all. There is no CSRF surface to protect against for the current auth model; the concern this item raised is fully resolved by the architecture as it stands, not partially. |
| 18 | Password Reset Expiration | ✓ DONE | **VERIFIED-DONE** | Unchanged. |
| 19 | Frontend Error Handling | ~ PARTIAL | **STILL-OPEN** | Not independently re-verified this session (frontend error-boundary coverage was outside this spec's server-focused investigation surface). No evidence of change since May. |
| 20 | Database Indexes | ~ PARTIAL | **STILL-OPEN** | Not re-investigated this session (would require `EXPLAIN ANALYZE` against live data). Performance-domain, out of this spec's build-plan scope. |
| 21 | Alerting on Critical Events | ~ PARTIAL | **STILL-OPEN** | No evidence of expansion since May (still missing failed-payment/failed-signup/5xx-spike/latency alerting). Out of this spec's build-plan scope. |
| 22 | Rollback Plan | ~ PARTIAL | **STILL-OPEN** | No rollback runbook document found anywhere in the repo. Folded into new finding **SH-17**. |
| 23 | RBAC | ~ PARTIAL | **VERIFIED-DONE, exceeded** | May's assessment ("permissions checked via hardcoded middleware, no formal framework") is now out of date — a genuine structured permission system (`requirePermission()`, tiers, per-contractor `team_members`, a defined permission-flag registry in `server/permissions/registry.js`) has since been built. Not Casbin specifically, but functionally what this item asked for. |
| 24 | Audit Log | ~ PARTIAL | **STILL-OPEN** | Not independently re-verified this session whether `activity_log` writes are genuinely append-only at the application level, or whether IP addresses are captured. No evidence of change since May. Folded into new finding **SH-16**. |
| 25 | SOC 2 Requirements | ✗ TODO / future | **UNCHANGED — appropriately deferred** | Correctly queued as a future milestone at $250K–$500K ARR, not a current build item. No change in recommendation. |
| 26 | Data Isolation Between Contractors | ~ PARTIAL | **PARTIALLY-DONE — fully covered by `TENANT_RESOLUTION_REBUILD_SPEC.md`** | The exact gap this item names (hardcoded `'accent-roofing'`, must be session-derived before contractor #2) is precisely what that spec's F1/F7 findings and 3-session build plan address. Not duplicated here — see that document. |
| 27 | Google Login | — N/A | **VERIFIED-DONE (N/A, unchanged)** | Still not needed for this user base. |
| 28 | HTTPS Only & Secure Cookies | ✓ DONE | **VERIFIED-DONE** | Reconfirmed — no cookies in use at all (see item 17), TLS auto-provisioned by Railway/Vercel. |
| 29 | Phishing Defense | ~ PARTIAL | **STILL-OPEN** | SPF/DKIM/DMARC on `roofmiles.com` not verifiable from repository code — requires a DNS-level check. Folded into new finding **SH-15**. |
| 30 | Storage Buckets Private | ✓ DONE | **VERIFIED-DONE (unchanged)** | Same caveat as the original ("confirm in Backblaze console") still applies — no code-level change either way. |
| 31 | Never Expose Service Role Keys | ✓ DONE | **VERIFIED-DONE, reconfirmed** | This session's independent secrets sweep found zero hardcoded credentials anywhere in `server/`. |
| 32 | XSS | ~ PARTIAL | **STILL-OPEN, and the real bugs are on a different surface than this item anticipated** | May's item assessed *frontend* JSX auto-escaping and CSP headers. Helmet is now installed (CSP still bare — **SH-11**). But this session found the actual exploitable XSS bugs live entirely in **server-side HTML email generation** (Jobber client names into outbound email, `campaigns.js`'s weaker escaper) — a surface item 32 didn't examine at all. See **SH-4** and **SH-5**. |
| 33 | Path Traversal | ✓ DONE | **VERIFIED-DONE** | Unchanged — no file-path-from-user surface exists. |
| 34 | Short-Lived Tokens | ✓ DONE | **VERIFIED-DONE** | Unchanged. |
| 35 | Dependency Vulnerability Scanning | ✓ DONE | **PARTIALLY-DONE** | Dependabot and GitHub's default CodeQL are confirmed active (Section 6, Q4 — Security tab checked 2026-07-07, last scan 9 hours prior, 104/104 JS files scanned). But the finding count has grown from "8 patched, 26 remaining, all CRA-toolchain-not-reachable-in-production" to 38 findings today, and that "not reachable in production" characterization has a confirmed hole: `multer` is a direct production dependency with a real CVE (**SH-8**). Additionally, the Security tab shows **354 open alerts** (Dependabot + CodeQL combined) that have never had a dedicated severity-sorted triage pass — queued as a future task, expected to substantially overlap with SH-3/SH-4 and CRA-toolchain noise, but not yet performed. |
| 36 | Check Frontend for Secrets | ✓ DONE | **VERIFIED-DONE (server-side reconfirmed; frontend not independently re-swept this session)** | No secrets found in `server/`. Frontend `src/` was not independently re-grepped this session — no evidence of change from May's assessment. |
| 37 | N+1 Query Elimination | ~ PARTIAL | **STILL-OPEN** | Not re-investigated this session. Performance-domain, out of this spec's build-plan scope. |
| 38 | Missing Indexes Audit | ~ PARTIAL | **STILL-OPEN** | Same as item 20 — not re-investigated, out of scope. |
| 39 | SELECT * and Unbounded Queries | ~ PARTIAL | **STILL-OPEN** | Not comprehensively re-swept this session beyond confirming no new violations in the 17 files read in full for the input-validation audit. Out of this spec's build-plan scope. |
| 40 | Pagination | ~ PARTIAL | **STILL-OPEN** | Not re-investigated. Out of scope. |
| 41 | Async / Non-Blocking Processing | ✓ DONE | **VERIFIED-DONE** | No `.then()` chains or blocking patterns surfaced across the 17 files read in full this session (114 endpoints), despite thorough coverage — consistent with the original DONE assessment. |
| 42 | Comprehensive Monitoring & Metrics | ~ PARTIAL | **STILL-OPEN** | No evidence of expansion since May. Out of this spec's build-plan scope. |

**Additional Items list (original document, non-numbered) — security-relevant items only:**

| Item | Original note | Current status |
|---|---|---|
| Helmet.js headers | "Not confirmed installed" | **VERIFIED-DONE (installed), STILL-OPEN (unconfigured)** — see SH-11. |
| SPF/DKIM/DMARC | "Confirm configured" | **STILL-OPEN** — folded into SH-15. |
| API key encryption at rest | "Currently plaintext, must encrypt before contractor #2" | **STILL-OPEN, elevated to CRITICAL** — this is exactly **SH-1**, and the fact the May audit already flagged it two months ago and it remains unfixed is itself a data point on priority. |
| Brute-force protection on PIN entry | "Not just login endpoint" | **STILL-OPEN** — see new finding **SH-13**. |
| Account lockout after N failed attempts | related to above | **STILL-OPEN** — see **SH-13**. |
| Signed Backblaze URLs | "If you ever serve files to users" | **VERIFIED-DONE (N/A, unchanged)** — RoofMiles still doesn't serve user-facing files by path. |
| Secrets rotation plan | "Documented? No." | **STILL-OPEN** — see new finding **SH-18**. |
| Webhook replay attack prevention | "Consider timestamp check" | **STILL-OPEN** — this is exactly **SH-6**, already identified independently by this session's fresh code audit before this re-verification pass confirmed the original document flagged the same gap in May. |

---

### Appendix A — Shipped Security Commits, April–June 2026 (git-history reconstruction, retained from v1.0)

This table was built before the original audit document was located, by scanning `git log --all --since=2026-04-15 --until=2026-06-15` for security-relevant commit messages. It has independent evidentiary value — it shows what was *actually shipped*, at the commit level, in the audit's aftermath — and is preserved here rather than discarded, per instruction.

| Commit | Date | What shipped |
|---|---|---|
| `f2944b7` | 2026-04-16 | Helmet.js + express-validator + internal error logger with dedup/alerting |
| `1285d04` | 2026-04-17 | Pipeline/cashout identity derived from session, not client input |
| `2bc68ec` | 2026-04-17 | Jobber HMAC verification against the raw request body |
| `1b7de2b` | 2026-04-17 | Rate limiters added, cashout balance gate, admin-password fallback removed |
| `9976b22` | 2026-04-17 | SSRF protection on color extraction, explicit SELECT columns, dateUtils consolidation |
| `c507244` | 2026-04-17 | `npm audit fix`, 8 non-breaking patches |
| `1ae10e5` | 2026-04-17 | Removed name-match fallback in payout announcement insert |
| `77d596b` | 2026-04-19 | "19 findings resolved" — pending-referral system audit pass |
| `b910192` | 2026-05-05 | Twilio Auth Token → scoped API Key |
| `4b92660` | 2026-05-09 | AES-256-GCM encryption utility, applied to bank-connection data |
| `3d34599` | 2026-05-10 | `verifyReferrerSession()` wired into `auth.js` + booking handler, HTML escaping added |
| `98ded57` | 2026-05-10 | Account-deletion emails hardened: retry, logError, admin notification, `escapeHtml()` |
| `433c454` / `be40f40` | 2026-05-10 | `account.js`/`referrer.js` migrated to shared `verifyReferrerSession()` middleware |
| `a9798ce` / `c878e89` | 2026-05-10 | `logError()` added to 19 previously-bare catch blocks |
| `a897f17` | 2026-05-10 | `SELECT *` → explicit columns in login/CRM adapter/token refresh |
| `b3166d6` | 2026-05-23 | Catch-block audit across admin sub-routers, staging email prefix, CodeQL workflow auth |
| `848d082` | 2026-05-23 | Removed a manually-added CodeQL workflow ("conflicts with GitHub default setup") — **now confirmed correct, Section 6 Q4** |
| `6899da4` | 2026-06-09 | Bundled hardening: missing logError, SQL param fix in `withLock()`, retry additions |
| `7d72c83` | 2026-06-10 | `evaluateAudience` rewritten to avoid a 65k-parameter ceiling; OR-mode contractor filter added |
| `277efc8` | 2026-06-10 | `removeTag()` now requires `contractor_id` |
| `1271278` | 2026-06-10 | `paid_count` increment race guarded by conversion-insert row count |
| `aa5bced` | 2026-06-10 | `err.message` sanitized out of `admin/index.js` and `campaigns.js` 500 responses — **this is the commit that shipped a fix which never propagated codebase-wide; see SH-3** |

---

## 3. Findings — Post-May Attack Surface

Severity scale matches `CONTRACTOR2_READINESS_AUDIT.md`: CRITICAL / HIGH / MEDIUM / LOW / INFO. SH-1 through SH-12 were identified by this session's fresh code audit (v1.0); SH-13 through SH-18 are recovered from the original May document's still-open items during this update (v1.1), cross-checked against SH-1–SH-12 and `TENANT_RESOLUTION_REBUILD_SPEC.md` to avoid duplication.

### SH-1 — CRITICAL — Jobber OAuth tokens stored in plaintext

**Where:** `server/db.js:19-22` (`tokens.access_token`, `tokens.refresh_token`), write sites at `server/routes/oauth.js:30-32` and `server/crm/jobber.js:37`. Also `contractor_crm_settings.api_key` (`server/db.js:242`, write site `server/routes/admin/index.js:983-991`) — has a code comment acknowledging the gap; the OAuth token gap has no such acknowledgment anywhere in the code.

**Plain-language risk:** these tokens are full read/write API credentials to a contractor's entire Jobber account. Anyone with read access to the production database gets full CRM access for every connected contractor, with no additional barrier. `server/utils/encryption.js` (AES-256-GCM) already exists and is used correctly for other secrets — it's just not pointed at this table. **The original May audit flagged this exact gap two months ago; it remains unfixed.**

**Fix direction:** wrap `access_token`/`refresh_token` writes with the existing `encrypt()`/`decrypt()` helpers; same for `api_key`. Requires a one-time re-encryption pass for the live `accent-roofing-dev` token.

### SH-2 — LOW/INFO — CLAUDE.md's authentication section is stale, describing a retired mechanism as a live rule

**Where:** CLAUDE.md's "Never Break These Rules" section states `ADMIN_PASSWORD` must be a Railway env var; current code has zero references to it — fully replaced by `team_members`/RBAC months ago, undocumented in CLAUDE.md.

**Fix direction:** decided — Section 6, Q7. Update CLAUDE.md's Security Standards and Never Break These Rules sections as its own small commit in the next build session that touches CLAUDE.md, not as part of this read-only session.

### SH-3 — HIGH — `err.message`/`err.stack` leaked to clients on 43+ endpoints, concentrated on the highest-traffic surfaces

**Where:** `server/routes/referrer.js` — 28 sites (including `:799`, the login endpoint). `server/routes/account.js` — 15 sites, including all four TOTP endpoints. `server/routes/admin/index.js` — several related leaks in the CRM-connect flow. `metrics.js` and `campaigns.js` are confirmed clean (fixed by the `aa5bced` commit, Appendix A).

**Fix direction:** mechanical, one-line-per-site — replace `err.message` with `'Internal server error'`, matching the proven pattern.

### SH-4 — HIGH — Confirmed exploitable stored/reflected XSS via unescaped Jobber client data in outbound email

**Where:** `server/routes/webhooks/jobber.js:852-863` — the experience-invite email interpolates the Jobber client's name with no `escapeHtml()` call, while a structurally identical "bonus earned" email a few hundred lines later in the same file escapes correctly.

**Fix direction:** wrap the `firstName` interpolation in the same `escapeHtml()` already used elsewhere in the file.

### SH-5 — HIGH — `escapeHtml` exists in 7+ duplicated forms, one of which is materially weaker and used in an attribute context

**Where:** Canonical: `pendingReferral.js:8`. Six other duplicates never import from it. `campaigns.js:234`'s local `esc()` doesn't escape `"` and is used inside double-quoted HTML attributes — a genuine attribute-injection gap.

**Fix direction:** consolidate all duplicates into imports from `pendingReferral.js` — fixes SH-4, SH-5, and the CLAUDE.md compliance gap in one pass.

### SH-6 — HIGH — Jobber webhooks have no replay-attack protection

**Where:** `server/routes/webhooks/jobber.js`, all 5 handlers. No `occurredAt` timestamp window, no event-ID dedup. The only accidental protection is a DB unique constraint that covers just one of the five event types. **The original May audit's own "Additional Items" list already named this exact gap — it remains unfixed.**

**Fix direction:** add a timestamp-tolerance check and/or event-ID tracking, batched with `TENANT_RESOLUTION_REBUILD_SPEC.md` Session 3 (Batch C), which touches the same 5 handlers.

### SH-7 — MEDIUM — Jobber HMAC comparison is not timing-safe, and the signature header name carries a live unresolved TODO

**Where:** `jobber.js:50` — plain `!==` instead of `crypto.timingSafeEqual`. `jobber.js:33` — a TODO admitting the signature header name was never confirmed against Jobber's docs.

**Fix direction:** swap to `timingSafeEqual`; resolve the TODO. **Env-var naming is resolved — Section 6, Q3: `JOBBER_CLIENT_SECRET` is the correct, intentional secret per Jobber's own webhook documentation; there is no separate webhook secret to request.**

### SH-8 — MEDIUM/HIGH — `multer` (a real production dependency, not a build tool) carries an unaddressed high-severity DoS CVE, contradicting the registry's dependency-risk characterization

**Where:** `multer` 2.1.1, direct production dependency, GHSA-72gw-mp4g-v24j (CVSS 7.5). Fix is a non-breaking bump to 2.2.0. Directly contradicts `CLAUDE_REGISTRY.md:251-253`'s "all findings are build-toolchain-only" claim — flagged as a contradiction per this spec's discipline requirement, not silently corrected (the registry file is out of this read-only spec's edit scope).

**Fix direction:** `npm install multer@2.2.0`; correct the registry's Known Issues item 7 in a future build session.

### SH-9 — HIGH (systemic) — ~94% of write endpoints have no structured request validation

**Where:** 114 enumerated endpoints, only 7 use `express-validator`. Highest-risk concentrations: `PATCH /api/admin/cashouts/:id`, `POST /api/admin/stripe/transfer`, `POST/PUT /api/admin/schedules(/:id)`, `POST /api/admin/users`.

**Fix direction:** extend `express-validator` — **decided, Section 6 Q5: it is the standard validation library going forward, never introduce a second framework for the same job.**

### SH-10 — MEDIUM/HIGH — TOTP/2FA is implemented but never checked at login; the confirm endpoint has no rate limiter

**Where:** `account.js:219-302` implements TOTP fully, but `referrer.js`'s login handler never checks `totp_enabled`. `/totp/confirm` has no rate limiter.

**Fix direction:** **decided, Section 6 Q2 — enforce TOTP as a real second factor at login when enabled, do not remove the toggle.** Bundled with SH-13 into Session 8 (Section 4) since both touch the login/auth-hardening surface.

### SH-11 — MEDIUM — Helmet and CORS are both wired in but left at unconfigured defaults

**Where:** `server.js:34,36` — bare `helmet()`, wide-open `cors()`. Practical severity lowered by the bearer-token-in-`sessionStorage` design (no ambient cookie credential), but still not the hardened posture "bank-level" implies.

**Fix direction:** explicit `cors({ origin: process.env.FRONTEND_URL })`; tailored CSP directives. Needs its own STOP checkpoint (Section 4) — a too-strict CSP can silently break legitimate asset loads.

### SH-12 — INFO — Minor cleanup items, no urgency

`verifySuperAdminSession()` dead code; referrer session INSERT relies on a schema default for `role`; `admin/contacts.js:563`'s whitelisted-but-fragile dynamic column pattern; orphaned `webhooks/stripe.js` placeholder; `express`/`twilio` one major version behind, `web-vitals` three majors behind.

### SH-13 — MEDIUM/HIGH — No account lockout or failed-attempt tracking on any PIN/password surface (recovered from original audit)

**Where:** Login (`referrer.js:728`), PIN reset confirm (`referrer.js:1205`), admin login (`admin/index.js:45`) — all rely solely on rate limiting (10 attempts/15min for referrer login). No `failed_attempts`/`lockout`/`locked_until` column exists anywhere; confirmed via grep. The original May audit's "Additional Items" list explicitly named "brute-force protection on PIN entry (not just login endpoint)" and "account lockout after N failed attempts" as open gaps — both remain open today.

**Plain-language risk:** rate limiting alone (10 attempts per 15-minute window, per IP) is a meaningfully weaker defense than a per-account lockout — a distributed or slow-and-low credential-stuffing attempt spread across many IPs isn't meaningfully slowed by an IP-scoped limiter.

**Fix direction:** add a failed-attempt counter and temporary lockout (e.g., N failures → 15-minute account-level lock, independent of IP) to the login and PIN-reset-confirm flows. Bundle with SH-10 in Session 8 (Section 4), since both are login-path hardening touching the same handlers.

### SH-14 — INFO (SOC-2-era) — Native PostgreSQL Row-Level Security not implemented; application-layer scoping only (recovered from original audit)

**Where:** original audit item #12 asked specifically for `CREATE POLICY`-based RLS as "a safety net at the database level — the last line of defense," distinct from and in addition to application-layer `contractor_id` scoping. `TENANT_RESOLUTION_REBUILD_SPEC.md` implements the latter (session-derived `contractor_id`, checked in application code) but does not add native RLS policies — this is a deliberate scope choice in that document, not an oversight, and this finding is not a criticism of that spec's approach.

**Plain-language risk:** low today. Application-layer scoping, done correctly (which the tenant spec is designed to achieve), is a legitimate and common pattern. Native RLS is defense-in-depth — it protects against a *future* bug in application code that forgets a `contractor_id` filter, not against today's known gaps. Appropriate to defer.

**Fix direction:** not launch-gating. Revisit as a SOC-2-era enhancement once `TENANT_RESOLUTION_REBUILD_SPEC.md` has shipped and been live for a meaningful period — adding RLS policies on top of an already-correct application layer is lower-risk than adding it as the *only* defense.

### SH-15 — MEDIUM — Compliance, legal, and email-authentication gaps (recovered from original audit, bundled)

**Where:** (a) No terms-of-use acceptance checkbox at referrer signup (`SignupScreen.jsx`/`referrer.js:203` — not independently re-verified as added since May, no evidence found). (b) No formal internal Data Processing document. (c) Privacy policy's CCPA "Do Not Sell" disclosure not confirmed present (the right-to-deletion half of CCPA is now satisfied by the shipped account-deletion flow — see Section 2, item 11). (d) SPF/DKIM/DMARC configuration on the `roofmiles.com` sending domain not verified — a DNS-level check (e.g. via mail-tester.com or MXToolbox, as the original audit itself recommended), not a code change.

**Plain-language risk:** (a)-(c) are legal-exposure gaps, not technical vulnerabilities — relevant for App Store submission and CCPA-covered users. (d) is an anti-spoofing measure — without it, phishing emails impersonating `roofmiles.com` are easier to send convincingly.

**Fix direction:** bundle into one session — add the terms checkbox (small frontend change), draft/attach a Data Processing document and CCPA disclosure (content work, ideally lawyer-reviewed per the original audit's own recommendation), and run the SPF/DKIM/DMARC verification (a 10-minute lookup, fix only if it fails). Not launch-gating for the Accent-only web pilot; becomes gating the moment App Store submission or a CCPA-covered signup flow goes live.

### SH-16 — MEDIUM — Audit log (`activity_log`) hardening not confirmed (recovered from original audit)

**Where:** original audit item #24 flagged three specific gaps: (a) not confirmed append-only (no DB-level protection against UPDATE/DELETE), (b) no IP address captured on logged events, (c) a mentioned 90-day auto-delete policy that conflicts with audit-log best practice (should be retained longer). None of these were independently re-verified this session — no evidence of change since May.

**Fix direction:** review `activity_log` write paths for any UPDATE/DELETE (should be zero); add IP address capture on key events (login, cashout, admin actions); revisit retention policy. Post-launch — this strengthens auditability but doesn't block launch on its own.

### SH-17 — LOW — No written rollback runbook (recovered from original audit)

**Where:** original audit item #22. Every underlying capability exists (git revert, Railway build history, Backblaze restore-verify utility) but no single document walks through the procedure end-to-end.

**Fix direction:** a documentation-only session (~2 hours per the original audit's own estimate) — write the runbook, do one staging dry-run to confirm it's accurate. Cheap, low-risk, good candidate to bundle with any other session's downtime.

### SH-18 — LOW — No documented secrets-rotation plan (recovered from original audit)

**Where:** original audit's "Additional Items" list: "what is the procedure if a Railway env var key is compromised? Documented? No." Still true — no such document exists in the repo.

**Fix direction:** documentation task — write a short runbook for rotating each class of secret (DB credentials, Jobber OAuth client secret, Resend/Twilio/Stripe keys, `ENCRYPTION_KEY`). Post-launch, low urgency, cheap to produce.

---

## 4. Sequenced Build Plan

Compressed to the minimum number of sessions, ordered by risk. Each session states its scope, its expected verification values **in advance**, and a STOP checkpoint. Cross-references to `TENANT_RESOLUTION_REBUILD_SPEC.md` are noted, never duplicated. Sessions are numbered independently of finding IDs (a session may cover multiple SH-# findings).

**Launch-gating** = must happen before the pilot is genuinely live, regardless of contractor count.
**Post-launch hardening** = should happen soon after launch, not blocking it.
**SOC-2-era** = relevant only if RoofMiles later pursues enterprise/compliance-driven customers.

### Session 1 — Credential encryption (LAUNCH-GATING, highest priority) — covers SH-1

**Scope:** wrap `tokens.access_token`/`refresh_token` and `contractor_crm_settings.api_key` writes with the existing `encryption.js` AES-256-GCM helpers. One-time re-encryption of the live `accent-roofing-dev` token.

**Before starting:** Backblaze backup — **confirmed required, Section 6 Q6** — this touches the single most sensitive table in the schema.

**Expected verification:** `SELECT access_token FROM tokens` returns ciphertext, not a recognizable Jobber token shape; a live pipeline sync still succeeds post-deploy.

**STOP checkpoint:** deploy, verify live Jobber-dependent flows (pipeline sync, webhook processing) function end-to-end before moving on.

### Session 2 — `err.message` leak sweep (LAUNCH-GATING) — covers SH-3

**Scope:** mechanical, one line per site — `referrer.js` (28), `account.js` (15), remaining `admin/index.js` sites.

**Expected verification:** `grep -rn "err.message\|err.stack" server/routes/ | grep -v "logError\|console\."` returns zero hits inside any response-body construction.

**STOP checkpoint:** `npm test` fully green before deploy.

### Session 3 — XSS/escaping consolidation (LAUNCH-GATING) — covers SH-4, SH-5

**Scope:** fix the confirmed unescaped bug at `jobber.js:852-863`; consolidate all 7+ `escapeHtml` duplicates to import from `pendingReferral.js`; fix or delete `campaigns.js`'s `esc()`.

**Expected verification:** exactly one `escapeHtml` definition remains, codebase-wide; a test asserting a client name containing `<script>` and `"` renders safely in both affected emails.

**STOP checkpoint:** manually render one real campaign email and one experience-invite email post-fix to confirm no double-escaping regression.

### Session 4 — Webhook hardening (LAUNCH-GATING, batch with tenant spec Session 3) — covers SH-6, SH-7

**Scope:** timing-safe HMAC comparison, replay-window/event-ID protection, resolve the signature-header-name TODO. **Same 5 handlers `TENANT_RESOLUTION_REBUILD_SPEC.md` Session 3 (Batch C) already schedules for the `accountId`-based rewrite — do both in the same session.**

**Expected verification:** a replayed (same-signature, stale-timestamp) payload is rejected; `crypto.timingSafeEqual` in place of `!==`.

**STOP checkpoint:** shares the tenant spec's Session 3 STOP checkpoint — no redundant second checkpoint.

### Session 5 — Dependency correction (LAUNCH-GATING, trivial) — covers SH-8

**Scope:** `npm install multer@2.2.0`; correct `CLAUDE_REGISTRY.md`'s Known Issues item 7 to carve `multer` out from the "all build-toolchain" characterization.

**Expected verification:** `npm audit` high-severity count drops by 2; upload endpoints still function.

**STOP checkpoint:** none needed — bundle with any other session's deploy.

### Session 6 — Money-path and schedule-endpoint validation (LAUNCH-GATING, narrow slice of SH-9) — covers SH-9

**Scope:** extend `express-validator` to `PATCH /api/admin/cashouts/:id`, `POST /api/admin/stripe/transfer`, `POST /api/admin/schedules`, `PUT /api/admin/schedules/:id`, and `POST /api/admin/users` (bundle with the `contractor_id` fix `TENANT_RESOLUTION_REBUILD_SPEC.md` Section 2 already requires there — same handler, same session). **Do not attempt the remaining ~90 endpoints here** — see post-launch.

**Expected verification:** malformed amount/type fields rejected with 400 before reaching the transaction.

**STOP checkpoint:** full `npm test` green — existing valid requests must still succeed.

### Session 7 — Headers hardening (LAUNCH-GATING, own checkpoint due to regression risk) — covers SH-11

**Scope:** explicit `cors({ origin: process.env.FRONTEND_URL })`; tailored Helmet CSP.

**Expected verification:** referrer app and admin panel both fully functional post-deploy — image loads, tracking pixel, font/CDN assets.

**STOP checkpoint:** deploy to a preview/staging environment first if possible; manually click through both apps before calling it done — this is the session most likely to cause a silent regression.

### Session 8 — Login-path hardening: TOTP enforcement + account lockout (LAUNCH-GATING) — covers SH-10, SH-13

**Scope:** enforce TOTP as a real second factor at referrer login when `totp_enabled = true` (check after PIN verification succeeds, before issuing the session token); add a rate limiter to `/totp/confirm`; add a failed-attempt counter and temporary account-level lockout to login and PIN-reset-confirm, independent of the existing IP-scoped rate limiters.

**Expected verification:** a referrer with TOTP enabled cannot obtain a session token with PIN alone; N consecutive failed login attempts on one account lock it out for a defined window even from different IPs; `/totp/confirm` brute-force attempts are rate-limited.

**STOP checkpoint:** manually verify the existing Accent Roofing referrer flow still works end-to-end for a user *without* TOTP enabled (the common case) before and after deploy — this session must not accidentally lock out or break login for the majority of users who haven't opted into 2FA.

### Session 9 — Compliance, legal, and email authentication (MEDIUM, launch-gating only for App Store / CCPA-covered launch) — covers SH-15

**Scope:** terms-of-use acceptance checkbox at signup; Data Processing document + CCPA "Do Not Sell" disclosure (content/legal-review work); SPF/DKIM/DMARC verification via mail-tester.com or MXToolbox.

**Expected verification:** signup blocked without terms acceptance; DKIM/SPF pass on a test send.

**STOP checkpoint:** none required for the DNS check; legal content should be reviewed by counsel before publishing per the original audit's own recommendation.

### Session 10 — Rollback runbook (LOW, cheap) — covers SH-17

**Scope:** write the end-to-end rollback procedure (git revert steps, Railway redeploy steps, Backblaze restore steps, communication template); one staging dry-run to confirm accuracy.

**Expected verification:** a dry-run rollback on staging succeeds following only the written document, no undocumented steps needed.

**STOP checkpoint:** none — ~2 hour session, bundle with any other session's downtime.

---

**Post-launch hardening (not blocking pilot launch):**
- Remaining ~90 endpoints' validation rollout (rest of SH-9), prioritized by write-frequency and blast radius.
- SH-2: CLAUDE.md documentation sync for the RBAC/`team_members` system and the retired `ADMIN_PASSWORD` mechanism — **approved, Section 6 Q7 — as its own small commit in the next build session that touches CLAUDE.md.**
- SH-12's cleanup items.
- SH-16: `activity_log` append-only confirmation, IP-address capture, retention-policy review.
- SH-18: secrets-rotation-plan documentation.
- The 354-item Dependabot/CodeQL alert backlog (Section 2, item 35) — a severity-sorted triage pass, expected to substantially overlap with SH-3/SH-4/SH-8 and CRA-toolchain noise already prioritized above.
- `express`/`twilio` major-version upgrades.
- Performance-domain items tracked by the original audit but out of this security spec's scope: DB indexes (#20/#38), N+1 elimination (#37), pagination (#40), SELECT*/unbounded queries (#39), QPS monitoring (#5), staging containerization (#7), frontend error-boundary audit (#19), monitoring/alerting expansion (#21/#42) — these remain under the original document's own Database Performance / Monitoring & Alerting / Infrastructure sessions, not re-planned here.

**SOC-2-era (not needed for this pilot):**
- SH-14: native PostgreSQL RLS policies as defense-in-depth beyond the tenant rebuild's application-layer scoping.
- SOC 2 gap assessment (Section 2, item 25) — unchanged, future milestone at $250K–$500K ARR.
- Secrets management via a dedicated KMS/Vault instead of Railway env vars + a local encryption key.
- Third-party penetration test.
- Centralized log aggregation / intrusion detection.

---

## 5. Business-Rule Verification (Phase 0.5) — Facts Only

**(a) "Qualifying roofs must be 28 squares or more" — NOT ENFORCED anywhere. It was retired, not lost.**

This rule was never more than a static disclaimer paragraph in frontend JSX. It was added in commit `1870314` (2026-03-11) in `src/App.js`, relocated unchanged to `DashboardTab.jsx` in commit `a01a632` (2026-03-29), and deleted in commit `0b644fd` (2026-04-30) when the dynamic `<RewardScheduleCard/>` (reading real terms from `referral_schedules` via API) replaced it. It never existed as a Jobber custom-field read, a DB column, or a condition inside `evaluateReferral()`'s decision chain. No trace of it exists in the current referral evaluation engine, schedule condition system, or webhook path.

**(b) "Counter resets January 1st each year" — `paid_count` is lifetime-cumulative. A different, unrelated annual-reset mechanism exists.**

The "resets Jan 1" text traveled with the 28-squares text through the same three commits above — also never more than UI copy, never wired to logic. `paid_count` (`users` table) has exactly one write site (`webhooks/jobber.js:958`), a pure increment, with an explicit code comment at `db.js:149`: *"paid_count on users remains as an all-time cache only. Do not use paid_count for period filtering."* No cron job, no reset branch, anywhere.

A real annual-reset feature does exist, but it's a different mechanism entirely: `referral_schedules.reset_period` (`'annual'`/`'lifetime'`/`'none'`), used only for `payout_model = 'escalating'` schedules, counting `referral_conversions` rows (not `paid_count`), anchored to a per-contractor configurable `referral_start_date` (a rolling anniversary, not a fixed January 1st calendar date).

---

## 6. Open Questions for Danny

**All seven original open questions are resolved. Zero open questions remain in this section as of v1.1.**

1. **RESOLVED.** The original May audit document was located in the planning-chat project files (never in this repo), added at `docs/RoofMiles_Security_Audit_May2026.md`, and Section 2 was redone this session as a true re-verification against its actual 42 numbered findings. This spec plus that original document together now form the security baseline going forward.

2. **DECIDED.** Enforce TOTP as a real second factor at referrer login when the user has it enabled; add a rate limiter to `/totp/confirm`. Do not remove the toggle. Slotted into Session 8 (Section 4).

3. **RESOLVED.** Per Jobber's official webhook documentation, HMAC signatures are computed with the app's client secret by design — there is no separate webhook signing secret to request. `JOBBER_CLIENT_SECRET` reuse in `jobber.js:36` is intentional and correct. The remaining work is exactly SH-7's timing-safe comparison and signature-header-name TODO.

4. **RESOLVED.** GitHub's default-setup CodeQL is confirmed **active** on the repository (Security tab, checked 2026-07-07; last scan 9 hours prior; 104/104 JavaScript files scanned). The manual-workflow removal in commit `848d082` was correct. **Tracked follow-up (not yet performed):** the Security and Quality tab shows 354 open alerts (Dependabot + CodeQL combined) with no dedicated severity-sorted triage pass yet — logged under Post-launch hardening in Section 4, expected to substantially overlap with SH-3/SH-4/SH-8 and CRA-toolchain noise already prioritized in this spec.

5. **APPROVED.** `express-validator` is the standard validation library for all write endpoints going forward. Never introduce a second validation framework for the same job.

6. **CONFIRMED.** SH-1's credential re-encryption requires a verified Backblaze backup immediately beforehand, per the CLAUDE.md migration-safety rule. Timing: scheduled as Session 1, first in Section 4's ordering.

7. **APPROVED.** Update CLAUDE.md's authentication section to remove stale `ADMIN_PASSWORD` references and document the live `team_members`/RBAC/tier model — as its own small commit in the next build session that touches CLAUDE.md, not as part of this read-only session.
