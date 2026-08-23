# RoofMiles — Execution Sequence

*Written 2026-08-21 against HEAD 48a93ed, after Session A. Supersedes §7 of the ABR handoff and the tier structure in ROADMAP_RECONCILIATION v2. `RoofMiles_ReSequenced_Execution_Plan_v1.docx` is retired as a queue and kept as a register.*

---

## 0. What this is sequenced against

**Launch definition (ruled 2026-08-21):** a contractor RoofMiles has never met signs up from the marketing site, provisions their account, completes an onboarding wizard, connects Jobber, configures Stripe, sets their reward structure, syncs their team, and runs their program — with nobody at RoofMiles touching anything.

Three consequences drive everything below:

1. **Contractor-#2 readiness is the launch gate, not a post-launch gate.** Every item previously deferred to "before contractor #2" is now launch-gating.
2. **There is no Gate 1 / Gate 2 split.** App Store submission is a step inside launch, not a milestone ahead of it — which is why the ReSeq Plan's structure is retired.
3. **The onboarding wizard, account provisioning, and the signup path are first-class builds with no code today.** They are the product for contractor #2.

**What state this is built on:** production was read directly on 2026-08-21 (`docs/GROUND_TRUTH_2026-08-21.md` + addendum). The pipeline is healthy, the `contractor_settings` split-brain is closed, and one error is live. That is a different picture from the documents, and it moved two things.

---

## ⚠ 1. The one question that could change this

**D1 said "referrer app fully loaded." That phrase is not pinned, and it is worth roughly twenty sessions.**

- **Narrow reading** — the referrer app as it works today, plus the pipeline fixes that make referrals actually convert. Wave 3 (UI Overhaul, points economy, store, gamification, Celebration) is **post-launch**.
- **Wide reading** — feature-complete, including Member Rank Economy R2–R4, the UI Overhaul arc, endowed progress / goal gradient, and the Celebration System. Wave 3 moves **before** launch.

**This document assumes the narrow reading**, because the referrer app is live and functional today and the thing actually broken about it is the conversion pipeline, not the surface. Under the wide reading, insert Wave 3 between Waves 2 and 4 and add roughly twenty sessions.

If you want the wide reading, say so before Wave 1 starts — RANK R1's scope changes, and UX Phase 0 moves much earlier.

---

## 2. The sequence

### WAVE 0 — Make a referral convert *(3–4 sessions)*

Nothing downstream means anything until this works. Thirteen pending referrals, zero conversions, ever.

| # | Session | Contents |
|---|---|---|
| 0.1 | **`ARCHITECTURE.md` reconciliation** | 24 files, 3 directories missing — including `utils/sessionPolicy.js`, cited by name in CLAUDE.md's session non-negotiable. **Fix by generating the structure**, not by hand-listing, or it recurs by next session. Half a session, and every session after it reads a true map. |
| 0.2 | **Jobber ingestion repair** | KI-2b's null guard (~550 live failures, upstream of `upsertAndTagClient`'s write sites, on the sparse-payload fallback) · name normalisation at all three write sites · backfill. ⚠ The backfill must account for clients **never written**, not only names written badly. |
| 0.3 | **F8** | `contractor_id` filter on the two user-matching queries. Small, and it unblocks 0.4. |
| 0.4 | **Matcher rebuild** | Point the matcher at the persisted `jobber_clients` table instead of the empty in-memory array (`pendingReferral.js`). ⚠ Two root causes, not three — the funnel-status join was falsified by ground truth. Do not go looking for it. |
| 0.5 | **Verify in production** | A real referral converts end to end. `matched_user_id` is non-NULL on at least one row. **Do not start Wave 1 without this.** |

**Why first:** the field rep app is the channel people enter through. Building the front door onto a conversion that has never fired once is the specific risk §7 named and then didn't act on.

---

### WAVE 1 — The field rep interface *(6–9 sessions)*

The main acquisition channel, and where you want to be.

