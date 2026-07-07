# Contractor #2 Readiness Audit

Read-only audit. No source files were modified. One uncommitted working-tree file was observed and left untouched: `docs/superpowers/plans/2026-05-26-grouped-filter-jobber-clients.md` (untracked, not part of this audit).

---

## 1. Executive Summary (plain language)

Imagine RoofMiles today is a house built for exactly one family. Adding contractor #2 isn't like adding a room — it's like discovering the front door only has one key, and two rooms in the house don't have walls between them at all.

The single biggest finding: **the referrer-facing app (login, signup, pipeline, cash out — everything a referrer touches) and all Jobber webhook processing will stop working entirely, for everyone, the instant a second contractor row is inserted.** This isn't a data leak — it's a hard stop, by design (a safety helper called `getDefaultContractorId()` throws an error on purpose rather than guess which contractor a request belongs to). That's the *good* news: it fails safely instead of leaking data. The bad news: it means contractor #2 cannot simply be "added" — the referrer app needs a real rebuild of how it knows which contractor a request belongs to before that row can go in.

The second biggest finding is worse, because it does not fail safely: **the Jobber connection (OAuth token) is stored in a database row that can only ever hold one contractor's credentials at a time**, even though the table was clearly designed to hold one row per contractor. The moment contractor #2 connects their Jobber account, it silently overwrites and destroys contractor #1's connection. Two places in the code will then actively hand one contractor's Jobber data to a different contractor's request.

Third: two admin-wide settings (**the dashboard stats cache and the referrer announcement popup config**) are stored in tables with no contractor identity column at all — every contractor would share and overwrite the same one.

None of this needs to be fixed today. But none of it can be deferred past the point where contractor #2's data actually starts flowing through the system. Pilot launch is July 15, 2026 — these findings should shape whatever session is scheduled to do the "onboard contractor #2" work, not be treated as routine cleanup.

---

## 2. Coverage Statement

**Deep analysis (read line-by-line, call sites traced):**
- `server/db.js` (schema definitions, contractor/token/seed logic)
- `server/routes/oauth.js`
- `server/crm/jobber.js`, `server/crm/index.js`, `server/crm/pipelineSync.js`
- `server/routes/webhooks/jobber.js` (token/refresh sections; contractor-resolution sections already covered by Session 94 fix, re-verified not re-derived)
- `server/utils/contractorContext.js`
- `server/routes/referrer.js` (session creation, token access, singleton queries)
- `server/routes/admin/campaigns.js` (Jobber pull endpoint only)
- `server/cron/jobs/jobberIncrementalSync.js`
- `server/utils/attributionEngine.js` (client_rep_assignments scoping only)
- `server/routes/stripe.js` (hardcode confirmation only — feature not live)

**Mechanical scan only (grep-based, not read in full):**
- `server/routes/admin/index.js`, `admin/metrics.js`, `admin/cashouts.js`, `admin/contacts.js`, `admin/team.js`, `admin/referrers.js`
- `server/routes/account.js`, `server/utils/notificationEmail.js`, `server/utils/errorLogger.js`, `server/utils/stripeTransfer.js`
- `server/jobs/fullJobberImport.js`, `server/utils/pendingReferral.js`
- Frontend (`src/`) — brand-string scan only, no tenancy logic exists there to audit
- `docs/superpowers/**` — brand-string scan only (historical specs, not live code)

**Not covered (out of time budget):**
- `server/routes/admin/campaigns.js` beyond the Jobber-pull endpoint (~3,163-line file, known complexity debt)
- `server/cron/jobs/engagementCadence.js`, `dynamicAudiences.js`, `postJobSequence.js` internals (only their `LIMIT 1` hits were scanned)
- Full read of `server/routes/webhooks/jobber.js` invoice-paid handler (~460 lines) beyond token/tenancy sections
- `server/routes/account.js`, `server/utils/backup.js`, `server/utils/restore-verify.js` full contents
- Frontend component logic beyond string search

---

## 3. Findings Table

| ID | Severity | Category | File:Line | Description | Status |
|----|----------|----------|-----------|--------------|--------|
| F1 | CRITICAL | C | `server/routes/referrer.js` (21 call sites), `server/routes/webhooks/jobber.js` (5 call sites) | Entire referrer app and all Jobber webhooks resolve tenant via `getDefaultContractorId()`, which throws the instant `contractors` holds 2+ rows — total referrer-app and webhook outage on contractor #2 insert | NET-NEW (mechanism is TRACKED per registry 2a; the "this takes down contractor #1 too" consequence is not called out anywhere) |
| F2 | CRITICAL | B/C | `server/routes/oauth.js:30-31` | OAuth callback hardcodes `INSERT INTO tokens (id,...) VALUES (1,...) ON CONFLICT (id) DO UPDATE` — every contractor's Jobber connection overwrites the same row, destroying the previous contractor's token | NET-NEW |
| F3 | CRITICAL | C | `server/crm/jobber.js:20,37` (`refreshTokenIfNeeded`) | Token refresh reads/writes `WHERE id=1` with no contractor awareness at all — called from 7+ sites regardless of which contractor's flow triggered it | NET-NEW (the *race* between call sites is TRACKED as 2c; the *tenant-blindness* of the same function is not) |
| F4 | CRITICAL | B | `server/routes/referrer.js:360`, `server/routes/admin/campaigns.js:1408` | Both call sites fetch the Jobber access token via `WHERE id=1` (not contractor-scoped) and use it to pull that token's-owner's Jobber clients/jobs into a *different* contractor's signup-match / campaign-pull flow | NET-NEW |
| F5 | CRITICAL | C | `server/crm/pipelineSync.js:898-921` (`runScheduledSync`) | The 30-minute pipeline sync cron discovers contractors via `SELECT DISTINCT contractor_id FROM tokens` — because of F2/F3, this can only ever return one contractor, so only one contractor's pipeline ever syncs regardless of how many are onboarded | NET-NEW (direct consequence of F2/F3) |
| F6 | CRITICAL | D | `server/db.js:37-40,67-76`; `server/routes/referrer.js:793`; `server/routes/admin/index.js:230,248`; `server/routes/admin/metrics.js:41,83` | `admin_cache` and `announcement_settings` tables have no `contractor_id` column at all (`id INTEGER PRIMARY KEY DEFAULT 1`) — dashboard stats cache and referrer announcement config are global singletons shared/overwritten by every contractor | NET-NEW |
| F7 | CRITICAL | A/C | `server/db.js:23-26` (`users` table definition); `server/routes/referrer.js:742` (session INSERT) | `users` table has no `contractor_id` column at all (global `UNIQUE` email), and referrer login sessions never set `sessions.contractor_id` (only admin sessions do) — referrer identity has zero tenant boundary at the schema level | NET-NEW |
| F8 | HIGH | A | `server/routes/webhooks/jobber.js` (invoice-paid handler), `server/crm/pipelineSync.js` (referrer-account lookup) | `users` matching by name/email/phone has no `contractor_id` filter (F7 means it structurally can't) — a match could credit the wrong tenant's referrer | TRACKED (`project_...` registry "users matching ... cross-tenant risk", 2026-07-06, deferred) |
| F9 | HIGH | B | `server/routes/stripe.js:13` | `CONTRACTOR_ID = 'accent-roofing'` hardcoded (note: the *ghost* id, not even `accent-roofing-dev`) | TRACKED (registry 2a "STILL OPEN": stripe.js) |
| F10 | HIGH | B | `server/routes/account.js:436` | `contractor_settings WHERE contractor_id = 'accent-roofing'` hardcoded literal (again the ghost id) | TRACKED (registry 2a "STILL OPEN": account.js) |
| F11 | MEDIUM | C | `server/db.js:1187` | `UPDATE team_members SET full_name='Danny Scribbins' WHERE id=1` | Not a tenancy risk — one-time backfill of a specific known seed row, self-limiting (`IS NULL` guard). Noted, no action needed. |
| F12 | MEDIUM | D | `server/routes/oauth.js:74` / Jobber webhook subscriptions | Single Jobber Developer Center app / single set of webhook subscriptions serves all contractors; contractor identity is resolved after the fact via `getDefaultContractorId()`, not from the webhook payload itself | Overlaps F1 — same fix unlocks both |
| F13 | LOW | C | `server/db.js:791` | `SELECT id FROM referral_schedules LIMIT 1` used only as an emptiness check before a seed insert — confirmed scoped correctly by surrounding code (not read in full this session; flagged for confirmation only) | Not fully verified — low confidence, likely benign |
| F14 | INFO | — | `Accent Roofing` / `Rooster Booster` brand strings | ~90 hardcoded brand-string hits across `src/`, email templates, and `campaigns.js` hardcoded sender/company names (e.g. `campaigns.js:367,1281,2029`) | Known/expected — branding is intentionally hardcoded pre-white-label work; not a tenancy bug, listed for completeness |

---

## 4. Detailed Findings (NET-NEW only)

**F1 — Referrer app + webhooks hard-stop on contractor #2 insert**
What it is: Every referrer-facing route (`server/routes/referrer.js`, 21 sites) and every Jobber webhook handler (`server/routes/webhooks/jobber.js`, 5 sites) get "which contractor is this?" from `getDefaultContractorId()`. That function is intentionally designed to throw the moment the `contractors` table holds anything other than exactly one row.
Why it breaks: This is a deliberate tripwire (built 2026-07-06 specifically to prevent silent cross-tenant leaks), but it means the fix that makes contractor #2 *safe* also makes contractor #1 (and #2) *completely unable to use the app* until real per-request tenant resolution (session-derived contractor_id, or in the webhook case, resolving contractor from the Jobber account the webhook came from) replaces every one of those 26 call sites.
Conceptual fix direction: Referrer sessions need to carry `contractor_id` the same way admin sessions already do (this is half-built — see F7), and every one of those 21+5 call sites needs to read `req.session.contractor_id` (or equivalent) instead of calling the fail-closed helper. Technically: mirror the admin-side pattern (`sessions.contractor_id`, populated at login, checked via a `verifyReferrerSession()`-style helper) and thread it through referrer.js and the webhook handlers, resolving the webhook side by looking up which contractor's `contractor_crm_settings`/token belongs to the Jobber account the webhook arrived from.

**F2 — OAuth callback overwrites the single `tokens` row on every connect**
What it is: `server/routes/oauth.js:30-31` inserts with a literal `id=1` on every single Jobber OAuth completion, `ON CONFLICT (id) DO UPDATE`. The `tokens` table also has a `contractor_id` column with its own `UNIQUE` constraint (added later, clearly intended to make this table one-row-per-contractor) — but because `id` is hardcoded, there is structurally only ever one row in this table, no matter how many contractors connect.
Why it breaks: The moment contractor #2 completes Jobber OAuth, that same row's `access_token`/`refresh_token`/`contractor_id` get overwritten with contractor #2's values. Contractor #1's Jobber connection is destroyed with no error, no notification, no trace — their pipeline sync silently starts failing ("no token found") from that point on.
Conceptual fix direction: Stop hardcoding `id=1`. Since `contractor_id` is already unique and already the real lookup key everywhere else in the codebase, either drop the surrogate `id` column entirely and make `contractor_id` the primary key, or generate a real per-row id and upsert `ON CONFLICT (contractor_id)` instead of `ON CONFLICT (id)`.

**F3 — `refreshTokenIfNeeded()` is tenant-blind**
What it is: `server/crm/jobber.js:19-42` reads and writes `WHERE id=1` with no `contractorId` parameter at all, called from `crm/index.js`, `referrer.js`, `pipelineSync.js` (x2), `admin/team.js`, `admin/campaigns.js`, and `fullJobberImport.js` — none of which tell it *which* contractor's token to refresh.
Why it breaks: Even independent of F2, this function has no concept of "whose token." Once F2 is fixed and the `tokens` table genuinely holds multiple rows, this function still can't refresh the right one — it needs a `contractorId` argument threaded through every call site.
Conceptual fix direction: Add a required `contractorId` parameter to `refreshTokenIfNeeded()`, scope both the `SELECT` and `UPDATE` by `contractor_id`, and update all seven-plus call sites to pass it. This is the same durable fix already deferred under registry item 2c (single-flight/mutex) — worth doing both in the same pass since they touch the same function.

**F4 — Two call sites hand one contractor's Jobber data to another contractor's request**
What it is: `referrer.js:360` (signup-time Jobber client match) and `admin/campaigns.js:1408` (campaign Jobber pull) both fetch the access token via the tenant-blind `WHERE id=1` query, then use it to call Jobber's GraphQL API — but the rest of each function is correctly scoped to the *requesting* contractor (`contractorId` from the admin session, or the new signup's own row).
Why it breaks: This is a genuine cross-tenant leak, not just a failure. If contractor B's admin pulls a campaign, but contractor A currently "owns" the one token row, contractor B's campaign gets populated with contractor A's Jobber jobs. Same risk for the signup-match background job silently linking a new contractor-B user to a contractor-A Jobber client (`users.jobber_client_id`).
Conceptual fix direction: Once F2/F3 are fixed so tokens are genuinely per-contractor, change these two queries from `WHERE id=1` to `WHERE contractor_id = $1` using the same `contractorId` variable each function already has in scope. This is a small, mechanical fix once the underlying table is fixed — don't do it before F2/F3 or it will just throw instead of leak (better, but still broken).