| # | Session | Contents |
|---|---|---|
| 1.1 | **Auth surface batch** | C/DL-3b-2 (team credential recovery + 2FA — team members have **no password reset path at all**; both 2FA code tables FK to `users(id)`; one dual-nullable subject shape serves both; ⚠ a reset must not become a 2FA bypass) **plus** R4 (`verifyAdminSession()` doesn't check `team_members.active`) · the super-admin write-bypass invariant test · step-up re-auth (D7's missing safety control). All four touch the same surface; do them while it's open. |
| 1.2 | **RANK R1** | Rank derivation + read surfaces. ⚠ Required by RANK-8 *before or alongside* 1.3 — rank is derived at read time from `referral_conversions`, never stored, so the "flows through to both surfaces" property is free once R1 exists. RANK's own header says FieldRepApp is out of scope except RANK-8; that exception has a scheduling cost. |
| 1.3 | **C/DL-3c + E-min** | Rep app shell, read surfaces, the six-item theme pass (incl. `on-primary` at 3.06:1 and the missing light-mode contrast floor), `useAdminPermissions` context plumbing, D10 router decision, theme toggle (engine and store already exist — only the switch is missing), owner→rep surface switcher, R2's open security question on echoing a slug. **E-min rides along:** build the reactivation path (no route sets `active = true` anywhere) and close the frozen-rep-with-homeowner-account question in writing. ⚠ Ground truth found `surfaceFor()` returns before the rep rule because the referrer descriptor doesn't carry `is_field_rep` — so this is a one-way-door fix, not a security gate. Fold R4 in if 1.1 didn't. |
| 1.4 | **Contractor-ID reconciliation** | Its own auth/money-adjacent session, Phase 0 first. `account.js:436` is live-broken. ⚠ **Size it from 80/170, not from 77/166 and never from 5** — and open with a fresh grep or `npm run sizing`, never `HARDCODED_ACCENT_INVENTORY.md` (four wrong checks out of four). Adopt the session/connection-derived pattern; `getDefaultContractorId()` was deleted. Folds in `contractors.slug` backfill and `db.js:1532`. |
| 1.5 | **Job Revenue Capture** | True job revenue is stored nowhere. One ruling owed: contracted-sold price vs collected-paid amount. ⚠ Its recorded blocker — "the full-sync aborts every cycle" — is **false** as of 2026-08-21. Only `account.js:436` gated it, which 1.4 clears. |
| 1.6 | **Rep revenue surface** | The 3c branch that needed 1.5. |
| 1.7 | **C/DL-3d / 3e** | Add client + roster; network constellation. ⚠ Two approved React Flow prototypes exist — **re-find them, don't re-prototype**. 3e is the most build-heavy piece in the arc. |