**F5 — 30-minute pipeline sync cron can only ever run for one contractor**
What it is: `runScheduledSync()` in `crm/pipelineSync.js` discovers which contractors to sync via `SELECT DISTINCT contractor_id FROM tokens WHERE access_token IS NOT NULL` — a direct, load-bearing consumer of the broken `tokens` table from F2/F3.
Why it breaks: Distinct values of `contractor_id` in a table that can only ever hold one row means this cron processes exactly one contractor, forever, regardless of how many contractors have valid CRM connections. This is the primary pipeline-cache refresh mechanism the referrer app reads from — contractor #2's referrers would simply never see pipeline updates.
Conceptual fix direction: Fixed automatically once F2 is fixed (the table will then genuinely hold one row per contractor). Worth adding a test asserting `runScheduledSync` processes N contractors for N connected tenants, so this doesn't silently regress again. Note `server/cron/jobs/jobberIncrementalSync.js` already discovers contractors correctly via `SELECT id FROM contractors WHERE status='active'` — that's the pattern to copy here instead of querying `tokens`.

**F6 — `admin_cache` and `announcement_settings` are true global singletons**
What it is: Both tables are defined with `id INTEGER PRIMARY KEY DEFAULT 1` and **no `contractor_id` column exists at all** (confirmed by reading the `CREATE TABLE` statements directly, not inferred). Every read/write (`admin/metrics.js:41,83`, `referrer.js:793`, `admin/index.js:230,248`) operates on `WHERE id=1` / `id=1` with no tenant filter possible even in principle.
Why it breaks: Contractor A's admin dashboard stats and contractor B's admin dashboard stats would be the literal same cached JSON blob, each overwriting the other every 20 minutes (per the cron). Contractor A configuring their referrer-facing announcement popup (enabled/mode/custom message) would change what contractor B's referrers see too.
Conceptual fix direction: Add a `contractor_id` column to both tables, change the primary key to `contractor_id` (or a composite), and scope every read/write by the requesting contractor. This is a schema change plus a handful of query updates — small in code size, but touches cached dashboard data that should be verified post-migration.