**Decisions owed before 1.7:** R8 (rep-side milestone checkpoint; client-portal rep-selection banner — "not yet sold," open since June) and R9 (GraphiQL confirmation that Jobber exposes a request's assigned team members — "likely resolved by S92, verify," never confirmed in writing). Both are rulings, not builds.

---

### WAVE 2 — The product for contractor #2 *(8–12 sessions)*

This is the launch gate under D1. Almost none of it exists.

| # | Session | Contents |
|---|---|---|
| 2.1 | **Signup + provisioning** | Marketing-site signup that creates a contractor account. No evidence any path exists today. |
| 2.2 | **Onboarding wizard** | The 5-step guided setup from the S6 design: account/brand → CRM OAuth → Stripe Connect → reward structure → shareable link. Plus team sync. ⚠ Fold in **contextual inline help** on the three or four genuinely confusing cards (Jobber OAuth, Stripe Connect, reward-schedule config) — same session, not a separate one. |
| 2.3 | **Tenancy sweep** | The 80/170-site brand-literal sweep · `team_members.email` global uniqueness (two contractors can't share an employee email) · `payout_announcements` has no `contractor_id`. |
| 2.4 | **CRM dispatch + tokens** | `crm/index.js:29-30` hardcodes `require('./jobber')` inside the `connection_method === 'oauth'` branch, ignoring `crm_type` destructured two lines above. Then `:31-34`'s raw token SELECT bypassing `getContractorAccessToken()` — a live Never-Break-These-Rules violation. **Dispatch first, consolidation second.** |
| 2.5 | **`runFullSync` pacing** | No pacing or retry logic at all, unlike the retrofitted incremental sync — and it runs on exactly first-time contractor onboarding, which is when #2 arrives. Needs its own design pass; no chunking structure exists to hook into. |
| 2.6 | **OAuth state signing** | State is validated for existence, not authenticity. An attacker completing their own Jobber OAuth could overwrite another contractor's connection. HMAC or a server-stored nonce minted at an authenticated initiation step, plus an audit of everything downstream of the callback's `contractorId`. |
| 2.7 | **Tier enforcement** | 5/10/15 payouts, 200/600/1500 SMS, per-tier feature gating. **Enforcement only.** |
| 2.8 | **⚠ Security G — the isolation test** | Log in as Contractor A, attempt to read Contractor B's data. **Never built.** This is the proof that closes the tenancy phase — everything above is a claim until this passes. |

**Not in Wave 2:** the Stripe Billing charge path. Accent's plan reads "pilot, no charge" on day one; charging lands as a fast-follow once LLC → Mercury → Stripe clears. That removes the only externally-blocked item from the launch gate.

**Also here:** the external FAQ. ~10–15 articles on a static page, linked from Profile/Account settings. ⚠ **Do not build or buy a knowledge-base platform** — revisit at contractor #5. This is a writing task and a one-line link; it can run in parallel with anything.

---

### WAVE 3 — Referrer app depth *(post-launch under the narrow reading)*

| | |
|---|---|
| **UX Phase 0** | A full audit across every referrer UX component and sequence, before the arc is sequenced at all. ⚠ Ground truth found all three of §11.1's shared primitives already exist — this spec's Phase 4.1/4.4 scope is substantially discharged and the document didn't know it. Re-scope, don't rebuild. Runs after 1.4. |
| **UI Overhaul arc** | Phases 1–5 per `UI_OVERHAUL_SPEC.md`, re-scoped by Phase 0. UX-2 is a QA pass, not a build — the theme engine produces both modes and `user_preferences` is the store; only the toggle was missing, and 1.3 built it. |
| **Referrer psychology session** | UX-6's 7.1/7.2 (endowed progress, goal gradient) — ruled to a dedicated referrer-app session after the field rep interface, alongside the other gamification and presentation work. |
| **RANK R2–R4** | Points economy, store, redemption. 18 open decisions in `MEMBER_RANK_ECONOMY_SPEC.md` §13. ⚠ RANK §2 hard-prohibits points for reviews (Google policy — it can penalize the *contractor's* listing); whoever builds the Referral Conversion Engine's review→referral sequence must have read it. |
| **Referral Conversion Engine** | 8 features, zero code. Features 1–3 are ~1 session and directly raise referral volume — the cheapest revenue-side work in the queue. |
| **Campaigns completion** | Resend webhooks first (prerequisite for scoring) · status lifecycle (campaign 55 sits at `current_batch=2, total_batches=1`, still `active`, only exit a lazy 90-day expiry) · `List-Unsubscribe` ⚠ **required before the first real campaign send** · apex legal links 404 · Audience→Builder integration · bulk import · Flow Builder · Engagement Intelligence L1–4. |
| **Celebration System** | Sessions A–E, alongside the UI Overhaul. |
| **The rest** | ~90 catalogued items — `RoofMiles_Master_Findings_Session94_5_v2.docx` §6 is the register. Don't rebuild it. |

---

### WAVE 4 — Security hardening *(10–14 sessions, gates submission)*

`SECURITY_HARDENING_SPEC.md` Sessions 1–10, **with five amendments**:

- **SH-4/5 moves to first.** `escapeHtml` is 7 definitions and four of six local copies don't escape `'`, in an attribute context, with Jobber client names flowing into outbound email. That's a security fix, not a consolidation.
- **Re-scope Session 4** — its tenant-spec batching partner already shipped.
- **Fold the checklist's `err.message` entry into Session 2** rather than sweeping twice. ⚠ 45 sites, and five are not the plain `{ error: err.message }` form — a regex written against only that form leaves them.
- **Drop what Wave 1 and 2 already did** — step-up re-auth, super-admin invariant test, R4, OAuth state signing all land earlier.
- **Add what the spec lacks** — `ADMIN_PASSWORD` retirement (⚠ establish what legacy `POST /api/admin/login` mints *first*; it may be a second privileged door), Stripe `pk_test_` → live key, the Vercel routing smoke check (four legal paths 404'd in production for 11 days behind green local gates — a defect *class*, not an incident).

Remaining from the spec: SH-1 credential encryption (**CRITICAL** — Jobber tokens are plaintext) · SH-6/7 webhook replay + timing-safe HMAC · SH-8 multer CVE · SH-9 money-path validation · SH-11 headers/CORS (both wired in, both at defaults) · SH-10/13 TOTP-at-login + lockout · SH-15 compliance, terms checkbox, SPF/DKIM/DMARC · SH-17 rollback runbook.

---

### WAVE 5 — Ship *(4–6 sessions)*

Capacitor iOS + Android → push wiring → store listings, screenshots, privacy URL → launch smoke checklist **authored and executed** → rollback runbook with a **real B2 restore dry-run** (the Backup Ops Guide admits restore isn't one-click today) → PWA fallback verified → freeze → submit.

---

### FLOATING — jumps every queue the day it clears

LLC amendment → Mercury → Stripe ACH go-live + a $20 end-to-end test · SMS unblock (10DLC flip, live send, STOP honoring, Twilio 6.x, `pendingReferral.js:108`'s inverted NODE_ENV gate, stale copy) · legal pages · Stripe Billing charge path.

All four are underway in the background. None of them gate anything above.

---

## 3. Where this overturns §7

| §7 said | This says | Why |
|---|---|---|
| Contractor-ID reconciliation first | **Wave 1.4** — after the pipeline and the rep app shell | D3/D4 removed two of its three stated reasons. The pipeline is healthy and the split-brain is closed. `account.js:436` is live but it gates Job Revenue Capture, not 3c |
| 3c is the next build | **Wave 1.3** — after ingestion, F8, the matcher, and the auth batch | §7's own sentence: "the matching engine is what decides whether any of it works at launch." Sequence the sentence, not the table |
| 3b-2 after 3c | **Before** (1.1) | Resolves the contradiction between ABR Phase 5.1 and ABR 6B/6A in favour of the recorded order. Auth work while the auth surface is warm, and 3c only widens the population with no credential-recovery path |
| Job Revenue Capture blocked by contractor-ID | **Partly false** | Its stated blocker was an aborting full-sync. Verified healthy 2026-08-21 |
| *(silent on everything else)* | Waves 2, 4, 5 | §7 was a micro-sequence inside one work package. Ten security sessions, the entire store block, and all of contractor-#2 readiness were outside it |

---

## 4. Rules that bind every session below

From `CLAUDE.md` as of 48a93ed, plus what this reconciliation established:

- **Exact-path staging only.** Never `git add -A`, never `git add .`. Stage, run `git status --porcelain`, verify, then commit **bare** — a pathspec on `git commit` bypasses the index.
- **Phase 0 before any code.** Read-only, scoped to files the session touches.
- **RED-first.** Never change production code to satisfy a test. Disable the guard, prove the test goes red, restore.
- **`npm run sizing` for counts, never a hand-count.** ⚠ Every un-generated count in the project's records is a **lower bound**, not a total — `grep -c` counts lines. Read any of them as "at least N."
- **Close the entry when the arc closes.** R14 governs deferral; the closure half governs completion. A list that can only grow becomes a list of things that were once true.
- **State a check's failure mode and prove it fails that way** before trusting that it passes. The sizing script shipped with a false positive on its first run, caught only by contradiction.
- **`npm test -- --test-concurrency=1`.** Two concurrent runs orphan `pg_trgm` unrecoverably.
- **Backblaze confirmed** before any database, money, or auth-path deploy.

---

## 5. Still owed on the records

Not blocking. Recorded on `PRE_LAUNCH_CHECKLIST.md` under Named builds.

- **`CLAUDE.md` budget sweep** — 43,940 against its own stated 40,000. Session A added 3,128 of the overage; it was 812 over before. Reference-vs-rule triage, not undoing recent work.
- **The five `.docx` conversion** — they are the entire untracked working tree, and six checklist entries depend on one of them. Converting them closes the working-tree question completely.
- **Four redundant spec copies of the staging rule** — three carry wrong file lists. Now redundant since CLAUDE.md carries it.
- **`CLAUDE_REGISTRY.md` split** — 69,170 chars, and `db.js:1662` names "Known Issue 13" inside a production `console.error`, so the section number is load-bearing at runtime.
- **`error_log.resolved` has never been set on any row**, and the `backend` source carries 48 distinct errors with no route attribution — 72% of error volume in an ungroupable bin.

---

## 6. Open questions

1. **⚠ "Referrer app fully loaded" — narrow or wide?** §1. Worth ~20 sessions.
2. **Contracted-sold vs collected-paid** for Job Revenue Capture (1.5).
3. **R8** — rep-side milestone checkpoint and client-portal banner. Open since June.
4. **R9** — GraphiQL confirmation on Jobber's assigned team members. "Likely resolved, verify," never confirmed.
5. **Jan-1 vs rolling annual reset** against `referral_schedules.reset_period`; the `$20` cashout minimum pinned in the suite; the 28-squares successor. Accent's finance team will ask.
6. **`inconsistent types deduced for parameter $5`** — 8 occurrences, route `unknown`, quiet since May. Needs a route before it can be found.

---

*Sequenced against production state verified 2026-08-21 and the corrected records at 48a93ed. Wave 0 is next.*