**F7 — Referrer identity (`users` + referrer sessions) has no tenant boundary at all**
What it is: The `users` table (`server/db.js:23-26`) was created with no `contractor_id` column and a *globally* unique `email`. Confirmed no later `ALTER TABLE users ADD COLUMN ... contractor_id` exists anywhere in `db.js`. Separately, referrer login (`referrer.js:742`) inserts into `sessions` without setting `contractor_id` — only admin logins (`admin/index.js:66`) populate that column, even though `sessions.contractor_id` exists as a column specifically added to "wire tenant identity into every... session" (per the comment at `db.js:1122`, which only mentions admin sessions).
Why it breaks: This is the schema-level root cause underneath F1 and F8. Two different contractors cannot each have a referrer sign up with the same email address (global `UNIQUE`) — a functional collision, not just a leak. And no query against `users` or referrer `sessions` can be tenant-scoped even if someone wanted to add the filter today, because the column doesn't exist. `getDefaultContractorId()` (F1) is effectively working around this exact gap by resolving tenancy from the single-row `contractors` table instead of from the request/session — which is precisely why it must fail closed rather than guess.
Conceptual fix direction: This is the real "Phase" of work referenced by the registry's Master Admin Panel note ("contractor_id must be session-derived... requires second contractor onboarded") and by the CLAUDE.md rule "contractor_id hardcoded... must be pulled from session token before contractor #2." Concretely: add `contractor_id` to `users`, make `email` unique per-contractor instead of globally, populate `sessions.contractor_id` at referrer login the same way admin login already does, and build a `verifyReferrerSession()`-style check that resolves `contractor_id` from the session row rather than from `getDefaultContractorId()`. This is the largest single piece of work in this report — treat it as its own dedicated session, not a quick patch.

---

## 5. Fix Sequencing

**Must fix before contractor #2's data flows through the system (not deferrable):**
1. **F7** (users/sessions schema — referrer tenant identity) — this is the foundation everything else in the referrer app depends on. Nothing else in the referrer-side fix list works correctly until this exists.
2. **F1** (thread session-derived `contractor_id` through referrer.js + webhooks, replacing `getDefaultContractorId()` calls) — depends on F7 existing first. **This is the natural home for the createApp()-refactor / Session 93 Task 1 webhook work already on the roadmap — batch F1, F7, and that refactor into one session rather than three.**
3. **F2 + F3** (fix `tokens` table id=1 hardcode + make `refreshTokenIfNeeded` contractor-aware) — must land together; F3 without F2 still refreshes the wrong row, F2 without F3 still can't refresh new contractors' tokens correctly.
4. **F4** (retarget the two `WHERE id=1` token reads to `WHERE contractor_id=$1`) — trivial once F2/F3 land; doing it before them just changes a leak into a different failure mode.
5. **F6** (admin_cache / announcement_settings schema) — independent of the above, can be done in parallel by a different session; small, contained schema change.

**Safely deferrable (won't corrupt data, but will visibly misbehave until fixed):**
- **F5** — self-resolves once F2 is fixed; add the regression test but no separate urgent fix needed.
- **F9, F10** — already tracked pre-launch cleanup items (stripe.js, account.js); Stripe path isn't live yet so F9 has no current blast radius. Sweep both when the tracked catch-block/hardcode audit happens, per the registry's existing "adopt `getDefaultContractorId()` — do not invent a parallel helper" instruction (note: once F1/F7 land, the *replacement* for these should be the new session-derived pattern, not `getDefaultContractorId()`, which will itself be retired).
- **F8** — already tracked and explicitly deferred by prior session; no new information changes that call, but note it becomes exercisable the moment F7 unblocks multi-tenant referrer signups.
- **F12** — resolves as a side effect of F1.

**Already tracked, no new action from this audit:**
- F8, F9, F10, F11 (verified benign), F13 (flagged, not fully verified), F14 (branding, expected).

**Bottom line for sequencing:** F7 and F1 are the load-bearing pair — batch them with the already-planned Session 93 Task 1 webhook fix and the `createApp()` refactor, since all four touch the same "how does a request know its contractor" problem. F2/F3/F4 are a separable, self-contained CRM-token fix that can be its own session. F6 can be done by anyone, anytime, independently.
